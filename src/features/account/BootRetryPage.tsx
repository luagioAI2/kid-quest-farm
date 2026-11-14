import { useAccount } from '@/store/useAccount'

/* ============================================================
   「没连上服务器」这一屏（2026-11-03）
   ------------------------------------------------------------
   为什么需要它：在线版启动时**先建账号、再拉数据**（`App.tsx` 那段注释
   写着顺序不能反）。可 `ensureGuest()` 失败之后，代码原来照样往下走
   `boot()` —— 而没有会话时 `refresh()` 直接返回 `no-session`，**一条都不拉**。
   于是孩子看到的是一整套空界面：没有任务、没有积分、农场是空的，
   而屏幕上**一个字都不会说**。

   对一个「没耐心」的新用户来说，这几乎是最坏的首屏：他不知道为什么空，
   也不会去猜，直接关掉。所以这里挡住它，说清楚 + 给一个重试。

   三条口径：
   1. **不吓人**。「东西都丢了」是假话 —— 这时还没拉到任何数据，
      真要说的是「没连上」。
   2. **不怪用户**。「请检查网络」已经是极限了，别写「您的网络有问题」。
   3. **只给一个动作**。重试。不要「退出」「设置」「联系客服」那一排 ——
      首屏给的选择越多，越像出了大事。
   ============================================================ */

export function BootRetryPage({
  onRetry,
  title = '还没连上服务器',
  detail,
  hint = '网络好了点下面重试就行，不用重新填什么。'
}: {
  onRetry: () => void
  /** 覆盖标题（默认是「还没连上服务器」） */
  title?: string
  /** 覆盖正文；**不传**就按 store 里的错误自己决定（见下面那段注释） */
  detail?: string | null
  /** 覆盖「接下来怎么办」那一句（启动出错时不是网络问题，别照抄） */
  hint?: string
}) {
  const error = useAccount((s) => s.error)
  const busy = useAccount((s) => s.busy)

  /* ★ 同一句话不显示两遍。默认的 `error` 就是「连不上服务器，请检查网络」，
     而标题已经说了「还没连上服务器」—— 两行一样的话看着像出了大事，
     也占掉了本来能放「接下来怎么办」的位置。只有**更有信息**的那句才显示
     （比如「服务器没有响应，请稍后再试」）。
     `detail` 显式传进来时（启动阶段抛的错）按传的来。 */
  const shown =
    detail !== undefined ? detail : error && !error.includes('连不上服务器') ? error : null

  return (
    /* `fixed inset-0` 而不是 `min-h-screen`：这一屏出现时外壳还没挂载，
       但它可能在任何容器里渲染，用固定定位最不容易被父级的 overflow 裁掉。 */
    <div data-boot-retry className="fixed inset-0 z-[60] overflow-y-auto bg-paper">
      <div className="page-col flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
        <div className="text-5xl" aria-hidden>
          📡
        </div>
        <h1 className="mt-5 font-display text-xl font-extrabold text-ink-800">{title}</h1>
        {shown && (
          <p className="mt-2 text-sm font-bold leading-relaxed text-ink-600">{shown}</p>
        )}
        <p className="mt-2 text-xs leading-relaxed text-ink-500">{hint}</p>
        <button
          data-boot-retry-btn
          type="button"
          onClick={onRetry}
          disabled={busy}
          className="btn mt-6 min-h-[48px] w-full max-w-[280px] rounded-2xl bg-grape-400 font-display text-base font-extrabold text-white active:btn-press disabled:opacity-40"
        >
          {busy ? '正在重试…' : '重试'}
        </button>
      </div>
    </div>
  )
}
