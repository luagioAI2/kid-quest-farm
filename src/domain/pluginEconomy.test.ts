/**
 * 插件经济闸门的全参数空间测试。
 *
 * 为什么不用「举两个例子」：`checkPluginEconomy` 是**安装时的门**，
 * 漏判的后果是「一局刷出积分」而不是报错。所以这里逐条钉住每个边界，
 * 并且**每条都带一个对照**（合法的那一侧），否则「恒返回 issue」也能全绿。
 */

import { describe, expect, it } from 'vitest'
import { MAX_PAYOUT_RATIO, checkPluginEconomy, vouchersPerPlay } from './pluginEconomy'
import type { GameEconomy } from '../games/plugin'

const ok: GameEconomy = { playCost: 5, expectedPayout: 3, capPerPrize: 5 }
const okRedeem: GameEconomy = { ...ok, voucherPerCoin: 1 }

describe('checkPluginEconomy：合法的一侧', () => {
  it('不开放兑换时通过', () => {
    expect(checkPluginEconomy(ok)).toBeNull()
  })
  it('开放兑换且期望值达标时通过', () => {
    expect(checkPluginEconomy(okRedeem)).toBeNull()
  })
  it('奖品公园的真实参数通过（playCost 1 / payout 0.6 / rate 1）', () => {
    expect(
      checkPluginEconomy({ playCost: 1, expectedPayout: 0.6, capPerPrize: 5, voucherPerCoin: 1 }),
    ).toBeNull()
  })
  it('expectedPayout 正好等于 0.8 × playCost 是允许的（边界含在内）', () => {
    expect(checkPluginEconomy({ playCost: 10, expectedPayout: 8, capPerPrize: 1 })).toBeNull()
  })
})

describe('checkPluginEconomy：不合法的一侧', () => {
  it('缺 economy', () => {
    expect(checkPluginEconomy(undefined)?.code).toBe('playCost')
    expect(checkPluginEconomy(null)?.code).toBe('playCost')
  })

  it('playCost 非正数', () => {
    expect(checkPluginEconomy({ ...ok, playCost: 0 })?.code).toBe('playCost')
    expect(checkPluginEconomy({ ...ok, playCost: -1 })?.code).toBe('playCost')
    expect(checkPluginEconomy({ ...ok, playCost: Number.NaN })?.code).toBe('playCost')
  })

  it('expectedPayout 是负数 / NaN', () => {
    expect(checkPluginEconomy({ ...ok, expectedPayout: -1 })?.code).toBe('payout')
    expect(checkPluginEconomy({ ...ok, expectedPayout: Number.NaN })?.code).toBe('payout')
  })

  it('expectedPayout 超过成本的 80%（印钞机的门槛）', () => {
    const r = checkPluginEconomy({ playCost: 5, expectedPayout: 4.01, capPerPrize: 5 })
    expect(r?.code).toBe('payoutRatio')
    // 对照：4.00 刚好是 0.8 倍，允许
    expect(checkPluginEconomy({ playCost: 5, expectedPayout: 4, capPerPrize: 5 })).toBeNull()
    expect(MAX_PAYOUT_RATIO).toBe(0.8)
  })

  it('capPerPrize < 1', () => {
    expect(checkPluginEconomy({ ...ok, capPerPrize: 0 })?.code).toBe('cap')
  })

  it('voucherPerCoin 是负数', () => {
    expect(checkPluginEconomy({ ...ok, voucherPerCoin: -1 })?.code).toBe('voucher')
  })

  it('★ 一局期望换出的券 ≥ 一局成本 —— 这条才是真正的印钞机闸门', () => {
    // payout 3 × rate 2 = 6 > playCost 5
    const r = checkPluginEconomy({ playCost: 5, expectedPayout: 3, capPerPrize: 5, voucherPerCoin: 2 })
    expect(r?.code).toBe('voucher')
    // 对照：rate 1 时 3 < 5，允许
    expect(checkPluginEconomy({ playCost: 5, expectedPayout: 3, capPerPrize: 5, voucherPerCoin: 1 })).toBeNull()
    // 边界：正好等于成本也不行（`<` 不是 `≤`）
    expect(
      checkPluginEconomy({ playCost: 4, expectedPayout: 2, capPerPrize: 5, voucherPerCoin: 2 })?.code,
    ).toBe('voucher')
  })

  it('voucherPerCoin 写 0 = 明确关闭兑换，仍然通过', () => {
    expect(checkPluginEconomy({ ...ok, voucherPerCoin: 0 })).toBeNull()
    expect(vouchersPerPlay({ ...ok, voucherPerCoin: 0 })).toBe(0)
  })
})

describe('vouchersPerPlay：给家长看的那个数', () => {
  it('没写 / 写 0 → 0（调用方据此隐藏这一行）', () => {
    expect(vouchersPerPlay(ok)).toBe(0)
    expect(vouchersPerPlay(undefined)).toBe(0)
  })
  it('按 期望产出 × 汇率 算', () => {
    expect(vouchersPerPlay(okRedeem)).toBe(3)
    expect(vouchersPerPlay({ playCost: 1, expectedPayout: 0.6, capPerPrize: 5, voucherPerCoin: 1 })).toBe(0.6)
  })
})
