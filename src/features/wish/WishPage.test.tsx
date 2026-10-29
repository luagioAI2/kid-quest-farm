import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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

describe('心愿商城：兑换记录', () => {
  /* `done` / `cancelled` 的单子在别处**看不见** —— 卡片只显示还没走完的，
     待办入口只算 committed/confirmed。没有这一屏，孩子换到手的东西过一天
     就彻底消失，连「我到底换过没有」都查不到。 */
  it('没有单子时是空态，不摆一堆空白', async () => {
    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: '兑换记录' }))
    expect(await screen.findByText('还没有换过东西')).toBeTruthy()
  })

  it('换到手的、被取消的都能查到，状态写中文', async () => {
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_done',
        itemName: '收租公寓',
        itemEmoji: '🏢',
        kind: 'gamebox',
        status: 'done',
        doneAt: Date.now(),
        openedGameId: 'renttower',
        createdAt: Date.now() - 60_000,
      }) as never,
    )
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_cancel',
        itemId: 'wish-popmart',
        itemName: '泡泡玛特盲盒',
        itemEmoji: '🧸',
        kind: 'collectible',
        status: 'cancelled',
        cancelledAt: Date.now(),
        createdAt: Date.now() - 120_000,
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: '兑换记录' }))

    expect(await screen.findByText('收租公寓')).toBeTruthy()
    expect(screen.getByText('泡泡玛特盲盒')).toBeTruthy()
    // 状态文案来自 `WISH_STATUS_TEXT`（这个常量之前一直是死代码）
    expect(screen.getByText('已经拿到')).toBeTruthy()
    expect(screen.getByText('已取消')).toBeTruthy()
    // 已交付的数字商品要标出来，不然「已拿到」和「游戏在哪」是两回事
    expect(screen.getByText(/已放进游戏柜/)).toBeTruthy()
  })

  it('未收尾的数字单子写「已放进游戏柜」，不写「等爸妈确认」', async () => {
    // 同一单在两屏里说两种话是最容易犯的错：详情页/卡片已经改成
    // 「已放进游戏柜」，记录页照抄状态字典就会又冒出「等爸妈确认」。
    await db.wishOrders.put(committedOrder({ openedGameId: 'renttower' }) as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: '兑换记录' }))

    expect(await screen.findByText('已放进游戏柜')).toBeTruthy()
    expect(screen.queryByText('等爸妈确认')).toBeNull()
  })

  it('点一条记录能回到那件商品', async () => {
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_done',
        itemId: 'wish-game-renttower',
        itemName: '收租公寓',
        itemEmoji: '🏢',
        kind: 'gamebox',
        status: 'done',
        doneAt: Date.now(),
        openedGameId: 'renttower',
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: '兑换记录' }))
    await user.click(await screen.findByText('收租公寓'))
    // 详情页：这个游戏已经有了
    expect(await screen.findByText('这个游戏你已经有了')).toBeTruthy()
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

/* ============================================================
   孩子说了「想要」，家长那边要看得见（2026-10-29）
   ------------------------------------------------------------
   家长原话：「现在心愿商城里 已告诉爸爸妈妈，爸爸妈妈如何处理。」

   改动之前：孩子点完「🤍 想要这个」，他那一侧写着「已经告诉爸妈，等他们定价」，
   而家长那一侧**一片安静** —— 待办卡只收 `committed` / `confirmed`
   （券已经扣了的单子），`wished` 不在里面。家长要逐个商品点开才可能发现有请求。

   这三条钉的是：**看得见 → 有入口 → 有出口**。
   ============================================================ */
const wishedOrder = (patch: Record<string, unknown>) => ({
  id: 'wo_wish',
  itemId: 'wish-blindbox',
  itemName: '游戏盲盒',
  itemEmoji: '🎁',
  kind: 'blindbox' as const,
  voucherPrice: 0,
  status: 'wished' as const,
  vouchersHeld: 0,
  createdAt: Date.now(),
  ...patch,
})

describe('心愿：家长怎么处理「已告诉爸爸妈妈」', () => {
  it('★ 列表顶部出现「有 N 个心愿等你回应」', async () => {
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    render(<WishPage />)
    expect(await screen.findByText(/有 1 个心愿等你回应/)).toBeTruthy()
  })

  it('★ 家长锁开着时：详情里先是一道入口，不是直接给按钮', async () => {
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByText(/有 1 个心愿等你回应/))

    expect(await screen.findByText(/爸妈：回应这个心愿/)).toBeTruthy()
    expect(
      screen.queryByText('这次先不换'),
      '没过密码不该看到回绝按钮 —— 否则孩子能自己把心愿撤掉',
    ).toBeNull()
  })

  it('★ 没有家长锁时：两个动作都在，回绝之后单子真的结束', async () => {
    await useApp.getState().updateSettings({ parentPin: undefined })
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByText(/有 1 个心愿等你回应/))

    expect(await screen.findByText(/定个价/)).toBeTruthy()
    await user.click(screen.getByText('这次先不换'))

    await waitFor(async () => {
      const row = await db.wishOrders.get('wo_wish')
      expect(row?.status, '回绝之后不能还停在 wished').toBe('cancelled')
      expect(row?.cancelReason).toContain('先不换')
    })
  })
})
