import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, postHarvest } from '@/db/db'
import { useApp } from '@/store/useApp'
import { RedeemBody } from './RedeemSheet'

/* ============================================================
   爸妈定好价的心愿 = 普通的兑换品（2026-10-29，第二轮）
   ------------------------------------------------------------
   家长原话：
     「爸爸妈妈已经定好价格的，相当于添加了兑换，应该出现在兑换列表里。」
     「兑换 里的东西都是一样，都能用兑换券或者积分，包括游戏也一样。
      不需要去心愿商城换。心愿商城只是标明心愿的。」

   第一版把这条读成了「在兑换里摆一块心愿货架、点一下跳到心愿页去换」，
   家长当场否掉 —— 那等于在兑换里开一道门，通往**另一个收银台**。

   所以这里守的三件事：
     ① **同一张表**：心愿商品和家里的兑换品排在同一个列表里（分类 `gift`），
        没有「🛍️ 心愿商城 · 爸妈开放了」这一块；
     ② **同一套付款**：`planRedeemPayment`（券优先、1:1、可混付），
        按钮上写的分摊 = 实际扣的；
     ③ **就地成交**：点「换这个」→「换！」就在这一行扣币、生成订单，
        `pendingRedeemItem` 那条通道只负责「从心愿页跳过来时滚到这一行」。
   ============================================================ */

beforeEach(async () => {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
  // store 是模块级单例，上一个用例留下的跳转通道会漏到这里来
  useApp.setState({ pendingRedeemItem: null })
})

/** 首屏渲染完的判据。断言「没有」之前必须等它，否则断言的是「还没渲染」 */
const ready = () => screen.findByRole('button', { name: /能换什么/ })

/** 发兑换券。走账本而不是直接改 `harvestBalance` —— 余额是 Σ delta 派生的 */
async function giveVouchers(n: number) {
  await postHarvest({ delta: n, source: 'manual_adjust', memo: 'test' })
  await useApp.getState().refresh()
}

/** 家长定价。`closed` 模拟「家长关掉了兑换」 */
async function priceItem(itemId: string, voucherPrice: number, closed = false) {
  await db.wishOffers.put({
    itemId,
    voucherPrice,
    openedAt: Date.now(),
    ...(closed ? { closedAt: Date.now() } : {}),
  })
  await useApp.getState().refresh()
}

