import { lazy, type ComponentType } from 'react'
import FarmPage from '../features/farm/FarmPage'
import { GAME_CLAW, GAME_FARM } from './ids'
import type { GameDef } from './registry'

/**
 * 「游戏 id → 页面组件」的映射。**UI 层，只有 `App.tsx` 读它。**
 *
 * 为什么和 `registry.ts` 分开：注册表是**纯数据**，`store/useApp.ts` 要读它。
 * 一旦注册表静态 import 了页面组件，就会形成
 * `useApp → registry → FarmPage → useApp` 的环，而 `useApp` 在模块顶层
 * 遍历 `GAMES` —— 环里谁先被 import 谁就炸。详见 `registry.ts` 的头注释。
 *
 * ## ⚠️ 娃娃机为什么是 `lazy` 而农场不是
 *
 * 娃娃机带 **three.js**（实测 tree-shaken 后 **135 KB gzip**）。静态 import
 * 的话这 135 KB 会进主包，**每一个不玩娃娃机的孩子**都要先把它下下来 ——
 * 而首装只有农场（家长 2026-10-14 拍板），娃娃机是家长后来花商城币买的。
 *
 * `React.lazy` + 动态 `import()` 让 three.js 落到**自己的 chunk**：
 * 只有孩子真的切到娃娃机那一格，浏览器才去取。
 * 农场保持静态 —— 它是首装里唯一的游戏，拆出去只会多一次往返。
 *
 * ⚠️ `lazy` 的组件**必须**被 `<Suspense>` 兜住（见 `App.tsx`），
 * 否则切过去的第一帧会整棵树抛出去。
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
  [GAME_CLAW]: lazy(() => import('../features/claw/ClawPage')),
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
