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
import {
  Btn,
  Sheet,
  SheetHead,
} from '@/features/tasks/ui'

/* ============================================================
   主线活动卡片（任务页顶部）
   ------------------------------------------------------------
   用户 2026-11-12：「添加活动模块，完成 5 个任务免费激活下落的2048，
   兑换券满 100 激活云边小农场，类似主线任务。」

   摆位：**任务页顶部、今日进度下面**。不占底栏第五格 ——
   四格是 2026-11-05 家长拍板的（`App.tsx` 的 STATIC_TABS 注释里有理由），
   而活动是「长期目标」，本来就该挨着任务列表看。

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

  return (
    <>
      <section
        data-tour="campaign-card"
        className="surface mt-3 border border-sun-300 bg-gradient-to-br from-sun-50 to-paper p-3.5"
      >
        <div className="flex items-center gap-1.5">
          <span aria-hidden className="text-sm leading-none">
            🏁
          </span>
          <span className="text-xs font-extrabold text-ink-800">主线活动</span>
          <span className="ml-auto text-[11px] font-bold text-ink-500">
            已领 {view.claimed}/{view.total}
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          >
            {step.step.emoji}
          </span>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-extrabold text-ink-900">{step.step.title}</div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-pill bg-white">
              <div
                className={clsx(
                  'h-full rounded-pill transition-[width] duration-300',
                  step.state === 'ready' ? 'bg-grass-400' : 'bg-sun-400',
                )}
                style={{ width: `${step.percent}%` }}
                data-campaign-bar={step.percent}
              />
            </div>
            <div className="mt-1 text-[11px] font-bold text-ink-500" data-campaign-progress>
              {Math.min(step.have, step.need)}/{step.need} · {campaignProgressText(step)}
            </div>
          </div>

          {step.state === 'ready' ? (
            <Btn
              tone="grass"
              size="sm"
              onClick={() => void doClaim(step.step.id)}
              disabled={busy === step.step.id}
              ariaLabel={`领取 ${rewardName(step)}`}
            >
              {busy === step.step.id ? '领取中…' : '🎁 领取'}
            </Btn>
          ) : (
            <Btn tone="white" size="sm" onClick={() => setOpen(true)}>
              看进度
            </Btn>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[11px] font-bold text-ink-500">
            奖励：{rewardName(step)}
          </span>
          <button
            type="button"
            data-campaign-open
            onClick={() => setOpen(true)}
            className="btn active:btn-press shrink-0 rounded-pill px-2 py-1 text-[11px] font-extrabold text-sky-600"
          >
            全部 {view.total} 关 ›
          </button>
        </div>
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
