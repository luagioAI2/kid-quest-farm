import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Portal } from '../../components/Portal'

/* ============================================================
   新手引导 · 第二步：给孩子的功能导览
   ------------------------------------------------------------
   四个 tab 各讲一句，遮罩压暗、把当前那个 tab 挖亮。

   实现要点（都踩过）：
   1. **整屏遮罩必须 Portal 到 body。** 页面外壳那层 `anim-fade-in` 带 opacity
      动画，浏览器会把它当成层叠上下文（隐式 will-change，`getComputedStyle`
      查不出来），里面的东西全被关进小盒子 —— 底部导航 z-30 会永远压在弹层上面，
      把 z-index 抬到 9999 也没用。见 components/Portal.tsx 顶部注释。
   2. **挖洞用 `box-shadow: 0 0 0 9999px`，不用四个遮罩块拼。** 一块定位元素 +
      巨大的外阴影，天然跟随圆角、不用算四条边的尺寸，也不会在圆角处露缝。
   3. **位置要实时量。** 高亮框按目标元素的 `getBoundingClientRect()` 定位，
      并在 resize / scroll 时重算 —— 手机横竖屏切换、页面滚动都会让它跑偏。
   4. **点哪算哪，别猜。** 目标靠 `data-tour` 属性找（App.tsx 里挂着），
      不靠「第几个 button」这种顺序假设 —— 以后加一个 tab 就全错位了。
   ============================================================ */

export type TourTabKey = 'tasks' | 'farm' | 'redeem' | 'points'

interface TourStep {
  key: TourTabKey
  emoji: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    key: 'tasks',
    emoji: '📋',
    title: '任务',
    body: '今天要做的事都在这里。做完点一下交上来，等爸爸妈妈确认，积分就到手啦。',
  },
  {
    // ⚠️ 这一步不能只讲「怎么操作」，还得把**农场的想法**讲出来：花积分买种子是投入、
    // 收成是回报，而回报能有多少，取决于你**什么时候卖**。
    //
    // 这是家长要的「投资 / 市场意识」的入口。完整的一课其实已经在别处了 ——
    // 收获时「当场卖 / 收进背包等好价」的二选一，加上市场里的行情指数、
    // 涨跌箭头、7 日走势图和「一次卖太多会砸盘」的提示。
    // 但孩子走完导览如果只知道「农场能种地」，那一课就没有引子，等于没有。
    // **别把这两句改回「买种子、种地、换丰收币」的纯操作说明。**
    key: 'farm',
    emoji: '🌾',
    title: '农场',
    body: '用积分买种子、种地、养小动物 —— 花出去的积分是投入，收成就是回报。可以当场卖，也可以存着等行情好再卖。',
  },
  {
    key: 'redeem',
    emoji: '🎁',
    title: '兑换',
    body: '攒够积分就来这里换想要的东西 —— 零食、出去玩、多玩一会儿平板都可以。',
  },
  {
    key: 'points',
    emoji: '🪙',
    title: '积分',
    body: '这里能看清积分是怎么来的，还有你攒到的成就徽章。上面那一条随时显示你有多少分。',
  },
]

export function ChildTour({
  onFinish,
  onStepChange,
}: {
  onFinish: () => void
  /** 切到第几步时同步切换底部 tab，让背后的页面跟着变 */
  onStepChange: (key: TourTabKey) => void
}) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = STEPS[i]

  // 切步骤 → 同步切 tab（孩子看到的是「点开这个 tab 会看到什么」）
  useEffect(() => {
    onStepChange(step.key)
  }, [step.key, onStepChange])

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="tab-${step.key}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step.key])

  // 布局阶段就量，避免第一帧高亮框停在左上角再跳过去
  useLayoutEffect(() => {
    measure()
  }, [measure])

  useEffect(() => {
    window.addEventListener('resize', measure)
    // capture=true：滚动可能发生在任意祖先容器里
    window.addEventListener('scroll', measure, true)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [measure])

  const last = i === STEPS.length - 1

  return (
    <Portal>
      {/* 1) 点击拦截层：导览期间不让孩子乱点（放在最底下，压住整屏） */}
      <div className="fixed inset-0 z-[60]" data-tour-root />

      {/* 2) 挖洞层：一块定位元素 + 巨大的外阴影，把四周压暗 */}
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[61] rounded-2xl transition-all duration-200"
          style={{
            left: rect.left - 8,
            top: rect.top - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            boxShadow: '0 0 0 9999px rgb(51 40 30 / 0.72)',
          }}
        />
      )}

      {/* 3) 气泡：贴着被高亮的那一条往上放 */}
      <div
        className="fixed z-[62] px-4"
        /* e2e 靠这两个属性定位，不靠「第几个 div」（同上，别用顺序假设） */
        data-tour-bubble={step.key}
        role="dialog"
        aria-label={`功能导览：${step.title}`}
        style={{
          left: 0,
          right: 0,
          bottom: rect ? window.innerHeight - rect.top + 16 : 120,
        }}
      >
        <div className="surface anim-bounce-in mx-auto max-w-sm border border-ink-900/10 bg-white p-4 shadow-float">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sun-200 text-2xl">
              {step.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-extrabold text-ink-900">{step.title}</p>
              <p className="mt-1 text-sm font-bold leading-relaxed text-ink-600">{step.body}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="tnum mr-auto text-xs font-extrabold text-ink-500">
              {i + 1} / {STEPS.length}
            </span>
            <button
              type="button"
              onClick={onFinish}
              className="btn rounded-2xl px-3 py-2 text-sm font-extrabold text-ink-500 active:btn-press"
            >
              跳过
            </button>
            <button
              type="button"
              onClick={() => (last ? onFinish() : setI((n) => n + 1))}
              className="btn rounded-2xl bg-gradient-to-b from-sun-300 to-sun-500 px-5 py-2 font-display text-sm font-extrabold text-ink-900 shadow-flat active:btn-press"
            >
              {last ? '知道啦' : '下一步'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
