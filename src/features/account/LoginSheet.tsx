import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAccount } from '@/store/useAccount'
import { BottomSheet } from '../farm/farmUi'

/* ============================================================
   登录 / 注册（2026-10-29，在线版第一步）
   ------------------------------------------------------------
   为什么要登录：招商、心愿、兑换这些要「审核 / 分账」的事，
   服务端得知道是谁。用户原话：「点申请即可…**因为会根据当前账号，申请**。」

   ## 为什么注册要验证码，登录不要

   服务端 `POST /auth/register` 要求 `code`（6 位，`binding:"required,len=6"`）。
   本地跑服务时验证码**不打短信**，而是打在服务端日志里（`DEV SMS CODE`）——
   所以这一屏不需要「开发态假通过」的分支，填日志里那 6 位就行。
   ⚠️ 别为了好测加「跳过验证码」的开关：那等于线上也能跳过。

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
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode)
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [hint, setHint] = useState<string | null>(null)

  const busy = useAccount((s) => s.busy)
  const error = useAccount((s) => s.error)
  const login = useAccount((s) => s.login)
  const register = useAccount((s) => s.register)
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
  const canSubmit =
    mobileOk &&
    password.length >= 6 &&
    (mode === 'login' || /^\d{6}$/.test(code.trim())) &&
    !busy

  const submit = async () => {
    if (!canSubmit) return
    const ok =
      mode === 'login'
        ? await login(mobile, password)
        : await register(mobile, password, code, nickname)
    if (ok) onClose()
  }

  const onSendCode = async () => {
    if (!mobileOk || countdown > 0 || busy) return
    const ok = await sendCode(mobile, mode === 'register' ? 'register' : 'login')
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
      title={mode === 'login' ? '登录' : '注册账号'}
    >
      <div className="space-y-3 pb-4">
        <p className="rounded-2xl bg-sun-50 px-3 py-2 text-[11.5px] font-bold leading-relaxed text-ink-700">
          账号是<b>爸妈的</b>。孩子那边的任务、积分、心愿都存在这台设备上，
          登录只为了让「招商 / 心愿」这些要审核的事能找到人。
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
          <span className="text-[11px] font-extrabold text-ink-500">密码（至少 6 位）</span>
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

        {mode === 'register' && (
          <>
            <label className="block">
              <span className="text-[11px] font-extrabold text-ink-500">验证码</span>
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
          </>
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
          {busy ? '请稍候…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>

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
      </div>
    </BottomSheet>
  )
}
