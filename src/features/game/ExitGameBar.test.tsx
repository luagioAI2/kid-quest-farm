/**
 * 全屏游戏顶上那条「退出游戏」（2026-11-09）。
 *
 * 守两件事：
 *   ① 按钮存在、点得动、点了会回调 —— 这一屏**没有底栏**，
 *      它要是没渲染出来，孩子就被关在游戏里了（唯一的出口）。
 *   ② 锚点 `data-tour="exit-game"` 别改名：走查脚本和 e2e 都靠它离开游戏，
 *      底栏在游戏这一屏是隐藏的，改了就只剩「刷页面」这一条路。
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ExitGameBar } from './ExitGameBar'

describe('ExitGameBar', () => {
  it('渲染「退出游戏」并带锚点', () => {
    render(<ExitGameBar onExit={() => {}} />)
    const btn = screen.getByRole('button', { name: '退出游戏' })
    expect(btn).toBeTruthy()
    expect(btn.getAttribute('data-tour')).toBe('exit-game')
    /* 文案要看得见，不能只有 aria-label —— 孩子不看无障碍名 */
    expect(btn.textContent).toContain('退出游戏')
  })

  it('点一下就回调（出口是真的通的）', async () => {
    const onExit = vi.fn()
    const user = userEvent.setup()
    render(<ExitGameBar onExit={onExit} />)
    await user.click(screen.getByRole('button', { name: '退出游戏' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})
