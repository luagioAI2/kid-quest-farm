import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
  兑换码 · **登录态**（服务端是真相）。

  和 `redeemGameCode.test.ts` 的分工：
    · 那个文件测**没登录**时的本机码表（烧码 / 退码都在本地）；
    · 这个文件测**登录后**走 `/api/wish/redeem-code` 的那条路。

  这里必须把 `redeemWishCode` 换成假的 —— 单测不连后端。
  但 `ApiError` 用真货：`isNetwork` / `isAuth` 的判定逻辑正是要测的东西。
*/

vi.mock('../api/wish', () => ({ redeemWishCode: vi.fn() }))
vi.mock('../api/session', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/session')>()
  return { ...actual, getToken: vi.fn(() => 'fake-token') }
})

import { db } from '../db/db'
import { useApp } from './useApp'
import { redeemWishCode } from '../api/wish'
import { ApiError, NETWORK, UNAUTHORIZED } from '../api/client'

const redeem = vi.mocked(redeemWishCode)

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

const CODE = 'ABC-234'

/** 账本里 `redemption_code` 那几笔 */
async function codeRows() {
  const all = await db.mallLedger.toArray()
  return all.filter((r) => r.source === 'redemption_code')
}

beforeEach(async () => {
  await boot()
  redeem.mockReset()
  useApp.setState({ installLocalGame: async () => ({ ok: true, message: '' }) })
})

describe('兑换码（登录态）：服务端说了算', () => {
  it('★ 服务端给了 game_id → 本地补一笔 delta 0 的账，游戏算「已拥有」', async () => {
    redeem.mockResolvedValue({
      code: '****234',
      item_id: 'wish-game-cloudfarm',
      unlocked: true,
      game_id: 'cloudfarm',
    })

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(true)
    expect(r.gameId).toBe('cloudfarm')
    expect(r.message).toContain('已激活')

    const rows = await codeRows()
    expect(rows).toHaveLength(1)
    // ★ delta 必须是 0：码解锁一分钻石都没花，写别的数就是假账
    expect(rows[0].delta).toBe(0)
    expect(rows[0].refId).toBe('cloudfarm')

    // 「我的游戏」认的是账本推导出来的这个列表
    expect(useApp.getState().ownedGameIds).toContain('cloudfarm')
  })

  it('★ 服务端说码无效 → 照抄服务端的文案，本地一个字都不写', async () => {
    redeem.mockRejectedValue(new ApiError(10070901, '兑换码无效'))

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(false)
    expect(r.message).toBe('兑换码无效')
    expect(await codeRows()).toHaveLength(0)
  })

  it('★ 已经拥有（10040301）→ 说清「已经有了」，不当成失败重试', async () => {
    redeem.mockRejectedValue(new ApiError(10040301, '你已经拥有这个游戏了'))

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(false)
    expect(r.message).toContain('已经拥有')
  })

  it('★ 连不上服务器 → 明说「码没被用掉」（否则家长会以为卡废了）', async () => {
    redeem.mockRejectedValue(new ApiError(NETWORK, '连不上服务器'))

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(false)
    expect(r.message).toContain('没被用掉')
  })

  it('登录过期 → 让人重新登录，也说明码没被用掉', async () => {
    redeem.mockRejectedValue(new ApiError(UNAUTHORIZED, '登录已过期'))

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(false)
    expect(r.message).toContain('重新登录')
    expect(r.message).toContain('没被用掉')
  })

  it('★ 装包失败 ≠ 兑换失败：码已经在服务端用掉，只能照实说「去点安装」', async () => {
    redeem.mockResolvedValue({
      code: '****234',
      item_id: 'wish-game-cloudfarm',
      unlocked: true,
      game_id: 'cloudfarm',
    })
    useApp.setState({
      installLocalGame: async () => ({ ok: false, message: '下载超时' }),
    })

    const r = await useApp.getState().redeemGameCode(CODE)

    // 不能报 false —— 报 false 会让人以为码没用上，再去买一张
    expect(r.ok).toBe(true)
    expect(r.message).toContain('没装成功')
    expect(r.message).toContain('我的游戏')
    // 账本照样要有：已激活是事实，装不装是下一步
    expect(await codeRows()).toHaveLength(1)
  })

  it('★ 盲盒卡（5 连）→ 5 款都补账、都算已拥有，别只认 game_id', async () => {
    // 服务端对盲盒卡会同时给 `game_id`（第一款，兜老客户端）和 `game_ids`（全部）。
    // ⚠️ 只读 `game_id` 的后果不报错也不崩：账本只记 1 笔，
    //    「我的游戏」里少 4 款，而服务端明明授了 5 款。
    redeem.mockResolvedValue({
      code: '****234',
      item_id: 'wish-blindbox-5',
      unlocked: true,
      game_id: 'g1',
      game_ids: ['g1', 'g2', 'g3', 'g4', 'g5'],
    })

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(true)
    expect(r.gameId).toBe('g1')
    // 文案要一眼看出「开了几个」，不是只念第一款
    expect(r.message).toContain('5 款')

    const rows = await codeRows()
    expect(rows).toHaveLength(5)
    expect(rows.map((x) => x.refId).sort()).toEqual(['g1', 'g2', 'g3', 'g4', 'g5'])
    for (const row of rows) expect(row.delta).toBe(0)

    const owned = useApp.getState().ownedGameIds
    for (const id of ['g1', 'g2', 'g3', 'g4', 'g5']) expect(owned).toContain(id)
  })

  it('★ 老服务端只给 game_id（没有 game_ids）→ 仍然按 1 款处理，不能崩', async () => {
    redeem.mockResolvedValue({
      code: '****234',
      item_id: 'wish-game-cloudfarm',
      unlocked: true,
      game_id: 'cloudfarm',
    })

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(true)
    expect(await codeRows()).toHaveLength(1)
  })

  it('码是真的但不是游戏卡（没有 game_id）→ 只说「兑换成功」，不编游戏名', async () => {
    redeem.mockResolvedValue({
      code: '****234',
      item_id: 'wish-toy-xxx',
      unlocked: true,
    })

    const r = await useApp.getState().redeemGameCode(CODE)

    expect(r.ok).toBe(true)
    expect(r.message).toBe('兑换成功')
    expect(r.gameId).toBeUndefined()
    expect(await codeRows()).toHaveLength(0)
  })
})
