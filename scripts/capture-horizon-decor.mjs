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
 * ★ 「显示 / 隐藏」不是「手机 / 平板」，是**「装得下吗」**：
 *   装饰锚在地块网格下沿（`top-full`），落在网格和按钮之间的那条带上。
 *   那条带有多高，**同时**取决于**视口高**和**网格行数** —— 量出来是
 *   24 / 93 / 196px 不等（表在下面 `VIEWPORTS` 上面）。
 *   ➜ 所以断言是**等价断言**：道具的显示与否 == 「这一档装不装得下」，
 *     **不是**「宽度 ≥ 768」。后者在 6 档里有 4 档是错的。
 *
 * ★ 版面安全**不靠绝对数字**（这台机器上页面本来就有 17px 溢出，与装饰无关）：
 *   把装饰临时 `display:none` 再量一次，**网格 / 按钮的几何和页面高度必须一模一样**。
 *   这才是「装饰没推动版面」的直接证据 —— 手机上的布局余量只有约 8px。
 *
 * ★★ **「在折线以下」不等于「被裁掉」—— 这一条是横屏两档逼出来的。**
 *   横屏手机（844×390）上，整条装饰带落在 **y679**，而视口只有 **390** 高 ⇒
 *   采样 **0 点** ⇒ 判据返回 `-1` ⇒ 「篱笆看得见」「探针自检 A/B」「判据自检」
 *   五条断言**一起变红**，看着像探针坏了。
 *   实际量下来：页面 `scrollHeight` 是 **854**（滚 464px 之后篱笆 100% 可见），
 *   而农场根节点（`overflow-hidden`）的 `scrollHeight === clientHeight`（**708 = 708**）
 *   —— 说明**什么都没被裁掉**，只是要滚动。
 *   ➜ 采样前先 `scrollIntoView`；并**单独钉一条断言**：「滚完还在视口外」才算真被裁掉，
 *     另配一条「overflow 祖先的 `scrollHeight` 没有超过 `clientHeight`」。
 *   ⚠️ 别把「看不见」和「滚一下才看得见」混为一谈 —— 后者是量法错了，不是装饰错了。
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

/** 每一档的「空隙 / 需要 / 到底显示没显示」—— 循环外用来配**活性**断言 */
const tally = []

/** 四件道具。顺序不重要 —— 脚本从 DOM 里读实际有哪些，这里只用来核对齐全 */
const EXPECT_PROPS = ['barn', 'well', 'scarecrow', 'sign']

/**
 * ⚠️ 视口**不能只测两档**。
 *
 * 道具原来是用 `hidden md:flex` 藏的 —— 那是个**只看宽度**的规则。
 * 于是「横屏手机」（844×390，宽 844 ≥ 768）会被判成「地方够」，把 122px 的
 * 谷仓塞进一条 **0px** 高的带里，**压在底部按钮上**。
 *
 * 实测（`room` = 第一个按钮顶边 − 网格包裹层底边）：
 *
 *   | 视口 | room | 道具需要 122px | 只看宽度会怎样 |
 *   | --- | --- | --- | --- |
 *   | 390×844 | 24px | 不够 | 隐藏 ✓ |
 *   | 844×390 横屏手机 | 24px | 不够 | **显示 ✗** |
 *   | 1112×834 横屏平板 | 24px | 不够 | **显示 ✗** |
 *   | 1024×768 | 24px | 不够 | **显示 ✗** |
 *   | 1280×800 | 93px | 不够 | **显示 ✗** |
 *   | 834×1112 竖屏平板 | 196px | 够 | 显示 ✓ |
 *
 * ➜ 判据必须是**「装得下吗」，不是「够宽吗」**（见下面的 room / need 等价断言）。
 */
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'phone-landscape', width: 844, height: 390 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'tablet-landscape', width: 1112, height: 834 },
  { name: 'desktop', width: 1280, height: 800 },
]

