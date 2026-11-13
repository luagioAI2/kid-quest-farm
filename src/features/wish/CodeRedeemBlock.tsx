import { useState, type FormEvent, type ReactNode } from 'react'
import { Portal } from '@/components/Portal'
import { parseActivationMessage } from '@/domain/activationMessage'
import { useApp } from '@/store/useApp'

/* ============================================================
   「有激活码？」—— 心愿商品页上的输码入口（2026-11-05）
   ------------------------------------------------------------
   ## 为什么要有这一块

   用户原话：「为啥 游戏 盲盒 还有 游戏 都没有 激活 的地方。应该在心愿商城
   对应 item 就可以激活吧。不然拿到了 激活码 或者兑换码，咋办。」

   在这之前，全 App 只有两个输码口：
     · `设置 → 游戏 → 有兑换码？`（家长区，埋在三层菜单里）
     · 心愿商城的**家长定价页**（`OfferView`，得先过密码、再点「定个价」）

   ⚠️ 2026-11-07：第一处（设置里那个）按家长要求删掉了 ——
   「表里只有已经拥有的游戏…」那段说明连同入口一起不要了。
   所以现在挂载的是**详情页 + 定价页**两处，设置页不再是输码口。

   也就是说：孩子手里捏着一张卡，站在**卖这张卡的那件商品**上，
   却没有任何地方能输。他唯一能做的是一层层摸到设置里 —— 而那条路
   本身就是家长锁后面的。

   所以把输码口搬到商品详情页：**在哪件商品上看到，就在哪件商品上激活**。

   ## 第二轮改口（同一天，用户看完界面之后）

   用户原话：「『已经买到卡了？游戏卡背面那串就是激活码』这里提示很奇怪。
   激活码是家长去淘宝等购买之后获得的（测试的话直接拿到后台的激活码），
   一开始游戏只是挂在商城，显示未激活，可以点进去输入激活码激活。」

   ⇒ 码的**来源**说错了。现在没有实体游戏卡，是「爸妈在淘宝买了，
   卖家发一串码」。文案改成从「买」讲起，不要再说「卡背面」。
   ⇒ **盲盒也能输码**（用户明确要求）。盲盒本身没有 `game_id`，
   但码自带游戏，所以输进去照样解锁那一款。

   ## 第三轮：列表上直接「去激活」（同一天）

   用户原话：「心愿商城每个礼品的设计布局有点丑陋，名字 类型，标签啥的。
   『有码可输』是啥意思，很奇怪。应该是类似『去激活』，点击就会出现
   提示框购买、输入激活之类的吧。」

   ⇒ 列表卡片改成一颗**真按钮**「去激活」，点开的是一个**弹框**
     （`ActivationDialog.tsx`），框里讲清「爸妈买 → 卖家发码 → 输进来」。
   ⇒ 于是同一套输码状态机现在有两个外壳：详情页的**内联块**（本文件里的
     `CodeRedeemBlock`）和列表点开的**弹框**。两者共用 `useCodeRedeem` /
     `CodeForm` / `CodeDonePanel` —— 各写一遍的话，「失败不清空」「成功静音
     toast」「装包失败的半句提示」这三处迟早只剩一处对。

   ## 第四轮（同日稍晚）：那颗按钮的文案改成「家长激活」

   用户原话「去激活改成家长激活」。弹框本体、状态机、家长闸门都没动，
   只改了 `WishPage.tsx` 里卡片 / hero 两处可见文案（历史引文保留原话）。

   ## 第八轮（2026-11-11）：文案再改回「家长激活」，并从按钮行搬到封面角上

   用户原话：「去激活 往上移（去激活 还是改成 家长激活，家长激活 还是不要跟
   我想要 同级，试试 放到 图片的右下角）」。

   ⇒ 卡片底部那一整颗按钮删掉，改成封面右下角的小牌（`data-wish-activate` 不变，
     走查脚本与单测照旧按这个锚点数）；
   ⇒ 同一轮把卡片正文里的**商家名**那行也删了（「泡泡马特盲盒」上面已经写了
     泡泡马特，再来一行是同一句话说两遍），`data-wish-type` 锚点保留但 `hidden`；
   ⇒ 小牌用 `span role=button` 而不是 `<button>`：它在「点开详情」的 `<button>`
     里面，嵌套 `<button>` 会被 HTML 解析器提前闭合外层。

   ## 第六轮（2026-11-06）：入口只剩卡片弹框，详情页不再重复

   用户原话：「礼品，游戏 和 盲盒 有去激活。点开 弹框有输入激活码，
   没有激活码可以点去购买」，以及「因为我想要，去激活 已经在礼品 item
   有了，所以详情里不需要」。

   ⇒ 文案改回「去激活」（`家长激活` 这个说法作废）；
   ⇒ **商品详情页的 `CodeRedeemBlock` 全部摘掉** —— 同一件商品上摆两个
     输码入口，孩子只会以为要输两次；
   ⇒ 于是本文件现在只剩两个出口：
     · 卡片弹框（`ActivationDialog`，数字商品）—— `CodeForm` + `PinSheetBody`；
     · 家长定价页（`OfferView`）—— 裸 `CodeForm`（整页已在闸门后）。
     `CodeRedeemBlock` 本身只为定价页保留（`card={false}`），详情页那条
     `card` / `compact` 分支已经是死代码，留着是为了少一次改动面。

   ## 成功之后：一个弹框，不再是一行绿字

   用户原话：「激活后 自动进入 设置/游戏 里。给个弹框提示就可以了，
   查看 可以进入设置，游戏那个页面。」

   ⇒ 弹框（`Portal` 到 body）+ 两颗按钮：「去设置看看」/「知道了」。
   去设置走 `jumpToSettings('game')`（store 通道，`App` 负责真的打开）。
   ⇒ 成功时**不再发全局 toast**（`redeemGameCode(code, { silent: true })`）：
   弹框已经说了同一句话，再飘一条就是「同一句话说两遍」。

   ## 闸门不归这里管

   2026-11-06 删掉了 `gate` 参数和它的 `'pin'` 分支：第六轮详情页摘掉输码块
   之后它就没有调用方了（唯一调用点是定价页，传 `'open'`），也没有测试传它。

   ★ 为什么不是「留着以后用」：那条分支会包一层 `ParentGate` → `ParentPinPanel`，
   它**自带 🔒 和标题**，而这个组件自己已经有「🎟️ 有激活码？」的卡片标题 ——
   一启用就是两个标题叠着，和 👀 审核弹层、任务编辑器、去激活弹框三处
   刚修掉的毛病一模一样。

   ⇒ 要加闸门，用 `ParentLockButton` + `ParentPinSheet`（见
     `docs/parent-pin-gate.md`）；这里只负责「输码」这一件事。

   ⚠️ 成功之后**不切当前游戏**。切「当前」是家长的事（`设置 → 游戏`），
      和 `purchaseGame` 里的口径一致：买完不自动切。这条是用户
      2026-11-05 明确选的「保持现状（家长控制）」。

   ## ★ 为什么「已拥有」的判断在**组件内部**，而不是调用方的条件渲染

   这是 2026-11-05 用真码走查抓到的 bug，别再改回去：

   详情页原来是 `{... && !alreadyOwned && <Card/>}`。可激活成功会让
   `redeemGameCode` 立刻 `refresh()` ⇒ `ownedGameIds` 多一款 ⇒
   `alreadyOwned` 在同一帧变 true ⇒ **整块连同成功提示被卸载**。
   表现是：码用掉了、游戏到账了，界面上什么都没说，看着像「点了没反应」。

   所以这里改成：组件**始终挂着**，`owned` 只用来决定「画不画」——
   `return null` 不会卸载实例，`done` 就还在。弹框还多一层保险：
   它 `Portal` 到 `document.body`，压根不在这棵树里。

   ★ 列表那条路上还有**同一类**坑，但解法不同：激活成功后那张游戏卡会被
   `hiddenOwned` 从列表里摘掉，卡片要是自己持着弹框，弹框会跟卡片一起
   卸载。所以弹框挂在 `WishPage`（页面层），不在 `ItemCard` 里。

   ## 和「设置 → 游戏」那一块的关系

   同一套 store 动作（`redeemGameCode`），同一套服务端接口
   （`POST /api/wish/redeem-code`），所以**不存在两套口径**：
   这里激活成功的游戏，设置里的「我的游戏」立刻就有。
   差别只有位置和闸门，不是两条链路。
   ============================================================ */

