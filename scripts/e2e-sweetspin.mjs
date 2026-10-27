#!/usr/bin/env node
/**
 * **旋转灯泡在真 App 里走一遍**：安装 → 设为当前 → 余额 0 进 tab（**照常挂载、一分不扣**）
 * → 点第 1 关（被拦住，弹「积分不够」）→ 补钱点第 1 关（**进关扣 10**）
 * → 按 `need` 把每一格转到正确角度过关（星级落盘）→ 切走（卸载）→ 切回（**不扣**，存档读回）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4394 --strictPort
 * node scripts/e2e-sweetspin.mjs http://127.0.0.1:4394/ phone
 * node scripts/e2e-sweetspin.mjs http://127.0.0.1:4394/ tablet
 * ```
 *
 * ## 收费点在「进一关」，**不是**「进 tab」
 *
 * | | 柯基屁屁（养成） | 旋转灯泡（关卡） |
 * | --- | --- | --- |
 * | 进 tab | **扣 10** | 不扣（照常挂载，先给看关卡盘） |
 * | 点关卡格 | — | **扣 10** |
 * | 点「再玩一次」 | — | 不扣（同一关已经买过） |
 * | 切回来 | 10 分钟内不扣（宽限期） | 不扣（本来就没在挂载时扣） |
 *
 * ★★ 第 ④ 段的断言方向和 corgi **相反**：照抄「进 tab 就该扣 10 / 就该被挡住」，
 *   会把**正确实现判成红的**。也正因为挂载不扣钱，`plugin.js` 里没有宽限期（`paidAt` 那套）。
 *
 * ## 整屏是 canvas，所以
 *
 * ① 点的是 `window.__sweetspin.buttons()` 给出的**容器内 CSS 像素**坐标
 *    （`mountDisplay` 把 canvas 的样式尺寸定成容器尺寸 ⇒ 无 letterbox，不用换算）；
 * ② 「画出来了」的判据只能是**截图的颜色种类数**（`innerText` 恒空）；
 * ③ 截图必须 `clip` 到插件容器 —— 整页截图里宿主的顶栏 / 底栏自带一堆颜色，
 *    游戏全黑也照样凑够 20 种；
 * ④ 解谜**不写死解法**：`state().tiles[i].need` 是「这一格还要顺时针转几下」，
 *    按它点就行 —— 写死「点第 3 格 4 次」换个关卡就废，而且错得很安静。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4394/'
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
const GAME_ID = 'sweetspin'
/** 底栏那一格的字，和商城名一致。 */
const TAB_LABEL = '旋转灯泡'
/** 进一关的票价，必须和 `task-games/sweetspin/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 10

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/sweetspin/${VIEWPORT}`
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

const gameState = () => page.evaluate(() => window.__sweetspin?.state() ?? null)

/**
 * 在 canvas 上点一颗**画出来的**按钮。
 *
 * 坐标来自插件自己的调试桥（只读几何），点下去是 `page.mouse.click` ——
 * 走的是真事件路径，不是直接调回调。
 * ★ 点**中心**：关卡盘的六边形按钮矩形互相重叠，命中检测从后往前取第一个，
 *   点左上角会落到邻格上（症状是「点了没反应」）。
 */
async function clickGame(label) {
  const btn = await page.evaluate((t) => {
    const all = window.__sweetspin?.buttons?.() ?? []
    return all.find((b) => b.label === t) ?? all.find((b) => b.label.includes(t)) ?? null
  }, label)
  if (!btn) return { found: false }
  const box = await hostBox()
  if (!box) return { found: false }
  const x = box.x + btn.x + btn.w / 2
  const y = box.y + btn.y + btn.h / 2
  const hit = await page.evaluate(([px, py]) => {
    const el = document.elementFromPoint(px, py)
    return el ? el.tagName.toLowerCase() : '(null)'
  }, [x, y])
  await page.mouse.click(x, y)
  return { found: true, hit, x, y, label: btn.label }
}

/**
 * 把这一关解开：按 `need` 把每一格顺时针转到正确角度。
 *
 * 分轮推进（一轮每格最多点一次），最多 6 轮 —— 因为 `need` 会随转动变化，
 * 一轮读一次状态最稳。**不写死解法**，所以换关卡 / 换视口都还能用。
 */
