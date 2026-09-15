/**
 * 回归测试：长期任务（周 / 月 / 年）的**孩子端**不许自评质量。
 *
 * 对应的事故（用户报的）：
 *   「长期任务 孩子 做完确认时 为啥能自己评价和打分。」
 *
 * 普通任务早就改成了「孩子只提交，质量分由家长给」
 * （`TaskDetail.handleSubmit` 里那句 `submitInstance(inst.id, mins, undefined, …)`），
 * 但长期任务那张表漏了 —— 孩子能自己选「一般 / 不错 / 特别棒」，
 * 而且「+N 分」的预览就摆在确认按钮上面，点一下就知道自己能拿多少分。
 * 家长审核于是成了走过场。
 *
 * 为什么在 jsdom 里测：这是**渲染结构**问题 ——
 * 质量按钮在不在 DOM 里，渲染出来就能判，不用真浏览器。
 * （真浏览器的走查由 scripts/capture.mjs 那套截图兜底。）
 *
 * ⚠️ 最后一条是**对照组**：拿一份「旧版」标记渲染，
 * 证明上面几条断言确实抓得住这个缺陷，而不是恰好没触发。
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Task } from '@/domain/types'
import { QUALITY_META } from './ui'
import { OnceSubmitSheet } from './TaskPage'

function periodTask(): Task {
  return {
    id: 't_period',
    title: '每周读一本书',
    category: 'study',
    cycle: 'weekly',
    plannedMinutes: 30,
    basePoints: 20,
    qualityBonusPoints: 10,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
    rewardItemIds: [],
    createdAt: 0,
    updatedAt: 0,
  }
}

/** 旧版（有自评）的标记 —— 只保留能触发这几条断言的那部分 */
function LegacyOnceSubmitSheet() {
  return (
    <div role="dialog">
      <p>用了多久？</p>
      <p>做得怎么样？</p>
      {(Object.keys(QUALITY_META) as Array<keyof typeof QUALITY_META>).map((q) => (
        <button key={q} type="button">
          {QUALITY_META[q].emoji} {QUALITY_META[q].label}
        </button>
      ))}
      <button type="button">提交</button>
    </div>
  )
}

/**
 * 表里所有按钮的文字。
 *
 * ⚠️ 别用 `queryByText('特别棒')` 判质量按钮在不在 —— 按钮里是
 * `{emoji} {label}` 两个文本节点，`getByText` 拿整个元素做精确匹配，
 * 会**恒返回 null**：断言永远绿，等于没测。
 * （这条就是被下面的对照组抓出来的 —— 第一版就是这么写的。）
 */
function buttonTexts(): string[] {
  return screen.getAllByRole('button').map((b) => (b.textContent ?? '').trim())
}

const QUALITY_LABEL_RE = /一般|不错|特别棒/

describe('长期任务：孩子端不许自评质量', () => {
  it('表里没有质量自评按钮', () => {
    render(<OnceSubmitSheet task={periodTask()} onCancel={() => {}} onConfirm={() => {}} />)

    expect(screen.queryByText('做得怎么样？')).toBeNull()
    expect(buttonTexts().filter((t) => QUALITY_LABEL_RE.test(t))).toEqual([])
  })

  it('确认按钮是「完成确认」，且明说要去等爸爸妈妈看一眼', () => {
    render(<OnceSubmitSheet task={periodTask()} onCancel={() => {}} onConfirm={() => {}} />)

    expect(screen.getByRole('button', { name: '完成确认' })).toBeInTheDocument()
    // 得分预览只能说「大约」—— 质量分还没定
    expect(screen.getByText(/确认后大约能拿到/)).toBeInTheDocument()
    expect(screen.getByText(/爸爸妈妈看一眼确认之后/)).toBeInTheDocument()
  })

  it('「完成确认」只把用时交出去 —— 第二个参数不是质量分', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    render(<OnceSubmitSheet task={periodTask()} onCancel={() => {}} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: '完成确认' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const args = onConfirm.mock.calls[0]
    expect(args).toHaveLength(1)
    expect(typeof args[0]).toBe('number')
    // 关键：没有第二个「质量分」参数。哪怕有人把签名改回去，这条也会红。
    expect(args[1]).toBeUndefined()
  })

  it('「取消」不提交', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<OnceSubmitSheet task={periodTask()} onCancel={onCancel} onConfirm={onConfirm} />)

    await user.click(screen.getByRole('button', { name: '取消' }))

    expect(onCancel).toHaveBeenCalled()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  /**
   * 结构断言：底部两键都要 `w-full`（各占一半）。
   *
   * 这是**真实踩过的**：原来只有右边那个带 `full`，
   * 左边「取消」被挤成竖排的「取 / 消」（截图 04b 一眼就看出来了）。
   * 两个字的「提交」时还看不出来 —— 换成四个字的「完成确认」才露馅。
   *
   * jsdom 不做布局，量不出「有没有换行」，但能锁住**结构特征**：
   * 两个按钮是不是都拿了 `w-full`。（真浏览器的行盒测量见
   * scripts/e2e-check.mjs 里那两条「并排 / 没被挤成竖排」。）
   */
  it('底部两个按钮各占一半（只给一个 w-full 会把另一个挤成竖排）', () => {
    render(<OnceSubmitSheet task={periodTask()} onCancel={() => {}} onConfirm={() => {}} />)

    const cancel = screen.getByRole('button', { name: '取消' })
    const row = cancel.parentElement
    if (!row) throw new Error('取消按钮应该有父容器')
    const btns = [...row.querySelectorAll('button')]
    expect(btns).toHaveLength(2)
    for (const b of btns) {
      expect(b.className).toContain('w-full')
    }
  })

  /**
   * 对照组：把**旧版**（带自评）渲染出来，上面那几条断言必须**抓得住**。
   *
   * 没有这一条的话，「查不到『特别棒』」可能只是因为查询字符串写错了、
   * 或者整个表根本没渲染 —— 那种情况下上面几条会永远绿，等于没测。
   */
  it('对照组：旧版的自评按钮确实会被这几条断言抓住', () => {
    render(<LegacyOnceSubmitSheet />)

    expect(screen.getByText('做得怎么样？')).toBeInTheDocument()
    const hit = buttonTexts().filter((t) => QUALITY_LABEL_RE.test(t))
    expect(hit).toHaveLength(3)
  })
})
