#!/usr/bin/env node
/**
 * **方块填空在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→ 选题目录（不收费）
 * → 点第 1 题（扣 10）→ 对局中切走（卸载）→ 切回（再开一局，**再扣一次**）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4392 --strictPort
 * node scripts/e2e-blockfit.mjs http://127.0.0.1:4392/ phone
 * node scripts/e2e-blockfit.mjs http://127.0.0.1:4392/ tablet
 * ```
 *
 * ## 为什么不能只靠前两层
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `blockfit/scripts/mount-test.mjs`（假宿主） | 插件按契约工作、0×404、收费闸门、卸载 | 真宿主的 HostApi 有没有接对 |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里的 IndexedDB / WebGL / blob 模块 |
 *
 * ## 收费点在「点开一道题」，不是「进 tab」、也不是「进选题目录」
 *
 * | | 蚂蚁搬家（放置） | 方块填空（一局制） |
 * | --- | --- | --- |
 * | 进 tab | 扣 15 | **不扣**（看一眼不该收钱） |
 * | 进选题目录 | — | **不扣**（那只是翻目录） |
 * | 点开一道题 | — | 扣 10 |
 * | 切回来 | 10 分钟内不扣 | **再开一局就再扣**（没有宽限期，这是设计） |
 *
 * ★ 第 ⑦ 段那条断言的方向最容易抄错：照搬放置类会变成「切回来不许再扣」，
 *   而这一款**应该**扣 —— 抄错会把 bug 写成规范。
 *
 * ## ★★ 这作整屏 UI 都在 canvas 里，容器里**一个 DOM 按钮都没有**
 *
 * `container.querySelectorAll('button')` 恒为 0 ⇒ 按选择器点的那套（melonjar /
 * ropeland 的 `tapGame`）在这里**点不到任何东西**。两条错误做法：
 *
 *   ① 在测试里复刻 `buildTitle` / `buildSelect` 的布局数学算坐标 ——
 *      那份数学一旦漂移，测试点到空白处，而**点空了不会报错** ⇒ 照样绿。
 *   ② 直接调 `window.__debug.start(0)` 开局 —— 绕过了「孩子能不能点到那张卡」，
 *      收费断言恒真。
 *
 * 所以游戏里加了 `__debug.hits()`：返回当前场景里可点控件的**真实矩形**（`getBounds()`）。
 * 测试拿矩形中心点 `page.mouse.click`（真鼠标 ⇒ 走命中测试、派发 pointerdown），
 * 既不用复刻布局，也真的经过「点中那颗按钮」这条路。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'
import { grantGame } from './lib/own.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4392/'
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
const GAME_ID = 'blockfit'
/** 底栏那一格的字，和商城名一致（4 个字）。 */
const TAB_LABEL = '方块填空'
/** 一局的票价，必须和 `task-games/blockfit/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 10

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/blockfit/${VIEWPORT}`
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

/**
 * 点插件容器里**由 Pixi 画出来**的控件：拿 `__debug.hits()` 给的真实矩形，用真鼠标点。
 *
 * ★ 必须 `page.mouse.click`：游戏监听 `pointerdown`（触摸要跟手），
 *   `el.click()` 派发的 `click` 静默无反应；而且真鼠标走命中测试，
 *   被顶栏/底栏盖住会真的点不到。
 */
const tapHit = async (kind, index = 0) => {
  const box = await page.evaluate(([id, k, i]) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el || !window.__debug?.hits) return null
    const r0 = el.getBoundingClientRect()
    const hit = window.__debug.hits()[k]?.[i]
    if (!hit || !hit.w || !hit.h) return null
    return { x: r0.x + hit.x + hit.w / 2, y: r0.y + hit.y + hit.h / 2 }
  }, [GAME_ID, kind, index])
  if (!box) return false
  await page.mouse.click(box.x, box.y)
  return true
}

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

