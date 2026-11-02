/* ============================================================
   在线版 · 本地 id ↔ 服务端 id
   ------------------------------------------------------------
   服务端 id 是数字（`task.id = 12`），本地 id 是字符串（`srv_task_12`）。
   `sync/map.ts` 的 `srvId()` 负责「服务端 → 本地」，这里负责反方向。

   ★ 为什么不让调用方自己 `slice('srv_task_'.length)`：
     切错了不会报错，只会把 `NaN` 发给服务端，服务端回「任务不存在」，
     而界面显示的是「任务没了」——查起来完全不像一个 id 问题。
   ============================================================ */

const SRV_ID = /^srv_(task|inst|ledger)_(\d+)$/

export type ServerIdKind = 'task' | 'inst'

/**
 * 本地 id → 服务端数字 id。
 *
 * 返回 `null` 表示「这一行不是从服务端来的」（本地版遗留的 `tk_xxx` /
 * `ti_xxx`，或者根本不是任务 id）。在线版的写穿**必须**拿到数字才能调接口，
 * 拿到 null 就说明这条数据不该在在线版里出现 —— 调用方应当报错而不是猜。
 */
export function serverIdOf(localId: string, kind: ServerIdKind): number | null {
  const m = SRV_ID.exec(localId)
  if (!m || m[1] !== kind) return null
  const n = Number(m[2])
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/** 这一行是不是从服务端拉下来的（三类都算） */
export function isServerId(localId: string): boolean {
  return SRV_ID.test(localId)
}
