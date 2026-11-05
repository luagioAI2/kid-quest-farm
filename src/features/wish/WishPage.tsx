import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/store/useApp'
import type { WishItem, WishTint } from '@/domain/types'
import {
  WISH_KIND_META,
  blindBoxRemaining,
  blindBoxSoldOut,
  compareWishItem,
  daysToSave,
  planWishRedeem,
  type WishFilter,
} from '@/domain/wish'
import { ownedSetFor } from '@/domain/ownership'
import { isOnlineMode } from '@/sync/pull'
import { describeRedeemPayment } from '@/domain/redeem'
import { shipFormIssue } from '@/domain/wishShip'
import { formatPriceCents } from '@/domain/cash'
import { WISH_BLINDBOX_ID, WISH_ITEMS, wishItemById } from '@/games/wishCatalog'
import { STOREFRONT, type StorefrontEntry } from '@/games/storefront'
import { LOCAL_GAMES } from '@/games/localGames'
import { formatSize } from '@/games/size'
import { GameIconArt } from '../settings/GameIcon'
import { WishArt } from './WishArt'
import { Portal } from '@/components/Portal'
import { ParentPinPanel } from '../parent/ParentGate'
import { MerchantView } from './MerchantView'
import { CodeRedeemBlock } from './CodeRedeemBlock'
import { ActivationDialog } from './ActivationDialog'
import { openExternal } from '@/platform/openUrl'

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
 *
 * 文案**不再自己拼**。原来这里输出「🎫 20 张」，而「兑换记录」输出
 * 「20 兑换券」—— 同一笔钱两种说法，家长对账时得先在脑子里做一次翻译。
 * 更刺眼的是本文件第 903 行：定价预览早就用 `describeRedeemPayment`
 * 写着「付款：20 兑换券」，也就是说**同一屏里**就有两种说法。
 * 现在只做参数适配，句子交给那个函数出。
 *
 * ⚠️ 两边默认值相反，别在这里「顺手简化」成 `pointsPaid: o.pointsHeld`：
 * `paidOf` 里 `pointsPaid` 缺省是 `cost - harvestPaid`。**没改过价的单子
 * 上这两者恰好相等**（`vouchersHeld + pointsHeld === voucherPrice`），
 * 所以变异测试抓不到 —— 但家长**改过价**之后就不等了：一条当年 20 券
 * 付掉的老单子，家长把价改成 30，`30 - 20` 会让它凭空多出「+ 10 积分」。
 * 显式 `?? 0` 才能保证「这一单当时付了什么」永远只由那两个字段说了算。
 *
 * ⚠️ `wished` 单（0 券 0 积分）会返回「0 积分」。调用方要自己先判
 * 「到底付没付」，别把「只是想要」写成「已付 0 积分」。
 */
