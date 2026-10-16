import { describe, expect, it } from 'vitest'
import type { Bytes } from './bytes'
import {
  CATALOG_PUBLIC_KEY_B64,
  catalogPublicKeyRaw,
  parseCatalogPublicKey,
} from './catalogKey'
import {
  assertAllowedPackageUrl,
  assertSha256,
  fetchVerifiedPackage,
  importEd25519PublicKey,
  loadVerifiedCatalog,
  parseCatalog,
  sha256Hex,
  verifyCatalogSignature,
  verifyEd25519,
  verifySha256,
  type Catalog,
} from './verify'

/* ============================================================
   P2 的校验核心（spec §12.4「安全：不可让步的一条」）

   这个文件要钉住的**不是**「函数能跑」，而是四件「错了会静默把事做坏」的事：

     ① 哈希必须吃**取回来的原始字节**，不是 `JSON.parse` 再序列化的结果；
     ② 「验不过」返回 false，「我们配错了」必须抛 —— 两者不能混；
     ③ 验签必须发生在解析**之前**（catalog 在验签前是不可信数据）；
     ④ **没有「跳过校验」这条分支** —— 公钥没配就抛，绝不静默放行。

   ④ 是这里最重要的一条：一个「没配公钥就跳过」的分支，等于把
   「谁拿下那台静态服务器，谁就能在孩子的手机里跑任意代码」变成**默认行为**。
   所以下面专门用「空公钥 / 全零公钥」去撞它。

   环境：jsdom + Node 22 自带 `crypto.subtle`，**原生支持 Ed25519**（实测见
   `src/games/verify.ts` 文件头），所以这里真的能签、能验，不需要任何 mock 或补丁。
   ============================================================ */

const enc = (s: string) => new TextEncoder().encode(s)
const dec = (b: Uint8Array) => new TextDecoder().decode(b)

/** 已知答案：SHA-256("abc")。来源：FIPS 180-4 / NIST 示例向量。 */
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

async function makeKeypair() {
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' } as AlgorithmIdentifier, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  return { kp, pubRaw }
}

async function signWith(kp: CryptoKeyPair, bytes: Bytes): Promise<Bytes> {
  return new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' } as AlgorithmIdentifier, kp.privateKey, bytes),
  )
}

/** 一个形状正确的 catalog（JSON 字节 + 已解析对象两种形态都要用） */
function goodCatalogObj(over: Partial<Catalog> = {}): Catalog {
  return {
    version: 1,
    games: [
      {
        id: 'wishing-well',
        name: '许愿池',
        version: '1.0.0',
        url: 'https://cdn.example.com/games/wishing-well.js',
        sha256: 'a'.repeat(64),
      },
    ],
    ...over,
  }
}

/** 造一个只实现 `fetch` 里我们用到的部分的对象。`arrayBuffer` 给**原始字节**。 */
function fakeFetch(
  bytes: Uint8Array,
  init: { ok?: boolean; status?: number; text?: string } = {},
): typeof fetch {
  const raw = bytes.slice()
  return (async () => ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    // ⚠️ 故意实现成「按文本解码」的样子（`TextDecoder` 默认会**吃掉 BOM**）。
    // 下面有一条测试专门用它证明实现走的是 arrayBuffer 而不是 text：
    // 若实现改成 text() + encode() 往返，BOM 会丢、哈希就对不上、那条测试会红。
    text: async () => init.text ?? dec(raw),
  })) as unknown as typeof fetch
}

/* ------------------------------------------------------------------ */

