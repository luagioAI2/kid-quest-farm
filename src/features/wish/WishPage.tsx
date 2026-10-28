import { useMemo, useState } from 'react'
import { useApp } from '@/store/useApp'
import type { WishItem, WishTint } from '@/domain/types'
import {
  WISH_KIND_META,
  blindBoxRemaining,
  compareWishItem,
  daysToSave,
  planWishRedeem,
  redeemedGameIdsFrom,
  type WishFilter,
} from '@/domain/wish'
import { formatPriceCents } from '@/domain/cash'
import { WISH_BLINDBOX_ID, WISH_ITEMS, wishItemById } from '@/games/wishCatalog'
import { STOREFRONT } from '@/games/storefront'
import { ParentPinPanel } from '../parent/ParentGate'

/* ============================================================
   心愿商城（底部导航第 4 格，2026-10-28）
   ------------------------------------------------------------
   和「兑换」是两个东西：
     · 兑换  = 家里的事：家长自己加的商品，家长自己兑现
     · 心愿  = 外面的事：合作商/运营提供的商品，成交在淘宝

   完整口径见 `docs/wish-mall-spec.md`。三条最要紧的：

   1. **只收兑换券**，不混付积分。
   2. **孩子「确定兑换」就真扣券** —— 因为成交在 App 外面，不扣的话
      孩子能同时挂 10 个「已兑换」，家长每个都得去淘宝买一遍。
   3. **价格与券价不同行**，价格旁必须写「家长支付」。
      `80 张` 和 `¥69` 并排，孩子会自己算出汇率 —— 算术本能挡不住，
      能挡住的只有归属。

   ## 视图
   一个容器 + 五个视图，靠 `view` 状态切。**不做路由** ——
   底部导航只有一格，进来出去都是一次性的，加路由只会让返回键变复杂。
   ============================================================ */

const TINT_BG: Record<WishTint, string> = {
  sun: 'bg-sun-100',
  grass: 'bg-grass-100',
  sky: 'bg-sky-100',
  grape: 'bg-grape-100',
  tan: 'bg-tangerine-100',
  berry: 'bg-berry-100',
}

type WishView =
  | { kind: 'list' }
  | { kind: 'detail'; itemId: string }
  | { kind: 'offer'; itemId: string }
  | { kind: 'confirm'; orderId: string }
  | { kind: 'box'; gameId: string }

