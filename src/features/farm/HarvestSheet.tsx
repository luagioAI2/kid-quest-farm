import { useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { capFor, CROP_BY_ID, DEFAULT_PROFIT_RATIO, PRODUCE_BASE_PRICE } from '@/domain/catalog'
import { remainingCapFor } from '@/domain/economy'
import type { HarvestMode, Plot } from '@/domain/types'
import { BottomSheet } from './farmUi'

/* ============================================================
   收获二选一：当场卖掉 / 收进背包
   ------------------------------------------------------------
   用户 2026-09-15：「我希望是 可以直接卖出，也可以存储自己市场卖出。
   提供选择。」

   两条路**共用同一个闸门**（`domain/economy.ts`），所以这里不是
   「哪个更划算」的选择，而是**什么时候定价**的选择：

     当场卖 → 按今天的市价结算，落袋为安
     收背包 → 之后自己在市场卖，赌一个更好的价

   所以文案要讲清楚「现在卖值多少 / 还能卖多少」，
   而不是暗示哪边钱更多 —— 那是随机事件决定的，不是这个按钮决定的。
   ============================================================ */

export function HarvestSheet({ plot, onClose }: { plot: Plot | null; onClose: () => void }) {
  const plots = useApp((s) => s.plots)
  const animals = useApp((s) => s.animals)
  const harvest = useApp((s) => s.harvest)
  const profitRatio = useApp((s) => s.settings.profitRatio)
  const quotaCarry = useApp((s) => s.quotaCarry)
  const [busy, setBusy] = useState(false)

  // ⚠️ hooks 必须在所有提前 return 之前调用完（本文件顶部只有这三个）
  const def = plot?.crop ? CROP_BY_ID.get(plot.crop.cropId) : undefined
  if (!plot || !def || !plot.crop) return null

  const r = profitRatio ?? DEFAULT_PROFIT_RATIO
  // ⚠️ 走 `capFor(产出物)`，**不是** `roundCap(def.seedCost, r)`。
  // B1 之后闸门是「满产 × 整数单价」（整数），而 `roundCap` 是连续小数；
  // 拿后者显示会跟下面 `remaining`（`remainingCapFor` 走 `capFor`）对不上账。
  const cap = capFor(def.produceItemId, r)
  const earned = plot.crop.earnedSoFar ?? 0
  // 闸门是**按产出物**归集的（同一种作物的所有地共用一批额度），
  // 所以这里要问全局剩余（含已收掉地块结转过来的），而不是只看这一块地。
  const remaining = remainingCapFor(
    def.produceItemId,
    plots,
    animals,
    r,
    quotaCarry[def.produceItemId] ?? 0,
  )
  const canSell = remaining > 0

  /**
   * 丰收币显示口径 —— 跟商店、价格标签一致。
   *
   * 2026-09-19（B1）之后额度与到手**全是整数**，`toFixed(1)` 只是保险。
   * ⚠️ 别改成 `Math.round`：这条守的是「并排出现的三个数要凑得上账」
   * （还能卖 N / 已收回 M / 最多 C，必须 `N + M = C`）。小数额度时代
   * `round` 会把 `0.9` 显示成 `1`，三个数当场对不上（2026-09-15 界面走查发现）。
   * 现在虽然都是整数，但留着 `toFixed(1)` 意味着将来若重新引入小数额度，
   * 显示口径不用再改一次。
   */
  const fmt = (n: number) => Number(n.toFixed(1))

  const unitPrice = PRODUCE_BASE_PRICE[def.produceItemId] ?? 0
  const roughGain = Math.round((def.produceAmount ?? 1) * unitPrice)

  const pick = async (mode: HarvestMode) => {
    if (busy) return
    setBusy(true)
    await harvest(plot.index, mode)
    setBusy(false)
    onClose()
  }

  return (
    <BottomSheet open title={`收获${def.name}`} emoji={def.emoji} onClose={onClose}>
      <div className="pb-4">
        {/* 这一轮的额度 —— 把「闸门」讲给孩子听 */}
        <div className="rounded-2xl bg-grass-100/70 p-3">
          <p className="tnum font-display text-sm font-extrabold text-grass-700">
            这一轮还能卖 {fmt(remaining)} 🌾
          </p>
          <p className="mt-1 text-xs text-ink-500">
            这棵已经收回 {fmt(earned)} 🌾，最多能收回 {fmt(cap)} 🌾。
            卖满了就换点别的种 —— 种子随时都能再买。
          </p>
        </div>

        <div className="mt-3 grid gap-2.5">
          {/* ① 收进背包 */}
          <button
            type="button"
            disabled={busy}
            onClick={() => void pick('store')}
            className="btn flex items-center gap-3 rounded-2xl border border-ink-900/10 bg-white p-3.5 text-left shadow-flat active:btn-press disabled:opacity-60"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-2xl" aria-hidden>
              🧺
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-extrabold text-ink-900">
                收进背包
              </span>
              <span className="mt-0.5 block text-xs text-ink-500">
                先存着，等市场上价格好的时候自己卖
              </span>
            </span>
          </button>

          {/* ② 当场卖掉 */}
          <button
            type="button"
            disabled={busy || !canSell}
            onClick={() => void pick('sell')}
            className={clsx(
              'btn flex items-center gap-3 rounded-2xl border p-3.5 text-left shadow-flat active:btn-press',
              canSell
                ? 'border-sun-400/50 bg-gradient-to-b from-sun-100 to-sun-200'
                : 'border-ink-900/10 bg-ink-100',
              (busy || !canSell) && 'opacity-60',
            )}
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sun-200 text-2xl" aria-hidden>
              🌾
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-base font-extrabold text-ink-900">
                当场卖掉
              </span>
              <span className="mt-0.5 block text-xs text-ink-600">
                {canSell
                  ? `按今天的市价结算，大约 +${roughGain} 丰收币（看收成）`
                  : '这一轮已经卖满啦，先收进背包吧'}
              </span>
            </span>
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-ink-400">
          两条路共用同一个额度，先存起来也不能多卖钱
        </p>
      </div>
    </BottomSheet>
  )
}
