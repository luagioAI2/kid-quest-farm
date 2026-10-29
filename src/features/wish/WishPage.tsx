import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/store/useApp'
import type { WishItem, WishTint } from '@/domain/types'
import {
  WISH_KIND_META,
  WISH_STATUS_TEXT,
  blindBoxRemaining,
  compareWishItem,
  daysToSave,
  planWishRedeem,
  redeemedGameIdsFrom,
  type WishFilter,
} from '@/domain/wish'
import { humanizeAgo } from '@/domain/time'
import { describeRedeemPayment } from '@/domain/redeem'
import { formatPriceCents } from '@/domain/cash'
import { WISH_BLINDBOX_ID, WISH_ITEMS, wishItemById } from '@/games/wishCatalog'
import { STOREFRONT, type StorefrontEntry } from '@/games/storefront'
import { LOCAL_GAMES } from '@/games/localGames'
import { formatSize } from '@/games/size'
import { GameIconArt } from '../settings/GameIcon'
import { Portal } from '@/components/Portal'
import { ParentPinPanel } from '../parent/ParentGate'

/* ============================================================
   心愿商城（底部导航第 4 格，2026-10-28）
   ------------------------------------------------------------
   和「兑换」是两个东西：
     · 兑换  = 家里的事：家长自己加的商品，家长自己兑现
     · 心愿  = 外面的事：合作商/运营提供的商品，成交在淘宝

   完整口径见 `docs/wish-mall-spec.md`。三条最要紧的：

   1. **收兑换券 + 积分，规则和「兑换」一字不差**（2026-10-29 家长要求）：
      券先花、不够用积分补、1 券 ≡ 1 积分。原来写的是「只收兑换券，
      不混付积分」—— 那条已作废。
   2. **孩子「确定兑换」就真扣券** —— 因为成交在 App 外面，不扣的话
      孩子能同时挂 10 个「已兑换」，家长每个都得去淘宝买一遍。
   3. **价格与券价不同行**，价格旁必须写「家长支付」。
      `80 张` 和 `¥69` 并排，孩子会自己算出汇率 —— 算术本能挡不住，
      能挡住的只有归属。

   ## 视图
   一个容器 + 五个视图，靠 `view` 状态切。**不做路由** ——
   底部导航只有一格，进来出去都是一次性的，加路由只会让返回键变复杂。
   ============================================================ */

/**
 * 这一单孩子**实际付了什么**，一句话。
 *
 * 2026-10-29 起可以券 + 积分混付，`vouchersHeld` 只是券那部分 ——
 * 家长端那几处（「孩子已付」「已扣除」「会原样退回」）原来直接写
 * `{vouchersHeld} 张`，混付的单子会**漏掉积分**，看着像少扣了钱。
 *
 * `pointsHeld` 缺省 0：老订单全是纯券单，走这条分支不会多出「+ 0 积分」。
 */
function paidText(o: { vouchersHeld: number; pointsHeld?: number }): string {
  const parts: string[] = []
  if (o.vouchersHeld > 0) parts.push(`🎫 ${o.vouchersHeld} 张`)
  const points = o.pointsHeld ?? 0
  if (points > 0) parts.push(`🪙 ${points} 积分`)
  // 理论上不会发生（`wished` 阶段不扣钱），但空字符串会让句子变成
  // 「孩子已付 」—— 少一个词比多一个错数更容易被当成排版问题放过。
  return parts.length > 0 ? parts.join(' + ') : '0'
}

/**
 * 券不够、但**加上积分就够**时，还要补多少积分；否则 0。
 *
 * 列表卡片和盲盒 hero 都用它。各写一遍的话，两处阈值迟早不一致 ——
 * 一处说「🪙 补 20」，另一处什么都不显示。
 */
function topUpOf(price: number, vouchers: number, points: number): number {
  if (vouchers >= price) return 0
  return vouchers + points >= price ? price - vouchers : 0
}

const TINT_BG: Record<WishTint, string> = {
  sun: 'bg-sun-100',
  grass: 'bg-grass-100',
  sky: 'bg-sky-100',
  grape: 'bg-grape-100',
  tan: 'bg-tangerine-100',
  berry: 'bg-berry-100',
}

/**
 * 这一单**东西已经给了**没有。
 *
 * 数字商品（盲盒 / 盒子）在兑换那一刻就交付，凭证是 `openedGameId`
 * （装包成功才写）。实物要等爸妈去淘宝买，所以永远是 false。
 *
 * ⚠️ 判据用 `openedGameId` 而不是 `kind`：盒子装包失败会走 `wishCancel`
 * 退券，那种单子不该被当成「已交付」。判据和 `wishRedeem` / `wishCancel`
 * 里认的是同一个字段，三处口径一致。
 */
const isDelivered = (order?: { openedGameId?: string }) => !!order?.openedGameId

/**
 * 单个游戏（`kind === 'gamebox'`）在**商店目录**里的那一条。
 *
 * 心愿商城的游戏是从 `STOREFRONT` 推导出来的（见 `games/wishCatalog.ts`），
 * 所以点进一款游戏时能拿到截图 / 练什么 / 关于 —— 和「设置 → 游戏 → 详情」
 * 摆的是同一份内容。**「一个游戏就是那个游戏」**，不是「盒子里的一张卡」：
 * 没有截图、没有玩法说明，家长根本判断不了该不该给孩子换。
 */
function gameEntryOf(item: WishItem): StorefrontEntry | undefined {
  if (item.kind !== 'gamebox' || !item.gameId) return undefined
  return STOREFRONT.find((s) => s.id === item.gameId)
}

