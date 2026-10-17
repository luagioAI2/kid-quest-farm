import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Bytes } from './bytes'

/**
 * `installFromCatalog` 的 **store 接线** —— 校验链本身在 `install.test.ts` 里测。
 *
 * 这里只回答一件事：**链子跑完之后，store 有没有按对的规矩落盘**。
 * 具体是三条容易静默出错的：
 *   · 失败时**一个字节都不许写**（半个包留在 `gameKv` 里，症状是「装了个空的」）；
 *   · 目录说的 id 和包自己说的 id **对不上要拒**（否则已安装列表和实际跑的东西对不上）；
 *   · 下载来的包**不许占用内置游戏的 id**（那是劫持，不是重名）。
 * 外加一条最重要的：**公钥没配 ⇒ 装不了**（fail closed）。
 */

/* 用**假包**替掉真加载器（同 `pluginStorage.test.ts`）：真链路走
   `Blob → createObjectURL → import()`，在 jsdom 里跑不起来。 */
vi.mock('./loader', () => ({
  BundleLoadError: class extends Error {},
  validateBundle: () => {
    throw new Error('测试里不该走 validateBundle')
  },
  importBundle: async (code: string) => ({ manifest: JSON.parse(code), mount: () => () => {} }),
  mountBundle: () => () => {},
}))

/**
 * ★ 把「烧进 APK 的公钥」换成测试自己造的那把。
 *
 * 这是**测试专属的替身**：生产路径读的仍然是 `catalogKey.ts` 里的真常量
 * （它现在是空的 ⇒ 装不了，见最后一条用例）。不这么做的话，
 * 「验签成功」这条路根本走不到 —— 而那正是这里要测的。
 */
const keySlot = vi.hoisted(() => ({ raw: null as Uint8Array | null }))
vi.mock('./catalogKey', () => ({
  CATALOG_PUBLIC_KEY_B64: '',
  ED25519_PUBLIC_KEY_BYTES: 32,
  catalogPublicKeyRaw: () => {
    if (!keySlot.raw) {
      throw new Error('catalog 公钥还没配（src/games/catalogKey.ts 的 CATALOG_PUBLIC_KEY_B64 是空的）')
    }
    return keySlot.raw
  },
  parseCatalogPublicKey: () => {
    throw new Error('测试里不用这个')
  },
}))

const { db, getGameKv, BUNDLE_KEY } = await import('../db/db')
const { useApp } = await import('../store/useApp')
const { GAME_FARM } = await import('./ids')
const { sha256Hex } = await import('./verify')

const CATALOG_URL = 'https://cdn.example.com/games/catalog.json'
const SIG_URL = `${CATALOG_URL}.sig`
const PKG_URL = 'https://cdn.example.com/games/pkg.js'

/**
 * 假托管站被取过哪些地址。
 *
 * ★ 用来断言「某个请求**根本没发生**」—— 这类顺序错误只看「抛了哪个错」
 *   是分不出来的（先取包再验签，最后也会抛「签名不对」）。
 */
let fetched: string[] = []

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 一段合法的「假包」（`importBundle` 被替身成 `JSON.parse`） */
function fakeBundleCode(id: string, over: Record<string, unknown> = {}) {
  return JSON.stringify({
    id,
    name: `游戏 ${id}`,
    emoji: '🎲',
    tabLabel: id,
    version: '1.0.0',
    minHostApi: 1,
    coin: { id: 'c', name: '币', emoji: '🪙' },
    economy: { playCost: 5, expectedPayout: 3, capPerPrize: 9 },
    ...over,
  })
}

async function makeKeypair() {
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' } as AlgorithmIdentifier, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  keySlot.raw = raw
  return kp
}

const sign = async (kp: CryptoKeyPair, bytes: Bytes) =>
  new Uint8Array(
    await crypto.subtle.sign({ name: 'Ed25519' } as AlgorithmIdentifier, kp.privateKey, bytes),
  )

