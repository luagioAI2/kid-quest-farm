/* ============================================================
   连击奖励的加成分（2026-10-11 家长要求可设置）
   ------------------------------------------------------------
   家长原话：

   > 「签到 只需要阶梯奖励(可以设置倍率)。 但是长期任务 这种 次数的
   >   可以有连续奖励。(连击奖励)（可以设置连续的加成的分）。
   >   不能两种 同时都有。」

   于是这里定的是**长期任务**那条线的加成分：
     · `streakBonusPerDay` —— 每连击一天多给多少分（默认 2）
     · `streakBonusCap`     —— 一次最多加多少分（默认 20）
   发放算式在 `useApp.maybePayStreakBonus`：`min(cap, 连击天数 × 每天分)`。

   ⚠️ 和 `tierRatio` 一样，这两个值**参与计算**（会变成账本里真实的分），
   所以夹取必须在**用的时候**做一遍，不能只靠输入框夹 ——
   导入的旧备份、手改的 IndexedDB、测试里直接 `updateSettings` 都能绕过输入框。
   喂进算式前一律过 `clampStreakPerDay` / `clampStreakCap`。

   为什么下限是 0：0 就是「不发」，语义干净，等价于把开关关掉。
   为什么上限是 20 / 200：每天 20 分已经是「连一天送一个满额任务」，
   封顶 200 是默认值（20）的十倍。再往上就不是激励，是把积分体系冲垮。
   ============================================================ */

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