/** 按商品 id 找到列表里那一行 —— 家里也有好几件叫「🎁 换这个」的，必须限定在行内 */
function shopRow(itemId: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-shop-row="${itemId}"]`)
  if (!el) throw new Error(`兑换列表里没有 ${itemId} 这一行`)
  return el
}

describe('兑换列表：爸妈定好价的心愿', () => {
  it('★ 定价之后就是普通一行，没有「心愿商城」那一块', async () => {
    await priceItem('wish-popmart', 30)

    render(<RedeemBody />)
    await ready()

    const row = shopRow('wish-popmart')
    expect(within(row).getByText('泡泡玛特盲盒')).toBeTruthy()
    // 家长反对的就是这个标题 —— 它意味着「兑换里还有另一个入口」
    expect(screen.queryByText(/心愿商城 · 爸妈开放了/), '不该再另起一块').toBeNull()
    // 也不该长得像「外面来的东西」：付款行和家里那几件一模一样
    expect(within(row).getByText(/付款：/)).toBeTruthy()
  })

  it('对照组：没定价的心愿不出现（那只是「想要」，不是能换）', async () => {
    render(<RedeemBody />)
    await ready()

    // 先确认列表真的渲染了，否则「没有」可能只是「整页空白」
    expect(screen.getAllByRole('button', { name: /换这个/ }).length).toBeGreaterThan(0)
    expect(screen.queryByText('泡泡玛特盲盒')).toBeNull()
  })

  it('★ 就地兑换：在这一行扣 30 张券，生成 committed 单子', async () => {
    await priceItem('wish-popmart', 30)
    await giveVouchers(50)

    const user = userEvent.setup()
    render(<RedeemBody />)
    await ready()

    const row = shopRow('wish-popmart')
    await user.click(within(row).getByRole('button', { name: /换这个/ }))
    // 二次确认：扣币不可逆，不能一点就没
    await user.click(within(row).getByRole('button', { name: /换！/ }))

    // 判据看**账本派生的余额**，不看按钮文案 —— 文案对了而没扣是经典静默失败
    await waitFor(() => expect(useApp.getState().harvestBalance).toBe(20))
    expect(useApp.getState().balance, '券够的时候不该动积分').toBe(50)

    const order = await db.wishOrders.where('itemId').equals('wish-popmart').first()
    expect(order?.status).toBe('committed')
    expect(order?.vouchersHeld).toBe(30)
    expect(order?.pointsHeld).toBe(0)

    const spent = await db.harvestLedger.where('source').equals('wish_redeem').toArray()
    expect(spent.map((r) => r.delta), '券账上要有一笔 -30').toEqual([-30])
  })

  it('★ 券不够时用积分补，按钮写的是「两种币加起来还差多少」', async () => {
    // 启动积分 50 + 券 10 = 60，标价 300 → 差 240
    await priceItem('wish-popmart', 300)
    await giveVouchers(10)

    render(<RedeemBody />)
    await ready()

    const row = shopRow('wish-popmart')
    const btn = within(row).getByRole('button', { name: /还差 240/ }) as HTMLButtonElement
    expect(btn.disabled, '不够就不该能点').toBe(true)
    // 只报积分会让孩子以为「我只有 50 分」，而他兜里还有 10 张券
    expect(within(row).getByText(/两种币加起来还差 240/)).toBeTruthy()
  })

  it('已经拥有的游戏盒子不列出来', async () => {
    // 这条规则和心愿页共用 `wishOwnedSet` —— 各写一遍的话，
    // 一边滤掉了另一边没滤，孩子会在这里看到自己早就换到的游戏。
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
    })
    await priceItem('wish-game-renttower', 30)

    render(<RedeemBody />)
    await ready()

    expect(screen.queryByText('收租公寓'), '已经换到的游戏不该再出现').toBeNull()
    expect(document.querySelector('[data-shop-row="wish-game-renttower"]')).toBeNull()
  })

  it('已经关掉的心愿也不出现', async () => {
    // 家长「关闭」写的是 `closedAt`，行还在 —— 只按「有没有这一行」算的话，
    // 关掉的商品会一直挂在孩子的兑换列表上。
    await priceItem('wish-popmart', 30, true)

    render(<RedeemBody />)
    await ready()

    expect(screen.queryByText('泡泡玛特盲盒')).toBeNull()
  })

  it('★ 从心愿页「去兑换换」过来：滚到那一行、闪一下，通道取走就清空', async () => {
    await priceItem('wish-popmart', 30)

    // 跨页通道：`tab` 状态在 App 里，心愿页够不着 —— 只能走 store
    useApp.getState().jumpToRedeem('wish-popmart')

    render(<RedeemBody />)

    // 取走要清空：不清的话，孩子切走再切回兑换会被反复滚到同一行
    await waitFor(() => expect(useApp.getState().pendingRedeemItem).toBeNull())
    const row = shopRow('wish-popmart')
    expect(row.className, '得让孩子看见是哪一行').toMatch(/ring-grass-400/)
  })
})

/* ============================================================
   兑换记录 = 两张表合一条时间线（2026-10-29）
   ------------------------------------------------------------
   家长原话：「孩子刚兑换了一个游戏，为啥我兑换记录里看不到。」
   原因是家里那几件写 `redeemRecords`、游戏写 `wishOrders`，而记录页
   只读前者 —— 券扣了、游戏装上了、记录里一个字都没有，界面上零异常。
   ============================================================ */

describe('兑换记录：兑换里换的都要看得见', () => {
  it('★ 就地换完，切到「兑换记录」能看到这一单和扣了多少', async () => {
    await priceItem('wish-popmart', 30)
    await giveVouchers(50)

    const user = userEvent.setup()
    render(<RedeemBody />)
    await ready()

    const row = shopRow('wish-popmart')
    await user.click(within(row).getByRole('button', { name: /换这个/ }))
    await user.click(within(row).getByRole('button', { name: /换！/ }))
    await waitFor(() => expect(useApp.getState().harvestBalance).toBe(20))

    await user.click(screen.getByRole('button', { name: /兑换记录/ }))

    const rec = document.querySelector<HTMLElement>('[data-redeem-record]')
    expect(rec, '刚换完就该在记录里').toBeTruthy()
    expect(rec?.textContent).toContain('泡泡玛特盲盒')
    // 扣了多少必须写出来 —— 只说「换过」的话，家长对不上账
    expect(rec?.textContent).toContain('-30 兑换券')
  })

  it('★ 换到的游戏：记录里在，兑换列表里不再出现（一次性）', async () => {
    // 家长要的两件事一起钉：① 记录里看得到 ② 兑换完就不在列表里
    await db.wishOrders.put({
      id: 'wo_game',
      itemId: 'wish-game-renttower',
      itemName: '收租公寓',
      itemEmoji: '🏢',
      kind: 'gamebox',
      voucherPrice: 30,
      status: 'committed',
      vouchersHeld: 30,
      pointsHeld: 0,
      openedGameId: 'renttower',
      createdAt: Date.now(),
      committedAt: Date.now(),
    })
    await priceItem('wish-game-renttower', 30)

    const user = userEvent.setup()
    render(<RedeemBody />)
    await ready()

    expect(
      document.querySelector('[data-shop-row="wish-game-renttower"]'),
      '换完的游戏不该再上架',
    ).toBeNull()

    await user.click(screen.getByRole('button', { name: /兑换记录/ }))
    const rec = document.querySelector<HTMLElement>('[data-redeem-record]')
    expect(rec?.textContent).toContain('收租公寓')
    // 数字商品已经交付，不能说「等爸妈确认」（孩子手里已经有这款游戏了）
    expect(rec?.textContent).toContain('已放进游戏柜')
  })
})
