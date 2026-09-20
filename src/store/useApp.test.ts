import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addItem,
  currentBalance,
  currentHarvestBalance,
  db,
  DEFAULT_SETTINGS,
  loadSettings,
  postHarvest,
  postLedger,
  savePlots,
  setMeta,
} from '../db/db'
import {
  selectCheckInTasks,
  selectPendingCheckIns,
  selectTodayInstances,
  useApp,
} from './useApp'
import { currentDayKey } from '../domain/recurrence'
import { periodKeyFor } from '../domain/time'
import { capFor, CROP_BY_ID, priceCeilingFor } from '../domain/catalog'

/* ============================================================
   签到 / 长期任务的家长审核
   ------------------------------------------------------------
   回归的是同一个漏洞：孩子端「完成」这个动作以前会直接发积分，
   等于自己给自己发奖。普通任务早就走了审核，签到和长期任务没有。

   另一条回归：周期任务的唯一索引。v3 的 &[taskId+periodKey] 让
   「本月做 4 次」的第二次提交直接抛 ConstraintError，
   submitPeriodTask 的 await 炸掉 → 按钮永远停在「记录中…」。
   ============================================================ */

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

function todayKey() {
  return currentDayKey(useApp.getState().settings.dayStartHour)
}

function checkInTask() {
  const t = useApp.getState().tasks.find((x) => x.checkInEnabled)
  if (!t) throw new Error('种子里应该有签到任务')
  return t
}

function periodTask() {
  const t = useApp
    .getState()
    .tasks.find(
      (x) =>
        !x.checkInEnabled &&
        (x.cycle === 'weekly' || x.cycle === 'monthly' || x.cycle === 'yearly'),
    )
  if (!t) throw new Error('种子里应该有长期任务')
  return t
}

function progressRows(taskId: string) {
  return useApp.getState().checkInProgress.filter((p) => p.taskId === taskId)
}

