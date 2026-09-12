import { useApp } from '@/store/useApp'
import { humanizeAgo } from '@/domain/time'
import { BottomSheet } from './farmUi'

/* ============================================================
   农场日志
   ------------------------------------------------------------
   家长需求：「植物种植，养小动物时，也会出现随机事件，影响收成，
   甚至颗粒无收，甚至死亡。」

   这些事件必须**被孩子看见**，否则他们学不到"务农有风险"。
   所以每次事件都会写一条日志，这里按时间倒序展示。
   ============================================================ */

const KIND_STYLE: Record<string, { label: string; tone: string }> = {
  weather_good: { label: '好天气', tone: 'bg-sun-100' },
  weather_bad: { label: '坏天气', tone: 'bg-sky-100' },
  pest: { label: '虫害', tone: 'bg-tangerine-100' },
  disease: { label: '病害', tone: 'bg-berry-100' },
  harvest_bumper: { label: '大丰收', tone: 'bg-grass-100' },
  harvest_poor: { label: '歉收', tone: 'bg-ink-100' },
  crop_died: { label: '枯死', tone: 'bg-ink-100' },
  animal_sick: { label: '生病', tone: 'bg-berry-100' },
  animal_recovered: { label: '康复', tone: 'bg-grass-100' },
  animal_died: { label: '离世', tone: 'bg-ink-100' },
  market_surge: { label: '行情涨', tone: 'bg-grass-100' },
  market_crash: { label: '行情跌', tone: 'bg-berry-100' },
  holiday_bonus: { label: '好日子', tone: 'bg-sun-100' },
}

export function FarmLog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const farmEvents = useApp((s) => s.farmEvents)

  return (
    <BottomSheet open={open} onClose={onClose} emoji="📖" title="农场日志">
      {farmEvents.length === 0 ? (
        <div className="card-cartoon mb-4 flex flex-col items-center gap-2 px-6 py-10 text-center">
          <span className="text-6xl anim-float">🌤️</span>
          <p className="font-display text-lg font-extrabold text-ink-900">农场一切正常</p>
          <p className="text-sm text-ink-500">
            种地养动物的时候，偶尔会遇到一些意外 ——
            好天气、虫子、生病……都会记在这里
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5 pb-4">
          {farmEvents.map((e) => {
            const style = KIND_STYLE[e.kind] ?? { label: '事件', tone: 'bg-ink-100' }
            return (
              <li key={e.id} className="card-cartoon flex items-start gap-3 p-3">
                <span
                  className={`grid size-11 shrink-0 place-items-center rounded-2xl text-xl ${style.tone}`}
                >
                  {e.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold text-ink-600">
                      {style.label}
                    </span>
                    <span className="text-[11px] text-ink-500">{humanizeAgo(e.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold leading-snug text-ink-800">{e.message}</p>
                  {e.multiplier != null && e.multiplier !== 1 ? (
                    <p className="mt-0.5 text-[11px] font-bold text-ink-500">
                      收成 × {e.multiplier}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <p className="px-2 pb-3 text-center text-[11px] leading-relaxed text-ink-500">
        💡 就像真的农民伯伯一样：有时候大丰收，有时候会遇到麻烦。
        这就是种地的乐趣和风险。
      </p>
    </BottomSheet>
  )
}
