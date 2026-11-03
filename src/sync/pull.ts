import {
  clearGameCoinMirrors,
  db,
  listInstalledBundles,
  loadSettings,
  mirrorGameCoinBalance,
} from '../db/db'
import { pullCoinBalances } from '../online/coin'
import { pullGameKv } from '../online/kv'
import { board, listTasks } from '../api/task'
import { walletInfo, walletLedger } from '../api/wallet'
import { listRedeemRecords, listRedeemRows } from '../api/redeem'
import { listWishItems, listWishOrders } from '../api/wish'
import { getSession, getToken } from '../api/session'
import { pullSettings, type PullSettingsStatus } from '../online/settings'
import { importLegacyIfNeeded } from '../online/legacy'
import { adoptAccount, type AdoptResult } from '../online/adopt'
import {
  mapHarvest,
  mapInstance,
  mapLedger,
  mapRedeemItem,
  mapRedeemRecord,
  mapTask,
  mapWishOffer,
  mapWishOrder,
  SRV_REDEEM_RECORD_PREFIX,
  SRV_WISH_ORDER_PREFIX,
} from './map'

/* ============================================================
   在线版 · 拉取（服务端 → 本地 Dexie）
   ------------------------------------------------------------
   在线版的产品定义：**账号才是数据源，设备只是显示端**。
   所以这里的角色是「把服务端的真相搬进本地表」，搬完之后
   UI 一行都不用改 —— 它照旧读 Dexie。

   ★ 只替换 `srv_` 前缀的行，本地行一行不动。
     这条很重要：本地版和在线版共用同一套表，如果这里 `clear()` 整张表，
     切回本地版时孩子的数据就没了（而界面上什么都看不出来）。

   ★ 任何失败都**不抛**：拉取失败必须退回「用本地已有的数据」，
     否则一进 App 就白屏，而孩子只是没网。
   ============================================================ */

/**
 * 构建期开关。
 *
 * ★ 这个 worktree（`kid-quest-farm-online`）**默认就是服务器版**：
 *   数据以 `tf-platform-api` 为准，本地 Dexie 只是读缓存。
 *   要打一个「只在本机跑」的包，显式 `VITE_APP_MODE=local`。
 *
 * ★ 这是**分支级**的默认值，不是全局约定：
 *   `kid-quest-farm-2d`（本地版）那个分支上这一行写的是「默认 local」。
 *   两个分支各自演进、各自默认，**不靠人记得加环境变量**；
 *   但代价是合并回主分支时这一行会冲突 —— 那是有意为之，
 *   因为「默认用哪份数据」正是两个版本最根本的区别。
 */
export const APP_MODE: 'local' | 'online' =
  import.meta.env.VITE_APP_MODE === 'local' ? 'local' : 'online'

export const isOnlineMode = APP_MODE === 'online'

export interface PullResult {
  ok: boolean
  /** 没拉的原因（`local` = 本地版不需要拉；`no-session` = 没登录） */
  reason?: string
  tasks?: number
  instances?: number
  ledger?: number
  /** 兑换券流水（服务端 `coupon` 币种的行） */
  coupons?: number
  /** 兑换商品（`source === 'redeem'` 的那些，心愿行不算） */
  redeemItems?: number
  /** 兑换记录（**不含已取消的**，见 `mapRedeemRecord`） */
  redeemRecords?: number
  /** 心愿商城里「现在开放」的定价（**不含已关闭的**，见 `mapWishOffer`） */
  wishOffers?: number
  /** 心愿单（**含已取消的**，见 `mapWishOrder`） */
  wishOrders?: number
  /** 游戏币钱包（**只含开过钱包的游戏**，见 `pullCoinBalances`） */
  coins?: number
  /** 插件存档：写进本地的键数（**只拉已安装的游戏**） */
  kvKeys?: number
  /** 插件存档：拉失败的游戏数（没拥有 / 下架 / 网络） */
  kvFailed?: number
  /** 服务端报的余额，用来和本地求和比对 */
  balance?: number
  /**
   * 家长设置这一趟的结果：
   * `applied` 云端有、已写进本地；`pushed` 云端没有、把本机这份推上去了；
   * `kept` 没拉成也没推成；`stale` 读结果比本地写入旧，丢掉了；
   * `reset` 本地这份是上一个账号的，已重置成默认值（一个字都没推上去）。
   */
  settings?: PullSettingsStatus
  /**
   * 这台设备的本地缓存是不是换人了（见 `online/adopt.ts`）。
   * `switched` = 拉取之前已经把上一个人的云端镜像清掉了。
   */
  adopt?: AdoptResult
}

