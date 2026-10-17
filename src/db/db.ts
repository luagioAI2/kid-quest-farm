import Dexie, { type Table } from 'dexie'
import { createInitialFarm } from '../domain/farm'
import { createInitialMarket } from '../domain/market'
import { PRODUCE_BASE_PRICE } from '../domain/catalog'
import { CLAW_DEFAULT_EXCHANGE, CLAW_DEFAULT_WIN_RATE } from '../domain/clawEconomy'
import { DEFAULT_GAME_ID } from '../games/ids'
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
  LedgerSource,
  MallEntry,
  MallSource,
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

/**
 * 通用键值行 —— **下载来的游戏**的状态都存这里（Dexie v7，spec §12.2 方案 a）。
 *
 * `key` 是 `${gameId}:${游戏自己的键}`，所以**主键天然带命名空间**；
 * `gameId` 单独一列只是为了让「卸载某款游戏」能一次删干净（`clearGameKv`），
 * 以及让「读这款游戏的全部状态」不用扫全表。
 *
 * ⚠️ 为什么不是「每个游戏一张表」：见 `this.version(7)` 的注释 ——
 * 表必须编译期声明，而下载来的游戏是在运行时才出现的。
 */
export interface GameKvRow {
  key: string
  gameId: string
  value: unknown
}

class KidQuestFarmDB extends Dexie {
  tasks!: Table<Task, string>
  taskInstances!: Table<TaskInstance, string>
  ledger!: Table<LedgerEntry, string>
  /** 商城币账本。与 `ledger` 物理隔离，见 `HarvestEntry` 的注释。 */
  harvestLedger!: Table<HarvestEntry, string>
  /** 钻石账本。第三套币，同样物理隔离，见 `MallEntry` 的注释。 */
  mallLedger!: Table<MallEntry, string>
  inventory!: Table<InventorySlot, string>
  animals!: Table<Animal, string>
  checkIns!: Table<CheckInRecord, string>
  checkInProgress!: Table<CheckInProgress, string>
  redeemItems!: Table<RedeemItem, string>
  redeemRecords!: Table<RedeemRecord, string>
  farmEvents!: Table<FarmEvent, string>
  /** 通用键值 —— **下载来的游戏**的状态都存这里，见 `GameKvRow`。 */
  gameKv!: Table<GameKvRow, string>
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
    // v5：商城币独立账本。
    //
    // 为什么单开一张表，而不是给 ledger 加个 currency 字段 —— 见 `HarvestEntry` 的注释。
    // 一句话：**要让「商城币不算进积分」由表结构保证，而不是靠每个读余额的地方
    // 都记得加过滤**。漏一个 filter 就静默算错，而且不报错。
    this.version(5).stores({
      harvestLedger: 'id, source, createdAt, refId',
    })
    // v6：钻石独立账本（第三套币，2026-10-14）。
    //
    // 家长原话：「钻石 跟积分 和 商城币都不一样。」同样是**单开一张表**
    // 而不是给 ledger 加 currency 字段 —— 理由与 v5 的商城币一字不差：
    // 让「钻石不算进任何别的余额」由表结构保证，而不是靠每个读余额的
    // 地方都记得加过滤（漏一个就静默算错，且不报错）。
    //
    // 这一轮**只建钱包，没有发币入口**（来源将来是付费或兑换码），
    // 所以这张表通常一直是空的 —— 购买按钮也不会出现。
    // ⚠️ 建了表不等于建了币。别为了「让表里有东西」先塞一笔假数据。
    this.version(6).stores({
      mallLedger: 'id, source, createdAt, refId',
    })
    // v7：**通用键值表** —— 给「独立下载的游戏」用（2026-10-15，spec §12）。
    //
    // 为什么必须有这张表：Dexie 的 schema 是**编译期固定**的（就是上面这一串
    // `this.version(N).stores({...})`，`scripts/e2e-upgrade.mjs` 还解析它对账）。
    // 一个**运行时下载**进来的游戏**没法给自己建表** —— 除非发新 APK。
    // 于是宿主提供这一张通用表：`key = `${gameId}:${游戏自己的键}``。
    //
    // 代价：没有索引查询，只能整块读写（小游戏够用）。
    // 好处：`exportBackup` / `importBackup` / `wipeAll` **天然覆盖**它 ——
    // 不用为每个新游戏改备份逻辑（本项目在「同一个事实存两份」上吃过大亏，
    // 这里刻意只存一份）。
    //
    // ⚠️ 加这张表**不等于**有了下载功能。它只是让「下载来的游戏有地方存状态」。
    // 别为了「让表里有东西」先塞假数据。
    this.version(7).stores({
      gameKv: 'key, gameId',
    })
  }
}

