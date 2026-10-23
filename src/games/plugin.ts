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
 *
 * 2026-10-22 → **2**：加了 `buyGameCoin` / `spendGameCoin`。
 * 严格按上面那条判据，加方法不算破坏，本可以停在 1；但**插件侧需要它**：
 * 一个真的要靠自己的币运转的游戏（奖品公园）必须声明「宿主至少得有这两扇门」，
 * 否则它会在 API=1 的宿主上跑起来、然后在「开局扣币」那里静默失败
 * （`host.spendGameCoin` 是 undefined → TypeError → 玩家点了没反应）。
 * 老插件声明的是 `minHostApi: 1`，2 ≥ 1 照样加载，所以这次 +1 不会踢掉任何现有包。
 *
 * 2026-10-22 晚 → **3**：三件事一起改，任何一件单拎出来都不算破坏，
 * 合起来是一次**契约升级**，所以按「改了一个签名」计：
 *
 *   ① `mount` 的返回值放宽成 `Unmount | Promise<Unmount>`（见 `GameBundle.mount`）。
 *      3D 游戏必须在建场景前 await 资源，旧契约逼每个插件自己写
 *      「同步壳 + disposed 闸」——第一个真插件（奖品公园）就违反了它。
 *      宿主现在会 await，所以「异步 mount」从"违规"变成"合法但要自己收干净"。
 *   ② `mount` 多一个 `ctx: MountContext`（资源根 / 语言）。没有它，
 *      插件只能自己猜资源路径 —— 本地包和远程包的路径**必然不一样**。
 *   ③ 新增 `redeemGameCoin()`：游戏币 → **兑换券**的唯一出口。
 *      没有它，「积分 → 游戏币 → 兑换券」这条链在插件侧是断的
 *      （币只进不出，玩家攒一堆花不掉，那个"币"就没有意义）。
 *
 * ⚠️ 加参数（②）和放宽返回类型（①）本身不破坏老插件：老插件不读第三个
 * 参数、同步返回函数，照样跑。**但 ③ 是真新增**，声明了 `minHostApi: 3`
 * 的插件才敢调它。所以这次 +1 的实际作用是「给新插件一个版本号可用」。
 *
 * 2026-10-23 → **4**：新增 `mintVoucher()`（抓到奖品直接发兑换券）。
 * 同样是「加方法」，同样不算破坏 —— 但奖品公园 1.5.0 起要靠它结算回收，
 * 它必须能声明「宿主至少得有这么一扇门」，否则在老宿主上
 * `host.mintVoucher` 是 undefined → TypeError → 卖娃娃点了没反应。
 */
export const HOST_API = 4

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
  /**
   * **1 个游戏币能换多少兑换券**。`0` / 不写 = 不开放兑换。
   *
   * ## 为什么兑换率必须写在 manifest 里，而不是插件调 API 时传
   *
   * `host.redeemGameCoin(count)` 只收「换几个」，汇率由宿主从**已安装的
   * manifest** 里读。理由：
   *   · 汇率是**家长看得见**的参数（设置页会显示），它必须和包里声明的一致；
   *   · 如果让插件传汇率，一个写错的插件就能传 1000 —— 而它不会报错，
   *     只会静默把兑换券印出来。宿主读自己存下来的那份，等于把这道闸门
   *     放在插件够不着的地方。
   *
   * ## 上限定多少
   *
   * 兑换券 ≡ 1 积分（兑换商城的口径）。所以「一局能刷出多少兑换券」
   * 必须 < `playCost`，否则就是「坐着玩就能刷积分」。
   * 判据：`expectedPayout × voucherPerCoin < playCost`。
   * 这条不变量在 `domain/pluginEconomy.ts` 里有单测钉着。
   */
  voucherPerCoin?: number
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
   * **花掉这款游戏自己的币**（玩一局）。守卫和扣款在同一个事务里，
   * 余额不够返回 `false`，一个币不扣。
   *
   * 为什么要给插件这扇门：内置娃娃机走的是 `db.spendGameCoin`，插件没有对应能力
   * 的话，它的币就**只进不出** —— 玩家抓着抓着币越来越多，却永远花不掉，
   * 那个「币」也就没有意义了。
   *
   * ⚠️ 它和 `mintGameCoin` 是一对反向门，**不是**「币能换回积分」那条路：
   * 扣掉的币只是消失（消费），不会变回任何别的币。
   */
  spendGameCoin(amount: number, memo: string): Promise<boolean>

  /**
   * **把游戏币换成兑换券** —— 整条链的最后一跳（spec §2.2）。
   *
   * ```
   *   积分 ──buyGameCoin──▶ 游戏币 ──redeemGameCoin──▶ 兑换券
   *                            ▲
   *                            └──mintVoucher── 抓到奖品（直接发券，不经过币）
   * ```
   *
   * `count` 个币被**烧掉**（写一笔负数），按 manifest 的
   * `economy.voucherPerCoin` 发兑换券。**汇率不由调用方传** —— 见
   * `GameEconomy.voucherPerCoin` 的注释。
   *
   * @returns 实际发出的兑换券数量。`0` = 没换（币不够 / 这款游戏没开放兑换）。
   *
   * ⚠️ 三件事在**同一个事务**里：读币账本 → 写负数 → 写兑换券账本。
   *   拆开就会出现「币扣了、券没发」，而且不报错。
   * ⚠️ 兑换券 ⇸ 积分，所以这条链**有去无回**：不能拿兑换券买币。
   */
  redeemGameCoin(count: number, memo: string): Promise<number>

  /**
   * **抓到奖品直接发兑换券** —— 不经过游戏币（HOST_API 4）。
   *
   * 内置娃娃机就是这么结算的（`useApp.settleClawRound`：扣 1 币 + 发券在同一个
   * 事务里）。插件里「娃娃 → 币 → 券」那种写法会让币多一个来源，而币能直接开局
   * ⇒ 抓娃娃本身能续玩，等于把「坐着玩」那条回路又接回来。
   *
   * 所以：**币是入场券（买来的），券是战利品（抓来的）**，两者不互通。
   * 玩家手里剩下的币仍然可以 `redeemGameCoin` 换成券（那是「没用完的入场券」）。
   *
   * @returns 实际发出的兑换券数量。`0` = 没发（数量非法）。
   *
   * ⚠️ 为什么不让插件「自己 mint 币再 redeem」：两个事务，中间崩一下就是
   *   「币还在」—— 而币能开局，正好是要堵的那条回路。
   * ⚠️ 兑换券 ⇸ 积分（spec §2.2），所以这条也只是「有去无回」的终点。
   */
  mintVoucher(count: number, memo: string): Promise<number>

  /**
   * **用积分买这款游戏的币** —— 扣积分和记币在**同一个事务**里。
   *
   * `count` 个币，每个 `pointsPerCoin` 积分。积分不够返回 `false`，
   * **一分不扣、一个币不发**。
   *
   * ⚠️ 为什么不是「插件自己调 `spendPoints` + `mintGameCoin`」：那是两个独立事务，
   * 中间崩一下就是「积分扣了、币没到」，孩子白丢积分而且不报错。
   * 宿主这边有 `db.buyGameCoins` 的嵌套事务兜住（见那里的注释）。
   */
  buyGameCoin(count: number, pointsPerCoin: number, memo: string): Promise<boolean>

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
 * 卸载函数。**必须真的把东西收干净** —— 定时器 / 监听 / rAF /
 * WebGL context / 物理 world 都不会自己消失。
 *
 * 返回 Promise 是给「卸载也要 await（比如关音频、落盘）」的插件用的；
 * 宿主会 `await` 它，但**不会**因为它是 Promise 就不调。
 */
