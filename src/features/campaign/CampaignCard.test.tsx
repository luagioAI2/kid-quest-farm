import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useApp } from '@/store/useApp'
import { CampaignCard } from './CampaignCard'
import type { HarvestEntry, TaskInstance } from '@/domain/types'

/* ============================================================
   主线活动卡片
   ------------------------------------------------------------
   这一块最容易「静默做坏」的三件事：

     ① 主推挑错关卡 —— 明明有一份能领，卡片却让孩子继续做任务；
     ② 领取按钮点了没反应（或者点了领到另一个奖励）；
     ③ 全领完之后卡片还赖在任务列表顶上，每天推着孩子往后翻。

   判据都落在**页面上**（文本 + `data-campaign-*` 锚点），不看内部状态。
   ============================================================ */

const done = (n: number): TaskInstance[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `i${i}`,
    taskId: 't',
    periodKey: `2026-11-${i + 1}`,
    date: `2026-11-${i + 1}`,
    title: '任务',
    category: 'study',
    cycle: 'daily',
    plannedMinutes: 20,
    basePoints: 10,
    allowOvertime: false,
    allowLateNoPenalty: false,
    qualityRated: false,
    rewardItemIds: [],
    status: 'completed',
    // `TaskInstance` 的两个必填时间戳：缺了类型对不上（lint 会红），
    // 而组件只读 status —— 给个固定值就够
    createdAt: 1,
    updatedAt: 1,
  })) as TaskInstance[]

const earn = (n: number): HarvestEntry[] =>
  [{ id: 'h1', delta: n, balanceAfter: n, source: 'farm_harvest', memo: '收成', createdAt: 1 }] as HarvestEntry[]

function seed(opts: {
  tasks?: number
  coupons?: number
  claims?: string[]
  serverStats?: { tasksDone: number; couponsEarned: number } | null
}) {
  useApp.setState({
    instances: done(opts.tasks ?? 0),
    harvestLedger: earn(opts.coupons ?? 0),
    campaignClaims: opts.claims ?? [],
    campaignServerStats: opts.serverStats ?? null,
  })
}

beforeEach(() => {
  seed({})
  useApp.setState({
    claimCampaignStep: vi.fn(async () => ({ ok: true, message: '领到了' })),
    pushToast: vi.fn(),
  })
})

describe('卡片主推哪一关', () => {
  it('任务数不够时推第 1 关，并写清还差几个', () => {
    seed({ tasks: 2 })
    render(<CampaignCard />)

    expect(screen.getByText('先做 5 个任务')).toBeTruthy()
    expect(document.querySelector('[data-campaign-progress]')!.textContent).toContain('还差 3')
  })

  it('★ 有一关能领就推那一关，不让孩子继续白做任务', () => {
    // 任务只做了 2 个，但券已经够了 ⇒ 应该推「攒够 100 张」
    seed({ tasks: 2, coupons: 120 })
    render(<CampaignCard />)

    expect(screen.getByText('攒够 100 张兑换券')).toBeTruthy()
    expect(screen.getByText('🎁 领取')).toBeTruthy()
  })
})

describe('领取', () => {
  it('★ 点领取 → 调 store 里那一关（不是别的关），并弹提示', async () => {
    seed({ tasks: 5 })
    render(<CampaignCard />)

    await userEvent.click(screen.getByText('🎁 领取'))

    await waitFor(() => {
      expect(useApp.getState().claimCampaignStep).toHaveBeenCalledWith('first5')
    })
    await waitFor(() => {
      expect(useApp.getState().pushToast).toHaveBeenCalled()
    })
  })

  it('展开全部关卡：4 关都在，且标了各自的状态', async () => {
    seed({ tasks: 5 })
    render(<CampaignCard />)

    await userEvent.click(screen.getByText(/全部 4 关/))

    expect(document.querySelectorAll('[data-campaign-step]')).toHaveLength(4)
    expect(
      document.querySelector('[data-campaign-step="first5"]')!.getAttribute('data-campaign-state'),
    ).toBe('ready')
    expect(
      document.querySelector('[data-campaign-step="coupon100"]')!.getAttribute('data-campaign-state'),
    ).toBe('doing')
  })
})

describe('在线版：进度以服务端为准', () => {
  it('★ 本地流水被窗口挤掉（算出来只有 20 张）时，按服务端的 190 张算', async () => {
    /* 在线版 `pullLedger` 只拉 200 × 10 = 2000 条，老账号早期入账会掉出窗口
       ⇒ 本地算的累计值偏小。只信本地的话，界面会卡在「还差 80 张」，
       而服务端早就判定够了 —— 按钮根本不出现，还不报错。 */
    seed({
      tasks: 2,
      coupons: 20,
      serverStats: { tasksDone: 20, couponsEarned: 190 },
    })
    render(<CampaignCard />)

    // 卡片主推的是「第一个可领取的」（这里是第一关，20 个任务早够了）
    expect(screen.getByText('🎁 领取')).toBeTruthy()

    // 关键判据：券那一关的状态。本地只有 20 张 ⇒ 若只信本地会是 doing；
    // 按服务端的 190 张算就是 ready。
    await userEvent.click(screen.getByText(/全部 4 关/))
    const coupon = document.querySelector('[data-campaign-step="coupon100"]')
    expect(coupon?.getAttribute('data-campaign-state')).toBe('ready')
  })

  it('本地版（没有服务端数字）仍然用本地那份', () => {
    seed({ tasks: 2, coupons: 120 })
    render(<CampaignCard />)
    expect(screen.getByText('攒够 100 张兑换券')).toBeTruthy()
  })
})

describe('全领完之后', () => {
  it('★ 卡片整块消失（不留一张「没有下一步」的卡片占位置）', () => {
    seed({ tasks: 999, coupons: 9999, claims: ['first5', 'coupon100', 'first15', 'coupon300'] })
    const { container } = render(<CampaignCard />)
    expect(container.querySelector('[data-tour="campaign-card"]')).toBeNull()
  })
})
