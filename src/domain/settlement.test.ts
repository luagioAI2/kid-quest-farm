import { describe, expect, it } from 'vitest'
import { settle, settleTask, gradeReaches, OVERTIME_ZERO_MULTIPLIER } from './settlement'
import type { QualityGrade } from './types'

/* ============================================================
   结算引擎测试 —— 逐条对照需求
   ============================================================ */

const base = {
  plannedMinutes: 30,
  basePoints: 20,
  qualityBonusPoints: 10,
  qualityRated: true,
  allowOvertime: true,
  allowLateNoPenalty: false,
}

describe('按时完成 → 全额积分', () => {
  it('正好用完计划时间也是全额', () => {
    const r = settle({ ...base, actualMinutes: 30 })
    expect(r.points).toBe(20)
    expect(r.overtime).toBe(false)
    expect(r.zeroed).toBe(false)
  })

  it('提前完成仍是全额，不做额外加成', () => {
    const r = settle({ ...base, actualMinutes: 12 })
    expect(r.points).toBe(20)
    expect(r.overtime).toBe(false)
  })

  it('零分钟（立刻完成）也是全额', () => {
    const r = settle({ ...base, actualMinutes: 0 })
    expect(r.points).toBe(20)
  })
})

describe('超时但未超一倍 → 按超时比例结算', () => {
  it('超出 25%（30→37.5分钟）得 75% 基础分', () => {
    const r = settle({ ...base, actualMinutes: 37.5 })
    expect(r.overtime).toBe(true)
    expect(r.zeroed).toBe(false)
    // decay = 2 - 1.25 = 0.75 → round(20*0.75) = 15
    expect(r.points).toBe(15)
  })

  it('超出 50%（45分钟）得 50% 基础分', () => {
    const r = settle({ ...base, actualMinutes: 45 })
    expect(r.points).toBe(10)
  })

  it('超出 90%（57分钟）得 10% 基础分', () => {
    const r = settle({ ...base, actualMinutes: 57 })
    expect(r.points).toBe(2)
  })

  it('刚好 59.9 分钟仍有分（未到一倍）', () => {
    const r = settle({ ...base, actualMinutes: 59.9 })
    expect(r.zeroed).toBe(false)
    expect(r.points).toBeGreaterThan(0)
  })
})

describe('时间超出一倍 → 无积分', () => {
  it('正好一倍（60分钟）归零', () => {
    const r = settle({ ...base, actualMinutes: 60 })
    expect(r.zeroed).toBe(true)
    expect(r.zeroReason).toBe('overtime_limit')
    expect(r.points).toBe(0)
  })

  it('超过一倍（90分钟）归零', () => {
    const r = settle({ ...base, actualMinutes: 90 })
    expect(r.points).toBe(0)
    expect(r.zeroed).toBe(true)
  })

  it('阈值常量就是一倍', () => {
    expect(OVERTIME_ZERO_MULTIPLIER).toBe(2)
  })
})

describe('严格限时任务：allowOvertime = false', () => {
  it('超时 1 分钟就归零', () => {
    const r = settle({ ...base, allowOvertime: false, actualMinutes: 31 })
    expect(r.points).toBe(0)
    expect(r.zeroed).toBe(true)
  })

  it('没超时仍是全额', () => {
    const r = settle({ ...base, allowOvertime: false, actualMinutes: 30 })
    expect(r.points).toBe(20)
  })
})

describe('免扣分任务：超期不扣分', () => {
  const task = { ...base, allowLateNoPenalty: true, plannedMinutes: 30, basePoints: 15 }

  it('超时 10 倍也不扣分', () => {
    const r = settle({ ...task, actualMinutes: 300 })
    expect(r.points).toBe(15)
    expect(r.zeroed).toBe(false)
    expect(r.overtime).toBe(true)
  })

  it('完全没记录用时也不扣分', () => {
    const r = settle({ ...task, actualMinutes: undefined })
    expect(r.points).toBe(15)
    expect(r.zeroed).toBe(false)
  })
})

describe('质量加分', () => {
  it('质量达标时叠加在基础分之上', () => {
    const r = settle({ ...base, actualMinutes: 20, quality: 'great' })
    // 20 基础 + 10 质量
    expect(r.points).toBe(30)
  })

  it('质量不达标（poor）不加分', () => {
    const r = settle({ ...base, actualMinutes: 20, quality: 'poor' })
    expect(r.points).toBe(20)
  })

  it('未评质量则不加分', () => {
    const r = settle({ ...base, actualMinutes: 20, quality: undefined })
    expect(r.points).toBe(20)
  })

  it('质量加分在超时衰减时依然保留（两个维度独立）', () => {
    const r = settle({ ...base, actualMinutes: 45, quality: 'great' })
    // 基础衰减到 10，质量 10 全额保留
    expect(r.points).toBe(20)
    expect(r.overtime).toBe(true)
  })

  it('超时归零时质量分仍然保留', () => {
    const r = settle({ ...base, actualMinutes: 90, quality: 'great' })
    expect(r.points).toBe(10)
    expect(r.zeroed).toBe(true)
  })

  it('关闭 qualityRated 后即使评了质量也不加分', () => {
    const r = settle({ ...base, qualityRated: false, actualMinutes: 20, quality: 'great' })
    expect(r.points).toBe(20)
  })

  it('阈值设为 great 时 ok 不加分', () => {
    const r = settle({
      ...base,
      actualMinutes: 20,
      quality: 'ok',
      qualityBonusThreshold: 'great',
    })
    expect(r.points).toBe(20)
  })

  it('阈值设为 great 时 great 加分', () => {
    const r = settle({
      ...base,
      actualMinutes: 20,
      quality: 'great',
      qualityBonusThreshold: 'great',
    })
    expect(r.points).toBe(30)
  })
})

