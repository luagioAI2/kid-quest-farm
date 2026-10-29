import { useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import type { MerchantApplication, MerchantRole } from '@/domain/types'
import { humanizeAgo } from '@/domain/time'

/* ============================================================
   招商（2026-10-29）
   ------------------------------------------------------------
   入口在「📜 兑换记录」底部 —— 用户原话：「兑换记录显示招商，点击会有
   家长申请和商家申请。家长权益获取收益的分成。商家可以自己添加商城物品。」

   两路人马：
     · 家长   —— 邀请商家入驻，**拿商家收益的分成**
     · 商家   —— 自己把商品挂进心愿商城

   ## 现在**没有后端**，所以这一屏的边界要写清楚

   · 客户端只做「提交」这一半：写一条 `status: 'pending'` 进
     `settings.merchantApps`（可选字段，老库合并成空数组，不动 Dexie 版本）。
   · `approved` + `adminUrl` **只能由后端回填**。界面上那两个分支是**真的**
     实现了的（已通过就直出后台链接），但客户端**没有任何路径**能把状态
     推到 `approved` —— 别加「模拟审核通过」这种按钮：那等于给所有用户
     凭空发一个后台入口，上线第一天就会被当成真的。
   · 要验证「已通过」那一支，只能在测试里直接 seed 一条 `approved`。

   ## 为什么按角色各存一条，而不是一条

   一个家长完全可能既是家长又是商家（开小店的爸妈）。用一条记录的话，
   第二次申请会盖掉第一次，而且「家长的分成」和「商家的后台」是两个
   互不相干的东西，合并显示只会让人以为申请错了。
   ============================================================ */

/** 空数组常量。**别在 selector 里写 `?? []`** —— 每次都是新引用，会无限重渲染 */
const NO_APPS: MerchantApplication[] = []

const ROLE_META: Record<
  MerchantRole,
  { title: string; emoji: string; pitch: string; bullets: string[]; cta: string }
> = {
  parent: {
    title: '家长申请',
    emoji: '👤',
    pitch: '邀请商家入驻，拿收益分成',
    bullets: [
      '你邀请的商家每成交一笔，你按平台规则分到一部分',
      '邀请的店越多，分成越多；不用你垫钱、也不用你发货',
      '审核通过后，这里会出现一个后台链接，能看邀请记录和分成',
    ],
    cta: '申请成为推广家长',
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
    cta: '申请商家入驻',
  },
}

export function MerchantView({ onBack }: { onBack: () => void }) {
  const apps = useApp((s) => s.settings.merchantApps)
  const updateSettings = useApp((s) => s.updateSettings)
  const pushToast = useApp((s) => s.pushToast)

  /** 正在填的那一路。`null` = 还在选（家长 / 商家） */
  const [form, setForm] = useState<MerchantRole | null>(null)

  const list = apps ?? NO_APPS
  const of = (role: MerchantRole) => list.find((a) => a.role === role)

  return (
    <div className="space-y-3 pb-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="返回兑换记录"
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

      {form ? (
        <ApplyForm
          role={form}
          existing={of(form)}
          onCancel={() => setForm(null)}
          onSubmit={async (draft) => {
            /*
             * 按角色覆盖，**不是** push。
             *
             * 同一个角色重复提交 = 改申请，不是提第二份 —— 后端那边
             * 一个人两单只会让他们多问一遍「哪一单算」。
             * 另一个角色的那条**原样留着**（见文件头「为什么按角色各存一条」）。
             */
            const next: MerchantApplication[] = [
              ...list.filter((a) => a.role !== draft.role),
              {
                role: draft.role,
                // ⚠️ 只可能是 pending。`approved` 是后端的事，见文件头。
                status: 'pending',
                createdAt: Date.now(),
                name: draft.name,
                contact: draft.contact,
                note: draft.note,
              },
            ]
            await updateSettings({ merchantApps: next })
            setForm(null)
            pushToast({
              kind: 'success',
              title: '申请已提交',
              detail: '审核通过后，这里会出现后台链接',
              emoji: '📨',
            })
          }}
        />
      ) : (
        <>
          <p className="rounded-2xl bg-sun-50 px-3 py-2 text-xs font-bold leading-relaxed text-ink-700">
            把附近的小店、兴趣班、玩具店请进来 —— 孩子许愿、家长下单、商家供货。
            <span className="mt-1 block text-[11px] font-normal leading-snug text-ink-500">
              现在还在招募阶段，提交之后由我们人工审核。
            </span>
          </p>

          {(['parent', 'merchant'] as MerchantRole[]).map((role) => {
            const app = of(role)
            const meta = ROLE_META[role]
            return (
              <section
                key={role}
                data-merchant-role={role}
                className="surface overflow-hidden p-3"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-grape-100 text-xl">
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-base font-extrabold text-ink-900">
                      {meta.title}
                    </p>
                    <p className="mt-0.5 text-[11px] font-bold text-ink-500">{meta.pitch}</p>
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
                  <AppliedBody
                    app={app}
                    onEdit={() => setForm(role)}
                    onOpenAdmin={() => {
                      if (!app.adminUrl) return
                      window.open(app.adminUrl, '_blank', 'noopener,noreferrer')
                    }}
                  />
                ) : (
                  <>
                    <ul className="mt-2.5 space-y-1.5">
                      {meta.bullets.map((b) => (
                        <li key={b} className="flex gap-1.5 text-[11.5px] leading-snug text-ink-600">
                          <span className="mt-[3px] shrink-0 text-grape-400">·</span>
                          <span className="min-w-0">{b}</span>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setForm(role)}
                      data-merchant-apply={role}
                      className="btn mt-3 min-h-[44px] w-full rounded-2xl border border-grape-500/30 bg-grape-400 font-display font-extrabold text-white active:btn-press"
                    >
                      {meta.cta}
                    </button>
                  </>
                )}
              </section>
            )
          })}

          <p className="px-2 text-center text-[11px] leading-relaxed text-ink-400">
            分成比例、结算方式以审核通过后后台里写的为准。
          </p>
        </>
      )}
    </div>
  )
}

/**
 * 已经提交过的那一半：审核中 / 已通过。
 *
 * ⚠️ 「已通过但没有链接」是**可能**出现的（后端回填了状态、链接还没生成）。
 *    这时候不能把按钮画成可点 —— 点了什么都不发生，看着像坏了。
 */
function AppliedBody({
  app,
  onEdit,
  onOpenAdmin,
}: {
  app: MerchantApplication
  onEdit: () => void
  onOpenAdmin: () => void
}) {
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
        <span className="mt-1 block text-ink-400">
          {app.name} · {humanizeAgo(app.createdAt)}提交
        </span>
      </p>

      {hasUrl ? (
        <button
          type="button"
          onClick={onOpenAdmin}
          data-merchant-admin
          className="btn min-h-[44px] w-full rounded-2xl border border-grass-600/30 bg-grass-400 font-display font-extrabold text-white active:btn-press"
        >
          ↗ 打开后台
        </button>
      ) : null}

      <button
        type="button"
        onClick={onEdit}
        className="btn min-h-[40px] w-full rounded-2xl bg-transparent text-[13px] font-bold text-ink-400 active:btn-press"
      >
        改一下申请
      </button>
    </div>
  )
}

