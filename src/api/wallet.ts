import { api } from './client'

/* ============================================================
   在线版 · 钱包 / 积分流水（tf-platform-api `/api/wallet/*`）
   ------------------------------------------------------------
   在线版里**积分余额的真相源是服务端**：本地 `ledger` 表退化成镜像，
   余额不再等于「本地流水求和」，而是 `wallet.points`。

   ⚠️ 三种币不是一种：`points`（积分）/ `coupon`（兑换券）/ `diamond`（钻石）。
   本地 `balance` 只对应 `points`；兑换券在本地叫 `harvestBalance`，
   走的是另一张表（`harvestLedger`）。别把 `coupon` 往 `balance` 里加。
   ============================================================ */

export interface ServerWallet {
  uid: number
  points: number
  coupon: number
  diamond: number
}

export const walletInfo = () => api<ServerWallet>('/wallet/info', {})

/** 服务端流水行（时间戳是 **unix 秒**） */
export interface ServerLedgerEntry {
  id: number
  currency: 'points' | 'coupon' | 'diamond' | string
  delta: number
  balance_after: number
  source: string
  ref_id: string
  memo: string
  created_at: number
}

/**
 * 积分流水。
 *
 * ⚠️ **分页参数叫 `pageSize`（驼峰），不是 `page_size`。**
 *
 * 服务端有两种分页 DTO 并存：
 *   · `entities.Paginator`（钱包 / 兑换记录 / 心愿…）→ json 标签是 `pageSize`
 *   · 手写的那几个（`/task/pending-review`）→ 是 `page_size`
 *
 * 传错的那个不会报错：绑定失败被 `ShouldBindJSON` 的返回值丢掉（`_ =`），
 * `PageSize` 留在 0 → 服务端 `Normalize()` 兜底成 **30**。
 * 症状是「每页永远 30 条」，而调用方以为自己要了 200。
 * 2026-11-02 实测：账号攒到第 33 条流水之后，本地余额（= 拉到的流水求和）
 * 比服务端少了 124 —— 界面上的积分**凭空少了一截**，没有任何报错。
 */
export const walletLedger = (page = 1, pageSize = 50) =>
  api<{ count: number; list: ServerLedgerEntry[] }>('/wallet/ledger', {
    page,
    pageSize,
  })
