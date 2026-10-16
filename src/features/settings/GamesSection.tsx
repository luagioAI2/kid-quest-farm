import { useState } from 'react'
import { useApp } from '../../store/useApp'
import { GAMES } from '../../games/registry'
import { GAME_CLAW } from '../../games/ids'
import { Card } from './ui'
import { ClawEconomyCard } from './ClawEconomyCard'
import { CURRENCY } from '../../domain/currency'

/**
 * 家长栏 → 「游戏」。
 *
 * 五块，各回答一个问题：
 *   ① **商城币** —— 有多少、从哪来（含手动发放）；
 *   ② **已购买** —— 内置游戏里我有哪些、现在玩的是哪一个（可切换）；
 *   ②′ **娃娃机** —— 买了才显示：中奖率 / 每只换多少点券（`ClawEconomyCard`）；
 *   ③ **已下载** —— 运行时装进来的游戏（装了才显示，见那边的注释）；
 *   ④ **敬请期待** —— 还没做的。
 *
 * ## 文案口径（这个项目被家长点过名）
 *
 * 一律陈述句，不写「让 X 看得见」「不只是 X 而是 Y」这类句式（判据见
 * `docs/` 与 `.workbuddy-ai/memory/MEMORY.md` 的「文案不能像传销」一节）。
 *
 * ## ⚠️ 不许承诺做不到的事
 *
 * `comingSoon` 的游戏**不显示价格、也不渲染购买按钮** —— 买了也没得玩。
 * 同理 ③ 整块是「有才渲染」，而不是摆一个空栏目 + 一个点了会失败的按钮。
 *
 * ⚠️ 历史：① 曾经写着「现在还没有地方能拿到商城币」。2026-10-16 娃娃机
 * 上线（用商城币买）之后那句就不成立了 —— 没有发币入口的话，购买按钮
 * 按下去必然失败。所以加了「手动发放」，文案也一起改了。
 */

/**
 * 商城币的图标。
 *
 * ⚠️ **从 `domain/currency.ts` 取** —— 那里是显示口径的唯一事实源。
 * 这里原来写死了一个 `'🎫'`，还配了句「只有这一处定义，别在别处再写一个」，
 * 而那句话**当时就是假的**（`currency.ts` 里还有一份）。同一个事实存两份就一定会
 * 走散：改了显示口径、这一份不响。
 */
const MALL_COIN_EMOJI = CURRENCY.mall.emoji

