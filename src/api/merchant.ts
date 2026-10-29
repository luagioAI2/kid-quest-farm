import { api } from './client'
import type { ApiInviteStats, ApiMerchantApplication } from './types'

/* ============================================================
   招商（tf-platform-api `/api/merchant/*`）
   ------------------------------------------------------------
   客户端只做「提交」那一半；`approved` + `admin_url` **只能由后台回填**
   （`tf-platform-api/docs/MERCHANT.md`）。所以这里**没有**任何
   能把状态推到 approved 的接口 —— 有的话就是给所有用户凭空发后台入口。

   ⚠️ `name` / `contact` 可以**不传**：服务端从账号取
   （昵称 + 手机号）。客户端手上也没有明文手机号（登录响应里是
   `138****8000`），传了反而可能是假号码。
   ============================================================ */

export const applyMerchant = (role: 'parent' | 'merchant', note?: string) =>
  api<ApiMerchantApplication>('/merchant/apply', {
    role,
    ...(note ? { note } : {}),
  })

/** 我的申请。`admin_url` 只在 approved 时出现（服务端抑制） */
export const myMerchant = () =>
  api<{ applications: ApiMerchantApplication[] }>('/merchant/my')

export const inviteStats = () => api<ApiInviteStats>('/merchant/invite-stats')
