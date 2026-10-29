import { useCallback, useState } from 'react'
import { useApp } from '../../store/useApp'

/* ============================================================
   家长密码闸门（可复用）
   ------------------------------------------------------------
   三处需要它：
   1. 审核孩子提交的任务（打分 + 确认奖励）
   2. 新增 / 编辑任务
   3. 新增 / 编辑兑换品

   设计要点：
   * **没设密码 = 还没设过，不是不设防**（2026-10-30 改）。保护开着时
     一律过闸门：已有密码就输，没有就当场设一个（输两遍）。
     用户原话：「新号不要在引导前就要求设置家长密码，需要用的时候才要求
     第一次设置。」
   * 密码错误 → 轻微抖动反馈 + 清空，不做惩罚性锁定
   * 组件自持有 unlocked 状态，不往 store 里塞 —— 避免"解锁一次永久解锁"
   ============================================================ */

/**
 * 闸门当前是哪种状态：
 * - `open`   保护关着（家长在设置里关掉了「保护家长操作」），直接放行
 * - `verify` 已有密码，要输对才放行
 * - `setup`  还没设过密码 —— **第一次用到时才要求设**，设完直接放行
 */
export type PinGateMode = 'open' | 'verify' | 'setup'

export function useParentGate() {
  const settings = useApp((s) => s.settings)
  const [unlocked, setUnlocked] = useState(false)

  const protectionOn = settings.protectParentActions !== false
  const hasPin = !!settings.parentPin
  const mode: PinGateMode = !protectionOn ? 'open' : hasPin ? 'verify' : 'setup'

  const verify = useCallback(
    (pin: string) => {
      const ok = pin === settings.parentPin
      if (ok) setUnlocked(true)
      return ok
    },
    [settings.parentPin],
  )

  const lock = useCallback(() => setUnlocked(false), [])
  /** 直接放行（用于「第一次设密码」：刚设完，没必要再拿它比一遍） */
  const unlock = useCallback(() => setUnlocked(true), [])

  return {
    mode,
    /** 要不要过闸门（`open` 之外都要） */
    needsPin: mode !== 'open',
    /** 是否已经通过 */
    passed: mode === 'open' || unlocked,
    verify,
    lock,
    unlock,
  }
}

