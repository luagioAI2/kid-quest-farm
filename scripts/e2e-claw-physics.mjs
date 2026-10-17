/**
 * 娃娃机**物理层**走查。
 *
 * 用法：node scripts/e2e-claw-physics.mjs [url] [viewport]
 *   例：node scripts/e2e-claw-physics.mjs http://127.0.0.1:4391/ phone
 *
 * ------------------------------------------------------------
 * ★★ 这个脚本要证明的两件事，一件比一件难
 *
 * ① **物理真的在跑。** 「代码里 new 了一个 World」和「娃娃真的在被推动」
 *    是两件事。这里用 `debugPhysics()` 的 `steps`（在涨）、`awake`
 *    （有刚体醒着）、以及**娃娃的位置真的变了**三样一起证。
 *
 * ② ★★★ **物理没有偷偷判输赢。** 这是本项目的硬不变量（`E < 1`）：
 *    输赢在投币那一刻由 `settleClawRound()` 定死。如果物理也判一次，
 *    就会出现「娃娃明明掉进洞里了，积分却没加」—— 那是印钞机的反面，
 *    而且**零报错**。
 *
 *    断言方式：**掉进通道的娃娃数（`recycled`）必须等于这一局中奖的次数**。
 *      · 中了 → 爪子把它送到洞口松手 → 物理上它掉下去 → recycled +1
 *      · 没中 → 半路滑掉，落回池子 → **recycled 不许变**
 *
 *    如果哪天有人把 `checkPrizes()` 那种「掉进洞就算赢」的逻辑搬过来，
 *    这条断言会在「没中但娃娃滚进洞」时立刻红。
 *
 * ------------------------------------------------------------
 * ⚠️ 为什么要改中奖率
 *
 * 默认中奖率是 1/3。要在一次走查里同时看到「中」和「没中」两条路径，
 * 光靠默认值会跑很多局（每局 4.2 秒）。所以：先在默认值下跑几局（几乎必然
 * 碰到「没中」，能验滑落），再把中奖率临时调到 0.8 逼出一局「中」。
 *
 * 0.8 仍然是安全的（`E = 0.8 × 1 = 0.8 < 1`，见 `clawEconomy.ts`），
 * 而且这个 profile 是脚本专用的，跑完不影响任何人。
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

const OUT = join(SCRATCH_BASE, 'claw-physics')
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\n娃娃机物理走查（${VIEWPORT} ${size.width}×${size.height}）`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir(`claw-physics-${VIEWPORT}`),
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

/** 等「主界面真的出来了」（不能用 `!!window.__kqf__`，它比入场页还早）。 */
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

/* ================= ① 物理到底起来没有 ================= */

/*
  ★ 必须区分 `loading` / `failed` / `ready`。
    只看「有没有报错」是不够的 —— 动态 import 失败会被 catch 掉，
    页面照样能玩（退回静态摆放），所以**没有报错也可能是没物理**。
*/
const physState = await page
  .waitForFunction(
    () => {
      const s = window.__kqfClawStage?.debugPhysics?.()
      return s && (s.state === 'ready' || s.state === 'failed') ? s.state : false
    },
    { timeout: 30000, polling: 100 },
  )
  .then((h) => h.jsonValue())
  .catch(() => 'timeout')

const phys0 = await page.evaluate(() => window.__kqfClawStage?.debugPhysics?.() ?? null)
check('★ 物理层起来了（Rapier 动态 import 成功）', physState === 'ready', `state=${physState}`)
if (physState !== 'ready') {
  console.log(`      失败原因：${phys0?.error || '(超时，可能是 chunk 没加载完)'}`)
  await browser.close()
  console.log(`\n❌ 物理没起来，后面的断言没有意义\n`)
  process.exit(1)
}

const prizeCount = await page.evaluate(() => window.__kqfClawStage?.prizeCount() ?? -1)
check(
  '★ 每只娃娃都有刚体（数量对得上）',
  phys0?.bodies === prizeCount && prizeCount > 0,
  `刚体 ${phys0?.bodies} / 娃娃 ${prizeCount}`,
)

/* ================= ② 物理真的在推进 ================= */

const stepsA = (await page.evaluate(() => window.__kqfClawStage?.debugPhysics?.().steps)) ?? 0
await wait(700)
const stepsB = (await page.evaluate(() => window.__kqfClawStage?.debugPhysics?.().steps)) ?? 0
check('★ 世界真的在 step（不是只建了个 World）', stepsB > stepsA, `${stepsA} → ${stepsB} 步`)

