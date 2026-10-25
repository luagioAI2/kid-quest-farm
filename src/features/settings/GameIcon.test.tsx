import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { GAME_ART_IDS, GameIconArt } from './GameIcon'
import { STOREFRONT } from '../../games/storefront'
import { GAMES } from '../../games/registry'

/* ============================================================
   游戏图标 —— 守的是「每一款都有自己的那一支」，不是「好不好看」。

   为什么需要这一层（走查图盖不住的两件事）：

   1. **漏了一支不会报错**。`ART` 里没有这个 id 就走兜底那支（摇杆），
      界面照常渲染、控制台干干净净，只有人看出来「抓娃娃的图标是个摇杆」。
   2. **抄了一支忘了改**。复制 `PrizePark` 改成新游戏，忘了换里面的路径 ⇒
      两款游戏长得一模一样，同样不报错。

   两条都能用「四支的 SVG 各不相同」抓出来：漏了就是两支兜底（相同），
   抄了就是两支原样（相同）。

   ⚠️ 必须有**正向对照**：先断言 `GAME_ART_IDS` 至少有 4 条。否则哪天
      `ART` 被清空，「每一款都在里面」会红得很好看，但「各不相同」会因为
      一个都渲染不出来而空转。
   ============================================================ */

/**
 * 取「主体」那一组图形（`<svg>` 下第一个 `<g>`）。
 *
 * ⚠️ **不能比整段 `innerHTML`**：渐变 id 里带着游戏 id（`gi-claw3d-sky-bg`），
 * 所以两支主体画得一模一样，字符串也照样不同 ⇒ 「各不相同」那条会假绿。
 * 2026-10-25 实测：把 claw3d 指到 `PrizePark` 上，整段比对的版本**5 条全过**。
 *
 * 统一用同一个 tint 渲染，否则 `deep` 不同又会把差异带进来。
 */
const drawArt = (id: string, tint: 'grass' | 'sky' | 'sun' | 'berry' = 'sky') => {
  const { container } = render(<GameIconArt id={id} tint={tint} />)
  return container.querySelector('svg > g')?.innerHTML ?? ''
}

const draw = (id: string, tint?: 'grass' | 'sky' | 'sun' | 'berry') => {
  const { container } = render(<GameIconArt id={id} tint={tint} />)
  return container.innerHTML
}

describe('游戏图标', () => {
  it('★ 每一款在售的游戏都有专属图形（不是兜底那支）', () => {
    // 正向对照：表里真的有几支，而不是空表让下面全绿
    expect(GAME_ART_IDS.length).toBeGreaterThanOrEqual(4)

    const ids = [...STOREFRONT.map((g) => g.id), ...GAMES.map((g) => g.id)]
    expect(ids.length).toBeGreaterThanOrEqual(4)
    const missing = ids.filter((id) => !GAME_ART_IDS.includes(id))
    expect(missing, `这些游戏没有专属图标：${missing.join(', ')}`).toEqual([])
  })

  it('★ 各支主体互不相同（抄一支忘了改会在这里红）', () => {
    const art = GAME_ART_IDS.map((id) => drawArt(id))
    // 正向对照：真的画出了东西（否则下面「都不相同」会因为全是空串而……也红，
    // 但红得莫名其妙，不如先把「非空」这一条摆出来）
    expect(art.every((s) => s.length > 50), '有主体没画出来').toBe(true)
    const dup = art.find((s, i) => art.indexOf(s) !== i)
    expect(dup, '有两支主体一模一样').toBeUndefined()
  })

  it('不认识的游戏落到兜底，而且兜底和四支都不一样', () => {
    const fallback = drawArt('some-future-plugin')
    expect(fallback.length).toBeGreaterThan(50)
    for (const id of GAME_ART_IDS) {
      expect(drawArt(id), `${id} 的图形和兜底撞了`).not.toBe(fallback)
    }
  })

  it('渐变 id 按游戏区分（同页出现两款时颜色不会串）', () => {
    const { container } = render(
      <>
        {GAME_ART_IDS.map((id) => (
          <GameIconArt key={id} id={id} />
        ))}
      </>,
    )
    const ids = [...container.querySelectorAll('linearGradient')].map((n) => n.id)
    expect(ids.length).toBe(GAME_ART_IDS.length * 2) // 每支一个底色 + 一个顶光
    expect(new Set(ids).size, `渐变 id 有重复：${ids.join(', ')}`).toBe(ids.length)
  })

  it('换底色不改主体（同一款游戏在两个 tint 下不是同一张图）', () => {
    const a = draw('prizepark', 'berry')
    const b = draw('prizepark', 'grass')
    expect(a).not.toBe(b)
    // 主体那部分仍在：礼物盒的丝带色 #FF5C8A 两种底色下都该有
    expect(a).toContain('#FF5C8A')
    expect(b).toContain('#FF5C8A')
  })
})
