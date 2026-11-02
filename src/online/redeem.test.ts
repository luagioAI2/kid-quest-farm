import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK, UNAUTHORIZED } from '../api/client'
import {
  createBody,
  localRecordId,
  newRequestId,
  redeemFailToast,
  serverRecordId,
  updateBody,
} from './redeem'
import type { RedeemItem } from '../domain/types'

/* ============================================================
   兑换商城的字段翻译 —— 这一层的错全都**不报错**，只表现成
   「家长改了没生效」或「孩子看到的次数不对」，所以逐条钉住。
   ============================================================ */

const BASE: Omit<RedeemItem, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '玩 30 分钟平板',
  emoji: '📱',
  category: 'screen',
  cost: 50,
  note: '周末才能用',
  limitPerDay: 2,
  once: false,
  createdByParent: true,
}

describe('createBody', () => {
  it('id 由客户端带上去（服务端照用），字段翻成 snake_case', () => {
    const b = createBody('rd-abc', BASE)
    expect(b).toMatchObject({
      id: 'rd-abc',
      name: '玩 30 分钟平板',
      category: 'screen',
      cost: 50,
      limit_per_day: 2,
      note: '周末才能用',
    })
    expect(b).not.toHaveProperty('limitPerDay')
  })

  it('stock 缺省补 -1（服务端约定 -1 = 无限）', () => {
    expect(createBody('rd-abc', BASE).stock).toBe(-1)
    expect(createBody('rd-abc', { ...BASE, stock: 3 }).stock).toBe(3)
  })

  it('createdAt / updatedAt 不发（服务端自己写时间戳）', () => {
    const b = createBody('rd-abc', BASE)
    expect(b).not.toHaveProperty('created_at')
    expect(b).not.toHaveProperty('updated_at')
  })
})

describe('updateBody', () => {
  it('只发 patch 里**出现过**的键', () => {
    // 只改名字：不能顺手把 limit_per_day / note 一起发过去
    const b = updateBody({ name: '新名字' })
    expect(b).toEqual({ name: '新名字' })
  })

  it('★ 备注被清空（undefined）时要发空串 —— 否则家长删不掉备注', () => {
    expect(updateBody({ note: undefined })).toEqual({ note: '' })
  })

  it('★ 取消每日限额（undefined）要发 0 —— 否则限额取消不掉', () => {
    expect(updateBody({ limitPerDay: undefined })).toEqual({ limit_per_day: 0 })
  })

  it('库存清空回 -1（无限）', () => {
    expect(updateBody({ stock: undefined })).toEqual({ stock: -1 })
  })

  it('下架只发 archived 一个字段', () => {
    expect(updateBody({ archived: true })).toEqual({ archived: true })
  })

  it('★ 没有零值可翻的字段（name/cost）不会发 null', () => {
    // 发 null 只会换来一条「参数校验失败」，而家长看到的是「改不了」
    expect(updateBody({ name: undefined, cost: undefined })).toEqual({})
  })

  it('编辑器的整份 patch 全量翻译（改价时其它字段原样带上）', () => {
    const b = updateBody({
      name: '玩 1 小时',
      emoji: '📺',
      category: 'screen',
      cost: 100,
      note: undefined,
      limitPerDay: undefined,
      once: true,
    })
    expect(b).toEqual({
      name: '玩 1 小时',
      emoji: '📺',
      category: 'screen',
      cost: 100,
      note: '',
      limit_per_day: 0,
      once: true,
    })
  })
})

describe('幂等键', () => {
  it('每次都不一样，且短到服务端能收（账本 key 有长度上限）', () => {
    const a = newRequestId()
    const b = newRequestId()
    expect(a).not.toBe(b)
    expect(a.length).toBeLessThanOrEqual(64)
  })
})

describe('兑换记录的 id 前缀', () => {
  it('加 / 剥前缀是一对', () => {
    expect(localRecordId('RR1700000000123')).toBe('srv_rr_RR1700000000123')
    expect(serverRecordId('srv_rr_RR1700000000123')).toBe('RR1700000000123')
  })

  it('★ 本地记录（没有前缀）剥不出来 —— 返回 null 而不是硬切', () => {
    // 硬切的话会拿 `rr-xxx` 去调 /redeem/fulfill，服务端回「记录不存在」，
    // 而界面显示的是「记录没了」
    expect(serverRecordId('rr-abc123')).toBeNull()
  })
})

describe('redeemFailToast', () => {
  const code = (c: number) => new ApiError(c, '服务端的原文')

  it('余额不足：用孩子听得懂的话，和本地版一字不差', () => {
    const t = redeemFailToast(code(10020301))
    expect(t.title).toBe('兑换券和积分不够啦')
    expect(t.detail).toBe('再攒一攒吧')
  })

  it('一次性 / 限额 / 缺货 / 已下架各有自己的话', () => {
    expect(redeemFailToast(code(10060301)).title).toBe('这个只能换一次')
    expect(redeemFailToast(code(10060401)).title).toBe('今天换得太多了')
    expect(redeemFailToast(code(10060501)).title).toBe('已经换光啦')
    expect(redeemFailToast(code(10060201)).title).toBe('这个下架了')
  })

  it('网络 / 登录过期交给统一那套（和别的动作同一句话）', () => {
    expect(redeemFailToast(new ApiError(NETWORK, 'x')).title).toBe('这次兑换没发出去')
    expect(redeemFailToast(new ApiError(UNAUTHORIZED, 'x')).title).toBe(
      '登录过期了，请重新登录',
    )
  })

  it('不认识的错误码：带上服务端原文，别吞掉', () => {
    const t = redeemFailToast(code(10069999))
    expect(t.detail).toBe('服务端的原文')
  })
})
