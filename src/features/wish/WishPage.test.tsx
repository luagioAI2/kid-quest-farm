import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, postHarvest, saveWishBuyLinks } from '@/db/db'
import { useApp } from '@/store/useApp'
import { STOREFRONT } from '@/games/storefront'
import WishPage from './WishPage'

/* ⚠️ 找「单开盲盒」那个 hero 按钮时**不能**按 `/游戏盲盒/` 找：
   目录里现在有两款盲盒（单开 / 5 连开），正则会把两个按钮都命中，
   症状是 `Found multiple elements` —— 而报错指向的是「点了没反应」，
   很容易被当成渲染坏了。用单开那条 note 定位，它只出现在 hero 上。 */

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
  /* 跨页通道是全局 state：上一条用例点过「去设置看看」会留着，
     不清的话下一条读到的就是上一条的残留。 */
  useApp.setState({ pendingSettingsTab: null })
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
    /* 2026-11-08 改口：已拥有的游戏盒子**照样列出来**，标「已拥有」
       （家长：「心愿可以显示 已拥有」）。2026-10-29 那一版是整张藏掉。 */
    expect(screen.getByText('收租公寓'), '已经拥有的也要显示').toBeTruthy()
    expect(screen.queryByText(/款游戏你已经换到了/), '不再藏了，也就没有这句补丁').toBeNull()
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
    await user.click(await screen.findByRole('button', { name: /随机开出 1 款/ }))

    expect(await screen.findByText(/已经放进你的游戏柜了/)).toBeTruthy()
    /* 默认设置里家长锁是开着的（保护默认开）。
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
    await useApp.getState().updateSettings({ protectParentActions: false })
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

/* ============================================================
   孩子说了「想要」，家长那边要看得见（2026-10-29）
   ------------------------------------------------------------
   家长原话：「现在心愿商城里 已告诉爸爸妈妈，爸爸妈妈如何处理。」

   两轮之后，这一页上**跟家长有关的东西全撤了**：
     ① 第一轮撤掉「有 N 个心愿等你回应」那张卡 —— 家长原话：
        「出现在上边栏的眼睛那，**而不是在心愿商城这里**」；
     ② 第二轮（同一天）连「有 N 单在等爸妈处理」和「我许的愿」入口一起撤 ——
        「不需要在心愿商城显示兑换记录和有一单在等爸妈处理」。
        记录归「兑换」那一格（`redeemHistory` 把两张表合了一条时间线）。

   这里钉的是撤掉之后**还剩什么**：
     · 家长的两个入口都不在这一页了（不能又长回来）；
     · 孩子自己那一侧仍然看得见「已向爸妈申请」；
     · 详情页底部的「先不要了 / 回应这个心愿」还在 —— 而且撤回**不进**家长锁。
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
  it('★ 家长待办卡**不在**心愿页了（已移到顶栏 👀）', async () => {
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    render(<WishPage />)
    await screen.findByText('心愿商城')
    expect(
      screen.queryByText(/心愿等你回应/),
      '两个入口并存的话，家长会分不清该点哪个 —— 家长明确要求只在 👀 里处理',
    ).toBeNull()
  })

  it('孩子那一侧仍然写着「已向爸妈申请」', async () => {
    // 撤卡撤的是**家长**的入口，不能顺手把孩子唯一的反馈也撤掉 ——
    // 他点完「我想要」之后，至少要知道这件事已经传达出去了。
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    render(<WishPage />)
    expect(await screen.findByText('已向爸妈申请')).toBeTruthy()
  })

  it('★ 家长锁开着时：「定价」进闸门，但「先不要了」不进', async () => {
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: /随机开出 1 款/ }))

    expect(await screen.findByText(/爸妈：回应这个心愿/)).toBeTruthy()
    expect(screen.queryByText(/定个价/), '定价要过密码').toBeNull()
    /* 撤回**不进闸门**：撤的是孩子自己表的态，不花钱、不碰账本。
       放进闸门里的话，家长锁一开，孩子后悔了只能干等 ——
       而家长那边根本不知道有个作废的请求还挂着。 */
    expect(screen.getByText('先不要了'), '撤回不该被家长锁挡住').toBeTruthy()
  })

  it('★ 没有家长锁时：两个动作都在，回绝之后单子真的结束', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: /随机开出 1 款/ }))

    expect(await screen.findByText(/定个价/)).toBeTruthy()
    await user.click(screen.getByText('先不要了'))

    /* ⚠️ 同一条坑（见下面「可兑换 / 一次性兑换」那块）：`user.click` 只等到
       事件派发，「先不要了」的 async 处理函数还在写库 + `refresh()`。
       拿库行当判据会在写库一落地就通过，剩下的 `refresh()` 被下一条用例的
       `db.delete()` 掀翻 —— 症状是「全绿 + 一条 DatabaseClosedError」。 */
    await waitFor(() => {
      const row = useApp.getState().wishOrders.find((o) => o.id === 'wo_wish')
      expect(row?.status, '回绝之后不能还停在 wished').toBe('cancelled')
      expect(row?.cancelReason).toContain('先不换')
    })
    expect((await db.wishOrders.get('wo_wish'))?.cancelReason).toContain('先不换')
  })

  it('★ 被回绝过之后，详情里还看得见上次的理由', async () => {
    // 没有这一句的话，孩子看到的是一个干干净净的「🤍 我想要」——
    // 他会以为自己没说过，家长那边则会收到同一个请求第二遍。
    await useApp.getState().updateSettings({ protectParentActions: false })
    await db.wishOrders.put(
      wishedOrder({
        status: 'cancelled',
        cancelledAt: Date.now(),
        cancelReason: '这次先不换',
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: /随机开出 1 款/ }))

    expect(await screen.findByText(/上次爸妈说/)).toBeTruthy()
    expect(screen.getByText('🤍 我想要'), '仍然允许再点一次，不加冷却').toBeTruthy()
  })
})

