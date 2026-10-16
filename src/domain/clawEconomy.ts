/**
 * 娃娃机的经济模型 —— **纯函数，零依赖，可单测**。
 *
 * ---------------------------------------------------------------------------
 * ★★ 唯一一条不能破的不变量：**每局的期望产出必须 < 1**
 * ---------------------------------------------------------------------------
 *
 * 兑换商城的付款口写着 `1 点券 ≡ 1 积分`（`redeem.ts` 的 `planRedeemPayment`：
 * 先用光点券，差额用积分补）。而娃娃机是 **1 积分买 1 个币、1 个币玩 1 局**。
 *
 * 把这两件事接起来看：
 *
 * ```
 *   花掉 1 积分  →  期望拿回 E 点券  →  在兑换口 E 点券 ≡ E 积分
 *   ⇒ 净收益 = E − 1（积分当量）
 * ```
 *
 * **只要 E ≥ 1，娃娃机就是一台把积分变多的机器** —— 孩子不用做任务，
 * 坐着玩就能把积分刷上去，而且**没有任何报错**，只会看到商城里的东西越来越便宜。
 *
 * ➜ 所以这里硬性要求 `E ≤ CLAW_MAX_EXPECTED`（0.8，留 20% 安全边际）。
 *   `E < 1` 还不够 —— 只要求「不大于 1」的话，以后任何一次微调都会滑到
 *   「等于 1」甚至「大于 1」，而那正好是唯一危险的那一侧。
 *   （这正是 skill `game-economy-balance` §1 说的：安全边际不是可选项。）
 *
 * 娃娃机是**消费**，不是收入来源。孩子花积分买的是「玩」这件事本身，
 * 娃娃只是偶尔的惊喜。真实商场的娃娃机也是这个账。
 *
 * ---------------------------------------------------------------------------
 * ★★ 随机必须幂等 —— 同一次投币，刷不刷新都得是同一个结果
 * ---------------------------------------------------------------------------
 *
 * 不许用 `Math.random()`。理由不是「可复现性好听」，而是：
 * 用 `Math.random()` 的话，孩子抓到娃娃→**刷新页面**→没抓到，或者反过来，
 * 一直刷到中为止。中奖率就失效了，E 也跟着失效。
 *
 * ➜ 用「这一局是第几局」当 seed 算一个确定性伪随机。
 *   局数只在**结算之后**才 +1 ⇒ 中途刷新会算出**同一个结果**（公平），
 *   而下一局一定是新的结果。
 *
 * 这套写法来自 skill `game-economy-balance` §4。
 */

/**
 * 玩一局要花多少积分。
 *
 * 家长 2026-10-16 定：「一积分买一个币」。**刻意不做成可配的** ——
 * 它是那条不变量的分母，家长不该能改。
 */
export const CLAW_PLAY_COST = 1

/** 每买到 1 个币要花多少积分。1:1 —— 和 `CLAW_PLAY_COST` 是同一个事实，别各写一份。 */
export const CLAW_POINTS_PER_COIN = 1

/**
 * 游戏币的**显示名**。
 *
 * ⚠️ 这两个常量放在这里而不是页面里，是因为它们有**两个读者**：
 * 孩子端（`features/claw/ClawPage.tsx`）和家长端
 * （`features/settings/ClawEconomyCard.tsx`）。各写一份的话，
 * 改名字时必然只改一处，然后孩子看到的币和家长看到的币不是同一个名字，
 * 而且**不报错**（本项目在 `Card` 上吃过这个亏，见 `settings/ui.tsx` 的注释）。
 *
 * ⚠️ emoji **故意不是** 🪙 / 🎟️ / 🛍️ 里的任何一个 —— 那三个分别是
 * 积分 / 点券 / 商城币（`domain/currency.ts`）。游戏币是**第四种东西**，
 * 借用其中任何一个，都会在同一屏上和真正的那个币长得一模一样。
 */
export const CLAW_COIN_NAME = '娃娃机币'
export const CLAW_COIN_EMOJI = '🕹️'

/** 默认中奖率（约 1/3）。手感上「不算难，但也不白给」。 */
export const CLAW_DEFAULT_WIN_RATE = 1 / 3

/** 默认：每抓到一只娃娃兑换 2 点券。 */
export const CLAW_DEFAULT_EXCHANGE = 2

/**
 * 每局期望产出的**硬上限**（点券）。
 *
 * 0.8 而不是 1：留 20% 的安全边际。理由见文件头 ——
 * 「不大于 1」这一侧是悬崖，边际必须留在悬崖**里面**。
 */
export const CLAW_MAX_EXPECTED = 0.8

/** 浮点比较用的容差。`0.25 × 3 = 0.75` 这种要能稳定通过。 */
const EPS = 1e-9

/** 家长能选的**中奖率档位**。都是「几分之一」，孩子和家长都好理解。 */
export const CLAW_WIN_RATE_CHOICES = [
  { value: 1 / 2, label: '1/2' },
  { value: 1 / 3, label: '1/3' },
  { value: 1 / 4, label: '1/4' },
  { value: 1 / 5, label: '1/5' },
] as const

/** 家长能选的**每只兑换多少点券**。 */
export const CLAW_EXCHANGE_CHOICES = [1, 2, 3, 5] as const

/**
 * 「已经玩过多少局」在 `gameKv` 里存的键（值是一个整数）。
 *
 * ⚠️ 它**同时是下一局的 seed 来源**（`clawResolveRound(index, …)`），
 * 所以只能**在结算之后 +1**。中途刷新时它没变 ⇒ 算出同一个结果（公平），
 * 下一局才是新结果。见文件头「随机必须幂等」。
 */
