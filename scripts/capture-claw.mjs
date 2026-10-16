/**
 * 娃娃机走查。
 *
 * 用法：node scripts/capture-claw.mjs [url] [outDir] [viewportNames]
 *   例：node scripts/capture-claw.mjs http://127.0.0.1:4391/ .e2e-scratch/claw phone
 *
 * 为什么单独一份：娃娃机是**第一块画在 WebGL 画布上的界面**，而
 * `e2e-check.mjs` / `capture-games.mjs` 全都在 DOM 上找东西 ——
 * 画布在 DOM 里只有一个 `<canvas>` 元素，里面画了什么它们一个字也看不见。
 * 和 `capture-sky.mjs` / `capture-animals.mjs` / `capture-horizon-decor.mjs`
 * 是同一类补盲区脚本。
 *
 * ------------------------------------------------------------
 * ★★ 这一份最重要的判据：**柜子完整在容器里**（contain 取景）
 *
 * 同一款游戏要在 390px 和 1280px 下都看得见，所以取景是 `contain` 而不是
 * `cover`。`contain` 对不对，肉眼**看不出来** —— 裁掉的那一截正好是深色底座，
 * 截图上像「本来就该这样」。
 * 2026-10-16 实测过这个坑：390×844 下画布高 554，而柜子底边投影在 **614.7**
 * —— 底部被切掉 60px，没有任何报错、截图也看不出。
 * ➜ 判据是 `stage.debugFrame()`：把柜子的 8 个角**投影到画布坐标**，
 *   四边必须都落在画布里。这是可断言的数字，不是「看着还行」。
 *
 * ★★ 第二条：「画面不是空白」要配**对照组**
 *
 * WebGL 画布是**一个元素**，`elementFromPoint` 只能回答「它有没有被盖住」，
 * 回答不了「里面有没有画东西」。所以：
 *   · 对照组 A：正常截图 / 把 canvas `display:none` 再截一次
 *     —— 有内容的 PNG 必须**明显大于**空白的那张（空白是一整块纯色，压缩率极高）。
 *   · 对照组 B：盖一层全屏遮罩 → `elementFromPoint` 不再是 canvas → 拿掉 → 变回来。
 *     防「探针坏了」（坏掉和没被盖住长得一样）。
 *
 * ★ 视口覆盖：**取景**（几何）在 5 档全跑 —— 那正是会随宽高比变的东西。
 *   **交互流程**（买币 / 下爪 / 中奖）只在 phone 与 tablet 两档跑：
 *   它跟宽高比无关，而每局要等 2.2 秒动画，5 档跑一遍纯属浪费。
 *   ⚠️ 这是**有意的取舍**，不是漏测：几何那部分才是会随档位坏的地方。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, statSync } from 'node:fs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4391/'
const OUT = process.argv[3] ?? '.e2e-scratch/claw'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

/** 一局的动画时长（`clawTimeline.ts` 的 `CLAW_TOTAL`）≈ 4.2s，留足余量 */
const ROUND_MS = 5200

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, flow: true },
  { name: 'phone-landscape', width: 844, height: 390, flow: false },
  { name: 'tablet', width: 834, height: 1112, flow: true },
  { name: 'tablet-landscape', width: 1112, height: 834, flow: false },
  { name: 'desktop', width: 1280, height: 800, flow: false },
]

