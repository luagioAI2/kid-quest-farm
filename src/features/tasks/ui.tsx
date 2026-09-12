import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import type { TaskCategory, TaskCycle, QualityGrade } from '@/domain/types'
import type { SettleParams } from '@/domain/settlement'

/* ============================================================
   小任务农场 · 任务模块内部 UI 基元
   ------------------------------------------------------------
   只放这一层要复用的“卡通积木”：颜色身份、按钮、底部弹层、
   实时计时、全局结算参数派生。业务逻辑一律走 store / domain。
   ============================================================ */

/* ---------------- 分类身份 ---------------- */

export interface CatStyle {
  label: string
  emoji: string
  /** 实色（用于主按钮 / 进度条） */
  solid: string
  /** 浅色底（用于卡片 / 标签） */
  soft: string
  /** 深色文字 */
  ink: string
  border: string
  ring: string
}

export const CATEGORY: Record<TaskCategory, CatStyle> = {
  study: {
    label: '学习',
    emoji: '📚',
    solid: 'bg-sky-400',
    soft: 'bg-sky-100',
    ink: 'text-sky-500',
    border: 'border-sky-300',
    ring: 'ring-sky-300',
  },
  chore: {
    label: '家务',
    emoji: '🧹',
    solid: 'bg-tangerine-400',
    soft: 'bg-tangerine-100',
    ink: 'text-tangerine-500',
    border: 'border-tangerine-300',
    ring: 'ring-tangerine-300',
  },
  sport: {
    label: '运动',
    emoji: '⚽',
    solid: 'bg-grass-400',
    soft: 'bg-grass-100',
    ink: 'text-grass-600',
    border: 'border-grass-300',
    ring: 'ring-grass-300',
  },
  art: {
    label: '艺术',
    emoji: '🎨',
    solid: 'bg-berry-400',
    soft: 'bg-berry-100',
    ink: 'text-berry-500',
    border: 'border-berry-300',
    ring: 'ring-berry-300',
  },
  reading: {
    label: '阅读',
    emoji: '📖',
    solid: 'bg-grape-400',
    soft: 'bg-grape-100',
    ink: 'text-grape-500',
    border: 'border-grape-300',
    ring: 'ring-grape-300',
  },
  habit: {
    label: '习惯',
    emoji: '🌟',
    solid: 'bg-sun-400',
    soft: 'bg-sun-100',
    ink: 'text-sun-600',
    border: 'border-sun-300',
    ring: 'ring-sun-300',
  },
}

export const CATEGORY_ORDER: TaskCategory[] = [
  'study',
  'chore',
  'sport',
  'art',
  'reading',
  'habit',
]

export const QUALITY_META: Record<QualityGrade, { emoji: string; label: string }> = {
  poor: { emoji: '😞', label: '一般' },
  ok: { emoji: '🙂', label: '不错' },
  great: { emoji: '🤩', label: '特别棒' },
}

/* ---------------- 全局结算参数 ---------------- */

export interface GlobalSettle {
  overtimeEnabled: boolean
  qualityBonusThreshold: QualityGrade
  minRatioForPoints: number
}

/** 从 settings 派生 settle() 需要的全局参数，保证预览与真实结算同源 */
export function globalFrom(settings: {
  overtimeEnabled: boolean
  qualityBonusThreshold: QualityGrade
  minRatioForPoints: number
}): GlobalSettle {
  return {
    overtimeEnabled: settings.overtimeEnabled,
    qualityBonusThreshold: settings.qualityBonusThreshold,
    minRatioForPoints: settings.minRatioForPoints,
  }
}

export function settleGlobalOf(g: GlobalSettle): Pick<
  SettleParams,
  'overtimeEnabled' | 'qualityBonusThreshold' | 'minRatioForPoints'
> {
  return g
}

/* ---------------- 按钮 ---------------- */

type BtnSize = 'sm' | 'md' | 'lg' | 'hero'

