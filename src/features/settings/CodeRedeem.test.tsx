import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '@/store/useApp'
import { GameMarket } from './GameStore'

/* ============================================================
   设置 → 游戏 →「有兑换码？」
   ------------------------------------------------------------
   store 层（`redeemGameCode`）有两条测试（离线 / 在线），但**界面这条路
   一行都没有** —— 也就是说「家长输完码之后看见什么」从来没人验过。
   而这一屏最要紧的恰恰是那句话：码错了要能对着改，码对了要知道装没装上。

   这里钉四件事：
     ① 家长锁没开时**打不开**（孩子不能自己输码换游戏）；
     ② 输进去的码原样交给 store（归一化在 store 里做，界面不偷偷改）；
     ③ 成功 → 绿字 + 清空输入框（好让家长输下一张）；
     ④ 失败 → 红字 + **不清空**（要能对着改一位）。
   ============================================================ */

const openBox = async () => {
  render(<GameMarket gateOpen />)
  await userEvent.click(screen.getByText(/有兑换码/))
  return document.querySelector('[data-code-input]') as HTMLInputElement
}

beforeEach(() => {
  useApp.setState({ installedGames: {} })
})

describe('设置 → 游戏：兑换码', () => {
  it('★ 家长锁没开时打不开（孩子不能自己换游戏）', () => {
    render(<GameMarket gateOpen={false} />)
    const btn = screen.getByText(/有兑换码/).closest('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(document.querySelector('[data-code-box]')).toBeNull()
  })

  it('★ 成功：绿字 + 清空输入框', async () => {
    const redeemGameCode = vi.fn(async () => ({ ok: true, message: '已激活：蚂蚁搬家' }))
    useApp.setState({ redeemGameCode })

    const input = await openBox()
    await userEvent.type(input, 'abc-def')
    await userEvent.click(document.querySelector('[data-code-submit]') as HTMLElement)

    // 界面不偷偷改大小写 / 不替用户去掉那一横 —— 归一化是 store 的事
    expect(redeemGameCode).toHaveBeenCalledWith('abc-def')

    const msg = document.querySelector('[data-code-msg]')
    await waitFor(() => expect(msg?.textContent).toContain('已激活'))
    expect(msg?.getAttribute('data-code-ok')).toBe('1')
    expect((document.querySelector('[data-code-input]') as HTMLInputElement).value).toBe('')
  })

  it('★ 失败：红字 + 输入框留着刚敲的码（要能对着改一位）', async () => {
    const redeemGameCode = vi.fn(async () => ({
      ok: false,
      message: '这张卡已经被用过了',
    }))
    useApp.setState({ redeemGameCode })

    const input = await openBox()
    await userEvent.type(input, 'ABC-DEG')
    await userEvent.click(document.querySelector('[data-code-submit]') as HTMLElement)

    const msg = document.querySelector('[data-code-msg]')
    await waitFor(() => expect(msg?.textContent).toContain('已经被用过'))
    expect(msg?.getAttribute('data-code-ok')).toBe('0')
    expect((document.querySelector('[data-code-input]') as HTMLInputElement).value).toBe('ABC-DEG')
  })
})
