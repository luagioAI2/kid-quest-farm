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
  MallEntry,
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
  addGameCoin,
  addItem,
  BUNDLE_KEY,
  buyGameCoin,
  clearGameKv,
  consumeItem,
  currentBalance,
  currentHarvestBalance,
  currentMallBalance,
  db,
  DEFAULT_SETTINGS,
  gameCoinBalanceOf,
  getGameKv,
  listGameKv,
  listGameKvOwnerIds,
  listInstalledBundles,
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
  harvestTip,
  postHarvest,
  postLedger,
  postMall,
  QUOTA_CARRY_KEY,
  saveFarmDay,
  saveFarmTotals,
  saveMarket,
  savePlots,
  saveQuotaCarry,
  saveSettings,
  setGameKv,
  spendGameCoin,
  spendMall,
  wipeAll,
  type GameKvRow,
} from '../db/db'
import { DEFAULT_GAME_ID, GAME_CLAW } from '../games/ids'
import {
  CLAW_DEFAULT_EXCHANGE,
  CLAW_DEFAULT_WIN_RATE,
  CLAW_PLAYS_KEY,
  CLAW_PLAY_COST,
  clampClawEconomy,
  clawResolveRound,
} from '../domain/clawEconomy'
import { GAMES, gameById, ownedByDefault, purchasedIdsFrom } from '../games/registry'
import { makeHostApi } from '../games/hostApi'
import { importBundle, mountBundle } from '../games/loader'
import { catalogPublicKeyRaw } from '../games/catalogKey'
import { fetchVerifiedGame, type ResolvedGame } from '../games/install'
import { HOST_API } from '../games/plugin'
import type { GameBundle, GameManifestV2, HostApi } from '../games/plugin'
import { hapticLight, playTone, type ToneKind } from '../platform/files'
import { settleInstance, type SettleParams } from '../domain/settlement'
import {
  appDayKey,
  appDayStart,
  formatClock,
  humanizeMinutes,
  periodKeyFor,
  runningMinutes,
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
  checkInPayout,
  computeStreak,
  currentDayKey,
  defaultTiers,
  isPreGenerated,
  isCheckInTask,
  isPeriodTask,
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
  cropsUnlockedAt,
  ITEM_BY_ID,
  MARKET_GOODS,
  PRODUCE_BASE_PRICE,
  priceCeilingFor,
  produceUnitOf,
} from '../domain/catalog'
import { describeRedeemPayment, planRedeemPayment } from '../domain/redeem'
import { streakCapFor, streakPaysOn, streakPerDayFor } from '../domain/streakBonus'
import { tierRatioFor } from '../domain/tierRatio'
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
import { REDEEM_PRICE_MIGRATIONS, SEED_TASKS, SEED_REDEEM_ITEMS } from '../domain/seedTasks'
import { CURRENCY } from '../domain/currency'

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
  /** 任务：在用的（不含已隐藏） */
  tasks: Task[]
  /**
   * 任务：**含已隐藏**，家长管理用。
   * 和 `redeemItems` / `allRedeemItems` 是同一套分工 ——
   * 孩子端只吃 `tasks`，家长端要能看到并恢复被藏起来的那些。
   * 没有它，「隐藏」就不可逆：任务从 `tasks` 消失后再也找不回来。
   */
  allTasks: Task[]
  instances: TaskInstance[]
  ledger: LedgerEntry[]
  /**
   * 商城币流水。与 `ledger` 分开放 —— 见 `HarvestEntry` 的两条不可逆约束。
   * 界面上「积分」页只看 `ledger`，「商城币」页只看 `harvestLedger`，两边不串。
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
  /** 商城币余额 —— 只能花在兑换商城的丰收档，**不能回流农场、不能换积分** */
  harvestBalance: number
  /**
   * 钻石流水 / 余额（第三套币，2026-10-14 起）。
   *
   * **这一轮只建钱包，没有发币入口**（来源将来是付费或兑换码），所以
   * `mallBalance` 恒为 0、购买按钮也不会出现。见 `MallEntry` 的注释。
   */
  mallLedger: MallEntry[]
  mallBalance: number
  /** 当前正在玩的游戏 id。底部导航的游戏 tab 跟着它走。 */
  activeGameId: string
  /**
   * 已拥有的游戏 id。**派生值，不是存储值** ——
   * = `defaultOwned` 的那款 + 账本里有过 `game_purchase` 支出的那些。
   * 见 `games/registry.ts` 的 `purchasedIdsFrom`。
   */
  ownedGameIds: string[]
  /**
   * **已安装的插件游戏**（下载来的那些）：id → manifest（spec §12.5）。
   *
   * 只存 manifest（很小），**不存代码** —— 代码在 `gameKv` 的 `__bundle` 里，
   * 要装配的时候现读（见 `mountGame`）。
   *
   * ⚠️ 这份清单是**从 `gameKv` 派生**的，不是另存一份。另存就会出现
   * 「清单说装了、其实包里没有」或反过来 —— 本项目的老毛病。
   */
  installedGames: Record<string, GameManifestV2>

  /**
   * **娃娃机的币余额**（2026-10-16 起）。
   *
   * 和宿主那三套币同一个口径：**算出来的**（`gameKv` 里 `__coin` 账本的
   * delta 之和），不存 `balance` 字段。
   *
   * ⚠️ 这是**游戏自己的币**，不是第四套宿主币 —— 它只能靠花积分买
   * （`buyClawCoin`），而且**永远换不回积分**（`addGameCoin` 只进不出）。
   * 币的出口是「玩一局」，玩出来的商城币才进 `harvestLedger`。
   */
  clawCoins: number

  /**
   * 娃娃机**已经玩过多少局**（2026-10-16 起）。
   *
   * 它同时是**下一局的 seed 来源**（`clawResolveRound(index, …)`），
   * 所以只能**在结算之后 +1** —— 中途刷新时局数没变，
   * 算出来还是同一个结果（公平），下一局才是新的结果。
   */
  clawPlays: number

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

  /* ---- 插件游戏（spec §12） ---- */
  /**
   * ★ **生产路径**：从**已签名的游戏目录**装一款游戏（spec §12.4）。
   *
   * 整条链是「验签目录 → 解析 → 找条目 → 取包 → 验 SHA-256 → 才执行代码」，
   * 全部在 `src/games/install.ts` 里（拆出去是为了让顺序**能被单测断言**）。
   * 这里只负责最后三步：跑代码、拦内置 id、落库。
   *
   * ⚠️ 公钥来自 `catalogKey.ts`（烧进 APK）。**没配公钥 ⇒ 直接抛 ⇒ 装不了**，
   * 这是**故意的**（fail closed）—— 见那个文件的注释。
   */
  installFromCatalog: (
    catalogUrl: string,
    gameId: string,
  ) => Promise<{ ok: boolean; message: string }>
  /**
   * ⚠️ **没有完整性校验**的安装路径，只给本地走查用（`capture-game-bundle.mjs`
   * 起一个静态目录证明装配管道通）。**不是给用户用的**，也**不许**接进设置页。
   * 真正的安装入口是上面的 `installFromCatalog`。
   */
  installGameFromUrl: (url: string) => Promise<{ ok: boolean; message: string }>
  /** 卸载一款插件游戏：**连包带状态一起删**（不然重装会捡到上一次的存档）。 */
  uninstallGame: (gameId: string) => Promise<void>
  /** 把已安装的游戏挂进一个容器，返回**卸载函数**。 */
  mountGame: (gameId: string, container: HTMLElement) => Promise<() => void>

  /* ---- 任务 ---- */
  addTask: (input: NewTaskInput) => Promise<Task>
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>
  /** 隐藏 / 恢复一个任务。和 `setRedeemItemArchived` 同名同形 —— 两边别走散 */
  setTaskArchived: (id: string, archived: boolean) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  /* ---- 任务实例 ---- */
  startTimer: (instanceId: string) => Promise<void>
  /**
   * 暂停计时。孩子中途去吃饭 / 被叫走时点一下，
   * 这段时长**不计入**「实际用时」（否则会被判超时白扣分）。
   * 只对「待完成 + 已在计时」的实例生效；重复点无副作用。
   */
  pauseTimer: (instanceId: string) => Promise<void>
  /** 继续计时。把刚过去的这段暂停时长累加进 `pausedTotalMs`。 */
  resumeTimer: (instanceId: string) => Promise<void>
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
  /**
   * 当前周期已经领过的阶梯天数。
   *
   * ⚠️ 必须和 `checkInDays` **读同一行**。卡上原来是
   * `checkInProgress.find(p => p.taskId === id)` —— 不带周期键，
   * 于是第二周读到的是**第一周那一行**的 `claimedTiers`，
   * 阶梯会全部显示成「已拿」、孩子没法领。`days` 用的是带周期键的查询，
   * 两个数来自不同的行，正是「同一个事实存两份」。
   */
  checkInClaimedTiers: (taskId: string) => number[]

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
   * @returns 本次到手的商城币（`'store'` 时为 0）
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
   * 卖出 n 个能拿多少商城币。
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

  /* ---- 游戏（插件骨架，2026-10-14 起） ---- */
  /**
   * 切换「当前正在玩的游戏」。底部导航的游戏 tab 跟着它走。
   *
   * 只接受**已拥有且可玩**的 id；其余一律忽略（见实现里的两道守卫）。
   * 不抛异常 —— 它可能被旧存档 / 手改的 IndexedDB 触发，那种情况应该
   * 安静地保持原样，而不是把整个页面炸掉。
   */
  setActiveGame: (id: string) => Promise<void>
  /**
   * 用**钻石**买一款游戏。
   *
   * ⚠️ 这一轮没有任何发币入口，所以余额恒为 0、这个动作在界面上走不到。
   * 它已经写好并有用例，是为了「付费入口 / 兑换码」接上时不用重写经济逻辑。
   * 返回值说明结果，调用方负责给家长反馈 —— 别让它静默失败。
   */
  buyGame: (id: string) => Promise<{ ok: boolean; message: string }>

  /**
   * **家长手动发钻石**（2026-10-16 起）。
   *
   * ## 为什么现在必须有一个发币入口
   *
   * 之前 `mallBalance` 恒为 0 是可以的 —— 因为没有任何东西要买。
   * 现在娃娃机要用钻石买（`priceMall > 0`），余额恒 0 就意味着
   * **购买按钮点了必然失败**，那是「界面承诺了它做不到的事」。
   *
   * 所以先给一个**最诚实**的入口：家长在家长闸门后面自己发。
   * 文案里必须写清「先手动发，以后接支付 / 兑换码」——
   * 不假装这是一个支付流程。
   *
   * ⚠️ 走账本（`source: 'manual_adjust'`），**不是直接改余额** ——
   * 余额永远是 delta 之和。`amount` 为负就是扣回去。
   */
  mintMall: (amount: number, memo?: string) => Promise<{ ok: boolean; message: string }>

  /* ---- 娃娃机 ---- */

  /**
   * **花积分买一个娃娃机的币**（1 积分 = 1 币）。
   *
   * 扣积分和记币在**同一个事务**里（`db.buyGameCoin`）——
   * 不能写成「先扣分再记币」，那中间崩一下就变成「积分扣了、币没到」，
   * 而且不报错。
   *
   * 返回 `false` = 积分不够，**一分不扣、一个币不发**。
   */
  buyClawCoin: () => Promise<boolean>

  /**
   * **结算一局娃娃机**。
   *
   * 中不中由 `domain/clawEconomy.ts` 的 `clawResolveRound(index, ...)` 定
   * —— 幂等伪随机，同一次投币刷不刷新都是同一个结果。
   *
   * 中了就 `postHarvest` 发商城币（走商城币账本，和农场卖东西同一个入口）。
   *
   * ⚠️ `index` 必须是**这一局是第几局**（从 0 开始、只在结算后 +1）。
   * 传时间戳或者随机数进来，就等于把「刷新不能重掷」这条保证拆了。
   *
   * `ok === false` = 一个币都没扣成（没币了 / 并发撞车），此时
   * `won` 一定是 `false`。**页面必须看 `ok`** —— 只看 `won` 的话
   * 「没币」会被当成「这一局没抓到」，给孩子说一句假话。
   */
  settleClawRound: (index: number) => Promise<{ ok: boolean; won: boolean; coupons: number }>

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
  allowOvertime: boolean
  allowLateNoPenalty: boolean
  qualityRated: boolean
  rewardItemIds?: string[]
  checkInEnabled?: boolean
  checkInTargetCount?: number
  remindAt?: string
  /* ---- 奖励覆盖（2026-10-11 家长要「在任务编辑里也能改」）----
     三个都是可选覆盖：不填 = 用「设置 → 规则」里的全局默认。
     见 `domain/types.ts` 的 `Task` 同名注释（为什么是覆盖而不是必填）。 */
  /** 这条签到任务的阶梯倍率。不填 = 用 `DEFAULT_TIER_RATIO`（0.8） */
  checkInTierRatio?: number
  /** 这条长期任务的连击加成：每连一天多给几分。不填 = 用全局默认 */
  streakPerDay?: number
  /** 这条长期任务的连击封顶。不填 = 用全局默认 */
  streakCap?: number
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
      /* ⚠️ 50 是设计值，别为了「方便测试」把它调大。
         2026-09-29 曾临时改成 2000 用来试兑换，本来标注了「仅本地、不提交」，
         结果 2026-09-30 的 fce9ba1 把它一起提交了 —— 于是新装机的孩子
         一开局就有 2000 分，直接能换 1500 的「大愿望」，
         「大件要攒两周」这条设计当场作废。
         要测试就用调试句柄：`await __kqf__.addPoints(5000)`（见 README）。 */
      delta: 50,
      source: 'manual_adjust',
      memo: '欢迎来到小任务农场！这是给你的启动积分 🎁',
    })
    // 2026-10-17：全新用户启动时赠送 500 钻石（和上面的 50 启动积分同一逻辑，只给新装机的孩子）。
    await postMall({
      delta: 500,
      source: 'manual_adjust',
      memo: '欢迎来到小任务农场！这是给你的启动钻石 💎',
    })
  } else {
    await backfillMissingTasks(now)
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
  } else {
    await backfillMissingRedeemItems(now)
    await migrateRedeemPrices(now)
  }
}

