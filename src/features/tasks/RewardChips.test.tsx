import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { RewardChips } from './ui'

/* ============================================================
   任务奖励的显示（2026-11-14）
   ------------------------------------------------------------
   用户原话：「任务奖励那 显示类型图标或者彩带（现在不够明显）。」

   原来是一串裸 emoji 塞在 11px 的小字行里，和「⏰ 20 分钟」「🪙 30 分」
   同一个视觉权重 —— 奖励是最该被孩子看见的，却最看不见。

   这里钉三件事（都只能靠**类名/结构**验，jsdom 不算布局）：
     ① 外面有彩带（底色 + 🎁），不是裸 emoji；
     ② 每个奖励是**带底色的标签**，且标了类型（seed / animal / item）；
     ③ 类型不同 ⇒ 颜色不同（不然「类型图标」等于没做）。
   ============================================================ */

const wrap = (ids: string[]) => {
  const { container } = render(<RewardChips itemIds={ids} />)
  return container
}

describe('★ 奖励要显眼（彩带 + 类型色）', () => {
  it('外面裹一条彩带，带 🎁（「有奖励」这件事先跳出来）', () => {
    const c = wrap(['seed-carrot'])
    const band = c.querySelector('[data-reward-chips]')
    expect(band, '没有彩带外壳').toBeTruthy()
    expect(band!.textContent).toContain('🎁')
  })

  it('每个奖励是带底色的标签，不是裸 emoji', () => {
    const c = wrap(['seed-carrot', 'baby-chicken'])
    const items = c.querySelectorAll('[data-reward-item]')
    expect(items).toHaveLength(2)
    for (const el of items) {
      // 有 border + 圆角 = 是个「标签」，不是一串字符
      expect(el.className).toMatch(/rounded-pill/)
      expect(el.className).toMatch(/\bborder\b/)
      // 有底色（Tailwind 的 bg-* 类）
      expect(el.className).toMatch(/\bbg-/)
    }
  })

  it('★ 类型标出来了（种子 / 动物 / 道具）', () => {
    const c = wrap(['seed-carrot', 'baby-chicken', 'seed-corn'])
    const kinds = [...c.querySelectorAll('[data-reward-item]')].map((e) =>
      e.getAttribute('data-reward-kind'),
    )
    expect(kinds).toEqual(['seed', 'animal', 'seed'])
  })

  it('★ 不同类型用不同颜色（否则「类型图标」等于没做）', () => {
    const c = wrap(['seed-carrot', 'baby-chicken'])
    const [seed, animal] = [...c.querySelectorAll('[data-reward-item]')] as HTMLElement[]
    const seedBg = seed.className.match(/bg-[\w-]+/)?.[0]
    const animalBg = animal.className.match(/bg-[\w-]+/)?.[0]
    expect(seedBg).toBeTruthy()
    expect(animalBg).toBeTruthy()
    expect(seedBg, `种子和动物用了同一个底色 ${seedBg}`).not.toBe(animalBg)
  })

  it('没有奖励时整块不渲染（别留一条空彩带）', () => {
    const c = wrap([])
    expect(c.querySelector('[data-reward-chips]')).toBeNull()
  })

  it('超过 max 个时显示 +N（不把一行撑爆）', () => {
    const c = wrap(['seed-carrot', 'seed-corn', 'seed-radish', 'baby-chicken'])
    expect(c.querySelectorAll('[data-reward-item]')).toHaveLength(3)
    expect(c.textContent).toContain('+1')
  })
})
