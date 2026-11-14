import type { Task } from '../domain/types'
import type { NewTaskInput } from '../store/useApp'
import {
  checkIn,
  createTask,
  deleteTask,
  pauseTimer,
  resumeTimer,
  skipTask,
  startTimer,
  submitTask,
  updateTask,
  reviewTask,
  type CreateTaskBody,
  type ServerTask,
} from '../api/task'
import { serverIdOf } from './ids'

/* ============================================================
   在线版 · 任务写穿
   ------------------------------------------------------------
   每个函数一对一映射 store 里的同名动作，只负责「翻译成接口调用」。

   ★ 字段映射全部走 `camelCase → snake_case` 的一张表，不散在各处：
     漏一个字段的表现是「家长改了这项设置，界面回显还是旧的」，
     而**服务端一切正常、不报任何错**。
   ============================================================ */

/**
 * 本地 `Task` 里服务端也有对应列的字段（两侧同名，只有命名风格不同）。
 *
 * 左边用 `string` 而不是 `keyof Task`：`NewTaskInput` 和 `Task` 的字段并不完全
 * 重合（`windowStartMinute` 只在 `Task` 上，编辑器不让改），交叉类型会把
 * 这类字段直接排除掉，而**排除了不会报错，只会少传一个字段**。
 * 运行时取值统一走 `Record<string, unknown>`。
 */
const FIELD_MAP: Array<[string, keyof CreateTaskBody]> = [
  ['title', 'title'],
  ['note', 'note'],
  ['category', 'category'],
  ['cycle', 'cycle'],
  ['plannedMinutes', 'planned_minutes'],
  ['basePoints', 'base_points'],
  ['allowOvertime', 'allow_overtime'],
  ['allowLateNoPenalty', 'allow_late_no_penalty'],
  ['qualityRated', 'quality_rated'],
  ['rewardItemIds', 'reward_item_ids'],
  ['windowStartMinute', 'window_start_minute'],
  ['windowEndMinute', 'window_end_minute'],
  ['checkInEnabled', 'check_in_enabled'],
  ['checkInTargetCount', 'check_in_target_count'],
  ['remindAt', 'remind_at'],
]

/**
 * 任务级玩法参数 → 服务端的 `extra`。
 *
 * 这三个参数服务端**不认识**（它只管结算规则，不管家长想怎么调），
 * 但又必须存住 —— 丢了就是「家长改了不生效」，而且不报错。
 * 所以塞进 `task.extra_json` 原样存回，客户端拉回来自己解析。
 */
export function taskExtraFrom(t: {
  checkInTierRatio?: number
  streakPerDay?: number
  streakCap?: number
}): string | undefined {
  const extra: Record<string, number> = {}
  if (t.checkInTierRatio != null) extra.checkInTierRatio = t.checkInTierRatio
  if (t.streakPerDay != null) extra.streakPerDay = t.streakPerDay
  if (t.streakCap != null) extra.streakCap = t.streakCap
  return Object.keys(extra).length ? JSON.stringify(extra) : undefined
}

/** 只挑出「值不是 undefined」的字段 —— 服务端的 update 是按字段覆盖的 */
function pickBody(src: Partial<Task> & Partial<NewTaskInput>): Partial<CreateTaskBody> {
  const out: Record<string, unknown> = {}
  for (const [local, server] of FIELD_MAP) {
    const v = (src as Record<string, unknown>)[local as string]
    if (v !== undefined) out[server as string] = v
  }
  const extra = taskExtraFrom(src)
  if (extra !== undefined) out.extra = extra
  return out as Partial<CreateTaskBody>
}

/** 新建任务：必填字段一定有（`TaskEditor` 校验过） */
export function createBody(input: NewTaskInput): CreateTaskBody {
  const body = pickBody(input)
  return {
    ...body,
    title: input.title,
    category: input.category,
    cycle: input.cycle,
    planned_minutes: input.plannedMinutes,
    base_points: input.basePoints,
  } as CreateTaskBody
}

/**
 * 改任务：把 `patch` 叠在「当前这条任务」上再发。
 *
 * 为什么要 `full`：`extra` 是**整块**存的，只带 patch 的话
 * 「只改了连击封顶」会把阶梯倍率一起抹掉（服务端看到的是一个新的 extra 串）。
 */
export function updateBody(
  patch: Partial<Task>,
  full: Task,
): Partial<CreateTaskBody> & { archived?: boolean } {
  const body = pickBody({ ...full, ...patch }) as Partial<CreateTaskBody> & {
    archived?: boolean
  }
  if (patch.archived !== undefined) body.archived = patch.archived
  return body
}

/* ---------------- 一对一动作 ---------------- */

export const oCreateTask = (input: NewTaskInput): Promise<ServerTask> => createTask(createBody(input))

export const oUpdateTask = (localId: string, patch: Partial<Task>, full: Task) => {
  const id = serverIdOf(localId, 'task')
  if (id === null) throw new Error(`不是服务端任务：${localId}`)
  return updateTask(id, updateBody(patch, full))
}

export const oDeleteTask = (localId: string) => {
  const id = serverIdOf(localId, 'task')
  if (id === null) throw new Error(`不是服务端任务：${localId}`)
  return deleteTask(id)
}

export const oStartTimer = (localInstId: string) => {
  const id = serverIdOf(localInstId, 'inst')
  if (id === null) throw new Error(`不是服务端实例：${localInstId}`)
  return startTimer(id)
}

export const oPauseTimer = (localInstId: string) => {
  const id = serverIdOf(localInstId, 'inst')
  if (id === null) throw new Error(`不是服务端实例：${localInstId}`)
  return pauseTimer(id)
}

export const oResumeTimer = (localInstId: string) => {
  const id = serverIdOf(localInstId, 'inst')
  if (id === null) throw new Error(`不是服务端实例：${localInstId}`)
  return resumeTimer(id)
}

/**
 * 提交。
 *
 * **不传 `actual_minutes`** —— 服务端按计时器自己算。孩子端传的话，
 * 改一下系统时钟就能刷分（`api/task.ts` 里也写了这条）。
 * 代价是「没点开始就直接交」的用时按 0 算，由服务端结算规则决定给几分。
 */
export const oSubmitTask = (localInstId: string, opts: { backfilled?: boolean } = {}) => {
  const id = serverIdOf(localInstId, 'inst')
  if (id === null) throw new Error(`不是服务端实例：${localInstId}`)
  return submitTask(id, opts)
}

export const oReviewTask = (
  localInstId: string,
  approve: boolean,
  opts: { quality?: string; note?: string } = {},
) => {
  const id = serverIdOf(localInstId, 'inst')
  if (id === null) throw new Error(`不是服务端实例：${localInstId}`)
  return reviewTask(id, approve, opts)
}

export const oSkipTask = (localInstId: string) => {
  const id = serverIdOf(localInstId, 'inst')
  if (id === null) throw new Error(`不是服务端实例：${localInstId}`)
  return skipTask(id)
}

/**
 * 签到。
 *
 * 服务端**一步做完**：发分 + 连签 + 阶梯奖励（`NeedReview` 恒为 false，
 * 见 `checkin_srv.go`）。所以在线版没有「待家长确认的签到」这个状态，
 * `approveCheckIn` / `rejectCheckIn` / `claimCheckInTier` 三个动作在在线模式下
 * 自然没有事可做 —— 界面上也不会有待审条目可点。
 */
export const oCheckIn = (localTaskId: string) => {
  const id = serverIdOf(localTaskId, 'task')
  if (id === null) throw new Error(`不是服务端任务：${localTaskId}`)
  return checkIn(id)
}
