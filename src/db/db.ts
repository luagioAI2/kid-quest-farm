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
  HarvestEntry,
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
  /** 丰收币账本。与 `ledger` 物理隔离，见 `HarvestEntry` 的注释。 */
  harvestLedger!: Table<HarvestEntry, string>
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
    // v4：v2 那条 `&[taskId+periodKey]` 对周期任务是错的。
    //
    // 周期任务的「本周/本月要做几次」靠 checkInTargetCount 表达，需要同一个
    // (taskId, periodKey) 下存在多行 —— 于是第二次提交必然撞唯一索引、抛
    // ConstraintError，`submitPeriodTask` 的 await 直接炸掉，按钮永远停在
    // 「记录中…」。种子任务「读一本完整的故事书」（月度 4 次）开箱即踩。
    //
    // 把 date 也纳入唯一键：
    //   * 自动补齐的日任务：periodKey 就等于当天 → 仍然一天一行，
    //     v2 想堵的「并发 refresh 重复生成」依然堵得住
    //   * 周期任务：同一天不能重复记一次（合理），跨天可以记满 N 次
    this.version(4).stores({
      taskInstances:
        'id, taskId, periodKey, date, status, [date+status], [status+submittedAt], &[taskId+periodKey+date]',
    })
    // v5：丰收币独立账本。
    //
    // 为什么单开一张表，而不是给 ledger 加个 currency 字段 —— 见 `HarvestEntry` 的注释。
    // 一句话：**要让「丰收币不算进积分」由表结构保证，而不是靠每个读余额的地方
    // 都记得加过滤**。漏一个 filter 就静默算错，而且不报错。
    this.version(5).stores({
      harvestLedger: 'id, source, createdAt, refId',
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

/* ---------------- 额度结转（收掉的地块上没用完的那部分） ---------------- */

/**
 * 已收掉的地块上「没用完的额度」，按产出物 id 归集。**存 `meta` 的 key 见下面。**
 *
 * 为什么需要它：卖出闸门是挂在**活着的**标的上的（`capTargetsFor` 只看
 * plots / animals）。小萝卜、胡萝卜这类**一次性作物收完就变空地** →
 * 那个标的消失了 → 存进背包的产出再也找不到额度 → **永远卖不掉**。
 * 所以作物离场时把没用掉的额度结转到这里。
 *
 * 存 `meta` 而不是新开一张表：`meta` 本来就是 key-value，加一个 key
 * **不需要动 Dexie 版本号**，也就不需要写迁移、不需要改老库升级用例。
 * `wipeAll` 已经会清 `meta`，不用额外处理。
 *
 * ⚠️ 导出成常量是为了让 `useApp.exportBackup` / `importBackup` 也用它 ——
 * 备份那边原来**漏了这个 key**，于是「导出 → 导入」一次就把额度清零，
 * 背包里的死库存永久卖不掉（见 `importBackup` 里的注释）。
 * 两边各写一遍字符串字面量迟早会飘。
 */
export const QUOTA_CARRY_KEY = 'farm.quotaCarry'

export async function loadQuotaCarry(): Promise<Record<string, number>> {
  const raw = await getMeta<Record<string, number>>(QUOTA_CARRY_KEY, {})
  // 老库里可能是脏数据，这里顺手清掉非正数，免得 `remaining` 被负额度污染
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  }
  return out
}

export async function saveQuotaCarry(carry: Record<string, number>): Promise<void> {
  await setMeta(QUOTA_CARRY_KEY, carry)
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
  // ⚠️ 必须包事务：`get` 和 `put` 之间**不原子**，并发调用会各自读到同一个旧值
  // 再各自写回去 → 丢更新。2026-09-21 实测：并发 `addItem` 三次，结果只加了 1。
  // 理由与 `postLedger` 完全相同（那里也是为此才包的事务）。
  await db.transaction('rw', db.inventory, async () => {
    const row = await db.inventory.get(itemId)
    if (row) {
      const next = row.count + count
      if (next <= 0) await db.inventory.delete(itemId)
      else await db.inventory.put({ itemId, count: next })
    } else if (count > 0) {
      await db.inventory.put({ itemId, count })
    }
  })
}

export async function consumeItem(itemId: string, count = 1): Promise<boolean> {
  // ⚠️⚠️ 这里比 `addItem` 更要命：它是一个**守卫**（不够就返回 false）。
  // 不包事务时，两个并发调用会**都**读到「够」，于是都扣 —— **超卖**。
  // 2026-09-21 实测（去掉事务后）：库存 1 个时并发卖两次，返回 `[true, true]`、
  // 库存归零。即「守卫被绕过」，不是简单的数字对不上。
  return db.transaction('rw', db.inventory, async () => {
    const row = await db.inventory.get(itemId)
    if (!row || row.count < count) return false
    const next = row.count - count
    if (next <= 0) await db.inventory.delete(itemId)
    else await db.inventory.put({ itemId, count: next })
    return true
  })
}

/* ---------------- 积分账本 ---------------- */

/**
 * 账本的权威余额 = **所有 delta 之和**。
 *
 * 不要用「最后一条的 balanceAfter」：ledger 的 `createdAt` 是**非唯一索引**，
 * 同一毫秒内的两笔在索引里会按主键（随机 id）并列，`orderBy('createdAt').last()`
 * 于是可能返回**先写的那条** —— 余额就少算了，而且不报任何错。
 * 实测：签到的「基础分 8 + 阶梯奖 10」同毫秒入账时，余额只加了 8。
 *
 * 求和与顺序无关，天然免疫这个问题，也顺手修好历史数据里已经接错的链条。
 */
export async function currentBalance(): Promise<number> {
  const rows = await db.ledger.toArray()
  return rows.reduce((sum, r) => sum + r.delta, 0)
}

/**
 * 取「下一笔账」该用的时间戳与当前余额。
 *
 * 时间戳必须**严格递增**，理由同上：并列会让 `.last()` 挑错行。
 * 余额用求和（见 `currentBalance`），这样即使历史数据里链条已经接错，
 * 新写的一笔也能把余额扳回正确值。
 *
 * 给「需要自己在事务里写账本」的调用方用（比如结算、兑换 —— 它们要在
 * 同一个事务里连着写实例/记录，不能调 `postLedger` 再开一个事务）。
 */
export async function ledgerTip(): Promise<{ createdAt: number; balance: number }> {
  const rows = await db.ledger.toArray()
  const maxAt = rows.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), 0)
  return {
    createdAt: Math.max(Date.now(), maxAt + 1),
    balance: rows.reduce((sum, r) => sum + r.delta, 0),
  }
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
    const tip = await ledgerTip()
    const row: LedgerEntry = {
      id: entry.id ?? `lg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      delta,
      balanceAfter: tip.balance + delta,
      source: entry.source,
      refId: entry.refId,
      memo: entry.memo,
      // 显式传入的时间戳也照样抬到「比上一条大」，否则并列又会挑错行
      createdAt: Math.max(entry.createdAt ?? tip.createdAt, tip.createdAt),
    }
    await db.ledger.put(row)
    return row
  })
}

/* ---------------- 丰收币账本 ---------------- */

/**
 * 丰收币余额 = 所有 delta 之和。口径与 `currentBalance` 一致，理由也一样。
 *
 * **只读 `db.harvestLedger`，永远不碰 `db.ledger`** ——
 * 这里就是「丰收币 ⇸ 积分」这条约束的落点。
 */
export async function currentHarvestBalance(): Promise<number> {
  const rows = await db.harvestLedger.toArray()
  return rows.reduce((sum, r) => sum + r.delta, 0)
}

/** 取「下一笔丰收币账」该用的时间戳与当前余额。理由同 `ledgerTip`。 */
export async function harvestTip(): Promise<{ createdAt: number; balance: number }> {
  const rows = await db.harvestLedger.toArray()
  const maxAt = rows.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), 0)
  return {
    createdAt: Math.max(Date.now(), maxAt + 1),
    balance: rows.reduce((sum, r) => sum + r.delta, 0),
  }
}

/**
 * 记一笔丰收币。**唯一**允许改动丰收币余额的入口。
 *
 * 与 `postLedger` 完全对称，只是换了张表。
 * **刻意不提供「丰收币 → 积分」的反向函数** —— 没有这个函数，就没有那条路。
 */
export async function postHarvest(
  entry: Omit<HarvestEntry, 'id' | 'balanceAfter' | 'createdAt'> & {
    id?: string
    createdAt?: number
  },
): Promise<HarvestEntry> {
  const delta = Math.round(entry.delta)
  return db.transaction('rw', db.harvestLedger, async () => {
    const tip = await harvestTip()
    const row: HarvestEntry = {
      id: entry.id ?? `hv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      delta,
      balanceAfter: tip.balance + delta,
      source: entry.source,
      refId: entry.refId,
      memo: entry.memo,
      createdAt: Math.max(entry.createdAt ?? tip.createdAt, tip.createdAt),
    }
    await db.harvestLedger.put(row)
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
  onboardingDone: false,
  parentReviewEnabled: true,
  protectParentActions: true,
  redeemEnabled: true,
  /**
   * 任务掉落开关。默认 **true** —— 老用户升级上来行为不变，
   * 想关的家长自己去设置里关（关掉后任务编辑页不再显示掉落选项）。
   * `loadSettings` 会和 `DEFAULT_SETTINGS` 合并，所以老库里没这个字段也能拿到默认值。
   */
  taskDropsEnabled: true,
  farmEventsEnabled: true,
  /** 浮盈倍率 r。数值口径见 catalog.ts 的 `DEFAULT_PROFIT_RATIO` */
  profitRatio: 0.6,
  /**
   * 现金 : 积分 的参考汇率：1 元 = 多少积分（2026-09-21）。
   *
   * **纯展示，不参与任何计算**（用户明确「不影响数值」）。
   * `loadSettings` 会和 `DEFAULT_SETTINGS` 合并，所以老库里没有
   * 这个字段也能拿到默认值 10，不需要数据迁移。
   * 口径与夹取区间见 `domain/cash.ts`。
   */
  pointsPerYuan: 10,
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
      db.harvestLedger,
      db.meta,
    ],
    async () => {
      await Promise.all([
        db.tasks.clear(),
        db.taskInstances.clear(),
        db.ledger.clear(),
        db.harvestLedger.clear(),
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
