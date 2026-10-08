import { describe, expect, it } from 'vitest'
import { SEED_REDEEM_ITEMS, SEED_TASKS } from './seedTasks'

/* ============================================================
   首次启动的任务清单（家长指定的规格）
   ------------------------------------------------------------
   这份清单是家长直接定下来的，不是随手写的示例 —— 所以用测试
   把它钉住：以后谁改种子，改错了这里会红。

   三块：
   * 每日任务  6 个 45 分钟的学科任务 + 1 个家务
   * 签到任务  练字签到 / 日记 / 晨读 / 数学计算练习（每周 5 次）
   * 长期任务  背诵（每周 2 次）+ 月度 / 年度各一个
   ============================================================ */

const daily = SEED_TASKS.filter((t) => t.cycle === 'daily')
const checkIn = SEED_TASKS.filter((t) => t.checkInEnabled)
const period = SEED_TASKS.filter(
  (t) => !t.checkInEnabled && ['weekly', 'monthly', 'yearly'].includes(t.cycle),
)

describe('种子任务：每日任务', () => {
  it('正好是家长指定的 7 项，顺序也一致', () => {
    expect(daily.map((t) => t.title)).toEqual([
      '完成语文作业',
      '完成数学作业',
      '完成英语作业',
      '语文课外练习',
      '数学课外练习',
      '英语课外练习',
      '清理自己的房间',
    ])
  })

  it('6 个学科任务都是 45 分钟 / 10 分', () => {
    const academic = daily.filter((t) => t.category === 'study')
    expect(academic).toHaveLength(6)
    for (const t of academic) {
      expect(t.plannedMinutes, t.title).toBe(45)
      expect(t.basePoints, t.title).toBe(10)
    }
  })

  it('学科任务都允许家长打质量分，而且基础分不为 0', () => {
    // 质量分是**乘**在基础分上的：基础分是 0 的话，打多高的质量都乘不出分来。
    for (const t of daily.filter((x) => x.category === 'study')) {
      expect(t.qualityRated, t.title).toBe(true)
      expect(t.basePoints, t.title).toBeGreaterThan(0)
    }
  })

  it('清理自己的房间算家务，且不是 45 分钟', () => {
    const chore = daily.find((t) => t.title === '清理自己的房间')
    expect(chore).toBeDefined()
    expect(chore?.category).toBe('chore')
    expect(chore?.plannedMinutes).toBe(15)
  })

  it('每日任务都不是 fixed —— 它们走「今日任务」，不占用「固定任务」区块', () => {
    // 家长明确说过：这些是普通每日任务，不是 📌 固定任务（家规）
    expect(daily.every((t) => !t.fixed)).toBe(true)
  })

  it('每日任务都允许超时，但拖太久会扣分（宽容超时）', () => {
    for (const t of daily) {
      expect(t.allowOvertime, t.title).toBe(true)
      expect(t.allowLateNoPenalty, t.title).toBe(false)
    }
  })
})

describe('种子任务：签到', () => {
  it('包含 日记 和 晨读（家长要求新增的两项）', () => {
    const titles = checkIn.map((t) => t.title)
    expect(titles).toContain('日记')
    expect(titles).toContain('晨读')
  })

  it('包含「数学计算练习」（2026-09-30 家长要求新增的每周打卡）', () => {
    expect(checkIn.map((t) => t.title)).toContain('数学计算练习')
  })

  it('原有的「练字签到」没有被顶掉', () => {
    expect(checkIn.map((t) => t.title)).toContain('练字签到')
  })

  it('四个签到任务都是每周记 5 次', () => {
    expect(checkIn).toHaveLength(4)
    for (const t of checkIn) {
      expect(t.cycle, t.title).toBe('weekly')
      expect(t.checkInTargetCount, t.title).toBe(5)
    }
  })

  it('日记归到「艺术」、晨读归到「阅读」、数学计算练习归到「学科」', () => {
    expect(checkIn.find((t) => t.title === '日记')?.category).toBe('art')
    expect(checkIn.find((t) => t.title === '晨读')?.category).toBe('reading')
    expect(checkIn.find((t) => t.title === '数学计算练习')?.category).toBe('study')
  })
})

