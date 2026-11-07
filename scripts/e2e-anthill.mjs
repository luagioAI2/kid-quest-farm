#!/usr/bin/env node
/**
 * **蚂蚁搬家在真 App 里走一遍**：安装 → 设为当前 → 进场（扣分）→ 切走（卸载）→ 切回（宽限期不再收）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4396 --strictPort
 * node scripts/e2e-anthill.mjs http://127.0.0.1:4396/ phone
 * node scripts/e2e-anthill.mjs http://127.0.0.1:4396/ tablet
 * ```
 *
 * ## 为什么不能只靠前两层
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `anthill/scripts/mount-test.mjs`（假宿主） | 插件按契约工作、0×404、收费闸门、上下文释放 | 真宿主的 HostApi 有没有接对 |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里的 IndexedDB / WebGL / blob 模块 |
 *
 * 尤其是 **`mount` 返回 Promise**：假宿主里脚本自己 `await mount()`，
 * 所以「宿主把 Promise 当函数用」这类 bug 在那边**永远绿**。
 *
 * ## 这作的收费点在「进场」，不是「点开始」
 *
 * 它是放置 / 养成类，**没有「一局」这个动作** —— 进来就是接着玩。
 * 所以判据也跟着变：
 *
 * | 通用模板 | 本作 |
 * | --- | --- |
 * | 点「开始游戏」→ 积分 -票价 | **进 tab 就扣**（`mount` 里就扣完） |
 * | 再玩一局 → 再扣一次 | **10 分钟内切回来不扣**（`paidAt` 记在存档里） |
 *
 * 宽限窗口那条**必须真跑一次「切走 + 切回」**才能验到：它是「卸载 + 挂载」的副产品，
 * 而卸载后内存变量就没了 —— 写成内存变量的话这里会红，正是要抓的东西。
 *
 * ## 每条断言都要有能失败的前提
 *
 * ① 动手前「一款都没装」——否则后面每条「装上了」都可能恒真；
 * ② 装完不看返回值，看**界面那一行变成已装**；
 * ③ 进场不看画面，看**积分 -15**（钱真的走了）；
 * ④ 顺便证伪：**兑换券一分都不许动**（这是 B 型的定义，不是「顺便看看」）；
 * ⑤ 切走之后 `window.__ant` / `__gpPlayable` 必须**消失**（卸载真跑了，不是「还留着但看不见」）；
 * ⑥ 切回之后要能**再挂一次并且画出来** —— 抓「卸载时把 WebGL 上下文一起丢了」；
 * ⑦ 切回**不许再扣一次**（宽限期），而且**存档还在**（`host.storage` 真的落盘了）。
 *
 * ## 为什么画面要数颜色
 *
 * 这是 three.js 全屏 3D。DOM 里只有一个 `canvas`，`innerText` 基本是空的
 * ⇒ 拿文字当判据会把**渲染完好**判成失败；反过来「加载中」那种也能骗过「容器里有个 canvas」。
 * 判据只能是**截图里的颜色种类数**（<20 判空白），而且必须 **clip 到容器**：
 * 整页截图里宿主的顶栏底栏自带一堆颜色，游戏全黑也照样能凑够 20 种。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'
import { grantGame } from './lib/own.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4396/'
/**
 * 视口档位（`process.argv[3]`），和 `e2e-plugin-local.mjs` 同一套口径。
 *
 * 两档都要跑：平板下**容器高度**和底栏布局都不一样，
 * 而「插件把容器补成 `position:relative`」这类回归只在平板暴露
 * （inline 的 `relative` 会盖掉类里的 `absolute` ⇒ 盒子退回内容高度）。
 */
const VIEWPORT = process.argv[3] ?? 'phone'
const SIZES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
}
const SIZE = SIZES[VIEWPORT]
if (!SIZE) {
  console.error(`✗ 不认识的视口：${VIEWPORT}（可选 ${Object.keys(SIZES).join(' / ')}）`)
  process.exit(2)
}
const GAME_ID = 'anthill'
const TAB_LABEL = '蚂蚁'
/** 一次进场的票价，必须和 `task-games/anthill/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 15

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/anthill/${VIEWPORT}`
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  · ' + detail : ''}`)
  if (!ok) fails.push(name)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
await page.setViewport({ ...SIZE, deviceScaleFactor: 1 })

const consoleErrors = []
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR ' + String(e.message).slice(0, 200)))

const waitForApp = () =>
  page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 40000 })
const waitFor = (sel, timeout = 20000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(() => true, () => false)
const clickSel = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!(el instanceof HTMLElement)) return false
    el.click()
    return true
  }, sel)
/**
 * 在插件容器**里面**按 `pointerdown` 点一颗按钮。
 *
 * ⚠️ 游戏的 UI 是 DOM，但监听的是 **`pointerdown` 不是 `click`**
 *    （触摸要跟手，click 要等抬手）。派发 `click` 会静默无反应 ——
 *    症状是「面板没打开」，而人第一反应会去查选择器写错了没有。
 */
