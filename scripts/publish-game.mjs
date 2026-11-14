#!/usr/bin/env node
/**
 * 把一款游戏包**上传并发布**到 tf-platform-api（`/api/admin/game/release/upload`）。
 *
 *     node scripts/publish-game.mjs \
 *       --api http://127.0.0.1:8090 \
 *       --id demo --version 1.0.0 \
 *       --file games-dist/demo.js
 *
 * 环境变量兜底：`TF_API` / `TF_ADMIN_KEY`（= 服务端 `ServiceSettings.AdminSignKey`）。
 *
 * ## 它不做什么
 *
 * 不算哈希、不拼 URL、不签目录 —— 这三件事全在服务端：
 * 哈希必须算**落盘后**的那份字节（上传流和磁盘上的东西可以不一样），
 * 目录签名要用服务端的私钥。客户端只信这两样。
 *
 * ## 为什么是 multipart 而不是「先传 OSS 再填 URL」
 *
 * 那是**另一条路**（`/game/release/publish` + 绝对 URL），两条路并存：
 *   · 包已经在 CDN 上 → 填 URL 发布（省一次中转）
 *   · 包还在本机 → 走这条，服务端落到 `<StaticPath>/games/…` 再由静态路由托管
 * 两条路最后都进同一个 `Publish`，所以库里长得一样。
 *
 * ## 包的结构
 *
 * 单个 `.mjs`（`build:games` 的产物），或者一个 zip：
 *
 *     <id>.plugin.mjs
 *     assets/…
 *
 * zip 会自动剥掉唯一的那层顶层目录（右键压缩常见的多余层级）。
 */

import { createHmac } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { basename, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const args = process.argv.slice(2)
const arg = (name, fallback = '') => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const API = (arg('api', process.env.TF_API ?? 'http://127.0.0.1:8090')).replace(/\/+$/, '')
const KEY = arg('key', process.env.TF_ADMIN_KEY ?? '')
const GAME_ID = arg('id')
const VERSION = arg('version')
const FILE = arg('file')
const CHANNEL = arg('channel', 'stable')
const NOTES = arg('notes', '')
const FORCED = arg('forced', '0')

if (!KEY) {
  console.error('缺 --key（或 TF_ADMIN_KEY）：要服务端 config 里的 ServiceSettings.AdminSignKey')
  process.exit(2)
}
if (!GAME_ID || !VERSION || !FILE) {
  console.error('用法：node scripts/publish-game.mjs --id <game_id> --version <1.0.0> --file <包> [--api …] [--key …]')
  process.exit(2)
}

const ext = extname(FILE).toLowerCase()
if (!['.mjs', '.js', '.zip'].includes(ext)) {
  console.error(`只收 .mjs / .js / .zip，你给的是 ${ext || '（无扩展名）'}`)
  process.exit(2)
}
const size = statSync(FILE).size

/**
 * 后台令牌：`base64url("<ts>:<userID>:<hex hmac-sha256(userID:ts)>")`
 * 与服务端 `middleware.TokenManager.GenerateToken` 必须逐字节一致。
 *
 * ⚠️ **要带 padding**：Node 的 `base64url` 会**去掉** `=`，而 Go 的
 * `base64.URLEncoding` 解码时要求补齐 —— 少了 `=` 服务端报
 * `10090102 后台令牌无效`（看着像密钥配错，其实是编码差了两个字符）。
 */
function mintAdminToken(key, userID = '1') {
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', key).update(`${userID}:${ts}`).digest('hex')
  const b64 = Buffer.from(`${ts}:${userID}:${sig}`, 'utf8').toString('base64url')
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4)
}

/* ============================================================
   发布前对一遍「包里的 manifest」和「这次要发布成什么」
   ------------------------------------------------------------
   三件事，任何一件对不上都是**静默事故**，必须在这里拦住：

   ① `manifest.id` ≠ `--id`
      把 A 的字节发成 B 的版本。客户端照单收下，装完打开是另一款游戏 ——
      没有一处会报错。这是三者里最致命的一条，**没有逃生口**。

   ② `manifest.version` ≠ `--version`
      目录里写 v1.0.0、代码其实是 1.0.2。客户端的「有没有新版本」比的
      就是 manifest 里的 version ⇒ 以后真发 1.0.1 时，装了这份的机器
      永远认为「已是最新」，再也收不到更新。也**没有逃生口**。

   ③ `manifest.name` ≠ 库里 `game.name`
      名字有两个来源：商城列表读库里那一列，装完显示包内这一份。
      两边不一致时家长看到的是「列表里叫 A、装上去叫 B」——
      实测 `demo` 就是这样（库里「插件演示」、包里「许愿池」）。
      这条**留了逃生口**：改名是正常操作，只是必须先把库里那列改了；
      真要不等库里改就发，显式 `--allow-name-mismatch`。

   ## 为什么用 `import` 读，而不是正则抠 `name:`
   manifest 是构建产物里的一段对象，压缩后键序、引号、嵌套都可能变，
   正则抠出来的是「看起来对」的字符串。`import` 拿到的是**模块真的导出的**
   那个对象，和宿主 `mountBundle` 拿到的是同一份。
   代价是会执行模块顶层代码 —— 而「顶层不许碰 window」本来就是契约
   （见 `notes/plugin-host.md`），所以这里执行失败本身就是个信号，
   默认当错误处理（`--no-manifest-check` 可跳过）。
   ============================================================ */
