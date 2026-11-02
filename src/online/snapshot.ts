import { ApiError } from '../api/client'
import { gameKvList } from '../api/gameKv'
import { toDateKey } from '../domain/time'
import {
  snapshotGet,
  snapshotList,
  snapshotRestoreByTime,
  snapshotRestoreLogs,
  type RestoreLogRow,
  type SnapshotDetail,
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

   ★ 快照是**服务端自己产生的**，前端从不主动「存一个」
     每次 `storage.set` 之后服务端按策略决定留不留（没有历史 / 距上次 > 10 分钟 /
     值变化 > 20%，每键留 20 份 + 当天第一份永久留），见
     `tf-platform-api/internal/app/service/game_snapshot_srv.go` 的 `MaybeSnapshot`。
     所以这一层**没有 save 入口**：家长唯一能做的动作是「退回去」。

   ★ 为什么分组不能只按 `created_at` 严格相等
     快照按 key 存，而一个游戏常常在一两秒里连着写两个键（一局结束先写
     `save` 再写 `settings`），两条跨了秒就会裂成两组，
     界面上看着像「存了两次」。所以用「相邻两条相差 ≤ 3 秒」合并。

   ★ 为什么回档用时间点、不用快照 id
     `restore-by-time` 的判据是 `created_at <= at`（含边界），
     传还原点的 `at` 正好把这一组的快照都包含进去；
     而 `restore` 一次只恢复一个 key，整个游戏要调 N 次，
     中途失败就留下一半旧一半新 —— 那种状态没有任何人想要。

     ★ 但「时间点」只到**秒**，同一秒里可能落了两份 ⇒ 光传 `at` 会退到
       **界面没显示的那一份**。所以 `restore-by-time` 还收一个 `max_id`
       （见 `Moment.maxId`）：判据变成 `created_at <= at AND id <= max_id`，
       正好圈住「界面读列表时已经存在的那些行」。
   ============================================================ */

/** 快照不存在（`restore` / `get` 时那条被保留策略淘汰了） */
export const SNAPSHOT_NOT_EXIST = 10041001
/** 快照数量超配额 */
export const SNAPSHOT_QUOTA = 10041101
/** 未拥有该游戏（`checkGameExists` 第三道闸） */
export const SNAPSHOT_GAME_NOT_OWNED = 10040401

/** 还原点里某一个 key 的那一份快照（「看看里面是什么」要用 id 去取内容） */
export interface MomentKey {
  key: string
  /** 快照 id —— `snapshotGet` 用它取整份内容 */
  id: number
  size: number
  /** 存快照时那条存档的版本号 */
  version: number
}

/** 一个「还原点」：同一时刻的那批快照 */
export interface Moment {
  /**
   * 代表时间（这一组里最新那条的 `created_at`）。回档时直接传它。
   *
   * ⚠️ **Unix 秒**，和 `SnapshotRow.created_at` 同单位（不是毫秒）。
   *    显示前要 ×1000，回档时不要换算。
   */
  at: number
  /**
   * 这一组里最大的快照 id —— 回档时一起传上去，钉住「界面当时看到的那批」。
   *
   * ★ 光有 `at` 不够：`at` 只到**秒**，同一秒里可能落了不止一份快照
   *   （列表画出来之后孩子又玩了一下，服务端自己补了一份更新的）。
   *   只按 `created_at <= at` 挑，服务端会挑到**那一秒里最新的一份** ——
   *   界面没显示、家长没点的那份：预览说「退回到 21:30 那份」，
   *   实际退回到另一个状态，两边都不报错。
   *
   *   快照 id 是自增的，所以 `id <= maxId` 正好等于
   *   「界面读列表时已经存在的行」，不会误伤同一秒里更早写进去的那些。
   */
  maxId: number
  /** 这一组涉及哪些 key */
  keys: string[]
  /** 每个 key 最新那一份（顺序同 `keys`） */
  snapshots: MomentKey[]
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

    /* 这一组里最大的 id（= 界面读列表那一刻，这批快照的上界）。
       同一秒里后落进来的新行 id 一定更大 ⇒ 回档时会被 `max_id` 挡在外面。 */
    let maxId = 0
    for (const r of cur.rows) if (r.id > maxId) maxId = r.id

    const snapshots: MomentKey[] = [...newestPerKey.values()].map((r) => ({
      key: r.key,
      id: r.id,
      size: r.size,
      version: r.version,
    }))

    out.push({
      at: cur.at,
      maxId,
      keys: snapshots.map((s) => s.key),
      snapshots,
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
 * 退回到某个还原点（**整个游戏**，一次调用）。
 *
 * 之后必须 `pullGameKv`：服务端已经把存档改回去了，本地 Dexie 还是新的那份 ——
 * 不拉一次，界面（和下一次打开游戏）看到的仍是「没退回去」的样子，
 * 而服务端其实已经退了。这种「两边不一样且不报错」正是本项目最怕的形态。
 *
 * @param maxId `Moment.maxId` —— 钉住「界面当时看到的那批快照」。
 *   **别省成 0**：同一秒里可能落了不止一份，不钉的话会退到界面没显示的那份。
 * @returns `restored` = 实际恢复的键数。`0` 表示那个时刻之前一份快照都没有。
 */
export async function restoreToMoment(
  gameId: string,
  at: number,
  maxId: number,
  reason = '',
): Promise<{ restored: number }> {
  const r = await snapshotRestoreByTime(gameId, at, maxId, undefined, reason)
  await pullGameKv(gameId)
  return { restored: r.restored_keys ?? 0 }
}

/** 一份「退回到这里会变成什么」的对比（按 key） */
export interface KeyPreview {
  key: string
  version: number
  size: number
  /** 一行一条变化；空数组 = 这个 key 和现在一模一样 */
  lines: string[]
  /** 因为太长没显示出来的变化条数 */
  more: number
  /** 这一份取不出来时的说明（被保留策略淘汰了 / 网络） */
  error?: string
}

const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const isScalar = (v: unknown) => v === null || typeof v !== 'object'

/** 一个值怎么写给人看（存档里全是 JSON，直接 dump 家长读不了） */
function fmtValue(v: unknown): string {
  if (v === null || v === undefined) return '空'
  if (typeof v === 'boolean') return v ? '是' : '否'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') return `“${v.length > 18 ? `${v.slice(0, 18)}…` : v}”`
  if (Array.isArray(v)) return `${v.length} 项`
  return '一组数据'
}

/**
 * 「退回到这份」和「现在」差在哪 —— 只比**顶层字段**，一行一条。
 *
 * 为什么不递归：存档里一个 `plots` 数组就有几十项，逐项 diff 出来是几百行，
 * 家长一个字都不会看。顶层那几行（积分 / 天数 / 关卡）才是他要判断的东西。
 *
 * @param current  现在服务端上的那份
 * @param snapshot 还原点里那份（退回去之后会变成它）
 * @returns `lines` 里每行形如 `coins：120 → 60`（左=现在，右=退回后）
 */
export function diffPreview(
  current: unknown,
  snapshot: unknown,
  maxLines = 4,
): { lines: string[]; more: number } {
  /*
   * 整个值不是对象 ⇒ 没有「字段」可比。
   *   · 两边都是数组：报项数（`12 项 → 9 项`）—— 家长能看懂的那一句；
   *   · 其它（数字 / 字符串 / 一边是数组一边是对象）：只能说「都不一样」。
   */
  if (!isPlainObj(current) || !isPlainObj(snapshot)) {
    if (JSON.stringify(current) === JSON.stringify(snapshot)) return { lines: [], more: 0 }
    if (Array.isArray(current) && Array.isArray(snapshot)) {
      return { lines: [`${current.length} 项 → ${snapshot.length} 项`], more: 0 }
    }
    return { lines: ['整份存档都不一样'], more: 0 }
  }

  /* 顺序：先按还原点里的字段顺序（那是存档本来的样子），再补「现在多出来的」 */
  const keys = [...new Set([...Object.keys(snapshot), ...Object.keys(current)])]
  const lines: string[] = []
  let more = 0

  for (const k of keys) {
    const inSnap = k in snapshot
    const inCur = k in current
    const a = current[k]
    const b = snapshot[k]

    let line: string
    if (!inCur) {
      /* 现在没有、退回去会有 —— 这是**好事**，措辞别写成「会丢」 */
      line = `${k}：会补回来（${fmtValue(b)}）`
    } else if (!inSnap) {
      line = `${k}：会被删掉（现在是 ${fmtValue(a)}）`
    } else if (JSON.stringify(a) === JSON.stringify(b)) {
      continue
    } else if (isScalar(a) && isScalar(b)) {
      line = `${k}：${fmtValue(a)} → ${fmtValue(b)}`
    } else if (Array.isArray(a) && Array.isArray(b)) {
      line =
        a.length === b.length
          ? `${k}：内容不一样（都是 ${a.length} 项）`
          : `${k}：${a.length} 项 → ${b.length} 项`
    } else {
      line = `${k}：内容不一样`
    }

    if (lines.length < maxLines) lines.push(line)
    else more++
  }

  return { lines, more }
}

/**
 * 看一个还原点里到底是什么（点「看看会变成什么」时才调）。
 *
 * 每个 key 各取一次 `snapshotGet`（通常 1~3 个，不是 N 个）+
 * 一次 `gameKvList` 拿「现在」。
 *
 * ⚠️ 单个 key 取失败（被保留策略淘汰了）**不能让整块炸掉** ——
 *    那个 key 记一行说明，其余照常显示。家长点开是想看东西的，
 *    不是想看一句「操作没成功」。
 */
export async function previewMoment(
  gameId: string,
  m: Moment,
  maxLines = 4,
): Promise<KeyPreview[]> {
  const [list, ...details] = await Promise.all([
    gameKvList(gameId),
    ...m.snapshots.map((s) => snapshotGet(s.id).catch((e: unknown) => e)),
  ])
  const current = (list.data ?? {}) as Record<string, unknown>

  return m.snapshots.map((s, i) => {
    const got = details[i]
    if (!(got && typeof got === 'object' && 'value' in got)) {
      return {
        key: s.key,
        version: s.version,
        size: s.size,
        lines: [],
        more: 0,
        error: snapshotFailText(got),
      }
    }
    const value = (got as SnapshotDetail).value
    /*
     * 这个键**现在服务端上没有**（卸载过 / 被删过）⇒ 每个字段都会「补回来」。
     *
     * ⚠️ 不能直接把 `undefined` 交给 `diffPreview`：它分不清「这个键不存在」
     *    和「这个键的值是 undefined」，会退化成「整份存档都不一样」——
     *    信息量最少的那句话。对象就按空对象比（逐字段说「会补回来」），
     *    数组/标量没法逐字段，直接说一句。
     */
    if (!(s.key in current)) {
      const lines = isPlainObj(value)
        ? diffPreview({}, value, maxLines).lines
        : [`会补回来（${fmtValue(value)}）`]
      return { key: s.key, version: s.version, size: s.size, lines, more: 0 }
    }
    const { lines, more } = diffPreview(current[s.key], value, maxLines)
    return { key: s.key, version: s.version, size: s.size, lines, more }
  })
}

/** 回档记录（谁在什么时候把哪个键从哪版退到哪版） */export async function listRestoreLogs(gameId: string, limit = 10): Promise<RestoreLogRow[]> {
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
