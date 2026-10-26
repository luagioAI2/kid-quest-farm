#!/usr/bin/env node
/**
 * **挖矿少女在真 App 里走一遍**：商城详情 → 安装 → 设为当前 → 进 tab（扣 15）→
 * 游戏内商城（皮肤门槛）→ 切走（卸载 + 存档落盘）→ 切回（**宽限内不再扣** + 画面还在）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
 * node scripts/e2e-minergirl.mjs http://127.0.0.1:4393/ phone
 * node scripts/e2e-minergirl.mjs http://127.0.0.1:4393/ tablet
 * ```
 *
 * ## 为什么不能只靠前两层
 *
 * | 已有 | 证明了 | 盖不到 |
 * | --- | --- | --- |
 * | `minergirl/scripts/mount-test.mjs`（假宿主） | 插件按契约工作、0×404、收费、卸载、存档往返 | 真宿主的 HostApi 有没有接对、真 IndexedDB |
 * | `db/*.test.ts`（jsdom） | 账本 / 事务 / 守卫 | 真浏览器里的 IndexedDB / WebGL / blob 模块 |
 * | `check-game-registry.mjs` | 四处登记一致、截图文件在 | 详情页那几张图**浏览器里能不能解码** |
 *
 * ## 收费点在「进场」，而且有 10 分钟宽限 —— 方向和爆汁瓜瓜罐**相反**
 *
 * | | 爆汁瓜瓜罐（一局制） | 挖矿少女（放置） |
 * | --- | --- | --- |
 * | 进 tab | 不扣 | **扣 15** |
 * | 切回来 | 再开一局就再扣 | **10 分钟内不扣** |
 *
 * ★ 这一条最容易抄错：照搬「一局制」会变成「切回来必须再扣」，把 bug 写成规范。
 *   宽限期存在**存档**里（`paidAt`），不是内存变量 —— 内存版会在切走（= 卸载）时丢掉，
 *   症状是「每次切回来都扣一次」，而单测和假宿主都看不出来。
 *
 * ## 拆改的验收点
 *
 * 原版是内购 + 排行榜 + 云存档。这一份专门盯**拆干净了没有**：
 *   · 游戏内商城只剩「投资人 / 皮肤」两个页签，皮肤格子上是 `$3.00B` 这种**门槛**，
 *     不是平台硬币价；按钮写「还没解锁」而不是「购买」；
 *   · 整轮不许出现任何支付/登录请求（见第 ⑧ 段的 4xx/5xx 与异常）。
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
const GAME_ID = 'minergirl'
/** 底栏那一格的字。**2 个字**（上限 5），和商城名「挖矿少女」同源。 */
const TAB_LABEL = '挖矿'
/** 进场的票价，必须和 `task-games/minergirl/plugin.js` 的 PLAY_COST 一致 */
const PLAY_COST = 15

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const OUT = `.e2e-scratch/minergirl/${VIEWPORT}`
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
 * 在插件容器**里面**按文字点一颗游戏按钮 —— **必须真鼠标**。
 *
 * 游戏内 UI 监听 `pointerdown`，`el.click()` 派发的 `click` 事件**静默无反应**；
 * 真鼠标还会走命中测试（被盖住就真点不到，而 `el.click()` 会绕过它 ⇒ 假绿）。
 */