describe('种子任务：长期任务', () => {
  it('包含「背诵」（2026-09-30 家长要求：长期任务，每周 2 次）', () => {
    const recite = period.find((t) => t.title === '背诵')
    expect(recite, '找不到「背诵」').toBeDefined()
    expect(recite?.cycle).toBe('weekly')
    expect(recite?.checkInTargetCount).toBe(2)
  })

  it('月度 1 个 / 年度 2 个（2026-09-29 加了「每月记忆单词」）', () => {
    // ⚠️ 这条原来写的是「月度和年度各一个」，2026-09-29 新增「每月记忆单词」
    // 之后就一直是红的 —— 属于「加了种子任务但没同步测试」。
    expect(period.filter((t) => t.cycle === 'monthly').map((t) => t.title)).toEqual([
      '读一本完整的故事书',
    ])
    expect(
      period
        .filter((t) => t.cycle === 'yearly')
        .map((t) => t.title)
        .sort(),
    ).toEqual(['学会一项新本领', '每月记忆单词'].sort())
  })

  it('排列顺序是 周 → 月 → 年（先近后远，孩子先看到本周的）', () => {
    expect(period.map((t) => t.cycle)).toEqual(['weekly', 'monthly', 'yearly', 'yearly'])
  })

  it('签到任务不会被算进长期任务（否则会同时出现在两个区块）', () => {
    // 练字签到 / 日记 / 晨读 / 数学计算练习 都是 weekly，
    // 但 checkInEnabled —— 必须被 selectPeriodTasks() 排除，否则同一张卡会出现两次。
    expect(period.every((t) => !t.checkInEnabled)).toBe(true)
    expect(period).toHaveLength(4)
  })

  it('「背诵」和「数学计算练习」分属两个区块，没有混', () => {
    // 两个都是 weekly，最容易在后续改动里被合并到同一个区块 —— 钉住区别：
    // 背诵是长期任务（不预先展开），数学计算练习是签到（按天打卡拿阶梯）。
    const periodTitles = period.map((t) => t.title)
    const checkInTitles = checkIn.map((t) => t.title)
    expect(periodTitles).toContain('背诵')
    expect(periodTitles).not.toContain('数学计算练习')
    expect(checkInTitles).toContain('数学计算练习')
    expect(checkInTitles).not.toContain('背诵')
  })
})

