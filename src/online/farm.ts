import { ApiError, api } from '../api/client'
import { getToken } from '../api/session'
import {
  QUOTA_CARRY_KEY,
  db,
  loadFarm,
  loadMarket,
  loadQuotaCarry,
  setLedgerSink,
} from '../db/db'
import { PRODUCE_BASE_PRICE } from '../domain/catalog'
import { createInitialMarket } from '../domain/market'
import type { Animal, FarmState, InventorySlot, MarketState } from '../domain/types'
import { onlineWrite } from './write'

/* ============================================================
   在线版 · 农场（整块 JSON + 乐观锁 + 随状态提交的账本）
   ------------------------------------------------------------
   服务端（`/api/farm/state/*`）**不理解**农场的玩法：
   作物怎么长、行情怎么走、额度怎么结转，全在 `src/domain/` 里，
   那里有 1000+ 条单测守着。服务端只负责三件事：

     ① 谁的那一份（uid 隔离）
     ② 两台设备同时写不能互相吞（`rev` 乐观锁）
     ③ 农场里的钱要和服务端账本对上（随状态一起提交的 `ledger`）

   ★ 所以这里做的不是「把玩法搬上去」，而是**把本地的整块状态搬上去**：
     读 = 服务端那份覆盖本地；写 = 本地先算完，整块提交。

   ★ 账本为什么必须跟着状态一起提交（而不是单独调 `/wallet/*`）：
     「卖菜得券」是本地算出来的（行情 / 额度 / 品质都在本地）。
     拆成两次请求的话，中间断网就是「菜没了、券没到」——
     而孩子看不出是网络问题，只会说「我的券不见了」。
   ============================================================ */

/** payload 的结构版本。服务端不解析，只在客户端升级结构时用得上 */
export const FARM_PAYLOAD_VERSION = 1

export interface FarmTotals {
  harvests: number
  planted: number
  sheared: number
}

/**
 * 农场状态的**全部**持久化内容。
 *
 * 这份东西必须覆盖 `loadFarm()` / `loadMarket()` / `loadQuotaCarry()` /
 * `db.inventory` 读到的**所有**字段 —— 漏一个的症状是「换台设备某样东西
 * 回到初始值」，而且不报错。加字段时两边一起加（见 `readFarmPayload`）。
 *
 * 刻意**不含**：
 *   · `farmEvents`（农场日志）—— 它是给人看的历史，不是状态；
 *     塞进整块 blob 只会让两台设备互相覆盖对方的日志
 *   · `farm.lastEventCheck`（生病事件的检查点）—— 设备本地的节流阀
 */
export interface FarmPayload {
  v: number
  plots: FarmState['plots']
  animals: Animal[]
  inventory: InventorySlot[]
  market: MarketState
  quotaCarry: Record<string, number>
  totals: FarmTotals
  farmDay: number
  savedAt: number
}

/* ---------------- 本地 ⇄ payload ---------------- */

/** 把本地 Dexie 里的农场读成一份 payload（提交前调一次） */
export async function readFarmPayload(): Promise<FarmPayload> {
  const [farm, market, quotaCarry, inventory] = await Promise.all([
    loadFarm(),
    loadMarket(),
    loadQuotaCarry(),
    db.inventory.toArray(),
  ])
  return {
    v: FARM_PAYLOAD_VERSION,
    plots: farm.plots,
    animals: farm.animals,
    inventory,
    market,
    quotaCarry,
    totals: {
      harvests: farm.totalHarvests,
      planted: farm.totalPlanted,
      sheared: farm.totalSheared,
    },
    farmDay: farm.farmDay ?? 0,
    savedAt: Date.now(),
  }
}

/**
 * 把一份 payload 写回本地 Dexie（拉取后 / 提交失败回滚时调）。
 *
 * ★ 一个事务里写全：中途失败不能留下「地块换了、动物还是旧的」这种半截状态，
 *   那是两份互相矛盾的真相，界面上会表现成「动物站在别人的地里」。
 */
export async function writeFarmPayload(p: FarmPayload): Promise<void> {
  await db.transaction('rw', [db.meta, db.animals, db.inventory], async () => {
    await db.meta.put({ key: 'farm.plots', value: p.plots })
    await db.meta.put({ key: 'farm.totals', value: p.totals })
    await db.meta.put({ key: 'farm.day', value: p.farmDay })
    await db.meta.put({ key: 'farm.market', value: p.market })
    await db.meta.put({ key: QUOTA_CARRY_KEY, value: p.quotaCarry })
    // 动物 / 背包是整表替换：服务端那份就是全部，本地多出来的都是幽灵
    await db.animals.clear()
    if (p.animals.length) await db.animals.bulkPut(p.animals)
    await db.inventory.clear()
    if (p.inventory.length) await db.inventory.bulkPut(p.inventory)
  })
}

/**
 * 解析服务端返回的 payload。
 *
 * ★ 解析失败返回 `null`，调用方**保留本地那份**。
 *   反过来（清空 / 用默认农场）的话，一次脏数据就把孩子的农场删了，
 *   而且没有任何报错。
 */
