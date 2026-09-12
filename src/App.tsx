import { useEffect, useMemo, useState } from 'react'
import { selectPendingReview, useApp } from './store/useApp'
import TaskPage from './features/tasks/TaskPage'
import PointsPage from './features/tasks/PointsPage'
import FarmPage from './features/farm/FarmPage'
import RedeemPage from './features/redeem/RedeemPage'
import SettingsPage from './features/settings/SettingsPage'
import { ReviewSheetModal } from './features/parent/ReviewSheet'
import { ErrorBoundary } from './components/ErrorBoundary'
import { isNative } from './platform/files'
import './features/farm/farm.css'

type TabKey = 'tasks' | 'farm' | 'redeem' | 'points'

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'tasks', label: '任务', emoji: '📋' },
  { key: 'farm', label: '农场', emoji: '🌾' },
  { key: 'redeem', label: '兑换', emoji: '🎁' },
  { key: 'points', label: '积分', emoji: '🪙' },
]

export default function App() {
  const ready = useApp((s) => s.ready)
  const balance = useApp((s) => s.balance)
  const toasts = useApp((s) => s.toasts)
  const dismissToast = useApp((s) => s.dismissToast)
  const boot = useApp((s) => s.boot)
  const tick = useApp((s) => s.tick)
  const settings = useApp((s) => s.settings)

  const [tab, setTab] = useState<TabKey>('tasks')
  const [showSettings, setShowSettings] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  // 待审核数量 —— 订阅 instances，数据一变就重算，红点才不会卡住
  const instances = useApp((s) => s.instances)
  const pendingReview = useMemo(
    () => selectPendingReview(useApp.getState()).length,
    [instances],
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

  if (!ready) return <Splash />

  return (
    <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col">
      {showSettings ? (
        <SettingsPage onBack={() => setShowSettings(false)} />
      ) : (
        <>
          {/* 顶部状态条：积分常驻可见，让孩子随时看到自己的收获 */}
          <header className="sticky top-0 z-30 flex items-center gap-2 border-b-4 border-ink-900/10 bg-paper/95 px-4 py-2.5 backdrop-blur pt-safe">
            <span className="text-2xl">{settings.avatar}</span>
            <span className="mr-auto truncate font-display text-lg font-extrabold text-ink-900">
              {settings.childName}
            </span>
            <div className="flex items-center gap-1.5 rounded-full bg-sun-200 px-3 py-1.5 shadow-cartoon-sm">
              <span className="text-lg">🪙</span>
              <span className="tnum font-display text-lg font-extrabold text-ink-900">
                {balance}
              </span>
            </div>
            {/* 家长确认：放在设置旁边，和「家长相关」的事聚在一起 */}
            <button
              onClick={() => setReviewOpen(true)}
              aria-label={pendingReview > 0 ? `家长确认，有 ${pendingReview} 个待办` : '家长确认'}
              className={
                'btn-3d active:btn-3d-press relative flex h-10 w-10 items-center justify-center rounded-full text-xl shadow-cartoon-sm ' +
                (pendingReview > 0 ? 'bg-sun-300' : 'bg-white')
              }
            >
              👀
              {pendingReview > 0 && (
                <span className="tnum anim-pop absolute -right-1 -top-1 grid min-w-[20px] place-items-center rounded-full border-2 border-white bg-berry-500 px-1 text-[10px] font-extrabold leading-tight text-white">
                  {pendingReview}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowSettings(true)}
              aria-label="设置"
              className="btn-3d flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-cartoon-sm active:btn-3d-press"
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
          <nav className="sticky bottom-0 z-30 border-t-4 border-ink-900/10 bg-paper/95 pb-safe backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-stretch gap-1 px-2 py-2">
              {TABS.map((t) => {
                const active = tab === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={
                      'btn-3d flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 ' +
                      (active
                        ? 'bg-sun-300 shadow-cartoon-sm'
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

      <ToastHost toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

/* ---------------- 启动闪屏 ---------------- */

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-paper">
      <div className="text-7xl anim-float">🌾</div>
      <div className="font-display text-3xl font-extrabold text-ink-900 anim-bounce-in">
        小任务农场
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-3 w-3 rounded-full bg-grass-400 anim-sparkle"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
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
            'pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-3xl border-3 border-ink-900/10 px-4 py-3 text-left shadow-float anim-bounce-in ' +
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
