/* ============================================================
   心愿商城 —— 纯逻辑
   ------------------------------------------------------------
   这一层**不读 store、不碰 DB**，所以 UI 预览和真正扣券用的是同一份规则，
   测试也能直接跑（`wish.test.ts`）。

   设计口径见 `docs/wish-mall-spec.md`。三条最要紧的：

   1. **心愿商城收兑换券 + 积分，规则和「兑换」模块一字不差**：券先花、
      不够用积分补、1 券 ≡ 1 积分（2026-10-29 家长要求改的）。
      原来这里写的是「只收兑换券，不混付积分」，那条已经作废。
   2. **券必须真扣** —— 因为成交发生在 App 外面，不扣的话孩子能同时挂
      10 个「已兑换」，家长每个都得去淘宝买一遍。
   3. **盲盒先算池子再扣券** —— 池子空了要直接拒绝，不能先扣再发现没得开。
   ============================================================ */

import type { WishItem, WishKind } from './types'
import { planRedeemPayment } from './redeem'

/**
 * 分类标签。顺序就是 chips 的顺序（盲盒在前 —— 用户要求优先显示）。
 *
 * 2026-10-29 用户要求：「收藏换成其他，前面再加美食，出行。」
 * ⇒ 新增 `food` / `outing` 两档，`collectible` 的**显示名**从「收藏」改成
 * 「其他」（内部名不动，见 `WishKind` 的注释）。
 *
 * ⚠️ 这里多一档，心愿页和兑换页的 chips 就各多一个 —— chips 是从
 *    `Object.keys(WISH_KIND_META)` 生成的，不需要另改界面。但**空分类
 *    会真的出现一个点进去什么都没有的按钮**，所以 `wishCatalog.ts`
 *    里给这两档各配了样例商品。
 */
export const WISH_KIND_META: Record<
  WishKind,
  { label: string; emoji: string; digital: boolean }
> = {
  blindbox: { label: '盲盒', emoji: '🎁', digital: true },
  gamebox: { label: '游戏', emoji: '🎮', digital: true },
  toy: { label: '玩具', emoji: '🧸', digital: false },
  study: { label: '学习', emoji: '📚', digital: false },
  food: { label: '美食', emoji: '🍰', digital: false },
  outing: { label: '出行', emoji: '🎡', digital: false },
  collectible: { label: '其他', emoji: '✨', digital: false },
}

/** 「全部」这一档在 UI 里是 `null`，不是某个 `WishKind` */
export type WishFilter = WishKind | null

/**
 * 这次能不能换、两种币**各付多少**。
 *
 * 规则与「兑换」模块完全一致（2026-10-29 家长要求）：
 * **兑换券先花，不够再用积分补，1 券 ≡ 1 积分**。
 *
 * ⚠️ 这里**不要再写一遍分账公式**，直接委托 `planRedeemPayment`。
 *    两处各写一遍的话，改一处忘另一处时界面预览和真正扣款会算出两个数，
 *    差额通常只有几分 —— 孩子的余额看起来就是「莫名其妙少了 1」。
 *
 * ⚠️ `pointsBalance` **不给默认值**。默认 0 会让漏改的调用方静默退化成
 *    「积分永远用不上」，而这正是这次要修掉的行为。
 */
export function planWishRedeem(
  price: number,
  voucherBalance: number,
  pointsBalance: number,
): {
  affordable: boolean
  shortfall: number
  price: number
  voucherPaid: number
  pointsPaid: number
} {
  const p = planRedeemPayment(price, voucherBalance, pointsBalance)
  return {
    affordable: p.affordable,
    shortfall: p.shortfall,
    price: p.total,
    voucherPaid: p.harvestPaid,
    pointsPaid: p.pointsPaid,
  }
}

