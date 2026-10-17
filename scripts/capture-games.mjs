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
import { MALL } from './lib/currency.mjs'

/* ⚠️ 变量名**别叫 `URL`** —— 那会遮住全局的 `URL` 构造器（本项目踩过）。 */
const TARGET = process.argv[2] ?? 'http://127.0.0.1:4396/'
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
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
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

  /* ---- ④ 内容自检 ----
     ★ 期望条数**从注册表现状推导**，不写死（见下面几处的注释）。
     2026-10-16 娃娃机上线之前，这里写死的是「占位 2 条」「一个购买按钮都没有」
     —— 上线当天三条断言一起红，红的原因是**例子过期**，不是功能坏了。 */
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
      hasMallCard: txt.includes('钻石'),
      hasOwned: txt.includes('已购买'),
      hasSoon: txt.includes('敬请期待'),
      games: window.__kqf__?.games?.() ?? [],
      owned: window.__kqf__?.getState?.().ownedGameIds ?? [],
      hasMint: document.querySelector('[data-mall-mint]') !== null,
      mallBalanceText: document.querySelector('[data-mall-balance]')?.innerText ?? '',
      // 账本派生出来的真实余额 —— 用来验「卡片上显示的数 = 派生值」，不写死 0
      mallBalance: window.__kqf__?.getState?.().mallBalance ?? -1,
    }
  })

  const soonGames = info.games.filter((g) => g.status === 'comingSoon')
  // 可买 = 做好的 × 有价的 × 还没买的（免费的首款不在「敬请期待」里）
  const buyable = info.games.filter(
    (g) => g.status === 'available' && g.priceMall > 0 && !info.owned.includes(g.id),
  )

  check('有「钻石」一块', info.hasMallCard)
  check('有「已购买」一块', info.hasOwned)
  check('有「敬请期待」一块', info.hasSoon)
  check(
    '已购买里是农场，并且标了「当前」',
    info.rows.some((r) => r.includes('农场') && r.includes('当前')),
    info.rows.find((r) => r.includes('农场'))?.replace(/\n/g, ' / ') ?? '（没有农场的行）',
  )
  check(
    `占位游戏在列表里，且都标「敬请期待」（注册表现状 ${soonGames.length} 条）`,
    info.rows.filter((r) => r.includes('敬请期待')).length === soonGames.length,
    `占位行数 = ${info.rows.filter((r) => r.includes('敬请期待')).length}`,
  )
  // ★ 这一条才是重点：**没有任何东西可买**的时候，界面不许出现购买按钮。
  //   出现了就是「界面承诺了它做不到的事」。
  /*
    ⚠️ 图标**从 `domain/currency.ts` 派生**（走 `scripts/lib/currency.mjs`），
      不在脚本里再抄一份。这里原来写死的是 `/^🎫\s*\d+$/` ——
      2026-10-16 钻石的图标从 `🎫` 换成 `🛍️`，那种写法会**静默地一个都匹配不到**，
      于是下面「个数 = N」这条会红在一个跟功能完全无关的地方（例子过期，不是坏了）。

    ⚠️ 也别用 emoji 拼正则：只判「以这个图标开头」+「后面全是数字」。
      取数字同理，用 `slice` 不用正则（`e2e-check.mjs` 那边也是这么改的）。
  */
  const isBuyLabel = (t) => {
    const s = (t ?? '').trim()
    if (!s.startsWith(MALL.emoji)) return false
    return /^\d+$/.test(s.slice(MALL.emoji.length).trim())
  }
  const buyButtons = info.buttons.filter(isBuyLabel)
  /*
    ★ 这一条的原意是「**没做好的游戏**不许出现购买按钮」（界面不能承诺
    它做不到的事）。原实现是「一个购买按钮都不许有」—— 那在「一款能买的
    都没有」的年代恰好等价，但娃娃机上线之后就变成了一条**错误的**断言。

    ➜ 改成直接表达原意：购买按钮的**个数**必须等于「做好的 × 有价的 × 没买的」，
      而且**每一款 comingSoon 的行里都不许有**。这样以后钓鱼池上线也不用改。
  */
  check(
    `★ 购买按钮的个数 = 做好的有价游戏里还没买的那些（应为 ${buyable.length}）`,
    buyButtons.length === buyable.length,
    `实际 ${buyButtons.length} 个：${JSON.stringify(buyButtons)}`,
  )
  const soonRows = info.rows.filter((r) => r.includes('敬请期待'))
  check(
    '★ 每一款「敬请期待」的游戏行里都没有购买按钮',
    soonRows.every((r) => !r.includes(MALL.emoji)),
    soonRows.filter((r) => r.includes(MALL.emoji)).join(' / ') || '（都没有）',
  )

  /*
    钻石卡片：2026-10-16 起**有**发币入口（手动发放），
    因为娃娃机用钻石买 —— 没有入口的话那个购买按钮按下去必然失败。
    2026-10-17 起**新档会送 500 钻石**（`doSeedIfEmpty` 的欢迎种子），
    所以「新档余额必须是 0」已经不成立了。
    现在钉的是：入口在、**卡片上显示的数 = 账本派生出来的数**（不写死 0 / 500）。
  */
  check('★ 钻石卡片上有手动发放入口', info.hasMint, info.hasMint ? '' : '没找到 [data-mall-mint]')
  check(
    '★ 钻石卡片显示的数 = 账本派生出来的余额',
    info.mallBalance >= 0 && info.mallBalanceText.replace(/\D/g, '') === String(info.mallBalance),
    `显示「${info.mallBalanceText.trim()}」/ 派生 ${info.mallBalance}`,
  )

  await page.screenshot({ path: `${OUT}/${vp.name}-2-家长栏游戏.png`, fullPage: true })
  console.log(`  · 已存图 ${OUT}/${vp.name}-2-家长栏游戏.png`)

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