export function parseFarmPayload(raw: string | null | undefined): FarmPayload | null {
  if (!raw) return null
  let v: Partial<FarmPayload>
  try {
    v = JSON.parse(raw) as Partial<FarmPayload>
  } catch {
    console.warn('[farm] payload 不是合法 JSON，保留本地那份')
    return null
  }
  if (!v || !Array.isArray(v.plots) || !Array.isArray(v.animals)) {
    console.warn('[farm] payload 缺 plots / animals，保留本地那份')
    return null
  }
  const market =
    v.market && Array.isArray(v.market.quotes) && v.market.quotes.length > 0
      ? v.market
      : createInitialMarket(PRODUCE_BASE_PRICE)
  return {
    v: typeof v.v === 'number' ? v.v : FARM_PAYLOAD_VERSION,
    plots: v.plots,
    animals: v.animals,
    inventory: Array.isArray(v.inventory) ? v.inventory : [],
    market,
    quotaCarry: v.quotaCarry && typeof v.quotaCarry === 'object' ? v.quotaCarry : {},
    totals: {
      harvests: Number(v.totals?.harvests) || 0,
      planted: Number(v.totals?.planted) || 0,
      sheared: Number(v.totals?.sheared) || 0,
    },
    farmDay: Number(v.farmDay) || 0,
    savedAt: Number(v.savedAt) || 0,
  }
}

/* ---------------- 服务端接口 ---------------- */

export interface FarmStateGetResp {
  empty: boolean
  rev: number
  payload: string
  updated_at: number
}

export interface FarmSaveResp {
  conflict: boolean
  rev: number
  applied: number
  balances: Record<string, number>
}

export const oFarmGet = () => api<FarmStateGetResp>('/farm/state/get', {})

export const oFarmSave = (req: {
  payload: string
  rev: number
  ledger?: FarmClaim[]
}) => api<FarmSaveResp>('/farm/state/save', req)

/**
 * 当前持有的农场版本号。
 *
 * ★ 只放内存，**不落 Dexie**：它是「我这份缓存对应服务端第几版」，
 *   重启之后必须重新 `GET` 一次才知道 —— 持久化反而会拿一个过期版本
 *   去写，服务端回 `conflict`，界面上表现成「农场永远存不上」。
 */
let farmRev = 0
export const getFarmRev = (): number => farmRev
export const setFarmRev = (rev: number): void => {
  farmRev = Number.isFinite(rev) && rev > 0 ? rev : 0
}

/* ---------------- 账本条目 ---------------- */

export type FarmCurrency = 'points' | 'coupon'

export interface FarmClaim {
  currency: FarmCurrency
  delta: number
  source: string
  memo: string
  op_id: string
}

/**
 * 服务端白名单（`tf-platform-api/internal/app/service/farm_srv.go` 的
 * `farmClaimSources`）的**镜像**。
 *
 * ★ 两边必须逐字一致。客户端这边多做一层过滤的理由：白名单外的来源发上去
 *   会被服务端整笔拒绝（`10110301`），连农场状态一起存不上 ——
 *   一个只影响流水标签的小问题，会变成「点一下收获什么都没发生」。
 */
export const FARM_CLAIM_SOURCES: ReadonlySet<string> = new Set([
  'farm_harvest',
  'animal_produce',
  'seed_purchase',
  'animal_purchase',
  'plugin_mint',
  'farm_plant',
  'farm_purchase',
  'farm_market',
])

let opSeq = 0

/**
 * 幂等键。
 *
 * 服务端拼成 `farm:<uid>:<op_id>`，同一个 key 只会入账一次 ——
 * 断网重发、用户连点都不会多给一份券。
 *
 * ★ 长度必须 ≤ 64（服务端 `binding:"max=64"`）：`fc-` + 时间戳 + 序号 + 随机
 *   大约 30 个字符，留足余量。
 */
function nextClaimOpId(): string {
  opSeq += 1
  return `fc-${Date.now().toString(36)}-${opSeq.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`
}

/** 一条本地账本行 → 一条服务端 claim。`null` = 不用发（0 元 / 来源不在白名单） */
export function claimOf(
  row: { delta: number; source: string; memo: string },
  currency: FarmCurrency,
): FarmClaim | null {
  const delta = Math.round(row.delta)
  if (delta === 0) return null
  if (!FARM_CLAIM_SOURCES.has(row.source)) return null
  return {
    currency,
    delta,
    source: row.source,
    // 服务端 `memo` 列 255，留余量；流水是给家长看的，截断比报错好
    memo: (row.memo || '').slice(0, 120),
    op_id: nextClaimOpId(),
  }
}

/* ---------------- 账本暂存（农场动作期间） ---------------- */

interface FarmTxState {
  depth: number
  claims: FarmClaim[]
}

let tx: FarmTxState | null = null

