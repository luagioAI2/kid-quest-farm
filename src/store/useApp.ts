import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
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
  db,
  DEFAULT_SETTINGS,
  loadAllRedeemItems,
  loadFarm,
  loadFarmEvents,
  loadMarket,
  loadRedeemItems,
  loadRedeemRecords,
  loadSettings,
  logFarmEvents,
  postLedger,
  saveFarmDay,
  saveFarmTotals,
  saveMarket,
  savePlots,
  saveSettings,
  wipeAll,
} from '../db/db'
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
  ITEM_BY_ID,
  MARKET_GOODS,
  PRODUCE_BASE_PRICE,
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
  balance: number
  todayKey: string

  toasts: Toast[]
  settleFlash: { points: number; reason: string; emoji: string } | null

  /** 农场累计统计（收获 / 种植 / 互动） */
  farmTotals: { harvests: number; planted: number; sheared: number }
  bumpFarmTotals: (patch: Partial<AppState['farmTotals']>) => Promise<void>

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
  doCheckIn: (taskId: string) => Promise<{ gained: number; bonus: number; tierLabel?: string }>
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
  harvest: (plotIndex: number) => Promise<number>
  unlockPlot: (plotIndex: number) => Promise<boolean>
  water: (plotIndex: number) => Promise<void>
  buyAnimal: (animalId: string, name: string) => Promise<boolean>
  feedAnimal: (animalId: string) => Promise<boolean>
  collectAnimal: (animalId: string) => Promise<number>
  shearAnimal: (animalId: string) => Promise<boolean>
  /** 到市场卖出产出（走浮动价，会砸盘） */
  sellProduce: (itemId: string, count: number) => Promise<number>
  /** 当前现价（用于 UI 预览） */
  priceFor: (itemId: string) => number
  /** 卖出 n 个能拿多少分（走浮动价，含砸盘影响） */
  quoteFor: (itemId: string, count: number) => number
  /** 清理已离世的动物 */
  removeAnimal: (animalId: string) => Promise<void>

  /* ---- 兑换商城 ---- */
  addRedeemItem: (input: NewRedeemInput) => Promise<RedeemItem>
  updateRedeemItem: (id: string, patch: Partial<RedeemItem>) => Promise<void>
  archiveRedeemItem: (id: string) => Promise<void>
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

