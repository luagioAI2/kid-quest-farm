/**
 * P2 验收：**从已签名目录安装**这条链，在**真实浏览器**里跑一遍（spec §12.4）。
 *
 * 用法：
 *   node scripts/demo-catalog.mjs                      # ① 准备演示目录 + 构建 + 起服务
 *   CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4390 --strictPort
 *   node scripts/capture-catalog-install.mjs           # ② 验它
 *
 * ------------------------------------------------------------
 * 为什么必须有这个脚本
 *
 * 单测（`verify.test.ts` / `install.test.ts` / `installStore.test.ts`）跑在
 * jsdom + Node 的 WebCrypto 上 —— 它们能证明**逻辑**对，但证明不了
 * 「**真浏览器里** `crypto.subtle` 的 Ed25519 可用、跨域 fetch 能过、
 * blob 模块能 import、装完真的能玩」。那是两回事。
 *
 * ------------------------------------------------------------
 * 它证明的四件事
 *
 *   ① **正常的一份装得上** —— 而且装完**真的能挂起来**（不是只写进了库）。
 *   ② **服务器上的包被换过 ⇒ 拒绝** —— 目录签名是对的，但包的哈希对不上。
 *   ③ **目录是别人签的 ⇒ 拒绝** —— 内容一模一样，只是签名不是我们的。
 *   ④ ★★ **每一种失败都「一个字节都不落盘」** —— 这条最容易漏：
 *      只断言「返回了 ok:false」是不够的，半个包留在 `gameKv` 里，
 *      症状是「装了个空的」，而且下次刷新它还在。
 *
 * ⚠️ 后两套「坏目录」是 `demo-catalog.mjs` **故意准备**的。
 *    一个「只会成功」的演示证明不了任何事 —— 这是本项目的规矩。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const TARGET = process.argv[2] ?? 'http://127.0.0.1:4390/'
const CATALOG_BASE = process.argv[3] ?? 'http://127.0.0.1:4391'
const GAME_ID = 'demo'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]
const chrome = process.env.CHROME_PATH ?? CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('✗ 找不到 Chrome / Edge —— 设 CHROME_PATH 指过去')
  process.exit(2)
}

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? `   ${detail}` : ''}`)
  if (!ok) failed++
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir('shot-catalog-install'),
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
await page.waitForFunction(() => !!window.__kqf__?.plugin?.installFromCatalog, { timeout: 20000 })
await wait(300)

/** 装一款（返回 store 的 { ok, message }），并等一拍让 refresh 落地 */
const install = async (url) => {
  const r = await page.evaluate(
    (u, id) => window.__kqf__.plugin.installFromCatalog(u, id),
    url,
    GAME_ID,
  )
  await wait(250)
  return r
}
/** 现在的已安装清单 */
const installed = () => page.evaluate(() => Object.keys(window.__kqf__.plugin.installed()))
/** 卸载（连带清状态），把环境恢复到「什么都没装」 */
const uninstall = async (id) => {
  await page.evaluate((g) => window.__kqf__.plugin.uninstall(g), id)
  await wait(250)
}

console.log(`\n目标 App     : ${TARGET}`)
console.log(`目录服务     : ${CATALOG_BASE}\n`)

/* ── 反空转对照：动手之前先确认「现在什么都没装」 ────────────────────
   少了这一步，后面每一条「装上了」都可能是恒真的。 */
console.log('【基线】')
const before = await installed()
check('动手前一款都没装', before.length === 0, before.join(',') || '(空)')

/* ── ① 正常的一份 ──────────────────────────────────────────────── */
console.log('\n【① 正常目录 —— 应该装上】')
const good = await install(`${CATALOG_BASE}/catalog.json`)
if (good.ok !== true && /公钥/.test(good.message ?? '')) {
  console.error(
    `\n✗ App 的构建里没有公钥（${good.message}）\n` +
      '  ⇒ 先跑 `node scripts/demo-catalog.mjs`（它会临时写入演示公钥并重新构建），\n' +
      '    再用**那个构建**起 preview。注意：重新 `npm run build` 会把公钥清空（那是设计如此）。\n',
  )
  await browser.close()
  process.exit(2)
}
check('安装返回 ok', good.ok === true, good.message)
check('已安装清单里出现了它', (await installed()).includes(GAME_ID), (await installed()).join(','))