/** 删掉某一类 `srv_` 行（重拉时先清后写，保证服务端删掉的这里也跟着消失） */
async function clearSrvRows(
  table: 'tasks' | 'taskInstances' | 'ledger' | 'harvestLedger' | 'redeemRecords' | 'wishOrders',
  prefix: string,
) {
  const t = db[table]
  const keys = await t
    .filter((row: { id: string }) => row.id.startsWith(prefix))
    .primaryKeys()
  if (keys.length) await t.bulkDelete(keys as string[])
}

/**
 * 拉一次：任务定义 + 今日任务板 + 钱包 + 积分流水。
 *
 * @param opts.pageSize 流水拉多少条（服务端分页；默认 200，够积分页显示）
 */
export async function pullFromServer(opts: { pageSize?: number } = {}): Promise<PullResult> {
  if (!isOnlineMode) return { ok: true, reason: 'local' }
  if (!getToken()) return { ok: false, reason: 'no-session' }
  return pullOnce(opts)
}

/**
 * 真正的拉取动作（**不含**模式 / 登录态判断）。
 *
 * 单独导出是为了能单测：`isOnlineMode` 是构建期常量，测试里改不动它；
 * 而「拉取会不会把本地数据弄丢」这件事必须被验证，不能只靠肉眼。
 */
