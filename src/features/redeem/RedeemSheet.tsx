import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import type { RedeemCategory, RedeemItem, WishItem } from '@/domain/types'
import { humanizeAgo } from '@/domain/time'
import { clampPointsPerYuan, formatYuan } from '@/domain/cash'
import { describeRedeemPayment, planRedeemPayment, type RedeemPayment } from '@/domain/redeem'
import { WISH_KIND_META, wishShelf, type WishTone } from '@/domain/wish'
import { ownedSetFor } from '@/domain/ownership'
import { isOnlineMode } from '@/sync/pull'
import { redeemHistory } from '@/domain/redeemHistory'
import { WISH_ITEMS } from '@/games/wishCatalog'
import { Portal } from '@/components/Portal'
import { BoxView } from '../wish/BoxView'
import { ParentLockButton, ParentPinSheet } from '../parent/ParentGate'
import { BottomSheet, CoinPill } from '../farm/farmUi'

/* ============================================================
   兑换商城
   ------------------------------------------------------------
   家长需求：「兑换。积分可以兑换零食，礼物，玩平板，出朋友家等，
   家长（密码）可以新增和编辑。」

   结构：
   * 孩子视角：看到能换什么、还差多少分、一键兑换
   * 家长视角：新增 / 编辑 / 下架（要密码）
   * 兑换后生成一条"待兑现"记录，家长点一下表示"真的给了"

   定价策略见 seedTasks.ts 的注释 —— 目标是把孩子的日收入
   （约 170~270 分）映射到「日常小确幸每天可换」、
   「大件愿望要攒一两周」，从而保证兑换始终可控。
   ⚠️ 2026-09-21 任务积分减半之后，日收入从约 250~330 降到约
   170~270，而兑换定价没动 —— 攒大件的时间翻倍，见 seedTasks.ts。

   ## 付款规则（2026-09-30 用户要求）
   「优先用兑换券兑换。价值和积分等价的。用完兑换券再用积分，可混合。」
   标价只有一个数（比如 50），但这个 50 可以**一半兑换券一半积分**地付。
   规则本身在 `domain/redeem.ts` 的 `planRedeemPayment()` 里，
   和 store 扣款用的是**同一个函数** —— 界面预览和真实扣款不会算出两个结果。
   ============================================================ */


const CATEGORY_META: Record<RedeemCategory, { label: string; emoji: string }> = {
  snack: { label: '零食饮料', emoji: '🍪' },
  screen: { label: '屏幕时间', emoji: '📱' },
  outing: { label: '出去玩', emoji: '🎡' },
  gift: { label: '礼物', emoji: '🎁' },
  privilege: { label: '特权', emoji: '⭐' },
  custom: { label: '其他', emoji: '✨' },
}

const CATEGORY_ORDER: RedeemCategory[] = [
  'snack',
  'screen',
  'privilege',
  'outing',
  'gift',
  'custom',
]

/**
 * 心愿商品落到哪个分类。
 *
 * 一律进「🎁 礼物」，**不新开一个「心愿」分类** —— 家长反对的正是
 * 「兑换里多出一块叫心愿的」。分类只决定分组标题、不决定付款规则，
 * 所以并进已有分类是安全的。
 */
const WISH_CATEGORY: RedeemCategory = 'gift'

/**
 * 一屏列表里的两种行。
 *
 * `cost` 两边都有，所以能**按价格混排** —— 分成「家里的一堆、心愿的一堆」
 * 就又变回两块了，而家长要的是「兑换里的东西都是一样」。
 */
type ShopRow =
  | { kind: 'family'; cost: number; item: RedeemItem }
  | { kind: 'wish'; cost: number; price: number; item: WishItem }

/**
 * 记录行上那颗状态标签的配色。
 *
 * 色系名来自 `domain/wish.ts` 的 `WishTone`（那里同时管「这单该用什么词」）——
 * 别在这里另起一套名字，否则同一种状态在两个模块里各叫一个样。
 */
const HISTORY_TONE: Record<WishTone, string> = {
  green: 'bg-grass-200 text-grass-700',
  amber: 'bg-sun-300 text-ink-900',
  blue: 'bg-sky-50 text-sky-500',
  gray: 'bg-ink-100 text-ink-500',
}

export function RedeemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      emoji="🎁"
      title="兑换愿望"
      headerRight={<WalletPills />}
    >
      <RedeemBody />
    </BottomSheet>
  )
}

/**
 * 弹层头部的两个钱包。
 *
 * 以前只挂积分 —— 但兑换现在**两种币都能付**，只报积分会让孩子以为
 * 「我只有 12 分，换不了」，而他兜里其实还有 80 枚兑换券。
 *
 * ⚠️ 图标一律走 `CoinPill`（它的图标带 `aria-hidden`）。
 * e2e-check §8 靠「不带 aria-hidden 的 🪙 叶子节点 + 同级有个数字 == 余额」
 * 来抓「同一个数显示两次」；手写裸 🪙 会被误判成余额牌。
 */
function WalletPills() {
  const balance = useApp((s) => s.balance)
  const harvestBalance = useApp((s) => s.harvestBalance)
  return (
    <div className="flex items-center gap-1.5">
      <CoinPill amount={harvestBalance} icon="🎫" tone="grass" />
      <CoinPill amount={balance} />
    </div>
  )
}

/**
 * 兑换面板的正文。
 *
 * 抽出来是为了让「底部弹层」和「独立页面」共用同一份实现 ——
 * 否则两处各写一遍，改了一处忘了另一处，两边行为就会不一致。
 */
