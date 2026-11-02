import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { pullFromServer, pullOnce } from './pull'
import type { ServerBoard, ServerInstance, ServerTask } from '../api/task'
import type { ServerLedgerEntry } from '../api/wallet'
import type { ServerRedeemRecord, ServerRedeemRow } from '../api/redeem'

/* 接口全部 mock 掉 —— 这一层要验的是「搬进本地表」的行为，
   真连服务端是 `scripts/_probe-task-chain.mjs` 的活。 */
const boardMock = vi.fn()
const listTasksMock = vi.fn()
const walletInfoMock = vi.fn()
const walletLedgerMock = vi.fn()
const redeemRowsMock = vi.fn()
const redeemRecsMock = vi.fn()

vi.mock('../api/task', () => ({
  board: () => boardMock(),
  listTasks: (a: boolean) => listTasksMock(a),
}))
vi.mock('../api/wallet', () => ({
  walletInfo: () => walletInfoMock(),
  walletLedger: (p: number, s: number) => walletLedgerMock(p, s),
}))
vi.mock('../api/redeem', () => ({
  listRedeemRows: (o: unknown) => redeemRowsMock(o),
  listRedeemRecords: (p: number, s: number) => redeemRecsMock(p, s),
}))

const TASK: ServerTask = {
  id: 7,
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
  quality_rated: false,
  reward_item_ids: null,
  window_start_minute: null,
  window_end_minute: null,
  check_in_enabled: false,
  check_in_target_count: 0,
  remind_at: '',
  archived: false,
  sort: 0,
}

const INST: ServerInstance = {
  id: 21,
  created_at: 1793590380,
  updated_at: 1793590380,
  uid: 3,
  task_id: 7,
  period_key: '2026-11-02',
  date: '2026-11-02',
  title: '完成语文作业',
  category: 'study',
  cycle: 'daily',
  planned_minutes: 30,
  base_points: 10,
  allow_overtime: false,
  allow_late_no_penalty: false,
  quality_rated: false,
  reward_item_ids: [],
  status: 'pending',
  actual_minutes: null,
  earned_points: null,
  quality: '',
  started_at: null,
  paused_at: null,
  paused_total_ms: 0,
  submitted_at: null,
  settled_at: null,
  completed_at: null,
  backfilled: false,
  reject_reason: '',
  review_note: '',
}

const LEDGER: ServerLedgerEntry = {
  id: 30,
  currency: 'points',
  delta: 12,
  balance_after: 112,
  source: 'task_reward',
  ref_id: '21',
  memo: '完成任务',
  created_at: 1793590380,
}

const BOARD: ServerBoard = {
  date: '2026-11-02',
  total: 1,
  completed: 0,
  pending: 1,
  submitted: 0,
  today_points: 0,
  balance: 112,
  instances: [INST],
}

/** 一条「家里的兑换品」（`source === 'redeem'`） */
const ROW: ServerRedeemRow = {
  source: 'redeem',
  id: 'rd-abc',
  name: '玩 30 分钟平板',
  emoji: '📱',
  category: 'screen',
  note: '周末才能用',
  price: 50,
  plan: { harvest_paid: 30, points_paid: 20, total: 50, affordable: true, shortfall: 0 },
  can_redeem: true,
  description: '30 兑换券 + 20 积分',
  blocked_by_limit: false,
  today_count: 0,
  remaining_today: 2,
  once: false,
  stock: -1,
  archived: false,
  limit_per_day: 2,
  created_by_parent: true,
  created_at: 1793590000,
  updated_at: 1793590000,
  visible: true,
}

/** 一条「心愿商品被定价」（`source === 'wish'`）—— **不能**进兑换品表 */
const WISH_ROW: ServerRedeemRow = {
  ...ROW,
  source: 'wish',
  id: 'wi-xyz',
  name: '小恐龙玩具',
  category: 'gift',
  price: 300,
}

const REC: ServerRedeemRecord = {
  id: 'RR1700000000123',
  item_id: 'rd-abc',
  name: '玩 30 分钟平板',
  emoji: '📱',
  quantity: 1,
  cost: 50,
  harvest_paid: 30,
  points_paid: 20,
  balance_after: 80,
  harvest_balance_after: 5,
  fulfilled: false,
  fulfilled_at: null,
  cancelled: false,
  cancel_reason: '',
  created_at: 1793590100,
}

beforeEach(async () => {
  await Promise.all([
    db.tasks.clear(),
    db.taskInstances.clear(),
    db.ledger.clear(),
    db.redeemItems.clear(),
    db.redeemRecords.clear(),
  ])
  boardMock.mockReset()
  listTasksMock.mockReset()
  walletInfoMock.mockReset()
  walletLedgerMock.mockReset()
  redeemRowsMock.mockReset()
  redeemRecsMock.mockReset()
  boardMock.mockResolvedValue(BOARD)
  listTasksMock.mockResolvedValue({ count: 1, list: [TASK] })
  walletInfoMock.mockResolvedValue({ uid: 3, points: 112, coupon: 0, diamond: 0 })
  walletLedgerMock.mockResolvedValue({ count: 1, list: [LEDGER] })
  redeemRowsMock.mockResolvedValue({ count: 2, list: [ROW, WISH_ROW] })
  redeemRecsMock.mockResolvedValue({ count: 1, list: [REC] })
})

