import type { StoreTint } from '../../games/storefront'

/**
 * 游戏图标 —— 手画的矢量插画，**不是 emoji 套一个色块**。
 *
 * ## 为什么换掉 emoji
 *
 * 原来列表里那颗图标是「58px 着色方块 + 一个 emoji」。问题不在 emoji 本身，
 * 在于它**没有纵深**：一块平色 + 一个系统字形，和旁边 iOS 应用市场那种
 * 带底纹、带高光、带主体的图标放在一起，一眼就显得是占位图。
 * 家长原话：「各个游戏的图标能否搞好点，现在的毫无吸引力。」
 *
 * ## 这里的做法
 *
 * 一个 App Store 图标的三层，缺一层就会「平」：
 *
 *   1. **底**：竖向双色渐变（上亮下深）—— 单色平涂是廉价感的主要来源。
 *   2. **顶光**：上沿一道白色到透明的渐变，模拟受光面。
 *   3. **主体**：每个游戏自己的一件东西（麦穗 / 谷仓 / 礼物 / 娃娃机），
 *      带自己的明暗和高光，**不描外轮廓**（描边会把它变回贴纸）。
 *
 * 主体是按 id 画的，所以**新加游戏要么在这里加一支，要么落到通用那支**。
 * 通用那支（摇杆）不假装是那个游戏 —— 比随便挑个 emoji 诚实。
 *
 * ## 为什么不用位图
 *
 * `public/store/` 里那些是**截图**，塞进 58px 会糊成一团色块。图标要的是
 * 一个可辨识的剪影，矢量在 58px / 80px / 平板 2x 下都清晰，而且整组加起来
 * 不到 4 KB —— 这个项目一直在盯 APK 体积。
 *
 * ⚠️ 渐变 id 必须带上 `id + tint`：同一页里两款游戏同时出现时，
 *   重复的 id 会让后一个引用到前一个的渐变（颜色会「串」）。
 */

/** 底色三档：`[上, 下, 暗部]`。暗部是主体阴影和远景用的，不是第四种颜色 */
const BG: Record<StoreTint, [string, string, string]> = {
  grass: ['#D9F3AC', '#79C24E', '#3C8628'],
  sky: ['#D3EBFF', '#6FB2F2', '#2C6AB8'],
  sun: ['#FFEDB4', '#F7B93C', '#B0700C'],
  berry: ['#FFCBE5', '#C883EC', '#8B3EC4'],
}

/**
 * 内置农场用 `sun`（麦田），云边小农场用 `grass`（草地）。
 *
 * 两个都是农场，**底色必须分开**，否则同一组里两行图标看起来是同一款游戏。
 * 内置那个没有 `tint` 字段（`GameDef` 里没有这个概念），所以在调用处给默认值。
 */
export const DEFAULT_TINT: StoreTint = 'sun'

