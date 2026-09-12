/* ============================================================
   核心领域类型 —— 全应用共享的契约
   ============================================================ */

/** 任务周期 */
export type TaskCycle = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly'

/** 任务分类（用于图标、配色、统计分组） */
export type TaskCategory =
  | 'study' // 学习
  | 'chore' // 家务
  | 'sport' // 运动
  | 'art' // 艺术
  | 'reading' // 阅读
  | 'habit' // 习惯

/** 任务状态 */
export type TaskStatus =
  | 'pending' // 待完成
  | 'submitted' // 宝贝做完了，等爸爸妈妈看一眼（待审核）
  | 'completed' // 已通过（含超时但仍有分）—— 对孩子展示为「已通过」
  | 'failed' // 已通过但零分
  | 'expired' // 过期未做
  | 'skipped' // 主动放弃（免扣分任务不扣分）
  | 'rejected' // 家长打回，要重新做

/** 面向孩子的状态文案 —— 统一在这里维护，避免各处措辞不一致 */
export const STATUS_KID_LABEL: Record<TaskStatus, string> = {
  pending: '待完成',
  submitted: '等爸爸妈妈看',
  completed: '已通过',
  failed: '已通过',
  expired: '错过了',
  skipped: '先放一放',
  rejected: '再试试',
}

/** 质量评级 */
export type QualityGrade = 'poor' | 'ok' | 'great'

/* ---------------- 任务定义 ---------------- */

export interface Task {
  id: string
  /** 任务标题，如「完成语文作业」 */
  title: string
  /** 补充说明 */
  note?: string
  category: TaskCategory
  cycle: TaskCycle

  /**
   * 计划时长（分钟）。这是结算的核心依据：
   * 实际用时 <= 计划时长 → 全额积分
   * 计划时长 < 实际用时 < 计划时长*2 → 按比例线性衰减（取整）
   * 实际用时 >= 计划时长*2 → 0 分（除非 allowLateNoPenalty 或 allowOvertime）
   */
  plannedMinutes: number

  /** 基础积分 */
  basePoints: number

  /** 质量达标额外奖励积分（qualityBonusEnabled 为 true 且评级>=ok 时生效） */
  qualityBonusPoints: number

  /**
   * 是否允许超时结算。
   * false  = 超时直接 0 分（严格的"限时任务"）
   * true   = 超时按超时比例结算，超出计划时长一倍才归零
   */
  allowOvertime: boolean

  /**
   * 免扣分：无论超时多久都不扣分，仍按全额积分结算。
   * 用于「有些任务虽然超期但不扣分」的场景。
   */
  allowLateNoPenalty: boolean

  /** 是否启用质量评级（完成后家长/孩子选择质量） */
  qualityRated: boolean

  /** 奖励道具 id 列表（完成时掉落） */
  rewardItemIds?: string[]

  /** 允许的完成时间段（分钟数，从 0:00 起算）。用于「练字签到」等需要在特定时段完成的任务 */
  windowStartMinute?: number
  windowEndMinute?: number

  /** 是否启用签到模式：同一周期内每天签到，按累计天数给阶梯奖励 */
  checkInEnabled?: boolean

  /** 周期目标次数（如一周 5 天，一月 20 天）。仅 checkInEnabled 时有效 */
  checkInTargetCount?: number

  /** 提醒时间（HH:mm），仅用于展示与本地通知预留 */
  remindAt?: string

  /** 是否归档 */
  archived?: boolean

  /**
   * 固定任务：由家长建立、每天固定要做的常规任务。
   * 孩子端不能编辑/删除，只有家长（密码）能新增和修改。
   */
  fixed?: boolean

  createdAt: number
  updatedAt: number
}

/* ---------------- 任务实例（每个周期生成一条） ---------------- */

export interface TaskInstance {
  id: string
  taskId: string
  /** 归属周期键：daily→2026-09-12；weekly→2026-W37；monthly→2026-09；yearly→2026 */
  periodKey: string
  /** 计划日期（yyyy-MM-dd） */
  date: string
  title: string
  category: TaskCategory
  cycle: TaskCycle
  plannedMinutes: number
  basePoints: number
  qualityBonusPoints: number
  allowOvertime: boolean
  allowLateNoPenalty: boolean
  qualityRated: boolean
  rewardItemIds: string[]