beforeEach(async () => {
  await boot()
  await useApp.getState().updateSettings({ parentReviewEnabled: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('签到：家长审核', () => {
  it('开启审核时，签到只进入待审 —— 不发分、不计天数、不写记录', async () => {
    const task = checkInTask()
    const before = useApp.getState().balance
    const day = todayKey()

    await useApp.getState().doCheckIn(task.id)

    const s = useApp.getState()
    expect(s.balance).toBe(before) // 一分都没发
    expect(s.checkIns).toHaveLength(0) // 没写签到记录
    const rows = progressRows(task.id)
    expect(rows).toHaveLength(1)
    expect(rows[0].pendingDays ?? []).toContain(day)
    expect(rows[0].days).not.toContain(day) // 没算进坚持天数
  })

  it('待审期间重复点签到，不会攒出第二条待审', async () => {
    const task = checkInTask()
    await useApp.getState().doCheckIn(task.id)
    await useApp.getState().doCheckIn(task.id)
    expect(progressRows(task.id)[0].pendingDays ?? []).toHaveLength(1)
    expect(useApp.getState().checkIns).toHaveLength(0)
  })

  it('家长确认后才入账，并计入坚持天数', async () => {
    const task = checkInTask()
    const before = useApp.getState().balance
    const day = todayKey()

    await useApp.getState().doCheckIn(task.id)
    const pk = progressRows(task.id)[0].periodKey
    const gained = await useApp.getState().approveCheckIn(task.id, pk, day)

    // 第 1 天就够到阶梯「开了个好头」，所以到账 ≥ 基础分
    expect(gained).toBeGreaterThanOrEqual(task.basePoints)
    const s = useApp.getState()
    expect(s.balance).toBe(before + gained)
    expect(s.checkIns).toHaveLength(1)
    const row = progressRows(task.id)[0]
    expect(row.days).toContain(day)
    expect(row.pendingDays ?? []).not.toContain(day)
  })

  it('阶梯奖励也是确认时才发，提交那一刻账本一分不动', async () => {
    const task = checkInTask()
    const before = useApp.getState().balance

    await useApp.getState().doCheckIn(task.id)
    expect(useApp.getState().balance).toBe(before)
    expect(useApp.getState().ledger.filter((l) => l.source === 'checkin_bonus')).toHaveLength(0)

    const pk = progressRows(task.id)[0].periodKey
    await useApp.getState().approveCheckIn(task.id, pk, todayKey())

    expect(useApp.getState().ledger.filter((l) => l.source === 'checkin')).toHaveLength(1)
    expect(
      useApp.getState().ledger.filter((l) => l.source === 'checkin_bonus').length,
    ).toBeGreaterThan(0)
  })

  it('同一天重复确认不会重复发分', async () => {
    const task = checkInTask()
    const before = useApp.getState().balance
    const day = todayKey()
    await useApp.getState().doCheckIn(task.id)
    const pk = progressRows(task.id)[0].periodKey

    const first = await useApp.getState().approveCheckIn(task.id, pk, day)
    const afterFirst = useApp.getState().balance
    expect(afterFirst).toBe(before + first)

    const second = await useApp.getState().approveCheckIn(task.id, pk, day)
    expect(second).toBe(0)
    expect(useApp.getState().balance).toBe(afterFirst)
    expect(useApp.getState().checkIns).toHaveLength(1)
  })

  it('家长打回后，孩子可以重新签到', async () => {
    const task = checkInTask()
    const before = useApp.getState().balance
    const day = todayKey()

    await useApp.getState().doCheckIn(task.id)
    const pk = progressRows(task.id)[0].periodKey
    await useApp.getState().rejectCheckIn(task.id, pk, day)

    expect(progressRows(task.id)[0].pendingDays ?? []).not.toContain(day)
    expect(useApp.getState().balance).toBe(before)

    await useApp.getState().doCheckIn(task.id)
    expect(progressRows(task.id)[0].pendingDays ?? []).toContain(day)
  })

  it('待审签到会出现在家长的待办队列里', async () => {
    const task = checkInTask()
    expect(selectPendingCheckIns(useApp.getState())).toHaveLength(0)

    await useApp.getState().doCheckIn(task.id)

    const queue = selectPendingCheckIns(useApp.getState())
    expect(queue).toHaveLength(1)
    expect(queue[0].taskId).toBe(task.id)
    expect(queue[0].title).toBe(task.title)
    expect(queue[0].date).toBe(todayKey())
  })

  it('确认之后待办队列清空', async () => {
    const task = checkInTask()
    await useApp.getState().doCheckIn(task.id)
    const pk = progressRows(task.id)[0].periodKey
    await useApp.getState().approveCheckIn(task.id, pk, todayKey())
    expect(selectPendingCheckIns(useApp.getState())).toHaveLength(0)
  })

  it('关掉审核后，签到回到「一点就发」的老行为', async () => {
    await useApp.getState().updateSettings({ parentReviewEnabled: false })
    const task = checkInTask()
    const before = useApp.getState().balance

    await useApp.getState().doCheckIn(task.id)

    const s = useApp.getState()
    expect(s.balance).toBeGreaterThanOrEqual(before + task.basePoints)
    expect(s.checkIns).toHaveLength(1)
    expect(progressRows(task.id)[0].days).toContain(todayKey())
  })
})

describe('长期任务：家长审核', () => {
  it('提交后进入待审，一分不发', async () => {
    const task = periodTask()
    const before = useApp.getState().balance

    await useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, undefined)

    const s = useApp.getState()
    expect(s.balance).toBe(before)
    const pk = periodKeyFor(task.cycle, Date.now(), s.settings.dayStartHour)
    const rows = s.instances.filter((i) => i.taskId === task.id && i.periodKey === pk)
    expect(rows).toHaveLength(1)
    expect(rows[0].status).toBe('submitted')
  })

  /**
   * 回归：孩子自评的质量**只是给家长看的参考**，不决定发多少分。
   *
   * 事故背景：长期任务那张表原来让孩子自己选「一般 / 不错 / 特别棒」，
   * 而且「+N 分」的预览就摆在确认按钮上面 —— 孩子自己就能给自己定分，
   * 家长审核成了走过场。UI 已经删掉自评（见 `PeriodTask` 的
   * `OnceSubmitSheet`），这里再锁一道**存储层**的不变量：
   * 就算有人把自评 UI 加回来，分数也仍然由家长给的那个评级决定。
   */
  it('孩子自评「特别棒」但家长给「一般」→ 只拿基础分，没有质量奖励', async () => {
    const task = periodTask()
    expect(task.qualityRated).toBe(true) // 前提：这个任务本来是能拿质量奖励的
    expect(task.qualityBonusPoints).toBeGreaterThan(0)
    const before = useApp.getState().balance

    // 刻意复现旧版 UI 的调用形状：把自己的自评一起传进去
    await useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, 'great')

    const s = useApp.getState()
    const pk = periodKeyFor(task.cycle, Date.now(), s.settings.dayStartHour)
    const inst = s.instances.find((i) => i.taskId === task.id && i.periodKey === pk)
    if (!inst) throw new Error('应该有一条待审实例')
    expect(inst.status).toBe('submitted')
    // 自评存下来，只是给家长看的参考
    expect(inst.quality).toBe('great')
    // 但一分都没发
    expect(s.balance).toBe(before)

    // 家长给「一般」→ 基础分，没有质量奖励
    await useApp.getState().reviewInstance(inst.id, 'poor', task.plannedMinutes)
    expect(useApp.getState().balance - before).toBe(task.basePoints)
  })

  it('家长给「特别棒」→ 基础分 + 质量奖励（家长那一档才作数）', async () => {
    const task = periodTask()
    const before = useApp.getState().balance

    // 新版 UI 的形状：孩子只报用时，质量传 undefined
    await useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, undefined)

    const s = useApp.getState()
    const pk = periodKeyFor(task.cycle, Date.now(), s.settings.dayStartHour)
    const inst = s.instances.find((i) => i.taskId === task.id && i.periodKey === pk)
    if (!inst) throw new Error('应该有一条待审实例')
    expect(inst.quality).toBeUndefined()

    await useApp.getState().reviewInstance(inst.id, 'great', task.plannedMinutes)
    expect(useApp.getState().balance - before).toBe(
      task.basePoints + task.qualityBonusPoints,
    )
  })

  it('待审次数占位：交满目标次数后不再接受提交', async () => {
    const task = periodTask()
    const target = task.checkInTargetCount ?? 1
    const pk = periodKeyFor(task.cycle, Date.now(), useApp.getState().settings.dayStartHour)
    const rows = () =>
      useApp.getState().instances.filter((i) => i.taskId === task.id && i.periodKey === pk)

    // 每次换一天，才能记满 target 次（同一天只允许一条）
    vi.useFakeTimers({ toFake: ['Date'] })
    for (let i = 0; i < target; i++) {
      vi.setSystemTime(new Date(2026, 8, 8 + i, 12, 0, 0))
      await useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, undefined)
    }
    expect(rows()).toHaveLength(target)
    expect(rows().every((r) => r.status === 'submitted')).toBe(true)

    // 额度用尽，再交一次应该被挡住，而不是抛 ConstraintError
    vi.setSystemTime(new Date(2026, 8, 8 + target, 12, 0, 0))
    await expect(
      useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, undefined),
    ).resolves.toBe(0)
    expect(rows()).toHaveLength(target)
  })

  it('同一天重复记一次会被拦住，且不抛异常', async () => {
    // 回归：以前这里会抛 ConstraintError，异常一路冒到 handleOnce，
    // setBusy(false) 永远执行不到，按钮卡在「记录中…」。
    const task = periodTask()
    const pk = periodKeyFor(task.cycle, Date.now(), useApp.getState().settings.dayStartHour)

    await useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, undefined)
    await expect(
      useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, undefined),
    ).resolves.toBe(0)

    const rows = useApp.getState().instances.filter((i) => i.taskId === task.id && i.periodKey === pk)
    expect(rows).toHaveLength(1)
  })

  it('待审的格子会标记成 pending（不是空格子，也不是已完成）', async () => {
    const task = periodTask()
    await useApp.getState().submitPeriodTask(task.id, task.plannedMinutes, undefined)

    const units = useApp.getState().periodUnitsFor(task)
    expect(units.filter((u) => u.pending)).toHaveLength(1)
    expect(units.filter((u) => u.done)).toHaveLength(0)
  })
})

/* ============================================================
   兑换品管理：上架 / 下架 / 删除
   ------------------------------------------------------------
   回归的是「下架是单向门」这个漏洞：
   以前只有 archiveRedeemItem(id)，内部写死 archived: true。
   家长手滑下架一个兑换品之后，界面上再也找不到「上架」，
   只能删掉重加 —— 于是 id 变了，历史记录也跟着对不上。

   同时锁住删除的边界：删商品不能连坐兑换记录。
   ============================================================ */

