/**
 * 任务计时器「暂停 / 恢复」走查（客户反馈）。
 *
 * 用法：node scripts/e2e-timer-pause.mjs [url] [viewport]
 *   例：node scripts/e2e-timer-pause.mjs http://127.0.0.1:4180/ phone
 *
 * ------------------------------------------------------------
 * 为什么单开一份，而不是塞进 `e2e-check.mjs`
 *
 * `e2e-check.mjs` 有 2000+ 行、按页面组织，加一条要在中间插一大段，
 * 改坏它的风险比这个功能本身还大。而这一条有**自己的盲区**：
 *
 *   ★ 单测能证明 `runningMs()` 算得对，**证明不了按钮画出来了**。
 *     这个项目已经踩过好几次「逻辑对、UI 没接上」——
 *     最典型的是「重做卡片上那个『▶️ 开始』是个点了没反应的死按钮」。
 *     所以这里只干一件事：**在真浏览器里点那个按钮，看秒表会不会冻住**。
 *
 * ★★ 判据是「秒表数字**不再变化**」，不是「按钮文案变成了『继续』」
 *
 *   文案是最容易假通过的东西：把 `paused` 算错、按钮却照着文案渲染，
 *   一样会显示「▶️ 继续计时」。所以：
 *     ① 暂停后连采 3 次秒表，三次必须**完全相同**（冻住）；
 *     ② 对照组：暂停**之前**同样连采 3 次，必须**至少变过一次**
 *        —— 否则说明这个探针压根读不到一个在走的秒表，
 *        那「冻住」就是探针坏了，不是功能对了。
 *
 *   ⚠️ 秒表精度是**秒**，所以采样间隔要 > 1s 才有机会看到变化。
 *      对照组用 1.4s × 3 次，实测足够。
 */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { makeProfileDir, SCRATCH_BASE } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4180/'
const VIEWPORT = process.argv[3] ?? 'phone'
/** 走查图集落盘位置。⚠️ 放 `.e2e-scratch/`（项目同盘），别用系统临时目录 */
const OUT = join(SCRATCH_BASE, 'timer-pause')

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

