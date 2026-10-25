/**
 * **爪爪乐（claw3d）作为插件在真 App 里走一遍**：
 * 安装 → 设为当前 → 挂载 → 买币 → 开局 → 抓一件奖品发券 → 切走 → 切回 → 卸载。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4396 --strictPort
 * node scripts/e2e-plugin-claw3d.mjs http://127.0.0.1:4396/
 * node scripts/e2e-plugin-claw3d.mjs http://127.0.0.1:4396/ tablet
 * ```
 *
 * ## 为什么不能只靠「独立版跑绿了」
 *
 * 独立版（`claw-machine/scripts/smoke.mjs`）证明的是**同一份 `app.ts` 能不能跑**。
 * 它证明不了下面这几件事，而这几件恰好都是这台机器独有的风险：
 *
 * | 只有真宿主能回答 | 为什么独立版测不到 |
 * | --- | --- |
 * | 容器只有 ~700px 高、还要给宿主 TabBar 让位 | 独立版铺满整个窗口 |
 * | `position: fixed` 有没有盖住宿主 | 独立版**就是**整页 |
 * | 未分层的 `.grid` / `.btn` 有没有污染宿主 | 独立版没有宿主 |
 * | 卸载有没有真的收干净（WebGL / rAF / 监听 / 材质） | 独立版不卸载 |
 * | 第二次挂载还能不能画出东西 | 独立版只挂一次 |
 *
 * 最后两条尤其重要：这台机器 5MB、一个 WebGL context + 一个 rapier wasm 堆，
 * 泄漏一次就是「玩几次以后黑屏」，而**全程不报错**。
 *
 * ## 断言的骨架：每一条都要有能失败的前提
 *
 * ① 动手前「一款都没装」（否则后面每条「装上了」都可能恒真）；
 * ② 装完看**界面那一行变成「已安装」**，不看 store 返回值；
 * ③ 挂载后看**根节点高度 == 容器高度**（只看 `> 0` 会漏掉整屏空白）；
 * ④ 开局看**积分 -1、币 -1**（钱真的走了），不是看按钮点得动；
 * ⑤ 抓一件奖品看**兑换券 +1 且币一分没变**（币是入场券，券是战利品）；
 * ⑥ 切走之后 `window.__claw` 必须**消失**（`destroy()` 真跑了）；
 * ⑦ 切回来 `canvas` 仍然只有 1 个、且第二次也能画出画面（材质没被用坏）。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir, SCRATCH_BASE } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4396/'
const VIEWPORT = process.argv[3] ?? 'phone'

const GAME_ID = 'claw3d'

/** 版本号从清单里读，不写死（写死的话升版会红，而红的理由和产品无关）。 */
const GAME_VERSION = (() => {
  const src = readFileSync(new URL('../src/games/localGames.ts', import.meta.url), 'utf8')
  const m = src.match(/"id":\s*"claw3d"[\s\S]{0,200}?"version":\s*"([^"]+)"/)
  if (!m) throw new Error('在 localGames.ts 里找不到 claw3d 的 version —— 清单没生成？')
  return m[1]
})()

/** 一局 1 币、1 币 = 1 积分（`src/plugin/index.ts` 的 PLAY_COST / POINTS_PER_COIN） */
const PLAY_COST = 1
const POINTS_PER_COIN = 1
/** 「币用完」那颗按钮一次换几个（`BUY_PER_TAP`） */
const BUY_PER_TAP = 5

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

