/**
 * 动物小屋走查图 + 结构自检。
 *
 * 用法：node scripts/capture-animals.mjs [url] [outDir]
 *
 * 为什么单独一份：`capture.mjs` / `e2e-check.mjs` / `e2e-gameplay.mjs`
 * **都不进动物小屋** —— 8 种动物的外观是这三个脚本共同的盲区
 * （和 `capture-tablet-onboarding.mjs` / `capture-games.mjs` 同一类问题）。
 *
 * 这一版是**把 emoji 换成内联 SVG 精灵**之后的走查，所以断言的重点是
 * 「精灵真的挂上了、而且真的替掉了 emoji」—— 光看截图不算数，
 * 因为 emoji 和精灵在缩略图里长得差不多，只有量 DOM 才分得清。
 *
 * 三个坑（都真踩过，见 shot-farm2d.mjs）：
 *   1. 入场页会自己切到主界面（~1.9s），不等它会撞上那次导航。
 *   2. `makeProfileDir()` 每次建**新**目录 —— 两个视口共用一个 browser 就共用
 *      一个库，第二遍的状态是脏的。所以**每个视口各起一个 browser**。
 *   3. 走查脚本**不许只打印**，要硬断言 + 非零退出码。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? '.e2e-scratch/animals'

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

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
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

/** 点一个「文字包含 needle」的按钮 */
const clickContains = (page, needle) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      (x.textContent ?? '').includes(t),
    )
    if (!b) return false
    b.click()
    return true
  }, needle)

