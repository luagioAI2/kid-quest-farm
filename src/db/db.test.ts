import { beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  postLedger,
  currentBalance,
  addItem,
  consumeItem,
  DEFAULT_SETTINGS,
  currentMallBalance,
  postMall,
  spendMall,
} from '../db/db'

/* ============================================================
   持久层回归测试
   ------------------------------------------------------------
   覆盖独立审查中发现的并发/一致性问题，防止回归。
   ============================================================ */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('postLedger 原子性', () => {
  it('并发记账不会丢失积分', async () => {
    // 修复前：5 次并发 postLedger(+10) 全部读到同一个旧余额，
    // 结果账本 delta 合计 50，但余额只有 10。
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        postLedger({ delta: 10, source: 'task', memo: `并发 ${i}` }),
      ),
    )
    const balance = await currentBalance()
    const rows = await db.ledger.toArray()
    const sum = rows.reduce((a, r) => a + r.delta, 0)
    expect(balance).toBe(50)
    expect(sum).toBe(50)
    expect(rows).toHaveLength(5)
  })

  it('每条流水的 balanceAfter 与累计值一致', async () => {
    await Promise.all([
      postLedger({ delta: 20, source: 'task', memo: 'a' }),
      postLedger({ delta: -5, source: 'farm_plant', memo: 'b' }),
      postLedger({ delta: 7, source: 'checkin', memo: 'c' }),
    ])
    const rows = (await db.ledger.toArray()).sort((a, b) => a.createdAt - b.createdAt)
    let running = 0
    for (const r of rows) {
      running += r.delta
      expect(r.balanceAfter).toBe(running)
    }
    expect(await currentBalance()).toBe(running)
  })

  it('余额可以为负（超支）但账本仍自洽', async () => {
    await postLedger({ delta: 10, source: 'task', memo: 'in' })
    await postLedger({ delta: -30, source: 'farm_plant', memo: 'out' })
    expect(await currentBalance()).toBe(-20)
  })

  it('空账本时余额为 0', async () => {
    expect(await currentBalance()).toBe(0)
  })
})

describe('账本：同一毫秒的两笔不能接错余额', () => {
  it('显式传入同一个 createdAt，余额仍是两笔之和', async () => {
    // 回归：ledger 的 `createdAt` 是**非唯一索引**，并列时
    // `orderBy('createdAt').last()` 会退化成「按随机主键挑一条」——
    // 可能拿到**先写的那条**，余额就少算了，而且不报任何错。
    // 实测症状：签到的「基础分 8 + 阶梯奖 10」同毫秒入账时，余额只加了 8。
    await postLedger({ delta: 10, source: 'manual_adjust', memo: 'A', createdAt: 5000 })
    await postLedger({ delta: 5, source: 'manual_adjust', memo: 'B', createdAt: 5000 })

    expect(await currentBalance()).toBe(15)

    const rows = (await db.ledger.toArray()).sort((a, b) => a.createdAt - b.createdAt)
    // 时间戳被抬成严格递增，不再并列
    expect(new Set(rows.map((r) => r.createdAt)).size).toBe(rows.length)
    let running = 0
    for (const r of rows) {
      running += r.delta
      expect(r.balanceAfter).toBe(running)
    }
  })

  it('多笔并发记账：余额 = delta 之和，且时间戳两两不同', async () => {
    await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        postLedger({ delta: 3, source: 'task', memo: `并发 ${i}` }),
      ),
    )
    const rows = await db.ledger.toArray()
    expect(await currentBalance()).toBe(24)
    expect(await currentBalance()).toBe(rows.reduce((s, r) => s + r.delta, 0))
    expect(new Set(rows.map((r) => r.createdAt)).size).toBe(8)
  })
})

describe('背包操作', () => {
  it('加道具后能查到数量', async () => {
    await addItem('egg', 3)
    const row = await db.inventory.get('egg')
    expect(row?.count).toBe(3)
  })

  it('累加同一道具', async () => {
    await addItem('egg', 2)
    await addItem('egg', 3)
    expect((await db.inventory.get('egg'))?.count).toBe(5)
  })

  it('数量归零时删除记录', async () => {
    await addItem('egg', 2)
    await consumeItem('egg', 2)
    expect(await db.inventory.get('egg')).toBeUndefined()
  })

  it('道具不足时拒绝消耗', async () => {
    await addItem('egg', 1)
    expect(await consumeItem('egg', 5)).toBe(false)
    expect((await db.inventory.get('egg'))?.count).toBe(1)
  })

  it('负增量不会把数量做成负数', async () => {
    await addItem('egg', 1)
    await addItem('egg', -5)
    const row = await db.inventory.get('egg')
    expect(row === undefined || row.count >= 0).toBe(true)
  })
})

