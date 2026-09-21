import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp, usePendingCheckIns } from '@/store/useApp'
import { QUALITY_META, Sheet, SheetHead, Btn, categoryOf } from '../tasks/ui'
import { ParentPinPanel } from './ParentGate'
import { settleInstance } from '@/domain/settlement'
import { humanizeMinutes, humanizeAgo } from '@/domain/time'
import type { PendingCheckIn, QualityGrade, TaskInstance } from '@/domain/types'

/* ============================================================
   家长审核面板
   ------------------------------------------------------------
   家长需求：「宝贝做完 时间 可以看到时间进度点完成。之后 家长检查
   （输入密码）才能质量打分，确定奖励。」

   流程：孩子提交 → 状态 submitted → 家长输密码 → 这个面板 →
        打分 + 确认 → 积分到账

   这里用的是与孩子端**同一套** settleInstance 引擎，
   所以家长只是在"最后一公里"做确认，不是另算一套规则。
   ============================================================ */

/** 待审条目：一条普通任务实例，或一次签到 */
type ReviewItem =
  | { kind: 'task'; key: string; inst: TaskInstance }
  | { kind: 'checkin'; key: string; ci: PendingCheckIn }

export function ReviewSheet() {
  const pending = useApp((s) => s.instances)
  const settings = useApp((s) => s.settings)
  const reviewInstance = useApp((s) => s.reviewInstance)
  const rejectInstance = useApp((s) => s.rejectInstance)
  const approveCheckIn = useApp((s) => s.approveCheckIn)
  const rejectCheckIn = useApp((s) => s.rejectCheckIn)
  const pendingCheckIns = usePendingCheckIns()

  const queue = useMemo<ReviewItem[]>(() => {
    const checkIns: ReviewItem[] = pendingCheckIns.map((ci) => ({
      kind: 'checkin',
      key: `ci:${ci.taskId}:${ci.date}`,
      ci,
    }))
    const tasks: ReviewItem[] = pending
      .filter((i) => i.status === 'submitted')
      .sort((a, b) => (a.submittedAt ?? a.updatedAt) - (b.submittedAt ?? b.updatedAt))
      .map((inst) => ({ kind: 'task', key: inst.id, inst }))
    // 签到排前面：一条签到点一下确认就完事，先清掉手感更顺；
    // 而且签到按天攒，拖着不确认会直接卡住孩子当天的坚持天数。
    return [...checkIns, ...tasks]
  }, [pending, pendingCheckIns])

  const [idx, setIdx] = useState(0)
  const current = queue[Math.min(idx, Math.max(0, queue.length - 1))]

  // 审完一个就自动往前挪
  useEffect(() => {
    if (queue.length === 0) setIdx(0)
    else if (idx >= queue.length) setIdx(Math.max(0, queue.length - 1))
  }, [queue.length, idx])

  // 队列空了要给一个明确的"看完了"，不能返回 null —— 那会渲染出一块白板，
  // 家长会以为是页面坏了（这正是之前的 bug）。
  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="text-5xl anim-float">🎉</span>
        <p className="font-display text-lg font-extrabold text-ink-900">都看完啦，辛苦啦！</p>
        <p className="text-sm font-bold leading-snug text-ink-500">
          现在没有等确认的任务和签到。
          <br />
          宝贝交上来之后，这里会出现待办。
        </p>
      </div>
    )
  }

  if (current.kind === 'checkin') {
    return (
      <CheckInReviewCard
        key={current.key}
        ci={current.ci}
        remaining={queue.length}
        index={idx}
        onApprove={approveCheckIn}
        onReject={rejectCheckIn}
        onNext={() => setIdx((i) => i + 1)}
      />
    )
  }

  return (
    <ReviewCard
      key={current.key}
      inst={current.inst}
      remaining={queue.length}
      index={idx}
      settings={settings}
      onReview={reviewInstance}
      onReject={rejectInstance}
      onNext={() => setIdx((i) => i + 1)}
    />
  )
}

/**
 * 一次签到的确认卡。
 *
 * 签到没有用时、没有质量评级 —— 家长要判断的只有一件事：
 * 「今天这一次，孩子到底做没做」。所以这里不给打分器、不给用时微调，
 * 只把「哪天、哪个任务、确认后给多少分」摆清楚。
 */
