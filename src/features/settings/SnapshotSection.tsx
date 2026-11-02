import { useCallback, useEffect, useState } from 'react'
import type { RestoreLogRow } from '../../api/snapshot'
import {
  isAutoNote,
  listMoments,
  listRestoreLogs,
  momentLabel,
  reasonLabel,
  restoreToMoment,
  saveSnapshotNow,
  snapshotFailText,
  type Moment,
} from '../../online/snapshot'

/* ============================================================
   家长栏 → 游戏详情 →「存档还原点」
   ------------------------------------------------------------
   回答一个问题：**孩子把存档玩坏了，能不能退回去。**

   为什么放在详情最上面（而不是列表行上）：
   列表行一款游戏只留一个动作（装 / 卸 / 设为当前），这是 iOS 应用市场的口径，
   也是这个项目 2026-10-25 合并三张卡时定下的。还原点是**低频 + 不可逆**的操作，
   不该躺在孩子每天滚的那一屏里。

   ★ 只有在线版才有这一节（父组件判 `isOnlineMode`）。
     本地版的历史版本根本不存在 —— 摆一个空壳只会让人以为「功能坏了」。

   ★ 回档只在这里做，而这里**插件是卸载状态**（`PluginGameHost` 在离开游戏页时
     就调了 unmount）。所以不存在「插件内存里还是旧状态」的问题：
     回档后拉一次，孩子再打开游戏就是重挂载、读新存档。
   ============================================================ */

