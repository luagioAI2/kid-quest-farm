import { api } from './client'

/* ============================================================
   在线版 · 存档快照与回档（`/api/game/snapshot/*`）
   ------------------------------------------------------------
   这块能力**只有服务端有**，本地版没有对应物：本地 Dexie 里就是一份当前存档，
   历史版本根本不存在。所以整个功能（含入口）都只在 `isOnlineMode` 下出现。

   服务端的设计（`docs/SAVE_SNAPSHOT.md`）：

     · 快照不是每次写都存，触发条件是「没有历史 / 距上次 > 10 分钟 /
       值变化 > 20%」，每个键保留最近 20 个 + **当天第一个永久保留**（日切基线）；
     · `before_restore` —— 回档前先把当前值存一份 ⇒ **回档本身也可回档**；
     · `restore-by-time` 是**按时间点**回档：每个键各取「该时刻之前最近的一份」。
       这是唯一一个「一次调用恢复整个游戏」的入口，所以 UI 用它。

   ⚠️ 时间边界是 `created_at <= at`（含），不是 `<` ——
      否则「退回到我刚存的那个还原点」会退到它的**上一份**，
      而界面上显示的是刚存的那份，差一步且不报错。

   ⚠️ **所有时间戳都是 Unix 秒**（`created_at`、`at`），不是毫秒。
      `restore-by-time` 的 `at` 要原样传服务端的 `created_at`，
      所以这一层不做单位换算；换算只在显示的地方做一次
      （见 `features/settings/SnapshotSection.tsx` 的 `momentLabel`）。
      直接 `new Date(秒)` 会得到 1970 年 —— 不报错，只是日期全错。
   ============================================================ */

/** 一条快照的元信息（不含 `value`，列表用它就够了） */
export interface SnapshotRow {
  id: number
  game_id: string
  key: string
  /** 内容字节数 */
  size: number
  /** 存快照时那条存档的版本号 */
  version: number
  /** `auto` / `daily` / `manual` / `before_restore` / `restore` */
  reason: string
  /** 当天第一份（永久保留的兜底） */
  is_daily_baseline: boolean
  note: string
  created_at: number
}

/** 单条快照的完整内容（「预览要回档到什么状态」时才需要） */
export interface SnapshotDetail extends SnapshotRow {
  value: unknown
}

export interface SnapshotList {
  count: number
  list: SnapshotRow[] | null
}

export interface RestoreLogRow {
  id: number
  game_id: string
  key: string
  snapshot_id: number
  from_version: number
  to_version: number
  /** 操作者。C 端一律 0 */
  operator_id: number
  reason: string
  created_at: number
}

export interface RestoreLogList {
  count: number
  list: RestoreLogRow[] | null
}

/**
 * 列快照。`key` 不传 = 这款游戏**所有键**的快照。
 *
 * ⚠️ 返回按 `id DESC`（≈ 时间倒序），但**同一秒的多条顺序不保证** ——
 * 分组前必须自己按 `created_at` 排一遍（见 `src/online/snapshot.ts`）。
 */
export const snapshotList = (gameId: string, key?: string, limit = 60) =>
  api<SnapshotList>('/game/snapshot/list', {
    game_id: gameId,
    ...(key === undefined ? {} : { key }),
    limit,
  })

export const snapshotGet = (snapshotId: number) =>
  api<SnapshotDetail>('/game/snapshot/get', { snapshot_id: snapshotId })

/** 手动存一份（家长在「孩子要挑战难关之前」主动存点） */
export const snapshotCreate = (gameId: string, key: string, note = '') =>
  api<SnapshotRow>('/game/snapshot/create', {
    game_id: gameId,
    key,
    ...(note ? { note } : {}),
  })

/** 回档到**指定快照**（单个键）。按时间点回档请用 `snapshotRestoreByTime` */
export const snapshotRestore = (snapshotId: number, reason = '') =>
  api<{ restored: boolean; game_id: string; key: string; version: number }>(
    '/game/snapshot/restore',
    { snapshot_id: snapshotId, ...(reason ? { reason } : {}) },
  )

/**
 * 按时间点回档。
 *
 * - `key` 不传 = **整个游戏**（每个有过快照的键各退回该时刻之前最近的一份）；
 * - 返回 `restored_keys` = 实际恢复的键数，**不是**「成功了 true」。
 *   0 表示一个键都没有那个时刻之前的快照（界面要说清，别显示「已完成」）。
 */
export const snapshotRestoreByTime = (gameId: string, at: number, key?: string, reason = '') =>
  api<{ restored_keys: number }>('/game/snapshot/restore-by-time', {
    game_id: gameId,
    at,
    ...(key === undefined ? {} : { key }),
    ...(reason ? { reason } : {}),
  })

export const snapshotRestoreLogs = (gameId: string, limit = 10) =>
  api<RestoreLogList>('/game/snapshot/restore-logs', { game_id: gameId, limit })
