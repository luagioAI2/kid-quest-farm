import type { AppSettings, GameClock } from '../domain/types'
import { mergeGameClock } from '../domain/gameTime'
import { DEFAULT_SETTINGS, getMeta, saveSettings, setMeta } from '../db/db'
import { getSession } from '../api/session'
import { settingsGet, settingsSave, type ServerSettings } from '../api/settings'

/* ============================================================
   在线版 · 家长设置的上云 / 下云
   ------------------------------------------------------------
   产品定义：账号才是数据源。所以家长设置（小名、头像、家长锁、
   音量、限时、农场规则…）必须跟着账号走，换台设备登录就还在。

   ★ 存**整份 JSON**，不是一列一个字段。理由见 `api/settings.ts` 头注释。

   ★ 有一类字段**上云但要特殊对待**（`USAGE_SETTING_KEYS`）：用量。

     只有 `gameClock`（今天已经玩了多久）。它必须上云 —— 否则重装 App、
     换台设备、清一次缓存，**每日限时就重置了**，而「限时」正是家长控件的
     核心保证（孩子发现重装就能重来，这道闸等于没有）。

     但它不能像普通设置那样「写穿」：
       · 它每 60 秒落一次盘（`GamePlayGate` 的 FLUSH_EVERY）⇒ 一分钟一个 POST；
       · 写穿意味着断网时本地也写不进去 ⇒ 时长不累计 ⇒ **孩子无限玩**。

     所以用量走**尽力而为**：本地先落盘（时钟必须一直走），推送
     ① 累计多 5 分钟才推一次（`shouldPushUsage`）；
     ② 失败不回退、不弹提示（下一次 tick 会重试）。
     拉取侧按「同一天取 max(本地, 云端)」合并（`mergeGameClock`），
     否则杀掉 App 重开就能把额度刷回去。

     ⚠️ 备份那边（`stripDeviceLocal`）**仍然剥** `gameClock`：备份文件会被
     发到微信 / 网盘，带着「这台设备今天玩了多久」只会造成
     「导入一份玩之前的备份就把额度刷回去」。两处口径不一样是**有意的**。

   ⚠️ **`parentPin` 上云是明确选择**，别照着备份那份清单把它也剥掉：
      备份会被发到微信 / 网盘（所以剥），而云端是家长自己的账号、
      换设备时要能用同一个 PIN 开门（所以要传）。
      两处清单不一样是**有意的**，别「统一」。

   ★ `version` 只为一件事：**别用旧响应盖掉新写入**。
     `refresh()` 会并发跑，`get` 的响应可能比一次 `save` 晚回来；
     没有这道闸的话，刚存进去的设置会被上一份读结果覆盖回本地 meta。
   ============================================================ */

/**
 * 上云、但要走「尽力而为 + 节流」的字段：用量。
 *
 * 加字段前先问：它是不是「每几十秒就动一次的执行依据」？
 * 是的话加到这里，并且想清楚两件事：
 *   · 推送失败时能不能影响本地（用量**不能** —— 时钟必须一直走）；
 *   · 拉取时怎么合并（用量是单调累加的，取 max；直接覆盖会让额度用不完）。
 */
export const USAGE_SETTING_KEYS = ['gameClock'] as const

const USAGE_SET = new Set<string>(USAGE_SETTING_KEYS)

/**
 * 这次改动**只**碰了用量字段吗？
 *
 * 只碰它 ⇒ 走 `pushUsageBestEffort`（本地先落盘、网络尽力而为），
 * 而不是普通设置的「写穿 + 失败回退」。
 */
export function isUsageOnly(patch: Partial<AppSettings>): boolean {
  const keys = Object.keys(patch)
  return keys.length > 0 && keys.every((k) => USAGE_SET.has(k))
}

/** 进云端的 payload —— 现在是**整份**（`gameClock` 也上，见 `USAGE_SETTING_KEYS`）。 */
export function cloudPayload(s: AppSettings): string {
  return JSON.stringify(s)
}

