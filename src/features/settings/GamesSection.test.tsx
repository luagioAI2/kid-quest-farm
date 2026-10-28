import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '@/store/useApp'
import { DEFAULT_SETTINGS } from '@/db/db'
import { appDayKey } from '@/domain/time'
import { GamesSection } from './GamesSection'
import type { AppSettings } from '@/domain/types'

/* ============================================================
   设置 → 游戏（2026-10-28 改版）
   ------------------------------------------------------------
   这一屏这轮变了三件事，每一件都可能**悄悄变回去**：
     ① 钻石卡没了（含手动发放）—— 但顶栏还要显示钻石，所以不能连字段一起删；
     ② 在线商店卡没了 —— 组件已经删掉，这里钉「这一页不再出现」；
     ③ 新增「每天玩多久」—— 到点锁游戏那一格。

   为什么要专门钉 ①②：删一张卡最省事的做法是「把渲染那行注释掉」，
   组件和文案都还在，下次谁把注释打开就回来了。判据要落在**页面上**。
   ============================================================ */

const setSettings = (patch: Partial<AppSettings>) => {
  useApp.setState({ settings: { ...DEFAULT_SETTINGS, ...patch } })
}

const todayKey = () => appDayKey(Date.now(), DEFAULT_SETTINGS.dayStartHour)

beforeEach(() => {
  setSettings({})
})

describe('设置 → 游戏：这轮删掉的两张卡', () => {
  it('★ 没有「钻石」卡，也没有手动发放入口', () => {
    render(<GamesSection gateOpen />)
    // 「钻石」这个词只在顶栏出现，这一页不该再有
    expect(screen.queryByText('钻石')).toBeNull()
    expect(document.querySelector('[data-mall-mint]')).toBeNull()
    expect(document.querySelector('[data-mall-balance]')).toBeNull()
  })

  it('★ 没有「在线商店」卡', () => {
    render(<GamesSection gateOpen />)
    expect(screen.queryByText(/在线商店/)).toBeNull()
  })

  it('★ 这张表叫「我的游戏」，不叫「游戏市场」', () => {
    // 家长：「游戏市场换个名字，这些都是已经购买的游戏。」
    render(<GamesSection gateOpen />)
    // 卡片标题是「🎮 我的游戏」一个文本节点 ⇒ 用正则，别写精确串
    expect(screen.getByText(/我的游戏/)).toBeTruthy()
    expect(screen.queryByText(/游戏市场/)).toBeNull()
  })

  it('★ 没有价格 / 购买按钮 / 敬请期待', () => {
    render(<GamesSection gateOpen />)
    expect(document.querySelector('[data-buy-game]')).toBeNull()
    expect(screen.queryByText('敬请期待')).toBeNull()
  })
})

describe('设置 → 游戏：每天玩多久', () => {
  it('六个档位都在，默认是「不限」', () => {
    render(<GamesSection gateOpen />)
    for (const label of ['不限', '15 分钟', '30 分钟', '45 分钟', '60 分钟', '90 分钟']) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
    }
    expect(screen.getByText('今天还没开始玩，没有设上限。')).toBeTruthy()
  })

  it('点了「30 分钟」真的写进设置', async () => {
    const user = userEvent.setup()
    render(<GamesSection gateOpen />)
    await user.click(screen.getByRole('button', { name: '30 分钟' }))
    expect(useApp.getState().settings.gameDailyMinutes).toBe(30)
  })

  it('★ 今日用量按「已玩 + 上限」算，不写死', () => {
    setSettings({ gameDailyMinutes: 30, gameClock: { day: todayKey(), sec: 10 * 60 } })
    render(<GamesSection gateOpen />)
    expect(screen.getByText('今天已经玩了 10 分钟，还能玩 20 分钟。')).toBeTruthy()
  })

  it('★ 玩满之后写 0 分钟，不写负数', () => {
    setSettings({ gameDailyMinutes: 30, gameClock: { day: todayKey(), sec: 45 * 60 } })
    render(<GamesSection gateOpen />)
    expect(screen.getByText(/还能玩 0 分钟/)).toBeTruthy()
  })

  it('家长锁没开时按钮是禁用的（孩子改不了）', () => {
    render(<GamesSection gateOpen={false} />)
    expect(screen.getByRole('button', { name: '30 分钟' })).toBeDisabled()
  })
})
