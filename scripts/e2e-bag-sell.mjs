/**
 * 「收进背包 → 市场卖出」整条链的端到端验收
 * ------------------------------------------------------------
 * 为什么单独一个脚本（而不是并进 e2e-check / e2e-gameplay）：
 * 现有两套把这条链拆成了两半，中间那一段是空的 ——
 *   e2e-check §5b   只验「弹层长什么样」（币种 / 文案 / 按钮宽度），点了不点不管
 *   e2e-gameplay §7 验「当场卖 / 收进背包」两个按钮，但收进背包之后没有回到市场去卖
 * 于是「存进背包的货，到底能不能在市场卖掉、钱有没有到账」**没有任何守卫**。
 * 而 2026-09-16 那个 bug（市场弹层顶部错传 `balance`，孩子卖完东西眼前
 * 那个数字一动不动，看起来就是"卖出坏了"）恰恰就落在这一段里。
 *
 * 全程**真实鼠标事件**（page.mouse.click，走命中测试），不用 DOM `.click()` ——
 * 那个 bug 的表象正是「点得动，但数字不动」，DOM 点击测不出来。
 *
 * 用法：node scripts/e2e-bag-sell.mjs [url]     （默认 http://127.0.0.1:4180/）
 * 前置：先 `npm run preview`（或任何在跑的静态服务）
 *
 * 负向验证（2026-09-17 做过）：把 `MarketSheet` 的 headerRight 改回
 * `balance` + 🪙，本脚本会在「弹层顶部结的是丰收币 🌾」和
 * 「弹层顶部那颗数字跟着动了」两条上红，其余照旧 —— 即它不是空跑。
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { dismissOnboarding } from './lib/onboarding.mjs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}

const ITEM = 'produce-carrot'
const errors = []
const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 真实鼠标点击：走命中测试，并回报「那一点上最顶层的元素是谁」。
 *
 *  `scope` 用来把搜索范围限死在某个容器里。
 *  ⚠️ 不限定范围会踩坑：收获后的浮层提示（toast）文案里也有「胡萝卜」，
 *  而且它正在播淡出动画（transform 缩到 0）→ `boundingBox()` 返回 null，
 *  于是「按钮没有盒子」这种莫名其妙的失败。市场那一行必须限定在 `li` 里找。
 */
async function realClick(page, pattern, opts = {}) {
  const { scope = 'button', flags = '' } = opts
  const handle = await page.evaluateHandle(
    (sel, p, f) => {
      const rx = new RegExp(p, f)
      return [...document.querySelectorAll(sel)].find((x) => rx.test(x.innerText)) ?? null
    },
    scope,
    pattern,
    flags,
  )
  const el = handle.asElement()
  if (!el) return { ok: false, why: `没找到（scope=${scope} /${pattern}/）` }
  await el.evaluate((n) => n.scrollIntoView({ block: 'center' }))
  await sleep(250)
  const box = await el.boundingBox()
  if (!box) return { ok: false, why: '按钮没有盒子（可能被 display:none 或动画缩到 0）' }
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const hit = await el.evaluate(
    (n, x, y) => {
      const top = document.elementFromPoint(x, y)
      return {
        inside: !!top && (n === top || n.contains(top)),
        top: top ? `${top.tagName}.${(top.className || '').toString().slice(0, 30)}` : null,
        topText: (top?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 30),
      }
    },
    cx,
    cy,
  )
  await page.mouse.click(cx, cy)
  return { ok: true, hit, at: `${Math.round(cx)},${Math.round(cy)}`, size: `${Math.round(box.width)}x${Math.round(box.height)}` }
}

/** 读第 index 块地的文案 */
const plotText = (page, i) =>
  page.evaluate((idx) => {
    const grid = document.querySelector('div.grid.grid-cols-3')
    const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
    return tiles[idx] ? tiles[idx].innerText.replace(/\s+/g, ' ').trim() : ''
  }, i)

/**
 * 轮询等地块显示「可以收啦」。
 *
 * ⚠️ **不能靠 waitForFunction 的 rAF 轮询，也不能用固定 sleep。**
 * 农场页靠 `useFarmTick(1000)` 每秒重渲染一次 —— 种下后立刻查 DOM 只会看到
 * 「还要 2 分钟」；headless 下 rAF 也不一定按帧跑。所以自己按 250ms 轮询。
 */
async function waitMaturePlot(page, index, timeoutMs = 15000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    const text = await plotText(page, index)
    if (/可以收啦/.test(text)) return { ok: true, text }
    await sleep(250)
  }
  return { ok: false, text: await plotText(page, index) }
}

