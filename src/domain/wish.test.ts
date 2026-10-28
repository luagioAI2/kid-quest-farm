import { describe, expect, it } from 'vitest'
import {
  blindBoxRemaining,
  compareWishItem,
  daysToSave,
  pickBlindBox,
  planWishRedeem,
  redeemedGameIdsFrom,
} from './wish'

/* ============================================================
   心愿商城的纯逻辑
   ------------------------------------------------------------
   这三块出错都是**静默**的，所以必须有单测钉住：

   * `planWishRedeem` —— 差一张也算「够」的话，孩子会点到一个换不了的按钮
   * `blindBoxRemaining` —— 漏掉「已拥有」会开出重复的游戏（而且不报错）
   * `pickBlindBox` —— 池子空了还返回东西，就会「先扣券再发现没得开」
   ============================================================ */

describe('planWishRedeem：够不够', () => {
  it('刚好够', () => {
    expect(planWishRedeem(30, 30)).toEqual({ affordable: true, shortfall: 0, price: 30 })
  })

  it('差一张就不够 —— 不能四舍五入成「够」', () => {
    const r = planWishRedeem(30, 29)
    expect(r.affordable).toBe(false)
    expect(r.shortfall).toBe(1)
  })

  it('多出来的券不会被「花掉」—— price 只记标价', () => {
    expect(planWishRedeem(30, 500).price).toBe(30)
  })

  it('负数 / 小数一律兜住，不让它们渗进账本', () => {
    expect(planWishRedeem(-10, 5).price).toBe(0)
    expect(planWishRedeem(30.4, 30.4)).toEqual({ affordable: true, shortfall: 0, price: 30 })
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

describe('pickBlindBox：开奖', () => {
  it('池子空了返回 null —— 调用方必须先判这个再扣券', () => {
    expect(pickBlindBox(['a', 'b'], ['a', 'b'])).toBeNull()
  })

  it('注入 rand 能钉死结果（测试不靠 Math.random）', () => {
    expect(pickBlindBox(['a', 'b', 'c'], [], () => 0)).toBe('a')
    expect(pickBlindBox(['a', 'b', 'c'], [], () => 0.99)).toBe('c')
  })

  it('永远不会开出已拥有的', () => {
    const owned = ['a', 'b', 'c', 'd']
    for (let i = 0; i < 200; i++) {
      const got = pickBlindBox(['a', 'b', 'c', 'd', 'e'], owned)
      expect(got).toBe('e')
    }
  })

  it('rand 返回 1（越界）也不会崩', () => {
    expect(pickBlindBox(['a', 'b'], [], () => 1)).toBe('b')
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
