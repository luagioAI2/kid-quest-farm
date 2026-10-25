#!/usr/bin/env node
/**
 * **甜点魔法学院在真 App 里走一遍**：安装 → 设为当前 → 玩一局（扣分）→ 切走切回 → 卸载。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4396 --strictPort
 * node scripts/e2e-sugar.mjs http://127.0.0.1:4396/
 * ```
 *
 * ## 为什么不能只靠前两层
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `sugar/scripts/mount-test.mjs`（假宿主） | 插件按契约工作、0×404、扣分闸门 | 真宿主的 HostApi 有没有接对 |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里的 IndexedDB / WebGL / blob 模块 |
 *
 * 尤其是 **`mount` 返回 Promise**：假宿主里脚本自己 `await mount()`，
 * 所以「宿主把 Promise 当函数用」这类 bug 在那边**永远绿**。
 *
 * ## 每条断言都要有能失败的前提
 *
 * ① 动手前「一款都没装」——否则后面每条「装上了」都可能恒真；
 * ② 装完不看返回值，看**界面那一行变成已装**；
 * ③ 开局不看画面，看**积分 -20**（钱真的走了）；
 * ④ 顺便证伪：**币和券一分都不许动**（这是 B 型的定义，不是「顺便看看」）；
 * ⑤ 切走之后 `window.__debug` 必须**消失**（卸载真跑了，不是「还留着但看不见」）；
 * ⑥ 切回之后要能**再挂一次** —— 抓「卸载时把 Texture 一起销毁了」。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'

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
const GAME_ID = 'sugar'
const TAB_LABEL = '甜点'
/** 一局票价，必须和 `task-games/sugar/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 20

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/sugar/${VIEWPORT}`
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

/** 在插件容器里按**设计坐标**点一下（游戏是 PixiJS 画的，DOM 里没有按钮） */
async function tapGame(dx, dy) {
  const box = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  }, GAME_ID)
  if (!box) throw new Error('找不到插件容器')
  const scale = Math.min(box.w / 420, box.h / 800)
  const x = box.x + (box.w - 420 * scale) / 2 + dx * scale
  const y = box.y + (box.h - 800 * scale) / 2 + dy * scale
  await page.mouse.click(Math.round(x), Math.round(y))
  await wait(900)
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
  check('底部没有「甜点」那一格', !(await page.$(`[data-tour="tab-${GAME_ID}"]`)))
  check('gameKv 里没有 sugar 的行', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
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

  // 2026-10-25 起本地游戏列表**直接摊在设置页上**，没有「进入游戏市场」这一步
  check('游戏列表在页面上', await waitFor('[data-local-row="sugar"]', 12000))

  const row = await page.evaluate((id) => {
    const li = document.querySelector(`[data-local-row="${id}"]`)
    if (!li) return null
    const btn = li.querySelector('[data-local-install]')
    return { text: (li.innerText ?? '').replace(/\s+/g, ' ').trim(), has: !!btn, disabled: btn ? btn.disabled : true }
  }, GAME_ID)
  check('列表里列出了「甜点魔法学院」', !!row, row?.text ?? '(没找到)')
  check('安装按钮可点', !!row?.has && row?.disabled === false)

  check('点了「安装」', await clickSel(`[data-local-install="${GAME_ID}"]`))
  check('★ 界面上那一行变成已装', await waitFor(`[data-local-installed="${GAME_ID}"]`, 25000))

  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  check(`家长能看到「一局 ${PLAY_COST} 积分」`, new RegExp(`一局\\s*${PLAY_COST}\\s*积分`).test(econ), econ)
  check('家长能看到「换不成兑换券」', /不开放|换不成|不能换/.test(econ), econ)

  check('点了「设为当前」', await clickSel(`[data-plugin-set-current="${GAME_ID}"]`))
  await wait(800)
  check('store 里当前游戏是 sugar', (await snap()).active === GAME_ID, (await snap()).active)

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

console.log('\n【③ 底栏出现「甜点」并进得去】')
{
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    return b ? (b.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  }, GAME_ID)
  check(`底部导航多出「${TAB_LABEL}」`, tab.includes(TAB_LABEL), tab || '(没有这一格)')
  check('点了「甜点」那一格', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__gpReady`）', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里有 canvas', canvas === 1, String(canvas))

  /*
   * ---- 几何 + 遮挡（这一层只有真宿主能给）----
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

  await page.screenshot({ path: join(OUT, '1-in-host.png') })
}

console.log('\n【④ 玩一局：积分必须 -20，币和券一分不动】')
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
  check('补完够开局', before.balance >= PLAY_COST, String(before.balance))

  // 语言选择 → 标题页
  await tapGame(210, 330)
  await wait(1500)
  await tapGame(210, 532) // 开始游戏
  await wait(2500)

  const after = await snap()
  check(`★ 积分 ${before.balance} → ${before.balance - PLAY_COST}`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动（B 型不产出）', after.vouchers === before.vouchers, String(after.vouchers))
  const coins = await page.evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID).catch(() => 0)
  check('游戏币余额为 0（本作不发行币）', !coins, String(coins))
  await page.screenshot({ path: join(OUT, '2-played.png') })
}

console.log('\n【⑤ 切走：卸载要真的跑】')
{
  /*
   * ⚠️ **没有 `tab-farm`**：底栏那四格是「任务 / <当前游戏> / 兑换 / 积分」，
   * 当前游戏是 sugar 时，农场那一格**根本不存在**（同一个位置被 sugar 占了）。
   * 要切走只能点别的固定格 —— 这里点「任务」。
   * 判据写错的表现是「卸载没跑」，而其实是**根本没切走**。
   */
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1500)
  const gone = await page.waitForFunction(() => typeof window.__debug === 'undefined', { timeout: 15000 }).then(() => true, () => false)
  check('★ `window.__debug` 已消失（destroy 真跑了）', gone)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))
}

console.log('\n【⑥ 切回：能再挂一次】')
{
  check('点回「甜点」', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 60000 }).then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 还是 1', canvas === 1, String(canvas))
  // 存档要留住：语言选过之后应该直接进标题页（不是又让选一次）
  const lang = await page.evaluate(() => window.__debug?.lang?.() ?? '')
  check('语言选择被记住了（存档走的是 host.storage）', lang === 'zh', `lang="${lang}"`)
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
