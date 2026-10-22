import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { PluginStoreCard } from './PluginStoreCard'

/* ============================================================
   游戏商店 —— **线上现在就是这个状态**：没配托管地址 / 没配公钥。

   这个文件**故意不 mock** `games/catalogUrl`，读的就是仓库里那个空常量。
   所以它守的是「发布出去的那一版」：

     · 远程那一栏只给一句说明，**一个按钮都不摆** —— 摆一个按下去必然
       失败的按钮，等于界面承诺了它做不到的事（`GamesSection` 里同一条规矩）；
     · **本地那一栏照常可用**：随 App 发布的包不需要托管地址、不需要网络，
       装它真的会成功。2026-10-22 之前这里把两栏一起藏了，等于
       「明明带着一个包，界面却说一个都装不了」。

   ⚠️ 必须配**正向对照**（卡片标题渲染出来了）。否则整页渲染失败时，
      「找不到按钮」照样通过 —— 单向断言在整块挂掉时是假绿。
   ============================================================ */

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

describe('游戏商店：没配托管地址时（线上状态）', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('★ 只说一句说明，而且**一个按钮都不摆**', () => {
    render(<PluginStoreCard gateOpen />)

    // 正向对照：卡片真的渲染出来了
    expect(screen.getByRole('heading', { name: /游戏商店/ }), '卡片没渲染出来，下面那条是假绿').toBeTruthy()

    const off = document.querySelector('[data-plugin-store="off"]')
    expect(off, '应该显示「这个版本没有配置游戏商店」那一支').toBeTruthy()
    expect(off?.textContent ?? '').toMatch(/没有配置游戏商店/)

    // ★ 核心判据
    expect(document.querySelector('[data-plugin-check]'), '没配就别摆「检查」按钮').toBeNull()
    expect(document.querySelector('[data-plugin-install]'), '没配就更不该摆安装按钮').toBeNull()
  })

  it('家长闸门开着也**不会**冒出一个「点了必然失败」的按钮', () => {
    render(<PluginStoreCard gateOpen />)
    // 闸门是「能不能操作」的条件，不是「有没有得操作」的条件。
    // 这一条防的是「没配地址时给个 disabled 按钮占位」那种改法。
    //
    // ⚠️ 2026-10-22 起「一个按钮都没有」不再成立：**本地包**（随 App 发布）
    //    不需要托管地址也不需要网络，装它是真的会成功 —— 它不属于
    //    「界面承诺了做不到的事」。所以判据改成更准的那一条：
    //    **页面上所有按钮都必须是本地安装按钮**，远程那一栏仍然一个都不许有。
    expect(document.querySelector('[data-plugin-check]'), '没配就别摆「检查」按钮').toBeNull()
    expect(document.querySelector('[data-plugin-install]'), '没配就更不该摆远程安装按钮').toBeNull()
    expect(document.querySelectorAll('button')).toHaveLength(
      document.querySelectorAll('[data-local-install]').length,
    )
  })
})