async function solveLevel() {
  const box = await hostBox()
  if (!box) return { rounds: 0, won: false }
  let rounds = 0
  for (; rounds < 6; rounds++) {
    const st = await gameState()
    if (!st || st.won) break
    const todo = st.tiles.filter((t) => t.need > 0)
    if (!todo.length) break
    for (const t of todo) {
      await page.mouse.click(box.x + t.x, box.y + t.y)
      await wait(70)
    }
    await wait(500)
  }
  const st = await gameState()
  return { rounds, won: !!st?.won, moves: st?.moves }
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

  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  check(`家长能看到「一局 ${PLAY_COST} 积分」`, new RegExp(`一局\\s*${PLAY_COST}\\s*积分`).test(econ), econ)
  check('家长能看到「换不成兑换券」', /不开放|换不成|不能换/.test(econ), econ)

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

console.log(`\n【④ 余额 0：照常挂载、一分不扣；点关卡格被拦住】`)
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
  const up = await page.waitForFunction(() => window.__sweetspin?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 余额 0 也照常挂载（`__sweetspin.ready`）', up)
  await wait(2500)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里恰好 1 个 canvas', canvas === 1, String(canvas))

  const afterMount = await snap()
  check(`★ 挂载本身一分没扣（${before.balance} → ${afterMount.balance}）`,
    afterMount.balance === before.balance, '收费点在「进关」，不在挂载')

  const st = await gameState()
  check('首屏是关卡盘（screen=levels）', st?.screen === 'levels', String(st?.screen))
  const c1 = await gameColors('1-levels.png')
  check(`★ 关卡盘画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  const probe = await clickGame('L1')
  check('第 1 关点得到（没被盖住）', probe.found && probe.hit === 'canvas', JSON.stringify(probe))
  await wait(2000)

  const afterClick = await snap()
  check(`★ 积分没被扣（${afterMount.balance} → ${afterClick.balance}）`, afterClick.balance === afterMount.balance, '')
  check('★ 没进关（screen 还是 levels）', (await gameState())?.screen === 'levels', String((await gameState())?.screen))
  // ★ 提示层（toast）是 **Portal 到 `document.body`** 的，不在插件容器里
  const toast = await page.evaluate(() => document.body.innerText.includes('积分不够'))
  check('弹了「积分不够」提示', toast)
}

console.log(`\n【⑤ 余额够：点第 1 关必须 -${PLAY_COST}，进第 1 关】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  const probe = await clickGame('L1')
  check('第 1 关点得到', probe.found && probe.hit === 'canvas', JSON.stringify(probe))
  const entered = await page.waitForFunction(() => window.__sweetspin?.state?.().screen === 'game', { timeout: 30000 })
    .then(() => true, () => false)
  check('★ 进了第 1 关（screen=game）', entered, String((await gameState())?.screen))

  const after = await snap()
  check(`★ 进关扣了 ${PLAY_COST}（${before.balance} → ${before.balance - PLAY_COST}）`,
    after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动（C 型零产出）', after.vouchers === before.vouchers, String(after.vouchers))

  const st = await gameState()
  check('在第 1 关（level=1）', st?.level === 1, String(st?.level))
  check(`棋盘有格子（${st?.tiles?.length ?? 0} 格）`, (st?.tiles?.length ?? 0) > 0, '')

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
  check(`★ 容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`, !!geo && Math.abs(geo.h - geo.ph) <= 1, geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '')
  check(`canvas 铺满容器（${geo?.cw}×${geo?.ch} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)
}

console.log('\n【⑥ 按 need 把每一格转对，第 1 关应该点亮】')
{
  const r = await solveLevel()
  check(`★ 第 1 关真的点亮了（${r.rounds} 轮 / ${r.moves} 步）`, r.won, JSON.stringify(r))
  const st = await gameState()
  check(`★ 星级算出来了（stars[0]=${st?.stars?.[0]}）`, (st?.stars?.[0] ?? 0) >= 1, '')

  // 过关面板是延迟 650ms 弹的（游戏时钟，headless 约 7×）
  await wait(9000)
  const c2 = await gameColors('2-win.png')
  check(`★ 过关面板画出来了（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)
}

let starsBefore = 0

console.log('\n【⑦ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  starsBefore = (await gameState())?.stars?.[0] ?? 0
  check('切走前记下第 1 关的星（切回来要读回它）', starsBefore > 0, String(starsBefore))
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(2000)

  const gone = await page.evaluate(() => ({ hook: typeof window.__sweetspin }))
  check('★ `__sweetspin` 已摘（卸载真跑了）', gone.hook === 'undefined', gone.hook)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑧ 切回：**不再扣**（收费点在进关），存档要读回来】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__sweetspin?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 还是 1', canvas === 1, String(canvas))

  /*
   * ★★ 这条必须**跨一次卸载 + 挂载**：存档写在 `host.storage`（真宿主是 Dexie 的 kv），
   *   只在挂载期间读回是恒真的 —— 那样把存档写成内存变量的实现照样绿。
   */
  const after = await snap()
  check(`★ 切回来不再扣（${before.balance} → ${after.balance}）`,
    after.balance === before.balance, '挂载不收费，见 plugin.js 的 chargePlay')

  await wait(2500)
  const st = await gameState()
  check('切回来停在关卡盘（每次挂载都从关卡盘进，按设计）', st?.screen === 'levels', String(st?.screen))
  check(`★ 存档读回来了（第 1 关 ${starsBefore} 星）`, (st?.stars?.[0] ?? 0) === starsBefore,
    `stars[0]=${st?.stars?.[0]} · unlocked=${st?.unlocked}`)
  check('第 2 关解锁了（unlocked ≥ 2）', (st?.unlocked ?? 0) >= 2, String(st?.unlocked))

  const c3 = await gameColors('3-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)

  // 第二次挂载进关也要能扣（闸门是「每次进关」，不是「每次挂载只扣一次」）
  const b2 = await snap()
  const probe = await clickGame('L2')
  check('第二次挂载也能点第 2 关', probe.found, JSON.stringify(probe))
  const again = await page.waitForFunction(() => window.__sweetspin?.state?.().screen === 'game', { timeout: 30000 })
    .then(() => true, () => false)
  check('★ 第二次进关也进得去', again, String((await gameState())?.screen))
  const a2 = await snap()
  check(`★ 第二次进关又扣了 ${PLAY_COST}（${b2.balance} → ${b2.balance - PLAY_COST}）`,
    a2.balance === b2.balance - PLAY_COST, String(a2.balance))
}

console.log('\n【⑨ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