/* ============================================================
   已经换到的游戏不再列出来（2026-10-29）
   ------------------------------------------------------------
   家长原话：「兑换的东西有比如游戏，兑换了就有了，不需要再兑换，
   不需要显示在能换什么。」

   改动之前：那张卡还在，只是标签变成「已经有了」—— 换不了、也没有任何
   可做的动作，纯粹占位置。孩子翻十几次都是同一堆自己已经有的东西。

   ⚠️ 只藏**游戏盒子**，不藏盲盒：盲盒不是「拥有」，是「开完了」，
      它上面那句「这些游戏你都有啦」本身是信息。
   ============================================================ */
describe('心愿商城：已经拥有的游戏照样列出来，只是标「已拥有」', () => {
  it('★ 拥有之后那张卡还在，角标和按钮都是「已拥有」、按钮点不动', async () => {
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_owned',
        itemId: 'wish-game-renttower',
        itemName: '收租公寓',
        itemEmoji: '🏢',
        kind: 'gamebox',
        openedGameId: 'renttower',
      }) as never,
    )
    await useApp.getState().refresh()

    render(<WishPage />)
    await screen.findByText('心愿商城')

    const card = document.querySelector('[data-wish-id="wish-game-renttower"]') as HTMLElement
    expect(card, '已经拥有的游戏也要在列表里（2026-11-08 家长改口）').toBeTruthy()
    const btn = card.querySelector('[data-wish-action]') as HTMLButtonElement
    expect(btn.getAttribute('data-wish-action'), '状态是「已拥有」这一档').toBe('owned')
    expect(btn.textContent).toContain('已拥有')
    expect(btn.disabled, '已拥有就不能再点（点了也没得换）').toBe(true)
    // 都拥有了，再摆「去激活」就是在卖一件已经在柜子里的东西
    expect(card.querySelector('[data-wish-activate]')).toBeNull()
  })


  it('★ 已拥有的详情里不摆「定价」（定了也永远换不了）', async () => {
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_owned2',
        itemId: 'wish-game-renttower',
        itemName: '收租公寓',
        itemEmoji: '🏢',
        kind: 'gamebox',
        openedGameId: 'renttower',
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await screen.findByText('心愿商城')
    const card = document.querySelector('[data-wish-id="wish-game-renttower"]') as HTMLElement
    await user.click(card.querySelector('button') as HTMLElement)

    /* 这一单是「兑换到手」的，详情走「已经放进你的游戏柜了」那条分支；
       激活码 / 后台授予来的没有单子，才走「这个游戏你已经有了」。 */
    expect(await screen.findByText(/已经放进你的游戏柜了/)).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: '定价' }),
      '已经拥有的商品不该再摆定价 —— 卡片永远写着「已拥有」，那个价换不了',
    ).toBeNull()
  })

  it('对照组：没拥有的照旧是「我想要」', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')
    const card = document.querySelector('[data-wish-id="wish-game-renttower"]') as HTMLElement
    expect(card.querySelector('[data-wish-action]')?.getAttribute('data-wish-action')).toBe('want')
  })
})

/* ============================================================
   2026-10-29 撤掉的两块 —— 别加回来
   ------------------------------------------------------------
   用户原话：「不需要在心愿商城显示兑换记录和有一单在等爸妈处理。」
   这一页从此只剩两件事：**看**和**许愿**。
   ============================================================ */
describe('心愿商城：只剩「看」和「许愿」', () => {
  it('★ 顶部没有「我许的愿」入口（记录归「兑换」那一格）', async () => {
    // 留一个入口的话，同一批单子在两个「记录」里各显示一遍，
    // 而且两边的过滤规则还不一样（这边含 `wished`，那边不含）。
    await db.wishOrders.put(committedOrder({ openedGameId: 'renttower' }) as never)
    await useApp.getState().refresh()

    render(<WishPage />)
    await screen.findByText('心愿商城')
    expect(screen.queryByRole('button', { name: '我许的愿' })).toBeNull()
  })

  it('★ 没有「有 N 单在等爸妈处理」那张卡', async () => {
    await db.wishOrders.put(committedOrder({ openedGameId: 'renttower' }) as never)
    await useApp.getState().refresh()

    render(<WishPage />)
    await screen.findByText('心愿商城')
    expect(screen.queryByText(/在等爸妈处理/)).toBeNull()
    expect(screen.queryByText(/等爸妈收尾/)).toBeNull()
  })
})

/* ============================================================
   确认页的付款文案 —— 仍然只有一套说法
   ------------------------------------------------------------
   原来这条钉的是「我许的愿」那一屏；那一屏下线之后，`paidText` 的
   另一个读者是**家长确认页**（孩子已付 / 已扣除 / 会原样退回，三处）。
   文案必须还是 `describeRedeemPayment` 出的那一套：写「20 兑换券」，
   不写「🎫 20 张」—— 否则家长对账时要先在脑子里翻译一次。
   ============================================================ */
