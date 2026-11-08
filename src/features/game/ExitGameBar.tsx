/**
 * 进游戏之后顶上那条**很窄**的条：只有一个「退出游戏」。
 *
 * 为什么要单独一条（而不是浮在画面上）：
 *
 *   浮在右上角会跟游戏自己的 HUD 打架 —— 云边小农场窄屏时右上角正好是
 *   「日志 / 设置」两枚按钮，宽屏时右侧留白里也是一条竖栏；换个游戏
 *   （iframe 的那种）更不知道那儿有什么。所以这条**占自己的高度**，
 *   游戏容器从它下面开始，谁都不遮。
 *
 * 高度刻意压到 32px 上下：原来顶栏 56 + 底栏 72 一共占掉约 128px，
 * 换成这条之后游戏能多出约 96px 画面（平板横屏更明显）。
 *
 * 文案用「退出游戏」四个字而不是只有一个 ✕：孩子看不懂纯图标，
 * 而且这一步会离开游戏（回任务页），不该让人误按。
 */
export function ExitGameBar({ onExit }: { onExit: () => void }) {
  return (
    <div className="relative z-30 flex items-center justify-end px-2 pb-1 pt-safe">
      <button
        type="button"
        /* 走查脚本与 e2e 靠这个锚点离开游戏（底栏在这一屏是隐藏的） */
        data-tour="exit-game"
        onClick={onExit}
        aria-label="退出游戏"
        className="btn flex items-center gap-1.5 rounded-full border border-ink-900/10 bg-white/85 px-3 py-1 text-xs font-extrabold text-ink-700 shadow-flat backdrop-blur"
      >
        <span aria-hidden>✕</span>
        <span>退出游戏</span>
      </button>
    </div>
  )
}
