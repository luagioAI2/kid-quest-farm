#!/usr/bin/env node
/**
 * **ropeland 在真 App 里走一遍**（安装 → 设为当前 → 进游戏 → 扣积分 → 赚币 → 切走 → 切回 → 卸载）。
 *
 * ```bash
 * npm run build
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
 * CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/e2e-ropeland.mjs http://127.0.0.1:4393/ phone
 * ```
 *
 * ## 为什么不复用 `e2e-plugin-local.mjs`
 *
 * 那一份是按 prizepark 的界面结构写的（`.pp-root` / `#list` / `#btnPlay` / `.ppBar`），
 * 拿它测 ropeland：
 *
 *   - 一批断言在查**根本不存在的元素**（ropeland 的根类是 `.rp-root`，没有机台列表），
 *     于是**全红**；
 *   - 更糟的是它在 `playGeo.hud.t` 上**直接抛 TypeError**，后面的段一条都不跑 ——
 *     看起来像「插件崩了」，其实只是脚本不认识这款游戏的 DOM。
 *
 * 两个游戏长得完全不一样，**共同的只有那条宿主链路**。所以这里只测共性：
 *
 *   ① 装得上、装上的版本对、市场那一行变成「已装」；
 *   ② 设为当前之后**底栏多出一格**（manifest 的 tabLabel 真被用了）；
 *   ③ 启动后宿主给的容器里**真的有东西**（canvas 有像素，不是空白）；
 *   ④ 第一局**不扣积分**（教学局按设计免费）—— 这条是**反向**断言，
 *      专门防「把教学局也当成漏扣费」这种误判；
 *   ⑤ 正式局**扣一次、只扣一次**；
 *   ⑥ 玩完**真拿到游戏币**（走真账本，不是假宿主）；
 *   ⑦ 切走 → `window.__game` 消失、canvas 归零（destroy 真跑了，不是「看不见但还在跑」）；
 *   ⑧ 切回 → 存档读回来还是那个值（落盘了，不是只在内存里）；
 *   ⑨ 卸载 → `gameKv` 里一行不剩。
 *
 * ## 为什么第 ③ 条必须看像素
 *
 * ropeland 的对局画面是**整屏 WebGL**，DOM 里只有按钮。`innerText` 恒为空，
 * 按「文字长度」判空白必然误判；而「加载中」那三个字又能骗过「有内容」的判据。
 * 唯一靠谱的判据是**截图里颜色种类数**——空白画布只有 1 种颜色。
 *
 * ⚠️ 但截图必须 **clip 到插件容器**：整页截图里宿主顶栏底栏自带一堆颜色，恒真。
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import zlib from 'node:zlib'
import { makeProfileDir, SCRATCH_BASE } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4393/'
const VIEWPORT = process.argv[3] ?? 'phone'
const GAME_ID = 'ropeland'

const SIZES = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1112 },
}
const size = SIZES[VIEWPORT]
if (!size) {
  console.error(`✗ 不认识的视口：${VIEWPORT}（可选 ${Object.keys(SIZES).join(' / ')}）`)
  process.exit(2)
}

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const OUT = join(SCRATCH_BASE, 'e2e-ropeland')
mkdirSync(OUT, { recursive: true })

/**
 * manifest 里的三个值，**从宿主清单（`localGames.ts`）读**，不写死。
 *
 * 不直接求值包里的 manifest：那需要 `new Function` 跑一段来源不明的代码，
 * 而且包里的字段顺序变了就会解析错。`localGames.ts` 是宿主**校验并落盘**过的那份，
 * 也是真正被界面用的那份 —— 拿它当基准，脚本和产品就不会各说各话。
 */
