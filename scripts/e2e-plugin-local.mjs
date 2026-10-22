/**
 * **本地包在真 App 里走一遍**（安装 → 设为当前 → 玩一局 → 换券 → 切走切回 → 卸载）。
 *
 * 用法：
 *   npm run build
 *   CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
 *   node scripts/e2e-plugin-local.mjs http://127.0.0.1:4393/
 *
 * ------------------------------------------------------------
 * ## 为什么必须有这一份（而不是「单测 + 假宿主测试就够了」）
 *
 * 已有的三层各自有盲区，而且**恰好都盖不到这条链**：
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `plugin-test.cjs`（假宿主） | 插件自己按契约工作 | 真宿主的 host API 有没有接对 |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里 IndexedDB、WebGL、blob 模块 |
 * | `installStore.test.ts` | 装包逻辑 | 界面有没有入口、装完能不能玩 |
 *
 * 尤其是 **`mount` 返回 Promise 那件事**：假宿主测试里脚本自己 `await mount()`，
 * 所以「宿主拿到 Promise 当函数用」这个 bug 在那边**永远是绿的**。
 * 这一份走真宿主（`PluginGameHost` → `mountGame` → `mountBundle`），
 * 并且用 `window.__debug` 的存亡来判「卸载真的跑了」—— 那才是 v3 契约要修的东西。
 *
 * ## 断言的骨架：**每一环都要有能失败的前提**
 *
 * ① 动手前「一款都没装」——否则后面每条「装上了」都可能恒真；
 * ② 装完不是看返回值，而是看**界面上那一行变成「已安装」**（返回值对、界面没变 = 没接上）；
 * ③ 玩一局不是看按钮点得动，而是看**积分 -5、币 +5**（钱真的走了）；
 * ④ 换券不是看提示文字，而是看**兑换券余额 +4**（券真的进了账本）；
 * ⑤ 切走之后 `window.__debug` 必须**消失**（destroy 真跑了）—— 这条只有真宿主能给；
 * ⑥ 卸载之后 `gameKv` 里**一条 prizepark 的行都不许剩**（否则重装会捡到旧存档）。
 *
 * ## 钱的那条链（本脚本验的就是它）
 *
 * ```
 *   积分 🪙 ──buyGameCoin──▶ 游戏币 🧸 ──spendGameCoin──▶ 一局
 *                                 └────redeemGameCoin──▶ 兑换券 🎟️
 * ```
 *
 * 三段都走**界面**（买币面板 / 开局按钮 / 回收页那颗「换成兑换券」），
 * 不直接调 store —— 直接调只能证明函数在，证明不了「孩子点得到」。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir, SCRATCH_BASE } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4393/'
const VIEWPORT = process.argv[3] ?? 'phone'

const GAME_ID = 'prizepark'
const GAME_VERSION = '1.3.0'
/** 一局买几个币（`openBuySheet` 里写死 `Math.min(5, affordable)`，这里跟着它） */
const BUY_COINS = 5
/** 1 币 = 1 积分（`wallet.js` 的 POINTS_PER_COIN；打包脚本会核对） */
const POINTS_PER_COIN = 1

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('✗ 找不到 Chrome / Edge —— 设 CHROME_PATH 指过去')
  process.exit(2)
}

const SIZES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
}
const size = SIZES[VIEWPORT]
if (!size) {
  console.error(`✗ 不认识的视口：${VIEWPORT}（可选 ${Object.keys(SIZES).join(' / ')}）`)
  process.exit(2)
}

