/**
 * 核心玩法闭环验证
 * ------------------------------------------------------------
 * 直接通过窗口调试句柄驱动 store，验证"任务结算 → 积分 → 农场消费 → 收获"
 * 这条主链路在真实浏览器里确实能跑通（单元测试覆盖不到的集成部分）。
 *
 * 用法：node scripts/e2e-gameplay.mjs [url]
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome，无法执行')
  process.exit(2)
}

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})

const errors = []
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  // 只记文本会丢掉「哪个请求挂了」这条关键线索，排查时只能靠猜。
  // 把失败请求的 URL 一并带上，报错信息才自解释。
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
  })
  page.on('requestfailed', (r) => {
    const why = r.failure() ? r.failure().errorText : 'unknown'
    errors.push(`请求失败 ${why} ${r.url()}`)
  })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 })
  // 等 store 就绪
  await page.waitForFunction(() => !!window.__kqf__, { timeout: 20000 })
  await new Promise((r) => setTimeout(r, 1500))

  /* ============ 1. 结算规则：三种典型场景，直接验证入库积分 ============ */
  console.log('\n【1】结算规则 → 提交 → 家长审核 → 积分入账')

  /**
   * 注意：孩子端 submitInstance 现在**不再直接发积分**，
   * 只把实例置为 submitted（等爸爸妈妈看）。
   * 所以这里必须把家长那一步也跑一遍，才是一条完整的链路。
   */
  const settleCase = async (label, { planned, actual, base, qualityBonus, allowOvertime, allowLateNoPenalty, quality }) =>
    page.evaluate(
      async (cfg) => {
        const st = window.__kqf__.getState()
        const before = st.balance
        // 造一个临时任务，跑真实结算链路
        const task = await st.addTask({
          title: `__probe_${cfg.label}`,
          category: 'study',
          cycle: 'once',
          plannedMinutes: cfg.planned,
          basePoints: cfg.base,
          qualityBonusPoints: cfg.qualityBonus,
          allowOvertime: cfg.allowOvertime,
          allowLateNoPenalty: cfg.allowLateNoPenalty,
          qualityRated: true,
        })
        const s2 = window.__kqf__.getState()
        const inst = s2.instances.find((i) => i.taskId === task.id && i.status === 'pending')
        if (!inst) return { err: 'no instance' }

        // ① 孩子交上去 —— 此时不应有任何积分变动
        const submitReturn = await window.__kqf__
          .getState()
          .submitInstance(inst.id, cfg.actual, cfg.quality)
        const afterSubmit = window.__kqf__.getState().balance
        const submitted = window.__kqf__
          .getState()
          .instances.find((i) => i.id === inst.id)?.status

        // ② 家长审核确认 —— 积分在这里才真正到账
        const earned = await window.__kqf__
          .getState()
          .reviewInstance(inst.id, cfg.quality, cfg.actual)
        const after = window.__kqf__.getState().balance

        // 清理探针任务
        await window.__kqf__.getState().deleteTask(task.id)
        return {
          earned,
          before,
          after,
          delta: after - before,
          afterSubmit,
          submitted,
          submitReturn,
        }
      },
      { label, ...{ planned, actual, base, qualityBonus, allowOvertime, allowLateNoPenalty, quality } },
    )

  const onTime = await settleCase('ontime', {
    planned: 30, actual: 25, base: 20, qualityBonus: 10,
    allowOvertime: true, allowLateNoPenalty: false, quality: 'great',
  })
  check('交上去时状态变成 submitted，且不发积分', onTime.submitted === 'submitted' && onTime.afterSubmit === onTime.before, `status=${onTime.submitted} ${onTime.before} → ${onTime.afterSubmit}`)
  check('家长确认后按时完成拿到全额+质量分(30)', onTime.earned === 30, `earned=${onTime.earned} delta=${onTime.delta}`)

  const overHalf = await settleCase('over50', {
    planned: 30, actual: 45, base: 20, qualityBonus: 0,
    allowOvertime: true, allowLateNoPenalty: false, quality: undefined,
  })
  check('家长确认后超时50%拿到一半(10)', overHalf.earned === 10, `earned=${overHalf.earned}`)

  const overDouble = await settleCase('over2x', {
    planned: 30, actual: 70, base: 20, qualityBonus: 0,
    allowOvertime: true, allowLateNoPenalty: false, quality: undefined,
  })
  check('超时超一倍拿到0分', overDouble.earned === 0, `earned=${overDouble.earned}`)

  const noPenalty = await settleCase('nopenalty', {
    planned: 20, actual: 999, base: 15, qualityBonus: 0,
    allowOvertime: false, allowLateNoPenalty: true, quality: undefined,
  })
  check('免扣分任务超时仍拿全额(15)', noPenalty.earned === 15, `earned=${noPenalty.earned}`)

  const strictOver = await settleCase('strict', {
    planned: 20, actual: 25, base: 18, qualityBonus: 0,
    allowOvertime: false, allowLateNoPenalty: false, quality: undefined,
  })
  check('严格限时任务超时即0分', strictOver.earned === 0, `earned=${strictOver.earned}`)

  /* ============ 2. 账本一致性 ============ */
  console.log('\n【2】账本一致性')
  const ledgerOk = await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    const sorted = [...s.ledger].sort((a, b) => a.createdAt - b.createdAt)
    let running = 0
    let mismatch = 0
    for (const e of sorted) {
      running += e.delta
      if (running !== e.balanceAfter) mismatch++
    }
    return { finalBalance: running, statedBalance: s.balance, mismatch, count: sorted.length }
  })
  check(
    '账本累计余额 = 当前余额',
    ledgerOk.finalBalance === ledgerOk.statedBalance,
    `账本=${ledgerOk.finalBalance} 余额=${ledgerOk.statedBalance}`,
  )
  check('余额快照全部自洽', ledgerOk.mismatch === 0, `${ledgerOk.count} 条流水, 不一致 ${ledgerOk.mismatch}`)

  /* ============ 3. 农场闭环：种植 → 收获 ============ */
  console.log('\n【3】农场闭环：种下 → 成长 → 收获')

  const plantRes = await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    const before = s.balance
    const ok = await s.plant(0, 'carrot')
    const s2 = window.__kqf__.getState()
    const plot = s2.plots.find((p) => p.index === 0)
    return { ok, before, after: s2.balance, hasCrop: !!plot?.crop, cropId: plot?.crop?.cropId }
  })
  check('种植成功', plantRes.ok === true)
  check('地块记录了作物', plantRes.hasCrop && plantRes.cropId === 'carrot', `crop=${plantRes.cropId}`)
  // 同样从 catalog 读真实种子价，避免经济调参导致假失败
  const carrotSeedCost = await page.evaluate(() => window.__kqf__.catalog.cropSeedCost('carrot'))
  check(
    '种植扣除了种子积分',
    plantRes.after === plantRes.before - carrotSeedCost,
    `${plantRes.before} → ${plantRes.after}（种子 ${carrotSeedCost}）`,
  )

  // 作物生长不需要单独验证：下面的流程会等待真实时间推进并收获，
  // 那一步已经覆盖了「种下 → 生长 → 成熟 → 收获」整条链路。
  // （早先这里有一段 import 已打包产物的死代码，路径写死成 /assets/index-loaded.js，
  //   在真实浏览器里必然 404，会污染「运行时报错」列表，已删除。）

  // 胡萝卜 3 分钟成熟 —— 直接把页面时间快进不现实，改为用 1 分钟作物验证
  console.log('  · 等待作物成熟（真实时间推进）…')
  const matured = await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    // 种一个成熟时间最短的作物到 1 号地
    const ok = await s.plant(1, 'carrot')
    return ok
  })
  void matured

  // 用 3 秒轮询等待（胡萝卜 3 分钟，这里只验证进度在推进，不真等成熟）
  const progressMoving = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    const p0 = st().plots.find((p) => p.index === 1)
    const t0 = p0?.crop?.plantedAt
    await new Promise((r) => setTimeout(r, 1200))
    const p1 = st().plots.find((p) => p.index === 1)
    return { plantedAt: t0, stillThere: !!p1?.crop, same: p1?.crop?.plantedAt === t0 }
  })
  check('作物状态在 store 中稳定保持', progressMoving.stillThere && progressMoving.same, '')

  /* ============ 4. 动物闭环 ============ */
  console.log('\n【4】动物闭环：领养 → 投喂 → 收获产出')

  const animalRes = await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    const before = s.balance
    const ok = await s.buyAnimal('chicken', '小黄')
    const s2 = window.__kqf__.getState()
    const a = s2.animals.find((x) => x.name === '小黄')
    return { ok, before, after: s2.balance, hasAnimal: !!a, id: a?.id, animalId: a?.animalId }
  })
  check('领养小鸡成功', animalRes.ok === true)
  check('动物进入农场', animalRes.hasAnimal && animalRes.animalId === 'chicken')
  // 价格从 catalog 读，不在脚本里写死，避免经济数值调整后测试假失败
  const chickenCost = await page.evaluate(() => window.__kqf__.catalog.animalCost('chicken'))
  check(
    '领养扣除积分',
    chickenCost == null || animalRes.after === animalRes.before - chickenCost,
    `${animalRes.before} → ${animalRes.after}（售价 ${chickenCost}）`,
  )

  const feedRes = await page.evaluate(async (id) => {
    const s = window.__kqf__.getState()
    const before = s.animals.find((x) => x.id === id)?.feedCount ?? 0
    await s.feedAnimal(id)
    const after = window.__kqf__.getState().animals.find((x) => x.id === id)?.feedCount ?? 0
    return { before, after }
  }, animalRes.id)
  check('投喂增加了喂食次数', feedRes.after === feedRes.before + 1, `${feedRes.before} → ${feedRes.after}`)

  /* ============ 5. 导出 / 导入 往返 ============ */
  console.log('\n【5】数据导出 → 导入 往返一致性')

  const roundTrip = await page.evaluate(async () => {
    const before = await window.__kqf__.exportBackup()
    const beforeTasks = before.data.tasks.length
    const beforeBalance = window.__kqf__.getState().balance
    const okRes = await window.__kqf__.importBackup(before)
    const afterBalance = window.__kqf__.getState().balance
    const afterTasks = window.__kqf__.getState().tasks.length
    return {
      ok: okRes.ok,
      msg: okRes.message,
      beforeTasks,
      afterTasks,
      beforeBalance,
      afterBalance,
    }
  })
  check('导入备份成功', roundTrip.ok === true, roundTrip.msg)
  check('导入后任务数一致', roundTrip.beforeTasks === roundTrip.afterTasks, `${roundTrip.beforeTasks} → ${roundTrip.afterTasks}`)
  check('导入后余额一致', roundTrip.beforeBalance === roundTrip.afterBalance, `${roundTrip.beforeBalance} → ${roundTrip.afterBalance}`)

  const badImport = await page.evaluate(async () => {
    const r = await window.__kqf__.importBackup({ nope: true })
    return r
  })
  check('拒绝非法备份文件', badImport.ok === false, badImport.message)

  /* ---- 脏分类不能把整页弄崩 ----
     `Task.category` 在**类型**上是联合类型，运行时不是：导入的备份
     （`validateBackup` 只校验结构，不逐个校验 category）或者更老的数据，
     都可能带着一个现在已经不存在的分类。
     以前渲染直接写 `CATEGORY[task.category]` → undefined →
     紧接着的 `cat.solid` 抛 TypeError → ErrorBoundary 把**整个任务页**换成崩溃页。
     一个字段不认识，代价是整页打不开。

     这层要证的是「页面还能用」，所以必须**真的切到任务页去看** ——
     只断言 store 里的数据没丢是不够的（数据一直在，崩的是渲染）。 */
  const cleanBackup = await page.evaluate(async () => window.__kqf__.exportBackup())

  const dirtyCat = await page.evaluate(async () => {
    const backup = await window.__kqf__.exportBackup()
    const dirty = JSON.parse(JSON.stringify(backup))
    // 所有任务的分类都改成不存在的值 —— 保证渲染路径一定被走到
    for (const t of dirty.data.tasks) t.category = 'dance-party'
    const r = await window.__kqf__.importBackup(dirty)
    await new Promise((res) => setTimeout(res, 600))
    return { ok: r.ok, msg: r.message, titles: dirty.data.tasks.map((t) => t.title) }
  })
  check('带脏分类的备份能导入', dirtyCat.ok === true, dirtyCat.msg)

  // 切回任务页（底部导航最后一个字是「任务」）
  await page.evaluate(async () => {
    const b = [...document.querySelectorAll('nav button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
    )
    b?.click()
    await new Promise((r) => setTimeout(r, 900))
  })

  const dirtyRender = await page.evaluate((titles) => {
    const body = document.body.innerText
    // 兜底分类到底有没有真的画出来 —— 找带「其他」语义的节点不如直接看颜色：
    // Tailwind 对写错的类名（比如 `bg-ink-400`，ink 没有 400 档）
    // 是**静默失败**的，类名照写、CSS 一个字节都不生成。
    // 所以这里读计算样式：兜底是中性色，背景必须是**不透明**的。
    // （这条比在单测里解析 theme.css 的令牌表更硬 ——
    //  它证明的是「浏览器里真的画出来了」。）
    const tiles = [...document.querySelectorAll('div[class*="surface"]')]
    const painted = tiles
      .map((el) => getComputedStyle(el).backgroundColor)
      .filter((c) => c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent')
    return {
      len: body.trim().length,
      rendered: titles.filter((t) => body.includes(t)).length,
      crashed: /哎呀，这里出了点小问题/.test(body),
      fallbackEmoji: body.includes('📌'),
      paintedBg: painted.length,
    }
  }, dirtyCat.titles)
  check(
    '脏分类不会把任务页弄崩（兜底成「其他」）',
    dirtyRender.len > 40 && !dirtyRender.crashed && dirtyRender.rendered > 0,
    `页面长度 ${dirtyRender.len}、渲染出 ${dirtyRender.rendered} 个任务、` +
      `崩溃页=${dirtyRender.crashed}、兜底图标 📌=${dirtyRender.fallbackEmoji}`,
  )
  check(
    '兜底分类的底色真的画出来了（类名不是静默失效的）',
    dirtyRender.paintedBg > 0,
    `${dirtyRender.paintedBg} 个卡片有不透明背景色`,
  )

  // 把干净备份导回去，别污染后面的用例
  const restored = await page.evaluate(async (backup) => {
    const r = await window.__kqf__.importBackup(backup)
    await new Promise((res) => setTimeout(res, 500))
    return r.ok
  }, cleanBackup)
  check('还原干净备份', restored === true)

  /* ============ 6. 签到 ============ */
  console.log('\n【6】签到任务 → 家长审核')
  // 签到以前是「孩子一点就发分」。开了家长审核后必须走：点签到 → 待审 → 家长确认 → 到账。
  // 断言要跟着行为走，别只把失败的那行删掉 —— 那样等于把这条链路测丢了。
  const checkInRes = await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    const task = s.tasks.find((t) => t.checkInEnabled)
    if (!task) return { err: 'no checkin task' }
    const before = s.balance

    // 1) 点签到
    const r = await s.doCheckIn(task.id)
    const afterSubmit = window.__kqf__.getState().balance

    // 2) 待审期间再点一次
    const again = await window.__kqf__.getState().doCheckIn(task.id)

    const st = window.__kqf__.getState()
    const rows = st.checkInProgress.filter((p) => p.taskId === task.id)
    const pendingDays = rows.flatMap((p) => p.pendingDays ?? [])
    const queueBefore = pendingDays.length

    // 3) 家长确认
    const pk = rows[0]?.periodKey
    const date = pendingDays[0]
    const gained = await window.__kqf__.getState().approveCheckIn(task.id, pk, date)
    const st2 = window.__kqf__.getState()
    const rows2 = st2.checkInProgress.filter((p) => p.taskId === task.id)

    return {
      basePoints: task.basePoints,
      before,
      submitGained: r.gained,
      afterSubmit,
      againGained: again.gained,
      pendingDays,
      queueBefore,
      gained,
      afterApprove: st2.balance,
      days: rows2.flatMap((p) => p.days),
      queueAfter: rows2.flatMap((p) => p.pendingDays ?? []).length,
    }
  })
  check(
    '签到先进入待审，当场不发积分',
    checkInRes.submitGained === 0 && checkInRes.afterSubmit === checkInRes.before,
    `${checkInRes.before} → ${checkInRes.afterSubmit}`,
  )
  check('待审签到出现在家长待办队列里', checkInRes.queueBefore === 1)
  check(
    '待审期间重复签到被拦截，不会攒出第二条',
    checkInRes.againGained === 0 && checkInRes.pendingDays.length === 1,
  )
  check(
    '家长确认后积分才到账',
    checkInRes.gained >= checkInRes.basePoints &&
      checkInRes.afterApprove === checkInRes.before + checkInRes.gained,
    `+${checkInRes.gained}（基础 ${checkInRes.basePoints}）`,
  )
  check(
    '确认后计入坚持天数并清空待办',
    checkInRes.days.length === 1 && checkInRes.queueAfter === 0,
    `days=${checkInRes.days.length} 待办=${checkInRes.queueAfter}`,
  )

  /* ============ 7. 收获二选一 + 每轮闸门（真实 DOM） ============ */
  //
  // 这一段**必须走真实点击**。store 级用例（`store/useApp.test.ts`）已经把闸门
  // 算术测穿了，但测不到：「弹层有没有真的弹出来」「按钮点了有没有反应」
  // 「弹层会不会被底部 TabBar 盖住」。历史上栽过的坑就是最后一条。
  //
  // 另外：**不要用「第一个写着『可以收啦』的地块」来定位** ——
  // 前面几段流程留下的成熟地块顺序不确定，会点到别的作物上。
  // 按 plots 数组下标点，才是确定的。
  console.log('\n【7】收获二选一：当场卖 / 收进背包（真实点击）')

  /** 关掉当前弹层（✕ 有 aria-label="关闭"） */
  async function closeSheet() {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '关闭',
      )
      b?.click()
    })
    await new Promise((r) => setTimeout(r, 400))
  }

  /** 点第 index 块地（网格里的直接子 button，顺序 == plots 顺序） */
  async function tapPlot(index) {
    return page.evaluate((i) => {
      const grid = document.querySelector('div.grid.grid-cols-3')
      if (!grid) return { ok: false, why: '找不到地块网格' }
      const tiles = [...grid.querySelectorAll(':scope > button')]
      if (!tiles[i]) return { ok: false, why: `第 ${i} 块地不存在（共 ${tiles.length} 块）` }
      const text = tiles[i].innerText.replace(/\s+/g, ' ').trim()
      tiles[i].click()
      return { ok: true, text }
    }, index)
  }

  /** 读第 index 块地的文案 */
  async function plotText(index) {
    return page.evaluate((i) => {
      const grid = document.querySelector('div.grid.grid-cols-3')
      const tiles = grid ? [...grid.querySelectorAll(':scope > button')] : []
      return tiles[i] ? tiles[i].innerText.replace(/\s+/g, ' ').trim() : ''
    }, index)
  }

  /**
   * 轮询等到地块显示「可以收啦」。
   *
   * ⚠️ **不能用固定 sleep。** 农场页靠 `useFarmTick(1000)` 每秒重渲染一次，
   * 种下后只等 900ms，有可能一次 tick 都没赶上 —— 地块还显示「还要 2 分钟」，
   * 于是点了个寂寞（第一版就是这么假失败的）。
   */
  async function waitMaturePlot(index, timeoutMs = 8000) {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      const text = await plotText(index)
      if (/可以收啦/.test(text)) return { ok: true, text }
      await new Promise((r) => setTimeout(r, 250))
    }
    return { ok: false, text: await plotText(index) }
  }

  /** 种一块地，并轮询等它真的成熟（时钟已经拧到 1200×） */
  async function plantMature(cropId) {
    const planted = await page.evaluate(
      async (id) => {
        const st = () => window.__kqf__.getState()
        const empty = st().plots.find((p) => p.unlocked && !p.crop)
        if (!empty) return { ok: false, why: '没有已解锁的空地' }
        return { ok: await st().plant(empty.index, id), index: empty.index }
      },
      cropId,
    )
    if (!planted.ok) return planted
    const ripe = await waitMaturePlot(planted.index)
    return { ok: ripe.ok, index: planted.index, text: ripe.text }
  }

  // 切到农场 Tab，关掉随机事件（让产量确定），把时钟拧快
  await page.evaluate(async () => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '农场',
    )
    b?.click()
    await new Promise((r) => setTimeout(r, 1200))
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
  })

  const prep = await plantMature('carrot')
  check('准备好一块成熟的地（1200× 时钟）', prep.ok === true, `plot=${prep.index}`)

  const tapped = await tapPlot(prep.index)
  check('点到的是成熟地块', tapped.ok === true && /可以收啦/.test(tapped.text ?? ''), tapped.text ?? tapped.why)
  await new Promise((r) => setTimeout(r, 700))

  const sheetText = await page.evaluate(() => document.body.innerText)
  check('弹出「收进背包」选项', /收进背包/.test(sheetText))
  check('弹出「当场卖掉」选项', /当场卖掉/.test(sheetText))
  check('弹层里说明了这一轮的额度', /这一轮还能卖/.test(sheetText))

  // 遮挡探针：弹层必须压过底部 TabBar。
  // 项目踩过这个坑 —— 外壳的 anim-fade 是层叠上下文，弹层不 Portal 就永远在上面。
  const occlusion = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /当场卖掉/.test(b.innerText))
    if (!btn) return { ok: false, why: '找不到按钮' }
    const r = btn.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return {
      ok: !!top && (top === btn || btn.contains(top)),
      why: top ? `${top.tagName}.${String(top.className).slice(0, 40)}` : 'null（没测到）',
      rect: `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}×${Math.round(r.height)}`,
    }
  })
  check('「当场卖掉」没有被别的层盖住', occlusion.ok, `${occlusion.rect} → 命中 ${occlusion.why}`)

  // ---- ① 当场卖掉：钱立刻到账 ----
  const sellRes = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    const before = st().harvestBalance
    const btn = [...document.querySelectorAll('button')].find((b) => /当场卖掉/.test(b.innerText))
    if (!btn) return { err: '找不到按钮' }
    btn.click()
    await new Promise((r) => setTimeout(r, 1000))
    return { before, after: st().harvestBalance }
  })
  check(
    '「当场卖掉」立刻结算丰收币',
    sellRes.after > sellRes.before,
    `丰收币 ${sellRes.before} → ${sellRes.after}`,
  )
  await closeSheet()

  // ---- ② 收进背包：不发钱，产出进背包 ----
  const prep2 = await plantMature('carrot')
  check('再准备一块成熟的地', prep2.ok === true, `plot=${prep2.index}`)
  await tapPlot(prep2.index)
  await new Promise((r) => setTimeout(r, 700))

  const storeRes = await page.evaluate(async (idx) => {
    const st = () => window.__kqf__.getState()
    const before = st().harvestBalance
    const itemsBefore = st().inventory.find((x) => x.itemId === 'produce-carrot')?.count ?? 0
    // 收割前后的额度 —— 用来验「额度有没有跟着地块一起蒸发」
    const capBefore = window.__kqf__.catalog.remainingCap('produce-carrot')
    const btn = [...document.querySelectorAll('button')].find((b) => /收进背包/.test(b.innerText))
    if (!btn) return { err: '找不到「收进背包」' }
    btn.click()
    await new Promise((r) => setTimeout(r, 1000))
    return {
      before,
      after: st().harvestBalance,
      gained: (st().inventory.find((x) => x.itemId === 'produce-carrot')?.count ?? 0) - itemsBefore,
      capBefore,
      capAfter: window.__kqf__.catalog.remainingCap('produce-carrot'),
      carry: st().quotaCarry['produce-carrot'] ?? 0,
      plotCrop: st().plots.find((p) => p.index === idx)?.crop ?? null,
    }
  }, prep2.index)
  check(
    '「收进背包」不发钱',
    storeRes.after === storeRes.before,
    `丰收币 ${storeRes.before} → ${storeRes.after}`,
  )
  check('「收进背包」产出进了背包', storeRes.gained > 0, `+${storeRes.gained} 个胡萝卜`)

  // ---- ②b 收进背包之后，没用完的额度不能跟着地块蒸发 ----
  //
  // 2026-09-15 由界面走查发现、这一层负责守住：闸门挂在**活着的**标的上，
  // 而胡萝卜是一次性作物，收完地块就变空地 → 标的消失 → 剩下那点额度
  // 跟着蒸发 → 存进背包的产出**永远卖不掉**，还提示「这一轮已经卖满啦」。
  // 而「收进背包」按钮上明写着「先存着，等市场上价格好的时候自己卖」。
  //
  // 判据用「收割前后剩余额度不该下降」，而不是「卖得出去就行」——
  // 后者会假通过：脚本前面在第 0/1 号地留着两块没割的胡萝卜（老 fixture），
  // 光靠它们的额度就够卖出钱，完全盖住了这个 bug。
  // 额度是问领域函数拿的，不在脚本里手算，免得算错变成假失败。
  check(
    '收完那块地真的空了（一次性作物不能被复活）',
    storeRes.plotCrop === null,
    `地块 ${prep2.index} → ${JSON.stringify(storeRes.plotCrop)}`,
  )
  check(
    '收割不会让剩余额度蒸发（没用完的结转了下来）',
    storeRes.capAfter >= storeRes.capBefore - 0.01 && storeRes.carry > 0,
    `额度 ${storeRes.capBefore.toFixed(2)} → ${storeRes.capAfter.toFixed(2)}，结转 ${storeRes.carry.toFixed(2)} 🌾`,
  )

  // ---- ③ 闸门：反复卖到卖不动，总额不能超过卖之前的剩余额度 ----
  // 期望值直接问领域函数（`remainingCap`），不在脚本里手算「成本 × 1.6 × 地块数」——
  // 手算要假设「有哪些地块、各自卖了没」，错一次就是假失败。
  const gate = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    const before = window.__kqf__.catalog.remainingCap('produce-carrot')

    let total = 0
    let rounds = 0
    for (let i = 0; i < 40; i++) {
      const got = await st().sellProduce('produce-carrot', 999)
      if (got <= 0) break
      total += got
      rounds++
    }
    return {
      total,
      rounds,
      before,
      after: window.__kqf__.catalog.remainingCap('produce-carrot'),
      left: st().inventory.find((x) => x.itemId === 'produce-carrot')?.count ?? 0,
    }
  })
  check('反复卖到卖不动（确实卖出去过）', gate.total > 0, `${gate.rounds} 轮共 ${gate.total.toFixed(2)} 🌾`)
  check(
    '总卖出额不超过卖之前的剩余额度',
    gate.total <= gate.before + 0.02,
    `卖出 ${gate.total.toFixed(2)} ≤ 卖前剩余 ${gate.before.toFixed(2)}`,
  )
  check(
    '卖出确实扣掉了额度（闸门记账生效）',
    gate.after < gate.before - 0.01,
    `剩余额度 ${gate.before.toFixed(2)} → ${gate.after.toFixed(2)}`,
  )

  // ---- ④ 家长把浮盈上限调到 40%，弹层里的额度要跟着变 ----
  const ratioPrep = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ profitRatio: 0.4 })
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    if (!empty) return { ok: false, why: '没有空地' }
    return { ok: await st().plant(empty.index, 'radish'), index: empty.index }
  })
  if (ratioPrep.ok) await waitMaturePlot(ratioPrep.index)
  // 期望值问领域函数，不在脚本里手算 —— 手算要假设「有哪些地块、各自卖了没」。
  // ⚠️ 弹层按 **0.1** 显示（`HarvestSheet` 的 `fmt`），这里必须用同一个口径，
  // 用 Math.round 去比会在 2.8 这种数上假失败。
  const ratioExpected = await page.evaluate(() =>
    Number(window.__kqf__.catalog.remainingCap('produce-radish').toFixed(1)),
  )
  check('调上限后种下一块小萝卜', ratioPrep.ok === true, `plot=${ratioPrep.index}`)

  const ratioTap = await tapPlot(ratioPrep.index)
  await new Promise((r) => setTimeout(r, 700))
  const shownRes = await page.evaluate(() => {
    const t = document.body.innerText
    const m = t.match(/这一轮还能卖\s*([\d.]+)/)
    return {
      shown: m ? Number(m[1]) : -1,
      sheetOpen: /收进背包/.test(t),
      tail: t.replace(/\s+/g, ' ').slice(-140),
    }
  })
  check(
    '上限调到 40% 后，弹层显示的额度 = 领域函数算出来的剩余额度',
    ratioTap.ok === true && shownRes.shown === ratioExpected,
    `tap=${ratioTap.ok ? 'ok' : (ratioTap.why ?? '?')} 点到的地=「${ratioTap.text ?? ''}」；` +
      `弹层${shownRes.sheetOpen ? '已开' : '没开'}；显示 ${shownRes.shown}，应为 ${ratioExpected}；末尾「${shownRes.tail}」`,
  )
  await closeSheet()

  // 还原设置，别污染后面的流程
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ profitRatio: 0.6, farmEventsEnabled: true })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1 } })
  })


  /* ============ 汇总 ============ */
  console.log('\n' + '─'.repeat(58))
  const failed = results.filter((r) => !r.ok)
  console.log(`通过 ${results.length - failed.length}/${results.length}`)
  if (errors.length) {
    console.log(`\n运行时报错 (${errors.length}):`)
    ;[...new Set(errors)].slice(0, 6).forEach((e) => console.log(`  ✗ ${e.slice(0, 180)}`))
  } else {
    console.log('控制台无错误 ✓')
  }
  process.exitCode = failed.length === 0 && errors.length === 0 ? 0 : 1
} catch (e) {
  console.error('\n执行失败:', e.message)
  process.exitCode = 3
} finally {
  await browser.close()
}
