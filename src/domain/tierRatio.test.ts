import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIER_RATIO,
  MAX_TIER_RATIO,
  MIN_TIER_RATIO,
  clampTierRatio,
} from './tierRatio'

/* ============================================================
   签到阶梯倍率（2026-10-10 家长要求「阶梯分设置」）
   ------------------------------------------------------------
   和 cash.ts 那组不一样：这个倍率**参与计算**（进 defaultTiers →
   checkInPayout → 真正落账的分数）。所以这里除了守住默认值和夹取
   区间，还要守住「默认值就是原来写死的那个 0.8」—— 老库升上来
   行为必须一字不变，否则等于偷偷改了一次家长没要求的数值。
   倍率**算出来的数**在 recurrence.test.ts 里测（那边能 import defaultTiers）。
   ============================================================ */

describe('阶梯倍率 —— 默认值与夹取', () => {
  it('默认 0.8 —— 就是原来写死在 defaultTiers 里的那个系数', () => {
    expect(DEFAULT_TIER_RATIO).toBe(0.8)
  })

  it('缺省 / 非法值一律退回默认档（不能变成 NaN 一路传进 Math.round）', () => {
    for (const bad of [undefined, NaN, Infinity, -Infinity]) {
      expect(clampTierRatio(bad), String(bad)).toBe(DEFAULT_TIER_RATIO)
    }
  })

  it('夹在 [0.2, 1.5]，且默认档落在区间内部', () => {
    expect(clampTierRatio(0)).toBe(MIN_TIER_RATIO)
    expect(clampTierRatio(-3)).toBe(MIN_TIER_RATIO)
    expect(clampTierRatio(99)).toBe(MAX_TIER_RATIO)
    expect(MIN_TIER_RATIO).toBeLessThan(DEFAULT_TIER_RATIO)
    expect(MAX_TIER_RATIO).toBeGreaterThan(DEFAULT_TIER_RATIO)
  })

  it('保留 2 位小数 —— 界面上的「80%」存下来必须还是同一个数', () => {
    expect(clampTierRatio(0.8)).toBe(0.8)
    expect(clampTierRatio(1.25)).toBe(1.25)
    // 手输的零头收掉，否则 0.333 会让三档分数都带上小尾巴
    expect(clampTierRatio(0.333)).toBe(0.33)
    expect(clampTierRatio(0.876)).toBe(0.88)
  })
})