// ★ 装上了 ≠ 能玩。挂进一个真容器，确认它真的画出了东西。
//   （渲染**质量**的判据 —— 有没有被遮住 —— 归 `capture-game-bundle.mjs`；
//     这里只要证明「装下来的代码真的能挂、真的画出了 DOM」。）
const mounted = await page.evaluate(async (id) => {
  const host = document.createElement('div')
  host.id = '__probe_host__'
  host.style.cssText = 'position:fixed;left:0;top:0;width:360px;height:600px;z-index:99999'
  document.body.appendChild(host)
  try {
    const ok = await window.__kqf__.plugin.mountInto(id, '#__probe_host__')
    const rect = host.getBoundingClientRect()
    const painted = host.querySelectorAll('*').length
    const text = (host.textContent ?? '').trim().length
    window.__kqf__.plugin.unmountAll()
    return { ok, painted, text, w: Math.round(rect.width), h: Math.round(rect.height) }
  } finally {
    host.remove()
  }
}, GAME_ID)
check(
  '★ 装完真的能挂起来并画出东西',
  mounted.ok === true && mounted.painted > 0 && mounted.text > 0 && mounted.w > 0 && mounted.h > 0,
  JSON.stringify(mounted),
)

/* ── ② 服务器上的包被换过 ⇒ 必须拒绝 ───────────────────────────── */
console.log('\n【② 包被换过（目录签名对，但哈希对不上）—— 必须拒绝】')
await uninstall(GAME_ID)
check('先恢复成没装', (await installed()).length === 0)
const tampered = await install(`${CATALOG_BASE}/tampered/catalog.json`)
check('被拒绝', tampered.ok === false, tampered.message)
check('报的是哈希问题', /SHA-256/.test(tampered.message ?? ''), tampered.message)
check('★★ 一个字节都没落盘', (await installed()).length === 0, (await installed()).join(','))

/* ── ③ 目录是别人签的 ⇒ 必须拒绝 ───────────────────────────────── */
console.log('\n【③ 目录不是我们签的 —— 必须拒绝】')
const forged = await install(`${CATALOG_BASE}/forged/catalog.json`)
check('被拒绝', forged.ok === false, forged.message)
check('报的是签名问题', /签名/.test(forged.message ?? ''), forged.message)
check('★★ 一个字节都没落盘', (await installed()).length === 0, (await installed()).join(','))

/* ── ④ 卸载要真的清干净（不然重装会捡到上一次的存档） ───────────── */
console.log('\n【④ 卸载】')
await install(`${CATALOG_BASE}/catalog.json`)
check('重新装上', (await installed()).includes(GAME_ID))
await uninstall(GAME_ID)
check('卸载后清单里没有了', !(await installed()).includes(GAME_ID), (await installed()).join(','))

