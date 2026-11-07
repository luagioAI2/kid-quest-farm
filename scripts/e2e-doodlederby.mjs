#!/usr/bin/env node
/**
 * **画马赛跑在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→ 领养 / 预览 3D / 参赛页 /
 * 改名 / 换赛制（全不收费）→ 余额 0 时点「送它去比赛」必须被挡且留在画室 → 补钱后点它扣 10 进比赛
 * → 回画室不收费 → 再点它**再扣一次** → 切走（卸载干净、存档落盘）→ 切回（设置读得回）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4395 --strictPort
 * node scripts/e2e-doodlederby.mjs http://127.0.0.1:4395/ phone
 * node scripts/e2e-doodlederby.mjs http://127.0.0.1:4395/ tablet
 * ```
 *
 * ## 收费点是「开跑一场」，不是「进 tab」、也不是「画马」
 *
 * | 动作 | 收不收 |
 * | --- | --- |
 * | 进 tab / 领养一匹 / 在纸上画 / 切 02 预览 / 切 03 参赛 / 改名 / 换赛制 | 不收 |
 * | 点「03 送它去比赛」（`#start`）/ 成绩单的「再跑一场」（`#again`） | **收 10** |
 * | 比赛中的「回画室」（`#back`） | 不收 |
 *
 * 这款游戏的核心乐趣是**画**（画一匹自己的马、看它站起来），所以画马、预览、
 * 起名、选赛制**一分钱都不能收** —— 收在这里等于把「好玩的部分」锁在付费墙后。
 *
 * ## 和 hoopsneak 那份的区别：这一款**有 DOM**
 *
 * 整屏不是一块 canvas：`#dd-app` 里是普通按钮和输入框，`#drawing` 只是那张纸。
 * 所以点按钮直接用 `el.click()`（它们的处理函数都是 `onclick`）。
 * **不要照抄 hoopsneak 的 `buttons()` 桥** —— 这一款没有那个桥。
 *
 * ## 判据里不写死数值
 *
 * 票价 10 写在 `task-games/doodlederby/plugin.js` 的 `PLAY_COST`，这里抄一份常量，
 * 改价要两边一起改（断言会拿它算期望余额，写错立刻红）。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'
import { grantGame } from './lib/own.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4395/'
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
const GAME_ID = 'doodlederby'
/** 底栏那一格的字（4 个字，上限 5） */
const TAB_LABEL = '画马赛跑'
/** 一场的票价，必须和 `task-games/doodlederby/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 10

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/${GAME_ID}/${VIEWPORT}`
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const fails = []
/** 切走前记下来的存档探针值（⑩ 写、⑪ 读 —— 跨块所以提到顶层） */
let mutedBefore = null
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  · ' + detail : ''}`)
  if (!ok) fails.push(name)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: [
    '--no-sandbox',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--autoplay-policy=no-user-gesture-required',
  ],
})
const page = await browser.newPage()
await page.setViewport({ ...SIZE, deviceScaleFactor: 1 })

const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') {
    const t = m.text().slice(0, 300)
    consoleErrors.push(t)
    console.log('    [console.error]', t)
  }
})
page.on('pageerror', (e) => {
  const st = String(e.stack || '')
    .split('\n')
    .slice(1, 5)
    .map((s) => s.trim())
    .join(' | ')
  consoleErrors.push('PAGEERROR ' + String(e.message).slice(0, 200) + (st ? ' @@ ' + st.slice(0, 400) : ''))
})
/** ★ 控制台那句 404 不带 URL ⇒ 必须挂 response 才查得到是谁 404 了 */
const badResponses = []
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) badResponses.push(`${r.status()} ${r.url()}`)
})

