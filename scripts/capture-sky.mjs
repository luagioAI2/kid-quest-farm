/**
 * 天空（昼夜）走查图 + 结构自检。
 *
 * 用法：node scripts/capture-sky.mjs [url] [outDir]
 *
 * 为什么单独一份：`capture.mjs` / `e2e-check.mjs` / `e2e-gameplay.mjs` /
 * `capture-animals.mjs` **都不管天空** —— 天空是这些脚本共同的盲区
 * （和 `capture-tablet-onboarding.mjs` / `capture-games.mjs` 同一类问题）。
 *
 * ------------------------------------------------------------
 * ★★ 这一版是**重写**，起因是上一版「全绿但没用」：
 *
 * 上一版断言的是「日月的中心在天空框内」—— 那只证明它**画在**那里。
 * 实际上天空那条带子被顶栏卡片盖住了 100%，日月**一个像素都看不见**，
 * 断言照样全绿。（量出来的数：手机天空可见 0% / 日月可见 0%。）
 *
 * ➜ 现在最值钱的一条断言是 **「日月真的在最上面那一层」**：
 *   按网格采样它的包围盒，用 `elementFromPoint` 数「最上层是不是它」。
 *   这条断言对「被别的元素盖住」这种失败**结构性敏感**，不靠人眼。
 *
 * ★ 两个难点，各自的解法：
 *
 * 1. **天空是按时间变的，截图天生不确定。**
 *    跑一次是白天、跑一次是夜里，断言只能写成「有天空」这种废话。
 *    ➜ 用 `evaluateOnNewDocument` 把 `Date.now()` 钉死在指定的本地小时上
 *      （只改 `Date.now`，不动 `window.Date`，免得波及 Dexie），
 *      并把 `timeScale` 锁成 1。四个时刻各跑一遍，四档就都被覆盖到。
 *
 * 2. **别把分档边界抄进脚本。**
 *    边界（5 / 8 / 17 / 20）从 `src/domain/farmClock.ts` **读**出来
 *    （`scripts/lib/quality.mjs` 解析 `settlement.ts` 是同一个套路）。
 *    抄一份的话，改了分档脚本还是绿的 —— 守卫会**悄悄变弱**，而不是变红。
 *
 * ★ 断言里必须有一条**对照组**：四个时刻要真的产出四档**不同**的色调。
 *   否则若色调恒为 'day'，「天空跟着小时走」根本没被验证，而白天那一条照样绿。
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
  SRC.indexOf('⚠️ **墓碑'),
)
const lt = [...fnBody.matchAll(/hour\s*<\s*(\d+)/g)].map((m) => Number(m[1]))
const ge = [...fnBody.matchAll(/hour\s*>=\s*(\d+)/g)].map((m) => Number(m[1]))

/* 结构守卫：解析不出来就**直接退出**，绝不退化成「随便测点什么」。
   哪天有人把 skyToneFor 改写成查表 / switch，这里会红，提醒来改脚本 ——
   而不是静默地把边界当成 0。 */
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
/** 记下每档的草地 filter，用来做「昼夜真的不一样」的对照 */
const sceneFilters = {}

