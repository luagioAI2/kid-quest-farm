import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STREAK_CAP,
  DEFAULT_STREAK_PER_DAY,
  MAX_STREAK_CAP,
  MAX_STREAK_PER_DAY,
  MIN_STREAK_CAP,
  MIN_STREAK_PER_DAY,
  clampStreakCap,
  clampStreakPerDay,
} from './streakBonus'

/* ============================================================
   连击奖励的加成分（2026-10-11 家长要求「可以设置连续的加成的分」）
   ------------------------------------------------------------
   和 tierRatio.ts 同一类：这两个值**参与计算**，会变成账本里真实的
   分。所以这里守住三件事：
     ① 默认值就是原来写死的 2 / 20 —— 老库升上来行为一字不变；
     ② 缺省 / 非法值退回默认档，不能变成 NaN 一路乘进账本；
     ③ 夹取区间包含 0（0 = 不发，语义干净）。
   夹出来的**实际发放数**在 useApp.test.ts 里测（那边能跑完整结算）。
   ============================================================ */

describe('连击加成分 —— 默认值与夹取', () => {
  it('默认 2 / 20 —— 就是原来写死在 DEFAULT_SETTINGS 里的那两个数', () => {
    expect(DEFAULT_STREAK_PER_DAY).toBe(2)
    expect(DEFAULT_STREAK_CAP).toBe(20)
  })

  it('缺省 / 非法值一律退回默认档（不能变成 NaN 一路乘进账本）', () => {
    for (const bad of [undefined, NaN, Infinity, -Infinity]) {
      expect(clampStreakPerDay(bad), `perDay ${String(bad)}`).toBe(DEFAULT_STREAK_PER_DAY)
      expect(clampStreakCap(bad), `cap ${String(bad)}`).toBe(DEFAULT_STREAK_CAP)
    }
  })

  it('下限是 0（0 就是「不发」，等价于关掉开关）', () => {
    expect(clampStreakPerDay(-5)).toBe(MIN_STREAK_PER_DAY)
    expect(clampStreakPerDay(0)).toBe(0)
    expect(clampStreakCap(-5)).toBe(MIN_STREAK_CAP)
    expect(clampStreakCap(0)).toBe(0)
  })

  it('上限封死，且默认档落在区间内部', () => {
    expect(clampStreakPerDay(999)).toBe(MAX_STREAK_PER_DAY)
    expect(clampStreakCap(99999)).toBe(MAX_STREAK_CAP)
    expect(MIN_STREAK_PER_DAY).toBeLessThan(DEFAULT_STREAK_PER_DAY)
    expect(MAX_STREAK_PER_DAY).toBeGreaterThan(DEFAULT_STREAK_PER_DAY)
    expect(MIN_STREAK_CAP).toBeLessThan(DEFAULT_STREAK_CAP)
    expect(MAX_STREAK_CAP).toBeGreaterThan(DEFAULT_STREAK_CAP)
  })

  it('取整 —— 分只能是整数，界面上「3.7 分」没有意义', () => {
    expect(clampStreakPerDay(3.4)).toBe(3)
    expect(clampStreakPerDay(3.6)).toBe(4)
    expect(clampStreakCap(20.5)).toBe(21)
  })
})
