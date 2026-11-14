import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { db, getGameKv, listGameKv, setGameKv } from '../db/db'
import {
  deleteGameKvOnServer,
  dropKvVersions,
  kvFailToast,
  kvVersionOf,
  oKvGet,
  oKvList,
  oKvSet,
  pullGameKv,
  resetKvState,
  seedKvVersions,
} from './kv'

/* ============================================================
   在线版 · 插件存档
   ------------------------------------------------------------
   这一层错了都**不报错**：
     · 不带 `expected_version` ⇒ 多设备「后写的静默覆盖先写的」；
     · 写失败还写本地 ⇒ 本地有、云端没有，换台设备就丢；
     · 拉取不看版本 ⇒ 并发时用**旧快照**把刚存的进度盖回去；
     · 两个 set 并发 ⇒ 第二个带旧版本，必然冲突（或者干脆不带版本）。

   真连服务端是 `scripts/_probe-kv-online.mjs` 的活。
   ============================================================ */

const getMock = vi.fn()
const setMock = vi.fn()
const listMock = vi.fn()
const delMock = vi.fn()

vi.mock('../api/gameKv', () => ({
  gameKvGet: (g: string, k: string) => getMock(g, k),
  gameKvSet: (g: string, k: string, v: unknown, ver: number) => setMock(g, k, v, ver),
  gameKvList: (g: string) => listMock(g),
  gameKvDelete: (g: string, k?: string) => delMock(g, k),
  gameKvUsage: () => Promise.resolve({ total_bytes: 0, max_bytes: 1 }),
}))

const GAME = 'cloudfarm'

beforeEach(async () => {
  await db.gameKv.clear()
  resetKvState()
  for (const m of [getMock, setMock, listMock, delMock]) m.mockReset()
})

describe('oKvSet：写穿 + 版本', () => {
  it('带上缓存里的版本；成功后更新版本并写本地', async () => {
    seedKvVersions(GAME, { save: 3 })
    setMock.mockResolvedValue({ key: 'save', version: 4 })

    await oKvSet(GAME, 'save', { level: 5 })

    expect(setMock).toHaveBeenCalledWith(GAME, 'save', { level: 5 }, 3)
    expect(kvVersionOf(GAME, 'save')).toBe(4)
    expect(await getGameKv(GAME, 'save')).toEqual({ level: 5 })
  })

  it('★ 没有版本时发 0（服务端按「不加锁」处理），不是 undefined', async () => {
    setMock.mockResolvedValue({ key: 'save', version: 1 })
    await oKvSet(GAME, 'save', { a: 1 })
    expect(setMock).toHaveBeenCalledWith(GAME, 'save', { a: 1 }, 0)
  })

  it('★ 失败时**一个字节都不写本地**（本地有、云端没有 = 换设备就丢）', async () => {
    setMock.mockRejectedValue(new ApiError(-1, '连不上'))
    await expect(oKvSet(GAME, 'save', { a: 1 })).rejects.toBeInstanceOf(ApiError)
    expect(await getGameKv(GAME, 'save')).toBeUndefined()
  })

  it('★ 版本冲突：重读版本再写一次，第二次带的是**服务端那个版本**', async () => {
    seedKvVersions(GAME, { save: 3 })
    setMock
      .mockRejectedValueOnce(new ApiError(10040701, '存档版本冲突'))
      .mockResolvedValueOnce({ key: 'save', version: 9 })
    getMock.mockResolvedValue({ key: 'save', value: { other: true }, version: 8, exists: true })

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await oKvSet(GAME, 'save', { mine: true })
    warn.mockRestore()

    expect(getMock).toHaveBeenCalledWith(GAME, 'save')
    expect(setMock).toHaveBeenNthCalledWith(1, GAME, 'save', { mine: true }, 3)
    expect(setMock).toHaveBeenNthCalledWith(2, GAME, 'save', { mine: true }, 8)
    // **以本机为准**：写进去的是自己那份，不是服务端读回来的
    expect(await getGameKv(GAME, 'save')).toEqual({ mine: true })
    expect(kvVersionOf(GAME, 'save')).toBe(9)
  })

  it('★ 冲突只重试一次：再撞就抛（两台在抢同一个键，重试也解决不了）', async () => {
    setMock.mockRejectedValue(new ApiError(10040701, '存档版本冲突'))
    getMock.mockResolvedValue({ key: 'save', value: null, version: 8, exists: true })
    await expect(oKvSet(GAME, 'save', { a: 1 })).rejects.toBeInstanceOf(ApiError)
    expect(setMock).toHaveBeenCalledTimes(2)
    expect(await getGameKv(GAME, 'save')).toBeUndefined()
  })

  it('★ 同一个键的写**串行**：第二个带的是第一个写回来的版本', async () => {
    let release: (v: { key: string; version: number }) => void = () => {}
    setMock
      .mockImplementationOnce(
        () =>
          new Promise<{ key: string; version: number }>((res) => {
            release = res
          }),
      )
      .mockResolvedValueOnce({ key: 'save', version: 7 })

    const p1 = oKvSet(GAME, 'save', { n: 1 })
    const p2 = oKvSet(GAME, 'save', { n: 2 })
    // 第一个还挂着，第二个**不许**发出去（否则两个都带版本 0）
    await Promise.resolve()
    expect(setMock).toHaveBeenCalledTimes(1)

    release({ key: 'save', version: 6 })
    await Promise.all([p1, p2])
    expect(setMock).toHaveBeenNthCalledWith(2, GAME, 'save', { n: 2 }, 6)
  })

  it('★ 前一个失败不能把这条键的写链卡死', async () => {
    setMock.mockRejectedValueOnce(new ApiError(-1, '连不上'))
    await expect(oKvSet(GAME, 'save', { n: 1 })).rejects.toBeInstanceOf(ApiError)

    setMock.mockResolvedValueOnce({ key: 'save', version: 1 })
    await oKvSet(GAME, 'save', { n: 2 })
    expect(await getGameKv(GAME, 'save')).toEqual({ n: 2 })
  })
})

