import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, GUEST_NEED_BIND, NETWORK, UNAUTHORIZED, api, bindAuthLost, bindGuestBlocked } from './client'
import { getSession, setSession } from './session'
import type { ApiUser } from './types'

/* ============================================================
   连接层（`src/api/client.ts`）
   ------------------------------------------------------------
   这一层只有三件事，但每一件写错都不报错：

     ① 业务失败也是 **HTTP 200**（服务端约定）⇒ 只判 `res.ok` 会把
        「余额不足」当成功，然后把 undefined 当数据用；
     ② 401 要**清登录态**，否则人一直点、一直失败，界面不给任何提示；
     ③ 连不上 / 返回 HTML 要归成「网络问题」，别让它伪装成业务错误。

   所以这里全用假的 `fetch`，把这三条钉死。
   ============================================================ */

const jsonOnce = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue({
    status,
    json: async () => body,
  } as unknown as Response)

afterEach(() => {
  vi.restoreAllMocks()
  setSession(null)
  bindAuthLost(null)
  /* 游客闸门的回调也要清：它是**模块级**的，不清的话上一条测试注册的
     spy 会活到下一条里，`toHaveBeenCalled` 就会红在一个和自己无关的地方。 */
  bindGuestBlocked(null)
})

describe('client：统一响应', () => {
  it('code === 200 时返回 data（不是整个 body）', async () => {
    vi.stubGlobal('fetch', jsonOnce({ code: 200, data: { ok: 1 } }))
    await expect(api('/ping')).resolves.toEqual({ ok: 1 })
  })

  it('★ 业务失败也是 HTTP 200 —— 必须看 body.code', async () => {
    vi.stubGlobal('fetch', jsonOnce({ code: 10020301, error: '余额不足' }))
    const e = await api('/x').catch((err: unknown) => err)
    expect(e).toBeInstanceOf(ApiError)
    expect((e as ApiError).code).toBe(10020301)
    expect((e as ApiError).message).toBe('余额不足')
  })

  it('没有 error 文案时给一句能看的兜底（别把 undefined 显示给人）', async () => {
    vi.stubGlobal('fetch', jsonOnce({ code: 500 }))
    const e = await api('/x').catch((err: unknown) => err)
    expect((e as ApiError).message).toContain('500')
  })
})

