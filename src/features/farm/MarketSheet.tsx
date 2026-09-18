import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { DEFAULT_PROFIT_RATIO, ITEM_BY_ID } from '@/domain/catalog'
import { priceSeries, trendOf, valueHint } from '@/domain/market'
import { maxSellable, remainingCapFor } from '@/domain/economy'
import { BottomSheet, CoinPill } from './farmUi'

/* ============================================================
   农场市场
   ------------------------------------------------------------
   家长需求：「农场新增市场出售，产出可以卖掉换积分。价格浮动，
   上限以下浮动，显示价格走向，主要是帮助孩子对市场了解。」

   所以这里不只是"卖东西"，而是一个小型的市场课堂：
   * 价格走势图（手写 div，不引入图表库）
   * 涨跌箭头 + 「便宜了 / 好价」标签 → 教低买高卖
   * 卖出会砸盘 → 让孩子看到"货一多价就跌"
   * 大盘指数 → 让孩子感受"整个市场"

   全程用 emoji + CSS，无外部依赖。

   ⚠️ **两个坑，改之前先读：**

   ① **这一页结的是丰收币 🌾，不是积分 🪙。**
   卖出走 `sellProduce` → `postHarvest`，进的是 `harvestBalance`。
   所以顶部那颗币种胶囊必须是 `harvestBalance` + `tone="grass"` + 🌾。
   2026-09-16 修过一次：原来错传了 `balance`（积分），孩子卖完东西
   眼前那个数字**一动不动**，看起来就是"卖出坏了"。
   单位文案同理 —— 写 `🌾`，别写「分」（「分」在本项目专指积分 🪙）。

   ② **`sellQuote` 是「现价 × 个数」，线性的，不含卖压。**
   卖压只在 `applySell` 里体现，作用在**卖出之后**的行情上
   （所以同一批货当天再卖，单价才会变低）。
   曾经这里写过一行「全卖会拿到 X，和刚才比少了 N 分 —— 因为一次卖太多，
   价格被压下去了」，而 `N` 恒等于 0（`unit*count - total` 就是四舍五入的余数），
   自相矛盾地教了孩子一条假规则。**别再把它加回来。**
   要真做"分批更划算"，得先让 `sellQuote` 按 `SELL_IMPACT_PER_UNIT`
   对整笔卖出做衰减积分 —— 那是改经济数值，见 `docs/farm-economy-design.md` §6.4。

   ③ **闸门按丰收币计价，货却是整颗的 —— 按钮必须报「真能卖几个」。**
   家长 2026-09-18 报「小萝卜收进背包后不能全部卖掉」。不是小数 bug：
   小萝卜种子 2 分 → 一轮上限 `2 × 1.6 = 3.2` 丰收币；现价 0.9 时
   4 个值 `4 × 0.9 = 3.6 > 3.2`，于是只卖得动 3 个，剩下 1 个 + 0.2 额度卡住。
   **只要现价高于基准价（0.8），就必然有整颗卖不掉** —— 因为基准价是按
   「上限 ÷ 总产量」反推的，所以「基准价」恰好是「刚好卖得完」的那个价。

   所以三个按钮一律先过 `maxSellable`（与 `sellProduce` 同一个函数），
   按钮上写的就是结算结果；卖不光时补一句额度说明。
   **别再退回「全卖 count 个 + quoteFor(count)」** —— 那是按不限额度报价，
   承诺「+4」只给「+3」，和 09-16 那条假提示是同一类毛病。
   ============================================================ */

