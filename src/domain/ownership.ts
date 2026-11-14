import { GAMES, ownedByDefault } from '../games/registry'
import { wishOwnedSet } from './wish'

/* ============================================================
   「已拥有」的口径 —— 两种模式**不一样**，而且必须不一样
   ------------------------------------------------------------
   本地版：三个来源合并（账本 / 已装包 / 心愿单）。本地没有「服务端会不会
   放行」这个问题，包在就算有。

   在线版：**只认服务端那份名单**（`/game/my-games`）+ 注册表里默认拥有的。

   ★★ 为什么在线版不能把「已装的包」也算进来（2026-11-02 晚）：
      在线版的存档是**写穿**的，服务端 `checkGameExists` 要 `user_game` 有行。
      本地装了、服务端没有 ⇒ 界面显示「已拥有」、游戏也玩得动，
      **但存档一个字节都存不上**（`10040401`），而且不报错 ——
      孩子玩一下午，进度全丢，界面上全程正常。

      这种「看着拥有、其实存不上」比「显示未拥有」难受得多：
      后者至少能自己救（重新兑换一次，服务端就有行了）。

   ★★ 为什么还要并上「注册表默认拥有」：**农场不在服务端目录里**。
      服务端 21 款游戏全是插件（`cloudfarm` …），没有 `farm` 这一行；
      而农场是本机内置的首款、默认拥有。只看服务端名单的话，
      `switchGame('farm')` 会被「没拥有」拦掉 —— 首页那款直接打不开。
      所以这条是**注册表事实**，不是本地账本事实，必须留着。
   ============================================================ */

/** 注册表里「免费且默认拥有」的 id（现在只有农场）。 */
export const DEFAULT_OWNED_IDS: readonly string[] = GAMES.filter(ownedByDefault).map((g) => g.id)

/**
 * 在线版的「已拥有」= 注册表默认拥有 + 服务端名单。
 *
 * @param serverIds 服务端 `/game/my-games` 的 id；`null` = **还没拉到**。
 *   `null` 时返回 `null`，由调用方决定退回什么 —— 别在这里返回空数组：
 *   空数组的意思是「服务端说一个都没有」，那会让整页游戏瞬间变成未拥有。
 */
export function ownedIdsOnline(serverIds: readonly string[] | null): string[] | null {
  if (serverIds === null) return null
  return [...new Set([...DEFAULT_OWNED_IDS, ...serverIds])]
}

/**
 * 渲染用的「已拥有」集合。
 *
 * 本地版走 `wishOwnedSet`（三来源）；在线版**只有** `ownedIds` 这一份 ——
 * 已装包和心愿单都不参与，理由见文件头。
 *
 * ★ 抽成函数是为了三个调用点（游戏商城 / 心愿商城 / 兑换页）用同一口径：
 *   各写一遍的话，一处算上「已装包」另一处不算，就会出现
 *   「商城里显示已拥有、兑换页说可以换」这种自相矛盾的界面。
 */
export function ownedSetFor(
  online: boolean,
  ownedIds: readonly string[],
  installedGames: Record<string, unknown>,
  wishOrders: readonly {
    status: string
    openedGameId?: string
    /** 「5 连开」一单给了多款 —— 类型不能收窄，否则清单会被当成不存在 */
    openedGameIds?: string[]
  }[],
): Set<string> {
  if (online) return new Set(ownedIds)
  return wishOwnedSet(ownedIds, installedGames, wishOrders)
}
