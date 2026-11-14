#!/usr/bin/env node
/**
 * **柯基屁屁在真 App 里走一遍**：安装 → 设为当前 → 余额不足进 tab（被挡住，0 扣）
 * → 补钱进 tab（**进场就扣 10**）→ 戳屁屁进连击 → 切走（卸载）→ 切回（**宽限期内不再扣**）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4396 --strictPort
 * node scripts/e2e-corgi.mjs http://127.0.0.1:4396/ phone
 * node scripts/e2e-corgi.mjs http://127.0.0.1:4396/ tablet
 * ```
 *
 * ## 为什么不能只靠前两层
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `corgi/scripts/mount-test.mjs`（假宿主） | 插件按契约工作、0×404、收费闸门、卸载、存档 | 真宿主的 HostApi 有没有接对 |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里的 IndexedDB / WebGL / blob 模块 |
 *
 * ## 收费点在「进场」，**不是**「点开始玩」
 *
 * 这一款是养成 / 放置，没有「一局」这个动作：进 tab 就是接着玩。
 *
 * | | 蚂蚁搬家（放置） | 柯基屁屁（养成） | 一分钟卡组（一局制） |
 * | --- | --- | --- | --- |
 * | 进 tab | 扣 15 | **扣 10** | 不扣 |
 * | 点开始 | — | 不扣 | 扣 10 |
 * | 切回来 | 10 分钟内不扣 | **10 分钟内不扣** | 再开一局就再扣 |
 *
 * ★ 第 ⑦⑧ 段那两条的方向最容易抄错：照搬一局制会变成「切回来又扣一次」，
 *   而这一款**不该**扣 —— 抄错会把 bug 写成规范（宽限期是写在存档里的，见 plugin.js）。
 *
 * ## 这作的界面全在 canvas 里（Phaser 画的），所以
 *
 * ① 点的是**设计空间坐标**（`__MAKEPLAY_PLAYTEST__.size()` 拿 W/H，再按 letterbox 换算），
 *    不是屏幕像素 —— 同一套坐标 phone / tablet 都能点；
 * ② 「画出来了」的判据只能是**截图的颜色种类数**（`innerText` 恒空，canvas 1 个全过也能是空白）；
 * ③ 截图必须 `clip` 到插件容器 —— 整页截图里宿主的顶栏 / 底栏自带一堆颜色，
 *    游戏全黑也照样凑够 20 种。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'
import { grantGame } from './lib/own.mjs'

const RAW_TARGET = process.argv[2] ?? 'http://127.0.0.1:4396/'
/*
 * ★ `?playtest` 必须带上：这一款的调试桥 `__MAKEPLAY_PLAYTEST__` 是**有条件的**
 *   （`create()` 里 `if (new URLSearchParams(location.search).has('playtest'))`），
 *   和别的几款无条件挂 `__dbg` 不一样。不带的话 `snapshot()` 恒为 null，
 *   症状是「读不到 mode」而不是「游戏没起来」—— 先查这个参数。
 *   插件跑在 `blob:` 模块里，`location` 仍然是**宿主页面**的，所以加在 App 地址上即可。
 *   这个参数只装调试桥，不影响玩法（`canvas=1` 才会切渲染器，这里没带）。
 */
