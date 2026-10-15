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
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return

    let disposed = false
    let unmount: (() => void) | null = null
    setError(null)

    void (async () => {
      try {
        const u = await mountGame(gameId, el)
        if (disposed) {
          // 已经切走了 —— 这一局白挂了，立刻收掉。
          u()
          return
        }
        unmount = u
      } catch (e) {
        // 包坏了 / 缺 API / 契约不匹配。**不能让整个 App 白屏** ——
        // ErrorBoundary 会兜住，但那样孩子看到的是「出错了」，
        // 分不清是哪个游戏坏了。这里把游戏名和原因直接写出来。
        if (!disposed) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      disposed = true
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
         * 容器**必须留在这里、由宿主渲染** —— 插件不该自己往 `document.body`
         * 上挂东西，那样宿主就没法在切 tab 时把它一起收走。
         *
         * `flex-1` 让插件占满剩余高度；`min-h-0` 是关键 —— 少了它，
         * 子元素的 `overflow` 撑不住，插件内部滚动会变成整页滚动。
         */
        <div ref={boxRef} data-plugin-host={gameId} className="min-h-0 flex-1" />
      )}
    </div>
  )
}
