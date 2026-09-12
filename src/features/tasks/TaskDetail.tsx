import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { previewPoints } from '@/domain/settlement'
import { humanizeMinutes, formatClock } from '@/domain/time'
import type { QualityGrade, TaskInstance } from '@/domain/types'
import { useApp } from '@/store/useApp'
import {
  Btn,
  CATEGORY,
  RewardChips,
  Sheet,
  SheetHead,
  TONE_BG,
  TONE_TEXT,
  globalFrom,
  timerTone,
  useLiveSeconds,
} from './ui'

/* ============================================================
   提交 / 结算弹层
   ------------------------------------------------------------
   全 App 最重要的一次交互：孩子在**按下完成之前**就要看懂
   “我能拿多少分、为什么”。所有数字都由 previewPoints 计算，
   绝不手写，保证与真实结算零漂移。
   ============================================================ */

export function TaskDetail({
  instance,
  onClose,
}: {
  instance: TaskInstance | null
  onClose: () => void
}) {
  const settings = useApp((s) => s.settings)
  const submitInstance = useApp((s) => s.submitInstance)
  const giveUpInstance = useApp((s) => s.giveUpInstance)

  const [minutes, setMinutes] = useState(0)
  const [quality, setQuality] = useState<QualityGrade | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ points: number; reason: string } | null>(null)
  const [confirmGiveUp, setConfirmGiveUp] = useState(false)

  const inst = instance
  const running = !!inst?.startedAt
  // 计时是真相源：秒数由 startedAt 派生，切页不丢
  const liveSeconds = useLiveSeconds(inst?.startedAt, running && !result)
  const liveMinutes = liveSeconds / 60

  // 打开新实例时重置本地状态
  useEffect(() => {
    if (!inst) return
    setResult(null)
    setBusy(false)
    setConfirmGiveUp(false)
    setQuality(inst.qualityRated ? undefined : undefined)
    setMinutes(inst.actualMinutes ?? 0)
  }, [inst?.id])

  // 没在计时 → 用输入值；在计时 → 用实时值（孩子可手动改）
  const effectiveMinutes = running && !result ? liveMinutes : minutes

  const global = useMemo(() => globalFrom(settings), [settings])
  const result0 = inst
    ? previewPoints(inst, effectiveMinutes, quality ?? (inst.qualityRated ? undefined : 'ok'), global)
    : null

  if (!inst) return null

  const cat = CATEGORY[inst.category]
  const elapsedMin = effectiveMinutes
  const tone = timerTone(elapsedMin, inst.plannedMinutes)
  const pct = inst.plannedMinutes > 0 ? Math.min(200, (elapsedMin / inst.plannedMinutes) * 100) : 0
  const overRatio = inst.plannedMinutes > 0 ? elapsedMin / inst.plannedMinutes : 0

  const preview = result0

  async function handleSubmit() {
    if (busy || !inst) return
    setBusy(true)
    // 关键变化：孩子端**不再自评质量**。
    // 提交只是把任务送到「等爸爸妈妈看」，质量分由家长在审核时给。
    // 这样孩子就没法自己给自己加分了。
    const mins = Math.max(0, Math.round(effectiveMinutes * 10) / 10)
    const earned = await submitInstance(inst.id, mins, undefined, {
      backfilled: inst.status === 'expired',
    })
    setResult({ points: earned, reason: preview?.reason ?? '' })
    setBusy(false)
  }

  async function handleGiveUp() {
    if (busy || !inst) return
    setBusy(true)
    await giveUpInstance(inst.id)
    setBusy(false)
    onClose()
  }

  return (
    <Sheet open={!!inst} onClose={onClose} labelledBy="task-detail-title">
      <SheetHead
        id="task-detail-title"
        title={inst.title}
        emoji={cat.emoji}
        sub={`${cat.label} · 计划 ${humanizeMinutes(inst.plannedMinutes)}`}
        onClose={onClose}
      />

      <div className="px-5 pb-8">
        {/* ---------- 完成后的庆祝 ---------- */}
        {result ? (
          settings.parentReviewEnabled ? (
            <SubmittedPanel
              points={result.points}
              reason={result.reason}
              emoji={cat.emoji}
              onDone={onClose}
            />
          ) : (
            <Celebration
              points={result.points}
              reason={result.reason}
              emoji={result.points > 0 ? '🎉' : '💪'}
              onDone={onClose}
            />
          )
        ) : (
          <>
            {/* ---------- 计时 / 用时 ---------- */}
            <div className={clsx('card-cartoon anim-bounce-in border-[3px] p-4', TONE_BG[tone])}>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs font-bold text-ink-500">
                    {running ? '正在计时中…' : '实际用了多少分钟？'}
                  </p>
                  <p className={clsx('tnum font-display text-4xl font-extrabold', TONE_TEXT[tone])}>
                    {running && !result
                      ? formatClock(liveSeconds)
                      : `${Math.round(minutes)} 分钟`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-ink-500">计划</p>
                  <p className="tnum font-display text-lg font-extrabold text-ink-700">
                    {inst.plannedMinutes} 分
                  </p>
                </div>
              </div>

              {/* 进度条：计划内 / 超时 / 超一倍 */}
              {!running && (
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full border-2 border-white/70 bg-white/60">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      tone === 'grass'
                        ? 'bg-grass-400'
                        : tone === 'tangerine'
                          ? 'bg-tangerine-400'
                          : 'bg-berry-400',
                    )}
                    style={{ width: `${Math.min(100, pct / 2)}%` }}
                  />
                </div>
              )}
              {running && (
                <div className="mt-3 h-3 w-full overflow-hidden rounded-full border-2 border-white/70 bg-white/60">
                  <div
                    className={clsx(
                      'h-full rounded-full transition-all',
                      tone === 'grass'
                        ? 'bg-grass-400'
                        : tone === 'tangerine'
                          ? 'bg-tangerine-400'
                          : 'bg-berry-400',
                    )}
                    style={{ width: `${Math.min(100, pct / 2)}%` }}
                  />
                </div>
              )}

              <p className="mt-2 text-xs font-bold text-ink-700">
                {overRatio <= 1
                  ? `✅ 在计划时间内，可拿全部积分`
                  : overRatio < 2
                    ? `⏰ 超出计划 ${Math.round((overRatio - 1) * 100)}%，积分会按比例变少`
                    : `😅 已经超过一倍时间了，看看下面还能拿多少分`}
              </p>

              {/* 手动用时：大号 +/- 步进器，忘记计时也能补 */}
              {!running && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <StepBtn label="−5" onClick={() => setMinutes((m) => Math.max(0, m - 5))} />
                  <StepBtn label="−1" onClick={() => setMinutes((m) => Math.max(0, m - 1))} />
                  <div className="min-w-[92px] rounded-2xl border-[3px] border-ink-100 bg-white px-3 py-1 text-center">
                    <span className="tnum font-display text-3xl font-extrabold text-ink-900">
                      {Math.round(minutes)}
                    </span>
                    <span className="ml-0.5 text-xs font-bold text-ink-500">分</span>
                  </div>
                  <StepBtn label="+1" onClick={() => setMinutes((m) => m + 1)} />
                  <StepBtn label="+5" onClick={() => setMinutes((m) => m + 5)} />
                </div>
              )}

              {!running && (
                <div className="mt-2 flex justify-center gap-2">
                  {[inst.plannedMinutes, inst.plannedMinutes * 2].map((v, i) => (
                    <button
                      key={i}
                      onClick={() => setMinutes(v)}
                      className="btn-3d active:btn-3d-press min-h-[44px] rounded-pill border-2 border-ink-100 bg-white px-3 text-xs font-extrabold text-ink-700 shadow-[0_3px_0_0_var(--color-ink-100)]"
                    >
                      {i === 0 ? `按计划 ${v} 分` : `两倍 ${v} 分`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ---------- 质量评分：改由家长在审核时给 ---------- */}
            {inst.qualityRated && (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-sun-400/60 bg-sun-50 p-3.5">
                <p className="text-sm font-extrabold text-ink-900">
                  ✨ 这项任务有质量加分
                </p>
                <p className="mt-1 text-xs font-bold leading-snug text-ink-600">
                  交上去之后，爸爸妈妈会看看做得怎么样
                  {inst.qualityBonusPoints > 0 ? `，做得好可以多拿 ${inst.qualityBonusPoints} 分` : ''}
                  。
                </p>
              </div>
            )}

            {/* ---------- 预计得分预览 ---------- */}
            {preview && (
              <div
                className={clsx(
                  'card-cartoon anim-bounce-in mt-4 overflow-hidden border-[3px] p-4',
                  preview.points > 0 ? 'border-grass-300 bg-grass-50' : 'border-ink-100 bg-white',
                )}
              >
                <p className="text-xs font-bold text-ink-500">
                  {settings.parentReviewEnabled ? '确认后大约能拿到' : '提交后能拿到'}
                </p>
                <div className="flex items-baseline gap-2">
                  <span
                    className={clsx(
                      'tnum font-display text-5xl font-extrabold',
                      preview.points > 0 ? 'text-grass-600' : 'text-ink-500',
                    )}
                  >
                    {preview.points}
                  </span>
                  <span className="font-display text-lg font-extrabold text-ink-700">分</span>
                  {preview.overtime && preview.points > 0 && (
                    <span className="rounded-pill bg-tangerine-100 px-2 py-0.5 text-[11px] font-extrabold text-tangerine-500">
                      超时得分
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm font-bold leading-snug text-ink-700">{preview.reason}</p>
                {settings.parentReviewEnabled && (
                  <p className="mt-2 rounded-xl bg-white/70 px-2.5 py-1.5 text-[11px] font-bold text-ink-500">
                    最终分数以爸爸妈妈确认的为准
                  </p>
                )}
              </div>
            )}

            {/* ---------- 规则说明：大白话 ---------- */}
            <RuleSummary inst={inst} />

            {/* ---------- 奖励掉落预览 ---------- */}
            {inst.rewardItemIds.length > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-grape-200 bg-grape-100 px-3 py-2">
                <span className="text-sm font-extrabold text-grape-500">完成后掉落</span>
                <RewardChips itemIds={inst.rewardItemIds} max={6} />
              </div>
            )}

            {/* ---------- 主按钮 ---------- */}
            <div className="mt-5 space-y-3">
              <Btn
                size="hero"
                tone="grass"
                full
                disabled={busy}
                onClick={handleSubmit}
              >
                {busy
                  ? '正在交上去…'
                  : inst.status === 'expired'
                    ? '🌟 现在补做掉'
                    : '✅ 我做完啦！'}
              </Btn>

              {!confirmGiveUp ? (
                <button
                  onClick={() => setConfirmGiveUp(true)}
                  className="min-h-[44px] w-full text-sm font-bold text-ink-500 underline decoration-dotted decoration-2 underline-offset-4"
                >
                  我放弃了 🥲
                </button>
              ) : (
                <div className="anim-fade-in rounded-2xl border-2 border-ink-100 bg-white p-3 text-center">
                  <p className="text-sm font-bold text-ink-700">
                    放弃就没积分啦，确定吗？（不会扣分的）
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Btn tone="white" size="sm" full onClick={() => setConfirmGiveUp(false)}>
                      我再试试
                    </Btn>
                    <Btn tone="ink" size="sm" full disabled={busy} onClick={handleGiveUp}>
                      确定放弃
                    </Btn>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

/* ---------------- 子组件 ---------------- */

function StepBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={label.startsWith('−') ? `减少${label.slice(1)}分钟` : `增加${label.slice(1)}分钟`}
      className="btn-3d active:btn-3d-press flex h-14 w-14 shrink-0 items-center justify-center border-[3px] border-ink-100 bg-white shadow-[0_4px_0_0_var(--color-ink-100)]"
    >
      <span className="font-display text-base font-extrabold text-ink-900">{label}</span>
    </button>
  )
}

/** 把这条任务的规则翻译成孩子/家长都能读的一句话 */
function RuleSummary({ inst }: { inst: TaskInstance }) {
  const lines: string[] = []
  if (inst.allowLateNoPenalty) {
    lines.push('🕊️ 这类任务不扣时间分，晚一点也算满分')
  } else if (inst.allowOvertime) {
    lines.push('⏳ 超时会按比例扣分，超过计划一倍才 0 分')
  } else {
    lines.push('⏱️ 严格的限时任务：超时就没有积分')
  }
  if (inst.qualityRated && inst.qualityBonusPoints > 0) {
    lines.push(`✨ 做得好可以额外拿 ${inst.qualityBonusPoints} 分`)
  }
  return (
    <ul className="mt-3 space-y-1 rounded-2xl border-2 border-ink-100 bg-white/70 p-3">
      {lines.map((l) => (
        <li key={l} className="text-xs font-bold leading-snug text-ink-700">
          {l}
        </li>
      ))}
    </ul>
  )
}

/** 结算后的庆祝面板 */
function Celebration({
  points,
  reason,
  emoji,
  onDone,
}: {
  points: number
  reason: string
  emoji: string
  onDone: () => void
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-[3px] border-sun-300 bg-sun-50 p-6 text-center">
      {/* 飘落的小星星，纯 CSS */}
      <span className="anim-sparkle absolute left-4 top-4 text-2xl">✨</span>
      <span className="anim-sparkle absolute right-5 top-8 text-xl">⭐</span>
      <span className="anim-sparkle absolute bottom-6 left-8 text-xl">🌟</span>

      <div className="anim-bounce-in mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-full border-[4px] border-sun-400 bg-white text-6xl shadow-cartoon">
        {emoji}
      </div>
      <p className="font-display text-lg font-extrabold text-ink-900">
        {points > 0 ? '太棒了！' : '完成啦！'}
      </p>
      {points > 0 && (
        <p className="tnum font-display text-5xl font-extrabold text-sun-600">
          +{points}
          <span className="ml-1 text-2xl text-ink-700">分</span>
        </p>
      )}
      <p className="mx-auto mt-2 max-w-[280px] text-sm font-bold leading-snug text-ink-700">
        {reason}
      </p>
      <div className="mt-5">
        <Btn tone="grass" size="lg" full onClick={onDone}>
          好耶，收下 🎁
        </Btn>
      </div>
    </div>
  )
}

/**
 * 已交上去、等家长确认的面板。
 *
 * 关键：**不能**在这里显示"+N 分"，因为分还没到账。
 * 但要给孩子足够的正反馈 —— 所以用"信寄出去了"的意象，
 * 并且明确告诉 TA「爸爸妈妈确认后积分就到账」。
 */
function SubmittedPanel({
  reason,
  emoji,
  onDone,
}: {
  points: number
  reason: string
  emoji: string
  onDone: () => void
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border-[3px] border-sun-300 bg-gradient-to-b from-sun-50 to-sky-50 p-6 text-center">
      <span className="anim-sparkle absolute left-4 top-4 text-2xl">✨</span>
      <span className="anim-sparkle absolute right-5 top-8 text-xl">💫</span>

      <div className="anim-bounce-in mx-auto mb-2 flex h-24 w-24 items-center justify-center rounded-full border-[4px] border-sun-400 bg-white text-6xl shadow-cartoon">
        📮
      </div>
      <p className="font-display text-xl font-extrabold text-ink-900">交上去啦！</p>
      <p className="mx-auto mt-2 max-w-[290px] text-sm font-bold leading-snug text-ink-700">
        等爸爸妈妈看一眼，确认之后积分就会到你的小金库里 🪙
      </p>

      <div className="mx-auto mt-4 max-w-[290px] rounded-2xl bg-white/80 px-3 py-2.5 text-left">
        <p className="text-[11px] font-bold text-ink-500">你完成的是</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm font-extrabold text-ink-900">
          <span>{emoji}</span>
          这项任务
        </p>
        {reason && (
          <p className="mt-1 text-[11px] leading-snug text-ink-500">{reason}</p>
        )}
      </div>

      <div className="mt-5">
        <Btn tone="grass" size="lg" full onClick={onDone}>
          好嘞，去看看别的 👀
        </Btn>
      </div>
    </div>
  )
}