const MF = (() => {
  const src = readFileSync(new URL('../src/games/localGames.ts', import.meta.url), 'utf8')
  const at = src.indexOf(`"id": "${GAME_ID}"`)
  if (at < 0) throw new Error(`localGames.ts 里找不到 ${GAME_ID} —— 清单没生成？`)
  const seg = src.slice(at, at + 2000)
  const version = seg.match(/"version":\s*"([^"]+)"/)?.[1]
  /*
   * `tabLabel` 与 `playCost` 只在**包的 manifest** 里（清单不重复存）。
   * 这里只对两个具名字段做正则提取，**不执行**包里的任何代码。
   */
  const bundle = readFileSync(
    new URL(`../public/games/${GAME_ID}/${GAME_ID}.plugin.mjs`, import.meta.url),
    'utf8',
  )
  const tabLabel = bundle.match(/tabLabel:\s*"([^"]+)"/)?.[1]
  /*
   * ⚠️ **不要在产物里找 `playCost: 20`**：压缩后它变成了 `playCost: Uq`
   *   （`PLAY_COST` 被改名了）。实测这一条直接把脚本卡在 `playCost=NaN`。
   *   从**源码**读常量，产物只用来读字符串字面量（`tabLabel` 那种不会被改名的）。
   *   `expectedPayout: 5` 这种裸数字倒是没被改 —— 但那是运气，别依赖。
   */
  const srcProject = readFileSync(
    new URL(`../../task-games/${GAME_ID}/plugin.js`, import.meta.url),
    'utf8',
  )
  const playCost = Number(srcProject.match(/const PLAY_COST\s*=\s*(\d+)/)?.[1])
  if (!version || !tabLabel || !playCost) {
    throw new Error(`清单字段没读全：version=${version} tab=${tabLabel} playCost=${playCost}`)
  }
  return { version, tabLabel, playCost }
})()
const GAME_VERSION = MF.version
const TAB_LABEL = MF.tabLabel
const PLAY_COST = MF.playCost

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('✗ 找不到 Chrome / Edge —— 设 CHROME_PATH')
  process.exit(2)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

console.log(`\nropeland 真机接入（${VIEWPORT} ${size.width}×${size.height}）`)
console.log(`目标：${TARGET}`)
console.log(`清单：v${GAME_VERSION} · tab=${TAB_LABEL} · 一局 ${PLAY_COST} 积分\n`)

