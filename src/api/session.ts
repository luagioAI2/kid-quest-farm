import type { ApiUser } from './types'

/**
 * 登录态（2026-10-29 起）。
 *
 * 为什么单独一个模块、不塞进 `useApp`：
 *   · `useApp` 是**离线数据**的家（Dexie + 一屏一屏的业务状态），
 *     登录态是**设备级**的（换手机要重登，换存档不该丢）；
 *   · 更要紧的是循环依赖：`client.ts` 要读 token，`useAccount` 要调 `client`。
 *     把 token 放中间这一层，两边都不 import 对方。
 *
 * 存 `localStorage` 不存 Dexie：Dexie 是「孩子的数据」，会跟着导出/导入走。
 * 把 token 塞进去等于**导出一份存档就把登录态送给了别人**。
 */

const KEY = 'kqf.api.session.v1'

export interface Session {
  token: string
  refreshToken: string
  user: ApiUser
  /** access token 到期时间（Unix 秒）。服务端 2 小时。 */
  expiresAt: number
}

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s || typeof s.token !== 'string' || !s.token || !s.user) return null
    return s
  } catch {
    // 存的东西坏了就当没登录 —— 别让一条脏数据把整个 App 卡在启动阶段
    return null
  }
}

let current: Session | null = load()

export const getSession = (): Session | null => current
export const getToken = (): string | null => current?.token ?? null

export function setSession(next: Session | null): void {
  current = next
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next))
    else localStorage.removeItem(KEY)
  } catch {
    /* 隐私模式 / 配额满：内存里这份仍然有效，只是重启后要重登 */
  }
}

/** 从 `/api/auth/*` 的 data 造一份会话 */
export function sessionFrom(data: {
  access_token: string
  refresh_token: string
  expires_in: number
  user: ApiUser
}): Session {
  return {
    token: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
    // 留 60 秒余量：别拿着「还有 0.3 秒」的 token 去发请求
    expiresAt: Math.floor(Date.now() / 1000) + Math.max(0, data.expires_in - 60),
  }
}