describe('没有计时记录', () => {
  it('未开始时无基础分', () => {
    const r = settle({ ...base, actualMinutes: undefined })
    expect(r.points).toBe(0)
    expect(r.zeroed).toBe(true)
    expect(r.zeroReason).toBe('not_returned')
  })

  it('未计时但质量达标仍给质量分', () => {
    const r = settle({ ...base, actualMinutes: undefined, quality: 'great' })
    expect(r.points).toBe(10)
  })
})

describe('边界与健壮性', () => {
  it('积分永不为负', () => {
    const r = settle({ ...base, actualMinutes: 1000, basePoints: 0 })
    expect(r.points).toBeGreaterThanOrEqual(0)
  })

  it('计划时长 0 时不会除零崩溃', () => {
    const r = settle({ ...base, plannedMinutes: 0, actualMinutes: 5 })
    expect(Number.isFinite(r.points)).toBe(true)
    expect(r.points).toBeGreaterThanOrEqual(0)
  })

  it('负的 basePoints 被规整为 0', () => {
    const r = settle({ ...base, basePoints: -100, actualMinutes: 10 })
    expect(r.points).toBe(0)
  })

  it('浮点误差不会误判超时（30.00000001）', () => {
    const r = settle({ ...base, actualMinutes: 30.00000001 })
    expect(r.overtime).toBe(false)
  })

  it('积分取整', () => {
    const r = settle({ ...base, actualMinutes: 37, plannedMinutes: 30 })
    expect(Number.isInteger(r.points)).toBe(true)
  })

  it('总是给出可读的 reason 文案', () => {
    for (const mins of [5, 30, 45, 60, 200, undefined]) {
      const r = settle({ ...base, actualMinutes: mins })
      expect(r.reason.length).toBeGreaterThan(0)
    }
  })
})

describe('全局开关', () => {
  it('overtimeEnabled = false 时超时也全额', () => {
    const r = settle({ ...base, actualMinutes: 200, overtimeEnabled: false })
    expect(r.points).toBe(20)
    expect(r.zeroed).toBe(false)
  })

  it('overtimeEnabled = false 不影响严格限时任务（仍归零）', () => {
    const r = settle({
      ...base,
      allowOvertime: false,
      actualMinutes: 40,
      overtimeEnabled: false,
    })
    // 关闭全局衰减时，严格任务也不该再惩罚（归一为"今天不扣分"）
    expect(r.points).toBe(20)
  })
})

describe('gradeReaches', () => {
  it('great 达到 great 阈值', () => {
    expect(gradeReaches('great', 'great')).toBe(true)
  })
  it('ok 达不到 great 阈值', () => {
    expect(gradeReaches('ok', 'great')).toBe(false)
  })
  it('great 达到 ok 阈值', () => {
    expect(gradeReaches('great', 'ok')).toBe(true)
  })
  it('poor 连 ok 都达不到', () => {
    expect(gradeReaches('poor', 'ok')).toBe(false)
  })
})

describe('settleTask 便捷入口', () => {
  it('与底层 settle 结果一致', () => {
    const task = {
      plannedMinutes: 20,
      basePoints: 30,
      qualityBonusPoints: 10,
      allowOvertime: true,
      allowLateNoPenalty: false,
      qualityRated: true,
    }
    const quality: QualityGrade = 'great'
    const viaTask = settleTask(task, 25, quality)
    const viaSettle = settle({
      plannedMinutes: 20,
      actualMinutes: 25,
      basePoints: 30,
      qualityBonusPoints: 10,
      quality,
      qualityRated: true,
      allowOvertime: true,
      allowLateNoPenalty: false,
    })
    expect(viaTask.points).toBe(viaSettle.points)
    expect(viaTask.reason).toBe(viaSettle.reason)
  })
})

/* ---------------- 场景化验收：需求原文的几个例子 ---------------- */

describe('场景：完成语文作业', () => {
  const chinese = {
    plannedMinutes: 30,
    basePoints: 20,
    qualityBonusPoints: 8,
    qualityRated: true,
    allowOvertime: true,
    allowLateNoPenalty: false,
  }

  it('30 分钟内完成 → 20 分', () => {
    expect(settle({ ...chinese, actualMinutes: 28 }).points).toBe(20)
  })

  it('45 分钟完成（超 50%）→ 10 分', () => {
    expect(settle({ ...chinese, actualMinutes: 45 }).points).toBe(10)
  })

  it('60 分钟完成（超一倍）→ 0 分', () => {
    expect(settle({ ...chinese, actualMinutes: 60 }).points).toBe(0)
  })

  it('40 分钟且质量优秀 → 衰减基础分 + 质量分', () => {
    // ratio = 40/30 = 1.333 → decay = 0.667 → round(20*0.667)=13, +8 = 21
    const r = settle({ ...chinese, actualMinutes: 40, quality: 'great' })
    expect(r.points).toBe(21)
  })
})
