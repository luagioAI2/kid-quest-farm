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
   * 三种状态客户端都会渲染（`MerchantView` 的 `AppliedBody`）：
   * pending 等审核 / approved 出后台链接 / rejected 说没通过 + 原因。
   *
   * ⚠️ 渲染层**不要**用 `status` 决定「有没有后台链接」——
   * 那是 `admin_url` 在不在决定的（拒绝时服务端会把它清空）。
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

/**
 * 兑换码结果（`/api/wish/redeem-code`）
 *
 * ⚠️ 服务端**在同一个事务里**做完了三件事：验码 → 标记已用 → 授予游戏。
 * 所以「拿到 `unlocked: true`」就等于「游戏已经在他的 `user_game` 里了」，
 * 客户端**不需要也不能**再调一次「解锁游戏」—— 那样会出现两套拥有关系。
 */
export interface ApiWishCodeResult {
  /** 脱敏后的码（只回后 4 位），不是明文 */
  code: string
  /** 码对应的心愿商品 id（`wish-game-xxx`） */
  item_id: string
  unlocked: boolean
  /**
   * 解锁到的游戏 id（`cloudfarm` / `prizepark` …）。
   *
   * 只有「这个码是游戏卡」时才有。换券类、实物类的码没有这个字段 ——
   * 所以调用方**必须先判它存不存在**，不能默认有游戏。
   *
   * ⚠️ 盲盒卡是多款，这个字段写**第一款**（给不认 `game_ids` 的老客户端兜底）。
   *    判「一共开了几款」只能看 `game_ids`。
   */
  game_id?: string
  /**
   * 这张码一共授了哪几款（2026-11-12 起）。
   *
   * 线下卖的「盲盒 5 连」是**一张卡换一次 5 连开**，所以这里可能是 5 个 id。
   * 单款游戏卡是 1 个；券 / 实物卡没有这个字段。
   *
   * ⚠️ 别用 `game_id` 拼清单：盲盒卡只看它会漏掉其余 4 款，
   *    界面上会写「开出 1 款」而后台明明授了 5 款 —— 而这种错
   *    **不报错、不崩**，只是数字不对。
   */
  game_ids?: string[]
  /** 顺带送的兑换券数（有就记，没有就是 0/缺省） */
  vouchers?: number
}
