import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { Portal } from '@/components/Portal'
import { humanizeMinutes, CYCLE_HINT } from '@/domain/time'
import { claimableTiers } from '@/domain/recurrence'
import { previewPoints } from '@/domain/settlement'
import type { Task, TaskInstance } from '@/domain/types'
import { STATUS_KID_LABEL } from '@/domain/types'
import {
  selectCheckInTasks,
  selectPeriodTasks,
  selectStreak,
  selectTodayInstances,
  selectTodayStats,
  useApp,
} from '@/store/useApp'
import { TaskDetail } from './TaskDetail'
import { TaskEditor } from './TaskEditor'
import {
  Btn,
  categoryOf,
  CycleBadge,
  EmptyHint,
  RewardChips,
  Sheet,
  SheetHead,
  TIMER_ENABLED,
  TONE_TEXT,
  timerTone,
  useLiveSeconds,
} from './ui'

/* ============================================================
   今日任务 · 主页
   ------------------------------------------------------------
   一眼看懂：我有多少分、今天做了几个、每个任务什么颜色。
   所有业务动作都调 store，本文件只负责“好看 + 好点”。
   ============================================================ */

export default function TaskPage() {
  const settings = useApp((s) => s.settings)
  const todayKey = useApp((s) => s.todayKey)
  const instances = useApp((s) => s.instances)
  const tasks = useApp((s) => s.tasks)

  // 选择器返回新对象/新数组 → 必须 useMemo 缓存，否则 zustand v5 会无限重渲染
  const todayInstances = useMemo(() => selectTodayInstances(useApp.getState()), [instances])
  const todayStats = useMemo(() => selectTodayStats(useApp.getState()), [instances])
  const streak = useMemo(() => selectStreak(useApp.getState()), [instances])
  const periodTasks = useMemo(() => selectPeriodTasks(useApp.getState()), [tasks])
  const checkInTasks = useMemo(() => selectCheckInTasks(useApp.getState()), [tasks])

  const [detailId, setDetailId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  /** 加了固定任务之后，孩子点「新任务」时弹给家长自己看的备忘 */
  const [fabNudge, setFabNudge] = useState(false)

  const fixedTasks = useMemo(
    () => tasks.filter((t) => t.fixed && !t.archived),
    [tasks],
  )

  const detail = useMemo(
    () => (detailId ? instances.find((i) => i.id === detailId) ?? null : null),
    [detailId, instances],
  )

  const weekday = useMemo(() => {
    const d = new Date(`${todayKey}T12:00:00`)
    return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getDay()]
  }, [todayKey])
  const dateLabel = useMemo(() => {
    const [, m, d] = todayKey.split('-')
    return `${Number(m)}月${Number(d)}日`
  }, [todayKey])

  function openNew() {
    setEditTask(null)
    setEditorOpen(true)
  }

  /** 固定任务：家长在里面自己维护，孩子这里只读展示一下 */
  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pb-32">
      {/* ================= 今日进度 =================
          原来这里还有一大块「头部」：熊头 + 你好宝贝 + 我的积分卡。
          三样东西全在顶栏重复了一遍（头像、名字、🪙），却把「今日任务」
          整整推下去一屏。现在删掉，日期和连续天数收进这张卡里 ——
          打开 App 第一眼就是「还剩几个任务」。 */}
      <ProgressCard
        done={todayStats.done}
        total={todayStats.total}
        points={todayStats.points}
        perfect={todayStats.perfect}
        rate={todayStats.rate}
        dateText={`${dateLabel} · ${weekday}`}
        streak={streak}
      />

      {/* ================= 今日任务 ================= */}
      <Section
        title="今日任务"
        emoji="📝"
        count={todayInstances.length}
        action={
          // 「加任务」是家长动作，入口收进区块标题栏。
          // 以前是个常驻右下角的悬浮球（64px 高、带文字），
          // 会一直压在任务列表上，翻到哪都挡着一块 —— 现在不再有悬浮层。
          <button
            onClick={() => {
              if (needsPin) setFabNudge(true)
              else openNew()
            }}
            aria-label="新建任务"
            className="btn active:btn-press flex min-h-[44px] items-center gap-1 rounded-pill bg-grass-100 px-3 text-xs font-extrabold text-grass-700"
          >
            <span aria-hidden className="text-base leading-none">
              {needsPin ? '🔒' : '＋'}
            </span>
            加任务
          </button>
        }
      >
        {todayInstances.length === 0 ? (
          <EmptyHint emoji="🌤️" title="今天还没有任务" detail="点上面的「加任务」就能加一个" />
        ) : (
          <div className="space-y-3">
            {todayInstances.map((inst) => (
              <TaskCard
                key={inst.id}
                inst={inst}
                onOpen={() => setDetailId(inst.id)}
                onEdit={(task) => {
                  setEditTask(task)
                  setEditorOpen(true)
                }}
              />
            ))}
          </div>
        )}
      </Section>

      {/* ================= 长期任务 ================= */}
      {periodTasks.length > 0 && (
        <Section title="长期任务" emoji="🗓️" count={periodTasks.length}>
          <div className="space-y-3">
            {periodTasks.map((t) => (
              <PeriodCard
                key={t.id}
                task={t}
                onEdit={() => {
                  setEditTask(t)
                  setEditorOpen(true)
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {/* ================= 签到 ================= */}
      {checkInTasks.length > 0 && (
        <Section title="坚持签到" emoji="📅" count={checkInTasks.length}>
          <div className="space-y-3">
            {checkInTasks.map((t) => (
              <CheckInCard key={t.id} task={t} todayKey={todayKey} />
            ))}
          </div>
        </Section>
      )}

      {/* ================= 固定任务（家规） ================= */}
      {fixedTasks.length > 0 && (
        <Section title="固定任务" emoji="📌" count={fixedTasks.length}>
          <p className="-mt-1 mb-2 px-1 text-xs font-bold text-ink-500">
            这些是每天/每周都要做的家规，爸爸妈妈帮你排好的 📌
          </p>
          <div className="space-y-2">
            {fixedTasks.map((t) => (
              <FixedTaskChip
                key={t.id}
                task={t}
                onEdit={() => {
                  setEditTask(t)
                  setEditorOpen(true)
                }}
              />
            ))}
          </div>
        </Section>
      )}

      {/* 孩子点到「加任务」时的软性提示：不弹密码盘，免得孩子乱试。
          套 Portal —— 理由同 Sheet：页面外壳的 anim-fade-in 是层叠上下文。 */}
      {fabNudge && (
        <Portal>
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-ink-900/35 p-5 backdrop-blur-[2px]"
            onClick={() => setFabNudge(false)}
          >
            <div
              className="anim-bounce-in surface w-full max-w-[400px] p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-center text-4xl">📌</p>
              <p className="mt-2 text-center font-display text-lg font-extrabold text-ink-900">
                这里要爸爸妈妈来弄
              </p>
              <p className="mt-1 text-center text-sm font-bold text-ink-600">
                任务和固定任务都是爸爸妈妈设的。想加什么，去跟爸爸妈妈说一声吧 😊
              </p>
              <div className="mt-4 flex gap-2">
                <Btn tone="white" size="md" full onClick={() => setFabNudge(false)}>
                  好的
                </Btn>
                <Btn
                  tone="sun"
                  size="md"
                  full
                  onClick={() => {
                    setFabNudge(false)
                    openNew()
                  }}
                >
                  🔑 我是家长
                </Btn>
              </div>
            </div>
          </div>
        </Portal>
      )}

      <TaskDetail instance={detail} onClose={() => setDetailId(null)} />
      <TaskEditor
        open={editorOpen}
        task={editTask}
        onClose={() => {
          setEditorOpen(false)
          setEditTask(null)
        }}
      />
    </div>
  )
}

/* ============================================================
   今日进度卡：手绘进度环 + 得分
   ============================================================ */

function ProgressCard({
  done,
  total,
  points,
  perfect,
  rate,
  dateText,
  streak,
}: {
  done: number
  total: number
  points: number
  perfect: number
  rate: number
  /** 「9月14日 · 星期一」—— 原来挂在被删掉的大头部上，现在收进这张卡 */
  dateText: string
  streak: number
}) {
  const R = 42
  const C = 2 * Math.PI * R
  const dash = (Math.min(100, rate) / 100) * C
  const allDone = total > 0 && done >= total

  return (
    <section className="surface mt-4 border border-grass-300 bg-gradient-to-br from-grass-50 to-sky-50 p-4">
      {/* 日期 + 连续天数：压成窄窄一条，不跟「还剩几个任务」抢位置 */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs font-bold text-ink-600">{dateText}</span>
        {streak > 0 && (
          <span className="ml-auto flex shrink-0 items-center gap-1 rounded-pill bg-tangerine-100 px-2.5 py-1">
            <span aria-hidden>🔥</span>
            <span className="tnum font-display text-xs font-extrabold text-tangerine-500">
              连续 {streak} 天
            </span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* 进度环 */}
        <div className="relative h-[104px] w-[104px] shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#ffffff" strokeWidth="12" />
            <circle
              cx="50"
              cy="50"
              r={R}
              fill="none"
              stroke="var(--color-grass-400)"
              strokeWidth="12"
              // 进度为 0 时用 butt 收口：round 会给一段零长度弧画出个圆点，
              // 看着像渲染坏了的一个绿点。元素保持挂载，出现时才还有过渡动画。
              strokeLinecap={rate > 0 ? 'round' : 'butt'}
              strokeDasharray={`${dash} ${C}`}
              style={{ transition: 'stroke-dasharray .5s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum font-display text-2xl font-extrabold leading-none text-ink-900">
              {done}
              <span className="text-sm text-ink-500">/{total}</span>
            </span>
            <span className="text-[10px] font-bold text-ink-500">今天做完</span>
          </div>
          {allDone && total > 0 && (
            <span className="anim-sparkle absolute -right-1 -top-1 text-2xl">🎉</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-extrabold text-ink-900">
            {total === 0
              ? '今天还没有任务'
              : allDone
                ? '全部完成啦，太棒了！'
                : `还有 ${total - done} 个任务，加油！`}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-pill bg-sun-200 px-2.5 py-1">
              <span aria-hidden>🪙</span>
              <span className="tnum font-display text-sm font-extrabold text-sun-700">
                今天 +{points}
              </span>
            </span>
            {perfect > 0 && (
              <span className="flex items-center gap-1 rounded-pill bg-white px-2.5 py-1">
                <span aria-hidden>⚡</span>
                <span className="tnum text-sm font-extrabold text-grass-600">{perfect}</span>
                <span className="text-[11px] font-bold text-ink-500">准时</span>
              </span>
            )}
          </div>
          {/* 条形进度，环形之外再给一层直观反馈 */}
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full border border-white bg-white/70">
            <div
              className="h-full rounded-full bg-grass-400 transition-all duration-500"
              style={{ width: `${rate}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ============================================================
   任务卡
   ============================================================ */

function TaskCard({
  inst,
  onOpen,
  onEdit,
}: {
  inst: TaskInstance
  onOpen: () => void
  onEdit: (task: Task) => void
}) {
  const startTimer = useApp((s) => s.startTimer)
  const tasks = useApp((s) => s.tasks)
  const cat = categoryOf(inst.category)
  const taskDef = useMemo(() => tasks.find((t) => t.id === inst.taskId), [tasks, inst.taskId])
  /**
   * ⚠️ `TIMER_ENABLED` 必须放在最前面。计时器关掉之后 `running` 恒为 false，
   * 下面的秒表分支整段都不会渲染 —— 不这么写的话，一个**之前已经点过
   * 「开始」的老任务**（`startedAt` 还在库里）会继续显示秒表，
   * 而卡片上已经没有「开始」按钮了，孩子看着一个走动的表不知道怎么停。
   */
  const running = TIMER_ENABLED && inst.status === 'pending' && !!inst.startedAt
  const seconds = useLiveSeconds(inst.startedAt, running)

  const done = inst.status === 'completed' || inst.status === 'failed'
  const submitted = inst.status === 'submitted'
  const rejected = inst.status === 'rejected'
  const onTime = done && (inst.actualMinutes ?? 0) <= inst.plannedMinutes

  return (
    <div
      className={clsx(
        'surface relative overflow-hidden border p-3.5 transition-transform',
        inst.status === 'pending' && 'border-ink-100',
        done && 'border-grass-300',
        submitted && 'border-sun-400',
        rejected && 'border-berry-300',
        inst.status === 'expired' && 'border-ink-100 opacity-80',
        inst.status === 'skipped' && 'border-ink-100 opacity-60',
      )}
    >
      {/* 左侧色条：一眼认出分类 */}
      <span className={clsx('absolute inset-y-0 left-0 w-2', cat.solid)} />

      <div className="flex items-start gap-3 pl-1.5">
        <span
          className={clsx(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
            submitted ? 'bg-sun-200' : rejected ? 'bg-berry-100' : cat.soft,
          )}
        >
          {submitted
            ? '📮'
            : rejected
              ? '🔁'
              : done
                ? inst.status === 'failed'
                  ? '💪'
                  : '✅'
                : cat.emoji}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3
              className={clsx(
                'min-w-0 flex-1 truncate font-display text-base font-extrabold text-ink-900',
                (done || inst.status === 'skipped') && 'line-through decoration-2 opacity-60',
              )}
            >
              {inst.title}
            </h3>
            {(inst.allowLateNoPenalty || inst.qualityRated) && (
              <span className="flex shrink-0 gap-0.5 text-xs" aria-hidden>
                {inst.allowLateNoPenalty && <span title="超期不扣分">🕊️</span>}
                {inst.qualityRated && <span title="有质量加分">✨</span>}
              </span>
            )}
            {taskDef && (
              <button
                onClick={() => onEdit(taskDef)}
                aria-label="编辑任务"
                className="min-h-[28px] shrink-0 rounded-pill border border-ink-100 bg-white px-2 text-[11px] font-bold text-ink-500 active:scale-95"
              >
                ✏️
              </button>
            )}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-ink-500">
            <span>⏰ {humanizeMinutes(inst.plannedMinutes)}</span>
            <span className={cat.ink}>🪙 {inst.basePoints} 分</span>
            <CycleBadge cycle={inst.cycle} />
            <RewardChips itemIds={inst.rewardItemIds} />
          </div>

          {/* -------- 状态：待完成 / 重做 -------- */}
          {(inst.status === 'pending' || rejected) && (
            <div className="mt-2.5">
              {rejected && inst.rejectNote ? (
                <div className="mb-2 rounded-2xl border border-berry-200 bg-berry-50 px-3 py-2">
                  <p className="text-[11px] font-bold text-berry-600">
                    👨‍👩‍👧 爸爸妈妈说：
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-ink-700">{inst.rejectNote}</p>
                </div>
              ) : null}
              {running ? (
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      'tnum flex-1 rounded-pill border px-3 py-2 text-center font-display text-lg font-extrabold',
                      TONE_TEXT[timerTone(seconds / 60, inst.plannedMinutes)],
                      timerTone(seconds / 60, inst.plannedMinutes) === 'grass'
                        ? 'border-grass-300 bg-grass-100'
                        : timerTone(seconds / 60, inst.plannedMinutes) === 'tangerine'
                          ? 'border-tangerine-300 bg-tangerine-100'
                          : 'border-berry-300 bg-berry-100',
                    )}
                  >
                    {String(Math.floor(seconds / 60)).padStart(2, '0')}:
                    {String(seconds % 60).padStart(2, '0')}
                  </span>
                  <Btn tone="grass" size="md" onClick={onOpen}>
                    ✅ 我做完啦！
                  </Btn>
                </div>
              ) : TIMER_ENABLED ? (
                <div className="flex items-center gap-2">
                  <Btn
                    tone="sky"
                    size="md"
                    onClick={() => {
                      void startTimer(inst.id)
                    }}
                  >
                    ▶️ 开始
                  </Btn>
                  <button
                    onClick={onOpen}
                    className="min-h-[44px] flex-1 rounded-2xl border border-dashed border-ink-300 px-2 text-xs font-bold text-ink-500"
                  >
                    没用计时器 · 直接填时间
                  </button>
                </div>
              ) : (
                /* 计时器关着（见 ui.tsx 的 TIMER_ENABLED）：只剩一条路 ——
                   点开 → 填用时 → 交上来。
                   ⚠️ 别把「▶️ 开始」写回来，它是计时器的入口，开关关着没有意义；
                   也别退回「没用计时器 · 直接填时间」那句 —— 那句是**对比着计时器**
                   说的，没有计时器之后它就成了一脸问号。 */
                <Btn tone="grass" size="md" full onClick={onOpen}>
                  ✅ 我做完啦！
                </Btn>
              )}
            </div>
          )}

          {/* -------- 状态：等爸爸妈妈看 -------- */}
          {submitted && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="anim-pop flex items-center gap-1 rounded-pill bg-sun-200 px-2.5 py-1">
                <span aria-hidden>📮</span>
                <span className="text-[11px] font-extrabold text-ink-900">
                  {STATUS_KID_LABEL.submitted}
                </span>
              </span>
              <span className="text-[11px] font-bold text-ink-500">
                {inst.actualMinutes != null
                  ? `用了 ${Math.round(inst.actualMinutes)} 分钟 · `
                  : ''}
                确认后积分就到账啦
              </span>
            </div>
          )}

          {done && (
            <div className="mt-2.5 flex items-center gap-2">
              <span
                className={clsx(
                  'flex items-center gap-1 rounded-pill px-2.5 py-1',
                  (inst.earnedPoints ?? 0) > 0 ? 'bg-grass-100' : 'bg-sun-100',
                )}
              >
                <span aria-hidden>{(inst.earnedPoints ?? 0) > 0 ? '🎉' : '💪'}</span>
                <span
                  className={clsx(
                    'tnum font-display text-sm font-extrabold',
                    (inst.earnedPoints ?? 0) > 0 ? 'text-grass-600' : 'text-sun-700',
                  )}
                >
                  +{inst.earnedPoints ?? 0} 分
                </span>
              </span>
              <span className="text-[11px] font-bold text-ink-500">
                {inst.actualMinutes != null
                  ? `用了 ${Math.round(inst.actualMinutes)} 分钟`
                  : '未计时'}
                {onTime && (inst.earnedPoints ?? 0) > 0 && ' · 准时 ⚡'}
              </span>
              {inst.backfilled && (
                <span className="rounded-pill bg-berry-100 px-2 py-0.5 text-[10px] font-bold text-berry-500">
                  补做
                </span>
              )}
            </div>
          )}

          {inst.status === 'failed' && (
            <p className="mt-1.5 text-[11px] font-bold text-ink-500">
              完成了就很厉害啦，明天再准时一点就更棒 💪
            </p>
          )}

          {inst.status === 'expired' && (
            <div className="mt-2.5 flex items-center gap-2">
              <span className="rounded-pill bg-ink-100 px-2.5 py-1 text-[11px] font-bold text-ink-500">
                昨天没做
              </span>
              <Btn tone="white" size="sm" onClick={onOpen}>
                🌟 现在补做掉
              </Btn>
            </div>
          )}

          {inst.status === 'skipped' && (
            <p className="mt-1.5 text-[11px] font-bold text-ink-500">这次先跳过了，明天见 👋</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   固定任务小条（家规）
   ------------------------------------------------------------
   不做成大卡片：固定任务通常有好几条，排成清单更好扫。
   编辑按钮交给家长（TaskEditor 内部再拦一次密码）。
   ============================================================ */

function FixedTaskChip({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const cat = categoryOf(task.category)
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-ink-100 bg-white px-3 py-2.5">
      <span className={clsx('grid size-9 shrink-0 place-items-center rounded-xl text-lg', cat.soft)}>
        {cat.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-extrabold text-ink-900">{task.title}</p>
        <p className="text-[11px] font-bold text-ink-500">
          {CYCLE_HINT[task.cycle]} · 每次 {humanizeMinutes(task.plannedMinutes)} · 🪙{' '}
          {task.basePoints} 分
        </p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        aria-label="编辑固定任务"
        className="min-h-[36px] shrink-0 rounded-pill border border-ink-100 bg-paper-2 px-2.5 text-[11px] font-bold text-ink-500"
      >
        ✏️ 改
      </button>
    </div>
  )
}

/* ============================================================
   长期任务卡（周 / 月 / 年）
   ============================================================ */

function PeriodCard({ task, onEdit }: { task: Task; onEdit: () => void }) {
  const periodUnitsFor = useApp((s) => s.periodUnitsFor)
  const submitPeriodTask = useApp((s) => s.submitPeriodTask)
  const [busy, setBusy] = useState(false)
  const [onceOpen, setOnceOpen] = useState(false)

  const units = periodUnitsFor(task)
  const doneCount = units.filter((u) => u.done).length
  const pendingCount = units.filter((u) => u.pending).length
  const total = units.length
  const pct = total > 0 ? (doneCount / total) * 100 : 0
  const cat = categoryOf(task.category)
  const allDone = doneCount >= total
  // 已确认 + 待确认把格子占满了，就不该再让提交 ——
  // 否则家长那边会攒出一串一模一样的待办。
  const full = doneCount + pendingCount >= total

  async function handleOnce(minutes: number) {
    if (busy || full) return
    setBusy(true)
    // ⚠️ 质量**固定传 undefined**：孩子不自评质量，质量分由家长在审核时给。
    //
    // 以前这里传的是 `OnceSubmitSheet` 里选的那个 quality ——
    // 等于让孩子自己给自己打分，而且那张表还把「+N 分」的预览直接摆在
    // 提交按钮上面，点一下就知道自己能拿多少分。
    // 和普通任务（`TaskDetail` 里 `submitInstance(inst.id, mins, undefined, …)`）
    // 保持同一个口径。
    await submitPeriodTask(task.id, minutes, undefined)
    setBusy(false)
    setOnceOpen(false)
  }

  return (
    <div className={clsx('surface relative overflow-hidden border p-3.5', cat.border)}>
      <span className={clsx('absolute inset-y-0 left-0 w-2', cat.solid)} />
      <div className="pl-1.5">
        <div className="flex items-start gap-3">
          <span
            className={clsx(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
              cat.soft,
            )}
          >
            {cat.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="min-w-0 flex-1 truncate font-display text-base font-extrabold text-ink-900">
                {task.title}
              </h3>
              <button
                onClick={onEdit}
                aria-label="编辑任务"
                className="min-h-[32px] shrink-0 rounded-pill border border-ink-100 bg-white px-2 text-[11px] font-bold text-ink-500"
              >
                ✏️
              </button>
            </div>
            <p className="mt-0.5 text-[11px] font-bold text-ink-500">
              {CYCLE_HINT[task.cycle]} · 每次 {humanizeMinutes(task.plannedMinutes)} · 🪙{' '}
              {task.basePoints} 分
            </p>
          </div>
        </div>

        {/* 进度条 + 小格子 */}
        <div className="mt-3 flex items-center gap-2">
          <span
            className={clsx(
              'tnum font-display text-lg font-extrabold',
              allDone ? 'text-grass-600' : 'text-ink-900',
            )}
          >
            {doneCount}
            <span className="text-sm text-ink-500">/{total}</span>
          </span>
          <div className="h-3 flex-1 overflow-hidden rounded-full border border-white bg-ink-100">
            <div
              className={clsx('h-full rounded-full transition-all duration-500', cat.solid)}
              style={{ width: `${pct}%` }}
            />
          </div>
          {allDone && <span className="anim-sparkle text-xl">🏆</span>}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {units.map((u) => (
            <span
              key={u.index}
              title={u.pending ? `${u.label} · 等爸爸妈妈确认` : u.label}
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-lg border text-xs',
                u.done
                  ? clsx(cat.soft, 'border-transparent')
                  : u.pending
                    ? 'border-sun-400 bg-sun-100'
                    : 'border-dashed border-ink-300',
              )}
            >
              {u.done ? '✅' : u.pending ? '📮' : '⬜'}
            </span>
          ))}
        </div>

        {pendingCount > 0 && !allDone && (
          <p className="mt-2 text-[11px] font-bold text-sun-700">
            有 {pendingCount} 次等爸爸妈妈确认 📮
          </p>
        )}

        <div className="mt-3">
          <Btn
            tone={allDone || full ? 'white' : 'grass'}
            size="md"
            full
            disabled={busy || full}
            onClick={() => setOnceOpen(true)}
          >
            {allDone
              ? '🎉 这个周期的目标完成啦'
              : full
                ? '📮 都交上去了，等爸爸妈妈确认'
                : busy
                  ? '记录中…'
                  : '完成一次 ＋'}
          </Btn>
        </div>
      </div>

      {onceOpen ? (
        <OnceSubmitSheet
          task={task}
          onCancel={() => setOnceOpen(false)}
          onConfirm={handleOnce}
        />
      ) : null}
    </div>
  )
}

/* ============================================================
   周期任务单次提交：孩子只报「用了多久」，质量分交给家长
   ------------------------------------------------------------
   ⚠️ 这里**不能有质量自评**。

   普通任务早就改成了「孩子只提交，质量分由家长给」
   （`TaskDetail.handleSubmit` 里那句 `submitInstance(inst.id, mins, undefined, …)`），
   但周期任务这张表漏了：孩子能自己选「一般 / 不错 / 特别棒」，
   而且下面直接把「+N 分」摆出来 —— 等于自己给自己打分，
   家长审核就成了走个过场。

   现在对齐普通任务：只有用时输入 + 一个「完成确认」，
   分数是**大约**（家长会按质量调整），并明说要去等爸爸妈妈看一眼。

   ⚠️ `export` 是给回归测试用的（`PeriodSubmit.test.tsx`）。
   这个组件不对外复用 —— 它只为「长期任务卡」服务。
   ============================================================ */

export function OnceSubmitSheet({
  task,
  onCancel,
  onConfirm,
}: {
  task: Task
  onCancel: () => void
  onConfirm: (minutes: number) => void
}) {
  const [minutes, setMinutes] = useState(task.plannedMinutes)
  const parentReviewEnabled = useApp((s) => s.settings.parentReviewEnabled)

  // previewPoints 期望 TaskInstance 形状；周期任务只有 Task 定义，
  // 这里补齐结算真正会用到的字段（其余字段结算引擎不读）。
  //
  // 质量传 `undefined`（**不是** 'ok'）—— 理由见本组件顶部的注释。
  const preview = previewPoints(
    {
      id: `preview_${task.id}`,
      taskId: task.id,
      periodKey: '',
      date: '',
      title: task.title,
      category: task.category,
      cycle: task.cycle,
      status: 'pending',
      rewardItemIds: [],
      createdAt: 0,
      updatedAt: 0,
      plannedMinutes: task.plannedMinutes,
      basePoints: task.basePoints,
      qualityBonusPoints: task.qualityBonusPoints,
      allowOvertime: task.allowOvertime,
      allowLateNoPenalty: task.allowLateNoPenalty,
      qualityRated: task.qualityRated,
    },
    minutes,
    undefined,
  )

  const step = (d: number) => setMinutes((m) => Math.max(1, Math.round(m + d)))

  return (
    <Sheet open onClose={onCancel}>
      <SheetHead title="记一次完成" emoji="✏️" onClose={onCancel} />
      <div className="px-4 pb-4">
        <p className="mb-3 text-sm font-bold text-ink-500">
          这次是「{task.title}」，计划 {task.plannedMinutes} 分钟
        </p>

        {/* 用时 */}
        <div className="mb-4">
          <p className="mb-2 font-display text-base font-extrabold text-ink-900">用了多久？</p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => step(-5)}
              className="btn h-12 w-12 rounded-2xl bg-white text-xl font-extrabold text-ink-700 shadow-flat active:btn-press"
              aria-label="减少 5 分钟"
            >
              −5
            </button>
            <button
              type="button"
              onClick={() => step(-1)}
              className="btn h-12 w-12 rounded-2xl bg-white text-xl font-extrabold text-ink-700 shadow-flat active:btn-press"
              aria-label="减少 1 分钟"
            >
              −
            </button>
            <span className="tnum min-w-[5.5rem] text-center font-display text-3xl font-extrabold text-ink-900">
              {minutes}
              <span className="ml-1 text-sm text-ink-500">分</span>
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              className="btn h-12 w-12 rounded-2xl bg-white text-xl font-extrabold text-ink-700 shadow-flat active:btn-press"
              aria-label="增加 1 分钟"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => step(5)}
              className="btn h-12 w-12 rounded-2xl bg-white text-xl font-extrabold text-ink-700 shadow-flat active:btn-press"
              aria-label="增加 5 分钟"
            >
              +5
            </button>
          </div>
        </div>

        {/* ⚠️ 这里以前有「做得怎么样？」三个自评按钮（一般 / 不错 / 特别棒）——
            已删除，理由见组件顶部注释。孩子只报用时；质量分由家长在审核时给。
            别再加回来：`TaskDetail` 那边早就没这个了。 */}

        {/* 得分预览 —— 家长审核开着时只能说「大约」，因为质量分还没定 */}
        <div className="mb-3 rounded-2xl bg-paper-2 p-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪙</span>
            <span className="font-display text-2xl font-extrabold text-ink-900">
              +{preview.points}
            </span>
            <span className="ml-auto text-xs font-bold text-ink-500">
              {preview.overtime ? '超时结算' : '按时完成'}
            </span>
          </div>
          <p className="mt-1 text-xs font-bold text-ink-500">
            {parentReviewEnabled ? '确认后大约能拿到' : '提交后能拿到'} · {preview.reason}
          </p>
        </div>

        {parentReviewEnabled && (
          <p className="mb-3 text-center text-[11px] font-bold text-ink-500">
            爸爸妈妈看一眼确认之后，积分才到你的小金库 🪙
          </p>
        )}

        {/* ⚠️ 两个按钮都要 `full`，各占一半。
            只给右边加 `full`（w-full）会把左边挤成竖排的「取 / 消」——
            「提交」两个字时还看不出来，换成「完成确认」四个字就露馅了。
            两键并排的写法跟 `TaskDetail` / `ReviewSheet` 保持一致。 */}
        <div className="flex gap-2">
          <Btn tone="white" size="md" full onClick={onCancel}>
            取消
          </Btn>
          <Btn tone="grass" size="md" full onClick={() => onConfirm(minutes)}>
            完成确认
          </Btn>
        </div>
      </div>
    </Sheet>
  )
}

/* ============================================================
   签到卡：日格 + 阶梯奖励
   ============================================================ */

function CheckInCard({ task, todayKey }: { task: Task; todayKey: string }) {
  const doCheckIn = useApp((s) => s.doCheckIn)
  const claimCheckInTier = useApp((s) => s.claimCheckInTier)
  const tiersFor = useApp((s) => s.tiersFor)
  const checkInDays = useApp((s) => s.checkInDays)
  const checkInProgress = useApp((s) => s.checkInProgress)
  const [busy, setBusy] = useState(false)

  const days = checkInDays(task.id)
  const tiers = tiersFor(task)
  // 订阅 progress，保证领取后阶梯状态刷新
  const claimed = useMemo(() => {
    const p = checkInProgress.find((x) => x.taskId === task.id)
    return p?.claimedTiers ?? []
  }, [checkInProgress, task.id])

  const cat = categoryOf(task.category)
  const signedToday = days.includes(todayKey)
  /**
   * 今天已经交上去、还在等家长确认。
   *
   * 「没签」「已交待审」「已确认」是三个不同状态，必须分开表达 ——
   * 少一个，孩子就会看到按钮还能点、于是重复交，家长那边冒出一串重复待办。
   * 注意要扫全部 progress 行：日签的周期键每天变，只 find 第一行会漏。
   */
  const pendingToday = useMemo(
    () =>
      checkInProgress.some(
        (p) => p.taskId === task.id && (p.pendingDays ?? []).includes(todayKey),
      ),
    [checkInProgress, task.id, todayKey],
  )
  const claimable = claimableTiers(tiers, days.length, claimed)
  const target = task.checkInTargetCount ?? 5

  // 展示格子：本周 / 本月
  const cells = useMemo(() => buildCells(task.cycle, todayKey, days), [task.cycle, todayKey, days])

  async function handleCheckIn() {
    if (busy || signedToday || pendingToday) return
    setBusy(true)
    await doCheckIn(task.id)
    setBusy(false)
  }

  async function handleClaim(d: number) {
    if (busy) return
    setBusy(true)
    await claimCheckInTier(task.id, d)
    setBusy(false)
  }

  return (
    <div className={clsx('surface relative overflow-hidden border p-3.5', cat.border)}>
      <span className={clsx('absolute inset-y-0 left-0 w-2', cat.solid)} />
      <div className="pl-1.5">
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
              cat.soft,
            )}
          >
            {cat.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-display text-base font-extrabold text-ink-900">
              {task.title}
            </h3>
            <p className="text-[11px] font-bold text-ink-500">
              已坚持{' '}
              <span className="tnum font-extrabold text-ink-900">{days.length}</span>
              <span className="text-ink-500"> / {target} 天</span>
            </p>
            {pendingToday && (
              <p className="text-[11px] font-bold text-sun-700">
                今天已交，等爸爸妈妈看一眼 📮
              </p>
            )}
          </div>
        </div>

        {/* 日期格子 */}
        <div
          className={clsx(
            'mt-3 gap-1.5',
            // 周视图 7 列刚好一行；月视图排成 7 列日历，读起来像真日历，
            // 也让 31 个格子有结构，而不是一堆散落的方块。
            cells.length > 7 ? 'grid grid-cols-7' : 'flex flex-wrap',
          )}
        >
          {cells.map((c) =>
            c.pad ? (
              <span key={c.key} aria-hidden className="h-8" />
            ) : (
              <span
                key={c.key}
                className={clsx(
                  'flex h-8 min-w-8 items-center justify-center rounded-lg border px-1 text-[10px] font-extrabold',
                  cells.length > 7 && 'min-w-0',
                  c.signed
                    ? 'border-grass-400 bg-grass-200 text-grass-700'
                    : c.today
                      ? 'border-sun-400 bg-sun-100 text-sun-700'
                      : c.past
                        ? 'border-ink-100 bg-ink-100/60 text-ink-300'
                        : 'border-dashed border-ink-300 bg-white text-ink-300',
                )}
                title={c.key}
              >
                {c.signed ? '✅' : c.today && pendingToday ? '📮' : c.label}
              </span>
            ),
          )}
        </div>

        {/* 阶梯 */}
        <div className="mt-3 space-y-1.5">
          {tiers.map((t) => {
            const got = claimed.includes(t.days)
            const can = claimable.some((c) => c.days === t.days)
            return (
              <button
                key={t.days}
                disabled={!can || busy}
                onClick={() => handleClaim(t.days)}
                className={clsx(
                  'flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors',
                  got
                    ? 'border-grass-300 bg-grass-100'
                    : can
                      ? 'btn active:btn-press anim-wiggle border-sun-400 bg-sun-200'
                      : 'border-ink-100 bg-white',
                )}
              >
                <span className="tnum font-display text-base font-extrabold text-ink-900">
                  {t.days}
                </span>
                <span className="text-[10px] font-bold text-ink-500">天</span>
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink-700">
                  {t.label}
                </span>
                {got ? (
                  <span className="shrink-0 text-xs font-extrabold text-grass-600">已拿 ✅</span>
                ) : (
                  <span
                    className={clsx(
                      'tnum shrink-0 rounded-pill px-2 py-0.5 text-xs font-extrabold',
                      can ? 'bg-sun-400 text-ink-900' : 'bg-ink-100 text-ink-500',
                    )}
                  >
                    {can ? `领 +${t.points}` : `+${t.points}`}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-3">
          <Btn
            tone={signedToday || pendingToday ? 'white' : 'sun'}
            size="lg"
            full
            disabled={busy || signedToday || pendingToday}
            onClick={handleCheckIn}
          >
            {signedToday
              ? '✅ 今天已经签过啦'
              : pendingToday
                ? '📮 已交，等爸爸妈妈看'
                : busy
                  ? '签到中…'
                  : '📅 今天签到'}
          </Btn>
        </div>
      </div>
    </div>
  )
}

interface Cell {
  key: string
  label: string
  signed: boolean
  today: boolean
  past: boolean
  /** 月视图里为对齐星期而留的空白格，不渲染成方块 */
  pad?: boolean
}

/** 按周期生成日格：周 → 7 格（周一起），月/年 → 按目标天数铺格 */
function buildCells(cycle: Task['cycle'], todayKey: string, signedDays: string[]): Cell[] {
  const set = new Set(signedDays)
  const out: Cell[] = []

  if (cycle === 'weekly') {
    const d = new Date(`${todayKey}T12:00:00`)
    const dow = (d.getDay() + 6) % 7 // 周一 = 0
    const monday = new Date(d.getTime() - dow * 86_400_000)
    const names = ['一', '二', '三', '四', '五', '六', '日']
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday.getTime() + i * 86_400_000)
      const key = dateKeyOf(dt)
      out.push({
        key,
        label: names[i],
        signed: set.has(key),
        today: key === todayKey,
        past: key < todayKey,
      })
    }
    return out
  }

  // 月 / 年 / 其它：从本月 1 号起铺到月末
  const d = new Date(`${todayKey}T12:00:00`)
  const y = d.getFullYear()
  const m = d.getMonth()
  const last = new Date(y, m + 1, 0).getDate()
  // 前置留白，让 1 号落在正确的星期列上，整块读起来就是一张日历。
  const lead = (new Date(y, m, 1, 12).getDay() + 6) % 7 // 周一 = 0
  for (let i = 0; i < lead; i++) {
    out.push({ key: `pad-${i}`, label: '', signed: false, today: false, past: false, pad: true })
  }
  for (let i = 1; i <= last; i++) {
    const dt = new Date(y, m, i, 12)
    const key = dateKeyOf(dt)
    out.push({
      key,
      label: String(i),
      signed: set.has(key),
      today: key === todayKey,
      past: key < todayKey,
    })
  }
  return out
}

function dateKeyOf(d: Date): string {
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ---------------- 分区标题 ---------------- */

function Section({
  title,
  emoji,
  count,
  action,
  children,
}: {
  title: string
  emoji: string
  count: number
  /** 区块右上角的小动作（比如「加任务」）。不给就不占位。 */
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center gap-2">
        <span aria-hidden className="text-xl">
          {emoji}
        </span>
        <h2 className="font-display text-lg font-extrabold text-ink-900">{title}</h2>
        {count > 0 && (
          <span className="tnum rounded-pill bg-ink-900/5 px-2 py-0.5 text-xs font-extrabold text-ink-500">
            {count}
          </span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  )
}
