/**
 * `catalog.json` 的 **Ed25519 公钥**（spec §12.4：「公钥**烧进 APK**」）。
 *
 * ── 现在配的是哪一把 ────────────────────────────────────────────────
 *
 * 2026-11-07 配上了（同日轮换过一次）。公钥**不要自己从私钥里截**：
 * 私钥可能是 32 字节 seed，也可能是 64 字节 seed+public，截法不一样，
 * 截错只会得到一串「长度对但内容错」的 base64，症状是「所有包都验签失败」。
 * 唯一可信的来源是自检接口（它直接返回服务端正在用的公钥）：
 *
 *     POST /api/admin/game/release/self-check  →  data.public_key_base64
 *
 *     node scripts/sign-catalog.mjs keygen          # 生成新密钥对（私钥别提交）
 *     node scripts/sign-catalog.mjs sign catalog.json   # 手工签一份目录
 *
 * ⚠️ **私钥不许进仓库**。现在 `tf-platform-api/configs/config.yaml` 里那把是联调用的，
 *    上生产要换环境变量 `TF_GAME_CATALOG_KEY` 并轮换，这里跟着换公钥。
 *
 * ── ⚠️⚠️ 空着 = 下载功能不可用，这是**故意的**（fail closed） ──────────
 *
 * 一个「没配公钥就跳过验签」的分支，等于把
 * 「谁拿下那台静态服务器，谁就能在孩子的手机里跑任意代码」变成**默认行为**。
 * 宁可下载装不上（会抛一句明确的错），也**不能**静默不验。
 * 这条判据写在 `src/games/verify.test.ts` 里钉着。
 */

import type { Bytes } from './bytes'

export const CATALOG_PUBLIC_KEY_B64 = 'HPxsTdyzBjbnFVvvbzRM9jjhfeTKsQSX9I8w128mm5k='

/**
 * Ed25519 原始公钥固定 32 字节。
 *
 * ★ 只在这里定义一次，`verify.ts` 也从这里 import —— 32 这个数字写两遍
 * 就会有一天只改一处（「同一个事实存两份就一定会走散」）。
 */
export const ED25519_PUBLIC_KEY_BYTES = 32

/**
 * 把 base64 公钥解成原始字节。**纯函数**，坏输入一律抛。
 *
 * 拆出来是为了让它**可被断言**：如果这段逻辑焊死在 `catalogPublicKeyRaw()` 里，
 * 想测「长度不对会抛」就得去 mock 被测模块本身（那等于什么都没测）。
 *
 * 没配 / 配错**一律抛**，绝不返回空数组 —— 空数组喂给 `importKey` 会失败，
 * 但如果调用方把它当成「没配就跳过」，整个验签就变成摆设。
 */
export function parseCatalogPublicKey(b64: string): Bytes {
  const trimmed = b64.trim()
  if (!trimmed) {
    throw new Error(
      'catalog 公钥还没配（src/games/catalogKey.ts 的 CATALOG_PUBLIC_KEY_B64 是空的）。' +
        '先跑 `node scripts/sign-catalog.mjs keygen`，把公钥粘进去。' +
        '⚠️ 这里**故意不提供「跳过验签」的开关** —— 见这个文件的注释。',
    )
  }
  let raw: Bytes
  try {
    raw = Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0))
  } catch {
    throw new Error('CATALOG_PUBLIC_KEY_B64 不是合法 base64 —— 别手敲，用 keygen 的输出。')
  }
  if (raw.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(
      `Ed25519 公钥必须是 ${ED25519_PUBLIC_KEY_BYTES} 字节（base64 解出来 ${raw.length} 字节）` +
        '—— 多半是把私钥或者签名的 base64 粘进来了。',
    )
  }
  return raw
}

/** 取烧进 APK 的公钥（原始 32 字节）。 */
export function catalogPublicKeyRaw(): Bytes {
  return parseCatalogPublicKey(CATALOG_PUBLIC_KEY_B64)
}
