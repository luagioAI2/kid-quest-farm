/* ============================================================
   游戏页的两层「外壳控件」
   ------------------------------------------------------------
   ## 2026-11-11 交互模型重做（用户口径）

   原来的模型是「进游戏 = 整屏」，App 把顶栏底栏全收掉、顶上留一条
   `ExitGameBar`。用户否掉了它：

   > 游戏 有点问题，一开始不要全屏，应该有个透明的 全屏按钮，类似于播放器那种，
   > 全屏后，退出按钮直接左上角返回就是（在游戏上层 偏玻璃），
   > 最后右上角 多一个 微信小程序 退出那种。

   拆成三件事：

   ① **默认不全屏**：游戏页和别的 tab 一样带顶栏 / 底栏，游戏只是「中间那一块」。
   ② **`GameFullscreenButton`**：叠在游戏画面右下角的一枚半透明按钮（播放器那种
      「全屏」图标），点了才进全屏。**它自己不进全屏**，只是把请求往上抛。
   ③ **`ImmersiveGameBar`**：全屏之后浮在游戏上层的一排 —— 左上角玻璃返回
      （退出全屏，回到带外壳的样子）、右上角微信小程序那颗胶囊（退出游戏，
      回任务页）。两个动作语义不同，别合成一个：
        · 左上角「返回」= **还在游戏里**，只是不占满屏；
        · 右上角「胶囊」= **离开游戏**（微信里点 ⊙ 就是关掉小程序）。

   ## 为什么全屏按钮叠在右下角，而不是塞进顶栏

   用户要的是「播放器那种」—— 播放器的全屏键就在画面角落、压在画面上。
   塞进 App 顶栏会被读成「又一个设置类入口」，而且和顶栏的 🪙 / 👀 / ⚙️ 混在一起，
   孩子分不清哪个是「让游戏变大」。

   ⚠️ 代价是它会压在游戏自己的右下角上（农场那儿是「市场」按钮的右下角）。
   所以它做得**小（36px）、半透明、只占角落**：点错一次也就是进全屏，
   左上角返回一下又回来了，不会丢任何进度。

   ## 为什么图标用 SVG 不用 emoji

   全屏 / 返回这类**几何图标**用 emoji 会踩两个坑（农场里已经踩过）：
   emoji 的字重跟着系统字体走、调不动；同一串在不同端（iOS / Android / 桌面）
   长得不一样，而这几个键是「一眼要认出来」的。SVG 里 `stroke-width` 是数，
   想多粗就多粗。

   ## ⚠️ 锚点别改名

   · `data-tour="game-fullscreen"` —— 进全屏（走查脚本要能点）
   · `data-tour="exit-immersive"` —— 退出全屏（回带外壳的样子）
   · `data-tour="exit-game"` —— **离开游戏**。二十来个 e2e / 走查脚本靠它离开游戏，
     别改；但注意它**只在全屏时存在**（不全屏时底栏就在，直接点底栏的「任务」）。
   ============================================================ */

/** 四角向外的「全屏」图标 */
function IconExpand() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9.5V4h5.5" />
      <path d="M20 9.5V4h-5.5" />
      <path d="M4 14.5V20h5.5" />
      <path d="M20 14.5V20h-5.5" />
    </svg>
  )
}

/** 细返回箭头（左上角那颗） */
function IconBack() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-[19px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14.5 5.5 8 12l6.5 6.5" />
    </svg>
  )
}

/**
 * 不全屏时叠在游戏画面右下角的「全屏」按钮。
 *
 * `absolute` 的定位父级是 App 的 `<main>`（那边加了 `relative`）——
 * 这样它跟着**游戏那块**走，不会跑到顶栏或底栏上去。
 *
 * ★ 样式是「磨砂白圆片 + 深色图标」：
 *   · 用**圆**不用圆角方 —— 方角贴在「市场」那颗黄色按钮的右下角上，
 *     一眼看过去像按钮自带的角标；圆的不会被读成「这个按钮的一部分」。
 *   · `bg-white/85` 而不是 `/60`：太透会让底下的黄透上来，还是糊成一片；
 *     85% 白 + 强一点的阴影，才像「浮在上面的一枚控件」。
 *   · 和全屏后左上角那颗返回是同一族（圆形 + 玻璃 + 阴影），进出全屏观感一致。
 *
 * ⚠️ 已知代价（量过，2026-11-11）：农场底部那排是 种子 / 动物 / 市场，
 *   这枚键会压住「市场」的**右下角约 15%**（32×36 / 126×60）。
 *   点中间照样点得到，点最右边会误进全屏 —— 而误进全屏的代价只是
 *   「左上角返回一下」，不丢进度，所以没为它改农场的按钮排布。
 *   真要彻底不重叠，只能把它挪进顶栏（那就不是「播放器那种」了）。
 */
export function GameFullscreenButton({ onEnter }: { onEnter: () => void }) {
  return (
    <button
      type="button"
      data-tour="game-fullscreen"
      onClick={onEnter}
      aria-label="全屏玩"
      title="全屏玩"
      className="btn absolute bottom-2 right-2 z-20 grid size-[34px] place-items-center rounded-full border border-white/80 bg-white/85 text-ink-800 shadow-[0_3px_10px_rgba(0,0,0,0.22)] backdrop-blur-md active:btn-press"
    >
      <IconExpand />
    </button>
  )
}

/**
 * 全屏之后浮在游戏上层的那一排：左上角返回 + 右上角微信胶囊。
 *
 * ⚠️ 整条是 `pointer-events-none`，只有两颗按钮 `pointer-events-auto` ——
 *    否则这条横带会把游戏顶部的点击全吃掉（农场顶栏正好在它下面）。
 */
export function ImmersiveGameBar({
  onExitFullscreen,
  onExitGame,
}: {
  onExitFullscreen: () => void
  onExitGame: () => void
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between px-2 pt-safe">
      {/* 左上角：返回 = 退出全屏（**不是**退出游戏） */}
      <button
        type="button"
        data-tour="exit-immersive"
        onClick={onExitFullscreen}
        aria-label="退出全屏"
        title="退出全屏"
        className="btn pointer-events-auto grid size-10 place-items-center rounded-full border border-white/40 bg-ink-900/30 text-white shadow-[0_2px_10px_rgba(0,0,0,0.22)] backdrop-blur-md active:btn-press"
      >
        <IconBack />
      </button>

      {/*
        右上角：微信小程序那颗胶囊（••• | ⊙）。
        整颗是**一个**按钮 —— 我们这儿没有「更多」菜单可开，
        硬把左半边做成空动作就是假按钮（点了没反应比没有更糟）。
        形状照抄微信是为了让家长一眼认出「这是关掉/退出」，
        语义上它就是 `exit-game`：回任务页。
      */}
      <button
        type="button"
        data-tour="exit-game"
        onClick={onExitGame}
        aria-label="退出游戏"
        title="退出游戏"
        className="btn pointer-events-auto flex h-8 items-center overflow-hidden rounded-full border border-ink-900/10 bg-white/80 text-ink-900 shadow-[0_2px_10px_rgba(0,0,0,0.16)] backdrop-blur-md active:btn-press"
      >
        <span
          aria-hidden
          className="grid h-8 w-[42px] place-items-center text-[13px] font-black leading-none tracking-[0.14em]"
        >
          •••
        </span>
        <span aria-hidden className="h-4 w-px bg-ink-900/15" />
        <span aria-hidden className="grid h-8 w-[42px] place-items-center text-[15px] leading-none">
          ⊙
        </span>
      </button>
    </div>
  )
}
