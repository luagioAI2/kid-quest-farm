import { api } from './client'
import type { ApiUser, AuthResult } from './types'

/* ============================================================
   账号（tf-platform-api `/api/auth/*`）
   ------------------------------------------------------------
   为什么要账号：招商、心愿、兑换这些「要审核 / 要分账」的事，
   服务端得知道**是谁**。用户原话：
   「点申请即可。不需要填 称呼 这些。**因为会根据当前账号，申请**。」

   ⚠️ 注册要短信验证码（`code` 6 位）。本地跑服务时验证码**不进短信**，
      而是打在服务端日志里（`DEV SMS CODE`）—— 别在客户端「假装」验证通过。
   ============================================================ */

export type SmsScene = 'register' | 'login' | 'reset_password' | 'bind_mobile'

export const sendSmsCode = (mobile: string, scene: SmsScene) =>
  api<{ sent: boolean }>('/auth/send-sms-code', { mobile, scene }, { auth: false })

/**
 * 游客进入：按设备号建号或取号。
 *
 * 这是在线版**默认的进门方式** —— App 一启动就调它，孩子不用注册、
 * 不用等验证码就能玩。等他挣到券、想兑换了，再让他绑手机号
 * （`bindMobile`），绑的是**同一个 uid**，进度原地不动。
 *
 * 同一台设备重复调用返回同一个账号（`is_new_user=false`），
 * 所以「重开 App」「断网重连」都可以放心再调一次。
 */
export const guest = (deviceId: string) =>
  api<AuthResult>('/auth/guest', { device_id: deviceId }, { auth: false })

/**
 * 绑定手机号：游客转正 / 微信用户补手机号。
 *
 * 服务端只往**同一个 uid** 上加 `mobile` / `password` / `is_guest=false`，
 * 积分、流水、农场、存档、家长设置全都不动 —— 所以绑完不用迁移任何东西。
 * 返回的是最新资料（含 `is_guest=false`），调用方直接拿它更新会话，
 * 不必再打一次 `/user/profile`（那中间会闪一帧「临时账号」）。
 */
export const bindMobile = (mobile: string, code: string, password?: string) =>
  api<ApiUser>(
    '/auth/bind-mobile',
    { mobile, code, ...(password ? { password } : {}) },
  )

export const login = (mobile: string, password: string) =>
  api<AuthResult>('/auth/login', { mobile, password }, { auth: false })

export const register = (mobile: string, password: string, code: string, nickname?: string) =>
  api<AuthResult>(
    '/auth/register',
    { mobile, password, code, ...(nickname ? { nickname } : {}) },
    { auth: false },
  )

/**
 * 忘记密码：验证码 + 新密码。
 *
 * 服务端在改完之后会 `RevokeAllByUID` —— **所有设备一起下线**。
 * 所以重置成功后客户端不该再假装还登着（本来这里也是在未登录态调用的）。
 */
export const resetPassword = (mobile: string, code: string, password: string) =>
  api<{ reset: boolean }>(
    '/auth/reset-password',
    { mobile, code, new_password: password },
    { auth: false },
  )

/** 当前账号资料（手机号是脱敏的，见 `ApiUser.mobile`） */
export const profile = () => api<ApiUser>('/user/profile')

export const logout = () => api<{ ok: boolean }>('/auth/logout')
