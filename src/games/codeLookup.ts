/**
 * 兑换码 → 游戏 id 的查表（spec §6 的 P2）。
 *
 * 码表在 `codeTable.ts`（**生成的文件，别手改**），这里只负责「怎么查」。
 * 拆成两个文件是因为码表会被 `scripts/mint-codes.mjs` 整份覆盖 ——
 * 逻辑放进去的话，每次重新发码都要把逻辑重新贴一遍。
 *
 * ## 为什么查的是哈希
 *
 * 设备里**不存明文码**。输入的码归一化之后算 sha256，拿哈希去表里找。
 * 好处是包被拆开也拿不到能用的码；代价是**丢了明文就没法反查**，
 * 所以明文那份（`scripts/_codes-*.txt`）必须自己留好。
 */

import { sha256Hex } from './verify'
import { GAME_CODE_HASHES } from './codeTable'
import { normalizeGameCode } from '../domain/gameCode'

/**
 * 归一化后的码 → 游戏 id。查不到返回 `undefined`。
 *
 * ⚠️ **不做格式校验**：调用方要先过 `isGameCode`。分开是为了让「格式不对」
 * 和「码不存在」给两句不同的提示 —— 孩子敲错一位和拿到一张假卡，
 * 该说的话不一样。
 */
export async function gameIdForCode(raw: string): Promise<string | undefined> {
  const code = normalizeGameCode(raw)
  if (!code) return undefined
  const hash = await sha256Hex(new TextEncoder().encode(code))
  return GAME_CODE_HASHES[hash]
}

/** 码的哈希（存进 `wishCodes` 防重用）。和查表用的是同一个算法，别分叉 */
export async function codeHashOf(raw: string): Promise<string> {
  return sha256Hex(new TextEncoder().encode(normalizeGameCode(raw)))
}

/** 码表里有几条。给「这个版本有没有配过码」这类判断和测试用 */
export function codeTableSize(): number {
  return Object.keys(GAME_CODE_HASHES).length
}