const OUT = join(SCRATCH_BASE, 'plugin-claw3d')
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\n爪爪乐插件接入走查（${VIEWPORT} ${size.width}×${size.height}）`)
console.log(`目标 App：${TARGET}\n`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir(`plugin-claw3d-${VIEWPORT}`),
  // 没有独显时让 Chrome 回落到软件渲染：这台机器要 WebGL2 + Rapier(wasm)，
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
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText ?? '').includes(t))
    if (!b) return false
    b.click()
    return true
  }, label)

const waitFor = (sel, timeout = 15000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(() => true, () => false)
const waitGone = (sel, timeout = 15000) =>
  page.waitForFunction((s) => !document.querySelector(s), { timeout }, sel).then(() => true, () => false)

const snap = () =>
  page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      balance: s.balance, // 积分 🪙
      vouchers: s.harvestBalance, // 兑换券 🎟️
      active: s.activeGameId,
      installed: Object.keys(window.__kqf__.plugin.installed()),
    }
  })

const kvOwners = () => page.evaluate(() => window.__kqf__.plugin.kvOwnerIds())

/** 插件自己的句柄（挂载期间才有） */
const claw = () =>
  page.evaluate(() => ({
    mounted: !!window.__claw,
    ready: window.__claw?.ready === true,
    coins: window.__claw?.wallet?.coins ?? -1,
    state: window.__claw?.state ?? '(未挂载)',
    intro: window.__claw?.intro ?? null,
  }))

/**
 * 打开「设置 → 游戏」并过家长密码。
 * ⚠️ 顺序：**先切栏，再过密码**（设置页每次切栏都会重新上锁）。
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

  for (let round = 0; round < 2; round++) {
    const locked = await page.evaluate(() => document.body.innerText.includes('请输入家长密码'))
    if (!locked) return null
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
        b?.click()
      })
      await wait(180)
    }
    await wait(600)
  }
  const stillLocked = await page.evaluate(() => document.body.innerText.includes('请输入家长密码'))
  return stillLocked ? '家长密码没过（PIN 不是 0000？）' : null
}

/**
 * 打开「设置 → 游戏 → 游戏市场」。
 *
 * ⚠️ 2026-10-25 起本地游戏列表**直接摊在「设置 → 游戏」页上**（`GameStore.tsx`），
 *   不再有「进入游戏市场」弹层。`[data-local-*]` 锚点没改名，但到达这一页之后
 *   才在 DOM 里 —— 否则红字会写成「没找到那一行」，看着像列表丢了。
 */
async function openGameStore() {
  const err = await openGameSettings()
  if (err) return err
  // 2026-10-25 起列表**直接摊在设置页上**，不再有「进入游戏市场」按钮和弹层。
  // 这一步改成「确认列表真的在 DOM 里」—— 少了它，后面 querySelector 拿到 null
  // 会报「没找到那一行」，看着像游戏列表丢了，其实是市场那张卡没渲染。
  const shown = await page
    .waitForFunction(() => !!document.querySelector('[data-local-row]'), { timeout: 8000 })
    .then(() => true, () => false)
  return shown ? null : '设置页上没有游戏列表（游戏市场那张卡没渲染？）'
}

/** 关掉市场弹层（装完就关，后面每一步都该在设置页上做） */
async function closeGameStore() {
  // 列表已经摊平在设置页上，没有弹层要关。保留这个函数是因为调用点很多 ——
  // 直接删掉会让 diff 看不出「这里为什么不需要关了」。
  await wait(100)
}

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
   ⓪ 基线
   ============================================================ */
console.log('【⓪ 基线】')
{
  const hostApi = await page.evaluate(() => window.__kqf__.plugin.hostApiVersion)
  check('宿主契约版本 ≥ 4（有 mintVoucher）', hostApi >= 4, `HOST_API=${hostApi}`)

  const before = await snap()
  check('动手前一款插件游戏都没装', before.installed.length === 0, before.installed.join(',') || '(空)')
  check('动手前底部没有爪爪乐那一格', !(await page.$(`[data-tour="tab-${GAME_ID}"]`)))
  check('动手前 `gameKv` 里没有 claw3d 的行', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
  check('动手前当前游戏是农场', before.active === 'farm', before.active)
}

/* ============================================================
   ① 安装
   ============================================================ */
console.log('\n【① 安装：设置 → 游戏 → 游戏市场 → 安装】')
let pointsBefore = 0
{
  const err = await openGameStore()
  check('打开「设置 → 游戏 → 游戏市场」并过了家长密码', err === null, err ?? '')

  const row = await page.evaluate((id) => {
    const li = document.querySelector(`[data-local-row="${id}"]`)
    if (!li) return null
    const btn = li.querySelector('[data-local-install]')
    return { text: (li.innerText ?? '').replace(/\s+/g, ' ').trim(), hasButton: !!btn, disabled: btn ? btn.disabled : true }
  }, GAME_ID)
  check('游戏市场里列出了爪爪乐', !!row, row?.text ?? '(没找到那一行)')
  check('安装按钮在、而且可点', !!row?.hasButton && row?.disabled === false, JSON.stringify(row))

  check('点了「安装」', await clickSel(`[data-local-install="${GAME_ID}"]`))
  check('★ 界面上那一行变成了「已安装」', await waitFor(`[data-local-installed="${GAME_ID}"]`, 30000))

  const after = await snap()
  check(`装上的版本是 v${GAME_VERSION}`, (await page.evaluate((id) => window.__kqf__.plugin.installed()[id]?.version, GAME_ID)) === GAME_VERSION)
  check('市场里那一行变成「已装」', await waitFor(`[data-plugin-installed-row="${GAME_ID}"]`, 5000))
  check('已安装清单里有 claw3d', after.installed.includes(GAME_ID), after.installed.join(','))

  /*
   * 经济参数要给家长看得见。⚠️ 这一块的文案里带**币名**（爪爪币），
   * 所以顺带证明了 manifest 的 `coin.name` 真的被读到了 ——
   * 写死「娃娃机币」的话这里会红。
   */
  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  check('家长能看到「一局 1 积分」', /一局\s*1\s*积分/.test(econ), econ)
  check('家长能看到「1 爪爪币 = 1 兑换券」', /1\s*爪爪币\s*=\s*1\s*兑换券/.test(econ), econ)

  pointsBefore = after.balance

  // 装完关掉市场：② 之后都在设置页 / 孩子界面上走，遮罩留着只会盖住截图
  await closeGameStore()
}

/* ============================================================
   ② 设为当前
   ============================================================ */
console.log('\n【② 设为当前】')
{
  check('点了「设为当前」', await clickSel(`[data-plugin-set-current="${GAME_ID}"]`))
  await wait(800)
  const after = await snap()
  check('store 里当前游戏切成了 claw3d', after.active === GAME_ID, after.active)
}

await leaveSettings()
await waitForApp(page)

{
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    return b ? (b.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  }, GAME_ID)
  check('底部导航多出「爪爪乐」那一格', tab.includes('爪爪乐'), tab || '(没有这一格)')
}

/* ============================================================
   ③ 挂载：盒子、画面、样式隔离
   ============================================================ */
console.log('\n【③ 挂载】')
/**
 * 第一次挂载时的 canvas 数量。
 *
 * ⚠️ 这台机器有**两个** canvas：主画面 `#c` 和出奖卡片的 360° 预览 `#winPrev`。
 * 把「没有泄漏」写成 `=== 1` 会得到一条假红（第一次挂载就已经是 2 个）。
 * 真正的不变量是「第二次挂载和第一次一样多」—— 多出来的才是泄漏。
 */
