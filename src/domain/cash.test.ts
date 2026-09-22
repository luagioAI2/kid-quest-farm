import { describe, expect, it } from 'vitest'
import {
  DEFAULT_POINTS_PER_YUAN,
  MAX_POINTS_PER_YUAN,
  MIN_POINTS_PER_YUAN,
  clampPointsPerYuan,
  formatYuan,
  pointsToYuan,
} from './cash'

/* ============================================================
   现金 : 积分 参考汇率（2026-09-21 用户要求）
   ------------------------------------------------------------
   用户明确「不影响数值」—— 所以这组测试除了算得对，还要守住
   「它只是个展示口径」这件事：默认值、夹取区间、格式化逐字。
   ============================================================ */

describe('现金 : 积分 —— 汇率夹取', () => {
  it('默认是 1 元 = 10 分（用户说的 1:10）', () => {
    expect(DEFAULT_POINTS_PER_YUAN).toBe(10)
  })

  it('缺省 / 非法值一律退回默认档（不能渲染出 ¥NaN）', () => {
    for (const bad of [undefined, NaN, Infinity, -Infinity]) {
      expect(clampPointsPerYuan(bad), String(bad)).toBe(DEFAULT_POINTS_PER_YUAN)
    }
  })

  it('夹在 [1, 1000]，并且取整', () => {
    expect(clampPointsPerYuan(0)).toBe(MIN_POINTS_PER_YUAN)
    expect(clampPointsPerYuan(-5)).toBe(MIN_POINTS_PER_YUAN)
    expect(clampPointsPerYuan(99999)).toBe(MAX_POINTS_PER_YUAN)
    // 家长手输小数 → 取整，否则 8.5 会让所有参考价都带零头
    expect(clampPointsPerYuan(8.5)).toBe(9)
    expect(clampPointsPerYuan(8.4)).toBe(8)
  })
})

describe('现金 : 积分 —— 换算', () => {
  it('默认档：30 分 ≈ 3 元', () => {
    expect(pointsToYuan(30, 10)).toBe(3)
  })

  it('不传汇率时按默认档算', () => {
    expect(pointsToYuan(30)).toBe(pointsToYuan(30, DEFAULT_POINTS_PER_YUAN))
  })

  it('汇率越「贵」，同样的分越值钱', () => {
    // 1 元 = 1 分  → 30 分 = 30 元
    expect(pointsToYuan(30, 1)).toBe(30)
    // 1 元 = 100 分 → 30 分 = 0.3 元
    expect(pointsToYuan(30, 100)).toBeCloseTo(0.3, 10)
  })
})

describe('现金 : 积分 —— 格式化', () => {
  it('整数不带小数点：¥3 / ¥150', () => {
    expect(formatYuan(30, 10)).toBe('¥3')
    expect(formatYuan(1500, 10)).toBe('¥150')
  })

  it('半个的保留一位：¥4.5', () => {
    expect(formatYuan(45, 10)).toBe('¥4.5')
  })

  it('小零头保留两位：¥0.1 / ¥0.15', () => {
    expect(formatYuan(1, 10)).toBe('¥0.1')
    expect(formatYuan(3, 20)).toBe('¥0.15')
  })

  it('不带千分位分隔符（短标签，逐字可控）', () => {
    // Intl 在某些环境会输出 ¥1,500 —— 这是给孩子看的短标签，不要逗号
    expect(formatYuan(15000, 10)).toBe('¥1500')
  })

  it('浮点尾巴不会漏出来', () => {
    // 0.1 + 0.2 这类经典浮点误差不能渲染成 ¥0.30000000000000004
    expect(formatYuan(3, 10)).toBe('¥0.3')
    expect(formatYuan(7, 10)).toBe('¥0.7')
  })

  it('汇率非法时不崩，退回默认档', () => {
    expect(formatYuan(30, undefined)).toBe('¥3')
    expect(formatYuan(30, 0)).toBe('¥30') // 0 → 夹到 1
    expect(formatYuan(30, NaN)).toBe('¥3')
  })

  it('0 分是 ¥0', () => {
    expect(formatYuan(0, 10)).toBe('¥0')
  })
})
