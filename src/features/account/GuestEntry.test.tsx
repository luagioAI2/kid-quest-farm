import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BindSheet } from './BindSheet'
import { ApiError, MOBILE_ALREADY_REG } from '@/api/client'
import { useAccount } from '@/store/useAccount'
import { useApp } from '@/store/useApp'
import type { Session } from '@/api/session'
import type { ApiUser } from '@/api/types'

/* ============================================================
   临时账号的两个界面（2026-11-03）
   ------------------------------------------------------------
   守三件事：

     ① 被门槛拦住时（`coupon`）面板**没有「以后再说」** ——
        那一步服务端不放行，给个退路只会让人以为关掉就能兑换；
     ② 自己点开的（`manual`）可以「以后再说」；
     ③ 号码已经有账号时**改口给一条出路**（不是只甩一行红字）。

   ⚠️ 2026-11-05：顶栏下面那条「临时账号」横条和「第 3 次启动自动弹一次」
      都删掉了（用户：「任务不是后端有记录吗？」）。进度确实在服务端，
      但账号认的是本机那串随机号 —— 所以入口留在了设置页的账号胶囊上，
      不再主动唠叨。横条的用例一并删掉，别留着守一个不存在的组件。
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

describe('保存进度面板', () => {
  beforeEach(() => {
    useAccount.setState({ session: session(true), busy: false, error: null, errorCode: null })
  })

  it('被门槛拦住时（coupon）**没有**「以后再说」', () => {
    useAccount.setState({ bindSheet: { open: true, reason: 'coupon' } })
    render(<BindSheet />)
    expect(document.querySelector('[data-bind-sheet]')).not.toBeNull()
    expect(document.querySelector('[data-bind-mobile]')).not.toBeNull()
    expect(document.querySelector('[data-bind-later]')).toBeNull()
  })

  it('自己点开的那次（manual）可以「以后再说」', async () => {
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet />)
    const later = document.querySelector('[data-bind-later]')
    expect(later).not.toBeNull()
    await userEvent.click(later as HTMLElement)
    expect(useAccount.getState().bindSheet.open).toBe(false)
  })

  it('★ 绑成功之后面板自己关掉，会话里的 is_guest 变成 false', async () => {
    bindApi.mockResolvedValueOnce({ ...user(false), mobile: '138****8000' })
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet />)

    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-code]') as HTMLElement, '123456')
    await userEvent.type(document.querySelector('[data-bind-password]') as HTMLElement, 'abc123456')
    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)

    await vi.waitFor(() => expect(useAccount.getState().bindSheet.open).toBe(false))
    expect(useAccount.getState().session?.user.is_guest).toBe(false)
    expect(bindApi).toHaveBeenCalledWith('13800138000', '123456', 'abc123456')
  })

  it('★ 不填验证码也能存（生产环境还没有短信通道）', async () => {
    bindApi.mockResolvedValueOnce({ ...user(false), mobile: '138****8000' })
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet />)

    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-password]') as HTMLElement, 'abc123456')
    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)

    await vi.waitFor(() => expect(useAccount.getState().bindSheet.open).toBe(false))
    /* 空验证码传空串（不是 undefined）—— 服务端据此判断走「自助绑定」那条 */
    expect(bindApi).toHaveBeenCalledWith('13800138000', '', 'abc123456')
  })

  it('★ 密码不够 6 位时提交按钮是灰的（它是换手机唯一的回来的路）', async () => {
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet />)

    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-password]') as HTMLElement, '123')
    const btn = document.querySelector('[data-bind-submit]') as HTMLButtonElement
    expect(btn.disabled).toBe(true)

    await userEvent.type(document.querySelector('[data-bind-password]') as HTMLElement, '456')
    expect((document.querySelector('[data-bind-submit]') as HTMLButtonElement).disabled).toBe(false)
  })

  it('绑失败留在原地，把原因显示出来', async () => {
    bindApi.mockRejectedValueOnce(new Error('这个手机号已经注册过了'))
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet />)

    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-code]') as HTMLElement, '123456')
    await userEvent.type(document.querySelector('[data-bind-password]') as HTMLElement, 'abc123456')
    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)

    await vi.waitFor(() => expect(document.querySelector('[data-bind-error]')).not.toBeNull())
    expect(useAccount.getState().bindSheet.open).toBe(true)
  })
})

