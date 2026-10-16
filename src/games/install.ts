/**
 * 「从目录装一款游戏」的**编排层** —— 把 `verify.ts` 的校验件串成一条链。
 *
 * ```
 *   catalog.json ──┐
 *                  ├─► 验签 ──► 解析 ──► 找到那一款 ──► 取包 ──► 验 SHA-256 ──► 代码文本
 *   catalog.json.sig ┘
 * ```
 *
 * ## 为什么单独一个文件（而不是直接写在 `useApp.ts` 的 action 里）
 *
 * 因为「这条链有没有按对的顺序走」必须**能被断言**。
 * 写在 store 的 action 里就只能靠 e2e 打真实网络 —— 而真实的失败路径
 * （签名不对 / 哈希不对 / 目录里没这款）恰恰是最难在 e2e 里造出来的。
 *
 * 所以这里刻意收成**纯编排**：
 *   · 公钥**当参数传**（不读 `catalogKey.ts` 的常量）⇒ 单测能自己造一对钥匙；
 *   · `fetch` **可注入** ⇒ 单测不用起服务器就能造出「签名对但哈希错」这类输入。
 * 生产路径由 `useApp.ts` 调，那边**只**传烧进 APK 的公钥（见 `catalogKey.ts`）。
 *
 * ⚠️ 这个文件里**没有**「跳过校验」的开关，也没有默认公钥。别加。
 */

import type { Bytes } from './bytes'
import {
  assertAllowedPackageUrl,
  fetchVerifiedPackage,
  loadVerifiedCatalog,
  type CatalogGame,
} from './verify'

/** 解析出来的「可安装的东西」：目录里的条目 + 已经验过哈希的代码文本。 */
export interface ResolvedGame {
  /** 目录里的条目（已验签）。用它来显示名字 / 版本，**不要**信包自己说的。 */
  game: CatalogGame
  /** 包代码（原始字节已过 SHA-256）。 */
  code: string
}

/** `.sig` 文件的内容是**单行 base64**（`scripts/sign-catalog.mjs` 写的）。 */
export function decodeSignature(text: string): Bytes {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('签名文件是空的 —— 多半是上传时漏了内容')
  try {
    return Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0))
  } catch {
    throw new Error('签名文件不是合法 base64 —— 它应该是 `sign-catalog.mjs sign` 产出的那一行')
  }
}

/** 目录地址 → 签名地址。约定：`…/catalog.json` → `…/catalog.json.sig`。 */
export function signatureUrlFor(catalogUrl: string): string {
  return `${catalogUrl}.sig`
}

/** 取一段 URL 的**原始字节**。失败时给出能排查的信息（状态码 / 原因）。 */
async function fetchBytes(url: string, fetchImpl: typeof fetch, label: string): Promise<Bytes> {
  let res: Response
  try {
    res = await fetchImpl(url)
  } catch (e) {
    // ⚠️ 跨域被挡时这里**只有** `TypeError: Failed to fetch`，看不出是 CORS。
    //    所以文案里直接点名这条最可能的原因（spec §12.3 末）。
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `拉取${label}失败：${msg}。` +
        '如果错误只有一句 `Failed to fetch`，最可能是**跨域**（托管端没发 CORS 头），' +
        '不是网络不通、也不是地址写错。',
    )
  }
  if (!res.ok) throw new Error(`拉取${label}失败：HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

/**
 * 走完整条链，返回「可以交给 `importBundle` 的代码文本」。
 *
 * ★ 顺序不可换：**先验签、再解析、再取包、再验哈希、最后才把代码交出去**。
 *   任何一个环节提前把代码交出去，都等于「先把陌生代码跑起来，再检查它该不该被跑」。
 */
export async function fetchVerifiedGame(opts: {
  /** 目录地址。必须是 https（localhost 例外，给本地走查用）。 */
  catalogUrl: string
  /** 要装哪一款（目录里的 id）。 */
  gameId: string
  /** 烧进 APK 的公钥（原始 32 字节）。生产路径传 `catalogPublicKeyRaw()`。 */
  publicKeyRaw: Bytes
  fetchImpl?: typeof fetch
}): Promise<ResolvedGame> {
  const { gameId, publicKeyRaw } = opts
  const fetchImpl = opts.fetchImpl ?? fetch

  // ① 目录地址本身也走 https 检查 —— 它是**写死在 App 里**的，
  //    绝不能来自 Intent / 用户输入（spec §12.4 的 Play 政策那一节）。
  const catalogUrl = assertAllowedPackageUrl(opts.catalogUrl, null)

  // ② 目录与签名**都要按原始字节取**（`verify.ts` 文件头 ①）。
  const catalogBytes = await fetchBytes(catalogUrl, fetchImpl, '游戏目录')
  const signature = decodeSignature(
    new TextDecoder().decode(await fetchBytes(signatureUrlFor(catalogUrl), fetchImpl, '目录签名')),
  )

  // ③ 验签 → 解析。base 传 catalogUrl，这样目录里的相对包地址能解析成绝对地址。
  const catalog = await loadVerifiedCatalog(catalogBytes, signature, publicKeyRaw, catalogUrl)

  // ④ 找到那一款。找不到要说清「目录里有什么」，否则排查的人不知道是 id 写错了还是没发版。
  const game = catalog.games.find((g) => g.id === gameId)
  if (!game) {
    const known = catalog.games.map((g) => g.id).join('、') || '（空目录）'
    throw new Error(`游戏目录里没有「${gameId}」。目录里现有：${known}`)
  }

  // ⑤ 取包 + 验 SHA-256。这一步过后字节才是可信的。
  const bytes = await fetchVerifiedPackage(game.url, game.sha256, fetchImpl)

  // ⑥ 到这一步才把代码交出去。用 `TextDecoder` 而不是 `res.text()` ——
  //    哈希已经验过的是 `bytes`，转文本只是为了喂 `importBundle`。
  return { game, code: new TextDecoder().decode(bytes) }
}