export function RedeemBody() {
  const redeemItems = useApp((s) => s.redeemItems)
  const redeemRecords = useApp((s) => s.redeemRecords)
  const balance = useApp((s) => s.balance)
  const harvestBalance = useApp((s) => s.harvestBalance)
  const settings = useApp((s) => s.settings)

  const [tab, setTab] = useState<'shop' | 'records' | 'manage'>('shop')
  const [pinOk, setPinOk] = useState(false)
  /** 密码弹框开着没有（闸门本身是「锁卡 + 弹框」，不再是内联键盘） */
  const [pinOpen, setPinOpen] = useState(false)

  /*
   * ⚠️ 2026-10-29 撤掉的东西，别加回来：**这一页里没有「招商」**。
   *
   * 第一版做在了这里（记录列表底部一张「招商合作」卡，点开是子页）。
   * 用户当场纠正：「在 心愿右上角 把兑换记录 去掉 换成招商按钮。
   * 点开 看到招商合作。**不是在兑换/兑换记录里显示**。」
   *
   * 理由站得住：兑换这一格是**孩子自己的账**（换到什么、还没兑现什么），
   * 招商是**家长的机会**。两者塞进同一屏，孩子翻记录时会撞见一堆
   * 「分成 / 上架 / 审核」—— 而那不是他要看的东西。
   */

  // ⚠️ 这里原来读了一次 `settings.pointsPerYuan` 算「现金 : 积分」汇率，
  // 用来在商城头部和每张卡片上标「≈ ¥12」。2026-09-30 用户要求去掉这两处，
  // 所以这一页**不再需要**汇率 —— 汇率现在只在「设置」和家长端编辑器里用。

  /**
   * 心愿商城里**爸妈已经定好价**的那些 —— 它们就是兑换品。
   *
   * 家长口径（2026-10-29，两轮，第二轮回过头纠正了第一轮的做法）：
   *   「爸爸妈妈已经定好价格的，相当于添加了兑换，应该出现在兑换列表里」
   *   「兑换 里的东西都是一样，都能用兑换券或者积分，包括游戏也一样。
   *    不需要去心愿商城换。心愿商城只是标明心愿的。」
   *
   * 所以这里**不再另起一块「心愿商城 · 爸妈开放了」**，也不再点一下跳去
   * 心愿页 —— 那等于在兑换里开了一道门、通往另一个收银台。定价就是上架：
   * 它们和家里的兑换品排在**同一个列表**里、用**同一套付款规则**、就地能换。
   *
   * 排除条件（已拥有 / 盲盒开完 / 已下架 / 已在走流程）在 `wishShelf` 里，
   * 和心愿页用的是**同一套**「已经拥有」规则（`wishOwnedSet`）—— 各写一遍的话，
   * 一边滤掉了另一边没滤，孩子会在这里看到自己早就换到的游戏。
   */
  const wishOrders = useApp((s) => s.wishOrders)
  const wishOffers = useApp((s) => s.wishOffers)
  const ownedGameIds = useApp((s) => s.ownedGameIds)
  const installedGames = useApp((s) => s.installedGames)

  /**
   * 「📜 兑换记录」= 家里换的 + 心愿/游戏换的，**一条时间线**。
   *
   * 家长 2026-10-29：「孩子刚兑换了一个游戏，为啥我兑换记录里看不到。」
   * 原因是两张表：家里那几件写 `redeemRecords`，游戏写 `wishOrders`，
   * 而这一屏原来只读前者 —— 券扣了、游戏装上了、记录里一个字都没有，
   * 界面上零异常。合并逻辑在 `domain/redeemHistory.ts`。
   */
  const history = useMemo(() => redeemHistory(redeemRecords, wishOrders), [redeemRecords, wishOrders])
  /**
   * tab 上那个数字：**记录里还没兑现的**（`childPending`）。
   *
   * 已经交付的数字商品不算 —— 那一行的标签是绿的「已放进游戏柜」，再挂红数字
   * 就自相矛盾。家长的收尾待办在心愿页顶部那张卡（`needsParentAction`），
   * 两个数故意不等，口径都写在 `domain/wish.ts`。
   */
  const pendingCount = useMemo(() => history.filter((r) => r.pending).length, [history])

  /**
   * 每件心愿商品**已经兑换过几次**（2026-11-06）。
   *
   * 只数「真的成交了」的单子：`wished` 一分钱没扣、`cancelled` 券退回去了，
   * 把它们算进次数，孩子会看到「已兑换 3 次」而手里只有一件东西。
   *
   * 口径和 `redeemedGameIdsFrom` 一致（committed / confirmed / done），
   * 别在这里另起一套。
   */
  const redeemedTimes = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of wishOrders) {
      if (o.status === 'committed' || o.status === 'confirmed' || o.status === 'done') {
        m.set(o.itemId, (m.get(o.itemId) ?? 0) + 1)
      }
    }
    return m
  }, [wishOrders])

  const wishRows = useMemo(
    () =>
      wishShelf(
        WISH_ITEMS,
        wishOffers,
        /* ★ 在线版只认服务端名单（`ownedSetFor` 里判） */
        ownedSetFor(isOnlineMode, ownedGameIds, installedGames, wishOrders),
        wishOrders,
      ),
    [wishOffers, ownedGameIds, installedGames, wishOrders],
  )

  /**
   * 分类 → 行。家里的兑换品和**爸妈已开放的心愿**在这里合成同一张表，
   * 按价格混排 —— 分组只决定标题，不决定付款规则。
   */
  const sections = useMemo(() => {
    const map = new Map<RedeemCategory, ShopRow[]>()
    const push = (c: RedeemCategory, row: ShopRow) => {
      const list = map.get(c) ?? []
      list.push(row)
      map.set(c, list)
    }
    for (const it of redeemItems) {
      /*
       * ⚠️ 这里**不再自己滤「一次性已换过」**。
       *
       * 那条规则在 `doRefresh` 里（`visibleRedeemItems`），因为它属于
       * `redeemItems` 的定义 —— 「孩子现在能换的东西」。
       * 摆在组件里的话，将来第二个读 `redeemItems` 的地方就得自己再记得滤一遍，
       * 漏了不报错，只是那件东西又冒出来了。
       */
      push(it.category, { kind: 'family', cost: it.cost, item: it })
    }
    for (const w of wishRows) {
      push(WISH_CATEGORY, { kind: 'wish', cost: w.price, price: w.price, item: w.item })
    }
    return CATEGORY_ORDER.filter((c) => (map.get(c)?.length ?? 0) > 0).map((c) => ({
      category: c,
      meta: CATEGORY_META[c],
      rows: (map.get(c) ?? []).sort((a, b) => a.cost - b.cost),
    }))
  }, [redeemItems, wishRows])

  /* ---- 盲盒的揭晓层 ---- */
  /* 「5 连开」一单开出多款 ⇒ 存**整个清单**。
     只存第一个的话，开箱层只揭晓 1 款，另外 4 款静默进游戏柜。 */
  const [boxGames, setBoxGames] = useState<string[] | null>(null)

  /* ---- 从心愿页「去兑换换」跳过来：滚到那一行并闪一下 ---- */
  const takePendingRedeemItem = useApp((s) => s.takePendingRedeemItem)
  const [flashId, setFlashId] = useState<string | null>(null)
  useEffect(() => {
    const id = takePendingRedeemItem()
    if (!id) return
    // 心愿商品在「礼物」里，默认那一页就是 shop，这里显式切一次防止上次停在记录页
    setTab('shop')
    setFlashId(id)
  }, [takePendingRedeemItem])

  useEffect(() => {
    if (!flashId) return
    const el = document.querySelector(`[data-shop-row="${flashId}"]`)
    el?.scrollIntoView({ block: 'center' })
    // 闪一下就好，别常亮 —— 常亮会让「哪一行是新加的」变成永久的噪音
    const t = window.setTimeout(() => setFlashId(null), 2600)
    return () => window.clearTimeout(t)
  }, [flashId])

  /* 保护开着就要过闸门 —— 没设过密码也过（面板会变成「先设一个」） */
  const needsPin = settings.protectParentActions !== false

  return (
    <>
      {/* `data-redeem-tabs` 给探针一个稳定锚点：tab 文案/徽标都会变，
          按 class 或按文字找都会在改版时静默失效（见 notes/verify-probes.md）。 */}
      <div
        data-redeem-tabs
        className="mb-3 flex gap-2 rounded-full border border-ink-900/10 bg-white p-1"
      >
        <TabBtn active={tab === 'shop'} onClick={() => setTab('shop')}>
          🎁 能换什么
        </TabBtn>
        <TabBtn active={tab === 'records'} onClick={() => setTab('records')}>
          📜 兑换记录
          {pendingCount > 0 ? (
            <span className="tnum ml-1 rounded-full bg-berry-400 px-1.5 text-xs text-white">
              {pendingCount}
            </span>
          ) : null}
        </TabBtn>
        <TabBtn active={tab === 'manage'} onClick={() => setTab('manage')}>
          ⚙️ 管理
        </TabBtn>
      </div>

      {tab === 'shop' && (
        <>
          {sections.length === 0 ? (
            <div className="surface flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="text-6xl">🛒</span>
              <p className="font-display text-lg font-extrabold text-ink-900">还没有可以换的东西</p>
              <p className="text-sm text-ink-500">请爸爸妈妈去「管理」里添加吧</p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* ⚠️ 这里**不再写「🪙 你有 N 分」** —— 全局顶栏已经常驻显示余额，
                  在正文里再报一遍同一个数只是噪音。留下的这句才是这里独有的信息：
                  「点了就会扣」这个后果，以及**两种币怎么分摊**。 */}
              <p className="rounded-2xl bg-sun-50 px-3 py-2 text-xs font-bold text-ink-700">
                换完就扣币，想清楚再点哦～
                <span className="mt-1 block text-[11px] font-normal leading-snug text-ink-500">
                  🎫 兑换券先花，不够再用 🪙 积分 —— 两种币 1 比 1 等价，可以一起付。
                </span>
              </p>

              {/* 家里加的和爸妈开放的心愿**混在同一张表里**（按价格排）。
                  不再另起一块「心愿商城 · 爸妈开放了」—— 那等于在兑换里开一道门，
                  通往另一个收银台；家长要的是「兑换里的东西都是一样」。 */}
              {sections.map((g) => (
                <section key={g.category}>
                  <h3 className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
                    {g.meta.emoji} {g.meta.label}
                  </h3>
                  <ul className="space-y-3">
                    {g.rows.map((row) =>
                      row.kind === 'family' ? (
                        <RedeemRow
                          key={row.item.id}
                          item={row.item}
                          balance={balance}
                          harvestBalance={harvestBalance}
                        />
                      ) : (
                        <WishRedeemRow
                          key={row.item.id}
                          item={row.item}
                          price={row.price}
                          balance={balance}
                          harvestBalance={harvestBalance}
                          times={redeemedTimes.get(row.item.id) ?? 0}
                          flash={flashId === row.item.id}
                          onBox={setBoxGames}
                        />
                      ),
                    )}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'records' && (
        <div className="space-y-3 pb-4">
          {history.length === 0 ? (
            <div className="surface flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="text-5xl">📜</span>
              <p className="font-display font-extrabold text-ink-900">还没有兑换过</p>
              <p className="text-sm text-ink-500">做任务攒积分、种地攒兑换券，都能来这里换</p>
            </div>
          ) : (
            history.map((r) => (
              <div key={r.id} data-redeem-record={r.id} className="surface flex items-center gap-3 p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun-100 text-xl">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink-900">{r.name}</p>
                  {/* `break-keep`（`word-break: keep-all`）不是装饰 —— 320 宽的手机上
                      混付单会放不下：`-100 兑换券 + 50 积分 · 刚刚` 约 150px，
                      而标签「已取消 · 已退回」占 93px 之后只剩 ~135px。
                      默认规则下 CJK 可以在**任意两个字之间**断行，于是实测断成了
                        `-100 兑换券 + 50 积`
                        `分 · 刚刚`
                      —— 「积分」被劈开，金额还留着个孤零零的 `·` 在行尾。
                      加 keep-all 后只允许在空格处断，变成
                        `-100 兑换券 + 50`
                        `积分 · 刚刚`
                      390（主战场）上本来就是单行，不受影响。
                      ⚠️ 别改成 `whitespace-nowrap`：那会溢出列宽、压到标签上。 */}
                  <p className="break-keep text-[11px] text-ink-500">
                    -{r.pay}
                    {/* `·` 和它后面的时间绑成一个不可断的块。分开写的话 320 上会断成
                        `… + 50 积分 ·` / `刚刚` —— 分隔符孤零零挂在行尾。 */}
                    <span className="whitespace-nowrap"> · {humanizeAgo(r.createdAt)}</span>
                  </p>
                  {/* 家长填的订单号要能查回来 —— 填了看不见等于没填。
                      只对心愿单有值（App 内兑现的那几件没有外链订单）。 */}
                  {r.orderNo && (
                    <p
                      data-history-order-no
                      className="mt-0.5 truncate text-[10.5px] font-bold text-ink-400"
                    >
                      🧾 订单号 {r.orderNo}
                    </p>
                  )}
                </div>
                <span
                  className={clsx(
                    'shrink-0 rounded-full px-2 py-1 text-[11px] font-bold',
                    HISTORY_TONE[r.tone],
                  )}
                >
                  {r.tag}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 管理 tab 的闸门（2026-11-06 统一成弹框）。
          原来是键盘直接铺在这一栏里：切到「⚙️ 管理」的孩子迎面一屏数字键，
          既没有「这是爸妈的事」的说明，也没有出口。现在是一张锁卡 + 一颗
          按钮，点下去才弹密码。 */}
      {tab === 'manage' &&
        (needsPin && !pinOk ? (
          <div className="pt-4">
            <div className="rounded-3xl bg-white p-6 text-center shadow-flat">
              <div className="text-5xl">🔒</div>
              <p className="mt-3 font-display text-lg font-extrabold text-ink-900">
                管理兑换品需要密码
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                加一件、改价格、下架，都是爸妈的事。
              </p>
              <div className="mt-4">
                <ParentLockButton
                  label="爸妈：管理兑换品"
                  tone="primary"
                  onClick={() => setPinOpen(true)}
                />
              </div>
            </div>
          </div>
        ) : (
          <ManagePanel />
        ))}

      <ParentPinSheet
        open={pinOpen}
        onClose={() => setPinOpen(false)}
        onPass={() => {
          setPinOk(true)
          setPinOpen(false)
        }}
        hint="管理兑换品需要密码"
      />

      {/* 盲盒的揭晓层。
          它原来在心愿页，2026-10-29 随「扣币只留兑换这一处」一起搬过来。
          **必须 Portal 到 body** —— 外壳的 `anim-fade-in` 是隐式层叠上下文，
          留在页面里 z-index 再大也压不住底部导航（项目硬约束）。 */}
      {boxGames && (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="抽到了新游戏"
            className="fixed inset-0 z-50 flex items-center justify-center bg-paper px-4"
          >
            <div className="w-full max-w-sm">
              <BoxView gameIds={boxGames} onDone={() => setBoxGames(null)} />
            </div>
          </div>
        </Portal>
      )}
    </>
  )
}

/* ---------------- 孩子视角：一键兑换 ---------------- */

/**
 * 付款拆分：`🎫 30 + 🪙 20`。只出一种币时不显示另一种的 0。
 *
 * ⚠️ 不把 🪙 渲染成**独占一个叶子节点**（`<span>🪙</span>`）——
 * e2e-check §8 靠「textContent 恰好等于 🪙 的叶子」来定位余额牌，
 * 这里的文字是 `🪙 20`，天然不撞。
 */
function PaySplit({ plan }: { plan: RedeemPayment }) {
  return (
    <span className="tnum">
      {plan.harvestPaid > 0 ? (
        <span className="font-extrabold text-grass-700">🎫 {plan.harvestPaid}</span>
      ) : null}
      {plan.harvestPaid > 0 && plan.pointsPaid > 0 ? (
        <span className="font-normal text-ink-400"> + </span>
      ) : null}
      {plan.pointsPaid > 0 ? (
        <span className="font-extrabold text-sun-700">🪙 {plan.pointsPaid}</span>
      ) : null}
    </span>
  )
}

/**
 * 一行「爸妈开放了的心愿」。
 *
 * ## 它和 `RedeemRow` 是**同一种东西**
 *
 * 家长原话（2026-10-29）：「兑换 里的东西都是一样，都能用兑换券或者积分，
 * 包括游戏也一样。不需要去心愿商城换。心愿商城只是标明心愿的。」
 *
 * 所以这一行**长得和家里的兑换品一样、付款规则也一样**：
 * 同一个 `planRedeemPayment` 分账、同一个确认面板、同一个「换这个」按钮。
 * 区别只有交付那一步 ——
 *   · 盲盒 → 当场揭晓（`BoxView`，盖在整屏上）
 *   · 盒子 → `wishRedeem` 顺手把包装上，这一行随之消失（已拥有）
 *   · 实物 → 生成 `committed` 单子，等爸妈去外链买
 * 这三条都在 `wishRedeem` 里，这里不重复实现。
 *
 * ⚠️ 别把这里改回「点一下跳去心愿页换」—— 那是第一版的做法，家长当场
 *    纠正了：在兑换里开一道门通往另一个收银台，等于把付款拆成两处。
 */
function WishRedeemRow({
  item,
  price,
  balance,
  harvestBalance,
  times,
  flash,
  onBox,
}: {
  item: WishItem
  price: number
  balance: number
  harvestBalance: number
  /** 这件商品**已经兑换过几次**（只数成交的，见 `redeemedTimes`） */
  times: number
  /** 刚从心愿页「去兑换换」跳过来 —— 闪一下，让孩子看见是哪一行 */
  flash: boolean
  onBox: (gameIds: string[]) => void
}) {
  const wishRedeem = useApp((s) => s.wishRedeem)
  const pushToast = useApp((s) => s.pushToast)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  /** 和 store 扣款调的是同一个函数 —— 按钮上写的分摊跟实际扣的一定一致 */
  const plan = planRedeemPayment(price, harvestBalance, balance)
  const affordable = plan.affordable
  const meta = WISH_KIND_META[item.kind]

  const doRedeem = async () => {
    if (busy) return
    setBusy(true)
    try {
      const res = await wishRedeem(item.id)
      if (!res.ok) {
        // `wishRedeem` 失败时不弹 toast（它把原因 return 回来），这里补上
        pushToast({ kind: 'warn', title: res.message, emoji: '🎫' })
        return
      }
      setConfirming(false)
      if (item.kind === 'blindbox') {
        const ids = res.gameIds?.length ? res.gameIds : res.gameId ? [res.gameId] : []
        if (ids.length) onBox(ids)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <li
      data-shop-row={item.id}
      className={clsx(
        'surface overflow-hidden',
        !affordable && 'opacity-70',
        flash && 'ring-4 ring-grass-400',
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-sun-100 text-2xl">
          {item.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-extrabold text-ink-900">{item.name}</p>
          <p className="line-clamp-2 text-xs text-ink-500">
            {item.partnerName ?? meta.label}
            {item.note ? ` · ${item.note}` : ''}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CoinPill amount={price} icon="🎫" tone={affordable ? 'sun' : 'danger'} />
            <span className="text-[11px] text-ink-400">{meta.emoji}</span>
            {/* 已兑换次数：家长看「这件东西到底换过几次」，孩子看「还能不能再换」 */}
            {times > 0 && (
              <span
                data-redeem-times={item.id}
                className="rounded-full bg-grass-100 px-2 py-0.5 text-[11px] font-extrabold text-grass-700"
              >
                已兑换 {times} 次
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] font-bold text-ink-500">
            付款：<PaySplit plan={plan} />
          </p>
          {!affordable ? (
            <p className="mt-0.5 text-[11px] font-bold text-berry-500">
              两种币加起来还差 {plan.shortfall}
            </p>
          ) : null}
        </div>
      </div>

      {confirming ? (
        <div className="border-t-2 border-ink-900/5 bg-sun-50/70 p-3">
          <p className="mb-2 text-center text-sm font-bold text-ink-700">
            换「{item.name}」？
            <br />
            <span className="text-xs font-normal text-ink-500">
              付款：{describeRedeemPayment({ cost: price, ...plan })}
              <br />
              换完还剩 🎫 {harvestBalance - plan.harvestPaid} · 🪙 {balance - plan.pointsPaid}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-500 active:btn-press"
            >
              再想想
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doRedeem()}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-grass-600/30 bg-grass-400 font-display font-extrabold text-white active:btn-press disabled:opacity-50"
            >
              🎉 换！
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t-2 border-ink-900/5 p-2">
          <button
            type="button"
            disabled={!affordable || busy}
            onClick={() => setConfirming(true)}
            className={clsx(
              'btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border font-display font-extrabold',
              affordable
                ? 'border-grape-500/30 bg-grape-400 text-white active:btn-press'
                : 'cursor-not-allowed border-ink-900/10 bg-ink-100 text-ink-300',
            )}
          >
            {affordable ? '🎁 换这个' : `还差 ${plan.shortfall}`}
          </button>
        </div>
      )}
    </li>
  )
}

function RedeemRow({
  item,
  balance,
  harvestBalance,
}: {
  item: RedeemItem
  balance: number
  /** 兑换券余额。兑换**优先花它**，见 domain/redeem.ts */
  harvestBalance: number
}) {
  const redeem = useApp((s) => s.redeem)
  const redeemedToday = useApp((s) => s.redeemedToday)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  /**
   * 分账。**和 store 扣款调的是同一个函数** —— 所以按钮上写的
   * 「🎫 30 + 🪙 20」跟实际扣的一定是同一组数，不会各算各的。
   */
  const plan = planRedeemPayment(item.cost, harvestBalance, balance)
  const affordable = plan.affordable
  const usedToday = redeemedToday(item.id)
  const maxed = item.limitPerDay != null && usedToday >= item.limitPerDay
  const meta = CATEGORY_META[item.category]

  const doRedeem = async () => {
    setBusy(true)
    try {
      const ok = await redeem(item.id)
      if (ok) setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={clsx('surface overflow-hidden', (!affordable || maxed) && 'opacity-70')}>
      <div className="flex items-center gap-3 p-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-grape-100 text-2xl">
          {item.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-extrabold text-ink-900">{item.name}</p>
          {item.note ? (
            <p className="line-clamp-2 text-xs text-ink-500">{item.note}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CoinPill amount={item.cost} tone={affordable ? 'sun' : 'danger'} />
            {/* ⚠️ 这里原来还有一句「≈ ¥12」的现金参考（2026-09-21 加的）。
                2026-09-30 用户要求去掉，原话：
                  「🪙120 ≈¥12 兑换页 这种感觉不用显示。有付款了。」
                理由成立：下面那行「付款：🎫 x + 🪙 y」已经把「这件东西
                怎么付」说清楚了，再标一个人民币数字只是卡片上的噪音 ——
                而且孩子要理解的是「我攒的币够不够」，不是「值几块钱」。
                ⚠️ 家长端（RedeemEditor）的定价参照**保留** —— 那是家长
                给自己定价时用的参照，不是给孩子看的。 */}
            {item.limitPerDay != null ? (
              <span className="text-[11px] text-ink-500">
                每天最多 {item.limitPerDay} 次
                {maxed ? ' · 今天用完了' : ` · 还剩 ${item.limitPerDay - usedToday} 次`}
              </span>
            ) : null}
            <span className="text-[11px] text-ink-400">{meta.emoji}</span>
          </div>

          {/* 这一件**具体怎么付**。规则：兑换券优先、1:1、可混合。 */}
          <p className="mt-1 text-[11px] font-bold text-ink-500">
            付款：<PaySplit plan={plan} />
          </p>
          {!affordable ? (
            <p className="mt-0.5 text-[11px] font-bold text-berry-500">
              两种币加起来还差 {plan.shortfall}
            </p>
          ) : null}
        </div>
      </div>

      {confirming ? (
        <div className="border-t-2 border-ink-900/5 bg-sun-50/70 p-3">
          <p className="mb-2 text-center text-sm font-bold text-ink-700">
            换「{item.name}」？
            <br />
            <span className="text-xs font-normal text-ink-500">
              付款：{describeRedeemPayment({ cost: item.cost, ...plan })}
              <br />
              换完还剩 🎫 {harvestBalance - plan.harvestPaid} · 🪙 {balance - plan.pointsPaid}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-500 active:btn-press"
            >
              再想想
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doRedeem()}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-grass-600/30 bg-grass-400 font-display font-extrabold text-white active:btn-press disabled:opacity-50"
            >
              🎉 换！
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t-2 border-ink-900/5 p-2">
          <button
            type="button"
            disabled={!affordable || maxed}
            onClick={() => setConfirming(true)}
            className={clsx(
              'btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border font-display font-extrabold',
              affordable && !maxed
                ? 'border-grape-500/30 bg-grape-400 text-white active:btn-press'
                : 'cursor-not-allowed border-ink-900/10 bg-ink-100 text-ink-300',
            )}
          >
            {maxed
              ? '今天已经换过了'
              : affordable
                ? '🎁 换这个'
                : `还差 ${plan.shortfall}`}
          </button>
        </div>
      )}
    </li>
  )
}

/* ---------------- 家长视角：管理 ---------------- */

const EMOJI_CHOICES = [
  // ⚠️ 这里**故意不放货币图标**（`🪙` 积分 / `🎫` 兑换券 / `🛍️` 钻石 / `🕹️` 娃娃机币，
  //    见 `domain/currency.ts`）。理由：奖励卡和付款行
  //    （「付款：🎫 250 + 🪙 10」）在**同一个列表**里，奖励图标要是长成一张票，
  //    孩子就分不出哪个是钱。2026-10-16 之前这里放的是 `🎫`，已换成 `🧹`（家务）。
  '🍪','🧃','🍕','🍦','🍫','🎂','📱','📺','🎮','🎬','🧸','🎁',
  '🎡','🏊','🚲','🏃','🌙','⭐','🧹','💛','🧩','🛴','⚽','🎨',
]

function ManagePanel() {
  const allRedeemItems = useApp((s) => s.allRedeemItems)
  const redeemRecords = useApp((s) => s.redeemRecords)
  const setRedeemItemArchived = useApp((s) => s.setRedeemItemArchived)
  const deleteRedeemItem = useApp((s) => s.deleteRedeemItem)
  const fulfillRedeem = useApp((s) => s.fulfillRedeem)
  const pushToast = useApp((s) => s.pushToast)

  const [editing, setEditing] = useState<RedeemItem | null>(null)
  const [creating, setCreating] = useState(false)
  /** 正在等二次确认的那一条 —— 删除不可逆，不能一点就没 */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const pending = redeemRecords.filter((r) => !r.fulfilled)

  /** 已经换过的商品 id —— 管理页靠它标出「一次性 · 已换过」，见下面那行 meta */
  const redeemedIds = useMemo(() => new Set(redeemRecords.map((r) => r.itemId)), [redeemRecords])

  /** 上架 / 下架。下架是可逆的，所以不做二次确认，只给个 toast 反馈。 */
  const toggleArchived = async (it: RedeemItem) => {
    const next = !it.archived
    await setRedeemItemArchived(it.id, next)
    pushToast({
      kind: 'info',
      title: next ? '已下架' : '已重新上架',
      detail: next ? `${it.name} 从孩子的列表里藏起来了` : `${it.name} 又能换啦`,
      emoji: next ? '⬇️' : '⬆️',
    })
  }

  const doDelete = async (it: RedeemItem) => {
    setConfirmingId(null)
    await deleteRedeemItem(it.id)
    pushToast({ kind: 'info', title: `已删除「${it.name}」`, emoji: '🗑' })
  }

  if (creating || editing) {
    return (
      <RedeemEditor
        item={editing ?? undefined}
        onDone={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {/* ---- 待兑现 ---- */}
      {pending.length > 0 && (
        <section className="surface overflow-hidden border border-sun-400/40">
          <div className="bg-sun-100 px-3 py-2">
            <p className="font-display text-sm font-extrabold text-ink-900">
              🔔 有 {pending.length} 个愿望等兑现
            </p>
            <p className="text-[11px] text-ink-500">孩子已经换好了，记得兑现哦</p>
          </div>
          <ul className="divide-y-2 divide-ink-900/5">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-lg shadow-flat">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink-900">{r.name}</p>
                  <p className="text-[11px] text-ink-500">
                    {humanizeAgo(r.createdAt)} · 花了 {describeRedeemPayment(r)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fulfillRedeem(r.id)}
                  className="btn shrink-0 rounded-2xl border border-grass-600/30 bg-grass-400 px-3 py-2 text-sm font-extrabold text-white active:btn-press"
                >
                  已兑现 ✓
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="btn flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-grape-500/30 bg-gradient-to-b from-grape-300 to-grape-500 font-display text-base font-extrabold text-white shadow-flat active:btn-press"
      >
        ➕ 新增一个兑换品
      </button>

      <section>
        <h3 className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
          全部兑换品（{allRedeemItems.length}）
        </h3>
        <ul className="space-y-2">
          {allRedeemItems.map((it) => {
            const archived = !!it.archived

            // 删除的二次确认就地展开，不另弹窗：
            // 家长还在列表上下文里，一眼看得见自己点的是哪一条。
            if (confirmingId === it.id) {
              return (
                <li
                  key={it.id}
                  className="surface flex items-center gap-2 border border-berry-400/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-ink-900">
                      删除「{it.name}」？
                    </p>
                    <p className="text-[11px] leading-snug text-ink-500">
                      删掉就找不回来了。换过的记录会留着。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="btn shrink-0 rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs font-extrabold text-ink-700 active:btn-press"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDelete(it)}
                    className="btn shrink-0 rounded-xl border border-berry-500/30 bg-berry-400 px-3 py-2 text-xs font-extrabold text-white active:btn-press"
                  >
                    删除
                  </button>
                </li>
              )
            }

            return (
              <li key={it.id} className="surface flex items-center gap-3 p-3">
                <span
                  className={clsx(
                    'grid size-11 shrink-0 place-items-center rounded-2xl text-xl',
                    archived ? 'bg-ink-100' : 'bg-grape-100',
                  )}
                >
                  {it.emoji}
                </span>
                {/* 只把文字压暗，操作按钮保持原样 —— 整行 opacity 会让按钮看着像禁用了 */}
                <div className={clsx('min-w-0 flex-1', archived && 'opacity-50')}>
                  <p className="truncate text-sm font-extrabold text-ink-900">
                    {it.name}
                    {archived ? (
                      <span className="ml-1 text-[11px] font-bold text-ink-500">已下架</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-ink-500">
                    {it.cost} 分 · {CATEGORY_META[it.category].label}
                    {it.once ? (
                      <span className="font-bold text-grape-500">
                        {' '}
                        · 一次性{redeemedIds.has(it.id) ? ' · 已换过（商城里不再显示）' : ''}
                      </span>
                    ) : it.limitPerDay != null ? (
                      ` · 每天 ${it.limitPerDay} 次`
                    ) : (
                      ''
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(it)}
                    aria-label={`编辑 ${it.name}`}
                    className="btn rounded-xl border border-ink-900/10 bg-white px-2.5 py-1.5 text-sm font-bold active:btn-press"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleArchived(it)}
                    aria-label={archived ? `上架 ${it.name}` : `下架 ${it.name}`}
                    className={clsx(
                      'btn rounded-xl border px-2.5 py-1.5 text-sm font-bold active:btn-press',
                      archived
                        ? 'border-grass-500/40 bg-grass-100'
                        : 'border-ink-900/10 bg-white',
                    )}
                  >
                    {archived ? '⬆️' : '⬇️'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(it.id)}
                    aria-label={`删除 ${it.name}`}
                    className="btn rounded-xl border border-berry-400/40 bg-berry-100 px-2.5 py-1.5 text-sm font-bold active:btn-press"
                  >
                    🗑
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-500">
        ⬇️ 下架只是从孩子看到的列表里藏起来，换过的记录都还在，⬆️ 可以随时重新上架。
        <br />
        🗑 是永久删除，会再问你一次。
      </p>
    </div>
  )
}

/* ---------------- 新增 / 编辑兑换品 ---------------- */

function RedeemEditor({ item, onDone }: { item?: RedeemItem; onDone: () => void }) {
  const addRedeemItem = useApp((s) => s.addRedeemItem)
  const updateRedeemItem = useApp((s) => s.updateRedeemItem)
  const pushToast = useApp((s) => s.pushToast)
  /** 现金 : 积分 参考汇率。给家长定价时一个「值多少钱」的参照，**纯展示** */
  const ratio = clampPointsPerYuan(useApp((s) => s.settings.pointsPerYuan))

  const [name, setName] = useState(item?.name ?? '')
  const [emoji, setEmoji] = useState(item?.emoji ?? '🎁')
  const [category, setCategory] = useState<RedeemCategory>(item?.category ?? 'snack')
  const [cost, setCost] = useState(item?.cost ?? 50)
  const [note, setNote] = useState(item?.note ?? '')
  const [limitPerDay, setLimitPerDay] = useState<number | undefined>(item?.limitPerDay)
  const [once, setOnce] = useState(!!item?.once)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!name.trim()) {
      setErr('给它起个名字吧')
      return
    }
    if (cost <= 0) {
      setErr('积分要大于 0')
      return
    }
    if (item) {
      await updateRedeemItem(item.id, {
        name: name.trim(),
        emoji,
        category,
        cost,
        note: note.trim() || undefined,
        limitPerDay,
        once,
      })
      pushToast({ kind: 'success', title: '改好啦', emoji: '✅' })
    } else {
      await addRedeemItem({
        name: name.trim(),
        emoji,
        category,
        cost,
        note: note.trim() || undefined,
        limitPerDay,
        once,
        createdByParent: true,
      })
      pushToast({ kind: 'success', title: `加上了「${name.trim()}」`, emoji: '🎁' })
    }
    onDone()
  }

  return (
    <div className="space-y-4 pb-4">
      <button
        type="button"
        onClick={onDone}
        className="text-sm font-bold text-ink-500"
      >
        ← 返回管理
      </button>

      <div className="surface p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-sun-50 text-3xl">
            {emoji}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="叫什么？比如「玩 30 分钟平板」"
            className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-ink-900/10 bg-paper-2 px-3 font-display font-bold text-ink-900 outline-none focus:border-grape-400"
          />
        </div>

        <Field label="选个图标">
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={clsx(
                  'btn grid size-10 place-items-center rounded-xl text-xl active:btn-press',
                  emoji === e ? 'scale-110 bg-sun-300 ring-2 ring-sun-400' : 'bg-white',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="属于哪一类">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={clsx(
                  'btn rounded-pill px-3 py-2 text-sm font-bold active:btn-press',
                  category === c ? 'bg-grape-400 text-white' : 'bg-white text-ink-500',
                )}
              >
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="需要多少（兑换券和积分 1 比 1，都能付）">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCost((c) => Math.max(5, c - 10))}
              className="btn grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl font-extrabold active:btn-press"
            >
              −
            </button>
            <input
              type="number"
              value={cost}
              min={1}
              onChange={(e) => setCost(Math.max(1, Number(e.target.value) || 0))}
              className="tnum min-h-[48px] min-w-0 flex-1 rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-center font-display text-xl font-extrabold text-ink-900 outline-none focus:border-grape-400"
            />
            <button
              type="button"
              onClick={() => setCost((c) => c + 10)}
              className="btn grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl font-extrabold active:btn-press"
            >
              ＋
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[30, 50, 80, 120, 200, 300, 600, 1500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCost(v)}
                className={clsx(
                  'btn rounded-pill px-2.5 py-1.5 text-xs font-bold active:btn-press',
                  cost === v ? 'bg-sun-300 text-ink-900' : 'bg-white text-ink-500',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            参考：孩子一天大约能赚 170~270 分。30~60 分是"每天都能换"，
            150~300 分要攒一两天，600 分要攒三四天，1500 分要攒一两周。
            <br />
            ⚠️ 孩子手里还有 <b className="text-ink-700">兑换券</b>（种地赚的）。
            兑换时<b className="text-ink-700">先花兑换券</b>，
            花光了才动积分 —— 所以实际能换的东西比上面这个"攒几天"要早。
            <br />
            按现在的汇率（1 元 ≈ {ratio} 分），{cost} 分 ≈{' '}
            <b className="text-ink-700">{formatYuan(cost, ratio)}</b>。
          </p>
        </Field>

        <Field label="说明（可不填）">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 40))}
            placeholder="比如「周末才能用哦」"
            className="min-h-[46px] w-full rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-sm font-bold text-ink-900 outline-none focus:border-grape-400"
          />
        </Field>

        <Field label="能换几次">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-once-off
              onClick={() => setOnce(false)}
              className={clsx(
                'btn rounded-pill px-3 py-2 text-sm font-bold active:btn-press',
                !once ? 'bg-sun-300 text-ink-900' : 'bg-white text-ink-500',
              )}
            >
              可以重复换
            </button>
            <button
              type="button"
              data-once-on
              onClick={() => setOnce(true)}
              className={clsx(
                'btn rounded-pill px-3 py-2 text-sm font-bold active:btn-press',
                once ? 'bg-grape-400 text-white' : 'bg-white text-ink-500',
              )}
            >
              只换一次
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-500">
            {once
              ? '换到手就「有了」，所以换过之后它就不再出现在孩子的「能换什么」里。一款游戏、一个玩具、一次生日礼物，都是这种。'
              : '每天都能换的东西（零食、看 20 分钟动画）选这个。下面可以再限一天换几次。'}
          </p>
        </Field>

        {!once && (
          <Field label="每天最多换几次（0 = 不限）">
            <div className="flex flex-wrap gap-1.5">
              {[0, 1, 2, 3].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLimitPerDay(v === 0 ? undefined : v)}
                  className={clsx(
                    'btn rounded-pill px-3 py-2 text-sm font-bold active:btn-press',
                    (v === 0 ? limitPerDay == null : limitPerDay === v)
                      ? 'bg-sun-300 text-ink-900'
                      : 'bg-white text-ink-500',
                  )}
                >
                  {v === 0 ? '不限' : `${v} 次`}
                </button>
              ))}
            </div>
          </Field>
        )}

        {err && <p className="mt-2 text-sm font-bold text-berry-500">{err}</p>}

        <button
          type="button"
          onClick={() => void save()}
          className="btn mt-4 flex min-h-[54px] w-full items-center justify-center rounded-2xl border border-grape-500/30 bg-gradient-to-b from-grape-300 to-grape-500 font-display text-lg font-extrabold text-white shadow-flat active:btn-press"
        >
          {item ? '保存修改' : '🎁 加进商城'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-extrabold text-ink-500">{label}</p>
      {children}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      /* `whitespace-nowrap`：tab 文案是**固定短词**，不该在词中间断行。
         360 宽实测被红徽标挤成 `兑换记` / `录` —— 一个控件名字被劈开，
         比让整行溢出一两个像素难看得多。 */
      className={clsx(
        'btn flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-full text-[14px] active:btn-press',
        active ? 'bg-grape-400 text-white shadow-flat' : 'bg-transparent text-ink-500',
      )}
    >
      {children}
    </button>
  )
}