describe('sha256Hex / verifySha256', () => {
  it('对得上已知答案（不是「跑通就算」）', async () => {
    expect(await sha256Hex(enc('abc'))).toBe(SHA256_ABC)
  })

  it('空输入也有确定的值（不是空串）', async () => {
    expect(await sha256Hex(new Uint8Array(0))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
  })

  it('匹配 → true；差一个字节 → false', async () => {
    const data = enc('hello')
    const hex = await sha256Hex(data)
    expect(await verifySha256(data, hex)).toBe(true)
    expect(await verifySha256(enc('hellp'), hex)).toBe(false)
  })

  it('期望值大小写不敏感（哈希本身没有大小写之分）', async () => {
    const data = enc('abc')
    expect(await verifySha256(data, SHA256_ABC.toUpperCase())).toBe(true)
    expect(await verifySha256(data, `  ${SHA256_ABC}  `)).toBe(true)
  })

  it('★ 期望值本身不合法 → 返回 false，**不是抛**', async () => {
    // 理由：`sha256` 字段来自**还没验签的 catalog** = 攻击者可控制的输入。
    // 这种输入必须走「校验不通过」，不能把我们的解析器崩掉。
    const data = enc('abc')
    const bad = [
      '',
      '   ',
      SHA256_ABC.slice(0, 63), // 短一位
      `${SHA256_ABC}0`, // 长一位
      'z'.repeat(64), // 字符集不对
      'abc', // 根本不是 hex
    ]
    for (const b of bad) {
      expect(await verifySha256(data, b), `期望值「${b}」应判不通过`).toBe(false)
    }
  })

  it('assertSha256 失败时**把两个哈希都打出来**（排查第一眼要看的就是它们）', async () => {
    const data = enc('abc')
    const wrong = 'f'.repeat(64)
    await expect(assertSha256(data, wrong, '包 x')).rejects.toThrow(SHA256_ABC)
    await expect(assertSha256(data, wrong, '包 x')).rejects.toThrow(wrong)
    // 带上标签，否则一堆包分不清是哪个
    await expect(assertSha256(data, wrong, '包 x')).rejects.toThrow('包 x')
  })

  it('assertSha256 通过时不抛', async () => {
    await expect(assertSha256(enc('abc'), SHA256_ABC, '包 x')).resolves.toBeUndefined()
  })
})

/* ------------------------------------------------------------------ */

describe('Ed25519 —— 签、验、篡改', () => {
  it('签出来的能被验过', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const msg = enc('{"version":1,"games":[]}')
    const sig = await signWith(kp, msg)
    const key = await importEd25519PublicKey(pubRaw)
    expect(await verifyEd25519(key, sig, msg)).toBe(true)
  })

  it('改一个字节的消息 → 验不过', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const sig = await signWith(kp, enc('原样'))
    const key = await importEd25519PublicKey(pubRaw)
    expect(await verifyEd25519(key, sig, enc('改过'))).toBe(false)
  })

  it('改一个字节的签名 → 验不过', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const msg = enc('内容')
    const sig = await signWith(kp, msg)
    sig[0] ^= 0xff
    const key = await importEd25519PublicKey(pubRaw)
    expect(await verifyEd25519(key, sig, msg)).toBe(false)
  })

  it('拿另一把钥匙的公钥 → 验不过（换钥匙不能蒙过去）', async () => {
    const a = await makeKeypair()
    const b = await makeKeypair()
    const msg = enc('内容')
    const sig = await signWith(a.kp, msg)
    const keyB = await importEd25519PublicKey(b.pubRaw)
    expect(await verifyEd25519(keyB, sig, msg)).toBe(false)
  })

  it('签名长度乱写 → false，不是抛（反正都不许装）', async () => {
    const { pubRaw } = await makeKeypair()
    const key = await importEd25519PublicKey(pubRaw)
    expect(await verifyEd25519(key, enc('太短'), enc('内容'))).toBe(false)
  })

  it('公钥长度不是 32 → 抛（这是**我们配错了**，不是包坏了）', async () => {
    await expect(importEd25519PublicKey(new Uint8Array(31))).rejects.toThrow('32')
    await expect(importEd25519PublicKey(new Uint8Array(64))).rejects.toThrow('32')
  })
})

/* ------------------------------------------------------------------ */

describe('catalogKey —— 公钥的解析与 fail closed', () => {
  it('空 / 全空白 → 抛，且提示怎么生成', () => {
    expect(() => parseCatalogPublicKey('')).toThrow(/公钥/)
    expect(() => parseCatalogPublicKey('   \n ')).toThrow(/公钥/)
    expect(() => parseCatalogPublicKey('')).toThrow(/keygen/)
  })

  it('合法 base64 但长度不对 → 抛，并把实际字节数报出来', () => {
    // 16 字节
    const sixteen = 'A'.repeat(22) + '=='
    expect(() => parseCatalogPublicKey(sixteen)).toThrow(/16 字节/)
    // 64 字节（有人把私钥粘进来了）
    const sixtyFour = btoa(String.fromCharCode(...new Uint8Array(64)))
    expect(() => parseCatalogPublicKey(sixtyFour)).toThrow(/64 字节/)
  })

  it('不是合法 base64 → 抛', () => {
    expect(() => parseCatalogPublicKey('!!!这不是 base64!!!')).toThrow(/base64/)
  })

  it('32 字节的公钥 → 原样解出来', async () => {
    const { pubRaw } = await makeKeypair()
    const b64 = btoa(String.fromCharCode(...pubRaw))
    expect([...parseCatalogPublicKey(b64)]).toEqual([...pubRaw])
  })

  it('★★ 现在（还没配公钥）必须抛 —— 不许返回全零，也不许有「跳过」的余地', () => {
    // 这条断言在**配了真公钥之后自动转义**成「配了就必须是 32 字节」，
    // 所以它不需要人来改；但它永远不允许「没配就静默放行」。
    if (CATALOG_PUBLIC_KEY_B64.trim()) {
      expect(catalogPublicKeyRaw().byteLength).toBe(32)
      return
    }
    expect(() => catalogPublicKeyRaw()).toThrow(/公钥/)
  })
})

