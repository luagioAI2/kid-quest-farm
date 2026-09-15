import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import type { RedeemCategory, RedeemItem } from '@/domain/types'
import { humanizeAgo } from '@/domain/time'
import { ParentPinPanel } from '../parent/ParentGate'
import { BottomSheet, CoinPill } from '../farm/farmUi'

/* ============================================================
   兑换商城
   ------------------------------------------------------------
   家长需求：「兑换。积分可以兑换零食，礼物，玩平板，出朋友家等，
   家长（密码）可以新增和编辑。」

   结构：
   * 孩子视角：看到能换什么、还差多少分、一键兑换
   * 家长视角：新增 / 编辑 / 下架（要密码）
   * 兑换后生成一条"待兑现"记录，家长点一下表示"真的给了"

   定价策略见 seedTasks.ts 的注释 —— 目标是把孩子的日收入
   （约 250 分）映射到「日常小确幸每天可换」、
   「大件愿望要攒一周」，从而保证兑换始终可控。
   ============================================================ */

const CATEGORY_META: Record<RedeemCategory, { label: string; emoji: string }> = {
  snack: { label: '零食饮料', emoji: '🍪' },
  screen: { label: '屏幕时间', emoji: '📱' },
  outing: { label: '出去玩', emoji: '🎡' },
  gift: { label: '礼物', emoji: '🎁' },
  privilege: { label: '特权', emoji: '⭐' },
  custom: { label: '其他', emoji: '✨' },
}

const CATEGORY_ORDER: RedeemCategory[] = [
  'snack',
  'screen',
  'privilege',
  'outing',
  'gift',
  'custom',
]

export function RedeemSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      emoji="🎁"
      title="兑换愿望"
      headerRight={<CoinPill amount={useApp((s) => s.balance)} />}
    >
      <RedeemBody />
    </BottomSheet>
  )
}

/**
 * 兑换面板的正文。
 *
 * 抽出来是为了让「底部弹层」和「独立页面」共用同一份实现 ——
 * 否则两处各写一遍，改了一处忘了另一处，两边行为就会不一致。
 */
