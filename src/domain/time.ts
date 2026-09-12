import type { TaskCycle } from './types'

/* ============================================================
   时间规则
   ------------------------------------------------------------
   核心概念：appDay —— 「逻辑日」。默认 0 点切日，但家长可以把
   切日点设到凌晨（如 4 点），这样孩子熬夜到 1 点做作业仍算昨天。
   ============================================================ */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

/** 把时间戳格式化为本地 yyyy-MM-dd */
export function toDateKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 解析 yyyy-MM-dd 为本地当天 00:00 的时间戳 */
export function fromDateKey(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

/** 取逻辑日：dayStartHour 之前算前一天 */
export function appDayKey(ts: number = Date.now(), dayStartHour = 0): string {
  const shifted = ts - dayStartHour * 3600_000
  return toDateKey(shifted)
}

/** 逻辑日的起始时间戳 */
export function appDayStart(ts: number = Date.now(), dayStartHour = 0): number {
  const shifted = ts - dayStartHour * 3600_000
  const key = toDateKey(shifted)
  return fromDateKey(key) + dayStartHour * 3600_000
}

/** 逻辑日结束时间戳（次日切日点） */
export function appDayEnd(ts: number = Date.now(), dayStartHour = 0): number {
  return appDayStart(ts, dayStartHour) + 24 * 3600_000
}

/** 日期加减天数，返回日期键 */
export function addDays(key: string, days: number): string {
  const ts = fromDateKey(key) + days * 24 * 3600_000
  return toDateKey(ts)
}

/** ISO 周键：2026-W37 */
export function weekKey(ts: number, dayStartHour = 0): string {
  const shifted = new Date(ts - dayStartHour * 3600_000)
  // 以周一为一周开始
  const target = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate())
  const dayNum = (target.getDay() + 6) % 7 // 周一=0
  target.setDate(target.getDate() - dayNum + 3) // 移到本周周四
  const firstThursday = new Date(target.getFullYear(), 0, 4)
  const firstDayNum = (firstThursday.getDay() + 6) % 7
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3)
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600_000))
  return `${target.getFullYear()}-W${pad(week)}`
}

/** 月键：2026-09 */
export function monthKey(ts: number, dayStartHour = 0): string {
  const d = new Date(ts - dayStartHour * 3600_000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

/** 年键：2026 */
export function yearKey(ts: number, dayStartHour = 0): string {
  return String(new Date(ts - dayStartHour * 3600_000).getFullYear())
}

/** 按周期取周期键 */
export function periodKeyFor(cycle: TaskCycle, ts: number, dayStartHour = 0): string {
  switch (cycle) {
    case 'daily':
    case 'once':
      return appDayKey(ts, dayStartHour)
    case 'weekly':
      return weekKey(ts, dayStartHour)
    case 'monthly':
      return monthKey(ts, dayStartHour)
    case 'yearly':
      return yearKey(ts, dayStartHour)
  }
}

/** 周期键 + 周期 → 该周期的起始日期键（用于给实例打 date） */
export function periodStartDateKey(cycle: TaskCycle, periodKey: string): string {
  switch (cycle) {
    case 'daily':
    case 'once':
      return periodKey
    case 'monthly':
      return `${periodKey}-01`
    case 'yearly':
      return `${periodKey}-01-01`
    case 'weekly': {
      // 反解 ISO 周 → 该周周一
      const m = /^(\d{4})-W(\d{2})$/.exec(periodKey)
      if (!m) return toDateKey(Date.now())
      const year = Number(m[1])
      const week = Number(m[2])
      const jan4 = new Date(year, 0, 4)
      const jan4DayNum = (jan4.getDay() + 6) % 7
      const week1Monday = new Date(year, 0, 4 - jan4DayNum)
      const monday = new Date(week1Monday.getTime() + (week - 1) * 7 * 24 * 3600_000)
      return toDateKey(monday.getTime())
    }
  }
}

/** 友好的相对时间：刚刚 / 5分钟前 / 昨天 14:30 */
export function humanizeAgo(ts: number, now = Date.now()): string {
  const diff = now - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/** 分钟数 → 「1小时25分」 */
export function humanizeMinutes(min: number): string {
  const m = Math.max(0, Math.round(min))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} 小时` : `${h} 小时 ${rest} 分`
}

/** 秒 → mm:ss 或 hh:mm:ss */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** 「今天 14:30 前完成」这类提示 */
export function humanizeDeadline(ts: number, now = Date.now()): string {
  const today = appDayKey(now)
  const target = appDayKey(ts)
  const d = new Date(ts)
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (target === today) return `今天 ${time}`
  const tomorrow = addDays(today, 1)
  if (target === tomorrow) return `明天 ${time}`
  const yesterday = addDays(today, -1)
  if (target === yesterday) return `昨天 ${time}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}

/** 周期中文名 */
export const CYCLE_LABEL: Record<TaskCycle, string> = {
  once: '单次',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
}

/** 周期对应的"时长感"文案 */
export const CYCLE_HINT: Record<TaskCycle, string> = {
  once: '只做这一次',
  daily: '每天都会出现',
  weekly: '这一周内完成就行',
  monthly: '这个月内完成就行',
  yearly: '今年内完成就行',
}