/* ── ⑤ 设置页那条路 —— 家长实际会点的地方（P2 UI，2026-10-18） ────── */
/*
  ★ 为什么这条不能省：①~④ 走的是 console 句柄 `__kqf__.plugin.installFromCatalog`，
    它证明**链子**对，但证明不了「家长点得到」。设置页那张卡片有自己的
    三种状态（没配地址 / 检查中 / 列表），任何一处接错都会变成
    「功能是好的，但界面上没有入口」—— 本项目最讨厌的那种「做了等于没做」。

  ⚠️ 这一节必须在 ④ 之后跑：④ 结束时是「什么都没装」，
    列表行才会显示「安装」而不是「已安装」。
*/
console.log('\n【⑤ 设置页「游戏商店」—— 家长真的点得到】')
{
  const clickText = (t) =>
    page.evaluate((label) => {
      // ⚠️ 用 `includes` 不是 `===`：设置页那四颗药丸的文案是「🎮 游戏」
      //    （带 emoji 前缀）。写 `===` 会静默点不到，而点不到和「没那一栏」
      //    在日志里长得一模一样。
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes(label))
      if (!b) return false
      b.click()
      return true
    }, t)

  // 顶栏齿轮 → 游戏
  const opened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find((x) =>
      (x.getAttribute('aria-label') ?? '').includes('设置'),
    )
    if (!b) return false
    b.click()
    return true
  })
  check('顶栏找得到「设置」入口', opened)
  await wait(900)

  check('设置页里有「游戏」那一栏', await clickText('游戏'))
  await wait(700)

  /*
    ⚠️ 顺序：**先切栏，再过密码**。设置页每次切栏都会重新上锁 ——
       反过来做（先输密码再点栏）会得到「密码过了、一点栏又变成密码卡」，
       看着像「游戏那一栏没了」，其实只是又锁上了。
    默认 PIN = 0000（第 4 位自动提交，不用点确定）。
  */
  const unlock = async () => {
    if (!(await page.evaluate(() => document.body.innerText.includes('请输入家长密码')))) return
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
        b?.click()
      })
      await wait(200)
    }
    await wait(800)
  }
  await unlock()
  check('家长密码过了（游戏栏解锁）', !(await page.evaluate(() => document.body.innerText.includes('请输入家长密码'))))

  const gateState = await page.evaluate(() => {
    const b = document.querySelector('[data-plugin-check]')
    return b ? { present: true, disabled: b.disabled } : { present: false, disabled: true }
  })
  if (!gateState.present) {
    /*
      ★ 两种原因会长得一模一样：「构建里没配地址」和「我们根本没切到游戏栏」。
        所以把当前页面的**标题清单**一起打出来 —— 有「游戏商店」标题却没按钮，
        才是真的没配；连标题都没有，就是没切过去。
    */
    const probe = await page.evaluate(() => ({
      headings: [...document.querySelectorAll('h2')].map((h) => h.textContent?.trim()).join(' | '),
      off: document.querySelector('[data-plugin-store="off"]')?.textContent ?? '',
    }))
    if (probe.headings.includes('游戏商店')) {
      console.error(
        `\n✗ 设置页里是「没配商店」那一支（${probe.off.trim()}）\n` +
          '  ⇒ 这个构建里 `CATALOG_URL` 是空的。先跑 `node scripts/demo-catalog.mjs`\n' +
          '    （它会临时写入演示公钥 + 本地目录地址再构建），然后用**那个 dist** 起 preview。\n',
      )
    } else {
      console.error(`\n✗ 没切到「游戏」栏，当前页面上的卡片是：${probe.headings || '(一个都没有)'}\n`)
    }
  }
  check('★ 设置页里出现了「游戏商店」的检查按钮（不是「没配商店」那一支）', gateState.present)

  if (gateState.present && gateState.disabled) {
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
        b?.click()
      })
      await wait(150)
    }
    await wait(600)
  }

  // 点「检查」→ 等列表
  await page.evaluate(() => document.querySelector('[data-plugin-check]')?.click())
  const rowOk = await page
    .waitForFunction(() => !!document.querySelector(`[data-plugin-row="${'demo'}"]`), { timeout: 15000 })
    .then(() => true, () => false)
  const errText = await page.evaluate(
    () => document.querySelector('[data-plugin-error]')?.textContent ?? '',
  )
  check('★ 点「检查」→ 列表里出现了那一款（界面真的走到了验签那一步）', rowOk, rowOk ? '' : errText)

  if (rowOk) {
    const rowText = await page.evaluate(
      () => document.querySelector('[data-plugin-row="demo"]')?.textContent ?? '',
    )
    check('行里显示的是**目录**里的名字和版本', /许愿池/.test(rowText) && /1\.0\.0/.test(rowText), rowText.trim())

    // 留一张图给人工看观感（文案 / 间距这些数字判不出来）
    const shotDir = '.e2e-scratch/catalog-install'
    mkdirSync(shotDir, { recursive: true })
    const card = await page.$('[data-plugin-row="demo"]')
    const box = await card?.evaluate((el) => {
      // 截「游戏商店」那一整张卡（行只是卡里的一条）
      const s = el.closest('section')
      const r = (s ?? el).getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    if (box && box.width > 0 && box.height > 0) {
      await page.screenshot({ path: `${shotDir}/settings-store.png`, clip: box })
      console.log(`  · 已存图 ${shotDir}/settings-store.png`)
    }

    // 点「安装」
    await page.evaluate(() => document.querySelector('[data-plugin-install="demo"]')?.click())
    const installedOk = await page
      .waitForFunction(() => Object.keys(window.__kqf__.plugin.installed()).includes('demo'), { timeout: 20000 })
      .then(() => true, () => false)
    check('★★ 点「安装」→ 真的装上了（不是只有 console 那条路能装）', installedOk, (await installed()).join(','))

    // 装完之后那一行要变成「已安装」，不能再摆一个「安装」按钮
    const afterRow = await page
      .waitForFunction(
        () => {
          const row = document.querySelector('[data-plugin-row="demo"]')
          return !!row && !document.querySelector('[data-plugin-install="demo"]') && /已安装/.test(row.textContent ?? '')
        },
        { timeout: 10000 },
      )
      .then(() => true, () => false)
    check('装完那一行变成「已安装」，安装按钮消失（不摆一个点不动的按钮）', afterRow)

    // 恢复现场
    await uninstall(GAME_ID)
    check('收尾：又清回「什么都没装」', (await installed()).length === 0, (await installed()).join(','))
  }

  // 回到底部导航（别把设置页留在那儿给后面的脚本/截图）
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '返回')
    b?.click()
  })
  await wait(500)
}

/* ── 收尾 ─────────────────────────────────────────────────────── */
console.log('\n【控制台】')
// 三次失败都是**被我们主动拒掉**的，不该在控制台留 error。
// 留了就说明某条失败路径是「崩了」而不是「拦住了」。
check('控制台零报错', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))

await browser.close()
console.log(failed === 0 ? '\n══ 全部通过 ══\n' : `\n══ 有 ${failed} 条失败 ══\n`)
process.exit(failed === 0 ? 0 : 1)