describe('client：登录态', () => {
  const user: ApiUser = {
    uid: 3,
    username: '',
    mobile: '138****8000',
    mobile_verified: true,
    nickname: 'n',
    avatar: '',
    gender: 0,
    language: 'zh',
    is_guest: false,
    has_password: true,
    has_wechat: false,
    created_at: 1,
  }

  it('有 token 时带 Authorization: Bearer', async () => {
    setSession({ token: 'abc', refreshToken: 'r', user, expiresAt: 9_999_999_999 })
    const f = jsonOnce({ code: 200, data: null })
    vi.stubGlobal('fetch', f)
    await api('/x')
    const init = (f.mock.calls[0] as unknown[])[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
  })

  it('★ 401 清登录态，并报「登录已过期」', async () => {
    setSession({ token: 'abc', refreshToken: 'r', user, expiresAt: 9_999_999_999 })
    const lost = vi.fn()
    bindAuthLost(lost)
    vi.stubGlobal('fetch', jsonOnce({}, 401))

    const e = await api('/x').catch((err: unknown) => err)
    expect((e as ApiError).code).toBe(UNAUTHORIZED)
    expect((e as ApiError).isAuth).toBe(true)
    expect(lost, '401 必须通知上层清登录态').toHaveBeenCalledTimes(1)
  })

  /* ---- 换票（2026-10-30） ----
   *
   * access token 只给 2 小时，refresh token 给 7 天。原来客户端**只存不用**：
   * 两小时一到，所有在线动作都变成「登录已过期」，登录态被清掉 ——
   * 一个家长一周开两次的 App，等于每次都要重输手机号 + 密码 + 短信码。
   */
  const okJson = (data: unknown) =>
    ({ ok: true, status: 200, json: async () => ({ code: 200, data }) }) as unknown as Response
  const unauthorized = () =>
    ({ ok: false, status: 401, json: async () => ({}) }) as unknown as Response

  it('★ 401 时先换票、再重放一次（不是直接把人踢出去）', async () => {
    setSession({ token: 'old', refreshToken: 'r1', user, expiresAt: 9_999_999_999 })
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const auth = (init.headers as Record<string, string>)?.Authorization ?? '-'
        seen.push(`${url.replace('http://127.0.0.1:8090', '')} ${auth}`)
        if (url.endsWith('/api/auth/refresh')) {
          return okJson({ access_token: 'new', refresh_token: 'r2', expires_in: 7200, user })
        }
        return auth === 'Bearer new' ? okJson({ ok: 1 }) : unauthorized()
      }),
    )

    await expect(api('/x')).resolves.toEqual({ ok: 1 })
    expect(seen, '第一次 401 → 换票 → 带新票重放').toEqual([
      '/api/x Bearer old',
      '/api/auth/refresh -',
      '/api/x Bearer new',
    ])
    expect(getSession()?.token, '新票要写回会话（否则下一次又 401）').toBe('new')
    expect(getSession()?.refreshToken, 'refresh token 服务端会轮换，旧的立即失效').toBe('r2')
  })

  it('★ 换票也失败 ⇒ 清登录态，且**不无限重放**', async () => {
    setSession({ token: 'old', refreshToken: 'r1', user, expiresAt: 9_999_999_999 })
    const lost = vi.fn()
    bindAuthLost(lost)
    const f = vi.fn().mockResolvedValue(unauthorized())
    vi.stubGlobal('fetch', f)

    const e = await api('/x').catch((err: unknown) => err)
    expect((e as ApiError).code).toBe(UNAUTHORIZED)
    expect(lost).toHaveBeenCalledTimes(1)
    // 原请求 + 换票，一共两次；再来第三次就是死循环
    expect(f).toHaveBeenCalledTimes(2)
    /* ⚠️ 这里**不**断言 `getSession() === null`：清登录态是 `useAccount.clear`
       的事（通过 `bindAuthLost` 注册进来）。测试里换成假的 `lost`，
       会话当然还在 —— 断言它会是「测一个没实现的期望」。 */
    expect((e as ApiError).message).toContain('登录已过期')
  })

  it('★ 并发两个请求同时 401 ⇒ 只换一次票（服务端会轮换，换两次后一次必失败）', async () => {
    setSession({ token: 'old', refreshToken: 'r1', user, expiresAt: 9_999_999_999 })
    let refreshCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const auth = (init.headers as Record<string, string>)?.Authorization ?? '-'
        if (url.endsWith('/api/auth/refresh')) {
          refreshCount += 1
          await new Promise((r) => setTimeout(r, 20))
          return okJson({ access_token: 'new', refresh_token: 'r2', expires_in: 7200, user })
        }
        return auth === 'Bearer new' ? okJson({ ok: 1 }) : unauthorized()
      }),
    )

    await Promise.all([api('/a'), api('/b')])
    expect(refreshCount, '两次刷新会让第二次拿到已失效的 refresh token').toBe(1)
  })

  it('★ 已经过期 ⇒ 发请求前先换票（省掉一次必然 401 的往返）', async () => {
    setSession({ token: 'old', refreshToken: 'r1', user, expiresAt: 1 })
    const seen: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const auth = (init.headers as Record<string, string>)?.Authorization ?? '-'
        seen.push(`${url.replace('http://127.0.0.1:8090', '')} ${auth}`)
        if (url.endsWith('/api/auth/refresh')) {
          return okJson({ access_token: 'new', refresh_token: 'r2', expires_in: 7200, user })
        }
        return okJson({ ok: 1 })
      }),
    )

    await api('/x')
    expect(seen[0], '第一个请求就该是换票，不是带着过期票去撞 401').toBe('/api/auth/refresh -')
    expect(seen[1]).toBe('/api/x Bearer new')
  })

  it('登录接口（auth: false）不带 token', async () => {
    setSession({ token: 'abc', refreshToken: 'r', user, expiresAt: 9_999_999_999 })
    const f = jsonOnce({ code: 200, data: null })
    vi.stubGlobal('fetch', f)
    await api('/auth/login', {}, { auth: false })
    const init = (f.mock.calls[0] as unknown[])[1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })
})

