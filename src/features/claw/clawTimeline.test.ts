import { describe, expect, it } from 'vitest'
import {
  CLAW_SPANS,
  CLAW_TOTAL,
  SLIP_AT,
  clawCarriageAccel,
  clawCloseAt,
  clawHubYAt,
  clawHoldingAt,
  clawOutcomeText,
  clawPhaseAt,
  clawPositionAt,
  clawSwingStep,
  smoothstep,
  type ClawCarriage,
  type ClawSwing,
  type ClawPhase,
} from './clawTimeline'

/* ============================================================
   娃娃机一局的时间线

   这段逻辑以前只能靠肉眼看动画验证 —— 而肉眼看不出
   「合爪发生在下降结束之前」这种错（爪子会在半空合上，动画照样在跑）。
   拆成纯函数之后就能直接断言每个时刻落在哪一段。
   ============================================================ */

/** 把整局按 20ms 采样一遍，方便反复扫。 */
function sampleAll(): ReturnType<typeof clawPhaseAt>[] {
  const out: ReturnType<typeof clawPhaseAt>[] = []
  for (let t = 0; t <= CLAW_TOTAL + 0.05; t += 0.02) out.push(clawPhaseAt(t))
  return out
}

describe('娃娃机 · 时间线', () => {
  it('总时长等于各段之和（不是另写一个数）', () => {
    expect(CLAW_TOTAL).toBeCloseTo(
      CLAW_SPANS.reduce((a, s) => a + s.seconds, 0),
      10,
    )
    expect(CLAW_TOTAL).toBeGreaterThan(3)
  })

  it('0 秒是 idle，超时是 done', () => {
    expect(clawPhaseAt(0).phase).toBe('idle')
    expect(clawPhaseAt(-5).phase).toBe('idle')
    expect(clawPhaseAt(Number.NaN).phase).toBe('idle')
    expect(clawPhaseAt(CLAW_TOTAL).phase).toBe('done')
    expect(clawPhaseAt(CLAW_TOTAL + 99).phase).toBe('done')
  })

  it('★ 每一段都真的能被走到（否则那张表里有一段是死代码）', () => {
    const seen = new Set(sampleAll().map((m) => m.phase))
    for (const s of CLAW_SPANS) {
      expect(seen.has(s.phase), `没走到 ${s.phase}`).toBe(true)
    }
    // 两端也都要有
    expect(seen.has('idle')).toBe(true)
    expect(seen.has('done')).toBe(true)
  })

  it('★ 段落顺序和表里写的一致，而且不重叠', () => {
    const order: ClawPhase[] = []
    for (const m of sampleAll()) if (order[order.length - 1] !== m.phase) order.push(m.phase)
    expect(order).toEqual(['idle', ...CLAW_SPANS.map((s) => s.phase), 'done'])
  })

  it('★ 整局进度单调不减（时间不能倒流）', () => {
    let prev = -1
    for (const m of sampleAll()) {
      expect(m.overall).toBeGreaterThanOrEqual(prev)
      prev = m.overall
    }
    expect(clawPhaseAt(CLAW_TOTAL).overall).toBe(1)
  })

  it('每段内部的进度都落在 [0,1]', () => {
    for (const m of sampleAll()) {
      expect(m.t).toBeGreaterThanOrEqual(0)
      expect(m.t).toBeLessThanOrEqual(1)
    }
  })

  it('★★ 下降段里爪子是**张开的**，合爪只发生在 close 段', () => {
    // 这条是「肉眼看不出」的典型：如果 drop 段就开始合，爪子会在半空夹上
    for (const m of sampleAll()) {
      if (m.phase === 'drop' || m.phase === 'idle') {
        expect(clawCloseAt(m), `${m.phase} t=${m.t}`).toBe(0)
      }
    }
    expect(clawCloseAt(clawPhaseAt(CLAW_TOTAL * 0.5))).toBeGreaterThan(0)
  })

  it('★ 合上之后一路保持合上，直到 release 才张开', () => {
    const spans = CLAW_SPANS
    const liftStart = spans[0].seconds + spans[1].seconds
    expect(clawCloseAt(clawPhaseAt(liftStart + 0.01))).toBeCloseTo(1, 2)
    expect(clawCloseAt(clawPhaseAt(liftStart + spans[2].seconds * 0.5))).toBe(1)
  })

  it('★ 高度：下去再上来，中间停在池底', () => {
    const top = 1.0
    const bottom = 0.3
    expect(clawHubYAt(clawPhaseAt(0), top, bottom)).toBe(top)
    const dropEnd = CLAW_SPANS[0].seconds
    expect(clawHubYAt(clawPhaseAt(dropEnd - 0.01), top, bottom)).toBeCloseTo(bottom, 1)
    // close 段停在池底
    expect(clawHubYAt(clawPhaseAt(dropEnd + 0.2), top, bottom)).toBe(bottom)
    // 一局结束回到顶
    expect(clawHubYAt(clawPhaseAt(CLAW_TOTAL), top, bottom)).toBe(top)
    // 全程不越界
    for (const m of sampleAll()) {
      const y = clawHubYAt(m, top, bottom)
      expect(y).toBeGreaterThanOrEqual(bottom - 1e-9)
      expect(y).toBeLessThanOrEqual(top + 1e-9)
    }
  })

  it('★★ 中了：一路拿到底，直到 release 后半段才松手', () => {
    const holdTimes = sampleAll().filter((m) => clawHoldingAt(m, true))
    expect(holdTimes.length).toBeGreaterThan(0)
    // move 段整段都拿着（不然娃娃会在半路掉下来）
    for (const m of holdTimes) expect(['close', 'lift', 'move', 'release']).toContain(m.phase)
    for (const m of sampleAll()) if (m.phase === 'move') expect(clawHoldingAt(m, true)).toBe(true)
  })

  it('★★ 没中：提起来一半（SLIP_AT）就松手 —— 这就是孩子看到的「滑掉了」', () => {
    const lifts = sampleAll().filter((m) => m.phase === 'lift')
    const before = lifts.filter((m) => m.t < SLIP_AT)
    const after = lifts.filter((m) => m.t >= SLIP_AT)
    expect(before.length).toBeGreaterThan(0)
    expect(after.length).toBeGreaterThan(0)
    // 松手前拿着、松手后没拿 —— 两边都要有，否则「滑掉」这个动作没发生
    expect(before.every((m) => clawHoldingAt(m, false))).toBe(true)
    expect(after.every((m) => !clawHoldingAt(m, false))).toBe(true)
    // 滑掉的时刻必须**真的在 lift 段内部**，不能在段首或段尾
    expect(SLIP_AT).toBeGreaterThan(0.2)
    expect(SLIP_AT).toBeLessThan(0.9)
  })

  it('★ 没中的时候，move 段手里是空的（不能一边滑掉了还拿着走）', () => {
    for (const m of sampleAll()) {
      if (m.phase === 'move') expect(clawHoldingAt(m, false)).toBe(false)
    }
  })

  it('★ 横向移动只发生在 move / release / done', () => {
    const from = { x: -0.4, z: -0.3 }
    const to = { x: 0.42, z: 0.28 }
    for (const m of sampleAll()) {
      const p = clawPositionAt(m, from, to)
      if (m.phase === 'drop' || m.phase === 'close' || m.phase === 'lift' || m.phase === 'idle') {
        expect(p).toEqual(from)
      }
    }
    expect(clawPositionAt(clawPhaseAt(CLAW_TOTAL), from, to)).toEqual(to)
  })

  it('★ 结束那一刻爪子**就在**取物口中心（不是「约等于」）', () => {
    /*
      这条钉的是一个真实的浮点尾巴：`from + (to − from) × 1` 并不等于 `to`。

      实测 `0.12 + (0.42 − 0.12) × 1 === 0.42000000000000004`。
      渲染上无所谓，但「一局结束时爪子在取物口」是能直接断言的事实，
      写成 `toBeCloseTo` 就变成了「差不多在」—— 以后真把它挪偏了也照样绿。
    */
    const from = { x: 0.12, z: -0.3 }
    const to = { x: 0.42, z: 0.28 }
    const p = clawPositionAt(clawPhaseAt(CLAW_TOTAL), from, to)
    expect(p.x).toBe(to.x)
    expect(p.z).toBe(to.z)
  })

  it('smoothstep 两端夹住、中点 0.5', () => {
    expect(smoothstep(-1)).toBe(0)
    expect(smoothstep(0)).toBe(0)
    expect(smoothstep(1)).toBe(1)
    expect(smoothstep(2)).toBe(1)
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 10)
  })

  it('结果文案：中了 / 滑掉了 / 差一点 是三句不同的话', () => {
    expect(clawOutcomeText(true, true)).toContain('抓到')
    expect(clawOutcomeText(false, true)).toContain('滑掉')
    expect(clawOutcomeText(false, false)).toContain('差一点')
    // 没中的两句必须不一样，否则孩子分不出「夹住了又掉」和「没夹到」
    expect(clawOutcomeText(false, true)).not.toBe(clawOutcomeText(false, false))
  })
})