for (const vp of VIEWPORTS) {
  console.log(`\n── ${vp.name} ${vp.width}×${vp.height} ──`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`capture-animals-${vp.name}`),
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })
  const page = await browser.newPage()
  const consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 })
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await dismissOnboarding(page)
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })

  /* ---- ① 铺好数据：12 块地全开 + 8 种动物全部入园 ---- */
  /* ⚠️ `unlockAll()` 的最后一句是 `window.location.reload()` —— 它会**把页面整个重载**，
     重载后回到入场页，还要 ~1.9s 才自己切到主界面。
     不等这一步，后面找导航、找「动物」按钮会**全部落空**（第一版就栽在这，
     报的是「农场页没有动物入口」，看着像按钮没渲染）。
     ⚠️ 重载会把重载前那一段的 console error 也带过来，所以在稳定之后清一次
     —— 我们要验的是**动物小屋这一屏**有没有报错，不是入场页的陈旧噪音。 */
  await page.evaluate(async () => {
    if (window.__kqf__?.unlockAll) await window.__kqf__.unlockAll()
  })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 30000 })
  await dismissOnboarding(page)
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 10000 })
  await wait(600)
  consoleErrors.length = 0

  /* ---- ② 进农场 → 动物小屋 ---- */
  const openedFarm = await clickExact(page, '🌾农场')
  if (!openedFarm) await clickContains(page, '农场')
  await wait(600)
  const openedBarn = await clickContains(page, '动物')
  check('农场页有「动物」入口，点了能进动物小屋', openedBarn)
  await page.waitForFunction(() => document.body.innerText.includes('我的动物'), {
    timeout: 8000,
  })
  await wait(500)

  /* ---- ③ 「我的动物」：每只动物都必须是 SVG 精灵，不是 emoji ---- */
  const mine = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('li')]
    return {
      sprites: document.querySelectorAll('svg.kqf-animal').length,
      /* 精灵的 id 决定画的是哪只 —— 直接读 <use> 的 href，比看外观可靠 */
      ids: [...document.querySelectorAll('svg.kqf-animal use')].map((u) =>
        (u.getAttribute('href') ?? '').replace('#kqf-a-', ''),
      ),
      /* 兜底那一支才会渲染 span；有 span 就说明有动物没画精灵 */
      fallbackSpans: [...document.querySelectorAll('li span')].filter((s) =>
        /^(🐔|🐤|🦆|🐥|🐑|🐏|🐷|🐖|🐄|🐮|🐕|🐶|🐻|🦒)$/.test((s.textContent ?? '').trim()),
      ).length,
      cards: cards.length,
    }
  })
  check('我的动物里画出了精灵', mine.sprites >= 8, `svg.kqf-animal = ${mine.sprites}`)
  check(
    '★ 没有一只动物还在用 emoji 兜底',
    mine.fallbackSpans === 0,
    mine.fallbackSpans ? `还有 ${mine.fallbackSpans} 个 emoji` : '0 个',
  )
  check(
    '8 种动物都在（成年帧）',
    new Set(mine.ids.map((s) => s.replace(/-[01]$/, ''))).size === 8,
    `去重后 ${new Set(mine.ids.map((s) => s.replace(/-[01]$/, ''))).size} 种`,
  )
  await page.screenshot({ path: `${OUT}/${vp.name}-1-我的动物.png`, fullPage: true })

  /* ---- ④ 「领养一只」：幼崽 → 成年 两帧都要在 ---- */
  await clickExact(page, '➕ 领养一只')
  await wait(600)
  const adopt = await page.evaluate(() => {
    const uses = [...document.querySelectorAll('svg.kqf-animal use')].map((u) =>
      (u.getAttribute('href') ?? '').replace('#kqf-a-', ''),
    )
    /* 尺寸检查：精灵不能撑破它所在的方框（撑破了就是「动物出框」） */
    const overflow = [...document.querySelectorAll('svg.kqf-animal')].filter((s) => {
      const box = s.parentElement?.getBoundingClientRect()
      const r = s.getBoundingClientRect()
      if (!box || !r.width) return false
      return r.left < box.left - 1 || r.right > box.right + 1
    }).length
    /* ★ 语义断言（对照组）：幼崽帧**画出来的图形**必须比成年帧小。
       只数「-0 / -1 各有几个」是不够的 —— 第一版把两帧的 id 写反了
       （`baby ? 1 : 0`），数量照样 8 / 8，**全绿**，是眼睛看出来的。
       量 bbox 才分得出「哪个是哪个」。 */
    const pairs = [...document.querySelectorAll('li')]
      .map((li) => {
        const uses = [...li.querySelectorAll('use')]
        const area = (u) => {
          try {
            const r = u.getBBox()
            return r.width * r.height
          } catch {
            return 0
          }
        }
        const baby = uses.find((u) => (u.getAttribute('href') ?? '').endsWith('-0'))
        const adult = uses.find((u) => (u.getAttribute('href') ?? '').endsWith('-1'))
        return baby && adult ? { b: area(baby), a: area(adult) } : null
      })
      .filter(Boolean)
    return {
      uses,
      babyFrames: uses.filter((u) => u.endsWith('-0')).length,
      adultFrames: uses.filter((u) => u.endsWith('-1')).length,
      /* 幼崽 >= 成年 = 两帧写反了（或缩放没生效） */
      inverted: pairs.filter((p) => !(p.b < p.a)).length,
      pairs: pairs.length,
      overflow,
      rows: [...document.querySelectorAll('li')].length,
    }
  })
  check('领养列表里 8 种动物都在', adopt.rows === 8, `li = ${adopt.rows}`)
  check(
    '幼崽帧与成年帧都渲染了（每种各 8）',
    adopt.babyFrames === 8 && adopt.adultFrames === 8,
    `幼崽 ${adopt.babyFrames} / 成年 ${adopt.adultFrames}`,
  )
  check(
    '★ 幼崽帧画得比成年帧小（两帧没写反）',
    adopt.pairs === 8 && adopt.inverted === 0,
    `比了 ${adopt.pairs} 对，反的 ${adopt.inverted} 对`,
  )
  check('精灵没有撑破所在的方框', adopt.overflow === 0, `溢出 ${adopt.overflow} 个`)
  await page.screenshot({ path: `${OUT}/${vp.name}-2-领养一只.png`, fullPage: true })

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
