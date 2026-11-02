import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { selectPendingCheckIns, selectPendingReview, useApp } from './store/useApp'
import { wishesAwaitingReply } from './domain/wish'
import TaskPage from './features/tasks/TaskPage'
import PointsPage from './features/tasks/PointsPage'
import RedeemPage from './features/redeem/RedeemPage'
import WishPage from './features/wish/WishPage'
import SettingsPage from './features/settings/SettingsPage'
import { ReviewSheetModal } from './features/parent/ReviewSheet'
import { SplashPage } from './features/splash/SplashPage'
import { SetupWizard } from './features/onboarding/SetupWizard'
import { OnlineLoginGate } from './features/account/OnlineLoginGate'
import { ChildTour } from './features/onboarding/ChildTour'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SyncBanner } from './components/SyncBanner'
import { isNative, playTone } from './platform/files'
import { gameById } from './games/registry'
import { CURRENCY } from './domain/currency'
import { pageFor } from './games/pages'
import { PluginGameHost } from './games/PluginGameHost'
import { GamePlayGate } from './features/game/GamePlayGate'
import './features/farm/farm.css'

type TabKey = 'tasks' | 'game' | 'redeem' | 'wish' | 'points'

/**
 * 底部导航里**固定**的那三格。
 *
 * ⚠️ **游戏那一格不在这里。** 它的图标和名字跟着「当前正在玩的游戏」走
 * （见组件里的 `tabs`），所以只能运行时算出来。
 *
 * `tour` 是给新手导览和 4 个走查脚本定位用的 `data-tour` 值。
 * 游戏那一格的值是 `tab-<当前游戏 id>` —— 默认（农场）时正好是 `tab-farm`，
 * 而 `ChildTour.tsx` 的导览步骤和 `capture-tablet.mjs` / `e2e-check.mjs`
 * 都钉着这个字符串。**别把它改成固定的 `tab-game`**，那会同时弄断导览和 e2e。
 */
const STATIC_TABS: { key: TabKey; label: string; emoji: string; tour: string }[] = [
  { key: 'tasks', label: '任务', emoji: '📋', tour: 'tab-tasks' },
  { key: 'redeem', label: '兑换', emoji: '🎁', tour: 'tab-redeem' },
  // 心愿商城（2026-10-28）：和「兑换」并列，不是它的子页 ——
  // 兑换是家里的事（家长自建、家长兑现），心愿是外面的事（合作商商品、淘宝成交）。
  { key: 'wish', label: '心愿', emoji: '🛍️', tour: 'tab-wish' },
  { key: 'points', label: '积分', emoji: '🪙', tour: 'tab-points' },
]

/**
 * 入场页最短停留时间。
 *
 * 本地 IndexedDB 读一次数据通常几十毫秒就完了，如果只按 `ready` 来收场，
 * 入场页会「闪一下」—— 格言根本来不及看，反而像加载卡了一下。
 * 所以要求「数据好了」**并且**「至少待够这么久」两个条件同时成立。
 */
const SPLASH_MIN_MS = 1900

