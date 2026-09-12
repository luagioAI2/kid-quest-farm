import { useCallback, useState } from 'react'
import { useApp } from '../../store/useApp'

/* ============================================================
   家长密码闸门（可复用）
   ------------------------------------------------------------
   三处需要它：
   1. 审核孩子提交的任务（打分 + 确认奖励）
   2. 新增 / 编辑固定任务
   3. 新增 / 编辑兑换品

   设计要点：
   * 没设密码 → 视为不设防，直接放行（家长可以用"保护开关"额外加固）
   * 密码错误 → 轻微震动式抖动反馈 + 清空，不做惩罚性锁定
   * 组件自持有 unlocked 状态，不往 store 里塞 —— 避免"解锁一次永久解锁"
   ============================================================ */

export function useParentGate() {
  const settings = useApp((s) => s.settings)
  const [unlocked, setUnlocked] = useState(false)

  /** 是否需要密码：设了 PIN 且打开了「保护家长操作」 */
  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  const verify = useCallback(
    (pin: string) => {
      const ok = pin === settings.parentPin
      if (ok) setUnlocked(true)
      return ok
    },
    [settings.parentPin],
  )

  const lock = useCallback(() => setUnlocked(false), [])

  return {
    /** 是否需要输密码 */
    needsPin,
    /** 是否已经通过（没设密码时恒为 true） */
    passed: !needsPin || unlocked,
    verify,
    lock,
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
              'btn-3d rounded-2xl py-4 text-xl font-extrabold shadow-cartoon-sm disabled:opacity-50 ' +
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
 * 密码输入面板 —— 直接内联在需要的地方。
 *
 * @param title   标题，如「请家长确认」
 * @param hint    副标题，说明为什么需要密码
 * @param onPass  验证通过后的回调
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
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const submit = useCallback(
    (finalValue?: string) => {
      // finalValue 来自 PinPad 的第 4 次点击：那时 state 还没更新，
      // 必须用传进来的值，否则永远读到最后一位之前的状态。
      const candidate = finalValue ?? pin
      if (candidate.length < 4) return
      if (candidate === settings.parentPin) {
        onPass()
      } else {
        setError(true)
        setPin('')
        setTimeout(() => setError(false), 900)
      }
    },
    [pin, settings.parentPin, onPass],
  )

  return (
    <div className={'space-y-5 ' + (error ? 'anim-wiggle' : '')}>
      <div className="text-center">
        <div className="text-5xl">🔒</div>
        <h3 className="mt-2 font-display text-xl font-extrabold text-ink-900">{title}</h3>
        {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
        {error && (
          <p className="mt-2 text-sm font-bold text-berry-500 anim-fade-in">
            密码不对，再试一次？
          </p>
        )}
      </div>
      <PinPad value={pin} onChange={setPin} onSubmit={submit} />
      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full rounded-2xl py-3 text-base font-bold text-ink-500"
        >
          先算了
        </button>
      )}
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
  const { needsPin, passed, verify } = useParentGate()

  if (!needsPin || passed) return <>{children}</>

  return (
    <ParentPinPanel
      title={title}
      hint={hint}
      onPass={() => verify(useApp.getState().settings.parentPin ?? '')}
      onCancel={onCancel}
    />
  )
}
