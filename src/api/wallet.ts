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

export const walletLedger = (page = 1, pageSize = 50) =>
  api<{ count: number; list: ServerLedgerEntry[] }>('/wallet/ledger', {
    page,
    page_size: pageSize,
  })
