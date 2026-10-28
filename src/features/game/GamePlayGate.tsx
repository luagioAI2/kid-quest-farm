import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../../store/useApp'
import { appDayKey } from '../../domain/time'
import {
  clampGameDailyMinutes,
  remainingSec,
  rollGameClock,
} from '../../domain/gameTime'

/**
 * 游戏那一格的时长闸门 —— 家长 2026-10-28 的「沉迷设定」。
 *
 * ```
 *   settings.gameDailyMinutes = 0   → 原样放行（老用户 / 没设过的人走这条，零开销）
 *   settings.gameDailyMinutes > 0   → 一边玩一边记，玩满就把游戏换成一句「今天玩完了」
 * ```
 *
 * ## 为什么挂在**这一层**，而不是游戏里
 *
 * 游戏有三种来源（内置农场 / 插件包 / 将来的），它们各自的代码不该知道
 * 「宿主有没有限时」这回事 —— 那是宿主的政策。所以闸门只包住
 * `App.tsx` 里游戏那一格，**对游戏本身零侵入**。
 *
 * ## ⚠️ 不锁定时渲染的是 `fragment`
 *
 * `<main>` 是 `flex flex-col`，游戏页（尤其农场那种整屏 canvas）是**量容器
 * 高度**来铺满的。多包一层 `<div>` 会改变它的父容器尺寸，画面会莫名矮一截。
 * 所以放行时返回 `children` 本身，DOM 结构和一个字节都没变。
 *
 * ## 计时的三个数
 *
 * | 数 | 在哪 | 作用 |
 * | --- | --- | --- |
 * | `settings.gameClock` | Dexie（落盘） | 跨重启还在的累计秒数 + 属于哪一天 |
 * | `ticksRef` | 内存 | 这次挂载之后还没落库的 tick 数 |
 * | `ticks` | state | 只为了让「还能玩多久」重画 |
 *
 * 落库是**绝对值**（`当前累计 + 本次未落库`），不是增量 —— 增量在
 * 「落库失败一次 / 两个标签页同时写」时会丢或重复。
 *
 * ## ⚠️ 页面不可见时不计时
 *
 * 切到别的 App / 锁屏时 `visibilityState === 'hidden'`，`setInterval` 本来也会
 * 被浏览器节流到 1 分钟一次；显式跳过，免得「孩子没玩却在扣额度」。
 */

/** 计时粒度。1 秒会让整棵树每秒重画一次，15 秒足够准（锁早/锁晚最多 15 秒） */
const TICK_SEC = 15
/** 每 4 个 tick 落一次库（60 秒）—— 进程被杀最多丢 1 分钟 */
const FLUSH_EVERY = 4

export function GamePlayGate({ children }: { children: ReactNode }) {
  const limitMin = clampGameDailyMinutes(useApp((s) => s.settings.gameDailyMinutes))
  const clock = useApp((s) => s.settings.gameClock)
  const dayStartHour = useApp((s) => s.settings.dayStartHour)
  const updateSettings = useApp((s) => s.updateSettings)

  /** 这次挂载之后走过多少 tick（还没落库的那部分）。ref 给 interval 读，state 给渲染读 */
  const ticksRef = useRef(0)
  const [ticks, setTicks] = useState(0)

  const dayKey = appDayKey(Date.now(), dayStartHour)
  const baseSec = rollGameClock(clock, dayKey).sec
  const playedSec = baseSec + ticks * TICK_SEC
  const remain = remainingSec(limitMin, playedSec)
  const locked = remain <= 0

  const flush = useCallback(() => {
    const n = ticksRef.current
    if (n <= 0) return
    ticksRef.current = 0
    setTicks(0)
    // 从 store 现读，不闭包捕获 —— 中间可能被「改上限」「跨天」动过
    const s = useApp.getState().settings
    const cur = rollGameClock(s.gameClock, appDayKey(Date.now(), s.dayStartHour))
    void updateSettings({ gameClock: { day: cur.day, sec: cur.sec + n * TICK_SEC } })
  }, [updateSettings])

  useEffect(() => {
    // 不限时 / 已经玩完：一个定时器都不开
    if (limitMin === 0 || locked) return
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return
      ticksRef.current += 1
      setTicks(ticksRef.current)
      if (ticksRef.current % FLUSH_EVERY === 0) flush()
    }, TICK_SEC * 1000)
    return () => {
      window.clearInterval(id)
      // 离开这一格 / 玩到上限 / 改上限：把没落库的那几 tick 结掉
      flush()
    }
  }, [limitMin, locked, flush, dayKey])

  if (!locked) return <>{children}</>

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <span className="text-5xl">🌙</span>
      <p className="mt-1 font-display text-lg font-extrabold text-ink-900">
        今天的游戏时间用完了
      </p>
      <p className="text-sm font-bold leading-snug text-ink-600">
        今天已经玩满 {limitMin} 分钟了。
      </p>
      <p className="mt-1 text-xs leading-snug text-ink-500">
        明天再来。想多玩一会儿，让爸爸妈妈去「设置 → 游戏」里改。
      </p>
    </div>
  )
}