/** 卡通 3D 按钮：有明显的“按下去”手感 */
export function Btn({
  children,
  onClick,
  tone = 'sun',
  size = 'md',
  disabled,
  full,
  className,
  type = 'button',
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  tone?: 'sun' | 'grass' | 'sky' | 'berry' | 'grape' | 'tangerine' | 'ink' | 'white'
  size?: BtnSize
  disabled?: boolean
  full?: boolean
  className?: string
  type?: 'button' | 'submit'
  ariaLabel?: string
}) {
  const tones: Record<string, string> = {
    sun: 'bg-sun-400 text-ink-900 border-sun-600 shadow-[0_4px_0_0_var(--color-sun-600)]',
    grass: 'bg-grass-400 text-white border-grass-600 shadow-[0_4px_0_0_var(--color-grass-600)]',
    sky: 'bg-sky-400 text-white border-sky-500 shadow-[0_4px_0_0_var(--color-sky-500)]',
    berry: 'bg-berry-400 text-white border-berry-500 shadow-[0_4px_0_0_var(--color-berry-500)]',
    grape: 'bg-grape-400 text-white border-grape-500 shadow-[0_4px_0_0_var(--color-grape-500)]',
    tangerine:
      'bg-tangerine-400 text-white border-tangerine-500 shadow-[0_4px_0_0_var(--color-tangerine-500)]',
    ink: 'bg-ink-700 text-white border-ink-900 shadow-[0_4px_0_0_var(--color-ink-900)]',
    white: 'bg-white text-ink-900 border-ink-100 shadow-[0_4px_0_0_var(--color-ink-100)]',
  }
  const sizes: Record<BtnSize, string> = {
    sm: 'min-h-[44px] px-3 text-sm',
    md: 'min-h-[52px] px-5 text-base',
    lg: 'min-h-[56px] px-6 text-lg',
    hero: 'min-h-[64px] px-7 text-xl',
  }
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'btn-3d active:btn-3d-press inline-flex items-center justify-center gap-1.5 border-2',
        tones[tone],
        sizes[size],
        full && 'w-full',
        disabled && 'pointer-events-none opacity-40 grayscale',
        className,
      )}
    >
      {children}
    </button>
  )
}

/* ---------------- 底部弹层 ---------------- */

export function Sheet({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  labelledBy?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
      <button
        aria-label="关闭"
        onClick={onClose}
        className="anim-fade-in absolute inset-0 bg-ink-900/40 backdrop-blur-[2px]"
      />
      <div className="anim-sheet-up pb-safe relative max-h-[92vh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-[2rem] border-t-[3px] border-ink-900/10 bg-paper">
        {children}
      </div>
    </div>
  )
}