describe('兑换品管理', () => {
  async function firstItem() {
    await useApp.getState().updateSettings({ redeemEnabled: true })
    const items = useApp.getState().allRedeemItems
    expect(items.length).toBeGreaterThan(0) // 种子里应该有一份默认清单
    return items[0]
  }

  const kidSideIds = () => useApp.getState().redeemItems.map((i) => i.id)
  const adminSideIds = () => useApp.getState().allRedeemItems.map((i) => i.id)

  it('下架：从孩子端消失，但管理端还在（不是被删了）', async () => {
    const it0 = await firstItem()

    await useApp.getState().setRedeemItemArchived(it0.id, true)

    expect(kidSideIds()).not.toContain(it0.id)
    expect(adminSideIds()).toContain(it0.id)
    expect(useApp.getState().allRedeemItems.find((i) => i.id === it0.id)?.archived).toBe(true)
  })

  it('上架：下架之后还能再回来（这条以前做不到）', async () => {
    const it0 = await firstItem()

    await useApp.getState().setRedeemItemArchived(it0.id, true)
    expect(kidSideIds()).not.toContain(it0.id)

    await useApp.getState().setRedeemItemArchived(it0.id, false)

    expect(kidSideIds()).toContain(it0.id)
    expect(useApp.getState().allRedeemItems.find((i) => i.id === it0.id)?.archived).toBe(false)
  })

  it('反复上下架不会把商品弄丢，也不会重复出现', async () => {
    const it0 = await firstItem()

    for (let i = 0; i < 3; i++) {
      await useApp.getState().setRedeemItemArchived(it0.id, true)
      await useApp.getState().setRedeemItemArchived(it0.id, false)
    }

    expect(adminSideIds().filter((id) => id === it0.id)).toHaveLength(1)
    expect(kidSideIds()).toContain(it0.id)
  })

  it('已下架的兑换品换不了 —— 就算绕过界面直接调 redeem', async () => {
    const it0 = await firstItem()
    await useApp.getState().setRedeemItemArchived(it0.id, true)

    const balanceBefore = useApp.getState().balance
    await expect(useApp.getState().redeem(it0.id)).resolves.toBe(false)

    expect(useApp.getState().balance).toBe(balanceBefore)
    expect(useApp.getState().redeemRecords).toHaveLength(0)
  })

  it('删除：孩子端和管理端都消失', async () => {
    const it0 = await firstItem()

    await useApp.getState().deleteRedeemItem(it0.id)

    expect(kidSideIds()).not.toContain(it0.id)
    expect(adminSideIds()).not.toContain(it0.id)
  })

  it('删除不会连坐兑换记录 —— 历史还在，待兑现的愿望也还在', async () => {
    const it0 = await firstItem()
    // 把价格压到 1 分，保证余额够换
    await useApp.getState().updateRedeemItem(it0.id, { cost: 1 })
    await expect(useApp.getState().redeem(it0.id)).resolves.toBe(true)

    const recordsBefore = useApp.getState().redeemRecords
    expect(recordsBefore).toHaveLength(1)

    await useApp.getState().deleteRedeemItem(it0.id)

    const recordsAfter = useApp.getState().redeemRecords
    expect(recordsAfter).toHaveLength(1)
    // 记录自带快照，所以商品没了也照样渲染得出来
    expect(recordsAfter[0].name).toBe(it0.name)
    expect(recordsAfter[0].emoji).toBe(it0.emoji)
    // 还没兑现 → 仍然挂在家长的待办上
    expect(recordsAfter[0].fulfilled).toBe(false)
  })

  it('删除后重新加一个同名的，是两条独立的记录（不会认错）', async () => {
    const it0 = await firstItem()
    await useApp.getState().deleteRedeemItem(it0.id)

    const again = await useApp.getState().addRedeemItem({
      name: it0.name,
      emoji: it0.emoji,
      category: it0.category,
      cost: it0.cost,
      createdByParent: true,
    })

    expect(again.id).not.toBe(it0.id)
    expect(adminSideIds().filter((id) => id === it0.id)).toHaveLength(0)
    expect(adminSideIds()).toContain(again.id)
  })
})

/* ============================================================
   首次启动的任务清单（家长指定的规格）
   ------------------------------------------------------------
   `domain/seedTasks.test.ts` 只证明「种子里写了什么」；
   这一层证明「它真的变成了孩子今天要做的事」——
   种子 → 实例 → 今日任务，中间哪一环断了这里都会红。

   注意：这里比对**集合**而不是顺序。今日任务的顺序取决于
   `createdAt`，而种子实例是同一批写进去的，顺序不该被当成契约
   （顺序的契约在 domain 那层守着）。
   ============================================================ */

describe('首次启动：今日任务', () => {
  const DAILY_TITLES = [
    '完成语文作业',
    '完成数学作业',
    '完成英语作业',
    '语文课外练习',
    '数学课外练习',
    '英语课外练习',
    '清理自己的房间',
  ]

  const todayTitles = () => selectTodayInstances(useApp.getState()).map((i) => i.title)

  it('7 个每日任务都生成了今天的实例', () => {
    expect([...todayTitles()].sort()).toEqual([...DAILY_TITLES].sort())
  })

  it('顺序就是种子里的顺序，不是随机的', () => {
    // 回归：以前按实例 createdAt 排，而种子实例是同一毫秒批量写入的，
    // createdAt 全打平 → 退化成「按随机主键排」，每台设备顺序都不同。
    // 这条断言连着跑几次都应该稳定通过。
    expect(todayTitles()).toEqual(DAILY_TITLES)
  })

  it('任务定义本身的顺序也是种子顺序（doRefresh 排过 tasks）', () => {
    const titles = useApp
      .getState()
      .tasks.filter((t) => t.cycle === 'daily')
      .map((t) => t.title)
    expect(titles).toEqual(DAILY_TITLES)
  })

  it('6 个学科任务的实例都是 45 分钟', () => {
    const study = selectTodayInstances(useApp.getState()).filter((i) => i.category === 'study')
    expect(study).toHaveLength(6)
    for (const i of study) expect(i.plannedMinutes, i.title).toBe(45)
  })

  it('签到任务不会混进今日任务（它们走「坚持签到」区块）', () => {
    const titles = todayTitles()
    for (const t of ['练字签到', '日记', '晨读']) expect(titles).not.toContain(t)
  })

  it('三个签到任务都能在「坚持签到」里找到', () => {
    const titles = selectCheckInTasks(useApp.getState()).map((t) => t.title)
    expect([...titles].sort()).toEqual(['晨读', '日记', '练字签到'].sort())
  })

  it('长期任务仍然是那两个，且没混进签到', () => {
    const period = useApp
      .getState()
      .tasks.filter(
        (t) => !t.checkInEnabled && ['weekly', 'monthly', 'yearly'].includes(t.cycle),
      )
      .map((t) => t.title)
    expect([...period].sort()).toEqual(['学会一项新本领', '读一本完整的故事书'].sort())
  })
})

