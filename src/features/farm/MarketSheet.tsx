import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { ITEM_BY_ID } from '@/domain/catalog'
import { priceSeries, trendOf, valueHint } from '@/domain/market'
import { BottomSheet, CoinPill } from './farmUi'

/* ============================================================
   农场市场
   ------------------------------------------------------------
   家长需求：「农场新增市场出售，产出可以卖掉换积分。价格浮动，
   上限以下浮动，显示价格走向，主要是帮助孩子对市场了解。」

   所以这里不只是"卖东西"，而是一个小型的市场课堂：
   * 价格走势图（手写 div，不引入图表库）
   * 涨跌箭头 + 「便宜了 / 好价」标签 → 教低买高卖
   * 卖出会砸盘 → 教"分批出货"
   * 大盘指数 → 让孩子感受"整个市场"

   全程用 emoji + CSS，无外部依赖。
   ============================================================ */

export function MarketSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const market = useApp((s) => s.market)
  const inventory = useApp((s) => s.inventory)
  const balance = useApp((s) => s.balance)
  const sellProduce = useApp((s) => s.sellProduce)
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => {
    return market.quotes
      .map((q) => {
        const inv = inventory.find((i) => i.itemId === q.itemId)
        const item = ITEM_BY_ID.get(q.itemId)
        return {
          quote: q,
          count: inv?.count ?? 0,
          name: item?.name ?? q.itemId,
          emoji: item?.emoji ?? '📦',
        }
      })
      // 有货的排前面
      .sort((a, b) => b.count - a.count)
  }, [market.quotes, inventory])

  const indexDelta = (market.indexNow ?? 100) - (market.indexPrev ?? 100)
  const totalValue = rows.reduce((sum, r) => sum + r.count * r.quote.price, 0)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      emoji="🏪"
      title="农场市场"
      headerRight={<CoinPill amount={balance} />}
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
            分
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
        💡 小知识：卖得越多，价格会越便宜 —— 因为市场里的东西变多了。
        分几次卖，通常比一次全卖掉更划算哦。
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
  expanded,
  onToggle,
  onSell,
}: {
  itemId: string
  name: string
  emoji: string
  count: number
  expanded: boolean
  onToggle: () => void
  onSell: (n: number) => Promise<number>
}) {
  const market = useApp((s) => s.market)
  const quoteFor = useApp((s) => s.quoteFor)
  const [busy, setBusy] = useState(false)

  const q = market.quotes.find((x) => x.itemId === itemId)
  if (!q) return null

  const trend = trendOf(q)
  const hint = valueHint(q)
  const series = priceSeries(market, itemId, 7)
  const unit = q.price
  const total = quoteFor(itemId, count)
  const sellAll = quoteFor(itemId, count)

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
    <li className="surface overflow-hidden">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-sun-50 text-2xl">
          {emoji}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate font-display text-base font-extrabold text-ink-900">{name}</p>
            <span className="tnum shrink-0 text-xs text-ink-500">有 {count} 个</span>
          </div>

          <div className="mt-0.5 flex items-center gap-2">
            <span className="tnum font-display text-lg font-extrabold text-ink-900">
              {unit.toFixed(0)}
            </span>
            <span className="text-xs text-ink-500">分/个</span>
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

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={count <= 0 || busy}
              onClick={() => void doSell(1)}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-900 active:btn-press disabled:opacity-40"
            >
              卖 1 个 +{Math.round(unit)}
            </button>
            <button
              type="button"
              disabled={count < 5 || busy}
              onClick={() => void doSell(5)}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-900 active:btn-press disabled:opacity-40"
            >
              卖 5 个 +{Math.round(quoteFor(itemId, 5))}
            </button>
            <button
              type="button"
              disabled={count <= 0 || busy}
              onClick={() => void doSell(count)}
              className="btn min-h-[46px] flex-[1.4] rounded-2xl border border-sun-500/40 bg-gradient-to-b from-sun-300 to-sun-500 font-display font-extrabold text-ink-900 active:btn-press disabled:opacity-40"
            >
              全卖 {count} 个 +{Math.round(sellAll)}
            </button>
          </div>

          {count >= 5 && (
            <p className="mt-2 text-center text-[11px] text-ink-500">
              全卖会拿到 {Math.round(sellAll)} 分，和刚才比少了{' '}
              <span className="tnum font-bold text-berry-500">
                {Math.round(unit * count - total)}
              </span>{' '}
              分 —— 因为一次卖太多，价格被压下去了
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
