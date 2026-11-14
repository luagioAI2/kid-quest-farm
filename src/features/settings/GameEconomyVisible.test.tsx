import { beforeEach, describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '@/store/useApp'
import { GameMarket } from './GameStore'
import type { GameManifestV2 } from '@/games/plugin'

/* ============================================================
   经济参数必须对家长可见（spec §4.4）
   ------------------------------------------------------------
   它原来在「游戏市场」那张卡里（`PluginStoreCard.tsx`）。2026-10-29
   那张卡整体删掉时**连它一起删了** —— 而 22 个 e2e 的断言还指着它，
   从那天起每个脚本都红两条，谁也没看出来那是「界面没了」而不是「断言错了」。

   现在它收在**详情**里（列表页仍然只有「装 / 卸 / 设为当前」）。
   这条测试钉三件事：
     ① 列表页上**没有**这块（不然等于把删掉的那一层加回来了）；
     ② 点进详情、装过之后**有**；
     ③ 写的是**这款游戏自己的**数，不是模板。
   ============================================================ */

const ANTHILL_VERSION = '1.0.0' // 与 localGames.ts 一致；版本对不上就不是「已装」状态

const installedAnthill: GameManifestV2 = {
  id: 'anthill',
  name: '蚂蚁搬家',
  emoji: '🐜',
  tabLabel: '蚂蚁',
  version: ANTHILL_VERSION,
  minHostApi: 1,
  coin: { id: 'anthill_coin', name: '糖粒', emoji: '🍬' },
  economy: {
    playCost: 15,
    expectedPayout: 9,
    capPerPrize: 40,
    // 0 = 不开放兑换。这一款就是「换不成兑换券」，断言要能区分出这一点
    voucherPerCoin: 0,
  },
}

beforeEach(() => {
  useApp.setState({ installedGames: {} })
})

describe('设置 → 游戏 → 详情：经济参数', () => {
  it('列表页上没有这块（它只在详情里）', () => {
    useApp.setState({ installedGames: { anthill: installedAnthill } })
    render(<GameMarket gateOpen />)
    expect(document.querySelector('[data-plugin-economy]')).toBeNull()
  })

  it('★ 装过之后，详情里能看到「一局 15 积分」和「不开放兑换券」', async () => {
    useApp.setState({ installedGames: { anthill: installedAnthill } })
    render(<GameMarket gateOpen />)

    await userEvent.click(document.querySelector('[data-store-detail="anthill"]') as HTMLElement)

    const econ = document.querySelector('[data-plugin-economy]')
    expect(econ).toBeTruthy()
    const text = (econ?.textContent ?? '').replace(/\s+/g, ' ')
    expect(text).toMatch(/一局\s*15\s*积分/)
    expect(text).toMatch(/不开放兑换券/)
    // 写的是自己的数，不是别人的模板
    expect(text).toContain('糖粒')
    expect(text).toContain('9')
  })

  it('★ 拥有但没装：详情里没有参数可看（manifest 还没下来）', async () => {
    /*
      2026-11-07 起「未拥有的游戏不显示」⇒ 未拥有的行**整行不渲染**，
      `[data-store-detail]` 也一起没有。原来这条断言的是「没装时详情按钮还在」，
      新口径下那个按钮根本不存在 —— 能点进详情的前提是**已经拥有**。
      所以改成「拥有但没装」：详情能打开，但里面没有经济参数。
    */
    useApp.setState({ installedGames: {}, ownedGameIds: ['anthill'] })
    render(<GameMarket gateOpen />)
    expect(document.querySelector('[data-plugin-economy]')).toBeNull()
    const open = document.querySelector('[data-store-detail="anthill"]') as HTMLElement
    expect(open).toBeTruthy()
    await userEvent.click(open)
    // 点进去也没有这一栏 —— manifest 还没下来，没有数可写
    expect(document.querySelector('[data-plugin-economy]')).toBeNull()
  })
})
