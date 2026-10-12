import { describe, expect, it } from 'vitest'
import {
  checkInCapacity,
  checkInPayout as checkInPayoutRaw,
  checkInSupported,
  defaultTiers,
  claimableTiers,
  eachDay,
  computeStreak,
  isCheckInTask,
  isPeriodTask,
} from './recurrence'
import { DEFAULT_TIER_RATIO, MAX_TIER_RATIO, MIN_TIER_RATIO } from './tierRatio'

/* ============================================================
   周期 / 签到阶梯 / 连击 测试
   ============================================================ */

/**
 * 下面这 10 个用例测的是 base / 连击 / 阶梯**机制**，倍率固定用默认档。
 *
 * `checkInPayout` 的第五个参数（阶梯倍率）是**必填**的 —— 故意不给默认值，
 * 逼每个调用点显式想一下「这里该传哪个倍率」，否则「预览用 80%、实发用
 * 家长设的 20%」会静默分叉。所以测试里包一层，别让 10 个用例都被同一个
 * 参数淹没。倍率本身的行为在 `阶梯倍率` 那一组里单独测（那里直连原函数）。
 */
const checkInPayout = (
  task: Parameters<typeof checkInPayoutRaw>[0],
  days: string[],
  claimed: number[],
  date: string,
) => checkInPayoutRaw(task, days, claimed, date)

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
    // 「一周坚持 2 天」带 sticker 道具，价值高于「坚持 3 天」那档的 6 分
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

  /* ---- 2026-09-30：月 / 年档和基础分脱钩（家长：「月年每次（单次完成）的积分也是一样的」）---- */

  it('三档永远是「每份 ×1 / ×3 / ×6」，每份 = 0.8×基础分×目标天数 / 10', () => {
    for (const [cycle, target, base] of [
      ['weekly', 5, 5],
      ['monthly', 20, 15],
      ['yearly', 60, 50],
      ['daily', 3, 5],
    ] as const) {
      const unit = Math.max(1, Math.round((0.8 * base * target) / 10))
      for (const t of defaultTiers(cycle, target, base)) {
        expect(
          [1, 3, 6],
          `${cycle}/${target}/base${base} 出现 ${t.points} 分，不是每份 ${unit} 的整数倍`,
        ).toContain(t.points / unit)
      }
    }
  })

  it('阶梯总量 ≤ 每完成一次 0.8×基础分 —— 月 / 年不再有脱钩的巨款（原来 400 / 5000）', () => {
    /* 改之前：月档 target=5、base=15 时第三档给 400 分，
       是单次基础分的 26 倍；年档更是 5000。签到比正课还赚几十倍。 */
    for (const [cycle, target, base] of [
      ['weekly', 5, 5],
      ['monthly', 5, 15],
      ['monthly', 20, 15],
      ['yearly', 6, 50],
      ['yearly', 60, 50],
      ['daily', 3, 5],
    ] as const) {
      const total = defaultTiers(cycle, target, base).reduce((n, t) => n + t.points, 0)
      const budget = Math.round(0.8 * base * target)
      expect(total, `${cycle} target=${target} base=${base}：${total} > ${budget}`).toBeLessThanOrEqual(
        budget,
      )
    }
  })

  it('周档没变：base 5 / target 5 仍然精确是 2 / 6 / 12', () => {
    // 公式 0.8×5×5/10 = 2，和上一版写死的数字一致 —— 这条钉住「没被顺手改坏」
    expect(defaultTiers('weekly', 5, 5).map((t) => t.points)).toEqual([2, 6, 12])
  })

  it('基础分变大时阶梯跟着按比例走（不再是写死的绝对数）', () => {
    const low = defaultTiers('weekly', 5, 5).reduce((n, t) => n + t.points, 0)
    const high = defaultTiers('weekly', 5, 20).reduce((n, t) => n + t.points, 0)
    expect(high).toBe(low * 4) // 基础分 ×4 → 阶梯 ×4
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
   签到**没有**连击奖励（2026-10-11 家长定）
   ------------------------------------------------------------
   家长原话：「签到 只需要阶梯奖励(可以设置倍率)。但是长期任务
   这种次数的可以有连续奖励(连击奖励)。不能两种同时都有。」

   原来这里有三组用例测「任务内连击」（checkInStreak /
   checkInStreakBonus / checkInStreakIfSigned）。那三个函数连同奖励
   一起删掉了，所以用例也一起删 —— 测一个已经不存在的行为，
   只会让人以为它还活着。连击现在只属于长期任务，见 `isPeriodTask`。
   ============================================================ */

describe('签到不发连击：口径只能有一种', () => {
  it('★ 连签 5 天，到账里也找不出任何「连击」成分', () => {
    // 签到卡上原来写着「连续第 N 天（今天连击 +N）」。
    // 家长说签到只留阶梯 —— 所以哪怕连着签，到账也只有基础分 + 阶梯。
    const weekly = { basePoints: 5, cycle: 'weekly' as const, checkInTargetCount: 5 }
    const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08']
    const p = checkInPayout(weekly, days, [1, 3], '2026-10-09')
    // 第 5 天：基础 5 + 阶梯 12（第 5 档）= 17，没有第 5 天该有的「连击 +4」
    expect(p.base).toBe(5)
    expect(p.tierPoints).toBe(12)
    expect(p.total, '到账 = 基础 + 阶梯，一个连击分都不许有').toBe(17)
    expect(Object.keys(p).sort()).toEqual(['base', 'tierLabel', 'tierPoints', 'tiers', 'total'])
  })
})

describe('一次签到发多少分 checkInPayout（发分与展示的唯一事实源）', () => {
  const weekly = { basePoints: 5, cycle: 'weekly' as const, checkInTargetCount: 5 }

  it('首日 = 基础 5 + 阶梯 2 = 7（审核卡原来写 5、实发 7，就是这个 bug）', () => {
    const p = checkInPayout(weekly, [], [], '2026-10-05')
    expect(p.base).toBe(5)
    expect(p.tierPoints).toBe(2)
    expect(p.total).toBe(7)
  })

  it('第 2 天不落在阶梯日 → 只有基础 5（签到没有连击加成）', () => {
    const p = checkInPayout(weekly, ['2026-10-05'], [1], '2026-10-06')
    expect(p.tierPoints).toBe(0)
    expect(p.total).toBe(5)
  })

  it('第 3 天：基础 5 + 阶梯 6 = 11', () => {
    const p = checkInPayout(weekly, ['2026-10-05', '2026-10-06'], [1], '2026-10-07')
    expect(p.tierLabel).toBe('坚持 3 天')
    expect(p.total).toBe(11)
  })

  it('阶梯看的是**累计天数**，断一天照样算 —— 和连击不一样', () => {
    // 签了 10-05，跳过 10-06，10-07 再签 → 累计第 2 天。
    // 要是按「连续」算，这天只能是第 1 天，阶梯就永远差一档。
    const p = checkInPayout(weekly, ['2026-10-05'], [1], '2026-10-07')
    expect(p.tierPoints, '累计第 2 天还没到第 3 档，所以是 0').toBe(0)
    const p2 = checkInPayout(weekly, ['2026-10-05', '2026-10-07'], [1], '2026-10-09')
    expect(p2.tierLabel, '累计第 3 天 → 该发第 3 档了').toBe('坚持 3 天')
    expect(p2.tierPoints).toBe(6)
  })

  it('连签 7 天也只有「基础 + 阶梯」，没有额外的连击分', () => {
    const days = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06']
    const p = checkInPayout(weekly, days, [1, 3, 5], '2026-10-07')
    expect(p.total, '第 7 天：基础 5，阶梯都领过了 → 5').toBe(5)
  })

  it('已经领过的阶梯不再重复发', () => {
    const p = checkInPayout(weekly, [], [1], '2026-10-05')
    expect(p.tiers).toEqual([])
    expect(p.total).toBe(5)
  })

  it('total 永远等于 base + tierPoints', () => {
    const claimed = [1, 3, 5]
    let days: string[] = []
    for (const key of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      const p = checkInPayout(weekly, days, claimed, key)
      expect(p.total).toBe(p.base + p.tierPoints)
      days = [...days, key].sort()
    }
  })

  it('一周打满 5 天合计 45 分 —— 和 seedTasks 里的平衡锚点对得上', () => {
    /* 7 + 5 + 11 + 5 + 17 = 45。这个数字同时写在 seedTasks.ts 的注释里，
       是「签到收入回到基础分为主」的唯一依据；改了阶梯就必须同步改它。
       ⚠️ 2026-10-11 去掉签到连击后，这个锚点从 55 掉到 45（少了 10 分连击）。
       ⚠️ claimed 必须**边领边长**：一开始就塞满 [1,3,5] 的话阶梯一分不发，
       合计会变成 25（只有基础分），而那个数看着也「挺合理」，很容易蒙混过去。 */
    let claimed: number[] = []
    let days: string[] = []
    let sum = 0
    for (const key of ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09']) {
      const p = checkInPayout(weekly, days, claimed, key)
      sum += p.total
      claimed = [...claimed, ...p.tiers.map((t) => t.days)]
      days = [...days, key].sort()
    }
    expect(sum).toBe(45)
    expect(claimed.sort((a, b) => a - b)).toEqual([1, 3, 5])
  })

  it('不改动传进来的数组（store 依赖这一点：算完还要拿 progress.days 去写库）', () => {
    const days = ['2026-10-06', '2026-10-05']
    const claimed = [1]
    checkInPayout(weekly, days, claimed, '2026-10-07')
    expect(days).toEqual(['2026-10-06', '2026-10-05'])
    expect(claimed).toEqual([1])
  })

  it('basePoints 为 0 时到账就是 0（不凭空长分）', () => {
    const p = checkInPayout(
      { basePoints: 0, cycle: 'weekly', checkInTargetCount: 5 },
      ['2026-10-05', '2026-10-06'],
      [1, 3, 5],
      '2026-10-07',
    )
    expect(p.total).toBe(0)
  })
})

describe('阶梯倍率真的进了算式（2026-10-10 家长要求「阶梯分设置」）', () => {
  const ladderTotal = (ratio: number) =>
    defaultTiers('weekly', 5, 5, ratio).reduce((n, t) => n + t.points, 0)

  it('默认倍率下周档仍是 2 / 6 / 12 —— 老库升上来行为一字不变', () => {
    expect(defaultTiers('weekly', 5, 5, DEFAULT_TIER_RATIO).map((t) => t.points)).toEqual([
      2, 6, 12,
    ])
  })

  it('倍率 = 「每完成一次给基础分的多少倍」：0.8 → 合计 20（0.8 × 5 × 5）', () => {
    expect(ladderTotal(0.8)).toBe(20)
    expect(ladderTotal(0.4)).toBe(10)
    expect(ladderTotal(1.0)).toBe(30)
    expect(ladderTotal(1.5)).toBe(40)
  })

  it('倍率调低 → 阶梯变小（家长要的就是这个方向）', () => {
    const high = ladderTotal(DEFAULT_TIER_RATIO)
    const low = ladderTotal(MIN_TIER_RATIO)
    expect(low).toBeLessThan(high)
    // 下限在**最小的任务**上也要真的动 —— 一动不动就是界面在骗人
    expect(low).toBe(10)
  })

  it('倍率越界时按夹取后的值算，不会算出负数或 0 分档', () => {
    // 传 0 / 负数会被夹到 MIN，不是「不发分」
    expect(ladderTotal(0)).toBe(ladderTotal(MIN_TIER_RATIO))
    expect(ladderTotal(-5)).toBe(ladderTotal(MIN_TIER_RATIO))
    expect(ladderTotal(99)).toBe(ladderTotal(MAX_TIER_RATIO))
    // 每一档都 ≥ 1：界面上永远不出现「+0」
    for (const r of [0, 0.2, 0.5, 0.8, 1.5, 99]) {
      for (const t of defaultTiers('weekly', 5, 5, r)) {
        expect(t.points, `ratio=${r} 的 ${t.days} 天档是 ${t.points} 分`).toBeGreaterThan(0)
      }
    }
  })

  it('checkInPayout 跟着倍率走 —— 发分与展示共用的就是这一份', () => {
    const weekly = { basePoints: 5, cycle: 'weekly' as const, checkInTargetCount: 5 }
    /* ⚠️ 2026-10-12 起倍率**只能挂在任务上**（`checkInTierRatio`），
       不再是 `checkInPayout` 的第 5 个参数 —— 全局设置删了。
       所以这里改成「同一个任务、不同的倍率」而不是「同一个倍率参数」。 */
    const at = (r: number) =>
      checkInPayoutRaw({ ...weekly, checkInTierRatio: r }, [], [], '2026-10-05')
    // 首日落在第 1 档：基础 5 + 阶梯 2 = 7（默认档，和上面那组对得上）
    expect(at(DEFAULT_TIER_RATIO).total).toBe(7)
    // 倍率压到下限 → 第 1 档从 2 变 1 → 6
    expect(at(MIN_TIER_RATIO).tierPoints).toBe(1)
    expect(at(MIN_TIER_RATIO).total).toBe(6)
    // 倍率拉满 → 第 1 档 4 → 9
    expect(at(MAX_TIER_RATIO).tierPoints).toBe(4)
    expect(at(MAX_TIER_RATIO).total).toBe(9)
  })

  it('倍率只影响阶梯那一段，不动基础分', () => {
    const weekly = { basePoints: 5, cycle: 'weekly' as const, checkInTargetCount: 5 }
    const low = checkInPayoutRaw({ ...weekly, checkInTierRatio: MIN_TIER_RATIO }, ['2026-10-05'], [1], '2026-10-06')
    const high = checkInPayoutRaw({ ...weekly, checkInTierRatio: MAX_TIER_RATIO }, ['2026-10-05'], [1], '2026-10-06')
    expect(low.base).toBe(high.base)
    expect(low.base).toBe(5)
    expect(low.tierPoints).toBe(high.tierPoints) // 第 2 天不在阶梯日，两边都是 0
    expect(low.total).toBe(5)
  })
})

describe('isPeriodTask：长期任务只有一个判据', () => {
  const t = (cycle: string, checkInEnabled = false) =>
    ({ cycle, checkInEnabled }) as Parameters<typeof isPeriodTask>[0]

  it('周 / 月 / 年 + 不是签到 → 是长期任务', () => {
    expect(isPeriodTask(t('weekly'))).toBe(true)
    expect(isPeriodTask(t('monthly'))).toBe(true)
    expect(isPeriodTask(t('yearly'))).toBe(true)
  })

  it('单次 / 每日 → 不是（它们预生成实例，属于「今日任务」）', () => {
    expect(isPeriodTask(t('once'))).toBe(false)
    expect(isPeriodTask(t('daily'))).toBe(false)
  })

  it('★ 开了签到的周任务 → 不算长期任务（否则会同时出现在两个区块里）', () => {
    expect(isPeriodTask(t('weekly', true))).toBe(false)
  })

  it('★ 和 isCheckInTask 互补：签到 / 长期 / 今日三选一，不重不漏', () => {
    const cycles = ['once', 'daily', 'weekly', 'monthly', 'yearly'] as const
    for (const cycle of cycles) {
      for (const on of [false, true]) {
        const task = t(cycle, on)
        const checkIn = isCheckInTask(task)
        const period = isPeriodTask(task)
        expect(checkIn && period, `${cycle}/${on} 不能既是签到又是长期`).toBe(false)
      }
    }
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

/* ============================================================
   签到容量：目标天数不能超过「一个周期能有几天」
   ------------------------------------------------------------
   2026-10-09：家长问签到任务的周期支持哪些。查完发现
   `daily` / `once` 的 periodKey 就是**当天**，进度行每天重置，
   而 `checkInTargetCount` 默认 5、输入框上限还写死 366 ——
   于是「目标 5 天」在日任务上**永远到不了**，界面上却照常
   写着「+12 分」。编辑器现在拿 checkInCapacity 做校验并提示。
   ============================================================ */

describe('签到容量 checkInCapacity', () => {
  it('日 / 单次的一个周期只有 1 天', () => {
    expect(checkInCapacity('once')).toBe(1)
    expect(checkInCapacity('daily')).toBe(1)
  })

  it('周 7 / 月 31 / 年 366', () => {
    expect(checkInCapacity('weekly')).toBe(7)
    expect(checkInCapacity('monthly')).toBe(31)
    expect(checkInCapacity('yearly')).toBe(366)
  })

  it('★ 默认目标 5 天在 daily 上全都超出容量 —— 这正是编辑器要警告的情形', () => {
    const tiers = defaultTiers('daily', 5, 5)
    expect(tiers.length).toBeGreaterThan(0)
    for (const t of tiers) {
      expect(t.days, `第 ${t.days} 天那档`).toBeGreaterThan(checkInCapacity('daily'))
    }
  })

  it('正向对照：weekly + 目标 5 的每一档都在容量以内（不是所有组合都到不了）', () => {
    const tiers = defaultTiers('weekly', 5, 5)
    expect(tiers.length).toBe(3)
    for (const t of tiers) {
      expect(t.days, `第 ${t.days} 天那档`).toBeLessThanOrEqual(checkInCapacity('weekly'))
    }
  })
})

/* ============================================================
   签到只在「跨天」的周期上成立（2026-10-09 家长定）
   ------------------------------------------------------------
   编辑器里日 / 单次**不显示**签到开关；数据层同样按 isCheckInTask 判定，
   两边共用一个事实源。老库里可能还留着 daily + checkInEnabled: true，
   那种任务必须**退回成普通日任务**，而不是从所有区块一起消失。
   ============================================================ */

describe('checkInSupported / isCheckInTask', () => {
  it('日 / 单次不支持；周 / 月 / 年支持', () => {
    expect(checkInSupported('once')).toBe(false)
    expect(checkInSupported('daily')).toBe(false)
    expect(checkInSupported('weekly')).toBe(true)
    expect(checkInSupported('monthly')).toBe(true)
    expect(checkInSupported('yearly')).toBe(true)
  })

  it('★ 日 / 单次上即使留着 checkInEnabled: true，也不算签到任务（老库数据）', () => {
    expect(isCheckInTask({ checkInEnabled: true, cycle: 'daily' })).toBe(false)
    expect(isCheckInTask({ checkInEnabled: true, cycle: 'once' })).toBe(false)
  })

  it('正向对照：周 / 月 / 年上 checkInEnabled: true 才算签到任务', () => {
    expect(isCheckInTask({ checkInEnabled: true, cycle: 'weekly' })).toBe(true)
    expect(isCheckInTask({ checkInEnabled: true, cycle: 'monthly' })).toBe(true)
    expect(isCheckInTask({ checkInEnabled: true, cycle: 'yearly' })).toBe(true)
  })

  it('没开开关就不是签到任务（不论周期）', () => {
    for (const c of ['once', 'daily', 'weekly', 'monthly', 'yearly'] as const) {
      expect(isCheckInTask({ checkInEnabled: false, cycle: c }), c).toBe(false)
      expect(isCheckInTask({ cycle: c }), c).toBe(false)
    }
  })
})
