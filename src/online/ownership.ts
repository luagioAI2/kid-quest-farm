import { myGames } from '../api/game'

/**
 * 拉服务端「我拥有哪些游戏」。
 *
 * ★ 这是在线版**唯一**的拥有关系来源（外加注册表里默认拥有的农场，
 *   见 `domain/ownership.ts` 文件头）。
 *
 * ⚠️ 失败要**抛**，不要 `catch` 成空数组：空数组的意思是
 *    「服务端说你一个都没有」，会把整页游戏瞬间变成未拥有。
 *    调用方用 `catch(() => null)` 表达「不知道」，那和「没有」是两件事。
 */
export async function fetchOwnedGameIds(): Promise<string[]> {
  const r = await myGames()
  return (r.list ?? [])
    .map((g) => g.game_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
}