export async function pullOnce(opts: { pageSize?: number } = {}): Promise<PullResult> {
  /* 在外面声明：失败那条路也要把它带回去（`switched` 已经生效了，
     哪怕后面网络挂了，缓存也已经清干净）。 */
  let adopt: AdoptResult | undefined
  try {
    /* ★ 先认领缓存再发请求：换账号时「上一个人的任务 / 流水 / 心愿单」
       必须在我们写新数据之前消失。放在请求之后的话，中间那段
       （几百毫秒，断网时是**永久**）界面读到的还是上一个人的行。 */
    adopt = await adoptAccount(getSession()?.user.uid ?? null)

    /* 把本地版留下的旧账结转上去（见 `online/legacy.ts`）。
       ★ 必须在拉取**之前**：结转成功会删掉本机那几行，紧接着这一趟拉取
         才能把服务端那份（含刚搬上去的）读回来 —— 否则界面会短暂显示
         「余额突然变少」。★ 它自己不抛：结转失败不影响拉取。 */
    await importLegacyIfNeeded(adopt === 'first')

    // 三个请求并发：任务板本身会**懒生成**今天的实例，所以它必须在读实例之前完成
    const [b, tasks, wallet] = await Promise.all([
      board(),
      listTasks(false),
      walletInfo().catch(() => null), // 钱包挂了不该拖垮任务板
    ])
    /* 流水要**翻页拉全**，不能只要第一页。
       ★ 服务端 `Paginator` 的每页上限 200，而「本地余额 = 流水求和」——
         只拉第一页的话，老账号的余额会**凭空少一截**（少的是第一页之外那些
         早期的大额入账），界面上看不出任何异常。2026-11-02 实测踩到：
         账号攒到第 33 条流水后，本地余额比服务端少 124。 */
    const ledger = await pullLedger(opts.pageSize).catch(() => null)
    /* 兑换商城：商品和记录各一次。
       ★ 两个都用 `catch(() => null)`：商城挂了不该让「今天的任务」也拉不下来 ——
         孩子打开 App 是要做任务的，不是来逛商城的。
       ★ 商品用 `raw: true`：默认那套过滤是**给孩子看**的口径
         （换过的一次性商品、缺货的都不返回），拿它当数据源，
         家长管理页里那些商品会凭空消失 —— 见 `api/redeem.ts` 的注释。 */
    const redeemRows = await listRedeemRows({ includeArchived: true, raw: true }).catch(
      () => null,
    )
    const redeemRecs = await pullRedeemRecords().catch(() => null)
    /* 心愿商城：商品列表（只为拿「本家庭开不开放 + 券价」）+ 心愿单。
       ★ 商品列表用 `include_archived: true`：家长可能给一件后来下架的商品
         定过价，只拉在架的话那条定价就没了，孩子那单会退回「爸妈还没定价」。
       ★ 心愿单用 `asParent: true`：收货信息在孩子视角是脱敏的
         （手机 `****1234`、详细地址为空），家长那一屏要能发货。
         同一台设备、同一个账号，不为此多开一个接口。
       ★ 两个都 `catch(() => null)`：心愿挂了不该让今天的任务也拉不下来。 */
    const wishList = await listWishItems({ includeArchived: true }).catch(() => null)
    const wishOrders = await pullWishOrders().catch(() => null)
    /* 游戏币余额：只为一件事 —— 把服务端那个数镜像进 `gameKv['__coin']`，
       因为 `host.gameCoinBalance()` 读的是 Dexie（插件每帧都可能调）。
       ★ 它自己已经把异常收成 `null`（`pullCoinBalances`），失败不影响别的。 */
    const coinBals = await pullCoinBalances()

    const taskRows = tasks.list.map(mapTask)
    const instRows = b.instances.map(mapInstance)
    const ledgerRows = (ledger ?? [])
      .map(mapLedger)
      .filter((r): r is NonNullable<typeof r> => r !== null)
    /* 兑换券：同一份 `/wallet/ledger` 里的 `coupon` 行。
       ★ 不拉的话「卖菜得的券」只在服务端，本地兑换券页永远是空的，
         而余额却对得上（余额是求和的，含 srv 行）—— 看着像「流水丢了」。 */
    const harvestRows = (ledger ?? [])
      .map(mapHarvest)
      .filter((r): r is NonNullable<typeof r> => r !== null)
    const itemRows = (redeemRows?.list ?? [])
      .map(mapRedeemItem)
      .filter((r): r is NonNullable<typeof r> => r !== null)
    const recRows = (redeemRecs ?? [])
      .map(mapRedeemRecord)
      .filter((r): r is NonNullable<typeof r> => r !== null)
    const offerRows = (wishList?.list ?? [])
      .map(mapWishOffer)
      .filter((r): r is NonNullable<typeof r> => r !== null)
    const wishRows = (wishOrders ?? []).map(mapWishOrder)

    await db.transaction(
      'rw',
      [
        db.tasks,
        db.taskInstances,
        db.ledger,
        db.harvestLedger,
        db.redeemItems,
        db.redeemRecords,
        db.wishOffers,
        db.wishOrders,
        db.gameKv,
      ],
      async () => {
        await clearSrvRows('tasks', 'srv_task_')
        await clearSrvRows('taskInstances', 'srv_inst_')
        if (taskRows.length) await db.tasks.bulkPut(taskRows)
        if (instRows.length) await db.taskInstances.bulkPut(instRows)

        /* ⚠️ 下面三块都是「先清后写」，所以**只在拉取成功时才动**。
           拉失败了还照清不误的话，本地那张表会变成空的 —— 而这正是
           「拉取失败不能动本地已有数据」那条规矩要防的事。
           判据是「这次到底拉到没有」（`ledger !== null`），不是「数组空不空」：
           空数组 = 拉到了、服务端确实没有；`null` = 没拉到、不知道。 */
        if (ledger !== null) {
          await clearSrvRows('ledger', 'srv_ledger_')
          await clearSrvRows('harvestLedger', 'srv_ledger_')
          if (ledgerRows.length) await db.ledger.bulkPut(ledgerRows)
          if (harvestRows.length) await db.harvestLedger.bulkPut(harvestRows)
        }

        if (redeemRows !== null) {
          /* ★ 兑换商品这张表在在线版里**整张清掉**，不是只清 `srv_` 行。
             理由和别的表不同：兑换品的 id 就是服务端给的那个字符串（没有前缀），
             没法从 id 上分辨「这行是不是云端来的」。而在线版里这张表**只可能**
             有云端数据 —— 播种（`seedIfEmpty`）在在线模式下一个字节都不写，
             写接口又全是写穿（失败不落本地）。所以清空它不会删掉任何
             「只在本机存在」的东西。 */
          await db.redeemItems.clear()
          if (itemRows.length) await db.redeemItems.bulkPut(itemRows)
        }

        if (redeemRecs !== null) {
          await clearSrvRows('redeemRecords', SRV_REDEEM_RECORD_PREFIX)
          if (recRows.length) await db.redeemRecords.bulkPut(recRows)
        }

        if (wishList !== null) {
          /* ★ 定价表**整张清掉**，理由和兑换品表一样：主键 `itemId` 是
             服务端给的字符串（没有前缀），分不出「这行是不是云端来的」。
             而在线版里这张表**只可能**有云端数据 —— 播种在在线模式下
             一个字节都不写，写接口又全是写穿（失败不落本地）。
             切回本地版时这张表会被 `wipeAll` / 导入覆盖，不会留下幽灵行。 */
          await db.wishOffers.clear()
          if (offerRows.length) await db.wishOffers.bulkPut(offerRows)
        }

        if (wishOrders !== null) {
          await clearSrvRows('wishOrders', SRV_WISH_ORDER_PREFIX)
          if (wishRows.length) await db.wishOrders.bulkPut(wishRows)
        }

        /* 游戏币镜像：**整表清掉再写**。
           `/game/coin/list` 只返回**开过钱包**的游戏 —— 不清的话，某款游戏
           在服务端被清零 / 钱包行没了，本地镜像还留着旧数字，孩子看到的币
           比服务端多，而且**没有任何地方会报错**。
           为什么敢整表清：在线版里 `__coin` 只可能是镜像（写接口全是写穿，
           播种在在线模式下一个字节都不写）。 */
        if (coinBals !== null) {
          await clearGameCoinMirrors()
          for (const c of coinBals) await mirrorGameCoinBalance(c.game_id, c.balance)
        }
      },
    )

    /* 插件存档：**只拉已安装的游戏**。
       ★ 为什么要 `catch` 每个游戏：一款游戏没拥有（`10040401`）或下架了，
         不该让别的游戏的存档也拉不下来 —— 那会让「今天玩的那个游戏读不到档」，
         而真正的原因在另一个游戏身上。
       ★ 为什么放在大事务**外面**：`pullGameKv` 是逐键写的，中途失败会把整个
         事务连累掉 —— 那样连任务和积分都回滚，代价完全不成比例。 */
    /* 家长设置：整份 JSON 的一读一写。
       ★ 放在大事务**外面**：它只写 `meta.settings` 这一行，和上面那些表无关；
         失败了也只是「这次没拉到」，不该连累任务和积分。
       ★ 用 `loadSettings()` 而不是直接读 meta：要拿「合并过默认值」的那份。
         直接读 meta 的话，老账号第一次上云的 payload 会缺字段
         （`undefined` 会被 `JSON.stringify` 直接丢掉），换台设备就少几项。
       ★ 不 `catch` 到 `null` 就完事：`pullSettings` 自己把「云端为空」和
         「读失败」分开了 —— 前者要把本机推上去，后者必须什么都不做。 */
    let settingsStatus: PullSettingsStatus | undefined
    try {
      settingsStatus = await pullSettings(await loadSettings())
    } catch (e) {
      console.warn('[sync] 家长设置没拉到：', (e as { message?: string })?.message)
    }

    const kv = { keys: 0, failed: 0 }
    const installed = await listInstalledBundles()
    for (const g of installed) {
      try {
        const r = await pullGameKv(g.gameId)
        kv.keys += r.written
      } catch (e) {
        kv.failed++
        console.warn(`[sync] ${g.gameId} 的存档没拉到：`, (e as { message?: string })?.message)
      }
    }

    return {
      ok: true,
      kvKeys: kv.keys,
      kvFailed: kv.failed,
      tasks: taskRows.length,
      instances: instRows.length,
      ledger: ledgerRows?.length ?? 0,
      coupons: harvestRows.length,
      redeemItems: itemRows?.length ?? 0,
      redeemRecords: recRows?.length ?? 0,
      wishOffers: offerRows?.length ?? 0,
      wishOrders: wishRows?.length ?? 0,
      coins: coinBals === null ? undefined : coinBals.length,
      balance: wallet?.points ?? b.balance,
      settings: settingsStatus,
      adopt,
    }
  } catch (e) {
    // 网络 / 401 / 服务端 5xx 都走这里：保留本地数据，不抛
    return {
      ok: false,
      reason: (e as { message?: string })?.message ?? 'pull-failed',
      adopt,
    }
  }
}

