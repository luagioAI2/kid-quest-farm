import {
  MARKET_GOODS,
  PRICE_CEILING,
  PRICE_DAILY_SWING,
  PRICE_FLOOR,
  SELL_IMPACT_PER_UNIT,
  MARKET_HISTORY_DAYS,
} from './catalog'
import type { MarketHistoryPoint, MarketQuote, MarketState } from './types'

/* ============================================================
   农场市场 —— 价格浮动引擎

   设计目标（来自家长需求）：
   * 「价格浮动，上限以下浮动，显示价格走向，主要是帮助孩子对市场了解」
   * 「帮我做好产出数值，不能让产出和最后卖积分太膨胀，导致兑换无法控制」

   因此这里的浮动有两层：
   1. 慢变量 base 漂移 —— 模拟整体行情，日与日之间缓慢移动
   2. 快变量 price 围绕 base 震荡 —— 今天可能特别贵或特别便宜

   同时有两道硬约束：
   * 价格硬上限 base * PRICE_CEILING（1.6），永不超过
   * 价格硬下限 base * PRICE_FLOOR（0.55），永不跌破
   * 这样孩子的单位时间收益被锁死在约 0.96 ~ 2.8 分/分钟
     （以基准 1.75 计），兑换商城的定价就有了稳定的锚。
   ============================================================ */

