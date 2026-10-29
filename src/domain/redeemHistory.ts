/* ============================================================
   「📜 兑换记录」= 家里换的 + 心愿换的，合成一屏
   ------------------------------------------------------------
   家长原话（2026-10-29）：

     「孩子刚兑换了一个游戏，为啥我兑换记录里看不到。我之前说了，在兑换里
      兑换的，都跟其他兑换的一样的，只是游戏属于一次性的，兑换完就不用
      显示在兑换列表里。」

   问题出在**两张表**：家里那几件写 `redeemRecords`，心愿/游戏写
   `wishOrders`。兑换页的记录页只读前者 ⇒ 孩子在兑换页换了一款游戏，
   扣了券、游戏也装上了，记录里却一个字都没有。界面上看不出任何异常，
   只有家长去对账时才会发现「券少了 30，找不到花在哪」。

   所以记录页必须**读两张表、排一条时间线**。这一层是纯函数：
   不读 store、不碰 DB。

   ⚠️ 目前只有「📜 兑换记录」用它。「我许的愿」（心愿页右上角那一屏）**不用** ——
      它要连 `wished` 一起列（那是「我提过什么」，哪怕一分钱没扣），
      而这里刻意把 `wished` 滤掉了。两屏的**筛选条件不同**，但付款文案必须
      同源（都走 `describeRedeemPayment`），别在这里各写一份金额字符串。

   ⚠️ `wished` 不算兑换 —— 那是「想要」，一分钱没扣。列进来的话会显示
      「0 积分」或者按标价显示，两种都是假账。
   ============================================================ */

import type { RedeemRecord, WishOrder } from './types'
import { describeRedeemPayment } from './redeem'
import { orderStatusLabel, orderStatusTone, type WishTone } from './wish'

export interface HistoryRow {
  /** 主键。两张表各自的 id，不会撞（`rd_` / `wo_`） */
  id: string
  name: string
  emoji: string
  createdAt: number
  /** 「30 兑换券 + 20 积分」这种一句话，和商品行上的付款行同一套写法 */
  pay: string
  /** 状态文字，例如「待兑现」/「已放进游戏柜」 */
  tag: string
  tone: WishTone
  /** 还算「待兑现」—— tab 上那个数字用这个算 */
  pending: boolean
  /** 游戏单：交付凭证（`openedGameId`），列表里可以标「已放进游戏柜」 */
  delivered: boolean
}

/**
 * 合并成一条按时间倒序的流水。
 *
 * `limit` 默认 50：记录页是**对账**用的，不是档案库。两张表各自也只加载
 * 最近几十条（`loadRedeemRecords` 60 条），再多翻起来没人看。
 */
export function redeemHistory(
  records: readonly RedeemRecord[],
  orders: readonly WishOrder[],
  limit = 50,
): HistoryRow[] {
  const rows: HistoryRow[] = []

  for (const r of records) {
    rows.push({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      createdAt: r.createdAt,
      // 走 `describeRedeemPayment` 而不是手拼 —— 老记录的两个字段缺省方向相反，
      // 手写 `?? cost` 会把「0 券 + 30 积分」显示成「30 券」。
      pay: describeRedeemPayment(r),
      tag: r.fulfilled ? '已兑现' : '待兑现',
      tone: r.fulfilled ? 'green' : 'amber',
      pending: !r.fulfilled,
      delivered: false,
    })
  }

  for (const o of orders) {
    // 只表过态、没扣币 —— 不是兑换
    if (o.status === 'wished') continue

    rows.push({
      id: o.id,
      name: o.itemName,
      emoji: o.itemEmoji,
      createdAt: o.createdAt,
      // 押的是**实际扣掉的两种币**（`vouchersHeld` / `pointsHeld`），不是标价：
      // 混付那一单标价 150、实扣 100 券 + 50 积分，记录要写后者。
      pay: describeRedeemPayment({
        cost: o.voucherPrice,
        harvestPaid: o.vouchersHeld,
        pointsPaid: o.pointsHeld ?? 0,
      }),
      // 取消的单子要写清「钱退回来了」，不然家长以为券白花了
      tag: o.status === 'cancelled' ? '已取消 · 已退回' : orderStatusLabel(o),
      tone: orderStatusTone(o),
      /**
       * ⚠️ 已经交付的数字商品**不算**待兑现。
       *
       * 它确实还停在 `committed`（等家长点「完成这一单」），但东西孩子已经
       * 拿到手了 —— 计数把它算进去的话，记录页会出现「红点 1 + 绿标签
       * 已放进游戏柜」这种自相矛盾的一屏（截图走查抓到过）。
       * 家长那边的收尾提示在心愿页顶部，不靠这个数。
       */
      pending:
        (o.status === 'committed' || o.status === 'confirmed') && !o.openedGameId,
      delivered: !!o.openedGameId,
    })
  }

  return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit)
}