describe('心愿商城：确认页的付款文案和「兑换记录」同源', () => {
  const openConfirm = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(await screen.findByRole('button', { name: /泡泡玛特/ }))
    await user.click(await screen.findByText(/确认兑换 · 去购买/))
  }

  it('★ 纯券单写「20 兑换券」，不写「🎫 20 张」', async () => {
    // 家长锁关掉，否则详情页先撞密码闸门（那条路径另有测试钉）
    await useApp.getState().updateSettings({ protectParentActions: false })
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_v',
        itemId: 'wish-popmart',
        itemName: '泡泡玛特盲盒',
        itemEmoji: '🧸',
        kind: 'collectible',
        vouchersHeld: 20,
        pointsHeld: 0,
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await openConfirm(user)

    expect(await screen.findByText(/孩子已付 20 兑换券/)).toBeTruthy()
    const body = document.body.textContent ?? ''
    expect(body, '三处（已付 / 已扣除 / 会退回）都得是同一套说法').not.toContain('🎫')
    expect(body, '别写量词「张」').not.toMatch(/\d+ 张/)
  })

  it('★ 混付单写「10 兑换券 + 10 积分」', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_m',
        itemId: 'wish-popmart',
        itemName: '泡泡玛特盲盒',
        itemEmoji: '🧸',
        kind: 'collectible',
        vouchersHeld: 10,
        pointsHeld: 10,
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<WishPage />)
    await openConfirm(user)

    expect(await screen.findByText(/孩子已付 10 兑换券 \+ 10 积分/)).toBeTruthy()
  })
})

/* ============================================================
   分类：收藏 → 其他，前面加美食 / 出行（2026-10-29）
   ============================================================ */
describe('心愿商城：分类', () => {
  it('★ 「收藏」改叫「其他」，美食 / 出行排在它前面', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')

    for (const label of ['盲盒', '游戏', '玩具', '学习', '美食', '出行', '其他']) {
      expect(screen.getByRole('button', { name: label }), `缺了「${label}」这一档`).toBeTruthy()
    }
    expect(screen.queryByRole('button', { name: '收藏' }), '旧名字还在').toBeNull()
  })

  it('★ 美食 / 出行里真的有东西（空分类按钮点了什么都没有）', async () => {
    const user = userEvent.setup()
    render(<WishPage />)
    await screen.findByText('心愿商城')

    await user.click(screen.getByRole('button', { name: '美食' }))
    expect(await screen.findByText('生日蛋糕')).toBeTruthy()

    await user.click(screen.getByRole('button', { name: '出行' }))
    expect(await screen.findByText('动物园一日游')).toBeTruthy()
  })
})

/* ============================================================
   游戏类商品：家长可以直接买卡、输激活码（2026-10-30）
   ------------------------------------------------------------
   家长原话：「在心愿商城 家长可以购买 打开购买链接（淘宝、天猫、京东等）……
   对于游戏，购买到的一般是游戏激活码，买到后就可以直接激活游戏。
   这时候心愿商城的游戏就会到设置/游戏里。」

   改动之前这一页**只有「定券价」**：想花钱买的家长无处可去
   （游戏类商品的 `buyUrl` 一个都没有），拿到卡也没有输码的地方，
   得自己摸到「设置 → 游戏 → 有兑换码」（那个入口 2026-11-07 已删，
   现在这里就是家长唯一的输码处）。所以两块都摆到家长眼前。

   ⚠️ 同时钉住一个容易写错的分叉：已交付的数字商品**不能**再说
   「去商店购买」—— 给游戏补上 `buyUrl` 之后，那句差点变成
   「游戏已经在孩子柜子里了，方式：去商店购买」。
   ============================================================ */
describe('心愿：游戏类商品能直接买卡 / 输激活码', () => {
  /**
   * 走到家长定价页。
   *
   * ⚠️ 必须先有「孩子想要」那张单：`定个价` 只在 `order.status === 'wished'`
   * 那一支里渲染（家长主动定价的入口在列表头上，不走这条路）。
   * 少了这一步，测试会停在商品详情页找不到按钮。
   */
  const openParentPricing = async (buyLink?: { url: string; label?: string }) => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    await db.wishOrders.put(
      wishedOrder({
        id: 'wo_game_wished',
        itemId: 'wish-game-renttower',
        itemName: '收租公寓',
        itemEmoji: '🏢',
        kind: 'gamebox',
      }) as never,
    )
    /* 外链是**后台配的**（第七轮）：不先写这一条，页面上就不该有购买按钮。
       走 `saveWishBuyLinks` + `refresh`，和生产链路（pull 写 meta → refresh 读）
       同一套，别直接 `setState` 绕过去。 */
    if (buyLink) await saveWishBuyLinks({ 'wish-game-renttower': buyLink })
    await useApp.getState().refresh()
    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: /收租公寓/ }))
    await user.click(await screen.findByText(/定个价/))
    return user
  }

  it('★ 后台配了链接：家长定价页才有「也可以直接买这一款」', async () => {
    await openParentPricing({ url: 'https://item.taobao.com/item.htm?id=9', label: '去淘宝买卡' })
    expect(await screen.findByText(/也可以直接买这一款/)).toBeTruthy()

    const buy = document.querySelector('[data-wish-buy-game]') as HTMLButtonElement | null
    expect(buy, '后台配了链接，家长却没有购买入口').toBeTruthy()
    /* 按钮文字用**后台那句**，不是写死的「去购买」 */
    expect(buy?.textContent).toContain('去淘宝买卡')
  })

  it('★ 后台没配链接：定价页不摆「去购买」', async () => {
    await openParentPricing()
    expect(await screen.findByText(/也可以直接买这一款/)).toBeTruthy()

    /* 用户原话：「根据后台礼品有没有配置链接，如果没有就不显示。」
       这是**反向**断言 —— 只写正向的话，淘宝搜索页兜底又长回来也照样全绿。 */
    expect(document.querySelector('[data-wish-buy-game]')).toBeNull()
  })

  it('★ 输码成功后：调的是 store 的兑换（不是本地解锁），并关掉面板', async () => {
    const redeemGameCode = vi.fn(async () => ({ ok: true, message: '已激活：收租公寓' }))
    useApp.setState({ redeemGameCode })

    const user = await openParentPricing()
    await user.click(document.querySelector('[data-code-open]') as HTMLElement)
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'abc-def')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    /* `{ silent: true }` —— 这一块自己弹框，别再让 store 飘一条 toast
       （同一句话说两遍，2026-10-30 恢复备份那里踩过）。 */
    expect(redeemGameCode).toHaveBeenCalledWith('abc-def', { silent: true })
    // 成功后面板关掉（回到商城列表），失败才留在原地显示原因
    await waitFor(() => expect(screen.queryByText(/也可以直接买这一款/)).toBeNull())
  })

  it('★ 失败时留在面板里，红字说清原因（码要能对着改一位）', async () => {
    const redeemGameCode = vi.fn(async () => ({
      ok: false,
      message: '这个兑换码已经用过了',
    }))
    useApp.setState({ redeemGameCode })

    const user = await openParentPricing()
    await user.click(document.querySelector('[data-code-open]') as HTMLElement)
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'ABC-DEG')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    const msg = document.querySelector('[data-code-msg]')
    await waitFor(() => expect(msg?.textContent).toContain('已经用过'))
    expect((document.querySelector('[data-code-input]') as HTMLInputElement).value).toBe('ABC-DEG')
  })
})

