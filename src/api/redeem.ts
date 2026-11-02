import { api } from './client'

/* ============================================================
   在线版 · 兑换商城（tf-platform-api `/api/redeem/*`）
   ------------------------------------------------------------
   服务端这套 DTO 是**照着客户端设计的**：`id` 就是客户端的
   `RedeemItem.id`（创建时带上去），`cost` 就是 `cost`，
   `harvest_paid` / `points_paid` / `balance_after` 和本地记录字段同名。
   所以这一层几乎不用翻译 —— 但**别因此省掉 `sync/map.ts`**：
   时间是 unix 秒、缺省字段是 `0`/`""` 而不是 `undefined`，
   这两件事错了不会报错，只会表现成「1970 年兑换的」和「备注是空字符串」。

   ★ 兑换是**服务端扣钱**：`/redeem/redeem` 在一个事务里
     算分账（券优先 + 积分补差）→ 扣两种币 → 写记录。
     客户端那条本地事务在在线模式下**整条不走**（见 `online/redeem.ts`）。
   ============================================================ */

export interface ServerRedeemItem {
  /** 业务 id（= 客户端 `RedeemItem.id`） */
  id: string
  name: string
  emoji: string
  category: string
  /** 所需「分」（1 券 = 1 分） */
  cost: number
  note: string
  limit_per_day: number
  once: boolean
  /** -1 = 无限 */
  stock: number
  archived: boolean
  created_by_parent: boolean
  sort: number
  created_at: number
  updated_at: number
}

/**
 * `/redeem/list` 的一行。
 *
 * ⚠️ 这**不是** `RedeemItem`：它是服务端算好的**视图**，
 * 带分账预览（`plan`）、够不够换（`can_redeem`）、今天还剩几次
 * （`remaining_today`），价格字段叫 `price` 而不是 `cost`。
 *
 * ⚠️ 而且它是个**混排列表**：`source === 'wish'` 的行是「家长定过价的心愿商品」，
 * 那不是 `RedeemItem`，不能写进本地兑换品表（心愿有自己的表和自己的链路）。
 * 落库前必须按 `source` 分拣 —— 见 `sync/map.ts` 的 `mapRedeemItem`。
 */
export interface ServerRedeemRow {
  source: 'redeem' | 'wish'
  id: string
  name: string
  emoji: string
  category: string
  note: string
  /** 「分」，1 券 = 1 分 */
  price: number
  plan: RedeemPlan
  can_redeem: boolean
  description: string
  blocked_by_limit: boolean
  // ---- 仅 redeem 来源 ----
  today_count?: number
  remaining_today?: number
  once?: boolean
  stock?: number
  archived?: boolean
  limit_per_day?: number
  created_by_parent?: boolean
  created_at?: number
  updated_at?: number
  /** 现在该不该出现在孩子的列表里（服务端算的） */
  visible: boolean
}


export interface ServerRedeemRecord {
  /** 服务端生成的记录 id（`RR...`），本地要加 `srv_rr_` 前缀 */
  id: string
  item_id: string
  name: string
  emoji: string
  quantity: number
  cost: number
  /** 兑换券付掉多少 */
  harvest_paid: number
  /** 积分付掉多少 */
  points_paid: number
  /** 兑换后的积分余额（快照） */
  balance_after: number
  /** 兑换后的兑换券余额（快照） */
  harvest_balance_after: number
  fulfilled: boolean
  fulfilled_at: number | null
  cancelled: boolean
  cancel_reason: string
  created_at: number
}

/** 分账（与 `domain/redeem.ts` 的 `planRedeemPayment` 同一套规则，但**由服务端算**） */
export interface RedeemPlan {
  harvest_paid: number
  points_paid: number
  total: number
  affordable: boolean
  shortfall: number
}

export interface RedeemResult {
  record_id: string
  item_id: string
  name: string
  emoji: string
  quantity: number
  plan: RedeemPlan
  /** 「30 兑换券 + 20 积分」这类可读文案，直接给孩子看 */
  description: string
  wallet: { points: number; coupon: number; diamond: number }
}

/**
 * 商品列表（含心愿混排）。
 *
 * @param raw `true` = 不过滤「换过 / 缺货 / 已下架」，每行带 `visible`。
 *   客户端**镜像**商城时必须用它 —— 默认那套过滤是给孩子看的口径，
 *   拿它当数据源，家长管理页里「一次性 · 已换过」的商品会凭空消失。
 */
export const listRedeemRows = (opts: { includeArchived?: boolean; raw?: boolean } = {}) =>
  api<{ list: ServerRedeemRow[]; count: number }>('/redeem/list', {
    include_archived: opts.includeArchived ?? false,
    raw: opts.raw ?? false,
  })

export const createRedeemItem = (body: Record<string, unknown>) =>
  api<ServerRedeemItem>('/redeem/item/create', body)

export const updateRedeemItem = (itemId: string, patch: Record<string, unknown>) =>
  api<ServerRedeemItem>('/redeem/item/update', { item_id: itemId, ...patch })

export const deleteRedeemItem = (itemId: string) =>
  api<{ deleted: boolean }>('/redeem/item/delete', { item_id: itemId })

/**
 * 兑换。
 *
 * @param clientRequestId 幂等键：网络重试 / 连点都不会扣两次
 *   （服务端把它拼进账本的 `idempotency_key`）
 */
export const redeemItem = (itemId: string, quantity: number, clientRequestId: string) =>
  api<RedeemResult>('/redeem/redeem', {
    item_id: itemId,
    quantity,
    client_request_id: clientRequestId,
  })

export const listRedeemRecords = (page = 1, pageSize = 200) =>
  api<{ count: number; list: ServerRedeemRecord[] }>('/redeem/records', {
    page,
    page_size: pageSize,
  })

export const fulfillRedeemRecord = (recordId: string, note = '') =>
  api<ServerRedeemRecord>('/redeem/fulfill', { record_id: recordId, note })

export const cancelRedeemRecord = (recordId: string, reason = '') =>
  api<ServerRedeemRecord>('/redeem/cancel', { record_id: recordId, reason })
