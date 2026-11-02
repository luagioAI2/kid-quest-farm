import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ============================================================
   导出链路（`shareOrDownload`）
   ------------------------------------------------------------
   这条链路是「换机备份」的出口，而它此前**零测试** —— 浏览器里
   走的是 `saveBlob`（a[download]），走查全绿；到了 APK 里换一条
   完全不同的路，那条路没人验过。

   改动前的实现只写 `Directory.Documents`，写失败就退到 `saveBlob`。
   而 `saveBlob` 在 WebView 里 `<a download>` + `blob:` 不会落盘
   （没有 DownloadListener），却仍然返回 true —— 界面说「已导出」，
   文件不存在。所以现在的判据是：**Documents 失败时必须还能写进
   Cache 并分享出去**，而不是掉进那个「假装成功」的兜底。
   ============================================================ */

/** 每个目录写文件的结果：'ok' 或 'fail' */
let writeResult: Record<string, 'ok' | 'fail'> = {}
/** 实际尝试过的目录顺序 */
let triedDirs: string[] = []
/** Share.share 收到的参数 */
let shared: { url?: string }[] = []
/** saveBlob 是否被用到（= 走了浏览器兜底） */
let blobFallback = false
/** 当前是不是原生环境 */
let native = true

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native },
}))

vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS', Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    writeFile: async (opts: { directory: string; path: string }) => {
      triedDirs.push(opts.directory)
      if (writeResult[opts.directory] === 'ok') {
        return { uri: `file:///fake/${opts.directory}/${opts.path}` }
      }
      throw new Error(`EACCES: ${opts.directory}`)
    },
  },
}))

vi.mock('@capacitor/share', () => ({
  Share: {
    share: async (opts: { url?: string }) => {
      shared.push(opts)
      return {}
    },
  },
}))

import { saveBlob, shareOrDownload } from './files'

beforeEach(() => {
  writeResult = {}
  triedDirs = []
  shared = []
  blobFallback = false
  native = true
  // jsdom 没有 createObjectURL；不 stub 的话 saveBlob 会在 catch 里
  // 静默返回 false，测试就分不清「没走兜底」和「兜底炸了」
  URL.createObjectURL = vi.fn(() => {
    blobFallback = true
    return 'blob:fake'
  })
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

describe('原生：写文件 + 系统分享', () => {
  it('Documents 写得进去时，分享的就是 Documents 那份', async () => {
    writeResult = { DOCUMENTS: 'ok' }
    const ok = await shareOrDownload('backup.json', '{}')

    expect(ok).toBe(true)
    expect(triedDirs).toEqual(['DOCUMENTS'])
    expect(shared[0]?.url).toBe('file:///fake/DOCUMENTS/backup.json')
    expect(blobFallback).toBe(false)
  })

  it('Documents 写不进去时，必须退到 Cache 并分享出去（不是掉进下载兜底）', async () => {
    writeResult = { DOCUMENTS: 'fail', CACHE: 'ok' }
    const ok = await shareOrDownload('backup.json', '{}')

    expect(ok).toBe(true)
    expect(triedDirs).toEqual(['DOCUMENTS', 'CACHE'])
    expect(shared[0]?.url).toBe('file:///fake/CACHE/backup.json')
    // 这一条才是回归判据：改之前这里会变成 true + 什么都没写
    expect(blobFallback).toBe(false)
  })

  it('两个目录都写不进去，才退回下载', async () => {
    writeResult = { DOCUMENTS: 'fail', CACHE: 'fail' }
    const ok = await shareOrDownload('backup.json', '{}')

    expect(ok).toBe(true)
    expect(triedDirs).toEqual(['DOCUMENTS', 'CACHE'])
    expect(shared).toHaveLength(0)
    expect(blobFallback).toBe(true)
  })

  it('用户取消分享面板，不算失败', async () => {
    writeResult = { DOCUMENTS: 'ok' }
    const { Share } = await import('@capacitor/share')
    vi.spyOn(Share, 'share').mockRejectedValueOnce(new Error('canceled'))

    expect(await shareOrDownload('backup.json', '{}')).toBe(true)
  })
})

describe('浏览器：直接下载', () => {
  it('不碰 Filesystem / Share', async () => {
    native = false
    const ok = await shareOrDownload('backup.json', '{}')

    expect(ok).toBe(true)
    expect(triedDirs).toEqual([])
    expect(shared).toHaveLength(0)
    expect(blobFallback).toBe(true)
  })

  it('saveBlob 失败时返回 false（别把「没下载」说成成功）', async () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error('no blob support')
    })
    expect(await saveBlob('x.json', '{}')).toBe(false)
  })
})
