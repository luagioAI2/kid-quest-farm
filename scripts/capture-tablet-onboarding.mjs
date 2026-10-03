/**
 * 新手引导 + 四步导览 在平板上的走查
 * ------------------------------------------------------------
 * 为什么要单独跑：引导只在**全新 profile** 上出现一次，
 * 平时所有 e2e / 截图脚本进来第一件事就是把它关掉（见 lib/onboarding.mjs），
 * 所以它对平板的适配从来没被看过。
 *
 * 导览的气泡是 `fixed left:0 right:0` + 内部 `mx-auto max-w-sm` ——
 * **恒定居中**，而锚点可能在屏幕最左（底部 tab）或最右（顶栏按钮）。
 * 手机上 384px 的气泡几乎占满 390px 宽，居中 ≈ 对齐；
 * 平板上就可能出现「气泡在中间、高亮在最左边」的脱节。
 * 所以这里除了出图，还量**气泡中心与锚点中心的水平距离**。
 *
 * 用法：node scripts/capture-tablet-onboarding.mjs [url] [输出目录]
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? '.e2e-scratch/onboarding'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 平板上的对齐判据。
 *
 * ⚠️ 单看「气泡中心与锚点中心的距离」是不够的 —— 384px 的卡片贴到屏幕边上
 * 就到头了，锚点再往外也追不上。iPad mini 竖屏（768）第 6 步就是这种：
 * 卡片被夹在 368..752（中心 560），锚点中心 682 **就在卡片正下方**，
 * 但距离仍有 122px。把它判红是**判据的错，不是产品的错**。
 *
 * 所以判据是两条**同时**成立：
 *
 *   1. **锚点中心落在气泡的水平跨度内**（气泡确实对着它，而不是各在一头）。
 *      这一条挡住「气泡永远贴某一边」那种退化 —— 锚点在左半时贴右边界会立刻红。
 *   2. **距离 ≤ MAX_DRIFT，或者卡片已经贴到视口边**（贴边说明它已经尽力了）。
 *
 * 修复前的实测值：iPad 13" 横屏 186 / 360 / 410 / 424 / 474px，
 * 且第 5、6 步的锚点中心（1107 / 1157）**完全不在**气泡跨度（491..875）里 ——
 * 两条判据都会红，区分得很干净。
 *
 * ⚠️ 手机（390）不设断言：卡片 358px 几乎占满 390px 视口，
 * 夹取范围的两个边界相等（都等于 16），居中就是唯一解 ——
 * 那时「偏离 157px」是几何必然，不是可以修的东西。
 */
const MAX_DRIFT = 120
const EDGE_GUTTER = 16
let failures = 0

const DEVICES = [
  { tag: 'phone-390', w: 390, h: 844, note: '手机（基准）' },
  { tag: 'ipad-mini-landscape', w: 1024, h: 768, note: 'iPad mini 横' },
  { tag: 'ipad-13-landscape', w: 1366, h: 1024, note: 'iPad Pro 13" 横' },
  { tag: 'ipad-mini-portrait', w: 768, h: 1024, note: 'iPad mini 竖' },
]

/** 点一个「文字正好等于 label」的按钮 */
const clickExact = (page, label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.textContent ?? '').trim() === t,
    )
    if (!b) return false
    b.click()
    return true
  }, label)