const TARGET = RAW_TARGET.includes('?') ? RAW_TARGET : `${RAW_TARGET}?playtest`
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
const GAME_ID = 'corgi'
/** 底栏那一格的字，和商城名一致。 */
const TAB_LABEL = '柯基屁屁'
/** 一次进场的票价，必须和 `task-games/corgi/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 10
/** 宽限窗口，必须和 plugin.js 的 GRACE_MS 一致 */
const GRACE_MS = 10 * 60 * 1000

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/corgi/${VIEWPORT}`
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
page.on('pageerror', (e) => {
  const st = String(e.stack || '').split('\n').slice(1, 5).map((s) => s.trim()).join(' | ')
  consoleErrors.push('PAGEERROR ' + String(e.message).slice(0, 200) + (st ? ' @@ ' + st.slice(0, 400) : ''))
})

const waitForApp = () => page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 40000 })
const waitFor = (sel, timeout = 20000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(() => true, () => false)
const clickSel = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!(el instanceof HTMLElement)) return false
    el.click()
    return true
  }, sel)
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

/**
 * 设计空间 → 屏幕坐标。
 *
 * Phaser 是 `Scale.FIT` + `CENTER_BOTH`：设计尺寸由 `calcSize()` 按容器比例算出来
 * （`plugin.js` 把容器量进 `VIEW`），所以**宽高比和容器一致**，letterbox 为 0。
 * 这里仍按通用公式算，平板换了比例也不会偏。
 */
async function designToScreen(dx, dy) {
  const size = await page.evaluate(() => window.__MAKEPLAY_PLAYTEST__.size())
  const box = await hostBox()
  const scale = Math.min(box.w / size.W, box.h / size.H)
  return {
    x: box.x + (box.w - size.W * scale) / 2 + dx * scale,
    y: box.y + (box.h - size.H * scale) / 2 + dy * scale,
    size,
  }
}

/** 在 canvas 上真按一下（派发真实 pointerdown，游戏 UI 听的正是它）。 */
async function tapDesign(dx, dy) {
  const p = await designToScreen(dx, dy)
  await page.mouse.click(Math.round(p.x), Math.round(p.y))
}

const snapGame = () => page.evaluate(() => window.__MAKEPLAY_PLAYTEST__?.snapshot() ?? null)

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
  check(`gameKv 里没有 ${GAME_ID} 的行`, !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
}

console.log('\n【② 安装：设置 → 游戏】')
{
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

  // 家长密码默认 0000，第 4 位自动提交（没有确认按钮）
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

  /* 2026-11-07 起「未拥有的游戏不显示」⇒ 必须先预置拥有、再等那一行，
     反过来的话 `waitFor` 白等一轮，报的是「列表里没有」，真因却是「没拥有」。 */
  await grantGame(page, GAME_ID)
  check('游戏列表在页面上', await waitFor(`[data-local-row="${GAME_ID}"]`, 12000))

  const row = await page.evaluate((id) => {
    const li = document.querySelector(`[data-local-row="${id}"]`)
    if (!li) return null
    const btn = li.querySelector('[data-local-install]')
    return { text: (li.innerText ?? '').replace(/\s+/g, ' ').trim(), has: !!btn, disabled: btn ? btn.disabled : true }
  }, GAME_ID)
  check(`列表里列出了「${TAB_LABEL}」`, !!row, row?.text ?? '(没找到)')
  check('安装按钮可点', !!row?.has && row?.disabled === false)

  check('点了「安装」', await clickSel(`[data-local-install="${GAME_ID}"]`))
  check('★ 界面上那一行变成已装', await waitFor(`[data-local-installed="${GAME_ID}"]`, 30000))


  check('点了「设为当前」', await clickSel(`[data-plugin-set-current="${GAME_ID}"]`))
  await wait(800)
  check('store 里当前游戏是 corgi', (await snap()).active === GAME_ID, (await snap()).active)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('返回'),
    )
    if (b) b.click()
  })
  await wait(700)
  await waitForApp()
}

console.log('\n【③ 底栏那一格：4 个字要一行放得下】')
{
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    if (!b) return null
    const spans = [...b.querySelectorAll('span')]
    const lbl = spans[spans.length - 1]
    const nav = b.closest('nav')
    const r = lbl.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(lbl)
    return {
      label: (lbl.textContent ?? '').trim(),
      lines: range.getClientRects().length,
      lh: Math.round(r.height),
      overflow: lbl.scrollWidth - lbl.clientWidth,
      navH: nav ? Math.round(nav.getBoundingClientRect().height) : -1,
      btnW: Math.round(b.getBoundingClientRect().width),
    }
  }, GAME_ID)
  check('底栏有这一格', !!tab)
  check(`★ 那一格写的是「${TAB_LABEL}」`, tab?.label === TAB_LABEL, tab?.label ?? '(无)')
  check('★ 文字只占一行（没折行）', tab?.lines === 1, `${tab?.lines} 行 / 高 ${tab?.lh}px`)
  check('文字没横向溢出', (tab?.overflow ?? 99) <= 1, `溢出 ${tab?.overflow}px`)
  check('底栏没被撑高（< 100px）', (tab?.navH ?? 999) < 100, `nav 高 ${tab?.navH}px`)
  check('这一格宽度正常（≥ 60px）', (tab?.btnW ?? 0) >= 60, `${tab?.btnW}px`)
}

console.log(`\n【④ 余额不足：进 tab 必须被挡住，一分不扣】`)
{
  const cur = (await snap()).balance
  if (cur > 0) {
    await page.evaluate((n) => window.__kqf__.addPoints(-n), cur)
    await wait(600)
  }
  const before = await snap()
  check(`余额已压到 ${before.balance}（< ${PLAY_COST}）`, before.balance < PLAY_COST, String(before.balance))

  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))
  await wait(2500)

  const gate = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    return {
      text: (el?.innerText ?? '').replace(/\s+/g, ' ').trim(),
      canvas: el ? el.querySelectorAll('canvas').length : -1,
    }
  }, GAME_ID)
  check('★ 门上有「积分不够啦」', /积分不够/.test(gate.text), gate.text.slice(0, 60))
  check('★ 没有建 canvas（游戏没起来）', gate.canvas === 0, String(gate.canvas))

  const after = await snap()
  check(`★ 一分没扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '')

  // 收干净：切走这一格，门要跟着摘掉
  check('切到「任务」那一格', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1500)
  const left = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    return { exists: !!el, kids: el ? el.childElementCount : -1 }
  }, GAME_ID)
  check('切走后容器里没留下那扇门', !left.exists || left.kids === 0, JSON.stringify(left))
}

