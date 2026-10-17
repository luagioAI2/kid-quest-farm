import { beforeEach, describe, expect, it } from 'vitest'
import {
  currentHarvestBalance,
  db,
  gameCoinBalanceOf,
  getGameKv,
  postLedger,
  postMall,
} from '../db/db'
import { useApp } from './useApp'
import {
  CLAW_DEFAULT_EXCHANGE,
  CLAW_DEFAULT_WIN_RATE,
  CLAW_PLAYS_KEY,
  CLAW_PLAY_COST,
  clawExpectedCoupons,
} from '../domain/clawEconomy'
import { GAME_CLAW } from '../games/ids'

/* ============================================================
   娃娃机的账（store 这一层）
   ------------------------------------------------------------
   纯函数那一半在 `domain/clawEconomy.test.ts` 里已经扫过全参数空间了。
   这里验的是**接上数据库之后**还成不成立：

     · 买币：1 积分 → 1 个币，积分不够时**一笔账都不写**；
     · 结算：扣币 / 发商城币 / 局数 +1 是**一件事**；
     · ★ 同一局结算两次**不会**扣两个币（否则孩子狂点按钮就能刷）；
     · ★ 玩很多局之后，发出去的商城币**一定少于**花掉的积分 ——
       这是那条不能破的不变量的**实测版**（推导见 clawEconomy.ts 头注释）。
   ============================================================ */

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 给积分账本塞钱（走账本，不是直接改余额） */
async function grantPoints(n: number) {
  await postLedger({ delta: n, source: 'manual_adjust', memo: '测试发分' })
  await useApp.getState().refresh()
}

beforeEach(async () => {
  await boot()
  // 抹平首装赠送的 500 钻石，让本文件所有用例的「钻石基线」回到 0。
  // 首装种子的专门断言在 useApp.test.ts 的「首装赠送 500 钻石」里。
  await db.mallLedger.clear()
  await useApp.getState().refresh()
})

describe('买币', () => {
  it('1 积分换 1 个币', async () => {
    await grantPoints(5)
    const before = useApp.getState().balance
    const ok = await useApp.getState().buyClawCoin()
    expect(ok).toBe(true)
    expect(useApp.getState().clawCoins).toBe(1)
    expect(useApp.getState().balance).toBe(before - CLAW_PLAY_COST)
    expect(await gameCoinBalanceOf(GAME_CLAW)).toBe(1)
  })

  it('积分不够就换不到，而且**一笔账都不写**', async () => {
    // ⚠️ 新档默认**不是 0**（首装会送一点积分，见 seed）。先把余额抹平，
    //    这条要验的是「一分都没有的时候」。
    await grantPoints(-useApp.getState().balance)
    expect(useApp.getState().balance).toBe(0)

    const ok = await useApp.getState().buyClawCoin()
    expect(ok).toBe(false)
    expect(useApp.getState().clawCoins).toBe(0)
    expect(await gameCoinBalanceOf(GAME_CLAW)).toBe(0)
  })
})

