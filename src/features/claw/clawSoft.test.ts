import { describe, expect, it } from 'vitest'
import { SOFT_MAX, SOFT_MIN, softStep, type SoftBody } from './clawSoft'

const run = (s: SoftBody, target: number, dt: number, frames: number) => {
  for (let i = 0; i < frames; i++) softStep(s, target, dt)
}

describe('软体弹簧（捏合 / 撞击）', () => {
  it('从 0 推到目标值并停住（60fps）', () => {
    const s: SoftBody = { squash: 0, squashV: 0 }
    run(s, -0.07, 1 / 60, 90) // 1.5 秒
    expect(s.squash).toBeCloseTo(-0.07, 2)
    expect(Math.abs(s.squashV)).toBeLessThan(0.05)
  })

  it('★★ 4fps（dt=0.25）也不发散 —— 老实现会在这两个夹紧值之间来回跳', () => {
    const s: SoftBody = { squash: 0, squashV: 0 }
    let min = 0
    let max = 0
    for (let i = 0; i < 40; i++) {
      softStep(s, -0.07, 0.25)
      min = Math.min(min, s.squash)
      max = Math.max(max, s.squash)
    }
    // 只在「目标附近」动，不会窜到另一头
    expect(min).toBeGreaterThan(-0.13)
    expect(max).toBeLessThan(0.02)
    expect(s.squash).toBeCloseTo(-0.07, 2)
  })

  it('★ 永不越界（夹紧值就是画面上限）', () => {
    const s: SoftBody = { squash: 0, squashV: 0 }
    for (let i = 0; i < 200; i++) {
      softStep(s, -5, 0.2)
      expect(s.squash).toBeGreaterThanOrEqual(SOFT_MIN)
      expect(s.squash).toBeLessThanOrEqual(SOFT_MAX)
    }
  })

  it('撞击给的初速度会衰减回 0（不会一直抖）', () => {
    const s: SoftBody = { squash: 0, squashV: 4 } // 撞击
    run(s, 0, 1 / 60, 120) // 2 秒
    expect(Math.abs(s.squash)).toBeLessThan(0.01)
    expect(Math.abs(s.squashV)).toBeLessThan(0.05)
  })

  it('dt = 0 / 负数不改变状态（切标签页那几帧）', () => {
    const s: SoftBody = { squash: 0.1, squashV: 0.2 }
    softStep(s, -0.07, 0)
    softStep(s, -0.07, -1)
    expect(s.squash).toBe(0.1)
    expect(s.squashV).toBe(0.2)
  })
})
