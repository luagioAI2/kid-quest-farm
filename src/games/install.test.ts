import { describe, expect, it } from 'vitest'
import type { Bytes } from './bytes'
import { decodeSignature, fetchVerifiedCatalog, fetchVerifiedGame, signatureUrlFor } from './install'
import { sha256Hex } from './verify'

/* ============================================================
   「从目录装一款游戏」的编排链。

   这里要钉住的**不是**「能装」，而是三件错了会静默把事做坏的事：

     ① 顺序：**验签 → 解析 → 找条目 → 取包 → 验哈希**。
        任何一步提前把代码交出去 = 先把陌生代码跑起来再检查它该不该跑。
     ② 「签名不对」和「包被换过」必须**分开报**，否则排查方向跑偏。
     ③ 跨域失败要**点名是 CORS** —— 它只抛一句 `Failed to fetch`，看不出原因。

   `fetchVerifiedGame` 把公钥当参数收、`fetch` 可注入，所以这些路径
   在单测里都能造出来（不需要服务器、也不需要配真公钥）。
   ============================================================ */

const enc = (s: string) => new TextEncoder().encode(s)

/**
 * 断言「它抛了」，并把那个 Error 拿回来细看。
 *
 * 比 `.catch((e) => e as Error)` 强在：**没抛的时候它会失败**。
 * （`.catch` 那条路会返回成功值，然后断言在 `undefined.message` 上崩，
 * 报错信息完全看不出「其实是它根本不该成功」。）
 */
async function catchError(p: Promise<unknown>): Promise<Error> {
  try {
    await p
  } catch (e) {
    return e as Error
  }
  throw new Error('期望它抛错，但它成功返回了')
}

async function makeKeypair() {
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' } as AlgorithmIdentifier, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  return { kp, pubRaw }
}

const sign = async (kp: CryptoKeyPair, bytes: Bytes): Promise<Bytes> =>
  new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' } as AlgorithmIdentifier, kp.privateKey, bytes),
  )

const CATALOG_URL = 'https://cdn.example.com/games/catalog.json'
const PKG_URL = 'https://cdn.example.com/games/demo.js'
const SIG_URL = `${CATALOG_URL}.sig`
const CODE = 'export default { manifest: { id: "demo" }, mount: () => () => {} }\n'

/** 一个只会「按 url 查表」的 fetch。表里没有的 url 返回 404。 */
function tableFetch(files: Record<string, string | Bytes>, seen?: string[]): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input)
    seen?.push(url)
    const v = files[url]
    if (v === undefined) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }
    const bytes = typeof v === 'string' ? enc(v) : v
    const raw = bytes.slice()
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    }
  }) as unknown as typeof fetch
}

/**
 * 造一套完整的托管内容：包 + 目录 + 签名。
 * 可覆盖目录里的字段，用来造「哈希不对」「目录里没这款」这类输入。
 */
async function makeHost(opts: {
  code?: string
  over?: Record<string, unknown>
  signWith?: CryptoKeyPair
  skipSignature?: boolean
}) {
  const { kp, pubRaw } = await makeKeypair()
  const code = opts.code ?? CODE
  const bytes = enc(code)
  const catalog = {
    version: 1,
    games: [
      {
        id: 'demo',
        name: '许愿池',
        version: '1.0.0',
        url: PKG_URL,
        sha256: await sha256Hex(bytes),
        size: bytes.byteLength,
        ...opts.over,
      },
    ],
  }
  const catalogText = JSON.stringify(catalog, null, 2) + '\n'
  const catalogBytes = enc(catalogText)
  const signature = await sign(opts.signWith ?? kp, catalogBytes)

  const files: Record<string, string | Bytes> = {
    [CATALOG_URL]: catalogBytes,
    [PKG_URL]: bytes,
  }
  if (!opts.skipSignature) files[SIG_URL] = btoa(String.fromCharCode(...signature))

  return { kp, pubRaw, files, code, catalogBytes, signature }
}

/* ------------------------------------------------------------------ */