/* ============================================================
   绑完之后必须有个收尾（2026-11-03）
   ------------------------------------------------------------
   面板上写着「绑完就能继续」。可花券那一次**本来就没生效**（服务端拒了），
   绑完如果只把面板关掉，人看到的是原来那一屏 —— 什么都没发生，
   他不会知道该再点一次。这是「一句承诺没人兑现」，不是小事。

   两种原因措辞不同：
     · coupon —— 告诉他刚才那一步没生效、回去再点一次
     · 其余   —— 告诉他以后怎么回来（换手机用手机号 + 密码）
   ============================================================ */
describe('绑成功之后的收尾', () => {
  beforeEach(() => {
    bindApi.mockReset()
    useApp.setState({ toasts: [] })
    useAccount.setState({
      session: session(true),
      busy: false,
      error: null,
      errorCode: null,
      bindSheet: { open: true, reason: 'manual' },
    })
  })

  const fillAndSubmit = async () => {
    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-password]') as HTMLElement, 'abc123456')
    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)
  }

  it('★ 花券被拦的那次：说清「刚才那一步没生效，回去再点一次」', async () => {
    bindApi.mockResolvedValueOnce({ ...user(false), mobile: '138****8000' })
    useAccount.setState({ bindSheet: { open: true, reason: 'coupon' } })
    render(<BindSheet />)
    await fillAndSubmit()

    await vi.waitFor(() => expect(useApp.getState().toasts.length).toBe(1))
    const t = useApp.getState().toasts[0]
    expect(t.title).toContain('存好')
    /* 「再点一次」是这句提示存在的全部理由：不说就等于没接上 */
    expect(t.detail ?? '').toContain('再点一次')
    /* 不能让人以为兑换已经成功了 */
    expect(t.detail ?? '').not.toContain('兑换好了')
  })

  it('自己点「保存进度」的那次：改说「以后怎么回来」', async () => {
    bindApi.mockResolvedValueOnce({ ...user(false), mobile: '138****8000' })
    render(<BindSheet />)
    await fillAndSubmit()

    await vi.waitFor(() => expect(useApp.getState().toasts.length).toBe(1))
    const t = useApp.getState().toasts[0]
    expect(t.title).toContain('存到账号')
    /* 换手机能登回来靠的是手机号 + 刚才那个密码，这句话必须出现 */
    expect(t.detail ?? '').toContain('手机号')
    expect(t.detail ?? '').toContain('密码')
  })

  it('绑失败时**不**发成功提示（不然人会以为存下来了）', async () => {
    bindApi.mockRejectedValueOnce(new ApiError(MOBILE_ALREADY_REG, '该手机号已注册'))
    render(<BindSheet />)
    await fillAndSubmit()

    await vi.waitFor(() => expect(useAccount.getState().error).not.toBeNull())
    expect(useApp.getState().toasts).toEqual([])
  })
})

/* ============================================================
   号码已经有账号了（2026-11-03）
   ------------------------------------------------------------
   这是游客绑定**最常见**的失败：家长以前在别的手机上玩过，同一个号码
   已经有一个账号。原来只甩一行红字「该手机号已注册」—— 死胡同：
   绑不上 ⇒ 攒的东西存不下来；那个号码上原本的账号也进不去（没入口）。

   现在改口：说清「用它可以登回来，但这台手机上刚攒的不会跟过去」，
   给一个按钮把号码带进登录面板。
   ============================================================ */