/* 只跑指定的视口：node scripts/capture-horizon-decor.mjs <url> <outDir> <name,name> */
const ONLY = (process.argv[4] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const SELECTED = ONLY.length ? VIEWPORTS.filter((v) => ONLY.includes(v.name)) : VIEWPORTS
if (!SELECTED.length) {
  console.error(`没有匹配的视口：${ONLY.join(',')}`)
  process.exit(2)
}

for (const vp of SELECTED) {
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

  /* ★★ 采样前先把装饰**滚进视口**。
     横屏两档整条装饰带在折线以下（844×390 时篱笆在 y679，视口只有 390 高），
     不滚的话采样 0 点 ⇒ `pct = -1` ⇒ 五条断言一起红，看着像探针坏了。
     ⚠️ 滚完**还在视口外**才是真的被裁掉 —— 下面 ⓪ 有专门的断言钉住。 */
  await page.evaluate(async () => {
    document.querySelector('[data-farm-decor="horizon"]')?.scrollIntoView({ block: 'center' })
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
  })
  await wait(120)

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

    /* 道具「本来需要多高」—— 临时把容器打开量一次（量完立刻还原）。
       这是「装得下吗」里的**需要多少**，从 DOM 量出来，**不写死 122**。 */
    let naturalPropH = 0
    if (propsWrap) {
      const prevD = propsWrap.style.display
      propsWrap.style.display = 'flex'
      for (const el of decor.querySelectorAll('[data-decor-item]')) {
        naturalPropH = Math.max(naturalPropH, Math.round(el.getBoundingClientRect().height))
      }
      propsWrap.style.display = prevD
    }

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
      scrollY: Math.round(scrollY),
      /* 「在折线以下」和「被裁掉」是两回事：沿祖先链找第一个 `overflow` 不为
         `visible` 的节点，看它的 `scrollHeight` 有没有超过 `clientHeight`
         —— 超了才叫真的裁掉了内容。 */
      clipAncestor: (() => {
        for (let n = decor.parentElement; n; n = n.parentElement) {
          const cs = getComputedStyle(n)
          if (cs.overflow !== 'visible' || cs.overflowY !== 'visible') {
            return {
              cls: (n.getAttribute('class') || '').slice(0, 52),
              scrollH: n.scrollHeight,
              clientH: n.clientHeight,
              cut: n.scrollHeight > n.clientHeight + 1,
            }
          }
        }
        return null
      })(),
      decor: { box: box(decor), position: getComputedStyle(decor).position, shippedPE },
      propsWrap: { display: propsWrap ? getComputedStyle(propsWrap).display : '?' },
      /* 「网格包裹层底边 → 第一个按钮顶边」到底有多少地方。
         ⚠️ 这是**量出来的**，不是拿断点推的 —— 它同时取决于视口高和网格行数。 */
      room: firstBtn ? Math.round(firstBtn.getBoundingClientRect().top - decor.getBoundingClientRect().top) : null,
      naturalPropH,
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
  console.log(`  · 视口高 ${m.vh} · 已滚到 y=${m.scrollY}（装饰滚进视口后才量）`)
  console.log(`  · 篱笆 ${f.box.top}–${f.box.bottom}（高 ${f.box.h}）  x ${f.box.left}–${f.box.right}`)
  console.log(`  · 网格 ${m.withDecor.grid.top}–${m.withDecor.grid.bottom} · 按钮顶边 ${m.withDecor.btn?.top}`)
  console.log(`  · **空隙 ${m.room}px**（网格底 → 按钮顶）· 道具本身需要 ${m.naturalPropH}px`)
  console.log(`  · 道具容器 display=${m.propsWrap.display}`)
  for (const p of m.props) {
    console.log(
      `  · 道具 ${p.name.padEnd(9)} ${
        p.missing ? '（DOM 里没有）' : `尺寸 ${p.box.w}×${p.box.h}  可见 ${p.pct}%（抬顶后 ${p.pctTop}%）`
      }`,
    )
  }

  /* ============ ⓪ 「在折线以下」≠「被裁掉」 ============
     ⚠️ 这两条是横屏两档逼出来的（见文件头）。篱笆在 y679、视口只有 390 高时
     采样 0 点，判据返回 -1，五条断言一起红 —— 但那是**量法**错了。
     ➜ 先滚进视口再量；「滚完还在视口外」才是真的被裁掉。 */
  check(
    '★★ 滚动之后篱笆**确实进了视口**（横屏时它在折线以下；滚进来还在外面 = 真的被裁掉了）',
    f.samples > 0 && f.box.top >= 0 && f.box.bottom <= m.vh,
    `滚到 y=${m.scrollY} · 篱笆 ${f.box.top}–${f.box.bottom} · 视口高 ${m.vh} · 采样 ${f.samples} 点`,
  )
  check(
    '★ 折线以下 ≠ 被裁掉：`overflow-hidden` 祖先**没有裁掉任何内容**（`scrollHeight === clientHeight`）',
    !m.clipAncestor || !m.clipAncestor.cut,
    m.clipAncestor
      ? `${m.clipAncestor.cls} · scrollH ${m.clipAncestor.scrollH} vs clientH ${m.clipAncestor.clientH}`
      : '祖先链上没有 `overflow` 不为 `visible` 的节点',
  )

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

  /* ============ ⑤ 道具：**装得下才显示**（判据是高度，不是宽度） ============
     ⚠️ 原来这里写的是 `if (vp.props)` —— 把「平板就显示、手机就隐藏」**按视口写死**，
     等于把 CSS 的断点抄了一遍。那样永远测不出「断点本身选错了」。
     改成**等价断言**：显示与否必须 == 「这一档到底装不装得下」，
     而「装得下」是**量出来的**（room 与 need 都来自 DOM）。 */
  const names = m.props.map((p) => p.name)
  check(
    '★ 四件道具都在 DOM 里（`barn` / `well` / `scarecrow` / `sign`）',
    EXPECT_PROPS.every((n) => names.includes(n)),
    names.join(' / '),
  )

  const room = m.room
  /* 整件装饰要占的高度 = 道具 + 篱笆（它们是竖着摞的） */
  const need = m.naturalPropH + f.box.h
  const shown = m.props.some((p) => p.rendered)
  const fits = room !== null && need > 0 && room >= need

  check(
    '★ 篱笆自己装得下（它是两档都要露出来的那一件）',
    room !== null && room >= f.box.h,
    `空隙 ${room}px vs 篱笆 ${f.box.h}px`,
  )
  check(
    `★★ 道具**装不下就一定不显示**（空隙 ${room}px vs 需要 ${need}px）`,
    !shown || fits,
    !shown
      ? `隐藏 ✓（空隙 ${room}px，需要 ${need}px = 道具 ${m.naturalPropH} + 篱笆 ${f.box.h}）`
      : `显示，且空隙 ${room}px ≥ ${need}px ✓`,
  )
  /* ⚠️ 上面这条是**单向**的（「不显示」永远能过）——
     所以还要在循环外配一条**活性**断言：至少有一档真的显示了道具。
     只有单向断言的话，把 CSS 改成永远 `display:none` 也能全绿。 */
  tally.push({ name: vp.name, room, need, shown, fits })

  if (shown) {
    for (const p of m.props) {
      check(`★★ 道具 ${p.name} 渲染出来了且可见`, p.rendered && p.pct > 0, `${p.box?.w}×${p.box?.h} 可见 ${p.pct}%`)
      check(`★★ 道具 ${p.name} 没有被别的东西盖住`, p.pct === p.pctTop, `${p.pct}% vs ${p.pctTop}%`)
    }
    check(
      '★★ 显示道具时，整件装饰**没有越界压到按钮上**',
      m.decor.box.bottom <= m.withDecor.btn.top,
      `装饰底 ${m.decor.box.bottom} · 按钮顶 ${m.withDecor.btn?.top}`,
    )
  } else {
    check(
      '★ 装不下时，道具容器的 `display` 就是 `none`（隐藏发生在容器上，不在每一件上）',
      m.propsWrap.display === 'none',
      m.propsWrap.display,
    )
    check(
      '★ 装不下时，一件道具都不许渲染出来（不是「渲染了但看不见」）',
      m.props.every((p) => !p.rendered),
      m.props.map((p) => `${p.name}:${p.box?.w}×${p.box?.h}`).join(' '),
    )
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

/* ============ 跨档小结：活性 + 空隙表 ============ */
console.log(`\n${'═'.repeat(52)}\n跨档小结（空隙 = 网格底 → 按钮顶；需要 = 道具 + 篱笆）\n`)
console.log('  视口               空隙    需要   道具')
for (const t of tally) {
  console.log(
    `  ${t.name.padEnd(18)} ${String(t.room).padStart(4)}px ${String(t.need).padStart(5)}px   ${
      t.shown ? '显示' : '隐藏'
    }${t.fits ? '' : '  ← 装不下'}`,
  )
}
/* ⚠️ 活性：每档都「不显示」也能让上面那条单向断言全绿 —— 所以要证明它真的会显示。 */
check(
  '★★ 活性：至少有一档**真的显示了**道具（否则单向断言被「永远 display:none」骗过）',
  tally.some((t) => t.shown),
  tally.filter((t) => t.shown).map((t) => t.name).join(' / ') || '一档都没有',
)
check(
  '★ 活性：也至少有一档**真的隐藏了**道具（否则「装不下」这条从没被行使过）',
  tally.some((t) => !t.shown),
  tally.filter((t) => !t.shown).map((t) => t.name).join(' / ') || '一档都没有',
)

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
