#!/usr/bin/env node
/**
 * **爆汁瓜瓜罐在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→
 * 开始游戏（扣 8）→ 对局中切走（卸载）→ 切回（再开一局，**再扣一次**）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4398 --strictPort
 * node scripts/e2e-melonjar.mjs http://127.0.0.1:4398/ phone
 * node scripts/e2e-melonjar.mjs http://127.0.0.1:4398/ tablet
 * ```
 *
 * ## 为什么不能只靠前两层
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `melonjar/scripts/mount-test.mjs`（假宿主） | 插件按契约工作、0×404、收费闸门、卸载 | 真宿主的 HostApi 有没有接对 |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里的 IndexedDB / WebGL / blob 模块 |
 *
 * ## 收费点在「开始游戏」，不是「进 tab」
 *
 * 这款有清晰的「一局」边界（罐口溢出就结算）。判据和放置类（蚂蚁搬家）**正好相反**：
 *
 * | | 蚂蚁搬家（放置） | 爆汁瓜瓜罐（一局制） |
 * | --- | --- | --- |
 * | 进 tab | 扣 15 | **不扣**（看一眼不该收钱） |
 * | 点开始 | — | 扣 8 |
 * | 切回来 | 10 分钟内不扣 | **再开一局就再扣**（没有宽限期，这是设计） |
 *
 * ★ 第 ⑦ 段那条断言的方向最容易抄错：照搬放置类会变成「切回来不许再扣」，
 *   而这一款**应该**扣 —— 抄错会把 bug 写成规范。
 *
 * ## 这作没有 `__mgs` 那种调试钩子
 *
 * 「进没进对局」只能看 DOM：`#title-screen` 带 `hidden`、`#hud` 的 visibility 变 visible。
 * 所以别指望 `window.__xxx.battle` 那种判据。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'
import { grantGame } from './lib/own.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4398/'
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
const GAME_ID = 'melonjar'
/** 底栏那一格的字。**5 个字**，和商城名一致。 */
const TAB_LABEL = '爆汁瓜瓜罐'
/** 一局的票价，必须和 `task-games/melonjar/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 8

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/melonjar/${VIEWPORT}`
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
  // ★ 只留 message 定不到位置（Pixi 的栈全在 bundle 里）。把前 4 帧带上，
  //   临时排障用；正常跑只是多几个字符。
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
 * 在插件容器**里面**按文字点一颗游戏按钮 —— **必须真鼠标**。
 *
 * 这作的 UI 监听的是 `pointerdown`（不是 `click`），所以 `el.click()` 派发的
 * 是 `click` 事件，**静默无反应**；而且真鼠标会走命中测试，被盖住会真的点不到
 * （`el.click()` 绕过命中测试 ⇒ 遮住也绿）。
 */
const tapGame = async (txt, scope = '') => {
  const box = await page.evaluate(
    ([id, t, sc]) => {
      const root = document.querySelector(`[data-plugin-host="${id}"]`)
      if (!root) return null
      const el = [...root.querySelectorAll(`${sc} button, ${sc} .lang-btn`)]
        .find((e) => { const s = (e.textContent || '').trim(); return s === t || s.startsWith(t) })
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) return null
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    },
    [GAME_ID, txt, scope],
  )
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

/** 进没进对局：标题屏收起 + HUD 可见。本作没有调试钩子，只能看 DOM。 */
const inRun = () =>
  page.evaluate((id) => {
    const root = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!root) return false
    const t = root.querySelector('#title-screen')
    const hud = root.querySelector('#hud')
    return !!t && t.hidden === true && !!hud && getComputedStyle(hud).visibility === 'visible'
  }, GAME_ID)

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
  check('gameKv 里没有 melonjar 的行', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
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
  check('store 里当前游戏是 melonjar', (await snap()).active === GAME_ID, (await snap()).active)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('返回'),
    )
    if (b) b.click()
  })
  await wait(700)
  await waitForApp()
}

