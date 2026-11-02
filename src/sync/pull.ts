import { db } from '../db/db'
import { board, listTasks } from '../api/task'
import { walletInfo, walletLedger } from '../api/wallet'
import { getToken } from '../api/session'
import { mapInstance, mapLedger, mapTask } from './map'

/* ============================================================
   在线版 · 拉取（服务端 → 本地 Dexie）
   ------------------------------------------------------------
   在线版的产品定义：**账号才是数据源，设备只是显示端**。
   所以这里的角色是「把服务端的真相搬进本地表」，搬完之后
   UI 一行都不用改 —— 它照旧读 Dexie。

   ★ 只替换 `srv_` 前缀的行，本地行一行不动。
     这条很重要：本地版和在线版共用同一套表，如果这里 `clear()` 整张表，
     切回本地版时孩子的数据就没了（而界面上什么都看不出来）。

   ★ 任何失败都**不抛**：拉取失败必须退回「用本地已有的数据」，
     否则一进 App 就白屏，而孩子只是没网。
   ============================================================ */

/**
 * 构建期开关。
 *
 * ★ 这个 worktree（`kid-quest-farm-online`）**默认就是服务器版**：
 *   数据以 `tf-platform-api` 为准，本地 Dexie 只是读缓存。
 *   要打一个「只在本机跑」的包，显式 `VITE_APP_MODE=local`。
 *
 * ★ 这是**分支级**的默认值，不是全局约定：
 *   `kid-quest-farm-2d`（本地版）那个分支上这一行写的是「默认 local」。
 *   两个分支各自演进、各自默认，**不靠人记得加环境变量**；
 *   但代价是合并回主分支时这一行会冲突 —— 那是有意为之，
 *   因为「默认用哪份数据」正是两个版本最根本的区别。
 */
export const APP_MODE: 'local' | 'online' =
  import.meta.env.VITE_APP_MODE === 'local' ? 'local' : 'online'

export const isOnlineMode = APP_MODE === 'online'

export interface PullResult {
  ok: boolean
  /** 没拉的原因（`local` = 本地版不需要拉；`no-session` = 没登录） */
  reason?: string
  tasks?: number
  instances?: number
  ledger?: number
  /** 服务端报的余额，用来和本地求和比对 */
  balance?: number
}

/** 删掉某一类 `srv_` 行（重拉时先清后写，保证服务端删掉的这里也跟着消失） */
async function clearSrvRows(table: 'tasks' | 'taskInstances' | 'ledger', prefix: string) {
  const t = db[table]
  const keys = await t
    .filter((row: { id: string }) => row.id.startsWith(prefix))
    .primaryKeys()
  if (keys.length) await t.bulkDelete(keys as string[])
}

/**
 * 拉一次：任务定义 + 今日任务板 + 钱包 + 积分流水。
 *
 * @param opts.pageSize 流水拉多少条（服务端分页；默认 200，够积分页显示）
 */
export async function pullFromServer(opts: { pageSize?: number } = {}): Promise<PullResult> {
  if (!isOnlineMode) return { ok: true, reason: 'local' }
  if (!getToken()) return { ok: false, reason: 'no-session' }
  return pullOnce(opts)
}

/**
 * 真正的拉取动作（**不含**模式 / 登录态判断）。
 *
 * 单独导出是为了能单测：`isOnlineMode` 是构建期常量，测试里改不动它；
 * 而「拉取会不会把本地数据弄丢」这件事必须被验证，不能只靠肉眼。
 */
export async function pullOnce(opts: { pageSize?: number } = {}): Promise<PullResult> {
  try {
    // 三个请求并发：任务板本身会**懒生成**今天的实例，所以它必须在读实例之前完成
    const [b, tasks, wallet] = await Promise.all([
      board(),
      listTasks(false),
      walletInfo().catch(() => null), // 钱包挂了不该拖垮任务板
    ])
    const ledger = await walletLedger(1, opts.pageSize ?? 200).catch(() => null)

    const taskRows = tasks.list.map(mapTask)
    const instRows = b.instances.map(mapInstance)
    const ledgerRows = (ledger?.list ?? [])
      .map(mapLedger)
      .filter((r): r is NonNullable<typeof r> => r !== null)

    await db.transaction('rw', [db.tasks, db.taskInstances, db.ledger], async () => {
      await clearSrvRows('tasks', 'srv_task_')
      await clearSrvRows('taskInstances', 'srv_inst_')
      await clearSrvRows('ledger', 'srv_ledger_')
      if (taskRows.length) await db.tasks.bulkPut(taskRows)
      if (instRows.length) await db.taskInstances.bulkPut(instRows)
      if (ledgerRows.length) await db.ledger.bulkPut(ledgerRows)
    })

    return {
      ok: true,
      tasks: taskRows.length,
      instances: instRows.length,
      ledger: ledgerRows.length,
      balance: wallet?.points ?? b.balance,
    }
  } catch (e) {
    // 网络 / 401 / 服务端 5xx 都走这里：保留本地数据，不抛
    return { ok: false, reason: (e as { message?: string })?.message ?? 'pull-failed' }
  }
}
