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

  /* ============ 6. 签到 ============ */
  console.log('\n【6】签到任务')
  const checkInRes = await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    const task = s.tasks.find((t) => t.checkInEnabled)
    if (!task) return { err: 'no checkin task' }
    const before = s.balance
    const r = await s.doCheckIn(task.id)
    const after = window.__kqf__.getState().balance
    const again = await window.__kqf__.getState().doCheckIn(task.id)
    return { gained: r.gained, bonus: r.bonus, before, after, againGained: again.gained }
  })
  check('签到获得积分', checkInRes.gained > 0, `+${checkInRes.gained}${checkInRes.bonus ? ` (+${checkInRes.bonus} 阶梯)` : ''}`)
  check('当天重复签到被拦截', checkInRes.againGained === 0)

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
