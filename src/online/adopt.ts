import {
  clearGameCoinMirrors,
  db,
  getMeta,
  setMeta,
} from '../db/db'
import { SRV_REDEEM_RECORD_PREFIX, SRV_WISH_ORDER_PREFIX } from '../sync/map'

/* ============================================================
   在线版 · 换账号时的本地清理（2026-11-03）
   ------------------------------------------------------------
   问题：在线版的读路径是「服务端 → Dexie → UI」。换一个人登录时，
   **在他第一次拉取完成之前**，界面读到的还是上一个人的行 ——
   任务列表、积分流水、兑换记录、心愿单，全都还在。
   这不是「闪一下」的问题：拉取失败（没网）时它就一直是那个人的数据。

   ## 为什么不用 `settings.owner`

   那个 key 管的是**设置**（`online/settings.ts`）：发现换人就整份重置。
   如果这里也去写它，`pullSettings` 会以为「刚才是同一个账号」，
   于是把上一个人的 PIN / 昵称推到新账号上。**两件事必须各用一个 key。**

   ## 只清「云端镜像」，不碰本地行

   ★ 本地版和在线版共用同一套表、同一个包名（`com.kidquestfarm.app`）。
     这里要是 `clear()` 整张表，切回本地版时孩子的数据就没了，
     而界面上什么都看不出来。所以：
       - 带 `srv_` 前缀的行 ⇒ 删（它们只可能来自服务端）
       - `redeemItems` / `wishOffers` ⇒ 整张清（主键是服务端给的字符串，
         分不出前缀；而在线版里这两张表**只可能**有云端数据）
       - `gameKv` 的 `__coin` 镜像 ⇒ 删（余额是上一个人的）
       - 其余（本地任务、本地积分、农场、设置）⇒ 一行不动
   ============================================================ */

/** 记「当前本地缓存是谁的」。和 `settings.owner` 是两个 key，别合并。 */
export const DATA_OWNER_KEY = 'data.owner'

const SRV_TABLES = [
  { table: 'tasks', prefix: 'srv_task_' },
  { table: 'taskInstances', prefix: 'srv_inst_' },
  { table: 'ledger', prefix: 'srv_ledger_' },
  { table: 'harvestLedger', prefix: 'srv_ledger_' },
  { table: 'redeemRecords', prefix: SRV_REDEEM_RECORD_PREFIX },
  { table: 'wishOrders', prefix: SRV_WISH_ORDER_PREFIX },
] as const

async function clearSrv(table: (typeof SRV_TABLES)[number]['table'], prefix: string) {
  const t = db[table]
  const keys = await t
    .filter((row: { id: string }) => typeof row.id === 'string' && row.id.startsWith(prefix))
    .primaryKeys()
  if (keys.length) await t.bulkDelete(keys as string[])
}

/**
 * 清掉「上一个人的云端镜像」。返回删了多少行（便于断言和日志）。
 *
 * 只清镜像、不动本地行 —— 理由见文件头。这个函数是**幂等**的。
 */
export async function clearCloudMirrors(): Promise<number> {
  let n = 0
  for (const { table, prefix } of SRV_TABLES) {
    const before = await db[table].count()
    await clearSrv(table, prefix)
    n += before - (await db[table].count())
  }
  /* 这两张表整张清：主键是服务端给的字符串，没有前缀可分辨，
     而在线版里它们只可能有云端数据（播种在在线模式下不写）。 */
  n += await db.redeemItems.count()
  await db.redeemItems.clear()
  n += await db.wishOffers.count()
  await db.wishOffers.clear()
  n += await clearGameCoinMirrors()
  return n
}

export type AdoptResult = 'same' | 'first' | 'switched' | 'anonymous'

/**
 * 认领这台设备的本地缓存（登录成功 / 每次拉取之前都调一次）。
 *
 * - `same`      同一个账号，什么都不做
 * - `first`     这台设备第一次登录：没有「上一个人」，不清（本地版的存档要留着）
 * - `switched`  **换人了**：先清云端镜像，再记新 uid
 * - `anonymous` 没登录：不动（登录闸门盖着，界面上看不到数据）
 *
 * ★ 返回 `switched` 的调用方可以据此决定「要不要提示一下」。
 */
export async function adoptAccount(uid: number | null): Promise<AdoptResult> {
  if (uid === null || !Number.isFinite(uid)) return 'anonymous'
  const owner = await getMeta<number | null>(DATA_OWNER_KEY, null)
  if (owner === uid) return 'same'
  if (owner === null) {
    await setMeta(DATA_OWNER_KEY, uid)
    return 'first'
  }
  await clearCloudMirrors()
  await setMeta(DATA_OWNER_KEY, uid)
  return 'switched'
}
