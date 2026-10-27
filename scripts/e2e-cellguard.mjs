#!/usr/bin/env node
/**
 * **细胞守卫在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→ 点「开始战斗」（扣 10）
 * → 打到有进度 → 切走（卸载）→ 切回（接着打 / 存档读得回）→ 退出 → 再开一局**再扣一次**。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
 * node scripts/e2e-cellguard.mjs http://127.0.0.1:4393/ phone
 * node scripts/e2e-cellguard.mjs http://127.0.0.1:4393/ tablet
 * ```
 *
 * ## 收费点在「开始战斗」，不是「进 tab」
 *
 * | | 放置类（蚂蚁搬家 / 收租塔） | 细胞守卫（一局制） |
 * | --- | --- | --- |
 * | 进 tab | 扣一次 | **不扣**（看一眼不该收钱） |
 * | 点「开始战斗」 | — | 扣 10 |
 * | 中途切走再回来 | 10 分钟内不扣 | **不扣**（接着同一局打，已经付过） |
 * | 再开一局 | — | **再扣 10** |
 *
 * ★ 第 ⑧ 段最容易抄错：照搬放置类会变成「切回来不许扣」—— 方向对；
 *   但**再开一局必须扣**，这条和放置类相反。
 *
 * ## 点按钮：`click()` 就行，但命中测试不能省
 *
 * 这一款的界面是 **preact 渲染的真 DOM**（`onClick`），不是 canvas 画的，
 * 所以 `el.click()` 能触发 —— 和 stackmeow（监听 `pointerdown`）不同。
 * 但 `el.click()` **不走命中测试**：被宿主底栏 / 弹层盖住照样点得到，
 * 所以每颗按钮仍然验一条「中心点 `elementFromPoint` 命中它自己」。
 *
 * ## 调试桥是 `window.__cellguard`
 *
 * 卸载时必须跟着删：留着 `ready: true` 会骗过下一次「已就绪」判断。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'

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
const GAME_ID = 'cellguard'
/** 底栏那一格的字（4 个字，上限 5） */
const TAB_LABEL = '细胞守卫'
/** 一局的票价，必须和 `task-games/cellguard/plugin.js` 的 PLAY_COST 一致 */
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
 * 返回 `{ found, hittable }`：`hittable` 是「中心点的 `elementFromPoint` 命中它自己」，
 * 专门抓「按钮在 DOM 里、但被宿主的顶栏 / 底栏 / 弹层盖住」—— `el.click()` 抓不到这种。
 *
 * ★ 本作是 preact 的 `onClick`，所以派 `click` 就够（stackmeow 那种监听
 *   `pointerdown` 的才要派 PointerEvent）。**先读源码再决定**，别照抄别款。
 */
const clickInGame = async (text) =>
  page.evaluate(([id, t]) => {
    const host = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!host) return { found: false }
    const b = [...host.querySelectorAll('button')].find(
      (x) => (x.innerText ?? '').includes(t) && x.offsetParent !== null,
    )
    if (!b) return { found: false }
    const r = b.getBoundingClientRect()
    if (!r.width || !r.height) return { found: true, hittable: false, why: '尺寸为 0' }
    const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2))
    const hittable = !!(hit && (hit === b || b.contains(hit)))
    const info = hittable ? {} : {
      // 抓「谁盖住了」：把命中元素的类名/文字/矩形一起带回去
      hitCls: String(hit?.className ?? '').slice(0, 40),
      hitText: (hit?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 20),
      btn: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      hitRect: hit ? [Math.round(hit.getBoundingClientRect().x), Math.round(hit.getBoundingClientRect().y)] : null,
    }
    b.click()
    return { found: true, hittable, hit: hit ? hit.tagName.toLowerCase() : '(null)', ...info }
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

/** 游戏自己的状态（`__cellguard` 桥）。没有桥就返回 null。 */
const gs = () => page.evaluate(() => window.__cellguard?.state?.() ?? null)

/** 把对局里的两个暂停层（宝箱提示 / 三选一）点掉 */
const clearOverlays = () =>
  page.evaluate(() => {
    const tip = document.querySelector('.tip-back')
    if (tip) {
      tip.click()
      return true
    }
    const card = document.querySelector('.ov-chest button.card')
    if (card) {
      card.click()
      return true
    }
    return false
  })

/** 等生存进度到 target（同时把暂停层点掉），最多 timeoutMs */
async function playUntil(target, timeoutMs = 60000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    await clearOverlays()
    const s = await gs()
    if (!s?.battle) return s
    if ((s.pct ?? 0) >= target) return s
    await wait(500)
  }
  return gs()
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