console.log(`\n【⑤ 余额够：进 tab 就扣 ${PLAY_COST}，画面要出来】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__gpReady`）', up)
  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 90000 }).then(() => true, () => false)
  check('★ 资源加载完成（`__gpPlayable`）', playable)
  await wait(1500)

  const after = await snap()
  check(`★ 进场就扣了 ${PLAY_COST}（${before.balance} → ${before.balance - PLAY_COST}）`,
    after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动（C 型零产出）', after.vouchers === before.vouchers, String(after.vouchers))

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里恰好 1 个 canvas', canvas === 1, String(canvas))

  const c1 = await gameColors('1-title.png')
  check(`★ 标题屏画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const cv = el.querySelector('canvas')
    const cr = cv.getBoundingClientRect()
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    return {
      h: Math.round(r.height), ph: Math.round(p.height), w: Math.round(r.width),
      cw: Math.round(cr.width), ch: Math.round(cr.height),
      hitInside: !!(hit && el.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() : '(null)',
    }
  }, GAME_ID)
  check('插件容器还在', !!geo, geo ? '' : '（容器不在 ⇒ 挂载失败了，看上面的 console.error）')
  check(`★ 容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`, !!geo && Math.abs(geo.h - geo.ph) <= 1, geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '')
  check(`canvas 铺满容器（${geo?.cw}×${geo?.ch} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)

  const mode = (await snapGame())?.mode
  check('首屏是标题页（mode=title）', mode === 'title', String(mode))
}

