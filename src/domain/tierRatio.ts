/* ============================================================
   签到「坚持的奖励阶梯」的倍率（2026-10-10 家长要求）
   ------------------------------------------------------------
   家长原话：

   > 「坚持的奖励阶梯 … 为啥阶梯分 还是这么大。 另外阶梯分设置没有。」

   先说清楚**当时为什么没有设置**：阶梯根本不是存在任务上的一列数，
   而是每次现算出来的 —— `defaultTiers(cycle, 目标天数, 基础分)` 按
   1:3:6 把「合计 = 0.8 × 基础分 × 目标天数」摊到三档。写死的只有
   那个 `0.8`。所以「设置」的正确形状就是**让这个倍率可调**，而不是
   给三档各配一个输入框（那会立刻和「基础分」脱钩，家长改基础分时
   阶梯不动，又变回假话）。

   口径：`checkInTierRatio` = **每完成一次，阶梯合计给基础分的多少倍**。
   默认 0.8（= 家长 2026-09-30 定的口径，也是原来的写死值）。
   周档 基础分 5 / 目标 5 天 → 合计 20 → **2 / 6 / 12**，行为一字不变。

   ⚠️ 这个倍率**参与计算**（和 `pointsPerYuan` 那种纯展示的不一样）：
   它进 `defaultTiers` → 进 `checkInPayout` → 进真正落账的分数。
   所以「预览」和「实发」必须用同一个值，否则家长看到的阶梯和发出去的
   对不上 —— 本项目的老毛病（同一个事实存两份）。凡是调
   `checkInPayout` / `defaultTiers` 的地方都要把这个值传进去。

   为什么夹到 [0.2, 1.5]：
     · 下限 0.2 —— `defaultTiers` 里有一句 `Math.max(1, …)` 兜底
       （防止界面上出现「+0」）。倍率再往下压，小数任务会撞上这个
       兜底，家长点了 10% 却发现数字一动不动 —— 那是界面在骗人。
       0.2 已经能把周档从 20 分压到 10 分，够「细水长流」了。
     · 上限 1.5 —— 阶梯合计 = 1.5 × 基础分 × 目标天数，已经相当于
       「每次完成多拿 1.5 个基础分」。再高就不是奖励而是主要收入了。
   ============================================================ */

import type { Task } from './types'

/** 默认 0.8 —— 每完成一次，阶梯合计给 0.8 个基础分 */
export const DEFAULT_TIER_RATIO = 0.8

/** 下限：再低会被 `defaultTiers` 的 `Math.max(1, …)` 吃掉，界面会变成假话 */
export const MIN_TIER_RATIO = 0.2

/** 上限：阶梯合计 = 1.5 × 基础分 × 目标天数 */
export const MAX_TIER_RATIO = 1.5

/**
 * 界面上给家长点的几个档（20% / 40% / … / 150%）。
 *
 * ⚠️ 收在这里，别在「设置 → 规则」和「任务编辑」各写一份数组 ——
 * 两处各写一份，改一处漏一处，同一个倍率在两个界面显示成两个百分比，
 * 家长会以为自己设错了。`MIN_TIER_RATIO` / `MAX_TIER_RATIO` 就是首尾两项，
 * 有单测钉住这条一致性。
 */
export const TIER_RATIO_PRESETS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5] as const

/**
 * 把家长填的值夹到合法区间，并取到 2 位小数。
 *
 * `undefined` / `NaN` / `Infinity` 一律退回默认档 —— `loadSettings`
 * 会补默认值，但导入的旧备份可能直接是 `undefined`，不能让它变成
 * `NaN` 之后一路传进 `Math.round(NaN)`，算出 `+NaN` 挂在界面上。
 *
 * 取 2 位小数是为了让 0.8 这类值在 `Math.round` 前是干净的：
 * 界面上是「80%」，存下来就得是同一个数，不能是 0.7999999999。
 */
export function clampTierRatio(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return DEFAULT_TIER_RATIO
  const clamped = Math.min(MAX_TIER_RATIO, Math.max(MIN_TIER_RATIO, n))
  return Math.round(clamped * 100) / 100
}

/**
 * 这条签到任务**实际生效**的阶梯倍率 —— 唯一事实源。
 *
 * 2026-10-11 家长要「在任务编辑里也能改」，于是 `Task` 上多了
 * `checkInTierRatio`。
 * 2026-10-12 家长又拍板「不需要全局设定梯度、连续的。每个任务单独，
 * **有默认的就行了**」—— 所以原来那个 `fallback` 参数（指向
 * `settings.checkInTierRatio`）连同设置里那个字段一起删掉了。
 *
 * 现在的取值只有两级：
 *   ① 任务自己设过 → 用任务的（夹紧后）
 *   ② 没设 → `clampTierRatio(undefined)` 兜到 `DEFAULT_TIER_RATIO`
 *
 * ⚠️ 别在调用点写 `task.checkInTierRatio ?? DEFAULT_TIER_RATIO` ——
 * 那条式子会在「编辑器预览」「家长审核卡」「真正发分」三处各写一遍，
 * 漏掉任何一处就会分叉。本项目的老毛病（同一个事实存两份），
 * 这里收成一个函数。
 */
export function tierRatioFor(task: Pick<Task, 'checkInTierRatio'>): number {
  return clampTierRatio(task.checkInTierRatio)
}