for (const vp of VIEWPORTS) {
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`capture-sky-${vp.name}`),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const hour of PROBES) {
    const want = toneFor(hour)
    console.log(
      `\n── ${vp.name} ${vp.width}×${vp.height} · 农场 ${String(hour).padStart(2, '0')}:00 → ${want} ──`,
    )
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

    /* 进农场页：App 默认开在「任务」页，别假设 */
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
      const toneClasses = [...sky.classList].filter((c) => c.startsWith('kqf-sky--'))
      const body = document.querySelector('[data-sky-body]')
      const scene = document.querySelector('[data-sky-scene]')

      /* ★★ 遮挡探针：按 8×8 网格采样日月的包围盒，
         数「最上面那一层到底是不是它」。 */
      let visible = 0
      let total = 0
      let blocker = null
      if (body) {
        const r = body.getBoundingClientRect()
        for (let i = 1; i < 8; i++) {
          for (let j = 1; j < 8; j++) {
            const x = r.left + (r.width * i) / 8
            const y = r.top + (r.height * j) / 8
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
            total++
            const el = document.elementFromPoint(x, y)
            /* ⚠️ 只认「它就是它 / 它是它的后代」。
               **不能**写 `el.contains(body)` —— 那样「被祖先兜住」也算可见，
               而 `pointer-events:none` 或「被兄弟节点盖住」时
               `elementFromPoint` 返回的正好就是祖先，这条断言就永远绿了。 */
            if (el && (el === body || body.contains(el))) visible++
            else if (!blocker && el) {
              const cls =
                typeof el.className === 'string' ? '.' + el.className.split(/\s+/).slice(0, 2).join('.') : ''
              blocker = `${el.tagName.toLowerCase()}${cls}`
            }
          }
        }
      }

      /* 时钟条：底色是不是跟着色调走（往上找带 bg- 类的那一层） */
      let row = body
      let rowClass = null
      while (row && row !== document.body) {
        const cls = typeof row.className === 'string' ? row.className : ''
        if (cls.includes('bg-')) {
          rowClass = cls.split(/\s+/).filter((c) => c.startsWith('bg-')).join(' ')
          break
        }
        row = row.parentElement
      }
      /* 顶栏那行「农场第 N 天 · hh:mm」—— 时钟和天空必须是**同一个小时** */
      const m = (document.body.innerText ?? '').match(
        /农场第\s*(\d+)\s*天\s*[·・.]\s*(\d{1,2}):(\d{2})/,
      )
      return {
        tone: toneClasses[0]?.replace('kqf-sky--', '') ?? null,
        toneClassCount: toneClasses.length,
        kind: body?.getAttribute('data-sky-body') ?? null,
        bodyW: body ? Math.round(body.getBoundingClientRect().width) : null,
        pct: total ? Math.round((visible / total) * 100) : -1,
        sampled: total,
        blocker,
        rowClass,
        sceneTone: scene?.getAttribute('data-sky-scene') ?? null,
        sceneFilter: scene ? getComputedStyle(scene).filter : null,
        clockDay: m ? Number(m[1]) : null,
        clockHour: m ? Number(m[2]) : null,
        clockText: m ? m[0] : null,
      }
    })

    seenTones.push(got.tone)
    sceneFilters[want] = got.sceneFilter

    check(
      `天空色调 = ${want}`,
      got.tone === want,
      `实际 ${got.tone}（class 里 ${got.toneClassCount} 个色调类）`,
    )
    check('天空只挂了一个色调类（没有两档同时生效）', got.toneClassCount === 1)
    check(
      '★ 日 / 月和色调一致（不会「天黑着、太阳还挂着」）',
      got.kind === (want === 'night' ? 'moon' : 'sun'),
      `色调 ${got.tone} → 画的是 ${got.kind}`,
    )
    /* ★★ 本文件存在的理由：画了 ≠ 看得见 */
    check(
      '★★ 日月**真的可见**（采样点上最上层就是它，没被任何东西盖住）',
      got.pct === 100,
      `可见 ${got.pct}%（采样 ${got.sampled} 点）${got.blocker ? ` · 挡住它的是 ${got.blocker}` : ''}`,
    )
    check('日月画出来了（20px 的小图标）', got.bodyW === 20, `宽 ${got.bodyW}px`)
    check(
      '★ 顶栏时钟的小时 == 天空用的小时（同一个事实，不是两份）',
      got.clockHour === hour,
      `顶栏「${got.clockText ?? '（没读到）'}」→ ${got.clockHour} 点`,
    )
    check(
      '时钟条的底色跟着色调走（找到了带 bg- 的那一层）',
      !!got.rowClass,
      `底色类 = ${got.rowClass}`,
    )
    check(
      '★ 草地 / 山丘也拿到了这一档（昼夜要「感觉得到」）',
      got.sceneTone === want,
      `data-sky-scene = ${got.sceneTone}`,
    )
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

/* 草地必须真的随昼夜变 —— 白天不动，夜里明显压暗 */
check(
  '★ 白天草地**没有**被加滤镜（观感零变化）',
  !sceneFilters.day || sceneFilters.day === 'none',
  `day filter = ${sceneFilters.day}`,
)
check(
  '★ 夜里的草地确实被压暗了（昼夜看得见）',
  !!sceneFilters.night && sceneFilters.night !== 'none' && sceneFilters.night !== sceneFilters.day,
  `night filter = ${sceneFilters.night}`,
)

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
