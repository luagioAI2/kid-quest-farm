import type { ComponentType } from 'react'
import FarmPage from '../features/farm/FarmPage'
import { GAME_FARM } from './ids'
import type { GameDef } from './registry'

/**
 * 「游戏 id → 页面组件」的映射。**UI 层，只有 `App.tsx` 读它。**
 *
 * 为什么和 `registry.ts` 分开：注册表是**纯数据**，`store/useApp.ts` 要读它。
 * 一旦注册表静态 import 了页面组件，就会形成
 * `useApp → registry → FarmPage → useApp` 的环，而 `useApp` 在模块顶层
 * 遍历 `GAMES` —— 环里谁先被 import 谁就炸。详见 `registry.ts` 的头注释。
 *
 * ## 加一款新游戏
 *
 * 1. `ids.ts` 加 id；
 * 2. `registry.ts` 的 `GAMES` 里加一条（`status: 'available'`）；
 * 3. **在这里挂上页面** —— 忘了的话 `registry.test.ts` 会红（可玩的必须有页面），
 *    而不是等到孩子点进去看见白屏。
 *
 * ⚠️ 反过来也钉着：这里**不许有野页面**（映射里存在、注册表里没有的游戏）。
 * 那种页面永远渲染不到，是一块死代码。
 */
export const GAME_PAGES: Record<string, ComponentType> = {
  [GAME_FARM]: FarmPage,
}

/**
 * 取一款游戏的页面。
 *
 * `comingSoon` 的游戏**一定**返回 `null` —— 页面的有无由 `status` 决定，
 * 不靠「映射里有没有」猜。这样即使有人手滑给没做好的游戏挂了个页面，
 * 界面也不会把它当可玩的游戏放出去。
 */
export function pageFor(game: GameDef | undefined): ComponentType | null {
  if (!game || game.status !== 'available') return null
  return GAME_PAGES[game.id] ?? null
}
