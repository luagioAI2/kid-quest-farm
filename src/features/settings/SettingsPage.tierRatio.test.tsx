import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import SettingsPage from './SettingsPage'

/* ============================================================
   设置页 → 规则 → 「坚持的奖励阶梯」
   ------------------------------------------------------------
   家长 2026-10-10 原话：「坚持的奖励阶梯 … 为啥阶梯分 还是这么大。
   另外阶梯分设置没有。」

   前半个问题是 `TaskEditor` 的 `useMemo` 漏依赖（见那个测试文件）；
   后半个就是这张卡 —— 当时**确实没有**，因为阶梯不是任务上的字段，
   而是由 `defaultTiers` 现算的，写死的只有那个 0.8。

   这里守三件事：
   1. 卡片真的在（「没有设置」这条抱怨的直接回归）；
   2. 点预设真的落库（不是只改了个高亮）；
   3. 预览那行**跟着变**，而且是拿家长自己的签到任务算的
      （写死的例子会让家长点了 20% 还看到旧数字）。
   ============================================================ */

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 打开「规则」页并过掉家长密码闸门（默认 PIN 0000，第 4 位自动提交） */
async function openRules() {
  const user = userEvent.setup()
  render(<SettingsPage onBack={() => {}} />)
  await user.click(screen.getByRole('button', { name: /规则/ }))
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole('button', { name: '0' }))
  }
  return user
}

/**
 * 阶梯那张卡。
 *
 * ⚠️ 必须先框到卡片里再查按钮 —— 「每一轮最多能赚多少」那张卡也有
 *    20% / 40% / 60% / 80% / 100% 的按钮，全局 `getByRole` 会撞成两个
 *    然后抛 "found multiple elements"。这跟当年把 `find()` 当成
 *    「唯一」用的坑是同一类：作用域没收窄，断言就是假的。
 */
function tierCard(): HTMLElement {
  const heading = screen.getByRole('heading', { name: /坚持的奖励阶梯/ })
  return heading.closest('section') as HTMLElement
}

/** 卡片里那行「当前：…」的预览 */
function previewLine(): HTMLElement {
  return within(tierCard()).getByText(
    (_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes('阶梯合计给基础分的'),
  )
}

describe('设置页：坚持的奖励阶梯', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('规则页里有这张卡，默认停在 80%', async () => {
    await openRules()

    expect(useApp.getState().settings.checkInTierRatio).toBe(0.8)
    expect(within(tierCard()).getByRole('button', { name: '80%' })).toBeTruthy()
  })

  it('默认档的预览 = 种子里那条签到任务的真实阶梯（1 天 +2 / 3 天 +6 / 5 天 +12）', async () => {
    await openRules()
    const line = previewLine().textContent ?? ''

    // 拿家长自己的任务当例子，不写死抽象例子
    expect(line, '预览要说是拿哪条任务算的').toContain('练字签到')
    expect(line).toContain('阶梯合计给基础分的 80%')
    expect(line).toContain('1 天 +2')
    expect(line).toContain('3 天 +6')
    expect(line).toContain('5 天 +12')
  })

  it('★ 点 20% → 设置真的落库，预览当场变小（这就是「阶梯分设置」）', async () => {
    const user = await openRules()
    await user.click(within(tierCard()).getByRole('button', { name: '20%' }))

    expect(useApp.getState().settings.checkInTierRatio, '点了预设必须真的写进设置').toBe(0.2)

    const line = previewLine().textContent ?? ''
    expect(line).toContain('阶梯合计给基础分的 20%')
    // unit = round(0.2 × 5 × 5 / 10) = 1 → 1 / 3 / 6
    expect(line).toContain('1 天 +1')
    expect(line).toContain('5 天 +6')
  })

  it('预览不是写死的：逐档点一遍，数字都跟着重算', async () => {
    const user = await openRules()

    // base 5 / 目标 5 → unit = round(倍率 × 2.5)，第三档（5 天）= unit × 6
    for (const [label, fiveDay] of [
      ['20%', '5 天 +6'],
      ['60%', '5 天 +12'],
      ['100%', '5 天 +18'],
      ['150%', '5 天 +24'],
    ] as [string, string][]) {
      await user.click(within(tierCard()).getByRole('button', { name: label }))
      expect(previewLine().textContent, `${label} 的 5 天档`).toContain(fiveDay)
    }
  })

  it('预览跟着家长自己的任务走 —— 换一条基础分更大的签到任务，数字要变大', async () => {
    // 把种子那条签到任务的基础分调大，再进设置页
    const task = useApp.getState().tasks.find((t) => t.checkInEnabled)!
    await useApp.getState().updateTask(task.id, { basePoints: 20 })

    await openRules()

    // unit = round(0.8 × 20 × 5 / 10) = 8 → 8 / 24 / 48
    expect(previewLine().textContent).toContain('5 天 +48')
  })
})