const waitFor = (page, sel, timeout = 8000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(
    () => true,
    () => false,
  )

for (const d of DEVICES) {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
    userDataDir: makeProfileDir(`onb-${d.tag}`),
  })
  const errors = []
  try {
    const page = await browser.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewport({
      width: d.w,
      height: d.h,
      deviceScaleFactor: 1,
      isMobile: true,
      hasTouch: true,
    })
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await wait(2600)

    const shot = (n) => page.screenshot({ path: `${OUT}/${d.tag}-${n}.png` })
    console.log(`\n=== ${d.tag}  ${d.w}×${d.h}  ${d.note} ===`)

    /* ---- 家长设置向导 ---- */
    const hadWizard = await page.evaluate(() => !!document.querySelector('[data-step]'))
    if (!hadWizard) {
      console.log('  ⚠️ 没弹向导（profile 不是全新的？）')
    } else {
      await shot('01-welcome')
      await clickExact(page, '开始设置')
      await waitFor(page, 'input[aria-label="孩子的小名"]')
      await wait(300)
      await shot('02-name')
      await clickExact(page, '下一步')
      await waitFor(page, '[data-step="pin"]')
      await wait(300)
      await shot('03-pin')
      await clickExact(page, '以后再说')
      await waitFor(page, '[data-step="done"]')
      await wait(300)
      await shot('04-done')
      // 向导整页宽度（它自己是 max-w-2xl 的一层外壳）
      const w = await page.evaluate(() => {
        const el = document.querySelector('[data-step]')
        const col = el?.querySelector('.mx-auto') ?? el
        return col ? Math.round(col.getBoundingClientRect().width) : -1
      })
      console.log(`  向导内容列宽 = ${w}（视口 ${d.w}，占比 ${Math.round((w / d.w) * 100)}%）`)

      /* ---- 导览：**六**步，不是四步 ----
         ⚠️ 2026-10-03：第一版这里写死 `for (i < 4)`，只走了给孩子的 4 个底部
         tab，**漏掉了最后两步给家长的**（`review` / `settings`，锚点在顶栏
         最右侧）。而那两步恰恰是「气泡恒定居中」偏离最严重的 —— 顶栏按钮在
         x≈1100，气泡中心在视口正中 683，差 400+px。写死步数等于把最坏的
         情况藏起来了，量出来的「最大偏离 186px」是假的。
         改成「跟着气泡走」：只要还有气泡就点下一步，步数由组件自己决定。 */
      await clickExact(page, '带宝贝看一遍')
      await waitFor(page, '[data-tour-bubble]')
      for (let i = 0, guard = 0; ; i++) {
        if (++guard > 12) {
          console.log('  ⚠️ 走了 12 步还没收尾，疑似死循环，提前停')
          break
        }
        await wait(600)
        const m = await page.evaluate((EDGE_GUTTER_PX) => {
          const bubble = document.querySelector('[data-tour-bubble]')
          if (!bubble) return null
          const card = bubble.firstElementChild
          const cr = card.getBoundingClientRect()
          // 高亮框是那个 box-shadow 挖洞的元素
          const spot = document.querySelector('[data-tour-root]')?.nextElementSibling
          const sr = spot?.getBoundingClientRect()
          return {
            step: bubble.getAttribute('data-tour-bubble'),
            side: bubble.getAttribute('data-tour-side'),
            bubbleW: Math.round(cr.width),
            bubbleCx: Math.round(cr.left + cr.width / 2),
            anchorCx: sr ? Math.round(sr.left + sr.width / 2) : null,
            anchorW: sr ? Math.round(sr.width) : null,
            /* 判据用的三个原始量（见 MAX_DRIFT 的注释）。
               都是**观察到的几何**，不在脚本里重算 app 的夹取公式 ——
               重算等于把同一个 bug 抄两遍，抄出来的还是一样错。 */
            vw: window.innerWidth,
            bubbleLeft: Math.round(cr.left),
            bubbleRight: Math.round(cr.right),
            anchorInSpan: sr
              ? sr.left + sr.width / 2 >= cr.left && sr.left + sr.width / 2 <= cr.right
              : null,
            atEdge:
              cr.left <= EDGE_GUTTER_PX + 1 || cr.right >= window.innerWidth - EDGE_GUTTER_PX - 1,
            offscreen:
              cr.left < 0 || cr.right > window.innerWidth || cr.top < 0 || cr.bottom > window.innerHeight,
          }
        }, EDGE_GUTTER)
        await shot(`tour-${i + 1}-${m?.step ?? '?'}`)
        if (m) {
          const dx = m.anchorCx === null ? null : Math.abs(m.bubbleCx - m.anchorCx)
          /* 平板上气泡必须**对着**锚点，两条判据同时成立（见 MAX_DRIFT 的注释）。 */
          const bad =
            d.w >= 768 &&
            (m.anchorInSpan === false || (dx !== null && dx > MAX_DRIFT && !m.atEdge))
          if (bad) failures++
          console.log(
            `  导览 ${i + 1}/6 ${String(m.step).padEnd(9)} 气泡 ${String(m.bubbleW).padStart(4)}px ` +
              `中心 x=${String(m.bubbleCx).padStart(4)} · 锚点 x=${String(m.anchorCx).padStart(4)}` +
              `(${String(m.anchorW).padStart(3)}px) ` +
              `→ 偏离 ${String(dx).padStart(4)}px  [${m.side}]` +
              (m.offscreen ? '  ⚠️ 气泡出屏' : '') +
              (bad
                ? `  ⚠️ ${m.anchorInSpan === false ? '锚点中心不在气泡跨度内' : `偏离 > ${MAX_DRIFT}px 且未贴边`}`
                : ''),
          )
        }
        if (m?.offscreen) failures++

        /* ⚠️ 原来是 `if (i < 3) await waitFor('[data-tour-bubble]')` ——
           **那是个空操作**：切步之后 `[data-tour-bubble]` 一直在（同一个元素，
           只是属性值变了），`waitFor` 立刻返回，等于没等。
           结果可能量到上一步的布局（e2e-check 里专门写了注释讲这个坑）。
           要等的是**属性值变了**。 */
        const hasNext = await page.evaluate(() =>
          [...document.querySelectorAll('button')].some(
            (b) => (b.textContent ?? '').trim() === '下一步',
          ),
        )
        if (!hasNext) {
          await clickExact(page, '知道啦')
          const gone = await page
            .waitForFunction(() => !document.querySelector('[data-tour-bubble]'), { timeout: 5000 })
            .then(() => true, () => false)
          console.log(`  导览收尾（第 ${i + 1} 步点「知道啦」）→ 气泡${gone ? '已消失' : '⚠️ 仍在'}`)
          break
        }
        const prev = m?.step
        await clickExact(page, '下一步')
        const moved = await page
          .waitForFunction(
            (p) => {
              const b = document.querySelector('[data-tour-bubble]')
              return !!b && b.getAttribute('data-tour-bubble') !== p
            },
            { timeout: 5000 },
            prev,
          )
          .then(() => true, () => false)
        if (!moved) console.log(`  ⚠️ 点了「下一步」，气泡仍停在 ${prev}`)
      }
    }
    console.log(`  页面错误 ${errors.length} 条`)
    if (errors.length) failures += errors.length
  } finally {
    await browser.close()
  }
}
console.log(`\n图在 ${OUT}/`)
console.log(
  failures
    ? `❌ ${failures} 条未过（平板导览气泡没有对着锚点，或有页面报错）`
    : `✅ 全过：平板上气泡都对着锚点，且没有页面报错`,
)
process.exit(failures ? 1 : 0)
