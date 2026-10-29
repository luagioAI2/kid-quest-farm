import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAccount } from '@/store/useAccount'
import type { ApiMerchantApplication, ApiUser } from '@/api/types'

/* ============================================================
   招商（2026-10-29，第三版：接真后端）
   ------------------------------------------------------------
   前两版都不对：
     ① 入口在「兑换记录」底部、带一张表单 → 用户纠正到心愿页右上角、一键申请
     ② 申请存在本地 `settings.merchantApps` → 现在有后端了，改走 `/api/merchant/*`

   所以这一组守四件事：
     ① **没登录就没有申请**（不偷偷存本地假装成功）；
     ② 一键申请只发 `role`（身份由服务端从账号取）；
     ③ `admin_url` 只在 approved 时渲染 —— 服务端不给就不画按钮；
     ④ 服务端出错要说出来（带重试），别静默变成「什么都没发生」。
   ============================================================ */

const myMerchant = vi.fn()
const applyMerchant = vi.fn()

vi.mock('@/api/merchant', () => ({
  myMerchant: (...a: unknown[]) => myMerchant(...a),
  applyMerchant: (...a: unknown[]) => applyMerchant(...a),
  inviteStats: vi.fn(),
}))

import { MerchantView } from './MerchantView'

const user: ApiUser = {
  uid: 3,
  username: '',
  mobile: '138****8000',
  mobile_verified: true,
  nickname: '测试家长',
  avatar: '',
  gender: 0,
  language: 'zh',
  is_guest: false,
  has_password: true,
  has_wechat: false,
  created_at: 1793282113,
}

const signedIn = () =>
  useAccount.setState({
    session: { token: 't', refreshToken: 'r', user, expiresAt: 9_999_999_999 },
    busy: false,
    error: null,
  })

const signedOut = () => useAccount.setState({ session: null, busy: false, error: null })

const app = (patch: Partial<ApiMerchantApplication> = {}): ApiMerchantApplication => ({
  id: 1,
  role: 'parent',
  status: 'pending',
  status_text: '待审核',
  name: '测试家长',
  contact: '+8613800138000',
  note: '',
  created_at: Math.floor(Date.now() / 1000) - 60,
  reviewed_at: 0,
  ...patch,
})

beforeEach(() => {
  vi.clearAllMocks()
  myMerchant.mockResolvedValue({ applications: [] })
})

describe('招商：没有账号就没有申请', () => {
  it('★ 未登录时只给「登录 / 注册」，不画申请按钮', async () => {
    signedOut()
    render(<MerchantView onBack={() => {}} />)

    expect(await screen.findByText(/招商申请要经过审核/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '登录 / 注册' })).toBeTruthy()
    // ⚠️ 反向：不许出现申请按钮 —— 出现了就是「点了存本地」，家长以为提交了
    expect(screen.queryByRole('button', { name: '家长申请' })).toBeNull()
    expect(myMerchant, '没登录就别去问服务端「我的申请」').not.toHaveBeenCalled()
  })
})

describe('招商：一键申请', () => {
  it('★ 点一下就提交，只发 role（身份由服务端从账号取）', async () => {
    signedIn()
    applyMerchant.mockResolvedValue(app())
    const u = userEvent.setup()
    render(<MerchantView onBack={() => {}} />)

    await u.click(await screen.findByRole('button', { name: '家长申请' }))

    await waitFor(() => {
      expect(applyMerchant).toHaveBeenCalledTimes(1)
    })
    expect(applyMerchant).toHaveBeenCalledWith('parent')
    // 提交之后那一路换成「审核中」，按钮消失（防重复提交）
    expect(await screen.findByText('审核中')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '家长申请' })).toBeNull()
    // 另一路照旧可以申请
    expect(screen.getByRole('button', { name: '商家申请' })).toBeTruthy()
  })

  it('两路互不覆盖：家长已提交时，商家那一路还是「申请」', async () => {
    signedIn()
    myMerchant.mockResolvedValue({ applications: [app({ role: 'parent' })] })
    render(<MerchantView onBack={() => {}} />)

    expect(await screen.findByText('审核中')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '家长申请' })).toBeNull()
    expect(screen.getByRole('button', { name: '商家申请' })).toBeTruthy()
  })
})

describe('招商：审核结果来自服务端', () => {
  it('★ 已通过且有后台地址：直出「打开后台」，点了才 window.open', async () => {
    signedIn()
    myMerchant.mockResolvedValue({
      applications: [app({ status: 'approved', admin_url: 'https://merchant.example.com/d/1' })],
    })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const u = userEvent.setup()
    render(<MerchantView onBack={() => {}} />)

    await u.click(await screen.findByRole('button', { name: /打开后台/ }))
    expect(open).toHaveBeenCalledWith(
      'https://merchant.example.com/d/1',
      '_blank',
      'noopener,noreferrer',
    )
    open.mockRestore()
  })

  it('★ 已通过但没有 admin_url：不画按钮', async () => {
    signedIn()
    myMerchant.mockResolvedValue({ applications: [app({ status: 'approved' })] })
    render(<MerchantView onBack={() => {}} />)

    expect(await screen.findByText('已通过')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /打开后台/ }),
      '点了什么都不发生的按钮，比没有这颗按钮更糟',
    ).toBeNull()
    expect(screen.getByText(/后台链接还在生成/)).toBeTruthy()
  })

  it('被拒的那一路写「未通过」（服务端有 rejected，客户端不再假装还在审）', async () => {
    signedIn()
    myMerchant.mockResolvedValue({
      applications: [app({ status: 'rejected', note: '资料不全' })],
    })
    render(<MerchantView onBack={() => {}} />)

    expect(await screen.findByText('未通过')).toBeTruthy()
    expect(screen.getByText(/资料不全/)).toBeTruthy()
  })
})

describe('招商：服务端出错要说出来', () => {
  it('★ 读取失败显示原因 + 重试能重新拉', async () => {
    signedIn()
    myMerchant.mockRejectedValueOnce(new Error('boom'))
    myMerchant.mockResolvedValueOnce({ applications: [] })
    const u = userEvent.setup()
    render(<MerchantView onBack={() => {}} />)

    expect(await screen.findByText('出了点问题，请稍后再试')).toBeTruthy()
    await u.click(screen.getByRole('button', { name: '重试' }))
    await waitFor(() => expect(myMerchant).toHaveBeenCalledTimes(2))
    // 重试成功后错误提示消失
    await waitFor(() => expect(screen.queryByText('出了点问题，请稍后再试')).toBeNull())
  })
})
