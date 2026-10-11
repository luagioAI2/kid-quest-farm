import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { MIN_TIER_RATIO } from '@/domain/tierRatio'
import { TaskEditor } from './TaskEditor'

/* ============================================================
   编辑器的「坚持的奖励阶梯」预览
   ------------------------------------------------------------
   阶梯**不是**存在任务上的字段，而是每次由
   `defaultTiers(cycle, 目标天数, 基础分, 倍率)` 现算的（家长 2026-09-30 定的口径：
   阶梯合计 = 倍率 × 基础分 × 目标天数，按 1:3:6 摊到三档）。

   所以「改了基础分，预览必须跟着重算」—— 写死或缓存住都会当场变成假话。
   上面那段 JSX 的注释里就是这么写的，但 `useMemo` 的依赖数组**漏了
   `basePoints`**，于是这条保证是假的：改了基础分，阶梯还停在旧数字上。

   2026-10-10 家长报「为啥阶梯分还是这么大」时查出来的。
   同一天家长还要「阶梯分设置」，于是那个写死的 0.8 提成了
   `settings.checkInTierRatio` —— 它也得进依赖数组，否则家长在设置里
   压了倍率，编辑器还在按旧倍率报价（下面最后一条盯着这件事）。
   ============================================================ */

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 读「坚持的奖励阶梯」那一块里的 +N（按显示顺序） */
function ladder(): number[] {
  const label = screen.getByText('坚持的奖励阶梯')
  const box = label.nextElementSibling as HTMLElement
  return Array.from(box.querySelectorAll('span'))
    .map((e) => (e.textContent ?? '').trim())
    .filter((t) => /^\+\d+$/.test(t))
    .map((t) => Number(t.slice(1)))
}

/** 按 Field 的标题定位它里面的数字输入框 */
function stepperInput(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText)
  const field = label.parentElement as HTMLElement
  const input = field.querySelector('input[type="number"]')
  if (!input) throw new Error(`找不到「${labelText}」里的数字输入框`)
  return input as HTMLInputElement
}

/** 开一个「每周 + 签到」的新任务编辑态 */
async function openWeeklyCheckIn(target: string) {
  const user = userEvent.setup()
  render(<TaskEditor open task={null} onClose={() => {}} />)

  // 家长密码闸门：默认 PIN 是 0000，第 4 位会自动提交
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole('button', { name: '0' }))
  }

  // 日 / 单次不支持签到，先切到每周
  await user.click(screen.getByRole('button', { name: '每周' }))
  await user.click(screen.getByRole('button', { name: /开启签到模式/ }))
  fireEvent.change(stepperInput('一共要签到几天'), { target: { value: target } })
}

describe('任务编辑器：奖励阶梯预览必须跟着基础分走', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('阶梯按公式现算：base 10 / 目标 6 天 → 5 / 15 / 30', async () => {
    await openWeeklyCheckIn('6')

    // unit = round(0.8 × 10 × 6 / 10) = 5，1:3:6 → 5/15/30
    expect(ladder()).toEqual([5, 15, 30])
  })

  it('★ 改基础分，阶梯要跟着重算（这条以前是假的）', async () => {
    await openWeeklyCheckIn('6')
    expect(ladder(), '前提：默认基础分 10').toEqual([5, 15, 30])

    fireEvent.change(stepperInput('基础积分'), { target: { value: '5' } })

    // unit = round(0.8 × 5 × 6 / 10) = 2 → 2/6/12
    expect(ladder(), '改了基础分，阶梯必须跟着重算，不能停在旧数字上').toEqual([2, 6, 12])
  })

  it('改目标天数，阶梯跟着重算（并正确合并到同一天的档位）', async () => {
    await openWeeklyCheckIn('6')
    expect(ladder()).toEqual([5, 15, 30])

    fireEvent.change(stepperInput('一共要签到几天'), { target: { value: '3' } })

    /* unit = round(0.8 × 10 × 3 / 10) = 2。
       目标只有 3 天时，周档的 1/3/6 被 Math.min 压成 1/3/3 ——
       后两档落在同一天，`dedupeTiers` 保留高的那档 ⇒ [2, 12]（不是 2/6/12）。 */
    expect(ladder(), '改了目标天数，阶梯必须跟着重算').toEqual([2, 12])
  })

  it('基础分归零时，阶梯不该出现「+0」（公式有下限 1 分）', async () => {
    await openWeeklyCheckIn('6')
    fireEvent.change(stepperInput('基础积分'), { target: { value: '0' } })

    // 注意：basePoints=0 时 unit 仍 ≥ 1，所以阶梯不会变成 +0
    expect(ladder().every((p) => p >= 1)).toBe(true)
  })

  it('★ 家长在设置里压倍率，编辑器预览跟着重算（依赖漏了就会停在旧数字）', async () => {
    await openWeeklyCheckIn('6')
    expect(ladder(), '前提：默认倍率 0.8').toEqual([5, 15, 30])

    // 家长在设置页把「坚持的奖励阶梯」压到下限
    await act(async () => {
      await useApp.getState().updateSettings({ checkInTierRatio: MIN_TIER_RATIO })
    })

    // unit = round(0.2 × 10 × 6 / 10) = round(1.2) = 1 → 1/3/6
    expect(ladder(), '倍率压到下限，预览必须跟着变小').toEqual([1, 3, 6])
  })

  it('先改设置再开编辑器，打开时就是新倍率', async () => {
    await useApp.getState().updateSettings({ checkInTierRatio: MIN_TIER_RATIO })
    await openWeeklyCheckIn('6')

    expect(ladder()).toEqual([1, 3, 6])
  })
})