  status: TaskStatus
  /** 实际用时（分钟） */
  actualMinutes?: number
  /** 本次实际获得积分（结算后写入） */
  earnedPoints?: number
  /** 质量评级 */
  quality?: QualityGrade

  /** 完成时间戳（提交时刻） */
  completedAt?: number
  /**
   * 计时开始时间戳。null/undefined 表示还没开始计时。
   * 低龄用户友好：点「开始」才开跑，避免"忘记点开始"导致误判超时。
   */
  startedAt?: number
  /** 手动/自动结算时间戳 */
  settledAt?: number

  /** 是否当日补记（事后补做） */
  backfilled?: boolean

  /** 宝贝提交时间戳（进入「待审核」的时刻） */
  submittedAt?: number
  /** 家长审核（打分确认）时间戳 */
  reviewedAt?: number
  /** 家长打回时的留言 */
  rejectNote?: string

  createdAt: number
  updatedAt: number
}

/* ---------------- 结算 ---------------- */

export interface SettlementResult {
  /** 最终得分（>=0 整数） */
  points: number
  /** 是否超时 */
  overtime: boolean
  /** 超时比例：实际/计划 */
  ratio: number
  /** 是否触发零分 */
  zeroed: boolean
  /** 零分原因 */
  zeroReason?: 'overtime_limit' | 'not_returned'
  /** 结算说明，用于给孩子看的文案 */
  reason: string
}

/* ---------------- 积分账本 ---------------- */

export type LedgerSource =
  | 'task'
  | 'checkin'
  | 'checkin_bonus'
  | 'farm_plant'
  | 'farm_harvest'
  | 'farm_feed'
  | 'farm_shear'
  | 'farm_purchase'
  | 'farm_market' // 市场卖出产出
  | 'redeem' // 兑换消耗
  | 'manual_adjust'
  | 'streak_bonus'

export interface LedgerEntry {
  id: string
  /** 正数为收入，负数为支出 */
  delta: number
  balanceAfter: number
  source: LedgerSource
  /** 关联对象 id（任务实例 id / 农场对象 id） */
  refId?: string
  memo: string
  createdAt: number
}

/* ---------------- 道具与背包 ---------------- */

export type ItemRarity = 'common' | 'rare' | 'epic'

export interface ItemDef {
  id: string
  name: string
  emoji: string
  desc: string
  rarity: ItemRarity
  /** 是否可作为种子在农场种植 */
  speciesId?: string
  /** 是否为动物幼崽 */
  animalId?: string
}

export interface InventorySlot {
  itemId: string
  count: number
}

/* ---------------- 农场 ---------------- */

export type CropStage = 'seed' | 'sprout' | 'growing' | 'mature' | 'withered'

/** 作物生态位：一年生 / 多年生（果树） / 观赏花卉 */
export type CropKind = 'annual' | 'perennial' | 'flower'

export interface CropDef {
  id: string
  name: string
  emoji: string
  /** 各阶段 emoji，营造生长感 */
  stageEmojis: [string, string, string, string]
  /** 总生长时长（分钟） */
  growMinutes: number
  /** 种子成本（积分） */
  seedCost: number
  /** 收获产出积分（基准值，实际按当日市价浮动） */
  harvestPoints: number
  /** 收获产出道具 */
  harvestItemId?: string
  harvestItemCount?: number
  /** 每株产量（可重复收获次数，1 表示一次性） */
  regrowCount: number

  /** 生态位，默认 annual */
  kind?: CropKind
  /** 多年生作物每次重新结果的间隔（分钟），不填则用 growMinutes */
  regrowMinutes?: number
  /** 多年生作物的预期总寿命（分钟）。超龄会自然衰老 */
  lifespanMinutes?: number
  /** 死亡/减产概率倍率（1 = 基准，>1 更脆弱，<1 更皮实） */
  fragility?: number
  /** 上市解锁的农场等级 */
  unlockLevel?: number
}

export interface Plot {
  /** 0-11，3x4 地块 */
  index: number
  unlocked: boolean
  /** 解锁所需积分 */
  unlockCost: number
  crop?: {
    cropId: string
    plantedAt: number
    /** 上次收获时间，用于多年生作物 */
    lastHarvestAt?: number
    /** 已收获次数 */
    harvestedCount: number
    /** 因事件枯死的时间戳（多年生作物清零后可再种） */
    diedAt?: number
    /** 最近一次事件说明（给孩子看的） */
    lastEvent?: string
    /** 累计因事件损失的收成次数 */
    lossCount?: number
  }
}

