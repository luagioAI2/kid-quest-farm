/**
 * 平板走查截图 + 尺寸体检
 * ------------------------------------------------------------
 * 和 capture.mjs 的分工：capture.mjs 固定手机尺寸（390×844）出图，
 * 本脚本专门跑**平板**的几档尺寸，既出图也**量数**。
 *
 * 为什么要量而不是只看图：
 *   平板的问题大多不是「难看」，而是**横向溢出**（scrollWidth > clientWidth）
 *   和**内容被拉满**。前者在截图上只表现为「右边少了一点」，很容易看漏；
 *   量出来才是一个确定的数字。
 *
 * 用法：node scripts/capture-tablet.mjs [url] [输出目录]
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? '.e2e-scratch/tablet'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge，无法截图')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 真实在售平板的 CSS 逻辑像素（不是物理像素）。
 * 竖屏 / 横屏都覆盖 —— 横屏是最容易漏的一档：
 * 宽度一下到 1024~1366，而项目里 `lg:` 断点是 1024，
 * 会出现「栅格变成 4 列、但容器还是 672px」这种自相矛盾的状态。
 */
const DEVICES = [
  { tag: 'ipad-mini-portrait', w: 768, h: 1024, note: 'iPad mini 竖' },
  { tag: 'ipad-11-portrait', w: 834, h: 1194, note: 'iPad Air 11" 竖' },
  { tag: 'ipad-13-portrait', w: 1024, h: 1366, note: 'iPad Pro 13" 竖' },
  { tag: 'ipad-mini-landscape', w: 1024, h: 768, note: 'iPad mini 横', sheet: true },
  { tag: 'ipad-13-landscape', w: 1366, h: 1024, note: 'iPad Pro 13" 横', sheet: true },
  { tag: 'android-tab-portrait', w: 800, h: 1280, note: 'Android 平板竖' },
  { tag: 'android-tab-landscape', w: 1280, h: 800, note: 'Android 平板横' },
]

const TABS = [
  { key: 'tasks', label: '任务' },
  { key: 'farm', label: '农场' },
  { key: 'redeem', label: '兑换' },
  { key: 'points', label: '积分' },
]

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  userDataDir: makeProfileDir('tablet'),
})

const report = []

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 768, height: 1024, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  // 先把新手引导走完（全新 profile 必然弹，见 lib/onboarding.mjs 顶部）
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(2600)
  await dismissOnboarding(page)
  await wait(400)

  for (const d of DEVICES) {
    await page.setViewport({
      width: d.w,
      height: d.h,
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(2600)

    for (const t of TABS) {
      await page.evaluate((key) => {
        document.querySelector(`[data-tour="tab-${key}"]`)?.click()
      }, t.key)
      await wait(450)

      /**
       * 体检项：
       *  · colW    —— **真实内容列宽**（`main` 里那个 .page-col）。
       *              这是最该看的一个数：外壳宽度可以是对的，但页面自己
       *              又套一层 max-w 就会把它卡回去（原来 TaskPage/PointsPage/
       *              RedeemPage 各自写死 max-w-[430px]，平板上只剩 430px）。
       *  · usedPct —— 内容列占视口宽度的比例。手机上应当接近 100%，
       *              平板上 70~90% 算健康；<60% 就是白白空着。
       *  · overflow —— 横向溢出（>0 就是有内容被切掉）
       *  · navH     —— 底栏高度（横屏时它占掉屏幕高度的比例）
       *  · tapMin   —— 最小可点区域边长（<44 就低于可访问性下限）
       */
      const m = await page.evaluate(() => {
        const de = document.documentElement
        const main = document.querySelector('main')
        const col = main?.querySelector('.page-col') ?? null
        const nav = document.querySelector('nav')
        const btns = [...document.querySelectorAll('button')].filter((b) => {
          const r = b.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
        const minSide = btns.length
          ? Math.min(...btns.map((b) => {
              const r = b.getBoundingClientRect()
              return Math.min(r.width, r.height)
            }))
          : 0
        const colW = col ? Math.round(col.getBoundingClientRect().width) : -1
        return {
          vw: window.innerWidth,
          vh: window.innerHeight,
          overflow: de.scrollWidth - de.clientWidth,
          colW,
          usedPct: Math.round((colW / window.innerWidth) * 100),
          navH: nav ? Math.round(nav.getBoundingClientRect().height) : -1,
          tapMin: Math.round(minSide),
        }
      })

      const name = `${d.tag}-${t.key}`
      await page.screenshot({ path: `${OUT}/${name}.png` })
      report.push({ ...d, tab: t.key, ...m })
      console.log(
        `  ${name.padEnd(30)} vw=${String(m.vw).padStart(4)} 内容列=${String(m.colW).padStart(4)} ` +
          `占比=${String(m.usedPct).padStart(3)}% 溢出=${String(m.overflow).padStart(3)} ` +
          `底栏=${String(m.navH).padStart(3)} 最小点击=${String(m.tapMin).padStart(3)}`,
      )
    }

    /* ---- 弹层体检 ----
       两套弹层实现（tasks/ui.tsx 的 Sheet、farm/farmUi.tsx 的 BottomSheet）
       原来在平板上都不对：一套限死 430px、一套**完全不限宽**会铺满整屏。
       期望：≥768px 起是居中对话框，遮罩必须盖住整个视口
       （遮罩用 absolute 的话，外层一加 padding 就会跟着缩进，露出一圈）。 */
    if (d.sheet) {
      // 上一步停在「积分」tab，编辑按钮在「任务」tab 上，先切回去
      await page.evaluate(() => document.querySelector('[data-tour="tab-tasks"]')?.click())
      await wait(500)
      await page.evaluate(() =>
        document.querySelector('button[aria-label="编辑任务"]')?.click(),
      )
      await wait(800)
      const s = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]')
        if (!dlg) return null
        const panel = dlg.querySelector(':scope > div:nth-child(2)')
        const bd = dlg.querySelector(':scope > button')
        const r = panel?.getBoundingClientRect()
        const br = bd?.getBoundingClientRect()
        return {
          w: r ? Math.round(r.width) : -1,
          h: r ? Math.round(r.height) : -1,
          centered: r ? Math.abs((r.top + r.bottom) / 2 - window.innerHeight / 2) < 40 : false,
          backdropFull:
            !!br && br.width >= window.innerWidth - 1 && br.height >= window.innerHeight - 1,
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }
      })
      await page.screenshot({ path: `${OUT}/${d.tag}-sheet.png` })
      console.log(
        `  ${d.tag}-sheet`.padEnd(32) +
          (s
            ? `弹层=${s.w}×${s.h} 居中=${s.centered} 遮罩铺满=${s.backdropFull} 溢出=${s.overflow}`
            : '没找到 [role=dialog]'),
      )
      report.push({ ...d, tab: 'sheet', ...(s ?? {}) })
      await page.evaluate(() => document.querySelector('[aria-label="关闭"]')?.click())
      await wait(500)
    }
  }

  writeFileSync(`${OUT}/report.json`, JSON.stringify({ report, errors }, null, 2))
  console.log(`\n页面错误 ${errors.length} 条`)
  for (const e of errors.slice(0, 10)) console.log('  !', e.slice(0, 140))
} finally {
  await browser.close()
}
