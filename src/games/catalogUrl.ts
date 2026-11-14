/**
 * `catalog.json` 的**托管地址** —— 和公钥一样，**烧进 APK**。
 *
 * ── 为什么它不能是一个输入框 ──────────────────────────────────────
 *
 * spec §12.4「Play 政策」那一节查证过：政策把「webview 加载**未验证的 URL**
 * （来自不可信来源）」列为违规示例。所以目录地址**必须写死在 App 里**，
 * 不能来自 Intent、不能来自家长在设置页里填的字符串。
 *
 * 家长 2026-10-15 拍板「上 Play」，这条不是洁癖 —— 它是过审论据的一部分。
 * 设置页里的「游戏商店」卡片因此**没有地址输入框**，只读这个常量。
 *
 * ── 值从哪来：**构建期**注入，不是运行期输入 ──────────────────────
 *
 *     VITE_GAME_CATALOG_URL=https://cdn.example.com/games/catalog.json npm run build
 *
 * 为什么允许 env：目录地址**每个环境不一样**（联调指 8090，线上指 CDN），
 * 写死一个字符串就只能改代码。而 env 是**构建时**打进去的 —— 和写死在源码里
 * 等价，仍然拿不到「运行期改地址」的能力，Play 政策那条判据不变。
 *
 * 空着 = 下载功能不可用（fail closed）：设置页的行只走随包发的本地包。
 *
 * ⚠️ 唯一例外是本地演示：`http://127.0.0.1:…` 在 `assertAllowedPackageUrl`
 * 里被放行（给 `scripts/demo-catalog.mjs` 用），**上线不许用**。
 */
export const CATALOG_URL = (import.meta.env?.VITE_GAME_CATALOG_URL ?? '').trim()

/**
 * 有没有配商店。设置页据此决定「显示商店」还是「显示一句说明」。
 *
 * ★ 单独一个函数而不是在组件里写 `CATALOG_URL.length > 0`：
 *   判断口径只留一处，将来加「多商店」之类的改动只需要动这里。
 */
export function catalogConfigured(): boolean {
  return CATALOG_URL.trim().length > 0
}
