/**
 * 插件契约 v2 —— **运行时装配**的边界（spec §12.5）。
 *
 * ## 和 v1（`registry.ts` 的 `GameDef` + `pages.ts` 的组件）差在哪
 *
 * v1 的游戏是**同一个 Vite 构建里**的一个 React 组件：注册表静态 import 它，
 * 打包时一起进 APK。v2 的游戏是**另一份构建产物**，运行时才下载 / 加载进来
 * —— 所以它不能是「一个 React 组件」（宿主和它可能有两份 React），
 * 只能是「**给我一个容器，我自己往里画**」：
 *
 * ```ts
 * const unmount = bundle.mount(container, hostApi)
 * ```
 *
 * 传「容器 + 纯数据 API」而不是传 React 组件，顺带解掉了 v1 那个环
 * （`useApp → registry → FarmPage → useApp`，见 `registry.ts` 头注释）——
 * 因为**宿主和插件之间不再有模块级的 import**，只有运行时的函数调用。
 *
 * ## 这个文件为什么零依赖
 *
 * 纯类型 + 常量。`store/useApp.ts` 要读它、`db.ts` 所在的层也可能要读它，
 * 所以**不许** import 任何 UI / 任何游戏 —— 否则又回到 v1 那个环。
 */

/**
 * 宿主 API 的版本。
 *
 * 游戏在 manifest 里声明 `minHostApi`；低于这个值的宿主**必须拒绝加载**
 * （见 `loader.ts` 的版本门）。
 *
 * ⚠️ 改这个数字的判据：**只要 `HostApi` 上「少了一个方法」或「改了一个签名」**，
 * 就要 +1。**加**一个方法不算破坏（老游戏不调用它），可以不加。
 * 没有这道门，一次游戏更新就能把宿主搞崩，而报错会指向宿主自己的代码。
 */
export const HOST_API = 1

/** 一款游戏的钱包参数 —— 家长要能看见（spec §4.4）。 */
export interface GameCoinDef {
  /** 这款游戏的币的 id（也是它在自己账目里的标识） */
  id: string
  name: string
  emoji: string
}

/** 经济参数 —— 和 v1 的 `GameDef` 一样，必须对家长可见。 */
export interface GameEconomy {
  /** 玩一次要花多少**积分** */
  playCost: number
  /** 期望产出（自己的币）。必须 < `playCost`，见 spec §5.4 */
  expectedPayout: number
  /** 通胀闸门：单件产出最多能卖出多少币（spec §5.3） */
  capPerPrize: number
}

/**
 * 插件清单。**必须是纯数据** —— 加载器会校验它的形状，
 * 形状不对就当加载失败（不猜、不兜底）。
 */
export interface GameManifestV2 {
  id: string
  name: string
  emoji: string
  /** 底部导航上的文字。≤3 字，多了会挤（spec §4.1） */
  tabLabel: string
  /** 语义化版本，用来判断「可更新」 */
  version: string
  /** 要求的最低宿主 API 版本，见 `HOST_API` */
  minHostApi: number
  coin: GameCoinDef
  economy: GameEconomy
}

/**
 * 宿主给插件的能力。**这是插件唯一能碰外面的口子。**
 *
 * ⚠️ 插件**不许**直接 import 宿主的 store / db —— 它是另一份构建，
 * 那些模块在它的产物里根本不存在。想加能力就在这里加一个方法，
 * 并想清楚「它会不会破坏 spec §2.2 的两条不可逆约束」。
 */
export interface HostApi {
  /** 当前积分余额（只读，给插件显示用）。 */
  balance(): number

  /**
   * 花掉积分。**唯一的扣分入口**，守卫和扣款在同一个事务里
   * （见 `db.ts` 的 `spendPoints`）。余额不够返回 `false`，一分不扣。
   */
  spendPoints(amount: number, memo: string): Promise<boolean>

  /** 铸一笔这款游戏自己的币。**只进不出**，且换不回积分（spec §2.2）。 */
  mintGameCoin(amount: number, memo: string): Promise<void>

  /**
   * 这款游戏的币的余额。**是算出来的，不是存出来的** ——
   * 宿主把它记在 `gameKv` 的保留键 `__coin` 里（一串 delta），
   * 余额 = 全部 delta 之和。理由同宿主的三套币：存一个 `balance` 字段
   * 就会出现「余额和流水对不上」，而且不报错。
   */
  gameCoinBalance(): Promise<number>

  /**
   * 这款游戏自己的键值存储（宿主表 `gameKv`，键自动带 `<gameId>:` 前缀）。
   *
   * 插件**看不到也碰不到别的游戏的数据** —— 命名空间由宿主拼，
   * 插件这边只给「自己的键」。
   *
   * ⚠️ **以 `__` 开头的键是宿主保留的**（`__bundle` 包代码 / `__coin` 币账本）：
   * `get` / `set` 会**抛**，`list` 会把它们滤掉。
   * 尤其别想着用 `set('__coin', ...)` 改自己的币 —— 币只能通过
   * `mintGameCoin()` 进（且只进不出），出口只有兑换商城。
   */
  storage: {
    get<T>(key: string): Promise<T | undefined>
    set(key: string, value: unknown): Promise<void>
    list(): Promise<Record<string, unknown>>
  }

  /** 顶栏浮层提示。宿主负责限流 / 上限（别绕过它自己画浮层）。 */
  pushToast(t: { kind: 'success' | 'warn' | 'info'; title: string; detail?: string }): void

  /** 轻触感（原生才有，Web 静默忽略）。 */
  haptic(): void

  /** 合成音效。 */
  tone(kind: 'success' | 'fail' | 'coin' | 'entry'): void
}

/**
 * 一个**已加载**的游戏包。
 *
 * `mount` 返回**卸载函数** —— 切走 / 卸载游戏时必须调用它，
 * 否则插件注册的定时器 / 事件监听会一直活着（在本项目里表现为
 * 「切回来以后 tick 跑了两遍」这种难查的问题）。
 */
export interface GameBundle {
  manifest: GameManifestV2
  mount(container: HTMLElement, host: HostApi): () => void
}

/**
 * 加载器对「包」的形状要求 —— 也是 `loader.ts` 校验的对象。
 *
 * 为什么不用 `GameBundle` 直接校验：`import()` 回来的是 `unknown`，
 * 校验要能回答「**具体哪里不对**」，所以校验函数逐字段检查，
 * 报错信息里带上字段名和实际值。
 */
export function describeManifestProblem(m: unknown): string | null {
  if (!m || typeof m !== 'object') return `manifest 不是对象（拿到 ${typeof m}）`
  const o = m as Record<string, unknown>
  const str = (k: string): string | null =>
    typeof o[k] === 'string' && (o[k] as string).length > 0 ? null : `manifest.${k} 必须是非空字符串`
  for (const k of ['id', 'name', 'emoji', 'tabLabel', 'version']) {
    const bad = str(k)
    if (bad) return bad
  }
  if (typeof o.minHostApi !== 'number' || !Number.isFinite(o.minHostApi)) {
    return `manifest.minHostApi 必须是数字（拿到 ${JSON.stringify(o.minHostApi)}）`
  }
  if (!o.coin || typeof o.coin !== 'object') return 'manifest.coin 缺失'
  if (!o.economy || typeof o.economy !== 'object') return 'manifest.economy 缺失'
  return null
}