export const db = new KidQuestFarmDB()

/* ---------------- 通用键值（下载来的游戏用） ---------------- */

/**
 * 拼一个带命名空间的键。**只在这里拼** ——
 * 别在别处手写 `` `${gameId}:${k}` ``，那样改名 / 改分隔符时必然漏一处，
 * 而漏掉的那处**不报错**，只会静默读写到另一个键上。
 */
export function gameKvKey(gameId: string, key: string): string {
  return `${gameId}:${key}`
}

/** 读一款游戏的一个键。没存过返回 `undefined`。 */
export async function getGameKv<T>(gameId: string, key: string): Promise<T | undefined> {
  const row = await db.gameKv.get(gameKvKey(gameId, key))
  return row?.value as T | undefined
}

/** 写一款游戏的一个键。整块覆盖（没有局部更新 —— 见 v7 注释的「没有索引」）。 */
export async function setGameKv(gameId: string, key: string, value: unknown): Promise<void> {
  await db.gameKv.put({ key: gameKvKey(gameId, key), gameId, value })
}

/** 读一款游戏的全部键值，**键名已去掉前缀**。 */
export async function listGameKv(gameId: string): Promise<Record<string, unknown>> {
  const rows = await db.gameKv.where('gameId').equals(gameId).toArray()
  const out: Record<string, unknown> = {}
  for (const r of rows) out[r.key.slice(gameId.length + 1)] = r.value
  return out
}

/** 卸载一款游戏：只删**它自己的**状态，返回删掉的行数。 */
export async function clearGameKv(gameId: string): Promise<number> {
  return db.gameKv.where('gameId').equals(gameId).delete()
}

/**
 * 插件**包体本身**在 `gameKv` 里的保留键。
 *
 * ⚠️ 把「代码文本」放进键值表是个**权宜**：它可能几百 KB，
 * 而 `gameKv` 是「状态」表。P2 会把它挪到 `Filesystem`（那里适合放大文件），
 * 状态继续留在 `gameKv`。现在先放这儿，是因为 P1 要验的是**装配**，
 * 不是存储位置 —— 而多一个存储层会让「存档到底丢了没有」更难判断。
 */
export const BUNDLE_KEY = '__bundle'

/**
 * 列出所有**已安装**的游戏包。
 *
 * 怎么找：扫 `gameKv` 里 key 正好是 `<某 gameId>:__bundle` 的行。
 * **不另存一份「已安装列表」** —— 那份列表和这些行一旦不同步，
 * 就会出现「列表里显示装了、其实没装」或反过来（本项目的老毛病）。
 */
export async function listInstalledBundles(): Promise<{ gameId: string; code: string }[]> {
  const rows = await db.gameKv.toArray()
  const out: { gameId: string; code: string }[] = []
  for (const r of rows) {
    if (r.key === gameKvKey(r.gameId, BUNDLE_KEY) && typeof r.value === 'string') {
      out.push({ gameId: r.gameId, code: r.value })
    }
  }
  return out
}

/**
 * `gameKv` 表里出现过的**全部 gameId**（去重）。
 *
 * ★ 走查脚本用这个验「命名空间隔离」：正常只该有已安装游戏自己的 id。
 * 冒出别的 id 就说明有东西往别人的命名空间里写了 —— 前缀拼错、或者插件
 * 拿到了不该拿的 gameId —— 而这**不会报错**，只会静默串味。
 *
 * 用 `toArray()` 而不是索引去重：这张表只会随「装了几个游戏」增长，
 * 量级是几十行，没必要为它引入一个索引 API 的语义依赖。
 */
export async function listGameKvOwnerIds(): Promise<string[]> {
  const rows = await db.gameKv.toArray()
  return [...new Set(rows.map((r) => r.gameId))]
}

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

/**
 * 扣一笔**积分**，**在同一个事务里先验余额**。余额不够返回 `false`，一分不扣。
 *
 * 与 `spendMall` 完全对称，只是换了张表。**插件游戏碰钱的唯一入口**
 * （spec §3.2 / §12.5 的 `HostApi.spendPoints`）。
 *
 * ## 为什么不「先 `currentBalance()` 判断，再 `postLedger()`」
 *
 * 那是把**守卫放在事务外面**：两次并发调用会各自读到同一个「够」，于是都扣
 * —— **超支**，而且每条 `balanceAfter` 都自洽、不报错。
 * `consumeItem` 的注释里记过一模一样的事故。**守卫和扣款必须在同一个事务里。**
 *
 * ⚠️ 农场的种子 / 动物 / 开地**不走这里** —— 它们各有自己的 source
 * （`farm_plant` / `farm_purchase`），历史账目别被改写。这条是给插件用的。
 */
