import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SyncBanner } from './SyncBanner'
import { useApp } from '../store/useApp'
import { useAccount } from '../store/useAccount'
import type { Session } from '../api/session'
import type { ApiUser } from '../api/types'

/* ============================================================
   「连不上服务器」横条（2026-11-03 补的一条）
   ------------------------------------------------------------
   守的是**重试按钮真的能救回来**这件事：

     启动那一刻如果断网 / 502，`ensureGuest` 建游客就失败了，
     整台设备一个令牌都没有。这时候点「再试一次」如果只重拉数据，
     没有令牌 ⇒ 照样失败 ⇒ 横条一直在、界面永远是空的，
     而且**不报错**。唯一的出路是重启 App，而人不会想到要重启。

   所以这条断言的不是「按钮有没有反应」，是**调用顺序**：
   先要账号（`guest`），再拉数据（`refresh`）。
   ============================================================ */

const order: string[] = []
const guestApi = vi.fn()
const refreshSpy = vi.fn()

/** 见 `GuestEntry.test.tsx` 的说明：`vitest.config.ts` 把模式钉成了 local */
vi.mock('@/sync/pull', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/sync/pull')>()),
  isOnlineMode: true,
}))

vi.mock('@/api/auth', () => ({
  guest: (...a: unknown[]) => guestApi(...a),
  bindMobile: vi.fn(),
  sendSmsCode: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  resetPassword: vi.fn(),
  profile: vi.fn(),
  logout: vi.fn(),
}))

const guestUser: ApiUser = {
  uid: 42,
  username: '',
  mobile: '',
  mobile_verified: false,
  nickname: '小客人',
  avatar: '',
  gender: 0,
  language: 'zh',
  is_guest: true,
  has_password: false,
  has_wechat: false,
  created_at: 0,
}

const session: Session = {
  token: 't',
  refreshToken: 'r',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  user: guestUser,
}

const FAILED = { lastOkAt: 0, failure: 'pull-failed' }

describe('连不上服务器横条', () => {
  beforeEach(() => {
    order.length = 0
    guestApi.mockReset()
    refreshSpy.mockReset()
    /* `ensureGuest` 会读这两个：上次是不是正式账号、有没有存过会话。
       不清掉，上一个用例留下的「正式账号」会让它拒绝建游客（`needs-login`）。 */
    localStorage.clear()
    guestApi.mockImplementation(async () => {
      order.push('guest')
      return { access_token: 'a', refresh_token: 'r', expires_in: 3600, user: guestUser }
    })
    refreshSpy.mockImplementation(async () => {
      order.push('refresh')
    })
    useApp.setState({ refresh: refreshSpy as unknown as (o?: { skipPull?: boolean }) => Promise<void> })
    useAccount.setState({ session: null, bootAccount: 'pending', busy: false, error: null })
  })

  it('没失败就整条不出现', () => {
    useApp.setState({ syncState: { lastOkAt: Date.now(), failure: null } })
    render(<SyncBanner />)
    expect(document.querySelector('[data-sync-banner]')).toBeNull()
  })

  it('失败时把话说清楚，并给一个「再试一次」', () => {
    useApp.setState({ syncState: FAILED })
    render(<SyncBanner />)
    expect(document.querySelector('[data-sync-banner]')).not.toBeNull()
    expect(screen.getByText(/连不上服务器/)).toBeTruthy()
    expect(document.querySelector('[data-sync-retry]')).not.toBeNull()
  })

  it('★ 没有账号时，重试要先建账号、再拉数据', async () => {
    useApp.setState({ syncState: FAILED })
    render(<SyncBanner />)

    await userEvent.click(document.querySelector('[data-sync-retry]') as HTMLElement)

    await vi.waitFor(() => expect(order).toEqual(['guest', 'refresh']))
    /* 建完之后会话确实落地了 —— 不是「调了一下但没存住」 */
    expect(useAccount.getState().session?.user.is_guest).toBe(true)
  })

  it('已经有账号时不重复建（`ensureGuest` 幂等，不多打一次请求）', async () => {
    useAccount.setState({ session })
    useApp.setState({ syncState: FAILED })
    render(<SyncBanner />)

    await userEvent.click(document.querySelector('[data-sync-retry]') as HTMLElement)

    await vi.waitFor(() => expect(order).toEqual(['refresh']))
    expect(guestApi).not.toHaveBeenCalled()
  })
})
