import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useApp, selectFarmLevel } from '@/store/useApp'
import { CROP_BY_ID, ITEM_BY_ID, produceUnitOf } from '@/domain/catalog'
import {
  cropDefOf,
  cropProgress,
  cropRemainingHarvests,
  cropRemainingMinutes,
  cropStageIndex,
  isCropAging,
  isCropMature,
} from '@/domain/farm'
import type { Plot } from '@/domain/types'
import { SeedShop } from './SeedShop'
import { AnimalHouse } from './AnimalHouse'
import { MarketSheet } from './MarketSheet'
import { HarvestSheet } from './HarvestSheet'
import { FarmLog } from './FarmLog'
import { GrowthBar, countdownText } from './farmUi'
import { useFarmTick } from './useFarmTick'
import './farm.css'

/* ============================================================
   农场主页面
   - 天空 / 草地都是纯 CSS 绘制
   - 12 块地 3 列 x 4 行（手机上 3 列，大屏 4 列）
   - 新增：市场入口、农场时钟、农场日志（随机事件记录）
   ============================================================ */

export default function FarmPage() {
  const plots = useApp((s) => s.plots)
  const animals = useApp((s) => s.animals)
  const farmEvents = useApp((s) => s.farmEvents)
  const farmClock = useApp((s) => s.settings.farmClock)
  // 用 useShallow 包装：selectFarmLevel 每次返回新对象，
  // 直接传给 zustand v5 会导致无限重渲染（React error #185）
  const level = useApp(useShallow((s) => selectFarmLevel(s)))
  const settleFlash = useApp((s) => s.settleFlash)
  const clearSettleFlash = useApp((s) => s.clearSettleFlash)
  const inventory = useApp((s) => s.inventory)
  const market = useApp((s) => s.market)

  const [shopOpen, setShopOpen] = useState(false)
  const [barnOpen, setBarnOpen] = useState(false)
  const [marketOpen, setMarketOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  /** 正在等待「点一块地种下」的种子 */
  const [pendingCropId, setPendingCropId] = useState<string | null>(null)
  /** 点开了哪块成熟的地 —— 让它在「当场卖 / 收背包」之间选一个 */
  const [harvestPlot, setHarvestPlot] = useState<Plot | null>(null)

  const now = useFarmTick(1000)
  const pendingCrop = pendingCropId ? CROP_BY_ID.get(pendingCropId) : undefined
  const emptyUnlocked = useMemo(
    () => plots.filter((p) => p.unlocked && !p.crop).length,
    [plots],
  )
  const unreadEvents = useMemo(() => {
    const dayAgo = Date.now() - 24 * 3600 * 1000
    return farmEvents.filter((e) => e.createdAt > dayAgo).length
  }, [farmEvents])

  /** 背包里能卖的产出总量 —— 用来给「市场」按钮加个红点提醒 */
  const sellableUnits = useMemo(() => {
    const sellable = new Set(market.quotes.map((q) => q.itemId))
    return inventory.reduce((sum, s) => (sellable.has(s.itemId) ? sum + s.count : sum), 0)
  }, [inventory, market])

  // 结算飘字自动消失
  useEffect(() => {
    if (!settleFlash) return
    const t = setTimeout(() => clearSettleFlash(), 1600)
    return () => clearTimeout(t)
  }, [settleFlash, clearSettleFlash])

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      {/* ------- 天空 ------- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-sky-300 via-sky-200 to-sun-100">
        <span className="absolute right-6 top-8 text-6xl anim-float" aria-hidden>
          ☀️
        </span>
        <Cloud className="left-[8%] top-12" delay="0s" />
        <Cloud className="left-[52%] top-24" delay="1.4s" />
        <Cloud className="left-[74%] top-4" delay="2.6s" />
      </div>

      {/* ------- 草地 ------- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 top-32 bg-grass-300" />
      {/* 远处的山丘：只在草地顶部露一个弧形，不侵入地块区域 */}
      <div className="pointer-events-none absolute inset-x-0 top-32 h-16 overflow-hidden">
        <div className="absolute -left-8 top-4 h-32 w-48 rounded-full bg-grass-200" />
        <div className="absolute left-1/4 top-0 h-32 w-56 rounded-full bg-grass-200/90" />
        <div className="absolute -right-10 top-5 h-32 w-52 rounded-full bg-grass-200" />
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-32 h-3 rounded-t-[3rem] bg-grass-200" />

      {/* ------- 内容 ------- */}
      <div className="relative z-10 flex flex-1 flex-col px-3 pt-safe">
        <TopBar
          level={level}
          animalCount={animals.length}
          timeScale={farmClock.timeScale}
          showClock={farmClock.showClock}
          unreadEvents={unreadEvents}
          onOpenLog={() => setLogOpen(true)}
        />

        {/* 播种引导条 */}
        {pendingCrop ? (
          <div className="anim-bounce-in mt-3 flex items-center gap-3 rounded-2xl border border-grass-600/25 bg-white/95 p-2.5 shadow-flat">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grass-100 text-2xl">
              {pendingCrop.emoji}
            </span>
            <p className="min-w-0 flex-1 font-display text-[15px] font-extrabold leading-tight text-ink-900">
              {emptyUnlocked > 0 ? (
                <>
                  点一块空地种下 <span className="text-grass-600">🌰{pendingCrop.name}</span>
                </>
              ) : (
                <>没有空地啦，先解锁一块吧 🔒</>
              )}
            </p>
            <button
              type="button"
              onClick={() => setPendingCropId(null)}
              className="btn shrink-0 rounded-2xl border border-ink-900/10 bg-ink-100 px-3 py-2 text-sm font-bold text-ink-700 active:btn-press"
            >
              取消
            </button>
          </div>
        ) : null}

        {/* 地块网格 */}
        <div className="mt-3 grid grid-cols-3 gap-2.5 lg:grid-cols-4">
          {plots.map((plot) => (
            <PlotTile
              key={plot.index}
              plot={plot}
              now={now}
              pendingCropId={pendingCropId}
              onPlanted={() => setPendingCropId(null)}
              onHarvestRequest={setHarvestPlot}
            />
          ))}
        </div>

        {/* 底部操作区 */}
        <div className="mt-auto pb-safe pt-6">
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => {
                setPendingCropId(null)
                setShopOpen(true)
              }}
              className="btn flex min-h-[60px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-grass-600/30 bg-gradient-to-b from-grass-300 to-grass-500 font-display text-base font-extrabold text-white shadow-flat active:btn-press"
            >
              <span className="text-xl" aria-hidden>
                🌱
              </span>
              种子
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingCropId(null)
                setBarnOpen(true)
              }}
              className="btn flex min-h-[60px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-grape-500/30 bg-gradient-to-b from-grape-300 to-grape-500 font-display text-base font-extrabold text-white shadow-flat active:btn-press"
            >
              <span className="text-xl" aria-hidden>
                🐾
              </span>
              动物
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingCropId(null)
                setMarketOpen(true)
              }}
              className="btn relative flex min-h-[60px] flex-[1.15] items-center justify-center gap-1.5 rounded-2xl border border-sun-600/40 bg-gradient-to-b from-sun-300 to-sun-500 font-display text-base font-extrabold text-ink-900 shadow-flat active:btn-press"
            >
              <span className="text-xl" aria-hidden>
                🏪
              </span>
              市场
              {/* 背包里有能卖的东西就提示一下，否则孩子不知道这里能换丰收币 */}
              {sellableUnits > 0 && (
                <span className="tnum anim-pop absolute -right-1.5 -top-1.5 grid min-w-[22px] place-items-center rounded-full border border-white bg-berry-500 px-1 text-[11px] font-extrabold text-white">
                  {sellableUnits}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ------- 飘字 ------- */}
      {settleFlash ? (
        <div className="pointer-events-none absolute inset-x-0 top-[34%] z-30 flex justify-center">
          <div className="anim-coin-rise flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 shadow-float">
            <span className="text-2xl">{settleFlash.emoji}</span>
            <span className="tnum font-display text-xl font-extrabold text-sun-600">
              {settleFlash.points > 0 ? `+${settleFlash.points} 🪙` : settleFlash.reason}
            </span>
          </div>
        </div>
      ) : null}

      <SeedShop
        open={shopOpen}
        onClose={() => setShopOpen(false)}
        pickedCropId={pendingCropId}
        onPickCrop={(cropId) => {
          setPendingCropId(cropId)
          setShopOpen(false)
        }}
        onOpenMarket={() => {
          setShopOpen(false)
          setMarketOpen(true)
        }}
      />
      <AnimalHouse open={barnOpen} onClose={() => setBarnOpen(false)} now={now} />
      <MarketSheet open={marketOpen} onClose={() => setMarketOpen(false)} />
      <FarmLog open={logOpen} onClose={() => setLogOpen(false)} />
      {/* 成熟的地块先问一句「当场卖还是收背包」，不替孩子做决定 */}
      <HarvestSheet plot={harvestPlot} onClose={() => setHarvestPlot(null)} />
    </div>
  )
}

