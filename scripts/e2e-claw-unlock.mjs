/**
 * `__kqf__.unlockClaw()` 走查 —— 「一句命令就能玩娃娃机」到底成不成立。
 *
 * 用法：node scripts/e2e-claw-unlock.mjs [url] [viewport]
 *   例：node scripts/e2e-claw-unlock.mjs http://127.0.0.1:4391/ phone
 *
 * ------------------------------------------------------------
 * 为什么单独一份：`capture-claw.mjs` 走的是**家长那条 UI 路**（发币 → 买 → 切），
 * 它证明的是「家长能买」。这一份证明的是**调试句柄自己**能用 ——
 * 两者坏掉的原因完全不同（一个是 UI 没接线，一个是句柄写错了）。
 *
 * ★★ 这一份最重要的判据：**刷新之后还算数**
 *
 * 「拥有关系」不是存下来的，是从 `mallLedger` 里那笔 `game_purchase`
 * **派生**的（见 `registry.ts` 的 `purchasedIdsFrom`）。所以句柄只改内存
 * 快照、没真写账本的话，`getState()` 当场看是对的、**刷新就没了** ——
 * 而那种坏法在「只看返回值」的断言下**全绿**。
 * ➜ 所以 ② 断言「刷新后仍拥有」，这是唯一能分开「写了账本」和「只改了内存」的判据。
 *
 * ★ 第二条：**幂等**。连敲两次不该再扣一笔钻石（`unlockClaw` 会补币，
 *   如果补币没放在「未拥有」那一支里，第二次会白发一笔）。
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

const OUT = join(SCRATCH_BASE, 'claw-unlock')
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\nunlockClaw 走查（${VIEWPORT} ${size.width}×${size.height}）`)

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir(`claw-unlock-${VIEWPORT}`),
  // `--enable-unsafe-swiftshader`：没有独显时让 Chrome 回落到软件渲染，
  // 否则 `WebGLRenderer` 构造会抛，娃娃机显示「打不开 3D 画面」那一支。
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))

/**
 * 等「主界面真的出来了」。
 *
 * ★★ 别拿 `!!window.__kqf__` 当这个信号 —— 它在**模块求值**时就挂上了，
 * 比 `boot()` 早，更比入场页早。而入场页有 `SPLASH_MIN_MS = 1900` 的
 * **最短停留**（App.tsx），所以刷新后立刻查 DOM 会查到**入场页**：
 * 里面一个 `nav button` 都没有、一个 `data-tour` 都没有。
 * 实测踩过：刷新后等 1500ms（差 400ms）→ 底部导航「凭空消失」，
 * 看着像 `unlockClaw` 把界面搞坏了，真因是**还在入场页**。
 * ➜ 判据就是 `nav button` 出现（它只可能在主界面里）。
 */
const waitForApp = (p) =>
  p.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 25000 })

await page.setViewport({ ...size, deviceScaleFactor: 1 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await waitForApp(page)
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__, { timeout: 10000 })

/** 把 store 里跟这次走查有关的那几个字段捞出来 */
const snap = () =>
  page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      owned: s.ownedGameIds,
      active: s.activeGameId,
      mall: s.mallBalance,
      coins: s.clawCoins,
      balance: s.balance,
      price: (window.__kqf__.games() ?? []).find((g) => g.id === 'claw')?.priceMall ?? 0,
    }
  })

/* ---- ① 对照组：干净账号上娃娃机**不该**是能玩的 ---- */
/*
  首装会送 500 钻石（2026-10-17 的种子，见 `useApp.doSeedIfEmpty`）。
  这条走查验的是「cheat 路径**只补差价**、不发冤枉钱」，前提是「干净账号余额 = 0」。
  所以先把种子送的那 500 抹平（走 `mintMall(-余额)`，和真人扣回同一条路），
  不然后面「买完刚好归零」「第二次仍是 0」会变成 380 —— 那是种子生效了，不是功能坏了。
*/
await page.evaluate(async () => {
  const k = window.__kqf__
  const bal = k.getState().mallBalance
  if (bal !== 0) await k.getState().mintMall(-bal)
})
const before = await snap()
check(
  '对照组：干净账号还没拥有娃娃机',
  !before.owned.includes('claw'),
  `owned=[${before.owned.join(',')}] 钻石=${before.mall} 币=${before.coins}`,
)
check('对照组：钻石是 0（所以「家长能买」这条路本来走不通）', before.mall === 0, `${before.mall}`)

