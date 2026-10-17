import { useApp } from '../../store/useApp'
import {
  CLAW_DEFAULT_EXCHANGE,
  CLAW_DEFAULT_WIN_RATE,
  CLAW_EXCHANGE_CHOICES,
  CLAW_MAX_EXPECTED,
  CLAW_PLAY_COST,
  CLAW_WIN_RATE_CHOICES,
  clampClawEconomy,
  clawEconomyIsSafe,
  clawEconomyProblem,
  clawExpectedCoupons,
} from '../../domain/clawEconomy'
import { Card } from './ui'

/* ============================================================
   家长栏 → 娃娃机（经济参数）

   ## 家长在这一屏要能回答的两个问题

     ① 「孩子玩一局花多少、平均能拿回多少？」—— 这是**期望值**，不是中奖率。
     ② 「我这么设会不会被刷？」—— 所以不安全的组合**直接不给选**，
        而不是存下去再提示。

   ## ★★ 为什么「不给选」而不是「存下去再报错」

   `store.settleClawRound()` 结算时会 `clampClawEconomy()` 夹一遍
   （IndexedDB 是能直接改的，不能信存档）。如果界面允许存一个不安全的组合，
   实际生效的和家长看到的就是**两个数** —— 那正是「同一个事实存两份」，
   而且**不报错**。所以这里让不安全的组合**按不动**，并写清原因。

   ## ★ 两个字段要**一次写完**

   改中奖率时，兑换数可能得跟着降（`1/2 × 2 = 1.0` 就超了）。
   分两次写的话，中间那一瞬存档里是一个不安全的组合 ——
   虽然没人看得见，但那是**真的**不安全的存档。所以合成一次 `updateSettings`。
   ============================================================ */

export function ClawEconomyCard({ gateOpen }: { gateOpen: boolean }) {
  const winRate = useApp((s) => s.settings.clawWinRate ?? CLAW_DEFAULT_WIN_RATE)
  const exchange = useApp((s) => s.settings.clawExchangePerPrize ?? CLAW_DEFAULT_EXCHANGE)
  const updateSettings = useApp((s) => s.updateSettings)
  const pushToast = useApp((s) => s.pushToast)

  const econ = { winRate, exchangePerPrize: exchange }
  const expected = clawExpectedCoupons(econ)
  const problem = clawEconomyProblem(econ)

  /**
   * 改中奖率。
   *
   * ★ 兑换数跟着 `clampClawEconomy` 一起夹，并且**两个字段一次写**（理由见文件头）。
   *   夹低了就明说一句 —— 悄悄改掉家长刚设的数，比不让他设还糟。
   */
  const setWinRate = (w: number) => {
    const c = clampClawEconomy({ winRate: w, exchangePerPrize: exchange })
    void updateSettings({ clawWinRate: c.winRate, clawExchangePerPrize: c.exchangePerPrize })
    if (c.exchangePerPrize !== exchange) {
      pushToast({
        kind: 'info',
        title: '兑换数也一起调了',
        detail: `这一档中奖率下，每只最多换 ${c.exchangePerPrize} 商城币`,
        emoji: 'ℹ️',
      })
    }
  }

  const reset = () => {
    void updateSettings({
      clawWinRate: CLAW_DEFAULT_WIN_RATE,
      clawExchangePerPrize: CLAW_DEFAULT_EXCHANGE,
    })
  }

  return (
    <Card title="娃娃机" emoji="🕹️">
      <p className="text-sm leading-relaxed text-ink-500">
        孩子玩一局要花 {CLAW_PLAY_COST} 个积分换 1 个币。抓到一只娃娃，
        按下面的数换商城币。商城币和积分在兑换口是 <b>1 比 1</b>，
        所以「平均每局换回多少商城币」就等于「平均每局拿回多少积分」。
      </p>

      {/* ---- 中奖率 ---- */}
      <div className="mt-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold text-ink-900">中奖率</span>
          <span className="text-xs text-ink-500">
            大约每 {Math.max(2, Math.round(1 / winRate))} 局中 1 只
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2" data-claw-winrate>
          {CLAW_WIN_RATE_CHOICES.map((c) => {
            const on = Math.abs(c.value - winRate) < 1e-9
            return (
              <button
                key={c.label}
                disabled={!gateOpen}
                onClick={() => setWinRate(c.value)}
                aria-pressed={on}
                data-claw-winrate-option={c.label}
                className={
                  'btn h-11 min-w-[4.5rem] rounded-full px-3 text-sm font-extrabold shadow-flat active:btn-press disabled:opacity-50 ' +
                  (on ? 'bg-sun-300 text-ink-900' : 'bg-white text-ink-700')
                }
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- 每只换多少商城币 ---- */}
      <div className="mt-3">
        <span className="text-sm font-extrabold text-ink-900">抓到一只换多少商城币</span>
        <div className="mt-2 flex flex-wrap gap-2" data-claw-exchange>
          {CLAW_EXCHANGE_CHOICES.map((v) => {
            const on = v === exchange
            /*
              ⚠️ 不安全的那几档**按不动**。判断用的是 `clawEconomyIsSafe` ——
              和结算时那条硬闸门是**同一个函数**，不是照抄一份公式。
            */
            const ok = clawEconomyIsSafe({ winRate, exchangePerPrize: v })
            return (
              <button
                key={v}
                disabled={!gateOpen || !ok}
                onClick={() => void updateSettings({ clawExchangePerPrize: v })}
                aria-pressed={on}
                title={ok ? undefined : '这个组合会让娃娃机变成刷分工具'}
                data-claw-exchange-option={v}
                className={
                  'btn h-11 min-w-[3.5rem] rounded-full px-3 text-sm font-extrabold shadow-flat active:btn-press disabled:opacity-40 ' +
                  (on ? 'bg-grass-300 text-ink-900' : 'bg-white text-ink-700')
                }
              >
                {v}
              </button>
            )
          })}
        </div>
      </div>

      {/* ---- 实际算出来的期望值 ---- */}
      <div className="mt-3 rounded-2xl border-3 border-ink-900/10 bg-paper-2 px-3 py-2.5">
        <p className="text-sm font-extrabold text-ink-900" data-claw-expected>
          平均每玩一局：花掉 {CLAW_PLAY_COST} 积分，换回 {expected.toFixed(2)} 商城币
        </p>
        <p className="mt-1 text-xs leading-snug text-ink-500">
          净花 {(CLAW_PLAY_COST - expected).toFixed(2)} 积分。娃娃机是花积分玩的地方，
          不是攒积分的地方 —— 上限 {CLAW_MAX_EXPECTED}，留了安全边际。
        </p>
      </div>

      {problem ? (
        /* 正常操作走不到这里（不安全的档位按不动），但存档是能被手改的 —— 留着这一支。 */
        <p
          data-claw-problem
          className="mt-2 rounded-xl bg-berry-200 px-3 py-2 text-xs font-bold leading-snug text-ink-900"
        >
          ⚠️ {problem}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs leading-snug text-ink-500">
          这局中不中，投币那一刻就定了。刷新页面不会重来一次。
        </p>
        <button
          disabled={!gateOpen}
          onClick={reset}
          className="btn h-11 shrink-0 rounded-full bg-white px-3 text-xs font-extrabold text-ink-700 shadow-flat active:btn-press disabled:opacity-50"
        >
          恢复默认
        </button>
      </div>
    </Card>
  )
}