const tapIn = (sel) =>
  page.evaluate(
    ([id, s]) => {
      const el = document.querySelector(`[data-plugin-host="${id}"] ${s}`)
      if (!(el instanceof HTMLElement)) return false
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
      return true
    },
    [GAME_ID, sel],
  )
const clickText = (label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText ?? '').includes(t))
    if (!b) return false
    b.click()
    return true
  }, label)

const snap = () =>
  page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      balance: s.balance,
      vouchers: s.harvestBalance,
      active: s.activeGameId,
      installed: Object.keys(window.__kqf__.plugin.installed()),
    }
  })
const kvOwners = () => page.evaluate(() => window.__kqf__.plugin.kvOwnerIds())

/** 插件容器在页面上的位置（像素）。截图要 clip 到它，见文件头。 */
const hostBox = () =>
  page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }, GAME_ID)

/** 只截插件容器那一块，返回颜色种类数（<20 判空白）。 */
async function gameColors(file) {
  const b = await hostBox()
  if (!b) return { n: 0, file: '(容器不在)' }
  const png = await page.screenshot({
    path: join(OUT, file),
    clip: { x: b.x, y: b.y, width: b.w, height: b.h },
  })
  return { n: countColors(png), file }
}

/* ============================================================ */
console.log(`\n目标 ${TARGET}（${VIEWPORT} ${SIZE.width}×${SIZE.height}）\n`)
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await waitForApp()
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__?.plugin, { timeout: 15000 })
await wait(400)

console.log('\n【① 动手前：一款都没装】')
{
  const s = await snap()
  check('已装插件 0 款', s.installed.length === 0, s.installed.join(',') || '(空)')
  check(`底部没有「${TAB_LABEL}」那一格`, !(await page.$(`[data-tour="tab-${GAME_ID}"]`)))
  check('gameKv 里没有 anthill 的行', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
}

console.log('\n【② 安装：设置 → 游戏】')
{
  // 顶栏那个齿轮（aria-label 带「设置」）。**不是**底栏——底栏那格是「设置」tab，两回事
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('设置'),
    )
    if (!b) return false
    b.click()
    return true
  })
  check('点了顶栏「设置」', opened)
  await wait(700)

  check('进了「游戏」那一栏', await clickText('游戏'))
  await wait(600)

  /*
   * 家长密码**默认 0000**，第 4 位自动提交（没有确认按钮）。
   * ⚠️ 别写 1234：那样会连点 8 位、页面还在锁屏上，
   *    而失败会表现成「游戏列表没渲染」—— 排查方向整个是错的。
   */
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
    /* 判「还锁着」用**数字键盘在不在**。旧写法判「页面上有没有『请输入家长密码』」，
       `ParentPinSheet` 文案一换就永远 false ⇒ 循环第一轮 break、4 位密码一次没输，
       而下面那句 check 判的又是「没有这几个字」⇒ **假绿**，后面全红成
       「列表里没这一行」，排查方向整个是错的。 */
    const locked = await page.evaluate(
      () =>
        [...document.querySelectorAll('button')].filter((b) =>
          /^[0-9]$/.test((b.textContent ?? '').trim()),
        ).length >= 8,
    )
    if (!locked) break
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
        b?.click()
      })
      await wait(180)
    }
    await wait(600)
  }
  /* 判据落在**表渲染出来了**：闸门开了才有 `[data-market-builtin]`。 */
  check('过了家长密码', await page.evaluate(() => !!document.querySelector('[data-market-builtin]')))

  // 2026-10-25 起本地游戏列表**直接摊在设置页上**，没有「进入游戏市场」这一步
  /* 2026-11-07 起「未拥有的游戏不显示」⇒ 顺序必须**先预置拥有、再等那一行**。
     反过来的话 `waitFor` 会白等 12 秒，然后报「游戏列表不在页面上」——
     真正的原因是「没拥有所以不渲染」，排查方向整个是错的。
     2026-10-30 起的「没拥有不能装」也要求先拥有，否则找不到安装按钮。 */
  await grantGame(page, GAME_ID)
  check('拥有之后那一行在页面上', await waitFor(`[data-local-row="${GAME_ID}"]`, 12000))

  const row = await page.evaluate((id) => {
    const li = document.querySelector(`[data-local-row="${id}"]`)
    if (!li) return null
    const btn = li.querySelector('[data-local-install]')
    return { text: (li.innerText ?? '').replace(/\s+/g, ' ').trim(), has: !!btn, disabled: btn ? btn.disabled : true }
  }, GAME_ID)
  check('列表里列出了「蚂蚁搬家」', !!row, row?.text ?? '(没找到)')
  check('安装按钮可点', !!row?.has && row?.disabled === false)

  check('点了「安装」', await clickSel(`[data-local-install="${GAME_ID}"]`))
  check('★ 界面上那一行变成已装', await waitFor(`[data-local-installed="${GAME_ID}"]`, 25000))

  /*
    经济参数 —— `docs/game-plugin-spec.md` §4.4 写着「必须对家长可见」。
    它原来在列表页的「游戏市场」卡里（`PluginStoreCard.tsx`），10-29 那张卡
    整体删掉时连它一起没了 ⇒ 现在收进**详情**，所以要先进详情才看得到。
    ⚠️ 别改回在列表页找：列表上现在只有「装 / 卸 / 设为当前」，没有参数。
  */
  check('点进这款游戏的详情', await clickSel(`[data-store-detail="${GAME_ID}"]`))
  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  check(`家长能看到「一局 ${PLAY_COST} 积分」`, new RegExp(`一局\\s*${PLAY_COST}\\s*积分`).test(econ), econ)
  check('家长能看到「换不成兑换券」', /不开放|换不成|不能换/.test(econ), econ)
  check('关掉详情', await clickSel('[data-store-close]'))

  check('点了「设为当前」', await clickSel(`[data-plugin-set-current="${GAME_ID}"]`))
  await wait(800)
  check('store 里当前游戏是 anthill', (await snap()).active === GAME_ID, (await snap()).active)

  // 从设置页回到孩子的界面（顶栏的返回箭头）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('返回'),
    )
    if (b) b.click()
  })
  await wait(700)
  await waitForApp()
}

