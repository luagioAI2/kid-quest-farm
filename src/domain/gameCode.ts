/**
 * 游戏兑换码的**格式**（spec §6 的 P2）。
 *
 * ```
 *   付款（淘宝 / 微信）→ 拿到一张卡 → 在小任务农场里输码 → 解锁那一款游戏
 * ```
 *
 * ## 这个文件只管「码长什么样」，一行业务都没有
 *
 * 码表在 `games/codeTable.ts`（**只存 sha256**），兑换在
 * `store/useApp.ts` 的 `redeemGameCode`。这里只有「归一化 / 校验 / 显示 / 生成」，
 * 因为格式错了的表现是「码明明是对的，界面说不对」—— 那是最难查的一类。
 *
 * ## 为什么是 6 位、为什么去掉 I L O U
 *
 * 码是**手输**的（印在卡片上、家长念、孩子敲）。所以：
 *   · 去掉 `I` `L` `O` `U` —— 前三个和 `1` `0` 在手写体里分不清，
 *     `U` 是 Crockford 的老规矩（避免随机拼出脏词）。
 *   · 输入时把 `I` `L` 当成 `1`、`O` 当成 `0` —— **孩子敲错了不该被骂**，
 *     能自动纠正的就必须自动纠正。
 *   · 6 位 × 32 字母表 = 10 亿种。撞码不是真问题（真问题是手输错位），
 *     所以这里不做「猜不中」的设计，猜不中靠的是**码表只存哈希**：
 *     输入错的码算出来的哈希不在表里，直接拒绝。
 *
 * ## ⚠️ 码不是密码
 *
 * 它印在卡片上、会拍照、会转发。这里的一切设计都是为了**输错能被纠正**，
 * 不是为了「拿到卡的人打不开」。真要防这个，得服务端核销 —— 那是 P3。
 */

/**
 * Crockford Base32 的字母表：**32 个字符，去掉了 I L O U**。
 *
 * 长度必须正好 32 —— 取模才不会偏。少一个字符就会让某些字母出现得更频繁，
 * 而那种偏差**不会报错**，只会让撞码概率悄悄变高。
 *
 * ⚠️ 改这里必须同时改 `scripts/mint-codes.mjs` 里那份（脚本是 `.mjs`，
 * 跑在 Node 里，import 不了 `.ts`）。两份不一致的症状是
 * **脚本生成的码全部兑换失败**，而 `codeTable.test.ts` 会先把这件事挡住。
 */
export const GAME_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/** 码的长度（不含分隔符） */
export const GAME_CODE_LEN = 6

/** 易混字符的**自动纠正**表。只在归一化时用，不参与生成 */
const LOOKALIKE: Record<string, string> = { I: '1', L: '1', O: '0' }

/**
 * 归一化：大写、去分隔符、纠正易混字符。
 *
 * ⚠️ 非法字符**不在这里删**（比如中文、标点）—— 删掉它们会让
 * 「ABCDEF!!」变成合法的「ABCDEF」，等于让乱输入通过。非法字符留给
 * `isGameCode` 判死。这里只做「大小写 / 连字符 / 易混字符」三件事。
 */
export function normalizeGameCode(raw: string): string {
  const s = (raw ?? '')
    .toUpperCase()
    // 只去掉**人眼看不出**的东西：空白、连字符、全角间隔号
    .replace(/[\s\-_·・]/g, '')
  let out = ''
  for (const ch of s) out += LOOKALIKE[ch] ?? ch
  return out
}

/** 是不是一个格式合法的码（长度 + 字符集，不做任何业务判断） */
export function isGameCode(raw: string): boolean {
  const code = normalizeGameCode(raw)
  if (code.length !== GAME_CODE_LEN) return false
  for (const ch of code) if (!GAME_CODE_ALPHABET.includes(ch)) return false
  return true
}

/** 显示用：`ABC-DEF`。念给孩子听、抄在纸上都靠它 */
export function formatGameCode(raw: string): string {
  const code = normalizeGameCode(raw)
  if (code.length !== GAME_CODE_LEN) return code
  return `${code.slice(0, 3)}-${code.slice(3)}`
}

/**
 * 生成一个新码（给 `scripts/mint-codes.mjs` 用，App 运行时不调它）。
 *
 * `crypto.getRandomValues` 而不是 `Math.random()` —— 后者在同一个进程里
 * 可以预测。256 % 32 === 0，所以 `% 32` 不引入偏差。
 *
 * ⚠️ 这里**不查重**：撞码要查表，那是脚本的事（纯函数不该碰文件系统）。
 */
export function mintGameCode(): string {
  const buf = new Uint8Array(GAME_CODE_LEN)
  globalThis.crypto.getRandomValues(buf)
  let out = ''
  for (const b of buf) out += GAME_CODE_ALPHABET[b % GAME_CODE_ALPHABET.length]
  return out
}
