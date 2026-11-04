import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { STOREFRONT } from '@/games/storefront'
import { BoxView } from './BoxView'

/* ============================================================
   开箱揭晓层 —— 「一单开出几款就要看见几款」
   ------------------------------------------------------------
   这个组件原来只接一个 `gameId`。5 连开上线后，它会把一单的 5 款
   **只揭晓 1 款**，另外 4 款静默进游戏柜：孩子付了 5 份的钱、
   屏幕上只有一张卡，而库里的东西是对的 —— 这种错不会让任何断言变红，
   只有「数屏幕上有几张卡」才发现。

   所以这里钉两件事：① 单款时文案不变（别把老文案改坏）；
   ② 多款时**每一款都列出来**，且标题说清是几款。
   ============================================================ */

const GAMES = STOREFRONT.slice(0, 5).map((s) => s.id)

describe('开箱揭晓层', () => {
  it('单款：还是原来那两句（「这张盲盒里是这一款」）', () => {
    render(<BoxView gameIds={[GAMES[0]]} onDone={() => {}} />)
    expect(screen.getByText('抽到了新游戏')).toBeTruthy()
    expect(screen.getByText(/这张盲盒里是这一款/)).toBeTruthy()
    // 只列 1 款 ⇒ 只该有 1 个 NEW 标签
    expect(screen.getAllByText('NEW')).toHaveLength(1)
  })

  it('★ 5 连开：5 款都要出现在屏幕上，标题写清是 5 款', () => {
    render(<BoxView gameIds={GAMES} onDone={() => {}} />)
    expect(screen.getByText('抽到了 5 款新游戏')).toBeTruthy()
    expect(screen.getByText(/这一盒里是这 5 款/)).toBeTruthy()
    expect(screen.getAllByText('NEW')).toHaveLength(5)

    // 每一款的**名字**都要在 —— 只数卡片的话，5 张同名卡也能过
    for (const id of GAMES) {
      const entry = STOREFRONT.find((s) => s.id === id)
      expect(entry, `${id} 应该在商店目录里`).toBeTruthy()
      expect(screen.getByText(entry!.name), `缺了 ${entry!.name}`).toBeTruthy()
    }
  })

  it('「收下」能关掉这一层', async () => {
    const onDone = vi.fn()
    render(<BoxView gameIds={GAMES.slice(0, 2)} onDone={onDone} />)
    await userEvent.click(screen.getByText('收下'))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