export function GameIconArt({
  id,
  tint = DEFAULT_TINT,
  className,
}: {
  id: string
  tint?: StoreTint
  className?: string
}) {
  const [top, bottom, deep] = BG[tint] ?? BG[DEFAULT_TINT]
  const uid = `${id}-${tint}`
  const bgId = `gi-${uid}-bg`
  const glossId = `gi-${uid}-gloss`

  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id={bgId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
        {/* 顶光：只盖底，不盖主体 —— 盖住主体会把它的高光洗掉 */}
        <linearGradient id={glossId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".38" />
          <stop offset=".45" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" fill={`url(#${bgId})`} />
      <rect width="64" height="64" fill={`url(#${glossId})`} />

      {id === 'farm' && <Farm deep={deep} />}
      {id === 'cloudfarm' && <CloudFarm deep={deep} />}
      {id === 'prizepark' && <PrizePark deep={deep} />}
      {id === 'claw3d' && <ClawMachine />}
      {!['farm', 'cloudfarm', 'prizepark', 'claw3d'].includes(id) && <Fallback deep={deep} />}
    </svg>
  )
}

/* ============================ 四支主体 ============================ */

/** 农场：太阳 + 两道丘 + 一束麦穗（金黄 → 麦田，和云边小农场的绿色分开） */
function Farm({ deep }: { deep: string }) {
  return (
    <g>
      <path d="M0 42c10-6 20-6 30-1s22-3 34-1v24H0Z" fill={deep} opacity=".4" />
      <path d="M0 51c12-6 24-6 34-1s20-2 30-1v15H0Z" fill={deep} opacity=".78" />
      <circle cx="46" cy="15" r="10" fill="#FFF6C4" opacity=".5" />
      <circle cx="46" cy="15" r="6.2" fill="#FFD645" />

      <path
        d="M23 57c0-10 .5-19 1.5-28"
        stroke="#F0B93C"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
      <g fill="#FFD86B" stroke="#D08F18" strokeWidth=".6">
        <ellipse cx="19.6" cy="34" rx="2.7" ry="4.4" transform="rotate(-26 19.6 34)" />
        <ellipse cx="28.4" cy="34" rx="2.7" ry="4.4" transform="rotate(26 28.4 34)" />
        <ellipse cx="19.9" cy="41" rx="2.7" ry="4.4" transform="rotate(-26 19.9 41)" />
        <ellipse cx="28.1" cy="41" rx="2.7" ry="4.4" transform="rotate(26 28.1 41)" />
        <ellipse cx="20.4" cy="48" rx="2.6" ry="4.2" transform="rotate(-26 20.4 48)" />
        <ellipse cx="27.6" cy="48" rx="2.6" ry="4.2" transform="rotate(26 27.6 48)" />
        <ellipse cx="24.4" cy="27.6" rx="2.4" ry="3.8" />
      </g>
    </g>
  )
}

/**
 * 云边小农场：一朵云托着谷仓，云下是草地。
 *
 * ⚠️ 谷仓是**红顶 + 奶油墙**，不是白顶 —— 白顶压在白云上等于没有顶，
 * 远看就是一个红色方块浮在白色上（第一版就是这样，截图里一眼看不出来）。
 * 红顶在白底上才立得住。
 */
function CloudFarm({ deep }: { deep: string }) {
  return (
    <g>
      <path d="M0 48c12-5 24-5 34-1s20-2 30-1v18H0Z" fill={deep} opacity=".5" />
      <path d="M0 55c14-4 26-3 36 0s18 1 28 0v9H0Z" fill={deep} opacity=".85" />

      {/* 云：先画一层往下错开的浅蓝当暗面，再画白的 —— 否则是块白饼 */}
      <g fill="#DCEAF9" transform="translate(0 2.2)">
        <circle cx="16" cy="36" r="9" />
        <circle cx="31" cy="32" r="11" />
        <circle cx="46" cy="36" r="9" />
        <rect x="8" y="34" width="48" height="10" rx="5" />
      </g>
      <g fill="#FFFFFF">
        <circle cx="16" cy="36" r="9" />
        <circle cx="31" cy="32" r="11" />
        <circle cx="46" cy="36" r="9" />
        <rect x="8" y="34" width="48" height="10" rx="5" />
      </g>

      {/* 谷仓 */}
      <rect x="23.5" y="12" width="17" height="12" fill="#FFF6E6" />
      <path d="M35.6 12h4.9v12h-4.9Z" fill="#E7D8C2" />
      <path d="M20.5 12 32 4.5 43.5 12Z" fill="#D9553F" />
      <rect x="30" y="17.5" width="4.6" height="6.5" fill="#D9553F" />
      <rect x="30.4" y="7.6" width="3.2" height="3" fill="#FFD9A0" />
    </g>
  )
}

/** 抓奖乐园：爪子吊着一只礼物盒（抓 → 奖品） */
function PrizePark({ deep }: { deep: string }) {
  return (
    <g>
      <g fill="#FFFFFF" opacity=".8">
        <path d="m13 10 1.5 3.4 3.4 1.5-3.4 1.5L13 19.8l-1.5-3.4L8.1 14.9l3.4-1.5Z" />
        <path d="m51 20 1.1 2.5 2.5 1.1-2.5 1.1L51 27.2l-1.1-2.5-2.5-1.1 2.5-1.1Z" />
      </g>

      {/* 吊杆 + 爪子（金属色，和粉色底拉开） */}
      <rect x="30.8" y="0" width="2.4" height="11" rx="1.2" fill="#E9ECF7" />
      <circle cx="32" cy="13.5" r="3.4" fill="#F8F9FE" stroke="#BFC5DC" strokeWidth=".9" />
      <path
        d="M31 16.6c-3.4 2.9-6.4 6-7.4 10.4"
        stroke="#E9ECF7"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M33 16.6c3.4 2.9 6.4 6 7.4 10.4"
        stroke="#E9ECF7"
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="23.4" cy="28" r="2.1" fill="#F8F9FE" stroke="#BFC5DC" strokeWidth=".8" />
      <circle cx="40.6" cy="28" r="2.1" fill="#F8F9FE" stroke="#BFC5DC" strokeWidth=".8" />

      {/* 礼物盒 */}
      <rect x="19.5" y="39" width="25" height="17" rx="2.2" fill="#FFC02E" />
      <path d="M37 39h5.3a2.2 2.2 0 0 1 2.2 2.2v12.6a2.2 2.2 0 0 1-2.2 2.2H37Z" fill={deep} opacity=".22" />
      <rect x="18" y="33" width="28" height="7.5" rx="2.4" fill="#FFD34E" />
      <rect x="30" y="33" width="4" height="23" fill="#FF5C8A" />
      <circle cx="28.6" cy="30.8" r="3.4" fill="#FF5C8A" />
      <circle cx="35.4" cy="30.8" r="3.4" fill="#FF5C8A" />
      <circle cx="32" cy="31.2" r="2.1" fill="#FFE07A" />
    </g>
  )
}

/** 抓娃娃：粉色机台（顶棚 + 玻璃柜 + 底座），柜里一只小熊 */
function ClawMachine() {
  return (
    <g>
      {/* 底座 */}
      <rect x="10" y="43" width="44" height="15" rx="3" fill="#FF9CC6" />
      <rect x="13" y="47" width="38" height="8" rx="2" fill="#F5679F" />
      <rect x="16" y="48" width="10" height="7" rx="1.5" fill="#5B4A6B" opacity=".5" />

      {/* 玻璃柜 */}
      <rect x="10" y="17" width="44" height="26" rx="3" fill="#FFFFFF" opacity=".4" />
      <rect
        x="10"
        y="17"
        width="44"
        height="26"
        rx="3"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.6"
        opacity=".95"
      />

      {/* 顶棚 + 招牌 */}
      <rect x="8" y="11" width="48" height="7.5" rx="2.5" fill="#FF6FA8" />
      <rect x="8" y="11" width="48" height="3" rx="1.5" fill="#FFA9CC" opacity=".8" />
      <rect x="23" y="4" width="18" height="6" rx="2" fill="#FFFFFF" opacity=".92" />

      {/* 柜里的娃娃堆 */}
      <ellipse cx="22" cy="40" rx="5.5" ry="3.4" fill="#E3C39A" />
      <ellipse cx="41" cy="40" rx="5" ry="3.2" fill="#D5AC7C" />
      <ellipse cx="31.5" cy="41" rx="5.5" ry="3.2" fill="#EFD3AE" />

      {/* 爪子（在小熊后面，所以先画） */}
      <rect x="31.2" y="18" width="1.6" height="8" fill="#DCE1F0" />
      <circle cx="32" cy="26.5" r="2.2" fill="#F8F9FE" stroke="#C2C8DC" strokeWidth=".8" />
      <path
        d="M31 28.6c-2 2-3.2 3.3-3.6 4.9"
        stroke="#DCE1F0"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M33 28.6c2 2 3.2 3.3 3.6 4.9"
        stroke="#DCE1F0"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />

      {/* 小熊 */}
      <circle cx="28.6" cy="31.2" r="1.9" fill="#C4873F" />
      <circle cx="35.4" cy="31.2" r="1.9" fill="#C4873F" />
      <circle cx="32" cy="34.6" r="4.7" fill="#D9A05B" />
      <ellipse cx="32" cy="36.4" rx="2.4" ry="1.8" fill="#F6E3C9" />
      <circle cx="30.4" cy="33.7" r=".72" fill="#4A3728" />
      <circle cx="33.6" cy="33.7" r=".72" fill="#4A3728" />
      <circle cx="32" cy="35.5" r=".6" fill="#8B5E34" />
    </g>
  )
}

/**
 * 通用那支：一支摇杆。
 *
 * 将来远程装进来的游戏没有专属图形 —— 与其随便挑个 emoji（会让人以为
 * 那是它的官方图标），不如给一个中性的「这是一个游戏」。
 */
function Fallback({ deep }: { deep: string }) {
  return (
    <g>
      <ellipse cx="32" cy="46" rx="17" ry="6" fill={deep} opacity=".4" />
      <rect x="29.4" y="25" width="5.2" height="20" rx="2.6" fill="#FFFFFF" opacity=".92" />
      <circle cx="32" cy="20" r="7.2" fill="#FFFFFF" />
      <circle cx="32" cy="20" r="7.2" fill="none" stroke={deep} strokeWidth="1.1" opacity=".28" />
      <circle cx="29.6" cy="17.6" r="2.1" fill="#FFFFFF" opacity=".9" />
    </g>
  )
}