describe('client：网络问题', () => {
  it('fetch 抛错 ⇒ 网络错误（不是业务错误）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const e = await api('/x').catch((err: unknown) => err)
    expect((e as ApiError).code).toBe(NETWORK)
    expect((e as ApiError).isNetwork).toBe(true)
    expect((e as ApiError).message).toContain('连不上服务器')
  })

  it('超时单独一句话（别和「连不上」混在一起）', async () => {
    const err = new Error('timeout')
    err.name = 'TimeoutError'
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(err))
    const e = await api('/x').catch((x: unknown) => x)
    expect((e as ApiError).message).toContain('没有响应')
  })

  it('★ 返回的不是 JSON（网关 HTML 错误页）⇒ 网络错误', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token <')
        },
      } as unknown as Response),
    )
    const e = await api('/x').catch((err: unknown) => err)
    expect((e as ApiError).code).toBe(NETWORK)
    expect((e as ApiError).message).toContain('不是 JSON')
  })
})

/* ---- 游客花券的闸门（2026-11-03） ----
 *
 * 「游客第一次花券就卡」这句承诺，服务端有单测、界面有弹层，
 * 但**中间那一跳没人守**：服务端回 10010802 → 拦截器 → `onGuestBlocked`
 * → store 打开「保存进度」面板。这一跳写错的表现是
 * 「点了兑换，转一圈，什么都没发生」，界面上没有任何线索。
 *
 * 顺带把反向也钉住：**别的错误码不能弹它**。否则「余额不足」「库存不足」
 * 都会弹出「保存进度」，家长会以为是自己账号的问题。
 */
describe('client：游客花券的闸门', () => {
  it('★ 10010802 ⇒ 弹「保存进度」，并且照常抛错（调用方还要提示原因）', async () => {
    const blocked = vi.fn()
    bindGuestBlocked(blocked)
    vi.stubGlobal('fetch', jsonOnce({ code: GUEST_NEED_BIND, error: 'guest-need-bind' }))

    const e = await api('/mall/redeem/create').catch((err: unknown) => err)
    expect(blocked, '拦截器必须通知上层弹面板').toHaveBeenCalledTimes(1)
    /* 抛错不能省：调用方要靠它决定「这次兑换没生效」，不抛等于假装成功 */
    expect(e).toBeInstanceOf(ApiError)
    expect((e as ApiError).code).toBe(GUEST_NEED_BIND)
  })

  it('★ 别的业务错误不弹它（「余额不足」不该说成「先绑定手机号」）', async () => {
    const blocked = vi.fn()
    bindGuestBlocked(blocked)
    vi.stubGlobal('fetch', jsonOnce({ code: 10020301, error: '余额不足' }))

    const e = await api('/x').catch((err: unknown) => err)
    expect(blocked).not.toHaveBeenCalled()
    expect((e as ApiError).code).toBe(10020301)
  })

  it('★ 401 也不弹它（那是登录过期，走 `onAuthLost` 那条）', async () => {
    const blocked = vi.fn()
    bindGuestBlocked(blocked)
    vi.stubGlobal('fetch', jsonOnce({}, 401))

    const e = await api('/x').catch((err: unknown) => err)
    expect(blocked).not.toHaveBeenCalled()
    expect((e as ApiError).code).toBe(UNAUTHORIZED)
  })

  it('回调可以注销（否则测试之间互相串，App 卸载后还会弹）', async () => {
    const blocked = vi.fn()
    bindGuestBlocked(blocked)
    bindGuestBlocked(null)
    vi.stubGlobal('fetch', jsonOnce({ code: GUEST_NEED_BIND, error: 'guest-need-bind' }))

    await api('/x').catch(() => {})
    expect(blocked).not.toHaveBeenCalled()
  })
})
