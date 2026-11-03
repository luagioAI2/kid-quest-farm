import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAccount, type BindReason } from '@/store/useAccount'
import { MOBILE_ALREADY_REG } from '@/api/client'
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

   ## 密码必填，验证码可选（2026-11-03 改）

   原来反着：验证码必填、密码可选。但**生产环境还没有短信通道**
   （`DevSmsSender` 在 `IsProduction()` 下直接返回错误），
   验证码根本发不到手机上 ⇒ 「必须填验证码」等于「永远绑不上」，
   游客攒的东西一辈子存不下来。

   现在：验证码**有就填、没有也能存**；密码**必填**。
   两者分工是清楚的 —— 验证码证明「这个号是你的」，密码是「以后怎么回来」。
   两个都不给，这个账号换台手机就永久丢了，而且丢的时候不会有任何提示。
   服务端同样拦这一条（`bind-need-password`），不只是界面上的约束。
   ============================================================ */

const REASON_TITLE: Record<BindReason, string> = {
  coupon: '先绑定手机号，才能兑换',
  launch: '把进度存到账号里',
  manual: '保存这台手机的进度',
}

export function BindSheet({
  onGoLogin,
}: {
  /**
   * 「这个号码已经有账号了」时，请 App 打开登录面板（并把号码带过去）。
   *
   * 为什么不在这个组件里自己开登录面板：`LoginSheet` 的开关是 App 的局部
   * state（`loginOpen`），从这里再开一份就是**两个登录面板**，各有各的输入框，
   * 用户点哪一个都对，但看起来像 bug。
   */
  onGoLogin?: (mobile: string) => void
} = {}) {
  const open = useAccount((s) => s.bindSheet.open)
  const reason = useAccount((s) => s.bindSheet.reason)
  const close = useAccount((s) => s.closeBind)
  const busy = useAccount((s) => s.busy)
  const error = useAccount((s) => s.error)
  const errorCode = useAccount((s) => s.errorCode)
  const bindMobile = useAccount((s) => s.bindMobile)
  const sendCode = useAccount((s) => s.sendCode)

  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [hint, setHint] = useState<string | null>(null)
  /**
   * 上一次提交时输入框里的号码。
   *
   * 为什么要单独记：失败之后用户可能**改号码**，而错误码还是上一次那个。
   * 不记的话，按钮会跟着新号码变（「用 139… 登录」），可那个号根本没被占用 ——
   * 一句看着很像真的假话。改成「按钮上的号 == 输入框里的号」时才显示。
   */
  const [attemptedMobile, setAttemptedMobile] = useState('')

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
  /* 验证码可以留空（生产环境还没有短信通道）；填了就必须是 6 位。 */
  const codeOk = code.trim() === '' || /^\d{6}$/.test(code.trim())
  const passwordOk = password.trim().length >= 6
  const canSubmit = mobileOk && codeOk && passwordOk && !busy

  const dismiss = () => {
    /* ★ 关掉就算「提醒过了」，以后不再主动弹。
       只有 `coupon` 不记 —— 那不是提醒，是解释；下次花券还会再弹。 */
    if (reason && reason !== 'coupon') markNudged()
    close()
  }

  /* ★ 号码被占用 = 死胡同，必须改口。
     不处理的话，用户看到的是一行红字「该手机号已注册」：绑不上 ⇒ 攒的东西
     存不下来；那个号码上原本的账号也进不去（界面上没有任何入口）。
     这是游客绑定最常见的失败 —— 家长以前在别的手机上玩过。 */
  const taken =
    !!error && errorCode === MOBILE_ALREADY_REG && attemptedMobile === mobile.trim()

  const goLogin = () => {
    const m = attemptedMobile
    close()
    onGoLogin?.(m)
  }

  const submit = async () => {
    if (!canSubmit) return
    setAttemptedMobile(mobile.trim())
    const ok = await bindMobile(mobile, code, password.trim())
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
          <span className="text-[11px] font-extrabold text-ink-500">验证码（收不到也能存）</span>
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
            设个密码（必填）
          </span>
          <input
            data-bind-password
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value.slice(0, 64))}
            placeholder="换台手机靠它登回来"
            className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-3 text-base font-bold text-ink-900 outline-none focus:border-grape-400"
          />
          {password.length > 0 && password.length < 6 && (
            <span className="mt-1 block text-[11px] font-bold text-berry-500">
              密码至少 6 位
            </span>
          )}
        </label>

        {taken && (
          <div
            data-bind-taken
            className="rounded-xl bg-berry-50 px-3 py-2 text-[11.5px] font-bold leading-relaxed text-berry-500"
          >
            <p>这个号码上已经有一个账号了 —— 可能是你以前在别的手机上玩过。</p>
            <p className="mt-1 text-ink-700">
              用它可以登回来。但这台手机上刚攒的进度
              <b>不会跟过去</b>（它还留在现在这个临时账号里）。
            </p>
            <button
              type="button"
              onClick={goLogin}
              data-bind-gologin
              className="mt-2 w-full rounded-xl bg-berry-500 px-3 py-2 text-[12.5px] font-extrabold text-white active:btn-press"
            >
              用 {attemptedMobile} 登录
            </button>
          </div>
        )}

        {!taken && (error || hint) && (
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
