import type { Bytes } from './bytes'

/* ============================================================
   带进度的取包
   ------------------------------------------------------------
   用户 2026-11-13：「游戏下载时能否像华为应用商城那样显示下载进度、安装中」

   原来 `fetch(url)` + `arrayBuffer()` 是一口气等的 —— 界面上只有一句
   「正在下载…」，几 MB 的包在 4G 上要等十几秒，孩子会以为卡住了、反复点。

   ## 三条必须守住的

   1. **进度只影响显示，不参与判定。** 下载完仍然要过 SHA-256（`assertSha256`），
      进度条走到 100% 不等于"可信"。
   2. **没有 `Content-Length` 时不能瞎编百分比。** 有些 CDN / 反代会去掉它，
      硬拿 0 当总长会算出 `Infinity` 或一直 0%；这里报 `total: 0`，
      由界面显示「已下载 X MB」而不是假装有进度。
   3. **`ReadableStream` 不可用时要能退回去。** 老 WebView / 某些测试环境
      没有 `res.body`，那就整段读完再报一次 100% —— 功能不能因此挂掉。
   ============================================================ */

/** 下载进度回调。`total = 0` 表示服务端没给长度（只能显示已下载量）。 */
export type DownloadProgress = (p: { received: number; total: number }) => void

/**
 * 读一个响应体，边读边报进度，返回完整字节。
 *
 * ⚠️ 收完的字节必须和 `res.arrayBuffer()` 完全一致 —— 调用方要拿它验 SHA-256。
 *    所以这里**只做拼接**，不做任何解码/转码（`Blob` → `text` → `encode` 那种往返
 *    会让哈希对不上，`fetchVerifiedPackage` 的注释里记过）。
 */
export async function readBodyWithProgress(
  res: Response,
  onProgress?: DownloadProgress,
): Promise<Bytes> {
  /* ⚠️ `headers` 也要容错：测试替身常常只给 `arrayBuffer()`（没有 headers/body），
     而真环境里也有反向代理把整个 response 对象包成鸭子类型的情况。
     「拿不到总长」本来就是预期内的一种情况（下面按 -1 处理），没理由为它崩。 */
  const total = Number(res.headers?.get?.('content-length') ?? 0) || 0

  // 没有流式读取能力（老 WebView / jsdom）⇒ 整段读完报一次，别让功能挂掉
  const body = res.body
  if (!body || typeof body.getReader !== 'function') {
    const bytes = new Uint8Array(await res.arrayBuffer())
    onProgress?.({ received: bytes.byteLength, total: total || bytes.byteLength })
    return bytes
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  onProgress?.({ received: 0, total })

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.byteLength
      onProgress?.({ received, total })
    }
  }

  const out = new Uint8Array(received)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.byteLength
  }
  // 服务端没给长度时，读完之后按「刚好读完」报一次，让界面能收到 100%
  onProgress?.({ received, total: total || received })
  return out
}

/**
 * 百分比：`total` 未知时返回 `-1`（界面据此显示「已下载 X MB」而不是假进度）。
 *
 * ⚠️ 不要返回 0 表示"未知" —— 0% 是**合法进度**（刚开始），
 *   两者混在一起，界面就无法区分"还没开始"和"不知道总长"。
 */
export function percentOf(received: number, total: number): number {
  if (total <= 0) return -1
  return Math.max(0, Math.min(100, Math.floor((received / total) * 100)))
}

/** 给人看的体积（1.2 MB / 856 KB）。下载进度和游戏大小标签共用。 */
export function humanBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 KB'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}