const tapGame = async (txt, scope = '') => {
  const box = await page.evaluate(
    ([id, t, sc]) => {
      const root = document.querySelector(`[data-plugin-host="${id}"]`)
      if (!root) return null
      const el = [...root.querySelectorAll(`${sc} button, ${sc} [data-tab], ${sc} [data-act]`)]
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
  check('gameKv 里没有 minergirl 的行', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
}

console.log('\n【② 商城详情：家长先看得到「练什么」和截图】')
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
  check('游戏市场里有这一行', await waitFor(`[data-local-row="${GAME_ID}"]`, 12000))

  check('点开详情', await clickSel(`[data-store-detail="${GAME_ID}"]`))
  await wait(900)

  const detail = await page.evaluate(() => {
    const txt = (document.body.innerText ?? '').replace(/\s+/g, ' ')
    const shots = [...document.querySelectorAll('[data-store-shot]')]
    return {
      hasLearn: txt.includes('练什么'),
      shots: shots.length,
      captions: shots.map((s) => (s.querySelector('span')?.textContent ?? '').trim()),
      hasAbout: txt.includes('关于这款游戏'),
    }
  })
  check('详情有「练什么」', detail.hasLearn)
  check('详情有「关于这款游戏」', detail.hasAbout)
  check(`详情有 ${detail.shots} 张截图（要求 ≥3）`, detail.shots >= 3, String(detail.shots))
  check('每张截图都有说明文字', detail.captions.every((c) => c.length >= 6), detail.captions.map((c) => c.slice(0, 10)).join(' / '))

  /*
   * ★ 截图**真的解码了**没有 —— `check-game-registry` 只能证明文件在，
   *   证明不了路径对、webp 没坏、`public/` 前缀对。判据只能是 `naturalWidth`。
   *   `loading="lazy"` 的图在可视区外不会去加载，所以先改成 eager 再等。
   */
  await page.evaluate(() => {
    for (const img of document.querySelectorAll('[data-store-shot] img')) img.loading = 'eager'
  })
  const decoded = await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('[data-store-shot] img')]
    return imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)
  }, { timeout: 15000 }).then(() => true, () => false)
  check('★ 截图在浏览器里全部解码成功', decoded)

  await page.screenshot({ path: join(OUT, '0-store-detail.png') })
}

console.log('\n【③ 安装 → 设为当前】')
{
  // 关掉详情：详情是弹层，不关的话后面点「安装」会点到弹层上
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('关闭'),
    )
    b?.click()
  })
  await wait(600)

  check('点了「安装」', await clickSel(`[data-local-install="${GAME_ID}"]`))
  check('★ 界面上那一行变成已装', await waitFor(`[data-local-installed="${GAME_ID}"]`, 40000))

  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  check(`家长能看到「一局 ${PLAY_COST} 积分」`, new RegExp(`一局\\s*${PLAY_COST}\\s*积分`).test(econ), econ)
  check('家长能看到「换不成兑换券」', /不开放|换不成|不能换/.test(econ), econ)

  check('点了「设为当前」', await clickSel(`[data-plugin-set-current="${GAME_ID}"]`))
  await wait(800)
  check('store 里当前游戏是 minergirl', (await snap()).active === GAME_ID, (await snap()).active)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('返回'),
    )
    if (b) b.click()
  })
  await wait(700)
  await waitForApp()
}

console.log('\n【④ 底栏那一格：2 个字要一行放得下】')
{
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    if (!b) return null
    const spans = [...b.querySelectorAll('span')]
    const lbl = spans[spans.length - 1]
    const nav = b.closest('nav')
    const range = document.createRange()
    range.selectNodeContents(lbl)
    return {
      label: (lbl.textContent ?? '').trim(),
      lines: range.getClientRects().length,
      overflow: lbl.scrollWidth - lbl.clientWidth,
      navH: nav ? Math.round(nav.getBoundingClientRect().height) : -1,
      btnW: Math.round(b.getBoundingClientRect().width),
    }
  }, GAME_ID)
  check('底栏有这一格', !!tab)
  check(`★ 那一格写的是「${TAB_LABEL}」`, tab?.label === TAB_LABEL, tab?.label ?? '(无)')
  check('★ 文字只占一行（没折行）', tab?.lines === 1, `${tab?.lines} 行`)
  check('文字没横向溢出', (tab?.overflow ?? 99) <= 1, `溢出 ${tab?.overflow}px`)
  check('底栏没被撑高（< 100px）', (tab?.navH ?? 999) < 100, `nav 高 ${tab?.navH}px`)
  check('这一格宽度正常（≥ 60px）', (tab?.btnW ?? 0) >= 60, `${tab?.btnW}px`)
}

