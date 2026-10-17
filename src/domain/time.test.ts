import { describe, expect, it } from 'vitest'
import { isPaused, runningMinutes, runningMs } from './time'

/* ============================================================
   计时器用时（含暂停扣减）
   ------------------------------------------------------------
   客户反馈：「任务需要暂停和恢复」。孩子做作业中途去吃饭 /
   被叫走，这段不该算进「实际用时」—— 否则会被判超时白扣分。

   实现只有一条算法：`runningMs()`。**这个文件把它钉住**，
   因为一旦它错了，四个调用点（tick 自动收尾 / 提交兜底 /
   秒表 / 预填用时）会**一起**错，而且错得很安静：
   用时偏大 → 超时 → 扣分，孩子和家长都看不出是哪一步算错的。
   ============================================================ */

/** 一个固定时刻，测试里全部相对它算，避免真实时钟抖动 */
const T0 = new Date('2026-10-17T09:00:00').getTime()
const min = (n: number) => n * 60_000

describe('runningMs：没暂停时就是 now - startedAt', () => {
  it('普通情况', () => {
    expect(runningMs({ startedAt: T0 }, T0 + min(30))).toBe(min(30))
  })

  it('没点过「开始」→ 恒为 0（不能拿 now 当用时）', () => {
    expect(runningMs({}, T0)).toBe(0)
    expect(runningMs({ startedAt: undefined }, T0 + min(999))).toBe(0)
  })

  it('now 早于 startedAt → 夹到 0，不返回负数', () => {
    // 跨逻辑日自动收尾会传 `min(now, 当日 0 点)`，可能早于 startedAt
    expect(runningMs({ startedAt: T0 }, T0 - min(10))).toBe(0)
  })
})

describe('runningMs：暂停中的时长要扣掉', () => {
  it('暂停中 → 用 pausedAt 当参照点，时间冻住', () => {
    // 9:00 开始，9:20 暂停；到 9:50 来问，仍然只该算 20 分钟
    const inst = { startedAt: T0, pausedAt: T0 + min(20) }
    expect(runningMs(inst, T0 + min(20))).toBe(min(20))
    expect(runningMs(inst, T0 + min(35))).toBe(min(20))
    expect(runningMs(inst, T0 + min(50))).toBe(min(20))
  })

  it('恢复之后 → 扣掉累计暂停，继续往下走', () => {
    // 9:00 开始 → 9:20~9:50 暂停 30 分 → 9:50 恢复
    const inst = { startedAt: T0, pausedTotalMs: min(30) }
    expect(runningMs(inst, T0 + min(50))).toBe(min(20)) // 9:50 时只干了 20 分
    expect(runningMs(inst, T0 + min(60))).toBe(min(30)) // 再过 10 分 → 30 分
  })

  it('多次暂停 → 累计量相加', () => {
    const inst = { startedAt: T0, pausedTotalMs: min(10) + min(25) }
    expect(runningMs(inst, T0 + min(100))).toBe(min(65))
  })

  it('★ 暂停时长不可能把用时扣成负数（夹到 0）', () => {
    // 防御：数据损坏 / 手动导入备份把 pausedTotalMs 写得比实际还大
    const inst = { startedAt: T0, pausedTotalMs: min(999) }
    expect(runningMs(inst, T0 + min(5))).toBe(0)
  })

  it('★ 同时「已累计暂停」和「正在暂停」→ 两段都要扣', () => {
    // 9:00 开始 → 9:10~9:20 暂停（已累计 10 分）→ 9:20 恢复 →
    // 9:40 又暂停 → 10:00 来问：只该算 9:00~9:10 + 9:20~9:40 = 30 分
    const inst = { startedAt: T0, pausedTotalMs: min(10), pausedAt: T0 + min(40) }
    expect(runningMs(inst, T0 + min(60))).toBe(min(30))
  })
})

describe('runningMs：跨逻辑日自动收尾那个边界', () => {
  it('★ `now` 早于 `pausedAt` 时，不能把暂停时长加回去', () => {
    /*
      这是唯一一个「暂停中 + 参照点在过去」的组合，也是最容易写错的：
      tick() 传的 end 是 `min(now, 当日 0 点)`。如果孩子是**今天凌晨**
      才点的暂停，而收尾算的是**昨天 0 点**，那么 `end - pausedAt` 是负数。
      不夹 0 的话，负数会被减掉 ⇒ 用时**变大** ⇒ 反而判超时。
    */
    const endOfYesterday = T0 // 参照点
    const inst = { startedAt: T0 - min(120), pausedAt: T0 + min(30) }
    // 参照点早于 pausedAt ⇒ 那一段暂停还没发生 ⇒ 全额算 120 分
    expect(runningMs(inst, endOfYesterday)).toBe(min(120))
  })

  it('暂停发生在参照点之前 → 正常扣减', () => {
    const inst = { startedAt: T0, pausedAt: T0 + min(10) }
    expect(runningMs(inst, T0 + min(40))).toBe(min(10))
  })
})

describe('runningMinutes / isPaused', () => {
  it('runningMinutes 是 runningMs 的分钟版', () => {
    expect(runningMinutes({ startedAt: T0 }, T0 + min(45))).toBe(45)
    expect(runningMinutes({ startedAt: T0 }, T0 + min(45) + 30_000)).toBeCloseTo(45.5, 6)
  })

  it('isPaused 只看 pausedAt 有没有值', () => {
    expect(isPaused({ startedAt: T0 })).toBe(false)
    expect(isPaused({ startedAt: T0, pausedAt: T0 })).toBe(true)
    // 恢复之后 pausedTotalMs 还在，但不算暂停中
    expect(isPaused({ startedAt: T0, pausedTotalMs: min(10) })).toBe(false)
  })
})
