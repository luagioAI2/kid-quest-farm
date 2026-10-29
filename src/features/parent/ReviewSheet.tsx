import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp, usePendingCheckIns } from '@/store/useApp'
import {
  QUALITY_META,
  QUALITY_ORDER,
  Sheet,
  SheetHead,
  Btn,
  categoryOf,
  formatMultiplier,
} from '../tasks/ui'
import { ParentPinPanel } from './ParentGate'
import { settleInstance } from '@/domain/settlement'
import { checkInPayout } from '@/domain/recurrence'
import { humanizeMinutes, humanizeAgo } from '@/domain/time'
import { WISH_KIND_META, wishesAwaitingReply } from '@/domain/wish'
import { formatPriceCents } from '@/domain/cash'
import { wishItemById } from '@/games/wishCatalog'
import type { PendingCheckIn, QualityGrade, TaskInstance, WishOrder } from '@/domain/types'

/* ============================================================
   家长审核面板
   ------------------------------------------------------------
   家长需求：「宝贝做完 时间 可以看到时间进度点完成。之后 家长检查
   （输入密码）才能质量打分，确定奖励。」

   流程：孩子提交 → 状态 submitted → 家长输密码 → 这个面板 →
        打分 + 确认 → 积分到账

   这里用的是与孩子端**同一套** settleInstance 引擎，
   所以家长只是在"最后一公里"做确认，不是另算一套规则。
   ============================================================ */

/** 待审条目：一次签到、一条普通任务实例，或孩子「想要」的心愿 */
type ReviewItem =
  | { kind: 'task'; key: string; inst: TaskInstance }
  | { kind: 'checkin'; key: string; ci: PendingCheckIn }
  | { kind: 'wish'; key: string; order: WishOrder }

export function ReviewSheet() {
  const pending = useApp((s) => s.instances)
  const settings = useApp((s) => s.settings)
  const reviewInstance = useApp((s) => s.reviewInstance)
  const rejectInstance = useApp((s) => s.rejectInstance)
  const approveCheckIn = useApp((s) => s.approveCheckIn)
  const rejectCheckIn = useApp((s) => s.rejectCheckIn)
  const pendingCheckIns = usePendingCheckIns()
  /**
   * 孩子的心愿。2026-10-29 家长要求：「心愿商城爸爸妈妈收到心愿，
   * 也跟任务一样，出现在上边栏的眼睛那，而不是在心愿商城这里」。
   *
   * 判据不写 `status === 'wished'` —— 家长定完价那条单子**仍然是 `wished`**
   * （等孩子来换），只按状态算会让这条待办永远清不掉。规则本体在
   * `wishesAwaitingReply` 里，顶栏红点用的是同一个函数。
   */
  const wishOrders = useApp((s) => s.wishOrders)
  const wishOffers = useApp((s) => s.wishOffers)

  const queue = useMemo<ReviewItem[]>(() => {
    const checkIns: ReviewItem[] = pendingCheckIns.map((ci) => ({
      kind: 'checkin',
      key: `ci:${ci.taskId}:${ci.date}`,
      ci,
    }))
    const tasks: ReviewItem[] = pending
      .filter((i) => i.status === 'submitted')
      .sort((a, b) => (a.submittedAt ?? a.updatedAt) - (b.submittedAt ?? b.updatedAt))
      .map((inst) => ({ kind: 'task', key: inst.id, inst }))
    /* 心愿排在最前面。
       理由和签到不一样：签到晚几分钟确认不影响孩子做下一件事，而一条心愿
       是**孩子正在等回话** —— 他自己也看不到进展，只能干等。
       按提出时间正序（先提的先回），不让新请求把旧的压到队尾。 */
    const wishes: ReviewItem[] = wishesAwaitingReply(wishOrders, wishOffers)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((order) => ({ kind: 'wish', key: `wo:${order.id}`, order }))
    // 签到排在任务前面：一条签到点一下确认就完事，先清掉手感更顺；
    // 而且签到按天攒，拖着不确认会直接卡住孩子当天的坚持天数。
    return [...wishes, ...checkIns, ...tasks]
  }, [pending, pendingCheckIns, wishOrders, wishOffers])

  const [idx, setIdx] = useState(0)
  const current = queue[Math.min(idx, Math.max(0, queue.length - 1))]

  // 审完一个就自动往前挪
  useEffect(() => {
    if (queue.length === 0) setIdx(0)
    else if (idx >= queue.length) setIdx(Math.max(0, queue.length - 1))
  }, [queue.length, idx])

  // 队列空了要给一个明确的"看完了"，不能返回 null —— 那会渲染出一块白板，
  // 家长会以为是页面坏了（这正是之前的 bug）。
  if (!current) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="text-5xl anim-float">🎉</span>
        <p className="font-display text-lg font-extrabold text-ink-900">都看完啦，辛苦啦！</p>
        <p className="text-sm font-bold leading-snug text-ink-500">
          现在没有等确认的任务、签到和心愿。
          <br />
          宝贝交上来之后，这里会出现待办。
        </p>
      </div>
    )
  }

  if (current.kind === 'wish') {
    return (
      <WishReviewCard
        key={current.key}
        order={current.order}
        remaining={queue.length}
        index={idx}
      />
    )
  }

  if (current.kind === 'checkin') {
    return (
      <CheckInReviewCard
        key={current.key}
        ci={current.ci}
        remaining={queue.length}
        index={idx}
        onApprove={approveCheckIn}
        onReject={rejectCheckIn}
        onNext={() => setIdx((i) => i + 1)}
      />
    )
  }

  return (
    <ReviewCard
      key={current.key}
      inst={current.inst}
      remaining={queue.length}
      index={idx}
      settings={settings}
      onReview={reviewInstance}
      onReject={rejectInstance}
      onNext={() => setIdx((i) => i + 1)}
    />
  )
}