const OUT = join(SCRATCH_BASE, 'plugin-local')
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\n本地包接入走查（${VIEWPORT} ${size.width}×${size.height}）`)
console.log(`目标 App：${TARGET}\n`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir(`plugin-local-${VIEWPORT}`),
  // 没有独显时让 Chrome 回落到软件渲染：娃娃机要 WebGL + Rapier(wasm)，
  // 不给这个参数会走到「打不开 3D 画面」那一支，而看起来像包坏了。
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})

/**
 * 等「主界面真的出来了」。
 *
 * ⚠️ 别用 `!!window.__kqf__` —— 它在模块求值时就挂上了，比入场页早。
 * 入场页有 `SPLASH_MIN_MS` 的最短停留，所以刷新后立刻查 DOM 查到的是入场页
 * （里面一个 `nav button` 都没有）。判据只能是底部导航出现。
 */
const waitForApp = (p) =>
  p.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 30000 })

await page.setViewport({ ...size, deviceScaleFactor: 1 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await waitForApp(page)
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__?.plugin, { timeout: 15000 })
await wait(300)

/* ============================================================
   小工具
   ============================================================ */

/** 点一个 DOM 元素（用选择器）。找不到就返回 false —— **别静默** */
const clickSel = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!(el instanceof HTMLElement)) return false
    el.click()
    return true
  }, sel)

/** 按可见文字点按钮。⚠️ 用 `includes` 不用 `===`（文案常带 emoji 前缀） */
const clickText = (label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.innerText ?? '').includes(t),
    )
    if (!b) return false
    b.click()
    return true
  }, label)

/** 等某个选择器出现 / 消失，返回布尔（不抛） */
const waitFor = (sel, timeout = 15000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(
    () => true,
    () => false,
  )
const waitGone = (sel, timeout = 15000) =>
  page.waitForFunction((s) => !document.querySelector(s), { timeout }, sel).then(
    () => true,
    () => false,
  )

/** store 里跟这条链有关的切片 */
const snap = () =>
  page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      balance: s.balance, // 积分 🪙
      vouchers: s.harvestBalance, // 兑换券 🎟️
      active: s.activeGameId,
      installed: Object.keys(window.__kqf__.plugin.installed()),
      kvOwners: null,
    }
  })

const kvOwners = () => page.evaluate(() => window.__kqf__.plugin.kvOwnerIds())

/**
 * 打开「设置 → 游戏」，并过家长密码。
 *
 * ⚠️ 顺序：**先切栏，再过密码**。设置页每次切栏都会重新上锁，
 * 反过来做会得到「密码过了、一点栏又变成密码卡」，看着像「游戏那一栏没了」。
 */
async function openGameSettings() {
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('设置'),
    )
    if (!b) return false
    b.click()
    return true
  })
  if (!opened) return '找不到顶栏的设置按钮'
  await wait(700)

  if (!(await clickText('游戏'))) return '设置页里没有「游戏」那一栏'
  await wait(600)

  // 默认 PIN = 0000（第 4 位自动提交，没有确认按钮）
  for (let round = 0; round < 2; round++) {
    const locked = await page.evaluate(() =>
      document.body.innerText.includes('请输入家长密码'),
    )
    if (!locked) return null
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(
          (x) => x.textContent?.trim() === '0',
        )
        b?.click()
      })
      await wait(180)
    }
    await wait(600)
  }
  const stillLocked = await page.evaluate(() =>
    document.body.innerText.includes('请输入家长密码'),
  )
  return stillLocked ? '家长密码没过（PIN 不是 0000？）' : null
}

/** 从设置页回到孩子的界面 */
async function leaveSettings() {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('返回'),
    )
    if (b) b.click()
  })
  await wait(600)
}

/* ============================================================
   ⓪ 基线：动手之前必须是「什么都没装」
   ------------------------------------------------------------
   少了这一步，后面每一条「装上了」都可能是恒真的。
   ============================================================ */
console.log('【⓪ 基线】')
{
  const hostApi = await page.evaluate(() => window.__kqf__.plugin.hostApiVersion)
  // 契约版本：本地包 manifest 写的是 minHostApi 3（它要 redeemGameCoin）。
  // 宿主比它老 ⇒ 装得上也跑不了，所以这条先钉住。
  check('宿主契约版本是 3（有 redeemGameCoin / ctx / 异步 mount）', hostApi === 3, `HOST_API=${hostApi}`)

  const before = await snap()
  check('动手前一款插件游戏都没装', before.installed.length === 0, before.installed.join(',') || '(空)')
  check('动手前底部没有插件游戏那一格', !(await page.$(`[data-tour="tab-${GAME_ID}"]`)))
  check('动手前 `gameKv` 里没有 prizepark 的行', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
  check('动手前当前游戏是农场', before.active === 'farm', before.active)
}

/* ============================================================
   ① 安装（走家长真实会点的那个按钮）
   ============================================================ */
console.log('\n【① 安装：设置 → 游戏 → 随 App 附带 → 安装】')
let pointsBefore = 0
{
  const err = await openGameSettings()
  check('打开「设置 → 游戏」并过了家长密码', err === null, err ?? '')

  const row = await page.evaluate((id) => {
    const li = document.querySelector(`[data-local-row="${id}"]`)
    if (!li) return null
    const btn = li.querySelector('[data-local-install]')
    return {
      text: (li.innerText ?? '').replace(/\s+/g, ' ').trim(),
      hasButton: !!btn,
      disabled: btn ? btn.disabled : true,
    }
  }, GAME_ID)
  check('「随 App 附带」里列出了奖品公园', !!row, row?.text ?? '(没找到那一行)')
  check('安装按钮在、而且是可点的', !!row?.hasButton && row?.disabled === false, JSON.stringify(row))
  // 体积是清单里给的提示值，不是校验依据；这里只确认它**不是「大小未知」**
  check('那一行写了包体大小（说明清单里带着 bytes）', /MB|KB/.test(row?.text ?? ''), row?.text ?? '')

  const clicked = await clickSel(`[data-local-install="${GAME_ID}"]`)
  check('点了「安装」', clicked)

  // 判据是**界面那一行变成「已安装」**，不是 store 的返回值
  const installedTag = await waitFor(`[data-local-installed="${GAME_ID}"]`, 20000)
  check('★ 界面上那一行变成了「已安装」', installedTag)

  const after = await snap()
  check(
    `装上的版本是 v${GAME_VERSION}`,
    (await page.evaluate((id) => window.__kqf__.plugin.installed()[id]?.version, GAME_ID)) ===
      GAME_VERSION,
  )
  check('「已下载」卡片里出现了它', await waitFor(`[data-plugin-installed-row="${GAME_ID}"]`, 5000))
  check('已安装清单里有 prizepark', after.installed.includes(GAME_ID), after.installed.join(','))

  /*
   * 经济参数要**给家长看得见**（PluginStoreCard ③）。
   * 这一块同时是「manifest 里的 voucherPerCoin 真的读到了」的界面证据：
   * 没读到的话那一行会显示「不开放兑换券」。
   */
  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  check('家长能看到「一局 1 积分」', /一局\s*1\s*积分/.test(econ), econ)
  check('家长能看到「1 娃娃机币 = 1 兑换券」', /1\s*娃娃机币\s*=\s*1\s*兑换券/.test(econ), econ)

  pointsBefore = after.balance
}

/* ============================================================
   ② 设为当前（走「已下载」那一行上的按钮）
   ============================================================ */
console.log('\n【② 设为当前】')
{
  const clicked = await clickSel(`[data-plugin-set-current="${GAME_ID}"]`)
  check('点了「设为当前」', clicked)
  await wait(800)

  const after = await snap()
  check('store 里当前游戏切成了 prizepark', after.active === GAME_ID, after.active)
}

await leaveSettings()
await waitForApp(page)

{
  /*
   * ⚠️ 这一条必须在**退出设置页之后**查：设置页会把整个主界面替换掉
   * （`showSettings ? <SettingsPage/> : …`），所以底栏在设置页里**根本不存在**。
   * 在设置页里查底栏，得到的是「没有这一格」—— 看着像功能坏了，其实是问错了地方。
   */
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    return b ? (b.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  }, GAME_ID)
  // tabLabel 是 3 个字（导航格上限）。这里顺带证明 manifest 的 tabLabel 真被用了
  check('底部导航多出「奖品园」那一格', tab.includes('奖品园'), tab || '(没有这一格)')
}

/* ============================================================
   ③ 玩一局：进机台 → 买币 → 开局
   ============================================================ */
console.log('\n【③ 玩一局（含买币）】')
let coinsAfterPlay = 0
{
  check('点了底部「奖品园」那一格', await clickSel(`[data-tour="tab-${GAME_ID}"]`))

  const host = await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000)
  check('宿主给插件开出了容器（`data-plugin-host`）', host)

  // 3D 游戏要等纹理 + 物理 wasm；`__gpPlayable` 是它自己说的「我好了」
  const playable = await page
    .waitForFunction(() => window.__gpPlayable === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__gpPlayable`，纹理 + Rapier 都到位）', playable)

  const shape = await page.evaluate((id) => {
    const box = document.querySelector(`[data-plugin-host="${id}"]`)
    const root = box?.querySelector('.pp-root')
    const boxRect = box?.getBoundingClientRect()
    // 首页 = 机台列表（`#list`）。原来这里是 `#title`（标题页），2026-10-22 改版删了
    const home = box?.querySelector('#list')
    return {
      roots: box?.querySelectorAll('.pp-root').length ?? 0,
      canvas: box?.querySelectorAll('canvas').length ?? 0,
      hostH: Math.round(boxRect?.height ?? 0),
      w: Math.round(root?.getBoundingClientRect().width ?? 0),
      h: Math.round(root?.getBoundingClientRect().height ?? 0),
      homeH: Math.round(home?.getBoundingClientRect().height ?? 0),
      error: (document.body.innerText ?? '').includes('打不开'),
    }
  }, GAME_ID)
  check('只有一个根节点 `.pp-root`（没有重复挂载）', shape.roots === 1, `roots=${shape.roots}`)
  check('canvas 在容器里（3D 真的建起来了）', shape.canvas === 1, `canvas=${shape.canvas}`)
  /*
   * ★ 这一条是**空白页**的判据（2026-10-22 抓到过）。
   *
   * 之前只断言「h > 0」，而真实现象是：宿主容器 698px、插件根节点 **0px** ——
   * 整屏空白，但 canvas 在、`__gpPlayable` 也 true，所有别的断言全绿。
   * 所以判据必须是「根节点**等于**容器高度」，不是「大于 0」。
   */
  check(
    '★ 根节点填满了宿主给的盒子（高度等于容器）',
    shape.h > 100 && Math.abs(shape.h - shape.hostH) <= 1,
    `容器 ${shape.hostH} · 根节点 ${shape.h}`,
  )
  check('首页画面有实际高度（不是空白）', shape.homeH > 100, `#list ${shape.homeH}px`)
  check('不是「打不开」那一支', shape.error === false)

  /*
   * ★ 样式没泄漏的**对照**：往 body 上塞一个 `.grid`，它必须还是 Tailwind 的
   *   `display:grid`。插件那份未分层的 `.grid` 一旦漏出来就会盖掉它
   *   （未分层样式胜过 `@layer utilities`）—— 症状是「切回农场，网格变成可拖拽的两列小卡片」。
   */
  const gridOk = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.className = 'grid'
    probe.id = '__grid_probe__'
    document.body.appendChild(probe)
    const display = getComputedStyle(probe).display
    probe.remove()
    return display
  })
  check('★ 插件的样式被收进了根类（宿主 `.grid` 没被污染）', gridOk === 'grid', `display=${gridOk}`)

  /* ---- 进机台：首页**就是**机台列表（2026-10-22 改版去掉了标题页那一道门） ---- */
  const listUp = await waitFor('#list:not(.hidden)', 10000)
  check('★ 落地页直接就是机台列表（不再有「大 logo + 开始游戏」的标题页）', listUp)

  const shell = await page.evaluate(() => ({
    title: !!document.querySelector('#title'),
    bnav: !!document.querySelector('.bnav'),
    bar: !!document.querySelector('.ppBar'),
  }))
  check('旧标题页 `#title` 已经删掉', !shell.title)
  check('插件自己那条 5 格底部导航 `.bnav` 已经删掉（不跟宿主 TabBar 叠着）', !shell.bnav)
  check('首页底部是农场那种动作条 `.ppBar`（背包 / 回收 / 排行）', shell.bar)
  const entered = await page.evaluate(() => {
    const cell = document.querySelector('#mGrid .mcell:not(.wip)')
    if (!cell) return false
    cell.click()
    return true
  })
  check('点了第一台可玩的机台', entered)
  const inPlay = await waitFor('#play:not(.hidden)', 15000)
  check('进了机台画面', inPlay)
  await wait(1200) // 建场景 + 相机落位

  /* ---- 买币：0 币时点「开局」会进买币面板 ---- */
  const beforeBuy = await snap()
  // 先补点积分，让「买币」这条路走得通（新装机只有 50 分，够，但这里不依赖种子数）
  await page.evaluate(() => window.__kqf__.addPoints(20))
  await wait(300)
  const withPoints = await snap()
  check('调试入口补了 20 积分（准备买币）', withPoints.balance === beforeBuy.balance + 20, `${beforeBuy.balance} → ${withPoints.balance}`)

  const payClicked = await clickSel('#btnPlay')
  check('点了「开局」（0 币时它应该是「买娃娃机币」）', payClicked)
  const payUp = await waitFor('#payModal:not(.hidden)', 8000)
  check('★ 没钱时开局会弹出买币面板（不是「点了没反应」）', payUp)

  const buyYes = await clickSel('#buyYes')
  check('点了买币面板里的「买」', buyYes)
  const payGone = await waitGone('#payModal:not(.hidden)', 15000)
  check('买币面板关掉了（说明这笔买成了）', payGone)
  await wait(500)

  const afterBuy = await snap()
  check(
    `★ 积分扣了 ${BUY_COINS * POINTS_PER_COIN}（${withPoints.balance} → ${afterBuy.balance}）`,
    afterBuy.balance === withPoints.balance - BUY_COINS * POINTS_PER_COIN,
    `${withPoints.balance} → ${afterBuy.balance}`,
  )
  const coins = await page.evaluate(() => window.__debug?.coins ?? -1)
  check(`★ 游戏币 +${BUY_COINS}（账本里真的记上了）`, coins === BUY_COINS, `${coins} 个`)

  /* ---- 开局：再点一次，这次真的付 1 个币 ---- */
  await wait(400)
  const playClicked = await clickSel('#btnPlay')
  check('再点一次「开局」（这次有币，应该直接开）', playClicked)

  const paid = await page
    .waitForFunction(
      (n) => window.__debug && window.__debug.coins === n - 1,
      { timeout: 15000 },
      BUY_COINS,
    )
    .then(() => true, () => false)
  check(`★ 开局真的扣了 1 个币（${BUY_COINS} → ${BUY_COINS - 1}）`, paid)

  const phase = await page.evaluate(() => window.__debug?.phase ?? '(没有 __debug)')
  // idle_x / moving_x = 吊爪已经动起来了，这一局确实开始了
  check('吊爪进入了运行状态（这一局真的开了）', /^(idle_x|moving_x|idle_z|moving_z|catchgo)$/.test(phase), phase)

  coinsAfterPlay = await page.evaluate(() => window.__debug?.coins ?? 0)
}

