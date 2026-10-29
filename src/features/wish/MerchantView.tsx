import { useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import type { MerchantApplication, MerchantRole } from '@/domain/types'
import { humanizeAgo } from '@/domain/time'

/* ============================================================
   招商（2026-10-29）
   ------------------------------------------------------------
   入口在**心愿商城右上角**（原来「兑换记录」那个位置）—— 用户原话：
   「把兑换记录去掉换成招商按钮。点开看到招商合作。不是在兑换/兑换记录里显示。」

   两路，都是一键申请：
     · 家长 —— **把 App 分享给其他家长**，别人用起来你拿分成
       （⚠️ 不是「邀请商家」：2026-10-29 用户当场纠正过）
     · 商家 —— 自己把商品挂进心愿商城

   ## 为什么没有表单

   用户原话：「点申请即可。不需要填称呼这些。因为会根据当前账号申请。
   之后会接入服务端的。」

   所以这里**只发一个「谁、什么时候、申请了哪一路」**，身份交给账号体系。
   别为了「看起来完整」加一堆输入框 —— 那些字段后端拿不到、还要用户白填一遍。

   ## 没有后端时的边界

   · 客户端只写 `status: 'pending'`。
   · `approved` + `adminUrl` **只能由后端回填**。界面上这两个分支是真实现了的，
     但客户端**没有任何路径**能推到 `approved` —— 别加「模拟审核通过」按钮：
     那等于给所有用户凭空发一个后台入口。
   · 「已通过但链接还没生成」时**不画**按钮：点了什么都不发生，比没有更糟。
   ============================================================ */

/** 空数组常量。**别在 selector 里写 `?? []`** —— 每次都是新引用，会无限重渲染 */
const NO_APPS: MerchantApplication[] = []

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

export function MerchantView({ onBack }: { onBack: () => void }) {
  const apps = useApp((s) => s.settings.merchantApps)
  const updateSettings = useApp((s) => s.updateSettings)
  const pushToast = useApp((s) => s.pushToast)
  /** 正在提交的那一路（防连点；提交是异步的） */
  const [busy, setBusy] = useState<MerchantRole | null>(null)

  const list = apps ?? NO_APPS
  const of = (role: MerchantRole) => list.find((a) => a.role === role)

  /**
   * 一键申请。
   *
   * 按角色覆盖，**不是** push：同一个人重复点 = 改申请，
   * 不是提第二份（后端那边两单只会多问一遍「哪单算」）。
   * 另一路那条**原样留着** —— 一个家长完全可能既分享又开店。
   */
  const apply = async (role: MerchantRole) => {
    if (busy) return
    setBusy(role)
    try {
      const next: MerchantApplication[] = [
        ...list.filter((a) => a.role !== role),
        {
          role,
          // ⚠️ 只可能是 pending。`approved` 是后端的事，见文件头。
          status: 'pending',
          createdAt: Date.now(),
        },
      ]
      await updateSettings({ merchantApps: next })
      pushToast({
        kind: 'success',
        title: '申请已提交',
        detail: '审核通过后，这里会出现后台链接',
        emoji: '📨',
      })
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
                <p className="font-display text-base font-extrabold text-ink-900">{meta.title}</p>
                <p className="mt-0.5 break-keep text-[11px] font-bold text-ink-500">
                  {meta.pitch}
                </p>
              </div>
              {app && (
                <span
                  className={clsx(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                    app.status === 'approved'
                      ? 'bg-grass-200 text-grass-700'
                      : 'bg-sun-300 text-ink-900',
                  )}
                >
                  {app.status === 'approved' ? '已通过' : '审核中'}
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
                  disabled={busy === role}
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

      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-400">
        分成比例、结算方式以审核通过后后台里写的为准。
      </p>
    </div>
  )
}

/**
 * 已经提交过的那一半：审核中 / 已通过。
 *
 * ⚠️ 「已通过但没有链接」是**可能**出现的（后端回填了状态、链接还没生成）。
 *    这时候不能把按钮画成可点 —— 点了什么都不发生，看着像坏了。
 */
function AppliedBody({ app }: { app: MerchantApplication }) {
  const approved = app.status === 'approved'
  const hasUrl = approved && !!app.adminUrl

  return (
    <div className="mt-2.5 space-y-2">
      <p className="rounded-xl bg-paper-2 px-2.5 py-2 text-[11px] leading-snug text-ink-600">
        {approved
          ? hasUrl
            ? '审核通过啦。后台能看数据、也能自己加商品。'
            : '审核通过了，后台链接还在生成，稍后再来看。'
          : '已经提交，等我们审核。通过之后这里会出现后台链接。'}
        <span className="mt-1 block text-ink-400">{humanizeAgo(app.createdAt)}提交</span>
      </p>

      {hasUrl ? (
        <button
          type="button"
          onClick={() => {
            if (!app.adminUrl) return
            window.open(app.adminUrl, '_blank', 'noopener,noreferrer')
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