/* ------------------------------------------------------------------ */

describe('assertAllowedPackageUrl —— 只走 https', () => {
  it('https 放行', () => {
    expect(assertAllowedPackageUrl('https://cdn.example.com/a.js', null)).toBe(
      'https://cdn.example.com/a.js',
    )
  })

  it('★ http 的非本机地址 → 抛（降级就是漏洞）', () => {
    expect(() => assertAllowedPackageUrl('http://cdn.example.com/a.js', null)).toThrow(/https/)
  })

  it('http 的 localhost / 127.0.0.1 放行（本地走查要用）', () => {
    expect(assertAllowedPackageUrl('http://localhost:4390/a.js', null)).toContain('localhost')
    expect(assertAllowedPackageUrl('http://127.0.0.1:4390/a.js', null)).toContain('127.0.0.1')
  })

  it('相对路径按 catalog 的地址解析成绝对地址', () => {
    expect(assertAllowedPackageUrl('./demo.js', 'https://cdn.example.com/games/catalog.json')).toBe(
      'https://cdn.example.com/games/demo.js',
    )
  })

  it('相对路径 + 没有 base → 抛（不猜）', () => {
    expect(() => assertAllowedPackageUrl('./demo.js', null)).toThrow()
  })

  it('别的协议（file: / data:）→ 抛', () => {
    expect(() => assertAllowedPackageUrl('file:///etc/passwd', null)).toThrow()
    expect(() => assertAllowedPackageUrl('data:text/javascript,alert(1)', null)).toThrow()
  })
})

/* ------------------------------------------------------------------ */

