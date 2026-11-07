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
 * ② 装完不是看返回值，而是看**界面上那一行变成已装**（返回值对、界面没变 = 没接上）；
 * ③ 玩一局不是看按钮点得动，而是看**积分 -5、币 +5**（钱真的走了）；
 * ④ 换券不是看提示文字，而是看**兑换券余额 +4**（券真的进了账本）；
 * ⑤ 切走之后 `window.__debug` 必须**消失**（destroy 真跑了）—— 这条只有真宿主能给；
 * ⑥ 卸载之后 `gameKv` 里**一条 prizepark 的行都不许剩**（否则重装会捡到旧存档）。
 *
 * ## 钱的那条链（本脚本验的就是它）
 *
 * ```
 *   积分 🪙 ──buyGameCoin──▶ 游戏币 🧸 ──spendGameCoin──▶ 一局
 *                                 └────redeemGameCoin──▶ 兑换券 🎟️（剩的币）
 *
 *   奖品 🧸 ──mintVoucher──▶ 兑换券 🎟️        ← **不经过币**（2026-10-23）
 * ```
 *
 * ⚠️ 最后那条边是**单向的**：奖品不许变回币（币能开局 ⇒ 抓娃娃自己续玩）。
 * ③b 段专门验这一点 —— 卖完娃娃币必须**一分没变**。
 *
 * 三段都走**界面**（买币面板 / 开局按钮 / 回收页那颗「换成兑换券」），
 * 不直接调 store —— 直接调只能证明函数在，证明不了「孩子点得到」。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir, SCRATCH_BASE } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { grantGame } from './lib/own.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4393/'
const VIEWPORT = process.argv[3] ?? 'phone'
/** 第 3 个参数指定测哪一款（默认 prizepark = 首款真机包，回归用） */
const GAME_ID = process.argv[4] ?? 'prizepark'
/**
 * 版本号**从清单里读**，不写死。
 *
 * 写死的后果实测过一次：包升到 1.4.0，这里还是 1.3.0 ⇒
 * 「装上的版本是 v1.3.0」这条红，而界面完全正常 —— 红的原因和产品无关。
 * 一条只会因为「忘了改脚本」而红的断言，等于给自己加了个假报警。
 */
const GAME_VERSION = (() => {
  const src = readFileSync(new URL('../src/games/localGames.ts', import.meta.url), 'utf8')
  const m = src.match(new RegExp(`"id":\\s*"${GAME_ID}"[\\s\\S]{0,200}?"version":\\s*"([^"]+)"`))
  if (!m) throw new Error(`在 localGames.ts 里找不到 ${GAME_ID} 的 version —— 清单没生成？`)
  return m[1]
})()
/**
 * 底部导航格上那两个字，**从包里的 manifest 读**，不写死。
 *
 * 2026-10-25 写死过一次（「奖品园」）：家长把游戏改名成「抓奖乐园」、格上
 * 改成了「抓奖」，这一条就红了 —— 界面完全正常，红的原因只是脚本里那三个字
 * 过期了。和上面版本号是同一类假报警。
 *
 * 读不到就**直接退出**（不是跳过）：静默兜底会让这条断言变成恒真。
 */
