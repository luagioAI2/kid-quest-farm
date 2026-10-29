import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import type { MerchantApplication } from '@/domain/types'
import { RedeemBody } from './RedeemSheet'

/* ============================================================
   招商（2026-10-29）
   ------------------------------------------------------------
   用户原话：「兑换记录显示招商，点击会有家长申请和商家申请。
   家长权益获取收益的分成。商家可以自己添加商城物品。申请后端会返回
   后台链接，已经申请后台审核过的，就是直接显示链接。暂时没后端服务，
   就只有 UI。」

   所以这里守四件事：
     ① 入口在「📜 兑换记录」里，两路申请都点得到；
     ② 提交**真的落库**（`settings.merchantApps`），重挂载之后还在；
     ③ `approved` + `adminUrl` ⇒ 直出「打开后台」，点了才 `window.open`；
     ④ `approved` 但**没有链接** ⇒ 不画那颗按钮（点了什么都不发生，
        比没有更糟）。
   ============================================================ */

beforeEach(async () => {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
  // store 是模块级单例，上一个用例留下的跳转通道会漏到这里来
  useApp.setState({ pendingRedeemItem: null })
})

/** 进「兑换记录」→ 点招商入口。两步都要等，别用固定 sleep */
async function openMerchant(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /兑换记录/ }))
  await user.click(await screen.findByRole('button', { name: /招商合作/ }))
}

const seed = async (apps: MerchantApplication[]) => {
  await useApp.getState().updateSettings({ merchantApps: apps })
}

describe('招商：入口与两路申请', () => {
  it('★ 兑换记录底部有招商入口，点开是家长 / 商家两路', async () => {
    const user = userEvent.setup()
    render(<RedeemBody />)

    await user.click(await screen.findByRole('button', { name: /兑换记录/ }))
    // 空记录时也要有 —— 这一屏没有内容，正是最该看见它的时候
    expect(await screen.findByText('还没有兑换过')).toBeTruthy()
    expect(screen.getByRole('button', { name: /招商合作/ })).toBeTruthy()

    await user.click(screen.getByRole('button', { name: /招商合作/ }))
    expect(await screen.findByText('家长申请')).toBeTruthy()
    expect(screen.getByText('商家申请')).toBeTruthy()
    // 家长那一路必须写清楚「有分成」——这是这一路的全部动机
    expect(screen.getByText('邀请商家入驻，拿收益分成')).toBeTruthy()
  })

  it('★ 家长申请提交后落库，状态是 pending（客户端不许自己判通过）', async () => {
    const user = userEvent.setup()
    render(<RedeemBody />)
    await openMerchant(user)

    await user.click(screen.getByRole('button', { name: '申请成为推广家长' }))
    await user.type(screen.getByPlaceholderText(/小雨妈妈/), '小雨妈妈')
    await user.type(screen.getByPlaceholderText('审核结果会联系你'), '13800000000')
    await user.click(screen.getByRole('button', { name: '提交申请' }))

    await waitFor(async () => {
      const apps = useApp.getState().settings.merchantApps ?? []
      expect(apps, '要落进 settings，不能只存在组件里').toHaveLength(1)
      expect(apps[0].role).toBe('parent')
      expect(apps[0].status, '客户端只能提交，通过与否是后台的事').toBe('pending')
      expect(apps[0].name).toBe('小雨妈妈')
      expect(apps[0].adminUrl, '没有后端，不许自己造后台地址').toBeUndefined()
    })
    expect(await screen.findByText('审核中')).toBeTruthy()
  })

  it('商家那一路存的是 merchant 角色，两路互不覆盖', async () => {
    await seed([
      { role: 'parent', status: 'pending', createdAt: Date.now(), name: '小雨妈妈', contact: '1' },
    ])

    const user = userEvent.setup()
    render(<RedeemBody />)
    await openMerchant(user)

    await user.click(screen.getByRole('button', { name: '申请商家入驻' }))
    await user.type(screen.getByPlaceholderText(/楼下小书店/), '楼下小书店')
    await user.type(screen.getByPlaceholderText('审核结果会联系你'), '13900000000')
    await user.click(screen.getByRole('button', { name: '提交申请' }))

    await waitFor(async () => {
      const apps = useApp.getState().settings.merchantApps ?? []
      expect(apps, '两条角色各存一条，不是覆盖').toHaveLength(2)
      expect(apps.map((a) => a.role).sort()).toEqual(['merchant', 'parent'])
    })
  })

  it('同一路重复提交 = 改申请，不新增第二条', async () => {
    await seed([
      { role: 'parent', status: 'pending', createdAt: Date.now(), name: '小雨妈妈', contact: '1' },
    ])

    const user = userEvent.setup()
    render(<RedeemBody />)
    await openMerchant(user)

    await user.click(screen.getByRole('button', { name: '改一下申请' }))
    const nameInput = screen.getByPlaceholderText(/小雨妈妈/) as HTMLInputElement
    expect(nameInput.value, '改申请要把原来的填回去').toBe('小雨妈妈')
    await user.clear(nameInput)
    await user.type(nameInput, '小雨爸爸')
    await user.click(screen.getByRole('button', { name: '提交申请' }))

    await waitFor(async () => {
      const apps = useApp.getState().settings.merchantApps ?? []
      expect(apps, '一个人两单只会让后台多问一遍哪单算').toHaveLength(1)
      expect(apps[0].name).toBe('小雨爸爸')
    })
  })
})

describe('招商：审核通过之后', () => {
  it('★ 已通过且有后台链接：直出「打开后台」，点了才 window.open', async () => {
    await seed([
      {
        role: 'merchant',
        status: 'approved',
        createdAt: Date.now(),
        name: '楼下小书店',
        contact: '139',
        adminUrl: 'https://example.com/admin',
      },
    ])
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    const user = userEvent.setup()
    render(<RedeemBody />)
    await openMerchant(user)

    await user.click(await screen.findByRole('button', { name: /打开后台/ }))
    expect(open).toHaveBeenCalledWith(
      'https://example.com/admin',
      '_blank',
      'noopener,noreferrer',
    )
    open.mockRestore()
  })

  it('★ 已通过但链接还没生成：不画按钮，只说明在生成', async () => {
    await seed([
      { role: 'merchant', status: 'approved', createdAt: Date.now(), name: '楼下小书店', contact: '139' },
    ])

    const user = userEvent.setup()
    render(<RedeemBody />)
    await openMerchant(user)

    expect(await screen.findByText('已通过')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /打开后台/ }),
      '点了什么都不发生的按钮，比没有这颗按钮更糟',
    ).toBeNull()
    expect(screen.getByText(/后台链接还在生成/)).toBeTruthy()
  })

  it('入口上带状态小标：有申请就写「审核中」', async () => {
    await seed([
      { role: 'parent', status: 'pending', createdAt: Date.now(), name: '小雨妈妈', contact: '1' },
    ])

    const user = userEvent.setup()
    render(<RedeemBody />)
    await user.click(await screen.findByRole('button', { name: /兑换记录/ }))

    const entry = await screen.findByRole('button', { name: /招商合作/ })
    expect(entry.textContent).toContain('审核中')
  })
})
