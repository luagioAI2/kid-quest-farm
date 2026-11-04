import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { WISH_ITEMS } from '@/games/wishCatalog'
import { WISH_ART_IDS, WishArt } from './WishArt'

/* ============================================================
   商品插画 —— 「文件名对不上就静默退回 emoji」
   ------------------------------------------------------------
   `art/<item_id>.svg` 是**按文件名自动挂载**的。好处是美术给图不用改代码，
   代价是**打错一个字母不报错**：`wish-cak.svg` 会让生日蛋糕继续显示 🍰，
   而所有结构断言都是绿的（它确实渲染了一个图 —— emoji）。

   所以这里钉三件事：
     ① 每张图都能对上一个真实商品（防拼写错误 / 商品改名后遗留的孤儿图）
     ② 九个非游戏商品现在都有插画（防误删）
     ③ 没图 / 图坏了，都要**真的退回 emoji**（而不是留一个空白框）
   ============================================================ */

/** 现在已经有插画的非游戏商品。**下线某张图时改这里**，别让它悄悄退回 emoji。 */
const GOODS_WITH_ART = [
  'wish-blindbox',
  'wish-blindbox-5',
  'wish-popmart',
  'wish-study-pad',
  'wish-dino',
  'wish-puzzle',
  'wish-sticker',
  'wish-cake',
  'wish-zoo',
]

describe('商品插画', () => {
  it('每张图的文件名都对得上一个真实商品', () => {
    const ids = new Set(WISH_ITEMS.map((i) => i.id))
    const orphans = WISH_ART_IDS.filter((id) => !ids.has(id))
    expect(orphans, `这些图没有对应商品（item_id 拼错了？）：${orphans.join(', ')}`).toEqual([])
  })

  it('★ 九个非游戏商品都有插画', () => {
    const missing = GOODS_WITH_ART.filter((id) => !WISH_ART_IDS.includes(id))
    expect(missing, `这些商品还没有插画：${missing.join(', ')}`).toEqual([])
  })

  it('有插画时渲染 <img>，不再是 emoji', () => {
    const { container } = render(<WishArt itemId="wish-cake" emoji="🍰" className="h-full w-full" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    /**
     * ⚠️ 别断言 `src` 里含文件名：小于 4 KB 的图会被 Vite **内联成 data URL**
     *    （`build.assetsInlineLimit` 的默认值），这时 src 是一整段 `data:image/svg+xml,…`，
     *    文件名根本不在里面 —— 断言「含 wish-cake」会红，但功能是好的。
     */
    const src = img!.getAttribute('src') ?? ''
    expect(src.startsWith('data:image/svg+xml') || src.includes('wish-cake')).toBe(true)
    // 有图就不该再画 emoji（两个一起画会叠在一起，而结构断言照样过）
    expect(screen.queryByText('🍰')).toBeNull()
  })

  it('没有插画时退回 emoji', () => {
    render(<WishArt itemId="wish-不存在" emoji="🎈" emojiClassName="text-3xl" />)
    expect(screen.getByText('🎈')).toBeTruthy()
  })

  it('传了 fallback（游戏图标）时优先用 fallback，不是 emoji', () => {
    render(
      <WishArt
        itemId="wish-game-nope"
        emoji="🎮"
        fallback={<span>手绘图标</span>}
      />,
    )
    expect(screen.getByText('手绘图标')).toBeTruthy()
    expect(screen.queryByText('🎮')).toBeNull()
  })

  it('★ 图加载失败要退回 emoji —— 不留一个空白框', () => {
    const { container } = render(<WishArt itemId="wish-cake" emoji="🍰" />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    fireEvent.error(img!)
    expect(screen.getByText('🍰')).toBeTruthy()
    expect(container.querySelector('img')).toBeNull()
  })
})
