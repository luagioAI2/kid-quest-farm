/**
 * 地平线装饰（⑥ 建筑装饰）走查。
 *
 * 用法：node scripts/capture-horizon-decor.mjs [url] [outDir]
 *
 * 为什么单独一份：`e2e-check.mjs` / `capture-farm-2d.mjs` 都只断言**结果**
 * （地块点得动、产量对得上），没有任何一条断言过「装饰画出来了、而且真的看得见」。
 * 和 `capture-sky.mjs` / `capture-animals.mjs` / `capture-harvest-fx.mjs` /
 * `capture-levelup-fx.mjs` 是同一类补盲区脚本。
 *
 * ------------------------------------------------------------
 * ★★ 三道具/篱笆这类**内联 SVG 装饰**是最容易「全绿却什么都没验」的一类，
 *    所以这份脚本带三道自检：
 *
 * ① **判据必须认识 SVG 的 `fill`。**
 *    只读 `backgroundColor` 的判据会把 `<rect fill="#c08e5c">` 当成透明 ——
 *    2026-10-16 量「可见草地」时踩过：加了篱笆之后数字和加之前**一字不差**，
 *    而截图里篱笆清清楚楚。
 *    ➜ 用共用的 `lib/paint.mjs`，**并额外断言**「命中的元素是靠 `fill` 才被看见的
 *      （它的 `backgroundColor` 是透明的）」—— 证明判据走的确实是 SVG 那条分支。
 *
 * ② **装饰是 `pointer-events:none`，命中测试会跳过它。**
 *    ➜ **先按出厂状态量一遍**（期望 0%），再临时翻成 `auto` 量；两个数字构成对照组。
 *    ⚠️ 必须翻**整棵子树**，不能只翻根节点 —— `.kqf-decor__item` **自己**也写着
 *      `pointer-events:none`（`pointer-events` 虽可继承，但子元素一旦自己声明就不继承）。
 *      第一版只翻了根节点，结果篱笆（没自己声明）量到 100%、四件道具全量到 0%。
 *
 * ③ **探针自检（两道）**：临时盖一层全屏遮罩 → 可见率必须掉到 0%，拿掉又回到原值；
 *    再**只遮上半** → 数字必须**严格变小但不为 0**。
 *    第一道防「探针坏了」（坏了和没被遮住长得一样），
 *    第二道防「探针是个全有全无的开关」—— 真正危险的是**部分被盖住**
 *    （盖住九成还报「可见」）。
 *
 * ★ 不写死「可见率 ≥ N%」这种阈值 —— 每件道具的图形覆盖率本来就不同
 *   （谷仓约 65%，篱笆约 55%），定死阈值只会逼着以后去改数字。
 *   改用**等价性对照**：把装饰临时抬到最上层（`z-index:99999`）再量一次，
 *   两次数字必须**一模一样** —— 抬上去毫无变化，就等于「本来就没有东西盖着它」。
 *
 * ★ 「手机 / 平板」不是「藏起来 / 露出来」，是**量出来的**：
 *   装饰锚在地块网格下沿（`top-full`），两档都落在网格和按钮之间的那条带上。
 *   手机那条带只有 ~23px（装不下道具，只有篱笆），平板 ~172px（装得下四件）。
 *   ➜ 断言：**两档篱笆都要可见；道具只在 ≥768px 才渲染**。
 *
 * ★ 版面安全**不靠绝对数字**（这台机器上页面本来就有 17px 溢出，与装饰无关）：
 *   把装饰临时 `display:none` 再量一次，**网格 / 按钮的几何和页面高度必须一模一样**。
 *   这才是「装饰没推动版面」的直接证据 —— 手机上的布局余量只有约 8px。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { PAINT_HELPERS } from './lib/paint.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? '.e2e-scratch/horizon-decor'

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

/** 四件道具。顺序不重要 —— 脚本从 DOM 里读实际有哪些，这里只用来核对齐全 */
const EXPECT_PROPS = ['barn', 'well', 'scarecrow', 'sign']

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, props: false },
  { name: 'tablet', width: 834, height: 1112, props: true },
]

