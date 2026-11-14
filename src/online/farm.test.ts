import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  db,
  loadFarm,
  loadMarket,
  loadQuotaCarry,
  postHarvest,
  postLedger,
  QUOTA_CARRY_KEY,
} from '../db/db'
import {
  FARM_CLAIM_SOURCES,
  beginFarmTx,
  claimOf,
  endFarmTx,
  inFarmTx,
  parseFarmPayload,
  readFarmPayload,
  writeFarmPayload,
} from './farm'

/* ============================================================
   在线版 · 农场：payload 往返 / 账本暂存
   ------------------------------------------------------------
   这一层测的是**搬家会不会搬错**，以及**钱会不会记两遍**。
   真连服务端的那部分是 `scripts/_probe-farm-online.mjs` 的活。
   ============================================================ */

beforeEach(async () => {
  await db.delete()
  await db.open()
})

afterEach(() => {
  // 钩子是模块级状态：漏了它会影响后面的用例（而且症状是「账本莫名其妙不落库」）
  endFarmTx()
})

describe('readFarmPayload / writeFarmPayload', () => {
  it('往返一次，地块 / 动物 / 背包 / 行情 / 额度 / 统计 / 世界日 一个不丢', async () => {
    // 造一份「不像初始值」的农场，否则「写回初始值」也能蒙混过关
    const farm = await loadFarm()
    const plots = farm.plots.map((p, i) =>
      i === 0
        ? { ...p, unlocked: true, crop: { cropId: 'radish', plantedAt: 1000, harvestedCount: 2 } }
        : p,
    )
    const animals = [
      {
        id: 'an_probe',
        animalId: 'chicken',
        name: '小白',
        bornAt: 1000,
        lastFedAt: 2000,
        lastProduceAt: 3000,
        pendingProduce: 3,
        feedCount: 4,
        careCount: 5,
      },
    ]
    const market = await loadMarket()
    const quotaCarry = { 'produce-radish': 7 }

    await writeFarmPayload({
      v: 1,
      plots,
      animals,
      inventory: [{ itemId: 'produce-radish', count: 4 }],
      market: { ...market, day: market.day + 3 },
      quotaCarry,
      totals: { harvests: 11, planted: 12, sheared: 13 },
      farmDay: 9,
      savedAt: 1,
    })

    const back = await readFarmPayload()
    expect(back.plots[0].crop?.cropId).toBe('radish')
    expect(back.plots[0].crop?.harvestedCount).toBe(2)
    expect(back.animals).toHaveLength(1)
    expect(back.animals[0].name).toBe('小白')
    expect(back.animals[0].pendingProduce).toBe(3)
    expect(back.inventory).toEqual([{ itemId: 'produce-radish', count: 4 }])
    expect(back.market.day).toBe(market.day + 3)
    expect(back.quotaCarry).toEqual(quotaCarry)
    expect(back.totals).toEqual({ harvests: 11, planted: 12, sheared: 13 })
    expect(back.farmDay).toBe(9)
  })

  it('整表替换：服务端那份里没有的动物，本地也要消失', async () => {
    await db.animals.put({
      id: 'an_ghost',
      animalId: 'chicken',
      name: '幽灵鸡',
      bornAt: 1,
      lastFedAt: 1,
      lastProduceAt: 1,
      pendingProduce: 0,
      feedCount: 0,
      careCount: 0,
    })
    const p = await readFarmPayload()
    await writeFarmPayload({ ...p, animals: [] })
    expect(await db.animals.count()).toBe(0)
  })

  it('额度结转写到 `QUOTA_CARRY_KEY`（导出 / 导入也读这个 key）', async () => {
    const p = await readFarmPayload()
    await writeFarmPayload({ ...p, quotaCarry: { 'produce-egg': 2 } })
    expect(await loadQuotaCarry()).toEqual({ 'produce-egg': 2 })
    const row = await db.meta.get(QUOTA_CARRY_KEY)
    expect(row?.value).toEqual({ 'produce-egg': 2 })
  })
})

describe('parseFarmPayload', () => {
  it('空 / 坏 JSON / 缺 plots 都返回 null（调用方保留本地那份）', () => {
    expect(parseFarmPayload('')).toBeNull()
    expect(parseFarmPayload(null)).toBeNull()
    expect(parseFarmPayload('{不是 json')).toBeNull()
    expect(parseFarmPayload(JSON.stringify({ animals: [] }))).toBeNull()
    expect(parseFarmPayload(JSON.stringify({ plots: [], animals: 'x' }))).toBeNull()
  })

  it('行情丢了就用初始行情补，而不是整份丢掉', () => {
    const p = parseFarmPayload(
      JSON.stringify({ plots: [], animals: [], totals: { harvests: 1 } }),
    )
    expect(p).not.toBeNull()
    expect(p!.market.quotes.length).toBeGreaterThan(0)
    expect(p!.totals.harvests).toBe(1)
    expect(p!.totals.planted).toBe(0)
    expect(p!.farmDay).toBe(0)
    expect(p!.inventory).toEqual([])
  })
})