/**
 * 一条心愿的回应卡。
 *
 * ## 为什么在**这里**回应，而不是让家长跳去心愿商城
 *
 * 2026-10-29 之前，家长的回应入口藏在「心愿商城 → 那件商品 → 详情页底部」。
 * 孩子点完「🤍 想要这个」之后，家长那边**一片安静** —— 顶栏没有红点、
 * 心愿页顶部只有一张写着「有 N 个心愿等你回应」的卡，点进去还得自己找。
 * 家长原话：「爸爸妈妈会查看处理」。
 *
 * 所以定价直接摆进审核队列：家长打开 👀 就能看到「谁想要什么」，
 * 就地给个价、或者这次先不换。**不用记住那件商品在哪一屏。**
 *
 * ## 为什么要有「孩子现在有」这个数
 *
 * 家长定价靠的是「定多少孩子攒得到」。只给商品参考价（¥59）没用 ——
 * 券是孩子自己攒的，跟人民币不是一回事。把余额摆出来，家长才能判断
 * 「定 30 他今天就能换」还是「定 200 得攒两周」。
 *
 * ⚠️ 券和积分**都要报**：付款时券不够会自动用积分补（1:1），
 *    只报券的话，一个「券 0、积分 300」的孩子会被家长定价成「换不起」。
 */