export function MarketSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const market = useApp((s) => s.market)
  const inventory = useApp((s) => s.inventory)
  // ⚠️ 丰收币，不是积分 —— 这一页卖出结的就是它，见文件头注释 ①
  const harvestBalance = useApp((s) => s.harvestBalance)
  const sellProduce = useApp((s) => s.sellProduce)
  const plots = useApp((s) => s.plots)
  const animals = useApp((s) => s.animals)
  const quotaCarry = useApp((s) => s.quotaCarry)
  const profitRatio = useApp((s) => s.settings.profitRatio)
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => {
    const r = profitRatio ?? DEFAULT_PROFIT_RATIO
    return (
      market.quotes
        .map((q) => {
          const inv = inventory.find((i) => i.itemId === q.itemId)
          const item = ITEM_BY_ID.get(q.itemId)
          return {
            quote: q,
            count: inv?.count ?? 0,
            name: item?.name ?? q.itemId,
            emoji: item?.emoji ?? '📦',
            // 这一轮还能卖多少丰收币。和 `sellProduce` 用的是同一个领域函数，
            // 所以按钮上算出来的「实际能卖几个」和结算时**必然一致**。
            remaining: remainingCapFor(q.itemId, plots, animals, r, quotaCarry[q.itemId] ?? 0),
          }
        })
        // 有货的排前面
        .sort((a, b) => b.count - a.count)
    )
  }, [market.quotes, inventory, plots, animals, profitRatio, quotaCarry])

  const indexDelta = (market.indexNow ?? 100) - (market.indexPrev ?? 100)
  const totalValue = rows.reduce((sum, r) => sum + r.count * r.quote.price, 0)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      emoji="🏪"
      title="农场市场"
      headerRight={<CoinPill amount={harvestBalance} tone="grass" icon="🌾" />}
    >
      {/* ---- 大盘情绪 ---- */}
      <div className="surface-paper mb-3 flex items-center gap-3 p-3">
        <span className="text-3xl">{indexDelta >= 0 ? '📈' : '📉'}</span>
        <div className="flex-1">
          <p className="font-display text-base font-extrabold text-ink-900">
            今天的行情 {indexDelta >= 0 ? '不错' : '一般'}
          </p>
          <p className="text-xs text-ink-500">
            {indexDelta >= 1
              ? '大部分东西都比昨天贵，适合卖！'
              : indexDelta <= -1
                ? '大部分东西比昨天便宜，可以再等等'
                : '和昨天差不多，正常卖就好'}
          </p>
        </div>
        <div className="text-right">
          <p className="tnum font-display text-lg font-extrabold text-ink-900">
            {Math.round(market.indexNow ?? 100)}
          </p>
          <p
            className={clsx(
              'tnum text-xs font-bold',
              indexDelta > 0 ? 'text-grass-600' : indexDelta < 0 ? 'text-berry-500' : 'text-ink-500',
            )}
          >
            {indexDelta > 0 ? '↑' : indexDelta < 0 ? '↓' : '–'}
            {Math.abs(Math.round(indexDelta))}
          </p>
        </div>
      </div>

      {totalValue > 0 && (
        <div className="mb-3 rounded-2xl border border-dashed border-sun-400/50 bg-sun-50 px-4 py-2 text-center">
          <p className="text-sm text-ink-700">
            背包里的产出大约值{' '}
            <span className="tnum font-display text-lg font-extrabold text-ink-900">
              {Math.round(totalValue)}
            </span>{' '}
            🌾
          </p>
        </div>
      )}

      {/* ---- 商品列表 ---- */}
      {rows.every((r) => r.count === 0) ? (
        <div className="surface flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="text-6xl anim-float">🧺</span>
          <p className="font-display text-lg font-extrabold text-ink-900">背包还是空的</p>
          <p className="text-sm text-ink-500">
            去种点东西、养几只小动物，有产出了就能拿来卖
          </p>
        </div>
      ) : (
        <ul className="space-y-3 pb-4">
          {rows.map((r) => (
            <MarketRow
              key={r.quote.itemId}
              itemId={r.quote.itemId}
              name={r.name}
              emoji={r.emoji}
              count={r.count}
              remaining={r.remaining}
              expanded={expanded === r.quote.itemId}
              onToggle={() =>
                setExpanded(expanded === r.quote.itemId ? null : r.quote.itemId)
              }
              onSell={(n) => sellProduce(r.quote.itemId, n)}
            />
          ))}
        </ul>
      )}

      <p className="px-2 pb-2 text-center text-[11px] leading-relaxed text-ink-500">
        💡 小知识：市场里的货一多，价格就会往下走一点 —— 今天卖掉的越多，
        今天的价钱就越低。想卖个好价钱，就挑「好价」的时候出手。
      </p>
    </BottomSheet>
  )
}

/* ---------------- 单行商品 ---------------- */