export default function WishPage() {
  const wishOffers = useApp((s) => s.wishOffers)
  const wishOrders = useApp((s) => s.wishOrders)
  const harvestBalance = useApp((s) => s.harvestBalance)
  const ownedGameIds = useApp((s) => s.ownedGameIds)
  const installedGames = useApp((s) => s.installedGames)
  const harvestLedger = useApp((s) => s.harvestLedger)

  const [view, setView] = useState<WishView>({ kind: 'list' })
  const [filter, setFilter] = useState<WishFilter>(null)

  /**
   * 「已经有了」= 账本买过 + 现在装着 + **心愿单里兑换到手过**。
   *
   * 第三个来源和 `wishRedeem` 里的闸门必须**同一套**：只改一处的话，
   * 卡片上会写着「可兑换」、点下去却被拒，或者反过来 —— 界面说「已经有了」
   * 但券照扣。两边都从 `redeemedGameIdsFrom` 取，别再各写一遍。
   */
  const owned = useMemo(
    () =>
      new Set<string>([
        ...ownedGameIds,
        ...Object.keys(installedGames),
        ...redeemedGameIdsFrom(wishOrders),
      ]),
    [ownedGameIds, installedGames, wishOrders],
  )

  /** 本家庭对某件商品的开放设置（已关闭的不算） */
  const offerOf = (itemId: string) =>
    wishOffers.find((o) => o.itemId === itemId && !o.closedAt)

  /** 某件商品当前还没走完的单子（意向 / 已兑换 / 已确认） */
  const activeOrderOf = (itemId: string) =>
    wishOrders.find(
      (o) =>
        o.itemId === itemId &&
        (o.status === 'wished' || o.status === 'committed' || o.status === 'confirmed'),
    )

  const goList = () => setView({ kind: 'list' })

  /*
   * ⚠️ 用一个 `content` 变量 + 唯一的 return，而不是每个分支各 return 一次。
   *
   * 这是本项目的硬约束（`MEMORY.md` 第一节第 2 条）：**外壳只能一个顶层 return**。
   * 多个 `if (...) return` 会另起一棵树，切视图时子组件全部重挂载、
   * `useState` 全丢 —— 在这个页面上的表现是「定价页输到一半，切个屏就清零」。
   */
  let content: React.ReactNode = null

  if (view.kind === 'offer') {
    content = (
      <OfferView
        itemId={view.itemId}
        onBack={() => setView({ kind: 'detail', itemId: view.itemId })}
        onDone={goList}
        harvestLedger={harvestLedger}
      />
    )
  } else if (view.kind === 'confirm') {
    content = <ConfirmView orderId={view.orderId} onBack={goList} onDone={goList} />
  } else if (view.kind === 'box') {
    content = <BoxView gameId={view.gameId} onDone={goList} />
  } else if (view.kind === 'detail') {
    const item = wishItemById(view.itemId)
    content = item ? (
      <DetailView
        item={item}
        offer={offerOf(item.id)}
        order={activeOrderOf(item.id)}
        balance={harvestBalance}
        owned={owned}
        onBack={goList}
        onOffer={() => setView({ kind: 'offer', itemId: item.id })}
        onConfirm={(orderId) => setView({ kind: 'confirm', orderId })}
        onBox={(gameId) => setView({ kind: 'box', gameId })}
      />
    ) : (
      <EmptyState onBack={goList} />
    )
  } else {
    content = (
      <ListView
        filter={filter}
        setFilter={setFilter}
        offerOf={offerOf}
        activeOrderOf={activeOrderOf}
        balance={harvestBalance}
        owned={owned}
        onOpen={(itemId) => setView({ kind: 'detail', itemId })}
      />
    )
  }

  return <div className="page-col px-4 pb-28">{content}</div>
}

/* ============================================================
   ① 列表
   ============================================================ */

