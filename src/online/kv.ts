import { ApiError } from '../api/client'
import { gameKvDelete, gameKvGet, gameKvList, gameKvSet } from '../api/gameKv'
import { deleteGameKv, listGameKv, setGameKv } from '../db/db'
import { writeFailToast, type FailToast } from './write'

/* ============================================================
   在线版 · 插件存档（`host.storage` 的服务端实现）
   ------------------------------------------------------------
   本地版里 `storage.get/set/list` 就是 `gameKv` 的三次读写。
   在线版把**写**换成服务端、**读**仍然读 Dexie —— 和别的模块一致：

     读 = 拉取把服务端搬进 `gameKv`，UI / 插件照旧读 Dexie
     写 = 先打服务端，成功才写本地

   ★ 为什么 `get` 不现问服务端
     插件在**启动时**会连着 `get` 好几个键（存档、设置、进度）。
     每个都发一次请求，一个慢网下的开局就是好几秒的白屏；
     而拉取刚刚才把整份存档搬进来（`kv/list` 一次拿全），
     本地这份就是最新的。所以 `get` / `list` 读 Dexie，
     只有 `set` 走网络。

   ★ 为什么每个键要**串行**
     `set` 要带 `expected_version`（乐观锁）。两个 `set` 并发出去，
     第二个带的还是旧版本 ⇒ 必然 `10040701`，而且**不报错**的版本更糟：
     不带版本就退化成「后写的静默覆盖先写的」。所以同一个键的写
     排成一条链，一个写完再发下一个。

   ★ 版本号住在这个模块的内存里（`versions`）
     不写进 Dexie：它是「服务端的乐观锁令牌」，不是存档内容。
     丢了也不要紧 —— 下一次拉取（`seedKvVersions`）会重新种上；
     最坏情况是第一笔写不带版本（服务端按「不加锁」处理）。
   ============================================================ */

/** 存档版本冲突（多设备）。服务端 `GameKvVersionConflict` */
export const KV_VERSION_CONFLICT = 10040701
/** 未拥有该游戏。服务端 `checkGameExists` 的第三道闸 */
export const KV_GAME_NOT_OWNED = 10040401
/** 游戏已下架 */
export const KV_GAME_OFFLINE = 10040201
/** 保留键 / 权限不足 */
export const KV_FORBIDDEN = 604
/** 存档太大 */
export const KV_TOO_LARGE = 10030201

/** `gameId\u0000key` —— 用 `\0` 而不是 `:`，键名里允许冒号但不允许 NUL */
function vkey(gameId: string, key: string): string {
  return `${gameId}\u0000${key}`
}

/** 每个键的服务端版本号。拉取时种上，写成功后更新 */
const versions = new Map<string, number>()

/** 每个键的写入串行链（见头注释「为什么每个键要串行」） */
const chains = new Map<string, Promise<unknown>>()

/** 同一款游戏的提示条节流（插件写存档可能很频繁，别刷屏） */
const lastWarnAt = new Map<string, number>()
const WARN_GAP_MS = 5000

/* ---------------- 版本缓存 ---------------- */

/** 拉取时把服务端的版本号种进来。`null` = 没拉到，一个都别动 */
export function seedKvVersions(
  gameId: string,
  vs: Record<string, number> | null | undefined,
): void {
  if (!vs) return
  for (const [k, v] of Object.entries(vs)) versions.set(vkey(gameId, k), v)
}

/** 读一个键当前记着的版本（走查 / 单测用） */
export function kvVersionOf(gameId: string, key: string): number | undefined {
  return versions.get(vkey(gameId, key))
}

/** 卸载一款游戏时把它所有键的版本丢掉（否则重装后第一笔写会撞旧版本） */
export function dropKvVersions(gameId: string): void {
  const prefix = `${gameId}\u0000`
  for (const k of [...versions.keys()]) if (k.startsWith(prefix)) versions.delete(k)
  for (const k of [...chains.keys()]) if (k.startsWith(prefix)) chains.delete(k)
}

/** 只给单测用：把整份缓存清干净（模块级状态，测试之间必须隔离） */
export function resetKvState(): void {
  versions.clear()
  chains.clear()
  lastWarnAt.clear()
}