describe('保存进度：号码已经被占用', () => {
  beforeEach(() => {
    useAccount.setState({ session: session(true), busy: false, error: null, errorCode: null })
  })

  const fillAndSubmit = async () => {
    await userEvent.type(document.querySelector('[data-bind-mobile]') as HTMLElement, '13800138000')
    await userEvent.type(document.querySelector('[data-bind-password]') as HTMLElement, 'abc123456')
    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)
  }

  it('★★ 改口给一条出路：按钮上就是那个号码，点了带号码去登录', async () => {
    bindApi.mockRejectedValueOnce(new ApiError(MOBILE_ALREADY_REG, '该手机号已注册'))
    const onGoLogin = vi.fn()
    useAccount.setState({ bindSheet: { open: true, reason: 'coupon' } })
    render(<BindSheet onGoLogin={onGoLogin} />)
    await fillAndSubmit()

    await vi.waitFor(() => expect(document.querySelector('[data-bind-taken]')).not.toBeNull())
    /* 红字那一行不再单独出现 —— 同一个意思写两遍，看起来像两个错 */
    expect(document.querySelector('[data-bind-error]')).toBeNull()

    const go = document.querySelector('[data-bind-gologin]') as HTMLElement
    expect(go.textContent).toContain('13800138000')

    await userEvent.click(go)
    expect(onGoLogin).toHaveBeenCalledWith('13800138000')
    /* 面板自己关掉：登录面板叠在它上面会变成两个输入框 */
    expect(useAccount.getState().bindSheet.open).toBe(false)
  })

  it('别的错误仍然只显示红字（别把分支写成「只要失败就给登录按钮」）', async () => {
    /* 验证码错 / 网络断 —— 这些跟「号码被占」是两回事，去登录毫无意义 */
    bindApi.mockRejectedValueOnce(new ApiError(10010302, '验证码不正确'))
    const onGoLogin = vi.fn()
    useAccount.setState({ bindSheet: { open: true, reason: 'coupon' } })
    render(<BindSheet onGoLogin={onGoLogin} />)
    await fillAndSubmit()

    await vi.waitFor(() => expect(document.querySelector('[data-bind-error]')).not.toBeNull())
    expect(document.querySelector('[data-bind-taken]')).toBeNull()
    expect(document.querySelector('[data-bind-gologin]')).toBeNull()
  })

  it('关掉再打开是干净的（上一次的红字不许留到下一次）', async () => {
    bindApi.mockRejectedValueOnce(new ApiError(MOBILE_ALREADY_REG, '该手机号已注册'))
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet onGoLogin={vi.fn()} />)
    await fillAndSubmit()
    await vi.waitFor(() => expect(document.querySelector('[data-bind-taken]')).not.toBeNull())

    /* 「以后再说」关掉，再点横条打开 —— 用户什么都还没做 */
    await userEvent.click(document.querySelector('[data-bind-later]') as HTMLElement)
    expect(useAccount.getState().error).toBeNull()
    act(() => useAccount.getState().openBind('manual'))

    expect(document.querySelector('[data-bind-taken]')).toBeNull()
    expect(document.querySelector('[data-bind-error]')).toBeNull()
  })

  it('改了号码再提交，出路就收回去（不然会一直挂着上一个号）', async () => {
    bindApi.mockRejectedValueOnce(new ApiError(MOBILE_ALREADY_REG, '该手机号已注册'))
    useAccount.setState({ bindSheet: { open: true, reason: 'manual' } })
    render(<BindSheet onGoLogin={vi.fn()} />)
    await fillAndSubmit()
    await vi.waitFor(() => expect(document.querySelector('[data-bind-taken]')).not.toBeNull())

    /* ★ 一改号码，那一块就收回去：按钮上写的「用 138… 登录」已经不是
       输入框里那个号了，留着就是一句看着很像真的假话。 */
    bindApi.mockResolvedValueOnce({ ...user(false), mobile: '13900000000' })
    const box = document.querySelector('[data-bind-mobile]') as HTMLInputElement
    await userEvent.clear(box)
    await userEvent.type(box, '13900000000')
    expect(document.querySelector('[data-bind-taken]')).toBeNull()

    await userEvent.click(document.querySelector('[data-bind-submit]') as HTMLElement)

    await vi.waitFor(() => expect(useAccount.getState().bindSheet.open).toBe(false))
    expect(useAccount.getState().errorCode).toBeNull()
  })
})
