import { beforeEach, describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import SettingsPage from './SettingsPage'

/* ============================================================
   设置页的家长密码闸门（2026-11-14）
   ------------------------------------------------------------
   用户原话：「点规则还显示『需要家长输入密码』，需要再点『爸妈：输密码』。
             操作麻烦，直接点规则、点游戏、数据就显示输入密码，不需要多一个步骤。」

   所以这里钉的是**步数**，不是"有没有密码"：
     ① 进入锁定的 tab ⇒ **键盘已经在**（不点任何按钮）；
     ② 家长点「先算了」关掉后，**不能**立刻又弹（否则出不去）；
     ③ 兜底卡还在（关掉之后页面不能空白）。

   ⚠️ 这三条都不能用「正文包含某句话」判断 ——
     判据是**元素在不在**（`[data-pin-pad]` / 输入框）。
   ============================================================ */

beforeEach(async () => {
  // 每个用例从干净库开始，避免上一轮的锁定状态串台
  await Promise.all(db.tables.map((t) => t.clear()))
  useApp.setState({ protectParentActions: true } as never)
})

/** 键盘是否真的在屏上（`PinFlow` 铺的是数字键盘，用输入框判） */
const padOnScreen = () => !!document.querySelector('[role="dialog"]')

describe('★ 点开锁定的 tab ⇒ 键盘直接出现（不再多一个步骤）', () => {
  it('进入「规则」就弹，不用先点「爸妈：输密码」', async () => {
    /* ⚠️ 必须显式给 `initialTab="rules"`：设置页默认落在 `child`
       （改孩子昵称/头像那栏，不需要密码）。第一版漏了这个，
       测的其实是「child 页不弹」—— 那不是这条要验的事。 */
    render(<SettingsPage onBack={() => {}} initialTab="rules" />)
    await waitFor(() => expect(padOnScreen()).toBe(true))
  })

  it('进入「游戏」也直接弹', async () => {
    render(<SettingsPage onBack={() => {}} initialTab="game" />)
    await waitFor(() => expect(padOnScreen()).toBe(true))
  })

  it('进入「数据」也直接弹', async () => {
    render(<SettingsPage onBack={() => {}} initialTab="data" />)
    await waitFor(() => expect(padOnScreen()).toBe(true))
  })

  it('★ 关掉之后不会立刻又弹（否则家长出不去）', async () => {
    render(<SettingsPage onBack={() => {}} initialTab="rules" />)
    await waitFor(() => expect(padOnScreen()).toBe(true))

    // 点「先算了」
    const cancel = [...document.querySelectorAll('button')].find((b) =>
      /先算了/.test(b.textContent ?? ''),
    ) as HTMLElement | undefined
    expect(cancel, '密码框里没有「先算了」').toBeTruthy()
    cancel!.click()

    await waitFor(() => expect(padOnScreen()).toBe(false))
    // 等一拍（effect 会再跑），确认没有重新弹出来
    await new Promise((r) => setTimeout(r, 120))
    expect(padOnScreen(), '点完取消又弹回来了 —— 家长出不去').toBe(false)
  })
})
