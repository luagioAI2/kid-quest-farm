/**
 * 量尺：农场页面的「可见草地」到底有多少？
 *
 * 用法：node scripts/measure-farm-scene.mjs [url] [宽] [高]
 *   例：node scripts/measure-farm-scene.mjs http://127.0.0.1:4180/ 390 844
 *       node scripts/measure-farm-scene.mjs http://127.0.0.1:4180/ 834 1112
 *
 * 它回答的是**场景层（天空 / 山丘 / 草地）还有多少地方是露着的** ——
 * 也就是「往场景层里画装饰，画在哪才看得见」。
 * 2026-10-16 用它定下 ⑥ 建筑装饰的结论：**手机上是 0，平板上有地方**
 * （见 `docs/game-plugin-spec.md` §8.5 的 ⑥ 那一段）。
 *
 * ------------------------------------------------------------
 * ★★ 为什么不能只用 `elementFromPoint` —— 两个坑，都踩过：
 *
 * ① **`elementFromPoint` 会跳过 `pointer-events:none` 的元素。**
 *    而场景层正好就是 `pointer-events-none`（它不该接收点击），
 *    于是它**永远返回不了草地**，扫出来「全是 0%」。
 *    ➜ 量之前把场景层临时设成可命中（`style.pointerEvents = 'auto'`），
 *      只影响命中测试、不改版面，量完还原。
 *
 * ② **命中测试只答「最上面是哪个元素」，不等于「肉眼看得见什么」。**
 *    `.page-col` 盖在草地上，但它的**背景是透明的** —— 草地照样看得见。
 *    ➜ 要从 `elementsFromPoint` 的栈顶往下走，找**第一个有不透明背景
 *      （或背景图）**的元素，**那才是你真正看到的**。
 *
 * 这两条是同一个毛病的两面：**「画了什么」≠「看得见什么」**。
 * 本项目已经栽过四次（天空带子 0% 可见 / 浇水特效状态走不到 /
 * 升级特效的探针退化成恒真 / 这一次）。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4180/'
const VW = Number(process.argv[3] ?? 390)
const VH = Number(process.argv[4] ?? 844)
const OUT = '.e2e-scratch/measure-farm'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir('measure-farm'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: VW, height: VH, deviceScaleFactor: 1 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
await dismissOnboarding(page)
await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })
/* 切到农场那一格 —— App 默认停在「任务」，不切的话 `[data-sky-scene]` 根本不存在 */
await page.evaluate(() => document.querySelector('[data-tour="tab-farm"]')?.click())
await page.waitForFunction(() => !!document.querySelector('[data-sky-scene]'), { timeout: 15000 })
await new Promise((r) => setTimeout(r, 1200))

mkdirSync(OUT, { recursive: true })
await page.screenshot({ path: `${OUT}/${VW}x${VH}.png` })