const TAB_LABEL = (() => {
  const src = readFileSync(
    new URL(`../public/games/${GAME_ID}/${GAME_ID}.plugin.mjs`, import.meta.url),
    'utf8',
  )
  // `{1,5}`：2026-10-26 起导航文案上限是 5 字，写死 3 会让 4~5 字的包解析失败
  const m = src.match(/tabLabel:\s*"([^"]{1,5})"/)
  if (!m) throw new Error('读不到包里的 tabLabel —— 包没打？还是打包格式变了？')
  return m[1]
})()
/** 市场里那一行的名字（从 `storefront.ts` 读，改名不该让断言红） */
const GAME_NAME = (() => {
  const src = readFileSync(new URL('../src/games/storefront.ts', import.meta.url), 'utf8')
  const m = src.match(new RegExp(`id: '${GAME_ID}',\\s*\\n\\s*name: '([^']+)'`))
  if (!m) throw new Error(`在 storefront.ts 里找不到 ${GAME_ID} 的 name`)
  return m[1]
})()

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
  /* 2026-11 起家长密码闸门是「卡片 + 按钮」：先点「爸妈：输密码」才弹数字键盘
     （`ParentPinSheet`）。不点的话下面那 4 次 0 全打在空气里，页面停在那张卡上，
     报错却是「游戏列表没渲染」—— 排查方向整个是错的。 */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /爸妈：输密码/.test(x.textContent ?? ''),
    )
    b?.click()
  })
  /* ★ 必须**等键盘真的出现**再点数字。少了这一句，下面的循环第一轮就会
     因为「页面上没有『请输入家长密码』」直接 break，而 `check('过了家长密码')`
     判的是「没有这几个字」⇒ **假绿**，后面全部红成「列表里没这一行」。 */
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('button')].filter((b) =>
          /^[0-9]$/.test((b.textContent ?? '').trim()),
        ).length >= 8,
      { timeout: 5000 },
    )
    .catch(() => {})
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

/**
 * 只点开市场弹层 —— **已经在「设置 → 游戏」页时用**。
 *
 * ⚠️ 不要在已到达的页面上再调 `openGameStore()`：它会重新点顶栏「设置」和「游戏」，
 *   设置页的这两步不是幂等的（再点一次可能退回上一页），
 *   于是失败会表现成「游戏市场没打开」，而真正的原因是点多了。
 */
async function openStoreSheet() {
  // 2026-10-25 起列表**直接摊在设置页上**，不再有「进入游戏市场」按钮和弹层。
  // 这一步改成「确认列表真的在 DOM 里」—— 少了它，后面 querySelector 拿到 null
  // 会报「没找到那一行」，看着像游戏列表丢了，其实是市场那张卡没渲染。
  const shown = await page
    .waitForFunction(() => !!document.querySelector('[data-local-row]'), { timeout: 8000 })
    .then(() => true, () => false)
  return shown ? null : '设置页上没有游戏列表（游戏市场那张卡没渲染？）'
}

/**
 * 打开「设置 → 游戏 → 游戏市场」。
 *
 * ⚠️ 2026-10-25 起本地游戏列表**直接摊在「设置 → 游戏」页上**（`GameStore.tsx`），
 *   不再有「进入游戏市场」弹层。`[data-local-*]` 锚点没改名，但到达这一页之后
 *   才在 DOM 里 —— 否则 querySelector 拿到 null，红字会写成「没找到那一行」。
 */
async function openGameStore() {
  const err = await openGameSettings()
  if (err) return err
  return openStoreSheet()
}

