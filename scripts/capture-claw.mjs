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
 * ★★ 这一份最重要的判据：**玻璃上下完整、横向被裁、占满至少一个方向**
 *
 * ⚠️ 这条判据改过**三次**，每次都是「量错了对象」。别照抄旧结论：
 *    · 第 1 次 = 「整台机器（`cabinet`）完整在画布内」。那是**远距离全柜取景**，
 *      和原版差很多 —— 原版是**站在机器前面**看，底座是被裁掉的。
 *    · 第 2 次 = 「玻璃区完整」+「**取景框**铺满限制方向」。
 *      「玻璃完整」其实**不允许左右裁**，而原版竖屏是裁的（它拟合固定宽度 0.62，
 *      玻璃宽 1.16）。用户说「视角要近一点」时，这条断言反而是拦路的那一条。
 *    · 现在 = 「玻璃**上下**完整」+「横向裁得不过头」+「`glassFill` ≥ 0.86」。
 *      `glassFill` 由**场景**给（`max(横向占比, 纵向占比)`），脚本不重算。
 *
 * ★★★ 教训（写在最显眼的地方）：**判据写错方向时，它会长期绿着，而且保护的是错误画面。**
 *   换判据时如果只改数字不改断言，脚本会继续「通过」，而画面已经变成另一个样子。
 *   每换一次判据，都要能回答：**这一条红了的话，是画面错了还是判据错了？**
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

/*
  影子 A/B 用的「暗像素」阈值（0~255 的亮度）。

  ★★★ 这个数**不能猜**。2026-10-18 实测（同一帧开 / 关阴影，玻璃区）：

      阈值   开(有影)   关(无影)   关/开
        40      3.04%      3.06%   1.005   ← 噪声（这里只有真正的黑洞/深色毛）
        76      6.87%      6.84%   0.996   ← ★ 我一开始挑了这个，「没有信号」
       100      9.75%     11.14%   1.143   ← 反向：关掉阴影反而多出暗像素
       130     19.61%     14.48%   0.739   ← ★ 真信号在这里
       160     36.17%     29.29%   0.810

    为什么 76 没有信号：娃娃和池底本来就偏亮，投影只把它们从 ~190 压到 ~140，
    **进不了「< 76」那一档**。而 130 正好切在「受光面 / 投影面」之间。

    为什么 100~120 会反向：把「排除光阴影」这件事从 shader 里拿掉，娃娃自身的
    明暗完全变了（实测娃娃堆那一带整片亮 40~70 个色阶）⇒ 一部分像素从 130+
    掉到 100 附近。**总亮度**和**暗像素占比**是两个方向，不能混着下结论。

  ➜ 阈值取 **130**，判据看**相对变化**（关 / 开 < 0.85），不看绝对值 ——
    配色、主题、画幅不同，绝对暗部占比会变，但「关掉阴影应该更亮」这个方向不变。
*/
const SHADOW_DARK = 130

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

/**
 * 截图统计：字节数 + **像素层面的颜色多样性**。
 *
 * ★★ 为什么光看字节数不够（2026-10-18 实测）：`phone-landscape` 有一次 WebGL 整块
 *   **全黑**，而「有画面 184 KB / 空白 12 KB」照样通过 —— 一块纯黑在 PNG 里
 *   比纯色背景**更难压**，字节数反而更大。**黑屏也能骗过字节数**。
 *   ➜ 把截图解码回来，量化到 64×64 数「不同颜色」和「近黑像素占比」：
 *     渲染正常 ⇒ 几十种颜色、近黑占比低；黑屏 ⇒ 1 种颜色、近黑 100%。
 * ★ 对照组（藏起 canvas 拍容器底色）天然只有 1~2 种颜色，说明这个探针**分得开**。
 */
