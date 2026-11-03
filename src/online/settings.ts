import type { AppSettings } from '../domain/types'
import { DEFAULT_SETTINGS, getMeta, saveSettings, setMeta } from '../db/db'
import { getSession } from '../api/session'
import { settingsGet, settingsSave, type ServerSettings } from '../api/settings'

/* ============================================================
   在线版 · 家长设置的上云 / 下云
   ------------------------------------------------------------
   产品定义：账号才是数据源。所以家长设置（小名、头像、家长锁、
   音量、限时、农场规则…）必须跟着账号走，换台设备登录就还在。

   ★ 存**整份 JSON**，不是一列一个字段。理由见 `api/settings.ts` 头注释。

   ★ 哪些字段**不上云**（`DEVICE_LOCAL_SETTING_KEYS`）：
     只有 `gameClock`（今天已经玩了多久）。它是**用量**，不是配置：
       · 它每 60 秒落一次盘（`GamePlayGate` 的 FLUSH_EVERY），上云就是
         一分钟一个 POST；
       · 它是「限时」这道闸的**执行依据**，写穿意味着断网时本地也写不进去
         ⇒ 时长不累计 ⇒ 孩子无限玩。这条最要命；
       · 真要做成跨设备共享额度，光上传不够：拉取时还得按「同一天取
         max(本地, 云端)」合并，否则杀掉 App 重开就能把额度刷回去。
         那是另一件事，没做之前别半吊子地传上去。
     所以它保持「仅本地」，和备份那边（`stripDeviceLocal`）同一个口径。

   ⚠️ **`parentPin` 上云是明确选择**，别照着备份那份清单把它也剥掉：
      备份会被发到微信 / 网盘（所以剥），而云端是家长自己的账号、
      换设备时要能用同一个 PIN 开门（所以要传）。
      两处清单不一样是**有意的**，别「统一」。

   ★ `version` 只为一件事：**别用旧响应盖掉新写入**。
     `refresh()` 会并发跑，`get` 的响应可能比一次 `save` 晚回来；
     没有这道闸的话，刚存进去的设置会被上一份读结果覆盖回本地 meta。
   ============================================================ */

/**
 * 只属于这台设备的字段 —— 不进云端 payload。
 *
 * 加字段前先问：它是不是「用量 / 本机硬件相关」？是的话加到这里，
 * 并且想清楚「拉取时它怎么办」（现在是：一律保留本机的）。
 */
export const DEVICE_LOCAL_SETTING_KEYS = ['gameClock'] as const

const DEVICE_LOCAL_SET = new Set<string>(DEVICE_LOCAL_SETTING_KEYS)

/**
 * 这次改动**只**碰了设备本地字段吗？
 *
 * 用来免掉无意义的网络往返：`gameClock` 每 60 秒改一次，
 * 但它根本不进 payload —— 那就没必要发请求，本地落盘就够了。
 */
export function isDeviceLocalOnly(patch: Partial<AppSettings>): boolean {
  const keys = Object.keys(patch)
  return keys.length > 0 && keys.every((k) => DEVICE_LOCAL_SET.has(k))
}

/** 进云端的 payload（剥掉设备本地字段）。空对象也是合法 JSON 对象。 */
export function cloudPayload(s: AppSettings): string {
  const out: Record<string, unknown> = { ...s }
  for (const k of DEVICE_LOCAL_SETTING_KEYS) delete out[k]
  return JSON.stringify(out)
}

/**
 * 把云端 payload 合回一份能用的 `AppSettings`。
 *
 * @returns 解析不出来（空串 / 坏 JSON / 顶层不是对象）时返回 `null` ——
 *          调用方据此「保留本地那份」，而不是把设置清成默认值。
 */
export function settingsFromCloud(payload: string, local: AppSettings): AppSettings | null {
  if (!payload.trim()) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const merged = { ...(parsed as Record<string, unknown>) }
  /* 设备本地字段**不认云端的值**（和 `importBackup` 同一条规矩：
     云端那份可能是别的设备、别的日子留下的）。留着本机的。 */
  for (const k of DEVICE_LOCAL_SETTING_KEYS) {
    delete merged[k]
    const mine = (local as unknown as Record<string, unknown>)[k]
    if (mine !== undefined) merged[k] = mine
  }
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

/** 单测用：把版本闸门复位 */
export function resetSettingsSyncState(): void {
  lastVersion = 0
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