const puppeteer = (await import(
  'file:///E:/plan/test25/kid-quest-farm-2d/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
)).default

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: makeProfileDir(`e2e-ropeland-${VIEWPORT}`),
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    // headless 里 WebGL 起不来的症状是「停在加载页 + 0 报错」。
    // `--use-gl=swiftshader` 已被移除，这三件套是现在的正确写法。
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text())
})
const bad = []
page.on('response', (r) => {
  if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`)
})

await page.setViewport({ ...size, deviceScaleFactor: 1 })
await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 30000 })
await dismissOnboarding(page)
await page.waitForFunction(() => !!window.__kqf__?.plugin, { timeout: 15000 })
await wait(300)

const clickSel = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)
    if (!(el instanceof HTMLElement)) return false
    el.click()
    return true
  }, sel)

const clickText = (label) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.innerText ?? '').includes(t))
    if (!b) return false
    b.click()
    return true
  }, label)

const waitFor = (sel, timeout = 15000) =>
  page.waitForFunction((s) => !!document.querySelector(s), { timeout }, sel).then(
    () => true,
    () => false,
  )

const snap = () =>
  page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      balance: s.balance,
      vouchers: s.harvestBalance,
      active: s.activeGameId,
      installed: Object.keys(window.__kqf__.plugin.installed()),
    }
  })

const kvOwners = () => page.evaluate(() => window.__kqf__.plugin.kvOwnerIds())

/**
 * 容器里的颜色种类数。
 *
 * ⚠️ 三条都踩过：
 *   1. `preserveDrawingBuffer: false`（Pixi 默认）⇒ `toDataURL` / `readPixels` **恒为黑**，
 *      而 `getError()` 是 0。只能靠 compositor 截图（`page.screenshot`）。
 *   2. 必须 `clip` 到容器：整页里宿主顶栏底栏一堆颜色 ⇒ 判据恒真。
 *   3. 手写 PNG 解码（zlib + 反滤波），不引新依赖。
 */
const colorsInHost = async () => {
  const box = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x, y: r.y, width: r.width, height: r.height }
  }, GAME_ID)
  if (!box || box.width < 2 || box.height < 2) return { colors: 0, err: 'no host box' }
  const b64 = await page.screenshot({
    encoding: 'base64',
    clip: box,
    captureBeyondViewport: false,
  })
  return decodePngColors(Buffer.from(b64, 'base64'))
}

function decodePngColors(buf) {
  // 只处理 screenshot 出来的那种：8-bit RGB/RGBA、非隔行
  let p = 8
  let w = 0
  let h = 0
  let colorType = 6
  const idat = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const type = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    p += 12 + len
  }
  const bpp = colorType === 6 ? 4 : 3
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * bpp
  const px = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0
      const b = y > 0 ? px[(y - 1) * stride + x] : 0
      const c = x >= bpp && y > 0 ? px[(y - 1) * stride + x - bpp] : 0
      let v = line[x]
      if (filter === 1) v = (v + a) & 255
      else if (filter === 2) v = (v + b) & 255
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const pp = a + b - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - b)
        const pc = Math.abs(pp - c)
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      }
      px[y * stride + x] = v
    }
  }
  const set = new Set()
  const stepY = Math.max(1, Math.floor(h / 130))
  const stepX = Math.max(1, Math.floor(w / 60))
  for (let y = 0; y < h; y += stepY) {
    for (let x = 0; x < w; x += stepX) {
      const i = y * stride + x * bpp
      set.add(((px[i] >> 3) << 10) | ((px[i + 1] >> 3) << 5) | (px[i + 2] >> 3))
    }
  }
  return { colors: set.size, w, h }
}

/* ============================================================
   ⓪ 基线
   ============================================================ */
console.log('【⓪ 基线】')
{
  const s = await snap()
  check('动手前一款插件游戏都没装', s.installed.length === 0, s.installed.join(',') || '(空)')
  check('动手前当前游戏是农场', s.active === 'farm', s.active)
  check(`动手前 gameKv 里没有 ${GAME_ID}`, !(await kvOwners()).includes(GAME_ID))
}

/* ============================================================
   ① 安装
   ============================================================ */
console.log('\n【① 安装】')
{
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('设置'),
    )
    if (!b) return false
    b.click()
    return true
  })
  check('打开设置页', opened)
  await wait(700)
  check('切到「游戏」那一栏', await clickText('游戏'))
  await wait(600)
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
      b?.click()
    })
    await wait(160)
  }
  await wait(600)
  check('列表里列出了 ropeland', await waitFor(`[data-local-row="${GAME_ID}"]`, 8000))

  const clicked = await clickSel(`[data-local-install="${GAME_ID}"]`)
  check('点了「安装」', clicked)
  check('★ 界面上那一行变成「已装」', await waitFor(`[data-local-installed="${GAME_ID}"]`, 25000))

  const ver = await page.evaluate((id) => window.__kqf__.plugin.installed()[id]?.version, GAME_ID)
  check(`装上的版本是 v${GAME_VERSION}`, ver === GAME_VERSION, `实际 ${ver}`)

  const econ = await page.evaluate(() => {
    const el = document.querySelector('[data-plugin-economy]')
    return el ? (el.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  })
  // 经济说明必须写**这款游戏自己的**数，不能拿别人的模板顶上
  check(
    `家长能看到「一局 ${PLAY_COST} 积分」`,
    new RegExp(`一局\\s*${PLAY_COST}\\s*积分`).test(econ),
    econ,
  )
  check('没写「开放兑换券」（ropeland 不产券）', !/=\s*1\s*兑换券/.test(econ), econ)

  check('点了「设为当前」', await clickSel(`[data-plugin-set-current="${GAME_ID}"]`))
  await wait(800)
  const s = await snap()
  check(`当前游戏切成了 ${GAME_ID}`, s.active === GAME_ID, s.active)
}

// 回主界面
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    (x.getAttribute('aria-label') ?? '').includes('返回'),
  )
  if (b) b.click()
})
await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
await wait(400)
{
  const tab = await page.evaluate((id) => {
    const b = document.querySelector(`[data-tour="tab-${id}"]`)
    return b ? (b.innerText ?? '').replace(/\s+/g, ' ').trim() : ''
  }, GAME_ID)
  check(`底部导航多出「${TAB_LABEL}」那一格`, tab.includes(TAB_LABEL), tab || '(没有这一格)')
}

/* ============================================================
   ② 进游戏 —— 容器里真的画出来了
   ============================================================ */
console.log('\n【② 进游戏】')
let pointsBefore = 0
{
  pointsBefore = (await snap()).balance
  check('点了底栏那一格', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  check('宿主给插件开出了容器', await waitFor(`[data-plugin-host="${GAME_ID}"]`, 15000))
  // 插件自己挂的 ready 钩子（`game.js` 的 TEST_HOOKS）
  const up = await page
    .waitForFunction(() => window.__game?.screen === 'title', { timeout: 30000 })
    .then(() => true, () => false)
  check('★ 插件在真宿主里起来了（`__game.screen === title`）', up)

  const cv = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    return el ? el.querySelectorAll('canvas').length : -1
  }, GAME_ID)
  check('容器里有且只有一个 WebGL canvas', cv === 1, `canvas=${cv}`)

  const c = await colorsInHost()
  check('★ 画面真的有像素（不是空白 / 不是加载页）', c.colors >= 20, `颜色种类 ${c.colors}`)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-1-title.png`) })
}

