/**
 * 娃娃机**中奖演出**走查 —— 「蹲下去看取物口」这一段的判据。
 *
 * 用法：node scripts/e2e-claw-door.mjs [url] [phone|tablet]
 *
 * ------------------------------------------------------------
 * ★★ 为什么单独一个脚本
 *
 * 2026-10-18 用户的原话：「抓取了，也不会凑近视角……原版抓中后会蹲下去看取物窗
 * （goDoor()：目标点移到门口，按 0.32×0.34 的窗口重算距离）。我们这边是
 * 『缩到 5% 以内』的极轻推近 —— 完全不是一回事。」
 *
 * 那种「轻轻推近 5%」在**截图缩略图**上和「蹲下去」几乎分不出来 ——
 * 这正是它能活下来的原因。所以判据必须是**数**：
 *
 *   ① 目标点真的移到了取物口（`look.y ≈ pickup.y`，差 < 5cm）
 *      —— 「推近一点」的 `look.y` 还在 0.34 附近，离 −0.52 差 0.86，一眼就红；
 *   ② 相机真的近了很多（蹲下的距离 < 默认机位的 60%）；
 *   ③ 蹲下时窗口里有奖品（`winPrize >= 0` 且 `winShow ≈ 1`）
 *      —— 否则「蹲下去看一个空黑洞」比不蹲更糟；
 *   ④ 3.5 秒后自己站起来（回到 `view`、目标点回到池子）
 *      —— 不回来的话孩子下一局是在取物口的特写里下爪，完全看不见爪子。
 *
 * ⚠️ 全部走 `debugCamera()`，**不比截图**（截图抖动 3~252 B，逐字节比对无效）。
 *
 * ⚠️ 中奖率临时拉到 0.8：仍然安全（`E = 0.8 × 1 = 0.8 < 1`，见 `clawEconomy.ts`），
 *    只为了一次跑到「中」。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SCRATCH_BASE } from './lib/profile.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4391/'
const VIEWPORT = process.argv[3] ?? 'phone'

/* ---------------- 期望值从源码派生（不写死秒数） ---------------- */

/**
 * 「蹲下去停多久」「缓动多长」这两个数只在 `clawScene.ts` 里存在一份。
 *
 * ★ 脚本里再抄一份 `3600` 就是第二个事实源：以后把 `DOOR_HOLD` 从 3.5 调到 2.0，
 *   脚本会**继续按 3.6 秒等**，然后在镜头已经站回去之后量 `mode=view` 而报红 ——
 *   看着像功能坏了，其实是脚本过期了。
 * ★ 读不到就直接抛：常量改名 / 挪文件时，**这一声报错**比一条假红有用得多。
 */
