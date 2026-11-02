import { describe, expect, it, vi } from 'vitest'
import {
  mapInstance,
  mapLedger,
  mapRedeemItem,
  mapRedeemRecord,
  mapTask,
  mapWishOffer,
  mapWishOrder,
  secToMs,
  srvId,
} from './map'
import type { ServerInstance, ServerTask } from '../api/task'
import type { ServerLedgerEntry } from '../api/wallet'
import type { ServerRedeemRecord, ServerRedeemRow } from '../api/redeem'
import type { ServerWishItemView, ServerWishOrder } from '../api/wish'

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

describe('mapRedeemItem', () => {
  /* 一条真的 `/api/redeem/list`（raw）返回行 */
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
    updated_at: 1793590100,
    visible: true,
  }

  it('price → cost，limit_per_day → limitPerDay，秒 → 毫秒', () => {
    const it = mapRedeemItem(ROW)
    expect(it).not.toBeNull()
    expect(it!.id).toBe('rd-abc') // 不加 srv_ 前缀：服务端用的就是这个 id
    expect(it!.cost).toBe(50)
    expect(it!.limitPerDay).toBe(2)
    expect(it!.createdAt).toBe(1793590000000)
    expect(it!.updatedAt).toBe(1793590100000)
    expect(it!.archived).toBe(false)
  })

  it('limit_per_day = 0（不限）翻成本地的 undefined', () => {
    // 写成 0 的话，`limitPerDay != null` 恒真 ⇒ 孩子看到「每天最多 0 次」
    expect(mapRedeemItem({ ...ROW, limit_per_day: 0 })!.limitPerDay).toBeUndefined()
  })

  it('★ today_count 要带过来：界面靠它显示「还剩几次」，自己数是另一个日界', () => {
    // 服务端按自然日 0 点数，本地按逻辑日 4 点数 ⇒ 00:00–04:00 差一天
    expect(mapRedeemItem(ROW)!.todayCount).toBe(0)
    expect(mapRedeemItem({ ...ROW, today_count: 2 })!.todayCount).toBe(2)
    // 服务端没给这个字段（老版本）⇒ undefined，`pickTodayCount` 会退回本地数
    expect(mapRedeemItem({ ...ROW, today_count: undefined })!.todayCount).toBeUndefined()
  })

  it('★ 心愿来源的行必须丢掉（否则兑换页会出现两遍）', () => {
    expect(mapRedeemItem({ ...ROW, source: 'wish', id: 'wi-xyz' })).toBeNull()
  })

  it('visible 原样带下来（服务端算的可见性，客户端不自己推）', () => {
    expect(mapRedeemItem({ ...ROW, visible: false })!.visible).toBe(false)
  })

  it('不认识的分类落 custom，而不是变成空白格子', () => {
    expect(mapRedeemItem({ ...ROW, category: 'music' })!.category).toBe('custom')
  })
})

describe('mapRedeemRecord', () => {
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

  it('加 srv_rr_ 前缀，两种币分别映射', () => {
    const r = mapRedeemRecord(REC)
    expect(r).not.toBeNull()
    expect(r!.id).toBe('srv_rr_RR1700000000123')
    expect(r!.itemId).toBe('rd-abc')
    expect(r!.harvestPaid).toBe(30)
    expect(r!.pointsPaid).toBe(20)
    expect(r!.balanceAfter).toBe(80)
    expect(r!.harvestBalanceAfter).toBe(5)
    expect(r!.fulfilled).toBe(false)
    expect(r!.createdAt).toBe(1793590100000)
  })

  it('兑现时间：null 保持 undefined（不是 0，0 会显示成 1970 年）', () => {
    expect(mapRedeemRecord(REC)!.fulfilledAt).toBeUndefined()
    expect(mapRedeemRecord({ ...REC, fulfilled_at: 1793590200 })!.fulfilledAt).toBe(
      1793590200000,
    )
  })

  it('★ 已取消的记录直接丢掉（退款了，那笔兑换等于没发生）', () => {
    expect(mapRedeemRecord({ ...REC, cancelled: true })).toBeNull()
  })
})

/* ============================================================
   心愿商城
   ------------------------------------------------------------
   两个「静默出错」的点各钉一条：
     · 定价行写错 → 家长关掉的东西孩子还能换
     · 订单时间写成 0 → 界面显示「1970 年确认的」
   ============================================================ */

