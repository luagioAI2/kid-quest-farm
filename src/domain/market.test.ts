import { describe, expect, it } from 'vitest'
import {
  advanceMarket,
  applySell,
  createInitialMarket,
  priceOf,
  priceSeries,
  sellQuote,
  trendOf,
  valueHint,
} from './market'
import { MARKET_HISTORY_DAYS, PRICE_CEILING, PRICE_FLOOR, PRODUCE_BASE_PRICE } from './catalog'

/* ============================================================
   市场计价引擎测试
   ------------------------------------------------------------
   家长的核心要求是「不能让产出和最后卖积分太膨胀，导致兑换无法控制」，
   所以最重要的断言是：**任何情况下价格都不越界**。
   本文件就用大量随机推进来暴力验证这道硬约束。
   ============================================================ */

const BASE = PRODUCE_BASE_PRICE

describe('createInitialMarket', () => {
  it('第 0 天所有价格等于基准价', () => {
    const m = createInitialMarket(BASE, 0)
    for (const q of m.quotes) {
      expect(q.price).toBe(q.base)
      expect(q.prevPrice).toBe(q.base)
    }
  })

  it('只为有基准价的商品建仓', () => {
    const m = createInitialMarket(BASE, 0)
    expect(m.quotes.length).toBeGreaterThan(0)
    for (const q of m.quotes) {
      expect(BASE[q.itemId]).toBeDefined()
    }
  })

  it('初始指数是 100（表示无偏离）', () => {
    const m = createInitialMarket(BASE, 0)
    expect(m.indexNow).toBe(100)
    expect(m.indexPrev).toBe(100)
  })
})

describe('advanceMarket —— 价格硬边界', () => {
  it('无论推进多少天，价格都锁在 base×0.55 ~ base×1.6 之间', () => {
    let m = createInitialMarket(BASE, 0)
    // 暴力推进：跨过 90 天慢波周期、跨年、跨闰
    for (const target of [1, 7, 30, 90, 180, 365, 730, 1460]) {
      m = advanceMarket(m, target)
      for (const q of m.quotes) {
        expect(q.price).toBeLessThanOrEqual(round2(q.base * PRICE_CEILING) + 1e-9)
        expect(q.price).toBeGreaterThanOrEqual(round2(q.base * PRICE_FLOOR) - 1e-9)
      }
    }
  })

  it('一次跳 1000 天也不会让价格跑飞', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 1000)
    for (const q of m.quotes) {
      expect(q.price / q.base).toBeGreaterThanOrEqual(PRICE_FLOOR - 1e-9)
      expect(q.price / q.base).toBeLessThanOrEqual(PRICE_CEILING + 1e-9)
    }
  })

  it('幂等：同一个目标日重复推进结果完全一致', () => {
    const a = advanceMarket(createInitialMarket(BASE, 0), 40)
    const b = advanceMarket(createInitialMarket(BASE, 0), 40)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('分段推进 = 一次推进（不会因为刷新次数不同而变价）', () => {
    const oneShot = advanceMarket(createInitialMarket(BASE, 0), 30)
    let stepped = createInitialMarket(BASE, 0)
    for (let d = 1; d <= 30; d++) stepped = advanceMarket(stepped, d)
    const p1 = oneShot.quotes.map((q) => q.price)
    const p2 = stepped.quotes.map((q) => q.price)
    expect(p2).toEqual(p1)
  })

  it('目标日不前进时原样返回（不产生新历史）', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 10)
    expect(advanceMarket(m, 10)).toBe(m)
    expect(advanceMarket(m, 5)).toBe(m)
  })

  it('历史长度被裁到 MARKET_HISTORY_DAYS', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 200)
    expect(m.history.length).toBeLessThanOrEqual(MARKET_HISTORY_DAYS)
    expect(m.history[m.history.length - 1]?.day).toBe(200)
  })

  it('prevPrice 记录的是上一日价格，走势才有意义', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 1)
    for (const q of m.quotes) expect(q.prevPrice).toBe(q.base)
    const m2 = advanceMarket(m, 2)
    for (const q of m2.quotes) {
      expect(q.prevPrice).toBe(m.quotes.find((x) => x.itemId === q.itemId)!.price)
    }
  })
})

