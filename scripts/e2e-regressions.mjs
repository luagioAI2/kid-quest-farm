/**
 * 回归守卫：钉住「已经修过的具体 bug」，防止改回去
 * ------------------------------------------------------------
 * 和 `e2e-check` / `e2e-gameplay` 的分工：
 *   那两套验的是「功能对不对」（覆盖广、按页面组织）；
 *   这一套验的是「**这几个坑别再踩**」（覆盖窄、按 bug 组织，每条都带日期和病因）。
 *   一个 bug 修完就往这里加一条 —— 它们是回归，不是新功能。
 *
 * 当前守着 7 条：
 *   1. 设置页改「孩子的小名」后点头像，名字被吃回去（2026-09-18 家长报的）
 *      → `updateSettings` 的 `set` 落在了 `await` 之后
 *   2. 「设置 → 任务掉落」开关能控制任务编辑页里的「完成后掉落」
 *      → 新功能，顺带钉住默认值和落库
 *   3. 市场里有货的行要有标记（绿点 + 绿色数量胶囊 + 描边）
 *   4. 市场「全卖」按钮报的个数/金额必须真能拿到
 *      → 原来是按「不限额度」报价，承诺「全卖 4 个 +4」实际只卖 3 个
 *   5. 成熟地块的产量标签是整数、不带 `≈`（2026-09-20 用户报的）
 *      → 那个 `≈` 是「积分时代」`≈3.6 🪙` 的遗留，B1 + 甲之后纯属噪音
 *   6. 任务详情的用时步进器默认 = 计划用时，不是 0（2026-09-21）
 *      → 默认 0 ⇒ `0 ≤ 计划用时` ⇒ 一点即满分。计时器恢复后，这条验的是
 *        「没在计时」（重做 / 补做）那一支，见用例里的 export/import 说明。
 *   7. 重做（家长打回）的任务交得上去（2026-09-21）
 *      → `startTimer()` 对非 `pending` 直接 return，重做卡片上那个「▶️ 开始」
 *        是个**点了没反应的死按钮**；而唯一能开提交弹层的入口是它右边那个
 *        旁路按钮，被 `MANUAL_FILL_ENABLED` 藏了之后整条路就断了（且是静默的）
 *      → 顺带钉住：重做不挂「上一次」留下的秒表（`running` 必须带 pending）
 *
 * 跑法：node scripts/e2e-regressions.mjs [url]   （默认 http://127.0.0.1:4180/）
 * 前置：先 `npm run preview`
 *
 * ⚠️ 第 1 条**必须在 CPU 降速下测**（脚本里设了 20×）。
 * 满速的桌面浏览器复现不出来 —— 写入窗口只有几毫秒，真人手速赶不上；
 * 但真机（尤其 APK）上必现。降速是为了把那个窗口放大到可观测。
 *
 * 负向验证（2026-09-18 做过）：把 `updateSettings` 改回旧顺序、
 * 把「全卖」标签改回 `quoteFor(itemId, count)`，本脚本会红 5 条
 * （打字被吃 ×2、丢更新 ×1、承诺 ≠ 实卖 ×1、汇总 ×1），其余照旧绿。
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
/**
 * 产出物的量词集合（`catalog.ts` 的 `PRODUCE_UNIT`，对照表见 docs §5.7）。
 *
 * ⚠️ 2026-09-21 起量词**跟着产出物走**，不再一律「个」—— 牛奶是「瓶」、
 * 萝卜是「根」、羊毛是「团」。断言里**不能写死「个」**，否则量词改对之后
 * 这套用例反而变红。
 * 这个字符类只用于**行数不固定**的地方（比如「前 3 行市场」那种）。
 * 标的已知的地方一律**钉死具体量词**（下面用 `根`）—— 那才能抓到
 * 「量词没接上、悄悄退回默认『个』」这类回归。
 */
const UNIT_CH = '[个根朵颗片团杯瓶]'
/**
 * 「有 N 个/根/…」的数量胶囊。
 * ⚠️ 用 `'\\d'` 而不是模板字面量里的 `\d` —— 后者会被吃掉反斜杠变成字母 d，
 * 于是这条**恒不匹配**（而且不报错，只是「找不到有货的行」）。
 */
