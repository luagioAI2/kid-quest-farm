import type { WishShipInfo } from './types'

/**
 * 家长刚填的那几个字。
 *
 * 和 `WishShipInfo` 的唯一区别是**没有 `purgeAfter`**：过期时间是服务端算的
 * （`shipFields` 里写 90 天）。让界面去编一个时间戳，只会出现「客户端算 30 天、
 * 服务端算 90 天」这种两边不一致、还不报错的局面。
 */
export type ShipDraft = Omit<WishShipInfo, 'purgeAfter'> & { purgeAfter?: number }

/* ============================================================
   收货信息：家长补地址这一条链路上的两个纯函数
   ------------------------------------------------------------
   为什么要有这一层：服务端的 `shipFields`（`wish_srv.go`）**故意**在
   地址为空时「一个字都不动」—— 这样「只点已经买好了、没填地址」不会
   把兑换时存过的地址清空。代价是：家长填了一半（只有收件人、没有地址）
   点提交，服务端**静默不存**，界面上却提示「已经完成啦」。

   所以校验必须在客户端做完，而且要说人话。规则留在这里（纯函数），
   因为 `isOnlineMode` 是构建期常量、`vitest.config.ts` 钉成 local，
   store 里造不出在线版来测。
   ============================================================ */

/** 服务端认识的字段（`WishShipInfo`，`json` 名就是这些） */
export interface ServerShipPayload {
  receiver: string
  phone: string
  region: string
  address: string
  note?: string
}

/**
 * 本地 → 服务端的收货信息。
 *
 * ⚠️ **不送 `purgeAfter`**：那是服务端算的（90 天）。带上只会被覆盖，
 *    而且两边时钟不保证一致 —— 客户端算的过期时间没有任何意义。
 * ⚠️ 地址为空 ⇒ `undefined`（= 这次别动服务端那份），和服务端口径一致。
 */
export function toServerShip(ship: ShipDraft | undefined): ServerShipPayload | undefined {
  if (!ship) return undefined
  const address = ship.address.trim()
  if (!address) return undefined
  const out: ServerShipPayload = {
    receiver: ship.receiver.trim(),
    phone: ship.phone.trim(),
    region: ship.region.trim(),
    address,
  }
  const note = ship.note?.trim()
  if (note) out.note = note
  return out
}

/**
 * 表单校验：`null` = 可以提交。
 *
 * 只挡「提交了也存不进去」和「存进去也发不了货」这两种，不搞复杂格式校验 ——
 * 家长的地址格式千奇百怪（小区名、单位、代收点），严格校验只会把真地址挡在外面。
 */
export function shipFormIssue(form: {
  receiver: string
  phone: string
  address: string
}): string | null {
  if (!form.receiver.trim()) return '写一下收件人（谁收这个快递）'
  const phone = form.phone.replace(/[\s-]/g, '')
  if (!phone) return '写一下电话，快递员到了要联系'
  if (!/^\d{7,15}$/.test(phone)) return '电话只填数字就行（不用加横线或空格）'
  if (!form.address.trim()) return '写一下详细地址（小区 / 门牌号）'
  return null
}
