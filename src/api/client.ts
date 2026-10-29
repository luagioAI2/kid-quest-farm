import { getSession, getToken, sessionFrom, setSession } from './session'
import type { ApiUser } from './types'

/* ============================================================
   后端连接层（2026-10-29）
   ------------------------------------------------------------
   服务端是 `tf-platform-api`（Go + Gin）。它的约定和常见 REST 不一样，
   三条必须记住（`docs/API_CONVENTIONS.md`）：

     1. **一律 POST + JSON**，路径 `/api/{模块}/{动作}`；
     2. **业务失败也是 HTTP 200** —— 只看 `body.code`（200 = 成功）。
        只判 `res.ok` 的代码会把「余额不足」当成功，然后把 undefined 当数据用；
     3. 字段 `snake_case`、时间 Unix 秒、金额字符串。

   为什么要有这一层、而不是组件里直接 `fetch`：
   「带 token / 判 code / 401 清登录态」这三件事只要写在三个地方，
   第三个地方就一定会漏。漏了的表现不是报错，是**静默失败**
   （401 被当成业务错误提示「操作失败」，人以为自己点错了）。
   ============================================================ */

/**
 * 后端地址。
 *
 * 默认 `127.0.0.1:8090` —— 本地跑 `tf-platform-api` 的端口
 * （**不是 8080**：这台机器上 8080 常年被别的 node 服务占着，
 *  而且占着的时候 `curl` 照样有响应，看着像「服务起来了」）。
 *
 * 打包给真机时用 `VITE_API_BASE=https://api.example.com` 覆盖。
 */
export const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8090').replace(
  /\/+$/,
  '',
)

/** 一次请求最多等多久（毫秒）。断网时 fetch 会挂很久，孩子只会看到「转圈」。 */
const TIMEOUT_MS = 12_000

/** 业务错误 / 网络错误统一成这个，调用方只认 `code` 和 `message` */
export class ApiError extends Error {
  /** 服务端 `body.code`；网络层失败用 `NETWORK`（负数，不会和服务端撞） */
  readonly code: number

  constructor(code: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }

  /** 连不上 / 超时 / 返回的不是 JSON —— 都归这一类 */
  get isNetwork() {
    return this.code === NETWORK
  }

  /** 登录过期或没登录 */
  get isAuth() {
    return this.code === UNAUTHORIZED
  }
}

export const NETWORK = -1
/** 客户端自己用的 401，不是服务端的业务码（服务端 401 时 body 可能没有 code） */
export const UNAUTHORIZED = 401

/** 登录态没了的时候调它（由 `useAccount` 注册，避免 client 依赖 store） */
let onAuthLost: (() => void) | null = null
export function bindAuthLost(fn: (() => void) | null) {
  onAuthLost = fn
}

interface Resp<T> {
  code: number
  error?: string
  data?: T
}

/** `/auth/login`、`/auth/register`、`/auth/refresh` 共用的返回形状 */
interface TokenPair {
  access_token: string
  refresh_token: string
  expires_in: number
  user: ApiUser
}

/**
 * 用 refresh token 换一套新 token。
 *
 * ## 为什么必须有这一步
 *
 * 服务端 access token 只给 **2 小时**，而 `refresh_token` 给 7 天。
 * 2026-10-30 之前客户端**只存不用**：两小时一到，所有在线动作都变成
 * 「登录已过期，请重新登录」，登录态被清掉。对一个家长一周开两次的 App，
 * 等于每次打开都要重新输手机号 + 密码 + 短信码。
 *
 * ## 三条实现约束
 *
 * ① **并发的 401 只刷新一次**（`refreshing` 这个 promise 就是锁）。
 *    一屏同时发三个请求时，三个 401 各刷一次的话，服务端会**轮换**三次
 *    refresh token（旧 token 立即失效）—— 后两次必然失败，
 *    登录态被自己清掉。
 * ② **用裸 fetch，不走 `api()`** —— 走 `api()` 会在 401 时再触发一次刷新，
 *    无限递归；而且刷新接口本身不该带旧 token。
 * ③ **失败一律返回 false，不抛**。调用方决定是「重试一次」还是「清登录态」。
 */
let refreshing: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (refreshing) return refreshing

  const s = getSession()
  if (!s?.refreshToken) return false

  refreshing = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refreshToken }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) return false
      const payload = (await res.json()) as Resp<TokenPair>
      if (payload.code !== 200 || !payload.data) return false
      setSession(sessionFrom(payload.data))
      return true
    } catch {
      // 断网 / 超时 / 返回不是 JSON —— 都算「这次刷不了」，交给调用方处理
      return false
    } finally {
      refreshing = null
    }
  })()

  return refreshing
}

/**
 * 发一个请求，成功返回 `data`，失败抛 `ApiError`。
 *
 * @param path 模块/动作，**不带 `/api` 前缀**（如 `/auth/login`）
 */
export async function api<T>(
  path: string,
  body: Record<string, unknown> = {},
  opts: { auth?: boolean; _retried?: boolean } = {},
): Promise<T> {
  /* 已经过期就先换一套，省掉一次必然失败的往返。
     `auth: false` 的接口（登录 / 发码）不碰这一步 —— 那时候本来就没有会话。 */
  if (opts.auth !== false && !opts._retried) {
    const s = getSession()
    if (s && s.expiresAt * 1000 <= Date.now()) await refreshSession()
  }

  const token = getToken()
  // `auth: false` 用于登录这类「本来就没有 token」的接口 ——
  // 但已经登录时仍然带上，服务端能借它做风控
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token && opts.auth !== false) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (e) {
    const name = (e as { name?: string })?.name
    throw new ApiError(
      NETWORK,
      name === 'TimeoutError' ? '服务器没有响应，请稍后再试' : '连不上服务器，请检查网络',
    )
  }

  if (res.status === 401) {
    /* 先试一次「换票再重放」。服务端 401 有两种：token 过期（换票能救）
       和账号被停用（换票救不了，服务端会继续给 401）。
       `_retried` 保证只重放一次 —— 不然服务端一直 401 就是死循环。 */
    if (opts.auth !== false && !opts._retried && (await refreshSession())) {
      return api<T>(path, body, { ...opts, _retried: true })
    }
    // token 过期 / 被踢：把本地登录态清掉，让人重新登 ——
    // 否则他会一直点、一直「失败」，而界面上没有任何提示说该重登
    onAuthLost?.()
    throw new ApiError(UNAUTHORIZED, '登录已过期，请重新登录')
  }

  let payload: Resp<T>
  try {
    payload = (await res.json()) as Resp<T>
  } catch {
    // 网关/代理返回的 HTML 错误页也会走到这里（本地端口被别的服务占着时最常见）
    throw new ApiError(NETWORK, '服务器返回的不是 JSON，请检查后端地址')
  }

  if (payload.code !== 200) {
    throw new ApiError(payload.code, payload.error || `请求失败（${payload.code}）`)
  }
  return payload.data as T
}