const VIEWPORTS = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
}
const vp = VIEWPORTS[VIEWPORT] ?? VIEWPORTS.phone

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `  — ${detail}` : ''}`)
  if (!ok) failed++
}

mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir('kqf-timer'),
  args: ['--no-first-run', '--no-default-browser-check', '--disable-gpu'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ ...vp, deviceScaleFactor: 1 })
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await dismissOnboarding(page)
  await page.waitForFunction(() => !!window.__kqf__, { timeout: 10000 })

  console.log(`\n任务计时器暂停 / 恢复（${VIEWPORT} ${vp.width}×${vp.height}）\n`)

  /** 走查图：失败时也能对着图看是哪一步不对 */
  const shot = (n) => page.screenshot({ path: join(OUT, `${VIEWPORT}-${n}.png`) })

  /* ---- ① 起一张计时中的卡 ----
     ⚠️ 走 store 的 `startTimer`（真函数），不点按钮 ——
     卡片上的「▶️ 开始」在不同状态下位置会变，用坐标点太脆。
     这里要验的是**暂停按钮**，不是开始按钮。 */
  const started = await page.evaluate(async () => {
    const k = window.__kqf__
    const inst = k.getState().instances.find((i) => i.status === 'pending' && i.cycle === 'daily')
    if (!inst) return null
    await k.getState().startTimer(inst.id)
    return inst.id
  })
  check('找得到一张待完成的每日任务并开始计时', !!started, started ?? '没找到')

  if (!started) throw new Error('起不了计时，后面的都验不了')

  await sleep(600)
  await shot('1-running')

  /* ---- ② 秒表读数的取法 ----
     卡片上的秒表就是 `mm:ss` 文本。用 `data-testid="card-timer-toggle"`
     的**前一个兄弟**去定位，比全局搜 `/\d\d:\d\d/` 稳 ——
     详情页里也可能有别的 `mm:ss`。 */
  const readClock = () =>
    page.evaluate(() => {
      const btn = document.querySelector('[data-testid="card-timer-toggle"]')
      if (!btn) return null
      const row = btn.parentElement
      const span = row?.querySelector('span.tnum')
      return span ? (span.textContent ?? '').trim() : null
    })

  const toggleLabel = () =>
    page.evaluate(() => {
      const btn = document.querySelector('[data-testid="card-timer-toggle"]')
      return btn ? (btn.textContent ?? '').trim() : null
    })

  /* ---- ③ 对照组：暂停**之前**秒表必须真的在走 ----
     没有这一步的话，「冻住」可能只是因为探针读不到东西（读到 null 也是"不变"）。 */
  const before = []
  for (let i = 0; i < 3; i++) {
    before.push(await readClock())
    if (i < 2) await sleep(1400)
  }
  const movedBefore = before[0] != null && before.some((v) => v !== before[0])
  check(
    '对照组：暂停前秒表在走（读数至少变过一次）',
    movedBefore,
    `采样 ${JSON.stringify(before)}`,
  )

  /* ---- ④ 点「暂停」 ---- */
  const pausedLabelBefore = await toggleLabel()
  await page.click('[data-testid="card-timer-toggle"]')
  await sleep(800)

  const pausedLabelAfter = await toggleLabel()
  check(
    '点一下就切到「继续」（按钮文案变了）',
    pausedLabelAfter != null && pausedLabelAfter !== pausedLabelBefore,
    `${pausedLabelBefore} → ${pausedLabelAfter}`,
  )

  /* ---- ⑤ 核心判据：秒表冻住 ----
     连采 3 次、间隔 1.4s（> 秒表精度 1s），三次必须**逐字相同**。 */
  const during = []
  for (let i = 0; i < 3; i++) {
    during.push(await readClock())
    if (i < 2) await sleep(1400)
  }
  const frozen = during[0] != null && during.every((v) => v === during[0])
  check(
    '★ 暂停期间秒表冻住（连采 3 次逐字相同，间隔 1.4s）',
    frozen,
    `采样 ${JSON.stringify(during)}`,
  )
  await shot('2-paused')

  /* ---- ⑥ 落库也必须是暂停态（不是只有 UI 冻住） ---- */
  const dbPaused = await page.evaluate((id) => {
    const inst = window.__kqf__.getState().instances.find((i) => i.id === id)
    return inst ? { pausedAt: inst.pausedAt ?? null, total: inst.pausedTotalMs ?? 0 } : null
  }, started)
  check('库里 `pausedAt` 有值（暂停落库了）', !!dbPaused?.pausedAt, JSON.stringify(dbPaused))

  /* ---- ⑦ 点「继续」→ 秒表重新走起来 ---- */
  await page.click('[data-testid="card-timer-toggle"]')
  await sleep(800)

  const afterResume = []
  for (let i = 0; i < 3; i++) {
    afterResume.push(await readClock())
    if (i < 2) await sleep(1400)
  }
  const movedAfter = afterResume[0] != null && afterResume.some((v) => v !== afterResume[0])
  check(
    '★ 点「继续」之后秒表重新走（读数至少变过一次）',
    movedAfter,
    `采样 ${JSON.stringify(afterResume)}`,
  )

  /* ---- ⑦b 恢复的瞬间不能往回跳 ----
     ⚠️ 这条是**实测抓到的真 bug**，不是防御性写法。
     暂停期间 `useLiveSeconds` 的 effect 提前 return，内部 `now` 冻在最后一次
     心跳（最多 1 秒前）；恢复时若不对表，`runningMs` 会拿这个陈旧参照点
     去减刚累加的 `pausedTotalMs` ⇒ 秒表**倒退**。
     实测过一次：暂停 `00:03` → 恢复第一帧 `00:00`，孩子看到的是"时间被清零"。

     只断言「读数变了」是抓不到的 —— `00:03 → 00:00` 也算「变了」。 */
  const toSec = (v) => {
    const [m, s] = String(v).split(':').map(Number)
    return m * 60 + s
  }
  const pausedSec = during[0] != null ? toSec(during[0]) : null
  const resumedSec = afterResume[0] != null ? toSec(afterResume[0]) : null
  check(
    '★ 恢复后第一帧不会倒退（≥ 暂停时的读数）',
    pausedSec != null && resumedSec != null && resumedSec >= pausedSec,
    `${during[0]} → ${afterResume[0]}`,
  )
  await shot('3-resumed')

  /* ---- ⑧ 累计暂停时长必须真的记下来 ----
     ⚠️ 断言的是「> 0」而不是某个具体秒数：跑批机器慢，
     从点击到落库的延迟不可控。这里只钉「暂停被记账了」。 */
  const afterTotal = await page.evaluate((id) => {
    const inst = window.__kqf__.getState().instances.find((i) => i.id === id)
    return inst ? { pausedAt: inst.pausedAt ?? null, total: inst.pausedTotalMs ?? 0 } : null
  }, started)
  check('恢复后 `pausedAt` 被清掉', afterTotal?.pausedAt == null, JSON.stringify(afterTotal))
  check(
    '★ 暂停时长被累加进 `pausedTotalMs`（> 0）',
    (afterTotal?.total ?? 0) > 0,
    `${afterTotal?.total} ms`,
  )

  /* ---- ⑨ 详情页里也有暂停按钮（两条路都要有） ---- */
  await page.evaluate(() => {
    const card = document.querySelector('[data-testid="card-timer-toggle"]')?.closest('div.surface')
    const openBtn = [...(card?.querySelectorAll('button') ?? [])].find((b) =>
      (b.textContent ?? '').includes('我做完啦'),
    )
    openBtn?.click()
  })
  await sleep(900)
  const detailHasToggle = await page.evaluate(
    () => !!document.querySelector('[data-testid="timer-toggle"]'),
  )
  await shot('4-detail')
  check('任务详情页里也有暂停 / 继续按钮', detailHasToggle)
} finally {
  await browser.close()
}

console.log(
  failed === 0
    ? '\n✅ 任务计时器暂停 / 恢复：全部通过\n'
    : `\n❌ 有 ${failed} 条没过\n`,
)
process.exit(failed === 0 ? 0 : 1)
