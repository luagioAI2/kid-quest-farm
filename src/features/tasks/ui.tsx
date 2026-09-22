import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import clsx from 'clsx'
import { Portal } from '@/components/Portal'
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

/**
 * 兜底分类样式：**分类认不出来时用它，绝不返回 `undefined`**。
 *
 * 为什么必须有：`Task.category` 在**类型**上是联合类型，运行时却不是 ——
 * 导入备份（`importBackup` 只校验结构，不逐个校验任务的 category）、
 * 或者更老版本留下的数据，都可能带着一个现在已经不存在的分类。
 * 那时 `CATEGORY[unknown]` 是 `undefined`，紧接着的 `cat.solid` 直接抛
 * TypeError → ErrorBoundary 把**整个任务页**换成崩溃页。
 * 一个字段不认识，代价是整页打不开。
 *
 * 2026-09-15：`ReviewSheet` 里已经有人手写过 `cat ? … : …` 兜底，
 * 说明这个坑踩过。这里把它收成统一入口，别处不用再各写各的。
 *
 * ⚠️ 颜色只用 `theme.css` 里真实存在的档位：`ink` 只有
 * 100/200/300/500/600/700/900，**没有 400**（写 `bg-ink-400` 会被静默丢弃、
 * 一个字节 CSS 都不生成）。
 */
export const FALLBACK_CATEGORY: CatStyle = {
  label: '其他',
  emoji: '📌',
  solid: 'bg-ink-500',
  soft: 'bg-ink-100',
  ink: 'text-ink-600',
  border: 'border-ink-300',
  ring: 'ring-ink-300',
}

/**
 * 取分类样式。**渲染一律走这里，不要直接写 `CATEGORY[x]`。**
 *
 * 参数故意收宽到 `string`：调用方拿到的可能是从 IndexedDB / 备份里读出来的
 * 任意字符串，类型系统在这里帮不上忙，必须自己兜。
 *
 * ⚠️ 用 `Map` 而不是 `CATEGORY[x] ?? 兜底`。
 * 普通对象**会从原型链上取值**：`CATEGORY['constructor']` 拿到的是 `Object`
 * 构造函数、`CATEGORY['__proto__']` 拿到的是原型对象 ——
 * 两者都**不是 undefined**，于是 `?? 兜底` 不会触发，
 * 结果 `cat.label` / `cat.emoji` 全是 undefined，渲染出一片空白。
 * `Map` 没有原型链可查，脏字符串一律干净地 miss。
 * （2026-09-15 由 `ui.test.ts` 里那组「骗过朴素实现」的输入当场抓出来的。）
 */
const CATEGORY_BY_KEY = new Map<string, CatStyle>(Object.entries(CATEGORY))

export function categoryOf(category: TaskCategory | string): CatStyle {
  return CATEGORY_BY_KEY.get(category) ?? FALLBACK_CATEGORY
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
    sun: 'bg-sun-400 text-ink-900 border-sun-600',
    grass: 'bg-grass-400 text-white border-grass-600',
    sky: 'bg-sky-400 text-white border-sky-500',
    berry: 'bg-berry-400 text-white border-berry-500',
    grape: 'bg-grape-400 text-white border-grape-500',
    tangerine:
      'bg-tangerine-400 text-white border-tangerine-500',
    ink: 'bg-ink-700 text-white border-ink-900',
    white: 'bg-white text-ink-900 border-ink-100',
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
        'btn active:btn-press inline-flex items-center justify-center gap-1.5 border',
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
  // ⚠️ 必须 Portal 到 body。App 外壳的 <main className="anim-fade-in">
  // 因为 opacity 动画成了层叠上下文，弹层被关在里面就永远压不过底部导航
  // —— 底部按钮会被导航整个盖掉，孩子点不到。详见 components/Portal.tsx。
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <button
          aria-label="关闭"
          onClick={onClose}
          className="anim-fade-in absolute inset-0 bg-ink-900/35 backdrop-blur-[2px]"
        />
        <div className="anim-sheet-up pb-safe relative max-h-[92vh] w-full max-w-[430px] overflow-y-auto overscroll-contain rounded-t-2xl bg-paper shadow-float">
          {children}
        </div>
      </div>
    </Portal>
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
          className="btn active:btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink-100 bg-white text-lg"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

/* ---------------- 计时器开关 ---------------- */

/**
 * 实时计时器 —— **开着**。
 *
 * ⚠️ 这里一度被改成 `false`，是**断错了句**。用户原话：
 *   「没用计时器，直接填时间 暂时可以隐藏。UI 记得调整 比如开始按钮。」
 * 正确的读法是「**『没用计时器，直接填时间』暂时可以隐藏**」——
 * 要藏的是「▶️ 开始」**右边那个旁路按钮**，不是整个计时器。
 * 上一版把整块计时器藏了，「▶️ 开始」跟着一起消失，
 * 于是用户第二天来问「为啥任务没有开始按钮了，直接就是做完了」。
 *
 * 现在两个开关各管一件事：
 *   · `TIMER_ENABLED`        —— 计时器本身。任务卡有「▶️ 开始」，
 *                               详情页有走动的秒表、`startedAt` 是真相源。
 *   · `MANUAL_FILL_ENABLED`  —— 右边那个旁路按钮，见下。
 *
 * 类型写成 `boolean`（不是 `= false` 这样的字面量）：否则 TS 会把
 * `TIMER_ENABLED ? A : B` 收窄成只剩一支，另一支里的变量会被报成未使用。
 */
export const TIMER_ENABLED: boolean = true

/**
 * 「▶️ 开始」右边那个旁路按钮：「没用计时器 · 直接填时间」。
 *
 * 2026-09-21 用户要求暂时隐藏它。用开关而不是删代码，因为说的是「**暂时**」。
 *
 * ⚠️ **藏它有一个必须一起处理的后果。** 待完成任务的卡片原来有两条路
 * （开始计时 / 直接填时间），藏掉一条之后只剩「▶️ 开始」—— 这没问题。
 * 但 `rejected`（家长打回、让孩子重做）的卡片**原本只有这一个按钮**
 * 能打开提交弹层：`startTimer()` 对非 `pending` 的实例是**直接 return** 的
 * （见 store/useApp.ts），所以那张卡上的「▶️ 开始」本来就是个点了没反应的
 * 死按钮。只藏不补，重做任务就永远交不上去。补法见 TaskPage 的 `rejected` 分支。
 */
export const MANUAL_FILL_ENABLED: boolean = false

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
    <div className="surface-paper flex items-center gap-3 p-4">
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
