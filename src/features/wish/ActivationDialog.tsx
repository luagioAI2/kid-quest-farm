import { Portal } from '@/components/Portal'
import { ParentPinSheet, useParentGate } from '../parent/ParentGate'
import { CodeDonePanel, CodeForm, useCodeRedeem } from './CodeRedeemBlock'
import { useApp } from '@/store/useApp'
import { openExternal } from '@/platform/openUrl'
import type { WishItem } from '@/domain/types'

/* ============================================================
   列表卡片「去激活」点开的那个弹框
   ------------------------------------------------------------
   用户要求：所有类型（礼品 / 游戏 / 盲盒）都有「去激活」按钮，
   点开弹框有输入激活码，没有激活码可以点「去购买」。

   ★ 游戏 / 盲盒：显示输码区（后台配了链接才多一颗「去购买」）
   ★ 实物礼品：只显示去购买按钮（实物没有激活码）

   ★ 第七轮（2026-11-06）：「去购买」**有没有，看后台配没配链接**
     —— tf-admin「商城」列表里的 `buy_url`。没配就**不摆这颗按钮**。

     以前这里现拼一条淘宝搜索页兜底（`wishBuyUrl`），结果是
     「后台没配」和「配了」在界面上长得一模一样：用户看到一颗永远在、
     却和后台配置毫无关系的按钮。用户原话：「如果没有就不显示。」
   ============================================================ */

export function ActivationDialog({
  itemName,
  item,
  onClose,
}: {
  /** 从哪件商品点进来的，只是让说明里能叫出名字 */
  itemName: string
  /** 商品本身（用它查后台配的外链） */
  item?: WishItem
  onClose: () => void
}) {
  const pushToast = useApp((s) => s.pushToast)
  /**
   * 后台配的外链。**没配 = `undefined` ⇒ 不渲染按钮**。
   *
   * ⚠️ 别在这里 `?? 现拼一条淘宝搜索页`。那就是这一轮要修的东西：
   *    兜底会让「运营没配」和「配了」看起来完全一样。
   */
  const buyLink = useApp((s) => (item ? s.wishBuyLinks[item.id] : undefined))
  /** ★ 不传 `onDone`：传了会在成功那一刻把弹框关掉，`done` 也就没了。 */
  const hook = useCodeRedeem()

  /** 是否是数字商品（游戏 / 盲盒）—— 有激活码可以输 */
  const isDigital = item?.kind === 'gamebox' || item?.kind === 'blindbox'

  /* 家长密码（2026-11-06 晚，第二版）：**锁定态就是那个统一弹框本身**。
     ★ 用户看了走查图说：「请爸爸来一下，还有一段文字描述（爸爸妈妈在淘宝……）
     根本不需要，家长密码都是统一的 UI。」
     所以这里不再自己出一张卡片（🔒 + 标题 + 长说明 + 给「X」输激活码），
     而是直接把 `ParentPinSheet` 顶上来 —— 和设置 / 兑换 / 心愿详情同一个界面。
     输对它自己关掉，激活卡片才出现。 */
  const { needsPin, passed, unlock } = useParentGate()
  const gateOn = isDigital && needsPin && !passed

  /** 去购买：打开后台配的那条外链（淘宝 / 京东等） */
  const goBuy = async () => {
    if (!buyLink) return
    const ok = await openExternal(buyLink.url)
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

  /* 锁定态：**只出统一那个家长密码弹框**，这张卡片整个不出。
     ⚠️ 别在这儿补「为什么需要密码」的长句 —— 那是用户点名删掉的东西；
        一行副标题够了（设置页也是这么写的）。 */
  if (gateOn) {
    return (
      <ParentPinSheet open onClose={onClose} onPass={unlock} hint="输激活码，先输一下密码" />
    )
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
                {/* ⚠️ 这里必须是**表达式**。2026-11-06 晚我把它写成纯文本
                    `激活「${itemName}」`，结果界面原样印出 `激活「$云边小农场」`
                    —— tsc 不报（JSX 文本合法），只有截图能看出来。 */}
                {`激活「${itemName}」`}
              </p>
              {/* 说明句**只有实物才有**（没有激活码 → 告诉孩子下一步点哪儿）。
                  ★ 数字商品一个字都不写：用户看了走查图说「爸爸妈妈在淘宝……
                  那段文字描述根本不需要」（2026-11-06 晚）。 */}
              {!isDigital && (
                <p data-activate-guide className="mt-1 text-[11.5px] font-bold leading-relaxed text-ink-500">
                  {buyLink
                    ? '这一件是实物，没有激活码。点下面的按钮去淘宝 / 京东看看，买好之后爸妈会在心愿单里收尾。'
                    : '这一件是实物，没有激活码。想要的话关掉这个框，点「🤍 我想要」告诉爸妈，他们买好之后会在心愿单里收尾。'}
                </p>
              )}
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

          {/* 去购买：**后台配了链接才有**（2026-11-06 第七轮）。
              没配就不摆 —— 一颗点下去只会弹提示的按钮，孩子会以为坏了。 */}
          {buyLink && (
            <button
              type="button"
              data-activate-buy
              onClick={() => void goBuy()}
              className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-sun-400 text-sm font-extrabold text-ink-900 active:btn-press"
            >
              ↗ {buyLink.label ?? '去购买'}
            </button>
          )}

          {/* 输码区：只有数字商品（游戏 / 盲盒）才有。
              锁定态**走不到这里** —— 上面已经 early return 了统一弹框。 */}
          {isDigital && <CodeForm hook={hook} autoFocus />}
        </div>
      </div>
    </Portal>
  )
}
