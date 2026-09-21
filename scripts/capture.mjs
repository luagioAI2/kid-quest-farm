/**
 * 界面走查截图
 * ------------------------------------------------------------
 * 用真 Chrome 按手机尺寸把主要页面各截一张，方便肉眼过一遍改版效果。
 * 和 e2e-check.mjs 分工不同：
 *   - e2e-check.mjs 是**断言**脚本（对错），跑完会把 screenshots/*.png 覆盖掉；
 *   - 本脚本只**出图**（好看不好看），输出到 screenshots/redesign/，不会互相覆盖。
 *
 * ⚠️ 新增界面必须加进这个脚本，否则走查图里根本看不到它。
 * 2026-09-15 教训：这一批加了「收获二选一 / 种子商店回收上限 / 家长设每轮上限」，
 * 但本脚本只拍原来那 8 张老页面 —— 8 张里有 6 张跟改版前**逐字节相同**，
 * 打开 `screenshots/redesign/` 完全看不出改过什么。走查图集看不见的改动 ≈ 没验过。
 * 后续同一条：长期任务的「记一次完成」弹层（04b-period-submit）也是因为这个
 * 才补进来的 —— 它改的就是那张表。
 *
 * 用法：node scripts/capture.mjs [url] [输出目录]
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const OUT = process.argv[3] ?? 'screenshots/redesign'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge，无法截图')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  // profile 必须落在项目同盘 —— 系统盘满会让 Chrome 的 IndexedDB 直接罢工，
  // 症状是随机挂在任意一条用例上。见 scripts/lib/profile.mjs 顶部。
  userDataDir: makeProfileDir('capture'),
})

try {
  const page = await browser.newPage()
  await page.setViewport({
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })

  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  /** 按文字点一个按钮（DOM click，不走坐标 —— 坐标会被 sticky 底栏截胡） */
  const clickByText = (text, scope = 'body') =>
    page.evaluate(
      (t, s) => {
        const root = document.querySelector(s) ?? document
        const b = Array.from(root.querySelectorAll('button')).find((x) =>
          (x.textContent ?? '').includes(t),
        )
        if (!b) return false
        b.scrollIntoView({ block: 'center' })
        b.click()
        return true
      },
      text,
      scope,
    )

  const shot = async (name) => {
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log(`  ${name}`)
  }

  /* ---- 农场相关的小工具（收获二选一 / 种子商店要用） ---- */

  /** 点第 i 块地。按 grid 里的顺序取，别用坐标 —— 坐标会被 sticky 底栏截胡。 */
  const tapPlot = (i) =>
    page.evaluate((idx) => {
      const grid = document.querySelector('div.grid.grid-cols-3')
      const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
      if (!tiles[idx]) return false
      tiles[idx].click()
      return true
    }, i)

  const plotText = (i) =>
    page.evaluate((idx) => {
      const grid = document.querySelector('div.grid.grid-cols-3')
      const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
      return tiles[idx] ? tiles[idx].innerText.replace(/\s+/g, ' ').trim() : ''
    }, i)

  /**
   * 等作物成熟。
   * ⚠️ 别用固定 sleep：`useFarmTick` 是 1s 一跳，睡早了地块上还写着「还要 N 分钟」，
   * 这一下点击就被当成浇水，弹层根本不会出来（e2e-gameplay 已经踩过一次）。
   */
  const waitMaturePlot = async (i, timeoutMs = 8000) => {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      if (/可以收啦/.test(await plotText(i))) return true
      await wait(250)
    }
    return false
  }

  const closeSheet = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '关闭',
      )
      b?.click()
    })
    await wait(500)
  }

  /** 种一块地并等它成熟，返回地块下标 */
  const plantMature = async () => {
    const i = await page.evaluate(async () => {
      const st = () => window.__kqf__.getState()
      const empty = st().plots.find((p) => p.unlocked && !p.crop)
      await st().plant(empty.index, 'carrot')
      return empty.index
    })
    await waitMaturePlot(i)
    return i
  }

  /* 0. 空跑一次：**入场页那 1.5s 日出动画是从页面挂载开始跑的**，
     而「第一次导航 + 第一次截图」本身要 1 秒多（捕获通道初始化 + 冷编译
     570KB bundle）。先跑一趟把这笔开销花掉，下面按时间点抓的入场图才准。

     ⚠️ 只预热截图**不够**：试过，`wait(250)` 之后读到的暗罩 opacity 是
     0.019（天已经亮完了）。预热确实让截图变快了，但那 1 秒是从动画里扣走的。 */
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.screenshot({ type: 'png' })

  /* 1. 入场页：趁它还在（最短 1.9s），早点抓。

     拍**两张**：日出前那张（t≈250ms）才看得到「压暗 + 太阳还在山后面」，
     到 700ms 天已经亮了大半 —— 只拍一张的话，这次日出改动在图集里
     根本看不出来（图集看不出改了什么 = 没走查过）。 */
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await wait(250)
  // 拍之前先确认「此刻天确实还没亮」—— 不然拍晚了也不知道，图照样存下来。
  const dawnOpacity = await page.evaluate(() => {
    const veil = document.querySelector('.anim-dawn-lift')
    return veil ? Number(getComputedStyle(veil).opacity) : -1
  })
  console.log(
    `  日出前暗罩 opacity=${dawnOpacity.toFixed(3)}` +
      (dawnOpacity > 0.5 ? '  ✓ 天还暗着' : '  ← ⚠️ 这张拍晚了，拍到的是天亮之后'),
  )
  await shot('01a-splash-dawn')

  // 第二张**等日出真的结束**再拍（暗罩淡到几乎透明）。
  // 用轮询而不是猜时间 —— 这样「拍到的是不是最终样子」本身就是可验证的，
  // 而不是"我算着 700ms 应该差不多了"。日出 1.5s 结束，入场页最短 1.9s，来得及。
  await page
    .waitForFunction(
      () => {
        const v = document.querySelector('.anim-dawn-lift')
        return !v || Number(getComputedStyle(v).opacity) < 0.02
      },
      { timeout: 5000 },
    )
    .catch(() => {})
  const noonOpacity = await page.evaluate(() => {
    const v = document.querySelector('.anim-dawn-lift')
    return v ? Number(getComputedStyle(v).opacity) : -1
  })
  console.log(
    `  日出后暗罩 opacity=${noonOpacity.toFixed(3)}` +
      (noonOpacity < 0.05 ? '  ✓ 天亮了' : '  ← ⚠️ 还没亮完，这张不是最终样子'),
  )
  await shot('01-splash')

  /* 2. 任务首页 */
  // 等入场页过去：底部导航只在主界面里存在，拿它当「已经进来了」的信号。
  // （别再拿「你好，宝贝」当信号 —— 那行已经被删掉了，等它会直接超时。）
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await wait(600)

  /* 1b. 新手引导（全新 profile 必经）
     ⚠️ 两个坑：
     1. 必须在**进来之后**才检查。入场页有 1.9s 最短停留，
        在 01-splash 那一刻主界面还没渲染，向导自然也不在
        （第一版就写在那儿了，结果是静默跳过、7 张图全缺）。
     2. 引导是**盖住整个主界面**的，所以必须在这里先拍完再走掉，
        不然下面每一张截图里都会压着一层向导/导览。 */
  const wizardUp = await page.evaluate(() => !!document.querySelector('[data-step]'))
  if (wizardUp) {
    await shot('01b-guide-welcome')

    await clickByText('开始设置')
    await wait(600)
    await shot('01c-guide-profile')

    await clickByText('下一步')
    await wait(600)
    await shot('01d-guide-pin')

    await clickByText('以后再说')
    await wait(600)
    await shot('01e-guide-done')

    // 给孩子看的功能导览：拍两张，看高亮框有没有真的跟着 tab 走
    await clickByText('带宝贝看一遍')
    await page
      .waitForFunction(() => !!document.querySelector('[data-tour-bubble]'), { timeout: 8000 })
      .catch(() => {})
    await wait(700)
    await shot('01f-tour-tasks')

    await clickByText('下一步')
    await wait(800)
    await shot('01g-tour-farm')

    // 功能导览一共**六步**：前四步讲底部四个 tab（给孩子），
    // 后两步讲顶栏的「家长确认」和「设置」（给家长，2026-09-21 补）。
    // ⚠️ 新增的那两步**必须**也拍下来 —— 项目硬规矩：
    //    走查图集里看不见的改动 ≈ 没验过（见本文件顶部第 2 条）。
    await clickByText('下一步')
    await wait(800)
    await shot('01h-tour-redeem')

    await clickByText('下一步')
    await wait(800)
    await shot('01i-tour-points')

    // ⚠️ 后两步的目标在**顶栏**，气泡要翻到下方（ChildTour 文件头第 5 条）。
    // 这一步正是最容易拍歪的地方 —— 沿用「往上」的算法气泡会被推出屏幕下沿。
    await clickByText('下一步')
    await wait(800)
    await shot('01j-tour-review')

    await clickByText('下一步')
    await wait(800)
    await shot('01k-tour-settings')

    await clickByText('知道啦')
    await page
      .waitForFunction(() => !document.querySelector('[data-tour-bubble]'), { timeout: 8000 })
      .catch(() => {})
    await wait(600)

    // ⚠️ 导览每一步都会把底部 tab 切过去。最后两步虽然停在「任务」，
    // 但**不能靠这个巧合** —— 导览顺序一改，下面从 02-tasks 开始的每一张
    // 截图都会拍错页，而且不会报错，只是图全不对（第一版就是这么错的）。
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
      )
      b?.click()
    })
    await wait(700)

    console.log('  引导截图：01b~01k（10 张）')
  } else {
    console.log('  ! 没弹新手引导（profile 里已经有 onboardingDone 标记，这 10 张会缺）')
  }

  await shot('02-tasks')

  /* 3. 任务详情弹层滚到底 —— 验底部按钮没被导航盖住
     ⚠️ 2026-09-21：计时器隐藏后，卡片上的入口从「▶️ 开始 / 没用计时器·直接填时间」
     两个按钮变成一个「✅ 我做完啦！」（见 src/features/tasks/ui.tsx 的 TIMER_ENABLED）。
     这里点的是**卡片上**那个（此刻弹层还没开，页面上没有同名按钮）。 */
  await clickByText('我做完啦')
  await wait(700)
  await page.evaluate(() => {
    const sheet = document.querySelector('[role="dialog"] > div:nth-child(2)')
    if (sheet) sheet.scrollTop = sheet.scrollHeight
  })
  await wait(400)
  await shot('03-task-detail-bottom')

  await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('[role="dialog"] button')).find(
      (x) => (x.getAttribute('aria-label') ?? '') === '关闭',
    )
    if (b) b.click()
  })
  await wait(500)

  /* 4. 「加任务」的家长提示框 */
  if (await clickByText('加任务')) {
    await wait(600)
    await shot('04-nudge')
    await clickByText('好的')
    await wait(500)
  }

  /* 4b. 长期任务的「记一次完成」弹层
     ------------------------------------------------------------
     用户报的事故：「长期任务 孩子 做完确认时 为啥能自己评价和打分。」
     这张图就是那一处的验收画面：**只有用时 + 「完成确认」**，
     没有「做得怎么样？」三档自评，得分预览也改成了「确认后**大约**能拿到」。
     把它拍进来，下次谁再把自评加回去，翻图集就能一眼看出来。 */
  if (await clickByText('完成一次')) {
    await wait(700)
    await shot('04b-period-submit')
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('[role="dialog"] button')].find(
        (x) => (x.getAttribute('aria-label') ?? '') === '关闭',
      )
      if (b) b.click()
    })
    await wait(500)
  }

  /* 5. 农场 */
  await clickByText('农场', 'nav')
  await wait(700)
  await shot('05-farm')

  /* 6~8. 农场：收获二选一 + 种子商店
     —— 先把灾害关掉、时钟拧快，让作物几秒就熟，否则要等真实分钟数。
     （只影响本次截图，进程退出即结束，不会污染别的脚本。） */
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
  })

  /* 6. 收获二选一（还有额度） */
  const p1 = await plantMature()
  await tapPlot(p1)
  await wait(900)
  await shot('06-harvest-sheet')
  await closeSheet()

  /* 7. 收获二选一：这一块的额度已经卖满，但整个产出物还有额度
     ------------------------------------------------------------
     为什么拍的是这个状态、而不是「按钮变灰的卖满态」：
     闸门是**按产出物**归集的（活着的标的 + 结转），所以要让整条都归零，
     得同时满足「这个作物的每一块地都卖满」且「结转也是 0」。
     而实际产出**低于**「最高产量」—— 灾害骰子的期望倍率是 0.87
     （`HARVEST_TIERS`），而基准单价是按**最高产量**推的
     （`基准单价 = 上限回收 ÷ 总产出量`，见 `docs/farm-economy-design.md` §5.6）。
     所以光靠种出来的那点产出**永远卖不满**，这个态在真机上也很难走到 ——
     它是安全阀，不是日常状态。
     这里拍一个真实可达、而且正好说明「闸门是按轮算的」的状态：
     这一块地的这一轮已经收回满额，别的地/结转的额度还在。 */
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    for (let k = 0; k < 2; k++) {
      const e = st().plots.find((p) => p.unlocked && !p.crop)
      await st().plant(e.index, 'carrot')
      await new Promise((r) => setTimeout(r, 1400))
      await st().harvest(e.index, 'store')
    }
  })
  const p2 = await plantMature()
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    for (let i = 0; i < 12; i++) {
      if ((await st().sellProduce('produce-carrot', 999)) <= 0) break
    }
  })
  await tapPlot(p2)
  await wait(900)
  await shot('07-harvest-round-used')
  await closeSheet()

  /* 8. 种子商店：解锁状态 + 「这一轮最多能收回 N 🌾」 */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => /种子/.test(x.innerText) || /种子/.test(x.getAttribute('aria-label') ?? ''),
    )
    b?.click()
  })
  await wait(1200)
  await shot('08-seed-shop')
  await closeSheet()

  /* 8b. 农场市场：行情条 + 背包估值 + 商品列表 + 展开行的走势图与卖出按钮
     ------------------------------------------------------------
     2026-09-16 补。这一页原来**根本不在走查图集里**，代价是：
       · 顶部币种胶囊错显成「积分 🪙」（实际结的是丰收币 🌾），
         孩子卖完东西眼前那个数字一动不动；
       · 底部写着「全卖会拿到 X 分，和刚才比少了 N 分」，而 N 恒为 0。
     两个都是**肉眼一看就能发现**的问题，却因为没有图，一直躺在那里。
     文件头那句「新增界面必须加进这个脚本」在这里兑现 —— 走查图集看不见的改动 ≈ 没验过。

     拍两张：
       08b-market-sheet —— 行情条 / 背包估值 / 商品列表（**顶部币种胶囊要看得见**）
       08c-market-row   —— 展开一行：7 日走势图 + 「卖 1 / 卖 5 / 全卖」三个按钮
     08c 需要背包里有货（展开行才有卖出按钮），所以先补种补收一次 ——
     上面第 7 段为了拍「这一轮卖满」把胡萝卜卖光了。 */
  const pm = await plantMature()
  await tapPlot(pm)
  await wait(900)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /收进背包/.test(x.innerText))
    b?.click()
  })
  await wait(900)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /市场/.test(x.innerText))
    b?.click()
  })
  await wait(1100)
  await shot('08b-market-sheet')

  const rowExpanded = await page.evaluate(() => {
    // 展开**有货**的那一行：空行展开也没有卖出按钮，拍出来看不出问题
    const row = [...document.querySelectorAll('li button')].find((b) =>
      /有\s*[1-9]/.test(b.innerText),
    )
    if (!row) return false
    row.click()
    return true
  })
  if (!rowExpanded) {
    console.warn('  ⚠️ 背包里没货，08c-market-row 拍不到卖出按钮 —— 先看 08b 是不是空的')
  }
  await wait(800)
  await shot('08c-market-row')
  await closeSheet()

  /* 9~10. 其余 Tab */
  for (const [label, name] of [
    ['兑换', '09-redeem'],
    ['积分', '10-points'],
  ]) {
    await clickByText(label, 'nav')
    await wait(700)
    await shot(name)
  }

  /* 11. 设置页（孩子 tab） */
  await page.evaluate(async () => {
    // 清掉家长锁，免得点齿轮时被 PIN 拦住（PIN 归 e2e 测，截图脚本不管）
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ protectParentActions: false, parentPin: undefined })
  })
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="设置"]')
    if (b) b.click()
  })
  await wait(700)
  await shot('11-settings')

  /* 12b. 设置 · 规则 tab：音效 / 震动开关
     这两个字段一直存在、默认开着，但**以前没有开关**（家长关不掉）。
     新加的界面必须进图集，否则走查时根本看不到它。 */
  await clickByText('规则')
  await wait(900)
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && (x.textContent ?? '').trim() === '音效',
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(800)
  await shot('12b-sound-toggles')

  /* 12. 设置 · 规则 tab：家长设「每一轮最多能赚多少」 */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && /每一轮最多能赚多少/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(800)
  await shot('12-profit-ratio')

  console.log(`\n截图已输出到 ${OUT}/`)
  if (errors.length) {
    console.log('控制台报错：')
    for (const e of errors) console.log('  ·', e)
  } else {
    console.log('控制台无报错 ✓')
  }
} finally {
  await browser.close()
}
