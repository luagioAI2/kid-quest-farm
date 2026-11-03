import { beforeEach, describe, expect, it } from 'vitest'
import {
  __resetGuestPromptForTest,
  __resetLaunchCacheForTest,
  launchCount,
  markNudged,
  NUDGE_AT_LAUNCH,
  resetGuestPrompt,
  shouldNudgeOnLaunch,
} from './guestPrompt'

/* ============================================================
   什么时候提醒（2026-11-03）
   ------------------------------------------------------------
   规则只有一条：**温和提醒一辈子只弹一次**。

   判错的两个方向都有害：
     · 弹太早（第 1 次启动）⇒ 他还没觉得这 App 好玩，先被一个表单拦住；
     · 弹太多次            ⇒ 孩子学会「点掉它」，家长反而更不会看。

   所以这里守：第 1、2 次不弹，第 3 次弹，弹过之后永远不弹。
   ============================================================ */

/**
 * 模拟「重开一次 App」。
 *
 * ⚠️ 直接连调两次 `launchCount()` **不会**加两次 —— 它是模块级缓存的，
 * 一次页面加载只加一次（这正是它的设计：StrictMode 会重跑 effect）。
 * 不模拟重启的话，「第 3 次启动才弹」这条根本验不到（第一次跑就红）。
 */
const relaunch = () => {
  __resetLaunchCacheForTest()
  return launchCount()
}

describe('游客提醒时机', () => {
  beforeEach(() => __resetGuestPromptForTest())

  it('第 1、2 次启动不弹', () => {
    expect(launchCount()).toBe(1)
    expect(shouldNudgeOnLaunch()).toBe(false)
    /* 同一次运行里再问还是 1（不会因为重新渲染又加一次） */
    expect(launchCount()).toBe(1)
    expect(relaunch()).toBe(2)
    expect(shouldNudgeOnLaunch()).toBe(false)
  })

  it('★ 第 3 次启动弹', () => {
    expect(NUDGE_AT_LAUNCH).toBe(3)
    launchCount()
    relaunch()
    expect(relaunch()).toBe(3)
    expect(shouldNudgeOnLaunch()).toBe(true)
  })

  it('★ 弹过之后永远不弹（哪怕第 10 次启动）', () => {
    launchCount()
    relaunch()
    relaunch()
    markNudged()
    for (let i = 0; i < 7; i++) relaunch()
    expect(shouldNudgeOnLaunch()).toBe(false)
  })

  it('★ 跨重启也记得「弹过了」', () => {
    launchCount()
    relaunch()
    relaunch()
    markNudged()
    expect(relaunch()).toBe(4)
    expect(shouldNudgeOnLaunch()).toBe(false)
  })

  it('绑好之后 reset：以后又变游客还能再提醒一次', () => {
    launchCount()
    relaunch()
    relaunch()
    markNudged()
    resetGuestPrompt()
    expect(launchCount()).toBe(1)
    expect(shouldNudgeOnLaunch()).toBe(false)
  })

  it('存不住也不炸（隐私模式）：宁可永远不弹，也不要每次启动都弹', () => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = () => {
      throw new Error('quota')
    }
    try {
      expect(() => launchCount()).not.toThrow()
      expect(shouldNudgeOnLaunch()).toBe(false)
    } finally {
      Storage.prototype.setItem = original
    }
  })
})