const ONLY = (process.argv[4] ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const SELECTED = ONLY.length ? VIEWPORTS.filter((v) => ONLY.includes(v.name)) : VIEWPORTS
if (!SELECTED.length) {
  console.error(`没有匹配的视口：${ONLY.join(',')}`)
  process.exit(2)
}

/** 截图字节数 —— 用来看「画布里有东西没有」（理由见文件头） */
async function shotSize(page, clip) {
  const buf = await page.screenshot({ clip, encoding: 'binary' })
  return buf.length
}

for (const vp of SELECTED) {
  console.log(`\n══ ${vp.name} ${vp.width}×${vp.height}${vp.flow ? '（含交互流程）' : '（只量几何）'} ══`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`claw-${vp.name}`),
    // `--enable-unsafe-swiftshader`：没有独显 / 驱动不给力时让 Chrome 回落到软件渲染，
    // 否则 `WebGLRenderer` 构造会抛，页面显示「打不开 3D 画面」那一支。
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await dismissOnboarding(page)
  await page.waitForFunction(() => !!window.__kqf__, { timeout: 10000 })

  /* ---- ① 家长那条路：发商城币 → 买娃娃机 → 设为当前 ----
     ⚠️ 每一步都要硬断言。少一步的话后面「切过去看见白屏」会让人以为是渲染坏了，
     而真因是游戏压根没买成。 */
  const path = await page.evaluate(async () => {
    const k = window.__kqf__
    const price = (k.games() ?? []).find((g) => g.id === 'claw')?.priceMall ?? 0
    const mint = await k.getState().mintMall(price + 50)
    const buy = await k.getState().buyGame('claw')
    await k.getState().setActiveGame('claw')
    const s = k.getState()
    return { price, mint, buy, owned: s.ownedGameIds, active: s.activeGameId, mall: s.mallBalance }
  })
  check('家长能手动发商城币', path.mint.ok, path.mint.message)
  check(`家长买得下娃娃机（价 ${path.price}）`, path.buy.ok, path.buy.message)
  check('娃娃机进了「已购买」', path.owned.includes('claw'), path.owned.join(','))
  check('娃娃机是「当前」', path.active === 'claw', path.active)

  /* ---- ② 切到游戏那一格，等懒加载的 chunk ----
     娃娃机是 `React.lazy`（three.js 走独立 chunk），所以这里要等得久一点。 */
  const tabFound = await page.evaluate(() => {
    const b = document.querySelector('[data-tour="tab-claw"]')
    if (!b) return false
    b.click()
    return true
  })
  check('底部导航上出现了娃娃机那一格（`data-tour="tab-claw"`）', tabFound)

  const stageOk = await page
    .waitForFunction(() => !!document.querySelector('[data-claw-stage]'), { timeout: 25000 })
    .then(() => true, () => false)
  check('娃娃机页面挂起来了（懒加载 chunk 到位）', stageOk)
  if (!stageOk) {
    const fallback = await page.evaluate(() => document.body.innerText.includes('打不开 3D 画面'))
    check('★ 不是「打不开 3D 画面」那一支', !fallback, fallback ? 'WebGL 起不来' : '')
    await browser.close()
    continue
  }
  await wait(900)

  const stageGlobal = await page.evaluate(() => !!window.__kqfClawStage)
  check('场景对象建起来了（`__kqfClawStage`）', stageGlobal)

  /* ================= 几何：柜子完整在容器里 ================= */

  const geo = await page.evaluate(() => {
    const el = document.querySelector('[data-claw-stage]')
    const st = window.__kqfClawStage
    if (!el || !st) return null
    const r = el.getBoundingClientRect()
    const f = st.debugFrame()
    // 找第一个「真的会裁内容」的祖先（和 ⑥ 那条同款判据）
    let cut = null
    for (let n = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') {
        cut = { tag: n.tagName, scrollH: n.scrollHeight, clientH: n.clientHeight }
        break
      }
    }
    return {
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      frame: f,
      prizes: st.prizeCount(),
      canvasInDom: !!el.querySelector('canvas'),
      cut,
    }
  })
  if (!geo) {
    check('★ 量得到几何（`debugFrame()` 可用）', false, '拿不到 [data-claw-stage] 或场景对象')
    await browser.close()
    continue
  }

  check('画布里有一只以上的娃娃（池子不是空的）', geo.prizes > 0, `${geo.prizes} 只`)
  check('canvas 真的在容器里', geo.canvasInDom)

  const { cabinet: cb, canvas: cv } = geo.frame
  const inside =
    cb.left >= 0 && cb.top >= 0 && cb.right <= cv.w && cb.bottom <= cv.h
  check(
    '★★ 柜子**完整**在容器里（`contain` 取景的核心判据）',
    inside,
    `柜子 ${cb.left.toFixed(1)},${cb.top.toFixed(1)} → ${cb.right.toFixed(1)},${cb.bottom.toFixed(1)} / 画布 ${cv.w}×${cv.h}`,
  )
  // 四边各自的余量 —— 单看「在里面」会漏掉「有一边只剩 0.4px」这种
  const margins = {
    left: cb.left,
    top: cb.top,
    right: cv.w - cb.right,
    bottom: cv.h - cb.bottom,
  }
  const minMargin = Math.min(...Object.values(margins))
  check(
    '★ 四边都有余量（不是贴着边，浮点一动就又会越界）',
    minMargin >= 2,
    Object.entries(margins)
      .map(([k, v]) => `${k}=${v.toFixed(1)}`)
      .join(' '),
  )
  // 也不能缩成一小坨 —— 那说明取景「过度保守」，柜子小得看不清
  const fill = Math.max((cb.right - cb.left) / cv.w, (cb.bottom - cb.top) / cv.h)
  check(
    '★ 柜子占满了限制方向（不是缩成一小坨）',
    fill >= 0.7,
    `占 ${(fill * 100).toFixed(0)}%`,
  )
  check(
    '容器没有被裁掉内容（`overflow` 祖先的 `scrollHeight === clientHeight`）',
    !geo.cut || geo.cut.scrollH <= geo.cut.clientH + 1,
    geo.cut ? `${geo.cut.tag}: ${geo.cut.scrollH} vs ${geo.cut.clientH}` : '没有裁剪祖先',
  )

  /* ================= 画面不是空白（对照组 A） ================= */

  const clip = await page.evaluate(() => {
    const el = document.querySelector('[data-claw-stage]')
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  const withCanvas = await shotSize(page, clip)
  // 对照组：把 canvas 藏起来 —— 剩下的是容器那层纯色背景（`#e9e6f2`）
  await page.evaluate(() => {
    const c = document.querySelector('[data-claw-stage] canvas')
    if (c) c.style.visibility = 'hidden'
  })
  await wait(250)
  const blank = await shotSize(page, clip)
  await page.evaluate(() => {
    const c = document.querySelector('[data-claw-stage] canvas')
    if (c) c.style.visibility = ''
  })
  await wait(250)
  check(
    '★★ 画布里有画面（比「藏起 canvas 的纯色背景」明显大）',
    withCanvas > blank * 1.5,
    `有画面 ${withCanvas}B / 空白 ${blank}B（×${(withCanvas / blank).toFixed(2)}）`,
  )

  /* ================= 画布没被遮住（对照组 B：探针自检） ================= */

  const probe = async () => {
    return page.evaluate(() => {
      const el = document.querySelector('[data-claw-stage]')
      const c = el?.querySelector('canvas')
      if (!c) return { at: 'no-canvas' }
      const r = c.getBoundingClientRect()
      const hit = document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2))
      return { at: hit?.tagName ?? 'null', isCanvas: hit === c }
    })
  }
  const p0 = await probe()
  check('★ 画布中心没被别的元素盖住', p0.isCanvas, `命中的是 ${p0.at}`)

  // 探针自检：临时盖一层 → 必须掉；拿掉 → 必须回来
  await page.evaluate(() => {
    const o = document.createElement('div')
    o.id = 'claw-probe-mask'
    o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.01)'
    document.body.appendChild(o)
  })
  const pMasked = await probe()
  await page.evaluate(() => document.getElementById('claw-probe-mask')?.remove())
  const pBack = await probe()
  check(
    '★ 探针自检：盖上遮罩 → 命中变了；拿掉 → 又命中画布',
    !pMasked.isCanvas && pBack.isCanvas,
    `盖住时命中 ${pMasked.at}，拿掉后 ${pBack.isCanvas ? '回到画布' : '还是 ' + pBack.at}`,
  )

  /* ================= 交互流程（只在 phone / tablet 跑） ================= */

  if (vp.flow) {
    /* ---- 币流程：买一个币 → 下爪 ---- */
    const before = await page.evaluate(() => {
      const s = window.__kqf__.getState()
      return { coins: s.clawCoins, plays: s.clawPlays, points: s.balance }
    })
    check('新档还没有币', before.coins === 0, `coins=${before.coins}`)

    // 真点击（走命中测试）—— 顺带证明按钮没被盖住 / 没跑到视口外
    await page.click('[data-claw-buy]')
    await wait(500)
    const afterBuy = await page.evaluate(() => {
      const s = window.__kqf__.getState()
      return { coins: s.clawCoins, points: s.balance }
    })
    check('买一个币：币 +1', afterBuy.coins === before.coins + 1, `coins=${afterBuy.coins}`)
    check('买一个币：积分 −1', afterBuy.points === before.points - 1, `积分 ${before.points} → ${afterBuy.points}`)

    await page.click('[data-claw-drop]')
    await wait(ROUND_MS)
    const afterRound = await page.evaluate(() => {
      const s = window.__kqf__.getState()
      return {
        coins: s.clawCoins,
        plays: s.clawPlays,
        result: document.querySelector('[data-claw-result]')?.innerText ?? '',
      }
    })
    check('下爪一局：币 −1（投进去了）', afterRound.coins === afterBuy.coins - 1, `coins=${afterRound.coins}`)
    check('下爪一局：局数 +1', afterRound.plays === before.plays + 1, `plays=${afterRound.plays}`)
    check('一局结束有结果文案', afterRound.result.trim().length > 0, `「${afterRound.result.trim()}」`)

    /* ---- ★ 中一局真的发点券 ----
       结果由局数算出来（幂等伪随机），所以脚本**先问**「第几局会中」，
       再精确走到那一局 —— 不是「多试几次直到中」。 */
    const win = await page.evaluate(async () => {
      const k = window.__kqf__
      // 中奖率设成 1/2、每只换 1 点券（期望 0.5，安全），赢面大、等得短
      await k.getState().updateSettings({ clawWinRate: 0.5, clawExchangePerPrize: 1 })
      const s0 = k.getState()
      const idx = k.claw.findRound(s0.clawPlays, true, 0.5, 1)
      if (idx < 0) return { idx }
      const need = idx - s0.clawPlays + 1
      // 买币要花积分，先确认够（`addPoints` 走账本，和农场赚分同一个口）
      if (k.getState().balance < need + 2) await k.addPoints(need + 10)
      for (let i = 0; i < need; i++) await k.getState().buyClawCoin()
      return { idx, need, couponsBefore: k.getState().harvestBalance }
    })
    check('★ 算得出「第几局会中」（走的是结算用的同一个函数）', win.idx >= 0, `第 ${win.idx} 局`)

    for (let i = 0; i < win.need; i++) {
      await page.click('[data-claw-drop]')
      await wait(ROUND_MS)
    }
    const afterWin = await page.evaluate(() => {
      const s = window.__kqf__.getState()
      return {
        coupons: s.harvestBalance,
        plays: s.clawPlays,
        result: document.querySelector('[data-claw-result]')?.innerText ?? '',
        won: document.querySelector('[data-claw-result]')?.getAttribute('data-claw-won'),
      }
    })
    check(
      '★★ 中了那一局：点券 +1（每只换 1 点券）',
      afterWin.coupons === win.couponsBefore + 1,
      `点券 ${win.couponsBefore} → ${afterWin.coupons}`,
    )
    check(
      '★ 结果文案是「抓到了！」',
      afterWin.result.includes('抓到了'),
      `「${afterWin.result.trim()}」（data-claw-won=${afterWin.won}）`,
    )

    /* ---- ★ 切走再切回：不许双跑 ---- */
    const snapA = await page.evaluate(() => {
      const s = window.__kqf__.getState()
      return { coins: s.clawCoins, plays: s.clawPlays, coupons: s.harvestBalance }
    })
    await page.evaluate(() => document.querySelector('[data-tour="tab-tasks"]')?.click())
    await wait(700)
    await page.evaluate(() => document.querySelector('[data-tour="tab-claw"]')?.click())
    await page.waitForFunction(() => !!document.querySelector('[data-claw-stage]'), { timeout: 15000 })
    // 等足够久 —— 如果卸载时忘了 `cancelAnimationFrame` / 忘了 dispose，
    // 旧循环会继续跑，而它跑一帧就可能把上一局又结算一次
    await wait(ROUND_MS)
    const snapB = await page.evaluate(() => {
      const s = window.__kqf__.getState()
      return { coins: s.clawCoins, plays: s.clawPlays, coupons: s.harvestBalance }
    })
    check(
      '★ 切走再切回：币 / 局数 / 点券都没动（没有双跑、没有重复结算）',
      snapA.coins === snapB.coins && snapA.plays === snapB.plays && snapA.coupons === snapB.coupons,
      `${JSON.stringify(snapA)} → ${JSON.stringify(snapB)}`,
    )
    check('切回来之后场景还在', await page.evaluate(() => !!window.__kqfClawStage))

    /* ---- 家长栏：娃娃机的参数 ---- */
    await page.evaluate(() => document.querySelector('[data-tour="header-settings"]')?.click())
    await page.waitForFunction(
      () => [...document.querySelectorAll('h1')].some((h) => (h.textContent ?? '').includes('设置')),
      { timeout: 8000 },
    )
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => (x.textContent ?? '').trim() === '🎮 游戏',
      )
      b?.click()
    })
    // 家长密码：默认 0000，第 4 位自动提交
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(
          (x) => (x.textContent ?? '').trim() === '0',
        )
        b?.click()
      })
      await wait(200)
    }
    const settings = await page.evaluate(() => {
      const expected = document.querySelector('[data-claw-expected]')?.innerText ?? ''
      const opts = [...document.querySelectorAll('[data-claw-exchange-option]')].map((b) => ({
        v: Number(b.getAttribute('data-claw-exchange-option')),
        disabled: b.hasAttribute('disabled'),
      }))
      return { hasCard: !!document.querySelector('[data-claw-winrate]'), expected, opts }
    })
    check('★ 家长栏里有「娃娃机」参数（买了才显示）', settings.hasCard)
    // 刚才设成 1/2 × 1 = 0.50
    check(
      '★ 期望值是**算出来的**：1/2 × 1 = 0.50 写在卡片上',
      settings.expected.includes('0.50'),
      `「${settings.expected.trim()}」`,
    )
    /*
      ★ 不安全档位按不动。

      中奖率 1/2 时：×1 = 0.50 ✓；×2 = 1.00 ✗；×3 ✗；×5 ✗。
      （1.00 已经**等于** 1 了 —— 那正是那条不变量的悬崖，必须拦住。）
    */
    const ex = Object.fromEntries(settings.opts.map((o) => [o.v, o.disabled]))
    check(
      '★★ 中奖率 1/2 时，只有「每只换 1」能选，2 / 3 / 5 都按不动',
      ex[1] === false && ex[2] === true && ex[3] === true && ex[5] === true,
      JSON.stringify(ex),
    )
    check('没有出现「不安全组合」的告警（正常操作走不到那一支）', !(await page.$('[data-claw-problem]')))

    await page.screenshot({ path: `${OUT}/${vp.name}-3-家长栏娃娃机.png`, fullPage: true })
    console.log(`  · 已存图 ${OUT}/${vp.name}-3-家长栏娃娃机.png`)
    // 回到游戏页，好把柜子截进图里
    await page.evaluate(() => document.querySelector('[aria-label="返回"]')?.click())
    await wait(500)
    await page.evaluate(() => document.querySelector('[data-tour="tab-claw"]')?.click())
    await page.waitForFunction(() => !!document.querySelector('[data-claw-stage]'), { timeout: 15000 })
    await wait(800)
  }

  const shot = `${OUT}/${vp.name}-1-娃娃机.png`
  await page.screenshot({ path: shot })
  console.log(`  · 已存图 ${shot}（${statSync(shot).size}B）`)

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
