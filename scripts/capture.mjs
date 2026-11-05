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
import { seedParentPin } from './lib/onboarding.mjs'
import { grantGame } from './lib/own.mjs'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'

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
    // 2026-10-30：向导里已经没有「设家长密码」这一步（改成第一次用家长区时才要求）
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

  /* 2026-10-30 起新装**没有**家长密码（引导里不再要求设，第一次进家长区
     才要求）。但这个脚本后面有多处「遇到锁就按 4 个 0」的写法 ——
     没密码时那会变成「第一遍设置」，按四下只是设好了、还没过闸，
     后面几张图会拍成密码面板（而且不报错）。所以统一钉一个 0000。
     ⚠️ 必须在 if/else **之外**：老 profile 不弹引导时同样要钉。 */
  await seedParentPin(page)

  await shot('02-tasks')

  /* 02c. 任务页 · 「坚持签到」区块（2026-10-11 补）
     ⚠️ 这一屏**以前从没进过图集** —— 而 2026-10-11 改的正是签到卡
     （去掉「🔥 连续第 N 天」那一行、徽章搬去长期任务）。删了一行却从没
     拍过这张卡，「删干净了没有」这件事第 4 层**等于没验**。
     ⚠️ `block:'center'`：顶栏是 sticky，`'start'` 会把卡片顶到顶栏底下
     （见 shot 14 那段注释，同一个坑）。 */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && /坚持签到/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(800)
  await shot('02c-checkin-section')

  /* 3. 任务详情弹层滚到底 —— 验底部按钮没被导航盖住
     ⚠️ 卡片上的入口跟着 `TIMER_ENABLED` / `MANUAL_FILL_ENABLED` 变
     （见 src/features/tasks/ui.tsx）。**当前状态**是「计时器开着 + 右边那个
     旁路按钮藏着」，所以待完成卡片上只有「▶️ 开始」，点它**只会开始计时、
     弹层不开** —— 必须**先点开始、等卡片换成提交按钮、再点提交**，不能一步到位。
     两个 `clickByText` 找的都是**卡片上**的按钮（此刻弹层还没开，页面上没有同名按钮）。 */
  await clickByText('开始')
  await wait(800)
  await shot('02b-task-running')

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

  /* 9~10. 其余 Tab
     ⚠️ 「积分」**不在这个循环里**（2026-11-05）：底栏回到四格，明细改从
     顶栏那颗 🪙 点开。走查见下面 10-points 那一段 —— 那边必须点
     `header-points`，不能再按底栏文字找。 */
  for (const [label, name] of [
    ['兑换', '09-redeem'],
    // 心愿商城（2026-10-28 新增，P1）。放最后是因为它自己还要往下走两屏
    // （详情 / 家长定价），下一节直接接着拍，不用再切回来。
    ['心愿', '10b-wish-list'],
  ]) {
    await clickByText(label, 'nav')
    await wait(700)
    /* ⚠️ 切 tab **不会**重置滚动位置 —— 前面几步把页面滚下去了，
       直接拍的话 09-redeem 是从中间开始的，顶部那句
       「💱 参考：1 元 ≈ N 分」根本不在图里，走查等于没看到它。
       （2026-09-21 加现金参考时发现的：第一版图集就是从这个位置开始拍的。） */
    await page.evaluate(() => {
      window.scrollTo(0, 0)
      for (const el of document.querySelectorAll('main, .overflow-y-auto')) {
        el.scrollTop = 0
      }
    })
    await wait(300)
    await shot(name)
  }

  /* 09b. 兑换品编辑器：「能换几次」开关（2026-10-29 新增）
     ------------------------------------------------------------
     家长原话：「兑换的东西有比如游戏，兑换了就有了……所以添加兑换时，
     需要设置是否一次性。」

     这一屏是家长真正要做决定的地方，必须进图集：开关摆错位置、
     或者文案写成「一次性」（那是承诺，做得到才写），只有看图才发现。
     ⚠️ 拍完要按「返回管理」再切走 —— 不然下一屏会停在编辑器里。
     ⚠️ **先清家长锁**：管理 tab 整个就是一道 PIN 闸门（`needsPin && !pinOk`
        → 只渲染 `ParentPinPanel`），不清的话连「新增一个兑换品」都找不到，
        脚本只会打印一句跳过 —— 静默少一张图。 */
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ protectParentActions: false })
  })
  await wait(300)
  await clickByText('兑换', 'nav')
  await wait(600)
  if (await clickByText('管理')) {
    await wait(500)
    if (await clickByText('新增一个兑换品')) {
      await wait(600)
      /* ⚠️ 必须**滚到那个开关上**再拍。
         第一版直接拍，出来的是编辑器顶部（图标墙 + 分类），
         「能换几次」在折叠线以下 —— 图集里根本看不到这次改的东西，
         走查时等于没走。 */
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('p, label')].find((x) =>
          (x.textContent ?? '').includes('能换几次'),
        )
        el?.scrollIntoView({ block: 'center' })
      })
      await wait(400)
      await shot('09b-redeem-once')
      await clickByText('返回管理')
      await wait(350)
    } else {
      console.log('  ⚠️ 09b 跳过：管理页没找到「新增一个兑换品」')
    }
  } else {
    console.log('  ⚠️ 09b 跳过：兑换页没找到「管理」')
  }
  /* 10. 我的积分（2026-11-05 从底栏一格改成顶栏 🪙 点开的整屏层）
     ------------------------------------------------------------
     拍它的理由：这是这一轮唯一「入口换地方」的改动 —— 底栏少了一格、
     顶栏那颗 🪙 从纯展示变成按钮。**光看代码看不出那颗币有没有变样**，
     而它旁边还挤着 💎 和 🎫，多一个「可点」的视觉线索很容易把那一行撑坏。
     ⚠️ 一定要拍**关掉之后**的底栏（`11-nav-four`）：
        「四格」是这个需求的全部，而底栏在页脚、永远不在任何一屏的正中间。 */
  await page.evaluate(() => document.querySelector('[data-tour="header-points"]')?.click())
  await wait(700)
  const pointsOpened = await page.evaluate(
    () => !!document.querySelector('[data-points-sheet]'),
  )
  if (pointsOpened) {
    await shot('10-points')
    await page.evaluate(() => document.querySelector('[data-points-close]')?.click())
    await wait(500)
  } else {
    console.warn('  ⚠️ 10-points 跳过：点了顶栏 🪙 但没开出 [data-points-sheet]')
  }
  await shot('11-nav-four')

  await clickByText('心愿', 'nav')
  await wait(600)

  /* 10c~10d. 心愿商城：商品详情 + 家长定价（2026-10-28 新增，P1）
     ------------------------------------------------------------
     为什么必须进图集：这个页面的问题**结构断言全看不见** ——
     「6–成人 岁」这种文案拼接、21 个游戏盒子把商家商品挤到屏幕外、
     定价页的「每天赚 0 张」都是走查时才发现的，而当时截图里根本没有这一屏。

     两条注意：
     1. **先清家长锁**。`OfferView` 整页就是一道 PIN 闸门（`needsPin && !pinOk`
        → 直接 return 锁屏），不清的话 `10d` 永远拍出同一张「请爸爸妈妈来一下」。
     2. 点的是**商家商品**（泡泡玛特），不是游戏盒子 —— 盒子详情少一半内容
        （没有参考价、没有外链按钮），拿它当样本等于漏掉最该看的那半页。 */
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ protectParentActions: false })
  })
  await wait(400)

  /* 把 10c 摆成**混付**那一档（2026-10-29）。
     ------------------------------------------------------------
     这次改动的全部内容就是「券不够时积分补」，券够的时候界面和以前一模一样。
     不主动摆出这个状态，图集里永远是「付款：120 兑换券」，走查图上看不出
     改了任何东西 —— 而那正是最容易漏掉的一种「图对、说明错」。

     价格定在「券 + 50 分」上 ⇒ 券必然花光、必然出现两段分账。 */
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    const s = st()
    if (s.balance < 50) await window.__kqf__.addPoints(50 - s.balance)
    await st().wishSetOffer('wish-popmart', st().harvestBalance + 50)
  })
  await wait(400)

  if (await clickByText('泡泡玛特')) {
    await wait(700)
    await shot('10c-wish-detail')
    if (await clickByText('定价')) {
      await wait(700)
      await shot('10d-wish-offer')
    }
  } else {
    // 拍不到就明说。静默少一张图 = 走查时以为「这页没问题」
    console.log('  ⚠️ 10c/10d 跳过：心愿商城列表里没找到「泡泡玛特」')
  }

  /* 10e. 开箱页（数字商品兑换之后）——2026-10-28 补
     ------------------------------------------------------------
     为什么要有这一屏：数字商品（盲盒）**兑换那一刻就交付**，实物才要等
     爸妈去淘宝买。两套文案共用 `committed` 状态，走查时最该看的就是
     「孩子已经拿到游戏之后，界面还在不在说等爸妈确认 / 去购买」。

     两条注意：
     1. 必须**先回到列表**再点盲盒 —— 定价页的返回只回到详情，
        少按一次就会在详情页里找 `.grid > button`（那里没有网格）。
     2. 装包是真的（读 `public/games/` 的本地包），要轮询等开箱页出现，
        不能 `wait(600)` 赌一把。 */
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="返回"]')
      b?.click()
    })
    await wait(450)
  }
  const priced = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().wishSetOffer('wish-blindbox', 20)
    await window.__kqf__.addVouchers(100)
    return true
  })
  if (priced && (await clickByText('游戏盲盒'))) {
    await wait(700)
    /* 2026-10-29 起盲盒也在**兑换**那一格成交 —— 详情里只剩一颗
       「🎁 去「兑换」换」。按老文案（「用 20 换」）点会**静默点空**：
       开箱页不出现，只有一行 ⚠️，图集里少一张图。 */
    await clickByText('去「兑换」换')
    await wait(900)
    const rowClicked = await page.evaluate(() => {
      const row = document.querySelector('[data-shop-row="wish-blindbox"]')
      const b = [...(row?.querySelectorAll('button') ?? [])].find((x) =>
        /换这个/.test(x.textContent ?? ''),
      )
      if (!b) return false
      b.click()
      return true
    })
    await wait(450)
    if (rowClicked) {
      await page.evaluate(() => {
        const row = document.querySelector('[data-shop-row="wish-blindbox"]')
        const b = [...(row?.querySelectorAll('button') ?? [])].find((x) =>
          /换！/.test(x.textContent ?? ''),
        )
        b?.click()
      })
    }
    await page
      .waitForFunction(() => document.body.innerText.includes('抽到了新游戏'), { timeout: 30000 })
      .catch(() => console.log('  ⚠️ 10e 开箱页没出现：盲盒没换成功（先看 10b 有没有定价）'))
    await wait(600)
    await shot('10e-wish-box')
    // 回到列表，别把「收下」留给下一步的设置页
    await clickByText('收下')
    await wait(600)
    /* 开箱层盖在**兑换**那一格上，收下之后仍停在兑换。
       不回心愿列表的话，10f 在兑换页里找 `.grid > button`（那里没有网格），
       只会打印一句跳过 —— 静默少一张图。 */
    await clickByText('心愿', 'nav')
    await wait(700)
  } else {
    console.log('  ⚠️ 10e 跳过：列表里没找到「游戏盲盒」')
  }

  /* 10f. 单个游戏详情（2026-10-28 用户口径：单个游戏就是游戏，不是盲盒）
     ------------------------------------------------------------
     游戏卡片在列表**很下面**（实物之后），所以要先滚过去再点。
     这一屏要看的正是「和设置里游戏详情是不是同一份东西」：
     图标 / 版本 / 适龄 / 时长 / 体积 / 截图 / 练什么 / 关于。
     ⚠️ 滚下去点开之后必须确认**回到了顶部** —— 不重置滚动的话
     拍出来是详情中段（截图区），名字和兑换按钮都不在画面里。
     ⚠️ 开箱那条 toast 会压住这一屏的标题，先等它自己消失（约 3.4 秒）。 */
  await page
    .waitForFunction(() => window.__kqf__.getState().toasts.length === 0, { timeout: 6000 })
    .catch(() => {})
  const gameCard = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.grid > button')].find((x) =>
      x.querySelector('svg'),
    )
    if (!card) return null
    card.scrollIntoView({ block: 'center' })
    card.click()
    return card.innerText.split('\n')[0]
  })
  if (gameCard) {
    await wait(800)
    await shot('10f-wish-game')
    await page.evaluate(() => {
      document.querySelector('button[aria-label="返回"]')?.click()
    })
    await wait(500)
  } else {
    console.log('  ⚠️ 10f 跳过：列表里没找到带手绘图标的游戏卡片')
  }

  /* 10g. 2026-10-29 删掉了（原来拍「我许的愿」那一屏）
     ------------------------------------------------------------
     用户原话：「不需要在心愿商城显示兑换记录和有一单在等爸妈处理。」
     那一屏连同入口一起下线了，记录归「兑换」那一格的 10j。
     留着一个点不到的名字只会让图集少一张、还看不出少了 —— 所以整段删掉。 */

  /* 10h~10i. 心愿：家长在 👀 里回应（2026-10-29 新增，当天从心愿页挪过来）
     ------------------------------------------------------------
     家长原话：「心愿商城爸爸妈妈收到心愿，也跟任务一样，出现在上边栏的
     眼睛那，而不是在心愿商城这里。爸爸妈妈会查看处理。」

     所以这两张图拍的是**新的处理链路**，不再是心愿页顶部那张卡：
       10h —— 顶栏 👀 点开，队列里第一条就是这条心愿，就地能定价；
       10i —— 开放之后切到「兑换」，孩子那一格**多出一行**（分类「礼物」，
              和家里的兑换品按价混排）。

     ⚠️ 10i 在 2026-10-29 改过一次口径：第一版拍的是「🛍️ 心愿商城 · 爸妈
        开放了」那一块，家长当场否掉（「不需要去心愿商城换」）。现在心愿商品
        就是普通一行，所以要**把那一行滚进屏幕**再拍 —— 它排在「礼物」分类里，
        直接拍首屏只会拍到零食和屏幕时间，看图的人以为没做。

     两条注意：
     1. 挑一件**没被本脚本定过价**的商品（`wish-dino`）。`wish-popmart`
        在 10d 已经定过价，它的心愿单不进待办队列（判据是「有没有开放价」）。
     2. 家长锁在 10c 已经清了，所以 👀 不会被 PIN 拦住；想看闸门形态去 e2e，
        截图脚本不重复拍锁屏。 */
  await page.evaluate(async () => {
    await window.__kqf__.getState().wishExpress('wish-dino')
  })
  await wait(700)
  /* 上面那句「已向爸妈申请」的 toast 挂在 top-3，会盖住 👀 弹层的标题
     （拍出来是「一张被黄条压住的图」）。等它自己消失再拍。 */
  await page
    .waitForFunction(() => window.__kqf__.getState().toasts.length === 0, { timeout: 8000 })
    .catch(() => {})

  if (await clickByText('👀')) {
    await wait(900)
    await shot('10h-review-wish')
    if (await clickByText('开放兑换')) {
      /* 等 toast（「已开放：N 张兑换券」）**出现再消失** —— 它挂在 top-3，
         会盖住下一页的标题，拍出来是「一张有黄条的图」。
         ⚠️ 只等「消失」是不够的：点击之后 toast 还没渲染，`!includes(...)`
            当场就成立，函数立刻返回，2 秒后拍照时黄条正好还在（踩过一次）。 */
      await page
        .waitForFunction(() => document.body.innerText.includes('已开放：'), { timeout: 4000 })
        .catch(() => {})
      await page
        .waitForFunction(() => !document.body.innerText.includes('已开放：'), { timeout: 8000 })
        .catch(() => {})
      // 关掉弹层：头部的 ✕ 和遮罩都是 `aria-label="关闭"`，取最后一个（头部那颗）
      await page.evaluate(() => {
        const bs = [...document.querySelectorAll('button[aria-label="关闭"]')]
        bs[bs.length - 1]?.click()
      })
      await wait(600)
      await clickByText('兑换', 'nav')
      await wait(900)
      // 心愿商品是「礼物」分类里的一行，**不在首屏** —— 先把它滚到屏幕中间。
      // 顺手把它当判据：找不到就说明这一行没渲染（别默默拍一张别的图交差）。
      const rowFound = await page.evaluate(() => {
        const el = document.querySelector('[data-shop-row="wish-dino"]')
        if (!el) return false
        el.scrollIntoView({ block: 'center' })
        return true
      })
      if (rowFound) {
        await wait(400)
        await shot('10i-redeem-wish-row')
      } else {
        console.log('  ⚠️ 10i 跳过：兑换列表里没找到 wish-dino 那一行')
      }

      /* 10j. 兑换记录（2026-10-29 家长报的 bug 修完要看这一屏）
         ------------------------------------------------------------
         「孩子刚兑换了一个游戏，为啥我兑换记录里看不到。」
         现在这一屏是**两张表合成的一条时间线**（家里的 + 心愿/游戏的），
         所以图里应该同时出现：10e 换的盲盒（游戏）、家里的兑换品。
         走查要看的是「状态词对不对」—— 数字商品交付完写「已放进游戏柜」，
         而不是「等爸妈确认」；取消的单子写「已取消 · 已退回」。 */
      await clickByText('兑换记录')
      await wait(800)
      await shot('10j-redeem-records')

      /* 10k. 招商（2026-10-29 新增，第二轮改到**心愿页右上角**）
         ------------------------------------------------------------
         用户原话：「在 心愿右上角 把兑换记录 去掉 换成招商按钮。
         点开 看到招商合作。不是在兑换/兑换记录里显示。」

         所以这一张必须**从心愿页进去**拍。走「兑换 → 记录 → 招商」
         即使拍到的界面一模一样，也证明不了入口在对的地方 ——
         上一版就是这么错的（入口做在记录底部），图集里看不出来。

         走查要看两件事：
           · 入口在心愿页**右上角**（和标题同一行）；
           · 家长那一路写的是「分享给其他家长」，不是「邀请商家」。

         ⚠️ 这一段没有后端，界面只有「申请」这一半。 */
      await clickByText('心愿', 'nav')
      await wait(700)
      const merchantEntry = await page.evaluate(() => {
        const b = document.querySelector('[data-merchant-entry]')
        if (!b) return false
        b.click()
        return true
      })
      if (merchantEntry) {
        await wait(700)
        await shot('10k-merchant')
        await page.evaluate(() => {
          document.querySelector('button[aria-label="返回心愿商城"]')?.click()
        })
        await wait(400)
      } else {
        console.log('  ⚠️ 10k 跳过：心愿页右上角没找到招商入口')
      }
    } else {
      console.log('  ⚠️ 10i 跳过：👀 里没找到「开放兑换」')
    }
  } else {
    console.log('  ⚠️ 10h/10i 跳过：顶栏没找到 👀')
  }

  /* 11. 设置页（孩子 tab） */
  await page.evaluate(async () => {
    /* 清掉家长锁，免得点齿轮时被 PIN 拦住（PIN 归 e2e 测，截图脚本不管）。
       ⚠️ 2026-10-30 起只能靠 protectParentActions:false —— 清 parentPin
       现在等于「还没设过」，闸门会改成要求当场设一个。 */
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ protectParentActions: false })
  })
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="设置"]')
    if (b) b.click()
  })
  await wait(700)
  await shot('11-settings')

  /* 11d. 设置 · 数据 tab：导出 / 恢复 / 危险操作
     ------------------------------------------------------------
     这一屏**从来没进过图集**。它上面有「导出备份」「从备份恢复」和
     「清空全部数据」（不可撤销）—— 第 4 层走查对这一屏等于没验。
     2026-10-30 给「从备份恢复」补了一句「家长密码不在备份里」，
     才发现没有任何一张图能看到那句话。

     ★ 滚到「从备份恢复」那张卡：它在折叠线以下，不滚就是没拍。 */
  await clickByText('数据')
  await wait(900)
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && /从备份恢复/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(800)
  await shot('11d-settings-data')

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

  /* ⚠️ 这里原来有一张 `12d-tier-ladder`（设置页那张「坚持的奖励阶梯」卡）。
     2026-10-12 家长拍板「不需要全局设定梯度，连续的。每个任务单独，
     有默认的就行了」—— 整张卡删掉了，**锚点文案也不存在了**。
     留着它的后果不是「少一张图」，而是 `el` 为 undefined 时
     `scrollIntoView` 静默跳过，然后照常 `shot()` —— 拍下来的是**别的页面**，
     而且没有任何报错。所以整段删掉，对应的界面改由 12f/12g 拍
     （阶梯倍率搬进了任务编辑）。 */

  /* ⚠️ 这里原来还有一张 `12e-streak-bonus`（设置页那张「连续完成奖励」卡）。
     2026-10-12 家长第二轮拍板把它也删了：「我是说家长设置里的删掉。不需要在
     家长设置里设定。因为任务里已经可以单独设置了。」
     —— 整张卡连同 `settings.streakBonusEnabled` 字段一起删掉，
     **锚点文案（「连着几天完成长期任务…」）也不存在了**。

     和上面 12d 同一个道理：留着它的后果不是「少一张图」，而是 `el` 为
     undefined 时 `scrollIntoView` 静默跳过，然后照常 `shot()` ——
     拍下来的是**别的页面**，而且没有任何报错。
     所以整段删掉，连击的界面改由 12h（任务编辑里的「单独设连击奖励」）拍。

     ➜ 一般化：**删掉一个界面时，必须同时删掉拍它的那一步。**
       截图脚本不会因为锚点消失而报错，它只会安静地拍错东西
       —— 这是本项目踩过的坑（`el?.scrollIntoView` 那条）。 */

  /* 12. 设置 · 规则 tab：家长设「每一轮最多能赚多少」 */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && /每一轮最多能赚多少/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(800)
  await shot('12-profit-ratio')

  /* 12c. 设置 · 规则 tab：家长设「现金对积分」参考汇率（2026-09-21 新增）
     ⚠️ 新加的界面必须进图集 —— 否则第 4 层走查对这一屏**等于没验**
     （§13 那条注释就是踩过这个坑之后写的）。 */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && /现金对积分/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(800)
  await shot('12c-cash-ratio')

  /* 11b / 11c. 设置 · 游戏 tab：我的游戏（2026-10-28 从「游戏市场」改名）
     ------------------------------------------------------------
     这一屏是**家长真的会点**的地方：
       · ⓪ 「每天玩多久」—— 到点锁游戏那一格（新；锁住那一屏在图 15）
       · ① 列表 —— 每款一行：图标 / 名字 / 一句话 / 适龄 / 安装
       · ② 详情页 —— 帮助孩子 / 截图（可点开放大）/ 关于这款游戏
       · ③ 装完之后那一行变「当前」+「经济参数」
       （钻石卡和在线商店卡 2026-10-28 删了，这一屏不再有那两块）
     不把它们放进图集，第 4 层走查对这一屏就等于没验（§12b / §13 同一个坑）。

     ★ 两张图不够了：**装之前**和**装之后**是两种界面。
       只拍装之前会漏掉 ④ 整块（它「装了才渲染」），
       而 ④ 正是唯一给家长看数字的地方。
     ★ 走的是家长那条路（点「安装」按钮），不是 `plugin.installFromUrl` ——
       截图脚本要拍的是**界面**，用调试句柄绕过去就拍不到「正在装…」这些状态。
     ★ 拍完**卸掉**：后面的图不该带着一个装进来的游戏。
       （底栏和当前游戏不受影响 —— 安装不会自动切成当前。） */
  await clickByText('游戏')
  await wait(900)
  await shot('11b-games-settings')

  // 列表已经摊在设置页上（2026-10-25 改，不再有「进入游戏市场」弹层）
  await page.waitForFunction(() => !!document.querySelector('[data-local-row]'), {
    timeout: 10000,
  })
  /*
    ★ 拍之前必须滚到列表上。这张图以前只拍卡片顶部（「每天玩多久」+「我的游戏」
      开头），21 行游戏全在折叠线以下 —— 等于这一屏从来没被走查过。
      `block:'center'` 而不是 `'start'`：`'start'` 会把它顶到顶栏底下被盖住一半。
  */
  await page.evaluate(() => {
    document.querySelector('[data-local-row]')?.scrollIntoView({ block: 'center' })
  })
  await wait(400)
  await shot('11b2-games-market')

  /*
    11b4：表格底下那两句说明（「未拥有」怎么解锁 / 兑换码在哪 / 卸载在哪）。
    它是**家长唯一的操作指引**，而且 2026-10-30 改过口径（原来写「去心愿商城换」，
    而心愿商城不收钱）—— 不进图集就等于这次改文案没验过。
  */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((x) =>
      /还不能装/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(400)
  await shot('11b4-games-footnote')

  // 详情页（第一款的「帮助孩子 / 截图 / 关于」）
  await page.evaluate(() => {
    document.querySelector('[data-store-detail]')?.scrollIntoView({ block: 'center' })
  })
  await wait(200)
  await page.evaluate(() => document.querySelector('[data-store-detail]')?.click())
  await wait(900)
  await shot('11b3-games-detail')
  await page.evaluate(() => document.querySelector('[data-store-close]')?.click())
  await wait(600)

  /*
    2026-10-30 起「没拥有不能装」—— 这一屏的默认状态是**一款都装不了**：
    21 行全是「去心愿商城」那颗灰药丸，页面上一个 `[data-local-install]` 都没有。

    本脚本原来直接找安装按钮，找不到就抛「本地包清单是空的？」。这句话是**错的**
    （清单里有 21 款，只是都没拥有），而且它把整轮截图拦在这里 —— 11c 之后的
    十几张图全部停在上一次的样子，看起来像「这批改动没碰那些屏」。
    正是 `notes/verify-probes.md` 里那条：**锚点失效的报错会指向错误的原因**。

    所以先预置拥有（和 `e2e-anthill` 等套件同一口径，走 `window.__kqf__.grantGame`），
    再走家长那条路点「安装」—— 截图要拍的是**界面**，用 `installFromUrl` 绕过
    就拍不到「正在装…」和装完那一行的状态。
  */
  const needOwnId = await page.evaluate(
    () => document.querySelector('[data-local-need-own]')?.getAttribute('data-local-need-own') ?? '',
  )
  if (!needOwnId) {
    throw new Error(
      '游戏列表里既没有「安装」也没有「去心愿商城」—— 这一屏没渲染成预期状态，先看图 11b2。',
    )
  }
  await grantGame(page, needOwnId)
  await wait(600)

  const localInstallClicked = await page.evaluate((id) => {
    const b = document.querySelector(`[data-local-install="${id}"]`)
    if (!b) return false
    b.scrollIntoView({ block: 'center' })
    b.click()
    return true
  }, needOwnId)
  // 找不到就**炸掉**，别静默拍一张「没装成」的图（静默的错图比缺图更糟）
  if (!localInstallClicked) {
    throw new Error(
      `预置拥有后 ${needOwnId} 那一行仍然没有安装按钮 —— 门槛和列表不同源（见 GameStore 的 ownedSet 注释）。`,
    )
  }
  /*
    ★★ 判据必须钉在**刚点的那一款**上，不能是「页面上有任何一个已安装」。

    这一条踩过：本轮之前先兑换了「细胞守卫」，所以 `[data-local-installed]`
    一开始就存在 —— 下面这个 wait 立刻返回，图 11c 拍到的是
    「云边小农场 · 正在装…」，而 11d 拿到的 `installedId` 是**细胞守卫**
    （`querySelector` 取的是 DOM 里第一个，不是刚装的那个）。
    两张图各自单看都说得通，摆在一起才发现 11c 没装完、11d 是另一款。

    同一条也适用于「等它加载完」的每一处：**等具体那一个**。
  */
  await page.waitForFunction(
    (id) => !!document.querySelector(`[data-local-installed="${id}"]`),
    { timeout: 25000 },
    needOwnId,
  )
  // ⚠️ 必须在关掉市场**之前**读这一行：弹层一关就整体卸载，
  //    `[data-local-installed]` 会从 DOM 里消失 ⇒ 读成空串 ⇒ 静默不卸载 ⇒
  //    后面每一张图都带着一个装进来的游戏。
  const installedId = needOwnId
  // 2026-10-25 起没有市场弹层了（列表就在页面上），这里不用关任何东西。
  // 详情弹层已经在上面用 `[data-store-close]` 关掉了。
  await wait(600)
  // 2026-10-30：原来这里要滚到「这些游戏的经济参数」那张卡 —— 它在 10-29
  // 「游戏页改成我的游戏」时被删掉了，选择器永远匹配不到（`?.` 静默吞掉）。
  // 现在装完之后最该拍的是那一行「已装」的状态，它就在当前视口里。
  await shot('11c-games-installed')

  /*
    11d：装完之后**详情最下面多出一块「卸载」**（2026-10-25 从列表行挪进去的）——
    这是这次新加的界面，不走查就等于没做。滚到最底下再拍。
  */
  if (installedId) {
    await page.evaluate(
      (id) => document.querySelector(`[data-store-detail="${id}"]`)?.click(),
      installedId,
    )
    await wait(600)
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
      const sc = d?.querySelector('.overflow-y-auto')
      if (sc) sc.scrollTop = sc.scrollHeight
    })
    await wait(400)
    await shot('11d-games-detail-uninstall')
    await page.evaluate(() => document.querySelector('[data-store-close]')?.click())
    await wait(300)
  }

  if (installedId) {
    await page.evaluate((id) => window.__kqf__.plugin.uninstall(id), installedId)
    await wait(700)
  }

  /* 12f ~ 12h. 任务编辑 →「单独设奖励」（2026-10-12 新增）
     ------------------------------------------------------------
     家长 2026-10-12 拍板：

       「不需要全局设定梯度，连续的。 每个任务单独，有默认的就行了。」

     于是设置页那张「坚持的奖励阶梯」卡**整张删掉**、连击卡只剩总开关，
     两个值都搬进了**任务编辑**：
       · 签到任务 → 「单独设阶梯倍率」（20% ~ 150% 六个档位）
       · 长期任务 → 「单独设连击奖励」（每连一天多给 / 一次最多加）
     ⚠️ 新加的界面必须进图集（§12b / §12d 都是踩过这个坑才写的）：
     这两组控件正是家长**问了两遍**的东西，不进图集的话第 4 层
     对这一屏等于没验 —— 而「家长找不到」本来就是这个改动的起因。

     ⚠️ 关着的那张（12f）比打开的那张（12g）更重要：开关关着时要显示
     「不单独设，用默认的 80%」这句实话。这次改动里最容易漏的就是它 ——
     界面写着默认值、发分按另一个数，两边都不报错。

     ⚠️ 家长锁在 §11 就已经关了（`protectParentActions: false`），
     所以点「编辑任务」不会弹 PIN 键盘；下面留了兜底，以后又开也不至于拍错。
     ⚠️ `block:'center'`：编辑器是**底部弹层**，`'start'` 会把目标滚到
     弹层可视区之外（§02c / §14 同一个坑，只是方向相反）。 */
  const openTaskEditor = async (title) => {
    // 设置页是整页，得先退出去才点得到底部 tab
    await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="返回"]')
      if (b) b.click()
    })
    await wait(500)
    await clickByText('任务', 'nav')
    await wait(700)

    const opened = await page.evaluate((t) => {
      /* ⚠️ 任务卡片的 DOM 嵌套层数没写死过，所以**从编辑按钮往上爬**找
         哪一层的文案里有这个标题，而不是假设卡片是某个具体标签。 */
      const btn = [...document.querySelectorAll('button[aria-label="编辑任务"]')].find((b) => {
        let el = b
        for (let i = 0; i < 6 && el; i++) {
          if ((el.textContent ?? '').includes(t)) return true
          el = el.parentElement
        }
        return false
      })
      if (!btn) return false
      btn.scrollIntoView({ block: 'center' })
      btn.click()
      return true
    }, title)
    // 找不到就**炸掉**，不要静默拍一张别的页面 —— 静默的错图比缺图更糟
    if (!opened) throw new Error(`截图脚本找不到「${title}」那张卡的编辑入口`)
    await wait(900)

    const locked = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      return !!d && /请爸爸妈妈来一下/.test(d.innerText)
    })
    if (locked) {
      for (let i = 0; i < 4; i++) {
        await page.evaluate(() => {
          const d = document.querySelector('[role="dialog"]')
          const b = d && [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === '0')
          b?.click()
        })
        await wait(180)
      }
      await wait(800)
    }
  }

  /** 在弹层里把含某段文案的元素滚到视野中间 */
  const scrollInDialog = async (re) => {
    const ok = await page.evaluate((src) => {
      const d = document.querySelector('[role="dialog"]')
      if (!d) return false
      const hits = [...d.querySelectorAll('*')].filter((x) =>
        new RegExp(src).test(x.textContent ?? ''),
      )
      if (!hits.length) return false
      /* 取**文本最短**的那个命中元素（≈ 最内层的那个）。
         ⚠️ 这里原来要求 `children.length === 0`（必须是叶子），但 `Field` 的标签是
            `<p><span aria-hidden>➕</span>每连一天多给</p>` 这种形状：
            `<p>` 有子元素、`<span>` 里只有 emoji —— **两边都不匹配**。
            于是 2026-10-12 的 12h 静默滚不动，拍出来是表单顶部。
            改成「最短文本」之后，带 emoji 的标签和不带 emoji 的标签都能命中。 */
      const el = hits.reduce((a, b) =>
        (a.textContent ?? '').length <= (b.textContent ?? '').length ? a : b,
      )
      el.scrollIntoView({ block: 'center' })
      return true
    }, re)
    /* ⚠️ 找不到就**炸掉**。旧版这里是 `el?.scrollIntoView(...)` ——
       找不到时它什么都不做、也不报错，`shot()` 照拍，
       出来的是一张「停在表单顶部」的错图，而且**全程零报错**。
       静默的错图比缺图更糟（同 `clickInDialog` / `openTaskEditor` 那两条规矩）。 */
    if (!ok) throw new Error(`弹层里找不到匹配 /${re}/ 的文本，滚不过去`)
    await wait(800)
  }

  /** 点弹层里第一个文案匹配的按钮（开关就是 button） */
  const clickInDialog = async (re) => {
    const ok = await page.evaluate((src) => {
      const d = document.querySelector('[role="dialog"]')
      const b = d && [...d.querySelectorAll('button')].find((x) => new RegExp(src).test(x.textContent ?? ''))
      if (!b) return false
      b.click()
      return true
    }, re)
    if (!ok) throw new Error(`弹层里找不到匹配 /${re}/ 的按钮`)
    await wait(700)
  }

  // 12f：签到任务 —— 阶梯倍率开关（关着，显示「不单独设，用默认的 80%」）
  await openTaskEditor('练字签到')
  await scrollInDialog('单独设阶梯倍率')
  await shot('12f-task-tier-ratio-off')

  /* 12g：把开关打开 —— 六个档位按钮出现，上面那几档**当场重算**。
     ⚠️ 必须再点一个**非默认**的档位（150%），否则这张图证明不了「重算」：
        默认值本来就是 80%，开关一开、档位停在 80%，上面那三个数字
        和关着的时候一模一样 —— 图看着没问题，其实什么都没验到。
        点完 150% 后应当看到 1/3/5 天从 +2/+6/+12 变成 **+4/+12/+24**
        （unit = 1.5 × 基础分 5 × 目标 5 / 10 = 3.75 → 取整 4）。 */
  await clickInDialog('单独设阶梯倍率')
  await clickInDialog('150%')
  await scrollInDialog('每完成一次签到')
  await shot('12g-task-tier-ratio-on')
  await closeSheet()

  // 12h：长期任务 —— 连击加成分（每连一天多给 / 一次最多加）
  await openTaskEditor('读一本完整的故事书')
  await clickInDialog('单独设连击奖励')
  await scrollInDialog('每连一天多给')
  await shot('12h-task-streak-bonus')
  await closeSheet()

  /* 13. 家长确认 · 打分弹层
     ⚠️ 这个界面以前**不在图集里**。2026-09-21 改它的文案
     （「宝贝计时 N 分」→「宝贝用时 N 分」）时才发现：走查根本没拍过它，
     于是第 4 层对这一屏**等于没验**。改过 / 会改的界面必须进图集。

     ⚠️⚠️ 两个踩过的坑（第一版就是这么拍错的，拍出来是「PIN 键盘压在设置页上」）：
     ① 齿轮进的是**整页**，底栏被盖住 —— 必须先点 `aria-label="返回"` 出去，
        否则 `clickByText('任务','nav')` 静默失败，人还留在设置页；
     ② **别开 `protectParentActions`** —— 在设置页当场开，会立刻弹锁把后面
        所有点击挡住。这里只要密码在，保护关着即可。 */
  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label="返回"]')
    if (b) b.click()
  })
  await wait(600)

  await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    await s.updateSettings({ parentPin: '1234', protectParentActions: false })
    const t = await s.addTask({
      title: '__capture_review',
      category: 'study',
      cycle: 'once',
      plannedMinutes: 20,
      basePoints: 20,
      allowOvertime: true,
      allowLateNoPenalty: false,
      qualityRated: false,
    })
    const inst = window.__kqf__
      .getState()
      .instances.find((i) => i.taskId === t.id && i.status === 'pending')
    // 14 分 vs 计划 20 分 —— 让「宝贝用时 14 分」那个快捷按钮真的出现
    if (inst) await window.__kqf__.getState().submitInstance(inst.id, 14, undefined)
  })
  await wait(900)
  await clickByText('任务', 'nav')
  await wait(700)

  /* ⚠️⚠️ 切 tab **不会**重置滚动（同 09/10 那段的老坑），所以这一屏「弹层背后
     露出哪张卡」完全取决于上一屏（设置页）滚到了哪里 —— 而设置页的高度会随
     新增卡片变化。2026-10-10 加「坚持的奖励阶梯」卡后，设置页高了一张卡，
     `现金对积分` 的 `scrollIntoView` 落点跟着变，这个滚动又漏进了任务 tab：
     这一屏背景从「等确认的琥珀色卡」整块换成了另一张普通任务卡，走查图上
     看着像弹层改版了，其实弹层本身逐字节相同（实测：同一脚本下两个构建
     0 像素差；只有脚本版本不同才会差）。
     所以这里**显式**把刚造的那张待确认卡滚到视野顶部 —— 这张图的语义本来就是
     「家长确认弹层 + 背后那张等确认的卡」，不该靠上一屏的滚动碰运气。
     ⚠️ 必须用 `block:'start'`：弹层盖住屏幕中下部，`block:'center'` 会把这张卡
     藏到弹层**背后**，露出来的反而是它上面那张无关的任务卡（实测过）。 */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && /__capture_review/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'start' })
  })
  await wait(500)

  await page.evaluate(() => {
    const b = document.querySelector('button[aria-label^="家长确认"]')
    if (b) b.click()
  })
  await wait(900)

  // 保护关着通常直接进打分界面；万一还是要求密码，就把 PIN 打进去
  const locked = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return !!d && /请爸爸妈妈来一下/.test(d.innerText)
  })
  if (locked) {
    for (const k of ['1', '2', '3', '4']) {
      await page.evaluate((key) => {
        const d = document.querySelector('[role="dialog"]')
        const b = d && [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === key)
        b?.click()
      }, k)
      await wait(200)
    }
    // ⚠️ 显式点「确定」—— 4 位自动提交读旧 state 那个 bug 有过前科
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      const b = d && [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === '确定')
      b?.click()
    })
    await wait(1200)
  }
  await shot('13-parent-review')

  /* 14. 长期任务区块的连击徽章（2026-10-11 新增）
     ------------------------------------------------------------
     连击奖励现在**只属于长期任务**（见 domain/recurrence.ts 的 isPeriodTask），
     徽章也从签到卡搬到了「长期任务」这一块的标题行。新界面必须进图集 ——
     否则第 4 层走查对这一屏**等于没验**（§12b / §12d 都是踩过这个坑才写的）。

     ⚠️ 徽章只在 streak > 0 时出现，而一次走查**不会跨天**完成长期任务 ——
     不造历史的话这一屏永远拍不到它。

     造法只用现成的公开命令，不碰内部表：导出备份 → 给「读一本完整的故事书」
     （monthly，目标 4）补三条「前三天 / 前两天 / 昨天」的完成记录 → 导回去。
     `importBackup` 是「先全量校验、再整体替换」，所以这是一次**无损往返** ——
     农场 / 背包 / 兑换记录都随导出的那份快照一起回来。
     ⚠️ 挑月度任务、且三条日期都落在**同一个月**：它的 periodKey 是 `2026-10`
     这种，三条 = 同周期不同天，唯一键 `&[taskId+periodKey+date]` 放得下，
     卡片上「本月进度 3/4」也自然。换 weekly 的「背诵」（目标 2）会显示
     「3/2」，看着像出了 bug。
     ⚠️ 今天是月初时前三天会跨月 —— 所以 periodKey 按每条自己的日期算，
     不能拿今天的月份一把梭。 */
  // 先把 13 那张打分弹层关掉，否则下面点不到底栏的「任务」
  await page.keyboard.press('Escape')
  await wait(500)
  await page.evaluate(async () => {
    const raw = await window.__kqf__.exportBackup()
    const dayOf = (delta) => {
      const d = new Date(Date.now() + delta * 86400_000)
      const p = (n) => (n < 10 ? `0${n}` : String(n))
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    }
    const task = raw.data.tasks.find((t) => t.title === '读一本完整的故事书')
    if (!task) return
    for (const delta of [-1, -2, -3]) {
      const date = dayOf(delta)
      const at = new Date(`${date}T12:00:00`).getTime()
      raw.data.taskInstances.push({
        ...task,
        id: `cap-streak-${delta}`,
        taskId: task.id,
        periodKey: date.slice(0, 7), // 月度周期键 = yyyy-MM
        date,
        status: 'completed',
        earnedPoints: task.basePoints,
        completedAt: at,
        settledAt: at,
        createdAt: at,
        updatedAt: at,
      })
    }
    await window.__kqf__.importBackup(raw)
  })
  await wait(900)
  await clickByText('任务', 'nav')
  await wait(800)
  /* ⚠️ 这里必须 `block:'center'`，**不能**用 `'start'` —— 顶栏是 sticky 的，
     `'start'` 会把「长期任务」这一行顶到视口最上面、正好被顶栏盖住，
     拍出来就是「区块标题和徽章都不见了」（第一版就是这么拍的）。 */
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('*')].find(
      (x) => x.children.length === 0 && /长期任务/.test(x.textContent ?? ''),
    )
    el?.scrollIntoView({ block: 'center' })
  })
  await wait(800)
  await shot('14-period-streak')

  /* 15. 游戏时长锁（2026-10-28 新增的界面）
     ------------------------------------------------------------
     家长设了「每天玩多久」之后，玩满就把游戏换成一句「今天的游戏时间用完了」。
     这一屏**只有设了上限才出现** —— 走查用的是全新档案（默认不限），
     不主动设一次就永远拍不到，等于这块新界面没进图集。

     ⚠️ 日期键必须在页面里按 `appDayKey` 的口径算（本地时区 + dayStartHour 偏移）。
       写死一个日期串的话，跨天那几小时会算成「昨天」⇒ 归零 ⇒ 不锁 ⇒
       拍出来是一张**正常的游戏画面**，而脚本一声不吭。 */
  await page.evaluate(() => {
    const pad = (n) => String(n).padStart(2, '0')
    const s = window.__kqf__.getState().settings
    const d = new Date(Date.now() - s.dayStartHour * 3600_000)
    const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return window.__kqf__.getState().updateSettings({
      gameDailyMinutes: 30,
      gameClock: { day, sec: 30 * 60 },
    })
  })
  await wait(500)
  // 底栏「游戏」那一格是当前游戏（锚点 tab-<id>），按排除法找，别写死 tab-farm
  await page.evaluate(() => {
    /* 底栏的固定格（不含运行时算出来的游戏那格）。
       2026-11-05：`tab-points` 删掉了 —— 底栏回到四格，它已经不存在。
       留着的话这一句「找一格不在 staticTours 里的 tab」照样能跑，
       但注释和常量会对着一个不存在的锚点说话，下一个人会以为是自己数错了。 */
    const staticTours = ['tab-tasks', 'tab-redeem', 'tab-wish']
    const b = [...document.querySelectorAll('[data-tour^="tab-"]')].find(
      (x) => !staticTours.includes(x.getAttribute('data-tour')),
    )
    b?.click()
  })
  await wait(1000)
  await shot('15-game-limit-locked')

  // 收工：把上限关掉、回任务页 —— 后面的图不该带着一个锁住的游戏
  await page.evaluate(() =>
    window.__kqf__.getState().updateSettings({ gameDailyMinutes: 0, gameClock: undefined }),
  )
  await wait(300)
  await page.evaluate(() => document.querySelector('[data-tour="tab-tasks"]')?.click())
  await wait(600)

  /* 记下这批图是从**哪一版 bundle** 截的。
     `make-site-assets.py` 会把它复制成 `site/img/shots-source.txt`，
     `check-site` 拿它和当前 bundle 名比。

     为什么需要：官网的界面截图是**发布物**，但重拍是手工步骤 ——
     `build-site.mjs` 只把 `.e2e-scratch/landing-shots/` 里的图**重新压缩**，
     并不会重拍。所以「改了 App 没重拍」时，官网会一直挂着旧界面的图，
     而且**零报错**，日志里还写着「③ 界面截图」像是刚生成的。
     2026-10-09 实测：那一批图是 10-03 拍的，挂了六天，
     页面上日期还写着「10月3日」。 */
  const html = await fetch(URL).then((r) => r.text())
  const bundle = (html.match(/assets\/(index-[\w-]+\.js)/) ?? [])[1] ?? 'unknown'
  writeFileSync(`${OUT}/SHOTS-BUILD.txt`, `${bundle}\n`)
  console.log(`截图对应的 bundle：${bundle}`)

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
