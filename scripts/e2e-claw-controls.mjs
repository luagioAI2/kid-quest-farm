/**
 * 娃娃机的「操作 + 换色 + 渲染效果」走查。
 *
 * 用法：node scripts/e2e-claw-controls.mjs [url] [viewport]
 *   例：node scripts/e2e-claw-controls.mjs http://127.0.0.1:4391/ phone
 *
 * ------------------------------------------------------------
 * ★★ 为什么每个判断都要走 `debugVisual()` 而不是截图
 *
 * 「爪子动了」在截图上很难量：柜子在画面里只有几百像素，移动 0.2 个世界单位
 * 大约十几个像素，还要和抖动混在一起。而 `debugVisual()` 给的是**这一帧
 * 真正传进渲染的 `clawX / clawZ`** —— 直接断言数字，方向错了立刻红。
 *
 * ★★ 两条最容易写错、而且「看着像对的」的地方
 *
 * ① **上下方向**：`fieldFromScreen` 里屏幕往下 = 世界 z **变大**，
 *    所以「上」必须是 `z: -1`。写反了拖动瞄准还是对的（它走屏幕坐标），
 *    只有摇杆/键盘会上下颠倒 —— 只看代码看不出来。
 * ② **松手要停**：`setPointerCapture` 之后，手指滑出按钮范围时 `pointerup`
 *    仍然会派发到按钮上；但**没有** capture 或者只监听 `onPointerLeave`
 *    就会「松手了还在走」。断言方式：抬起后再连采两次，必须**完全相同**。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir, SCRATCH_BASE } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4391/'
const VIEWPORT = process.argv[3] ?? 'phone'

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

const SIZES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
}
const size = SIZES[VIEWPORT]
if (!size) {
  console.error(`不认识的视口：${VIEWPORT}（可选 ${Object.keys(SIZES).join(' / ')}）`)
  process.exit(2)
}

const OUT = join(SCRATCH_BASE, 'claw-controls')
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\n娃娃机操作 / 换色 / 渲染走查（${VIEWPORT} ${size.width}×${size.height}）`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir(`claw-controls-${VIEWPORT}`),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

/**
 * 等「主界面真的出来了」。
 * ⚠️ 不能用 `!!window.__kqf__` 当信号 —— 它比入场页还早（见 REFERENCE 的验收探针 §七）。
 */
const waitForApp = (p) =>
  p.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 25000 })

await page.setViewport({ ...size, deviceScaleFactor: 1 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await waitForApp(page)
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__, { timeout: 10000 })

/* ---- 进娃娃机 ---- */
await page.evaluate(async () => {
  await window.__kqf__.unlockClaw()
})
await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 })
await waitForApp(page)
await page.waitForFunction(() => !!window.__kqf__, { timeout: 20000 })

const tabOk = await page.evaluate(() => {
  const b = document.querySelector('[data-tour="tab-claw"]')
  if (!b) return false
  b.click()
  return true
})
check('底部导航有娃娃机那一格', tabOk)
const stageOk = await page
  .waitForFunction(() => !!document.querySelector('[data-claw-stage]'), { timeout: 25000 })
  .then(() => true, () => false)
check('娃娃机页面挂起来了', stageOk)
if (!stageOk) {
  await browser.close()
  console.log(`\n❌ 有 ${failed + 1} 条没过\n`)
  process.exit(1)
}
await wait(900)

/* ================= ① 渲染效果：写了 ≠ 开着 ================= */

const fx = await page.evaluate(() => window.__kqfClawStage?.debugEffects() ?? null)
check('阴影渲染真的开着', !!fx?.shadows, String(fx?.shadows))
check(
  '★ 真的有 mesh 在投影（不是只开了开关）',
  (fx?.shadowCasters ?? 0) > 0,
  `${fx?.shadowCasters} 个`,
)
check('★ 环境贴图挂上了（clearcoat / 玻璃才有东西可反射）', !!fx?.envMap, String(fx?.envMap))
check('后处理链在（暗角 + 颗粒）', !!fx?.post, String(fx?.post))

/* ================= ② 键盘 ================= */

const readAim = () =>
  page.evaluate(() => {
    const v = window.__kqfClawStage?.debugVisual()
    return v ? { x: v.clawX, z: v.clawZ } : null
  })

/** 按住一个键 `ms` 毫秒，然后等一帧让状态落下来 */
async function holdKey(key, ms) {
  await page.keyboard.down(key)
  await wait(ms)
  await page.keyboard.up(key)
  await wait(150)
}

const k0 = await readAim()
check('读得到爪子的瞄准点（`debugVisual` 可用）', !!k0, JSON.stringify(k0))

await holdKey('d', 420)
const kRight = await readAim()
check(
  '★ 键盘 D：爪子往右（x 变大）',
  (kRight?.x ?? 0) > (k0?.x ?? 0) + 0.05,
  `${k0?.x.toFixed(3)} → ${kRight?.x.toFixed(3)}`,
)

await holdKey('a', 420)
const kLeft = await readAim()
check(
  '★ 键盘 A：爪子往左（x 变小）',
  (kLeft?.x ?? 0) < (kRight?.x ?? 0) - 0.05,
  `${kRight?.x.toFixed(3)} → ${kLeft?.x.toFixed(3)}`,
)