/**
 * 输码这件事的**状态机**。内联块和弹框共用，别再各写一份。
 *
 * ⚠️ `silent: true` 是必须的 —— 两个外壳都会自己弹成功框，
 *    store 再飘一条 toast 就是「同一句话说两遍」。
 * ⚠️ 失败**不清空** `code`：要能对着码改一位再提交。
 * ⚠️ `onDone` 只给「成功后调用方要收尾」用（定价页关面板）。
 *    弹框**别传**：传了把弹框关掉，`done` 状态就跟着实例一起没了。
 */
export function useCodeRedeem(onDone?: () => void) {
  const redeemGameCode = useApp((s) => s.redeemGameCode)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  /** 成功文案。非空 = 成功框开着 */
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    try {
      const r = await redeemGameCode(code, { silent: true })
      if (r.ok) {
        /* 成功后**不再留在输入态**：码已经烧掉了，还摆着一个空输入框
           会让人以为没成功、再输一遍（第二遍必然报「已经用过了」）。 */
        setDone(r.message)
        setErr(null)
        setCode('')
        onDone?.()
      } else {
        setErr(r.message)
      }
    } finally {
      setBusy(false)
    }
  }

  return { code, setCode, busy, done, setDone, err, setErr, submit }
}

export type CodeRedeem = ReturnType<typeof useCodeRedeem>

