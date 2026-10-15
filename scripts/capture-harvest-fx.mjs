/**
 * 收获特效走查 + 结构自检。
 *
 * 用法：node scripts/capture-harvest-fx.mjs [url] [outDir]
 *
 * 为什么单独一份：收获特效只在「收完那一瞬间」存在 900ms，
 * `capture.mjs` / `e2e-check.mjs` / `e2e-gameplay.mjs` 都只断言**结果**
 * （丰收币到账、产出进背包），没有任何一个断言过**画面上发生了什么**。
 * 和 `capture-sky.mjs` / `capture-animals.mjs` / `capture-games.mjs`
 * 是同一类补盲区脚本。
 *
 * ------------------------------------------------------------
 * ★★ 最值钱的一条断言还是「画了什么 ≠ 看得见什么」（`capture-sky.mjs` 的教训）：
 *
 * 特效是 `pointer-events:none` 的纯装饰，所以**不能**断言
 * 「`elementFromPoint` 返回的就是它」—— 命中测试永远不会落在它身上。
 * 正确的问法是「采样点上最上层的那一层，是不是还在**这一格**里」：
 *
 *     const carrier = fx.closest('button')          // 地块本体（可命中）
 *     el === carrier || carrier.contains(el)        // ✓ 没有任何东西盖住这一格
 *
 * ⚠️ 反过来写 `el.contains(carrier)` 就**永远绿**了 ——
 *    `pointer-events:none` 的元素被采样时返回的本来就是它的祖先。
 *
 * ★ 探针自己也要防「恒绿」：脚本会**临时盖一层全屏遮罩**再采样一次，
 *   要求可见率从 100% 掉到 0%。掉不下来 = 探针是坏的，而不是特效是好的。
 *   这条自检让「探针烂掉」和「特效被盖住」不会长得一样。
 *
 * ★ 期望的产出图案从 `src/domain/catalog.ts` **读**出来，不抄一份
 *   （`scripts/lib/quality.mjs` 解析 `settlement.ts` 是同一个套路）：
 *   抄了的话，改了作物 emoji 脚本还是绿的 —— 守卫会**悄悄变弱**。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? '.e2e-scratch/harvest-fx'

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

/* ------------------------------------------------------------
   从 `catalog.ts` 读这一茬作物的 emoji（**不抄**）
   ------------------------------------------------------------ */
const CROP = 'carrot'
const CATALOG = readFileSync(new URL('../src/domain/catalog.ts', import.meta.url), 'utf8')
function cropEmoji(cropId) {
  const at = CATALOG.indexOf(`id: '${cropId}'`)
  if (at < 0) return null
  const m = CATALOG.slice(at).match(/emoji:\s*'([^']+)'/)
  return m ? m[1] : null
}
const WANT_EMOJI = cropEmoji(CROP)
/* 结构守卫：解析不出来就退出，绝不退化成「随便测点什么」 */
if (!WANT_EMOJI) {
  console.error(
    `无法从 catalog.ts 解析作物 '${CROP}' 的 emoji。\n` +
      `改过 CROPS 的写法的话，请同步更新本脚本的解析方式。`,
  )
  process.exit(2)
}
console.log(`作物 ${CROP} 的产出图案（读自 catalog.ts）：${WANT_EMOJI}`)

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
]