console.log(`\n【③ 进场：积分必须 -${PLAY_COST}，币和券一分不动】`)
{
  /*
   * ⚠️ 不能断言「补完正好 100」：App 自带初始积分（实测 50）。
   * 判据只能是**差值** —— 写死绝对值会在换了初始值之后红，而功能完全正常。
   */
  const pre = await snap()
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check(`补了 100 积分（${pre.balance} → ${before.balance}）`, before.balance === pre.balance + 100, String(before.balance))
  check('补完够进场', before.balance >= PLAY_COST, String(before.balance))

  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    return b ? (b.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  }, GAME_ID)
  check(`底部导航多出「${TAB_LABEL}」`, tab.includes(TAB_LABEL), tab || '(没有这一格)')
  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))

  // 场景搭好就有了；资源（贴图 / GLB / 音频）还要等，所以两条分开等
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__gpReady`）', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里有 canvas', canvas === 1, String(canvas))

  /*
   * 扣款发生在 `mount` 里（`chargePlay()` 在 `start()` 第一句），
   * 所以 `__gpReady` 为真时钱一定已经走了 —— 不需要点任何按钮。
   */
  const after = await snap()
  check(`★ 积分 ${before.balance} → ${before.balance - PLAY_COST}`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动（B 型不产出）', after.vouchers === before.vouchers, String(after.vouchers))
  const coins = await page.evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID).catch(() => 0)
  check('游戏币余额为 0（本作不发行币）', !coins, String(coins))
}

console.log('\n【④ 画面真的画出来了（只有真宿主能给）】')
{
  // 资源加载完成 = 加载层撤掉（最长等 8s，见 game.js 的 Promise.race）
  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 40000 }).then(() => true, () => false)
  check('★ 资源加载完成（`__gpPlayable`）', playable)
  await wait(1200) // 留几帧，别拍到第一帧

  const st = await page.evaluate(() => ({
    items: window.__ant?.items?.length ?? -1,
    ants: window.__ant?.ants?.length ?? -1,
  }))
  check('场景里有可搬的东西', st.items > 0, String(st.items))
  check('蚂蚁在跑', st.ants > 0, String(st.ants))

  const c1 = await gameColors('1-in-host.png')
  check(`★ 游戏区域不是空白（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  /*
   * ---- 几何 + 遮挡 ----
   *
   * ① **容器高 == 父容器高**。`plugin.js` 只在 `getComputedStyle` 为 `static` 时补
   *    `position:relative`；判据写错（读 inline）就会把宿主的 `absolute` 盖掉，
   *    盒子退回内容高度 —— 而「canvas 高度 == 容器高度」照样绿（两个数一起错）。
   * ② **canvas 铺满容器**（不是只占上半截）。
   * ③ **容器中心点没被盖住**：`elementFromPoint` 命中的元素必须还在容器里。
   *    底栏 / 弹层盖住时这里会命中 `nav` 或遮罩，而 `el.click()` 走不到命中测试，
   *    所以别的断言抓不到。
   */
  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const cv = el.querySelector('canvas')
    const cr = cv.getBoundingClientRect()
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    return {
      h: Math.round(r.height),
      ph: Math.round(p.height),
      w: Math.round(r.width),
      cw: Math.round(cr.width),
      ch: Math.round(cr.height),
      hitInside: !!(hit && el.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() + (hit.className ? '.' + String(hit.className).slice(0, 24) : '') : '(null)',
    }
  }, GAME_ID)
  check(
    `容器高 == 父容器高（${geo.h} / ${geo.ph}）`,
    Math.abs(geo.h - geo.ph) <= 1,
    `${geo.w}×${geo.h} vs 父 ${geo.ph}`,
  )
  check(
    `canvas 铺满容器（${geo.cw}×${geo.ch} / ${geo.w}×${geo.h}）`,
    Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2,
    '',
  )
  check('容器中心没被底栏/弹层盖住', geo.hitInside, `命中的是 ${geo.hitTag}`)

  /*
   * ---- 写一笔存档，留给 ⑥ 验「真的落盘了」----
   *
   * 为什么挑「语言」：它是**唯一**一个「点一下就能改、而且重新挂载后肉眼可查」的存档字段
   * （金币 / 世界要玩很久才动）。判据放在 ⑥ —— 这里只负责**写**，
   * 在同一份内存里读回来是恒真的（`S` 就是同一个对象），证明不了任何事。
   *
   * ⚠️ 首启时 `S.lang` 是 `null`：`setLang()` 只改内部变量、**不回写 `S.lang`**，
   *    只有设置面板的 `data-lang` 分支会写。所以这里不能断言「进游戏就已经定了语言」。
   */
  check('打开游戏内设置面板', await tapIn('#setBtn'))
  await wait(600)
  check('点「日本語」', await tapIn('#modal [data-lang="ja"]'))
  await wait(500)
  const lang1 = await page.evaluate(() => window.__ant?.S?.lang ?? '')
  check('★ 语言切到 ja（写进存档）', lang1 === 'ja', `lang="${lang1}"`)
  check('关掉设置面板', await tapIn('#modal [data-close]'))
  await wait(400)
}

