import { api } from './client'

/* ============================================================
   在线版 · 任务接口（tf-platform-api `/api/task/*`）
   ------------------------------------------------------------
   服务端这套接口是**照 `src/domain/` 写的**（见 tf-platform-api/docs/TASK_SYSTEM.md
   第 3 行），字段语义和本地类型一一对应，所以这一层只做「原样搬运 + 类型」，
   **不做映射** —— snake_case → camelCase、秒 → 毫秒的换算全部放在
   `src/sync/map.ts` 里，那里是纯函数，能单测。

   ⚠️ 时间戳：服务端全是 **unix 秒**（`started_at` / `submitted_at` / `created_at`），
   本地是**毫秒**。漏乘 1000 不会报错，只会让计时器显示 1970 年、或者一提交就判超时。
   ============================================================ */

/** 服务端任务定义（`/api/task/list`、`/api/task/create` 返回） */
export interface ServerTask {
  id: number
  created_at: number
  updated_at: number
  uid: number
  title: string
  note: string
  category: string
  cycle: string
  planned_minutes: number
  base_points: number
  allow_overtime: boolean
  allow_late_no_penalty: boolean
  quality_rated: boolean
  reward_item_ids: string[] | null
  window_start_minute: number | null
  window_end_minute: number | null
  check_in_enabled: boolean
  check_in_target_count: number
  remind_at: string
  archived: boolean
  sort: number
}

/** 服务端任务实例（`/api/task/board` 的 `instances[]`） */
export interface ServerInstance {
  id: number
  created_at: number
  updated_at: number
  uid: number
  task_id: number
  period_key: string
  date: string
  title: string
  category: string
  cycle: string
  planned_minutes: number
  base_points: number
  allow_overtime: boolean
  allow_late_no_penalty: boolean
  quality_rated: boolean
  reward_item_ids: string[] | null
  status: string
  actual_minutes: number | null
  earned_points: number | null
  quality: string
  started_at: number | null
  paused_at: number | null
  paused_total_ms: number
  submitted_at: number | null
  settled_at: number | null
  completed_at: number | null
  backfilled: boolean
  reject_reason: string
  review_note: string
}

export interface ServerBoard {
  date: string
  total: number
  completed: number
  pending: number
  submitted: number
  today_points: number
  balance: number
  instances: ServerInstance[]
}

/** 今日任务板。服务端会**懒生成**今天所有任务的实例，所以它同时是「拉取入口」。 */
export const board = () => api<ServerBoard>('/task/board', {})

/** 任务定义列表。`includeArchived` = 连归档的一起要（家长页用）。 */
export const listTasks = (includeArchived = false) =>
  api<{ count: number; list: ServerTask[] }>('/task/list', { include_archived: includeArchived })

export interface CreateTaskBody {
  title: string
  note?: string
  category: string
  cycle: string
  planned_minutes: number
  base_points: number
  allow_overtime?: boolean
  allow_late_no_penalty?: boolean
  quality_rated?: boolean
  reward_item_ids?: string[]
  window_start_minute?: number
  window_end_minute?: number
  check_in_enabled?: boolean
  check_in_target_count?: number
  remind_at?: string
  sort?: number
}

/** 建任务。**副作用**：立即生成当前周期的实例。 */
export const createTask = (body: CreateTaskBody) => api<ServerTask>('/task/create', { ...body })

/** 改任务（只传要改的字段；`task_id` 必填） */
export const updateTask = (taskId: number, patch: Partial<CreateTaskBody> & { archived?: boolean }) =>
  api<ServerTask>('/task/update', { task_id: taskId, ...patch })

/**
 * 删任务（服务端是**归档**，不是真删）。
 *
 * ⚠️ 参数是 `task_id`。2026-11-02 之前这个接口绑的是计时用的 `TimerReq`
 * （字段 `instance_id`），传 `task_id` 直接报「instance_id为必填字段」。
 */
export const deleteTask = (taskId: number) => api<{ deleted: boolean }>('/task/delete', { task_id: taskId })

/* ---------------- 计时 ---------------- */

export const startTimer = (instanceId: number) =>
  api<ServerInstance>('/task/start-timer', { instance_id: instanceId })
export const pauseTimer = (instanceId: number) =>
  api<ServerInstance>('/task/pause-timer', { instance_id: instanceId })
export const resumeTimer = (instanceId: number) =>
  api<ServerInstance>('/task/resume-timer', { instance_id: instanceId })

/**
 * 提交（孩子点「做完了」）。
 *
 * `actual_minutes` 不传时由**服务端按计时器算** —— 在线版应该不传，
 * 否则孩子端改一下时钟就能刷分。
 */
export const submitTask = (instanceId: number, opts: { backfilled?: boolean } = {}) =>
  api<ServerInstance>('/task/submit', { instance_id: instanceId, ...opts })

/** 家长审核。`approve:false` = 打回重做。 */
export const reviewTask = (
  instanceId: number,
  approve: boolean,
  opts: { quality?: string; note?: string } = {},
) => api<ServerInstance>('/task/review', { instance_id: instanceId, approve, ...opts })

export const skipTask = (instanceId: number) =>
  api<ServerInstance>('/task/skip', { instance_id: instanceId })

export interface PendingReviewResp {
  count: number
  list: ServerInstance[]
}

export const pendingReview = (page = 1, pageSize = 20) =>
  api<PendingReviewResp>('/task/pending-review', { page, page_size: pageSize })

export const listInstances = (query: {
  page?: number
  pageSize?: number
  task_id?: number
  date_from?: string
  date_to?: string
  status?: string[]
}) => api<{ count: number; list: ServerInstance[] }>('/task/instances', { ...query })

/* ---------------- 签到 ---------------- */

export interface CheckInResult {
  task_id: number
  date: string
  continuous_days: number
  points: number
  need_review: boolean
  claimed_tiers: number[]
}

export const checkIn = (taskId: number) => api<CheckInResult>('/task/check-in', { task_id: taskId })

export interface CheckInStatus {
  task_id: number
  title: string
  period_key: string
  checked_days: string[]
  pending_days: string[]
  target_count: number
  continuous_days: number
  claimed_tiers: number[]
  today_checked: boolean
}

export const checkInStatus = (taskId: number) =>
  api<CheckInStatus>('/task/check-in-status', { task_id: taskId })

export interface TaskStats {
  date_from: string
  date_to: string
  total: number
  by_status: Record<string, number>
  earned_points: number
  ledger_points: number
}

export const taskStats = (dateFrom: string, dateTo: string) =>
  api<TaskStats>('/task/stats', { date_from: dateFrom, date_to: dateTo })