export interface AnimalDef {
  id: string
  name: string
  emoji: string
  /** 幼崽 emoji */
  babyEmoji: string
  /** 成年所需分钟 */
  matureMinutes: number
  /** 购买成本 */
  cost: number
  /** 产出道具 id */
  produceItemId: string
  produceItemName: string
  produceEmoji: string
  /** 生产间隔（分钟） */
  produceIntervalMinutes: number
  /** 单次产出数量 */
  produceAmount: number

  /** 预期寿命（分钟）。到期后自然老去（会提前很久给出征兆） */
  lifespanMinutes?: number
  /** 生病/意外概率倍率（1 = 基准） */
  fragility?: number
  /** 上市解锁的农场等级 */
  unlockLevel?: number
}

export type AnimalMood = 'happy' | 'normal' | 'hungry' | 'sick' | 'old'

export interface Animal {
  id: string
  animalId: string
  name: string
  /** 出生时间戳 */
  bornAt: number
  /** 上次投喂时间戳 */
  lastFedAt: number
  /** 上次产出收集时间戳 */
  lastProduceAt: number
  /** 待收集的产出数量 */
  pendingProduce: number
  /** 投喂次数 */
  feedCount: number
  /** 剪毛/互动次数 */
  careCount: number

  /** 生病开始时间戳（生病期间不产出，喂食/照顾可治愈） */
  sickAt?: number
  /** 最近一次事件说明 */
  lastEvent?: string
  /** 是否已经离世 */
  deceased?: boolean
  /** 离世时间戳 */
  diedAt?: number
}

export interface FarmState {
  plots: Plot[]
  animals: Animal[]
  /** 农场等级（由累计收获数推算） */
  totalHarvests: number
  totalPlanted: number
  totalSheared: number
  /** 农场世界已经过的"天数"（按流速推进，用于换季/事件节奏） */
  farmDay?: number
}

/* ---------------- 农场市场（价格浮动） ---------------- */

/** 市场里可交易的一种产出 */
export interface MarketQuote {
  /** 产出道具 id */
  itemId: string
  /** 当前基准价（整体水位，缓慢漂移） */
  base: number
  /** 当日现价 */
  price: number
  /** 昨日价，用于算涨跌 */
  prevPrice: number
  /** 报价所属的"市场日" */
  day: number
  /** 今日是否已经被买崩过（卖出抬高了供给，价格被打下来） */
  soldToday: number
}

/** 一天的行情历史点，用于画价格走势 */
export interface MarketHistoryPoint {
  day: number
  /** itemId -> 收盘价 */
  prices: Record<string, number>
}

export interface MarketState {
  quotes: MarketQuote[]
  /** 最近 N 天的行情，画走势用 */
  history: MarketHistoryPoint[]
  /** 当前市场日 */
  day: number
  /** 昨日整体指数（100 为基准），用于展示"大盘"情绪 */
  indexPrev?: number
  /** 今日整体指数 */
  indexNow?: number
}

/* ---------------- 随机事件日志 ---------------- */

export type FarmEventKind =
  | 'weather_good' // 好天气，增产
  | 'weather_bad' // 坏天气，减产
  | 'pest' // 虫害
  | 'disease' // 病害
  | 'harvest_bumper' // 大丰收
  | 'harvest_poor' // 歉收
  | 'crop_died' // 作物枯死
  | 'animal_sick' // 动物生病
  | 'animal_recovered' // 动物康复
  | 'animal_died' // 动物离世
  | 'market_surge' // 行情大涨
  | 'market_crash' // 行情大跌
  | 'holiday_bonus' // 假日加成

export interface FarmEvent {
  id: string
  kind: FarmEventKind
  /** 面向孩子的一句话说明 */
  message: string
  emoji: string
  /** 影响的产量/价格倍率（1 = 无影响） */
  multiplier?: number
  /** 关联的地块或动物 id */
  refId?: string
  createdAt: number
}

/* ---------------- 兑换商城 ---------------- */

/** 兑换品的分类 */
export type RedeemCategory = 'snack' | 'gift' | 'screen' | 'outing' | 'privilege' | 'custom'

