import { describe, expect, it } from 'vitest'
import {
  CLAW_DEFAULT_EXCHANGE,
  CLAW_DEFAULT_WIN_RATE,
  CLAW_EXCHANGE_CHOICES,
  CLAW_MAX_EXPECTED,
  CLAW_PLAY_COST,
  CLAW_POINTS_PER_COIN,
  CLAW_WIN_RATE_CHOICES,
  clampClawEconomy,
  clawEconomyIsSafe,
  clawEconomyProblem,
  clawExpectedCoupons,
  clawResolveRound,
  hashRandom,
  seedOf,
  type ClawEconomy,
} from './clawEconomy'

/* ============================================================
   娃娃机的经济不变量（2026-10-16）

   ★★ 唯一一条不能破的：**每局期望产出 < 1 点券**。

   为什么「< 1」而不是「看起来差不多就行」：兑换商城的付款口写着
   `1 点券 ≡ 1 积分`，而娃娃机是 1 积分买 1 个币、1 个币玩 1 局。
   于是 E ≥ 1 就等于「孩子坐着玩娃娃机就能把积分刷上去」，
   做任务反而成了最慢的路 —— 而且**不报错**，只会看到商城越来越便宜。

   这个文件里的每一条断言都对着这条不变量。
   ============================================================ */

/** 所有「家长能选到」的组合。UI 只提供这些档位，所以这些必须全覆盖。 */
const CHOICE_MATRIX: ClawEconomy[] = CLAW_WIN_RATE_CHOICES.flatMap((w) =>
  CLAW_EXCHANGE_CHOICES.map((x) => ({ winRate: w.value, exchangePerPrize: x })),
)

describe('娃娃机 · 期望值不变量', () => {
  it('默认参数是安全的', () => {
    const def = { winRate: CLAW_DEFAULT_WIN_RATE, exchangePerPrize: CLAW_DEFAULT_EXCHANGE }
    expect(clawEconomyIsSafe(def)).toBe(true)
    expect(clawExpectedCoupons(def)).toBeLessThan(CLAW_MAX_EXPECTED)
  })

  it('★ 一局只花 1 个币，而 1 个币只花 1 积分（1:1）', () => {
    // 这两个数就是不变量的分母，写错任何一个，E 的比较就没意义了
    expect(CLAW_PLAY_COST).toBe(1)
    expect(CLAW_POINTS_PER_COIN).toBe(1)
    expect(CLAW_PLAY_COST).toBe(CLAW_POINTS_PER_COIN)
  })

  it('★★ 全档位扫描：UI 提供的每一个组合，期望产出都不超过硬上限', () => {
    for (const e of CHOICE_MATRIX) {
      const ev = clawExpectedCoupons(e)
      if (clawEconomyIsSafe(e)) {
        expect(ev, `安全档 ${e.winRate} × ${e.exchangePerPrize} = ${ev}`).toBeLessThanOrEqual(
          CLAW_MAX_EXPECTED + 1e-9,
        )
      }
    }
  })

  it('★★ 全档位扫描：每一个「不安全」的组合都真的 ≥ 上限（没有误杀）', () => {
    for (const e of CHOICE_MATRIX) {
      if (!clawEconomyIsSafe(e)) {
        expect(
          clawExpectedCoupons(e),
          `被判不安全的 ${e.winRate} × ${e.exchangePerPrize}`,
        ).toBeGreaterThan(CLAW_MAX_EXPECTED)
      }
    }
  })

  it('★ 至少有一档是安全的、也至少有一档是不安全的（否则扫描是空跑）', () => {
    // 活性：只有「全都安全」的话，上面两条断言永远绿，什么也没验到
    expect(CHOICE_MATRIX.some((e) => clawEconomyIsSafe(e))).toBe(true)
    expect(CHOICE_MATRIX.some((e) => !clawEconomyIsSafe(e))).toBe(true)
  })

  it('★★ 反向钉子：E 恰好 = 1 的组合**必须**被判为不安全', () => {
    // 这是那条边界。放宽成「≤ 1」就等于把悬崖边上的护栏拆了 ——
    // 之后再任何一次微调都会滑到「> 1」，而那正是唯一危险的一侧。
    expect(clawEconomyIsSafe({ winRate: 0.5, exchangePerPrize: 2 })).toBe(false) // E = 1
    expect(clawEconomyIsSafe({ winRate: 1, exchangePerPrize: 1 })).toBe(false) // E = 1
    expect(clawEconomyIsSafe({ winRate: 1, exchangePerPrize: 5 })).toBe(false) // E = 5
  })

  it('★★ clamp 的输出**永远**安全 —— 扫一大片越界输入', () => {
    const wild = [
      { winRate: 1, exchangePerPrize: 99 },
      { winRate: 0.99, exchangePerPrize: 50 },
      { winRate: 0.5, exchangePerPrize: 3 },
      { winRate: 0.01, exchangePerPrize: 1000 },
      { winRate: -5, exchangePerPrize: -3 },
      { winRate: 12, exchangePerPrize: 2.7 },
      { winRate: 0, exchangePerPrize: 0 },
    ]
    for (const w of wild) {
      const c = clampClawEconomy(w)
      expect(clawEconomyIsSafe(c), `clamp(${JSON.stringify(w)}) = ${JSON.stringify(c)}`).toBe(true)
      expect(c.exchangePerPrize).toBeGreaterThanOrEqual(1)
      expect(c.winRate).toBeGreaterThan(0)
      expect(c.winRate).toBeLessThanOrEqual(1)
    }
  })

  it('clamp 优先保中奖率、只压兑换数（中奖率是手感，不该被悄悄改掉）', () => {
    const c = clampClawEconomy({ winRate: 0.5, exchangePerPrize: 5 })
    expect(c.winRate).toBe(0.5)
    expect(c.exchangePerPrize).toBe(1) // 0.8 / 0.5 = 1.6 → 向下取整到 1
  })

  it('不安全的组合给出的是**能看懂**的解释，不是一个错误码', () => {
    const msg = clawEconomyProblem({ winRate: 0.5, exchangePerPrize: 3 })
    expect(msg).toBeTruthy()
    expect(msg).toContain('1.50') // 把算出来的期望值写出来
    expect(msg).toContain('刷')
    expect(clawEconomyProblem({ winRate: 1 / 3, exchangePerPrize: 2 })).toBeNull()
  })

  it('参数本身非法时也要有话说（NaN / 负数 / 超 1）', () => {
    expect(clawEconomyProblem({ winRate: Number.NaN, exchangePerPrize: 2 })).toBeTruthy()
    expect(clawEconomyProblem({ winRate: 1.5, exchangePerPrize: 2 })).toBeTruthy()
    expect(clawEconomyProblem({ winRate: 0.3, exchangePerPrize: 0 })).toBeTruthy()
  })
})

