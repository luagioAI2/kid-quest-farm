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
 * Node 22 的 `globalThis.crypto.subtle` 同样支持（单测跑在 node 环境）。
 *
 * ── ★★ 2026-11-13 修正：上面那句结论**只对 Chrome 113+ 成立** ──────────
 *
 * 用户报「APP 里设置 → 游戏无法下载，提示 **ed 密钥没法导入**」。
 * 排查：公钥 32 字节 ✓、签名用两套实现各验一次都通过 ✓、
 * 不是非安全上下文（那种报「没有 WebCrypto」，文案不同）。
 * ⇒ 是 **WebView 不认识 Ed25519**。
 *
 * `Ed25519` 是 **Chrome 113** 才进 WebCrypto 的。老安卓机的 System WebView
 * 常年停在更早版本 ⇒ 「有 `subtle`、但没有 Ed25519」⇒ 一装就报这句。
 *
 * 我当时的错在于：**把自己的浏览器支持当成了用户的浏览器支持**，
 * 而"实测"只测了一台 Chrome 155。
 *
 * 所以现在**两层**：优先原生（快、不吃包体），导不进去才回退纯 JS
 * （`@noble/ed25519`）。⚠️ 兜底**绝不是"跳过验签"**。
 */

import type { Bytes } from './bytes'
import { readBodyWithProgress, type DownloadProgress } from './download'
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
  /**
   * 可选：**资源根**（以 `/` 结尾）。缺省 = 包所在目录。
   *
   * 为什么要能单独指定：包本体可能放 GitHub Release（体积小、更新频繁），
   * 而几十 MB 的贴图放在 CDN 或对象存储上。两者不在同一个目录，
   * 所以「资源根 = 包地址的目录」不能当默认假设硬编码。
   *
   * 挂载时会作为 `ctx.assetBase` 交给插件（见 `plugin.ts` 的 `MountContext`）。
   */
  assetBase?: string
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
    /* ★ 不再直接抛 —— 可能是老 WebView 不认识 Ed25519（Chrome < 113）。
       记下原因，让调用方回退纯 JS（见 verifyEd25519 的注释）。
       用 `--` 前缀标记，避免和「配置错」混在一起。 */
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`--no-subtle-ed25519--${msg}`)
  }
}

/** 是不是「原生不支持 Ed25519」这一种失败（而不是公钥本身坏了）。 */
function isSubtleUnsupported(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return msg.startsWith('--no-subtle-ed25519--')
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
 * 纯 JS 兜底验签（2026-11-13）。
 *
 * 用在**这台设备不支持 WebCrypto Ed25519** 的时候（老安卓 WebView）。
 * 语义和 `verifyEd25519` 完全一致：返回 `false` = 没通过，不许装。
 *
 * ⚠️ `@noble/ed25519` v3 要求先喂 `sha512`（它自己不带哈希实现）。
 *    这一行**必须**在调用 verify 之前 —— 忘了会抛「hashes.sha512 未设置」。
 */
async function verifyEd25519Pure(
  publicKeyRaw: Bytes,
  signature: Bytes,
  message: Bytes,
): Promise<boolean> {
  const ed = await import('@noble/ed25519')
  const { sha512 } = await import('@noble/hashes/sha2.js')
  ed.hashes.sha512 = sha512
  try {
    return ed.verify(signature, message, publicKeyRaw)
  } catch {
    // 签名长度不对 / 点不在曲线上 … 一律算没通过
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
  /* ★★ 三层决策，顺序不能换：
     ① 原生能用 → 原生（最快，且不加载纯 JS 那份代码）
     ② 原生「不认识 Ed25519」→ 纯 JS（老 WebView 走这条）
     ③ 公钥长度不对等**配置问题** → 照旧抛（不能伪装成"验不过"）

     ⚠️ 别把 ③ 也吞掉往 ② 上靠 —— 公钥坏了走纯 JS 一样验不过，
        但报错会变成「签名不匹配」，把配置问题伪装成攻击，排查方向全反。 */
  let key: CryptoKey | null = null
  try {
    key = await importEd25519PublicKey(publicKeyRaw)
  } catch (e) {
    if (!isSubtleUnsupported(e)) throw e
    // 这台设备不支持 → 纯 JS
    return verifyEd25519Pure(publicKeyRaw, signature, catalogBytes)
  }
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

    /*
     * `assetBase` 也要过 https 白名单 —— 它是**目录里写的地址**，
     * 和包地址一样会变成「运行时去取的 URL」。只校验包地址、放过资源根，
     * 等于留了一个「用 http 加载贴图」的口子（混合内容在 Capacitor 里是硬失败）。
     */
    const rawAsset = g.assetBase
    let assetBase: string | undefined
    if (rawAsset !== undefined) {
      const s = requireString(g, 'assetBase', `${where}(${id})`)
      const abs = assertAllowedPackageUrl(s, base)
      // 统一补尾斜杠：拼资源时是 `assetBase + rel`，少一个斜杠就变成
      // `https://cdn/x.webp` → `https://cdn/x.webpassets/a.webp`，404 且报错像打包坏了。
      assetBase = abs.endsWith('/') ? abs : abs + '/'
    }

    return {
      id,
      name: requireString(g, 'name', `${where}(${id})`),
      version: requireString(g, 'version', `${where}(${id})`),
      url: assertAllowedPackageUrl(url, base),
      sha256: sha,
      ...(size === undefined ? {} : { size: size as number }),
      ...(assetBase === undefined ? {} : { assetBase }),
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
  /**
   * 下载进度回调（2026-11-13）。**只影响显示**：走完 100% 仍然要验 SHA-256，
   * 校验失败照样抛 —— 进度条不是"可信"的证明。
   */
  onProgress?: DownloadProgress,
): Promise<Bytes> {
  const res = await fetchImpl(url)
  if (!res.ok) throw new Error(`下载 ${url} 失败：HTTP ${res.status}`)
  // 边读边报进度（没有 `res.body` 时内部会退化成整段读，功能不受影响）
  const bytes = await readBodyWithProgress(res, onProgress)
  await assertSha256(bytes, expectedSha256, `包 ${url}`)
  return bytes
}