/* ============================================================
   背包的并发原子性
   ------------------------------------------------------------
   与上面 `postLedger 原子性` 同一族问题，只是当初漏了背包这一层：
   `addItem` / `consumeItem` 都是「先 get 再 put」，中间不原子。
   2026-09-21 实测（修之前）：
     并发 addItem ×3        -> count = 1（丢了 2 次）
     并发 consumeItem ×2（库存 1）-> 两次都成功（超卖）
   ============================================================ */
describe('背包并发原子性', () => {
  it('并发 addItem 不会丢更新', async () => {
    await Promise.all([addItem('egg', 1), addItem('egg', 1), addItem('egg', 1)])
    expect((await db.inventory.get('egg'))?.count).toBe(3)
  })

  it('并发 consumeItem 不会超卖（守卫不能被绕过）', async () => {
    await addItem('egg', 1)
    const results = await Promise.all([consumeItem('egg', 1), consumeItem('egg', 1)])
    // 关键：不是「数字对不上」，而是**守卫被绕过** —— 只有一个该成功
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await db.inventory.get('egg')).toBeUndefined()
  })

  it('并发加与减混合，结果等于净额', async () => {
    await addItem('egg', 10)
    await Promise.all([
      addItem('egg', 1),
      consumeItem('egg', 1),
      addItem('egg', 2),
      consumeItem('egg', 2),
    ])
    expect((await db.inventory.get('egg'))?.count).toBe(10)
  })
})

describe('唯一索引约束', () => {
  const base = {
    taskId: 'tk_1',
    periodKey: '2026-09-12',
    date: '2026-09-12',
    title: 'x',
    category: 'study' as const,
    cycle: 'daily' as const,
    plannedMinutes: 10,
    basePoints: 5,
    qualityBonusPoints: 0,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: false,
    rewardItemIds: [],
    status: 'pending' as const,
    createdAt: 0,
    updatedAt: 0,
  }

  it('同一任务同一周期同一天无法写入两条实例', async () => {
    await db.taskInstances.put({ ...base, id: 'ti_a' })
    let rejected = false
    try {
      await db.taskInstances.put({ ...base, id: 'ti_b' })
    } catch {
      rejected = true
    }
    expect(rejected).toBe(true)
    expect(await db.taskInstances.count()).toBe(1)
  })

  it('周期任务：同一周期内**不同日期**可以写入多条', async () => {
    // 回归：「本周要做 3 次」这类周期任务靠 checkInTargetCount 表达，
    // 需要同一个 (taskId, periodKey) 下有多行。v3 的 &[taskId+periodKey]
    // 让第二次提交直接抛 ConstraintError —— 种子任务「读一本完整的故事书」
    // （月度 4 次）开箱即踩，按钮卡在「记录中…」。
    const weekly = { ...base, periodKey: '2026-W37', cycle: 'weekly' as const }
    await db.taskInstances.put({ ...weekly, id: 'ti_1', date: '2026-09-08' })
    await db.taskInstances.put({ ...weekly, id: 'ti_2', date: '2026-09-09' })
    await db.taskInstances.put({ ...weekly, id: 'ti_3', date: '2026-09-10' })
    expect(await db.taskInstances.count()).toBe(3)
  })

  it('同一签到任务同一天无法重复记录', async () => {
    const base = {
      taskId: 'tk_1',
      date: '2026-09-12',
      periodKey: '2026-W37',
      points: 5,
      createdAt: 0,
    }
    await db.checkIns.put({ ...base, id: 'ci_a' })
    let rejected = false
    try {
      await db.checkIns.put({ ...base, id: 'ci_b' })
    } catch {
      rejected = true
    }
    expect(rejected).toBe(true)
    expect(await db.checkIns.count()).toBe(1)
  })
})