console.log('\n【⑥ 点「开始玩」→ 戳屁屁进连击（canvas 上的真点击）】')
{
  const size = (await snapGame()) ? await page.evaluate(() => window.__MAKEPLAY_PLAYTEST__.size()) : null
  // 标题屏那颗按钮：`T.btn = btn(W/2, T.py + 6, …)`，`T.py = H * 0.795`（竖屏）
  await tapDesign(size.W / 2, size.H * 0.795 + 6)
  const entered = await page.waitForFunction(
    () => window.__MAKEPLAY_PLAYTEST__?.snapshot()?.mode === 'play',
    { timeout: 20000 },
  ).then(() => true, () => false)
  check('★ 点「开始玩」进了主界面（mode=play）', entered, `mode=${(await snapGame())?.mode}`)

  const s1 = await snapGame()
  check('默认在第一个页签（零食）', s1?.tab === 0, String(s1?.tab))
  check('每秒产出算出来了', typeof s1?.hps === 'number' && s1.hps > 0, String(s1?.hps))

  /*
   * ★★ 判据为什么是「爱心涨了」而不是「连击条满了（frenzy）」：
   *
   *   爱心：`tapMain()` 只在 `hitMain(x,y)` 命中柯基时才会被调（`onDown` 里先判命中），
   *   每命中一下 `gain(tapVal)` ≥ 1，而**自动产出只有 ~0.2/秒** ⇒ 几秒里多出 5 个以上
   *   只可能是「点中了」。它同时证明「点击到了 canvas 上」+「命中的是柯基」。
   *
   *   frenzy：要连击条打满 100（每下 +4.5 ⇒ 23 下）。但 headless 只有 4~6 fps，
   *   `page.mouse.click` 连发时同一帧里的多次按下会被**合并/丢掉**，实际命中数不稳定
   *   ⇒ 同一条脚本两次跑出 `9.98` 和 `0`。**别拿它当判据**，只当日志。
   *
   * ★★ 为什么要**分轮重试**而不是「进 play 就戳」：
   *   `startPlay()` 用 380ms 的 tween 把标题层淡出，而 headless 把 delta 钳在 33ms/帧、
   *   实际 4~6 fps ⇒ 墙钟要 ~2.7s 才跑完。**淡出期间戳屁屁是无效的**（实测
   *   「进 play 立刻戳 45 下」爱心 0→0，「等 1.2s 再戳」爱心 0→55）。
   *   所以判据写成「戳一轮不够就再等一轮」，而不是一个固定的 sleep ——
   *   固定值要么太短（拍到过渡态 / 点不动），要么白白拖慢每一轮。
   */
  const h0 = (await snapGame())?.hearts ?? 0
  let round = 0
  let dh = 0
  for (; round < 4; round++) {
    // 三个纵向位置各戳 15 下：屁屁在主视觉那一块，取 0.35 / 0.42 / 0.50 三处足够覆盖
    for (const fy of [0.35, 0.42, 0.5]) {
      for (let i = 0; i < 15; i++) await tapDesign(size.W / 2, size.H * fy)
    }
    dh = ((await snapGame())?.hearts ?? 0) - h0
    if (dh >= 5) break
    await wait(900) // 大概率还在标题淡出，再等一轮
  }
  const s2 = await snapGame()
  check(`★ 戳屁屁真的加爱心（${h0} → ${s2?.hearts}，+${dh}）`, dh >= 5,
    `第 ${round + 1} 轮点中；自动产出只有 ~0.2/秒，几秒涨 5 个只能是点中了`)
  console.log(`  · 连击（frenzy）：${s2?.frenzy ?? 0}（headless 下点击会被合并，只当日志不看）`)

  /*
   * ★★ 截图必须放在**戳完之后**，而且还要再等一段。
   *
   * `startPlay()` 用 380ms 的 tween 把标题层淡出，而 headless 的 Phaser
   * 把 delta 钳在 33ms/帧、实际只有 4~6 fps ⇒ **墙钟要 ~2.7s 才跑完**。
   * 原来「进 play 就 wait 1200ms 再截」拍到的是**交叉淡入帧**
   * （标题 ~50% + 主界面 ~40%，两层叠着）—— 颜色种类照样 ≥20，
   * 断言全绿，只有人看截图才发现那张图不能用。
   * 这和 blockfit「印章还是 alpha 0」是同一个坑：**颜色数判据抓不到过渡态**。
   */
  await wait(1800)
  const c2 = await gameColors('2-play.png')
  check(`★ 主界面不是空白（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)
}

let heartsBefore = 0

console.log('\n【⑦ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  heartsBefore = (await snapGame())?.hearts ?? 0
  check('切走前记下爱心（切回来要读回它）', heartsBefore > 0, String(heartsBefore))
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(2000)

  const gone = await page.evaluate(() => ({
    playable: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
    hook: typeof window.__MAKEPLAY_PLAYTEST__,
  }))
  check('★ `__gpPlayable` 已摘（卸载真跑了）', gone.playable === 'undefined', gone.playable)
  check('`__gpReady` 也摘掉了', gone.ready === 'undefined', gone.ready)
  check('`__MAKEPLAY_PLAYTEST__` 也摘掉了', gone.hook === 'undefined', gone.hook)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log(`\n【⑧ 切回（宽限期内）：**不再扣**，画面还在】`)
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 还是 1', canvas === 1, String(canvas))

  /*
   * ★★ 这条是「宽限期」唯一能验到的地方，而且**必须跨一次卸载 + 挂载**：
   *   `paidAt` 写在 `host.storage`（存档）里，同一份内存里读回来恒真 ——
   *   只在挂载期间断言，把 paidAt 写成内存变量的实现照样绿。
   */
  const after = await snap()
  check(`★ ${GRACE_MS / 60000} 分钟内回来不再扣（${before.balance} → ${after.balance}）`,
    after.balance === before.balance, '宽限期写在存档里，见 plugin.js 的 GRACE_MS')

  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 90000 }).then(() => true, () => false)
  check('资源第二次也加载完成', playable)
  await wait(1500)

  /*
   * ★ 第二次挂载最容易死的地方：Phaser 的 `game.destroy()` 之后如果复用了旧实例，
   *   画面全白而**一个错都不报** —— canvas 个数照样是 1。
   */
  const c3 = await gameColors('3-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)

  const mode = (await snapGame())?.mode
  /*
   * ★ 每次挂载都从**标题页**进（`mode` 是场景自己的状态，不进存档）——
   *   这不是 bug：`freshState()` 里没有 mode，存档只有爱心 / 柯基 / 装扮。
   *   所以这里判「停在标题页」，**进度**另外用爱心判。
   */
  check('切回来停在标题页（每次挂载都从标题进，按设计）', mode === 'title', String(mode))

  const back = await snapGame()
  check(`★ 存档读回来了（爱心 ${heartsBefore} → ${back?.hearts}）`, (back?.hearts ?? 0) >= heartsBefore,
    '只比大小：切走期间离线产出照算，所以只会更多')
}

console.log('\n【⑨ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader|Phaser/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
