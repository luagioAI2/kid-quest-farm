import { describe, expect, it } from 'vitest'
import { FOREGROUND_REFRESH_GAP_MS, shouldRefreshOnForeground } from './foreground'

/* ============================================================
   切回前台要不要重拉
   ------------------------------------------------------------
   错了也不报错：不拉 ⇒ 界面一直显示半天前的数据（家长在别的设备改的
   PIN / 限时也不生效）；每次都拉 ⇒ 来回切 App 就打一轮接口。
   ============================================================ */

describe('shouldRefreshOnForeground', () => {
  it('本进程还没拉过（0）⇒ 一定拉', () => {
    expect(shouldRefreshOnForeground(0, 1_000_000)).toBe(true)
  })

  it('30 秒内不重复拉', () => {
    const t = 1_000_000
    expect(shouldRefreshOnForeground(t, t + 1)).toBe(false)
    expect(shouldRefreshOnForeground(t, t + FOREGROUND_REFRESH_GAP_MS - 1)).toBe(false)
  })

  it('满 30 秒就拉', () => {
    const t = 1_000_000
    expect(shouldRefreshOnForeground(t, t + FOREGROUND_REFRESH_GAP_MS)).toBe(true)
  })

  it('时间倒流（设备时钟被改）不炸，也不放行', () => {
    expect(shouldRefreshOnForeground(1_000_000, 999_000)).toBe(false)
  })
})
