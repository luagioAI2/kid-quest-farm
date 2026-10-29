#!/usr/bin/env node
/**
 * 生成游戏兑换码（spec §6 的 P2）。
 *
 * ```
 *   node scripts/mint-codes.mjs --per-game 20
 * ```
 *
 * 产出两样东西，**分开存**：
 *
 *   ① `src/games/codeTable.ts` —— **只有 sha256**，入库、打进 App 包。
 *      这是「哪些码有效」的唯一真相，但它反推不出任何一个码。
 *   ② `scripts/_codes-<时间>.txt` —— **明文码**，只在本地。
 *      这是拿去印卡片的那份。`scripts/_*` 在 `.gitignore` 里，不会进仓库。
 *
 * ## ⚠️ 明文那份丢了就没了
 *
 * 码表里只有哈希，没有反查。**重跑一次会换掉整张表**（旧卡立刻全部失效），
 * 所以脚本在覆盖前会把旧文件改名成 `codeTable.ts.bak-<时间>`。
 *
 * ## 为什么要 `--per-game`
 *
 * 一个码发给所有买家等于「一个通用密码」：任何一个人把它贴到群里，后面的人
 * 都不用付钱了。**一卡一码**是这个功能存在的意义，不是可选项。
 *
 * ## 参数
 *
 * | 参数 | 默认 | 说明 |
 * | --- | --- | --- |
 * | `--per-game N` | 1 | 每款游戏发几个码 |
 * | `--only id,id` | 全部 | 只给这几款发（补发时用） |
 * | `--keep` | 关 | **追加**到现有码表，不换掉旧卡 |
 * | `--dry` | 关 | 只打印，不写文件 |
 */

