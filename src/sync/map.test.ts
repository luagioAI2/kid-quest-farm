import { describe, expect, it, vi } from 'vitest'
import { mapInstance, mapLedger, mapTask, secToMs, srvId } from './map'
import type { ServerInstance, ServerTask } from '../api/task'
import type { ServerLedgerEntry } from '../api/wallet'

/* 一条**真的**服务端返回（2026-11-02 从 /api/task/board 抓下来的），
   别自己编字段名 —— 编出来的字段名永远是对的，接口永远不认。 */
const INSTANCE: ServerInstance = {
  id: 3,
  created_at: 1793590380,
  updated_at: 1793590380,
  uid: 3,
  task_id: 3,
  period_key: '2026-11-02',
  date: '2026-11-02',
  title: '完成语文作业',
  category: 'study',
  cycle: 'daily',
  planned_minutes: 30,
  base_points: 10,
  allow_overtime: false,
  allow_late_no_penalty: false,
  quality_rated: true,
  reward_item_ids: [],
  status: 'completed',
  actual_minutes: 20,
  earned_points: 12,
  quality: 'great',
  started_at: 1793590380,
  paused_at: null,
  paused_total_ms: 0,
  submitted_at: 1793590380,
  settled_at: 1793590380,
  completed_at: 1793590380,
  backfilled: false,
  reject_reason: '',
  review_note: '写得好',
}

const TASK: ServerTask = {
  id: 3,
  created_at: 1793590000,
  updated_at: 1793590000,
  uid: 3,
  title: '完成语文作业',
  note: '',
  category: 'study',
  cycle: 'daily',
  planned_minutes: 30,
  base_points: 10,
  allow_overtime: false,
  allow_late_no_penalty: false,
  quality_rated: true,
  reward_item_ids: null,
  window_start_minute: null,
  window_end_minute: null,
  check_in_enabled: false,
  check_in_target_count: 0,
  remind_at: '',
  archived: false,
  sort: 0,
}

const LEDGER: ServerLedgerEntry = {
  id: 18,
  currency: 'points',
  delta: 12,
  balance_after: 136,
  source: 'task_reward',
  ref_id: '3',
  memo: '完成任务：完成语文作业',
  created_at: 1793590380,
}

describe('secToMs', () => {
  it('秒 → 毫秒', () => {
    expect(secToMs(1793590380)).toBe(1793590380000)
  })

  it('空值返回 undefined，不是 0', () => {
    // ★ 这条是重点：0 会被当成 1970-01-01，计时器显示成 1970 年还不报错
    expect(secToMs(null)).toBeUndefined()
    expect(secToMs(undefined)).toBeUndefined()
  })
})

describe('mapInstance', () => {
  it('计时字段全部换成毫秒', () => {
    const i = mapInstance(INSTANCE)
    expect(i.startedAt).toBe(1793590380000)
    expect(i.submittedAt).toBe(1793590380000)
    expect(i.settledAt).toBe(1793590380000)
    expect(i.completedAt).toBe(1793590380000)
    // 没暂停过 → 保持 undefined，而不是 0
    expect(i.pausedAt).toBeUndefined()
  })

  it('id 带前缀，且和 taskId 对得上', () => {
    const i = mapInstance(INSTANCE)
    expect(i.id).toBe(srvId('inst', 3))
    expect(i.taskId).toBe(srvId('task', 3))
    expect(i.id).not.toBe(String(INSTANCE.id))
  })

  it('状态 / 质量 / 分类原样搬过来', () => {
    const i = mapInstance(INSTANCE)
    expect(i.status).toBe('completed')
    expect(i.quality).toBe('great')
    expect(i.category).toBe('study')
    expect(i.earnedPoints).toBe(12)
  })

  it('服务端给了本地不认识的枚举值 → 回落，不产出 undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const i = mapInstance({ ...INSTANCE, status: 'some_new_status', category: 'music' })
    expect(i.status).toBe('pending')
    expect(i.category).toBe('study')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('空字符串的 quality 映射成 undefined（不是非法枚举）', () => {
    expect(mapInstance({ ...INSTANCE, quality: '' }).quality).toBeUndefined()
  })
})

describe('mapTask', () => {
  it('字段照搬，note 空串变 undefined', () => {
    const t = mapTask(TASK)
    expect(t.id).toBe(srvId('task', 3))
    expect(t.title).toBe('完成语文作业')
    expect(t.note).toBeUndefined()
    expect(t.plannedMinutes).toBe(30)
    expect(t.createdAt).toBe(1793590000000)
  })

  it('checkInTargetCount 为 0 时不写成 0（本地约定 0 = 没设）', () => {
    expect(mapTask(TASK).checkInTargetCount).toBeUndefined()
  })
})

describe('mapLedger', () => {
  it('积分流水映射来源与余额', () => {
    const e = mapLedger(LEDGER)
    expect(e).not.toBeNull()
    expect(e!.source).toBe('task')
    expect(e!.delta).toBe(12)
    expect(e!.balanceAfter).toBe(136)
    expect(e!.createdAt).toBe(1793590380000)
  })

  it('非积分币种直接丢掉（兑换券有自己的表）', () => {
    expect(mapLedger({ ...LEDGER, currency: 'coupon' })).toBeNull()
    expect(mapLedger({ ...LEDGER, currency: 'diamond' })).toBeNull()
  })

  it('不认识的来源落 manual_adjust，而不是丢行', () => {
    // 丢行 ⇒ 余额求和比服务端少，界面上看不出来
    const e = mapLedger({ ...LEDGER, source: 'brand_new_source' })
    expect(e).not.toBeNull()
    expect(e!.source).toBe('manual_adjust')
  })
})
