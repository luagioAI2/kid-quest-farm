import { describe, expect, it } from 'vitest'
import {
  checkInStreak,
  checkInStreakBonus,
  checkInStreakIfSigned,
  defaultTiers,
  claimableTiers,
  eachDay,
  computeStreak,
} from './recurrence'

/* ============================================================
   周期 / 签到阶梯 / 连击 测试
   ============================================================ */

describe('签到阶梯 defaultTiers', () => {
  it('周档是 2 / 6 / 12 —— 2026-10-09 家长要求把「太多了」的奖励压小', () => {
    /* 原来 10 / 30 / 60：一周光阶梯就 100 分，是基础分（5×5=25）的 4 倍，
       签到比正课还赚。压小后阶梯合计 20 分，**比基础分还少**。
       家长原话：「尽可能按之前的设计，只是之前的奖励太多了。」 */
    const tiers = defaultTiers('weekly', 5)
    expect(tiers.map((t) => t.days)).toEqual([1, 3, 5])
    expect(tiers.map((t) => t.points)).toEqual([2, 6, 12])

    // 结构没动：还是三档、还是 1:3:6 的比例，只改了量级
    const [a, b, c] = tiers.map((t) => t.points)
    expect(b / a).toBe(3)
    expect(c / a).toBe(6)
  })

  it('周档的阶梯合计比一周的基础分还少（收入以基础分为主）', () => {
    const basePoints = 5
    const target = 5
    const tierTotal = defaultTiers('weekly', target).reduce((n, t) => n + t.points, 0)
    expect(tierTotal).toBeLessThan(basePoints * target)
  })

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

/* ============================================================
   签到连击（**任务内**的，和全局 computeStreak 是两回事）
   ------------------------------------------------------------
   家长原话：「每次基本分是5分。连续+1」→ 第 N 天 = 基础分 + (N-1)。
   ============================================================ */

describe('签到连击 checkInStreak', () => {
  it('连着签 3 天 → 3', () => {
    expect(checkInStreak(['2026-10-05', '2026-10-06', '2026-10-07'], '2026-10-07')).toBe(3)
  })

  it('中间断一天 → 只数断点之后（「断了就重新」）', () => {
    // 5、6 签了，7 没签，8 签了 → 连击从 8 重新开始
    expect(checkInStreak(['2026-10-05', '2026-10-06', '2026-10-08'], '2026-10-08')).toBe(1)
  })

  it('当天没签 → 0（不往前找，和全局 computeStreak 的「留缓冲」不一样）', () => {
    expect(checkInStreak(['2026-10-05', '2026-10-06'], '2026-10-07')).toBe(0)
  })

  it('跨月也连得上', () => {
    expect(checkInStreak(['2026-09-30', '2026-10-01'], '2026-10-01')).toBe(2)
  })

  it('输入乱序不影响结果', () => {
    expect(checkInStreak(['2026-10-07', '2026-10-05', '2026-10-06'], '2026-10-07')).toBe(3)
  })

  it('空数组 → 0', () => {
    expect(checkInStreak([], '2026-10-07')).toBe(0)
  })
})

describe('连击加成 checkInStreakBonus', () => {
  it('第 1 天没有加成，第 N 天加 N-1（基础分 5）', () => {
    expect(checkInStreakBonus(1, 5)).toBe(0)
    expect(checkInStreakBonus(2, 5)).toBe(1)
    expect(checkInStreakBonus(3, 5)).toBe(2)
    expect(checkInStreakBonus(5, 5)).toBe(4)
  })

  it('封顶 = 一次的基础分（家长：「连击应该很难超过单次分」）', () => {
    // 一周最多签 7 天 → 加成本该是 6，比基础分 5 还大 —— 所以必须封顶
    expect(checkInStreakBonus(6, 5)).toBe(5)
    expect(checkInStreakBonus(7, 5)).toBe(5)
    expect(checkInStreakBonus(100, 5)).toBe(5)
  })

  it('加成永远不超过单次基础分（全档位扫一遍）', () => {
    for (let streak = 1; streak <= 30; streak++) {
      for (const base of [1, 3, 5, 10, 20]) {
        expect(checkInStreakBonus(streak, base)).toBeLessThanOrEqual(base)
      }
    }
  })

  it('基础分是 0 时没有加成（乘不出来，也不该凭空给分）', () => {
    expect(checkInStreakBonus(5, 0)).toBe(0)
  })

  it('一周打满 5 天 = 5+6+7+8+9 = 35 分', () => {
    let total = 0
    for (let day = 1; day <= 5; day++) {
      total += 5 + checkInStreakBonus(day, 5)
    }
    expect(total).toBe(35)
  })
})

describe('checkInStreakIfSigned（界面上「今天签下去能拿多少」）', () => {
  it('今天已签 → 就是当前连击', () => {
    expect(checkInStreakIfSigned(['2026-10-05', '2026-10-06'], '2026-10-06')).toBe(2)
  })

  it('昨天签了、今天还没签 → 昨天那条 +1', () => {
    expect(checkInStreakIfSigned(['2026-10-05', '2026-10-06'], '2026-10-07')).toBe(3)
  })

  it('昨天也没签 → 从 1 重新开始', () => {
    expect(checkInStreakIfSigned(['2026-10-05'], '2026-10-07')).toBe(1)
  })

  it('一天都没签过 → 1（今天签就是第 1 天）', () => {
    expect(checkInStreakIfSigned([], '2026-10-07')).toBe(1)
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
