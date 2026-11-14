#!/usr/bin/env node
/**
 * **偷偷投篮在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→ 翻选关页（不收费）
 * → 余额 0 时点某一关必须被挡且留在选关页 → 补钱后点某关扣 10 进关
 * → 关卡内「重试」不再收 → 切走（卸载干净、存档落盘）→ 切回（设置读得回）→ 再进一关**再扣一次**。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4394 --strictPort
 * node scripts/e2e-hoopsneak.mjs http://127.0.0.1:4394/ phone
 * node scripts/e2e-hoopsneak.mjs http://127.0.0.1:4394/ tablet
 * ```
 *
 * ## 收费点是「进一关」，不是「进 tab」
 *
 * | 动作 | 收不收 |
 * | --- | --- |
 * | 进 tab（标题页）/ 点「选关」翻笔记本 | 不收 |
 * | 点某一关（选关页）/ 标题页「开始·继续」/ 结算页「下一关」 | **收 10** |
 * | 关卡内 HUD 的「重试」/ 结算页「重玩」 | 不收（同一关，已经付过） |
 *
 * ## 这一款是**纯 canvas**（连按钮都是画出来的）
 *
 * DOM 里没有任何游戏按钮 ⇒ 点按钮只能靠调试桥 `__hoopsneak.buttons()` 拿到
 * `{label, x, y}`（容器内 CSS 像素）再用真鼠标点。
 * ★ 别写死像素：换视口（平板 834×1112）整套就废；也别按比例猜 —— 容器高度变了以后
 *   letterbox 的 `offY` 不是线性的。
 *
 * ★★ 本作设计空间是 **1280×720（横屏）**，宿主容器是竖的 ⇒ 游戏在容器里是一条居中的
 *   宽幅画面（上下是同一张笔记本纸背景）。所以「几何三条」里查的是
 *   **容器高 == 父容器高**、**`.hs` 根铺满容器**、**中心没被底栏盖住**，
 *   而不是「游戏内容铺满」—— 后者本来就不成立。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { countColors } from './lib/png-colors.mjs'
import { grantGame } from './lib/own.mjs'

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
const GAME_ID = 'hoopsneak'
/** 底栏那一格的字（4 个字，上限 5） */
const TAB_LABEL = '偷偷投篮'
/** 一关的票价，必须和 `task-games/hoopsneak/plugin.js` 的 PLAY_COST 一致 */
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
/** 切走前记下来的存档探针值（⑦ 写、⑧ 读 —— 跨块所以提到顶层） */
let soundBefore = null
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
    // 现场打印：安装 / 挂载失败时，报错只在 console 里，⑨ 段之前崩掉就看不到了
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

/** 游戏自己的状态（`__hoopsneak` 桥）。没有桥就返回 null。 */
const gs = () =>
  page.evaluate(() => {
    const g = window.__hoopsneak
    if (!g) return null
    return {
      scene: g.scene,
      phase: g.phase,
      level: g.level,
      shots: g.shots,
      power: g.power,
      stars: g.stars,
      totalStars: g.totalStars,
      unlocked: g.unlocked,
      soundOn: g.soundOn,
    }
  })

/**
 * 等游戏真的进到某一屏。
 *
 * ★★ 别用固定 sleep：4.2 MB 包 + 2 MB 音频在 headless + swiftshader 下要十几秒才起来，
 *    固定等待会把「还在加载条上」当成「进标题了」，后面每一步都点空。
 */
const waitScreen = (want, timeout = 90000) =>
  page
    .waitForFunction((s) => window.__hoopsneak?.scene === s, { timeout }, want)
    .then(
      () => true,
      () => false,
    )

/**
 * 按 label 点游戏里画出来的按钮。
 *
 * 整屏都是 canvas ⇒ DOM 里找不到。桥给的 `x/y` 是**容器内 CSS 像素**（Pixi 的 stage 坐标），
 * 加上 canvas 的屏幕位置才是鼠标要落的地方。
 */
const clickGame = async (label) => {
  const hit = await page.evaluate((t) => {
    const g = window.__hoopsneak
    const c = document.querySelector('[data-plugin-host] canvas')
    if (!g || !c) return null
    const b = g.buttons().find((x) => x.label === t)
    if (!b) return null
    const r = c.getBoundingClientRect()
    return { x: r.left + b.x, y: r.top + b.y }
  }, label)
  if (!hit) return false
  await page.mouse.click(hit.x, hit.y)
  return true
}

