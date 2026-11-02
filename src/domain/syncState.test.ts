import { describe, expect, it } from 'vitest'
import { SYNC_OK, syncBannerText, syncedAtLabel } from './syncState'

/**
 * 横幅的判据不是「有字」，而是「**该做的事说对了**」：
 *   · 从来没同步过 ⇒ 让家长去查网络（不然他会以为孩子的数据丢了）；
 *   · 有旧数据     ⇒ 说清看到的是几点的（不然孩子把昨天的任务当今天做）；
 *   · 成功         ⇒ 一个字都不出现（横幅常驻会把真正的提示淹掉）。
 */
describe('syncBannerText：断网时界面说什么', () => {
  const NOW = new Date(2026, 10, 2, 21, 40, 0).getTime() // 2026-11-02 21:40 本地时间

  it('上一次是成功的 ⇒ 不显示', () => {
    expect(syncBannerText({ lastOkAt: NOW - 60_000, failure: null }, NOW)).toBeNull()
  })

  it('初始态（没同步过也没失败）⇒ 不显示', () => {
    expect(syncBannerText(SYNC_OK, NOW)).toBeNull()
  })

  it('★ 从来没同步成功过 ⇒ 让他去查网络', () => {
    const t = syncBannerText({ lastOkAt: 0, failure: 'Failed to fetch' }, NOW)
    expect(t).toContain('连不上服务器')
    expect(t).toContain('还没有同步过')
    expect(t).toContain('再试一次')
  })

  it('★★ 有旧数据 ⇒ 说清「看到的是几点的」', () => {
    const t = syncBannerText({ lastOkAt: NOW - 3 * 3600_000, failure: 'Failed to fetch' }, NOW)
    expect(t).toContain('今天 18:40')
    expect(t).toContain('等网络好了')
  })

  it('★ 不把内部原因露给用户（`pull-failed` / `fetch` / `ApiError`）', () => {
    for (const failure of ['pull-failed', 'Failed to fetch', 'ApiError: 401']) {
      for (const lastOkAt of [0, NOW - 1000]) {
        const t = syncBannerText({ lastOkAt, failure }, NOW) ?? ''
        expect(t).not.toMatch(/pull-failed|fetch|ApiError|401|undefined|NaN/)
      }
    }
  })

  it('★ 时间戳算坏了也不显示 1970（那是「格式没写好」最典型的样子）', () => {
    const t = syncBannerText({ lastOkAt: 0, failure: 'x' }, NOW) ?? ''
    expect(t).not.toContain('1970')
  })
})

describe('syncedAtLabel：收本机毫秒', () => {
  const NOW = new Date(2026, 10, 2, 21, 40, 0).getTime()

  it('今天 / 昨天 / 更早', () => {
    expect(syncedAtLabel(NOW - 3600_000, NOW)).toBe('今天 20:40')
    expect(syncedAtLabel(NOW - 86_400_000, NOW)).toBe('昨天 21:40')
    expect(syncedAtLabel(NOW - 3 * 86_400_000, NOW)).toBe('10月30日 21:40')
  })
})