/** 关掉市场弹层（装完就关，后面每一步都该在设置页上做） */
async function closeGameStore() {
  // 列表已经摊平在设置页上，没有弹层要关。保留这个函数是因为调用点很多 ——
  // 直接删掉会让 diff 看不出「这里为什么不需要关了」。
  await wait(100)
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
  /*
   * 契约版本：**只判「够不够」，不判「等于几」**。
   *
   * 写死 `=== 3` 的后果实测过一次：宿主升到 4（加了 mintVoucher），
   * 这条红，而界面完全正常 —— 红的原因和产品无关，纯属脚本没跟上。
   * 要钉的是「宿主至少得有这个包要的那一代」，那正是 `>=` 的语义；
   * 「包要哪一代」由 `plugin-test.cjs` 拿 manifest 的 minHostApi 去比。
   */
  check('宿主契约版本 ≥ 4（有 mintVoucher / redeemGameCoin / ctx / 异步 mount）', hostApi >= 4, `HOST_API=${hostApi}`)

  const before = await snap()
  check('动手前一款插件游戏都没装', before.installed.length === 0, before.installed.join(',') || '(空)')
  check('动手前底部没有插件游戏那一格', !(await page.$(`[data-tour="tab-${GAME_ID}"]`)))
  check(`动手前 \`gameKv\` 里没有 ${GAME_ID} 的行`, !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
  check('动手前当前游戏是农场', before.active === 'farm', before.active)
}

/* ============================================================
   ① 安装（走家长真实会点的那个按钮）
   ============================================================ */
console.log('\n【① 安装：设置 → 游戏 → 游戏市场 → 安装】')
let pointsBefore = 0
{
  const err = await openGameStore()
  check('打开「设置 → 游戏 → 游戏市场」并过了家长密码', err === null, err ?? '')

  /* 2026-10-30 起「没拥有不能装」—— 先预置拥有，否则下面找不到安装按钮 */
  await grantGame(page, GAME_ID)
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
  check(`游戏市场里列出了「${GAME_NAME}」`, !!row, row?.text ?? '(没找到那一行)')
  check('安装按钮在、而且是可点的', !!row?.hasButton && row?.disabled === false, JSON.stringify(row))
  /*
    体积是清单里给的提示值，不是校验依据；这里只确认它**不是「大小未知」**。
    ⚠️ 2026-10-25 起体积**不在列表行上**了（iOS 应用市场的列表也不放体积，
       挤在那一行会把「一次 3~8 分钟」截断），改到详情里判。
  */
  check('点开详情（体积在详情里）', await clickSel(`[data-store-detail="${GAME_ID}"]`))
  await waitFor('[role="dialog"][aria-label="游戏详情"]', 5000)
  const sizeChip = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
    if (!d) return null
    const texts = [...d.querySelectorAll('span')].map((x) => (x.textContent ?? '').trim())
    return texts.find((t) => /^[0-9]+(\.[0-9]+)?\s?(KB|MB)$/.test(t)) ?? null
  })
  check('详情里写了包体大小（说明清单里带着 bytes）', !!sizeChip, sizeChip ?? '详情里没找到体积')
  await clickSel('[data-store-close]')
  await wait(400)

  const clicked = await clickSel(`[data-local-install="${GAME_ID}"]`)
  check('点了「安装」', clicked)

  // 判据是**界面那一行变成「已安装」**，不是 store 的返回值
  const installedTag = await waitFor(`[data-local-installed="${GAME_ID}"]`, 20000)
  check('★ 界面上那一行变成了已装', installedTag)

  const after = await snap()
  check(
    `装上的版本是 v${GAME_VERSION}`,
    (await page.evaluate((id) => window.__kqf__.plugin.installed()[id]?.version, GAME_ID)) ===
      GAME_VERSION,
  )
  check('市场里那一行变成「已装」', await waitFor(`[data-plugin-installed-row="${GAME_ID}"]`, 5000))
  check(`已安装清单里有 ${GAME_ID}`, after.installed.includes(GAME_ID), after.installed.join(','))


  pointsBefore = after.balance

  // 装完关掉市场：② 之后都在设置页 / 孩子界面上走，遮罩留着只会盖住截图
  await closeGameStore()
}

/* ============================================================
   ② 设为当前（走市场里那一行上的按钮）
   ============================================================ */
console.log('\n【② 设为当前】')
{
  const clicked = await clickSel(`[data-plugin-set-current="${GAME_ID}"]`)
  check('点了「设为当前」', clicked)
  await wait(800)

  const after = await snap()
  check(`store 里当前游戏切成了 ${GAME_ID}`, after.active === GAME_ID, after.active)
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
  check(`底部导航多出「${TAB_LABEL}」那一格`, tab.includes(TAB_LABEL), tab || '(没有这一格)')
}

/* ============================================================
   ③ 玩一局：进机台 → 买币 → 开局
   ============================================================ */
