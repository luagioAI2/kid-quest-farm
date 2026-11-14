import {
  buyCoins,
  coinLedger,
  listCoinInfo,
  mintCoins,
  mintVouchers,
  redeemCoins,
  spendCoins,
  type ServerCoinInfo,
} from '../api/coin'
import { walletSpend } from '../api/wallet'
import { ApiError } from '../api/client'
import { mirrorGameCoinBalance } from '../db/db'
import { writeFailToast, type FailToast } from './write'

/* ============================================================
   在线版 · 游戏币（+ 插件扣积分）
   ------------------------------------------------------------
   这一层只做四件事：**对齐本地语义的守卫**、幂等键、失败文案、
   把服务端返回的 `balance` 镜像回本地 `__coin`。

   ★ 为什么游戏币也要上云
     币是「积分 → 币 → 兑换券」这条链的中间那一跳。币只在本机的话，
     换台设备币就归零（而券在服务端）—— 孩子会觉得「我的币被偷了」。
     更要命的是它和兑换券同源：币能换券，券在服务端有账，
     币在本地有账，两条链一对不上就是**静默多发或少发券**。

   ★ 为什么插件扣积分也在这
     `host.spendPoints` 原来只写本地账本。在线版的积分以服务端为准，
     本地那条 `lg_` 行**永远不会被清掉**（拉取只清 `srv_` 行），
     于是余额永久漂移，界面上看不出来。它和游戏币是同一类问题，
     放在一起说清楚。

   ★ 返回值一律**和 `HostApi` 的契约一致**（`boolean` / `number` / `void`），
     不是服务端的 DTO —— 这样 `hostApi.ts` 里每个门只需要多一行 `if`。
     业务上的「不够」翻成 `false` / `0`（本地版就是这么表达的），
     真正的故障（断网 / 401 / 5xx）**继续抛**，由 `hostApi` 弹提示。
   ============================================================ */

/**
 * 幂等键。
 *
 * ⚠️ 服务端会把空串的幂等键落成 `NULL`（`SetIdempotencyKey`），
 * 所以「不传」是安全的；但**重试**就不安全了 —— 每次调用都要一个新键，
 * 否则「网络超时但其实成功了」的重试会再扣一次。
 *
 * 反过来更阴：服务端拼键是 `"game_coin_spend:" + client_request_id`，
 * 不传时拼出来是个**常量**，第二次调用直接撞唯一索引 → 报「已经做过了」。
 * 所以这里**每次都给**，一个都不能省。
 */
