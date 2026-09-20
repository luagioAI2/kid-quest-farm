import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { capFor, CROPS, ITEM_BY_ID } from '@/domain/catalog'
import { farmLevel } from '@/domain/farm'
import { humanizeMinutes } from '@/domain/time'
import type { CropDef } from '@/domain/types'
import { BottomSheet, CoinPill } from './farmUi'

type Tab = 'seeds' | 'sell'

/**
 * 种子商店 / 收获物交易 底部弹层。
 *
 * 选完种子后由父级接管「选一块地」的流程：
 * 这里只把 cropId 抛出去，父级关闭弹层并高亮空地。
 *
 * 「卖东西」这一栏已经改为跳转去农场市场（MarketSheet）——
 * 那里的价格是每天浮动的，还能看到走势图，孩子能顺便学一点市场常识。
 * 这里只保留一个入口和一句提示，避免两套价格并存把孩子绕晕。
 */
export function SeedShop({
  open,
  onClose,
  onPickCrop,
  pickedCropId,
  onOpenMarket,
}: {
  open: boolean
  onClose: () => void
  /** 选定种子后回调，父级进入「点空地种下」状态 */
  onPickCrop: (cropId: string) => void
  /** 当前正在等待落地的种子（用于高亮） */
  pickedCropId: string | null
  /** 去农场市场（那里卖东西） */
  onOpenMarket: () => void
}) {
  const balance = useApp((s) => s.balance)
  const inventory = useApp((s) => s.inventory)
  const market = useApp((s) => s.market)
  const farmHarvests = useApp((s) => s.farmTotals.harvests)
  // ⚠️ 这里要的是**农场等级**，不是收获次数。
  // 2026-09-15 修：以前传的是 `farmHarvests`，于是 `unlockLevel(1) > 收获次数(0)`
  // 恒为真 —— **新农场 12 个种子全是锁的**，而没种子就种不了、种不了就永远没收获，
  // 农场开局即死锁（E2E 探针实测 12/12 按钮 disabled）。
  const farmLv = farmLevel(farmHarvests).level
  const [tab, setTab] = useState<Tab>('seeds')

  const seedCountOf = (cropId: string) =>
    inventory.find((i) => i.itemId === `seed-${cropId}`)?.count ?? 0

  /** itemId → 今天的价格 */
  const priceById = useMemo(
    () => new Map(market.quotes.map((q) => [q.itemId, q.price])),
    [market],
  )

  /** 背包里可卖的产出物（用市场今天的价格估值） */
  const sellable = useMemo(
    () =>
      inventory
        .filter((slot) => slot.count > 0 && priceById.has(slot.itemId))
        .map((slot) => ({
          slot,
          price: priceById.get(slot.itemId) ?? 0,
          def: ITEM_BY_ID.get(slot.itemId),
        })),
    [inventory, priceById],
  )

  const sellTotal = sellable.reduce((sum, r) => sum + Math.round(r.price * r.slot.count), 0)
  const produceUnits = sellable.reduce((sum, r) => sum + r.slot.count, 0)

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      emoji="🌱"
      title="种子商店"
      headerRight={<CoinPill amount={balance} />}
    >
      {/* --- 分栏 --- */}
      <div className="mb-3 flex gap-2 rounded-full border border-ink-900/10 bg-white p-1">
        <TabButton active={tab === 'seeds'} onClick={() => setTab('seeds')}>
          🌰 买种子
        </TabButton>
        <TabButton active={tab === 'sell'} onClick={() => setTab('sell')}>
          🌾 卖东西
          {produceUnits > 0 ? (
            <span className="tnum ml-1 rounded-full bg-berry-400 px-1.5 text-xs text-white">
              {produceUnits}
            </span>
          ) : null}
        </TabButton>
      </div>

      {tab === 'seeds' ? (
        <ul className="space-y-3 pb-4">
          {CROPS.map((crop) => (
            <SeedRow
              key={crop.id}
              crop={crop}
              held={seedCountOf(crop.id)}
              balance={balance}
              level={farmLv}
              selecting={pickedCropId === crop.id}
              onPick={() => onPickCrop(crop.id)}
            />
          ))}
        </ul>
      ) : (
        <div className="pb-4">
          <div className="surface border border-grass-300 bg-grass-50 p-4">
            <p className="font-display text-base font-extrabold text-ink-900">
              🏪 现在去市场卖啦
            </p>
            <p className="mt-1 text-sm font-bold leading-snug text-ink-500">
              价格每天都会变一点点，卖得多价格还会往下走。
              看看走势图再决定什么时候卖，能多赚不少哦。
            </p>
            {produceUnits > 0 && (
              <p className="mt-3 rounded-2xl bg-white/80 px-3 py-2 text-sm font-extrabold text-ink-700">
                🧺 你现在的产出大概值 <span className="tnum text-grass-600">{sellTotal}</span> 🪙
                <span className="ml-1 text-xs font-bold text-ink-500">（按今天的价格算）</span>
              </p>
            )}
            <button
              type="button"
              onClick={onOpenMarket}
              className="btn mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-grass-600/30 bg-gradient-to-b from-grass-300 to-grass-500 font-display text-lg font-extrabold text-white shadow-flat active:btn-press"
            >
              🏪 去市场看看价格
            </button>
          </div>

          {sellable.length > 0 && (
            <ul className="mt-4 space-y-2">
              <p className="px-1 text-xs font-extrabold text-ink-500">今天的报价</p>
              {sellable.map(({ slot, price, def }) => (
                <li key={slot.itemId} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2">
                  <span className="text-2xl">{def?.emoji ?? '📦'}</span>
                  <span className="min-w-0 flex-1 truncate font-bold text-ink-900">
                    {def?.name ?? slot.itemId}
                  </span>
                  <span className="tnum text-sm font-bold text-ink-500">{slot.count} 个</span>
                  <span className="tnum rounded-pill bg-sun-100 px-2 py-0.5 text-sm font-extrabold text-sun-700">
                    {Math.round(price)} 🪙
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'btn flex min-h-[44px] flex-1 items-center justify-center rounded-full text-[15px] active:btn-press',
        active
          ? 'bg-grass-400 text-white shadow-flat'
          : 'bg-transparent text-ink-500',
      )}
    >
      {children}
    </button>
  )
}

function SeedRow({
  crop,
  held,
  balance,
  level,
  selecting,
  onPick,
}: {
  crop: CropDef
  held: number
  balance: number
  /** 孩子的农场等级（= 收获次数），低于 unlockLevel 先锁着 */
  level: number
  selecting: boolean
  onPick: () => void
}) {
  const locked = (crop.unlockLevel ?? 0) > level
  const affordable = !locked && (held > 0 || balance >= crop.seedCost)
  const perennial = crop.kind === 'perennial'

  return (
    <li
      className={clsx(
        'surface overflow-hidden transition',
        (!affordable || locked) && 'opacity-60 grayscale',
        selecting && 'ring-4 ring-grass-400',
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-grass-50 text-4xl">
          {locked ? '🔒' : crop.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-lg font-extrabold text-ink-900">{crop.name}</p>
            {held > 0 ? (
              <span className="tnum rounded-full bg-grass-100 px-2 py-0.5 text-xs font-bold text-grass-700">
                有 {held} 颗
              </span>
            ) : null}
            {perennial ? (
              <span className="rounded-full bg-grape-100 px-2 py-0.5 text-[10px] font-bold text-grape-600">
                多年生 🌳
              </span>
            ) : crop.kind === 'flower' ? (
              <span className="rounded-full bg-berry-100 px-2 py-0.5 text-[10px] font-bold text-berry-500">
                花 🌸
              </span>
            ) : null}
          </div>

          {/* 四个阶段小预览 */}
          <div className="mt-1 flex items-center gap-0.5">
            {crop.stageEmojis.map((e, i) => (
              <span key={i} className="text-base leading-none">
                {e}
              </span>
            ))}
            <span className="ml-1 text-xs text-ink-500">⏱ {humanizeMinutes(crop.growMinutes)}</span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            {/* 种子价是积分 🪙，卖出收入是丰收币 🌾 —— 两个币种不能混用图标 */}
            <CoinPill amount={crop.seedCost} tone={affordable ? 'sun' : 'danger'} />
            <span className="tnum font-bold text-grass-600">→ 每次收 {crop.harvestPoints} 🌾</span>
            {perennial && crop.regrowMinutes ? (
              <span className="text-xs text-ink-500">
                之后每 {humanizeMinutes(crop.regrowMinutes)} 再收一次
              </span>
            ) : crop.regrowCount > 1 ? (
              <span className="text-xs text-ink-500">可收 {crop.regrowCount} 次</span>
            ) : null}
          </div>

          <p className="tnum mt-1 text-[11px] font-bold text-ink-500">
            {/* ⚠️ 单位是丰收币 🌾，不是积分 🪙 —— 卖产出结的是丰收币 */}
            {/* ⚠️ 走 `capFor`（满产 × 整数单价），不是 `roundCap(成本)` ——
                B1 之后闸门是整数，两个数在默认档下相等，家长调档后才有差别 */}
            这一轮最多能收回 {capFor(crop.produceItemId)} 🌾
          </p>
        </div>

        <button
          type="button"
          disabled={!affordable}
          onClick={onPick}
          className={clsx(
            'btn grid size-14 shrink-0 place-items-center rounded-2xl border text-2xl',
            affordable
              ? 'border-grass-600/30 bg-grass-400 text-white shadow-flat active:btn-press'
              : 'cursor-not-allowed border-ink-900/10 bg-ink-100 text-ink-300',
          )}
          aria-label={`选择${crop.name}种子`}
        >
          {locked ? '🔒' : held > 0 ? '🎒' : '选'}
        </button>
      </div>

      {locked ? (
        <p className="tnum border-t-2 border-ink-900/5 bg-ink-100/50 px-3 py-1.5 text-center text-xs font-bold text-ink-500">
          还差 {crop.unlockLevel! - level} 级农场就解锁啦 🌱
        </p>
      ) : !affordable ? (
        <p className="tnum border-t-2 border-ink-900/5 bg-ink-100/50 px-3 py-1.5 text-center text-xs font-bold text-ink-500">
          还差 {crop.seedCost - balance} 🪙，去完成任务赚积分吧
        </p>
      ) : null}
    </li>
  )
}
