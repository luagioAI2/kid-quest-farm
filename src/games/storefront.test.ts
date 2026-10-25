import { describe, expect, it } from 'vitest'
import { LOCAL_GAMES } from './localGames'
import { GAME_KINDS, GAME_KIND_ORDER } from './kind'
import { STOREFRONT, storefrontOf } from './storefront'

/**
 * 游戏市场内容的护栏。
 *
 * 这一层最容易出的错是**静默的**：新加一款包但忘了写介绍 ⇒ 市场里少一款，
 * 界面上没有任何报错，家长只会觉得「怎么只有三个」。所以这里用清单反查两遍
 * （包 → 介绍、介绍 → 包），把「漏了」变成一条红。
 */
describe('游戏市场的内容', () => {
  it('每个随 App 发的包都有介绍 —— 否则市场里会静默少一款', () => {
    for (const g of LOCAL_GAMES) {
      expect(storefrontOf(g.id), `缺 ${g.id} 的介绍`).not.toBeNull()
    }
  })

  it('介绍里没有多余的 id —— 那些永远渲染不出来', () => {
    const ids = new Set(LOCAL_GAMES.map((g) => g.id))
    for (const e of STOREFRONT) {
      expect(ids.has(e.id), `${e.id} 不在 LOCAL_GAMES 里`).toBe(true)
    }
  })

  it('每一款都归到已知分类', () => {
    for (const e of STOREFRONT) {
      expect(GAME_KIND_ORDER, `${e.id} 的分类是 ${e.kind}`).toContain(e.kind)
    }
  })

  it('两个分类的标题和说明都不能空（空分类不渲染，但文案不能缺）', () => {
    for (const k of GAME_KIND_ORDER) {
      expect(GAME_KINDS[k].label.trim().length, k).toBeGreaterThan(1)
      expect(GAME_KINDS[k].note.trim().length, k).toBeGreaterThan(8)
    }
  })

  it('「练什么」不能空，也不能是一句空话 —— 家长就看这一栏', () => {
    for (const e of STOREFRONT) {
      expect(e.learn.length, e.id).toBeGreaterThan(0)
      for (const line of e.learn) {
        // 太短的条目基本等于没写（「好玩」「很有趣」这类）
        expect(line.trim().length, `${e.id}: ${line}`).toBeGreaterThan(6)
      }
    }
  })

  it('分类顺序固定，不依赖对象键序', () => {
    expect(GAME_KIND_ORDER).toEqual(['think', 'play'])
  })
})