/** 按设计坐标（1280×720）点 —— 只给纯图标按钮用（HUD 的重试没有文字）。 */
const clickDesign = async (dx, dy) => {
  const hit = await page.evaluate(
    ({ x, y }) => {
      const g = window.__hoopsneak
      const c = document.querySelector('[data-plugin-host] canvas')
      if (!g || !c) return null
      const p = g.designToScreen(x, y)
      const r = c.getBoundingClientRect()
      return { x: r.left + p.x, y: r.top + p.y }
    },
    { x: dx, y: dy },
  )
  if (!hit) return false
  await page.mouse.click(hit.x, hit.y)
  return true
}

const labels = () =>
  page.evaluate(() => (window.__hoopsneak ? window.__hoopsneak.buttons().map((b) => b.label) : []))

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

console.log('\n【④ 进 tab → 标题页 → 选关页：**两步都不收费**】')
{
  const pre = await snap()
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check(`补了 100 积分（${pre.balance} → ${before.balance}）`, before.balance === pre.balance + 100, String(before.balance))

  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))
  check('★ 进到标题页（`__hoopsneak` 起来了）', await waitScreen('title'))
  await wait(1200)

  const canvas = await page.evaluate(
    (id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length,
    GAME_ID,
  )
  check('容器里有 canvas', canvas >= 1, String(canvas))

  const afterEnter = await snap()
  check(`★ 只是进来看一眼：积分没动（${before.balance} → ${afterEnter.balance}）`, afterEnter.balance === before.balance, '')
  check('兑换券没动（C 型零产出）', afterEnter.vouchers === before.vouchers, String(afterEnter.vouchers))

  const c1 = await gameColors('1-title.png')
  check(`★ 标题页画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  /*
   * 几何三条（真宿主独有的判据）：
   *   ① 容器高 == **父容器**高 —— 抓「plugin.js 误补 position:relative」（平板实测 966→600）
   *   ② 游戏自己的 `.hs` 挂载根铺满容器
   *   ③ 容器中心没被底栏 / 弹层盖住
   */
  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const root = el.querySelector('.hs')
    const rr = root ? root.getBoundingClientRect() : null
    const cx = Math.round(r.x + r.width / 2)
    const cy = Math.round(r.y + r.height / 2)
    const hit = document.elementFromPoint(cx, cy)
    return {
      h: Math.round(r.height),
      ph: Math.round(p.height),
      w: Math.round(r.width),
      rh: rr ? Math.round(rr.height) : -1,
      rw: rr ? Math.round(rr.width) : -1,
      hitInside: !!(hit && el.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() : '(null)',
    }
  }, GAME_ID)
  check('插件容器还在', !!geo, geo ? '' : '（容器不在 ⇒ 挂载失败了，看上面的 console.error）')
  check(
    `容器高 == 父容器高（${geo?.h} / ${geo?.ph}）`,
    !!geo && Math.abs(geo.h - geo.ph) <= 1,
    geo ? `${geo.w}×${geo.h} vs 父 ${geo.ph}` : '',
  )
  check(
    `★ 游戏的 .hs 根铺满容器（${geo?.rw}×${geo?.rh} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.rw - geo.w) <= 2 && Math.abs(geo.rh - geo.h) <= 2,
    '',
  )
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)

  // 标题页文案：中文标题 + 没有排行榜 / 语言切换
  const titleLabels = await labels()
  check('★ 标题页有「开始」「选关」', titleLabels.includes('开始') && titleLabels.includes('选关'), titleLabels.join('/'))
  check('★ 没有「星星排行榜」（联网排行榜已拆）', !titleLabels.some((l) => /排行榜/.test(l)), titleLabels.join('/'))

  const gone = await page.evaluate(() => ({
    login: document.body.innerText.includes('登录后可保存游戏进度'),
    cloud: document.body.innerText.includes('跨设备'),
  }))
  check('★ 页面上已经没有「登录后可保存游戏进度」', !gone.login)
  check('★ 页面上已经没有「跨设备」文案', !gone.cloud)

  // ② 翻选关页：只是翻菜单，不收费
  check('点了「选关」', await clickGame('选关'))
  check('★ 进到选关页', await waitScreen('levels', 20000))
  await wait(700)
  const afterLevels = await snap()
  check(`★ 选关页也不收费（${afterEnter.balance} → ${afterLevels.balance}）`, afterLevels.balance === afterEnter.balance, '')

  const lvLabels = await labels()
  // ★ 新存档只有第 1 关解锁。**原版给未解锁的圆钮画的是挂锁、不画数字**，
  //   所以这里能读到标签的只有「1」—— 断言写成「5 个都在」会永远红。
  check(
    `★ 选关页第 1 关可点、2~5 还锁着（能读到的标签：${lvLabels.join('/') || '无'}）`,
    lvLabels.length === 1 && lvLabels[0] === '1',
    lvLabels.join('/'),
  )

  const c2 = await gameColors('2-levels.png')
  check(`★ 选关页画出来了（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)
}

console.log('\n【⑤ 余额 0：点某一关必须被挡住，且留在选关页】')
{
  const cur = (await snap()).balance
  if (cur > 0) {
    await page.evaluate((n) => window.__kqf__.addPoints(-n), cur)
    await wait(600)
  }
  const before = await snap()
  check(`余额已压到 ${before.balance}（< ${PLAY_COST}）`, before.balance < PLAY_COST, String(before.balance))

  check('点了第 1 关', await clickGame('1'))
  await wait(2500)

  const after = await snap()
  const st = await gs()
  check(`★ 积分没被扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '')
  check(`★ 还留在选关页（scene=${st?.scene}）`, st?.scene === 'levels', '被挡了就不该进关')
  // ★ 提示层（toast）是 **Portal 到 `document.body`** 的，不在插件容器里
  const toast = await page.evaluate(() => document.body.innerText.includes('积分不够'))
  check('弹了「积分不够」提示', toast)
}

