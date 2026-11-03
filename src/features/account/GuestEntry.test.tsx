import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GuestBar } from './GuestBar'
import { BindSheet } from './BindSheet'
import { useAccount } from '@/store/useAccount'
import { useApp } from '@/store/useApp'
import { __resetGuestPromptForTest } from './guestPrompt'
import type { Session } from '@/api/session'
import type { ApiUser } from '@/api/types'

/* ============================================================
   临时账号的两个界面（2026-11-03）
   ------------------------------------------------------------
   守三件事：

     ① 横条**只在游客时出现**，而且会说出手里有多少东西
        （「已经攒了 24 分」比「进度会丢」有用得多）；
     ② 被门槛拦住时（`coupon`）面板**没有「以后再说」** ——
        那一步服务端不放行，给个退路只会让人以为关掉就能兑换；
     ③ 主动弹的那一次（`launch`）关掉之后**不再弹**。
   ============================================================ */

const guestApi = vi.fn()
const bindApi = vi.fn()
const smsApi = vi.fn()

/**
 * ⚠️ `vitest.config.ts` 把 `VITE_APP_MODE` 钉成了 **local**（store 的单测要
 * 断言本地领域逻辑）。而这两块界面只在在线版出现 —— 不覆盖这个常量，
 * 它们会**整块不渲染**，断言全红，而原因看起来像「组件写错了」。
 *
 * 用 `importOriginal` 而不是整个替掉：`useApp` 也从这里取 `pullFromServer`
 * 等一堆东西，整个替掉会让它的模块级绑定变成 undefined。
 */
vi.mock('@/sync/pull', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sync/pull')>()),
  isOnlineMode: true,
}))

vi.mock('@/api/auth', () => ({
  guest: (...a: unknown[]) => guestApi(...a),
  bindMobile: (...a: unknown[]) => bindApi(...a),
  sendSmsCode: (...a: unknown[]) => smsApi(...a),
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  profile: vi.fn(),
  logout: vi.fn(),
}))

const user = (isGuest: boolean): ApiUser => ({
  uid: 42,
  username: '',
  mobile: '',
  mobile_verified: false,
  nickname: '小客人',
  avatar: '',
  gender: 0,
  language: 'zh',
  is_guest: isGuest,
  has_password: false,
  has_wechat: false,
  created_at: 0,
})

const session = (isGuest: boolean): Session => ({
  token: 't',
  refreshToken: 'r',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: user(isGuest),
})

describe('临时账号横条', () => {
  beforeEach(() => {
    __resetGuestPromptForTest()
    useAccount.setState({ session: null, bindSheet: { open: false, reason: null } })
    useApp.setState({ balance: 0, harvestBalance: 0 })
  })

  it('游客时出现，说「临时账号」', () => {
    useAccount.setState({ session: session(true) })
    render(<GuestBar />)
    expect(document.querySelector('[data-guest-bar]')).not.toBeNull()
    expect(screen.getByText(/临时账号/)).toBeTruthy()
  })

  it('★ 手里有东西就把数字写出来', () => {
    useAccount.setState({ session: session(true) })
    useApp.setState({ balance: 24, harvestBalance: 3 })
    render(<GuestBar />)
    const text = document.querySelector('[data-guest-bar-text]')?.textContent ?? ''
    expect(text).toContain('24 分')
    expect(text).toContain('3 张券')
  })

  it('正式账号时整条不出现', () => {
    useAccount.setState({ session: session(false) })
    render(<GuestBar />)
    expect(document.querySelector('[data-guest-bar]')).toBeNull()
  })

  it('点「保存进度」打开面板（reason=manual）', async () => {
    useAccount.setState({ session: session(true) })
    render(<GuestBar />)
    await userEvent.click(document.querySelector('[data-guest-bar-save]') as HTMLElement)
    expect(useAccount.getState().bindSheet).toEqual({ open: true, reason: 'manual' })
  })
})

describe('保存进度面板', () => {
  beforeEach(() => {
    __resetGuestPromptForTest()
    useAccount.setState({ session: session(true), busy: false, error: null })
  })

  it('被门槛拦住时（coupon）**没有**「以后再说」', () => {
    useAccount.setState({ bindSheet: { open: true, reason: 'coupon' } })
    render(<BindSheet />)
    expect(document.querySelector('[data-bind-sheet]')).not.toBeNull()
    expect(document.querySelector('[data-bind-mobile]')).not.toBeNull()
    expect(document.querySelector('[data-bind-later]')).toBeNull()
  })

  it('主动弹的那次（launch）可以「以后再说」，关掉就不再弹', async () => {
    useAccount.setState({ bindSheet: { open: true, reason: 'launch' } })
    render(<BindSheet />)
    const later = document.querySelector('[data-bind-later]')
    expect(later).not.toBeNull()
    await userEvent.click(later as HTMLElement)
    expect(useAccount.getState().bindSheet.open).toBe(false)
    /* 关掉 ⇒ 记成「提醒过了」：下次启动不该再弹 */
    const raw = localStorage.getItem('kqf.guest.prompt.v1') ?? ''
    expect(raw).toContain('"nudged":true')
  })

  it('★ 绑成功之后面板自己关掉，会话里的 is_guest 变成 false', async () => {
    bindApi.mockResolvedValueOnce({ ...user(false), mobile: '138****8000' })
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet />)

    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-code]') as HTMLElement, '123456')
    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)

    await vi.waitFor(() => expect(useAccount.getState().bindSheet.open).toBe(false))
    expect(useAccount.getState().session?.user.is_guest).toBe(false)
    expect(bindApi).toHaveBeenCalledWith('13800138000', '123456', undefined)
  })

  it('绑失败留在原地，把原因显示出来', async () => {
    bindApi.mockRejectedValueOnce(new Error('这个手机号已经注册过了'))
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet />)

    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-code]') as HTMLElement, '123456')
    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)

    await vi.waitFor(() => expect(document.querySelector('[data-bind-error]')).not.toBeNull())
    expect(useAccount.getState().bindSheet.open).toBe(true)
  })
})