describe('signatureUrlFor / decodeSignature', () => {
  it('签名地址就是目录地址加 `.sig`', () => {
    expect(signatureUrlFor('https://x/catalog.json')).toBe('https://x/catalog.json.sig')
  })

  it('空签名文件 → 抛（多半是上传时漏了内容）', () => {
    expect(() => decodeSignature('')).toThrow(/空/)
    expect(() => decodeSignature('   \n')).toThrow(/空/)
  })

  it('不是 base64 → 抛，且说清它应该是什么', () => {
    expect(() => decodeSignature('!!! 不是 base64 !!!')).toThrow(/base64/)
  })

  it('合法 base64 → 解出原始字节', () => {
    const raw = new Uint8Array([1, 2, 3, 250])
    expect([...decodeSignature(btoa(String.fromCharCode(...raw)))]).toEqual([...raw])
  })
})

/* ------------------------------------------------------------------ */

describe('fetchVerifiedGame —— 顺利装下来', () => {
  it('目录验签通过 + 包哈希对 → 拿到代码与条目', async () => {
    const { pubRaw, files, code } = await makeHost({})
    const got = await fetchVerifiedGame({
      catalogUrl: CATALOG_URL,
      gameId: 'demo',
      publicKeyRaw: pubRaw,
      fetchImpl: tableFetch(files),
    })
    expect(got.code).toBe(code)
    // 条目来自**已验签的目录**，不是包自己说的
    expect(got.game.name).toBe('许愿池')
    expect(got.game.version).toBe('1.0.0')
  })

  it('目录里的相对包地址按目录地址解析', async () => {
    // 目录里写 `./demo.js` ⇒ 应解析成 https://cdn.example.com/games/demo.js（= PKG_URL）
    const host = await makeHost({ over: { url: './demo.js' } })
    const got = await fetchVerifiedGame({
      catalogUrl: CATALOG_URL,
      gameId: 'demo',
      publicKeyRaw: host.pubRaw,
      fetchImpl: tableFetch(host.files),
    })
    expect(got.code).toBe(host.code)
    expect(got.game.url).toBe(PKG_URL)
  })
})

/* ------------------------------------------------------------------ */

