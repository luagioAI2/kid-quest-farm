import { describe, expect, it } from 'vitest'
import {
  blindBoxRemaining,
  childPending,
  compareWishItem,
  daysToSave,
  needsParentAction,
  pickBlindBoxMany,
  planWishRedeem,
  redeemedGameIdsFrom,
  wishShelf,
  wishesAwaitingReply,
} from './wish'
import type { WishItem } from './types'

/* ============================================================
   心愿商城的纯逻辑
   ------------------------------------------------------------
   这三块出错都是**静默**的，所以必须有单测钉住：

   * `planWishRedeem` —— 差一张也算「够」的话，孩子会点到一个换不了的按钮
   * `blindBoxRemaining` —— 漏掉「已拥有」会开出重复的游戏（而且不报错）
   * `pickBlindBoxMany` —— 池子空了还返回东西，就会「先扣券再发现没得开」
   ============================================================ */

describe('planWishRedeem：够不够、两种币各付多少', () => {
  it('刚好够（纯券）', () => {
    expect(planWishRedeem(30, 30, 0)).toEqual({
      affordable: true,
      shortfall: 0,
      price: 30,
      voucherPaid: 30,
      pointsPaid: 0,
    })
  })

  it('差一张就不够 —— 不能四舍五入成「够」', () => {
    const r = planWishRedeem(30, 29, 0)
    expect(r.affordable).toBe(false)
    expect(r.shortfall).toBe(1)
  })

  it('多出来的券不会被「花掉」—— price 只记标价', () => {
    expect(planWishRedeem(30, 500, 0).price).toBe(30)
  })

  it('负数 / 小数一律兜住，不让它们渗进账本', () => {
    expect(planWishRedeem(-10, 5, 0).price).toBe(0)
    expect(planWishRedeem(30.4, 30.4, 0)).toEqual({
      affordable: true,
      shortfall: 0,
      price: 30,
      voucherPaid: 30,
      pointsPaid: 0,
    })
  })

  /* ------------------------------------------------------------
     2026-10-29：券不够可以用积分补（家长要求，规则同「兑换」）
     ------------------------------------------------------------ */

  it('券 0、积分够 → 全用积分', () => {
    expect(planWishRedeem(80, 0, 300)).toEqual({
      affordable: true,
      shortfall: 0,
      price: 80,
      voucherPaid: 0,
      pointsPaid: 80,
    })
  })

  it('券不够 → 先花光券，剩下的用积分补（1 比 1）', () => {
    expect(planWishRedeem(80, 30, 300)).toEqual({
      affordable: true,
      shortfall: 0,
      price: 80,
      voucherPaid: 30,
      pointsPaid: 50,
    })
  })

  it('券够就**不碰积分** —— 积分要留着换别的东西', () => {
    expect(planWishRedeem(80, 100, 999).pointsPaid).toBe(0)
  })

  it('两种币加起来还差一分 → 不够，差额按合计算', () => {
    const r = planWishRedeem(80, 30, 49)
    expect(r.affordable).toBe(false)
    expect(r.shortfall).toBe(1)
  })
})

