/**
 * **游戏登记一致性**的一站式检查 —— 加/改一款游戏之后跑这一个就够。
 *
 * ```bash
 * node scripts/check-game-registry.mjs
 * node scripts/check-game-registry.mjs --self-test   # 先证明这些检查会红
 * ```
 *
 * ## 为什么要有它
 *
 * 一款游戏在宿主里要登记**四处**，而这四处漏任何一处都是**静默**的：
 *
 * | 漏了什么 | 症状 |
 * | --- | --- |
 * | `public/games/index.json` | 市场里少一款，界面不报错 |
 * | `src/games/localGames.ts`（哈希） | 点安装报「包内容校验不过」 |
 * | `src/games/storefront.ts` | `storefront.test.ts` 会红（这条已经有人管） |
 * | `scripts/build-store-shots.py` 的 `PLAN` | **详情页的图永远是旧的**，而且没有任何报错 |
 *
 * 最后一条是**真实存在的漏洞**：PLAN 是手写的表，脚本只转表里列出来的，
 * 加一款游戏忘了加一行 ⇒ 详情页那几张图还是上一款的。单测管不到它
 * （单测读的是 `public/store/` 里已存在的文件，而旧文件恰好存在）。
 *
 * 这里把「四处 + 包本身」一次性对齐，并且用 `--self-test` 证明**每一类都能红**。
 *
 * ## 它不检查什么
 *
 * - 包能不能跑（那是 `e2e-plugin-local.mjs`）
 * - 经济闸门（那是 `check-plugin.mjs`，同一份实现在 `domain/pluginEconomy.ts`）
 * - 文案写得好不好（那是人）
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const P = (...p) => path.join(ROOT, ...p)
const read = (rel) => fs.readFileSync(P(rel), 'utf8')

// ---------- 解析四个来源 ----------

function parseLocalGames() {
  const src = read('src/games/localGames.ts')
  const m = src.match(/export const LOCAL_GAMES[^=]*=\s*(\[[\s\S]*?\n\])/)
  if (!m) throw new Error('localGames.ts 里找不到 LOCAL_GAMES 数组')
  return JSON.parse(m[1])
}

/** STOREFRONT 是 TS 对象字面量，不是 JSON —— 按「条目」切块后逐字段读 */
function parseStorefront() {
  const src = read('src/games/storefront.ts')
  const start = src.indexOf('export const STOREFRONT')
  const body = src.slice(start, src.indexOf('\n]', start))
  const chunks = body.split(/\n  \{\n/).slice(1)
  const entries = []
  for (const c of chunks) {
    const id = c.match(/^\s*id:\s*'([^']+)'/m)?.[1]
    if (!id) continue
    entries.push({
      id,
      kind: c.match(/^\s*kind:\s*'([^']+)'/m)?.[1] ?? null,
      pitch: c.match(/^\s*pitch:\s*'([^']*)'/m)?.[1] ?? '',
      learnCount: (c.match(/^\s*'[^']{2,}',?$/gm) ?? []).length,
      shots: [...c.matchAll(/src:\s*'([^']+)'/g)].map((m) => m[1]),
      hasAbout: /^\s*about:\s*\[/m.test(c),
    })
  }
  return entries
}