/* ============================================================
   卡片「去激活」弹框（2026-11-06）
   ------------------------------------------------------------
   用户原话：「礼品，游戏 和 盲盒 有去激活。点开 弹框有输入激活码，
   没有激活码可以点去购买。」「因为我想要、去激活 已经在礼品 item 有了，
   所以详情里不需要。」

   所以这一轮把输码口从**详情页**搬到**卡片弹框**：
     · 三种类型（实物 / 游戏 / 盲盒）卡片底部都有「🎟️ 去激活」；
     · 弹框里：游戏 / 盲盒有输码区，实物只有「去购买」；
     · 详情页**不再有**输码块 —— 同一件事两个入口，孩子还得先点进详情。

   钉六件事：
     ① 卡片上有「去激活」，详情页里**没有**输码块（反向断言）；
     ② 保护开着时先过家长密码，键盘不直接摆给孩子；
     ③ 成功 → 弹框里说「已经在我的游戏里」，不替孩子切当前；
     ④ 「去设置看看」/「知道了」两条出口；
     ⑤ 失败 → 红字 + 不清空；
     ⑥ 没有激活码时「去购买」是一颗真按钮，不是一句提示。
   ============================================================ */
describe('心愿：卡片「去激活」弹框', () => {
  /** 从列表里点开某件商品的「去激活」弹框 */
  const openActivate = async (name = '收租公寓') => {
    const user = userEvent.setup()
    render(<WishPage />)
    await screen.findByText('心愿商城')
    const card = [...document.querySelectorAll('[data-wish-card]')].find((c) =>
      (c.textContent ?? '').includes(name),
    ) as HTMLElement | undefined
    if (!card) throw new Error(`列表里找不到「${name}」`)
    await user.click(card.querySelector('[data-wish-activate]') as HTMLElement)
    return { user, card }
  }

  it('★ 卡片上有「去激活」；详情页里**没有**输码块', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    const { user, card } = await openActivate()

    expect(document.querySelector('[data-activate-dialog]'), '点了「去激活」没弹框').toBeTruthy()
    expect(document.querySelector('[data-code-input]'), '弹框里没有输码口').toBeTruthy()

    await user.click(document.querySelector('[data-activate-close]') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[data-activate-dialog]')).toBeNull())

    /* ★ 反向断言：用户明确说「去激活已经在礼品 item 有了，所以详情里不需要」。
       只写正向的话，两块都留着照样全绿 —— 而孩子会看到两个入口。 */
    await user.click(card.querySelector('button') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[data-wish-finish]')).toBeNull())
    expect(
      document.querySelector('[data-wish-code]'),
      '详情页还留着输码块 —— 用户要求删掉（去激活已在卡片上）',
    ).toBeNull()
  })

  /* 30s：2026-11-08 起心愿列表**不再过滤已拥有的**，一屏要多渲染 20 多张卡，
     并行跑（vitest 同时开 6 个 jsdom）时这两条十几下点击的用例会摸到 15s 的边。 */
  it('★ 保护开着：先要家长密码，输入框不摆给孩子', { timeout: 30000 }, async () => {
    await useApp.getState().updateSettings({ protectParentActions: true, parentPin: '1234' })
    await openActivate()

    expect(
      document.querySelector('[data-code-input]'),
      '没过闸门就出现输入框 —— 那道闸门是假的',
    ).toBeNull()
    /* ★ 2026-11-06 晚：锁定态**就是统一那个家长密码弹框**，不再自己出一张
       「🔒 请爸爸妈妈来一下 + 爸爸妈妈在淘宝……」的卡片（用户点名删掉）。
       判据必须分两半：统一弹框在、激活卡片**不在**。
       只写「标题出现」的话，两种长相都能过 —— 上一版就是这么漏的。 */
    expect(document.querySelector('[role="dialog"]'), '没弹统一的家长密码弹框').toBeTruthy()
    expect(
      document.querySelector('[data-activate-dialog]'),
      '锁定态还在出激活卡片 —— 应该由统一弹框顶替它',
    ).toBeNull()
    expect(screen.getByText('请爸爸妈妈来一下')).toBeTruthy()

    /* ★ 手滑点开要有退路。不给 `onCancel` 时 `PinFlow` 底下那颗
       「先算了」**根本不渲染** —— 只能答完数学题 + 设完密码才出得去。 */
    await userEvent.setup().click(screen.getByRole('button', { name: '先算了' }))
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    expect(
      document.querySelector('[data-activate-dialog]'),
      '取消之后又冒出激活卡片',
    ).toBeNull()
  })

  it('★ 成功：交给 store、留在弹框里说清「已经在我的游戏里」', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    const redeemGameCode = vi.fn(async () => {
      /* ★ 必须模拟真实实现的收尾：它成功后会 `refresh()`，
         `ownedGameIds` 立刻多这一款 ⇒ 列表里的游戏卡会被摘掉。
         弹框挂在页面层（`activateId`）就是为了这一刻不被连带卸载。 */
      useApp.setState({ ownedGameIds: [...useApp.getState().ownedGameIds, 'renttower'] })
      return { ok: true, message: '已激活：收租公寓' }
    })
    useApp.setState({ redeemGameCode })

    const { user } = await openActivate()
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'abc-def')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    // 界面不偷偷改大小写 / 不替用户去掉那一横 —— 归一化是 store 的事
    expect(redeemGameCode).toHaveBeenCalledWith('abc-def', { silent: true })

    await waitFor(() =>
      expect(document.querySelector('[data-code-done-dialog]'), '成功没弹框').toBeTruthy(),
    )
    expect(document.querySelector('[data-code-done]')?.textContent).toContain('设置 → 游戏')
    expect(screen.queryByRole('button', { name: /去玩|切过去|开始玩/ })).toBeNull()
  })

  it('★ 「去设置看看」把人送到设置的游戏栏', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    useApp.setState({
      redeemGameCode: vi.fn(async () => ({ ok: true, message: '已激活：收租公寓' })),
    })

    const { user } = await openActivate()
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'abc-def')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    await waitFor(() => expect(document.querySelector('[data-code-goto-settings]')).toBeTruthy())
    await user.click(document.querySelector('[data-code-goto-settings]') as HTMLElement)

    expect(useApp.getState().pendingSettingsTab).toBe('game')
    expect(document.querySelector('[data-code-done-dialog]'), '点了该关掉弹框').toBeNull()
  })

  it('★ 「知道了」只关框，不跳设置', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    useApp.setState({
      redeemGameCode: vi.fn(async () => ({ ok: true, message: '已激活：收租公寓' })),
    })

    const { user } = await openActivate()
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'abc-def')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    await waitFor(() => expect(document.querySelector('[data-code-done-close]')).toBeTruthy())
    await user.click(document.querySelector('[data-code-done-close]') as HTMLElement)

    expect(document.querySelector('[data-code-done-dialog]')).toBeNull()
    expect(useApp.getState().pendingSettingsTab, '「知道了」不该偷偷跳设置').toBeNull()
  })

  it('★ 失败：红字 + 不清空（要能对着卡片改一位）', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    useApp.setState({
      redeemGameCode: vi.fn(async () => ({ ok: false, message: '这个兑换码已经用过了' })),
    })

    const { user } = await openActivate()
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'ABC-DEG')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    const msg = document.querySelector('[data-code-msg]')
    await waitFor(() => expect(msg?.textContent).toContain('已经用过'))
    expect((document.querySelector('[data-code-input]') as HTMLInputElement).value).toBe('ABC-DEG')
  })

  it('★ 盲盒 hero 也能开弹框输码（手里有码不用再摸去设置）', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    const user = userEvent.setup()
    render(<WishPage />)
    await screen.findByText('心愿商城')

    const hero = document.querySelector('[data-wish-card="blindbox"]') as HTMLElement
    await user.click(hero.querySelector('[data-wish-activate]') as HTMLElement)
    expect(document.querySelector('[data-activate-dialog]')).toBeTruthy()
    expect(document.querySelector('[data-code-input]')).toBeTruthy()
    /* 「盲盒没有激活码」是上一版的说法，现在摆着只会误导。 */
    expect(screen.queryByText(/盲盒没有激活码/)).toBeNull()
  })

  it('★ 实物卡的弹框：没有输码区；后台配了链接才有一颗「去购买」', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    await saveWishBuyLinks({
      'wish-dino': { url: 'https://item.jd.com/100012043978.html', label: '去京东看看' },
    })
    await useApp.getState().refresh()
    const { user } = await openActivate('恐龙模型套装')

    expect(document.querySelector('[data-activate-dialog]')).toBeTruthy()
    /* 实物没有激活码 —— 摆一个必然失败的输入框就是挖坑（2026-11-06 定）。 */
    expect(document.querySelector('[data-code-input]')).toBeNull()

    const buy = document.querySelector('[data-activate-buy]') as HTMLElement | null
    expect(buy, '后台配了链接，弹框里却没有「去购买」').toBeTruthy()
    expect(buy?.textContent).toContain('去京东看看')

    await user.click(document.querySelector('[data-activate-close]') as HTMLElement)
  })

  it('★ 后台没配链接：实物卡弹框里不摆「去购买」', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    const { user } = await openActivate('恐龙模型套装')

    expect(document.querySelector('[data-activate-dialog]')).toBeTruthy()
    expect(document.querySelector('[data-code-input]')).toBeNull()
    /* 用户原话：「如果没有就不显示。」以前这里现拼一条淘宝搜索页，
       后台配没配都有一颗按钮 —— 这条反向断言钉住它别长回来。 */
    expect(document.querySelector('[data-activate-buy]')).toBeNull()
    /* 但弹框不能变成死胡同：得告诉孩子下一步点「我想要」 */
    expect(document.querySelector('[data-activate-guide]')?.textContent).toContain('我想要')

    await user.click(document.querySelector('[data-activate-close]') as HTMLElement)
  })

  it('★ 盲盒 hero：去激活 + 整块只剩「优先」是圆的', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')

    const hero = document.querySelector('[data-wish-card="blindbox"]') as HTMLElement
    expect(hero.querySelector('[data-wish-activate]'), '盲盒没有「去激活」').toBeTruthy()
    expect(hero.textContent ?? '').not.toMatch(/有码可输/)
    /* ★ 状态不再是一排小胶囊标签：整块 hero 只剩右上角「优先」是圆的
       （用户 2026-11-05：名字 / 类型 / 标签挤在一起很丑）。 */
    const pills = [...hero.querySelectorAll('[class*="rounded-full"]')]
    expect(
      pills.map((p) => p.textContent?.trim()),
      '小胶囊标签都换成普通文字行，只留右上角「优先」',
    ).toEqual(['优先'])
  })

  it('★ 每颗卡都是「去激活 + 状态」两颗按钮（混排不留白块）', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')

    const cards = [
      ...document.querySelectorAll('[data-wish-card][data-wish-kind]'),
    ] as HTMLElement[]
    expect(cards.length).toBeGreaterThan(5)
    for (const c of cards) {
      const head = (c.textContent ?? '').slice(0, 12)
      expect(c.querySelectorAll('[data-wish-activate]').length, `${head} 缺「去激活」`).toBe(1)
      expect(c.querySelectorAll('[data-wish-action]').length, `${head} 缺状态按钮`).toBe(1)
    }

    /* 实物那颗状态按钮写「我想要」，点它**不弹**激活框 */
    const toy = cards.find((c) => (c.textContent ?? '').includes('恐龙模型套装')) as HTMLElement
    const action = toy.querySelector('[data-wish-action]') as HTMLElement
    expect(action.textContent).toMatch(/我想要/)
    await userEvent.setup().click(action)
    expect(document.querySelector('[data-activate-dialog]'), '「我想要」不该弹激活框').toBeNull()
    /* ⚠️ 这一下点下去会异步写库 + `refresh()`。不等它落地就结束，下一条用例
       的 `db.delete()` 会掀翻还在读表的 refresh —— 症状是「全绿 + 一条
       DatabaseClosedError」（vitest 退 1）。判据用 **store** 里的订单
       （`refresh()` 末尾才赋值），不是库行：库行一 put 就通过，等于没等。 */
    await waitFor(() =>
      expect(useApp.getState().wishOrders.some((o) => o.itemId === 'wish-dino')).toBe(true),
    )
  })
})