function paidText(o: {
  vouchersHeld: number
  pointsHeld?: number
  voucherPrice: number
}): string {
  return describeRedeemPayment({
    cost: o.voucherPrice,
    harvestPaid: o.vouchersHeld,
    pointsPaid: o.pointsHeld ?? 0,
  })
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
function WishGameIcon({ entry }: { entry: StorefrontEntry }) {
  return (
    <span
      aria-hidden
      className="h-20 w-20 shrink-0 overflow-hidden rounded-[22px] border-3 border-ink-900/10 shadow-flat"
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

/**
 * 视图。2026-10-29 用户要求「不需要在心愿商城显示兑换记录和有一单在等爸妈处理」
 * ⇒ 原来那个 `{ kind: 'orders' }`（「我许的愿」）**整屏删掉了**。
 *
 * 不是把它藏起来：兑换页的「📜 兑换记录」已经是**两张表合一条时间线**
 * （`redeemHistory`），心愿单里 `done` / `cancelled` 的单子在那边看得见。
 * 留着入口只会让人在两个「记录」之间猜哪个才是全部的。
 *
 * ⚠️ 代价（知情接受）：**没付过钱的 `wished` 单在记录里没有**（那是故意的，
 *    一分钱没扣就不算一笔账）。它现在的出口是商品详情页那句
 *    「已经告诉爸妈，等他们回应」，以及家长那边顶栏 👀 的待办队列。
 */
type WishView =
  | { kind: 'list' }
  | { kind: 'detail'; itemId: string }
  | { kind: 'offer'; itemId: string }
  | { kind: 'confirm'; orderId: string }
  /**
   * 招商合作（2026-10-29）。**从右上角进来**，和「看 / 许愿」是两件事，
   * 所以它是一屏、不是一个弹层 —— 弹层关掉之后就找不回来了。
   */
  | { kind: 'merchant' }

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
  /** 第四轮：卡片上的「我想要」直接许愿，不用先绕进详情页 */
  const wishExpress = useApp((s) => s.wishExpress)

  const [view, setView] = useState<WishView>({ kind: 'list' })
  const [filter, setFilter] = useState<WishFilter>(null)
  /**
   * 列表卡片「家长激活」点开的弹框，记的是**从哪件商品点进来的**。
   *
   * ★ 必须挂在页面这一层：激活成功 ⇒ `ownedGameIds` 多一款 ⇒ `hiddenOwned`
   * 把那张游戏卡从列表里摘掉。弹框要是长在卡片里，就会跟卡片一起卸载，
   * 「激活成功 / 去设置看看」在同一帧消失（和详情页 `alreadyOwned` 那个
   * bug 是同一类，2026-11-05 用真码走查抓到过）。
   */
  const [activateId, setActivateId] = useState<string | null>(null)

  /**
   * 这一页**不扣币**（2026-10-29 家长口径）。
   *
   * 原话：「兑换 里的东西都是一样，都能用兑换券或者积分，包括游戏也一样。
   * 不需要去心愿商城换。**心愿商城只是标明心愿的**。让爸妈知道你要换啥，
   * 等爸妈确认后添加到兑换里。」
   *
   * 所以这里只有两个动作：**许愿**（`wishExpress`）和**看**。家长定完价
   * 之后，商品出现在「兑换」那一格，孩子在那儿换；这一页的详情只留一个
   * 「去兑换换」的入口（`jumpToRedeem`）。
   *
   * ⚠️ 别把 `wishRedeem` 再搬回来。两个页面都能扣币，家长就分不清
   *    「哪一步是花钱的」，而这正是这次要收掉的东西。
   */

  /**
   * 「已经有了」= 账本买过 + 现在装着 + **心愿单里兑换到手过**。
   *
   * 第三个来源和 `wishRedeem` 里的闸门必须**同一套**：只改一处的话，
   * 卡片上会写着「可兑换」、点下去却被拒，或者反过来 —— 界面说「已经有了」
   * 但券照扣。规则本体在 `wishOwnedSet`，兑换页那一块也用它。
   */
  const owned = useMemo(
    /* ★ 在线版只认服务端名单（`ownedSetFor` 里判）—— 见 `domain/ownership.ts` */
    () => ownedSetFor(isOnlineMode, ownedGameIds, installedGames, wishOrders),
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
   * 而不是面对一个干干净净的「🤍 我想要」—— 那样他会以为自己没说过，
   * 家长那边则会收到同一个请求第二遍。
   *
   * ⚠️ 只是**提示**，不是冷却：仍然允许再点一次。心愿不是一次性资源，
   *    用时间锁挡住孩子只会让家长在不知情的情况下继续收请求。
   */
  const lastCancelledOf = (itemId: string) =>
    wishOrders
      .filter((o) => o.itemId === itemId && o.status === 'cancelled' && o.cancelReason)
      .sort((a, b) => (b.cancelledAt ?? b.createdAt) - (a.cancelledAt ?? a.createdAt))[0]

  /*
   * ⚠️ 2026-10-29 撤掉的东西，别加回来：
   *
   *   · **「我许的愿」那一屏**（原 `OrdersView`）—— 兑换页的「📜 兑换记录」
   *     已经合并了两张表，这里再摆一个「记录」只会让人猜哪个是全的。
   *   · **「有 N 单在等爸妈处理」那张卡** —— 用户原话「不需要在心愿商城显示」。
   *     家长的入口现在是顶栏 👀（`wished` 那批）和商品详情页底部
   *     （`committed` 那批，过了密码才能点「确认兑换 · 去购买」）。
   *
   * 两张都撤掉之后，这一页只剩两件事：**看**和**许愿**。这正是这一页的定义。
   *
   * 那个角**没有空着**：现在放的是「🤝 招商」（2026-10-29 第二轮）。
   * 换成它，是因为招商和记录同属「家长的事」，而记录已经有了唯一出口
   * （兑换页），招商还没有出口。
   */

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
  } else if (view.kind === 'merchant') {
    content = <MerchantView onBack={goList} />
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
        vouchers={harvestBalance}
        points={pointsBalance}
        owned={owned}
        onOpen={(itemId) => setView({ kind: 'detail', itemId })}
        onActivate={(itemId) => setActivateId(itemId)}
        onWant={(itemId) => void wishExpress(itemId)}
        onMerchant={() => setView({ kind: 'merchant' })}
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
      {activateId && (
        <ActivationDialog
          itemName={wishItemById(activateId)?.name ?? '这款游戏'}
          onClose={() => setActivateId(null)}
        />
      )}
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
  vouchers,
  points,
  owned,
  onOpen,
  onActivate,
  onWant,
  onMerchant,
}: {
  filter: WishFilter
  setFilter: (f: WishFilter) => void
  offerOf: (id: string) => ReturnType<typeof useApp.getState>['wishOffers'][number] | undefined
  activeOrderOf: (id: string) => ReturnType<typeof useApp.getState>['wishOrders'][number] | undefined
  /** 兑换券余额 */
  vouchers: number
  /** 积分余额（可以补券不够的部分） */
  points: number
  owned: Set<string>
  onOpen: (id: string) => void
  /** 卡片上「家长激活」：交给页面层开弹框，不进详情页 */
  onActivate: (id: string) => void
  /** 卡片上「我想要」：直接许愿；已经有单子时按钮自动改成进详情页 */
  onWant: (id: string) => void
  /** 右上角「招商」 */
  onMerchant: () => void
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
          {/* 招商入口（2026-10-29）。用户原话：「在 心愿右上角 把兑换记录
              去掉 换成招商按钮。点开 看到招商合作。不是在兑换/兑换记录里显示。」

              这个角上原来放的是「我许的愿」（那一屏已随「心愿商城不显示记录」
              一起撤掉），正好让给招商 —— 一进一出，头部宽度不变。

              ⚠️ 这里**不挂「审核中 / 已开通」的文字徽标**：320 宽上
              标题会被挤成两行。接后端之后如果要提示，加一颗 8px 圆点，
              别加字（见 `MerchantView` 里每一路各自的标签）。 */}
          <button
            type="button"
            data-merchant-entry
            onClick={onMerchant}
            className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-white px-3 text-[13px] font-extrabold text-ink-700 shadow-flat active:btn-press"
          >
            <span aria-hidden>🤝</span>
            招商
          </button>
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
            vouchers={vouchers}
            points={points}
            onOpen={() => onOpen(blindbox.id)}
            onActivate={() => onActivate(blindbox.id)}
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
              onActivate={() => onActivate(item.id)}
              onWant={() => onWant(item.id)}
            />
          ))}
        </div>

        {items.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-500">这一类里还没有东西</p>
        )}

        {/* 藏了要说一句。不说的话，孩子只会觉得「昨天还有的东西今天没了」，
            而他要找的那款其实在「设置 → 游戏」的「我的游戏」里躺着。 */}
        {hiddenOwnedCount > 0 && (
          <p className="px-1 text-[11px] leading-snug text-ink-400">
            有 {hiddenOwnedCount} 款游戏你已经换到了，不再列在这里 —— 去「设置 → 游戏」的
            「我的游戏」看你有哪些。
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

/**
 * 卡片封面角上那一颗**状态**。
 *
 * 2026-11-05 第三轮：用户说「名字 / 类型 / 标签」全挤在名字底下像一堆
 * 贴纸。现在状态只留一颗、挪到封面左上角；价格、类型各自独占一行，
 * 动作变成卡片底部一颗真按钮。层级是「图 → 名 → 类 → 价 → 动作」，
 * 不再是一排互相抢注意力的小圆标。
 *
 * ⚠️ 定价优先这件事没变：`offer` 存在时价格那一行一定会写券数，
 *    孩子不会看到「已告诉爸妈」就以为这一件永远换不了。
 */
function cardBadge(
  item: WishItem,
  order: { status: string } | undefined,
  alreadyOwned: boolean,
): string | null {
  if (alreadyOwned) return '已拥有'
  if (order?.status === 'committed') return '等爸妈确认'
  if (order?.status === 'wished') return '已告诉爸妈'
  /* 用户 2026-11-05：「一开始游戏只是挂在商城，显示未激活」。
     写「等爸妈开放」会让孩子以为得等家长点一下才能用，其实手里有码、
     过了家长密码就能自己激活。 */
  if (item.kind === 'gamebox' && item.gameId) return '未激活'
  return null
}

function BlindBoxHero({
  item,
  offer,
  order,
  owned,
  vouchers,
  points,
  onOpen,
  onActivate,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { status: string } | undefined
  owned: Set<string>
  /** 兑换券余额。和 `points` 一起只用来判「券不够、但加上积分够」 */
  vouchers: number
  points: number
  onOpen: () => void
  onActivate: () => void
}) {
  const remaining = blindBoxRemaining(item.pool ?? [], [...owned])
  /* ★ 不是「池子空了」，是「不够这一盒开的款数」—— 5 连开只剩 2 款时
     也必须是售罄，否则点进去必然被拒。 */
  const soldOut = blindBoxSoldOut(item, [...owned])
  const topUp = offer ? topUpOf(offer.voucherPrice, vouchers, points) : 0

  /** 没定价也没许愿时不写状态：家长审核时直接定价，孩子不用「等定价」。 */
  let statusLine: string | null = null
  if (soldOut) statusLine = '全都玩过了'
  else if (offer) {
    statusLine = `🎫 ${offer.voucherPrice}${topUp > 0 ? ` · 🪙 补 ${topUp}` : ''}`
  } else if (order?.status === 'wished') statusLine = '已告诉爸妈'

  return (
    <div data-wish-card="blindbox" className="relative rounded-3xl bg-sun-100 shadow-flat">
      <span className="absolute -top-1.5 right-3 z-10 rounded-full bg-berry-500 px-2 py-0.5 text-[10px] font-extrabold text-white">
        优先
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 p-3.5 text-left active:opacity-90"
      >
        <span className="flex h-16 aspect-[4/3] flex-none items-center justify-center overflow-hidden rounded-2xl bg-white shadow-flat">
          <WishArt
            itemId={item.id}
            emoji={item.emoji}
            className="h-full w-full object-contain"
            emojiClassName="text-3xl"
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-base font-extrabold text-ink-900">
            {item.name}
          </span>
          <span className="mt-0.5 block text-xs font-bold text-ink-500">{item.note}</span>
          {/* ★ 第四轮（2026-11-05）：不再写「等定价」那类话 —— 家长审核时
              直接定价，孩子这一侧没有这一步；没定价也没许愿就整行不渲染。
              其余状态仍是独立文本节点（findByText 按整句定位）。 */}
          <span className="mt-1.5 block space-y-0.5 text-[11px] font-bold leading-snug">
            {statusLine && <span className="block text-ink-700">{statusLine}</span>}
            <span className="block text-ink-500">还能开出 {remaining.length} 款</span>
            {order?.status === 'committed' && (
              <span className="block text-grass-700">已放进游戏柜</span>
            )}
          </span>
        </span>
      </button>
      {/* ★ 「有码可输」那颗看不懂的标签换成真按钮（用户 2026-11-05 第三轮）。
          盲盒本身没有 `game_id`，但码自带游戏，所以这一路照样能激活。 */}
      <div className="px-3.5 pb-3">
        <button
          type="button"
          data-wish-activate
          onClick={onActivate}
          className="flex h-8 w-full items-center justify-center gap-1 rounded-xl bg-white/80 text-[12px] font-extrabold text-grass-700 active:btn-press"
        >
          🎟️ 家长激活
        </button>
      </div>
    </div>
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
  onActivate,
  onWant,
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { status: string } | undefined
  owned: Set<string>
  /** 兑换券余额。和 `points` 一起只用来判「券不够、但加上积分够」 */
  vouchers: number
  points: number
  onOpen: () => void
  onActivate: () => void
  /** 实物卡「我想要」：直接许愿；已经有单子时按钮自动改成进详情页 */
  onWant: () => void
}) {
  const alreadyOwned = item.kind === 'gamebox' && !!item.gameId && owned.has(item.gameId)
  const entry = gameEntryOf(item)

  /**
   * 券不够、但**加上积分就够** —— 卡片价格行后面补一小截。
   *
   * 不补的话，一个「券 0、积分 300」的孩子看到满屏 `🎫 80` 会以为
   * 全都换不起，根本不会点进详情页 —— 而详情页里明明写着「付款：
   * 🪙 80 积分」。这正是 2026-10-29 这次改动要解决的问题。
   */
  const topUp = offer ? topUpOf(offer.voucherPrice, vouchers, points) : 0
  const badge = cardBadge(item, order, alreadyOwned)
  /** 码自带游戏，和「爸妈有没有给这件商品定价」无关，所以恒显示。 */
  const canActivate = !alreadyOwned && (item.kind === 'gamebox' || item.kind === 'blindbox')
  /** 已经表过态 / 已经下单：按钮改成进详情页，别让 `wishExpress` 早退成「点了没反应」。 */
  let actionLabel = '🤍 我想要'
  if (order?.status === 'wished') actionLabel = '已告诉爸妈 ›'
  else if (order?.status === 'committed' || order?.status === 'confirmed') actionLabel = '去看看 ›'

  return (
    <div
      data-wish-card
      data-wish-kind={item.kind}
      className="flex h-full flex-col rounded-3xl bg-white p-1.5 shadow-flat"
    >
      {/* ★ 根节点从 `<button>` 换成 `<div>`：底下要再放一颗「家长激活」按钮，
          button 嵌 button 是非法 HTML，而且点击会被外层吃掉。
          现在「卡片主体」和「家长激活」是两颗平级按钮，各走各的。 */}
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col text-left active:opacity-90"
      >
        <span
          className={
            'relative mb-1.5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-2xl ' +
            TINT_BG[item.tint]
          }
        >
          {/* 顺序是「插画 → 游戏手绘图标 → emoji」：插画母版就是 4:3，
              正好铺满这块底；另外两个都只是兜底 */}
          <WishArt
            itemId={item.id}
            emoji={item.emoji}
            className="h-full w-full object-contain"
            emojiClassName="text-3xl"
            fallback={
              entry ? (
                <GameIconArt
                  id={entry.id}
                  tint={entry.tint}
                  wide
                  className="h-full w-full"
                />
              ) : undefined
            }
          />
          {badge && (
            <span className="absolute left-1.5 top-1.5 rounded-full bg-white/85 px-1.5 py-[3px] text-[10px] font-extrabold leading-none text-ink-600">
              {badge}
            </span>
          )}
        </span>
        {/* 名字固定占两行高度：一行名和两行名混排时，下面「类型 / 价格」
            不会一张卡高一张卡矮。第四轮把行距收紧，整张卡矮一截。 */}
        <span className="line-clamp-2 min-h-[2.4em] px-0.5 font-display text-[12.5px] font-extrabold leading-[1.2] text-ink-900">
          {item.name}
        </span>
        <span className="mt-0.5 truncate px-0.5 text-[10.5px] font-bold text-ink-400">
          {WISH_KIND_META[item.kind].label}
          {item.partnerName ? ` · ${item.partnerName}` : ''}
        </span>
        {/* ★ 第四轮：没定价就空着这一行，不再写「等定价」那类话。
            家长审核时直接定价，孩子这一侧没有这一步。
            固定高度 = 和已定价的卡等高（_probe-wish-card-qa.mjs 量 tailGap）。 */}
        <span className="mt-0.5 flex h-[1.15em] items-center px-0.5 text-[11.5px] font-extrabold leading-none text-ink-600">
          {offer ? (
            <>
              🎫 {offer.voucherPrice}
              {topUp > 0 && (
                <span className="ml-1 text-[10px] text-grass-700">· 🪙 补 {topUp}</span>
              )}
            </>
          ) : null}
        </span>
      </button>
      {/* ★ 2026-11-05 第四轮：每张卡仍然恰好一颗等高动作按钮。
          游戏 / 盲盒是「家长激活」→ 页面层弹框；实物是「我想要」→ 直接许愿。
          已经有单子时后者变成「已告诉爸妈 / 去看看」并进详情页 ——
          `wishExpress` 遇到进行中的单子会早退，不给反馈就是「点了没反应」。 */}
      {canActivate ? (
        <button
          type="button"
          data-wish-activate
          onClick={onActivate}
          className="mt-1.5 flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-xl bg-grass-50 text-[12px] font-extrabold text-grass-700 active:btn-press"
        >
          🎟️ 家长激活
        </button>
      ) : (
        <button
          type="button"
          data-wish-detail
          onClick={order ? onOpen : onWant}
          className="mt-1.5 flex h-8 w-full shrink-0 items-center justify-center gap-1 rounded-xl bg-sun-50 text-[12px] font-extrabold text-sun-700 active:btn-press"
        >
          {actionLabel}
        </button>
      )}
    </div>
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
}: {
  item: WishItem
  offer: { voucherPrice: number } | undefined
  order: { id: string; status: string; openedGameId?: string } | undefined
  /** 最近一次被取消、且写了理由的单子。只用来在「我想要」下面补一句「上次爸妈说：…」 */
  lastCancelled: { cancelReason?: string } | undefined
  /** 兑换券余额 */
  vouchers: number
  /** 积分余额（补券不够的部分，1 比 1） */
  points: number
  owned: Set<string>
  onBack: () => void
  onOffer: () => void
  onConfirm: (orderId: string) => void
}) {
  const wishExpress = useApp((s) => s.wishExpress)
  const jumpToRedeem = useApp((s) => s.jumpToRedeem)
  const wishCancel = useApp((s) => s.wishCancel)
  const pushToast = useApp((s) => s.pushToast)

  const [busy, setBusy] = useState(false)
  const [pinOk, setPinOk] = useState(false)
  /** 数字商品：家长要主动点一下「完成这一单」，闸门才展开（见下面的注释） */
  const [pinOpen, setPinOpen] = useState(false)
  const settings = useApp((s) => s.settings)
  /* 保护开着就要过闸门 —— 没设过密码也过（面板会变成「先设一个」） */
  const needsPin = settings.protectParentActions !== false

  const plan = offer ? planWishRedeem(offer.voucherPrice, vouchers, points) : null
  const alreadyOwned = item.kind === 'gamebox' && !!item.gameId && owned.has(item.gameId)
  /* ★ 售罄判据用 `blindBoxSoldOut`（剩余 < 这一盒要开的款数），
     不是「池子空了」—— 5 连开只剩 2 款时点进去必然被拒。 */
  const soldOut = item.kind === 'blindbox' && blindBoxSoldOut(item, [...owned])

  /** 单个游戏的商店条目 + 本地包信息（版本 / 体积） */
  const gameEntry = gameEntryOf(item)
  const localGame = gameEntry ? LOCAL_GAMES.find((g) => g.id === gameEntry.id) : undefined
  /** 截图放大：必须 Portal 到 body，否则被页面外壳的层叠上下文关在小盒子里 */
  const [zoom, setZoom] = useState<{ src: string; caption: string } | null>(null)

  const meta = WISH_KIND_META[item.kind]

  /**
   * 「去兑换换」—— 这一页**不扣币**。
   *
   * 家长口径（2026-10-29）：「兑换 里的东西都是一样…不需要去心愿商城换。
   * 心愿商城只是标明心愿的。」所以这里只把人**送到兑换那一行**
   * （`jumpToRedeem` → `App` 切 tab → `RedeemBody` 取走并滚到那一行）。
   *
   * 真正的扣款在 `RedeemBody` 里，走 `wishRedeem` —— 和 `RedeemItem` 用的是
   * 同一套 `planRedeemPayment` 分账，所以这一页上面那句「付款：🎫 x + 🪙 y」
   * 和点下去真扣的仍然是同一组数。
   */

  /**
   * 家长回绝一个心愿（`wished` → `cancelled`）。
   *
   * ⚠️ 走 `wishCancel` 而不是自己 `update`：它在**事务里重读状态**，
   * 而且对 `wished` 这条路径**不碰账本**（还没扣过券）。
   * 自己写一行 `status: 'cancelled'` 会绕过那道重读。
   *
   * 没有这个动作的话，孩子的心愿会永远停在「已告诉爸妈」——
   * 他既不能自己撤回，家长也没有「不换」这个选项。
   */
  const doDecline = async () => {
    if (busy || !order) return
    setBusy(true)
    await wishCancel(order.id, '爸妈这次先不换')
    setBusy(false)
    pushToast({
      kind: 'info',
      title: '已回绝',
      // 理由的落点是**这一件商品的详情页**（下面那句「上次爸妈说：…」）。
      // 原来写的是「孩子能在『我许的愿』里看到」—— 那一屏 2026-10-29 下线了。
      detail: '孩子再点进这件商品就能看到理由',
      emoji: '💬',
    })
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
          <WishGameIcon entry={gameEntry} />
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
              'mt-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl text-7xl shadow-flat ' +
              TINT_BG[item.tint]
            }
          >
            {/* 这一块原来是一颗 72px 的 emoji 浮在 460×345 的空白上 ——
                「图太大」其实是「图太小、底太大」。插画同比例，铺满就正常了 */}
            <WishArt
              itemId={item.id}
              emoji={item.emoji}
              className="h-full w-full object-contain"
              emojiClassName="text-7xl"
            />
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
                data-wish-finish
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
              data-wish-finish
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
           * 随后定了价 → 页面仍然显示「已告诉爸妈」，**兑换按钮不出现**。
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
             * 「这次先不换」，两屏都看得见）。
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
                🤍 我想要
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
            onClick={() => jumpToRedeem(item.id)}
            disabled={!plan?.affordable}
            data-wish-to-redeem
            className={
              'btn h-12 w-full text-base font-extrabold active:btn-press ' +
              (plan?.affordable ? 'bg-grass-500 text-white' : 'bg-ink-100 text-ink-500')
            }
          >
            {plan?.affordable
              ? // 这里**不写「用 N 换」**：点下去不是在这里换，而是去「兑换」。
                // 写着「换」会让孩子以为当场就扣币（2026-10-29 改口径之前确实是）。
                '🎁 去「兑换」换'
              : `还差 ${plan?.shortfall ?? 0}`}
          </button>
        )}
      </div>

      {/*
       * 游戏卡：输码入口**就在这件商品自己这一页**（2026-11-05）。
       *
       * 用户原话：「应该在心愿商城 对应 item 就可以激活吧。不然拿到了
       * 激活码或者兑换码，咋办。」在那之前全 App 只有两个输码口，
       * 而且都在家长区（`设置 → 游戏`、定价页）—— 孩子手里捏着卡、
       * 站在卖这张卡的商品上，却没有任何地方能输。
       *
       * ⚠️ 这里**不能**写成 `{... && !alreadyOwned && ...}`：激活成功会
       * 立刻把 `alreadyOwned` 翻成 true，整块（连同「✅ 已激活」）会在
       * 同一帧被卸载 —— 2026-11-05 真码走查抓到的就是它：游戏到账了，
       * 页面上什么都不说。`owned` 交给组件内部判（`return null` 不卸载实例）。
       */}
      {item.kind === 'gamebox' && item.gameId && (
        <CodeRedeemBlock gate="pin" card owned={alreadyOwned} />
      )}

      {/*
       * 盲盒：开盒走兑换券，但**手里有码也能输**（用户 2026-11-05 明确要求）。
       *
       * 盲盒自己**没有 `game_id`**（它开的是一池子里的随机一款），可码是
       * 自带游戏的 —— 输进去解锁的就是码里那一款，和开盒开出来的是两件事。
       * 所以这一页两块并存：上面攒券开盒，下面有码直接输。
       *
       * ⚠️ 上一版这里写的是「盲盒没有激活码」。那句话在当时是对的（后台
       *    生成码只挂「游戏」分类），但用户要的是「手里有码就能用」，
       *    而这不需要盲盒自己有 game_id —— 别再把它删回去。
       */}
      {item.kind === 'blindbox' && (
        <>
          {/* ⚠️ 输码块在**说明上面**。反过来的话（说明 → 输码块）这一块
              会落到 844 屏的第 706 行，下半截正好被底栏压住 ——
              走查截图里一眼就能看到，等于「有入口但看不见」。
              2026-11-05 第二轮量的。 */}
          <CodeRedeemBlock gate="pin" card compact />
          <p className="mt-3 rounded-2xl bg-paper-2 px-3.5 py-2.5 text-[11px] font-bold leading-relaxed text-ink-500">
            🎁 盲盒开的是随机一款你还没有的游戏，靠兑换券在「兑换」里开。
            上面输的码给的是码里那一款，不参与随机。
          </p>
        </>
      )}

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

  /* ---- 游戏类：直接买卡 → 输激活码（2026-10-30） ----
   *
   * 家长站在这一页时的真实处境是：孩子在心愿商城看上了某款游戏，
   * 而这款游戏的卡在淘宝上卖。原来这一页只有「定券价」—— 想花钱买的家长
   * 无处可去（购买链接在游戏类商品上也是空的），拿到卡也没有输码的地方，
   * 得自己摸到「设置 → 游戏 → 有兑换码」。
   *
   * 所以把「买」和「激活」都摆到家长眼前：买卡、输码、游戏直接进「我的游戏」。
   *
   * ⚠️ 2026-11-05：输码那一块搬去 `CodeRedeemBlock` 了 —— 商品详情页
   * 也要同一个口子（孩子那一侧），两份拷贝迟早走成两套口径。
   * 这一页传 `gate="open"`：**整页已经在家长闸门后面**了，不必再输一次密码。
   */

  /**
   * 孩子到底有没有表达过意向。
   *
   * ⚠️ 这里原来写死「孩子想要这个」。可家长**可以主动**先来定价
   * （这正是最常见的用法：爸妈先开放，孩子才看得到价格），
   * 那时孩子根本没点过「我想要」—— 页面却在替孩子撒谎。
   * 2026-10-28 截图走查发现（capture 的流程从没点过「我想要」，
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
  /* 保护开着就要过闸门 —— 没设过密码也过（面板会变成「先设一个」） */
  const needsPin = settings.protectParentActions !== false

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
            'flex h-13 aspect-[4/3] flex-none items-center justify-center overflow-hidden rounded-2xl text-2xl ' +
            TINT_BG[item.tint]
          }
        >
          <WishArt
            itemId={item.id}
            emoji={item.emoji}
            className="h-full w-full object-contain"
            emojiClassName="text-2xl"
          />
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

      {/* 游戏类才有：买卡 → 输码。**和家长定价并列摆着** —— 两条路是
          「孩子自己攒券换」和「爸妈直接买」，家长得当场看见这两条，
          而不是定完价再自己去找「设置 → 游戏 → 有兑换码」。 */}
      {item.kind === 'gamebox' && item.gameId && (
        <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
          <p className="text-sm font-extrabold">也可以直接买这一款</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-ink-500">
            淘宝 / 天猫上买了游戏，卖家会发一串 6 位激活码。买到后在这儿输一次，
            游戏就进「我的游戏」，孩子那边不用再攒券。
          </p>

          {item.buyUrl ? (
            <button
              data-wish-buy-game
              onClick={async () => {
                /* ⚠️ 别写 `window.open` —— APK 的 WebView 里它什么都不做，
                   点了没反应也没有报错。`openExternal` 装了淘宝就直接进淘宝。 */
                const ok = await openExternal(item.buyUrl!)
                if (!ok) {
                  pushToast({
                    kind: 'info',
                    title: '这个链接打不开',
                    detail: `复制「${item.name} 激活码」到淘宝里搜一下`,
                    emoji: '🔗',
                  })
                }
              }}
              className="btn mt-3 h-11 w-full bg-sun-400 text-sm font-extrabold text-ink-900 active:btn-press"
            >
              ↗ {item.buyLabel ?? '去商店购买'}
            </button>
          ) : (
            /* 链接是运营一条条填的（`wish_item.buy_url`），没填的不该装成
               「点了没反应」。直接说清楚，并给出**能自己动手**的那条路。 */
            <p
              data-wish-buy-none
              className="mt-2 rounded-xl bg-paper-2 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-ink-500"
            >
              这一款还没配购买链接 —— 直接在淘宝搜「{item.name} 激活码」就行。
            </p>
          )}

          {/* 输码口和商品详情页共用一块（`CodeRedeemBlock`）。
              这一页整页已经在家长闸门后面 ⇒ `gate="open"`，
              不再让人连输两次密码。 */}
          <CodeRedeemBlock
            gate="open"
            label="有激活码？输一下"
            onDone={onDone}
          />
        </div>
      )}

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

  /*
   * 收货地址（实物商品才有）。
   *
   * 初值取已有的那份：兑换那一刻可能填过，也可能是家长上次补的。
   * 这是地址的**唯一入口** —— 孩子那头没有表单，服务端 `/wish/redeem`
   * 收到的 `ship` 永远是空的。
   */
  const [ship, setShip] = useState({
    receiver: order?.ship?.receiver ?? '',
    phone: order?.ship?.phone ?? '',
    address: order?.ship?.address ?? '',
  })
  const [shipBusy, setShipBusy] = useState(false)

  /*
   * 订单号（对账用，**选填**）。
   *
   * 服务端叫 `tracking_no`，本地叫 `buyOrderNo` —— 同一件事：外链成交之后
   * 家长手里那串号。没有它，「券少了 30」只能靠回忆；有了它，能翻回淘宝对单。
   * 选填是刻意的：不填也能收尾（大多数人不会回来补），但填了必须查得回来
   * （见「兑换记录」那一行），否则就是「填了看不见」。
   */
  const [orderNo, setOrderNo] = useState(order?.buyOrderNo ?? '')

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

  const buy = async () => {
    // 只在家长确认页出现外链 —— 孩子端读不到 `buyUrl`
    if (!item?.buyUrl) {
      pushToast({ kind: 'info', title: '这件商品没有外链', emoji: '🔗' })
      return
    }
    /* ⚠️ 别写成 `window.open` —— APK 的 WebView 里它**什么都不做**，
       家长点了没反应也没有报错。走 `openExternal`：装了淘宝就直接进淘宝。 */
    const ok = await openExternal(item.buyUrl)
    if (!ok) {
      pushToast({
        kind: 'info',
        title: '这个链接打不开',
        detail: '复制商品名到淘宝里搜一下试试',
        emoji: '🔗',
      })
    }
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
            'flex h-13 aspect-[4/3] flex-none items-center justify-center overflow-hidden rounded-2xl text-2xl ' +
            TINT_BG[order.kind === 'toy' || order.kind === 'study' || order.kind === 'collectible'
              ? (item?.tint ?? 'sun')
              : 'sun']
          }
        >
          {/* 订单里存的是快照（`itemEmoji`），商品可能已经被删掉 ——
              没有 `item` 时 itemId 传空串，自动退回那个 emoji */}
          <WishArt
            itemId={item?.id ?? ''}
            emoji={order.itemEmoji}
            className="h-full w-full object-contain"
            emojiClassName="text-2xl"
          />
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
            {/* ⚠️ 已交付的数字商品**不能**再说「去商店购买」。
                2026-10-30 给游戏类商品补上 `buyUrl` 之后，这一行差点变成
                「游戏已经在孩子柜子里了，方式：去商店购买」——
                家长会以为还得再去买一次。先判 `digital`，再判链接。 */}
            {digital ? '已经放进游戏柜' : item?.buyUrl ? '去商店购买' : 'App 内直接解锁'}
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
        {!digital && item?.buyUrl && (
          <button
            onClick={() => void buy()}
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

      {/* 收货地址：只有实物需要。数字商品已经进了游戏柜，问地址是多余的。 */}
      {!digital && (
        <div data-ship-form className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
          <p className="text-sm font-extrabold">寄到哪儿</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-ink-500">
            填了才会记在这一单上 —— 发货和售后都靠它。
            {order.ship ? '已经有一份了，要改直接改。' : ''}
          </p>
          <div className="mt-2.5 flex flex-col gap-2">
            <input
              data-ship-receiver
              value={ship.receiver}
              onChange={(e) => setShip((s) => ({ ...s, receiver: e.target.value }))}
              placeholder="收件人（谁收这个快递）"
              maxLength={20}
              className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-bold text-ink-800 outline-none focus:border-grass-400"
            />
            <input
              data-ship-phone
              value={ship.phone}
              onChange={(e) => setShip((s) => ({ ...s, phone: e.target.value }))}
              placeholder="电话"
              inputMode="tel"
              maxLength={20}
              className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-bold text-ink-800 outline-none focus:border-grass-400"
            />
            <input
              data-ship-address
              value={ship.address}
              onChange={(e) => setShip((s) => ({ ...s, address: e.target.value }))}
              placeholder="详细地址（省市区 + 小区门牌号）"
              maxLength={120}
              className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-bold text-ink-800 outline-none focus:border-grass-400"
            />
            {/*
              订单号：**选填**，所以不参与 `shipFormIssue` 的校验 ——
              不填也能点「已经买好了」。maxLength 和服务端的 `max=64` 对齐，
              否则超长会被服务端按 400 拒掉，界面只弹一句「操作没成功」。
            */}
            <input
              data-ship-order-no
              value={orderNo}
              onChange={(e) => setOrderNo(e.target.value)}
              placeholder="订单号（选填，查物流 / 对账用）"
              maxLength={64}
              className="rounded-xl border border-ink-200 px-3 py-2.5 text-sm font-bold text-ink-800 outline-none focus:border-grass-400"
            />
          </div>
          {/* 地址只在**这一单**上留 90 天，之后服务端自己抹掉。
              不说清楚的话，家长会以为这里存的是「我的收货地址」，
              下次换商品发现要重填就会觉得是 bug。 */}
          <p className="mt-2 text-[10px] font-bold leading-relaxed text-ink-400">
            只记在这一单上，90 天后自动删掉。家里常用的地址不用存在这里。
          </p>
        </div>
      )}

      <div className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        <p className="text-sm font-extrabold">孩子付了什么</p>
        <div className="mt-1 flex items-center justify-between py-1.5 text-sm">
          <span className="text-xs font-bold text-ink-500">已扣除</span>
          <span className="font-display font-extrabold text-berry-500">
            − {paidText(order)}
          </span>
        </div>
        <p className="mt-1 rounded-xl bg-sky-50 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-sky-500">
          ↩️ 如果最后没买成，点「取消兑换」，{paidText(order)}会原样退回去。
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
          data-ship-submit
          disabled={shipBusy}
          onClick={async () => {
            /*
             * 实物商品：先把地址校验完再走。
             *
             * ⚠️ 这一步**不能省**。服务端的 `shipFields` 在地址为空时是
             * 「一个字都不动」—— 静默不存、不报错。家长填了一半点完成，
             * 界面上照样「已经完成啦」，地址其实没落库，等发货时才发现。
             */
            if (!digital) {
              const issue = shipFormIssue(ship)
              if (issue) {
                pushToast({ kind: 'warn', title: issue, emoji: '📦' })
                return
              }
            }
            setShipBusy(true)
            try {
              await wishConfirm(order.id)
              /*
               * 数字商品没有「外链订单」这回事 ⇒ 不送 ship、也不送订单号。
               * `region` 取已有那份（服务端没存过就是空），界面不问省份 ——
               * 家长的地址里本来就写了。
               */
              const no = orderNo.trim()
              await wishDone(order.id, {
                ...(digital ? {} : { ship: { ...ship, region: order.ship?.region ?? '' } }),
                ...(no ? { buyOrderNo: no } : {}),
              })
              pushToast({ kind: 'reward', title: '已经完成啦', emoji: '🎉' })
              onDone()
            } finally {
              setShipBusy(false)
            }
          }}
          className="btn h-12 flex-1 bg-grass-500 text-base font-extrabold text-white active:btn-press disabled:opacity-60"
        >
          {digital ? '完成这一单' : '已经买好了'}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   小零件
   ============================================================ */

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
