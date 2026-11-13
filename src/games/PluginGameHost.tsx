import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/useApp'

/**
 * **下载来的游戏**在宿主里的挂载点（spec §12）。
 *
 * 内置游戏（农场）是**编译进 App 的 React 组件**，直接 `<FarmPage />` 就行。
 * 下载来的游戏不是 —— 它是一段运行时取回来的 ESM，只能按契约装配：
 *
 *     const unmount = bundle.mount(container, hostApi)
 *
 * 所以这里只干一件事：给 `mount()` 一个容器，并在**离开时把卸载函数调掉**。
 *
 * ## 为什么卸载这件事要单独强调
 *
 * 插件可以注册 `setInterval` / `addEventListener` / `requestAnimationFrame`。
 * 宿主不调 `unmount`，它们就**一直活着**：切走再切回来会看到「跑了两遍」
 * （两次抽奖、两次扣分、声音叠在一起），而且**不报错**。
 * 本项目对这类静默失效特别敏感，所以卸载路径写得比挂载路径还小心：
 *   · `disposed` 标记 —— `mount` 是异步的，等它回来时组件可能已经卸载了
 *     （孩子秒切 tab），这时**必须立刻卸载**，否则会留下一个孤儿游戏；
 *   · `replaceChildren()` 兜底 —— 契约要求插件自己清空容器，但它忘了的时候
 *     宿主不能把上一局的 DOM 留在那儿。
 */