console.log('\n【④ 进 tab：**不收费**，先看一眼】')
{
  const pre = await snap()
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check(`补了 100 积分（${pre.balance} → ${before.balance}）`, before.balance === pre.balance + 100, String(before.balance))

  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))

  const up = await page.waitForFunction(() => window.__cellguard?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__cellguard.ready`）', up)
  await wait(1500)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里有 canvas', canvas >= 1, String(canvas))

  const after = await snap()
  check(`★ 只是进来看一眼：积分没动（${before.balance} → ${after.balance}）`, after.balance === before.balance, `票价 ${PLAY_COST} 在「开始战斗」时才收`)
  check('兑换券没动（C 型零产出）', after.vouchers === before.vouchers, String(after.vouchers))

  const c1 = await gameColors('1-home.png')
  check(`★ 首页画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  /*
   * 几何三条（真宿主独有的判据）：
   *   ① 容器高 == **父容器**高 —— 抓「plugin.js 误补 position:relative」（平板实测 966→600）
   *   ② 游戏自己的 `.cg` 根铺满容器
   *   ③ 容器中心没被底栏 / 弹层盖住
   * ⚠️ 这一款有两块 canvas（首页的英雄画布 + 战斗画布），所以不拿「canvas 个数」当判据。
   */
  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const root = el.querySelector('.cg')
    const rr = root ? root.getBoundingClientRect() : null
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    return {
      h: Math.round(r.height), ph: Math.round(p.height), w: Math.round(r.width),
      rh: rr ? Math.round(rr.height) : -1, rw: rr ? Math.round(rr.width) : -1,
      hitInside: !!(hit && el.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() : '(null)',
    }
  }, GAME_ID)
  check('插件容器还在', !!geo, geo ? '' : '（容器不在 ⇒ 挂载失败了，看上面的 console.error）')
  check(`容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`, !!geo && Math.abs(geo.h - geo.ph) <= 1, geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '')
  check(`★ 游戏的 .cg 根铺满容器（${geo?.rw}×${geo?.rh} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.rw - geo.w) <= 2 && Math.abs(geo.rh - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)

  const hasStart = await page.evaluate((id) => {
    const host = document.querySelector(`[data-plugin-host="${id}"]`)
    return !!(host && [...host.querySelectorAll('button')].some((x) => (x.innerText ?? '').includes('开始战斗')))
  }, GAME_ID)
  check('★ 首页上有「开始战斗」这颗按钮', hasStart)

  const gone = await page.evaluate(() => ({
    stamina: document.body.innerText.includes('体力'),
    daily: document.body.innerText.includes('每日任务'),
    sign: document.body.innerText.includes('签到'),
    idle: document.body.innerText.includes('挂机'),
    login: document.body.innerText.includes('登录后可跨设备'),
  }))
  check('★ 页面上已经没有「体力」', !gone.stamina)
  check('★ 页面上已经没有「每日任务」', !gone.daily)
  check('★ 页面上已经没有「签到」', !gone.sign)
  check('★ 页面上已经没有「挂机」', !gone.idle)
  check('★ 页面上已经没有「登录后可跨设备同步进度」', !gone.login)
}

console.log('\n【⑤ 余额不足：点「开始战斗」必须被挡住，一分不扣】')
{
  const cur = (await snap()).balance
  if (cur > 0) {
    await page.evaluate((n) => window.__kqf__.addPoints(-n), cur)
    await wait(600)
  }
  const before = await snap()
  check(`余额已压到 ${before.balance}（< ${PLAY_COST}）`, before.balance < PLAY_COST, String(before.balance))

  const probe = await clickInGame('开始战斗')
  check('「开始战斗」点得到（没被盖住）', probe.found && probe.hittable, JSON.stringify(probe))
  await wait(1500)

  const after = await snap()
  check(`★ 积分没被扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '')
  check(`★ 没进对局（battle=${(await gs())?.battle}）`, (await gs())?.battle === false, '')
  // ★ 提示层（toast）是 **Portal 到 `document.body`** 的，不在插件容器里
  const toast = await page.evaluate(() => document.body.innerText.includes('积分不够'))
  check('弹了「积分不够」提示', toast)
}