export function RedeemBody() {
  const redeemItems = useApp((s) => s.redeemItems)
  const redeemRecords = useApp((s) => s.redeemRecords)
  const balance = useApp((s) => s.balance)
  const settings = useApp((s) => s.settings)

  const [tab, setTab] = useState<'shop' | 'records' | 'manage'>('shop')
  const [pinOk, setPinOk] = useState(false)

  const pending = useMemo(() => redeemRecords.filter((r) => !r.fulfilled), [redeemRecords])

  const grouped = useMemo(() => {
    const map = new Map<RedeemCategory, RedeemItem[]>()
    for (const it of redeemItems) {
      const list = map.get(it.category) ?? []
      list.push(it)
      map.set(it.category, list)
    }
    return CATEGORY_ORDER.filter((c) => (map.get(c)?.length ?? 0) > 0).map((c) => ({
      category: c,
      meta: CATEGORY_META[c],
      items: (map.get(c) ?? []).sort((a, b) => a.cost - b.cost),
    }))
  }, [redeemItems])

  const needsPin = !!settings.parentPin && settings.protectParentActions !== false

  return (
    <>
      <div className="mb-3 flex gap-2 rounded-full border border-ink-900/10 bg-white p-1">
        <TabBtn active={tab === 'shop'} onClick={() => setTab('shop')}>
          🎁 能换什么
        </TabBtn>
        <TabBtn active={tab === 'records'} onClick={() => setTab('records')}>
          📜 兑换记录
          {pending.length > 0 ? (
            <span className="tnum ml-1 rounded-full bg-berry-400 px-1.5 text-xs text-white">
              {pending.length}
            </span>
          ) : null}
        </TabBtn>
        <TabBtn active={tab === 'manage'} onClick={() => setTab('manage')}>
          ⚙️ 管理
        </TabBtn>
      </div>

      {tab === 'shop' && (
        <>
          {grouped.length === 0 ? (
            <div className="surface flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="text-6xl">🛒</span>
              <p className="font-display text-lg font-extrabold text-ink-900">还没有可以换的东西</p>
              <p className="text-sm text-ink-500">请爸爸妈妈去「管理」里添加吧</p>
            </div>
          ) : (
            <div className="space-y-4 pb-4">
              {/* ⚠️ 这里**不再写「🪙 你有 N 分」** —— 全局顶栏已经常驻显示余额，
                  在正文里再报一遍同一个数只是噪音。留下的这句才是这里独有的信息：
                  「点了就会扣」这个后果。 */}
              <p className="rounded-2xl bg-sun-50 px-3 py-2 text-xs font-bold text-ink-700">
                换完就扣分，想清楚再点哦～
              </p>
              {grouped.map((g) => (
                <section key={g.category}>
                  <h3 className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
                    {g.meta.emoji} {g.meta.label}
                  </h3>
                  <ul className="space-y-3">
                    {g.items.map((it) => (
                      <RedeemRow key={it.id} item={it} balance={balance} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'records' && (
        <div className="space-y-3 pb-4">
          {redeemRecords.length === 0 ? (
            <div className="surface flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="text-5xl">📜</span>
              <p className="font-display font-extrabold text-ink-900">还没有兑换过</p>
              <p className="text-sm text-ink-500">完成任务的积分，可以来这里换想要的东西</p>
            </div>
          ) : (
            redeemRecords.map((r) => (
              <div key={r.id} className="surface flex items-center gap-3 p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sun-100 text-xl">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink-900">{r.name}</p>
                  <p className="text-[11px] text-ink-500">
                    -{r.cost} 分 · {humanizeAgo(r.createdAt)}
                  </p>
                </div>
                <span
                  className={clsx(
                    'shrink-0 rounded-full px-2 py-1 text-[11px] font-bold',
                    r.fulfilled ? 'bg-grass-200 text-grass-700' : 'bg-sun-300 text-ink-900',
                  )}
                >
                  {r.fulfilled ? '已兑现' : '待兑现'}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'manage' &&
        (needsPin && !pinOk ? (
          <ParentPinPanel
            title="请爸爸妈妈来一下"
            hint="管理兑换品需要密码"
            onPass={() => setPinOk(true)}
          />
        ) : (
          <ManagePanel />
        ))}
    </>
  )
}

/* ---------------- 孩子视角：一键兑换 ---------------- */

function RedeemRow({ item, balance }: { item: RedeemItem; balance: number }) {
  const redeem = useApp((s) => s.redeem)
  const redeemedToday = useApp((s) => s.redeemedToday)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const affordable = balance >= item.cost
  const usedToday = redeemedToday(item.id)
  const maxed = item.limitPerDay != null && usedToday >= item.limitPerDay
  const meta = CATEGORY_META[item.category]

  const doRedeem = async () => {
    setBusy(true)
    try {
      const ok = await redeem(item.id)
      if (ok) setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className={clsx('surface overflow-hidden', (!affordable || maxed) && 'opacity-70')}>
      <div className="flex items-center gap-3 p-3">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-grape-100 text-2xl">
          {item.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-extrabold text-ink-900">{item.name}</p>
          {item.note ? (
            <p className="line-clamp-2 text-xs text-ink-500">{item.note}</p>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CoinPill amount={item.cost} tone={affordable ? 'sun' : 'danger'} />
            {item.limitPerDay != null ? (
              <span className="text-[11px] text-ink-500">
                每天最多 {item.limitPerDay} 次
                {maxed ? ' · 今天用完了' : ` · 还剩 ${item.limitPerDay - usedToday} 次`}
              </span>
            ) : null}
            <span className="text-[11px] text-ink-400">{meta.emoji}</span>
          </div>
        </div>
      </div>

      {confirming ? (
        <div className="border-t-2 border-ink-900/5 bg-sun-50/70 p-3">
          <p className="mb-2 text-center text-sm font-bold text-ink-700">
            用 {item.cost} 分换「{item.name}」？
            <br />
            <span className="text-xs font-normal text-ink-500">
              换完还剩 {balance - item.cost} 分
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-500 active:btn-press"
            >
              再想想
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doRedeem()}
              className="btn min-h-[46px] flex-1 rounded-2xl border border-grass-600/30 bg-grass-400 font-display font-extrabold text-white active:btn-press disabled:opacity-50"
            >
              换！🎉
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t-2 border-ink-900/5 p-2">
          <button
            type="button"
            disabled={!affordable || maxed}
            onClick={() => setConfirming(true)}
            className={clsx(
              'btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border font-display font-extrabold',
              affordable && !maxed
                ? 'border-grape-500/30 bg-grape-400 text-white active:btn-press'
                : 'cursor-not-allowed border-ink-900/10 bg-ink-100 text-ink-300',
            )}
          >
            {maxed
              ? '今天已经换过了'
              : affordable
                ? '🎁 换这个'
                : `还差 ${item.cost - balance} 分`}
          </button>
        </div>
      )}
    </li>
  )
}

/* ---------------- 家长视角：管理 ---------------- */

const EMOJI_CHOICES = [
  '🍪','🧃','🍕','🍦','🍫','🎂','📱','📺','🎮','🎬','🧸','🎁',
  '🎡','🏊','🚲','🏃','🌙','⭐','🎫','💛','🧩','🛴','⚽','🎨',
]

function ManagePanel() {
  const allRedeemItems = useApp((s) => s.allRedeemItems)
  const redeemRecords = useApp((s) => s.redeemRecords)
  const setRedeemItemArchived = useApp((s) => s.setRedeemItemArchived)
  const deleteRedeemItem = useApp((s) => s.deleteRedeemItem)
  const fulfillRedeem = useApp((s) => s.fulfillRedeem)
  const pushToast = useApp((s) => s.pushToast)

  const [editing, setEditing] = useState<RedeemItem | null>(null)
  const [creating, setCreating] = useState(false)
  /** 正在等二次确认的那一条 —— 删除不可逆，不能一点就没 */
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const pending = redeemRecords.filter((r) => !r.fulfilled)

  /** 上架 / 下架。下架是可逆的，所以不做二次确认，只给个 toast 反馈。 */
  const toggleArchived = async (it: RedeemItem) => {
    const next = !it.archived
    await setRedeemItemArchived(it.id, next)
    pushToast({
      kind: 'info',
      title: next ? '已下架' : '已重新上架',
      detail: next ? `${it.name} 从孩子的列表里藏起来了` : `${it.name} 又能换啦`,
      emoji: next ? '⬇️' : '⬆️',
    })
  }

  const doDelete = async (it: RedeemItem) => {
    setConfirmingId(null)
    await deleteRedeemItem(it.id)
    pushToast({ kind: 'info', title: `已删除「${it.name}」`, emoji: '🗑' })
  }

  if (creating || editing) {
    return (
      <RedeemEditor
        item={editing ?? undefined}
        onDone={() => {
          setCreating(false)
          setEditing(null)
        }}
      />
    )
  }

  return (
    <div className="space-y-4 pb-4">
      {/* ---- 待兑现 ---- */}
      {pending.length > 0 && (
        <section className="surface overflow-hidden border border-sun-400/40">
          <div className="bg-sun-100 px-3 py-2">
            <p className="font-display text-sm font-extrabold text-ink-900">
              🔔 有 {pending.length} 个愿望等兑现
            </p>
            <p className="text-[11px] text-ink-500">孩子已经用积分换好了，记得兑现哦</p>
          </div>
          <ul className="divide-y-2 divide-ink-900/5">
            {pending.map((r) => (
              <li key={r.id} className="flex items-center gap-3 p-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-lg shadow-flat">
                  {r.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-ink-900">{r.name}</p>
                  <p className="text-[11px] text-ink-500">
                    {humanizeAgo(r.createdAt)} · 花了 {r.cost} 分
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void fulfillRedeem(r.id)}
                  className="btn shrink-0 rounded-2xl border border-grass-600/30 bg-grass-400 px-3 py-2 text-sm font-extrabold text-white active:btn-press"
                >
                  已兑现 ✓
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={() => setCreating(true)}
        className="btn flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl border border-grape-500/30 bg-gradient-to-b from-grape-300 to-grape-500 font-display text-base font-extrabold text-white shadow-flat active:btn-press"
      >
        ➕ 新增一个兑换品
      </button>

      <section>
        <h3 className="mb-2 px-1 font-display text-sm font-extrabold text-ink-500">
          全部兑换品（{allRedeemItems.length}）
        </h3>
        <ul className="space-y-2">
          {allRedeemItems.map((it) => {
            const archived = !!it.archived

            // 删除的二次确认就地展开，不另弹窗：
            // 家长还在列表上下文里，一眼看得见自己点的是哪一条。
            if (confirmingId === it.id) {
              return (
                <li
                  key={it.id}
                  className="surface flex items-center gap-2 border border-berry-400/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-ink-900">
                      删除「{it.name}」？
                    </p>
                    <p className="text-[11px] leading-snug text-ink-500">
                      删掉就找不回来了。换过的记录会留着。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="btn shrink-0 rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-xs font-extrabold text-ink-700 active:btn-press"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void doDelete(it)}
                    className="btn shrink-0 rounded-xl border border-berry-500/30 bg-berry-400 px-3 py-2 text-xs font-extrabold text-white active:btn-press"
                  >
                    删除
                  </button>
                </li>
              )
            }

            return (
              <li key={it.id} className="surface flex items-center gap-3 p-3">
                <span
                  className={clsx(
                    'grid size-11 shrink-0 place-items-center rounded-2xl text-xl',
                    archived ? 'bg-ink-100' : 'bg-grape-100',
                  )}
                >
                  {it.emoji}
                </span>
                {/* 只把文字压暗，操作按钮保持原样 —— 整行 opacity 会让按钮看着像禁用了 */}
                <div className={clsx('min-w-0 flex-1', archived && 'opacity-50')}>
                  <p className="truncate text-sm font-extrabold text-ink-900">
                    {it.name}
                    {archived ? (
                      <span className="ml-1 text-[11px] font-bold text-ink-500">已下架</span>
                    ) : null}
                  </p>
                  <p className="truncate text-[11px] text-ink-500">
                    {it.cost} 分 · {CATEGORY_META[it.category].label}
                    {it.limitPerDay != null ? ` · 每天 ${it.limitPerDay} 次` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(it)}
                    aria-label={`编辑 ${it.name}`}
                    className="btn rounded-xl border border-ink-900/10 bg-white px-2.5 py-1.5 text-sm font-bold active:btn-press"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleArchived(it)}
                    aria-label={archived ? `上架 ${it.name}` : `下架 ${it.name}`}
                    className={clsx(
                      'btn rounded-xl border px-2.5 py-1.5 text-sm font-bold active:btn-press',
                      archived
                        ? 'border-grass-500/40 bg-grass-100'
                        : 'border-ink-900/10 bg-white',
                    )}
                  >
                    {archived ? '⬆️' : '⬇️'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(it.id)}
                    aria-label={`删除 ${it.name}`}
                    className="btn rounded-xl border border-berry-400/40 bg-berry-100 px-2.5 py-1.5 text-sm font-bold active:btn-press"
                  >
                    🗑
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <p className="px-2 text-center text-[11px] leading-relaxed text-ink-500">
        ⬇️ 下架只是从孩子看到的列表里藏起来，换过的记录都还在，⬆️ 可以随时重新上架。
        <br />
        🗑 是永久删除，会再问你一次。
      </p>
    </div>
  )
}

/* ---------------- 新增 / 编辑兑换品 ---------------- */

function RedeemEditor({ item, onDone }: { item?: RedeemItem; onDone: () => void }) {
  const addRedeemItem = useApp((s) => s.addRedeemItem)
  const updateRedeemItem = useApp((s) => s.updateRedeemItem)
  const pushToast = useApp((s) => s.pushToast)

  const [name, setName] = useState(item?.name ?? '')
  const [emoji, setEmoji] = useState(item?.emoji ?? '🎁')
  const [category, setCategory] = useState<RedeemCategory>(item?.category ?? 'snack')
  const [cost, setCost] = useState(item?.cost ?? 50)
  const [note, setNote] = useState(item?.note ?? '')
  const [limitPerDay, setLimitPerDay] = useState<number | undefined>(item?.limitPerDay)
  const [err, setErr] = useState('')

  const save = async () => {
    if (!name.trim()) {
      setErr('给它起个名字吧')
      return
    }
    if (cost <= 0) {
      setErr('积分要大于 0')
      return
    }
    if (item) {
      await updateRedeemItem(item.id, {
        name: name.trim(),
        emoji,
        category,
        cost,
        note: note.trim() || undefined,
        limitPerDay,
      })
      pushToast({ kind: 'success', title: '改好啦', emoji: '✅' })
    } else {
      await addRedeemItem({
        name: name.trim(),
        emoji,
        category,
        cost,
        note: note.trim() || undefined,
        limitPerDay,
        createdByParent: true,
      })
      pushToast({ kind: 'success', title: `加上了「${name.trim()}」`, emoji: '🎁' })
    }
    onDone()
  }

  return (
    <div className="space-y-4 pb-4">
      <button
        type="button"
        onClick={onDone}
        className="text-sm font-bold text-ink-500"
      >
        ← 返回管理
      </button>

      <div className="surface p-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-16 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-sun-50 text-3xl">
            {emoji}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 16))}
            placeholder="叫什么？比如「玩 30 分钟平板」"
            className="min-h-[48px] min-w-0 flex-1 rounded-2xl border border-ink-900/10 bg-paper-2 px-3 font-display font-bold text-ink-900 outline-none focus:border-grape-400"
          />
        </div>

        <Field label="选个图标">
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={clsx(
                  'btn grid size-10 place-items-center rounded-xl text-xl active:btn-press',
                  emoji === e ? 'scale-110 bg-sun-300 ring-2 ring-sun-400' : 'bg-white',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </Field>

        <Field label="属于哪一类">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={clsx(
                  'btn rounded-pill px-3 py-2 text-sm font-bold active:btn-press',
                  category === c ? 'bg-grape-400 text-white' : 'bg-white text-ink-500',
                )}
              >
                {CATEGORY_META[c].emoji} {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="需要多少积分">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCost((c) => Math.max(5, c - 10))}
              className="btn grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl font-extrabold active:btn-press"
            >
              −
            </button>
            <input
              type="number"
              value={cost}
              min={1}
              onChange={(e) => setCost(Math.max(1, Number(e.target.value) || 0))}
              className="tnum min-h-[48px] min-w-0 flex-1 rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-center font-display text-xl font-extrabold text-ink-900 outline-none focus:border-grape-400"
            />
            <button
              type="button"
              onClick={() => setCost((c) => c + 10)}
              className="btn grid size-11 shrink-0 place-items-center rounded-2xl bg-white text-xl font-extrabold active:btn-press"
            >
              ＋
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[30, 50, 80, 120, 200, 300, 600, 1500].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCost(v)}
                className={clsx(
                  'btn rounded-pill px-2.5 py-1.5 text-xs font-bold active:btn-press',
                  cost === v ? 'bg-sun-300 text-ink-900' : 'bg-white text-ink-500',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            参考：孩子一天大约能赚 250 分。30~60 分是"每天都能换"，
            150~300 分要攒一两天，600 分以上要攒一周左右。
          </p>
        </Field>

        <Field label="说明（可不填）">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 40))}
            placeholder="比如「周末才能用哦」"
            className="min-h-[46px] w-full rounded-2xl border border-ink-900/10 bg-paper-2 px-3 text-sm font-bold text-ink-900 outline-none focus:border-grape-400"
          />
        </Field>

        <Field label="每天最多换几次（0 = 不限）">
          <div className="flex flex-wrap gap-1.5">
            {[0, 1, 2, 3].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLimitPerDay(v === 0 ? undefined : v)}
                className={clsx(
                  'btn rounded-pill px-3 py-2 text-sm font-bold active:btn-press',
                  (v === 0 ? limitPerDay == null : limitPerDay === v)
                    ? 'bg-sun-300 text-ink-900'
                    : 'bg-white text-ink-500',
                )}
              >
                {v === 0 ? '不限' : `${v} 次`}
              </button>
            ))}
          </div>
        </Field>

        {err && <p className="mt-2 text-sm font-bold text-berry-500">{err}</p>}

        <button
          type="button"
          onClick={() => void save()}
          className="btn mt-4 flex min-h-[54px] w-full items-center justify-center rounded-2xl border border-grape-500/30 bg-gradient-to-b from-grape-300 to-grape-500 font-display text-lg font-extrabold text-white shadow-flat active:btn-press"
        >
          {item ? '保存修改' : '加进商城 🎁'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-extrabold text-ink-500">{label}</p>
      {children}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'btn flex min-h-[44px] flex-1 items-center justify-center rounded-full text-[14px] active:btn-press',
        active ? 'bg-grape-400 text-white shadow-flat' : 'bg-transparent text-ink-500',
      )}
    >
      {children}
    </button>
  )
}
