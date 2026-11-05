import { Portal } from '@/components/Portal'
import { ParentGate } from '../parent/ParentGate'
import { CodeDonePanel, CodeForm, useCodeRedeem } from './CodeRedeemBlock'

/* ============================================================
   列表卡片「去激活」点开的那个弹框（2026-11-05 第三轮）
   ------------------------------------------------------------
   用户原话：「心愿商城每个礼品的设计布局有点丑陋……『有码可输』是啥意思，
   很奇怪。应该是类似『去激活』，点击就会出现提示框购买、输入激活之类的吧。」

   ⇒ 「有码可输」那颗**非交互标签**换成一颗真按钮，点开的是这个框。
   ⇒ 框里三件事说清：游戏现在是什么状态、码**从哪来**、输完会发生什么。
     口径按用户第二轮纠正：码是爸妈在淘宝等买完，卖家发的一串 6 位码，
     没有实体卡、没有「卡背面」。

   ⚠️ 挂在 `WishPage`（页面层），不挂在 `ItemCard` 里。激活成功会让
   `ownedGameIds` 多一款 ⇒ `hiddenOwned` 把那张游戏卡从列表里摘掉 ⇒
   弹框要是在卡片里，就会和卡片一起卸载，「激活成功 / 去设置看看」
   在同一帧消失（和详情页那个 `alreadyOwned` bug 是同一类）。

   ⚠️ 闸门：孩子也能点「去激活」，但码是花钱买来的东西，所以过家长密码。
   `ParentGate` 的 `onCancel` 必须给 —— 不给的话 `PinFlow` 底下那颗
   「先算了」不渲染，手滑点开就没法退出。

   ⚠️ 成功之后**不切当前游戏**（用户选的「保持现状（家长控制）」），
   只给「去设置看看」这条指路。
   ============================================================ */

export function ActivationDialog({
  itemName,
  onClose,
}: {
  /** 从哪件商品点进来的，只是让说明里能叫出名字 */
  itemName: string
  onClose: () => void
}) {
  /** ★ 不传 `onDone`：传了会在成功那一刻把弹框关掉，`done` 也就没了。 */
  const hook = useCodeRedeem()

  if (hook.done) {
    return <CodeDonePanel done={hook.done} onClose={onClose} />
  }

  return (
    <Portal>
      <div
        data-activate-dialog
        className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink-900/40 p-4 anim-fade-in"
      >
        <div className="my-auto w-full max-w-sm rounded-3xl bg-white p-4 shadow-float">
          <div className="flex items-start gap-2.5">
            <span aria-hidden className="text-2xl leading-none">
              🎟️
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-extrabold text-ink-900">激活这款游戏</p>
              <p data-activate-guide className="mt-1 text-[11.5px] font-bold leading-relaxed text-ink-500">
                「{itemName}」现在还没激活。爸爸妈妈在淘宝买好之后，卖家会发一串 6 位激活码（像
                ABC-DEF）。在这里输一次，这款就直接进「我的游戏」—— 不用先攒兑换券。
              </p>
            </div>
            <button
              type="button"
              data-activate-close
              onClick={onClose}
              aria-label="关闭"
              className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[15px] text-ink-400 active:btn-press"
            >
              ✕
            </button>
          </div>

          <ParentGate hint="输激活码需要爸爸妈妈确认" onCancel={onClose}>
            <CodeForm hook={hook} autoFocus />
          </ParentGate>
        </div>
      </div>
    </Portal>
  )
}