/* ============================================================
   丰收币：不可逆约束 + 每轮闸门
   ------------------------------------------------------------
   ① 地基是「农场产出只能变成丰收币，丰收币再也回不去」。
      哪天有人把 postHarvest 改回 postLedger，或者写了
      `balance + harvestBalance` 去买种子，积分经济立刻变成闭环印钞机：
      10 → 16 → 26 → 41 → 66 …（每轮 2 分钟，1 小时能滚出上千万）。

   ② 闸门（用户 2026-09-15 锁定）：一个标的**每一轮**最多卖回
      `成本 × (1 + r)`。卖满就停，但种子永远能再买、地永远能再种。
      「直接卖」和「存背包后市场卖」共用**同一个额度** ——
      否则「先存起来」就成了绕过上限的后门。

   这组用例把这两件事一起钉住。
   ============================================================ */

describe('丰收币：不可逆约束 + 每轮闸门', () => {
  /**
   * 把积分余额校准到指定值（测试专用）。
   *
   * 注意：首次启动会发 50 启动积分（`seedIfEmpty` 里的「欢迎来到小任务农场」），
   * 所以**不能假设初始余额是 0**。补一笔差额比在每个用例里硬编码 50 更抗改动。
   */
  async function setBalanceTo(target: number) {
    const cur = await currentBalance()
    if (cur !== target) {
      await postLedger({ delta: target - cur, source: 'manual_adjust', memo: '测试校准余额' })
    }
    await useApp.getState().refresh()
  }

  /** 种下，并把它拨回 24 小时前，让它立刻成熟 */
  async function plantAndMature(cropId: string, plotIndex: number) {
    const ok = await useApp.getState().plant(plotIndex, cropId)
    expect(ok, `种 ${cropId} 应该成功`).toBe(true)
    const backdated = useApp
      .getState()
      .plots.map((p) =>
        p.index === plotIndex && p.crop
          ? { ...p, crop: { ...p.crop, plantedAt: Date.now() - 24 * 60 * 60 * 1000 } }
          : p,
      )
    await savePlots(backdated)
    await useApp.getState().refresh()
  }

  it('① 丰收币不进积分余额 —— 两张表物理隔离', async () => {
    const pointsBefore = await currentBalance()

    await postHarvest({ delta: 500, source: 'farm_harvest', memo: '测试注入' })
    await useApp.getState().refresh()

    expect(await currentBalance(), '积分一分都不该动').toBe(pointsBefore)
    expect(await currentHarvestBalance()).toBe(500)
    expect(useApp.getState().balance).toBe(pointsBefore)
    expect(useApp.getState().harvestBalance).toBe(500)
  })

  it('① 丰收币流水不会混进积分流水', async () => {
    const pointsRowsBefore = useApp.getState().ledger.length

    await postHarvest({ delta: 30, source: 'farm_market', memo: '测试注入' })
    await useApp.getState().refresh()

    expect(useApp.getState().ledger, '积分流水条数不该变').toHaveLength(pointsRowsBefore)
    expect(useApp.getState().harvestLedger).toHaveLength(1)
  })

  it('② 积分 0 时，丰收币再多也种不了地', async () => {
    await setBalanceTo(0)
    await postHarvest({ delta: 9999, source: 'farm_harvest', memo: '测试注入' })
    await useApp.getState().refresh()
    expect(useApp.getState().balance).toBe(0)
    expect(useApp.getState().harvestBalance).toBe(9999)

    const ok = await useApp.getState().plant(0, 'radish')

    expect(ok).toBe(false)
    // 一个丰收币都不许花出去
    expect(await currentHarvestBalance()).toBe(9999)
    expect(useApp.getState().plots.find((p) => p.index === 0)?.crop).toBeUndefined()
  })

  it('② 积分 0 时开不了新地块', async () => {
    await setBalanceTo(0)
    await postHarvest({ delta: 9999, source: 'farm_harvest', memo: '测试注入' })
    await useApp.getState().refresh()

    const target = useApp.getState().plots.find((p) => !p.unlocked && p.unlockCost > 0)
    if (!target) throw new Error('应该有需要积分才能开的地块')
    const ok = await useApp.getState().unlockPlot(target.index)

    expect(ok).toBe(false)
    expect(useApp.getState().plots.find((p) => p.index === target.index)?.unlocked).toBe(false)
    expect(await currentHarvestBalance()).toBe(9999)
  })

  it('② 积分 0 时领养不了动物', async () => {
    await setBalanceTo(0)
    await postHarvest({ delta: 9999, source: 'farm_harvest', memo: '测试注入' })
    await useApp.getState().refresh()

    const ok = await useApp.getState().buyAnimal('chicken', '小鸡')

    expect(ok).toBe(false)
    expect(useApp.getState().animals).toHaveLength(0)
    expect(await currentHarvestBalance()).toBe(9999)
  })

  it('③ 收获默认「存进背包」—— 不发积分，也不立刻结算丰收币', async () => {
    // 关掉随机事件：否则「绝收」分支会让这条用例偶尔变红
    await useApp.getState().updateSettings({ farmEventsEnabled: false })
    await setBalanceTo(50)

    await plantAndMature('radish', 0) // 种子 3 积分（B1 后 2 → 3）
    // ⚠️ 别把种子价写死：`2026-09-19` 改经济数值时，满篇硬编码的 2 / 3.2
    // 让十几条用例一起红 —— 数值本身没错，是断言写死了。能派生的都派生。
    expect(useApp.getState().balance).toBe(50 - CROP_BY_ID.get('radish')!.seedCost)

    const earned = await useApp.getState().harvest(0)

    expect(earned, '存背包这一步不结钱').toBe(0)
    expect(useApp.getState().balance, '收获不该发积分').toBe(
      50 - CROP_BY_ID.get('radish')!.seedCost,
    )
    expect(useApp.getState().harvestBalance, '还没卖，丰收币不该动').toBe(0)
    expect(
      useApp.getState().inventory.find((s) => s.itemId === 'produce-radish')?.count ?? 0,
      '产出应该进了背包',
    ).toBeGreaterThan(0)
  })

  it('③ 「直接卖」当场结算丰收币 —— 和存背包走同一个闸门', async () => {
    await useApp.getState().updateSettings({ farmEventsEnabled: false })
    await setBalanceTo(50)

    await plantAndMature('radish', 0)
    const before = useApp.getState().balance

    const earned = await useApp.getState().harvest(0, 'sell')

    expect(earned).toBeGreaterThan(0)
    expect(useApp.getState().balance, '收获不该发积分').toBe(before)
    expect(useApp.getState().harvestBalance).toBe(earned)
  })

  it('③ 市场卖出结的是丰收币，不是积分', async () => {
    // 闸门挂在「标的」上，所以必须真的种着东西才卖得出去
    await setBalanceTo(50)
    await plantAndMature('radish', 0)
    await addItem('produce-radish', 4)
    await useApp.getState().refresh()
    const before = useApp.getState().balance

    const total = await useApp.getState().sellProduce('produce-radish', 4)

    expect(total).toBeGreaterThan(0)
    expect(useApp.getState().balance, '卖产出不该发积分').toBe(before)
    expect(useApp.getState().harvestBalance).toBe(total)
  })

  /* ---------------- ④ 每轮闸门（用户 2026-09-15 锁定的核心约束） ---------------- */

  it('④ 闸门封顶：卖满「满产 × 整数单价」之后再卖就是 0', async () => {
    await setBalanceTo(50)
    await plantAndMature('radish', 0) // 满产 4 × 单价 1 → 上限 4（B1 前是 2 × 1.6 = 3.2）
    const cap = capFor('produce-radish')

    // 塞一大把产出，远超这一轮的上限
    await addItem('produce-radish', 100)
    await useApp.getState().refresh()

    const first = await useApp.getState().sellProduce('produce-radish', 100)
    expect(first).toBeGreaterThan(0)
    expect(first, '卖出总额不能被闸门放过').toBeLessThanOrEqual(cap + 0.01)

    // 这一轮已经卖满，再卖就一分钱都拿不到
    await addItem('produce-radish', 10)
    await useApp.getState().refresh()
    const again = await useApp.getState().sellProduce('produce-radish', 10)

    expect(again, '卖满之后不该再出钱').toBe(0)
    expect(useApp.getState().harvestBalance).toBeCloseTo(first, 5)
  })

  it('④ 闸门是「一轮」的：重新种下就重新开闸', async () => {
    await setBalanceTo(50)
    await plantAndMature('radish', 0)
    await addItem('produce-radish', 100)
    await useApp.getState().refresh()

    await useApp.getState().sellProduce('produce-radish', 100)
    const afterFirstRound = useApp.getState().harvestBalance
    expect(afterFirstRound).toBeGreaterThan(0)

    // 收掉这一轮（小萝卜是一次性作物，收完就变空地），再种一次
    await useApp.getState().harvest(0)
    await plantAndMature('radish', 0)
    await addItem('produce-radish', 100)
    await useApp.getState().refresh()

    const second = await useApp.getState().sellProduce('produce-radish', 100)
    expect(second, '新一轮应该能重新卖到钱').toBeGreaterThan(0)
    expect(useApp.getState().harvestBalance).toBeGreaterThan(afterFirstRound)
  })

  it('④ 「存起来等好价」不能绕过闸门 —— 两条路共用一个额度', async () => {
    await setBalanceTo(50)
    await plantAndMature('radish', 0) // 上限 4（满产 4 × 单价 1）

    // 先存进背包卖一点
    await addItem('produce-radish', 4)
    await useApp.getState().refresh()
    const stored = await useApp.getState().sellProduce('produce-radish', 4)
    expect(stored).toBeGreaterThan(0)

    // 再走「直接卖」，额度已经用掉一部分，两边加起来不能超过上限
    const cap = capFor('produce-radish')
    await addItem('produce-radish', 20)
    await useApp.getState().refresh()
    const direct = await useApp.getState().sellProduce('produce-radish', 20)

    expect(stored + direct).toBeLessThanOrEqual(cap + 0.01)
    expect(useApp.getState().harvestBalance).toBeCloseTo(stored + direct, 5)
  })

  it('④ 「全卖」不能因为背包不够而整笔失败（UI 传的是 99）', async () => {
    // 2026-09-15 由**第 4 层 E2E** 抓出来的真 bug：
    // maxSellable 按 99 个算出「能卖 4 个」，而背包只有 1 个 →
    // consumeItem 失败 → 整笔返回 0，连那 1 个也卖不掉。
    // 修法：进 maxSellable 之前先按背包实际数量夹一次。
    //
    // ⚠️ 背包数量必须**小于闸门允许的数量**，否则两边刚好相等，
    // 这条用例会「假通过」（第一次写就是踩了这个坑）。
    await setBalanceTo(50)
    await plantAndMature('radish', 0) // 闸门允许卖 4 个（上限 4 ÷ 单价 1）
    await addItem('produce-radish', 1)
    await useApp.getState().refresh()

    const total = await useApp.getState().sellProduce('produce-radish', 99)

    expect(total, '有多少卖多少，不能因为要得比有的多就一个都不卖').toBeGreaterThan(0)
    expect(
      useApp.getState().inventory.find((s) => s.itemId === 'produce-radish')?.count ?? 0,
      '背包里那 1 个应该被卖掉',
    ).toBe(0)
  })

  /**
   * 小萝卜的**基准单价**（与日期无关的那个价）。
   *
   * 闸门按**金额**封顶（`capFor` = 满产 × 整数单价 = 4 枚），而收获按**个数**给。
   * 两者在**单价**下刚好对齐（`4 个 × 1 = 4 枚`）——
   * 这正是 B1 要的性质：额度是单价的整数倍，一个都不剩。
   *
   * ⚠️ 2026-09-18 之后，基准价同时就是**现价硬顶**（`priceCeilingFor`）——
   * 行情再怎么涨也不会超过它。所以「拿基准价算前提」不再只是保守做法，
   * 而是**唯一可能的价**。见 `catalog.ts` 里 `priceCeilingFor` 的注释。
   */
  function radishBase(): number {
    return useApp.getState().market.quotes.find((q) => q.itemId === 'produce-radish')?.base ?? 0
  }

  /**
   * 把 `produce-radish` 的当日价钉回基准价（或基准价的指定倍数）。
   *
   * 为什么要钉：闸门是 4 **枚**，收获是 4 **个**。单价 1 时
   * `4 × 1 = 4` 刚好装满额度；可单价每天 ±22% 波动，今天 0.8 的话
   * `4 ÷ 0.8` 只买得走 5 个（够），今天 1.0 的话刚好 4 个（也够）——
   * 但**只要价格动了，这条用例的「能不能全卖掉」就取决于当天行情**。
   * 不钉住的话，用例会今天绿明天红，而代码一行都没动。
   * （2026-09-16 实测：同一份代码 09-15 绿、09-16 红，就是这个原因。）
   *
   * ⚠️ 必须在**最后一次 `refresh()` 之后**调用。
   * `refresh()` 内部会 `advanceMarket(await loadMarket(), day)` 把价格重算一遍，
   * 钉早了会被冲掉。
   */
  function pinRadishPrice(mult = 1) {
    const m = useApp.getState().market
    useApp.setState({
      market: {
        ...m,
        quotes: m.quotes.map((q) =>
          q.itemId === 'produce-radish'
            ? { ...q, prevPrice: q.price, price: q.base * mult, soldToday: 0 }
            : q,
        ),
      },
    })
  }

  it('④ 导出 → 导入 不能把「结转额度」清零（清零 = 死库存永久卖不掉）', async () => {
    // 2026-09-19 排查「背包里有一个萝卜却卖不掉」时挖出来的真 bug。
    //
    // 结转额度住在 `meta['farm.quotaCarry']` 里，而 `importBackup` 会
    // `db.meta.clear()` 再逐项写回 —— 写回清单里**没有这个 key**，
    // `exportBackup` 也从来没导出过它。于是「导出 → 导入」一次：
    // 一次性作物（小萝卜 / 胡萝卜）的地早就空了，额度**只挂在这里**，
    // 一清就没了 → `remainingCap` 归零 → `sellProduce` 直接返回 0
    // 并提示「这一轮已经卖满啦」。孩子看到的就是「背包里有一个萝卜，卖不掉」，
    // 而且**永久**卖不掉（不像「单卖烧额度」那种下一轮还能救）。
    //
    // 断言刻意分两层：先钉「额度数值回来了」，再钉「真的卖得掉」——
    // 孩子只看得到后者，只钉前者可能绿着而界面仍然是死的。
    await setBalanceTo(50)
    // 关掉灾害骰子：`wipedOut` 会让这一轮产出 0，用例就变成看天吃饭
    await useApp.getState().updateSettings({ farmEventsEnabled: false })
    await plantAndMature('radish', 0)
    await useApp.getState().harvest(0, 'store')
    await useApp.getState().refresh()

    expect(
      useApp.getState().plots[0].crop,
      '前提：一次性作物收完地应该空掉（额度才会挂到 quotaCarry 上）',
    ).toBeUndefined()
    const held =
      useApp.getState().inventory.find((s) => s.itemId === 'produce-radish')?.count ?? 0
    expect(held, '前提：收成要真的进背包（否则最后那条断言测不到东西）').toBeGreaterThan(0)
    const carryBefore = useApp.getState().quotaCarry['produce-radish'] ?? 0
    expect(carryBefore, '前提：收完地空了，额度应该结转出来').toBeGreaterThan(0)

    const backup = await useApp.getState().exportBackup()
    const res = await useApp.getState().importBackup(backup)
    expect(res.ok, res.message).toBe(true)

    expect(
      useApp.getState().quotaCarry['produce-radish'] ?? 0,
      '导入备份不能丢掉结转额度',
    ).toBeCloseTo(carryBefore, 5)

    const sold = await useApp.getState().sellProduce('produce-radish', 1)
    expect(sold, '导入之后背包里那批货必须还卖得掉').toBeGreaterThan(0)
  })

  it('④ 导出 → 导入 不能把背包清空（InventorySlot 的主键是 itemId，不是 id）', async () => {
    // 和上一条同源、但更狠：`importBackup` 里的 `pickArray` 硬写 `'id' in x`，
    // 而 `InventorySlot` 是 `{ itemId, count }` —— 没有 `id`。
    // 于是 `pickArray(d.inventory)` 恒为 null → `[]` → 前面刚 clear 过 →
    // **每次导入备份，整个背包（所有产出、收藏品）全部消失**。
    //
    // 为什么以前没被发现：`validateBackup` 用的是另一套规则
    // （`BACKUP_ID_ARRAY_FIELDS` 特意排除了 `inventory`，作者知道它没 id），
    // 校验放行 → 导入照常返回 `{ ok: true }` → 界面上只是「背包空了」，
    // 没有任何报错。E2E 的往返用例只对了 tasks 和余额，正好漏掉背包。
    await setBalanceTo(50)
    await addItem('produce-radish', 7)
    await addItem('produce-carrot', 3)
    await useApp.getState().refresh()

    const backup = await useApp.getState().exportBackup()
    const res = await useApp.getState().importBackup(backup)
    expect(res.ok, res.message).toBe(true)

    const inv = useApp.getState().inventory
    expect(
      inv.find((s) => s.itemId === 'produce-radish')?.count ?? 0,
      '导入备份不能把背包清空',
    ).toBe(7)
    expect(inv.find((s) => s.itemId === 'produce-carrot')?.count ?? 0).toBe(3)
  })

  it('④ 「收进背包」之后还能卖出去 —— 收完地空了也要认这笔账', async () => {
    // 2026-09-15 由**第 4 层界面走查**抓出来的真 bug。
    //
    // 「收进背包」按钮上写着「先存着，等市场上价格好的时候自己卖」，
    // 但闸门是挂在**活着的**地块上的（`capTargetsFor` 只看 plots/animals）。
    // 小萝卜 / 胡萝卜是**一次性作物**，收完 `crop` 就变 undefined → 地块变空地
    // → 该产出物再也找不到任何「标的」→ `remaining === 0`
    // → **存进背包的产出永远卖不掉**，还骗孩子说「这一轮已经卖满啦」。
    //
    // 也就是说：对开局最常用的两种作物，「二选一」里的第二条路是**死路**。
    // 这条用例就是钉住它别再退回去。
    await setBalanceTo(50)
    await plantAndMature('radish', 0)

    // 走「收进背包」这条路 —— 注意不是 addItem 硬塞，是真的收
    await useApp.getState().harvest(0, 'store')
    await useApp.getState().refresh()

    // ⚠️ 收完之后把背包**校准成恰好满产**，再往下断言。
    //
    // 收获数量是骰子给的：`min(满产, round(满产 × 灾害倍率 × 季节加成))`。
    // 灾害倍率 0.45~1.2，所以小萝卜一次能收 **0~4** 个 —— 2026-09-19 加了甲
    // 之后被满产封顶（B1 之前周末能收到 5 个，那正是「剩 1 个卖不掉」的来源）。
    // 但下界仍然是 0（1% 绝收），这条用例照样看天吃饭：
    // 抽到绝收时下面 `stored > 0` 那条前提就红了。
    //
    // 这条用例要证的是「收完地空了，结转过来的额度还认这笔账」，
    // 不是「骰子有多大」—— 所以按本文件 `④ 额度之外的货留在背包里` 的既有做法
    // **定量投放**，把骰子因素从前提里剔掉。地已经空了、额度已经结转，
    // 被钉住的那个 bug 依然会被覆盖到。
    await db.inventory.put({ itemId: 'produce-radish', count: 4 })
    await useApp.getState().refresh()

    const stored =
      useApp.getState().inventory.find((s) => s.itemId === 'produce-radish')?.count ?? 0
    expect(stored, '收获的产出应该进背包').toBeGreaterThan(0)
    expect(
      useApp.getState().plots[0].crop,
      '一次性作物收完地块应该变空（这正是触发 bug 的前提）',
    ).toBeUndefined()

    const base = radishBase()
    expect(base, '前提：取得到基准单价').toBeGreaterThan(0)
    const cap = capFor('produce-radish')
    pinRadishPrice() // 钉回基准价 —— 见上面的注释，不钉就是看天吃饭

    // **把前提写成断言**：这批货的价值得在额度内，「全卖掉」才是个成立的期望。
    // 否则哪天档位表调了、收获变成 5 个，这里会报成「卖不掉」，
    // 而真实原因其实是「本来就不该期望全卖掉」—— 报错会指错方向。
    expect(stored * base, '前提：这一批货的价值要在额度内').toBeLessThanOrEqual(cap + 0.01)

    const total = await useApp.getState().sellProduce('produce-radish', stored)

    expect(total, '存进背包的产出必须还能卖出去').toBeGreaterThan(0)
    expect(
      useApp.getState().inventory.find((s) => s.itemId === 'produce-radish')?.count ?? 0,
      '卖掉之后背包该清空（前提已断言：这一批在额度内）',
    ).toBe(0)
  })

  it('④ 额度之外的货留在背包里，不凭空蒸发（价钉到硬顶也一样）', async () => {
    // 上一条钉的是「额度够 → 全卖掉」。这条钉它的反面：**货比额度多**。
    //
    // ⚠️ 2026-09-18 改口径。原来是「行情贵的时候一轮卖不完」：现价硬顶写的是
    // `base × 1.6`，小萝卜的额度在 1.28 的价下只买得走 2 个。
    // 现在硬顶 = `上限回收 ÷ 满产`（家长：「最高市场价应该是成本 × 1.6，
    // 波动不能够超过它」），`满产 × 硬顶 = 上限回收` **恰好相等** ——
    // 也就是说**「贵到卖不完」这件事已经不可能发生了**，满产永远卖得掉。
    // 所以这条改成钉「价顶到硬顶时，额度之外的货仍然老老实实留在背包里」。
    //
    // 2026-09-19（B1）之后硬顶就是**整数单价**，小萝卜的 `ceilingFactor` 是 1
    // （硬顶 = 基准价）。这条仍然有意义：它钉的是「货比额度多」时**多出来的留在背包**。
    //
    // 前提故意**不用收获骰子**（改用 addItem 定量投放），
    // 这样「货比额度多」是构造出来的，不是碰巧的。
    await setBalanceTo(50)
    await plantAndMature('radish', 0) // 地还活着 → 闸门挂着
    await addItem('produce-radish', 6)
    await useApp.getState().refresh()

    const base = radishBase()
    expect(base, '前提：取得到基准单价').toBeGreaterThan(0)
    const cap = capFor('produce-radish')
    const ceilingFactor = priceCeilingFor('produce-radish') / base
    expect(ceilingFactor, '前提：硬顶不该低于基准价').toBeGreaterThanOrEqual(1 - 1e-9)
    pinRadishPrice(ceilingFactor)
    const price = base * ceilingFactor

    const total = await useApp.getState().sellProduce('produce-radish', 99)
    const left =
      useApp.getState().inventory.find((s) => s.itemId === 'produce-radish')?.count ?? 0
    const sold = 6 - left

    expect(total, '贵的时候也得卖得出去，只是卖得少').toBeGreaterThan(0)
    expect(total, '再贵也不能突破每轮上限').toBeLessThanOrEqual(cap + 0.01)
    expect(left, '上限之外的那部分必须还在背包里，不能蒸发').toBeGreaterThan(0)
    expect(
      sold,
      '卖得比额度允许的还少 = 提前收手了（报价是线性的，所以这是个下界）',
    ).toBeGreaterThanOrEqual(Math.floor(cap / price))
    // 钱和「少掉的个数」要对得上：不能扣了货不给钱，也不能给了钱不扣货。
    // ⚠️ 丰收币是**整数** —— `postHarvest` 里写着 `Math.round(entry.delta)`，
    //    所以上界必须留 0.5 的四舍五入余量（实测 2 个 × 1.285 = 2.57 → 记账 3）。
    //    下界的 6% 余量留着 —— 报价是线性的（现价 × 个数），本来就不该少，
    //    余量只是防将来给 `sellQuote` 加卖压衰减时这条断言变假失败。
    expect(total, '收到的钱不能明显多于 单价 × 卖掉个数').toBeLessThanOrEqual(sold * price + 0.5)
    expect(total, '也不能明显少于 单价 × 卖掉个数').toBeGreaterThan(sold * price * 0.94 - 0.5)
  })

  it('④ 收进背包不能变成「无限额度」—— 攒够一轮的上限就停', async () => {
    // 上一条把「能卖」修好之后，顺手守住反面：
    // 收进背包的额度是**从那一轮搬过来的**，不是凭空新开一个池子。
    // 小萝卜上限 4（满产 4 × 整数单价 1），攒多少轮都不该突破单轮上限。
    await setBalanceTo(50)
    await plantAndMature('radish', 0)
    await useApp.getState().harvest(0, 'store')
    await useApp.getState().refresh()

    // 硬塞一堆，远超单轮上限
    await addItem('produce-radish', 100)
    await useApp.getState().refresh()

    const total = await useApp.getState().sellProduce('produce-radish', 100)
    const cap = capFor('produce-radish')

    expect(total).toBeGreaterThan(0)
    expect(total, '收进背包不能把单轮上限顶开').toBeLessThanOrEqual(cap + 0.01)

    // ⚠️ 关键：**卖完要真的把结转额度扣掉**。
    // 作物已经离场，`capTargetsFor` 返回空数组，扣减只能落在结转上；
    // 不扣的话同一份额度能反复卖 —— 但只卖一次是看不出来的，
    // 必须再卖一次才会暴露（第一次写就是差点漏掉这条）。
    await addItem('produce-radish', 100)
    await useApp.getState().refresh()
    const again = await useApp.getState().sellProduce('produce-radish', 100)

    expect(again, '结转额度卖完就该归零，不能再卖').toBe(0)
  })

  it('④ 甲：产量封顶在「满产」—— 周末 / 节假日的加成不能顶过它', async () => {
    // 2026-09-19 修「背包里有一个萝卜却卖不掉」时加的甲（见 §6.1.2）。
    //
    // 季节加成最高 1.8（儿童节），`round(4 × 1.2 × 1.8) = 9` 个 ——
    // 而闸门只按**满产 4 个**配额度（`capFor = 满产 × 整数单价`），
    // 多出来的那几个永远卖不掉，烂在背包里。
    // 封顶之后加成变成「**倒霉的时候也能收满**」，闸门永远兜得住。
    //
    // ⚠️ 跑多轮是因为骰子每天都在变：只要**任何一轮**超过满产，这条就红。
    // 反过来，`maxSeen` 也必须能到满产 —— 否则「封顶」变成了「压死产量」，
    // 中性档（×0.92）的收成就永远凑不满，那是另一种坏法。
    await useApp.getState().updateSettings({ farmEventsEnabled: true })
    await setBalanceTo(1000)

    const def = CROP_BY_ID.get('radish')!
    const perHarvest = def.produceAmount ?? 1
    let maxSeen = 0

    const held = () =>
      useApp.getState().inventory.find((s) => s.itemId === 'produce-radish')?.count ?? 0

    for (let round = 1; round <= 16; round++) {
      await plantAndMature('radish', 0)
      const before = held()
      await useApp.getState().harvest(0, 'store')
      await useApp.getState().refresh()
      const got = held() - before

      expect(got, `第 ${round} 轮收了 ${got} 个，超过满产 ${perHarvest}`).toBeLessThanOrEqual(
        perHarvest,
      )
      expect(got, `第 ${round} 轮收了负数个`).toBeGreaterThanOrEqual(0)
      maxSeen = Math.max(maxSeen, got)
    }

    expect(
      maxSeen,
      '16 轮一次都没收满 —— 甲把产量压死了（加成本该还能把倒霉的日子补到满产）',
    ).toBe(perHarvest)
  })

  it('④ 收获之后地块该空就得空 —— 一次性作物不能被「复活」', async () => {
    // 2026-09-15 由界面走查顺手探出来的第二个真 bug（和上面那条同源）。
    //
    // `harvest` 把清干净的地块 `savePlots(nextPlots)` **只写了 DB，没写 store**。
    // 紧接着 `sellProduce` 读到的还是「作物还在」的旧快照，它自己也调
    // `savePlots`，于是把刚清干净的地块**又覆盖回去** ——
    // 实测收完仍是 `{cropId:'radish', harvestedCount:0}`：
    // 地块永远收不干净，`harvestedCount` 不前进，同一棵能反复收。
    //
    // 修法：`harvest` 里 `set({ plots: nextPlots })`，让 store 和 DB 同步。
    await setBalanceTo(50)
    await plantAndMature('radish', 0)

    await useApp.getState().harvest(0, 'sell')
    await useApp.getState().refresh()

    expect(
      useApp.getState().plots[0].crop,
      '一次性作物收完地块必须变空（否则一棵能收到天荒地老）',
    ).toBeUndefined()
  })
})

