import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NETWORK, UNAUTHORIZED, api, bindAuthLost } from './client'
import { setSession } from './session'
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
