import { describe, expect, it, vi } from 'vitest'
import { percentOf, humanBytes, readBodyWithProgress } from '../games/download'
import {
  barRatio,
  installButtonText,
  installProgressText,
  type InstallProgress,
} from './installProgress'

/* ============================================================
   安装进度（2026-11-13，用户要「像应用商城那样」）
   ------------------------------------------------------------
   这里守三件容易静默做坏的事：

     ① 总长未知（服务端没给 `Content-Length`）时报成了 0% 或 100%
        ⇒ 进度条看起来卡死或瞬间满；
     ② 流式读出来的字节和 `arrayBuffer()` 不一致 ⇒ 哈希校验无故失败；
     ③ 文案在三个地方（按钮 / 行内 / toast）各写一套 ⇒ 同一动作三种说法。
   ============================================================ */

const P = (over: Partial<InstallProgress> = {}): InstallProgress => ({
  gameId: 'g',
  phase: 'download',
  percent: 40,
  received: 400,
  total: 1000,
  ...over,
})

describe('percentOf', () => {
  it('正常换算并封顶', () => {
    expect(percentOf(0, 1000)).toBe(0)
    expect(percentOf(500, 1000)).toBe(50)
    expect(percentOf(1000, 1000)).toBe(100)
    expect(percentOf(2000, 1000)).toBe(100) // 超了也不许超过 100
  })

  it('★ 总长未知返回 -1，不是 0 —— 0% 是合法进度，两者混一起界面就分不清', () => {
    expect(percentOf(400, 0)).toBe(-1)
    expect(percentOf(400, -5)).toBe(-1)
  })
})

describe('humanBytes', () => {
  it('三个量级都对', () => {
    expect(humanBytes(0)).toBe('0 KB')
    expect(humanBytes(512)).toBe('512 B')
    expect(humanBytes(2048)).toBe('2 KB')
    expect(humanBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('脏输入不崩（NaN / 负数）', () => {
    expect(humanBytes(Number.NaN)).toBe('0 KB')
    expect(humanBytes(-1)).toBe('0 KB')
  })
})

describe('readBodyWithProgress', () => {
  const makeStream = (chunks: Uint8Array[], length?: number) => {
    let i = 0
    return {
      headers: new Headers(length == null ? {} : { 'content-length': String(length) }),
      body: {
        getReader: () => ({
          read: async () =>
            i < chunks.length ? { done: false, value: chunks[i++] } : { done: true, value: undefined },
        }),
      },
      arrayBuffer: async () => {
        const all = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0))
        let at = 0
        for (const c of chunks) {
          all.set(c, at)
          at += c.byteLength
        }
        return all.buffer
      },
    } as unknown as Response
  }

  it('★ 拼出来的字节必须和 arrayBuffer() 一模一样（否则哈希会无故失败）', async () => {
    const chunks = [
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5]),
      new Uint8Array([6, 7, 8, 9]),
    ]
    const res = makeStream(chunks, 9)
    const got = await readBodyWithProgress(res)
    const want = new Uint8Array(await res.arrayBuffer())
    expect(Array.from(got)).toEqual(Array.from(want))
  })

  it('有总长时按字节报进度，最后一次是 100%', async () => {
    const seen: number[] = []
    await readBodyWithProgress(makeStream([new Uint8Array(4), new Uint8Array(6)], 10), (p) =>
      seen.push(percentOf(p.received, p.total)),
    )
    /* 4 + 6 = 10 字节 ⇒ 中途只有 40%（4/10），没有 50%。
       ⚠️ 这里原来写的 50 是我算错了：中间值取决于**分块**，
          断言具体中间值等于把分块大小写进测试。 */
    expect(seen[0]).toBe(0)
    expect(seen).toContain(40)
    expect(seen[seen.length - 1]).toBe(100)
  })

  it('没有 Content-Length 时也能读完并报 -1（不假装有进度）', async () => {
    const seen: Array<{ r: number; t: number }> = []
    const got = await readBodyWithProgress(makeStream([new Uint8Array(3), new Uint8Array(4)]), (p) =>
      seen.push({ r: p.received, t: p.total }),
    )
    expect(got.byteLength).toBe(7)
    // 中途那几次 total 都是 0（未知）⇒ percent 只能是 -1
    expect(seen.some((s) => s.t === 0)).toBe(true)
  })

  it('★ 没有 res.body（老 WebView）⇒ 退化成整段读，功能不能挂', async () => {
    const res = {
      headers: new Headers({ 'content-length': '4' }),
      body: null,
      arrayBuffer: async () => new Uint8Array([9, 9, 9, 9]).buffer,
    } as unknown as Response
    const onProgress = vi.fn()
    const got = await readBodyWithProgress(res, onProgress)
    expect(Array.from(got)).toEqual([9, 9, 9, 9])
    expect(onProgress).toHaveBeenCalled()
    expect(percentOf(4, 4)).toBe(100)
  })
})

describe('文案', () => {
  it('有百分比报百分比，没有只报已下载量', () => {
    expect(installProgressText(P())).toBe('下载中 40%')
    expect(installProgressText(P({ percent: -1, received: 3 * 1024 * 1024 }))).toBe('下载中 3.0 MB')
  })

  it('非下载阶段只说阶段（这几步没有百分比，给假进度反而让人等）', () => {
    expect(installProgressText(P({ phase: 'catalog' }))).toBe('正在核对清单…')
    expect(installProgressText(P({ phase: 'install' }))).toBe('安装中…')
  })

  it('★ 按钮上那句要更短（药丸形按钮撑不下「下载中 40%」）', () => {
    expect(installButtonText(P())).toBe('下载 40%')
    expect(installButtonText(P({ phase: 'install' }))).toBe('安装中…')
    expect(installButtonText(P({ percent: -1, received: 1024 }))).toBe('下载 1 KB')
  })
})

describe('barRatio', () => {
  it('已知总长按比例，未知返回 0（界面据此切成滚动条）', () => {
    expect(barRatio(P({ percent: 40 }))).toBeCloseTo(0.4)
    expect(barRatio(P({ percent: 250 }))).toBe(1)
    expect(barRatio(P({ percent: -1 }))).toBe(0)
  })
})