/** 首次启动时注入的示例任务，让孩子立刻能玩起来 */
async function seedIfEmpty(): Promise<void> {
  const now = Date.now()

  const taskCount = await db.tasks.count()
  if (taskCount === 0) {
    const rows: Task[] = SEED_TASKS.map((t) => ({
      ...t,
      id: uid('tk'),
      createdAt: now,
      updatedAt: now,
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
   备份文件校验
   ------------------------------------------------------------
   只做结构校验（字段是否齐全、类型是否正确），不做业务校验。
   目的是在清空现有数据之前就把坏文件拦下来。
   ============================================================ */
const BACKUP_ARRAY_FIELDS = [
  'tasks',
  'taskInstances',
  'ledger',
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
async function doRefresh(
  set: (partial: Partial<AppState>) => void,
  get: () => AppState,
): Promise<void> {
  const { settings } = get()
  const today = currentDayKey(settings.dayStartHour)

  const tasks = await db.tasks.filter((t) => !t.archived).toArray()
  const allTasks = await db.tasks.toArray()
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
  const marketDay = Math.floor(now / (1000 * 60 * 60 * 24))
  const market = advanceMarket(await loadMarket(), marketDay)
  await saveMarket(market)

  if (newEvents.length > 0) {
    await logFarmEvents(newEvents)
  }

  const [
    instances,
    ledger,
    inventory,
    animals,
    checkIns,
    checkInProgress,
    balance,
    redeemItems,
    allRedeemItems,
    redeemRecords,
    farmEvents,
  ] = await Promise.all([
    db.taskInstances.orderBy('date').reverse().toArray(),
    // 全量加载流水。这里曾经 limit(500)，导致孩子用久了以后
    // 早期的记录从「积分」页凭空消失，而导出却还在 —— 对不上账。
    // 单机场景下流水量级很小（一年也就几千条），全量读没有压力。
    db.ledger.orderBy('createdAt').reverse().toArray(),
    db.inventory.toArray(),
    db.animals.toArray(),
    db.checkIns.toArray(),
    db.checkInProgress.toArray(),
    currentBalance(),
    loadRedeemItems(),
    loadAllRedeemItems(),
    loadRedeemRecords(),
    loadFarmEvents(40),
  ])

  set({
    tasks,
    instances,
    ledger,
    inventory,
    animals,
    plots: farm.plots,
    farmTotals: {
      harvests: farm.totalHarvests,
      planted: farm.totalPlanted,
      sheared: farm.totalSheared,
    },
    checkIns,
    checkInProgress,
    redeemItems,
    allRedeemItems,
    redeemRecords,
    farmEvents,
    market,
    balance,
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
      const last = await db.ledger.orderBy('createdAt').last()
      const balance = last?.balanceAfter ?? 0
      await db.ledger.put({
        id: `lg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        delta: result.points,
        balanceAfter: balance + result.points,
        source: 'task',
        refId: instanceId,
        memo: `${inst.title}（${minutes != null ? humanizeMinutes(minutes) : '未计时'}）`,
        createdAt: now,
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

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  loading: true,
  settings: DEFAULT_SETTINGS,
  tasks: [],
  instances: [],
  ledger: [],
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
  todayKey: appDayKey(Date.now(), DEFAULT_SETTINGS.dayStartHour),
  toasts: [],
  settleFlash: null,
  farmTotals: { harvests: 0, planted: 0, sheared: 0 },

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

  doCheckIn: async (taskId) => {
    const task = get().tasks.find((t) => t.id === taskId)
    if (!task) return { gained: 0, bonus: 0 }
    const { settings } = get()
    const today = currentDayKey(settings.dayStartHour)
    const pk = periodKeyFor(task.cycle, Date.now(), settings.dayStartHour)

    let progress = await db.checkInProgress
      .where('[taskId+periodKey]')
      .equals([taskId, pk])
      .first()

    if (!progress) {
      progress = {
        id: uid('cp'),
        taskId,
        periodKey: pk,
        days: [],
        claimedTiers: [],
        updatedAt: Date.now(),
      }
    }
    if (progress.days.includes(today)) {
      get().pushToast({ kind: 'info', title: '今天已经签过啦', emoji: '✅' })
      return { gained: 0, bonus: 0 }
    }

    const gained = Math.max(0, Math.round(task.basePoints))
    progress.days = [...progress.days, today].sort()
    progress.updatedAt = Date.now()
    await db.checkInProgress.put(progress)

    const record: CheckInRecord = {
      id: uid('ci'),
      taskId,
      date: today,
      periodKey: pk,
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
          refId: `${taskId}:${pk}:${tier.days}`,
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

    await get().refresh()
    return { gained, bonus, tierLabel }
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
    const done = await db.taskInstances
      .where('[taskId+periodKey]')
      .equals([taskId, pk])
      .filter((i) => (i.status === 'completed' || i.status === 'failed') && i.settledAt != null)
      .count()
    if (done >= (task.checkInTargetCount ?? 1)) {
      get().pushToast({ kind: 'info', title: '这个周期的目标已经完成啦', emoji: '✅' })
      return 0
    }

    const now = Date.now()
    const inst: TaskInstance = {
      id: uid('ti'),
      taskId,
      periodKey: pk,
      date: currentDayKey(settings.dayStartHour),
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
    await db.taskInstances.put(inst)
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

  harvest: async (plotIndex) => {
    const { plots, settings } = get()
    const plot = plots.find((p) => p.index === plotIndex)
    if (!plot?.crop) return 0
    const def = cropDefOf(plot)
    const timeScale = settings.farmClock?.timeScale ?? 1
    if (!def || !isCropMature(plot, Date.now(), timeScale)) return 0

    const now = Date.now()

    // ---- 随机事件 + 周末/节假日加成 ----
    // 事件在「收获」这一刻结算，而不是后台悄悄扣 ——
    // 孩子必须亲眼看到损失，才学得到"务农有风险"。
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

    const base = def.harvestPoints
    const raw = base * roll.multiplier * bonus
    const earned = roll.wipedOut ? 0 : Math.max(1, Math.round(raw))

    const remaining = def.regrowCount - plot.crop.harvestedCount
    const isPerennial = def.kind === 'perennial'

    if (earned > 0) {
      await postLedger({
        delta: earned,
        source: 'farm_harvest',
        refId: `plot:${plotIndex}`,
        memo: `收获 ${def.name}${remaining > 1 ? `（还能再收 ${remaining - 1} 次）` : ''}`,
      })
    }

    // 道具掉落：歉收/绝收时不给掉落（损失要真实）
    if (earned > 0 && def.harvestItemId) {
      await addItem(def.harvestItemId, def.harvestItemCount ?? 1)
    }

    // 事件写进农场日志
    if (roll.event) {
      await logFarmEvents([roll.event])
    }

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
    await savePlots(nextPlots)
    await get().bumpFarmTotals({ harvests: get().farmTotals.harvests + 1 })

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
        title: roll.wipedOut ? '这次没收到东西…' : `收获 ${def.name} +${earned} 分`,
        detail: roll.event.message,
        emoji: roll.event.emoji,
      })
    } else {
      set({
        settleFlash: { points: earned, reason: `收获了 ${def.name}！`, emoji: def.emoji },
      })
      get().pushToast({
        kind: 'reward',
        title: `收获 ${def.name}，+${earned} 分`,
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
    const { animals } = get()
    const a = animals.find((x) => x.id === animalId)
    if (!a || a.pendingProduce <= 0) return 0
    const def = animalDefOf(a)
    if (!def) return 0

    // 产出也吃周末/节假日加成 —— 同样不提示
    const bonus = seasonalBonus(Date.now())
    const gained = Math.max(1, Math.round(a.pendingProduce * bonus))

    await addItem(def.produceItemId, gained)
    await db.animals.update(animalId, {
      pendingProduce: 0,
      lastProduceAt: Date.now(),
    })
    set({
      settleFlash: {
        points: 0,
        reason: `收到 ${gained} 个${def.produceItemName}！`,
        emoji: def.produceEmoji,
      },
    })
    get().pushToast({
      kind: 'reward',
      title: `+${gained} ${def.produceItemName}`,
      detail: '去市场卖掉就能换积分啦',
      emoji: def.produceEmoji,
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
    return priceOf(get().market, itemId) ?? PRODUCE_BASE_PRICE[itemId] ?? 0
  },

  quoteFor: (itemId, count) => {
    return sellQuote(get().market, itemId, count)
  },

  /**
   * 到市场卖产出。
   *
   * 与旧版的区别：**卖多少会影响价格**（applySell 会砸盘）。
   * 这是刻意设计的市场教育 —— 一次全卖光，单价就下来了，
   * 孩子会自己总结出「分批卖更划算」。
   */
  sellProduce: async (itemId, count) => {
    if (!MARKET_GOODS.includes(itemId) || count <= 0) return 0

    const { market } = get()
    const current = priceOf(market, itemId)
    if (current == null) return 0

    const ok = await consumeItem(itemId, count)
    if (!ok) {
      get().pushToast({ kind: 'warn', title: '背包里没有这么多', emoji: '📦' })
      return 0
    }

    const total = sellQuote(market, itemId, count)
    if (total <= 0) return 0

    const name = ITEM_BY_ID.get(itemId)?.name ?? itemId
    await postLedger({
      delta: total,
      source: 'farm_market',
      refId: itemId,
      memo: `市场卖出 ${count} 个${name}（单价 ${current}）`,
    })

    // 更新行情（价格被卖压打下来）
    const nextMarket = applySell(market, itemId, count)
    await saveMarket(nextMarket)
    set({ market: nextMarket })

    const newPrice = priceOf(nextMarket, itemId) ?? current
    const dropPct = Math.round(((newPrice - current) / (current || 1)) * 100)

    get().pushToast({
      kind: 'reward',
      title: `卖出 ${count} 个${name}，+${total} 分`,
      detail:
        dropPct < -1
          ? `卖得多了，价格跌到 ${newPrice} 分（${dropPct}%）`
          : `当前单价 ${current} 分`,
      emoji: '🪙',
    })
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

  archiveRedeemItem: async (id) => {
    await db.redeemItems.update(id, { archived: true, updatedAt: Date.now() })
    await get().refresh()
  },

  deleteRedeemItem: async (id) => {
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
      const last = await db.ledger.orderBy('createdAt').last()
      const cur = last?.balanceAfter ?? 0
      if (cur < item.cost) {
        ok = false
        return
      }
      balanceAfter = cur - item.cost
      await db.ledger.put({
        id: `lg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        delta: -item.cost,
        balanceAfter,
        source: 'redeem',
        refId: item.id,
        memo: `兑换：${item.name}`,
        createdAt: now,
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

  updateSettings: async (patch) => {
    const next = { ...get().settings, ...patch }
    await saveSettings(next)
    set({ settings: next })
  },

  exportBackup: async () => {
    const [
      tasks,
      taskInstances,
      ledger,
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
    ] = await Promise.all([
      db.tasks.toArray(),
      db.taskInstances.toArray(),
      db.ledger.toArray(),
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
    ])
    return {
      app: 'kid-quest-farm',
      version: 2,
      exportedAt: Date.now(),
      data: {
        tasks,
        taskInstances,
        ledger,
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

      const pickArray = <T,>(v: unknown): T[] | null =>
        Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'id' in (x as object))
          ? (v as T[])
          : null

      const rows = {
        tasks: pickArray<Task>(d.tasks) ?? [],
        taskInstances: pickArray<TaskInstance>(d.taskInstances) ?? [],
        ledger: pickArray<LedgerEntry>(d.ledger) ?? [],
        inventory: pickArray<InventorySlot>(d.inventory) ?? [],
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
          await db.tasks.bulkPut(rows.tasks)
          await db.taskInstances.bulkPut(rows.taskInstances)
          await db.ledger.bulkPut(rows.ledger)
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
  return s.instances
    .filter((i) => i.date === s.todayKey && i.cycle !== 'weekly' && i.cycle !== 'monthly' && i.cycle !== 'yearly')
    .sort((a, b) => {
      const rank = (i: TaskInstance) => (i.status === 'pending' ? 0 : 1)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      return a.createdAt - b.createdAt
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