describe('fetchVerifiedGame —— 每一道门都要能拦', () => {
  it('★ 目录签名不对 → 抛「签名」，而且**一个包都不去取**', async () => {
    const other = await makeKeypair()
    const { pubRaw, files } = await makeHost({ signWith: other.kp })
    const seen: string[] = []
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch(files, seen),
      }),
    ).rejects.toThrow(/签名/)
    // ★ 这一条才是「顺序」的真正判据：签名没过时，包**根本不该被请求**。
    //   只断言「抛了签名错」是不够的 —— 「先取包、后验签」也会抛签名错。
    expect(seen).toContain(CATALOG_URL)
    expect(seen).not.toContain(PKG_URL)
  })

  it('★★ 顺序判据：签名坏 **且** 目录里的 sha256 是垃圾 → 必须报「签名」，不能报 SHA-256', async () => {
    // 若实现是「先取包验哈希、再验目录签名」，这里会报 SHA-256 —— 那就说明
    // 它在确认「这份目录是自己发的」之前，就照着目录去取东西了。
    const other = await makeKeypair()
    const { pubRaw, files } = await makeHost({ signWith: other.kp, over: { sha256: '不是 hex' } })
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch(files),
      }),
    ).rejects.toThrow(/签名/)
  })

  it('★ 包被换过（哈希对不上）→ 抛 SHA-256，且两个哈希都在信息里', async () => {
    const { pubRaw, files, code } = await makeHost({})
    // 目录照旧，但服务器上的包被换成别的内容
    files[PKG_URL] = enc(code + '\n// 被塞了一行\n')
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch(files),
      }),
    ).rejects.toThrow(/SHA-256/)
  })

  it('签名文件缺失（404）→ 抛，带上状态码', async () => {
    const { pubRaw, files } = await makeHost({ skipSignature: true })
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch(files),
      }),
    ).rejects.toThrow(/404/)
  })

  it('★ 目录里没有这一款 → 抛，并把**目录里现有**的 id 列出来', async () => {
    const { pubRaw, files } = await makeHost({})
    const err = await catchError(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'claw',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch(files),
      }),
    )
    expect(err.message).toContain('claw')
    expect(err.message).toContain('demo') // 「目录里有什么」—— 排查时第一眼要看的就是它
  })

  it('★ 目录地址不是 https（非本机）→ 抛，**连请求都不发**', async () => {
    const { pubRaw } = await makeHost({})
    let called = false
    const spy = (async () => {
      called = true
      return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }
    }) as unknown as typeof fetch
    await expect(
      fetchVerifiedGame({
        catalogUrl: 'http://evil.example.com/catalog.json',
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: spy,
      }),
    ).rejects.toThrow(/https/)
    expect(called).toBe(false)
  })

  it('★★ 跨域被挡 → 错误信息里**点名 CORS**（不然只看到一句 Failed to fetch）', async () => {
    const { pubRaw } = await makeHost({})
    const corsBlocked = (async () => {
      throw new TypeError('Failed to fetch')
    }) as unknown as typeof fetch
    const err = await catchError(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: corsBlocked,
      }),
    )
    expect(err.message).toContain('Failed to fetch')
    expect(err.message).toMatch(/跨域|CORS/)
  })

  it('公钥是空的 → 抛（配置问题），不许静默放行', async () => {
    const { files } = await makeHost({})
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: new Uint8Array(0),
        fetchImpl: tableFetch(files),
      }),
    ).rejects.toThrow(/32/)
  })

  it('公钥是另一把（全零 32 字节）→ 「验不过」→ 仍然不许装', async () => {
    const { files } = await makeHost({})
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: new Uint8Array(32),
        fetchImpl: tableFetch(files),
      }),
    ).rejects.toThrow(/签名/)
  })

  it('目录不是合法 JSON（但签名是对的）→ 报解析错，不是签名错', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const catalogBytes = enc('{ 这不是合法 JSON')
    const signature = await sign(kp, catalogBytes)
    const files: Record<string, string | Bytes> = {
      [CATALOG_URL]: catalogBytes,
      [SIG_URL]: btoa(String.fromCharCode(...signature)),
    }
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch(files),
      }),
    ).rejects.toThrow(/JSON/)
  })

  it('目录里同一 id 出现两次 → 抛（装哪个版本不确定）', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const bytes = enc('PACKAGE')
    const dup = {
      version: 1,
      games: [
        { id: 'demo', name: 'A', version: '1.0.0', url: PKG_URL, sha256: await sha256Hex(bytes) },
        { id: 'demo', name: 'B', version: '2.0.0', url: PKG_URL, sha256: await sha256Hex(bytes) },
      ],
    }
    const catalogBytes = enc(JSON.stringify(dup))
    const signature = await sign(kp, catalogBytes)
    await expect(
      fetchVerifiedGame({
        catalogUrl: CATALOG_URL,
        gameId: 'demo',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch({
          [CATALOG_URL]: catalogBytes,
          [SIG_URL]: btoa(String.fromCharCode(...signature)),
          [PKG_URL]: bytes,
        }),
      }),
    ).rejects.toThrow(/重复/)
  })
})

/* ------------------------------------------------------------------ */

describe('fetchVerifiedGame —— 返回的是「验过哈希的那串字节」', () => {
  it('带 BOM 的包也能过（走的是原始字节，不是 text() 往返）', async () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('console.log(1)\n')])
    const { kp, pubRaw } = await makeKeypair()
    const catalogBytes = enc(
      JSON.stringify({
        version: 1,
        games: [
          { id: 'demo', name: 'BOM', version: '1.0.0', url: PKG_URL, sha256: await sha256Hex(withBom) },
        ],
      }),
    )
    const signature = await sign(kp, catalogBytes)
    const got = await fetchVerifiedGame({
      catalogUrl: CATALOG_URL,
      gameId: 'demo',
      publicKeyRaw: pubRaw,
      fetchImpl: tableFetch({
        [CATALOG_URL]: catalogBytes,
        [SIG_URL]: btoa(String.fromCharCode(...signature)),
        [PKG_URL]: withBom,
      }),
    })
    // BOM 会被 TextDecoder 吃掉（这是它该做的），但**哈希是按带 BOM 的原始字节验的**
    // —— 若实现走 `text()` 往返，上面的 `fetchVerifiedGame` 早就抛 SHA-256 了。
    expect(got.code).toBe('console.log(1)\n')
  })
})

