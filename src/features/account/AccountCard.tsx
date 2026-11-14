import { useState } from 'react'
import { useAccount } from '@/store/useAccount'
import { Card } from '../settings/ui'
import { LoginSheet } from './LoginSheet'

/* ============================================================
   账号卡（设置 → 规则，家长区）
   ------------------------------------------------------------
   放「规则」页而不是「孩子」页：登录是**家长的动作**，而规则页本来
   就有家长密码闸门（`protectParentActions`），天然挡住了孩子。

   ## 2026-11-03：三种状态，不是两种

   自动游客账号上线之后，「登录了 / 没登录」这个二分法不成立了：

     · **临时账号**（游客）—— 能玩，但账号只认这台手机里的一串本机号。
       这里是家长最该看到「保存进度」的地方：他本来就在看设置，
       而且这一刻他手里有手机号。
     · **正式账号** —— 显示昵称和脱敏手机号 + 退出登录。
     · **还没有账号**（连不上服务器）—— 给登录 / 注册入口。

   ## 为什么这里还要「用手机号登录」的入口

   重装 App、换新手机的人，启动时拿到的是**新的游客账号**（设备号是新的），
   他原来那个账号还在服务端。没有这个入口，他就只能看到一片空白，
   而 App 里没有任何地方能告诉他「你其实有账号」。
   ============================================================ */

export function AccountCard() {
  const session = useAccount((s) => s.session)
  const signOut = useAccount((s) => s.signOut)
  const openBind = useAccount((s) => s.openBind)
  const [open, setOpen] = useState(false)

  const user = session?.user

  return (
    <Card title="账号" emoji="👤">
      {user?.is_guest ? (
        /* ---------------- 临时账号 ---------------- */
        <div className="space-y-3" data-account-guest>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grape-100 text-xl">
              🔖
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold text-ink-900">临时账号</p>
              <p className="text-[11px] font-bold text-ink-500">不用注册就能玩 · 账号绑在这台手机上</p>
            </div>
          </div>

          <p className="rounded-xl bg-sun-50 px-3 py-2 text-[11px] leading-snug text-ink-700">
            进度其实已经存在服务器上，但这个账号认的是<b>这台手机里的一串本机号</b>。
            换手机、清数据、卸载重装，这串号就没了，那个账号也就进不去了 ——
            绑定手机号之后，用手机号和密码在哪台手机上都能登回来。
          </p>

          <button
            type="button"
            onClick={() => openBind('manual')}
            data-account-save
            className="btn min-h-[44px] w-full rounded-xl bg-grape-400 text-sm font-extrabold text-white active:btn-press"
          >
            保存进度（绑定手机号）
          </button>

          <button
            type="button"
            onClick={() => setOpen(true)}
            data-account-open
            className="w-full py-1 text-center text-[12px] font-bold text-ink-500 underline decoration-dotted"
          >
            已经有账号？用手机号登录
          </button>
        </div>
      ) : user ? (
        /* ---------------- 正式账号 ---------------- */
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grape-100 text-xl">
              🙂
            </span>
            <div className="min-w-0 flex-1">
              <p data-account-nickname className="truncate text-sm font-extrabold text-ink-900">
                {user.nickname || '已登录'}
              </p>
              {/* 手机号是服务端脱敏过的（138****8000），别在这里「补全」 */}
              <p className="text-[11px] font-bold text-ink-500">{user.mobile || `uid ${user.uid}`}</p>
            </div>
          </div>
          <p className="rounded-xl bg-grass-50 px-3 py-2 text-[11px] leading-snug text-grass-700">
            进度已经存在账号里。换一台手机用同一个手机号登录，看到的还是这一份。
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            data-account-signout
            className="btn min-h-[44px] w-full rounded-xl border border-ink-900/10 bg-white text-sm font-extrabold text-ink-700 active:btn-press"
          >
            退出登录
          </button>
        </div>
      ) : (
        /* ---------------- 没有会话（连不上服务器 / 刚退出） ---------------- */
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-ink-600">
            现在没有连上服务器。登录之后，任务、积分、农场都会存在账号里。
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-account-open
            className="btn min-h-[44px] w-full rounded-xl bg-grape-400 text-sm font-extrabold text-white active:btn-press"
          >
            登录 / 注册
          </button>
        </div>
      )}

      <LoginSheet open={open} onClose={() => setOpen(false)} />
    </Card>
  )
}
