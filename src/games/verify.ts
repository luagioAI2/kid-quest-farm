/**
 * P2（插件下载）的**校验核心** —— spec §12.4「安全：不可让步的一条」。
 *
 * ```
 *   ① 必须 HTTPS
 *   ② catalog.json 里每个游戏带 SHA-256，**装之前**校验
 *   ③ catalog.json 本身用 Ed25519 签名（catalog.json.sig），公钥烧进 APK（`catalogKey.ts`）
 * ```
 *
 * 不做 ②③ = **谁拿下那台静态服务器，谁就能在孩子的手机里跑任意代码**。
 * 所以这个文件里**没有**任何「跳过校验」的开关，也没有默认参数。
 *
 * ── ★★ 两条最容易写错的地方 ────────────────────────────────────────
 *
 * **① 校验必须针对「取回来的原始字节」，不能针对 `JSON.parse` 之后重新序列化的结果。**
 * `await res.text()` → `JSON.stringify(obj)` 这条路会让字节变（BOM、换行、键序、空格），
 * 于是「签名对的包」验不过，或者更糟：**你验的和你跑的不是同一串字节**。
 * ➜ 一律 `await res.arrayBuffer()` 拿到 `Uint8Array`，签名和哈希都吃这个。
 *
 * **② 「验不过」和「配错了」要分开报。**
 * 签名不匹配 = 包被换了（可能是攻击，也可能只是发版时忘了重签）→ 返回 `false`。
 * 公钥长度不对 / 环境没有 WebCrypto = 我们自己的配置或环境问题 → **抛**。
 * 混在一起的话，一个坏掉的公钥会伪装成「签名无效」，排查会跑偏。
 *
 * ── 实测（2026-10-17，Chrome 155 headless，见 `.e2e-scratch/probe-ed25519.mjs`）──
 *
 * `isSecureContext = true`；`crypto.subtle.digest('SHA-256')` 已知答案对得上
 * （`ba7816bf…`）；`crypto.subtle.generateKey({name:'Ed25519'})` 可用、导出公钥 32 字节。
 * ⇒ **原生 WebCrypto 就够，不需要引任何第三方密码学库。**
 * Node 22 的 `globalThis.crypto.subtle` 同样支持（单测跑在 node 环境）。
 */

import type { Bytes } from './bytes'
import { ED25519_PUBLIC_KEY_BYTES } from './catalogKey'

/** 一个游戏包在 `catalog.json` 里的条目。字段口径见 spec §12.5 的 `GameBundle.manifest`。 */
export interface CatalogGame {
  /** 和内置游戏**共用一套 id 空间** —— 所以不许占用内置 id（spec §12.2，P1 已做守卫）。 */
  id: string
  name: string
  /** 语义化版本。同 id 多版本时用来判断「要不要更新」。 */
  version: string
  /** 包地址：相对路径（相对 catalog 的地址）或绝对 `https://`。 */
  url: string
  /** 包文件的 SHA-256，**小写** 64 位 hex。 */
  sha256: string
  /** 可选：字节数。用来在下载前给出体积提示，**不是**校验依据。 */
  size?: number
}

export interface Catalog {
  /** catalog 格式版本，用来以后演进。 */
  version: number
  games: CatalogGame[]
}

/**
 * 64 位 hex。
 *
 * 大小写**不敏感** —— 调用方一律先 `toLowerCase()` 再进这里（哈希本身没有大小写之分，
 * 卡这个只会让发版的人莫名其妙）。但**长度 / 字符集不对一律不算通过**，
 * 不做「补零」「截断」之类的宽容匹配。
 */
const HEX64 = /^[0-9a-f]{64}$/

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle
  if (!s) {
    throw new Error(
      '这个运行环境没有 WebCrypto（`crypto.subtle`）—— 校验不可能跳过，直接失败。' +
        '浏览器需要 secure context（https 或 localhost）。',
    )
  }
  return s
}

/* ------------------------------------------------------------------ *
 * SHA-256
 * ------------------------------------------------------------------ */

