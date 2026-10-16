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

/**
 * 质量评级（五档，由低到高）
 *
 *   awful 很差   -100%
 *   poor  一般   -50%
 *   ok    良好     0%   ← 中间档，不加不减
 *   good  很好   +10%
 *   great 特别棒 +20%
 *
 * ⚠️ 键名刻意保持向后兼容：`poor` / `ok` / `great` 在旧数据里分别是
 * 「一般 / 不错 / 特别棒」，含义和现在的「一般 / 良好 / 特别棒」对得上，
 * 所以老记录不用做数据迁移 —— 只有 `ok` 的显示名从「不错」变成「良好」。
 */
export type QualityGrade = 'awful' | 'poor' | 'ok' | 'good' | 'great'

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

  /* ---------------- 奖励覆盖（2026-10-11 家长要「在任务编辑里能改」） ----------------
     三个都是**可选覆盖**：`undefined` = 用内置默认值。

     ⚠️ 2026-10-12 家长连着两轮拍板，把**全局设置里所有连击 / 阶梯倍率的痕迹**
     都删干净了：
       第一轮「不需要全局设定梯度、连续的。每个任务单独，有默认的就行了。」
       → `Settings.checkInTierRatio` / `streakBonusPerDay` / `streakBonusCap` 删掉。
       第二轮「不需要在家长设置里设定，因为任务里已经可以单独设置了。」
       → `Settings.streakBonusEnabled`（连击总开关）也删掉。
     回落目标从「设置里的全局值」变成 `domain/` 里的常量：
     阶梯倍率 `DEFAULT_TIER_RATIO`、连击 `DEFAULT_STREAK_PER_DAY` / `DEFAULT_STREAK_CAP`。
     别再把它们加回设置页 —— 那就是「同一个事实存两份」。

     ⚠️ 为什么是「可选覆盖」而不是必填：老任务、老备份里根本没有这几列，
     必填会逼出一条 Dexie 迁移；而本项目所有「老用户数据被清空」的事故
     都出在迁移上（见 0c087da / 66da238 / 5056e2f）。可选 + 回落 = 不需要迁移。

     ⚠️ 取值**一律走 `tierRatioFor` / `streakPerDayFor` / `streakCapFor`**，
     别在各处写 `task.x ?? DEFAULT_Y` —— 那又是「同一个事实存两份」。 */

  /** 这条签到任务的阶梯倍率。不填 = 用 `DEFAULT_TIER_RATIO`（0.8） */
  checkInTierRatio?: number

  /** 这条长期任务的连击加成：每连一天多给几分。不填 = 用 `DEFAULT_STREAK_PER_DAY`（2） */
  streakPerDay?: number

  /** 这条长期任务的连击封顶。不填 = 用 `DEFAULT_STREAK_CAP`（20） */
  streakCap?: number

  /** 提醒时间（HH:mm），仅用于展示与本地通知预留 */
  remindAt?: string

  /** 是否归档 */
  archived?: boolean

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
  /** 插件游戏的一次投入（负数）。宿主 `HostApi.spendPoints` 用这个 source。 */
  | 'game_spend'

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

/* ---------------- 点券账本 ---------------- */

/**
 * 点券的来源。
 *
 * **刻意比 `LedgerSource` 少** —— 这里不该出现 `task` / `checkin`，
 * 因为点券只能从「玩出来的产出」里来，任务和签到只发积分。
 *
 * ⚠️ 2026-10-16 起多了一个 `claw_prize`：娃娃机抓到的娃娃也能换点券。
 * 加它的同时**必须回头看那条不变量** —— 娃娃机每局的期望产出要 < 1
 * （兑换商城里 1 点券 ≡ 1 积分，而一局只花 1 积分）。
 * 判据与单测在 `domain/clawEconomy.ts`。
 */
