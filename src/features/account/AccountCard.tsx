import { useState } from 'react'
import { useAccount } from '@/store/useAccount'
import { Card } from '../settings/ui'
import { LoginSheet } from './LoginSheet'

/* ============================================================
   账号卡（设置 → 规则，家长区）
   ------------------------------------------------------------
   放「规则」页而不是「孩子」页：登录是**家长的动作**，而规则页本来
   就有家长密码闸门（`protectParentActions`），天然挡住了孩子。

   ⚠️ 这张卡**不改任何孩子数据**。它只回答「这台设备上登录的是谁」，
      所以没登录时也不该拦着孩子玩 —— 全离线仍然能用。
   ============================================================ */

export function AccountCard() {
  const session = useAccount((s) => s.session)
  const signOut = useAccount((s) => s.signOut)
  const [open, setOpen] = useState(false)

  const user = session?.user

  return (
    <Card title="账号" emoji="👤">
      {user ? (
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
          <p className="rounded-xl bg-paper-2 px-3 py-2 text-[11px] leading-snug text-ink-500">
            登录之后，招商申请会提交到服务器，审核结果和后台链接也来自服务器。
            任务、积分这些仍然存在这台设备上。
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
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-ink-600">
            现在没有登录。孩子照常能玩 —— 只有「招商申请」这类要审核的事需要账号。
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