describe('claimOf', () => {
  it('0 元的行不发（喂鸡那条 `farm_feed` 就是 0 元备注）', () => {
    expect(claimOf({ delta: 0, source: 'farm_feed', memo: '用鸡蛋喂了小白' }, 'points')).toBeNull()
  })

  it('白名单外的来源不发 —— 否则服务端整笔拒绝，连农场状态一起存不上', () => {
    expect(claimOf({ delta: 5, source: 'task_reward', memo: 'x' }, 'points')).toBeNull()
    expect(claimOf({ delta: 5, source: 'farm_feed', memo: 'x' }, 'points')).toBeNull()
  })

  it('农场真正用到的三个来源都在白名单里，且币种跟账本表走', () => {
    for (const src of ['farm_plant', 'farm_purchase', 'farm_market']) {
      expect(FARM_CLAIM_SOURCES.has(src)).toBe(true)
    }
    expect(claimOf({ delta: -3, source: 'farm_plant', memo: '买种子' }, 'points')).toMatchObject({
      currency: 'points',
      delta: -3,
      source: 'farm_plant',
    })
    expect(claimOf({ delta: 12, source: 'farm_market', memo: '卖萝卜' }, 'coupon')).toMatchObject({
      currency: 'coupon',
      delta: 12,
    })
  })

  it('op_id 每次都不一样，且不超过服务端的 64 字符上限', () => {
    const a = claimOf({ delta: 1, source: 'farm_market', memo: 'a' }, 'coupon')!
    const b = claimOf({ delta: 1, source: 'farm_market', memo: 'b' }, 'coupon')!
    expect(a.op_id).not.toBe(b.op_id)
    expect(a.op_id.length).toBeLessThanOrEqual(64)
  })

  it('memo 截断到 120 字（服务端列宽 255，留余量）', () => {
    const c = claimOf({ delta: 1, source: 'farm_market', memo: '菜'.repeat(400) }, 'coupon')!
    expect(c.memo.length).toBe(120)
  })
})

describe('账本暂存（beginFarmTx / endFarmTx）', () => {
  it('动作期间：券**不写本地**，只攒成 claim', async () => {
    expect(inFarmTx()).toBe(false)
    beginFarmTx()
    expect(inFarmTx()).toBe(true)

    await postHarvest({ delta: 12, source: 'farm_market', memo: '卖出 3 个萝卜' })

    // ★ 这就是「一拉就双算」的根源：本地要是也记一笔，服务端那份再拉下来就是两笔
    expect(await db.harvestLedger.count()).toBe(0)

    const claims = endFarmTx()
    expect(claims).toHaveLength(1)
    expect(claims[0]).toMatchObject({ currency: 'coupon', delta: 12, source: 'farm_market' })
    expect(inFarmTx()).toBe(false)
  })

  it('动作期间：积分也不写本地（买种子 / 买动物 / 开地）', async () => {
    beginFarmTx()
    await postLedger({ delta: -8, source: 'farm_plant', memo: '买种子：小萝卜' })
    expect(await db.ledger.count()).toBe(0)
    const claims = endFarmTx()
    expect(claims[0]).toMatchObject({ currency: 'points', delta: -8, source: 'farm_plant' })
  })

  it('0 元的备注行照常落本地（喂鸡那条不该凭空消失）', async () => {
    beginFarmTx()
    await postLedger({ delta: 0, source: 'farm_feed', memo: '用鸡蛋喂了小白' })
    expect(await db.ledger.count()).toBe(1)
    expect(endFarmTx()).toHaveLength(0)
  })

  it('嵌套动作共用一次提交（harvest 里调 sellProduce 不会提交两遍）', async () => {
    beginFarmTx()
    beginFarmTx()
    await postHarvest({ delta: 5, source: 'farm_market', memo: 'a' })
    expect(endFarmTx()).toHaveLength(0) // 内层结束，还没轮到提交
    const claims = endFarmTx() // 外层结束
    expect(claims).toHaveLength(1)
  })

  it('结束之后钩子摘掉，账本恢复写本地', async () => {
    beginFarmTx()
    endFarmTx()
    await postHarvest({ delta: 3, source: 'farm_market', memo: 'b' })
    expect(await db.harvestLedger.count()).toBe(1)
  })
})
