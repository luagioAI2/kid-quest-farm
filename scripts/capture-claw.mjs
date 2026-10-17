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
 * ★★ 这一份最重要的判据：**玻璃区完整、且铺满限制方向**
 *
 * ⚠️ 2026-10-17 这条判据**换过一次**，别照抄旧结论：
 *    · 旧判据 = 「整台机器（`cabinet`）完整在画布内」。那是**远距离全柜取景**，
 *      和原版差很多 —— 原版是**站在机器前面**看，底座是被裁掉的。
 *    · 新判据 = 「**玻璃区**（`glass`）完整在画布内」+「铺满限制方向」。
 *      `cabinet` 现在**故意**溢出画布，所以它不再是判据。
 *    换判据时如果只改数字不改断言，脚本会继续「通过」，而画面已经变成另一个样子。
 *
 * 为什么仍然必须量数字：取景对不对，肉眼**看不出来** —— 多裁 30px 的玻璃边
 * 和「本来就该这样」在截图上没有区别。判据是 `stage.debugFrame()`：
 * 把三组矩形（玻璃 / 取景框 / 整柜）的角**投影到画布坐标**，各自给数字。
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
 *   它跟宽高比无关，而每局要等 4.5 秒动画，5 档跑一遍纯属浪费。
 *   ⚠️ 这是**有意的取舍**，不是漏测：几何那部分才是会随档位坏的地方。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'

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

/* ---- 时段表从源码派生（**绝不写死**） ----
   写死秒数的话，改了节奏脚本不会响 —— 它只会「截图总是截在错的时刻」，
   而错时刻的截图看起来只是「这一帧不好看」，不像 bug。 */
const TIMELINE_SRC = readFileSync(
  new URL('../src/features/claw/clawTimeline.ts', import.meta.url),
  'utf8',
)
const SPANS = [...TIMELINE_SRC.matchAll(/phase:[ ]*'([a-z]+)',[ ]*seconds:[ ]*([0-9.]+)/g)].map(
  (m) => ({ phase: m[1], seconds: Number(m[2]) }),
)
if (SPANS.length < 3) {
  console.error(`✗ 没能从 clawTimeline.ts 解析出时段表（拿到 ${SPANS.length} 段）—— 正则过期了`)
  process.exit(2)
}
/**
 * 一局总秒数（`CLAW_TOTAL`）。
 *
 * ⚠️ 只用来算「等这一局演完要多久」。**不要**拿它去推算「第几秒该采样哪一帧」——
 * 动画的起点比 click 晚 0.3~0.5 秒（投币要走一次 IndexedDB 事务），
 * 按墙钟采样会系统性偏早。挑帧请看 `pickFrames()`，判据是**状态**不是时刻。
 */