const m = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return {
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      left: Math.round(r.left),
      right: Math.round(r.right),
      w: Math.round(r.width),
      h: Math.round(r.height),
    }
  }
  const scene = document.querySelector('[data-sky-scene]')
  const grass = scene?.querySelector('div.bg-grass-300')

  /* 坑 ①：让场景层能被命中测试看见（只影响量，不改版面） */
  const prevPE = scene.style.pointerEvents
  scene.style.pointerEvents = 'auto'

  /* 坑 ②：这一点上肉眼**真正看到**的是哪个元素？（第一个不透明背景的） */
  const seenAt = (x, y) => {
    for (const el of document.elementsFromPoint(x, y)) {
      const cs = getComputedStyle(el)
      const bg = cs.backgroundColor || ''
      const opaqueBg =
        bg && bg !== 'transparent' && !/rgba?\(\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*0\s*\)/.test(bg)
      const img = cs.backgroundImage && cs.backgroundImage !== 'none'
      if (opaqueBg || img) return el
    }
    return null
  }

  const STEP = 4
  const rows = []
  const gw = grass?.getBoundingClientRect()
  if (gw) {
    for (let y = Math.round(gw.top); y < Math.round(gw.bottom); y += STEP) {
      let free = 0
      let total = 0
      let run = 0
      let bestRun = 0
      let curStart = -1
      for (let x = 0; x < innerWidth; x += 4) {
        total++
        const el = seenAt(x + 2, y + 2)
        if (el && (el === grass || grass.contains(el))) {
          free++
          if (run === 0) curStart = x
          run += 4
          if (run > bestRun) bestRun = run
        } else {
          run = 0
        }
      }
      rows.push({ y, freePct: total ? Math.round((free / total) * 100) : -1, maxRun: bestRun })
    }
  }

  scene.style.pointerEvents = prevPE

  /* 把连续的「露着的行」并成**带** —— 装饰只能画在带里，逐行看没意义 */
  const bands = []
  for (const r of rows) {
    if (r.freePct < 70) continue
    const last = bands[bands.length - 1]
    if (last && r.y - last.bottom <= STEP * 2) {
      last.bottom = r.y
      last.minRun = Math.min(last.minRun, r.maxRun)
    } else {
      bands.push({ top: r.y, bottom: r.y, minRun: r.maxRun })
    }
  }
  for (const b of bands) b.h = b.bottom - b.top + STEP

  /* ⚠️ 页面里有两个 `.page-col`（外壳一个、农场页一个），要取**农场页**那个 */
  const col = scene.parentElement?.querySelector(':scope > .page-col') ?? null
  return {
    vw: innerWidth,
    vh: innerHeight,
    docScrollH: document.documentElement.scrollHeight,
    scene: box(scene),
    grass: box(grass),
    bands,
    /* `.page-col` 的每个直接子元素 —— 看**谁**盖在草地上、盖了多少 */
    colChildren: [...(col?.children ?? [])].map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: (el.className || '').toString().slice(0, 60),
      ...box(el),
    })),
    avgFreePct: rows.length
      ? Math.round(rows.reduce((s, r) => s + r.freePct, 0) / rows.length)
      : -1,
    rows,
  }
})

const pad = (n, w = 4) => String(n).padStart(w)
console.log(`\n══ 可见草地量尺 · ${m.vw}×${m.vh} ══`)
console.log(`  scene ${m.scene?.top}–${m.scene?.bottom}   grass ${m.grass?.top}–${m.grass?.bottom} (高 ${m.grass?.h})`)
console.log(`  草地平均可见 ${m.avgFreePct}%`)
console.log(`\n  ── 连续「露着」的带（≥70% 可见）—— 装饰只能画在这里 ──`)
if (!m.bands.length) console.log('    （一条都没有：场景层在手机上被内容盖满了）')
for (const b of m.bands) {
  console.log(`    y ${pad(b.top)}–${pad(b.bottom)}  高 ${pad(b.h, 4)}px  最窄处 ${pad(b.minRun, 4)}px`)
}
console.log(`\n  ── .page-col 的直接子元素（谁盖住了草地）──`)
for (const c of m.colChildren) {
  console.log(`    y ${pad(c.top)}–${pad(c.bottom)}  x ${pad(c.left)}–${pad(c.right)}  ${c.tag} .${(c.cls || '').slice(0, 40)}`)
}
console.log(`\n  ── 逐行可见度（# ≥70% / + 20~70% / . <20%）──`)
let line = ''
for (const r of m.rows) line += r.freePct >= 70 ? '#' : r.freePct >= 20 ? '+' : '.'
for (let i = 0; i < line.length; i += 50) {
  console.log(`    ${pad(m.rows[i].y)} ${line.slice(i, i + 50)}`)
}
console.log(`\n  截图 ${OUT}/${m.vw}x${m.vh}.png`)
console.log(`  （要原始数据就加 --json）\n`)

if (process.argv.includes('--json')) console.log(JSON.stringify(m, null, 2))

await browser.close()