/* ============================================================
   ★ 第四轮（2026-11-05）：撤掉「等定价」+ 卡片直接许愿
   ------------------------------------------------------------
   用户原话：「为啥会有一个 等妈妈定价。根本不需要吧。因为孩子表达心愿，
   家长审核时直接定价了。游戏 等爸妈定价感觉都不需要。ITEM UI 紧凑一些。
   可以来个我想要，去激活改成家长激活。」
   ============================================================ */
describe('心愿商城：第四轮卡片口径', () => {
  it('★ 列表里不再出现「等定价」那类话', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')
    expect(document.body.textContent ?? '').not.toMatch(/等爸妈定价|等妈妈定价|等他们定价/)
  })

  it('★ 游戏卡和盲盒 hero 都写「去激活」', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')
    const game = document.querySelector('[data-wish-kind="gamebox"]') as HTMLElement
    const hero = document.querySelector('[data-wish-card="blindbox"]') as HTMLElement
    expect(game.querySelector('[data-wish-activate]')?.textContent).toMatch(/去激活/)
    expect(hero.querySelector('[data-wish-activate]')?.textContent).toMatch(/去激活/)
  })

  it('★ 实物卡点「我想要」直接落一条 wished 单，不跳详情页', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')
    const toy = [...document.querySelectorAll('[data-wish-card]')].find((c) =>
      (c.textContent ?? '').includes('恐龙模型套装'),
    ) as HTMLElement
    expect(toy, '实物卡没渲染').toBeTruthy()
    const want = toy.querySelector('[data-wish-action]') as HTMLElement
    expect(want.textContent).toMatch(/我想要/)
    await userEvent.setup().click(want)
    await waitFor(() =>
      expect(
        useApp.getState().wishOrders.some(
          (o) => o.itemId === 'wish-dino' && o.status === 'wished',
        ),
      ).toBe(true),
    )
    /* ★ 还要等 refresh() 收尾：按钮从「我想要」翻成「已向爸妈申请」
       得等 wishOrders 灌回 store 并重渲染。不等的话，组件里那句
       `void wishExpress()` 的 refresh 可能跨到下一条用例的 db.delete()，
       抛 DatabaseClosedError（断言全绿但 vitest 退 1）。 */
    await waitFor(() => {
      const card = [...document.querySelectorAll('[data-wish-card]')].find((c) =>
        (c.textContent ?? '').includes('恐龙模型套装'),
      )
      expect(card?.querySelector('[data-wish-action]')?.textContent).toMatch(/已向爸妈申请/)
    })
    expect(document.querySelector('[data-merchant-entry]'), '不该跳进详情页').toBeTruthy()
  })

  it('★ 已经表过态的实物卡改成「已向爸妈申请」，点了进详情不是空转', async () => {
    await db.wishOrders.put(
      wishedOrder({
        id: 'wo_dino',
        itemId: 'wish-dino',
        itemName: '恐龙模型套装',
        kind: 'toy',
      }) as never,
    )
    await useApp.getState().refresh()
    render(<WishPage />)
    await screen.findByText('心愿商城')
    const toy = [...document.querySelectorAll('[data-wish-card]')].find((c) =>
      (c.textContent ?? '').includes('恐龙模型套装'),
    ) as HTMLElement
    const btn = toy.querySelector('[data-wish-action]') as HTMLElement
    expect(btn.textContent).toMatch(/已向爸妈申请/)
    await userEvent.setup().click(btn)
    expect(await screen.findByText(/已向爸妈申请，等他们回应/)).toBeTruthy()
  })
})


