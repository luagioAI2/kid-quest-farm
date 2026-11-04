import { beforeEach, describe, expect, it } from 'vitest'
import { db, postHarvest, postMall } from '../db/db'
import { useApp } from './useApp'
import { blindBoxRemaining, redeemedGameIdsFrom } from '../domain/wish'
import { WISH_BLINDBOX5_ID, WISH_BLINDBOX_POOL } from '../games/wishCatalog'

/* ============================================================
   「5 连开」盲盒 —— 一次解锁 5 款，已经解锁的不计算
   ------------------------------------------------------------
   四件必须同时成立的事，少一件都是**静默错误**：

     ① 开出的 5 款都**不在**已拥有里（「已解锁的不计算」）；
     ② 剩余不足 5 款时**整单拒绝**，一分券都不扣 ——
        不能「有几款给几款」：卖的是 5 款的价；
     ③ 装包失败要整单退回（券退、单子取消）；
     ④ 开出来的 5 款都算「兑换过」—— 只记第一个的话，另外 4 款会
        被放回池子，同一批游戏能被反复开出来，而且不报错。

   为什么单独一个文件：这几条都跨了 store 事务 + 装包两步，
   塞进 `useApp.test.ts` 那个 4000 行的文件里会被埋掉。
   ============================================================ */

/** 把某个游戏标成「已拥有」。拥有关系只看 mallLedger 的支出行 */
async function own(gid: string) {
  await postMall({ delta: -1, source: 'game_purchase', refId: gid, memo: `买 ${gid}` })
}

/** 装包在 jsdom 里做不了 —— 直接桩掉，测的是 store 的编排而不是插件宿主 */
function stubInstall(ok = true) {
  const installed: string[] = []
  useApp.setState({
    installLocalGame: async (id: string) => {
      installed.push(id)
      return ok ? { ok: true, message: '' } : { ok: false, message: '下载超时' }
    },
  })
  return installed
}

/**
 * 和 `wishRedeem` 内部**同一套**「已拥有」口径。
 *
 * ⚠️ 不能只看 `ownedGameIds`：心愿兑换不写钻石账本，兑换到手的游戏是靠
 *    `redeemedGameIdsFrom(wishOrders)` 补进来的（见那边注释）。
 *    只查 `ownedGameIds` 会得出「换到的游戏等于没换」的错误结论。
 */
function ownedSet(): Set<string> {
  const s = useApp.getState()
  return new Set<string>([
    ...s.ownedGameIds,
    ...Object.keys(s.installedGames),
    ...redeemedGameIdsFrom(s.wishOrders),
  ])
}

describe('5 连开盲盒', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await useApp.getState().boot()
    await postHarvest({ delta: 1000, source: 'farm_harvest', memo: '测试注入' })
    await useApp.getState().refresh()
    await useApp.getState().wishSetOffer(WISH_BLINDBOX5_ID, 50)
  })

  it('★ 一次开出 5 款，全部是「还没解锁」的（已解锁的不占名额）', async () => {
    const installed = stubInstall()

    // 先解锁 3 款：这 3 款**不能**出现在结果里，也不能占掉 5 个名额
    const already = WISH_BLINDBOX_POOL.slice(0, 3)
    for (const gid of already) await own(gid)
    await useApp.getState().refresh()

    const res = await useApp.getState().wishRedeem(WISH_BLINDBOX5_ID)
    await useApp.getState().refresh()

    expect(res.ok, res.message).toBe(true)

    const order = useApp
      .getState()
      .wishOrders.find((o) => o.itemId === WISH_BLINDBOX5_ID)
    expect(order, '要建单').toBeTruthy()
    const ids = order?.openedGameIds ?? []
    expect(ids, '一次给 5 款').toHaveLength(5)
    expect(new Set(ids).size, '不许重复').toBe(5)
    for (const gid of already) {
      expect(ids, `已经解锁的 ${gid} 不该被开出来`).not.toContain(gid)
    }
    // 老字段仍然写第一个 —— 老界面只看它，不能是空
    expect(order?.openedGameId).toBe(ids[0])
    // 5 个包都要装（只装第一个 = 付了 5 份的钱拿到 1 款）
    expect(installed).toEqual(ids)
  })

  it('★ 剩余不足 5 款：整单拒绝，一分券都不扣、不建单', async () => {
    stubInstall()
    // 只剩 2 款没解锁
    const keep = WISH_BLINDBOX_POOL.slice(0, WISH_BLINDBOX_POOL.length - 2)
    for (const gid of keep) await own(gid)
    await useApp.getState().refresh()

    const before = useApp.getState().harvestBalance
    const rowsBefore = useApp.getState().harvestLedger.filter(
      (e) => e.source === 'wish_redeem',
    ).length

    const res = await useApp.getState().wishRedeem(WISH_BLINDBOX5_ID)
    await useApp.getState().refresh()

    expect(res.ok, '不够 5 款必须拒绝').toBe(false)
    expect(res.message, '要说清「不够 5 款」，不能只说「都有了」').toContain('5 款')
    expect(useApp.getState().harvestBalance, '拒绝时一分券都不许扣').toBe(before)
    expect(
      useApp.getState().harvestLedger.filter((e) => e.source === 'wish_redeem').length,
      '拒绝时不许写扣券流水',
    ).toBe(rowsBefore)
    expect(
      useApp.getState().wishOrders.filter((o) => o.itemId === WISH_BLINDBOX5_ID),
      '拒绝时不许建单',
    ).toHaveLength(0)
  })

  it('★ 装包失败要整单退回：单子取消、券退回原样', async () => {
    stubInstall(false)

    const res = await useApp.getState().wishRedeem(WISH_BLINDBOX5_ID)
    await useApp.getState().refresh()

    expect(res.ok).toBe(false)
    const order = useApp
      .getState()
      .wishOrders.find((o) => o.itemId === WISH_BLINDBOX5_ID)
    expect(order?.status, '装不上就该取消，不能挂着「已兑换」').toBe('cancelled')
    expect(useApp.getState().harvestBalance, '券要退回原样').toBe(1000)
  })

  it('★ 开出来的 5 款都算「兑换过」—— 只记第一个的话，另外 4 款会被反复开出来', async () => {
    stubInstall()
    const poolSize = WISH_BLINDBOX_POOL.length
    expect(blindBoxRemaining(WISH_BLINDBOX_POOL, [...ownedSet()])).toHaveLength(poolSize)

    await useApp.getState().wishRedeem(WISH_BLINDBOX5_ID)
    await useApp.getState().refresh()

    const order = useApp
      .getState()
      .wishOrders.find((o) => o.itemId === WISH_BLINDBOX5_ID)!
    const ids = order.openedGameIds ?? []
    expect(ids).toHaveLength(5)

    // ★ 判据：池子里少掉的是 **5 个**，不是 1 个
    expect(
      blindBoxRemaining(WISH_BLINDBOX_POOL, [...ownedSet()]),
      '5 款都要算已解锁，否则下次还能开出同一批',
    ).toHaveLength(poolSize - 5)

    /* 取消 = 撤销交易：券退回，游戏也收回（`redeemedGameIdsFrom` 不再算它们），
       池子回到满 —— 这是**对的**，不是「白拿」。真正的坑是取消之后游戏
       还装着 / 还占着已解锁名额。 */
    await useApp.getState().wishCancel(order.id, '不要了')
    await useApp.getState().refresh()
    expect(
      blindBoxRemaining(WISH_BLINDBOX_POOL, [...ownedSet()]),
      '取消后 5 款都要还回池子',
    ).toHaveLength(poolSize)
  })
})