/** 当前场景名（游戏自己的 `__debug.state.scene`）。 */
const scene = () => page.evaluate(() => window.__debug?.state?.scene ?? null)

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
  check('gameKv 里没有 blockfit 的行', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
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
  for (let round = 0; round < 2; round++) {
    const locked = await page.evaluate(() => document.body.innerText.includes('请输入家长密码'))
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
  check('过了家长密码', !(await page.evaluate(() => document.body.innerText.includes('请输入家长密码'))))

  check('游戏列表在页面上', await waitFor(`[data-local-row="${GAME_ID}"]`, 12000))
  /* 2026-10-30 起「没拥有不能装」—— 先预置拥有，否则下面找不到安装按钮 */
  await grantGame(page, GAME_ID)

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
  check('store 里当前游戏是 blockfit', (await snap()).active === GAME_ID, (await snap()).active)

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
  /*
   * 判据三条，缺一条都会漏：
   *   ① 文字 == TAB_LABEL，不是被截断的前缀；
   *   ② 文字那一格**只占一行** —— 折行会把 nav 撑高、把内容区挤小，
   *      而「文字里有这 4 个字」照样绿；
   *   ③ 文字没横向溢出（`scrollWidth <= clientWidth + 1`）。
   */
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
  check(`★ 那一格写的是「${TAB_LABEL}」（4 个字）`, tab?.label === TAB_LABEL, tab?.label ?? '(无)')
  check('★ 文字只占一行（没折行）', tab?.lines === 1, `${tab?.lines} 行 / 高 ${tab?.lh}px`)
  check('文字没横向溢出', (tab?.overflow ?? 99) <= 1, `溢出 ${tab?.overflow}px`)
  check('底栏没被撑高（< 100px）', (tab?.navH ?? 999) < 100, `nav 高 ${tab?.navH}px`)
  check('这一格宽度正常（≥ 60px）', (tab?.btnW ?? 0) >= 60, `${tab?.btnW}px`)
}

console.log('\n【④ 进 tab：**不收费**，先看一眼】')
{
  const pre = await snap()
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check(`补了 100 积分（${pre.balance} → ${before.balance}）`, before.balance === pre.balance + 100, String(before.balance))

  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))

  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__gpReady`）', up)
  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 资源加载完成（`__gpPlayable`）', playable)
  await wait(1200)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里有 canvas', canvas === 1, String(canvas))

  const after = await snap()
  check(`★ 只是进来看一眼：积分没动（${before.balance} → ${after.balance}）`, after.balance === before.balance, `票价 ${PLAY_COST} 在「点开一道题」时才收`)
  check('兑换券没动（C 型零产出）', after.vouchers === before.vouchers, String(after.vouchers))

  const c1 = await gameColors('1-title.png')
  check(`★ 标题屏画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    // 容器不在（挂载失败 / 已被卸载）时返回 null —— 别让整条脚本崩在这里，
    // 否则后面那些「有没有报错」的断言根本没机会打印
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
      hitTag: hit ? hit.tagName.toLowerCase() + (hit.className ? '.' + String(hit.className).slice(0, 24) : '') : '(null)',
    }
  }, GAME_ID)
  check('插件容器还在', !!geo, geo ? '' : '（容器不在 ⇒ 挂载失败了，看上面的 console.error）')
  check(`容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`, !!geo && Math.abs(geo.h - geo.ph) <= 1, geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '')
  check(`canvas 铺满容器（${geo?.cw}×${geo?.ch} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)
}

console.log('\n【⑤ 点「选择题目」：翻目录也**不收费**】')
{
  const before = await snap()
  check('点中了「选择题目」那颗按钮', await tapHit('title', 0))
  const ok = await page.waitForFunction(() => window.__debug?.state?.scene === 'select', { timeout: 20000 })
    .then(() => true, () => false)
  check('★ 进了选题目录', ok, `scene=${await scene()}`)
  const after = await snap()
  check(`★ 翻目录不扣分（${before.balance} → ${after.balance}）`, after.balance === before.balance, `点开一道题才收 ${PLAY_COST}`)

  const cards = await page.evaluate(() => window.__debug.hits().cards.filter(Boolean).length)
  check('选题目录里 15 张卡都在', cards === 15, `${cards} 张`)

  await wait(600)
  const c2 = await gameColors('2-select.png')
  check(`★ 选题目录画出来了（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)
}

