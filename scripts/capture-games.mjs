/**
 * 家长栏「游戏」区块走查图 + 结构自检。
 *
 * 用法：node scripts/capture-games.mjs [url] [outDir]
 *
 * 为什么单独一份：`capture.mjs` / `e2e-check.mjs` 都不进设置页的「游戏」页，
 * 这块新加的东西没有任何脚本看得见 —— 正是本项目最怕的盲区。
 *
 * 三个坑（都真踩过，见 shot-farm2d.mjs）：
 *   1. 入场页会自己切到主界面（~1.9s），不等它会撞上那次导航。
 *   2. `makeProfileDir()` 每次建**新**目录 —— 两个视口共用一个 browser 就共用
 *      一个库，第二遍的状态是脏的。所以**每个视口各起一个 browser**。
 *   3. 走查脚本**不许只打印**，要硬断言 + 非零退出码（本项目踩过「全绿却漏了
 *      最坏情况」那次）。下面 `check()` 失败会累积到 `failed`。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { grantGame } from './lib/own.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

/* ⚠️ 变量名**别叫 `URL`** —— 那会遮住全局的 `URL` 构造器（本项目踩过）。 */
const TARGET = process.argv[2] ?? 'http://127.0.0.1:4396/'
const OUT = process.argv[3] ?? '.e2e-scratch/games'

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