describe('applySell —— 卖出砸盘', () => {
  it('卖出后价格下降，绝不上升', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    const before = priceOf(m, 'egg')!
    const after = priceOf(applySell(m, 'egg', 10), 'egg')!
    expect(after).toBeLessThan(before)
  })

  it('卖得越多，跌得越多', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    const a = priceOf(applySell(m, 'egg', 5), 'egg')!
    const b = priceOf(applySell(m, 'egg', 50), 'egg')!
    expect(b).toBeLessThan(a)
  })

  it('砸到下限就停住，不会变成 0 或负数', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    const q = m.quotes.find((x) => x.itemId === 'egg')!
    const floored = priceOf(applySell(m, 'egg', 100000), 'egg')!
    expect(floored).toBe(round2(q.base * PRICE_FLOOR))
    expect(floored).toBeGreaterThan(0)
  })

  it('卖 0 个或负数时状态不变', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    expect(applySell(m, 'egg', 0)).toBe(m)
    expect(applySell(m, 'egg', -3)).toBe(m)
  })

  it('只影响卖出的那一个商品', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    const after = applySell(m, 'egg', 20)
    for (const q of after.quotes) {
      if (q.itemId === 'egg') continue
      expect(q.price).toBe(m.quotes.find((x) => x.itemId === q.itemId)!.price)
    }
  })

  it('累加 soldToday，便于解释「今天卖太多了」', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    const a = applySell(m, 'egg', 3)
    const b = applySell(a, 'egg', 4)
    expect(b.quotes.find((q) => q.itemId === 'egg')!.soldToday).toBe(7)
  })

  it('卖出后当天历史收盘价同步更新', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    const after = applySell(m, 'egg', 10)
    const today = after.history.find((h) => h.day === after.day)!
    expect(today.prices['egg']).toBe(priceOf(after, 'egg'))
  })
})

describe('trendOf / valueHint', () => {
  it('涨跌方向与百分比自洽', () => {
    const up = { itemId: 'x', base: 100, price: 110, prevPrice: 100, day: 1, soldToday: 0 }
    expect(trendOf(up)).toEqual({ dir: 'up', pct: 10 })
    const down = { ...up, price: 90 }
    expect(trendOf(down)).toEqual({ dir: 'down', pct: -10 })
    const flat = { ...up, price: 100 }
    expect(trendOf(flat).dir).toBe('flat')
  })

  it('prevPrice 为 0 时不做除零爆炸', () => {
    const q = { itemId: 'x', base: 100, price: 50, prevPrice: 0, day: 1, soldToday: 0 }
    expect(Number.isFinite(trendOf(q).pct)).toBe(true)
  })

  it('低买高卖提示与价格位置一致', () => {
    const mk = (price: number) => ({
      itemId: 'x',
      base: 100,
      price,
      prevPrice: 100,
      day: 1,
      soldToday: 0,
    })
    expect(valueHint(mk(70)).tone).toBe('cheap')
    expect(valueHint(mk(100)).tone).toBe('normal')
    expect(valueHint(mk(150)).tone).toBe('pricey')
  })
})

describe('priceSeries', () => {
  it('返回不超过请求天数的价格序列，且全部落在硬边界内', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 30)
    const s = priceSeries(m, 'egg', 7)
    expect(s.length).toBeGreaterThan(0)
    expect(s.length).toBeLessThanOrEqual(7)
    const base = BASE['egg']!
    for (const p of s) {
      expect(p).toBeGreaterThan(0)
      expect(p).toBeLessThanOrEqual(round2(base * PRICE_CEILING) + 1e-9)
      expect(p).toBeGreaterThanOrEqual(round2(base * PRICE_FLOOR) - 1e-9)
    }
  })

  it('序列最后一个值就是今天的价（走势图右端必须对得上现价）', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 12)
    const s = priceSeries(m, 'egg', 7)
    expect(s[s.length - 1]).toBe(priceOf(m, 'egg'))
  })

  it('请求天数超过历史长度时返回全部历史，不补 0', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 3)
    const s = priceSeries(m, 'egg', 100)
    expect(s.length).toBe(m.history.length)
    expect(s.every((n) => n > 0)).toBe(true)
  })

  it('没有历史的商品返回空数组而不是抛错', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 5)
    expect(priceSeries(m, '不存在的商品', 7)).toEqual([])
  })
})

describe('孩子收益不会膨胀（兑换可控性的根基）', () => {
  it('单个产出品在 365 天内的最高价不超过基准价的 1.6 倍', () => {
    let m = createInitialMarket(BASE, 0)
    let peak = 0
    for (let d = 1; d <= 365; d += 7) {
      m = advanceMarket(m, d)
      for (const q of m.quotes) peak = Math.max(peak, q.price / q.base)
    }
    expect(peak).toBeLessThanOrEqual(PRICE_CEILING + 1e-9)
  })

  it('卖光一背包也不会瞬间致富：单次收益有明确上界', () => {
    const m = advanceMarket(createInitialMarket(BASE, 0), 10)
    // 假设孩子攒满 999 个最贵的产出
    const best = Math.max(...m.quotes.map((q) => q.base))
    const jackpot = sellQuote(m, m.quotes.find((q) => q.base === best)!.itemId, 999)
    // 上限 = 999 × base × 1.6，且因为砸盘实际更低
    expect(jackpot).toBeLessThanOrEqual(Math.round(999 * best * PRICE_CEILING))
  })
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
