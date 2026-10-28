import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import WishPage from './WishPage'

/* ============================================================
   心愿商城 —— **数字商品兑换之后**这一屏
   ------------------------------------------------------------
   为什么单独钉这一条：数字商品（盲盒 / 盒子）在「兑换」那一刻就交付
   （当场开箱 / 当场装包），而实物要等爸妈去淘宝买。两者共用
   `committed` 这个状态，所以界面文案必须按 `openedGameId` 分叉。

   分叉写错的表现**不是报错**，是自相矛盾：
     · 孩子刚开完箱、游戏已经能玩，卡片上却挂着「等爸妈确认」；
     · 点进详情先撞一道家长密码「确认兑换需要密码」，
       底下那颗按钮写着「去购买」—— 可游戏已经在柜子里了。

   2026-10-28 走查（`scripts/_wish-digital-probe.mjs` + 截图）抓到的就是这组。
   结构断言、类型检查、单测全绿，因为**每一句文案单独看都合法**。
   ============================================================ */

const committedOrder = (patch: Record<string, unknown>) => ({
  id: 'wo_box',
  itemId: 'wish-blindbox',
  itemName: '游戏盲盒',
  itemEmoji: '🎁',
  kind: 'blindbox' as const,
  voucherPrice: 20,
  status: 'committed' as const,
  vouchersHeld: 20,
  createdAt: Date.now(),
  committedAt: Date.now(),
  ...patch,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
})

describe('心愿商城：数字商品兑换之后', () => {
  it('列表卡片写「已放进游戏柜」，不写「等爸妈确认」', async () => {
    // 两条渲染分支都要钉：
    //  · 盲盒 hero（`BlindBoxHero`）—— 兑换后还挂着「等爸妈确认」的就是它；
    //  · 游戏盒子卡片（`ItemCard`）—— 它走的是 `alreadyOwned` 那条，
    //    写「已经有了」。这两句都对，但都不许是「等爸妈确认」。
    await db.wishOrders.put(committedOrder({ openedGameId: 'renttower' }) as never)
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_game',
        itemId: 'wish-game-renttower',
        itemName: '收租公寓',
        itemEmoji: '🏢',
        kind: 'gamebox',
        openedGameId: 'renttower',
      }) as never,
    )
    await useApp.getState().refresh()

    render(<WishPage />)
    expect(await screen.findByText('已放进游戏柜'), '盲盒 hero 的说法').toBeTruthy()
    expect(screen.getByText('已经有了'), '盒子卡片走 alreadyOwned 那条').toBeTruthy()
    expect(
      screen.queryByText('等爸妈确认'),
      '孩子已经拿到游戏了，「等爸妈确认」是在描述一个不存在的步骤',
    ).toBeNull()
  })

  it('详情页的主内容是「已经拿到」，不是一道家长密码闸门', async () => {
    await db.wishOrders.put(committedOrder({ openedGameId: 'renttower' }) as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: /游戏盲盒/ }))

    expect(await screen.findByText(/已经放进你的游戏柜了/)).toBeTruthy()
    /* 默认设置里家长锁是开着的（`parentPin: '0000'`）。
       数字商品这里**不该**先摆闸门 —— 主内容是交付成功，
       家长那一侧只留一个入口，点了才展开。 */
    expect(
      screen.queryByText('请爸爸妈妈来一下'),
      '数字商品不该把密码闸门当主内容',
    ).toBeNull()
    expect(screen.getByText(/完成这一单/), '家长收尾的入口还在').toBeTruthy()
    expect(
      screen.queryByText(/去购买/),
      '游戏已经在柜子里了，没有「去买」这一步',
    ).toBeNull()
  })

  it('实物订单照旧：先过密码，再去外链买', async () => {
    // 对照组。改数字商品那条分支时最容易顺手把实物也改掉 ——
    // 实物**必须**保留闸门（家长要去淘宝花钱），这条钉住它。
    await useApp.getState().updateSettings({ parentPin: undefined })
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_toy',
        itemId: 'wish-popmart',
        itemName: '泡泡玛特盲盒',
        itemEmoji: '🧸',
        kind: 'collectible',
        status: 'committed',
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: /泡泡玛特/ }))

    expect(await screen.findByText(/确认兑换 · 去购买/)).toBeTruthy()
    expect(screen.queryByText(/已经放进你的游戏柜了/)).toBeNull()
  })
})
