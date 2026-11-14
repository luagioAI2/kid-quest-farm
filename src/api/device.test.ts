import { beforeEach, describe, expect, it } from 'vitest'
import { __resetDeviceIdForTest, deviceIdPersisted, getDeviceId } from './device'

/* ============================================================
   设备号（2026-11-03）
   ------------------------------------------------------------
   游客账号「认设备」全靠这一串。它一旦变得不可靠，症状是**静默的**：

     · 每次启动都变 ⇒ 每次重开 App 都是一个新账号，昨天挣的券不见了；
     · 形状不对     ⇒ 服务端 `deviceIDRe` 直接拒，客户端只看到「参数错误」；
     · 存不住       ⇒ 上面第一条，而且只在「隐私模式 / 存储被清」时发生。

   所以这里守三件事：形状、稳定、坏数据能自愈。
   ============================================================ */

describe('设备号', () => {
  beforeEach(() => {
    localStorage.clear()
    __resetDeviceIdForTest()
  })

  it('形状能过服务端的白名单', () => {
    /* 服务端 `deviceIDRe = ^[A-Za-z0-9_-]{8,64}$` —— 两边必须一致，
       不一致的表现是「游客登录一直报参数错误」，而人根本猜不到是这里。 */
    expect(getDeviceId()).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })

  it('同一次运行里恒定', () => {
    expect(getDeviceId()).toBe(getDeviceId())
  })

  it('★ 重开 App（清掉内存缓存）之后还是同一个', () => {
    const first = getDeviceId()
    __resetDeviceIdForTest()
    expect(getDeviceId()).toBe(first)
  })

  it('两台设备拿到不同的号', () => {
    const a = getDeviceId()
    localStorage.clear()
    __resetDeviceIdForTest()
    const b = getDeviceId()
    expect(b).not.toBe(a)
  })

  it('★ 存的是坏数据就重新生成，别把脏串发给服务端', () => {
    localStorage.setItem('kqf.device.id.v1', '带 空 格 的')
    __resetDeviceIdForTest()
    const id = getDeviceId()
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    expect(localStorage.getItem('kqf.device.id.v1')).toBe(id)
  })

  it('落盘了', () => {
    getDeviceId()
    expect(deviceIdPersisted()).toBe(true)
    expect(localStorage.getItem('kqf.device.id.v1')).toBe(getDeviceId())
  })
})