/* ============================================================
   新手引导的落库标记（onboardingDone）
   ------------------------------------------------------------
   这一条守的是「**别为了加一个设置字段去动 Dexie 版本**」。

   `loadSettings()` 是 `{...DEFAULT_SETTINGS, ...stored}` ——
   老库里没有的字段自动回落到默认值，所以加设置字段**不需要迁移**，
   也就没有「老用户升级后引导标记是 undefined」这一档事。

   危险动作是有人「顺手」把它改成 `return stored`（或者只挑几个字段拼），
   那时候老库读出来就是 `undefined` —— 标记是 falsy，老用户每次打开
   都会被重新问一遍名字和头像。下面第 2 条专门盯着这个。
   ============================================================ */
describe('新手引导：落库标记', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('默认状态是「没走过引导」', async () => {
    expect(DEFAULT_SETTINGS.onboardingDone).toBe(false)
    expect((await loadSettings()).onboardingDone).toBe(false)
  })

  it('老库缺这个字段 → 读出来是 false，不报错（加字段不需要迁移）', async () => {
    // 模拟「装过旧版本」的库：settings 里根本没有 onboardingDone 这个键
    const old: Record<string, unknown> = { ...DEFAULT_SETTINGS }
    delete old.onboardingDone
    await setMeta('settings', old)

    const loaded = await loadSettings()
    expect(loaded.onboardingDone, '缺字段必须回落到默认值 false').toBe(false)
    // 合并不能把别的字段冲掉
    expect(loaded.childName).toBe(DEFAULT_SETTINGS.childName)
  })

  it('写完能读回来（updateSettings 走的就是这条路）', async () => {
    await useApp.getState().updateSettings({ onboardingDone: true })

    expect((await loadSettings()).onboardingDone).toBe(true)
    expect(useApp.getState().settings.onboardingDone).toBe(true)
  })
})
