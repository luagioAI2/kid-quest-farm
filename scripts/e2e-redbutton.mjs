#!/usr/bin/env node
/**
 * **别按红按钮在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→ 余额 0 时按按钮
 * 必须被挡 → 补到 100 → 按一下扣 10 → 切走（卸载干净）→ 切回（10 分钟内不再收，进度读得回）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
 * node scripts/e2e-redbutton.mjs http://127.0.0.1:4393/ phone
 * node scripts/e2e-redbutton.mjs http://127.0.0.1:4393/ tablet
 * ```
 *
 * ## 收费点是「这一档的第一下按键」，不是「进 tab」
 *
 * | | 放置类（蚂蚁搬家 / 收租塔） | 本作 |
 * | --- | --- | --- |
 * | 进 tab | 扣一次 | **不扣**（看一眼不该收钱） |
 * | 第一下按按钮 | — | 扣 10 |
 * | 10 分钟内切走再回来 | 不扣 | **不扣**（`paidAt` 在存档里） |
 * | 10 分钟后再进 | 再扣 | 再扣 |
 *
 * ★ 宽限期必须靠**存档**里的 `paidAt`：记在内存变量里的话，「切走 = 卸载」当场丢掉，
 *   症状是「每次切回来都扣一次」，而且不报错。第 ⑧ 段就是查这件事。
 *
 * ## 按钮是 canvas 画的，只能按坐标点
 *
 * 红按钮是 Pixi 对象（`btnC.on('pointerdown')`），不是 DOM 按钮 ⇒ 没有选择器可用。
 * 所以用**容器中心**做坐标，先断言「中心点 `elementFromPoint` 落在 canvas 上」，
 * 再用真鼠标点 —— 这样顺手把「按钮被宿主底栏压住」也测了。
 *
 * ## 调试桥是 `window.__redbutton`
 *
 * 它的 `press()` 走的是 `pressManual()`（和真实点击同一条路，含收费），
 * 卸载时必须跟着删 —— 留着 `ready: true` 会骗过下一次「已就绪」判断。
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
const GAME_ID = 'redbutton'
/** 底栏那一格的字（5 个字，上限就是 5） */
const TAB_LABEL = '别按红按钮'
/** 一次进场的票价，必须和 `task-games/redbutton/plugin.js` 的 PLAY_COST 一致 */
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
/** 切走前记下来的游戏内进度（⑦ 写、⑧ 读 —— 跨块所以提到顶层） */
let clicksBefore = -1
let coinsBefore = null
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

/** 游戏自己的状态（`__redbutton` 桥）。没有桥就返回 null。 */
const gs = () => page.evaluate(() => window.__redbutton?.state?.() ?? null)

/**
 * 按一下那颗红按钮 —— **用真鼠标点容器中心**。
 *
 * 先做命中测试：中心点必须落在 canvas 上（不是被底栏 / 弹层盖住）。
 * 返回 `{ hittable, hit }`，点完等一会儿让 `pressManual()` 里的 await 走完。
 */
async function pressRed(settle = 1200) {
  const b = await hostBox()
  if (!b) return { hittable: false, hit: '(容器不在)' }
  const cx = Math.round(b.x + b.w / 2)
  const cy = Math.round(b.y + b.h / 2)
  const hit = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y)
    return { tag: el ? el.tagName.toLowerCase() : '(null)', inHost: !!el?.closest?.('[data-plugin-host]') }
  }, [cx, cy])
  const hittable = hit.tag === 'canvas' && hit.inHost
  if (hittable) await page.mouse.click(cx, cy)
  await wait(settle)
  return { hittable, hit: hit.tag, cx, cy }
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

console.log('\n【③ 底栏那一格：5 个字要一行放得下】')
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

  const up = await page.waitForFunction(() => window.__redbutton?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__redbutton.ready`）', up)
  await wait(1500)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里有 canvas', canvas >= 1, String(canvas))

  const after = await snap()
  check(`★ 只是进来看一眼：积分没动（${before.balance} → ${after.balance}）`, after.balance === before.balance, `票价 ${PLAY_COST} 在第一下按键时才收`)
  check('兑换券没动（C 型零产出）', after.vouchers === before.vouchers, String(after.vouchers))

  const c1 = await gameColors('1-home.png')
  check(`★ 首页画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  /*
   * 几何三条（真宿主独有的判据）：
   *   ① 容器高 == **父容器**高 —— 抓「plugin.js 误补 position:relative」（平板实测 966→600）
   *   ② 游戏自己的 `#rb-root` 铺满容器
   *   ③ 容器中心没被底栏 / 弹层盖住（红按钮就在那儿）
   */
  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const root = el.querySelector('#rb-root')
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
  check(`★ 游戏的 #rb-root 铺满容器（${geo?.rw}×${geo?.rh} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.rw - geo.w) <= 2 && Math.abs(geo.rh - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)

  const gone = await page.evaluate(() => ({
    shop: document.body.innerText.includes('商店'),
    rank: document.body.innerText.includes('排行榜'),
    login: document.body.innerText.includes('登录后可跨设备'),
  }))
  check('★ 页面上已经没有内购「商店」入口', !gone.shop)
  check('★ 页面上已经没有「排行榜」', !gone.rank)
  check('★ 页面上已经没有「登录后可跨设备同步进度」', !gone.login)
}

console.log(`\n【⑤ 余额 0：按按钮必须被挡住，一分不扣，也不掉金币】`)
{
  const cur = (await snap()).balance
  if (cur > 0) {
    await page.evaluate((n) => window.__kqf__.addPoints(-n), cur)
    await wait(600)
  }
  const before = await snap()
  check(`余额已压到 ${before.balance}（< ${PLAY_COST}）`, before.balance < PLAY_COST, String(before.balance))

  const clicks0 = (await gs())?.clicks ?? -1
  const probe = await pressRed(1500)
  check('红按钮点得到（中心点落在 canvas 上）', probe.hittable, JSON.stringify(probe))
  await wait(800)

  const after = await snap()
  const st = await gs()
  check(`★ 积分没被扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '')
  check(`★ 这一下没算数（clicks ${clicks0} → ${st?.clicks}）`, (st?.clicks ?? -2) === clicks0, '')
  check(`★ 也没掉金币（coins=${st?.coins}）`, Number(st?.coins ?? 0) === 0, String(st?.coins))
  // ★ 提示层（toast）是 **Portal 到 `document.body`** 的，不在插件容器里
  const toast = await page.evaluate(() => document.body.innerText.includes('积分不够'))
  check('弹了「积分不够」提示', toast)
}

