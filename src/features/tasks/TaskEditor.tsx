import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { settle } from '@/domain/settlement'
import { humanizeMinutes, CYCLE_LABEL } from '@/domain/time'
import { defaultTiers } from '@/domain/recurrence'
import { ITEMS } from '@/domain/catalog'
import type { Task, TaskCategory, TaskCycle } from '@/domain/types'
import { useApp, type NewTaskInput } from '@/store/useApp'
import { ParentPinPanel } from '../parent/ParentGate'
import { Btn, CATEGORY, CATEGORY_ORDER, Sheet, SheetHead, globalFrom } from './ui'

/* ============================================================
   新建 / 编辑任务 —— 底部弹层
   ------------------------------------------------------------
   1) 表单字段全部是低龄友好的大控件
   2) 三个「规则开关」直接映射结算引擎，用大白话解释
   3) 规则预览调用 settle() 真实计算，绝不手写数字
   4) 「固定任务」= 长期不变的家规（刷牙、练琴…），由家长维护；
      新增/编辑本身就是家长动作，所以整层先用密码挡住，
      孩子点进来只会看到一把锁。
   ============================================================ */

const CYCLES: TaskCycle[] = ['once', 'daily', 'weekly', 'monthly', 'yearly']

export function TaskEditor({
  open,
  task,
  onClose,
}: {
  open: boolean
  /** 传入则为编辑模式 */
  task?: Task | null
  onClose: () => void
}) {
  const addTask = useApp((s) => s.addTask)
  const updateTask = useApp((s) => s.updateTask)
  const settings = useApp((s) => s.settings)
  const toast = useApp((s) => s.pushToast)

  const editing = !!task

  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<TaskCategory>('study')
  const [cycle, setCycle] = useState<TaskCycle>('daily')
  const [plannedMinutes, setPlannedMinutes] = useState(20)
  const [basePoints, setBasePoints] = useState(10)
  const [qualityBonusPoints, setQualityBonusPoints] = useState(0)

  const [allowOvertime, setAllowOvertime] = useState(true)
  const [allowLateNoPenalty, setAllowLateNoPenalty] = useState(false)
  const [qualityRated, setQualityRated] = useState(false)

  const [checkInEnabled, setCheckInEnabled] = useState(false)
  const [checkInTargetCount, setCheckInTargetCount] = useState(5)
  const [fixed, setFixed] = useState(false)
  const [rewardItemIds, setRewardItemIds] = useState<string[]>([])
  const [err, setErr] = useState<string | null>(null)

  /** 家长校验：没设密码就等于不设防（省得自己都进不去） */
  const needsPin = !!settings.parentPin && settings.protectParentActions !== false
  const [unlocked, setUnlocked] = useState(false)

  // 关闭时重新上锁，避免孩子趁家长走开继续改
  useEffect(() => {
    if (!open) setUnlocked(false)
  }, [open])

  // 打开时载入初值
  useEffect(() => {
    if (!open) return
    setErr(null)
    if (task) {
      setTitle(task.title)
      setNote(task.note ?? '')
      setCategory(task.category)
      setCycle(task.cycle)
      setPlannedMinutes(task.plannedMinutes)
      setBasePoints(task.basePoints)
      setQualityBonusPoints(task.qualityBonusPoints)
      setAllowOvertime(task.allowOvertime)
      setAllowLateNoPenalty(task.allowLateNoPenalty)
      setQualityRated(task.qualityRated)
      setCheckInEnabled(!!task.checkInEnabled)
      setCheckInTargetCount(task.checkInTargetCount ?? 5)
      setFixed(!!task.fixed)
      setRewardItemIds(task.rewardItemIds ?? [])
    } else {
      setTitle('')
      setNote('')
      setCategory('study')
      setCycle('daily')
      setPlannedMinutes(20)
      setBasePoints(10)
      setQualityBonusPoints(0)
      setAllowOvertime(true)
      setAllowLateNoPenalty(false)
      setQualityRated(false)
      setCheckInEnabled(false)
      setCheckInTargetCount(5)
      setFixed(false)
      setRewardItemIds([])
    }
  }, [open, task])

  const global = useMemo(() => globalFrom(settings), [settings])

  /** 用真实引擎算：按时 / 超出 50% / 超出一倍 各能拿多少分 */
  const preview = useMemo(() => {
    const mk = (ratio: number) =>
      settle({
        plannedMinutes,
        actualMinutes: plannedMinutes * ratio,
        basePoints,
        qualityBonusPoints,
        quality: qualityRated ? 'great' : undefined,
        qualityRated,
        allowOvertime,
        allowLateNoPenalty,
        ...global,
      })
    return {
      onTime: mk(1),
      half: mk(1.5),
      double: mk(2),
      late: settle({
        plannedMinutes,
        actualMinutes: undefined,
        basePoints,
        qualityBonusPoints,
        quality: qualityRated ? 'great' : undefined,
        qualityRated,
        allowOvertime,
        allowLateNoPenalty,
        ...global,
      }),
    }
  }, [
    plannedMinutes,
    basePoints,
    qualityBonusPoints,
    qualityRated,
    allowOvertime,
    allowLateNoPenalty,
    global,
  ])

  const tiers = useMemo(
    () => (checkInEnabled ? defaultTiers(cycle, checkInTargetCount) : []),
    [checkInEnabled, cycle, checkInTargetCount],
  )

  function validate(): string | null {
    if (!title.trim()) return '给任务起个名字吧 ✏️'
    if (!Number.isFinite(plannedMinutes) || plannedMinutes <= 0) return '计划时长要大于 0 分钟 ⏰'
    if (!Number.isFinite(basePoints) || basePoints < 0) return '基础积分不能是负数哦 🪙'
    if (!Number.isFinite(qualityBonusPoints) || qualityBonusPoints < 0)
      return '质量奖励不能是负数哦 ✨'
    if (qualityRated && qualityBonusPoints <= 0) return '开了质量评分，记得给「做得好」设一点奖励分 ✨'
    if (checkInEnabled && (checkInTargetCount < 1 || checkInTargetCount > 366))
      return '目标天数要在 1 到 366 之间 📅'
    return null
  }

  async function handleSave() {
    const v = validate()
    if (v) {
      setErr(v)
      return
    }
    const input: NewTaskInput = {
      title: title.trim(),
      note: note.trim() || undefined,
      category,
      cycle,
      plannedMinutes: Math.round(plannedMinutes),
      basePoints: Math.round(basePoints),
      qualityBonusPoints: Math.round(qualityBonusPoints),
      allowOvertime,
      allowLateNoPenalty,
      qualityRated,
      rewardItemIds: rewardItemIds.length > 0 ? rewardItemIds : undefined,
      checkInEnabled,
      checkInTargetCount: checkInEnabled || cycle !== 'daily' ? checkInTargetCount : undefined,
      fixed,
    }
    if (editing && task) {
      await updateTask(task.id, input as Partial<Task>)
      toast({ kind: 'success', title: '任务改好啦', emoji: '✏️' })
    } else {
      await addTask(input)
      toast({ kind: 'success', title: '新任务加好啦', emoji: '🎉' })
    }
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} labelledBy="task-editor-title">
      <SheetHead
        id="task-editor-title"
        title={editing ? '改一改任务' : '加一个新任务'}
        emoji={editing ? '✏️' : '➕'}
        onClose={onClose}
      />

      <div className="space-y-5 px-5 pb-10">
        {/* ---------- 家长门禁：任务的新增/编辑是家长动作 ---------- */}
        {needsPin && !unlocked ? (
          <div className="anim-fade-in card-cartoon border-[3px] border-sun-300 bg-sun-50 p-4">
            <ParentPinPanel
              title="请爸爸妈妈来一下"
              hint="改任务、加固定任务，先输一下密码"
              onPass={() => setUnlocked(true)}
              onCancel={onClose}
            />
          </div>
        ) : (
          <>
        {/* ---------- 名字 ---------- */}
        <Field label="任务叫什么" emoji="🏷️">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="比如：完成语文作业"
            className="min-h-[56px] w-full rounded-2xl border-[3px] border-ink-100 bg-white px-4 font-display text-lg font-extrabold text-ink-900 outline-none placeholder:font-body placeholder:text-base placeholder:font-normal placeholder:text-ink-300 focus:border-sky-400"
          />
        </Field>

        <Field label="小提示（可以不填）" emoji="💬">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="比如：字要写工整哦"
            className="min-h-[52px] w-full rounded-2xl border-[3px] border-ink-100 bg-white px-4 text-base text-ink-900 outline-none placeholder:text-ink-300 focus:border-sky-400"
          />
        </Field>

        {/* ---------- 分类 ---------- */}
        <Field label="属于哪一类" emoji="🎨">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORY_ORDER.map((c) => {
              const s = CATEGORY[c]
              const on = category === c
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={clsx(
                    'btn-3d active:btn-3d-press flex min-h-[64px] flex-col items-center justify-center gap-0.5 border-[3px]',
                    on
                      ? clsx(s.border, s.soft, 'scale-[1.02]')
                      : 'border-ink-100 bg-white shadow-[0_4px_0_0_var(--color-ink-100)]',
                  )}
                  style={on ? { boxShadow: '0 4px 0 0 rgb(61 47 36 / 0.18)' } : undefined}
                >
                  <span className={clsx('text-2xl', on && 'anim-pop')}>{s.emoji}</span>
                  <span className={clsx('text-xs font-extrabold', on ? s.ink : 'text-ink-700')}>
                    {s.label}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        {/* ---------- 周期 ---------- */}
        <Field label="多久做一次" emoji="🔁">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {CYCLES.map((c) => {
              const on = cycle === c
              return (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={clsx(
                    'btn-3d active:btn-3d-press min-h-[48px] shrink-0 rounded-pill border-[3px] px-4 font-display text-sm font-extrabold',
                    on
                      ? 'border-grape-500 bg-grape-400 text-white shadow-[0_4px_0_0_var(--color-grape-500)]'
                      : 'border-ink-100 bg-white text-ink-700 shadow-[0_4px_0_0_var(--color-ink-100)]',
                  )}
                >
                  {CYCLE_LABEL[c]}
                </button>
              )
            })}
          </div>
        </Field>

        {/* ---------- 数值 ---------- */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="计划时长" emoji="⏰">
            <NumberStepper
              value={plannedMinutes}
              onChange={setPlannedMinutes}
              step={5}
              min={1}
              max={600}
              suffix="分"
            />
          </Field>
          <Field label="基础积分" emoji="🪙">
            <NumberStepper
              value={basePoints}
              onChange={setBasePoints}
              step={5}
              min={0}
              max={9999}
              suffix="分"
            />
          </Field>
        </div>

        <p className="-mt-2 text-xs text-ink-500">按时完成，最高可拿 {preview.onTime.points} 分</p>

        <Field label="做得好额外奖励" emoji="✨">
          <NumberStepper
            value={qualityBonusPoints}
            onChange={setQualityBonusPoints}
            step={1}
            min={0}
            max={999}
            suffix="分"
          />
        </Field>

        {/* ---------- 三个规则开关 ---------- */}
        <div className="space-y-3">
          <p className="font-display text-sm font-extrabold text-ink-900">规则（决定怎么算分）</p>

          <SwitchRow
            emoji="⏳"
            title="允许超时结算"
            on={allowOvertime}
            onChange={setAllowOvertime}
            onText="超时按比例扣分，超出一倍才 0 分"
            offText="超时就没有积分（严格限时）"
          />
          <SwitchRow
            emoji="🕊️"
            title="超期不扣分"
            on={allowLateNoPenalty}
            onChange={setAllowLateNoPenalty}
            onText="不管多久完成，都给满分"
            offText="超过时间会按规则扣分"
          />
          <SwitchRow
            emoji="🌟"
            title="质量评分"
            on={qualityRated}
            onChange={setQualityRated}
            onText="完成得好可以拿额外积分"
            offText="只按时间算分，不用评级"
          />
        </div>

        {/* ---------- 实时规则预览（由 settle() 计算） ---------- */}
        <div className="card-cartoon overflow-hidden border-[3px] border-sky-300 bg-sky-50 p-4">
          <p className="font-display text-sm font-extrabold text-ink-900">
            📊 这条任务的算分方式
          </p>
          <div className="mt-3 space-y-2">
            <PreviewRow
              emoji="✅"
              label={`按时完成（≤ ${humanizeMinutes(plannedMinutes)}）`}
              points={preview.onTime.points}
              tone="grass"
            />
            <PreviewRow
              emoji="⏰"
              label={`超出 50%（约 ${humanizeMinutes(plannedMinutes * 1.5)}）`}
              points={preview.half.points}
              tone="tangerine"
            />
            <PreviewRow
              emoji="😅"
              label={`超出一倍（${humanizeMinutes(plannedMinutes * 2)}）`}
              points={preview.double.points}
              tone="berry"
            />
            <PreviewRow
              emoji="🤷"
              label="忘记计时 / 没有用时记录"
              points={preview.late.points}
              tone="ink"
            />
          </div>
          <p className="mt-3 text-xs font-bold leading-snug text-ink-700">
            {preview.onTime.points > 0
              ? `按时做最多拿 ${preview.onTime.points} 分${
                  qualityRated && qualityBonusPoints > 0 ? `（已包含质量奖励 ${qualityBonusPoints} 分）` : ''
                }`
              : '这条任务没有基础积分，主要用于打卡习惯'}
          </p>
        </div>

        {/* ---------- 周期目标次数 ---------- */}
        {(cycle === 'weekly' || cycle === 'monthly' || cycle === 'yearly') && (
          <Field
            label={cycle === 'weekly' ? '本周要做几次' : cycle === 'monthly' ? '本月要做几次' : '今年要做几次'}
            emoji="🎯"
          >
            <NumberStepper
              value={checkInTargetCount}
              onChange={setCheckInTargetCount}
              step={1}
              min={1}
              max={366}
              suffix="次"
            />
          </Field>
        )}

        {/* ---------- 签到模式 ---------- */}
        <div className="space-y-3">
          <SwitchRow
            emoji="📅"
            title="开启签到模式"
            on={checkInEnabled}
            onChange={setCheckInEnabled}
            onText="每天来打个卡，攒够天数给大奖励"
            offText="只按普通任务算分"
          />

          {checkInEnabled && (
            <div className="anim-fade-in space-y-3 rounded-2xl border-[3px] border-sun-300 bg-sun-50 p-3">
              <Field label="一共要签到几天" emoji="🎯">
                <NumberStepper
                  value={checkInTargetCount}
                  onChange={setCheckInTargetCount}
                  step={1}
                  min={1}
                  max={366}
                  suffix="天"
                />
              </Field>
              <div>
                <p className="mb-1.5 text-xs font-extrabold text-ink-700">坚持的奖励阶梯</p>
                <div className="space-y-1.5">
                  {tiers.map((t) => (
                    <div
                      key={t.days}
                      className="flex items-center gap-2 rounded-xl border-2 border-white bg-white/80 px-3 py-2"
                    >
                      <span className="tnum font-display text-lg font-extrabold text-sun-600">
                        {t.days}
                      </span>
                      <span className="text-xs font-bold text-ink-500">天</span>
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink-700">
                        {t.label}
                      </span>
                      {t.itemId && <span aria-hidden className="text-base">{REWARD[t.itemId] ?? '🎁'}</span>}
                      <span className="tnum shrink-0 rounded-pill bg-sun-200 px-2 py-0.5 text-xs font-extrabold text-sun-700">
                        +{t.points}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ---------- 奖励道具 ---------- */}
        <Field label="完成后掉落（选填）" emoji="🎁">
          <div className="grid grid-cols-4 gap-2">
            {ITEMS.map((it) => {
              const on = rewardItemIds.includes(it.id)
              return (
                <button
                  key={it.id}
                  onClick={() =>
                    setRewardItemIds((prev) =>
                      on ? prev.filter((x) => x !== it.id) : [...prev, it.id],
                    )
                  }
                  title={`${it.name} · ${it.desc}`}
                  className={clsx(
                    'btn-3d active:btn-3d-press flex min-h-[58px] flex-col items-center justify-center gap-0.5 border-[3px] px-1',
                    on
                      ? 'border-grape-500 bg-grape-100 shadow-[0_4px_0_0_var(--color-grape-500)]'
                      : 'border-ink-100 bg-white shadow-[0_4px_0_0_var(--color-ink-100)]',
                  )}
                >
                  <span className={clsx('text-xl', on && 'anim-pop')}>{it.emoji}</span>
                  <span className="w-full truncate text-[10px] font-bold text-ink-700">
                    {it.name}
                  </span>
                </button>
              )
            })}
          </div>
        </Field>

        {/* ---------- 固定任务 ---------- */}
        <div className="space-y-3">
          <p className="font-display text-sm font-extrabold text-ink-900">固定任务</p>
          <SwitchRow
            emoji="📌"
            title="这是家里的固定任务"
            on={fixed}
            onChange={setFixed}
            onText="长期不变的家规（刷牙、练琴、收拾玩具…），会固定排在今天的列表里"
            offText="普通任务，做完就可以不管了"
          />
          {fixed && (
            <p className="anim-fade-in rounded-2xl border-2 border-sun-300 bg-sun-50 px-3 py-2 text-xs font-bold leading-snug text-ink-700">
              📌 固定任务建议选「每天 / 每周」这种周期，孩子打开 App 就能看到，
              不用你每天手动加一遍。
            </p>
          )}
        </div>

        {err && (
          <p className="anim-bounce-in rounded-2xl border-2 border-berry-300 bg-berry-100 px-4 py-3 text-sm font-extrabold text-berry-500">
            {err}
          </p>
        )}

        <div className="flex gap-3">
          <Btn tone="white" size="lg" full onClick={onClose}>
            先不弄
          </Btn>
          <Btn tone="grass" size="lg" full onClick={handleSave}>
            {editing ? '保存修改 ✅' : '创建任务 🎉'}
          </Btn>
        </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

/* ---------------- 表单基元 ---------------- */

function Field({
  label,
  emoji,
  children,
}: {
  label: string
  emoji?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1 font-display text-sm font-extrabold text-ink-900">
        {emoji && <span aria-hidden>{emoji}</span>}
        {label}
      </p>
      {children}
    </div>
  )
}

function NumberStepper({
  value,
  onChange,
  step,
  min,
  max,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  step: number
  min: number
  max: number
  suffix?: string
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => onChange(clamp(value - step))}
        aria-label="减少"
        className="btn-3d active:btn-3d-press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[3px] border-ink-100 bg-white shadow-[0_4px_0_0_var(--color-ink-100)]"
      >
        <span className="font-display text-lg font-extrabold text-ink-900">−</span>
      </button>
      <div className="min-w-0 flex-1 rounded-2xl border-[3px] border-ink-100 bg-white px-2 py-1 text-center">
        <input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
          className="tnum w-full bg-transparent text-center font-display text-xl font-extrabold text-ink-900 outline-none"
        />
        {suffix && <span className="-mt-1 block text-[10px] font-bold text-ink-500">{suffix}</span>}
      </div>
      <button
        onClick={() => onChange(clamp(value + step))}
        aria-label="增加"
        className="btn-3d active:btn-3d-press flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-[3px] border-ink-100 bg-white shadow-[0_4px_0_0_var(--color-ink-100)]"
      >
        <span className="font-display text-lg font-extrabold text-ink-900">＋</span>
      </button>
    </div>
  )
}

function SwitchRow({
  emoji,
  title,
  on,
  onChange,
  onText,
  offText,
}: {
  emoji: string
  title: string
  on: boolean
  onChange: (v: boolean) => void
  onText: string
  offText: string
}) {
  return (
    <button
      onClick={() => onChange(!on)}
      aria-pressed={on}
      className={clsx(
        'btn-3d active:btn-3d-press flex w-full items-center gap-3 border-[3px] p-3 text-left',
        on
          ? 'border-grass-400 bg-grass-100 shadow-[0_4px_0_0_var(--color-grass-400)]'
          : 'border-ink-100 bg-white shadow-[0_4px_0_0_var(--color-ink-100)]',
      )}
    >
      <span className={clsx('text-2xl', on && 'anim-pop')}>{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-extrabold text-ink-900">{title}</span>
        <span className="block text-xs font-bold leading-snug text-ink-500">
          {on ? onText : offText}
        </span>
      </span>
      {/* 卡通拨杆 */}
      <span
        className={clsx(
          'relative h-8 w-14 shrink-0 rounded-full border-[3px] transition-colors',
          on ? 'border-grass-600 bg-grass-400' : 'border-ink-300 bg-ink-100',
        )}
      >
        <span
          className={clsx(
            'absolute top-[2px] h-[22px] w-[22px] rounded-full border-2 border-ink-900/10 bg-white shadow-sm transition-all',
            on ? 'left-[26px]' : 'left-[2px]',
          )}
        />
      </span>
    </button>
  )
}

function PreviewRow({
  emoji,
  label,
  points,
  tone,
}: {
  emoji: string
  label: string
  points: number
  tone: 'grass' | 'tangerine' | 'berry' | 'ink'
}) {
  const tones: Record<string, string> = {
    grass: 'text-grass-600',
    tangerine: 'text-tangerine-500',
    berry: 'text-berry-500',
    ink: 'text-ink-500',
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border-2 border-white bg-white/80 px-3 py-2">
      <span aria-hidden className="text-base">{emoji}</span>
      <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink-700">{label}</span>
      <span className={clsx('tnum font-display text-lg font-extrabold', tones[tone])}>
        {points}
        <span className="ml-0.5 text-[10px] text-ink-500">分</span>
      </span>
    </div>
  )
}

/** 与 catalog.ITEMS 对齐的奖励 emoji（仅用于阶梯展示） */
const REWARD: Record<string, string> = {
  sticker: '🌟',
  medal: '🏅',
  gem: '💎',
  'golden-coin': '🪙',
  'lucky-star': '⭐',
  fertilizer: '💩',
}