/* ============================================================
   ★ 第六轮（2026-11-06）：可兑换 / 一次性兑换
   ------------------------------------------------------------
   用户原话：
     「家长审核设定兑换卷数量时，还得填是否一次性兑换，都设定好后，
       接着加入到兑换列表。」
     「心愿商城也从申请兑换，改成 可兑换，点可兑换就去兑换列表。」
     「兑换完后，如果是一次性的，就删除，心愿商城 物品状态又变回 我想要。」

   三件事各自错法的样子：
     · 心愿页自己扣币 ⇒ App 里出现第二个收银台（10-29 家长明确否过）；
     · 一次性只在客户端补发 set-offer ⇒ 那次请求失败时券扣了、商品还在架上；
     · 兑换完还挂着「已兑换」⇒ 孩子以为这件永远换完了，其实可以重新许愿。
   ============================================================ */
describe('心愿商城：可兑换 / 一次性兑换', () => {
  /** 列表里某件商品那张卡 */
  const cardOf = (name: string) => {
    const el = [...document.querySelectorAll('[data-wish-card]')].find((c) =>
      (c.textContent ?? '').includes(name),
    ) as HTMLElement | undefined
    if (!el) throw new Error(`列表里找不到「${name}」`)
    return el
  }

  it('★ 点「可兑换」把人送到兑换那一格，这一页一分钱都不扣', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    await db.wishOffers.put({ itemId: 'wish-dino', voucherPrice: 20, openedAt: Date.now() })
    await postHarvest({ delta: 50, source: 'manual_adjust', memo: 'test' })
    await useApp.getState().refresh()
    useApp.setState({ pendingRedeemItem: null })

    render(<WishPage />)
    await screen.findByText('心愿商城')

    const card = cardOf('恐龙模型套装')
    const action = card.querySelector('[data-wish-action]') as HTMLElement
    expect(action.textContent, '定了价就该是「可兑换」').toMatch(/可兑换/)

    const before = useApp.getState().harvestBalance
    await userEvent.setup().click(action)

    /* 判据是「跨页通道被设了」+「账本一动没动」——
       只钉按钮文案的话，把 `wishRedeem` 写回去照样绿。 */
    expect(useApp.getState().pendingRedeemItem, '没把人送到兑换那一格').toBe('wish-dino')
    expect(useApp.getState().harvestBalance, '心愿商城不该扣币').toBe(before)
    expect(useApp.getState().wishOrders.length, '不该生成订单').toBe(0)
  })

  it('★ 家长定价页能选「只兑换一次」，保存时写进 offer', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    const user = userEvent.setup()
    render(<WishPage />)
    await screen.findByText('心愿商城')

    await user.click(cardOf('恐龙模型套装').querySelector('button') as HTMLElement)
    await user.click(await screen.findByText('定价'))

    const once = document.querySelector('[data-wish-once-on]') as HTMLElement | null
    const repeat = document.querySelector('[data-wish-once-off]') as HTMLElement | null
    expect(once, '定价页缺「只兑换一次」—— 用户要求审核时一起填').toBeTruthy()
    expect(repeat).toBeTruthy()

    await user.click(once as HTMLElement)
    await user.click(screen.getByRole('button', { name: '开放兑换' }))

    /* ⚠️ 判据必须是 **store**，不能是「库行」：
       `user.click` 只等到事件派发，保存按钮的 async 处理函数还在跑 ——
       它先 `put`（库行立刻就对），再 `await refresh()`（要读十几张表）。
       拿库行当判据会在 put 一落地就通过，于是用例结束、下一条 `beforeEach`
       的 `db.delete()` 把还在读表的 `refresh()` 掀翻 ——
       症状是「全绿 + 一条 DatabaseClosedError」。
       store 那份是 `refresh()` 末尾赋的值，读到它就等于 refresh 收工了。 */
    await waitFor(() => {
      const offer = useApp.getState().wishOffers.find((o) => o.itemId === 'wish-dino')
      expect(offer?.oneTime, '一次性标记没落库 ⇒ 兑换完不会离开兑换列表').toBe(true)
    })
    /* 再读一次库：store 只是 `refresh()` 的镜像，别把「镜像对了」当「落盘了」 */
    expect((await db.wishOffers.get('wish-dino'))?.oneTime).toBe(true)
  })

  it('★ 一次性兑换成功：offer 立刻关掉，卡片回到「我想要」', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    await db.wishOffers.put({
      itemId: 'wish-dino',
      voucherPrice: 20,
      openedAt: Date.now(),
      oneTime: true,
    })
    await postHarvest({ delta: 50, source: 'manual_adjust', memo: 'test' })
    await useApp.getState().refresh()

    render(<WishPage />)
    await screen.findByText('心愿商城')
    expect(cardOf('恐龙模型套装').querySelector('[data-wish-action]')?.textContent).toMatch(
      /可兑换/,
    )

    const res = await useApp.getState().wishRedeem('wish-dino')
    expect(res.ok).toBe(true)

    /* ★ 关闭写在**兑换那个事务里**（`wishRedeem`），所以这里读库即可：
       offer 行还在（历史要能解释），只是 `closedAt` 有值 ⇒ 不在兑换列表里了。 */
    await waitFor(() => {
      const offer = useApp.getState().wishOffers.find((o) => o.itemId === 'wish-dino')
      expect(offer?.closedAt, '一次性商品兑换后必须关掉 offer').toBeTruthy()
    })
    expect((await db.wishOffers.get('wish-dino'))?.closedAt).toBeTruthy()
    await waitFor(() =>
      expect(
        cardOf('恐龙模型套装').querySelector('[data-wish-action]')?.textContent,
        '一次性兑换完，心愿商城要回到「我想要」',
      ).toMatch(/我想要/),
    )
  })

  it('★ 改价不冲掉「只兑换一次」（服务端那条 *bool 的本地镜像）', async () => {
    await useApp.getState().wishSetOffer('wish-dino', 30, true)
    expect((await db.wishOffers.get('wish-dino'))?.oneTime).toBe(true)

    /* 不传第三个参数 = 这次请求没提这件事 ⇒ 沿用库里那份。
       直接 `put(undefined)` 会把标记冲成「可重复」：家长下次重新开放时，
       一件一次性的玩具就变成可以无限兑换了，界面上看不出任何异常。 */
    await useApp.getState().wishSetOffer('wish-dino', 40)
    const after = await db.wishOffers.get('wish-dino')
    expect(after?.voucherPrice, '价格要改到').toBe(40)
    expect(after?.oneTime, '改价不该顺手把一次性标记冲掉').toBe(true)

    /* 显式 `false` 才是真的要改成可重复 */
    await useApp.getState().wishSetOffer('wish-dino', 40, false)
    expect((await db.wishOffers.get('wish-dino'))?.oneTime).toBe(false)
  })

  it('★ 对照：可重复兑换的商品换完仍然留在兑换列表里', async () => {
    await db.wishOffers.put({ itemId: 'wish-dino', voucherPrice: 20, openedAt: Date.now() })
    await postHarvest({ delta: 50, source: 'manual_adjust', memo: 'test' })
    await useApp.getState().refresh()

    const res = await useApp.getState().wishRedeem('wish-dino')
    expect(res.ok).toBe(true)

    const offer = await db.wishOffers.get('wish-dino')
    expect(offer?.closedAt, '可重复兑换的不该被关掉').toBeFalsy()
  })
})

