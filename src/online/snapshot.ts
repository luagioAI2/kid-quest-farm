import { ApiError } from '../api/client'
import { gameKvList } from '../api/gameKv'
import { toDateKey } from '../domain/time'
import {
  snapshotCreate,
  snapshotList,
  snapshotRestoreByTime,
  snapshotRestoreLogs,
  type RestoreLogRow,
  type SnapshotRow,
} from '../api/snapshot'
import { pullGameKv } from './kv'

/* ============================================================
   在线版 · 存档还原点（把「一堆按 key 存的快照」翻译成「一个时间点」）
   ------------------------------------------------------------
   服务端的快照是**按 key** 存的：`save` 一个、`bag` 一个、`settings` 一个。
   家长看不懂这个粒度 —— 他要的是「把游戏退回到昨天下午」。

   所以这一层做两件事：

     ① **把同一时刻的多个 key 合成一个「还原点」**（`groupMoments`）；
     ② 回档时用 `restore-by-time`（一次调用恢复整个游戏），
        而不是逐个 key 调 `restore` —— 后者会变成 N 次请求 + N 个中间态。

   ★ 为什么分组不能只按 `created_at` 严格相等
     手动存点时是**循环**给每个 key 调 `create`，几条跨了秒就会裂成两组，
     界面上看着像「存了两次」。所以用「相邻两条相差 ≤ 3 秒」合并。

   ★ 为什么回档用时间点、不用快照 id
     `restore-by-time` 的判据是 `created_at <= at`（含边界），
     传还原点的 `at` 正好把这一组的快照都包含进去；
     而 `restore` 一次只恢复一个 key，整个游戏要调 N 次，
     中途失败就留下一半旧一半新 —— 那种状态没有任何人想要。
   ============================================================ */

/** 快照不存在（`restore` / `get` 时那条被保留策略淘汰了） */
export const SNAPSHOT_NOT_EXIST = 10041001
/** 快照数量超配额 */
export const SNAPSHOT_QUOTA = 10041101
/** 未拥有该游戏（`checkGameExists` 第三道闸） */
export const SNAPSHOT_GAME_NOT_OWNED = 10040401

/** 一个「还原点」：同一时刻的那批快照 */
export interface Moment {
  /**
   * 代表时间（这一组里最新那条的 `created_at`）。回档时直接传它。
   *
   * ⚠️ **Unix 秒**，和 `SnapshotRow.created_at` 同单位（不是毫秒）。
   *    显示前要 ×1000，回档时不要换算。
   */
  at: number
  /** 这一组涉及哪些 key */
  keys: string[]
  /** 各 key 最新那份的字节数之和 */
  size: number
  /** 出现过的原因（去重、保持顺序） */
  reasons: string[]
  /** 手填的备注（多条时取第一条非空的） */
  note: string
  /** 含日切基线（当天第一份，永久保留） */
  baseline: boolean
}

/** 相邻两条差多少秒以内算「同一时刻」 */
const SAME_MOMENT_SEC = 3

/**
 * 把按 key 的快照列表合成「还原点」列表（按时间**倒序**）。
 *
 * 纯函数，不碰网络 —— 所以单测可以直接喂数组。
 */
export function groupMoments(rows: readonly SnapshotRow[], gapSec = SAME_MOMENT_SEC): Moment[] {
  const sorted = [...rows].sort((a, b) => b.created_at - a.created_at || b.id - a.id)

  const out: Moment[] = []
  let cur: { at: number; rows: SnapshotRow[] } | null = null

  const flush = () => {
    if (!cur) return
    /* 同一组里同一个 key 可能有多条（几秒内连存了两次），
       只认**最新那条**的 size —— 否则「大小」会按快照条数翻倍。 */
    const newestPerKey = new Map<string, SnapshotRow>()
    for (const r of cur.rows) if (!newestPerKey.has(r.key)) newestPerKey.set(r.key, r)

    const reasons: string[] = []
    for (const r of cur.rows) if (!reasons.includes(r.reason)) reasons.push(r.reason)

    let size = 0
    for (const r of newestPerKey.values()) size += r.size

    out.push({
      at: cur.at,
      keys: [...newestPerKey.keys()],
      size,
      reasons,
      note: cur.rows.find((r) => r.note)?.note ?? '',
      baseline: cur.rows.some((r) => r.is_daily_baseline),
    })
    cur = null
  }

  for (const r of sorted) {
    if (cur && cur.at - r.created_at <= gapSec) {
      cur.rows.push(r)
      continue
    }
    flush()
    cur = { at: r.created_at, rows: [r] }
  }
  flush()
  return out
}