export async function sha256Hex(data: Bytes): Promise<string> {
  const digest = await subtle().digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 比对哈希。**期望值本身不合法时返回 `false`（不是抛）** ——
 * 因为「catalog 里写了一个不是 64 位 hex 的 sha256」正是**攻击者能控制的输入**
 * （catalog 在被验签之前就是不可信数据），这种输入必须走「校验不通过」这条路。
 */
export async function verifySha256(data: Bytes, expectedHex: string): Promise<boolean> {
  const want = expectedHex.trim().toLowerCase()
  if (!HEX64.test(want)) return false
  return (await sha256Hex(data)) === want
}

/** 校验不过就抛，并且把两个哈希都打出来 —— 排查时第一眼要看的就是它们。 */
export async function assertSha256(data: Bytes, expectedHex: string, label: string): Promise<void> {
  const got = await sha256Hex(data)
  if (got !== expectedHex.trim().toLowerCase()) {
    throw new Error(
      `${label} 的 SHA-256 对不上：期望 ${expectedHex.trim().toLowerCase()}，实际 ${got}（${data.byteLength} 字节）`,
    )
  }
}

/* ------------------------------------------------------------------ *
 * Ed25519
 * ------------------------------------------------------------------ */

/**
 * 导入原始 32 字节公钥。
 *
 * 长度不对 / 导不进去 = **配置问题**，直接抛（见文件头 ②）。
 * 浏览器太老不支持 Ed25519 也会走到这里 —— 报错文案要说清是环境不是包。
 */
export async function importEd25519PublicKey(publicKeyRaw: Bytes): Promise<CryptoKey> {
  if (publicKeyRaw.byteLength !== ED25519_PUBLIC_KEY_BYTES) {
    throw new Error(`Ed25519 公钥必须是 ${ED25519_PUBLIC_KEY_BYTES} 字节，实际 ${publicKeyRaw.byteLength}`)
  }
  try {
    return await subtle().importKey('raw', publicKeyRaw, { name: 'Ed25519' } as AlgorithmIdentifier, false, [
      'verify',
    ])
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Ed25519 公钥导不进去（${msg}）—— 要么 base64 解错了，要么这个浏览器不支持 Ed25519。` +
        '支持度实测见 src/games/verify.ts 的文件头。',
    )
  }
}

/** 验签。返回 `false` = 签名对不上（包被改过 / 用错了私钥签）。 */
export async function verifyEd25519(
  publicKey: CryptoKey,
  signature: Bytes,
  message: Bytes,
): Promise<boolean> {
  try {
    return await subtle().verify({ name: 'Ed25519' } as AlgorithmIdentifier, publicKey, signature, message)
  } catch {
    // 签名长度不对之类：也算「没通过」，不区分 —— 反正都不许装。
    return false
  }
}

/**
 * 校验 catalog 的签名。**这是整条下载链的总闸**：不过这一关，下面的
 * `parseCatalog` 连跑都不该跑（catalog 在被验签之前是**不可信数据**）。
 */
export async function verifyCatalogSignature(
  catalogBytes: Bytes,
  signature: Bytes,
  publicKeyRaw: Bytes,
): Promise<boolean> {
  const key = await importEd25519PublicKey(publicKeyRaw)
  return verifyEd25519(key, signature, catalogBytes)
}

/* ------------------------------------------------------------------ *
 * catalog 解析（形状校验，fail closed）
 * ------------------------------------------------------------------ */

/**
 * 允许的包地址。
 *
 * **只走 HTTPS**（spec §12.4 条件 1）。唯一例外是 `localhost` / `127.0.0.1`：
 * 走查脚本就是本地起的静态服务（`scripts/capture-game-bundle.mjs`），
 * 不放这个口子的话这条链路**在本地根本没法验**。Android 正式包另有
 * `allowMixedContent: false` 兜底，所以这个口子只在开发机上生效。
 */
export function assertAllowedPackageUrl(raw: string, base: string | null): string {
  const url = new URL(raw, base ?? undefined)
  const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocalhost)) {
    throw new Error(`包地址必须走 https（只允许 localhost 例外）：${raw}`)
  }
  return url.toString()
}

function requireString(obj: Record<string, unknown>, key: string, where: string): string {
  const v = obj[key]
  if (typeof v !== 'string' || !v.trim()) throw new Error(`${where} 的 \`${key}\` 必须是非空字符串`)
  return v
}

/**
 * 解析并**逐条校验** catalog 的形状。
 *
 * ⚠️ 必须在**验签通过之后**才调用。这个函数只保证「形状像 catalog」，
 * 不保证「内容可信」—— 可信是签名给的。
 */
export function parseCatalog(bytes: Bytes, base: string | null = null): Catalog {
  let obj: unknown
  try {
    obj = JSON.parse(new TextDecoder().decode(bytes))
  } catch (e) {
    throw new Error(`catalog 不是合法 JSON：${e instanceof Error ? e.message : String(e)}`)
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('catalog 顶层必须是对象')
  }
  const root = obj as Record<string, unknown>
  const version = root.version
  if (typeof version !== 'number' || !Number.isFinite(version)) {
    throw new Error('catalog 的 `version` 必须是数字')
  }
  if (!Array.isArray(root.games)) throw new Error('catalog 的 `games` 必须是数组')

  const seen = new Set<string>()
  const games = root.games.map((raw, i): CatalogGame => {
    const where = `catalog.games[${i}]`
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
      throw new Error(`${where} 必须是对象`)
    }
    const g = raw as Record<string, unknown>
    const id = requireString(g, 'id', where)
    if (seen.has(id)) throw new Error(`${where} 的 id「${id}」重复了 —— 同一个 id 只能有一条`)
    seen.add(id)

    const sha = requireString(g, 'sha256', `${where}(${id})`).trim().toLowerCase()
    if (!HEX64.test(sha)) {
      throw new Error(`${where}(${id}) 的 sha256 不是 64 位小写 hex：「${g.sha256 as string}」`)
    }
    const url = requireString(g, 'url', `${where}(${id})`)

    const size = g.size
    if (size !== undefined && (typeof size !== 'number' || !Number.isFinite(size) || size < 0)) {
      throw new Error(`${where}(${id}) 的 size 必须是非负数字`)
    }

    return {
      id,
      name: requireString(g, 'name', `${where}(${id})`),
      version: requireString(g, 'version', `${where}(${id})`),
      url: assertAllowedPackageUrl(url, base),
      sha256: sha,
      ...(size === undefined ? {} : { size: size as number }),
    }
  })

  return { version, games }
}