/* ============================================================
   ③ 第一局 = 教学局，**按设计不收费**
   ============================================================ */
console.log('\n【③ 教学局（免费，按设计）】')
let tutorialDone = false
{
  check('点了「开始跳绳」', await clickSel('[data-act=start]'))
  const playing = await page
    .waitForFunction(() => window.__game?.screen === 'play', { timeout: 20000 })
    .then(() => true, () => false)
  check('进了对局画面', playing)

  // ★ 等游戏内计时器只能**轮询状态**：headless 只有 4~6 fps，
  //   游戏时钟比墙上时钟慢约 7 倍，`sleep` 固定值一定错。
  const tut = await page.evaluate(() => window.__game.sim(120, { recruit: () => true }))
  console.log(`  教学模拟 → ${JSON.stringify(tut).slice(0, 160)}`)
  check('教学局能跑到结束（没卡在某一步）', !tut.stalled && !tut.thrown, JSON.stringify(tut.stalled ?? tut.thrown ?? ''))

  await page.evaluate(() => {
    window.__game.P.tutorialDone = true
    window.__game.endRun()
  })
  await page.waitForFunction(() => window.__game?.screen === 'results', { timeout: 15000 })
  tutorialDone = true

  const afterTut = (await snap()).balance
  check(`★ 教学局没扣积分（${pointsBefore} → ${afterTut}）`, afterTut === pointsBefore, `${pointsBefore} → ${afterTut}`)
}

/* ============================================================
   ④ 正式局：扣一次，只扣一次
   ============================================================ */
console.log('\n【④ 正式局（收费）】')
{
  await clickSel('[data-act=menu]')
  await page.waitForFunction(() => window.__game?.screen === 'title', { timeout: 15000 })

  const before = (await snap()).balance
  check('回到标题，点了「开始跳绳」', await clickSel('[data-act=start]'))
  await page.waitForFunction(() => window.__game?.screen === 'play', { timeout: 20000 })

  const paid = await page
    .waitForFunction((want) => window.__kqf__.getState().balance === want, { timeout: 8000 }, before - PLAY_COST)
    .then(() => true, () => false)
  const after = (await snap()).balance
  check(`★ 扣了 ${PLAY_COST} 积分（${before} → ${after}）`, paid && after === before - PLAY_COST, `${before} → ${after}`)

  await wait(600)
  const after2 = (await snap()).balance
  check('★ 只扣一次（等 600ms 没有再扣）', after2 === after, `${after} → ${after2}`)

  // 玩一段再结算，确认「玩得下去」且画面有内容
  const run = await page.evaluate(() => window.__game.sim(60, { recruit: () => true, tutorial: 'keep' }))
  console.log(`  正式局模拟 → ${JSON.stringify(run).slice(0, 180)}`)
  check('正式局跑得动（跳跃数在涨）', (run?.jumps ?? 0) > 5, `jumps=${run?.jumps}`)

  const c = await colorsInHost()
  check('★ 对局画面有像素（不是黑屏）', c.colors >= 20, `颜色种类 ${c.colors}`)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-2-play.png`) })
}

/* ============================================================
   ⑤ 拿到游戏币（走真账本）
   ============================================================ */
console.log('\n【⑤ 游戏币真的进账】')
{
  const before = await page.evaluate((id) => window.__kqf__.plugin.gameCoins(id), GAME_ID)
  await page.evaluate(() => window.__game.endRun())
  await page.waitForFunction(() => window.__game?.screen === 'results', { timeout: 15000 })
  await wait(800)
  const after = await page.evaluate((id) => window.__kqf__.plugin.gameCoins(id), GAME_ID)
  console.log(`  币余额 ${before} → ${after}`)
  check('★ 结算后游戏币增加了（真账本，不是假宿主）', after > before, `${before} → ${after}`)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-3-results.png`) })
}

/* ============================================================
   ⑥/⑦ 切走 → 卸载干净；切回 → 存档读回来
   ============================================================ */
