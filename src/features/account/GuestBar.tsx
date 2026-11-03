import { useAccount } from '@/store/useAccount'
import { useApp } from '@/store/useApp'
import { isOnlineMode } from '@/sync/pull'

/* ============================================================
   临时账号横条（2026-11-03）
   ------------------------------------------------------------
   在线版启动时会自动建一个游客账号，孩子不用注册就能玩。代价是
   **东西会丢**（换手机 / 清数据 / 卸载），而 App 里原本看不出来。

   所以这一条常驻在顶栏下面，只说两件事：
     · 你现在是临时账号
     · 点一下就能存下来

   ## 为什么不放顶栏里面

   顶栏那一行已经挤满了（头像 + 名字 + 三颗币 + 两个按钮），
   `App.tsx` 里那段注释写着「这一行的余量已经用完了」——
   再塞一个胶囊进去，名字会被压成一个字。

   横条放顶栏**下面**（和「连不上服务器」那条同一个位置）：
   不抢任何横向空间，也不挡内容。

   ## 为什么字会变

   刚进来时他手里什么都没有，「换手机就没了」听着像吓唬人。
   等他真攒了积分和券，把数字写出来才是**具体的损失** ——
   「已经攒了 24 分」比「进度会丢」有用得多。

   这条横条**不弹窗、不挡操作**，看不看随他。真要拦的那一步是花兑换券
   （服务端拒），那才会强制弹面板。
   ============================================================ */

export function GuestBar() {
  const session = useAccount((s) => s.session)
  const openBind = useAccount((s) => s.openBind)
  const balance = useApp((s) => s.balance)
  const harvestBalance = useApp((s) => s.harvestBalance)

  if (!isOnlineMode) return null
  if (!session?.user?.is_guest) return null

  /* 只报**能拿走的东西**：积分和兑换券。任务条数、农场等级这些
     说出来是虚的，数字越大越像营销话术。 */
  const parts: string[] = []
  if (balance > 0) parts.push(`${balance} 分`)
  if (harvestBalance > 0) parts.push(`${harvestBalance} 张券`)

  return (
    <div
      data-guest-bar
      role="status"
      className="border-b border-grape-500/15 bg-grape-50 py-1.5 text-[11.5px] font-bold leading-snug text-ink-700"
    >
      {/* 外层不写 `px-4`：内层 `pl-safe pr-safe` 已经是 calc(env + 1rem)，
          两个一起写会叠成 2rem（见 SyncBanner 同一处注释）。 */}
      <div className="page-col flex items-center gap-2 pl-safe pr-safe">
        <span className="shrink-0 text-sm">🔖</span>
        <span data-guest-bar-text className="min-w-0 flex-1 truncate">
          {parts.length > 0
            ? `临时账号 · 已经攒了 ${parts.join(' · ')}，存下来才丢不了`
            : '临时账号 · 换手机或清数据就找不回来了'}
        </span>
        <button
          data-guest-bar-save
          onClick={() => openBind('manual')}
          className="btn shrink-0 rounded-full bg-grape-400 px-2.5 py-1 text-[11.5px] font-extrabold text-white shadow-flat active:btn-press"
        >
          保存进度
        </button>
      </div>
    </div>
  )
}