describe('种子任务：整体', () => {
  it('标题不重复', () => {
    const titles = SEED_TASKS.map((t) => t.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('每个任务的分钟数和积分都是正数', () => {
    for (const t of SEED_TASKS) {
      expect(t.plannedMinutes, t.title).toBeGreaterThan(0)
      expect(t.basePoints, t.title).toBeGreaterThan(0)
    }
  })
})

/* ============================================================
   2026-09-21：任务积分整体减半（用户指定）
   ------------------------------------------------------------
   用户原话：「帮我把现在的固定的默认的每日任务改成 10 积分，
   其他的也缩小 2 倍吧。现有的。积分取整。」

   把每一档的数字**逐个钉住**，而不是只检查「是偶数」之类的
   弱条件 —— 减半这种事最怕改漏一个（比如漏了家务或者月度），
   漏了这里就红。同时钉住「农场 / 兑换品**没有**跟着减半」，
   因为那是有意的决定，不是漏改，见 seedTasks.ts 的定价锚点注释。
   ============================================================ */
describe('种子任务：2026-09-21 积分减半', () => {
  it('逐档对照：学科 / 家务 / 签到 / 月度 / 年度', () => {
    const expectPoints = (title: string, base: number): void => {
      const t = SEED_TASKS.find((x) => x.title === title)
      expect(t, `找不到任务：${title}`).toBeDefined()
      expect(t?.basePoints, `${title} 基础分`).toBe(base)
    }

    // 学科任务：20 → 10
    expectPoints('完成语文作业', 10)
    expectPoints('完成数学作业', 10)
    expectPoints('完成英语作业', 10)
    expectPoints('语文课外练习', 10)
    expectPoints('数学课外练习', 10)
    expectPoints('英语课外练习', 10)
    // 家务：12 → 6
    expectPoints('清理自己的房间', 6)
    // 签到：8 → 4
    expectPoints('练字签到', 4)
    expectPoints('日记', 4)
    expectPoints('晨读', 4)
    // 月度：30 → 15
    expectPoints('读一本完整的故事书', 15)
    // 年度：100 → 50
    expectPoints('学会一项新本领', 50)
  })

  it('全部积分都是整数（用户要求「积分取整」）', () => {
    for (const t of SEED_TASKS) {
      expect(Number.isInteger(t.basePoints), `${t.title} 基础分`).toBe(true)
    }
  })

  it('积分全都比减半前小（确实是「缩小」而不是「放大」）', () => {
    // 减半前的原始档位，写死在这里当基准
    const BEFORE: Record<string, number> = {
      完成语文作业: 20,
      完成数学作业: 20,
      完成英语作业: 20,
      语文课外练习: 20,
      数学课外练习: 20,
      英语课外练习: 20,
      清理自己的房间: 12,
      练字签到: 8,
      日记: 8,
      晨读: 8,
      读一本完整的故事书: 30,
      学会一项新本领: 100,
    }
    /* 减半**之后**才加进来的任务，没有「减半前」可言。
       列在这里不是为了放行，而是让「新增了种子任务」这件事在测试里
       显式留痕 —— 下次加任务，要么补进 BEFORE（如果它是减半前的旧档），
       要么补进这张表并写明来由，不允许默默漏过去。 */
    const ADDED_AFTER: Record<string, string> = {
      每月记忆单词: '2026-09-29 新增（年度）',
      背诵: '2026-09-30 新增（长期任务，每周 2 次）',
      数学计算练习: '2026-09-30 新增（每周签到）',
    }
    for (const t of SEED_TASKS) {
      if (t.title in ADDED_AFTER) continue
      const before = BEFORE[t.title]
      expect(before, `基准表缺少：${t.title}（新任务请补进 ADDED_AFTER 并写明来由）`).toBeDefined()
      expect(t.basePoints, t.title).toBeLessThan(before)
    }
    // 反向保证：两张表不重叠，且覆盖了全部种子任务
    const covered = new Set([...Object.keys(BEFORE), ...Object.keys(ADDED_AFTER)])
    expect(covered.size).toBe(SEED_TASKS.length)
  })

  it('兑换品价格**没有**跟着减半（有意为之，不是漏改）', () => {
    // 农场收入 + 兑换定价这一侧刻意保持原样，见 seedTasks.ts 的锚点注释。
    // 只钉两个端点：最低档和最高档。
    expect(SEED_REDEEM_ITEMS.find((i) => i.name === '一份小零食')?.cost).toBe(30)
    expect(SEED_REDEEM_ITEMS.find((i) => i.name === '一个大愿望')?.cost).toBe(1500)
  })
})

/* ============================================================
   2026-09-30：家长新增的两个任务
   ------------------------------------------------------------
   用户原话：「再帮我添加一个长期任务， 每周 2 次，背诵。
             再帮我添加一个 每周的打卡 数学计算练习。」

   两条都是 weekly，走的是**不同的机制**，所以数值也不同：
   * 背诵         长期任务（不预先展开）→ 每周 2 次，学科档 10 + 4
   * 数学计算练习  签到（按天打卡 + 阶梯奖）→ 每周 5 次，签到档 4 + 0
   逐条钉住，免得以后有人「顺手统一一下」把两者揉成一个。
   ============================================================ */
describe('种子任务：2026-09-30 新增（背诵 / 数学计算练习）', () => {
  it('背诵：长期任务，每周 2 次，学科档 10 分', () => {
    const t = SEED_TASKS.find((x) => x.title === '背诵')
    expect(t, '找不到「背诵」').toBeDefined()
    expect(t?.cycle).toBe('weekly')
    expect(t?.checkInTargetCount).toBe(2)
    expect(t?.checkInEnabled ?? false, '必须不是签到，否则会跑到「坚持签到」区块').toBe(false)
    expect(t?.category).toBe('study')
    expect(t?.plannedMinutes).toBe(15)
    expect(t?.basePoints).toBe(10)
  })

  it('数学计算练习：每周签到，5 次，签到档 4 分（奖励主要来自阶梯）', () => {
    const t = SEED_TASKS.find((x) => x.title === '数学计算练习')
    expect(t, '找不到「数学计算练习」').toBeDefined()
    expect(t?.cycle).toBe('weekly')
    expect(t?.checkInEnabled).toBe(true)
    expect(t?.checkInTargetCount).toBe(5)
    expect(t?.category).toBe('study')
    expect(t?.plannedMinutes).toBe(15)
    expect(t?.basePoints).toBe(4)
  })

  it('签到任务的数值口径完全一致（4 分 / 15 分钟 / 不打质量分）', () => {
    // 四个签到任务除了标题、说明、分类之外，数值应当一模一样 ——
    // 不一致的话「每天点一下」这件事对不同任务就不等价了。
    for (const t of checkIn) {
      expect(t.basePoints, t.title).toBe(4)
      expect(t.plannedMinutes, t.title).toBe(15)
      expect(t.qualityRated, t.title).toBe(false)
      expect(t.allowOvertime, t.title).toBe(false)
      expect(t.allowLateNoPenalty, t.title).toBe(true)
    }
  })

  it('「每周 2 次」不会把小目标任务的阶梯压成负数或重复档', () => {
    // 小目标（每周 2 次）会让 defaultTiers 里的 Math.min(base, N) 撞车，
    // 这里只验「背诵」这个 2 次的档位不会算出 days < 1 的阶梯。
    // 完整的阶梯合并逻辑在 recurrence.test.ts。
    const t = SEED_TASKS.find((x) => x.title === '背诵')
    expect(t?.checkInTargetCount).toBeGreaterThanOrEqual(1)
  })
})