function ListView({
  filter,
  setFilter,
  offerOf,
  activeOrderOf,
  balance,
  owned,
  onOpen,
}: {
  filter: WishFilter
  setFilter: (f: WishFilter) => void
  offerOf: (id: string) => ReturnType<typeof useApp.getState>['wishOffers'][number] | undefined
  activeOrderOf: (id: string) => ReturnType<typeof useApp.getState>['wishOrders'][number] | undefined
  balance: number
  owned: Set<string>
  onOpen: (id: string) => void
}) {
  const items = useMemo(() => {
    const all = WISH_ITEMS.filter((i) => !i.archived).sort(compareWishItem)
    if (!filter) return all
    return all.filter((i) => i.kind === filter)
  }, [filter])

  // 盲盒单独拎出来做 hero（用户要求：优先显示游戏盲盒）。
  // 「全部」之外的分档里不重复展示它。
  const blindbox = items.find((i) => i.id === WISH_BLINDBOX_ID)
  const rest = items.filter((i) => i.id !== WISH_BLINDBOX_ID)

  const chips: { key: WishFilter; label: string }[] = [
    { key: null, label: '全部' },
    ...(Object.keys(WISH_KIND_META) as (keyof typeof WISH_KIND_META)[]).map((k) => ({
      key: k as WishFilter,
      label: WISH_KIND_META[k].label,
    })),
  ]

  return (
    <div>
      <header className="pt-safe pt-4">
        <div className="flex items-center gap-3">
          <span className="anim-float flex h-14 w-14 items-center justify-center rounded-full border border-sun-300 bg-sun-100 text-3xl shadow-flat">
            🛍️
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-extrabold leading-tight text-ink-900">
              心愿商城
            </p>
            <p className="text-xs font-bold text-ink-500">看看有什么想要的，告诉爸爸妈妈</p>
          </div>
        </div>
      </header>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <button
            key={c.label}
            onClick={() => setFilter(c.key)}
            className={
              'flex-none rounded-full px-3.5 py-1.5 text-sm font-bold shadow-flat ' +
              (filter === c.key ? 'bg-ink-900 text-white' : 'bg-white text-ink-600')
            }
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-3 space-y-3">
        {blindbox && (
          <BlindBoxHero
            item={blindbox}
            offer={offerOf(blindbox.id)}
            order={activeOrderOf(blindbox.id)}
            owned={owned}
            onOpen={() => onOpen(blindbox.id)}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          {rest.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              offer={offerOf(item.id)}
              order={activeOrderOf(item.id)}
              owned={owned}
              onOpen={() => onOpen(item.id)}
            />
          ))}
        </div>

        {items.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-500">这一类里还没有东西</p>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-ink-500">
        想换的东西，先让爸爸妈妈知道 · 你现在有 {balance} 张兑换券
      </p>
    </div>
  )
}

function BlindBoxHero({
  item,
  offer,
  order,
  owned,
  onOpen,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { status: string } | undefined
  owned: Set<string>
  onOpen: () => void
}) {
  const remaining = blindBoxRemaining(item.pool ?? [], [...owned])
  const soldOut = remaining.length === 0

  return (
    <button
      onClick={onOpen}
      className="relative flex w-full items-center gap-3 rounded-3xl bg-sun-100 p-3.5 text-left shadow-flat"
    >
      <span className="absolute -top-1.5 right-3 rounded-full bg-berry-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
        优先
      </span>
      <span className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-white text-3xl shadow-flat">
        {item.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-extrabold text-ink-900">
          {item.name}
        </span>
        <span className="mt-0.5 block text-xs font-bold text-ink-600">{item.note}</span>
        <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {soldOut ? (
            <Tag tone="gray">全都玩过了</Tag>
          ) : offer ? (
            <Tag tone="green">🎫 {offer.voucherPrice}</Tag>
          ) : (
            <Tag tone="gray">等爸妈开放</Tag>
          )}
          <Tag tone="plain">还能开出 {remaining.length} 款</Tag>
          {order?.status === 'committed' && <Tag tone="amber">等爸妈确认</Tag>}
        </span>
      </span>
    </button>
  )
}

function ItemCard({
  item,
  offer,
  order,
  owned,
  onOpen,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { status: string } | undefined
  owned: Set<string>
  onOpen: () => void
}) {
  const alreadyOwned = item.kind === 'gamebox' && !!item.gameId && owned.has(item.gameId)

  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-3xl bg-white p-2.5 text-left shadow-flat"
    >
      <span
        className={
          'mb-2 flex aspect-[4/3] items-center justify-center rounded-2xl text-3xl ' +
          TINT_BG[item.tint]
        }
      >
        {item.emoji}
      </span>
      <span className="px-0.5 text-sm font-extrabold leading-snug text-ink-900">
        {item.name}
      </span>
      <span className="mt-0.5 px-0.5 text-[11px] font-bold text-ink-500">
        {item.partnerName ?? WISH_KIND_META[item.kind].label}
        {item.kind === 'gamebox' ? ' · 指定款' : ''}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1 px-0.5">
        {alreadyOwned ? (
          <Tag tone="gray">已经有了</Tag>
        ) : order?.status === 'committed' ? (
          <Tag tone="amber">等爸妈确认</Tag>
        ) : offer ? (
          // 定价优先于「已告诉爸妈」：家长开放之后，卡片上该显示价格，
          // 否则孩子永远看不到「现在可以换了」
          <Tag tone="green">🎫 {offer.voucherPrice}</Tag>
        ) : order?.status === 'wished' ? (
          <Tag tone="blue">已告诉爸妈</Tag>
        ) : (
          <Tag tone="gray">等爸妈开放</Tag>
        )}
      </span>
    </button>
  )
}

/* ============================================================
   ② 详情
   ============================================================ */

function DetailView({
  item,
  offer,
  order,
  balance,
  owned,
  onBack,
  onOffer,
  onConfirm,
  onBox,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { id: string; status: string } | undefined
  balance: number
  owned: Set<string>
  onBack: () => void
  onOffer: () => void
  onConfirm: (orderId: string) => void
  onBox: (gameId: string) => void
}) {
  const wishExpress = useApp((s) => s.wishExpress)
  const wishRedeem = useApp((s) => s.wishRedeem)
  const pushToast = useApp((s) => s.pushToast)

  const [busy, setBusy] = useState(false)
  const [pinOk, setPinOk] = useState(false)
  const settings = useApp((s) => s.settings)
  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  const plan = offer ? planWishRedeem(offer.voucherPrice, balance) : null
  const alreadyOwned = item.kind === 'gamebox' && !!item.gameId && owned.has(item.gameId)
  const boxRemaining = item.kind === 'blindbox' ? blindBoxRemaining(item.pool ?? [], [...owned]) : []
  const soldOut = item.kind === 'blindbox' && boxRemaining.length === 0

  const meta = WISH_KIND_META[item.kind]

  const doRedeem = async () => {
    if (busy) return
    setBusy(true)
    const res = await wishRedeem(item.id)
    setBusy(false)
    if (!res.ok) {
      pushToast({ kind: 'warn', title: res.message, emoji: '🎫' })
      return
    }
    if (res.gameId) onBox(res.gameId)
    else onBack()
  }

  /*
   * 家长入口只留「定价」一个。
   *
   * 「确认兑换」不走这里 —— 它属于**订单**，属于详情页底部的动作区，
   * 而且必须先过密码闸门。原来两个入口都指向同一件事，
   * 结果从顶栏点进去会绕过闸门（闸门只渲染在底部）。
   */
  const canPrice = !order || order.status !== 'committed'

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 pt-safe pt-3">
        <button
          onClick={onBack}
          aria-label="返回"
          className="btn flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg text-ink-700 shadow-flat"
        >
          ←
        </button>
        <span className="font-display text-base font-extrabold">{item.name}</span>
        <span className="flex-1" />
        {canPrice && (
          <button
            onClick={onOffer}
            className="rounded-full bg-ink-900/5 px-3 py-1.5 text-[11px] font-extrabold text-ink-600"
          >
            定价
          </button>
        )}
      </div>

      <div
        className={
          'mt-3 flex aspect-[4/3] items-center justify-center rounded-3xl text-7xl shadow-flat ' +
          TINT_BG[item.tint]
        }
      >
        {item.emoji}
      </div>

      <div className="mt-4">
        <h2 className="font-display text-xl font-extrabold leading-snug text-ink-900">
          {item.name}
        </h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-ink-500">
          <span className="rounded-full bg-white px-2 py-0.5 shadow-flat">
            {meta.emoji} {item.kind === 'gamebox' ? '游戏盒子' : meta.label}
          </span>
          {item.partnerName && <span>{item.partnerName}</span>}
          {item.ageRange && (
            <span>
              {item.ageRange[1] >= 99
                ? `${item.ageRange[0]} 岁以上`
                : `${item.ageRange[0]}–${item.ageRange[1]} 岁`}
            </span>
          )}
        </p>
      </div>

      {item.note && <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.note}</p>}

      {/* 价格与券价**必须分层** —— 见文件头第 3 条 */}
      {item.priceCents != null && (
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-white px-3.5 py-2.5 shadow-flat">
          <span className="text-xs font-bold text-ink-500">家长支付</span>
          <span className="font-display text-sm font-extrabold text-ink-700">
            {formatPriceCents(item.priceCents)}
          </span>
        </div>
      )}

      {offer && (
        <div className="mt-3 rounded-2xl bg-white px-3.5 py-3 shadow-flat">
          <div className="flex items-center justify-between text-xs font-bold text-ink-500">
            <span>你的兑换券</span>
            <span className="font-display text-sm text-ink-900">{balance} 张</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
            <i
              className="block h-full rounded-full bg-grass-500"
              style={{
                width: `${Math.min(100, Math.round((balance / Math.max(1, offer.voucherPrice)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] font-bold text-ink-500">
            {plan?.affordable
              ? `换这个要 ${offer.voucherPrice} 张，够啦`
              : `换这个要 ${offer.voucherPrice} 张，还差 ${plan?.shortfall ?? 0} 张`}
          </p>
        </div>
      )}

      {item.notice && (
        <p className="mt-3 rounded-2xl bg-sun-50 px-3.5 py-2.5 text-[11.5px] font-bold leading-relaxed text-sun-700">
          {item.notice}
        </p>
      )}

      <div className="mt-4">
        {order?.status === 'committed' ? (
          // 已兑换 = 订单在等家长。**密码闸门直接顶替按钮** ——
          // 让面板和按钮同时出现，按钮就成了一个假闸门。
          needsPin && !pinOk ? (
            <ParentPinPanel
              title="请爸爸妈妈来一下"
              hint="确认兑换需要密码"
              onPass={() => setPinOk(true)}
            />
          ) : (
            <button
              onClick={() => onConfirm(order.id)}
              className="btn h-12 w-full bg-grass-500 text-base font-extrabold text-white active:btn-press"
            >
              确认兑换 · 去购买
            </button>
          )
        ) : alreadyOwned ? (
          <div className="rounded-2xl bg-ink-900/5 px-4 py-3 text-center text-sm font-extrabold text-ink-500">
            这个游戏你已经有了
          </div>
        ) : soldOut ? (
          <div className="rounded-2xl bg-ink-900/5 px-4 py-3 text-center text-sm font-extrabold text-ink-500">
            这些游戏你都有啦
          </div>
        ) : !offer ? (
          /*
           * ⚠️ 「已经表明意向」这个分支**只能放在「没有定价」里面**。
           *
           * 放在外面的话会出现一个很荒唐的死结：孩子先点「想要」→ 家长
           * 随后定了价 → 页面仍然显示「等爸妈定价」，**兑换按钮不出现**。
           * 孩子表过态反而换不了，而家长那边以为已经放开了。
           * 2026-10-28 走查抓到（`e2e-wishmall.mjs` 的「定价后出现兑换按钮」）。
           */
          order?.status === 'wished' ? (
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-center text-sm font-extrabold text-sky-500">
              已经告诉爸妈，等他们定价
            </div>
          ) : (
            <button
              onClick={() => void wishExpress(item.id)}
              className="btn h-12 w-full bg-sun-400 text-base font-extrabold text-ink-900 active:btn-press"
            >
              🤍 想要这个
            </button>
          )
        ) : (
          <button
            onClick={() => void doRedeem()}
            disabled={!plan?.affordable || busy}
            className={
              'btn h-12 w-full text-base font-extrabold active:btn-press ' +
              (plan?.affordable ? 'bg-grass-500 text-white' : 'bg-ink-100 text-ink-500')
            }
          >
            {busy
              ? '正在兑换…'
              : plan?.affordable
                ? `🎫 用 ${offer.voucherPrice} 张兑换`
                : `还差 ${plan?.shortfall ?? 0} 张`}
          </button>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   ③ 家长 · 定价开放
   ============================================================ */

function OfferView({
  itemId,
  onBack,
  onDone,
  harvestLedger,
}: {
  itemId: string
  onBack: () => void
  onDone: () => void
  harvestLedger: { delta: number; createdAt: number }[]
}) {
  const item = wishItemById(itemId)
  const wishSetOffer = useApp((s) => s.wishSetOffer)
  const wishOffers = useApp((s) => s.wishOffers)
  const wishOrders = useApp((s) => s.wishOrders)
  const settings = useApp((s) => s.settings)
  const pushToast = useApp((s) => s.pushToast)

  /**
   * 孩子到底有没有表达过意向。
   *
   * ⚠️ 这里原来写死「孩子想要这个」。可家长**可以主动**先来定价
   * （这正是最常见的用法：爸妈先开放，孩子才看得到价格），
   * 那时孩子根本没点过「想要这个」—— 页面却在替孩子撒谎。
   * 2026-10-28 截图走查发现（capture 的流程从没点过「想要这个」，
   * 定价页却写着这句），**结构断言完全看不出来**。
   */
  const childAsked = wishOrders.some(
    (o) =>
      o.itemId === itemId &&
      (o.status === 'wished' || o.status === 'committed' || o.status === 'confirmed'),
  )

  const cur = wishOffers.find((o) => o.itemId === itemId && !o.closedAt)
  const [price, setPrice] = useState(cur?.voucherPrice ?? 30)
  const [pinOk, setPinOk] = useState(false)
  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  // 最近 7 天的日均券收入 —— 给家长一个「定多少合理」的锚
  const perDay = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000
    const earned = harvestLedger
      .filter((e) => e.createdAt >= since && e.delta > 0)
      .reduce((sum, e) => sum + e.delta, 0)
    return earned / 7
  }, [harvestLedger])

  const days = daysToSave(price, perDay)

  if (!item) return <EmptyState onBack={onBack} />

  if (needsPin && !pinOk) {
    return (
      <div className="pt-safe pt-4">
        <ParentPinPanel
          title="请爸爸妈妈来一下"
          hint="给商品定价需要密码"
          onPass={() => setPinOk(true)}
          onCancel={onBack}
        />
      </div>
    )
  }

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 pt-safe pt-3">
        <button
          onClick={onBack}
          aria-label="返回"
          className="btn flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg text-ink-700 shadow-flat"
        >
          ←
        </button>
        <span className="font-display text-base font-extrabold">开放兑换</span>
        <span className="flex-1" />
        <span className="rounded-full bg-grape-100 px-2.5 py-1 text-[11px] font-extrabold text-grape-500">
          👤 家长
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <span
          className={
            'flex h-13 w-13 flex-none items-center justify-center rounded-2xl text-2xl ' +
            TINT_BG[item.tint]
          }
        >
          {item.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">{item.name}</span>
          <span className="mt-0.5 block text-[11px] font-bold text-ink-500">
            {childAsked ? '孩子想要这个' : '孩子还没提过，定好价他就看到了'}
          </span>
        </span>
      </div>

      <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <p className="text-sm font-extrabold">定一个兑换券价格</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-paper-2 p-1">
          <button
            onClick={() => setPrice((p) => Math.max(1, p - 5))}
            className="btn h-10 w-10 bg-white text-lg text-ink-700 shadow-flat"
            aria-label="减五张"
          >
            −
          </button>
          <span className="flex-1 text-center font-display text-xl font-extrabold">
            {price}
            <span className="ml-1 text-xs font-bold text-ink-500">张</span>
          </span>
          <button
            onClick={() => setPrice((p) => Math.min(9999, p + 5))}
            className="btn h-10 w-10 bg-white text-lg text-ink-700 shadow-flat"
            aria-label="加五张"
          >
            +
          </button>
        </div>
        <p className="mt-2.5 rounded-xl bg-sun-100 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-sun-700">
          {/* 刚装的应用一条兑换券流水都没有 —— 这时候写「平均每天赚 0 张」
              是在拿一个假数字当参考。宁可直说还没有数据。 */}
          {perDay > 0 ? (
            <>
              📊 孩子最近 7 天平均每天赚 {Math.round(perDay)} 张
              {days != null && days > 0 ? `，定 ${price} 张大约要攒 ${days} 天` : ''}
            </>
          ) : (
            <>📊 还没有兑换券流水。等孩子玩几局游戏、或者去农场收成，这里就能算出「要攒几天」。</>
          )}
        </p>
      </div>

      <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-xs font-bold text-ink-500">商品参考价</span>
          <span className="font-display font-extrabold">
            {item.priceCents != null ? formatPriceCents(item.priceCents) : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between py-1.5 text-sm">
          <span className="text-xs font-bold text-ink-500">商品来源</span>
          <span className="text-xs font-bold text-ink-600">{item.partnerName ?? 'App 内'}</span>
        </div>
      </div>

      <p className="mt-3 rounded-2xl bg-sky-50 px-3.5 py-2.5 text-[11px] font-bold leading-relaxed text-sky-500">
        🔒 兑换券只能靠玩和农场产出，不能买、也不能换积分。定了价以后孩子攒够就能自己换。
      </p>

      <div className="mt-4 flex gap-2">
        {cur && (
          <button
            onClick={async () => {
              await wishSetOffer(itemId, 0)
              pushToast({ kind: 'info', title: '已关闭兑换', emoji: '🔒' })
              onDone()
            }}
            className="btn h-12 rounded-2xl bg-white px-4 text-sm font-extrabold text-ink-600 shadow-flat"
          >
            关闭
          </button>
        )}
        <button
          onClick={async () => {
            await wishSetOffer(itemId, price)
            pushToast({
              kind: 'reward',
              title: `已开放：${price} 张兑换券`,
              detail: '孩子现在可以换了',
              emoji: '✅',
            })
            onDone()
          }}
          className="btn h-12 flex-1 bg-ink-900 text-base font-extrabold text-white active:btn-press"
        >
          开放兑换
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   ④ 家长 · 确认购买
   ============================================================ */

function ConfirmView({
  orderId,
  onBack,
  onDone,
}: {
  orderId: string
  onBack: () => void
  onDone: () => void
}) {
  const order = useApp((s) => s.wishOrders.find((o) => o.id === orderId))
  const wishConfirm = useApp((s) => s.wishConfirm)
  const wishDone = useApp((s) => s.wishDone)
  const wishCancel = useApp((s) => s.wishCancel)
  const pushToast = useApp((s) => s.pushToast)

  const item = order ? wishItemById(order.itemId) : undefined

  if (!order) return <EmptyState onBack={onBack} />

  const buy = () => {
    // 只在家长确认页出现外链 —— 孩子端读不到 `buyUrl`
    if (item?.buyUrl) window.open(item.buyUrl, '_blank', 'noopener,noreferrer')
    else pushToast({ kind: 'info', title: '这件商品没有外链', emoji: '🔗' })
  }

  return (
    <div className="pb-4">
      <div className="flex items-center gap-2 pt-safe pt-3">
        <button
          onClick={onBack}
          aria-label="返回"
          className="btn flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg text-ink-700 shadow-flat"
        >
          ←
        </button>
        <span className="font-display text-base font-extrabold">确认兑换</span>
        <span className="flex-1" />
        <span className="rounded-full bg-grape-100 px-2.5 py-1 text-[11px] font-extrabold text-grape-500">
          👤 家长
        </span>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <span
          className={
            'flex h-13 w-13 flex-none items-center justify-center rounded-2xl text-2xl ' +
            TINT_BG[order.kind === 'toy' || order.kind === 'study' || order.kind === 'collectible'
              ? (item?.tint ?? 'sun')
              : 'sun']
          }
        >
          {order.itemEmoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold">{order.itemName}</span>
          <span className="mt-0.5 block text-[11px] font-bold text-ink-500">
            孩子已付 🎫 {order.vouchersHeld} 张
          </span>
        </span>
        <span className="rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-extrabold text-grass-700">
          待确认
        </span>
      </div>

      <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <p className="text-sm font-extrabold">怎么拿到这个</p>
        <div className="mt-2 flex items-center justify-between py-1.5 text-sm">
          <span className="text-xs font-bold text-ink-500">方式</span>
          <span className="text-xs font-bold text-ink-600">
            {item?.buyUrl ? '去商店购买' : 'App 内直接解锁'}
          </span>
        </div>
        {item?.priceCents != null && (
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-xs font-bold text-ink-500">参考价</span>
            <span className="font-display font-extrabold">
              {formatPriceCents(item.priceCents)}
            </span>
          </div>
        )}
        {item?.buyUrl && (
          <button
            onClick={buy}
            className="btn mt-3 h-12 w-full bg-sun-400 text-base font-extrabold text-ink-900 active:btn-press"
          >
            ↗ {item.buyLabel ?? '去商店购买'}
          </button>
        )}
        <p className="mt-2.5 rounded-xl bg-sun-100 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-sun-700">
          📦 App 不代收货款。买好之后回到这里点「已经买好了」。
        </p>
      </div>

      <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <p className="text-sm font-extrabold">孩子的兑换券</p>
        <div className="mt-1 flex items-center justify-between py-1.5 text-sm">
          <span className="text-xs font-bold text-ink-500">已扣除</span>
          <span className="font-display font-extrabold text-berry-500">
            − {order.vouchersHeld}
          </span>
        </div>
        <p className="mt-1 rounded-xl bg-sky-50 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-sky-500">
          ↩️ 如果最后没买成，点「取消兑换」，{order.vouchersHeld} 张会原样退回去。
        </p>
        {/* 数字商品：取消要连带收回游戏。**必须先说清楚** ——
            家长点这个按钮的动机通常是「价格定错了」，不会想到
            游戏会从孩子的游戏柜里消失。进度保留这句也得写，
            否则家长会以为孩子白玩了。 */}
        {order.openedGameId && (
          <p className="mt-1.5 rounded-xl bg-sun-100 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-sun-700">
            🎮 这一单已经交付了游戏。取消会把游戏收回，孩子的进度会保留，
            下次兑换还能接着玩。
          </p>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={async () => {
            await wishCancel(order.id, '家长取消')
            // 收回游戏时**不要再弹第二个 toast** —— `wishCancel` 里已经弹了
            // 「已退回 N 张兑换券 / 游戏已收回」，两个叠在一起会互相盖掉。
            if (!order.openedGameId) {
              pushToast({ kind: 'info', title: '已取消，券退回去了', emoji: '↩️' })
            }
            onDone()
          }}
          className="btn h-12 rounded-2xl bg-white px-4 text-sm font-extrabold text-ink-600 shadow-flat"
        >
          取消兑换
        </button>
        <button
          onClick={async () => {
            await wishConfirm(order.id)
            await wishDone(order.id)
            pushToast({ kind: 'reward', title: '已经完成啦', emoji: '🎉' })
            onDone()
          }}
          className="btn h-12 flex-1 bg-grass-500 text-base font-extrabold text-white active:btn-press"
        >
          已经买好了
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   ⑤ 开盲盒
   ============================================================ */

function BoxView({ gameId, onDone }: { gameId: string; onDone: () => void }) {
  const entry = STOREFRONT.find((s) => s.id === gameId)

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 pt-safe">
      <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-sun-100 text-7xl shadow-float">
        🎁
      </div>
      <p className="mt-3 font-display text-xs font-extrabold tracking-[0.3em] text-sun-500">
        ✦ ✦ ✦
      </p>
      <h2 className="mt-2 font-display text-2xl font-extrabold">抽到了新游戏</h2>
      <p className="mt-1 text-center text-sm font-bold leading-relaxed text-ink-600">
        这张盲盒里是这一款
        <br />
        已经放进你的游戏柜了
      </p>

      {entry && (
        <div className="mt-5 flex w-full items-center gap-3 rounded-3xl bg-white p-3 shadow-float">
          <span
            className={
              'flex h-14 w-14 flex-none items-center justify-center rounded-2xl text-2xl ' +
              TINT_BG[(entry.tint as WishTint) ?? 'sun']
            }
          >
            {entry.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-extrabold">{entry.name}</span>
            <span className="mt-0.5 block text-[11px] font-bold text-ink-500">
              {entry.pitch}
            </span>
          </span>
          <span className="rounded-full bg-berry-100 px-2 py-0.5 text-[10px] font-extrabold text-berry-500">
            NEW
          </span>
        </div>
      )}

      <button
        onClick={onDone}
        className="btn mt-6 h-12 w-full bg-grass-500 text-base font-extrabold text-white active:btn-press"
      >
        收下
      </button>
    </div>
  )
}

/* ============================================================
   小零件
   ============================================================ */

function Tag({
  tone,
  children,
}: {
  tone: 'green' | 'gray' | 'amber' | 'blue' | 'plain'
  children: React.ReactNode
}) {
  const cls = {
    green: 'bg-grass-100 text-grass-700',
    gray: 'bg-ink-900/5 text-ink-500',
    amber: 'bg-sun-100 text-sun-700',
    blue: 'bg-sky-100 text-sky-500',
    plain: 'bg-white/70 text-ink-500',
  }[tone]
  return (
    <span className={'rounded-full px-2 py-0.5 text-[10px] font-extrabold ' + cls}>
      {children}
    </span>
  )
}

function EmptyState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <p className="text-sm font-bold text-ink-500">这件商品已经不在了</p>
      <button
        onClick={onBack}
        className="btn h-10 rounded-xl bg-white px-4 text-sm font-extrabold text-ink-700 shadow-flat"
      >
        回商城看看
      </button>
    </div>
  )
}