/** 弹层顶部把手 + 标题 */
export function SheetHead({
  title,
  emoji,
  onClose,
  id,
  sub,
}: {
  title: string
  emoji?: string
  onClose: () => void
  id?: string
  sub?: string
}) {
  return (
    <div className="sticky top-0 z-10 bg-paper px-5 pb-3 pt-3">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-ink-300" />
      <div className="flex items-center gap-3">
        {emoji && <span className="text-3xl leading-none">{emoji}</span>}
        <div className="min-w-0 flex-1">
          <h2 id={id} className="font-display truncate text-xl font-extrabold text-ink-900">
            {title}
          </h2>
          {sub && <p className="truncate text-xs text-ink-500">{sub}</p>}
        </div>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="btn-3d active:btn-3d-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-ink-100 bg-white text-lg shadow-[0_3px_0_0_var(--color-ink-100)]"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/* ---------------- 实时计时 ---------------- */

/** 基于 startedAt 时间戳派生的实时秒数 —— 不把计数器当真相源，切页不丢 */
export function useLiveSeconds(startedAt?: number, active = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!startedAt || !active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [startedAt, active])
  if (!startedAt) return 0
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

/** 计时色态：绿=计划内，黄=已超时，红=超过一倍 */
export function timerTone(elapsedMin: number, planned: number) {
  if (planned <= 0) return 'grass' as const
  const r = elapsedMin / planned
  if (r <= 1) return 'grass' as const
  if (r < 2) return 'tangerine' as const
  return 'berry' as const
}

export const TONE_TEXT: Record<'grass' | 'tangerine' | 'berry', string> = {
  grass: 'text-grass-600',
  tangerine: 'text-tangerine-500',
  berry: 'text-berry-500',
}

export const TONE_BG: Record<'grass' | 'tangerine' | 'berry', string> = {
  grass: 'bg-grass-100 border-grass-300',
  tangerine: 'bg-tangerine-100 border-tangerine-300',
  berry: 'bg-berry-100 border-berry-300',
}

/* ---------------- 其它小组件 ---------------- */

export function Pips({ value, className }: { value: number; className?: string }) {
  const n = Math.max(0, Math.min(3, value))
  return (
    <span className={clsx('inline-flex gap-0.5', className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={clsx(
            'h-1.5 w-1.5 rounded-full',
            i < n ? 'bg-current' : 'bg-current opacity-25',
          )}
        />
      ))}
    </span>
  )
}

export function CycleBadge({ cycle, className }: { cycle: TaskCycle; className?: string }) {
  const map: Record<TaskCycle, string> = {
    once: '单次',
    daily: '每天',
    weekly: '本周',
    monthly: '本月',
    yearly: '今年',
  }
  return (
    <span
      className={clsx(
        'rounded-pill bg-ink-900/5 px-2 py-0.5 text-[11px] font-bold text-ink-700',
        className,
      )}
    >
      {map[cycle]}
    </span>
  )
}

export function EmptyHint({
  emoji,
  title,
  detail,
}: {
  emoji: string
  title: string
  detail?: string
}) {
  return (
    <div className="card-paper flex items-center gap-3 p-4">
      <span className="anim-float text-3xl">{emoji}</span>
      <div>
        <p className="font-display text-sm font-extrabold text-ink-900">{title}</p>
        {detail && <p className="text-xs text-ink-500">{detail}</p>}
      </div>
    </div>
  )
}

/* 奖励道具预览（读 catalog，无需额外依赖） */
export function RewardChips({ itemIds, max = 3 }: { itemIds: string[]; max?: number }) {
  if (!itemIds || itemIds.length === 0) return null
  const shown = itemIds.slice(0, max)
  const rest = itemIds.length - shown.length
  return (
    <span className="inline-flex items-center gap-1 text-base" title="完成后掉落">
      {shown.map((id) => (
        <RewardChip key={id} itemId={id} />
      ))}
      {rest > 0 && <span className="text-[11px] font-bold text-ink-500">+{rest}</span>}
    </span>
  )
}

function RewardChip({ itemId }: { itemId: string }) {
  return <span aria-hidden>{REWARD_EMOJI[itemId] ?? '🎁'}</span>
}

/** 与 catalog.ITEMS 对齐的轻量 emoji 索引，避免在渲染里反复建 Map */
export const REWARD_EMOJI: Record<string, string> = {
  'seed-carrot': '🌰',
  'seed-strawberry': '🌰',
  'seed-corn': '🌰',
  'seed-tomato': '🌰',
  'seed-pumpkin': '🌰',
  'seed-watermelon': '🌰',
  'seed-sunflower': '🌰',
  'seed-magic-bean': '✨',
  'baby-chicken': '🐤',
  'baby-duck': '🐥',
  'baby-sheep': '🐏',
  'baby-pig': '🐖',
  'baby-cow': '🐮',
  egg: '🥚',
  wool: '🧶',
  milk: '🥛',
  truffle: '🍄',
  feather: '🪶',
  fertilizer: '💩',
  'golden-coin': '🪙',
  'lucky-star': '⭐',
  sticker: '🌟',
  medal: '🏅',
  gem: '💎',
}
