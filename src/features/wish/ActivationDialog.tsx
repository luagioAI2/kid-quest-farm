import { Portal } from '@/components/Portal'
import { ParentGate } from '../parent/ParentGate'
import { CodeDonePanel, CodeForm, useCodeRedeem } from './CodeRedeemBlock'
import { useApp } from '@/store/useApp'
import { openExternal } from '@/platform/openUrl'
import { wishBuyUrl, wishBuyLabel } from '@/games/wishCatalog'
import type { WishItem } from '@/domain/types'

/* ============================================================
   列表卡片「去激活」点开的那个弹框
   ------------------------------------------------------------
   用户要求：所有类型（礼品 / 游戏 / 盲盒）都有「去激活」按钮，
   点开弹框有输入激活码，没有激活码可以点「去购买」。
   去购买链接从 tf-admin 商城列表的 buyUrl 配置取，
   没配的话用目录里自带的淘宝搜索链接兜底。

   ★ 游戏 / 盲盒：显示输码区 + 去购买按钮
   ★ 实物礼品：只显示去购买按钮（实物没有激活码）
   ============================================================ */

export function ActivationDialog({
  itemName,
  item,
  onClose,
}: {
  /** 从哪件商品点进来的，只是让说明里能叫出名字 */
  itemName: string
  /** 商品本身（取 buyUrl / buyLabel） */
  item?: WishItem
  onClose: () => void
}) {
  const pushToast = useApp((s) => s.pushToast)
  /** ★ 不传 `onDone`：传了会在成功那一刻把弹框关掉，`done` 也就没了。 */
  const hook = useCodeRedeem()

  /** 是否是数字商品（游戏 / 盲盒）—— 有激活码可以输 */
  const isDigital = item?.kind === 'gamebox' || item?.kind === 'blindbox'

  /**
   * 去购买按钮：打开外链（淘宝 / 京东等）。
   *
   * 链接来源 = 运营在 tf-admin「商城」列表里配的 `buy_url`；没配就落到
   * 目录里那条淘宝搜索链接；两处都没有就**现拼一条**（`wishBuyUrl`）。
   *
   * ⚠️ 不要退回「这一款还没配购买链接」那种提示 —— 孩子站在这个弹框里
   *    唯一能做的事就是去买，给他一颗点了只弹提示的死按钮，等于把
   *    「没有激活码 → 去购买」这条唯一的出路堵死。
   */
  const goBuy = async () => {
    const url = wishBuyUrl(item ?? { name: itemName })
    const ok = await openExternal(url)
    if (!ok) {
      pushToast({
        kind: 'info',
        title: '这个链接打不开',
        detail: `复制「${itemName}」到淘宝里搜一下`,
        emoji: '🔗',
      })
    }
  }

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
              <p className="font-display text-base font-extrabold text-ink-900">
                激活「{itemName}」
              </p>
              <p data-activate-guide className="mt-1 text-[11.5px] font-bold leading-relaxed text-ink-500">
                {isDigital
                  ? '爸爸妈妈在淘宝 / 京东买好之后，卖家会发一串 6 位激活码（像 ABC-DEF）。在这里输一次，这款就直接进「我的游戏」—— 不用先攒兑换券。'
                  : '这一件是实物，没有激活码。点下面的按钮去淘宝 / 京东看看，买好之后爸妈会在心愿单里收尾。'}
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

          {/* 去购买：**所有类型都有**（实物没有码，这条路就是唯一的路） */}
          <button
            type="button"
            data-activate-buy
            onClick={() => void goBuy()}
            className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-sun-400 text-sm font-extrabold text-ink-900 active:btn-press"
          >
            ↗ {wishBuyLabel(item ?? { name: itemName })}
          </button>

          {/* 输码区：只有数字商品（游戏 / 盲盒）才有 */}
          {isDigital && (
            <ParentGate hint="输激活码需要爸爸妈妈确认" onCancel={onClose}>
              <CodeForm hook={hook} autoFocus />
            </ParentGate>
          )}
        </div>
      </div>
    </Portal>
  )
}