const VIEW: ServerWishItemView = {
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
  note: '随机款，不指定款式',
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

describe('mapWishOffer', () => {
  it('开放且有价 → 一行，且**不带 closedAt**（本地就是靠它判「能换」）', () => {
    const o = mapWishOffer(VIEW)
    expect(o).not.toBeNull()
    expect(o!.itemId).toBe('wish-popmart')
    expect(o!.voucherPrice).toBe(30)
    expect(o!.closedAt).toBeUndefined()
  })

  it('★ 家长关掉（open=false）→ **不写行**', () => {
    // 写成「有行但 closedAt: 0」的话，孩子还能换一件家长刚关掉的东西
    expect(mapWishOffer({ ...VIEW, open: false })).toBeNull()
  })

  it('★ 价 0 也算没开放（服务端的「0 = 关闭」约定）', () => {
    expect(mapWishOffer({ ...VIEW, open: true, voucher_price: 0 })).toBeNull()
  })

  it('openedAt 填 0：本地没有任何地方读它，填 now 只会每次拉取都造 diff', () => {
    expect(mapWishOffer(VIEW)!.openedAt).toBe(0)
  })
})

const ORDER: ServerWishOrder = {
  id: 'WO1700000000456',
  item_id: 'wish-popmart',
  kind: 'collectible',
  item_name: '泡泡玛特盲盒',
  item_emoji: '🧸',
  partner_name: '泡泡玛特',
  voucher_price: 30,
  status: 'committed',
  vouchers_held: 20,
  points_held: 10,
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

describe('mapWishOrder', () => {
  it('加 srv_wo_ 前缀；两种币各按实际扣的映射（退款凭据）', () => {
    const o = mapWishOrder(ORDER)
    expect(o.id).toBe('srv_wo_WO1700000000456')
    expect(o.itemId).toBe('wish-popmart')
    expect(o.vouchersHeld).toBe(20)
    expect(o.pointsHeld).toBe(10)
    expect(o.voucherPrice).toBe(30)
    expect(o.status).toBe('committed')
  })

  it('秒 → 毫秒；没发生的阶段保持 undefined（不是 0）', () => {
    const o = mapWishOrder(ORDER)
    expect(o.createdAt).toBe(1793590000000)
    expect(o.committedAt).toBe(1793590300000)
    expect(o.confirmedAt).toBeUndefined()
    expect(o.doneAt).toBeUndefined()
    expect(o.cancelledAt).toBeUndefined()
  })

  it('空字符串不写成空串（本地用 undefined 表示「没有」）', () => {
    const o = mapWishOrder(ORDER)
    expect(o.partnerName).toBe('泡泡玛特')
    expect(o.openedGameId).toBeUndefined()
    expect(o.buyOrderNo).toBeUndefined()
    expect(o.cancelReason).toBeUndefined()
  })

  it('快递单号落到 buyOrderNo（同一个「对账号」）', () => {
    expect(mapWishOrder({ ...ORDER, tracking_no: 'SF123456' }).buyOrderNo).toBe('SF123456')
  })

  it('pointsHeld 为 0 时不写字段（老订单全是纯券单）', () => {
    expect(mapWishOrder({ ...ORDER, points_held: 0 }).pointsHeld).toBeUndefined()
  })

  it('★ 已取消的**要留下来** —— 孩子要看到「爸妈这次先不换」和原因', () => {
    const o = mapWishOrder({
      ...ORDER,
      status: 'cancelled',
      cancelled_at: 1793590400,
      cancel_reason: '爸妈这次先不换',
    })
    expect(o.status).toBe('cancelled')
    expect(o.cancelledAt).toBe(1793590400000)
    expect(o.cancelReason).toBe('爸妈这次先不换')
  })

  it('收货信息：purge_after 也是秒', () => {
    const o = mapWishOrder({
      ...ORDER,
      ship: {
        receiver: '王小朵',
        phone: '****1234',
        region: '浙江省杭州市西湖区',
        address: '',
        purge_after: 1801366400,
      },
    })
    expect(o.ship?.receiver).toBe('王小朵')
    expect(o.ship?.purgeAfter).toBe(1801366400000)
    expect(o.ship?.note).toBeUndefined()
  })

  it('未知分类 / 状态回落，不把整行丢掉', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const o = mapWishOrder({ ...ORDER, kind: 'spaceship' as never, status: 'flying' as never })
    expect(o.kind).toBe('collectible')
    expect(o.status).toBe('wished')
    warn.mockRestore()
  })
})