function ApplyForm({
  role,
  existing,
  onCancel,
  onSubmit,
}: {
  role: MerchantRole
  existing?: MerchantApplication
  onCancel: () => void
  onSubmit: (draft: {
    role: MerchantRole
    name: string
    contact: string
    note?: string
  }) => Promise<void>
}) {
  const meta = ROLE_META[role]
  const [name, setName] = useState(existing?.name ?? '')
  const [contact, setContact] = useState(existing?.contact ?? '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    if (!name.trim()) {
      setErr(role === 'merchant' ? '写一下店铺名字吧' : '写一下怎么称呼你')
      return
    }
    if (!contact.trim()) {
      setErr('留个手机号或微信，审核结果要联系你')
      return
    }
    setBusy(true)
    try {
      await onSubmit({
        role,
        name: name.trim(),
        contact: contact.trim(),
        note: note.trim() || undefined,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="surface p-4">
      <p className="font-display text-base font-extrabold text-ink-900">
        {meta.emoji} {meta.title}
      </p>
      <p className="mt-0.5 text-[11px] font-bold text-ink-500">{meta.pitch}</p>

      <Field label={role === 'merchant' ? '店铺名字' : '怎么称呼你'}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 20))}
          placeholder={role === 'merchant' ? '比如「楼下小书店」' : '比如「小雨妈妈」'}
          className="min-h-[46px] w-full rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-sm font-bold text-ink-900 outline-none focus:border-grape-400"
        />
      </Field>

      <Field label="联系方式（手机号或微信）">
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value.slice(0, 40))}
          placeholder="审核结果会联系你"
          className="min-h-[46px] w-full rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-sm font-bold text-ink-900 outline-none focus:border-grape-400"
        />
      </Field>

      <Field label={role === 'merchant' ? '你卖什么（可不填）' : '想邀请哪家店（可不填）'}>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 40))}
          placeholder={role === 'merchant' ? '比如「儿童绘本、文具」' : '比如「小区门口的蛋糕店」'}
          className="min-h-[46px] w-full rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-sm font-bold text-ink-900 outline-none focus:border-grape-400"
        />
      </Field>

      {err && <p className="mt-2 text-sm font-bold text-berry-500">{err}</p>}

      <p className="mt-3 rounded-xl bg-sky-50 px-2.5 py-2 text-[11px] font-bold leading-relaxed text-sky-500">
        现在还没有接后端，提交只会记在这台设备上；接上之后会真的发出去。
      </p>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn min-h-[48px] rounded-2xl bg-white px-4 text-sm font-extrabold text-ink-600 shadow-flat active:btn-press"
        >
          返回
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          data-merchant-submit
          className="btn min-h-[48px] flex-1 rounded-2xl border border-grape-500/30 bg-gradient-to-b from-grape-300 to-grape-500 font-display font-extrabold text-white shadow-flat active:btn-press disabled:opacity-50"
        >
          提交申请
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-extrabold text-ink-500">{label}</p>
      {children}
    </div>
  )
}
