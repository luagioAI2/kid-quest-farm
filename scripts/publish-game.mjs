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
import { basename, extname } from 'node:path'

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