const SCENE_SRC = readFileSync(new URL('../src/features/claw/clawScene.ts', import.meta.url), 'utf8')
function numFromSrc(re, what) {
  const m = SCENE_SRC.match(re)
  if (!m) throw new Error(`没能从 clawScene.ts 读到 ${what} —— 常量改名或挪位置了？`)
  return Number(m[1])
}
const DOOR_HOLD = numFromSrc(/const DOOR_HOLD = ([\d.]+)/, 'DOOR_HOLD')
const DOOR_DUR = numFromSrc(/function animCamTo\([\s\S]{0,120}?dur = ([\d.]+)/, 'animCamTo 的默认时长')

const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
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

const OUT = join(SCRATCH_BASE, 'claw-door')
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\n娃娃机中奖演出走查（${VIEWPORT} ${size.width}×${size.height}）`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir(`claw-door-${VIEWPORT}`),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

await page.setViewport({ ...size, deviceScaleFactor: 1 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 25000 })
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__, { timeout: 10000 })

/* ---- 进娃娃机 ---- */
await page.evaluate(async () => {
  await window.__kqf__.unlockClaw()
})
await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 25000 })
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

/* ---- 默认机位（对照组）---- */
await wait(1200)
const idleCam = await page.evaluate(() => window.__kqfClawStage.debugCamera())
check(
  '默认机位看着池子（目标点在玻璃区里）',
  idleCam.mode === 'view' && idleCam.look.y > 0,
  `mode=${idleCam.mode} look.y=${idleCam.look.y.toFixed(2)} dist=${idleCam.dist.toFixed(2)}`,
)
check(
  '★ 取物口在机身正面下方（和池子不是一回事 —— 这就是必须换目标点的原因）',
  idleCam.pickup.y < -0.3,
  `pickup.y=${idleCam.pickup.y.toFixed(2)}`,
)

/* ---- 中奖率拉到 0.8（仍然 E<1），跑到中为止 ---- */
await page.evaluate(async () => {
  await window.__kqf__.getState().updateSettings({ clawWinRate: 0.8 })
})

/**
 * 等镜头**停下来**：连续两次采样 `dist` / `look.y` / `winShow` 都不再动。
 *
 * ★ 判据只看「稳了没有」，**不看「应该停在哪」** —— 把期望值写进等待条件里，
 *   断言就成了同义反复（等不到就超时，然后拿超时那一刻的数据去比，永远「对」）。
 *   这里超时之后照样把**当时**的机位返回给断言，让断言自己红。
 * ★ `doorHold > 0.3` 用来把「蹲在取物口」和「已经站回池子」两个静止状态分开。
 */
const waitSettled = async (timeout = DOOR_DUR + 2500) => {
  const t0 = Date.now()
  let prev = await page.evaluate(() => window.__kqfClawStage.debugCamera())
  while (Date.now() - t0 < timeout) {
    await wait(80)
    const cur = await page.evaluate(() => window.__kqfClawStage.debugCamera())
    if (
      Math.abs(cur.dist - prev.dist) < 0.003 &&
      Math.abs(cur.look.y - prev.look.y) < 0.003 &&
      Math.abs(cur.winShow - prev.winShow) < 0.003 &&
      cur.doorHold > 0.3
    ) {
      return cur
    }
    prev = cur
  }
  return prev
}

/** 等镜头站回默认机位（超时也把当时的状态返回，交给断言判）。 */
const waitBack = async (timeout = (DOOR_HOLD + DOOR_DUR) * 1000 + 1500) => {
  const t0 = Date.now()
  let cur = await page.evaluate(() => window.__kqfClawStage.debugCamera())
  while (Date.now() - t0 < timeout) {
    if (cur.mode === 'view' && cur.doorHold <= 0 && Math.abs(cur.dist - idleCam.dist) < 0.05) return cur
    await wait(80)
    cur = await page.evaluate(() => window.__kqfClawStage.debugCamera())
  }
  return cur
}

const playRound = async () => {
  await page.evaluate(async () => {
    const k = window.__kqf__
    if (k.getState().balance < 2) await k.addPoints(10)
    await k.getState().buyClawCoin()
  })
  await page.keyboard.press('Space')
  const done = await page
    .waitForFunction(() => !!document.querySelector('[data-claw-result]'), { timeout: 20000 })
    .then(() => true, () => false)
  if (!done) return null
  const won = await page.evaluate(
    () => document.querySelector('[data-claw-result]')?.getAttribute('data-claw-won') === '1',
  )
  /*
    ★★ 等镜头**真的停下来**，不要 `await wait(450)` 这种猜出来的秒数。

    踩过：写 450ms 时量到 `look.y=-0.03 / dist=2.59 / winShow=0.27` —— 那是
    **缓动进行到 44%** 的那一帧（缓动 1.1 秒），三条断言全红，看着像「根本没蹲下去」。
    实际上蹲得好好的，只是脚本读早了；而且缓动时长一改，这个猜的秒数会再错一次。
  */
  if (won) await waitSettled()
  return { won, cam: await page.evaluate(() => window.__kqfClawStage.debugCamera()) }
}

let win = null
for (let i = 0; i < 5 && !win; i++) {
  const r = await playRound()
  if (!r) break
  console.log(`     第 ${i + 1} 局：${r.won ? '中' : '没中'}｜镜头 ${r.cam.mode}｜look.y ${r.cam.look.y.toFixed(2)}`)
  if (r.won) win = r
  else await wait(1200)
}
check('跑到一局「中」（中奖率 0.8）', !!win)
if (!win) {
  await browser.close()
  console.log(`\n❌ 有 ${failed + 1} 条没过\n`)
  process.exit(1)
}

/* ---- ① 目标点移到了取物口 ---- */
const d = win.cam
check(
  '★★ 中奖后目标点移到了**取物口**（不是「把池子推近一点」）',
  Math.abs(d.look.y - d.pickup.y) < 0.05,
  `look.y=${d.look.y.toFixed(2)} vs pickup.y=${d.pickup.y.toFixed(2)}（默认机位是 ${idleCam.look.y.toFixed(2)}）`,
)

/* ---- ② 真的近了很多 ---- */
check(
  '★★ 蹲下去真的近了很多（< 默认机位的 60%）',
  d.dist < idleCam.dist * 0.6,
  `${idleCam.dist.toFixed(2)} → ${d.dist.toFixed(2)}（${Math.round((d.dist / idleCam.dist) * 100)}%）`,
)

/* ---- ③ 窗口里有奖品 ---- */
check(
  '★★ 蹲下去时取物口里**有奖品**（不是空黑洞）',
  d.winPrize >= 0 && d.winShow > 0.9,
  `winPrize=${d.winPrize} winShow=${d.winShow.toFixed(2)}`,
)

await page.screenshot({ path: join(OUT, `${VIEWPORT}-中奖-取物口.png`) })

/* ---- ④ 会自己站起来 ---- */
const back = await waitBack()
check(
  `★★ ${DOOR_HOLD} 秒后自己站回默认机位（下一局要看得见爪子）`,
  back.mode === 'view' && back.look.y > 0 && Math.abs(back.dist - idleCam.dist) < 0.05,
  `mode=${back.mode} look.y=${back.look.y.toFixed(2)} dist=${back.dist.toFixed(2)}`,
)
check(
  '★ 站回去之后窗口里那只奖品已经收走了（不会浮在柜门外）',
  back.winPrize < 0,
  `winPrize=${back.winPrize}`,
)

check('全程没有未捕获的页面异常', pageErrors.length === 0, pageErrors[0] ?? '')

await browser.close()
console.log(failed === 0 ? '\n✅ 中奖演出：全部通过\n' : `\n❌ 有 ${failed} 条没过\n`)
process.exit(failed === 0 ? 0 : 1)