/** 按网格下标真实点一块地（真实鼠标事件，走命中测试） */
async function tapPlotReal(page, index) {
  const box = await page.evaluate((idx) => {
    const grid = document.querySelector('div.grid.grid-cols-3')
    const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
    const t = tiles[idx]
    if (!t) return null
    t.scrollIntoView({ block: 'center' })
    return null
  }, index)
  void box
  await sleep(200)
  const rect = await page.evaluate((idx) => {
    const grid = document.querySelector('div.grid.grid-cols-3')
    const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
    const t = tiles[idx]
    if (!t) return null
    const r = t.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2, text: t.innerText.replace(/\s+/g, ' ').trim() }
  }, index)
  if (!rect) return { ok: false, why: `第 ${index} 块地不存在` }
  const hit = await page.evaluate(
    (x, y) => {
      const top = document.elementFromPoint(x, y)
      return { inside: !!top?.closest('div.grid.grid-cols-3'), top: top?.tagName ?? null }
    },
    rect.x,
    rect.y,
  )
  await page.mouse.click(rect.x, rect.y)
  return { ok: true, hit, text: rect.text }
}

/** 读当前状态（store 快照 + 界面上的数） */
const readState = (page) =>
  page.evaluate(
    (item) => {
      const s = window.__kqf__.getState()
      const h2 = [...document.querySelectorAll('h2')].find((h) => (h.textContent ?? '').trim() === '农场市场')
      const head = h2?.parentElement
      return {
        harvest: s.harvestBalance,
        held: s.inventory.find((i) => i.itemId === item)?.count ?? 0,
        price: s.market.quotes.find((q) => q.itemId === item)?.price ?? null,
        sheetHead: (head?.innerText ?? '').replace(/\s+/g, ' ').trim(),
        topBar: (document.querySelector('header')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
        body: document.body.innerText.replace(/\s+/g, ' '),
      }
    },
    ITEM,
  )

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 })

  /* ⚠️ 先等入场页（splash）过去，再走引导。
     判据是「底部导航出现了」—— 导航只存在于主界面，入场页没有它，
     而且入场页有 ~1.9s 最短停留，固定 sleep 等不过去。
     不等的话后面所有 DOM 查询都会落在入场页上（第一次写就是这么假失败的）。 */
  await page.waitForSelector('#root > *', { timeout: 20000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await sleep(1200)

  await dismissOnboarding(page)
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })
  await sleep(500)

  /* ---------- 0. 准备：切到农场，拧快时钟、关灾害 ---------- */
  await realClick(page, '农场')
  await sleep(700)
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
  })

  const plotIndex = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    if (!empty) return null
    return (await st().plant(empty.index, 'carrot')) ? empty.index : null
  })
  check('种下一块胡萝卜', plotIndex !== null, `地块 #${plotIndex}`)

  const matured = await waitMaturePlot(page, plotIndex)
  check('胡萝卜长熟（地块上出现「可以收啦」）', matured.ok, matured.text)
  if (!matured.ok) throw new Error('作物没成熟，后面没法继续')

  const before = await readState(page)

  /* ---------- 1. 真实点成熟地块 → 收获弹层 ---------- */
  const harvestTap = await tapPlotReal(page, plotIndex)
  check(
    '点到成熟地块（真实鼠标事件，走命中测试）',
    harvestTap.ok && harvestTap.hit?.inside === true,
    harvestTap.hit ? `那一点上最顶层=${harvestTap.hit.top}` : harvestTap.why,
  )
  await sleep(700)

  const sheetOpen = await page
    .waitForFunction(
      () => /收进背包/.test(document.body.innerText) && /当场卖掉/.test(document.body.innerText),
      { timeout: 6000 },
    )
    .then(() => true, () => false)
  check('收获弹层给出「收进背包 / 当场卖掉」二选一', sheetOpen)

  /* ---------- 2. 点「收进背包」 ---------- */
  const storeTap = await realClick(page, '收进背包')
  check(
    '「收进背包」可点（没被别的层盖住）',
    storeTap.ok && storeTap.hit?.inside === true,
    storeTap.hit ? `顶层=${storeTap.hit.top}` : storeTap.why,
  )
  await sleep(1400)
  const afterStore = await readState(page)

  check(
    '收进背包：丰收币没动（钱不在这一步结）',
    afterStore.harvest === before.harvest,
    `${before.harvest} → ${afterStore.harvest}`,
  )
  check(
    '收进背包：产出真的进了背包',
    afterStore.held > before.held,
    `胡萝卜 ${before.held} → ${afterStore.held}`,
  )
  check('收进背包后弹层自动关闭', !/收进背包/.test(afterStore.body))
  const gained = afterStore.held - before.held

  /* ---------- 3. 进市场，展开那一行 ---------- */
  const marketTap = await realClick(page, '市场')
  check(
    '市场入口可点（真实命中测试）',
    marketTap.ok && marketTap.hit?.inside === true,
    marketTap.hit ? `顶层=${marketTap.hit.top} at ${marketTap.at}` : marketTap.why,
  )
  const marketOpen = await page
    .waitForFunction(
      () => [...document.querySelectorAll('h2')].some((h) => (h.textContent ?? '').trim() === '农场市场'),
      { timeout: 6000 },
    )
    .then(() => true, () => false)
  check('市场弹层已打开', marketOpen)
  if (!marketOpen) throw new Error('市场没打开')

  const inMarket = await readState(page)
  check(
    '市场弹层顶部结的是丰收币 🌾，且数字 = 真实余额',
    inMarket.sheetHead.includes('🌾') &&
      !inMarket.sheetHead.includes('🪙') &&
      new RegExp(`🌾\\s*${inMarket.harvest}\\b`).test(inMarket.sheetHead),
    `弹层头="${inMarket.sheetHead}" / 真实余额=${inMarket.harvest}`,
  )

  const expandTap = await realClick(page, '胡萝卜', { scope: 'li button' })
  check('展开有货的那一行', expandTap.ok, expandTap.why ?? expandTap.size ?? '')
  await sleep(700)

  const sellBtns = await page.evaluate(() => {
    return [...document.querySelectorAll('li button')]
      .filter((b) => /卖|全卖/.test(b.innerText))
      .map((b) => ({ text: b.innerText.replace(/\s+/g, ' ').trim(), w: Math.round(b.getBoundingClientRect().width) }))
  })
  check('三个卖出按钮都渲染出来', sellBtns.length === 3, sellBtns.map((b) => b.text).join(' | '))

  const allBtn = sellBtns.find((b) => /全卖/.test(b.text))
  const m = allBtn?.text.match(/全卖\s*(\d+)\s*个\s*\+(\d+)/)
  const sellN = m ? Number(m[1]) : NaN
  const sellX = m ? Number(m[2]) : NaN
  check('「全卖」按钮上的「N 个 / +X 🌾」解析出来了', Number.isFinite(sellN) && Number.isFinite(sellX), allBtn?.text ?? '(没有全卖按钮)')

  /* ---------- 4. 点「全卖」，对账 ---------- */
  const sellTap = await realClick(page, '全卖')
  check(
    '「全卖」可点（没被别的层盖住）',
    sellTap.ok && sellTap.hit?.inside === true,
    sellTap.hit ? `顶层=${sellTap.hit.top}` : sellTap.why,
  )
  await sleep(1600)
  const afterSell = await readState(page)

  check(
    '卖出后丰收币增加，且增量 = 按钮上承诺的 X',
    afterSell.harvest === afterStore.harvest + sellX,
    `${afterStore.harvest} + ${sellX} = ${afterStore.harvest + sellX}，实际 ${afterSell.harvest}`,
  )
  check(
    '卖出后背包里的货减少，且减少量 = 按钮上写的 N',
    afterSell.held === afterStore.held - sellN,
    `${afterStore.held} - ${sellN} = ${afterStore.held - sellN}，实际 ${afterSell.held}`,
  )
  check(
    '卖掉的正好是刚收进背包的那批（数量对得上）',
    afterSell.held === 0 && gained === sellN,
    `收进 ${gained} 个，卖了 ${sellN} 个，剩 ${afterSell.held} 个`,
  )
  check(
    '卖压生效：价格被自己这笔卖单打下来了',
    afterSell.price < inMarket.price,
    `${inMarket.price} → ${afterSell.price}`,
  )
  check(
    '弹层顶部那颗丰收币数字跟着动了（旧 bug 就是它不动）',
    new RegExp(`🌾\\s*${afterSell.harvest}\\b`).test(afterSell.sheetHead),
    `弹层头="${afterSell.sheetHead}"`,
  )
  check(
    '顶栏的丰收币也同步了',
    new RegExp(`🌾\\s*${afterSell.harvest}\\b`).test(afterSell.topBar),
    `顶栏="${afterSell.topBar}"`,
  )
  check('卖完有明确的文字反馈', /卖出\s*\d+\s*个/.test(afterSell.body), (afterSell.body.match(/卖出[^。]{0,40}/) ?? [''])[0])

  /* ---------- 5. 空背包走空状态 ---------- */
  const emptyState = /背包还是空的/.test(afterSell.body)
  check('卖空之后市场显示「背包还是空的」空状态', emptyState)

  console.log('\n' + '─'.repeat(58))
  const failed = results.filter((r) => !r.ok)
  console.log(`通过 ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    console.log('\n失败项：')
    for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  }
  console.log(errors.length ? `\n控制台错误 ${errors.length} 条：\n${errors.join('\n')}` : '\n控制台无错误 ✓')
  process.exitCode = failed.length ? 1 : 0
} catch (e) {
  console.error('\n探针崩了：', e)
  process.exitCode = 1
} finally {
  await browser.close()
}
