import { api } from './client'

/* ============================================================
   在线版 · 游戏币（tf-platform-api `/api/game/coin/*`）
   ------------------------------------------------------------
   服务端的模型和本地**不一样**，这一层要把它抹平：

   | | 本地（`kid-quest-farm-2d`） | 服务端 |
   | --- | --- | --- |
   | 余额 | `gameKv['__coin']` 数组的 delta 之和 | `game_coin_wallet.balance` |
   | 账本 | 就在 `__coin` 里 | `game_coin_ledger` 一张表 |
   | 汇率（币→券） | 插件 manifest 的 `voucherPerCoin` | **写死 1:1** |

   ⚠️ 最后一行是个**已知的不一致**，见 `online/coin.ts` 的 `redeemCoins` 注释：
   服务端不知道 manifest 里写了几倍。当前发布的插件全是 1（或 0 = 不开放），
   所以现在对得上；哪天有插件写 2，客户端必须信服务端返回的 `vouchers`。
   ============================================================ */

export interface ServerCoinInfo {
  game_id: string
  balance: number
  total_earned: number
  total_spent: number
}

export interface ServerCoinResp {
  game_id: string
  /** 变动后的余额 */
  balance: number
  /** 本次变动量（正=进，负=出） */
  amount: number
  /** 本次发出的兑换券（仅 redeem） */
  vouchers?: number
  /** 本次扣的积分（仅 buy） */
  points?: number
}

export interface ServerVoucherResp {
  game_id: string
  vouchers: number
  coupon_balance: number
}

/** 服务端游戏币账本行（时间戳是 **unix 秒**） */
export interface ServerCoinLedgerEntry {
  id: number
  uid: number
  game_id: string
  delta: number
  balance_after: number
  source: string
  ref_id: string
  memo: string
  created_at: number
  updated_at: number
}

/** 单款游戏的币余额。没开过钱包时 `balance` 为 0（服务端不写空行） */
export const coinInfo = (gameId: string) =>
  api<ServerCoinInfo>('/game/coin/info', { game_id: gameId })

/** 所有游戏的币余额（只返回有钱包的） */
export const listCoinInfo = () =>
  api<{ list: ServerCoinInfo[] | null; count: number }>('/game/coin/list', {})

/**
 * 用积分买币。扣积分和记币在服务端**同一个事务**里。
 *
 * ⚠️ `points_per_coin` 由客户端传（服务端 `binding:"omitempty,min=1"`，
 * 不传就兜底 10）。这里**必须传**：插件 manifest 里写的 `playCost` 是
 * 「一局几个币」，而汇率是宿主的定价，两边对不上就是白送或白扣。
 */
export const buyCoins = (body: {
  gameId: string
  count: number
  pointsPerCoin: number
  clientRequestId: string
}) =>
  api<ServerCoinResp>('/game/coin/buy', {
    game_id: body.gameId,
    count: body.count,
    points_per_coin: body.pointsPerCoin,
    client_request_id: body.clientRequestId,
  })

/** 花币（玩一局）。余额不够返回业务错误（`10020501` 那一类） */
export const spendCoins = (body: {
  gameId: string
  amount: number
  memo: string
  clientRequestId: string
}) =>
  api<ServerCoinResp>('/game/coin/spend', {
    game_id: body.gameId,
    amount: body.amount,
    memo: body.memo,
    client_request_id: body.clientRequestId,
  })

/** 铸币（插件「赚到币」的唯一入口，只进不出） */
export const mintCoins = (body: { gameId: string; amount: number; memo: string }) =>
  api<ServerCoinResp>('/game/coin/mint', {
    game_id: body.gameId,
    amount: body.amount,
    memo: body.memo,
  })

/**
 * 币 → 兑换券。
 *
 * ⚠️ 服务端**不接收汇率**（`rate := int64(1)` 写死在 `game_coin_srv.go` 里）——
 * 让客户端传汇率等于把印钞机的旋钮交出去。所以这里只发「换几个」。
 */
export const redeemCoins = (body: {
  gameId: string
  count: number
  clientRequestId: string
}) =>
  api<ServerCoinResp>('/game/coin/redeem', {
    game_id: body.gameId,
    count: body.count,
    client_request_id: body.clientRequestId,
  })

/**
 * 抓到奖品 → 直接发兑换券（不经过币）。
 *
 * 这是 `host.mintVoucher` 的服务端出口。为什么不用「铸币 + 换券」凑：
 * 那是两个事务，中间崩一下会留下**真实的币**，而币能直接开局 ——
 * 抓娃娃本身就能续玩，正是要堵的那条回路。
 */
export const mintVouchers = (body: {
  gameId: string
  amount: number
  memo: string
  clientRequestId: string
}) =>
  api<ServerVoucherResp>('/game/coin/voucher', {
    game_id: body.gameId,
    amount: body.amount,
    memo: body.memo,
    client_request_id: body.clientRequestId,
  })

/**
 * 币账本。
 *
 * ⚠️⚠️ **这个接口的分页参数是 `page_size`（下划线）**，不是 `pageSize`。
 *
 * 它和钱包 / 兑换 / 心愿那几个**不一样**：那几处走 `entities.Paginator`
 * （json 标签 `pageSize`），而这里是 `game_coin_api.go` 里**手写的一个匿名
 * struct**，标签是 `page_size`。
 *
 * 传错的后果和 §7.10 一模一样：`ShouldBindJSON` 的返回值被 `_ =` 丢掉，
 * `PageSize` 留在 0 → `Normalize()` 兜底 30 → **永远只拿到 30 条**。
 * 所以两边都别「统一一下」—— 按各自的接口写。
 */
export const coinLedger = (gameId: string, page = 1, pageSize = 200) =>
  api<{ count: number; list: ServerCoinLedgerEntry[] }>('/game/coin/ledger', {
    game_id: gameId,
    page,
    page_size: pageSize,
  })
