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

   ## ★ 但它必须抬到「游戏自己的动作条」上面（2026-11-11 实测后改的）

   第一版贴在 `bottom-2 right-2`（真正的角落），量出来是这样：

       农场底部那排（种子 / 动物 / 市场）  下沿距底 74px、高 60px ⇒ 占 74~134px
       全屏键（34×34，贴 corner）          占 8~42px，x 方向压住「市场」右边 30/126px

   ⇒ **吃掉「市场」按钮 13.5% 的面积（横向 24% 的宽度）**。
   点「市场」的右侧四分之一会误进全屏 —— 那是个主要操作，不是可以牺牲的角落。

   ⚠️ 而农场把四个角都占满了：左上/右上在 HUD 卡里（右上还有 📖），
   左下是「种子」、右下是「市场」。**没有哪个角是空的**，所以「贴角落」这条路走不通。

   ⇒ 抬到动作条上方：`bottom-[74px]`（相对 `<main>` 底边）= 8 + 60 + 6px 间隙。
   那一条正好是农场的**栅栏（纯装饰、不可点）**，重叠也没有代价。
   视觉上它像播放器控制条上方的那颗全屏键，仍然「压在画面上」。
   ⚠️ 对没有底部动作条的游戏（2048 之类），它会显得偏高一点 —— 但高一点只是观感，
   压在主要按钮上是**点错**，两害相权取观感。

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
 * ★ 样式是「深色玻璃圆片 + 白色图标」，跟全屏后左上角那颗返回**同一族**：
 *   进出全屏时两颗键长得一样，孩子不用重新认。
 *   用户原话是「**透明的**全屏按钮，类似于播放器那种」—— 播放器的控制键就是
 *   半透明压在画面上的，不是一块实心白片（第一版做成 `bg-white/85` 太实了）。
 *
 * ★ 位置：`bottom-[74px] right-2`，抬到游戏自己的底部动作条**上面**。
 *   为什么不贴角落、这个数字怎么来的，见文件头那段实测记录 ——
 *   贴角落会吃掉「市场」按钮 13.5%，那是主要操作。
 *
 * ★★ **这个 74 是相对 `<main>` 的底边，不是视口底边**（`absolute` 的定位父级是 main）。
 *   第一版我按视口算，写成 `8.75rem`(140px)，结果被顶到最后一排地块上去了 ——
 *   因为 main 的底边在底栏之上，还差 66px。实测：main 底边距视口底 66px，
 *   农场动作条占「main 底边往上 8~68px」⇒ 74 = 68 + 6px 间隙。
 *
 * ⚠️ 改这个数值前先跑 `scripts/_measure-fullscreen-btn.mjs`：
 *   它会打印这枚键和「种子 / 动物 / 市场」的重叠百分比。判据是**全都 0%**，
 *   不是「看着差不多」。
 *
 * ★★ 2026-11-13 用户：「有些游戏似乎没有全屏按钮」。实测按钮**一直在 DOM 里、
 *    也点得到**（`elementFromPoint` 命中的就是它）—— 问题是**看不见**：
 *    原来是 `bg-ink-900/35`（35% 的黑）+ 白图标，压在农场那种深绿草地上，
 *    两者都是低明度的暗色，边上还有一圈草地纹理，肉眼基本分辨不出来。
 *
 *    改法不是"做成实心白片"（用户明确说过要播放器那种透明感），而是
 *    **加一道白环**：`ring-2 ring-white/85` + 外描边阴影。
 *    白环的作用是**在任何背景上都勾出圆形轮廓** —— 浅色背景靠深色玻璃，
 *    深色背景靠白环，两边都能看见，而且中间仍然是半透明的。
 *
 *    ⚠️ 判「看得见」不能只看截图（我第一版就是）—— 这条只能靠**人眼**看
 *    多张不同游戏的截图。`_probe-fullscreen.mjs` 能证明"点得到"，
 *    证明不了"看得见"。
 */
export function GameFullscreenButton({ onEnter }: { onEnter: () => void }) {
  return (
    <button
      type="button"
      data-tour="game-fullscreen"
      onClick={onEnter}
      aria-label="全屏玩"
      title="全屏玩"
      className="btn absolute bottom-[74px] right-2 z-20 grid size-[34px] place-items-center rounded-full border border-white/60 bg-ink-900/55 text-white ring-2 ring-white/85 shadow-[0_2px_12px_rgba(0,0,0,0.38)] backdrop-blur-md active:btn-press"
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