/** 服务端 `Paginator` 的每页上限（`constant.MAX_PAGE_SIZE`） */
const PAGE = 200
/** 翻页保险丝：2000 条流水够一个家庭用好几年，再多多半是接口坏了 */
const MAX_PAGES = 10

/**
 * 把流水翻页拉全。
 *
 * ⚠️ 别「只要一页」—— 本地余额是**流水求和**（`currentBalance`），
 * 少一页就是余额少一截，而且不报错。
 * ⚠️ 停在 `list.length < PAGE` 上，不是停在 `out.length >= count`：
 * `count` 是服务端算的，中途有别的设备记账时它会变；按页长判更稳。
 */
async function pullLedger(pageSize?: number) {
  const size = Math.min(pageSize ?? PAGE, PAGE)
  const out: Awaited<ReturnType<typeof walletLedger>>['list'] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await walletLedger(page, size)
    out.push(...r.list)
    if (r.list.length < size) break
  }
  return out
}

/** 兑换记录翻页拉全（同一个理由：家长管理页的「待兑现」不能漏） */
async function pullRedeemRecords() {
  const out: Awaited<ReturnType<typeof listRedeemRecords>>['list'] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await listRedeemRecords(page, PAGE)
    out.push(...r.list)
    if (r.list.length < PAGE) break
  }
  return out
}

/**
 * 心愿单翻页拉全。
 *
 * ⚠️ 分页参数是 `pageSize`（驼峰）—— 写成 `page_size` 只会永远返回 30 条，
 * 而且**不报错**（见 `api/wish.ts` 的 `listWishOrders` 注释）。
 * 症状是「家长心愿页的待办少了几条，孩子那边确实还欠着」。
 */
async function pullWishOrders() {
  const out: Awaited<ReturnType<typeof listWishOrders>>['list'] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const r = await listWishOrders({ page, pageSize: PAGE, asParent: true })
    out.push(...r.list)
    if (r.list.length < PAGE) break
  }
  return out
}
