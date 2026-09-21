import { useMemo } from 'react'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type {
  Animal,
  AppSettings,
  CheckInProgress,
  CheckInRecord,
  FarmEvent,
  FarmState,
  HarvestEntry,
  HarvestMode,
  InventorySlot,
  LedgerEntry,
  MarketState,
  PendingCheckIn,
  Plot,
  QualityGrade,
  RedeemItem,
  RedeemRecord,
  Task,
  TaskInstance,
} from '../domain/types'
import {
  addItem,
  consumeItem,
  currentBalance,
  currentHarvestBalance,
  db,
  DEFAULT_SETTINGS,
  loadAllRedeemItems,
  loadFarm,
  loadFarmEvents,
  loadMarket,
  loadQuotaCarry,
  loadRedeemItems,
  loadRedeemRecords,
  ledgerTip,
  loadSettings,
  logFarmEvents,
  postHarvest,
  postLedger,
  QUOTA_CARRY_KEY,
  saveFarmDay,
  saveFarmTotals,
  saveMarket,
  savePlots,
  saveQuotaCarry,
  saveSettings,
  wipeAll,
} from '../db/db'
import { hapticLight, playTone, type ToneKind } from '../platform/files'
import { settleInstance, type SettleParams } from '../domain/settlement'
import {
  appDayKey,
  appDayStart,
  formatClock,
  humanizeMinutes,
  periodKeyFor,
  toDateKey,
} from '../domain/time'
import {
  advanceAnimals,
  animalDefOf,
  cropDefOf,
  createInitialFarm,
  farmLevel,
  isAnimalMature,
  isCropMature,
} from '../domain/farm'
import {
  applyCapDeduction,
  capTargetsFor,
  leftoverCapFor,
  maxSellable,
  remainingCapFor,
} from '../domain/economy'
import {
  buildPeriodUnits,
  claimableTiers,
  computeStreak,
  currentDayKey,
  defaultTiers,
  makeInstance,
  planMissingInstances,
  uid,
  type CheckInTier,
} from '../domain/recurrence'
import {
  ANIMAL_BY_ID,
  ANIMALS,
  CROP_BY_ID,
  CROPS,
  DEFAULT_PROFIT_RATIO,
  ITEM_BY_ID,
  MARKET_GOODS,
  PRODUCE_BASE_PRICE,
  priceCeilingFor,
  produceUnitOf,
} from '../domain/catalog'
import {
  advanceMarket,
  applySell,
  priceOf,
  sellQuote,
  createInitialMarket,
} from '../domain/market'
import {
  farmMinutes,
  rollAnimalEvent,
  rollAnimalProduceEvent,
  rollHarvestEvent,
  seasonalBonus,
} from '../domain/farmEvents'
import { SEED_TASKS, SEED_REDEEM_ITEMS } from '../domain/seedTasks'

/* ============================================================
   全局 store
   ------------------------------------------------------------
   约定：所有写操作都先落 Dexie，再刷新内存快照。
   组件只读 store，不直接碰 db。
   ============================================================ */

export interface Toast {
  id: string
  kind: 'success' | 'info' | 'warn' | 'reward'
  title: string
  detail?: string
  emoji?: string
}

interface AppState {
  ready: boolean
  loading: boolean

  settings: AppSettings
  tasks: Task[]
  instances: TaskInstance[]
  ledger: LedgerEntry[]
  /**
   * 丰收币流水。与 `ledger` 分开放 —— 见 `HarvestEntry` 的两条不可逆约束。
   * 界面上「积分」页只看 `ledger`，「丰收币」页只看 `harvestLedger`，两边不串。
   */
  harvestLedger: HarvestEntry[]
  inventory: InventorySlot[]
  animals: Animal[]
  plots: Plot[]
  checkIns: CheckInRecord[]
  checkInProgress: CheckInProgress[]
  /** 兑换商城：在架上可兑换的 */
  redeemItems: RedeemItem[]
  /** 兑换商城：含下架，家长管理用 */
  allRedeemItems: RedeemItem[]
  redeemRecords: RedeemRecord[]
  /** 农场最近发生的事件（给孩子看的「农场日志」） */
  farmEvents: FarmEvent[]
  /** 市场行情 */
  market: MarketState
  /** 积分余额 —— **农场投入只认它**（`plant` / 买幼崽 / 开地块） */
  balance: number
  /** 丰收币余额 —— 只能花在兑换商城的丰收档，**不能回流农场、不能换积分** */
  harvestBalance: number
  todayKey: string

  toasts: Toast[]
  settleFlash: { points: number; reason: string; emoji: string } | null

  /** 农场累计统计（收获 / 种植 / 互动） */
  farmTotals: { harvests: number; planted: number; sheared: number }
  bumpFarmTotals: (patch: Partial<AppState['farmTotals']>) => Promise<void>

  /**
   * 从**已经收掉的地块**上结转过来、还没用掉的额度（按产出物 id）。
   *
   * 一次性作物（小萝卜 / 胡萝卜）收完地块就变空地，标的消失，
   * 没用完的额度必须搬到这里，否则背包里的产出永远卖不掉。
   * 口径与计算见 `domain/economy.ts` 的 `leftoverCapFor`。
   */
  quotaCarry: Record<string, number>

  /* ---- 生命周期 ---- */
  boot: () => Promise<void>
  refresh: () => Promise<void>
  /** 每分钟推进一次：动物产出、跨日检测 */
  tick: () => Promise<void>

  /* ---- 任务 ---- */
  addTask: (input: NewTaskInput) => Promise<Task>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  archiveTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  /* ---- 任务实例 ---- */
  startTimer: (instanceId: string) => Promise<void>
  /** 宝贝点了「我做完啦」——进入待审核（或直接结算，取决于设置） */
  submitInstance: (
    instanceId: string,
    actualMinutes: number | undefined,
    quality: QualityGrade | undefined,
    opts?: { backfilled?: boolean; skipReview?: boolean },
  ) => Promise<number>
  /** 家长审核：打分 + 确认奖励 */
  reviewInstance: (
    instanceId: string,
    quality: QualityGrade | undefined,
    actualMinutes?: number,
  ) => Promise<number>
  /** 家长打回，让孩子重做 */
  rejectInstance: (instanceId: string, note?: string) => Promise<void>
  giveUpInstance: (instanceId: string) => Promise<void>

  /* ---- 签到 ---- */
  /** 宝贝点「今天签到」——开启审核时只进入待审，不发分 */
  doCheckIn: (taskId: string) => Promise<{ gained: number; bonus: number; tierLabel?: string }>
  /**
   * 家长确认一次签到。必须显式带上 `periodKey` ——
   * 日签的周期键每天都会变，用「当前时间」重算会定位到今天那一行，
   * 昨天挂起的待审就永远没人处理。
   */
  approveCheckIn: (taskId: string, periodKey: string, date: string) => Promise<number>
  /** 家长打回一次签到，孩子可以重签 */
  rejectCheckIn: (taskId: string, periodKey: string, date: string) => Promise<void>
  claimCheckInTier: (taskId: string, days: number) => Promise<number>
  tiersFor: (task: Task) => CheckInTier[]
  checkInDays: (taskId: string) => string[]

  /* ---- 周期任务（周/月/年） ---- */
  submitPeriodTask: (
    taskId: string,
    actualMinutes: number | undefined,
    quality: QualityGrade | undefined,
  ) => Promise<number>
  periodUnitsFor: (task: Task) => ReturnType<typeof buildPeriodUnits>

  /* ---- 农场 ---- */
  plant: (plotIndex: number, cropId: string) => Promise<boolean>
  /**
   * 收获。**产出物进背包，钱在卖出时才结算。**
   *
   * @param mode `'sell'` = 立刻按当日市价卖掉；`'store'` = 只收进背包，等好价再卖。
   *             用户 2026-09-15：「可以直接卖出，也可以存储自己市场卖出。提供选择。」
   * @returns 本次到手的丰收币（`'store'` 时为 0）
   */
  harvest: (plotIndex: number, mode?: HarvestMode) => Promise<number>
  unlockPlot: (plotIndex: number) => Promise<boolean>
  water: (plotIndex: number) => Promise<void>
  buyAnimal: (animalId: string, name: string) => Promise<boolean>
  feedAnimal: (animalId: string) => Promise<boolean>
  collectAnimal: (animalId: string) => Promise<number>
  shearAnimal: (animalId: string) => Promise<boolean>
  /** 到市场卖出产出（走浮动价，会砸盘，并受**卖出闸门**限制） */
  sellProduce: (
    itemId: string,
    count: number,
    opts?: { quiet?: boolean },
  ) => Promise<number>
  /** 当前现价（用于 UI 预览） */
  priceFor: (itemId: string) => number
  /**
   * 卖出 n 个能拿多少丰收币。
   *
   * ⚠️ **线性：现价 × 个数，不含卖压。** 卖压只在卖出**之后**压行情
   * （见 `applySell` / `SELL_IMPACT_PER_UNIT`），所以同一批货当天再卖，
   * 单价才会变低。UI 里别再拿它和「逐个卖」作差去编「少了 N 分」的故事 ——
   * 差额恒等于四舍五入的余数。2026-09-16 修过一次，见 `MarketSheet` 文件头。
   */
  quoteFor: (itemId: string, count: number) => number
  /** 清理已离世的动物 */
  removeAnimal: (animalId: string) => Promise<void>

  /* ---- 兑换商城 ---- */
  addRedeemItem: (input: NewRedeemInput) => Promise<RedeemItem>
  updateRedeemItem: (id: string, patch: Partial<RedeemItem>) => Promise<void>
  /**
   * 兑换品上架 / 下架。
   *
   * 是**双向**的：下架只是从孩子看到的列表里隐藏（`loadRedeemItems` 会过滤掉
   * `archived`），记录和历史都还在，随时可以再上架。
   * 以前的 `archiveRedeemItem` 只会写 `archived: true`，一旦下架就只能删掉重加。
   */
  setRedeemItemArchived: (id: string, archived: boolean) => Promise<void>
  /** 永久删除。不可逆，调用方必须先做二次确认。 */
  deleteRedeemItem: (id: string) => Promise<void>
  /** 兑换：扣积分 + 生成记录 */
  redeem: (itemId: string) => Promise<boolean>
  /** 家长标记「已兑现」 */
  fulfillRedeem: (recordId: string) => Promise<void>
  /** 今日已兑换次数（用于 limitPerDay 校验） */
  redeemedToday: (itemId: string) => number

  /* ---- 设置与数据 ---- */
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  exportBackup: () => Promise<unknown>
  importBackup: (raw: unknown) => Promise<{ ok: boolean; message: string }>
  resetAll: () => Promise<void>

  /* ---- UI ---- */
  pushToast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  clearSettleFlash: () => void
}

export interface NewTaskInput {
  title: string
  note?: string
  category: Task['category']
  cycle: Task['cycle']
  plannedMinutes: number
  basePoints: number
  qualityBonusPoints: number
  allowOvertime: boolean
  allowLateNoPenalty: boolean
  qualityRated: boolean
  rewardItemIds?: string[]
  checkInEnabled?: boolean
  checkInTargetCount?: number
  remindAt?: string
  /** 固定任务：家长建立、孩子不能改 */
  fixed?: boolean
}

export interface NewRedeemInput {
  name: string
  emoji: string
  category: RedeemItem['category']
  cost: number
  note?: string
  limitPerDay?: number
  stock?: number
  createdByParent?: boolean
}

/* ============================================================
   播种的并发闸门
   ------------------------------------------------------------
   `doSeedIfEmpty` 是「先 count 再写」，两步之间**不是原子的**。
   React 的 StrictMode 在**开发模式**下会把 effect 跑两遍
   （挂载 → 卸载 → 挂载），于是 `boot()` 被并发调了两次，
   两次 `count()` 都读到 0 → **各播一遍** → 全新装机直接变成
   24 条任务（正常 12）、余额 100（正常 50）。

   2026-09-21 实测：dev(5180) 是 24/100，preview 生产构建(4180) 是 12/50 ——
   因为生产构建不会重复跑 effect，所以它**只在开发时露头**。
   但它并不只属于 StrictMode：任何「boot 被并发调用 + 库恰好是空的」路径
   都会中招，所以照 `refreshInFlight` 那套折叠掉。
   ============================================================ */
let seedInFlight: Promise<void> | null = null

/** 首次启动时注入的示例任务，让孩子立刻能玩起来 */
async function seedIfEmpty(): Promise<void> {
  // 串行化：见上面「播种的并发闸门」
  if (seedInFlight) return seedInFlight
  seedInFlight = doSeedIfEmpty().finally(() => {
    seedInFlight = null
  })
  return seedInFlight
}

