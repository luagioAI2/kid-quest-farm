import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Portal } from '../../components/Portal'
import { useApp } from '../../store/useApp'

/* ============================================================
   新手引导 · 第二步：功能导览（5 步给孩子 + 2 步给家长）
   ------------------------------------------------------------
   七步，遮罩压暗、把当前那一个元素挖亮。

   ## 2026-11-10 重做：底栏四格 + 游戏全屏 + 心愿
   （2026-11-11 游戏页改回「默认带外壳、可点右下角全屏」—— 本文件的结论不受影响，
     导览仍然停在任务页讲，理由见下面第 1 条）

   这一轮之前有三处**已经和真实界面脱节**，必须一起改：

   1. **「农场」那一步会把导览弄瘸。** 这一步原来 `tab: 'game'`，于是
      `[data-tour="tab-farm"]` 在那一刻不存在 → `measure()` 拿到 null →
      挖洞层是 `{rect && …}` → **整屏不压暗、气泡浮在中间、还被拦截层
      压着点不动**。孩子看到的是一张指不到任何东西的卡片。
      ⇒ 这一步改成**停在任务页、只高亮底栏那一格**，把「进去之后怎么放大、
        怎么出来」写进文案。`TourTabKey` 里也**删掉了 `'game'`** ——
        让「某一步把导览切进游戏」这件事在类型层面就写不出来。
      （2026-11-11 游戏页默认不再全屏了，但**这条结论不变**：导览切进游戏页
        依然会把底栏那几格的锚点弄没 —— 除非那天专门给游戏页做一步。）

   2. **底栏第 4 格是「心愿」，导览从来没讲过。** 心愿（2026-10-28）和
      兑换是两个东西：兑换是家里的事（家长自己加的商品、家长自己兑现），
      心愿是外面的事（合作商商品，成交在淘宝）。孩子最容易混的正是这两格，
      所以分成两步讲，且各自点明「谁的东西」。

   3. **「设置」那一步漏了游戏管理。** 现在「设置 → 游戏」是一张表，
      下载 / 更新 / 卸载都在行上（见 `GameStore.tsx`），家长最常问的就是
      「新游戏怎么装」。

   ## 为什么最后两步是给家长的（2026-09-21 用户报「缺乏家长审核和家长设置的引导」）

   这个 App 的核心闭环是「孩子交上来 → 家长确认 → 积分到账」，
   但原来的导览只走了底部 tab —— 家长看完仍然不知道：

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
   3. **位置要实时量，而且找不到要重试。** 高亮框按目标元素的
      `getBoundingClientRect()` 定位，并在 resize / scroll 时重算。但**只量一次
      是不够的**：切 tab 时底栏会重挂载，第一帧查不到目标，`rect` 就永远停在
      null（挖洞层是 `{rect && …}`），而「重新量」的时机 resize / scroll
      根本不会来 —— 症状和上面第 1 条一模一样。所以 `measure` 会短轮询，
      找到就停（见下面的 `useLayoutEffect`）。
   4. **点哪算哪，别猜。** 目标靠 `data-tour` 属性找（App.tsx 里挂着），
      不靠「第几个 button」这种顺序假设 —— 以后加一个 tab 就全错位了。
      ⚠️ 2026-09-21 起锚点名带上了**位置前缀**：底部 tab 是 `tab-xxx`，
      顶栏按钮是 `header-xxx`。所以 `anchor`（高亮谁）和 `tab`（停在哪个 tab）
      拆成了两个字段 —— 以前它们共用 `key`，一加顶栏目标就分不开了。
      ⚠️ 2026-11-10 起游戏那一格用**占位符** `tab-game`，运行时才解析成
      `tab-<当前游戏 id>` —— 底栏那一格的 `data-tour` 跟着当前游戏走，
      写死 `tab-farm` 的话孩子换成插件游戏之后这一步就消失了。
   5. **气泡要按目标位置翻面。** 高亮底部 tab 时气泡往上放；高亮**顶栏**按钮时
      必须往下放 —— 沿用「往上」的算法算出来的是 `bottom: 视口高 + 6`，
      气泡会被推出屏幕下沿。判据是「目标中心在不在视口上半」。
   ============================================================ */