/** 激活成功那一屏。**Portal 到 body**（不挂在详情页那棵树里，见文件头）。 */
export function CodeDonePanel({ done, onClose }: { done: string; onClose: () => void }) {
  const jumpToSettings = useApp((s) => s.jumpToSettings)

  /* 装包失败时不能还说「已经进我的游戏了，去设成当前」——
     包没装好，设成当前也玩不了。store 把那半句拼在 message 里。
     ⚠️ 拼进来的是一整句**带技术原因**的报错（`crypto.subtle` 那一串）。
     整句当标题会在弹框里变成五行报错墙 —— 2026-11-05 走查截图一眼看到。
     所以拆开：标题只留「已激活：X」，原因单独一行小字。

     ★★ 2026-11-13 修：原来这里自己写了一版 `done.includes('，但没装成功')`，
        而 store 拼的是 `，但 1 款没装成功`（**中间有数字**）⇒ `includes` 永远
        不命中 ⇒ 判成成功 ⇒ 界面上说「游戏已经进你的游戏柜了」，而包根本没装上。
        现在两个方向共用 `domain/activationMessage.ts`，只改一处两边一起变。 */
  const { headline, installFailed, reason } = parseActivationMessage(done)

  return (
    <Portal>
      <div
        data-code-done-dialog
        className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-5 anim-fade-in"
      >
        <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-float">
          <p className="text-3xl leading-none">🎉</p>
          <p className="mt-2 font-display text-lg font-extrabold text-ink-900">激活成功</p>
          {/* `data-code-done` 挂在**整块**上（不只是那句结果）：
              单测和走查都是读它的 `textContent` 找「设置 → 游戏」那句指路，
              只挂在一行上就等于把指路排除在断言之外。 */}
          <div data-code-done className="mt-1.5 space-y-1.5">
            <p className="text-[13px] font-bold leading-relaxed text-ink-700">{headline}</p>
            {installFailed ? (
              <>
                <p className="text-[12px] font-bold leading-relaxed text-ink-500">
                  游戏已经进账号了，但这个环境装不了包 —— 去「我的游戏」里点一下安装（换成手机
                  App 或 https 打开）。
                </p>
                {reason && (
                  <p
                    data-code-reason
                    className="break-words text-[10px] leading-relaxed text-ink-400"
                  >
                    {reason}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[12px] font-bold leading-relaxed text-ink-500">
                游戏已经进「我的游戏」了。想玩的话，让爸妈在「设置 → 游戏」里把它设成当前。
              </p>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              data-code-goto-settings
              onClick={() => {
                onClose()
                jumpToSettings('game')
              }}
              className="btn h-11 flex-1 rounded-xl bg-paper-2 text-[13px] font-extrabold text-ink-600 shadow-flat active:btn-press"
            >
              去设置看看
            </button>
            <button
              type="button"
              data-code-done-close
              onClick={onClose}
              className="btn h-11 flex-1 rounded-xl bg-grass-500 text-[13px] font-extrabold text-white active:btn-press"
            >
              知道了
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}

/**
 * 输入框本体。**不带闸门** —— 闸门归外壳：卡片弹框用 `PinSheetBody` 包，
 * 定价页整页已经在闸门后面，不再包。
 */
export function CodeForm({
  hook,
  autoFocus = false,
  submitLabel = '激活',
}: {
  hook: CodeRedeem
  autoFocus?: boolean
  submitLabel?: string
}) {
  return (
    <form
      onSubmit={hook.submit}
      data-code-box
      className="mt-2 rounded-xl border border-ink-200 bg-white p-2.5"
    >
      <div className="flex gap-2">
        <input
          data-code-input
          value={hook.code}
          onChange={(ev) => hook.setCode(ev.target.value)}
          autoFocus={autoFocus}
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
          disabled={hook.busy || hook.code.trim().length === 0}
          className="shrink-0 rounded-lg bg-grass-500 px-4 py-2 text-[13px] font-extrabold text-white disabled:opacity-50"
        >
          {hook.busy ? '激活中…' : submitLabel}
        </button>
      </div>
      {hook.err && (
        <p data-code-msg data-code-ok="0" className="mt-2 text-[12px] font-bold text-berry-500">
          {hook.err}
        </p>
      )}
    </form>
  )
}

export function CodeRedeemBlock({
  owned = false,
  card = false,
  compact = false,
  label = '输入激活码',
  onDone,
}: {
  /** 这款游戏**已经在这个账号里**了（详情页传 `alreadyOwned`） */
  owned?: boolean
  /** `true` = 自己带那张白卡片和标题（商品详情页用）；`false` = 裸控件（定价页用） */
  card?: boolean
  /**
   * `true` = 卡片里**不画标题和那段说明**，只留那颗虚线按钮。
   *
   * 盲盒详情页用：那一页上面已经有「随机开一款 / 靠兑换券」的说明，
   * 再叠四行字会把按钮顶到 844 屏的第 771 行 —— 正好被底栏压住。
   * 走查量过（`_probe-wish-code-place.mjs` 有一条专门钉这个）。
   */
  compact?: boolean
  /** 折叠状态下那颗按钮的文案（两个页面的上下文不一样） */
  label?: string
  /** 成功之后调用方要做的事（定价页：关掉面板回列表） */
  onDone?: () => void
}) {
  const [open, setOpen] = useState(false)
  const hook = useCodeRedeem(() => {
    setOpen(false)
    onDone?.()
  })

  /* ① 刚激活成功：弹框 + 指路。**这一支要排在 `owned` 前面** ——
     激活成功时 `owned` 已经是 true 了，排在后面就永远看不到。 */
  if (hook.done) {
    return <CodeDonePanel done={hook.done} onClose={() => hook.setDone(null)} />
  }

  /* ② 已经有了、也不是这次激活的：整块不画（服务端会直接拒「你已经有了」）。
     ⚠️ 是 `return null` 而不是让调用方条件渲染 —— 见文件头那段。 */
  if (owned) return null

  /** 详情页那张白卡片（定价页不要，它自己已经在卡片里了） */
  const wrap = (body: ReactNode) =>
    card ? (
      <div data-wish-code className="mt-3 rounded-3xl bg-white p-3.5 shadow-flat">
        {!compact && (
          <>
            <p className="text-sm font-extrabold">🎟️ 有激活码？</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-ink-500">
              爸爸妈妈买游戏时，卖家会发一串 6 位码（像 ABC-DEF）。输一次，游戏就进「我的游戏」，
              不用先攒兑换券。输的时候要爸爸妈妈确认一下。
            </p>
          </>
        )}
        {body}
      </div>
    ) : (
      <>{body}</>
    )

  if (!open) {
    return wrap(
      <button
        type="button"
        data-code-open
        onClick={() => setOpen(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink-300 bg-white/60 py-2 text-[12.5px] font-bold text-ink-600"
      >
        🎟️ {label}
      </button>,
    )
  }

  return wrap(<CodeForm hook={hook} />)
}