console.log('\n【③ 底栏那一格：5 个字要一行放得下】')
{
  /*
   * 判据三条，缺一条都会漏：
   *   ① 文字 == TAB_LABEL（5 个字），不是被截断的前缀；
   *   ② 文字那一格**只占一行** —— 折行会把 nav 撑高、把内容区挤小，
   *      而「文字里有这 5 个字」照样绿；
   *   ③ 文字没横向溢出（`scrollWidth <= clientWidth + 1`）。
   */
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    if (!b) return null
    const spans = [...b.querySelectorAll('span')]
    const lbl = spans[spans.length - 1]
    const nav = b.closest('nav')
    const r = lbl.getBoundingClientRect()
    // Range 行盒数：折行时 > 1
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
  check(`★ 那一格写的是「${TAB_LABEL}」（5 个字）`, tab?.label === TAB_LABEL, tab?.label ?? '(无)')
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
  check(`★ 只是进来看一眼：积分没动（${before.balance} → ${after.balance}）`, after.balance === before.balance, `票价 ${PLAY_COST} 在「开始游戏」时才收`)
  check('兑换券没动（B 型不产出）', after.vouchers === before.vouchers, String(after.vouchers))

  const c1 = await gameColors('1-title.png')
  check(`★ 标题屏画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  /*
   * ---- 几何 + 遮挡 ----
   * ① 容器高 == 父容器高（判据读 computed style，不是 inline）；
   * ② canvas 铺满容器；
   * ③ 容器中心点没被底栏/弹层盖住（`el.click()` 走不到命中测试，别的断言抓不到）。
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
      h: Math.round(r.height), ph: Math.round(p.height), w: Math.round(r.width),
      cw: Math.round(cr.width), ch: Math.round(cr.height),
      hitInside: !!(hit && el.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() + (hit.className ? '.' + String(hit.className).slice(0, 24) : '') : '(null)',
    }
  }, GAME_ID)
  check(`容器高 == 父容器高（${geo.h} / ${geo.ph}）`, Math.abs(geo.h - geo.ph) <= 1, `${geo.w}×${geo.h} vs 父 ${geo.ph}`)
  check(`canvas 铺满容器（${geo.cw}×${geo.ch} / ${geo.w}×${geo.h}）`,
    Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', geo.hitInside, `命中的是 ${geo.hitTag}`)
}

console.log(`\n【⑤ 开始游戏：积分必须 -${PLAY_COST}，券一分不动】`)
{
  const before = await snap()
  check('点了「开始游戏」', await tapGame('开始游戏'))

  const started = await page.waitForFunction(
    (id) => {
      const root = document.querySelector(`[data-plugin-host="${id}"]`)
      return !!root && root.querySelector('#title-screen')?.hidden === true
    },
    { timeout: 40000 }, GAME_ID,
  ).then(() => true, () => false)
  check('★ 进对局了（标题屏收起）', started)
  check('HUD 已显示', await inRun())

  const after = await snap()
  check(`★ 积分 ${before.balance} → ${before.balance - PLAY_COST}`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动', after.vouchers === before.vouchers, String(after.vouchers))

  const coins = await page.evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID).catch(() => 0)
  check('游戏币余额为 0（本作不发行币）', !coins, String(coins))

  await wait(1500)
  const c2 = await gameColors('2-play.png')
  check(`★ 对局画面不是空白（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)
}

console.log('\n【⑥ 对局中切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1800)

  const gone = await page.evaluate(() => ({
    playable: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
    style: !!document.getElementById('mj-style'),
  }))
  check('★ `__gpPlayable` 已摘（卸载真跑了）', gone.playable === 'undefined', gone.playable)
  check('`__gpReady` 也摘掉了', gone.ready === 'undefined', gone.ready)
  check('作用域 <style> 也摘掉了', gone.style === false, String(gone.style))

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  check('★ gameKv 里出现 melonjar 的行（存档落盘）', (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑦ 切回：再挂一次要能画出来；再开一局**再扣一次**】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 还是 1', canvas === 1, String(canvas))

  const mid = await snap()
  check(`重新挂载本身不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, `票价 ${PLAY_COST} 在「开始游戏」时才收`)

  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 60000 }).then(() => true, () => false)
  check('资源第二次也加载完成', playable)
  await wait(1200)

  /*
   * ★★ 这条是 PixiJS 插件最容易死的地方：`app.destroy()` 如果把纹理一起销毁，
   *    模块级纹理缓存第二次挂载会交出**已销毁的 Texture** ⇒ 画面全白而**一个错都不报**。
   *    DOM 断言（canvas 个数）完全抓不到。
   */
  const c3 = await gameColors('3-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)

  /*
   * ★ 本作**没有宽限期**：每一局都是新的一局。所以再开一局必须再扣一次。
   *   这条的方向和蚂蚁搬家相反 —— 照抄那边会把「该收费没收费」当成绿。
   */
  check('再点一次「开始游戏」', await tapGame('开始游戏'))
  const started2 = await page.waitForFunction(
    (id) => {
      const root = document.querySelector(`[data-plugin-host="${id}"]`)
      return !!root && root.querySelector('#title-screen')?.hidden === true
    },
    { timeout: 40000 }, GAME_ID,
  ).then(() => true, () => false)
  check('第二局也进对局了', started2)

  const after = await snap()
  check(`★ 第二局又扣了 ${PLAY_COST}（${mid.balance} → ${mid.balance - PLAY_COST}）`, after.balance === mid.balance - PLAY_COST, String(after.balance))
}

console.log('\n【⑧ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader|PixiJS/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
