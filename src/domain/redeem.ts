/* ============================================================
   兑换分账（丰收币优先）
   ------------------------------------------------------------
   用户 2026-09-30：「兑换页面，优先用丰收币兑换。价值和积分等价的。
   用完丰收币再用积分，可混合。」

   规则：
   1. 丰收币和积分 **1:1 等价** —— 1 枚丰收币顶 1 分。
   2. **先花丰收币**，花光了再用积分。
   3. 一件东西可以**两种币混着付**（丰收币 30 + 积分 20 换 50 分的东西）。

   为什么这条不违反「丰收币 ⇸ 积分」（见 types.ts 的 HarvestEntry 注释）：
   那条约束禁的是「丰收币变回积分」这个**内部换算** ——
   一旦能变，农场产出 → 积分 → 买种子就成了闭环印钞机。
   而兑换是**出口**（换来的是零食/出去玩，退出系统），
   丰收币花在出口上不会回流成积分，所以安全。
   `HarvestSource` 里那个从没被用过的 `harvest_redeem` 就是为这条留的。
   ============================================================ */

export interface RedeemPayment {
  /** 用丰收币付掉多少（🌾） */
  harvestPaid: number
  /** 用积分付掉多少（🪙） */
  pointsPaid: number
  /** 总价 = harvestPaid + pointsPaid */
  total: number
  /** 两种币加起来够不够 */
  affordable: boolean
  /** 不够时还差多少（够的时候是 0） */
  shortfall: number
}

/**
 * 算出一次兑换怎么付。
 *
 * 纯函数：不读 store、不碰 DB，所以可以在事务里、在 UI 里、
 * 在测试里用**同一份**规则 —— 预览和真正扣款不会算出两个结果。
 */
export function planRedeemPayment(
  cost: number,
  harvestBalance: number,
  pointsBalance: number,
): RedeemPayment {
  // 余额和价格都取整：账本里存的本来就是整数，
  // 传进小数只可能是调用方算错了，这里兜一下而不是让它渗进账本。
  const price = Math.max(0, Math.round(cost))
  const harvest = Math.max(0, Math.round(harvestBalance))
  const points = Math.max(0, Math.round(pointsBalance))

  // 先花丰收币。`min` 而不是「够就全用丰收币」——
  // 丰收币比价格多的时候只能花掉价格那么多，剩下的留着下次用。
  const harvestPaid = Math.min(harvest, price)
  const pointsPaid = price - harvestPaid

  const available = harvest + points
  return {
    harvestPaid,
    pointsPaid,
    total: price,
    affordable: available >= price,
    shortfall: Math.max(0, price - available),
  }
}

/**
 * 从一条兑换记录（或任何带 `cost` 的对象）里读出分账，**兼容老记录**。
 *
 * 老记录（2026-09-30 之前）只有 `cost`，当年是全额走积分，所以缺省方向是：
 * `harvestPaid` 缺省 **0**、`pointsPaid` 缺省 **cost − harvestPaid**。
 *
 * ⚠️ 这两个字段的缺省方向是**相反的**，别记反 —— 记反了老记录会显示成
 * 「0 分换的」，而账面上明明扣过积分。
 */
export function paidOf(r: {
  cost: number
  harvestPaid?: number
  pointsPaid?: number
}): { harvestPaid: number; pointsPaid: number } {
  const harvestPaid = r.harvestPaid ?? 0
  return { harvestPaid, pointsPaid: r.pointsPaid ?? r.cost - harvestPaid }
}

/**
 * 一句话描述这次是怎么付的，给 toast / 记录列表用。
 *
 * 只出一种币时不写「+0」—— 那看着像出错。
 */
export function describeRedeemPayment(paid: {
  harvestPaid?: number
  pointsPaid?: number
  cost: number
}): string {
  const { harvestPaid, pointsPaid } = paidOf(paid)
  if (harvestPaid <= 0) return `${pointsPaid} 积分`
  if (pointsPaid <= 0) return `${harvestPaid} 丰收币`
  return `${harvestPaid} 丰收币 + ${pointsPaid} 积分`
}