console.log(`\n【⑥ 点开第 1 题：积分必须 -${PLAY_COST}，券一分不动】`)
{
  const before = await snap()
  check('点中了第 1 张题卡', await tapHit('cards', 0))
  const ok = await page.waitForFunction(() => window.__debug?.state?.scene === 'play', { timeout: 30000 })
    .then(() => true, () => false)
  check('★ 进对局了', ok, `scene=${await scene()}`)

  const after = await snap()
  check(`★ 积分 ${before.balance} → ${before.balance - PLAY_COST}`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动', after.vouchers === before.vouchers, String(after.vouchers))

  const pieces = await page.evaluate(() => window.__debug.state.placed.length)
  check('棋盘上有拼片（不是空棋盘）', pieces >= 3, `${pieces} 块`)

  const coins = await page.evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID).catch(() => 0)
  check('游戏币余额为 0（本作不发行币）', !coins, String(coins))

  await wait(1500)
  const c3 = await gameColors('3-play.png')
  check(`★ 对局画面不是空白（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)
}

console.log('\n【⑦ 对局中切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1800)

  const gone = await page.evaluate(() => ({
    playable: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
    debug: typeof window.__debug,
  }))
  check('★ `__gpPlayable` 已摘（卸载真跑了）', gone.playable === 'undefined', gone.playable)
  check('`__gpReady` 也摘掉了', gone.ready === 'undefined', gone.ready)
  check('`__debug` 也摘掉了', gone.debug === 'undefined', gone.debug)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  check('★ gameKv 里出现 blockfit 的行（存档落盘）', (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑧ 切回：再挂一次要能画出来；再开一局**再扣一次**】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 还是 1', canvas === 1, String(canvas))

  const mid = await snap()
  check(`重新挂载本身不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, `票价 ${PLAY_COST} 在「点开一道题」时才收`)

  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 60000 }).then(() => true, () => false)
  check('资源第二次也加载完成', playable)
  await wait(1200)

  /*
   * ★★ 这条是 PixiJS 插件最容易死的地方：`app.destroy()` 如果把纹理一起销毁，
   *    模块级纹理缓存第二次挂载会交出**已销毁的 Texture** ⇒ 画面全白而**一个错都不报**。
   *    DOM 断言（canvas 个数）完全抓不到。
   */
  const c4 = await gameColors('4-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c4.n} 种）`, c4.n >= 20, c4.file)

  /*
   * ★ 本作**没有宽限期**：每一局都是新的一局。所以再开一局必须再扣一次。
   *   这条的方向和蚂蚁搬家相反 —— 照抄那边会把「该收费没收费」当成绿。
   */
  check('再点「选择题目」', await tapHit('title', 0))
  const back = await page.waitForFunction(() => window.__debug?.state?.scene === 'select', { timeout: 20000 })
    .then(() => true, () => false)
  check('又进了选题目录', back)
  check('再点开第 1 题', await tapHit('cards', 0))
  const started2 = await page.waitForFunction(() => window.__debug?.state?.scene === 'play', { timeout: 30000 })
    .then(() => true, () => false)
  check('第二局也进对局了', started2)

  const after = await snap()
  check(`★ 第二局又扣了 ${PLAY_COST}（${mid.balance} → ${mid.balance - PLAY_COST}）`, after.balance === mid.balance - PLAY_COST, String(after.balance))
}

console.log('\n【⑨ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader|PixiJS/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
