import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import { useAccount } from '@/store/useAccount'
import { ApiError } from '@/api/client'
import { applyMerchant, myMerchant } from '@/api/merchant'
import type { ApiMerchantApplication } from '@/api/types'
import type { MerchantRole } from '@/domain/types'
import { humanizeAgo } from '@/domain/time'
import { useApp } from '@/store/useApp'
import { LoginSheet } from '../account/LoginSheet'

/* ============================================================
   招商（2026-10-29，第三版：接真后端）
   ------------------------------------------------------------
   入口在**心愿商城右上角**（用户原话：「把兑换记录去掉换成招商按钮。
   点开 看到招商合作。不是在兑换/兑换记录里显示。」）

   两路，都是一键申请：
     · 家长 —— 把 App 分享给其他家长，别人用起来你拿分成
     · 商家 —— 自己把商品挂进心愿商城

   ## 数据源换成服务端（2026-10-29 晚）

   前一版把申请存在 `settings.merchantApps`（本地），因为那时没有后端。
   现在 `tf-platform-api` 有了 `/api/merchant/*`，所以：

     · 申请 → `POST /api/merchant/apply`（服务端按 `(uid, role)` upsert）
     · 我的 → `POST /api/merchant/my`（`admin_url` 只在 approved 时返回）

   **本地那份不再写**：两份状态一定会对不上，而「界面上写着审核中、
   后台其实已经通过了」这种不一致没人查得出来。

   ## 没有表单

   用户原话：「点申请即可。不需要填 称呼 这些。因为会根据当前账号，申请。」
   所以这里**只发一个 `role`**；`name` / `contact` 由服务端从账号取
   （客户端也没有明文手机号 —— 登录响应里是 `138****8000`）。

   ## 没有账号就没有申请

   招商天然是「要审核、要回填后台地址」的事，离线做不了。
   未登录时这一屏只做一件事：说清楚**为什么**要登录，并给一个登录按钮。
   别偷偷存到本地假装成功 —— 家长会以为申请已经发出去了。
   ============================================================ */

const ROLE_META: Record<
  MerchantRole,
  { title: string; emoji: string; pitch: string; bullets: string[] }
> = {
  parent: {
    title: '家长申请',
    emoji: '👤',
    pitch: '分享给其他家长，别人用起来你拿分成',
    bullets: [
      '把这个 App 分享给别的家长，他们用得上就好',
      '对方开始使用后，你按平台规则拿收益分成',
      '审核通过后，这里会出现一个后台链接，能看分享记录和分成',
    ],
  },
  merchant: {
    title: '商家申请',
    emoji: '🏪',
    pitch: '把自己的商品挂进心愿商城',
    bullets: [
      '自己上架商品、定参考价，孩子许愿、家长下单',
      '订单走 App 外的成交链接，你按自己的渠道发货',
      '审核通过后，这里会出现一个后台链接，能自己加商品',
    ],
  },
}

const errText = (e: unknown) => (e instanceof ApiError ? e.message : '出了点问题，请稍后再试')

const STATUS_LABEL: Record<ApiMerchantApplication['status'], string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '未通过',
}

const TONE: Record<ApiMerchantApplication['status'], string> = {
  pending: 'bg-sun-300 text-ink-900',
  approved: 'bg-grass-200 text-grass-700',
  /* 服务端有 rejected 这一档（后台总得能拒），客户端这一版直接显示出来 ——
     不显示的话，被拒的人看到的是「审核中」，会一直等。 */
  rejected: 'bg-berry-100 text-berry-500',
}

