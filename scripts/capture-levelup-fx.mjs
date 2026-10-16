/**
 * 升级特效走查 + 结构自检。
 *
 * 用法：node scripts/capture-levelup-fx.mjs [url] [outDir]
 *
 * 为什么单独一份：升级横幅只在「等级跳一级」那一刻存在 1800ms，
 * `e2e-check.mjs` / `e2e-gameplay.mjs` 都只断言**结果**（产出进背包、账本对上），
 * 没有任何一个断言过**画面上发生了什么**。和 `capture-sky.mjs` /
 * `capture-harvest-fx.mjs` / `capture-animals.mjs` 是同一类补盲区脚本。
 *
 * ------------------------------------------------------------
 * ★★ 探针**不能**照抄 `capture-harvest-fx.mjs` 的写法：
 *
 *   收获特效挂在**一块地**里，所以问「最上层还在不在这块地里」是个**强**问题
 *   （地块只有 115px，别的东西很容易闯进来）。
 *
 *   升级横幅挂在**页面根节点**里 —— 同样的问法会退化成
 *   「最上层还在不在这个页面里」，而那**几乎恒真**，等于没测。
 *   守卫变弱比变红更危险（本项目踩过：正则烂掉了照样全绿）。
 *
 *   所以这里换个问法：把横幅**临时设成可命中**（`pointer-events:auto`，
 *   只影响量、不改版面），再看 `elementsFromPoint` 的栈里
 *   「第一个属于横幅的元素」排在第几位：
 *
 *     第 0 位   → 它就是最上层，没有任何东西盖住它
 *     第 >0 位  → 它前面那些元素在它**上面**，那就是遮挡物
 *
 *   ⚠️ 横幅**本身**必须保持 `pointer-events:none`（升级那一刻孩子很可能正在
 *      连点下一块地，挡住点击是 bug）—— 所以脚本**先断言这一点**，
 *      再临时改掉它来量，量完立刻还原。
 *
 * ★ 探针自己也要防「恒绿」：动画中途**临时盖一层全屏遮罩**再采样，
 *   要求可见率掉到 0%；拿掉之后回到 100%。掉不下来 = 探针坏了，
 *   而不是特效是好的。这条自检让「探针烂掉」和「特效被盖住」不会长得一样。
 *
 * ★ 「解锁了哪几种种子」不写死在脚本里，**问应用**（`__kqf__.catalog.cropsUnlockedAt`）。
 *   这条只证明**接线**：界面上的字 == 领域函数算出来的字。
 *   函数本身对不对由 `src/domain/economy.test.ts` 的 E 节钉住。
 *
 * ★ 升级是**走 store 驱动**的（`getState().harvest(i)`），不是点 UI。
 *   原因是 UI 路径会弹「当场卖 / 收进背包」的弹层，那个遮罩正好盖在
 *   横幅上面（横幅竖直居中）—— 采到的会是「被弹层盖住」而不是「特效坏了」。
 *   **UI 收获那条路已经有走查**（`capture-harvest-fx.mjs` 全程点 UI），
 *   而且两条路改的是同一个事实（`farmTotals.harvests`），特效看到的一模一样。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? '.e2e-scratch/levelup-fx'

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

const CROP = 'carrot'
/** 升级横幅的存活时长 —— 必须和 `farm.css` 的 `kqf-levelup-in` + `useLevelUpBurst` 一致 */
const FX_MS = 1800

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
]