/**
 * 导览过程中要切到哪一格。
 *
 * ⚠️ **没有 `'game'`。** 导览一旦切进游戏页，底栏那几格的 `data-tour` 锚点就
 * 量不到了（游戏页自己也会把底栏那几格挤走），导览会瘸 —— 见文件头第 1 条。
 * 这里把 `'game'` 从类型里去掉，是为了让「再写一个进游戏的步骤」编译就过不去。
 * （2026-11-11 游戏页默认不再全屏，但这条**不跟着放宽**：导览要指底栏，
 *   就得停在有底栏的页面上。）
 *
 * ⚠️ 2026-11-05 起也没有 `'points'`：底栏从五格回到四格，「积分」挪到
 * 顶栏那颗 🪙（`header-points`）。这一格在底栏不存在，写进来就会
 * `setTab('points')` 切到一页根本不渲染的空白 —— 而且不报错。
 */
export type TourTabKey = 'tasks' | 'redeem' | 'wish'

interface TourStep {
  /** 气泡的稳定标识。e2e 靠它定位（别改成「第几个」） */
  id: string
  /**
   * 高亮哪个元素：底部 tab 写 `tab-xxx`，顶栏按钮写 `header-xxx`。
   * 游戏那一格写占位符 `tab-game`，运行时解析成 `tab-<当前游戏 id>`。
   */
  anchor: string
  /** 这一步停在哪个 tab */
  tab: TourTabKey
  /** 讲给谁听 —— 只影响气泡上那个小标，不影响行为 */
  audience: 'kid' | 'parent'
  emoji: string
  title: string
  body: string
  /** 当前游戏真是农场时换用这段（只给「游戏」那一步用） */
  bodyWhenFarm?: string
}

/** 游戏那一格的占位锚点（见 TourStep.anchor 的注释） */
const GAME_TAB_ANCHOR = 'tab-game'

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
    // ⚠️ 这一步**不能**把 tab 切到 `'game'`，见文件头第 1 条 ——
    // 切进去以后 `[data-tour="tab-*"]` 那一格就量不到了（导览会瘸）。
    //
    // 文案 2026-11-11 跟着交互改：**进去不再全屏**了（顶栏底栏都在），
    // 想沉浸要自己点游戏右下角那枚「全屏」键；全屏之后左上角返回、右上角胶囊退出。
    // 别再写「进去是全屏的」—— 那句话会让孩子一进去就找「退出游戏」而找不到。
    //
    // 农场那段（`bodyWhenFarm`）留着原来的「投入 / 回报」口径 —— 那是家长
    // 要的「投资 / 市场意识」的引子，别改回纯操作说明。
    // ⚠️ 别写成「一次卖太多会砸盘」—— `sellQuote` 是线性的，差额恒为 0。
    id: 'game',
    anchor: GAME_TAB_ANCHOR,
    tab: 'tasks',
    audience: 'kid',
    emoji: '🎮',
    title: '游戏',
    body: '点这一格进游戏。想玩得更大，点画面右下角那颗「全屏」；玩完点左上角返回、或者右上角那颗胶囊就回来。',
    bodyWhenFarm:
      '点这一格进农场。画面右下角有颗「全屏」，想看得更清楚就点它；玩完点左上角返回、或者右上角胶囊就回来。用积分买种子、种地、养小动物 —— 花出去的积分是投入，收成就是回报。可以当场卖，也可以存着等行情好再卖。',
  },
  {
    // ⚠️ 兑换和心愿**必须分开讲**（见文件头第 2 条）：这两格长得像、
    // 语义完全不同，孩子混了会去兑换里找合作商的商品，找不到。
    // 「家里自己加的」这句是关键 —— 它一眼就把两格分开了。
    id: 'redeem',
    anchor: 'tab-redeem',
    tab: 'redeem',
    audience: 'kid',
    emoji: '🎁',
    title: '兑换',
    body: '家里商量好的奖励在这里换 —— 零食、出去玩、多玩一会儿平板，都是爸爸妈妈自己加的。',
  },
  {
    // 心愿 = 外面的事（合作商商品，成交在淘宝）。孩子「确定兑换」就真扣券，
    // 因为成交在 App 外面 —— 所以文案别写成「点了就等着收货」。
    id: 'wish',
    anchor: 'tab-wish',
    tab: 'wish',
    audience: 'kid',
    emoji: '🛍️',
    title: '心愿',
    /* ⚠️ 别写「攒够积分」：心愿的价可能是兑换券、也可能是积分，
       一句话点死一种币，孩子攒错了方向。 */
    body: '外面看到的、想要的东西在这里许愿。爸爸妈妈看到会定价，攒够了就能换；有些是他们直接买回来。',
  },
  {
    // ⚠️ 2026-11-05：底栏那格「积分」删掉了（用户：「下边栏 4 个为好」），
    // 明细改从**顶栏那颗 🪙** 点开。所以这一步的锚点从 `tab-points` 换成
    // `header-points`，`tab` 回到 `'tasks'`（顶栏每个 tab 都在，
    // 停在任务页讲最自然）。
    // 文案必须说「点上面这颗」，别写「下面那一格」—— 孩子会找不到。
    id: 'points',
    anchor: 'header-points',
    tab: 'tasks',
    audience: 'kid',
    emoji: '🪙',
    title: '积分',
    body: '点上面这颗 🪙，就能看清积分是怎么来的，还有你攒到的成就徽章。',
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
    // ⚠️ 2026-11-10 补上「设置 → 游戏」：游戏下载 / 更新 / 卸载现在是一张表
    // 的行内操作（`GameStore.tsx`），家长问得最多的就是「新游戏怎么装」。
    id: 'settings',
    anchor: 'header-settings',
    tab: 'tasks',
    audience: 'parent',
    emoji: '⚙️',
    title: '设置',
    body: '超时扣分、质量加分、连击奖励、兑换开关、数据备份都在这里。游戏也在「设置 → 游戏」里下载、更新、卸载。要加任务或改任务，回「任务」页点新建 / 编辑。',
  },
]