describe('blindBoxRemaining：池子减去已拥有', () => {
  it('排除已拥有', () => {
    expect(blindBoxRemaining(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c'])
  })

  it('池子里重复的 id 只算一次 —— 否则那一款概率翻倍，且看不出来', () => {
    expect(blindBoxRemaining(['a', 'a', 'b'], [])).toEqual(['a', 'b'])
  })

  it('全都拥有时是空的', () => {
    expect(blindBoxRemaining(['a', 'b'], ['a', 'b'])).toEqual([])
  })

  it('拥有列表里有池子外的 id 不影响结果', () => {
    expect(blindBoxRemaining(['a'], ['zzz'])).toEqual(['a'])
  })
})

describe('pickBlindBoxMany：开奖（含 5 连开）', () => {
  it('池子空了返回空数组 —— 调用方必须先判这个再扣券', () => {
    expect(pickBlindBoxMany(['a', 'b'], ['a', 'b'], 1)).toEqual([])
  })

  it('n = 1 就是老的单开：只开一款', () => {
    expect(pickBlindBoxMany(['a', 'b', 'c'], [], 1, () => 0.5)).toHaveLength(1)
  })

  it('注入 rand 能钉死结果（测试不靠 Math.random）', () => {
    const a = pickBlindBoxMany(['a', 'b', 'c', 'd'], [], 2, () => 0.3)
    const b = pickBlindBoxMany(['a', 'b', 'c', 'd'], [], 2, () => 0.3)
    expect(a).toEqual(b)
  })

  it('★ 已经解锁的不计算 —— 不占名额，也不会被开出来', () => {
    const owned = ['a', 'b', 'c']
    const got = pickBlindBoxMany(['a', 'b', 'c', 'd', 'e', 'f', 'g'], owned, 4, () => 0.5)
    expect(got).toHaveLength(4)
    for (const id of got) expect(owned).not.toContain(id)
  })

  it('不重复 —— 同一个池子里的 id 不会开出两次', () => {
    const got = pickBlindBoxMany(['a', 'b', 'c', 'd', 'e'], [], 5, () => 0.77)
    expect(new Set(got).size).toBe(5)
  })

  it('剩余不足时给短的（由调用方决定「整单拒绝」）', () => {
    // 只剩 e 一款，要 5 款 → 只给 1 条，调用方据此拒绝整单
    expect(pickBlindBoxMany(['a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd'], 5)).toEqual(['e'])
  })

  it('永远不会开出已拥有的（200 次随机）', () => {
    const owned = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 200; i++) {
      expect(pickBlindBoxMany(['a', 'b', 'c', 'd', 'e'], owned, 1)).toEqual(['e'])
    }
  })

  it('rand 返回 1（越界）也不会崩', () => {
    const got = pickBlindBoxMany(['a', 'b'], [], 2, () => 1)
    expect(got).toHaveLength(2)
  })

  it('n <= 0 返回空（卖空盒子是不可接受的）', () => {
    expect(pickBlindBoxMany(['a'], [], 0)).toEqual([])
    expect(pickBlindBoxMany(['a'], [], -3)).toEqual([])
  })
})

describe('daysToSave：大约要攒几天', () => {
  it('向上取整 —— 「9 天」比「8.2 天」好懂', () => {
    expect(daysToSave(80, 9.5)).toBe(9)
    expect(daysToSave(80, 9)).toBe(9)
    expect(daysToSave(81, 9)).toBe(9)
  })

  it('日均是 0 或负数时返回 null（不显示「要攒 ∞ 天」）', () => {
    expect(daysToSave(80, 0)).toBeNull()
    expect(daysToSave(80, -3)).toBeNull()
  })

  it('至少 1 天：券已经够了也不写「0 天」', () => {
    expect(daysToSave(5, 100)).toBe(1)
  })
})

describe('compareWishItem：盲盒永远在最前', () => {
  const box = { kind: 'blindbox' as const, name: '游戏盲盒', sortOrder: 99 }
  const toy = { kind: 'toy' as const, name: '恐龙', sortOrder: 1 }

  it('盲盒排在任何实物前面，哪怕 sortOrder 更大', () => {
    expect(compareWishItem(box, toy)).toBeLessThan(0)
    expect(compareWishItem(toy, box)).toBeGreaterThan(0)
  })

  it('同类按 sortOrder，再按名字', () => {
    const a = { kind: 'toy' as const, name: 'B', sortOrder: 1 }
    const b = { kind: 'toy' as const, name: 'A', sortOrder: 2 }
    expect(compareWishItem(a, b)).toBeLessThan(0)
  })
})

describe('redeemedGameIdsFrom：卸载之后也算买过', () => {
  /* 这一组的背景：游戏类商品的交付是装包，「拥有」从 `installedGames` 派生。
     可 `uninstallGame` 会把包和存档一起删掉 —— 删完就「没买过」了，
     盒子变回可兑换、盲盒把它放回池子 ⇒ **孩子被扣第二次券**，全程不报错。
     所以「兑换过」必须有一份卸载不掉的记录，也就是 `wishOrders`。 */

  it('committed / confirmed / done 都算到手过', () => {
    const ids = redeemedGameIdsFrom([
      { status: 'committed', openedGameId: 'cloudfarm' },
      { status: 'confirmed', openedGameId: 'prizeprize' },
      { status: 'done', openedGameId: 'sugar' },
    ])
    expect(ids.sort()).toEqual(['cloudfarm', 'prizeprize', 'sugar'])
  })

  it('wished 不算 —— 那时还没扣券', () => {
    expect(redeemedGameIdsFrom([{ status: 'wished' }])).toEqual([])
  })

  it('cancelled 不算 —— 券退回去了，孩子也没拿到东西', () => {
    // 取消之后把游戏算成「已拥有」，孩子就再也不能换它了（而且没拿到）
    expect(
      redeemedGameIdsFrom([{ status: 'cancelled', openedGameId: 'cloudfarm' }]),
    ).toEqual([])
  })

  it('实物订单（没有 openedGameId）不贡献任何 id', () => {
    expect(redeemedGameIdsFrom([{ status: 'done' }, { status: 'committed' }])).toEqual([])
  })

  it('同一个游戏兑换过两次（理论上不该发生）只算一个', () => {
    expect(
      redeemedGameIdsFrom([
        { status: 'committed', openedGameId: 'cloudfarm' },
        { status: 'done', openedGameId: 'cloudfarm' },
      ]),
    ).toEqual(['cloudfarm'])
  })
})

/* ============================================================
   心愿的「等家长回应」与「已上架」两个判据（2026-10-29）
   ------------------------------------------------------------
   这两条决定的是**入口**，写错都不报错：

   * `wishesAwaitingReply` 多算 → 顶栏 👀 的红点永远消不掉。家长定完价、
     孩子还没去换的那段时间，红点还亮着，点进去却是一件已经开放的商品 ——
     一个点不完的数字比没有红点更糟。
   * `wishesAwaitingReply` 少算 → 孩子的心愿没人看见（这是这次要修的原始问题）。
   * `wishShelf` 多算 → 兑换列表里摆着换不了的东西（已拥有 / 已关闭 /
     已经付过钱的单子）。
   ============================================================ */
describe('wishesAwaitingReply：家长还没回应的心愿', () => {
  const o = (patch: Record<string, unknown> = {}) => ({
    id: 'wo1',
    itemId: 'a',
    status: 'wished',
    createdAt: 1,
    ...patch,
  })
  const offer = (itemId: string, patch: Record<string, unknown> = {}) => ({
    itemId,
    voucherPrice: 30,
    ...patch,
  })

  it('没定价的 wished 要算进来', () => {
    expect(wishesAwaitingReply([o()], [])).toHaveLength(1)
  })

  it('★ 定完价的那条**仍然停在 wished**，但不再算待回应', () => {
    // 这是最容易写错的一条：`wishRedeem` 要等孩子真的来换才会把它翻成
    // `committed`，所以「已经回应过」和「还没回应」在数据上是同一个状态。
    const orders = [o({ status: 'wished' })]
    expect(wishesAwaitingReply(orders, [offer('a')])).toHaveLength(0)
  })

  it('★ 家长把它关了（closedAt）→ 重新变回「等你回应」', () => {
    const closed = [offer('a', { closedAt: 999 })]
    expect(wishesAwaitingReply([o()], closed)).toHaveLength(1)
  })

  it('价格是 0 的那行不算开放（写坏了不能当定价）', () => {
    expect(wishesAwaitingReply([o()], [offer('a', { voucherPrice: 0 })])).toHaveLength(1)
  })

  it('committed / confirmed / done / cancelled 一律不算', () => {
    const orders = ['committed', 'confirmed', 'done', 'cancelled'].map((status, i) =>
      o({ id: `wo${i}`, status }),
    )
    expect(wishesAwaitingReply(orders, [])).toHaveLength(0)
  })

  it('只按**这一件商品**有没有开放价，别的商品的定价不影响它', () => {
    expect(wishesAwaitingReply([o({ itemId: 'b' })], [offer('a')])).toHaveLength(1)
  })
})

describe('wishShelf：兑换列表里该摆哪些心愿', () => {
  const item = (patch: Record<string, unknown>): WishItem =>
    ({ id: 'i1', kind: 'toy', name: '玩具', emoji: '🧸', tint: 'sun', ...patch }) as WishItem
  const offer = (itemId: string, patch: Record<string, unknown> = {}) => ({
    itemId,
    voucherPrice: 30,
    ...patch,
  })
  const noOwned = new Set<string>()

  it('定价了就上架，价格带出来', () => {
    const rows = wishShelf([item({ id: 'a' })], [offer('a', { voucherPrice: 40 })], noOwned, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].price).toBe(40)
  })

  it('没定价 / 价格是 0 → 不上架', () => {
    expect(wishShelf([item({ id: 'a' })], [], noOwned, [])).toHaveLength(0)
    expect(wishShelf([item({ id: 'a' })], [offer('a', { voucherPrice: 0 })], noOwned, [])).toHaveLength(0)
  })

  it('★ 家长关掉的不上架（行还在，只写了 closedAt）', () => {
    const rows = wishShelf([item({ id: 'a' })], [offer('a', { closedAt: 1 })], noOwned, [])
    expect(rows).toHaveLength(0)
  })

  it('★ 已经拥有的游戏盒子不上架', () => {
    // 和心愿页共用 `wishOwnedSet` 的判据 —— 少了这条，孩子会在兑换列表里
    // 看到自己早就换到的游戏，点进去又是「这个游戏你已经有了」。
    const box = item({ id: 'a', kind: 'gamebox', gameId: 'renttower' })
    expect(wishShelf([box], [offer('a')], new Set(['renttower']), [])).toHaveLength(0)
    expect(wishShelf([box], [offer('a')], noOwned, [])).toHaveLength(1)
  })

  it('★ 盲盒池子开完了不上架', () => {
    const box = item({ id: 'a', kind: 'blindbox', pool: ['x', 'y'] })
    expect(wishShelf([box], [offer('a')], new Set(['x', 'y']), [])).toHaveLength(0)
    expect(wishShelf([box], [offer('a')], new Set(['x']), [])).toHaveLength(1)
  })

  it('★ 已经在走流程（committed / confirmed）的不上架', () => {
    // 那件东西已经付过钱了，再列一次等于鼓励孩子换第二遍。
    const rows = wishShelf(
      [item({ id: 'a' })],
      [offer('a')],
      noOwned,
      [{ itemId: 'a', status: 'committed' }],
    )
    expect(rows).toHaveLength(0)
  })

  it('只是 `wished` 的不挡 —— 家长定了价，孩子就该能去换', () => {
    const rows = wishShelf([item({ id: 'a' })], [offer('a')], noOwned, [
      { itemId: 'a', status: 'wished' },
    ])
    expect(rows).toHaveLength(1)
  })

  it('下架（archived）的商品不上架', () => {
    expect(wishShelf([item({ id: 'a', archived: true })], [offer('a')], noOwned, [])).toHaveLength(0)
  })

  it('目录里没有的 id 不上架（商品被删了，开放行还留着）', () => {
    expect(wishShelf([], [offer('gone')], noOwned, [])).toHaveLength(0)
  })

  it('顺序和心愿页一致：盲盒在最前', () => {
    const rows = wishShelf(
      [
        item({ id: 'a', name: '玩具' }),
        // 盲盒必须配 `pool` —— 没配池子等于「开完了」，会被上面那条规则滤掉
        item({ id: 'b', kind: 'blindbox', name: '盲盒', pool: ['x'] }),
      ],
      [offer('a'), offer('b')],
      noOwned,
      [],
    )
    expect(rows.map((r) => r.item.id)).toEqual(['b', 'a'])
  })
})

