import type {
  LedgerEntry,
  LedgerSource,
  QualityGrade,
  Task,
  TaskCategory,
  TaskCycle,
  TaskInstance,
  TaskStatus,
} from '../domain/types'
import type { ServerInstance, ServerTask } from '../api/task'
import type { ServerLedgerEntry } from '../api/wallet'

/* ============================================================
   在线版 · 服务端 DTO → 本地类型
   ------------------------------------------------------------
   为什么单独一层：服务端是 snake_case + **unix 秒**，本地是 camelCase + **毫秒**。
   这层是**纯函数**，能单测 —— 换算错在别处都看不出来，只会表现成
   「计时器显示 1970 年」「一提交就判超时」「余额差 1000 倍」。

   ★ 服务端 id 是数字，本地 id 是字符串（`lg_xxx` 这种带前缀的风格）。
     统一加 `srv_` 前缀：① 一眼看出这行是从云端来的 ② 重拉时幂等覆盖
     ③ 不会和本地生成的 `lg_` / `hv_` 撞。
   ============================================================ */

/** 服务端秒 → 本地毫秒。空值保持 `undefined`（**不是 0**：0 会被当成 1970 年） */
export function secToMs(v: number | null | undefined): number | undefined {
  if (v === null || v === undefined) return undefined
  return v * 1000
}

/** 服务端 id → 本地 id */
export const srvId = (kind: 'task' | 'inst' | 'ledger', id: number): string => `srv_${kind}_${id}`

const CATEGORIES: readonly TaskCategory[] = ['study', 'chore', 'sport', 'art', 'reading', 'habit']
const CYCLES: readonly TaskCycle[] = ['once', 'daily', 'weekly', 'monthly', 'yearly']
const STATUSES: readonly TaskStatus[] = [
  'pending',
  'submitted',
  'completed',
  'failed',
  'expired',
  'skipped',
  'rejected',
]
const QUALITIES: readonly QualityGrade[] = ['awful', 'poor', 'ok', 'good', 'great']

/**
 * 枚举兜底。
 *
 * ⚠️ 不能 `as TaskCategory` 硬转：服务端以后加一个 `category:"music"`，
 * 本地所有按 category 取图标的地方会拿到 `undefined`，画面变成空白格子而**不报错**。
 * 所以落到已知值上，并在控制台留一句（生产环境不会吵到用户）。
 */
function pick<T extends string>(list: readonly T[], v: string, fallback: T, field: string): T {
  if ((list as readonly string[]).includes(v)) return v as T
  if (v) console.warn(`[sync] 未知的 ${field}「${v}」，已回落为 ${fallback}`)
  return fallback
}

export function mapTask(s: ServerTask): Task {
  return {
    id: srvId('task', s.id),
    title: s.title,
    note: s.note || undefined,
    category: pick(CATEGORIES, s.category, 'study', 'category'),
    cycle: pick(CYCLES, s.cycle, 'once', 'cycle'),
    plannedMinutes: s.planned_minutes,
    basePoints: s.base_points,
    allowOvertime: s.allow_overtime,
    allowLateNoPenalty: s.allow_late_no_penalty,
    qualityRated: s.quality_rated,
    rewardItemIds: s.reward_item_ids ?? undefined,
    windowStartMinute: s.window_start_minute ?? undefined,
    windowEndMinute: s.window_end_minute ?? undefined,
    checkInEnabled: s.check_in_enabled,
    checkInTargetCount: s.check_in_target_count || undefined,
    remindAt: s.remind_at || undefined,
    archived: s.archived,
    createdAt: secToMs(s.created_at) ?? Date.now(),
    updatedAt: secToMs(s.updated_at) ?? Date.now(),
  }
}

export function mapInstance(s: ServerInstance): TaskInstance {
  return {
    id: srvId('inst', s.id),
    taskId: srvId('task', s.task_id),
    periodKey: s.period_key,
    date: s.date,
    title: s.title,
    category: pick(CATEGORIES, s.category, 'study', 'category'),
    cycle: pick(CYCLES, s.cycle, 'once', 'cycle'),
    plannedMinutes: s.planned_minutes,
    basePoints: s.base_points,
    allowOvertime: s.allow_overtime,
    allowLateNoPenalty: s.allow_late_no_penalty,
    qualityRated: s.quality_rated,
    rewardItemIds: s.reward_item_ids ?? [],
    status: pick(STATUSES, s.status, 'pending', 'status'),
    actualMinutes: s.actual_minutes ?? undefined,
    earnedPoints: s.earned_points ?? undefined,
    quality: s.quality ? pick(QUALITIES, s.quality, 'ok', 'quality') : undefined,
    // 计时三兄弟必须一起换算，漏一个就会「用时算成负数」或「超时 1000 倍」
    startedAt: secToMs(s.started_at),
    pausedAt: secToMs(s.paused_at),
    pausedTotalMs: s.paused_total_ms || undefined,
    submittedAt: secToMs(s.submitted_at),
    settledAt: secToMs(s.settled_at),
    completedAt: secToMs(s.completed_at),
    backfilled: s.backfilled || undefined,
    rejectNote: s.reject_reason || undefined,
    createdAt: secToMs(s.created_at) ?? Date.now(),
    updatedAt: secToMs(s.updated_at) ?? Date.now(),
  }
}

/**
 * 服务端流水来源 → 本地 `LedgerSource`。
 *
 * 本地那个联合类型是**封闭**的（`domain/types.ts`），服务端却在用自己的一套名字。
 * 不认识的一律落 `manual_adjust`，而不是丢行 —— 丢行会让「余额求和」对不上账，
 * 而界面上什么都看不出来。
 */
const LEDGER_SOURCE_MAP: Record<string, LedgerSource> = {
  task_reward: 'task',
  check_in: 'checkin',
  checkin: 'checkin',
  checkin_bonus: 'checkin_bonus',
  register_gift: 'manual_adjust',
  redeem: 'redeem',
  wish_redeem: 'wish_redeem',
  wish_refund: 'wish_refund',
  manual_adjust: 'manual_adjust',
  game_reward: 'game_spend',
  game_spend: 'game_spend',
}

/**
 * 积分流水。**只收 `points` 币种** —— 本地 `ledger` 表就是积分账本，
 * 兑换券走 `harvestLedger`，混进来会让余额凭空多出一截。
 */
export function mapLedger(s: ServerLedgerEntry): LedgerEntry | null {
  if (s.currency !== 'points') return null
  return {
    id: srvId('ledger', s.id),
    delta: s.delta,
    balanceAfter: s.balance_after,
    source: LEDGER_SOURCE_MAP[s.source] ?? 'manual_adjust',
    refId: s.ref_id || undefined,
    memo: s.memo,
    createdAt: secToMs(s.created_at) ?? Date.now(),
  }
}
