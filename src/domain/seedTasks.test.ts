import { describe, expect, it } from 'vitest'
import { SEED_TASKS } from './seedTasks'

/* ============================================================
   首次启动的任务清单（家长指定的规格）
   ------------------------------------------------------------
   这份清单是家长直接定下来的，不是随手写的示例 —— 所以用测试
   把它钉住：以后谁改种子，改错了这里会红。

   三块：
   * 每日任务  6 个 45 分钟的学科任务 + 1 个家务
   * 签到任务  练字签到 / 日记 / 晨读（每周 5 次）
   * 长期任务  月度和年度各一个（家长要求「不变」）
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

  it('6 个学科任务都是 45 分钟 / 20 分', () => {
    const academic = daily.filter((t) => t.category === 'study')
    expect(academic).toHaveLength(6)
    for (const t of academic) {
      expect(t.plannedMinutes, t.title).toBe(45)
      expect(t.basePoints, t.title).toBe(20)
    }
  })

  it('学科任务都允许家长打质量分（有额外奖励空间）', () => {
    for (const t of daily.filter((x) => x.category === 'study')) {
      expect(t.qualityRated, t.title).toBe(true)
      expect(t.qualityBonusPoints ?? 0, t.title).toBeGreaterThan(0)
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

  it('原有的「练字签到」没有被顶掉', () => {
    expect(checkIn.map((t) => t.title)).toContain('练字签到')
  })

  it('三个签到任务都是每周记 5 次', () => {
    expect(checkIn).toHaveLength(3)
    for (const t of checkIn) {
      expect(t.cycle, t.title).toBe('weekly')
      expect(t.checkInTargetCount, t.title).toBe(5)
    }
  })

  it('日记归到「艺术」、晨读归到「阅读」（决定卡片配色和图标）', () => {
    expect(checkIn.find((t) => t.title === '日记')?.category).toBe('art')
    expect(checkIn.find((t) => t.title === '晨读')?.category).toBe('reading')
  })
})

describe('种子任务：长期任务（家长要求不变）', () => {
  it('仍然是月度和年度各一个', () => {
    expect(period.map((t) => t.title).sort()).toEqual(
      ['学会一项新本领', '读一本完整的故事书'].sort(),
    )
    expect(period.map((t) => t.cycle).sort()).toEqual(['monthly', 'yearly'])
  })

  it('签到任务不会被算进长期任务（否则会同时出现在两个区块）', () => {
    // 练字签到 / 日记 / 晨读 都是 weekly，但 checkInEnabled —— 必须被排除
    expect(period.every((t) => !t.checkInEnabled)).toBe(true)
    expect(period).toHaveLength(2)
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
