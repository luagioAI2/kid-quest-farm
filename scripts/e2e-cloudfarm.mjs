/**
 * **云边小农场在真 App 里走一遍**（安装 → 设为当前 → 花积分种地 → 卖券 → 切走 → 卸载）。
 *
 * 用法：
 *   npm run build
 *   CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4391 --strictPort
 *   node scripts/e2e-cloudfarm.mjs http://127.0.0.1:4391/ [phone|tablet]
 *
 * ## 为什么不能只靠 `cloudfarm/scripts/e2e-economy.mjs`
 *
 * 那一份跑在**假宿主**上（`cloudfarm/_plugin-test.html`）。假宿主按契约记账，
 * 所以它能证明「插件确实调了 `spendPoints` / `mintVoucher`」——
 * 但它**证明不了真宿主会不会接**：
 *
 * | 只有真宿主能给 | 假宿主里永远绿 |
 * | --- | --- |
 * | `checkPluginEconomy` 真的放行（`expectedPayout ≤ 0.8 × playCost`） | 假宿主不做经济校验 |
 * | `spendPoints` 真的落成 `db.ledger` 一行（`source: game_spend`） | 假宿主只往数组里 push |
 * | `mintVoucher` 真的落成 `db.harvestLedger` 一行 | 同上 |
 * | 宿主顶栏的 🪙 余额真的跟着掉 | 没有顶栏 |
 * | 切走后 `window.__farm` 真的消失（unmount 真跑了） | 没有宿主生命周期 |
 *
 * ## 断言的骨架：每一条都要有能失败的前提
 *
 * ① 动手前**一款都没装** —— 否则后面「装上了」可能恒真；
 * ② 装完看的是**界面上那一行变成「已安装」**，不是 store 的返回值；
 * ③ 扣钱的判据是 **`db.ledger` 里多了一行 `delta = -8` 且 `refId = cloudfarm`**，
 *    不是 `farm.s.points` —— 后者是插件自己维护的镜像，插件印钱也能好看；
 * ④ 发券的判据是 **`db.harvestLedger` 多了一行**，不是提示文字；
 * ⑤ 全程 `db.ledger` **不许出现正数行** —— 没有任何 HostApi 能让积分变多。
 *
 * ## ⚠️ 金额一律用**差值**，不写绝对值
 *
 * 第一版写死了 `=== 492`，结果整片红：新库里不是 0 积分（有 50 分欢迎礼），
 * 于是「500 → 492」实际是「550 → 542」。**钱走对了，是断言错了。**
 * 一条会因为「环境里有个欢迎礼」而红的断言，和产品无关，只会训练人去忽略红色。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir, SCRATCH_BASE } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4391/'
const VIEWPORT = process.argv[3] ?? 'phone'
const GAME_ID = 'cloudfarm'

/** 版本号从清单里读，不写死（写死只会因为「忘了改脚本」而红） */
const GAME_VERSION = (() => {
  const src = readFileSync(new URL('../src/games/localGames.ts', import.meta.url), 'utf8')
  const m = src.match(/"id":\s*"cloudfarm"[\s\S]{0,200}?"version":\s*"([^"]+)"/)
  if (!m) throw new Error('在 localGames.ts 里找不到 cloudfarm 的 version —— 清单没生成？')
  return m[1]
})()

/** 种一株小萝卜要多少积分（`cloudfarm/src/data/catalog.js` 的 seed） */
const RADISH_COST = 8

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('✗ 找不到 Chrome / Edge —— 设 CHROME_PATH 指过去')
  process.exit(2)
}

const SIZES = { phone: { width: 390, height: 844 }, tablet: { width: 834, height: 1112 } }
const size = SIZES[VIEWPORT]
if (!size) {
  console.error(`✗ 不认识的视口：${VIEWPORT}（可选 ${Object.keys(SIZES).join(' / ')}）`)
  process.exit(2)
}

