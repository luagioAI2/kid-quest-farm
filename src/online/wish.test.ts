import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK, UNAUTHORIZED } from '../api/client'
import {
  localWishOrderId,
  newWishRequestId,
  serverWishOrderId,
  wishFailToast,
} from './wish'
import { SRV_WISH_ORDER_PREFIX } from '../sync/map'

/* ============================================================
   心愿商城的 id 转换 + 失败文案。
   这两件事错了都**不报错**：id 剥错了显示成「这单没了」，
   文案错了孩子以为是另一件事。
   ============================================================ */

describe('订单 id 转换', () => {
  it('服务端 id 加前缀，剥回来是同一个串', () => {
    const local = localWishOrderId('WO20261102ABCD')
    expect(local).toBe(`${SRV_WISH_ORDER_PREFIX}WO20261102ABCD`)
    expect(serverWishOrderId(local)).toBe('WO20261102ABCD')
  })

  it('★ 本地生成的 `wo…` 不能当服务端 id —— 只差大小写，肉眼分不出', () => {
    expect(serverWishOrderId('woabc123')).toBeNull()
  })

  it('前缀本身不构成合法 id（剥完是空串也算不出来）', () => {
    // 空串会被服务端以 `binding:"required"` 拒掉，但这里先拦住，
    // 免得报出来的是「参数校验失败」而不是「这不是服务端订单」
    expect(serverWishOrderId(SRV_WISH_ORDER_PREFIX)).toBe('')
  })
})

describe('newWishRequestId', () => {
  it('每次都不同（连点两次不会撞同一个键）', () => {
    const a = newWishRequestId()
    const b = newWishRequestId()
    expect(a).not.toBe(b)
    expect(a.startsWith('wo-')).toBe(true)
  })
})

describe('wishFailToast', () => {
  const err = (code: number) => new ApiError(code, '服务端说不行')

  it('券不够：文案里**不带「张」**（差额是两种币合起来算的）', () => {
    const t = wishFailToast(err(10070601))
    expect(t.title).toBe('兑换券和积分不够啦')
    expect(t.title).not.toContain('张')
  })

  it('没定价 / 下架 / 盲盒开完 各有一句人话', () => {
    expect(wishFailToast(err(10070201)).title).toBe('爸妈还没给它定价')
    expect(wishFailToast(err(10070301)).title).toBe('这个下架了')
    expect(wishFailToast(err(10070701)).title).toBe('这些游戏你都有啦')
  })

  it('★ 状态不允许要提示「可能刚在另一台设备上处理过」', () => {
    // 连点两次兑换时服务端返回的就是这个码（状态 CAS 失败），
    // 只说「操作失败」的话，孩子会以为自己的券丢了
    const t = wishFailToast(err(10070501))
    expect(t.detail).toContain('另一台设备')
  })

  it('网络错误走通用那句（和别的动作一致）', () => {
    const t = wishFailToast(new ApiError(NETWORK, 'fetch failed'))
    expect(t.title).toContain('没发出去')
  })

  it('登录过期走通用那句', () => {
    const t = wishFailToast(new ApiError(UNAUTHORIZED, 'unauthorized'))
    expect(t.title).toContain('登录过期')
  })

  it('不认识的业务码回落成服务端的原话（不吞掉）', () => {
    const t = wishFailToast(err(99999999))
    expect(t.detail).toBe('服务端说不行')
  })
})