describe('结算一局', () => {
  it('没币时结算不了：`ok:false`，而且局数不动', async () => {
    const res = await useApp.getState().settleClawRound(0)
    expect(res.ok).toBe(false)
    expect(res.won).toBe(false)
    expect(useApp.getState().clawPlays).toBe(0)
    expect(await currentHarvestBalance()).toBe(0)
  })

  it('结算一局：扣 1 个币，局数 +1', async () => {
    await grantPoints(10)
    await useApp.getState().buyClawCoin()
    await useApp.getState().buyClawCoin()

    const res = await useApp.getState().settleClawRound(0)
    expect(res.ok).toBe(true)
    expect(useApp.getState().clawCoins).toBe(1)
    expect(useApp.getState().clawPlays).toBe(1)
    expect(await getGameKv(GAME_CLAW, CLAW_PLAYS_KEY)).toBe(1)
  })

  it('★★ 同一局结算两次，第二次被拒 —— 不会扣两个币', async () => {
    /*
      这是「狂点下爪按钮」那个洞的账上闸门。

      没有它的话：第二次算出来的结果和第一次**一模一样**（seed 是局数，
      幂等），所以券不会多发，但**币会多扣一个** —— 账上少一个币，
      界面全绿，没有任何报错。
    */
    await grantPoints(10)
    await useApp.getState().buyClawCoin()
    await useApp.getState().buyClawCoin()

    const first = await useApp.getState().settleClawRound(0)
    expect(first.ok).toBe(true)
    const coinsAfterFirst = useApp.getState().clawCoins
    const couponsAfterFirst = await currentHarvestBalance()

    const again = await useApp.getState().settleClawRound(0)
    expect(again.ok).toBe(false)
    expect(useApp.getState().clawCoins).toBe(coinsAfterFirst)
    expect(await currentHarvestBalance()).toBe(couponsAfterFirst)
    expect(useApp.getState().clawPlays).toBe(1)
  })

  it('★ 跳过一局（index 对不上）也结算不了', async () => {
    await grantPoints(10)
    await useApp.getState().buyClawCoin()
    const res = await useApp.getState().settleClawRound(7)
    expect(res.ok).toBe(false)
    expect(useApp.getState().clawCoins).toBe(1)
  })

  it('中了就发商城币，没中一个都不发（没有「参与奖」）', async () => {
    /*
      一局一局地比：`settleClawRound` 实际发出来的商城币，必须**等于**
      `clawResolveRound` 那一局算出来的数。差一分就说明
      「结算读的设置」和「纯函数读的设置」不是同一份 —— 那种错
      表现成「偶尔多发一点」，很难从总数上看出来。

      ⚠️ 用 `CLAW_DEFAULT_*` 而不是从设置里读：这一条要验的是
      **默认存档下**的行为，读设置会把「设置本身被改坏」也一起验进来。
    */
    const econ = { winRate: CLAW_DEFAULT_WIN_RATE, exchangePerPrize: CLAW_DEFAULT_EXCHANGE }
    const { clawResolveRound } = await import('../domain/clawEconomy')
    const idx = Array.from({ length: 60 }, (_, i) => i)
    const wonIndex = idx.find((i) => clawResolveRound(i, econ).won)
    const lostIndex = idx.find((i) => !clawResolveRound(i, econ).won)
    // 两个都要存在，否则下面的循环只验了一种情况
    expect(wonIndex, '60 局里一局都没中 —— 中奖率是不是被改成 0 了？').toBeDefined()
    expect(lostIndex, '60 局里一局都没落空 —— 中奖率是不是被改成 1 了？').toBeDefined()

    const upto = Math.max(wonIndex!, lostIndex!)
    await grantPoints(upto + 10)
    for (let i = 0; i <= upto; i++) {
      expect(await useApp.getState().buyClawCoin(), `第 ${i + 1} 个币没买成`).toBe(true)
    }

    let wins = 0
    let losses = 0
    for (let i = 0; i <= upto; i++) {
      const before = await currentHarvestBalance()
      const r = await useApp.getState().settleClawRound(i)
      const after = await currentHarvestBalance()
      const expectRound = clawResolveRound(i, econ)
      expect(r.coupons, `第 ${i + 1} 局发的商城币不对`).toBe(
        expectRound.won ? CLAW_DEFAULT_EXCHANGE : 0,
      )
      // 商城币余额的变化量必须**正好**是这一局该发的数
      expect(after - before).toBe(r.coupons)
      if (r.won) wins++
      else losses++
    }
    // 存活校验：这一轮里真的既有中、也有没中
    expect(wins).toBeGreaterThan(0)
    expect(losses).toBeGreaterThan(0)
  })
})

