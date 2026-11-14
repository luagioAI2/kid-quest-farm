import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ============================================================
   登录态 store（`src/store/useAccount.ts`）
   ------------------------------------------------------------
   这个 store 一个测试都没有过，而它管着几条**静默丢数据**的承诺：

     ① 全新安装 ⇒ 自动建游客（「没耐心」的那批人不能被拦在门外）；
     ② ★ 上一次是**正式账号** ⇒ 绝不能偷偷建游客 ——
        那等于把人换成一个空账号：任务、积分、券都还在原来那个账号里，
        而屏幕上一片空白，他会以为数据没了；
     ③ ★ 游客会话过期 ⇒ 自动按设备号把**同一个**账号要回来，进度不丢；
     ④ 401 兜底不能自激（clear → ensure → clear），否则界面一直转圈。

   这些坏掉都不会报错，只是「东西不见了」。所以这里全用假接口钉死。

   ★ `vitest.config.ts` 把 `VITE_APP_MODE` 钉成 `local`，而 `isOnlineMode`
     是模块级常量 —— 不 mock 的话这个 store 的在线分支一条都跑不到。
   ============================================================ */

vi.mock('../api/auth', () => ({
  guest: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  bindMobile: vi.fn(),
  sendSmsCode: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  profile: vi.fn(),
}))
vi.mock('../sync/pull', () => ({ isOnlineMode: true }))

import { ApiError } from '../api/client'
import * as auth from '../api/auth'
import { setSession, type Session } from '../api/session'
import { lastAccount, rememberAccount } from '../api/lastAccount'
import type { ApiUser, AuthResult } from '../api/types'
import { useAccount } from './useAccount'

const guest = vi.mocked(auth.guest)
const bindMobile = vi.mocked(auth.bindMobile)

const guestUser: ApiUser = {
  uid: 7,
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
  created_at: 1,
}
const realUser: ApiUser = {
  ...guestUser,
  uid: 8,
  mobile: '138****8000',
  mobile_verified: true,
  is_guest: false,
  has_password: true,
}

const pair = (user: ApiUser): AuthResult => ({
  access_token: 'a',
  refresh_token: 'r',
  expires_in: 7200,
  user,
  /* ★ 这个字段是 `tsc` 才会报的坑：`vitest` 只转译、不查类型，
     少一个必填字段照样全绿（这次就是「1390 条全过 + lint 红」）。 */
  is_new_user: false,
})
const sessionOf = (user: ApiUser): Session => ({
  token: 'a',
  refreshToken: 'r',
  user,
  expiresAt: 9_999_999_999,
})

beforeEach(() => {
  localStorage.clear()
  setSession(null)
  useAccount.setState({
    session: null,
    busy: false,
    error: null,
    errorCode: null,
    bootAccount: 'pending',
    bindSheet: { open: false, reason: null },
  })
  vi.clearAllMocks()
})

describe('useAccount：启动时进不进游客', () => {
  it('★ 全新安装 ⇒ 自动建游客（不用注册就能玩）', async () => {
    guest.mockResolvedValue(pair(guestUser))

    const ok = await useAccount.getState().ensureGuest()

    expect(ok).toBe(true)
    expect(guest, '全新设备必须去建游客').toHaveBeenCalledTimes(1)
    const s = useAccount.getState()
    expect(s.session?.user.uid).toBe(7)
    expect(s.bootAccount).toBe('ready')
    /* 记一笔「上次是游客」：下次会话过期时靠它决定「可以自动建回来」 */
    expect(lastAccount()).toEqual({ uid: 7, guest: true })
  })

  it('★★ 上一次是正式账号 ⇒ 不偷偷建游客，请他登回来', async () => {
    rememberAccount(realUser)

    const ok = await useAccount.getState().ensureGuest()

    expect(ok).toBe(false)
    expect(guest, '建了就是把人换成空账号，屏幕上会一片空白').not.toHaveBeenCalled()
    expect(useAccount.getState().bootAccount).toBe('needs-login')
  })

  it('★ 显式点「先随便玩玩」才跳过上面那道判断（这是用户自己的选择）', async () => {
    rememberAccount(realUser)
    guest.mockResolvedValue(pair(guestUser))

    const ok = await useAccount.getState().ensureGuest({ force: true })

    expect(ok).toBe(true)
    expect(guest).toHaveBeenCalledTimes(1)
    expect(useAccount.getState().session?.user.uid).toBe(7)
  })

  it('★ 已经有会话 ⇒ 什么都不做（别每次启动都建一个新游客）', async () => {
    setSession(sessionOf(guestUser))
    useAccount.setState({ session: sessionOf(guestUser) })

    const ok = await useAccount.getState().ensureGuest()

    expect(ok).toBe(true)
    expect(guest).not.toHaveBeenCalled()
  })

  it('★ 建游客失败 ⇒ 记下原因，别让界面以为成功了', async () => {
    guest.mockRejectedValue(new ApiError(-1, '连不上服务器，请检查网络'))

    const ok = await useAccount.getState().ensureGuest()

    expect(ok).toBe(false)
    const s = useAccount.getState()
    expect(s.bootAccount).toBe('failed')
    expect(s.error).toContain('连不上服务器')
  })

  it('★ 同时来两次只发一次请求（StrictMode 会把启动 effect 跑两遍）', async () => {
    let release: (v: unknown) => void = () => {}
    guest.mockReturnValue(
      new Promise((r) => {
        release = r as (v: unknown) => void
      }) as ReturnType<typeof auth.guest>
    )

    const a = useAccount.getState().ensureGuest()
    const b = useAccount.getState().ensureGuest()
    release(pair(guestUser))
    await Promise.all([a, b])

    expect(guest, '两个请求会交错 setSession，后拿到的票可能被先拿到的覆盖').toHaveBeenCalledTimes(1)
  })
})

