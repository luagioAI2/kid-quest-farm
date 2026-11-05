import { api } from './client'

/* ============================================================
   模板下发 / 邀请码（tf-platform-api `/api/template/*`）
   ------------------------------------------------------------
   ## 这一层解决什么

   App 首启的内容（每日任务、签到、长期任务、兑换清单）原来**硬编码**在
   `src/domain/seedTasks.ts` 里。运营想改一条默认任务、商家想给自己推广的
   用户换一套，只能发版。现在它们变成后台可配的「模板」，这一层负责取。

   ## 三个接口的分工

   | 接口            | 干什么                                        | 幂等 |
   | --------------- | --------------------------------------------- | ---- |
   | `/resolve`      | 只读：把「我该用的那份模板」原样给我           | 是   |
   | `/bind-invite`  | 把邀请码写到我身上（**只有第一次算数**）       | 是   |
   | `/apply`        | 按模板在**服务端**铺出我的任务 / 兑换清单      | 是   |

   ★ `/apply` 必须在服务端铺，不能在客户端写本地 Dexie：
     在线版的数据源是账号，本地那几行服务端不知道 —— 下一次 pull 就被
     覆盖掉，表现是「一进来有 16 条任务，过两秒全没了」，而且不报错。

   ★ 顺序不能反：先 `bind-invite` 再 `apply`。反过来的话 apply 那一刻
     我身上还没有商家归属，铺出来的是官方模板 —— 而 apply 一辈子只铺一次，
     这个错误**永远修不回来**（除非人工改库）。
   ============================================================ */

/**
 * 模板条目：**typed 列（snake_case）+ 玩法参数（camelCase）** 合成的一个 map。
 *
 * 两种键名故意不重叠，所以运营在后台改「基础积分」不会被 Extra 里的旧值盖掉。
 * 这里只声明我们真的要读的那几个，其余原样留着（`Record` 兜底）。
 */
export interface TemplateItemRow {
  item_id: string
  name: string
  emoji?: string
  category?: string
  cycle?: string
  planned_minutes?: number
  base_points?: number
  price?: number
  note?: string
  limit_per_day?: number
  stock?: number
  once?: boolean
  sort?: number
  [key: string]: unknown
}

/** `/api/template/resolve` 的 data */
export interface ResolvedTemplate {
  template_id: number
  name: string
  kind: 'task' | 'redeem'
  /** `official` = 官方兜底；`merchant` = 商家自定义 */
  scope: 'official' | 'merchant'
  /** 商家模板的归属（官方是 0） */
  owner_uid: number
  is_default: boolean
  /** 这个账号是被哪个商家推广来的（0 = 官方渠道） */
  source_merchant_uid: number
  items: TemplateItemRow[]
}

/** `/api/template/apply` 的 data */
export interface TemplateApplyResult {
  /** 本次是否真的铺了（false = 以前铺过 / 账号本来就有内容） */
  applied: boolean
  /** `''` 铺了；`already` 铺过；`has-content` 账号本来就有内容 */
  reason: string
  task_template_id: number
  redeem_template_id: number
  task_count: number
  redeem_count: number
  source_merchant_uid: number
}

/**
 * 取「我该用的那份模板」（只读）。
 *
 * 目前 App 走的是 `/apply`（服务端铺实例 + pull 回来），`resolve` 留给
 * 「家长想看看这套默认内容长什么样」这类只读场景 —— 别拿它去写本地库。
 */
export const resolveTemplate = (kind: 'task' | 'redeem') =>
  api<ResolvedTemplate>('/template/resolve', { kind })

/**
 * 绑定商家邀请码。
 *
 * 服务端三道闸：码的校验位、那个 uid 必须是**已审核通过**的商家、
 * 已经归属过的账号**不覆盖**（第一次算数）。
 * 所以「填错了码」「码是家长的」「我已经是别人推来的」都会在这里被拒 ——
 * 调用方要把这当成**正常分支**，别抛给用户看。
 */
export const bindInvite = (inviteCode: string) =>
  api<{ source_merchant_uid: number; invite_code: string }>('/template/bind-invite', {
    invite_code: inviteCode,
  })

/**
 * 按模板铺一次初始任务 / 兑换清单（服务端写库，幂等）。
 *
 * 每次启动都可以放心调：铺过就直接返回 `applied=false`，
 * 一次 uid 唯一键查询的代价。
 */
export const applyTemplate = () => api<TemplateApplyResult>('/template/apply', {})

/**
 * 我的邀请码（商家用）。
 *
 * 码是**由 uid 确定性推导**的，不落表，所以这个接口永远返回同一个值 ——
 * 商家可以把它印在物料上，不用「先生成再保存」。
 * 普通用户也能拿到自己的码，但那个码过不了「已审核商家」那道闸，等于没用。
 */
export const myInviteCode = () =>
  api<{ uid: number; invite_code: string }>('/template/invite-code', {})