export type HarvestSource =
  | 'farm_harvest' // 作物收获
  | 'farm_market' // 市场卖出产出
  | 'claw_prize' // 娃娃机抓到娃娃兑换（2026-10-16）
  | 'harvest_redeem' // 用点券兑换（负数）
  | 'manual_adjust' // 家长手工调整

/**
 * 点券账本条目。字段与 `LedgerEntry` 同形，但**存在另一张表里**。
 *
 * ## 两条不可逆约束（这是整个经济系统的地基）
 *
 * 1. **点券 ⇸ 积分** —— 点券永远不能换回积分。
 * 2. **点券 ⇸ 农场投入** —— 点券不能买种子 / 幼崽 / 地块。
 *
 * ### 为什么用「另一张表」而不是「同一个表加 currency 字段」
 *
 * 因为要把约束做成**结构性**的，而不是**约定性**的。
 *
 * 同一张表加 `currency` 字段的话，`currentBalance()` 只要漏一个
 * `.filter(r => r.currency === 'points')`，点券就悄悄算进积分余额 ——
 * 而且**不报任何错**（本项目的 `ledgerTip` 注释里已经记过一次同类的静默事故）。
 *
 * 分成两张表之后，`currentBalance()` 只读 `db.ledger`，
 * 它**在物理上不可能**看到点券。约束由表结构保证，不靠写代码的人记得住。
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

/* ---------------- 商城币（第三套货币，2026-10-14 起） ---------------- */

/**
 * 商城币的来源。
 *
 * **目前只有出口，没有入口。** 家长 2026-10-14 拍板：
 * > 「商城币 跟积分 和 点券都不一样。首款免费并且默认购买。」
 * > 「（来源）以后支付购买。或者兑换码。」
 *
 * 所以这一轮**只建钱包**：账本、余额、购买扣费全都在，但没有任何发币入口，
 * 币恒为 0。这样界面上就不会出现一个「按下去什么都不会发生」的购买按钮 ——
 * 本项目最忌讳的就是**界面承诺了它做不到的事**。
 *
 * 等付费入口或兑换码接上时，再往这里加成员。
 */
export type MallSource =
  | 'game_purchase' // 买游戏（负数）
  | 'redemption_code' // 兑换码（【提案】—— 本轮没有入口）
  | 'manual_adjust' // 家长手工调整

/**
 * 商城币账本条目。字段与 `HarvestEntry` 同形，**存在第三张表里**。
 *
 * ## 为什么又是「单开一张表」
 *
 * 理由和 `HarvestEntry` 那段完全一样：把「商城币不算进任何别的余额」
 * 做成**结构性**约束，而不是靠每个读余额的地方都记得加过滤。
 * `currentBalance()` 只读 `db.ledger`、`currentHarvestBalance()` 只读
 * `db.harvestLedger` —— 两者**在物理上**都看不到 `mallLedger`。
 *
 * ## 三套币之间一条通路都没有
 *
 * 积分 ⇸ 点券、点券 ⇸ 积分、商城币 ⇸ 任何别的币，全都不存在。
 * ⚠️ **任何两条币之间的双向通路都是印钞机**（`HarvestEntry` 的注释里
 * 算过一次：每轮 2 分钟，1 小时 ≈ 1300 万）。加通路之前先把那张账重算一遍。
 */
export interface MallEntry {
  id: string
  /** 正数为收入，负数为支出 */
  delta: number
  balanceAfter: number
  source: MallSource
  /** 关联对象 id（游戏 id 等） */
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
     * **本轮已卖出的点券**。闸门 = `seedCost × (1 + r)`，卖满这一轮就结束。
     *
     * 记在**地块**上而不是作物类型上：闸门是「一轮」的，不是「终身」的
     * （用户 2026-09-15：「种子肯定一直能买，一直能种哇」）。
     * 重新种下时清零。
     */
    earnedSoFar?: number
  }
}

