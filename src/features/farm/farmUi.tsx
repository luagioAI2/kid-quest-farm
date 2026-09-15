import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Portal } from '@/components/Portal'

/* ============================================================
   农场模块专用的小展示件
   仅做「外观」，不含业务逻辑。
   ============================================================ */

/** 剩余分钟 → 「还要 3 分钟」/「马上就好」 */
export function countdownText(minutes: number): string {
  if (minutes <= 0) return '马上就好'
  if (minutes < 1) return '再等一会儿'
  return `还要 ${Math.ceil(minutes)} 分钟`
}

/** 大号圆角进度条，带描边和一点高光 */
export function GrowthBar({
  value,
  className,
  tone = 'grass',
}: {
  value: number
  className?: string
  tone?: 'grass' | 'sun' | 'sky'
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100
  const fill =
    tone === 'sun'
      ? 'from-sun-300 to-sun-500'
      : tone === 'sky'
        ? 'from-sky-300 to-sky-500'
        : 'from-grass-300 to-grass-500'
  return (
    <div
      className={clsx(
        'h-2.5 w-full overflow-hidden rounded-full border border-ink-900/10 bg-ink-100/70',
        className,
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div
        className={clsx('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

/** 金币药丸：🪙 + 数字 */
export function CoinPill({
  amount,
  className,
  tone = 'sun',
  icon = '🪙',
}: {
  amount: number
  className?: string
  tone?: 'sun' | 'grass' | 'danger'
  /** 图标。积分是 🪙，丰收币是 🌾 —— 两个币种不能长得一样。 */
  icon?: string
}) {
  const skin =
    tone === 'grass'
      ? 'bg-grass-100 text-grass-700 border-grass-500/30'
      : tone === 'danger'
        ? 'bg-berry-100 text-berry-500 border-berry-400/40'
        : 'bg-sun-100 text-sun-700 border-sun-400/40'
  return (
    <span
      className={clsx(
        'tnum inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-display text-sm font-extrabold',
        skin,
        className,
      )}
    >
      <span aria-hidden>{icon}</span>
      {amount}
    </span>
  )
}

/** 底部弹层容器（背景遮罩 + 上滑卡片） */
export function BottomSheet({
  open,
  title,
  emoji,
  onClose,
  children,
  headerRight,
}: {
  open: boolean
  title: string
  emoji?: string
  onClose: () => void
  children: ReactNode
  headerRight?: ReactNode
}) {
  if (!open) return null
  // ⚠️ 必须 Portal 到 body，理由同 tasks/ui.tsx 的 Sheet：
  // 页面外壳的 anim-fade-in 是层叠上下文，弹层留在里面就压不过底部导航。
  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        <button
          type="button"
          aria-label="关闭"
          className="anim-fade-in absolute inset-0 bg-ink-900/35 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div className="anim-sheet-up relative flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl bg-paper shadow-float">
          {/* 抓手 */}
          <div className="flex justify-center pt-2.5">
            <span className="h-1.5 w-12 rounded-full bg-ink-300/70" />
          </div>

          <div className="flex items-center gap-3 px-5 pb-2 pt-2">
            {emoji ? (
              <span className="text-3xl" aria-hidden>
                {emoji}
              </span>
            ) : null}
            <h2 className="flex-1 font-display text-xl font-extrabold text-ink-900">{title}</h2>
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭"
              className="btn grid size-11 shrink-0 place-items-center rounded-full bg-white text-lg text-ink-700 shadow-flat active:btn-press"
            >
              ✕
            </button>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
            {children}
          </div>
        </div>
      </div>
    </Portal>
  )
}
