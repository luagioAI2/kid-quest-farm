import clsx from 'clsx'
import type { SkyTone } from '@/domain/farmClock'

/* ============================================================
   农场的「天」
   ------------------------------------------------------------
   ★★ 2026-10-15：这一版**推翻了同一批里先写的一版**。原因不是审美，是量出来的。

   先写的那版把太阳 / 月亮 / 星星画在页面顶上那条天空带子里（`h-44`），
   走查脚本也全绿 —— 因为它量的是「日月中心在不在天空框内」。
   **那只证明它画在那儿，不证明它看得见。**

   后来按 12×12 网格采样日月的包围盒、用 `elementFromPoint` 数
   「最上面那一层到底是不是它」（`.e2e-scratch/probe-sky-occlusion.mjs`）：

       手机 390×844 ：天空可见 **0%**  · 日月可见 **0%**（四档全 0）
       平板 834×1112：天空可见 17%     · 日月可见 **0%**

   因为天空带子是 y=63..239，而顶栏那张 `.surface` 卡片是 y=79..187 ——
   卡片把天空从 79 一直盖到 176，**只留下卡片两侧十几像素的缝**。

   ➜ 判据（比「有没有画」硬得多的一条）：**美术必须真的可见。**
     画在别人底下 = 没画。所以：

       ① 那条带子**只留色调** —— 它在卡片两侧的缝里看得见，夜里的紫一眼能认；
       ② 太阳 / 月亮搬进**时钟条** —— 那是内容层，一定在卡片上面；
       ③ **草地 / 山丘跟着色调压暗** —— 它们 100% 可见，昼夜这才「感觉得到」。

   ⚠️ 由此删掉的东西（别以为是漏了）：
     · `celestialFor()` 和它那条正弦弧 —— 弧的 x / y 没有任何地方能显示出来；
     · 夜空那 10 颗星 —— 画在带子里等于没画，搬到 20px 的时钟条里又挤成一团。
   ============================================================ */

/**
 * 时钟条按色调取的底色。
 * ⚠️ `day` 必须**逐字**保留原来的 `bg-sky-100/70` —— 白天是绝大多数时候看到的画面。
 */
const TONE_ROW: Record<SkyTone, string> = {
  dawn: 'bg-tangerine-100/80',
  day: 'bg-sky-100/70',
  dusk: 'bg-berry-100/80',
  night: 'bg-grape-200/70',
}

export function skyRowClass(tone: SkyTone): string {
  return TONE_ROW[tone]
}

/**
 * 草地 / 山丘按色调压暗 —— 这一层是**真正让昼夜看得见**的地方。
 *
 * `day` 返回 `undefined`：白天一个像素都不许变（和色调、时钟条同一个原则）。
 */
export function skySceneFilter(tone: SkyTone): string | undefined {
  switch (tone) {
    case 'day':
      return undefined
    case 'dawn':
      return 'brightness(0.97)'
    case 'dusk':
      return 'brightness(0.88) saturate(1.06)'
    case 'night':
      return 'brightness(0.7) saturate(0.75)'
  }
}

/* ---------------- 页面顶上那条带子 ---------------- */

/**
 * 天空带子 —— **只有色调和云**。
 *
 * ⚠️ 别再往里画日月 / 星星：这条带子被顶栏卡片盖住了 100%（见文件头）。
 * 要加「天上有什么」，加到时钟条（`CelestialIcon`）里去。
 */
export function SkyBand({ tone }: { tone: SkyTone }) {
  return (
    <div className={clsx('kqf-sky', `kqf-sky--${tone}`)} aria-hidden>
      <Cloud className="left-[8%] top-12" delay="0s" />
      <Cloud className="left-[52%] top-24" delay="1.4s" />
      <Cloud className="left-[74%] top-4" delay="2.6s" />
    </div>
  )
}

/* ---------------- 时钟条上的「此刻的天」 ---------------- */

/**
 * 太阳 / 月亮。**这是日月唯一可见的位置** —— 它在内容层，不会被卡片盖住。
 *
 * 「是太阳还是月亮」由色调直接推出来（`tone === 'night'`），不是另立一个
 * 带自己分档的函数 —— 同一个表达式，走散不了。
 *
 * `data-sky-body` 是给走查脚本读的稳定锚点；`capture-sky.mjs` 会按网格采样
 * 它、断言它**真的在最上面**（而不是像第一版那样「画了但看不见」）。
 */
export function CelestialIcon({ tone }: { tone: SkyTone }) {
  const kind = tone === 'night' ? 'moon' : 'sun'
  return (
    <span className="block size-5 shrink-0" aria-hidden>
      <span className="block size-5" data-sky-body={kind}>
        {kind === 'sun' ? <SunShape /> : <MoonShape />}
      </span>
    </span>
  )
}

/* ---------------- 太阳 ---------------- */

function SunShape() {
  return (
    <svg viewBox="0 0 56 56" className="block h-5 w-5" aria-hidden focusable="false">
      <circle cx="28" cy="28" r="25" fill="var(--color-sun-300)" opacity="0.35" />
      <g stroke="var(--color-sun-400)" strokeWidth="6" strokeLinecap="round">
        <line x1="28" y1="3" x2="28" y2="11" />
        <line x1="28" y1="45" x2="28" y2="53" />
        <line x1="3" y1="28" x2="11" y2="28" />
        <line x1="45" y1="28" x2="53" y2="28" />
        <line x1="10.3" y1="10.3" x2="16" y2="16" />
        <line x1="40" y1="40" x2="45.7" y2="45.7" />
        <line x1="10.3" y1="45.7" x2="16" y2="40" />
        <line x1="40" y1="16" x2="45.7" y2="10.3" />
      </g>
      <circle cx="28" cy="28" r="16" fill="var(--color-sun-400)" />
    </svg>
  )
}

/* ---------------- 月亮 ---------------- */

function MoonShape() {
  return (
    <svg viewBox="0 0 56 56" className="block h-5 w-5" aria-hidden focusable="false">
      <defs>
        {/*
          月牙 = 一个圆盘减去一个偏移的圆。
          ⚠️ 用 `mask` 而不是手写两段 `A` 弧的 path：弧的两个端点必须是两个圆的
          **真实交点**，算错了画出来是一瓣奇怪的东西，而且改一个半径就得重算。
          `maskUnits="userSpaceOnUse"` 必须写 —— 默认按元素 bbox 取 -10%..120%，
          那个区域里没有我们铺的白底 rect，整个月亮会被遮掉。
        */}
        <mask id="kqf-moon-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="56" height="56">
          <rect x="0" y="0" width="56" height="56" fill="#fff" />
          <circle cx="40" cy="22" r="18" fill="#000" />
        </mask>
      </defs>
      <circle cx="28" cy="28" r="25" fill="var(--color-sun-200)" opacity="0.3" />
      <circle cx="28" cy="28" r="20" fill="var(--color-sun-100)" mask="url(#kqf-moon-mask)" />
    </svg>
  )
}

/* ---------------- 云朵 ---------------- */

function Cloud({ className, delay }: { className: string; delay: string }) {
  return (
    <span
      className={clsx('kqf-cloud absolute flex items-end', className)}
      style={{ animationDelay: delay }}
      aria-hidden
    >
      <span className="block h-6 w-14 rounded-full bg-white/85 blur-[1px]" />
      <span className="-ml-4 block h-9 w-9 rounded-full bg-white/90 blur-[1px]" />
      <span className="-ml-3 block h-5 w-10 rounded-full bg-white/80 blur-[1px]" />
    </span>
  )
}