describe('useAccount：会话过期之后（这里最容易丢数据）', () => {
  it('★★ 游客过期 ⇒ 按设备号把同一个账号要回来，进度不丢', async () => {
    guest.mockResolvedValue(pair(guestUser))
    await useAccount.getState().ensureGuest()
    const uid = useAccount.getState().session?.user.uid
    guest.mockClear()

    /* `client` 收到 401 时调的就是它 */
    useAccount.getState().clear()
    expect(useAccount.getState().session).toBeNull()

    /* `clear` 里是 `void ensureGuest()`，等它把账号要回来 */
    await vi.waitFor(() => expect(useAccount.getState().session).not.toBeNull())
    expect(guest).toHaveBeenCalledTimes(1)
    expect(useAccount.getState().session?.user.uid, '必须是同一个 uid').toBe(uid)
    expect(useAccount.getState().bootAccount).toBe('ready')
  })

  it('★ 正式账号过期 ⇒ 转 needs-login，不建游客', async () => {
    setSession(sessionOf(realUser))
    useAccount.setState({ session: sessionOf(realUser) })
    rememberAccount(realUser)

    useAccount.getState().clear()
    /* 给它一点时间去「兜底」—— 兜错了这里就会看见 guest 被调用 */
    await new Promise((r) => setTimeout(r, 20))

    expect(guest).not.toHaveBeenCalled()
    expect(useAccount.getState().bootAccount).toBe('needs-login')
  })

  it('★ 本来就没登录 ⇒ 401 不兜底（否则 clear → ensure → clear 自激，界面一直转圈）', async () => {
    useAccount.getState().clear()
    await new Promise((r) => setTimeout(r, 20))

    expect(guest).not.toHaveBeenCalled()
  })
})

describe('useAccount：「保存进度」面板的状态', () => {
  it('★ 绑定失败要留下**码**，界面靠它决定「号码被占了」还是别的错', async () => {
    setSession(sessionOf(guestUser))
    useAccount.setState({ session: sessionOf(guestUser) })
    bindMobile.mockRejectedValue(new ApiError(10010202, '该手机号已注册'))

    const ok = await useAccount.getState().bindMobile('13800138000', '123456', 'pwd12345')

    expect(ok).toBe(false)
    const s = useAccount.getState()
    expect(s.errorCode).toBe(10010202)
    expect(s.error).toContain('已注册')
  })

  it('★ 关掉面板要清掉错误（否则「刚打开就说这个号已被占用」）', async () => {
    setSession(sessionOf(guestUser))
    useAccount.setState({ session: sessionOf(guestUser) })
    bindMobile.mockRejectedValue(new ApiError(10010202, '该手机号已注册'))
    await useAccount.getState().bindMobile('13800138000', '123456', 'pwd12345')

    useAccount.getState().closeBind()

    const s = useAccount.getState()
    expect(s.error).toBeNull()
    expect(s.errorCode).toBeNull()
    expect(s.bindSheet.open).toBe(false)
  })

  it('★ 打开面板也清一次（`error` 是整个 store 共用的，会串到登录面板里去）', async () => {
    useAccount.setState({ error: '该手机号已注册', errorCode: 10010202 })

    useAccount.getState().openBind('coupon')

    const s = useAccount.getState()
    expect(s.bindSheet).toEqual({ open: true, reason: 'coupon' })
    expect(s.error).toBeNull()
    expect(s.errorCode).toBeNull()
  })

  it('★ 绑成功 ⇒ 面板自己关、错误清空、uid 不变（进度原地不动）', async () => {
    setSession(sessionOf(guestUser))
    useAccount.setState({ session: sessionOf(guestUser) })
    useAccount.getState().openBind('coupon')
    bindMobile.mockResolvedValue({ ...realUser, uid: guestUser.uid })

    const ok = await useAccount.getState().bindMobile('13800138000', '123456', 'pwd12345')

    expect(ok).toBe(true)
    const s = useAccount.getState()
    expect(s.bindSheet.open).toBe(false)
    expect(s.error).toBeNull()
    expect(s.errorCode).toBeNull()
    expect(s.session?.user.uid, '绑的是同一个账号，不是新号').toBe(guestUser.uid)
    expect(s.session?.user.is_guest).toBe(false)
  })
})
