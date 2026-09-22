/* ============================================================
   现金 : 积分 —— **参考汇率**（2026-09-21 用户要求）
   ------------------------------------------------------------
   用户原话：

   > 「另外 设置里 添加 现金对积分 比例。 默认 1:10 。 也要显示到
   >   兑换页。 主要是让家长看着， 兑换能够参照的， 不影响数值。」

   口径：`pointsPerYuan` = **1 元等于多少积分**，默认 10
   （就是用户说的「1:10」，现金 : 积分）。于是 30 分 ≈ ¥3 ——
   家长一眼能判断「花三块钱换个零食值不值」。

   ⚠️⚠️ **这是纯展示口径，不参与任何计算。** 用户明确「不影响数值」：
   它不进结算、不进兑换扣分、不进农场经济、不改任何账本。
   全项目只有两处合法用法 ——
     · `features/settings/SettingsPage.tsx`：家长编辑它
     · `features/redeem/RedeemSheet.tsx`：拿它换算成钱显示
   grep `pointsPerYuan` 应该只命中这两处 + 本文件 + 测试。
   谁想拿它去「打折」「按汇率换算积分」，先回来读这段话。

   为什么夹到 [1, 1000]：填 0 会得到 ¥∞，填负数会得到负金额，
   展示直接崩。1 分 = 1 元 到 1000 分 = 1 元 已经覆盖「很抠」到
   「很阔」两端，再极端就不是参考而是玩具了。
   ============================================================ */

/** 默认 1 元 = 10 分（用户说的「1:10」） */
export const DEFAULT_POINTS_PER_YUAN = 10

/** 1 分 = 1 元（最「贵」的积分） */
export const MIN_POINTS_PER_YUAN = 1

/** 1000 分 = 1 元（最「便宜」的积分） */
export const MAX_POINTS_PER_YUAN = 1000

/**
 * 把家长填的值夹到合法区间，并取整。
 *
 * `undefined` / `NaN` / `Infinity` 一律退回默认档 —— 老数据库里没有
 * 这个字段（`loadSettings` 会补默认值），但导入的旧备份可能直接是
 * `undefined`，不能让它变成 `NaN` 渲染出「¥NaN」。
 */
export function clampPointsPerYuan(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return DEFAULT_POINTS_PER_YUAN
  return Math.min(MAX_POINTS_PER_YUAN, Math.max(MIN_POINTS_PER_YUAN, Math.round(n)))
}

/** 积分 → 元（**只用于展示**）。汇率非法时退回默认档。 */
export function pointsToYuan(points: number, pointsPerYuan?: number): number {
  return points / clampPointsPerYuan(pointsPerYuan)
}

/**
 * 积分 → 「¥3」「¥4.5」「¥150」这样的字符串。
 *
 * 四舍五入到**分**（2 位小数）再去掉尾零：30 分 ÷ 10 = 3 → 「¥3」；
 * 45 分 ÷ 10 = 4.5 → 「¥4.5」；1500 分 ÷ 10 = 150 → 「¥150」。
 * 参考价不需要角分，再小的零头也不显示。
 *
 * 为什么不用 `toLocaleString` / `Intl.NumberFormat`：两者在不同
 * 环境（Node 测试 / Android WebView）里的默认 locale 不一样，会
 * 冒出「¥3.00」或者千分位「¥1,500」，而这是个给孩子看的短标签，
 * 必须**逐字可控** —— 单测直接钉字符串。
 */
export function formatYuan(points: number, pointsPerYuan?: number): string {
  const yuan = pointsToYuan(points, pointsPerYuan)
  if (!Number.isFinite(yuan)) return '¥—'
  const rounded = Math.round(yuan * 100) / 100
  // `toFixed(2)` 保证不会出现 `0.30000000000000004` 这类浮点尾巴，
  // 再去掉「.00」「.50」里的尾零 → 「3」「4.5」「150」。
  const s = rounded.toFixed(2).replace(/\.?0+$/, '')
  return `¥${s === '' ? '0' : s}`
}