/* ============================================================
   家长密码：全 App 统一成弹框（2026-11-06）
   ------------------------------------------------------------
   用户原话：「需要家长密码的，能否统一成弹框的样式，比如点眼睛时候那样。」

   改之前这一页是**键盘顶替按钮**：实物单点进详情，整块区域换成键盘，
   页面上一个能点的东西都没有 —— 孩子看到的是一片数字键，像坏了。
   现在是一颗「👤 爸妈：确认兑换 · 去购买」，点下去才弹密码。

   ⚠️ 三条断言必须**成对**写（见 `_probe-*` 那边的同名教训）：
     只测「输对了能进」⇒ 闸门根本没接上也绿；
     只测「页面上没键盘」⇒ 点了弹不出框也绿。
   ============================================================ */
describe('心愿：家长密码是一个弹框，不是铺在页面里的键盘', () => {
  /** 实物单（committed）+ 保护开着 + 已知密码 0000 */
  const openPhysicalCommitted = async () => {
    await useApp.getState().updateSettings({ protectParentActions: true, parentPin: '0000' })
    await db.wishOrders.put(
      committedOrder({
        id: 'wo_toy_gate',
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
    return user
  }

  it('★ 页面上只有锁按钮：没有键盘，也没有真按钮', async () => {
    await openPhysicalCommitted()

    expect(
      document.querySelector('[data-parent-lock]'),
      '连锁按钮都没有 —— 这一屏等于没有出口',
    ).toBeTruthy()
    expect(
      document.querySelector('[data-wish-finish]'),
      '没过闸就渲染出真按钮 = 假闸门',
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: '确定' }),
      '键盘又铺回页面里了（用户要的是弹框）',
    ).toBeNull()
  })

  it('★ 点锁按钮才弹框；输错不放行，输对了真按钮才出现', { timeout: 30000 }, async () => {
    const user = await openPhysicalCommitted()

    await user.click(document.querySelector('[data-parent-lock]') as HTMLElement)
    const sheet = await screen.findByRole('dialog')
    expect(within(sheet).getByText('请爸爸妈妈来一下')).toBeTruthy()

    /* 输错：弹框不关、真按钮不出现 */
    for (const k of ['1', '2', '3', '4']) {
      await user.click(within(sheet).getByRole('button', { name: k }))
    }
    expect(await within(sheet).findByText(/密码不对/)).toBeTruthy()
    expect(
      document.querySelector('[data-wish-finish]'),
      '输错了却放行了 —— 这道闸门是假的',
    ).toBeNull()

    /* 输对：弹框自己关掉，真按钮出现 */
    for (const k of ['0', '0', '0', '0']) {
      await user.click(within(sheet).getByRole('button', { name: k }))
    }
    await waitFor(() =>
      expect(document.querySelector('[data-wish-finish]'), '输对了却没出现真按钮').toBeTruthy(),
    )
    expect(screen.queryByRole('dialog'), '过了闸弹框要自己关掉').toBeNull()
  })
})
