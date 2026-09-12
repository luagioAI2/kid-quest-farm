import Dexie, { type Table } from 'dexie'
import { createInitialFarm } from '../domain/farm'
import { createInitialMarket } from '../domain/market'
import { PRODUCE_BASE_PRICE } from '../domain/catalog'
import type {
  Animal,
  AppSettings,
  CheckInProgress,
  CheckInRecord,
  FarmEvent,
  FarmState,
  InventorySlot,
  LedgerEntry,
  MarketState,
  RedeemItem,
  RedeemRecord,
  Task,
  TaskInstance,
} from '../domain/types'

/* ============================================================
   持久化层 —— IndexedDB (Dexie)
   ------------------------------------------------------------
   单机优先：所有数据存在本机。APK 与浏览器共用同一套 schema。
   导出/导入直接读写 backup 表 + 各业务表。
   ============================================================ */

export interface MetaRow {
  key: string
  value: unknown
}

class KidQuestFarmDB extends Dexie {
  tasks!: Table<Task, string>
  taskInstances!: Table<TaskInstance, string>
  ledger!: Table<LedgerEntry, string>
  inventory!: Table<InventorySlot, string>
  animals!: Table<Animal, string>
  checkIns!: Table<CheckInRecord, string>
  checkInProgress!: Table<CheckInProgress, string>
  redeemItems!: Table<RedeemItem, string>
  redeemRecords!: Table<RedeemRecord, string>
  farmEvents!: Table<FarmEvent, string>
  meta!: Table<MetaRow, string>

  constructor() {
    super('kid-quest-farm')
    this.version(1).stores({
      tasks: 'id, cycle, category, archived, createdAt',
      taskInstances: 'id, taskId, periodKey, date, status, [date+status], [taskId+periodKey]',
      ledger: 'id, source, createdAt, refId',
      inventory: 'itemId',
      animals: 'id, animalId, bornAt',
      checkIns: 'id, taskId, date, periodKey, [taskId+periodKey]',
      checkInProgress: 'id, taskId, periodKey, [taskId+periodKey]',
      meta: 'key',
    })
    // v2：把「一个任务在一个周期内只能有一条实例」升级为唯一约束，
    // 从数据库层面杜绝并发 refresh 造成重复生成、进而重复计分。
    this.version(2).stores({
      taskInstances:
        'id, taskId, periodKey, date, status, [date+status], &[taskId+periodKey]',
      checkIns: 'id, taskId, date, periodKey, [taskId+periodKey], &[taskId+date]',
    })
    // v3：新增兑换商城、农场事件日志、市场行情。
    // taskInstances 增加 status+submittedAt 复合索引，方便家长端拉「待审核」列表。
    this.version(3).stores({
      taskInstances:
        'id, taskId, periodKey, date, status, [date+status], [status+submittedAt], &[taskId+periodKey]',
      redeemItems: 'id, category, archived, cost, createdAt',
      redeemRecords: 'id, itemId, createdAt, fulfilled',
      farmEvents: 'id, kind, createdAt, refId',
    })
  }
}

export const db = new KidQuestFarmDB()

/* ---------------- meta 便捷读写 ---------------- */

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

/* ---------------- 农场状态封装 ---------------- */

export async function loadFarm(): Promise<FarmState> {
  const [plots, animals, totals, farmDay] = await Promise.all([
    getMeta<FarmState['plots'] | null>('farm.plots', null),
    db.animals.toArray(),
    getMeta<{ harvests: number; planted: number; sheared: number }>('farm.totals', {
      harvests: 0,
      planted: 0,
      sheared: 0,
    }),
    getMeta<number>('farm.day', 0),
  ])
  const init = createInitialFarm()
  return {
    plots: plots ?? init.plots,
    animals,
    totalHarvests: totals.harvests,
    totalPlanted: totals.planted,
    totalSheared: totals.sheared,
    farmDay,
  }
}

export async function saveFarmTotals(t: {
  harvests: number
  planted: number
  sheared: number
}): Promise<void> {
  await setMeta('farm.totals', t)
}

export async function savePlots(plots: FarmState['plots']): Promise<void> {
  await setMeta('farm.plots', plots)
}

export async function saveFarmDay(day: number): Promise<void> {
  await setMeta('farm.day', day)
}

/* ---------------- 市场行情 ---------------- */

const MARKET_KEY = 'farm.market'

export async function loadMarket(): Promise<MarketState> {
  const stored = await getMeta<MarketState | null>(MARKET_KEY, null)
  if (stored && Array.isArray(stored.quotes) && stored.quotes.length > 0) return stored
  return createInitialMarket(PRODUCE_BASE_PRICE)
}

export async function saveMarket(state: MarketState): Promise<void> {
  await setMeta(MARKET_KEY, state)
}

/* ---------------- 农场事件日志 ---------------- */

/** 最多保留的事件条数，避免无限膨胀 */
const MAX_FARM_EVENTS = 120

