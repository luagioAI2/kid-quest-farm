/**
 * 回归测试：盖住整屏的弹层必须跳出页面外壳。
 *
 * 对应的事故（memory/2026-09-14.md §18.3 那一类）：
 * 页面外壳 `<main className="anim-fade-in">` 带一个 opacity 动画，
 * 浏览器会把「正在做 opacity 动画」的元素当成**层叠上下文**，
 * 于是留在它里面的弹层永远压不过底部导航 —— 弹层底部那个大按钮
 * 被导航整个盖掉（实测按钮 759→803px，导航从 750px 开始），孩子点不到。
 *
 * 为什么要在 jsdom 里测：这个 bug 是「层叠上下文」问题，jsdom 不做布局、
 * 也排不了 z-index，**渲染出来看是对的**。但它有一个确定的**结构特征**：
 * 弹层是不是页面外壳的后代。断言结构就能守住，不用真跑浏览器。
 * （真浏览器的行为由 scripts/_probe-overlay.mjs 那类探针验，但那是临时的。）
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Portal } from './Portal'
import { Sheet } from '@/features/tasks/ui'
import { BottomSheet } from '@/features/farm/farmUi'

describe('弹层必须 Portal 到 body', () => {
  it('Sheet 渲染在页面外壳外面', () => {
    const { container } = render(
      <div id="shell">
        <main className="anim-fade-in">
          <Sheet open onClose={() => {}} labelledBy="t">
            <p>任务详情内容</p>
          </Sheet>
        </main>
      </div>,
    )

    const dialog = screen.getByRole('dialog')
    // 这三条一起看才有意义：不在外壳里、不在 render 的容器里、直接挂在 body 下
    expect(dialog.closest('#shell')).toBeNull()
    expect(container.contains(dialog)).toBe(false)
    expect(dialog.parentElement).toBe(document.body)
  })

  it('BottomSheet 渲染在页面外壳外面', () => {
    render(
      <div id="shell2">
        <main className="anim-fade-in">
          <BottomSheet open title="测试弹层" onClose={() => {}}>
            <p>农场内容</p>
          </BottomSheet>
        </main>
      </div>,
    )

    const node = screen.getByText('农场内容')
    expect(node.closest('#shell2')).toBeNull()
    expect(node.closest('main')).toBeNull()
  })

  it('Portal 把子节点直接挂在 body 下', () => {
    render(
      <div id="shell3">
        <Portal>
          <p>跳出外壳</p>
        </Portal>
      </div>,
    )
    const node = screen.getByText('跳出外壳')
    expect(node.closest('#shell3')).toBeNull()
    expect(node.parentElement).toBe(document.body)
  })

  it('没打开的时候什么都不渲染', () => {
    render(
      <Sheet open={false} onClose={() => {}}>
        <p>不该出现</p>
      </Sheet>,
    )
    expect(screen.queryByText('不该出现')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  /**
   * 对照组：不加 Portal 时，弹层**确实**会被关在外壳里。
   *
   * 这条不是测产品代码，是测上面那几条断言「有没有鉴别力」——
   * 如果没有它，`closest('#shell')` 恒为 null（比如选择器写错了、
   * 或者外壳 id 根本没渲染出来），上面几条会永远绿，等于没测。
   */
  it('对照组：不套 Portal 就会被关在外壳里（证明断言有鉴别力）', () => {
    render(
      <div id="shell4">
        <main className="anim-fade-in">
          <div role="dialog">裸弹层</div>
        </main>
      </div>,
    )
    const bare = screen.getByRole('dialog')
    expect(bare.closest('#shell4')).not.toBeNull()
  })
})
