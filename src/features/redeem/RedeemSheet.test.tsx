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
  await priceItemAt(itemId, voucherPrice, Date.now(), closed)
}

/** 同上，但**指定同意的时间** —— 验「最新的排前面」时必须能控制先后 */
async function priceItemAt(
  itemId: string,
  voucherPrice: number,
  openedAt: number,
  closed = false,
) {
  await db.wishOffers.put({
    itemId,
    voucherPrice,
    openedAt,
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

  /* 2026-11-12 用户要求：兑换页里这些「爸妈已经同意」的心愿行，
     ① 要有丝带标出品类（它们和家里的兑换品混在同一张表，光看名字分不清
        是盲盒还是玩具，而两者的交付方式完全不同）；
     ② 按家长同意的时间倒序，最新的排前面。 */
  it('★ 心愿行挂着品类丝带（丝带上就是品类名）', async () => {
    /* 用游戏盒子这一条：它的品类没有歧义（`gamebox` → 「游戏」）。
       ⚠️ 别拿 `wish-popmart`（泡泡玛特盲盒）当判据 —— 它的 `kind` 是
       `collectible`（实体收藏），名字里那个「盲盒」和数字盲盒
       （`blindbox` = 开游戏池）不是一回事，按名字猜会写错断言。 */
    await priceItem('wish-game-renttower', 30)

    render(<RedeemBody />)
    await ready()

    const row = shopRow('wish-game-renttower')
    const ribbon = row.querySelector<HTMLElement>('[data-redeem-ribbon]')
    expect(ribbon, '心愿行没有丝带').toBeTruthy()
    // 值是**品类**而不是布尔：走查脚本要靠它数「每种几张」
    expect(ribbon?.getAttribute('data-redeem-ribbon')).toBe('gamebox')
    expect(ribbon?.textContent).toBe('游戏')
    // 家里那几件不带丝带 —— 有丝带的才是「外面来的心愿」
    const familyRibbons = document.querySelectorAll(
      '[data-shop-row]:not([data-shop-row^="wish-"]) [data-redeem-ribbon]',
    )
    expect(familyRibbons.length, '家里的兑换品不该挂心愿丝带').toBe(0)
  })

  it('★ 最新的排前面：按家长同意的时间倒序', async () => {
    const t0 = Date.now() - 60_000
    // 先同意「收租公寓」，一分钟后又同意「泡泡玛特盲盒」
    await priceItemAt('wish-game-renttower', 30, t0)
    await priceItemAt('wish-popmart', 30, t0 + 60_000)

    render(<RedeemBody />)
    await ready()

    const ids = [...document.querySelectorAll('[data-shop-row]')].map((e) =>
      e.getAttribute('data-shop-row'),
    )
    const iPop = ids.indexOf('wish-popmart')
    const iRent = ids.indexOf('wish-game-renttower')
    expect(iPop, '两行都该在列表里').toBeGreaterThanOrEqual(0)
    expect(iRent).toBeGreaterThanOrEqual(0)
    expect(iPop, '后同意的应该排在先同意的前面').toBeLessThan(iRent)
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

  /* 2026-10-29，320 宽真机探针（`scripts/_probe-record-row.mjs`）量到的排版事故：
     混付单的 `-100 兑换券 + 50 积分 · 刚刚` 约 150px，右边标签「已取消 · 已退回」
     占 93px 之后只剩 ~135px ⇒ 必然折行。折行可以接受，但**默认规则下 CJK 能断在
     任意两个字之间**，实测断成了
         `-100 兑换券 + 50 积`
         `分 · 刚刚`
     —— 「积分」被劈开，金额还留着个孤零零的 `·` 在行尾。

     jsdom 不做布局，量不到宽度，但能钉住**那两条防止它再犯的样式**：
     `break-keep`（只在空格处断）+ 把 `·` 和时间绑成不可断的块。
     断言写得像"查 class"是故意的 —— 谁重写这一行，谁就得回来重跑一次 320 的探针。 */
  it('★ 记录行的付款文案：只许在空格处断行，分隔符不许跟时间分开', async () => {
    await db.wishOrders.put({
      id: 'wo_mixed',
      itemId: 'wish-puzzle',
      itemName: '1000 片拼图',
      itemEmoji: '🧩',
      kind: 'collectible',
      voucherPrice: 150,
      status: 'cancelled',
      vouchersHeld: 100,
      pointsHeld: 50,
      createdAt: Date.now(),
    })
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<RedeemBody />)
    await ready()
    await user.click(screen.getByRole('button', { name: /兑换记录/ }))

    const rec = document.querySelector<HTMLElement>('[data-redeem-record]')
    expect(rec, '单子在记录里').toBeTruthy()
    // 混付要写出两种币各扣了多少
    expect(rec?.textContent).toContain('-100 兑换券 + 50 积分')

    const pay = rec?.querySelectorAll('p')[1]
    expect(pay, '第二行是付款').toBeTruthy()
    expect(pay?.className, 'CJK 不许在词中间断行').toContain('break-keep')
    const tail = pay?.querySelector('span')
    expect(tail?.className, '`· 时间` 绑成一块，别让 `·` 落在行尾').toContain(
      'whitespace-nowrap',
    )
    expect(tail?.textContent, '分隔符和时间在同一个块里').toMatch(/^ · .+/)
  })
})

/* ============================================================
   tab 行：文案是**固定短词**，任何宽度都不许在词中间断行
   ------------------------------------------------------------
   2026-10-29，360 宽实测（`scripts/_probe-record-row.mjs`）：
   红徽标把「📜 兑换记录 1」挤成
       `📜 兑换记`
       `录 1`
   —— 一个控件名字被劈开。390 上刚好放得下，所以截图走查看不出来。

   修法是 `whitespace-nowrap`（tab 文案短且固定，本来就该不可断）。
   jsdom 量不到宽度，这里只能钉住那条样式 + 探针依赖的锚点；
   真正的判据在探针里：390 / 360 / 320 / 834 四档都要「标签行数 = 1、
   三个 tab 一样高、内容不溢出」。
   ============================================================ */
describe('兑换页 tab 行', () => {
  it('★ 三个 tab 都不许断行（360 宽被红徽标挤成「兑换记」/「录」）', async () => {
    render(<RedeemBody />)
    await ready()

    const bar = document.querySelector('[data-redeem-tabs]')
    expect(bar, 'tab 行锚点（探针也靠它）').toBeTruthy()
    const tabs = [...(bar?.querySelectorAll('button') ?? [])]
    expect(tabs.length, '三个 tab').toBe(3)
    for (const t of tabs) {
      expect(t.className, `「${t.textContent}」不许在词中间断行`).toContain(
        'whitespace-nowrap',
      )
    }
  })
})


/* ============================================================
   第六轮：行上写「已兑换 N 次」（2026-11-06）
   ------------------------------------------------------------
   用户原话：「兑换列表 item 添加已兑换次数。」

   口径只数**真的成交了**的单子：`wished` 一分钱没扣、`cancelled`
   券退回去了 —— 把它们算进去，孩子会看到「已兑换 3 次」而手里只有一件。
   ============================================================ */
describe('兑换列表：已兑换次数', () => {
  const order = (id: string, status: string) => ({
    id,
    itemId: 'wish-popmart',
    itemName: '泡泡玛特盲盒',
    itemEmoji: '🎁',
    kind: 'toy' as const,
    voucherPrice: 30,
    status,
    vouchersHeld: 30,
    createdAt: Date.now(),
  })

  it('★ 成交过的单子才算次数（wished / cancelled 不算）', async () => {
    await priceItem('wish-popmart', 30)
    await db.wishOrders.bulkPut([
      order('wo_a', 'done'),
      /* ⚠️ 不能拿 `confirmed` 当「成交过」的例子：它算**在走流程**，
         `wishShelf` 会把整行排除掉（那件东西已经付过钱了）——
         断言会红在「列表里没有这一行」，看着像次数算错了。 */
      order('wo_b', 'done'),
      order('wo_c', 'cancelled'),
      order('wo_d', 'wished'),
    ] as never)
    await useApp.getState().refresh()

    render(<RedeemBody />)
    await ready()

    const row = shopRow('wish-popmart')
    expect(within(row).getByText(/已兑换 2 次/), '次数只数成交的').toBeTruthy()
  })

  it('★ 一次没换过就不写这一行（别写「已兑换 0 次」）', async () => {
    await priceItem('wish-popmart', 30)
    render(<RedeemBody />)
    await ready()

    expect(within(shopRow('wish-popmart')).queryByText(/已兑换/)).toBeNull()
  })
})

/* ============================================================
   管理 tab 的家长密码：锁卡 + 弹框（2026-11-06 统一）
   ------------------------------------------------------------
   改之前切到「⚙️ 管理」就是迎面一屏数字键：没有「这是爸妈的事」的说明，
   也没有出口。现在是一张锁卡 + 一颗按钮。
   ============================================================ */
describe('兑换：管理 tab 的家长密码是弹框', () => {
  const openManage = async () => {
    await useApp.getState().updateSettings({ protectParentActions: true, parentPin: '0000' })
    await useApp.getState().refresh()
    const user = userEvent.setup()
    render(<RedeemBody />)
    await ready()
    await user.click(screen.getByRole('button', { name: /管理/ }))
    return user
  }

  it('★ 切到管理：先看到锁卡，不是一屏数字键', async () => {
    await openManage()
    expect(document.querySelector('[data-parent-lock]'), '锁按钮没有').toBeTruthy()
    expect(screen.queryByRole('button', { name: '确定' }), '键盘铺在页面里了').toBeNull()
    expect(screen.getByText('管理兑换品需要密码')).toBeTruthy()
  })

  it('★ 点锁按钮弹框，输对才出现管理面板', async () => {
    const user = await openManage()
    await user.click(document.querySelector('[data-parent-lock]') as HTMLElement)
    const sheet = await screen.findByRole('dialog')

    for (const k of ['0', '0', '0', '0']) {
      await user.click(within(sheet).getByRole('button', { name: k }))
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(
      screen.queryByText('管理兑换品需要密码'),
      '过了闸锁卡还挂着 —— 说明 pinOk 没接上',
    ).toBeNull()
  })
})