/* ------------------------------------------------------------
   动物特殊效果（2026-10-12 家长要求）
   ------------------------------------------------------------
   家长原话：

   > 「农场再添加一些动物，比如田园犬、北极熊、长颈鹿 …… 也可以设定特殊效果。
   >   比如狗狗对某些事件预防，长颈鹿会有几率赐福丰收，北极熊有几率抵御严寒。」

   ⚠️ **这是对 2026-09-15 那条锁的一次明确放宽，别把它当事故删掉。**
   那条锁写的是「所有标的共用同一套灾害分布 …… 不要偷偷加回一个概率倍率」，
   它防的是**偷偷**加 —— 悄悄给某个作物挂个 0.9 的减产倍率，
   于是「单价 = 上限回收 ÷ 满产」推出来的期望浮盈不再统一，数值表作废。
   家长现在要的效果是**明面上的**，所以新的规则不是「不许有概率」，而是：

     ① 效果必须**声明在 `AnimalDef.trait` 上**，不许藏在函数里；
     ② 效果只能**挡掉坏档**（把减产救回中性档），**不许加产量** ——
        因为「满产」是闸门，加产量只会变成卖不掉的死库存（见 `useApp.harvest` 的甲）；
     ③ 带效果的动物，期望浮盈必须**仍然落在 +40% ~ +55%** 这一档
        （`economy.test.ts` 那条「动物也吃减产骰子」会替我们守着）。

   为什么只挡坏档、不加产量：量过 —— 中性档 0.92 和好档 1.1~1.2
   **算出来的产出一样**（都是满产 4 个），所以「赐福丰收」做成加产量是**零效果**的。
   真正能动的只有「少损失一点」。

   ⚠️ **效果只作用在自己这一批产出上，不是全农场的光环。**
   全农场光环会让所有标的的期望浮盈一起抬上去 —— 而 `economy.test.ts` 是
   直接调 `rollHarvestEvent` 模拟的，它看不见「农场里有没有狗」，
   于是那条用例会**继续绿着说谎**。要做的只能是「自己护自己」。
   ------------------------------------------------------------ */
export interface AnimalTrait {
  /** 效果名，UI 上显示（如「看家」） */
  name: string
  /**
   * 商店 / 卡片上的说明。**要说出「有几率」**，别写成必定发生 ——
   * 界面承诺了做不到的事，是这个项目最忌讳的一类 bug。
   */
  desc: string
  /**
   * 挡成功时，接在动物名字后面的那半句话（事件提示用）。
   *
   * 和 `desc` 分开是因为两者时态不同：`desc` 是「有几率……」（事前，商店里看），
   * `wardMsg` 是「……挡在了外面」（事后，真的发生了）。同一句话放两个地方，
   * 必然有一个是错的。
   */
  wardMsg: string
  /** 事件提示用的 emoji */
  emoji: string
  /**
   * 能挡掉的坏档位。**只能是坏档**（`pest` / `disease` / `weather_bad` /
   * `harvest_poor`）—— 挡好档没有意义，挡中性档等于没写。
   * 有测试钉住这一点。
   */
  wards: FarmEvent['kind'][]
  /** 每次结算的挡掉概率（0 ~ 1） */
  chance: number
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
  /**
   * 特殊效果（2026-10-12 家长要求）。不填 = 普通动物，走共用灾害分布。
   *
   * ⚠️ 填了它就等于「这个标的有自己的概率」—— 见上面 `AnimalTrait` 那段，
   * 三条约束（声明在数据里 / 只挡坏档 / 期望浮盈仍在档内）一条都不能破。
   */
  trait?: AnimalTrait
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
  /** **本轮已卖出的点券**（闸门 = `cost × (1 + r)`） */
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
  /**
   * 特殊效果把一次减产挡掉了（2026-10-12）。
   *
   * 只有一个 kind，不带子类 —— 是「狗看家」还是「长颈鹿赐福」由
   * `AnimalTrait.name / emoji / desc` 决定，事件里只带一句现成的 `message`。
   * 分成三个 kind 的话，`eventEmoji` 和农场日志那边就得多三处映射，
   * 而它们除了文案没有任何差别。
   */
  | 'warded'

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
  /** 总价 = harvestPaid + pointsPaid */
  cost: number
  /**
   * 这次用点券付掉的部分（🎟️）。
   *
   * 可选：2026-09-30 之前的老记录没有这个字段 —— 那时候只能用积分付，
   * 所以「缺省」必须读成 **0**，而不是 `cost`。读取处请一律走
   * `domain/redeem.ts` 的 `paidOf()` / `describeRedeemPayment()`，别手写 `?? cost`。
   */
  harvestPaid?: number
  /**
   * 这次用积分付掉的部分（🪙）。
   *
   * 可选：老记录缺省时**等于 `cost`**（当年全额走积分）。
   * ⚠️ 两个字段的缺省方向**是相反的**（一个默认 0、一个默认 cost），
   * 因为老记录全都是「纯积分」。别把这条记反了。
   */
  pointsPaid?: number
  /** 兑换时的积分余额（快照，便于回溯） */
  balanceAfter: number
  /** 兑换时的点券余额（快照）。老记录没有 */
  harvestBalanceAfter?: number
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
  /** 全局：是否允许质量加减分（关闭后五档系数一律按 0 算） */
  qualityBonusEnabled: boolean