import { createHash, randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const TABLE = join(ROOT, 'src/games/codeTable.ts')
const CATALOG = join(ROOT, 'public/games/index.json')

/**
 * ⚠️ **必须**和 `src/domain/gameCode.ts` 的 `GAME_CODE_ALPHABET` 逐字相同。
 * 脚本是 `.mjs`、跑在 Node 里，import 不了 `.ts`，所以只能抄一份 ——
 * 抄错了的症状是「生成的码全部兑换失败」，而 `codeTable.test.ts` 会先挡住。
 */
export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const CODE_LEN = 6

/** 生成一个码。256 % 32 === 0 ⇒ `% 32` 不引入偏差 */
export function mintOne() {
  const buf = randomBytes(CODE_LEN)
  let out = ''
  for (const b of buf) out += ALPHABET[b % ALPHABET.length]
  return out
}

/** 和 `normalizeGameCode` 同口径：大写、去分隔符。生成时本来就是这个形状，留着防手改 */
export function normalize(code) {
  return String(code ?? '').toUpperCase().replace(/[\s\-_·・]/g, '')
}

export function sha256Hex(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

/** 给一款游戏发 n 个码，返回 `{ code, hash }[]`。`taken` 用来避开与已有码重复 */
export function mintFor(gameId, n, taken = new Set()) {
  const out = []
  let guard = 0
  while (out.length < n) {
    if (++guard > n * 50) throw new Error(`「${gameId}」连生成 ${n} 个不重复的码都做不到，检查字母表`)
    const code = mintOne()
    const hash = sha256Hex(code)
    if (taken.has(hash)) continue
    taken.add(hash)
    out.push({ code, hash })
  }
  return out
}

/* ------------------------------------------------------------------ */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  if (i < 0) return fallback
  const v = process.argv[i + 1]
  return v && !v.startsWith('--') ? v : true
}

function loadGames() {
  const raw = JSON.parse(readFileSync(CATALOG, 'utf8'))
  const list = (raw.games ?? []).map((g) => ({ id: g.id, name: g.name ?? g.id }))
  if (list.length === 0) throw new Error('目录里一款游戏都没有，先跑 npm run catalog:make')
  return list
}

/** 从现有码表里把 `hash: 'gameId'` 读回来（`--keep` 时用） */
function loadExisting() {
  if (!existsSync(TABLE)) return new Map()
  const src = readFileSync(TABLE, 'utf8')
  const out = new Map()
  for (const m of src.matchAll(/^\s*'([0-9a-f]{64})':\s*'([^']+)',/gm)) out.set(m[1], m[2])
  return out
}

function render(table) {
  const rows = [...table.entries()].sort((a, b) => (a[1] + a[0] < b[1] + b[0] ? -1 : 1))
  const body = rows.map(([hash, id]) => `  '${hash}': '${id}',`).join('\n')
  return `/**
 * 游戏兑换码表 —— **由 \`scripts/mint-codes.mjs\` 生成，别手改**。
 *
 * 键是 **sha256(归一化后的码)**，值是游戏 id。所以这张表**反推不出任何一个码**：
 * 就算有人把 App 包拆开，也只拿到一堆哈希，猜不出能用的码。
 *
 * 明文码在 \`scripts/_codes-*.txt\`（gitignored，本地留档用来印卡片）。
 *
 * ## 重新生成
 *
 * \`\`\`
 *   node scripts/mint-codes.mjs --per-game 20
 * \`\`\`
 *
 * ⚠️ 不带 \`--keep\` 就是**换掉整张表** —— 已经印出去、还没卖掉的卡全部作废。
 * 补发某一款时用 \`--only <id> --keep\`。
 *
 * ## 现在的状态
 *
 * 每款一个码，只为了让这条链在真机上能走通（21 款游戏本来都免费，
 * 一个码的最坏后果就是「白装一款本来也能装的游戏」）。
 * 真要开卖之前必须 \`--per-game\` 重发一批 —— 一个码发给所有买家
 * 等于一个通用密码。
 */

/**
 * 生成这张表时用的字母表。
 *
 * ⚠️ **别删这个常量。** 脚本（\`.mjs\`）import 不了 \`src/domain/gameCode.ts\`，
 * 只能抄一份字母表；两份不一致的症状是「生成的码全部兑换失败」，
 * 而且不报错、只一直说「没有这个码」。\`codeTable.test.ts\` 拿这个常量
 * 和 App 那份逐字比 —— 删了它就没人挡这个了。
 */
export const GAME_CODE_ALPHABET_AT_MINT = '${ALPHABET}'

export const GAME_CODE_HASHES: Record<string, string> = {
${body}
}
`
}

function main() {
  const perGame = Number(arg('per-game', 1))
  const keep = arg('keep', false) === true
  const dry = arg('dry', false) === true
  const only = arg('only', null)

  if (!Number.isInteger(perGame) || perGame < 1) throw new Error('--per-game 要是正整数')

  const games = loadGames().filter((g) => !only || String(only).split(',').includes(g.id))
  if (games.length === 0) throw new Error('--only 一个都没匹配上')

  const table = keep ? loadExisting() : new Map()
  const taken = new Set(table.keys())

  const lines = []
  for (const g of games) {
    for (const { code, hash } of mintFor(g.id, perGame, taken)) {
      table.set(hash, g.id)
      lines.push(`${code.slice(0, 3)}-${code.slice(3)}\t${g.id}\t${g.name}`)
    }
  }

  console.log(`\n${keep ? '追加' : '重新生成'}：${games.length} 款 × ${perGame} 个 = ${lines.length} 个码`)
  console.log('--------------------------------------------------------------')
  for (const l of lines) console.log(l)
  console.log('--------------------------------------------------------------')

  if (dry) {
    console.log('\n--dry：没有写文件。')
    return
  }

  if (existsSync(TABLE) && !keep) {
    const bak = `${TABLE}.bak-${Date.now().toString(36)}`
    renameSync(TABLE, bak)
    console.log(`\n旧码表已备份：${bak.split(/[\\/]/).pop()}`)
  }
  writeFileSync(TABLE, render(table), 'utf8')

  const stamp = new Date().toISOString().slice(0, 10)
  const outFile = join(HERE, `_codes-${stamp}.txt`)
  const header = keep && existsSync(outFile) ? '' : `# 兑换码 ${stamp}（明文，别提交、别外传）\n# 码\t游戏 id\t游戏名\n`
  writeFileSync(outFile, header + lines.join('\n') + '\n', 'utf8')

  console.log(`\n码表：${TABLE.replace(ROOT, '.')}（${table.size} 条）`)
  console.log(`明文：${outFile.replace(ROOT, '.')}  ← 印卡片用这份，**丢了就没了**`)

  /*
   * 自检：把刚写下去的文件**读回来**，逐个确认这一批码都在表里。
   *
   * 为什么值得多这一步：写文件、算哈希、渲染模板三处都可能悄悄错
   * （比如转义把某个字符吃掉），而症状是「卡印出去了、兑不了」——
   * 那时才发现，成本是整批卡。
   */
  const written = readFileSync(TABLE, 'utf8')
  const missing = lines.filter((l) => {
    const code = l.split('\t')[0]
    return !written.includes(`'${sha256Hex(normalize(code))}'`)
  })
  if (missing.length > 0) {
    console.error(`\n✗ 自检失败：${missing.length} 个码写不进表里，例如「${missing[0].split('\t')[0]}」`)
    process.exit(1)
  }
  console.log(`自检：${lines.length} 个码全部能在表里查到 ✓`)
}

// 只在直接跑的时候执行 —— 被 `codeTable.test.ts` import 时不能有副作用
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main()
  } catch (e) {
    console.error(`\n失败：${e instanceof Error ? e.message : e}`)
    process.exit(1)
  }
}