function WishReviewCard({
  order,
  remaining,
  index,
}: {
  order: WishOrder
  remaining: number
  index: number
}) {
  const wishSetOffer = useApp((s) => s.wishSetOffer)
  const wishCancel = useApp((s) => s.wishCancel)
  const pushToast = useApp((s) => s.pushToast)
  const harvestBalance = useApp((s) => s.harvestBalance)
  const balance = useApp((s) => s.balance)

  const item = wishItemById(order.itemId)
  const meta = item ? WISH_KIND_META[item.kind] : null

  /* 默认 30 张，和心愿页的定价屏（`OfferView`）同一个起点 ——
     家长在两个入口看到同一个默认值，不会觉得是两套东西。
     已经定过价、后来被关掉又来的（`voucherPrice` 非 0），从原价起步。 */
  const [price, setPrice] = useState(() => Math.max(5, order.voucherPrice || 30))
  const [busy, setBusy] = useState(false)

  const nowHave = harvestBalance + balance

  const approve = async () => {
    setBusy(true)
    try {
      await wishSetOffer(order.itemId, price)
      pushToast({
        kind: 'reward',
        title: `已开放：${price} 张兑换券`,
        detail: '孩子现在可以换了',
        emoji: '✅',
      })
      /* ⚠️ 这里**不调 `onNext()`**。
         定价之后这条心愿立刻离开队列（`wishesAwaitingReply` 认的是
         「这件商品有没有开放价」），`idx` 不动，下一张卡自然顶上来。
         再调一次 onNext 会**跳过一条** —— 家长会在不知情的情况下漏掉一个待办。
         （确认/回绝走的是同一套：`wishCancel` 也会让这条离开队列。） */
    } finally {
      setBusy(false)
    }
  }

  const decline = async () => {
    setBusy(true)
    try {
      await wishCancel(order.id, '爸妈这次先不换')
      pushToast({
        kind: 'info',
        title: '已回绝',
        // 「我许的愿」那一屏 2026-10-29 下线了，理由现在写在**商品详情页**上
        // （「上次爸妈说：…」）。这句跟着改，别让家长去找一个不存在的屏。
        detail: '孩子会在那件商品的页面看到理由',
        emoji: '💬',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-5 pb-8 pt-4" data-wish-review={order.id}>
      <div className="surface overflow-hidden">
        <div className="flex items-center gap-3 bg-sky-50 p-3.5">
          <span className="text-3xl">{order.itemEmoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold text-ink-900">
              {order.itemName}
            </p>
            <p className="text-xs font-bold text-ink-600">
              {meta?.label ?? '心愿'}
              {order.partnerName ? ` · ${order.partnerName}` : ''} · 孩子想要这个
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x-2 divide-ink-900/5 text-center">
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">商品参考价</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-ink-900">
              {item?.priceCents != null ? formatPriceCents(item.priceCents) : '—'}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">孩子现在有</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-ink-900">
              🎫 {harvestBalance} · 🪙 {balance}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
          定多少兑换券？
        </p>
        <div className="flex items-center gap-2 rounded-2xl bg-white p-1 shadow-flat">
          <button
            type="button"
            onClick={() => setPrice((p) => Math.max(1, p - 5))}
            aria-label="减五张"
            className="btn h-10 w-10 rounded-xl bg-paper-2 text-lg text-ink-700 active:btn-press"
          >
            −
          </button>
          <span className="tnum flex-1 text-center font-display text-xl font-extrabold text-ink-900">
            {price}
            <span className="ml-1 text-xs font-bold text-ink-500">张</span>
          </span>
          <button
            type="button"
            onClick={() => setPrice((p) => Math.min(9999, p + 5))}
            aria-label="加五张"
            className="btn h-10 w-10 rounded-xl bg-paper-2 text-lg text-ink-700 active:btn-press"
          >
            +
          </button>
        </div>
        <p className="mt-2 px-1 text-xs font-bold leading-snug text-ink-500">
          {nowHave >= price
            ? `孩子现在有 ${nowHave}，定 ${price} 他马上就能换。`
            : `孩子现在有 ${nowHave}，定 ${price} 还差 ${price - nowHave}。`}
        </p>
        {/* 单独一行。接在上面那句后面的话，两句话之间连标点都没有，
            读起来像「…马上就能换。券不够的部分…」—— 一坨。 */}
        <p className="mt-1 px-1 text-[11px] font-bold leading-snug text-ink-400">
          券不够的部分会自动用积分补（1 张 = 1 积分），和「兑换」里一样。
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <Btn tone="grass" size="hero" full disabled={busy} onClick={() => void approve()}>
          ✅ 开放兑换 · {price} 张
        </Btn>
        <Btn tone="white" size="md" full disabled={busy} onClick={() => void decline()}>
          💬 这次先不换
        </Btn>
      </div>

      {remaining > 1 ? (
        <p className="mt-3 text-center text-xs text-ink-500">
          还有 {remaining - 1} 个等你看（第 {index + 1} / {remaining} 个）
        </p>
      ) : null}
    </div>
  )
}

/**
 * 一次签到的确认卡。
 *
 * 签到没有用时、没有质量评级 —— 家长要判断的只有一件事：
 * 「今天这一次，孩子到底做没做」。所以这里不给打分器、不给用时微调，
 * 只把「哪天、哪个任务、确认后给多少分」摆清楚。
 */
function CheckInReviewCard({
  ci,
  remaining,
  index,
  onApprove,
  onReject,
  onNext,
}: {
  ci: PendingCheckIn
  remaining: number
  index: number
  onApprove: (taskId: string, periodKey: string, date: string) => Promise<number>
  onReject: (taskId: string, periodKey: string, date: string) => Promise<void>
  onNext: () => void
}) {
  // 只订阅原始切片，再 useMemo 派生。别写成 `useApp((s) => s.tasks.find(...))` ——
  // 那依赖「tasks 数组引用在两次渲染之间不变」这个隐含前提，
  // 哪天 refresh 改成每次重建对象，就会重演 React #185。
  const tasks = useApp((s) => s.tasks)
  const task = useMemo(() => tasks.find((t) => t.id === ci.taskId), [tasks, ci.taskId])
  // 同理：订 `checkInProgress` 整片，别在 selector 里 `.find()`
  const checkInProgress = useApp((s) => s.checkInProgress)
  /* ⚠️ 2026-10-12 起这里**不再订阶梯倍率**了。
     原来订的是 `s.settings.checkInTierRatio`（全局值）；家长拍板
     「不需要全局设定梯度、连续的。每个任务单独，有默认的就行了」，
     那个设置连同字段一起删掉了。
     现在倍率的唯一来源是任务自己的 `checkInTierRatio`，而 `task`
     本来就是本组件的依赖 —— 所以「家长在任务里改了倍率，审核卡跟着变」
     这条不变量自动成立，不需要再单独订一个值。 */
  const [busy, setBusy] = useState(false)

  /* 「确认后得到 N 分」必须等于 `approveCheckIn` 真正发出去的数 ——
     所以两处共用 `checkInPayout`，不在这里另算一遍。
     这里原来写的是 `+task.basePoints`，而实际到账还有阶梯：
     全新账号第一天写着 5、点下去实发 7。家长看到的是一个数、孩子拿到另一个数，
     这是最不该有的那类 bug。
     ⚠️ 也不能图省事写「基础分」了事 —— 阶梯奖励就是这次确认触发的，
     不预告等于把惊喜变成意外（家长会以为多发了）。 */
  const payout = useMemo(() => {
    if (!task) return null
    const row = checkInProgress.find((p) => p.taskId === ci.taskId && p.periodKey === ci.periodKey)
    return checkInPayout(task, row?.days ?? [], row?.claimedTiers ?? [], ci.date)
  }, [task, checkInProgress, ci.taskId, ci.periodKey, ci.date])

  const cat = task ? categoryOf(task.category) : null

  const approve = async () => {
    setBusy(true)
    try {
      // 确认后这条签到立刻离开待办队列，本组件随之卸载 ——
      // 所以这里不要写「确认成功」的本地状态，那是一块永远渲染不到的死代码。
      // 反馈交给 store 里的 toast（「签到成功 +N 分」）。
      await onApprove(ci.taskId, ci.periodKey, ci.date)
    } finally {
      setBusy(false)
    }
  }

  const reject = async () => {
    setBusy(true)
    try {
      await onReject(ci.taskId, ci.periodKey, ci.date)
      onNext()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="px-5 pb-8 pt-4">
      <div className="surface overflow-hidden">
        <div className={clsx('flex items-center gap-3 p-3.5', cat?.soft ?? 'bg-sun-50')}>
          <span className="text-3xl">{cat?.emoji ?? '📅'}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold text-ink-900">{ci.title}</p>
            <p className="text-xs font-bold text-ink-600">
              {cat ? `${cat.label} · ` : ''}签到确认
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x-2 divide-ink-900/5 text-center">
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">签到日期</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-ink-900">
              {ci.date}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">确认后得到</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-grass-600">
              +{payout?.total ?? 0}
              <span className="ml-0.5 text-xs font-bold text-ink-500">分</span>
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 px-1 text-xs font-bold leading-snug text-ink-500">
        {payout && payout.tierPoints > 0
          ? `基础 ${payout.base} 分 + 阶梯 ${payout.tierPoints} 分。确认后这一天会算进坚持天数。`
          : '确认后这一天会算进坚持天数，攒够天数自动发阶梯奖励。'}
      </p>

      <div className="mt-4 space-y-2">
        <Btn tone="grass" size="hero" full disabled={busy} onClick={() => void approve()}>
          ✅ 确认这一天做到了
        </Btn>
        <Btn tone="white" size="md" full disabled={busy} onClick={() => void reject()}>
          🔁 让宝贝重新签到
        </Btn>
      </div>

      {remaining > 1 ? (
        <p className="mt-3 text-center text-xs text-ink-500">
          还有 {remaining - 1} 个等你看（第 {index + 1} / {remaining} 个）
        </p>
      ) : null}
    </div>
  )
}

function ReviewCard({
  inst,
  remaining,
  index,
  settings,
  onReview,
  onReject,
  onNext,
}: {
  inst: TaskInstance
  remaining: number
  index: number
  settings: ReturnType<typeof useApp.getState>['settings']
  onReview: (id: string, q: QualityGrade | undefined, mins?: number) => Promise<number>
  onReject: (id: string, note?: string) => Promise<void>
  onNext: () => void
}) {
  const cat = categoryOf(inst.category)

  const [quality, setQuality] = useState<QualityGrade | undefined>(
    inst.qualityRated ? (inst.quality ?? 'ok') : undefined,
  )
  const [minutes, setMinutes] = useState<number>(
    inst.actualMinutes ?? inst.plannedMinutes,
  )
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ points: number; reason: string } | null>(null)

  // 实时预览：让家长清楚"确认后孩子会拿多少分"，
  // 避免出现"以为给 20 结果给了 8"的意外。
  const preview = useMemo(() => {
    return settleInstance(
      { ...inst, actualMinutes: minutes, quality },
      {
        overtimeEnabled: settings.overtimeEnabled,
        qualityBonusEnabled: settings.qualityBonusEnabled,
        minRatioForPoints: settings.minRatioForPoints,
      },
    )
  }, [inst, minutes, quality, settings])

  const submit = async () => {
    setBusy(true)
    try {
      const pts = await onReview(inst.id, quality, minutes)
      setDone({ points: pts, reason: preview.reason })
    } finally {
      setBusy(false)
    }
  }

  const doReject = async () => {
    setBusy(true)
    try {
      await onReject(inst.id, rejectNote.trim() || undefined)
      onNext()
    } finally {
      setBusy(false)
    }
  }

  /* ---- 审核完成的小庆祝 ---- */
  if (done) {
    return (
      <div className="px-5 pb-8 pt-6 text-center">
        <div className="text-6xl anim-bounce-in">🎉</div>
        <h3 className="mt-3 font-display text-2xl font-extrabold text-ink-900">
          确认好啦！
        </h3>
        <p className="mt-1 text-base text-ink-700">
          {inst.title} · 给宝贝 <span className="tnum font-display text-2xl font-extrabold text-grass-600">{done.points}</span> 分
        </p>
        <p className="mt-1 text-sm text-ink-500">{done.reason}</p>

        {remaining > 1 ? (
          <Btn tone="grass" size="lg" full className="mt-6" onClick={onNext}>
            还有 {remaining - 1} 个等着看 →
          </Btn>
        ) : (
          <p className="mt-6 text-sm font-bold text-ink-500">今天的都看完啦 👏</p>
        )}
      </div>
    )
  }

  /* ---- 打回 ---- */
  if (rejecting) {
    return (
      <div className="px-5 pb-8 pt-4">
        <div className="surface-paper p-4">
          <p className="font-display text-lg font-extrabold text-ink-900">
            让宝贝重新做一次？
          </p>
          <p className="mt-1 text-sm text-ink-500">
            不会扣分，宝贝会看到任务重新出现。
          </p>
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value.slice(0, 60))}
            placeholder="想说点什么？（可不填）比如「字再写工整一点哦」"
            rows={3}
            className="mt-3 w-full resize-none rounded-2xl border border-ink-900/10 bg-paper-2 px-3 py-2.5 text-sm font-bold text-ink-900 outline-none focus:border-berry-400"
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Btn tone="white" size="lg" full onClick={() => setRejecting(false)}>
            算了
          </Btn>
          <Btn tone="berry" size="lg" full disabled={busy} onClick={() => void doReject()}>
            让 TA 再做一次
          </Btn>
        </div>
      </div>
    )
  }

  /* ---- 主审核界面 ---- */
  return (
    <div className="px-5 pb-8 pt-4">
      {/* 任务信息 */}
      <div className="surface overflow-hidden">
        <div className={clsx('flex items-center gap-3 p-3.5', cat.soft)}>
          <span className="text-3xl">{cat.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold text-ink-900">
              {inst.title}
            </p>
            <p className="text-xs font-bold text-ink-600">
              {cat.label} · 计划 {humanizeMinutes(inst.plannedMinutes)}
              {inst.backfilled ? ' · 补做' : ''}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 divide-x-2 divide-ink-900/5 text-center">
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">宝贝用时</p>
            <p className="tnum mt-0.5 font-display text-lg font-extrabold text-ink-900">
              {inst.actualMinutes != null ? humanizeMinutes(inst.actualMinutes) : '未计时'}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">交上来</p>
            <p className="mt-0.5 text-sm font-extrabold text-ink-900">
              {inst.submittedAt ? humanizeAgo(inst.submittedAt) : '刚刚'}
            </p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-bold text-ink-500">自评</p>
            <p className="mt-0.5 text-sm font-extrabold text-ink-900">
              {inst.quality ? `${QUALITY_META[inst.quality].emoji} ${QUALITY_META[inst.quality].label}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* 质量打分 */}
      {inst.qualityRated ? (
        <div className="mt-4">
          <p className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
            做得怎么样？
          </p>
          {/* 五档，由低到高；中间「良好」不加不减。每档都标出加减多少，
              家长点之前就知道会怎么变分。 */}
          <div className="grid grid-cols-5 gap-1.5">
            {QUALITY_ORDER.map((q) => {
              const meta = QUALITY_META[q]
              const active = quality === q
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQuality(q)}
                  className={clsx(
                    'btn flex min-h-[86px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 active:btn-press',
                    active
                      ? 'border-sun-500 bg-sun-200 shadow-flat'
                      : 'border-ink-900/10 bg-white',
                  )}
                >
                  <span className="text-xl">{meta.emoji}</span>
                  <span className="text-[11px] font-extrabold leading-tight text-ink-900">
                    {meta.label}
                  </span>
                  <span
                    className={clsx(
                      'text-[10px] font-bold leading-tight',
                      meta.multiplier > 0
                        ? 'text-grass-700'
                        : meta.multiplier < 0
                          ? 'text-berry-500'
                          : 'text-ink-500',
                    )}
                  >
                    {formatMultiplier(q)}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* 用时微调 —— 家长可以改，防止孩子忘了点开始 */}
      <div className="mt-4">
        <p className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
          实际用了多久？（可以改）
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.max(1, m - 5))}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            −5
          </button>
          <button
            type="button"
            onClick={() => setMinutes((m) => Math.max(1, m - 1))}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            −
          </button>
          <input
            type="number"
            value={minutes}
            min={1}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
            className="tnum min-h-[48px] min-w-0 flex-1 rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-center font-display text-xl font-extrabold text-ink-900 outline-none focus:border-sky-400"
          />
          <button
            type="button"
            onClick={() => setMinutes((m) => m + 1)}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setMinutes((m) => m + 5)}
            className="btn grid size-11 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-white text-lg font-extrabold active:btn-press"
          >
            +5
          </button>
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={() => setMinutes(inst.plannedMinutes)}
            className="btn rounded-pill bg-white px-2.5 py-1.5 text-xs font-bold text-ink-500 active:btn-press"
          >
            按计划 {inst.plannedMinutes} 分
          </button>
          {inst.actualMinutes != null && (
            /* ⚠️ 说「用时」，不说「计时」。
               `actualMinutes` 有两个来源：点过「开始」的那批是**真的计时**结果，
               没点过（重做、补做）的是**孩子自己填的**。而数据里**没有**
               「测的 / 填的」这个字段（`actualMinutes` 就是一个数），
               所以只能用两边都成立的中性说法 —— 写「宝贝计时」会在手填那批上
               向家长宣称「这数是测出来的」，比实际可信度高。
               ⚠️ 也别反过来改成「宝贝填的」：那会在真计时那批上说错。
               并且要和上面「宝贝用时」那个标签保持同一个词。 */
            <button
              type="button"
              onClick={() => setMinutes(Math.max(1, Math.round(inst.actualMinutes!)))}
              className="btn rounded-pill bg-white px-2.5 py-1.5 text-xs font-bold text-ink-500 active:btn-press"
            >
              宝贝用时 {Math.round(inst.actualMinutes)} 分
            </button>
          )}
        </div>
      </div>

      {/* 结算预览 */}
      <div
        className={clsx(
          'mt-4 rounded-2xl border p-4 text-center',
          preview.points > 0
            ? 'border-sun-400/50 bg-sun-50'
            : 'border-ink-900/10 bg-ink-100/60',
        )}
      >
        <p className="text-xs font-bold text-ink-500">确认后宝贝得到</p>
        <p
          className={clsx(
            'tnum mt-1 font-display text-4xl font-extrabold',
            preview.points > 0 ? 'text-grass-600' : 'text-ink-400',
          )}
        >
          {preview.points}
          <span className="ml-1 text-base font-bold text-ink-500">分</span>
        </p>
        <p className="mt-1 text-xs text-ink-500">{preview.reason}</p>
      </div>

      {/* 操作 */}
      <div className="mt-4 space-y-2">
        <Btn tone="grass" size="hero" full disabled={busy} onClick={() => void submit()}>
          ✅ 确认奖励
        </Btn>
        <Btn tone="white" size="md" full disabled={busy} onClick={() => setRejecting(true)}>
          🔁 让宝贝再做一次
        </Btn>
      </div>

      {remaining > 1 ? (
        <p className="mt-3 text-center text-xs text-ink-500">
          还有 {remaining - 1} 个等你看（第 {index + 1} / {remaining} 个）
        </p>
      ) : null}
    </div>
  )
}

/**
 * 家长端审核弹层。
 *
 * 安全要点：**一打开就要密码**，而不是等确认奖励时才拦。
 * 因为待审核列表里含有孩子提交的用时、自评等信息，
 * 而且"打分"这个动作本身就是家长权限，列表就不该给孩子看。
 *
 * 关掉弹层后重新上锁：家长放下手机，孩子不能接着用这个已解锁的面板。
 */
export function ReviewSheetModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const settings = useApp((s) => s.settings)
  const [unlocked, setUnlocked] = useState(false)

  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  // 每次打开都从"锁着"开始
  useEffect(() => {
    if (!open) setUnlocked(false)
  }, [open])

  const passed = !needsPin || unlocked

  return (
    <Sheet open={open} onClose={onClose} labelledBy="review-title">
      <SheetHead
        title={passed ? '帮宝贝看看' : '请爸爸妈妈来一下'}
        emoji={passed ? '👀' : '🔒'}
        sub={passed ? '确认任务、签到与心愿' : '审核需要密码'}
        id="review-title"
        onClose={onClose}
      />
      {passed ? (
        <ReviewSheet />
      ) : (
        <div className="px-5 pb-8 pt-2">
          <ParentPinPanel
            title="请爸爸妈妈来一下"
            hint="给宝贝打分、确认奖励，需要先输密码"
            onPass={() => setUnlocked(true)}
            onCancel={onClose}
          />
        </div>
      )}
    </Sheet>
  )
}