function CheckInReviewCard({
  ci,
  remaining,
  index,
  onApprove,
  onReject,
  onNext,
}: {
  ci: PendingCheckIn
  remaining: number
  index: number
  onApprove: (taskId: string, periodKey: string, date: string) => Promise<number>
  onReject: (taskId: string, periodKey: string, date: string) => Promise<void>
  onNext: () => void
}) {
  // 只订阅原始切片，再 useMemo 派生。别写成 `useApp((s) => s.tasks.find(...))` ——
  // 那依赖「tasks 数组引用在两次渲染之间不变」这个隐含前提，
  // 哪天 refresh 改成每次重建对象，就会重演 React #185。
  const tasks = useApp((s) => s.tasks)
  const task = useMemo(() => tasks.find((t) => t.id === ci.taskId), [tasks, ci.taskId])
  const [busy, setBusy] = useState(false)

  const cat = task ? categoryOf(task.category) : null

  const approve = async () => {
    setBusy(true)
    try {
      // 确认后这条签到立刻离开待办队列，本组件随之卸载 ——
      // 所以这里不要写「确认成功」的本地状态，那是一块永远渲染不到的死代码。
      // 反馈交给 store 里的 toast（「签到成功 +N 分」）。
      await onApprove(ci.taskId, ci.periodKey, ci.date)
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    setBusy(true)
    try {
      await onReject(ci.taskId, ci.periodKey, ci.date)
      onNext()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-5 pb-8 pt-4">
      <div className="surface overflow-hidden">
        <div className={clsx('flex items-center gap-3 p-3.5', cat?.soft ?? 'bg-sun-50')}>
          <span className="text-3xl">{cat?.emoji ?? '📅'}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold text-ink-900">{ci.title}</p>
            <p className="text-xs font-bold text-ink-600">
              {cat ? `${cat.label} · ` : ''}签到确认
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x-2 divide-ink-900/5 text-center">
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">签到日期</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-ink-900">
              {ci.date}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">确认后得到</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-grass-600">
              +{task?.basePoints ?? 0}
              <span className="ml-0.5 text-xs font-bold text-ink-500">分</span>
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 px-1 text-xs font-bold leading-snug text-ink-500">
        确认后这一天会算进坚持天数，攒够天数自动发阶梯奖励。
      </p>

      <div className="mt-4 space-y-2">
        <Btn tone="grass" size="hero" full disabled={busy} onClick={() => void approve()}>
          ✅ 确认这一天做到了
        </Btn>
        <Btn tone="white" size="md" full disabled={busy} onClick={() => void reject()}>
          🔁 让宝贝重新签到
        </Btn>
      </div>

      {remaining > 1 ? (
        <p className="mt-3 text-center text-xs text-ink-500">
          还有 {remaining - 1} 个等你看（第 {index + 1} / {remaining} 个）
        </p>
      ) : null}
    </div>
  )
}

function ReviewCard({
  inst,
  remaining,
  index,
  settings,
  onReview,
  onReject,
  onNext,
}: {
  inst: TaskInstance
  remaining: number
  index: number
  settings: ReturnType<typeof useApp.getState>['settings']
  onReview: (id: string, q: QualityGrade | undefined, mins?: number) => Promise<number>
  onReject: (id: string, note?: string) => Promise<void>
  onNext: () => void
}) {
  const cat = categoryOf(inst.category)

  const [quality, setQuality] = useState<QualityGrade | undefined>(
    inst.qualityRated ? (inst.quality ?? 'ok') : undefined,
  )
  const [minutes, setMinutes] = useState<number>(
    inst.actualMinutes ?? inst.plannedMinutes,
  )
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ points: number; reason: string } | null>(null)

  // 实时预览：让家长清楚"确认后孩子会拿多少分"，
  // 避免出现"以为给 20 结果给了 8"的意外。
  const preview = useMemo(() => {
    return settleInstance(
      { ...inst, actualMinutes: minutes, quality },
      {
        overtimeEnabled: settings.overtimeEnabled,
        qualityBonusThreshold: settings.qualityBonusThreshold,
        minRatioForPoints: settings.minRatioForPoints,
      },
    )
  }, [inst, minutes, quality, settings])

  const submit = async () => {
    setBusy(true)
    try {
      const pts = await onReview(inst.id, quality, minutes)
      setDone({ points: pts, reason: preview.reason })
    } finally {
      setBusy(false)
    }
  }

  const doReject = async () => {
    setBusy(true)
    try {
      await onReject(inst.id, rejectNote.trim() || undefined)
      onNext()
    } finally {
      setBusy(false)
    }
  }

  /* ---- 审核完成的小庆祝 ---- */
  if (done) {
    return (
      <div className="px-5 pb-8 pt-6 text-center">
        <div className="text-6xl anim-bounce-in">🎉</div>
        <h3 className="mt-3 font-display text-2xl font-extrabold text-ink-900">
          确认好啦！
        </h3>
        <p className="mt-1 text-base text-ink-700">
          {inst.title} · 给宝贝 <span className="tnum font-display text-2xl font-extrabold text-grass-600">{done.points}</span> 分
        </p>
        <p className="mt-1 text-sm text-ink-500">{done.reason}</p>

        {remaining > 1 ? (
          <Btn tone="grass" size="lg" full className="mt-6" onClick={onNext}>
            还有 {remaining - 1} 个等着看 →
          </Btn>
        ) : (
          <p className="mt-6 text-sm font-bold text-ink-500">今天的都看完啦 👏</p>
        )}
      </div>
    )
  }

  /* ---- 打回 ---- */
  if (rejecting) {
    return (
      <div className="px-5 pb-8 pt-4">
        <div className="surface-paper p-4">
          <p className="font-display text-lg font-extrabold text-ink-900">
            让宝贝重新做一次？
          </p>
          <p className="mt-1 text-sm text-ink-500">
            不会扣分，宝贝会看到任务重新出现。
          </p>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value.slice(0, 60))}
            placeholder="想说点什么？（可不填）比如「字再写工整一点哦」"
            rows={3}
            className="mt-3 w-full resize-none rounded-2xl border border-ink-900/10 bg-paper-2 px-3 py-2.5 text-sm font-bold text-ink-900 outline-none focus:border-berry-400"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Btn tone="white" size="lg" full onClick={() => setRejecting(false)}>
            算了
          </Btn>
          <Btn tone="berry" size="lg" full disabled={busy} onClick={() => void doReject()}>
            让 TA 再做一次
          </Btn>
        </div>
      </div>
    )
  }

  /* ---- 主审核界面 ---- */
  return (
    <div className="px-5 pb-8 pt-4">
      {/* 任务信息 */}
      <div className="surface overflow-hidden">
        <div className={clsx('flex items-center gap-3 p-3.5', cat.soft)}>
          <span className="text-3xl">{cat.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold text-ink-900">
              {inst.title}
            </p>
            <p className="text-xs font-bold text-ink-600">
              {cat.label} · 计划 {humanizeMinutes(inst.plannedMinutes)}
              {inst.backfilled ? ' · 补做' : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x-2 divide-ink-900/5 text-center">
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">宝贝用时</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-ink-900">
              {inst.actualMinutes != null ? humanizeMinutes(inst.actualMinutes) : '未计时'}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">交上来</p>
            <p className="mt-0.5 text-sm font-extrabold text-ink-900">
              {inst.submittedAt ? humanizeAgo(inst.submittedAt) : '刚刚'}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">自评</p>
            <p className="mt-0.5 text-sm font-extrabold text-ink-900">
              {inst.quality ? `${QUALITY_META[inst.quality].emoji} ${QUALITY_META[inst.quality].label}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 质量打分 */}
      {inst.qualityRated ? (
        <div className="mt-4">
          <p className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
            做得怎么样？
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['poor', 'ok', 'great'] as QualityGrade[]).map((q) => {
              const meta = QUALITY_META[q]
              const active = quality === q
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={clsx(
                    'btn flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-2xl border active:btn-press',
                    active
                      ? 'border-sun-500 bg-sun-200 shadow-flat'
                      : 'border-ink-900/10 bg-white',
                  )}
                >
                  <span className="text-2xl">{meta.emoji}</span>
                  <span className="text-xs font-extrabold text-ink-900">{meta.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* 用时微调 —— 家长可以改，防止孩子忘了点开始 */}
      <div className="mt-4">
        <p className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
          实际用了多久？（可以改）
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.max(1, m - 5))}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.max(1, m - 1))}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            −
          </button>
          <input
            type="number"
            value={minutes}
            min={1}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            className="tnum min-h-[48px] min-w-0 flex-1 rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-center font-display text-xl font-extrabold text-ink-900 outline-none focus:border-sky-400"
          />
          <button
            type="button"
            onClick={() => setMinutes((m) => m + 1)}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setMinutes((m) => m + 5)}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            +5
          </button>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => setMinutes(inst.plannedMinutes)}
            className="btn rounded-pill bg-white px-2.5 py-1.5 text-xs font-bold text-ink-500 active:btn-press"
          >
            按计划 {inst.plannedMinutes} 分
          </button>
          {inst.actualMinutes != null && (
            /* ⚠️ 说「用时」，不说「计时」。
               计时器隐藏后（见 ui.tsx 的 TIMER_ENABLED），`actualMinutes` 绝大多数是
               **孩子自己填的**，不是量出来的 —— 写「宝贝计时」等于向家长宣称
               「这数是测出来的」，比实际可信度高。
               ⚠️ 也别改成「宝贝填的」：老任务（计时器还在时点过「开始」、
               `startedAt` 还留在库里）的 `actualMinutes` 是**真的计时**结果，
               那样又反过来说错。数据里**没有**「测的 / 填的」这个字段
               （`actualMinutes` 就是一个数），所以只能用两边都成立的中性说法，
               并且和上面「宝贝用时」那个标签保持同一个词。 */
            <button
              type="button"
              onClick={() => setMinutes(Math.max(1, Math.round(inst.actualMinutes!)))}
              className="btn rounded-pill bg-white px-2.5 py-1.5 text-xs font-bold text-ink-500 active:btn-press"
            >
              宝贝用时 {Math.round(inst.actualMinutes)} 分
            </button>
          )}
        </div>
      </div>

      {/* 结算预览 */}
      <div
        className={clsx(
          'mt-4 rounded-2xl border p-4 text-center',
          preview.points > 0
            ? 'border-sun-400/50 bg-sun-50'
            : 'border-ink-900/10 bg-ink-100/60',
        )}
      >
        <p className="text-xs font-bold text-ink-500">确认后宝贝得到</p>
        <p
          className={clsx(
            'tnum mt-1 font-display text-4xl font-extrabold',
            preview.points > 0 ? 'text-grass-600' : 'text-ink-400',
          )}
        >
          {preview.points}
          <span className="ml-1 text-base font-bold text-ink-500">分</span>
        </p>
        <p className="mt-1 text-xs text-ink-500">{preview.reason}</p>
      </div>

      {/* 操作 */}
      <div className="mt-4 space-y-2">
        <Btn tone="grass" size="hero" full disabled={busy} onClick={() => void submit()}>
          ✅ 确认奖励
        </Btn>
        <Btn tone="white" size="md" full disabled={busy} onClick={() => setRejecting(true)}>
          🔁 让宝贝再做一次
        </Btn>
      </div>

      {remaining > 1 ? (
        <p className="mt-3 text-center text-xs text-ink-500">
          还有 {remaining - 1} 个等你看（第 {index + 1} / {remaining} 个）
        </p>
      ) : null}
    </div>
  )
}

/**
 * 家长端审核弹层。
 *
 * 安全要点：**一打开就要密码**，而不是等确认奖励时才拦。
 * 因为待审核列表里含有孩子提交的用时、自评等信息，
 * 而且"打分"这个动作本身就是家长权限，列表就不该给孩子看。
 *
 * 关掉弹层后重新上锁：家长放下手机，孩子不能接着用这个已解锁的面板。
 */
export function ReviewSheetModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const settings = useApp((s) => s.settings)
  const [unlocked, setUnlocked] = useState(false)

  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  // 每次打开都从"锁着"开始
  useEffect(() => {
    if (!open) setUnlocked(false)
  }, [open])

  const passed = !needsPin || unlocked

  return (
    <Sheet open={open} onClose={onClose} labelledBy="review-title">
      <SheetHead
        title={passed ? '帮宝贝看看' : '请爸爸妈妈来一下'}
        emoji={passed ? '👀' : '🔒'}
        sub={passed ? '确认任务与签到' : '审核需要密码'}
        id="review-title"
        onClose={onClose}
      />
      {passed ? (
        <ReviewSheet />
      ) : (
        <div className="px-5 pb-8 pt-2">
          <ParentPinPanel
            title="请爸爸妈妈来一下"
            hint="给宝贝打分、确认奖励，需要先输密码"
            onPass={() => setUnlocked(true)}
            onCancel={onClose}
          />
        </div>
      )}
    </Sheet>
  )
}