let TOTAL = 0
for (const s of SPANS) TOTAL += s.seconds
/** 一局的动画时长（`CLAW_TOTAL`）+ 余量。★ 派生出来的，不是 5200 */
const ROUND_MS = Math.ceil(TOTAL * 1000) + 800
console.log(`· 时段表：${SPANS.map((s) => `${s.phase} ${s.seconds}s`).join(' / ')}（共 ${TOTAL.toFixed(2)}s）`)

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
  /*
    ⚠️ 这几行进度日志不是装饰：`makeProfileDir()` 会顺手扫掉上次遗留的 Chrome
    profile（见 `scripts/lib/profile.mjs`），攒多了能删上几分钟。
    没有这些行的话，卡在这一步看起来和「卡在页面加载」一模一样 —— 零输出。
  */
  console.log('  · 清理 profile + 启动浏览器…')
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`claw-${vp.name}`),
    // `--enable-unsafe-swiftshader`：没有独显 / 驱动不给力时让 Chrome 回落到软件渲染，
    // 否则 `WebGLRenderer` 构造会抛，页面显示「打不开 3D 画面」那一支。
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
  })
  console.log('  · 浏览器起来了')
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
  console.log('  · 应用起来了')

  /* ---- ① 家长那条路：发钻石 → 买娃娃机 → 设为当前 ----
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
  check('家长能手动发钻石', path.mint.ok, path.mint.message)
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

  const { glass: gl, frame: fr, cabinet: cb, canvas: cv } = geo.frame

  /*
    ★★ 核心判据：**玻璃区完整在画布内**。

    ⚠️ 判的是 `glass` 不是 `cabinet`：现在取景是「站在机器前面」，
       底座**故意**被裁掉（原版就是这样）。判 `cabinet` 会要求把整柜缩进画面，
       而那正是之前「视角没感觉」的原因 —— 两条判据互相排斥，只能留一条。
  */
  const glassInside =
    gl.left >= 0 && gl.top >= 0 && gl.right <= cv.w && gl.bottom <= cv.h
  check(
    '★★ 玻璃区**完整**在画布内（一条边都没被裁）',
    glassInside,
    `玻璃 ${gl.left.toFixed(1)},${gl.top.toFixed(1)} → ${gl.right.toFixed(1)},${gl.bottom.toFixed(1)} / 画布 ${cv.w}×${cv.h}`,
  )

  // 四边各自的余量 —— 单看「在里面」会漏掉「有一边只剩 0.4px」这种
  const gm = {
    left: gl.left,
    top: gl.top,
    right: cv.w - gl.right,
    bottom: cv.h - gl.bottom,
  }
  check(
    '★ 玻璃区四边都有余量（不是贴着边，浮点一动就又会越界）',
    Math.min(...Object.values(gm)) >= 2,
    Object.entries(gm)
      .map(([k, v]) => `${k}=${v.toFixed(1)}`)
      .join(' '),
  )

  /*
    取景框（`FRAME`：玻璃 + 一圈柜身）必须完整可见 —— 它是相机实际去 fit 的那个盒子。
    它越界就说明「fit 迭代没收敛」，而不是「设计上允许裁」。
  */
  const frameInside = fr.left >= 0 && fr.top >= 0 && fr.right <= cv.w && fr.bottom <= cv.h
  check(
    '★★ 取景框完整可见（相机真的把它 fit 进去了）',
    frameInside,
    `框 ${fr.left.toFixed(1)},${fr.top.toFixed(1)} → ${fr.right.toFixed(1)},${fr.bottom.toFixed(1)}`,
  )

  /*
    「不是缩成一小坨」：玻璃区必须**铺满限制方向**。
    竖屏限制方向是宽（玻璃横向铺满），横屏/桌面限制方向是高。
    用 max 而不是只看宽 —— 只看宽的话，桌面档（宽屏）会误判。
  */
  const fillW = (gl.right - gl.left) / cv.w
  const fillH = (gl.bottom - gl.top) / cv.h
  check(
    '★★ 玻璃区铺满了限制方向（不是缩成一小坨）',
    Math.max(fillW, fillH) >= 0.8,
    `宽 ${(fillW * 100).toFixed(0)}% / 高 ${(fillH * 100).toFixed(0)}%`,
  )

  // 反向证据：整柜**应当**溢出 —— 没溢出说明又退回「远距离全柜取景」了
  const cabOverflow = cb.top < 0 || cb.bottom > cv.h || cb.left < 0 || cb.right > cv.w
  check(
    '★ 整台机器**溢出**画布（近景取景；没溢出 = 又退回了远距离全柜）',
    cabOverflow,
    `整柜 ${cb.left.toFixed(1)},${cb.top.toFixed(1)} → ${cb.right.toFixed(1)},${cb.bottom.toFixed(1)}`,
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

    /* ---- ★ 中一局真的发商城币 ----
       结果由局数算出来（幂等伪随机），所以脚本**先问**「第几局会中」，
       再精确走到那一局 —— 不是「多试几次直到中」。 */
    const win = await page.evaluate(async () => {
      const k = window.__kqf__
      // 中奖率设成 1/2、每只换 1 商城币（期望 0.5，安全），赢面大、等得短
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
      '★★ 中了那一局：商城币 +1（每只换 1 商城币）',
      afterWin.coupons === win.couponsBefore + 1,
      `商城币 ${win.couponsBefore} → ${afterWin.coupons}`,
    )
    check(
      '★ 结果文案是「抓到了！」',
      afterWin.result.includes('抓到了'),
      `「${afterWin.result.trim()}」（data-claw-won=${afterWin.won}）`,
    )

    /* ============================================================
       ★★ 下钩 / 合爪 / 提起 —— **姿势**对不对

       用户的原话是「下钩 抓的过程都差很多」。那句话对应的不是「有没有动画」
       （原来也有），而是三个具体的量：
         ① 下爪时指头有没有**张开**（原来只扫 16°，远看像不动）；
         ② 合爪有没有**合拢**（0.40s 合完，像开关不像机器）；
         ③ 爪子是不是**扎进池子**里合爪（原来停在写死的 0.42，对着空地也在半空合）。

       ------------------------------------------------------------
       ★★ 为什么不用「点一下、等 N 毫秒、再采样」
       ------------------------------------------------------------
       试过，三个断言全红，而**产品是对的**：`[data-claw-drop]` 的 click 本身要
       100~200ms，之后 `settleClawRound()` 还要走一次 IndexedDB 事务才开始动画。
       墙钟从 click 起算 ⇒ 每一帧采样都**系统性偏早约 0.6 秒**，
       于是「合爪」采到的是下爪途中（close=0.17）、「提起」采到的还是合爪（hubY 没动）。

       现在改成**在页面里按帧采样**：rAF 里每帧记一条，最后在 Node 里按
       「close / spread 的形状」挑出那三帧。这样和动画真实起点对齐，
       也不受截图耗时影响。挑帧的判据是**状态**，不是时刻 —— 所以改节奏不会让脚本失效。
       ============================================================ */

    /** 在页面里装一个每帧采样器（记录「真的画出去的那一帧」的姿势） */
    const startSampling = () =>
      page.evaluate(() => {
        const st = window.__kqfClawStage
        const frames = []
        let stop = false
        window.__clawFrames = frames
        window.__clawStop = () => {
          stop = true
        }
        const tick = () => {
          if (stop) return
          const v = st.debugVisual()
          if (v) {
            frames.push({
              hubY: v.hubY,
              close: v.close,
              spread: v.spread,
              prong: st.debugProng(),
              held: v.held,
            })
          }
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      })

    const stopSampling = () =>
      page.evaluate(() => {
        window.__clawStop?.()
        return window.__clawFrames ?? []
      })

    /** 买一个币然后下爪，等这一局演完，返回每帧姿势 */
    const runRound = async () => {
      await page.evaluate(async () => {
        const k = window.__kqf__
        if (k.getState().balance < 2) await k.addPoints(10)
        await k.getState().buyClawCoin()
      })
      await startSampling()
      await page.click('[data-claw-drop]')
      await wait(ROUND_MS)
      return stopSampling()
    }

    /**
     * 从每帧序列里挑出三个关键帧。
     *
     * · `bottom`：最后一个「还没开始合爪」的帧（`close === 0` 且 `spread ≈ 1`）
     *   —— 就是下爪到底那一刻；
     * · `closed`：`bottom` 之后第一个 `close > 0.85` 的帧；
     * · `lifted`：`closed` 之后第一个「已提起 ≥0.2」的帧。
     *
     * ⚠️ 用 `spread ≈ 1` 过滤掉待命帧：待命时 `close` 也是 0，
     *   不滤的话 `bottom` 会挑到开跑前那一帧，hubY 是轨道高度。
     */
    const pickFrames = (frames) => {
      let bottom = -1
      for (let i = frames.length - 1; i >= 0; i--) {
        if (frames[i].close === 0 && frames[i].spread > 0.99) {
          bottom = i
          break
        }
      }
      if (bottom < 0) return { bottom: -1, closed: -1, lifted: -1 }
      let closed = -1
      for (let i = bottom + 1; i < frames.length; i++) {
        if (frames[i].close > 0.85) {
          closed = i
          break
        }
      }
      if (closed < 0) return { bottom, closed: -1, lifted: -1 }
      let lifted = -1
      for (let i = closed + 1; i < frames.length; i++) {
        if (frames[i].close >= 0.99 && frames[i].hubY > frames[closed].hubY + 0.2) {
          lifted = i
          break
        }
      }
      return { bottom, closed, lifted }
    }

    const idlePose = await page.evaluate(() => {
      const v = window.__kqfClawStage?.debugVisual()
      return v ? { hubY: v.hubY } : null
    })

    /* ---- 第 1 局：**默认瞄准点**（池子正中 = 三层之间的空隙） ----
       这一局证明「对着空地会一直压到池底」，而不是停在写死的 0.42。 */
    const gapFrames = await runRound()
    const gapPick = pickFrames(gapFrames)
    const gB = gapFrames[gapPick.bottom]
    const gC = gapFrames[gapPick.closed]
    const gL = gapFrames[gapPick.lifted]

    check(
      `采到三个关键帧（共 ${gapFrames.length} 帧）`,
      gapPick.bottom >= 0 && gapPick.closed >= 0 && gapPick.lifted >= 0,
      `bottom=${gapPick.bottom} closed=${gapPick.closed} lifted=${gapPick.lifted}`,
    )
    check(
      '★★ 下爪：爪子真的降下去了（到池底）',
      !!gB && !!idlePose && gB.hubY < idlePose.hubY - 0.6,
      `hubY ${idlePose?.hubY.toFixed(2)} → ${gB?.hubY.toFixed(2)}`,
    )
    check(
      '★★ 下爪：指头张到最大（原来只扫 16°，远看像不动）',
      !!gB && gB.spread > 0.99 && gB.close < 0.05,
      `spread=${gB?.spread.toFixed(2)} close=${gB?.close.toFixed(2)}`,
    )
    check(
      '★★ 合爪：指头合拢了（不是「几乎没动」）',
      !!gC && gC.close > 0.85,
      `close=${gC?.close.toFixed(2)}`,
    )
    /*
      ★★ 这一条才是「画了什么」的证据：读**实际**的指头角度，不是传进去的 `close`。

      张到最大 ≈ +0.62，合拢 ≈ −0.30 ⇒ 扫过 **≈ 0.92 rad（53°）**。
      老实现是 0 → −0.28，只扫 **16°** —— 远看完全看不出在抓。
      阈值取 0.6 rad（34°）：明显大于老实现，又留了「夹着娃娃停在 0.86」的余量。
    */
    check(
      '★★ 指头**实际**扫过的角度 ≥ 34°（读的是 `debugProng()`，不是入参）',
      !!gB && !!gC && gB.prong - gC.prong >= 0.6,
      `${gB?.prong.toFixed(2)} → ${gC?.prong.toFixed(2)} rad（${(((gB?.prong ?? 0) - (gC?.prong ?? 0)) * 57.3).toFixed(0)}°）`,
    )
    check(
      '★ 合爪发生在「下到底」之后（合的时候不再继续往下降）',
      !!gC && !!gB && gC.hubY <= gB.hubY + 0.02,
      `下爪 hubY=${gB?.hubY.toFixed(3)} → 合爪 hubY=${gC?.hubY.toFixed(3)}`,
    )
    check(
      '★★ 提起：回到高处，指头保持合拢',
      !!gL && !!gC && gL.hubY > gC.hubY + 0.2 && gL.close > 0.95,
      `hubY ${gC?.hubY.toFixed(2)} → ${gL?.hubY.toFixed(2)}，close=${gL?.close.toFixed(2)}`,
    )
    /*
      ★ 对着**空地**：爪子必须一直压到池底附近（`HUB_MIN_Y = 0.16`），
      而不是停在写死的 0.42。这一条是「探面」的下半段证据。
    */
    check(
      '★★ 对着空地：压到池底（合爪 hubY ≤ 0.20，不是悬在半空）',
      !!gC && gC.hubY <= 0.2,
      `合爪 hubY=${gC?.hubY.toFixed(3)}`,
    )

    /* ---- 第 2 局：**瞄准一只娃娃** ----
       这一局是上一条的**对照组**：探面真的读了娃娃，所以会停在娃娃顶上
       （hubY 明显更高）。没有这一局，`hubY ≤ 0.20` 在「探面永远返回 0」时也成立。 */
    const target = await page.evaluate(() => {
      const st = window.__kqfClawStage
      const n = st.nearestPrize(0, 0)
      const p = n.index >= 0 ? st.prizeAt(n.index) : null
      return p ? { x: p.x, z: p.z, dist: n.dist, index: n.index } : null
    })
    check('找得到一只娃娃来瞄（对照组）', !!target, target ? `#${target.index} (${target.x.toFixed(2)}, ${target.z.toFixed(2)})` : '')
    if (target) {
      await page.evaluate((t) => window.__kqfClawAim?.(t.x, t.z), target)
      await wait(120)
    }

    /* 这一局顺便留三张证据图 —— 用 `waitForFunction` 等**状态**，不等时钟 */
    const shotWhen = async (expr, name) => {
      const ok = await page
        .waitForFunction(expr, { timeout: 12000, polling: 'raf' })
        .then(() => true, () => false)
      if (!ok) {
        check(`等得到「${name}」那一刻`, false, expr)
        return
      }
      const path = `${OUT}/${vp.name}-4-${name}.png`
      await page.screenshot({ path, clip })
      console.log(`  · 已存图 ${path}`)
    }

    await page.evaluate(async () => {
      const k = window.__kqf__
      if (k.getState().balance < 2) await k.addPoints(10)
      await k.getState().buyClawCoin()
    })
    await startSampling()
    await page.click('[data-claw-drop]')
    // 下爪接近到底：张到最大、还没开始合爪、已经降下去一半以上
    await shotWhen(
      `(() => { const s = window.__kqfClawStage; const v = s.debugVisual(); return !!v && v.close === 0 && v.spread > 0.99 && v.hubY < ${((idlePose?.hubY ?? 1) - 0.45).toFixed(2)} })()`,
      '下爪',
    )
    await shotWhen(
      `(() => { const s = window.__kqfClawStage; return s.debugProng() < 0.1 && s.debugVisual().close > 0.3 })()`,
      '合爪',
    )
    await shotWhen(
      `(() => { const s = window.__kqfClawStage; const v = s.debugVisual(); return !!v && v.close > 0.99 && v.hubY > ${((idlePose?.hubY ?? 1) - 0.4).toFixed(2)} })()`,
      '提起',
    )
    await wait(ROUND_MS)
    const pileFrames = await stopSampling()
    const pilePick = pickFrames(pileFrames)
    const pB = pileFrames[pilePick.bottom]
    const pC = pileFrames[pilePick.closed]

    /*
      ★★ 这条判据换过一次（2026-10-17）—— 别照抄旧的 `hubY > 空地 + 0.15`。

      旧判据**不可能成立**：娃娃顶只有 ~0.12~0.16 高（参考实现的熊也一样，
      `PRIZE_PARTS` 里身体 r=0.072、耳朵顶 ≈0.156），而
      `bottomY = max(HUB_MIN_Y(0.16), surf + 0.042)` 会被地板下限夹住 ——
      两者最多差 ~0.04。参考实现自己 `stopAt = max(0.13, surf+0.012)` 也只有 0.03 的差。
      要 0.15 的差，等于要求娃娃有 0.27 高，那是另一套比例。

      探面真正要证明的是「射线读到了娃娃，而不是永远返回地板 0」，
      所以直接量 `surfaceAt()`：娃娃顶 > 空地（地板 / 洞口都返回 0）。
    */
    const probe = await page.evaluate(() => {
      const st = window.__kqfClawStage
      const n = st.nearestPrize(0, 0)
      const p = n.index >= 0 ? st.prizeAt(n.index) : null
      const onDoll = p ? st.surfaceAt(p.x, p.z) : 0
      // 找一个离所有娃娃都远的角，量空地（地板 / 洞口都返回 0）
      let empty = 0
      for (const [x, z] of [[-0.5, -0.45], [0.5, -0.45], [-0.5, 0.45]]) {
        if (st.nearestPrize(x, z).dist > 0.15) {
          empty = st.surfaceAt(x, z)
          break
        }
      }
      return { onDoll: +onDoll.toFixed(3), empty: +empty.toFixed(3), index: n.index }
    })
    check(
      '★★ 探面真的读了娃娃（娃娃顶 > 空地；否则探面永远返回 0）',
      probe.onDoll > probe.empty + 0.03,
      `娃娃顶=${probe.onDoll} / 空地=${probe.empty}（#${probe.index}）`,
    )
    check(
      '★★ 对着娃娃：还是扎进池子（hubY ≤ 0.46，不是悬在娃娃上方夹空气）',
      !!pC && pC.hubY <= 0.46,
      `合爪 hubY=${pC?.hubY.toFixed(3)}`,
    )
    check(
      '★ 对着娃娃那一局：指头同样张到最大再合拢',
      !!pB && !!pC && pB.spread > 0.99 && pB.prong - pC.prong >= 0.6,
      `spread=${pB?.spread.toFixed(2)}，指头 ${pB?.prong.toFixed(2)} → ${pC?.prong.toFixed(2)} rad`,
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
      '★ 切走再切回：币 / 局数 / 商城币都没动（没有双跑、没有重复结算）',
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
