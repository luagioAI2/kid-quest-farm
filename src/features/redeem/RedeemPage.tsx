import { RedeemBody } from './RedeemSheet'

/* ============================================================
   兑换 · 独立页面（底部导航的「兑换」标签）
   ------------------------------------------------------------
   原本兑换是任务页里的一个弹层入口，但它是孩子的核心玩法之一
   （赚积分 → 花积分），值得有自己的标签页。

   正文直接复用 RedeemBody —— 弹层和页面共用同一份实现，
   避免两处各写一遍导致行为分叉。

   ⚠️ 这一页**不显示余额**。
   页头原来有一张「🪙 我的积分 / N」的大卡，但全局顶栏（`App.tsx` 的
   sticky header）已经常驻显示同一个数了 —— 同一屏里同一个数出现两次，
   孩子反而不知道该看哪个。余额只在顶栏说一次，这一页只说「能换什么」。
   （e2e-check 有断言守着；同一条规矩也适用于积分页和农场卡。）
   ============================================================ */

export default function RedeemPage() {
  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pb-28">
      <header className="pt-safe pt-4">
        <div className="flex items-center gap-3">
          <span className="anim-float flex h-14 w-14 items-center justify-center rounded-full border border-grape-300 bg-grape-100 text-3xl shadow-flat">
            🎁
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-extrabold leading-tight text-ink-900">
              兑换愿望
            </p>
            <p className="text-xs font-bold text-ink-500">用攒下来的积分，换想要的东西</p>
          </div>
        </div>
      </header>

      <div className="mt-4">
        <RedeemBody />
      </div>
    </div>
  )
}
