import { useState, type FormEvent } from 'react'
import { useApp } from '@/store/useApp'
import { ParentGate } from '../parent/ParentGate'

/* ============================================================
   「有激活码？」—— 心愿商品页上的输码入口（2026-11-05）
   ------------------------------------------------------------
   ## 为什么要有这一块

   用户原话：「为啥 游戏 盲盒 还有 游戏 都没有 激活 的地方。应该在心愿商城
   对应 item 就可以激活吧。不然拿到了 激活码 或者兑换码，咋办。」

   在这之前，全 App 只有两个输码口：
     · `设置 → 游戏 → 有兑换码？`（家长区，埋在三层菜单里）
     · 心愿商城的**家长定价页**（`OfferView`，得先过密码、再点「定个价」）

   也就是说：孩子手里捏着一张卡，站在**卖这张卡的那件商品**上，
   却没有任何地方能输。他唯一能做的是一层层摸到设置里 —— 而那条路
   本身就是家长锁后面的。

   所以把输码口搬到商品详情页：**在哪件商品上看到，就在哪件商品上激活**。

   ## 两道闸门，两种用法

   `gate`：
     · `'pin'`  —— 商品详情页（孩子也能进）。输码前先过家长密码。
                   码是花钱买来的东西，让孩子自己核销等于把「买」这件事
                   的确认权交给他；而且激活之后游戏就进了账号，退不回来。
     · `'open'` —— 家长定价页。那一页**整页**已经在闸门后面了，
                   这里再套一层就是让人连输两次密码。

   ⚠️ 成功之后**不切当前游戏**。切「当前」是家长的事（`设置 → 游戏`），
      和 `purchaseGame` 里的口径一致：买完不自动切。这条是用户
      2026-11-05 明确选的「保持现状（家长控制）」。

   ## ★ 为什么「已拥有」的判断在**组件内部**，而不是调用方的条件渲染

   这是 2026-11-05 用真码走查抓到的 bug，别再改回去：

   详情页原来是 `{... && !alreadyOwned && <Card/>}`。可激活成功会让
   `redeemGameCode` 立刻 `refresh()` ⇒ `ownedGameIds` 多一款 ⇒
   `alreadyOwned` 在同一帧变 true ⇒ **整块连同下面那条绿字被卸载**。
   表现是：码用掉了、游戏到账了，界面上什么都没说，看着像「点了没反应」。

   所以这里改成：组件**始终挂着**，`owned` 只用来决定「画不画」——
   `return null` 不会卸载实例，`msg` 就还在。激活成功之后即使
   `owned` 已经翻成 true，也照旧渲染那条绿字。

   ## 和「设置 → 游戏」那一块的关系

   同一套 store 动作（`redeemGameCode`），同一套服务端接口
   （`POST /api/wish/redeem-code`），所以**不存在两套口径**：
   这里激活成功的游戏，设置里的「我的游戏」立刻就有。
   差别只有位置和闸门，不是两条链路。
   ============================================================ */

export function CodeRedeemBlock({
  gate = 'open',
  owned = false,
  card = false,
  label = '🎟️ 有激活码？在这儿输',
  onDone,
}: {
  /** `'pin'` = 自己带一道家长闸门；`'open'` = 调用方已经过闸门了 */
  gate?: 'pin' | 'open'
  /** 这款游戏**已经在这个账号里**了（详情页传 `alreadyOwned`） */
  owned?: boolean
  /** `true` = 自己带那张白卡片和标题（商品详情页用）；`false` = 裸控件（定价页用） */
  card?: boolean
  /** 折叠状态下那颗按钮的文案（两个页面的上下文不一样） */
  label?: string
  /** 成功之后调用方要做的事（定价页：关掉面板回列表） */
  onDone?: () => void
}) {
  const redeemGameCode = useApp((s) => s.redeemGameCode)

  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const r = await redeemGameCode(code)
      if (r.ok) {
        /* 成功后**不再留在输入态**：码已经烧掉了，还摆着一个空输入框
           会让人以为没成功、再输一遍（第二遍必然报「已经用过了」）。 */
        setMsg({ ok: true, text: r.message })
        setCode('')
        onDone?.()
      } else {
        /* 失败**不清空** —— 要能对着卡片改一位再提交。
           （`CodeRedeem.test.tsx` 里钉着同一条。） */
        setMsg({ ok: false, text: r.message })
      }
    } finally {
      setBusy(false)
    }
  }

  /** 详情页那张白卡片（定价页不要，它自己已经在卡片里了） */
  const wrap = (body: React.ReactNode) =>
    card ? (
      <div data-wish-code className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        {!msg?.ok && (
          <>
            <p className="text-sm font-extrabold">已经买到卡了？</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-ink-500">
              游戏卡背面那串就是激活码。在这儿输一次，游戏就进「我的游戏」——
              不用先去攒兑换券。输的时候要爸爸妈妈确认一下。
            </p>
          </>
        )}
        {body}
      </div>
    ) : (
      <>{body}</>
    )

  /* ① 刚激活成功：绿字 + 指路。**这一支要排在 `owned` 前面** ——
     激活成功时 `owned` 已经是 true 了，排在后面就永远看不到。 */
  if (msg?.ok) {
    return wrap(
      <div data-code-done className="rounded-xl bg-grass-100 px-3 py-2.5">
        <p className="text-[12.5px] font-extrabold text-grass-700">✅ {msg.text}</p>
        <p className="mt-1 text-[11px] font-bold leading-relaxed text-grass-700/80">
          游戏已经在「我的游戏」里了。想现在玩，让爸妈去「设置 → 游戏」把它设成当前。
        </p>
      </div>,
    )
  }

  /* ② 已经有了、也不是这次激活的：整块不画（服务端会直接拒「你已经有了」）。
     ⚠️ 是 `return null` 而不是让调用方条件渲染 —— 见文件头那段。 */
  if (owned) return null

  if (!open) {
    return wrap(
      <button
        type="button"
        data-code-open
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-white/60 py-2 text-[12.5px] font-bold text-ink-600"
      >
        {label}
      </button>,
    )
  }

  const form = (
    <form
      onSubmit={submit}
      data-code-box
      className="mt-2 rounded-xl border border-ink-200 bg-white p-2.5"
    >
      <div className="flex gap-2">
        <input
          data-code-input
          value={code}
          onChange={(ev) => setCode(ev.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={8}
          placeholder="ABC-DEF"
          aria-label="激活码"
          className="min-w-0 flex-1 rounded-lg border border-ink-200 px-3 py-2 font-mono text-[15px] uppercase tracking-[0.18em] text-ink-800 outline-none focus:border-grass-400"
        />
        <button
          type="submit"
          data-code-submit
          disabled={busy || code.trim().length === 0}
          className="shrink-0 rounded-lg bg-grass-500 px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {busy ? '激活中…' : '激活'}
        </button>
      </div>
      {msg && (
        <p data-code-msg data-code-ok="0" className="mt-2 text-[12px] font-bold text-berry-500">
          {msg.text}
        </p>
      )}
    </form>
  )

  return wrap(
    gate === 'pin' ? (
      /* ⚠️ 必须给 `onCancel` —— 不给的话 `PinFlow` 底下那颗「先算了」
         根本不渲染（它按 `onCancel` 有无决定要不要画）。表现是：手滑点开
         输码，只能一路答完数学题 + 设完密码，或者按返回退出整件商品。 */
      <ParentGate hint="输激活码需要爸爸妈妈确认" onCancel={() => setOpen(false)}>
        {form}
      </ParentGate>
    ) : (
      form
    ),
  )
}
