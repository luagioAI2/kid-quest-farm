import {
  cancelRedeemRecord,
  createRedeemItem,
  deleteRedeemItem,
  fulfillRedeemRecord,
  redeemItem,
  updateRedeemItem,
  type RedeemResult,
} from '../api/redeem'
import { ApiError } from '../api/client'
import { writeFailToast, type FailToast } from './write'
import { SRV_REDEEM_RECORD_PREFIX } from '../sync/map'
import type { RedeemItem } from '../domain/types'

/* ============================================================
   在线版 · 兑换商城（camelCase ↔ snake_case 只有这一张表）
   ------------------------------------------------------------
   和 `online/tasks.ts` 同一个分工：store 只管「调哪个动作」，
   字段怎么翻全在这里。

   ★ 兑换是**服务端扣钱**，客户端那条本地事务在在线模式下整条不走。
     为什么不能「本地扣 + 提交服务端」：两边都算分账（券优先 + 积分补差），
     规则一旦有一处不一致（比如服务端把 0 券的边界处理成 1 券），
     扣出来的数就不一样，而两边都觉得自己对。

   ★ 兑换品的 id **不做前缀转换**（服务端照用客户端给的 id，见 `sync/map.ts`）；
     兑换**记录**的 id 要剥掉 `srv_rr_` 才能调 `/redeem/fulfill`。
   ============================================================ */

/**
 * 字段映射。
 *
 * ⚠️ 键的类型是 `string` 而不是 `keyof RedeemItem`：两个类型的交集会让
 * `satisfies` 把不认识的服务端字段**静默丢掉**（`online/tasks.ts` 踩过）。
 * 宁可让它是一张普通表，也不要让类型系统「帮忙」删字段。
 */
const FIELD_MAP: Array<[string, string]> = [
  ['name', 'name'],
  ['emoji', 'emoji'],
  ['category', 'category'],
  ['cost', 'cost'],
  ['note', 'note'],
  ['limitPerDay', 'limit_per_day'],
  ['once', 'once'],
  ['stock', 'stock'],
  ['archived', 'archived'],
]

/**
 * 「这个字段被显式清空」时该发给服务端什么。
 *
 * 服务端这几个字段是非指针的（`string` / `int` / `bool`），收到 `null`
 * 会绑定失败；而本地的 `undefined` 在 JSON 里会被整个丢掉。
 * 所以「清空」必须翻译成各自的零值 —— 少翻一个的表现是
 * 「家长把备注删了，保存之后备注还在」，不报错。
 */
const UNSET: Record<string, unknown> = {
  note: '',
  limitPerDay: 0,
  stock: -1,
  once: false,
  archived: false,
}

/** 新建时的请求体（`id` 由客户端生成并带上 —— 服务端会照用） */
export function createBody(
  id: string,
  input: Omit<RedeemItem, 'id' | 'createdAt' | 'updatedAt'>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { id }
  for (const [local, srv] of FIELD_MAP) {
    const v = (input as unknown as Record<string, unknown>)[local]
    if (v === undefined) continue
    out[srv] = v
  }
  // 服务端的 `stock` 约定 -1 = 无限；本地用 `undefined` 表示同一件事
  if (out.stock === undefined) out.stock = -1
  return out
}

/**
 * 改一部分。
 *
 * ## 判据是「这个键在 patch 里吗」，不是「值是不是 undefined」
 *
 * 这两件事差别很大，而且**两边都会静默出错**：
 *
 *   · 编辑器永远传 `{ name, emoji, category, cost, note, limitPerDay, once }`，
 *     其中 `note` / `limitPerDay` 可能是 `undefined` —— 那是家长**清空**了它们。
 *     按值判的话：备注删不掉、每日限额取消不掉。
 *   · `setRedeemItemArchived` 只传 `{ archived }` —— 按值判没问题，
 *     但如果按「键」判却忘了 `UNSET` 兜底，就会把 `null` 发上去。
 *
 * 所以：**键在就发，值是 undefined 就发零值**。服务端那几个字段是
 * `*T` 指针，收到 `0` / `''` 会真的写进去（这正是我们要的），
 * 而没出现的键它一律不碰。
 */
