import { beforeEach, describe, expect, it } from 'vitest'
import { db, postLedger, currentBalance, addItem, consumeItem } from '../db/db'

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
