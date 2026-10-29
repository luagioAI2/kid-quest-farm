/**
 * 设置页的「家长密码」卡：改密码必须输两遍
 * ------------------------------------------------------------
 * 2026-10-30。原来这里是**一个输入框 + 预填当前密码**，按一下保存就落库 ——
 * 而这个密码**没有找回入口**，而且「数据」栏（导出备份）也在它后面，
 * 输错一位就等于把孩子所有记录锁死，连自救都做不到。
 *
 * 「第一次设密码」那条路（`ParentGate` 的 `PinFlow`）一直是输两遍的，
 * 同一个凭据两条路口径不一致 —— 这一组守的就是「改成两遍」这件事，
 * 以及「不再预填当前密码」。
 *
 * ⚠️ 这些断言守的是**分叉**，不是文案：
 *   · 两次不一致时**绝不能**调 `onSave`（假绿最可能的形态）
 *   · 不足 4 位时按钮必须是 disabled
 *   · 有密码才出现「清空」按钮
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PinSetting } from './SettingsPage'

const setup = (over: Partial<Parameters<typeof PinSetting>[0]> = {}) => {
  const onSave = vi.fn()
  const onClear = vi.fn()
  render(<PinSetting hasPin onSave={onSave} onClear={onClear} {...over} />)
  return { onSave, onClear }
}

const box = (sel: string) => document.querySelector(sel) as HTMLInputElement

describe('家长密码：改密码要输两遍', () => {
  it('★ 不预填当前密码（两个框都是空的）', () => {
    setup({ hasPin: true })
    expect(box('[data-pin-new]').value, '不许把当前密码明文摆出来').toBe('')
    expect(box('[data-pin-again]').value).toBe('')
  })

  it('★ 两次不一样：报错、清空、绝不落库', async () => {
    const user = userEvent.setup()
    const { onSave } = setup({ hasPin: true })

    await user.type(box('[data-pin-new]'), '1234')
    await user.type(box('[data-pin-again]'), '1235')
    await user.click(screen.getByRole('button', { name: '修改密码' }))

    expect(screen.getByText('两次不一样，重新输一次吧')).toBeInTheDocument()
    expect(onSave, '不一致绝不能落库').not.toHaveBeenCalled()
    // 回到空，而不是留着两个不一致的值让人再点一次
    expect(box('[data-pin-new]').value).toBe('')
    expect(box('[data-pin-again]').value).toBe('')
  })

  it('两次一致才落库', async () => {
    const user = userEvent.setup()
    const { onSave } = setup({ hasPin: true })

    await user.type(box('[data-pin-new]'), '2580')
    await user.type(box('[data-pin-again]'), '2580')
    await user.click(screen.getByRole('button', { name: '修改密码' }))

    expect(onSave).toHaveBeenCalledWith('2580')
    // 存完就清空，别把刚设的密码留在屏幕上
    expect(box('[data-pin-new]').value).toBe('')
  })

  it('不足 4 位时按钮不可点（3 位也算不足）', async () => {
    const user = userEvent.setup()
    setup({ hasPin: false })

    await user.type(box('[data-pin-new]'), '123')
    await user.type(box('[data-pin-again]'), '123')
    expect(screen.getByRole('button', { name: '设置密码' })).toBeDisabled()
  })

  it('清空按钮只在「已有密码」时出现，点了走 onClear', async () => {
    const user = userEvent.setup()
    const { onClear } = setup({ hasPin: true })

    await user.click(screen.getByRole('button', { name: /清空密码/ }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('还没有密码时不给「清空」按钮（没什么可清）', () => {
    setup({ hasPin: false })
    expect(screen.queryByRole('button', { name: /清空密码/ })).toBeNull()
    // 按钮文案也跟着变：这时是「设置」，不是「修改」
    expect(screen.getByRole('button', { name: '设置密码' })).toBeInTheDocument()
  })
})