const OUT = join(SCRATCH_BASE, 'cloudfarm-e2e')
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\n云边小农场 · 真宿主走查（${VIEWPORT} ${size.width}×${size.height}）`)
console.log(`目标 App：${TARGET}\n`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir(`cloudfarm-${VIEWPORT}`),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
const consoleErrors = []
page.on('console', (m) => {
  // 字体 CDN 连不通是预期（字体没随包，见 cloudfarm/src/ui.js 顶部注释）
  if (m.type() === 'error' && !/makeplay|fonts/i.test(m.text())) consoleErrors.push(m.text())
})

const waitForApp = (p) =>
  p.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 30000 })

await page.setViewport({ ...size, deviceScaleFactor: 1 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await waitForApp(page)
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__?.plugin, { timeout: 15000 })
await wait(300)

/* ============================================================
   小工具
   ============================================================ */
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

const waitFor = (sel, timeout = 15000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(
    () => true,
    () => false,
  )

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

/**
 * 直接读 IndexedDB 的某张表。
 *
 * ⚠️ 不经过 `window.__kqf__`：宿主没把 `db` 挂上去（那是故意的）。
 *   这里读的是**宿主自己的账本**，也正是「钱真的走了」唯一的判据。
 *   打开时不传 version ⇒ 用当前版本，不会触发降级错误。
 */
const readTable = (store) =>
  page
    .evaluate(
      (name) =>
        new Promise((res, rej) => {
          const req = indexedDB.open('kid-quest-farm')
          req.onerror = () => rej(String(req.error))
          req.onsuccess = () => {
            const db = req.result
            if (!db.objectStoreNames.contains(name)) {
              db.close()
              return res('[]')
            }
            const tx = db.transaction(name, 'readonly')
            const all = tx.objectStore(name).getAll()
            all.onsuccess = () => {
              const v = all.result
              db.close()
              res(JSON.stringify(v))
            }
            all.onerror = () => {
              db.close()
              rej(String(all.error))
            }
          }
        }),
      store,
    )
    .then((s) => JSON.parse(s))

const ledger = () => readTable('ledger')
const harvestLedger = () => readTable('harvestLedger')

/** 打开「设置 → 游戏」并过家长密码（先切栏，再过密码 —— 反了会重新上锁） */
async function openGameSettings() {
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('设置'),
    )
    if (!b) return false
    b.click()
    return true
  })
  if (!opened) return '找不到顶栏的设置按钮'
  await wait(700)
  if (!(await clickText('游戏'))) return '设置页里没有「游戏」那一栏'
  await wait(600)
  for (let round = 0; round < 2; round++) {
    const locked = await page.evaluate(() => document.body.innerText.includes('请输入家长密码'))
    if (!locked) return null
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
        b?.click()
      })
      await wait(180)
    }
    await wait(600)
  }
  const stillLocked = await page.evaluate(() => document.body.innerText.includes('请输入家长密码'))
  return stillLocked ? '家长密码没过（PIN 不是 0000？）' : null
}

async function leaveSettings() {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('返回'),
    )
    if (b) b.click()
  })
  await wait(600)
}

/* ============================================================
   ⓪ 基线
   ============================================================ */
/** 灌完启动资金之后的积分。后面所有金额断言都以它为基准（**不写绝对值**） */
let P0 = 0
console.log('【⓪ 基线】')
{
  const hostApi = await page.evaluate(() => window.__kqf__.plugin.hostApiVersion)
  check('宿主契约版本 ≥ 4（有 mintVoucher）', hostApi >= 4, `HOST_API=${hostApi}`)

  const before = await snap()
  check('动手前一款插件游戏都没装', before.installed.length === 0, before.installed.join(',') || '(空)')
  check('动手前当前游戏是农场', before.active === 'farm', before.active)
  check('动手前兑换券是 0', before.vouchers === 0, String(before.vouchers))
  // ⚠️ 不断言「积分是 0」：新库里有欢迎礼，实测是 50。写死 0 只会误报。
  console.log(`    基线积分（含欢迎礼）: ${before.balance}`)

  // 给一笔启动积分。走 `manual_adjust`（家长手动调整），这是 App 唯一合法的加分口 ——
  // 插件没有任何办法做到这件事，下面 ③ 会钉住这一点。
  await page.evaluate(() => window.__kqf__.addPoints(500))
  await wait(600)
  const seeded = await snap()
  P0 = seeded.balance
  check('加了 500 积分（走 manual_adjust）', P0 === before.balance + 500, `${before.balance}→${P0}`)
}

/* ============================================================
   ① 安装
   ============================================================ */
console.log('\n【① 安装：设置 → 游戏 → 随 App 附带 → 安装】')
{
  const err = await openGameSettings()
  check('打开「设置 → 游戏」并过了家长密码', err === null, err ?? '')

  const row = await page.evaluate((id) => {
    const li = document.querySelector(`[data-local-row="${id}"]`)
    if (!li) return null
    const btn = li.querySelector('[data-local-install]')
    return {
      text: (li.innerText ?? '').replace(/\s+/g, ' ').trim(),
      hasButton: !!btn,
      disabled: btn ? btn.disabled : true,
    }
  }, GAME_ID)
  check('「随 App 附带」里列出了云边小农场', !!row, row?.text ?? '(没找到那一行)')
  check('安装按钮在、而且是可点的', !!row?.hasButton && row?.disabled === false, JSON.stringify(row))

  check('点了「安装」', await clickSel(`[data-local-install="${GAME_ID}"]`))
  check('★ 界面上那一行变成了「已安装」', await waitFor(`[data-local-installed="${GAME_ID}"]`, 25000))

  const ver = await page.evaluate((id) => window.__kqf__.plugin.installed()[id]?.version, GAME_ID)
  check(`装上的版本是 v${GAME_VERSION}`, ver === GAME_VERSION, ver ?? '(没装上)')

  /*
   * ★ 装得上 = `checkPluginEconomy` 放行了。这是本作最关键的一关：
   *   `playCost 10 / expectedPayout 6.5`（0.65 ≤ 0.8）。写反了会在这里红，
   *   而假宿主里永远是绿的（它不做经济校验）。
   */
  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  console.log('    家长看到的说明:', econ || '(没有 [data-plugin-economy])')

  const after = await snap()
  check('已安装清单里有 cloudfarm', after.installed.includes(GAME_ID), after.installed.join(','))
  check('安装本身没花积分', after.balance === P0, String(after.balance))
}

/* ============================================================
   ② 设为当前 + 进游戏
   ============================================================ */
console.log('\n【② 设为当前 → 点底栏进去】')
{
  check('点了「设为当前」', await clickSel(`[data-plugin-set-current="${GAME_ID}"]`))
  await wait(800)
  const active = (await snap()).active
  check('store 里当前游戏切成了 cloudfarm', active === GAME_ID, active)
}

await leaveSettings()
await waitForApp(page)

{
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    return b ? (b.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  }, GAME_ID)
  // 游戏格是**运行时算**的：插件当值时这一格就是 tab-cloudfarm（没有单独的 tab-farm）
  check('底部导航那一格换成了「农场」（tabLabel 真的被用了）', tab.includes('农场'), tab || '(没有这一格)')
}

let pointsAfterPlant = 0
{
  check('点了底部那一格', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器（`data-plugin-host`）', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))

  const playable = await page
    .waitForFunction(() => window.__gpPlayable === true, { timeout: 90000 })
    .then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__gpPlayable`，纹理都到位）', playable)

  const shape = await page.evaluate((id) => {
    const box = document.querySelector(`[data-plugin-host="${id}"]`)
    const cv = box?.querySelector('canvas')
    const ui = box?.querySelector('#ui')
    const r = (el) => (el ? Math.round(el.getBoundingClientRect().height) : 0)
    return {
      hostH: r(box),
      parentH: r(box?.parentElement),
      canvas: box?.querySelectorAll('canvas').length ?? 0,
      canvasH: r(cv),
      uiH: r(ui),
      uiOnBody: !!document.body.querySelector(':scope > #ui'),
      // HUD 上不该再有 🪙 胶囊（宿主顶栏已经有了）和「＋」按钮
      plus: box?.querySelectorAll('#plusBtn, .plus').length ?? 0,
      hasVoucherPill: !!box?.querySelector('#hp'),
    }
  }, GAME_ID)
  /*
   * ★★ 判据是「容器 == 它的父容器」，**不是**「canvas == 容器」。
   *
   * 2026-10-24 实测：插件 `mount()` 把宿主的 `absolute inset-0` 覆盖成 `relative`
   * ⇒ `bottom:0` 失效、盒子退回内容高度 ⇒ 平板上 966 的父容器里只有 600。
   * 而当时 `canvasH === hostH`（600 == 600）**照样绿** —— 因为容器就是被 canvas
   * 撑出来的。两个数一起错，比对一个数还像对的。
   * 只有量到**父容器**才能发现。
   */
  check(
    '★ 插件盒子填满宿主给的父容器（不是被内容撑出来的）',
    shape.hostH > 100 && Math.abs(shape.hostH - shape.parentH) <= 1,
    `父容器 ${shape.parentH} · 插件盒 ${shape.hostH}`,
  )
  check(
    'canvas 填满插件盒子',
    shape.canvas === 1 && Math.abs(shape.canvasH - shape.hostH) <= 2,
    `盒子 ${shape.hostH} · canvas ${shape.canvasH}`,
  )
  check('UI 层在容器里（没漏到 body 上）', shape.uiH > 0 && shape.uiOnBody === false, `ui ${shape.uiH}`)
  check('★ HUD 上没有「＋」按钮', shape.plus === 0, `plus=${shape.plus}`)
  check('HUD 上有 🎟️ 兑换券胶囊', shape.hasVoucherPill)
  // 留一张图给走查（`screenshots/` 才是要留的，这里进 scratch）
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-host.png`) })

  /* ---- 花积分种一株小萝卜 ---- */
  const ledBefore = await ledger()
  const plantedRes = await page.evaluate((crop) => {
    const farm = window.__farm?.farm
    if (!farm) return { ok: false, why: '没有 window.__farm' }
    const i = farm.s.plots.findIndex((p) => p.unlocked && !p.crop)
    if (i < 0) return { ok: false, why: '没有空地' }
    return { ok: farm.plant(i, crop), i }
  }, 'radish')
  check('种下一株小萝卜', plantedRes.ok, plantedRes.why ?? `plot=${plantedRes.i}`)
  await wait(1000) // 扣款是异步的（wallet 串行 promise 链）

  const ledAfter = await ledger()
  const newRows = ledAfter.slice(ledBefore.length)
  const spendRow = newRows.find((r) => r.delta === -RADISH_COST && r.refId === GAME_ID)
  /*
   * ★ 判据是**宿主账本**，不是 `farm.s.points`。
   *   插件自己印钱也能让镜像好看 —— 只有账本行能证明钱真的走了。
   */
  check(
    `★ \`db.ledger\` 多了一行 -${RADISH_COST}（source=game_spend, refId=cloudfarm）`,
    !!spendRow,
    newRows.length ? JSON.stringify(newRows.map((r) => [r.delta, r.source, r.refId])) : '(没有新行)',
  )
  check('那一行的 source 是 game_spend', spendRow?.source === 'game_spend', spendRow?.source ?? '-')

  const afterPlant = await snap()
  pointsAfterPlant = afterPlant.balance
  check(
    `★ 宿主积分真的扣了 ${RADISH_COST}`,
    afterPlant.balance === P0 - RADISH_COST,
    `${P0}→${afterPlant.balance}`,
  )
  check('种地没发兑换券', afterPlant.vouchers === 0, String(afterPlant.vouchers))
}