console.log('\n【⑤ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  /*
   * ⚠️ **没有 `tab-farm`**：底栏那四格是「任务 / <当前游戏> / 兑换 / 积分」，
   * 当前游戏是 anthill 时，农场那一格**根本不存在**（同一个位置被它占了）。
   * 要切走只能点别的固定格 —— 这里点「任务」。
   * 判据写错的表现是「卸载没跑」，而其实是**根本没切走**。
   */
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1500)

  const gone = await page.evaluate(() => ({
    ant: typeof window.__ant,
    playable: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
  }))
  check('★ `window.__ant` 已消失（destroy 真跑了）', gone.ant === 'undefined', gone.ant)
  check('`__gpPlayable` 也摘掉了', gone.playable === 'undefined', gone.playable)
  check('`__gpReady` 也摘掉了', gone.ready === 'undefined', gone.ready)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  // 存档真的写进了宿主：`kvOwnerIds()` 有 anthill 一行 ⇒ `host.storage` 落盘了
  check('★ gameKv 里出现 anthill 的行（存档落盘）', (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑥ 切回：10 分钟内不重复收，而且要能再画出来】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 还是 1', canvas === 1, String(canvas))

  /*
   * ★ 这条是宽限期的**唯一**有效判据：它跨了一次「卸载 + 挂载」。
   *   写成内存变量的话这里会红 —— 正是要抓的东西（存档里 `paidAt` 才算数）。
   */
  const after = await snap()
  check(`★ 10 分钟内回来不再收（${before.balance} → ${after.balance}）`, after.balance === before.balance, `票价 ${PLAY_COST}`)

  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 40000 }).then(() => true, () => false)
  check('资源第二次也加载完成', playable)
  await wait(1200)

  /*
   * ★★ **这条是 3D 插件最容易死的地方**：卸载只 `dispose()` 不 `forceContextLoss()`
   *   的话，切几次就把 WebGL 上下文耗光（上限通常 16），新建的上下文直接失败
   *   ⇒ 画面全黑而**一个错都不报**。DOM 断言（canvas 个数）完全抓不到。
   */
  const c2 = await gameColors('2-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)

  const st = await page.evaluate(() => ({
    items: window.__ant?.items?.length ?? -1,
    lang: window.__ant?.S?.lang ?? '',
  }))
  check('存档被恢复了（东西还在）', st.items > 0, String(st.items))
  /*
   * ★ 这条跨了一次「卸载 + 挂载」，所以它能证伪：
   *   存档没写进 `host.storage` 时，新挂载会退回 `pickLang(navigator.language)`
   *   （headless 是 en-US）⇒ 读回来是 "en" 而不是 "ja" ⇒ 红。
   */
  check('★ 语言设置被记住了（走的是 host.storage）', st.lang === 'ja', `lang="${st.lang}"`)
}

console.log('\n【⑦ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