/** 数字键盘 + 圆点指示器 */
export function PinPad({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: (finalValue?: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={
              'h-4 w-4 rounded-full ' + (i < value.length ? 'bg-sun-500' : 'bg-ink-300')
            }
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '确定'].map((k) => (
          <button
            key={k}
            disabled={disabled}
            onClick={() => {
              if (k === '清空') onChange('')
              else if (k === '确定') onSubmit()
              else if (value.length < 4) {
                const next = value + k
                onChange(next)
                // 第 4 位要自动提交。
                //
                // ⚠️ 必须把 next 传下去，不能只调 onSubmit()：
                // 这里读到的 value 还是本次点击时的旧值（3 位），
                // 而 setPin 还没触发重渲染，所以 onSubmit 里看到的 pin
                // 依然是 3 位，会被 `pin.length < 4` 直接 return 掉 ——
                // 表现就是"密码输对了却完全没反应"。
                if (next.length === 4) onSubmit(next)
              }
            }}
            className={
              'btn rounded-2xl py-4 text-xl font-extrabold shadow-flat disabled:opacity-50 ' +
              (k === '确定' ? 'bg-grass-400 text-ink-900' : 'bg-white text-ink-900')
            }
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 键盘本体：自己判断「输密码」还是「第一次设密码」。
 *
 * 不带头图 / 标题 —— 外面可能是 `ParentPinPanel`（弹层里，有 🔒 和大标题），
 * 也可能直接塞进设置页的 `Card`（卡片已经有标题了，再来一个就重复）。
 *
 * ## 为什么「设密码」要输两遍
 *
 * 项目**没有找回入口**。家长手滑输错一位、自己又没记住，就再也进不去
 * 家长区（打不了分、改不了任务）。多一步确认远比事后救火便宜。
 */
export function PinFlow({
  onPass,
  onCancel,
  cancelLabel = '先算了',
}: {
  onPass: () => void
  onCancel?: () => void
  cancelLabel?: string
}) {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const hasPin = !!settings.parentPin

  const [pin, setPin] = useState('')
  /** 设密码时第一遍输入的值；`null` = 还没输过第一遍 */
  const [first, setFirst] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = useCallback(
    async (finalValue?: string) => {
      // finalValue 来自 PinPad 的第 4 次点击：那时 state 还没更新，
      // 必须用传进来的值，否则永远读到最后一位之前的状态。
      const v = finalValue ?? pin
      if (v.length < 4 || busy) return

      if (hasPin) {
        if (v === settings.parentPin) {
          onPass()
        } else {
          setError('密码不对，再试一次？')
          setPin('')
        }
        return
      }

      // 还没设过：第一遍 → 第二遍确认 → 落库 → 放行
      if (first == null) {
        setFirst(v)
        setPin('')
        setError('')
        return
      }
      if (v !== first) {
        setError('两次不一样，重新设一次吧')
        setFirst(null)
        setPin('')
        return
      }
      setBusy(true)
      await updateSettings({ parentPin: v })
      setBusy(false)
      onPass()
    },
    [pin, busy, hasPin, settings.parentPin, first, updateSettings, onPass],
  )

  const stage = hasPin ? '' : first == null ? '设一个 4 位数字' : '再输一次，确认没记错'

  return (
    <div className="space-y-4">
      {stage && (
        <p className="text-center text-sm font-extrabold text-ink-700">{stage}</p>
      )}
      <PinPad value={pin} onChange={setPin} onSubmit={(v) => void submit(v)} disabled={busy} />
      {error && (
        <p className="text-center text-sm font-bold text-berry-500 anim-fade-in">{error}</p>
      )}
      {!hasPin && (
        <p className="text-center text-xs font-bold leading-relaxed text-ink-500">
          这个密码<span className="text-berry-500">没有找回入口</span>，记牢一点。
        </p>
      )}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full rounded-2xl py-3 text-base font-bold text-ink-500"
        >
          {cancelLabel}
        </button>
      )}
    </div>
  )
}

/**
 * 带 🔒 头和标题的整块面板（弹层里用）。
 *
 * @param title   标题，如「请家长确认」（只在「输密码」时用）
 * @param hint    副标题，说明为什么需要密码
 * @param onPass  验证 / 设置完成后的回调
 * @param onCancel 取消
 */
export function ParentPinPanel({
  title = '请爸爸妈妈来一下',
  hint,
  onPass,
  onCancel,
}: {
  title?: string
  hint?: string
  onPass: () => void
  onCancel?: () => void
}) {
  const settings = useApp((s) => s.settings)
  const hasPin = !!settings.parentPin

  /* 第一次用家长区时，标题不能还是「请爸爸妈妈来一下 / 审核需要密码」——
     那会让人以为要输一个**已有的**密码，而键盘其实在让他设新的。 */
  const headTitle = hasPin ? title : '先设一个家长密码'
  const headHint = hasPin
    ? hint
    : '第一次进家长区，设一个 4 位数字。以后每次进来都要输它。'

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="text-5xl">{hasPin ? '🔒' : '🔑'}</div>
        <h3 className="mt-2 font-display text-xl font-extrabold text-ink-900">{headTitle}</h3>
        {headHint && <p className="mt-1 text-sm text-ink-500">{headHint}</p>}
      </div>
      <PinFlow onPass={onPass} onCancel={onCancel} />
    </div>
  )
}

/**
 * 包一层：需要密码时先显示密码面板，通过后渲染 children。
 *
 * 用法：
 * ```tsx
 * <ParentGate hint="审核需要爸爸妈妈确认">
 *   <ReviewSheet ... />
 * </ParentGate>
 * ```
 */
export function ParentGate({
  title,
  hint,
  children,
  onCancel,
}: {
  title?: string
  hint?: string
  children: React.ReactNode
  onCancel?: () => void
}) {
  const { needsPin, passed, unlock } = useParentGate()

  if (!needsPin || passed) return <>{children}</>

  return (
    <ParentPinPanel
      title={title}
      hint={hint}
      /* 用 `unlock` 而不是「拿刚设的密码再 verify 一遍」：
         设完那一刻 store 可能还没刷新，`verify(旧值)` 会判失败，
         表现就是「设了密码却进不去」。 */
      onPass={unlock}
      onCancel={onCancel}
    />
  )
}