const waitForApp = () => page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 40000 })
const waitFor = (sel, timeout = 20000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(
    () => true,
    () => false,
  )
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
 * 等游戏进到某一屏。
 *
 * `__qa.scene()` 是游戏自己的映射：`studio→menu` / `race→play` / `result→over`。
 * ★ 别用固定 sleep：4.2 MB 包在 headless + swiftshader 下要十几秒才起来。
 */
const waitScreen = (want, timeout = 90000) =>
  page
    .waitForFunction((s) => window.__qa?.scene() === s, { timeout }, want)
    .then(
      () => true,
      () => false,
    )
const scene = () => page.evaluate(() => window.__qa?.scene() ?? null)

/** 游戏自己的存档视图（`__derbySave` 桥） */
const gsave = () => page.evaluate(() => (window.__derbySave ? window.__derbySave() : null))

/** 名字输入框现在是什么 */
const horseName = () => page.evaluate(() => document.getElementById('horse-name')?.value ?? null)

/** 余额等到某个值（扣分是宿主事务，偶尔 1.8 秒才回来 ⇒ 只能轮询） */
const waitBalance = (n, timeout = 20000) =>
  page.waitForFunction((v) => window.__kqf__.getState().balance === v, { timeout }, n).then(
    () => true,
    () => false,
  )

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
  check(`store 里当前游戏是 ${GAME_ID}`, (await snap()).active === GAME_ID, (await snap()).active)

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

console.log('\n【④ 进 tab：**不收费**，画室要真的画出来】')
{
  const pre = await snap()
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check(`补了 100 积分（${pre.balance} → ${before.balance}）`, before.balance === pre.balance + 100, String(before.balance))

  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))
  check('★ 进到画室（`__qa` 起来了）', await waitScreen('menu'))
  await wait(1200)

  const afterEnter = await snap()
  check(`★ 只是进来看一眼：积分没动（${before.balance} → ${afterEnter.balance}）`, afterEnter.balance === before.balance, '')
  check('兑换券没动（C 型零产出）', afterEnter.vouchers === before.vouchers, String(afterEnter.vouchers))

  const c1 = await gameColors('1-studio.png')
  check(`★ 画室画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  /*
   * 几何三条（真宿主独有的判据）：
   *   ① 容器高 == **父容器**高 —— 抓「plugin.js 误补 position:relative」
   *   ② 游戏自己的 `#dd-app` 挂载根铺满容器
   *   ③ 容器中心没被底栏 / 弹层盖住
   * 外加一条这一款专属的：**`#dd-app` 里不许有 position:fixed**
   *   （原版 `.launch-area` 是 fixed，构建期改成了 absolute；改漏了会盖住宿主的头尾）
   */
  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const root = el.querySelector('#dd-app')
    const rr = root ? root.getBoundingClientRect() : null
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    const fixed = root
      ? [...root.querySelectorAll('*')].filter((n) => getComputedStyle(n).position === 'fixed').length
      : -1
    return {
      h: Math.round(r.height),
      ph: Math.round(p.height),
      w: Math.round(r.width),
      rh: rr ? Math.round(rr.height) : -1,
      rw: rr ? Math.round(rr.width) : -1,
      hitInside: !!(hit && el.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() : '(null)',
      fixed,
    }
  }, GAME_ID)
  check('插件容器还在', !!geo, geo ? '' : '（容器不在 ⇒ 挂载失败了，看上面的 console.error）')
  check(
    `容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`,
    !!geo && Math.abs(geo.h - geo.ph) <= 1,
    geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '',
  )
  check(
    `★ #dd-app 铺满容器（${geo?.rw}×${geo?.rh} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.rw - geo.w) <= 2 && Math.abs(geo.rh - geo.h) <= 2,
    '',
  )
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)
  check('★ #dd-app 里没有 position:fixed（原版是 fixed，会盖住宿主头尾）', geo?.fixed === 0, `${geo?.fixed} 个`)

  const gone = await page.evaluate(() => ({
    login: document.body.innerText.includes('登录'),
    cloud: document.body.innerText.includes('跨设备'),
    board: document.body.innerText.includes('排行榜'),
    upload: document.body.innerText.includes('上传'),
  }))
  check('★ 页面上没有「登录」', !gone.login)
  check('★ 页面上没有「跨设备」', !gone.cloud)
  check('★ 页面上没有「排行榜」（已拆）', !gone.board)
  check('★ 页面上没有「上传」（录像库已拆）', !gone.upload)
}

console.log('\n【⑤ 画马这条链**全程不收费**：领养 → 预览 3D → 参赛页 → 改名 → 换赛制】')
{
  const base = (await snap()).balance

  check('点了「领养一匹」', await clickSel('#adopt'))
  await wait(900)
  const strokes = await page.evaluate(() => window.__derbySave?.().strokes?.length ?? 0)
  check(`★ 领养后纸上有笔画了（${strokes} 笔）`, strokes > 0, String(strokes))

  // 领养会清空名字（原版行为）⇒ 用「骰子」随机起一个，真实点击而不是伪造 input 事件
  check('点了名字旁边的骰子', await clickSel('#rename'))
  await page.waitForFunction(() => (document.getElementById('horse-name')?.value ?? '').length > 0, { timeout: 15000 }).catch(() => {})
  const nm = await horseName()
  check(`★ 名字有了（「${nm ?? ''}」）`, !!nm && nm.length > 0, nm ?? '(空)')

  check('切到「02 预览」', await clickSel('#preview-tab'))
  const worldOk = await page
    .waitForFunction(
      () => {
        const w = document.getElementById('world')
        if (!w || w.hidden) return false
        const r = w.getBoundingClientRect()
        return r.width > 100 && r.height > 100
      },
      { timeout: 60000 },
    )
    .then(
      () => true,
      () => false,
    )
  check('★ 3D 画布出来了（画的线真的变成了立体）', worldOk)
  await wait(1800)
  const c2 = await gameColors('2-preview.png')
  check(`★ 3D 预览画出来了（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)

  check('切到「03 参赛」', await clickSel('#entry-tab'))
  await wait(800)
  // `#traits` 里是 6 个 <span>（每项一条）+ 1 个 <small>（「满分 10」那行说明）⇒ 只数 span
  const traits = await page.evaluate(() => document.querySelectorAll('#traits > span').length)
  check(`★ 参赛页有六项性格（${traits} 项）`, traits === 6, String(traits))
  const c3 = await gameColors('3-entry.png')
  check(`★ 参赛页画出来了（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)

  /*
   * ★★ 这一条才是「按钮点得到」的真判据。
   *
   * `el.click()` **不走命中测试** —— 按钮被裁到容器外面、被别的层盖住、
   * 或者根本没在视口里，`.click()` 照样「成功」。所以上面第 ⑦ 段能扣款成功，
   * 不代表用户点得到。
   *
   * 2026-10-28 实测就栽在这：`#dd-app` 的高度由 `--window-h` 决定，
   * 而布局函数量的又是它自己 ⇒ 停在 100dvh(844)，容器只有 698，
   * 「03 送它去比赛」被裁在下面 146px，**手指完全够不到**，而 e2e 全绿。
   */
  const tap = await page.evaluate((id) => {
    const host = document.querySelector(`[data-plugin-host="${id}"]`)
    const btn = document.getElementById('start')
    if (!host || !btn) return null
    const hr = host.getBoundingClientRect()
    const r = btn.getBoundingClientRect()
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    return {
      inside: r.top >= hr.top - 1 && r.bottom <= hr.bottom + 1,
      bottom: Math.round(r.bottom),
      hostBottom: Math.round(hr.bottom),
      h: Math.round(r.height),
      hitSelf: !!(hit && (hit === btn || btn.contains(hit))),
      hitTag: hit ? `${hit.tagName.toLowerCase()}${hit.id ? '#' + hit.id : ''}` : '(null)',
    }
  }, GAME_ID)
  check('参赛页上有「03 送它去比赛」', !!tap)
  check(
    `★ 按钮整块在容器里（底 ${tap?.bottom} / 容器底 ${tap?.hostBottom}）`,
    !!tap?.inside,
    '被裁在容器外面 ⇒ 手指点不到，而 .click() 照样能点',
  )
  check(`★ 按钮有正常高度（${tap?.h}px）`, (tap?.h ?? 0) >= 40, String(tap?.h))
  check(`★ 按钮中心真的命中它自己（命中 ${tap?.hitTag}）`, !!tap?.hitSelf, '被别的层盖住时这里会红')

  check('换到「跨栏乱斗」赛制', await clickSel('#chaos'))
  await wait(600)
  const mode = await page.evaluate(() => document.getElementById('chaos')?.getAttribute('aria-pressed'))
  check('★ 赛制切过去了（aria-pressed=true）', mode === 'true', String(mode))

  const after = await snap()
  check(`★ 这一整条链一分没扣（${base} → ${after.balance}）`, after.balance === base, '画马 / 预览 / 起名 / 换赛制都不该收')
}