/* ---- ② 敲那一句 ---- */
const logs = []
page.on('console', (m) => logs.push(m.text()))
const after = await page.evaluate(async () => {
  await window.__kqf__.unlockClaw()
  const s = window.__kqf__.getState()
  return {
    owned: s.ownedGameIds,
    active: s.activeGameId,
    mall: s.mallBalance,
    coins: s.clawCoins,
    balance: s.balance,
  }
})

check('★ 娃娃机进了「已购买」', after.owned.includes('claw'), `owned=[${after.owned.join(',')}]`)
check('★ 「当前游戏」切成了娃娃机', after.active === 'claw', after.active)
check('★ 发了 20 个娃娃机币', after.coins === 20, `${after.coins} 个`)
check(
  '★ 补了 500 积分',
  after.balance === before.balance + 500,
  `${before.balance} → ${after.balance}`,
)
check(
  '买完钻石刚好归零（只补了差价，没有白发）',
  after.mall === 0,
  `补 ${before.price} → 买花 ${before.price} → 余 ${after.mall}`,
)

/* ---- ③ ★★ 刷新之后还算数（证明「写了账本」而不是「只改了内存」） ---- */
await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 })
// ⚠️ 必须等入场页过去（见 `waitForApp` 的注释）—— 否则下面查 DOM 全落空
await waitForApp(page)
await page.waitForFunction(() => !!window.__kqf__, { timeout: 20000 })
const reloaded = await snap()
check(
  '★★ 刷新后仍然拥有（拥有关系是从账本派生的，扛得住 reload）',
  reloaded.owned.includes('claw'),
  `owned=[${reloaded.owned.join(',')}]`,
)
check('★★ 刷新后「当前游戏」还是娃娃机', reloaded.active === 'claw', reloaded.active)
check('★★ 刷新后娃娃机币还在（币在 `gameKv` 里）', reloaded.coins === 20, `${reloaded.coins} 个`)

/* ---- ④ 幂等：再敲一次不该再扣钻石 ---- */
const twice = await page.evaluate(async () => {
  await window.__kqf__.unlockClaw()
  const s = window.__kqf__.getState()
  return { mall: s.mallBalance, owned: s.ownedGameIds, active: s.activeGameId }
})
check(
  '★ 幂等：已拥有时不再发钻石（第二次跑余额仍是 0）',
  twice.mall === 0 && twice.owned.includes('claw'),
  `钻石=${twice.mall}`,
)
check('幂等：不会掉出「已购买」', twice.owned.includes('claw'), `owned=[${twice.owned.join(',')}]`)

/* ---- ⑤ 底部导航真的多出那一格，切过去真的挂得起来 ---- */
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
check('娃娃机页面挂起来了（懒加载的 three.js chunk 到位）', stageOk)

if (stageOk) {
  await wait(900)
  const stage = await page.evaluate(() => {
    const st = window.__kqfClawStage
    const el = document.querySelector('[data-claw-stage]')
    return {
      hasStage: !!st,
      canvas: !!el?.querySelector('canvas'),
      prizes: st?.prizeCount?.() ?? -1,
    }
  })
  check('场景对象建起来了（`__kqfClawStage`）', stage.hasStage)
  check('canvas 在容器里', stage.canvas)
  check('池子里有娃娃（画面不是空的）', stage.prizes > 0, `${stage.prizes} 只`)
} else {
  const fallback = await page.evaluate(() => document.body.innerText.includes('打不开 3D 画面'))
  check('★ 不是「打不开 3D 画面」那一支', !fallback, fallback ? 'WebGL 起不来' : '')
}

await page.screenshot({ path: join(OUT, `${VIEWPORT}-claw.png`), fullPage: false })

check('全程没有未捕获的页面异常', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '))

await browser.close()

console.log(
  failed === 0
    ? '\n✅ unlockClaw：全部通过\n'
    : `\n❌ 有 ${failed} 条没过\n`,
)
console.log(`走查图：${join(OUT, `${VIEWPORT}-claw.png`)}`)
process.exit(failed === 0 ? 0 : 1)
