import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAccount } from '@/store/useAccount'
import { BottomSheet } from '../farm/farmUi'

/* ============================================================
   登录 / 注册（2026-10-29，在线版第一步）
   ------------------------------------------------------------
   为什么要登录：招商、心愿、兑换这些要「审核 / 分账」的事，
   服务端得知道是谁。用户原话：「点申请即可…**因为会根据当前账号，申请**。」

   ## 验证码：注册可以不填，重设密码必须填（2026-11-03 改）

   原来注册要 `code`（服务端 `binding:"required,len=6"`），而生产环境**根本没有
   短信通道**（`DevSmsSender` 在 `IsProduction()` 下直接返回错误）——
   等于「永远注册不了」。现在服务端改成可选，这里跟着放宽：

     · 注册：验证码可以不填，密码必填（它就是「以后怎么回来」那条路）；
     · 重设密码：**必须填** —— 那条路唯一的凭证就是码，放开等于谁都能改密码。

   ⚠️ 别为了好测加「跳过验证码」的开关：那等于线上也能跳过。
   ⚠️ 服务端**没填码时 `mobile_verified = false`**，后台能一眼挑出来补验。

   ## 为什么用 BottomSheet 而不是整页

   它随时可能从设置页或招商页弹出来，弹完要**回到原来那一屏**。
   做成整页就得自己写「从哪来的、回哪去」。
   ============================================================ */

