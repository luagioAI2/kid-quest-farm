/**
 * 「🔥 连续 N 天」徽章的显示边界。
 *
 * 对应的事故：第 1 天徽章就挂出来「连续 1 天」，可那天**一分连击都不发**
 * （`maybePayStreakBonus` 在第 1 天直接返回 0）——
 * 界面承诺了一个发不出来的奖励。
 * 2026-10-12 家长拍板：「第 1 天不显示徽章」。
 *
 * 为什么在 jsdom 里测：这是**渲染结构**问题（徽章在不在 DOM 里），
 * 渲染出来就能判，不用真浏览器。真浏览器的走查由 `scripts/capture.mjs` 兜底。
 *
 * ⚠️ 判据本身（`streakPaysOn`）在 `domain/streakBonus.test.ts` 里测。
 * 这里测的是**另一个问题**：「这个组件真的用了那个判据吗」。
 * 两处分开才拦得住「函数写对了、组件里却写回 `streak > 0`」这种改法 ——
 * 那正是这次修的 bug 的形状。
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StreakBadge } from './TaskPage'

describe('连击徽章 —— 第 1 天不显示（只在真的会发分时出现）', () => {
  it('★ 第 1 天：整个徽章不渲染', () => {
    // 修之前这里是 `streak > 0`，于是第 1 天会渲染出「连续 1 天」。
    const { container } = render(<StreakBadge streak={1} />)
    expect(container.textContent, '第 1 天不该出现徽章').toBe('')
    expect(screen.queryByText(/连续/)).toBeNull()
  })

  it('★ 第 0 天（压根没连上）：也不渲染', () => {
    const { container } = render(<StreakBadge streak={0} />)
    expect(container.textContent).toBe('')
  })

  it('第 2 天：渲染「连续 2 天」—— 这天开始真的发分了', () => {
    render(<StreakBadge streak={2} />)
    expect(screen.getByText('连续 2 天')).toBeTruthy()
  })

  it('第 7 天：天数跟着走，不是写死的', () => {
    render(<StreakBadge streak={7} />)
    expect(screen.getByText('连续 7 天')).toBeTruthy()
    expect(screen.queryByText('连续 2 天')).toBeNull()
  })
})
