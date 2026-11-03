import { walletImport } from '../api/wallet'
import { db, getMeta, setMeta } from '../db/db'
import { uid } from '../domain/recurrence'
import { getToken } from '../api/session'

/* ============================================================
   在线版 · 把「本地版留下的旧账」结转进账号（2026-11-03）
   ------------------------------------------------------------
   本地版和在线版共用同一个包名、同一套表。从本地版升级上来的设备，
   `ledger` / `harvestLedger` 里还留着旧行；而在线版的余额是**整表求和**
   （`currentBalance` / `currentHarvestBalance`，不过滤 `srv_` 行）
   ⇒ 界面显示「服务端 + 本机旧账」。

   实测（2026-11-03，测试账号）：服务端 `points=219`，往本机插一行旧账
   `+1000` 之后界面显示 **1219**，重开 App 还是 1219。孩子看到 1219 分，
   兑换时被服务端拒掉，而且只说「积分不够」—— 这是四层验收全绿也看不见的一类。

   所以首次登录时把这份旧账**搬到云端**，然后删掉本机那几行：
   两边只剩一个事实（服务端那份），界面自然就对上了。

   ## 为什么只搬「余额」不搬流水

   逐条搬等于让两边各持一套「同一个事实」的账：任何一次重试都可能多记一笔，
   而本地流水里的 `refId`（任务实例 / 农场对象）在服务端根本不存在。
   所以每种币最多写一行「从本地版结转」，备注里带笔数。

   ## 为什么幂等键里带载荷

   同一份载荷重试 ⇒ 命中同一把键，服务端只记一次；
   载荷变了（比如上次只搬了积分）⇒ 另一把键，把差额补上。
   ============================================================ */

const DONE_KEY = 'legacy.importedAt'
const PENDING_KEY = 'legacy.importPending'
const INSTALL_KEY = 'legacy.installId'

/** 云端镜像行（`srv_` 开头）不算旧账 —— 它们本来就是服务端的 */
export function isCloudRow(id: string): boolean {
  return id.startsWith('srv_')
}

export interface LegacyTotals {
  points: number
  coupons: number
  /** 要删掉的行 id —— 精确到行，不按「整表非 srv_」删（见 `dropRows`） */
  ledgerIds: string[]
  harvestIds: string[]
}

/**
 * 数一下本机有多少「不是云端来的」旧账。
 *
 * 三套币里只有积分和兑换券有云端镜像（`srv_ledger_` 前缀），
 * 钻石（`mallLedger`）在在线版里**根本没上云** —— 见 `mintMall` 的注释。
 * 所以这里只管两种：搬一个界面上看不见的余额没有意义。
 */
export async function collectLegacy(): Promise<LegacyTotals> {
  const [ledger, harvest] = await Promise.all([db.ledger.toArray(), db.harvestLedger.toArray()])
  const localLedger = ledger.filter((r) => !isCloudRow(r.id))
  const localHarvest = harvest.filter((r) => !isCloudRow(r.id))
  return {
    points: localLedger.reduce((s, r) => s + r.delta, 0),
    coupons: localHarvest.reduce((s, r) => s + r.delta, 0),
    ledgerIds: localLedger.map((r) => r.id),
    harvestIds: localHarvest.map((r) => r.id),
  }
}

/**
 * 删掉**刚才数过的那几行**。
 *
 * ★ 不按「整表里所有非 `srv_` 行」删：那会把结转期间新写进来的行一起带走，
 *   而它没被算进这次载荷 —— 孩子那一下就白干了。按 id 快照删才准。
 */
async function dropRows(t: LegacyTotals): Promise<number> {
  let n = 0
  if (t.ledgerIds.length) {
    await db.ledger.bulkDelete(t.ledgerIds)
    n += t.ledgerIds.length
  }
  if (t.harvestIds.length) {
    await db.harvestLedger.bulkDelete(t.harvestIds)
    n += t.harvestIds.length
  }
  return n
}

export type LegacyImportResult = 'none' | 'imported' | 'already' | 'failed'

/**
 * 需要的话，把本机旧账结转上去。**不抛**。
 *
 * @param firstLogin 这台设备是不是第一次登录这个账号（`adoptAccount` 的 `first`）。
 *   不是第一次也行 —— 上一次失败过（`legacy.importPending`）就会重试，
 *   否则断网那一次没搬成，就永远搬不成了。
 */
export async function importLegacyIfNeeded(firstLogin: boolean): Promise<LegacyImportResult> {
  /* 没登录不搬：本地版根本没有账号，这条链路只属于在线版 */
  if (!getToken()) return 'none'
  /* 搬过就不再查库 —— 这个方法每次刷新都会被调到 */
  if (await getMeta<number>(DONE_KEY, 0)) return 'none'
  if (!firstLogin && !(await getMeta<boolean>(PENDING_KEY, false))) return 'none'

  const totals = await collectLegacy()
  /* 负数（本地版花超了）不搬：服务端不接受负的结转，搬上去等于凭空扣钱 */
  const points = Math.max(0, totals.points)
  const coupons = Math.max(0, totals.coupons)
  if (points === 0 && coupons === 0) {
    await setMeta(DONE_KEY, Date.now())
    return 'none'
  }

  let installId = await getMeta<string>(INSTALL_KEY, '')
  if (!installId) {
    installId = uid('ins')
    await setMeta(INSTALL_KEY, installId)
  }

  try {
    const r = await walletImport({
      key: `${installId}:${points}:${coupons}`,
      points,
      coupons,
      counts: { points: totals.ledgerIds.length, coupons: totals.harvestIds.length },
    })
    const dropped = await dropRows(totals)
    await setMeta(DONE_KEY, Date.now())
    await setMeta(PENDING_KEY, false)
    console.info(`[sync] 本机旧账已结转：积分 ${points} / 兑换券 ${coupons}，删掉本机 ${dropped} 行`)
    return r.imported ? 'imported' : 'already'
  } catch (e) {
    /* 失败**不删本机行**：删了就真丢了。下次刷新再试（PENDING 会留到成功为止） */
    await setMeta(PENDING_KEY, true)
    console.warn('[sync] 本机旧账没结转成功，下次再试：', (e as { message?: string })?.message)
    return 'failed'
  }
}
