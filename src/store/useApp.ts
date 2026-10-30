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
  WishCode,
  WishOffer,
  WishOrder,
  WishShipInfo,
  WishShipSnapshot,
} from '../domain/types'
import {
  addItem,
  ASSET_BASE_KEY,
  BUNDLE_KEY,
  clearGameKv,
  consumeItem,
  currentBalance,
  currentHarvestBalance,
  currentMallBalance,
  db,
  detachGameKv,
  DEFAULT_SETTINGS,
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
  loadWishOffers,
  loadWishOrders,
  ledgerTip,
  loadSettings,
  logFarmEvents,
  harvestTip,
  gameCoinBalanceOf,
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
  spendMall,
  wipeAll,
  type GameKvRow,
} from '../db/db'
import { DEFAULT_GAME_ID } from '../games/ids'
import { GAMES, gameById, ownedByDefault, purchasedIdsFrom } from '../games/registry'
import { wishItemById } from '../games/wishCatalog'
import { redeemWishCode } from '../api/wish'
import { getToken } from '../api/session'
import { ApiError } from '../api/client'
import type { ApiWishCodeResult } from '../api/types'
import { pickBlindBox, planWishRedeem, redeemedGameIdsFrom, wishOwnedSet } from '../domain/wish'
import { makeHostApi } from '../games/hostApi'
import { importBundle, mountBundle } from '../games/loader'
import { catalogPublicKeyRaw } from '../games/catalogKey'
import { fetchVerifiedGame, type ResolvedGame } from '../games/install'
import { localGameById } from '../games/localGames'
import { codeHashOf, gameIdForCode } from '../games/codeLookup'
import { isGameCode, normalizeGameCode } from '../domain/gameCode'
import type { Bytes } from '../games/bytes'
import { assertSha256, type CatalogGame } from '../games/verify'
import { checkPluginEconomy } from '../domain/pluginEconomy'
import { HOST_API } from '../games/plugin'
import type { GameBundle, GameManifestV2, HostApi, MountContext } from '../games/plugin'
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
   * 兑换券流水。与 `ledger` 分开放 —— 见 `HarvestEntry` 的两条不可逆约束。
   * 界面上「积分」页只看 `ledger`，「兑换券」页只看 `harvestLedger`，两边不串。
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
  /**
   * 心愿商城：**家长已经定价开放**的商品。
   *
   * 商品目录本身是常量（`games/wishCatalog.ts`），这里只有「这一家开不开放、
   * 卖多少券」。没有对应行的商品 = 未开放 = 孩子只能表明意向。
   */
  wishOffers: WishOffer[]
  /** 心愿单 / 兑换单。一条记录从 `wished` 走到 `done` */
  wishOrders: WishOrder[]
  /** 农场最近发生的事件（给孩子看的「农场日志」） */
  farmEvents: FarmEvent[]
  /** 市场行情 */
  market: MarketState
  /** 积分余额 —— **农场投入只认它**（`plant` / 买幼崽 / 开地块） */
  balance: number
  /** 兑换券余额 —— 只能花在兑换商城的丰收档，**不能回流农场、不能换积分** */
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
   * ★ **本地包**：随 App 一起发布、不联网就能装（`src/games/localGames.ts`）。
   *
   * 校验方式和远程**不同、但一样硬**：远程靠 Ed25519 目录签名，
   * 本地靠**烧进代码里的 SHA-256**（`localGames.ts` 由
   * `scripts/make-local-catalog.mjs` 生成）。两者都是「先验哈希、再执行」。
   *
   * ⚠️ 不要因为「本地」就跳过校验：`public/` 里的文件在打包后仍然可以被替换，
   * 跳过校验等于给「换掉 public 里的 js」开了一条执行任意代码的后门。
   */
  installLocalGame: (gameId: string) => Promise<{ ok: boolean; message: string }>
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
   *
   * ★ 这是**待删除**的（spec §12.4 末）：界面上没有入口，但 `__kqf__` 没有
   * DEV 守卫 ⇒ 它确实在 APK 里。删之前得先把那个走查脚本迁到目录路径 ——
   * 它有 5 个 `data:` 合成包，每个都要有自己的目录条目和签名。
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
   * @returns 本次到手的兑换券（`'store'` 时为 0）
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
   * 卖出 n 个能拿多少兑换券。
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

  /* ---- 心愿商城（2026-10-28） ---- */
  /**
   * 孩子「想要这个」。
   *
   * **不扣任何东西**，只是让家长在那边看到一个待定价的心愿。
   * 已经有同一件商品的活跃单子时**不重复建单** —— 孩子连点两下不该出现两行。
   */
  wishExpress: (itemId: string) => Promise<void>
  /**
   * 孩子「确定兑换」：**扣兑换券** + 建单（`committed`）。
   *
   * 盲盒在这一步开奖（`pickBlindBox`），游戏盒子在下一步装包。
   * 返回 `gameId` 让界面能弹开箱结果。
   *
   * ⚠️ 扣券和建单必须在**同一个事务**里：只扣券不建单，孩子的东西就凭空没了。
   */
  wishRedeem: (itemId: string) => Promise<{ ok: boolean; message: string; gameId?: string }>
  /**
   * 家长给商品定价（`voucherPrice > 0`）或关闭（`<= 0`）。
   *
   * 关闭是写 `closedAt` 而不是删行 —— 孩子之前换过的历史还要能解释。
   */
  wishSetOffer: (itemId: string, voucherPrice: number) => Promise<void>
  /** 家长确认：已经去外链买了（`committed` → `confirmed`） */
  wishConfirm: (orderId: string) => Promise<void>
  /** 家长标记完成，可顺手存收货信息和成交单号（`confirmed` → `done`） */
  wishDone: (
    orderId: string,
    patch?: { ship?: WishShipInfo; buyOrderNo?: string },
  ) => Promise<void>
  /**
   * 取消 / 撤回。
   *
   * * `wished` → 直接撤，**不碰账本**（还没扣过）
   * * `committed` / `confirmed` → **退钱**：券和积分各退各的
   *   （`vouchersHeld` / `pointsHeld`，各写一笔 `wish_refund`）
   *
   * ⚠️ 退券前必须在**事务内**重读状态。靠按钮 disabled 挡不住两个标签页同时点，
   * 那样会退两次 —— 而账本只看 delta 之和，多退一次不会报错。
   */
  wishCancel: (orderId: string, reason?: string) => Promise<void>

  /**
   * 跨页通道：心愿页说「去兑换换」时，把「哪一件」带到兑换那一格。
   *
   * 2026-10-29 家长口径：「兑换 里的东西都是一样，都能用兑换券或者积分，
   * 包括游戏也一样。**不需要去心愿商城换**。心愿商城只是标明心愿的。」
   *
   * 所以扣币只剩兑换那一处，心愿页的详情只负责「看 + 许愿」。孩子在那儿
   * 点「去兑换换」时，得让他**落到那一行**，而不是自己在一长串商品里翻。
   *
   * ⚠️ 底部 tab 的状态在 `App.tsx` 里（`useState`），组件之间拿不到 setter。
   *    跨页传数据只能走 store（同 `pendingPrompt` 那套）。**取走要清空** ——
   *    不清的话，孩子切走再切回兑换，会被反复滚到同一行。
   */
  pendingRedeemItem: string | null
  /** 设通道并切到兑换 tab（`App` 那边监听） */
  jumpToRedeem: (itemId: string) => void
  /** 取走并清空。返回 null 表示没有待跳转 */
  takePendingRedeemItem: () => string | null

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
   * **兑换码解锁一款游戏**（2026-10-28，spec §6 的 P2）。
   *
   * ```
   *   付款 → 拿到卡片上的 6 位码 → 在这里输进去 → 那款游戏变成「已拥有」并装好
   * ```
   *
   * ## 三件事必须一起成立，少一件就是「静默成功」
   *
   *   ① `wishCodes` 里记一笔（防同一个码在本机用第二次）；
   *   ② `mallLedger` 里记一笔 `source: 'redemption_code'`、**delta 0**
   *      —— `ownedGameIds` 是从账本推导的，不写这一笔界面上就**不显示已拥有**，
   *      而兑换流程照样返回成功（spec §6 点名的坑）；
   *   ③ 插件游戏还要真的装包。
   *
   * ## 什么时候**不**烧码
   *
   * 码是一次性资源，浪费一张就少卖一张。所以这几种情况都提前返回、不写库：
   * 格式不对 / 表里没有 / 本机用过 / 已经有了 / 这个版本没有这款游戏。
   *
   * ## 装包失败要退码
   *
   * 事务提交之后才装包（装包是网络 + 执行，不能塞进 Dexie 事务）。装失败就把
   * 刚写的那两行删掉 —— 否则孩子拿到一句「装包失败」而码已经没了，只能找客服。
   */
  redeemGameCode: (code: string) => Promise<{ ok: boolean; message: string; gameId?: string }>

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
  /** 一次性：换过就从「能换什么」里消失（见 `RedeemItem.once`） */
  once?: boolean
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
  'wishOffers',
  'wishOrders',
  'wishCodes',
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
  'wishOrders',
])

