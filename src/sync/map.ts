import type {
  HarvestEntry,
  HarvestSource,
  LedgerEntry,
  LedgerSource,
  QualityGrade,
  RedeemCategory,
  RedeemItem,
  RedeemRecord,
  Task,
  TaskCategory,
  TaskCycle,
  TaskInstance,
  TaskStatus,
} from '../domain/types'
import type { ServerInstance, ServerTask } from '../api/task'
import type { ServerLedgerEntry } from '../api/wallet'
import type { ServerRedeemRecord, ServerRedeemRow } from '../api/redeem'

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

/**
 * 解析 `task.extra_json`。
 *
 * 坏数据（手改过库 / 以后换了结构）**不能让整个任务拉不下来** ——
 * 解析失败就当没有，任务照常显示，只是那三个玩法参数回落到默认值。
 */
export function parseTaskExtra(raw: string | undefined): {
  checkInTierRatio?: number
  streakPerDay?: number
  streakCap?: number
} {
  if (!raw) return {}
  try {
    const v = JSON.parse(raw) as Record<string, unknown>
    const out: { checkInTierRatio?: number; streakPerDay?: number; streakCap?: number } = {}
    for (const k of ['checkInTierRatio', 'streakPerDay', 'streakCap'] as const) {
      const n = v[k]
      if (typeof n === 'number' && Number.isFinite(n)) out[k] = n
    }
    return out
  } catch {
    console.warn('[sync] task.extra 解析失败，已忽略：', raw.slice(0, 80))
    return {}
  }
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
    ...parseTaskExtra(s.extra),
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
 * 兑换券流水的来源映射。
 *
 * ⚠️ `animal_produce`（动物产出卖出）落到 `farm_harvest`：本地那个联合类型
 *    只有「作物收获」这一档，而两者在流水里的语义一样（农场卖东西得的券）。
 *    加一个新的 `HarvestSource` 会牵动 `ledgerTip`、兑换券页的分组图标和
 *    十来条单测，收益只是标签更细 —— 等真要按来源出报表时再拆。
 */
const HARVEST_SOURCE_MAP: Record<string, HarvestSource> = {
  farm_harvest: 'farm_harvest',
  animal_produce: 'farm_harvest',
  farm_market: 'farm_market',
  claw_prize: 'claw_prize',
  plugin_mint: 'claw_prize',
  game_redeem: 'game_redeem',
  harvest_redeem: 'harvest_redeem',
  redeem_coupon: 'harvest_redeem',
  wish_redeem: 'wish_redeem',
  wish_refund: 'wish_refund',
}

/**
 * 兑换券流水。**只收 `coupon` 币种**，与 `mapLedger` 对称。
 *
 * 不认识来源时落 `claw_prize` —— 它在本地就是「奖品 → 兑换券」的
 * **统一标记**（历史名）。丢行会让兑换券余额对不上账，而界面上什么都看不出来。
 */
export function mapHarvest(s: ServerLedgerEntry): HarvestEntry | null {
  if (s.currency !== 'coupon') return null
  const source = HARVEST_SOURCE_MAP[s.source]
  if (!source) console.warn(`[sync] 未知的兑换券来源「${s.source}」，已记为 claw_prize`)
  return {
    id: srvId('ledger', s.id),
    delta: s.delta,
    balanceAfter: s.balance_after,
    source: source ?? 'claw_prize',
    refId: s.ref_id || undefined,
    memo: s.memo,
    createdAt: secToMs(s.created_at) ?? Date.now(),
  }
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

/* ============================================================
   兑换商城
   ------------------------------------------------------------
   这里有个和任务/流水**不一样**的地方，值得单独说清楚：

   ★ 兑换品的 id **不加 `srv_` 前缀**。
     服务端建商品时用的是客户端给的 `id`（`/redeem/item/create` 的 `id` 字段
     → `redeem_item.item_id`），所以两边本来就是同一个字符串。
     加前缀的话，每个写接口都要再剥一次 —— 剥错了不报错，只会把
     「这个商品不存在」显示成「商品没了」。

   ★ 兑换**记录**的 id 要加（`srv_rr_`）。服务端生成 `RR…`，
     本地生成 `rr…`，两种风格混在一张表里，不加前缀就分不清
     「这行能不能直接拿 id 去调 `/redeem/fulfill`」。
   ============================================================ */

/** 服务端兑换记录 id 的本地前缀 */
export const SRV_REDEEM_RECORD_PREFIX = 'srv_rr_'

const REDEEM_CATEGORIES: readonly RedeemCategory[] = [
  'snack',
  'gift',
  'screen',
  'outing',
  'privilege',
  'custom',
]

/**
 * `/redeem/list` 的一行 → 本地 `RedeemItem`。
 *
 * 返回 `null` 的两种情况，都是**必须**跳过的：
 *
 * ① `source === 'wish'` —— 那是家长定过价的心愿商品，不是兑换品。
 *    写进兑换品表的话，孩子会在兑换页看到它**两次**（一次来自兑换品表、
 *    一次来自心愿那条链路），而且家长在管理页删它只会删掉影子。
 * ② 缺 `price`（服务端老版本没带 `raw` 字段时 `price` 仍在，但保险起见）。
 */
export function mapRedeemItem(s: ServerRedeemRow): RedeemItem | null {
  if (s.source !== 'redeem') return null
  return {
    id: s.id,
    name: s.name,
    emoji: s.emoji || '🎁',
    category: pick(REDEEM_CATEGORIES, s.category, 'custom', 'redeem.category'),
    // 服务端叫 `price`（「分」），本地叫 `cost` —— 同一个数，别乘别除
    cost: s.price,
    note: s.note || undefined,
    // 服务端的 0 = 不限，本地的 `undefined` = 不限
    limitPerDay: s.limit_per_day ? s.limit_per_day : undefined,
    once: s.once || undefined,
    stock: s.stock,
    archived: s.archived ?? false,
    createdByParent: s.created_by_parent ?? true,
    /* ★ 服务端算的「现在该不该给孩子看」。本地版的可见性是读取时算的
       （`archived` + 一次性换过），在线版直接采信服务端 —— 否则
       「换过的一次性商品」要靠本地 `redeemRecords` 反推，而那份记录
       只拉了最近 200 条，老用户会看到换过的东西又冒出来。 */
    visible: s.visible,
    createdAt: secToMs(s.created_at) ?? Date.now(),
    updatedAt: secToMs(s.updated_at) ?? Date.now(),
  }
}

/**
 * 服务端兑换记录 → 本地 `RedeemRecord`。
 *
 * ★ **已取消的记录直接丢**，返回 `null`。
 *   取消 = 退券退分，那笔兑换在事实上没有发生。拉进来的话：
 *     · 家长管理页会多出一条「待兑现」（`!fulfilled`）—— 东西早退了，
 *       家长却以为还欠孩子一次；
 *     · `redeemedToday` 会把它算进「今天换过几次」，孩子明明没换成却被限流。
 *   服务端的 `HasRedeemedOnce` / `CountTodayByItem` / `CountRedeemedByItem`
 *   三个判据全都带 `cancelled = false`，所以丢掉它们和「一次性换过」
 *   这件事的判断是**一致**的。
 */
export function mapRedeemRecord(s: ServerRedeemRecord): RedeemRecord | null {
  if (s.cancelled) return null
  return {
    id: `${SRV_REDEEM_RECORD_PREFIX}${s.id}`,
    itemId: s.item_id,
    name: s.name,
    emoji: s.emoji || '🎁',
    cost: s.cost,
    harvestPaid: s.harvest_paid,
    pointsPaid: s.points_paid,
    balanceAfter: s.balance_after,
    harvestBalanceAfter: s.harvest_balance_after,
    fulfilled: s.fulfilled,
    fulfilledAt: secToMs(s.fulfilled_at),
    createdAt: secToMs(s.created_at) ?? Date.now(),
  }
}