/* ---------------- 提示文案 ---------------- */

/**
 * 存档写失败的提示。
 *
 * 为什么要节流：插件可能在每次操作后都 `set` 一次。断网时每条都弹，
 * 屏幕会被提示条糊满，孩子反而看不到「要联网」这句话。
 */
export function kvFailToast(e: ApiError): FailToast {
  switch (e.code) {
    case KV_VERSION_CONFLICT:
      return {
        kind: 'warn',
        title: '存档在别的设备上改过',
        detail: '刚刚那一步可能没存上，回去看一眼',
        emoji: '🔀',
      }
    case KV_GAME_NOT_OWNED:
      return {
        kind: 'warn',
        title: '这个游戏还没兑换过',
        detail: '存档要存在你自己的游戏上，先去商城兑换',
        emoji: '🔒',
      }
    case KV_GAME_OFFLINE:
      return { kind: 'warn', title: '这个游戏下架了', detail: '存档存不上', emoji: '📦' }
    case KV_TOO_LARGE:
      return { kind: 'warn', title: '存档太大了', detail: '这一局没存上', emoji: '🗄️' }
    default:
      return writeFailToast(e, '这一局的存档')
  }
}

/** 同一个游戏 5 秒内只提示一次 */
function shouldWarn(gameId: string): boolean {
  const now = Date.now()
  const last = lastWarnAt.get(gameId) ?? 0
  if (now - last < WARN_GAP_MS) return false
  lastWarnAt.set(gameId, now)
  return true
}

/* ---------------- 读：走 Dexie（拉取已经把服务端搬进来了） ---------------- */

/**
 * 读一个键。
 *
 * ⚠️ 返回 `undefined` 表示「没存过」，**不是**「读失败」。
 * 读失败在在线版里表现为「拉取没成功 ⇒ 本地还是上次那份」，
 * 不会在这里抛 —— 插件启动时抛异常等于游戏打不开。
 */
export async function oKvGet<T>(gameId: string, key: string): Promise<T | undefined> {
  const all = await listGameKv(gameId)
  return all[key] as T | undefined
}

/** 列全部（**已滤掉 `__` 保留键**，和本地 `storage.list()` 一致） */
export async function oKvList(gameId: string): Promise<Record<string, unknown>> {
  const all = await listGameKv(gameId)
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(all)) {
    if (!k.startsWith('__')) out[k] = v
  }
  return out
}

/* ---------------- 写：先打服务端，成功才写本地 ---------------- */

/**
 * 写一个键（整块覆盖，和本地 `set()` 语义一致）。
 *
 * 失败**会抛** —— 这一点和游戏币那几扇门不同，是故意的：
 * `storage.set` 的契约本来就是 `Promise<void>`（本地版也可能 reject），
 * 而「存档没存上却装作存上了」是这个 App 最不能接受的失败方式。
 * 调用方（`hostApi`）会在抛之前弹一条提示。
 */
export async function oKvSet(gameId: string, key: string, value: unknown): Promise<void> {
  const k = vkey(gameId, key)
  const prev = chains.get(k) ?? Promise.resolve()
  /* `prev.then(run, run)`：前一个失败了也要接着发下一个，
     否则一次失败会把这条键的写链**永久卡死**（后面每次 set 都挂在 rejected 上）。 */
  const next = prev.then(
    () => runSet(gameId, key, value),
    () => runSet(gameId, key, value),
  )
  chains.set(
    k,
    next.catch(() => {}),
  )
  return next
}

async function runSet(gameId: string, key: string, value: unknown): Promise<void> {
  const k = vkey(gameId, key)
  const expected = versions.get(k) ?? 0
  let r: { key: string; version: number }
  try {
    r = await gameKvSet(gameId, key, value, expected)
  } catch (e) {
    if (e instanceof ApiError && e.code === KV_VERSION_CONFLICT) {
      /* 另一台设备写过。**以这台为准**：孩子正在这台机器上玩，
         他刚做的那一步必须留住；对方那份是上一次玩的结果。
         所以重读一次版本号再写一遍（而不是把本地覆盖成服务端的）。

         只重试一次：再撞说明两台设备在抢同一个键，重试也解决不了，
         不如把冲突抛给上层（提示「存档在别的设备上改过」）。 */
      const fresh = await gameKvGet(gameId, key)
      console.warn(
        `[kv] ${gameId}/${key} 版本冲突（本地 ${expected}，服务端 ${fresh.version}），` +
          `以本机为准重写一次`,
      )
      r = await gameKvSet(gameId, key, value, fresh.version)
    } else {
      throw e
    }
  }
  versions.set(k, r.version)
  // 服务端成功了才写本地 —— 反过来就是「本地有、云端没有」，换台设备就丢。
  await setGameKv(gameId, key, value)
}

