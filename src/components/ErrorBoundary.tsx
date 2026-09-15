import { Component, type ErrorInfo, type ReactNode } from 'react'

/* ============================================================
   错误边界
   ------------------------------------------------------------
   一个 Tab 崩了不应该让整个 App 白屏 —— 对低龄用户来说白屏意味着
   "坏了"，会直接放弃使用。这里兜住错误、保留导航、给出可恢复提示。
   ============================================================ */

interface Props {
  children: ReactNode
  /** 用于在重试时重置子树（例如切换 Tab 时传入 tab key） */
  resetKey?: string
  onReset?: () => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 保留到控制台，方便家长/开发者排查
    console.error('[小任务农场] 页面出错:', error, info.componentStack)
  }

  componentDidUpdate(prev: Props): void {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null })
    }
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
    this.props.onReset?.()
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="text-6xl anim-wiggle">🔧</div>
        <h2 className="font-display text-2xl font-extrabold text-ink-900">
          哎呀，这里出了点小问题
        </h2>
        <p className="max-w-xs text-sm text-ink-500">
          你的积分和任务数据都还在，不用担心。点下面的按钮试试看。
        </p>
        <div className="flex gap-2">
          <button
            onClick={this.handleRetry}
            className="btn rounded-2xl bg-sun-300 px-6 py-3 font-extrabold text-ink-900 shadow-flat"
          >
            再试一次
          </button>
          <button
            onClick={this.handleReload}
            className="btn rounded-2xl bg-white px-6 py-3 font-extrabold text-ink-500 shadow-flat"
          >
            重新打开
          </button>
        </div>
        <details className="mt-2 max-w-full">
          <summary className="cursor-pointer text-xs text-ink-300">技术细节</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-ink-100 p-2 text-left text-[10px] leading-tight text-ink-700">
            {this.state.error.message}
          </pre>
        </details>
      </div>
    )
  }
}
