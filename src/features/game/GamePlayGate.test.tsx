import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useApp } from '@/store/useApp'
import { DEFAULT_SETTINGS } from '@/db/db'
import { appDayKey, addDays } from '@/domain/time'
import { GamePlayGate } from './GamePlayGate'
import type { AppSettings } from '@/domain/types'

/* ============================================================
   每天游戏时长闸门（家长 2026-10-28 的「沉迷设定」）
   ------------------------------------------------------------
   这一层的错法**全是静默的**：
     · 不限时也锁 ⇒ 所有人都进不去游戏，而控制台一句错都没有；
     · 跨天不归零 ⇒ 昨天玩满，今天一开就锁死，家长以为「坏了」；
     · 锁定时不卸载游戏 ⇒ 孩子照样能玩，只是上面多了一句话。
   所以三条都要有判据，而且判据要**同时**看「游戏在不在」和「锁屏在不在」——
   只判一边的话，「两边都没有」也会绿。
   ============================================================ */

const setSettings = (patch: Partial<AppSettings>) => {
  useApp.setState({ settings: { ...DEFAULT_SETTINGS, ...patch } })
}

const todayKey = () => appDayKey(Date.now(), DEFAULT_SETTINGS.dayStartHour)

const Game = () => <div data-testid="game">游戏画面</div>

beforeEach(() => {
  setSettings({})
})

describe('GamePlayGate：没设上限时一个字节都不变', () => {
  it('原样放行，不出现锁屏', () => {
    setSettings({ gameDailyMinutes: 0, gameClock: { day: todayKey(), sec: 99_999 } })
    render(
      <GamePlayGate>
        <Game />
      </GamePlayGate>,
    )
    expect(screen.getByTestId('game')).toBeTruthy()
    expect(screen.queryByText('今天的游戏时间用完了')).toBeNull()
  })

  it('★ 放行时不套多余的一层 div（游戏页量容器高度会受影响）', () => {
    setSettings({ gameDailyMinutes: 0 })
    const { container } = render(
      <GamePlayGate>
        <Game />
      </GamePlayGate>,
    )
    // fragment ⇒ 挂载点下面直接就是游戏节点本身
    expect(container.firstElementChild?.getAttribute('data-testid')).toBe('game')
  })
})

describe('GamePlayGate：玩到上限就锁', () => {
  it('★ 玩满 30 分钟 ⇒ 游戏被卸载、锁屏出现', () => {
    setSettings({ gameDailyMinutes: 30, gameClock: { day: todayKey(), sec: 30 * 60 } })
    render(
      <GamePlayGate>
        <Game />
      </GamePlayGate>,
    )
    // 两边都判：只判锁屏在，看不出「游戏其实还挂着」
    expect(screen.queryByTestId('game')).toBeNull()
    expect(screen.getByText('今天的游戏时间用完了')).toBeTruthy()
    expect(screen.getByText('今天已经玩满 30 分钟了。')).toBeTruthy()
  })

  it('还差一点 ⇒ 不锁', () => {
    setSettings({ gameDailyMinutes: 30, gameClock: { day: todayKey(), sec: 30 * 60 - 60 } })
    render(
      <GamePlayGate>
        <Game />
      </GamePlayGate>,
    )
    expect(screen.getByTestId('game')).toBeTruthy()
    expect(screen.queryByText('今天的游戏时间用完了')).toBeNull()
  })
})

describe('GamePlayGate：跨天自动归零', () => {
  it('★ 昨天玩满了，今天照样能玩', () => {
    const yesterday = addDays(todayKey(), -1)
    setSettings({ gameDailyMinutes: 30, gameClock: { day: yesterday, sec: 30 * 60 } })
    render(
      <GamePlayGate>
        <Game />
      </GamePlayGate>,
    )
    expect(screen.getByTestId('game')).toBeTruthy()
    expect(screen.queryByText('今天的游戏时间用完了')).toBeNull()
  })
})
