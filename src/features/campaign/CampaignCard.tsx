import { useMemo, useState } from 'react'
import clsx from 'clsx'
import {
  CAMPAIGN_METRIC_META,
  campaignProgressText,
  type CampaignStepView,
} from '@/domain/campaign'
import { gameById } from '@/games/registry'
import { localGameById } from '@/games/localGames'
import { useApp } from '@/store/useApp'
import { campaignStatsFrom, campaignViews, campaignSummary, spotlightStep } from '@/domain/campaign'
import { Sheet, SheetHead } from '@/features/tasks/ui'

/* ============================================================
   主线活动卡片（任务页顶部）
   ------------------------------------------------------------
   用户 2026-11-12：「添加活动模块，完成 5 个任务免费激活下落的2048，
   兑换券满 100 激活云边小农场，类似主线任务。」

   摆位：**任务页顶部、今日进度下面**。不占底栏第五格 ——
   四格是 2026-11-05 家长拍板的（`App.tsx` 的 STATIC_TABS 注释里有理由），
   而活动是「长期目标」，本来就该挨着任务列表看。

   ## ★★ 2026-11-13 改成「低调小气泡」

   用户：「主线任务 应该 有个 **不明显**的气泡，点开有小窗口显示任务和进度，奖励。」

   原来是一张 **144px 高的大卡片**，占了首屏相当一块，每天第一眼就看到它 ——
   而主线是长期目标，不需要天天盯着。改成一条 **约 34px 的气泡**：
   只露「🏁 主线 · 3/5 · 还差 2 个任务 · 1/4 ›」，点一下才弹小窗口看全部。

   ⚠️ 「不明显」≠「藏起来」：气泡必须**看得见、点得到**，
     而且**可领取时要变样**（🏁 → 🎁 + 暖色）—— 否则孩子永远发现不了
     自己有一份奖励没领。这是"低调"和"没法用"的界线。

   ★ 保留外壳是 `<section>` 而不是直接把 `<button>` 挂在 `data-tour` 上：
     `e2e-check.mjs` 有一条断言「卡片本身不是 button 且内含按钮」
     （防按钮套按钮）。改成 button 会让那条假红，而它的本意仍然成立。

   ★ 卡片是 `div` 不是 `button`：里面还要放「领取」按钮，
     按钮套按钮会被 HTML 解析器提前闭合外层（`WishRedeemRow` 踩过）。
     所以两颗按钮都显式写出来，卡片本身不整块可点。

   ⚠️ 数据用 `selectCampaign`（store 里的选择器），但**不**直接
     `useApp(selectCampaign)` —— 它每次返回新对象，zustand 按引用比较，
     会一直重渲染。这里订阅两个原始切片，在 `useMemo` 里自己算。
   ============================================================ */

export function CampaignCard() {
  const instances = useApp((s) => s.instances)
  const harvestLedger = useApp((s) => s.harvestLedger)
  const claims = useApp((s) => s.campaignClaims)
  /* 在线版由服务端算进度：本地流水只拉了 2000 条上限，
     老账号会算少 ⇒ 界面卡在「还差 N」而服务端点不到按钮。 */
  const serverStats = useApp((s) => s.campaignServerStats)
  const claim = useApp((s) => s.claimCampaignStep)
  const pushToast = useApp((s) => s.pushToast)

  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const view = useMemo(() => {
    const stats = serverStats ?? campaignStatsFrom(instances, harvestLedger)
    const views = campaignViews(stats, claims)
    return { views, ...campaignSummary(views), spotlight: spotlightStep(views) }
  }, [instances, harvestLedger, claims, serverStats])

  // 全领完了就不占地方：任务页是孩子每天第一眼看到的东西，
  // 一条「没有下一步」的卡片只会把任务列表往下推
  if (!view.spotlight) return null

  const step = view.spotlight

  const doClaim = async (id: string) => {
    if (busy) return
    setBusy(id)
    try {
      const r = await claim(id)
      pushToast({
        kind: r.ok ? 'reward' : 'warn',
        title: r.ok ? '领取成功' : '还没领到',
        detail: r.message,
        emoji: r.ok ? '🎁' : '⚠️',
      })
    } finally {
      setBusy(null)
    }
  }

  const ready = step.state === 'ready'

  return (
    <>
      {/*
        外壳保留 `<section>`（不是 button）—— 见文件头最后那段：
        e2e 有一条「卡片本身不是 button」的断言，它的本意仍然成立。

        `mt-3` 保留：气泡还挨着「今日进度」看，只是矮了 110px。
      */}
      <section data-tour="campaign-card" className="mt-3">
        {/*
          一颗气泡：**低调但完整**。
          · 底色 `bg-white/75` + 细边（不用原来的 sun-50 渐变大卡，太抢眼）
          · 很矮（`py-1.5` + 34px 最小高度），点按区域够大但不占版面
          · 可领取时整体转暖（`bg-sun-100` + 🌟），这是**唯一**允许它显眼的时刻
        */}
        <button
          type="button"
          data-campaign-open
          onClick={() => setOpen(true)}
          aria-label={`主线任务：${campaignProgressText(step)}，点开看全部 ${view.total} 关`}
          className={clsx(
            'btn active:btn-press flex w-full items-center gap-1.5 rounded-pill border px-3 py-1.5 text-left',
            ready
              ? 'border-sun-300 bg-sun-100/90'
              : 'border-ink-900/8 bg-white/75 hover:bg-white',
          )}
        >
          <span aria-hidden className="text-[13px] leading-none">
            {ready ? '🎁' : '🏁'}
          </span>
          <span
            className={clsx(
              // mr-1 代替单独一颗「·」—— 那颗会把气泡撑高 7px（31→38）
              'mr-1 shrink-0 text-[11px] font-extrabold',
              ready ? 'text-ink-800' : 'text-ink-500',
            )}
          >
            主线
          </span>
          {/*
            ★ 这一行**同时**是 e2e 的判据：它要求含「还差」和 `/`。
            保持 `have/need · 还差 N …` 的形状，别为了好看改成「差 2 个」。
          */}
          <span
            data-campaign-progress
            className={clsx(
              'min-w-0 truncate text-[11px] font-bold',
              ready ? 'text-ink-800' : 'text-ink-400',
            )}
          >
            {Math.min(step.have, step.need)}/{step.need} · {campaignProgressText(step)}
          </span>

          {/* 进度条只留一条**极细**的（气泡里放不下原来那条 8px 的） */}
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            <span
              aria-hidden
              className={clsx(
                'h-1 w-10 overflow-hidden rounded-pill',
                ready ? 'bg-white' : 'bg-ink-900/10',
              )}
            >
              <span
                className={clsx(
                  'block h-full rounded-pill',
                  ready ? 'bg-grass-400' : 'bg-sun-400',
                )}
                style={{ width: `${step.percent}%` }}
                data-campaign-bar={step.percent}
              />
            </span>
            <span className="text-[10px] font-bold text-ink-400">
              {view.claimed}/{view.total} ›
            </span>
          </span>
        </button>
      </section>

      <Sheet open={open} onClose={() => setOpen(false)} labelledBy="campaign-sheet-title">
        <SheetHead
          id="campaign-sheet-title"
          title="主线活动"
          emoji="🏁"
          sub={`已领 ${view.claimed}/${view.total} · 奖励是永久拥有的游戏`}
          onClose={() => setOpen(false)}
        />
        <div className="space-y-2.5 px-5 pb-6 pt-1">
          {view.views.map((v, i) => (
            <StepRow
              key={v.step.id}
              index={i + 1}
              view={v}
              busy={busy === v.step.id}
              onClaim={() => void doClaim(v.step.id)}
            />
          ))}

          {/* 口径写在这里，别只写在代码注释里 —— 家长会问「我花掉的券算不算」 */}
          <p className="rounded-2xl bg-sky-50 px-3.5 py-2.5 text-[11px] font-bold leading-relaxed text-sky-600">
            🔒 进度按<strong>累计</strong>算：花掉的兑换券不会让进度倒退。
            家长手工加的券不算「赚到」，所以刷不出来。
          </p>
        </div>
      </Sheet>
    </>
  )
}