const PILL_RE = new RegExp('^有 \\d+ ' + UNIT_CH + '$')
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  // profile 必须落在项目同盘 —— 系统盘满会让 Chrome 的 IndexedDB 直接罢工，
  // 症状是随机挂在任意一条用例上。见 scripts/lib/profile.mjs 顶部。
  userDataDir: makeProfileDir('regressions'),
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await sleep(1200)
  await dismissOnboarding(page)
  await sleep(800)

  /**
   * 遇到家长密码锁（PinPad）就输默认密码 0000。
   * ⚠️ 设置页的「规则 / 数据」两个 tab 和任务编辑页都是**锁着的** ——
   * 不先输密码，那些 switch 压根不在 DOM 里（第一版探针就栽在这：
   * 报「没找到开关」，其实是没进门，属于假失败）。
   */
  const enterPinIfLocked = async () => {
    const locked = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((x) => x.textContent?.trim() === '清空'),
    )
    if (!locked) return false
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
        b?.click()
      })
      await sleep(220)
    }
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '确定')
      b?.click()
    })
    await sleep(900)
    return true
  }

  const openSettings = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('header button')].find(
        (x) => (x.getAttribute('aria-label') ?? '').includes('设置') || x.innerText.includes('⚙'),
      )
      b?.click()
    })
    await sleep(900)
  }
  const closeSettings = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '返回',
      )
      b?.click()
    })
    await sleep(700)
  }
  const gotoTab = async (label) => {
    await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().endsWith(l))
      b?.click()
    }, label)
    await sleep(600)
    await enterPinIfLocked()
  }

  /* ============ 3. 市场行标记（先做，因为它不需要降速） ============ */
  console.log('\n【3】市场行的「有货」标记')
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    await st().plant(empty.index, 'carrot')
  })
  // ⚠️ 落地页是「任务」tab，`div.grid.grid-cols-3` 只存在于「农场」tab。
  // 不先切过去，下面读到的 tile 文本永远是空串 —— 而「标签里没有 `≈`」
  // 这条在空串上会**静默通过**，是典型的假绿。所以必须先切 tab。
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '农场',
    )
    b?.click()
  })
  await sleep(1000)

  // 等成熟 → 收进背包
  const idx = await page.evaluate(() => window.__kqf__.getState().plots.find((p) => p.crop)?.index ?? 0)
  let matureTile = ''
  for (let i = 0; i < 40; i++) {
    matureTile = await page.evaluate((k) => {
      const g = document.querySelector('div.grid.grid-cols-3')
      const tiles = g ? [...g.querySelectorAll(':scope > button')] : []
      return tiles[k]?.innerText ?? ''
    }, idx)
    if (/可以收啦/.test(matureTile)) break
    await sleep(250)
  }

  /* 2026-09-20：成熟地块的产量标签曾经写 `≈4 个` —— 那个 `≈` 是「积分时代」
     （`≈{harvestPoints} 🪙`，值是 3.6 这种**连续小数**）的遗留。B1 整数化
     （§6.1.3）+ 甲 产量封顶（§6.1.2）之后，产量只在 0/2/3/4 这些整数上取，
     根本不存在「约等于」，`≈` 只剩噪音。见 `FarmPage.tsx` 那处注释。
     ⚠️ 判据必须**同时**要求「成熟 + 有数字」，否则空 tile 也算通过。
     ⚠️ 2026-09-21：量词改成跟着产出物走。这一段种的是**胡萝卜**，所以钉 `根`
     —— 用字符类的话，「量词没接上、退回默认『个』」这条会**静默溜过去**。 */
  const flatTile = matureTile.replace(/\s+/g, ' ')
  check(
    '成熟地块的产量标签是整数、量词对（胡萝卜 = 根）、不带 `≈`',
    /可以收啦/.test(flatTile) && /\d+\s*根/.test(flatTile) && !flatTile.includes('≈'),
    `tile「${flatTile || '(空 —— 没切到农场 tab?)'}」`,
  )

  await page.evaluate(async (i) => {
    await window.__kqf__.getState().harvest(i, 'store')
  }, idx)
  await sleep(1200)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '农场',
    )
    b?.click()
  })
  await sleep(900)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /市场/.test(x.innerText))
    b?.click()
  })
  await sleep(900)

  /* ⚠️ 正则必须在**浏览器里**建。`page.evaluate` 的函数是**序列化**过去执行的，
     闭包里的 Node 常量（`PILL_RE`）在那边**压根不存在** —— 直接 ReferenceError。
     原来的写法能用，是因为它用的是**正则字面量**（随函数源码一起传过去）。
     所以把 pattern 当参数传进去，两边共用同一个定义。 */
  const rowInfo = await page.evaluate((pillSrc) => {
    const pillRe = new RegExp(pillSrc)
    const lis = [...document.querySelectorAll('li')].filter((li) => li.querySelector('button'))
    return lis.slice(0, 3).map((li) => {
      const btn = li.querySelector('button')
      const pill = [...btn.querySelectorAll('span')].find((s) => pillRe.test(s.textContent.trim()))
      const none = [...btn.querySelectorAll('span')].find((s) => s.textContent.trim() === '没有')
      const dot = [...btn.querySelectorAll('span')].find((s) =>
        s.className.includes('rounded-full') && s.className.includes('size-2'),
      )
      return {
        text: btn.innerText.replace(/\s+/g, ' ').trim().slice(0, 40),
        pillClass: pill?.className ?? null,
        pillText: pill?.textContent.trim() ?? null,
        noneClass: none?.className ?? null,
        hasDot: !!dot,
        liRing: li.className.includes('ring-2'),
      }
    })
  }, PILL_RE.source)
  const stocked = rowInfo.find((r) => r.pillText)
  const emptyRow = rowInfo.find((r) => r.noneClass)
  check(
    '有货的行：数量是绿色胶囊',
    !!stocked && /bg-grass-200/.test(stocked.pillClass) && /text-grass-700/.test(stocked.pillClass),
    stocked ? `${stocked.pillText} → ${stocked.pillClass}` : '(没有找到有货的行)',
  )
  check('有货的行：有绿点标记', !!stocked && stocked.hasDot, stocked ? `dot=${stocked.hasDot}` : '')
  check('有货的行：整行加了描边', !!stocked && stocked.liRing, stocked ? `ring=${stocked.liRing}` : '')
  check(
    '没货的行：显示「没有」且是浅灰（不抢眼）',
    !!emptyRow && /text-ink-400/.test(emptyRow.noneClass),
    emptyRow ? emptyRow.noneClass : '(没有找到没货的行)',
  )

  /* ============ 4. 「全卖」按钮不再撒谎 ============ */
  console.log('\n【4】市场「全卖」按钮的诚实性（小萝卜）')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '关闭')
    b?.click()
  })
  await sleep(600)
  // 补一块小萝卜
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    await st().plant(empty.index, 'radish')
  })
  const ridx = await page.evaluate(() => {
    const s = window.__kqf__.getState()
    return s.plots.find((p) => p.crop?.cropId === 'radish')?.index ?? -1
  })
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate((k) => {
      const g = document.querySelector('div.grid.grid-cols-3')
      const tiles = g ? [...g.querySelectorAll(':scope > button')] : []
      return tiles[k]?.innerText ?? ''
    }, ridx)
    if (/可以收啦/.test(t)) break
    await sleep(250)
  }
  await page.evaluate(async (i) => {
    await window.__kqf__.getState().harvest(i, 'store')
  }, ridx)
  await sleep(1200)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /市场/.test(x.innerText))
    b?.click()
  })
  await sleep(900)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('li button')].find((b) => /小萝卜/.test(b.innerText))
    row?.click()
  })
  await sleep(800)

  const sellUI = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('li button')].filter((b) => /卖|全卖/.test(b.innerText))
    const held = window.__kqf__.getState().inventory.find((i) => i.itemId === 'produce-radish')?.count ?? 0
    return {
      held,
      labels: btns.map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
      disabled: btns.map((b) => b.disabled),
      quotaLine: (document.body.innerText.match(/这一轮还能卖[^\n]{0,60}/) ?? [''])[0].replace(/\s+/g, ' '),
    }
  })
  const allLabel = sellUI.labels.find((l) => l.startsWith('全卖')) ?? ''
  // 这一段卖的是**小萝卜** → 量词钉 `根`（同上：不用字符类，才抓得到「退回默认个」）
  const m = allLabel.match(/全卖\s*(\d+)\s*根\s*\+(\d+)/)
  const promised = m ? Number(m[1]) : NaN
  check(
    '「全卖」按钮报的个数 <= 背包里的个数（不再超卖）',
    promised <= sellUI.held,
    `按钮「${allLabel}」，背包 ${sellUI.held} 个`,
  )
  /*
    ⚠️ 2026-09-18 改口径，这条断言跟着换了。
    原来钉的是「卖不光时给出了额度解释」—— 那时硬顶是 `基准价 × 1.6`，
    单轮满产在贵的时候会剩货，所以要检查 UI 有没有解释清楚。
    现在硬顶 = `上限回收 ÷ 满产`（家长：「波动不能够超过成本 × 1.6」），
    `满产 × 硬顶 = 上限回收` 恰好相等 → **单轮满产一定卖得光**，
    「卖不光」在单轮场景下已经不可能发生（那正是修好的 bug），
    再断言解释文字就会变成一条永远假的失败。
    所以改成钉新规则本身：按钮承诺的个数必须**等于**背包里的个数，一个都不剩。
  */
  check(
    '单轮满产：行情到顶也一个不剩（承诺的个数 = 背包里的个数）',
    promised === sellUI.held,
    `按钮承诺 ${promised} 个，背包 ${sellUI.held} 个`,
  )

  // 真点一下，看是不是真的只卖按钮上写的那么多
  const box = await page.evaluate(() => {
    const b = [...document.querySelectorAll('li button')].find((x) => /全卖/.test(x.innerText))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (box) await page.mouse.click(box.x, box.y)
  await sleep(1500)
  const after = await page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      held: s.inventory.find((i) => i.itemId === 'produce-radish')?.count ?? 0,
      balance: s.harvestBalance,
    }
  })
  const sold = sellUI.held - after.held
  check(
    '实卖个数 == 按钮承诺的个数',
    sold === promised,
    `承诺 ${promised} 个，实卖 ${sold} 个，到手 ${after.balance} 丰收币`,
  )

  /* ============ 2. 任务掉落开关 ============ */
  console.log('\n【2】「设置 → 任务掉落」开关')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '关闭')
    b?.click()
  })
  await sleep(600)
  await openSettings()
  await gotoTab('规则')

  const toggleInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="任务掉落"]')
    return {
      found: !!btn,
      ariaChecked: btn?.getAttribute('aria-checked') ?? null,
      text: (btn?.closest('section')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 70),
    }
  })
  check('设置里出现了「任务掉落」开关', toggleInfo.found, toggleInfo.text || '')
  check('开关默认是「开」', toggleInfo.ariaChecked === 'true', `aria-checked=${toggleInfo.ariaChecked}`)

  // 打开任务编辑页，确认默认（开着）能看到掉落选项
  await closeSettings()
  const openEditor = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('nav button')].find(
        (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
      )
      b?.click()
    })
    await sleep(700)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '新建任务',
      )
      b?.click()
    })
    await sleep(700)
    // 「加任务」对孩子是先弹一句「这里要爸爸妈妈来弄」，要走「我是家长」才进编辑页
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /我是家长/.test(x.innerText))
      b?.click()
    })
    await sleep(900)
  }
  const closeEditor = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '关闭',
      )
      b?.click()
    })
    await sleep(600)
  }
  const editorHasDrops = () => page.evaluate(() => /完成后掉落/.test(document.body.innerText))

  /** 编辑页有家长密码锁（默认 0000），要先进去；返回是否真的进到了表单 */
  const unlockEditor = async () => {
    await enterPinIfLocked()
    return page.evaluate(() => /任务叫什么/.test(document.body.innerText))
  }

  await openEditor()
  const editorOpen = await unlockEditor()
  check('任务编辑页打开了（不是卡在密码锁上）', editorOpen === true, `editorOpen=${editorOpen}`)
  const hasDropsOn = await editorHasDrops()
  check('开关为「开」时，任务编辑页有「完成后掉落」', hasDropsOn === true, `hasDrops=${hasDropsOn}`)
  await closeEditor()

  // 关掉开关
  await openSettings()
  await gotoTab('规则')
  await page.evaluate(() => {
    document.querySelector('button[aria-label="任务掉落"]')?.click()
  })
  await sleep(900)
  const offNow = await page.evaluate(() => window.__kqf__.getState().settings.taskDropsEnabled)
  check('点开关后设置真的落库了', offNow === false, `taskDropsEnabled=${offNow}`)
  await closeSettings()

  await openEditor()
  const editorOpen2 = await unlockEditor()
  check('任务编辑页打开了（对照组）', editorOpen2 === true, `editorOpen=${editorOpen2}`)
  const hasDropsOff = await editorHasDrops()
  check('开关为「关」时，任务编辑页**不再显示**「完成后掉落」', hasDropsOff === false, `hasDrops=${hasDropsOff}`)
  await closeEditor()

  // 还原
  await page.evaluate(async () => {
    await window.__kqf__.getState().updateSettings({ taskDropsEnabled: true })
  })
  await sleep(400)

  /* ============ 6. 用时步进器的默认值 ============ */
  console.log('\n【6】任务详情：用时步进器的默认值')
  /*
    2026-09-21：步进器默认原来是 0 —— 而 `0 ≤ 计划用时` ⇒ 预览直接写
    「✅ 在计划时间内，可拿全部积分」，也就是**一路点到底就能拿满分**。
    已改成默认预填 `plannedMinutes`。

    ⚠️ 判据要**同时**钉住「非 0」和「= 计划用时」。只判「非 0」的话，
    哪天有人改成硬编码 `1` 也照样绿 —— 那正是这个 bug 的变体。
    ⚠️ 这条依赖 `data-testid`（见 TaskDetail.tsx）。弹层里「N 分」这个文本
    会出现四五次（计划值 / 步进器 / 两个快捷键 / 预览），靠文本分不开。
    ⚠️ 放在【1】之前：【1】会把 CPU 降速 20×，后面的用例都会变慢。
  */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
    )
    b?.click()
  })
  await sleep(900)

  /*
    卡片上的入口跟着 `TIMER_ENABLED` / `MANUAL_FILL_ENABLED` 变（见
    src/features/tasks/ui.tsx）。**当前状态**：待完成卡片只有「▶️ 开始」，
    点它**只开始计时、弹层不开**；计时开始后卡片才换成「✅ 我做完啦！」。
    所以不能「点一下就假定弹层开了」，要**点到弹层真的出现**为止。
  */
  const OPEN_ACTION = /我做完啦|开始|去完成/
  for (let i = 0; i < 3; i++) {
    await page.evaluate((src) => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        new RegExp(src).test(x.innerText),
      )
      b?.click()
    }, OPEN_ACTION.source)
    await sleep(900)
    if (await page.evaluate(() => !!document.querySelector('[role="dialog"]'))) break
  }

  /**
   * ⚠️ 2026-09-21 补：上面那样点开弹层时，`startedAt` **一定已经被写上**
   * （入口就是「▶️ 开始」），于是弹层进的是「正在计时中…」那一支 ——
   * 步进器整段不渲染，直接读 `stepper-minutes` 只会拿到 null。
   *
   * 这条守卫验的是「**没在计时**时，步进器默认 = 计划用时」，所以先把
   * `startedAt` 摘掉。走 export → 改 → import 往返，两个都是公开 action，
   * 不去戳内部状态；`importBackup` 结尾会 `refresh()`，弹层会就地重渲染成
   * 「手填」那一支。
   *
   * ⚠️ 别改成「点『没用计时器 · 直接填时间』」—— 那个旁路按钮现在藏着
   * （`MANUAL_FILL_ENABLED`），点了什么都没有。
   */
  await page.evaluate(async () => {
    const backup = await window.__kqf__.exportBackup()
    for (const i of backup.data.taskInstances) delete i.startedAt
    await window.__kqf__.importBackup(backup)
  })
  await sleep(900)

  const mins = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    if (!d) return null
    const s = d.querySelector('[data-testid="stepper-minutes"]')
    const p = d.querySelector('[data-testid="planned-minutes"]')
    return {
      stepper: s ? Number((s.textContent ?? '').trim()) : null,
      planned: p ? Number((p.textContent ?? '').replace(/\D/g, '')) : null,
    }
  })

  check(
    '任务详情能打开，且拿得到步进器 / 计划用时',
    !!mins && mins.stepper !== null && mins.planned !== null,
    JSON.stringify(mins),
  )
  if (mins && mins.stepper !== null && mins.planned !== null) {
    check(
      '用时步进器默认不是 0（否则一路点到底就能拿满分）',
      mins.stepper > 0,
      `stepper=${mins.stepper}`,
    )
    check(
      '用时步进器默认 = 计划用时',
      mins.stepper === mins.planned,
      `stepper=${mins.stepper} planned=${mins.planned}`,
    )
  }

  // 收尾：把弹层关掉，否则它会盖住顶栏，后面【1】点不到设置入口
  await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    const b = d
      ? [...d.querySelectorAll('button')].find(
          (x) => (x.getAttribute('aria-label') ?? '').includes('关闭'),
        )
      : null
    b?.click()
  })
  await sleep(700)
  check(
    '弹层关得掉（没把后面的用例挡死）',
    !(await page.evaluate(() => !!document.querySelector('[role="dialog"]'))),
  )

  /* ============ 7. 重做任务的提交入口 ============ */
  console.log('\n【7】重做（家长打回）的任务交得上去')
  /*
    2026-09-21：藏掉「▶️ 开始」右边那个「没用计时器 · 直接填时间」之后
    暴露出来的坑（见 src/features/tasks/ui.tsx 的 `MANUAL_FILL_ENABLED`）。

    `startTimer()` 对非 `pending` 的实例**直接 return**，所以重做卡片上那个
    「▶️ 开始」本来就是个**点了没反应的死按钮**；而原来唯一能打开提交弹层的
    入口，就是它右边那个旁路按钮。只藏不补 ⇒ 重做任务永远交不上去 ——
    而且是**静默**的：按钮在、文案对、点得动，就是什么也不发生。

    现在重做卡片直接给「✅ 我做完啦！」。

    ⚠️ 造这个状态走 export → 改 → import。不选「提交 + 家长打回」是因为那条路
    依赖 `parentReviewEnabled`：关着时 `submitInstance` 会直接结算，
    `settledAt` 一写上就再也打回不了，用例会随家长设置飘。
  */
  const rejectSeed = await page.evaluate(async () => {
    const backup = await window.__kqf__.exportBackup()
    const inst = backup.data.taskInstances.find((i) => i.status === 'pending')
    if (!inst) return { ok: false, why: '没有 pending 实例' }
    inst.status = 'rejected'
    inst.rejectNote = '再检查一遍'
    delete inst.startedAt
    delete inst.actualMinutes
    delete inst.settledAt
    const r = await window.__kqf__.importBackup(backup)
    return { ok: r.ok, why: r.message }
  })
  await sleep(900)
  check('造得出一个「重做」实例', rejectSeed.ok, JSON.stringify(rejectSeed))

  if (rejectSeed.ok) {
    /*
      ⚠️ 判据必须落在「**点得动**」上，不能只判「按钮在不在」——
      这个 bug 的特征恰恰是按钮在、文案也对，点下去毫无反应。
      所以这里真点一下，然后看提交弹层有没有开。

      此刻页面上只有重做卡片那一个「我做完啦」（待完成卡片全是「▶️ 开始」），
      所以按文案找是唯一的。
    */
    const clicked = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        (x.textContent ?? '').includes('我做完啦'),
      )
      if (!b) return null
      b.click()
      return (b.textContent ?? '').trim()
    })
    await sleep(900)

    const mode = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      if (!d) return null
      return {
        stepper: !!d.querySelector('[data-testid="stepper-minutes"]'),
        live: (d.textContent ?? '').includes('正在计时中'),
      }
    })
    check(
      '重做卡片有能打开提交弹层的入口（不是点了没反应的死按钮）',
      !!mode,
      clicked ? `点到「${clicked}」，弹层${mode ? '已开' : '没开'}` : '卡片上找不到提交入口',
    )
    check(
      '重做不挂「上一次」留下的秒表（走手填那一支）',
      !!mode && mode.stepper && !mode.live,
      JSON.stringify(mode),
    )

    // 收尾：关掉弹层，否则它会盖住顶栏，后面【1】点不到设置入口
    await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      const b = d
        ? [...d.querySelectorAll('button')].find(
            (x) => (x.getAttribute('aria-label') ?? '').includes('关闭'),
          )
        : null
      b?.click()
    })
    await sleep(700)
  }

  /* ============ 1. 名字不再被吃回去 ============ */
  console.log('\n【1】设置页改名字后点头像（20× CPU 降速，模拟真机）')
  const client = await page.createCDPSession()
  await client.send('Emulation.setCPUThrottlingRate', { rate: 20 })

  await openSettings()
  await gotoTab('孩子')
  const sel = 'input[placeholder="宝贝"]'
  let lost = 0
  const names = ['小明', '小红']
  for (const want of names) {
    await page.evaluate(async (n) => {
      await window.__kqf__.getState().updateSettings({ childName: n })
    }, '基线')
    await sleep(700)
    await page.click(sel)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await page.type(sel, want, { delay: 45 })
    const typed = await page.$eval(sel, (e) => e.value)
    /*
      ⚠️ 打字这一步本身也是被测对象，**不能 skip**。
      旧代码下受控输入框会被旧值覆盖，输入「小明」实际只剩「明」——
      如果把这种情况当成「环境问题跳过」，这条断言就永远绿，
      正是本项目最忌讳的假通过。所以这里直接判红。
    */
    check(
      `「${want}」能完整打进去（受控输入框没把字吃掉）`,
      typed === want,
      `input="${typed}"，期望 "${want}"`,
    )
    if (typed !== want) {
      lost++
      continue
    }
    // 马上点头像（真实鼠标）
    const ab = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => (x.textContent ?? '').trim() === '🐰' && x.className.includes('h-14'),
      )
      if (!b) return null
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    if (ab) await page.mouse.click(ab.x, ab.y)
    await sleep(1300)
    const store = await page.evaluate(() => window.__kqf__.getState().settings.childName)
    const input = await page.$eval(sel, (e) => e.value)
    if (store !== want) lost++
    check(`「${want}」+ 点头像后名字保住了`, store === want, `input="${input}" store="${store}"`)
  }
  check('降速下打字不再丢字（2 轮全对）', lost === 0, `丢了 ${lost} 轮`)

  // 同 tick 连续两次更新
  const race = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await Promise.all([
      st().updateSettings({ childName: '同Tick' }),
      st().updateSettings({ avatar: '🦄' }),
    ])
    return { childName: st().settings.childName, avatar: st().settings.avatar }
  })
  check(
    '同一 tick 连调两次 updateSettings，两次改动都生效',
    race.childName === '同Tick' && race.avatar === '🦄',
    JSON.stringify(race),
  )

  console.log('\n' + '─'.repeat(58))
  const failed = results.filter((r) => !r.ok)
  console.log(`通过 ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    console.log('\n失败项：')
    for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  }
  console.log(errors.length ? `\n控制台错误 ${errors.length} 条：\n${errors.join('\n')}` : '\n控制台无错误 ✓')
  process.exitCode = failed.length ? 1 : 0
} catch (e) {
  console.error('\n探针崩了：', e)
  process.exitCode = 1
} finally {
  await browser.close()
}
