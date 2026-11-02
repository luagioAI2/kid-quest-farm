import { describe, expect, it } from 'vitest'
import { describeRedeemPayment, paidOf, pickTodayCount, planRedeemPayment } from './redeem'

/* ============================================================
   兑换分账：兑换券优先 + 可混合
   ------------------------------------------------------------
   用户 2026-09-30：「优先用商城币兑换。价值和积分等价的。
   用完兑换券再用积分，可混合。」

   这组测试钉的是**分账规则本身**。store 层的 `redeem()` 和兑换页的
   预览都调同一个函数，所以规则改了这里会红，而不是让界面和账本各算各的。
   ============================================================ */

describe('兑换分账：兑换券优先', () => {
  it('兑换券够 —— 全用兑换券，积分一分不动', () => {
    const p = planRedeemPayment(50, 80, 300)
    expect(p).toMatchObject({ harvestPaid: 50, pointsPaid: 0, affordable: true, shortfall: 0 })
  })

  it('兑换券刚好够 —— 边界，不要多扣一枚', () => {
    const p = planRedeemPayment(50, 50, 300)
    expect(p).toMatchObject({ harvestPaid: 50, pointsPaid: 0, affordable: true })
  })

  it('兑换券差 1 —— 剩下那 1 从积分补，这就是「可混合」', () => {
    const p = planRedeemPayment(50, 49, 300)
    expect(p).toMatchObject({ harvestPaid: 49, pointsPaid: 1, affordable: true })
  })

  it('兑换券花光还不够 —— 剩余全走积分', () => {
    const p = planRedeemPayment(50, 20, 300)
    expect(p).toMatchObject({ harvestPaid: 20, pointsPaid: 30, affordable: true })
  })

  it('兑换券为 0 —— 退回「纯积分」的老行为', () => {
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
  it('纯积分不写「+0 兑换券」', () => {
    expect(describeRedeemPayment({ harvestPaid: 0, pointsPaid: 50, cost: 50 })).toBe('50 积分')
  })

  it('纯兑换券不写「+0 积分」', () => {
    expect(describeRedeemPayment({ harvestPaid: 50, pointsPaid: 0, cost: 50 })).toBe('50 兑换券')
  })

  it('混合时两种都写出来', () => {
    expect(describeRedeemPayment({ harvestPaid: 20, pointsPaid: 30, cost: 50 })).toBe(
      '20 兑换券 + 30 积分',
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

  it('纯兑换券的新记录：pointsPaid 显式是 0，不能被 `??` 改写成 cost', () => {
    // 这是最容易写错的一处：`pointsPaid ?? cost` 会把 0 当成"没填"，
    // 于是「全用兑换券」的记录显示成「还花了 50 积分」。
    expect(paidOf({ cost: 50, harvestPaid: 50, pointsPaid: 0 })).toEqual({
      harvestPaid: 50,
      pointsPaid: 0,
    })
    expect(describeRedeemPayment({ cost: 50, harvestPaid: 50, pointsPaid: 0 })).toBe('50 兑换券')
  })
})

/* ============================================================
   「今天换了几次」谁说了算（2026-11-02 晚）
   ------------------------------------------------------------
   服务端按**自然日 0 点**数（`RedeemService.todayStart`），本地按**逻辑日 4 点**
   数（`appDayKey`）。00:00–04:00 这四小时里本地会多算「昨晚那次」⇒
   界面把「每天最多 1 次」的按钮禁掉，而服务端明明会放行。

   这条规则只能单测：`isOnlineMode` 是构建期常量，`vitest.config.ts` 钉成 local，
   测试里造不出「在线版」的 store。
   ============================================================ */

describe('pickTodayCount（界面别自己数）', () => {
  it('在线版 + 服务端有数 ⇒ 用服务端的', () => {
    // 典型场景：凌晨 1 点，本地按逻辑日数出 1（含昨晚那次），服务端说是 0
    expect(pickTodayCount(true, 0, 1)).toBe(0)
  })

  it('在线版但服务端没给（没拉到 / 离线）⇒ 退回本地数，别显示成 0', () => {
    // 显示 0 会让「每天最多 1 次」的东西在离线时变成能无限换
    expect(pickTodayCount(true, undefined, 1)).toBe(1)
  })

  it('本地版 ⇒ 一律本地数（服务端那个字段根本不会有）', () => {
    expect(pickTodayCount(false, 5, 1)).toBe(1)
    expect(pickTodayCount(false, undefined, 0)).toBe(0)
  })

  it('★ 服务端给的 0 是「今天还没换过」，不能被 `||` 或 `??` 当成没填', () => {
    expect(pickTodayCount(true, 0, 3)).toBe(0)
  })
})