console.log(`\n【⑥ 余额够：点某一关必须 -${PLAY_COST}，并且真的进关、能投出去】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  check('点了第 1 关', await clickGame('1'))
  check('★ 进到关卡（scene=play）', await waitScreen('play', 25000))

  // ★★ 别用固定 sleep 等「扣费生效」：扣分是宿主事务（平板实测偶尔 > 1.8 秒才回来）。
  //    ⇒ 轮询**宿主余额**才是判据。
  const charged = await page
    .waitForFunction((n) => window.__kqf__.getState().balance === n, { timeout: 20000 }, before.balance - PLAY_COST)
    .then(
      () => true,
      () => false,
    )
  const after = await snap()
  check(`★ 积分 ${before.balance} → ${after.balance}（应为 ${before.balance - PLAY_COST}）`, charged, String(after.balance))
  check('兑换券没动', after.vouchers === before.vouchers, String(after.vouchers))

  const coins = await page
    .evaluate((id) => window.__kqf__.plugin.gameCoinBalance?.(id) ?? 0, GAME_ID)
    .catch(() => 0)
  check('游戏币余额为 0（本作不发行宿主币）', !coins, String(coins))

  // 教学卡（每本笔记本第一关会弹）点掉：canvas 中心点一下
  await wait(1200)
  const c3 = await gameColors('3-level.png')
  check(`★ 关卡画面画出来了（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)

  // 投一球：蓄力 → 松手。判据是 `shots` 从 0 变 1（画面在动，不是静止图）
  const box = await hostBox()
  if (!box) {
    check('插件容器还在（投球需要它）', false, '容器不在 ⇒ 后面几段跳过')
  } else {
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    // ★ 教学卡会吃掉第一次按下：每本笔记本第一关进关时 phase='tutorial'，
    //   那一层 `dim` 是 `eventMode:'static'` + stopPropagation，点一下只关卡片、不蓄力。
    //   不先关掉就投，症状是 shots=0 / phase=aim（看着像「按键没接上」）。
    if ((await gs())?.phase === 'tutorial') {
      await page.mouse.click(cx, cy)
      await page
        .waitForFunction(() => window.__hoopsneak?.phase === 'aim', { timeout: 10000 })
        .catch(() => {})
      check('先点掉了教学卡', (await gs())?.phase === 'aim', (await gs())?.phase)
    }
    await page.mouse.move(cx, cy)
    await page.mouse.down()
    await wait(600)
    await page.mouse.up()
  }
  const thrown = await page
    .waitForFunction(() => (window.__hoopsneak?.shots ?? 0) >= 1, { timeout: 15000 })
    .then(
      () => true,
      () => false,
    )
  const st = await gs()
  check(`★ 投出去了（shots=${st?.shots} / phase=${st?.phase}）`, thrown, '')

  // ★ 关卡内「重试」（HUD 左上那个圆形箭头）**不收费**
  const mid = await snap()
  check('点了 HUD「重试」（设计坐标 1030,44）', await clickDesign(1030, 44))
  await wait(1500)
  const afterRetry = await snap()
  const st2 = await gs()
  check(`★ 重试不再收钱（${mid.balance} → ${afterRetry.balance}）`, afterRetry.balance === mid.balance, '')
  check(`★ 重试后还在同一关（level=${st2?.level}）`, st2?.scene === 'play', `scene=${st2?.scene}`)
  check(`★ 重试把投篮次数清零了（shots=${st2?.shots}）`, st2?.shots === 0, String(st2?.shots))

  await wait(500)
  const c4 = await gameColors('4-play.png')
  check(`★ 重试后画面还在（颜色 ${c4.n} 种）`, c4.n >= 20, c4.file)
}

