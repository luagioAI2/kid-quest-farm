import { describe, expect, it } from 'vitest'
import { DEFAULT_OWNED_IDS, ownedIdsOnline, ownedSetFor } from './ownership'
import { GAME_FARM } from '../games/ids'

/**
 * 这一组测的是**口径**，不是实现细节。
 *
 * 背景：在线版的存档是写穿的，服务端 `checkGameExists` 要 `user_game` 有行。
 * 界面说「已拥有」而服务端没有那行 ⇒ 存档一个字节都存不上（`10040401`），
 * 且**不报错**。所以「已拥有」的判据必须和服务端那份名单同源。
 */
describe('ownedIdsOnline：在线版的「已拥有」', () => {
  it('★ 服务端名单就是全部（再加上注册表默认拥有）', () => {
    expect(ownedIdsOnline(['cloudfarm', 'sugar'])).toEqual(
      expect.arrayContaining(['cloudfarm', 'sugar', GAME_FARM]),
    )
  })

  it('★★ 农场不在服务端目录里，也必须算拥有', () => {
    /* 服务端 21 款游戏全是插件，没有 `farm` 这一行。
       只看服务端名单的话，`switchGame('farm')` 会被拦掉 —— 首页打不开。 */
    expect(DEFAULT_OWNED_IDS).toContain(GAME_FARM)
    expect(ownedIdsOnline([])).toContain(GAME_FARM)
  })

  it('还没拉到（null）⇒ 返回 null，别当成「一个都没有」', () => {
    expect(ownedIdsOnline(null)).toBeNull()
  })

  it('服务端名单里的重复 id 不会让结果变长', () => {
    expect(ownedIdsOnline([GAME_FARM, 'cloudfarm', 'cloudfarm'])).toHaveLength(2)
  })
})

describe('ownedSetFor：两种模式的口径差别', () => {
  const installed = { ropeland: { id: 'ropeland' } }
  const orders = [{ status: 'done', openedGameId: 'sugar' }]

  it('★★ 在线版：本地装了包**不算**拥有（否则存档存不上还不报错）', () => {
    const s = ownedSetFor(true, ['cloudfarm'], installed, orders)
    expect(s.has('cloudfarm')).toBe(true)
    expect(s.has('ropeland')).toBe(false)
  })

  it('★ 在线版：心愿单兑换到手过也不算 —— 服务端有行才算', () => {
    expect(ownedSetFor(true, [], {}, orders).has('sugar')).toBe(false)
  })

  it('本地版：三个来源合并（行为不变）', () => {
    const s = ownedSetFor(false, ['cloudfarm'], installed, orders)
    expect([...s].sort()).toEqual(['cloudfarm', 'ropeland', 'sugar'])
  })
})
