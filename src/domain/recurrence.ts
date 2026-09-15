import type { Task, TaskInstance } from './types'
import { appDayKey, periodKeyFor, periodStartDateKey } from './time'

/* ============================================================
   任务实例生成
   ------------------------------------------------------------
   设计取舍（重要）：
   * 只有「单次任务」和「每日任务」预先落库成 TaskInstance。
   * 「每周 / 每月 / 每年」任务**不预先展开**，而是把任务定义本身
     当作一个长长的待办，按时长拆成若干次提交（见 splitPeriodTask）。
     这样才不会在数据库里堆出成百上千条空实例。
   ============================================================ */

let seq = 0
export function uid(prefix = 'id'): string {
  seq = (seq + 1) % 100000
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}${r}${seq.toString(36)}`
}

/** 需要预先展开成实例的周期 */
export function isPreGenerated(cycle: Task['cycle']): boolean {
  return cycle === 'once' || cycle === 'daily'
}

/**
 * 为一个任务定义生成某个逻辑日的实例。
 * 返回 null 表示该任务在这一天不需要出现。
 */
export function makeInstance(
  task: Task,
  dayKey: string,
  dayStartHour = 0,
): TaskInstance | null {
  if (task.archived) return null
  if (!isPreGenerated(task.cycle)) return null

  // 单次任务：只在创建当天及之后出现一次，由调用方保证只建一次
  const periodKey = periodKeyFor(task.cycle, Date.now(), dayStartHour)
  const now = Date.now()
  const inst: TaskInstance = {
    id: uid('ti'),
    taskId: task.id,
    periodKey: task.cycle === 'daily' ? dayKey : periodKey,
    date: dayKey,
    title: task.title,
    category: task.category,
    cycle: task.cycle,
    plannedMinutes: task.plannedMinutes,
    basePoints: task.basePoints,
    qualityBonusPoints: task.qualityBonusPoints,
    allowOvertime: task.allowOvertime,
    allowLateNoPenalty: task.allowLateNoPenalty,
    qualityRated: task.qualityRated,
    rewardItemIds: task.rewardItemIds ?? [],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  return inst
}

/**
 * 惰性补齐：给定已有实例列表，算出还需要为哪些 (taskId, dayKey) 生成实例。
 * 这是"每天自动生成任务"的核心 —— 打开 App 时补齐缺失的那几天。
 *
 * @param tasks 所有任务定义
 * @param existing 现有实例（至少要包含 taskId 与 periodKey）
 * @param fromDayKey 补齐起始逻辑日（含）
 * @param toDayKey 补齐结束逻辑日（含）
 * @returns 需要新建的实例数组
 */
export function planMissingInstances(
  tasks: Task[],
  existing: Pick<TaskInstance, 'taskId' | 'periodKey' | 'cycle'>[],
  fromDayKey: string,
  toDayKey: string,
  dayStartHour = 0,
): TaskInstance[] {
  const have = new Set(existing.map((e) => `${e.taskId}::${e.periodKey}`))
  const out: TaskInstance[] = []

  for (const task of tasks) {
    if (task.archived || !isPreGenerated(task.cycle)) continue

    if (task.cycle === 'daily') {
      for (const day of eachDay(fromDayKey, toDayKey)) {
        if (have.has(`${task.id}::${day}`)) continue
        const inst = makeInstance(task, day, dayStartHour)
        if (inst) out.push(inst)
      }
      continue
    }

    // 单次任务：只在当前逻辑日生成一次，且全生命周期只生成一次
    const anyExists = existing.some((e) => e.taskId === task.id)
    if (anyExists) continue
    const inst = makeInstance(task, toDayKey, dayStartHour)
    if (inst) out.push(inst)
  }

  return out
}

/**
 * 从 from 到 to 的每一天（含两端），迭代器。
 *
 * 上限 3660 天（约 10 年）只是防御「日期字符串损坏导致死循环」的保险丝。
 * 正常调用方（惰性补齐）的区间是「最早实例日 → 今天」，永远够用。
 * 一旦真的触到上限，说明数据异常；此时明确抛出而不是静默截断 ——
 * 静默少生成几天任务，用户是无感的，问题会一直藏着。
 */
export function* eachDay(fromDayKey: string, toDayKey: string): Generator<string> {
  const MAX_DAYS = 3660
  let cur = fromDayKey
  let guard = 0
  while (cur <= toDayKey) {
    if (guard >= MAX_DAYS) {
      throw new Error(
        `eachDay: 日期区间超过 ${MAX_DAYS} 天（${fromDayKey} → ${toDayKey}），疑似日期数据损坏`,
      )
    }
    yield cur
    const next = new Date(`${cur}T00:00:00`).getTime() + 24 * 3600_000
    const d = new Date(next)
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    cur = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    guard++
  }
}

/**
 * 把「周期任务」拆成可多次提交的子目标。
 * 例：每周跑 3 次，每次 30 分钟 → 返回 3 个 unit。
 * UI 上表现为「本周进度 1/3」。
 */
export interface PeriodUnit {
  index: number
  label: string
  done: boolean
  /** 已交上去、等家长审核（既不是空格子，也还没算完成） */
  pending?: boolean
  completedAt?: number
  actualMinutes?: number
  earnedPoints?: number
}

export function buildPeriodUnits(
  task: Task,
  submissions: TaskInstance[],
): PeriodUnit[] {
  const total = Math.max(1, task.checkInTargetCount ?? 1)
  const sorted = [...submissions].sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
  const units: PeriodUnit[] = []
  for (let i = 0; i < total; i++) {
    const s = sorted[i]
    units.push({
      index: i,
      label: `第 ${i + 1} 次`,
      done: !!s && (s.status === 'completed' || s.status === 'failed'),
      // 待审核的格子必须和「还没做」区分开 —— 否则孩子看到空格子会再交一次，
      // 家长那边就冒出两条一模一样的待办。
      pending: !!s && s.status === 'submitted',
      completedAt: s?.completedAt,
      actualMinutes: s?.actualMinutes,
      earnedPoints: s?.earnedPoints,
    })
  }
  return units
}

/**
 * 签到阶梯奖励。
 * 例如「一周练字 5 天」→ 第 3 天给 30 分，第 5 天再给 50 分。
 */
export interface CheckInTier {
  days: number
  points: number
  itemId?: string
  label: string
}

export function defaultTiers(cycle: Task['cycle'], target: number): CheckInTier[] {
  const base = Math.max(1, target)
  if (cycle === 'weekly') {
    return dedupeTiers([
      { days: Math.min(base, 1), points: 10, label: '开了个好头' },
      { days: Math.min(base, 3), points: 30, label: '坚持 3 天' },
      { days: base, points: 60, itemId: 'sticker', label: `一周坚持 ${base} 天` },
    ])
  }
  if (cycle === 'monthly') {
    return dedupeTiers([
      { days: Math.min(base, 5), points: 50, label: '坚持 5 天' },
      { days: Math.min(base, 15), points: 150, itemId: 'sticker', label: '坚持半个月' },
      { days: base, points: 400, itemId: 'medal', label: `整月坚持 ${base} 天` },
    ])
  }
  if (cycle === 'yearly') {
    return dedupeTiers([
      { days: Math.min(base, 30), points: 300, label: '坚持 30 天' },
      { days: Math.min(base, 180), points: 1500, itemId: 'medal', label: '坚持半年' },
      { days: base, points: 5000, itemId: 'gem', label: `全年坚持 ${base} 天` },
    ])
  }
  return dedupeTiers([
    { days: Math.min(base, 3), points: 20, label: '坚持 3 天' },
    { days: base, points: 50, itemId: 'sticker', label: `坚持 ${base} 天` },
  ])
}

/**
 * 合并「天数相同」的阶梯。
 *
 * 小目标（比如每周只签 2 天）会让 Math.min(base, N) 把多个阶梯压到同一天数，
 * 此时必须做两件事：
 *  1. 保留奖励最高的那一档 —— 否则玩家会因为名字排前面反而少拿分；
 *  2. 重写 label —— 「坚持 3 天」挂在 days=2 上是明确的错误文案。
 * label 一律按最终天数重新生成，保证显示与事实一致。
 */
function dedupeTiers(tiers: CheckInTier[]): CheckInTier[] {
  const best = new Map<number, CheckInTier>()
  for (const t of tiers) {
    if (t.days < 1) continue
    const prev = best.get(t.days)
    if (!prev || rewardScore(t) > rewardScore(prev)) best.set(t.days, t)
  }
  return [...best.values()]
    .sort((a, b) => a.days - b.days)
    .map((t) => ({ ...t, label: `坚持 ${t.days} 天` }))
}

/** 粗略比较两档奖励的高低，用于同天数合并时挑更好的那档 */
function rewardScore(t: CheckInTier): number {
  // 道具奖励视为比纯积分更有价值，给一个溢价，避免被低分档挤掉。
  return t.points + (t.itemId ? 1000 : 0)
}

/** 已签到天数 → 当前已达成但未领取的阶梯 */
export function claimableTiers(
  tiers: CheckInTier[],
  daysCount: number,
  claimed: number[],
): CheckInTier[] {
  return tiers.filter((t) => daysCount >= t.days && !claimed.includes(t.days))
}

/**
 * 连续完成天数（连击）。用于全局连击奖励。
 * 以「当天至少完成 1 个任务」为一天有效。
 */
export function computeStreak(datesWithCompletion: string[], todayKey: string): number {
  const set = new Set(datesWithCompletion)
  let count = 0
  let cursor = todayKey
  // 今天没完成也不立刻断，从昨天开始算（给孩子留缓冲）
  if (!set.has(cursor)) {
    cursor = shiftDay(cursor, -1)
    if (!set.has(cursor)) return 0
  }
  while (set.has(cursor)) {
    count++
    cursor = shiftDay(cursor, -1)
  }
  return count
}

function shiftDay(key: string, delta: number): string {
  const ts = new Date(`${key}T12:00:00`).getTime() + delta * 24 * 3600_000
  const d = new Date(ts)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 是否在允许的完成时间窗内 */
export function inTimeWindow(task: Task, ts = Date.now()): boolean {
  if (task.windowStartMinute == null || task.windowEndMinute == null) return true
  const d = new Date(ts)
  const cur = d.getHours() * 60 + d.getMinutes()
  const { windowStartMinute: s, windowEndMinute: e } = task
  // 支持跨零点窗口，如 21:00 - 06:00
  return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e
}

/** 当前逻辑日 —— 供 UI 直接用 */
export function currentDayKey(dayStartHour = 0): string {
  return appDayKey(Date.now(), dayStartHour)
}

export { periodStartDateKey }
