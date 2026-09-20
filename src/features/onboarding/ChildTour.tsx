import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { Portal } from '../../components/Portal'

/* ============================================================
   新手引导 · 第二步：功能导览（4 步给孩子 + 2 步给家长）
   ------------------------------------------------------------
   六步，遮罩压暗、把当前那一个元素挖亮。

   **为什么最后两步是给家长的**（2026-09-21 用户报「缺乏家长审核和家长设置的引导」）

   这个 App 的核心闭环是「孩子交上来 → 家长确认 → 积分到账」，
   但原来的导览只走了底部四个 tab —— 家长看完仍然不知道：

     · 孩子交上来的东西**在哪儿**确认（顶栏 👀）
     · 任务 / 规则 / 兑换**在哪儿**配（顶栏 ⚙️）

   结果是家长设完密码就卡住了：孩子交了一堆任务，没人知道要去点那个眼睛。
   所以补上这两步，并在气泡上打个「给家长」的小标。

   ⚠️ **这两步停在「任务」tab，不是随便选的。** 顶栏那两个按钮在哪个 tab 都
   可见，但背景停在任务页时，「孩子交上来的任务」正好在画面里，讲得通；
   停在积分页讲「去确认任务」就驴唇不对马嘴。

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
      ⚠️ 2026-09-21 起锚点名带上了**位置前缀**：底部 tab 是 `tab-xxx`，
      顶栏按钮是 `header-xxx`。所以 `anchor`（高亮谁）和 `tab`（停在哪个 tab）
      拆成了两个字段 —— 以前它们共用 `key`，一加顶栏目标就分不开了。
   5. **气泡要按目标位置翻面。** 高亮底部 tab 时气泡往上放；高亮**顶栏**按钮时
      必须往下放 —— 沿用「往上」的算法算出来的是 `bottom: 视口高 + 6`，
      气泡会被推出屏幕下沿。判据是「目标中心在不在视口上半」。
   ============================================================ */

export type TourTabKey = 'tasks' | 'farm' | 'redeem' | 'points'

interface TourStep {
  /** 气泡的稳定标识。e2e 靠它定位（别改成「第几个」） */
  id: string
  /** 高亮哪个元素：底部 tab 写 `tab-xxx`，顶栏按钮写 `header-xxx` */
  anchor: string
  /** 这一步停在哪个 tab */
  tab: TourTabKey
  /** 讲给谁听 —— 只影响气泡上那个小标，不影响行为 */
  audience: 'kid' | 'parent'
  emoji: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  {
    id: 'tasks',
    anchor: 'tab-tasks',
    tab: 'tasks',
    audience: 'kid',
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
    // 涨跌箭头、7 日走势图和「货一多价就跌」的提示。
    // ⚠️ 别写成「一次卖太多会砸盘、所以分批更划算」—— `sellQuote` 是线性的
    //    （现价 × 个数），那个差额恒为 0。2026-09-16 修过一次，见 `MarketSheet` 文件头。
    // 但孩子走完导览如果只知道「农场能种地」，那一课就没有引子，等于没有。
    // **别把这两句改回「买种子、种地、换丰收币」的纯操作说明。**
    id: 'farm',
    anchor: 'tab-farm',
    tab: 'farm',
    audience: 'kid',
    emoji: '🌾',
    title: '农场',
    body: '用积分买种子、种地、养小动物 —— 花出去的积分是投入，收成就是回报。可以当场卖，也可以存着等行情好再卖。',
  },
  {
    id: 'redeem',
    anchor: 'tab-redeem',
    tab: 'redeem',
    audience: 'kid',
    emoji: '🎁',
    title: '兑换',
    body: '攒够积分就来这里换想要的东西 —— 零食、出去玩、多玩一会儿平板都可以。',
  },
  {
    id: 'points',
    anchor: 'tab-points',
    tab: 'points',
    audience: 'kid',
    emoji: '🪙',
    title: '积分',
    body: '这里能看清积分是怎么来的，还有你攒到的成就徽章。上面那一条随时显示你有多少分。',
  },
  {
    // ⚠️ 文案必须写出「交上来 ≠ 积分到账」这件事。孩子那一步（tasks）已经说了
    // 「等爸爸妈妈确认」，这里从家长视角把同一件事说圆 —— 家长最容易漏的就是
    // 这一步：孩子交完没反应，家长以为 App 坏了。
    id: 'review',
    anchor: 'header-review',
    tab: 'tasks',
    audience: 'parent',
    emoji: '👀',
    title: '家长确认',
    body: '宝贝点「我做完啦」只是交上来，积分还没到账。点这里输密码，看一下做得怎么样、打个分，积分才真正发出去。',
  },
  {
    // ⚠️ 只列「设置里真有的东西」，别把任务编辑算进来 —— 新建 / 编辑任务在
    // 「任务」页（TaskEditor 内部再拦一次密码），不在设置里。写错了家长会找不到。
    id: 'settings',
    anchor: 'header-settings',
    tab: 'tasks',
    audience: 'parent',
    emoji: '⚙️',
    title: '设置',
    body: '超时扣分、质量加分、连击奖励、兑换开关、数据备份都在这里。要加任务或改任务，回「任务」页点新建 / 编辑。',
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
    onStepChange(step.tab)
  }, [step.tab, onStepChange])

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${step.anchor}"]`)
    setRect(el ? el.getBoundingClientRect() : null)
  }, [step.anchor])

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

  /**
   * 气泡往哪边放。
   *
   * 高亮底部 tab 时往上放（气泡在目标上方）；高亮顶栏按钮时必须往下放 ——
   * 见文件头第 5 条：沿用「往上」那套算出来的是 `bottom: 视口高 + 6`，
   * 气泡会被推出屏幕下沿。
   * 判据用「目标中心在不在视口上半」，比「是不是顶栏」更稳（将来加别的目标也对）。
   */
  const bubbleBelow = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : true

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

      {/* 3) 气泡：贴在挖出来的那个洞旁边（上下按 bubbleBelow 翻面） */}
      <div
        className="fixed z-[62] px-4"
        /* e2e 靠这两个属性定位，不靠「第几个 div」（同上，别用顺序假设） */
        data-tour-bubble={step.id}
        data-tour-side={bubbleBelow ? 'below' : 'above'}
        role="dialog"
        aria-label={`功能导览：${step.title}`}
        style={
          bubbleBelow
            ? { left: 0, right: 0, top: rect ? rect.bottom + 16 : 120 }
            : { left: 0, right: 0, bottom: rect ? window.innerHeight - rect.top + 16 : 120 }
        }
      >
        <div className="surface anim-bounce-in mx-auto max-w-sm border border-ink-900/10 bg-white p-4 shadow-float">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sun-200 text-2xl">
              {step.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-display text-base font-extrabold text-ink-900">
                  {step.title}
                </p>
                {/* 让拿手机的那个人一眼看出「这一步该我看」 */}
                {step.audience === 'parent' && (
                  <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-extrabold text-sky-700">
                    给家长
                  </span>
                )}
              </div>
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
