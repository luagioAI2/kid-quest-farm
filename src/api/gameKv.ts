import { api } from './client'

/* ============================================================
   在线版 · 插件存档（tf-platform-api `/api/game/kv/*`）
   ------------------------------------------------------------
   服务端这套接口的形状是照着本地 `host.storage` 写的（整块读 / 整块写 /
   列出全部），所以这一层几乎没有翻译：`data` 直接就是 `Record<string, unknown>`，
   连 `storage.list()` 的返回值都能原样接。

   三处**服务端才有的能力**，本地没有：

   | | 本地 `gameKv` | 服务端 |
   | --- | --- | --- |
   | 版本号 | 没有 | `version`，写回要带 `expected_version` |
   | 保留键 | 靠 `assertNotReserved` 拦 | 服务端**也**拒（`__` 开头 = 604） |
   | 拥有校验 | 没有 | `checkGameExists`：游戏要在目录里、没下架、且**已拥有** |

   ⚠️ 最后一行是个真约束：本地的「已拥有」是从本地账本推导的（`ownedGameIds`），
   服务端的「已拥有」是 `game_purchase` / 兑换记录。两边**目前还没有同步**，
   所以「本地装了、服务端没拥有」的游戏，存档会被 `10040401` 拒。
   正常流程（兑换商城 / 心愿商城 / 激活码）不会出现这种情况 —— 那三条路
   都会在服务端留下拥有记录。只有走查时 `grantGame` 预置的游戏会撞上。
   ============================================================ */

/** 单键读取的结果 */
export interface ServerKvGet {
  key: string
  /** 没存过时是 `null`（和本地 `undefined` 对齐） */
  value: unknown
  /** 乐观锁版本号。**下次写回必须带上它** */
  version: number
  exists: boolean
  size?: number
  updated_at?: number
}

/** 列出全部的结果。`data` 的形状和 `storage.list()` 完全一致 */
export interface ServerKvList {
  game_id: string
  data: Record<string, unknown> | null
  /** 每个键的版本号（服务端附加的能力，本地没有） */
  versions: Record<string, number> | null
  count: number
}

export interface ServerKvUsage {
  total_bytes: number
  max_bytes: number
}

export const gameKvGet = (gameId: string, key: string) =>
  api<ServerKvGet>('/game/kv/get', { game_id: gameId, key })

/**
 * 整块写入（**和本地 `set()` 一样，是覆盖不是合并**）。
 *
 * @param expectedVersion 上次 `get` / `list` / `set` 拿到的版本号。
 *   `0`（或不传）= **关掉乐观锁**，服务端直接覆盖。
 *   传对了才会在多设备冲突时报 `10040701`。
 */
export const gameKvSet = (
  gameId: string,
  key: string,
  value: unknown,
  expectedVersion: number,
) =>
  api<{ key: string; version: number }>('/game/kv/set', {
    game_id: gameId,
    key,
    value,
    expected_version: expectedVersion,
  })

export const gameKvList = (gameId: string) =>
  api<ServerKvList>('/game/kv/list', { game_id: gameId })

/**
 * 删一个键；`key` 不传 = **删这款游戏的全部存档**（卸载）。
 *
 * ⚠️ 传空串和不传是一回事（服务端 `key == ""` 就走 `Uninstall`）。
 * 别写成 `key: undefined` 又指望它「什么都不做」。
 *
 * ⚠️ 两种删法的**返回字段不一样**（`deleted` / `deleted_keys`）——
 * 别只取一个然后拿 `undefined` 当 0 用。
 */
export const gameKvDelete = (gameId: string, key?: string) =>
  api<{ deleted?: boolean; deleted_keys?: number }>('/game/kv/delete', {
    game_id: gameId,
    ...(key === undefined ? {} : { key }),
  })

export const gameKvUsage = () => api<ServerKvUsage>('/game/kv/usage', {})