let seq = 0
export function newCoinRequestId(): string {
  seq += 1
  return `gc-${Date.now().toString(36)}-${seq.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

/**
 * 游戏币动作失败的提示。
 *
 * 币不够 / 积分不够**不是故障**（返回值 `false` 就够，插件自己会画
 * 「去买几个」），所以这里只兜真正的意外 —— 它的用途是让 `hostApi`
 * 拿到一句能弹给家长看的话，而不是把 `ApiError` 的英文码甩到界面上。
 */
export function coinFailToast(e: ApiError): FailToast {
  switch (e.code) {
    case 10040901: // game-coin-insufficient
      return { kind: 'warn', title: '游戏币不够啦', detail: '先去买几个吧', emoji: '🪙' }
    case 10020301: // insufficient-balance（积分）
      return { kind: 'warn', title: '积分不够啦', detail: '再攒一攒吧', emoji: '⭐' }
    case 610: // duplicate-operation
      return { kind: 'warn', title: '这一步刚刚已经做过了', detail: '刷新一下看看', emoji: '↩️' }
    default:
      return writeFailToast(e, '这一步')
  }
}

/** 业务上的「不够」—— 该翻成 `false`，不是故障 */
function isInsufficient(e: unknown): boolean {
  return e instanceof ApiError && (e.code === 10040901 || e.code === 10020301)
}

/**
 * 这款游戏**没有开放**币换券（服务端 `voucher_per_coin = 0`）。
 *
 * 以前服务端对任何游戏都按 1:1 照换（`rate := int64(1)`），所以这条不会出现；
 * 现在它跟插件 manifest 的 `economy.voucherPerCoin` 对齐了：
 * 不写 / 写 0 = 不开放。和 `isInsufficient` 一样，这是**业务结果**不是故障 ——
 * 插件里 `redeemGameCoin` 的契约是 `Promise<number>`，返回 0 就好，
 * 抛异常会让「这局没换到」变成一个红叉。
 */
function isRedeemClosed(e: unknown): boolean {
  return e instanceof ApiError && e.code === 10041201
}

/* ---------------- 一对一映射（hostApi 直接用） ---------------- */

/**
 * 用积分买币。
 *
 * ⚠️ `pointsPerCoin` 必须由调用方给（本地版从 manifest 读）。
 * 服务端 `binding:"omitempty,min=1"` + 兜底 10 —— 传 0 会被**静默**当成 10，
 * 于是一局 1 分的游戏变成一局 10 分。所以这里先按本地的口径挡掉非正数。
 */
export async function oBuyCoins(
  gameId: string,
  count: number,
  pointsPerCoin: number,
): Promise<boolean> {
  const n = Math.round(count)
  const rate = Math.round(pointsPerCoin)
  if (!(n > 0) || !(rate > 0)) return false
  try {
    const r = await buyCoins({
      gameId,
      count: n,
      pointsPerCoin: rate,
      clientRequestId: newCoinRequestId(),
    })
    await mirrorGameCoinBalance(gameId, r.balance)
    return true
  } catch (e) {
    if (isInsufficient(e)) return false
    throw e
  }
}

/** 花币（玩一局）。币不够返回 `false` —— 和本地 `spendGameCoin` 同一个契约 */
export async function oSpendCoins(
  gameId: string,
  amount: number,
  memo: string,
): Promise<boolean> {
  const n = Math.round(amount)
  if (!(n > 0)) return false
  try {
    const r = await spendCoins({
      gameId,
      amount: n,
      memo,
      clientRequestId: newCoinRequestId(),
    })
    await mirrorGameCoinBalance(gameId, r.balance)
    return true
  } catch (e) {
    if (isInsufficient(e)) return false
    throw e
  }
}

/**
 * 铸币（插件「赚到币」）。
 *
 * ⚠️ 服务端这条**没有幂等键**（`GameCoinMintReq` 里没有 `client_request_id`），
 * 所以重试会真的多铸一次。当前调用方（插件）都是「一局一次、不自动重试」，
 * 而宿主这边失败就是失败（不排队、不补传），所以暂时安全。
 * 哪天真要自动重试，先给服务端补上 `client_request_id`。
 */
export async function oMintCoins(gameId: string, amount: number, memo: string): Promise<void> {
  const n = Math.round(amount)
  // 本地 `addGameCoin` 对 `n <= 0` 是**静默不写**（币只进不出）。
  // 服务端 `binding:"min=1"` 会直接报参数错误 —— 那会让插件的
  // 「这一局没赚到币」变成一个异常。所以在这里就按本地口径挡掉。
  if (!(n > 0)) return
  const r = await mintCoins({ gameId, amount: n, memo })
  await mirrorGameCoinBalance(gameId, r.balance)
}

/**
 * 币 → 券。
 *
 * ## 汇率：服务端有一份，客户端算的那份只用来对账
 *
 * 服务端从 `game.voucher_per_coin` 读（0 = **不开放兑换**，与插件 manifest 的
 * `economy.voucherPerCoin` 同一套语义）。**不接受客户端传汇率** —— 那等于把
 * 印钞机的旋钮交出去，一个写错的插件传个 1000 就能印出无限券。
 *
 * 所以：
 *   - 一律**信服务端返回的 `vouchers`**，不能自己乘（否则界面说「换了 10 张」
 *     而实际只到 5 张）；
 *   - `rate` 参数只做两件事：`<= 0` 时**根本不该发请求**（manifest 说不开放），
 *     以及事后发现和 `vouchers` 对不上时 `console.warn` —— 那说明
 *     「服务端那份配置」和「manifest」走散了，得有人去对齐。
 */
export async function oRedeemCoins(
  gameId: string,
  count: number,
  rate: number,
): Promise<number> {
  const n = Math.round(count)
  const r0 = Math.round(rate)
  if (!(n > 0) || !(r0 > 0)) return 0
  try {
    const r = await redeemCoins({ gameId, count: n, clientRequestId: newCoinRequestId() })
    await mirrorGameCoinBalance(gameId, r.balance)
    /* `vouchers` 在服务端带 `omitempty`（= 0 时整个字段不出现）。
       换券必然 ≥ 1，所以正常情况一定有值；真缺了就当 0 ——
       下面的 `!==` 会把它打成一条 warning，而不是悄悄返回 `undefined`
       （`HostApi.redeemGameCoin` 的契约是 `Promise<number>`）。 */
    const got = r.vouchers ?? 0
    const expected = n * r0
    if (got !== expected) {
      console.warn(
        `[coin] 汇率不一致：manifest 说 1 币 = ${r0} 券（应发 ${expected}），` +
          `服务端按 game.voucher_per_coin 发了 ${got}。以服务端为准 —— ` +
          `但这说明服务端那份配置和 manifest 走散了，去后台对齐一下。`,
      )
    }
    return got
  } catch (e) {
    /* 没开放兑换 / 币不够：都是「这次换不了」，不是故障 ⇒ 返回 0 */
    if (isInsufficient(e) || isRedeemClosed(e)) return 0
    throw e
  }
}

/**
 * 抓到奖品 → 直接发券（`host.mintVoucher`）。
 *
 * 不经过币：币是「买来的入场券」，券是「抓来的战利品」。混起来的话
 * 娃娃就能变回币、币又能直接开局 —— 抓娃娃本身能续玩。
 *
 * 返回**服务端的 `vouchers`**，不是本地算的 —— 这条没有汇率参与，
 * 但仍然以服务端为准（万一将来加了「一局封顶」之类的规则）。
 */
export async function oMintVouchers(
  gameId: string,
  amount: number,
  memo: string,
): Promise<number> {
  const n = Math.round(amount)
  if (!(n > 0)) return 0
  const r = await mintVouchers({
    gameId,
    amount: n,
    memo,
    clientRequestId: newCoinRequestId(),
  })
  return r.vouchers
}

/** 插件扣积分（开局费）。`game_spend` 是服务端唯一认的来源 */
export async function oSpendPoints(
  amount: number,
  gameId: string,
  memo: string,
): Promise<boolean> {
  const n = Math.round(amount)
  if (!(n > 0)) return false
  try {
    await walletSpend({ amount: n, refId: gameId, memo, clientRequestId: newCoinRequestId() })
    return true
  } catch (e) {
    if (isInsufficient(e)) return false
    throw e
  }
}

/* ---------------- 拉取：把服务端余额镜像成本地 `__coin` ---------------- */

/**
 * 所有游戏的币余额。
 *
 * 只返回**开过钱包**的游戏；没开过的就是 0（服务端不写空行）。
 * 拉失败返回 `null`（和别的拉取一致：`null` = 不知道，别清本地）。
 */
export async function pullCoinBalances(): Promise<ServerCoinInfo[] | null> {
  try {
    const r = await listCoinInfo()
    return r.list ?? []
  } catch {
    return null
  }
}

/**
 * 某款游戏的币账本（**只为对账用**，界面不显示）。
 *
 * ⚠️ 分页参数是 `page_size` —— 见 `api/coin.ts` 的 `coinLedger` 注释。
 */
export const pullCoinLedger = (gameId: string, page = 1, pageSize = 200) =>
  coinLedger(gameId, page, pageSize)