/* ---------------- 顶栏 ---------------- */

/**
 * 农场时钟。
 *
 * 家长需求：「农场系统有时间流速的概念，这样方便跟现实知识挂钩。」
 *
 * 所以这里显示的是**农场世界的时间** —— 流速 2 时，
 * 现实过了 12 小时，农场就已经过了一整天。
 * 这让孩子可以理解"为什么萝卜几分钟就熟了"。
 */
function farmClockLabel(timeScale: number): { day: number; hhmm: string } {
  // 以「今天 0 点」为农场世界的起点，按流速换算
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const realMinutesToday = (Date.now() - start.getTime()) / 60000
  const farmMinutesToday = realMinutesToday * timeScale
  const day = Math.floor(farmMinutesToday / (60 * 24)) + 1
  const minutesInDay = farmMinutesToday % (60 * 24)
  const hh = String(Math.floor(minutesInDay / 60)).padStart(2, '0')
  const mm = String(Math.floor(minutesInDay % 60)).padStart(2, '0')
  return { day, hhmm: `${hh}:${mm}` }
}

function TopBar({
  level,
  animalCount,
  timeScale,
  showClock,
  unreadEvents,
  onOpenLog,
}: {
  level: { level: number; into: number; need: number }
  animalCount: number
  timeScale: number
  showClock: boolean
  unreadEvents: number
  onOpenLog: () => void
}) {
  const ratio = level.need > 0 ? level.into / level.need : 1
  const clock = farmClockLabel(timeScale)
  return (
    <div className="surface mt-2 p-2.5">
      {/*
        ⚠️ 这里**不再显示 🪙 / 🌾**。
        全局顶栏（`App.tsx` 的 `header`，`sticky top-0`）已经常驻显示这两个币种，
        农场卡再放一遍，就是**同一屏里同一件事出现两次**。
        本卡只留「农场自己的状态」：等级 / 进度、动物数、日志入口。

        历史：这里曾经 5 个块挤在 390px 里，gap-3 会把「1 级农场」挤到换行、
        整行 44px → 54px 把顶栏裁掉。块少了，但**别把 gap 调大**。
      */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap font-display text-sm font-extrabold text-grass-600">
              🏅 {level.level} 级农场
            </span>
            <span className="tnum shrink-0 text-xs text-ink-500">
              {level.into}/{level.need}
            </span>
          </div>
          <GrowthBar value={ratio} className="mt-1" />
        </div>

        <div className="flex shrink-0 flex-col items-center rounded-2xl bg-grape-100 px-2.5 py-1">
          <span className="text-lg leading-none">🐾</span>
          <span className="tnum text-xs font-bold text-grape-500">{animalCount}</span>
        </div>

        <button
          type="button"
          onClick={onOpenLog}
          className="btn relative grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-xl active:btn-press"
          aria-label="农场日志"
        >
          📖
          {unreadEvents > 0 && (
            <span className="tnum absolute -right-1 -top-1 grid min-w-[20px] place-items-center rounded-full border border-white bg-berry-500 px-0.5 text-[10px] font-extrabold text-white">
              {unreadEvents > 9 ? '9+' : unreadEvents}
            </span>
          )}
        </button>
      </div>

      {showClock && (
        <div className="mt-2 flex items-center gap-2 rounded-2xl bg-sky-100/70 px-2.5 py-1.5">
          <span className="text-base" aria-hidden>
            🌍
          </span>
          <span className="text-[11px] font-bold text-ink-600">
            农场第 <span className="tnum font-extrabold text-ink-900">{clock.day}</span> 天 ·{' '}
            <span className="tnum font-extrabold text-ink-900">{clock.hhmm}</span>
          </span>
          {timeScale !== 1 && (
            <span className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-bold text-ink-500">
              时间 x{timeScale}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ---------------- 单块地 ---------------- */

function PlotTile({
  plot,
  now,
  pendingCropId,
  onPlanted,
  onHarvestRequest,
}: {
  plot: Plot
  now: number
  /** 当前待播种的作物 id，非空且这块地是空地时高亮 */
  pendingCropId: string | null
  onPlanted: () => void
  /** 点了一块成熟的地 —— 交给父级弹「当场卖 / 收背包」 */
  onHarvestRequest: (plot: Plot) => void
}) {
  const plant = useApp((s) => s.plant)
  const unlockPlot = useApp((s) => s.unlockPlot)
  const water = useApp((s) => s.water)
  const pushToast = useApp((s) => s.pushToast)
  const balance = useApp((s) => s.balance)
  const timeScale = useApp((s) => s.settings.farmClock.timeScale)
  const [bump, setBump] = useState(false)

  const def = cropDefOf(plot)
  const withered = !!plot.crop?.diedAt
  const mature = isCropMature(plot, now, timeScale)
  const aging = isCropAging(plot, now, timeScale)
  const highlight = !!pendingCropId && plot.unlocked && !plot.crop
  const affordable = balance >= plot.unlockCost

  const tapBump = () => {
    setBump(true)
    setTimeout(() => setBump(false), 400)
  }

  // ---- 未解锁 ----
  if (!plot.unlocked) {
    return (
      <button
        type="button"
        onClick={() => {
          tapBump()
          void unlockPlot(plot.index)
        }}
        className={clsx(
          'btn flex aspect-square flex-col items-center justify-center gap-0.5 rounded-2xl border border-dashed shadow-flat active:btn-press',
          affordable
            ? 'border-sun-400 bg-sun-100'
            : 'border-ink-300 bg-white/60',
        )}
      >
        <span className={clsx('text-3xl', affordable ? '' : 'opacity-50')} aria-hidden>
          {affordable ? '🔓' : '🔒'}
        </span>
        <span
          className={clsx(
            'tnum rounded-full px-2 py-0.5 text-xs font-extrabold',
            affordable ? 'bg-sun-300 text-sun-700' : 'bg-ink-100 text-ink-500',
          )}
        >
          {plot.unlockCost} 🪙
        </span>
      </button>
    )
  }

  // ---- 空地（或枯死需要清理） ----
  if (!plot.crop || withered) {
    const clearWithered = () => {
      tapBump()
      if (withered) {
        // 清理枯死的茬子：把 crop 置空
        void (async () => {
          const { savePlots } = await import('@/db/db')
          const { plots } = useApp.getState()
          await savePlots(
            plots.map((p) => (p.index === plot.index ? { ...p, crop: undefined } : p)),
          )
          await useApp.getState().refresh()
          pushToast({ kind: 'info', title: '清理干净了，可以重新种', emoji: '🧹' })
        })()
        return
      }
      if (pendingCropId) {
        void plant(plot.index, pendingCropId).then((ok) => {
          if (ok) onPlanted()
        })
      } else {
        pushToast({ kind: 'info', title: '先去种子商店挑一颗种子吧', emoji: '🌱' })
      }
    }

    return (
      <button
        type="button"
        onClick={clearWithered}
        className={clsx(
          'btn relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border shadow-flat active:btn-press',
          withered
            ? 'border-ink-300 bg-ink-100'
            : 'bg-grass-100',
          !withered && highlight
            ? 'border-grass-500 ring-4 ring-grass-300'
            : !withered && 'border-dashed border-grass-500/50',
          bump && 'anim-pop',
        )}
      >
        {withered ? (
          <>
            <span className="text-3xl" aria-hidden>
              🥀
            </span>
            <span className="font-display text-[11px] font-extrabold text-ink-500">
              枯掉了·点我清理
            </span>
          </>
        ) : (
          <>
            {/* 翻好的土垄 */}
            <span className="absolute inset-x-3 top-3 h-1.5 rounded-full bg-grass-500/25" />
            <span className="absolute inset-x-2 top-7 h-1.5 rounded-full bg-grass-500/20" />
            <span className="absolute inset-x-4 top-11 h-1.5 rounded-full bg-grass-500/15" />
            <span className="relative text-3xl drop-shadow-sm" aria-hidden>
              {highlight ? '🌰' : '➕'}
            </span>
            <span
              className={clsx(
                'relative font-display text-[11px] font-extrabold',
                highlight ? 'text-grass-700' : 'text-grass-600',
              )}
            >
              {highlight ? '种这里' : '空地'}
            </span>
          </>
        )}
      </button>
    )
  }

  // ---- 有作物 ----
  const stage = cropStageIndex(plot, now, timeScale)
  const progress = cropProgress(plot, now, timeScale)
  const remain = cropRemainingMinutes(plot, now, timeScale)
  const leftHarvests = cropRemainingHarvests(plot)

  const onTap = () => {
    tapBump()
    // 成熟了不直接收 —— 先让孩子选「当场卖」还是「收背包」。
    // 默认不替他决定，这是用户明确要的「提供选择」。
    if (mature) onHarvestRequest(plot)
    else void water(plot.index)
  }

  return (
    <button
      type="button"
      onClick={onTap}
      className={clsx(
        'btn relative flex aspect-square flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border shadow-flat active:btn-press',
        mature
          ? 'border-sun-400/50 bg-gradient-to-b from-sun-100 to-sun-200'
          : 'border-ink-900/15 bg-gradient-to-b from-grass-100 to-grass-200',
        bump && 'anim-pop',
      )}
    >
      {mature ? (
        <span className="absolute right-1 top-1 anim-sparkle text-sm" aria-hidden>
          ✨
        </span>
      ) : null}
      {aging ? (
        <span className="absolute left-1 top-1 text-sm" aria-hidden title="这棵快老了">
          🍂
        </span>
      ) : null}

      <span
        className={clsx('text-4xl leading-none', mature ? 'anim-float' : 'anim-sway')}
        aria-hidden
      >
        {def?.stageEmojis[stage] ?? '🌱'}
      </span>

      {mature ? (
        <>
          <span className="font-display text-[11px] font-extrabold text-sun-700">可以收啦!</span>
          {/* ⚠️ 这里不能写 🪙 —— 收获**不发积分**，产出物进背包，
              钱要等卖出才结算（而且是 🌾 不是 🪙）。显示产出物才对。

              ⚠️ 也**不要写 `≈`**（2026-09-20 去掉的）。那个符号是从「积分时代」
              遗留下来的：最早的标签是 `≈{harvestPoints} 🪙`，而当时的收获积分
              是 `3.6` 这种**连续小数**，所以 `≈` 是诚实的。
              B1 整数化（§6.1.3）+ 甲 产量封顶（§6.1.2）之后，`produceAmount`
              是**整数 4**，且实际产量 `min(满产, round(...))` 也只在
              `0/2/3/4` 这几个整数上取值 —— 这里根本不存在「约等于」。
              `≈` 是数学符号，孩子看不懂，看起来就像个显示错误。
              歉收那几档（2/3 个）是**离散事件**，由收获时的 toast 负责讲
              （「虫灾！这次只收了 2 个」），不该由标签用 `≈` 提前打折扣。
              动物页 `AnimalHouse.tsx` 一直是 `{produceAmount} 个`，改完两边也一致了。
              2026-09-21：量词改成 `produceUnitOf(produceItemId)` —— 原来是硬编码
              「个」，于是牛奶写「4 个」、萝卜写「4 个」。见 §5.7。 */}
          <span className="tnum rounded-full bg-white/85 px-2 py-0.5 text-[11px] font-extrabold text-sun-700">
            {ITEM_BY_ID.get(def?.produceItemId ?? '')?.emoji ?? '🧺'} {def?.produceAmount ?? 1}{' '}
            {produceUnitOf(def?.produceItemId)}
          </span>
        </>
      ) : (
        <>
          <GrowthBar value={progress} className="mx-3 !h-1.5" />
          <span className="tnum text-[11px] font-bold text-ink-700">{countdownText(remain)}</span>
          {leftHarvests > 1 ? (
            <span className="tnum absolute left-1 top-1 rounded-full bg-white/80 px-1.5 text-[10px] font-bold text-grass-700">
              ×{leftHarvests}
            </span>
          ) : null}
        </>
      )}
    </button>
  )
}

/* ---------------- 云朵 ---------------- */

function Cloud({ className, delay }: { className: string; delay: string }) {
  return (
    <span
      className={clsx('kqf-cloud absolute flex items-end', className)}
      style={{ animationDelay: delay }}
      aria-hidden
    >
      <span className="block h-6 w-14 rounded-full bg-white/85 blur-[1px]" />
      <span className="-ml-4 block h-9 w-9 rounded-full bg-white/90 blur-[1px]" />
      <span className="-ml-3 block h-5 w-10 rounded-full bg-white/80 blur-[1px]" />
    </span>
  )
}