/* ============================================================
   ⚠️ 全局奖励值不许回到设置里
   ------------------------------------------------------------
   2026-10-12 家长连着两轮拍板：

   第一轮（删「值」）：
   > 「不需要全局设定梯度，连续的。 每个任务单独，有默认的就行了。」
   → `checkInTierRatio` / `streakBonusPerDay` / `streakBonusCap` 删掉。

   第二轮（删「连击总开关」）：
   > 「我是说家长设置里的删掉。 不需要在家长设置里设定。
   >   因为任务里已经可以单独设置了。」
   → `streakBonusEnabled` 也删掉（**连字段一起**，不只是控件）。

   现在这四个字段一个都不该在 `DEFAULT_SETTINGS` 里。它们只有两个来源：
   任务自己的字段，或者 `domain/` 里的默认常量。

   加这条测试是因为「加回去」看起来太无害了 —— 一个开关而已。
   但它的后果很具体：家长在任务编辑里设了 20%，发出去却按设置页那个
   他早就忘了的 80% 算，而且两处界面都显示得好好的。
   这是本项目最怕的那类 bug（界面看不到 ≠ 不会发生），所以钉死。

   `Settings` 类型上再加回字段会先被 `tsc` 拦下（`DEFAULT_SETTINGS`
   要补齐），这条测试是第二道闸 —— 专拦「顺手补个默认值就加回来了」。
   ============================================================ */
describe('全局奖励值已经被删掉（2026-10-12 家长拍板）', () => {
  it('★ 设置里不许再有这四个字段', () => {
    expect(
      'checkInTierRatio' in DEFAULT_SETTINGS,
      '阶梯倍率只在任务编辑里设，别加回设置页',
    ).toBe(false)
    expect(
      'streakBonusPerDay' in DEFAULT_SETTINGS,
      '连击「每天加几分」只在任务编辑里设',
    ).toBe(false)
    expect(
      'streakBonusCap' in DEFAULT_SETTINGS,
      '连击封顶只在任务编辑里设',
    ).toBe(false)
    expect(
      'streakBonusEnabled' in DEFAULT_SETTINGS,
      '连击不再有全局开关；要关某条任务就把它的「每连一天多给」设成 0',
    ).toBe(false)
  })
})

/* ============================================================
   钻石账本（第三套币，2026-10-14）
   ------------------------------------------------------------
   结构和商城币完全对称，所以这里只钉两件**独有**的事：
     ① 三套币互不可见（钻石不进积分、也不进商城币）；
     ② `spendMall` 的守卫在**事务里面** —— 并发扣款不能超支。
   ============================================================ */
describe('钻石账本', () => {
  it('余额 = 所有 delta 之和，且不串进积分 / 商城币', async () => {
    await postLedger({ delta: 100, source: 'task', memo: '积分' })
    await postMall({ delta: 30, source: 'manual_adjust', memo: '钻石' })
    expect(await currentMallBalance()).toBe(30)
    // 三张表各算各的：加了 30 钻石，积分余额一个数都不该动
    expect(await currentBalance()).toBe(100)
  })

  it('余额不够时一分不扣，也不留半条记录', async () => {
    await postMall({ delta: 30, source: 'manual_adjust', memo: '只有 30' })
    const ok = await spendMall(50, { source: 'game_purchase', refId: 'x', memo: '买 x' })
    expect(ok).toBe(false)
    expect(await currentMallBalance()).toBe(30)
    expect(await db.mallLedger.count()).toBe(1)
  })

  it('够的时候正常扣', async () => {
    await postMall({ delta: 100, source: 'manual_adjust', memo: '充值' })
    const ok = await spendMall(50, { source: 'game_purchase', refId: 'x', memo: '买 x' })
    expect(ok).toBe(true)
    expect(await currentMallBalance()).toBe(50)
  })

  it('★ 并发扣款不会超支（守卫和扣款在同一个事务里）', async () => {
    // 修复前的那种写法是「先读余额判断、再 postMall」—— 两次调用会
    // 各自读到同一个 100，于是**都**扣成功，余额变成 -20。
    // 和 `consumeItem` 的超卖是同一个事故（那边是库存 1 卖两次）。
    await postMall({ delta: 100, source: 'manual_adjust', memo: '充值' })
    const results = await Promise.all([
      spendMall(60, { source: 'game_purchase', refId: 'a', memo: '买 a' }),
      spendMall(60, { source: 'game_purchase', refId: 'b', memo: '买 b' }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await currentMallBalance()).toBe(40)
  })

  it('金额一律取整（和 postLedger / postHarvest 同口径）', async () => {
    await postMall({ delta: 10.4, source: 'manual_adjust', memo: '小数' })
    expect(await currentMallBalance()).toBe(10)
  })
})
