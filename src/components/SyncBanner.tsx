import { useState } from 'react'
import { useApp } from '../store/useApp'
import { useAccount } from '../store/useAccount'
import { isOnlineMode } from '../sync/pull'
import { syncBannerText } from '../domain/syncState'

/**
 * 「现在连不上服务器」的横幅。
 *
 * 为什么需要它：在线版的读路径是「服务端 → Dexie → UI」，而拉取失败是**静默**的
 * （没网也要能进 App）。于是界面会安静地显示旧数据 —— 老设备上是昨天的任务和余额，
 * 新设备上是一片空白。两种都会被当成「数据没了」。
 *
 * ⚠️ 它只负责**说清楚**，不负责拦住任何东西：
 *    写操作自己会弹「刚才那一步没有生效」（`online/write.ts`），
 *    在这里再拦一道只会让「看一眼任务」都变得不可能。
 */
export function SyncBanner() {
  const syncState = useApp((s) => s.syncState)
  const refresh = useApp((s) => s.refresh)
  const ensureGuest = useAccount((s) => s.ensureGuest)
  /* 原始切片 + 布尔派生：selector 返回新对象会让 zustand 每轮都重渲染（React #185） */
  const hasSession = useAccount((s) => s.session !== null)
  const [busy, setBusy] = useState(false)

  if (!isOnlineMode) return null
  const text = syncBannerText(syncState)
  if (!text) return null

  /*
   * ⚠️ 外层**不能**写 `px-4`：内层用了 `pl-safe pr-safe`（= env + 1rem），
   *    两个一起写会叠成 2rem，手机上左右各多缩进 16px
   *    （`styles/theme.css` 里 `pl-safe` 那条注释说的就是这件事）。
   */
  return (
    <div
      data-sync-banner
      role="status"
      className="border-b border-sun-300 bg-sun-100 py-2 text-[12px] font-bold leading-snug text-ink-700"
    >
      <div className="page-col flex items-center gap-2 pl-safe pr-safe">
        <span className="shrink-0 text-base">📡</span>
        <span className="min-w-0 flex-1">{text}</span>
        <button
          data-sync-retry
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              /* ★ 先确认「有没有账号」，再拉数据（2026-11-03）。
                 启动那一刻如果连不上服务器，`ensureGuest` 建游客就失败了，
                 于是整台设备**一个令牌都没有**。这时候只重拉数据是没用的：
                 没有令牌，拉取照样失败，横条一直在，界面永远是空的 ——
                 而人不会想到「要重启一次 App」。
                 `ensureGuest` 是幂等的：已经有会话就立刻返回，不会多打一次请求。 */
              if (!hasSession) await ensureGuest()
              await refresh()
            } finally {
              setBusy(false)
            }
          }}
          className="btn shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-extrabold text-ink-800 shadow-flat active:btn-press disabled:opacity-60"
        >
          {busy ? '正在连…' : '再试一次'}
        </button>
      </div>
    </div>
  )
}
