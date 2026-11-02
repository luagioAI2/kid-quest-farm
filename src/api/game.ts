import { api } from './client'

/* ============================================================
   在线版 · 游戏目录与拥有关系（`tf-platform-api` `/api/game/*`）
   ------------------------------------------------------------
   客户端**一直没调过** `my-games` —— 拥有关系一直是从本地账本推的。
   结果是「本地判定拥有、服务端没有那行」的游戏（调试预置 / 恢复备份带进来的包）
   在界面上显示已拥有，存档却被 `10040401` 拒（见 `docs/online-version.md` §7.13.6）。
   这一层就是为了把那份名单拉下来。
   ============================================================ */

/** `/game/my-games` 的一项。`owned` 恒为 `true`（没拥有的不会出现在这个列表里） */
export interface ServerOwnedGame {
  game_id: string
  name?: string
  emoji?: string
  status?: string
  owned?: boolean
}

/**
 * 我拥有的游戏。
 *
 * ⚠️ 这份名单**已经包含** `default_owned = 1` 的游戏（服务端登录时
 *    `EnsureUserGames` 会补 `user_game` 行），但它**不含本机内置的农场**
 *    —— 服务端目录里没有 `farm` 这一行。别拿它当「全部拥有」用。
 */
export const myGames = () => api<{ list: ServerOwnedGame[]; count: number }>('/game/my-games', {})