/** 奖励那款游戏的显示名：目录真名优先，配置里的名字只是兜底 */
function rewardName(v: CampaignStepView): string {
  const id = v.step.reward.gameId
  return gameById(id)?.name ?? localGameById(id)?.name ?? v.step.reward.name
}

const STATE_CHIP: Record<CampaignStepView['state'], { text: string; cls: string }> = {
  claimed: { text: '已领取', cls: 'bg-grass-100 text-grass-700' },
  ready: { text: '可以领取', cls: 'bg-sun-200 text-ink-800' },
  doing: { text: '进行中', cls: 'bg-ink-100 text-ink-500' },
}

function StepRow({
  index,
  view,
  busy,
  onClaim,
}: {
  index: number
  view: CampaignStepView
  busy: boolean
  onClaim: () => void
}) {
  const chip = STATE_CHIP[view.state]
  const unit = CAMPAIGN_METRIC_META[view.step.goal.metric].unit

  return (
    <div
      data-campaign-step={view.step.id}
      data-campaign-state={view.state}
      className={clsx(
        'rounded-2xl border p-3',
        view.state === 'claimed'
          ? 'border-grass-200 bg-grass-50/60'
          : view.state === 'ready'
            ? 'border-sun-300 bg-white'
            : 'border-ink-200/70 bg-white',
      )}
    >
      <div className="flex items-center gap-2">
        <span aria-hidden className="text-base leading-none">
          {view.step.emoji}
        </span>
        <span className="text-[11px] font-extrabold text-ink-400">第 {index} 关</span>
        <span className={clsx('ml-auto rounded-pill px-2 py-0.5 text-[10px] font-extrabold', chip.cls)}>
          {chip.text}
        </span>
      </div>

      <div className="mt-1.5 text-sm font-extrabold text-ink-900">{view.step.title}</div>
      <div className="mt-0.5 text-[11px] font-bold text-ink-500">
        奖励：{rewardName(view)}（永久拥有）
      </div>

      <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-ink-100">
        <div
          className={clsx('h-full rounded-pill', view.state === 'claimed' ? 'bg-grass-400' : 'bg-sun-400')}
          style={{ width: `${view.percent}%` }}
        />
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[11px] font-bold text-ink-500">
          {Math.min(view.have, view.need)}/{view.need} {unit} · {campaignProgressText(view)}
        </span>
        {view.state === 'ready' && (
          <button
            type="button"
            data-campaign-claim={view.step.id}
            onClick={onClaim}
            disabled={busy}
            className="btn active:btn-press ml-auto rounded-pill bg-grass-400 px-3 py-1 text-[11px] font-extrabold text-white disabled:opacity-60"
          >
            {busy ? '领取中…' : '领取'}
          </button>
        )}
      </div>
    </div>
  )
}
