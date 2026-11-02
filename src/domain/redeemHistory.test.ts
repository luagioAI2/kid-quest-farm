import { describe, expect, it } from 'vitest'
import { redeemHistory } from './redeemHistory'
import type { RedeemRecord, WishOrder } from './types'

/* ============================================================
   兑换记录 = 两张表合一条时间线（2026-10-29）
   ------------------------------------------------------------
   家长原话：「孩子刚兑换了一个游戏，为啥我兑换记录里看不到。」

   原因是数据分了两处：家里那几件写 `redeemRecords`，心愿/游戏写
   `wishOrders`。这一层的存在就是为了让「记录」这个词只有一个答案。
   ============================================================ */

function rec(patch: Partial<RedeemRecord> = {}): RedeemRecord {
  return {
    id: 'rd_1',
    itemId: 'it_snack',
    name: '一份小零食',
    emoji: '🍪',
    cost: 30,
    harvestPaid: 30,
    pointsPaid: 0,
    balanceAfter: 100,
    fulfilled: false,
    createdAt: 1000,
    ...patch,
  }
}

function order(patch: Partial<WishOrder> = {}): WishOrder {
  return {
    id: 'wo_1',
    itemId: 'wish-game-renttower',
    itemName: '收租公寓',
    itemEmoji: '🏢',
    kind: 'gamebox',
    voucherPrice: 30,
    status: 'committed',
    vouchersHeld: 30,
    pointsHeld: 0,
    createdAt: 2000,
    ...patch,
  }
}

describe('redeemHistory', () => {
  it('★ 游戏单也在记录里（家长问的就是这一条）', () => {
    const rows = redeemHistory([], [order({ openedGameId: 'renttower' })])
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('收租公寓')
    expect(rows[0].tag, '数字商品交付完不能说「等爸妈确认」').toBe('已放进游戏柜')
    expect(rows[0].delivered).toBe(true)
    // 东西已经给孩子了，不该再算进「待兑现」那个红点 ——
    // 否则记录页会出现「红点 1 + 绿标签 已放进游戏柜」的自相矛盾
    expect(rows[0].pending).toBe(false)
  })

  it('★★ 家长填的订单号要带进记录（填了看不见等于没填）', () => {
    const rows = redeemHistory(
      [],
      [order({ kind: 'collectible', status: 'done', buyOrderNo: 'SF1234567890' })],
    )
    expect(rows[0].orderNo).toBe('SF1234567890')
  })

  it('没填订单号 ⇒ 字段不出现（界面上不该有个空的「订单号」）', () => {
    const rows = redeemHistory([], [order({ status: 'done', buyOrderNo: '' })])
    expect(rows[0].orderNo).toBeUndefined()
    expect('orderNo' in rows[0], '空串要按「没填」处理，别写成空字符串').toBe(false)
  })

  it('家里那几件（App 内兑现）没有外链订单号这回事', () => {
    const rows = redeemHistory([rec({ fulfilled: true })], [])
    expect(rows[0].orderNo).toBeUndefined()
  })

  it('实物单还挂在 committed 时要算待兑现（爸妈得去买）', () => {
    const rows = redeemHistory([], [order({ kind: 'collectible', openedGameId: undefined })])
    expect(rows[0].pending).toBe(true)
  })

  it('「想要」不算兑换 —— 一分钱没扣，不能进记录', () => {
    // 列进来的话会显示「🎫 0」或者按标价显示，两种都是假账
    expect(redeemHistory([], [order({ status: 'wished', vouchersHeld: 0 })])).toHaveLength(0)
  })

  it('★ 混付的单子记的是**实际扣掉的两种币**，不是标价', () => {
    const rows = redeemHistory(
      [],
      [order({ voucherPrice: 150, vouchersHeld: 100, pointsHeld: 50 })],
    )
    expect(rows[0].pay).toBe('100 兑换券 + 50 积分')
  })

  it('取消的单子写清「已退回」，不然家长以为券白花了', () => {
    const rows = redeemHistory([], [order({ status: 'cancelled' })])
    expect(rows[0].tag).toBe('已取消 · 已退回')
    expect(rows[0].tone).toBe('gray')
    expect(rows[0].pending, '取消的不该算进「待兑现」那个数字').toBe(false)
  })

  it('家里的记录：待兑现 / 已兑现', () => {
    const rows = redeemHistory([rec({ id: 'a' }), rec({ id: 'b', fulfilled: true })], [])
    expect(rows.map((r) => r.tag).sort()).toEqual(['已兑现', '待兑现'])
    expect(rows.find((r) => r.id === 'a')?.pending).toBe(true)
  })

  it('★ 老记录（没有 harvestPaid / pointsPaid）读成纯积分', () => {
    // 两个字段的缺省方向相反：`harvestPaid` 默认 0、`pointsPaid` 默认 cost。
    // 写反了会把「30 积分」显示成「30 兑换券」—— 账面上却是扣的积分。
    const old = rec({ id: 'old', harvestPaid: undefined, pointsPaid: undefined })
    expect(redeemHistory([old], [])[0].pay).toBe('30 积分')
  })

  it('两张表按时间倒序混排', () => {
    const rows = redeemHistory(
      [rec({ id: 'r1', createdAt: 1000 }), rec({ id: 'r2', createdAt: 3000 })],
      [order({ id: 'o1', createdAt: 2000 })],
    )
    expect(rows.map((r) => r.id)).toEqual(['r2', 'o1', 'r1'])
  })

  it('超过 limit 就截断（记录页是对账用的，不是档案库）', () => {
    const many = Array.from({ length: 8 }, (_, i) => rec({ id: `r${i}`, createdAt: i }))
    expect(redeemHistory(many, [], 5)).toHaveLength(5)
  })
})