async function doSeedIfEmpty(): Promise<void> {
  const now = Date.now()

  const taskCount = await db.tasks.count()
  if (taskCount === 0) {
    // createdAt 逐条 +1ms：把「种子里的顺序」真正记下来。
    // 全部用同一个 now 的话，按时间排序会全部打平，顺序就退化成
    // 「按随机主键排」—— 每台设备看到的任务先后都不一样。
    const rows: Task[] = SEED_TASKS.map((t, i) => ({
      ...t,
      id: uid('tk'),
      createdAt: now + i,
      updatedAt: now + i,
    }))
    await db.tasks.bulkPut(rows)
    await postLedger({
      delta: 50,
      source: 'manual_adjust',
      memo: '欢迎来到小任务农场！这是给你的启动积分 🎁',
    })
  }

  // 兑换商城是后加的，老用户库里没有 —— 空的时候补一份默认清单，
  // 家长可以直接改或删，也省得从零开始配。
  const redeemCount = await db.redeemItems.count()
  if (redeemCount === 0) {
    await db.redeemItems.bulkPut(
      SEED_REDEEM_ITEMS.map((r) => ({
        ...r,
        id: uid('rd'),
        createdAt: now,
        updatedAt: now,
      })),
    )
  }
}

/* ============================================================
   并发闸门
   ------------------------------------------------------------
   refresh() 会被 boot / tick / 各业务 action 反复调用。并发执行时
   它们会各自基于同一份快照推算"缺失的实例"再一起写入，造成同一天
   出现两条实例 → 同一任务可被结算两次。这里把并发调用折叠成一次。
   ============================================================ */
let refreshInFlight: Promise<void> | null = null

/* ============================================================
   设置的写入串行闸门
   ------------------------------------------------------------
   `updateSettings` 会先同步更新内存、再落库。落库这一半必须串起来，
   否则两次并发写的完成顺序可能颠倒，DB 里留下的是**先发起的那一次**
   （内存与 DB 不一致，下次启动就"变回旧值"）。
   见 `updateSettings` 的注释。
   ============================================================ */
let settingsWriteChain: Promise<void> = Promise.resolve()

/* ============================================================
   备份文件校验
   ------------------------------------------------------------
   只做结构校验（字段是否齐全、类型是否正确），不做业务校验。
   目的是在清空现有数据之前就把坏文件拦下来。
   ============================================================ */
const BACKUP_ARRAY_FIELDS = [
  'tasks',
  'taskInstances',
  'ledger',
  'harvestLedger',
  'inventory',
  'animals',
  'checkIns',
  'checkInProgress',
  'redeemItems',
  'redeemRecords',
  'events',
] as const

/** 数组字段允许缺失（老版本备份没有新字段），但若存在必须是对象数组且带 id */
const BACKUP_ID_ARRAY_FIELDS = new Set<string>([
  'tasks',
  'taskInstances',
  'ledger',
  'harvestLedger',
  'animals',
  'checkIns',
  'checkInProgress',
  'redeemItems',
  'redeemRecords',
])

function validateBackup(d: Record<string, unknown>): string | null {
  for (const key of BACKUP_ARRAY_FIELDS) {
    const v = d[key]
    if (v === undefined || v === null) continue
    if (!Array.isArray(v)) return `备份文件里的「${key}」格式不对`
    if (BACKUP_ID_ARRAY_FIELDS.has(key)) {
      const bad = v.find((x) => !x || typeof x !== 'object' || !('id' in (x as object)))
      if (bad !== undefined) return `备份文件里的「${key}」缺少必要字段`
    }
  }
  if (d.settings !== undefined && d.settings !== null && typeof d.settings !== 'object') {
    return '备份文件里的「设置」格式不对'
  }
  if (d.farm !== undefined && d.farm !== null && typeof d.farm !== 'object') {
    return '备份文件里的「农场」格式不对'
  }
  // 至少要有一样实际内容，避免导入一个空壳把数据清空
  const hasContent = BACKUP_ARRAY_FIELDS.some(
    (k) => Array.isArray(d[k]) && (d[k] as unknown[]).length > 0,
  )
  if (!hasContent) return '备份文件是空的，没有可以恢复的内容'
  return null
}

/** refresh 的实际实现（从 store 中抽出，便于串行包装） */
/**
 * 任务排序：先按创建时间，再按 id 兜底。
 *
 * 为什么非排不可：`db.tasks.toArray()` 是按**主键**返回的，而主键是
 * 随机生成的 uid —— 不排的话，「今日任务」里那几项的先后顺序是任意的，
 * 每台设备、每次全新安装都不一样（实测跑三次三个顺序）。
 *
 * 种子里一次性写入的任务 createdAt 又完全相同，只按时间排会全部打平，
 * 所以 `seedIfEmpty` 给每个任务 +1ms 的递增时间，让种子顺序真正被记下来，
 * 这里再按 (createdAt, id) 排就能复现家长排的顺序。
 */
