import { useEffect, useState } from 'react'
import { Portal } from '@/components/Portal'
import { useAccount } from '@/store/useAccount'
import { useApp } from '@/store/useApp'
import { isOnlineMode } from '@/sync/pull'
import { LoginSheet } from './LoginSheet'

/* ============================================================
   在线版 · 登录闸门（2026-11-02）
   ------------------------------------------------------------
   服务器版的**数据源是账号**：没登录就没有任务、没有积分、没有农场
   （`seedIfEmpty` 在在线模式下直接 return，不播种）。

   在这之前，未登录的人看到的是**一整套空界面**：今日任务 0 条、
   余额 0、农场空着 —— 而登录入口藏在「设置 → 标题栏右上角 👤」三层里。
   家长的第一反应会是「这 App 坏了」，而不是「我该登录」。

   所以这一屏只做一件事：**说清楚为什么必须登录，并给出按钮。**

   ★ 为什么是「盖在上面」而不是 `if (!session) return <LoginGate/>`：
     外壳里那条早退会让整棵树重建，登录成功后所有子页重新挂载、
     `useState` 全丢（memory 里的硬约束）。这里做成 Portal 覆盖层，
     登录成功只是**把覆盖层摘掉**，底下的界面还是原来那棵树。
   ============================================================ */

export function OnlineLoginGate() {
  const session = useAccount((s) => s.session)
  const [open, setOpen] = useState(false)

  /* 登录成功之后要重新拉一次 —— 启动时的 boot 是「未登录」跑的，
     那时候 `pullFromServer` 直接返回 `no-session`，一条数据都没拉到。
     不补这一步，家长登录完看到的还是空界面，会以为登录没成功。 */
  useEffect(() => {
    if (!session) return
    void useApp.getState().refresh()
  }, [session])

  // 本地版没有账号这个概念，闸门整个不出现
  if (!isOnlineMode || session) return null

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-paper px-6 text-center"
        data-online-gate
      >
        <div className="text-6xl">🌤️</div>

        <h1 className="font-display text-2xl font-extrabold leading-snug text-ink-900">
          先登录，孩子的数据才在云上
        </h1>

        <p className="max-w-xs text-[15px] leading-relaxed text-ink-700">
          这个版本把任务、积分和农场都放在服务器上。
          换一台设备登录同一个账号，看到的就是同一份数据。
        </p>

        <button
          onClick={() => setOpen(true)}
          className="btn mt-1 w-full max-w-xs rounded-2xl bg-sun-300 px-6 py-3.5 font-display text-lg font-extrabold text-ink-900 shadow-flat"
          data-online-gate-login
        >
          登录 / 注册
        </button>

        <p className="text-sm text-ink-500">还没有账号？点上面那个按钮，同一屏里可以注册。</p>
      </div>

      <LoginSheet open={open} onClose={() => setOpen(false)} />
    </Portal>
  )
}
