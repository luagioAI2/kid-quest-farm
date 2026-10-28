/* ============================================================
   心愿商城 —— 纯逻辑
   ------------------------------------------------------------
   这一层**不读 store、不碰 DB**，所以 UI 预览和真正扣券用的是同一份规则，
   测试也能直接跑（`wish.test.ts`）。

   设计口径见 `docs/wish-mall-spec.md`。三条最要紧的：

   1. **心愿商城只收兑换券**，不混付积分（与「兑换」不同）。
   2. **券必须真扣** —— 因为成交发生在 App 外面，不扣的话孩子能同时挂
      10 个「已兑换」，家长每个都得去淘宝买一遍。
   3. **盲盒先算池子再扣券** —— 池子空了要直接拒绝，不能先扣再发现没得开。
   ============================================================ */

import type { WishKind } from './types'

/** 分类标签。顺序就是 chips 的顺序（盲盒在前 —— 用户要求优先显示） */
export const WISH_KIND_META: Record<
  WishKind,
  { label: string; emoji: string; digital: boolean }
> = {
  blindbox: { label: '盲盒', emoji: '🎁', digital: true },
  gamebox: { label: '游戏', emoji: '🎮', digital: true },
  toy: { label: '玩具', emoji: '🧸', digital: false },
  study: { label: '学习', emoji: '📚', digital: false },
  collectible: { label: '收藏', emoji: '✨', digital: false },
}

/** 「全部」这一档在 UI 里是 `null`，不是某个 `WishKind` */
export type WishFilter = WishKind | null

/**
 * 这次能不能换。
 *
 * 只有一个判断：券够不够。**不接受积分补足** —— 混付会让
 * 「积分能不能换实物」变成一个是非题，而它应该是「不能」。
 */
export function planWishRedeem(
  price: number,
  voucherBalance: number,
): { affordable: boolean; shortfall: number; price: number } {
  // 取整兜底：账本里存的本来就是整数，传进小数只可能是调用方算错了
  const p = Math.max(0, Math.round(price))
  const have = Math.max(0, Math.round(voucherBalance))
  return { affordable: have >= p, shortfall: Math.max(0, p - have), price: p }
}

/**
 * 从心愿单里反推「**兑换到手过**」的游戏 id。
 *
 * ## 为什么需要它
 *
 * 游戏类商品的交付 = 装包，而「拥有」一直是从 `installedGames` 派生的。
 * 但 `uninstallGame` 会把包和存档一起删掉 —— 删完之后这个游戏就
 * **既不在 `installedGames`、也不在 `mallLedger`**（心愿商城不走钻石账本），
 * 于是心愿商城认为「孩子没买过」：
 *
 *   · 盒子卡片变回可兑换 → **再扣一次券**；
 *   · 盲盒池子把它放回去 → **再开出来一次**。
 *
 * 券是真金白银攒的，卸载一次就白扣一次，而且全程不报错。
 * 所以「兑换过」必须有一份**独立的、卸载不掉**的记录 —— 就是 `wishOrders`。
 *
 * ## 哪些状态算「到手过」
 *
 * `committed` / `confirmed` / `done` —— 券已经扣了、游戏已经装上了。
 * `wished` 不算（还没扣券），`cancelled` 不算（券退回去了，
 * 而且孩子确实没拿到东西）。
 */
export function redeemedGameIdsFrom(
  orders: readonly { status: string; openedGameId?: string }[],
): string[] {
  const out = new Set<string>()
  for (const o of orders) {
    if (!o.openedGameId) continue
    if (o.status === 'committed' || o.status === 'confirmed' || o.status === 'done') {
      out.add(o.openedGameId)
    }
  }
  return [...out]
}

/**
 * 盲盒还能开出哪些。
 *
 * `pool` 是目录里写死的候选（见 `WishItem.pool`），`owned` 是这个家庭
 * **当前已拥有**的游戏 id。交集之外的才是能开出来的。
 *
 * 去重是必须的：池子里同一个 id 写两次会让那一款的概率翻倍，
 * 而这种错误在代码里看不出来，只有概率分布变了。
 */
export function blindBoxRemaining(
  pool: readonly string[],
  owned: readonly string[],
): string[] {
  const have = new Set(owned)
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of pool) {
    if (have.has(id) || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * 开一个盲盒。池子空了返回 `null`（调用方必须**先判断**再扣券）。
 *
 * `rand` 可注入是为了让测试能钉死结果 —— 用 `Math.random()` 的测试
 * 只能断言「开出来的一定在池子里」，断言不了「全拥有时开不出来」。
 */
export function pickBlindBox(
  pool: readonly string[],
  owned: readonly string[],
  rand: () => number = Math.random,
): string | null {
  const remaining = blindBoxRemaining(pool, owned)
  if (remaining.length === 0) return null
  // `Math.random()` 理论上可能返回 1（规范上不会，但别赌）
  const i = Math.min(remaining.length - 1, Math.floor(rand() * remaining.length))
  return remaining[i]
}

/**
 * 「大约要攒几天」。
 *
 * 这是详情页上唯一一个**比价格更像财商教育**的数字：教的是「想要的东西要等」。
 * 日均是 0 或负数时返回 `null` —— 显示「要攒 ∞ 天」比不显示更糟。
 */
export function daysToSave(price: number, perDay: number): number | null {
  const p = Math.max(0, Math.round(price))
  if (p <= 0) return 0
  if (!Number.isFinite(perDay) || perDay <= 0) return null
  return Math.max(1, Math.ceil(p / perDay))
}

/**
 * 列表排序：**盲盒永远在最前**，其余按 `sortOrder`，最后按名字。
 *
 * 用户明确要求「优先显示游戏盲盒」。这条规则放在这里而不是组件里，
 * 是因为列表、搜索、家长端都要用同一种顺序 —— 三处各写一遍迟早会飘。
 */
export function compareWishItem(
  a: { kind: WishKind; sortOrder?: number; name: string },
  b: { kind: WishKind; sortOrder?: number; name: string },
): number {
  const rank = (k: WishKind) => (k === 'blindbox' ? 0 : 1)
  const ra = rank(a.kind)
  const rb = rank(b.kind)
  if (ra !== rb) return ra - rb
  const sa = a.sortOrder ?? 100
  const sb = b.sortOrder ?? 100
  if (sa !== sb) return sa - sb
  return a.name.localeCompare(b.name, 'zh-Hans-CN')
}

/** 状态的中文说法。列表、详情、家长端共用，别在组件里各写一份 */
export const WISH_STATUS_TEXT: Record<string, string> = {
  wished: '等爸妈定价',
  committed: '等爸妈确认',
  confirmed: '爸妈去买啦',
  done: '已经拿到',
  cancelled: '已取消',
}
