/**
 * 后端（tf-platform-api）返回的数据形状。
 *
 * ⚠️ **字段名照抄服务端**（`snake_case`），别在这里改成驼峰再「美化」一遍 ——
 * 改名要写一层映射，而映射写错的表现是「字段永远 undefined」，零报错。
 * 约定见 `tf-platform-api/docs/API_CONVENTIONS.md` §6。
 *
 * 时间一律 **Unix 秒**（不是毫秒）。要喂给 `new Date()` 记得 ×1000。
 */

/** 登录 / 注册返回的用户资料 */
export interface ApiUser {
  uid: number
  username: string
  /**
   * 手机号 —— **服务端脱敏过**（`138****8000`）。
   * ⚠️ 所以客户端**拿不到明文手机号**：要联系方式的字段（比如招商申请的
   * `contact`）只能由服务端从账号里取，别指望这里补。
   */
  mobile: string
  mobile_verified: boolean
  nickname: string
  avatar: string
  gender: number
  language: string
  is_guest: boolean
  has_password: boolean
  has_wechat: boolean
  created_at: number
}

/** `/api/auth/login`、`/api/auth/register` 的 data */
export interface AuthResult {
  access_token: string
  refresh_token: string
  /** access token 有效期（秒） */
  expires_in: number
  user: ApiUser
  is_new_user: boolean
}

/** 招商申请单（`/api/merchant/my`） */
export interface ApiMerchantApplication {
  id: number
  role: 'parent' | 'merchant'
  /**
   * ⚠️ 服务端有 `rejected`，客户端这一版**还没渲染**那一档
   * （见 `tf-platform-api/docs/MERCHANT.md` §4：已知不一致，不是 bug）。
   * 所以这里把三种都列出来，渲染层只认 pending / approved。
   */
  status: 'pending' | 'approved' | 'rejected'
  status_text: string
  name: string
  contact: string
  note: string
  /**
   * 后台地址。**只有 `approved` 时服务端才返回** ——
   * 客户端不要自己判断「这个状态该不该渲染」，`undefined` 就是不渲染。
   */
  admin_url?: string
  created_at: number
  reviewed_at: number
}

/** 家长侧的邀请统计（`/api/merchant/invite-stats`） */
export interface ApiInviteStats {
  invited_total: number
  invited_approved: number
  /** 分成金额：**故意留空**，结算规则定下来之前不编数字 */
  share_amount: string | null
  share_note: string
}
