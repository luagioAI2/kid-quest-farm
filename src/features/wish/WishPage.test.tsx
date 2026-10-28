import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { STOREFRONT } from '@/games/storefront'
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

describe('心愿商城：单个游戏就是那个游戏', () => {
  /* 「一个游戏」不该被当成「盒子里的一张卡」：家长要判断值不值得让孩子
     攒券换，靠的是截图和玩法说明。2026-10-28 用户原话：
     「单个游戏就是游戏 不是盲盒」「点游戏的时候，也要展示类似设置里
     游戏/详情页的东西」。 */
  const GAME = STOREFRONT.find((s) => s.shots.length > 0)!

  it('分类叫「游戏」，不叫「盒子」', async () => {
    render(<WishPage />)
    expect(await screen.findByRole('button', { name: '游戏' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '盒子' })).toBeNull()
  })

  it('点进游戏能看到截图 / 练什么 / 关于，截图还能点开', async () => {
    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: new RegExp(GAME.name) }))

    expect(await screen.findByText('截图')).toBeTruthy()
    expect(screen.getByText('练什么')).toBeTruthy()
    expect(screen.getByText('关于这款游戏')).toBeTruthy()
    expect(screen.getByText(GAME.shots[0].caption), '截图得真的有').toBeTruthy()
    expect(screen.getByText(GAME.learn[0]), '练什么得是这款游戏自己的').toBeTruthy()

    // 点截图 → 放大层（Portal 到 body，aria-label 是「关闭大图」）
    await user.click(screen.getByText(GAME.shots[0].caption))
    expect(await screen.findByLabelText('关闭大图')).toBeTruthy()
  })
})

describe('心愿商城：待家长处理的入口', () => {
  /* 孩子换了东西之后，家长那边**没有任何提示** —— 只能逐个商品点开、
     看卡片上的标记。列表顶部这一条是整条链路里「现在该谁动手」的唯一答案。 */
  it('有待处理单子时，列表顶部写出几单、是什么', async () => {
    await db.wishOrders.put(committedOrder({ openedGameId: 'renttower' }) as never)
    await useApp.getState().refresh()

    render(<WishPage />)
    expect(await screen.findByText(/有 1 单在等爸妈处理/)).toBeTruthy()
    expect(screen.getByText(/已放进游戏柜，等爸妈收尾/)).toBeTruthy()
  })

  it('实物单子说的是「等爸妈去商店买」', async () => {
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

    render(<WishPage />)
    expect(await screen.findByText(/等爸妈去商店买/)).toBeTruthy()
  })

  it('单子处理完，入口就消失', async () => {
    await db.wishOrders.put(
      committedOrder({ openedGameId: 'renttower', status: 'done', doneAt: Date.now() }) as never,
    )
    await useApp.getState().refresh()

    render(<WishPage />)
    await screen.findByText('心愿商城')
    expect(screen.queryByText(/在等爸妈处理/), '没有待办就不该摆这一条').toBeNull()
  })

  it('★ 点它只进详情，**不能**直连确认页（否则绕开家长密码）', async () => {
    // 确认页上有「取消兑换」和「去商店购买」，而密码闸门只渲染在详情页底部。
    // 这条入口如果直接跳确认页，孩子就能绕过家长密码去取消/外链 ——
    // 2026-10-28 已经在详情页右上角那个「确认兑换」入口上踩过一次。
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
    await user.click(await screen.findByText(/有 1 单在等爸妈处理/))

    // 详情页：先撞家长密码（默认 pin = 0000）
    expect(await screen.findByText('请爸爸妈妈来一下')).toBeTruthy()
    expect(screen.queryByText('取消兑换'), '确认页的按钮不许在这里出现').toBeNull()
  })
})
