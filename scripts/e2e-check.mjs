/**
 * 端到端验收脚本
 * ------------------------------------------------------------
 * 用真实 Chrome 跑一遍核心流程，捕捉只有运行时才会暴露的问题：
 *   - 控制台报错 / 未捕获异常
 *   - 三个主 Tab 能否渲染
 *   - 任务结算是否能正常入账（积分变化）
 *   - 农场能否种植 / 动物能否领养
 *   - 数据导出是否产出合法 JSON
 *   - 移动端视口下有无横向溢出
 *
 * 用法：node scripts/e2e-check.mjs [url]
 */
import puppeteer from 'puppeteer-core'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { makeProfileDir } from './lib/profile.mjs'
import { qualityLabelRegex, readQualityLabels } from './lib/quality.mjs'
// 币种显示名 / 图标从源码读，不在本脚本里再抄一份 —— 见 currency.mjs 文件头
// （2026-10-16「丰收币 🌾」→「商城币 🎟️」就是抄了第二份的那次事故）
import { COUPON, MALL, POINTS } from './lib/currency.mjs'
import { seedParentPin } from './lib/onboarding.mjs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge，无法执行 E2E')
  process.exit(2)
}

const errors = []
const warnings = []
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  // profile 必须落在项目同盘 —— 系统盘满会让 Chrome 的 IndexedDB 直接罢工，
  // 症状是随机挂在任意一条用例上。见 scripts/lib/profile.mjs 顶部。
  userDataDir: makeProfileDir('check'),
})

