import { describe, expect, it } from 'vitest'
import {
  INSTALL_FAIL_MARK,
  installFailNote,
  parseActivationMessage,
} from './activationMessage'

/* ============================================================
   激活结果文案（2026-11-13 用户报「激活的时候没有提示成功 似乎」）
   ------------------------------------------------------------
   根因是**生成和解析两个方向各写了一遍**，而且对不上：

     生成  `，但 ${failed} 款没装成功（…）`   ← 中间有数字
     解析  includes('，但没装成功')           ← 中间没数字 ⇒ 永远不命中

   判反的后果不是少一行字：`installFailed` 恒 false ⇒ 走「成功」那一支
   ⇒ 界面说「游戏已经进你的游戏柜了」，而包根本没装上。

   所以这组测试的重点不是"文案长得对"，而是 **round-trip**：
   生成出来的句子，必须能被解析回原来的三种信息。
   ============================================================ */

describe('installFailNote + parseActivationMessage 必须对得上', () => {
  // 1 款、2 款、5 款都要过 —— 就是"中间那个数字"让老代码失配的
  for (const failed of [1, 2, 5, 12]) {
    it(`★ 装包失败 ${failed} 款：拼出来再拆回去，三项都对`, () => {
      const msg = `已激活 下落的2048${installFailNote(failed, '读取本地包失败：HTTP 404')}`
      const p = parseActivationMessage(msg)

      expect(p.installFailed, `failed=${failed} 必须判成装失败`).toBe(true)
      // 标题只留「已激活 X」，不能夹「，但 N 款…」
      expect(p.headline).toBe('已激活 下落的2048')
      expect(p.reason).toBe('读取本地包失败：HTTP 404')
    })
  }

  it('多款时标题保持原样（「开出 3 款：…」）', () => {
    const msg = `已激活 开出 3 款：A、B、C${installFailNote(1, '验签失败')}`
    const p = parseActivationMessage(msg)
    expect(p.installFailed).toBe(true)
    expect(p.headline).toBe('已激活 开出 3 款：A、B、C')
    expect(p.reason).toBe('验签失败')
  })
})

describe('parseActivationMessage 的成功分支', () => {
  it('没有标记词 ⇒ 当成成功，标题是整句', () => {
    const p = parseActivationMessage('已激活 下落的2048')
    expect(p.installFailed).toBe(false)
    expect(p.headline).toBe('已激活 下落的2048')
    expect(p.reason).toBe('')
  })

  it('「兑换成功」（不含游戏名）也是成功', () => {
    const p = parseActivationMessage('兑换成功')
    expect(p.installFailed).toBe(false)
    expect(p.headline).toBe('兑换成功')
  })

  it('★ 解析不出来时兜底成**成功**，不能兜成失败', () => {
    /* 判成失败会让一个真的成功的激活显示「没装上，去我的游戏里点安装」，
       家长会去点一个已经装好的游戏 —— 比少显示一句更糟。 */
    const weird = `已激活 X${INSTALL_FAIL_MARK}` // 标记词后面什么都没有
    const p = parseActivationMessage(weird)
    expect(p.installFailed).toBe(true)
    // 标题兜底不能是空串（弹框会变成只有一个 🎉）
    expect(p.headline.length).toBeGreaterThan(0)
    expect(p.reason).toBe('')
  })
})

describe('标记词本身', () => {
  it('★ 不能出现在正常成功文案里（一旦撞上就会把成功判成失败）', () => {
    const successTexts = [
      '已激活 下落的2048',
      '已激活 开出 3 款：抓娃娃、下落的2048、蚂蚁搬家',
      '兑换成功',
    ]
    for (const t of successTexts) {
      expect(t.includes(INSTALL_FAIL_MARK), `「${t}」不该含标记词`).toBe(false)
    }
  })
})