describe('oKvGet / oKvList：读 Dexie', () => {
  it('get 读本地镜像（不现问服务端）', async () => {
    await setGameKv(GAME, 'save', { level: 3 })
    expect(await oKvGet(GAME, 'save')).toEqual({ level: 3 })
    expect(getMock).not.toHaveBeenCalled()
  })

  it('list 滤掉 `__` 保留键（和本地 storage.list 一致）', async () => {
    await setGameKv(GAME, 'save', 1)
    await setGameKv(GAME, 'bag', 2)
    await setGameKv(GAME, '__bundle', 'code')
    expect(await oKvList(GAME)).toEqual({ save: 1, bag: 2 })
  })

  it('没存过返回 undefined（不是抛）', async () => {
    expect(await oKvGet(GAME, 'nope')).toBeUndefined()
  })
})

describe('pullGameKv', () => {
  it('把服务端的键搬进来，版本一起种上', async () => {
    listMock.mockResolvedValue({
      game_id: GAME,
      data: { save: { level: 5 }, bag: [1] },
      versions: { save: 3, bag: 1 },
      count: 2,
    })
    const r = await pullGameKv(GAME)
    expect(r).toEqual({ written: 2, skipped: 0, removed: 0 })
    expect(await getGameKv(GAME, 'save')).toEqual({ level: 5 })
    expect(kvVersionOf(GAME, 'save')).toBe(3)
  })

  it('★ 服务端已经没有的键要删掉（否则插件 list 会看到幽灵键）', async () => {
    await setGameKv(GAME, 'gone', 1)
    await setGameKv(GAME, 'save', 2)
    listMock.mockResolvedValue({
      game_id: GAME,
      data: { save: 2 },
      versions: { save: 1 },
      count: 1,
    })
    const r = await pullGameKv(GAME)
    expect(r.removed).toBe(1)
    expect(await getGameKv(GAME, 'gone')).toBeUndefined()
    expect(await getGameKv(GAME, 'save')).toBe(2)
  })

  it('★ 保留键一个都不碰（`__bundle` / `__assets` / `__coin`）', async () => {
    await setGameKv(GAME, '__bundle', 'code')
    await setGameKv(GAME, '__coin', [{ delta: 5, memo: 'x', at: 1 }])
    listMock.mockResolvedValue({ game_id: GAME, data: {}, versions: {}, count: 0 })
    await pullGameKv(GAME)
    expect(await getGameKv(GAME, '__bundle')).toBe('code')
    expect(await getGameKv(GAME, '__coin')).toEqual([{ delta: 5, memo: 'x', at: 1 }])
  })

  it('★ 服务端版本比本地旧 ⇒ 跳过（并发时不许用旧快照盖掉刚存的进度）', async () => {
    seedKvVersions(GAME, { save: 9 })
    listMock.mockResolvedValue({
      game_id: GAME,
      data: { save: { stale: true } },
      versions: { save: 8 },
      count: 1,
    })
    const r = await pullGameKv(GAME)
    expect(r.skipped).toBe(1)
    expect(r.written).toBe(0)
    expect(await getGameKv(GAME, 'save')).toBeUndefined()
  })

  it('★ 拉取失败时本地一个字都不动', async () => {
    await setGameKv(GAME, 'save', { mine: true })
    listMock.mockRejectedValue(new ApiError(10040401, '未拥有'))
    await expect(pullGameKv(GAME)).rejects.toBeInstanceOf(ApiError)
    expect(await getGameKv(GAME, 'save')).toEqual({ mine: true })
  })

  it('空存档（从没玩过）也照常返回 0，不报错', async () => {
    listMock.mockResolvedValue({ game_id: GAME, data: null, versions: null, count: 0 })
    expect(await pullGameKv(GAME)).toEqual({ written: 0, skipped: 0, removed: 0 })
  })
})

