import { useApp } from '@/store/useApp'
import { RedeemBody } from './RedeemSheet'

/* ============================================================
   兑换 · 独立页面（底部导航的「兑换」标签）
   ------------------------------------------------------------
   原本兑换是任务页里的一个弹层入口，但它是孩子的核心玩法之一
   （赚积分 → 花积分），值得有自己的标签页。

   正文直接复用 RedeemBody —— 弹层和页面共用同一份实现，
   避免两处各写一遍导致行为分叉。
   ============================================================ */

export default function RedeemPage() {
  const balance = useApp((s) => s.balance)

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pb-28">
      <header className="pt-safe pt-4">
        <div className="flex items-center gap-3">
          <span className="anim-float flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-grape-300 bg-grape-100 text-3xl shadow-cartoon-sm">
            🎁
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-extrabold leading-tight text-ink-900">
              兑换愿望
            </p>
            <p className="text-xs font-bold text-ink-500">用攒下来的积分，换想要的东西</p>
          </div>
        </div>

        <div className="card-cartoon mt-4 flex items-center gap-3 border-[3px] border-sun-300 bg-gradient-to-r from-sun-100 to-sun-50 p-4">
          <span className="anim-sway text-4xl">🪙</span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-ink-500">我的积分</p>
            <p className="tnum font-display text-4xl font-extrabold leading-none text-sun-600">
              {balance}
            </p>
          </div>
          <span className="text-right text-[11px] font-bold leading-snug text-ink-500">
            完成小任务
            <br />
            攒够了就能换
          </span>
        </div>
      </header>

      <div className="mt-4">
        <RedeemBody />
      </div>
    </div>
  )
}