  /* 连续完成任务的天数奖励（连击）—— ⚠️ 这里**一个字段都没有了**。
     ------------------------------------------------------------
     2026-10-12 家长第一轮拍板删掉了两个「全局值」：
       「不需要全局设定梯度、连续的。每个任务单独，有默认的就行了。」
     → `streakBonusPerDay` / `streakBonusCap` 删掉。

     2026-10-12 第二轮又拍板把**总开关**也从设置里删掉：
       「我是说家长设置里的删掉。不需要在家长设置里设定。
        因为任务里已经可以单独设置了。」
     → `streakBonusEnabled` 也删掉（连字段一起，不只是控件）。

     为什么连字段都要删：留一个界面上看不见、却还在闸着发分的全局值，
     正是本项目最怕的那种 bug（界面看不到 ≠ 不会发生）。
     这个坑本项目踩过一次 —— `taskDropsEnabled` 当年「只管界面」，
     家长关掉之后旧任务照旧掉道具。

     现在连击**永远生效**，只有两个来源：
       ① 任务自己的 `Task.streakPerDay` / `Task.streakCap`
       ② 都没设 → `domain/streakBonus.ts` 的默认常量（2 / 20）
     想给单条任务关掉：把它的「每连一天多给」设成 **0**
     （`streakBonus.ts` 头注释写明 0 就是「不发」，语义等价于关开关）。

     ⚠️ 代价（知情接受）：没有「一键全关」了，家长只能一条条任务设 0。
     ⚠️ 别把总开关加回来 —— `db.test.ts` 有一条专门钉这件事。 */

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

  /**
   * 道具掉落**总开关**（家长 2026-09-30 要求）。
   *
   * **默认关。** 家长原话：「默认是没有掉落，因为已经有积分奖励了。」
   *
   * 开着：编辑页出现「完成后掉落（选填）」那一块，**结算时才会真的发**道具。
   * 关着：编辑页整块不渲染，而且**结算处一处都不发** —— 已经配好掉落的旧任务、
   *       签到阶梯自带的贴纸 / 勋章，全都停。**积分奖励不受影响。**
   *
   * ⚠️ 2026-09-30 之前这个开关叫 `taskDropsEnabled`、默认 `true`，
   *    而且**只管编辑界面**：`settleNow` 无条件发道具，于是家长「关掉」之后
   *    老任务照旧掉 —— 以为自己关掉了，其实没有。
   *    **换名字是故意的**：老语义是「编辑页要不要显示这一块」，
   *    新语义是「道具到底掉不掉」，不是同一件事。换个键名 = 老库里那个 `true`
   *    自然失效，既不需要数据迁移，也不会替家长把已经关掉的开关又打开。
   */
  itemDropsEnabled: boolean

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

