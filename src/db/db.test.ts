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
  it('同一任务同一周期无法写入两条实例', async () => {
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