for (const vp of VIEWPORTS) {
  console.log(`\n══ ${vp.name} ${vp.width}×${vp.height} ══`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`capture-harvest-fx-${vp.name}`),
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
  if (!(await page.$('.kqf-sky'))) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('nav button')].find((x) =>
        (x.textContent ?? '').includes('农场'),
      )
      b?.click()
    })
  }
  await page.waitForFunction(() => !!document.querySelector('.kqf-sky'), { timeout: 10000 })
  await wait(500)

  /* ---- 对照组：还没收之前，页面上**不该有**特效元素 ----
     没有这一条，下面「找得到特效」的断言就是空的（恒真的风险）。 */
  check(
    '对照组：收获之前页面上没有特效元素',
    (await page.$('[data-plot-fx="harvest"]')) === null,
  )

  /** 找一块已解锁的空地种下，轮询等它真的成熟（时钟 1200×） */
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
      const text = await page.evaluate((i) => {
        const grid = document.querySelector('div.grid.grid-cols-3')
        const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
        return tiles[i] ? tiles[i].innerText.replace(/\s+/g, ' ').trim() : ''
      }, planted.index)
      if (/可以收啦/.test(text)) return { ok: true, index: planted.index }
      await wait(250)
    }
    return { ok: false, index: planted.index, why: '等不到成熟' }
  }

  /** 点第 index 块地（网格里的直接子 button，顺序 == plots 顺序） */
  async function tapPlot(index) {
    return page.evaluate((i) => {
      const grid = document.querySelector('div.grid.grid-cols-3')
      const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
      if (!tiles[i]) return { ok: false, why: `第 ${i} 块地不存在` }
      const text = tiles[i].innerText.replace(/\s+/g, ' ').trim()
      tiles[i].click()
      return { ok: true, text }
    }, index)
  }

  /** 点弹层里的「收进背包」（收货 → 立刻 onClose，弹层同步卸载） */
  async function pickStore() {
    return page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find((b) => /收进背包/.test(b.innerText))
      if (!btn) return { ok: false, why: '找不到「收进背包」' }
      btn.click()
      return { ok: true }
    })
  }

  /** 轮询等特效出现（它只活 900ms，所以 60ms 一探） */
  async function waitFx(timeoutMs = 2000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      if (await page.$('[data-plot-fx="harvest"]')) return true
      await wait(60)
    }
    return false
  }

  /** 收获一次，返回特效出现的快慢 + 特效所在的格子 */
  async function harvestOnce() {
    const prep = await plantMature()
    if (!prep.ok) return { ok: false, why: prep.why ?? '没种成' }
    const tapped = await tapPlot(prep.index)
    if (!tapped.ok) return { ok: false, why: tapped.why }
    await wait(600)
    /* ★ 先把 toast 堆到上限 —— 它是最可能盖住地块的东西（`fixed top-3`）。
       不堆的话「可见 100%」是白测的：现实中连收两块地就是满栈。 */
    await page.evaluate(() => {
      const st = window.__kqf__.getState()
      for (let i = 0; i < 3; i++) {
        st.pushToast({ kind: 'info', title: `占位提示 ${i + 1}`, detail: '把 toast 堆到上限' })
      }
    })
    await wait(150)
    const pick = await pickStore()
    if (!pick.ok) return { ok: false, why: pick.why }
    const appeared = await waitFx()
    return { ok: true, appeared, index: prep.index }
  }

  /* ============ ① 第一次收获：做断言 ============ */
  console.log('\n【1】收获一次，验证特效出现且真的看得见')
  const h1 = await harvestOnce()
  check('收获流程走通（种 → 成熟 → 点开 → 收进背包）', h1.ok === true, h1.why ?? '')
  check('★ 收完 900ms 内特效出现在页面上', h1.appeared === true, `plot=${h1.index}`)

  /* ★★ 探针：**逐帧**采样整段动画，取最差的一帧。
     只测一帧是不够的 —— 特效的峰值位置比静止位置高 12px，
     「峰值那一瞬间被 toast 盖住」正好会被单帧采样漏掉（2026-10-15 实测到过）。 */
  const probe = await page.evaluate(async () => {
    /** 采样包围盒，数「最上层那一层是不是还在这一格里」 */
    const sample = () => {
      const fx = document.querySelector('[data-plot-fx="harvest"]')
      if (!fx) return null
      const carrier = fx.closest('button')
      if (!carrier) return null
      const r = fx.getBoundingClientRect()
      let visible = 0
      let total = 0
      let blocker = null
      for (let i = 1; i < 8; i++) {
        for (let j = 1; j < 8; j++) {
          const x = r.left + (r.width * i) / 8
          const y = r.top + (r.height * j) / 8
          if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue
          total++
          const el = document.elementFromPoint(x, y)
          /* ⚠️ 只认「最上层还在这一格里」。不能写 `el.contains(carrier)` ——
             特效是 pointer-events:none，那样写永远绿。 */
          if (el && (el === carrier || carrier.contains(el))) visible++
          else if (!blocker && el) {
            blocker = `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 2).join('.')}`
          }
        }
      }
      return {
        pct: total ? Math.round((visible / total) * 100) : -1,
        sampled: total,
        blocker,
        /* ⚠️ 读的是**产出图案那一个 span**，不是整块的 textContent ——
           整块里还有两点 ✨ 星光，直接比字符串会把断言写成「🥕✨✨ == 🥕」这种假失败。 */
        text: (fx.querySelector('[data-fx-item]')?.textContent ?? '').trim(),
        inTile: carrier.contains(fx),
        tileText: carrier.innerText.replace(/\s+/g, ' ').trim().slice(0, 30),
        rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`,
      }
    }

    const frames = []
    let selfTest = null
    const t0 = performance.now()
    while (performance.now() - t0 < 900) {
      const t = Math.round(performance.now() - t0)
      const p = sample()
      if (p) frames.push({ t, ...p })
      /* 自检：在动画正中间临时盖一层全屏遮罩，可见率必须掉到 0%，
         拿掉之后又要回到 100% —— 证明探针能分辨「盖住」和「没盖住」。 */
      if (!selfTest && t >= 300 && p) {
        const cover = document.createElement('div')
        cover.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.02)'
        document.body.appendChild(cover)
        const during = sample()
        cover.remove()
        selfTest = { during: during?.pct ?? -1, after: sample()?.pct ?? -1 }
      }
      await new Promise((r) => requestAnimationFrame(r))
    }
    /* 前 ~100ms 弹层遮罩还在：`harvest()` 最后 await 了一次 refresh，
       那一刻特效已经渲染，而 `onClose()` 还没执行。那几帧特效本身也是
       `opacity:0`（keyframes 0% 就是透明），所以不算「被盖住」。 */
    const settled = frames.filter((f) => f.t >= 100)
    const worst = settled.length ? settled.reduce((a, b) => (b.pct < a.pct ? b : a)) : null
    return { frameCount: frames.length, settledCount: settled.length, worst, selfTest }
  })

  const b = probe.worst
  check('特效元素找得到（整段动画采到了帧）', !!b, `采到 ${probe.settledCount} 帧（含遮罩期共 ${probe.frameCount} 帧）`)
  if (b) {
    check(
      '★ 特效挂在**被收的那一格**里（不是别的地块 / 也不是飘在页面中间）',
      b.inTile === true,
      `所在格子：「${b.tileText}」`,
    )
    check(
      '★ 特效画的是这一茬作物的产出图案（读自 catalog.ts）',
      b.text === WANT_EMOJI,
      `实际内容「${b.text}」，期望「${WANT_EMOJI}」`,
    )
    /* ★★ 本文件存在的理由 */
    check(
      '★★ 整段动画里**每一帧都可见**（含峰值帧；toast 已堆到上限）',
      b.pct === 100,
      `最差的一帧在 ${b.t}ms：可见 ${b.pct}%（采样 ${b.sampled} 点）${b.blocker ? ` · 挡住它的是 ${b.blocker}` : ''}`,
    )
  }
  check(
    '★ 探针自检：盖一层全屏遮罩必须掉到 0%，拿掉又回到 100%（否则探针恒绿）',
    probe.selfTest?.during === 0 && probe.selfTest?.after === 100,
    `遮罩中 ${probe.selfTest?.during}% → 拿掉后 ${probe.selfTest?.after}%`,
  )

  /* ============ ② 特效是**瞬时**的：过一会儿必须自己消失 ============ */
  await wait(1400)
  check(
    '★ 特效会自己消失（不是永久留在画面上）',
    (await page.$('[data-plot-fx="harvest"]')) === null,
  )

  /* ============ ③ 第二次收获：换一块地，顺便拍图 ============ */
  console.log('\n【2】再收一次（换一格），拍图')
  const h2 = await harvestOnce()
  check('第二次收获也触发了特效（不是只碰巧第一次有）', h2.ok === true && h2.appeared === true, h2.why ?? '')
  /* ⚠️ 截图前先把动画**冻在「刚蹦出来」的姿势**上。
     动画只有 900ms，而 `waitFx` 轮询 + 截图往返本身就要几百毫秒，
     不冻的话拍到的多半是已经淡成透明的尾巴 —— 走查图集就成了
     「看不出改了什么」的那种图（本项目踩过这个坑）。 */
  await page.evaluate(() => {
    const el = document.querySelector('[data-plot-fx="harvest"] .kqf-burst__item')
    if (!el) return
    el.style.animation = 'none'
    el.style.opacity = '1'
    el.style.transform = 'translateY(-14px) scale(1.1)'
  })
  const shot = `${OUT}/${vp.name}-harvest.png`
  await page.screenshot({ path: shot })
  const where = await page.evaluate(() => {
    const fx = document.querySelector('[data-plot-fx="harvest"]')
    if (!fx) return null
    const grid = document.querySelector('div.grid.grid-cols-3')
    const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
    return { tileIndex: tiles.findIndex((t) => t.contains(fx)), rect: fx.getBoundingClientRect().width }
  })
  console.log(
    `  · 截图 ${shot}${where ? `（特效在第 ${where.tileIndex} 格，宽 ${Math.round(where.rect)}px）` : '（拍的时候特效已经消失了，只作存档）'}`,
  )

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))
  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
