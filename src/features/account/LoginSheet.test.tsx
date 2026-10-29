import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LoginSheet } from './LoginSheet'
import { useAccount } from '@/store/useAccount'
import { ApiError } from '@/api/client'
import { setSession } from '@/api/session'

/* ============================================================
   登录 / 注册 / 忘记密码（2026-10-30）
   ------------------------------------------------------------
   这一屏是**所有要花钱 / 要审核的事**的入口，之前一条测试都没有。
   加这一组是因为补「忘记密码」时发现：服务端 `/auth/reset-password`
   一直在，客户端却没有任何入口 —— 家长忘了密码就永久进不去。

   守四件事：
     ① 忘记密码只在登录态出现，点进去能切到「重设密码」；
     ② 重设走的是 `resetPassword`（不是 login，也不是 register），
        并且**发验证码的场景是 `reset_password`** —— 写成 login 的话
        服务端会发一张登录用的码，重设时会说「验证码不对」；
     ③ 重设成功后**不关面板**，就地转回登录态并给一句提示
        （服务端这时已经把票全撤了，人得用新密码再登一次）；
     ④ 失败要留在原地、密码和码都还在，好让人对着改一位。
   ============================================================ */

const loginApi = vi.fn()
const registerApi = vi.fn()
const resetApi = vi.fn()
const smsApi = vi.fn()

vi.mock('@/api/auth', () => ({
  login: (...a: unknown[]) => loginApi(...a),
  register: (...a: unknown[]) => registerApi(...a),
  resetPassword: (...a: unknown[]) => resetApi(...a),
  sendSmsCode: (...a: unknown[]) => smsApi(...a),
  profile: vi.fn(),
  logout: vi.fn(),
}))

const onClose = vi.fn()

const fill = async (user: ReturnType<typeof userEvent.setup>, mobile: string, code: string, pwd: string) => {
  await user.type(document.querySelector('[data-account-mobile]') as HTMLElement, mobile)
  if (code) await user.type(document.querySelector('[data-account-code]') as HTMLElement, code)
  await user.type(document.querySelector('[data-account-password]') as HTMLElement, pwd)
}

const openReset = async () => {
  const user = userEvent.setup()
  render(<LoginSheet open onClose={onClose} />)
  await user.click(document.querySelector('[data-account-forgot]') as HTMLElement)
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  setSession(null)
  useAccount.setState({ session: null, busy: false, error: null })
})

describe('登录面板：忘记密码', () => {
  it('登录态才有「忘记密码？」入口', async () => {
    const user = userEvent.setup()
    render(<LoginSheet open onClose={onClose} />)
    expect(document.querySelector('[data-account-forgot]'), '登录态应该有').toBeTruthy()

    // 切到注册就没有了 —— 还没账号的人不需要「忘记」
    await user.click(document.querySelector('[data-account-switch]') as HTMLElement)
    expect(document.querySelector('[data-account-forgot]')).toBeNull()
  })

  it('点进去是「重设密码」：出现验证码框，按钮文案不是「登录」', async () => {
    await openReset()
    // 标题是 h2，按钮是 <button> —— 用 `getByText` 会同时命中两处
    expect(screen.getByRole('heading').textContent).toBe('重设密码')
    expect(document.querySelector('[data-account-code]'), '重设要验证码').toBeTruthy()
    expect((document.querySelector('[data-account-submit]') as HTMLElement).textContent).toContain(
      '重设密码',
    )
  })

  it('★ 发验证码用的场景是 reset_password（写成 login 会拿到一张不能用的码）', async () => {
    smsApi.mockResolvedValue({ sent: true })
    const user = await openReset()
    await user.type(document.querySelector('[data-account-mobile]') as HTMLElement, '13900001111')
    await user.click(document.querySelector('[data-account-send-code]') as HTMLElement)
    await waitFor(() => expect(smsApi).toHaveBeenCalledWith('13900001111', 'reset_password'))
  })

  it('★ 重设成功：调 resetPassword（不是 login/register），面板留着并转回登录态', async () => {
    resetApi.mockResolvedValue({ reset: true })
    const user = await openReset()
    await fill(user, '13900001111', '123456', 'newpass1')
    await user.click(document.querySelector('[data-account-submit]') as HTMLElement)

    await waitFor(() => expect(resetApi).toHaveBeenCalledWith('13900001111', '123456', 'newpass1'))
    expect(loginApi, '重设不该顺手登录 —— 服务端刚把所有票撤了').not.toHaveBeenCalled()
    expect(registerApi).not.toHaveBeenCalled()
    expect(onClose, '面板不能关，否则人要重新找入口').not.toHaveBeenCalled()

    // 转回登录态，并说清楚下一步
    await waitFor(() => expect(document.querySelector('[data-account-forgot]')).toBeTruthy())
    expect(document.body.textContent).toContain('密码已重设')
  })

  it('失败时留在面板里、红字说原因，密码和验证码都还在', async () => {
    resetApi.mockRejectedValue(new ApiError(10010503, '验证码不对或已过期'))
    const user = await openReset()
    await fill(user, '13900001111', '999999', 'newpass1')
    await user.click(document.querySelector('[data-account-submit]') as HTMLElement)

    await waitFor(() =>
      expect(document.querySelector('[data-account-error]')?.textContent).toContain('验证码不对'),
    )
    expect((document.querySelector('[data-account-code]') as HTMLInputElement).value).toBe('999999')
    expect((document.querySelector('[data-account-password]') as HTMLInputElement).value).toBe(
      'newpass1',
    )
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('登录面板：登录', () => {
  it('登录成功才关面板；失败留着并显示原因', async () => {
    loginApi.mockRejectedValueOnce(new ApiError(10010402, '手机号或密码不对'))
    const user = userEvent.setup()
    render(<LoginSheet open onClose={onClose} />)
    await user.type(document.querySelector('[data-account-mobile]') as HTMLElement, '13900001111')
    await user.type(document.querySelector('[data-account-password]') as HTMLElement, 'pass1234')
    await user.click(document.querySelector('[data-account-submit]') as HTMLElement)

    await waitFor(() =>
      expect(document.querySelector('[data-account-error]')?.textContent).toContain('密码不对'),
    )
    expect(onClose).not.toHaveBeenCalled()

    loginApi.mockResolvedValueOnce({
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 7200,
      user: { uid: 1, mobile: '139****1111', nickname: '妈妈' },
    })
    await user.click(document.querySelector('[data-account-submit]') as HTMLElement)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
