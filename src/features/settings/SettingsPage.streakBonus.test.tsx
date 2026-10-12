import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { DEFAULT_STREAK_CAP, DEFAULT_STREAK_PER_DAY } from '@/domain/streakBonus'
import SettingsPage from './SettingsPage'

/* ============================================================
   设置页 → 规则 → 「连续完成奖励」
   ------------------------------------------------------------
   ⚠️ 这张卡 2026-10-12 **被砍过一轮**。原来它有：
     · 一个总开关
     · 「每连击一天多给 [2] 分」+「一次最多加 [20] 分」两个输入框
     · 一行「当前：连击第 N 天多给「N × 2」分…」的预览
   家长拍板：「不需要全局设定梯度、连续的。每个任务单独，有默认的就行了。」
   → 两个输入框、那行预览、以及背后的 `settings.streakBonusPerDay` /
     `streakBonusCap` 两个字段全部删掉；加多少改成在**每条长期任务**里设。

   所以这个文件也瘦了一圈：原来那四条「改了就落库 / 越界被夹 / 预览重算」
   测的都是被删掉的输入框，现在它们改到**任务编辑**那边测
   （见 `features/tasks/TaskEditor.tiers.test.tsx`）。
   这里只守留下来的东西 + 新加的那句实话。

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
 *    （`RatioInput`），全局 `getAllByRole('spinbutton')` 会把它一起捞进来。
 *    这是本项目反复踩的「作用域没收窄，断言就是假的」。
 */
function streakCard(): HTMLElement {
  const heading = screen.getByRole('heading', { name: /连续完成奖励/ })
  return heading.closest('section') as HTMLElement
}

describe('设置页：连续完成奖励（只剩总开关）', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('★ 卡里**没有**任何数字输入框了 —— 加成分不再有全局值', async () => {
    await openRules()

    // ⚠️ 这条是本文件的重点：家长明确说不需要全局设定。
    //    只要有人把输入框加回来，这里立刻红 —— 那正是要拦住的事：
    //    一个界面上看得见、又和「每条任务单独设」并存的全局值，
    //    会让家长分不清「我到底改了谁」。
    expect(
      within(streakCard()).queryAllByRole('spinbutton'),
      '连击加成分不该再有全局输入框，去任务编辑里设',
    ).toHaveLength(0)

    // 对照：卡片本身确实渲染出来了（否则上面那条会因为「整张卡没渲染」而假绿）
    expect(within(streakCard()).getByRole('switch', { name: '连续完成奖励' })).toBeTruthy()
  })

  it('★ 规则页里**没有**「坚持的奖励阶梯」那张卡了', async () => {
    await openRules()

    /* 2026-10-12 家长拍板删掉的另一半：阶梯倍率的全局档位按钮
       （20% / 40% / … / 150%）。倍率改成只在任务编辑里设。
       ⚠️ 只断言「卡不在」是不够的 —— 整页渲染失败也会让它绿。
       所以配一条正向对照：同一页里**别的**卡确实在。 */
    expect(
      screen.queryByRole('heading', { name: /坚持的奖励阶梯/ }),
      '阶梯倍率不再有全局档位，去任务编辑里设',
    ).toBeNull()

    // 正向对照：规则页确实渲染出来了
    expect(screen.getByRole('heading', { name: /连续完成奖励/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /每一轮最多能赚多少/ })).toBeTruthy()
  })

  it('★ 卡里说清了「加多少去每条任务里设」，并给出默认值', async () => {
    await openRules()

    expect(
      within(streakCard()).getByText(/每条长期任务/),
      '必须指路，否则家长找不到去哪儿设',
    ).toBeTruthy()

    // 默认值不能写死 —— 从 domain 常量来，默认改了这里跟着改
    const card = streakCard().textContent ?? ''
    expect(card).toContain(`每连一天 +${DEFAULT_STREAK_PER_DAY} 分`)
    expect(card).toContain(`最多 +${DEFAULT_STREAK_CAP} 分`)
  })

  it('★ 关掉开关 → 落库（连击那半边就停了）', async () => {
    const user = await openRules()
    await user.click(within(streakCard()).getByRole('switch', { name: '连续完成奖励' }))
    expect(useApp.getState().settings.streakBonusEnabled).toBe(false)
  })

  it('★ 再打开 → 也落库（开关是可逆的，不是只能关不能开）', async () => {
    const user = await openRules()
    const sw = within(streakCard()).getByRole('switch', { name: '连续完成奖励' })
    await user.click(sw)
    expect(useApp.getState().settings.streakBonusEnabled).toBe(false)
    await user.click(sw)
    expect(useApp.getState().settings.streakBonusEnabled).toBe(true)
  })
})