console.log(`\n【⑥ 余额够：点「开始战斗」必须 -${PLAY_COST}，并且真的打起来】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  const probe = await clickInGame('开始战斗')
  check('「开始战斗」点得到', probe.found && probe.hittable, JSON.stringify(probe))
  const ok = await page.waitForFunction(() => window.__cellguard?.state?.().battle === true, { timeout: 30000 })
    .then(() => true, () => false)
  check('★ 进了对局', ok, `battle=${(await gs())?.battle}`)

  const after = await snap()
  check(`★ 积分 ${before.balance} → ${before.balance - PLAY_COST}`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动', after.vouchers === before.vouchers, String(after.vouchers))

  const coins = await page.evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID).catch(() => 0)
  check('游戏币余额为 0（本作不发行币）', !coins, String(coins))

  // 真的打一会儿：进度必须往上走（证明 ticker 在跑，不是一张静止图）
  const s = await playUntil(6, 60000)
  check(`★ 对局在推进（生存进度 ${s?.pct}%）`, (s?.pct ?? 0) >= 6, `killed=${s?.killed}`)

  await wait(800)
  const c3 = await gameColors('3-play.png')
  check(`★ 对局画面不是空白（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)
}

console.log('\n【⑦ 对局中切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  const pctBefore = (await gs())?.pct ?? 0
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1800)

  const gone = await page.evaluate(() => ({
    bridge: typeof window.__cellguard,
    gp: typeof window.__gpPlayable,
  }))
  check('★ `__cellguard` 已摘（卸载真跑了）', gone.bridge === 'undefined', gone.bridge)
  check('★ `__gpPlayable` 也没有（原版的钩子没留）', gone.gp === 'undefined', gone.gp)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  const styles = await page.evaluate(() =>
    [...document.querySelectorAll('style')].filter((s) => (s.textContent ?? '').includes('.cg')).length)
  check('注入的 <style> 也摘掉了（`.cg` 那条）', styles === 0, `${styles} 份`)

  const html = await page.evaluate(() => ({
    fs: document.documentElement.style.fontSize,
    font: document.documentElement.style.getPropertyValue('--font'),
  }))
  check('★ 没在 <html> 上留 fontSize（宿主是 rem 布局）', !html.fs, html.fs || '(空)')

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
  console.log(`  （切走前生存进度 ${pctBefore}%）`)
}

console.log('\n【⑧ 切回：存档读得回（接着打）；退出后**再开一局再扣一次**】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__cellguard?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)

  const mid = await snap()
  check(`重新挂载本身不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, `票价 ${PLAY_COST} 在「开始战斗」时才收`)

  // 上一局有战斗快照 ⇒ 直接接着打（原版就是这样：战斗每 10 秒记一次档）
  const resumed = await page.waitForFunction(() => window.__cellguard?.state?.().battle === true, { timeout: 30000 })
    .then(() => true, () => false)
  check('★ 存档读回来了（切回来直接接着上一局打）', resumed, `battle=${(await gs())?.battle}`)

  const c4 = await gameColors('4-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c4.n} 种）`, c4.n >= 20, c4.file)

  // 退出这一局 → 结算 → 返回
  await page.evaluate(() => document.querySelector('.hud-btn')?.click())
  await wait(900)
  const quit = await clickInGame('退出战斗')
  check('点「退出战斗」', quit.found && quit.hittable, JSON.stringify(quit))
  const resultUp = await page.waitForFunction(() => !!document.querySelector('.ov-result'), { timeout: 20000 })
    .then(() => true, () => false)
  check('到了结算页', resultUp)
  const back = await clickInGame('返回')
  check('点「返回」', back.found && back.hittable, JSON.stringify(back))
  const home = await page.waitForFunction(() => window.__cellguard?.state?.().battle === false, { timeout: 20000 })
    .then(() => true, () => false)
  check('回到首页', home)

  /*
   * ★ 本作**没有宽限期**：每一局都是新的一局，所以再开一局必须再扣一次。
   *   这条的方向和放置类（10 分钟内不扣）相反 —— 抄错会把 bug 写成规范。
   */
  const mid2 = await snap()
  const probe = await clickInGame('开始战斗')
  check('再点「开始战斗」', probe.found && probe.hittable, JSON.stringify(probe))
  const started2 = await page.waitForFunction(() => window.__cellguard?.state?.().battle === true, { timeout: 30000 })
    .then(() => true, () => false)
  check('第二局也进去了', started2)

  const after = await snap()
  check(`★ 第二局又扣了 ${PLAY_COST}（${mid2.balance} → ${mid2.balance - PLAY_COST}）`, after.balance === mid2.balance - PLAY_COST, String(after.balance))
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
