#!/usr/bin/env node
/**
 * **轮班守卫在真 App 里走一遍**：安装 → 设为当前 → 进 tab（不收费）→ 翻关卡/卡组/图鉴（都不收费）
 * → 余额 0 时点「出阵」必须被挡且留在卡组页 → 补钱后点「出阵」扣 10 进战场
 * → 切走（卸载干净、存档落盘）→ 切回（设置读得回）→ 再开一关**再扣一次**。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
 * node scripts/e2e-guardshift.mjs http://127.0.0.1:4393/ phone
 * node scripts/e2e-guardshift.mjs http://127.0.0.1:4393/ tablet
 * ```
 *
 * ## 收费点是「出阵」，不是「进 tab」
 *
 * | 动作 | 收不收 |
 * | --- | --- |
 * | 进 tab / 点「防卫模式」/ 看关卡列表 | 不收 |
 * | 选关进卡组页、翻「伙伴图鉴」「永久强化」 | 不收（只是翻菜单） |
 * | 点「出阵」 | **收 10** |
 * | 打输了点「重试」 | 不收（接着同一局打，已经付过） |
 *
 * ★ 所以第 ④ 段要把「进 tab → 关卡列表 → 卡组页 → 图鉴」四步都走一遍并断言积分没动；
 *   只测「进 tab 不收费」会漏掉「点错地方也扣钱」这种更严重的错。
 *
 * ## 这游戏是 **DOM UI + canvas 战场** 两层
 *
 * 按钮是真正的 `<button>`（preact），所以能按文字点；战场是 Pixi 画的，只能看像素。
 * 「画面是不是空白」用**容器裁剪截图 + 颜色种类数**判断，`innerText` 在这里恒为空。
 *
 * ## 调试桥是 `window.__guardshift`
 *
 * `state()` 只读；`act.route()/place()/wave()/step()` 是给走查和 e2e 用的等价动作。
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
const GAME_ID = 'guardshift'
/** 底栏那一格的字（4 个字，上限 5） */
const TAB_LABEL = '轮班守卫'
/** 一关的票价，必须和 `task-games/guardshift/plugin.js` 的 PLAY_COST 一致 */
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
/** 切走前记下来的游戏内状态（⑦ 写、⑧ 读 —— 跨块所以提到顶层） */
let diffBefore = null
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
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
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
/**
 * 点游戏界面里的按钮（都在 `.gs .ui` 里，别和宿主按钮混了）。
 *
 * ★ 同时匹配 `aria-label`：这一款的返回键是**纯图标**（`.btn.icon`），
 *   `innerText` 是空串 —— 只按文字找会「点了个空」，而返回失败会让后面整段
 *   （图鉴、再开一局）全部错位，看起来像「图鉴点不开」。
 */
const clickGame = (label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('[data-plugin-host] .ui button')].find(
      (x) => (x.innerText ?? '').includes(t) || (x.getAttribute('aria-label') ?? '').includes(t),
    )
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

/** 游戏自己的状态（`__guardshift` 桥）。没有桥就返回 null。 */
const gs = () => page.evaluate(() => window.__guardshift?.state?.() ?? null)

/**
 * 等游戏真的进到某一屏。
 *
 * ★★ 别用固定 sleep：8 MB 资源在 headless + swiftshader 下要 20 秒左右才 `assetsReady`，
 *    固定等待会把「还在加载条上」当成「进标题了」，后面每一步都点空。
 */
