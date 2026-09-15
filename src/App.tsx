import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { selectPendingCheckIns, selectPendingReview, useApp } from './store/useApp'
import TaskPage from './features/tasks/TaskPage'
import PointsPage from './features/tasks/PointsPage'
import FarmPage from './features/farm/FarmPage'
import RedeemPage from './features/redeem/RedeemPage'
import SettingsPage from './features/settings/SettingsPage'
import { ReviewSheetModal } from './features/parent/ReviewSheet'
import { SplashPage } from './features/splash/SplashPage'
import { SetupWizard } from './features/onboarding/SetupWizard'
import { ChildTour } from './features/onboarding/ChildTour'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isNative, playTone } from './platform/files'
import './features/farm/farm.css'

type TabKey = 'tasks' | 'farm' | 'redeem' | 'points'

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'tasks', label: '任务', emoji: '📋' },
  { key: 'farm', label: '农场', emoji: '🌾' },
  { key: 'redeem', label: '兑换', emoji: '🎁' },
  { key: 'points', label: '积分', emoji: '🪙' },
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
  /** 丰收币：农场产出的结算币。和积分是两套账，见 store 里 postHarvest 的注释。 */
  const harvestBalance = useApp((s) => s.harvestBalance)
  const toasts = useApp((s) => s.toasts)
  const dismissToast = useApp((s) => s.dismissToast)
  const boot = useApp((s) => s.boot)
  const tick = useApp((s) => s.tick)
  const settings = useApp((s) => s.settings)

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
  const pendingReview = useMemo(
    () =>
      selectPendingReview(useApp.getState()).length +
      selectPendingCheckIns(useApp.getState()).length,
    [instances, checkInProgress],
  )

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
    <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col">
      {showSettings ? (
        <SettingsPage onBack={() => setShowSettings(false)} onReplayGuide={replayGuide} />
      ) : (
        <>
          {/* 顶部状态条：两种币常驻可见，让孩子随时看到自己的收获 */}
          <header className="sticky top-0 z-30 flex items-center gap-1.5 border-b border-ink-900/10 bg-paper/95 px-4 py-2.5 backdrop-blur pt-safe">
            <span className="text-2xl">{settings.avatar}</span>
            <span className="mr-auto truncate font-display text-lg font-extrabold text-ink-900">
              {settings.childName}
            </span>
            {/*
              两个币种并排。**图标和底色必须能区分开**：
                🪙 积分 = 奖励色（sun），能买种子/幼崽/地块，也能进兑换商城
                🌾 丰收币 = 草色（grass），只能进兑换商城的丰收档，买不了农场投入
              用农场页同一个色（bg-grass-100 / text-grass-700），
              孩子从农场切到任务页时不会觉得是两个东西。
            */}
            <div
              className="flex shrink-0 items-center gap-1 rounded-full bg-sun-200 px-2.5 py-1.5 shadow-flat"
              aria-label={`积分 ${balance}`}
            >
              <span className="text-base leading-none">🪙</span>
              <span className="tnum font-display text-base font-extrabold leading-none text-ink-900">
                {balance}
              </span>
            </div>
            <div
              className="flex shrink-0 items-center gap-1 rounded-full bg-grass-100 px-2.5 py-1.5 shadow-flat"
              aria-label={`丰收币 ${harvestBalance}`}
            >
              <span className="text-base leading-none">🌾</span>
              <span className="tnum font-display text-base font-extrabold leading-none text-grass-700">
                {harvestBalance}
              </span>
            </div>
            {/* 家长确认：放在设置旁边，和「家长相关」的事聚在一起 */}
            <button
              onClick={() => setReviewOpen(true)}
              aria-label={pendingReview > 0 ? `家长确认，有 ${pendingReview} 个待办` : '家长确认'}
              className={
                'btn active:btn-press relative flex h-10 w-10 items-center justify-center rounded-full text-xl shadow-flat ' +
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
              className="btn flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-flat active:btn-press"
            >
              ⚙️
            </button>
          </header>

          <main key={tab} className="flex flex-1 flex-col anim-fade-in">
            <ErrorBoundary resetKey={tab}>
              {tab === 'tasks' && <TaskPage />}
              {tab === 'farm' && <FarmPage />}
              {tab === 'redeem' && <RedeemPage />}
              {tab === 'points' && <PointsPage />}
            </ErrorBoundary>
          </main>

          {/* 底部导航 */}
          <nav className="sticky bottom-0 z-30 border-t border-ink-900/10 bg-paper/95 pb-safe backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-stretch gap-1 px-2 py-2">
              {TABS.map((t) => {
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    /* 新手导览靠这个属性定位，不靠「第几个 button」（见 ChildTour 注释） */
                    data-tour={`tab-${t.key}`}
                    className={
                      'btn flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 ' +
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