export default function App() {
  const ready = useApp((s) => s.ready)
  const balance = useApp((s) => s.balance)
  /** 兑换券：农场产出的结算币。和积分是两套账，见 store 里 postHarvest 的注释。 */
  const harvestBalance = useApp((s) => s.harvestBalance)
  /**
   * 钻石（`mall`）。2026-10-28 家长要求：**顶栏在积分前面显示钻石**。
   *
   * ⚠️ 它现在**没有任何产出入口**了 —— 设置页那张「钻石」卡（含手动发放）
   * 同一轮被删掉，而内置游戏一款标价的都没有（`registry.ts` 的 `priceMall` 全 0）。
   * 唯一来源是全新档案赠送的 500（`doSeedIfEmpty`）。
   * 家长知道并接受：「照常显示，0 也显示」。
   */
  const mallBalance = useApp((s) => s.mallBalance)
  const toasts = useApp((s) => s.toasts)
  const dismissToast = useApp((s) => s.dismissToast)
  const boot = useApp((s) => s.boot)
  const tick = useApp((s) => s.tick)
  const settings = useApp((s) => s.settings)
  /**
   * 当前正在玩的游戏。底部导航的游戏那一格（图标 + 名字）跟着它走。
   *
   * `activeGameId` 已经在 store 里被 `resolveActiveGame()` 兜过底 ——
   * 它保证是一个**可玩**的 id，但**不保证它在注册表里**：
   * 下载来的游戏（spec §12）是运行时装进来的，`gameById` 找不到它。
   * 所以「游戏叫什么、长什么样」有**两个来源**，按优先级取：
   *   ① 注册表（内置游戏，编译进来，永远优先）
   *   ② `installedGames`（下载来的游戏的清单，从 `gameKv` 派生）
   * 两个都没有时按兜底渲染，不炸。
   */
  const activeGameId = useApp((s) => s.activeGameId)
  const activeGame = gameById(activeGameId)
  const activePlugin = useApp((s) => s.installedGames[activeGameId])

  const [tab, setTab] = useState<TabKey>('tasks')
  const [showSettings, setShowSettings] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [splashMinElapsed, setSplashMinElapsed] = useState(false)
  /** 家长设置向导：null = 关着，'first' = 首次引导，'replay' = 设置页点「重看」 */
  const [wizardMode, setWizardMode] = useState<'first' | 'replay' | null>(null)
  /** 给孩子的功能导览开着吗 */
  const [tourOpen, setTourOpen] = useState(false)
  /** 首次进入只自动决定一次，之后靠设置页的「重看」入口手动开 */
  const gateDecided = useRef(false)

  // 入场页最短停留（理由见 SPLASH_MIN_MS 的注释）
  useEffect(() => {
    const id = window.setTimeout(() => setSplashMinElapsed(true), SPLASH_MIN_MS)
    return () => window.clearTimeout(id)
  }, [])

  /**
   * 「进入」的那一刻：响一声可爱的欢迎音（音色定义见 platform/files.ts 的 TONES.entry）。
   *
   * 为什么放在这里而不是入场页里：
   *  · 这一下是**进入主界面**的声音，语义上就该挂在闸门打开的瞬间；
   *  · 入场页期间 `settings` 可能还没读完（`ready` 还是 false），
   *    放那边会读到默认值，家长明明关了声音还是会响。
   *
   * ⚠️ `settings.soundEnabled` 故意**不进依赖数组**：它是「响不响」的取值，
   * 不是触发条件。放进去了，家长在设置里拨一下开关就会重放一次欢迎音。
   * `entered` 是一次性闸门（true 之后不会翻回 false），所以只响一次。
   *
   * ⚠️ 浏览器/WebView 的自动播放策略会让第一声被拦掉（见 playTone 的注释），
   * 那时它会挂起并在孩子第一次碰屏幕时补播 —— 不会静默丢失。
   */
  const entered = ready && splashMinElapsed
  useEffect(() => {
    if (!entered) return
    playTone(settings.soundEnabled, 'entry')
  }, [entered])

  /**
   * 新手引导的闸门：进入主界面**之后**决定一次，没走过就弹家长设置向导。
   *
   * 用 `useLayoutEffect` 而不是 `useEffect`：`entered` 翻 true 的那一帧，
   * DOM 里已经画出了主界面。effect 在**绘制后**跑，孩子会看见主界面闪一下
   * 再被向导盖住；layoutEffect 在绘制前跑，同一帧里就把向导盖上，看不到闪。
   *
   * `gateDecided` 保证只决定一次 —— 否则引导走完把 `onboardingDone` 写成 true，
   * 这个 effect 会因为依赖变化再跑一遍。
   */
  const onboardingDone = settings.onboardingDone
  useLayoutEffect(() => {
    if (!entered || gateDecided.current) return
    gateDecided.current = true
    if (!onboardingDone) setWizardMode('first')
  }, [entered, onboardingDone])

  /** 向导走完 → 紧接着给孩子看导览（引导是「两段」的，见 SetupWizard 注释） */
  const finishWizard = () => {
    setWizardMode(null)
    setTourOpen(true)
  }

  /** 导览结束或跳过 → 整条引导才算走完，这时候才落 `onboardingDone` */
  const finishTour = () => {
    setTourOpen(false)
    if (!onboardingDone) void useApp.getState().updateSettings({ onboardingDone: true })
  }

  /**
   * 设置页里的「重看新手引导」。
   *
   * 用 `'replay'` 而不是 `'first'`：重看模式下向导**不含密码步骤**，
   * 否则孩子点一下这个入口就能把家长密码改成自己的（详见 SetupWizard 文件头第 4 条）。
   */
  const replayGuide = () => {
    setShowSettings(false)
    setWizardMode('replay')
  }

  // 待审核数量 —— 订阅 instances 与 checkInProgress，数据一变就重算，红点才不会卡住。
  // 签到不产生任务实例，所以必须单独把待审签到算进来，否则孩子交了签到、
  // 家长端红点不动，那条待审就永远没人看见。
  const instances = useApp((s) => s.instances)
  const checkInProgress = useApp((s) => s.checkInProgress)
  /**
   * 孩子「想要」的心愿也要算进这个红点（2026-10-29）。
   *
   * 家长原话：「心愿商城爸爸妈妈收到心愿，也跟任务一样，出现在上边栏的
   * 眼睛那，而不是在心愿商城这里」。所以心愿页顶部那张「有 N 个心愿等你
   * 回应」的卡撤掉了，改从这里进 —— 否则家长根本不知道有孩子在等回话。
   *
   * ⚠️ 只算 `wished`（还没定价、没花钱）。`committed`（已扣券、等爸妈
   *    去买）**不算**：那批要在心愿页里填收货信息、走淘宝，和「审核」不是
   *    一回事，混进来只会让红点变成一个点不完的数字。
   *
   * ⚠️ 而且 `wished` 还要再滤一层「这件商品有没有开放价」——
   *    家长定完价那条单子**仍然是 `wished`**（等孩子来换），只按状态算的话
   *    红点永远消不掉。判据在 `wishesAwaitingReply` 里。
   */
  const wishOrders = useApp((s) => s.wishOrders)
  const wishOffers = useApp((s) => s.wishOffers)
  const pendingReview = useMemo(
    () =>
      selectPendingReview(useApp.getState()).length +
      selectPendingCheckIns(useApp.getState()).length +
      wishesAwaitingReply(wishOrders, wishOffers).length,
    [instances, checkInProgress, wishOrders, wishOffers],
  )

  /**
   * 底部导航的全部五格：把「游戏」那一格插在「任务」和「兑换」之间。
   *
   * 2026-10-28 从四格变五格（加了「心愿」）。底栏是 `flex-1` + `justify-center`，
   * 不是固定列宽，所以加一格只是每格变窄（390px 上 97 → 78px），
   * **不需要改布局代码**。但所有「按第几个 tab」定位的测试都要复查。
   *
   * 游戏格是**运行时算**的 —— 图标、名字、`data-tour` 全都来自当前游戏。
   * 农场是首款且默认拥有，所以默认状态下这一格就是原来的「🌾 农场 / tab-farm」，
   * 观感和锚点零变化。
   *
   * ★ 下载来的游戏用 **`tabLabel`**，不是 `name`（2026-10-22 补）。
   *
   * 契约里 `tabLabel` 是「底部导航上的文字，≤5 字」（2026-10-26 从 3 放宽），`check-plugin.mjs` 也在卡这个
   * 上限 —— 但这里原来读的是 `activePlugin.name`，于是那个字段**从来没被用过**：
   * 「抓奖乐园」（4 字）直接上了导航格，而它自己的 `tabLabel` 是「抓奖」。
   * 一个被校验、被写进文档、却没人读的字段，比没有这个字段更糟 ——
   * 插件作者会按 3 个字去起名，然后发现宿主根本不在乎。
   */
  /**
   * 心愿页说「去兑换换」→ 切到兑换那一格。
   *
   * 为什么走 store 而不是回调：`tab` 是**本组件的 `useState`**，
   * 心愿页拿不到 `setTab`。这个项目里跨页传数据的唯一通道就是 store
   * （`MEMORY.md` 第一节第 4 条，同一套做法见 `pendingPrompt`）。
   *
   * 真正「滚到哪一行」由 `RedeemBody` 挂载时自己 `takePendingRedeemItem()`
   * 取走 —— 本组件只负责把那一格切过去。
   */
  const pendingRedeemItem = useApp((s) => s.pendingRedeemItem)
  useEffect(() => {
    if (pendingRedeemItem) setTab('redeem')
  }, [pendingRedeemItem])

  const tabs = useMemo(
    () => [
      STATIC_TABS[0],
      {
        key: 'game' as const,
        label: activeGame?.name ?? activePlugin?.tabLabel ?? activePlugin?.name ?? '游戏',
        emoji: activeGame?.emoji ?? activePlugin?.emoji ?? '🎮',
        tour: `tab-${activeGameId}`,
      },
      STATIC_TABS[1],
      STATIC_TABS[2],
      STATIC_TABS[3],
    ],
    [activeGame, activePlugin, activeGameId],
  )

  /**
   * 当前游戏的页面组件。
   *
   * 内置游戏的页面挂在 `games/pages.ts` 里（注册表是纯数据，不能 import UI ——
   * 见那边的注释）。`comingSoon` 的游戏拿不到页面，所以正常走不到
   * 「切过去了但没有页面」那种情况。
   *
   * **下载来的游戏拿不到 `GamePage`**（它不在注册表里）—— 那种情况交给
   * `PluginGameHost` 按 `mount()` 契约装配。两条路都走不到才渲染空白。
   */
  const GamePage = pageFor(activeGame)

  // 启动：加载数据 + 补齐今日任务
  useEffect(() => {
    void boot()
  }, [boot])

  // 每分钟推进：跨日检测 + 动物产出
  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(() => void tick(), 60_000)
    return () => window.clearInterval(id)
  }, [ready, tick])

  // 原生状态下把状态栏调成浅色，和暖色背景协调
  useEffect(() => {
    if (!isNative()) return
    void (async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        await StatusBar.setStyle({ style: Style.Light })
        await StatusBar.setBackgroundColor({ color: '#FFFAF2' })
        const { SplashScreen } = await import('@capacitor/splash-screen')
        await SplashScreen.hide()
      } catch {
        /* 非原生环境忽略 */
      }
    })()
  }, [])

  // 从后台切回前台时刷新一次，避免显示过期数据
  useEffect(() => {
    if (!ready) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [ready, tick])

  // 数据好了 **并且** 入场页待够了才进主界面。
  // 这里是一次性的启动闸门（之前还没挂载任何子页面），所以可以整棵替换；
  // 进了主界面之后就再也不走这个分支了。
  if (!ready || !splashMinElapsed) return <SplashPage />

  return (
    <div className="relative flex min-h-screen flex-col">
      {showSettings ? (
        <SettingsPage onBack={() => setShowSettings(false)} onReplayGuide={replayGuide} />
      ) : (
        <>
          {/* 顶部状态条：两种币常驻可见，让孩子随时看到自己的收获。
              2026-10-03 平板适配：顶栏**通栏**（背景铺满整个宽度），
              内容再收进 `page-col`。原来顶栏和内容一起被 `max-w-2xl` 卡住，
              在 iPad 上会变成「中间悬着一条 672px 的横条」，两边各空一大块。
              同理，底部导航也改成通栏。 */}
          <header className="sticky top-0 z-30 border-b border-ink-900/10 bg-paper/95 backdrop-blur">
            {/* `pl-safe pr-safe` 是 calc(env(...) + 1rem)，正好等于原来的 px-4，
                但横屏刘海屏上会多让出安全区。横屏时刘海就在顶栏左右两端，
                所以这两个必须加在**顶栏**上（底栏在底部中间，够不到刘海）。 */}
            <div className="page-col flex items-center gap-1 py-2.5 pl-safe pr-safe pt-safe">
              <span className="text-2xl">{settings.avatar}</span>
              {/* `data-child-name` 是给 e2e-check 定位用的。
                  原来是 `header.children[1]` —— 平板适配给顶栏加了一层
                  `page-col` 包裹之后这个下标就失效了（量出来 -1，断言假失败）。
                  换成属性定位，以后再怎么调结构都不会断。 */}
              <span
                data-child-name
                className="mr-auto truncate font-display text-lg font-extrabold text-ink-900"
              >
                {settings.childName}
              </span>
              {/*
                三个币种并排。**图标和底色必须能区分开**：
                  💎 钻石   = 天空色（sky），只用来买游戏（现在没有标价的游戏，余额是历史/赠送）
                  🪙 积分   = 奖励色（sun），能买种子/幼崽/地块，也能进兑换商城
                  🎫 兑换券 = 草色（grass），只能进兑换商城的丰收档，买不了农场投入
                用农场页同一个色（bg-grass-100 / text-grass-700），
                孩子从农场切到任务页时不会觉得是两个东西。

                ⚠️ 2026-10-28 加 💎 之后这一行是**全局最挤的一行**：
                  头像 + 名字 + 三颗币 + 两个按钮。名字那个 span 靠
                  `min-w-0 truncate` 收缩（少一个都不行），三颗币一律
                  `shrink-0` —— 让币去挤名字，不要反过来把币挤成半颗。

                  加完实测 390px 下名字被压成「宝…」（只剩 40px），所以三颗币
                  统一收成 `px-1.5` + `text-sm`、外层 gap 收到 1：省出约 35px
                  给名字。**再往里加第四颗币之前先量一遍** ——
                  这一行的余量已经用完了。
              */}
              <div
                className="flex shrink-0 items-center gap-1 rounded-full bg-sky-200 px-1.5 py-1.5 shadow-flat"
                aria-label={`钻石 ${mallBalance}`}
              >
                <span className="text-sm leading-none">{CURRENCY.mall.emoji}</span>
                <span className="tnum font-display text-sm font-extrabold leading-none text-ink-900">
                  {mallBalance}
                </span>
              </div>
              <div
                className="flex shrink-0 items-center gap-1 rounded-full bg-sun-200 px-1.5 py-1.5 shadow-flat"
                aria-label={`积分 ${balance}`}
              >
                <span className="text-sm leading-none">🪙</span>
                <span className="tnum font-display text-sm font-extrabold leading-none text-ink-900">
                  {balance}
                </span>
              </div>
              {/*
                兑换券**所有游戏都显示**（2026-10-24 改）。

                原来这里写着「兑换券是农场这一款游戏的币，只有当前游戏是农场时才渲染」——
                那是**旧口径**，从 HOST_API 4 起就不成立了：插件的 `mintVoucher` 走的是
                同一个 `postHarvest` → `db.harvestLedger`，和内置农场卖菜、娃娃机兑奖
                **是同一张账本**（`harvestBalance` 就是它的 delta 之和）。
                所以兑换券是 App 级的，不是某一款游戏的。

                这条也是「插件 HUD 别重复画宿主已有的币种」的另一半：
                宿主在这里把 🎫 画全，插件里就不用再画一枚
                （云边小农场 2026-10-24 已经把它从自己的顶栏删掉了）。
              */}
              <div
                className="flex shrink-0 items-center gap-1 rounded-full bg-grass-100 px-1.5 py-1.5 shadow-flat"
                aria-label={`兑换券 ${harvestBalance}`}
              >
                <span className="text-sm leading-none">🎫</span>
                <span className="tnum font-display text-sm font-extrabold leading-none text-grass-700">
                  {harvestBalance}
                </span>
              </div>
              {/* 家长确认：放在设置旁边，和「家长相关」的事聚在一起。
                  尺寸从 40 提到 44 —— 44 是触控目标的下限，
                  这两个按钮孩子也会点（👀 能看自己交了什么）。 */}
              <button
                onClick={() => setReviewOpen(true)}
                aria-label={pendingReview > 0 ? `家长确认，有 ${pendingReview} 个待办` : '家长确认'}
                /* 导览最后两步要讲这个按钮（见 ChildTour 的 STEPS），同样靠属性定位 */
                data-tour="header-review"
                className={
                  'btn active:btn-press relative flex h-11 w-11 items-center justify-center rounded-full text-xl shadow-flat ' +
                  (pendingReview > 0 ? 'bg-sun-300' : 'bg-white')
                }
              >
                👀
                {pendingReview > 0 && (
                  <span className="tnum anim-pop absolute -right-1 -top-1 grid min-w-[20px] place-items-center rounded-full border border-white bg-berry-500 px-1 text-[10px] font-extrabold leading-tight text-white">
                    {pendingReview}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowSettings(true)}
                aria-label="设置"
                data-tour="header-settings"
                className="btn flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl shadow-flat active:btn-press"
              >
                ⚙️
              </button>
            </div>
          </header>

          {/*
            「现在连不上服务器」的横幅。**放在 header 和 main 之间**：
            它是全局状态，不属于任何一个 tab —— 挂在某个页面里的话，
            孩子切到别的页面就看不到，正好在那一刻误以为数据是新的。
          */}
          <SyncBanner />

          <main key={tab} className="flex flex-1 flex-col anim-fade-in">
            <ErrorBoundary resetKey={tab}>
              {tab === 'tasks' && <TaskPage />}
              {/*
                游戏那一格可能拿到 `React.lazy` 的页面（娃娃机带 three.js，
                拆成了独立 chunk —— 见 `games/pages.ts` 的注释）。
                `Suspense` 是**必须的**：lazy 组件在 chunk 到位之前会挂起，
                没有它整棵树会抛出去。

                fallback 是一句很轻的「在准备」而不是转圈动画 ——
                这一格绝大多数时候是**瞬开**（农场是静态 import），
                转圈反而会闪一下；只有第一次切到娃娃机时才看得到这句。
              */}
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center p-6">
                    <p className="text-sm text-ink-500">正在准备游戏…</p>
                  </div>
                }
              >
                {/*
                  游戏那一格包一层 `GamePlayGate` —— 家长设了「每天玩多久」时，
                  玩满就把游戏换成一句「今天玩完了」。**没设时它原样放行**
                  （渲染 `children` 本身，不多一层 div，游戏页量容器高度不受影响）。
                */}
                {tab === 'game' && (
                  <GamePlayGate>
                    {GamePage ? (
                      <GamePage />
                    ) : activePlugin ? (
                      <PluginGameHost gameId={activeGameId} />
                    ) : null}
                  </GamePlayGate>
                )}
              </Suspense>
              {tab === 'redeem' && <RedeemPage />}
              {tab === 'wish' && <WishPage />}
              {tab === 'points' && <PointsPage />}
            </ErrorBoundary>
          </main>

          {/* 底部导航：同样通栏 + `page-col` 收内容（理由见顶栏注释）。
              底栏保留在底部而不是改成侧边栏 —— 孩子两手握平板时，
              拇指够得着底边，够不着侧边中段。 */}
          <nav className="sticky bottom-0 z-30 border-t border-ink-900/10 bg-paper/95 backdrop-blur">
            <div className="page-col flex items-stretch justify-center gap-1 px-2 py-2 pb-safe">
              {tabs.map((t) => {
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    /* 新手导览靠这个属性定位，不靠「第几个 button」（见 ChildTour 注释） */
                    data-tour={t.tour}
                    className={
                      /* `max-w-[7.5rem]`：不加上限的话，tab 在平板上会被 flex-1
                         拉到 192~256px 宽，选中态那个圆角药丸会胖成一条。
                         120px 大致等于手机上的观感（390/4 ≈ 97），
                         配合外层的 justify-center，宽屏上就是一条居中的底栏。 */
                      'btn flex max-w-[7.5rem] flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 ' +
                      (active
                        ? 'bg-sun-300 shadow-flat'
                        : 'bg-transparent text-ink-500')
                    }
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={'text-2xl ' + (active ? 'anim-pop' : '')}>{t.emoji}</span>
                    <span className="text-xs font-extrabold">{t.label}</span>
                  </button>
                )
              })}
            </div>
          </nav>
        </>
      )}

      {/* 家长确认弹层：挂在最外层，切 Tab / 进设置都不影响它 */}
      <ReviewSheetModal open={reviewOpen} onClose={() => setReviewOpen(false)} />

      {/* 新手引导。**盖在主界面之上**而不是替换主界面 ——
          这样切外观不需要另起一棵树（子页面不会被重挂载，`tab` 这些状态还在），
          而且导览本来就必须能量到主界面里那排 tab 的位置。
          两个组件内部都 Portal 到 body（项目硬约束，见 components/Portal.tsx）。 */}
      {wizardMode && (
        <SetupWizard replay={wizardMode === 'replay'} onFinish={finishWizard} />
      )}
      {tourOpen && <ChildTour onFinish={finishTour} onStepChange={setTab} />}

      {/* 在线版的登录闸门。盖在主界面之上（自己 Portal 到 body），
          登录成功只是把覆盖层摘掉，底下这棵树不重建。 */}
      <OnlineLoginGate />

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

/* ---------------- Toast ---------------- */

function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: { id: string; kind: string; title: string; detail?: string; emoji?: string }[]
  onDismiss: (id: string) => void
}) {
  const tone: Record<string, string> = {
    success: 'bg-grass-300',
    reward: 'bg-sun-300',
    info: 'bg-sky-200',
    warn: 'bg-berry-200',
  }
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={
            'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border-3 border-ink-900/10 px-4 py-3 text-left shadow-float anim-bounce-in ' +
            (tone[t.kind] ?? 'bg-white')
          }
        >
          <span className="text-2xl">{t.emoji ?? '✨'}</span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-base font-extrabold text-ink-900">
              {t.title}
            </span>
            {t.detail && (
              <span className="block truncate text-sm text-ink-700">{t.detail}</span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
