/**
 * 家长栏「游戏」区块走查图 + 结构自检。
 *
 * 用法：node scripts/capture-games.mjs [url] [outDir]
 *
 * 为什么单独一份：`capture.mjs` / `e2e-check.mjs` 都不进设置页的「游戏」页，
 * 这块新加的东西没有任何脚本看得见 —— 正是本项目最怕的盲区。
 *
 * 三个坑（都真踩过，见 shot-farm2d.mjs）：
 *   1. 入场页会自己切到主界面（~1.9s），不等它会撞上那次导航。
 *   2. `makeProfileDir()` 每次建**新**目录 —— 两个视口共用一个 browser 就共用
 *      一个库，第二遍的状态是脏的。所以**每个视口各起一个 browser**。
 *   3. 走查脚本**不许只打印**，要硬断言 + 非零退出码（本项目踩过「全绿却漏了
 *      最坏情况」那次）。下面 `check()` 失败会累积到 `failed`。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4396/'
const OUT = process.argv[3] ?? '.e2e-scratch/games'

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

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
]

/** 点一个「文字正好等于 label」的按钮 */
const clickExact = (page, label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.textContent ?? '').trim() === t,
    )
    if (!b) return false
    b.click()
    return true
  }, label)

for (const vp of VIEWPORTS) {
  console.log(`\n── ${vp.name} ${vp.width}×${vp.height} ──`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`shot-games-${vp.name}`),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 })
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await dismissOnboarding(page)
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })

  /* ---- ① 底部导航的游戏那一格 = 当前游戏（这是家长这次要的核心） ---- */
  const navGame = await page.evaluate(() => {
    const b = document.querySelector('[data-tour="tab-farm"]')
    return b ? { text: (b.textContent ?? '').trim(), tour: b.getAttribute('data-tour') } : null
  })
  check(
    '底部导航的游戏格显示「当前游戏」，且锚点仍是 tab-farm',
    !!navGame && navGame.text.includes('农场') && navGame.text.includes('🌾'),
    navGame ? `text="${navGame.text}" tour=${navGame.tour}` : '没找到 [data-tour="tab-farm"]',
  )
  await page.screenshot({ path: `${OUT}/${vp.name}-1-底部导航.png` })

  /* ---- ② 进设置 → 游戏页 ---- */
  await page.evaluate(() => document.querySelector('button[aria-label="设置"]')?.click())
  await page.waitForFunction(
    () => [...document.querySelectorAll('h1')].some((h) => h.textContent?.includes('设置')),
    { timeout: 8000 },
  )
  const tabClicked = await clickExact(page, '🎮 游戏')
  check('设置页有「🎮 游戏」这一栏', tabClicked)
  await wait(400)

  /* ---- ②b 加了第 4 栏之后，栏目条在手机上还放得下吗？----
     原来只有 3 栏（孩子/规则/数据），390px 上正好；加一栏就可能溢出，
     而 `overflow-x-auto` 溢出**不报错**，只是把最后一栏裁掉一半 ——
     家长会以为「数据」那一栏坏了。量出来，别靠看。 */
  const navFit = await page.evaluate(() => {
    const row = document.querySelector('nav > div')
    if (!row) return null
    return {
      scrollW: row.scrollWidth,
      clientW: row.clientWidth,
      tabs: [...row.querySelectorAll('button')].map((b) => ({
        t: (b.textContent ?? '').trim(),
        w: Math.round(b.getBoundingClientRect().width),
      })),
    }
  })
  check(
    '设置页的栏目条不溢出（最后一栏没被裁掉）',
    !!navFit && navFit.scrollW <= navFit.clientW + 2,
    navFit
      ? `scrollW=${navFit.scrollW} clientW=${navFit.clientW} 各栏宽=${navFit.tabs
          .map((x) => `${x.t}:${x.w}`)
          .join(' ')}`
      : '没找到栏目条',
  )

  /* ---- ③ 过家长密码（默认 0000，第 4 位自动提交） ---- */
  const pinShown = await page
    .waitForFunction(() => document.body.innerText.includes('请输入家长密码'), { timeout: 5000 })
    .then(() => true, () => false)
  check('游戏页先要家长密码', pinShown)
  for (let i = 0; i < 4; i++) {
    await clickExact(page, '0')
    await wait(180)
  }
  const unlocked = await page
    .waitForFunction(() => document.body.innerText.includes('已购买'), { timeout: 6000 })
    .then(() => true, () => false)
  check('输 0000 后进入游戏栏', unlocked)
  await wait(400)

  /* ---- ④ 内容自检 ---- */
  const info = await page.evaluate(() => {
    const txt = document.body.innerText
    const rows = [...document.querySelectorAll('li')].map((li) => (li.innerText ?? '').trim())
    const buttons = [...document.querySelectorAll('button')].map((b) =>
      (b.textContent ?? '').trim(),
    )
    return {
      txt,
      rows,
      buttons,
      hasMallCard: txt.includes('商城币'),
      hasOwned: txt.includes('已购买'),
      hasSoon: txt.includes('敬请期待'),
    }
  })

  check('有「商城币」一块', info.hasMallCard)
  check('有「已购买」一块', info.hasOwned)
  check('有「敬请期待」一块', info.hasSoon)
  check(
    '已购买里是农场，并且标了「当前」',
    info.rows.some((r) => r.includes('农场') && r.includes('当前')),
    info.rows.find((r) => r.includes('农场'))?.replace(/\n/g, ' / ') ?? '（没有农场的行）',
  )
  check(
    '两条占位游戏在列表里，且都标「敬请期待」',
    info.rows.filter((r) => r.includes('敬请期待')).length === 2,
    `占位行数 = ${info.rows.filter((r) => r.includes('敬请期待')).length}`,
  )
  // ★ 这一条才是重点：**没有任何东西可买**的时候，界面不许出现购买按钮。
  //   出现了就是「界面承诺了它做不到的事」。
  const buyButtons = info.buttons.filter((b) => /^🎫\s*\d+$/.test(b))
  check(
    '★ 没有可买的游戏时，一个购买按钮都不渲染',
    buyButtons.length === 0,
    buyButtons.length ? `出现了 ${JSON.stringify(buyButtons)}` : '0 个',
  )
  // 商城币余额必须是 0（这一轮没有发币入口）—— 写着别的数就是账本串了
  check('商城币余额是 0（还没有发币入口）', /商城币[\s\S]{0,80}?\b0\b/.test(info.txt), '')

  await page.screenshot({ path: `${OUT}/${vp.name}-2-家长栏游戏.png`, fullPage: true })
  console.log(`  · 已存图 ${OUT}/${vp.name}-2-家长栏游戏.png`)

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
