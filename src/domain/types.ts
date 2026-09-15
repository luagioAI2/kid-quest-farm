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

/* ---------------- 丰收币账本 ---------------- */

/**
 * 丰收币的来源。
 *
 * **刻意比 `LedgerSource` 少** —— 这里不该出现 `task` / `checkin`，
 * 因为丰收币只能从农场产出里来，任务和签到只发积分。
 */
export type HarvestSource =
  | 'farm_harvest' // 作物收获
  | 'farm_market' // 市场卖出产出
  | 'harvest_redeem' // 用丰收币兑换（负数）
  | 'manual_adjust' // 家长手工调整

/**
 * 丰收币账本条目。字段与 `LedgerEntry` 同形，但**存在另一张表里**。
 *
 * ## 两条不可逆约束（这是整个经济系统的地基）
 *
 * 1. **丰收币 ⇸ 积分** —— 丰收币永远不能换回积分。
 * 2. **丰收币 ⇸ 农场投入** —— 丰收币不能买种子 / 幼崽 / 地块。
 *
 * ### 为什么用「另一张表」而不是「同一个表加 currency 字段」
 *
 * 因为要把约束做成**结构性**的，而不是**约定性**的。
 *
 * 同一张表加 `currency` 字段的话，`currentBalance()` 只要漏一个
 * `.filter(r => r.currency === 'points')`，丰收币就悄悄算进积分余额 ——
 * 而且**不报任何错**（本项目的 `ledgerTip` 注释里已经记过一次同类的静默事故）。
 *
 * 分成两张表之后，`currentBalance()` 只读 `db.ledger`，
 * 它**在物理上不可能**看到丰收币。约束由表结构保证，不靠写代码的人记得住。
 *
 * ### 第 2 条为什么比第 1 条更要命
 *
 * 只堵第 1 条不够。只要农场产出能变回积分、积分又能买种子，就是闭环印钞机：
 *
 * ```
 * 10 → 16 → 26 → 41 → 66 → 105 → 168 → 269 …（每轮 2 分钟，1 小时 30 轮 ≈ 1300 万）
 * ```
 *
 * 所以 `plant` / 买幼崽 / 开地块**只认积分余额**（`state.balance`），
 * 绝不能出现 `balance + harvestBalance` 这种写法。
 */
export interface HarvestEntry {
  id: string
  /** 正数为收入，负数为支出 */
  delta: number
  balanceAfter: number
  source: HarvestSource
  /** 关联对象 id（地块 / 产出物 id） */
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
  /**
   * **每次收获的毛收入（只用于展示）** ≈ 上限回收 ÷ 收获次数。
   *
   * ⚠️ 收获时**不发钱**：产出物进背包（`produceItemId`），真正结算是在市场卖出时。
   * 这个字段现在只喂给商店 / 地块的价格标签，别拿它当「收获即到账」的金额用。
   */
  harvestPoints: number
  /**
   * 收获产出的**可卖物品** id。
   *
   * 「直接卖 / 存进背包」两条路都要（用户 2026-09-15 定），所以每次收获
   * 都要产出一个真物品进背包，卖出时才结算钱 —— 这样「等好价再卖」才有意义。
   */
  produceItemId: string
  /** 每次收获的产出数量 */
  produceAmount?: number
  /** 额外掉落的收藏品（**不可卖**，只是纪念） */
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
    /**
     * **本轮已卖出的丰收币**。闸门 = `seedCost × (1 + r)`，卖满这一轮就结束。
     *
     * 记在**地块**上而不是作物类型上：闸门是「一轮」的，不是「终身」的
     * （用户 2026-09-15：「种子肯定一直能买，一直能种哇」）。
     * 重新种下时清零。
     */
    earnedSoFar?: number
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
  /**
   * **总产出次数**。产够这么多次就停产，但动物本身**留在农场里**
   * （用户 2026-09-15 定：「鸡也是到了周期就不生蛋了，虽然鸡还在」）。
   *
   * 它取代了原来「靠寿命一直产」的模型 —— 旧模型下小鸡成本 40 能换回约 20000。
   */
  produceTimes: number

  /** 预期寿命（分钟）。**已降级为纯展示**，不再决定产出（见 `produceTimes`） */
  lifespanMinutes?: number
  /** 生病/意外概率倍率（1 = 基准） */
  fragility?: number
  /** 上市解锁的农场等级 */
  unlockLevel?: number
}

export type AnimalMood = 'happy' | 'normal' | 'hungry' | 'sick' | 'old' | 'spent'

/**
 * 收获后的两种处置方式（用户 2026-09-15：「可以直接卖出，也可以存储自己市场卖出。提供选择。」）
 *
 * - `sell`  立刻按**当日市价**卖掉，钱当场到手
 * - `store` 只收进背包，之后在市场按**卖出日市价**卖 —— 可以等好价
 *
 * 两条路走的是**同一个闸门**（见 `domain/economy.ts`），所以「存起来」不会绕过上限。
 */
export type HarvestMode = 'sell' | 'store'


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
  /**
   * **已产出次数**。到 `AnimalDef.produceTimes` 就停产，但动物不消失。
   * 旧的「靠 lifespanMinutes 一直产」模型已废弃。
   */
  produceCount?: number
  /** **本轮已卖出的丰收币**（闸门 = `cost × (1 + r)`） */
  earnedSoFar?: number

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
  /** 已签到天数（**已通过家长审核**的才算） */
  days: string[]
  /**
   * 已交上去、等家长审核的日期。
   *
   * 为什么要有这一层：签到以前是「孩子一点就发分」，等于自己给自己发奖。
   * 开启家长审核后，点签到只把日期挪到这里 —— 不发积分、不写签到记录、
   * 不计入坚持天数、不触发阶梯奖励。家长确认后才移到 `days`。
   */
  pendingDays?: string[]
  /** 已领取的阶梯奖励（天数阈值） */
  claimedTiers: number[]
  updatedAt: number
}

/**
 * 一条「等家长审核」的签到。
 *
 * 签到没有自己的任务实例（`taskInstances` 上有 `&[taskId+periodKey]` 唯一索引，
 * 一个周期只能有一行，装不下"一个周期内多天"），所以待审队列直接从
 * `CheckInProgress.pendingDays` 派生。
 */
export interface PendingCheckIn {
  taskId: string
  /** 任务标题，列表直接展示用 */
  title: string
  /** 签到日期 yyyy-MM-dd */
  date: string
  /** 该日期所在的周期键 —— 审核时要靠它精确定位到哪一行 progress */
  periodKey: string
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
   * 新手引导是否走完过（家长设置向导 + 孩子功能导览）。
   *
   * 只在**整条引导结束时**才置 true —— 家长中途关掉 App，
   * 下次打开还得从向导重来，否则孩子会落在「名字还没设」的半个状态里。
   */
  onboardingDone: boolean

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

  /**
   * **浮盈倍率 r**：`上限回收 = 成本 × (1 + r)`。
   *
   * 这是整套农场经济的**唯一总闸门**，也是家长唯一需要理解的旋钮：
   * 「孩子投进去多少积分，最多就能多拿 r 倍回来」。
   * 默认 0.6（= 最多多拿 60%）。可调范围见 `MIN/MAX_PROFIT_RATIO`。
   *
   * 改它会**同时改变所有标的的基准单价**（因为单价是按上限反推的），
   * 所以不要写死任何数字，一律走 `roundCap()` / `PRODUCE_BASE_PRICE`。
   */
  profitRatio: number

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
    /** 丰收币账本。老备份里没有这个字段，导入时按空数组处理。 */
    harvestLedger?: HarvestEntry[]
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
