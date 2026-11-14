import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '@/store/useApp'
import { DEFAULT_SETTINGS } from '@/db/db'
import { appDayKey } from '@/domain/time'
import { GamesSection } from './GamesSection'
import type { AppSettings } from '@/domain/types'
import type { GameManifestV2 } from '@/games/plugin'

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
   我的游戏：只列**已经拥有**的（2026-11-07 家长拍板）
   ------------------------------------------------------------
   家长原话：「未拥有的游戏不要显示在上面。除非已经激活拥有。」

   ⇒ 没拥有的插件**整行不渲染**（原来是显示一颗「未拥有」药丸）。
     这一屏叫「我的游戏」，列一堆自己打不开的东西，只会让家长以为买过。

   还有三条例外**仍然显示**，因为它们已经在这台机器上生效了
   （`GameMarket` 的 `visibleRows` 里逐条写着）：装过的、当前在用的、内置游戏。

   ⚠️ 所以「未拥有药丸」那个分支**不能删** —— 装了但拥有权被撤时还会走到它。
   ============================================================ */
describe('设置 → 游戏：未拥有的不显示', () => {
  const GAME = 'cloudfarm'
  const NAME = '云边小农场'

  it('★ 没拥有：整行不出现，连名字都看不到', () => {
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    // 行不渲染 ⇒ 安装按钮 / 未拥有药丸 / 详情入口，三个锚点全都不在
    expect(document.querySelector(`[data-local-row="${GAME}"]`)).toBeNull()
    expect(document.querySelector(`[data-local-install="${GAME}"]`)).toBeNull()
    expect(document.querySelector(`[data-local-need-own="${GAME}"]`)).toBeNull()
    expect(document.querySelector(`[data-store-detail="${GAME}"]`)).toBeNull()
    // 判据最后落在**名字**上：锚点可能改名，用户看到的才是事实
    expect(screen.queryByText(NAME)).toBeNull()
  })

  it('★ 拥有之后才出现：行、安装按钮、详情入口都在', () => {
    useApp.setState({ ownedGameIds: [GAME], installedGames: {} })
    render(<GamesSection gateOpen />)
    expect(screen.getByText(NAME)).toBeTruthy()
    expect(document.querySelector(`[data-local-row="${GAME}"]`)).toBeTruthy()
    expect(document.querySelector(`[data-local-install="${GAME}"]`)).toBeTruthy()
    expect(document.querySelector(`[data-store-detail="${GAME}"]`)).toBeTruthy()
    // 拥有之后不该再有「未拥有」
    expect(document.querySelector(`[data-local-need-own="${GAME}"]`)).toBeNull()
  })

  it('★ 内置游戏不受影响（它们不存在「未拥有」）', () => {
    /*
      按拥有权过滤最容易顺手把内置游戏一起藏掉 —— 它们不占 `ownedGameIds`，
      `RowShell` 里写的是「自带」。这一屏一空，家长会以为游戏全丢了。
    */
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    // 内置行用的是 `data-market-builtin`（`data-local-row` 只挂在插件行上）
    expect(document.querySelector('[data-market-builtin="farm"]')).toBeTruthy()
  })

  it('★ 装过的即使拥有权被撤，也要留在表里（否则没地方卸载）', () => {
    /*
      `installedGames` 有值 = 这台机器上真的装了。藏掉的话：包还占着空间、
      存档还在，而家长既看不到它、也没地方卸载。
    */
    useApp.setState({
      ownedGameIds: [],
      installedGames: {
        [GAME]: {
          id: GAME,
          name: NAME,
          emoji: '🌾',
          tabLabel: '农场',
          version: '1.0.0',
          minHostApi: 1,
        } as unknown as GameManifestV2,
      },
    })
    render(<GamesSection gateOpen />)
    expect(document.querySelector(`[data-local-row="${GAME}"]`)).toBeTruthy()
  })

  it('★ 详情页那道闸不能松：只有拥有的才摆安装按钮', async () => {
    // 列表把未拥有的行藏了，详情就只剩「拥有的」这一条入口 ——
    // 但详情自己也得判一次（`GameDetailSheet` 拿的是同一个 `ownedSet`）。
    useApp.setState({ ownedGameIds: [GAME], installedGames: {} })
    render(<GamesSection gateOpen />)
    const open = document.querySelector(`[data-store-detail="${GAME}"]`) as HTMLElement
    expect(open).toBeTruthy()
    await userEvent.click(open)
    const dlg = document.querySelector('[role="dialog"][aria-label="游戏详情"]')
    expect(dlg).toBeTruthy()
    expect(dlg!.querySelector(`[data-local-install="${GAME}"]`)).toBeTruthy()
  })

  it('★ 表底那几句说明和「有兑换码？」入口都已经删掉', () => {
    /*
      2026-11-07 家长：「表里只有已经拥有的游戏。想要别的：……卸载在「详情」
      最下面 —— 会把存档一起删掉。🎟️ 有兑换码？  这些不需要。」
      ⇒ 整块删掉（说明 + 输码入口）。

      这条从「说明里要写『兑换』」翻过来，是因为**那一整段不存在了**：
      还按原文案断言的话，删掉之后它红在一个和被测行为无关的地方，
      而报错只会说「expected undefined to be truthy」。

      ⚠️ 别再往回加：这一屏是控制台，不是介绍页 —— 同一张卡 2026-11-07
         已经因为同样的理由删过两段说明（见 `GameStore.tsx` 的注释）。
         输码现在只剩「心愿 → 商品详情 / 家长定价页」一条路。
    */
    useApp.setState({ ownedGameIds: [], installedGames: {} })
    render(<GamesSection gateOpen />)
    expect(
      [...document.querySelectorAll('p')].some((x) => /只有已经拥有/.test(x.textContent ?? '')),
      '表底那段说明不该再有',
    ).toBe(false)
    expect(document.querySelector('[data-code-open]'), '设置里不该再有输码入口').toBeNull()
    expect(document.querySelector('[data-code-box]')).toBeNull()
  })
})
