import { api } from './client'
import type { ApiWishCodeResult } from './types'
import { toServerShip, type ShipDraft } from '../domain/wishShip'

/* ============================================================
   心愿商城（tf-platform-api `/api/wish/*`）
   ------------------------------------------------------------
   这一层有两种读者，别混：

   ① **兑换码**（`redeemWishCode`）—— 本地版和在线版都在用。
      家长在淘宝/天猫/京东买游戏，卖家会发一串 6 位激活码（没有实体卡）。
      输进心愿商城的商品详情页 / 家长定价页（`features/wish/CodeRedeemBlock.tsx`）→
      （`设置 / 游戏 / 有兑换码？` 那个入口 2026-11-07 按家长要求删了）
      服务端验码并**直接授予游戏**。

      ⚠️ 这个接口是**写操作**，而且不可撤销：
      服务端在同一个事务里验码、标记已用、写 `user_game`。
      所以调用方必须把「网络失败」和「码无效」分开说 ——
      网络失败时码**没被用掉**，可以原样再试；码无效时再试多少次都一样。
      `client.ts` 已经把这两种情况分成 `isNetwork` / 业务码，别在外面自己判。

   ② **心愿单本身**（本文件下半部分）—— 只有在线版用。
      本地版把 `wishOffers` / `wishOrders` 存在 Dexie 里自己算，一条接口都不调。

   ★ 商品目录**不在这一层**：它是随版本发布的常量（`games/wishCatalog.ts`），
     服务端 `seed/wish_catalog.go` 存的是同一份目录的副本（id 一致），
     用途只有「定价 / 兑换时能查到这件商品」。见 `docs/online-version.md` §7.11。
   ============================================================ */

export const redeemWishCode = (code: string) =>
  api<ApiWishCodeResult>('/wish/redeem-code', { code })

/* ============================================================
   心愿单
   ============================================================ */

/** 商品分类（服务端内部名，与本地 `WishKind` 一一对应） */
export type ServerWishKind =
  | 'blindbox'
  | 'gamebox'
  | 'toy'
  | 'study'
  | 'food'
  | 'outing'
  | 'collectible'

export type ServerWishStatus = 'wished' | 'committed' | 'confirmed' | 'done' | 'cancelled'

/**
 * `/wish/list` 的一行 —— **是视图，不是商品表**。
 *
 * 除了商品本身的字段（和本地常量同名同义），还带着服务端算好的一堆标注：
 * `open` / `voucher_price` / `affordable` / `shortfall` / `has_order` /
 * `order_status` / `owned` / `my_wish` / `last_reject_reason` /
 * `days_to_save` / `blind_box_remaining`。
 *
 * ⚠️ 客户端**只用它两件事**：`open` + `voucher_price`（拼 `WishOffer` 行）。
 *    别的标注一律不落库 —— 本地版的界面是从 `wishOffers` + `wishOrders` +
 *    目录常量**自己算**出来的（`domain/wish.ts`），两套算法并存的话，
 *    「差多少券」「已拥有」这些数在两个版本里会不一致。
 *
 * ⚠️ 而且这个列表**会漏行**：`gamebox` 且已拥有的商品服务端直接不返回
 *    （换不了、也没动作）。拿它当「商品全集」会得出错误的结论 ——
 *    商品全集是 `WISH_ITEMS` 常量。
 */
export interface ServerWishItemView {
  id: string
  kind: ServerWishKind
  name: string
  emoji: string
  tint: string
  partner_name: string
  pool: string[] | null
  game_id: string
  price_cents: number
  age_range: number[] | null
  note: string
  notice: string
  archived: boolean
  sort_order: number
  /** 一次开出几款（盲盒用；缺省 1） */
  unlock_count?: number
  /**
   * 运营在 tf-admin「商城」列表里配的外链（淘宝 / 京东…）。
   *
   * ⚠️ **空 / 缺省 = 没配 = 客户端不摆「去购买」**。别在这边补默认值 ——
   *    那又会变回「后台没配、按钮还在」。
   */
  buy_url?: string
  /** 外链按钮文字（空 = 客户端用「去购买」） */
  buy_label?: string
  // ---- 服务端算的标注（客户端只取前两个）----
  open: boolean
  voucher_price: number
  /** 是否一次性兑换（服务端返回） */
  one_time?: boolean
  affordable: boolean
  shortfall: number
  has_order: boolean
  order_status?: ServerWishStatus
  owned: boolean
  my_wish: boolean
  last_reject_reason?: string
  days_to_save: number
  blind_box_remaining: number
}

