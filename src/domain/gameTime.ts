import { appDayKey } from './time'
import type { GameClock } from './types'

/**
 * 每天游戏时长 —— 家长 2026-10-28 的「沉迷设定」。
 *
 * ## 只管一件事：今天还能玩多久
 *
 * 家长设一个分钟数（0 = 不限），玩满之后游戏那一格锁住，写一句
 * 「今天的游戏时间用完了」。**不做**「单次提醒」「只能在指定时段」——
 * 家长这轮只勾了这一项，多做的每一样都是没人用的控件。
 *
 * ## 为什么是「累计秒数 + 哪一天」两个字段
 *
 * 额度必须跨重启还在（关掉 App 再打开不能重置），所以落盘；
 * 又要跨天自动归零，所以必须一起存「这笔秒数属于哪一天」。
 * 只存秒数不存日期 ⇒ 昨天玩满 30 分钟，今天一开就锁死，而且**零报错**。
 *
 * 归属哪一天走 `appDayKey`（受 `settings.dayStartHour` 影响）——
 * 和家长设的「新的一天从几点开始」保持同一个口径：设成凌晨 4 点的话，
 * 孩子 1 点还在玩，算的是**昨天**。
 */

/**
 * 家长可选的档位。0 = 不限。
 *
 * ⚠️ 必须是**偶数个**：设置页用 3 列栅格排（`grid-cols-3`），
 * 5 个的话第二行只剩两颗、右边空一格，看着像少了一个。
 * 90 分钟是周末档 —— 比 60 宽一点，但还在一顿饭的尺度里。
 */
export const GAME_DAILY_PRESETS: readonly number[] = [0, 15, 30, 45, 60, 90]

/** 上限的硬顶（4 小时）。防手改备份塞一个 `1e9` 把闸门关死 */
export const MAX_GAME_DAILY_MINUTES = 240

/**
 * 夹取。`0` / 负数 / `NaN` / 空串一律当「不限」——
 * 家长想关掉这项功能时最自然的动作就是把数字清空。
 */
export function clampGameDailyMinutes(n: unknown): number {
  const v = Math.round(Number(n))
  if (!Number.isFinite(v) || v <= 0) return 0
  return Math.min(MAX_GAME_DAILY_MINUTES, v)
}

/** 今天已经玩了多少秒，以及它属于哪一天。结构定义在 `types.ts`（零依赖底座） */
export type { GameClock } from './types'

/**
 * 把落盘的时钟对齐到今天。**不是今天的一律归零。**
 *
 * ⚠️ 老库里没有这个字段（`undefined`）也走这条路 —— 返回今天的 0，
 * 不需要数据迁移。
 */
export function rollGameClock(clock: GameClock | undefined, todayKey: string): GameClock {
  if (!clock || typeof clock.day !== 'string' || clock.day !== todayKey) {
    return { day: todayKey, sec: 0 }
  }
  const sec = Number(clock.sec)
  return { day: clock.day, sec: Number.isFinite(sec) && sec > 0 ? Math.round(sec) : 0 }
}

/** 今天已经玩了多少秒（跨天自动算成 0） */
export function playedSecToday(
  clock: GameClock | undefined,
  dayStartHour: number,
  now: number = Date.now(),
): number {
  return rollGameClock(clock, appDayKey(now, dayStartHour)).sec
}

/**
 * 今天还剩多少秒。**不限时返回 `Infinity`** —— 调用方别拿它做算术，
 * 只拿来判 `<= 0` 和显示。
 */
export function remainingSec(limitMinutes: number, playedSec: number): number {
  const limit = clampGameDailyMinutes(limitMinutes)
  if (limit === 0) return Infinity
  const played = Number.isFinite(playedSec) && playedSec > 0 ? playedSec : 0
  return Math.max(0, limit * 60 - played)
}

/** 现在能不能进游戏（不限时永远能） */
export function isGameLocked(limitMinutes: number, playedSec: number): boolean {
  return remainingSec(limitMinutes, playedSec) <= 0
}

/** 家长那一侧看「今天已经玩了多久」。0 秒时说「还没玩」，不说「0 分钟」 */
export function formatPlayed(playedSec: number): string {
  const s = Number.isFinite(playedSec) && playedSec > 0 ? Math.floor(playedSec) : 0
  if (s === 0) return '还没玩'
  if (s < 60) return '不到 1 分钟'
  return `${Math.floor(s / 60)} 分钟`
}