export function MerchantView({ onBack }: { onBack: () => void }) {
  const session = useAccount((s) => s.session)
  const pushToast = useApp((s) => s.pushToast)

  /** `null` = 还没加载过（区别于「加载完了，一条都没有」） */
  const [apps, setApps] = useState<ApiMerchantApplication[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** 正在提交的那一路（防连点；提交是异步的） */
  const [busy, setBusy] = useState<MerchantRole | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  const load = useCallback(async () => {
    if (!session) {
      setApps(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await myMerchant()
      setApps(r.applications ?? [])
    } catch (e) {
      setError(errText(e))
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  const of = (role: MerchantRole) => apps?.find((a) => a.role === role)

  /**
   * 一键申请。
   *
   * 服务端按 `(uid, role)` upsert —— 同一路再申请就是**改申请**，
   * 而且不会把已有的审核结果冲掉（`MERCHANT.md` §2）。
   * 所以这里直接拿返回值覆盖那一路，不用整表重拉。
   */
  const apply = async (role: MerchantRole) => {
    if (busy) return
    setBusy(role)
    setError(null)
    try {
      const app = await applyMerchant(role)
      setApps((prev) => [...(prev ?? []).filter((a) => a.role !== role), app])
      pushToast({
        kind: 'success',
        title: '申请已提交',
        detail: '审核通过后，这里会出现后台链接',
        emoji: '📨',
      })
    } catch (e) {
      setError(errText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回心愿商城"
          className="btn flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg text-ink-700 shadow-flat"
        >
          ←
        </button>
        <span className="font-display text-base font-extrabold">招商合作</span>
        <span className="flex-1" />
        <span className="rounded-full bg-grape-100 px-2.5 py-1 text-[11px] font-extrabold text-grape-500">
          🤝 招募中
        </span>
      </div>

      <p className="rounded-2xl bg-sun-50 px-3 py-2 text-xs font-bold leading-relaxed text-ink-700">
        把心愿商城分享给更多家长 —— 你用得好，也让别人用得上。
        <span className="mt-1 block text-[11px] font-normal leading-snug text-ink-500">
          点一下就能申请，身份用你现在的账号，不用另外填资料。
        </span>
      </p>

      {!session ? (
        /* 未登录：说清楚为什么要登录，给一个按钮。**不偷偷存本地** */
        <section className="surface space-y-3 p-4" data-merchant-need-login>
          <p className="text-[12.5px] leading-relaxed text-ink-600">
            招商申请要经过审核，还得给你一个后台链接 ——
            这两件事都得有个账号才做得了。先登录（或注册一个）再申请。
          </p>
          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            data-merchant-login
            className="btn min-h-[44px] w-full rounded-2xl bg-grape-400 font-display font-extrabold text-white active:btn-press"
          >
            登录 / 注册
          </button>
          <p className="text-center text-[11px] text-ink-400">
            孩子那边照常玩，任务和积分都不受影响。
          </p>
        </section>
      ) : (
        <>
          {error && (
            <p
              data-merchant-error
              className="flex items-center gap-2 rounded-2xl bg-berry-50 px-3 py-2 text-[11.5px] font-bold text-berry-500"
            >
              <span className="min-w-0 flex-1">{error}</span>
              <button
                type="button"
                onClick={() => void load()}
                className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-berry-500"
              >
                重试
              </button>
            </p>
          )}

          {loading && apps === null && (
            <p className="px-1 text-[11.5px] font-bold text-ink-400">正在读取申请状态…</p>
          )}

          {(['parent', 'merchant'] as MerchantRole[]).map((role) => {
            const app = of(role)
            const meta = ROLE_META[role]
            return (
              <section key={role} data-merchant-role={role} className="surface overflow-hidden p-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grape-100 text-xl">
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-extrabold text-ink-900">
                      {meta.title}
                    </p>
                    <p className="mt-0.5 break-keep text-[11px] font-bold text-ink-500">
                      {meta.pitch}
                    </p>
                  </div>
                  {app && (
                    <span
                      className={clsx(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                        TONE[app.status],
                      )}
                    >
                      {STATUS_LABEL[app.status]}
                    </span>
                  )}
                </div>

                {app ? (
                  <AppliedBody app={app} />
                ) : (
                  <>
                    <ul className="mt-2.5 space-y-1.5">
                      {meta.bullets.map((b) => (
                        <li
                          key={b}
                          className="flex gap-1.5 text-[11.5px] leading-snug text-ink-600"
                        >
                          <span className="mt-[3px] shrink-0 text-grape-400">·</span>
                          <span className="min-w-0">{b}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      disabled={busy === role || loading}
                      onClick={() => void apply(role)}
                      data-merchant-apply={role}
                      /* 两路的按钮文案都是「申请」，视觉上靠所在卡片区分。
                         但**无障碍名不能一样** —— 读屏按 tab 走会连着念两个
                         「申请」，人不知道在申请哪一路。所以名字取那一路的标题。 */
                      aria-label={meta.title}
                      className="btn mt-3 min-h-[44px] w-full rounded-2xl border border-grape-500/30 bg-grape-400 font-display font-extrabold text-white active:btn-press disabled:opacity-50"
                    >
                      {busy === role ? '提交中…' : '申请'}
                    </button>
                  </>
                )}
              </section>
            )
          })}
        </>
      )}

      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-400">
        分成比例、结算方式以审核通过后后台里写的为准。
      </p>

      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )
}

/**
 * 已经提交过的那一半：审核中 / 已通过 / 未通过。
 *
 * ⚠️ 「已通过但没有链接」是**可能**出现的（后端回填了状态、链接还没生成）。
 *    这时候不能把按钮画成可点 —— 点了什么都不发生，看着像坏了。
 */
function AppliedBody({ app }: { app: ApiMerchantApplication }) {
  const approved = app.status === 'approved'
  const hasUrl = approved && !!app.admin_url

  /* 已经审过就报「审核」的时间，别在「已通过」下面还写「11 分钟前提交」——
     那句话读起来像「还在排队」。 */
  const when =
    app.status === 'pending'
      ? `${humanizeAgo(app.created_at * 1000)}提交`
      : `${humanizeAgo((app.reviewed_at || app.created_at) * 1000)}审核`

  return (
    <div className="mt-2.5 space-y-2">
      <p className="rounded-xl bg-paper-2 px-2.5 py-2 text-[11px] leading-snug text-ink-600">
        {app.status === 'approved'
          ? hasUrl
            ? '审核通过啦。后台能看数据、也能自己加商品。'
            : '审核通过了，后台链接还在生成，稍后再来看。'
          : app.status === 'rejected'
            ? '这次没通过。' + (app.note ? `原因：${app.note}` : '可以联系我们问问原因。')
            : '已经提交，等我们审核。通过之后这里会出现后台链接。'}
        <span className="mt-1 block text-ink-400">{when}</span>
      </p>

      {hasUrl ? (
        <button
          type="button"
          onClick={() => {
            if (!app.admin_url) return
            window.open(app.admin_url, '_blank', 'noopener,noreferrer')
          }}
          data-merchant-admin
          className="btn min-h-[44px] w-full rounded-2xl border border-grass-600/30 bg-grass-400 font-display font-extrabold text-white active:btn-press"
        >
          ↗ 打开后台
        </button>
      ) : null}
    </div>
  )
}