export function PluginGameHost({ gameId }: { gameId: string }) {
  const mountGame = useApp((s) => s.mountGame)
  const manifest = useApp((s) => s.installedGames[gameId])

  const boxRef = useRef<HTMLDivElement | null>(null)
  /** 「上一局收干净」和「这一局开始挂」之间的先后顺序，见下面 effect 的注释 */
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const [error, setError] = useState<string | null>(null)
  /**
   * 挂载中（2026-11-13 用户：「初次打开游戏很慢，这时候是不是有个加载效果」）。
   *
   * 慢的原因是**第一次**要把 `.plugin.mjs` 和它的资源从网上取回来 + 执行，
   * 之后浏览器缓存住了就快了（用户说的「后面就不慢了」就是这个）。
   *
   * 原来这段时间游戏区是**一片空白** —— 孩子会以为卡住了、反复点。
   * 所以至少要有一个「在准备」的提示。
   *
   * ⚠️ 只在**真的在挂载**时为 true：`mountGame` 很快返回时（包已缓存）
   *    这个提示会闪一下，那比空白更糟。挂载完成后立刻清掉。
   */
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return

    /*
     * ★★ 两次挂载**不许重叠**（2026-10-25）。
     *
     * `StrictMode` 在开发环境会把 effect 跑两遍（mount → cleanup → mount）。
     * 两次 `mountGame()` 是**并发**的，而且都往同一个容器里塞东西。第一遍的
     * unmount 回来得晚（爪爪乐要等 Rapier 的 WASM），它里面那句
     * `container.replaceChildren()` 就把**第二遍刚挂上去的根节点一起清掉了**。
     *
     * 症状特别误导人：`__claw.ready === true`、插件内部一切正常，但
     * `box.querySelectorAll('.claw-root')` 和 `canvas` 都是 0 —— 看着像
     * 「打包把类名弄丢了」，其实 DOM 是被自己人扫掉的。2026-10-25 实测：
     * 关掉 StrictMode 后 claw3d 的 e2e 22 条红全绿，就是这条。
     *
     * ➜ 用一条 promise 链把「上一局的卸载」和「这一局的挂载」排成先后：
     *   容器**还是原来那个**（插件看到的 DOM 父节点不变，契约不变），
     *   只是第二局一定等第一局收干净才动手。
     *
     * ⚠️ 别改成「每次挂载给一个自己的子 div」：那样容器身份变了，
     *   把 `<style>` 塞进 `document.head`、给 `container` 加类名的插件
     *   （奖品公园就是）会开始互相摘样式 —— 2026-10-25 试过，三条断言当场红。
     */
    let disposed = false
    let unmount: (() => void) | null = null
    setError(null)
    setLoading(true)

    /**
     * ★★ 插件**一画出东西就撤掉我加的加载层**（2026-11-13 实测）。
     *
     * 很多插件自己带启动页（「下落的2048」就有一屏粉色方块 +「加载中…」）。
     * 我原来等到 `mountGame` resolve 才收提示，可那时插件早就画完了自己的
     * 加载页 —— 两层字叠在一起，截图里糊成一团。
     *
     * `mount()` 的契约是「往容器里塞东西」，所以**容器一有子节点**就说明
     * 插件开始渲染了。用 MutationObserver 盯这一下，比猜时间靠谱。
     */
    const observer =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            if (el.childElementCount > 0 && !disposed) {
              setLoading(false)
              observer?.disconnect()
            }
          })
    observer?.observe(el, { childList: true })

    const run = chainRef.current.then(async () => {
      // 上一局还没收完，这一局就已经被切走了 —— 连挂都不用挂
      if (disposed) return
      try {
        const u = await mountGame(gameId, el)
        if (disposed) {
          // 已经切走了 —— 这一局白挂了，立刻收掉（它可能是异步的，要等）
          await Promise.resolve(u() as unknown)
          return
        }
        unmount = u
      } catch (e) {
        // 包坏了 / 缺 API / 契约不匹配。**不能让整个 App 白屏** ——
        // ErrorBoundary 会兜住，但那样孩子看到的是「出错了」，
        // 分不清是哪个游戏坏了。这里把游戏名和原因直接写出来。
        if (!disposed) setError(e instanceof Error ? e.message : String(e))
      } finally {
        // 成功 / 失败都要收掉「准备中」—— 失败时下面会换成错误卡片，
        // 留着提示等于两层话同时在屏上。
        if (!disposed) setLoading(false)
      }
    })
    // 链本身不能因为某一局抛错就断掉
    chainRef.current = run.catch(() => {})

    return () => {
      disposed = true
      observer?.disconnect()
      unmount?.()
      unmount = null
      // 兜底：插件没清干净的话，下一局会看见上一局的残留。
      el.replaceChildren()
    }
  }, [gameId, mountGame])

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {error ? (
        <div className="page-col w-full px-4 py-6">
          <div className="surface p-4">
            <p className="font-display text-base font-extrabold text-ink-900">
              「{manifest?.name ?? gameId}」打不开
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">{error}</p>
            <p className="mt-3 text-xs leading-snug text-ink-500">
              可以在「设置 → 游戏」里把它卸载。
            </p>
          </div>
        </div>
      ) : (
        /*
         * ★ **宽度由宿主给（`.page-col`），内边距由插件自己给。**
         *
         * `.page-col` 是 App **唯一**的宽度来源（430 / 672 / 896 / 1024，
         * 见 `theme.css`）。宿主必须把它套上：插件的作者**不知道**这个
         * App 的断点，让每个游戏自己定宽 = 平板上一款游戏铺满 1024px、
         * 别的页面收在 896px，一眼就看出来不是同一个 App。
         *
         * 宿主**不加**内边距 —— 那是插件自己的事（样板游戏的根节点带
         * `padding:16px`，和别的页面的 16px 边距一致）。两边都加就会
         * 叠成 32px，手机上白扔掉一行字。
         *
         * ⚠️ 手机上这个改动是**恒等**的：`page-col` 在 390px 视口下
         * 就是 `width:100%`，量出来的宽度和没套之前一模一样。
         *
         * 容器**必须留在这里、由宿主渲染** —— 插件不该自己往 `document.body`
         * 上挂东西，那样宿主就没法在切 tab 时把它一起收走。
         *
         * ★★ 2026-10-22：**必须是「定高盒子」**（`relative` 父 + `absolute inset-0` 子）。
         *
         * 原来写的是 `min-h-0 flex-1`，量出来**父容器 698px、插件根节点 0px** ——
         * 整屏空白，而 `__gpPlayable` / canvas / 断言全都在（走查图才看得出来）。
         *
         * 原因是 CSS 的百分比高度：插件根节点写的是 `height:100%`，它要对着
         * **父节点的 `height` 属性**解析。而父节点是靠 `flex:1 1 0%` 撑到 698 的，
         * `height` 属性仍是 `auto` —— 在这条**多层嵌套**的 flex 链里，
         * 浏览器不把「靠 flex-grow 得到的 used height」当成 definite，
         * 于是 `height:100%` 退化成 `auto`，而插件的子元素又全是绝对定位 ⇒ 0。
         *
         * （同一结构在**一层** flex 里能量出 698 —— 所以这个坑只在深链上出现，
         *   单测量不出来，`jsdom` 更是完全不做布局。）
         *
         * 绝对定位的盒子高度由 `inset:0` 直接定死，与 `height` 属性无关，
         * 所以插件的 `height:100%` 一定解析得到。代价是**容器不再随内容长高**：
         * 插件要装下一屏以上的内容，得自己 `overflow-y:auto`（契约里已写明）。
         *
         * `min-h-0` 是关键：少了它，子元素的 `overflow` 撑不住，
         * 插件内部滚动会变成整页滚动。
         */
        <div className="page-col relative flex w-full min-h-0 flex-1 flex-col">
          <div ref={boxRef} data-plugin-host={gameId} className="absolute inset-0" />
          {/*
            加载提示（2026-11-13）。**盖在容器上**而不是替换它 ——
            容器必须一直在（插件的 `mount(container)` 要那个引用），
            换掉它等于每次加载都重建父节点。
            `pointer-events-none`：提示不该吃掉游戏的点击（它可能已经能点了）。
          */}
          {loading && (
            <div
              className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-paper/70 backdrop-blur-[2px]"
              data-game-loading={gameId}
            >
              <div className="flex flex-col items-center gap-3">
                {/* 用跳动的小点而不是转圈：转圈在低端机上更卡，而这里本来就在等加载 */}
                <div className="flex gap-1.5">
                  <span className="size-2.5 rounded-full bg-grass-400 anim-bounce-1" />
                  <span className="size-2.5 rounded-full bg-sun-400 anim-bounce-2" />
                  <span className="size-2.5 rounded-full bg-sky-400 anim-bounce-3" />
                </div>
                <p className="text-sm font-extrabold text-ink-600">
                  正在打开{manifest?.name ? `「${manifest.name}」` : '游戏'}…
                </p>
                <p className="text-[11px] font-bold text-ink-400">第一次会慢一点，之后就快了</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
