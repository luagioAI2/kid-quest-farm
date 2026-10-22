/**
 * 插件游戏的**经济闸门** —— 装之前必须过的那道门（spec §5.4 / §12.6）。
 *
 * ## 为什么单独一个纯函数
 *
 * 这道门要在**三个地方**成立，而且必须得出同一个结论：
 *
 *   ① 安装时（`useApp.installLocalGame` / `installFromCatalog`）—— 不合法就不装；
 *   ② 设置页（给家长看「这款游戏一局能出多少」）；
 *   ③ 单测（全参数空间，不是拍脑袋举两个例子）。
 *
 * 写在任何一个调用点里，另外两个就会慢慢走散 —— 本项目的老毛病
 * （`clawEconomy.ts` 当初也是这么抽出来的）。
 *
 * ## 三条不变量
 *
 * ```
 *   1. 0 < playCost
 *   2. 0 ≤ expectedPayout ≤ 0.8 × playCost        ← 不能有正期望
 *   3. 1 ≤ capPerPrize
 *   4. 若开放兑换：expectedPayout × voucherPerCoin < playCost
 * ```
 *
 * 第 2 条为什么是 0.8 而不是 1：`expectedPayout` 是**插件自己申报**的数，
 * 不是宿主算出来的。申报值贴着 1 时，真实抓取率稍微高一点就越线。
 * 内置娃娃机（`clawEconomy.ts`）用的是同一条 20% 边际。
 *
 * 第 4 条是第 2 条的加强版：兑换券 ≡ 1 积分，所以「一局期望换出多少积分」
 * 才是真正要守住的数。`expectedPayout < playCost` 只保证**币**不超发；
 * 如果 `voucherPerCoin = 10`，1 个币换 10 张券，照样能刷。
 */

import type { GameEconomy } from '../games/plugin'

/** 期望产出最多占成本的比例。与 `clawEconomy.ts` 的 20% 边际保持一致。 */
export const MAX_PAYOUT_RATIO = 0.8

export interface EconomyIssue {
  /** 机器可读的分类，UI 可以据此换文案 */
  code: 'playCost' | 'payout' | 'payoutRatio' | 'cap' | 'voucher'
  message: string
}

/**
 * 校验一份 `economy`。**通过返回 `null`**（不是 true —— 失败时要带原因）。
 *
 * 纯函数，不读 store、不读 DB，所以能直接喂给单测和安装流程。
 */
export function checkPluginEconomy(e: GameEconomy | undefined | null): EconomyIssue | null {
  if (!e || typeof e !== 'object') {
    return { code: 'playCost', message: 'manifest.economy 缺失' }
  }

  const playCost = Number(e.playCost)
  const payout = Number(e.expectedPayout)
  const cap = Number(e.capPerPrize)

  if (!Number.isFinite(playCost) || playCost <= 0) {
    return { code: 'playCost', message: `playCost 必须是正数（拿到 ${String(e.playCost)}）` }
  }
  if (!Number.isFinite(payout) || payout < 0) {
    return { code: 'payout', message: `expectedPayout 不能是负数（拿到 ${String(e.expectedPayout)}）` }
  }
  if (payout > playCost * MAX_PAYOUT_RATIO) {
    return {
      code: 'payoutRatio',
      message:
        `expectedPayout ${payout} 超过 playCost ${playCost} 的 ${MAX_PAYOUT_RATIO * 100}%` +
        `（上限 ${+(playCost * MAX_PAYOUT_RATIO).toFixed(3)}）—— 一局期望产出不能接近成本，否则就是印钞机`,
    }
  }
  if (!Number.isFinite(cap) || cap < 1) {
    return { code: 'cap', message: `capPerPrize 必须 ≥ 1（拿到 ${String(e.capPerPrize)}）` }
  }

  /*
   * `voucherPerCoin` 是可选的（不写 = 这款游戏不开放兑换）。
   * ⚠️ 用 `== null` 判「没写」，不要用 `!rate` —— 写 0 和没写语义相同，
   *    但 `0` 会被 `!` 判成假，将来想区分「明确关闭」和「漏写」就分不出来了。
   */
  const rate = e.voucherPerCoin
  if (rate != null) {
    if (!Number.isFinite(rate) || rate < 0) {
      return { code: 'voucher', message: `voucherPerCoin 不能是负数（拿到 ${String(rate)}）` }
    }
    if (rate > 0 && payout * rate >= playCost) {
      return {
        code: 'voucher',
        message:
          `一局期望换出 ${+(payout * rate).toFixed(3)} 兑换券，不低于一局成本 ${playCost}` +
          ' —— 兑换券 ≡ 1 积分，这条不成立就是「坐着玩就能刷积分」',
      }
    }
  }

  return null
}

/**
 * 一局期望换出多少兑换券。给设置页显示用（家长要能看见）。
 *
 * 没开放兑换时返回 0 —— 调用方据此决定「要不要显示这一行」。
 */
export function vouchersPerPlay(e: GameEconomy | undefined | null): number {
  if (!e || !e.voucherPerCoin) return 0
  const v = Number(e.expectedPayout) * Number(e.voucherPerCoin)
  return Number.isFinite(v) && v > 0 ? v : 0
}
