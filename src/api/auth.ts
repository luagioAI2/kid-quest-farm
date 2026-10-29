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

export const login = (mobile: string, password: string) =>
  api<AuthResult>('/auth/login', { mobile, password }, { auth: false })

export const register = (mobile: string, password: string, code: string, nickname?: string) =>
  api<AuthResult>(
    '/auth/register',
    { mobile, password, code, ...(nickname ? { nickname } : {}) },
    { auth: false },
  )

/** 当前账号资料（手机号是脱敏的，见 `ApiUser.mobile`） */
export const profile = () => api<ApiUser>('/user/profile')

export const logout = () => api<{ ok: boolean }>('/auth/logout')