/* ------------------------------------------------------------------ *
 * 组合入口
 * ------------------------------------------------------------------ */

/**
 * 把「验签 → 解析」串成一步。**装任何东西之前都应该先过这里。**
 *
 * 顺序不能反：先验签、再解析。反过来的话，解析器要吃**未验签**的输入
 * （catalog 是被下载回来的，天生不可信）。
 */
export async function loadVerifiedCatalog(
  catalogBytes: Bytes,
  signature: Bytes,
  publicKeyRaw: Bytes,
  base: string | null = null,
): Promise<Catalog> {
  const ok = await verifyCatalogSignature(catalogBytes, signature, publicKeyRaw)
  if (!ok) {
    throw new Error(
      'catalog.json 的签名对不上 —— 拒绝使用。' +
        '要么包被改过，要么发版时忘了重新签名（`node scripts/sign-catalog.mjs sign catalog.json`）。',
    )
  }
  return parseCatalog(catalogBytes, base)
}

/**
 * 取一个游戏包并校验它的 SHA-256，返回**原始字节**（不是 text）。
 *
 * ⚠️ 返回字节而不是字符串：调用方接着要 `new Blob([bytes])` + blob URL 加载，
 * 中途任何一次 `text()` ↔ `encode()` 往返都可能让字节和哈希对不上。
 */
export async function fetchVerifiedPackage(
  url: string,
  expectedSha256: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Bytes> {
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`下载 ${url} 失败：HTTP ${res.status}`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  await assertSha256(bytes, expectedSha256, `包 ${url}`)
  return bytes
}