for (const vp of VIEWPORTS) {
  console.log(`\n── ${vp.name} ${vp.width}×${vp.height} ──`)
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    userDataDir: makeProfileDir(`shot-games-${vp.name}`),
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

  /* ---- ① 底部导航的游戏那一格 = 当前游戏（这是家长这次要的核心） ---- */
  const navGame = await page.evaluate(() => {
    const b = document.querySelector('[data-tour="tab-farm"]')
    return b ? { text: (b.textContent ?? '').trim(), tour: b.getAttribute('data-tour') } : null
  })
  check(
    '底部导航的游戏格显示「当前游戏」，且锚点仍是 tab-farm',
    !!navGame && navGame.text.includes('农场') && navGame.text.includes('🌾'),
    navGame ? `text="${navGame.text}" tour=${navGame.tour}` : '没找到 [data-tour="tab-farm"]',
  )
  await page.screenshot({ path: `${OUT}/${vp.name}-1-底部导航.png` })

  /* ---- ② 进设置 → 游戏页 ---- */
  await page.evaluate(() => document.querySelector('button[aria-label="设置"]')?.click())
  await page.waitForFunction(
    () => [...document.querySelectorAll('h1')].some((h) => h.textContent?.includes('设置')),
    { timeout: 8000 },
  )
  const tabClicked = await clickExact(page, '🎮 游戏')
  check('设置页有「🎮 游戏」这一栏', tabClicked)
  await wait(400)

  /* ---- ②b 加了第 4 栏之后，栏目条在手机上还放得下吗？----
     原来只有 3 栏（孩子/规则/数据），390px 上正好；加一栏就可能溢出，
     而 `overflow-x-auto` 溢出**不报错**，只是把最后一栏裁掉一半 ——
     家长会以为「数据」那一栏坏了。量出来，别靠看。 */
  const navFit = await page.evaluate(() => {
    const row = document.querySelector('nav > div')
    if (!row) return null
    return {
      scrollW: row.scrollWidth,
      clientW: row.clientWidth,
      tabs: [...row.querySelectorAll('button')].map((b) => ({
        t: (b.textContent ?? '').trim(),
        w: Math.round(b.getBoundingClientRect().width),
      })),
    }
  })
  check(
    '设置页的栏目条不溢出（最后一栏没被裁掉）',
    !!navFit && navFit.scrollW <= navFit.clientW + 2,
    navFit
      ? `scrollW=${navFit.scrollW} clientW=${navFit.clientW} 各栏宽=${navFit.tabs
          .map((x) => `${x.t}:${x.w}`)
          .join(' ')}`
      : '没找到栏目条',
  )

  /* ---- ③ 过家长密码（默认 0000，第 4 位自动提交） ----
     ⚠️ 闸门改成了「卡片 + 按钮」：先进到一张「游戏设置要家长密码」的卡，
     点「爸妈：输密码」才弹出数字键盘（`ParentPinSheet`）。
     这里原来直接点 4 次 0 —— 键盘根本没打开，页面停在那张卡上，
     后面全红成「内置 0 行 / 没有『每天玩多久』」，看着像整块界面坏了，
     真因却是「没点那颗按钮」。 */
  const gateCard = await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll('button')].some((b) =>
          /爸妈：输密码/.test(b.textContent ?? ''),
        ),
      { timeout: 6000 },
    )
    .then(() => true, () => false)
  check('游戏页先要家长密码（卡片上那颗按钮）', gateCard)
  if (gateCard) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        /爸妈：输密码/.test(x.textContent ?? ''),
      )
      b?.click()
    })
    await page
      .waitForFunction(() => document.body.innerText.includes('请输入家长密码'), { timeout: 5000 })
      .catch(() => {})
    for (let i = 0; i < 4; i++) {
      await clickExact(page, '0')
      await wait(180)
    }
  }
  const unlocked = await page
    .waitForFunction(() => document.querySelector('[data-market-builtin]') !== null, {
      timeout: 6000,
    })
    .then(() => true, () => false)
  check('输 0000 后进入游戏栏', unlocked)
  await wait(400)

  /* ---- ④ 内容自检 ----
     ★ 期望条数**从注册表现状推导**，不写死（见下面几处的注释）。
     2026-10-16 娃娃机上线之前，这里写死的是「占位 2 条」「一个购买按钮都没有」
     —— 上线当天三条断言一起红，红的原因是**例子过期**，不是功能坏了。 */
  const info = await page.evaluate(() => {
    const txt = document.body.innerText
    const rows = [...document.querySelectorAll('li')].map((li) => (li.innerText ?? '').trim())
    const buttons = [...document.querySelectorAll('button')].map((b) =>
      (b.textContent ?? '').trim(),
    )
    return {
      txt,
      rows,
      buttons,
      /*
        2026-10-25 起**没有**「已购买 / 已下载 / 敬请期待」三张卡了 ——
        所有游戏（内置 + 插件）排在同一张表里，状态写在每一行上。
        所以这里直接量那张表里各来源有几行，不再找那三个标题。
      */
      builtinRows: [...document.querySelectorAll('[data-market-builtin]')].map((li) =>
        (li.innerText ?? '').trim(),
      ),
      pluginRows: [...document.querySelectorAll('[data-local-row]')].map((li) =>
        (li.innerText ?? '').trim(),
      ),
      activeGameId: window.__kqf__?.getState?.().activeGameId ?? '',
      games: window.__kqf__?.games?.() ?? [],
      /*
        2026-10-28 改版后的三个事实：
          · 不再叫「游戏市场」，叫「我的游戏」（家长：这些都是已经购买的游戏）
          · 钻石卡（含手动发放）和在线商店卡都删了
          · 新增「每天玩多久」，档位按钮带 `data-game-limit`
      */
      limitButtons: [...document.querySelectorAll('[data-game-limit]')].map((b) =>
        (b.textContent ?? '').trim(),
      ),
      playedLine: document.querySelector('[data-game-played]')?.textContent?.trim() ?? '',
      hasMint: document.querySelector('[data-mall-mint]') !== null,
      buyButtons: document.querySelectorAll('[data-buy-game]').length,
    }
  })

  check(
    '★ 这张表叫「我的游戏」，不再叫「游戏市场」',
    info.txt.includes('我的游戏') && !info.txt.includes('游戏市场'),
    info.txt.includes('游戏市场') ? '页面上还有「游戏市场」' : '',
  )

  /* ★ 这一条钉的就是家长的第二次要求：「感觉没必要 单独 已购买，已下载，
     敬请期待，直接 在 游戏市场。每个游戏 不同状态呗。」
     ⇒ 一张表、两种来源都在里面，那三张卡一个都不许回来。 */
  const expectedPlugins = JSON.parse(
    readFileSync('public/games/index.json', 'utf8'),
  ).games ?? []
  /*
    ⚠️ 2026-11-07 起「未拥有的游戏不显示」⇒ 插件行数**不再等于注册表条数**。
    默认状态一款都没拥有 ⇒ 0 行。这条断言就是新口径本身：列表里出现未拥有的
    游戏，说明过滤被谁拆了（或者 `ownedSetFor` 的口径变了）。
    「0 行」不是「这一栏坏了」—— 内置那几行还在，下面 `builtinRows` 会说话。
  */
  check(
    '★ 内置游戏在表里，未拥有的插件一行都不出现',
    info.builtinRows.length === info.games.length && info.pluginRows.length === 0,
    `内置 ${info.builtinRows.length}/${info.games.length} 行，` +
      `插件 ${info.pluginRows.length} 行（注册表 ${expectedPlugins.length} 款）`,
  )
  check(
    '★ 那三张单独的卡没有回来',
    !info.txt.includes('已购买') && !info.txt.includes('已下载'),
    ['已购买', '已下载'].filter((w) => info.txt.includes(w)).join(' / ') || '（都没有）',
  )

  /* 农场那一行的状态必须和 store 一致 —— 当前是它就得写「当前」，
     不是它就得写「设为当前」。两边都从同一个事实派生，对不上就是有一处写死了。 */
  const farmRow = info.builtinRows.find((r) => r.includes('农场')) ?? ''
  check(
    '农场那一行的状态和 activeGameId 一致',
    farmRow !== '' &&
      (info.activeGameId === 'farm' ? farmRow.includes('当前') : farmRow.includes('设为当前')),
    `activeGameId=${info.activeGameId || '(空)'} 行=${farmRow.replace(/\n/g, ' / ') || '（没有农场的行）'}`,
  )

  /* ---------- 2026-10-28：这一页从「商店」变成「清单」 ----------
     家长：「游戏市场换个名字，这些都是已经购买的游戏。在这里只是控制，
            下载，安装，卸载，选择当前。」
     ⇒ 价格、购买按钮、「敬请期待」全都不该出现。
     判据落在**属性**上（`[data-buy-game]`），不靠 emoji 拼正则 ——
     钻石图标改过一次，那种写法会静默地一个都匹配不到（见旧注释）。 */
  check('★ 没有任何购买按钮', info.buyButtons === 0, `实际 ${info.buyButtons} 个`)
  check('★ 没有「敬请期待」', !info.txt.includes('敬请期待'))
  check(
    '★ 钻石卡（含手动发放）没了',
    !info.txt.includes('钻石') && !info.hasMint,
    info.hasMint ? '还找得到 [data-mall-mint]' : '',
  )
  check('★ 在线商店卡没了', !info.txt.includes('在线商店'))

  /* 沉迷设定：每天玩多久 */
  check(
    '★ 有「每天玩多久」六个档位',
    info.limitButtons.length === 6,
    info.limitButtons.join(' / ') || '一个 [data-game-limit] 都没找到',
  )
  check('★ 有今日用量那一行', /今天/.test(info.playedLine), info.playedLine)

  await page.screenshot({ path: `${OUT}/${vp.name}-2-家长栏游戏.png`, fullPage: true })
  console.log(`  · 已存图 ${OUT}/${vp.name}-2-家长栏游戏.png`)

  /* ---- ④b 「拥有之后才出现」的**正例** ----
     只判「没拥有不显示」不够：把过滤写成「一律不显示」也会绿。
     所以预置一款拥有，判它单独出现、而且只有它。
     ★ 放在截图**之后** —— 上面那张图要拍的是家长打开这一页的默认样子。 */
  const grantedId = expectedPlugins[0]?.id ?? ''
  check('注册表里至少有 1 款可下载的游戏', !!grantedId)
  if (grantedId) {
    await grantGame(page, grantedId)
    const afterGrant = await page
      .waitForFunction(
        (id) =>
          document.querySelectorAll('[data-local-row]').length === 1 &&
          !!document.querySelector(`[data-local-row="${id}"]`),
        { timeout: 8000 },
        grantedId,
      )
      .then(() => true, () => false)
    const visible = await page.evaluate(() =>
      [...document.querySelectorAll('[data-local-row]')]
        .map((x) => x.getAttribute('data-local-row'))
        .join(','),
    )
    check(
      '★ 拥有之后只出现那一行（正例，否则「全藏起来」也会绿）',
      afterGrant,
      `拥有 ${grantedId}，表里现在是 [${visible}]`,
    )
    await page.evaluate(() => {
      document.querySelector('[data-local-row]')?.scrollIntoView({ block: 'center' })
    })
    await wait(300)
    await page.screenshot({ path: `${OUT}/${vp.name}-2b-拥有之后.png`, fullPage: true })
    console.log(`  · 已存图 ${OUT}/${vp.name}-2b-拥有之后.png`)
  }

  /* ---- ⑤ 「练什么」只在详情里（2026-10-25 家长要求） ----
     ★ 两边都要判：行上**没有**、详情里**有**。
       只判一边的话，「两边都没有」也会绿 —— 那等于这一栏被删了。 */
  const rowsText = [...info.builtinRows, ...info.pluginRows].join('\n')
  check(
    '★ 「练什么」不在列表行里',
    !rowsText.includes('练什么'),
    rowsText.includes('练什么') ? '有一行还带着它' : '（列表里没有）',
  )

  const openedDetail = await page
    .evaluate(() => {
      const b = document.querySelector('[data-store-detail]')
      b?.click()
      return !!b
    })
    .then((ok) => ok)
  await page
    .waitForFunction(() => !!document.querySelector('[role="dialog"][aria-label="游戏详情"]'), {
      timeout: 5000,
    })
    .catch(() => {})
  const detail = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
    if (!d) return null
    const h = [...d.querySelectorAll('h4')].find((x) => x.textContent?.includes('练什么'))
    // 「练什么」那一节下面的 li 条数（找不到标题就记 -1，好和「0 条」分开）
    const lis = h ? (h.parentElement?.querySelectorAll('li').length ?? 0) : -1
    return {
      hasSection: !!h,
      lis,
      heads: [...d.querySelectorAll('h4')].map((x) => (x.textContent ?? '').trim()),
    }
  })
  check(
    '★ 详情里有「练什么」这一节',
    detail?.hasSection === true,
    detail ? `小标题 ${[...detail.heads].join(' / ')}` : '没打开详情',
  )
  check(
    '★ 详情里「练什么」至少 3 条（不是空标题）',
    (detail?.lis ?? 0) >= 3,
    `li=${detail?.lis}`,
  )
  await page.screenshot({ path: `${OUT}/${vp.name}-3-详情.png` })
  console.log(`  · 已存图 ${OUT}/${vp.name}-3-详情.png`)
  await page.evaluate(() => document.querySelector('[data-store-close]')?.click())
  await wait(300)

  check('控制台无错误', consoleErrors.length === 0, consoleErrors.slice(0, 2).join(' | '))

  await browser.close()
}

console.log(`\n${'─'.repeat(52)}`)
console.log(failed === 0 ? '全部通过 ✓' : `失败 ${failed} 项 ✗`)
process.exit(failed === 0 ? 0 : 1)