const waitScreen = (want, timeout = 60000) =>
  page
    .waitForFunction((s) => window.__guardshift?.state?.().screen === s, { timeout }, want)
    .then(
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

console.log('\n【④ 进 tab → 关卡列表 → 卡组页 → 图鉴：**四步都不收费**】')
{
  const pre = await snap()
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check(`补了 100 积分（${pre.balance} → ${before.balance}）`, before.balance === pre.balance + 100, String(before.balance))

  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))
  check('★ 进到标题页（`__guardshift` 起来了）', await waitScreen('title', 90000))
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
   *   ② 游戏自己的 `.gs` 根铺满容器
   *   ③ 容器中心没被底栏 / 弹层盖住
   */
  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const root = el.querySelector('.gs')
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
    `★ 游戏的 .gs 根铺满容器（${geo?.rw}×${geo?.rh} / ${geo?.w}×${geo?.h}）`,
    !!geo && Math.abs(geo.rw - geo.w) <= 2 && Math.abs(geo.rh - geo.h) <= 2,
    '',
  )
  check('容器中心没被底栏/弹层盖住', !!geo?.hitInside, `命中的是 ${geo?.hitTag ?? '(无)'}`)

  // ② 翻菜单：关卡列表 / 卡组页 / 图鉴 —— 全都不该收费
  check('点了「防卫模式」', await clickGame('防卫模式'))
  await wait(900)
  check('点了「1-1」', await clickGame('1-1'))
  check('★ 进到卡组页', await waitScreen('deck', 15000))
  await wait(600)
  const afterDeck = await snap()
  check(`★ 卡组页也不收费（${afterEnter.balance} → ${afterDeck.balance}）`, afterDeck.balance === afterEnter.balance, '')

  check('回到关卡列表（返回）', await clickGame('返回'))
  await wait(800)
  check('点了「伙伴图鉴」', await clickGame('伙伴图鉴'))
  check('★ 进到图鉴页', await waitScreen('roster', 15000))
  await wait(600)
  const afterRoster = await snap()
  check(`★ 图鉴也不收费（${afterDeck.balance} → ${afterRoster.balance}）`, afterRoster.balance === afterDeck.balance, '')
  const c2 = await gameColors('2-roster.png')
  check(`★ 图鉴画出来了（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)

  const gone = await page.evaluate(() => ({
    login: document.body.innerText.includes('登录后可保存游戏进度'),
    cloud: document.body.innerText.includes('跨设备'),
  }))
  check('★ 页面上已经没有「登录后可保存游戏进度」', !gone.login)
  check('★ 页面上已经没有「跨设备」文案', !gone.cloud)

  // 回到卡组页，给下一段用
  check('返回关卡列表', await clickGame('返回'))
  await wait(800)
  check('再进 1-1', await clickGame('1-1'))
  check('回到卡组页', await waitScreen('deck', 15000))
}

console.log(`\n【⑤ 余额 0：点「出阵」必须被挡住，且留在卡组页】`)
{
  const cur = (await snap()).balance
  if (cur > 0) {
    await page.evaluate((n) => window.__kqf__.addPoints(-n), cur)
    await wait(600)
  }
  const before = await snap()
  check(`余额已压到 ${before.balance}（< ${PLAY_COST}）`, before.balance < PLAY_COST, String(before.balance))

  check('点了「出阵」', await clickGame('出阵'))
  await wait(2000)

  const after = await snap()
  const st = await gs()
  check(`★ 积分没被扣（${before.balance} → ${after.balance}）`, after.balance === before.balance, '')
  check(`★ 还留在卡组页（screen=${st?.screen}）`, st?.screen === 'deck', '被挡了就不该进战场')
  // ★ 提示层（toast）是 **Portal 到 `document.body`** 的，不在插件容器里
  const toast = await page.evaluate(() => document.body.innerText.includes('积分不够'))
  check('弹了「积分不够」提示', toast)
}

console.log(`\n【⑥ 余额够：点「出阵」必须 -${PLAY_COST}，并且真的开打】`)
{
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check('余额回到 100', before.balance === 100, String(before.balance))

  check('点了「出阵」', await clickGame('出阵'))
  check('★ 进到战场（screen=battle）', await waitScreen('battle', 20000))

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

  // 放两个兵 + 开波：证明战场真的在跑，不是一张静止图
  const placed = await page.evaluate(() => {
    const g = window.__guardshift
    const route = g.act.route()
    const kinds = ['archer', 'spear', 'bomb']
    const out = []
    for (const key of route.slice(Math.floor(route.length * 0.35), Math.floor(route.length * 0.85))) {
      if (out.length >= 2) break
      const [c, r] = key.split(',').map(Number)
      for (const [dc, dr] of [
        [0, 1],
        [0, -1],
        [1, 0],
        [-1, 0],
      ]) {
        if (out.length >= 2) break
        const res = g.act.place(kinds[out.length], c + dc, r + dr)
        if (res?.placed) {
          out.push({ c: c + dc, r: r + dr })
          break
        }
      }
    }
    return out
  })
  check(`★ 放了 2 个兵（路径格四邻）`, placed.length === 2, JSON.stringify(placed))

  await page.evaluate(() => window.__guardshift.act.wave())
  const fighting = await page
    .waitForFunction(
      () => {
        const s = window.__guardshift?.state?.()
        return !!s && s.phase === 'battle' && s.mobs > 0
      },
      { timeout: 20000 },
    )
    .then(
      () => true,
      () => false,
    )
  const st = await gs()
  check(`★ 开波了、敌人出来了（phase=${st?.phase} / mobs=${st?.mobs}）`, fighting, '')
  check(`★ 场上还站着我们放的兵（units=${st?.units}）`, (st?.units ?? 0) >= 2, String(st?.units))

  await wait(700)
  const c3 = await gameColors('3-battle.png')
  check(`★ 战场不是空白（颜色 ${c3.n} 种）`, c3.n >= 20, c3.file)
}

console.log('\n【⑦ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  /*
   * ★ 挑一个「点一下就能改、重挂载后能读回」的字段当存档探针：
   *   难度（Normal / Hard）改完是写进存档的，切回来看 `difficulty` 就知道存档通没通。
   *   只比「界面上有字」没有用 —— 同一份内存里读回恒真。
   */
  const set = await page.evaluate(() => {
    try {
      window.__guardshift.act.setDifficulty(1)
      return true
    } catch {
      return false
    }
  })
  check('把难度切成 Hard（存档探针）', set)
  await wait(900)
  diffBefore = (await gs())?.difficulty
  check(`难度读出来是 1（${diffBefore}）`, diffBefore === 1, String(diffBefore))

  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(2000)

  const gone = await page.evaluate(() => ({
    bridge: typeof window.__guardshift,
    gp: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
  }))
  check('★ `__guardshift` 已摘（卸载真跑了）', gone.bridge === 'undefined', gone.bridge)
  check('★ `__gpPlayable` 也没有（原版的钩子没留）', gone.gp === 'undefined', gone.gp)
  check('★ `__gpReady` 也没有', gone.ready === 'undefined', gone.ready)

  const canvas = await page.evaluate(
    (id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length,
    GAME_ID,
  )
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  const styles = await page.evaluate(
    () => [...document.querySelectorAll('style')].filter((s) => (s.textContent ?? '').includes('.gs .ui')).length,
  )
  check('注入的 <style> 也摘掉了（`.gs .ui` 那条）', styles === 0, `${styles} 份`)

  const html = await page.evaluate(() => ({
    fs: document.documentElement.style.fontSize,
    lang: document.documentElement.lang,
    title: document.title,
  }))
  check('★ 没在 <html> 上留 fontSize（宿主是 rem 布局）', !html.fs, html.fs || '(空)')
  check('★ 没改 <html lang>', html.lang === 'zh-CN' || html.lang === '', html.lang || '(空)')
  check('★ 没改宿主标题（原版 applyLang 会写）', !/Guardshift/i.test(html.title), html.title)

  check(`★ gameKv 里出现 ${GAME_ID} 的行（存档落盘）`, (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑧ 切回：存档读得回；再开一关**再扣一次**】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('★ 第二次挂载也起来了', await waitScreen('title', 90000))
  await wait(1200)

  const mid = await snap()
  check(`★ 重新挂载不扣分（${before.balance} → ${mid.balance}）`, mid.balance === before.balance, '进 tab 本来就不收费')

  const st = await gs()
  check(`★ 存档读回来了（难度 ${st?.difficulty} / 切走前 ${diffBefore}）`, st?.difficulty === diffBefore, '')

  const c4 = await gameColors('4-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c4.n} 种）`, c4.n >= 20, c4.file)

  // 再开一关：这一次点「出阵」必须**再扣一次**（每局都收）
  check('点「防卫模式」', await clickGame('防卫模式'))
  await wait(900)
  check('点「1-1」', await clickGame('1-1'))
  check('进到卡组页', await waitScreen('deck', 15000))
  await wait(500)

  check('点「出阵」', await clickGame('出阵'))
  check('进到战场', await waitScreen('battle', 20000))
  const charged = await page
    .waitForFunction((n) => window.__kqf__.getState().balance === n, { timeout: 20000 }, mid.balance - PLAY_COST)
    .then(
      () => true,
      () => false,
    )
  const after = await snap()
  check(`★ 第二局也扣了 ${PLAY_COST}（${mid.balance} → ${after.balance}）`, charged, String(after.balance))
}

console.log('\n【⑨ 异常】')
{
  const NOISE = /sound|audio|404|Failed to load resource|WebGL|shader|favicon/i
  const real = consoleErrors.filter((t) => !NOISE.test(t))
  check('没有意外的 console.error', real.length === 0, real.slice(0, 3).join(' | '))
}

await browser.close()

console.log(fails.length ? `\n✗ ${fails.length} 条没过：\n  - ${fails.join('\n  - ')}\n` : '\n✓ 全部通过\n')
process.exit(fails.length ? 1 : 0)