describe('pullOnce', () => {
  it('把服务端的任务 / 实例 / 流水搬进本地表', async () => {
    const r = await pullOnce()
    expect(r.ok).toBe(true)
    expect(r.tasks).toBe(1)
    expect(r.instances).toBe(1)
    expect(r.ledger).toBe(1)

    const tasks = await db.tasks.toArray()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe('srv_task_7')
    expect(tasks[0].title).toBe('完成语文作业')

    const insts = await db.taskInstances.toArray()
    expect(insts[0].id).toBe('srv_inst_21')
    expect(insts[0].taskId).toBe('srv_task_7')

    const ledger = await db.ledger.toArray()
    expect(ledger[0].id).toBe('srv_ledger_30')
    expect(ledger[0].balanceAfter).toBe(112)
  })

  it('重拉是幂等的：不会出现两份', async () => {
    await pullOnce()
    await pullOnce()
    expect(await db.tasks.count()).toBe(1)
    expect(await db.taskInstances.count()).toBe(1)
    expect(await db.ledger.count()).toBe(1)
  })

  it('服务端删掉的行，重拉之后本地也没了', async () => {
    await pullOnce()
    boardMock.mockResolvedValue({ ...BOARD, total: 0, pending: 0, instances: [] })
    await pullOnce()
    expect(await db.taskInstances.count()).toBe(0)
  })

  it('★ 拉取失败不能动本地已有数据', async () => {
    await pullOnce()
    const before = await db.taskInstances.toArray()

    boardMock.mockRejectedValue(new Error('连不上服务器'))
    const r = await pullOnce()

    expect(r.ok).toBe(false)
    expect(r.reason).toBe('连不上服务器')
    expect(await db.taskInstances.toArray()).toEqual(before)
  })

  it('★ 本地自己的行不会被清掉（本地版 / 在线版共用同一套表）', async () => {
    await pullOnce()
    // 造一条「本地生成」的行：换 id、换日期，避开表上的唯一索引
    await db.taskInstances.put({
      id: 'local_inst_1',
      taskId: 'local_task_1',
      periodKey: '2026-11-01',
      date: '2026-11-01',
      title: '本地任务',
      category: 'chore',
      cycle: 'once',
      plannedMinutes: 10,
      basePoints: 5,
      allowOvertime: false,
      allowLateNoPenalty: false,
      qualityRated: false,
      rewardItemIds: [],
      status: 'pending',
      createdAt: 1793500000000,
      updatedAt: 1793500000000,
    })

    boardMock.mockResolvedValue({ ...BOARD, total: 0, pending: 0, instances: [] })
    await pullOnce()

    const ids = (await db.taskInstances.toArray()).map((r) => r.id)
    expect(ids).toEqual(['local_inst_1'])
  })

  it('钱包挂了不影响任务板（两件事不该一起死）', async () => {
    walletInfoMock.mockRejectedValue(new Error('wallet down'))
    walletLedgerMock.mockRejectedValue(new Error('wallet down'))
    const r = await pullOnce()
    expect(r.ok).toBe(true)
    expect(r.tasks).toBe(1)
    expect(r.balance).toBe(BOARD.balance) // 回落用任务板里的 balance
  })

  it('★ 兑换商城：商品用 raw 拉，心愿行不进兑换品表', async () => {
    const r = await pullOnce()
    expect(r.ok).toBe(true)
    expect(r.redeemItems).toBe(1)
    expect(r.redeemRecords).toBe(1)

    // 必须是 raw + 含已下架，否则「换过的一次性商品」在家长管理页会消失
    expect(redeemRowsMock).toHaveBeenCalledWith({ includeArchived: true, raw: true })

    const items = await db.redeemItems.toArray()
    expect(items.map((i) => i.id)).toEqual(['rd-abc'])
    expect(items[0].cost).toBe(50) // 服务端叫 price，本地叫 cost
    expect(items[0].limitPerDay).toBe(2)
    expect(items[0].visible).toBe(true)

    const recs = await db.redeemRecords.toArray()
    expect(recs[0].id).toBe('srv_rr_RR1700000000123')
    expect(recs[0].itemId).toBe('rd-abc')
    expect(recs[0].harvestPaid).toBe(30)
    expect(recs[0].pointsPaid).toBe(20)
    expect(recs[0].createdAt).toBe(1793590100 * 1000)
  })

  it('★ 已取消的兑换记录不进来（否则家长会看到一条退过款的「待兑现」）', async () => {
    redeemRecsMock.mockResolvedValue({
      count: 1,
      list: [{ ...REC, cancelled: true, cancel_reason: '不想要了' }],
    })
    const r = await pullOnce()
    expect(r.redeemRecords).toBe(0)
    expect(await db.redeemRecords.count()).toBe(0)
  })

  it('★ 商城挂了不影响任务板（同一份 App，两件事不该一起死）', async () => {
    redeemRowsMock.mockRejectedValue(new Error('redeem down'))
    redeemRecsMock.mockRejectedValue(new Error('redeem down'))
    const r = await pullOnce()
    expect(r.ok).toBe(true)
    expect(r.tasks).toBe(1)
    expect(r.redeemItems).toBe(0)
  })

  it('★ 兑换品表整张清空：服务端删掉的商品不会留在本地', async () => {
    await pullOnce()
    expect(await db.redeemItems.count()).toBe(1)

    redeemRowsMock.mockResolvedValue({ count: 0, list: [] })
    await pullOnce()
    expect(await db.redeemItems.count()).toBe(0)
  })
})

describe('pullFromServer 的模式闸门', () => {
  it('本地版（默认构建）一个请求都不发', async () => {
    const r = await pullFromServer()
    expect(r).toEqual({ ok: true, reason: 'local' })
    expect(boardMock).not.toHaveBeenCalled()
  })
})