function MarketRow({
  itemId,
  name,
  emoji,
  count,
  remaining,
  expanded,
  onToggle,
  onSell,
}: {
  itemId: string
  name: string
  emoji: string
  count: number
  /** 这一轮还能卖多少丰收币（闸门余额） */
  remaining: number
  expanded: boolean
  onToggle: () => void
  onSell: (n: number) => Promise<number>
}) {
  const market = useApp((s) => s.market)
  const quoteFor = useApp((s) => s.quoteFor)
  const priceFor = useApp((s) => s.priceFor)
  const profitRatio = useApp((s) => s.settings.profitRatio)
  const [busy, setBusy] = useState(false)

  const q = market.quotes.find((x) => x.itemId === itemId)
  if (!q) return null

  // 硬顶跟着家长的 r 变，所以涨跌 / 便宜贵 的判断也要用真的 r
  const r = profitRatio ?? DEFAULT_PROFIT_RATIO
  const trend = trendOf(q, r)
  const hint = valueHint(q, r)
  const series = priceSeries(market, itemId, 7)
  // ⚠️ 单价要用 `priceFor`（夹过硬顶的**成交价**），不要直接读 `q.price` ——
  // 存下来的价可能是旧口径留下的、也可能被测试钉过，会和实付对不上。
  const unit = priceFor(itemId)

  /*
    ⚠️ **按钮上写的数字必须是真能拿到的。**
    ------------------------------------------------------------
    家长 2026-09-18 报：「买了萝卜种子，收成后收进背包，去市场卖不能全部卖掉」。

    查下来不是小数 bug，是**闸门按丰收币计价、而货是整颗的**：
      小萝卜 种子 2 分 → 一轮上限 `2 × (1+0.6) = 3.2` 丰收币
      基准价 0.8 / 个，但现价会浮动（0.44 ~ 1.28）
      现价 0.9 时，4 个值 `4 × 0.9 = 3.6 > 3.2` → 只卖得动 3 个
    剩下的 1 个 + 0.2 丰收币额度就卡在背包里了（额度不够买 1 个整颗）。

    原来这里写的是 `全卖 {count} 个 +{quoteFor(itemId, count)}` ——
    也就是**按「不限额度」报价**，于是按钮承诺「全卖 4 个 +4 🌾」，
    点下去只卖 3 个到手 3。和 09-16 修掉的那条假提示是同一类毛病：
    UI 承诺了引擎不会兑现的事。

    现在三个按钮一律走 `maxSellable`（和 `sellProduce` 内部同一个函数），
    按钮上显示的就是结算结果。
  */
  const plan = (want: number) => maxSellable(Math.min(want, count), remaining, (n) => quoteFor(itemId, n))
  const p1 = plan(1)
  const p5 = plan(5)
  const pAll = plan(count)
  /** 额度不够、卖不光 —— 这时候要跟孩子解释一句 */
  const clamped = pAll.count < count

  const doSell = async (n: number) => {
    if (n <= 0 || busy) return
    setBusy(true)
    try {
      await onSell(n)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={clsx('surface overflow-hidden', count > 0 && 'ring-2 ring-grass-400/50')}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-sun-50 text-2xl">
          {emoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {/* 有货的加个绿点做标记 —— 一屏里一眼扫出「哪些能卖」 */}
            {count > 0 && (
              <span className="size-2 shrink-0 self-center rounded-full bg-grass-500" aria-hidden />
            )}
            <p className="truncate font-display text-base font-extrabold text-ink-900">{name}</p>
            {/*
              数量标记。家长 2026-09-18 要求：「背包里有的条栏加个标记，
              >0 时数字加个颜色」—— 原来只有一个 `text-ink-500` 的灰字，
              和「没有」的行长得一样，孩子扫不出来哪些能卖。
              现在有货是绿底胶囊，没货是浅灰「没有」，对比一眼可辨。
            */}
            {count > 0 ? (
              <span className="tnum shrink-0 rounded-full bg-grass-200 px-2 py-0.5 text-xs font-extrabold text-grass-700">
                有 {count} 个
              </span>
            ) : (
              <span className="tnum shrink-0 text-xs text-ink-400">没有</span>
            )}
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <span className="tnum font-display text-lg font-extrabold text-ink-900">
              {unit.toFixed(0)}
            </span>
            <span className="text-xs text-ink-500">🌾/个</span>
            <span
              className={clsx(
                'tnum rounded-full px-1.5 text-[11px] font-bold',
                trend.dir === 'up'
                  ? 'bg-grass-200 text-grass-700'
                  : trend.dir === 'down'
                    ? 'bg-berry-200 text-berry-600'
                    : 'bg-ink-100 text-ink-500',
              )}
            >
              {trend.dir === 'up' ? '↑' : trend.dir === 'down' ? '↓' : '–'}
              {Math.abs(trend.pct).toFixed(0)}%
            </span>
            <span
              className={clsx(
                'rounded-full px-1.5 text-[11px] font-bold',
                hint.tone === 'pricey'
                  ? 'bg-sun-300 text-ink-900'
                  : hint.tone === 'cheap'
                    ? 'bg-sky-200 text-ink-700'
                    : 'bg-ink-100 text-ink-500',
              )}
            >
              {hint.label}
            </span>
          </div>
        </div>

        <span className="shrink-0 text-ink-300">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t-2 border-ink-900/5 bg-paper-2/60 p-3">
          {/* ---- 走势图 ---- */}
          <PriceChart series={series} base={q.base} ceiling={q.base * 1.6} floor={q.base * 0.55} />

          {/*
            三个卖出按钮排成两行（上两个、全卖独占一行）。
            ⚠️ **别改回「三个挤一行」。** 390px 视口下每个只剩 94px，
            而「卖 1 个 +2 🌾」这种带币种单位的标签要 ~97px ——
            结果 🌾 会被挤到第二行，按钮变成两行高，看着像坏了。
            贵一点的货（魔法豆 50 🌾/个）连原来的「卖 5 个 +250」都塞不下。
            两行之后每个按钮宽 ~163px / 334px（实测），三、四位数也放得下，
            顺便把点击目标放大了一倍 —— 给孩子点的东西本来就不该这么窄。
          */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={p1.count < 1 || busy}
              onClick={() => void doSell(1)}
              className="btn min-h-[46px] rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-900 active:btn-press disabled:opacity-40"
            >
              卖 1 个 +{p1.total} 🌾
            </button>
            <button
              type="button"
              disabled={p5.count < 5 || busy}
              onClick={() => void doSell(5)}
              className="btn min-h-[46px] rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-900 active:btn-press disabled:opacity-40"
            >
              {/* 额度卖不动 5 个时**不写价格** —— 灰按钮上挂个拿不到的价就是撒谎 */}
              {p5.count < 5 ? '卖 5 个' : `卖 5 个 +${p5.total} 🌾`}
            </button>
            <button
              type="button"
              disabled={pAll.count < 1 || busy}
              onClick={() => void doSell(pAll.count)}
              className="btn col-span-2 min-h-[46px] rounded-2xl border border-sun-500/40 bg-gradient-to-b from-sun-300 to-sun-500 font-display font-extrabold text-ink-900 active:btn-press disabled:opacity-40"
            >
              全卖 {pAll.count} 个 +{pAll.total} 🌾
            </button>
          </div>

          {/* 额度卡住了就说清楚 —— 否则孩子看到「背包 4 个、全卖只卖 3 个」只会困惑 */}
          {clamped && (
            <p className="mt-2 rounded-xl bg-sun-50 px-3 py-2 text-[11px] font-bold leading-relaxed text-ink-700">
              这一轮还能卖 {Number(remaining.toFixed(1))} 🌾，只够卖 {pAll.count} 个。
              剩下 {count - pAll.count} 个先留着 —— 换点别的种、或者等这一轮的额度涨上来再卖。
            </p>
          )}
        </div>
      )}
    </li>
  )
}

/* ---------------- 价格走势图（纯 CSS/div） ---------------- */

function PriceChart({
  series,
  base,
  ceiling,
  floor,
}: {
  series: number[]
  base: number
  ceiling: number
  floor: number
}) {
  if (series.length < 2) {
    return (
      <div className="grid h-24 place-items-center rounded-2xl border border-dashed border-ink-900/10 text-xs text-ink-500">
        明天开始就能看到价格走势啦
      </div>
    )
  }

  const max = Math.max(...series, ceiling)
  const min = Math.min(...series, floor)
  const span = Math.max(1, max - min)

  const H = 88 // 图表高度（px）

  const yOf = (v: number) => H - ((v - min) / span) * H

  // 用 SVG polyline 画折线（比 div 更适合画线，但依然零依赖）
  const W = 100
  const points = series
    .map((v, i) => {
      const x = series.length === 1 ? 50 : (i / (series.length - 1)) * W
      return `${x},${yOf(v)}`
    })
    .join(' ')

  const last = series[series.length - 1]
  const prev = series[series.length - 2] ?? last
  const rising = last >= prev

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] font-bold text-ink-500">最近 {series.length} 天价格</span>
        <span className="text-[11px] text-ink-500">上限 {ceiling.toFixed(0)} / 下限 {floor.toFixed(0)}</span>
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-ink-900/10 bg-white">
        {/* 上限线 */}
        <div
          className="absolute inset-x-0 border-t-2 border-dashed border-berry-300"
          style={{ top: `${yOf(ceiling)}px` }}
        >
          <span className="absolute right-1 -top-4 text-[9px] font-bold text-berry-400">上限</span>
        </div>
        {/* 基准线 */}
        <div
          className="absolute inset-x-0 border-t-2 border-dotted border-ink-300"
          style={{ top: `${yOf(base)}px` }}
        />

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="relative block h-[88px] w-full"
        >
          {/* 折线 */}
          <polyline
            points={points}
            fill="none"
            stroke={rising ? '#5ba85b' : '#e05a72'}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* 面积填充 */}
          <polygon
            points={`0,${H} ${points} ${W},${H}`}
            fill={rising ? 'rgba(91,168,91,0.14)' : 'rgba(224,90,114,0.14)'}
          />
        </svg>

        {/* 数据点圆点 = 每天一个 */}
        <div className="absolute inset-x-0 bottom-0 flex h-[88px] items-end justify-between px-1 pb-1">
          {series.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
              <span
                className={clsx(
                  'size-1.5 rounded-full',
                  v >= prev ? 'bg-grass-500' : 'bg-berry-400',
                )}
              />
              <span className="tnum text-[9px] leading-none text-ink-500">{v.toFixed(0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