function sortTasks(rows: Task[]): Task[] {
  return [...rows].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt - b.createdAt
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

async function doRefresh(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
): Promise<void> {
  const { settings } = get()
  const today = currentDayKey(settings.dayStartHour)

  const tasks = sortTasks(await db.tasks.filter((t) => !t.archived).toArray())
  const allTasks = sortTasks(await db.tasks.toArray())
  const existing = await db.taskInstances.toArray()

  // 1) 惰性补齐：从最早的实例日到今天，逐日生成缺失实例
  const earliest = existing.reduce<string | null>(
    (acc, i) => (acc === null || i.date < acc ? i.date : acc),
    null,
  )
  const from = earliest ?? today
  // 补齐失败不能阻断 App 启动：最坏情况是今天少几张每日任务卡，
  // 也比整个界面白屏强。异常交给上层日志，下次刷新会重试。
  try {
    const missing = planMissingInstances(allTasks, existing, from, today, settings.dayStartHour)
    for (const inst of missing) {
      // 逐条 put 而非 bulkPut：配合唯一索引 [taskId+periodKey]，
      // 万一仍有重复只会被约束拒绝，而不会静默写入两份。
      try {
        await db.taskInstances.put(inst)
      } catch {
        /* 唯一约束命中 —— 说明已存在，忽略即可 */
      }
    }
  } catch (err) {
    console.error('[kqf] 每日实例补齐失败，本次跳过', err)
  }

  // 2) 过期未完成 → expired（只处理今天之前的每日任务）
  const stale = await db.taskInstances
    .where('date')
    .below(today)
    .filter((i) => i.status === 'pending')
    .toArray()
  if (stale.length > 0) {
    await db.taskInstances.bulkPut(
      stale.map((i) => ({ ...i, status: 'expired' as const, updatedAt: Date.now() })),
    )
  }

  // 3) 农场推进（含时间流速 + 随机事件 + 寿命）
  const farm = await loadFarm()
  const timeScale = settings.farmClock?.timeScale ?? 1
  const eventsEnabled = settings.farmEventsEnabled !== false
  const now = Date.now()

  // 3a) 动物产出累积 + 自然老去
  let advanced = advanceAnimals(farm.animals, now, timeScale)

  // 3b) 动物随机事件（生病）—— 按「经过的农场天数」为概率基数
  const newEvents: FarmEvent[] = []
  if (eventsEnabled && advanced.length > 0) {
    const lastSeen = await getMetaFarmerCheckpoint()
    const farmDaysPassed = Math.min(30, Math.max(0, (now - lastSeen) / (1000 * 60 * 60 * 24) * timeScale))
    if (farmDaysPassed > 0.05) {
      const rolled = advanced.map((a) => {
        if (a.deceased || a.sickAt) return a
        const def = animalDefOf(a)
        if (!def) return a
        const res = rollAnimalEvent(a, def, farmDaysPassed, now, eventsEnabled)
        if (res.event) newEvents.push(res.event)
        if (res.sick) {
          return { ...a, sickAt: now, lastEvent: res.event?.message }
        }
        return a
      })
      if (rolled.some((a, i) => a !== advanced[i])) advanced = rolled
      await setMetaFarmerCheckpoint(now)
    }
  }

  if (advanced !== farm.animals) {
    const changed = advanced.filter((a, idx) => a !== farm.animals[idx])
    await db.animals.bulkPut(changed)
  }

  // 3c) 农场世界日推进（用于「农场第 N 天」与事件节奏）
  const prevFarmDay = farm.farmDay ?? 0
  const farmDayNow = Math.floor(farmMinutes(now, timeScale) / (60 * 24))
  const farmDayAdvance = Math.max(prevFarmDay, farmDayNow)
  if (farmDayAdvance !== prevFarmDay) {
    await saveFarmDay(farmDayAdvance)
  }

  // 3d) 市场行情推进（跨日）
  // ⚠️ 要把家长设的 `r` 传进去 —— 现价硬顶 = `上限回收 ÷ 满产` 是跟着 `r` 变的
  // （见 `priceCeilingFor`）。不传的话家长调档之后，行情还是按默认 0.6 夹的。
  const marketDay = Math.floor(now / (1000 * 60 * 60 * 24))
  const market = advanceMarket(
    await loadMarket(),
    marketDay,
    get().settings.profitRatio ?? DEFAULT_PROFIT_RATIO,
  )
  await saveMarket(market)

  if (newEvents.length > 0) {
    await logFarmEvents(newEvents)
  }

  const [
    instances,
    ledger,
    harvestLedger,
    inventory,
    animals,
    checkIns,
    checkInProgress,
    balance,
    harvestBalance,
    redeemItems,
    allRedeemItems,
    redeemRecords,
    farmEvents,
    quotaCarry,
  ] = await Promise.all([
    db.taskInstances.orderBy('date').reverse().toArray(),
    // 全量加载流水。这里曾经 limit(500)，导致孩子用久了以后
    // 早期的记录从「积分」页凭空消失，而导出却还在 —— 对不上账。
    // 单机场景下流水量级很小（一年也就几千条），全量读没有压力。
    db.ledger.orderBy('createdAt').reverse().toArray(),
    // 丰收币流水同理，全量读。
    db.harvestLedger.orderBy('createdAt').reverse().toArray(),
    db.inventory.toArray(),
    db.animals.toArray(),
    db.checkIns.toArray(),
    db.checkInProgress.toArray(),
    currentBalance(),
    currentHarvestBalance(),
    loadRedeemItems(),
    loadAllRedeemItems(),
    loadRedeemRecords(),
    loadFarmEvents(40),
    loadQuotaCarry(),
  ])

  set({
    tasks,
    instances,
    ledger,
    harvestLedger,
    inventory,
    animals,
    plots: farm.plots,
    farmTotals: {
      harvests: farm.totalHarvests,
      planted: farm.totalPlanted,
      sheared: farm.totalSheared,
    },
    quotaCarry,
    checkIns,
    checkInProgress,
    redeemItems,
    allRedeemItems,
    redeemRecords,
    farmEvents,
    market,
    balance,
    harvestBalance,
    todayKey: today,
  })
}

/* ---------------- 农场检查点（用于事件概率） ---------------- */

const FARM_CHECKPOINT_KEY = 'farm.lastEventCheck'

async function getMetaFarmerCheckpoint(): Promise<number> {
  const raw = await db.meta.get(FARM_CHECKPOINT_KEY)
  const v = raw?.value
  return typeof v === 'number' && Number.isFinite(v) ? v : Date.now()
}

async function setMetaFarmerCheckpoint(ts: number): Promise<void> {
  await db.meta.put({ key: FARM_CHECKPOINT_KEY, value: ts })
}

/* ============================================================
   结算核心（内部）
   ------------------------------------------------------------
   submitInstance（家长关掉审核时）与 reviewInstance（家长审核）
   共用这一段，保证两条路径的打分规则完全一致。
   ============================================================ */
async function settleNow(
  get: () => AppState,
  set: (partial: Partial<AppState>) => void,
  instanceId: string,
  minutes: number | undefined,
  quality: QualityGrade | undefined,
  backfilled: boolean | undefined,
): Promise<number> {
  const inst = await db.taskInstances.get(instanceId)
  if (!inst) return 0
  const { settings } = get()

  const global: Pick<
    SettleParams,
    'overtimeEnabled' | 'qualityBonusThreshold' | 'minRatioForPoints'
  > = {
    overtimeEnabled: settings.overtimeEnabled,
    qualityBonusThreshold: settings.qualityBonusThreshold,
    minRatioForPoints: settings.minRatioForPoints,
  }

  const result = settleInstance(
    { ...inst, actualMinutes: minutes ?? undefined, quality },
    global,
  )

  const status: TaskInstance['status'] =
    result.points > 0 ? 'completed' : result.zeroed ? 'failed' : 'completed'

  // 原子提交：状态写入 + 积分入账放在同一个事务里。
  // 否则中途失败会出现"状态已改但没入账"或"入了账但状态没改"的不一致。
  const now = Date.now()
  let paid = true
  await db.transaction('rw', [db.taskInstances, db.ledger], async () => {
    const fresh = await db.taskInstances.get(instanceId)
    if (!fresh || fresh.settledAt != null) {
      // 在事务内二次确认，堵住并发窗口
      paid = false
      return
    }
    await db.taskInstances.update(instanceId, {
      status,
      actualMinutes: minutes != null ? Math.round(minutes * 10) / 10 : undefined,
      earnedPoints: result.points,
      quality,
      completedAt: fresh.completedAt ?? now,
      settledAt: now,
      reviewedAt: now,
      backfilled,
      updatedAt: now,
    })
    if (result.points > 0) {
      // 走 ledgerTip 而不是自己读 last()：时间戳必须严格递增，
      // 否则同一毫秒的两笔会在 createdAt 索引里并列、余额接错（见 db.ts）
      const tip = await ledgerTip()
      await db.ledger.put({
        id: `lg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        delta: result.points,
        balanceAfter: tip.balance + result.points,
        source: 'task',
        refId: instanceId,
        memo: `${inst.title}（${minutes != null ? humanizeMinutes(minutes) : '未计时'}）`,
        createdAt: tip.createdAt,
      })
    }
  })

  if (!paid) {
    get().pushToast({ kind: 'info', title: '这个任务已经结算过啦', emoji: '✅' })
    return 0
  }

  // 任务定义上配置的道具掉落
  for (const itemId of inst.rewardItemIds ?? []) {
    await addItem(itemId, 1)
  }

  // 连击奖励
  let streakBonus = 0
  if (settings.streakBonusEnabled && result.points > 0) {
    streakBonus = await maybePayStreakBonus()
  }

  set({
    settleFlash: {
      points: result.points + streakBonus,
      reason:
        streakBonus > 0
          ? `${result.reason}　🔥 连续完成奖励 +${streakBonus} 分`
          : result.reason,
      emoji: result.points > 0 ? '🎉' : '😅',
    },
  })

  await get().refresh()
  return result.points + streakBonus
}

/* ============================================================
   签到核心（内部）
   ------------------------------------------------------------
   doCheckIn（家长关掉审核时的直接发放）与 approveCheckIn（家长审核）
   共用这一段，保证两条路径的发放规则完全一致 ——
   和 settleNow 之于 submitInstance / reviewInstance 是同一个道理。
   ============================================================ */

/** 取（或构造）某个签到任务在某个周期的进度行。不落盘，由调用方决定何时写。 */
async function ensureCheckInProgress(
  taskId: string,
  periodKey: string,
): Promise<CheckInProgress> {
  const found = await db.checkInProgress
    .where('[taskId+periodKey]')
    .equals([taskId, periodKey])
    .first()
  if (found) return found
  return {
    id: uid('cp'),
    taskId,
    periodKey,
    days: [],
    pendingDays: [],
    claimedTiers: [],
    updatedAt: Date.now(),
  }
}

/**
 * 真正把一次签到「兑现」：记日期 → 写签到记录 → 发积分 → 自动结算阶梯奖励。
 *
 * 幂等：日期已在 `days` 里就直接返回，避免重复发分。
 * 注意 `date` 与 `periodKey` 都由调用方传入，不在这里用「当前时间」重算 ——
 * 补审昨天的签到时，重算会写到今天的进度行上。
 */
async function grantCheckIn(
  get: () => AppState,
  task: Task,
  progress: CheckInProgress,
  date: string,
  periodKey: string,
): Promise<{ gained: number; bonus: number; tierLabel?: string }> {
  if (progress.days.includes(date)) return { gained: 0, bonus: 0 }

  const gained = Math.max(0, Math.round(task.basePoints))
  progress.days = [...progress.days, date].sort()
  progress.updatedAt = Date.now()
  await db.checkInProgress.put(progress)

  const record: CheckInRecord = {
    id: uid('ci'),
    taskId: task.id,
    date,
    periodKey,
    points: gained,
    createdAt: Date.now(),
  }
  await db.checkIns.put(record)

  if (gained > 0) {
    await postLedger({
      delta: gained,
      source: 'checkin',
      refId: record.id,
      memo: `签到：${task.title}`,
    })
  }

  // 自动结算已达成的阶梯奖励
  const tiers = defaultTiers(task.cycle, task.checkInTargetCount ?? 5)
  const claimable = claimableTiers(tiers, progress.days.length, progress.claimedTiers)
  let bonus = 0
  let tierLabel: string | undefined
  for (const tier of claimable) {
    progress.claimedTiers = [...progress.claimedTiers, tier.days]
    bonus += tier.points
    tierLabel = tier.label
    if (tier.points > 0) {
      await postLedger({
        delta: tier.points,
        source: 'checkin_bonus',
        refId: `${task.id}:${periodKey}:${tier.days}`,
        memo: `签到奖励 · ${tier.label}`,
      })
    }
    if (tier.itemId) await addItem(tier.itemId, 1)
  }
  if (claimable.length > 0) {
    progress.claimedTiers = Array.from(new Set(progress.claimedTiers))
    await db.checkInProgress.put(progress)
  }

  get().pushToast({
    kind: 'reward',
    title: `签到成功 +${gained + bonus} 分`,
    detail: tierLabel ? `达成「${tierLabel}」！` : `已坚持 ${progress.days.length} 天`,
    emoji: '📅',
  })

  return { gained, bonus, tierLabel }
}

/**
 * toast 类型 → 音效。
 *
 * `info` 刻意是 `null`：它表示「只是告诉你一声」（已下架 / 已经交上去啦 /
 * 备份已导出），出声反而吵。`reward`（+N 分）用 `coin`，
 * 和「完成任务」的 `success` 分开 —— 孩子听得出「分到手了」和「做完了」是两件事。
 */
const TOAST_TONE: Record<Toast['kind'], ToneKind | null> = {
  success: 'success',
  reward: 'coin',
  warn: 'fail',
  info: null,
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  loading: true,
  settings: DEFAULT_SETTINGS,
  tasks: [],
  instances: [],
  ledger: [],
  harvestLedger: [],
  inventory: [],
  animals: [],
  plots: createInitialFarm().plots,
  checkIns: [],
  checkInProgress: [],
  redeemItems: [],
  allRedeemItems: [],
  redeemRecords: [],
  farmEvents: [],
  market: createInitialMarket(PRODUCE_BASE_PRICE),
  balance: 0,
  harvestBalance: 0,
  todayKey: appDayKey(Date.now(), DEFAULT_SETTINGS.dayStartHour),
  toasts: [],
  settleFlash: null,
  farmTotals: { harvests: 0, planted: 0, sheared: 0 },
  quotaCarry: {},

  /* ================= 生命周期 ================= */

  boot: async () => {
    set({ loading: true })
    await seedIfEmpty()
    const settings = await loadSettings()
    set({ settings })
    await get().refresh()
    set({ ready: true, loading: false })
  },

  refresh: async () => {
    // 串行化：并发 refresh 会各自基于同一份快照计算"缺失实例"，
    // 然后同时写入，导致同一任务同一天出现两条实例（进而可重复计分）。
    // 这里用一个模块级 in-flight promise 把并发调用折叠成一次。
    if (refreshInFlight) return refreshInFlight
    refreshInFlight = (async () => {
      await doRefresh(set, get)
    })().finally(() => {
      refreshInFlight = null
    })
    return refreshInFlight
  },


  tick: async () => {
    const { settings, todayKey, animals } = get()
    const now = Date.now()
    const nextDay = currentDayKey(settings.dayStartHour)
    const dayStart = appDayStart(now, settings.dayStartHour)

    // 自动收尾「跨过逻辑日仍在计时」的任务。
    // 关键点：结束时间要取 min(now, 上一逻辑日结束)，否则会出现
    // end < startedAt 的负时长，被 Math.max(1,…) 兜成"1 分钟"，
    // 反而给孩子一个满分 —— 与"超时"的本意完全相反。
    const running = get().instances.filter((i) => i.status === 'pending' && i.startedAt)
    for (const inst of running) {
      if (!inst.startedAt) continue
      const startedKey = appDayKey(inst.startedAt, settings.dayStartHour)
      if (startedKey === nextDay) continue // 今天开的，还在计
      const end = Math.min(now, dayStart)
      const minutes = Math.max(0.1, (end - inst.startedAt) / 60000)
      // skipReview：跨日自动收尾不该把孩子卡在"待审核"里过夜，
      // 但也不该不经家长就直接发分 —— 所以这里同样走上交审核。
      await get().submitInstance(inst.id, minutes, undefined)
    }

    // 动物产出累积
    const timeScale = settings.farmClock?.timeScale ?? 1
    const advanced = advanceAnimals(animals, now, timeScale)
    if (advanced !== animals) {
      const changed = advanced.filter((a, idx) => a !== animals[idx])
      await db.animals.bulkPut(changed)
    }

    if (nextDay !== todayKey) {
      await get().refresh()
    } else if (advanced !== animals) {
      set({ animals: advanced })
    }
  },

  /* ================= 任务 ================= */

  addTask: async (input) => {
    const now = Date.now()
    const task: Task = {
      ...input,
      id: uid('tk'),
      createdAt: now,
      updatedAt: now,
    }
    await db.tasks.put(task)

    // 每日/单次任务立刻生成今天（或指定日）的实例
    if (task.cycle === 'once' || task.cycle === 'daily') {
      const inst = makeInstance(task, currentDayKey(get().settings.dayStartHour), get().settings.dayStartHour)
      if (inst) await db.taskInstances.put(inst)
    }
    await get().refresh()
    return task
  },

  updateTask: async (id, patch) => {
    await db.tasks.update(id, { ...patch, updatedAt: Date.now() })
    await get().refresh()
  },

  archiveTask: async (id) => {
    await db.tasks.update(id, { archived: true, updatedAt: Date.now() })
    await get().refresh()
  },

  deleteTask: async (id) => {
    await db.transaction('rw', [db.tasks, db.taskInstances, db.checkIns, db.checkInProgress], async () => {
      await db.tasks.delete(id)
      await db.taskInstances.where('taskId').equals(id).delete()
      await db.checkIns.where('taskId').equals(id).delete()
      await db.checkInProgress.where('taskId').equals(id).delete()
    })
    await get().refresh()
  },

  /* ================= 任务实例 ================= */

  startTimer: async (instanceId) => {
    const inst = await db.taskInstances.get(instanceId)
    if (!inst || inst.status !== 'pending') return
    await db.taskInstances.update(instanceId, { startedAt: Date.now(), updatedAt: Date.now() })
    await get().refresh()
  },

  /**
   * 宝贝点了「我做完啦」。
   *
   * 两种走向：
   *  * parentReviewEnabled（默认开）→ 只写状态为 `submitted`（等爸爸妈妈看），
   *    不计分。积分要等家长输密码审核后才发。
   *  * 家长关掉了审核 / skipReview → 直接走老的即时结算。
   *
   * 这样孩子端「完成」这个动作彻底不涉及积分，杜绝了
   * 「自己点一下就给自己加分」的问题。
   */
  submitInstance: async (instanceId, actualMinutes, quality, opts) => {
    const inst = await db.taskInstances.get(instanceId)
    if (!inst) return 0

    // 幂等保护：已提交/已结算的实例不再重复处理
    if (
      inst.settledAt != null ||
      inst.status === 'completed' ||
      inst.status === 'failed' ||
      inst.status === 'submitted'
    ) {
      get().pushToast({ kind: 'info', title: '这个任务已经交上去啦', emoji: '✅' })
      return 0
    }
    if (inst.status === 'skipped') {
      get().pushToast({ kind: 'info', title: '这个任务已经放一边了', emoji: '🙂' })
      return 0
    }

    const { settings } = get()

    // 若没传用时，但有计时记录 → 用计时算
    let minutes = actualMinutes
    if (minutes == null && inst.startedAt) {
      minutes = Math.max(0.1, (Date.now() - inst.startedAt) / 60000)
    }

    const needsReview = settings.parentReviewEnabled && !opts?.skipReview

    if (needsReview) {
      const now = Date.now()
      await db.taskInstances.update(instanceId, {
        status: 'submitted',
        actualMinutes: minutes != null ? Math.round(minutes * 10) / 10 : undefined,
        submittedAt: now,
        backfilled: opts?.backfilled,
        // 孩子自己选的质量只是「自评参考」，家长可以改
        quality: quality ?? undefined,
        updatedAt: now,
      })
      get().pushToast({
        kind: 'success',
        title: '交上去啦！等爸爸妈妈看一眼',
        detail: '他们确认后积分就到账咯',
        emoji: '📮',
      })
      await get().refresh()
      return 0
    }

    // 否则走即时结算
    return settleNow(get, set, instanceId, minutes, quality, opts?.backfilled)
  },

  /**
   * 家长审核：打分 + 确认奖励。
   *
   * 这是**唯一**给「宝宝提交」的任务发积分的入口。
   * 与 submitInstance 走同一套结算引擎（settleInstance），
   * 所以评分规则完全一致，家长只是「最后一公里」的确认人。
   */
  reviewInstance: async (instanceId, quality, actualMinutes) => {
    const inst = await db.taskInstances.get(instanceId)
    if (!inst) return 0
    if (inst.settledAt != null) {
      get().pushToast({ kind: 'info', title: '这个任务已经确认过了', emoji: '✅' })
      return 0
    }
    const minutes = actualMinutes ?? inst.actualMinutes
    set({ settleFlash: null })
    return settleNow(get, set, instanceId, minutes, quality, inst.backfilled)
  },

  /** 家长打回：不影响积分，孩子可以再做一次 */
  rejectInstance: async (instanceId, note) => {
    const inst = await db.taskInstances.get(instanceId)
    if (!inst) return
    if (inst.settledAt != null) {
      get().pushToast({ kind: 'info', title: '已经确认过了，改不了啦', emoji: '✅' })
      return
    }
    await db.taskInstances.update(instanceId, {
      status: 'rejected',
      rejectNote: note,
      submittedAt: undefined,
      // 保留 startedAt，孩子可以接着计时
      updatedAt: Date.now(),
    })
    get().pushToast({
      kind: 'info',
      title: '已让孩子再做一次',
      detail: note || undefined,
      emoji: '🔁',
    })
    await get().refresh()
  },

  giveUpInstance: async (instanceId) => {
    const inst = await db.taskInstances.get(instanceId)
    if (!inst) return
    // 已结算的实例不允许再翻成"放弃"，否则界面显示 0 分而账本里还留着那笔收入
    if (inst.settledAt != null) {
      get().pushToast({ kind: 'info', title: '这个任务已经结算过了', emoji: '✅' })
      return
    }
    await db.taskInstances.update(instanceId, {
      status: 'skipped',
      earnedPoints: 0,
      settledAt: Date.now(),
      updatedAt: Date.now(),
    })
    await get().refresh()
  },

  /* ================= 签到 ================= */

  tiersFor: (task) => {
    const target = task.checkInTargetCount ?? 5
    return defaultTiers(task.cycle, target)
  },

  checkInDays: (taskId) => {
    const { checkInProgress, settings } = get()
    const key = periodKeyFor(
      get().tasks.find((t) => t.id === taskId)?.cycle ?? 'daily',
      Date.now(),
      settings.dayStartHour,
    )
    return checkInProgress.find((p) => p.taskId === taskId && p.periodKey === key)?.days ?? []
  },

  /**
   * 宝贝点了「今天签到」。
   *
   * 和普通任务一样分两条路：
   *  * parentReviewEnabled（默认开）→ 只把今天挂进 `pendingDays`（等爸爸妈妈看）。
   *    **不发积分、不写签到记录、不计入坚持天数、不触发阶梯奖励** ——
   *    否则孩子自己点一下就给自己发奖，等于自评自奖。
   *  * 家长关掉审核 → 直接发放（老行为，方便家长自己试玩）。
   */
  doCheckIn: async (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return { gained: 0, bonus: 0 }
    const { settings } = get()
    const today = currentDayKey(settings.dayStartHour)
    const pk = periodKeyFor(task.cycle, Date.now(), settings.dayStartHour)

    const progress = await ensureCheckInProgress(taskId, pk)

    if (progress.days.includes(today)) {
      get().pushToast({ kind: 'info', title: '今天已经签过啦', emoji: '✅' })
      return { gained: 0, bonus: 0 }
    }
    if ((progress.pendingDays ?? []).includes(today)) {
      get().pushToast({
        kind: 'info',
        title: '今天已经交上去啦',
        detail: '等爸爸妈妈看一眼',
        emoji: '📮',
      })
      return { gained: 0, bonus: 0 }
    }

    if (settings.parentReviewEnabled) {
      progress.pendingDays = [...(progress.pendingDays ?? []), today].sort()
      progress.updatedAt = Date.now()
      await db.checkInProgress.put(progress)
      get().pushToast({
        kind: 'success',
        title: '交上去啦！等爸爸妈妈看一眼',
        detail: '他们确认后积分就到账咯',
        emoji: '📮',
      })
      await get().refresh()
      return { gained: 0, bonus: 0 }
    }

    const r = await grantCheckIn(get, task, progress, today, pk)
    await get().refresh()
    return r
  },

  /**
   * 家长确认一次签到 —— 发积分 + 计入坚持天数 + 结算已达成的阶梯奖励。
   *
   * `periodKey` 必须由调用方带上：日签的周期键每天都会变，
   * 用「当前时间」重算会定位到今天那一行，昨天挂起的待审就永远没人处理。
   */
  approveCheckIn: async (taskId, periodKey, date) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return 0
    const progress = await db.checkInProgress
      .where('[taskId+periodKey]')
      .equals([taskId, periodKey])
      .first()
    if (!progress) return 0
    if (progress.days.includes(date)) {
      get().pushToast({ kind: 'info', title: '这天已经确认过了', emoji: '✅' })
      return 0
    }
    if (!(progress.pendingDays ?? []).includes(date)) return 0

    progress.pendingDays = (progress.pendingDays ?? []).filter((d) => d !== date)
    const r = await grantCheckIn(get, task, progress, date, periodKey)
    await get().refresh()
    return r.gained + r.bonus
  },

  /** 家长打回一次签到：从待审里摘掉，孩子可以重签 */
  rejectCheckIn: async (taskId, periodKey, date) => {
    const progress = await db.checkInProgress
      .where('[taskId+periodKey]')
      .equals([taskId, periodKey])
      .first()
    if (!progress) return
    const before = progress.pendingDays ?? []
    if (!before.includes(date)) return
    progress.pendingDays = before.filter((d) => d !== date)
    progress.updatedAt = Date.now()
    await db.checkInProgress.put(progress)
    get().pushToast({ kind: 'info', title: '已让孩子重新签到', emoji: '🔁' })
    await get().refresh()
  },

  claimCheckInTier: async (taskId, days) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return 0
    const { settings } = get()
    const pk = periodKeyFor(task.cycle, Date.now(), settings.dayStartHour)
    const progress = await db.checkInProgress
      .where('[taskId+periodKey]')
      .equals([taskId, pk])
      .first()
    if (!progress) return 0
    const tiers = defaultTiers(task.cycle, task.checkInTargetCount ?? 5)
    const tier = tiers.find((t) => t.days === days)
    if (!tier || progress.claimedTiers.includes(days) || progress.days.length < days) return 0
    progress.claimedTiers = [...progress.claimedTiers, days]
    await db.checkInProgress.put(progress)
    await postLedger({
      delta: tier.points,
      source: 'checkin_bonus',
      refId: `${taskId}:${pk}:${days}`,
      memo: `签到奖励 · ${tier.label}`,
    })
    if (tier.itemId) await addItem(tier.itemId, 1)
    await get().refresh()
    return tier.points
  },

  /* ================= 周期任务（周/月/年） ================= */

  periodUnitsFor: (task) => {
    const { instances, settings } = get()
    const pk = periodKeyFor(task.cycle, Date.now(), settings.dayStartHour)
    const subs = instances.filter((i) => i.taskId === task.id && i.periodKey === pk)
    return buildPeriodUnits(task, subs)
  },

  submitPeriodTask: async (taskId, actualMinutes, quality) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return 0
    const { settings } = get()
    const pk = periodKeyFor(task.cycle, Date.now(), settings.dayStartHour)
    const target = task.checkInTargetCount ?? 1
    const rows = await db.taskInstances.where('[taskId+periodKey]').equals([taskId, pk]).toArray()
    const settled = rows.filter(
      (i) => (i.status === 'completed' || i.status === 'failed') && i.settledAt != null,
    ).length
    if (settled >= target) {
      get().pushToast({ kind: 'info', title: '这个周期的目标已经完成啦', emoji: '✅' })
      return 0
    }
    // 待审核的也要占位。否则家长还没确认时孩子连点几下，
    // 家长那边会冒出一串一模一样的待办 —— 审核一遍等于白审。
    const pending = rows.filter((i) => i.status === 'submitted').length
    if (settled + pending >= target) {
      get().pushToast({
        kind: 'info',
        title: '都交上去啦',
        detail: '等爸爸妈妈确认',
        emoji: '📮',
      })
      return 0
    }

    const now = Date.now()
    const day = currentDayKey(settings.dayStartHour)
    // 同一天不能重复记一次 —— 唯一键是 [taskId+periodKey+date]。
    // 提前拦是为了给人话提示，而不是抛 ConstraintError 把按钮卡死。
    if (rows.some((i) => i.date === day)) {
      get().pushToast({
        kind: 'info',
        title: '今天已经记过一次啦',
        detail: '明天再来吧',
        emoji: '📅',
      })
      return 0
    }
    const inst: TaskInstance = {
      id: uid('ti'),
      taskId,
      periodKey: pk,
      date: day,
      title: task.title,
      category: task.category,
      cycle: task.cycle,
      plannedMinutes: task.plannedMinutes,
      basePoints: task.basePoints,
      qualityBonusPoints: task.qualityBonusPoints,
      allowOvertime: task.allowOvertime,
      allowLateNoPenalty: task.allowLateNoPenalty,
      qualityRated: task.qualityRated,
      rewardItemIds: task.rewardItemIds ?? [],
      status: 'pending',
      // 周期任务没有"开始计时"概念：直接依据提交时传入的用时结算。
      // 注意这里不预写 actualMinutes —— 若写入后结算未完成，该行会被
      // 计入"已完成"而下一次提交又新建一条，造成重复计分。
      createdAt: now,
      updatedAt: now,
    }
    try {
      await db.taskInstances.put(inst)
    } catch {
      // 并发窗口的兜底：另一路刚写进去了。
      // 以前这里的异常会一路抛到 handleOnce，`setBusy(false)` 永远执行不到，
      // 按钮就永远停在「记录中…」——孩子只能杀掉 App。
      get().pushToast({ kind: 'info', title: '刚刚已经记过一次啦', emoji: '✅' })
      return 0
    }
    await get().refresh()
    return get().submitInstance(inst.id, actualMinutes, quality)
  },

  /* ================= 农场 ================= */

  plant: async (plotIndex, cropId) => {
    const def = CROP_BY_ID.get(cropId)
    if (!def) return false
    const { plots } = get()
    const plot = plots.find((p) => p.index === plotIndex)
    if (!plot || !plot.unlocked || plot.crop) return false

    // 优先消耗背包里的种子，其次从商店扣积分买
    const seedItemId = `seed-${cropId}`
    const inv = get().inventory.find((i) => i.itemId === seedItemId)
    let paid = 0
    if (inv && inv.count > 0) {
      await consumeItem(seedItemId, 1)
    } else {
      if (get().balance < def.seedCost) {
        get().pushToast({ kind: 'warn', title: '积分不够买种子', emoji: '🪙' })
        return false
      }
      paid = -def.seedCost
      await postLedger({
        delta: paid,
        source: 'farm_plant',
        refId: `plot:${plotIndex}`,
        memo: `购买种子：${def.name}`,
      })
    }

    const nextPlots = plots.map((p) =>
      p.index === plotIndex
        ? {
            ...p,
            crop: { cropId, plantedAt: Date.now(), harvestedCount: 0 },
          }
        : p,
    )
    await savePlots(nextPlots)
    await get().bumpFarmTotals({ planted: get().farmTotals.planted + 1 })

    get().pushToast({
      kind: 'success',
      title: `种下了${def.name}`,
      detail: `${def.growMinutes} 分钟后就能收啦`,
      emoji: def.emoji,
    })
    await get().refresh()
    return true
  },

  harvest: async (plotIndex, mode = 'store') => {
    const { plots, settings } = get()
    const plot = plots.find((p) => p.index === plotIndex)
    if (!plot?.crop) return 0
    const def = cropDefOf(plot)
    const timeScale = settings.farmClock?.timeScale ?? 1
    if (!def || !isCropMature(plot, Date.now(), timeScale)) return 0

    const now = Date.now()

    // ---- 随机事件 + 周末/节假日加成 ----
    // 事件在「收获」这一刻结算，而不是后台悄悄扣 ——
    // 孩子必须亲眼看到损失，才学得到"务农风险"。
    const roll = rollHarvestEvent(
      plot,
      def,
      now,
      settings.farmEventsEnabled !== false,
      plot.crop.harvestedCount,
    )

    // 节假日/周末加成：**刻意不提示**，只体现在最终数字上。
    // 孩子会自己发现"周末收成特别好"，这正是我们要的效果。
    const bonus = seasonalBonus(now)

    // ---- 产量：灾害倍率作用在**数量**上 ----
    //
    // 为什么单次产量是 4 而不是 1：倍率区间是 0.45~1.2，每次只产 1 个的话
    // `round(1 × 0.7) = 1` —— 灾害就完全看不见了。4 个才表达得出 2/3/4/5。
    // 放大单次产量**不改变经济数值**（产量 × 单价 恒定），只改变颗粒度。
    const perHarvest = def.produceAmount ?? 1
    const rolled = roll.wipedOut
      ? 0
      : Math.max(0, Math.round(perHarvest * roll.multiplier * bonus))

    // ---- 甲：产量封顶在「满产」（2026-09-19）----
    //
    // 闸门是按**满产**配的（`capFor = 满产 × 整数单价`），而上面的季节加成
    // 会把产量顶过满产：平日 4 → 周末 5 → 儿童节 7。多出来的那几个
    // **永远卖不掉**（额度只够满产），变成背包里的死库存 ——
    // 2026-09-19 实测：周末 `e2e-bag-sell` 出现「收进 5 个，卖了 4 个，剩 1 个」。
    //
    // 封顶之后加成的语义变成「**倒霉的时候也能收满**」而不是「多赚钱」：
    // 虫灾（×0.75）平时只收 3 个，周末 ×1.35 就能收满 4 个。
    // 加成本来就是刻意不提示的（孩子自己发现「周末收成好」），这个改动
    // 不改提示、也不改闸门，只是**让产出不再超出闸门能付的量**。
    // 见 docs/farm-economy-design.md §6.1.2。
    const amount = Math.min(perHarvest, rolled)

    // ---- 产出进背包。**钱不在这一步结算** ----
    // 「直接卖」和「存储」的差别只在于**什么时候定价**：
    //   sell  → 立刻按当日市价结算
    //   store → 留在背包，之后按卖出日市价结算
    if (amount > 0) {
      await addItem(def.produceItemId, amount)
    }

    // 收藏品掉落：歉收/绝收时不给掉落（损失要真实）
    if (amount > 0 && def.harvestItemId) {
      await addItem(def.harvestItemId, def.harvestItemCount ?? 1)
    }

    // 事件写进农场日志
    if (roll.event) {
      await logFarmEvents([roll.event])
    }

    const isPerennial = def.kind === 'perennial'

    const nextPlots = plots.map((p) => {
      if (p.index !== plotIndex || !p.crop) return p

      // 事件导致整棵枯死（只对多年生）
      if (roll.died) {
        return {
          ...p,
          crop: {
            ...p.crop,
            diedAt: now,
            lastEvent: roll.event?.message,
            lossCount: (p.crop.lossCount ?? 0) + 1,
          },
        }
      }

      const used = p.crop.harvestedCount + 1

      // 一次性作物：收完就是空地
      if (!isPerennial && used >= def.regrowCount) {
        return { ...p, crop: undefined }
      }
      // 多年生：收满次数也还留着（它是"长期资产"），但要重新结果
      if (isPerennial && used >= def.regrowCount) {
        return { ...p, crop: { ...p.crop, harvestedCount: used } }
      }

      // 重新计时。多年生用 regrowMinutes（果树结果间隔），
      // 一年生用 growMinutes（重新长一轮）。
      const regrow = isPerennial ? (def.regrowMinutes ?? def.growMinutes) : def.growMinutes
      return {
        ...p,
        crop: {
          ...p.crop,
          plantedAt: now - (def.growMinutes - regrow) * 60000,
          harvestedCount: used,
          lastEvent: roll.event?.message,
          lossCount: roll.wipedOut ? (p.crop.lossCount ?? 0) + 1 : p.crop.lossCount,
        },
      }
    })
    // ---- 额度结转：作物离场时，把这一轮没用完的额度搬走 ----
    //
    // 闸门是挂在**活着的**标的上的（`capTargetsFor` 只看 plots / animals）。
    // 一次性作物收完地块就变空地，标的消失，剩下那点额度会跟着地块一起蒸发 ——
    // 背包里刚收的这批产出就再也卖不掉了，而「收进背包」按钮上明写着
    // 「先存着，等市场上价格好的时候自己卖」。所以必须把它结转出去。
    //
    // 只在**作物真的离开地块**时结转：多年生收满次数后还留在地里，
    // 它那个标的还在，额度不用搬。
    const r = settings.profitRatio ?? DEFAULT_PROFIT_RATIO
    const cleared = !nextPlots.find((p) => p.index === plotIndex)?.crop
    let nextCarry = get().quotaCarry
    if (cleared) {
      const leftover = leftoverCapFor(plot.crop.cropId, plot.crop.earnedSoFar ?? 0, r)
      if (leftover > 0) {
        nextCarry = {
          ...nextCarry,
          [def.produceItemId]: (nextCarry[def.produceItemId] ?? 0) + leftover,
        }
        await saveQuotaCarry(nextCarry)
      }
    }

    // ⚠️ `nextPlots` 必须**写回 store**，不能只写 DB。
    //
    // 只写 DB 的话，下面 `sellProduce` 读到的是「作物还在」的旧快照，
    // 它会拿这份旧快照再调一次 `savePlots`，把刚才清干净的地块**覆盖回去** ——
    // 一次性作物的地永远收不干净，`harvestedCount` 也不前进，
    // 同一棵能反复收（2026-09-15 探针实测：收完仍是
    // `{cropId:'radish', harvestedCount:0}`）。
    set({ plots: nextPlots, quotaCarry: nextCarry })
    await savePlots(nextPlots)
    await get().bumpFarmTotals({ harvests: get().farmTotals.harvests + 1 })

    // ---- 「直接卖」：收获完立刻走一次卖出，用当日市价 ----
    // 走 sellProduce 是为了共用同一套闸门与卖压逻辑，不另开一条结算通道。
    let earned = 0
    if (mode === 'sell' && amount > 0) {
      earned = await get().sellProduce(def.produceItemId, amount, { quiet: true })
    }

    // ---- 反馈 ----
    if (roll.event) {
      set({
        settleFlash: {
          points: earned,
          reason: roll.event.message,
          emoji: roll.event.emoji,
        },
      })
      get().pushToast({
        kind: roll.wipedOut ? 'warn' : roll.multiplier > 1.1 ? 'reward' : 'info',
        title: roll.wipedOut
          ? '这次没收到东西…'
          : `收获 ${def.name} +${amount} ${produceUnitOf(def.produceItemId)}`,
        detail: roll.event.message,
        emoji: roll.event.emoji,
      })
    } else {
      set({
        settleFlash: { points: earned, reason: `收获了 ${def.name}！`, emoji: def.emoji },
      })
      get().pushToast({
        kind: 'reward',
        title: `收获 ${def.name} +${amount} ${produceUnitOf(def.produceItemId)}`,
        detail:
          mode === 'sell'
            ? `当场卖掉，+${earned} 丰收币`
            : '已经放进背包，去市场卖个好价钱吧',
        emoji: def.emoji,
      })
    }

    await get().refresh()
    return earned
  },

  unlockPlot: async (plotIndex) => {
    const { plots, balance } = get()
    const plot = plots.find((p) => p.index === plotIndex)
    if (!plot || plot.unlocked) return false
    if (balance < plot.unlockCost) {
      get().pushToast({ kind: 'warn', title: '积分还不够开这块地', emoji: '🪙' })
      return false
    }
    await postLedger({
      delta: -plot.unlockCost,
      source: 'farm_purchase',
      refId: `plot:${plotIndex}`,
      memo: `开垦新地块 #${plotIndex + 1}`,
    })
    await savePlots(plots.map((p) => (p.index === plotIndex ? { ...p, unlocked: true } : p)))
    get().pushToast({ kind: 'success', title: '新地块开好啦！', emoji: '🌱' })
    await get().refresh()
    return true
  },

  water: async (plotIndex) => {
    const { plots, settings } = get()
    const plot = plots.find((p) => p.index === plotIndex)
    if (!plot?.crop || plot.crop.diedAt) return
    const inv = get().inventory.find((i) => i.itemId === 'fertilizer')
    if (!inv || inv.count <= 0) {
      get().pushToast({ kind: 'info', title: '没有神奇肥料了', emoji: '💩' })
      return
    }
    await consumeItem('fertilizer', 1)
    const def = cropDefOf(plot)
    if (!def) return
    // 肥料：立刻推进 50% 剩余时间（按农场时间算）
    const timeScale = settings.farmClock?.timeScale ?? 1
    const elapsedFarm = farmMinutes(Date.now() - plot.crop.plantedAt, timeScale)
    const remaining = Math.max(0, def.growMinutes - elapsedFarm)
    const nextPlots = plots.map((p) =>
      p.index === plotIndex && p.crop
        ? {
            ...p,
            crop: {
              ...p.crop,
              // 把已生长时间拉长到「总量 - 剩余一半」，等价于跳过一半剩余时间
              plantedAt: Date.now() - ((def.growMinutes - remaining * 0.5) / timeScale) * 60000,
            },
          }
        : p,
    )
    await savePlots(nextPlots)
    get().pushToast({ kind: 'success', title: '施肥啦，长得更快了', emoji: '✨' })
    await get().refresh()
  },

  buyAnimal: async (animalId, name) => {
    const def = ANIMAL_BY_ID.get(animalId)
    if (!def) return false
    if (get().balance < def.cost) {
      get().pushToast({ kind: 'warn', title: '积分不够买小动物', emoji: '🪙' })
      return false
    }
    await postLedger({
      delta: -def.cost,
      source: 'farm_purchase',
      refId: animalId,
      memo: `领养了${def.name}`,
    })
    const now = Date.now()
    await db.animals.put({
      id: uid('an'),
      animalId,
      name: name || def.name,
      bornAt: now,
      lastFedAt: now,
      lastProduceAt: now,
      pendingProduce: 0,
      feedCount: 0,
      careCount: 0,
    })
    get().pushToast({
      kind: 'success',
      title: `${name || def.name} 来农场啦！`,
      detail: `${def.matureMinutes} 分钟后长大`,
      emoji: def.babyEmoji,
    })
    await get().refresh()
    return true
  },

  feedAnimal: async (animalId) => {
    const { animals } = get()
    const a = animals.find((x) => x.id === animalId)
    if (!a) return false
    if (a.deceased) {
      get().pushToast({ kind: 'info', title: `${a.name} 已经去很远的地方了`, emoji: '🕊️' })
      return false
    }
    // 投喂消耗 1 个鸡蛋；没有就免费喂（低龄友好，不卡孩子）
    const fed = await consumeItem('egg', 1)
    if (fed) {
      await postLedger({
        delta: 0,
        source: 'farm_feed',
        refId: animalId,
        memo: `用鸡蛋喂了 ${a.name}`,
      })
    }
    const wasSick = !!a.sickAt
    await db.animals.update(animalId, {
      lastFedAt: Date.now(),
      feedCount: a.feedCount + 1,
      // 喂一喂就治好 —— 给足补救窗口，不让孩子因为"忘了"而永久失去
      ...(wasSick ? { sickAt: undefined, lastEvent: `${a.name}好起来啦！` } : {}),
    })
    const def = animalDefOf(a)

    if (wasSick) {
      await logFarmEvents([
        {
          id: `ev-recover-${animalId}-${Date.now()}`,
          kind: 'animal_recovered',
          message: `${a.name}吃了东西，精神多了！`,
          emoji: '💚',
          createdAt: Date.now(),
          refId: animalId,
        },
      ])
      set({
        settleFlash: { points: 0, reason: `${a.name} 康复了！`, emoji: '💚' },
      })
    }

    get().pushToast({
      kind: 'success',
      title: wasSick ? `${a.name} 好起来了` : `${a.name} 吃饱啦`,
      detail: def ? `心情变好了，会尽快产出${def.produceItemName}` : undefined,
      emoji: wasSick ? '💚' : '😋',
    })
    await get().refresh()
    return true
  },

  collectAnimal: async (animalId) => {
    const { animals, settings } = get()
    const a = animals.find((x) => x.id === animalId)
    if (!a || a.pendingProduce <= 0) return 0
    const def = animalDefOf(a)
    if (!def) return 0

    const now = Date.now()

    // ---- 减产骰子 + 周末/节假日加成 ----
    //
    // 和作物同一条原则：**在「收下产出」这一刻结算，不在 `advanceAnimals` 里
    // 偷偷扣。** 孩子必须亲眼看到「这批只剩 70%」才学得到。
    // 分布与作物**共用同一套** `HARVEST_TIERS`（原因见 rollAnimalProduceEvent）。
    //
    // ⚠️ 别把这一句挪进 `advanceAnimals`：数值上等价，但那是后台扣，
    // 孩子看不到损失，这一层就白加了。
    const roll = rollAnimalProduceEvent(a, def, now, settings.farmEventsEnabled !== false)

    // 骰子作用在**单次产出**上，再乘以轮数 —— 不是直接乘整批。
    //
    // 为什么：`round()` 的颗粒度是 1 个。直接乘整批的话，「攒 5 轮一起收」和
    // 「每轮收一次」会因为取整落在不同的位置，算出不同的期望
    // （实测 小鸡 34.5% vs 45.9%，差 11 个点）——
    // 等于**孩子的收益取决于他怎么点按钮**，而这个他根本看不见。
    // 作用在单次产出上再线性放大，期望就只和标的本身有关、与攒几轮无关；
    // 颗粒度也正好和作物一致（作物也是每次收获掷一次、单次产量 4）。
    const perCycle = def.produceAmount || 1
    const cycles = Math.max(1, Math.round(a.pendingProduce / perCycle))
    const perCycleOut = roll.wipedOut
      ? 0
      : Math.max(0, Math.round(perCycle * roll.multiplier))

    // 产出也吃周末/节假日加成 —— 同样不提示
    const bonus = seasonalBonus(now)
    // ---- 甲：这一批封顶在「按理该产的量」（2026-09-19）----
    //
    // 和作物同一个道理（见 `harvest` 里的注释）：`cycles × perCycle` 是这批
    // **排程上该产多少**，也就是闸门（`capFor = 满产 × 整数单价`）付得起的上限。
    // 加成再多也不越过它，否则多出来的蛋同样卖不掉。
    // 逐批封顶 ⇒ 一生累计也不会超（`pendingProduce` 本身就被 `produceTimes` 卡住）。
    const scheduled = cycles * perCycle
    const gained = Math.max(0, Math.min(scheduled, Math.round(perCycleOut * cycles * bonus)))

    if (gained > 0) await addItem(def.produceItemId, gained)
    await db.animals.update(animalId, {
      pendingProduce: 0,
      lastProduceAt: now,
    })
    if (roll.event) await logFarmEvents([roll.event])

    set({
      settleFlash: {
        points: 0,
        reason:
          gained > 0
            ? `收到 ${gained} ${produceUnitOf(def.produceItemId)}${def.produceItemName}！`
            : `这批${def.produceItemName}没保住…`,
        emoji: gained > 0 ? def.produceEmoji : '🪹',
      },
    })
    get().pushToast({
      kind: gained > 0 ? 'reward' : 'warn',
      title:
        gained > 0
          ? `+${gained} ${produceUnitOf(def.produceItemId)}${def.produceItemName}`
          : '这批没收到',
      // 有事件就把事件原文说出来（「这批只剩 70%」就在里面），
      // 没有事件（中性档）才退回原来的提示。
      // 卖产出结的是**丰收币**，不是积分 —— 别写回「换积分」。
      detail: roll.event?.message ?? '去市场卖掉就能换丰收币啦',
      emoji: gained > 0 ? def.produceEmoji : '🪹',
    })
    await get().refresh()
    return gained
  },

  shearAnimal: async (animalId) => {
    const { animals, settings } = get()
    const a = animals.find((x) => x.id === animalId)
    if (!a) return false
    const timeScale = settings.farmClock?.timeScale ?? 1
    if (a.deceased) {
      get().pushToast({ kind: 'info', title: `${a.name} 已经去很远的地方了`, emoji: '🕊️' })
      return false
    }
    if (!isAnimalMature(a, Date.now(), timeScale)) {
      get().pushToast({ kind: 'info', title: `${a.name} 还没长大呢`, emoji: '🐣' })
      return false
    }
    const wasSick = !!a.sickAt
    await db.animals.update(animalId, {
      careCount: a.careCount + 1,
      // 摸一摸也能治病
      ...(wasSick ? { sickAt: undefined, lastEvent: `${a.name}被摸得开心，好起来了！` } : {}),
    })
    const def = animalDefOf(a)
    await get().bumpFarmTotals({ sheared: get().farmTotals.sheared + 1 })
    get().pushToast({
      kind: 'success',
      title: wasSick ? `${a.name} 好起来了！` : `${a.name} 好开心！`,
      emoji: def?.emoji ?? '🐑',
    })
    await get().refresh()
    return true
  },

  removeAnimal: async (animalId) => {
    await db.animals.delete(animalId)
    await get().refresh()
  },

  /* ---------------- 农场市场 ---------------- */

  priceFor: (itemId) => {
    const r = get().settings.profitRatio ?? DEFAULT_PROFIT_RATIO
    return priceOf(get().market, itemId, r) ?? PRODUCE_BASE_PRICE[itemId] ?? 0
  },

  quoteFor: (itemId, count) => {
    const r = get().settings.profitRatio ?? DEFAULT_PROFIT_RATIO
    return sellQuote(get().market, itemId, count, r)
  },

  /**
   * 到市场卖产出。
   *
   * **卖多少会影响价格**：`applySell` 会砸盘，压的是**卖出之后**的行情。
   * 这是刻意设计的市场教育 —— 孩子会看到「市场里的货一多，价钱就往下走」。
   *
   * ⚠️ 但**不要**说成「一次全卖光会比分开卖少拿钱」：`sellQuote` 是线性的
   * （现价 × 个数），同一批货在同一个价位上分几笔卖，总额是一样的。
   * 2026-09-16 之前 UI 上是这么写的，而那个差额恒为 0。
   * 要让「分批更划算」成立，得先改 `sellQuote`，见 `docs/farm-economy-design.md` §6.4。
   */
  sellProduce: async (itemId, count, opts) => {
    if (!MARKET_GOODS.includes(itemId) || count <= 0) return 0

    const { market, plots, animals, settings } = get()

    // ⚠️ `r` 必须先取出来再算价 —— 现价硬顶 = `上限回收 ÷ 满产` 是**跟着 r 变的**
    // （见 `priceCeilingFor`）。拿默认 0.6 去夹价，家长一旦调档，
    // 硬顶就和闸门对不上：调低 → 硬顶偏高 → 又开始剩货；调高 → 硬顶偏低 → 白少给钱。
    const r = settings.profitRatio ?? DEFAULT_PROFIT_RATIO

    const current = priceOf(market, itemId, r)
    if (current == null) return 0

    const name = ITEM_BY_ID.get(itemId)?.name ?? itemId

    // ---- 闸门：这一轮还能卖多少 ----
    // 「直接卖」和「存储后市场卖」走的是**同一个闸门**，
    // 所以「先存起来」不能绕过上限。
    const carry = get().quotaCarry[itemId] ?? 0
    const targets = capTargetsFor(itemId, plots, animals, r)
    const liveRemaining = targets.reduce((s, t) => s + t.remaining, 0)
    // 活着的标的 + 已经从收掉的地块上结转过来的，一起算额度
    const remaining = liveRemaining + carry

    if (remaining <= 0) {
      if (!opts?.quiet) {
        get().pushToast({
          kind: 'warn',
          title: '这一轮已经卖满啦',
          detail: '再卖就不给钱了。换点别的种吧 —— 种子随时都能买',
          emoji: '🚧',
        })
      }
      return 0
    }

    // ⚠️ **先按背包里实际有的夹一次，再算闸门。**
    //
    // UI 传的是「全卖」（99 / Infinity 之类）。如果直接把它交给 maxSellable，
    // 它会按 99 个去算能卖几个（比如 11 个），而背包只有 4 个 →
    // `consumeItem` 失败 → **整笔卖不出去，连那 4 个也卖不掉**。
    // 2026-09-15 由 E2E 第 4 层抓出来（`e2e-gameplay.mjs` 第 7 段）。
    //
    // 注意要从 **DB** 读，不能读 `get().inventory`：
    // `addItem` 只写 Dexie 不写 store，`harvest()` 里刚收进来的产出
    // 在 store 快照里还是旧的，读快照会得到 0。
    const heldRow = await db.inventory.get(itemId)
    const want = Math.min(count, heldRow?.count ?? 0)
    if (want <= 0) {
      if (!opts?.quiet) {
        get().pushToast({ kind: 'warn', title: '背包里没有这个', emoji: '📦' })
      }
      return 0
    }

    // 在闸门内最多能卖几个。**不是把多出来的白扔掉** ——
    // 卖不掉的留在背包里，等下一轮或者别的对象腾出额度。
    const { count: sellCount, total } = maxSellable(want, remaining, (n) =>
      sellQuote(market, itemId, n, r),
    )
    if (sellCount <= 0 || total <= 0) return 0

    const ok = await consumeItem(itemId, sellCount)
    if (!ok) {
      get().pushToast({ kind: 'warn', title: '背包里没有这么多', emoji: '📦' })
      return 0
    }

    // 市场是农场产出的唯一出口，结的是**丰收币**，不是积分。
    await postHarvest({
      delta: total,
      source: 'farm_market',
      refId: itemId,
      memo: `市场卖出 ${sellCount} ${produceUnitOf(itemId)}${name}（单价 ${current}）`,
    })

    // ---- 扣闸门 ----
    const deducted = applyCapDeduction(targets, total, plots, animals)
    await savePlots(deducted.plots)

    // 活着的标的先扣，**没扣完的从结转额度里扣**。
    // 不扣结转的话，一笔卖出会被记两次账：作物已经离场、targets 为空，
    // 于是「结转过来的额度」永远不减，同一批产出能反复卖。
    const fromLive = Math.min(total, liveRemaining)
    const fromCarry = Math.max(0, total - fromLive)
    if (fromCarry > 0) {
      const nextCarry = { ...get().quotaCarry }
      const left = (nextCarry[itemId] ?? 0) - fromCarry
      if (left > 1e-9) nextCarry[itemId] = left
      else delete nextCarry[itemId]
      await saveQuotaCarry(nextCarry)
      set({ quotaCarry: nextCarry })
    }
    const changedAnimals = deducted.animals.filter(
      (a, i) => a.earnedSoFar !== animals[i]?.earnedSoFar,
    )
    if (changedAnimals.length) await db.animals.bulkPut(changedAnimals)

    // 更新行情（价格被卖压打下来）
    const nextMarket = applySell(market, itemId, sellCount, r)
    await saveMarket(nextMarket)
    set({ market: nextMarket })

    const newPrice = priceOf(nextMarket, itemId, r) ?? current
    const dropPct = Math.round(((newPrice - current) / (current || 1)) * 100)

    if (!opts?.quiet) {
      get().pushToast({
        kind: 'reward',
        title: `卖出 ${sellCount} ${produceUnitOf(itemId)}${name}，+${total} 丰收币`,
        detail:
          sellCount < want
            ? `这一轮只剩 ${Math.round(remaining)} 丰收币的额度了，先卖了 ${sellCount} ${produceUnitOf(itemId)}`
            : dropPct < -1
              ? `卖得多了，价格跌到 ${newPrice} 丰收币（${dropPct}%）`
              : `当前单价 ${current} 丰收币`,
        emoji: '🌾',
      })
    }
    await get().refresh()
    return total
  },

  /* ================= 兑换商城 ================= */

  addRedeemItem: async (input) => {
    const now = Date.now()
    const item: RedeemItem = {
      ...input,
      id: uid('rd'),
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.redeemItems.put(item)
    await get().refresh()
    return item
  },

  updateRedeemItem: async (id, patch) => {
    await db.redeemItems.update(id, { ...patch, updatedAt: Date.now() })
    await get().refresh()
  },

  setRedeemItemArchived: async (id, archived) => {
    await db.redeemItems.update(id, { archived, updatedAt: Date.now() })
    await get().refresh()
  },

  deleteRedeemItem: async (id) => {
    // 只删兑换品本身。兑换记录（redeemRecords）是独立的表，且自带 name/emoji/cost
    // 快照 —— 所以已经换过的历史不会因为删掉商品而变成空白，待兑现的愿望也还在。
    await db.redeemItems.delete(id)
    await get().refresh()
  },

  redeemedToday: (itemId) => {
    const { redeemRecords, todayKey } = get()
    return redeemRecords.filter(
      (r) => r.itemId === itemId && toDateKey(r.createdAt) === todayKey,
    ).length
  },

  /**
   * 兑换。
   *
   * 原子性很关键：扣积分 + 写兑换记录必须在一个事务里，
   * 否则会出现「积分扣了但没记录」（家长不知道要兑现什么）
   * 或「有记录但没扣分」（白拿）的不一致。
   */
  redeem: async (itemId) => {
    const { balance, settings, redeemItems } = get()
    if (!settings.redeemEnabled) {
      get().pushToast({ kind: 'info', title: '兑换还没开放哦', emoji: '🔒' })
      return false
    }

    const item = redeemItems.find((i) => i.id === itemId)
    if (!item) return false

    if (balance < item.cost) {
      get().pushToast({
        kind: 'warn',
        title: '积分还不够',
        detail: `还差 ${item.cost - balance} 分，加油攒一攒`,
        emoji: '🪙',
      })
      return false
    }

    if (item.limitPerDay != null) {
      const used = get().redeemedToday(itemId)
      if (used >= item.limitPerDay) {
        get().pushToast({
          kind: 'warn',
          title: `今天「${item.name}」已经换过 ${used} 次了`,
          detail: '明天再来吧',
          emoji: '⏳',
        })
        return false
      }
    }

    const now = Date.now()
    let ok = true
    let balanceAfter = balance - item.cost

    await db.transaction('rw', [db.ledger, db.redeemRecords], async () => {
      // 余额以「delta 之和」为准，时间戳严格递增 —— 见 db.ts 的 ledgerTip
      const tip = await ledgerTip()
      if (tip.balance < item.cost) {
        ok = false
        return
      }
      balanceAfter = tip.balance - item.cost
      await db.ledger.put({
        id: `lg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        delta: -item.cost,
        balanceAfter,
        source: 'redeem',
        refId: item.id,
        memo: `兑换：${item.name}`,
        createdAt: tip.createdAt,
      })
      await db.redeemRecords.put({
        id: uid('rr'),
        itemId: item.id,
        name: item.name,
        emoji: item.emoji,
        cost: item.cost,
        balanceAfter,
        fulfilled: false,
        createdAt: now,
      })
    })

    if (!ok) {
      get().pushToast({ kind: 'warn', title: '积分不够啦', emoji: '🪙' })
      return false
    }

    set({
      settleFlash: {
        points: -item.cost,
        reason: `兑换了「${item.name}」`,
        emoji: item.emoji,
      },
    })
    get().pushToast({
      kind: 'reward',
      title: `兑换成功：${item.name}`,
      detail: '记得找爸爸妈妈兑现哦',
      emoji: item.emoji,
    })
    await get().refresh()
    return true
  },

  fulfillRedeem: async (recordId) => {
    await db.redeemRecords.update(recordId, { fulfilled: true, fulfilledAt: Date.now() })
    await get().refresh()
  },

  /* ================= 设置与数据 ================= */

  /**
   * 改设置。
   *
   * ⚠️ **`set` 必须在 `await` 之前。** 原来写的是「await 落库 → 再 set」，
   * 在慢设备上会让孩子/家长看到「刚打的字没了」。两个真实后果
   * （2026-09-18 由探针在 20× CPU 降速下复现）：
   *
   * ① **受控输入框会把刚敲的字吃掉。**
   *    设置页那个「孩子的小名」是 `value={settings.childName}` —— 值来自 store。
   *    `set` 落在 await 之后，于是在 IndexedDB 写返回之前 store 里还是旧名字，
   *    React 拿旧值重渲染，把刚输入的那个字**抹掉**。
   *    实测降速 20× 下输入「小明」只剩「明」。
   *
   * ② **同一 tick 内连续两次调用会丢更新。**
   *    第二次 `{ ...get().settings }` 读到的还是第一次 `set` 之前的旧快照，
   *    整体覆盖过去，把第一次的改动丢掉。
   *    而「点头像」正好是紧跟输入框的第二次调用 ——
   *    表现就是家长说的「填完名字一点头像，名字就变回原来的了」。
   *    实测：同一 tick 连调 `{childName:'同Tick'}` + `{avatar:'🦄'}`，
   *    childName 丢了、avatar 生效。
   *
   * 所以顺序改成「同步 set → 串行落库」。落库串行是防两次写完成顺序颠倒
   * （内存对了、DB 里却是旧值，重启后又变回去）。
   */
  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch }
    // 先同步更新内存：受控输入框、以及同一 tick 里的后续调用，立刻看到新值
    set({ settings: next })
    settingsWriteChain = settingsWriteChain.catch(() => {}).then(() => saveSettings(next))
    await settingsWriteChain
  },

  exportBackup: async () => {
    const [
      tasks,
      taskInstances,
      ledger,
      harvestLedger,
      inventory,
      animals,
      checkIns,
      checkInProgress,
      redeemItems,
      redeemRecords,
      farmEvents,
      settings,
      meta,
      farm,
      market,
      quotaCarry,
    ] = await Promise.all([
      db.tasks.toArray(),
      db.taskInstances.toArray(),
      db.ledger.toArray(),
      db.harvestLedger.toArray(),
      db.inventory.toArray(),
      db.animals.toArray(),
      db.checkIns.toArray(),
      db.checkInProgress.toArray(),
      db.redeemItems.toArray(),
      db.redeemRecords.toArray(),
      db.farmEvents.toArray(),
      loadSettings(),
      db.meta.toArray(),
      loadFarm(),
      loadMarket(),
      loadQuotaCarry(),
    ])
    return {
      app: 'kid-quest-farm',
      version: 2,
      exportedAt: Date.now(),
      data: {
        tasks,
        taskInstances,
        ledger,
        harvestLedger,
        inventory,
        animals,
        checkIns,
        checkInProgress,
        redeemItems,
        redeemRecords,
        events: farmEvents,
        market,
        settings,
        farm,
        /**
         * 从**已经收掉的地块**上结转过来、还没用掉的额度（按产出物 id）。
         *
         * ⚠️ 必须导出。它存在 `meta['farm.quotaCarry']` 里，而 `importBackup`
         * 会 `db.meta.clear()` —— 不导出就等于**每次导出/导入都把这笔额度清零**，
         * 背包里那些「收进背包」的一次性作物产出（地已经空了、额度只挂在这里）
         * 就**永久卖不掉**了，还骗孩子说「这一轮已经卖满啦」。
         * 2026-09-19 排查「背包有一个萝卜却卖不掉」时发现。
         */
        quotaCarry,
        meta: Object.fromEntries(meta.map((m) => [m.key, m.value])),
      },
    }
  },

  importBackup: async (raw) => {
    try {
      const parsed = raw as {
        app?: string
        data?: Record<string, unknown>
      }
      if (!parsed || parsed.app !== 'kid-quest-farm' || !parsed.data) {
        return { ok: false, message: '这不是小任务农场的备份文件' }
      }
      const d = parsed.data

      // ---- 先全量校验，再动数据 ----
      // 否则一个"app 字段正确但内容残缺"的文件会先清空旧数据、再写入失败，
      // 用户就永久丢失了原有记录。
      const validationError = validateBackup(d)
      if (validationError) {
        return { ok: false, message: validationError }
      }

      /**
       * 从备份里取一个「对象数组」字段。
       *
       * ⚠️ **主键字段名必须传进来。** 这里原来硬写 `'id' in x`，
       * 而 `InventorySlot` 的主键是 **`itemId`**（`{ itemId, count }`，没有 `id`）——
       * 于是 `pickArray(d.inventory)` 恒为 `null` → 落到 `[]` →
       * 前面刚 `db.inventory.clear()` 过 → **每次导入备份都把整个背包清空**。
       *
       * 讽刺的是 `validateBackup` 那边是对的：`BACKUP_ID_ARRAY_FIELDS`
       * 特意把 `inventory` 排除在外（作者知道它没有 `id`），
       * 可 `importBackup` 又用一个「所有字段都带 id」的 helper 去取它。
       * 校验和导入两套规则不一致，校验放行了、导入悄悄丢数据 —— 最坏的一种组合。
       * 2026-09-19 排查「背包里的萝卜卖不掉」时由单元测试抓出来。
       */
      const pickArray = <T,>(v: unknown, key = 'id'): T[] | null =>
        Array.isArray(v) && v.every((x) => x && typeof x === 'object' && key in (x as object))
          ? (v as T[])
          : null

      const rows = {
        tasks: pickArray<Task>(d.tasks) ?? [],
        taskInstances: pickArray<TaskInstance>(d.taskInstances) ?? [],
        ledger: pickArray<LedgerEntry>(d.ledger) ?? [],
        // 老备份里没有这个字段，`pickArray(undefined)` 返回 null，落到空数组。
        harvestLedger: pickArray<HarvestEntry>(d.harvestLedger) ?? [],
        // ⚠️ 背包的主键是 `itemId`，不是 `id` —— 见上面 `pickArray` 的注释
        inventory: pickArray<InventorySlot>(d.inventory, 'itemId') ?? [],
        animals: pickArray<Animal>(d.animals) ?? [],
        checkIns: pickArray<CheckInRecord>(d.checkIns) ?? [],
        checkInProgress: pickArray<CheckInProgress>(d.checkInProgress) ?? [],
        redeemItems: pickArray<RedeemItem>(d.redeemItems) ?? [],
        redeemRecords: pickArray<RedeemRecord>(d.redeemRecords) ?? [],
        events: pickArray<FarmEvent>(d.events) ?? [],
      }

      // 清空 + 写入放在同一个事务里：失败会自动回滚，不会留下半截数据
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
          await db.tasks.bulkPut(rows.tasks)
          await db.taskInstances.bulkPut(rows.taskInstances)
          await db.ledger.bulkPut(rows.ledger)
          if (rows.harvestLedger.length > 0) await db.harvestLedger.bulkPut(rows.harvestLedger)
          await db.inventory.bulkPut(rows.inventory)
          await db.animals.bulkPut(rows.animals)
          await db.checkIns.bulkPut(rows.checkIns)
          await db.checkInProgress.bulkPut(rows.checkInProgress)
          if (rows.redeemItems.length > 0) await db.redeemItems.bulkPut(rows.redeemItems)
          if (rows.redeemRecords.length > 0) await db.redeemRecords.bulkPut(rows.redeemRecords)
          if (rows.events.length > 0) await db.farmEvents.bulkPut(rows.events)
          if (d.settings && typeof d.settings === 'object') {
            await db.meta.put({ key: 'settings', value: d.settings })
          }
          const market = d.market as MarketState | undefined
          if (market && typeof market === 'object' && Array.isArray(market.quotes)) {
            await db.meta.put({ key: 'farm.market', value: market })
          }
          const farm = d.farm as FarmState | undefined
          if (farm && typeof farm === 'object') {
            if (Array.isArray(farm.plots)) {
              await db.meta.put({ key: 'farm.plots', value: farm.plots })
            }
            await db.meta.put({
              key: 'farm.totals',
              value: {
                harvests: Number(farm.totalHarvests) || 0,
                planted: Number(farm.totalPlanted) || 0,
                sheared: Number(farm.totalSheared) || 0,
              },
            })
            if (Number.isFinite(farm.farmDay)) {
              await db.meta.put({ key: 'farm.day', value: Number(farm.farmDay) })
            }
          }
          /**
           * 结转额度 —— **必须恢复**。
           *
           * 上面刚 `db.meta.clear()` 过，而结转额度就住在 `meta` 里。
           * 漏掉这一步的后果：背包里那些「收进背包」的一次性作物产出
           * （地已经空了，额度**只挂在这里**）会永久卖不掉 ——
           * `remainingCap` 归零，`sellProduce` 直接返回 0 并提示
           * 「这一轮已经卖满啦」，孩子看到的就是「背包里有一个萝卜，卖不掉」。
           * 2026-09-19 排查该现象时发现（`exportBackup` 那边也漏了）。
           *
           * 老备份里没有这个字段 → `d.quotaCarry` 是 undefined → 保持不写 key，
           * `loadQuotaCarry` 会兜底成 `{}`。所以**不需要动备份版本号**。
           */
          const carry = d.quotaCarry
          if (carry && typeof carry === 'object' && !Array.isArray(carry)) {
            const clean: Record<string, number> = {}
            for (const [k, v] of Object.entries(carry as Record<string, unknown>)) {
              // 和 `loadQuotaCarry` 同一套清洗规则，免得脏备份把负额度灌进来
              if (typeof v === 'number' && Number.isFinite(v) && v > 0) clean[k] = v
            }
            if (Object.keys(clean).length > 0) {
              await db.meta.put({ key: QUOTA_CARRY_KEY, value: clean })
            }
          }
        },
      )
      // 老备份没有兑换品 —— 恢复完补一份默认清单
      if (rows.redeemItems.length === 0) {
        const now = Date.now()
        await db.redeemItems.bulkPut(
          SEED_REDEEM_ITEMS.map((r) => ({ ...r, id: uid('rd'), createdAt: now, updatedAt: now })),
        )
      }
      await get().refresh()
      return { ok: true, message: '数据已恢复' }
    } catch (e) {
      return { ok: false, message: `恢复失败：${(e as Error).message}` }
    }
  },

  resetAll: async () => {
    await wipeAll()
    await get().boot()
  },

  /* ================= UI ================= */

  pushToast: (t) => {
    const id = uid('ts')
    set({ toasts: [...get().toasts, { ...t, id }] })
    setTimeout(() => get().dismissToast(id), 3400)
    // 音效 / 震动**统一挂在这里**，不散到几十个调用点去加。
    // 理由：toast 是「发生了一件值得告诉孩子的事」的唯一收口 ——
    // 任务结算、签到、农场收获、兑换、家长操作全都会经过它。
    // 散着加必然漏掉几个，而且以后新增事件又会忘。
    const s = get().settings
    const tone = TOAST_TONE[t.kind]
    if (tone) playTone(s.soundEnabled, tone)
    // `info` 是纯告知（「已下架」「已经交上去啦」），不出声也不震 ——
    // 家长连着点几下不该被震到手麻。
    if (t.kind !== 'info') void hapticLight(s.hapticsEnabled)
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) })
  },

  clearSettleFlash: () => set({ settleFlash: null }),

  bumpFarmTotals: async (patch) => {
    const next = { ...get().farmTotals, ...patch }
    set({ farmTotals: next })
    await saveFarmTotals(next)
  },
}))

/* ============================================================
   辅助选择器（供组件直接使用，避免重复计算）
   ============================================================ */

/** 今日实例：每日任务 + 今天创建的单次任务 */
export function selectTodayInstances(s: AppState): TaskInstance[] {
  // 排序：① 待完成在前 ② 同一组里按「任务定义」的顺序（家长排的顺序）
  // ③ 最后用实例 id 兜底，保证结果稳定。
  //
  // 第 ② 步以前是按实例的 createdAt 排的，但种子实例是同一毫秒批量
  // 写进去的，createdAt 全一样 → 排序退化成「按随机主键」，于是每次
  // 全新安装看到的任务先后都不一样（实测跑三次三个顺序）。
  const orderOf = new Map(s.tasks.map((t, i) => [t.id, i]))
  return s.instances
    .filter((i) => i.date === s.todayKey && i.cycle !== 'weekly' && i.cycle !== 'monthly' && i.cycle !== 'yearly')
    .sort((a, b) => {
      const rank = (i: TaskInstance) => (i.status === 'pending' ? 0 : 1)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      const oa = orderOf.get(a.taskId) ?? Number.MAX_SAFE_INTEGER
      const ob = orderOf.get(b.taskId) ?? Number.MAX_SAFE_INTEGER
      if (oa !== ob) return oa - ob
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
}

/** 长期任务（周/月/年） */
/**
 * 长期任务（周 / 月 / 年）。
 *
 * 必须排除签到任务：签到自己的卡片（日历 + 阶梯奖励）已经完整表达了
 * 「周期内坚持几天」，若这里再返回一次，同一张任务会同时出现在
 * 「长期任务」和「坚持签到」两个区块里，看起来像重复创建了任务。
 */
export function selectPeriodTasks(s: AppState): Task[] {
  return s.tasks.filter(
    (t) =>
      !t.checkInEnabled &&
      (t.cycle === 'weekly' || t.cycle === 'monthly' || t.cycle === 'yearly'),
  )
}

/** 签到任务 */
export function selectCheckInTasks(s: AppState): Task[] {
  return s.tasks.filter((t) => t.checkInEnabled)
}

/** 今日统计 */
export function selectTodayStats(s: AppState) {
  const today = s.instances.filter((i) => i.date === s.todayKey)
  const done = today.filter((i) => i.status === 'completed' || i.status === 'failed')
  const pending = today.filter((i) => i.status === 'pending')
  const submitted = today.filter((i) => i.status === 'submitted')
  const points = done.reduce((sum, i) => sum + (i.earnedPoints ?? 0), 0)
  const plannedMinutes = done.reduce((sum, i) => sum + i.plannedMinutes, 0)
  const actualMinutes = done.reduce((sum, i) => sum + (i.actualMinutes ?? 0), 0)
  const perfect = done.filter(
    (i) => i.settledAt != null && (i.actualMinutes ?? Infinity) <= i.plannedMinutes,
  )
  return {
    total: today.length,
    done: done.length,
    pending: pending.length,
    /** 等爸爸妈妈看的数量 —— 家长端的红点就靠它 */
    submitted: submitted.length,
    points,
    plannedMinutes,
    actualMinutes,
    perfect: perfect.length,
    rate: today.length === 0 ? 0 : Math.round((done.length / today.length) * 100),
  }
}

/**
 * 待家长审核的任务实例（全量，不限今天）。
 *
 * 不限今天是有意的：孩子昨晚交上来的，家长今早才审，
 * 如果只查今天，那条就会永远卡在 submitted 里没人管。
 */
export function selectPendingReview(s: AppState): TaskInstance[] {
  return s.instances
    .filter((i) => i.status === 'submitted')
    .sort((a, b) => (a.submittedAt ?? a.updatedAt) - (b.submittedAt ?? b.updatedAt))
}

/**
 * 待家长审核的签到。
 *
 * 签到没有任务实例 —— `taskInstances` 上有 `&[taskId+periodKey]` 唯一索引，
 * 一个周期只能有一行，装不下「一个周期内多天」。所以待审队列直接从
 * `CheckInProgress.pendingDays` 派生。
 *
 * 按日期升序排：先处理拖得最久的那一天。
 */
export function selectPendingCheckIns(
  s: Pick<AppState, 'checkInProgress' | 'tasks'>,
): PendingCheckIn[] {
  const titleOf = new Map(s.tasks.map((t) => [t.id, t.title]))
  const out: PendingCheckIn[] = []
  for (const p of s.checkInProgress) {
    const title = titleOf.get(p.taskId)
    // 任务被删掉了就丢弃这条待审，否则审核面板会卡在一个点不开的条目上
    if (!title) continue
    for (const date of p.pendingDays ?? []) {
      out.push({ taskId: p.taskId, title, date, periodKey: p.periodKey })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** 需要家长处理的兑换（已扣分但还没兑现） */
export function selectPendingRedeems(s: AppState): RedeemRecord[] {
  return s.redeemRecords
    .filter((r) => !r.fulfilled)
    .sort((a, b) => a.createdAt - b.createdAt)
}

/** 连续完成天数 */
export function selectStreak(s: AppState): number {
  const dates = new Set<string>()
  for (const i of s.instances) {
    if (i.earnedPoints && i.earnedPoints > 0 && i.completedAt) {
      dates.add(toDateKey(i.completedAt))
    }
  }
  return computeStreak([...dates], s.todayKey)
}

/** 农场等级信息 */
export function selectFarmLevel(s: AppState) {
  return farmLevel(s.farmTotals.harvests)
}

export { formatClock, periodKeyFor }

/* ============================================================
   调试句柄
   ------------------------------------------------------------
   暴露给 E2E 脚本与家长排查用。仅挂在 window 上，不参与业务逻辑，
   生产环境保留亦无副作用（不含敏感数据）。
   ============================================================ */
declare global {
  interface Window {
    __kqf__?: {
      getState: () => AppState
      exportBackup: () => Promise<unknown>
      importBackup: (raw: unknown) => Promise<{ ok: boolean; message: string }>
      version: string
      /**
       * 目录价格快照。给 E2E 脚本读用 —— 经济数值经常调，
       * 脚本里写死价格会变成"假失败"，所以让测试来问真实数值。
       */
      catalog: {
        cropSeedCost: (cropId: string) => number | undefined
        animalCost: (animalId: string) => number | undefined
        /**
         * 闸门：这个产出物现在还能卖出多少丰收币。
         * 给 E2E 对账用 —— 断言「界面上显示的数 == 领域函数算出来的数」，
         * 比在脚本里手算「成本 × 1.6 × 地块数」稳得多。
         */
        remainingCap: (itemId: string) => number
        /**
         * 现价硬顶（`上限回收 ÷ 满产` = 单位成本 × (1+r)）。
         * 给 E2E 对账用 —— 走势图上印的「上限 X」必须**等于**这个数。
         * 曾经它写死成 `基准价 × 1.6`（旧口径），画出来比真上限高 60%，
         * 还把 7 天走势压进图的下半部分。断言「界面上的数 == 领域函数算出来的数」
         * 是唯一能钉住这类「UI 接线错、领域函数没错」的办法。
         */
        priceCeiling: (itemId: string) => number
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.__kqf__ = {
    getState: () => useApp.getState(),
    exportBackup: () => useApp.getState().exportBackup(),
    importBackup: (raw) => useApp.getState().importBackup(raw),
    version: '1.0.0',
    catalog: {
      cropSeedCost: (cropId) => CROPS.find((c) => c.id === cropId)?.seedCost,
      animalCost: (animalId) => ANIMALS.find((a) => a.id === animalId)?.cost,
      remainingCap: (itemId) => {
        const s = useApp.getState()
        return remainingCapFor(
          itemId,
          s.plots,
          s.animals,
          s.settings.profitRatio ?? DEFAULT_PROFIT_RATIO,
          s.quotaCarry[itemId] ?? 0,
        )
      },
      // 硬顶跟着家长的 r 变，所以这里也读活的 `profitRatio`（和 `MarketSheet` 一致）
      priceCeiling: (itemId) =>
        priceCeilingFor(
          itemId,
          useApp.getState().settings.profitRatio ?? DEFAULT_PROFIT_RATIO,
        ),
    },
  }
}

/* ============================================================
   派生数据的 React Hooks
   ------------------------------------------------------------
   这些 selector 每次调用都会构造新数组/新对象。Zustand v5 要求
   selector 返回稳定引用，否则会触发
   "The result of getSnapshot should be cached" 死循环。
   因此统一用 useShallow 包一层，并只订阅其依赖的原始切片。
   ============================================================ */

/** 今日任务实例 */
export function useTodayInstances(): TaskInstance[] {
  return useApp(
    useShallow((s) => selectTodayInstances(s)),
  )
}

/** 今日统计 */
export function useTodayStats(): ReturnType<typeof selectTodayStats> {
  return useApp(useShallow((s) => selectTodayStats(s)))
}

/** 连续完成天数 */
export function useStreak(): number {
  return useApp((s) => selectStreak(s))
}

/** 长期任务（周/月/年） */
export function usePeriodTasks(): Task[] {
  return useApp(useShallow((s) => selectPeriodTasks(s)))
}

/** 签到任务 */
export function useCheckInTasks(): Task[] {
  return useApp(useShallow((s) => selectCheckInTasks(s)))
}

/** 农场等级 */
export function useFarmLevel(): ReturnType<typeof selectFarmLevel> {
  return useApp(useShallow((s) => selectFarmLevel(s)))
}

/** 待家长审核的任务 */
export function usePendingReview(): TaskInstance[] {
  return useApp(useShallow((s) => selectPendingReview(s)))
}

/**
 * 待家长审核的签到。
 *
 * ⚠️ 这里**不能**用 `useShallow(selectPendingCheckIns)`。
 * `selectPendingCheckIns` 每次调用都 new 一批对象出来，而 useShallow 是拿
 * `Object.is` 逐个比数组元素的 —— 新建的对象永远判不等，于是快照每次都在变，
 * `useSyncExternalStore` 判定"又变了"→ 重渲染 → 再算一次又变 → **无限循环**
 * （现场表现就是 React #185 / Maximum update depth exceeded）。
 *
 * 正确做法：只订阅两个稳定的原始切片，再用 useMemo 派生。
 */
export function usePendingCheckIns(): PendingCheckIn[] {
  const checkInProgress = useApp((s) => s.checkInProgress)
  const tasks = useApp((s) => s.tasks)
  return useMemo(
    () => selectPendingCheckIns({ checkInProgress, tasks }),
    [checkInProgress, tasks],
  )
}

/** 待家长兑现的兑换记录 */
export function usePendingRedeems(): RedeemRecord[] {
  return useApp(useShallow((s) => selectPendingRedeems(s)))
}

/* 连击奖励发放（内部） */
let lastStreakPaidDay = ''
async function maybePayStreakBonus(): Promise<number> {
  const s = useApp.getState()
  const today = s.todayKey
  if (lastStreakPaidDay === today) return 0
  const streak = selectStreak(s)
  if (streak <= 1) return 0
  const bonus = Math.min(
    s.settings.streakBonusCap,
    streak * s.settings.streakBonusPerDay,
  )
  if (bonus <= 0) return 0
  lastStreakPaidDay = today
  await postLedger({
    delta: bonus,
    source: 'streak_bonus',
    memo: `连续 ${streak} 天完成任务 🔥`,
  })
  return bonus
}
