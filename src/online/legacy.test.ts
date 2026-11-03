import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, getMeta, setMeta } from '../db/db'
import { collectLegacy, importLegacyIfNeeded, isCloudRow } from './legacy'

/* ============================================================
   在线版 · 把本地版留下的旧账结转上去
   ------------------------------------------------------------
   回归的是「界面余额 = 服务端 + 本机旧账」：实测服务端 219、界面 1219，
   重开还是 1219；孩子看到 1219 分，兑换时被服务端拒掉。

   这一层的错法全都不报错：
     ① 只搬不删 ⇒ 界面还是「服务端 + 本机」，白搬；
     ② 搬失败也删 ⇒ 孩子的分**真的**没了；
     ③ 把 `srv_` 行也当旧账搬 ⇒ 每登录一次，分数翻一倍。
   ============================================================ */

const importMock = vi.fn()
vi.mock('../api/wallet', () => ({
  walletImport: (b: unknown) => importMock(b),
}))
vi.mock('../api/session', () => ({
  getToken: () => 'test-token',
}))

const DONE = 'legacy.importedAt'
const PENDING = 'legacy.importPending'

/** 造一行账本。`id` 以 `srv_` 开头就是「云端镜像」 */
const row = (id: string, delta: number) => ({
  id,
  delta,
  balanceAfter: delta,
  source: 'task' as const,
  memo: id,
  createdAt: Date.now(),
})

/** 兑换券账本的来源是另一套枚举，不能复用上面那个 */
const hrow = (id: string, delta: number) => ({
  id,
  delta,
  balanceAfter: delta,
  source: 'farm_harvest' as const,
  memo: id,
  createdAt: Date.now(),
})

beforeEach(async () => {
  await db.ledger.clear()
  await db.harvestLedger.clear()
  for (const k of [DONE, PENDING, 'legacy.installId']) await db.meta.delete(k)
  importMock.mockReset()
})

describe('collectLegacy', () => {
  it('只数非 srv_ 行 —— 云端镜像不是「旧账」', async () => {
    await db.ledger.bulkPut([row('lg_1', 700), row('lg_2', 300), row('srv_ledger_9', 219)])
    await db.harvestLedger.bulkPut([hrow('lg_h1', 4), hrow('srv_ledger_7', 2)])

    const t = await collectLegacy()
    expect(t.points).toBe(1000)
    expect(t.coupons).toBe(4)
    expect(t.ledgerIds).toEqual(['lg_1', 'lg_2'])
    expect(t.harvestIds).toEqual(['lg_h1'])
    expect(isCloudRow('srv_ledger_9')).toBe(true)
    expect(isCloudRow('lg_1')).toBe(false)
  })
})

describe('importLegacyIfNeeded', () => {
  it('搬上去之后**删掉本机旧行**（只删数过的那几行，srv_ 留着）', async () => {
    await db.ledger.bulkPut([row('lg_1', 1000), row('srv_ledger_9', 219)])
    importMock.mockResolvedValue({ imported: true, points: 1000, coupons: 0, diamonds: 0, wallet: {} })

    expect(await importLegacyIfNeeded(true)).toBe('imported')

    const body = importMock.mock.calls[0][0] as { key: string; points: number; coupons: number }
    expect(body.points).toBe(1000)
    expect(body.coupons).toBe(0)

    const left = (await db.ledger.toArray()).map((r) => r.id)
    expect(left).toEqual(['srv_ledger_9'])
    expect(await getMeta(DONE, 0)).toBeTruthy()
  })

  it('★ 失败**不删**本机行，并留下 pending 让下次重试', async () => {
    await db.ledger.bulkPut([row('lg_1', 1000)])
    importMock.mockRejectedValue(new Error('连不上'))

    expect(await importLegacyIfNeeded(true)).toBe('failed')
    expect((await db.ledger.toArray()).map((r) => r.id)).toEqual(['lg_1'])
    expect(await getMeta(PENDING, false)).toBe(true)

    /* 不是第一次登录也要重试 —— 否则断网那一次没搬成，就永远搬不成 */
    importMock.mockResolvedValue({ imported: true, points: 1000, coupons: 0, diamonds: 0, wallet: {} })
    expect(await importLegacyIfNeeded(false)).toBe('imported')
    expect(await db.ledger.toArray()).toHaveLength(0)
  })

  it('搬过一次之后不再打接口（每次刷新都会调到这个方法）', async () => {
    await db.ledger.bulkPut([row('lg_1', 1000)])
    importMock.mockResolvedValue({ imported: true, points: 1000, coupons: 0, diamonds: 0, wallet: {} })
    await importLegacyIfNeeded(true)
    expect(importMock).toHaveBeenCalledTimes(1)

    await importLegacyIfNeeded(true)
    await importLegacyIfNeeded(false)
    expect(importMock).toHaveBeenCalledTimes(1)
  })

  it('本机没有旧账 ⇒ 一个请求都不发，但记一笔「查过了」', async () => {
    await db.ledger.bulkPut([row('srv_ledger_1', 219)])
    expect(await importLegacyIfNeeded(true)).toBe('none')
    expect(importMock).not.toHaveBeenCalled()
    expect(await getMeta(DONE, 0)).toBeTruthy()
  })

  it('本机旧账是负数（花超了）⇒ 不搬，也不报错', async () => {
    await db.ledger.bulkPut([row('lg_1', -50)])
    expect(await importLegacyIfNeeded(true)).toBe('none')
    expect(importMock).not.toHaveBeenCalled()
  })

  it('不是第一次登录、也没有 pending ⇒ 不查库不请求', async () => {
    await db.ledger.bulkPut([row('lg_1', 1000)])
    expect(await importLegacyIfNeeded(false)).toBe('none')
    expect(importMock).not.toHaveBeenCalled()
  })

  it('幂等键带载荷：换了载荷就是另一把键', async () => {
    await db.ledger.bulkPut([row('lg_1', 1000)])
    importMock.mockResolvedValue({ imported: true, points: 1000, coupons: 0, diamonds: 0, wallet: {} })
    await importLegacyIfNeeded(true)
    const first = (importMock.mock.calls[0][0] as { key: string }).key

    /* 手动清掉「搬过了」的记号，模拟换一份载荷重来 */
    await setMeta(DONE, 0)
    await db.ledger.bulkPut([row('lg_2', 500)])
    await importLegacyIfNeeded(true)
    const second = (importMock.mock.calls[1][0] as { key: string }).key

    expect(first).not.toBe(second)
  })
})