/* ============================================================
   「还没走完」的两个口径：**故意不相等**
   ------------------------------------------------------------
   2026-10-29 差点把它们「统一」掉。实际是两个不同的读者：
     · 心愿页顶部那张卡 = 家长还要做几件事（`needsParentAction`）
     · 兑换记录 tab 上的数字 = 孩子这一屏还有几件没兑现（`childPending`）
   差的那一条就是「已交付但没收尾的数字商品」：游戏已经在柜子里，
   标签是绿的，再挂个红数字就是自相矛盾（截图走查抓到过）。
   ============================================================ */
describe('「还没走完」的两个口径', () => {
  const cases = [
    { name: 'committed 实物', o: { status: 'committed' }, parent: true, child: true },
    { name: 'confirmed 实物', o: { status: 'confirmed' }, parent: true, child: true },
    {
      name: 'committed 数字商品（已放进柜子）',
      o: { status: 'committed', openedGameId: 'renttower' },
      parent: true,
      child: false,
    },
    {
      name: 'confirmed 数字商品（已放进柜子）',
      o: { status: 'confirmed', openedGameId: 'renttower' },
      parent: true,
      child: false,
    },
    { name: 'done', o: { status: 'done', openedGameId: 'x' }, parent: false, child: false },
    { name: 'cancelled', o: { status: 'cancelled' }, parent: false, child: false },
    { name: 'wished（一分钱没扣）', o: { status: 'wished' }, parent: false, child: false },
  ]

  for (const c of cases) {
    it(`${c.name}：家长待办 ${c.parent} / 孩子徽标 ${c.child}`, () => {
      expect(needsParentAction(c.o), '家长待办').toBe(c.parent)
      expect(childPending(c.o), '孩子徽标').toBe(c.child)
    })
  }

  it('★ 两个口径只在「已交付的数字商品」上分叉', () => {
    const all = cases.map((c) => c.o)
    const differ = all.filter((o) => needsParentAction(o) !== childPending(o))
    expect(differ.length, '只有数字商品那一档不同').toBe(2)
    expect(differ.every((o) => 'openedGameId' in o), '分叉的必须带 openedGameId').toBe(true)
  })
})
