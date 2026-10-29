import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { RedeemBody } from './RedeemSheet'

/* ============================================================
   兑换列表里的「爸妈已开放的心愿」（2026-10-29）
   ------------------------------------------------------------
   家长原话：「爸爸妈妈已经定好价格的，相当于添加了兑换，应该出现在
   兑换列表里。」

   所以 **定价 = 上架**：家长在 👀 里给一件心愿商品定完价，孩子切到
   「兑换」这一格就该看到它，不用特意跑去「心愿」那一格才发现有东西能换。

   ⚠️ 这一块**不在这里扣币**。心愿商城那边还有一整套流程（装包 / 开盲盒 /
      家长确认 / 退券），在这里再实现一遍扣款等于把两条链路各写一次 ——
      迟早有一处漏掉「已拥有」「池子空了」这类闸门，然后孩子被扣两次。
      点一下只是切到心愿那一格并打开那件商品（`jumpToWish`）。
   ============================================================ */

beforeEach(async () => {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
})

/* 标题带 🛍️ 前缀，按整串匹配会漏 —— 用正则锚在文字上 */
const SHELF_RE = /心愿商城 · 爸妈开放了/

describe('兑换列表：爸妈已经定好价的心愿', () => {
  it('★ 定价之后出现在「能换什么」里', async () => {
    await db.wishOffers.put({
      itemId: 'wish-blindbox',
      voucherPrice: 20,
      openedAt: Date.now(),
    } as never)
    await useApp.getState().refresh()

    render(<RedeemBody />)

    expect(await screen.findByText(SHELF_RE), '定完价就该出现在这里').toBeTruthy()
    expect(screen.getByText('游戏盲盒')).toBeTruthy()
  })

  it('对照组：没定价的心愿不出现（那是「等爸妈回应」）', async () => {
    render(<RedeemBody />)
    // 等首屏渲染完再断言「没有」，否则断言的是「还没渲染」
    await screen.findByRole('button', { name: /能换什么/ })
    expect(screen.queryByText(SHELF_RE)).toBeNull()
  })

  it('★ 点一下切到心愿那一格，并打开那件商品', async () => {
    await db.wishOffers.put({
      itemId: 'wish-blindbox',
      voucherPrice: 20,
      openedAt: Date.now(),
    } as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<RedeemBody />)
    await user.click(await screen.findByText('游戏盲盒'))

    // 跨页通道：`tab` 状态在 App 里，兑换页够不着 —— 只能走 store
    expect(useApp.getState().pendingWishItem, '要能带着「哪一件」过去').toBe('wish-blindbox')
  })

  it('已经拥有的游戏盒子不列出来', async () => {
    // 这条规则和心愿页共用 `wishOwnedSet` —— 各写一遍的话，
    // 一边滤掉了另一边没滤，孩子会在兑换列表里看到自己早就换到的游戏。
    await db.wishOrders.put({
      id: 'wo_owned',
      itemId: 'wish-game-renttower',
      itemName: '收租公寓',
      itemEmoji: '🏢',
      kind: 'gamebox',
      voucherPrice: 30,
      status: 'done',
      vouchersHeld: 30,
      openedGameId: 'renttower',
      createdAt: Date.now(),
      doneAt: Date.now(),
    } as never)
    await db.wishOffers.put({
      itemId: 'wish-game-renttower',
      voucherPrice: 30,
      openedAt: Date.now(),
    } as never)
    await useApp.getState().refresh()

    render(<RedeemBody />)
    await screen.findByRole('button', { name: /能换什么/ })
    expect(screen.queryByText('收租公寓'), '已经换到的游戏不该再出现').toBeNull()
    expect(screen.queryByText(SHELF_RE), '唯一一件被滤掉，整块就不该摆').toBeNull()
  })

  it('已经关掉的心愿也不出现', async () => {
    // 家长「关闭」写的是 `closedAt`，行还在 —— 只按「有没有这一行」算的话，
    // 关掉的商品会一直挂在孩子的兑换列表上。
    await db.wishOffers.put({
      itemId: 'wish-blindbox',
      voucherPrice: 20,
      openedAt: Date.now() - 1000,
      closedAt: Date.now(),
    } as never)
    await useApp.getState().refresh()

    render(<RedeemBody />)
    await screen.findByRole('button', { name: /能换什么/ })
    expect(screen.queryByText(SHELF_RE)).toBeNull()
  })
})
