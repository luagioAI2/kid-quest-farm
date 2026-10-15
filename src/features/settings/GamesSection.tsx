import { useState } from 'react'
import { useApp } from '../../store/useApp'
import { GAMES } from '../../games/registry'
import { Card } from './ui'

/**
 * 家长栏 → 「游戏」。
 *
 * 四块，各回答一个问题：
 *   ① **商城币** —— 有多少、从哪来；
 *   ② **已购买** —— 内置游戏里我有哪些、现在玩的是哪一个（可切换）；
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
 * 这一轮**没有任何发币入口**（家长 2026-10-14：「以后支付购买。或者兑换码。」），
 * 所以商城币恒为 0。于是：
 *   · `comingSoon` 的游戏**不显示价格、也不渲染购买按钮** —— 买了也没得玩；
 *   · 商城币卡片直接把「还没做」写出来，而不是摆一个按不动的按钮。
 * 等付费 / 兑换码接上，把这两条改掉即可（`buyGame` 已经写好并有用例）。
 *
 * 同一条口径也管着 ③：**没有托管地址就装不出东西**，所以 ③ 整块是
 * 「有才渲染」，而不是摆一个空栏目 + 一个点了会失败的按钮。
 */

/** 商城币的图标。只有这一处定义，别在别处再写一个 emoji。 */
const MALL_COIN_EMOJI = '🎫'

export function GamesSection({ gateOpen }: { gateOpen: boolean }) {
  const mallBalance = useApp((s) => s.mallBalance)
  const ownedGameIds = useApp((s) => s.ownedGameIds)
  const activeGameId = useApp((s) => s.activeGameId)
  const setActiveGame = useApp((s) => s.setActiveGame)
  const buyGame = useApp((s) => s.buyGame)
  const pushToast = useApp((s) => s.pushToast)
  const installedGames = useApp((s) => s.installedGames)
  const uninstallGame = useApp((s) => s.uninstallGame)

  /** 正在等二次确认的插件游戏 id —— 卸载会连存档一起删，不能一下点掉 */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const owned = GAMES.filter((g) => ownedGameIds.includes(g.id))
  const notOwned = GAMES.filter((g) => !ownedGameIds.includes(g.id))
  const installed = Object.values(installedGames)

  const buy = async (id: string) => {
    const res = await buyGame(id)
    pushToast({
      kind: res.ok ? 'success' : 'warn',
      title: res.ok ? '买好了' : '没买成',
      detail: res.message,
      emoji: res.ok ? '✅' : '⚠️',
    })
  }

  return (
    <>
      {/* ① 商城币 */}
      <Card title="商城币" emoji={MALL_COIN_EMOJI}>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-sky-200 px-3 py-1.5 shadow-flat">
            <span className="text-base leading-none">{MALL_COIN_EMOJI}</span>
            <span className="tnum font-display text-lg font-extrabold leading-none text-ink-900">
              {mallBalance}
            </span>
          </span>
          <span className="text-sm font-bold text-ink-500">用来买游戏</span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          和积分、丰收币是三套不同的账，互相不能换。
          <br />
          现在还没有地方能拿到商城币 —— 付费购买和兑换码都还没做，所以这里一直是 0。
        </p>
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
