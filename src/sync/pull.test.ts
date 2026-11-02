import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, gameCoinBalanceOf, getGameKv, readGameCoinLedger, setGameKv } from '../db/db'
import { pullFromServer, pullOnce } from './pull'
import type { ServerBoard, ServerInstance, ServerTask } from '../api/task'
import type { ServerLedgerEntry } from '../api/wallet'
import type { ServerRedeemRecord, ServerRedeemRow } from '../api/redeem'
import type { ServerWishItemView, ServerWishOrder } from '../api/wish'

/* 接口全部 mock 掉 —— 这一层要验的是「搬进本地表」的行为，
   真连服务端是 `scripts/_probe-task-chain.mjs` 的活。 */
const boardMock = vi.fn()
const listTasksMock = vi.fn()
const walletInfoMock = vi.fn()
const walletLedgerMock = vi.fn()
const redeemRowsMock = vi.fn()
const redeemRecsMock = vi.fn()
const wishListMock = vi.fn()
const wishOrdersMock = vi.fn()
const coinListMock = vi.fn()

vi.mock('../api/task', () => ({
  board: () => boardMock(),
  listTasks: (a: boolean) => listTasksMock(a),
}))
vi.mock('../api/wallet', () => ({
  walletInfo: () => walletInfoMock(),
  walletLedger: (p: number, s: number) => walletLedgerMock(p, s),
  /* `online/coin.ts` 也从这个模块拿 `walletSpend`（插件扣积分）。
     不导出的话它是个 undefined，等到真调用时才炸 —— 而这一层不测那条路。 */
  walletSpend: () => Promise.resolve({ uid: 3, points: 0, coupon: 0, diamond: 0 }),
}))
vi.mock('../api/coin', () => ({
  listCoinInfo: () => coinListMock(),
  coinInfo: () => coinListMock(),
  coinLedger: () => Promise.resolve({ count: 0, list: [] }),
  buyCoins: () => Promise.reject(new Error('不该被调用')),
  spendCoins: () => Promise.reject(new Error('不该被调用')),
  mintCoins: () => Promise.reject(new Error('不该被调用')),
  redeemCoins: () => Promise.reject(new Error('不该被调用')),
  mintVouchers: () => Promise.reject(new Error('不该被调用')),
}))
vi.mock('../api/redeem', () => ({
  listRedeemRows: (o: unknown) => redeemRowsMock(o),
  listRedeemRecords: (p: number, s: number) => redeemRecsMock(p, s),
}))
vi.mock('../api/wish', () => ({
  listWishItems: (o: unknown) => wishListMock(o),
  listWishOrders: (o: unknown) => wishOrdersMock(o),
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

const WISH_OPEN: ServerWishItemView = {
  id: 'wish-popmart',
  kind: 'collectible',
  name: '泡泡玛特盲盒',
  emoji: '🧸',
  tint: 'grape',
  partner_name: '泡泡玛特',
  pool: null,
  game_id: '',
  price_cents: 6900,
  age_range: [6, 99],
  note: '',
  notice: '',
  archived: false,
  sort_order: 20,
  open: true,
  voucher_price: 30,
  affordable: true,
  shortfall: 0,
  has_order: false,
  owned: false,
  my_wish: false,
  days_to_save: 3,
  blind_box_remaining: 0,
}

/** 家长定过价、后来**关掉**的那件 —— 不能落成 `WishOffer` 行 */
const WISH_CLOSED: ServerWishItemView = {
  ...WISH_OPEN,
  id: 'wish-dino',
  name: '恐龙模型套装',
  open: false,
  voucher_price: 0,
}

const WISH_ORDER: ServerWishOrder = {
  id: 'WO1700000000456',
  item_id: 'wish-popmart',
  kind: 'collectible',
  item_name: '泡泡玛特盲盒',
  item_emoji: '🧸',
  partner_name: '泡泡玛特',
  voucher_price: 30,
  status: 'committed',
  vouchers_held: 30,
  points_held: 0,
  opened_game_id: '',
  code_tail: '',
  ship: null,
  tracking_no: '',
  committed_at: 1793590300,
  confirmed_at: null,
  done_at: null,
  cancelled_at: null,
  cancel_reason: '',
  created_at: 1793590000,
  updated_at: 1793590300,
  status_text: '等爸妈确认',
  digital: false,
}

beforeEach(async () => {
  await Promise.all([
    db.tasks.clear(),
    db.taskInstances.clear(),
    db.ledger.clear(),
    db.redeemItems.clear(),
    db.redeemRecords.clear(),
    db.wishOffers.clear(),
    db.wishOrders.clear(),
    db.gameKv.clear(),
  ])
  boardMock.mockReset()
  listTasksMock.mockReset()
  walletInfoMock.mockReset()
  walletLedgerMock.mockReset()
  redeemRowsMock.mockReset()
  redeemRecsMock.mockReset()
  wishListMock.mockReset()
  wishOrdersMock.mockReset()
  coinListMock.mockReset()
  boardMock.mockResolvedValue(BOARD)
  listTasksMock.mockResolvedValue({ count: 1, list: [TASK] })
  walletInfoMock.mockResolvedValue({ uid: 3, points: 112, coupon: 0, diamond: 0 })
  walletLedgerMock.mockResolvedValue({ count: 1, list: [LEDGER] })
  redeemRowsMock.mockResolvedValue({ count: 2, list: [ROW, WISH_ROW] })
  redeemRecsMock.mockResolvedValue({ count: 1, list: [REC] })
  wishListMock.mockResolvedValue({ count: 2, list: [WISH_OPEN, WISH_CLOSED] })
  wishOrdersMock.mockResolvedValue({ page: 1, pageSize: 200, count: 1, list: [WISH_ORDER] })
  coinListMock.mockResolvedValue({ count: 0, list: [] })
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

  it('★ 流水要翻页拉全（本地余额 = 流水求和，少一页就少一截）', async () => {
    /* 造 200 条第一页 + 5 条第二页。2026-11-02 实测踩到过：
       服务端每页默认 30 条，客户端只要了「第一页」，账号攒到 33 条之后
       本地余额比服务端少了 124 —— 界面上没有任何异常。 */
    const mk = (id: number) => ({ ...LEDGER, id, delta: 1 })
    const page1 = Array.from({ length: 200 }, (_, i) => mk(i + 1))
    const page2 = Array.from({ length: 5 }, (_, i) => mk(i + 201))
    walletLedgerMock.mockImplementation((page: number) =>
      Promise.resolve({ count: 205, list: page === 1 ? page1 : page2 }),
    )

    const r = await pullOnce()
    expect(r.ledger).toBe(205)
    expect(await db.ledger.count()).toBe(205)
    // 每页都要满 200 才翻下一页（服务端 `Paginator` 的上限就是 200）
    expect(walletLedgerMock).toHaveBeenNthCalledWith(1, 1, 200)
    expect(walletLedgerMock).toHaveBeenNthCalledWith(2, 2, 200)
    expect(walletLedgerMock).toHaveBeenCalledTimes(2) // 第二页不满 200，停
  })

  it('★ 流水拉失败时**不许**清掉本地已有账本', async () => {
    await pullOnce()
    const before = await db.ledger.toArray()
    expect(before.length).toBeGreaterThan(0)

    walletLedgerMock.mockRejectedValue(new Error('ledger down'))
    const r = await pullOnce()
    expect(r.ok).toBe(true) // 任务板照常
    expect(await db.ledger.toArray()).toEqual(before)
  })

  it('★ 商城拉失败时**不许**清掉本地已有的商品', async () => {
    await pullOnce()
    expect(await db.redeemItems.count()).toBe(1)

    redeemRowsMock.mockRejectedValue(new Error('redeem down'))
    await pullOnce()
    expect(await db.redeemItems.count()).toBe(1) // 还在
  })
})

describe('pullFromServer 的模式闸门', () => {
  it('本地版（默认构建）一个请求都不发', async () => {
    const r = await pullFromServer()
    expect(r).toEqual({ ok: true, reason: 'local' })
    expect(boardMock).not.toHaveBeenCalled()
  })
})

describe('pullOnce · 心愿商城', () => {
  it('只把「现在开放」的定价搬进来（关掉的不落行）', async () => {
    const r = await pullOnce()
    expect(r.wishOffers).toBe(1)

    const offers = await db.wishOffers.toArray()
    expect(offers).toHaveLength(1)
    expect(offers[0].itemId).toBe('wish-popmart')
    expect(offers[0].voucherPrice).toBe(30)
    expect(offers[0].closedAt).toBeUndefined()
  })

  it('★ 商品列表要连**下架**的一起拉（否则家长定过价的东西变回「没定价」）', async () => {
    await pullOnce()
    expect(wishListMock).toHaveBeenCalledWith({ includeArchived: true })
  })

  it('★ 心愿单必须用 pageSize（驼峰）+ 家长视角', async () => {
    await pullOnce()
    // 写成 page_size 不会报错，只会永远只回 30 条 —— 这条断言就是防它
    expect(wishOrdersMock).toHaveBeenCalledWith({ page: 1, pageSize: 200, asParent: true })
  })

  it('订单加 srv_wo_ 前缀；已取消的也留着', async () => {
    await pullOnce()
    const rows = await db.wishOrders.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('srv_wo_WO1700000000456')
    expect(rows[0].status).toBe('committed')
    expect(rows[0].vouchersHeld).toBe(30)
  })

  it('重拉幂等：不会出现两份', async () => {
    await pullOnce()
    await pullOnce()
    expect(await db.wishOffers.count()).toBe(1)
    expect(await db.wishOrders.count()).toBe(1)
  })

  it('★ 服务端关掉定价后，重拉要把本地那行删掉', async () => {
    await pullOnce()
    expect(await db.wishOffers.count()).toBe(1)

    wishListMock.mockResolvedValue({ count: 1, list: [WISH_CLOSED] })
    await pullOnce()
    expect(await db.wishOffers.count()).toBe(0)
  })

  it('★ 心愿接口挂了时**不许**清掉本地已有的定价和订单', async () => {
    await pullOnce()
    expect(await db.wishOffers.count()).toBe(1)
    expect(await db.wishOrders.count()).toBe(1)

    wishListMock.mockRejectedValue(new Error('wish down'))
    wishOrdersMock.mockRejectedValue(new Error('wish down'))
    const r = await pullOnce()

    expect(r.ok).toBe(true) // 任务那些照旧拉到了
    expect(await db.wishOffers.count()).toBe(1)
    expect(await db.wishOrders.count()).toBe(1)
  })

  it('本地那两条 `wo…` 行不会被服务端数据挤掉（前缀不同，清不到它们）', async () => {
    await db.wishOrders.put({
      id: 'woabc',
      itemId: 'wish-dino',
      itemName: '恐龙模型套装',
      itemEmoji: '🦖',
      kind: 'toy',
      voucherPrice: 0,
      status: 'wished',
      vouchersHeld: 0,
      createdAt: 1793580000000,
    })
    await pullOnce()
    const ids = (await db.wishOrders.toArray()).map((o) => o.id).sort()
    expect(ids).toEqual(['srv_wo_WO1700000000456', 'woabc'])
  })
})

describe('pullOnce · 游戏币镜像', () => {
  it('把服务端余额写成 `__coin` 的单行镜像（求和 == 服务端那个数）', async () => {
    coinListMock.mockResolvedValue({
      count: 2,
      list: [
        { game_id: 'cloudfarm', balance: 7, total_earned: 9, total_spent: 2 },
        { game_id: 'screamchick', balance: 3, total_earned: 3, total_spent: 0 },
      ],
    })
    const r = await pullOnce()
    expect(r.coins).toBe(2)

    const a = await readGameCoinLedger('cloudfarm')
    expect(a).toHaveLength(1)
    expect(a[0].delta).toBe(7)
    expect(await gameCoinBalanceOf('cloudfarm')).toBe(7)
    expect(await gameCoinBalanceOf('screamchick')).toBe(3)
  })

  it('★ 服务端这次没返回的游戏，镜像要被**清掉**（否则本地币比服务端多）', async () => {
    coinListMock.mockResolvedValue({
      count: 2,
      list: [
        { game_id: 'cloudfarm', balance: 7, total_earned: 9, total_spent: 2 },
        { game_id: 'screamchick', balance: 3, total_earned: 3, total_spent: 0 },
      ],
    })
    await pullOnce()
    expect(await gameCoinBalanceOf('screamchick')).toBe(3)

    // 服务端把 screamchick 的钱包清了 / 没开过 —— 只回 cloudfarm
    coinListMock.mockResolvedValue({
      count: 1,
      list: [{ game_id: 'cloudfarm', balance: 7, total_earned: 9, total_spent: 2 }],
    })
    await pullOnce()
    expect(await gameCoinBalanceOf('cloudfarm')).toBe(7)
    expect(await gameCoinBalanceOf('screamchick')).toBe(0)
  })

  it('★ 币接口挂了时**不许**把镜像清零（那等于把孩子兜里的币拿走）', async () => {
    coinListMock.mockResolvedValue({
      count: 1,
      list: [{ game_id: 'cloudfarm', balance: 7, total_earned: 9, total_spent: 2 }],
    })
    await pullOnce()
    expect(await gameCoinBalanceOf('cloudfarm')).toBe(7)

    coinListMock.mockRejectedValue(new Error('coin down'))
    const r = await pullOnce()
    expect(r.ok).toBe(true)
    expect(r.coins).toBeUndefined()
    expect(await gameCoinBalanceOf('cloudfarm')).toBe(7)
  })

  it('只动 `__coin`，插件自己的键一个不碰', async () => {
    await setGameKv('cloudfarm', 'draws', 12)
    coinListMock.mockResolvedValue({
      count: 1,
      list: [{ game_id: 'cloudfarm', balance: 7, total_earned: 9, total_spent: 2 }],
    })
    await pullOnce()
    expect(await getGameKv('cloudfarm', 'draws')).toBe(12)
    expect(await gameCoinBalanceOf('cloudfarm')).toBe(7)
  })
})