/**
 * 「已经拥有」的游戏 id 集合 —— 三个来源合并。
 *
 *   · `ownedGameIds`   —— 钻石商城买过的
 *   · `installedGames` —— 现在装着的
 *   · `redeemedGameIdsFrom(wishOrders)` —— 心愿单里兑换到手过的
 *
 * ⚠️ 第三个来源不能省：`uninstallGame` 会把包和存档一起删掉，删完之后
 *    前两个都认不出来（详见 `redeemedGameIdsFrom` 的注释）。
 *
 * ★ 抽成函数是因为**现在有两个地方要用**（心愿列表的过滤、兑换页里
 *   「已开放的心愿」那一块）。各写一遍的话，一边滤掉了另一边没滤，
 *   孩子就会在兑换列表里看到自己已经有的游戏 —— 那正是 2026-10-29
 *   刚修过的那个毛病。
 */
export function wishOwnedSet(
  ownedGameIds: readonly string[],
  installedGames: Record<string, unknown>,
  wishOrders: readonly { status: string; openedGameId?: string }[],
): Set<string> {
  return new Set<string>([
    ...ownedGameIds,
    ...Object.keys(installedGames),
    ...redeemedGameIdsFrom(wishOrders),
  ])
}

/**
 * 家长**还没回应**的心愿单。
 *
 * ## 为什么不是简单的 `status === 'wished'`
 *
 * 家长定价之后，那条单子**仍然停在 `wished`** —— 它要等到孩子真的去兑换，
 * 才会被 `wishRedeem` 复用并翻成 `committed`（见那边「同一件商品如果之前
 * 只是想要，复用那一行」的注释）。
 *
 * 于是「`wished` 还没被回应」和「`wished` 已经开放了、等孩子来换」在
 * **数据上是同一个状态**。只按状态算的话，上边栏 👀 那个红点会永远消不掉：
 * 家长定完价、孩子还没换，红点还在；家长再点进去，看到的却是一件已经
 * 开放的商品 —— 一个点不完的数字比没有红点更糟。
 *
 * 判据取「这件商品现在有没有开放价」：定价就是家长的**回应**。
 *
 * ⚠️ `closedAt` 的行不算开放（家长把它关了）。关掉之后这条心愿重新变回
 *    「等你回应」是对的 —— 孩子当初想换的东西又换不了了。
 */
export function wishesAwaitingReply<T extends { itemId: string; status: string }>(
  orders: readonly T[],
  offers: readonly { itemId: string; voucherPrice: number; closedAt?: number }[],
): T[] {
  const priced = new Set(
    offers.filter((o) => !o.closedAt && o.voucherPrice > 0).map((o) => o.itemId),
  )
  return orders.filter((o) => o.status === 'wished' && !priced.has(o.itemId))
}

/**
 * 「兑换」列表里那一块「爸妈已经开放的心愿」。
 *
 * 家长原话：「爸爸妈妈已经定好价格的，相当于添加了兑换，应该出现在
 * 兑换列表里」。所以**定价 = 上架**，孩子不用特意切到心愿那一格才发现
 * 有东西能换。
 *
 * ## 四个排除条件，一个都不能少
 *
 *   1. **没定价 / 已关闭** —— 那是「等爸妈回应」，不是能换的东西。
 *   2. **下架了**（`archived`）—— 目录里撤掉的商品不该还挂在兑换列表上。
 *   3. **已经有了** —— 走 `wishOwnedSet` 同一套规则（游戏盒子）。
 *      少了这一条，孩子会在这里看到自己早就换到的游戏，点进去又是
 *      「这个游戏你已经有了」—— 2026-10-29 刚在心愿页修过的毛病。
 *   4. **盲盒开完了** —— 池子空了还摆在「能换什么」里，点进去只会被拒。
 *
 * ★ 另外排除**已经在走流程**的单子（`committed` / `confirmed`）：
 *   那件东西已经付过钱了，再列一次等于鼓励孩子换第二遍。
 *   `wished` **不排除** —— 家长定了价，孩子就该能去换，而 `wishRedeem`
 *   会复用那一行。
 */
