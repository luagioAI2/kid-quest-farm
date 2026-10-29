import { api } from './client'
import type { ApiWishCodeResult } from './types'

/* ============================================================
   心愿商城 · 兑换码（tf-platform-api `/api/wish/redeem-code`）
   ------------------------------------------------------------
   家长在淘宝/天猫/京东买到游戏卡，卡背面是一串激活码。
   输进「设置 / 游戏 / 有兑换码？」→ 服务端验码并**直接授予游戏**。

   ⚠️ 这个接口是**写操作**，而且不可撤销：
   服务端在同一个事务里验码、标记已用、写 `user_game`。
   所以调用方必须把「网络失败」和「码无效」分开说 ——
   网络失败时码**没被用掉**，可以原样再试；码无效时再试多少次都一样。
   `client.ts` 已经把这两种情况分成 `isNetwork` / 业务码，别在外面自己判。
   ============================================================ */

export const redeemWishCode = (code: string) =>
  api<ApiWishCodeResult>('/wish/redeem-code', { code })