  /**
   * **现金 : 积分 的参考汇率**：1 元等于多少积分（2026-09-21 家长要求）。
   *
   * 家长原话：
   * > 「设置里 添加 现金对积分 比例。 默认 1:10 。 也要显示到兑换页。
   * >   主要是让家长看着， 兑换能够参照的， 不影响数值。」
   *
   * 默认 10（= 「1:10」）。用途只有一个：在兑换页把「30 分」旁边
   * 标一句「≈ ¥3」，让家长对兑换的性价比有个直观参照。
   *
   * ⚠️ **纯展示，不参与任何计算。** 用户明确「不影响数值」——
   * 它不进结算、不进兑换扣分、不进农场经济、不改任何账本。
   * 换算与格式化一律走 `domain/cash.ts`，不要在别处自己除。
   * 合法区间 [1, 1000]，见 `MIN/MAX_POINTS_PER_YUAN`。
   */
  pointsPerYuan: number

  /* ⚠️ 这里原来还有一个 `checkInTierRatio`（签到阶梯倍率的**全局值**）。
     2026-10-12 家长拍板「不需要全局设定梯度、连续的。每个任务单独，
     有默认的就行了」，于是删掉了。
     现在阶梯倍率只有两个来源：
       · 任务自己的 `Task.checkInTierRatio`（在任务编辑里设）
       · 都没有 → `domain/tierRatio.ts` 的 `DEFAULT_TIER_RATIO`（0.8）
     别再加回设置页 —— 家长已经明确不需要，而且多一个「看不见的全局值」
     只会让「界面显示的」和「实际发的」有机会走散。 */

  /**
   * **当前正在玩的那款游戏 id**（2026-10-14 起）。
   *
   * 底部导航上那个游戏 tab（图标 / 名字）跟着它走，见 `src/App.tsx`。
   *
   * 只存 id，**不存游戏对象** —— 名字、图标、页面、价格都在
   * `src/games/registry.ts` 里，存进来就是第二份事实，迟早走散。
   *
   * 可选：老库里没有这个字段，`loadSettings` 会和 `DEFAULT_SETTINGS` 合并
   * 拿到 `DEFAULT_GAME_ID`，所以**不需要数据迁移**。
   *
   * ⚠️ 读到「未拥有」或「已经不在注册表里」的 id 时必须**回落到
   * `DEFAULT_GAME_ID`** —— 见 `store/useApp.ts` 的 `resolveActiveGame()`。
   * 否则清库 / 退款之后，底部导航会指着一个根本不存在的页面。
   */
  activeGame?: string

  /** 农场时间流速设置 */
  farmClock: FarmClockSettings

  /**
   * 娃娃机：中奖率（0~1）与「每抓到一只兑换多少点券」。
   *
   * 两个都**可选** —— 老库里没有这两个字段，`loadSettings` 会和
   * `DEFAULT_SETTINGS` 合并拿到默认值，所以**不需要数据迁移**。
   *
   * ⚠️ 这两个数是**乘在一起**的：`期望产出 = 中奖率 × 每只兑换数`，
   * 而它必须 ≤ `CLAW_MAX_EXPECTED`（0.8）—— 因为兑换商城里
   * `1 点券 ≡ 1 积分`，期望产出 ≥ 1 就等于「孩子坐着玩就能刷积分」。
   * 判据与夹紧都在 `domain/clawEconomy.ts`，**别在设置界面里自己乘**。
   */
  clawWinRate?: number
  clawExchangePerPrize?: number

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
    /** 点券账本。老备份里没有这个字段，导入时按空数组处理。 */
    harvestLedger?: HarvestEntry[]
    /** 商城币账本。同上，老备份里没有，导入时按空数组处理。 */
    mallLedger?: MallEntry[]
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