export function wishShelf(
  items: readonly WishItem[],
  offers: readonly { itemId: string; voucherPrice: number; closedAt?: number }[],
  owned: ReadonlySet<string>,
  orders: readonly { itemId: string; status: string }[],
): { item: WishItem; price: number }[] {
  const byId = new Map(items.map((i) => [i.id, i]))
  const inFlight = new Set(
    orders
      .filter((o) => o.status === 'committed' || o.status === 'confirmed')
      .map((o) => o.itemId),
  )

  const out: { item: WishItem; price: number }[] = []
  for (const offer of offers) {
    if (offer.closedAt || offer.voucherPrice <= 0) continue
    if (inFlight.has(offer.itemId)) continue

    const item = byId.get(offer.itemId)
    if (!item || item.archived) continue

    if (item.kind === 'gamebox' && item.gameId && owned.has(item.gameId)) continue
    if (item.kind === 'blindbox' && blindBoxRemaining(item.pool ?? [], [...owned]).length === 0) {
      continue
    }

    out.push({ item, price: offer.voucherPrice })
  }
  // 和心愿页同一个顺序（盲盒在最前），两处看到的先后一致
  return out.sort((a, b) => compareWishItem(a.item, b.item))
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

/** 状态标签的色系。'blue' 是「等对方动作」，'amber' 是「等你动作」 */
export type WishTone = 'green' | 'gray' | 'amber' | 'blue'

const STATUS_TONE: Record<string, WishTone> = {
  wished: 'blue',
  committed: 'amber',
  confirmed: 'blue',
  done: 'green',
  cancelled: 'gray',
}

/**
 * 记录里那一行的状态说法。
 *
 * ⚠️ 数字商品交付完还在 `committed`（等家长收尾），但界面上**不能**说
 * 「等爸妈确认」—— 孩子已经拿到游戏了。这条规则在详情页 / 卡片上已经写过，
 * 记录页也要一致，否则同一单在两屏里说两种话。
 *
 * 2026-10-29 从 `WishPage.tsx` 搬到这里：兑换页的「📜 兑换记录」现在也
 * 要列这些单子，两处各写一份迟早会飘（家长问的正是「游戏换了为什么
 * 兑换记录里没有」）。
 */
export function orderStatusLabel(o: { status: string; openedGameId?: string }): string {
  if (o.openedGameId && (o.status === 'committed' || o.status === 'confirmed')) {
    return '已放进游戏柜'
  }
  return WISH_STATUS_TEXT[o.status] ?? o.status
}

export function orderStatusTone(o: {
  status: string
  openedGameId?: string
}): WishTone {
  if (o.openedGameId && (o.status === 'committed' || o.status === 'confirmed')) return 'green'
  return STATUS_TONE[o.status] ?? 'gray'
}

/* ============================================================
   「还没走完」的两个口径 —— **故意不相等**，别拿一个去统一另一个
   ============================================================ */

/**
 * 券已经扣了、**还等着爸妈动手**的单子。
 *
 * ⚠️ 它**包含已交付的数字商品**：游戏已经装进柜子，但单子还没 `done`，
 * 家长仍要收尾（心愿页顶部那张卡就是列这个，文案写「已放进游戏柜，等爸妈收尾」）。
 */
export function needsParentAction(o: { status: string }): boolean {
  return o.status === 'committed' || o.status === 'confirmed'
}

/**
 * 孩子那一屏（「📜 兑换记录」tab 上那个数字）算的「还没兑现」。
 *
 * 和 `needsParentAction` 只差一个条件：**已交付的数字商品不算**。
 * 理由不是数据，是**读者不同** —— 兑换页是孩子的收银台，那一行的标签已经写着
 * 绿的「已放进游戏柜」，再挂一个红数字就是自相矛盾（2026-10-29 截图走查抓到的
 * 正是「红点 1 + 绿标签」）。而家长的收尾待办在心愿页顶部那张卡里，一张都没漏。
 *
 * 判据：**同一个 `committed` 单子，心愿页说「有 1 单在等爸妈处理」、
 * 兑换记录没有徽标 —— 这不是 bug。** 见 `redeemHistory` 的 `pending` 字段。
 */
export function childPending(o: { status: string; openedGameId?: string }): boolean {
  return needsParentAction(o) && !o.openedGameId
}