const NO_MANIFEST_CHECK = args.includes('--no-manifest-check')
const ALLOW_NAME_MISMATCH = args.includes('--allow-name-mismatch')

async function checkBundleAgainstTarget() {
  if (ext === '.zip') {
    console.log('· 跳过 manifest 校验：zip 里读不到（只有 .mjs / .js 能 import）')
    return
  }
  if (NO_MANIFEST_CHECK) {
    console.log('· 跳过 manifest 校验（--no-manifest-check）')
    return
  }

  let manifest
  try {
    const mod = await import(pathToFileURL(resolve(FILE)).href)
    /* ★ 和宿主同一口径（`src/games/loader.ts`：`mod.default ?? mod`）。
       两种导出形状并存：`export default { manifest, mount }`（demo）
       和 `export { manifest, mount }`（claw3d / prizepark）。
       只认 `.default` 的话，后一种会被判成「包里没有 manifest」——闸门误拦。 */
    manifest = (mod.default ?? mod)?.manifest
  } catch (e) {
    console.error(`✗ 这个包在 Node 里 import 不起来：${e.message}`)
    console.error('  包顶层碰了 window / document？那是契约禁止的（见 notes/plugin-host.md）。')
    console.error('  确认没问题要硬发：加 --no-manifest-check')
    process.exit(1)
  }
  if (!manifest?.id) {
    console.error('✗ 包里没有 manifest（`export default { manifest, mount }` 那一条）')
    process.exit(1)
  }

  if (manifest.id !== GAME_ID) {
    console.error(`✗ 包里的 id 是「${manifest.id}」，你要发布成「${GAME_ID}」`)
    console.error('  这样会把别的游戏的字节挂到这个 id 下，客户端装完是另一款。拒绝。')
    process.exit(1)
  }
  if (manifest.version !== VERSION) {
    console.error(`✗ 包里的版本是「${manifest.version}」，你要发布成「${VERSION}」`)
    console.error('  客户端的「有没有新版本」比的是包内 version ⇒ 以后真发新版时这台机器收不到。拒绝。')
    process.exit(1)
  }
  console.log(`· 包内 manifest：${manifest.id}@${manifest.version}「${manifest.name}」`)

  /* ③ 名字：问服务端「库里这一列写的是什么」 */
  let serverName = ''
  try {
    const r = await fetch(`${API}/api/game/detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: GAME_ID }),
    }).then((x) => x.json())
    serverName = r?.data?.name ?? ''
  } catch (e) {
    console.warn(`⚠ 读不到库里的名字（${e.message}），跳过这一条`)
    return
  }
  if (!serverName) {
    console.log('· 库里还没有这款（首次发布？）⇒ 名字这条无从比对')
    return
  }
  if (serverName === manifest.name) return

  console.error(`✗ 名字对不上：库里叫「${serverName}」，包里叫「${manifest.name}」`)
  console.error('  商城列表读库里那一列，装完显示包里这一份 ⇒ 家长会看到「买的和装上的不是一个」。')
  console.error(`  先去后台把 game.name 改成「${manifest.name}」再发；确实要按现状发就加 --allow-name-mismatch。`)
  if (!ALLOW_NAME_MISMATCH) process.exit(1)
  console.warn('  ⚠ 你加了 --allow-name-mismatch，按现状继续发布')
}

await checkBundleAgainstTarget()

const form = new FormData()
form.set('game_id', GAME_ID)
form.set('version', VERSION)
form.set('channel', CHANNEL)
form.set('release_notes', NOTES)
form.set('forced', FORCED === '1' || FORCED === 'true' ? '1' : '0')
form.set('file', new Blob([readFileSync(FILE)], { type: 'application/octet-stream' }), basename(FILE))

console.log(`→ ${API}/api/admin/game/release/upload`)
console.log(`  ${GAME_ID}@${VERSION} (${CHANNEL}) ${basename(FILE)} ${(size / 1024).toFixed(0)} KB`)

const res = await fetch(`${API}/api/admin/game/release/upload`, {
  method: 'POST',
  headers: { 'X-Api-Token': mintAdminToken(KEY) },
  body: form,
})

const text = await res.text()
let json
try {
  json = JSON.parse(text)
} catch {
  console.error(`✗ 返回的不是 JSON（HTTP ${res.status}）：\n${text.slice(0, 400)}`)
  process.exit(1)
}

if (json.code !== 200 && json.code !== 0) {
  console.error(`✗ 发布失败 code=${json.code} msg=${json.msg}`)
  process.exit(1)
}

const rel = json.data ?? {}
console.log('✓ 已发布')
console.log(`  url      ${rel.url}`)
console.log(`  sha256   ${rel.sha256}`)
console.log(`  size     ${rel.size}`)
console.log(`  active   ${rel.active}`)

/* 顺手把目录打出来：发布成功但目录没变，等于客户端拿不到这一版 */
try {
  const cat = await fetch(`${API}/api/game/catalog`).then((r) => r.text())
  const parsed = JSON.parse(cat)
  console.log(`\n目录（${parsed.games.length} 条）：`)
  for (const g of parsed.games) {
    console.log(`  · ${g.id}@${g.version}  ${g.url}`)
  }
} catch (e) {
  console.warn(`⚠ 目录没拉到：${e.message}`)
}
