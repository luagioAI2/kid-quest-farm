/**
 * 天空（昼夜 + 日月）走查图 + 结构自检。
 *
 * 用法：node scripts/capture-sky.mjs [url] [outDir]
 *
 * 为什么单独一份：`capture.mjs` / `e2e-check.mjs` / `e2e-gameplay.mjs` /
 * `capture-animals.mjs` **都不管天空** —— 天空是这四个脚本共同的盲区
 * （和 `capture-tablet-onboarding.mjs` / `capture-games.mjs` 同一类问题）。
 *
 * ------------------------------------------------------------
 * ★ 这一版的核心难点：**天空是按时间变的，所以截图天生不确定。**
 *   直接把「当前时刻」画下来，跑一次是白天、跑一次是夜里，
 *   断言只能写成「有天空」这种废话。
 *
 *   所以这里用 `evaluateOnNewDocument` 把 `Date.now()` **钉死**在
 *   指定的本地小时上 —— 农场小时就是那个小时（timeScale 强制为 1）。
 *   四个小时各跑一遍，四档色调就都被覆盖到了。
 *
 * ★ 另一个难点：**别把分档边界抄进脚本。**
 *   边界（5 / 8 / 17 / 20）从 `src/domain/farmClock.ts` **读**出来
 *   （`scripts/lib/quality.mjs` 解析 `settlement.ts` 是同一个套路）。
 *   抄一份的话，改了分档脚本还是绿的 —— 守卫会**悄悄变弱**，
 *   而不是变红。这正是本项目踩过两次的坑。
 *
 * ★ 断言里必须有一条**对照组**：四个时刻必须真的产出四档**不同**的色调。
 *   否则「天空跟着小时走」这句话根本没被验证 —— 如果色调恒为 'day'，
 *   白天那一条照样绿。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? '.e2e-scratch/sky'

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
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

/* ------------------------------------------------------------
   从 `farmClock.ts` 读分档边界（**不抄**）
   ------------------------------------------------------------ */
const SRC = readFileSync(new URL('../src/domain/farmClock.ts', import.meta.url), 'utf8')
const fnBody = SRC.slice(
  SRC.indexOf('export function skyToneFor'),
  SRC.indexOf('export interface Celestial'),
)
const lt = [...fnBody.matchAll(/hour\s*<\s*(\d+)/g)].map((m) => Number(m[1]))
const ge = [...fnBody.matchAll(/hour\s*>=\s*(\d+)/g)].map((m) => Number(m[1]))

/* 结构守卫：解析不出来就**直接退出**，绝不退化成「随便测点什么」。
   哪天有人把 skyToneFor 改写成查表 / switch，这里会红，
   提醒来改脚本 —— 而不是静默地把边界当成 0。 */
if (lt.length !== 3 || ge.length !== 1) {
  console.error(
    `无法从 farmClock.ts 解析 skyToneFor 的分档边界（hour< ${lt.length} 个 / hour>= ${ge.length} 个）。` +
      `\n改过这个函数的话，请同步更新本脚本的解析方式。`,
  )
  process.exit(2)
}
const [nightEnd, dawnEnd, dayEnd] = lt
const [nightStart] = ge
console.log(
  `分档（读自 farmClock.ts）：夜 <${nightEnd} 或 >=${nightStart} · 晨 <${dawnEnd} · 昼 <${dayEnd} · 昏 其余`,
)

/** 与 `skyToneFor` 等价 —— 边界来自上面解析出来的数 */
function toneFor(hour) {
  if (hour < nightEnd || hour >= nightStart) return 'night'
  if (hour < dawnEnd) return 'dawn'
  if (hour < dayEnd) return 'day'
  return 'dusk'
}

/** 四个探针时刻：晨 / 昼 / 昏 / 夜各一个（取各档中间，别贴边界） */
const PROBES = [6, 12, 18, 23]
const EXPECTED_TONES = PROBES.map(toneFor)

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
]

const seenTones = []