/** 把占位锚点解析成真实的 `data-tour` 值 */
function anchorOf(anchor: string, activeGameId: string): string {
  return anchor === GAME_TAB_ANCHOR ? `tab-${activeGameId || 'farm'}` : anchor
}

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

  /*
    游戏那一格的名字 / 图标跟着当前游戏走（App.tsx），锚点也是。
    `activeGameId` 在 store 里已经被 `resolveActiveGame()` 兜过底，
    这里再 `|| 'farm'` 只是防「存档还没读出来」的那一瞬。
  */
  const activeGameId = useApp((s) => s.activeGameId)
  const steps = STEPS
  // 导览开着的时候当前游戏被改掉（两个标签页）⇒ 锚点跟着变，别越界
  const step = steps[Math.min(i, steps.length - 1)]

  // 切步骤 → 同步切 tab（孩子看到的是「点开这个 tab 会看到什么」）
  useEffect(() => {
    onStepChange(step.tab)
  }, [step.tab, onStepChange])

  /**
   * 「上一次量到没有目标」。
   *
   * ⚠️ 只为**少写一次 state**：轮询重试时每 60ms 都会 `measure()` 一遍，
   * 目标不存在就把 `null` 再 `setRect(null)` 一次 —— 值没变，但 React 照样
   * 调度一次更新，在单测里就是满屏的 `not wrapped in act(...)` 警告。
   * 加了这个 ref，`null → null` 直接不写；找到目标时照常每次都写
   * （滚动 / 重排要靠它更新位置）。
   */
  const hadTargetRef = useRef<boolean | null>(null)

  const measure = useCallback(() => {
    const el = document.querySelector(`[data-tour="${anchorOf(step.anchor, activeGameId)}"]`)
    const found = !!el
    if (found || hadTargetRef.current !== found) {
      hadTargetRef.current = found
      setRect(found ? el!.getBoundingClientRect() : null)
    }
    return found
  }, [step.anchor, activeGameId])

  /*
    布局阶段就量，避免第一帧高亮框停在左上角再跳过去。

    ⚠️ **量不到必须重试**（2026-11-10 补）：切 tab 时底栏会重挂载，
    第一帧查不到目标 → `rect` 留在 null → 挖洞层 `{rect && …}` 整个不渲染，
    而「重新量」的时机只有 resize / scroll，导览过程中根本不会来。
    实测症状：从全屏游戏切回任务页之后，后面每一步都**没有压暗**。
    轮询上限约 1.2 秒（20 × 60ms），找不到就按「目标不存在」处理（不压暗，
    但气泡照常可点），不会卡住。
  */
  useLayoutEffect(() => {
    if (measure()) return
    let n = 0
    const timer = window.setInterval(() => {
      if (measure() || ++n > 20) window.clearInterval(timer)
    }, 60)
    return () => window.clearInterval(timer)
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

  const last = i >= steps.length - 1

  /**
   * 气泡往哪边放。
   *
   * 高亮底部 tab 时往上放（气泡在目标上方）；高亮顶栏按钮时必须往下放 ——
   * 见文件头第 5 条：沿用「往上」那套算出来的是 `bottom: 视口高 + 6`，
   * 气泡会被推出屏幕下沿。
   * 判据用「目标中心在不在视口上半」，比「是不是顶栏」更稳（将来加别的目标也对）。
   */
  const bubbleBelow = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : true

  /**
   * 气泡的**水平位置**：跟着锚点走，再夹回视口内。
   *
   * ⚠️ 2026-10-03 平板适配。原来气泡是 `left:0; right:0` + 内部 `mx-auto max-w-sm`，
   * **恒定在视口正中**，完全不看锚点在哪儿。
   * 手机上 384px 的气泡几乎占满 390px 宽，居中 ≈ 对齐，看不出问题；
   * 但 iPad Pro 13" 横屏（1366px）实测：
   *
   *   · 讲底部第一个 tab —— 气泡中心 x=683、高亮框中心 x=497，偏 186px
   *   · 讲顶栏「设置」   —— 锚点 x≈1093，偏 **410px**
   *
   * 孩子看到的是「屏幕中间一张卡片，左下角/右上角一个亮框」，联系不起来。
   *
   * 夹取范围 `[16, vw - W - 16]` 就是原来 `px-4` 给的那条内边距，所以
   * **手机上两个边界相等**（390 − 358 − 16 = 16），算出来恒为 16 ——
   * 手机观感一个像素都不变，只是平板起开始跟随锚点。
   *
   * 只动水平方向：上下翻面（`bubbleBelow`）和「气泡不跑出屏幕」的
   * 断言都在 e2e-check 里锁着，不碰。
   */
  const GUTTER = 16 // 原 `px-4`
  const CARD_MAX = 384 // 原 `max-w-sm`
  const cardW = Math.min(CARD_MAX, window.innerWidth - GUTTER * 2)
  const cardLeft = rect
    ? Math.min(
        Math.max(rect.left + rect.width / 2 - cardW / 2, GUTTER),
        window.innerWidth - cardW - GUTTER,
      )
    : (window.innerWidth - cardW) / 2

  const body = step.bodyWhenFarm && (activeGameId || 'farm') === 'farm' ? step.bodyWhenFarm : step.body

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

      {/* 3) 气泡：贴在挖出来的那个洞旁边（上下按 bubbleBelow 翻面，水平跟随锚点） */}
      <div
        /* ⚠️ 这里**没有** `px-4` 了 —— 内边距已经折算进下面的 `left` / `width`
           （见 cardLeft 的注释）。两个一起写会让卡片再窄 32px，手机观感就变了。 */
        className="fixed z-[62]"
        /* e2e 靠这两个属性定位，不靠「第几个 div」（同上，别用顺序假设） */
        data-tour-bubble={step.id}
        data-tour-side={bubbleBelow ? 'below' : 'above'}
        data-tour-anchor={anchorOf(step.anchor, activeGameId)}
        role="dialog"
        aria-label={`功能导览：${step.title}`}
        style={{
          left: cardLeft,
          width: cardW,
          ...(bubbleBelow
            ? { top: rect ? rect.bottom + 16 : 120 }
            : { bottom: rect ? window.innerHeight - rect.top + 16 : 120 }),
        }}
      >
        {/* 宽度由外层给了，卡片自身不再 `mx-auto max-w-sm`（会和上面的 width 打架） */}
        <div className="surface anim-bounce-in border border-ink-900/10 bg-white p-4 shadow-float">
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
              <p className="mt-1 text-sm font-bold leading-relaxed text-ink-600">{body}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <span className="tnum mr-auto text-xs font-extrabold text-ink-500">
              {Math.min(i + 1, steps.length)} / {steps.length}
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