export const CLAW_PLAYS_KEY = 'plays'

/** 娃娃机的那两个家长可调参数。 */
export interface ClawEconomy {
  /** 中奖率，0~1 */
  winRate: number
  /** 每抓到一只娃娃兑换多少点券 */
  exchangePerPrize: number
}

/**
 * 一局的期望产出（点券）。
 *
 * ```
 *   E = 中奖率 × 每只兑换数
 * ```
 *
 * 只有两个因子，而且**都是家长可调的** —— 所以必须在设置界面里
 * 把 E 实时算给家长看，而不是藏在代码里。
 */
export function clawExpectedCoupons(e: ClawEconomy): number {
  return e.winRate * e.exchangePerPrize
}

/** 这个参数组合安全吗（E 不超过硬上限）。 */
export function clawEconomyIsSafe(e: ClawEconomy): boolean {
  return clawExpectedCoupons(e) <= CLAW_MAX_EXPECTED + EPS
}

/** 给家长看的一句话解释：这个组合为什么不能用。 */
export function clawEconomyProblem(e: ClawEconomy): string | null {
  if (!Number.isFinite(e.winRate) || !Number.isFinite(e.exchangePerPrize)) {
    return '参数不是有效数字'
  }
  if (e.winRate <= 0 || e.winRate > 1) return '中奖率要在 0 和 1 之间'
  if (e.exchangePerPrize < 1) return '每只至少兑换 1 点券'
  if (clawEconomyIsSafe(e)) return null
  const pct = Math.round(e.winRate * 100)
  const e2 = clawExpectedCoupons(e)
  return (
    `中奖率 ${pct}% × 每只 ${e.exchangePerPrize} 点券 = 平均每局 ${e2.toFixed(2)} 点券，` +
    `超过了上限 ${CLAW_MAX_EXPECTED}。再高的话，孩子坐着玩就能把点券刷上去，` +
    `做任务反而成了最慢的路。`
  )
}

/**
 * 把家长填的参数**收进安全范围**。
 *
 * ⚠️ 两个参数是**乘在一起**的，所以「夹住哪一个」没有唯一答案 ——
 * 而且**只夹一个是不够的**：
 *
 *   中奖率 = 1 时，`0.8 ÷ 1 = 0`，兑换数向下取整就是 0。
 *   但「兑换 0 点券」等于赢了也白赢（`exchangePerPrize >= 1` 是硬下限），
 *   于是一路 `Math.max(1, …)` 兜回来 ⇒ 兑换数 1 ⇒ **E = 1，不安全**。
 *
 * 这是单测真的抓出来的（`clamp({winRate: 1, exchangePerPrize: 99})` 返回了
 * `{1, 1}`，E = 1）。所以**两边都要夹**：
 *
 *   ① 先按中奖率压兑换数；
 *   ② 再按压好的兑换数回头压中奖率。
 *
 * 顺序有讲究：先压兑换数是为了**尽量不动中奖率**（中奖率是孩子的手感，
 * 被悄悄改掉会立刻显得「这机器坏了」）。只有中奖率自己就装不下任何兑换数时，
 * 才会走到第 ② 步去动它。
 */
export function clampClawEconomy(e: ClawEconomy): ClawEconomy {
  const wanted = Math.max(1, Math.round(e.exchangePerPrize))
  const winRateIn = Math.min(1, Math.max(0.01, e.winRate))
  // ① 这个中奖率最多配得起多大的兑换数（下限 1 —— 赢了必须有东西拿）
  const maxExchange = Math.max(1, Math.floor((CLAW_MAX_EXPECTED + EPS) / winRateIn))
  const exchangePerPrize = Math.min(wanted, maxExchange)
  // ② 反过来：这个兑换数之下，中奖率的上限是多少
  const maxWinRate = (CLAW_MAX_EXPECTED + EPS) / exchangePerPrize
  const winRate = Math.min(winRateIn, maxWinRate)
  return { winRate, exchangePerPrize }
}

/**
 * 确定性伪随机：同 seed 同结果。
 *
 * 用的是那个经典的 `sin` 哈希 —— 不追求密码学强度，只要求
 * **同一个输入永远给同一个输出**、且分布看起来均匀。
 */
export function hashRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * 把业务标识拼成一个稳定的整数 seed。
 *
 * 用业务 id（而不是时间戳）保证**跨会话一致** —— 同一次投币，
 * 关掉 App 再打开算出来的还是同一个结果。
 */
export function seedOf(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 100000
}

/** 一局的结果。 */
export interface ClawRound {
  /** 这一局是第几局（从 0 开始）—— 也是 seed 的来源 */
  index: number
  /** 抓到了没有 */
  won: boolean
  /** 抓到的话兑换多少点券，没抓到是 0 */
  coupons: number
  /** 这次判定用的 seed（走查脚本 / 排查用，别塞进界面） */
  seed: number
}

/**
 * 结算一局。
 *
 * ⚠️ **先定结果、再演动画** —— 不是「动画跑完看物理算出来什么」。
 * 原因有两个，都不是口味问题：
 *   ① 物理驱动的抓取**期望值不可控**（`E` 是那条不变量的分母，
 *      它必须是家长设的那个数，不能是「大概差不多」）；
 *   ② 物理是浮点的、跨设备不保证一致 ⇒ **刷新就可能重掷**，
 *      而重掷正好是上面说的那个漏洞。
 */
export function clawResolveRound(index: number, e: ClawEconomy): ClawRound {
  const seed = seedOf(`claw|${index}`)
  const won = hashRandom(seed) < e.winRate
  return { index, won, coupons: won ? Math.max(0, Math.round(e.exchangePerPrize)) : 0, seed }
}