export function GamesSection({ gateOpen }: { gateOpen: boolean }) {
  const mallBalance = useApp((s) => s.mallBalance)
  const ownedGameIds = useApp((s) => s.ownedGameIds)
  const activeGameId = useApp((s) => s.activeGameId)
  const setActiveGame = useApp((s) => s.setActiveGame)
  const buyGame = useApp((s) => s.buyGame)
  const pushToast = useApp((s) => s.pushToast)
  const installedGames = useApp((s) => s.installedGames)
  const uninstallGame = useApp((s) => s.uninstallGame)
  const mintMall = useApp((s) => s.mintMall)

  /** 正在等二次确认的插件游戏 id —— 卸载会连存档一起删，不能一下点掉 */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  /** 发放按钮的防重入：连点两下会发两次（每次都是一笔真的账） */
  const [busyMint, setBusyMint] = useState(false)

  const owned = GAMES.filter((g) => ownedGameIds.includes(g.id))
  const notOwned = GAMES.filter((g) => !ownedGameIds.includes(g.id))
  const installed = Object.values(installedGames)
  /** 买了娃娃机才显示它那一屏参数 —— 没买的话调了也没用，只是多一屏东西 */
  const clawOwned = ownedGameIds.includes(GAME_CLAW)

  const buy = async (id: string) => {
    const res = await buyGame(id)
    pushToast({
      kind: res.ok ? 'success' : 'warn',
      title: res.ok ? '买好了' : '没买成',
      detail: res.message,
      emoji: res.ok ? '✅' : '⚠️',
    })
  }

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
      {/* ① 商城币 */}
      <Card title="商城币" emoji={MALL_COIN_EMOJI}>
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
          和积分、点券是三套不同的账，互相不能换。
        </p>

        {/*
          手动发放（2026-10-16 加）。

          ★ 为什么必须有：娃娃机**用商城币买**，而商城币的余额是从账本算出来的，
            在此之前**没有任何发币入口** ⇒ 余额恒为 0 ⇒ 那个购买按钮按下去
            一定失败。那就成了「界面摆了一个必然失败的按钮」。
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

      {/* ② 已购买 */}
      <Card title="已购买" emoji="✅">
        {owned.length === 0 ? (
          <p className="text-sm text-ink-500">还没有已购买的游戏。</p>
        ) : (
          <ul className="space-y-2">
            {owned.map((g) => {
              const isCurrent = g.id === activeGameId
              return (
                <li
                  key={g.id}
                  className="flex items-center gap-3 rounded-2xl border-3 border-ink-900/10 bg-paper-2 px-3 py-2.5"
                >
                  <span className="text-2xl">{g.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-extrabold text-ink-900">
                      {g.name}
                    </span>
                    <span className="block text-xs leading-snug text-ink-500">{g.tagline}</span>
                  </span>
                  {isCurrent ? (
                    /* 「当前」是个状态，不是按钮 —— 别做成 disabled 的按钮，
                       那会让人以为「点一下能取消当前」。 */
                    <span className="shrink-0 rounded-full bg-grass-300 px-3 py-1 text-xs font-extrabold text-ink-900">
                      当前
                    </span>
                  ) : (
                    <button
                      disabled={!gateOpen}
                      onClick={() => void setActiveGame(g.id)}
                      className="btn shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-ink-700 shadow-flat active:btn-press disabled:opacity-50"
                    >
                      设为当前
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        <p className="mt-3 text-xs leading-snug text-ink-500">
          「当前」的那款会出现在孩子底部的那个游戏按钮上。
        </p>
      </Card>

      {/*
        ②′ 娃娃机的参数 —— **买了才显示**（`clawOwned`）。

        没买就调，调的是「一件还不存在的事」；而且这一屏会平白多出一整块。
        参数本身的说明（为什么有不安全组合、期望值怎么算）在 `ClawEconomyCard` 里。
      */}
      {clawOwned && <ClawEconomyCard gateOpen={gateOpen} />}

      {/*
        ③ 已下载 —— **运行时装进来的游戏**（spec §12）。

        和 ② 的区别：② 是编译进 App 的内置游戏，③ 是家长自己装进来的包。
        P1 还没有托管地址，所以正常装不出东西来；这一段**只有装了才渲染**，
        不摆一个永远空着的栏目 —— 那就是「界面承诺了它做不到的事」。
        等 P2 接上托管，这一段会自己出现。
      */}
      {installed.length > 0 && (
        <Card title="已下载" emoji="📦">
          <ul className="space-y-2">
            {installed.map((m) => {
              const isCurrent = m.id === activeGameId
              const isConfirming = confirmingId === m.id
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-2xl border-3 border-ink-900/10 bg-paper-2 px-3 py-2.5"
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-extrabold text-ink-900">
                      {m.name}
                      <span className="ml-1.5 text-xs font-bold text-ink-500">v{m.version}</span>
                    </span>
                    <span className="block text-xs leading-snug text-ink-500">
                      游戏币：{m.coin.emoji} {m.coin.name}
                    </span>
                  </span>
                  {isConfirming ? (
                    <>
                      <button
                        disabled={!gateOpen}
                        onClick={() => {
                          setConfirmingId(null)
                          void uninstallGame(m.id)
                        }}
                        className="btn shrink-0 rounded-full bg-berry-500 px-3 py-1.5 text-xs font-extrabold text-white shadow-flat active:btn-press disabled:opacity-50"
                      >
                        确认卸载
                      </button>
                      <button
                        onClick={() => setConfirmingId(null)}
                        className="btn shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-ink-700 shadow-flat active:btn-press"
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      {isCurrent ? (
                        <span className="shrink-0 rounded-full bg-grass-300 px-3 py-1 text-xs font-extrabold text-ink-900">
                          当前
                        </span>
                      ) : (
                        <button
                          disabled={!gateOpen}
                          onClick={() => void setActiveGame(m.id)}
                          className="btn shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-extrabold text-ink-700 shadow-flat active:btn-press disabled:opacity-50"
                        >
                          设为当前
                        </button>
                      )}
                      <button
                        disabled={!gateOpen}
                        onClick={() => setConfirmingId(m.id)}
                        aria-label={`卸载 ${m.name}`}
                        className="btn shrink-0 rounded-full bg-white px-2.5 py-1.5 text-xs font-extrabold text-ink-500 shadow-flat active:btn-press disabled:opacity-50"
                      >
                        卸载
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs leading-snug text-ink-500">
            卸载会把这个游戏的存档一起删掉，下次装回来是重新开始。
          </p>
        </Card>
      )}

      {/* ④ 敬请期待 */}
      <Card title="敬请期待" emoji="🔜">
        {notOwned.length === 0 ? (
          <p className="text-sm text-ink-500">没有别的游戏了。</p>
        ) : (
          <ul className="space-y-2">
            {notOwned.map((g) => (
              <li
                key={g.id}
                className="flex items-center gap-3 rounded-2xl border-3 border-ink-900/10 px-3 py-2.5"
              >
                <span className="text-2xl opacity-60">{g.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-extrabold text-ink-500">
                    {g.name}
                  </span>
                  <span className="block text-xs leading-snug text-ink-500">{g.tagline}</span>
                </span>
                {/*
                  `comingSoon` 的游戏**只显示状态**：不写价格、不给购买按钮。
                  摆一个买了也没得玩的东西，就是「界面承诺了它做不到的事」。
                  `available` 的游戏才会走到下面这个购买按钮 ——
                  那一支现在是**空跑**（没有这种游戏），留着是为了上线时不用改结构。
                */}
                {g.status === 'available' && g.priceMall > 0 ? (
                  <button
                    disabled={!gateOpen}
                    onClick={() => void buy(g.id)}
                    className="btn shrink-0 rounded-full bg-sun-300 px-3 py-1.5 text-xs font-extrabold text-ink-900 shadow-flat active:btn-press disabled:opacity-50"
                  >
                    {MALL_COIN_EMOJI} {g.priceMall}
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full bg-ink-900/5 px-3 py-1 text-xs font-extrabold text-ink-500">
                    敬请期待
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
