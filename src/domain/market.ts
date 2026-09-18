import {
  DEFAULT_PROFIT_RATIO,
  MARKET_GOODS,
  PRICE_DAILY_SWING,
  PRICE_FLOOR,
  SELL_IMPACT_PER_UNIT,
  MARKET_HISTORY_DAYS,
  priceCeilingFor,
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
   * 价格硬上限 = **现价硬顶** `上限回收 ÷ 满产` = 单位成本 × (1 + r)，永不超过
   * 价格硬下限 base * PRICE_FLOOR（0.55），永不跌破（现状下够不到，纯兜底）

   ⚠️ 上限原来写的是 `base * PRICE_CEILING`（基准价的 1.6 倍）—— **方向是反的**。
   `base` 本身就等于「满产刚好卖光」那条线，再乘 1.6 等于把天花板抬到闸门上方 60%。
   2026-09-18 家长追问「收购价怎么会超过 60%」之后改成现在的口径：硬顶直接由
   `priceCeilingFor()` 从成本反推。这样 `满产 × 硬顶 = 上限回收` **恰好相等**，
   行情再好也能把这一轮收的全卖掉、一个不剩。
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

/**
 * 把价格夹进 `[基准价 × 下限, 现价硬顶]`。
 *
 * 硬顶按 `itemId` 从成本反推（`priceCeilingFor`），**不是**基准价的某个倍数 ——
 * 基准价已经等于「满产刚好卖光」那条线，再往上乘就是突破闸门。
 */
function clampPrice(
  itemId: string,
  base: number,
  price: number,
  r = DEFAULT_PROFIT_RATIO,
): number {
  const hi = priceCeilingFor(itemId, r)
  const lo = base * PRICE_FLOOR
  return round2(Math.min(hi, Math.max(lo, price)))
}

/**
 * 一条报价**实际成交**用的价。`priceOf` / `sellQuote` 都走它。
 *
 * ⚠️ 为什么读的时候还要再夹一次：写路径虽然都过了 `clampPrice`，
 * 但 `q.price` 还能从别处被改高 —— 测试直接 `setState` 把价钉到某个值，
 * 老存档里也可能留着旧口径（基准价 × 1.6）算出来的价。
 * 在读取处兜一次，「波动不超过硬顶」才是**绝对**的，不依赖写入路径守规矩。
 */
function effectivePrice(q: MarketQuote, r = DEFAULT_PROFIT_RATIO): number {
  return round2(Math.min(priceCeilingFor(q.itemId, r), q.price))
}

/**
 * 新建一条报价（第 0 天，价格等于基准价）。
 *
 * `r` 是家长设的市场盈利上限 —— **必须传真的那个**，不能靠默认值：
 * 硬顶 = 上限回收 ÷ 满产 是跟着 `r` 变的，用默认 0.6 算会在家长调档后
 * 和闸门对不上（调低 → 硬顶偏高 → 又开始剩货；调高 → 硬顶偏低 → 白少给钱）。
 */
export function createQuote(
  itemId: string,
  base: number,
  day = 0,
  r = DEFAULT_PROFIT_RATIO,
): MarketQuote {
  const price = clampPrice(itemId, base, base, r)
  return {
    itemId,
    base,
    price,
    prevPrice: price,
    day,
    soldToday: 0,
  }
}

export function createInitialMarket(
  basePrices: Record<string, number>,
  day = 0,
  r = DEFAULT_PROFIT_RATIO,
): MarketState {
  const quotes = MARKET_GOODS.filter((id) => basePrices[id] != null).map((id) =>
    createQuote(id, basePrices[id], day, r),
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
export function advanceMarket(
  state: MarketState,
  targetDay: number,
  r = DEFAULT_PROFIT_RATIO,
): MarketState {
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

      const next = clampPrice(q.itemId, base, drift + seasonal, r)
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

/** 取某个产出的现价（已夹过硬顶，可以直接给孩子看 / 直接拿去结算） */
export function priceOf(
  state: MarketState,
  itemId: string,
  r = DEFAULT_PROFIT_RATIO,
): number | undefined {
  const q = state.quotes.find((x) => x.itemId === itemId)
  return q ? effectivePrice(q, r) : undefined
}

/** 涨跌方向：用于给孩子看 ↑↓ */
export type TrendDir = 'up' | 'down' | 'flat'

export function trendOf(
  q: MarketQuote,
  r = DEFAULT_PROFIT_RATIO,
): { dir: TrendDir; pct: number } {
  // 用成交价（夹过硬顶）算涨跌 —— 和 `priceOf` 同一个口径。
  // 价格顶到硬顶时两边相等 → 自然显示「平」，正是「已经到最高价了」的意思。
  const now = effectivePrice(q, r)
  const prev = round2(Math.min(priceCeilingFor(q.itemId, r), q.prevPrice))
  const diff = now - prev
  if (Math.abs(diff) < 0.005) return { dir: 'flat', pct: 0 }
  return { dir: diff > 0 ? 'up' : 'down', pct: round2((diff / (prev || 1)) * 100) }
}

/**
 * 相对基准价的位置：便宜 / 正常 / 好价 —— 教孩子「等价格好的时候再卖」。
 *
 * ⚠️ 阈值 2026-09-18 重定。原来是 `≤0.85 便宜 / ≥1.25 好价`，
 * 那是按「现价能爬到基准价 1.6 倍」定的 —— 硬顶改成 `上限回收 ÷ 满产`
 * （≈ 基准价）之后，**`1.25` 那档永远够不到**，「好价」会变成一条死规则。
 *
 * 现在的实际区间是 `[0.72, ≈1.0] × 基准价`，所以「好价」改成「贴到硬顶」。
 * 注意：硬顶 ≈ 基准价，而价格分布是围绕基准价 ±28% 对称的，
 * 所以约一半的日子会夹在硬顶上、都显示「好价」。
 * 想让走势图更有起伏、少一点平顶，代价是平均到手下降 ——
 * 见 `docs/farm-economy-design.md` §6.1 那张「夹顶率 vs 到手」的表。
 */
export function valueHint(
  q: MarketQuote,
  r = DEFAULT_PROFIT_RATIO,
): { label: string; tone: 'cheap' | 'normal' | 'pricey' } {
  // 分母用**硬顶**而不是 `q.base` —— 硬顶跟着家长的 r 变，`q.base` 是静态表里
  // 按 r = 0.6 算出来的值。默认档下两者相等、行为不变；家长调档之后才有差别。
  const ceiling = priceCeilingFor(q.itemId, r)
  const denom = Number.isFinite(ceiling) && ceiling > 0 ? ceiling : q.base || 1
  const ratio = effectivePrice(q, r) / denom
  if (ratio <= 0.85) return { label: '便宜了', tone: 'cheap' }
  if (ratio >= 0.97) return { label: '好价', tone: 'pricey' }
  return { label: '正常价', tone: 'normal' }
}

/**
 * 卖出 count 个后的新市场状态。
 *
 * 卖出会「砸盘」：供给变多，价格向下走。
 * 这是最直接的市场教育：一次性全卖光，价格就下来了。
 */
export function applySell(
  state: MarketState,
  itemId: string,
  count: number,
  r = DEFAULT_PROFIT_RATIO,
): MarketState {
  if (count <= 0) return state
  const quotes = state.quotes.map((q) => {
    if (q.itemId !== itemId) return q
    const drop = 1 - SELL_IMPACT_PER_UNIT * count
    const next = clampPrice(q.itemId, q.base, q.price * drop, r)
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

/**
 * 卖出报价：返回本次能卖多少钱（**线性**：成交价 × 个数）。
 *
 * 成交价走 `effectivePrice` —— 和 `priceOf` 同一个口径，所以孩子看到的价
 * 就是结算用的价，不会出现「屏幕上写 1.28、实付按 0.80」。
 */
export function sellQuote(
  state: MarketState,
  itemId: string,
  count: number,
  r = DEFAULT_PROFIT_RATIO,
): number {
  const q = state.quotes.find((x) => x.itemId === itemId)
  if (!q || count <= 0) return 0
  return Math.round(effectivePrice(q, r) * count)
}

/** 取走势图数据（最近 N 天） */
export function priceSeries(state: MarketState, itemId: string, days = 7): number[] {
  return state.history
    .slice(-days)
    .map((h) => h.prices[itemId] ?? 0)
    .filter((n) => n > 0)
}