/**
 * 心愿单 / 兑换单。
 *
 * ⚠️ `id` 是服务端生成的 `WO…`，本地要加 `srv_wo_` 前缀（见 `sync/map.ts`）。
 * ⚠️ 时间是 **unix 秒**，而且是 `*int64`（Go 的指针）⇒ 没发生的阶段是 `null`，
 *    不是 0。当成 0 读会显示成「1970 年确认的」。
 * ⚠️ `ship` 只在 `as_parent: true` 时是完整的；孩子端拿到的是脱敏版
 *    （手机 `****1234`、详细地址为空）。拉取时统一用 `as_parent: true` ——
 *    同一台设备、同一个账号，家长那一屏要能发货。
 */
export interface ServerWishOrder {
  id: string
  item_id: string
  kind: ServerWishKind
  item_name: string
  item_emoji: string
  partner_name: string
  voucher_price: number
  status: ServerWishStatus
  vouchers_held: number
  points_held: number
  opened_game_id: string
  /** 「一次开 N 款」的完整清单；老服务端没有这个字段 */
  opened_game_ids?: string[] | null
  code_tail: string
  ship: ServerWishShip | null
  tracking_no: string
  committed_at: number | null
  confirmed_at: number | null
  done_at: number | null
  cancelled_at: number | null
  cancel_reason: string
  created_at: number
  updated_at: number
  // ---- 视图字段 ----
  status_text: string
  digital: boolean
  game_name?: string
  buy_url?: string
  buy_label?: string
}

export interface ServerWishShip {
  receiver: string
  phone: string
  region: string
  address: string
  note?: string
  purge_after: number
}

/** 家长待办（`/wish/pending`）。客户端暂时不用，留个形状备查 */
export interface ServerWishPending {
  wished_count: number
  action_count: number
  total: number
  wished_items: Array<{
    order_id: string
    item_id: string
    name: string
    emoji: string
    status: ServerWishStatus
    kind: ServerWishKind
  }>
  action_items: ServerWishPending['wished_items']
}

/**
 * 商品列表（含「本家庭开不开放」）。
 *
 * @param includeArchived `true` = 连下架的一起给。
 *   镜像到本地时必须用它 —— 家长可能给一件后来下架的商品定过价，
 *   只拉在架的话那条 `WishOffer` 就没了，孩子那单会变成「爸妈还没定价」。
 */
export const listWishItems = (opts: { includeArchived?: boolean; kind?: ServerWishKind } = {}) =>
  api<{ list: ServerWishItemView[] | null; count: number }>('/wish/list', {
    include_archived: opts.includeArchived ?? false,
    ...(opts.kind ? { kind: opts.kind } : {}),
  })

/**
 * 家长定价 / 开放。
 *
 * `voucherPrice = 0` = **关闭**（服务端把 `closed_at` 置为当前时间，不删行 ——
 * 孩子之前换过的历史还要能解释）。重新定价会把 `closed_at` 清回 0。
 *
 * ⚠️ 服务端的 `voucher_price` 是 `binding:"omitempty,min=0"`，
 *    所以**必须显式带 0**，不能靠「不传」表示关闭 —— 不传等于没改。
 */
export const setWishOffer = (
  itemId: string,
  voucherPrice: number,
  diamondPrice = 0,
  oneTime?: boolean,
) =>
  api<{ item_id: string; voucher_price: number; diamond_price: number }>('/wish/set-offer', {
    item_id: itemId,
    voucher_price: voucherPrice,
    diamond_price: diamondPrice,
    one_time: oneTime,
  })

