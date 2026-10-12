/* ============================================================
   连击奖励的加成分（2026-10-11 家长要求可设置）
   ------------------------------------------------------------
   家长原话：

   > 「签到 只需要阶梯奖励(可以设置倍率)。 但是长期任务 这种 次数的
   >   可以有连续奖励。(连击奖励)（可以设置连续的加成的分）。
   >   不能两种 同时都有。」

   于是这里定的是**长期任务**那条线的加成分：
     · 每连击一天多给多少分（默认 `DEFAULT_STREAK_PER_DAY` = 2）
     · 一次最多加多少分（默认 `DEFAULT_STREAK_CAP` = 20）
   发放算式在 `useApp.maybePayStreakBonus`：`min(cap, 连击天数 × 每天分)`。

   ⚠️ 2026-10-12 家长拍板：「不需要全局设定梯度、连续的。每个任务单独，
   有默认的就行了。」所以这两个值**只有两个来源**：
     ① 任务自己的 `Task.streakPerDay` / `Task.streakCap`（任务编辑里设）
     ② 都没有 → 这里的常量
   设置页里那两个全局输入框已经删掉了（`Settings` 上的字段也删了）。
   别再往设置里加 —— 一个界面上看不见、却还在影响发分的全局值，
   正是本项目最怕的那种 bug。

   ⚠️ 和 `tierRatio` 一样，这两个值**参与计算**（会变成账本里真实的分），
   所以夹取必须在**用的时候**做一遍，不能只靠输入框夹 ——
   导入的旧备份、手改的 IndexedDB、测试里直接 `updateTask` 都能绕过输入框。
   喂进算式前一律过 `clampStreakPerDay` / `clampStreakCap`
   （或直接走 `streakPerDayFor` / `streakCapFor`）。

   为什么下限是 0：0 就是「不发」，语义干净，等价于把开关关掉。
   为什么上限是 20 / 200：每天 20 分已经是「连一天送一个满额任务」，
   封顶 200 是默认值（20）的十倍。再往上就不是激励，是把积分体系冲垮。
   ============================================================ */

import type { Task } from './types'

/** 每连击一天多给 2 分 */
export const DEFAULT_STREAK_PER_DAY = 2

/** 一次最多加 20 分 */
export const DEFAULT_STREAK_CAP = 20

export const MIN_STREAK_PER_DAY = 0
export const MAX_STREAK_PER_DAY = 20

export const MIN_STREAK_CAP = 0
export const MAX_STREAK_CAP = 200

/**
 * 夹「每天加多少分」。
 *
 * `undefined` / `NaN` / `Infinity` 退回默认档 —— 老库里没这个字段时
 * `loadSettings` 会补默认值，但导入的旧备份可能直接是 `undefined`，
 * 不能让它变成 `NaN` 一路算进账本。
 */
export function clampStreakPerDay(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return DEFAULT_STREAK_PER_DAY
  return Math.min(MAX_STREAK_PER_DAY, Math.max(MIN_STREAK_PER_DAY, Math.round(n)))
}

/** 夹「一次最多加多少分」。规则同上。 */
export function clampStreakCap(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return DEFAULT_STREAK_CAP
  return Math.min(MAX_STREAK_CAP, Math.max(MIN_STREAK_CAP, Math.round(n)))
}

/* ============================================================
   按任务取（2026-10-11 家长要「每个长期任务单独设」）
   ------------------------------------------------------------
   `Task` 上多了 `streakPerDay` / `streakCap` 两个可选覆盖。
   2026-10-12 家长又拍板「不需要全局设定梯度、连续的。每个任务单独，
   **有默认的就行了**」—— 所以设置里那两个全局值删掉了，
   `fallback` 参数也没了，取值只剩两级：
     ① 任务自己设过 → 用任务的（夹紧后）
     ② 没设 → `clampStreak*`(undefined) 兜到 `DEFAULT_STREAK_*`

   ⚠️ 和 `tierRatioFor` 同一个道理：别在调用点写
   `task.streakPerDay ?? DEFAULT_STREAK_PER_DAY`。那条式子会出现在
   编辑器预览、设置页预览、发分三处，漏掉一处就分叉。
   ============================================================ */

/** 这条长期任务**实际生效**的「每连一天多给几分」 */
export function streakPerDayFor(task: Pick<Task, 'streakPerDay'>): number {
  return clampStreakPerDay(task.streakPerDay)
}

/** 这条长期任务**实际生效**的连击封顶 */
export function streakCapFor(task: Pick<Task, 'streakCap'>): number {
  return clampStreakCap(task.streakCap)
}