console.log('\n【③ 玩一局（含买币）】')
let coinsAfterPlay = 0
{
  check(`点了底部「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))

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

  /* ---- 机台页新布局（换币上顶栏 / 拆右侧竖栏 / 底部动作条）----
     只在假宿主里量是不够的：真宿主的插件容器高度只有 ~698（假宿主给 780），
     而且这里才有宿主自己的标题栏和 TabBar 抢位置。 */
  const playGeo = await page.evaluate(() => {
    const r = (s) => {
      const el = document.querySelector(s)
      if (!el) return null
      const b = el.getBoundingClientRect()
      return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }
    }
    const vp = r('#viewport')
    const coin = document.querySelector('#pCoinsBtn')
    const cb = coin?.getBoundingClientRect()
    const coinTop = cb ? document.elementFromPoint(cb.left + cb.width / 2, cb.top + cb.height / 2) : null
    const px = vp ? vp.r - 14 : 0
    const py = vp ? vp.t + vp.h * 0.35 : 0
    const atRight = vp ? document.elementFromPoint(px, py) : null
    return {
      vp, hud: r('#hud'), ctrl: r('#controls'), bar: r('#play > .ppBar'), host: r('#host') ?? r('#play'),
      sideBtns: !!document.querySelector('#sideBtns'),
      camInHud: !!document.querySelector('#hud #camBtns'),
      barTiles: [...document.querySelectorAll('#play > .ppBar .barTile b')].map((b) => b.textContent),
      coinHit: !!(coinTop && (coinTop === coin || coin.contains(coinTop))),
      coinText: document.querySelector('#pCoins')?.textContent ?? null,
      rightFree: atRight ? atRight.tagName : null,
      overflowX: (document.querySelector('#play')?.scrollWidth ?? 0) - (document.querySelector('#play')?.clientWidth ?? 0),
    }
  })
  check('★ 机台页右侧竖栏 `#sideBtns` 已拆掉（画面不再被压掉一列）', !playGeo.sideBtns)
  check('视角 / 店员挪进了顶栏', playGeo.camInHud)
  check('★ 顶栏那颗币可点（换币入口），没被别的层盖住', playGeo.coinHit, playGeo.coinText)
  check('★ 3D 画面右侧 35% 高度处是画布，没有按钮压着', playGeo.rightFree === 'CANVAS', playGeo.rightFree)
  check('★ 娃娃界面底部也有动作条（背包 / 排行）', playGeo.barTiles.join('/') === '背包/排行', playGeo.barTiles.join('/'))
  check('顶栏 / 画面 / 操作区 / 动作条 四段不重叠',
    playGeo.hud.b <= playGeo.vp.t + 1 && playGeo.vp.b <= playGeo.ctrl.t + 1 && playGeo.ctrl.b <= playGeo.bar.t + 1,
    `hud↓${playGeo.hud.b} vp↓${playGeo.vp.b} ctrl↓${playGeo.ctrl.b} bar↓${playGeo.bar.b}`)
  check('机台页没有横向溢出', playGeo.overflowX <= 1, playGeo.overflowX)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-play.png`) })

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
   ③b 娃娃 → 兑换券（**不经过币**）
   ------------------------------------------------------------
   2026-10-23 起：币只能用积分买（入场券），娃娃直接发兑换券（战利品）。
   这一节要钉住的恰恰是「**币一分没变**」—— 卖娃娃如果能回币，
   抓娃娃本身就能续玩，那条「坐着玩就能刷」的回路就又接回来了。
   假宿主那边（`plugin-test.cjs`）也验了同一条，但那条走的是假账本；
   这里走的是真宿主的 `db.mintGameVouchers` → `postHarvest`。
   ============================================================ */
console.log('\n【③b 卖娃娃 → 兑换券（币不动）】')
{
  const before = await snap()
  const coinsBefore = await page.evaluate(() => window.__debug?.coins ?? -1)

  // 直接让物理层判一次中奖（省掉抓取动画；判定和真抓走的是同一条 `onGet`）
  await page.evaluate(() => window.__debug.forceGet(0))
  const caught = await page
    .waitForFunction(
      () => {
        const s = window.__debug?.save?.stock
        return !!s && Object.values(s).some((n) => n > 0)
      },
      { timeout: 15000 },
    )
    .then(() => true, () => false)
  check('抓到一只娃娃（stock 里有了）', caught)

  // 中奖那层盖住整个 #play：`.click()` 绕得过，截图会花
  await page.evaluate(() => document.querySelector('#getOverlay')?.classList.add('hidden'))
  await wait(500)

  check('从机台退回列表', await clickSel('#backBtn'))
  check('点动作条上的「背包」', await clickSel('#colBtn'))
  check('背包页出来了', await waitFor('#collection:not(.hidden)', 10000))

  // 2026-10-23：回收屏删了，卖娃娃是点背包里**有货的那一格**。
  // 用 `data-owned` 过滤，不能取第一个 `.cell` —— 图鉴的 `???` 也占格子。
  const OWN = '#colGrid .cell[data-owned]:not([data-owned="0"])'
  const bagShape = await page.evaluate((sel) => ({
    own: document.querySelectorAll(sel).length,
    cells: document.querySelectorAll('#colGrid .cell').length,
    combos: document.querySelectorAll('#comboWrap .comboCard').length,
    sellBtn: document.querySelectorAll('#sellBtn').length,
    sellScreen: document.querySelectorAll('#sell').length,
  }), OWN)
  check('★ 回收按钮 / 回收屏都删掉了（只剩背包）', bagShape.sellBtn === 0 && bagShape.sellScreen === 0, JSON.stringify(bagShape))
  check('背包里有 1 个可卖的格子', bagShape.own === 1, JSON.stringify(bagShape))
  check('背包顶部有 5 个组合', bagShape.combos === 5, String(bagShape.combos))

  const cellText = await page.evaluate((sel) => {
    const c = document.querySelector(sel)
    return c ? c.textContent.replace(/\s+/g, ' ').trim() : ''
  }, OWN)
  check('背包格子上标的是 🎟️ 兑换券（不是 🧸 币）', cellText.includes('🎟️'), cellText)

  check('点开娃娃', await clickSel(OWN))
  check('卖 1 个', await clickSel('#rcOne'))

  const credited = await page
    .waitForFunction(
      (want) => window.__kqf__.getState().harvestBalance === want,
      { timeout: 15000 },
      before.vouchers + 2,
    )
    .then(() => true, () => false)
  const after = await snap()
  const coinsAfter = await page.evaluate(() => window.__debug?.coins ?? -1)
  check(`★ 兑换券 +2（${before.vouchers} → ${after.vouchers}）`, credited, `${before.vouchers} → ${after.vouchers}`)
  check('★★ 卖娃娃**不给币**（币一分没变）', coinsAfter === coinsBefore, `${coinsBefore} → ${coinsAfter}`)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-sell.png`) })

  // ③c 组合兑换：凑齐三只抱枕 → 一起换 7 张（单卖是 6 张）
  //
  // 为什么在真宿主里也要验一次：组合只调 `host.mintVoucher`，但**一次要发 7 张**，
  // 而单件是 2 张。宿主那边如果对单笔金额有隐含上限（或者把 memo 当 key 去重），
  // 只有真账本能暴露出来。
  await page.evaluate(() => {
    window.__debug.grant('pillow_pig', 1)
    window.__debug.grant('pillow_rabbit', 1)
    window.__debug.grant('pillow_dog', 1)
  })
  check('回到列表（组合条要重画）', await clickSel('#colBack'))
  await waitFor('#list:not(.hidden)', 8000)
  check('再进背包', await clickSel('#colBtn'))
  check('背包又出来了', await waitFor('#collection:not(.hidden)', 10000))

  const comboBefore = await snap()
  const comboReady = await page.evaluate(() => document.querySelector('#comboWrap .comboCard[data-combo="pillow3"]')?.dataset.ready)
  check('凑齐三只抱枕 → 组合卡变「可兑换」', comboReady === '1', String(comboReady))

  check('点组合卡', await clickSel('#comboWrap .comboCard[data-combo="pillow3"]'))
  check('兑换面板弹出来了', await waitFor('#sellModal:not(.hidden)', 5000))
  const sheetText = await page.evaluate(() => document.querySelector('#sellSheet')?.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  check('面板上写清了「基础 6 + 加成 1」', sheetText.includes('6') && sheetText.includes('1'), sheetText.slice(0, 80))

  check('一起兑换', await clickSel('#cbGo'))
  const comboCredited = await page
    .waitForFunction(
      (want) => window.__kqf__.getState().harvestBalance === want,
      { timeout: 15000 },
      comboBefore.vouchers + 7,
    )
    .then(() => true, () => false)
  const comboAfter = await snap()
  check(
    `★ 组合兑换 +7（${comboBefore.vouchers} → ${comboAfter.vouchers}）—— 比单卖三只的 6 张多 1 张`,
    comboCredited,
    `${comboBefore.vouchers} → ${comboAfter.vouchers}`,
  )
  const comboStock = await page.evaluate(() => {
    const s = window.__debug?.stock ?? {}
    return { pig: s.pillow_pig ?? 0, rabbit: s.pillow_rabbit ?? 0, dog: s.pillow_dog ?? 0 }
  })
  check('★ 每样消耗 1 个（三只都清零）', comboStock.pig === 0 && comboStock.rabbit === 0 && comboStock.dog === 0, JSON.stringify(comboStock))
  const comboCoins = await page.evaluate(() => window.__debug?.coins ?? -1)
  check('★ 组合兑换**不动币**（还是 ' + coinsBefore + ' 个）', comboCoins === coinsBefore, `${coinsBefore} → ${comboCoins}`)

  // ④ 是从「机台里按返回」开始的，这里把状态还回去
  check('回到列表', await clickSel('#colBack'))
  await waitFor('#list:not(.hidden)', 8000)
  check('重新进机台（④ 要从这里开始）', await clickSel('#mGrid .mcell:not(.wip)'))
  check('又进机台画面了', await waitFor('#play:not(.hidden)', 15000))
  await wait(900)
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

  const navOk = await clickSel('#colBtn')
  check('点首页底部动作条上的「背包」', navOk)
  const sellUp = await waitFor('#collection:not(.hidden)', 10000)
  check('背包页出来了（换券条在底部）', sellUp)

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

  check(`切到「${TAB_LABEL}」那一格（回来）`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
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

  /*
    卸载在**详情最下面**（2026-10-25 起）—— 列表行只留一个动作，
    「删存档」这种不可逆的事不该躺在孩子每天滚的那一屏里。
  */
  check('点开详情（卸载在详情里）', await clickSel(`[data-store-detail="${GAME_ID}"]`))
  await waitFor(`[data-plugin-uninstall="${GAME_ID}"]`, 5000)
  check('点了「卸载」', await clickSel(`[data-plugin-uninstall="${GAME_ID}"]`))
  await wait(400)
  // 二次确认：卸载会连存档一起删，所以故意要点两下
  check('点了「确认卸载」', await clickSel(`[data-plugin-uninstall-confirm="${GAME_ID}"]`))
  await wait(900)

  const after = await snap()
  check('已安装清单里没有了', !after.installed.includes(GAME_ID), after.installed.join(',') || '(空)')
  check('当前游戏回落到农场（否则底栏会指向一个不存在的游戏）', after.active === 'farm', after.active)
  check(`★ \`gameKv\` 里一条 ${GAME_ID} 的行都不剩（存档也清了）`, !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
  /*
   * 「又变回可安装」这个判据现在得看**市场里**那一行：
   * 本地包已经搬进游戏市场弹层，设置页上没有 `[data-local-*]` 了。
   * ⚠️ 这里用 `openStoreSheet()` 而不是 `openGameStore()` —— 人已经在
   *   「设置 → 游戏」页上了，再走一遍「点设置 / 点游戏」会把页面点乱。
   */
  const sheetErr = await openStoreSheet()
  check('打开游戏市场（看那一行还在不在）', sheetErr === null, sheetErr ?? '')
  check(
    '「游戏市场」里那一行又变回可安装',
    await waitFor(`[data-local-install="${GAME_ID}"]`, 5000),
  )
  await closeGameStore()

  await leaveSettings()
  await waitForApp(page)
  check(`底部「${TAB_LABEL}」那一格没了`, !(await page.$(`[data-tour="tab-${GAME_ID}"]`)))

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