export async function spendPoints(
  amount: number,
  entry: { source: LedgerSource; refId?: string; memo: string },
): Promise<boolean> {
  const cost = Math.round(amount)
  if (cost <= 0) return false
  return db.transaction('rw', db.ledger, async () => {
    const tip = await ledgerTip()
    if (tip.balance < cost) return false
    await db.ledger.put({
      id: `lg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      delta: -cost,
      balanceAfter: tip.balance - cost,
      source: entry.source,
      refId: entry.refId,
      memo: entry.memo,
      createdAt: Math.max(Date.now(), tip.createdAt),
    })
    return true
  })
}

/* ---------------- 游戏币账本（住在 `gameKv` 的保留键里） ---------------- */

/**
 * 游戏币账本在 `gameKv` 里的保留键。
 *
 * ## 为什么不新开一张表
 *
 * Dexie 的表必须**编译期声明**（`this.version(N).stores`），
 * 而游戏 —— 尤其是下载来的 —— 是**运行时**才出现的（见 `GameKvRow` 的注释）。
 * 所以宿主给一张通用表 `gameKv`，游戏币也记在里面。
 *
 * ## ⚠️ 以 `__` 开头 = **宿主保留键**
 *
 * 插件通过 `HostApi.storage` 读写它会**直接抛**（`hostApi.ts` 的
 * `assertNotReserved`）—— 不静默忽略，因为那是插件的 bug，必须让它看得见。
 * 插件碰币的唯一两扇门是 `mintGameCoin()` / `gameCoinBalance()`。
 */
export const GAME_COIN_KEY = '__coin'

export interface GameCoinEntry {
  delta: number
  memo: string
  at: number
}

/** 读一款游戏的币账本。脏数据（不是数组 / 条目没有 delta）一律当空账 —— 不炸。 */
export async function readGameCoinLedger(gameId: string): Promise<GameCoinEntry[]> {
  const raw = await getGameKv<unknown>(gameId, GAME_COIN_KEY)
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is GameCoinEntry =>
      !!e && typeof e === 'object' && typeof (e as GameCoinEntry).delta === 'number',
  )
}

/**
 * 币余额 = 账本 delta 之和。
 *
 * **算出来的，不是存出来的** —— 理由和宿主那三套币一字不差：
 * 存一个 `balance` 字段就会出现「余额和流水对不上」，而且**不报错**。
 */
export async function gameCoinBalanceOf(gameId: string): Promise<number> {
  const rows = await readGameCoinLedger(gameId)
  return rows.reduce((sum, r) => sum + r.delta, 0)
}

/**
 * 往某款游戏的币账本里追加一笔（`delta > 0`）。
 *
 * ## 「只进不出」这句话要说得准一点
 *
 * 准确的说法是：**币不能换回任何别的币**（spec §2.2）。而不是「账本里
 * 永远不会出现负数」—— 玩一局本来就要扣一个币，那是 `spendGameCoin`。
 *
 * 这条 `delta <= 0` 的守卫是给**插件 API** 用的（`HostApi.mintGameCoin`）：
 * 插件不该有「凭空销毁自己的币」这条能力。宿主自己的消费走 `spendGameCoin`，
 * 那里有余额守卫，是另一回事。
 */
export async function addGameCoin(gameId: string, delta: number, memo: string): Promise<void> {
  const n = Math.round(delta)
  if (n <= 0) return
  const rows = await readGameCoinLedger(gameId)
  rows.push({ delta: n, memo, at: Date.now() })
  await setGameKv(gameId, GAME_COIN_KEY, rows)
}

/**
 * **花掉游戏币**（玩一局）。**守卫和扣款在同一个事务里** —— 余额不够返回
 * `false`，一个币不扣。
 *
 * 为什么不「先读余额、再写一笔负数」：那是把守卫放到事务外面，
 * 两次并发会各自读到同一个「够」，于是都扣 —— 超支，而且每条流水都自洽、
 * **不报错**。`consumeItem` / `spendMall` 的注释里记过一模一样的事故。
 *
 * ⚠️ 这是**唯一**允许往游戏币账本写负数的入口。出口只有「玩」这一条 ——
 * 没有「币 → 积分」的路（那会是一条双向通路，等于印钞机）。
 */
export async function spendGameCoin(
  gameId: string,
  amount: number,
  memo: string,
): Promise<boolean> {
  const n = Math.round(amount)
  if (n <= 0) return false
  return db.transaction('rw', db.gameKv, async () => {
    const rows = await readGameCoinLedger(gameId)
    const bal = rows.reduce((sum, r) => sum + r.delta, 0)
    if (bal < n) return false
    rows.push({ delta: -n, memo, at: Date.now() })
    await setGameKv(gameId, GAME_COIN_KEY, rows)
    return true
  })
}

/**
 * **用积分买一个游戏币** —— 扣积分和记币在**同一个事务**里。
 *
 * ## 为什么不能「先 `spendPoints()`，再 `addGameCoin()`」
 *
 * 那是两个独立事务。中间崩一下（或者被别的写打断）就变成
 * 「积分扣了、币没到」—— 孩子白丢一个积分，而且**没有任何报错**，
 * 只会觉得「点了没反应」。本项目在 `consumeItem` 上吃过一模一样的事故。
 *
 * 这里用 **Dexie 的嵌套事务**：外层罩住 `[ledger, gameKv]`，
 * 内层 `spendPoints()` 只声明 `[ledger]`（是外层的子集）⇒ Dexie
 * **复用外层事务**，不新开。所以「扣分」和「记币」要么一起成功、要么一起回滚。
 *
 * 顺带一个好处：扣分的守卫（余额够不够）仍然只有 `spendPoints` 那一份实现，
 * 不必在这里再抄一遍。
 *
 * 返回 `false` = 积分不够，**一分不扣、一个币不发**。
 */
export async function buyGameCoin(
  gameId: string,
  cost: number,
  memo: string,
): Promise<boolean> {
  const c = Math.round(cost)
  if (c <= 0) return false
  return db.transaction('rw', db.ledger, db.gameKv, async () => {
    const ok = await spendPoints(c, { source: 'game_spend', refId: gameId, memo })
    if (!ok) return false
    await addGameCoin(gameId, 1, memo)
    return true
  })
}

/* ---------------- 商城币账本 ---------------- */

/**
 * 商城币余额 = 所有 delta 之和。口径与 `currentBalance` 一致，理由也一样。
 *
 * **只读 `db.harvestLedger`，永远不碰 `db.ledger`** ——
 * 这里就是「商城币 ⇸ 积分」这条约束的落点。
 */
export async function currentHarvestBalance(): Promise<number> {
  const rows = await db.harvestLedger.toArray()
  return rows.reduce((sum, r) => sum + r.delta, 0)
}

/** 取「下一笔商城币账」该用的时间戳与当前余额。理由同 `ledgerTip`。 */
export async function harvestTip(): Promise<{ createdAt: number; balance: number }> {
  const rows = await db.harvestLedger.toArray()
  const maxAt = rows.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), 0)
  return {
    createdAt: Math.max(Date.now(), maxAt + 1),
    balance: rows.reduce((sum, r) => sum + r.delta, 0),
  }
}

/**
 * 记一笔商城币。**唯一**允许改动商城币余额的入口。
 *
 * 与 `postLedger` 完全对称，只是换了张表。
 * **刻意不提供「商城币 → 积分」的反向函数** —— 没有这个函数，就没有那条路。
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

/* ---------------- 钻石账本 ---------------- */

/**
 * 钻石余额 = 所有 delta 之和。口径与 `currentBalance` 一致，理由也一样。
 *
 * **只读 `db.mallLedger`** —— 这就是「钻石不算进积分、也不算进商城币」
 * 这条约束的落点。
 */
export async function currentMallBalance(): Promise<number> {
  const rows = await db.mallLedger.toArray()
  return rows.reduce((sum, r) => sum + r.delta, 0)
}

/** 取「下一笔钻石账」该用的时间戳与当前余额。理由同 `ledgerTip`。 */
export async function mallTip(): Promise<{ createdAt: number; balance: number }> {
  const rows = await db.mallLedger.toArray()
  const maxAt = rows.reduce((m, r) => (r.createdAt > m ? r.createdAt : m), 0)
  return {
    createdAt: Math.max(Date.now(), maxAt + 1),
    balance: rows.reduce((sum, r) => sum + r.delta, 0),
  }
}

/** 钻石账本行的**唯一**构造处 —— `postMall` 和 `spendMall` 都走它，别各写一份。 */
function mallRow(
  tip: { createdAt: number; balance: number },
  entry: {
    delta: number
    source: MallSource
    refId?: string
    memo: string
    id?: string
    createdAt?: number
  },
): MallEntry {
  const delta = Math.round(entry.delta)
  return {
    id: entry.id ?? `ml_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    delta,
    balanceAfter: tip.balance + delta,
    source: entry.source,
    refId: entry.refId,
    memo: entry.memo,
    createdAt: Math.max(entry.createdAt ?? tip.createdAt, tip.createdAt),
  }
}

/**
 * 记一笔钻石。**唯一**允许改动钻石余额的入口。
 *
 * 与 `postHarvest` 完全对称，只是换了张表。
 */
export async function postMall(
  entry: Omit<MallEntry, 'id' | 'balanceAfter' | 'createdAt'> & {
    id?: string
    createdAt?: number
  },
): Promise<MallEntry> {
  return db.transaction('rw', db.mallLedger, async () => {
    const row = mallRow(await mallTip(), entry)
    await db.mallLedger.put(row)
    return row
  })
}

/**
 * 扣一笔钻石，**在同一个事务里先验余额**。余额不够返回 `false`，一分不扣。
 *
 * ## 为什么不「先 `currentMallBalance()` 判断，再 `postMall()`」
 *
 * 那是把**守卫放在事务外面**：两次并发调用会各自读到同一个「够」，
 * 于是都扣 —— **超支**，而且每条 `balanceAfter` 都自洽、不报错。
 * `consumeItem` 的注释里记过一模一样的事故（库存 1 个时并发卖两次，
 * 返回 `[true, true]`）。**守卫和扣款必须在同一个事务里。**
 */
export async function spendMall(
  amount: number,
  entry: { source: MallSource; refId?: string; memo: string },
): Promise<boolean> {
  const cost = Math.round(amount)
  if (cost <= 0) return false
  return db.transaction('rw', db.mallLedger, async () => {
    const tip = await mallTip()
    if (tip.balance < cost) return false
    await db.mallLedger.put(mallRow(tip, { ...entry, delta: -cost }))
    return true
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
  soundEnabled: true,
  hapticsEnabled: true,
  onboardingDone: false,
  parentReviewEnabled: true,
  protectParentActions: true,
  redeemEnabled: true,
  /**
   * 道具掉落总开关。默认 **false**（2026-09-30 起）。
   *
   * 家长原话：「默认是没有掉落，因为已经有积分奖励了。」
   * 开着才会掉道具，而且**结算处真的会判**（不只是隐藏编辑页那一块）。
   * 见 `AppSettings.itemDropsEnabled` 的注释里那段历史。
   * `loadSettings` 会和 `DEFAULT_SETTINGS` 合并，所以老库里没这个字段也能拿到默认值。
   */
  itemDropsEnabled: false,
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
  /**
   * 当前正在玩的游戏。默认首款（农场）—— 见 `games/ids.ts` 的 `DEFAULT_GAME_ID`。
   *
   * 和别的设置一样，`loadSettings` 会和 `DEFAULT_SETTINGS` 合并，
   * 所以**老库里没有这个字段也能拿到默认值**，不需要数据迁移。
   */
  activeGame: DEFAULT_GAME_ID,
  farmClock: {
    timeScale: 1,
    showClock: true,
  },
  /**
   * 娃娃机的两个家长可调参数（2026-10-16）。
   *
   * 默认 1/3 中奖率 × 每只 2 商城币 ⇒ 每局期望 **0.67 商城币**。
   * 上限是 0.8（`CLAW_MAX_EXPECTED`），所以默认档留了余量。
   *
   * ⚠️ 为什么默认就低于上限而不是贴着上限：兑换商城里 `1 商城币 ≡ 1 积分`，
   * 而一局只花 1 积分 ⇒ 期望产出只要 ≥ 1，娃娃机就变成一台
   * 「坐着玩就能把积分刷上去」的机器。**0.67 是消费，1.0 是漏洞。**
   * 口径与夹紧见 `domain/clawEconomy.ts`（有全参数空间单测钉着）。
   */
  clawWinRate: CLAW_DEFAULT_WIN_RATE,
  clawExchangePerPrize: CLAW_DEFAULT_EXCHANGE,
  /** 娃娃机默认配色：0 = 粉（和参考实现的默认一致） */
  clawTheme: 0,
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
    },
  )
}
