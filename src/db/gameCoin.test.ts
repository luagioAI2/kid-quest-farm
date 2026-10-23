/**
 * 游戏币三扇门 + 兑换券出口的回归测试（2026-10-22 起）。
 *
 * 这一组测试盯的是**整条链**：
 *
 * ```
 *   积分 ──buyGameCoins──▶ 游戏币 ──redeemGameCoins──▶ 兑换券（没用完的币）
 *
 *   娃娃 ──mintGameVouchers──▶ 兑换券                 （抓到的奖品，不经过币）
 * ```
 *
 * 每条断言都对应一个**会静默出错**的形态（不抛异常、界面看着正常）：
 *   · 币不够却扣成了负数（守卫跑到事务外面）
 *   · 积分扣了、币没到（两个独立事务）
 *   · 币烧了、券没发（同上）
 *   · 兑换券被算进积分（两张表混了）
 *   · 汇率非法时"发 0 张但把币扣了"
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  addGameCoin,
  buyGameCoins,
  currentBalance,
  currentHarvestBalance,
  db,
  gameCoinBalanceOf,
  mintGameVouchers,
  postLedger,
  redeemGameCoins,
  spendGameCoin,
} from '../db/db'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const GAME = 'prizepark'

/** 先给孩子一些积分（走真实入口，不直接写表）。 */
async function givePoints(n: number): Promise<void> {
  await postLedger({ delta: n, source: 'task', memo: '测试用积分' })
}

describe('buyGameCoins：扣积分和记币在同一个事务里', () => {
  it('积分够：积分减少、币增加', async () => {
    await givePoints(100)
    const ok = await buyGameCoins(GAME, 5, 1, '买 5 个币')
    expect(ok).toBe(true)
    expect(await currentBalance()).toBe(95)
    expect(await gameCoinBalanceOf(GAME)).toBe(5)
  })

  it('积分不够：一分不扣、一个币不发', async () => {
    await givePoints(3)
    const ok = await buyGameCoins(GAME, 5, 1, '买 5 个币')
    expect(ok).toBe(false)
    expect(await currentBalance()).toBe(3)
    expect(await gameCoinBalanceOf(GAME)).toBe(0)
  })

  it('数量 / 汇率非法一律拒绝（0 或负数都不能白送币）', async () => {
    await givePoints(100)
    expect(await buyGameCoins(GAME, 0, 1, 'x')).toBe(false)
    expect(await buyGameCoins(GAME, 5, 0, 'x')).toBe(false)
    expect(await buyGameCoins(GAME, -3, 1, 'x')).toBe(false)
    expect(await currentBalance()).toBe(100)
    expect(await gameCoinBalanceOf(GAME)).toBe(0)
  })
})

