/**
 * `HostApi` 的实现 —— 把宿主的能力包成插件能用的那几个方法（spec §12.5）。
 *
 * ## 这里最重要的一条：插件的币也要「算出来」，不能「存出来」
 *
 * 宿主的三套币（积分 / 丰收币 / 商城币）都是「余额 = 账本 delta 之和」，
 * 从来不存 `balance` 字段。插件的币**必须照这个模式**，否则会出现
 * 「余额和流水对不上」—— 而且**不报错**（本项目在 `Task`/`TaskInstance`
 * 上已经吃过一次「同一个事实存两份」的亏）。
 *
 * 插件的币账本就住在 `gameKv` 的保留键 `__coin` 里（一个 `{delta, memo, at}` 数组）。
 * 为什么用保留键而不是另开一张表：表必须**编译期声明**，而下载来的游戏
 * 是运行时才出现的（见 `db.ts` 的 `this.version(7)` 注释）。
 *
 * ## 命名空间由**宿主**拼
 *
 * 插件只给「自己的键」，`${gameId}:` 前缀由 `db.gameKvKey` 拼。这样插件
 * 既不可能读到别的游戏的数据，也不可能因为自己拼错前缀而静默写到别处。
 */

import { getGameKv, listGameKv, setGameKv, spendPoints } from '../db/db'
import { hapticLight, playTone } from '../platform/files'
import type { HostApi } from './plugin'

/** 插件币账本在 `gameKv` 里的保留键。**前缀由宿主加，插件看不到这个字符串。** */
const COIN_KEY = '__coin'

/**
 * ★★ **宿主保留的键前缀：插件一律不许碰。**
 *
 * `gameKv` 这张表同时装着两种东西：
 *   · 插件自己的键（`draws` / `score` …）—— 归插件；
 *   · 宿主替它代管的键（`__bundle` 包代码 / `__coin` 币账本）—— 归宿主。
 *
 * 不隔离的话有**两个真问题**（2026-10-15 走查脚本第一次跑就撞上了）：
 *
 * ① `storage.list()` 会把 `__bundle` 一起返回 —— 插件枚举自己的状态时
 *    会看到「我自己的源码」这一项，莫名其妙（而且它是整份包体，白白读一遍）。
 * ② 更严重：`storage.set('__coin', [])` 能把**自己的币账本清空**。
 *    `mintGameCoin` 特意拒绝 `n <= 0`（插件不该有「销毁自己的币」这条能力，
 *    币的出口只有兑换商城）—— 而这条后门正好绕过那个守卫。
 *    它不会伤到宿主（账本在插件自己的命名空间里），但它**破坏契约**，
 *    而且不报错：症状是「我的币突然清零了」。
 *
 * 所以 `get` / `set` 对保留键**直接抛**（不静默忽略 —— 那是插件的 bug，
 * 必须让它看得见），`list` 把它们滤掉。
 */
const RESERVED_PREFIX = '__'

function assertNotReserved(key: string): void {
  if (key.startsWith(RESERVED_PREFIX)) {
    throw new Error(
      `storage 的键不能以 "${RESERVED_PREFIX}" 开头（"${key}" 是宿主保留的）—— ` +
        `币请走 host.gameCoinBalance() / host.mintGameCoin()`,
    )
  }
}

interface CoinEntry {
  delta: number
  memo: string
  at: number
}

/** 读某款游戏的币账本。脏数据（不是数组）一律当空账 —— 不炸。 */
async function readCoinLedger(gameId: string): Promise<CoinEntry[]> {
  const raw = await getGameKv<unknown>(gameId, COIN_KEY)
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (e): e is CoinEntry =>
      !!e && typeof e === 'object' && typeof (e as CoinEntry).delta === 'number',
  )
}

/**
 * 造一个绑定到某款游戏的 `HostApi`。
 *
 * `getBalance` / `pushToast` / 音效开关都从 store 现读 —— **不要在造的时候
 * 把余额快照进去**，那样插件看到的是一个永远不变的旧余额（本项目里
 * 「同一个事实存两份」的经典形态）。
 */
export function makeHostApi(deps: {
  /** 现读当前积分余额 */
  getBalance: () => number
  /** 扣分之后让 store 刷新（余额、账本都要重新算） */
  refresh: () => Promise<void>
  pushToast: (t: {
    kind: 'success' | 'warn' | 'info'
    title: string
    detail?: string
  }) => void
  soundEnabled: () => boolean
  hapticsEnabled: () => boolean
}): (gameId: string) => HostApi {
  return (gameId: string): HostApi => ({
    balance: () => deps.getBalance(),

    spendPoints: async (amount, memo) => {
      const ok = await spendPoints(amount, {
        // 插件花钱统一记 `game_spend`，`refId` 带上是谁花的 ——
        // 否则家长看到一笔「-10」不知道是哪款游戏扣的。
        source: 'game_spend',
        refId: gameId,
        memo,
      })
      if (ok) await deps.refresh()
      return ok
    },

    mintGameCoin: async (amount, memo) => {
      const n = Math.round(amount)
      // 负数 / 0 一律不写。插件不该有「销毁自己的币」这条能力 ——
      // 币的出口**只有**兑换商城（spec §2.2 的两条不可逆约束）。
      if (n <= 0) return
      const ledger = await readCoinLedger(gameId)
      ledger.push({ delta: n, memo, at: Date.now() })
      await setGameKv(gameId, COIN_KEY, ledger)
      await deps.refresh()
    },

    gameCoinBalance: async () => {
      const ledger = await readCoinLedger(gameId)
      return ledger.reduce((sum, e) => sum + e.delta, 0)
    },

    storage: {
      /**
       * ⚠️ 两个方法都写成 `async`，**即使里面没有 await**。
       *
       * 契约上它们返回 `Promise`。如果 `assertNotReserved` 在普通函数里同步抛，
       * 调用方写 `host.storage.set(k, v).catch(...)` 就**永远接不到**这个错
       * —— 异常在拿到 promise 之前就飞出去了，变成一个未捕获的同步异常。
       * `async` 让「契约说返回 Promise」和「失败也是 Promise 拒绝」一致。
       * （2026-10-15 单测第一次跑就是这么红的。）
       */
      get: async <T,>(key: string): Promise<T | undefined> => {
        assertNotReserved(key)
        return getGameKv<T>(gameId, key)
      },
      set: async (key: string, value: unknown): Promise<void> => {
        assertNotReserved(key)
        await setGameKv(gameId, key, value)
      },
      list: async () => {
        const all = await listGameKv(gameId)
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(all)) {
          if (!k.startsWith(RESERVED_PREFIX)) out[k] = v
        }
        return out
      },
    },

    pushToast: deps.pushToast,

    haptic: () => {
      void hapticLight(deps.hapticsEnabled())
    },

    tone: (kind) => {
      playTone(deps.soundEnabled(), kind)
    },
  })
}