/* ============================================================
   ③ 收成 → 卖出 → 兑换券
   ============================================================ */
console.log('\n【③ 收成 → 卖出 → 兑换券】')
{
  const hlBefore = await harvestLedger()
  const res = await page.evaluate(async () => {
    const farm = window.__farm?.farm
    if (!farm) return { ok: false, why: '没有 window.__farm' }
    // 推到成熟（等效于等它长完，不改产出数量）
    for (const p of farm.s.plots) if (p.crop) p.crop.readyAt = farm.now() - 1
    let harvested = 0
    for (let i = 0; i < 12; i++) {
      const r = farm.harvest(i, 'store')
      if (r && r.amount > 0) harvested += r.amount
    }
    const bag = farm.s.bag.radish || 0
    const sold = farm.sell('radish', bag)
    await new Promise((r) => setTimeout(r, 1500)) // 发券是串行 promise 链
    return { ok: true, harvested, bag, sold }
  })
  check('收成进背包', res.ok && res.harvested > 0, res.why ?? `收了 ${res.harvested} 个`)
  check('卖出一批小萝卜', res.sold?.count > 0, `count=${res.sold?.count} earned=${res.sold?.earned}`)

  const hlAfter = await harvestLedger()
  const newHl = hlAfter.slice(hlBefore.length)
  const row = newHl.find((r) => r.delta === res.sold?.earned && r.refId === GAME_ID)
  check(
    '★ `db.harvestLedger` 多了一行（mintVoucher 真的落到宿主账本）',
    !!row,
    newHl.length ? JSON.stringify(newHl.map((r) => [r.delta, r.source, r.refId])) : '(没有新行)',
  )

  const afterSell = await snap()
  check(
    '★ 宿主兑换券 0 → earned',
    afterSell.vouchers === (res.sold?.earned ?? -1),
    `0→${afterSell.vouchers}（卖出申报 ${res.sold?.earned}）`,
  )
  check(
    '卖出**没有**把积分加回来',
    afterSell.balance === pointsAfterPlant,
    `${pointsAfterPlant}→${afterSell.balance}`,
  )

  /* ---- 全程不许出现正数积分行 ---- */
  const all = await ledger()
  const positives = all.filter((r) => r.delta > 0 && r.refId === GAME_ID)
  check(
    '★ 插件全程没往积分账本写正数（没有任何 HostApi 能发积分）',
    positives.length === 0,
    positives.length ? JSON.stringify(positives.map((r) => [r.delta, r.source])) : '0 行',
  )
}