/**
 * 孩子「想要这个」。**不扣钱**，只是意向。
 *
 * 服务端对「已经有进行中订单」是**幂等**的：直接返回那一单，不新建。
 */
export const expressWish = (itemId: string) =>
  api<ServerWishOrder>('/wish/wish', { item_id: itemId })

/**
 * 孩子「确定兑换」—— 服务端在**一个事务里**：算分账 → 扣券 + 扣积分 →
 * 开盲盒 / 授予游戏 → 状态翻 `committed`。
 *
 * ⚠️ 返回的视图是 **`as_parent: false`** 的（`wish_srv.go` 里写死了）——
 *    收货信息脱敏、没有外链。客户端只读 `id` / `status` / `opened_game_id`，
 *    不影响。
 *
 * @param clientRequestId 幂等键。⚠️ 服务端真正用来防重的是**订单号**
 *   （`wish_redeem:<orderID>` 拼进账本唯一索引），这个字段只影响日志；
 *   连点两次由「状态 CAS」兜住（第二次 `UpdateOrderCAS(from=wished)` 失败）。
 */
export const redeemWishItem = (itemId: string, clientRequestId: string) =>
  api<ServerWishOrder>('/wish/redeem', {
    item_id: itemId,
    client_request_id: clientRequestId,
  })

/** 家长确认（已去外链购买） */
export const confirmWishOrder = (orderId: string) =>
  api<ServerWishOrder>('/wish/confirm', { order_id: orderId })

/**
 * 家长收尾（买好了 / 收到了）。
 *
 * `trackingNo` 服务端叫「快递单号」，本地 `WishOrder` 叫 `buyOrderNo`
 * （「外链成交后家长填的订单号」）—— 同一件事：**对账用的一串号**。
 * 映射在 `sync/map.ts` 里做，别在调用处各写一遍。
 *
 * `ship`：家长在这一步补的收货地址（实物商品才有）。
 * ⚠️ 地址为空时**不发这个字段**（`toServerShip` 返回 undefined）——
 *    服务端在地址为空时是「一个字都不动」，发一个空对象反而可能把
 *    兑换时存过的地址覆盖掉。校验要在界面做（`shipFormIssue`），
 *    因为服务端不报错。
 */
export const doneWishOrder = (orderId: string, trackingNo = '', ship?: ShipDraft) => {
  const payload = toServerShip(ship)
  return api<ServerWishOrder>('/wish/done', {
    order_id: orderId,
    tracking_no: trackingNo,
    ...(payload ? { ship: payload } : {}),
  })
}

/**
 * 取消（**退券 + 退积分**，数字商品同时收回游戏）。
 *
 * 服务端在事务内先读状态再 CAS，所以「两个标签页同时点」只会退一次 ——
 * 客户端不需要（也不应该）再加一层「退过没」的判断。
 */
export const cancelWishOrder = (orderId: string, reason = '') =>
  api<ServerWishOrder>('/wish/cancel', { order_id: orderId, reason })

/**
 * 心愿单列表。
 *
 * ⚠️ 分页参数是 **`pageSize`**（驼峰）—— 服务端 `entities.Paginator` 的 json tag。
 * 写成 `page_size` 不会报错，只会**永远只返回 30 条**（详见 `api/wallet.ts`
 * 的 `walletLedger` 注释）。这里的后果：家长心愿页的待办会漏掉较早的单子，
 * 而孩子那边确实还欠着。
 *
 * @param asParent `true` = 家长视角（带外链、收货信息不脱敏）。
 *   拉取时用 `true`：同一台设备、同一个账号，家长那一屏要能发货。
 */
export const listWishOrders = (opts: {
  page?: number
  pageSize?: number
  status?: ServerWishStatus
  asParent?: boolean
} = {}) =>
  api<{ page: number; pageSize: number; count: number; list: ServerWishOrder[] }>(
    '/wish/orders',
    {
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 200,
      ...(opts.status ? { status: opts.status } : {}),
      as_parent: opts.asParent ?? false,
    },
  )

export const wishPending = () => api<ServerWishPending>('/wish/pending', {})