async function shotStats(page, clip) {
  const b64 = await page.screenshot({ clip, encoding: 'base64' })
  const px = await page.evaluate(async (data) => {
    const img = new Image()
    img.src = `data:image/png;base64,${data}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, 64, 64)
    const d = ctx.getImageData(0, 0, 64, 64).data
    const colors = new Set()
    let dark = 0
    for (let i = 0; i < d.length; i += 4) {
      // 每通道量化到 16 级：既不会被抖动拆成一堆「不同颜色」，又分得开渐变
      colors.add(((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4))
      if (d[i] + d[i + 1] + d[i + 2] < 30) dark++
    }
    return { colors: colors.size, darkFrac: dark / (64 * 64) }
  }, b64)
  return { bytes: Math.round((b64.length * 3) / 4), ...px }
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
      /* 舞台在**视口**里的位置 —— 影子 A/B 要把玻璃区坐标投到屏幕上取像素 */
      stageRect: { x: r.left, y: r.top },
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

  /*
    ★★ 「移动爪子的时候它会晃」—— 原版最显眼的手感，我们之前**完全没有**。

    那时候 hub 是直接贴在小车正下方的（`hub.position.set(v.clawX, v.hubY, v.clawZ)`），
    平移多快都纹丝不动，看着像一块被推着走的铁。原版是吊在绳子上的：
    小车一加速它就往后甩，再被重力拉回来。

    判据分两条，缺一不可：
      · 晃得出来 —— hub 相对小车偏出去（`dx`）**而且**整只爪子沿绳倾斜（`tilt`）。
        只平移不转 = 半成品（看着像爪子在滑冰）。
      · 会停 —— 2 秒后回到竖直。不会停的那个叫钟摆，孩子会以为爪子坏了。

    ★ 别拿 `debugVisual().swingX` 当证据：那是页面算出来的**意图**，
      「算出来要晃」和「画面上真的晃了」是两件事。
  */
  await page.evaluate(() => {
    window.__sway = []
    const st = window.__kqfClawStage
    const t0 = performance.now()
    const tick = () => {
      /* ★ 带上时间戳：判定「停了没有」要看**最后一段窗口的峰值**，不是最后一帧 */
      if (st) window.__sway.push({ ...st.debugSwing(), t: performance.now() })
      if (performance.now() - t0 < 9000) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  /*
    ★ 按 **900ms** 不是 300ms：`clawCarriageAccel` 有 0.7 m/s² 的加速度上限，
      巡航速度 0.52 m/s 要 0.74 秒才到。按太短的话爪子根本没加速完，
      摆只有 2°（实测），判据会误报成「不晃」——量的是「按得短」不是「不会晃」。

    ★★ 2026-10-21：但**光按时长不够** —— 五档连跑时 phone 这一档偶尔一次
      `ArrowRight` 量出来 12 帧 dx 全是 0.000、tilt 0.0°。查下来不是「不晃」，
      而是**爪子已经贴在右限位上**（`LIMITS.x1 = 0.34`），按同一个方向是空操作。
      判据量到的是「没得动」，不是「动起来不晃」。

      ➜ 先读爪子的位置，**往有空间的那一侧**推，并且推到它真的动了 0.15 世界单位
        为止（最多 3 秒）。这样判据量的是「动起来会不会晃」，不再依赖上一次
        交互把它留在哪儿。

      ⚠️ 别改成「点一下画布再按右键」：那会把瞄准点挪到池子中间，
        而后面「影子真的投影了」是拿**整块画布**算变亮像素占比的 ——
        爪子的影子从左上挪到娃娃堆后面，占比直接从 2.0% 掉到 1.2%，
        影子判据会假红。（实测踩过。）
  */
  const clawX0 = await page.evaluate(() => window.__kqfClawStage?.debugVisual?.()?.clawX ?? 0)
  const swayKey = clawX0 > 0 ? 'ArrowLeft' : 'ArrowRight'
  await page.keyboard.down(swayKey)
  let clawMoved = 0
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 100))
    const x = await page.evaluate(() => window.__kqfClawStage?.debugVisual?.()?.clawX ?? null)
    if (x !== null) clawMoved = Math.abs(x - clawX0)
    if (clawMoved > 0.15) break
  }
  await page.keyboard.up(swayKey)
  await new Promise((r) => setTimeout(r, 3200))
  const sway = await page.evaluate(() => window.__sway ?? [])
  const peakDx = sway.length ? Math.max(...sway.map((s) => Math.abs(s.dx))) : 0
  const peakTilt = sway.length ? Math.max(...sway.map((s) => s.tilt)) : 0
  /*
    ★★ 2026-10-21：「停了没有」量的是**最后 1 秒的峰值**，不是最后一帧。

    原来取 `sway[sway.length - 1].x` —— 摆动周期约 0.7 秒（绳 0.12m ⇒ ω≈9），
    最后一帧落在周期的哪个相位纯看运气：**过零点**量出 0.005（假绿），
    **波峰**量出 0.066（假红）。五档连跑时掉帧更明显，实测同一个视口
    两次跑出 0.066 / 0.005 —— 判据在测「采样相位」，不是在测「会不会停」。

    ➜ 取最后 1000ms 内所有采样的 `max|x|`：真的还在摆就一定有一帧在波峰，
      真的停了则每一帧都接近 0。这个口径**比原来更严**，也不再依赖相位。
      （1000ms ≥ 1.4 个周期，低帧率下也至少能盖住一个完整波峰。）
  */
  const lastT = sway.length ? Math.max(...sway.map((s) => s.t)) : 0
  const tail = sway.filter((s) => s.t >= lastT - 1000)
  const settle = tail.length ? Math.max(...tail.map((s) => Math.abs(s.x))) : 1
  check(
    '★★ 移动爪子时它会摆（hub 偏出去 + 整只爪子沿绳倾斜）',
    sway.length > 10 && peakDx > 0.004 && peakTilt > 0.03,
    `采样 ${sway.length} 帧 · peak dx=${peakDx.toFixed(3)}m · tilt=${((peakTilt * 180) / Math.PI).toFixed(1)}°` +
      ` · 爪子移动 ${clawMoved.toFixed(3)}` +
      (clawMoved <= 0.15 ? '（⚠️ 爪子没动起来，先查限位/焦点，别当成「不会晃」）' : ''),
  )
  check(
    '★ 摆会停（不是钟摆：松手后最后 1 秒的摆动峰值 < 0.06 rad）',
    sway.length > 10 && settle < 0.06,
    `最后 1 秒峰值 |swingX|=${settle.toFixed(3)} rad（${((settle * 180) / Math.PI).toFixed(1)}°）· 取 ${tail.length} 帧`,
  )

  const { glass: gl, frame: fr, cabinet: cb, canvas: cv } = geo.frame

  /*
    ★★★ 核心判据（2026-10-18 第三次改，前两次都是**量错对象**）：

    **竖屏时玻璃区允许被裁掉左右** —— 这是原版的行为，不是妥协。
      参考实现竖屏的 `fitDist()` 拟合的是固定的世界宽度 `0.62`，
      而玻璃宽 `1.16` ⇒ 左右各裁掉约 0.27（约 23%）。
      也就是「人贴着柜子站，眼睛只装得下中间那一块」。

    ➜ 所以判据改成三条，各管一件事：
      ① 玻璃**高度**必须完整（上下不能裁）—— 爪子下到池底、娃娃堆顶都要看得见；
      ② 玻璃**不能**被裁得太多（`glassFillX` 有上界）；
      ③ 「够不够近」由 `glassFill`（场景自己算的 max）保证，不在这里重算。
      左右**确实**会被裁 —— 硬断言「左右都有余量」等于要求退回远距离全柜取景。

    ⚠️ 别再把 ① 写成「四边都在画布内」：那一条和「视角要近」是互斥的，
      而且它上一次绿着的时候，画面正是用户说的「跟原版差很多」。
  */
  const glassVertInside = gl.top >= -0.5 && gl.bottom <= cv.h + 0.5
  check(
    '★★ 玻璃区**上下**完整在画布内（左右可以裁 —— 原版竖向取景就是这样）',
    glassVertInside,
    `玻璃 top=${gl.top.toFixed(1)} bottom=${gl.bottom.toFixed(1)} / 画布高 ${cv.h}`,
  )
  /*
    横向**裁切幅度**的上下界，只为竖屏设。

    ★ 竖屏：原版拟合固定宽度 `0.62`（玻璃 1.16）⇒ 裁约 23%，横向占比 ≈ 123%。
      「再宽就成特写」的上界 130%；下限 0.55 防「玻璃被压成一条竖缝」。
    ★★ 横屏**不该判这一条**：那时画布宽得多，玻璃只占约 50% 宽是**正常**的
      （高度才是约束方向，`glassFillY` 撑着合格线）。
      2026-10-18 实测横屏 `glassFillX=0.502` 被 0.55 的下界拦成红 ——
      而画面是对的：那是把竖屏的判据硬套到横屏上。
  */
  const landscape = cv.w > cv.h * 1.05
  const gmx = geo.frame.glassFillX
  check(
    landscape ? '★ 玻璃区横向占比（横屏仅供参考，不是判据）' : '★ 玻璃区横向没被裁得过头（0.55 ≤ X ≤ 1.30）',
    landscape || (gmx <= 1.3 && gmx >= 0.55),
    `glassFillX=${gmx.toFixed(3)}${landscape ? '（横屏不判）' : ''}`,
  )

  /*
    「够不够近」的判据 —— **横竖屏量的是两个不同的东西**。

    ★★★ 2026-10-19：横屏的**承诺变了**，判据必须跟着变。

      以前横屏只要求「玻璃完整」，于是玻璃把画面高度占满、机顶灯箱被顶出画面
      （用户抱怨的「机器被切头」）。现在横屏要求装下 **[玻璃底, 灯箱顶]**
      （`clawScene` 的 `VERT_CORNERS_WIDE`），玻璃就注定只占约 0.60 ——
      此时再拿「玻璃 ≥ 0.74」去判，红的是**判据**，不是画面。

      ➜ 横屏改量**整台机器**：
        · `cabinet.top` 必须在画面里（灯箱不裁头）—— 这是新承诺本身；
        · 整机纵向占比 ≥ 0.92（底座允许被裁）—— 守「别缩成一小条」，
          也就是原来 `GLASS_MIN_FILL_WIDE` 想守的那件事，只是换成同一口径的量。

      ⚠️ 这两条都要**能真的红**：把相机拉远成「全柜照」时，
        纵向占比会掉到 1.0 以下、`cabinet.top` 会变成正数（机器缩在中间）。
    */
  if (landscape) {
    const cabTop = geo.frame.cabinet.top
    const cabBot = geo.frame.cabinet.bottom
    const visibleH = Math.min(cabBot, cv.h) - Math.max(cabTop, 0)
    check(
      '★★ 横屏：机顶灯箱完整在画面里（不裁头 —— 这是横屏取景的承诺）',
      cabTop >= -2,
      `整柜 top=${cabTop.toFixed(1)}px（≥ -2）`,
    )
    check(
      '★★ 横屏：整机纵向铺满画面（底座允许被裁；没铺满 = 又退回全柜照了）',
      visibleH / cv.h >= 0.92,
      `整机纵向占 ${((visibleH / cv.h) * 100).toFixed(0)}%（≥ 92%）`,
    )
  } else {
    const gf = geo.frame.glassFill
    const gfMin = geo.frame.glassFillMin
    check(
      '★★ 视角够近：玻璃占满至少一个方向（合格线由场景按画幅给）',
      gf >= gfMin,
      `glassFill=${gf.toFixed(3)} ≥ ${gfMin.toFixed(2)}（X=${geo.frame.glassFillX.toFixed(3)} Y=${geo.frame.glassFillY.toFixed(3)}）`,
    )
    /*
      取景框**不再**要求完整可见 —— 但它要么被"满格"推出画面，要么就说明镜头还远。
      ★ 竖屏是**宽度**在碰边。写死"宽度 ≥ 100%"会在横屏时报红，
        而横屏那档的取景是对的 —— 所以这一条只在竖屏用。
    */
    const frW = (fr.right - fr.left) / cv.w
    const frH = (fr.bottom - fr.top) / cv.h
    check(
      '★ 取景框在某个方向溢出（近景取景的正向证据：两个方向都没溢出 = 又退回全柜了）',
      Math.max(frW, frH) >= 1.0,
      `框 宽 ${(frW * 100).toFixed(0)}% / 高 ${(frH * 100).toFixed(0)}%`,
    )
  }

  /*
    ★★ 阴影贴图一个 texel 覆盖多大 —— 守的是「改了范围却忘了 updateProjectionMatrix()」。

    three 的 `LightShadow` **不会**自动更新阴影相机的投影矩阵（只有构造时算一次，
    默认 ±5）。忘了那一行时 `shadow.camera.left/right` 全是**死代码**，
    贴图仍然铺在 10×10 的范围上：1024² ⇒ 一个 texel 覆盖 **9.8mm**，
    娃娃只有 150mm 宽 = 15 个 texel ⇒ **娃娃之间不可能有接触阴影**。

    最阴的地方：这个退化在画面上**只表现为「影子有点糊」**，肉眼和截图都看不出来
    （2026-10-18 就是这么漏掉的 —— 改了范围，量了半天发现数字没动）。

    ➜ 所以期望值**从源码派生**：`debugFrame().shadowTexel` 是从**实际投影矩阵**
      反推的（`2 / m[0] / mapSize`），不是抄常量。忘了更新时会返回 0.0098，
      而不是正确的 0.0008。
  */
  const texel = geo.frame.shadowTexel
  check(
    '★★ 阴影 texel 够细（娃娃身上 ≥100 个 texel，否则接触阴影不存在）',
    texel > 0 && 0.15 / texel >= 100,
    `texel ${(texel * 1000).toFixed(2)}mm ⇒ 一只娃娃 ${Math.round(0.15 / texel)} 个 texel` +
      (texel > 0.004 ? '（≈ 9.8mm 说明忘了 shadow.camera.updateProjectionMatrix）' : ''),
  )

  /*
    ★★★ 「影子到底有没有」——**同机、同池、同光**的 A/B 对照。

    ⚠️ 这一条改过两版，两版都**假绿**过，教训值得全项目借用：

      第 1 版：量「画布下半部」的亮度分位数。
        → 那里绝大部分是背景和地面，在参考实现上关掉阴影后 p2 只动 1 个色阶。
          **判据分辨不出「有 / 没」，它就不是判据。**

      第 2 版：改成玻璃区下半部，判据用 `p15` 差 ≥ 3。实测 Δ20，看着漂亮。
        → 变异测试（把 `debugSetShadows` 改成永远传 false）**照样绿**。
          逐像素相减一看：整个玻璃区**平均亮 4.6 个色阶**、娃娃堆那一带亮 40~70
          —— 那是**娃娃被照亮了**，不是影子消失了。因为「排除光/阴影」在 three 里
          还会改材质的 `USE_SHADOWMAP` 分支，整块受光都变了。

    ➜ 第 3 版只用**一个不会被整体亮度污染的量**：暗部占比 `darkFrac`
      （亮度 < 76/255 的像素占比）。关掉阴影时局部阴影消失、哪些像素都可能被
      照亮，但**「很暗的像素」只会变少**。判据取**相对下降**：
        `darkFrac(关) < darkFrac(开) × 0.85`
      并且**先断言开关真的变了**（`debugEffects().shadows === false`）。

    ➜ 第 4 版（现在）：第 3 版仍然会飘 —— 暗部 130/255 的像素**绝大部分是柜底
      深蓝布和黑框**，影子只让其中很小一部分跨过阈值。实测只差 0.2 个百分点，
      跑两次就翻符号（98% / 101%）。根因是它拿**全页截图 + 450ms 间隔**比，
      而娃娃在抖、LED 在呼吸：同状态连拍的 meanAbs 是 **11.85**，
      开/关只有 **20.47** —— 信噪比 1.7，判据必然翻。

      ➜ 现在用 `debugForceShadowFrame(on)` 在**同一帧**上画两遍：两次用同一个 `t`、
        同一个 `ClawVisual`，中间插不进动画，**唯一变量**就是阴影贴图。
        判据改成**正向证据**：关掉阴影后有多少像素**变亮**（影子被拿掉了），
        并要求「变暗的像素 ≈ 0」—— 这一条同时证明「两帧只差阴影」，
        否则两帧其实是两个不同的画面，变亮变暗都会有一堆。

      ★★ 还有一条**必须**的先决条件：`renderShadowAB` 要把材质标脏重编。
        `USE_SHADOWMAP` 是 shader 的**编译期**分支，只翻 `shadowMap.enabled`
        的话第二帧仍然采样上一帧那张阴影图 —— 实测两帧只差 **6 个色阶 / 0.31%**，
        看着像「影子根本不存在」，其实只是 A/B 拍到了同一张图。

    ⚠️ 阈值先量后定（四个视口实测：变亮 **2.5~3.0%**、平均 **+19~20 色阶**、
       变暗 **恰好 0%**）。改光照 / 材质 / 配色后要**重新量**。
  */
  const shadowAB = await page.evaluate(async () => {
    const st = window.__kqfClawStage
    const cv = document.querySelector('[data-claw-stage] canvas')
    if (!st || !cv) return null
    const grab = () => cv.toDataURL('image/png')
    // 同步画两帧、同步取图 —— 中间插不进 rAF，动画不会混进来
    const onR = st.debugForceShadowFrame(true)
    const onUrl = grab()
    const offR = st.debugForceShadowFrame(false)
    const offUrl = grab()
    st.debugForceShadowFrame(true)
    const load = (u) =>
      new Promise((res) => {
        const i = new Image()
        i.onload = () => res(i)
        i.src = u
      })
    const [ia, ib] = await Promise.all([load(onUrl), load(offUrl)])
    const fr = st.debugFrame()
    const g = fr.glass
    const s = ia.width / fr.canvas.w // 画布内部像素 / CSS 像素
    const x0 = Math.max(0, Math.round(g.left * s))
    const y0 = Math.max(0, Math.round(g.top * s))
    const w = Math.max(1, Math.round((g.right - g.left) * s))
    const h = Math.max(1, Math.round((g.bottom - g.top) * s))
    const px = (img) => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      ctx.drawImage(img, x0, y0, w, h, 0, 0, w, h)
      return ctx.getImageData(0, 0, w, h).data
    }
    const A = px(ia)
    const B = px(ib)
    let bright = 0
    let dark = 0
    let gain = 0
    let n = 0
    for (let i = 0; i < A.length; i += 4) {
      const la = 0.299 * A[i] + 0.587 * A[i + 1] + 0.114 * A[i + 2]
      const lb = 0.299 * B[i] + 0.587 * B[i + 1] + 0.114 * B[i + 2]
      const d = lb - la
      if (d > 6) {
        bright++
        gain += d
      }
      if (d < -6) dark++
      n++
    }
    return {
      drew: onR.drew && offR.drew,
      onUsed: onR.shadows,
      offUsed: offR.shadows,
      brightPct: (bright / n) * 100,
      darkPct: (dark / n) * 100,
      meanGain: bright ? gain / bright : 0,
    }
  })
  check(
    '★★ 影子 A/B 翻在**同一帧**上（否则两张图是同一个状态，差值必然 ≈0）',
    !!shadowAB && shadowAB.drew && shadowAB.onUsed === true && shadowAB.offUsed === false,
    shadowAB
      ? `开 ⇒ shadows=${shadowAB.onUsed}，关 ⇒ shadows=${shadowAB.offUsed}`
      : '拿不到 `[data-claw-stage] canvas` 或场景对象',
  )
  check(
    '★★★ 影子真的投影了（关掉阴影后娃娃脚下 / 柜底变亮，且没有像素变暗）',
    !!shadowAB && shadowAB.brightPct >= 1.5 && shadowAB.meanGain >= 8 && shadowAB.darkPct <= 0.5,
    shadowAB
      ? `变亮 ${shadowAB.brightPct.toFixed(2)}%（≥1.5%）· 平均 +${shadowAB.meanGain.toFixed(1)} 色阶（≥8）· 反向变暗 ${shadowAB.darkPct.toFixed(2)}%（≤0.5%）`
      : '—',
  )

  // 反向证据：整柜**应当**溢出 —— 没溢出说明又退回「远距离全柜取景」了
  const cabOverflow = cb.top < 0 || cb.bottom > cv.h || cb.left < 0 || cb.right > cv.w
  check(
    '★ 整台机器**溢出**画布（近景取景；没溢出 = 又退回了远距离全柜）',
    cabOverflow,
    `整柜 ${cb.left.toFixed(1)},${cb.top.toFixed(1)} → ${cb.right.toFixed(1)},${cb.bottom.toFixed(1)}`,
  )

  /*
    商场房间（地板 + 后墙）：**两侧有没有空白**决定开不开。

    ★ 只断言「关系」，**不抄** `resize()` 里那个 24px 的门槛 ——
      抄一遍就是同一个事实存两份，以后改门槛这条会**绿着说谎**。
      所以两头都取离门槛很远的判据：
        · 空白 ≥ 100px ⇒ 必须开着（否则就是「房间永远关着」）
        · 空白 ≤ 10px  ⇒ 必须关着（否则就是「竖屏白画两次」）
      中间的档（实测 tablet 54px）不断言 —— 开或关都说得过去。
    ⚠️ 这条只证明「开关对了」，不证明「画出来了」。
      「画出来了」的证据是同一轮落盘的截图（`.e2e-scratch/claw/*-1-娃娃机.png`）。
  */
  const sideGap = Math.min(cb.left, cv.w - cb.right)
  if (sideGap >= 100) {
    check('★ 两侧有空白 ⇒ 商场房间开着', geo.frame.roomVisible, `空白 ${sideGap.toFixed(0)}px`)
  } else if (sideGap <= 10) {
    check('★ 两侧没空白 ⇒ 商场房间关着（不白画两次）', !geo.frame.roomVisible, `空白 ${sideGap.toFixed(0)}px`)
  } else {
    console.log(`  · 两侧空白 ${sideGap.toFixed(0)}px（中间档，开/关都合理，不断言）`)
  }

  check(
    '容器没有被裁掉内容（`overflow` 祖先的 `scrollHeight === clientHeight`）',
    !geo.cut || geo.cut.scrollH <= geo.cut.clientH + 1,
    geo.cut ? `${geo.cut.tag}: ${geo.cut.scrollH} vs ${geo.cut.clientH}` : '没有裁剪祖先',
  )

  /*
    ★★ 取景框必须**整块落在底栏上方** —— 判据在**视口坐标**里。

    ⚠️ 上面每一条几何判据量的都是**画布内部坐标**（`debugFrame()` 给的是 canvas px）。
      它们能证明「柜子在画布里放得下」，但证明不了「画布本身在屏幕上没被压住」。
      2026-10-18 就是这么漏的：横屏手机上 `stage` 被 canvas 的**固有高度**撑到 324px
      （`renderer.setSize` 写进 height 属性 → 反过来撑开容器 → 回路），
      页面溢出 224px，而底栏是 `sticky bottom-0` ⇒ 正好压在取景框下沿 **141.6px** 上，
      池子和取物口全在导航栏后面 —— 而当时 5 档几何判据**全绿**。

    ★ 两条判据：
      · `frameBottom ≤ navTop`：取景框下沿不许进底栏（+1px 容差给亚像素）；
      · `scrollHeight === clientHeight`：这一页要**一屏放得下**，
        否则「看得见」得靠孩子自己去滚 —— 而他不知道要滚。
    ★ 期望值全部现场量，不抄任何高度常量（顶栏 / 底栏高度都是会变的）。
  */
  const vis = await page.evaluate(() => {
    const el = document.querySelector('[data-claw-stage]')
    const f = window.__kqfClawStage.debugFrame()
    const r = el.getBoundingClientRect()
    const navs = [...document.querySelectorAll('nav')]
    const nav = navs.length ? navs[navs.length - 1] : null
    const se = document.scrollingElement
    return {
      frameTop: r.top + f.frame.top,
      frameBottom: r.top + f.frame.bottom,
      navTop: nav ? nav.getBoundingClientRect().top : null,
      scrollH: se.scrollHeight,
      clientH: se.clientHeight,
    }
  })
  const navOverlap = vis.navTop === null ? Infinity : vis.frameBottom - vis.navTop
  check(
    '★★ 取景框整块在底栏上方（视口坐标 —— 画布内坐标看不出这件事）',
    vis.navTop !== null && navOverlap <= 1,
    vis.navTop === null
      ? '找不到底部导航'
      : `框 ${vis.frameTop.toFixed(1)} → ${vis.frameBottom.toFixed(1)} / 底栏顶 ${vis.navTop.toFixed(1)}` +
          (navOverlap > 1 ? ` ⇒ 压住 ${navOverlap.toFixed(1)}px` : ''),
  )
  check(
    '★ 这一页一屏放得下（不用滚动才看得见机器）',
    vis.scrollH <= vis.clientH + 1,
    `scrollH ${vis.scrollH} / clientH ${vis.clientH} ⇒ 溢出 ${vis.scrollH - vis.clientH}px`,
  )

  /* ================= 画面不是空白（对照组 A） ================= */

  const clip = await page.evaluate(() => {
    const el = document.querySelector('[data-claw-stage]')
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  })
  const withCanvas = await shotStats(page, clip)
  // 对照组：把 canvas 藏起来 —— 剩下的是容器那层纯色背景（`#e8e4de`）
  await page.evaluate(() => {
    const c = document.querySelector('[data-claw-stage] canvas')
    if (c) c.style.visibility = 'hidden'
  })
  await wait(250)
  const blank = await shotStats(page, clip)
  await page.evaluate(() => {
    const c = document.querySelector('[data-claw-stage] canvas')
    if (c) c.style.visibility = ''
  })
  await wait(250)
  check(
    '★★ 画布里有画面（比「藏起 canvas 的纯色背景」明显大）',
    withCanvas.bytes > blank.bytes * 1.5,
    `有画面 ${withCanvas.bytes}B / 空白 ${blank.bytes}B（×${(withCanvas.bytes / blank.bytes).toFixed(2)}）`,
  )
  /*
    阳性对照：在画布那块位置盖一张**纯黑**的 fixed 遮罩再拍一张 ——
    证明「黑屏」这一支**真的会红**。
    （只看「有画面 vs 空白」不够：2026-10-18 有一次 WebGL 整块全黑，
     字节数反而比底色更大，那条判据照样绿。）
    ★ 不能靠「把容器背景涂黑」：容器里还压着摇杆 / 配色块这些 DOM，涂黑之后
      仍然有上百种颜色（实测 102 种）—— 那样这个对照就证明不了什么。
  */
  await page.evaluate((r) => {
    const ov = document.createElement('div')
    ov.id = '__black_ctl'
    ov.style.cssText =
      `position:fixed;left:${r.x}px;top:${r.y}px;width:${r.width}px;height:${r.height}px;` +
      'background:#000;z-index:2147483647;pointer-events:none'
    document.body.appendChild(ov)
  }, clip)
  await wait(150)
  const blackCtl = await shotStats(page, clip)
  await page.evaluate(() => document.getElementById('__black_ctl')?.remove())
  await wait(250)
  check(
    '★★ 画面不是一块纯色 / 黑屏（字节数分不出黑屏，见 `shotStats` 的注释）',
    // 实测 5 档正常画面：102~150 种颜色、近黑 0~1%；纯黑遮罩：1 种、近黑 100%
    withCanvas.colors >= 8 && withCanvas.darkFrac < 0.5,
    `${withCanvas.colors} 种颜色、近黑 ${(withCanvas.darkFrac * 100).toFixed(0)}%`,
  )
  check(
    '★ 探针自检：纯黑画面会被判成「黑屏」（这一支不是恒真）',
    blackCtl.colors <= 8 && blackCtl.darkFrac > 0.9,
    `涂黑后 ${blackCtl.colors} 种颜色、近黑 ${(blackCtl.darkFrac * 100).toFixed(0)}%`,
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
    /*
      ★ 等**状态变了**，不要等固定毫秒。原来是 `wait(500)`，实测 tablet 档
        （834×1112，画布 648×822，物理 chunk 同时在加载）那一笔 Dexie 事务
        要 600ms 以上才落 —— 500ms 一到就读，读到的是「还没变」，
        于是「币 +1 / 积分 −1 / 下爪 −1 / 中奖文案」四条**连环**报红。
        ⚠️ 报的是「功能坏了」，真因是**脚本等得不够**。这种红最难查：
        单独跑一次又绿了。
    */
    const buyLanded = await page
      .waitForFunction((n) => window.__kqf__.getState().clawCoins > n, { timeout: 8000 }, before.coins)
      .then(() => true, () => false)
    const coinsNow = await page.evaluate(() => window.__kqf__.getState().clawCoins)
    check('买一个币：状态真的变了（不是等 500ms 就下结论）', buyLanded, `${before.coins} → ${coinsNow}`)
    const afterBuy = await page.evaluate(() => {
      const s = window.__kqf__.getState()
      return { coins: s.clawCoins, points: s.balance }
    })
    check('买一个币：币 +1', afterBuy.coins === before.coins + 1, `coins=${afterBuy.coins}`)
    check('买一个币：积分 −1', afterBuy.points === before.points - 1, `积分 ${before.points} → ${afterBuy.points}`)

    /*
      ★★ 下爪之后**等状态**，不等猜出来的毫秒数。

      踩过两次：`wait(ROUND_MS)`（动画 + 0.8 秒）在机器忙的时候不够 ——
      投币要走一次 IndexedDB 事务，结算也走一次。实测「一局结束有结果文案」
      读到空字符串（那 0.8 秒被事务吃掉了），而币和局数都是对的。
      ➜ 顺序是：点下去 → 等**局数 +1**（真的开始了）→ 等**结果文案非空**。
        中间那个 150ms 是给 `setResult(null)`（新一局开始时清掉上一局文案）
        落地的，不然可能立刻读到上一局的旧文案。
    */
    const dropAndWait = async () => {
      const p0 = await page.evaluate(() => window.__kqf__.getState().clawPlays)
      await page.click('[data-claw-drop]')
      const started = await page
        .waitForFunction((p) => window.__kqf__.getState().clawPlays > p, { timeout: 8000 }, p0)
        .then(() => true, () => false)
      if (!started) return false
      await wait(150)
      return await page
        .waitForFunction(
          () => {
            const el = document.querySelector('[data-claw-result]')
            return !!el && (el.innerText ?? '').trim().length > 0
          },
          { timeout: 25000 },
        )
        .then(() => true, () => false)
    }

    const roundDone = await dropAndWait()
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
    check(
      '一局结束有结果文案',
      roundDone && afterRound.result.trim().length > 0,
      `「${afterRound.result.trim()}」（等到结果=${roundDone}）`,
    )

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

    let playedAll = true
    for (let i = 0; i < win.need; i++) {
      /*
        ★ 一局一局**等演完**再投下一枚。
        原来这里是 `click → wait(ROUND_MS)`：机器忙的时候动画 + 结算会超过
        那个数，于是下一枚被「还在演」挡掉 ⇒ 实际局数和 `findRound` 算出来的
        目标局**错开**，然后「中了那一局：商城币 +1」随机红。而且它红的时候
        看起来像账本算错了。
      */
      if (!(await dropAndWait())) {
        playedAll = false
        break
      }
    }
    check('★ 精确走到中奖那一局（每一局都真的演完了）', playedAll, `need=${win.need} 局`)
    /*
      ★ `ROUND_MS` 是「动画时长 + 0.8 秒」推出来的，但那 0.8 秒要同时盖住
        「投币走一次 IndexedDB 事务」的延迟。机器忙的时候（比如同时跑着 vitest）
        这个延迟会超过 0.8 秒 ⇒ 读到的还是**上一局被清空之后**的空元素：
        文案 `「」`、`data-claw-won=undefined`，而商城币那一条却是对的
        （账已经结算了）—— 看着像「赢了但没显示」，其实只是读早了。
      ➜ 结果这件事按**状态**等，不按墙钟等。
    */
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector('[data-claw-result]')
          return !!el && el.getAttribute('data-claw-won') !== null
        },
        { timeout: 15000 },
      )
      .catch(() => {})
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
              /*
                ★ 捏合手感（接触 → 挤压 → 压痕 → 着色器）。
                  每帧都记，因为「捏住」只有不到 1 秒的窗口，挑帧会挑空。
              */
              grip: st.debugGrip(),
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
    /*
      ★ 对照组：还没下爪时，**没有任何指头接触**。
        没有这一条的话，下面「捏住了」在「压痕是个常量」时也成立。
    */
    const idleGrip = await page.evaluate(() => window.__kqfClawStage?.debugGrip() ?? null)

    /* ---- 第 1 局：**确认是空地**再瞄 ----
       这一局证明「对着空地会一直压到池底」，而不是停在写死的 0.42。

       ★★ 原来这里写的是「默认瞄准点 = 池子正中 = 三层之间的空隙」——
         那是个**假设**，不是事实。娃娃沉降、以及回收之后从
         `RESPAWN_SPOTS`（其中一个是 `(0.02, -0.02)`，基本就是正中）放回来，
         都可能让正中正好坐着一只。实测 2026-10-18 就坐了：合爪 hubY=0.239
         （= 娃娃顶 0.197 + 0.042），断言红，而「探面」本身是好的。
         ➜ 先问物理「哪儿是空的」（`surfaceAt === 0`），再瞄那儿。
         避开采光口那一角：洞口探面也返回 0，但爪子下到洞口里拍照很难看。
    */
    const emptySpot = await page.evaluate(() => {
      const st = window.__kqfClawStage
      if (!st) return null
      for (let r = 0; r <= 0.42; r += 0.1) {
        for (let a = 0; a < 12; a++) {
          const ang = (a / 12) * Math.PI * 2
          const x = +(r * Math.cos(ang)).toFixed(3)
          const z = +(r * Math.sin(ang)).toFixed(3)
          if (x > 0.2 && z > 0) continue // 取物口那一角
          if (st.surfaceAt(x, z) === 0) return { x, z }
        }
      }
      return null
    })
    check('找得到一个空地来瞄（探面 = 0）', !!emptySpot, emptySpot ? `(${emptySpot.x}, ${emptySpot.z})` : '')
    if (emptySpot) {
      await page.evaluate((p) => window.__kqfClawAim?.(p.x, p.z), emptySpot)
      await wait(120)
    }
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
      // 同上：量这一局最深到哪，别赌「合爪那一帧」一定被采到
      gapFrames.length > 0 && Math.min(...gapFrames.map((f) => f.hubY)) <= 0.2,
      `最深 hubY=${gapFrames.length ? Math.min(...gapFrames.map((f) => f.hubY)).toFixed(3) : '—'}（瞄的是探面=0 的 (${emptySpot?.x}, ${emptySpot?.z})）`,
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
    const shoot = async (name) => {
      const path = `${OUT}/${vp.name}-4-${name}.png`
      await page.screenshot({ path, clip })
      console.log(`  · 已存图 ${path}`)
    }
    const shotWhen = async (expr, name) => {
      const ok = await page
        .waitForFunction(expr, { timeout: 12000, polling: 'raf' })
        .then(() => true, () => false)
      if (!ok) {
        check(`等得到「${name}」那一刻`, false, expr)
        return
      }
      await shoot(name)
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
    /*
      ★★ 2026-10-19：「提起」那张**必须在「合爪」截图之前就开始等**。

      三个 `shotWhen` 串行的话，每个 `page.screenshot()` 在 headless + WebGL 下
      要 0.5~1.5 秒 —— 而「提起」的窗口只有约 1.5 秒（`hubY` 从 0.61 升到 1.01，
      再算上 `move` 那 1.15 秒）。串行等常常**刚好错过**，于是这一条红、
      而池子里其实一切正常（同一次运行的 `pickFrames()` 采样里
      `lifted.hubY = 0.48`、`close = 1.00` 都在）。
      ➜ 先把这个等待挂上去，再截「合爪」，两个动作重叠，窗口就不会被吃掉。
    */
    const liftExpr = `(() => { const s = window.__kqfClawStage; const v = s.debugVisual(); return !!v && v.close > 0.99 && v.hubY > ${((idlePose?.hubY ?? 1) - 0.4).toFixed(2)} })()`
    const liftWait = page
      .waitForFunction(liftExpr, { timeout: 12000, polling: 'raf' })
      .then(() => true, () => false)
    await shotWhen(
      `(() => { const s = window.__kqfClawStage; return s.debugProng() < 0.1 && s.debugVisual().close > 0.3 })()`,
      '合爪',
    )
    if (await liftWait) await shoot('提起')
    else check('等得到「提起」那一刻', false, liftExpr)
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
      /*
        ★ 量的是**这一局最深到哪**（`min hubY`），不是「合爪那一帧」。
          掉帧时 `pickFrames` 的 `closed` 可能落到「提起」中段（第一个
          close>0.85 的帧已经是半空中）—— 实测 hubY=0.734 报红，而同一局的
          `min hubY` 是 0.16。那红的是采样，不是产品。
      */
      pileFrames.length > 0 && Math.min(...pileFrames.map((f) => f.hubY)) <= 0.46,
      `最深 hubY=${pileFrames.length ? Math.min(...pileFrames.map((f) => f.hubY)).toFixed(3) : '—'}（合爪帧 ${pC?.hubY.toFixed(3) ?? '—'}）`,
    )
    check(
      '★ 对着娃娃那一局：指头同样张到最大再合拢',
      !!pB && !!pC && pB.spread > 0.99 && pB.prong - pC.prong >= 0.6,
      `spread=${pB?.spread.toFixed(2)}，指头 ${pB?.prong.toFixed(2)} → ${pC?.prong.toFixed(2)} rad`,
    )

    /*
      ============ 捏合手感：接触 → 挤压 → 压痕 → 着色器 ============

      原版「抓取很真实」靠的不是动画，是**接触驱动的形变**：
      两根指头压上来 → 整只被横向挤（沿自由轴鼓出来）；
      接触点再在娃娃身上压出手印，指头松开后按 `exp(-12t)` 淡掉。

      三条判据分开量，因为它们会在**不同的地方**断：
        · 指头没碰到 ⇒ `contacts` 永远是 0（碰撞分组 / 指头没开碰撞）；
        · 碰到了但没挤 ⇒ 挤压目标没接上（还是「到点就播动画」）；
        · 算了但没画 ⇒ `physSquash` 有值、`drawnSquash` 是 0（uniform 没喂）。
    */
    const grips = pileFrames.map((f) => f.grip).filter(Boolean)
    /*
      ★ 用**锁存值**（`peakContacts`），不是采样最大值：
        「三根指头都压住」只持续几帧，headless 采样会漏（tablet 实测漏了）。
    */
    const peakContacts = grips.length ? Math.max(...grips.map((g) => g.peakContacts ?? g.contacts)) : 0
    const minSquash = grips.length ? Math.min(...grips.map((g) => g.drawnSquash)) : 0
    const peakDent = grips.length ? Math.max(...grips.map((g) => g.dentW)) : 0
    /*
      ★ 「会淡掉」只能量**最后一次接触之后**的尾巴。
        整段取 min 的话，下爪之前那几帧本来就是 0 —— 那条断言会恒真。
      ★ 判「还在捏着」用 `contacts > 0 || dentW > 0.002`：压痕比接触点活得久
        （`exp(-12t)`），采样漏掉接触帧时它还能兜住。
    */
    let lastContact = -1
    for (let i = 0; i < grips.length; i++) if (grips[i].contacts > 0 || grips[i].dentW > 0.002) lastContact = i
    const tailDent = lastContact >= 0 && lastContact < grips.length - 1 ? Math.min(...grips.slice(lastContact + 1).map((g) => g.dentW)) : peakDent
    // 同一帧里「物理算出来的」和「喂给着色器的」必须**逐位相同**（同一帧同一个值）
    const mismatch = grips.filter((g) => Math.abs(g.drawnSquash - g.physSquash) > 1e-6 || Math.abs(g.dentW - g.dentPhys) > 1e-6)
    check(
      '★★ 合爪时娃娃真的被指头捏住（≥2 根指头 + 整只被挤）',
      peakContacts >= 2 && minSquash <= -0.04,
      `最多 ${peakContacts} 根指头 / 挤压最负 ${minSquash.toFixed(3)}（目标 −0.07）`,
    )
    check(
      '★ 指头在娃娃身上压出手印，松爪后会淡掉',
      peakDent > 0.002 && tailDent < peakDent * 0.25,
      `最深 ${(peakDent * 1000).toFixed(1)}mm → 松爪后 ${(tailDent * 1000).toFixed(1)}mm`,
    )
    check(
      '★★ 挤压 / 压痕真的传到了着色器（不是「算了但没画」）',
      grips.length > 0 && mismatch.length === 0,
      mismatch.length ? `${mismatch.length}/${grips.length} 帧对不上` : `${grips.length} 帧逐位一致`,
    )
    check(
      '★ 对照组：还没下爪时没有任何指头接触（否则上面两条恒真）',
      /*
        ★ 判「可以忽略」，不是判「恰好是 0」：弹簧和压痕都是指数衰减，
          永远剩一点浮点残渣（实测 squash 1.2e-8 / dent 5.6e-15）。
          写 `=== 0` 会红，而那是**数学**没错 —— 不是产品有问题。
      */
      !!idleGrip && idleGrip.contacts === 0 && idleGrip.dentW < 1e-4 && Math.abs(idleGrip.drawnSquash) < 1e-3,
      idleGrip ? `contacts=${idleGrip.contacts} dent=${idleGrip.dentW.toExponential(1)} squash=${idleGrip.drawnSquash.toExponential(1)}` : '拿不到 debugGrip()',
    )

    /*
      ⚠️ 这里本来还有一条「一局演完、爪子回到瞄准点之后是竖直的」。

      写完之后做变异验证（把 `ClawPage` 的瞬移守卫关掉），**它照样绿**
      —— 因为 `clawCarriageAccel` 每帧都把 `s.x` 归位，跳变只影响一帧，
      给摆动的是「正反各一下、净冲量≈0」的双脉冲（1.8°，半秒就衰减没了）。
      ➜ 一条**不可能红**的判据没有价值，删掉。守卫本身保留（瞬移不该有加速度）。
    */

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