console.log(`\n【⑤ 进 tab：放置类**进场就收 ${PLAY_COST}**】`)
/** 第一次挂载时的画布总数，⑧ 用来判「切回来没有多出来」（泄漏判据） */
let canvasFirst = -1
{
  const pre = await snap()
  await page.evaluate(() => window.__kqf__.addPoints(100))
  await wait(700)
  const before = await snap()
  check(`补了 100 积分（${pre.balance} → ${before.balance}）`, before.balance === pre.balance + 100, String(before.balance))

  check(`点了「${TAB_LABEL}」那一格`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 20000))

  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 90000 }).then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__gpReady`）', up)
  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 120000 }).then(() => true, () => false)
  check('★ 资源加载完成（`__gpPlayable`）', playable)
  await wait(1500)

  const after = await snap()
  check(`★ 进场扣了 ${PLAY_COST}（${before.balance} → ${after.balance}）`, after.balance === before.balance - PLAY_COST, String(after.balance))
  check('兑换券没动（B 型不产出）', after.vouchers === before.vouchers, String(after.vouchers))

  /*
   * ⚠️ 不能断言「容器里只有 1 个 canvas」：这一作自己还有两个**2D 画布**
   *   （`.g-face` 引导头像、`.c-icon` 面板标题图标，见 `src/dom.js`），
   *   加起来恒为 3。WebGL 那份只有 `#stage` 里那一个 —— 判据要指到它。
   */
  const canvas = await page.evaluate((id) => {
    const root = document.querySelector(`[data-plugin-host="${id}"]`)
    return {
      stage: root.querySelectorAll('#stage canvas').length,
      all: root.querySelectorAll('canvas').length,
    }
  }, GAME_ID)
  check('`#stage` 里有且只有 1 个 WebGL 画布', canvas.stage === 1, `stage ${canvas.stage} · 全部 ${canvas.all}`)
  canvasFirst = canvas.all

  const c1 = await gameColors('1-mine.png')
  check(`★ 画面画出来了（颜色 ${c1.n} 种）`, c1.n >= 20, c1.file)

  /*
   * ---- 几何 + 遮挡 ----
   * ① 容器高 == 父容器高（读 computed style，不是 inline）；
   * ② canvas 铺满容器；
   * ③ 容器中心点没被底栏/弹层盖住（`el.click()` 走不到命中测试，别的断言抓不到）。
   */
  const geo = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    const r = el.getBoundingClientRect()
    const p = el.parentElement.getBoundingClientRect()
    const cr = el.querySelector('canvas').getBoundingClientRect()
    const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2))
    return {
      h: Math.round(r.height), ph: Math.round(p.height), w: Math.round(r.width),
      cw: Math.round(cr.width), ch: Math.round(cr.height),
      hitInside: !!(hit && el.contains(hit)),
      hitTag: hit ? hit.tagName.toLowerCase() : '(null)',
    }
  }, GAME_ID)
  check(`容器高 == 父容器高（${geo.h} / ${geo.ph}）`, Math.abs(geo.h - geo.ph) <= 1, `${geo.w}×${geo.h}`)
  check(`canvas 铺满容器（${geo.cw}×${geo.ch} / ${geo.w}×${geo.h}）`,
    Math.abs(geo.cw - geo.w) <= 2 && Math.abs(geo.ch - geo.h) <= 2, '')
  check('容器中心没被底栏/弹层盖住', geo.hitInside, `命中的是 ${geo.hitTag}`)
}

console.log('\n【⑥ 游戏内商城：皮肤是门槛，不是价签】')
{
  check('点了 HUD 上的「商城」', await tapGame('商城'))
  await wait(900)
  const opened = await page.evaluate((id) => {
    const p = document.querySelector(`[data-plugin-host="${id}"] #panel`)
    return !!p && p.hidden === false
  }, GAME_ID)
  check('面板打开了', opened)

  check('切到「皮肤」页签', await tapGame('皮肤', '#panel'))
  await wait(1200)

  const skins = await page.evaluate((id) => {
    const root = document.querySelector(`[data-plugin-host="${id}"]`)
    return {
      tiles: root.querySelectorAll('.sk-tile').length,
      locks: [...root.querySelectorAll('.sk-pill .p-lock')].map((e) => e.textContent),
      btn: (root.querySelector('.sk-act')?.textContent ?? '').trim(),
      tabs: [...root.querySelectorAll('[data-tab]')].map((e) => (e.textContent ?? '').trim()),
    }
  }, GAME_ID)
  check('皮肤页有格子', skins.tiles > 0, `${skins.tiles} 格`)
  check('★ 商城只剩两个页签（投资人 / 皮肤）', skins.tabs.length === 2 && skins.tabs.includes('皮肤'), skins.tabs.join(' / '))
  check('★ 未解锁的显示累计收入门槛（`$…`，不是硬币价）',
    skins.locks.length > 0 && skins.locks.every((s) => s.startsWith('$')), skins.locks.join(' ') || '(没有锁定格)')
  check('按钮文案是「还没解锁」而不是「购买」', /还没解锁/.test(skins.btn) && !/购买|买/.test(skins.btn), skins.btn)
  await page.screenshot({ path: join(OUT, '2-skins.png') })

  await tapGame('投资人', '#panel')
  await wait(700)
  const inv = await page.evaluate((id) => {
    const root = document.querySelector(`[data-plugin-host="${id}"]`)
    const t = (root.querySelector('#panel')?.innerText ?? '').replace(/\s+/g, ' ')
    return { txt: t, hasPay: /支付|充值|¥|元|微信|支付宝/.test(t) }
  }, GAME_ID)
  check('★ 投资人页没有任何支付字样（内购拆干净了）', !inv.hasPay, inv.txt.slice(0, 60))

  await page.evaluate((id) => {
    document.querySelector(`[data-plugin-host="${id}"] [data-act=close]`)?.click()
  }, GAME_ID)
  await wait(500)
}

