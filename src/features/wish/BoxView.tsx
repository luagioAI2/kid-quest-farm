import { STOREFRONT } from '@/games/storefront'
import type { WishTint } from '@/domain/types'

/* ============================================================
   开盲盒的揭晓页
   ------------------------------------------------------------
   2026-10-29 从 `WishPage` 里搬出来。

   **为什么搬**：家长口径是「兑换 里的东西都是一样，都能用兑换券或者积分，
   包括游戏也一样。不需要去心愿商城换。心愿商城只是标明心愿的」——
   所以真正扣币的地方只剩「兑换」那一格，开箱也就发生在那里。

   ⚠️ 别把它再放回心愿页：心愿页现在只负责「看 + 许愿」，
      一个页面里既许愿又扣币，家长会分不清哪一步是花钱的。
   ============================================================ */

const TINT_BG: Record<WishTint, string> = {
  sun: 'bg-sun-100',
  grass: 'bg-grass-100',
  sky: 'bg-sky-100',
  grape: 'bg-grape-100',
  tan: 'bg-tangerine-100',
  berry: 'bg-berry-100',
}

export function BoxView({ gameId, onDone }: { gameId: string; onDone: () => void }) {
  const entry = STOREFRONT.find((s) => s.id === gameId)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-safe">
      <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-sun-100 text-7xl shadow-float">
        🎁
      </div>
      <p className="mt-3 font-display text-xs font-extrabold tracking-[0.3em] text-sun-500">
        ✦ ✦ ✦
      </p>
      <h2 className="mt-2 font-display text-2xl font-extrabold">抽到了新游戏</h2>
      <p className="mt-1 text-center text-sm font-bold leading-relaxed text-ink-600">
        这张盲盒里是这一款
        <br />
        已经放进你的游戏柜了
      </p>

      {entry && (
        <div className="mt-5 flex w-full items-center gap-3 rounded-3xl bg-white p-3 shadow-float">
          <span
            className={
              'flex h-14 w-14 flex-none items-center justify-center rounded-2xl text-2xl ' +
              TINT_BG[(entry.tint as WishTint) ?? 'sun']
            }
          >
            {entry.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-extrabold">{entry.name}</span>
            <span className="mt-0.5 block text-[11px] font-bold text-ink-500">
              {entry.pitch}
            </span>
          </span>
          <span className="rounded-full bg-berry-100 px-2 py-0.5 text-[10px] font-extrabold text-berry-500">
            NEW
          </span>
        </div>
      )}

      <button
        onClick={onDone}
        className="btn mt-6 h-12 w-full bg-grass-500 text-base font-extrabold text-white active:btn-press"
      >
        收下
      </button>
    </div>
  )
}