/* ============================================================
   ④ 币 → 兑换券（回收页那颗按钮，走的是 host.redeemGameCoin）
   ============================================================ */
console.log('\n【④ 换成兑换券（币 → 券）】')
let vouchersBefore = 0
{
  const before = await snap()
  vouchersBefore = before.vouchers

  // 2026-10-22 改版后插件内**没有底部导航**了（`.bnav` 删了，不跟宿主 TabBar 叠着）。
  // 所以路径变成：机台里按「← 返回」回列表 → 点首页底部动作条上的「回收」。
  // 这条比原来那条更接近玩家真实操作，也顺手证明「返回键真的能退出机台」。
  const leftPlay = await clickSel('#backBtn')
  check('从机台退回列表（返回键）', leftPlay)
  check('列表又出来了', await waitFor('#list:not(.hidden)', 8000))

  const navOk = await clickSel('#sellBtn')
  check('点首页底部动作条上的「回收」', navOk)
  const sellUp = await waitFor('#sell:not(.hidden)', 10000)
  check('回收页出来了', sellUp)

  const bar = await page.evaluate(() => {
    const btn = document.querySelector('#rcVoucher')
    return {
      present: !!btn,
      hidden: btn ? btn.classList.contains('hidden') : true,
      text: (btn?.textContent ?? '').trim(),
      tip: (document.querySelector('#rcTip')?.textContent ?? '').trim(),
    }
  })
  // 按钮**不 disabled** 是有意为之（0 币时给一句引导），所以这里判「在不在、有没有 ×N」
  check('「换成兑换券」按钮在（manifest 的 voucherPerCoin 生效了）', bar.present && !bar.hidden, JSON.stringify(bar))
  check(`按钮上写着要换 ${coinsAfterPlay} 个币`, bar.text.includes(`×${coinsAfterPlay}`), bar.text)

  const redeemClicked = await clickSel('#rcVoucher')
  check('点了「换成兑换券」', redeemClicked)

  const gotVouchers = await page
    .waitForFunction((want) => window.__kqf__.getState().harvestBalance === want, { timeout: 20000 }, vouchersBefore + coinsAfterPlay)
    .then(() => true, () => false)
  const after = await snap()
  check(
    `★ 兑换券 +${coinsAfterPlay}（${vouchersBefore} → ${after.vouchers}）—— 宿主按 manifest 的汇率发的`,
    gotVouchers,
    `${vouchersBefore} → ${after.vouchers}`,
  )
  const coinsNow = await page.evaluate(() => window.__debug?.coins ?? -1)
  check('★ 币被烧掉了（不能既留币又得券）', coinsNow === 0, `${coinsNow} 个`)
}