console.log('\n【⑦ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  /*
   * ★ 挑一个「点一下就能改、重挂载后能读回」的字段当存档探针：
   *   声音开关（`save.sound`）改完是写进存档的，切回来看 `soundOn` 就知道存档通没通。
   *   只比「界面上有字」没有用 —— 同一份内存里读回恒真。
   */
  const set = await page.evaluate(() => {
    try {
      window.__hoopsneak.toggleSound()
      return true
    } catch {
      return false
    }
  })
  check('切了一次声音开关（存档探针）', set)
  await wait(900)
  soundBefore = (await gs())?.soundOn
  check(`声音读出来是 ${soundBefore}（默认 true，切过应为 false）`, soundBefore === false, String(soundBefore))

  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(2500)

  const gone = await page.evaluate(() => ({
    bridge: typeof window.__hoopsneak,
    gp: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
  }))
  check('★ `__hoopsneak` 已摘（卸载真跑了）', gone.bridge === 'undefined', gone.bridge)
  check('★ `__gpPlayable` 也没有（原版的钩子没留）', gone.gp === 'undefined', gone.gp)
  check('★ `__gpReady` 也没有', gone.ready === 'undefined', gone.ready)

  const canvas = await page.evaluate(
    (id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length,
    GAME_ID,
  )
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  const html = await page.evaluate(() => ({
    fs: document.documentElement.style.fontSize,
    lang: document.documentElement.lang,
    title: document.title,
  }))
  check('★ 没在 <html> 上留 fontSize（宿主是 rem 布局）', !html.fs, html.fs || '(空)')
  check('★ 没改 <html lang>（原版 i18n.setLang 会写）', html.lang === 'zh-CN' || html.lang === '', html.lang || '(空)')
  check('★ 没改宿主标题（原版 applyLang 会写）', !/Sneaky Hoops/i.test(html.title), html.title)

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑧ 切回：存档读得回；再进一关**再扣一次**】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('★ 第二次挂载也起来了', await waitScreen('title'))
  await wait(1200)

  const mid = await snap()
  check(`★ 重新挂载不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, '进 tab 本来就不收费')

  const st = await gs()
  check(`★ 存档读回来了（声音 ${st?.soundOn} / 切走前 ${soundBefore}）`, st?.soundOn === soundBefore, '')

  const c5 = await gameColors('5-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c5.n} 种）`, c5.n >= 20, c5.file)

  // 再进一关：这一次点某一关必须**再扣一次**（每关都收）
  check('点「选关」', await clickGame('选关'))
  check('进到选关页', await waitScreen('levels', 20000))
  await wait(600)
  check('点第 1 关', await clickGame('1'))
  check('进到关卡', await waitScreen('play', 25000))
  const charged = await page
    .waitForFunction((n) => window.__kqf__.getState().balance === n, { timeout: 20000 }, mid.balance - PLAY_COST)
    .then(
      () => true,
      () => false,
    )
  const after = await snap()
  check(`★ 第二关也扣了 ${PLAY_COST}（${mid.balance} → ${after.balance}）`, charged, String(after.balance))
}

console.log('\n【⑨ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader|favicon|The AudioContext/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