export async function logFarmEvents(events: FarmEvent[]): Promise<void> {
  if (events.length === 0) return
  await db.farmEvents.bulkPut(events)
  // 修剪：只保留最近 MAX_FARM_EVENTS 条
  const count = await db.farmEvents.count()
  if (count > MAX_FARM_EVENTS) {
    const stale = await db.farmEvents
      .orderBy('createdAt')
      .limit(count - MAX_FARM_EVENTS)
      .toArray()
    await db.farmEvents.bulkDelete(stale.map((e) => e.id))
  }
}

export async function loadFarmEvents(limit = 30): Promise<FarmEvent[]> {
  const rows = await db.farmEvents.orderBy('createdAt').reverse().limit(limit).toArray()
  return rows
}

/* ---------------- 兑换商城 ---------------- */

export async function loadRedeemItems(): Promise<RedeemItem[]> {
  const rows = await db.redeemItems.toArray()
  return rows.filter((r) => !r.archived).sort((a, b) => a.cost - b.cost)
}

export async function loadAllRedeemItems(): Promise<RedeemItem[]> {
  const rows = await db.redeemItems.toArray()
  return rows.sort((a, b) => a.cost - b.cost)
}

export async function loadRedeemRecords(limit = 60): Promise<RedeemRecord[]> {
  return db.redeemRecords.orderBy('createdAt').reverse().limit(limit).toArray()
}

/* ---------------- 背包 ---------------- */

export async function addItem(itemId: string, count = 1): Promise<void> {
  if (count === 0) return
  const row = await db.inventory.get(itemId)
  if (row) {
    const next = row.count + count
    if (next <= 0) await db.inventory.delete(itemId)
    else await db.inventory.put({ itemId, count: next })
  } else if (count > 0) {
    await db.inventory.put({ itemId, count })
  }
}

export async function consumeItem(itemId: string, count = 1): Promise<boolean> {
  const row = await db.inventory.get(itemId)
  if (!row || row.count < count) return false
  const next = row.count - count
  if (next <= 0) await db.inventory.delete(itemId)
  else await db.inventory.put({ itemId, count: next })
  return true
}

/* ---------------- 积分账本 ---------------- */

export async function currentBalance(): Promise<number> {
  const last = await db.ledger.orderBy('createdAt').last()
  return last?.balanceAfter ?? 0
}

/**
 * 记一笔账。这是**唯一**允许改动积分的入口 —— 保证账本与余额永远一致。
 *
 * 用 `db.transaction('rw')` 把「读上一条余额」和「写新记录」包成原子操作。
 * 否则并发调用会各自读到相同的旧余额，导致积分凭空丢失
 * （且每条 balanceAfter 都自洽，不会报错，静默出错）。
 */
export async function postLedger(
  entry: Omit<LedgerEntry, 'id' | 'balanceAfter' | 'createdAt'> & {
    id?: string
    createdAt?: number
  },
): Promise<LedgerEntry> {
  const delta = Math.round(entry.delta)
  return db.transaction('rw', db.ledger, async () => {
    const last = await db.ledger.orderBy('createdAt').last()
    const balance = last?.balanceAfter ?? 0
    const row: LedgerEntry = {
      id: entry.id ?? `lg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      delta,
      balanceAfter: balance + delta,
      source: entry.source,
      refId: entry.refId,
      memo: entry.memo,
      createdAt: entry.createdAt ?? Date.now(),
    }
    await db.ledger.put(row)
    return row
  })
}

/* ---------------- 设置 ---------------- */

export const DEFAULT_SETTINGS: AppSettings = {
  childName: '宝贝',
  avatar: '🐻',
  dayStartHour: 4,
  overtimeEnabled: true,
  minRatioForPoints: 0,
  qualityBonusEnabled: true,
  qualityBonusThreshold: 'ok',
  streakBonusEnabled: true,
  streakBonusPerDay: 2,
  streakBonusCap: 20,
  soundEnabled: true,
  hapticsEnabled: true,
  parentReviewEnabled: true,
  protectParentActions: true,
  redeemEnabled: true,
  farmEventsEnabled: true,
  farmClock: {
    timeScale: 1,
    showClock: true,
  },
  /** 默认家长密码：0000。首次打开即有密码保护，家长可在设置里改。 */
  parentPin: '0000',
}

export async function loadSettings(): Promise<AppSettings> {
  const stored = await getMeta<Partial<AppSettings>>('settings', {})
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    farmClock: { ...DEFAULT_SETTINGS.farmClock, ...(stored.farmClock ?? {}) },
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  await setMeta('settings', s)
}

/* ---------------- 危险操作：全量清空 ---------------- */

export async function wipeAll(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.tasks,
      db.taskInstances,
      db.ledger,
      db.inventory,
      db.animals,
      db.checkIns,
      db.checkInProgress,
      db.redeemItems,
      db.redeemRecords,
      db.farmEvents,
      db.meta,
    ],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.taskInstances.clear(),
        db.ledger.clear(),
        db.inventory.clear(),
        db.animals.clear(),
        db.checkIns.clear(),
        db.checkInProgress.clear(),
        db.redeemItems.clear(),
        db.redeemRecords.clear(),
        db.farmEvents.clear(),
        db.meta.clear(),
      ])
    },
  )
}