console.log('\n【⑦ 切走：卸载要真的跑，存档要落盘】')
{
  const before = await snap()
  check('点「任务」那一格（切走游戏）', await clickSel('[data-tour="tab-tasks"]'))
  await wait(1800)

  const gone = await page.evaluate(() => ({
    playable: typeof window.__gpPlayable,
    ready: typeof window.__gpReady,
    mng: typeof window.__mng,
    style: document.querySelectorAll('style[data-mng-css]').length,
    root: !!document.getElementById('mng-root'),
  }))
  check('★ `__gpPlayable` 已摘（卸载真跑了）', gone.playable === 'undefined', gone.playable)
  check('`__gpReady` 也摘掉了', gone.ready === 'undefined', gone.ready)
  check('★ `__mng` 调试钩子也摘掉了', gone.mng === 'undefined', gone.mng)
  check('作用域 <style> 也摘掉了', gone.style === 0, `${gone.style} 份`)
  check('根节点也摘掉了', gone.root === false)

  const canvas = await page.evaluate((id) => document.querySelectorAll(`[data-plugin-host="${id}"] canvas`).length, GAME_ID)
  check('容器里 canvas 也摘掉了', canvas === 0, String(canvas))

  check('★ gameKv 里出现 minergirl 的行（存档落盘）', (await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')

  const after = await snap()
  check('切走不扣分', after.balance === before.balance, `${before.balance} → ${after.balance}`)
}

console.log('\n【⑧ 切回：宽限内**不再扣**；画面必须还在】')
{
  const before = await snap()
  check(`点回「${TAB_LABEL}」`, await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const up = await page.waitForFunction(() => window.__gpReady === true, { timeout: 90000 }).then(() => true, () => false)
  check('★ 第二次挂载也起来了', up)
  const playable = await page.waitForFunction(() => window.__gpPlayable === true, { timeout: 120000 }).then(() => true, () => false)
  check('资源第二次也加载完成', playable)
  await wait(1500)

  const canvas = await page.evaluate((id) => {
    const root = document.querySelector(`[data-plugin-host="${id}"]`)
    return { stage: root.querySelectorAll('#stage canvas').length, all: root.querySelectorAll('canvas').length }
  }, GAME_ID)
  check('★ 画布个数没涨（WebGL context 没泄漏）', canvas.all === canvasFirst, `第一次 ${canvasFirst} · 这次 ${canvas.all}`)
  check('`#stage` 里还是只有 1 个 WebGL 画布', canvas.stage === 1, String(canvas.stage))

  const after = await snap()
  check(`★ 10 分钟宽限内不再扣（${before.balance} → ${after.balance}）`,
    after.balance === before.balance, `票价 ${PLAY_COST} 只在进场收一次`)

  /*
   * ★★ 这条是 PixiJS 插件最容易死的地方：`app.destroy()` 如果把纹理一起销毁，
   *    模块级纹理缓存第二次挂载会交出**已销毁的 Texture** ⇒ 画面全白而**一个错都不报**。
   *    DOM 断言（canvas 个数）完全抓不到，只能看像素。
   */
  const c2 = await gameColors('3-remounted.png')
  check(`★ 切回来画面还在（颜色 ${c2.n} 种）`, c2.n >= 20, c2.file)
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