describe('★★ 不变量：玩娃娃机是净消费，不是刷分', () => {
  /*
    ⚠️ 显式给超时。

    这一条要真的跑 N 局，而 `buyClawCoin` / `settleClawRound` **每次都
    `refresh()`**（重读任务 / 地块 / 动物 / 三套账本…），实测 ~18ms 一次
    ⇒ N 局大约 36N 毫秒。默认的 5 秒上限只够 120 局出头 ——
    单独跑刚好过，跟整套一起跑（机器更忙）就**超时**，
    而超时的报错长得像断言失败，很容易被当成「不变量被破坏了」。

    N 从 120 降到 60：不变量是**定性**的（净亏），60 局足够看出来，
    而且确定性哈希下这个数不会抖。
  */
  it('连玩 60 局：发出去的商城币 < 花掉的积分', { timeout: 30_000 }, async () => {
    /*
      这是 `clawEconomy.ts` 头注释那条推导的**实测版**：

        花 1 积分 → 期望拿回 E 商城币 → 兑换口 1 商城币 ≡ 1 积分
        ⇒ 净收益 = E − 1

      只要 E < 1，孩子坐在这儿玩一天也刷不出积分来。
      这条断言就是那个「< 1」在真实数据库上的样子。

      ⚠️ 结果是**确定性**的（seed 是局数，不是随机数），所以这几条断言
      不存在「偶尔红」—— 它们要么一直绿，要么改坏了就一直红。
      带宽只是用来容忍「以后微调中奖率」，不是用来容忍抖动。
    */
    const N = 60
    await grantPoints(N + 10)
    const pointsAtStart = useApp.getState().balance

    for (let i = 0; i < N; i++) {
      expect(await useApp.getState().buyClawCoin(), `第 ${i + 1} 次买币失败`).toBe(true)
    }
    const pointsAfterBuying = useApp.getState().balance
    // 买币只扣积分，一分不多一分不少
    expect(pointsAtStart - pointsAfterBuying).toBe(N * CLAW_PLAY_COST)

    for (let i = 0; i < N; i++) {
      expect((await useApp.getState().settleClawRound(i)).ok, `第 ${i + 1} 局没结算`).toBe(true)
    }

    const coupons = await currentHarvestBalance()
    const expected = clawExpectedCoupons({
      winRate: CLAW_DEFAULT_WIN_RATE,
      exchangePerPrize: CLAW_DEFAULT_EXCHANGE,
    })

    // ★ 不变量本体：拿回来的比花出去的**少**
    expect(coupons).toBeLessThan(N * CLAW_PLAY_COST)
    // 而且不能少得离谱 —— 说明哈希没坏、中奖率真的是家长设的那个数
    expect(coupons).toBeGreaterThan(N * expected * 0.7)
    expect(coupons).toBeLessThan(N * expected * 1.3)
    // 结算一局不再动积分（只有「买币」花积分）
    expect(useApp.getState().balance).toBe(pointsAfterBuying)
    expect(useApp.getState().clawPlays).toBe(N)
  })
})

describe('家长手动发放钻石', () => {
  it('发放 / 扣回都写账本，余额跟着变', async () => {
    expect(useApp.getState().mallBalance).toBe(0)
    const r1 = await useApp.getState().mintMall(120)
    expect(r1.ok).toBe(true)
    expect(useApp.getState().mallBalance).toBe(120)

    const r2 = await useApp.getState().mintMall(-20)
    expect(r2.ok).toBe(true)
    expect(useApp.getState().mallBalance).toBe(100)
  })

  it('发 0 个不算一次操作（不写空账）', async () => {
    const r = await useApp.getState().mintMall(0)
    expect(r.ok).toBe(false)
    expect(useApp.getState().mallBalance).toBe(0)
  })

  it('★ 发了钻石就能买下娃娃机 —— 这条闭环是家长那条路的全部', async () => {
    // 没有发币入口的话，钻石恒为 0 ⇒ 购买按钮按下去必然失败。
    // 所以「手动发放」和「买得下来」必须一起验。
    const { gameById } = await import('../games/registry')
    const price = gameById(GAME_CLAW)!.priceMall
    await postMall({ delta: price, source: 'manual_adjust', memo: '测试发放' })
    await useApp.getState().refresh()

    const res = await useApp.getState().buyGame(GAME_CLAW)
    expect(res.ok).toBe(true)
    expect(useApp.getState().ownedGameIds).toContain(GAME_CLAW)
    expect(useApp.getState().mallBalance).toBe(0)
  })
})