/**
 * 备份格式的版本号。**只在这里写一次** —— 导出和「空模板」都读它。
 * 写在两处就会走散：模板停在 1、真实导出早就是 4（2026-10-30 之前就是这样）。
 */
const BACKUP_VERSION = 4

/**
 * 「下载一个空模板看看」那个按钮的内容。
 *
 * 它要回答的问题是「备份长什么样」，所以**必须把结构摊开**：一张表一个键，
 * 值都是空数组。原来的写法是 `data: {}` —— 家长打开只看到一个空对象，
 * 什么也没回答。
 *
 * ⚠️ 键名从 `BACKUP_ARRAY_FIELDS` 派生，**不手写**。手写一份就会在加表时走散。
 * ⚠️ 值一律留空数组，让 `validateBackup` 里那条「至少要有一样实际内容，
 *    避免导入一个空壳把数据清空」把它挡住 —— 空模板必须是**导不进去**的，
 *    否则家长（或孩子）拿它点一次恢复，真实数据就被示例顶掉了。
 */
export function makeBackupSample(): unknown {
  return {
    app: 'kid-quest-farm',
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    说明: '这是一份空模板，只展示备份的结构，不含任何真实数据。导入它会被拒绝（没有可恢复的内容）。',
    data: Object.fromEntries(BACKUP_ARRAY_FIELDS.map((k) => [k, []])),
  }
}

/**
 * 备份里的收货信息：**只留省市区 + 手机尾号**（`docs/wish-mall-spec.md` §9.1）。
 *
 * `wishOrders` 现在会进备份，而 `ship` 里是收货人姓名 + 手机号 + 家庭详细地址
 * —— 绑在**儿童**账号上。整表原样导出等于「备份文件里躺着一份小孩住址」，
 * 而这个文件通常被丢进微信 / 网盘里传来传去。所以导出前必须裁。
 */
/**
 * 备份里**不许出现「这台设备的东西」**。
 *
 * 两个字段，两类理由：
 *
 *   · `parentPin` —— **凭据**。它是明文 4 位（`ParentGate` 直接
 *     `pin === settings.parentPin` 比字符串），而 `settings` 是整份导出的
 *     ⇒ 每导一次备份，家长锁的密码就跟着那个 JSON 离开这台设备。
 *     备份文件正是会被发到微信 / 网盘 / 客服的东西。
 *   · `gameClock` —— **这台设备今天的用量**（「今天已经玩了多久」，
 *     `GamePlayGate` 拿它和 `gameDailyMinutes` 比）。跟着文件走有两个方向的问题：
 *     孩子玩满 30 分钟之后导入一份玩之前的备份 ⇒ 额度被刷回去；
 *     换台设备恢复 ⇒ 把「昨天那台设备今天玩了多少」带过来。
 *
 * 导出剥掉，导入端也**不认**文件里的值（见 `importBackup`）—— 两边都不认，
 * 才算真的「仅本地」。
 */
function stripDeviceLocal(s: AppSettings): AppSettings {
  const out = { ...s }
  delete out.parentPin
  delete out.gameClock
  return out
}

/**
 * 这一行 `gameKv` 是不是**宿主保留键**（游戏本体 / 资源根）。
 *
 * 键形如 `${gameId}:${shortKey}`，见 `db.ts` 的 `gameKvKey()`。
 */
function isHostOnlyGameKvKey(key: string): boolean {
  return key.endsWith(`:${BUNDLE_KEY}`) || key.endsWith(`:${ASSET_BASE_KEY}`)
}

/**
 * 备份里**不带游戏本体，只带存档**。
 *
 * 原来 `__bundle`（整段游戏代码，`anthill` 一款就 **4.2 MB**）是原样进备份的。
 * 两个问题，第二个严重：
 *
 * 1. **体积**：装一款 4 MB，装五款 20 MB，而其中 99% 的字节是「这台设备上
 *    本来就有的游戏代码」。备份是要发给微信 / 网盘的。
 * 2. **它是一段会被执行的代码**。`mountGame()` 读 `__bundle` → `importBundle()`
 *    → `Blob` → `import()`，中间**没有哈希、没有签名**（`loader.ts` 头注释写着
 *    「必须发生在调用本函数之前：先验签，再执行」）。下载层是有签名的，
 *    备份这条路把那道门整个绕过去了。
 *
 *    实测（2026-10-30）：把一份真备份里的 `__bundle` 换成自己的模块，
 *    `importBackup` 照样报「数据已恢复」，挂载时那段代码就在页面里跑起来，
 *    能读孩子的积分流水。而备份文件正是家长之间会互相传的东西
 *    （「这是我配好的任务，你导入吧」）。
 *
 * 所以：导出剥掉，导入端也**不认**文件里的这两行（两边都不认才算关死）。
 * 恢复后按 `meta.installedGameIds` 从**本地包**重装 —— 那条路会比对
 * 烧进 App 的 sha256。存档不受影响（存档是 `<gameId>:` 开头的其他行）。
 */
function saveOnlyGameKv(rows: GameKvRow[]): GameKvRow[] {
  return rows.filter((r) => !isHostOnlyGameKvKey(r.key))
}

function shipSnapshotOf(ship: WishShipInfo | undefined): WishShipSnapshot | undefined {
  if (!ship) return undefined
  const digits = typeof ship.phone === 'string' ? ship.phone.replace(/[^0-9]/g, '') : ''
  return {
    region: typeof ship.region === 'string' ? ship.region : '',
    phoneTail: digits.slice(-4),
  }
}

/**
 * 导出用：把一条订单裁成「可以进备份」的样子。
 *
 * `ship` 整段丢掉，只换成 `shipSnapshot`。**不要图省事写 `{...o, ship: undefined}`**
 * —— `JSON.stringify` 会连 `ship: undefined` 一起省掉，看着没事，但只要有人
 * 把 `undefined` 改成 `{}` 或者忘了这段，住址就跟着出去了，而且没有任何报错。
 */
function orderToBackup(o: WishOrder): WishOrder {
  const { ship, ...rest } = o
  const snapshot = shipSnapshotOf(ship)
  return snapshot ? { ...rest, shipSnapshot: snapshot } : rest
}

/**
 * 导入用：**再裁一次**。
 *
 * 备份文件是用户手里可以随便改的，老版本 App 导出的文件里也可能真的带着
 * `ship`（那时还没这条规矩）。把外部输入当可信 = 迟早有一份带地址的备份
 * 被恢复进库里，然后跟着下一次导出再传播出去。
 */
function orderFromBackup(o: WishOrder): WishOrder {
  const { ship, ...rest } = o
  if (!ship) return rest
  const snapshot = shipSnapshotOf(ship)
  return snapshot ? { ...rest, shipSnapshot: snapshot } : rest
}

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
 * 这个孩子**现在真的拥有**哪些游戏 —— **直接读库**。
 *
 * ## 为什么读库，不读 `get().ownedGameIds`
 *
 * 兑换/购买都是「先写账本 → 再装包」。中间那一刻 store 还没 `refresh()`，
 * 读快照就会把刚兑换到的判成「没拥有」—— 兑换流程自己把自己卡住。
 * 这类**顺序依赖不会报错**，只会让人以为「码是坏的」。
 *
 * ## 为什么用 `wishOwnedSet` 而不是 `ownedGameIds`
 *
 * 「拥有」有**三个来源**，`ownedGameIds` 只覆盖第一个：
 *   ① 账本（`game_purchase` / `redemption_code`）；
 *   ② 已装的包（`installedBundles`）—— 卸载再重装时靠它；
 *   ③ 心愿单的 `openedGameId`（`redeemedGameIdsFrom`）。
 * 只判账本，会把「心愿商城换来的」和「卸了想重装的」一起锁死 ——
 * 而这两个恰恰是正常用户最常走的路径。
 */
