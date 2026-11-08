/**
 * 版本号比较 —— 只做「谁更新」这一件事。
 *
 * ## 为什么不用现成的 semver
 *
 * 插件包的版本是我们自己在 `manifest.version` 里写的（`1.0.0` / `1.0.1`），
 * 没有预发布标签、没有 build 元数据、没有区间约束。引一个 semver 库
 * 只为了比三个数字，等于为了一个 `>` 装 40KB 依赖。
 *
 * ## 为什么必须有它（而不是直接 `!==`）
 *
 * 「已装版本和目录里的版本不一样」有**两种**情况，处理方式相反：
 *   · 目录更新（`1.0.0` → `1.0.2`）⇒ 该给「更新」按钮
 *   · 目录更旧（回滚到 `1.0.0`，机器上是 `1.0.2`）⇒ **不能**给「更新」，
 *     那会把用户降级，而且看起来像「更新成功」
 * 用 `!==` 分不开这两种，界面就会在回滚之后一直劝人「更新」到旧版。
 */

/** 去掉前缀 `v` / `V`，再按 `.` 切。非数字段一律按 0（`1.0.0-beta` 的 `0-beta` → 0）。 */
function parts(v: string): number[] {
  return String(v ?? '')
    .trim()
    .replace(/^v/i, '')
    .split('.')
    .map((s) => {
      const n = Number.parseInt(s, 10)
      return Number.isFinite(n) ? n : 0
    })
}

/**
 * 比较两个版本号。
 *
 * @returns `1` = a 比 b 新，`0` = 一样，`-1` = a 比 b 旧
 *
 * 位数不同时按 0 补齐（`1.0` 与 `1.0.0` 相等），否则 `1.0` 和 `1.0.0`
 * 会被判成不同版本，界面就会给一个永远点不完的「更新」。
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const pa = parts(a)
  const pb = parts(b)
  const n = Math.max(pa.length, pb.length)
  for (let i = 0; i < n; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x > y) return 1
    if (x < y) return -1
  }
  return 0
}

/** 目录里的版本比已装的更新 ⇒ 该显示「更新」。 */
export function hasUpdate(available: string, installed: string): boolean {
  return compareVersions(available, installed) > 0
}
