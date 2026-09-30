import { describe, expect, it } from 'vitest'
import { describeRedeemPayment, paidOf, planRedeemPayment } from './redeem'

/* ============================================================
   兑换分账：丰收币优先 + 可混合
   ------------------------------------------------------------
   用户 2026-09-30：「优先用丰收币兑换。价值和积分等价的。
   用完丰收币再用积分，可混合。」

   这组测试钉的是**分账规则本身**。store 层的 `redeem()` 和兑换页的
   预览都调同一个函数，所以规则改了这里会红，而不是让界面和账本各算各的。
   ============================================================ */

describe('兑换分账：丰收币优先', () => {
  it('丰收币够 —— 全用丰收币，积分一分不动', () => {
    const p = planRedeemPayment(50, 80, 300)
    expect(p).toMatchObject({ harvestPaid: 50, pointsPaid: 0, affordable: true, shortfall: 0 })
  })

  it('丰收币刚好够 —— 边界，不要多扣一枚', () => {
    const p = planRedeemPayment(50, 50, 300)
    expect(p).toMatchObject({ harvestPaid: 50, pointsPaid: 0, affordable: true })
  })

  it('丰收币差 1 —— 剩下那 1 从积分补，这就是「可混合」', () => {
    const p = planRedeemPayment(50, 49, 300)
    expect(p).toMatchObject({ harvestPaid: 49, pointsPaid: 1, affordable: true })
  })

  it('丰收币花光还不够 —— 剩余全走积分', () => {
    const p = planRedeemPayment(50, 20, 300)
    expect(p).toMatchObject({ harvestPaid: 20, pointsPaid: 30, affordable: true })
  })

  it('丰收币为 0 —— 退回「纯积分」的老行为', () => {
    const p = planRedeemPayment(50, 0, 300)
    expect(p).toMatchObject({ harvestPaid: 0, pointsPaid: 50, affordable: true })
  })

  it('两种币合计刚好够 —— 边界，算买得起', () => {
    const p = planRedeemPayment(50, 20, 30)
    expect(p).toMatchObject({ harvestPaid: 20, pointsPaid: 30, affordable: true, shortfall: 0 })
  })

  it('合计差 1 —— 买不起，且报出差多少', () => {
    const p = planRedeemPayment(50, 20, 29)
    expect(p.affordable).toBe(false)
    expect(p.shortfall).toBe(1)
    // 买不起也要给出「本来会怎么付」，UI 靠它显示还差多少
    expect(p.harvestPaid + p.pointsPaid).toBe(50)
  })

  it('两个都是 0 —— 买不起，差整价', () => {
    const p = planRedeemPayment(50, 0, 0)
    expect(p).toMatchObject({ affordable: false, shortfall: 50 })
  })

  it('总价永远等于两笔之和（账本要平）', () => {
    for (const [cost, h, pts] of [
      [50, 80, 300],
      [50, 50, 0],
      [50, 49, 1],
      [50, 0, 0],
      [1, 0, 0],
      [999, 12, 7],
    ] as const) {
      const p = planRedeemPayment(cost, h, pts)
      expect(p.harvestPaid + p.pointsPaid, `cost=${cost} h=${h} pts=${pts}`).toBe(p.total)
    }
  })

  it('负数 / 小数不会渗进账本（一律取整并夹到 0）', () => {
    expect(planRedeemPayment(50, -10, 300)).toMatchObject({ harvestPaid: 0, pointsPaid: 50 })
    expect(planRedeemPayment(50, 20.6, 300).harvestPaid).toBe(21)
    expect(planRedeemPayment(-50, 20, 300)).toMatchObject({ total: 0, affordable: true })
  })
})

describe('兑换分账：文案', () => {
  it('纯积分不写「+0 丰收币」', () => {
    expect(describeRedeemPayment({ harvestPaid: 0, pointsPaid: 50, cost: 50 })).toBe('50 积分')
  })

  it('纯丰收币不写「+0 积分」', () => {
    expect(describeRedeemPayment({ harvestPaid: 50, pointsPaid: 0, cost: 50 })).toBe('50 丰收币')
  })

  it('混合时两种都写出来', () => {
    expect(describeRedeemPayment({ harvestPaid: 20, pointsPaid: 30, cost: 50 })).toBe(
      '20 丰收币 + 30 积分',
    )
  })

  it('老记录没有分账字段 —— 当「全用积分」处理，不能显示成 0 分', () => {
    expect(describeRedeemPayment({ cost: 50 })).toBe('50 积分')
  })
})

describe('兑换记录的分账读取：两个字段缺省方向是反的', () => {
  it('老记录（只有 cost）→ 全算积分', () => {
    expect(paidOf({ cost: 50 })).toEqual({ harvestPaid: 0, pointsPaid: 50 })
  })

  it('新记录（两个字段都在）→ 原样读出', () => {
    expect(paidOf({ cost: 50, harvestPaid: 20, pointsPaid: 30 })).toEqual({
      harvestPaid: 20,
      pointsPaid: 30,
    })
  })

  it('只有 harvestPaid、没有 pointsPaid → 差额补成积分（不是把差额丢了）', () => {
    expect(paidOf({ cost: 50, harvestPaid: 20 })).toEqual({ harvestPaid: 20, pointsPaid: 30 })
  })

  it('纯丰收币的新记录：pointsPaid 显式是 0，不能被 `??` 改写成 cost', () => {
    // 这是最容易写错的一处：`pointsPaid ?? cost` 会把 0 当成"没填"，
    // 于是「全用丰收币」的记录显示成「还花了 50 积分」。
    expect(paidOf({ cost: 50, harvestPaid: 50, pointsPaid: 0 })).toEqual({
      harvestPaid: 50,
      pointsPaid: 0,
    })
    expect(describeRedeemPayment({ cost: 50, harvestPaid: 50, pointsPaid: 0 })).toBe('50 丰收币')
  })
})