/**
 * 起一个「假的托管站」：目录 + 签名 + 包，并把全局 `fetch` 指过去。
 * 注意只实现 `arrayBuffer()` —— `install.ts` 走的就是它（`text()` 那条路
 * 会让字节变，见 `verify.ts` 文件头 ①）。
 */
async function stubHost(opts: {
  kp: CryptoKeyPair
  /** 目录里那一款的 id（可以和包里写的不同，用来造「对不上」） */
  catalogId: string
  /** 包里写的 id */
  codeId: string
  /** 签名用别的钥匙（造「签名不对」） */
  signWith?: CryptoKeyPair
  /** 目录里那一款的 sha256 覆盖（造「哈希不对」） */
  sha256?: string
  /**
   * 直接用这段原文当包，造「验签和哈希都过，但它**不是一个合法的包**」。
   * 哈希仍然按这段原文算 —— 所以这不是「被换过」，是「发布方发了个坏包」。
   */
  rawCode?: string
  /** 让某个地址返回 HTTP 错误（造「托管站挂了」）。键是**完整地址** */
  broken?: Record<string, number>
}) {
  const code = opts.rawCode ?? fakeBundleCode(opts.codeId)
  const bytes = new TextEncoder().encode(code)
  const catalogBytes = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      games: [
        {
          id: opts.catalogId,
          name: `目录 ${opts.catalogId}`,
          version: '1.0.0',
          url: PKG_URL,
          sha256: opts.sha256 ?? (await sha256Hex(bytes)),
        },
      ],
    }),
  )
  const sig = await sign(opts.signWith ?? opts.kp, catalogBytes)

  const files: Record<string, Uint8Array> = {
    [CATALOG_URL]: catalogBytes,
    [SIG_URL]: new TextEncoder().encode(btoa(String.fromCharCode(...sig))),
    [PKG_URL]: bytes,
  }
  vi.stubGlobal('fetch', async (input: string | URL) => {
    const key = String(input)
    fetched.push(key)
    const st = opts.broken?.[key]
    if (st) return { ok: false, status: st, arrayBuffer: async () => new ArrayBuffer(0) }
    const b = files[key]
    if (!b) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }
    const raw = b.slice()
    return {
      ok: true,
      status: 200,
      arrayBuffer: async () => raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
    }
  })
  return code
}

beforeEach(async () => {
  vi.unstubAllGlobals()
  keySlot.raw = null
  fetched = []
  await boot()
})

/* ------------------------------------------------------------------ */

