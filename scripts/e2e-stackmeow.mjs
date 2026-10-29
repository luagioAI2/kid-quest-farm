#!/usr/bin/env node
/**
 * **堆呀堆在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→ 点「开始」（扣 10）
 * → 对局中切走（卸载）→ 切回（存档读得回来；再开一局**再扣一次**）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
 * node scripts/e2e-stackmeow.mjs http://127.0.0.1:4393/ phone
 * node scripts/e2e-stackmeow.mjs http://127.0.0.1:4393/ tablet
 * ```
 *
 * ## 为什么不能只靠前两层
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `stackmeow/scripts/_probe.mjs`（独立网页 + 真 Chrome） | 0×404、字体加载、标题页画得出来 | 宿主 HostApi 有没有接对、容器高度 |
 * | `check-plugin.mjs`（静态规则） | 裸说明符 / 动态 import / manifest / 经济闸门 | 运行期、CSS 作用域 |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里的 IndexedDB / WebGL / blob 模块 |
 *
 * ## 收费点在「开始」，不是「进 tab」
 *
 * | | 蚂蚁搬家（放置） | 堆呀堆（一局制） |
 * | --- | --- | --- |
 * | 进 tab | 扣 15 | **不扣**（看一眼不该收钱） |
 * | 点「开始」 | — | 扣 10 |
 * | 点「继续」 | — | **不扣**（那是接着上一局） |
 * | 切回来 | 10 分钟内不扣 | 再开一局就再扣（没有宽限期，这是设计） |
 *
 * ★ 第 ⑧ 段那条断言的方向最容易抄错：照搬放置类会变成「切回来不许再扣」，
 *   而这一款**应该**扣 —— 抄错会把 bug 写成规范。
 *
 * ## 这作的 UI 是**真 DOM**（`ui.js` 那一层），所以点的是真 `<button>`
 *
 * 但「点得到」不能只看 `el.click()` 成不成 —— 它**不走命中测试**，被弹层盖住
 * 照样点得到。所以每颗按钮都额外验一条：中心点的 `elementFromPoint` 命中它自己。
 *
 * ## 调试桥是 `window.__stackmeow`（不是 `__gpReady` / `__dbg`）
 *
 * 卸载时**必须**跟着删：留着 `ready: true` 会骗过下一次「已就绪」判断。
 * 所以第 ⑦ 段既验「切走后它消失」，也验「切回来它又在了」。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'
import { grantGame } from './lib/own.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4393/'
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
const GAME_ID = 'stackmeow'
/** 底栏那一格的字，和商城名一致（3 个字）。 */
const TAB_LABEL = '堆呀堆'
/** 一局的票价，必须和 `task-games/stackmeow/plugin.js` 的 PLAY_COST 一致 */
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
 * 点**插件容器里**那颗按钮（游戏自己的 DOM 界面层）。
 *
 * 返回 `{ found, hittable }`：`hittable` 是「中心点的 elementFromPoint 命中它自己」，
 * 专门抓「按钮在 DOM 里、但被宿主的顶栏/底栏/弹层盖住」——`el.click()` 抓不到这种。
 *
 * ★★ 必须派 **`pointerdown`**，不能 `el.click()`：`ui.js` 里每颗按钮都是
 *    `addEventListener("pointerdown", …)`（触摸要跟手）。派 `click` 会**静默无反应**，
 *    而 `found` / `hittable` 照样是 true —— 症状是「按钮点得到但游戏不动」。
 */
const clickInGame = async (text) =>
  page.evaluate(([id, t]) => {
    const host = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!host) return { found: false }
    // 只找**看得见**的：标题/结算/暂停三层同时挂在 DOM 里，看不见的那几层不该被点到
    const b = [...host.querySelectorAll('button')].find(
      (x) => (x.innerText ?? '').includes(t) && x.offsetParent !== null,
    )
    if (!b) return { found: false }
    const r = b.getBoundingClientRect()
    if (!r.width || !r.height) return { found: true, hittable: false, why: '尺寸为 0' }
    const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2))
    const hittable = !!(hit && (hit === b || b.contains(hit)))
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    return { found: true, hittable, hit: hit ? hit.tagName.toLowerCase() : '(null)' }
  }, [GAME_ID, text])

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