const awake = (await page.evaluate(() => window.__kqfClawStage?.debugPhysics?.().awake)) ?? 0
check(
  '★ 有刚体是醒着的（全睡了说明模拟其实停了）',
  awake > 0,
  `${awake} 个醒着`,
)

/* ================= ③ 池子是稳的（没炸 / 没抖） ================= */

/** 读所有娃娃现在的水平位置。`prizeAt` 对掉进通道的返回 null。 */
const readPile = () =>
  page.evaluate(() => {
    const s = window.__kqfClawStage
    const n = s.prizeCount()
    const out = []
    for (let i = 0; i < n; i++) out.push(s.prizeAt(i))
    return out
  })

const pileA = await readPile()
await wait(1300)
const pileB = await readPile()

let maxDrift = 0
let missing = 0
for (let i = 0; i < pileA.length; i++) {
  if (!pileA[i] || !pileB[i]) {
    missing++
    continue
  }
  maxDrift = Math.max(maxDrift, Math.hypot(pileA[i].x - pileB[i].x, pileA[i].z - pileB[i].z))
}
check(
  '★ 空转 1.3 秒后池子是静的（没抖 / 没爆开）',
  maxDrift < 0.05,
  `最大位移 ${maxDrift.toFixed(4)} 世界单位`,
)
check('池子里一只都没少', missing === 0, `缺 ${missing} 只`)

/* ================= ④ 跑几局，验「物理不判输赢」 ================= */

/**
 * 跑一局，返回这一局的结果。
 *
 * ★ `held` 用**页面内的定时采样**，不是 Node 这边轮询 ——
 *   `evaluate` 一次往返 1~3 ms，而「手里有没有东西」的窗口只有 1 秒左右，
 *   往返抖动会让采样漏掉整段。页面内 `setInterval(40ms)` 稳得多。
 */
async function playRound() {
  const before = await page.evaluate(() => window.__kqfClawStage.debugPhysics())
  await page.evaluate(() => {
    window.__physSamples = []
    window.__physTimer = setInterval(() => {
      const d = window.__kqfClawStage?.debugPhysics?.()
      if (d) window.__physSamples.push({ held: d.held, awake: d.awake })
    }, 40)
    // 顺便记一下爪子这一局有没有真的往下走（drop 段 hubY 会变小）
    window.__hubSamples = []
    window.__hubTimer = setInterval(() => {
      const v = window.__kqfClawStage?.debugVisual?.()
      if (v) window.__hubSamples.push(v.hubY)
    }, 40)
  })

  await page.keyboard.press('Space')

  /*
    ★ 先等结果元素**消失**，再等它出现。

    `[data-claw-result]` 在上一局结束后会一直留在 DOM 里（只有 `play()` 开头
    的 `setResult(null)` 会清掉）。直接等「出现」的话，第二局开始的那一瞬间
    就会命中**上一局留下的那个** —— 读到的是上一局的中奖结果，采样也是空的。
    实测症状：第 2、3 局显示「没中、没夹到、hubY 是 ?」，看着像物理没跑，
    其实是脚本在读旧 DOM。
  */
  const cleared = await page
    .waitForFunction(() => !document.querySelector('[data-claw-result]'), { timeout: 4000 })
    .then(() => true, () => false)
  const done =
    cleared &&
    (await page
      .waitForFunction(() => !!document.querySelector('[data-claw-result]'), { timeout: 15000 })
      .then(() => true, () => false))

  const samples = await page.evaluate(() => {
    clearInterval(window.__physTimer)
    clearInterval(window.__hubTimer)
    return { held: window.__physSamples ?? [], hub: window.__hubSamples ?? [] }
  })

  const won = await page.evaluate(() => {
    const el = document.querySelector('[data-claw-result]')
    return el ? el.getAttribute('data-claw-won') === '1' : null
  })

  // 中奖的娃娃要掉进通道 → recycled 才会 +1；给它 1.6 秒走完
  await wait(1600)
  const after = await page.evaluate(() => window.__kqfClawStage.debugPhysics())

  return {
    done,
    won,
    heldSeen: samples.held.some((s) => s.held),
    hubLowest: samples.hub.length ? Math.min(...samples.hub) : NaN,
    recycledDelta: (after?.recycled ?? 0) - (before?.recycled ?? 0),
    recycled: after?.recycled ?? 0,
  }
}