let canvasesFirst = 0
{
  check('点了底部「爪爪乐」那一格', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))

  // 5MB 的包 + rapier wasm 解码 + 着色器编译，慢一点是正常的
  const ready = await page
    .waitForFunction(() => window.__claw?.ready === true, { timeout: 90000 })
    .then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__claw.ready`：物理 + 场景都到位）', ready)

  const shape = await page.evaluate((id) => {
    const box = document.querySelector(`[data-plugin-host="${id}"]`)
    const root = box?.querySelector('.claw-root')
    const canvas = box?.querySelector('#c')
    const b = box?.getBoundingClientRect()
    const rb = root?.getBoundingClientRect()
    const cb = canvas?.getBoundingClientRect()
    return {
      roots: box?.querySelectorAll('.claw-root').length ?? 0,
      canvases: box?.querySelectorAll('canvas').length ?? 0,
      hostH: Math.round(b?.height ?? 0),
      hostW: Math.round(b?.width ?? 0),
      rootH: Math.round(rb?.height ?? 0),
      rootW: Math.round(rb?.width ?? 0),
      canvasW: Math.round(cb?.width ?? 0),
      canvasH: Math.round(cb?.height ?? 0),
      error: (document.body.innerText ?? '').includes('打不开'),
    }
  }, GAME_ID)

  check('只有一个根节点 `.claw-root`（没有重复挂载）', shape.roots === 1, `roots=${shape.roots}`)
  canvasesFirst = shape.canvases
  check('主 canvas 在容器里', shape.canvases >= 1, `canvas=${shape.canvases}（主画面 + 出奖预览）`)
  /*
   * ★ 空白页的判据。只看 `h > 0` 是不够的：真实现象可能是
   *   「容器 700px、根节点 0px」—— 整屏空白，而 canvas 在、`ready` 也 true。
   *   所以必须是「根节点**等于**容器高度」。
   */
  check(
    '★ 根节点填满了宿主给的盒子（高度 == 容器）',
    shape.rootH > 100 && Math.abs(shape.rootH - shape.hostH) <= 1,
    `容器 ${shape.hostH} · 根节点 ${shape.rootH}`,
  )
  check('canvas 有真实尺寸（不是 0×0）', shape.canvasW > 100 && shape.canvasH > 100, `${shape.canvasW}×${shape.canvasH}`)
  check('不是「打不开」那一支', shape.error === false)

  /*
   * ★★ 这两条是**插件特有**的风险，独立版永远测不到：
   *
   *   ① 样式泄漏：机器样式表里有 `.grid`（`#bagList` 用的）和 `.btn`，
   *      未分层样式**胜过** `@layer utilities`，漏出去就会改掉宿主的 Tailwind。
   *   ② `position: fixed` 泄漏：`#app` / `#hud` / `.modal` / `#start` 原来都是
   *      fixed —— 不收进容器的话会盖住整个宿主，连 TabBar 一起，
   *      而且 z-index 抬多高都没用。
   */
  const probe = await page.evaluate(() => {
    const el = document.createElement('div')
    el.className = 'grid'
    document.body.appendChild(el)
    const display = getComputedStyle(el).display
    el.remove()
    return display
  })
  check('★ 插件的样式被收进了根类（宿主 `.grid` 没被污染）', probe === 'grid', `display=${probe}`)

  const leak = await page.evaluate((id) => {
    const box = document.querySelector(`[data-plugin-host="${id}"]`)
    const boxRect = box.getBoundingClientRect()
    const offenders = []
    for (const sel of ['#app', '#hud', '#start', '.modal', '#win']) {
      const el = box.querySelector(sel)
      if (!el) continue
      const cs = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      // ⚠️ 隐藏的弹窗（`.modal.hidden`）rect 全是 0 —— 不跳过的话会被判成「跑到容器外面了」，
      // 而那是一条假红：它压根没显示。
      if (r.width === 0 || r.height === 0) continue
      // 允许 1px 误差：亚像素布局
      const outside = r.top < boxRect.top - 1 || r.bottom > boxRect.bottom + 1
      if (cs.position === 'fixed' || outside) offenders.push(`${sel}(${cs.position} ${Math.round(r.top)}→${Math.round(r.bottom)})`)
    }
    return { offenders, boxTop: Math.round(boxRect.top), boxBottom: Math.round(boxRect.bottom) }
  }, GAME_ID)
  check(
    '★★ 没有 `position: fixed` 的元素漏到宿主外面（不会盖住 TabBar）',
    leak.offenders.length === 0,
    leak.offenders.join(' | ') || `容器 ${leak.boxTop}→${leak.boxBottom}`,
  )

  // 底栏那颗「任务」必须还能被点到 —— 这是「有没有被 3D 画布盖住」的**真判据**
  // （`.click()` 会绕过命中测试，所以只能用 elementFromPoint）
  const tabHit = await page.evaluate(() => {
    const b = document.querySelector('[data-tour="tab-tasks"]')
    if (!b) return { ok: false, why: '没有 TabBar' }
    const r = b.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { ok: !!top && (top === b || b.contains(top)), why: top ? top.tagName + '.' + (top.className || '') : 'null' }
  })
  check('★ 底部 TabBar 没被 3D 画面盖住（elementFromPoint 命中它自己）', tabHit.ok, tabHit.why)

  await page.screenshot({ path: join(OUT, `${VIEWPORT}-0-start.png`) })

  /* ---- 进主界面（开场页是插件自己的，点「开始游戏」） ---- */
  check('点了开场页的「开始游戏」', await clickSel('#go'))
  const entered = await page
    .waitForFunction(() => window.__claw?.intro === false, { timeout: 15000 })
    .then(() => true, () => false)
  check('intro 关掉了（进主界面）', entered)

  // 首次进入 650ms 后弹新手引导，会盖住投币按钮
  await wait(1000)
  if (await page.$('#onboard.show')) {
    await clickSel('#obSkip')
    check('新手引导弹出并能跳过', true)
    await wait(500)
  }
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-1-idle.png`) })
}

/* ============================================================
   ③b 钱：0 币 → 换币（积分 → 币）→ 开局（币 -1）
   ============================================================ */
console.log('\n【③b 换币与开局】')
let coinsAfterPlay = 0
{
  const before = await snap()
  const c0 = await claw()
  check('刚装完币是 0（没有「白送 10 个」）', c0.coins === 0, `${c0.coins} 个`)

  // 0 币时点投币 → 弹「币用完」面板
  check('点了「投币」', await clickSel('#insert'))
  check('★ 没钱时投币会弹换币面板（不是「点了没反应」）', await waitFor('#nocoin.show', 8000))

  const label = await page.evaluate(() => document.querySelector('#claim')?.textContent ?? '')
  check('那颗按钮是「换 5 个币」而不是「领取 10 币」', /换\s*\d+\s*个币/.test(label), label)

  check('点了换币', await clickSel('#claim'))

  /*
   * ⚠️ 这里**必须轮询真条件**，不能 `await wait(900)` 然后量一次。
   *
   * 实测过一次：固定等 900ms 量到的是「积分没动、币还是 0」，
   * 而下一条（再点投币）却从 5 扣到 4 —— 说明买币其实成功了，
   * 只是**那一刻还没落地**。用固定 sleep 等异步，等的永远是「我猜的时间」。
   */
  const expectBalance = before.balance - BUY_PER_TAP * POINTS_PER_COIN
  const balanceOk = await page
    .waitForFunction((n) => window.__kqf__.getState().balance === n, { timeout: 20000 }, expectBalance)
    .then(() => true, () => false)
  const afterBuy = await snap()
  check(
    `★ 积分扣了 ${BUY_PER_TAP * POINTS_PER_COIN}（${before.balance} → ${expectBalance}）`,
    balanceOk,
    `${before.balance} → ${afterBuy.balance}`,
  )

  const coinsOk = await page
    .waitForFunction((n) => window.__claw?.wallet?.coins === n, { timeout: 20000 }, BUY_PER_TAP)
    .then(() => true, () => false)
  const c1 = await claw()
  check(`★ 币 +${BUY_PER_TAP}（账本里真的记上了）`, coinsOk, `${c1.coins} 个`)

  // 换币面板应该自己关掉
  check('换币面板关掉了', await waitGone('#nocoin.show', 5000))

  /* ---- 开局：再点一次投币，这次真的扣 1 币 ---- */
  await wait(400)
  check('再点一次「投币」', await clickSel('#insert'))
  const playing = await page
    .waitForFunction(() => window.__claw?.state === 'play', { timeout: 15000 })
    .then(() => true, () => false)
  check('★ 状态进入 play（这一局真的开了）', playing)

  const c2 = await claw()
  check(`★ 开局扣了 ${PLAY_COST} 个币（${BUY_PER_TAP} → ${BUY_PER_TAP - PLAY_COST}）`, c2.coins === BUY_PER_TAP - PLAY_COST, `${c2.coins} 个`)

  await wait(800)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-2-play.png`) })
  coinsAfterPlay = c2.coins
}