for (const vp of VIEWPORTS) {
  console.log(`\n══ ${vp.name} ${vp.width}×${vp.height} ══`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`capture-levelup-fx-${vp.name}`),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 })
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await dismissOnboarding(page)
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })

  // 积分给够（种地要花种子钱），关随机事件（产量确定），把时钟拧快
  await page.evaluate(async () => {
    await window.__kqf__.addPoints(3000)
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
  })

  // 切到农场页（App 默认开在「任务」页，别假设）
  await page.evaluate(() => document.querySelector('[data-tour="tab-farm"]')?.click())
  await page.waitForFunction(() => !!document.querySelector('[data-sky-scene]'), { timeout: 15000 })
  await wait(500)

  /* ---- 对照组：还没升级之前，页面上**不该有**横幅 ----
     没有这一条，下面「找得到横幅」的断言就是空的（恒真的风险）。 */
  check(
    '对照组：升级之前页面上没有升级横幅',
    (await page.$('[data-farm-fx="levelup"]')) === null,
  )

  /** 读顶栏上的等级和进度（**锚点是 data 属性**，不是文本正则） */
  async function readLevel() {
    return page.evaluate(() => {
      const lv = document.querySelector('[data-farm-level]')
      const pg = document.querySelector('[data-farm-level-progress]')
      if (!lv || !pg) return null
      const level = Number((lv.textContent ?? '').match(/(\d+)/)?.[1])
      const [into, need] = (pg.textContent ?? '').split('/').map((s) => Number(s.trim()))
      if (!Number.isFinite(level) || !Number.isFinite(into) || !Number.isFinite(need)) return null
      return { level, into, need }
    })
  }

  /** 种一茬并等到成熟（时钟 1200×） */
  async function plantMature() {
    const planted = await page.evaluate(async (id) => {
      const st = () => window.__kqf__.getState()
      const empty = st().plots.find((p) => p.unlocked && !p.crop)
      if (!empty) return { ok: false, why: '没有已解锁的空地' }
      return { ok: await st().plant(empty.index, id), index: empty.index }
    }, CROP)
    if (!planted.ok) return planted
    const t0 = Date.now()
    while (Date.now() - t0 < 8000) {
      /* 判据是**地块上印的那句「可以收啦」** —— 和 `capture-harvest-fx.mjs` 同一个锚。
         不拿 `crop.harvestedCount` 之类去推：那要在这里重抄一遍成熟判据，
         成熟规则一改脚本就静默失准。 */
      const ready = await page.evaluate((i) => {
        const grid = document.querySelector('div.grid.grid-cols-3')
        const tile = grid?.querySelectorAll(':scope > button')[i]
        return /可以收啦/.test(tile?.innerText ?? '')
      }, planted.index)
      if (ready) return { ok: true, index: planted.index }
      await wait(250)
    }
    return { ok: false, index: planted.index, why: '等不到成熟' }
  }

  /** 种 + 收（走 store，不弹层）。返回是否成功。 */
  async function harvestOnce() {
    const prep = await plantMature()
    if (!prep.ok) return prep
    const got = await page.evaluate(
      async (i) => {
        try {
          return { ok: true, n: await window.__kqf__.getState().harvest(i) }
        } catch (e) {
          return { ok: false, why: String(e) }
        }
      },
      prep.index,
    )
    if (!got.ok) return got
    await wait(120)
    return { ok: true, index: prep.index }
  }

  /* ============ ① 先把等级推到「再收一次就升级」 ============ */
  const start = await readLevel()
  check('读得到顶栏的等级 / 进度（data 锚点还在）', start !== null, JSON.stringify(start))
  if (!start) {
    await browser.close()
    continue
  }
  console.log(`  · 开局：${start.level} 级，进度 ${start.into}/${start.need}`)

  /* 还差几次升级 = need - into。**不写死次数** —— 等级曲线改了脚本不该跟着改。
     最后一次留给下面的「采样期间收」，因为采样要从收获**之前**就开始。 */
  const remaining = start.need - start.into
  const pre = remaining - 1
  console.log(`  · 还差 ${remaining} 次收获升级，先收 ${pre} 次`)
  for (let i = 0; i < pre; i++) {
    const h = await harvestOnce()
    if (!h.ok) {
      check(`第 ${i + 1} 次预收成功`, false, h.why ?? '')
      break
    }
  }
  const before = await readLevel()
  check(
    '★ 预收阶段**没有**升级（否则下面那次就不是「第一次」了）',
    before !== null && before.level === start.level,
    before ? `${start.level} → ${before.level}（进度 ${before.into}/${before.need}）` : '读不到',
  )

  /* ============ ② 采样期间收最后一次：升级横幅应该出现 ============ */
  console.log('\n【1】收获触发升级，逐帧采样')
  const armed = await plantMature()
  check('种下最后一茬并成熟', armed.ok === true, armed.why ?? '')

  /* ⚠️ **不 await** —— 采样循环要跑 2700ms，而横幅只活 1800ms。
     要拍图就得趁它还在（见下面的截图块）。 */
  const probePromise = page.evaluate(
    async (index, fxMs) => {
      const describe = (el) =>
        el ? `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 2).join('.')}` : '?'

      /** 横幅这一刻是不是最上层？ */
      const sample = () => {
        const fx = document.querySelector('[data-farm-fx="levelup"]')
        if (!fx) return null
        const r = fx.getBoundingClientRect()
        if (r.width < 1 || r.height < 1) return null
        /* ⚠️ 先记下**出厂值**，再临时改成 auto 来量。改的是 style 不是类，
           量完立刻还原 —— 只影响命中测试，不影响版面。 */
        const shippedPE = getComputedStyle(fx).pointerEvents
        const prevInline = fx.style.pointerEvents
        fx.style.pointerEvents = 'auto'

        let top = 0
        let total = 0
        let blocker = null
        for (let i = 1; i <= 6; i++) {
          for (let j = 1; j <= 6; j++) {
            const x = r.left + (r.width * i) / 7
            const y = r.top + (r.height * j) / 7
            if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
            total++
            const stack = document.elementsFromPoint(x, y)
            /* 第一个「是横幅或横幅的一部分」的元素排在第几位 */
            const idx = stack.findIndex((el) => el === fx || fx.contains(el))
            if (idx === 0) top++
            else if (blocker === null && idx > 0) blocker = describe(stack[0])
          }
        }
        fx.style.pointerEvents = prevInline

        const card = fx.firstElementChild
        return {
          pct: total ? Math.round((top / total) * 100) : -1,
          sampled: total,
          blocker,
          shippedPE,
          opacity: card ? Number(getComputedStyle(card).opacity) : 1,
          /* ⚠️ 内容必须**在采样循环里**读 —— 循环要跑 2700ms，而横幅只活 1800ms。
             在循环外面读，读到的永远是 null（第一版就是这么写错的）。 */
          content: {
            level: (fx.querySelector('[data-fx-level]')?.textContent ?? '').replace(/\s+/g, ''),
            unlock: (fx.querySelector('[data-fx-unlock]')?.textContent ?? '').replace(/\s+/g, ''),
            text: (fx.textContent ?? '').replace(/\s+/g, ' ').trim(),
          },
        }
      }

      const frames = []
      let selfTest = null
      let content = null
      let lastSeen = -1
      const t0 = performance.now()
      /* 先**不 await** 地触发收获 —— 采样必须从收获之前就开始，
         否则「横幅出现的第一帧」永远采不到。 */
      const running = window.__kqf__.getState().harvest(index)
      while (performance.now() - t0 < fxMs + 900) {
        const t = Math.round(performance.now() - t0)
        const p = sample()
        if (p) {
          frames.push({ t, ...p })
          lastSeen = t
          /* 抓一帧「已经淡入完成」的内容 —— 入场那几帧本来就是半透明的 */
          if (!content && p.opacity >= 0.95) content = p.content
        }
        /* 自检：横幅完全显示之后临时盖一层全屏遮罩，可见率必须掉到 0%，
           拿掉之后又要回到 100%。 */
        if (!selfTest && t >= 250 && p && p.opacity >= 0.95) {
          const cover = document.createElement('div')
          cover.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.02)'
          document.body.appendChild(cover)
          const during = sample()
          cover.remove()
          selfTest = { during: during?.pct ?? -1, after: sample()?.pct ?? -1 }
        }
        await new Promise((r) => requestAnimationFrame(r))
      }
      try {
        await running
      } catch {
        /* 收获失败由上层断言兜住，这里只保证采样循环一定结束 */
      }

      /* 只看「已经淡入完成」的帧：入场那 12% 本来就是半透明的（设计如此），
         拿它算「被盖住」会得到一个永远存在的假失败。 */
      const settled = frames.filter((f) => f.opacity >= 0.95)
      const worst = settled.length ? settled.reduce((a, b) => (b.pct < a.pct ? b : a)) : null
      return {
        frameCount: frames.length,
        settledCount: settled.length,
        worst,
        selfTest,
        content,
        /* 最后一次看见横幅的时刻（相对触发收获）—— 用来钉「它活多久」 */
        lastSeenMs: lastSeen,
      }
    },
    armed.index,
    FX_MS,
  )

  /* ============ ③ 拍图 —— 趁横幅还在（`kqf-levelup-in` 的 20%~80% 是
     「停住让人看清楚」那一段，即 360~1440ms，取 700ms 稳稳落在里面）。
     不需要冻结动画：这一段本来就是不动的（scale 1 / opacity 1）。 ============ */
  await wait(700)
  const shot = `${OUT}/${vp.name}-levelup.png`
  await page.screenshot({ path: shot })
  console.log(`  · 截图 ${shot}`)

  const probe = await probePromise

  const after = await readLevel()
  check(
    '★ 这一次收获真的升级了（等级 +1）',
    after !== null && before !== null && after.level === before.level + 1,
    after && before ? `${before.level} → ${after.level}` : '读不到',
  )

  const b = probe.worst
  check(
    '★ 横幅出现了（整段动画采到了帧）',
    !!b,
    `采到 ${probe.settledCount} 帧已淡入（共 ${probe.frameCount} 帧）`,
  )
  if (b) {
    check(
      '★★ 整段动画里**每一帧都是最上层**（没有任何东西盖住它）',
      b.pct === 100,
      `最差的一帧在 ${b.t}ms：可见 ${b.pct}%（采样 ${b.sampled} 点）${b.blocker ? ` · 挡住它的是 ${b.blocker}` : ''}`,
    )
    check(
      '★ 横幅**不挡点击**（`pointer-events:none` —— 升级那一刻孩子可能正在连点）',
      b.shippedPE === 'none',
      `实际 ${b.shippedPE}`,
    )
  }
  check(
    '★ 探针自检：盖一层全屏遮罩必须掉到 0%，拿掉又回到 100%（否则探针恒绿）',
    probe.selfTest?.during === 0 && probe.selfTest?.after === 100,
    `遮罩中 ${probe.selfTest?.during}% → 拿掉后 ${probe.selfTest?.after}%`,
  )

  /* ============ ④ 内容对不对（问应用，不写死） ============ */
  const content = probe.content
  if (content && after) {
    check(
      '★ 横幅上写的是**新的**等级',
      content.level === `${after.level}级农场`,
      `实际「${content.level}」`,
    )
    const want = await page.evaluate(
      (lv) => window.__kqf__.catalog.cropsUnlockedAt(lv),
      after.level,
    )
    check(
      `★ 报的解锁种子 == 领域函数算出来的（${want.length} 种）`,
      want.length > 0 && content.unlock === `解锁${want.length}种新种子：${want.join('、')}`,
      `实际「${content.unlock}」· 期望「解锁${want.length}种新种子：${want.join('、')}」`,
    )
  } else {
    check('读得到横幅内容', false, '采样期间没抓到「已淡入」的那一帧')
  }

  /* ★ 存活时长：不能太短（看不清）也不能太长（杵在屏幕上挡着玩）。
     上界 2300ms = 设计的 1800ms + 一个宽松的「卸载晚一点」余量。 */
  check(
    '★ 横幅是**瞬时**的：活到 ~1800ms 就自己消失',
    probe.lastSeenMs >= 1400 && probe.lastSeenMs <= 2300,
    `最后一次看见它是在 ${probe.lastSeenMs}ms`,
  )

  /* ============ ⑤ 采样循环跑完（2700ms）之后，DOM 里必须已经没有它了 ============ */
  check(
    '★ 横幅会自己消失（不是永久留在画面上）',
    (await page.$('[data-farm-fx="levelup"]')) === null,
  )

  /* ============ ⑥ prefers-reduced-motion：动效能停，内容还在 ============ */
  console.log('\n【2】prefers-reduced-motion 下再升一级')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  const rmBefore = await readLevel()
  let rm = null
  if (rmBefore) {
    for (let i = 0; i < rmBefore.need - rmBefore.into; i++) {
      const h = await harvestOnce()
      if (!h.ok) break
    }
    /* 升级发生在最后一次收获里，轮询把它抓住 */
    const t0 = Date.now()
    while (Date.now() - t0 < 2500) {
      const s = await page.evaluate(() => {
        const fx = document.querySelector('[data-farm-fx="levelup"]')
        if (!fx) return null
        const card = fx.firstElementChild
        const spark = fx.querySelector('.anim-sparkle')
        return {
          level: (fx.querySelector('[data-fx-level]')?.textContent ?? '').replace(/\s+/g, ''),
          cardAnim: card ? getComputedStyle(card).animationName : '?',
          cardOpacity: card ? Number(getComputedStyle(card).opacity) : -1,
          sparkAnim: spark ? getComputedStyle(spark).animationName : '?',
          sparkOpacity: spark ? Number(getComputedStyle(spark).opacity) : -1,
        }
      })
      if (s) {
        rm = s
        break
      }
      await wait(60)
    }
  }
  check('reduced-motion 下升级横幅照样出现', rm !== null, rm ? rm.level : '没等到')
  if (rm) {
    check('★ 卡片动效已停（`animation-name: none`）', rm.cardAnim === 'none', rm.cardAnim)
    check('★ 星光动效已停', rm.sparkAnim === 'none', rm.sparkAnim)
    check(
      '★★ 但**内容还在**（减少动效 ≠ 删掉反馈）',
      rm.cardOpacity === 1 && /级农场/.test(rm.level),
      `opacity=${rm.cardOpacity} 文案「${rm.level}」`,
    )
  }

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
