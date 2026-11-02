import { describe, expect, it } from 'vitest'
import { isServerId, serverIdOf } from './ids'
import { createBody, taskExtraFrom, updateBody } from './tasks'
import { parseTaskExtra } from '../sync/map'
import type { NewTaskInput } from '../store/useApp'
import type { Task } from '../domain/types'

/* ============================================================
   在线版 · 纯函数单测
   ------------------------------------------------------------
   这一层最容易出的错**都不是异常**：
     · id 切错 → 发给服务端 NaN → 回「任务不存在」→ 界面说「任务没了」
     · 字段漏映射 → 家长改了设置不生效，回显还是旧的
     · extra 整块覆盖 → 只改一个参数把另外两个抹掉
   所以每条都直接断言「翻译出来的请求体长什么样」。
   ============================================================ */

describe('serverIdOf', () => {
  it('正常的两类 id 都能取回数字', () => {
    expect(serverIdOf('srv_task_12', 'task')).toBe(12)
    expect(serverIdOf('srv_inst_7', 'inst')).toBe(7)
  })

  it('种类对不上就返回 null（别把任务 id 当实例 id 发出去）', () => {
    expect(serverIdOf('srv_task_12', 'inst')).toBeNull()
    expect(serverIdOf('srv_inst_7', 'task')).toBeNull()
  })

  it('本地版遗留的 id 返回 null', () => {
    expect(serverIdOf('tk_m3k9', 'task')).toBeNull()
    expect(serverIdOf('ti_abc', 'inst')).toBeNull()
    expect(serverIdOf('', 'task')).toBeNull()
  })

  it('数字不合法也返回 null（0 / 负数 / 非数字都不该发出去）', () => {
    expect(serverIdOf('srv_task_0', 'task')).toBeNull()
    expect(serverIdOf('srv_task_-1', 'task')).toBeNull()
    expect(serverIdOf('srv_task_abc', 'task')).toBeNull()
  })

  it('isServerId 认得三类前缀', () => {
    expect(isServerId('srv_task_1')).toBe(true)
    expect(isServerId('srv_inst_1')).toBe(true)
    expect(isServerId('srv_ledger_1')).toBe(true)
    expect(isServerId('tk_1')).toBe(false)
  })
})

const INPUT: NewTaskInput = {
  title: '整理书桌',
  note: '把玩具收进盒子',
  category: 'chore',
  cycle: 'daily',
  plannedMinutes: 15,
  basePoints: 8,
  allowOvertime: true,
  allowLateNoPenalty: false,
  qualityRated: true,
  rewardItemIds: ['produce-radish'],
  checkInEnabled: false,
  checkInTargetCount: 0,
  remindAt: '19:30',
}

describe('createBody', () => {
  it('camelCase → snake_case 一个都不漏', () => {
    const b = createBody(INPUT)
    expect(b.title).toBe('整理书桌')
    expect(b.note).toBe('把玩具收进盒子')
    expect(b.category).toBe('chore')
    expect(b.cycle).toBe('daily')
    expect(b.planned_minutes).toBe(15)
    expect(b.base_points).toBe(8)
    expect(b.allow_overtime).toBe(true)
    expect(b.allow_late_no_penalty).toBe(false)
    expect(b.quality_rated).toBe(true)
    expect(b.reward_item_ids).toEqual(['produce-radish'])
    expect(b.check_in_enabled).toBe(false)
    expect(b.remind_at).toBe('19:30')
  })

  it('没有玩法参数时不带 extra（别把空对象传上去）', () => {
    expect(createBody(INPUT).extra).toBeUndefined()
  })

  it('有玩法参数时进 extra', () => {
    const b = createBody({ ...INPUT, checkInTierRatio: 1.2, streakPerDay: 3 })
    expect(JSON.parse(b.extra!)).toEqual({ checkInTierRatio: 1.2, streakPerDay: 3 })
  })
})

describe('updateBody', () => {
  const full: Task = {
    ...INPUT,
    id: 'srv_task_1',
    createdAt: 0,
    updatedAt: 0,
    checkInTierRatio: 1.5,
    streakPerDay: 2,
    streakCap: 30,
  } as Task

  it('只改一个字段时，别的字段按当前值补齐（不是只发改的那个）', () => {
    const b = updateBody({ basePoints: 20 }, full)
    expect(b.base_points).toBe(20)
    // 服务端 update 是按字段覆盖的，这里补齐的是「值」，不是「改动」
    expect(b.title).toBe('整理书桌')
  })

  it('★ 只改连击封顶，不能把阶梯倍率抹掉', () => {
    const b = updateBody({ streakCap: 50 }, full)
    expect(JSON.parse(b.extra!)).toEqual({
      checkInTierRatio: 1.5,
      streakPerDay: 2,
      streakCap: 50,
    })
  })

  it('archived 走同一个接口，且能被带上', () => {
    expect(updateBody({ archived: true }, full).archived).toBe(true)
    expect(updateBody({ title: 'x' }, full).archived).toBeUndefined()
  })
})

describe('taskExtraFrom / parseTaskExtra', () => {
  it('两个方向能对上（写进去的能读回来）', () => {
    const raw = taskExtraFrom({ checkInTierRatio: 0.9, streakCap: 40 })!
    expect(parseTaskExtra(raw)).toEqual({ checkInTierRatio: 0.9, streakCap: 40 })
  })

  it('空 / 坏 JSON 都不炸，回落成空对象', () => {
    expect(parseTaskExtra(undefined)).toEqual({})
    expect(parseTaskExtra('')).toEqual({})
    expect(parseTaskExtra('{不是 json')).toEqual({})
  })

  it('非数字的字段被丢掉（手改过库也不会把 NaN 带进结算）', () => {
    expect(parseTaskExtra('{"checkInTierRatio":"高","streakPerDay":3}')).toEqual({
      streakPerDay: 3,
    })
  })
})