export function LoginSheet({
  open,
  onClose,
  defaultMode = 'login',
}: {
  open: boolean
  onClose: () => void
  /** 从「注册」进来的场景（比如首次使用）可以直接开在注册态 */
  defaultMode?: 'login' | 'register'
}) {
  /**
   * `reset` = 忘记密码。
   *
   * 加它的原因：服务端 `/api/auth/reset-password` 一直在，客户端却**没有入口**
   * —— 家长忘了密码就永久进不去，兑换码和招商申请全废，而且没有任何自救路径。
   * 密码是爸妈自己设的，不像手机号那样能找回来。
   */
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(defaultMode)
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [hint, setHint] = useState<string | null>(null)

  const session = useAccount((s) => s.session)
  const ensureGuest = useAccount((s) => s.ensureGuest)
  const busy = useAccount((s) => s.busy)
  const error = useAccount((s) => s.error)
  const login = useAccount((s) => s.login)
  const register = useAccount((s) => s.register)
  const resetPassword = useAccount((s) => s.resetPassword)
  const sendCode = useAccount((s) => s.sendCode)

  // 倒计时：60 秒内不许重复发（服务端另有 10 次/分钟的限流，这里只是别让人瞎点）
  useEffect(() => {
    if (countdown <= 0) return
    const t = window.setTimeout(() => setCountdown((n) => n - 1), 1000)
    return () => window.clearTimeout(t)
  }, [countdown])

  // 关掉再打开要回到干净状态：手机号可以留（同一台设备大概率同一个人），
  // 但密码/验证码不能留 —— 那是别人的手可能碰到的位置
  useEffect(() => {
    if (!open) {
      setPassword('')
      setCode('')
      setHint(null)
      setMode(defaultMode)
    }
  }, [open, defaultMode])

  const mobileOk = /^\d{6,}$/.test(mobile.trim())
  /* 验证码：登录用不上；注册**可以不填**（生产环境没有短信通道）；
     重设密码必须填 —— 那条路唯一的凭证就是码。 */
  const codeOk = code.trim() === '' ? mode !== 'reset' : /^\d{6}$/.test(code.trim())
  const canSubmit = mobileOk && password.length >= 6 && codeOk && !busy

  const submit = async () => {
    if (!canSubmit) return
    if (mode === 'login') {
      if (await login(mobile, password)) onClose()
      return
    }
    if (mode === 'register') {
      if (await register(mobile, password, code, nickname)) onClose()
      return
    }
    /* reset：成功后**不关面板**，就地转成登录态 ——
       服务端刚把所有票撤了，人得用新密码登一次；把他踢回设置页
       只会让他再找一遍入口。 */
    if (await resetPassword(mobile, code, password)) {
      setMode('login')
      setCode('')
      setPassword('')
      setHint('密码已重设。用新密码登录一次就行。')
    }
  }

  const onSendCode = async () => {
    if (!mobileOk || countdown > 0 || busy) return
    const scene = mode === 'register' ? 'register' : mode === 'reset' ? 'reset_password' : 'login'
    const ok = await sendCode(mobile, scene)
    if (ok) {
      setCountdown(60)
      setHint('验证码已发出。本地调试时它不会进短信，在服务端日志里找「DEV SMS CODE」。')
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      emoji="👤"
      title={mode === 'login' ? '登录' : mode === 'register' ? '注册账号' : '重设密码'}
    >
      <div className="space-y-3 pb-4">
        <p className="rounded-2xl bg-sun-50 px-3 py-2 text-[11.5px] font-bold leading-relaxed text-ink-700">
          {session?.user?.is_guest
            ? '登录会切换到另一个账号。这台手机上的临时进度**不会**并过去 —— 想保留它，请用上面那个「保存进度」绑定手机号。'
            : '用手机号登录之后，任务、积分、农场和存档都会存到账号里，换手机也还在。'}
        </p>

        <label className="block">
          <span className="text-[11px] font-extrabold text-ink-500">手机号</span>
          <input
            data-account-mobile
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
          <span className="text-[11px] font-extrabold text-ink-500">
            {mode === 'reset' ? '新密码（至少 6 位）' : '密码（至少 6 位）'}
          </span>
          <input
            data-account-password
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value.slice(0, 64))}
            placeholder="••••••"
            className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-3 text-base font-bold text-ink-900 outline-none focus:border-grape-400"
          />
        </label>

        {mode !== 'login' && (
          <label className="block">
            <span className="text-[11px] font-extrabold text-ink-500">
              {mode === 'register' ? '验证码（收不到也能注册）' : '验证码'}
            </span>
            <div className="mt-1 flex gap-2">
              <input
                data-account-code
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
                data-account-send-code
                className="shrink-0 rounded-xl border border-grape-500/30 bg-white px-3 text-[12px] font-extrabold text-grape-500 disabled:opacity-40"
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </label>
        )}

        {mode === 'register' && (
          <label className="block">
            <span className="text-[11px] font-extrabold text-ink-500">称呼（可不填）</span>
            <input
              data-account-nickname
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 32))}
              placeholder="小明妈妈"
              className="mt-1 w-full rounded-xl border border-ink-900/10 bg-white px-3 py-3 text-base font-bold text-ink-900 outline-none focus:border-grape-400"
            />
          </label>
        )}

        {(error || hint) && (
          <p
            data-account-error={error ? '' : undefined}
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
          data-account-submit
          className="btn min-h-[48px] w-full rounded-2xl bg-grape-400 font-display text-base font-extrabold text-white active:btn-press disabled:opacity-40"
        >
          {busy
            ? '请稍候…'
            : mode === 'login'
              ? '登录'
              : mode === 'register'
                ? '注册并登录'
                : '重设密码'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            onClick={() => {
              setMode('reset')
              setHint(null)
            }}
            data-account-forgot
            className="w-full py-1 text-center text-[12px] font-bold text-ink-500 underline decoration-dotted"
          >
            忘记密码？
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setHint(null)
          }}
          data-account-switch
          className="w-full py-1 text-center text-[12px] font-bold text-ink-500 underline decoration-dotted"
        >
          {mode === 'login' ? '还没有账号？去注册' : '已经有账号？去登录'}
        </button>

        {/* 逃生口：上一次是正式账号、会话过期之后，这一屏会自动弹出来。
            不给他这条退路的话，一个「只是想让孩子先玩玩」的家长会被卡死。
            `force` 是必须的 —— 正常情况下 `ensureGuest` 会拒绝建游客。 */}
        {!session && (
          <button
            type="button"
            onClick={async () => {
              if (await ensureGuest({ force: true })) onClose()
            }}
            disabled={busy}
            data-account-skip
            className="w-full py-1 text-center text-[12px] font-bold text-ink-500 underline decoration-dotted disabled:opacity-40"
          >
            先随便玩玩（不保存）
          </button>
        )}
      </div>
    </BottomSheet>
  )
}
