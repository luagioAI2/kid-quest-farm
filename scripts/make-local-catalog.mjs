/**
 * 生成 `src/games/localGames.ts` —— **本地包清单**（随 App 发布、不联网可装）。
 *
 * ## 为什么要有这个脚本
 *
 * 「本地包」也要校验，而校验依据（SHA-256）**必须烧进代码**。
 * 手抄哈希一定会有一天抄错或者忘了更新，而症状是「装不上」，
 * 排查的人第一反应是去查网络 —— 方向从第一秒就是错的。
 *
 * 所以：**清单是输入，哈希是算出来的**。
 *
 * ```
 *   public/games/index.json  ──┐
 *   public/games/<id>/<包>     ├─► 本脚本 ─► src/games/localGames.ts（含 sha256）
 *   public/games/<id>/assets/  ┘
 * ```
 *
 * ## 输入格式（`public/games/index.json`）
 *
 * ```json
 * { "games": [
 *     { "id": "prizepark", "name": "抓奖乐园", "version": "1.6.2",
 *       "file": "prizepark/prizepark.plugin.mjs", "assetBase": "prizepark/" }
 * ] }
 * ```
 *
 * `file` / `assetBase` 都是**相对 `public/games/` 的路径**。产物里会变成
 * 站点绝对路径（`/games/…`）—— 这样 dev / preview / Capacitor 三种形态
 * 都一样，不需要插件自己判断 base。
 *
 * 用法：
 *   node scripts/make-local-catalog.mjs           # 生成
 *   node scripts/make-local-catalog.mjs --check   # 只校验「已生成的文件是否过期」
 *
 * `--check` 是给 CI / 走查用的：改了包却忘了重新生成，会红。
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)
const PUB = path.join(ROOT, 'public', 'games')
const INDEX = path.join(PUB, 'index.json')
const OUT = path.join(ROOT, 'src', 'games', 'localGames.ts')

const checkOnly = process.argv.includes('--check')

if (!fs.existsSync(INDEX)) {
  console.error('缺少', path.relative(ROOT, INDEX), '—— 本地包清单是输入，先写它')
  process.exit(2)
}

const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
if (!Array.isArray(index.games)) {
  console.error('index.json 的 `games` 必须是数组')
  process.exit(2)
}

/** 站点根相对路径（正斜杠）。Windows 上 path.join 会给反斜杠，浏览器不认。 */
const sitePath = (rel) => '/games/' + rel.split(path.sep).join('/').replace(/^\/+/, '')

const rows = []
for (const g of index.games) {
  const where = `index.json 的「${g?.id ?? '?'}」`
  for (const k of ['id', 'name', 'version', 'file']) {
    if (typeof g?.[k] !== 'string' || !g[k].trim()) {
      console.error(`${where} 缺字段 ${k}`)
      process.exit(2)
    }
  }
  const abs = path.join(PUB, g.file)
  if (!fs.existsSync(abs)) {
    console.error(`${where} 指向的文件不存在：${path.relative(ROOT, abs)}`)
    process.exit(2)
  }
  const buf = fs.readFileSync(abs)
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex')

  /*
   * 资源目录必须存在。空目录也算 —— 但**不能没有**：
   * 没有的话说明发布时漏拷了 assets，插件会在运行时 404，
   * 而报错是「could not load texture」，看着像打包坏了。
   */
  const assetRel = g.assetBase ?? path.dirname(g.file) + '/'
  const assetAbs = path.join(PUB, assetRel)
  if (!fs.existsSync(assetAbs)) {
    console.error(`${where} 的 assetBase 目录不存在：${path.relative(ROOT, assetAbs)}`)
    process.exit(2)
  }

  rows.push({
    id: g.id,
    name: g.name,
    version: g.version,
    url: sitePath(g.file),
    sha256,
    bytes: buf.byteLength,
    assetBase: sitePath(assetRel.endsWith('/') ? assetRel : assetRel + '/'),
  })
}

const body = `/**
 * 本地包清单 —— **自动生成，别手改**（\`node scripts/make-local-catalog.mjs\`）。
 *
 * ## 为什么哈希在这里，而不在 \`public/games/index.json\` 里
 *
 * 因为 \`public/\` 是**发布物**，它和代码一起被替换。把「该信哪个哈希」
 * 也放在发布物里，等于让包自己证明自己 —— 那不是校验，是自证。
 * 只有编译进 JS 的那份哈希才拦得住「有人换掉 public 里的文件」。
 *
 * 输入是 \`public/games/index.json\`（只有 id / 名字 / 版本 / 路径），
 * 哈希由脚本现算。所以「清单说是什么」和「跑的是什么」不可能走散。
 *
 * ## 和远程目录的关系
 *
 * | | 信任根 | 什么时候验 |
 * | --- | --- | --- |
 * | 本地（本文件） | 烧进代码的 SHA-256 | 安装时 |
 * | 远程（\`catalog.json\`） | Ed25519 签名 → 目录里的 SHA-256 | 安装时 |
 *
 * 两条路的**最后一步完全一样**：\`verifySha256\` → 才 \`importBundle\`。
 */

export interface LocalGameEntry {
  id: string
  name: string
  version: string
  /** 站点绝对路径（\`/games/<id>/<包>\`），dev / preview / Capacitor 都一样 */
  url: string
  sha256: string
  bytes: number
  /** 资源根，以 \`/\` 结尾 */
  assetBase: string
}

export const LOCAL_GAMES: LocalGameEntry[] = ${JSON.stringify(rows, null, 2)}

/**
 * 按 id 查本地包。
 *
 * ★ 用 \`Map\` 而不是对象下标：\`OBJ[key] ?? 兜底\` 挡不住 \`constructor\` /
 *   \`toString\` / \`__proto__\`（它们从 \`Object.prototype\` 取得到值，\`??\` 不触发），
 *   后面 \`entry.sha256\` 就是 \`undefined\` —— 校验被静默跳过。
 */
const BY_ID = new Map(LOCAL_GAMES.map((g) => [g.id, g]))

export function localGameById(id: string): LocalGameEntry | undefined {
  return BY_ID.get(id)
}
`

if (checkOnly) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (cur !== body) {
    console.error('src/games/localGames.ts 已过期 —— 跑 `node scripts/make-local-catalog.mjs` 重新生成')
    process.exit(1)
  }
  console.log('本地包清单是最新的（' + rows.length + ' 款）')
  process.exit(0)
}

fs.writeFileSync(OUT, body)
console.log('已生成', path.relative(ROOT, OUT), '·', rows.length, '款')
for (const r of rows) console.log('  ', r.id, 'v' + r.version, r.sha256.slice(0, 12) + '…', (r.bytes / 1024).toFixed(0) + ' KB')
