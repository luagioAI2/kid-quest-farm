#!/usr/bin/env node
/**
 * **收租公寓在真 App 里走一遍**：安装 → 余额 0 进 tab（**被拦住、一分不扣、不建渲染器**）
 * → 补钱进 tab（**扣 10**）→ 画面 / 几何 / 0×404 → 便利店收银 → 切走（卸载 + 落盘）
 * → 切回（**宽限期内不再扣**、存档读回）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4395 --strictPort
 * node scripts/e2e-renttower.mjs http://127.0.0.1:4395/ phone
 * node scripts/e2e-renttower.mjs http://127.0.0.1:4395/ tablet
 * ```
 *
 * ## 收费点在「进 tab」，而且有 10 分钟宽限 —— 和旋转灯泡**相反**
 *
 * | | 旋转灯泡（关卡） | 收租公寓（放置经营） |
 * | --- | --- | --- |
 * | 进 tab | 不扣（先给看关卡盘） | **扣 10** |
 * | 余额 0 进 tab | 照常挂载 | **被拦住**（不建渲染器，只给一块说明屏） |
 * | 切走再切回 | 不扣（本来就没在挂载时扣） | 10 分钟内不扣（宽限期） |
 *
 * ★★ 照抄旋转灯泡那套断言（「进 tab 不扣」「余额 0 也照常挂载」）会把**正确实现判成红的**。
 *
 * ## 整屏是 canvas，所以
 *
 * ① 「画出来了」的判据只能是**截图的颜色种类数**（`innerText` 恒空）；
 * ② 截图必须 `clip` 到插件容器 —— 整页截图里宿主的顶栏 / 底栏自带一堆颜色；
 * ③ 房间在 canvas 里没有选择器 ⇒ 点房间用 `__debug.roomScreen(i)`，
 *    点便利店收银的按钮用 `__debug.shiftButtons()`（都是只读几何）。
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
const GAME_ID = 'renttower'
/** 底栏那一格的字，和商城名一致。 */
const TAB_LABEL = '收租公寓'
/** 一次进场的票价，必须和 `task-games/renttower/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 10

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/renttower/${VIEWPORT}`
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

/*
 * ★ 只取需要的几个字段，**别把 `window.__debug` 整个传回来**：那个对象里有
 *   getter 和一堆函数，序列化回来 `rooms` 会变成空数组（看着像「一间房都没建」）。
 */
const gameState = () =>
  page.evaluate(() => {
    const d = window.__debug
    if (!d) return null
    return {
      rooms: d.rooms.map((r) => ({ occupied: r.occupied, kind: r.kind, lv: r.lv })),
      money: Math.round(d.money),
      floors: d.floors,
      rep: d.rep,
      walkPacks: d.walkPacks.length,
    }
  })
const ready = (timeout = 60000) =>
  page.waitForFunction(() => !!window.__debug && !!window.__debug.rooms, { timeout }).then(() => true, () => false)

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

console.log(`\n【④ 余额 0 进 tab：**被拦住**、一分不扣、不建渲染器】`)
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
  await wait(3000)

  const after = await snap()
  check(`★ 一分没扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '余额不够就不该扣')
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('★ 没建渲染器（canvas 0 个）', canvas === 0, String(canvas))
  const txt = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  }, GAME_ID)
  check('★ 给了一块「积分不够」的说明屏', txt.includes('积分不够'), txt.slice(0, 60))
  check('没装调试桥（说明没走到游戏里）', await page.evaluate(() => typeof window.__debug) === 'undefined')
  const c0 = await gameColors('0-gate.png')
  check(`说明屏画出来了（颜色 ${c0.n} 种）`, c0.n >= 5, c0.file)
}

console.log(`\n【⑤ 余额够：进 tab 必须 -${PLAY_COST}，游戏要起来】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  // 还在同一个 tab 上：先切走再切回，走一次真正的「进场」
  check('先切到「任务」', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1200)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('★ 游戏起来了（`__debug.rooms`）', await ready())
  await wait(2500)

  /*
   * 第一次挂载会弹 9 步新手教学，**它盖在容器中心**（挡住楼）。
   * 几何断言和截图都要先把它跳掉 —— 这不是放宽判据：教学层本来就在容器里，
   * 只是「中心最上层是 canvas」这条得在跳掉之后才谈得上。
   */
  const skipped = await page.evaluate(() => {
    const ok = typeof window.__debug?.tutSkip === 'function'
    if (ok) window.__debug.tutSkip()
    return ok
  })
  check('跳掉新手教学（`tutSkip`）', skipped)
  await wait(1800)

  const after = await snap()
  check(`★ 进场扣了 ${PLAY_COST}（${before.balance} → ${before.balance - PLAY_COST}）`,
    after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动（C 型零产出）', after.vouchers === before.vouchers, String(after.vouchers))

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas ≥ 1', canvas >= 1, String(canvas))

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
      kids: el.children.length,
    }
  }, GAME_ID)
  check(`★ 容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`, !!geo && Math.abs(geo.h - geo.ph) <= 2, geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '')
  check(`canvas 铺满容器（${geo?.cw}×${geo?.ch} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)

  const st = await gameState()
  check(`房间建好了（${st?.rooms?.length ?? 0} 间）`, (st?.rooms?.length ?? 0) >= 4, '')
  check(`有住户住进来了（${st?.rooms?.filter((r) => r.occupied).length ?? 0} 户）`, (st?.rooms?.filter((r) => r.occupied).length ?? 0) >= 1, '')

  const c1 = await gameColors('1-tower.png')
  check(`★ 楼画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)
}

