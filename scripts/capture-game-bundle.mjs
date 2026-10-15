/**
 * P1 验收：**游戏包真的可插拔**（spec §12）。
 *
 * 用法：
 *   npm run build:games                                  # 先出包
 *   node scripts/capture-game-bundle.mjs [appUrl] [outDir]
 *
 * 为什么必须单独一个脚本：`capture-games.mjs` 只看得见**家长栏里那张列表**，
 * 而 P1 的全部价值在「一个独立构建的包能不能真的被装进来、挂起来、玩起来」。
 * 那件事没有任何既有脚本看得见 —— 正是本项目最怕的盲区。
 *
 * ------------------------------------------------------------
 * 它证明的五件事（对应 spec §12.7 的 P1 定义）
 *
 *   ① **独立构建产物能装进来** —— 包由 `games-src/` 单独构建（`games-dist/demo.js`），
 *      不在 App 的 Vite 构建里。这里经真 HTTP 取回、落进 `gameKv`。
 *   ② **能挂进宿主容器，而且画出来的东西真的看得见** —— 沿用 `capture-sky.mjs`
 *      那套 `elementFromPoint` 网格采样：`querySelector` 找得到只证明**画了**。
 *   ③ **它能读写自己的状态，刷新后还在** —— 玩一次 → 查 `gameKv` → `reload()` 再查。
 *   ④ **命名空间隔离** —— 再装一个**合成包**，让它报告自己看得见哪些键，
 *      必须是空的。只断言「demo 自己的键在」是不够的：那只证明了「写进去了」，
 *      没证明「没串到别人家」。
 *   ⑤ **坏包被挡在门外** —— `minHostApi` 太高、以及**盗用内置游戏 id** 的包，
 *      都必须被拒，而且**一个字节都不落盘**。
 *
 * ------------------------------------------------------------
 * 两条本项目的老规矩
 *
 * · **先跑反空转对照**：动手之前先断言「什么都没装、底栏还是农场」。
 *   少了这一步，后面每一条断言都可能是**恒真**的（比如包压根没装成功，
 *   而「容器里有东西」碰巧被别的东西满足了）。
 * · **硬断言 + 非零退出码**：只打印不断言的走查脚本，踩过「全绿却漏掉最坏情况」。
 *
 * ⚠️ 变量名是 `TARGET` 不是 `URL` —— `URL` 会遮住全局构造器，
 * 于是脚本里任何 `new URL()` 都抛 `TypeError: URL is not a constructor`。
 *
 * ⚠️ 期望值（id / 名字 / 版本 / 花费 / 产出）全部从 `games-src/demo/index.ts`
 * **读**出来，不在这里抄一份。抄了的话，改了 demo 而脚本照旧绿 ——
 * 守卫会**悄悄变弱**（`scripts/lib/quality.mjs` 是同一个套路）。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4396/'
const OUT = process.argv[3] ?? '.e2e-scratch/game-bundle'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE_DIR = join(PROJECT_ROOT, 'games-dist')
const BUNDLE_FILE = join(BUNDLE_DIR, 'demo.js')
const DEMO_SRC = join(PROJECT_ROOT, 'games-src', 'demo', 'index.ts')

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

/* ============================================================
   0. 静态前置：包存在，而且是**自包含**的
   ============================================================ */

if (!existsSync(BUNDLE_FILE)) {
  console.error(
    `找不到 ${BUNDLE_FILE}\n  先出包：CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build:games`,
  )
  process.exit(2)
}

const bundleCode = readFileSync(BUNDLE_FILE, 'utf8')

/* 期望值从**源码**解析 —— 解析不出就退出，不猜。 */
const demoSource = readFileSync(DEMO_SRC, 'utf8')
function fromSource(re, what) {
  const m = demoSource.match(re)
  if (!m) {
    console.error(`无法从 ${DEMO_SRC} 解析出 ${what} —— 脚本和源码对不上了，先修脚本`)
    process.exit(2)
  }
  return m[1]
}
const GAME_ID = fromSource(/^\s*id:\s*'([^']+)'/m, 'manifest.id')
const GAME_NAME = fromSource(/^\s*name:\s*'([^']+)'/m, 'manifest.name')
const GAME_VERSION = fromSource(/^\s*version:\s*'([^']+)'/m, 'manifest.version')
const MIN_HOST_API = Number(fromSource(/^\s*minHostApi:\s*(\d+)/m, 'manifest.minHostApi'))
const PLAY_COST = Number(fromSource(/const PLAY_COST = (\d+)/, 'PLAY_COST'))
const PAYOUT = Number(fromSource(/const PAYOUT = (\d+)/, 'PAYOUT'))

