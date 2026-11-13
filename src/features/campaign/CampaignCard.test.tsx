import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
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

   ## ★ 2026-11-13 交互口径变了：大卡片 → 低调小气泡

   用户：「主线任务 应该 有个不明显的气泡，点开有小窗口显示任务和进度，奖励。」

   原来卡片上直接有关卡标题 + 领取按钮，现在这些都在**点开之后**的小窗口里。
   所以下面每条测试都比以前多一步「先点气泡」。

   ⚠️ 改的时候只准改**操作方式**，不许删断言 —— 上面那五件事是这张卡
     存在的理由，交互怎么变都得成立。
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

/** 气泡上那句进度（`have/need · 还差 N …`）——
 *  气泡是常驻的，所以「主推哪一关」靠它判断。 */
const bubbleProgress = () =>
  document.querySelector('[data-campaign-progress]')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

/** 点气泡，等小窗口出来。
 *  ★ 断言「窗口真的开了」而不是只点一下 ——
 *    `Sheet` 是懒渲染的，点了没反应时下面的断言会全部变成「找不到元素」，
 *    报错指向偏，看不出是"没打开"。 */
async function openSheet() {
  await userEvent.click(document.querySelector('[data-campaign-open]') as HTMLElement)
  await waitFor(() => expect(document.querySelector('[data-campaign-step]')).toBeTruthy())
}

describe('气泡主推哪一关', () => {
  it('任务数不够时推第 1 关，并写清还差几个', () => {
    seed({ tasks: 2 })
    render(<CampaignCard />)

    // 气泡上就写着「2/5 · 还差 3 个任务」—— 不用点开也知道差多少
    expect(bubbleProgress()).toContain('2/5')
    expect(bubbleProgress()).toContain('还差 3')
  })

  it('★ 有一关能领就推那一关，不让孩子继续白做任务', () => {
    // 任务只做了 2 个，但券已经够了 ⇒ 应该推「攒够 100 张」
    seed({ tasks: 2, coupons: 120 })
    render(<CampaignCard />)

    // 券那关：100 张就够，已有 120
    expect(bubbleProgress()).toContain('100/100')
    expect(bubbleProgress()).toContain('可以领取')
  })

  it('★ 可领取时气泡要变样（🏁→🎁），否则孩子发现不了有奖励没领', async () => {
    seed({ tasks: 5 })
    const { container } = render(<CampaignCard />)

    const bubble = container.querySelector('[data-campaign-open]') as HTMLElement
    expect(bubble.getAttribute('aria-label')).toContain('可以领取')
    // 图标从 🏁 换成 🎁
    expect(bubble.textContent).toContain('🎁')
    expect(bubble.textContent).not.toContain('🏁')
  })

  it('★ 默认**不展开**小窗口（气泡的卖点就是不占版面）', () => {
    seed({ tasks: 2 })
    render(<CampaignCard />)
    expect(document.querySelector('[data-campaign-step]')).toBeNull()
  })
})

describe('领取（现在要点开小窗口再领）', () => {
  it('★ 点领取 → 调 store 里那一关（不是别的关），并弹提示', async () => {
    seed({ tasks: 5 })
    render(<CampaignCard />)

    await openSheet()
    /* ★ 点的是**那一关自己的**领取按钮（`data-campaign-claim="first5"`），
       不是"窗口里第一颗按钮" —— 后者在关卡顺序一变就会领错。 */
    await userEvent.click(document.querySelector('[data-campaign-claim="first5"]') as HTMLElement)

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

    await openSheet()

    expect(document.querySelectorAll('[data-campaign-step]')).toHaveLength(4)
    expect(
      document.querySelector('[data-campaign-step="first5"]')!.getAttribute('data-campaign-state'),
    ).toBe('ready')
    expect(
      document.querySelector('[data-campaign-step="coupon100"]')!.getAttribute('data-campaign-state'),
    ).toBe('doing')
  })

  it('小窗口里也说清奖励是什么（用户要「显示任务和进度，奖励」）', async () => {
    seed({ tasks: 5 })
    render(<CampaignCard />)

    await openSheet()
    const first = document.querySelector('[data-campaign-step="first5"]')
    expect(first?.textContent).toContain('奖励')
    expect(first?.textContent).toContain('永久拥有')
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

    // 气泡主推「第一个可领取的」，这里是第一关（20 个任务早够了）
    expect(document.querySelector('[data-campaign-open]')?.getAttribute('aria-label')).toContain(
      '可以领取',
    )

    // 关键判据：券那一关的状态。本地只有 20 张 ⇒ 若只信本地会是 doing；
    // 按服务端的 190 张算就是 ready。
    await openSheet()
    const coupon = document.querySelector('[data-campaign-step="coupon100"]')
    expect(coupon?.getAttribute('data-campaign-state')).toBe('ready')
  })

  it('本地版（没有服务端数字）仍然用本地那份', () => {
    seed({ tasks: 2, coupons: 120 })
    render(<CampaignCard />)
    // 本地算的券够 100 ⇒ 气泡推券那关
    expect(bubbleProgress()).toContain('100/100')
  })
})

describe('全领完之后', () => {
  it('★ 卡片整块消失（不留一张「没有下一步」的卡片占位置）', () => {
    seed({ tasks: 999, coupons: 9999, claims: ['first5', 'coupon100', 'first15', 'coupon300'] })
    const { container } = render(<CampaignCard />)
    expect(container.querySelector('[data-tour="campaign-card"]')).toBeNull()
  })
})
