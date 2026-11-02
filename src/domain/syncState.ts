import { toDateKey } from './time'

/* ============================================================
   「上一次从服务端拉到了没有」—— 在线版界面要说清这件事
   ------------------------------------------------------------
   在线版的读路径是「服务端 → Dexie → UI」，拉取失败时**不抛**
   （没网也要能进 App），于是界面会安静地显示**旧数据**：

     · 老设备上：昨天的任务、昨天的余额，看着像今天；
     · 新设备上：一片空白 —— 孩子只会说「我的任务都不见了」。

   两种都不是「网络断了」，而是「数据没了」。所以要把这件事说出来。
   ============================================================ */

export interface SyncState {
  /**
   * 上一次**成功**拉到数据的本机时间（毫秒）。`0` = 从来没成功过。
   *
   * ⚠️ 单位是**本机毫秒**（`Date.now()`），不是服务端那种 Unix 秒。
   *    服务端时间在 `online/snapshot.ts` 的 `momentLabel` 里收的是**秒**，
   *    两个混用会静默差 1000 倍（→ 1970）。所以这里各写一份格式化，
   *    宁可重复几行，也不做那个转换。
   */
  lastOkAt: number
  /** 上一次失败的原因；`null` = 上一次是成功的 */
  failure: string | null
}

/** 初始态：还没同步过，也没失败过（所以不显示横幅） */
export const SYNC_OK: SyncState = { lastOkAt: 0, failure: null }

/**
 * 落库用的键（Dexie `meta` 表）。
 *
 * ★ 为什么要落库：`lastOkAt` 只在内存里的话，**一重开 App 就归零** ——
 *   断网启动时界面会说「这台设备还没有同步过内容」，而 Dexie 里明明有昨天的数据。
 *   那句话会把家长吓得去重装。
 *
 * ⚠️ 它是**设备本地状态**（「这台机器上次什么时候连上过」），导出时要剥掉：
 *   跟着备份跑到另一台设备上，那边会显示一个它从来没发生过的同步时间。
 */
export const SYNC_LAST_OK_KEY = 'sync.lastOkAt'

/** 「今天 21:40」/「昨天 20:11」/「11月1日 09:30」（收本机毫秒） */
export function syncedAtLabel(ms: number, now = Date.now()): string {
  const d = new Date(ms)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (toDateKey(ms) === toDateKey(now)) return `今天 ${hm}`
  if (toDateKey(ms) === toDateKey(now - 86_400_000)) return `昨天 ${hm}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`
}

/**
 * 横幅上的那句话。`null` = 不显示。
 *
 * 两句话要分开，因为**该做的事不一样**：
 *   · 从来没同步过 ⇒ 这台设备上什么都没有，先查网络（不然家长会以为数据丢了）；
 *   · 有旧数据      ⇒ 告诉他「看到的是几点的」，别让他把昨天的任务当今天的做。
 *
 * ⚠️ 别把失败原因（`pull-failed` / `ApiError: 401`）写进去：那是给我们看的。
 */
export function syncBannerText(s: SyncState, now = Date.now()): string | null {
  if (s.failure === null) return null
  if (!(s.lastOkAt > 0)) {
    return '连不上服务器，这台设备还没有同步过内容。检查一下网络，再点「再试一次」。'
  }
  return `连不上服务器。你看到的是${syncedAtLabel(s.lastOkAt, now)} 同步的内容，新的任务和积分要等网络好了才出现。`
}