/** 存档很小，别显示成「0 KB」 */
function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} 字节`
  return `${Math.round(bytes / 1024)} KB`
}

export function SnapshotSection({ gameId, gameName }: { gameId: string; gameName: string }) {
  /** `null` = 还在读。空数组 = 读完了但没有还原点 */
  const [moments, setMoments] = useState<Moment[] | null>(null)
  const [logs, setLogs] = useState<RestoreLogRow[]>([])
  const [err, setErr] = useState('')
  const [flash, setFlash] = useState('')
  const [busy, setBusy] = useState<'' | 'save' | 'restore'>('')
  /** 正在二次确认的那一个还原点 */
  const [confirmAt, setConfirmAt] = useState<number | null>(null)

  const reload = useCallback(async () => {
    try {
      const [ms, ls] = await Promise.all([listMoments(gameId), listRestoreLogs(gameId, 5)])
      setMoments(ms)
      setLogs(ls)
      setErr('')
    } catch (e) {
      setMoments([])
      setErr(snapshotFailText(e))
    }
  }, [gameId])

  useEffect(() => {
    void reload()
  }, [reload])

  const onSave = () => {
    void (async () => {
      setBusy('save')
      setFlash('')
      try {
        const r = await saveSnapshotNow(gameId, '手动')
        setFlash(
          r.keys > 0
            ? `存好了，一共 ${r.keys} 个存档。`
            : '这个游戏还没有存档，先让孩子玩一局再来存。',
        )
        await reload()
      } catch (e) {
        setErr(snapshotFailText(e))
      } finally {
        setBusy('')
      }
    })()
  }

  const onRestore = (at: number) => {
    void (async () => {
      setBusy('restore')
      setConfirmAt(null)
      setFlash('')
      try {
        const r = await restoreToMoment(gameId, at, '家长回档')
        setFlash(
          r.restored > 0
            ? `已经退回到${momentLabel(at)}，重新打开游戏就是那时候的进度。`
            : '那个时间点没有可用的还原点，换一个试试。',
        )
        await reload()
      } catch (e) {
        setErr(snapshotFailText(e))
      } finally {
        setBusy('')
      }
    })()
  }

  return (
    <section className="mt-5" data-snapshot-section={gameId}>
      <h4 className="font-display text-base font-extrabold text-ink-900">存档还原点</h4>
      <p className="mt-1 text-sm leading-relaxed text-ink-700">
        {gameName}玩的时候，系统会自己存还原点（大概十分钟一个，存档变化大的时候也会存）。
        孩子要挑战难关之前，也可以现在手动存一个。
      </p>

      <button
        data-snapshot-save={gameId}
        disabled={busy !== ''}
        onClick={onSave}
        className="btn mt-2.5 h-10 w-full rounded-full bg-sky-300 text-sm font-extrabold text-ink-900 shadow-flat active:btn-press disabled:opacity-50"
      >
        {busy === 'save' ? '正在存…' : '现在存一个还原点'}
      </button>

      {flash && (
        <p
          data-snapshot-flash
          className="mt-2 rounded-2xl bg-grass-100 px-3 py-2 text-[12.5px] font-bold leading-snug text-ink-700"
        >
          {flash}
        </p>
      )}
      {err && (
        <p
          data-snapshot-error
          className="mt-2 rounded-2xl bg-berry-100 px-3 py-2 text-[12.5px] font-bold leading-snug text-ink-700"
        >
          {err}
        </p>
      )}

      {/* ---------- 还原点列表 ---------- */}
      {moments === null ? (
        <p className="mt-3 text-sm text-ink-500">正在读还原点…</p>
      ) : moments.length === 0 ? (
        <p data-snapshot-empty className="mt-3 text-sm leading-relaxed text-ink-500">
          还没有还原点。孩子玩过之后，这里会自动出现。
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {moments.map((m) => (
            <li
              key={m.at}
              data-snapshot-moment={m.at}
              className="rounded-2xl border-2 border-ink-900/10 bg-white px-3 py-2.5"
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 text-sm font-extrabold text-ink-900">
                  {momentLabel(m.at)}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-ink-500">
                  {m.keys.length} 个存档 · {sizeText(m.size)}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {m.reasons.slice(0, 2).map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-ink-100 px-2 py-0.5 text-[10.5px] font-bold text-ink-600"
                  >
                    {reasonLabel(r)}
                  </span>
                ))}
                {m.baseline && (
                  <span className="rounded-full bg-grass-100 px-2 py-0.5 text-[10.5px] font-bold text-grass-700">
                    当天起点
                  </span>
                )}
                {m.note && !isAutoNote(m.note) && (
                  <span className="text-[11px] text-ink-500">{m.note}</span>
                )}
              </div>

              {confirmAt === m.at ? (
                <div className="mt-2 rounded-2xl bg-berry-100 px-3 py-2.5">
                  <p className="text-[12.5px] leading-snug text-ink-700">
                    退回到{momentLabel(m.at)}？孩子现在的进度会被这份盖掉。
                    退回之前的进度会先存一份，所以还能再退回来。
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      data-snapshot-confirm={m.at}
                      disabled={busy !== ''}
                      onClick={() => onRestore(m.at)}
                      className="btn h-9 flex-1 rounded-full bg-berry-500 text-[13px] font-extrabold text-white active:btn-press disabled:opacity-50"
                    >
                      {busy === 'restore' ? '正在退回…' : '确认退回'}
                    </button>
                    <button
                      onClick={() => setConfirmAt(null)}
                      className="btn h-9 flex-1 rounded-full bg-white text-[13px] font-extrabold text-ink-700 active:btn-press"
                    >
                      取消
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  data-snapshot-restore={m.at}
                  disabled={busy !== ''}
                  onClick={() => setConfirmAt(m.at)}
                  className="btn mt-2 h-9 w-full rounded-full bg-white text-[13px] font-extrabold text-ink-700 shadow-flat active:btn-press disabled:opacity-50"
                >
                  退回到这里
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* ---------- 回档记录 ---------- */}
      {logs.length > 0 && (
        <div className="mt-4" data-snapshot-logs>
          <h5 className="text-[12px] font-extrabold text-ink-600">退回过</h5>
          <ul className="mt-1 space-y-0.5">
            {logs.map((l) => (
              <li key={l.id} className="text-[11.5px] leading-snug text-ink-500">
                {momentLabel(l.created_at)} 把「{l.key}」退回了以前的版本
                {l.reason ? `（${l.reason}）` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