console.log('── 静态检查 ──')
check(`包存在（games-dist/demo.js）`, true, `${(Buffer.byteLength(bundleCode) / 1024).toFixed(2)} kB`)

/**
 * ★ 包必须**零裸模块说明符**。
 *
 * blob 模块解析不了裸说明符（`import React from 'react'` 会抛
 * 「Failed to resolve module specifier」），所以每个游戏包都得是
 * 单文件自包含的。这条**不需要浏览器**就能验，而且它是「包能不能被加载」
 * 的前置条件 —— 放在这里比等 import() 抛错更早、更好定位。
 */
const bareImport = /\bfrom\s*["']/.test(bundleCode) || /\bimport\s*\(\s*["']/.test(bundleCode)
check('★ 包是自包含的（没有任何 import 说明符）', !bareImport)

/* ============================================================
   1. 起一个临时静态服务，把包经**真 HTTP** 发出去
   ============================================================ */

/**
 * ★★ 这个临时服务**必须发 CORS 头**，而且这不是脚本的便利，是**架构要求**。
 *
 * App 跑在自己的 origin 上（Web 是 `http://127.0.0.1:4390`，
 * Capacitor 里是 `http://localhost` / `capacitor://localhost`），
 * 而包放在托管域名上 —— 那是**跨域**。少了 `Access-Control-Allow-Origin`，
 * 浏览器直接把响应挡掉，`fetch` 抛的是一句毫无信息量的
 * **`TypeError: Failed to fetch`**（2026-10-15 第一次跑这个脚本时就是这么红的）。
 *
 * ➜ 所以托管侧（对象存储 / CDN）**必须**配 CORS，而且这是 P2 的准入条件之一：
 *    配不出来的托管商，方案 A 根本走不通。
 *    详见 spec §12.3 / §12.4。
 */
const server = createServer((req, res) => {
  const name = (req.url ?? '/').split('?')[0].replace(/^\/+/, '')
  const file = join(BUNDLE_DIR, name)
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }
  if (!existsSync(file)) {
    res.writeHead(404, cors)
    res.end('not found')
    return
  }
  res.writeHead(200, { ...cors, 'content-type': 'text/javascript; charset=utf-8' })
  res.end(readFileSync(file))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const bundlePort = server.address().port
const BUNDLE_URL = `http://127.0.0.1:${bundlePort}/demo.js`
console.log(`  · 包服务：${BUNDLE_URL}`)

/** 合成包（走 data: URL，不用落盘）。`onMount` 是塞进 mount() 里的一段源码。 */
function synthBundle({ id, minHostApi = 1, onMount = '' }) {
  return `
export default {
  manifest: {
    id: ${JSON.stringify(id)},
    name: '合成包',
    emoji: '🧪',
    tabLabel: '合成',
    version: '1.0.0',
    minHostApi: ${minHostApi},
    coin: { id: 'c', name: '币', emoji: '🪙' },
    economy: { playCost: 1, expectedPayout: 1, capPerPrize: 1 },
  },
  mount(container, host) {
    ${onMount}
    return () => { container.innerHTML = '' }
  },
}
`
}
const dataUrl = (code) => `data:text/javascript,${encodeURIComponent(code)}`

/* ============================================================
   2. 开浏览器
   ============================================================ */

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir('shot-game-bundle'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
page.on('pageerror', (e) => consoleErrors.push(String(e)))

await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__?.plugin, { timeout: 20000 })
await wait(400)

/** 读一次插件相关的现状 */
const snapshot = () =>
  page.evaluate(() => ({
    installed: Object.keys(window.__kqf__.getState().installedGames),
    activeGameId: window.__kqf__.getState().activeGameId,
    hostApiVersion: window.__kqf__.plugin.hostApiVersion,
    navLabels: [...document.querySelectorAll('nav button')].map((b) =>
      (b.textContent ?? '').trim(),
    ),
    navTours: [...document.querySelectorAll('nav button')].map((b) =>
      b.getAttribute('data-tour'),
    ),
  }))

/* ============================================================
   3. ★ 反空转对照：动手之前，一切必须是「空」的
   ============================================================ */

console.log('\n【0】反空转对照 —— 动手之前先证明「现在还什么都没有」')
const before = await snapshot()
check('★ 一个包都没装', before.installed.length === 0, JSON.stringify(before.installed))
check('★ 底栏的游戏格是农场（`tab-farm`）', before.navTours.includes('tab-farm'), before.navTours.join(','))
check(
  '★ 底栏没有 `tab-' + GAME_ID + '`（装了才会有）',
  !before.navTours.includes(`tab-${GAME_ID}`),
  before.navTours.join(','),
)
check('宿主 API 版本读得到', typeof before.hostApiVersion === 'number', String(before.hostApiVersion))

/* ============================================================
   4. 坏包被挡在门外
   ============================================================ */

console.log('\n【1】坏包必须被拒，而且一个字节都不落盘')

const rejectCases = [
  {
    label: '★ 要求的宿主 API 比现在新（版本门）',
    url: dataUrl(synthBundle({ id: 'need-future', minHostApi: before.hostApiVersion + 1 })),
    wantIn: ['宿主', String(before.hostApiVersion + 1)],
  },
  {
    label: '★★ 盗用内置游戏 id（劫持守卫）',
    url: dataUrl(synthBundle({ id: 'farm' })),
    wantIn: ['farm'],
  },
  {
    label: '根本没有 mount（形状门）',
    url: dataUrl(`export default { manifest: {} }`),
    wantIn: ['mount'],
  },
  {
    label: '语法就跑不起来（语法门）',
    url: dataUrl('export default {{{ 这不是 js'),
    wantIn: ['执行失败'],
  },
]

for (const c of rejectCases) {
  const res = await page.evaluate(
    (u) => window.__kqf__.plugin.installFromUrl(u),
    c.url,
  )
  const hit = c.wantIn.every((w) => res.message.includes(w))
  check(c.label, res.ok === false && hit, `ok=${res.ok} msg=${res.message}`)
}

const afterRejects = await page.evaluate(() => window.__kqf__.plugin.kvOwnerIds())
check(
  '★ 四个坏包**一个字节都没落盘**（`gameKv` 还是空的）',
  afterRejects.length === 0,
  JSON.stringify(afterRejects),
)

/* ============================================================
   5. 装真包
   ============================================================ */

console.log('\n【2】装真包（独立构建的 `demo.js`，经真 HTTP 取回）')
const install = await page.evaluate((u) => window.__kqf__.plugin.installFromUrl(u), BUNDLE_URL)
check('装成功', install.ok === true, install.message)

/**
 * ⚠️ 装不上就**到此为止**。
 *
 * 下面每一步都以「包里已经装好了」为前提 —— 继续跑只会得到一串
 * `Cannot read properties of null` 的崩溃，把真正的原因（这一条）
 * 埋在几十行噪音下面。走查脚本的价值在于**指出第一现场**。
 */
if (install.ok !== true) {
  console.log('\n装不上，后面全依赖它 —— 就此停下。')
  console.log('  · 跨域？托管侧必须发 `Access-Control-Allow-Origin`（见脚本里临时服务的注释）')
  await page.screenshot({ path: `${OUT}/0-装不上.png`, fullPage: true })
  await browser.close()
  server.close()
  process.exit(1)
}

const afterInstall = await snapshot()
check(`\`installedGames\` 里出现了 ${GAME_ID}`, afterInstall.installed.includes(GAME_ID), afterInstall.installed.join(','))
check(
  '装完**不会**自动切成当前（切当前是一次显式操作）',
  afterInstall.activeGameId === 'farm',
  afterInstall.activeGameId,
)

const manifest = await page.evaluate(
  (id) => window.__kqf__.getState().installedGames[id],
  GAME_ID,
)
check('manifest.name 从包里读出来了', manifest?.name === GAME_NAME, `${manifest?.name} / 期望 ${GAME_NAME}`)
check('manifest.version 从包里读出来了', manifest?.version === GAME_VERSION, `${manifest?.version}`)
check('manifest.minHostApi 从包里读出来了', manifest?.minHostApi === MIN_HOST_API, `${manifest?.minHostApi}`)
check('manifest.economy.playCost 和源码一致', manifest?.economy?.playCost === PLAY_COST, `${manifest?.economy?.playCost} / 期望 ${PLAY_COST}`)
check('manifest.economy.expectedPayout 和源码一致', manifest?.economy?.expectedPayout === PAYOUT, `${manifest?.economy?.expectedPayout} / 期望 ${PAYOUT}`)

/* ============================================================
   6. 设为当前 → 底栏跟着变 → 切过去 → 挂载
   ============================================================ */

console.log('\n【3】设为当前，底栏和页面都跟着走')
await page.evaluate((id) => window.__kqf__.getState().setActiveGame(id), GAME_ID)
await wait(500)

const afterActive = await snapshot()
check('`activeGameId` 解析成了下载来的游戏', afterActive.activeGameId === GAME_ID, afterActive.activeGameId)
check(
  `★ 底栏游戏格的锚点变成了 \`tab-${GAME_ID}\``,
  afterActive.navTours.includes(`tab-${GAME_ID}`),
  afterActive.navTours.join(','),
)
check(
  `★ 底栏文字变成了「${GAME_NAME}」`,
  afterActive.navLabels.some((t) => t.includes(GAME_NAME)),
  afterActive.navLabels.join(' | '),
)

// 切到游戏那一格
const clicked = await page.evaluate((id) => {
  const b = document.querySelector(`nav button[data-tour="tab-${id}"]`)
  if (!b) return false
  b.click()
  return true
}, GAME_ID)
check('底栏的游戏格点得到', clicked === true)
await wait(700)

const mounted = await page.evaluate((id) => {
  const host = document.querySelector(`[data-plugin-host="${id}"]`)
  return {
    hostExists: !!host,
    hostChildren: host?.childElementCount ?? -1,
    panelExists: !!document.querySelector('[data-demo-game="panel"]'),
    playExists: !!document.querySelector('[data-demo-game="play"]'),
    title: document.querySelector('[data-demo-game="panel"] h2')?.textContent ?? '',
  }
}, GAME_ID)
check('★ 宿主容器渲染出来了（`data-plugin-host`）', mounted.hostExists === true)
check('★ 容器里**真的有东西**（插件挂进来了）', mounted.hostChildren > 0, `childElementCount=${mounted.hostChildren}`)
check('★ 插件自己的 DOM 在（`data-demo-game="panel"`）', mounted.panelExists === true)
check('插件画的是它自己的标题', mounted.title === GAME_NAME, mounted.title)

await page.screenshot({ path: `${OUT}/1-插件游戏挂起来了.png`, fullPage: true })
console.log(`  · 已存图 ${OUT}/1-插件游戏挂起来了.png`)

/**
 * ★ **平板宽度：插件必须和别的页面同宽。**
 *
 * `.page-col` 是这个 App **唯一**的宽度来源（430 / 672 / 896 / 1024）。
 * 宿主忘了套它的话，一款下载来的游戏会在横屏平板上铺满整个 1024px，
 * 而任务 / 兑换 / 积分页收在 896px —— 一眼就看出来不是同一个 App。
 *
 * ⚠️ 手机上这条是**恒等**的（`page-col` 在 390px 下就是 `width:100%`），
 * 所以**只在手机视口上量是量不出来的** —— 必须真的把视口调宽再量。
 * 这是本项目「平板适配」那条线最容易漏掉的回归点。
 */
{
  const before = page.viewport()
  await page.setViewport({ width: 834, height: 1112, deviceScaleFactor: 2 })
  await wait(500)
  const wide = await page.evaluate((id) => {
    const host = document.querySelector(`[data-plugin-host="${id}"]`)
    const col = host?.closest('.page-col')
    const r = host?.getBoundingClientRect()
    /*
     * ★ 探针自证：**临时把 `page-col` 摘掉再量一次**。
     *
     * 不摘的话，「≤672」这条断言可能只是因为视口本来就窄 / 容器碰巧
     * 有别的约束才成立的 —— 那就是**恒真**的断言。摘掉之后必须量到
     * 接近整个视口宽（= 宿主忘了套 `page-col` 时的真实后果），
     * 拿回来又必须回到 ≤672。两次都量到才算这条断言有效。
     */
    const saved = col?.className
    if (col) col.className = saved.replace('page-col', '')
    const bare = host?.getBoundingClientRect().width ?? -1
    if (col && saved) col.className = saved

    return {
      hasCol: !!col,
      width: r ? Math.round(r.width) : -1,
      bare: Math.round(bare),
      left: r ? Math.round(r.left) : -1,
      right: r ? Math.round(innerWidth - r.right) : -1,
      vw: innerWidth,
    }
  }, GAME_ID)
  check('★ 插件容器被收进 `.page-col`（宽度由宿主给）', wide.hasCol === true)
  check(
    '★ 平板 834px 下没铺满（≤672，和别的页面同宽）',
    wide.width > 0 && wide.width <= 672,
    `量到 ${wide.width}px（视口 ${wide.vw}px）`,
  )
  check(
    '★★ 探针自证：摘掉 `page-col` 必须铺满（否则「≤672」是恒真的）',
    wide.bare > 672,
    `摘掉后量到 ${wide.bare}px`,
  )
  check(
    '★ 平板下是**居中**的（左右留白基本相等）',
    Math.abs(wide.left - wide.right) <= 2,
    `左 ${wide.left}px / 右 ${wide.right}px`,
  )
  await page.screenshot({ path: `${OUT}/3-平板宽度.png`, fullPage: false })
  console.log(`  · 已存图 ${OUT}/3-平板宽度.png`)
  await page.setViewport(before)
  await wait(400)
}

/* ============================================================
   7. ★★ 遮挡探针：画了什么 ≠ 看得见什么
   ============================================================ */

console.log('\n【4】★★ 遮挡探针 —— 插件画出来的东西**真的看得见**')
const probe = await page.evaluate(() => {
  const btn = document.querySelector('[data-demo-game="play"]')
  if (!btn) return { ok: false, why: '找不到抽奖按钮' }
  const r = btn.getBoundingClientRect()

  /** 数「采样点上最上层的那一层，是不是还在这个按钮里」 */
  const sample = () => {
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
        if (el && (el === btn || btn.contains(el))) visible++
        else if (!blocker && el) {
          blocker = `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/).slice(0, 2).join('.')}`
        }
      }
    }
    return { pct: total ? Math.round((visible / total) * 100) : -1, sampled: total, blocker }
  }

  const normal = sample()
  /* 自检：临时盖一层全屏遮罩，可见率必须掉到 0；拿掉又要回到原值。
     掉不下来 = **探针是坏的**，而不是按钮是好的 —— 这条让两种情况不长得一样。 */
  const cover = document.createElement('div')
  cover.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.02)'
  document.body.appendChild(cover)
  const during = sample()
  cover.remove()
  const after = sample()

  return {
    ok: true,
    rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`,
    height: Math.round(r.height),
    normal,
    selfTest: { during: during.pct, after: after.pct },
  }
})

check('抽奖按钮找得到', probe.ok === true, probe.why ?? probe.rect)
if (probe.ok) {
  check(
    '★ 按钮**真的看得见**（网格采样，最上层就是它）',
    probe.normal.pct === 100,
    `可见率 ${probe.normal.pct}%（采样 ${probe.normal.sampled} 点）${probe.normal.blocker ? ` 被 ${probe.normal.blocker} 挡住` : ''}`,
  )
  check(
    '★★ 探针自检：盖一层全屏遮罩必须掉到 0%，拿掉又回到 100%（否则探针恒绿）',
    probe.selfTest.during === 0 && probe.selfTest.after === 100,
    `遮罩中 ${probe.selfTest.during}% → 拿掉后 ${probe.selfTest.after}%`,
  )
  check('抽奖按钮 ≥44px 高（触控目标下限）', probe.height >= 44, `${probe.height}px`)
}

/* ============================================================
   8. 玩 → 状态写进自己的命名空间；以及「积分不够」那条路
   ============================================================ */

console.log('\n【5】玩 —— 投入 / 产出 / 次数，以及「积分不够」那条路')

const readChip = (which) =>
  page.evaluate(
    (w) => document.querySelector(`[data-demo-game="${w}"]`)?.textContent ?? '',
    which,
  )
const num = (s) => {
  const m = s.match(/\d+/)
  return m ? Number(m[0]) : -1
}

/**
 * ★ 先把积分花到不够为止。
 *
 * 这一步顺带验了「界面不许承诺做不到的事」：**不够的时候按钮必须是禁用的**，
 * 而不是让孩子点一下再弹个失败。这两条都是「能玩」的一部分，缺一条
 * 就是界面在说一件不成立的事。
 */
let drained = null
for (let i = 0; i < 40; i++) {
  drained = await page.evaluate(() => {
    const btn = document.querySelector('[data-demo-game="play"]')
    return {
      missing: !btn,
      balance: window.__kqf__.getState().balance,
      disabled: btn?.disabled ?? null,
      text: btn?.textContent ?? '',
    }
  })
  // 按钮不在了就别空转 40 轮 —— 报出来的应该是「按钮没了」，不是超时
  if (drained.missing || drained.disabled) break
  await page.evaluate(() => document.querySelector('[data-demo-game="play"]')?.click())
  await wait(380)
}
check('抽奖按钮还在页面上', drained?.missing === false, drained?.missing ? '按钮没了' : '')
check(
  '★ 积分不够时按钮**禁用**（不是点了才失败）',
  drained?.disabled === true,
  `余额 ${drained?.balance}，按钮「${drained?.text}」`,
)
check(
  '禁用时文案说清了要多少分',
  (drained?.text ?? '').includes(String(PLAY_COST)),
  drained?.text,
)

/**
 * ★★ 家长加分之后，游戏必须**自己**变回可用。
 *
 * 没有这一步，「按钮灰了以后要退出重进」这种 bug 就永远测不出来 ——
 * 而它不报错，看起来只是「加了分没用」。demo 里那个 repaint 定时器
 * 就是为了这件事（见 `games-src/demo/index.ts` 的注释）。
 */
await page.evaluate((n) => window.__kqf__.addPoints(n), PLAY_COST * 2)
await wait(2200)
const revived = await page.evaluate(() => {
  const btn = document.querySelector('[data-demo-game="play"]')
  return { disabled: btn?.disabled ?? null, text: btn?.textContent ?? '' }
})
check(
  '★★ 加分之后按钮**自己变回可用**（不用退出重进）',
  revived.disabled === false,
  `按钮「${revived.text}」`,
)

const drawsBefore = num(await readChip('draws'))
const coinBefore = num(await readChip('coin'))
const balanceBefore = await page.evaluate(() => window.__kqf__.getState().balance)

await page.evaluate(() => document.querySelector('[data-demo-game="play"]')?.click())
await wait(1000)

const played = await page.evaluate(() => ({
  balance: window.__kqf__.getState().balance,
  coin: document.querySelector('[data-demo-game="coin"]')?.textContent ?? '',
  draws: document.querySelector('[data-demo-game="draws"]')?.textContent ?? '',
  stage: document.querySelector('[data-demo-game="stage"]')?.textContent ?? '',
}))

check(
  `★ 扣了积分（${balanceBefore} → ${played.balance}，正好 -${PLAY_COST}）`,
  played.balance === balanceBefore - PLAY_COST,
  `实际 -${balanceBefore - played.balance}`,
)
check(
  `★ 插件自己的币正好 +${PAYOUT}（${coinBefore} → ${num(played.coin)}）`,
  num(played.coin) === coinBefore + PAYOUT,
  played.coin,
)
check(
  '插件自己记的次数 +1',
  num(played.draws) === drawsBefore + 1,
  `${drawsBefore} → ${num(played.draws)}`,
)
check('抽到的图案画在了舞台上', played.stage.trim().length > 0, played.stage)

const drawsFinal = num(played.draws)

const kvKeys = await page.evaluate((id) => window.__kqf__.plugin.kv(id), GAME_ID)
check(
  '★ 它的键落在自己的命名空间里（`draws` / `__coin` / `__bundle`）',
  ['draws', '__coin', '__bundle'].every((k) => kvKeys.includes(k)),
  JSON.stringify(kvKeys),
)

await page.screenshot({ path: `${OUT}/2-玩过之后.png`, fullPage: true })
console.log(`  · 已存图 ${OUT}/2-玩过之后.png`)

/* ============================================================
   9. ★ 命名空间隔离：第二个包看不见第一个的键
   ============================================================ */

console.log('\n【6】★ 命名空间隔离 —— 另一个包看不见 demo 的键')
/*
 * 只断言「demo 自己的键在」是不够的 —— 那只证明了「写进去了」，
 * 没证明「没串到别人家」。所以这里让**另一个包**报告它看得见什么。
 *
 * ★ 这一条第一次跑就是**红的**，而且抓到了一个真问题：
 *   第二个包看到了 `__bundle`（它自己的源码）。顺着查下去发现
 *   `storage.set('__coin', [])` 能把**自己的币账本清空** ——
 *   正好绕过 `mintGameCoin` 里「拒绝 n<=0」（插件不该能销毁自己的币）那条守卫。
 *   修法见 `hostApi.ts` 的 `RESERVED_PREFIX`：`__` 开头的键
 *   get/set 抛、list 滤掉。**这就是走查脚本该有的价值** ——
 *   单元测试没覆盖到，因为它只测「一个游戏自己的视角」。
 */
const SYNTH_ID = 'synth-peek'
const peekBundle = synthBundle({
  id: SYNTH_ID,
  onMount: `
    const box = document.createElement('div')
    box.setAttribute('data-synth', 'keys')
    container.append(box)
    void (async () => {
      const keys = Object.keys(await host.storage.list())
      box.textContent = keys.length ? keys.join(',') : '(空)'
    })()
  `,
})
const peekInstall = await page.evaluate(
  (u) => window.__kqf__.plugin.installFromUrl(u),
  dataUrl(peekBundle),
)
check('第二个包装得进来', peekInstall.ok === true, peekInstall.message)

const peek = await page.evaluate(
  async ({ id, target }) => {
    const el = document.createElement('div')
    document.body.append(el)
    const unmount = await window.__kqf__.getState().mountGame(id, el)
    await new Promise((r) => setTimeout(r, 500))
    const text = el.querySelector('[data-synth="keys"]')?.textContent ?? ''
    unmount()
    el.remove()
    return { text, target }
  },
  { id: SYNTH_ID, target: GAME_ID },
)
check(
  '★★ 第二个包看到的存储是**空的**（碰不到 demo 的键）',
  peek.text === '(空)',
  `它看到：「${peek.text}」`,
)

const owners = await page.evaluate(() => window.__kqf__.plugin.kvOwnerIds())
check(
  '★ `gameKv` 里只有这两个游戏自己的 id，没有别的命名空间',
  owners.length === 2 && owners.includes(GAME_ID) && owners.includes(SYNTH_ID),
  JSON.stringify(owners),
)

/* ============================================================
   10. 刷新后还在
   ============================================================ */

console.log('\n【7】刷新页面 —— 包和状态都还在')
await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForFunction(() => !!window.__kqf__?.plugin, { timeout: 20000 })
await wait(1200)

const afterReload = await snapshot()
check('刷新后包还在', afterReload.installed.includes(GAME_ID), afterReload.installed.join(','))
check('刷新后「当前游戏」还是它', afterReload.activeGameId === GAME_ID, afterReload.activeGameId)

const reloadKeys = await page.evaluate((id) => window.__kqf__.plugin.kv(id), GAME_ID)
check(
  '刷新后它的状态键还在（`draws` 没丢）',
  reloadKeys.includes('draws'),
  JSON.stringify(reloadKeys),
)

const drawsAfterReload = await page.evaluate(async (id) => {
  const el = document.createElement('div')
  document.body.append(el)
  const unmount = await window.__kqf__.getState().mountGame(id, el)
  await new Promise((r) => setTimeout(r, 800))
  const text = el.querySelector('[data-demo-game="draws"]')?.textContent ?? ''
  unmount()
  el.remove()
  return text
}, GAME_ID)
check(
  `★ 刷新后它**自己读回了存档**（次数还是 ${drawsFinal}，不是 0）`,
  drawsFinal > 0 && num(drawsAfterReload) === drawsFinal,
  `刷新后「${drawsAfterReload}」，刷新前 ${drawsFinal}`,
)

/* ============================================================
   11. 卸载 → 回落
   ============================================================ */

console.log('\n【8】卸载 —— 包和状态一起走，当前游戏回落')
await page.evaluate((id) => window.__kqf__.plugin.uninstall(id), GAME_ID)
await wait(600)

const afterUninstall = await snapshot()
check('卸载后清单里没有了', !afterUninstall.installed.includes(GAME_ID), afterUninstall.installed.join(','))
check('★ 当前游戏回落成农场', afterUninstall.activeGameId === 'farm', afterUninstall.activeGameId)
check(
  `★ 底栏锚点回到 \`tab-farm\`（不再是 \`tab-${GAME_ID}\`）`,
  afterUninstall.navTours.includes('tab-farm') && !afterUninstall.navTours.includes(`tab-${GAME_ID}`),
  afterUninstall.navTours.join(','),
)

const leftover = await page.evaluate((id) => window.__kqf__.plugin.kv(id), GAME_ID)
check('★ 卸载把它的状态一起删了（重装不会捡到旧存档）', leftover.length === 0, JSON.stringify(leftover))

check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

await browser.close()
server.close()

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
