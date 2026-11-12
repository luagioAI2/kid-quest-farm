import { api } from './client'

/* ============================================================
   在线版 · 主线活动（tf-platform-api `/api/campaign/*`）
   ------------------------------------------------------------
   在线版的「拥有关系」只认服务端（`user_game`），所以**领奖必须由服务端
   真正把游戏授下去** —— 客户端自己写一笔本地账本是不够的：换台设备登录
   就没了，而且存档写不进去（服务端 `checkGameExists` 要 `user_game` 有行）。

   ⚠️ 服务端会**自己再算一遍进度**（`task_instance` 计数 + 券的累计入账），
      不信任客户端报上来的数字。所以这里只传 `step_id`，不传任何进度值 ——
      传了也不会被采信，反而会让人误以为「客户端说了算」。
   ============================================================ */

/** 服务端对一关的判定 */
export interface ServerCampaignStep {
  id: string
  game_id: string
  /** 已经领过 */
  claimed: boolean
  /** 服务端算的当前值 */
  have: number
  /** 目标值（服务端那份配置，可能和客户端不同 ⇒ 见下） */
  target: number
}

export interface ServerCampaignState {
  steps: ServerCampaignStep[]
  /** 服务端算的两个指标，用于对账（客户端展示仍用本地算的那份） */
  tasks_done: number
  coupons_earned: number
}

/**
 * 拉一次服务端状态（领了哪些、服务端算出来的进度）。
 *
 * ★ 客户端**也**会自己算一份进度（`domain/campaign.ts`）用于渲染：
 *   本地版没有服务端，必须有那份；两种模式共用同一套渲染，才不会出现
 *   「线上和单机版显示两个数字」。
 *   这里返回的值只用来做两件事：① 标记哪几关已领；② 领奖后对账。
 */
export const fetchCampaignState = () =>
  api<ServerCampaignState>('/campaign/state', {})

/** 领一关。服务端会复核条件，不满足就拒（码不会被白白消耗）。 */
export const claimCampaignStep = (stepId: string) =>
  api<{ step_id: string; game_id: string; already: boolean }>('/campaign/claim', {
    step_id: stepId,
  })
