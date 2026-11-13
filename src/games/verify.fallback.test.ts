/* ============================================================
   Ed25519 验签的**纯 JS 兜底**（2026-11-13）
   ------------------------------------------------------------
   用户报「APP 设置 → 游戏无法下载，提示 ed 密钥没法导入」。
   根因：`Ed25519` 是 Chrome 113 才进 WebCrypto 的，老安卓 WebView 没有
   ⇒ `importKey('Ed25519')` 抛 ⇒ 装不了。

   这里要钉住三件事，缺一件这个修复就是假的：

     ① 原生不可用时，纯 JS **真的能验过**（能装）；
     ② 纯 JS 兜底**不是"跳过验签"** —— 被篡改的内容照样验不过；
     ③ 公钥本身坏（长度不对）**不能**被兜底吞掉 —— 那是配置问题，
        吞了会伪装成"签名不匹配"，把排查方向带偏。

   ★ 第 ② 条是这次最容易做错的地方：为了兼容性把闸门拆掉，
     看上去"能下载了"，实际把「谁拿下静态服务器谁就能在孩子手机里跑代码」打开了。
   ============================================================ */

import { describe, expect, it, vi } from 'vitest'
import type { Bytes } from './bytes'
import { verifyCatalogSignature } from './verify'

/* ★ TS 5.7 起裸 `Uint8Array` 是 `Uint8Array<ArrayBufferLike>`，而 `Bytes`
   要求底层是普通 `ArrayBuffer`。`exportKey` / `sign` 返回的正是后者，
   但类型收窄不到 —— 拷一次既满足类型，也保证真的是独立的一块内存。 */
const asBytes = (u: Uint8Array): Bytes => new Uint8Array(u) as Bytes

/* 造一对**真**钥匙 + 真签名（WebCrypto 生成，不是伪造的）。
   注意：签名用原生、验签走纯 JS 时，两边是**两套独立实现** ✅
   （这才有意义 —— 自己验自己等于没验）。 */
async function makeKeypair() {
  const kp = (await crypto.subtle.generateKey({ name: 'Ed25519' } as AlgorithmIdentifier, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const pubRaw = asBytes(new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey)))
  const signMsg = async (msg: Uint8Array): Promise<Bytes> =>
    asBytes(
      new Uint8Array(
        await crypto.subtle.sign({ name: 'Ed25519' } as AlgorithmIdentifier, kp.privateKey, msg as BufferSource),
      ),
    )
  return { pubRaw, signMsg }
}

/** 让「原生 WebCrypto 不认识 Ed25519」—— 模拟老 WebView。
 *
 *  ⚠️ 只拦 `importKey`（而且只在算法是 Ed25519 时），别把整个 subtle 干掉：
 *     干掉整个 subtle 会走到「没有 WebCrypto」那条，测的就不是这个分支了。
 */
function simulateOldWebView() {
  const real = globalThis.crypto.subtle.importKey.bind(globalThis.crypto.subtle)
  const spy = vi.spyOn(globalThis.crypto.subtle, 'importKey').mockImplementation(
    (format, keyData, algorithm, extractable, usages) => {
      const name = typeof algorithm === 'string' ? algorithm : (algorithm as { name?: string })?.name
      if (name === 'Ed25519') {
        // 老 Chrome 的原话就是这个
        throw new DOMException(
          "Failed to execute 'importKey' on 'SubtleCrypto': Unrecognized algorithm name",
          'NotSupportedError',
        )
      }
      return real(format, keyData, algorithm, extractable, usages)
    },
  )
  return () => spy.mockRestore()
}

describe('原生支持时（现在的 Chrome / node）', () => {
  it('真签名 → 通过', async () => {
    const { pubRaw, signMsg } = await makeKeypair()
    const msg = asBytes(new TextEncoder().encode('{"version":1,"games":[]}'))
    expect(await verifyCatalogSignature(msg, (await signMsg(msg)), pubRaw)).toBe(true)
  })

  it('内容被改过 → 不通过', async () => {
    const { pubRaw, signMsg } = await makeKeypair()
    const msg = asBytes(new TextEncoder().encode('{"version":1,"games":[]}'))
    const sig = await signMsg(msg)
    const tampered = asBytes(new TextEncoder().encode('{"version":1,"games":[{"id":"evil"}]}'))
    expect(await verifyCatalogSignature(tampered, sig, pubRaw)).toBe(false)
  })
})

describe('★ 老 WebView：原生没有 Ed25519 → 回退纯 JS', () => {
  it('★★ 真签名照样能验过（这就是用户那台手机要的）', async () => {
    const restore = simulateOldWebView()
    try {
      const { pubRaw, signMsg } = await makeKeypair()
      const msg = asBytes(new TextEncoder().encode('{"version":1,"games":[]}'))
      expect(await verifyCatalogSignature(msg, (await signMsg(msg)), pubRaw)).toBe(true)
    } finally {
      restore()
    }
  })

  it('★★ 兜底**不是跳过验签**：被改过的内容照样不通过', async () => {
    const restore = simulateOldWebView()
    try {
      const { pubRaw, signMsg } = await makeKeypair()
      const msg = asBytes(new TextEncoder().encode('{"version":1,"games":[]}'))
      const sig = await signMsg(msg)
      const tampered = asBytes(new TextEncoder().encode('{"version":1,"games":[{"id":"evil"}]}'))
      expect(await verifyCatalogSignature(tampered, sig, pubRaw)).toBe(false)
    } finally {
      restore()
    }
  })

  it('★ 换了另一把钥匙签的 → 不通过（不能"能验就算过"）', async () => {
    const restore = simulateOldWebView()
    try {
      const a = await makeKeypair()
      const b = await makeKeypair()
      const msg = asBytes(new TextEncoder().encode('{"version":1}'))
      // 用 b 的私钥签，拿 a 的公钥验
      expect(await verifyCatalogSignature(msg, (await b.signMsg(msg)), a.pubRaw)).toBe(false)
    } finally {
      restore()
    }
  })
})

describe('★ 配置问题不能被兜底吞掉', () => {
  it('公钥长度不对 → 抛（不是返回 false）', async () => {
    const { signMsg } = await makeKeypair()
    const msg = asBytes(new TextEncoder().encode('{}'))
    const badKey = new Uint8Array(16) // 应该是 32
    await expect(verifyCatalogSignature(msg, await signMsg(msg), badKey)).rejects.toThrow(/32 字节/)
  })

  it('★ 公钥坏 + 老 WebView 也照样抛（不能因为"要兼容"就把它变成验不过）', async () => {
    const restore = simulateOldWebView()
    try {
      const { signMsg } = await makeKeypair()
      const msg = asBytes(new TextEncoder().encode('{}'))
      const badKey = new Uint8Array(16)
      /* 这条最容易退化：如果兜底判断写成「任何 importKey 异常 → 走纯 JS」，
         坏公钥会走到纯 JS、纯 JS 也验不过、于是返回 false
         ⇒ 界面报「签名不匹配」，而真正原因是公钥配错了。
         排查的人会去查签名和私钥，方向全反。 */
      await expect(verifyCatalogSignature(msg, await signMsg(msg), badKey)).rejects.toThrow(/32 字节/)
    } finally {
      restore()
    }
  })
})