/* ============================================================
   摆动（单摆）

   为什么这些必须单测：摆的正确性**肉眼分不出**。
   「晃了」和「晃得对」在截图上完全一样，而错的那种（匀速也晃 / 大 dt 发散）
   要玩上十几秒才看得出来。这三条各自钉一个具体的错法。
   ============================================================ */
describe('爪子摆动：单摆积分', () => {
  /** 按固定步长跑一段，返回轨迹 */
  const run = (s: ClawSwing, ax: number, az: number, L: number, dt: number, steps: number) => {
    const out: number[] = []
    for (let i = 0; i < steps; i++) {
      clawSwingStep(s, ax, az, L, dt)
      out.push(s.x)
    }
    return out
  }

  it('匀速平移（加速度 0）时**不晃** —— 晃的是加速，不是移动', () => {
    const s: ClawSwing = { x: 0, z: 0, vx: 0, vz: 0 }
    run(s, 0, 0, 0.12, 1 / 60, 120)
    expect(Math.abs(s.x)).toBeLessThan(1e-9)
    expect(Math.abs(s.z)).toBeLessThan(1e-9)
  })

  it('向右加速 → 爪子向后（负方向）甩', () => {
    const s: ClawSwing = { x: 0, z: 0, vx: 0, vz: 0 }
    run(s, 0.7, 0, 0.12, 1 / 60, 20)
    expect(s.x).toBeLessThan(-0.01)
  })

  it('松手后会停：2.5 秒后回到 3° 以内（不是钟摆）', () => {
    const s: ClawSwing = { x: 0, z: 0, vx: 0, vz: 0 }
    run(s, 0.7, 0, 0.12, 1 / 60, 45) // 加速 0.75s
    const peak = Math.abs(s.x)
    run(s, -0.7, 0, 0.12, 1 / 60, 45) // 刹车 0.75s
    run(s, 0, 0, 0.12, 1 / 60, 150) // 松手滑行 2.5s
    expect(peak).toBeGreaterThan(0.02) // 先证明它真的晃起来了
    expect(Math.abs(s.x)).toBeLessThan(0.052) // 3°
  })

  it('掉帧到 4fps（dt=0.25）也**不发散** —— 固定子步的意义', () => {
    const s: ClawSwing = { x: 0, z: 0, vx: 0, vz: 0 }
    // 交替加减速，模拟玩家来回推 —— 最坏情况
    for (let i = 0; i < 40; i++) clawSwingStep(s, i % 2 ? 0.7 : -0.7, 0, 0.12, 0.25)
    expect(Number.isFinite(s.x)).toBe(true)
    expect(Math.abs(s.x)).toBeLessThanOrEqual(0.25 + 1e-9) // 上限 0.25，永远不越界
  })
})

describe('小车加速度：限幅', () => {
  it('位置一直不动 → 加速度 0', () => {
    const s: ClawCarriage = { x: 0.1, z: 0, vx: 0, vz: 0 }
    for (let i = 0; i < 10; i++) {
      const { ax, az } = clawCarriageAccel(s, 0.1, 0, 1 / 60)
      expect(Math.abs(ax)).toBeLessThan(1e-9)
      expect(Math.abs(az)).toBeLessThan(1e-9)
    }
  })

  it('位置瞬移也不会产生 30 m/s² 的尖峰（键盘一按就满速）', () => {
    const s: ClawCarriage = { x: 0, z: 0, vx: 0, vz: 0 }
    let maxA = 0
    // 每帧挪 0.009 m（0.52 m/s @ 60fps），从静止开始
    for (let i = 1; i <= 60; i++) {
      const { ax } = clawCarriageAccel(s, i * 0.009, 0, 1 / 60)
      maxA = Math.max(maxA, Math.abs(ax))
    }
    expect(maxA).toBeLessThanOrEqual(0.7 + 1e-6)
    expect(s.vx).toBeGreaterThan(0.5) // 最终还是能到巡航速度
  })
})
