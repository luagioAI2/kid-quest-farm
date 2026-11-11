import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GameFullscreenButton, ImmersiveGameBar } from './GameChrome'

/* ============================================================
   游戏页外壳控件（2026-11-11 改的交互模型）
   ------------------------------------------------------------
   这一层最容易「改了但没人发现」的错法：

     ① 全屏键和退出键**共用一个锚点** ⇒ 走查脚本点「退出」结果进了全屏，
        而脚本只判「点了没报错」，一路绿；
     ② 左上角返回做成「退出游戏」⇒ 孩子只是想收起全屏，却被踢回任务页；
     ③ 右上角胶囊不是微信那种形状 ⇒ 家长认不出来那是「关掉」，不敢点。

   所以下面每一条都盯住一个**语义**，不是盯住样式。
   ============================================================ */

describe('GameFullscreenButton', () => {
  it('点一下只把「进全屏」的请求抛出去', async () => {
    const onEnter = vi.fn()
    render(<GameFullscreenButton onEnter={onEnter} />)

    await userEvent.click(screen.getByRole('button', { name: '全屏玩' }))
    expect(onEnter).toHaveBeenCalledTimes(1)
  })

  it('★ 锚点是 game-fullscreen，不能和退出游戏的 exit-game 混用', () => {
    render(<GameFullscreenButton onEnter={() => {}} />)
    const btn = screen.getByRole('button', { name: '全屏玩' })
    expect(btn.getAttribute('data-tour')).toBe('game-fullscreen')
  })
})

describe('ImmersiveGameBar', () => {
  const renderBar = () => {
    const onExitFullscreen = vi.fn()
    const onExitGame = vi.fn()
    render(<ImmersiveGameBar onExitFullscreen={onExitFullscreen} onExitGame={onExitGame} />)
    return { onExitFullscreen, onExitGame }
  }

  it('★ 左上角返回 = 退出全屏（不是退出游戏）', async () => {
    const { onExitFullscreen, onExitGame } = renderBar()
    await userEvent.click(screen.getByRole('button', { name: '退出全屏' }))
    expect(onExitFullscreen).toHaveBeenCalledTimes(1)
    expect(onExitGame, '左上角返回把游戏也退了 —— 它只该收起全屏').not.toHaveBeenCalled()
  })

  it('★ 右上角胶囊 = 退出游戏，且保留 exit-game 锚点（二十来个脚本靠它）', async () => {
    const { onExitFullscreen, onExitGame } = renderBar()
    const capsule = screen.getByRole('button', { name: '退出游戏' })
    expect(capsule.getAttribute('data-tour')).toBe('exit-game')
    await userEvent.click(capsule)
    expect(onExitGame).toHaveBeenCalledTimes(1)
    expect(onExitFullscreen).not.toHaveBeenCalled()
  })

  it('胶囊长成微信小程序那样（••• ｜ ⊙）', () => {
    renderBar()
    const capsule = screen.getByRole('button', { name: '退出游戏' })
    /* 微信那颗胶囊左边是「•••」右边是「⊙」。这里只断言这两个字形都在 ——
       换成「更多 / 关闭」两个汉字就不是那个东西了，家长认不出来。 */
    expect(capsule.textContent).toContain('•••')
    expect(capsule.textContent).toContain('⊙')
  })

  it('整条不吃游戏点击，只有两颗按钮吃', () => {
    const { container } = render(
      <ImmersiveGameBar onExitFullscreen={() => {}} onExitGame={() => {}} />,
    )
    const bar = container.firstElementChild as HTMLElement
    expect(bar.className, '整条必须 pointer-events-none，否则农场顶栏点不动').toContain(
      'pointer-events-none',
    )
    const btns = [...bar.querySelectorAll('button')]
    expect(btns).toHaveLength(2)
    for (const b of btns) {
      expect(b.className, '按钮自己要 pointer-events-auto').toContain('pointer-events-auto')
    }
  })
})
