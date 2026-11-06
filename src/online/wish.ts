import {
  cancelWishOrder,
  confirmWishOrder,
  doneWishOrder,
  expressWish,
  redeemWishItem,
  setWishOffer,
  type ServerWishOrder,
} from '../api/wish'
import { ApiError } from '../api/client'
import type { ShipDraft } from '../domain/wishShip'
import { writeFailToast, type FailToast } from './write'
import { SRV_WISH_ORDER_PREFIX } from '../sync/map'

/* ============================================================
   在线版 · 心愿商城
   ------------------------------------------------------------
   分工和 `online/redeem.ts` 一样：store 只管「调哪个动作」，
   文案 / id 转换 / 幂等键都在这里。

   ★ 和兑换商城最大的区别：心愿的**六个动作全是服务端事务**
     （许愿不扣钱、兑换扣券+扣积分、取消退两种币 + 收回游戏）。
     客户端一条本地事务都不走 —— 本地版那套 `db.transaction(...)` 在
     在线模式下整段跳过。两处各算一遍的话，「券 + 积分混付」这种
     分账规则只要有一处不一致，扣出来的数就不一样，而两边都觉得自己对。

   ★ 唯一必须留在客户端的是**装包**：服务端只会授予游戏（写 `user_game`），
     插件包在本机的 `gameKv` 里。所以「兑换成功 → 装包 → 装不上就取消退钱」
     这条链路仍然是客户端编排的（见 `store/useApp.ts` 的 `onlineWishRedeem`）。
   ============================================================ */

/**
 * 幂等键。
 *
 * ⚠️ 服务端真正用来防重的是**订单号**（`wish_redeem:<orderID>` 拼进账本
 * 唯一索引），这个字段只进日志。连点两次由「状态 CAS」兜住：
 * 第二次 `UpdateOrderCAS(from=wished)` 影响 0 行 → 报 `wish-status-not-allowed`。
 * 所以这里**不需要**「同一个 itemId 复用同一个键」那种复杂逻辑。
 */
let reqSeq = 0
export function newWishRequestId(): string {
  reqSeq += 1
  return `wo-${Date.now().toString(36)}-${reqSeq.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

/**
 * 服务端订单 id ↔ 本地 id。
 *
 * 服务端生成 `WO…`，本地生成 `wo…` —— **只差大小写**，所以不能靠
 * 「看起来像不像」来分辨。剥错了不报错，只会收到「心愿单不存在」，
 * 而界面显示的是「这单没了」。
 */
export function localWishOrderId(serverId: string): string {
  return `${SRV_WISH_ORDER_PREFIX}${serverId}`
}

export function serverWishOrderId(localId: string): string | null {
  return localId.startsWith(SRV_WISH_ORDER_PREFIX)
    ? localId.slice(SRV_WISH_ORDER_PREFIX.length)
    : null
}

/**
 * 心愿动作失败的提示。
 *
 * 业务码翻成**和本地版一字不差**的话 —— 同一个「爸妈还没定价」，
 * 两个版本说法不一样的话，孩子会以为是两件事。
 * 网络 / 登录过期交给 `writeFailToast`（那两种和别的动作同一句话）。
 */
export function wishFailToast(e: ApiError): FailToast {
  switch (e.code) {
    case 10070201: // wish-item-not-open
      return { kind: 'warn', title: '爸妈还没给它定价', detail: '再等等吧', emoji: '⏳' }
    case 10070301: // wish-item-offline
      return { kind: 'warn', title: '这个下架了', detail: '下拉刷新看看别的吧', emoji: '⬇️' }
    case 10070601: // wish-voucher-short
      // 差额是**两种币合起来**算的，文案里不带「张」
      return { kind: 'warn', title: '兑换券和积分不够啦', detail: '再攒一攒吧', emoji: '🎫' }
    case 10070701: // wish-blind-box-empty
      return {
        kind: 'warn',
        title: '这些游戏你都有啦',
        detail: '等新的再来开',
        emoji: '🎁',
      }
    case 10070801: // wish-game-required
      return { kind: 'warn', title: '这款游戏没配好', detail: '告诉爸爸妈妈一下', emoji: '🛠️' }
    case 10070101: // wish-item-not-exist
      return { kind: 'warn', title: '没有这件商品', detail: '下拉刷新看看', emoji: '🔍' }
    case 10070401: // wish-order-not-exist
      return { kind: 'warn', title: '这一单找不到了', detail: '下拉刷新看看', emoji: '🔍' }
    case 10070501: // wish-status-not-allowed
      return {
        kind: 'warn',
        title: '这一单已经不能这样操作了',
        detail: '可能刚在另一台设备上处理过，刷新一下',
        emoji: '↩️',
      }
    default:
      return writeFailToast(e, '这次操作')
  }
}

/* ---------------- 一对一映射 store 动作 ---------------- */

export const oWishExpress = (itemId: string) => expressWish(itemId)

export const oWishRedeem = (itemId: string): Promise<ServerWishOrder> =>
  redeemWishItem(itemId, newWishRequestId())

/**
 * 家长定价。`price <= 0` = 关闭该商品。
 *
 * ⚠️ 关闭也走同一个接口（服务端把 `closed_at` 置为当前时间，**不删行** ——
 * 孩子之前换过的历史还要能解释）。别在客户端写「删掉那一行」，
 * 那会让 `wishesAwaitingReply` 把一件家长刚关掉的东西又算成「没回应过」。
 */
export const oWishSetOffer = (itemId: string, price: number, oneTime?: boolean) =>
  setWishOffer(itemId, Math.round(price), 0, oneTime)

export const oWishConfirm = (localOrderId: string) => {
  const id = serverWishOrderId(localOrderId)
  if (id === null) throw new Error(`不是服务端心愿单：${localOrderId}`)
  return confirmWishOrder(id)
}

/**
 * 家长收尾。
 *
 * `ship`：实物商品在这一步补的收货地址（2026-11-02 晚起服务端认这个字段）。
 * 传 `undefined` = 这次不动服务端那份，别传空对象。
 */
export const oWishDone = (localOrderId: string, buyOrderNo = '', ship?: ShipDraft) => {
  const id = serverWishOrderId(localOrderId)
  if (id === null) throw new Error(`不是服务端心愿单：${localOrderId}`)
  return doneWishOrder(id, buyOrderNo, ship)
}

export const oWishCancel = (localOrderId: string, reason = '') => {
  const id = serverWishOrderId(localOrderId)
  if (id === null) throw new Error(`不是服务端心愿单：${localOrderId}`)
  return cancelWishOrder(id, reason)
}
