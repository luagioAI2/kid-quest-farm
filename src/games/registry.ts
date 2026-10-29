import { GAME_FARM } from './ids'

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
 * **农场**是唯一的内置游戏（`status: 'available'`，首款免费、默认已拥有）。
 * 娃娃机 2026-10-23 从内置删掉了（`332511b`），现在是 `public/games/` 里的插件包，
 * 由 `localGames.ts` 提供、和内置游戏排在**同一张市场表**里（`GameStore.tsx`）。
 *
 * 2026-10-25：**钓鱼池删掉了**（家长：「去掉钓鱼池」）。它是最后一个
 * `comingSoon` 占位 —— 一个永远停在「敬请期待」的条目，除了让列表长一格，
 * 没有别的作用。`GameStatus` 仍然保留：插件/内置将来都还可能有占位。
 */

import type { GameKind } from './kind'

export type GameStatus = 'available' | 'comingSoon'

export interface GameDef {
  id: string
  /** 底部导航上的名字 */
  name: string
  /** 底部导航上的图标 */
  emoji: string
  /** 给家长看的一句话：这游戏是干什么的。陈述句，别写广告词。 */
  tagline: string
  /** 分类（见 `games/kind.ts`）。设置页把内置游戏和插件排在同一张表里，靠它分组 */
  kind: GameKind
  status: GameStatus
  /** 钻石售价。`0` = 免费 */
  priceMall: number
  /** 免费且默认已拥有。**只应该有一条**（首款） */
  defaultOwned: boolean
}

export const GAMES: GameDef[] = [
  {
    id: GAME_FARM,
    name: '农场',
    emoji: '🌾',
    tagline: '买种子种地、养动物、看行情。收成能换成兑换券。',
    kind: 'think',
    status: 'available',
    // 首款免费并且默认已拥有 —— 家长 2026-10-14 拍板。
    priceMall: 0,
    defaultOwned: true,
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
 *
 * ## ⚠️ 两种来源，判据不一样
 *
 * | 来源 | delta | 为什么 |
 * | --- | --- | --- |
 * | `game_purchase` | **必须 < 0** | 只认支出那一笔。将来加了退款（正数、同 refId）这里要一起改，否则退了款还显示「已购买」 |
 * | `redemption_code` | **0** | 码解锁**一分钻石都没花**，写 0 是事实。拿 `delta < 0` 当判据会把它漏掉 —— 症状是「码兑换成功了，界面上却不显示已拥有」，而且零报错 |
 *
 * 这两行是 spec §6 点名的坑：「码解锁不是加个输入框」。
 * 改动这里之前先看 `useApp.test.ts` 里那条「码解锁之后算已拥有」。
 */
export function purchasedIdsFrom(
  entries: readonly { source: string; refId?: string; delta: number }[],
): string[] {
  const out = new Set<string>()
  for (const e of entries) {
    if (!e.refId) continue
    if (e.source === 'game_purchase' && e.delta < 0) out.add(e.refId)
    // 码解锁不看 delta：它就是 0
    else if (e.source === 'redemption_code') out.add(e.refId)
  }
  return [...out]
}
