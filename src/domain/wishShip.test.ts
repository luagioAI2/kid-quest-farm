import { describe, expect, it } from 'vitest'
import { shipFormIssue, toServerShip } from './wishShip'

/* ============================================================
   家长补地址：本地 → 服务端 + 表单校验
   ------------------------------------------------------------
   这两件事单测能测，而且**必须**单测：服务端在地址为空时是
   「静默不动」（`shipFields` 返回 nil），家长填了一半点提交，
   界面上照样提示「已经完成啦」—— 不报错、不落库。
   ============================================================ */

const FULL = {
  receiver: '妈妈',
  phone: '13800138000',
  region: '广东省深圳市南山区',
  address: '科技园 1 号 3 栋 502',
}

describe('toServerShip', () => {
  it('原样送四个字段，去掉首尾空格', () => {
    expect(toServerShip({ ...FULL, receiver: ' 妈妈 ' })).toEqual(FULL)
  })

  it('★ 不送 purgeAfter —— 过期时间是服务端算的', () => {
    const out = toServerShip({ ...FULL, purgeAfter: 1793617571000 })
    expect(out).toEqual(FULL)
    expect(out && 'purgeAfter' in out).toBe(false)
    expect(out && 'purge_after' in out).toBe(false)
  })

  it('★ 地址为空 ⇒ undefined（这次别动服务端那份，别把它清空）', () => {
    expect(toServerShip({ ...FULL, address: '   ' })).toBeUndefined()
    expect(toServerShip(undefined)).toBeUndefined()
  })

  it('备注空串就不送（服务端是 omitempty，送空串等于多一个字段）', () => {
    const out = toServerShip({ ...FULL, note: '   ' })
    expect(out).toEqual(FULL)
    expect(toServerShip({ ...FULL, note: ' 130 码 ' })?.note).toBe('130 码')
  })
})

describe('shipFormIssue', () => {
  it('填全了就可以提交', () => {
    expect(shipFormIssue(FULL)).toBeNull()
  })

  it('★ 每缺一项都说出「缺什么」，不是笼统的「请填写完整」', () => {
    expect(shipFormIssue({ ...FULL, receiver: '' })).toContain('收件人')
    expect(shipFormIssue({ ...FULL, phone: '' })).toContain('电话')
    expect(shipFormIssue({ ...FULL, address: '' })).toContain('地址')
  })

  it('电话带空格 / 横线也认（家长常这么写）', () => {
    expect(shipFormIssue({ ...FULL, phone: '138-0013-8000' })).toBeNull()
    expect(shipFormIssue({ ...FULL, phone: '138 0013 8000' })).toBeNull()
  })

  it('电话里混字母 / 位数明显不对 ⇒ 提示只填数字', () => {
    expect(shipFormIssue({ ...FULL, phone: '138abc' })).toContain('数字')
    expect(shipFormIssue({ ...FULL, phone: '123' })).toContain('数字')
  })
})