export function updateBody(patch: Partial<RedeemItem>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [local, srv] of FIELD_MAP) {
    if (!(local in patch)) continue
    const v = (patch as unknown as Record<string, unknown>)[local]
    if (v === undefined) {
      // 没有零值可翻的字段（name / emoji / cost / category）当成没传：
      // 发 `null` 只会换来一条「参数校验失败」
      if (local in UNSET) out[srv] = UNSET[local]
      continue
    }
    out[srv] = v
  }
  return out
}

/**
 * 幂等键。
 *
 * 服务端把它拼进账本的 `idempotency_key`（`redeem_coupon:<id>` /
 * `redeem_points:<id>`），所以重试 / 连点都不会扣第二次钱。
 */
let reqSeq = 0
export function newRequestId(): string {
  reqSeq += 1
  return `rd-${Date.now().toString(36)}-${reqSeq.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

/**
 * 服务端兑换记录 id → 本地 id。
 *
 * 本地表里两种行混着（本地版的 `rr…` 和服务端的 `srv_rr_RR…`），
 * 只有后者能拿去调 `/redeem/fulfill`。剥错了不报错，只会收到
 * 「兑换记录不存在」，而界面显示的是「记录没了」。
 */
export function localRecordId(serverId: string): string {
  return `${SRV_REDEEM_RECORD_PREFIX}${serverId}`
}

export function serverRecordId(localId: string): string | null {
  return localId.startsWith(SRV_REDEEM_RECORD_PREFIX)
    ? localId.slice(SRV_REDEEM_RECORD_PREFIX.length)
    : null
}

/**
 * 兑换失败的提示。
 *
 * 网络 / 登录过期交给 `writeFailToast`（那两种和别的动作是同一句话）；
 * 业务错误码翻成**孩子看得懂、且和本地版一字不差**的文案 ——
 * 同一个「还差一点点」，本地版和在线版说法不一样的话，
 * 孩子会以为是两件事。
 */
export function redeemFailToast(e: ApiError): FailToast {
  switch (e.code) {
    case 10020301: // insufficient-balance
      return { kind: 'warn', title: '兑换券和积分不够啦', detail: '再攒一攒吧', emoji: '🎫' }
    case 10060301: // redeem-once-only
      return { kind: 'warn', title: '这个只能换一次', detail: '你已经换过啦', emoji: '☝️' }
    case 10060401: // redeem-limit-exceeded
      return { kind: 'warn', title: '今天换得太多了', detail: '明天再来吧', emoji: '⏳' }
    case 10060501: // redeem-out-of-stock
      return { kind: 'warn', title: '已经换光啦', detail: '让爸爸妈妈再准备一些', emoji: '📦' }
    case 10060201: // redeem-item-offline
      return { kind: 'warn', title: '这个下架了', detail: '下拉刷新看看别的吧', emoji: '⬇️' }
    default:
      return writeFailToast(e, '这次兑换')
  }
}

/* ---------------- 一对一映射 store 动作 ---------------- */

export const oCreateRedeemItem = (body: Record<string, unknown>) => createRedeemItem(body)

export const oUpdateRedeemItem = (itemId: string, patch: Partial<RedeemItem>) =>
  updateRedeemItem(itemId, updateBody(patch))

export const oDeleteRedeemItem = (itemId: string) => deleteRedeemItem(itemId)

export const oRedeemItem = (itemId: string, quantity = 1): Promise<RedeemResult> =>
  redeemItem(itemId, quantity, newRequestId())

export const oFulfillRedeem = (localId: string, note = '') => {
  const id = serverRecordId(localId)
  if (id === null) throw new Error(`不是服务端兑换记录：${localId}`)
  return fulfillRedeemRecord(id, note)
}

export const oCancelRedeem = (localId: string, reason = '') => {
  const id = serverRecordId(localId)
  if (id === null) throw new Error(`不是服务端兑换记录：${localId}`)
  return cancelRedeemRecord(id, reason)
}