/**
 * 把云端 payload 合回一份能用的 `AppSettings`。
 *
 * @returns 解析不出来（空串 / 坏 JSON / 顶层不是对象）时返回 `null` ——
 *          调用方据此「保留本地那份」，而不是把设置清成默认值。
 */
export function settingsFromCloud(
  payload: string,
  local: AppSettings,
  now: number = Date.now(),
): AppSettings | null {
  if (!payload.trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const merged = { ...(parsed as Record<string, unknown>) }

  /* 用量字段：**不能**直接用云端那份。
     云端那份可能是另一台设备、也可能比本机少（那台设备刚开），
     直接覆盖就会「拉一次退回去一点」⇒ 额度永远用不完。
     规则是「同一天取 max」，见 `mergeGameClock`。 */
  const dayStartHour =
    typeof merged.dayStartHour === 'number' ? merged.dayStartHour : local.dayStartHour
  merged.gameClock = mergeGameClock(
    local.gameClock,
    merged.gameClock as GameClock | undefined,
    dayStartHour,
    now,
  )

  return merged as unknown as AppSettings
}

/**
 * 本地这份设置**是谁的**（uid）。
 *
 * 为什么需要它：`signOut` 不清 Dexie（离线也要能退出去），所以同一台设备
 * 换账号登录时，meta 里还留着上一个账号的设置。而「云端为空 ⇒ 把本机推上去」
 * 这条迁移逻辑，遇到「新账号云端也是空的」就会把**上一个人的小名和家长锁 PIN
 * 推到这个人的账号里** —— 换个人登录，等于把别人的家长密码送出去。
 *
 * 所以推之前先问一句：本地这份是我的吗？
 *   · `owner` 为 null（从没记过）= 升级上来的老数据，当作自己的，允许推；
 *   · `owner` 是别人 ⇒ 一个字都不许推，只用云端那份（没有就留默认值）。
 */
const OWNER_KEY = 'settings.owner'

function uidNow(): number | null {
  return getSession()?.user?.uid ?? null
}

/** 已知的服务端最新 version（本进程内） */
let lastVersion = 0

/** 累计多这么多秒才推一次用量（60 秒一次会把请求打满） */
export const USAGE_PUSH_EVERY_SEC = 300

/** 上一次成功推上去的用量 */
let lastPushedUsage: GameClock | null = null
/** 有一次用量推送在飞：别叠起来（断网时每次都要等到超时） */
let usageInFlight = false

/** 单测用：把版本闸门和节流状态一起复位 */
export function resetSettingsSyncState(): void {
  lastVersion = 0
  lastPushedUsage = null
  usageInFlight = false
}

/** 这次该不该把用量推上去（节流） */
export function shouldPushUsage(clock: GameClock | undefined): boolean {
  if (!clock || usageInFlight) return false
  /* 第一次、或者跨天了 ⇒ 推。跨天那次要把「新的一天」也告诉云端，
     否则云端永远停在昨天，换台设备拉下来就是「昨天玩满了」。 */
  if (!lastPushedUsage || lastPushedUsage.day !== clock.day) return true
  return clock.sec - lastPushedUsage.sec >= USAGE_PUSH_EVERY_SEC
}

/**
 * 尽力而为地把用量推上去：**不抛、不回退、不弹提示**。
 *
 * 三条都是硬要求，理由在文件头：用量是「限时」的执行依据，
 * 网络问题绝不能让它停下来；而它每 60 秒动一次，弹提示会把屏幕糊满。
 *
 * 放在这一层（而不是 store 里）是因为节流状态要和 `pullSettings` 共用。
 */
export async function pushUsageBestEffort(s: AppSettings): Promise<void> {
  const clock = s.gameClock
  if (!shouldPushUsage(clock)) return
  usageInFlight = true
  try {
    await oSaveSettings(s)
    if (clock) lastPushedUsage = { day: clock.day, sec: clock.sec }
  } catch {
    /* 断网 / 未登录：什么都不做，下一次 tick 会重试 */
  } finally {
    usageInFlight = false
  }
}

/** 普通设置推成功之后也叫一次：那一份 payload 里带着当时的用量 */
export function noteUsagePushed(clock: GameClock | undefined): void {
  if (clock) lastPushedUsage = { day: clock.day, sec: clock.sec }
}

/** 本进程内已知的服务端 version（单测断言用） */
export function currentServerVersion(): number {
  return lastVersion
}

/**
 * 写穿：把整份设置推上服务端。失败**抛**（由调用方 `onlineWrite` 收成结论）。
 *
 * 返回服务端回显（含它记下的 `version` / `updated_at`）。
 */
export async function oSaveSettings(s: AppSettings): Promise<ServerSettings> {
  // 序号自增：服务端只存不用，客户端拿它判断「响应是不是比我手上的新」
  const next = lastVersion + 1
  const r = await settingsSave(cloudPayload(s), next)
  // 服务端回显优先（并发写时它可能是更大的序号）
  lastVersion = Math.max(lastVersion, r.version)
  const uid = uidNow()
  if (uid !== null) await setMeta(OWNER_KEY, uid)
  return r
}

export type PullSettingsStatus =
  /** 云端有设置，已写进本地 meta */
  | 'applied'
  /** 云端从没存过，已把本机这份推上去（老账号首次上云） */
  | 'pushed'
  /** 云端没有、也推不上去（网络 / 未登录）—— 保留本机 */
  | 'kept'
  /** 本地这份是**上一个账号**的：已重置成默认值，一个字都没推上去 */
  | 'reset'
  /** 有更新的本地写入在飞，这次读结果过期了，丢弃 */
  | 'stale'

/**
 * 拉取：云端 → 本地 meta。
 *
 * 两条容易写错的地方：
 *
 * ① **云端为空不等于「用默认值」**。老账号（上云之前就在用）云端是空的，
 *    这时候必须把本机这份**推上去**，否则「所有数据在服务器」是句假话：
 *    家长在这台设备上的小名、PIN、限时永远上不去，换台设备就全丢。
 * ② **读结果可能比一次写更旧**。`refresh()` 并发跑，`get` 晚回来时
 *    本地 meta 已经被那次写更新过了 —— 用 `version` 闸门丢掉它。
 */
export async function pullSettings(local: AppSettings): Promise<PullSettingsStatus> {
  const uid = uidNow()
  const owner = await getMeta<number | null>(OWNER_KEY, null)
  /* `null` = 从没记过（升级上来的老数据），当作自己的；否则必须同一个 uid */
  const mine = owner === null || owner === uid

  const r = await settingsGet()

  if (r.version < lastVersion) return 'stale'
  lastVersion = Math.max(lastVersion, r.version)

  const remote = settingsFromCloud(r.payload, local)
  if (remote) {
    await saveSettings(remote)
    if (uid !== null) await setMeta(OWNER_KEY, uid)
    return 'applied'
  }

  /* 云端没有（或坏得没法用），而本地这份**不是我的** —— 换账号了。
     这时候推上去等于把上一个人的家长锁 PIN 送进新账号；留着不推也不对：
     新账号会看到**上一个人的小名**，而且被上一个人的 PIN 锁在家长区外面。
     所以整份重置成默认值（连 `gameClock` 一起 —— 那是上一个人今天玩的时长，
     留着会吃掉这个人的额度）。 */
  if (!mine) {
    await saveSettings({ ...DEFAULT_SETTINGS, farmClock: { ...DEFAULT_SETTINGS.farmClock } })
    if (uid !== null) await setMeta(OWNER_KEY, uid)
    return 'reset'
  }

  try {
    await oSaveSettings(local)
    return 'pushed'
  } catch {
    return 'kept'
  }
}