/* ---------------- 拉取 ---------------- */

export interface KvPullResult {
  /** 写进本地的键数 */
  written: number
  /** 因为「本地版本更新」而跳过的键数（说明刚才有写穿还没被这次快照看到） */
  skipped: number
  /** 本地删掉的键数（服务端已经没有了） */
  removed: number
}

/**
 * 把一款游戏的存档从服务端搬进 `gameKv`。
 *
 * **抛异常**（`GameNotOwned` / 网络失败 / 下架）—— 由调用方决定要不要吞。
 * 但**绝不半途清空本地**：先拿到服务端那份，再逐个键动手。
 *
 * ## 版本比本地旧的键要跳过
 *
 * 拉取和写穿会并发：`set` 打完服务端、正在写 Dexie 时，一次拉取
 * 可能带着**更早的快照**回来。照写就把刚存的进度盖回去了，而且不报错。
 * 判据是版本号：`服务端版本 < 本地记着的版本` ⇒ 这份快照是旧的，跳过。
 */
export async function pullGameKv(gameId: string): Promise<KvPullResult> {
  const r = await gameKvList(gameId)
  const data = r.data ?? {}
  const vers = r.versions ?? {}
  const local = await listGameKv(gameId)

  let removed = 0
  // 1) 服务端已经没有的键（保留键不在此列 —— 它们从来不上云）
  for (const k of Object.keys(local)) {
    if (k.startsWith('__')) continue
    if (Object.prototype.hasOwnProperty.call(data, k)) continue
    await deleteGameKv(gameId, k)
    versions.delete(vkey(gameId, k))
    removed++
  }

  // 2) 服务端有的键
  let written = 0
  let skipped = 0
  for (const [k, v] of Object.entries(data)) {
    const sv = vers[k] ?? 0
    const lv = versions.get(vkey(gameId, k)) ?? -1
    if (lv > sv) {
      skipped++
      continue
    }
    await setGameKv(gameId, k, v)
    versions.set(vkey(gameId, k), sv)
    written++
  }
  return { written, skipped, removed }
}

/**
 * 卸载时删掉服务端的存档。
 *
 * 返回值分三种，因为调用方要做的决定不一样：
 *   · `ok` —— 删了（或本来就没有）
 *   · `no-game` —— 服务端不认识这款游戏 / 没拥有 ⇒ **当作删掉了**，
 *     那种游戏本来就没有云端存档（走查用的合成包、或本地预置的拥有）
 *   · `failed` —— 网络 / 5xx ⇒ **调用方不该清本地**，否则「卸载」变成了
 *     「本地删了、云端还在」，重装会捡到旧存档
 */
export async function deleteGameKvOnServer(
  gameId: string,
): Promise<'ok' | 'no-game' | 'failed'> {
  try {
    await gameKvDelete(gameId)
    dropKvVersions(gameId)
    return 'ok'
  } catch (e) {
    if (
      e instanceof ApiError &&
      (e.code === KV_GAME_NOT_OWNED || e.code === 10040101 /* game-not-exist */)
    ) {
      dropKvVersions(gameId)
      return 'no-game'
    }
    return 'failed'
  }
}

/** 把失败翻成一句提示（`hostApi` 在抛之前调它） */
export function warnKvFailure(gameId: string, e: unknown, push: (t: FailToast) => void): void {
  const err =
    e instanceof ApiError
      ? e
      : new ApiError(-1, (e as { message?: string })?.message || '存档没存上')
  if (!shouldWarn(gameId)) return
  push(kvFailToast(err))
}