/**
 * 把默认清单里**改过价的**条目同步到老设备 —— 但**只改没被动过的**。
 *
 * ------------------------------------------------------------
 * `backfillMissingRedeemItems` 只补缺的条目，改价传不下来。家长 2026-10-10
 * 明确要求改「晚睡 30 分钟」和「独处一下午」的价，所以补这一步。
 *
 * 判据是「库里的价**正好等于**迁移表里的 `from`」⇒ 说明家长没动过它。
 * 家长自己调过的一律不碰（宁可漏改，不可覆盖）。
 *
 * 迁移表在 `seedTasks.ts` 的 `REDEEM_PRICE_MIGRATIONS` —— 放在种子旁边，
 * 是为了让「改种子价格」的人一眼看到「还得加一行迁移」。
 */
async function migrateRedeemPrices(now: number): Promise<void> {
  if (REDEEM_PRICE_MIGRATIONS.length === 0) return
  const rows = await db.redeemItems.toArray()
  for (const m of REDEEM_PRICE_MIGRATIONS) {
    const row = rows.find((r) => r.name === m.name)
    // 没这条（交给 backfill）／家长动过价（不动）→ 跳过
    if (!row || row.cost !== m.from) continue
    await db.redeemItems.update(row.id, { cost: m.to, updatedAt: now })
  }
}

/**
 * 把 `SEED_TASKS` 里「这个库还没有的」任务补进去（按**标题**认）。
 *
 * ------------------------------------------------------------
 * 和 `backfillMissingRedeemItems` 是同一个坑的两侧：
 *   上面那道 `taskCount === 0` 守卫**只在空表时写**。于是 `SEED_TASKS`
 *   后来新增的任务，**已经装过的设备永远拿不到**。
 *
 * 这不是假设 —— 实测历史：`SEED_TASKS` 从首个提交的 **9 条长到 16 条**，
 * 中间 7 条新增（背诵 / 数学计算练习 / 学习日复述 / 签到 5 条 …）
 * 一条都没进过老设备。家长 2026-10-10 问「改了的任务为什么看不到」时
 * 才把这条一起查出来。
 *
 * ⚠️ **只增不改**，和兑换侧同一套契约：
 *   · 已存在的任务一个字不动 —— 家长改过的分值、时长、周期都不被覆盖；
 *   · 代价 1：`SEED_TASKS` 里的**改分值**传不到老设备
 *     （真要改就照 `REDEEM_PRICE_MIGRATIONS` 那张表补一条迁移）；
 *   · 代价 2：家长**特意删掉**的默认任务会被加回来
 *     （想彻底不要就用「隐藏任务」，见 `setTaskArchived` ——
 *     隐藏的任务**还在表里**，所以不会被这里重复加回来）。
 *
 * 为什么按**标题**认而不是 id：种子每次建库都用 `uid('tk')` 现生成 id，
 * 老库里的 id 和源码里的对不上，只有标题是稳定的。
 *
 * @returns 实际补了几条（调试句柄要用它来决定要不要刷新页面）
 */
async function backfillMissingTasks(now: number): Promise<number> {
  const existing = await db.tasks.toArray()
  const existingTitles = new Set(existing.map((t) => t.title))
  const missing = SEED_TASKS.filter((t) => !existingTitles.has(t.title))
  if (missing.length === 0) return 0
  // createdAt 逐条 +1ms：和上面的种子同一个理由 —— 别让顺序退化成「按随机主键排」
  await db.tasks.bulkPut(
    missing.map((t, i) => ({
      ...t,
      id: uid('tk'),
      createdAt: now + i,
      updatedAt: now + i,
    })),
  )
  return missing.length
}

/**
 * 把 `SEED_REDEEM_ITEMS` 里「这个库还没有的」条目补进去。
 *
 * ------------------------------------------------------------
 * 为什么需要它（2026-10-10 家长反馈）：
 *   上面那道 `redeemCount === 0` 守卫**只在空表时写**。于是改种子只对
 *   「全新安装」生效 —— 已经装过、表里有 12 条的设备，家长在源码里
 *   新增的兑换品**永远拿不到**。家长连着问了两遍「兑换的为啥还没有」，
 *   查了半天代码和产物全对，问题就在这道守卫上。
 *
 * ⚠️ **只增不改**（家长 2026-10-10 明确选的这条）：
 *   · 已存在的条目**一个字都不动** —— 家长自己调过价、改过名的不会被种子覆盖；
 *   · 代价：默认清单里的**改价**传不到老设备（比如「晚睡 30 分钟」120→30
 *     对老设备无效，只有新装才生效）；
 *   · 另一个代价：家长**特意删掉**的默认条目会被加回来（想彻底不要就隐藏它，
 *     见 `setRedeemItemArchived`）。
 *
 * 为什么按**名字**认而不是 id：种子每次建库都用 `uid('rd')` 现生成 id，
 * 老库里的 id 和源码里的对不上，只有名字是稳定的。
 */