describe('parseCatalog —— 形状校验 fail closed', () => {
  const ok = () => enc(JSON.stringify(goodCatalogObj()))

  it('形状正确就解析出来', () => {
    const c = parseCatalog(ok())
    expect(c.version).toBe(1)
    expect(c.games).toHaveLength(1)
    expect(c.games[0].id).toBe('wishing-well')
  })

  it('不是 JSON → 抛', () => {
    expect(() => parseCatalog(enc('这不是 JSON'))).toThrow(/JSON/)
  })

  it('顶层不是对象（数组 / 字符串 / null）→ 抛', () => {
    expect(() => parseCatalog(enc('[]'))).toThrow(/对象/)
    expect(() => parseCatalog(enc('"hi"'))).toThrow(/对象/)
    expect(() => parseCatalog(enc('null'))).toThrow(/对象/)
  })

  it('version 不是数字 → 抛', () => {
    expect(() => parseCatalog(enc(JSON.stringify({ ...goodCatalogObj(), version: '1' })))).toThrow(
      /version/,
    )
  })

  it('games 不是数组 → 抛', () => {
    expect(() => parseCatalog(enc(JSON.stringify({ version: 1, games: {} })))).toThrow(/games/)
  })

  it('★ 同一个 id 出现两次 → 抛（不然「装哪个版本」就不确定了）', () => {
    const dup = goodCatalogObj()
    dup.games = [dup.games[0], { ...dup.games[0], version: '2.0.0' }]
    expect(() => parseCatalog(enc(JSON.stringify(dup)))).toThrow(/重复/)
  })

  it('sha256 不是 64 位 hex → 抛，并把实际值报出来', () => {
    const bad = goodCatalogObj()
    bad.games[0].sha256 = 'abc'
    expect(() => parseCatalog(enc(JSON.stringify(bad)))).toThrow(/sha256/)
    expect(() => parseCatalog(enc(JSON.stringify(bad)))).toThrow('abc')
  })

  it('sha256 是大写 → 收下并归一化成小写', () => {
    const up = goodCatalogObj()
    up.games[0].sha256 = 'A'.repeat(64)
    expect(parseCatalog(enc(JSON.stringify(up))).games[0].sha256).toBe('a'.repeat(64))
  })

  it('缺 name / version / url → 抛，并指出是哪个字段', () => {
    for (const field of ['name', 'version', 'url'] as const) {
      const bad = goodCatalogObj()
      delete (bad.games[0] as unknown as Record<string, unknown>)[field]
      expect(() => parseCatalog(enc(JSON.stringify(bad))), `缺 ${field} 应抛`).toThrow(
        new RegExp(field),
      )
    }
  })

  it('空字符串的 id → 抛（全空白也算缺）', () => {
    const bad = goodCatalogObj()
    bad.games[0].id = '   '
    expect(() => parseCatalog(enc(JSON.stringify(bad)))).toThrow(/id/)
  })

  it('size 是负数 / 非数字 → 抛；不写 → 允许（它是提示，不是校验依据）', () => {
    const neg = goodCatalogObj()
    neg.games[0].size = -1
    expect(() => parseCatalog(enc(JSON.stringify(neg)))).toThrow(/size/)

    const nan = goodCatalogObj()
    nan.games[0].size = Number.NaN
    expect(() => parseCatalog(enc(JSON.stringify(nan)))).toThrow(/size/)

    expect(parseCatalog(ok()).games[0].size).toBeUndefined()

    const okSize = goodCatalogObj()
    okSize.games[0].size = 1234
    expect(parseCatalog(enc(JSON.stringify(okSize))).games[0].size).toBe(1234)
  })

  it('★ 包地址是 http（非本机）→ 抛，且**不把整份 catalog 放行**', () => {
    const bad = goodCatalogObj()
    bad.games[0].url = 'http://evil.example.com/a.js'
    expect(() => parseCatalog(enc(JSON.stringify(bad)))).toThrow(/https/)
  })

  it('相对 url + 有 base → 解析成绝对地址', () => {
    const rel = goodCatalogObj()
    rel.games[0].url = './wishing-well.js'
    const c = parseCatalog(enc(JSON.stringify(rel)), 'https://cdn.example.com/games/catalog.json')
    expect(c.games[0].url).toBe('https://cdn.example.com/games/wishing-well.js')
  })

  it('游戏条目不是对象 → 抛，且指出是第几条', () => {
    expect(() => parseCatalog(enc(JSON.stringify({ version: 1, games: ['x'] })))).toThrow(
      /games\[0\]/,
    )
  })
})

/* ------------------------------------------------------------------ */

describe('loadVerifiedCatalog —— 验签在解析之前', () => {
  it('签名对 → 正常返回解析结果', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const bytes = enc(JSON.stringify(goodCatalogObj()))
    const sig = await signWith(kp, bytes)
    const c = await loadVerifiedCatalog(bytes, sig, pubRaw)
    expect(c.games[0].id).toBe('wishing-well')
  })

  it('★ 签名对不上 → 抛，且**一个游戏都不返回**', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const bytes = enc(JSON.stringify(goodCatalogObj()))
    const sig = await signWith(kp, enc('别的东西'))
    await expect(loadVerifiedCatalog(bytes, sig, pubRaw)).rejects.toThrow(/签名/)
  })

  it('★★ 顺序判据：catalog 是**坏 JSON** + 签名也坏 → 必须报「签名」，不能报 JSON', async () => {
    // 如果实现是「先 parse 再 verify」，这里会报 JSON 错 —— 那就说明
    // 解析器吃了**未验签**的输入（catalog 天生不可信）。这条测试就是那个顺序的钉子。
    const { kp, pubRaw } = await makeKeypair()
    const bytes = enc('{ 这不是合法 JSON')
    const sig = await signWith(kp, enc('别的东西'))
    await expect(loadVerifiedCatalog(bytes, sig, pubRaw)).rejects.toThrow(/签名/)
  })

  it('★★ 顺序判据（另一种坏法）：内容合法 JSON 但 sha256 是垃圾 + 签名坏 → 也报「签名」', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const bad = goodCatalogObj()
    bad.games[0].sha256 = '不是 hex'
    const bytes = enc(JSON.stringify(bad))
    const sig = await signWith(kp, enc('别的东西'))
    await expect(loadVerifiedCatalog(bytes, sig, pubRaw)).rejects.toThrow(/签名/)
  })

  it('★★ 公钥是空的 → 抛（配置问题），**绝不静默放行**', async () => {
    const bytes = enc(JSON.stringify(goodCatalogObj()))
    await expect(loadVerifiedCatalog(bytes, new Uint8Array(64), new Uint8Array(0))).rejects.toThrow(
      /32/,
    )
  })

  it('★★ 公钥全零（32 字节）→ 不是抛，是「验不过」→ 仍然不许用', async () => {
    const { kp } = await makeKeypair()
    const bytes = enc(JSON.stringify(goodCatalogObj()))
    const sig = await signWith(kp, bytes)
    const zeros = new Uint8Array(32) // 长度合法，但根本不是那把钥匙
    await expect(loadVerifiedCatalog(bytes, sig, zeros)).rejects.toThrow(/签名/)
  })

  it('签名是对的、但 catalog 形状坏 → 这时候才该报形状错', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const bytes = enc(JSON.stringify({ version: 1, games: '不是数组' }))
    const sig = await signWith(kp, bytes) // 诚实签名，内容本身不合法
    await expect(loadVerifiedCatalog(bytes, sig, pubRaw)).rejects.toThrow(/games/)
  })

  it('verifyCatalogSignature 本身：对的 true、错的 false', async () => {
    const { kp, pubRaw } = await makeKeypair()
    const bytes = enc('内容')
    const sig = await signWith(kp, bytes)
    expect(await verifyCatalogSignature(bytes, sig, pubRaw)).toBe(true)
    expect(await verifyCatalogSignature(enc('别的'), sig, pubRaw)).toBe(false)
  })
})

