import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAccount, type BindReason } from '@/store/useAccount'
import { deviceIdPersisted } from '@/api/device'
import { BottomSheet } from '../farm/farmUi'
import { markNudged } from './guestPrompt'

/* ============================================================
   保存进度 · 绑定手机号（2026-11-03）
   ------------------------------------------------------------
   游客账号的问题只有一个：**东西会丢**。换手机、清数据、卸载重装，
   这台设备上的一切就都没了 —— 而 App 里看不出来任何征兆。

   这一屏就是把「临时」变成「真的」的那一步。服务端只往**同一个 uid**
   上加手机号，所以绑完积分、农场、存档、家长设置全都在原地。

   ## 三个入口，一套面板

     · 花兑换券被服务端拦住（`reason === 'coupon'`）—— 关不掉
     · 第 3 次启动时的温和提醒（`'launch'`）—— 可以关
     · 自己点横条 / 家长区（`'manual'`）—— 当然可以关

   为什么关掉按钮在 `coupon` 时不出现：那一步服务端**不会**放行，
   给个「以后再说」只会让人以为关掉就能兑换，然后反复试、反复失败。

   ## 密码是可选的

   绑手机号之后用「手机号 + 验证码」就能登回来（服务端 `SmsLogin` 支持
   已有账号免密登录）。但验证码要等短信，家长更愿意用密码 —— 所以这里
   留一个可选密码框，填了以后两种都能登。
   ============================================================ */

const REASON_TITLE: Record<BindReason, string> = {
  coupon: '先绑定手机号，才能兑换',
  launch: '把进度存到账号里',
  manual: '保存这台手机的进度',
}

export function BindSheet() {
  const open = useAccount((s) => s.bindSheet.open)
  const reason = useAccount((s) => s.bindSheet.reason)
  const close = useAccount((s) => s.closeBind)
  const busy = useAccount((s) => s.busy)
  const error = useAccount((s) => s.error)
  const bindMobile = useAccount((s) => s.bindMobile)
  const sendCode = useAccount((s) => s.sendCode)

  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [hint, setHint] = useState<string | null>(null)

  useEffect(() => {
    if (countdown <= 0) return
    const t = window.setTimeout(() => setCountdown((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [countdown])

  /* 关掉就清干净：手机号留着没意义（这是要绑的新号），
     密码和验证码更不能留在输入框里。 */
  useEffect(() => {
    if (open) return
    setCode('')
    setPassword('')
    setHint(null)
  }, [open])

  const mobileOk = /^\d{6,}$/.test(mobile.trim())
  const canSubmit = mobileOk && /^\d{6}$/.test(code.trim()) && !busy

  const dismiss = () => {
    /* ★ 关掉就算「提醒过了」，以后不再主动弹。
       只有 `coupon` 不记 —— 那不是提醒，是解释；下次花券还会再弹。 */
    if (reason && reason !== 'coupon') markNudged()
    close()
  }

  const submit = async () => {
    if (!canSubmit) return
    const ok = await bindMobile(mobile, code, password.trim() || undefined)
    if (ok) {
      markNudged()
      setMobile('')
      setCode('')
      setPassword('')
    }
  }

  const onSendCode = async () => {
    if (!mobileOk || countdown > 0 || busy) return
    const ok = await sendCode(mobile, 'bind_mobile')
    if (ok) {
      setCountdown(60)
      setHint('验证码已发出。本地调试时它不会进短信，在服务端日志里找「DEV SMS CODE」。')
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={dismiss}
      emoji="🔖"
      title={REASON_TITLE[reason ?? 'manual']}
    >
      <div className="space-y-3 pb-4" data-bind-sheet>
        <p className="rounded-2xl bg-sun-50 px-3 py-2 text-[11.5px] font-bold leading-relaxed text-ink-700">
          现在用的是<b>临时账号</b>：积分、兑换券、农场和存档都只在
          {deviceIdPersisted() ? '这台手机上' : '这一次运行里'}。
          {reason === 'coupon'
            ? '兑换要用兑换券，得先把账号存下来 —— 绑完就能继续。'
            : '换手机、清数据、卸载重装，这些就都找不回来了。'}
        </p>

        <label className="block">
          <span className="text-[11px] font-extrabold text-ink-500">手机号</span>
          <input
            data-bind-mobile
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/[^\d]/g, '').slice(0, 20))}
            placeholder="13800138000"
            className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-3 text-base font-bold text-ink-900 outline-none focus:border-grape-400"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-extrabold text-ink-500">验证码</span>
          <div className="mt-1 flex gap-2">
            <input
              data-bind-code
              type="tel"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="6 位数字"
              className="min-w-0 flex-1 rounded-xl border border-ink-900/10 bg-white px-3 py-3 text-base font-bold text-ink-900 outline-none focus:border-grape-400"
            />
            <button
              type="button"
              onClick={() => void onSendCode()}
              disabled={!mobileOk || countdown > 0 || busy}
              data-bind-send-code
              className="shrink-0 rounded-xl border border-grape-500/30 bg-white px-3 text-[12px] font-extrabold text-grape-500 disabled:opacity-40"
            >
              {countdown > 0 ? `${countdown}s` : '获取验证码'}
            </button>
          </div>
        </label>

        <label className="block">
          <span className="text-[11px] font-extrabold text-ink-500">
            设个密码（可以不填）
          </span>
          <input
            data-bind-password
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value.slice(0, 64))}
            placeholder="填了以后换手机也能用密码登"
            className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-3 text-base font-bold text-ink-900 outline-none focus:border-grape-400"
          />
          {password.length > 0 && password.length < 6 && (
            <span className="mt-1 block text-[11px] font-bold text-berry-500">
              密码至少 6 位，不够会绑不上
            </span>
          )}
        </label>

        {(error || hint) && (
          <p
            data-bind-error={error ? '' : undefined}
            className={clsx(
              'rounded-xl px-3 py-2 text-[11.5px] font-bold leading-relaxed',
              error ? 'bg-berry-50 text-berry-500' : 'bg-grass-50 text-grass-700',
            )}
          >
            {error || hint}
          </p>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          data-bind-submit
          className="btn min-h-[48px] w-full rounded-2xl bg-grape-400 font-display text-base font-extrabold text-white active:btn-press disabled:opacity-40"
        >
          {busy ? '请稍候…' : '绑定并保存进度'}
        </button>

        {/* ★ `coupon` 不给「以后再说」：那一步服务端不放行，
            给个退路只会让人以为关掉就能兑换。 */}
        {reason !== 'coupon' && (
          <button
            type="button"
            onClick={dismiss}
            data-bind-later
            className="w-full py-1 text-center text-[12px] font-bold text-ink-500 underline decoration-dotted"
          >
            以后再说
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
