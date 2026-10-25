import { describe, expect, it } from 'vitest'
import { CURRENCY } from './currency'

/**
 * 三套币的**显示口径**守卫。
 *
 * 这个文件的存在理由不是「测一个常量」，而是锁住两个**已经真的出过事**的坑：
 *
 * ① **三个图标必须互不相同** —— 付款行是「图标 + 数字」并排的
 *    （`🎫 30 + 🪙 20`），图标重了就看不出在付哪种币。
 *    2026-10-16 就撞过：`🎟️` 和 `🎫` 是两张票、只差一个存根，16px 下分不开。
 *
 * ② **coupon 不许再用红票根 `🎟️`** —— 2026-10-24 用户原话：
 *    「兑换券图标红色不太好，换个图标吧，感觉怪怪的」。
 *    `🎟️` 在 Windows / Apple 的 emoji 字体里都是一整块红色，16px 下就是颗红疙瘩。
 *    这条断言是为了**别在下次「统一一下图标」时又换回去**。
 */
describe('三套币的显示口径', () => {
  const all = Object.entries(CURRENCY)

  it('三个图标互不相同（付款行会把它们并排放）', () => {
    const emojis = all.map(([, v]) => v.emoji)
    expect(new Set(emojis).size).toBe(emojis.length)
  })

  it('★ 兑换券不再用红票根 🎟️（用户 2026-10-24 明确否掉）', () => {
    // U+1F39F（可带 U+FE0F 变体选择符）
    expect(CURRENCY.coupon.emoji).not.toMatch(/\u{1F39F}/u)
  })

  it('每个图标都是一个真 emoji，不是空串或占位符', () => {
    for (const [id, def] of all) {
      expect(def.emoji.length, `${id} 的图标是空的`).toBeGreaterThan(0)
      expect(def.name.length, `${id} 没有显示名`).toBeGreaterThan(0)
      // 至少一个 astral 平面的码位 —— 防止有人写成 "ticket" 这种文字
      expect(/\p{Extended_Pictographic}/u.test(def.emoji), `${id} 的图标不是 emoji`).toBe(true)
    }
  })
})