console.log('\n【⑥ 切走 / 切回】')
{
  // 先往存档里写一个「点一下就能改」的值，**显式落盘**，切回来再读。
  // ⚠️ 这里不能写 `save?.()`：可选链会把「方法不存在」静默吞掉，
  //   于是「没落盘」和「没调用」给出同一个症状（读回 0）。
  await page.evaluate(() => {
    window.__game.P.wool = 4242
    if (typeof window.__game.save !== 'function') throw new Error('钩子上没有 save()')
    window.__game.save()
  })

  const other = await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find(
      (x) => !(x.getAttribute('data-tour') ?? '').includes('ropeland'),
    )
    if (!b) return false
    b.click()
    return true
  })
  check('切到别的栏目', other)

  const gone = await page
    .waitForFunction(() => window.__game === undefined, { timeout: 15000 })
    .then(() => true, () => false)
  check('★ 切走后 `window.__game` 消失了（destroy 真跑了）', gone)

  const cv = await page.evaluate((id) => {
    const el = document.querySelector(`[data-plugin-host="${id}"]`)
    return el ? el.querySelectorAll('canvas').length : 0
  }, GAME_ID)
  check('★ 切走后容器里没有 canvas 了（没在后台空跑）', cv === 0, `canvas=${cv}`)

  // 切回来
  check('切回 ropeland', await clickSel(`[data-tour="tab-${GAME_ID}"]`))
  const back = await page
    .waitForFunction(() => window.__game?.screen, { timeout: 30000 })
    .then(() => true, () => false)
  check('第二次挂载成功（不是「黑屏 + 0 报错」）', back)

  const wool = await page.evaluate(() => window.__game?.P?.wool ?? null)
  check('★ 重挂载读回羊毛 4242（存档真的落盘了）', wool === 4242, `读回 ${wool}`)

  const c = await colorsInHost()
  check('★ 切回来画面又有像素了（WebGL 上下文没耗尽）', c.colors >= 20, `颜色种类 ${c.colors}`)
}

/* ============================================================
   ⑧ 卸载 → gameKv 清空
   ============================================================ */
console.log('\n【⑧ 卸载】')
{
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('设置'),
    )
    if (!b) return false
    b.click()
    return true
  })
  check('打开设置', opened)
  await wait(700)
  await clickText('游戏')
  await wait(600)
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
      b?.click()
    })
    await wait(160)
  }
  await wait(600)

  // ★ 卸载按钮**不在列表行上**：装好之后那一行显示的是「当前」，卸载收在详情弹层里
  //   （列表底部的说明原话：「卸载在『详情』里 —— 会把存档一起删掉」）。
  //   这一点是看截图才发现的：只按锚点找会报「找不到按钮」，而功能完全正常。
  const openDetail = await clickSel(`[data-store-detail="${GAME_ID}"]`)
  check('点开 ropeland 的详情', openDetail)
  await waitFor('[role="dialog"][aria-label="游戏详情"]', 6000)
  await wait(400)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-4-detail.png`) })

  const un = await page.evaluate((id) => {
    const b = document.querySelector(`[data-plugin-uninstall="${id}"]`)
    if (!(b instanceof HTMLElement)) return { ok: false, why: '详情里找不到卸载按钮' }
    b.scrollIntoView({ block: 'center' })
    b.click()
    return { ok: true }
  }, GAME_ID)
  check('点了「卸载这个游戏」', un.ok, un.why ?? '')
  await wait(600)
  await page.screenshot({ path: join(OUT, `${VIEWPORT}-5-confirm.png`) })

  const conf = await page.evaluate((id) => {
    const b = document.querySelector(`[data-plugin-uninstall-confirm="${id}"]`)
    if (!(b instanceof HTMLElement)) return { ok: false, why: '没弹确认' }
    b.click()
    return { ok: true }
  }, GAME_ID)
  check('点了确认弹层里的「卸载」', conf.ok, conf.why ?? '')
  await wait(2000)

  const s = await snap()
  check('已安装清单里没有 ropeland 了', !s.installed.includes(GAME_ID), s.installed.join(',') || '(空)')
  check('★ gameKv 里一行 ropeland 的都不剩', !(await kvOwners()).includes(GAME_ID), (await kvOwners()).join(',') || '(空)')
}

/* ============================================================
   收尾
   ============================================================ */
{
  // favicon 的 404 不算问题（浏览器自己会去要）
  const realBad = bad.filter((b) => !b.includes('/favicon'))
  console.log('')
  check('4xx/5xx 为 0', realBad.length === 0, realBad.slice(0, 3).join(' | '))
  check('pageerror 为 0', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '))
  check('console.error 为 0', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  console.log(`\n  截图 → ${relative(process.cwd(), OUT) || OUT}`)
}

await browser.close()
console.log(failed ? `\n✗ ${failed} 条不通过\n` : '\n✓ 全通过\n')
process.exit(failed ? 1 : 0)
