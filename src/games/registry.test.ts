import { describe, expect, it } from 'vitest'
import { DEFAULT_GAME_ID, GAME_FARM } from './ids'
import { GAMES, gameById, ownedByDefault, purchasedIdsFrom } from './registry'
import { GAME_PAGES, pageFor } from './pages'

/* ============================================================
   游戏注册表（插件骨架）
   ------------------------------------------------------------
   这些断言看着像「在测常量」，但它们钉的是**结构约束** ——
   注册表是底部导航、家长栏、拥有关系三处的共同事实源，
   配错了不会报错，只会让界面指向一个不存在的页面。
   ============================================================ */

describe('注册表的结构约束', () => {
  it('id 不重复', () => {
    const ids = GAMES.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('只有一款是「默认已拥有」，而且它就是 DEFAULT_GAME_ID', () => {
    // 兜底值必须指向一款「不用买就有」的游戏 —— 否则 `resolveActiveGame`
    // 兜底之后仍然指向一个没买的游戏，底部导航直接空掉。
    const defaults = GAMES.filter(ownedByDefault)
    expect(defaults).toHaveLength(1)
    expect(defaults[0].id).toBe(DEFAULT_GAME_ID)
    expect(DEFAULT_GAME_ID).toBe(GAME_FARM)
  })

  it('可玩的都有页面，没做的一律拿不到页面', () => {
    // 页面挂在 `pages.ts` 里（注册表是纯数据，不能 import UI —— 否则成环）。
    // 于是「status」和「有没有页面」这两件事在**两个文件**里 ——
    // 这条断言就是把它们钉在一起的那颗钉子。
    // 少了它，忘了挂页面会一直等到孩子点进去看见白屏才被发现。
    for (const g of GAMES) {
      if (g.status === 'available') expect(pageFor(g), `${g.id} 可玩却没挂页面`).toBeTruthy()
      else expect(pageFor(g), `${g.id} 还没做却挂了页面`).toBeNull()
    }
  })

  it('`pages.ts` 里不许有野页面', () => {
    // 映射里有、注册表里没有 → 那个页面永远渲染不到，是一块死代码
    // （多半是游戏下线了但页面没删，或者 id 写错了）。
    const known = new Set(GAMES.map((g) => g.id))
    for (const id of Object.keys(GAME_PAGES)) {
      expect(known.has(id), `pages.ts 里的「${id}」不在注册表里`).toBe(true)
    }
  })

  it('`pageFor` 对空值 / 不存在的游戏安全返回 null', () => {
    expect(pageFor(undefined)).toBeNull()
    expect(pageFor(gameById('不存在'))).toBeNull()
  })

  it('默认已拥有的那款是免费的', () => {
    // 免费 ≠ 默认拥有，但「默认拥有」必须是免费的：不然家长会看到
    // 「已购买」里躺着一款自己没付过钱的游戏。
    for (const g of GAMES.filter(ownedByDefault)) expect(g.priceMall).toBe(0)
  })
})

describe('gameById', () => {
  it('找不到就返回 undefined（调用方必须兜底）', () => {
    expect(gameById('不存在')).toBeUndefined()
    expect(gameById(undefined)).toBeUndefined()
    expect(gameById('')).toBeUndefined()
  })

  it('按 id 找得到', () => {
    expect(gameById(GAME_FARM)?.name).toBe('农场')
  })
})

describe('purchasedIdsFrom（拥有关系从账本派生）', () => {
  it('只认「买游戏的支出」', () => {
    const ids = purchasedIdsFrom([
      { source: 'game_purchase', refId: 'a', delta: -50 },
      // 别的来源一律不算 —— 尤其是手工调整，它不是购买
      { source: 'manual_adjust', refId: 'b', delta: -50 },
      { source: 'redemption_code', refId: 'c', delta: 50 },
      // 没有 refId 的记账不指向任何游戏
      { source: 'game_purchase', delta: -50 },
      // 正数的 game_purchase 是退款，不是购买
      { source: 'game_purchase', refId: 'd', delta: 50 },
    ])
    expect(ids).toEqual(['a'])
  })

  it('同一个游戏买两次只算一次', () => {
    const ids = purchasedIdsFrom([
      { source: 'game_purchase', refId: 'a', delta: -50 },
      { source: 'game_purchase', refId: 'a', delta: -50 },
    ])
    expect(ids).toEqual(['a'])
  })

  it('空账本 = 什么都没买', () => {
    expect(purchasedIdsFrom([])).toEqual([])
  })
})