async function ownedGameSetNow(): Promise<Set<string>> {
  const [ledger, orders, bundles] = await Promise.all([
    db.mallLedger.toArray(),
    db.wishOrders.toArray(),
    listInstalledBundles(),
  ])
  const installed: Record<string, true> = {}
  for (const b of bundles) installed[b.gameId] = true
  return wishOwnedSet(ownedGameIdsFrom(ledger), installed, orders)
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
    /*
     * 兑换率**从已安装的 manifest 现读**（不是快照）。
     * 插件升级后汇率会变，快照就会变成「插件按新汇率算、宿主按旧汇率发」。
     * 没装 / 没写 = 0 = 不开放兑换。
     */
    voucherPerCoin: () => useApp.getState().installedGames[gameId]?.economy.voucherPerCoin ?? 0,
  })(gameId)
}

/**
 * 拼资源地址。**插件唯一该用的拼法**（`ctx.assetUrl`）。
 *
 * 三条规则，每条都有对应的翻车形态：
 *   ① `assetBase` 空 ⇒ 原样返回相对路径。空串 ≠ 安全，只是「没配」，
 *      所以这里**不补前导 `/`** —— 补了会变成站点根，可能反而错。
 *   ② 去掉 `rel` 的前导 `./`。包里的代码常写 `./assets/x.webp`
 *      （相对包文件），拼起来会变成 `/games/x/./assets/x.webp` ——
 *      浏览器能解析，但缓存键和日志里会多一段，排查时容易看错。
 *   ③ **不做 URL 解码 / 编码**。文件名里有中文时，`fetch` 自己会编码；
 *      这里编一遍会变成双重编码（`%25E4…`），404 且报错像文件不存在。
 */