console.log('\n【⑥ 余额 0：点「送它去比赛」必须被挡住，且留在画室】')
{
  const cur = (await snap()).balance
  if (cur > 0) {
    await page.evaluate((n) => window.__kqf__.addPoints(-n), cur)
    await wait(600)
  }
  const before = await snap()
  check(`余额已压到 ${before.balance}（< ${PLAY_COST}）`, before.balance < PLAY_COST, String(before.balance))

  check('点了「03 送它去比赛」', await clickSel('#start'))
  await wait(2500)

  const after = await snap()
  const sc = await scene()
  check(`★ 积分没被扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '')
  check(`★ 还留在画室（scene=${sc}）`, sc === 'menu', '被挡了就不该开跑')
  // ★ 提示层（toast）是 Portal 到 document.body 的，不在插件容器里
  const toast = await page.evaluate(() => document.body.innerText.includes('积分不够'))
  check('弹了「积分不够」提示', toast)
}

console.log(`\n【⑦ 余额够：点「送它去比赛」必须 -${PLAY_COST}，并且真的开跑】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  check('点了「03 送它去比赛」', await clickSel('#start'))
  check('★ 进到比赛（scene=play）', await waitScreen('play', 60000))

  const charged = await waitBalance(before.balance - PLAY_COST)
  const after = await snap()
  check(`★ 积分 ${before.balance} → ${after.balance}（应为 ${before.balance - PLAY_COST}）`, charged, String(after.balance))
  check('兑换券没动', after.vouchers === before.vouchers, String(after.vouchers))

  // 等比赛真的跑起来（倒计时走完 time >= 0），再截一张
  const running = await page
    .waitForFunction(
      () => {
        const d = JSON.parse(document.getElementById('world')?.dataset.diagnostics || '{}')
        return typeof d.time === 'number' && d.time > 1.2
      },
      { timeout: 120000 },
    )
    .then(
      () => true,
      () => false,
    )
  check('★ 比赛跑起来了（time > 1.2）', running)
  await wait(600)
  const c4 = await gameColors('4-race.png')
  check(`★ 比赛画面画出来了（颜色 ${c4.n} 种）`, c4.n >= 20, c4.file)

  // 比赛中「回画室」**不收费**
  const mid = await snap()
  check('点了比赛里的「回画室」', await clickSel('#back'))
  check('★ 回到画室（scene=menu）', await waitScreen('menu', 20000))
  await wait(600)
  const afterBack = await snap()
  check(`★ 回画室不收费（${mid.balance} → ${afterBack.balance}）`, afterBack.balance === mid.balance, '')

  // 再点一次「送它去比赛」：**再扣一次**
  check('再点「03 送它去比赛」', await clickSel('#start'))
  check('★ 又开跑了', await waitScreen('play', 60000))
  const charged2 = await waitBalance(afterBack.balance - PLAY_COST)
  const after2 = await snap()
  check(`★ 第二场也扣了 ${PLAY_COST}（${afterBack.balance} → ${after2.balance}）`, charged2, String(after2.balance))

  check('回到画室（准备切走）', await clickSel('#back'))
  await waitScreen('menu', 20000)
}

console.log('\n【⑧ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  /*
   * ★ 挑一个「点一下就能改、重挂载后能读回」的字段当存档探针：
   *   静音开关（`#sound`）改完会 `save()` 写进存档（`m:1`），切回来读 `aria-pressed` 就知道存档通没通。
   *   只比「界面上有字」没有用 —— 同一份内存里读回恒真。
   */
  const beforeMuted = await page.evaluate(() => document.getElementById('sound')?.getAttribute('aria-pressed'))
  check('点了静音（存档探针）', await clickSel('#sound'))
  await wait(900)
  mutedBefore = await page.evaluate(() => document.getElementById('sound')?.getAttribute('aria-pressed'))
  check(`静音读出来是 ${mutedBefore}（改前 ${beforeMuted}，改后应为 true）`, mutedBefore === 'true' && beforeMuted !== 'true', String(mutedBefore))

  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(2500)

  const gone = await page.evaluate(() => ({
    qa: typeof window.__qa,
    save: typeof window.__derbySave,
    diag: typeof window.__derbyDiagnostics,
    tutorial: typeof window.__derbyTutorial,
    archive: typeof window.__derbyArchive,
    board: typeof window.__derbyBoard,
    gp: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
  }))
  check('★ `__qa` 已摘（卸载真跑了）', gone.qa === 'undefined', gone.qa)
  check('★ `__derbySave` 也没有', gone.save === 'undefined', gone.save)
  check('★ `__derbyDiagnostics` 也没有', gone.diag === 'undefined', gone.diag)
  check('★ `__derbyTutorial` 也没有', gone.tutorial === 'undefined', gone.tutorial)
  check('★ `__derbyArchive` 也没有', gone.archive === 'undefined', gone.archive)
  check('★ `__derbyBoard` 也没有', gone.board === 'undefined', gone.board)
  check('★ `__gpPlayable` 也没有（原版的钩子没留）', gone.gp === 'undefined', gone.gp)
  check('★ `__gpReady` 也没有', gone.ready === 'undefined', gone.ready)

  const left = await page.evaluate(() => ({
    root: !!document.getElementById('dd-app'),
    // ★ 别数「页面上有几个 <style>」：宿主自己也有一两个。只数**游戏那份**。
    own: [...document.querySelectorAll('style')].filter((s) => (s.textContent ?? '').includes('#dd-app')).length,
    canvas: document.querySelectorAll('#dd-app canvas').length,
  }))
  check('★ `#dd-app` 挂载根摘掉了', !left.root)
  check('★ 没有残留的 <style>（样式跟着根一起走）', left.own === 0, `含 #dd-app 的 <style> ${left.own} 个`)
  check('容器里 canvas 也摘掉了', left.canvas === 0, String(left.canvas))

  const html = await page.evaluate(() => ({
    fs: document.documentElement.style.fontSize,
    lang: document.documentElement.lang,
    title: document.title,
  }))
  check('★ 没在 <html> 上留 fontSize（宿主是 rem 布局）', !html.fs, html.fs || '(空)')
  check('★ 没改 <html lang>（原版 i18n.setLang 会写）', html.lang === 'zh-CN' || html.lang === '', html.lang || '(空)')
  check('★ 没改宿主标题（原版 applyLang 会写）', !/Doodle Derby/i.test(html.title), html.title)

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑨ 切回：存档读得回】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('★ 第二次挂载也起来了', await waitScreen('menu'))
  await wait(1500)

  const mid = await snap()
  check(`★ 重新挂载不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, '进 tab 本来就不收费')

  const nowMuted = await page.evaluate(() => document.getElementById('sound')?.getAttribute('aria-pressed'))
  check(`★ 存档读回来了（静音 ${nowMuted} / 切走前 ${mutedBefore}）`, nowMuted === mutedBefore, '')

  const c5 = await gameColors('5-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c5.n} 种）`, c5.n >= 20, c5.file)
}

console.log('\n【⑩ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader|favicon|The AudioContext/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
  check('没有非 favicon 的 4xx/5xx', badResponses.length === 0, badResponses.slice(0, 4).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