async function backfillMissingRedeemItems(now: number): Promise<void> {
  const existing = await db.redeemItems.toArray()
  const existingNames = new Set(existing.map((r) => r.name))
  const missing = SEED_REDEEM_ITEMS.filter((r) => !existingNames.has(r.name))
  if (missing.length === 0) return
  // createdAt 逐条 +1ms：和上面的种子同一个理由 —— 别让顺序退化成「按随机主键排」
  await db.redeemItems.bulkPut(
    missing.map((r, i) => ({
      ...r,
      id: uid('rd'),
      createdAt: now + i,
      updatedAt: now + i,
    })),
  )
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
  'mallLedger',
  'gameKv',
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
  'mallLedger',
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

/* ---------------- 游戏：拥有关系与「当前」（插件骨架，2026-10-14 起） ---------------- */

/**
 * 已拥有的游戏 id = 「默认拥有」的 + 「账本里买过」的。**只有这一个来源。**
 *
 * 刻意**不**往 `settings` 里存一份 `ownedGames` —— 那就成了第二份事实：
 * 退款、清库、导入备份、兑换码补发，任何一处忘了同步就会走散，
 * 而且不报错（本项目在 `Task` / `TaskInstance` 上已经吃过一次这个亏）。
 *
 * 账本里可能出现**注册表里已经没有的 id**（游戏下线了）。这里照样收进来：
 * 万一它以后又上架，家长的购买记录还在。反正渲染层只认注册表。
 */
function ownedGameIdsFrom(mallLedger: readonly MallEntry[]): string[] {
  const ids = new Set<string>()
  for (const g of GAMES) if (ownedByDefault(g)) ids.add(g.id)
  for (const id of purchasedIdsFrom(mallLedger)) ids.add(id)
  return [...ids]
}

/**
 * 把 `settings.activeGame` 解析成一个**真的能用**的 id。
 *
 * 存档里那个 id 有四种失效方式：
 *   ① 那款游戏还没买（清库 / 退款 / 导入了别的设备的备份）；
 *   ② 注册表里已经没有它了（改过 id / 游戏下线）；
 *   ③ 字段根本不存在（老库）；
 *   ④ **下载来的游戏被卸载了**（包没了，但 `settings.activeGame` 还指着它）。
 * 前三种回落到 `DEFAULT_GAME_ID`（首款，免费且默认拥有，所以兜底一定有效）；
 * ④ 也一样 —— 不回落的话底部导航会指着一个挂不起来的游戏。
 *
 * ⚠️ `installed` 要**先判**：下载来的游戏**不在注册表里**（`gameById` 找不到它），
 * 所以按注册表那条路走它永远解析不出来 —— 整个插件系统就退化成「能装不能玩」。
 * 这就是本项目最怕的那种「静默失效」：不报错，只是永远回落到农场。
 *
 * ⚠️ 少了这一步，底部导航会指着一个不存在的页面 —— 而 React 那边
 * 只是渲染出一个空白 tab，**不报错**。
 */
function resolveActiveGame(
  rawId: string | undefined,
  owned: readonly string[],
  installed: ReadonlySet<string>,
): string {
  // 下载来的游戏：**装了就是可玩的**，没有「拥有」这一层（P1 不做购买）。
  if (rawId && installed.has(rawId)) return rawId
  const g = gameById(rawId)
  if (g && g.status === 'available' && owned.includes(g.id)) return g.id
  return DEFAULT_GAME_ID
}

/* ---------------- 插件游戏：宿主 API 与「已安装」清单 ---------------- */

/**
 * 造一个绑定到某款游戏的 `HostApi`。
 *
 * ⚠️ 依赖一律**现读** `useApp.getState()`，不要在造的时候把余额 / 开关
 * 快照进去 —— 那样插件看到的是一个永远不变的旧余额。
 */
function pluginHostApi(gameId: string): HostApi {
  return makeHostApi({
    getBalance: () => useApp.getState().balance,
    refresh: () => useApp.getState().refresh(),
    pushToast: (t) => useApp.getState().pushToast(t),
    soundEnabled: () => useApp.getState().settings.soundEnabled,
    hapticsEnabled: () => useApp.getState().settings.hapticsEnabled,
  })(gameId)
}

/**
 * 读出**已安装**的游戏清单（id → manifest）。
 *
 * 每个包都要 `importBundle` 一次才能拿到 manifest，也就是启动时要把已安装的
 * 包都求值一遍。包小、数量少时没问题；将来包多了要改成「manifest 另存一份
 * 小文件、代码按需求值」（P2 的事，spec §12.7）。
 *
 * 现在**刻意不另存一份 manifest** —— 那就是第二份事实，迟早和包本身走散。
 */
async function loadInstalledGames(): Promise<Record<string, GameManifestV2>> {
  const out: Record<string, GameManifestV2> = {}
  for (const { code } of await listInstalledBundles()) {
    try {
      const b = await importBundle(code)
      out[b.manifest.id] = b.manifest
    } catch (e) {
      // 包坏了（下载截断 / 手改过库 / 契约变了）**不能把整个 App 拦下来** ——
      // 跳过它，宿主照常启动。但必须**留下痕迹**，否则就成了静默消失。
      console.warn('[games] 已安装的包加载失败，已跳过：', e)
    }
  }
  return out
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
    mallLedger,
    inventory,
    animals,
    checkIns,
    checkInProgress,
    balance,
    harvestBalance,
    mallBalance,
    redeemItems,
    allRedeemItems,
    redeemRecords,
    farmEvents,
    quotaCarry,
    clawCoins,
    clawPlaysRaw,
  ] = await Promise.all([
    db.taskInstances.orderBy('date').reverse().toArray(),
    // 全量加载流水。这里曾经 limit(500)，导致孩子用久了以后
    // 早期的记录从「积分」页凭空消失，而导出却还在 —— 对不上账。
    // 单机场景下流水量级很小（一年也就几千条），全量读没有压力。
    db.ledger.orderBy('createdAt').reverse().toArray(),
    // 商城币流水同理，全量读。
    db.harvestLedger.orderBy('createdAt').reverse().toArray(),
    // 钻石流水同理。这一轮它通常是空的（没有发币入口）。
    db.mallLedger.orderBy('createdAt').reverse().toArray(),
    db.inventory.toArray(),
    db.animals.toArray(),
    db.checkIns.toArray(),
    db.checkInProgress.toArray(),
    currentBalance(),
    currentHarvestBalance(),
    currentMallBalance(),
    loadRedeemItems(),
    loadAllRedeemItems(),
    loadRedeemRecords(),
    loadFarmEvents(40),
    loadQuotaCarry(),
    // 娃娃机的币余额。和宿主那三套币同一个口径：**算出来的**（账本 delta 之和），
    // 不存 `balance` 字段 —— 存了就会出现「余额和流水对不上」，而且不报错。
    gameCoinBalanceOf(GAME_CLAW),
    // 已玩局数（下一局的 seed 来源）。脏数据一律当 0 —— 不炸。
    getGameKv<unknown>(GAME_CLAW, CLAW_PLAYS_KEY),
  ])

  // 拥有关系从账本派生；「当前游戏」再按拥有关系解析一遍 ——
  // 顺序不能反，否则会拿旧账本去判「买了没」。
  const ownedGameIds = ownedGameIdsFrom(mallLedger)
  // 已安装的插件游戏：**从 `gameKv` 派生**（扫 `__bundle` 行），不另存清单。
  const installedGames = await loadInstalledGames()

  set({
    tasks,
    allTasks,
    instances,
    ledger,
    harvestLedger,
    mallLedger,
    installedGames,
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
    mallBalance,
    clawCoins,
    // 脏数据（负数 / 非整数 / 字符串）一律当 0：局数只用来当 seed，
    // 不值得为它炸掉整个 refresh。
    clawPlays: typeof clawPlaysRaw === 'number' && Number.isFinite(clawPlaysRaw) && clawPlaysRaw >= 0
      ? Math.floor(clawPlaysRaw)
      : 0,
    ownedGameIds,
    activeGameId: resolveActiveGame(
      settings.activeGame,
      ownedGameIds,
      new Set(Object.keys(installedGames)),
    ),
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
    'overtimeEnabled' | 'qualityBonusEnabled' | 'minRatioForPoints'
  > = {
    overtimeEnabled: settings.overtimeEnabled,
    qualityBonusEnabled: settings.qualityBonusEnabled,
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

  /* 任务定义上配置的道具掉落 —— 受「设置 → 道具掉落」总开关控制。
     ⚠️ 这个判断不能只放在编辑页去「隐藏」那一块（2026-09-30 之前就是这么干的，
        开关叫 taskDropsEnabled、默认 true，而且**只管界面**）：家长关掉之后
        已经配好掉落的旧任务照旧掉，他以为自己关掉了、其实没有。
        界面上「看不到」不等于「不会发生」。 */
  if (settings.itemDropsEnabled) {
    for (const itemId of inst.rewardItemIds ?? []) {
      await addItem(itemId, 1)
    }
  }

  /* 连击奖励 —— **只发给长期任务**（2026-10-11 家长定：
     「长期任务这种次数的可以有连续奖励……不能两种同时都有」）。
     今日任务天天都要做，签到有自己的阶梯奖励，两者都不给连击。
     判据用 `isPeriodTask`，和「长期任务」区块共用同一个谓词 —— 否则会
     出现「区块里列着它、连击却不发」这种两处口径打架。
     ⚠️ 必须查**任务定义**而不是 `inst.cycle`：单次 / 每日任务也有实例，
     只看周期会漏判（签到任务同样有 cycle）。

     ⚠️ 2026-10-12 家长把设置里的连击总开关删了（「不需要在家长设置里设定，
     因为任务里已经可以单独设置了」），所以这里**不再有 `settings.*` 闸门** ——
     连击永远生效，发多少只看任务自己的 `streakPerDay` / `streakCap`。
     想给单条任务关掉：把它的「每连一天多给」设成 0（算式 `min(cap, 天×0) = 0`）。 */
  let streakBonus = 0
  if (result.points > 0) {
    const def = get().tasks.find((t) => t.id === inst.taskId)
    // 把任务传进去 —— 连击的「每天加几分 / 封顶」可以按任务设（2026-10-11）。
    if (def && isPeriodTask(def)) streakBonus = await maybePayStreakBonus(def)
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
 * 取某个签到任务**当前周期**的进度行。
 *
 * `checkInDays` 和 `checkInClaimedTiers` 都必须从这里取 ——
 * 一个带周期键、一个不带，界面上的「已坚持 N 天」和阶梯状态就会互相矛盾
 * （第二周会读到第一周的 `claimedTiers`，阶梯全部显示「已拿」）。
 */
function currentCheckInRow(
  get: () => Pick<AppState, 'tasks' | 'checkInProgress' | 'settings'>,
  taskId: string,
): CheckInProgress | undefined {
  const { tasks, checkInProgress, settings } = get()
  const cycle = tasks.find((t) => t.id === taskId)?.cycle ?? 'daily'
  const key = periodKeyFor(cycle, Date.now(), settings.dayStartHour)
  return checkInProgress.find((p) => p.taskId === taskId && p.periodKey === key)
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

  /* 发多少分**只算这一次**，而且用的是「家长审核卡上显示多少分」那同一个函数。
     ⚠️ 别把 base / tier 又在这里展开算一遍 ——
     审核卡原来就写着 `+task.basePoints`，实际到账却是 base + 阶梯，
     写 5 实发 7。同一个事实存两份，迟早走散（本项目的老毛病）。
     `checkInPayout` 内部已经把 date 并进 days 之后再数天数 ——
     否则「今天是第几天」永远少一天，阶梯永远差一档才触发，而且不报错。 */
  const payout = checkInPayout(task, progress.days, progress.claimedTiers, date)
  const gained = payout.base

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

  if (payout.base > 0) {
    await postLedger({
      delta: payout.base,
      source: 'checkin',
      refId: record.id,
      memo: `签到：${task.title}`,
    })
  }

  /* 签到**没有**连击流水了（2026-10-11 家长定：签到只留阶梯奖励，
     连击奖励归长期任务）。原来这里有一条 `checkin_bonus` 的连击流水，
     是整块删掉的 —— 留着会让账本里出现一笔界面已经不再预告的分。 */

  // 自动结算已达成的阶梯奖励
  let bonus = 0
  let tierLabel: string | undefined
  for (const tier of payout.tiers) {
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
    // 阶梯里的道具也归「设置 → 道具掉落」管（家长 2026-09-30 定：
    // 道具全由开关管，一处例外都不留）。积分照发，只停道具。
    if (tier.itemId && get().settings.itemDropsEnabled) await addItem(tier.itemId, 1)
  }
  if (payout.tiers.length > 0) {
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

/* ============================================================
   编辑任务 → 同步到「今天的卡」
   ------------------------------------------------------------
   2026-10-08 用户报的 bug：「任务点编辑，修改得分好像不生效」。

   根因：单次 / 每日任务在创建时就 `makeInstance()` 落了一条 TaskInstance，
   而实例里的 title / plannedMinutes / basePoints … 是**那一刻的快照**
   （见 domain/recurrence.ts 的 makeInstance）。之后 updateTask 只写
   db.tasks，从不碰已经存在的实例，于是同一个改动有两个读不到的读者：

     · 今天那张卡显示的是实例上的旧值（TaskPage 读 inst.basePoints）
     · 结算喂给 settleInstance 的也是实例（settleNow 传的是 `{ ...inst }`）

   两处都读实例 → 改任务定义等于白改。周期任务（周/月/年）**不预生成实例**，
   卡片直接读 task 定义，所以只有它们「改了就生效」——
   这也解释了为什么这个 bug 看起来时灵时不灵。

   另一条不能越过的线：**过去的日子是历史**。settled 的积分已经进账本，
   expired 的是「那天没做」的记录，改任务定义都不该回写它们，
   否则卡片显示会和账本对不上。
   ============================================================ */

/**
 * 实例上「从任务定义快照过来」的字段。
 *
 * ⚠️ 必须和 `domain/recurrence.ts` 的 `makeInstance()` 一一对应：
 * 那里抄了哪些字段，这里就得同步哪些，漏一个就是那个字段「改了不生效」。
 * 返回类型写成 `Pick<TaskInstance, MirroredField>`，于是两边都有编译期护栏：
 * 少写一个字段、或写了一个 TaskInstance 上没有的字段，tsc 都会报错。
 */
type MirroredField =
  | 'title'
  | 'category'
  | 'cycle'
  | 'plannedMinutes'
  | 'basePoints'
  | 'allowOvertime'
  | 'allowLateNoPenalty'
  | 'qualityRated'
  | 'rewardItemIds'

function mirroredFrom(task: Task): Pick<TaskInstance, MirroredField> {
  return {
    title: task.title,
    category: task.category,
    cycle: task.cycle,
    plannedMinutes: task.plannedMinutes,
    basePoints: task.basePoints,
    allowOvertime: task.allowOvertime,
    allowLateNoPenalty: task.allowLateNoPenalty,
    qualityRated: task.qualityRated,
    rewardItemIds: task.rewardItemIds ?? [],
  }
}

/**
 * 把任务定义的最新值写到「还没结算的今天的卡」上。
 *
 * 只处理 `date >= todayKey` 且 `settledAt == null` 的实例 —— 也就是
 * 「今天及以后、还没发过分」的那些。过去的、已结算的一律不动。
 */
async function syncLiveInstances(task: Task, todayKey: string, now: number): Promise<void> {
  const rows = await db.taskInstances.where('taskId').equals(task.id).toArray()
  const live = rows.filter((i) => i.settledAt == null && i.date >= todayKey)
  if (live.length === 0) return

  // 改成「周 / 月 / 年」之后，这条任务不再有「今天那张卡」：
  // 进度改由任务定义驱动（selectPeriodTasks / periodUnitsFor）。
  // 留着旧卡会让同一个任务同时出现在「今日任务」和「长期任务」两个区块。
  //
  // 只删「本来就是预生成卡片」的那些（cycle 是单次/每日）——
  // 周期任务的提交记录是孩子交上来的作业，不能顺手删掉。
  if (!isPreGenerated(task.cycle)) {
    const cards = live.filter((i) => isPreGenerated(i.cycle))
    if (cards.length > 0) await db.taskInstances.bulkDelete(cards.map((i) => i.id))
    return
  }

  const mirror = mirroredFrom(task)
  await db.taskInstances.bulkPut(
    live.map((i) => ({
      ...i,
      ...mirror,
      // cycle 只往「本来就是卡片」的实例上写。把一条周期提交记录翻成卡片，
      // 会和 planMissingInstances 新建的那张撞车 —— 同一个任务两张卡。
      cycle: isPreGenerated(i.cycle) ? mirror.cycle : i.cycle,
      updatedAt: now,
    })),
  )
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  loading: true,
  settings: DEFAULT_SETTINGS,
  tasks: [],
  allTasks: [],
  instances: [],
  ledger: [],
  harvestLedger: [],
  mallLedger: [],
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
  mallBalance: 0,
  clawCoins: 0,
  clawPlays: 0,
  activeGameId: DEFAULT_GAME_ID,
  ownedGameIds: ownedGameIdsFrom([]),
  installedGames: {},
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
    //
    // ⚠️ 用时必须走 `runningMinutes(inst, end)`，**不能**写 `end - startedAt`：
    // 中间暂停过的话那段时间不该算进去（客户反馈要的暂停功能）。
    const running = get().instances.filter((i) => i.status === 'pending' && i.startedAt)
    for (const inst of running) {
      if (!inst.startedAt) continue
      const startedKey = appDayKey(inst.startedAt, settings.dayStartHour)
      if (startedKey === nextDay) continue // 今天开的，还在计
      const end = Math.min(now, dayStart)
      const minutes = Math.max(0.1, runningMinutes(inst, end))
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
    const now = Date.now()
    await db.tasks.update(id, { ...patch, updatedAt: now })

    // 任务定义改了，已经落库的「今天的卡」不会自己跟着变 —— 实例里的
    // title / plannedMinutes / basePoints 都是建卡那一刻的快照，而卡片显示
    // 和结算读的都是实例。少了这一步，就是用户报的「改得分不生效」。
    const task = await db.tasks.get(id)
    if (task) await syncLiveInstances(task, currentDayKey(get().settings.dayStartHour), now)

    await get().refresh()
  },

  setTaskArchived: async (id, archived) => {
    // 软隐藏：只翻一个标志位。任务底下的实例、签到记录、账本**一律不动** ——
    // 硬删会把这些连坐带走，而家长想要的通常只是「别让孩子看见」。
    await db.tasks.update(id, { archived, updatedAt: Date.now() })
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
   * 暂停计时。
   *
   * ⚠️ 守卫条件里 `!inst.startedAt` 不能省：没点过「开始」的实例
   * 压根没有计时在跑，暂停它没有意义（会把一个没开始的计时器标成暂停）。
   *
   * ⚠️ 幂等：已经是暂停状态就直接 return。孩子连点两下不该把
   * `pausedAt` 刷成新的时间戳 —— 那会把第一次暂停的时长**吃掉**。
   */
  pauseTimer: async (instanceId) => {
    const inst = await db.taskInstances.get(instanceId)
    if (!inst || inst.status !== 'pending' || !inst.startedAt) return
    if (inst.pausedAt) return
    const now = Date.now()
    await db.taskInstances.update(instanceId, { pausedAt: now, updatedAt: now })
    get().pushToast({ kind: 'info', title: '计时暂停了', detail: '休息一下，回来点「继续」', emoji: '⏸️' })
    await get().refresh()
  },

  /**
   * 继续计时。
   *
   * 把 `now - pausedAt` 累加进 `pausedTotalMs`，再清掉 `pausedAt`。
   * 之后 `runningMs()` 算出来的用时自然就**不含**这段暂停。
   *
   * ⚠️ 两个字段**必须在同一次 update 里写完**。分两次写的话，
   * 中间那一刻 `pausedAt` 已经清了、`pausedTotalMs` 还没加 ——
   * 任何在这间隙跑的 `runningMs()`（tick / 渲染）都会把暂停时长算成用时。
   */
  resumeTimer: async (instanceId) => {
    const inst = await db.taskInstances.get(instanceId)
    if (!inst || inst.status !== 'pending' || !inst.pausedAt) return
    const now = Date.now()
    await db.taskInstances.update(instanceId, {
      pausedAt: undefined,
      pausedTotalMs: (inst.pausedTotalMs ?? 0) + Math.max(0, now - inst.pausedAt),
      updatedAt: now,
    })
    get().pushToast({ kind: 'success', title: '接着计时啦', emoji: '▶️' })
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

    // 若没传用时，但有计时记录 → 用计时算（含暂停扣减，见 `runningMinutes`）
    let minutes = actualMinutes
    if (minutes == null && inst.startedAt) {
      minutes = Math.max(0.1, runningMinutes(inst))
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
    // 倍率的取值只有两级：任务自己的，或者 `tierRatioFor` 兜到的内置默认
    // （2026-10-12 起设置里那个全局值删了）。走 `tierRatioFor`，
    // 别在这里重写一遍 —— 否则「界面上显示的阶梯」和「真正发的」
    // 会各按一套优先级走。
    return defaultTiers(task.cycle, target, task.basePoints, tierRatioFor(task))
  },

  checkInDays: (taskId) => currentCheckInRow(get, taskId)?.days ?? [],

  checkInClaimedTiers: (taskId) => currentCheckInRow(get, taskId)?.claimedTiers ?? [],

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
    const tiers = defaultTiers(
      task.cycle,
      task.checkInTargetCount ?? 5,
      task.basePoints,
      // 同 `tiersFor`：这条任务自己的倍率优先，没设才用内置默认。
      tierRatioFor(task),
    )
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
    // 阶梯里的道具也归「设置 → 道具掉落」管（家长 2026-09-30 定：
    // 道具全由开关管，一处例外都不留）。积分照发，只停道具。
    if (tier.itemId && get().settings.itemDropsEnabled) await addItem(tier.itemId, 1)
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
            ? `当场卖掉，+${earned} 商城币`
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
      // 卖产出结的是**商城币**，不是积分 —— 别写回「换积分」。
      detail: roll.event?.message ?? '去市场卖掉就能换商城币啦',
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

    // 市场是农场产出的唯一出口，结的是**商城币**，不是积分。
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
        title: `卖出 ${sellCount} ${produceUnitOf(itemId)}${name}，+${total} 商城币`,
        detail:
          sellCount < want
            ? `这一轮只剩 ${Math.round(remaining)} 商城币的额度了，先卖了 ${sellCount} ${produceUnitOf(itemId)}`
            : dropPct < -1
              ? `卖得多了，价格跌到 ${newPrice} 商城币（${dropPct}%）`
              : `当前单价 ${current} 商城币`,
        emoji: '🎟️',
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
    const { redeemRecords, todayKey, settings } = get()
    /**
     * ⚠️ 用**逻辑日**（`appDayKey`）比，不能用日历日（`toDateKey`）。
     *
     * `todayKey` 是 `currentDayKey(dayStartHour)` 算出来的逻辑日。日切点默认
     * 凌晨 4 点，于是 00:00–04:00 这段时间里两者差一天：凌晨 1 点兑换的记录
     * 日历日是「今天」，逻辑日却是「昨天」——拿日历日去比永远不相等，
     * `redeemedToday` 恒为 0，`limitPerDay` 闸门在凌晨静默失效
     * （孩子可以在这个窗口里把「一天只能换 1 次」的东西换到饱）。
     *
     * 2026-10-08 发现：这条断言本来只在白天跑得绿，凌晨跑必红。
     */
    return redeemRecords.filter(
      (r) => r.itemId === itemId && appDayKey(r.createdAt, settings.dayStartHour) === todayKey,
    ).length
  },

  /**
   * 兑换。
   *
   * 原子性很关键：扣钱 + 写兑换记录必须在一个事务里，
   * 否则会出现「钱扣了但没记录」（家长不知道要兑现什么）
   * 或「有记录但没扣钱」（白拿）的不一致。
   *
   * ## 分账：商城币优先（用户 2026-09-30）
   *
   * 「优先用商城币兑换。价值和积分等价的。用完商城币再用积分，可混合。」
   *
   * 于是这里最多要动**三张表**：`harvestLedger`（商城币那笔）、
   * `ledger`（积分那笔）、`redeemRecords`（记录）。三张必须同一个事务 ——
   * 只扣了商城币却没写记录，孩子的东西就凭空没了。
   *
   * ⚠️ **分账要在事务内用实时余额重算一遍**，不能用外面那份。
   * 外面那份只是给 UI 看的预览；两个标签页同时点「换」时，
   * 用旧余额算出的分账会把已经花掉的商城币又花一次。
   */
  redeem: async (itemId) => {
    const { balance, harvestBalance, settings, redeemItems } = get()
    if (!settings.redeemEnabled) {
      get().pushToast({ kind: 'info', title: '兑换还没开放哦', emoji: '🔒' })
      return false
    }

    const item = redeemItems.find((i) => i.id === itemId)
    if (!item) return false

    const preview = planRedeemPayment(item.cost, harvestBalance, balance)
    if (!preview.affordable) {
      get().pushToast({
        kind: 'warn',
        title: '还差一点点',
        detail: `商城币和积分加起来还差 ${preview.shortfall}，加油攒一攒`,
        emoji: '🎟️',
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
    /**
     * 事务里实际用掉的分账。买不起时保持 `null`，下面的 toast 就不会误报。
     *
     * ⚠️ 用**对象包一层**而不是裸 `let paid = null`：事务回调是在闭包里赋值的，
     * TS 的控制流分析看不到，会把 `paid` 一直当成 `null`，于是
     * `if (!paid) return` 之后它被收窄成 `never`，读字段直接报 TS2339。
     * 包成对象后按属性读，函数调用会重置属性的收窄，类型就对了。
     */
    const box: { paid: { harvestPaid: number; pointsPaid: number } | null } = { paid: null }
    let balanceAfter = balance
    let harvestAfter = harvestBalance

    await db.transaction('rw', [db.ledger, db.harvestLedger, db.redeemRecords], async () => {
      // 余额以「delta 之和」为准，时间戳严格递增 —— 见 db.ts 的 ledgerTip
      const pTip = await ledgerTip()
      const hTip = await harvestTip()

      // 事务内**重新分账**：以实时余额为准，理由见函数头注释
      const live = planRedeemPayment(item.cost, hTip.balance, pTip.balance)
      if (!live.affordable) {
        ok = false
        return
      }

      balanceAfter = pTip.balance - live.pointsPaid
      harvestAfter = hTip.balance - live.harvestPaid

      // 商城币那笔。`harvest_redeem` 这个 source 从 09-15 定义起就一直空着，
      // 就是留给这条路的 —— 见 types.ts 的 HarvestSource。
      if (live.harvestPaid > 0) {
        await db.harvestLedger.put({
          id: `hv_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          delta: -live.harvestPaid,
          balanceAfter: harvestAfter,
          source: 'harvest_redeem',
          refId: item.id,
          memo: `兑换：${item.name}`,
          createdAt: hTip.createdAt,
        })
      }

      // 积分那笔。`pointsPaid === 0` 时**不写** ——
      // 写一笔 delta 0 的账会在流水里凭空多出一条「兑换 0 分」。
      if (live.pointsPaid > 0) {
        await db.ledger.put({
          id: `lg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          delta: -live.pointsPaid,
          balanceAfter,
          source: 'redeem',
          refId: item.id,
          memo: `兑换：${item.name}`,
          createdAt: pTip.createdAt,
        })
      }

      await db.redeemRecords.put({
        id: uid('rr'),
        itemId: item.id,
        name: item.name,
        emoji: item.emoji,
        cost: item.cost,
        harvestPaid: live.harvestPaid,
        pointsPaid: live.pointsPaid,
        balanceAfter,
        harvestBalanceAfter: harvestAfter,
        fulfilled: false,
        createdAt: now,
      })

      box.paid = { harvestPaid: live.harvestPaid, pointsPaid: live.pointsPaid }
    })

    const paid = box.paid
    if (!ok || !paid) {
      get().pushToast({
        kind: 'warn',
        title: '商城币和积分不够啦',
        detail: '再攒一攒吧',
        emoji: '🎟️',
      })
      return false
    }

    const howPaid = describeRedeemPayment({
      cost: item.cost,
      harvestPaid: paid.harvestPaid,
      pointsPaid: paid.pointsPaid,
    })

    set({
      settleFlash: {
        points: -paid.pointsPaid,
        reason: `兑换了「${item.name}」`,
        emoji: item.emoji,
      },
    })
    get().pushToast({
      kind: 'reward',
      title: `兑换成功：${item.name}`,
      detail: `花了 ${howPaid} · 记得找爸爸妈妈兑现哦`,
      emoji: item.emoji,
    })
    await get().refresh()
    return true
  },

  fulfillRedeem: async (recordId) => {
    await db.redeemRecords.update(recordId, { fulfilled: true, fulfilledAt: Date.now() })
    await get().refresh()
  },

  /* ================= 游戏（插件骨架） ================= */

  setActiveGame: async (id) => {
    // **下载来的游戏**：装了就能设为当前。P1 没有「购买」这一层
    // （spec §12.7：先不做下载，也就没有要收费的东西），所以判据就是
    // 「包在不在 `installedGames` 里」。
    // ⚠️ 这一支必须在注册表那两支**之前** —— 下载来的游戏不在注册表里，
    //    走到下面会直接被 `!g` 拦掉，于是「装好了却切不过去」。
    if (get().installedGames[id]) {
      if (get().activeGameId === id) return
      await get().updateSettings({ activeGame: id })
      await get().refresh()
      return
    }

    // 内置游戏两道守卫，缺一不可：
    //   ① 注册表里真有它，而且**可玩**（`comingSoon` 的不算）；
    //   ② 已经拥有它。
    // 不满足就**安静地什么都不做** —— 这个动作可能被旧存档、手改的
    // IndexedDB 或测试触发，那种情况不该把页面炸掉。
    const g = gameById(id)
    if (!g || g.status !== 'available') return
    if (!get().ownedGameIds.includes(g.id)) return
    if (get().activeGameId === g.id) return
    await get().updateSettings({ activeGame: g.id })
    await get().refresh()
  },

  buyGame: async (id) => {
    const g = gameById(id)
    if (!g) return { ok: false, message: '没有这款游戏' }
    if (g.status !== 'available') return { ok: false, message: '这款游戏还没做好' }
    if (get().ownedGameIds.includes(g.id)) return { ok: false, message: '已经买过了' }
    if (g.priceMall <= 0) {
      // 免费游戏不该走购买流程 —— 它应该直接是 `defaultOwned`。
      // 真碰到说明注册表配错了；这里**不写一笔 0 币的假账**，直接拒绝。
      return { ok: false, message: '这款游戏是免费的，不用买' }
    }
    // 扣款走 `spendMall`：**守卫（余额够不够）和扣款在同一个事务里**。
    // 别改成「先读余额、再 postMall」—— 那会把守卫放到事务外面，
    // 并发时两边都读到「够」然后都扣（`consumeItem` 的注释里记过这次事故）。
    const ok = await spendMall(g.priceMall, {
      source: 'game_purchase',
      refId: g.id,
      memo: `购买「${g.name}」`,
    })
    if (!ok) {
      const balance = await currentMallBalance()
      return { ok: false, message: `${CURRENCY.mall.name}不够，还差 ${g.priceMall - balance}` }
    }
    await get().refresh()
    // ⚠️ 买完**不自动切成当前**。家长可能是在提前囤游戏；
    //    切「当前」是一次显式操作（家长栏里那一行上的按钮）。
    return { ok: true, message: `已购买「${g.name}」` }
  },

  mintMall: async (amount, memo) => {
    const n = Math.round(amount)
    if (!Number.isFinite(n) || n === 0) return { ok: false, message: '数量要是非 0 的整数' }
    // 走账本，**不是直接改余额** —— 余额永远是 delta 之和。
    await postMall({
      delta: n,
      source: 'manual_adjust',
      memo: memo ?? (n > 0 ? '家长发放' : '家长扣回'),
    })
    await get().refresh()
    return { ok: true, message: n > 0 ? `已发放 ${n} ${CURRENCY.mall.name}` : `已扣回 ${-n} ${CURRENCY.mall.name}` }
  },

  /* ================= 娃娃机 ================= */

  buyClawCoin: async () => {
    // ⚠️ 扣积分和记币必须在**同一个事务**里 —— 所以走 `db.buyGameCoin`，
    //    不是「先 spendPoints 再 addGameCoin」。理由见那个函数的注释。
    const ok = await buyGameCoin(GAME_CLAW, CLAW_PLAY_COST, '买 1 个娃娃机币')
    if (ok) await get().refresh()
    return ok
  },

  settleClawRound: async (index) => {
    const s = get().settings
    // 参数从设置里现读，并且**夹一遍** —— 老存档里可能没有这两个字段，
    // 也可能被手改过（IndexedDB 是能直接改的）。夹紧的逻辑只有一份：
    // `clawEconomy.ts` 的 `clampClawEconomy`（有全参数空间单测钉着）。
    const econ = clampClawEconomy({
      winRate: s.clawWinRate ?? CLAW_DEFAULT_WIN_RATE,
      exchangePerPrize: s.clawExchangePerPrize ?? CLAW_DEFAULT_EXCHANGE,
    })
    const round = clawResolveRound(index, econ)

    // ★ 三件事必须在**同一个事务**里：扣一个币、发商城币、局数 +1。
    //   拆开的话中间崩一下就变成「币扣了、券没发」或者「券发了、局数没走」，
    //   而且**都不报错**。Dexie 的嵌套事务会复用外层事务，所以内层那两个
    //   函数仍然只有一份实现，守卫也还都在它们自己里面。
    const ok = await db.transaction('rw', db.gameKv, db.harvestLedger, async () => {
      /*
        ★★ 「同一局只能结算一次」的闸门。

        没有它的话，`settleClawRound(3)` 调两次就**扣两个币、发两遍券** ——
        而且第二遍算出来的结果和第一遍**一模一样**（seed 是 index，
        幂等），所以看着完全正常，只是账上少了一个币。
        页面那边有 `busyRef` 挡着，但那是 UI 层的约定，不是账上的保证。

        ⚠️ 读和判必须在这个事务里。放到事务外面就是经典的
        「先读后写」：两个并发调用都读到 3，都以为自己是对的。
      */
      const raw = await getGameKv<unknown>(GAME_CLAW, CLAW_PLAYS_KEY)
      const cur =
        typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0
      if (cur !== index) return false

      const paid = await spendGameCoin(GAME_CLAW, CLAW_PLAY_COST, '玩一局娃娃机')
      if (!paid) return false
      if (round.coupons > 0) {
        // 发商城币走**和农场卖东西同一个入口**（`postHarvest`）——
        // 不另开一条通路，账目才只有一套口径。
        await postHarvest({
          delta: round.coupons,
          source: 'claw_prize',
          memo: `娃娃机抓到 1 只，兑换 ${round.coupons} 商城币`,
        })
      }
      // ★ 局数只在**结算之后** +1。中途刷新时它没变 ⇒ 结果一样（不会重掷）。
      await setGameKv(GAME_CLAW, CLAW_PLAYS_KEY, index + 1)
      return true
    })
    await get().refresh()
    return { ok, won: ok && round.won, coupons: ok ? round.coupons : 0 }
  },

  /* ---- 插件游戏：装配（spec §12.5） ---- */

  installFromCatalog: async (catalogUrl, gameId) => {
    // ① 先把整条校验链跑完（验签 → 解析 → 取包 → 验哈希）。
    //    它会把**任何没验过的东西**拒掉；公钥没配也会在这里抛。
    let resolved: ResolvedGame
    try {
      resolved = await fetchVerifiedGame({
        catalogUrl,
        gameId,
        publicKeyRaw: catalogPublicKeyRaw(),
      })
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }

    // ② 到这里代码才是「签名认过 + 哈希对过」的，可以执行了。
    let bundle: GameBundle
    try {
      bundle = await importBundle(resolved.code)
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }

    // ③ 目录说它是 id X，包自己写的是 id Y ⇒ 发布方那边就不一致。
    //    装下去会让「已安装列表」和真正跑的东西对不上，所以拒绝。
    if (bundle.manifest.id !== resolved.game.id) {
      return {
        ok: false,
        message: `目录里这款是「${resolved.game.id}」，但包里写的是「${bundle.manifest.id}」—— 拒绝安装`,
      }
    }

    // ④ 下载来的包不许占用内置游戏的 id（否则 = 劫持，理由见下面 installGameFromUrl）。
    if (gameById(bundle.manifest.id)) {
      return { ok: false, message: `安装包用了内置游戏的 id「${bundle.manifest.id}」，已拒绝` }
    }

    await setGameKv(bundle.manifest.id, BUNDLE_KEY, resolved.code)
    await get().refresh()
    return {
      ok: true,
      // 名字用**目录**里的（它才是已验签的显示来源），不用包自己说的
      message: `已安装「${resolved.game.name}」v${resolved.game.version}`,
    }
  },

  installGameFromUrl: async (url) => {
    let code: string
    try {
      const res = await fetch(url)
      if (!res.ok) return { ok: false, message: `下载失败：HTTP ${res.status}` }
      code = await res.text()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: `下载失败：${msg}` }
    }

    // ★★ 顺序很重要：**先校验，再执行**。
    //    P1 这一步还没有哈希 / 签名校验（P2 补，见 spec §12.4）——
    //    但**校验的位置**已经在这里了：它必须在 `importBundle` **之前**。
    //    反了就等于「先把陌生代码跑起来，再检查它该不该被跑」。
    let bundle: GameBundle
    try {
      bundle = await importBundle(code)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: msg }
    }

    // ★★ **下载来的包不许占用内置游戏的 id。**
    //    否则一个包就能顶掉「农场」——`gameById` 会先命中注册表，
    //    于是家长看到的是「农场」，玩到的却是别人的代码；卸载它又会把
    //    内置游戏一起带下水（`uninstallGame` 会 `clearGameKv` 并回落当前游戏）。
    //    这不是「重名」，这是**劫持**，所以放在这里硬拦。
    if (gameById(bundle.manifest.id)) {
      return {
        ok: false,
        message: `安装包用了内置游戏的 id「${bundle.manifest.id}」，已拒绝`,
      }
    }

    await setGameKv(bundle.manifest.id, BUNDLE_KEY, code)
    await get().refresh()
    return {
      ok: true,
      message: `已安装「${bundle.manifest.name}」v${bundle.manifest.version}`,
    }
  },

  uninstallGame: async (gameId) => {
    // 连包带状态一起删。只删包不删状态的话，重装会**捡到上一次的存档**，
    // 看起来像「卸载没生效」。
    await clearGameKv(gameId)
    // 正在玩的就是它 → 回落，否则底部导航会指向一个已经不存在的游戏
    if (get().activeGameId === gameId) {
      await get().updateSettings({ activeGame: DEFAULT_GAME_ID })
    }
    await get().refresh()
  },

  mountGame: async (gameId, container) => {
    const code = await getGameKv<string>(gameId, BUNDLE_KEY)
    if (typeof code !== 'string') throw new Error(`游戏「${gameId}」没有安装`)
    const bundle = await importBundle(code)
    return mountBundle(container, bundle, pluginHostApi(gameId))
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
      mallLedger,
      gameKv,
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
      db.mallLedger.toArray(),
      db.gameKv.toArray(),
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
        /** 钻石账本。**必须导出** —— 它是「买过哪些游戏」的唯一依据
            （见 `games/registry.ts` 的 `purchasedIdsFrom`），漏掉就等于
            导出/导入一次把买过的游戏全退掉。 */
        mallLedger,
        /**
         * **下载来的游戏**的状态（Dexie v7 的 `gameKv`，spec §12.2 方案 a）。
         *
         * ⚠️ 必须导出。它是那些游戏的**唯一**存档位置 —— 漏掉就等于
         * 「导出再导入一次，所有下载来的游戏进度清零」，而且不报错。
         * 宿主内置的农场不在这里（它用 `meta` / 自己的表），所以漏掉的后果
         * **只在装了下载游戏的设备上**才看得见 —— 更容易漏。
         */
        gameKv,
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
        mallLedger: pickArray<MallEntry>(d.mallLedger) ?? [],
        // ⚠️ 主键是 `key`（形如 `${gameId}:${k}`），**不是 `id`** —— 和背包一样要显式传键名
        gameKv: pickArray<GameKvRow>(d.gameKv, 'key') ?? [],
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
          db.mallLedger,
          db.gameKv,
          db.meta,
        ],
        async () => {
          await Promise.all([
            db.tasks.clear(),
            db.taskInstances.clear(),
            db.ledger.clear(),
            db.harvestLedger.clear(),
            db.mallLedger.clear(),
            db.gameKv.clear(),
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
          if (rows.mallLedger.length > 0) await db.mallLedger.bulkPut(rows.mallLedger)
          if (rows.gameKv.length > 0) await db.gameKv.bulkPut(rows.gameKv)
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
    /* ★ 同时最多留 2 条 —— 原来不封顶，一直往上堆。
       为什么要封：toast 一条高 74px、活 3.4s，而它是 `fixed top-3` 的浮层，
       堆起来会盖住**农场第一排地块**（第一排从 y=195 起）。2026-10-15 实测：

         2 条 → 浮层底边 y=168  ← 不碰地块
         3 条 → 浮层底边 y=250  ← 盖住收获特效，可见率掉到 71%

       而收获特效就画在地块里，被盖住就是「画了看不见」。
       所以上限不是拍脑袋定的，是**按「别碰到地块」量出来的**：
       再加一条就会碰到，`capture-harvest-fx.mjs` 会红。
       丢最老的、留最新的：最新的才是刚发生的事。 */
    set({ toasts: [...get().toasts, { ...t, id }].slice(-2) })
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

/**
 * 今天真正属于「今日任务」的实例行。
 *
 * 排除签到任务：它们有自己的卡片（「坚持签到」区块），
 * 若这里也算进去，同一张任务会在两个区块各渲染一次。
 * 和 `selectPeriodTasks` 同一个理由 —— 两个选择器的排除口径必须一致。
 *
 * 为什么要在这里再挡一次（`makeInstance` 已经不预生成签到任务的实例了）：
 * 一个任务**先**是普通 daily（已有实例）、**后**被家长打开签到模式时，
 * 那些旧实例还在库里。只在生成处挡，这条转轨就漏了。
 */
function todayInstanceRows(s: AppState): TaskInstance[] {
  const checkInIds = new Set(s.tasks.filter(isCheckInTask).map((t) => t.id))
  /* 已隐藏的任务同理：`planMissingInstances` 读的是**含已隐藏**的 allTasks，
     所以隐藏之后实例还会照常生成、旧的也一直躺在库里。
     只在「生成处」挡会漏 —— 必须在这里按**读**过滤，
     否则家长隐藏了一个每日任务，孩子那边的卡片照样在（只是排在最后）。
     和上面签到那条是同一个道理。 */
  const hiddenIds = new Set(s.allTasks.filter((t) => t.archived).map((t) => t.id))
  return s.instances.filter(
    (i) => i.date === s.todayKey && !checkInIds.has(i.taskId) && !hiddenIds.has(i.taskId),
  )
}

/** 今日实例：每日任务 + 今天创建的单次任务 */
export function selectTodayInstances(s: AppState): TaskInstance[] {
  // 排序：① 待完成在前 ② 同一组里按「任务定义」的顺序（家长排的顺序）
  // ③ 最后用实例 id 兜底，保证结果稳定。
  //
  // 第 ② 步以前是按实例的 createdAt 排的，但种子实例是同一毫秒批量
  // 写进去的，createdAt 全一样 → 排序退化成「按随机主键」，于是每次
  // 全新安装看到的任务先后都不一样（实测跑三次三个顺序）。
  const orderOf = new Map(s.tasks.map((t, i) => [t.id, i]))
  return todayInstanceRows(s)
    .filter((i) => i.cycle !== 'weekly' && i.cycle !== 'monthly' && i.cycle !== 'yearly')
    .sort((a, b) => {
      const rank = (i: TaskInstance) => (i.status === 'pending' ? 0 : 1)
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      const oa = orderOf.get(a.taskId) ?? Number.MAX_SAFE_INTEGER
      const ob = orderOf.get(b.taskId) ?? Number.MAX_SAFE_INTEGER
      if (oa !== ob) return oa - ob
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
}

/** 长期任务（周 / 月 / 年） */
/**
 * 长期任务（周 / 月 / 年）。
 *
 * 判据统一放在 `isPeriodTask`（domain/recurrence.ts）—— 连击奖励也用
 * 同一个谓词，两处口径必须一致：界面把它列进「长期任务」，它就该能连击。
 */
export function selectPeriodTasks(s: AppState): Task[] {
  return s.tasks.filter(isPeriodTask)
}

/** 签到任务 */
export function selectCheckInTasks(s: AppState): Task[] {
  return s.tasks.filter(isCheckInTask)
}

/** 今日统计 */
export function selectTodayStats(s: AppState) {
  // 和「今日任务」用同一份行 —— 否则签到任务会算进「今日任务 N 个」，
  // 而列表里根本不显示它，数字对不上。
  const today = todayInstanceRows(s)
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

/**
 * 从实例里挑出「算连击的那些天」。
 *
 * 抽出来是为了让**两个读者共用同一份口径**：
 *   · `selectStreak`（界面显示）读 store 快照；
 *   · `maybePayStreakBonus`（发分）读 DB。
 * 各写一遍过滤条件迟早走散（本项目的老毛病）。这里同时钉住了
 * 「只数长期任务」和「用逻辑日而不是日历日」两条规则。
 */
function streakDaysOf(
  instances: readonly TaskInstance[],
  tasks: readonly Task[],
  dayStartHour: number,
): string[] {
  const periodIds = new Set(tasks.filter(isPeriodTask).map((t) => t.id))
  const dates = new Set<string>()
  for (const i of instances) {
    if (!periodIds.has(i.taskId)) continue
    if (i.earnedPoints && i.earnedPoints > 0 && i.completedAt) {
      // ⚠️ 同 `redeemedToday`：必须用**逻辑日**。`computeStreak` 的第二个参数
      // 是 `s.todayKey`（逻辑日），这里若用日历日 `toDateKey`，凌晨完成的
      // 那次会被记成「明天」——孩子刚做完，连击反而显示 0。
      dates.add(appDayKey(i.completedAt, dayStartHour))
    }
  }
  return [...dates]
}

/**
 * 连续完成天数（连击）—— **只数长期任务**。
 *
 * 2026-10-11 家长定：「长期任务这种次数的可以有连续奖励……不能两种同时都有」。
 * 所以按 `isPeriodTask` 过滤：
 *   · 签到任务 —— 有自己的阶梯奖励，不给连击；
 *   · 今日任务（单次 / 每日）—— 天天都要做，也不给连击。
 * 判据和「长期任务」区块共用同一个谓词 —— 否则会出现「区块里列着它、
 * 连击却不认它」这种两处口径打架。
 */
export function selectStreak(s: AppState): number {
  return computeStreak(streakDaysOf(s.instances, s.tasks, s.settings.dayStartHour), s.todayKey)
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

   ⚠️ **没有 `import.meta.env.DEV` 守卫** —— 生产构建 / APK 里也有，
   装到手机上可以用 `chrome://inspect` 远程调试。
   ⚠️ **加了新命令要同步更新 README 的「调试句柄（浏览器控制台）」那张表**
   —— 2026-09-29 家长回来问「之前那个 await unlock 怎么用来着」，
   就是因为当时只写了代码、没写文档。
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
         * 闸门：这个产出物现在还能卖出多少商城币。
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
        /**
         * 升到某级时**新解锁**的作物名（`domain/catalog.ts` 的 `cropsUnlockedAt` 转出）。
         *
         * 升级播报要断言「界面上写的那串名字 == 领域函数算出来的」——
         * 这是唯一能钉住「UI 接线错、领域函数没错」的办法（同 `priceCeiling`）。
         * 注意它**只证明接线**：函数本身对不对由 `economy.test.ts` E 节钉。
         */
        cropsUnlockedAt: (level: number) => string[]
      }
      /**
       * 测试专用：给当前账号加积分。
       * 只用于本地调试，不参与业务逻辑。
       */
      addPoints: (delta: number) => Promise<void>
      /**
       * 测试专用：一键解锁全部内容。
       * - 开满 12 块地
       * - 背包里塞满所有种子
       * - 农场里放进所有动物
       * - 农场等级提到 10+（解锁全部作物）
       * 只用于本地调试，不参与业务逻辑。
       */
      unlockAll: () => Promise<void>
      /**
       * 测试专用：把 seedTasks.ts 里新增的任务同步进当前账号。
       * 已有任务（按标题匹配）不会重复添加。
       * 只用于本地调试，不参与业务逻辑。
       */
      syncSeedTasks: () => Promise<void>
      /**
       * 测试专用：把**娃娃机**调成「马上能玩」。
       *
       * 一次做完四件事，因为少任何一件都玩不到：
       *   ① 补足钻石 —— 余额是**从账本算出来的**，补币必须走 `mintMall`
       *      （直接改余额会让余额和流水对不上，而且不报错）；
       *   ② 买下它 —— 「拥有」是从 `game_purchase` 那一笔**派生**的，
       *      不买就没有拥有记录；
       *   ③ 切成「当前游戏」—— 买完**不会**自动切（见 `buyGame` 的注释）；
       *   ④ 发币 + 补积分 —— 否则还得先赚积分换币才能投第一次。
       * 已有币 / 已购买时不重复发，可以反复执行。
       * 只用于本地调试，不参与业务逻辑。
       */
      unlockClaw: () => Promise<void>
      /**
       * **插件游戏**（spec §12）。P1 的验收入口。
       *
       * 真实入口是家长栏的「游戏」页；这里是为了让走查脚本能在**不点 UI** 的
       * 情况下驱动整条装配链路（下载 → 校验 → 落盘 → 装配 → 读写状态），
       * 这样「装配坏了」和「UI 没接线」能被分开诊断。
       */
      plugin: {
        /** 宿主 API 版本（脚本要核对包的 `minHostApi` 门真的生效） */
        hostApiVersion: number
        /** 已安装的清单（id → manifest），从 `gameKv` 派生 */
        installed: () => Record<string, GameManifestV2>
        /** ★ 生产路径：从**已签名目录**安装（验签 + 验哈希都在里面，见 `games/install.ts`） */
        installFromCatalog: (
          catalogUrl: string,
          gameId: string,
        ) => Promise<{ ok: boolean; message: string }>
        /** ⚠️ **无校验**的安装路径，只给本地走查用。别拿它当功能入口。 */
        installFromUrl: (url: string) => Promise<{ ok: boolean; message: string }>
        uninstall: (gameId: string) => Promise<void>
        /**
         * 把已安装的游戏挂进 `selector` 命中的容器，返回是否成功。
         * 卸载函数存在句柄上，脚本可以 `plugin.unmountAll()` 收尾。
         */
        mountInto: (gameId: string, selector: string) => Promise<boolean>
        unmountAll: () => void
        /**
         * 读某款游戏在 `gameKv` 里的**全部键**（键已剥掉 `<gameId>:` 前缀，
         * 也就是插件自己看到的那份视图）。走查脚本用它验：
         * 「状态真的写进去了」+「刷新后还在」。
         */
        kv: (gameId: string) => Promise<string[]>
        /**
         * `gameKv` 表里出现过的**全部 gameId**。
         *
         * ★ 这是「命名空间隔离」的判据：正常只该有已安装游戏自己的 id。
         * 出现别的 id = 有东西往别人的命名空间里写了（前缀拼错、或者插件
         * 拿到了不该拿的 gameId）—— 而那**不会报错**，只会静默串味。
         */
        kvOwnerIds: () => Promise<string[]>
      }
      /** 注册表的纯数据快照（见实现处的注释）—— 走查脚本用来推导期望条数 */
      games: () => {
        id: string
        name: string
        status: 'available' | 'comingSoon'
        priceMall: number
        defaultOwned: boolean
      }[]
      /**
       * 娃娃机（见实现处的注释）。
       *
       * ★ 走查脚本靠它「先问第几局会中，再精确走到那一局」——
       * 结果由局数算出来，脚本没法靠多试几次碰运气。
       */
      claw: {
        /** 第 `index` 局的结果；参数不传就用当前设置 */
        resolve: (
          index: number,
          winRate?: number,
          exchangePerPrize?: number,
        ) => { index: number; won: boolean; coupons: number; seed: number }
        /** 从 `from` 起第一局结果为 `won` 的局号；500 局内没有就返回 -1 */
        findRound: (from: number, won: boolean, winRate?: number, exchangePerPrize?: number) => number
      }
    }
  }
}

if (typeof window !== 'undefined') {
  /**
   * 已挂载的插件游戏的卸载函数。**必须留着** —— 不调用它，
   * 插件注册的监听 / 定时器会一直活着（症状是「切走再切回来跑了两遍」）。
   */
  const pluginUnmounts: (() => void)[] = []

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
      cropsUnlockedAt: (level) => cropsUnlockedAt(level).map((c) => c.name),
    },
    addPoints: async (delta) => {
      await postLedger({
        delta,
        source: 'manual_adjust',
        memo: `调试加积分 +${delta}`,
      })
      await useApp.getState().refresh()
    },
    unlockAll: async () => {
      console.log('[kqf-cheat] 开始一键解锁...')
      const now = Date.now()
      const s = useApp.getState()

      // 1. 开满 12 块地
      const allPlots = s.plots.map((p) => ({ ...p, unlocked: true }))
      await savePlots(allPlots)
      console.log('[kqf-cheat] 地块已全开:', allPlots.length)

      // 2. 背包里塞满所有种子（各 99 个）
      for (const crop of CROPS) {
        await addItem(`seed-${crop.id}`, 99)
      }
      console.log('[kqf-cheat] 种子已入库:', CROPS.length, '种')

      // 3. 农场里放进所有动物（跳过已有的）
      const existingIds = new Set(s.animals.map((a) => a.animalId))
      let added = 0
      for (const def of ANIMALS) {
        if (existingIds.has(def.id)) continue
        await db.animals.put({
          id: uid('an'),
          animalId: def.id,
          name: def.name,
          bornAt: now,
          lastFedAt: now,
          lastProduceAt: now,
          pendingProduce: 0,
          feedCount: 0,
          careCount: 0,
        })
        added++
      }
      console.log('[kqf-cheat] 动物已入园:', added, '只')

      // 4. 农场等级提到 10+（解锁全部作物，等级显示拉满）
      //    level 6 需要约 80 次收获，写 500 保险
      await saveFarmTotals({ harvests: 500, planted: 500, sheared: 500 })
      console.log('[kqf-cheat] 农场等级已设为 500 次收获')

      // 5. 刷新内存快照
      await useApp.getState().refresh()
      console.log('[kqf-cheat] 完成！页面即将刷新...')

      // 6. 强制刷新页面，确保所有组件读到最新状态
      window.location.reload()
    },
    syncSeedTasks: async () => {
      /* 现在 boot 时也会自动补（`backfillMissingTasks`），这个句柄留着
         是为了「不刷新页面就能手动触发一次」的调试场景。
         ⚠️ 逻辑必须复用同一个函数 —— 以前这里是抄了一份，
         两处一旦分叉，调试句柄补的东西就会和自动补的不一样。 */
      console.log('[kqf-cheat] 同步种子任务...')
      const added = await backfillMissingTasks(Date.now())
      if (added === 0) {
        console.log('[kqf-cheat] 所有种子任务都已存在，无需添加')
        return
      }
      console.log('[kqf-cheat] 已添加', added, '个新任务')
      window.location.reload()
    },
    unlockClaw: async () => {
      const claw = gameById(GAME_CLAW)
      if (!claw) {
        console.warn('[kqf-cheat] 注册表里没有娃娃机，什么都不做')
        return
      }

      // ① 买下它。**补币放在这一支里面** —— 已经拥有时不该再凭空发一笔钻石
      //    （余额是账本算出来的，白发一笔就多一笔对不上用途的流水）。
      if (!useApp.getState().ownedGameIds.includes(GAME_CLAW)) {
        // ⚠️ 补币走 `mintMall`（写账本），**不是**直接改余额 ——
        //    余额永远是 delta 之和，直接改会「余额对不上流水」且不报错。
        const shortfall = claw.priceMall - useApp.getState().mallBalance
        if (shortfall > 0) {
          console.log('[kqf-cheat] 发放钻石:', shortfall)
          await useApp.getState().mintMall(shortfall, '调试：买娃娃机')
        }
        const r = await useApp.getState().buyGame(GAME_CLAW)
        console.log('[kqf-cheat] 购买娃娃机:', r.message)
      } else {
        console.log('[kqf-cheat] 娃娃机已拥有，跳过购买')
      }

      // ② 切成当前游戏（`buyGame` 故意不自动切）
      await useApp.getState().setActiveGame(GAME_CLAW)

      // ③ 发币 + 补积分。币**不是账本**（`gameKv`），所以走 `addGameCoin`；
      //    积分走 `postLedger`。两者混用会破坏「币不能换回积分」这条约束。
      await postLedger({
        delta: 500,
        source: 'manual_adjust',
        memo: '调试：娃娃机测试积分',
      })
      await addGameCoin(GAME_CLAW, 20, '调试：发 20 个娃娃机币')

      await useApp.getState().refresh()
      const after = useApp.getState()
      console.log(
        '[kqf-cheat] 娃娃机就绪 →',
        '积分', after.balance,
        '· 钻石', after.mallBalance,
        '· 娃娃机币', after.clawCoins,
        '· 当前游戏', after.activeGameId,
      )
      if (after.activeGameId !== GAME_CLAW) {
        console.warn(
          '[kqf-cheat] ⚠️ 当前游戏不是娃娃机 —— 说明拥有关系没落上（账本里没有 game_purchase 那一笔）',
        )
      }
    },
    plugin: {
      hostApiVersion: HOST_API,
      installed: () => useApp.getState().installedGames,
      installFromCatalog: (catalogUrl, gameId) =>
        useApp.getState().installFromCatalog(catalogUrl, gameId),
      installFromUrl: (url) => useApp.getState().installGameFromUrl(url),
      uninstall: (gameId) => useApp.getState().uninstallGame(gameId),
      mountInto: async (gameId, selector) => {
        const el = document.querySelector(selector)
        if (!(el instanceof HTMLElement)) {
          // 找不到容器**必须吭声** —— 静默返回 false 会让脚本报「游戏没渲染」，
          // 而真因是选择器写错了（`scrollIntoView` 那个坑的同款）。
          console.warn('[games] mountInto 找不到容器：', selector)
          return false
        }
        const unmount = await useApp.getState().mountGame(gameId, el)
        pluginUnmounts.push(unmount)
        return true
      },
      unmountAll: () => {
        // `splice(0)` 一次取走并清空：不这样写，二次调用会把同一批卸载函数
        // 再跑一遍（每个游戏卸载两次）。
        for (const u of pluginUnmounts.splice(0)) u()
      },
      // 返回**键名**而不是整份值：值里最大的一项是包代码本身，
      // 打进日志只会淹掉真正要看的东西。
      kv: async (gameId) => Object.keys(await listGameKv(gameId)),
      kvOwnerIds: () => listGameKvOwnerIds(),
    },
    /**
     * 注册表的**纯数据快照**（2026-10-16 加）。
     *
     * ★ 为什么需要它：走查脚本以前**写死**「占位游戏有 2 条」「一个购买按钮都没有」。
     * 娃娃机一上线，这三条当场就红了 —— 而它们红的原因是**例子过期**，
     * 不是功能坏了。写死条数就会这样：上线一款游戏，就要去修一遍无关的脚本。
     * ➜ 脚本从这里读现状，再推导出「应该有」多少条，而不是写死一个数。
     */
    games: () =>
      GAMES.map((g) => ({
        id: g.id,
        name: g.name,
        status: g.status,
        priceMall: g.priceMall,
        defaultOwned: g.defaultOwned,
      })),
    /**
     * 娃娃机的调试句柄（2026-10-16）。
     *
     * ★ 为什么需要它：走查脚本要验「中一局会发商城币」，而**结果是由局数算出来的**
     * （幂等伪随机，见 `domain/clawEconomy.ts`）。脚本没法「多试几次直到中」——
     * 那既慢又不确定。所以这里把**结算时用的同一个函数**暴露出来，
     * 让脚本能先问「第几局会中」，再精确地走到那一局。
     *
     * ⚠️ 走的是 `clawResolveRound` + `clampClawEconomy` 的**原函数**，
     * 不是照抄一份公式 —— 抄一份的话，改了公式脚本还会全绿。
     */
    claw: {
      /** 第 `index` 局的结果（`winRate` / `exchangePerPrize` 不传就用当前设置） */
      resolve: (index: number, winRate?: number, exchangePerPrize?: number) => {
        const s = useApp.getState().settings
        return clawResolveRound(
          index,
          clampClawEconomy({
            winRate: winRate ?? s.clawWinRate ?? CLAW_DEFAULT_WIN_RATE,
            exchangePerPrize: exchangePerPrize ?? s.clawExchangePerPrize ?? CLAW_DEFAULT_EXCHANGE,
          }),
        )
      },
      /** 从 `from` 起第一局 `won` 为 `won` 的局号；找不到返回 -1 */
      findRound: (from: number, won: boolean, winRate?: number, exchangePerPrize?: number) => {
        const s = useApp.getState().settings
        const econ = clampClawEconomy({
          winRate: winRate ?? s.clawWinRate ?? CLAW_DEFAULT_WIN_RATE,
          exchangePerPrize: exchangePerPrize ?? s.clawExchangePerPrize ?? CLAW_DEFAULT_EXCHANGE,
        })
        for (let i = from; i < from + 500; i++) {
          if (clawResolveRound(i, econ).won === won) return i
        }
        return -1
      },
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

/**
 * 连击奖励发放（内部）—— **只由长期任务的结算调用**
 * （见 settleInstance 里那个 `isPeriodTask` 判断）。
 *
 * 一天只发一次，判据在账本里（见函数内注释）——
 * 同一个逻辑日里完成第二个长期任务不会再多发一笔：
 * 连击是「天」的奖励，不是「次」的奖励。
 *
 * ⚠️ 2026-10-11 起「每天加几分 / 封顶」可以**按任务设**（家长要
 * 「每个长期任务单独设」），所以这里要拿到**触发它的那条任务**。
 * 于是出现一个必须说清的后果：
 *
 *   **一天里第一条完成的长期任务，按它自己的设置发；同一天后面完成的
 *   那几条不再发钱，它们自己的设置当天用不上。**
 *
 * 这是「一天只发一次」和「按任务设」叠在一起的结果，**没有改发放频率**
 * —— 改频率是动经济（三条长期任务各发一次 = 每天最多三倍），
 * 家长没要求，不做。任务编辑页把这句话原样写给家长看。
 */
async function maybePayStreakBonus(task: Pick<Task, 'streakPerDay' | 'streakCap'>): Promise<number> {
  const s = useApp.getState()
  const today = s.todayKey

  /* 一天只发一次 —— 判据放在**账本**里，而且用 `refId` 显式记下「这是哪一天的连击」。
     两个坑：
     ① 以前这里是个模块级的 `lastStreakPaidDay`，一重启就没了 ——
        孩子做完一个长期任务 → 杀掉 App 再打开 → 再做一个，连击就发两遍。
     ② 别拿 `createdAt` 反推逻辑日：`ledgerTip()` 会把时间戳抬到「比上一条大」，
        所以它可能**比真实时间晚**（建库时的初始账本用的是真实时间，
        之后所有条目都被顶到那之后）。`refId` 是显式写进去的，不受这个影响。
     （`refId` 上有索引，只读这一条。） */
  const alreadyPaidToday =
    (await db.ledger.where('refId').equals(`streak:${today}`).count()) > 0
  if (alreadyPaidToday) return 0

  /* ⚠️ 连击天数必须读 **DB**，不能读 store 快照。
     调用点（settleNow）刚把「今天完成」写进 DB，而 store 要等这一轮结算
     结束才 refresh —— 拿快照算出来的连击**永远少一天**：连到第 2 天时
     算出 1（于是不发），到第 3 天才发第 2 天的量，memo 也跟着写错。
     2026-10-11 写「连击只发长期任务」的测试时，这个 off-by-one 才暴露出来
     —— 在此之前它一直是错的，而且没有任何测试会红。 */
  const rows = await db.taskInstances.toArray()
  const streak = computeStreak(streakDaysOf(rows, s.tasks, s.settings.dayStartHour), today)
  /* ⚠️ 判据收在 `streakPaysOn` 里，**别在这里写 `streak <= 1`** ——
     界面那个「🔥 连续 N 天」徽章用的是同一个函数（第 1 天不显示）。
     两处各写一遍迟早走散：徽章挂出来了、分却没发。 */
  if (!streakPaysOn(streak)) return 0
  /* ⚠️ 夹取必须在**这里**做，不能只靠设置页 / 任务编辑的输入框 ——
     导入的旧备份、手改的 IndexedDB、测试里直接 updateSettings 都能绕过输入框，
     而这两个值会变成账本里真实的分。
     取值（任务自己的，或者内置默认）收在 `streakPerDayFor` / `streakCapFor` 里，
     别在这里再写一遍 `??` —— 编辑器预览也要用同一套优先级。 */
  const perDay = streakPerDayFor(task)
  const cap = streakCapFor(task)
  const bonus = Math.min(cap, streak * perDay)
  if (bonus <= 0) return 0
  await postLedger({
    delta: bonus,
    source: 'streak_bonus',
    // ⚠️ 这个 refId 就是「今天发过了」的判据，见上面的注释，别改格式。
    refId: `streak:${today}`,
    memo: `连续 ${streak} 天完成长期任务 🔥`,
  })
  return bonus
}
