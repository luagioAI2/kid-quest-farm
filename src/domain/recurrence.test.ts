import { describe, expect, it } from 'vitest'
import { defaultTiers, claimableTiers, eachDay, computeStreak } from './recurrence'

/* ============================================================
   周期 / 签到阶梯 / 连击 测试
   ============================================================ */

describe('签到阶梯 defaultTiers', () => {
  it('正常目标：阶梯天数递增，且不重复', () => {
    const tiers = defaultTiers('weekly', 5)
    const days = tiers.map((t) => t.days)
    expect(days).toEqual([...days].sort((a, b) => a - b))
    expect(new Set(days).size).toBe(days.length)
    expect(days).toContain(5)
  })

  it('小目标被压平后，label 必须跟真实天数一致', () => {
    // 目标 2 天时，min(2,1)=1、min(2,3)=2、base=2 会撞成 1/2/2
    const tiers = defaultTiers('weekly', 2)
    for (const t of tiers) {
      expect(t.label).toBe(`坚持 ${t.days} 天`)
    }
  })

  it('小目标合并时保留奖励更高的那一档，而不是排前面的那档', () => {
    const tiers = defaultTiers('weekly', 2)
    const last = tiers.find((t) => t.days === 2)
    expect(last).toBeDefined()
    // 「一周坚持 2 天」带 sticker 道具，价值高于「坚持 3 天」的 30 分
    expect(last!.itemId).toBe('sticker')
  })

  it('目标为 1 天时不会产生重复天数', () => {
    const tiers = defaultTiers('weekly', 1)
    const days = tiers.map((t) => t.days)
    expect(new Set(days).size).toBe(days.length)
    expect(days).toEqual([1])
  })

  it('月 / 年周期同样保持天数唯一', () => {
    for (const cycle of ['monthly', 'yearly', 'daily'] as const) {
      const tiers = defaultTiers(cycle, 3)
      const days = tiers.map((t) => t.days)
      expect(new Set(days).size).toBe(days.length)
    }
  })
})

describe('阶梯领取 claimableTiers', () => {
  it('只有达标的未领取阶梯可领', () => {
    const tiers = [
      { days: 1, points: 10, label: '坚持 1 天' },
      { days: 3, points: 30, label: '坚持 3 天' },
      { days: 5, points: 60, label: '坚持 5 天' },
    ]
    expect(claimableTiers(tiers, 3, []).map((t) => t.days)).toEqual([1, 3])
    expect(claimableTiers(tiers, 3, [1]).map((t) => t.days)).toEqual([3])
    expect(claimableTiers(tiers, 5, [1, 3, 5])).toEqual([])
  })
})

describe('eachDay', () => {
  it('包含两端', () => {
    expect([...eachDay('2026-03-01', '2026-03-03')]).toEqual([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
    ])
  })

  it('跨月跨年正确', () => {
    const days = [...eachDay('2025-12-30', '2026-01-02')]
    expect(days).toEqual(['2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'])
  })

  it('起点晚于终点返回空', () => {
    expect([...eachDay('2026-03-05', '2026-03-01')]).toEqual([])
  })

  it('区间超过 10 年时抛错，而不是静默截断', () => {
    expect(() => [...eachDay('2000-01-01', '2026-01-01')]).toThrow(/超过/)
  })
})

describe('连击 computeStreak', () => {
  it('今天完成则从今天往前数', () => {
    expect(computeStreak(['2026-03-01', '2026-03-02', '2026-03-03'], '2026-03-03')).toBe(3)
  })

  it('今天没完成但昨天完成，连击仍然有效', () => {
    expect(computeStreak(['2026-03-01', '2026-03-02'], '2026-03-03')).toBe(2)
  })

  it('中断过久则归零', () => {
    expect(computeStreak(['2026-03-01'], '2026-03-05')).toBe(0)
  })

  it('空记录为 0', () => {
    expect(computeStreak([], '2026-03-05')).toBe(0)
  })
})
