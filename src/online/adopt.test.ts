import { beforeEach, describe, expect, it } from 'vitest'
import { db, getMeta, setMeta, type GameKvRow } from '../db/db'
import type {
  HarvestEntry,
  LedgerEntry,
  RedeemItem,
  RedeemRecord,
  Task,
  TaskInstance,
  WishOffer,
  WishOrder,
} from '../domain/types'
import { adoptAccount, clearCloudMirrors, DATA_OWNER_KEY } from './adopt'

/* ============================================================
   换账号清理的回归测试
   ------------------------------------------------------------
   这条规则值得单独测：**清多了**会删掉本地版的存档（切回本地版孩子
   的数据没了，界面上看不出来），**清少了**会让下一个人在断网时看到
   上一个人的任务 / 流水 / 心愿单（隐私 + 会照着别人的任务去做）。

   造行只为验证「哪些行会被删」，字段内容与断言无关，
   所以这里只给 id —— 用 `as unknown as X` 让 Dexie 收下。
   ============================================================ */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

const seed = {
  srvTask: (n: number) => db.tasks.put({ id: `srv_task_${n}` } as unknown as Task),
  localTask: (n: number) => db.tasks.put({ id: `task_${n}` } as unknown as Task),
  srvInst: (n: number) =>
    db.taskInstances.put({ id: `srv_inst_${n}` } as unknown as TaskInstance),
  srvLedger: (n: number) => db.ledger.put({ id: `srv_ledger_${n}` } as unknown as LedgerEntry),
  localLedger: (n: number) => db.ledger.put({ id: `ledger_${n}` } as unknown as LedgerEntry),
  srvHarvest: (n: number) =>
    db.harvestLedger.put({ id: `srv_ledger_${n}` } as unknown as HarvestEntry),
  redeemItem: (id: string) => db.redeemItems.put({ id } as unknown as RedeemItem),
  redeemRec: (n: number) =>
    db.redeemRecords.put({ id: `srv_rr_${n}` } as unknown as RedeemRecord),
  wishOffer: (id: string) => db.wishOffers.put({ itemId: id } as unknown as WishOffer),
  wishOrder: (n: number) => db.wishOrders.put({ id: `srv_wo_${n}` } as unknown as WishOrder),
  coinMirror: (gameId: string) =>
    db.gameKv.put({ key: `${gameId}:__coin`, value: 99 } as unknown as GameKvRow),
}

/** 造一份「上一个人的缓存」：云端镜像 + 本地行混在一起 */
async function seedPreviousAccount() {
  await seed.srvTask(1)
  await seed.localTask(9)
  await seed.srvInst(1)
  await seed.srvLedger(1)
  await seed.localLedger(9)
  await seed.srvHarvest(1)
  await seed.redeemItem('item-a')
  await seed.redeemRec(1)
  await seed.wishOffer('item-a')
  await seed.wishOrder(1)
  await seed.coinMirror('cloudfarm')
  await setMeta(DATA_OWNER_KEY, 3) // 上一个人是 uid=3
}

describe('adoptAccount', () => {
  it('没登录：什么都不动', async () => {
    await seedPreviousAccount()
    expect(await adoptAccount(null)).toBe('anonymous')
    expect(await db.tasks.count()).toBe(2)
    expect(await getMeta(DATA_OWNER_KEY, 0)).toBe(3)
  })

  it('同一个账号：不重复清（每次拉取都会走这里）', async () => {
    await seedPreviousAccount()
    expect(await adoptAccount(3)).toBe('same')
    expect(await db.tasks.count()).toBe(2)
    expect(await db.redeemItems.count()).toBe(1)
  })

  it('这台设备第一次登录：不清 —— 本地版的存档要留着', async () => {
    // 没有 owner，但有本地行（从本地版升级上来的人就是这样）
    await seed.localTask(9)
    await seed.localLedger(9)
    expect(await adoptAccount(7)).toBe('first')
    expect(await db.tasks.count()).toBe(1)
    expect(await db.ledger.count()).toBe(1)
    expect(await getMeta(DATA_OWNER_KEY, 0)).toBe(7)
  })

  it('换人了：云端镜像清干净，本地行一行不动', async () => {
    await seedPreviousAccount()
    expect(await adoptAccount(7)).toBe('switched')

    // 带 srv_ 前缀的全没了（本地行 task_9 留下，见下一条用例）
    expect((await db.tasks.toArray()).map((r) => r.id)).toEqual(['task_9'])
    expect(await db.taskInstances.count()).toBe(0)
    expect(await db.harvestLedger.count()).toBe(0)
    expect(await db.redeemRecords.count()).toBe(0)
    expect(await db.wishOrders.count()).toBe(0)

    // 主键是服务端字符串的两张表：整张清
    expect(await db.redeemItems.count()).toBe(0)
    expect(await db.wishOffers.count()).toBe(0)

    // 币镜像也清掉（余额是上一个人的）
    expect(await db.gameKv.count()).toBe(0)

    expect(await getMeta(DATA_OWNER_KEY, 0)).toBe(7)
  })

  it('换人时本地行（本地版存档）必须留下', async () => {
    await seedPreviousAccount()
    await adoptAccount(7)
    /* 上面那组断言里 `tasks` 恰好空了（那份数据只有 srv 行），
       所以这里单独确认「本地行还在」—— 这是最容易被写坏的一条：
       一个手滑的 `db.tasks.clear()` 会让本地版的孩子数据消失。 */
    expect(await db.tasks.get('task_9')).toBeTruthy()
    expect(await db.ledger.get('ledger_9')).toBeTruthy()
  })

  it('clearCloudMirrors 是幂等的', async () => {
    await seedPreviousAccount()
    const first = await clearCloudMirrors()
    const second = await clearCloudMirrors()
    expect(first).toBe(9) // 8 个 srv 行 + 币镜像（redeemItems/wishOffers 各 1 也算在内）
    expect(second).toBe(0)
  })
})