export type Unmount = () => void | Promise<void>

/**
 * 挂载上下文 —— **宿主告诉插件「东西在哪」的那一层**。
 *
 * ## 为什么它必须由宿主给，不能让插件自己猜
 *
 * 同一个包在三种形态下资源路径完全不同：
 *
 * | 形态 | 资源在哪 | assetBase |
 * | --- | --- | --- |
 * | 本地内置（随 App 发布） | `public/games/<id>/` | `/games/<id>/` |
 * | 远程下载（CDN） | 发布方的静态服务器 | `https://cdn…/<id>/` |
 * | 远程 + 装到 Filesystem | 手机本地目录 | `convertFileSrc(uri)` |
 *
 * 插件在 `blob:` 模块里跑，**相对路径会以 blob: 为基准解析** ⇒ 全 404。
 * 所以它只能问宿主。`assetUrl()` 是唯一正确的拼法。
 */
export interface MountContext {
  /**
   * 资源根，**以 `/` 结尾**。可能为空串（宿主没配资源）。
   *
   * ⚠️ 空串 ≠ 「用相对路径」：空串时 `assetUrl('a.webp')` 仍然是 `a.webp`，
   * 会相对**文档**解析。所以插件应该**总是**用 `assetUrl()`，不要自己拼。
   */
  assetBase: string
  /**
   * 把包内相对路径拼成可加载的绝对地址。
   *
   * `assetUrl('assets/x.webp')` / `assetUrl('./assets/x.webp')` 都认。
   * 宿主负责处理 `blob:` / `file://` / CDN 前缀的差别。
   */
  assetUrl(rel: string): string
  /** 宿主语言（`zh` / `en` …）。插件没有自己的语言选择时用它。 */
  locale: string
}

/**
 * 一个**已加载**的游戏包。
 *
 * ## `mount` 的返回值：同步函数 **或** Promise
 *
 * ```ts
 * const unmount = bundle.mount(container, hostApi, ctx)   // 也可能返回 Promise<Unmount>
 * ```
 *
 * ★ 2026-10-22 放宽的（HOST_API 3）。旧契约要求**同步**返回卸载函数，
 * 于是每个需要异步加载的插件都得写「先同步建壳、再 async init、用 disposed
 * 挡回来」那一套 —— 第一个真插件（3D 娃娃机，要 await 纹理和物理 wasm）
 * 就直接违反了它，而**测试照不出来**（测试里 `await mount()` 一样能拿到函数）。
 * 现在宿主 `mountBundle` 两种都收：`typeof r === 'function' ? r : await r`。
 *
 * ⚠️ 异步 mount 的代价：**卸载函数落地之前，容器是空的**。所以
 *   ① 别在 mount 里做需要用户等待超过 ~2s 的事（要有自己的加载画面）；
 *   ② `unmount` 必须能在「刚建好就被调用」的情况下安全执行
 *      （孩子秒切 tab 时，宿主会在 Promise 落地的**同一拍**调它）。
 */
export interface GameBundle {
  manifest: GameManifestV2
  mount(container: HTMLElement, host: HostApi, ctx: MountContext): Unmount | Promise<Unmount>
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