describe('spendGameCoin：唯一允许写负数的入口', () => {
  it('币够就扣，不够就不扣（且不超支）', async () => {
    await addGameCoin(GAME, 2, '抓奖')
    expect(await spendGameCoin(GAME, 1, '玩一局')).toBe(true)
    expect(await spendGameCoin(GAME, 2, '玩一局')).toBe(false)
    expect(await gameCoinBalanceOf(GAME)).toBe(1)
  })

  it('并发扣币不会超支（守卫在事务里）', async () => {
    await addGameCoin(GAME, 1, '抓奖')
    const results = await Promise.all([
      spendGameCoin(GAME, 1, '并发 A'),
      spendGameCoin(GAME, 1, '并发 B'),
      spendGameCoin(GAME, 1, '并发 C'),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await gameCoinBalanceOf(GAME)).toBe(0)
  })
})

describe('redeemGameCoins：币 → 兑换券', () => {
  it('烧掉币、按汇率发券，且**不动积分**', async () => {
    await givePoints(100)
    await addGameCoin(GAME, 6, '回收娃娃')

    const got = await redeemGameCoins(GAME, 6, 1, '换成兑换券')
    expect(got).toBe(6)
    expect(await gameCoinBalanceOf(GAME)).toBe(0)
    expect(await currentHarvestBalance()).toBe(6)
    // 兑换券 ⇸ 积分：这条链有去无回
    expect(await currentBalance()).toBe(100)
  })

  it('汇率 2 时按 2 倍发券', async () => {
    await addGameCoin(GAME, 3, '回收娃娃')
    expect(await redeemGameCoins(GAME, 3, 2, 'x')).toBe(6)
    expect(await currentHarvestBalance()).toBe(6)
  })

  it('币不够：一张不发，币也不扣', async () => {
    await addGameCoin(GAME, 2, '回收娃娃')
    expect(await redeemGameCoins(GAME, 5, 1, 'x')).toBe(0)
    expect(await gameCoinBalanceOf(GAME)).toBe(2)
    expect(await currentHarvestBalance()).toBe(0)
  })

  it('汇率非法（0 / 负数）：拒绝，且**不能把币扣了**', async () => {
    await addGameCoin(GAME, 4, '回收娃娃')
    expect(await redeemGameCoins(GAME, 4, 0, 'x')).toBe(0)
    expect(await redeemGameCoins(GAME, 4, -1, 'x')).toBe(0)
    expect(await gameCoinBalanceOf(GAME)).toBe(4)
    expect(await currentHarvestBalance()).toBe(0)
  })

  it('账本口径：币是一串 delta（负数也记），券在另一张表', async () => {
    await addGameCoin(GAME, 2, 'a')
    await addGameCoin(GAME, 3, 'b')
    await redeemGameCoins(GAME, 4, 1, 'c')
    const coinRows = await db.gameKv.toArray()
    const coin = coinRows.find((r) => r.key.endsWith(':__coin'))
    expect(Array.isArray(coin?.value)).toBe(true)
    expect((coin!.value as { delta: number }[]).map((r) => r.delta)).toEqual([2, 3, -4])
    expect(await currentHarvestBalance()).toBe(4)
  })
})

describe('mintGameVouchers：娃娃直接发券，**不经过币**', () => {
  /*
   * 这一组盯的是「回路」：卖娃娃如果能产币，而币能直接开局，
   * 那就是「抓娃娃本身能续玩」—— 一条不花积分的刷券路径。
   * 所以最值钱的一条断言是**币账本一行都没多**。
   */

  it('发券、不动积分、**币账本一行都不写**', async () => {
    await givePoints(100)
    const got = await mintGameVouchers(GAME, 2, '回收 BIG小熊 ×1')

    expect(got).toBe(2)
    expect(await currentHarvestBalance()).toBe(2)
    expect(await currentBalance()).toBe(100)
    // ★ 关键：币一分没长
    expect(await gameCoinBalanceOf(GAME)).toBe(0)
    const rows = await db.gameKv.toArray()
    expect(rows.some((r) => r.key.endsWith(':__coin'))).toBe(false)
  })

  it('币不够也能发（它根本不看币余额）', async () => {
    // 一个币都没有，照样能卖娃娃拿券 —— 否则「币花光了、娃娃卖不掉」就成死路
    expect(await gameCoinBalanceOf(GAME)).toBe(0)
    expect(await mintGameVouchers(GAME, 5, '卖 5 个')).toBe(5)
    expect(await currentHarvestBalance()).toBe(5)
  })

  it('数量非法（0 / 负数 / NaN）一律不发，也不抛', async () => {
    expect(await mintGameVouchers(GAME, 0, 'x')).toBe(0)
    expect(await mintGameVouchers(GAME, -3, 'x')).toBe(0)
    expect(await mintGameVouchers(GAME, Number.NaN, 'x')).toBe(0)
    expect(await currentHarvestBalance()).toBe(0)
  })

  it('账本口径：记在兑换券那张表、source 是 claw_prize、refId 是游戏 id', async () => {
    await mintGameVouchers(GAME, 3, '回收 手办 ×1')
    const rows = await db.harvestLedger.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].delta).toBe(3)
    expect(rows[0].source).toBe('claw_prize')
    expect(rows[0].refId).toBe(GAME)
    // 余额 = delta 之和（和宿主另外两套币同一口径）
    expect(rows[0].balanceAfter).toBe(3)
  })

  it('和 redeemGameCoins 是两条路：一个烧币、一个不碰币', async () => {
    await addGameCoin(GAME, 4, '买来的')
    expect(await mintGameVouchers(GAME, 2, '卖娃娃')).toBe(2)
    expect(await gameCoinBalanceOf(GAME)).toBe(4) // 币还在
    expect(await redeemGameCoins(GAME, 4, 1, '换成兑换券')).toBe(4)
    expect(await gameCoinBalanceOf(GAME)).toBe(0) // 这条才烧币
    expect(await currentHarvestBalance()).toBe(6)
  })
})
