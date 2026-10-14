import { GAME_CLAW, GAME_FARM, GAME_FISHING } from './ids'

/**
 * 游戏注册表 —— 插件骨架。**纯数据，不许 import 任何 UI。**
 *
 * 完整契约见 `docs/game-plugin-spec.md`（§4 插件契约、§10 落地路线）。
 * 一句话：**宿主提供积分账本、家长闸门、UI 外壳；游戏只负责自己的页面和
 * 自己的那套账。** 游戏之间互不相识，谁也不 import 谁的模块。
 *
 * ## ⚠️ 这个文件为什么一个组件都不 import
 *
 * 页面组件挂在 `./pages.ts` 里，**不在这里**。原因是循环依赖：
 *
 * ```
 * store/useApp.ts  ──►  games/registry.ts  ──►  features/farm/FarmPage.tsx
 *        ▲                                              │
 *        └──────────────────────────────────────────────┘
 * ```
 *
 * `FarmPage` 要读 store，所以只要注册表静态 import 了它，这个环就成立。
 * 环本身不致命，但**谁先 import 注册表谁就炸**：`useApp.ts` 的模块顶层
 * 会遍历 `GAMES` 算初始值，而那一刻注册表还没求值完 → 读到的 `GAMES`
 * 还在暂时性死区里 → `TypeError: GAMES is not iterable`。
 * 2026-10-14 加 `registry.test.ts` 时就是这么炸的（测试文件先 import 了注册表）。
 *
 * ➜ **加游戏时：数据加在这里，页面加在 `pages.ts`。**
 *   两边的对应关系由 `registry.test.ts` 钉着（可玩的必须有页面、
 *   `pages.ts` 里不许有野页面）。
 *
 * ## 这一轮做到哪
 *
 * 只有**农场**是真游戏（`status: 'available'`）。另外两条是**占位**：
 * 它们会出现在家长栏的「游戏」列表里，但标「敬请期待」、**不渲染购买按钮、
 * 也不显示价格** —— 因为买了也没得玩，那正是「界面承诺了它做不到的事」。
 */

export type GameStatus = 'available' | 'comingSoon'

export interface GameDef {
  id: string
  /** 底部导航上的名字 */
  name: string
  /** 底部导航上的图标 */
  emoji: string
  /** 给家长看的一句话：这游戏是干什么的。陈述句，别写广告词。 */
  tagline: string
  status: GameStatus
  /** 商城币售价。`0` = 免费 */
  priceMall: number
  /** 免费且默认已拥有。**只应该有一条**（首款） */
  defaultOwned: boolean
}

export const GAMES: GameDef[] = [
  {
    id: GAME_FARM,
    name: '农场',
    emoji: '🌾',
    tagline: '买种子种地、养动物、看行情。收成能换成丰收币。',
    status: 'available',
    // 首款免费并且默认已拥有 —— 家长 2026-10-14 拍板。
    priceMall: 0,
    defaultOwned: true,
  },
  {
    id: GAME_CLAW,
    name: '娃娃机',
    emoji: '🎟️',
    tagline: '投币抓娃娃。',
    status: 'comingSoon',
    // ⚠️ 这两条的价格现在**不会显示**（`status: 'comingSoon'` 的条目
    // 连购买按钮都不渲染）。留着是为了将来上线时有个起点。
    priceMall: 120,
    defaultOwned: false,
  },
  {
    id: GAME_FISHING,
    name: '钓鱼池',
    emoji: '🎣',
    tagline: '钓鱼、养鱼。',
    status: 'comingSoon',
    priceMall: 150,
    defaultOwned: false,
  },
]

/** 按 id 找游戏。找不到返回 `undefined` —— 调用方必须处理（见 `resolveActiveGame`）。 */
export function gameById(id: string | undefined): GameDef | undefined {
  if (!id) return undefined
  return GAMES.find((g) => g.id === id)
}

/** 免费且默认已拥有 —— 不需要任何购买记录就算「已购买」 */
export function ownedByDefault(g: GameDef): boolean {
  return g.defaultOwned
}

/**
 * 从账本推导「已购买的游戏 id」。
 *
 * **拥有关系不另存一份**：买了游戏就是账本里那一笔 `game_purchase`。
 * 存成 `settings.ownedGames` 之类的话，退款 / 清库 / 导入备份时
 * 两份就会走散（本项目在 `Task` / `TaskInstance` 上已经吃过一次这个亏）。
 */
export function purchasedIdsFrom(
  entries: readonly { source: string; refId?: string; delta: number }[],
): string[] {
  const out = new Set<string>()
  for (const e of entries) {
    // 只认**支出**那一笔。将来如果加了退款（正数、同 refId），
    // 这里必须一起改，否则退了款还显示「已购买」。
    if (e.source === 'game_purchase' && e.refId && e.delta < 0) out.add(e.refId)
  }
  return [...out]
}
