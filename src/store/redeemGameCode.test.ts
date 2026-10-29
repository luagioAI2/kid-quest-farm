import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
  码表是**生成的哈希表**，反查不出明文 —— 所以这个文件把「码 → 游戏 id」
  这一步换成假的，专门测**兑换流程本身**：
  什么时候烧码、什么时候不烧、烧错了能不能退。

  `codeHashOf` 保持真货：防重就是靠它算出来的哈希当主键，
  换成假的就测不到「同一个码第二次被拒」。
*/
vi.mock('../games/codeLookup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../games/codeLookup')>()
  return { ...actual, gameIdForCode: vi.fn() }
})

import { db } from '../db/db'
import { useApp } from './useApp'
import { gameIdForCode } from '../games/codeLookup'

const lookup = vi.mocked(gameIdForCode)

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 一个格式合法、内容无所谓的码。真正解成什么游戏由 mock 决定 */
const CODE = 'ABC-234'

function mallRows() {
  return db.mallLedger.toArray()
}

beforeEach(async () => {
  await boot()
  lookup.mockReset()
})

describe('兑换码：不该烧码的四种情况', () => {
  it('格式不对 → 说清「6 位」，一个字节都不写', async () => {
    const r = await useApp.getState().redeemGameCode('AB')
    expect(r.ok).toBe(false)
    expect(r.message).toContain('6 位')
    expect(await db.wishCodes.count()).toBe(0)
    expect(await mallRows()).toHaveLength(1) // 只有首装那笔 500
  })

  it('表里没有这个码 → 「没有这个码」，不写库', async () => {
    lookup.mockResolvedValue(undefined)
    const r = await useApp.getState().redeemGameCode(CODE)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('没有这个码')
    expect(await db.wishCodes.count()).toBe(0)
  })

  it('★ 已经有了就不浪费一张码（内置农场默认已拥有）', async () => {
    lookup.mockResolvedValue('farm')
    const r = await useApp.getState().redeemGameCode(CODE)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('已经有了')
    expect(await db.wishCodes.count(), '这种情况不该记「已用」').toBe(0)
  })

  it('★ 这个版本里没有这款游戏 → 留着码，等升级', async () => {
    lookup.mockResolvedValue('ghost-game')
    const r = await useApp.getState().redeemGameCode(CODE)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('还没有')
    expect(await db.wishCodes.count()).toBe(0)
  })
})

describe('兑换码：解锁成功', () => {
  beforeEach(() => {
    lookup.mockResolvedValue('sugar')
    // 真装包要走网络 + 执行，这里只验编排。装包本身在 `install.test.ts`
    useApp.setState({ installLocalGame: async () => ({ ok: true, message: '' }) })
  })

  it('★ 解锁之后算「已拥有」—— 账本是唯一来源', async () => {
    const r = await useApp.getState().redeemGameCode(CODE)
    expect(r.ok).toBe(true)
    expect(r.gameId).toBe('sugar')
    expect(useApp.getState().ownedGameIds).toContain('sugar')
  })

  it('★ 账本那笔是 delta 0 / source redemption_code（spec §6 点名的坑）', async () => {
    await useApp.getState().redeemGameCode(CODE)
    const rows = (await mallRows()).filter((e) => e.source === 'redemption_code')
    expect(rows).toHaveLength(1)
    expect(rows[0].delta, '码解锁一分钻石都没花，delta 必须是 0').toBe(0)
    expect(rows[0].refId).toBe('sugar')
    // 余额不能被这一笔改动（0 也不该被当成「充值」）
    expect(useApp.getState().mallBalance).toBe(500)
  })

  it('★ 同一个码第二次拒绝，且不会再多写一行', async () => {
    await useApp.getState().redeemGameCode(CODE)
    const before = await mallRows()
    // 清掉「已拥有」的痕迹，逼它走到「查重用」那一步
    // （否则第二次会先在「你已经有了」那里返回，测不到防重）
    await db.mallLedger.clear()
    await useApp.getState().refresh()

    const r = await useApp.getState().redeemGameCode(CODE)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('用过了')
    expect(await db.wishCodes.count()).toBe(1)
    expect((await mallRows()).filter((e) => e.source === 'redemption_code')).toHaveLength(0)
    expect(before.length).toBeGreaterThan(0)
  })

  it('大小写 / 分隔符不影响：同一个码换个写法还是同一个', async () => {
    await useApp.getState().redeemGameCode('ABC-234')
    // 先抹掉「已拥有」—— 否则第二次会停在「你已经有了」那一步，
    // 测不到归一化（那一步在查重之前，是**故意**的：已有就不烧码）。
    await db.mallLedger.clear()
    await useApp.getState().refresh()

    const r = await useApp.getState().redeemGameCode('abc234')
    expect(r.message).toContain('用过了')
    expect(await db.wishCodes.count()).toBe(1)
  })
})

describe('兑换码：装包失败要退码', () => {
  it('★ 装包失败 → 码没扣（孩子不能既没游戏又没码）', async () => {
    lookup.mockResolvedValue('sugar')
    useApp.setState({
      installLocalGame: async () => ({ ok: false, message: '读取本地包失败：HTTP 404' }),
    })

    const r = await useApp.getState().redeemGameCode(CODE)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('码没扣')
    expect(await db.wishCodes.count(), '码要能再用一次').toBe(0)
    expect((await mallRows()).filter((e) => e.source === 'redemption_code')).toHaveLength(0)
    expect(useApp.getState().ownedGameIds).not.toContain('sugar')
  })
})