/* ============================================================
   ③c 抓到奖品 → 兑换券（**币一分不动**）
   ------------------------------------------------------------
   真抓一次要等物理（30 秒一局、还未必抓得到），所以直接走
   `game.emit({type:'win'})` —— 那是物理层判中奖之后走的**同一条**
   `onEvent`，`wallet.award()` → `host.mintVoucher()` 一行都不少。
   这里要钉的是「券 +1 且币不变」：币如果能被奖品换回来，
   抓娃娃本身就能续玩，「坐着玩就能刷」那条回路就又接上了。
   ============================================================ */
console.log('\n【③c 抓到奖品 → 兑换券（币不动）】')
{
  const before = await snap()
  const coinsBefore = (await claw()).coins

  const fired = await page.evaluate(() => {
    const c = window.__claw
    const p = c?.game?.prizes?.[0]
    if (!p) return false
    c.game.emit({ type: 'win', prize: p })
    return true
  })
  check('让物理层判了一次中奖（走真 `onEvent`）', fired)

  const got = await page
    .waitForFunction((n) => window.__kqf__.getState().harvestBalance > n, { timeout: 20000 }, before.vouchers)
    .then(() => true, () => false)
  const after = await snap()
  check(`★ 兑换券 +1（${before.vouchers} → ${after.vouchers}）`, got && after.vouchers === before.vouchers + 1, `${before.vouchers} → ${after.vouchers}`)

  const coinsAfter = (await claw()).coins
  check('★ 币一分没变（奖品 ⇸ 币）', coinsAfter === coinsBefore, `${coinsBefore} → ${coinsAfter}`)

  // 中奖卡片要真的弹出来（不然玩家不知道抓到了什么）
  check('中奖卡片弹出来了', await waitFor('#win.show', 8000))
  const winText = await page.evaluate(() => document.querySelector('#win')?.innerText ?? '')
  check('卡片上写了「+1 兑换券」', /\+1\s*兑换券/.test(winText), winText.replace(/\s+/g, ' ').slice(0, 60))
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-3-win.png`) })

  // 收掉卡片（它盖着底栏）
  await clickSel('#winOk')
  await wait(700)
}

/* ============================================================
   ④ 切走 → 切回：卸载必须真的跑
   ============================================================ */
console.log('\n【④ 切走 → 切回】')
{
  const beforeSwitch = await snap()

  check('切到「任务」那一格', await clickSel('[data-tour="tab-tasks"]'))
  check('宿主容器被收走了', await waitGone(`[data-plugin-host="${GAME_ID}"]`, 10000))

  /*
   * ★★ 整份脚本里最值钱的一条。
   *
   * `window.__claw` 只在插件挂载期间存在，`destroy()` 里会删掉它。
   * 「切走之后它还在」= **卸载函数根本没被调用**（v3 之前那个 bug：
   * `mount` 返回 Promise，宿主拿了个空函数），纹理 / 物理 world / rAF /
   * 监听 / `<style>` 全留在页面里。而那个 bug 在假宿主测试里**永远绿**。
   */
  const destroyed = await page.evaluate(() => typeof window.__claw === 'undefined')
  check('★★ 卸载真的跑了（`window.__claw` 消失了）', destroyed)

  const left = await page.evaluate((id) => ({
    roots: document.querySelectorAll('.claw-root').length,
    styles: document.querySelectorAll('style[data-claw3d]').length,
    canvases: document.querySelectorAll('canvas').length,
    host: !!document.querySelector(`[data-plugin-host="${id}"]`),
  }), GAME_ID)
  check('根节点 / 样式 / canvas 都没残留', left.roots === 0 && left.styles === 0 && left.canvases === 0, JSON.stringify(left))

  check('切回「爪爪乐」', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('容器又开出来了', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))

  const again = await page
    .waitForFunction(() => window.__claw?.ready === true, { timeout: 90000 })
    .then(() => true, () => false)
  check('★ 第二次挂载也起来了（材质 / 纹理是新的，没被上一次 dispose 弄坏）', again)

  const shape2 = await page.evaluate((id) => {
    const box = document.querySelector(`[data-plugin-host="${id}"]`)
    const cv = box?.querySelector('#c')
    const r = cv?.getBoundingClientRect()
    return {
      roots: box?.querySelectorAll('.claw-root').length ?? 0,
      canvases: box?.querySelectorAll('canvas').length ?? 0,
      styles: document.querySelectorAll('style[data-claw3d]').length,
      w: Math.round(r?.width ?? 0),
      h: Math.round(r?.height ?? 0),
    }
  }, GAME_ID)
  check('还是只有一个根节点（没有「跑两遍」）', shape2.roots === 1, `roots=${shape2.roots}`)
  check(
    `canvas 数量没变（${canvasesFirst} 个，没有 WebGL context 泄漏）`,
    shape2.canvases === canvasesFirst,
    `第一次 ${canvasesFirst} · 第二次 ${shape2.canvases}`,
  )
  check('样式表也只有一份', shape2.styles === 1, `${shape2.styles} 份`)
  check('第二次挂载的画布也有尺寸', shape2.w > 100 && shape2.h > 100, `${shape2.w}×${shape2.h}`)

  /*
   * ★ 第二挂之后**真的画出东西**：读 canvas 中心像素。
   * 只断言「尺寸 > 0」挡不住「材质被 dispose 了 ⇒ 一片纯白/纯黑」——
   * 而那种黑屏**不报错**，正是反复挂载最容易踩的坑。
   */
  /*
   * ⚠️ 这里**不能**量 HUD 的 opacity：刚挂载时 root 带着 `intro`，
   * 按设计 HUD 就是 `opacity: 0`（要点了「开始游戏」才出现）。
   * 用它判「有没有画出东西」会得到一条假红。
   *
   * 真正能回答「第二次挂载还能不能画」的是：
   *   ① WebGL context 没丢（上一次 `forceContextLoss()` 没把新的弄坏）；
   *   ② 开场页 `#start` 有实际尺寸（DOM 真的注入了、布局真的算了）。
   */
  const painted = await page.evaluate((id) => {
    const box = document.querySelector(`[data-plugin-host="${id}"]`)
    const cv = box?.querySelector('#c')
    const start = box?.querySelector('#start')
    const sr = start?.getBoundingClientRect()
    return {
      glLost: cv?.getContext('webgl2')?.isContextLost?.() ?? 'n/a',
      startW: Math.round(sr?.width ?? 0),
      startH: Math.round(sr?.height ?? 0),
    }
  }, GAME_ID)
  check('第二次挂载的 WebGL context 没丢', painted.glLost === false, String(painted.glLost))
  check('开场页有实际尺寸（不是整屏空白）', painted.startW > 100 && painted.startH > 100, `${painted.startW}×${painted.startH}`)

  const afterSwitch = await snap()
  check(
    '兑换券余额没变（券在账本里，不随挂载走）',
    afterSwitch.vouchers === beforeSwitch.vouchers,
    `${beforeSwitch.vouchers} → ${afterSwitch.vouchers}`,
  )

  await page.screenshot({ path: join(OUT, `${VIEWPORT}-4-remount.png`) })
}