/**
 * 还原点 / 回档记录的时间文案：「今天 15:04」/「昨天 20:11」/「11月1日 09:30」
 *
 * ⚠️ `at` 是**Unix 秒**（服务端的 `created_at` 单位），不是毫秒。
 *    直接 `new Date(at)` 会得到「1970 年 1 月 22 日」—— 一个看起来像
 *    「日期格式没写好」、实际是**单位错了**的结果，而且不报错。
 *    换算只在这里做一次：`Moment.at` / `RestoreLogRow.created_at`
 *    全程保持服务端单位（回档时要原样传回去）。
 *
 * @param now 只给单测用，正常不传
 */
export function momentLabel(at: number, now = Date.now()): string {
  const ms = at * 1000
  const d = new Date(ms)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (toDateKey(ms) === toDateKey(now)) return `今天 ${hm}`
  if (toDateKey(ms) === toDateKey(now - 86_400_000)) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

/**
 * 服务端在**回档时自动写**的备注，形如 `从快照 #40 回档`。
 *
 * 那个 `#40` 是给后台审计用的内部 id，家长看不懂 —— 直接显示出来
 * 只会让人以为「要记住这个号」。所以这一层把它认出来，界面上不显示。
 *
 * ⚠️ 认不出来不算错：认不出就照常显示（顶多难看一点），
 *    而**不要**反过来「只显示白名单里的备注」—— 那样以后服务端
 *    或家长自己写了新备注，会静默一个字都不显示。
 */
export function isAutoNote(note: string): boolean {
  return /^从快照 #\d+ 回档$/.test(note)
}

/** 原因 → 中文标签。未知原因**原样显示**，不要吞掉（服务端以后可能加新的） */
export function reasonLabel(reason: string): string {
  switch (reason) {
    case 'auto':
      return '自动'
    case 'daily':
      return '当天起点'
    case 'manual':
      return '手动'
    case 'before_restore':
      return '回档前'
    case 'restore':
      return '回档后'
    default:
      return reason || '快照'
  }
}

/** 拉这款游戏的还原点（按时间倒序） */
export async function listMoments(gameId: string, limit = 60): Promise<Moment[]> {
  const r = await snapshotList(gameId, undefined, limit)
  return groupMoments(r.list ?? [])
}

/**
 * 现在存一个还原点：给这款游戏**现有的每个键**各存一份。
 *
 * 返回存了几个键。`0` = 这个游戏还没有任何存档（还没玩过），
 * 界面要说「还没有存档可存」，而不是显示「存好了」。
 *
 * 为什么循环而不是一次搞定：服务端的 `create` 只接受单个 key，
 * 它不知道「这一批属于同一个还原点」。分组由 `groupMoments` 在读取侧做。
 */
export async function saveSnapshotNow(
  gameId: string,
  note = '',
): Promise<{ keys: number }> {
  const list = await gameKvList(gameId)
  const keys = Object.keys(list.data ?? {})
  for (const k of keys) await snapshotCreate(gameId, k, note)
  return { keys: keys.length }
}

/**
 * 退回到某个还原点（**整个游戏**，一次调用）。
 *
 * 之后必须 `pullGameKv`：服务端已经把存档改回去了，本地 Dexie 还是新的那份 ——
 * 不拉一次，界面（和下一次打开游戏）看到的仍是「没退回去」的样子，
 * 而服务端其实已经退了。这种「两边不一样且不报错」正是本项目最怕的形态。
 *
 * @returns `restored` = 实际恢复的键数。`0` 表示那个时刻之前一份快照都没有。
 */
export async function restoreToMoment(
  gameId: string,
  at: number,
  reason = '',
): Promise<{ restored: number }> {
  const r = await snapshotRestoreByTime(gameId, at, undefined, reason)
  await pullGameKv(gameId)
  return { restored: r.restored_keys ?? 0 }
}

/** 回档记录（谁在什么时候把哪个键从哪版退到哪版） */
export async function listRestoreLogs(gameId: string, limit = 10): Promise<RestoreLogRow[]> {
  const r = await snapshotRestoreLogs(gameId, limit)
  return r.list ?? []
}

/**
 * 把失败翻成一句家长能看懂的话。
 *
 * 放在这里而不是组件里：探针也要用同一套口径，
 * 两边各写一份的话，改了一处另一处就成了「说的不是同一件事」。
 */
export function snapshotFailText(e: unknown): string {
  if (!(e instanceof ApiError)) return '操作没成功，请再试一次。'
  if (e.isNetwork) return '连不上服务器，请检查网络。'
  if (e.isAuth) return '登录已过期，请重新登录。'
  switch (e.code) {
    case SNAPSHOT_NOT_EXIST:
      return '这个还原点已经被清理掉了（只保留最近 20 个），换一个试试。'
    case SNAPSHOT_QUOTA:
      return '还原点太多了，等系统清理掉旧的再存。'
    case SNAPSHOT_GAME_NOT_OWNED:
      return '这个游戏还没兑换过，存不了还原点。'
    default:
      return `操作没成功（${e.code}），请再试一次。`
  }
}