console.log('\n【⑤b 便利店收银：canvas 里按标签点「开店」】')
{
  const r = await page.evaluate(() => {
    const d = window.__debug
    d.setMoney(1e6)   // 收银要先进货，别因为没钱卡住
    d.startShift()
    return true
  })
  check('调了 startShift()', r)
  await wait(3000)

  const btns = await page.evaluate(() => window.__debug.shiftButtons())
  check(`收银界面暴露了按钮（${btns.map((b) => b.label).join(' / ') || '(空)'}）`, btns.length > 0, '')
  const open = btns.find((b) => b.label.includes('开店'))
  check('有「开店」按钮', !!open, btns.map((b) => b.label).join(' / '))

  if (open) {
    const box = await hostBox()
    await page.mouse.click(box.x + open.x + open.w / 2, box.y + open.y + open.h / 2)
    await wait(6000)
    const c2 = await gameColors('2-shift.png')
    check(`★ 收银台画出来了（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)
    const after = await page.evaluate(() => window.__debug.shiftButtons().map((b) => b.label))
    check('点完之后界面变了（说明卡被按掉了）', !after.some((l) => l.includes('回到店铺')), after.join(' / ') || '(空)')
  }
}

let moneyBefore = 0

console.log('\n【⑥ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  moneyBefore = await page.evaluate(() => {
    window.__debug.setMoney(7654321)
    window.__debug.save()
    return Math.round(window.__debug.money)
  })
  check(`切走前把余额改成 ${moneyBefore}（切回来要读回它）`, moneyBefore >= 7654321, String(moneyBefore))

  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(2500)

  check('★ `__debug` 已摘（卸载真跑了）', (await page.evaluate(() => typeof window.__debug)) === 'undefined')
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))
  const kids = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    return el ? el.children.length : -1
  }, GAME_ID)
  /*
   * ★ 真宿主切走时**整页都卸载了**，容器本身就不在 DOM 里（-1）。
   *   所以判据是「容器不在了，或者还在但被清空」——
   *   写成「必须是 0 个子节点」会在真 App 上恒红（只有假宿主会留着容器）。
   *   真正要防的是「canvas / UI 层还挂在宿主页面上」，上面那条 canvas === 0 才是主判据。
   */
  check('★ 容器清空了（不在了，或者 0 个子节点）', kids === -1 || kids === 0,
    kids === -1 ? '容器随页面一起卸载了' : `${kids} 个子节点`)

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑦ 切回：宽限期内**不再扣**，存档要读回来】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('★ 第二次挂载也起来了', await ready())
  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('canvas 又有了', canvas >= 1, String(canvas))

  /*
   * ★★ 这条必须**跨一次卸载 + 挂载**：`paidAt` 写在 `host.storage`（真宿主是 Dexie 的 kv）。
   *   如果实现把它写成内存变量，同一次挂载里读回恒真 —— 那样坏的实现照样绿。
   */
  const after = await snap()
  check(`★ 宽限期内切回来不再扣（${before.balance} → ${after.balance}）`,
    after.balance === before.balance, '见 plugin.js 的 GRACE_MS')

  await wait(2500)
  const money = await page.evaluate(() => Math.round(window.__debug.money))
  check(`★ 存档读回来了（¥${money} ≥ ${moneyBefore}）`, money >= moneyBefore, '跨卸载的读回才算数')

  const c3 = await gameColors('3-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)
}

console.log('\n【⑧ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