function assetUrlFor(assetBase: string, rel: string): string {
  const clean = String(rel).replace(/^\.\//, '').replace(/^\/+/, '')
  if (!assetBase) return clean
  return assetBase.endsWith('/') ? assetBase + clean : assetBase + '/' + clean
}

/**
 * 目录条目 → 资源根。
 *
 * 缺省是「包所在目录」——这是最常见的发布形态（包和 assets 同级）。
 * 单独写 `assetBase` 的场景是「包在 Release、贴图在 CDN」。
 */
function assetBaseOf(g: CatalogGame): string {
  if (g.assetBase) return g.assetBase
  try {
    return new URL('./', g.url).toString()
  } catch {
    // `url` 已经在 `parseCatalog` 里过了 https 白名单，理论上到不了这里。
    // 真到了也**不能抛** —— 抛在这里会变成「装不了，但没有原因」。
    return ''
  }
}

/**
 * 把「已验过哈希的代码」真正落库 —— **本地包和远程包共用这一段**。
 *
 * 两条安装路径只在「怎么拿到可信代码」上不同：
 *
 * ```
 *   本地：/games/<id>/x.mjs ──► 比对烧进代码的 sha256 ──┐
 *   远程：catalog+sig ──► 取包 ──► 比对目录里的 sha256 ──┴─► 这里
 * ```
 *
 * 所以「拦内置 id / 校验经济 / 写 __bundle 和 __assets」只写一份。
 * 抄两份的后果是必然的：总有一天只改了其中一条，而另一条静默放行。
 *
 * ⚠️ 顺序：**先校验、再写库**。写进去就等于「这个包已被信任」。
 */
async function commitPluginBundle(
  bundle: GameBundle,
  code: string,
  assetBase: string,
  /**
   * 显示用的名字 / 版本。**远程包必须传目录里的**（目录才是已验签的显示来源），
   * 本地包传清单里的。不传就用包自己说的 —— 那是最后手段，不是默认。
   */
  shown?: { name: string; version: string },
): Promise<{ ok: boolean; message: string }> {
  const id = bundle.manifest.id

  // ① 不许占用内置游戏的 id（否则 = 劫持，理由见 installGameFromUrl 的注释）
  if (gameById(id)) {
    return { ok: false, message: `安装包用了内置游戏的 id「${id}」，已拒绝` }
  }

  // ② 经济闸门：一局期望产出不能接近成本，兑换券也不能刷
  const issue = checkPluginEconomy(bundle.manifest.economy)
  if (issue) {
    return { ok: false, message: `经济参数不合法（${issue.code}）：${issue.message}` }
  }

  await setGameKv(id, BUNDLE_KEY, code)
  /*
   * 资源根**必须**记下来。空串也记 —— 「没配资源」是一个事实，
   * 不记的话挂载时只能猜，而猜错的症状是「场景全是白模」（404 纹理）。
   */
  await setGameKv(id, ASSET_BASE_KEY, assetBase)
  await useApp.getState().refresh()

  const name = shown?.name ?? bundle.manifest.name
  const version = shown?.version ?? bundle.manifest.version
  return { ok: true, message: `已安装「${name}」v${version}` }
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
    wishOffers,
    wishOrders,
    farmEvents,
    quotaCarry,
  ] = await Promise.all([
    db.taskInstances.orderBy('date').reverse().toArray(),
    // 全量加载流水。这里曾经 limit(500)，导致孩子用久了以后
    // 早期的记录从「积分」页凭空消失，而导出却还在 —— 对不上账。
    // 单机场景下流水量级很小（一年也就几千条），全量读没有压力。
    db.ledger.orderBy('createdAt').reverse().toArray(),
    // 兑换券流水同理，全量读。
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
    loadWishOffers(),
    loadWishOrders(),
    loadFarmEvents(40),
    loadQuotaCarry(),
  ])

  // 拥有关系从账本派生；「当前游戏」再按拥有关系解析一遍 ——
  // 顺序不能反，否则会拿旧账本去判「买了没」。
  const ownedGameIds = ownedGameIdsFrom(mallLedger)
  // 已安装的插件游戏：**从 `gameKv` 派生**（扫 `__bundle` 行），不另存清单。
  const installedGames = await loadInstalledGames()

  /*
   * ★ 一次性商品换过之后，**从孩子端列表里消失**（2026-10-29 家长要求）。
   *
   * 放在这里而不是组件里：`redeemItems` 的定义就是「孩子现在能换的东西」，
   * 而「换过的一次性商品」不再属于这个集合。摆在组件里的话，将来第二个
   * 读 `redeemItems` 的地方（比如首页的推荐位）就得自己再记得滤一遍 ——
   * 漏了不报错，只是那件东西又冒出来了。
   *
   * ⚠️ `allRedeemItems` 不受影响：管理页要看得见它，否则家长会以为被删了。
   */
  const redeemedIds = new Set(redeemRecords.map((r) => r.itemId))
  const visibleRedeemItems = redeemItems.filter((it) => !(it.once && redeemedIds.has(it.id)))

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
    redeemItems: visibleRedeemItems,
    allRedeemItems,
    redeemRecords,
    wishOffers,
    wishOrders,
    farmEvents,
    market,
    balance,
    harvestBalance,
    mallBalance,
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
  wishOffers: [],
  wishOrders: [],
  pendingRedeemItem: null,
  farmEvents: [],
  market: createInitialMarket(PRODUCE_BASE_PRICE),
  balance: 0,
  harvestBalance: 0,
  mallBalance: 0,
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
            ? `当场卖掉，+${earned} 兑换券`
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
      // 卖产出结的是**兑换券**，不是积分 —— 别写回「换积分」。
      detail: roll.event?.message ?? '去市场卖掉就能换兑换券啦',
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

    // 市场是农场产出的唯一出口，结的是**兑换券**，不是积分。
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
        title: `卖出 ${sellCount} ${produceUnitOf(itemId)}${name}，+${total} 兑换券`,
        detail:
          sellCount < want
            ? `这一轮只剩 ${Math.round(remaining)} 兑换券的额度了，先卖了 ${sellCount} ${produceUnitOf(itemId)}`
            : dropPct < -1
              ? `卖得多了，价格跌到 ${newPrice} 兑换券（${dropPct}%）`
              : `当前单价 ${current} 兑换券`,
        emoji: '🎫',
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
   * 「优先用兑换券兑换。价值和积分等价的。用完兑换券再用积分，可混合。」
   *
   * 于是这里最多要动**三张表**：`harvestLedger`（兑换券那笔）、
   * `ledger`（积分那笔）、`redeemRecords`（记录）。三张必须同一个事务 ——
   * 只扣了兑换券却没写记录，孩子的东西就凭空没了。
   *
   * ⚠️ **分账要在事务内用实时余额重算一遍**，不能用外面那份。
   * 外面那份只是给 UI 看的预览；两个标签页同时点「换」时，
   * 用旧余额算出的分账会把已经花掉的兑换券又花一次。
   */
  redeem: async (itemId) => {
    const { balance, harvestBalance, settings, allRedeemItems } = get()
    if (!settings.redeemEnabled) {
      get().pushToast({ kind: 'info', title: '兑换还没开放哦', emoji: '🔒' })
      return false
    }

    // ⚠️ 查 `allRedeemItems` 而不是 `redeemItems`：后者已经把
    // 「已下架」和「换过的一次性商品」滤掉了，查它会**在两道守卫之前**
    // 就返回 `false` —— 结果一样（换不了），但孩子看不到任何提示。
    const item = allRedeemItems.find((i) => i.id === itemId)
    if (!item || item.archived) return false

    const preview = planRedeemPayment(item.cost, harvestBalance, balance)
    if (!preview.affordable) {
      get().pushToast({
        kind: 'warn',
        title: '还差一点点',
        detail: `兑换券和积分加起来还差 ${preview.shortfall}，加油攒一攒`,
        emoji: '🎫',
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

    /*
     * 一次性：换过就永远不再出现（2026-10-29）。
     *
     * ⚠️ 界面那边已经把它从「能换什么」里滤掉了，这里还留一道**是为了
     *    挡住「打开着旧页面」**：孩子停在商城页、家长在另一处换掉了，
     *    再点一下就会换第二次 —— 而界面此时还画着那个按钮。
     *
     * 判据是**兑换记录**，不是库存也不是 `limitPerDay`：
     * 那个每天重置，这个永不重置。
     */
    if (item.once) {
      const ever = get().redeemRecords.some((r) => r.itemId === itemId)
      if (ever) {
        get().pushToast({
          kind: 'warn',
          title: `「${item.name}」只能换一次`,
          detail: '这个已经换过啦',
          emoji: '☝️',
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

      // 兑换券那笔。`harvest_redeem` 这个 source 从 09-15 定义起就一直空着，
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
        title: '兑换券和积分不够啦',
        detail: '再攒一攒吧',
        emoji: '🎫',
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

  /* ================= 心愿商城 ================= */

  /**
   * 孩子「想要这个」。
   *
   * 不扣任何东西。已经有活跃单子时**直接返回** —— 孩子连点两下不该出现两行，
   * 而且「想要」这件事重复表达一次也没有意义。
   */
  wishExpress: async (itemId) => {
    const item = wishItemById(itemId)
    if (!item) return

    const active = get().wishOrders.find(
      (o) =>
        o.itemId === itemId &&
        (o.status === 'wished' || o.status === 'committed' || o.status === 'confirmed'),
    )
    if (active) return

    const offer = get().wishOffers.find((o) => o.itemId === itemId && !o.closedAt)
    await db.wishOrders.put({
      id: uid('wo'),
      itemId,
      itemName: item.name,
      itemEmoji: item.emoji,
      kind: item.kind,
      partnerName: item.partnerName,
      voucherPrice: offer?.voucherPrice ?? 0,
      status: 'wished',
      vouchersHeld: 0,
      createdAt: Date.now(),
    })

    get().pushToast({
      kind: 'info',
      title: `已经告诉爸妈：想要「${item.name}」`,
      detail: '他们看到之后会给它定一个兑换券的价格',
      emoji: '💌',
    })
    await get().refresh()
  },

  /**
   * 孩子「确定兑换」。
   *
   * ## 顺序是有讲究的
   *
   * 1. **先算能不能开**（盲盒池子空了就到此为止，不能先扣券）
   * 2. **再在一个事务里扣钱 + 建单**（只扣钱不建单 = 孩子的东西凭空没了）。
   *    2026-10-29 起「扣钱」是两笔：兑换券（`wish_redeem`）+ 积分，
   *    分账规则见 `planWishRedeem`。
   * 3. **最后装包**（网络 IO 不能放进事务）。装失败就退券 —— 见下。
   *
   * ## 为什么装包失败要退券
   *
   * 游戏类商品的「交付」就是装包。装不上等于没给东西，券留着没有任何理由。
   * 退券走 `wishCancel`，和「家长取消」是同一条路 —— 两处各写一遍退款逻辑，
   * 迟早有一处漏了 `status` 判断，然后就会退两次。
   */
  wishRedeem: async (itemId) => {
    const item = wishItemById(itemId)
    if (!item) return { ok: false, message: '没有这件商品' }

    const offer = get().wishOffers.find((o) => o.itemId === itemId && !o.closedAt)
    if (!offer || offer.voucherPrice <= 0) {
      return { ok: false, message: '爸妈还没给它定价' }
    }

    const preview = planWishRedeem(offer.voucherPrice, get().harvestBalance, get().balance)
    if (!preview.affordable) {
      return { ok: false, message: `兑换券和积分加起来还差 ${preview.shortfall}` }
    }

    // 已拥有 = 账本买过的 + 装上的插件 + **心愿单里兑换到手过的**。
    //
    // 第三个来源不能省：`uninstallGame` 会把包和存档一起删掉，删完之后
    // 前两个来源都认不出来 —— 盒子会变回可兑换、盲盒会把它放回池子，
    // 孩子就被扣第二次券（详见 `redeemedGameIdsFrom` 的注释）。
    const owned = new Set<string>([
      ...get().ownedGameIds,
      ...Object.keys(get().installedGames),
      ...redeemedGameIdsFrom(get().wishOrders),
    ])

    let gameId: string | undefined
    if (item.kind === 'blindbox') {
      const picked = pickBlindBox(item.pool ?? [], [...owned])
      // ⚠️ 池子空了必须**在这里**拦住。再往下就扣券了，扣完才发现没得开。
      if (!picked) return { ok: false, message: '这些游戏你都有啦，等新的再来开' }
      gameId = picked
    } else if (item.kind === 'gamebox') {
      if (!item.gameId) return { ok: false, message: '这款游戏没配好' }
      if (owned.has(item.gameId)) return { ok: false, message: '这个游戏你已经有了' }
      gameId = item.gameId
    }

    const now = Date.now()
    const freshId = uid('wo')
    const box: { ok: boolean; id: string } = { ok: true, id: freshId }

    await db.transaction('rw', [db.ledger, db.harvestLedger, db.wishOrders], async () => {
      const hTip = await harvestTip()
      const pTip = await ledgerTip()
      // 事务内**重新算一次**：外面那份只是给 UI 看的预览。
      // 两个标签页同时点「兑换」时，用旧余额算会把已经花掉的券再花一次。
      const live = planWishRedeem(offer.voucherPrice, hTip.balance, pTip.balance)
      if (!live.affordable) {
        box.ok = false
        return
      }

      // 兑换券那笔。`voucherPaid === 0` 时**不写** —— 写一笔 delta 0 的账，
      // 流水里会凭空多出一条「心愿商城 0 券」。
      if (live.voucherPaid > 0) {
        await db.harvestLedger.put({
          id: `hv_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          delta: -live.voucherPaid,
          balanceAfter: hTip.balance - live.voucherPaid,
          source: 'wish_redeem',
          refId: item.id,
          memo: `心愿商城：${item.name}`,
          createdAt: hTip.createdAt,
        })
      }

      // 积分那笔（2026-10-29 起可以混付）。理由同上：0 分不写账。
      if (live.pointsPaid > 0) {
        await db.ledger.put({
          id: `lg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
          delta: -live.pointsPaid,
          balanceAfter: pTip.balance - live.pointsPaid,
          source: 'wish_redeem',
          refId: item.id,
          memo: `心愿商城：${item.name}`,
          createdAt: pTip.createdAt,
        })
      }

      // 同一件商品如果之前只是「想要」，**复用那一行** ——
      // 一条记录走完全程，历史里不会出现「想要一条、兑换一条」两行。
      const existed = await db.wishOrders
        .where('itemId')
        .equals(itemId)
        .filter((o) => o.status === 'wished')
        .first()
      if (existed) box.id = existed.id

      await db.wishOrders.put({
        id: box.id,
        itemId,
        itemName: item.name,
        itemEmoji: item.emoji,
        kind: item.kind,
        partnerName: item.partnerName,
        voucherPrice: live.price,
        status: 'committed',
        // 押的是**实际扣掉的两种币**，不是标价 —— 退款按这两个数原样退，
        // 所以 `vouchersHeld` 从「等于券价」变成了「等于券那部分」。
        vouchersHeld: live.voucherPaid,
        pointsHeld: live.pointsPaid,
        openedGameId: gameId,
        createdAt: existed?.createdAt ?? now,
        committedAt: now,
      })
    })

    if (!box.ok) return { ok: false, message: '兑换券不够啦' }

    // 游戏类：真正交付 = 装包。失败就把券退回去。
    if (gameId) {
      const res = await get().installLocalGame(gameId)
      if (!res.ok) {
        await get().wishCancel(box.id, '游戏没装好')
        return { ok: false, message: `游戏没装好，券已经退回来了：${res.message}` }
      }
    }

    get().pushToast({
      kind: 'reward',
      title: `兑换成功：${item.name}`,
      detail: gameId ? '已经放进你的游戏柜啦' : '等爸爸妈妈去买',
      emoji: item.emoji,
    })
    await get().refresh()
    return { ok: true, message: '兑换成功', gameId }
  },

  wishSetOffer: async (itemId, voucherPrice) => {
    const price = Math.round(voucherPrice)
    const now = Date.now()
    if (price > 0) {
      // `put` 整行覆盖 —— 重新开放会顺手清掉旧的 `closedAt`，这是想要的
      await db.wishOffers.put({ itemId, voucherPrice: price, openedAt: now })
    } else {
      const cur = await db.wishOffers.get(itemId)
      // 关闭写 `closedAt`，**不删行** —— 孩子之前换过的历史还要能解释
      if (cur) await db.wishOffers.update(itemId, { closedAt: now })
    }
    await get().refresh()
  },

  wishConfirm: async (orderId) => {
    const row = await db.wishOrders.get(orderId)
    // 只有「已兑换」能往前走。已取消的单子不能被一次误点复活。
    if (!row || row.status !== 'committed') return
    await db.wishOrders.update(orderId, { status: 'confirmed', confirmedAt: Date.now() })
    await get().refresh()
  },

  wishDone: async (orderId, patch) => {
    const row = await db.wishOrders.get(orderId)
    if (!row || (row.status !== 'committed' && row.status !== 'confirmed')) return

    const now = Date.now()
    const next: Partial<WishOrder> = { status: 'done', doneAt: now }
    if (patch?.buyOrderNo) next.buyOrderNo = patch.buyOrderNo
    if (patch?.ship) {
      // 收货信息**自动过期**：30 天后由启动清理抹掉（见 `purgeOldWishShip`）。
      // 不指望用户手动删 —— 没人会回来删自己的地址。
      next.ship = { ...patch.ship, purgeAfter: now + 30 * 24 * 60 * 60 * 1000 }
    }
    await db.wishOrders.update(orderId, next)
    await get().refresh()
  },

  wishCancel: async (orderId, reason) => {
    const now = Date.now()
    const box = {
      refunded: 0,
      refundedPoints: 0,
      deliveredGame: undefined as string | undefined,
    }

    await db.transaction('rw', [db.ledger, db.harvestLedger, db.wishOrders], async () => {
      const row = await db.wishOrders.get(orderId)
      if (!row) return

      // 已经结束的单子直接返回。**这一步就是防重复退款的全部** ——
      // 按钮 disabled 挡不住两个标签页同时点，而账本只看 delta 之和，
      // 多退一次不会报错，只会让余额悄悄变多。
      if (row.status !== 'wished' && row.status !== 'committed' && row.status !== 'confirmed') {
        return
      }

      // 记下来：这个订单交付过哪款游戏。事务外要把安装摘掉 ——
      // 删 `gameKv` 的行不属于这个事务（另一张表），而且它失败也不该回滚退款。
      box.deliveredGame = row.openedGameId

      if (row.status !== 'wished') {
        /*
         * 两种币**各退各的**（2026-10-29）。
         *
         * 只退券不退积分 = 混付那部分积分凭空蒸发，而且不报错 ——
         * 孩子只会觉得「取消了怎么钱少了」。所以这两笔必须写在同一个事务里。
         *
         * `pointsHeld` 缺省 0：老订单（纯券）走这条分支时一笔都不写。
         */
        const voucherBack = row.vouchersHeld
        const pointsBack = row.pointsHeld ?? 0

        if (voucherBack > 0) {
          const hTip = await harvestTip()
          await db.harvestLedger.put({
            id: `hv_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
            delta: voucherBack,
            balanceAfter: hTip.balance + voucherBack,
            source: 'wish_refund',
            refId: row.itemId,
            memo: `取消兑换退回：${row.itemName}`,
            createdAt: hTip.createdAt,
          })
          box.refunded = voucherBack
        }

        if (pointsBack > 0) {
          const pTip = await ledgerTip()
          await db.ledger.put({
            id: `lg_${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
            delta: pointsBack,
            balanceAfter: pTip.balance + pointsBack,
            source: 'wish_refund',
            refId: row.itemId,
            memo: `取消兑换退回：${row.itemName}`,
            createdAt: pTip.createdAt,
          })
          box.refundedPoints = pointsBack
        }
      }

      await db.wishOrders.update(orderId, {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: reason,
      })
    })

    /*
     * 数字商品：券退回去了，**游戏必须一起收回**。
     *
     * 不收回就是「券退回来 + 游戏还装着」= 白拿一个游戏，而且
     * `redeemedGameIdsFrom` 只认 committed/confirmed/done，取消之后
     * 这个游戏又变回「没买过」，孩子可以**再兑换一次**。
     *
     * 用 `detachGameKv` 而不是 `clearGameKv`：只摘安装（包 + 资源根），
     * **保留存档** —— 撤销的是这笔交易，不是孩子玩出来的进度。
     *
     * 装包失败那条路也会走到这里（`wishRedeem` 装不上就 `wishCancel`），
     * 那时 `gameKv` 里本来就没有包，删 0 行，无副作用。
     */
    if (box.deliveredGame) {
      await detachGameKv(box.deliveredGame)
      if (get().activeGameId === box.deliveredGame) {
        // 正在玩的就是它 → 回落，否则底部导航会指向一个已经不存在的游戏
        await get().updateSettings({ activeGame: DEFAULT_GAME_ID })
      }
    }

    if (box.refunded > 0 || box.refundedPoints > 0) {
      // 两种币都可能退，标题里只写实际退了的那些 —— 「已退回 0 张兑换券 + 30 积分」
      // 看着像出错。
      const parts: string[] = []
      if (box.refunded > 0) parts.push(`${box.refunded} 张兑换券`)
      if (box.refundedPoints > 0) parts.push(`${box.refundedPoints} 积分`)
      get().pushToast({
        kind: 'info',
        title: `已退回 ${parts.join(' + ')}`,
        detail: box.deliveredGame ? '游戏已收回，进度还在' : undefined,
        emoji: '🎫',
      })
    }
    await get().refresh()
  },

  jumpToRedeem: (itemId) => {
    set({ pendingRedeemItem: itemId })
  },

  takePendingRedeemItem: () => {
    const id = get().pendingRedeemItem
    if (id) set({ pendingRedeemItem: null })
    return id
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

  redeemGameCode: async (raw) => {
    const code = normalizeGameCode(raw)
    if (!isGameCode(code)) {
      // 分开说：格式不对是「敲错了」，表里没有是「这张卡不对」。
      // 合成一句「码无效」会让家长在两种情况下做同一件事（重敲一遍），
      // 而其中一种重敲多少次都没用。
      return { ok: false, message: '码是 6 位字母或数字，中间那一横不用输' }
    }

    // ★ 登录了就以服务端为准。
    //
    // 服务端在**同一个事务**里验码 → 标记已用 → 写 `user_game`，
    // 「这次调用成功」就等于「游戏已经在他的账号里了」。
    // 下面那张本机 `codeTable` 只用于没登录的情况（离线 / 单测）。
    if (getToken()) return redeemCodeOnServer(code)

    const gameId = await gameIdForCode(code)
    if (!gameId) return { ok: false, message: '没有这个码，对着卡片再核一遍' }

    // 这个版本里有没有这款游戏。**没有就先别烧码** ——
    // 孩子升到新版本还能用；烧掉了就只能找客服补。
    const builtin = gameById(gameId)
    const local = localGameById(gameId)
    if (!builtin && !local) {
      return { ok: false, message: '这个码对应的游戏这个版本里还没有，换新版本再试' }
    }
    const name = builtin?.name ?? local?.name ?? gameId

    // 已经有了就别浪费一张码
    if (get().ownedGameIds.includes(gameId) || get().installedGames[gameId]) {
      return { ok: false, message: `「${name}」你已经有了，这张码先留着` }
    }

    const hash = await codeHashOf(code)
    const now = Date.now()
    let ledgerId = ''
    let claimed = false

    await db.transaction('rw', [db.wishCodes, db.mallLedger], async () => {
      // 事务内**重读**：两个标签页同时输同一个码，只该成一次。
      // 靠按钮 disabled 挡不住这个（心愿商城退款那里记过同一次事故）。
      if (await db.wishCodes.get(hash)) return
      await db.wishCodes.put({ codeHash: hash, gameId, usedAt: now })
      // ★ delta 恒为 0：码解锁一分钻石都没花。写 0 是**事实**，
      //   而 `purchasedIdsFrom` 对 `redemption_code` 不看 delta（见那边的表）。
      const row = await postMall({
        delta: 0,
        source: 'redemption_code',
        refId: gameId,
        memo: `兑换码解锁「${name}」`,
      })
      ledgerId = row.id
      claimed = true
    })

    if (!claimed) return { ok: false, message: '这个码已经用过了' }

    // 插件游戏要真的装包。装不上就把刚写的两行撤掉 ——
    // 否则孩子拿到一句「装包失败」而码已经没了。
    if (local) {
      const res = await get().installLocalGame(gameId)
      if (!res.ok) {
        await db.transaction('rw', [db.wishCodes, db.mallLedger], async () => {
          await db.wishCodes.delete(hash)
          if (ledgerId) await db.mallLedger.delete(ledgerId)
        })
        return { ok: false, message: `装包没成功，码没扣：${res.message}` }
      }
    }

    get().pushToast({
      kind: 'reward',
      title: `解锁成功：${name}`,
      detail: local ? '已经放进你的游戏柜啦' : '底部导航就能切过去',
      emoji: '🎁',
    })
    await get().refresh()
    return { ok: true, message: `解锁成功：${name}`, gameId }
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

    // ④ 落库（拦内置 id / 校验经济 / 写 __bundle + __assets 都在那里面）
    //    名字用**目录**里的（它才是已验签的显示来源），不用包自己说的
    return commitPluginBundle(bundle, resolved.code, assetBaseOf(resolved.game), {
      name: resolved.game.name,
      version: resolved.game.version,
    })
  },

  installLocalGame: async (gameId) => {
    const entry = localGameById(gameId)
    if (!entry) return { ok: false, message: `这个版本里没有本地游戏「${gameId}」` }

    /* ★ 没拥有就不能装（2026-10-30 家长拍板：「加门槛，没拥有不能装」）。
     *
     * 门槛放在 store 里、不放在按钮上 —— 按钮只是入口之一，
     * 兑换流程 / 调试桥 / 将来的批量装都会绕过它。放在这里才是真的关死。
     *
     * 判据是 `ownedGameSetNow()`（读库、三个来源），不是 `get().ownedGameIds`：
     * 兑换是「先记账本再装包」，读快照会把刚兑换的判成没拥有。 */
    if (!(await ownedGameSetNow()).has(gameId)) {
      return {
        ok: false,
        message: `「${entry.name}」还没拥有 —— 去心愿商城兑换，或者用激活码`,
      }
    }

    // ① 取包。本地包走同源 fetch —— 仍然是**网络栈**（dev / Capacitor 都如此），
    //    所以「本地」只省掉了「目录 + 签名」这一步，不省「取字节」。
    let bytes: Bytes
    try {
      const res = await fetch(entry.url)
      if (!res.ok) return { ok: false, message: `读取本地包失败：HTTP ${res.status}` }
      bytes = new Uint8Array(await res.arrayBuffer())
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: `读取本地包失败：${msg}` }
    }

    // ② 先验哈希，**再**执行。哈希来自 `localGames.ts`（编译进 JS），
    //    不是来自 `public/` —— 发布物不能自证。
    try {
      await assertSha256(bytes, entry.sha256, `本地包「${entry.id}」`)
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }

    // ③ 执行 + 形状校验
    let bundle: GameBundle
    try {
      bundle = await importBundle(new TextDecoder().decode(bytes))
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) }
    }

    // ④ 清单说 id X、包里写 Y ⇒ 生成清单时就把包弄错了，拒绝
    if (bundle.manifest.id !== entry.id) {
      return {
        ok: false,
        message: `本地清单里这款是「${entry.id}」，但包里写的是「${bundle.manifest.id}」—— 拒绝安装`,
      }
    }

    return commitPluginBundle(bundle, new TextDecoder().decode(bytes), entry.assetBase, {
      name: entry.name,
      version: entry.version,
    })
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
    //
    //    这条守卫现在在 `commitPluginBundle` 里（本地 / 远程 / 走查三条路共用一份）。
    let assetBase = ''
    try {
      assetBase = new URL('./', url).toString()
    } catch {
      /* url 不合法时留空：资源加载会 404，但游戏本体还能起来 */
    }
    return commitPluginBundle(bundle, code, assetBase)
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

    /*
     * 资源根：装的时候记下来的那个（`ASSET_BASE_KEY`）。
     *
     * ⚠️ **不能不给**。插件在 `blob:` 模块里跑，相对路径会以 blob: 为基准
     * 解析 ⇒ 纹理全 404，而报错是一堆 "could not load texture"，
     * 看着像打包坏了（`prize-park-local` 的 README 记过这次事故）。
     */
    const assetBase = (await getGameKv<string>(gameId, ASSET_BASE_KEY)) ?? ''

    const ctx: MountContext = {
      assetBase,
      assetUrl: (rel) => assetUrlFor(assetBase, rel),
      // 宿主目前只有中文。给个值，是为了让插件不必自己猜 navigator.language
      // （那在 Android WebView 里跟着系统走，孩子会把游戏看成日文）。
      locale: 'zh',
    }

    return mountBundle(container, bundle, pluginHostApi(gameId), ctx)
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
      wishOffers,
      wishOrders,
      farmEvents,
      settings,
      meta,
      farm,
      market,
      quotaCarry,
      wishCodes,
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
      db.wishOffers.toArray(),
      db.wishOrders.toArray(),
      db.farmEvents.toArray(),
      loadSettings(),
      db.meta.toArray(),
      loadFarm(),
      loadMarket(),
      loadQuotaCarry(),
      db.wishCodes.toArray(),
    ])
    /*
     * 装过哪些游戏 —— 本体不进备份，恢复时要靠这份名单从本地包重装。
     * 名单从 `__bundle` 行算（`installedGames` 的唯一事实来源），
     * 不另存一份，免得两边走散。
     */
    const installedGameIds = gameKv
      .filter((r) => r.key.endsWith(`:${BUNDLE_KEY}`))
      .map((r) => r.gameId)
    return {
      app: 'kid-quest-farm',
      /**
       * 备份格式版本。**导入端不看它**（只认 `app` 和 `data`），
       * 所以老文件照样能读；它只是给「人」和排障用的标记。
       *
       * v3（2026-10-28）：`data` 里新增 `wishOrders`，且其中的收货信息
       * 一律是脱敏快照（`shipSnapshot`），不会有 `ship`。见 spec §9.1。
       * v4（2026-10-30）：`data` 里新增 `wishCodes`（已经用过的兑换码）。
       */
      version: BACKUP_VERSION,
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
         *
         * ⚠️ 但**只导存档，不导本体**（`saveOnlyGameKv`）：`__bundle` 是几 MB
         * 的游戏代码，而且它会被 `import()` 执行 —— 见那个函数的注释。
         * 装过哪些游戏记在 `meta.installedGameIds`，恢复后从本地包重装。
         */
        gameKv: saveOnlyGameKv(gameKv),
        inventory,
        animals,
        checkIns,
        checkInProgress,
        redeemItems,
        redeemRecords,
        /**
         * **家长给商品定的券价**（哪件开放、卖多少张）。
         *
         * 这是用户自己录入的数据，不在商品目录常量里（目录只有「有什么」）。
         * 不导出的话，换机之后**所有商品都变回「等爸妈开放」** —— 孩子点进去
         * 什么也换不了，家长得把每一件重新定一次价，而且没有任何提示说
         * 「你的定价没跟过来」。
         */
        wishOffers,
        /**
         * 愿望单订单。**必须导出** —— 里面有 `vouchersHeld`（这一单押着的券）。
         *
         * 漏掉的后果不是「历史没了」那么轻：券在 `committed` 时已经从余额里扣走，
         * 扣券的凭据就是这个字段。导入后订单消失 ⇒ 券被扣了却**没有任何订单
         * 可以退**（`cancelOrder` 找不到行），孩子的券凭空蒸发，且不报错。
         * 2026-10-28 补导出时发现（当时只导了 `redeemRecords`）。
         *
         * ⚠️ 必须过 `orderToBackup` 裁掉 `ship`（收货人/手机/地址），
         *    见那个函数的注释和 spec §9.1。
         */
        wishOrders: wishOrders.map(orderToBackup),
        events: farmEvents,
        market,
        settings: stripDeviceLocal(settings),
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
        /**
         * **已经用过的兑换码**（`wishCodes`，v10 加的表）。
         *
         * ⚠️ 必须跟 `mallLedger` **同进同出**。这两张表是一件事的两半：
         * 账本里那笔 `source: 'redemption_code'` 证明「码换到了什么」，
         * 这张表证明「这个码在本机用过了」。
         *
         * 只清不存（v10 加表时就是这样，两个方向都漏登记）的后果：
         * 导入一份「兑换之前」的备份、或者点了「清空全部数据」之后，
         * 游戏回到「没拥有」而码还标着「用过」⇒ **那张实体卡废了**，
         * 界面只说一句「这个码已经用过了」。2026-10-30 查备份覆盖面时发现。
         */
        wishCodes,
        /**
         * ⚠️ `meta` 里**还有一份** `settings`（同一个对象，`setMeta('settings')`
         * 写的就是它）。只剥顶层那个 `settings` 是不够的 —— 这条断言第一次跑
         * 就是这么红的：PIN 换了个门又出去了。所以这里也要剥。
         */
        meta: Object.fromEntries([
          ...meta.map(
            (m): [string, unknown] =>
              m.key === 'settings'
                ? [m.key, stripDeviceLocal(m.value as AppSettings)]
                : [m.key, m.value],
          ),
          /* 装过哪些游戏。不是「孩子挣到的东西」，是「这份备份描述的是
             哪台设备上装了什么」—— 恢复时拿它把本地游戏装回来。 */
          ['installedGameIds', installedGameIds],
        ]),
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
        /* ⚠️ 主键是 `key`（形如 `${gameId}:${k}`），**不是 `id`** —— 和背包一样要显式传键名
         *
         * ⚠️ 而且要**滤掉 `__bundle` / `__assets`**：文件里那两行是游戏代码，
         * 挂载时会被 `import()` 执行，而这条路没有哈希也没有签名。
         * 别人发来的备份里放一段代码，导入就等于把它跑起来（见
         * `saveOnlyGameKv` 的注释）。本体只从**本地包**装（那条路比对 sha256）。 */
        gameKv: saveOnlyGameKv(pickArray<GameKvRow>(d.gameKv, 'key') ?? []),
        // ⚠️ 背包的主键是 `itemId`，不是 `id` —— 见上面 `pickArray` 的注释
        inventory: pickArray<InventorySlot>(d.inventory, 'itemId') ?? [],
        animals: pickArray<Animal>(d.animals) ?? [],
        checkIns: pickArray<CheckInRecord>(d.checkIns) ?? [],
        checkInProgress: pickArray<CheckInProgress>(d.checkInProgress) ?? [],
        redeemItems: pickArray<RedeemItem>(d.redeemItems) ?? [],
        redeemRecords: pickArray<RedeemRecord>(d.redeemRecords) ?? [],
        // 老备份里没有愿望单 → null → 空数组（不写任何行，等于没这功能）
        // ⚠️ 主键是 `itemId`，**不是 `id`** —— 和背包同一个坑，见 `pickArray` 的注释
        wishOffers: pickArray<WishOffer>(d.wishOffers, 'itemId') ?? [],
        // ⚠️ 必须过 `orderFromBackup`：外部文件里可能带着 `ship`
        wishOrders: (pickArray<WishOrder>(d.wishOrders) ?? []).map(orderFromBackup),
        // ⚠️ 主键是 `codeHash`，**不是 `id`** —— 和背包 / gameKv / wishOffers 同一类坑。
        // 老备份（v3 及以前）没有这个字段 → 空数组 → 等于「那时候一个码都没用过」，
        // 和 `mallLedger` 回到同一时刻是**一致**的。
        wishCodes: pickArray<WishCode>(d.wishCodes, 'codeHash') ?? [],
        events: pickArray<FarmEvent>(d.events) ?? [],
      }

      /**
       * 本机的家长 PIN。
       *
       * ⚠️ **必须在事务前读**：事务里第一件事就是 `db.meta.clear()`，
       * settings 会跟着没，读出来就永远是 undefined 了。
       *
       * PIN 是**凭据**，不是数据：备份里带什么、带不带，都不该改这台设备的锁。
       * 只清不保的后果是「导入任何一份旧备份 = 家长锁被清空」，孩子拿到文件就能解锁；
       * 照文件写的后果是「导入一份别人设备的备份 = 锁被改成那个密码」。
       */
      const deviceSettings = await loadSettings()
      const deviceParentPin = deviceSettings.parentPin
      const deviceGameClock = deviceSettings.gameClock

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
          db.wishOffers,
          db.wishOrders,
          db.farmEvents,
          db.harvestLedger,
          db.mallLedger,
          db.gameKv,
          db.wishCodes,
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
            db.wishOffers.clear(),
            db.wishOrders.clear(),
            db.farmEvents.clear(),
            db.wishCodes.clear(),
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
          if (rows.wishOffers.length > 0) await db.wishOffers.bulkPut(rows.wishOffers)
          if (rows.wishOrders.length > 0) await db.wishOrders.bulkPut(rows.wishOrders)
          if (rows.events.length > 0) await db.farmEvents.bulkPut(rows.events)
          if (rows.wishCodes.length > 0) await db.wishCodes.bulkPut(rows.wishCodes)
          if (d.settings && typeof d.settings === 'object') {
            // 文件里的 `parentPin` 一律不认（可能是别的设备的、也可能是孩子改的）
            const incoming = { ...(d.settings as AppSettings) }
            delete incoming.parentPin
            delete incoming.gameClock
            if (deviceParentPin) incoming.parentPin = deviceParentPin
            if (deviceGameClock) incoming.gameClock = deviceGameClock
            await db.meta.put({ key: 'settings', value: incoming })
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
          /**
           * 剩下那些**没被点名**的 meta key —— 照 `d.meta` 原样写回。
           *
           * 为什么需要这一步：`exportBackup` 是把整个 `meta` 表拍平的
           * （`Object.fromEntries(meta.map(...))`，**全量**），而上面那段是
           * **手写清单**。一侧自动、一侧手写 ⇒ 以后往 meta 里加个新 key，
           * 导出会自动带上、导入会静默丢掉。
           *
           * 已经丢了的那一个：`farm.lastEventCheck`（事件概率用的时间戳）。
           * 丢了只是「暂时不掷灾害骰子」，看不出来 —— 正因为看不出来，
           * 才更该在这里一次修掉，而不是等下一个 key 丢。
           * 2026-10-30 查「导出 / 导入是否对称」时发现。
           *
           * 上面那 6 个 key 由顶层字段负责（老备份里没有 `d.meta`），
           * 这里跳过，免得两种来源打架。
           */
          const META_FROM_TOP_LEVEL = new Set<string>([
            'settings',
            'farm.market',
            'farm.plots',
            'farm.totals',
            'farm.day',
            QUOTA_CARRY_KEY,
          ])
          const metaBag = d.meta
          if (metaBag && typeof metaBag === 'object' && !Array.isArray(metaBag)) {
            for (const [k, v] of Object.entries(metaBag as Record<string, unknown>)) {
              if (META_FROM_TOP_LEVEL.has(k)) continue
              /* 导出侧的元信息，不是应用状态 —— 写进库里只会变成
                 下一次导出时被覆盖的一行垃圾。 */
              if (k === 'installedGameIds') continue
              if (v === undefined) continue
              await db.meta.put({ key: k, value: v })
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
      /**
       * 先重读 settings，再 refresh。
       *
       * `refresh()` 一开头就是 `const { settings } = get()` —— 它**不重读**。
       * 只调 refresh 的话，内存里还是导入前那份：设置页显示旧的孩子名字、
       * 旧的审核开关，而且 refresh 里算「今天是哪天」（`dayStartHour`）、
       * 时间流速、事件开关用的全是旧值。2026-10-30 查备份时发现。
       */
      set({ settings: await loadSettings() })
      await get().refresh()

      /* ---- 游戏本体不在备份里：按名单从本地包重装 ----
       *
       * 走 `installLocalGame`，也就是**正常的安装路径**：取包 → 比对烧进 App 的
       * sha256 → 校验经济参数 → 才落库。备份文件里放什么都进不来。
       *
       * 存档不用管：它一直躺在 `gameKv` 里（`<gameId>:` 开头的其他行），
       * 装回来就能接着玩。
       *
       * 装不上有两种：这个版本里没有那款游戏、或者没拥有（账本里没有它）。
       * 都不该让整次恢复失败 —— 数据已经恢复了，只是游戏要手动装一次。 */
      const wantGames = (d.meta as Record<string, unknown> | undefined)?.installedGameIds
      let putBack = 0
      const pendingNames: string[] = []
      if (Array.isArray(wantGames)) {
        for (const gid of wantGames) {
          if (typeof gid !== 'string') continue
          const r = await get().installLocalGame(gid)
          if (r.ok) putBack += 1
          else {
            /* 说清是**哪几款**，别只给个数。
             * 「还有 2 款要去游戏页重新装」等于让家长自己在列表里找哪一行
             * 显示的是「安装」而不是「已安装」—— 装了五六款时根本找不过来。
             * 名字优先用本地清单（家长看到的那个名字），退到注册表，最后才用 id。 */
            pendingNames.push(localGameById(gid)?.name ?? gameById(gid)?.name ?? gid)
          }
        }
      }
      /* 一句话说清三件事：装回几款、哪几款没装上、去哪装。
       * 三个分支都要写 —— 「装回 0 款，A 要去重装」这种话读起来别扭，
       * 而且孩子会以为「0 款」是自己弄丢了什么。 */
      const quoted = pendingNames
        .slice(0, 3)
        .map((n) => `「${n}」`)
        .join('、')
      const more = pendingNames.length > 3 ? ` 等 ${pendingNames.length} 款` : ''
      const needReinstall = pendingNames.length > 0 ? `${quoted}${more}` : ''
      let tail = ''
      if (putBack > 0 && pendingNames.length > 0) {
        tail = `；游戏装回 ${putBack} 款，但 ${needReinstall}要去「游戏」页重新装一次`
      } else if (pendingNames.length > 0) {
        tail = `；${needReinstall}要去「游戏」页重新装一次`
      } else if (putBack > 0) {
        tail = `；游戏装回 ${putBack} 款`
      }
      return { ok: true, message: `数据已恢复${tail}` }
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
         * 闸门：这个产出物现在还能卖出多少兑换券。
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
       * 调试发兑换券。和 `addPoints` 并列，**只给 E2E 用**。
       *
       * 为什么必须有：心愿商城的核心断言是「兑换后余额真的少了」，
       * 而兑换券只能靠农场收成或玩插件游戏赚 —— 走查脚本没有几分钟去种地。
       * 没有这个入口，那条断言只能退化成「按钮点了没报错」，
       * 而按钮点了没报错恰恰是最容易骗过测试的假绿。
       *
       * ⚠️ 走账本（`manual_adjust`），不是直接改余额。
       */
      addVouchers: (delta: number) => Promise<void>
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
        /**
         * 某款游戏的**币余额**（账本 delta 之和，和 `gameCoinBalanceOf` 同一个口径）。
         *
         * 走查脚本要断言「玩完真的拿到币」—— 顶栏数字在插件全屏时不显示，
         * 没有读数就只能靠猜。
         */
        gameCoins: (gameId: string) => Promise<number>
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
       * 预置「已拥有」（走查脚本用）。
       *
       * ⚠️ 2026-10-30 加了「没拥有不能装」的门槛之后，**每个游戏 e2e 都要先有它**，
       * 否则点 `[data-local-install]` 会点空。拥有关系本来就在客户端本地
       * （账本 / 心愿单 / 已装包），能开 devtools 的人自己也能改 ——
       * 这个句柄不是安全边界，别当它是。
       */
      grantGame: (gameId: string) => Promise<void>
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
    addVouchers: async (delta) => {
      await postHarvest({
        delta,
        source: 'manual_adjust',
        memo: `调试加兑换券 +${delta}`,
      })
      await useApp.getState().refresh()
    },
    /**
     * 预置「已拥有」。
     *
     * 走的是**和真实兑换完全一样的那一笔账**（`redemption_code`，delta 0）——
     * 不另开一条只有测试能走的路，否则 e2e 验的就不是生产链路了。
     */
    grantGame: async (gameId) => {
      if (useApp.getState().ownedGameIds.includes(gameId)) return
      await postMall({
        delta: 0,
        source: 'redemption_code',
        refId: gameId,
        memo: '调试预置拥有',
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
      /**
       * 某款游戏的币余额（账本 delta 之和）。
       *
       * 加这个是因为 e2e 要断言「玩完真的拿到币」—— 没有读数就只能靠
       * 「顶栏数字变没变」猜，而顶栏在插件全屏时根本不显示。
       */
      gameCoins: (gameId) => gameCoinBalanceOf(gameId),
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

/* ============================================================
   兑换码 · 登录态（服务端是真相）
   ============================================================ */

/**
 * 用兑换码解锁游戏 —— **登录状态下走这条路**。
 *
 * ## 为什么服务端说了算
 *
 * 服务端在一个事务里做完三件事：验码 → CAS 标记已用 → 写 `user_game`。
 * 所以「调用成功」就等于「游戏已经在他的账号里了」，客户端不需要
 * （也不应该）再调一次「解锁游戏」—— 那样会出现两套拥有关系，
 * 换台设备登录就只剩一半。
 *
 * ## 本地要补两件事
 *
 * ① **账本里记一笔 `redemption_code`（delta 0）**。
 *    `ownedGameIds` 是从账本推出来的（`purchasedIdsFrom`），
 *    不记这一笔，「我的游戏」里就不显示已拥有 —— 而服务端明明已经给了。
 *    delta 必须是 0：码解锁一分钻石都没花，写别的数就是假账。
 *
 * ② **插件包要真的装下来**。装完才谈得上「玩」。
 *
 * ## ⚠️ 装包失败**不回滚**
 *
 * 码已经在服务端用掉了，客户端回滚不掉。硬装成「失败」只会让界面
 * 说一句失败，而码其实已经没了 —— 那才是最坏的结果。
 * 「已激活但没装」是有出口的：游戏会出现在「我的游戏」里，点安装就行。
 * 所以这里照实说「已激活，但没装成功，去点安装」。
 */
async function redeemCodeOnServer(
  code: string,
): Promise<{ ok: boolean; message: string; gameId?: string }> {
  let resp: ApiWishCodeResult
  try {
    resp = await redeemWishCode(code)
  } catch (e) {
    const err = e instanceof ApiError ? e : null
    /* 这三种必须分开说 —— 家长接下来要做的事完全不同：
       重新登录 / 过会儿再试 / 别再试了去找卖家。 */
    if (err?.isAuth) return { ok: false, message: '登录过期了，重新登录再试（这张码没被用掉）' }
    if (err?.isNetwork) return { ok: false, message: '连不上服务器，这张码没被用掉，过会儿再试' }
    // 业务错误：码无效 / 已被使用 / 已过期 / 已拥有 —— 服务端给的就是中文
    return { ok: false, message: err?.message || '兑换没成功' }
  }

  const gameId = resp.game_id ?? ''
  if (!gameId) {
    // 码是真的，但对应的不是游戏卡（券 / 实物）。这一版只处理游戏卡，
    // 照实说「兑换成功」，别硬编一个游戏名出来。
    return { ok: true, message: '兑换成功' }
  }

  const builtin = gameById(gameId)
  const local = localGameById(gameId)
  const name = builtin?.name ?? local?.name ?? gameId
  const app = useApp.getState()

  // ① 账本补一笔，让「已拥有」在界面上成立
  await postMall({
    delta: 0,
    source: 'redemption_code',
    refId: gameId,
    memo: `兑换码解锁「${name}」`,
  })

  // ② 插件包真的装下来
  let note = ''
  if (local) {
    const res = await app.installLocalGame(gameId)
    if (!res.ok) note = `，但没装成功（${res.message}），去「我的游戏」里点安装`
  }

  app.pushToast({
    kind: 'reward',
    title: `已激活：${name}`,
    detail: local ? '已经放进你的游戏柜啦' : '底部导航就能切过去',
    emoji: '🎁',
  })
  await app.refresh()
  return { ok: true, message: `已激活：${name}${note}`, gameId }
}