describe('installFromCatalog —— 生产路径', () => {
  it('★ 验签 + 验哈希都过 → 落进 gameKv，并出现在 installedGames 里', async () => {
    const kp = await makeKeypair()
    const code = await stubHost({ kp, catalogId: 'demo', codeId: 'demo' })

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(true)
    expect(await getGameKv<string>('demo', BUNDLE_KEY)).toBe(code)
    // 名字用**目录**里的（已验签的显示来源），不是包自己说的
    expect(res.message).toContain('目录 demo')
    expect(useApp.getState().installedGames.demo).toBeTruthy()
  })

  it('★★ 签名不对 → 拒绝，且**一个字节都不写**', async () => {
    const kp = await makeKeypair()
    const other = (await crypto.subtle.generateKey({ name: 'Ed25519' } as AlgorithmIdentifier, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    await stubHost({ kp, catalogId: 'demo', codeId: 'demo', signWith: other })

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/签名/)
    expect(await getGameKv<string>('demo', BUNDLE_KEY)).toBeUndefined()
    expect(useApp.getState().installedGames.demo).toBeUndefined()
  })

  it('★ 包被换过（哈希不对）→ 拒绝，且**一个字节都不写**', async () => {
    const kp = await makeKeypair()
    await stubHost({ kp, catalogId: 'demo', codeId: 'demo', sha256: 'f'.repeat(64) })

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/SHA-256/)
    expect(await getGameKv<string>('demo', BUNDLE_KEY)).toBeUndefined()
  })

  it('★ 目录说的 id 和包自己说的 id 对不上 → 拒绝', async () => {
    // 发布方那边就不一致。装下去会让「已安装列表」和真正跑的东西对不上。
    const kp = await makeKeypair()
    await stubHost({ kp, catalogId: 'demo', codeId: 'other' })

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(false)
    expect(res.message).toContain('other')
    expect(await getGameKv<string>('other', BUNDLE_KEY)).toBeUndefined()
    expect(await getGameKv<string>('demo', BUNDLE_KEY)).toBeUndefined()
  })

  it('★★ 下载来的包用了**内置游戏的 id** → 拒绝（这是劫持，不是重名）', async () => {
    const kp = await makeKeypair()
    await stubHost({ kp, catalogId: GAME_FARM, codeId: GAME_FARM })

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, GAME_FARM)
    expect(res.ok).toBe(false)
    expect(res.message).toContain(GAME_FARM)
    expect(await getGameKv<string>(GAME_FARM, BUNDLE_KEY)).toBeUndefined()
    expect(useApp.getState().installedGames[GAME_FARM]).toBeUndefined()
  })

  it('★★ 公钥没配 → 装不了（fail closed），**不是静默放行**', async () => {
    // keySlot.raw 在 beforeEach 里被清空 = 模拟「catalogKey.ts 是空的」这个
    // 当前真实状态。这条用例钉住的是：**没配公钥时下载功能不可用**，
    // 而不是「没配公钥就跳过验签」。
    const kp = await makeKeypair()
    const code = await stubHost({ kp, catalogId: 'demo', codeId: 'demo' })
    keySlot.raw = null

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(false)
    expect(res.message).toContain('公钥')
    expect(await getGameKv<string>('demo', BUNDLE_KEY)).toBeUndefined()
    expect(code).toBeTruthy() // 包确实存在，只是不给装
  })

  it('★ 跨域被挡 → 报错里点名 CORS（不然只有一句 Failed to fetch）', async () => {
    await makeKeypair()
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch')
    })
    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(false)
    expect(res.message).toMatch(/跨域|CORS/)
  })

  it('目录里没有这一款 → 报错里列出目录现有的 id', async () => {
    const kp = await makeKeypair()
    await stubHost({ kp, catalogId: 'demo', codeId: 'demo' })
    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'claw')
    expect(res.ok).toBe(false)
    expect(res.message).toContain('claw')
    expect(res.message).toContain('demo')
  })

  it('★★ 验签和哈希都过了，但包本身不是合法的包 → 拒绝，且**一个字节都不写**', async () => {
    // 签名管的是「这串字节是发布方发的」，**不管**「它是不是一个能跑的包」。
    // 所以过了校验之后 `importBundle` 仍然可能抛（发布方发了个坏包 / 构建产物截断了）。
    // 那一刻不能已经写了一半 —— 半个包留在 `gameKv` 里的症状是「装了个空的」，
    // 而且它会被 `installedGames` 当成「已安装」，界面上看不出任何异常。
    const kp = await makeKeypair()
    await stubHost({ kp, catalogId: 'demo', codeId: 'demo', rawCode: '这不是 JSON' })

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(false)
    expect(await db.gameKv.count()).toBe(0)
    expect(useApp.getState().installedGames.demo).toBeUndefined()
  })

  it('★ 托管站挂了（目录 500）→ 报错里带状态码，而且**没去取包**', async () => {
    // ★ 判「顺序」不能只看抛了哪个错：先取包再验签，最后同样会抛。
    //   必须断言**副作用没发生** —— 这里就是「包的地址一次都没被请求」。
    const kp = await makeKeypair()
    await stubHost({ kp, catalogId: 'demo', codeId: 'demo', broken: { [CATALOG_URL]: 500 } })

    const res = await useApp.getState().installFromCatalog(CATALOG_URL, 'demo')
    expect(res.ok).toBe(false)
    expect(res.message).toContain('500')
    expect(await db.gameKv.count()).toBe(0)
    expect(fetched, '目录都没取到，就不该去取包').not.toContain(PKG_URL)
    expect(fetched).toEqual([CATALOG_URL])
  })
})