/** 当前是不是在某个农场动作里（`doRefresh` 据此跳过拉取，免得把动作覆盖掉） */
export function inFarmTx(): boolean {
  return tx !== null
}

/**
 * 开始一次农场动作。
 *
 * 打开之后，`postLedger` / `postHarvest` 会被 `collect` 接管：
 * **这笔账不写本地**，只攒成 claim 等着一并提交。
 *
 * 为什么不是「先写本地、提交成功再删」：那个删的时机一旦出问题
 * （断网、崩溃、并发拉取），本地就会多出一笔服务端没有的账 ——
 * 余额虚高，而且永远不会自己恢复。**根本不写**才是没有这个状态。
 */
export function beginFarmTx(): void {
  if (!tx) {
    tx = { depth: 0, claims: [] }
    setLedgerSink(collect)
  }
  tx.depth += 1
}

function collect(
  row: { delta: number; source: string; memo: string },
  currency: FarmCurrency,
): boolean {
  if (!tx) return false
  const claim = claimOf(row, currency)
  // 返回 false = 「这条我不接管」，db.ts 会照常写本地（0 元的备注行）
  if (!claim) return false
  tx.claims.push(claim)
  return true
}

/** 结束一次农场动作，拿到这次攒下的账本变动（最外层才返回） */
export function endFarmTx(): FarmClaim[] {
  if (!tx) return []
  tx.depth -= 1
  if (tx.depth > 0) return []
  const claims = tx.claims
  tx = null
  setLedgerSink(null)
  return claims
}

/* ---------------- 拉 / 推 ---------------- */

export type FarmPullResult = 'pulled' | 'seeded' | 'no-session' | 'failed'

/**
 * 拉一次农场（`doRefresh` 每次都会调）。
 *
 * 三种结果：
 *   · `pulled`   服务端有，覆盖本地
 *   · `seeded`   服务端还没有（新账号）→ 把**本机这一份**推上去当初始状态。
 *                这一步是「旧版本升级到在线版」的迁移：孩子种了一半的地、
 *                养着的鸡，第一次登录就原样上云，而不是回到一块空地
 *   · `failed`   网络 / 脏数据 → 保留本地，不抛
 */
export async function pullFarm(): Promise<FarmPullResult> {
  if (!getToken()) return 'no-session'
  const got = await onlineWrite(() => oFarmGet())
  if (!got.ok) return 'failed'

  if (got.data.empty) return seedFarm()

  /* ★ 版本号**先记下来**，哪怕内容解析不了。
     它是「这一行是第几版」，和内容能不能读懂无关：不记的话下一次提交会拿
     `rev=0` 去写，服务端回 `conflict`，孩子点什么都提示「在别的设备上改过」，
     而真正的原因只是服务端那份脏了。 */
  setFarmRev(got.data.rev)

  const payload = parseFarmPayload(got.data.payload)
  if (!payload) return 'failed'
  await writeFarmPayload(payload)
  return 'pulled'
}

/** 服务端还没有这份农场：把本机这份推上去 */
async function seedFarm(): Promise<FarmPullResult> {
  const payload = await readFarmPayload()
  const saved = await onlineWrite(() =>
    oFarmSave({ payload: JSON.stringify(payload), rev: 0 }),
  )
  if (!saved.ok) return 'failed'
  if (saved.data.conflict) {
    // 另一台设备刚好先推了一份 —— 用它的，别硬覆盖
    const again = await onlineWrite(() => oFarmGet())
    if (!again.ok || again.data.empty) return 'failed'
    const other = parseFarmPayload(again.data.payload)
    if (!other) return 'failed'
    await writeFarmPayload(other)
    setFarmRev(again.data.rev)
    return 'pulled'
  }
  setFarmRev(saved.data.rev)
  return 'seeded'
}

export type FarmPushResult =
  | { ok: true; rev: number; applied: number; balances: Record<string, number> }
  | { ok: false; reason: 'conflict'; rev: number }
  | { ok: false; reason: 'failed'; error: ApiError }

/**
 * 把本地这份农场整块提交上去（可带账本）。
 *
 * ★ 不在这里做 `refresh()`：调用方（`store/useApp.ts`）才知道该重拉还是该提示。
 */
export async function pushFarmState(claims: FarmClaim[] = []): Promise<FarmPushResult> {
  if (!getToken()) {
    return { ok: false, reason: 'failed', error: new ApiError(401, '还没登录') }
  }
  const payload = await readFarmPayload()
  const saved = await onlineWrite(() =>
    oFarmSave({ payload: JSON.stringify(payload), rev: farmRev, ledger: claims }),
  )
  if (!saved.ok) return { ok: false, reason: 'failed', error: saved.error }
  if (saved.data.conflict) return { ok: false, reason: 'conflict', rev: saved.data.rev }
  farmRev = saved.data.rev
  return {
    ok: true,
    rev: saved.data.rev,
    applied: saved.data.applied ?? 0,
    balances: saved.data.balances ?? {},
  }
}
