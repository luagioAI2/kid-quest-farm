/**
 * 游戏市场「详情」逐款走查 —— 每一款都点开、都量、都截图。
 *
 * 用法：node scripts/capture-store-detail.mjs [url] [outDir]
 *
 * ## 为什么单独一份
 *
 * `capture-games.mjs` 只点开**第一款**的详情（用来验「练什么」在详情里）。
 * 剩下那几款的详情页**没有任何脚本看得见** —— 而家长这次的反馈恰好就是
 * 详情页里的问题：「详情页没有娃娃机截图」。
 *
 * 那是一次**图片指错了**（第一张用了奖品货架，看着像电商），
 * 界面上不报错、控制台也不报错，只有人看一眼才知道不对。
 * 所以这里除了截图，还硬断言：
 *
 *   · 每一款的截图**至少 3 张**
 *   · 每一张 `<img>` 都**真的解码出来了**（`naturalWidth > 0`）
 *     —— 路径写错时浏览器只画一个破图标，DOM 里那张 img 照样在，
 *        只数个数会全绿。这是本项目「查不到 ≠ 不存在」的老坑。
 *   · 每张图都有说明文字（截图没有说明等于没截）
 *   · 「练什么」≥ 3 条
 *
 * ⚠️ 判据里**不写死任何一款游戏的截图张数/文案** —— 加了游戏、改了文案
 *   都不该让这个脚本变红。它验的是「结构完整」，不是「内容等于我记的那个」。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { grantGame } from './lib/own.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4396/'
const OUT = process.argv[3] ?? '.e2e-scratch/store-detail'

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
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
]

const clickExact = (page, label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.textContent ?? '').trim() === t,
    )
    if (!b) return false
    b.click()
    return true
  }, label)

for (const vp of VIEWPORTS) {
  console.log(`\n── ${vp.name} ${vp.width}×${vp.height} ──`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`shot-detail-${vp.name}`),
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

  /* 进 设置 → 游戏，过家长密码 */
  await page.evaluate(() => document.querySelector('button[aria-label="设置"]')?.click())
  const inSettings = await page
    .waitForFunction(
      () => [...document.querySelectorAll('h1')].some((h) => h.textContent?.includes('设置')),
      { timeout: 8000 },
    )
    .then(() => true, () => false)
  check('能进设置页', inSettings)
  if (!inSettings) {
    await browser.close()
    continue
  }
  check('设置页有「🎮 游戏」这一栏', await clickExact(page, '🎮 游戏'))
  await wait(400)
  /* 2026-11 起闸门是「卡片 + 按钮」：先点「爸妈：输密码」才弹数字键盘。
     不点的话下面 4 次 0 全落空，而报出来的是「输 0000 后进入游戏栏 ✗」——
     看着像密码错了，其实键盘根本没打开。 */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /爸妈：输密码/.test(x.textContent ?? ''),
    )
    b?.click()
  })
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('button')].filter((b) =>
          /^[0-9]$/.test((b.textContent ?? '').trim()),
        ).length >= 8,
      { timeout: 5000 },
    )
    .catch(() => {})
  for (let i = 0; i < 4; i++) {
    await clickExact(page, '0')
    await wait(180)
  }
  const ready = await page
    .waitForFunction(() => !!document.querySelector('[data-market-builtin]'), { timeout: 8000 })
    .then(() => true, () => false)
  check('输 0000 后进入游戏栏', ready)
  if (!ready) {
    await browser.close()
    continue
  }

  /*
    ⚠️ 2026-11-07 起「未拥有的游戏不显示」⇒ 未拥有的行**连同详情入口一起不渲染**，
    这里直接读 DOM 会读到空数组（然后报「市场里有游戏可点 ✗」，
    真因却是「一款都没拥有」，不是这一屏坏了）。
    所以先按注册表把每一款都预置拥有，再读 DOM —— 顺序反了就一个都读不到。
  */
  const pluginIds = (
    JSON.parse(readFileSync('public/games/index.json', 'utf8')).games ?? []
  ).map((g) => g.id)
  for (const id of pluginIds) await grantGame(page, id)
  await wait(600)

  /* 市场里有哪几款 —— 从 DOM 读，不写死 */
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('[data-store-detail]')].map((b) =>
      b.getAttribute('data-store-detail'),
    ),
  )
  check('市场里有游戏可点', ids.length > 0, ids.join(' / '))

  for (const id of ids) {
    /* 整行可点：用覆盖按钮进详情（和真人点文字区域一样） */
    const opened = await page
      .evaluate((gid) => {
        const b = document.querySelector(`[data-store-detail="${gid}"]`)
        if (!b) return false
        b.click()
        return true
      }, id)
      .catch(() => false)
    if (!opened) {
      check(`[${id}] 能打开详情`, false)
      continue
    }
    const sheetReady = await page
      .waitForFunction(
        () => !!document.querySelector('[role="dialog"][aria-label="游戏详情"]'),
        { timeout: 6000 },
      )
      .then(() => true, () => false)
    check(`[${id}] 能打开详情`, sheetReady)
    if (!sheetReady) continue
    /*
     * ★★ 别用固定 `wait(600)` 等 webp 解码：截图是 `loading="lazy"`，解码也是异步的。
     *    固定值在整轮里会**随机**红两三款（实测 anthill / moestrike / melonjar /
     *    redbutton 轮流红，每次都不一样），看着像「那几款的图坏了」。
     *    ⇒ 判据是「所有 img 的 `naturalWidth > 0`」，轮询到为止。
     *    ⚠️ 不 `scrollIntoView`：那会改变弹层的滚动位置，后面 `el.screenshot()`
     *       截到的就不是家长看到的那一屏了。改成 `loading='eager'` + `decode()`。
     */
    await page.evaluate(async () => {
      const sheet = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
      if (!sheet) return
      await Promise.all(
        [...sheet.querySelectorAll('img')].map(async (im) => {
          im.loading = 'eager'
          try {
            await im.decode()
          } catch {
            /* 解码失败交给下面的断言去报 */
          }
        }),
      )
    })
    await page
      .waitForFunction(
        () => {
          const sheet = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
          const imgs = sheet ? [...sheet.querySelectorAll('img')] : []
          return imgs.length > 0 && imgs.every((im) => im.naturalWidth > 0)
        },
        { timeout: 8000 },
      )
      .catch(() => {})

    const info = await page.evaluate(() => {
      const sheet = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
      if (!sheet) return null
      const heads = [...sheet.querySelectorAll('h4')].map((h) => (h.textContent ?? '').trim())
      /* 练什么那一节的 li 条数 */
      const learnIdx = heads.indexOf('练什么')
      let learn = 0
      if (learnIdx >= 0) {
        const sec = [...sheet.children].find((c) =>
          (c.textContent ?? '').includes('练什么'),
        )
        learn = sec ? sec.querySelectorAll('li').length : 0
      }
      const imgs = [...sheet.querySelectorAll('img')].map((im) => ({
        src: im.getAttribute('src') ?? '',
        w: im.naturalWidth,
        h: im.naturalHeight,
        alt: im.getAttribute('alt') ?? '',
      }))
      /* 说明文字是**可见的那一行**，不是 alt —— 图是装饰性的（`alt=""` 是故意的，
         说明就在图旁边，屏幕阅读器不该把同一句话读两遍） */
      const shots = [...sheet.querySelectorAll('[data-store-shot]')].map((b) => ({
        caption: (b.querySelector('span')?.textContent ?? '').trim(),
      }))
      return {
        title: (sheet.querySelector('h2, h3')?.textContent ?? '').trim(),
        heads,
        learn,
        imgs,
        shots,
        text: (sheet.textContent ?? '').trim().slice(0, 200),
      }
    })
    if (!info) {
      check(`[${id}] 详情内容能读到`, false)
      continue
    }

    check(`[${id}] 「练什么」≥ 3 条`, info.learn >= 3, `${info.learn} 条`)
    check(`[${id}] 截图 ≥ 3 张`, info.imgs.length >= 3, `${info.imgs.length} 张`)
    const broken = info.imgs.filter((x) => !x.w)
    check(
      `[${id}] 每张截图都真的解码出来了`,
      info.imgs.length > 0 && broken.length === 0,
      broken.length ? `坏的：${broken.map((b) => b.src).join(' , ')}` : '全部有 naturalWidth',
    )
    check(
      `[${id}] 每张截图都有说明文字`,
      info.shots.length === info.imgs.length &&
        info.shots.length > 0 &&
        info.shots.every((x) => x.caption.length > 0),
      info.shots.map((x) => x.caption || '(空)').join(' | '),
    )

    /* 截图：把弹层自己截下来（含标题、练什么、截图条） */
    const el = await page.$('[role="dialog"][aria-label="游戏详情"]')
    if (el) {
      await el.screenshot({ path: `${OUT}/${vp.name}-detail-${id}.png` })
      console.log(`  · 已存图 ${OUT}/${vp.name}-detail-${id}.png`)
    }

    /* 关掉，回到列表 */
    await page.evaluate(() => document.querySelector('[data-store-close]')?.click())
    await page
      .waitForFunction(
        () => !document.querySelector('[role="dialog"][aria-label="游戏详情"]'),
        { timeout: 5000 },
      )
      .catch(() => {})
    await wait(250)
  }

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  await browser.close()
}

console.log('\n────────────────────────────────────────────────────')
console.log(failed === 0 ? '全部通过 ✓' : `${failed} 条没过 ✗`)
process.exit(failed === 0 ? 0 : 1)