try {
  const page = await browser.newPage()
  // iPhone 12 尺寸 —— 目标设备就是手机
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  page.on('console', (msg) => {
    const t = msg.type()
    const text = msg.text()
    if (t === 'error') errors.push(text)
    else if (t === 'warning') warnings.push(text)
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
  page.on('requestfailed', (r) => {
    const u = r.url()
    // 字体等外部资源在离线环境下失败不算问题
    if (!/fonts\.(googleapis|gstatic)/.test(u)) {
      errors.push(`REQFAIL: ${u} ${r.failure()?.errorText ?? ''}`)
    }
  })

  console.log(`\n打开 ${URL}\n`)
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 })

  /* ---------- 1. 启动与渲染 ---------- */
  await page.waitForSelector('#root > *', { timeout: 20000 })
  // 等入场页过去。
  // 判据是「底部导航出现了」—— 导航只存在于主界面，入场页没有它。
  // 以前这里写的是 `!includes('小任务农场') || includes('任务')`，
  // 而入场页里就有「小任务农场」、主界面里到处是「任务」，
  // 两个分支必然有一个成立 → 这个条件**恒为真**，等于没等。
  // 入场页现在有 1.9s 最短停留，靠后面那句固定 1200ms 是等不过去的。
  await page
    .waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
    .catch(() => {})
  await new Promise((r) => setTimeout(r, 1200))

  const bodyText = await page.evaluate(() => document.body.innerText)
  check('页面渲染出内容', bodyText.length > 20, `${bodyText.length} 字符`)
  check('无启动报错', errors.length === 0, errors.slice(0, 3).join(' | '))

  /* ---------- 1b. 新手引导（全新 profile 必经） ----------
     ⚠️ 这一段**必须跑在最前面，而且必须真的把引导走完**。

     全新 profile 里 IndexedDB 是空的、`onboardingDone` 还是 false，
     向导会盖住整个主界面。而下面那些 Tab 检查用的是 DOM 的 `.click()` ——
     它**绕过命中测试**，被盖住也照样点得到，于是所有检查会继续变绿，
     而界面其实根本不能用。所以这里不只看「向导在不在」，
     还要用 elementFromPoint 证明它**真的**挡住了导航，
     走完引导之后再证明导航**真的**回到了最上层。
  */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  /** 点一个「文字正好等于 label」的按钮 */
  const clickByText = (label) =>
    page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => (x.textContent ?? '').trim() === t,
      )
      if (!b) return false
      b.click()
      return true
    }, label)

  /** 等某个选择器出现（超时返回 false，不抛） */
  const waitFor = (sel, timeout = 8000) =>
    page
      .waitForFunction((s) => !!document.querySelector(s), { timeout }, sel)
      .then(() => true, () => false)

  /**
   * 命中测试：某个元素**中心点**上最顶层的元素是不是它自己。
   * 判「有没有被盖住」只能靠这个 —— z-index 和肉眼都不算数
   * （页面外壳那层 anim-fade-in 的隐式层叠上下文就查不出来）。
   */
  const isReachable = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return { found: false, ok: false, hit: 'null' }
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return {
        found: true,
        ok: hit === el || el.contains(hit),
        hit: hit ? hit.tagName + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : 'null',
      }
    }, sel)

  check('首次启动弹出家长设置向导', await waitFor('[data-step="welcome"]'))

  const wizardBlocksNav = await isReachable('[data-tour="tab-tasks"]')
  check(
    '向导期间底部导航点不到（命中测试，不是靠 z-index 猜）',
    wizardBlocksNav.found && !wizardBlocksNav.ok,
    `该点最顶层是 ${wizardBlocksNav.hit}`,
  )

  await clickByText('开始设置')
  check('向导第二步：问名字和头像', await waitFor('input[aria-label="孩子的小名"]'))

  await clickByText('下一步')
  /* 2026-10-30 用户要求：「新号不要在引导前就要求设置家长密码，
     需要用的时候才要求第一次设置。」所以这里从「第三步是设密码」反过来断言。 */
  check('★ 向导里没有「设家长密码」这一步', await page.evaluate(
    () => !document.querySelector('[data-step="pin"]'),
  ))
  check('向导第三步：直接到完成页', await waitFor('[data-step="done"]'))

  /* 后面几节要过家长闸门（审核、改任务、规则页），而新装**没有**家长密码 ——
     不钉一个的话，第一次进闸门会要求当场设（输两遍），那些节全会卡住。
     用共享 helper 钉成 0000，和别的脚本保持一致。 */
  await seedParentPin(page)

  await clickByText('带宝贝看一遍')
  check('接着弹出功能导览（第一步：任务）', await waitFor('[data-tour-bubble="tasks"]'))

  const tourBlocksNav = await isReachable('[data-tour="tab-tasks"]')
  check(
    '导览期间底部导航点不到',
    tourBlocksNav.found && !tourBlocksNav.ok,
    `该点最顶层是 ${tourBlocksNav.hit}`,
  )

  /**
   * 高亮框有没有真的套住某个元素，以及气泡在它的哪一侧、有没有跑出屏幕。
   *
   * ⚠️ 抽成函数是因为 2026-09-21 起导览有**两类目标**：底部 tab 和顶栏按钮。
   * 前者气泡往上放、后者往下放（见 ChildTour 文件头第 5 条），必须分别验。
   */
  const holeVs = (sel) =>
    page.evaluate((s) => {
      const target = document.querySelector(s)
      const bubble = document.querySelector('[data-tour-bubble]')
      if (!target || !bubble) return null
      // 挖洞层是唯一一个带 9999px 外阴影的元素（见 ChildTour 的注释）
      const holeEl = [...document.querySelectorAll('div')].find((d) =>
        (d.getAttribute('style') ?? '').includes('9999px'),
      )
      if (!holeEl) return null
      const t = target.getBoundingClientRect()
      const h = holeEl.getBoundingClientRect()
      const b = bubble.getBoundingClientRect()
      const r = (x) => [x.left, x.top, x.right, x.bottom].map((v) => Math.round(v)).join(',')
      return {
        covers:
          h.left <= t.left + 1 && h.right >= t.right - 1 && h.top <= t.top + 1 && h.bottom >= t.bottom - 1,
        bubbleAbove: b.bottom <= h.top + 1,
        bubbleBelow: b.top >= h.bottom - 1,
        // 「气泡被推出屏幕下沿」是顶栏目标最容易踩的坑，单独量一次
        bubbleOnScreen: b.top >= -1 && b.bottom <= window.innerHeight + 1,
        // 三个矩形的**原始值**，只用来判「重排完了没有」（见下面的 waitStable）
        sig: `${r(t)}|${r(h)}|${r(b)}`,
      }
    }, sel)

  /**
   * 等「挖洞层 + 气泡」的几何**稳定下来**，再断言。
   *
   * ⚠️ 原来切步之后只 `sleep(250)` 就量 —— 切步时 React 还要重排一次
   * （高亮框挪到新目标、气泡翻面）。250ms 不一定够：2026-09-21 实测出现过
   * `covers=false bubbleBelow=false`，量到的还是**上一步**的布局
   * （上一步是底部 tab，气泡是往上放的），原样重跑就 74/74 —— 典型时序抖动。
   *
   * ⚠️⚠️ **只判「稳定」是不够的**（第一版就这么修，仍然 1/3 概率红）。
   * 因为「旧布局稳稳待着、新布局还没算出来」那个窗口本身**也是稳定的** ——
   * 于是会被判成「已稳定」，然后拿着**上一步**的坐标去断言。
   * 所以必须再要一个 `prevSig`（**点下一步之前**量到的几何）：
   * **先确认 sig 变了**（说明真的重排过了），再等它连续几次不变。
   *
   * ⚠️ 判据是「连续 N 次采样完全一致」，**不是**「断言通过」。
   * 后者会把真失败也等成绿的 —— 那是本项目最忌讳的假通过。
   * 等不到就返回最后一次采样，断言照红，只是给了它足够的时间。
   */
  const waitStable = async (sel, prevSig = null, tries = 30) => {
    let last = null
    let lastCur = null
    let same = 0
    for (let i = 0; i < tries; i++) {
      const cur = await holeVs(sel)
      const sig = cur ? cur.sig : null
      // 只有「和点之前不一样」的采样才算数
      if (cur && sig !== prevSig && sig === last) same++
      else same = 0
      last = sig
      lastCur = cur
      if (same >= 2) return cur
      await sleep(90)
    }
    return lastCur
  }

  // 高亮框要真的套在「任务」那一格上，气泡要在它上方 ——
  // 否则孩子看到的只是一块压暗的屏幕，不知道在讲哪儿。
  const hole = await waitStable('[data-tour="tab-tasks"]')
  check(
    '高亮框正好套住「任务」那一格，且气泡在它上方',
    !!hole && hole.covers && hole.bubbleAbove,
    hole ? `covers=${hole.covers} bubbleAbove=${hole.bubbleAbove}` : '没找到挖洞层',
  )

  /**
   * 七步：5 步讲底栏四格 + 顶栏 🪙（给孩子）+ 2 步讲顶栏按钮（给家长）。
   * 后两步是 2026-09-21 用户报「缺乏家长审核和家长设置的引导」之后补的。
   *
   * ⚠️ 2026-11-10 重做之后有两条变化，都在这段里：
   *   · 「游戏」那一步**不再切 tab**（`tab === 'game'` 是全屏，顶栏底栏全没了，
   *     那一刻没有任何 tab 可指）—— 它停在任务页、只高亮底栏那一格。
   *   · 目标选择器**一律从气泡上的 `data-tour-anchor` 读**（组件自己写的），
   *     不再按 `k` 拼 `tab-${k}` / `header-${k}`：游戏那一格的锚点是
   *     `tab-<当前游戏 id>`（默认 `tab-farm`），拼不出来。
   */
  const restSteps = ['game', 'redeem', 'wish', 'points', 'review', 'settings']
  for (let n = 0; n < restSteps.length; n++) {
    const k = restSteps[n]
    /* ⚠️ **点之前**先量一次几何，作为 `waitStable` 的「必须和它不一样」基准。
       少了这一步，「旧布局还稳稳待着、新布局还没算出来」的窗口会被判成
       「已稳定」，然后拿着上一步的坐标去断言 —— 见 `waitStable` 的注释。 */
    const curAnchor = await page.evaluate(
      () => document.querySelector('[data-tour-bubble]')?.getAttribute('data-tour-anchor') ?? '',
    )
    const prevSig = (await holeVs(`[data-tour="${curAnchor}"]`))?.sig ?? null

    await clickByText('下一步')

    /* ⚠️ 两段等待，缺一不可 —— 原来这里只有 `sleep(250)`，会抖（见 waitStable 注释）。
       ① 先等**换步**：气泡的 `data-tour-bubble` 变了才说明 React 真的切过去了。
          不等这个的话，`waitStable` 会对着**上一步**的静止布局判「稳定」并返回它。
       ② 再等**几何稳定**：换步之后还会再重排一次（挪高亮框 + 气泡翻面）。 */
    let switched = true
    try {
      await page.waitForFunction(
        (key) => !!document.querySelector(`[data-tour-bubble="${key}"]`),
        { timeout: 5000 },
        k,
      )
    } catch {
      // 超时不当成「环境问题跳过」—— 直接判红（本项目最忌讳的假通过）
      switched = false
    }
    const anchor = await page.evaluate(
      () => document.querySelector('[data-tour-bubble]')?.getAttribute('data-tour-anchor') ?? '',
    )
    const targetSel = anchor ? `[data-tour="${anchor}"]` : ''
    const h = targetSel ? await waitStable(targetSel, prevSig) : null
    check(`导览第 ${n + 2} 步切到「${k}」`, switched && !!anchor, `anchor=${anchor || '(空)'}`)

    /* 高亮框必须真的套住锚点 —— 否则孩子看到的只是一块压暗的屏幕。 */
    check(
      `第 ${n + 2} 步「${k}」的高亮框套住 ${anchor}`,
      !!h && h.covers,
      h ? `covers=${h.covers}` : '没找到挖洞层 / 锚点',
    )

    // 目标在**顶栏**的那几步：气泡必须翻到下方、且不能跑出屏幕。
    // 沿用「往上」那套算出来的是 `bottom: 视口高 + 6`，气泡会被推出屏幕下沿 ——
    // 而且 DOM 查询照样找得到它，只有量位置才发现得了。
    if (anchor.startsWith('header-')) {
      check(
        `第 ${n + 2} 步「${k}」的气泡在顶栏按钮下方且没跑出屏幕`,
        !!h && h.bubbleBelow && h.bubbleOnScreen,
        h ? `bubbleBelow=${h.bubbleBelow} bubbleOnScreen=${h.bubbleOnScreen}` : '没找到挖洞层',
      )
    }

    /* ★ 导览**任何一步都不许待在全屏游戏里**：那一刻 App 收掉顶栏和底栏，
       没有任何 tab 可指（2026-11-09 的全屏改动踩的就是这个）。 */
    const shell = await page.evaluate(() => ({
      nav: document.querySelectorAll('nav [data-tour]').length,
      header: !!document.querySelector('header'),
    }))
    check(
      `第 ${n + 2} 步「${k}」仍在页面外壳里（顶栏 + 底栏 4 格）`,
      shell.header && shell.nav === 4,
      `header=${shell.header} nav=${shell.nav}`,
    )
  }

  await clickByText('知道啦')
  await sleep(400)
  check(
    '导览收尾后弹层消失',
    !(await page.evaluate(() => !!document.querySelector('[data-tour-bubble]'))),
  )

  // ★ 这一条才是这一段真正的重点：引导走完，导航必须**真的**能用
  const navOk = await isReachable('[data-tour="tab-tasks"]')
  check(
    '引导走完后底部导航恢复可点（命中测试）',
    navOk.found && navOk.ok,
    `该点最顶层是 ${navOk.hit}`,
  )

  // 引导标记要落库：重开一次不能再弹
  await sleep(600)
  await page.reload({ waitUntil: 'networkidle2' })
  await page
    .waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
    .catch(() => {})
  await sleep(1200)
  check(
    '重开 App 不再弹引导（onboardingDone 已落库）',
    !(await page.evaluate(() => !!document.querySelector('[data-step]'))),
  )

  /* ---------- 2. 四个主 Tab ---------- */
  /* 底栏四格（2026-11-05 起）。
     「积分」**不在这里** —— 它是顶栏那颗 🪙，单独在下面第 8 段走查。
     换成「心愿」是因为底栏现在就是这四格；少写一格就等于少测一格。 */
  const tabs = ['任务', '农场', '兑换', '心愿']
  /** 哪几格带「全屏」键 —— 应该只有游戏那一格（2026-11-11 新交互） */
  const fullTabs = []
  for (const t of tabs) {
    const clicked = await page.evaluate((label) => {
      // 底部导航按钮内容是 emoji + 换行 + 文字，因此取最后一行比对
      const btns = [...document.querySelectorAll('button')]
      const b = btns.find((x) => x.innerText.trim().split('\n').pop().trim() === label)
      if (b) { b.click(); return true }
      return false
    }, t)
    if (!clicked) {
      check(`Tab「${t}」可点击`, false, '没找到按钮')
      continue
    }
    await new Promise((r) => setTimeout(r, 900))
    const txt = await page.evaluate(() => document.body.innerText)
    check(`Tab「${t}」渲染`, txt.length > 30, `${txt.replace(/\s+/g, ' ').slice(0, 60)}…`)

    /* ★ 2026-11-11 用户改的交互：游戏页**默认不再全屏**（顶栏底栏都在），
       想沉浸要点画面右下角那枚「全屏」，进去之后才有左上角返回 / 右上角胶囊。
       所以这里判两件事：每一格都带外壳；只有游戏那一格有「全屏」键，
       且全屏往返一次能把外壳收掉再还回来。

       ⚠️ 原来的写法是「点 `exit-game` 退出全屏」—— 那一屏已经不存在了，
       留着会让 `exit` 恒为 false、断言恒真（**假绿**）。 */
    const shell = await page.evaluate(() => ({
      nav: document.querySelectorAll('nav [data-tour]').length,
      header: !!document.querySelector('header'),
      full: !!document.querySelector('[data-tour="game-fullscreen"]'),
    }))
    check(
      `Tab「${t}」带外壳（默认不全屏）`,
      shell.nav === 4 && shell.header === true,
      `nav=${shell.nav} header=${shell.header}`,
    )
    if (shell.full) {
      fullTabs.push(t)
      /* ★★ 全屏键**不许压在游戏自己的动作按钮上**（2026-11-11 实测踩过）：
         它原来贴右下角 `bottom-2`，压住农场「市场」横向 30/126px = 13.5% 面积
         ⇒ 点市场的右侧四分之一会误进全屏。那是个主要操作，不是可以牺牲的角落。
         判据是**矩形求交面积 = 0**，不是「看着没压着」—— 截图看不出来。
         （本地还有 `_measure-fullscreen-btn.mjs` 能打印百分比，但它不入库，
           所以这条闸门必须留在这里。） */
      const overlap = await page.evaluate(() => {
        const fs = document.querySelector('[data-tour="game-fullscreen"]')
        if (!fs) return { ok: false, why: '没有全屏键' }
        const f = fs.getBoundingClientRect()
        const cand = [...document.querySelectorAll('button, [role="button"]')].filter((e) => {
          if (e === fs) return false
          const r = e.getBoundingClientRect()
          if (r.width < 30 || r.height < 24) return false
          return /种子|动物|市场|商店|背包|购买/.test((e.textContent || '').trim())
        })
        const bad = []
        for (const e of cand) {
          const r = e.getBoundingClientRect()
          const ox = Math.max(0, Math.min(f.right, r.right) - Math.max(f.left, r.left))
          const oy = Math.max(0, Math.min(f.bottom, r.bottom) - Math.max(f.top, r.top))
          if (ox * oy > 0) {
            bad.push((e.textContent || '').trim().slice(0, 6) + ' ' + Math.round(ox) + 'x' + Math.round(oy) + 'px')
          }
        }
        return { ok: bad.length === 0, why: bad.join(' / ') }
      })
      check('全屏键没压在游戏的动作按钮上（重叠面积 0）', overlap.ok, overlap.why || '无重叠')

      /* 全屏往返：进去 → 外壳收掉、返回 + 胶囊都在 → 左上角返回 → 外壳回来 */
      await page.evaluate(() => document.querySelector('[data-tour="game-fullscreen"]')?.click())
      await new Promise((r) => setTimeout(r, 700))
      const inFull = await page.evaluate(() => ({
        header: !!document.querySelector('header'),
        nav: !!document.querySelector('nav'),
        back: !!document.querySelector('[data-tour="exit-immersive"]'),
        exit: !!document.querySelector('[data-tour="exit-game"]'),
      }))
      check(
        '点「全屏」后外壳收掉，左上角返回 + 右上角胶囊都在',
        !inFull.header && !inFull.nav && inFull.back && inFull.exit,
        JSON.stringify(inFull),
      )
      await page.evaluate(() => document.querySelector('[data-tour="exit-immersive"]')?.click())
      await new Promise((r) => setTimeout(r, 700))
      const backOut = await page.evaluate(() => ({
        nav: document.querySelectorAll('nav [data-tour]').length,
        header: !!document.querySelector('header'),
        full: !!document.querySelector('[data-tour="game-fullscreen"]'),
      }))
      check(
        '左上角返回后回到外壳（仍停在游戏页，不是被踢走）',
        backOut.nav === 4 && backOut.header === true && backOut.full === true,
        JSON.stringify(backOut),
      )
    }
  }
  check('只有游戏那一格有「全屏」键', fullTabs.length === 1, fullTabs.join(','))

  /* ---------- 3. 横向溢出检测 ---------- */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
    )
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 800))
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }))
  check(
    '移动端无横向溢出',
    overflow.scrollW <= overflow.clientW + 2,
    `scrollW=${overflow.scrollW} clientW=${overflow.clientW}`,
  )

  /* ---------- 3b. 顶栏：两个币种都在，且塞得下长名字 ----------
     顶栏现在有 头像 + 名字 + 🪙 + 🎟️ + 两个按钮，是全局最挤的一行。
     名字那个 span 上的 `truncate` **必须配 `min-w-0` 才会真的收缩** ——
     flex 子项默认 `min-width: auto`，不会小于内容宽度，
     于是长名字把整行顶出去；而桌面浏览器会用横向滚动条兜住，
     在手机上就是**直接被裁掉**（看不出来，除非专门量）。 */
  const headerProbe = await page.evaluate(async () => {
    const s = () => window.__kqf__.getState()
    const header = () => document.querySelector('header')
    const measure = () => {
      const h = header()
      // ⚠️ 用属性定位，别用 `h.children[1]` —— 2026-10-03 平板适配给顶栏
      // 加了一层 page-col 包裹，下标直接失效（量出 -1，断言假失败）。
      const nameEl = document.querySelector('[data-child-name]')
      return {
        h: h ? Math.round(h.getBoundingClientRect().height) : -1,
        nameW: nameEl ? Math.round(nameEl.getBoundingClientRect().width) : -1,
        nameContentW: nameEl ? Math.round(nameEl.scrollWidth) : -1,
      }
    }

    const prev = s().settings.childName
    const short = measure() // 先量短名字当基准
    await s().updateSettings({ childName: '小明明的超级无敌长名字测试' })
    await new Promise((r) => setTimeout(r, 400))
    const long = measure()

    const labels = [...(header()?.querySelectorAll('[aria-label]') ?? [])].map((e) =>
      e.getAttribute('aria-label'),
    )
    return {
      prev,
      short,
      long,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      labels,
    }
  })
  check(
    '长名字不会把顶栏顶出屏幕',
    headerProbe.scrollW <= headerProbe.clientW + 2,
    `scrollW=${headerProbe.scrollW} clientW=${headerProbe.clientW}，` +
      `名字容器 ${headerProbe.long.nameW}（内容 ${headerProbe.long.nameContentW}）`,
  )
  check(
    '长名字真的被省略号截断了',
    headerProbe.long.nameContentW > headerProbe.long.nameW && headerProbe.long.nameW > 0,
    `容器 ${headerProbe.long.nameW} < 内容 ${headerProbe.long.nameContentW}`,
  )
  /* 顶栏必须**始终一行高**。
     名字要是没被截断而是折行，横向溢出查不出来（`scrollW` 照样等于 `clientW`），
     但整行会被撑高、把下面的内容顶下去 —— 所以直接比高度。 */
  check(
    '长名字不会把顶栏撑高（仍然是一行）',
    headerProbe.long.h === headerProbe.short.h && headerProbe.short.h > 0,
    `短名字 ${headerProbe.short.h}px → 长名字 ${headerProbe.long.h}px`,
  )
  /*
    2026-10-28：家长要求「顶部栏 积分前面显示钻石」⇒ 顶栏现在三颗币。
    顺序也一起判：钻石必须**在积分前面**，不然「前面」这条要求没落地，
    而三颗都在的判据照样绿。
  */
  const mallIdx = headerProbe.labels.findIndex((c) => c?.startsWith(MALL.name))
  const pointsIdx = headerProbe.labels.findIndex((c) => c?.startsWith(POINTS.name))
  check(
    `顶栏同时显示${MALL.name}、${POINTS.name}和${COUPON.name}`,
    mallIdx >= 0 &&
      pointsIdx >= 0 &&
      headerProbe.labels.some((c) => c?.startsWith(COUPON.name)),
    headerProbe.labels.join(' / ') || '一个都没找到',
  )
  check(
    `★ ${MALL.name}排在${POINTS.name}前面`,
    mallIdx >= 0 && pointsIdx >= 0 && mallIdx < pointsIdx,
    `钻石在第 ${mallIdx + 1} 个、积分在第 ${pointsIdx + 1} 个（按 aria-label 顺序）`,
  )
  // 还原名字：后面几项会打印顶栏文字，改着名字会把输出搞乱
  await page.evaluate(async (prev) => {
    await window.__kqf__.getState().updateSettings({ childName: prev })
    await new Promise((r) => setTimeout(r, 300))
  }, headerProbe.prev)

  /* ---------- 4. 任务结算：填用时 → 完成 → 积分入账 ---------- */
  const balanceBefore = await page.evaluate(() => {
    const m = document.body.innerText.match(/🪙\s*(\d+)/)
    return m ? Number(m[1]) : -1
  })

  /**
   * 打开第一个待完成任务的详情。
   *
   * ⚠️ 卡片上的入口会随 `TIMER_ENABLED`（src/features/tasks/ui.tsx）变化：
   *   · 关着（当前默认）：只有一个「✅ 我做完啦！」，点一下就开弹层
   *   · 开着：第一个是「▶️ 开始」—— 点它**只会开始计时，弹层不开**
   *
   * 所以不能「点一下就假定弹层开了」，要**点到弹层真的出现**为止。
   * 这样开关翻回 true 时这套用例照样绿 —— 否则「能翻回来」就只是一句话。
   */
  const CARD_ACTION = /我做完啦|开始|去完成/
  let opened = null
  for (let i = 0; i < 3; i++) {
    opened = await page.evaluate((src) => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        new RegExp(src).test(x.innerText),
      )
      if (b) { b.click(); return b.innerText.trim() }
      return null
    }, CARD_ACTION.source)
    await new Promise((r) => setTimeout(r, 900))
    if (await page.evaluate(() => !!document.querySelector('[role="dialog"]'))) break
  }
  check('任务卡片有可点击的行动按钮', !!opened, opened ?? '未找到')

  if (opened) {
    const sheetText = await page.evaluate(() => document.body.innerText)
    check('任务详情/结算面板打开', sheetText.length > 40)

    /**
     * 提交。⚠️ **必须限定在弹层内找**（`[role="dialog"]`）。
     *
     * 卡片上那个按钮和弹层里的提交按钮**文案一模一样**（都是「✅ 我做完啦！」），
     * 而弹层是盖在页面上的 —— 卡片按钮**仍然可见**，`offsetParent` 拦不住它。
     * 不限定范围的话会点到卡片按钮，等于把弹层重开一次，
     * 后面「积分有没有变」就永远测不到真正的提交（假绿）。
     */
    const submitted = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"]')
      if (!sheet) return null
      const b = [...sheet.querySelectorAll('button')].find(
        (x) => /提交|做完啦|完成啦|确认完成|完成/.test(x.innerText) && x.offsetParent,
      )
      if (b) { b.click(); return b.innerText.trim() }
      return null
    })
    if (submitted) {
      await new Promise((r) => setTimeout(r, 1600))
      const after = await page.evaluate(() => {
        const m = document.body.innerText.match(/🪙\s*(\d+)/)
        return m ? Number(m[1]) : -1
      })
      check(
        '提交任务后积分有变化或出现结果反馈',
        after !== balanceBefore || /分|完成|奖励/.test(await page.evaluate(() => document.body.innerText)),
        `before=${balanceBefore} after=${after}`,
      )
    } else {
      check('任务提交按钮存在', false, '未找到提交按钮')
    }
  }

  /* ---------- 4b. 长期任务：孩子端不许自评质量 ----------
     用户报的事故：「长期任务 孩子 做完确认时 为啥能自己评价和打分。」
     普通任务早就只让家长打分，长期任务那张表漏了 ——
     孩子能自己选档位打分，还能看见「+N 分」。
     这里在真浏览器里确认那张表真的干净（jsdom 的版本见
     src/features/tasks/PeriodSubmit.test.tsx）。

     ⚠️ 档位名**不要在这里抄一份**：2026-10 三档改五档时，
     原来硬编码的 /一般|不错|特别棒/ 里的「不错」变成了「良好」，
     守卫从此少匹配一个却**不会报错**。现在从 settlement.ts 读，
     读不到就抛（见 scripts/lib/quality.mjs 顶部）。 */
  const QUALITY_LABEL_RE = qualityLabelRegex()
  const QUALITY_GRADE_COUNT = readQualityLabels().length
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 400))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
    )
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 800))

  const periodOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => /完成一次/.test(x.innerText) && x.offsetParent,
    )
    if (!b) return null
    b.scrollIntoView({ block: 'center' })
    b.click()
    return b.innerText.replace(/\s+/g, ' ').trim()
  })
  check('长期任务卡有「完成一次 ＋」按钮', !!periodOpened, periodOpened ?? '未找到')

  if (periodOpened) {
    await new Promise((r) => setTimeout(r, 700))
    const probe = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent)
      return {
        text: document.body.innerText,
        buttons: btns.map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()),
      }
    })
    const dirty = probe.buttons.filter((t) => QUALITY_LABEL_RE.test(t))
    check('孩子端没有质量自评按钮', dirty.length === 0, dirty.join(' / ') || '干净')
    check('没有「做得怎么样？」这一问', !probe.text.includes('做得怎么样？'))
    check('确认按钮是「完成确认」', probe.buttons.some((t) => t === '完成确认'))

    /* 底部两键的排布。
       ⚠️ 这是真踩过的：原来只有右边那个带 `full`（w-full），
       左边「取消」被挤成竖排的「取 / 消」。两个字时看不出来，
       改成四个字的「完成确认」才露馅 —— 所以必须量，不能靠肉眼。
       量法：Range 的行盒数量。换行的文字会产出多个 rect。 */
    const pair = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')].filter(
        (b) => b.offsetParent,
      )
      const cancel = btns.find((b) => (b.innerText || '').trim() === '取消')
      const ok = btns.find((b) => (b.innerText || '').trim() === '完成确认')
      if (!cancel || !ok) return null
      const lineBoxes = (el) => {
        const r = document.createRange()
        r.selectNodeContents(el)
        return r.getClientRects().length
      }
      const a = cancel.getBoundingClientRect()
      const b = ok.getBoundingClientRect()
      return {
        sameTop: Math.abs(a.top - b.top) < 2,
        topGap: Math.round(Math.abs(a.top - b.top)),
        cancelLines: lineBoxes(cancel),
        okLines: lineBoxes(ok),
        widths: [Math.round(a.width), Math.round(b.width)],
      }
    })
    check(
      '底部两键并排（同一行）',
      pair?.sameTop === true,
      pair ? `top 差 ${pair.topGap}px，宽 ${pair.widths.join(' / ')}` : '未找到这两个按钮',
    )
    check(
      '底部两键各自只占一行（没被挤成竖排）',
      pair?.cancelLines === 1 && pair?.okLines === 1,
      pair ? `行盒 取消=${pair.cancelLines} 完成确认=${pair.okLines}` : '未找到这两个按钮',
    )
    // 关掉，别把弹层留给后面几节
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 400))
  }

  /* ---------- 4c. 签到卡：阶梯数字 + 编辑入口（2026-10-09） ----------
     家长要求：签到「每次基本分 5 分」，并把过大的阶梯奖励压小
     （周档 10/30/60 → 2/6/12）。

     ⚠️ 2026-10-11 家长把「连续 +1」收回了：「签到只需要阶梯奖励……
     不能两种同时都有」。所以签到卡上**不该再有任何连击字样**，
     这条现在是**禁令**（见下面的断言）。

     单测钉的是领域函数（defaultTiers），卡片上是**另一条渲染路径**
     （TaskPage 的 CheckInCard）—— 它会单独写错，所以这里在真浏览器里
     把显示出来的字读一遍。 */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
    )
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 900))

  const checkInCard = await page.evaluate(() => {
    const title = '学习日复述每天学习内容'
    const h = [...document.querySelectorAll('h3')].find((x) => x.innerText.trim() === title)
    if (!h) return null
    /* 从标题往上走到整张卡。
       ⚠️ 别用「祖先里有『已坚持』就停」—— 标题的**上一级**就已经满足，
          于是停在标题那一行，后面的日期格子 / 阶梯全都读不到，
          断言会误报「卡片上没写阶梯数字」（第一版就是这么错的）。
       判据改成「这一层还只有 1 个 h3」：一旦祖先里出现第二个 h3，
       说明已经走到卡片列表那一层了，该停。 */
    let card = h
    while (card.parentElement && card.parentElement.querySelectorAll('h3').length === 1) {
      card = card.parentElement
    }
    return {
      text: card.innerText.replace(/\s+/g, ' ').trim(),
      buttons: [...card.querySelectorAll('button')].map((b) =>
        b.innerText.replace(/\s+/g, ' ').trim(),
      ),
    }
  })
  check('新增的「学习日复述每天学习内容」出现在坚持签到里', !!checkInCard)
  if (checkInCard) {
    /* 2026-10-09 家长要求：这两行**不显示**。
         · 今天签到可得 7 分（基础 5 + 阶梯 2）
         · 连着来每天多 +1（最多 +5）
       阶梯那几行本来就写着每档 +多少，再说一遍是重复。

       ⚠️ 这是**禁令**，不是功能 —— 「断言某段文字不存在」单独放着很弱：
       卡片要是整个渲染失败，它也照样绿。所以下面必须留着**正向对照**：
       同一个 `checkInCard.text` / `buttons` 里，「+2 / +6 / +12」和 ✏️
       都还在 —— 证明探针确实读到了这张卡的正文，读不到才会两条一起红。 */
    check(
      '签到卡不再预告「今天签到可得 N 分」（家长要求去掉）',
      !/今天签到可得/.test(checkInCard.text),
      checkInCard.text.slice(0, 90),
    )
    check(
      '签到卡不再写「连着来每天多 +1（最多 +5）」（家长要求去掉）',
      !/连着来每天多/.test(checkInCard.text),
      '',
    )
    /* 2026-10-11 家长定：「签到只需要阶梯奖励……不能两种同时都有」。
       所以整张签到卡上不许再出现任何连击字样。正向对照同上 ——
       紧跟着的 +2 / +6 / +12 那条仍然必须绿，证明探针确实读到了正文。 */
    check(
      '签到卡上没有任何连击字样（2026-10-11 家长定：签到只留阶梯）',
      !/连击|连续第/.test(checkInCard.text),
      checkInCard.text.slice(0, 90),
    )
    check(
      '阶梯数字还在，且仍是压小后的 +2 / +6 / +12（正向对照：探针确实读到了卡片）',
      ['+2', '+6', '+12'].every((p) => checkInCard.buttons.some((b) => b.endsWith(p))) &&
        !checkInCard.buttons.some((b) => b.endsWith('+60')),
      checkInCard.buttons.join(' | '),
    )
    /* 2026-10-09 家长报「签到任务无法编辑」。
       原因：签到卡（CheckInCard）渲染时**没接 onEdit**，也没有编辑按钮 ——
       长期任务卡和固定任务条都有 ✏️，唯独签到卡漏了，于是签到任务
       从界面上根本走不到编辑器（编辑器和 store 本身都支持签到任务）。
       这条断言就是那个缺口。 */
    check(
      '签到卡上有编辑入口（✏️）—— 否则签到任务根本改不了',
      checkInCard.buttons.some((b) => b.includes('✏️')),
      checkInCard.buttons.join(' | '),
    )

    /* 光有按钮不算数：点下去要真的打开编辑器，而且载入的是**这张签到任务**
       （标题一致 + 签到模式开着）。否则等于给了个开不出东西的按钮。
       这一节跑在第一次进家长闸门之前，所以不用过闸。

       ⚠️ 不能直接找页面上第一个 aria-label="编辑任务" —— 「今日任务」的卡片
       也有这个按钮，DOM 顺序在前，点到的是别人的卡。必须**从签到卡的标题
       往上走回卡片**，再点它里面的那个（同上面 checkInCard 的走法）。 */
    const clicked = await page.evaluate(() => {
      const title = '学习日复述每天学习内容'
      const h = [...document.querySelectorAll('h3')].find((x) => x.innerText.trim() === title)
      if (!h) return false
      let card = h
      while (card.parentElement && card.parentElement.querySelectorAll('h3').length === 1) {
        card = card.parentElement
      }
      const btn = [...card.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '编辑任务',
      )
      if (!btn) return false
      btn.click()
      return true
    })

    /* 编辑器是**家长动作**，被密码锁着 —— 上面 `seedParentPin` 已经把
       密码钉成了 0000（2026-10-30 起新装默认没有密码，闸门会要求现设）。
       不过闸的话，「✅ 保存修改」永远不会出现（这一条第一次写就栽在这，
       报的是「没出现保存按钮」，看着像编辑入口坏了，其实是门禁在正常工作）。 */
    const gateShown = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      return !!d && /请爸爸妈妈来一下/.test(d.innerText)
    })
    /** 过家长密码盘（默认 0000）。不点的话「✅ 保存修改」永远不出现。 */
    const passPin = async () => {
      for (const k of ['0', '0', '0', '0']) {
        await page.evaluate((key) => {
          const d = document.querySelector('[role="dialog"]')
          const b = d ? [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === key) : null
          b?.click()
        }, k)
        await new Promise((r) => setTimeout(r, 180))
      }
    }
    if (gateShown) await passPin()

    /* 等弹层真的挂上，别用固定 sleep —— 判据是「出现保存按钮」这个可观测事实。 */
    const opened = await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('button')].some(
            (x) => x.textContent?.trim() === '✅ 保存修改',
          ),
        { timeout: 6000 },
      )
      .then(() => true, () => false)

    const editor = await page.evaluate(() => {
      const titleInput = document.querySelector('input[placeholder="比如：完成语文作业"]')
      const checkInSwitch = [...document.querySelectorAll('button')].find((x) =>
        (x.textContent ?? '').includes('开启签到模式'),
      )
      return {
        title: titleInput?.value ?? null,
        checkInOn: checkInSwitch?.getAttribute('aria-pressed') === 'true',
      }
    })

    /* ---------- 存得下去吗：改「一共要签到几天」5 → 7 → 再改回 5 ----------
       打开编辑器只证明入口通，不证明**存得下**。签到卡读的是 task 定义
       （不像 daily 那样读实例快照），所以这里量「卡上写的目标天数」。
       改回 5 是必须的：阶梯是按目标天数算的（unit = 0.8×基础分×目标/10），
       留着 7 会把下面第 6 节「确认后得到 +7 分」连带改掉。 */
    const openEditorOfCard = async () => {
      const ok = await page.evaluate(() => {
        const h = [...document.querySelectorAll('h3')].find(
          (x) => x.innerText.trim() === '学习日复述每天学习内容',
        )
        if (!h) return false
        let card = h
        while (card.parentElement && card.parentElement.querySelectorAll('h3').length === 1) {
          card = card.parentElement
        }
        const btn = [...card.querySelectorAll('button')].find(
          (x) => x.getAttribute('aria-label') === '编辑任务',
        )
        if (!btn) return false
        btn.click()
        return true
      })
      await sleep(700)
      await passPin()
      await sleep(500)
      return ok
    }

    /** 把「一共要签到几天」设成 v 并保存；返回是否真的填进去了 */
    const setTargetAndSave = async (v) => {
      const typed = await page.evaluate((val) => {
        const label = [...document.querySelectorAll('p')].find((x) =>
          (x.textContent ?? '').trim().endsWith('一共要签到几天'),
        )
        const input = label?.closest('div')?.querySelector('input[type="number"]')
        if (!input) return false
        // React 受控 input：走原型 setter + 派发 input。直接赋 value 不触发 onChange，
        // 界面看着改了、state 没改 —— 本项目「假绿」的经典来源。
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
        setter.call(input, String(val))
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      }, v)
      await sleep(400)
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(
          (x) => x.textContent?.trim() === '✅ 保存修改',
        )
        b?.click()
      })
      await sleep(1500)
      return typed
    }

    /** 签到卡上「已坚持 N / M 天」里的 M */
    const targetOnCard = () =>
      page.evaluate(() => {
        const h = [...document.querySelectorAll('h3')].find(
          (x) => x.innerText.trim() === '学习日复述每天学习内容',
        )
        if (!h) return null
        let card = h
        while (card.parentElement && card.parentElement.querySelectorAll('h3').length === 1) {
          card = card.parentElement
        }
        const m = card.innerText.replace(/\s+/g, ' ').match(/已坚持\s*\d+\s*\/\s*(\d+)\s*天/)
        return m ? Number(m[1]) : null
      })

    const typed7 = await setTargetAndSave(7)
    const after7 = await targetOnCard()

    await openEditorOfCard()
    const typed5 = await setTargetAndSave(5)
    const after5 = await targetOnCard()

    check('签到卡上的 ✏️ 点得到', clicked, clicked ? '' : '没在签到卡里找到编辑按钮')
    check('点签到卡的 ✏️ 会弹出编辑器，并被家长密码挡住', clicked && gateShown, gateShown ? '' : '没看到密码盘')
    check('过了密码后编辑器打开', opened, opened ? '' : '等 6s 也没出现「✅ 保存修改」')
    check(
      '编辑器载入的就是那张签到任务（标题一致 + 签到模式开着）',
      editor.title === '学习日复述每天学习内容' && editor.checkInOn,
      `标题「${editor.title}」，签到模式 ${editor.checkInOn ? '开' : '关'}`,
    )
    check('改「一共要签到几天」5 → 7 存得下去', typed7 && after7 === 7, `卡上写 / ${after7} 天（期望 7）`)
    check('再改回 5 也存得下去（复原，不影响后面的用例）', typed5 && after5 === 5, `卡上写 / ${after5} 天（期望 5）`)

    /* ---------- 「固定任务」开关已移除（2026-10-09，家长决定） ----------
       反方向断言（「界面上搜不到 X」）**单独用是弱的**：探针找不到东西，
       也可能只是因为弹层压根没开。所以**在同一次读取里配一个正向对照** ——
       同一个编辑器里「开启签到模式」必须还在，证明这次真的读到了弹层。 */
    await openEditorOfCard()
    const reopenedGate = await page.evaluate(
      () => !!document.querySelector('[role="dialog"]'),
    )
    if (reopenedGate) await passPin()
    const reopened = await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('button')].some(
            (x) => x.textContent?.trim() === '✅ 保存修改',
          ),
        { timeout: 6000 },
      )
      .then(() => true, () => false)
    const editorText = await page.evaluate(
      () => document.querySelector('[role="dialog"]')?.innerText ?? '',
    )
    check(
      '编辑器里已没有「这是家里的固定任务」开关（2026-10-09 移除）',
      reopened && !/这是家里的固定任务/.test(editorText),
      reopened ? '' : '编辑器没打开，这条断言不成立',
    )
    check(
      '正向对照：同一个编辑器里「开启签到模式」还在（证明探针读到了弹层）',
      reopened && /开启签到模式/.test(editorText),
      `弹层文字 ${editorText.length} 字`,
    )

    /* ---------- 目标超过「周期容量」时要给家长一句实话 ----------
       周任务的容量是 7 天。目标 5 ≤ 7 → 不该报警；
       把目标推到 8 > 7 → 必须明确警告「永远到不了」。
       一正一反成对：只有反向（「没看到警告」）是弱断言，
       配上正向才能说明这段逻辑真的接上了，而不是永远不显示。 */
    check(
      '周任务目标 5 ≤ 容量 7，编辑器不报「永远到不了」（不是常显）',
      !/永远到不了/.test(editorText),
      /永远到不了/.test(editorText) ? '在有效配置上误报了' : '',
    )

    /* ---------- 日 / 单次周期：签到整块不显示（2026-10-09 家长定） ----------
       同一份弹层，只切周期：选「每天」时签到那块必须整块消失，
       选回「每周」必须自己回来。
       正向对照放在**同一次读取**里 —— 用「计划时长」这个永远在的字段
       证明探针读的是**当前**弹层，而不是拿到一份空文本
       （否则「没有签到模式」也可能只是因为整个弹层都没了）。 */
    const clickCycle = async (label) => {
      const ok = await page.evaluate((t) => {
        const d = document.querySelector('[role="dialog"]')
        const b = d
          ? [...d.querySelectorAll('button')].find((x) => x.textContent?.trim() === t)
          : null
        if (!b) return false
        b.click()
        return true
      }, label)
      await sleep(500)
      return ok
    }
    const dialogText = () =>
      page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText ?? '')

    const toDaily = await clickCycle('每天')
    const dailyText = await dialogText()
    check(
      '周期选「每天」时，签到模式整块不显示（开关和目标天数都不在）',
      toDaily && !/开启签到模式/.test(dailyText) && !/一共要签到几天/.test(dailyText),
      toDaily ? '' : '没找到「每天」按钮',
    )
    check(
      '正向对照：同一次读取里「计划时长」还在（读的是当前弹层，不是空文本）',
      /计划时长/.test(dailyText),
      `弹层文字 ${dailyText.length} 字`,
    )

    const backWeekly = await clickCycle('每周')
    const weeklyText = await dialogText()
    check(
      '周期选回「每周」时，签到模式自己回来（不是永久消失）',
      backWeekly && /开启签到模式/.test(weeklyText),
      backWeekly ? '' : '没找到「每周」按钮',
    )

    await setTargetAndSave(8)
    await openEditorOfCard()
    const gate8 = await page.evaluate(() => !!document.querySelector('[role="dialog"]'))
    if (gate8) await passPin()
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('button')].some(
            (x) => x.textContent?.trim() === '✅ 保存修改',
          ),
        { timeout: 6000 },
      )
      .catch(() => {})
    const editorText8 = await page.evaluate(
      () => document.querySelector('[role="dialog"]')?.innerText ?? '',
    )
    check(
      '目标 8 > 周期容量 7 时，编辑器警告「永远到不了」',
      /永远到不了/.test(editorText8),
      /永远到不了/.test(editorText8) ? '' : `弹层 ${editorText8.length} 字，没找到警告`,
    )
    check(
      '警告里把容量 7 和目标 8 都点出来了（不是一句空话）',
      /7/.test(editorText8) && /8/.test(editorText8),
      '',
    )

    // 复原成 5 —— 下面的签到审核用例依赖阶梯数字（base 5 / target 5 → 2/6/12）
    await setTargetAndSave(5)
    const afterRestore = await targetOnCard()
    check('目标改回 5（复原）', afterRestore === 5, `卡上写 / ${afterRestore} 天`)

    /* ---------- 「固定任务」区块是不是真的没了 ----------
       ⚠️ 直接 `!/固定任务/.test(document.body.innerText)` 是**假绿**：
       全新安装里一个 fixed 任务都没有（种子里 fixed 数为 0），
       而那个区块有 `fixedTasks.length > 0` 守卫，压根不渲染 ——
       于是这条断言在**功能还在**的版本上照样通过。
       实测过：把源码回退到移除之前，它仍然绿（同批的开关断言已经红了）。
       所以必须先**造一个 fixed 任务出来**，让那段渲染代码有机会跑。
       选 weekly：它不靠实例，直接进「长期任务」，
       于是「任务确实渲染了」可以当**正向对照**，证明探针没瞎。
       （升级上来的老库里本来就有 fixed: true 的任务，所以这条路是真实的。） */
    await page.evaluate(async () => {
      const req = indexedDB.open('kid-quest-farm')
      const idb = await new Promise((res, rej) => {
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
      const tx = idb.transaction('tasks', 'readwrite')
      tx.objectStore('tasks').put({
        id: 'tk_probe_fixed_section',
        // 标题里**不能**含「固定任务」四个字，否则自己把自己搜出来
        title: '探针-每周倒垃圾',
        category: 'chore',
        cycle: 'weekly',
        plannedMinutes: 10,
        basePoints: 5,
        allowOvertime: false,
        allowLateNoPenalty: true,
        qualityRated: false,
        fixed: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
      await new Promise((res) => {
        tx.oncomplete = res
      })
      idb.close()
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await page
      .waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
      .catch(() => {})
    await sleep(1200)

    const injectedText = await page.evaluate(() => document.body.innerText)
    check(
      '正向对照：注入的 fixed 任务确实渲染出来了（探针没瞎）',
      /探针-每周倒垃圾/.test(injectedText),
      /探针-每周倒垃圾/.test(injectedText) ? '' : '任务没渲染 → 下面那条断言不成立',
    )
    check(
      '孩子端已没有「固定任务」区块（即使库里存在 fixed: true 的任务）',
      !/固定任务/.test(injectedText),
      /固定任务/.test(injectedText) ? '页面上还能搜到「固定任务」' : '',
    )

    // 清掉探针任务，别影响后面的用例
    await page.evaluate(async () => {
      const req = indexedDB.open('kid-quest-farm')
      const idb = await new Promise((res) => {
        req.onsuccess = () => res(req.result)
      })
      const tx = idb.transaction('tasks', 'readwrite')
      tx.objectStore('tasks').delete('tk_probe_fixed_section')
      await new Promise((res) => {
        tx.oncomplete = res
      })
      idb.close()
    })
    await page.reload({ waitUntil: 'networkidle2' })
    await page
      .waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
      .catch(() => {})
    await sleep(1200)
  }

  /* ---------- 4b. 任务隐藏：软隐藏 + 可恢复 ----------
     ⚠️ 两条纪律，都是踩过的：
     ① **正向对照放前面**：先证明「这个任务本来就在今日列表里」。
        否则「隐藏后搜不到」可能只是探针根本没搜到东西（假绿）。
     ② **按 section 作用域比，不要拿 body.innerText 搜标题**：
        隐藏之后标题**还在页面上**（在「已隐藏」区块里），
        全页搜会一直命中 → 断言恒真，等于没测。
        `Section` 渲染的是 <section><h2>标题</h2>…，正好可以定位。 */
  {
    const sectionText = (heading) =>
      page.evaluate((h) => {
        const sec = [...document.querySelectorAll('section')].find(
          (x) => x.querySelector('h2')?.textContent?.trim() === h,
        )
        return sec ? sec.innerText : null
      }, heading)

    const probe = await page.evaluate(() => {
      const t = window.__kqf__.getState().tasks.find((x) => x.cycle === 'daily')
      return t ? { id: t.id, title: t.title } : null
    })
    check('找得到一个每日任务当探针', !!probe, probe?.title ?? '没找到每日任务')

    if (probe) {
      const todayBefore = await sectionText('今日任务')
      check(
        '正向对照：隐藏前，这个任务确实在「今日任务」区块里',
        !!todayBefore && todayBefore.includes(probe.title),
        todayBefore ? '' : '没拿到「今日任务」区块 → 下面两条不成立',
      )
      check('隐藏前页面上没有「已隐藏」区块', (await sectionText('已隐藏')) === null)

      await page.evaluate(async (id) => {
        await window.__kqf__.getState().setTaskArchived(id, true)
      }, probe.id)
      await sleep(900)

      const todayHidden = await sectionText('今日任务')
      const hiddenSec = await sectionText('已隐藏')
      check(
        '隐藏后：从「今日任务」区块里消失',
        !!todayHidden && !todayHidden.includes(probe.title),
      )
      check(
        '隐藏后：出现「已隐藏」区块，且任务在里面（家长找得回来）',
        !!hiddenSec && hiddenSec.includes(probe.title),
        hiddenSec === null ? '「已隐藏」区块没渲染 → 隐藏不可逆' : '',
      )

      await page.evaluate(async (id) => {
        await window.__kqf__.getState().setTaskArchived(id, false)
      }, probe.id)
      await sleep(900)

      const todayBack = await sectionText('今日任务')
      check(
        '恢复后：任务回到「今日任务」区块',
        !!todayBack && todayBack.includes(probe.title),
      )
      check('恢复后：「已隐藏」区块消失', (await sectionText('已隐藏')) === null)
    }
  }

  /* ---------- 5. 农场：种植流程 ---------- */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '农场',
    )
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 1200))
  const farmText = await page.evaluate(() => document.body.innerText)
  check('农场页渲染', /种子|农场|地块|收获|🌱|🌾/.test(farmText), farmText.replace(/\s+/g, ' ').slice(0, 70))

  /* 币种不重复：全局顶栏（sticky）已经常驻显示 🪙 / 🎟️，**页面正文里不该再放一遍**。
     ⚠️ 判据要按「**叶子节点、且整段文字就是一个图标**」来数，不能拿 innerText 数 ——
     「40 🪙」（地块解锁价）、「+7 🪙」（结算飘字）、「还能卖 2.8 🎟️」（收获弹层）
     里也有图标，那些是**上下文**，不是重复。
     ⚠️ 必须**排除 `header` 和 `nav`**：
       · `header` 就是被比对的基准本身；
       · `nav` 是底部 TabBar，🪙 / 🌾 在那里是**导航图标**（积分 / 农场），
         不是币种展示 —— 探针实测：不排除的话会数出 2 个，误判成「还在重复」。
     可见性用 rect 而不是 offsetParent：顶栏是 sticky，别赌 offsetParent 的语义。 */
  const glyphCount = await page.evaluate(
    (glyphs) => {
      const count = (g) =>
        [...document.querySelectorAll('span')].filter((el) => {
          const r = el.getBoundingClientRect()
          return (
            el.children.length === 0 &&
            r.width > 0 &&
            r.height > 0 &&
            (el.textContent ?? '').trim() === g &&
            !el.closest('header') &&
            !el.closest('nav')
          )
        }).length
      return { coin: count(glyphs.points), coupon: count(glyphs.coupon) }
    },
    { points: POINTS.emoji, coupon: COUPON.emoji },
  )
  check(
    `农场页正文里没有 ${POINTS.emoji}（不再和全局顶栏重复）`,
    glyphCount.coin === 0,
    `正文里 ${POINTS.emoji} x${glyphCount.coin}`,
  )
  check(
    `农场页正文里没有 ${COUPON.emoji}（不再和全局顶栏重复）`,
    glyphCount.coupon === 0,
    `正文里 ${COUPON.emoji} x${glyphCount.coupon}`,
  )
  // 打开种子商店
  const shopOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => /种子|商店/.test(x.innerText) || /种子|商店/.test(x.getAttribute('aria-label') ?? ''),
    )
    if (b) { b.click(); return true }
    return false
  })
  check('种子商店可打开', shopOpened)

  if (shopOpened) {
    await new Promise((r) => setTimeout(r, 1000))
    const shopText = await page.evaluate(() => document.body.innerText)
    check('种子商店列出作物', /胡萝卜|草莓|玉米|番茄/.test(shopText))

    // 开局死锁回归（2026-09-15）：种子商店曾经拿 `unlockLevel` 跟**收获次数**比，
    // 于是 0 收获时 `1 > 0` 恒真 —— 12 个种子全锁，而没种子就种不了、
    // 种不了就永远没收获。这里直接盯「至少有一个能点」。
    const seedPick = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('button')].filter((x) =>
        /选择.+种子/.test(x.getAttribute('aria-label') ?? ''),
      )
      return { total: rows.length, enabled: rows.filter((x) => !x.disabled).length }
    })
  check(
    '新农场至少有一个种子能买（否则开局即死锁）',
    seedPick.total > 0 && seedPick.enabled > 0,
    `${seedPick.enabled}/${seedPick.total} 个可点`,
  )
  }

  /* ---------- 5b. 市场弹层：结的是商城币 🎟️，不是积分 🪙 ----------
     2026-09-16 修的两个「文案和机制对不上」：

     ① `MarketSheet` 顶部币种胶囊错传了 `balance`（积分），而 `sellProduce`
        结的是 `harvestBalance`（商城币，2026-10-16 前叫丰收币）。孩子卖完东西，**眼前那个数字一动不动**，
        看起来就是「市场卖出坏了」。而且顶栏本来就已经有一颗 🪙 积分，
        弹层里再来一颗一模一样的，更容易看串。

     ② 弹层底部写过一行「全卖会拿到 X 分，和刚才比少了 N 分 —— 因为一次卖太多，
        价格被压下去了」，而 `N` 恒等于 0：`sellQuote` 是「现价 × 个数」，线性的，
        `unit * count - total` 只剩四舍五入的余数。等于自相矛盾地教了一条假规则。

     这两处都只能靠**渲染出来的字**钉住（领域函数是对的，错的是 UI 接线），
     所以放在第 4 层界面走查，不放单元测试。
     币种/文案那几条不依赖有没有货（空背包时弹层照样开、胶囊照样渲染），
     但**卖出按钮**只在「背包里有货」时才渲染 —— 空背包走的是
     「背包还是空的」空状态，连 `<ul>` 都没有。所以这里先补种补收一次。 */
  await page.evaluate(() => {
    // 先把种子商店关掉（✕ 有 aria-label="关闭"）
    const close = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === '关闭',
    )
    close?.click()
  })
  await new Promise((r) => setTimeout(r, 500))

  // 拧快农场时钟 + 关掉灾害，让胡萝卜两秒内成熟（只影响本段，末尾会还原）
  const seeded = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    if (!empty) return { ok: false, why: '没有已解锁的空地' }
    const planted = await st().plant(empty.index, 'carrot')
    return { ok: planted, index: empty.index }
  })
  if (seeded.ok) {
    await new Promise((r) => setTimeout(r, 2200))
    const stored = await page.evaluate(async (i) => {
      const st = () => window.__kqf__.getState()
      // 收进背包：市场里才会有货、展开行才会出现卖出按钮
      await st().harvest(i, 'store')
      await new Promise((r) => setTimeout(r, 600))
      return st().inventory.find((x) => x.itemId === 'produce-carrot')?.count ?? 0
    }, seeded.index)
    check('背包里补到了能卖的产出（卖出按钮才会渲染）', stored > 0, `胡萝卜 x${stored}`)
  } else {
    check('背包里补到了能卖的产出（卖出按钮才会渲染）', false, seeded.why ?? '种不下去')
  }

  const marketOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /市场/.test(x.innerText))
    if (!b) return false
    b.click()
    return true
  })
  check('市场入口可打开', marketOpened)
  await new Promise((r) => setTimeout(r, 900))

  const marketRes = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, ' ')
    const h2 = [...document.querySelectorAll('h2')].find(
      (h) => (h.textContent ?? '').trim() === '农场市场',
    )
    // 弹层头 = h2 的父容器（BottomSheet 里 h2 和 headerRight 是兄弟）
    const head = h2?.parentElement ?? null
    const headGlyphs = head
      ? [...head.querySelectorAll('span')]
          .filter((s) => s.children.length === 0)
          .map((s) => (s.textContent ?? '').trim())
          .filter(Boolean)
      : []
    return {
      sheetOpen: !!h2,
      headGlyphs,
      hasFalseHint: /和刚才比少了/.test(text),
      saysFenPerUnit: /[\d.]+\s*分\s*\/\s*个/.test(text),
      saysFenTotal: /产出大约值\s*[\d.]+\s*分/.test(text),
    }
  })
  check('市场弹层已打开', marketRes.sheetOpen === true)
  check(
    `市场弹层顶部的币种是${COUPON.name} ${COUPON.emoji}（不是${POINTS.name} ${POINTS.emoji}）`,
    marketRes.headGlyphs.includes(COUPON.emoji) && !marketRes.headGlyphs.includes(POINTS.emoji),
    `弹层头里的图标：${JSON.stringify(marketRes.headGlyphs)}`,
  )
  check(
    '市场弹层里没有「和刚才比少了 N 分」那行假提示',
    marketRes.hasFalseHint === false,
  )
  check(
    `市场弹层里的单价/总额都写 ${COUPON.emoji}，不写「分」`,
    marketRes.saysFenPerUnit === false && marketRes.saysFenTotal === false,
    `分/个=${marketRes.saysFenPerUnit} 值…分=${marketRes.saysFenTotal}`,
  )

  /* 卖出按钮的标签不许换行。
     ------------------------------------------------------------
     2026-09-16 修 bug 时踩的：给按钮加上币种单位「🌾」之后，三个按钮
     （flex-1 / flex-1 / flex-[1.4]）在 390px 视口下每个只剩 **94px**，
     而「卖 1 个 +2 🌾」要 ~97px → 🌾 被挤到第二行，按钮变成两行高。
     现在改成两行网格（上两个、全卖独占一行，宽 163 / 334），余量充足。

     ⚠️ **判「换没换行」只能用 Range。** 两个看似可行、实测都失效的判据：
       · `Element.getClientRects()` 对块级元素只返回 1 个矩形（元素框本身），
         永远看不出文字换了几行；
       · `scrollHeight > clientHeight` 也不行 —— 按钮有 `min-h-[46px]` 兜着，
         两行文字照样塞得下，scrollHeight 不变。
     `Range.getClientRects()` 是**每行一个矩形**，按 top 去重才是真行数。
     展开任意一行即可 —— 没货时按钮是 disabled，但照样渲染、照样能量。 */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('li button')].find((b) => /有\s*\d/.test(b.innerText))
    row?.click()
  })
  await new Promise((r) => setTimeout(r, 700))

  /* ---------- 5c. 走势图不许暴露价格边界（上限 / 下限） ----------
     ------------------------------------------------------------
     2026-09-30 改：这条断言**反过来了**。

     它以前是「图上的『上限』必须 == 引擎的硬顶」—— 钉的是 2026-09-18
     那次 UI 接线错误（`MarketSheet` 给 `PriceChart` 传的还是旧口径
     `q.base * 1.6`）。

     但 2026-09-29 用户明确要求**把上限/下限整个拿掉**：
     「走势图上的『上限/下限』标签直接暴露了价格边界，孩子一看就知道
      底价和天花板。」—— 于是 `PriceChart` 的 `ceiling` / `floor`
     两个参数被删掉，虚线、标签、以及用 `Math.max(series, ceiling)`
     撑出来的那段空白一起没了。

     所以判据从「上限印得对不对」变成「**根本不许印**」。
     期望值仍然不写死，向 `catalog.priceCeiling()` 要真实数值 ——
     万一哪天有人把上限又画回去，这里要立刻红，
     而不是等孩子看图学会「这价到底了」。

     ⚠️ 判据用 `/上限/` 而不是 `/上限\s*[\d.]+/`：只要出现「上限」两个字
     就算暴露，不要求它带数字（标签先回来、数字后补的情况也要拦得住）。 */
  const chartRes = await page.evaluate(() => {
    const ITEM = 'produce-carrot' // 本段只收过胡萝卜，展开的就是它
    const row = [...document.querySelectorAll('li')].find((li) =>
      /最近\s*7\s*天价格/.test(li.innerText),
    )
    const text = row?.innerText ?? ''
    return {
      rowFound: !!row,
      rowName: (row?.querySelector('p')?.textContent ?? '').trim(),
      hasCeilingLabel: /上限/.test(text),
      hasFloorLabel: /下限/.test(text),
      expected: window.__kqf__.catalog.priceCeiling(ITEM),
      base:
        window.__kqf__.getState().market.quotes.find((q) => q.itemId === ITEM)?.base ?? null,
    }
  })
  check('展开的行渲染出了走势图', chartRes.rowFound === true, `行名：${chartRes.rowName}`)
  check(
    '走势图不暴露价格上限（孩子不该看见天花板）',
    !chartRes.hasCeilingLabel,
    chartRes.hasCeilingLabel
      ? `图上出现了「上限」（引擎硬顶 ${chartRes.expected}，基准价 ${chartRes.base}）`
      : `没有「上限」· 引擎硬顶 ${chartRes.expected} · 基准价 ${chartRes.base}`,
  )
  check(
    '走势图不暴露价格下限（孩子不该看见地板价）',
    !chartRes.hasFloorLabel,
    chartRes.hasFloorLabel ? '图上出现了「下限」' : '',
  )

  const sellBtns = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('li button')].filter((b) => /卖|全卖/.test(b.innerText))
    return btns.map((b) => {
      const range = document.createRange()
      range.selectNodeContents(b)
      const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size
      return {
        text: b.innerText.replace(/\s+/g, ' '),
        w: Math.round(b.getBoundingClientRect().width),
        lines,
      }
    })
  })
  check(
    '市场卖出按钮渲染出来了（展开行才有）',
    sellBtns.length === 3,
    sellBtns.map((b) => b.text).join(' | ') || '(一个都没有)',
  )
  check(
    `卖出按钮的文案都在一行里（币种 ${COUPON.emoji} 没被挤下去）`,
    sellBtns.length > 0 && sellBtns.every((b) => b.lines === 1),
    sellBtns.map((b) => `${b.text} → ${b.lines} 行 / ${b.w}px`).join('；'),
  )
  check(
    '卖出按钮够宽，三、四位数也放得下',
    sellBtns.length > 0 && sellBtns.every((b) => b.w >= 150),
    sellBtns.map((b) => `${b.w}px`).join(' / '),
  )

  // 关掉，别污染后面的流程
  await page.evaluate(() => {
    const close = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === '关闭',
    )
    close?.click()
  })
  await new Promise((r) => setTimeout(r, 500))

  // 还原本段拧过的设置（时钟 / 灾害），后面的段落不该继承
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: true })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1 } })
  })

  /* ★ 2026-11-10：农场 / 市场那几段都在**全屏**的游戏页里（顶栏按设计不渲染）。
     进第 6 段之前先点左上角「退出游戏」回到外壳 ——
     不退的话，下面「顶栏有家长确认入口」这类断言会全部假红。
     顺便在这里补上「顶栏那两颗币确实还在」的反向保证：
     前面「农场正文里没有 🪙/🎫」不能被「把顶栏也删了」蒙过去。 */
  await page.evaluate(() => {
    document.querySelector('[data-tour="exit-game"], nav [data-tour="tab-tasks"]')?.click()
  })
  await new Promise((r) => setTimeout(r, 800))
  const shellBack = await page.evaluate(() => ({
    nav: document.querySelectorAll('nav [data-tour]').length,
    header: !!document.querySelector('header'),
  }))
  check(
    '从农场退出来之后回到外壳（顶栏 + 底栏 4 格）',
    shellBack.header && shellBack.nav === 4,
    `header=${shellBack.header} nav=${shellBack.nav}`,
  )
  const headerCurrencies = await page.evaluate(
    (names) =>
      [...document.querySelectorAll('header [aria-label]')]
        .map((el) => el.getAttribute('aria-label') ?? '')
        .filter((l) => names.some((n) => l.startsWith(n))),
    [POINTS.name, COUPON.name],
  )
  check(
    `全局顶栏仍然显示${POINTS.name}和${COUPON.name}（上面两条不是因为顶栏被删才通过的）`,
    headerCurrencies.length === 2,
    headerCurrencies.join(' / ') || '顶栏里一个都没找到',
  )

  /* ---------- 6. 家长确认：必须要求密码，且输对后能进入打分 ---------- */
  // 先设密码 + 造一个待审实例，否则队列是空的，测不出解锁效果
  await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    await s.updateSettings({ parentPin: '1234', protectParentActions: true })
    const t = await s.addTask({
      title: '__e2e_review',
      category: 'study',
      cycle: 'once',
      plannedMinutes: 10,
      basePoints: 20,
      allowOvertime: true,
      allowLateNoPenalty: false,
      qualityRated: false,
    })
    const inst = window.__kqf__
      .getState()
      .instances.find((i) => i.taskId === t.id && i.status === 'pending')
    if (inst) await window.__kqf__.getState().submitInstance(inst.id, 8, undefined)
  })
  await new Promise((r) => setTimeout(r, 900))

  const openedReview = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label^="家长确认"]')
    if (b) { b.click(); return true }
    return false
  })
  check('顶栏有「家长确认」入口', openedReview)

  await new Promise((r) => setTimeout(r, 800))
  // 只看对话框内部 —— 页面背景里本来就有"确认奖励"这类字，
  // 用 document.body 会把背景文字也匹配进来，那是假阳性。
  const gate = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return {
      text: d ? d.innerText : '',
      hasPinPad: !!d && [...d.querySelectorAll('button')].some((b) => b.innerText.trim() === '确定'),
      hasGradeBtn: !!d && [...d.querySelectorAll('button')].some((b) => /✅ 确认奖励/.test(b.innerText)),
    }
  })
  check(
    '家长确认打开后要求输入密码',
    /请爸爸妈妈来一下/.test(gate.text) && gate.hasPinPad,
    gate.text.replace(/\s+/g, ' ').slice(0, 60),
  )
  check('未通过密码时不渲染「确认奖励」按钮', gate.hasGradeBtn === false)

  // 逐个点 1 2 3 4 —— 必须验证"输对了真的能进去"。
  // 这正是之前的 bug：第 4 位自动提交读的是旧 state，输对了毫无反应。
  for (const k of ['1', '2', '3', '4']) {
    await page.evaluate((key) => {
      const d = document.querySelector('[role="dialog"]')
      const b = [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === key)
      b?.click()
    }, k)
    await new Promise((r) => setTimeout(r, 200))
  }
  await new Promise((r) => setTimeout(r, 1200))

  const unlocked = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    const t = d ? d.innerText : ''
    return {
      text: t.replace(/\s+/g, ' ').slice(0, 90),
      hasGradeBtn: !!d && [...d.querySelectorAll('button')].some((b) => /✅ 确认奖励/.test(b.innerText)),
      stillLocked: /请爸爸妈妈来一下/.test(t),
    }
  })
  check(
    '输对密码后进入打分界面（不再是锁屏）',
    unlocked.hasGradeBtn && !unlocked.stillLocked,
    unlocked.text,
  )

  /* 对照组：同一个正则，用在**家长端**必须命中全部五档。
     没有这一步的话，上面那条「孩子端没有质量自评按钮」是**单向**断言 ——
     正则一旦退化成什么都匹配不到（比如档位改名了），孩子端那检查照样绿，
     而它其实什么都没守住。
     2026-10 真的发生过：三档改五档，中间档「不错」→「良好」，
     e2e-check 里硬编码的 /一般|不错|特别棒/ 从此少匹配一个档位却**不报错**。 */
  const parentGrades = await page.evaluate(
    (src) => {
      const d = document.querySelector('[role="dialog"]')
      if (!d) return null
      const re = new RegExp(src)
      return [...d.querySelectorAll('button')]
        .map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim())
        .filter((t) => re.test(t))
    },
    QUALITY_LABEL_RE.source,
  )
  check(
    '对照组：家长端打分表的每一档都能被这个正则认出来',
    parentGrades?.length === QUALITY_GRADE_COUNT,
    parentGrades
      ? `${parentGrades.length}/${QUALITY_GRADE_COUNT} 个：${parentGrades.join(' / ')}`
      : '没拿到打分弹层',
  )

  // 点确认奖励 → 积分应到账
  const afterConfirm = await page.evaluate(async () => {
    const before = window.__kqf__.getState().balance
    const d = document.querySelector('[role="dialog"]')
    const b = [...d.querySelectorAll('button')].find((x) => /✅ 确认奖励/.test(x.innerText))
    b?.click()
    await new Promise((r) => setTimeout(r, 1200))
    return { before, after: window.__kqf__.getState().balance }
  })
  check(
    '家长确认后积分到账',
    afterConfirm.after > afterConfirm.before,
    `${afterConfirm.before} → ${afterConfirm.after}`,
  )

  // 关掉弹层
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '关闭')
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 600))

  /* ---------- 6b. 签到审核卡：「确认后得到」必须等于真的到账（2026-10-09） ----------
     修掉的 bug：卡片上写的是 `+task.basePoints`，而 grantCheckIn 实发
     base + 阶梯 —— 全新账号首日写着 5、点下去到账 7（首档 +2）。
     家长看到的是一个数、孩子拿到的是另一个数。
     （2026-10-11 起签到没有连击了，这里的 7 只剩 base + 阶梯 两项。）

     单测只能钉住 store 的发放口径，**钉不住这张卡片渲染出来的字**，
     所以必须在真浏览器里把显示出来的数字读出来，再跟余额增量对一次。 */
  await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    await s.updateSettings({ parentReviewEnabled: true })
    // 用 4c 里读过的**同一个任务** —— 这样「孩子端预告 7 → 家长端预告 7 → 实发 7」
    // 说的是同一个对象，不是三个碰巧都等于 7 的不同任务。
    const t = s.tasks.find((x) => x.title === '学习日复述每天学习内容')
    await s.doCheckIn(t.id) // 挂进待审，不发分
  })
  await new Promise((r) => setTimeout(r, 900))

  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label^="家长确认"]')
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 800))
  // 弹层每次打开都重新上锁 —— 6 里那次解锁已经随着关闭失效了
  for (const k of ['1', '2', '3', '4']) {
    await page.evaluate((key) => {
      const d = document.querySelector('[role="dialog"]')
      const b = d && [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === key)
      b?.click()
    }, k)
    await new Promise((r) => setTimeout(r, 200))
  }
  await new Promise((r) => setTimeout(r, 1200))

  const ciCard = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    if (!d) return null
    const text = d.innerText.replace(/\s+/g, ' ')
    const m = text.match(/确认后得到\s*\+?\s*(\d+)/)
    return {
      text: text.slice(0, 120),
      shown: m ? Number(m[1]) : null,
      hasBtn: [...d.querySelectorAll('button')].some((b) => /确认这一天做到了/.test(b.innerText)),
    }
  })
  check('签到待审出现在家长队列里（签到卡渲染出来了）', !!ciCard?.hasBtn, ciCard?.text ?? '没拿到弹层')
  check(
    '签到卡的「确认后得到」是基础分 + 阶梯（第 1 天 = 7，不是光秃秃的 5）',
    ciCard?.shown === 7,
    ciCard ? `读到 ${ciCard.shown} ｜ ${ciCard.text.slice(0, 80)}` : '没读到',
  )

  const ciPaid = await page.evaluate(async () => {
    const before = window.__kqf__.getState().balance
    const d = document.querySelector('[role="dialog"]')
    const b = d && [...d.querySelectorAll('button')].find((x) => /确认这一天做到了/.test(x.innerText))
    b?.click()
    await new Promise((r) => setTimeout(r, 1400))
    return { before, after: window.__kqf__.getState().balance }
  })
  check(
    '签到审核卡预告的分 = 实际到账的分（这一条就是那个 bug 的护栏）',
    ciCard?.shown != null && ciPaid.after - ciPaid.before === ciCard.shown,
    `卡片写 ${ciCard?.shown}，实发 ${ciPaid.after - ciPaid.before}（${ciPaid.before} → ${ciPaid.after}）`,
  )

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '关闭')
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 600))

  /* ---------- 7. 数据导出 ---------- */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('⚙️'))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 900))
  const settingsText = await page.evaluate(() => document.body.innerText)
  check('设置页可打开', /设置|孩子|规则|数据/.test(settingsText))

  const exported = await page.evaluate(async () => {
    // 通过窗口上的调试句柄触发导出逻辑，校验备份结构（不依赖真实下载行为）
    const w = window
    if (!w.__kqf__) return null
    return await w.__kqf__.exportBackup()
  })
  if (exported) {
    check('导出数据结构正确', exported.app === 'kid-quest-farm' && !!exported.data, JSON.stringify(Object.keys(exported.data ?? {})).slice(0, 120))
    check('导出含任务定义', Array.isArray(exported.data.tasks) && exported.data.tasks.length > 0, `${exported.data.tasks?.length} 个任务`)
    // 心愿商城的两张表：`wishOffers`（家长定价）、`wishOrders`（含押券数）。
    // 这两张表是**后加的**，`exportBackup` 是逐表列举的 —— 新表不加就永远不导出，
    // 而且不报错。单元测试已经钉了内容，这里钉的是「浏览器里跑出来的那一份」
    // 真的带上了这两个 key（曾经出过「单测绿、产物里没有」的先例）。
    const dataKeys = Object.keys(exported.data ?? {})
    check('导出含心愿商城两张表', dataKeys.includes('wishOffers') && dataKeys.includes('wishOrders'), dataKeys.filter((k) => k.startsWith('wish')).join(',') || '(无 wish 字段)')
    // 兑换码那张表（v10 加的）：必须跟 `mallLedger` 同进同出。漏了它 ⇒
    // 清空 / 恢复旧备份之后游戏没了而码还标着「用过」⇒ 那张实体卡作废。
    check('导出含兑换码表', dataKeys.includes('wishCodes'), dataKeys.filter((k) => k.startsWith('wish')).join(',') || '(无 wish 字段)')
    // 备份里不能有完整收货信息（spec §9.1）。这里只查 key 名 —— 真值断言在单测里。
    check('导出不含 ship 原字段', !JSON.stringify(exported).includes('"ship"'))
  } else {
    check('导出数据', false, '未拿到导出结果')
  }

  /* ---------- 7b. 设置页的「音效 / 震动」开关 ---------- */
  // `soundEnabled` / `hapticsEnabled` 一直在 settings 里、默认都开着，
  // 但设置页**没有对应的开关** —— 也就是说家长根本关不掉。
  // 这条守的是「开关存在、能点、而且真的落库」。
  //
  /* 前置：先关掉家长保护，让「规则」页签里的开关可用。
     ⚠️ 2026-10-30 起**不能**再用「清空 parentPin」来开锁了：没密码 =
     还没设过，闸门会改成要求当场设一个（输两遍），页签永远打不开。
     关闸门只有 `protectParentActions: false` 这一条路。
     也不去模拟 1-2-3-4 的键盘 —— 数字按钮在别的页签也会出现，选择器不稳。 */
  const soundToggle = await page.evaluate(async () => {
    await window.__kqf__.getState().updateSettings({ protectParentActions: false })
    await new Promise((r) => setTimeout(r, 600))
    const tabBtn = [...document.querySelectorAll('button')].find((x) => /规则/.test(x.innerText))
    tabBtn?.click()
    await new Promise((r) => setTimeout(r, 600))
    const el = document.querySelector('button[role="switch"][aria-label="音效"]')
    const hz = document.querySelector('button[role="switch"][aria-label="震动"]')
    const s = window.__kqf__.getState().settings
    return {
      hasSound: !!el,
      hasHaptics: !!hz,
      soundChecked: el?.getAttribute('aria-checked') ?? null,
      hapticsChecked: hz?.getAttribute('aria-checked') ?? null,
      storeSound: s.soundEnabled,
      storeHaptics: s.hapticsEnabled,
    }
  })
  check('设置页有「音效」开关', soundToggle.hasSound)
  check('设置页有「震动」开关', soundToggle.hasHaptics)
  check(
    '两个开关的初始状态和 settings 一致',
    soundToggle.soundChecked === String(soundToggle.storeSound) &&
      soundToggle.hapticsChecked === String(soundToggle.storeHaptics),
    `音效 aria=${soundToggle.soundChecked}/store=${soundToggle.storeSound}；` +
      `震动 aria=${soundToggle.hapticsChecked}/store=${soundToggle.storeHaptics}`,
  )

  // 真的点一下 —— 只看"界面动了"不够，要确认**落库了**
  const flipped = await page.evaluate(async () => {
    const el = document.querySelector('button[role="switch"][aria-label="音效"]')
    if (!el) return { skipped: true }
    if (el.hasAttribute('disabled')) return { disabled: true }
    const before = window.__kqf__.getState().settings.soundEnabled
    el.click()
    await new Promise((r) => setTimeout(r, 700))
    return {
      before,
      after: window.__kqf__.getState().settings.soundEnabled,
      ariaAfter: document
        .querySelector('button[role="switch"][aria-label="音效"]')
        ?.getAttribute('aria-checked'),
    }
  })
  check(
    '点「音效」能真的关掉（落库 + 界面同步）',
    !flipped.skipped &&
      !flipped.disabled &&
      flipped.before === true &&
      flipped.after === false &&
      flipped.ariaAfter === 'false',
    flipped.skipped
      ? '没找到开关'
      : flipped.disabled
        ? '开关是禁用的（家长锁没开）'
        : `${flipped.before} → ${flipped.after}（aria=${flipped.ariaAfter}）`,
  )

  // 还原：音效拨回去、家长密码复原（默认是 '0000'），别影响后面的断言与截图
  await page.evaluate(async () => {
    const el = document.querySelector('button[role="switch"][aria-label="音效"]')
    if (el && !el.hasAttribute('disabled') && el.getAttribute('aria-checked') === 'false') el.click()
    await new Promise((r) => setTimeout(r, 400))
    await window.__kqf__.getState().updateSettings({ parentPin: '0000' })
    await new Promise((r) => setTimeout(r, 400))
  })

  /* ---------- 8. 同一个数只显示一次（兑换页 / 积分页） ---------- */
  // 用户报的：「兑换页有重复的积分显示，还有『你有 xx 积分』这句不需要；
  // 我的积分页也是一样。」
  // 规矩：余额只在全局顶栏（App.tsx 的 sticky header）说一次，
  // 页面正文不许再报一遍同一个数。
  //
  // ⚠️ 判据**不能**写成「页面里没有 🪙 这个字形」——
  //    兑换页每件商品的价签（farmUi.tsx 的 CoinPill）就带 🪙，
  //    那是**单价**，不是余额。按字形数会把价签全算成"重复显示"。
  //    真正的余额牌有个特征：🪙 图标**不带 aria-hidden**，且同一个容器里
  //    还有一个「整段文字就是余额数字」的叶子节点。价签的 🪙 恰好是
  //    aria-hidden 的，于是天然被排除 —— 判据锚在图标上，不锚在数字上。
  //
  // ⚠️ 判据**也不能**写成「整页只有一个元素的文字 == 余额」——
  //    e2e 跑的是全新档案，所有收入都发生在"今天"，于是积分页 7 日柱状图里
  //    "今天"那根柱子的数字**必然等于余额**（两者本来就是同一个和）。
  //    拿数字裸比一定误报，且误报得像"真发现了 bug"。
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /←|返回/.test(x.innerText))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 700))

  /**
   * 量一次「正文里有没有余额牌」。
   *
   * @param rootSel 这次要查的「正文」根节点。
   * @param how     怎么把这一屏打开：`{ kind: 'tab', label }` 点底栏，
   *                `{ kind: 'points' }` 点顶栏那颗 🪙。
   *
   * ⚠️ 2026-11-05：积分页不再是底栏一格，改成从顶栏点开一层
   * `[data-points-sheet]`。它 Portal 到 body，**不在 `<main>` 里** ——
   * 所以根节点必须由调用方给。写死 `main` 的话，
   * 「main 里没有余额牌」永远成立，这条断言就变成了空转（假绿）。
   */
  const probeBalanceChips = async (rootSel, how) => {
    await page.evaluate((h) => {
      if (h.kind === 'points') {
        document.querySelector('[data-tour="header-points"]')?.click()
        return
      }
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.innerText.trim().split('\n').pop().trim() === h.label,
      )
      b?.click()
    }, how)
    await new Promise((r) => setTimeout(r, 1000))
    return page.evaluate((sel) => {
      const bal = String(window.__kqf__.getState().balance)
      /**
       * 找「余额牌」：一个容器，里面同时有
       *   (a) 一个**不带 aria-hidden** 的 🪙 图标叶子节点，和
       *   (b) 一个整段文字就是余额数字的叶子节点。
       *
       * ⚠️ 向上找祖先时必须**卡在 root 里**（`root.contains(a)`）。
       *    否则会爬出页面内容区、一路爬到 App 外壳 ——
       *    外壳里同时装着顶栏和正文，于是底栏那个 🪙 导航图标
       *    会"找到"顶栏里的余额数字，把顶栏本身报成正文里的重复。
       *    （这条判据第一次就是这么做错的：报出来的"命中"文本是整个页面。）
       */
      const findChips = (root) => {
        const out = []
        for (const ic of root.querySelectorAll('*')) {
          const r = ic.getBoundingClientRect()
          if (ic.children.length !== 0 || r.width <= 0 || r.height <= 0) continue
          if ((ic.textContent ?? '').trim() !== '🪙') continue
          if (ic.hasAttribute('aria-hidden')) continue // 价签的图标，跳过
          for (let a = ic.parentElement, i = 0; a && i < 5 && root.contains(a); a = a.parentElement, i++) {
            const hasBalance = [...a.querySelectorAll('*')].some(
              (e) =>
                e.children.length === 0 &&
                (e.textContent ?? '').trim() === bal &&
                e.getBoundingClientRect().width > 0,
            )
            if (hasBalance) {
              out.push(a)
              break
            }
          }
        }
        return out
      }
      // 正文根节点由调用方给：普通 tab 是 `<main>`（顶栏 `<header>` 和它是
      // 兄弟节点，所以"在 main 里"就等于"不在顶栏里"，比 closest 过滤更不易漏）；
      // 积分层是 `[data-points-sheet]` —— 它 Portal 到 body，不在 main 里。
      const root = document.querySelector(sel)
      const header = document.querySelector('header')
      const inBody = root ? findChips(root) : []
      return {
        /* 根节点没找到时下面那两条「没有余额牌」会**无条件通过** ——
           所以必须单独报出来，不然「积分层根本没打开」会被读成「去重做对了」。 */
        rootFound: !!root,
        bodyChips: inBody.length,
        sample: inBody.slice(0, 3).map((el) =>
          (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
        ),
        headerChips: header ? findChips(header).length : 0,
        headerText: (header?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        text: document.body.innerText,
      }
    }, rootSel)
  }

  for (const [rootSel, pageName, how] of [
    ['main', '兑换页', { kind: 'tab', label: '兑换' }],
    ['[data-points-sheet]', '积分页', { kind: 'points' }],
  ]) {
    const p = await probeBalanceChips(rootSel, how)
    check(
      `${pageName}真的打开了（${rootSel}）`,
      p.rootFound,
      p.rootFound ? '' : `找不到 ${rootSel} —— 下面两条会无条件通过，先看这里`,
    )
    check(
      `${pageName}正文里没有余额牌（余额只在全局顶栏）`,
      p.bodyChips === 0,
      p.bodyChips === 0 ? '' : `命中 ${p.bodyChips} 处：${p.sample.join(' ｜ ')}`,
    )
    check(
      `${pageName}不再写「你有 N 分」/「现在一共有 N」`,
      !/你有/.test(p.text) && !/现在一共有/.test(p.text),
      `你有=${/你有/.test(p.text)} 现在一共有=${/现在一共有/.test(p.text)}`,
    )
    /* 积分层是**盖住整屏**的，不关掉的话后面每一步都点不到东西 ——
       而且那种失败会伪装成「顶栏没有余额牌」，查半天查不到真因。 */
    if (how.kind === 'points') {
      await page.evaluate(() => document.querySelector('[data-points-close]')?.click())
      await new Promise((r) => setTimeout(r, 600))
      check(
        '积分层点「←」能关掉',
        !(await page.evaluate(() => !!document.querySelector('[data-points-sheet]'))),
      )
    }
  }

  /* ---------- 8a. 底栏真的只剩四格（2026-11-05） ----------
     用户原话：「下边栏 4 个为好」。
     「积分那一页还能打开」只能证明功能没丢，**证明不了底栏真的少了那一格** ——
     所以这里直接数底栏里带 `data-tour="tab-*"` 的按钮，并单独确认
     `tab-points` 不存在、`header-points` 存在。 */
  const navProbe = await page.evaluate(() => {
    const nav = document.querySelector('nav')
    const tabs = [...(nav?.querySelectorAll('[data-tour^="tab-"]') ?? [])]
    return {
      n: tabs.length,
      names: tabs.map((t) => t.getAttribute('data-tour')),
      hasPointsTab: !!document.querySelector('[data-tour="tab-points"]'),
      hasPointsHeader: !!document.querySelector('[data-tour="header-points"]'),
    }
  })
  check(
    '底栏正好四格',
    navProbe.n === 4,
    `${navProbe.n} 格：${navProbe.names.join(' / ')}`,
  )
  check(
    '「积分」不在底栏，改成顶栏那颗 🪙',
    !navProbe.hasPointsTab && navProbe.hasPointsHeader,
    `tab-points=${navProbe.hasPointsTab} header-points=${navProbe.hasPointsHeader}`,
  )

  // 反向保证：顶栏必须**还在**显示余额。
  // 否则"页面正文里没有余额牌"就成了"整屏都没有"，那是把功能删了而不是去重。
  const headerChip = await probeBalanceChips('main', { kind: 'tab', label: '任务' })
  check(
    `全局顶栏仍然显示${MALL.name}、${POINTS.name}和${COUPON.name}`,
    headerChip.headerChips >= 1 &&
      headerChip.headerText.includes(MALL.emoji) &&
      headerChip.headerText.includes(POINTS.emoji) &&
      headerChip.headerText.includes(COUPON.emoji),
    headerChip.headerText,
  )

  /* ---------- 8b. 现金对积分参考汇率（2026-09-21） ----------
     用户要求：「设置里 添加 现金对积分 比例。 默认 1:10 。 也要显示到兑换页。
     主要是让家长看着， 兑换能够参照的， 不影响数值。」

     ⚠️ 这条守的是**界面这条路**，不是那个数本身。
     单测已经验过 `updateSettings` 落库 + `formatYuan` 的数学（`cash.test.ts`），
     但**没验**：「点预设按钮 / 自己填 → 真的落库」以及「设置页的预览真的跟着变」。

     ⚠️ 2026-09-30 用户把**兑换页**上的 ≈¥X 去掉了（原话：「🪙120 ≈¥12 兑换页
     这种感觉不用显示。有付款了。」）。所以第 ③ 段从「必须标」**反转**成
     「不许标」—— 反转而不是删除，否则将来谁把这段 UI 加回来都没人拦。
     设置页那一半（①②）不受影响，汇率功能本身还在。

     ⚠️ 自定义输入是**受控输入框 + 失焦提交**，直接 `input.value = '33'`
     React 收不到 onChange（值会被打回去），必须走原生 setter + 派发 input 事件。 */
  const ratioUi = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    // 同上：关闸门靠 protectParentActions，不是清空密码
    await window.__kqf__.getState().updateSettings({ protectParentActions: false })
    await sleep(500)
    document.querySelector('button[aria-label="设置"]')?.click()
    await sleep(700)
    const tabBtn = [...document.querySelectorAll('button')].find((x) => /规则/.test(x.innerText))
    tabBtn?.click()
    await sleep(700)

    const card = [...document.querySelectorAll('section')].find((s) =>
      /现金对积分/.test(s.querySelector('h2')?.textContent ?? ''),
    )
    if (!card) return { noCard: true }

    // ① 点预设「1 元 = 20 分」
    const preset = [...card.querySelectorAll('button')].find(
      (b) => b.textContent.trim() === '1 元 = 20 分',
    )
    preset?.click()
    await sleep(600)
    const afterPreset = window.__kqf__.getState().settings.pointsPerYuan
    const presetText = card.innerText

    // ② 自己填 33 —— 走原生 setter，React 才收得到
    const input = card.querySelector('input[type="number"]')
    let afterType = null
    let afterBlurText = ''
    if (input) {
      // ⚠️ 必须先 focus：`blur()` 对**没有焦点**的元素是空操作，不会派发
      // blur/focusout，React 的 onBlur 也就不会触发 —— 于是"失焦提交"这条
      // 根本走不到，用例会以"没提交"的形式假失败（或更糟：假通过）。
      input.focus()
      await sleep(120)
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
      ).set
      setter.call(input, '33')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      await sleep(300)
      // ⚠️ 关键：**没失焦之前不许落库**（草稿态）
      afterType = window.__kqf__.getState().settings.pointsPerYuan
      input.blur()
      await sleep(600)
      afterBlurText = card.innerText
    }

    return {
      noCard: false,
      hasPreset: !!preset,
      afterPreset,
      presetLine: /1 元 ≈ 20 分/.test(presetText),
      presetCash: /30 分的零食 ≈ ¥1\.5/.test(presetText),
      hasInput: !!input,
      afterType,
      committed: window.__kqf__.getState().settings.pointsPerYuan,
      typedLine: /1 元 ≈ 33 分/.test(afterBlurText),
    }
  })
  check('设置页有「现金对积分」卡片', !ratioUi.noCard)
  check(
    '点预设「1 元 = 20 分」→ 落库 + 预览跟着变',
    ratioUi.afterPreset === 20 && ratioUi.presetLine && ratioUi.presetCash,
    `store=${ratioUi.afterPreset}；预览「1 元 ≈ 20 分」=${ratioUi.presetLine}；` +
      `「30 分的零食 ≈ ¥1.5」=${ratioUi.presetCash}`,
  )
  check(
    '自定义输入：失焦前不落库，失焦后才提交',
    ratioUi.hasInput && ratioUi.afterType === 20 && ratioUi.committed === 33 && ratioUi.typedLine,
    `失焦前=${ratioUi.afterType}（应为 20，草稿态不许落库）→ 失焦后=${ratioUi.committed}` +
      `（应为 33）；预览跟着变=${ratioUi.typedLine}`,
  )

  // ③ 兑换页**不再**标「≈ ¥X」（2026-09-30 用户要求去掉）
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    // 从设置页退出去，再切到「兑换」
    document.querySelector('button[aria-label="返回"]')?.click()
    await sleep(700)
    const nav = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '兑换',
    )
    nav?.click()
    await sleep(1000)
  })
  const cashOnRedeem = await page.evaluate(() => {
    const hits = []
    for (const el of document.querySelectorAll('*')) {
      if (el.children.length !== 0) continue
      const t = (el.textContent ?? '').trim()
      // ⚠️ 这里**故意不锚定行首**（原来是 /^≈\s*¥/）—— 现在要抓的是
      // 「任何地方出现了 ≈¥」，锚定了反而可能漏掉被包了一层前缀的写法。
      if (!/≈\s*¥/.test(t)) continue
      if (el.getBoundingClientRect().width <= 0) continue
      hits.push(t)
    }
    return {
      ratio: window.__kqf__.getState().settings.pointsPerYuan,
      hits: hits.slice(0, 10),
      total: hits.length,
      // 替代 ≈¥ 的那条信息 —— 它必须在，否则删掉 ≈¥ 就是纯粹的信息缺失。
      hasPayLine: /付款[:：]/.test(document.body.innerText),
    }
  })
  check(
    '兑换页不再标「≈ ¥X」（2026-09-30 去掉：已经有付款行了）',
    cashOnRedeem.total === 0,
    cashOnRedeem.total
      ? `汇率=${cashOnRedeem.ratio}；还标着 ${cashOnRedeem.total} 条：${JSON.stringify(cashOnRedeem.hits)}`
      : `一条都没有（汇率=${cashOnRedeem.ratio}）`,
  )
  check(
    `取代它的「付款：${COUPON.emoji} x + ${POINTS.emoji} y」还在（这是删 ≈¥ 的前提）`,
    cashOnRedeem.hasPayLine,
    cashOnRedeem.hasPayLine
      ? '在'
      : '不在 —— 那 ≈¥ 就不该删（否则孩子看不到「怎么付」）',
  )

  // 还原：汇率回默认 10、家长密码复原，别影响后面的断言与截图
  await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    await window.__kqf__.getState().updateSettings({ pointsPerYuan: 10 })
    await sleep(400)
    await window.__kqf__.getState().updateSettings({ parentPin: '0000' })
    await sleep(400)
    const b = [...document.querySelectorAll('button')].find((x) => /←|返回/.test(x.innerText))
    b?.click()
    await sleep(700)
  })

  /* ---------- 8c. 兑换付款：商城币优先 + 可混合（2026-09-30） ----------
     ------------------------------------------------------------
     用户要求（原话，当时这个币还叫「丰收币」）：
     「兑换页面，优先用丰收币兑换。价值和积分等价的。
     用完丰收币再用积分，可混合。」

     ⚠️ **这一段必须自己造商城币余额。** e2e 跑的是全新 profile、没种过地 →
     `harvestBalance === 0` → 兑换页永远走「纯积分」那一支，
     `PaySplit` 里 `harvestPaid > 0` 的那一半**从来没被渲染过**。
     这正是 §11 说的「图集没盖住的分支 = 没验过的分支」，只不过发生在 e2e 上。

     造余额走的是**账本本身**（往 harvestLedger 写一笔）而不是改 store：
     改 store 只动内存快照，`refresh()` 一跑就没了；而且那属于
     「驱动手段比真实路径更有权限」（形态 H）。

     判据锚在 **ASCII 的 `+`** 上，不锚 emoji：混合那一行是
     「付款：🎟️ 250 + 🪙 10」，纯一种币的那几行没有 `+`。
     （实测：拿 emoji 正则当判据时灵时不灵 ——
      同一份脚本里，前一个 evaluate 用它找到了行、后一个找不到。
      ASCII 判据两次都稳。这类"锚在 emoji 上"的坑和形态 F 同源。
      ⚠️ 2026-10-16 补：币种图标改成 `🎟️` 之后，**取数字也不再走正则** ——
      见下面 `paidOf()`，用 `indexOf` + `slice`，彻底不碰 emoji 正则。）

     跑完**故意不把商城币还原成 0** —— 下面第 9 段的兑换页截图正好能
     拍到混合付款那一支，图集才盖得住这个新分支。 */
  const MIX_SEED = 250
  await page.evaluate(async (seed) => {
    const req = indexedDB.open('kid-quest-farm')
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const tx = db.transaction('harvestLedger', 'readwrite')
    tx.objectStore('harvestLedger').put({
      id: 'hv_e2e_paymix',
      delta: seed,
      balanceAfter: seed,
      source: 'manual_adjust',
      memo: 'E2E：造混合付款场景',
      createdAt: Date.now(),
    })
    await new Promise((res, rej) => {
      tx.oncomplete = res
      tx.onerror = () => rej(tx.error)
    })
    db.close()
    // 用真实的 refresh 让 store 读到这笔账（不刷新页面，省一次入场页）
    await window.__kqf__.getState().refresh()
  }, MIX_SEED)
  await new Promise((r) => setTimeout(r, 600))

  // ⚠️ §8b 收尾时点了「返回」，停在这个面板的「管理」tab 上 ——
  //    不切回来的话，下面一条「付款：」都找不到，
  //    会红成「新分支压根没渲染」，指错方向。
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /能换什么/.test(x.innerText))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 800))

  const payProbe = await page.evaluate(({ couponGlyph, pointsGlyph }) => {
    /** Range 的行盒数：1 = 单行，≥2 = 被挤到换行了（§12.1） */
    const lineBoxes = (el) => {
      const r = document.createRange()
      r.selectNodeContents(el)
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size
    }
    const state = window.__kqf__.getState()
    const pays = [...document.querySelectorAll('p')].filter((x) =>
      (x.innerText ?? '').startsWith('付款：'),
    )
    /** 从这一行的祖先 li 里读出商品标价（价签 CoinPill 的 textContent 形如「🪙260」） */
    const costOf = (p) => {
      const pill = [...(p.closest('li')?.querySelectorAll('span') ?? [])].find((s) =>
        /🪙\s*\d/.test(s.textContent ?? ''),
      )
      return pill ? Number((pill.textContent ?? '').replace(/\D/g, '')) : null
    }
    /**
     * 从「付款：🎟️ 250 + 🪙 10」里取出某个币种后面跟着的数字。
     * ⚠️ **不走 emoji 正则** —— 用 `indexOf` + `slice` 取，见上面那段注释。
     */
    const paidOf = (t, glyph) => {
      const i = t.indexOf(glyph)
      if (i < 0) return 0
      const m = t.slice(i + glyph.length).match(/^\s*(\d+)/)
      return m ? Number(m[1]) : 0
    }
    const parse = (p) => {
      const t = p.innerText.replace(/\s+/g, ' ').trim()
      return {
        text: t,
        cost: costOf(p),
        harvestPaid: paidOf(t, couponGlyph),
        pointsPaid: paidOf(t, pointsGlyph),
        lines: lineBoxes(p),
      }
    }
    return {
      harvest: state.harvestBalance,
      points: state.balance,
      count: pays.length,
      pureHarvest: pays.filter(
        (p) => p.innerText.includes(couponGlyph) && !p.innerText.includes('+'),
      ).length,
      mixed: pays.filter((p) => p.innerText.includes('+')).map(parse),
      all: pays.map(parse),
      docOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }
  }, { couponGlyph: COUPON.emoji, pointsGlyph: POINTS.emoji })

  check(
    '兑换页渲染出了「付款：」这一行',
    payProbe.count > 0,
    `共 ${payProbe.count} 条 · ${COUPON.name} ${payProbe.harvest} / ${POINTS.name} ${payProbe.points}`,
  )
  check(
    `${COUPON.name}够的商品走「纯${COUPON.name}」一支（不写 +0 ${POINTS.name}）`,
    payProbe.pureHarvest > 0,
    `纯${COUPON.name} ${payProbe.pureHarvest} 条`,
  )
  check(
    `${COUPON.name}不够的商品走「混合」一支（${COUPON.emoji} + ${POINTS.emoji} 同时出现）`,
    payProbe.mixed.length > 0,
    payProbe.mixed.length
      ? `抽样 ${JSON.stringify(payProbe.mixed.slice(0, 3).map((m) => m.text))}`
      : '一条混合的都没有 —— 新分支压根没被渲染到',
  )
  {
    // 独立重算一遍分账，不 import 被测实现（避免"用实现验实现"）
    const wrong = payProbe.all.filter((r) => {
      if (r.cost == null) return false
      const expectHarvest = Math.min(payProbe.harvest, r.cost)
      return r.harvestPaid !== expectHarvest || r.pointsPaid !== r.cost - expectHarvest
    })
    check(
      `每条的「${COUPON.emoji} X + ${POINTS.emoji} Y」都等于「先花光${COUPON.name}、差额用${POINTS.name}」且 X+Y = 标价`,
      wrong.length === 0,
      wrong.length
        ? `对不上 ${wrong.length} 条：${JSON.stringify(wrong.slice(0, 3))}`
        : `核了 ${payProbe.all.length} 条`,
    )
  }
  check(
    '「付款：」这一行没被挤到换行',
    payProbe.all.every((r) => r.lines === 1),
    `行盒数 ${JSON.stringify([...new Set(payProbe.all.map((r) => r.lines))])}`,
  )
  check(
    '加了分账文案后仍然没有横向溢出',
    payProbe.docOverflow <= 2,
    `scrollWidth - clientWidth = ${payProbe.docOverflow}`,
  )

  /* ---------- 9. 截图留档 ---------- */
  mkdirSync('screenshots', { recursive: true })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /←|返回/.test(x.innerText))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 700))
  /* 点底栏某一格。游戏那格是全屏的，点完要退出来，否则下一格不存在。 */
  const clickTab = async (label) => {
    const hit = await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.innerText.trim().split('\n').pop().trim() === l,
      )
      if (!b) return false
      b.click()
      return true
    }, label)
    await new Promise((r) => setTimeout(r, 1100))
    return hit
  }
  const leaveGame = async () => {
    const hit = await page.evaluate(() => {
      const b = document.querySelector('[data-tour="exit-game"], nav [data-tour="tab-tasks"]')
      if (!b) return false
      b.click()
      return true
    })
    if (hit) await new Promise((r) => setTimeout(r, 800))
    return hit
  }

  for (const [name, label] of [['tasks', '任务'], ['farm', '农场'], ['redeem', '兑换']]) {
    await clickTab(label)
    await page.screenshot({ path: `screenshots/${name}.png` })
    await leaveGame()
  }
  /* 积分：底栏没有这一格，走顶栏那颗 🪙。拍完用面板自己的「返回」关掉，
     不然下面 9c 要找的 ⚙️ 会被这层弹层挡住。 */
  await page.evaluate(() => document.querySelector('[data-tour="header-points"]')?.click())
  await new Promise((r) => setTimeout(r, 900))
  await page.screenshot({ path: 'screenshots/points.png' })
  await page.evaluate(() => document.querySelector('button[aria-label="返回"]')?.click())
  await new Promise((r) => setTimeout(r, 700))
  check('截图已保存', true, 'screenshots/{tasks,farm,redeem,points}.png')

  /* ---------- 9. 备份里不带「这台设备的东西」 ---------- */
  // 两条都是「只属于这台设备」的状态，而 `settings` 是**整份**进备份的：
  //   · `parentPin` 明文 4 位 —— 备份文件会被发到微信 / 网盘 / 客服，
  //     等于把家长锁的密码送出去；
  //   · `gameClock`（「今天已经玩了多久」）—— 玩满家长设的额度之后，
  //     导回一份玩之前的备份就能把额度刷回去，限时形同虚设。
  //
  // ⚠️ 只验「顶层 settings」不够：`data.meta.settings` 装的是**同一个对象**，
  //    只剥一处，PIN 就换个门出去（这条是第一次跑就抓出来的）。
  // ⚠️ 放在**最后**做：`importBackup` 会整库覆盖，前面的段落不该受影响。
  const deviceLocal = await page.evaluate(async () => {
    const S = () => window.__kqf__.getState()
    const sh = S().settings.dayStartHour ?? 0
    const d = new Date(Date.now() - sh * 3600 * 1000)
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`

    await S().updateSettings({ parentPin: '4321' })
    await S().updateSettings({ gameClock: { day, sec: 1200 } })
    await S().refresh()

    const snap = await window.__kqf__.exportBackup()
    const top = snap?.data?.settings ?? {}
    const viaMeta = snap?.data?.meta?.settings ?? {}
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

    // 篡改一份：把「今天玩了多久」刷回 0，再导回来
    const tampered = JSON.parse(JSON.stringify(snap))
    tampered.data.settings = { ...top, gameClock: { day, sec: 0 } }
    const res = await window.__kqf__.importBackup(tampered)
    await S().refresh()

    const out = {
      topPin: has(top, 'parentPin'),
      topClock: has(top, 'gameClock'),
      metaPin: has(viaMeta, 'parentPin'),
      metaClock: has(viaMeta, 'gameClock'),
      importOk: res.ok,
      importMsg: res.message,
      secAfter: S().settings.gameClock?.sec ?? null,
      pinAfter: S().settings.parentPin ?? null,
    }
    // 还原，别把 4321 留给收尾
    await S().updateSettings({ parentPin: '0000', gameClock: { day, sec: 0 } })
    return out
  })
  check(
    '备份里不含家长密码（顶层 + meta 两处都没有）',
    !deviceLocal.topPin && !deviceLocal.metaPin,
    `顶层=${deviceLocal.topPin} meta=${deviceLocal.metaPin}`,
  )
  check(
    '备份里不含「今天玩了多久」',
    !deviceLocal.topClock && !deviceLocal.metaClock,
    `顶层=${deviceLocal.topClock} meta=${deviceLocal.metaClock}`,
  )
  check(
    '导入一份「时长为 0」的备份，不能把本机额度刷回去',
    deviceLocal.importOk && deviceLocal.secAfter === 1200,
    `ok=${deviceLocal.importOk}(${deviceLocal.importMsg}) sec=${deviceLocal.secAfter}`,
  )
  check(
    '导入备份不会改掉本机的家长密码',
    deviceLocal.pinAfter === '4321',
    `pin=${deviceLocal.pinAfter}`,
  )

  /* ---------- 9b. 备份不带游戏本体（体积 + 它会执行） ---------- */
  // `gameKv.__bundle` 是整段游戏代码（anthill 一款 4.2 MB），而挂载时它会被
  // `import()` 执行，中间没有哈希也没有签名。所以：备份里不许有它，
  // 恢复后按名单从**本地包**重装（那条路比对烧进 App 的 sha256）。
  //
  // ⚠️ 判据不能只看「库里有没有 __bundle 行」—— 恢复后重装会写一行**真的**进去。
  //    要验的是「**文件里那段代码**没进来」，所以把名单清空再导，
  //    这样重装不会发生，`installed()` 必须是空的。
  const gameBackup = await page.evaluate(async () => {
    const S = () => window.__kqf__.getState()
    await window.__kqf__.grantGame('anthill')
    await S().refresh()
    const ins = await S().installLocalGame('anthill')
    await S().refresh()

    const snap = await window.__kqf__.exportBackup()
    const text = JSON.stringify(snap)
    const rows = (snap?.data?.gameKv ?? []).map((r) => r.key)
    const ids = snap?.data?.meta?.installedGameIds ?? null

    // ① 干净备份导回去：游戏要自己装回来
    const clean = await window.__kqf__.importBackup(JSON.parse(text))
    await S().refresh()
    const afterClean = Object.keys(window.__kqf__.plugin.installed() ?? {})

    // ② 带一段「我自己的代码」的备份：那段代码不许落库
    const evil = JSON.parse(text)
    evil.data.meta = { ...(evil.data.meta ?? {}), installedGameIds: [] }
    evil.data.gameKv = [
      { gameId: 'anthill', key: 'anthill:__bundle', value: 'window.__pwned = true' },
    ]
    const bad = await window.__kqf__.importBackup(evil)
    await S().refresh()
    const afterEvil = Object.keys(window.__kqf__.plugin.installed() ?? {})

    return {
      installOk: ins?.ok ?? null,
      rows,
      ids,
      kb: Math.round(text.length / 1024),
      cleanMsg: clean?.message ?? null,
      afterClean,
      evilMsg: bad?.message ?? null,
      afterEvil,
      pwned: window.__pwned ?? null,
    }
  })
  check(
    '备份里不含游戏本体（只带存档）',
    gameBackup.rows.every((k) => !k.endsWith(':__bundle') && !k.endsWith(':__assets')),
    `gameKv 行：${gameBackup.rows.join(', ') || '(空)'}`,
  )
  check(
    '备份记着「装过哪些游戏」',
    Array.isArray(gameBackup.ids) && gameBackup.ids.includes('anthill'),
    `installedGameIds=${JSON.stringify(gameBackup.ids)}`,
  )
  check(
    '恢复后游戏自动装回来（走本地包，比对 sha256）',
    gameBackup.cleanMsg?.includes('装回') && gameBackup.afterClean.includes('anthill'),
    `msg=${gameBackup.cleanMsg} 装回=${JSON.stringify(gameBackup.afterClean)}`,
  )
  check(
    '★★ 别人塞进备份的游戏代码不会落库',
    gameBackup.afterEvil.length === 0 && gameBackup.pwned === null,
    `导入后已装=${JSON.stringify(gameBackup.afterEvil)} pwned=${JSON.stringify(gameBackup.pwned)}`,
  )

  /* ---------- 9c. 「清空全部数据」（不可撤销，走真实界面） ---------- */
  // 这个按钮和数据导出 / 恢复挤在同一屏，是**唯一**不可撤销的操作，
  // 而 e2e 一直零覆盖 —— 它坏了也没人知道，直到某个家长按下去。
  //
  // 走真实界面：⚙️ → 数据 tab → 过家长密码 → 清空 → 确认。
  // 放在**最后**：它会把整个库清空（和导入同理）。
  //
  // ⚠️ 这一段**先把家长保护打开**（前面 7b 段关掉了）。两个理由：
  //    ① 要验的是「有密码才点得到清空」这条安全属性，门开着就白测了；
  //    ② `dataGateOpen = !protectParentActions || !dataLocked` ——
  //       关掉保护时这一屏直接是开的，键盘根本不渲染。硬点会报
  //       「卡在密码键盘上」，看着像按钮坏了，其实是判据写死了。
  const wiped = await (async () => {
    // 先造一点「清空之后不该剩下」的东西
    await page.evaluate(async () => {
      const S = () => window.__kqf__.getState()
      await window.__kqf__.addPoints(300)
      await window.__kqf__.grantGame('anthill')
      await S().refresh()
      await S().installLocalGame('anthill')
      await S().updateSettings({ childName: '小明', protectParentActions: true })
      await S().refresh()
    })
    await new Promise((r) => setTimeout(r, 900))

    const steps = []
    const clickText = async (needle, label) => {
      const ok = await page.evaluate((n) => {
        const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(n))
        if (!b) return false
        b.click()
        return true
      }, needle)
      steps.push({ label, ok })
      await new Promise((r) => setTimeout(r, 800))
      return ok
    }

    if (!(await clickText('⚙️', '进设置页'))) return { steps, stuck: '进设置页' }
    if (!(await clickText('数据', '数据 tab'))) return { steps, stuck: '数据 tab' }

    /* 安全属性：**没输密码时，清空按钮不该出现在页面上**。
       只看「点不到」不够 —— 渲染出来但被禁用，家长一样会被吓到，
       而且以后谁把 disabled 去掉就悄悄放行了。 */
    const locked = await page.evaluate(() => ({
      hasDanger: /清空全部数据/.test(document.body.innerText),
      hasGate: /数据操作需要密码/.test(document.body.innerText),
    }))

    /* ★ 2026-11-10：键盘现在**点出来**（`ParentLockButton` → `setPinOpen(true)`），
       不再铺在页面里。少了这一下，后面按数字会找不到按钮。 */
    const gateOpened = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        x.innerText.includes('爸妈：输密码'),
      )
      if (!b) return false
      b.click()
      return true
    })
    steps.push({ label: '打开密码键盘', ok: gateOpened })
    if (!gateOpened) return { steps, stuck: '打开密码键盘', locked }
    await new Promise((r) => setTimeout(r, 800))

    // 过密码门：从 store 读当前的，别写死 0000
    const pin = await page.evaluate(() => window.__kqf__.getState().settings.parentPin ?? '')
    if (!pin) return { steps, stuck: '要密码但 store 里没有 pin', locked }
    for (const d of pin) {
      const ok = await page.evaluate(async (ch) => {
        const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === ch)
        if (!b) return false
        b.click()
        await new Promise((r) => setTimeout(r, 300))
        return true
      }, d)
      if (!ok) return { steps, stuck: '密码键盘上的 ' + d, locked }
    }
    await new Promise((r) => setTimeout(r, 900))
    const unlocked = await page.evaluate(() => /清空全部数据/.test(document.body.innerText))

    if (!(await clickText('清空全部数据', '第一次点清空'))) return { steps, stuck: '清空全部数据', locked }
    if (!(await clickText('确认清空', '确认'))) return { steps, stuck: '确认清空', locked }
    await new Promise((r) => setTimeout(r, 2500))

    const after = await page.evaluate(async () => {
      const S = () => window.__kqf__.getState()
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('kid-quest-farm')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const gameKv = await new Promise((res) => {
        const req = db.transaction('gameKv', 'readonly').objectStore('gameKv').count()
        req.onsuccess = () => res(req.result)
        req.onerror = () => res(-1)
      })
      db.close()
      return {
        gameKv,
        installed: Object.keys(S().installedGames ?? {}),
        pin: S().settings.parentPin ?? null,
        childName: S().settings.childName,
        tasks: S().tasks.length,
        text: document.body.innerText.replace(/\s+/g, ' '),
      }
    })
    return { steps, locked, unlocked, after }
  })()

  check(
    '「清空全部数据」的每一步都点得到',
    !wiped.stuck,
    wiped.stuck ? `卡在「${wiped.stuck}」` : wiped.steps.map((x) => x.label).join(' → '),
  )
  check(
    '★ 没输家长密码时，清空按钮根本不在页面上',
    !!wiped.locked && !wiped.locked.hasDanger && wiped.locked.hasGate,
    wiped.locked
      ? `看到清空按钮=${wiped.locked.hasDanger} 看到密码门=${wiped.locked.hasGate}`
      : '没走到',
  )
  check(
    '★ 输对密码之后清空按钮才出现',
    wiped.unlocked === true,
    `unlocked=${wiped.unlocked}`,
  )
  check(
    '清空之后游戏包真的没了',
    !!wiped.after && wiped.after.gameKv === 0 && wiped.after.installed.length === 0,
    wiped.after ? `gameKv=${wiped.after.gameKv} 已装=${JSON.stringify(wiped.after.installed)}` : '没走到',
  )
  check(
    '清空之后家长密码要重设',
    !!wiped.after && wiped.after.pin === null,
    wiped.after ? `pin=${JSON.stringify(wiped.after.pin)}` : '没走到',
  )
  check(
    '清空之后孩子名字回到默认',
    !!wiped.after && wiped.after.childName !== '小明' && !!wiped.after.childName,
    wiped.after ? `childName=${wiped.after.childName}` : '没走到',
  )
  check(
    '清空之后界面还能用（没白屏）',
    !!wiped.after && /设置|今日任务/.test(wiped.after.text) && wiped.after.tasks > 0,
    wiped.after ? `tasks=${wiped.after.tasks}` : '没走到',
  )

  /* ---------- 结果汇总 ---------- */
  console.log('\n' + '─'.repeat(58))
  const failed = results.filter((r) => !r.ok)
  console.log(`通过 ${results.length - failed.length}/${results.length}`)

  if (warnings.length) {
    const uniq = [...new Set(warnings)].slice(0, 5)
    console.log(`\n警告 (${warnings.length}):`)
    uniq.forEach((w) => console.log(`  ! ${w.slice(0, 160)}`))
  }
  if (errors.length) {
    console.log(`\n错误 (${errors.length}):`)
    const uniq = [...new Set(errors)].slice(0, 10)
    uniq.forEach((e) => console.log(`  ✗ ${e.slice(0, 200)}`))
  } else {
    console.log('\n控制台无错误 ✓')
  }

  writeFileSync(
    'screenshots/report.json',
    JSON.stringify({ url: URL, results, errors, warnings }, null, 2),
  )

  process.exitCode = failed.length === 0 && errors.length === 0 ? 0 : 1
} catch (e) {
  console.error('\nE2E 执行失败:', e.message)
  process.exitCode = 3
} finally {
  await browser.close()
}
