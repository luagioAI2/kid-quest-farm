/**
 * 「数据已恢复」后面那半句 —— 拼出来的中文串
 * ------------------------------------------------------------
 * 2026-10-30 一天里在同一个函数上栽了三次，每次都是**真跑一次**才看见：
 *
 *   ① 「但」后面多一个空格（`但 「X」`）
 *   ② 「等」前面多一个空格（`「C」 等 5 款`）
 *   ③ 整句要 367px，而 toast 那行只有 275px —— 被切掉的正好是
 *      「要去「游戏」页重新装一次」，家长唯一能照着做的那半句
 *
 * 前两次是「读起来不像人话」，第三次是「根本读不到」。所以这里守三件事：
 *
 *   · 三个分支（都装回来 / 部分成功 / 全失败）各说各的，别混
 *   · 中文之间不留空格
 *   · **带名字的那条要短到塞得进一行**（下面有字数上限，来源见注释）
 */
import { describe, expect, it } from 'vitest'
import { restoreTail } from './useApp'

/** 中文串里不该出现的空格：紧跟在这些字/符号后面的那个 */
const BAD_SPACE = [/但\s/, /」\s+去/, /」\s+等/, /款\s+，/, /^\s/]

describe('恢复提示的后半句', () => {
  it('都装回来：只说款数', () => {
    expect(restoreTail(2, [])).toBe('；游戏装回 2 款')
  })

  it('一款都没装上：点名字，且不出现「装回 0 款」', () => {
    const tail = restoreTail(0, ['蚂蚁搬家'])
    expect(tail).toBe('；「蚂蚁搬家」去「游戏」页重装')
    expect(tail).not.toContain('0 款')
  })

  it('★ 部分成功：先说没装回来的，不再报款数', () => {
    /* 2026-10-30 量过：带款数那句要 367px、可见只有 275px，
       被切掉的正是「去「游戏」页重装」。款数只是安慰，动作才是信息。 */
    expect(restoreTail(2, ['蚂蚁搬家'])).toBe('；「蚂蚁搬家」去「游戏」页重装')
    expect(restoreTail(2, ['蚂蚁搬家'])).not.toContain('装回')
  })

  it('什么都没发生：不返回一个孤零零的分号', () => {
    expect(restoreTail(0, [])).toBe('')
  })

  it('超过三款只点前三款，后面说总数', () => {
    const tail = restoreTail(0, ['A', 'B', 'C', 'D', 'E'])
    expect(tail).toContain('「A」、「B」、「C」')
    expect(tail).not.toContain('「D」')
    expect(tail).toContain('等 5 款')
  })

  it('★ 中文之间不留空格（这处栽过两次）', () => {
    const cases: [number, string[]][] = [
      [2, []],
      [0, ['蚂蚁搬家']],
      [2, ['蚂蚁搬家']],
      [0, ['A', 'B', 'C', 'D']],
      [3, ['A', 'B', 'C', 'D', 'E']],
    ]
    for (const [putBack, names] of cases) {
      const tail = restoreTail(putBack, names)
      for (const re of BAD_SPACE) {
        expect(re.test(tail), `「${tail}」里有多余空格（${re}）`).toBe(false)
      }
    }
  })

  it('★ 带一个真实名字时要短到塞得进一行', () => {
    /* 预算怎么来的（别凭感觉改）：
         toast 说明那行在 390 宽的视口里只有 275px，中文字约 13.6px 一个
         ⇒ 约 20 个字。实测「游戏装回 1 款，但「抓奖乐园」要去「游戏」页
         重新装一次」是 27 字 / 367px，被截断。
       四字名字 + 这段措辞现在是 17 字，留了余量。 */
    const tail = restoreTail(1, ['抓奖乐园'])
    expect(tail.length, `「${tail}」${tail.length} 字，超过 20 会在一行里被截断`).toBeLessThanOrEqual(20)
  })
})