/** 游戏自己的状态（`__stackmeow` 桥）。没有桥就返回 null。 */
const gs = () => page.evaluate(() => window.__stackmeow?.state?.() ?? null)

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

console.log('\n【③ 底栏那一格：3 个字要一行放得下】')
{
  /*
   * 判据四条，缺一条都会漏：
   *   ① 文字 == TAB_LABEL，不是被截断的前缀；
   *   ② 文字那一格**只占一行** —— 折行会把 nav 撑高、把内容区挤小，
   *      而「文字里有这 3 个字」照样绿；
   *   ③ 文字没横向溢出（`scrollWidth <= clientWidth + 1`）；
   *   ④ 底栏没被撑高。
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
  check(`★ 那一格写的是「${TAB_LABEL}」`, tab?.label === TAB_LABEL, tab?.label ?? '(无)')
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

  const up = await page.waitForFunction(() => window.__stackmeow?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__stackmeow.ready`）', up)
  const titleUp = await page.waitForFunction(() => window.__stackmeow?.state?.().ui === 'title', { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 到了标题页', titleUp)
  await wait(1200)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里有 canvas', canvas === 1, String(canvas))

  const after = await snap()
  check(`★ 只是进来看一眼：积分没动（${before.balance} → ${after.balance}）`, after.balance === before.balance, `票价 ${PLAY_COST} 在「开始」时才收`)
  check('兑换券没动（C 型零产出）', after.vouchers === before.vouchers, String(after.vouchers))

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
      hitTag: hit ? hit.tagName.toLowerCase() + (hit.className ? '.' + String(hit.className).slice(0, 24) : '') : '(null)',
    }
  }, GAME_ID)
  check('插件容器还在', !!geo, geo ? '' : '（容器不在 ⇒ 挂载失败了，看上面的 console.error）')
  check(`容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`, !!geo && Math.abs(geo.h - geo.ph) <= 1, geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '')
  check(`canvas 铺满容器（${geo?.cw}×${geo?.ch} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)

  const start = await page.evaluate((id) => {
    const host = document.querySelector(`[data-plugin-host="${id}"]`)
    const b = host && [...host.querySelectorAll('button')].find((x) => (x.innerText ?? '').includes('开始'))
    return !!b
  }, GAME_ID)
  check('★ 标题屏上有「开始」这颗按钮（DOM 界面层挂上了）', start)
}

console.log('\n【⑤ 余额不足：点「开始」必须被挡住，一分不扣】')
{
  const cur = (await snap()).balance
  if (cur > 0) {
    await page.evaluate((n) => window.__kqf__.addPoints(-n), cur)
    await wait(600)
  }
  const before = await snap()
  check(`余额已压到 ${before.balance}（< ${PLAY_COST}）`, before.balance < PLAY_COST, String(before.balance))

  const probe = await clickInGame('开始')
  check('「开始」点得到（没被盖住）', probe.found && probe.hittable, JSON.stringify(probe))
  await wait(1500)

  const after = await snap()
  check(`★ 积分没被扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '')
  check(`★ 没进对局（ui=${(await gs())?.ui}）`, (await gs())?.ui === 'title', '')
  // ★ 提示层（toast）是 **Portal 到 `document.body`** 的，不在插件容器里
  const toast = await page.evaluate(() => document.body.innerText.includes('积分不够'))
  check('弹了「积分不够」提示', toast)
}

console.log(`\n【⑥ 余额够：点「开始」必须 -${PLAY_COST}，券一分不动】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  const probe = await clickInGame('开始')
  check('「开始」点得到', probe.found && probe.hittable, JSON.stringify(probe))
  const ok = await page.waitForFunction(() => window.__stackmeow?.state?.().ui === 'game', { timeout: 30000 })
    .then(() => true, () => false)
  check('★ 进了对局', ok, `ui=${(await gs())?.ui}`)

  const after = await snap()
  check(`★ 积分 ${before.balance} → ${before.balance - PLAY_COST}`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动', after.vouchers === before.vouchers, String(after.vouchers))

  const coins = await page.evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID).catch(() => 0)
  check('游戏币余额为 0（本作不发行币）', !coins, String(coins))

  // 真放两块下去，让「对局」这件事在画面上留下痕迹（不然截的还是标题塔）
  for (let i = 0; i < 3; i++) {
    const beforeStacked = (await gs())?.stacked ?? 0
    const placed = await page.evaluate(() => {
      const b = window.__stackmeow
      if (!b || b.state().mode !== 1) return false
      b.setDropX(b.getCenter())
      return true
    })
    if (!placed) break
    await page.mouse.click(SIZE.width / 2, SIZE.height * 0.6)
    await page.waitForFunction((k) => window.__stackmeow.state().stacked > k, { timeout: 8000 }, beforeStacked)
      .catch(() => {})
    await wait(300)
  }
  const st = await gs()
  check(`★ 真放下去了（stacked=${st?.stacked}）`, (st?.stacked ?? 0) >= 2, '')

  await wait(1200)
  const c3 = await gameColors('3-play.png')
  check(`★ 对局画面不是空白（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)
}

console.log('\n【⑦ 对局中切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1800)

  const gone = await page.evaluate(() => ({
    bridge: typeof window.__stackmeow,
    gp: typeof window.__gpPlayable,
  }))
  check('★ `__stackmeow` 已摘（卸载真跑了）', gone.bridge === 'undefined', gone.bridge)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  const styles = await page.evaluate(() =>
    [...document.querySelectorAll('style')].filter((s) => (s.textContent ?? '').includes('.uirt')).length)
  check('注入的 <style> 也摘掉了（`.uirt` 那条）', styles === 0, `${styles} 份`)

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑧ 切回：再挂一次要能画出来；存档读得回；再开一局**再扣一次**】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__stackmeow?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 还是 1', canvas === 1, String(canvas))

  const mid = await snap()
  check(`重新挂载本身不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, `票价 ${PLAY_COST} 在「开始」时才收`)

  await page.waitForFunction(() => window.__stackmeow?.state?.().ui === 'title', { timeout: 60000 })
  await wait(1200)

  /*
   * ★★ 这条是 PixiJS 插件最容易死的地方：`app.destroy()` 如果把纹理一起销毁，
   *    模块级 `PIXI.Assets` 缓存第二次挂载会交出**已销毁的 Texture** ⇒ 画面全黑
   *    而**一个错都不报**。DOM 断言（canvas 个数）完全抓不到。
   */
  const c4 = await gameColors('4-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c4.n} 种）`, c4.n >= 20, c4.file)

  // 存档读回：上一局的中途存档进了 `latestSync` ⇒ 标题页多一颗「继续」
  const hasResume = await page.evaluate((id) => {
    const host = document.querySelector(`[data-plugin-host="${id}"]`)
    return [...host.querySelectorAll('button')].some((x) => (x.innerText ?? '').includes('继续'))
  }, GAME_ID)
  check('★ 存档读回来了（标题页有「继续」）', hasResume, '上一局的 `putLatest` 落盘 → 这次 boot 读得到')

  /*
   * ★ 本作**没有宽限期**：每一局都是新的一局。所以再开一局必须再扣一次。
   *   这条的方向和蚂蚁搬家相反 —— 照抄那边会把「该收费没收费」当成绿。
   */
  const probe = await clickInGame('开始')
  check('再点「开始」', probe.found && probe.hittable, JSON.stringify(probe))
  const started2 = await page.waitForFunction(() => window.__stackmeow?.state?.().ui === 'game', { timeout: 30000 })
    .then(() => true, () => false)
  check('第二局也进去了', started2)

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