/** build-store-shots.py 的 PLAN：("id", "项目目录", [ ... ]) */
function parsePyPlan() {
  const src = read('scripts/build-store-shots.py')
  const plan = {}
  for (const m of src.matchAll(/^\s*\("([a-z0-9]+)",\s*"([^"]+)",\s*\[/gm)) plan[m[1]] = m[2]
  return plan
}

// ---------- 检查 ----------

async function loadData() {
  const index = JSON.parse(read('public/games/index.json')).games
  return {
    index,
    local: parseLocalGames(),
    store: parseStorefront(),
    plan: parsePyPlan(),
    // 包里的 manifest 版本要动态 import 才知道（唯一能抓「升了清单没升包」的办法）
    manifestVersion: {},
  }
}

async function fillManifestVersions(data) {
  for (const g of data.index) {
    const abs = P('public', 'games', g.file)  // index.json 里的 file 相对 public/games/
    if (!fs.existsSync(abs)) continue
    try {
      const mod = await import(pathToFileURL(abs).href)
      const bundle = mod.default ?? mod
      data.manifestVersion[g.id] = bundle?.manifest?.version ?? null
    } catch (e) {
      data.manifestVersion[g.id] = `IMPORT_FAILED: ${String(e.message).slice(0, 80)}`
    }
  }
}

function run(data) {
  const bad = []
  const ids = data.index.map((g) => g.id)
  const localById = new Map(data.local.map((g) => [g.id, g]))
  const storeById = new Map(data.store.map((e) => [e.id, e]))

  // ① 清单 ↔ 生成文件
  for (const g of data.index) {
    const l = localById.get(g.id)
    if (!l) {
      bad.push(`[清单] ${g.id} 在 index.json 里，但 localGames.ts 没有它 —— 跑 make-local-catalog.mjs`)
      continue
    }
    if (l.version !== g.version) {
      bad.push(`[版本] ${g.id}：index.json ${g.version} ≠ localGames.ts ${l.version} —— 清单过期了`)
    }
    // ② 包本体：存在 + 字节数 + sha256 + manifest 版本
    const abs = P('public', 'games', g.file)  // index.json 里的 file 相对 public/games/
    if (!fs.existsSync(abs)) {
      bad.push(`[包] ${g.id}：public/${g.file} 不存在`)
    } else {
      const buf = fs.readFileSync(abs)
      const sha = crypto.createHash('sha256').update(buf).digest('hex')
      if (buf.length !== l.bytes) bad.push(`[包] ${g.id}：字节 ${buf.length} ≠ 清单 ${l.bytes} —— 换了包没重算哈希`)
      if (sha !== l.sha256) bad.push(`[包] ${g.id}：sha256 对不上 —— 跑 make-local-catalog.mjs`)
      const mv = data.manifestVersion[g.id]
      if (mv && mv !== g.version) bad.push(`[版本] ${g.id}：包里的 manifest.version 是 ${mv}，清单写 ${g.version}`)
    }
    // ③ 商城内容
    const s = storeById.get(g.id)
    if (!s) {
      bad.push(`[商城] ${g.id} 没有 storefront 条目 —— 市场里会静默少一款`)
    } else {
      if (!s.kind) bad.push(`[商城] ${g.id} 缺 kind（think / play）`)
      if (!s.pitch) bad.push(`[商城] ${g.id} 缺 pitch`)
      if (s.learnCount < 3) bad.push(`[商城] ${g.id} 的「练什么」少于 3 条（读到 ${s.learnCount} 条）`)
      if (!s.hasAbout) bad.push(`[商城] ${g.id} 缺 about`)
      if (s.shots.length < 3) bad.push(`[商城] ${g.id} 截图只有 ${s.shots.length} 张（要求 ≥3）`)
      for (const src of s.shots) {
        const f = P('public', src.replace(/^\//, ''))
        if (!fs.existsSync(f)) bad.push(`[截图] ${g.id}：${src} 不存在 —— 跑 build-store-shots.py`)
      }
    }
    // ④ 截图流水线的 PLAN
    if (!data.plan[g.id]) {
      bad.push(`[截图源] ${g.id} 不在 build-store-shots.py 的 PLAN 里 —— 详情页的图永远是旧的`)
    }
  }

  // 反向：多余的东西（永远渲染不出来 / 永远转不到）
  for (const e of data.store) {
    if (!ids.includes(e.id)) bad.push(`[商城] storefront 里的 ${e.id} 不在 index.json —— 永远渲染不出来`)
  }
  for (const [id, proj] of Object.entries(data.plan)) {
    if (!ids.includes(id)) bad.push(`[截图源] PLAN 里的 ${id} 不在 index.json —— 白转`)
    if (!fs.existsSync(path.join(ROOT, '..', 'task-games', proj))) {
      bad.push(`[截图源] PLAN 里 ${id} 的项目目录 task-games/${proj} 不存在`)
    }
  }
  for (const l of data.local) {
    if (!ids.includes(l.id)) bad.push(`[清单] localGames.ts 里的 ${l.id} 不在 index.json —— 白算哈希`)
  }
  return bad
}

// ---------- 自检：证明每一类都会红 ----------

const MUTATIONS = [
  ['清单少一条', (d) => { d.local = d.local.filter((x) => x.id !== d.index[0].id) }, '在 index.json 里，但 localGames.ts 没有它'],
  ['版本没升', (d) => { d.index[0].version = '99.0.0' }, '清单过期了'],
  ['包不存在', (d) => { d.index[0].file = 'nope/nope.plugin.mjs' }, '不存在'],
  ['商城缺条目', (d) => { d.store = d.store.filter((x) => x.id !== d.index[0].id) }, '没有 storefront 条目'],
  ['截图张数不够', (d) => { d.store.find((x) => x.id === d.index[0].id).shots = ['/store/x/1.webp'] }, '截图只有'],
  ['截图文件不在', (d) => { d.store.find((x) => x.id === d.index[0].id).shots.push('/store/nope/9.webp') }, '不存在'],
  ['PLAN 漏一行', (d) => { delete d.plan[d.index[0].id] }, '不在 build-store-shots.py 的 PLAN 里'],
  ['PLAN 多了个不存在的项目', (d) => { d.plan.fake = 'no-such-dir' }, 'task-games/no-such-dir 不存在'],
]

async function selfTest() {
  const base = await loadData()
  await fillManifestVersions(base)
  const clean = run(base)
  let failed = 0
  console.log('\n① 干净的数据必须全绿')
  if (clean.length) {
    console.log('  ✗ 干净数据就有问题（先修这些，否则自检没有意义）：')
    for (const p of clean) console.log('    ' + p)
    failed++
  } else console.log('  ✓ 0 条')

  console.log('\n② 每一类变异都必须红（而且红在对的那条检查上）')
  for (const [name, mutate, expect] of MUTATIONS) {
    const d = structuredClone(base)
    d.manifestVersion = { ...base.manifestVersion }
    mutate(d)
    const got = run(d)
    const hit = got.some((p) => p.includes(expect))
    console.log(`  ${hit ? '✓' : '✗'} ${name}${hit ? '' : ` —— 期望含「${expect}」，实际 ${JSON.stringify(got.slice(0, 2))}`}`)
    if (!hit) failed++
  }
  console.log(failed ? `\n自检失败 ${failed} 项` : '\n自检通过：检查不是恒真')
  return failed ? 1 : 0
}

// ---------- 主流程 ----------

const data = await loadData()
await fillManifestVersions(data)

if (process.argv.includes('--self-test')) process.exit(await selfTest())

const bad = run(data)
const summary = [
  `本地包 ${data.index.length} 款`,
  `哈希清单 ${data.local.length} 条`,
  `商城条目 ${data.store.length} 条`,
  `截图 PLAN ${Object.keys(data.plan).length} 行`,
].join(' · ')
console.log(`\n${summary}\n`)
if (bad.length) {
  console.log(`✗ ${bad.length} 条不一致：\n`)
  for (const b of bad) console.log('  ' + b)
  console.log('')
  process.exit(1)
}
console.log('✓ 四处登记一致（清单 / 哈希 / 商城 / 截图源）\n')