for (const vp of VIEWPORTS) {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`capture-sky-${vp.name}`),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const hour of PROBES) {
    const want = toneFor(hour)
    console.log(`\n── ${vp.name} ${vp.width}×${vp.height} · 农场 ${String(hour).padStart(2, '0')}:00 → ${want} ──`)
    const page = await browser.newPage()
    const consoleErrors = []
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text())
    })
    page.on('pageerror', (e) => consoleErrors.push(String(e)))

    /* ★ 把「现在」钉死。只改 `Date.now`：
       `farmClockAt` 内部是 `new Date(now)`（带参数），所以不用动构造函数；
       改 window.Date 反而会波及 Dexie 等第三方代码。 */
    await page.evaluateOnNewDocument((h) => {
      const fixed = new Date(2026, 9, 15, h, 0, 0, 0).getTime()
      Date.now = () => fixed
    }, hour)

    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 })
    await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
    await dismissOnboarding(page)
    await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })

    /* 流速锁成 1 —— 农场小时才等于被钉死的现实小时。
       （默认就是 1，但种子数据改过就会漂，所以显式写死。） */
    await page.evaluate(async () => {
      await window.__kqf__.getState().updateSettings({
        farmClock: { timeScale: 1, showClock: true },
      })
    })

    /* 进农场页：默认就在农场，但别假设 —— 找不到天空就点一下底栏 */
    if (!(await page.$('.kqf-sky'))) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('nav button')].find((x) =>
          (x.textContent ?? '').includes('农场'),
        )
        b?.click()
      })
    }
    await page.waitForFunction(() => !!document.querySelector('.kqf-sky'), { timeout: 10000 })
    await wait(400)

    const got = await page.evaluate(() => {
      const sky = document.querySelector('.kqf-sky')
      const body = document.querySelector('[data-sky-body]')
      const skyRect = sky.getBoundingClientRect()
      const bodyRect = body?.getBoundingClientRect()
      const toneClasses = [...sky.classList].filter((c) => c.startsWith('kqf-sky--'))
      /* 顶栏那行「农场第 N 天 · hh:mm」—— 时钟和天空必须是**同一个小时** */
      const m = (document.body.innerText ?? '').match(
        /农场第\s*(\d+)\s*天\s*[·・.]\s*(\d{1,2}):(\d{2})/,
      )
      return {
        tone: toneClasses[0]?.replace('kqf-sky--', '') ?? null,
        toneClassCount: toneClasses.length,
        kind: body?.getAttribute('data-sky-body') ?? null,
        stars: document.querySelectorAll('.kqf-star').length,
        cloudOpacity: getComputedStyle(document.querySelector('.kqf-cloud')).opacity,
        clockDay: m ? Number(m[1]) : null,
        clockHour: m ? Number(m[2]) : null,
        clockText: m ? m[0] : null,
        sky: { w: skyRect.width, h: skyRect.height },
        /* 日月中心相对天空框的位置（0..1）；null = 没量到 */
        center: bodyRect
          ? {
              x: (bodyRect.left + bodyRect.width / 2 - skyRect.left) / skyRect.width,
              y: (bodyRect.top + bodyRect.height / 2 - skyRect.top) / skyRect.height,
            }
          : null,
      }
    })

    seenTones.push(got.tone)

    check(
      `天空色调 = ${want}`,
      got.tone === want,
      `实际 ${got.tone}（class 里 ${got.toneClassCount} 个色调类）`,
    )
    check('天空只挂了一个色调类（没有两档同时生效）', got.toneClassCount === 1)
    check(
      '★ 日 / 月和色调是同一个判据（不会「天黑着、太阳还挂着」）',
      got.kind === (want === 'night' ? 'moon' : 'sun'),
      `色调 ${got.tone} → 画的是 ${got.kind}`,
    )
    check(
      '星星只在夜里渲染',
      want === 'night' ? got.stars === 10 : got.stars === 0,
      `夜里应为 10，实际 ${got.stars}`,
    )
    check(
      '★ 顶栏时钟的小时 == 天空用的小时（同一个事实，不是两份）',
      got.clockHour === hour,
      `顶栏「${got.clockText ?? '（没读到）'}」→ ${got.clockHour} 点`,
    )
    check(
      '日月落在天空框内（没飞到草地上、也没出左右边界）',
      !!got.center && got.center.x >= 0 && got.center.x <= 1 && got.center.y >= 0 && got.center.y <= 1,
      got.center ? `x=${got.center.x.toFixed(2)} y=${got.center.y.toFixed(2)}` : '没量到',
    )
    /* 天空那条带子是 11rem；草地从 top-32(128px) 开始 —— 日月的中心必须在带上 */
    check(
      '日月没有压到草地那条线（中心仍在天空带内）',
      !!got.center && got.center.y * got.sky.h < 128,
      got.center ? `中心距顶 ${(got.center.y * got.sky.h).toFixed(0)}px / 带高 ${got.sky.h.toFixed(0)}px` : '没量到',
    )
    if (want === 'night') {
      check('夜里的云被压暗了（白亮的云压深紫天上太假）', Number(got.cloudOpacity) < 0.5, `opacity=${got.cloudOpacity}`)
    }

    check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

    await page.screenshot({
      path: `${OUT}/${vp.name}-${String(hour).padStart(2, '0')}-${want}.png`,
    })
    await page.close()
  }

  await browser.close()
}

/* ------------------------------------------------------------
   ★ 对照组：四个时刻必须真的产出四档**不同**的色调
   ------------------------------------------------------------ */
console.log(`\n── 对照组 ──`)
const distinct = new Set(seenTones.filter(Boolean))
check(
  '★ 四个探针时刻覆盖了四档不同色调（否则「天空跟着小时走」根本没被验证）',
  distinct.size === 4,
  `实测到 ${[...distinct].join(' / ')}（期望 dawn / day / dusk / night）`,
)
check(
  '★ 覆盖的正好是那四档',
  ['dawn', 'day', 'dusk', 'night'].every((t) => distinct.has(t)),
  `期望集合与实际不符时这里会红`,
)
check('分档表与探针一致（探针自身没选错）', new Set(EXPECTED_TONES).size === 4)

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