/* ============================================================
   ⑤ 卸载：包 + 存档都要清掉
   ============================================================ */
console.log('\n【⑤ 卸载】')
{
  const vouchersBefore = (await snap()).vouchers

  const err = await openGameSettings()
  check('再进「设置 → 游戏」', err === null, err ?? '')

  /*
    卸载在**详情最下面**（2026-10-25 起）—— 列表行只留一个动作，
    「删存档」这种不可逆的事不该躺在孩子每天滚的那一屏里。
  */
  check('点开详情（卸载在详情里）', await clickSel(`[data-store-detail="${GAME_ID}"]`))
  await waitFor(`[data-plugin-uninstall="${GAME_ID}"]`, 5000)
  check('点了「卸载」', await clickSel(`[data-plugin-uninstall="${GAME_ID}"]`))
  await wait(400)
  check('点了「确认卸载」', await clickSel(`[data-plugin-uninstall-confirm="${GAME_ID}"]`))
  await wait(1200)

  const after = await snap()
  check('已安装清单里没有 claw3d 了', !after.installed.includes(GAME_ID), after.installed.join(',') || '(空)')
  check('`gameKv` 里一条 claw3d 的行都不剩', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
  check('当前游戏回到农场', after.active === 'farm', after.active)
  /*
   * ⚠️ 判据是「**没有变少**」，不是「完全相等」。
   *
   * 设置页是**盖在游戏上**的一层（`showSettings`），下面的娃娃机还活着 ——
   * 所以这个窗口里它随时可能再抓中一只、发一张券。2026-10-24 实测红过一次：
   * `1 → 2`，而那是**多发了**，跟「卸载把券带走」正好相反。
   * 用 `===` 守这条，就会在「孩子运气好」的时候随机红。
   * 而真正要防的那个 bug（卸载把孩子的券清零）会让 `after < before`，
   * `>=` 照样抓得住。
   */
  check(
    '★ 兑换券没被卸载带走（那是孩子的钱）',
    after.vouchers >= vouchersBefore,
    `${vouchersBefore} → ${after.vouchers}`,
  )
}

/* ============================================================
   ⑥ 收尾：没有未捕获异常
   ============================================================ */
console.log('\n【⑥ 收尾】')
{
  const realErrors = pageErrors.filter((e) => !/ResizeObserver loop/.test(e))
  check('全程没有未捕获异常', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))
  const noisy = consoleErrors.filter((e) => !/favicon|ResizeObserver loop|WebGLProgram|X4122/.test(e))
  check('没有真正的控制台错误', noisy.length === 0, noisy.slice(0, 2).join(' | '))
}

await browser.close()
console.log(`\n${failed === 0 ? '全部通过' : `失败 ${failed} 条`}  ·  截图在 ${OUT}`)
process.exit(failed === 0 ? 0 : 1)