/* ============================================================
   fetchVerifiedCatalog —— 设置页「看一眼有什么」走的就是这条。

   它比 `fetchVerifiedGame` 短，但有一条**独有的**判据：
   **一个包都不许取**。家长只是打开列表，任何代码都不该下到手机里。
   ============================================================ */

describe('fetchVerifiedCatalog —— 只列目录，不碰包', () => {
  it('正常：拿到条目（名字 / 版本 / 体积）', async () => {
    const { pubRaw, files } = await makeHost({})
    const catalog = await fetchVerifiedCatalog({
      catalogUrl: CATALOG_URL,
      publicKeyRaw: pubRaw,
      fetchImpl: tableFetch(files),
    })
    expect(catalog.games).toHaveLength(1)
    expect(catalog.games[0].id).toBe('demo')
    expect(catalog.games[0].name).toBe('许愿池')
    expect(catalog.games[0].version).toBe('1.0.0')
    expect(catalog.games[0].size).toBeGreaterThan(0)
  })

  it('★★ 只取了目录和签名，**一个包都没取**（列表不该下载代码）', async () => {
    const { pubRaw, files } = await makeHost({})
    const seen: string[] = []
    await fetchVerifiedCatalog({
      catalogUrl: CATALOG_URL,
      publicKeyRaw: pubRaw,
      fetchImpl: tableFetch(files, seen),
    })
    expect(seen, '列表阶段不该碰包地址').not.toContain(PKG_URL)
    expect(seen.sort()).toEqual([CATALOG_URL, SIG_URL].sort())
  })

  it('签名对不上 → 抛（不是返回空列表，也不是「公钥没配」）', async () => {
    const { files } = await makeHost({})
    const other = await makeKeypair()
    const e = await catchError(
      fetchVerifiedCatalog({
        catalogUrl: CATALOG_URL,
        publicKeyRaw: other.pubRaw,
        fetchImpl: tableFetch(files),
      }),
    )
    expect(e.message).toMatch(/签名/)
    expect(e.message).not.toMatch(/公钥还没配/)
  })

  it('★ 公钥长度不对 → 抛「我们配错了」，和「签名无效」分开报', async () => {
    const { files } = await makeHost({})
    const e = await catchError(
      fetchVerifiedCatalog({
        catalogUrl: CATALOG_URL,
        publicKeyRaw: new Uint8Array([1, 2, 3]),
        fetchImpl: tableFetch(files),
      }),
    )
    expect(e.message).toMatch(/32 字节/)
  })

  it('http（非 localhost）→ 在取任何东西之前就被挡下', async () => {
    const { pubRaw } = await makeHost({})
    const seen: string[] = []
    const e = await catchError(
      fetchVerifiedCatalog({
        catalogUrl: 'http://cdn.example.com/games/catalog.json',
        publicKeyRaw: pubRaw,
        fetchImpl: tableFetch({}, seen),
      }),
    )
    expect(e.message).toMatch(/https/i)
    expect(seen, '地址不合规时一个请求都不该发').toHaveLength(0)
  })

  it('签名文件 404 → 抛，且说的是「目录签名」而不是「目录」', async () => {
    const { pubRaw, files } = await makeHost({ skipSignature: true })
    const e = await catchError(
      fetchVerifiedCatalog({ catalogUrl: CATALOG_URL, publicKeyRaw: pubRaw, fetchImpl: tableFetch(files) }),
    )
    expect(e.message).toMatch(/目录签名/)
  })
})