/**
 * 游戏图标：和商店列表用的是**同一支手绘插画**（`GameIconArt`），不是 emoji。
 *
 * emoji 是「平色块 + 系统字形」，放在 58px 的卡片里和旁边的手绘图标一比，
 * 一眼就是占位图。商店那边 2026-10-25 已经换过一轮，这里跟着走。
 */
function WishGameIcon({
  entry,
  size = 'md',
}: {
  entry: StorefrontEntry
  size?: 'md' | 'lg'
}) {
  const box = size === 'lg' ? 'h-20 w-20 rounded-[22px]' : 'h-14 w-14 rounded-2xl'
  return (
    <span
      aria-hidden
      className={'shrink-0 overflow-hidden border-3 border-ink-900/10 shadow-flat ' + box}
    >
      <GameIconArt id={entry.id} tint={entry.tint} className="h-full w-full" />
    </span>
  )
}

/** 游戏详情里的小标签（适龄 / 一局多久 / 包多大） */
function Meta({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-ink-900/5 px-2.5 py-1 text-[11px] font-extrabold text-ink-600">
      {children}
    </span>
  )
}

type WishView =
  | { kind: 'list' }
  | { kind: 'detail'; itemId: string }
  | { kind: 'offer'; itemId: string }
  | { kind: 'confirm'; orderId: string }
  | { kind: 'box'; gameId: string }
  | { kind: 'orders' }

export default function WishPage() {
  const wishOffers = useApp((s) => s.wishOffers)
  const wishOrders = useApp((s) => s.wishOrders)
  const harvestBalance = useApp((s) => s.harvestBalance)
  /**
   * 积分余额。2026-10-29 起心愿商城也能用积分补差额（家长要求，
   * 规则和「兑换」模块一致：券先花、不够用积分、1 比 1）。
   *
   * ⚠️ 这两个数**必须一起传下去**。只传券的话，界面算出的「够不够」
   *    会和 `wishRedeem` 里的真实判断不一致 —— 卡片写着差 10 张，
   *    点下去却能换（或者反过来，按钮亮着但一点就被拒）。
   */
  const pointsBalance = useApp((s) => s.balance)
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

  /**
   * 某件商品**最近一次被取消**的单子（只看有理由的）。
   *
   * 用途只有一个：孩子被回绝之后再点进这一屏，能看到「上次爸妈说：…」，
   * 而不是面对一个干干净净的「🤍 想要这个」—— 那样他会以为自己没说过，
   * 家长那边则会收到同一个请求第二遍。
   *
   * ⚠️ 只是**提示**，不是冷却：仍然允许再点一次。心愿不是一次性资源，
   *    用时间锁挡住孩子只会让家长在不知情的情况下继续收请求。
   */
  const lastCancelledOf = (itemId: string) =>
    wishOrders
      .filter((o) => o.itemId === itemId && o.status === 'cancelled' && o.cancelReason)
      .sort((a, b) => (b.cancelledAt ?? b.createdAt) - (a.cancelledAt ?? a.createdAt))[0]

  /**
   * 还等着**家长**处理的单子。
   *
   * 没有这一条的话，家长只能逐个商品点开、看卡片上的标记，才知道有单子
   * 要处理 —— 孩子换了东西，家长那边一点提示都没有。整条链路里
   * 「现在该谁动手」只在这一处有答案，所以摆在列表最上面。
   *
   * ## ⚠️ 2026-10-29 把「已告诉爸妈」（`wished`）也算进来了
   *
   * 原来只收 `committed` / `confirmed` —— 也就是**孩子已经花掉券**的单子。
   * 结果孩子点完「🤍 想要这个」、屏幕上写着「已经告诉爸妈，等他们定价」，
   * 而家长那一侧**一片安静**：没有红点、没有卡片、列表里那件商品也还是
   * 原样（只是标签从「等爸妈开放」变成「已告诉爸妈」）。
   * 家长原话：「已告诉爸爸妈妈，爸爸妈妈如何处理」。
   *
   * 两段要分开摆，因为**该做的动作不一样**：
   *   · `wished`     —— 还没花钱。家长要**回应**：定个价，或者这次先不换。
   *   · `committed`  —— 券已经扣了。家长要**去办**：外链买，或者收尾。
   * 合成一张卡的话，文案只能写成「有 N 单等你处理」，等于什么都没说。
   */
  const wishes = useMemo(
    () => wishOrders.filter((o) => o.status === 'wished').sort((a, b) => b.createdAt - a.createdAt),
    [wishOrders],
  )

  const pendingOrders = useMemo(
    () =>
      wishOrders
        .filter((o) => o.status === 'committed' || o.status === 'confirmed')
        .sort((a, b) => b.createdAt - a.createdAt),
    [wishOrders],
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
  } else if (view.kind === 'orders') {
    content = (
      <OrdersView
        orders={wishOrders}
        onBack={goList}
        onOpen={(itemId) => setView({ kind: 'detail', itemId })}
      />
    )
  } else if (view.kind === 'box') {
    content = <BoxView gameId={view.gameId} onDone={goList} />
  } else if (view.kind === 'detail') {
    const item = wishItemById(view.itemId)
    content = item ? (
      <DetailView
        item={item}
        offer={offerOf(item.id)}
        order={activeOrderOf(item.id)}
        lastCancelled={lastCancelledOf(item.id)}
        vouchers={harvestBalance}
        points={pointsBalance}
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
        pending={pendingOrders}
        wishes={wishes}
        vouchers={harvestBalance}
        points={pointsBalance}
        owned={owned}
        onOpen={(itemId) => setView({ kind: 'detail', itemId })}
        onOrders={() => setView({ kind: 'orders' })}
      />
    )
  }

  /**
   * 换视图时**回到顶部**。
   *
   * 不重置的话：列表往下滚到「游戏」那一区（实物后面，要滚两三屏），
   * 点进去看到的是详情页的**中段**（截图 / 练什么），名字、券价和
   * 「用 N 张兑换」全在屏幕外 —— 看着像「点了没反应」。
   * 2026-10-28 用 `_wish-game-probe.mjs` 拍出来才发现的。
   *
   * 滚动容器是外壳的 `<main>`（页面自己不是滚动容器），所以要从根节点
   * 往上找第一个真正能滚的祖先，而不是只 `window.scrollTo`。
   */
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    let el: HTMLElement | null = rootRef.current?.parentElement ?? null
    while (el) {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = 0
        break
      }
      el = el.parentElement
    }
  }, [view])

  return (
    <div ref={rootRef} className="page-col px-4 pb-28">
      {content}
    </div>
  )
}

