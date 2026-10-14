import clsx from 'clsx'
import { celestialFor, skyToneFor, type FarmClock } from '@/domain/farmClock'

/* ============================================================
   农场的天空
   ------------------------------------------------------------
   ★ 为什么天空单独一个文件，而不是留在 `FarmPage.tsx`：
   色调和「太阳 / 月亮的位置」**都从农场小时算**，而小时是
   `domain/farmClock.ts` 算的。把「算时间」和「用时间」分开之后，
   顶栏的 `hh:mm` 和这片天空就不可能走散
   （本项目已经因为 `Task` / `TaskInstance` 存两份出过「改得分不生效」）。

   ★ 为什么太阳从 emoji 换成内联 SVG：
   emoji 的粗细 / 配色 / 基线由系统 emoji 字体决定，**永远调不了** ——
   在 56px 这个尺寸上，☀️ 和旁边的内联 SVG 作物明显不是一套东西。
   和 `cropSprites.tsx` / `animalSprites.tsx` 同一个理由。
   （`➕` / `🌰` / `🔒` 这类**操作提示**仍然用 emoji，它们不是「图案」。）

   ⚠️ 太阳 / 月亮**故意不做成 `<symbol>` 精灵**：精灵是为了「同一张图被画很多次」
   （12 块地、8 种动物 × 2 帧）。天空一天只画一个，直接内联更短也更好读。

   ★ 为什么这件事值得做（而不是「凭空加一层装饰」）：
   `farmClockAt` 的小时**已经在顶栏显示**了，天空只是跟着同一个值走。
   反面例子是 spec §8.5 的「地块皮」—— 它要的「已浇水 / 干旱 / 肥沃」
   三个状态游戏里根本不存在，所以做不了。
   判据是：**这个外观对应的状态，存在吗？** 这里存在。
   ============================================================ */

/** 夜空里的星星：固定位置（[x%, y%, 闪烁延迟 s]），只在夜里渲染 */
const STARS: Array<[number, number, number]> = [
  [9, 20, 0],
  [21, 9, 0.6],
  [33, 30, 1.2],
  [45, 14, 0.3],
  [57, 34, 1.5],
  [68, 11, 0.9],
  [80, 26, 0],
  [90, 44, 1.8],
  [14, 46, 2.1],
  [73, 52, 1.1],
]

export function Sky({ clock }: { clock: FarmClock }) {
  const tone = skyToneFor(clock.hour)
  const body = celestialFor(clock.hour)

  return (
    <div className={clsx('kqf-sky', `kqf-sky--${tone}`)} aria-hidden>
      {tone === 'night' ? (
        <div className="kqf-sky__stars">
          {STARS.map(([x, y, delay], i) => (
            <span
              key={i}
              className="kqf-star"
              style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      ) : null}

      {/*
        太阳 / 月亮。
        ⚠️ 定位在**外层**（`.kqf-sky__body` 的 `translate(-50%, -50%)`），
        浮动动画在**内层** —— `anim-float` 的 keyframes 也是写 `transform`，
        两层不分开就会互相覆盖（外层那个居中变换会被动画顶掉，
        太阳就会「左上角对齐」而不是中心对齐）。
        `data-sky-body` 是给走查脚本读的稳定锚点（别用下标定位）。
      */}
      <span
        className="kqf-sky__body"
        data-sky-body={body.kind}
        style={{ left: `${body.x * 100}%`, top: `${body.y * 100}%` }}
      >
        <span className="block anim-float">
          {body.kind === 'sun' ? <SunShape /> : <MoonShape />}
        </span>
      </span>

      <Cloud className="left-[8%] top-12" delay="0s" />
      <Cloud className="left-[52%] top-24" delay="1.4s" />
      <Cloud className="left-[74%] top-4" delay="2.6s" />
    </div>
  )
}

/* ---------------- 太阳 ---------------- */

function SunShape() {
  return (
    <svg viewBox="0 0 56 56" className="h-14 w-14" aria-hidden focusable="false">
      {/* 外圈光晕 */}
      <circle cx="28" cy="28" r="26" fill="var(--color-sun-300)" opacity="0.3" />
      {/* 八根光芒 */}
      <g stroke="var(--color-sun-400)" strokeWidth="3.2" strokeLinecap="round">
        <line x1="28" y1="4" x2="28" y2="10" />
        <line x1="28" y1="46" x2="28" y2="52" />
        <line x1="4" y1="28" x2="10" y2="28" />
        <line x1="46" y1="28" x2="52" y2="28" />
        <line x1="11" y1="11" x2="15.2" y2="15.2" />
        <line x1="40.8" y1="40.8" x2="45" y2="45" />
        <line x1="11" y1="45" x2="15.2" y2="40.8" />
        <line x1="40.8" y1="15.2" x2="45" y2="11" />
      </g>
      <circle cx="28" cy="28" r="15" fill="var(--color-sun-400)" />
      {/* 左上高光，让圆盘不是一个死板的实心圆 */}
      <circle cx="24" cy="24" r="8" fill="var(--color-sun-200)" opacity="0.55" />
    </svg>
  )
}

/* ---------------- 月亮 ---------------- */

function MoonShape() {
  return (
    <svg viewBox="0 0 56 56" className="h-11 w-11" aria-hidden focusable="false">
      <defs>
        {/*
          月牙 = 一个圆盘减去一个偏移的圆。
          ⚠️ 用 `mask` 而不是手写两段 `A` 弧的 path：
          path 的两个端点必须是两个圆的**真实交点**，算错了会画成一瓣奇怪的东西，
          而且改一个半径就得重算一遍。mask 是「所见即所得」的。
          `maskUnits="userSpaceOnUse"` 必须写 —— 默认是按元素的 bbox 取 -10%..120%，
          那个区域里没有我们铺的白底 rect，整个月亮会被遮掉。
        */}
        <mask id="kqf-moon-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="56" height="56">
          <rect x="0" y="0" width="56" height="56" fill="#fff" />
          <circle cx="38" cy="24" r="17" fill="#000" />
        </mask>
      </defs>
      {/* 月光晕 */}
      <circle cx="28" cy="28" r="26" fill="var(--color-sun-200)" opacity="0.22" />
      <circle cx="28" cy="28" r="18" fill="var(--color-sun-100)" mask="url(#kqf-moon-mask)" />
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
