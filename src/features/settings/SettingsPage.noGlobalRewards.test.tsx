import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import SettingsPage from './SettingsPage'

/* ============================================================
   设置页 → 规则：**全局奖励值一个都不许回来**
   ------------------------------------------------------------
   ⚠️ 这个文件原来叫 `SettingsPage.streakBonus.test.tsx`，测的是
   「连续完成奖励」那张卡的**存在**。2026-10-12 家长连着两轮把它砍光：

     第一轮（删「值」）：
       「不需要全局设定梯度、连续的。每个任务单独，有默认的就行了。」
       → `tierRatio` / `streakPerDay` / `streakCap` 三个全局值删掉，
         设置页那两张卡上的输入框也删掉。

     第二轮（删「连击总开关」）：
       「我是说家长设置里的删掉。不需要在家长设置里设定。
        因为任务里已经可以单独设置了。」
       → 整张「连续完成奖励」卡删掉，连 `streakBonusEnabled` 字段一起。

   所以这个文件**整个反转了**：从「测那张卡」变成「测那张卡不存在」。
   ➜ 文件名也改了（`noGlobalRewards`），因为一个叫 `streakBonus` 的文件
     里全是「没有 streakBonus 设置」的断言，正是本项目最讨厌的那种漂移。

   为什么「删掉」也要有测试：删了之后最可能发生的事是**被人好心加回来**
   （「家长可能想一键关掉连击吧？」—— 这个理由很合理，所以必须有东西拦）。
   加回来的后果很具体：一个界面上看得见、又和「每条任务单独设」并存的全局值，
   会让家长分不清「我到底改了谁」；更糟的是如果只加字段不加控件，
   就变成「界面上看不见、却还在影响发分」—— 本项目最怕的那种 bug。

   ⚠️ 字段层面的护栏在 `src/db/db.test.ts`（断言 `DEFAULT_SETTINGS` 里没有）。
      本文件只管**界面层面**：规则页上找不到这些控件。
      两道闸分开，是因为它们拦的错法不同 —— 只加字段会被 tsc 先拦，
      只加控件不会。这里守的就是「只加控件」那条路。
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
 * 规则页确实渲染出来了（正向对照）。
 *
 * ⚠️ 每一条「XX 不存在」的断言都必须配一条「页面确实在」的对照 ——
 *    否则整页渲染失败（比如闸门没过去）会让「不存在」**假绿**。
 *    这是本项目反复踩的坑：单向断言在页面整个挂掉时照样通过。
 */
function expectRulesPageRendered() {
  expect(
    screen.getByRole('heading', { name: /每一轮最多能赚多少/ }),
    '规则页没渲染出来 —— 上面那些「不存在」的断言全是假绿',
  ).toBeTruthy()
}

describe('设置页：全局奖励值已经被删干净（2026-10-12 家长拍板）', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('★ 规则页里**没有**「连续完成奖励」这张卡', async () => {
    await openRules()

    /* ⚠️ 2026-10-12 第二轮拍板：连击的总开关也从家长设置里删掉，
       因为「任务里已经可以单独设置了」。想给单条任务关掉就把
       「每连一天多给」设成 0（`min(cap, 天 × 0) = 0`）。
       ⚠️ 代价是知情接受的：没有「一键全关」了，只能一条条任务设 0。 */
    expect(
      screen.queryByRole('heading', { name: /连续完成奖励/ }),
      '连击不再有全局开关，去任务编辑里设（或把那条任务的每天分设成 0）',
    ).toBeNull()
    expect(
      screen.queryByRole('switch', { name: '连续完成奖励' }),
      '连击总开关的控件也不该在',
    ).toBeNull()

    expectRulesPageRendered()
  })

  it('★ 规则页里**没有**「坚持的奖励阶梯」那张卡', async () => {
    await openRules()

    /* 2026-10-12 第一轮拍板删掉的那一半：阶梯倍率的全局档位按钮
       （20% / 40% / … / 150%）。倍率改成只在任务编辑里设。 */
    expect(
      screen.queryByRole('heading', { name: /坚持的奖励阶梯/ }),
      '阶梯倍率不再有全局档位，去任务编辑里设',
    ).toBeNull()

    expectRulesPageRendered()
  })

  it('★ 规则页里找不到任何连击 / 阶梯倍率的控件', async () => {
    await openRules()

    /* 上面两条是按**标题**找卡。这条换个角度：按**文案**找。
       两者不等价 —— 有人可能把控件挪进别的卡里（标题就找不到了），
       但文案本身还在页面上。
       ⚠️ 注意这里比的是**渲染出来的文本**，不是源码 ——
       所以源码里那些解释历史的注释（比如 types.ts 里写的
       「`streakBonusEnabled` 也删掉」）不会误伤这条断言。 */
    const ruleText = document.body.textContent ?? ''
    for (const banned of ['连续完成奖励', '坚持的奖励阶梯', '每连一天多给', '一次最多加']) {
      expect(ruleText, `「${banned}」不该再出现在设置页`).not.toContain(banned)
    }

    expectRulesPageRendered()
  })
})
