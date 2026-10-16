/**
 * 三套币的「显示名 + 图标」—— 从源码里读，不在验收脚本里再抄一份
 * ------------------------------------------------------------
 * 为什么要有这个文件：
 *
 * 2026-10-16 把「丰收币」改名成「点券」，顺带把图标从 `🌾` 换成了 `🎟️`。
 * 改的是 `src/domain/currency.ts`（那里是唯一事实源），但**验收脚本没跟着改** ——
 * 于是 `e2e-check.mjs` 掉了 6 条、`e2e-bag-sell.mjs` 掉了 3 条，
 * 而**应用本身完全是对的**（弹层头写着 `🎟️ 8`，真实余额就是 8）。
 *
 * 这是本项目的老毛病，`scripts/lib/quality.mjs` 的文件头写过一模一样的版本：
 * **在验收脚本里抄第二份名字列表，抄的那份过期时不会响。**
 * 五档那次是「不错」→「良好」，这次是「丰收币 🌾」→「点券 🎟️」。
 *
 * ## ⚠️ 为什么不能全局替换 `🌾`
 *
 * `🌾` **不是货币专用**的 —— 它同时是：
 *   · 农场 tab 的图标（`capture-animals.mjs` 用 `clickExact(page, '🌾农场')` 定位）
 *   · 作物某个生长阶段的图标
 *   · 启动页插图
 * 所以「把脚本里的 🌾 全换成 🎟️」会把**导航定位**一起改坏。
 * 这个文件只回答「**货币**叫什么、长什么样」，调用方自己判断那一处是不是货币。
 *
 * ## 解析失败必须炸
 *
 * 解析不出 3 条就 `throw` —— 不能返回空对象。返回空的话
 * `''.includes(...)` 恒真 / `new RegExp('')` 匹配一切，
 * 守卫会**静默变成永远通过**，比不写还糟（同 quality.mjs 的理由）。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const CURRENCY_SRC = join(PROJECT_ROOT, 'src', 'domain', 'currency.ts')

/** 期望的币种数量。少了说明解析坏了（或有人删了币种），必须人工看一眼。 */
const EXPECTED_CURRENCIES = 3

/**
 * 读出三套币的显示口径，例如
 * `{ points: {name:'积分', emoji:'🪙'}, coupon: {name:'点券', emoji:'🎟️'}, mall: {name:'商城币', emoji:'🛍️'} }`
 * @returns {Record<string, {name: string, emoji: string}>}
 */
export function readCurrencies() {
  let text
  try {
    text = readFileSync(CURRENCY_SRC, 'utf8')
  } catch (e) {
    throw new Error(`读不到 ${CURRENCY_SRC}：${e.message}`)
  }

  // 只认 `CURRENCY` 那个对象字面量里的条目：
  //   points: { name: '积分', emoji: '🪙', tone: 'sun' },
  const block = text.match(/export const CURRENCY[^{]*\{([\s\S]*?)\n\}/)
  if (!block) throw new Error(`${CURRENCY_SRC} 里找不到 CURRENCY 对象字面量`)

  const out = {}
  const re = /(\w+)\s*:\s*\{\s*name:\s*'([^']*)'\s*,\s*emoji:\s*'([^']*)'/g
  for (const m of block[1].matchAll(re)) {
    out[m[1]] = { name: m[2], emoji: m[3] }
  }

  const ids = Object.keys(out)
  if (ids.length !== EXPECTED_CURRENCIES) {
    throw new Error(
      `从 ${CURRENCY_SRC} 只解析出 ${ids.length} 套币（期望 ${EXPECTED_CURRENCIES}）：` +
        `${JSON.stringify(ids)} —— 解析坏了或币种变了，别让守卫静默变空`,
    )
  }
  return out
}

/** 三套币的显示口径。模块加载时就解析，解析坏了直接炸（fail fast）。 */
export const CURRENCY = readCurrencies()

/** 取某套币的口径；id 写错时立刻炸，而不是静默给 undefined。 */
export function currency(id) {
  const c = CURRENCY[id]
  if (!c) throw new Error(`未知币种 id「${id}」，可用：${Object.keys(CURRENCY).join(' / ')}`)
  return c
}

/** 点券（2026-10-16 前叫「丰收币」）。⚠️ 只改显示名，`harvest*` 键名一律不改。 */
export const COUPON = currency('coupon')
/** 积分。 */
export const POINTS = currency('points')
/** 商城币。 */
export const MALL = currency('mall')

/**
 * 「点券」的旧显示名。用来写**反向钉子**：
 * 界面上不该再出现「丰收币」这三个字（出现了说明有一处漏改）。
 *
 * ⚠️ 解析不出就返回 `null`，调用方**必须**判空后再用 ——
 * 否则 `null` 会被当成字符串 `'null'` 去 `includes`，反向钉子永远通过。
 */
export function legacyCouponName() {
  const text = readFileSync(CURRENCY_SRC, 'utf8')
  const m = text.match(/COUPON_WAS_RENAMED_FROM\s*=\s*'([^']*)'/)
  return m ? m[1] : null
}