/* ============================================================
   ① 列表
   ============================================================ */

function ListView({
  filter,
  setFilter,
  offerOf,
  activeOrderOf,
  pending,
  wishes,
  vouchers,
  points,
  owned,
  onOpen,
  onOrders,
}: {
  filter: WishFilter
  setFilter: (f: WishFilter) => void
  offerOf: (id: string) => ReturnType<typeof useApp.getState>['wishOffers'][number] | undefined
  activeOrderOf: (id: string) => ReturnType<typeof useApp.getState>['wishOrders'][number] | undefined
  pending: ReturnType<typeof useApp.getState>['wishOrders']
  /** 孩子点了「想要这个」、还没定价的单子。家长要先回应它们（见 `pendingOrders` 的注释） */
  wishes: ReturnType<typeof useApp.getState>['wishOrders']
  /** 兑换券余额 */
  vouchers: number
  /** 积分余额（可以补券不够的部分） */
  points: number
  owned: Set<string>
  onOpen: (id: string) => void
  onOrders: () => void
}) {
  /**
   * ★ 已经拥有的游戏盒子**不再出现在「能换什么」里**（2026-10-29）。
   *
   * 家长原话：「兑换的东西有比如游戏，兑换了就有了，不需要再兑换，
   * 不需要显示在能换什么。」
   *
   * 之前它还在，只是标签从「等爸妈开放」变成「已经有了」—— 那条卡片
   * 既换不了、也没有任何可做的动作，纯粹占位置。孩子翻十几次
   * 都是同一堆自己已经有的东西。
   *
   * ⚠️ **只藏游戏盒子**，不藏盲盒：盲盒不是「拥有」，是「开完了」，
   *    它上面那句「这些游戏你都有啦」本身是信息，藏掉就什么都不剩了。
   * ⚠️ 藏了要**说一句**（下面那个计数），不然孩子只会觉得列表莫名其妙变短。
   */
  const items = useMemo(() => {
    const all = WISH_ITEMS.filter((i) => !i.archived)
      .filter((i) => !(i.kind === 'gamebox' && i.gameId && owned.has(i.gameId)))
      .sort(compareWishItem)
    if (!filter) return all
    return all.filter((i) => i.kind === filter)
  }, [filter, owned])

  /** 被藏起来的已拥有游戏数。只用来在列表底部解释一句 */
  const hiddenOwnedCount = useMemo(
    () =>
      WISH_ITEMS.filter(
        (i) => !i.archived && i.kind === 'gamebox' && i.gameId && owned.has(i.gameId),
      ).length,
    [owned],
  )

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
          {/* 兑换记录：换过什么、到哪一步了。没有这一屏，`done` / `cancelled`
              的单子在界面上**彻底消失**（卡片只看得到「还没走完」的那些）。 */}
          <button
            onClick={onOrders}
            className="flex-none rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-ink-600 shadow-flat active:btn-press"
          >
            兑换记录
          </button>
        </div>
      </header>

      {/* 孩子的心愿 —— 还没花券，等家长**回应**（定价 / 这次先不换）。

          2026-10-29 之前这里什么都没有：孩子点完「🤍 想要这个」，他那一侧写着
          「已经告诉爸妈，等他们定价」，而家长这一侧没有任何提示。
          家长原话：「已告诉爸爸妈妈，爸爸妈妈如何处理」。

          ⚠️ 和下面那张「在等爸妈处理」的卡**分开**：那张是券已经扣了的单子，
          家长要去做；这张只是表个态，家长只需要回一句。 */}
      {wishes.length > 0 && (
        <button
          onClick={() => onOpen(wishes[0].itemId)}
          aria-label={`${wishes.length} 个心愿等爸妈回应`}
          className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-sky-50 p-3 text-left shadow-flat active:btn-press"
        >
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-white text-xl">
            🤍
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-ink-900">
              有 {wishes.length} 个心愿等你回应
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-bold text-ink-500">
              {wishes
                .slice(0, 2)
                .map((o) => o.itemName)
                .join('、')}
              {wishes.length > 2 ? ` 等 ${wishes.length} 件` : ''} · 点进去定价，或这次先不换
            </span>
          </span>
          <span className="text-lg text-ink-500">›</span>
        </button>
      )}

      {/* 待家长处理的单子 —— 整条链路里「现在该谁动手」只有这一处答案。
          没有它，家长要逐个商品点开、看卡片标记才知道孩子换了东西。

          ⚠️ 点它只回到**商品详情**，不能直接进确认页：确认页上有
          「取消兑换」和「去商店购买」，而密码闸门只渲染在详情页底部。
          直连确认页 = 孩子绕开家长密码 —— 这个坑 2026-10-28 已经踩过一次
          （当时是详情页右上角那个「确认兑换」入口）。 */}
      {pending.length > 0 && (
        <button
          onClick={() => onOpen(pending[0].itemId)}
          /* `aria-label` 是必须的：不加的话这个按钮的**可访问名**会把商品名
             也拼进去，走查/测试里按商品名找卡片会一次命中两个元素。 */
          aria-label={`待处理订单：${pending.length} 单`}
          className="mt-3 flex w-full items-center gap-3 rounded-3xl bg-white p-3 text-left shadow-flat active:btn-press"
        >
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-2xl bg-sun-100 text-xl">
            🔔
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-ink-900">
              有 {pending.length} 单在等爸妈处理
            </span>
            <span className="mt-0.5 block truncate text-[11px] font-bold text-ink-500">
              {pending
                .slice(0, 2)
                .map((o) => o.itemName)
                .join('、')}
              {pending.length > 2 ? ` 等 ${pending.length} 件` : ''} ·{' '}
              {pending.every((o) => o.openedGameId)
                ? '已放进游戏柜，等爸妈收尾'
                : pending.every((o) => !o.openedGameId)
                  ? '等爸妈去商店买'
                  : '点这里去看'}
            </span>
          </span>
          <span className="text-lg text-ink-500">›</span>
        </button>
      )}

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
            vouchers={vouchers}
            points={points}
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
              vouchers={vouchers}
              points={points}
              onOpen={() => onOpen(item.id)}
            />
          ))}
        </div>

        {items.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-500">这一类里还没有东西</p>
        )}

        {/* 藏了要说一句。不说的话，孩子只会觉得「昨天还有的东西今天没了」，
            而他要找的那款其实在「兑换记录」里躺着。 */}
        {hiddenOwnedCount > 0 && (
          <p className="px-1 text-[11px] leading-snug text-ink-400">
            有 {hiddenOwnedCount} 款游戏你已经换到了，不再列在这里 —— 去右上角「兑换记录」看是哪几款。
          </p>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-ink-500">
        想换的东西，先让爸爸妈妈知道 · 你现在有 {vouchers} 张兑换券
        {points > 0 ? ` + ${points} 积分` : ''}
      </p>
    </div>
  )
}