/* ------------------------------------------------------------------ */

describe('fetchVerifiedPackage —— 校验的是原始字节', () => {
  it('哈希对 → 返回原始字节', async () => {
    const payload = enc('export default { mount(){} }')
    const hex = await sha256Hex(payload)
    const got = await fetchVerifiedPackage('https://cdn.example.com/a.js', hex, fakeFetch(payload))
    expect(dec(got)).toBe('export default { mount(){} }')
  })

  it('★★ 带 BOM 的包：按原始字节哈希能过 —— 证明实现没走 `text()` 往返', async () => {
    // `TextDecoder` 默认会吃掉 UTF-8 BOM，所以「text() → encode()」会让字节变少，
    // 哈希就对不上。这个包能过，就说明实现吃的是 arrayBuffer()。
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, ...enc('console.log(1)')])
    const hex = await sha256Hex(withBom)
    const got = await fetchVerifiedPackage('https://cdn.example.com/bom.js', hex, fakeFetch(withBom))
    expect(got[0]).toBe(0xef)
    expect(got.byteLength).toBe(withBom.byteLength)
  })

  it('★ 哈希对不上 → 抛，且把期望值和实际值都打出来', async () => {
    const payload = enc('真正的包')
    const wrong = 'f'.repeat(64)
    await expect(
      fetchVerifiedPackage('https://cdn.example.com/a.js', wrong, fakeFetch(payload)),
    ).rejects.toThrow(/SHA-256/)
    await expect(
      fetchVerifiedPackage('https://cdn.example.com/a.js', wrong, fakeFetch(payload)),
    ).rejects.toThrow(await sha256Hex(payload))
  })

  it('HTTP 非 2xx → 抛，带上状态码（不然只看到「装不上」）', async () => {
    await expect(
      fetchVerifiedPackage('https://cdn.example.com/a.js', 'a'.repeat(64), fakeFetch(enc(''), {
        ok: false,
        status: 404,
      })),
    ).rejects.toThrow(/404/)
  })

  it('包地址写的是 http 也没用 —— 这里只认 URL 传来的那个，网络层不兜底', async () => {
    // 这条只是说明职责边界：`fetchVerifiedPackage` 不做 URL 协议校验，
    // 协议校验在 `assertAllowedPackageUrl`（`parseCatalog` 里调）。别以为它兜了。
    // ⚠️ 断言用**内容**不用 `toBeInstanceOf(Uint8Array)` —— 那个判据对 realm 敏感
    // （jsdom 的 `TextEncoder` 返回的不是 jsdom realm 的 `Uint8Array`），
    // 会在改实现时假红。契约是「拿到那些字节」，不是「拿到哪个 realm 的构造器」。
    const payload = enc('x')
    const hex = await sha256Hex(payload)
    const got = await fetchVerifiedPackage('http://evil.example.com/a.js', hex, fakeFetch(payload))
    expect([...got]).toEqual([...payload])
  })
})