console.log(`\n【⑥ 余额够：按第一下必须 -${PLAY_COST}，并且真的掉金币】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  const probe = await pressRed(300)
  check('红按钮点得到', probe.hittable, JSON.stringify(probe))

  /*
   * ★★ 别用固定 sleep 等「按下去生效」：`pressManual()` 先 `await chargePlay()`，
   *    而扣分与 `paidAt` 落盘都是宿主事务（平板实测偶尔 > 1.8 秒才回来）。
   *    固定 1.8 秒在手机上过、在平板上红 —— 而且看起来像「按了没反应」。
   *    ⇒ 轮询**游戏内状态**（`clicks`）才是判据。
   */
  const pressed = await page.waitForFunction(() => (window.__redbutton?.state?.().clicks ?? 0) >= 1, { timeout: 20000 })
    .then(() => true, () => false)
  const st = await gs()
  check(`★ 这一下算数了（clicks=${st?.clicks}）`, pressed, '')
  check(`★ 掉了金币（coins=${st?.coins}）`, Number(st?.coins ?? 0) > 0, String(st?.coins))

  const after = await snap()
  check(`★ 积分 ${before.balance} → ${before.balance - PLAY_COST}`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动', after.vouchers === before.vouchers, String(after.vouchers))

  const coins = await page.evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID).catch(() => 0)
  check('游戏币余额为 0（本作不发行宿主币）', !coins, String(coins))

  // 再按几下：连击要涨、金币要涨（证明 ticker / 连击逻辑在跑，不是一张静止图）
  for (let i = 0; i < 6; i++) {
    await pressRed(260)
  }
  const seven = await page.waitForFunction(() => (window.__redbutton?.state?.().clicks ?? 0) >= 7, { timeout: 20000 })
    .then(() => true, () => false)
  const st2 = await gs()
  check(`★ 连按 7 下都算数了（clicks=${st2?.clicks}）`, seven, '')
  check(`★ 金币 ${st?.coins} → ${st2?.coins}`, Number(st2?.coins ?? 0) > Number(st?.coins ?? 0), '')
  check('★ 只收了一次钱（宽限期内不再扣）', (await snap()).balance === before.balance - PLAY_COST, String((await snap()).balance))

  await wait(600)
  const c3 = await gameColors('3-playing.png')
  check(`★ 游戏画面不是空白（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)
}

console.log('\n【⑦ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  const stBefore = await gs()
  coinsBefore = stBefore?.coins
  clicksBefore = stBefore?.clicks
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1800)

  const gone = await page.evaluate(() => ({
    bridge: typeof window.__redbutton,
    gp: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
  }))
  check('★ `__redbutton` 已摘（卸载真跑了）', gone.bridge === 'undefined', gone.bridge)
  check('★ `__gpPlayable` 也没有（原版的钩子没留）', gone.gp === 'undefined', gone.gp)
  check('★ `__gpReady` 也没有', gone.ready === 'undefined', gone.ready)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  const styles = await page.evaluate(() =>
    [...document.querySelectorAll('style')].filter((s) => (s.textContent ?? '').includes('#rb-root')).length)
  check('注入的 <style> 也摘掉了（`#rb-root` 那条）', styles === 0, `${styles} 份`)

  const html = await page.evaluate(() => ({
    fs: document.documentElement.style.fontSize,
    lang: document.documentElement.lang,
  }))
  check('★ 没在 <html> 上留 fontSize（宿主是 rem 布局）', !html.fs, html.fs || '(空)')
  check('★ 没改 <html lang>（原版 setLangRaw 会写）', html.lang === 'zh-CN' || html.lang === '', html.lang || '(空)')

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
  console.log(`  （切走前金币 ${coinsBefore}）`)
}

console.log('\n【⑧ 切回：10 分钟内不再收，进度读得回】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__redbutton?.ready === true, { timeout: 60000 })
    .then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  await wait(1500)

  const mid = await snap()
  check(`★ 重新挂载不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, `paidAt 在存档里，10 分钟内不再收`)

  const st = await gs()
  check(`★ 存档读回来了（clicks=${st?.clicks} / 切走前 ${clicksBefore}）`, (st?.clicks ?? -1) === clicksBefore, '')
  check(`★ 金币也读回来了（coins=${st?.coins} / 切走前 ${coinsBefore}）`, String(st?.coins) === String(coinsBefore), String(st?.coins))

  const c4 = await gameColors('4-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c4.n} 种）`, c4.n >= 20, c4.file)

  // 再按一下：仍然在宽限期内，不该再收
  const probe = await pressRed(1500)
  check('切回来按一下也点得到', probe.hittable, JSON.stringify(probe))
  const after = await snap()
  check(`★ 宽限期内按按钮不再扣分（${mid.balance} → ${after.balance}）`, after.balance === mid.balance, String(after.balance))
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