describe('deleteGameKvOnServer', () => {
  it('删成功 → ok，并且把版本清掉', async () => {
    seedKvVersions(GAME, { save: 3 })
    delMock.mockResolvedValue({ deleted_keys: 1 })
    expect(await deleteGameKvOnServer(GAME)).toBe('ok')
    expect(delMock).toHaveBeenCalledWith(GAME, undefined)
    expect(kvVersionOf(GAME, 'save')).toBeUndefined()
  })

  it('★ 没拥有 / 服务端没这款游戏 ⇒ `no-game`（当作删掉了）', async () => {
    delMock.mockRejectedValue(new ApiError(10040401, '未拥有'))
    expect(await deleteGameKvOnServer(GAME)).toBe('no-game')
    delMock.mockRejectedValue(new ApiError(10040101, '游戏不存在'))
    expect(await deleteGameKvOnServer(GAME)).toBe('no-game')
  })

  it('★ 断网 ⇒ `failed`（调用方据此**不清本地**，否则重装会捡到旧存档）', async () => {
    delMock.mockRejectedValue(new ApiError(-1, '连不上'))
    expect(await deleteGameKvOnServer(GAME)).toBe('failed')
  })
})

describe('dropKvVersions', () => {
  it('只丢这款游戏的版本，别人的还在', () => {
    seedKvVersions(GAME, { save: 3 })
    seedKvVersions('other', { save: 7 })
    dropKvVersions(GAME)
    expect(kvVersionOf(GAME, 'save')).toBeUndefined()
    expect(kvVersionOf('other', 'save')).toBe(7)
  })
})

describe('kvFailToast', () => {
  it('四种业务码各有一句人话', () => {
    expect(kvFailToast(new ApiError(10040701, 'x')).title).toBe('存档在别的设备上改过')
    expect(kvFailToast(new ApiError(10040401, 'x')).title).toBe('这个游戏还没兑换过')
    expect(kvFailToast(new ApiError(10040201, 'x')).title).toBe('这个游戏下架了')
    expect(kvFailToast(new ApiError(10040601, 'x')).title).toBe('存档太大了')
  })

  it('★ 断网时说清「这一局的存档」没发出去', () => {
    const t = kvFailToast(new ApiError(-1, '连不上'))
    expect(t.title).toContain('存档')
    expect(t.detail).toContain('没有生效')
  })
})

describe('listGameKv 的口径', () => {
  it('本地读出来的键名不带 `<gameId>:` 前缀（和插件看到的一致）', async () => {
    await setGameKv(GAME, 'save', 1)
    const all = await listGameKv(GAME)
    expect(Object.keys(all)).toEqual(['save'])
  })
})
