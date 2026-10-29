/**
 * 家长闸门：**没设过密码时，第一次用到才要求设**
 * ------------------------------------------------------------
 * 2026-10-30 用户原话：「新号不要在引导前就要求设置家长密码，
 * 需要用的时候才要求第一次设置。」
 *
 * 于是「设密码」从引导搬到了闸门里，这一组守的就是搬过来的这段：
 *   ① 没密码 → 面板变成「先设一个」，输两遍，落库后放行；
 *   ② 两遍不一致 → 报错、**不落库**、回到第一遍（没有找回入口，不能写错）；
 *   ③ 已有密码 → 老样子，输对才放行；
 *   ④ 家长在设置里关掉「保护家长操作」→ 直接放行（这是显式的选择）。
 *
 * ⚠️ 这些断言以前在 `onboarding.test.tsx` 里（那时密码是在引导里设的）。
 *    搬家时**别只删不搬** —— 那几条是安全断言，不是流程断言。
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppSettings } from '@/domain/types'
import { DEFAULT_SETTINGS, db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { ParentGate } from './ParentGate'

async function freshStore(over: Partial<AppSettings> = {}) {
  await db.delete()
  await db.open()
  useApp.setState({ settings: { ...DEFAULT_SETTINGS, ...over } })
}

/** 按 PinPad 上的数字键。4 位会自动提交（见 ParentGate 里那段注释）。 */
async function typePin(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const d of digits) {
    await user.click(screen.getByRole('button', { name: d }))
  }
}

const CHILD = '这里是被保护的内容'

beforeEach(async () => {
  await freshStore()
})

describe('家长闸门：第一次用才设密码', () => {
  it('★ 没设过密码：先要求设一个（两遍），设完才放行', async () => {
    const user = userEvent.setup()
    render(
      <ParentGate hint="审核需要爸爸妈妈确认">
        <p>{CHILD}</p>
      </ParentGate>,
    )

    // 面板在，内容不在
    expect(screen.getByText('先设一个家长密码')).toBeInTheDocument()
    expect(screen.queryByText(CHILD)).toBeNull()

    await typePin(user, '1234')
    expect(screen.getByText('再输一次，确认没记错')).toBeInTheDocument()

    await typePin(user, '1234')
    // 落库要走一趟 IndexedDB，不能 getBy 抢跑
    expect(await screen.findByText(CHILD)).toBeInTheDocument()
    expect(useApp.getState().settings.parentPin).toBe('1234')
  })

  it('★ 两遍不一样：报错、不落库、回到第一遍', async () => {
    const user = userEvent.setup()
    render(
      <ParentGate>
        <p>{CHILD}</p>
      </ParentGate>,
    )

    await typePin(user, '1234')
    await typePin(user, '5678')

    expect(screen.getByText('两次不一样，重新设一次吧')).toBeInTheDocument()
    expect(screen.queryByText(CHILD), '不一致绝不能放行').toBeNull()
    expect(useApp.getState().settings.parentPin, '不一致绝不能落库').toBeUndefined()
    // 回到第一遍，而不是停在报错里
    expect(screen.getByText('设一个 4 位数字')).toBeInTheDocument()
  })

  it('已有密码：输错不放行，输对才放行', async () => {
    await freshStore({ parentPin: '1111' })
    const user = userEvent.setup()
    render(
      <ParentGate>
        <p>{CHILD}</p>
      </ParentGate>,
    )

    // 已有密码时不该出现「设一个」那套文案
    expect(screen.queryByText('先设一个家长密码')).toBeNull()

    await typePin(user, '9999')
    expect(screen.getByText('密码不对，再试一次？')).toBeInTheDocument()
    expect(screen.queryByText(CHILD)).toBeNull()

    await typePin(user, '1111')
    await waitFor(() => expect(screen.getByText(CHILD)).toBeInTheDocument())
    expect(useApp.getState().settings.parentPin, '输密码不该改密码').toBe('1111')
  })

  it('保护关掉（家长自己选的）→ 直接放行，连键盘都没有', () => {
    useApp.setState({
      settings: { ...DEFAULT_SETTINGS, parentPin: undefined, protectParentActions: false },
    })
    render(
      <ParentGate>
        <p>{CHILD}</p>
      </ParentGate>,
    )
    expect(screen.getByText(CHILD)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '确定' })).toBeNull()
  })
})