/* ============================================================
   ⑤ 切走切回：卸载必须真的跑（v3 契约的核心）
   ============================================================ */
console.log('\n【⑤ 切走 → 切回】')
{
  const beforeSwitch = await snap()

  check('切到「任务」那一格', await clickSel('[data-tour="tab-tasks"]'))
  const hostGone = await waitGone(`[data-plugin-host="${GAME_ID}"]`, 10000)
  check('宿主容器被收走了', hostGone)

  /*
   * ★★ 这一条是整份脚本里最值钱的断言。
   *
   * `window.__debug` 只在插件挂载期间存在，`destroy()` 里会把它删掉。
   * 所以「切走之后它还在」= **卸载函数根本没被调用** —— 也就是 v3 之前那个 bug：
   * `mount` 返回 Promise，宿主 `typeof r !== 'function'`，于是拿了个空函数，
   * 纹理 / 物理 world / 定时器 / `<style>` 全留在页面里。
   * 而那个 bug 在**假宿主测试里永远是绿的**（测试自己 await 了 mount）。
   */
  const destroyed = await page.evaluate(() => typeof window.__debug === 'undefined')
  check('★★ 卸载真的跑了（`window.__debug` 消失了）', destroyed)

  const styleGone = await page.evaluate(
    () => ![...document.head.querySelectorAll('style')].some((s) => (s.textContent ?? '').includes('.pp-root')),
  )
  check('★★ 插件塞进 `<head>` 的样式表也被移除了（不残留未分层的 CSS）', styleGone)

  check('切到「奖品园」那一格（回来）', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const hostBack = await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000)
  check('容器又开出来了', hostBack)
  const again = await page
    .waitForFunction(() => window.__gpPlayable === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('第二次挂载也起来了', again)

  const shape = await page.evaluate((id) => {
    const box = document.querySelector(`[data-plugin-host="${id}"]`)
    return {
      roots: box?.querySelectorAll('.pp-root').length ?? 0,
      canvases: box?.querySelectorAll('canvas').length ?? 0,
      styles: [...document.head.querySelectorAll('style')].filter((s) => (s.textContent ?? '').includes('.pp-root')).length,
    }
  }, GAME_ID)
  check('还是只有一个根节点（没有「跑两遍」）', shape.roots === 1, `roots=${shape.roots}`)
  check('还是只有一个 canvas（WebGL context 没泄漏）', shape.canvases === 1, `canvas=${shape.canvases}`)
  check('样式表也只有一份', shape.styles === 1, `${shape.styles} 份`)

  const afterSwitch = await snap()
  check(
    '兑换券余额没变（券在账本里，不随挂载走）',
    afterSwitch.vouchers === beforeSwitch.vouchers,
    `${beforeSwitch.vouchers} → ${afterSwitch.vouchers}`,
  )
  const coinsNow = await page.evaluate(() => window.__debug?.coins ?? -1)
  check('游戏币仍是 0（换券之后不该「长回来」）', coinsNow === 0, `${coinsNow} 个`)

  // 图真的解码了。宿主里的 `assetBase` 一旦接错，卡片就是**一片空白**，
  // 而功能断言（点得动、进得去）全绿 —— 假宿主测不到这条，因为它的 assetBase 是写死的。
  const imgs = await page
    .waitForFunction(
      (id) => {
        const box = document.querySelector(`[data-plugin-host="${id}"]`)
        const all = [...box.querySelectorAll('#mGrid .mcell .img img')]
        return all.length > 0 && all.every((i) => i.complete && i.naturalWidth > 0)
      },
      { timeout: 20000 },
      GAME_ID,
    )
    .then(() => true, () => false)
  if (!imgs) {
    const bad = await page.evaluate((id) => {
      const box = document.querySelector(`[data-plugin-host="${id}"]`)
      return [...box.querySelectorAll('#mGrid .mcell .img img')]
        .map((i) => `${i.getAttribute('src')} → ${i.complete ? i.naturalWidth : 'pending'}`)
        .slice(0, 4)
    }, GAME_ID)
    console.log(`    ↳ 失败的图：${bad.join(' | ') || '(一个 img 都没有)'}`)
  }
  check('★ 机台卡片上的奖品图全部解码成功（宿主给的 assetBase 是对的）', imgs)

  await page.screenshot({ path: join(OUT, `${VIEWPORT}-plugin-local.png`) })
}

/* ============================================================
   ⑥ 卸载：包 + 存档都要清掉
   ============================================================ */
console.log('\n【⑥ 卸载】')
{
  const err = await openGameSettings()
  check('又打开了「设置 → 游戏」', err === null, err ?? '')

  check('点了「卸载」', await clickSel(`[data-plugin-uninstall="${GAME_ID}"]`))
  await wait(400)
  // 二次确认：卸载会连存档一起删，所以故意要点两下
  check('点了「确认卸载」', await clickSel(`[data-plugin-uninstall-confirm="${GAME_ID}"]`))
  await wait(900)

  const after = await snap()
  check('已安装清单里没有了', !after.installed.includes(GAME_ID), after.installed.join(',') || '(空)')
  check('当前游戏回落到农场（否则底栏会指向一个不存在的游戏）', after.active === 'farm', after.active)
  check('★ `gameKv` 里一条 prizepark 的行都不剩（存档也清了）', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
  check('「随 App 附带」那一行又变回可安装', await waitFor(`[data-local-install="${GAME_ID}"]`, 5000))

  await leaveSettings()
  await waitForApp(page)
  check('底部「奖品园」那一格没了', !(await page.$(`[data-tour="tab-${GAME_ID}"]`)))

  /* 刷新之后仍然「没装」—— 证明清的是库，不是内存 */
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 })
  await waitForApp(page)
  await page.waitForFunction(() => !!window.__kqf__, { timeout: 20000 })
  const reloaded = await snap()
  check('★★ 刷新后仍然没装（清的是库，不是内存）', !reloaded.installed.includes(GAME_ID), reloaded.installed.join(',') || '(空)')
  check('刷新后 App 正常起来（卸载没把库写坏）', reloaded.active === 'farm', reloaded.active)
  check('刷新后兑换券还在（卸载游戏不该动 App 的账）', reloaded.vouchers === vouchersBefore + coinsAfterPlay, `${reloaded.vouchers}`)
}

/* ============================================================
   ⑦ 收尾：没有未捕获异常
   ============================================================ */
console.log('\n【⑦ 全程异常】')
/*
 * ⚠️ 这里**只报不看**的 console.error 要滤掉一批已知噪音：
 * 排行榜 / 音效系统在没有宿主后端时会打 404 的 console 报错（这是抓来的包
 * 自己的降级路径，不是宿主接线问题）。把它算进失败会让这条断言永远红，
 * 而红久了就没人看了 —— 那比不写还糟。
 */
const NOISE = /sound|audio|ranking|topScores|404|Failed to load resource/i
const realErrors = consoleErrors.filter((t) => !NOISE.test(t))
check('没有未捕获的页面异常', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))
check('没有真正的 console 报错', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

await browser.close()

console.log(failed === 0 ? '\n✅ 本地包接入：全部通过\n' : `\n❌ 有 ${failed} 条没过\n`)
console.log(`走查图：${join(OUT, `${VIEWPORT}-plugin-local.png`)}`)
process.exit(failed === 0 ? 0 : 1)