/* ============================================================
   ④ 切走 → 插件真的卸载
   ------------------------------------------------------------
   ⚠️ 不能点 `tab-farm`：插件当值时**游戏格就是插件本身**（`tab-${activeGameId}`），
      底栏里根本没有 `tab-farm` 那一格。要「切走」只能点别的栏（任务 / 兑换 / 积分）。
      第一版就是点了 `tab-farm` ⇒ 三条连带红，看着像 unmount 没跑。
   ============================================================ */
console.log('\n【④ 切到「任务」栏 → 插件卸载】')
{
  check('点底栏「任务」那一格', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1200)
  const gone = await page
    .waitForFunction(() => !window.__farm, { timeout: 10000 })
    .then(() => true, () => false)
  check('★ 切走后 `window.__farm` 消失（unmount 真跑了）', gone)
  const box = await page.evaluate(
    (id) => !!document.querySelector(`[data-plugin-host="${id}"]`),
    GAME_ID,
  )
  check('宿主容器也收掉了', box === false)

  const after = await snap()
  check(
    '积分没变（切走没退钱）',
    after.balance === pointsAfterPlant,
    `${pointsAfterPlant}→${after.balance}`,
  )
}

/* ============================================================
   ⑤ 卸载
   ============================================================ */
console.log('\n【⑤ 卸载：设置 → 游戏 → 卸载】')
{
  const err = await openGameSettings()
  check('再次打开「设置 → 游戏」', err === null, err ?? '')
  const clicked = await page.evaluate((id) => {
    const b = document.querySelector(`[data-plugin-uninstall="${id}"]`)
    if (!b) return false
    b.click()
    return true
  }, GAME_ID)
  check('点了「卸载」', clicked)
  await wait(600)
  // 二次确认（`data-plugin-uninstall-confirm`，别按文字找 —— 文案里还并排着「取消」）
  const confirmed = await page.evaluate((id) => {
    const b = document.querySelector(`[data-plugin-uninstall-confirm="${id}"]`)
    if (!b) return false
    b.click()
    return true
  }, GAME_ID)
  check('点了「确认卸载」', confirmed)
  await wait(1500)

  const after = await snap()
  check(
    '已安装清单里没有 cloudfarm 了',
    !after.installed.includes(GAME_ID),
    after.installed.join(',') || '(空)',
  )
  check('当前游戏退回农场', after.active === 'farm', after.active)
  check(
    '积分没变（卸载不动钱）',
    after.balance === pointsAfterPlant,
    `${pointsAfterPlant}→${after.balance}`,
  )
  check('兑换券还在（卸载不退券）', after.vouchers > 0, String(after.vouchers))
}

/* ============================================================
   ⑥ 收尾：异常
   ============================================================ */
console.log('\n【⑥ 异常】')
check('没有未捕获的页面异常', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
check('没有控制台 error', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

await browser.close()

console.log(`\n${failed ? `✗ 失败 ${failed} 项` : '✓ 全部通过'}`)
process.exit(failed ? 1 : 0)
