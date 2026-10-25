import { useState } from 'react'
import { useApp } from '../../store/useApp'
import { Card } from './ui'
import { PluginStoreCard } from './PluginStoreCard'
import { GameMarket } from './GameStore'
import { CURRENCY } from '../../domain/currency'

/**
 * 家长栏 → 「游戏」。三块，各回答一个问题：
 *
 *   ① **钻石** —— 有多少、从哪来（含手动发放）；
 *   ② **游戏市场** —— 所有游戏一张表：内置的 + 随包发的插件，**状态写在行上**
 *      （当前 / 已装 / 可装 / 要买 / 敬请期待）；
 *   ③ **在线商店** —— 从已签名目录装远程包（`PluginStoreCard`，没配地址时只有一句说明）。
 *
 * ## ⚠️ 2026-10-25 合并了三张卡
 *
 * 原来是「已购买 / 已下载 / 敬请期待」三张，同一款游戏会在两三处出现，
 * 而且**每处都能改它的状态**。家长原话：
 *   「感觉没必要 单独 已购买，已下载，敬请期待，直接 在 游戏市场。
 *     每个游戏 不同状态呗。」
 * ⇒ 合并进 ②。**加新状态时改 `GameMarket` 里那一行的状态机，不要再开一张卡。**
 *
 * ## 文案口径（这个项目被家长点过名）
 *
 * 一律陈述句，不写「让 X 看得见」「不只是 X 而是 Y」这类句式（判据见
 * `docs/` 与 `.workbuddy-ai/memory/MEMORY.md` 的「文案不能像传销」一节）。
 *
 * ## ⚠️ 不许承诺做不到的事
 *
 * `comingSoon` 的游戏**不显示价格、也不渲染购买按钮** —— 买了也没得玩。
 * 在线商店没配地址时只有一句说明，不摆一个按下去必然失败的按钮。
 */

/**
 * 钻石的图标。
 *
 * ⚠️ **从 `domain/currency.ts` 取** —— 那里是显示口径的唯一事实源。
 * 这里原来写死了一个 `'🎫'`，还配了句「只有这一处定义，别在别处再写一个」，
 * 而那句话**当时就是假的**（`currency.ts` 里还有一份）。同一个事实存两份就一定会
 * 走散：改了显示口径、这一份不响。
 */
const MALL_COIN_EMOJI = CURRENCY.mall.emoji

export function GamesSection({ gateOpen }: { gateOpen: boolean }) {
  const mallBalance = useApp((s) => s.mallBalance)
  const mintMall = useApp((s) => s.mintMall)
  const pushToast = useApp((s) => s.pushToast)
  /** 发放按钮的防重入：连点两下会发两次（每次都是一笔真的账） */
  const [busyMint, setBusyMint] = useState(false)

  const mint = async (n: number) => {
    if (busyMint) return
    setBusyMint(true)
    try {
      const res = await mintMall(n)
      pushToast({
        kind: res.ok ? 'success' : 'warn',
        title: res.ok ? '好了' : '没改成',
        detail: res.message,
        emoji: res.ok ? '✅' : '⚠️',
      })
    } finally {
      setBusyMint(false)
    }
  }

  return (
    <>
      {/* ① 钻石 */}
      <Card title={CURRENCY.mall.name} emoji={MALL_COIN_EMOJI}>
        <div className="flex items-center gap-2">
          <span
            data-mall-balance
            className="flex items-center gap-1 rounded-full bg-sky-200 px-3 py-1.5 shadow-flat"
          >
            <span className="text-base leading-none">{MALL_COIN_EMOJI}</span>
            <span className="tnum font-display text-lg font-extrabold leading-none text-ink-900">
              {mallBalance}
            </span>
          </span>
          <span className="text-sm font-bold text-ink-500">用来买游戏</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          和积分、兑换券是三套不同的账，互相不能换。
        </p>

        {/*
          手动发放（2026-10-16 加）。

          ★ 为什么必须有：**内置游戏标价用的是钻石**（`registry.ts` 的 `priceMall`），
            而钻石的余额是从账本算出来的，在此之前**没有任何发币入口** ⇒ 余额恒为 0
            ⇒ 那个购买按钮按下去一定失败。那就成了「界面摆了一个必然失败的按钮」。
            （2026-10-23 起娃娃机改成了插件包，走的是「积分 → 游戏币」，不再吃钻石；
            2026-10-25 钓鱼池删掉之后，内置游戏**一款标价的都没有**了 ——
            这个入口先留着，等第一款付费内置游戏或兑换码接上再收。）
            付费购买和兑换码还没做（家长 2026-10-14：「以后支付购买。或者兑换码。」），
            所以先给家长一个手动的口子；等真入口接上，这一段删掉即可。

          走的是 `mintMall`（写账本，`source: 'manual_adjust'`），不是直接改余额 ——
          余额永远是 delta 之和，直接改会让账目和余额走散。
        */}
        <div className="mt-3 border-t border-ink-900/10 pt-3">
          <span className="text-sm font-extrabold text-ink-900">手动发放</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {[
              { n: 1, label: `+1` },
              { n: 10, label: `+10` },
              { n: -1, label: `-1` },
            ].map((b) => (
              <button
                key={b.n}
                disabled={!gateOpen || busyMint}
                data-mall-mint={b.n}
                onClick={() => void mint(b.n)}
                className={
                  'btn h-11 min-w-[3.5rem] rounded-full px-3 text-sm font-extrabold shadow-flat active:btn-press disabled:opacity-50 ' +
                  (b.n > 0 ? 'bg-sun-300 text-ink-900' : 'bg-white text-ink-700')
                }
              >
                {b.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-snug text-ink-500">
            付费购买和兑换码都还没做，所以现在只能在这里手动发。
            「-1」是用来改错的。
          </p>
        </div>
      </Card>

      {/* ② 游戏市场 —— 所有游戏一张表，状态在行上（含内置 + 插件） */}
      <GameMarket gateOpen={gateOpen} />

      {/*
        ③ 在线商店 —— 从**已签名目录**里装远程包（spec §12.4 / P2）。

        和 ② 的区别：② 里的插件是**随 App 发**的本地包（哈希烧在代码里），
        这里是从远端目录下载、靠 Ed25519 目录签名兜底的另一条来源。
        没配托管地址时只有一句说明，**不摆按钮**。
      */}
      <PluginStoreCard gateOpen={gateOpen} />
    </>
  )
}
