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

/* ============================================================
   没拥有不能装（2026-10-30 家长拍板）
   ------------------------------------------------------------
   门槛本身在 `installLocalGame` 里（单测在 store），这里钉的是**界面**：

     · 没拥有的那一行**不许出现安装按钮** —— 摆一个按钮再点出一句
       「还没拥有」是最差的组合：界面先承诺，再当场否认；
     · 那颗灰药丸是 `span`（不可点），却坐在动作列里、外面裹着
       `pointer-events-auto` ⇒ 整行别处都能点进详情，唯独这块点下去没事发生。
       所以它**只能陈述状态**，不能写「去…」这种像指令的话。
   ============================================================ */
describe('设置 → 游戏：没拥有不能装', () => {
  const GAME = 'cloudfarm'

  it('★ 没拥有：没有安装按钮，只写「未拥有」', () => {
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    expect(document.querySelector(`[data-local-install="${GAME}"]`)).toBeNull()
    const need = document.querySelector(`[data-local-need-own="${GAME}"]`)
    expect(need).toBeTruthy()
    // 不是按钮 ⇒ 不能让人以为点了会有反应
    expect(need!.tagName).toBe('SPAN')
    expect(need!.textContent?.trim()).toBe('未拥有')
  })

  it('★ 拥有之后才出现安装按钮，那颗「未拥有」消失', () => {
    useApp.setState({ ownedGameIds: [GAME], installedGames: {} })
    render(<GamesSection gateOpen />)
    expect(document.querySelector(`[data-local-need-own="${GAME}"]`)).toBeNull()
    expect(document.querySelector(`[data-local-install="${GAME}"]`)).toBeTruthy()
  })

  it('★ 详情页同一个口径：没拥有时也不摆安装按钮', async () => {
    /*
      列表和详情是**同一个动作的两个入口**。2026-10-30 实拍发现：
      列表行写着「未拥有」，点进详情却是一个大黄「安装」——
      点下去当然装不成，弹「没装成 / 还没拥有」。
      正是列表注释里那句「界面先承诺，再当场否认」。
    */
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    const open = document.querySelector(`[data-store-detail="${GAME}"]`) as HTMLElement
    expect(open).toBeTruthy()
    await userEvent.click(open)

    const dlg = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
    expect(dlg).toBeTruthy()
    expect(dlg!.querySelector(`[data-local-install="${GAME}"]`)).toBeNull()
    expect(dlg!.querySelector(`[data-local-need-own="${GAME}"]`)).toBeTruthy()
    // 详情页是单独的屏，列表底部那句说明它看不到 ⇒ 这里必须自己说一句
    expect(dlg!.textContent).toMatch(/兑换/)
  })

  it('★ 详情页：拥有之后那颗按钮回来', async () => {
    useApp.setState({ ownedGameIds: [GAME], installedGames: {} })
    render(<GamesSection gateOpen />)
    const open = document.querySelector(`[data-store-detail="${GAME}"]`) as HTMLElement
    await userEvent.click(open)
    const dlg = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
    expect(dlg!.querySelector(`[data-local-install="${GAME}"]`)).toBeTruthy()
    expect(dlg!.querySelector(`[data-local-need-own="${GAME}"]`)).toBeNull()
  })

  it('★ 详情页同一个口径：没拥有时也不摆安装按钮', async () => {
    /*
      列表和详情是**同一个动作的两个入口**。2026-10-30 实拍发现：
      列表行写着「未拥有」，点进详情却是一个大黄「安装」——
      点下去当然装不成，弹「没装成 / 还没拥有」。
      正是列表注释里那句「界面先承诺，再当场否认」。
    */
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    const open = document.querySelector(`[data-store-detail="${GAME}"]`) as HTMLElement
    expect(open).toBeTruthy()
    await userEvent.click(open)

    const dlg = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
    expect(dlg).toBeTruthy()
    expect(dlg!.querySelector(`[data-local-install="${GAME}"]`)).toBeNull()
    expect(dlg!.querySelector(`[data-local-need-own="${GAME}"]`)).toBeTruthy()
    // 详情页是单独的屏，列表底部那句说明它看不到 ⇒ 这里必须自己说一句
    expect(dlg!.textContent).toMatch(/兑换/)
  })

  it('★ 详情页：拥有之后那颗按钮回来', async () => {
    useApp.setState({ ownedGameIds: [GAME], installedGames: {} })
    render(<GamesSection gateOpen />)
    const open = document.querySelector(`[data-store-detail="${GAME}"]`) as HTMLElement
    await userEvent.click(open)
    const dlg = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
    expect(dlg!.querySelector(`[data-local-install="${GAME}"]`)).toBeTruthy()
    expect(dlg!.querySelector(`[data-local-need-own="${GAME}"]`)).toBeNull()
  })

  it('★ 表底说明指向「兑换」，不写「在那里用券换」', () => {
    // 心愿商城**不收钱**（`WishPage` 只把人送到兑换，见 `jumpToRedeem`）。
    // 旧文案写「在那里用兑换券换」⇒ 家长照着去心愿页找付款按钮，只会看到「去兑换换」。
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    const p = [...document.querySelectorAll('p')].find((x) =>
      /还不能装/.test(x.textContent ?? ''),
    )
    expect(p).toBeTruthy()
    expect(p!.textContent).toMatch(/兑换/)
    expect(p!.textContent).not.toMatch(/在那里/)
  })
})

/* ============================================================
   没拥有不能装（2026-10-30 家长拍板）
   ------------------------------------------------------------
   门槛本身在 `installLocalGame` 里（单测在 store），这里钉的是**界面**：

     · 没拥有的那一行**不许出现安装按钮** —— 摆一个按钮再点出一句
       「还没拥有」是最差的组合：界面先承诺，再当场否认；
     · 那颗灰药丸是 `span`（不可点），却坐在动作列里、外面裹着
       `pointer-events-auto` ⇒ 整行别处都能点进详情，唯独这块点下去没事发生。
       所以它**只能陈述状态**，不能写「去…」这种像指令的话。
   ============================================================ */
describe('设置 → 游戏：没拥有不能装', () => {
  const GAME = 'cloudfarm'

  it('★ 没拥有：没有安装按钮，只写「未拥有」', () => {
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    expect(document.querySelector(`[data-local-install="${GAME}"]`)).toBeNull()
    const need = document.querySelector(`[data-local-need-own="${GAME}"]`)
    expect(need).toBeTruthy()
    // 不是按钮 ⇒ 不能让人以为点了会有反应
    expect(need!.tagName).toBe('SPAN')
    expect(need!.textContent?.trim()).toBe('未拥有')
  })

  it('★ 拥有之后才出现安装按钮，那颗「未拥有」消失', () => {
    useApp.setState({ ownedGameIds: [GAME], installedGames: {} })
    render(<GamesSection gateOpen />)
    expect(document.querySelector(`[data-local-need-own="${GAME}"]`)).toBeNull()
    expect(document.querySelector(`[data-local-install="${GAME}"]`)).toBeTruthy()
  })

  it('★ 表底说明指向「兑换」，不写「在那里用券换」', () => {
    // 心愿商城**不收钱**（`WishPage` 只把人送到兑换，见 `jumpToRedeem`）。
    // 旧文案写「在那里用兑换券换」⇒ 家长照着去心愿页找付款按钮，只会看到「去兑换换」。
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    const p = [...document.querySelectorAll('p')].find((x) =>
      /还不能装/.test(x.textContent ?? ''),
    )
    expect(p).toBeTruthy()
    expect(p!.textContent).toMatch(/兑换/)
    expect(p!.textContent).not.toMatch(/在那里/)
  })
})
