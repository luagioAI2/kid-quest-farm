import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BootRetryPage } from './BootRetryPage'
import { useAccount } from '@/store/useAccount'

/* ============================================================
   「没连上服务器」这一屏（2026-11-03）
   ------------------------------------------------------------
   为什么值得单独测：它只在**首启连不上**时出现，而那正是「没耐心」的
   新用户第一次见到这个 App 的时刻。写坏的表现不是报错，是
   「一片空白」或者「一直转圈」—— 两种都会让他直接关掉。

   守三件事：
     ① 说出**为什么**（把 store 里那句错误显示出来，别只画个 emoji）；
     ② 说清**接下来怎么办**（重试），而且按钮真的能点；
     ③ 正在重试时按钮禁用（连点会连发请求）。
   ============================================================ */

const reset = () =>
  useAccount.setState({ session: null, busy: false, error: null, errorCode: null })

beforeEach(() => {
  reset()
})

describe('BootRetryPage：首启连不上时的那一屏', () => {
  it('★ 更有信息的原因要显示出来（不是只画个 emoji）', () => {
    useAccount.setState({ error: '服务器没有响应，请稍后再试' })
    render(<BootRetryPage onRetry={() => {}} />)

    expect(screen.getByText('还没连上服务器')).toBeTruthy()
    expect(screen.getByText('服务器没有响应，请稍后再试')).toBeTruthy()
  })

  it('★ 同一句话不显示两遍（默认错误和标题重复时只留标题）', () => {
    useAccount.setState({ error: '连不上服务器，请检查网络' })
    render(<BootRetryPage onRetry={() => {}} />)

    /* 标题里已经有一次了，正文再来一次就是「出了大事」的观感，
       还把「接下来怎么办」的位置挤掉了 */
    expect(screen.getByText('还没连上服务器')).toBeTruthy()
    expect(screen.queryByText('连不上服务器，请检查网络')).toBeNull()
  })

  it('没有错误文案时也有一句能看的兜底（别显示 undefined）', () => {
    useAccount.setState({ error: null })
    render(<BootRetryPage onRetry={() => {}} />)

    const body = document.body.textContent ?? ''
    expect(body).toContain('还没连上服务器')
    expect(body).toContain('重试')
    expect(body).not.toContain('undefined')
  })

  it('★ 说清下一步（不用重新填什么，重试就行）', () => {
    render(<BootRetryPage onRetry={() => {}} />)
    expect(document.body.textContent).toContain('重试')
    expect(document.body.textContent).toContain('不用重新填')
  })

  it('★ 点「重试」真的会回调（按钮不是摆设）', async () => {
    const onRetry = vi.fn()
    render(<BootRetryPage onRetry={onRetry} />)

    await userEvent.click(screen.getByRole('button', { name: '重试' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('★ 正在重试时按钮禁用（连点会连发请求）', async () => {
    useAccount.setState({ busy: true })
    const onRetry = vi.fn()
    render(<BootRetryPage onRetry={onRetry} />)

    const btn = screen.getByRole('button')
    expect(btn.textContent).toContain('正在重试')
    expect((btn as HTMLButtonElement).disabled).toBe(true)

    await userEvent.click(btn)
    expect(onRetry, '禁用的按钮不该还能触发').not.toHaveBeenCalled()
  })
})