const rounds = []
const MAX_DEFAULT_ROUNDS = 4
for (let i = 0; i < MAX_DEFAULT_ROUNDS; i++) {
  const r = await playRound()
  rounds.push(r)
  console.log(
    `     第 ${i + 1} 局：${r.won ? '中' : '没中'}｜夹到过=${r.heldSeen}｜` +
      `爪子最低 ${Number.isNaN(r.hubLowest) ? '?' : r.hubLowest.toFixed(2)}｜recycled +${r.recycledDelta}`,
  )
  if (!r.done) break
  // 已经同时看到「中」和「没中」就不用再跑了
  if (rounds.some((x) => x.won) && rounds.some((x) => x.won === false)) break
}

/* 还不够一局「中」→ 把中奖率临时拉到 0.8（仍然 E<1）逼一局出来 */
if (!rounds.some((r) => r.won)) {
  await page.evaluate(async () => {
    await window.__kqf__.getState().updateSettings({ clawWinRate: 0.8 })
  })
  for (let i = 0; i < 3 && !rounds.some((r) => r.won); i++) {
    const r = await playRound()
    rounds.push(r)
    console.log(
      `     补第 ${i + 1} 局（中奖率 0.8）：${r.won ? '中' : '没中'}｜` +
        `夹到过=${r.heldSeen}｜recycled +${r.recycledDelta}`,
    )
    if (!r.done) break
  }
}

check('每一局都演完了（结果元素出现）', rounds.every((r) => r.done), `${rounds.length} 局`)

/* ---- 爪子真的抓过东西 ---- */
const grabRounds = rounds.filter((r) => r.heldSeen)
check(
  '★★ 爪子真的夹住过娃娃（球铰建起来了，不是只在半空合爪）',
  grabRounds.length > 0,
  `${grabRounds.length}/${rounds.length} 局夹到过`,
)

/* ---- 爪子真的下到底 ---- */
const lowest = Math.min(...rounds.map((r) => r.hubLowest).filter((v) => !Number.isNaN(v)))
check(
  '★ 爪子真的下到池面附近（不是在上面比划）',
  lowest < 0.6,
  `最低 hubY=${lowest.toFixed(2)}（待命 1.06，池底 0.42）`,
)

/* ---- ★★★ 核心：物理没有自己判输赢 ---- */
const bad = rounds.filter((r) => r.recycledDelta !== (r.won ? 1 : 0))
check(
  '★★★ 掉进通道的娃娃数 == 中奖次数（物理没自己判输赢）',
  bad.length === 0,
  bad.length === 0
    ? rounds.map((r) => `${r.won ? '中' : '没中'}→+${r.recycledDelta}`).join('  ')
    : bad
        .map((r) => `${r.won ? '中' : '没中'} 却 +${r.recycledDelta}`)
        .join(' / '),
)

/* ---- 两条路径都覆盖到了 ---- */
check(
  '这次走查同时看到了「中」和「没中」两条路径',
  rounds.some((r) => r.won) && rounds.some((r) => r.won === false),
  `中 ${rounds.filter((r) => r.won).length} 局 / 没中 ${rounds.filter((r) => r.won === false).length} 局`,
)

/* ================= ⑤ 收尾：池子还是完整的 ================= */

await wait(600)
const finalPile = await readPile()
check(
  '★ 跑完几局后娃娃一只都没丢（掉下去的会被放回池子）',
  finalPile.every((p) => p !== null),
  `${finalPile.filter((p) => p !== null).length}/${finalPile.length} 只在池子里`,
)

const finalPhys = await page.evaluate(() => window.__kqfClawStage?.debugPhysics?.() ?? null)
check('局后手里是空的（球铰拆掉了）', finalPhys?.held === false, String(finalPhys?.held))

await page.screenshot({ path: join(OUT, `${VIEWPORT}-物理走查.png`) })

check('全程没有未捕获的页面异常', pageErrors.length === 0, pageErrors[0] ?? '')

await browser.close()
console.log(
  failed === 0
    ? `\n✅ 娃娃机物理：全部通过\n`
    : `\n❌ 有 ${failed} 条没过\n`,
)
process.exit(failed === 0 ? 0 : 1)
