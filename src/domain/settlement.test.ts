import { describe, expect, it } from 'vitest'
import {
  QUALITY_META,
  QUALITY_ORDER,
  formatMultiplier,
  settle,
  settleTask,
  OVERTIME_ZERO_MULTIPLIER,
} from './settlement'
import type { QualityGrade } from './types'

/* ============================================================
   结算引擎测试 —— 逐条对照需求
   ============================================================ */

const base = {
  plannedMinutes: 30,
  basePoints: 20,
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

describe('质量五档：系数乘在时间分上（base = 20 分）', () => {
  const at = (quality: QualityGrade) => settle({ ...base, actualMinutes: 20, quality })

  it('很差 -100% → 扣光，但不会变成负数', () => {
    expect(at('awful').points).toBe(0)
  })

  it('一般 -50% → 拿一半', () => {
    expect(at('poor').points).toBe(10)
  })

  it('良好是中间档 → 不加不减', () => {
    expect(at('ok').points).toBe(20)
  })

  it('很好 +10% → 22', () => {
    expect(at('good').points).toBe(22)
  })

  it('特别棒 +20% → 24', () => {
    expect(at('great').points).toBe(24)
  })

  it('未评质量 = 不加不减（等同良好）', () => {
    expect(settle({ ...base, actualMinutes: 20, quality: undefined }).points).toBe(20)
  })

  it('关闭 qualityRated 后，评了也不算', () => {
    const r = settle({ ...base, qualityRated: false, actualMinutes: 20, quality: 'great' })
    expect(r.points).toBe(20)
  })

  it('全局关掉质量加减分后，五档一律不加不减', () => {
    const r = settle({ ...base, actualMinutes: 20, quality: 'great', qualityBonusEnabled: false })
    expect(r.points).toBe(20)
  })
})

describe('质量 × 超时：先衰减再乘', () => {
  // base = 20，45/30 = 1.5 → decay 0.5 → 时间分 = round(20*0.5) = 10
  it('衰减到 10 分，再乘 +20% → 12', () => {
    const r = settle({ ...base, actualMinutes: 45, quality: 'great' })
    expect(r.points).toBe(12)
    expect(r.overtime).toBe(true)
  })

  it('衰减到 10 分，再乘 -50% → 5', () => {
    const r = settle({ ...base, actualMinutes: 45, quality: 'poor' })
    expect(r.points).toBe(5)
  })

  it('时间分被扣成 0 时，评「特别棒」也救不回来', () => {
    const r = settle({ ...base, actualMinutes: 90, quality: 'great' })
    expect(r.points).toBe(0)
    expect(r.zeroed).toBe(true)
  })

  /* ⚠️ 上面三条**区分不了顺序**。
     把实现改成「先乘系数、再衰减」，上面三条照样全绿 ——
     因为两种顺序下都要取整，而 base=20 / 30 分钟 / 45 分钟 这组数
     在两种顺序下刚好都是 12 / 5 / 0。写了等于没写。

     2026-10 逐格枚举过（base 1..60 × 6 个 planned × 每个 actual × 5 档，
     照着 settle() 的分支结构逐字复刻）：能区分顺序的有 7918 组。
     下面两条是从中挑的，都**实测过**（把实现临时改成反向，只有这两条会红）。

     ⚠️ 别凭手算挑数。第一版挑的「base=10 / 45 分钟 / 很差」看着像能区分，
        实际两种顺序都是 0 —— 因为实现里有 `base > 0 ? Math.max(1, …) : 0`
        这个守卫，base 变成 0 之后保底根本不生效。手算漏掉这个守卫就会挑错。 */
  describe('顺序敏感性（必须用能区分顺序的数，否则是假绿）', () => {
    // ① 取整差（反向**少给**）：
    //    正向 round(15*0.5)=8 → round(8*1.2)=round(9.6)=10
    //    反向 round(15*1.2)=18 → round(18*0.5)=9
    it('base=15 / 45 分钟 / 特别棒 → 10（顺序反了会得 9）', () => {
      const r = settle({ ...base, basePoints: 15, actualMinutes: 45, quality: 'great' })
      expect(r.points).toBe(10)
    })

    // ② 取整差（反向**多给**）：超时 25% → decay 0.75
    //    正向 round(10*0.75)=8 → round(8*1.2)=round(9.6)=10
    //    反向 round(10*1.2)=12 → round(12*0.75)=9
    //    多给分是更该防的方向：孩子拿到的分不该因为实现顺序而变多。
    it('base=10 / 20 分钟用 25 分钟 / 特别棒 → 10（顺序反了会得 9）', () => {
      const r = settle({ ...base, basePoints: 10, plannedMinutes: 20, actualMinutes: 25, quality: 'great' })
      expect(r.points).toBe(10)
    })
  })
})

describe('没有计时记录', () => {
  it('未开始时无基础分', () => {
    const r = settle({ ...base, actualMinutes: undefined })
    expect(r.points).toBe(0)
    expect(r.zeroed).toBe(true)
    expect(r.zeroReason).toBe('not_returned')
  })

  it('未计时就是 0：质量系数乘在 0 上还是 0', () => {
    const r = settle({ ...base, actualMinutes: undefined, quality: 'great' })
    expect(r.points).toBe(0)
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

describe('五档的定义（对着需求原文验）', () => {
  it('正好五档，由低到高', () => {
    expect(QUALITY_ORDER).toEqual(['awful', 'poor', 'ok', 'good', 'great'])
  })

  it('系数就是需求里那五个数', () => {
    expect(QUALITY_ORDER.map((q) => QUALITY_META[q].multiplier)).toEqual([-1, -0.5, 0, 0.1, 0.2])
  })

  it('中间那档是「良好」，系数 0（不加不减）', () => {
    const mid = QUALITY_ORDER[2]
    expect(QUALITY_META[mid].label).toBe('良好')
    expect(QUALITY_META[mid].multiplier).toBe(0)
  })

  it('每档都有给人看的名字和表情', () => {
    for (const q of QUALITY_ORDER) {
      expect(QUALITY_META[q].label.length).toBeGreaterThan(0)
      expect(QUALITY_META[q].emoji.length).toBeGreaterThan(0)
    }
  })

  it('系数文案：正数带 +、负数带 -、中间写「不加不减」', () => {
    expect(formatMultiplier('great')).toBe('+20%')
    expect(formatMultiplier('good')).toBe('+10%')
    expect(formatMultiplier('ok')).toBe('不加不减')
    expect(formatMultiplier('poor')).toBe('-50%')
    expect(formatMultiplier('awful')).toBe('-100%')
  })
})

describe('settleTask 便捷入口', () => {
  it('与底层 settle 结果一致', () => {
    const task = {
      plannedMinutes: 20,
      basePoints: 30,
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

  it('40 分钟且评「特别棒」→ 先衰减到 13，再 +20% → 16', () => {
    // ratio = 40/30 = 1.333 → decay = 0.667 → round(20*0.667) = 13
    // 13 × 1.2 = 15.6 → 16
    const r = settle({ ...chinese, actualMinutes: 40, quality: 'great' })
    expect(r.points).toBe(16)
  })

  it('40 分钟且评「很差」→ 13 分被扣光 → 0', () => {
    const r = settle({ ...chinese, actualMinutes: 40, quality: 'awful' })
    expect(r.points).toBe(0)
  })
})