describe('娃娃机 · 随机必须幂等', () => {
  it('★★ 同一个局数算两次，结果一模一样（刷新不能重掷）', () => {
    const e: ClawEconomy = { winRate: 0.5, exchangePerPrize: 2 }
    for (const i of [0, 1, 7, 42, 999]) {
      const a = clawResolveRound(i, e)
      const b = clawResolveRound(i, e)
      expect(a).toEqual(b)
    }
  })

  it('★ 不同局数会给出不同结果（否则「局数当 seed」是假的）', () => {
    const e: ClawEconomy = { winRate: 0.5, exchangePerPrize: 2 }
    const outcomes = Array.from({ length: 40 }, (_, i) => clawResolveRound(i, e).won)
    // 40 局里两种结果都要出现过
    expect(outcomes.some((x) => x)).toBe(true)
    expect(outcomes.some((x) => !x)).toBe(true)
  })

  it('★ 中奖率真的生效：大样本下实际中奖率贴近设定值', () => {
    const N = 20000
    for (const w of [0.5, 1 / 3, 0.25, 0.2]) {
      const e: ClawEconomy = { winRate: w, exchangePerPrize: 1 }
      let wins = 0
      for (let i = 0; i < N; i++) if (clawResolveRound(i, e).won) wins++
      const actual = wins / N
      // 二项分布 N=20000 时标准差约 0.0035 ⇒ 0.02 的容差已经很宽了。
      // 容差这么宽是因为这里要抓的是「哈希偏了」这种量级的错，不是抖一个样本。
      expect(Math.abs(actual - w), `设定 ${w}，实测 ${actual.toFixed(4)}`).toBeLessThan(0.02)
    }
  })

  it('★ 大样本下**实际期望产出**也不超过硬上限（不只是公式上不超）', () => {
    const N = 20000
    for (const w of CLAW_WIN_RATE_CHOICES) {
      const e = clampClawEconomy({ winRate: w.value, exchangePerPrize: 5 })
      let coupons = 0
      for (let i = 0; i < N; i++) coupons += clawResolveRound(i, e).coupons
      const perRound = coupons / N
      expect(perRound, `${e.winRate} × ${e.exchangePerPrize}`).toBeLessThanOrEqual(
        CLAW_MAX_EXPECTED + 0.02,
      )
    }
  })

  it('没抓到就不发点券（不许「参与奖」）', () => {
    const e: ClawEconomy = { winRate: 0.2, exchangePerPrize: 3 }
    for (let i = 0; i < 200; i++) {
      const r = clawResolveRound(i, e)
      if (!r.won) expect(r.coupons).toBe(0)
      else expect(r.coupons).toBe(3)
    }
  })

  it('seed 是稳定的整数（跨会话一致，不能用时间戳）', () => {
    expect(seedOf('claw|7')).toBe(seedOf('claw|7'))
    expect(Number.isInteger(seedOf('claw|7'))).toBe(true)
    expect(seedOf('claw|7')).toBeGreaterThanOrEqual(0)
  })

  it('hashRandom 落在 [0,1) 且不退化（不是常数、不越界）', () => {
    const vals = Array.from({ length: 5000 }, (_, i) => hashRandom(seedOf(`x|${i}`)))
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...vals)).toBeLessThan(1)
    expect(new Set(vals).size).toBeGreaterThan(4000) // 不是常数
  })
})
