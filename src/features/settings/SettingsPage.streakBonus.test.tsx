import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { MAX_STREAK_CAP, MAX_STREAK_PER_DAY } from '@/domain/streakBonus'
import SettingsPage from './SettingsPage'

/* ============================================================
   设置页 → 规则 → 「连续完成奖励」
   ------------------------------------------------------------
   家长 2026-10-11 原话：「长期任务 这种 次数的可以有连续奖励。
   (连击奖励)（可以设置连续的加成的分）。不能两种 同时都有。」

   改之前这张卡只有个开关，加成分 2 / 20 **写死在提示文字里**，家长改不了 ——
   字面上是「可以设置」，实际上不能。这里守四件事：
   1. 两个数字框真的在，且显示的是当前值；
   2. 改了就落库（不是只改了个显示）；
   3. 那行「当前：…」跟着重算（否则家长会以为没生效）；
   4. 越界被夹到上限，不会把 NaN / 999 写进设置。

   连击**发多少分**在 useApp.test.ts 里测（那边能跑完整结算）；
   这里只测设置页这一层。
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
 * 连击那张卡。
 *
 * ⚠️ 必须框到卡片里再查控件 —— 「现金对积分」那张卡也有个 number 输入框
 *    （`RatioInput`），全局 `getAllByRole('spinbutton')` 会把它一起捞进来，
 *    于是 `[perDay, cap]` 解构到的其实是「1 元 = ___ 分」那个框。
 *    这是本项目反复踩的「作用域没收窄，断言就是假的」。
 */
function streakCard(): HTMLElement {
  const heading = screen.getByRole('heading', { name: /连续完成奖励/ })
  return heading.closest('section') as HTMLElement
}

/** 卡片里的两个数字框：[每连击一天, 一次最多] */
function inputs(): HTMLInputElement[] {
  return within(streakCard()).getAllByRole('spinbutton') as HTMLInputElement[]
}

/** 卡片里那行「当前：…」 */
function previewLine(): string {
  const p = within(streakCard()).getByText(
    (_, el) => el?.tagName === 'P' && (el.textContent ?? '').includes('连击第 N 天多给'),
  )
  return p.textContent ?? ''
}

/** 填一个数字框并提交（失焦才落库，这是刻意的：中间态不写 store） */
async function fill(user: ReturnType<typeof userEvent.setup>, el: HTMLInputElement, v: string) {
  await user.clear(el)
  await user.type(el, v)
  await user.tab()
}

describe('设置页：连续完成奖励的加成分', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('规则页里有这张卡，默认「每连击一天 2 分、一次最多 20 分」', async () => {
    await openRules()

    expect(useApp.getState().settings.streakBonusPerDay).toBe(2)
    expect(useApp.getState().settings.streakBonusCap).toBe(20)

    const [perDay, cap] = inputs()
    expect(perDay.value, '框里要显示当前值，不能是空').toBe('2')
    expect(cap.value).toBe('20')
  })

  it('★ 把「每连击一天」改成 5 → 真的落库，预览那行跟着重算', async () => {
    const user = await openRules()
    const [perDay] = inputs()
    await fill(user, perDay, '5')

    expect(useApp.getState().settings.streakBonusPerDay, '填完必须真的写进设置').toBe(5)

    const line = previewLine()
    expect(line).toContain('N × 5')
    // 例：min(封顶 20, 3×5) = 15
    expect(line, '例子要按新数现算').toContain('第 3 天多给 15 分')
  })

  it('★ 封顶压到 3 → 连击最多只加 3 分，预览也照实算', async () => {
    const user = await openRules()
    const [, cap] = inputs()
    await fill(user, cap, '3')

    expect(useApp.getState().settings.streakBonusCap).toBe(3)
    // min(3, 3×2) = 3
    expect(previewLine(), '封顶生效后例子要变小').toContain('第 3 天多给 3 分')
  })

  it('★ 填越界的数会被夹到上限，不会把值写坏', async () => {
    const user = await openRules()
    const [perDay, cap] = inputs()
    await fill(user, perDay, '999')
    await fill(user, cap, '99999')

    expect(useApp.getState().settings.streakBonusPerDay).toBe(MAX_STREAK_PER_DAY)
    expect(useApp.getState().settings.streakBonusCap).toBe(MAX_STREAK_CAP)
    // 夹完要回写到框里，否则家长看到自己填的 999 以为存进去了
    const [perDayAfter, capAfter] = inputs()
    expect(perDayAfter.value).toBe(String(MAX_STREAK_PER_DAY))
    expect(capAfter.value).toBe(String(MAX_STREAK_CAP))
  })

  it('★ 关掉开关 → 落库（连击那半边就停了）', async () => {
    const user = await openRules()
    await user.click(within(streakCard()).getByRole('switch', { name: '连续完成奖励' }))
    expect(useApp.getState().settings.streakBonusEnabled).toBe(false)
  })
})