for (const vp of VIEWPORTS) {
  console.log(`\n══ ${vp.name} ${vp.width}×${vp.height} ══`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`horizon-decor-${vp.name}`),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
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
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })

  /* 切到农场那一格 —— App 默认停在「任务」，不切的话场景层根本不存在 */
  await page.evaluate(() => document.querySelector('[data-tour="tab-farm"]')?.click())
  await page.waitForFunction(() => !!document.querySelector('[data-sky-scene]'), { timeout: 15000 })
  await wait(900)

  /* 注入共用的「肉眼看到的是哪个元素」判据（见 `lib/paint.mjs`） */
  await page.evaluate(PAINT_HELPERS)

  /* ---- 对照组：装饰挂上去了没有 ----
     没有这一条，下面所有「量得到」的断言都是空的。 */
  check('对照组：地平线装饰已经挂在页面上', (await page.$('[data-farm-decor="horizon"]')) !== null)
  check('对照组：篱笆画了（`.kqf-decor__fence` 在 DOM 里）', (await page.$('.kqf-decor__fence')) !== null)

  const m = await page.evaluate((expectProps) => {
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        right: Math.round(r.right),
        w: Math.round(r.width),
        h: Math.round(r.height),
      }
    }
    const cls = (el) => (el ? el.getAttribute('class') || '' : '')
    const sameBox = (a, b) =>
      !!a && !!b && a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right

    const decor = document.querySelector('[data-farm-decor="horizon"]')
    if (!decor) return { missing: true }
    const fence = decor.querySelector('.kqf-decor__fence')
    const propsWrap = decor.querySelector('.kqf-decor__props')

    /* ⚠️ 道具是 `<svg>` 包着 `<use>` 指向 `<symbol>`；命中测试可能返回 `<use>`、
       也可能返回 shadow 树里的图形。两种情况都要认（shadow 树里往上走 host）。 */
    const owned = (item) => (el) => {
      if (!el || !item) return false
      if (el === item || item.contains(el)) return true
      let n = el
      for (let i = 0; i < 8 && n; i++) {
        const root = n.getRootNode ? n.getRootNode() : null
        if (root && root.host) {
          if (item.contains(root.host)) return true
          n = root.host
        } else break
      }
      return false
    }

    /** 一件装饰「肉眼看得见」的比例：在包围盒里按**格子中心**采样。
        ⚠️ 不用 `i/(N+1)` —— 篱笆是 26px 一档的图案，那个取法会**正好每列都落在立柱上**
        （量出来 100%，纯属采样共振，换个宽度就塌）。取格子中心稳得多。 */
    const samplePct = (item) => {
      if (!item) return { pct: -1, n: 0 }
      const r = item.getBoundingClientRect()
      if (r.width < 1 || r.height < 1) return { pct: -1, n: 0 }
      const isMine = owned(item)
      /* ⚠️ 分辨率不能太粗：稻草人的立柱在 80 的 viewBox 里只有 6 宽，
         104px 显示出来约 8px —— 8 列采样会**整列整列地漏掉立柱**，
         量出来 13%，看着像「被盖住了」，其实只是采样太稀。 */
      const NX = 12
      const NY = 6
      let hit = 0
      let total = 0
      for (let i = 0; i < NX; i++) {
        for (let j = 0; j < NY; j++) {
          const x = r.left + (r.width * (i + 0.5)) / NX
          const y = r.top + (r.height * (j + 0.5)) / NY
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue
          total++
          if (isMine(window.__paintAt(x, y))) hit++
        }
      }
      return { pct: total ? Math.round((hit / total) * 100) : -1, n: total }
    }

    /* ---------- ① 出厂状态：装饰是 `pointer-events:none` ---------- */
    const shippedPE = getComputedStyle(decor).pointerEvents
    const blind = samplePct(fence) // 期望 0%：命中测试会跳过它

    /* ---------- ② 临时翻成可命中，正式量 ----------
       ⚠️ 必须翻**整棵子树**：`.kqf-decor__item` 自己声明了 `pointer-events:none`，
       只翻根节点的话道具量出来还是 0%（第一版就是这么错的）。 */
    const peNodes = [decor, ...decor.querySelectorAll('*')]
    const prevPE = peNodes.map((el) => el.style.pointerEvents)
    peNodes.forEach((el) => (el.style.pointerEvents = 'auto'))

    const fencePct = samplePct(fence)

    /* 判据自检：命中的元素是**靠 `fill` 才被看见的**吗？
       （它的 `backgroundColor` 必须是透明的 —— 否则说明判据走的不是 SVG 分支） */
    let judgeProbe = null
    {
      const r = fence.getBoundingClientRect()
      const el = window.__paintAt(r.left + r.width / 2, r.top + r.height / 2)
      if (el) {
        const cs = getComputedStyle(el)
        judgeProbe = {
          tag: el.tagName.toLowerCase(),
          fill: cs.fill,
          bg: cs.backgroundColor,
          isFence: owned(fence)(el),
        }
      }
    }

    /* ---------- ③ 等价性对照：抬到最上层再量，数字必须一模一样 ---------- */
    const prevZ = decor.style.zIndex
    decor.style.zIndex = '99999'
    const fenceTop = samplePct(fence)
    const props = expectProps.map((name) => {
      const item = decor.querySelector(`[data-decor-item="${name}"]`)
      if (!item) return { name, missing: true }
      const b = box(item)
      return {
        name,
        box: b,
        rendered: b.w >= 1 && b.h >= 1,
        display: getComputedStyle(item).display,
        pct: samplePct(item).pct,
        pctTop: samplePct(item).pct,
      }
    })
    decor.style.zIndex = prevZ

    /* ---------- ④ 探针自检 A：整层遮住 → 必须掉到 0% ---------- */
    const cover = document.createElement('div')
    cover.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.02)'
    document.body.appendChild(cover)
    const during = samplePct(fence)
    cover.remove()
    const after = samplePct(fence)

    /* ---------- ④b 探针自检 B：**只遮上半** → 必须「变小但没到 0」 ----------
       只做「全遮 → 0%」的话，探针可能只是个**全有全无的开关**，
       而真正危险的是**部分被盖住**（盖住九成还报「可见」）。
       篱笆是均匀图案，遮掉上半 → 数字必须**严格变小、但不为 0**。 */
    let partial = null
    {
      const r = fence.getBoundingClientRect()
      const half = document.createElement('div')
      half.style.cssText =
        `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;` +
        `height:${r.height / 2}px;z-index:2147483646;background:rgba(0,0,0,0.02)`
      document.body.appendChild(half)
      const d = samplePct(fence).pct
      half.remove()
      partial = { during: d, after: samplePct(fence).pct }
    }

    peNodes.forEach((el, i) => (el.style.pointerEvents = prevPE[i]))

    /* ---------- ⑤ 版面基线：把装饰摘掉再量一次 ----------
       绝对数字没有意义（这台机器上页面本来就有 17px 溢出，与装饰无关），
       要比的是**有装饰 / 没装饰两次的差**。 */
    const grid = document.querySelector('div.grid.grid-cols-3')
    const col = decor.closest('.page-col') ?? decor.parentElement?.parentElement
    const row = col
      ? [...col.querySelectorAll(':scope > *')].find((el) => /mt-auto/.test(cls(el)))
      : null
    const firstBtn = row?.querySelector('button')

    const withDecor = {
      scrollH: document.documentElement.scrollHeight,
      grid: box(grid),
      btn: box(firstBtn),
    }
    const prevDisplay = decor.style.display
    decor.style.display = 'none'
    const withoutDecor = {
      scrollH: document.documentElement.scrollHeight,
      grid: box(grid),
      btn: box(firstBtn),
    }
    decor.style.display = prevDisplay

    return {
      vw: innerWidth,
      vh: innerHeight,
      decor: { box: box(decor), position: getComputedStyle(decor).position, shippedPE },
      propsWrap: { display: propsWrap ? getComputedStyle(propsWrap).display : '?' },
      fence: { box: box(fence), blind: blind.pct, pct: fencePct.pct, top: fenceTop.pct, samples: fencePct.n },
      judgeProbe,
      props,
      withDecor,
      withoutDecor,
      layoutSame: {
        grid: sameBox(withDecor.grid, withoutDecor.grid),
        btn: sameBox(withDecor.btn, withoutDecor.btn),
        scrollH: withDecor.scrollH === withoutDecor.scrollH,
      },
      selfTest: { during: during.pct, after: after.pct },
      partial,
    }
  }, EXPECT_PROPS)

  if (m.missing) {
    check('读得到装饰的几何信息', false, '找不到 [data-farm-decor="horizon"]')
    await browser.close()
    continue
  }

  const f = m.fence
  console.log(`  · 篱笆 ${f.box.top}–${f.box.bottom}（高 ${f.box.h}）  x ${f.box.left}–${f.box.right}`)
  console.log(`  · 网格 ${m.withDecor.grid.top}–${m.withDecor.grid.bottom} · 按钮顶边 ${m.withDecor.btn?.top}`)
  console.log(`  · 道具容器 display=${m.propsWrap.display}`)
  for (const p of m.props) {
    console.log(
      `  · 道具 ${p.name.padEnd(9)} ${
        p.missing ? '（DOM 里没有）' : `尺寸 ${p.box.w}×${p.box.h}  可见 ${p.pct}%（抬顶后 ${p.pctTop}%）`
      }`,
    )
  }

  /* ============ ① 判据自检：SVG 的 `fill` 分支真的走到了 ============ */
  const jp = m.judgeProbe
  check(
    '★ 判据自检：命中的是 SVG 图形，且**只有靠 `fill` 才看得见**（`backgroundColor` 透明）',
    !!jp &&
      jp.isFence &&
      jp.fill !== 'none' &&
      !/rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(jp.fill) &&
      /rgba?\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(jp.bg),
    jp ? `<${jp.tag}> fill=${jp.fill} bg=${jp.bg}` : '没命中任何元素',
  )

  /* ============ ② 对照组：不翻 `pointer-events` 就真的量不到 ============ */
  check(
    '★ 对照组：出厂状态（`pointer-events:none`）下量出来是 0% —— 证明「翻一下」是必需的',
    m.decor.shippedPE === 'none' && f.blind === 0,
    `shipped=${m.decor.shippedPE} · 未翻时可见 ${f.blind}%`,
  )

  /* ============ ③ 篱笆：两档都必须真的看得见 ============ */
  check('★★ 篱笆**看得见**（可见率 > 0，不是「画了但没人看得见」）', f.pct > 0, `可见 ${f.pct}%（采样 ${f.samples} 点）`)
  check(
    '★★ 篱笆**没有任何东西盖住它**（抬到最上层再量，数字必须一模一样）',
    f.pct === f.top,
    `常态 ${f.pct}% vs 抬顶 ${f.top}%`,
  )

  /* ============ ④ 探针自检 ============ */
  check(
    '★ 探针自检 A：盖一层全屏遮罩必须掉到 0%，拿掉又回到原值（否则探针恒绿）',
    m.selfTest.during === 0 && m.selfTest.after === f.pct,
    `遮罩中 ${m.selfTest.during}% → 拿掉后 ${m.selfTest.after}%`,
  )
  check(
    '★★ 探针自检 B：**只遮上半**时数字严格变小、但没到 0 —— 证明探针对「部分遮挡」敏感，不是全有全无的开关',
    m.partial?.during > 0 && m.partial?.during < f.pct && m.partial?.after === f.pct,
    `原 ${f.pct}% → 遮上半 ${m.partial?.during}% → 拿掉 ${m.partial?.after}%`,
  )

  /* ============ ⑤ 道具：手机上一件都不渲染，平板上四件都可见 ============ */
  const names = m.props.map((p) => p.name)
  check(
    '★ 四件道具都在 DOM 里（`barn` / `well` / `scarecrow` / `sign`）',
    EXPECT_PROPS.every((n) => names.includes(n)),
    names.join(' / '),
  )
  if (vp.props) {
    for (const p of m.props) {
      check(`★★ 平板：道具 ${p.name} 渲染出来了且可见`, p.rendered && p.pct > 0, `${p.box?.w}×${p.box?.h} 可见 ${p.pct}%`)
      check(`★★ 平板：道具 ${p.name} 没有被别的东西盖住`, p.pct === p.pctTop, `${p.pct}% vs ${p.pctTop}%`)
    }
  } else {
    for (const p of m.props) {
      check(
        `★ 手机：道具 ${p.name} **不渲染**（那条带只有 ~23px，真的装不下）`,
        !p.rendered,
        `尺寸 ${p.box?.w}×${p.box?.h}`,
      )
    }
    check('★ 手机：道具容器的 `display` 就是 `none`（隐藏发生在容器上，不在每一件上）', m.propsWrap.display === 'none', m.propsWrap.display)
  }

  /* ============ ⑥ 版面安全：摘掉装饰，几何必须一模一样 ============ */
  check('★ 装饰**不参与布局**（`position:absolute` —— 手机上余量只有约 8px）', m.decor.position === 'absolute', m.decor.position)
  check(
    '★★ 摘掉装饰之后**地块网格的几何完全不变**（装饰没有推动版面）',
    m.layoutSame.grid,
    `有 ${JSON.stringify(m.withDecor.grid)} vs 无 ${JSON.stringify(m.withoutDecor.grid)}`,
  )
  check(
    '★★ 摘掉装饰之后**按钮的几何完全不变**',
    m.layoutSame.btn,
    `有 ${m.withDecor.btn?.top}–${m.withDecor.btn?.bottom} vs 无 ${m.withoutDecor.btn?.top}–${m.withoutDecor.btn?.bottom}`,
  )
  check(
    '★ 装饰没有让页面变得更高（撑出去会被 `overflow-hidden` 裁掉）',
    m.layoutSame.scrollH,
    `有装饰 ${m.withDecor.scrollH} vs 无装饰 ${m.withoutDecor.scrollH}（视口 ${m.vh}）`,
  )
  check(
    '★ 篱笆落在**网格底边和按钮之间**（不是压在按钮上、也不是跑进网格里）',
    f.box.top >= m.withDecor.grid.bottom - 2 && !!m.withDecor.btn && f.box.bottom <= m.withDecor.btn.top,
    `篱笆 ${f.box.top}–${f.box.bottom} · 网格底 ${m.withDecor.grid.bottom} · 按钮顶 ${m.withDecor.btn?.top}`,
  )

  const shot = `${OUT}/${vp.name}-decor.png`
  await page.screenshot({ path: shot })
  console.log(`  · 截图 ${shot}`)

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