/** 稳定的伪随机：同一个 seed 永远得到同一个数（0~1），便于离线补算 */
function hashRandom(seed: number): number {
  let x = Math.sin(seed * 12.9898) * 43758.5453
  x = x - Math.floor(x)
  return x
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function clampPrice(base: number, price: number): number {
  const hi = base * PRICE_CEILING
  const lo = base * PRICE_FLOOR
  return round2(Math.min(hi, Math.max(lo, price)))
}

/** 新建一条报价（第 0 天，价格等于基准价） */
export function createQuote(itemId: string, base: number, day = 0): MarketQuote {
  return {
    itemId,
    base,
    price: base,
    prevPrice: base,
    day,
    soldToday: 0,
  }
}

export function createInitialMarket(basePrices: Record<string, number>, day = 0): MarketState {
  const quotes = MARKET_GOODS.filter((id) => basePrices[id] != null).map((id) =>
    createQuote(id, basePrices[id], day),
  )
  return {
    quotes,
    history: [
      {
        day,
        prices: Object.fromEntries(quotes.map((q) => [q.itemId, q.price])),
      },
    ],
    day,
    indexPrev: 100,
    indexNow: 100,
  }
}

/**
 * 把市场推进到目标日。
 *
 * 关键点：**可以一次跳很多天**（孩子隔了一周才打开 App）。
 * 用算术循环推进（最多几百天，完全可接受），而不是真的一天一天 tick。
 *
 * 每一天的价格由「基准价 + 稳定噪声」决定，所以：
 * * 同一历史日期重复计算结果一致（幂等，不会因为刷新而"变价"）
 * * 不同日期自然呈现出涨涨跌跌的走势图
 */
export function advanceMarket(state: MarketState, targetDay: number): MarketState {
  if (targetDay <= state.day) return state

  // 从上次记录的位置继续，但最多回推 MARKET_HISTORY_DAYS 天
  const startDay = Math.max(state.day + 1, targetDay - MARKET_HISTORY_DAYS + 1)

  const quotes = state.quotes.map((q) => ({ ...q }))
  const history: MarketHistoryPoint[] = []

  const baseById = new Map(quotes.map((q) => [q.itemId, q.base]))

  for (let day = startDay; day <= targetDay; day++) {
    const dayPrices: Record<string, number> = {}

    for (const q of quotes) {
      const base = baseById.get(q.itemId) ?? q.base

      // 慢变量：基准价自身的漂移（周期 ~90 天）
      const longWave = Math.sin((day / 90) * Math.PI * 2 + hashRandom(q.itemId.length * 7) * 6.28)
      const drift = base * (1 + longWave * 0.06)

      // 快变量：当日供需噪声（换日必变，同日恒定）
      const noiseSeed = day * 1000 + q.itemId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
      const noise = (hashRandom(noiseSeed) - 0.5) * 2 // -1 ~ 1
      const seasonal = base * noise * PRICE_DAILY_SWING

      const next = clampPrice(base, drift + seasonal)
      q.prevPrice = q.price
      q.price = next
      q.day = day
      q.soldToday = 0
      dayPrices[q.itemId] = next
    }

    history.push({ day, prices: dayPrices })
  }

  const merged = [...state.history, ...history].slice(-MARKET_HISTORY_DAYS)

  // 大盘指数：所有商品相对基准价的平均偏离，100 为中枢
  const indexNow = round2(
    100 *
      (quotes.reduce((sum, q) => sum + q.price / (q.base || 1), 0) / Math.max(1, quotes.length)),
  )
  const lastIdx = state.history[state.history.length - 1]
  const indexPrev =
    lastIdx == null
      ? indexNow
      : round2(
          100 *
            (quotes.reduce((sum, q) => {
              const p = lastIdx.prices[q.itemId]
              return sum + (p ?? q.base) / (q.base || 1)
            }, 0) /
              Math.max(1, quotes.length)),
        )

  return {
    quotes,
    history: merged,
    day: targetDay,
    indexPrev,
    indexNow,
  }
}

/** 取某个产出的现价 */
export function priceOf(state: MarketState, itemId: string): number | undefined {
  return state.quotes.find((q) => q.itemId === itemId)?.price
}

/** 涨跌方向：用于给孩子看 ↑↓ */
export type TrendDir = 'up' | 'down' | 'flat'

export function trendOf(q: MarketQuote): { dir: TrendDir; pct: number } {
  const diff = q.price - q.prevPrice
  if (Math.abs(diff) < 0.005) return { dir: 'flat', pct: 0 }
  return { dir: diff > 0 ? 'up' : 'down', pct: round2((diff / (q.prevPrice || 1)) * 100) }
}

/** 相对基准价的位置：便宜 / 正常 / 贵 —— 教孩子「低买高卖」 */
export function valueHint(q: MarketQuote): { label: string; tone: 'cheap' | 'normal' | 'pricey' } {
  const ratio = q.price / (q.base || 1)
  if (ratio <= 0.85) return { label: '便宜了', tone: 'cheap' }
  if (ratio >= 1.25) return { label: '好价', tone: 'pricey' }
  return { label: '正常价', tone: 'normal' }
}

/**
 * 卖出 count 个后的新市场状态。
 *
 * 卖出会「砸盘」：供给变多，价格向下走。
 * 这是最直接的市场教育：一次性全卖光，价格就下来了。
 */
export function applySell(state: MarketState, itemId: string, count: number): MarketState {
  if (count <= 0) return state
  const quotes = state.quotes.map((q) => {
    if (q.itemId !== itemId) return q
    const drop = 1 - SELL_IMPACT_PER_UNIT * count
    const next = clampPrice(q.base, q.price * drop)
    return { ...q, price: next, soldToday: q.soldToday + count }
  })

  // 同步更新当天 history 的收盘价
  const history = state.history.map((h) =>
    h.day === state.day ? { ...h, prices: { ...h.prices, [itemId]: quotes.find((q) => q.itemId === itemId)!.price } } : h,
  )

  const indexNow = round2(
    100 *
      (quotes.reduce((sum, q) => sum + q.price / (q.base || 1), 0) / Math.max(1, quotes.length)),
  )

  return { ...state, quotes, history, indexNow }
}

/** 卖出报价：返回本次能卖多少积分 */
export function sellQuote(state: MarketState, itemId: string, count: number): number {
  const q = state.quotes.find((x) => x.itemId === itemId)
  if (!q || count <= 0) return 0
  return Math.round(q.price * count)
}

/** 取走势图数据（最近 N 天） */
export function priceSeries(state: MarketState, itemId: string, days = 7): number[] {
  return state.history
    .slice(-days)
    .map((h) => h.prices[itemId] ?? 0)
    .filter((n) => n > 0)
}
