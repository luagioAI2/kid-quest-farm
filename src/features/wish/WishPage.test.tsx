import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { STOREFRONT } from '@/games/storefront'
import { wishItemById } from '@/games/wishCatalog'
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
    /* 2026-10-29 改了：已拥有的游戏盒子**整张不显示**了（家长：
       「兑换了就有了，不需要再兑换，不需要显示在能换什么」）。
       原来这里断言它写「已经有了」—— 那张卡换不了、也没有任何可做的动作，
       只是占位置。现在它直接不在列表里，改由底部那句计数解释。 */
    expect(screen.queryByText('已经有了'), '已拥有的游戏盒子不该再列出来').toBeNull()
    expect(screen.getByText(/1 款游戏你已经换到了/), '藏了要说一句').toBeTruthy()
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
     · 孩子自己那一侧仍然看得见「已告诉爸妈」；
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

  it('孩子那一侧仍然写着「已告诉爸妈」', async () => {
    // 撤卡撤的是**家长**的入口，不能顺手把孩子唯一的反馈也撤掉 ——
    // 他点完「想要这个」之后，至少要知道这件事已经传达出去了。
    await db.wishOrders.put(wishedOrder({}) as never)
    await useApp.getState().refresh()

    render(<WishPage />)
    expect(await screen.findByText('已告诉爸妈')).toBeTruthy()
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

    await waitFor(async () => {
      const row = await db.wishOrders.get('wo_wish')
      expect(row?.status, '回绝之后不能还停在 wished').toBe('cancelled')
      expect(row?.cancelReason).toContain('先不换')
    })
  })

  it('★ 被回绝过之后，详情里还看得见上次的理由', async () => {
    // 没有这一句的话，孩子看到的是一个干干净净的「🤍 想要这个」——
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
    expect(screen.getByText('🤍 想要这个'), '仍然允许再点一次，不加冷却').toBeTruthy()
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
describe('心愿商城：已经换到的游戏不再列出来', () => {
  it('★ 拥有之后那张卡消失，底部说明有 1 款', async () => {
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
    expect(screen.queryByText('收租公寓'), '已经拥有的游戏不该在列表里').toBeNull()
    expect(screen.getByText(/1 款游戏你已经换到了/), '藏了要说一句').toBeTruthy()
  })

  it('对照组：没拥有的游戏照旧在列表里', async () => {
    render(<WishPage />)
    await screen.findByText('心愿商城')
    expect(screen.getByText('收租公寓'), '没换到的游戏不该被藏').toBeTruthy()
    expect(screen.queryByText(/款游戏你已经换到了/), '一款都没换过就别摆这句').toBeNull()
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
   得自己摸到「设置 → 游戏 → 有兑换码」。所以两块都摆到家长眼前。

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
  const openParentPricing = async () => {
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
    await useApp.getState().refresh()
    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: /收租公寓/ }))
    await user.click(await screen.findByText(/定个价/))
    return user
  }

  it('★ 家长定价页里有「也可以直接买这一款」，且购买链接真的存在', async () => {
    await openParentPricing()
    expect(await screen.findByText(/也可以直接买这一款/)).toBeTruthy()

    const buy = document.querySelector('[data-wish-buy-game]') as HTMLButtonElement | null
    expect(buy, '游戏类商品必须有购买入口 —— 没有的话家长只能自己搜').toBeTruthy()
    // 21 款游戏共用同一条推导规则，随便挑一款验链接形状
    const item = wishItemById('wish-game-renttower')
    expect(item?.buyUrl, '搜索页而不是具体商品链接（具体链接会失效）').toMatch(
      /^https:\/\/s\.taobao\.com\/search\?q=/,
    )
    expect(decodeURIComponent(item?.buyUrl ?? '')).toContain('激活码')
  })

  it('★ 输码成功后：调的是 store 的兑换（不是本地解锁），并关掉面板', async () => {
    const redeemGameCode = vi.fn(async () => ({ ok: true, message: '已激活：收租公寓' }))
    useApp.setState({ redeemGameCode })

    const user = await openParentPricing()
    await user.click(document.querySelector('[data-code-open]') as HTMLElement)
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'abc-def')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    expect(redeemGameCode).toHaveBeenCalledWith('abc-def')
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
   商品详情页：游戏卡**就地**激活（2026-11-05）
   ------------------------------------------------------------
   用户原话：「为啥 游戏 盲盒 还有 游戏 都没有 激活 的地方。
   应该在心愿商城 对应 item 就可以激活吧。不然拿到了 激活码
   或者兑换码，咋办。」

   在这之前全 App 只有两个输码口，而且**都在家长区**
   （`设置 → 游戏`、心愿商城的家长定价页）—— 孩子手里捏着卡、
   站在卖这张卡的商品上，却没有任何地方能输。

   这里钉四件事：
     ① 详情页上真的有输码入口（`data-wish-code`）；
     ② 保护开着时**先过家长密码**，键盘不直接摆给孩子
        （用户选的是「保持现状（家长控制）」）；
     ③ 成功 → 留在原地、说「已经在我的游戏里」，**不替孩子切当前**；
     ④ 失败 → 红字 + 不清空（要能对着卡片改一位）。
   ============================================================ */
describe('心愿：商品详情页能就地激活游戏卡', () => {
  /** 从列表点进某件游戏盒子的详情页 */
  const openGameDetail = async (name = '收租公寓') => {
    const user = userEvent.setup()
    render(<WishPage />)
    await user.click(await screen.findByRole('button', { name: new RegExp(name) }))
    return user
  }

  it('★ 详情页就有输码入口（不用摸到「设置 → 游戏」）', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    await openGameDetail()

    expect(document.querySelector('[data-wish-code]'), '详情页缺了输码那一块').toBeTruthy()
    expect(document.querySelector('[data-code-open]'), '有块没按钮 = 还是输不了').toBeTruthy()
  })

  it('★ 保护开着：先要家长密码，输入框不摆给孩子', async () => {
    await useApp.getState().updateSettings({ protectParentActions: true, parentPin: '1234' })
    const user = await openGameDetail()

    await user.click(document.querySelector('[data-code-open]') as HTMLElement)
    expect(
      document.querySelector('[data-code-input]'),
      '没过闸门就出现输入框 —— 那道闸门是假的',
    ).toBeNull()
    expect(screen.getByText('请爸爸妈妈来一下')).toBeTruthy()

    /* ★ 手滑点开要有退路。不给 `onCancel` 时 `PinFlow` 底下那颗
       「先算了」**根本不渲染** —— 只能答完数学题 + 设完密码才出得去。 */
    await user.click(screen.getByRole('button', { name: '先算了' }))
    await waitFor(() => expect(document.querySelector('[data-code-open]')).toBeTruthy())
    expect(document.querySelector('[data-code-input]')).toBeNull()

    // 再点一次，4 位输对才展开（PinPad 第 4 位自动提交）
    await user.click(document.querySelector('[data-code-open]') as HTMLElement)
    for (const d of ['1', '2', '3', '4']) {
      await user.click(screen.getByRole('button', { name: d }))
    }
    await waitFor(() => expect(document.querySelector('[data-code-input]')).toBeTruthy())
  })

  it('★ 成功：交给 store、留在原地、说清「已经在我的游戏里」', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    const redeemGameCode = vi.fn(async () => {
      /* ★ 必须模拟真实实现的收尾：它成功后会 `refresh()`，
         `ownedGameIds` 立刻多这一款 ⇒ 详情页的 `alreadyOwned` 翻 true。
         少了这一步，这条测试就抓不到「整块连同绿字被同一帧卸载」那个 bug
         （2026-11-05 用真码走查抓到的：游戏到账了，页面看着像没反应）。 */
      useApp.setState({ ownedGameIds: [...useApp.getState().ownedGameIds, 'renttower'] })
      return { ok: true, message: '已激活：收租公寓' }
    })
    useApp.setState({ redeemGameCode })

    const user = await openGameDetail()
    await user.click(document.querySelector('[data-code-open]') as HTMLElement)
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'abc-def')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    // 界面不偷偷改大小写 / 不替用户去掉那一横 —— 归一化是 store 的事
    expect(redeemGameCode).toHaveBeenCalledWith('abc-def')

    const done = document.querySelector('[data-code-done]')
    await waitFor(() => expect(done?.textContent).toContain('已激活'))

    /* ★ 已经拥有了，这一块**还得在**（只是不再写「已经买到卡了？」） */
    await waitFor(() => expect(document.querySelector('[data-code-done]')).toBeTruthy())
    expect(document.querySelector('[data-code-open]'), '成功之后不该退回按钮').toBeNull()

    /* ★ 不替孩子切「当前游戏」。用户 2026-11-05 明确选了
       「保持现状（家长控制）」—— 所以成功之后只有一句指路，
       页面里**不该**冒出一个「去玩 / 切过去」的按钮。 */
    expect(done?.textContent, '要说清下一步找谁').toContain('设置 → 游戏')
    expect(screen.queryByRole('button', { name: /去玩|切过去|开始玩/ })).toBeNull()
  })

  it('★ 失败：红字 + 不清空（要能对着卡片改一位）', async () => {
    await useApp.getState().updateSettings({ protectParentActions: false })
    useApp.setState({
      redeemGameCode: vi.fn(async () => ({ ok: false, message: '这个兑换码已经用过了' })),
    })

    const user = await openGameDetail()
    await user.click(document.querySelector('[data-code-open]') as HTMLElement)
    await user.type(document.querySelector('[data-code-input]') as HTMLInputElement, 'ABC-DEG')
    await user.click(document.querySelector('[data-code-submit]') as HTMLElement)

    const msg = document.querySelector('[data-code-msg]')
    await waitFor(() => expect(msg?.textContent).toContain('已经用过'))
    expect((document.querySelector('[data-code-input]') as HTMLInputElement).value).toBe('ABC-DEG')
  })

  it('★ 盲盒页说清「没有激活码」（否则看着像漏做了）', async () => {
    const user = userEvent.setup()
    render(<WishPage />)
    await screen.findByText('心愿商城')

    // 单开盲盒 hero 整块是一个按钮，点它进详情
    await user.click(screen.getByText('随机开出 1 款你还没有的游戏'))

    expect(await screen.findByText(/盲盒没有激活码/)).toBeTruthy()
    expect(document.querySelector('[data-wish-code]'), '盲盒不该有输码入口').toBeNull()
  })
})
