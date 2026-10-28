import { useApp } from '../../store/useApp'
import { Card } from './ui'
import { GameMarket } from './GameStore'
import {
  GAME_DAILY_PRESETS,
  clampGameDailyMinutes,
  formatPlayed,
  playedSecToday,
  remainingSec,
} from '../../domain/gameTime'

/**
 * 家长栏 → 「游戏」。两块，各回答一个问题：
 *
 *   ① **每天玩多久** —— 到点锁住游戏那一格（`features/game/GamePlayGate.tsx`）；
 *   ② **我的游戏** —— 所有游戏一张表：内置的 + 随包发的插件，**状态写在行上**
 *      （当前 / 已装 / 可装）。
 *
 * ## ⚠️ 2026-10-28 删掉了两块（家长原话）
 *
 *   · 「设置游戏里的钻石栏去掉」 —— 钻石卡（含手动发放）整张删掉。
 *     内置游戏一款标价的都没有，那个发币入口早就没有消耗方了；
 *     钻石现在只剩「全新档案赠送 500」一个来源，顶栏照常显示（家长要求 0 也显示）。
 *   · 「在线商店页去掉」 —— `PluginStoreCard` 连同两个测试文件一起删了。
 *     随 App 发的本地包本来就在 ② 里，那条远端目录的路没有使用者。
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
 * ⚠️ 家长说的「游戏不是为了沉迷，而是为了激励孩子完成任务」**本身就是**
 * 「不只是 X 而是 Y」—— 那句话是**要表达的意思**，不是要抄上去的字。
 *
 * ## ⚠️ 不许承诺做不到的事
 *
 * 没配地址的入口不摆按钮；买了也没得玩的东西不显示价格。
 */

export function GamesSection({ gateOpen }: { gateOpen: boolean }) {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)

  const limit = clampGameDailyMinutes(settings.gameDailyMinutes)
  const playedSec = playedSecToday(settings.gameClock, settings.dayStartHour)
  const remain = remainingSec(limit, playedSec)

  /*
    今天的用量。**只读**，不给「清零」按钮 —— 清零等于让家长一键把今天的
    额度还给孩子，而这一屏正是家长自己设的规矩。真要放开，改成「不限」
    再改回来，多一步就不会误触。

    ⚠️ 三种情况分开写，不要拼 `已经玩了 ${formatPlayed(0)}`：
       `formatPlayed(0)` 是「还没玩」，拼出来就是「已经玩了 还没玩」。
  */
  const playedLine =
    playedSec < 60
      ? limit === 0
        ? '今天还没开始玩，没有设上限。'
        : `今天还没开始玩，上限 ${limit} 分钟。`
      : limit === 0
        ? `今天已经玩了 ${formatPlayed(playedSec)}，没有设上限。`
        : `今天已经玩了 ${formatPlayed(playedSec)}，还能玩 ${Math.ceil(remain / 60)} 分钟。`

  return (
    <>
      {/* ① 每天玩多久 —— 家长 2026-10-28 的「沉迷设定」 */}
      <Card title="每天玩多久" emoji="⏳">
        <p className="text-sm leading-relaxed text-ink-500">
          到点之后游戏那一格会锁住，写一句「今天的游戏时间用完了」。
          任务、兑换、心愿都不受影响。
        </p>

        {/* 3 列栅格：5 个档位会排成「4 + 1」，右边空一格像少了一个（实测过）。
            所以档位是 6 个，正好两行。 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {GAME_DAILY_PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              disabled={!gateOpen}
              data-game-limit={m}
              onClick={() => void updateSettings({ gameDailyMinutes: m })}
              className={
                'btn rounded-full px-2 py-2 text-sm font-extrabold shadow-flat active:btn-press disabled:opacity-50 ' +
                (limit === m ? 'bg-sky-300 text-ink-900' : 'bg-white text-ink-600')
              }
            >
              {m === 0 ? '不限' : `${m} 分钟`}
            </button>
          ))}
        </div>

        {/*
          今天的用量。**只读**，不给「清零」按钮 —— 清零等于让家长
          一键把今天的额度还给孩子，而这一屏是家长自己设的规矩。
          真要放开，改成「不限」再改回来，多一步就不会误触。
        */}
        <p data-game-played className="tnum mt-3 text-xs font-bold leading-snug text-ink-500">
          {playedLine}
        </p>
      </Card>

      {/* ② 我的游戏 —— 所有游戏一张表，状态在行上（含内置 + 插件） */}
      <GameMarket gateOpen={gateOpen} />
    </>
  )
}