function BlindBoxHero({
  item,
  offer,
  order,
  owned,
  vouchers,
  points,
  onOpen,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { status: string } | undefined
  owned: Set<string>
  /** 兑换券余额。和 `points` 一起只用来判「券不够、但加上积分够」 */
  vouchers: number
  points: number
  onOpen: () => void
}) {
  const remaining = blindBoxRemaining(item.pool ?? [], [...owned])
  const soldOut = remaining.length === 0
  const topUp = offer ? topUpOf(offer.voucherPrice, vouchers, points) : 0

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
            <>
              <Tag tone="green">🎫 {offer.voucherPrice}</Tag>
              {topUp > 0 && <Tag tone="green">🪙 补 {topUp}</Tag>}
            </>
          ) : (
            <Tag tone="gray">等爸妈开放</Tag>
          )}
          <Tag tone="plain">还能开出 {remaining.length} 款</Tag>
          {order?.status === 'committed' && <Tag tone="green">已放进游戏柜</Tag>}
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
  vouchers,
  points,
  onOpen,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { status: string } | undefined
  owned: Set<string>
  /** 兑换券余额。和 `points` 一起只用来判「券不够、但加上积分够」 */
  vouchers: number
  points: number
  onOpen: () => void
}) {
  const alreadyOwned = item.kind === 'gamebox' && !!item.gameId && owned.has(item.gameId)
  const entry = gameEntryOf(item)

  /**
   * 券不够、但**加上积分就够** —— 卡片上补一个小标。
   *
   * 不补的话，一个「券 0、积分 300」的孩子看到满屏 `🎫 80` 会以为
   * 全都换不起，根本不会点进详情页 —— 而详情页里明明写着「付款：
   * 🪙 80 积分」。这正是 2026-10-29 这次改动要解决的问题。
   */
  const topUp = offer ? topUpOf(offer.voucherPrice, vouchers, points) : 0

  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-3xl bg-white p-2.5 text-left shadow-flat"
    >
      <span
        className={
          'mb-2 flex aspect-[4/3] items-center justify-center rounded-2xl ' +
          TINT_BG[item.tint]
        }
      >
        {/* 游戏用和商店同一支手绘图标，不用 emoji —— 后者在 58px 下像占位图 */}
        {entry ? <WishGameIcon entry={entry} /> : <span className="text-3xl">{item.emoji}</span>}
      </span>
      <span className="px-0.5 text-sm font-extrabold leading-snug text-ink-900">
        {item.name}
      </span>
      <span className="mt-0.5 px-0.5 text-[11px] font-bold text-ink-500">
        {item.partnerName ?? WISH_KIND_META[item.kind].label}
      </span>
      <span className="mt-1.5 flex flex-wrap items-center gap-1 px-0.5">
        {alreadyOwned ? (
          <Tag tone="gray">已经有了</Tag>
        ) : order?.status === 'committed' ? (
          /* ⚠️ 数字商品走不到这一支：`owned` 里已经包含
             `redeemedGameIdsFrom(wishOrders)`，所以「兑换到手过」的盒子
             永远先命中上面的 `alreadyOwned`。这里留着的只有实物。 */
          <Tag tone="amber">等爸妈确认</Tag>
        ) : offer ? (
          // 定价优先于「已告诉爸妈」：家长开放之后，卡片上该显示价格，
          // 否则孩子永远看不到「现在可以换了」
          <>
            <Tag tone="green">🎫 {offer.voucherPrice}</Tag>
            {topUp > 0 && <Tag tone="green">🪙 补 {topUp}</Tag>}
          </>
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
  lastCancelled,
  vouchers,
  points,
  owned,
  onBack,
  onOffer,
  onConfirm,
  onBox,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { id: string; status: string; openedGameId?: string } | undefined
  /** 最近一次被取消、且写了理由的单子。只用来在「想要这个」下面补一句「上次爸妈说：…」 */
  lastCancelled: { cancelReason?: string } | undefined
  /** 兑换券余额 */
  vouchers: number
  /** 积分余额（补券不够的部分，1 比 1） */
  points: number
  owned: Set<string>
  onBack: () => void
  onOffer: () => void
  onConfirm: (orderId: string) => void
  onBox: (gameId: string) => void
}) {
  const wishExpress = useApp((s) => s.wishExpress)
  const wishRedeem = useApp((s) => s.wishRedeem)
  const wishCancel = useApp((s) => s.wishCancel)
  const pushToast = useApp((s) => s.pushToast)

  const [busy, setBusy] = useState(false)
  const [pinOk, setPinOk] = useState(false)
  /** 数字商品：家长要主动点一下「完成这一单」，闸门才展开（见下面的注释） */
  const [pinOpen, setPinOpen] = useState(false)
  const settings = useApp((s) => s.settings)
  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  const plan = offer ? planWishRedeem(offer.voucherPrice, vouchers, points) : null
  const alreadyOwned = item.kind === 'gamebox' && !!item.gameId && owned.has(item.gameId)
  const boxRemaining = item.kind === 'blindbox' ? blindBoxRemaining(item.pool ?? [], [...owned]) : []
  const soldOut = item.kind === 'blindbox' && boxRemaining.length === 0

  /** 单个游戏的商店条目 + 本地包信息（版本 / 体积） */
  const gameEntry = gameEntryOf(item)
  const localGame = gameEntry ? LOCAL_GAMES.find((g) => g.id === gameEntry.id) : undefined
  /** 截图放大：必须 Portal 到 body，否则被页面外壳的层叠上下文关在小盒子里 */
  const [zoom, setZoom] = useState<{ src: string; caption: string } | null>(null)

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

  /**
   * 家长回绝一个心愿（`wished` → `cancelled`）。
   *
   * ⚠️ 走 `wishCancel` 而不是自己 `update`：它在**事务里重读状态**，
   * 而且对 `wished` 这条路径**不碰账本**（还没扣过券）。
   * 自己写一行 `status: 'cancelled'` 会绕过那道重读。
   *
   * 没有这个动作的话，孩子的心愿会永远停在「等他们定价」——
   * 他既不能自己撤回，家长也没有「不换」这个选项。
   */
  const doDecline = async () => {
    if (busy || !order) return
    setBusy(true)
    await wishCancel(order.id, '爸妈这次先不换')
    setBusy(false)
    pushToast({ kind: 'info', title: '已回绝', detail: '孩子能在兑换记录里看到', emoji: '💬' })
    onBack()
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

      {gameEntry ? (
        /*
         * 单个游戏：头部照「设置 → 游戏 → 详情」那一屏 —— 图标 + 版本 +
         * 一句话玩法 + 适龄 / 时长 / 包大小。截图和玩法说明在下面。
         *
         * 为什么不用 emoji 大图：这里卖的是**一个具体的游戏**，
         * 家长要判断「值不值得让孩子攒券换」，靠的是截图和玩法，
         * 不是一颗 🎮。
         */
        <div className="mt-3 flex gap-3 rounded-3xl bg-white p-3.5 shadow-flat">
          <WishGameIcon entry={gameEntry} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-extrabold leading-snug text-ink-900">
              {item.name}
            </h2>
            <p className="mt-0.5 text-[11px] font-bold text-ink-500">
              游戏{localGame ? ` · v${localGame.version}` : ''}
            </p>
            <p className="mt-1.5 text-sm leading-snug text-ink-700">{gameEntry.pitch}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Meta>{gameEntry.age}</Meta>
              <Meta>{gameEntry.session}</Meta>
              {localGame && <Meta>{formatSize(localGame.bytes)}</Meta>}
            </div>
          </div>
        </div>
      ) : (
        <>
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
                {meta.emoji} {meta.label}
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
        </>
      )}

      {/* 游戏的 `note` 就是 `pitch`（目录是推导出来的），上面已经写过了 */}
      {item.note && !gameEntry && (
        <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.note}</p>
      )}

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
            <span>你有</span>
            <span className="font-display text-sm text-ink-900">
              🎫 {vouchers} 张{points > 0 ? ` · 🪙 ${points} 积分` : ''}
            </span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-100">
            <i
              className="block h-full rounded-full bg-grass-500"
              style={{
                // 进度条按**两种币合计**算：只按券算的话，一个「券 0、积分够」
                // 的孩子会看到空条 + 一句「够啦」，自相矛盾。
                width: `${Math.min(100, Math.round(((vouchers + points) / Math.max(1, offer.voucherPrice)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[11px] font-bold text-ink-500">
            {plan?.affordable
              ? `换这个要 ${offer.voucherPrice}，付款：${describeRedeemPayment({
                  cost: offer.voucherPrice,
                  harvestPaid: plan.voucherPaid,
                  pointsPaid: plan.pointsPaid,
                })}`
              : `换这个要 ${offer.voucherPrice}，兑换券和积分加起来还差 ${plan?.shortfall ?? 0}`}
          </p>
        </div>
      )}

      {item.notice && (
        <p className="mt-3 rounded-2xl bg-sun-50 px-3.5 py-2.5 text-[11.5px] font-bold leading-relaxed text-sun-700">
          {item.notice}
        </p>
      )}

      <div className="mt-4">
        {order?.status === 'committed' && isDelivered(order) ? (
          /*
           * 数字商品：孩子**已经拿到了**（兑换那一刻就开箱/装包）。
           *
           * 所以这里不能把密码闸门摆成主内容 —— 他刚开完箱、游戏已经能玩，
           * 点进来却看到「请爸爸妈妈来一下」，看着像这一单还没成交。
           * 主内容写「已经放进游戏柜了」；家长那一侧只留一个小入口，
           * 过了密码才展开「完成这一单」（里面还能取消、退回券）。
           */
          <div className="space-y-2">
            <div className="rounded-2xl bg-grass-100 px-4 py-3 text-center text-sm font-extrabold text-grass-700">
              ✅ 已经放进你的游戏柜了
            </div>
            {needsPin && !pinOk ? (
              pinOpen ? (
                <ParentPinPanel
                  title="请爸爸妈妈来一下"
                  hint="处理这一单需要密码"
                  onPass={() => setPinOk(true)}
                />
              ) : (
                <button
                  onClick={() => setPinOpen(true)}
                  className="btn h-11 w-full rounded-2xl bg-white text-sm font-extrabold text-ink-600 shadow-flat active:btn-press"
                >
                  👤 爸妈：完成这一单
                </button>
              )
            ) : (
              <button
                onClick={() => onConfirm(order.id)}
                className="btn h-11 w-full rounded-2xl bg-white text-sm font-extrabold text-ink-600 shadow-flat active:btn-press"
              >
                完成这一单
              </button>
            )}
          </div>
        ) : order?.status === 'committed' ? (
          // 实物：已兑换 = 订单在等家长去外链买。**密码闸门直接顶替按钮** ——
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
            /*
             * 孩子表过态、家长还没定价。
             *
             * 2026-10-29 之前这里只有一行「已经告诉爸妈，等他们定价」——
             * 孩子看着像是在等一个永远不会来的回复，家长那边连提示都没有。
             * 现在把**家长的动作**摆出来：定个价。
             *
             * ## ★ 撤回按钮**不进家长闸门**
             *
             * 「先不要了」撤的是**孩子自己表的态**，不花钱、不碰账本
             * （`wishCancel` 对 `wished` 那条路径没有账本操作）。
             * 放进闸门里的话，家长锁一开，孩子后悔了就只能干等 ——
             * 而家长那边根本不知道有个作废的请求还挂着。
             *
             * 所以这里只有一个撤回按钮，两种形态共用：家长按是「回绝」，
             * 孩子按是「撤回」，落库是同一件事（`cancelReason` 写
             * 「这次先不换」，兑换记录里两边都看得见）。
             */
            <div className="space-y-2">
              <div className="rounded-2xl bg-sky-50 px-4 py-3 text-center text-sm font-extrabold text-sky-500">
                已经告诉爸妈，等他们回应
              </div>
              {needsPin && !pinOk ? (
                pinOpen ? (
                  <ParentPinPanel
                    title="请爸爸妈妈来一下"
                    hint="回应这个心愿需要密码"
                    onPass={() => setPinOk(true)}
                  />
                ) : (
                  <button
                    onClick={() => setPinOpen(true)}
                    data-wish-parent
                    className="btn h-11 w-full rounded-2xl bg-white text-sm font-extrabold text-ink-600 shadow-flat active:btn-press"
                  >
                    👤 爸妈：回应这个心愿
                  </button>
                )
              ) : (
                <button
                  onClick={onOffer}
                  data-wish-price
                  className="btn h-12 w-full rounded-2xl bg-grass-500 text-sm font-extrabold text-white active:btn-press"
                >
                  🎫 定个价
                </button>
              )}
              <button
                onClick={() => void doDecline()}
                disabled={busy}
                data-wish-decline
                className="btn h-10 w-full rounded-2xl bg-transparent text-[13px] font-bold text-ink-400 active:btn-press disabled:opacity-50"
              >
                先不要了
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <button
                onClick={() => void wishExpress(item.id)}
                className="btn h-12 w-full bg-sun-400 text-base font-extrabold text-ink-900 active:btn-press"
              >
                🤍 想要这个
              </button>
              {/* 上次被回绝过：把理由摆出来，别让孩子以为自己没说过。
                  仍然允许再点一次 —— 心愿不是一次性资源，加冷却只会让
                  家长在不知情的情况下继续收到同一个请求。 */}
              {lastCancelled?.cancelReason && (
                <p className="px-1 text-center text-[11px] font-bold leading-snug text-ink-400">
                  上次爸妈说：{lastCancelled.cancelReason}
                </p>
              )}
            </div>
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
                ? // 图标跟着**实际付款**走：纯积分单子（券 0、只靠积分）挂 🎫
                  // 就是自相矛盾 —— 同一屏上面刚写着「付款：80 积分」。
                  `${plan.voucherPaid > 0 ? '🎫' : '🪙'} 用 ${offer.voucherPrice} 换`
                : `还差 ${plan?.shortfall ?? 0}`}
          </button>
        )}
      </div>

      {/*
       * 单个游戏：把「设置 → 游戏 → 详情」里的三块内容搬过来 ——
       * 截图 / 练什么 / 关于。放在兑换按钮**下面**，是为了不让说明
       * 把「现在能不能换」挤出第一屏。
       */}
      {gameEntry && (
        <>
          <section className="mt-5">
            <p className="text-sm font-extrabold text-ink-900">截图</p>
            <p className="mt-0.5 text-[11px] font-bold text-ink-500">点一下能放大</p>
            <div className="-mx-4 mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
              {gameEntry.shots.map((s) => (
                <button
                  key={s.src}
                  onClick={() => setZoom(s)}
                  className="w-[132px] shrink-0 snap-start text-left active:scale-[.98]"
                >
                  <img
                    src={s.src}
                    alt=""
                    loading="lazy"
                    className="w-full rounded-xl border-2 border-ink-900/10 object-cover object-top"
                  />
                  <span className="mt-1 block text-[11px] leading-snug text-ink-500">
                    {s.caption}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <p className="text-sm font-extrabold text-ink-900">练什么</p>
            <ul className="mt-2 space-y-2">
              {gameEntry.learn.map((line) => (
                <li key={line} className="flex gap-2 text-sm leading-snug text-ink-700">
                  <span className="mt-[3px] shrink-0 text-grass-600">·</span>
                  <span className="min-w-0">{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-5">
            <p className="text-sm font-extrabold text-ink-900">关于这款游戏</p>
            <div className="mt-2 space-y-2">
              {gameEntry.about.map((p) => (
                <p key={p} className="text-sm leading-relaxed text-ink-700">
                  {p}
                </p>
              ))}
            </div>
          </section>
        </>
      )}

      {/* 截图放大：`fixed` 必须挂在 body 上，否则被页面外壳的层叠上下文
          关进小盒子，底部导航会压在大图上面（见 `components/Portal.tsx`）。 */}
      {zoom && (
        <Portal>
          <button
            onClick={() => setZoom(null)}
            aria-label="关闭大图"
            className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-ink-900/80 p-5"
          >
            <img
              src={zoom.src}
              alt=""
              className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
            />
            <span className="text-center text-sm font-bold text-white/90">{zoom.caption}</span>
          </button>
        </Portal>
      )}
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
   *
   * ⚠️ **有单子就算**，不按状态筛。一开始只认 `wished/committed/confirmed`，
   * 结果孩子**已经换过**（`done`）的商品，定价页说「孩子还没提过」——
   * 又是一种撒谎，而且更离谱。`cancelled` 同理：他当时确实想要过。
   * 这里只回答「他有没有表过态」，不回答「现在还想不想要」。
   */
  const childAsked = wishOrders.some((o) => o.itemId === itemId)

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

  /**
   * 孩子**现在手上**有多少（券 + 积分，1 比 1）。
   *
   * 2026-10-29 加了混付之后，这段估算必须把已有余额算进去 —— 原来只按
   * 券的日均收入算「要攒几天」，一个「券 0、积分 500」的孩子会被算成
   * 「要攒 20 天」，而其实定完价他马上就能换。**家长按这个数定价**，
   * 报错了就会把价压得比实际需要低。
   */
  const vouchersNow = useApp((s) => s.harvestBalance)
  const pointsNow = useApp((s) => s.balance)
  const nowHave = vouchersNow + pointsNow

  // 要攒的是**差额**，不是整价
  const days = daysToSave(price - nowHave, perDay)

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
              是在拿一个假数字当参考。宁可直说还没有数据。
              2026-10-29：积分也能补差额，所以三种情况都要报「现在有多少」。 */}
          {nowHave >= price ? (
            <>
              📊 孩子现在有 🎫 {vouchersNow} 张 + 🪙 {pointsNow} 积分，定 {price} 他马上就能换。
            </>
          ) : perDay > 0 ? (
            <>
              📊 孩子现在有 🎫 {vouchersNow} 张 + 🪙 {pointsNow} 积分，还差 {price - nowHave}。
              最近 7 天平均每天赚 {Math.round(perDay)} 张
              {days != null && days > 0 ? `，大约要攒 ${days} 天` : ''}
            </>
          ) : (
            <>
              📊 孩子现在有 🎫 {vouchersNow} 张 + 🪙 {pointsNow} 积分，还差 {price - nowHave}。
              等孩子玩几局游戏、或者去农场收成，这里就能算出「要攒几天」。
            </>
          )}
        </p>
        {/* 家长定的是「券价」，但孩子付款时积分也能补差额 —— 不说清楚的话，
            家长会以为「定 80 张 = 孩子必须有 80 张券」，从而把价压得比实际需要低。 */}
        <p className="mt-1.5 text-[11px] font-bold leading-relaxed text-ink-500">
          🪙 付款时先花兑换券，券不够的部分自动用积分补（1 张 = 1 积分），和「兑换」里一样。
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

  /**
   * 数字商品：`openedGameId` 就是「已经交付」的凭证（装包成功才会写）。
   *
   * 实物这一页是**家长去外链买**的收银台；数字商品没有这一步 ——
   * 游戏已经在孩子柜子里了，家长在这里只是把这一单收尾。
   * 文案必须跟着分叉，否则会出现「App 不代收货款，买好之后点已经买好了」
   * 这种对着一个已经解锁的游戏说的话。
   */
  const digital = isDelivered(order)

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
        <span className="font-display text-base font-extrabold">
          {/* 数字商品已经交付完了，标题再写「确认兑换」像是在让家长再确认一次 */}
          {digital ? '这一单' : '确认兑换'}
        </span>
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
            孩子已付 {paidText(order)}
          </span>
        </span>
        <span className="rounded-full bg-grass-100 px-2 py-0.5 text-[10px] font-extrabold text-grass-700">
          {digital ? '已放进游戏柜' : '待确认'}
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
          {digital
            ? '🎮 游戏已经在孩子的游戏柜里了，这里只是把这一单收尾。'
            : '📦 App 不代收货款。买好之后回到这里点「已经买好了」。'}
        </p>
      </div>

      <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <p className="text-sm font-extrabold">孩子付了什么</p>
        <div className="mt-1 flex items-center justify-between py-1.5 text-sm">
          <span className="text-xs font-bold text-ink-500">已扣除</span>
          <span className="font-display font-extrabold text-berry-500">
            − {paidText(order)}
          </span>
        </div>
        <p className="mt-1 rounded-xl bg-sky-50 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-sky-500">
          ↩️ 如果最后没买成，点「取消兑换」，{paidText(order)} 会原样退回去。
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
          {digital ? '完成这一单' : '已经买好了'}
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
   ⑥ 兑换记录
   ------------------------------------------------------------
   为什么必须有这一屏：`done` 和 `cancelled` 的单子在别处**看不见** ——
   卡片只显示「还没走完」的那几个（`activeOrderOf`），待办入口也只算
   `committed` / `confirmed`。于是孩子换到手的东西、家长取消掉的单子，
   过一天就彻底消失，连「我到底换过没有」都查不到。

   数据就是 `wishOrders`（不新开表、不加 Dexie 版本号）：快照字段
   （`itemName` / `itemEmoji` / `voucherPrice`）本来就是为历史准备的 ——
   商品改名或下架之后，这一屏还能正确解释当时发生了什么。
   ============================================================ */

const STATUS_TONE: Record<string, 'green' | 'gray' | 'amber' | 'blue'> = {
  wished: 'blue',
  committed: 'amber',
  confirmed: 'blue',
  done: 'green',
  cancelled: 'gray',
}

/**
 * 记录里那一行的状态说法。
 *
 * ⚠️ 数字商品交付完还在 `committed`（等家长收尾），但界面上**不能**说
 * 「等爸妈确认」—— 孩子已经拿到游戏了。这条规则在详情页 / 卡片上已经写过，
 * 记录页也要一致，否则同一单在两屏里说两种话。
 */
function orderStatusLabel(o: { status: string; openedGameId?: string }): string {
  if (o.openedGameId && (o.status === 'committed' || o.status === 'confirmed')) {
    return '已放进游戏柜'
  }
  return WISH_STATUS_TEXT[o.status] ?? o.status
}

function orderStatusTone(o: { status: string; openedGameId?: string }): 'green' | 'gray' | 'amber' | 'blue' {
  if (o.openedGameId && (o.status === 'committed' || o.status === 'confirmed')) return 'green'
  return STATUS_TONE[o.status] ?? 'gray'
}

function OrdersView({
  orders,
  onBack,
  onOpen,
}: {
  orders: ReturnType<typeof useApp.getState>['wishOrders']
  onBack: () => void
  onOpen: (itemId: string) => void
}) {
  const sorted = useMemo(
    () => [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50),
    [orders],
  )

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
        <span className="font-display text-base font-extrabold">兑换记录</span>
        <span className="flex-1" />
        <span className="text-[11px] font-bold text-ink-500">最近 {sorted.length} 条</span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex min-h-[45vh] flex-col items-center justify-center gap-2">
          <span className="text-4xl">🧾</span>
          <p className="text-sm font-extrabold text-ink-600">还没有换过东西</p>
          <p className="text-xs font-bold text-ink-500">看到喜欢的，先告诉爸爸妈妈</p>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {sorted.map((o) => {
            const item = wishItemById(o.itemId)
            return (
              <button
                key={o.id}
                data-wish-order={o.id}
                onClick={() => onOpen(o.itemId)}
                className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-flat active:btn-press"
              >
                <span
                  className={
                    'flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-xl ' +
                    TINT_BG[item?.tint ?? 'sun']
                  }
                >
                  {o.itemEmoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-ink-900">
                    {o.itemName}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-ink-500">
                    {humanizeAgo(o.createdAt)}
                    {o.vouchersHeld > 0 || (o.pointsHeld ?? 0) > 0
                      ? ` · ${paidText(o)}`
                      : ' · 只是想要'}
                    {/* 未结束的数字单子，状态标签已经写了「已放进游戏柜」，
                        这里只在**结束之后**补一句（那时标签写的是「已经拿到」） */}
                    {o.openedGameId && o.status === 'done' ? ' · 已放进游戏柜' : ''}
                  </span>
                  {/* 取消原因要看得见。家长回绝一个心愿之后，孩子能查到
                      「爸妈这次先不换」—— 否则单子只是从「等回应」变成灰色，
                      孩子不知道是没看见、还是不同意。 */}
                  {o.status === 'cancelled' && o.cancelReason && (
                    <span className="mt-0.5 block truncate text-[11px] font-bold text-ink-400">
                      {o.cancelReason}
                    </span>
                  )}
                </span>
                <Tag tone={orderStatusTone(o)}>{orderStatusLabel(o)}</Tag>
              </button>
            )
          })}
        </div>
      )}
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