await holdKey('s', 420)
const kDown = await readAim()
check(
  '★★ 键盘 S：爪子往**下**（z 变大，不是变小）',
  (kDown?.z ?? 0) > (kLeft?.z ?? 0) + 0.05,
  `${kLeft?.z.toFixed(3)} → ${kDown?.z.toFixed(3)}`,
)

await holdKey('w', 420)
const kUp = await readAim()
check(
  '★★ 键盘 W：爪子往**上**（z 变小）',
  (kUp?.z ?? 0) < (kDown?.z ?? 0) - 0.05,
  `${kDown?.z.toFixed(3)} → ${kUp?.z.toFixed(3)}`,
)

// 松手必须停：连采两次完全相同
const still1 = await readAim()
await wait(400)
const still2 = await readAim()
check(
  '★ 松开键盘后爪子停住（连采两次逐字相同）',
  still1?.x === still2?.x && still1?.z === still2?.z,
  `${still1?.x.toFixed(3)},${still1?.z.toFixed(3)}`,
)

/* ================= ③ 虚拟摇杆（方向键） ================= */

/** 按住某个方向键 `ms` 毫秒再抬起 */
async function holdPad(dir, ms) {
  const box = await page.evaluate((d) => {
    const b = document.querySelector(`[data-claw-dir="${d}"]`)
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  }, dir)
  if (!box) return false
  await page.mouse.move(box.x, box.y)
  await page.mouse.down()
  await wait(ms)
  await page.mouse.up()
  await wait(150)
  return true
}

const p0 = await readAim()
const padFound = await holdPad('右', 420)
check('摇杆上有「右」这颗方向键', padFound)
const pRight = await readAim()
check(
  '★ 摇杆「右」：爪子往右',
  (pRight?.x ?? 0) > (p0?.x ?? 0) + 0.05,
  `${p0?.x.toFixed(3)} → ${pRight?.x.toFixed(3)}`,
)

const p1 = await readAim()
await holdPad('下', 420)
const pDown = await readAim()
check(
  '★★ 摇杆「下」：z 变大（方向没颠倒）',
  (pDown?.z ?? 0) > (p1?.z ?? 0) + 0.05,
  `${p1?.z.toFixed(3)} → ${pDown?.z.toFixed(3)}`,
)

// ★ 松手就停（capture 那条路的回归）
const r1 = await readAim()
await wait(450)
const r2 = await readAim()
check(
  '★ 松开摇杆后爪子停住（不会「松手了还在走」）',
  r1?.x === r2?.x && r1?.z === r2?.z,
  `${r1?.x.toFixed(3)},${r1?.z.toFixed(3)}`,
)

/* ================= ④ 换色 ================= */

const themeBtns = await page.evaluate(
  () => document.querySelectorAll('[data-claw-theme]').length,
)
check('有三颗配色色块', themeBtns === 3, `${themeBtns} 颗`)

await page.click('[data-claw-theme="1"]')
await wait(300)
const t1 = await page.evaluate(() => ({
  scene: window.__kqfClawStage?.themeIndex(),
  stored: window.__kqf__.getState().settings.clawTheme,
}))
check('点「黄」后场景配色变了', t1.scene === 1, `scene=${t1.scene}`)
check('★ 配色写进了设置（不是只改内存）', t1.stored === 1, `settings.clawTheme=${t1.stored}`)
await page.screenshot({ path: join(OUT, `${VIEWPORT}-theme-yellow.png`) })

await page.click('[data-claw-theme="2"]')
await wait(300)
const t2 = await page.evaluate(() => ({
  scene: window.__kqfClawStage?.themeIndex(),
  stored: window.__kqf__.getState().settings.clawTheme,
}))
check('点「青」后场景配色变了', t2.scene === 2, `scene=${t2.scene}`)
await page.screenshot({ path: join(OUT, `${VIEWPORT}-theme-cyan.png`) })

// ★ 刷新后还在（证明落了库，不是只改了内存快照）
await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 })
await waitForApp(page)
await page.waitForFunction(() => !!window.__kqf__, { timeout: 20000 })
const tabAgain = await page.evaluate(() => {
  const b = document.querySelector('[data-tour="tab-claw"]')
  if (!b) return false
  b.click()
  return true
})
check('刷新后还能进娃娃机', tabAgain)
await page.waitForFunction(() => !!document.querySelector('[data-claw-stage]'), { timeout: 25000 })
await wait(700)
const t3 = await page.evaluate(() => ({
  scene: window.__kqfClawStage?.themeIndex(),
  stored: window.__kqf__.getState().settings.clawTheme,
}))
check('★★ 刷新后配色还是「青」（落库了）', t3.scene === 2 && t3.stored === 2, JSON.stringify(t3))

await page.screenshot({ path: join(OUT, `${VIEWPORT}-claw.png`) })

check('全程没有未捕获的页面异常', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()
console.log(
  failed === 0 ? '\n✅ 娃娃机操作 / 换色 / 渲染：全部通过\n' : `\n❌ 有 ${failed} 条没过\n`,
)
console.log(`走查图：${OUT}`)
process.exit(failed === 0 ? 0 : 1)