export interface RedeemItem {
  id: string
  name: string
  emoji: string
  category: RedeemCategory
  /** 所需积分 */
  cost: number
  /** 说明，如「周末可以玩 30 分钟平板」 */
  note?: string
  /** 一次最多换几个（防止一口气把积分花光，可不填） */
  limitPerDay?: number
  /** 库存，-1/undefined 表示无限 */
  stock?: number
  /** 是否下架 */
  archived?: boolean
  /** 是否由家长创建（孩子不能改） */
  createdByParent?: boolean
  createdAt: number
  updatedAt: number
}

export interface RedeemRecord {
  id: string
  itemId: string
  name: string
  emoji: string
  cost: number
  /** 兑换时的积分余额（快照，便于回溯） */
  balanceAfter: number
  /** 家长是否已经"兑现"（比如真的给了零食） */
  fulfilled: boolean
  fulfilledAt?: number
  createdAt: number
}

/* ---------------- 农场时间流速 ---------------- */

/**
 * 农场时间流速：1 现实分钟 = timeScale 农场分钟。
 * 让「萝卜 3 分钟就熟」这类设定可以跟现实知识挂上钩
 * （比如告诉孩子：农场一天差不多是我们的一小时）。
 */
export interface FarmClockSettings {
  /** 流速倍率，1 = 与现实同速 */
  timeScale: number
  /** 是否显示农场时钟 */
  showClock: boolean
}

/* ---------------- 签到 ---------------- */

export interface CheckInRecord {
  id: string
  taskId: string
  /** 签到日期 yyyy-MM-dd */
  date: string
  periodKey: string
  /** 该次签到获得的积分 */
  points: number
  createdAt: number
}

export interface CheckInProgress {
  id: string
  taskId: string
  periodKey: string
  /** 已签到天数 */
  days: string[]
  /** 已领取的阶梯奖励（天数阈值） */
  claimedTiers: number[]
  updatedAt: number
}

/* ---------------- 设置 ---------------- */

export interface AppSettings {
  /** 孩子昵称 */
  childName: string
  /** 头像 emoji */
  avatar: string
  /** 1 天开始的钟点（小时，0-6）。用于「早上 6 点算新的一天」这类需求 */
  dayStartHour: number

  /** 全局：是否启用超时衰减 */
  overtimeEnabled: boolean
  /** 全局：超时衰减的最低分比例（0-1），低于此直接 0 分会由任务级 allowOvertime 决定 */
  minRatioForPoints: number
  /** 全局：是否允许质量加分 */
  qualityBonusEnabled: boolean
  /** 质量达标评级阈值：'ok' 表示 ok 及以上加分 */
  qualityBonusThreshold: QualityGrade

  /** 连续完成任务的天数奖励（连击） */
  streakBonusEnabled: boolean
  /** 每连击一天额外积分 */
  streakBonusPerDay: number
  /** 连击奖励上限 */
  streakBonusCap: number

  /** 音效 */
  soundEnabled: boolean
  /** 震动反馈 */
  hapticsEnabled: boolean

  /**
   * 家长审核开关。
   * true  = 宝贝点「完成」后进入「等爸爸妈妈看」，家长输密码打分确认才发积分
   * false = 老流程，点完成立刻结算（方便家长自己试玩）
   */
  parentReviewEnabled: boolean

  /**
   * 孩子的操作是否需要家长密码。
   * 打开后：新增/编辑任务、编辑兑换品、改规则都要密码。
   */
  protectParentActions: boolean

  /** 兑换商城开关 */
  redeemEnabled: boolean

  /** 农场随机事件开关（关掉就是风调雨顺） */
  farmEventsEnabled: boolean

  /** 农场时间流速设置 */
  farmClock: FarmClockSettings

  /** 家长锁 PIN（明文仅本地，4 位） */
  parentPin?: string
}

/* ---------------- 数据快照（导出用） ---------------- */

export interface BackupFile {
  app: 'kid-quest-farm'
  version: number
  exportedAt: number
  data: {
    tasks: Task[]
    taskInstances: TaskInstance[]
    ledger: LedgerEntry[]
    inventory: InventorySlot[]
    farm: FarmState
    checkIns: CheckInRecord[]
    checkInProgress: CheckInProgress[]
    redeemItems: RedeemItem[]
    redeemRecords: RedeemRecord[]
    events: FarmEvent[]
    market: MarketState
    settings: AppSettings
    meta: Record<string, unknown>
  }
}
