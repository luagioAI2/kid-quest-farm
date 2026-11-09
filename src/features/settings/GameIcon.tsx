import type { ReactElement } from 'react'
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
  // 金色要**暖而亮**：偏红偏深就变成沙丘了（第一版 #F7B93C→#B0700C 就是）
  sun: ['#FFF0C4', '#F5BE4A', '#A9761A'],
  berry: ['#FFCBE5', '#C883EC', '#8B3EC4'],
}

/**
 * 内置农场用 `sun`（麦田），云边小农场用 `grass`（草地）。
 *
 * 两个都是农场，**底色必须分开**，否则同一组里两行图标看起来是同一款游戏。
 * 内置那个没有 `tint` 字段（`GameDef` 里没有这个概念），所以这里给默认值。
 */
const DEFAULT_TINT: StoreTint = 'sun'

export function GameIconArt({
  id,
  tint = DEFAULT_TINT,
  className,
  wide = false,
}: {
  id: string
  tint?: StoreTint
  className?: string
  /**
   * 4:3 横幅版（96×72）：底色**铺满整块卡片**，主体还是那一支。
   *
   * 心愿商城的列表卡是 153×115 的 4:3 底。正方形图标放进去只有 72px，
   * 四周空一大圈，和隔壁「实物商品」的满幅插画摆在一起像两种东西。
   * 横幅版把同一支主体放大到 **1.125 倍**（64×64 → 72×72）摆进 96×72 的画布
   * （`translate(12 0)`），底色矩形跟着变宽 —— 主体那 1200 行一个字都不用改。
   *
   * ⚠️ **倍率只能是 1.125**。这一档刚好让主体撑满画布高度、一点不裁：
   *    · 再小（比如 1.0）主体只占 89% 高，横向多出来的 32px 全是空渐变，
   *      `deckrush` 那种「牌本来就小」的会被放大成一张空卡；
   *    · 再大就会裁掉上下（`farm` / `cloudfarm` 的田垄和地基在 y=64 上）。
   *    缩到 0.9 更糟：主体自带的地面被抬离下沿，底下露出一条纯渐变，
   *    看着像地面浮起来了。
   * ⚠️ 渐变 id 要带 `-w`：同一页里正方形版和横幅版会同时出现（列表 + 详情），
   * id 撞了颜色会串。
   */
  wide?: boolean
}) {
  const [top, bottom, deep] = BG[tint] ?? BG[DEFAULT_TINT]
  const uid = `${id}-${tint}${wide ? '-w' : ''}`
  const bgId = `gi-${uid}-bg`
  const glossId = `gi-${uid}-gloss`
  /** 没有专属图形就用兜底那支 —— 不在表里 ≠ 报错，但也不假装是那个游戏 */
  const Art = ART[id] ?? Fallback
  const w = wide ? 96 : 64
  const h = wide ? 72 : 64

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={className} aria-hidden focusable="false">
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

      <rect width={w} height={h} fill={`url(#${bgId})`} />
      <rect width={w} height={h} fill={`url(#${glossId})`} />

      {wide ? (
        <g transform="translate(12 0) scale(1.125)">
          <Art deep={deep} />
        </g>
      ) : (
        <Art deep={deep} />
      )}
    </svg>
  )
}

/**
 * id → 主体。**这是唯一的清单**。
 *
 * 原来写的是「四个 `id === 'x' && <X/>` + 一个 `!['a','b','c','d'].includes(id)`
 * 才画兜底」—— 同一份 id 列表写了两遍。加一支新主体却忘了改那个数组时，
 * 新图形和兜底**会同时画出来**（叠在一起），而且不报错。
 *
 * 换成表之后只有一个事实：不在表里就是兜底。`GameIcon.test.tsx` 钉着
 * 「商店里的每一款都有自己那一支」，漏了会红。
 */
const ART: Record<string, (p: { deep: string }) => ReactElement> = {
  farm: Farm,
  cloudfarm: CloudFarm,
  prizepark: PrizePark,
  claw3d: ClawMachine,
  sugar: Sugar,
  anthill: Anthill,
  moestrike: Moestrike,
  melonjar: Melonjar,
  minergirl: Minergirl,
  ropeland: Ropeland,
  blockfit: Blockfit,
  deckrush: Deckrush,
  corgi: Corgi,
  screamchick: Screamchick,
  sweetspin: Sweetspin,
  renttower: Renttower,
  stackmeow: Stackmeow,
  cellguard: Cellguard,
  redbutton: Redbutton,
  guardshift: Guardshift,
  hoopsneak: Hoopsneak,
  doodlederby: Doodlederby,
  farmlord: Farmlord,
  fall2048: Fall2048,
  inudoku: Inudoku,
}

/**
 * 下落的2048：三块数字砖斜着往下掉，右下角撞出一朵小火花。
 *
 * 只画砖、不画数字 —— 64px 的格子里写「512」是一团糊，家长看不出那是什么。
 * 配色取原版方块表的粉 / 绿 / 蓝三档，和游戏里第一屏能对得上。
 */
function Fall2048({ deep }: { deep: string }) {
  return (
    <g>
      {/* 落地阴影：偏右下，和另外三块的下落方向一致 */}
      <ellipse cx="35" cy="56.5" rx="18" ry="4" fill={deep} opacity=".3" />

      {/* 最上面那块：粉（原版 2 号色） */}
      <rect x="14" y="11" width="17" height="17" rx="4.4" fill="#FF6FB5" />
      <rect x="14" y="11" width="17" height="17" rx="4.4" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity=".55" />

      {/* 中间那块：绿（原版 8 号色），错开半格 */}
      <rect x="27.5" y="24" width="17" height="17" rx="4.4" fill="#3BE07A" />
      <rect x="27.5" y="24" width="17" height="17" rx="4.4" fill="none" stroke="#FFFFFF" strokeWidth="1.4" opacity=".5" />

      {/* 最下面那块：蓝（原版 512 号色），压在最前 */}
      <rect x="19" y="38" width="19" height="19" rx="5" fill="#3D7BFF" />
      <rect x="19" y="38" width="19" height="19" rx="5" fill="none" stroke="#FFFFFF" strokeWidth="1.6" opacity=".6" />
      {/* 高光：统一从左上打过来 */}
      <rect x="22.4" y="41.2" width="7.6" height="3.4" rx="1.7" fill="#FFFFFF" opacity=".38" />

      {/* 合并火花：四道短线，压在右下角，避开三块砖 */}
      <g stroke="#FFD23F" strokeWidth="2.1" strokeLinecap="round">
        <path d="M43.5 45.5l4.2-1.6" />
        <path d="M44.6 50.6l4.4.8" />
        <path d="M41.6 40.4l1.6-4.2" />
      </g>
    </g>
  )
}

/**
 * 犬独：一块按颜色分块的格子，中间蹲着一只垂耳小狗。
 *
 * 不画「每行每列各一只」的完整棋盘 —— 64px 里塞四只狗只会糊成一片色块。
 * 取第一眼能认出的两样东西：**垂耳狗头** + **它占住的那一格**。
 * 棋盘用暖白而不是纯白：底色是 `sun`（金），纯白会把这块金色压成脏黄。
 */
function Inudoku({ deep }: { deep: string }) {
  return (
    <g>
      <ellipse cx="32" cy="57" rx="17" ry="3.6" fill={deep} opacity=".3" />

      {/* 棋盘：暖白 + 一圈浅描边，才有「纸」的厚度 */}
      <rect x="8.5" y="11" width="47" height="41" rx="6.5" fill="#FFFBF0" />
      <rect
        x="8.5"
        y="11"
        width="47"
        height="41"
        rx="6.5"
        fill="none"
        stroke={deep}
        strokeWidth="1.1"
        opacity=".35"
      />

      {/* 分块线：3 竖 2 横。压得很轻 —— 重了就变成「井字棋」 */}
      <g stroke={deep} strokeWidth="1" opacity=".2">
        <path d="M24.2 11v41" />
        <path d="M39.8 11v41" />
        <path d="M8.5 25h47" />
        <path d="M8.5 38h47" />
      </g>

      {/* 耳朵在后：两片下垂的圆角块，比脸暗一档 */}
      <ellipse cx="19.2" cy="33.2" rx="4.4" ry="7.6" fill="#8A5A38" transform="rotate(-18 19.2 33.2)" />
      <ellipse cx="44.8" cy="33.2" rx="4.4" ry="7.6" fill="#8A5A38" transform="rotate(18 44.8 33.2)" />

      {/* 脸 */}
      <ellipse cx="32" cy="33.4" rx="12.2" ry="11.2" fill="#F6E3BE" />
      <ellipse
        cx="32"
        cy="33.4"
        rx="12.2"
        ry="11.2"
        fill="none"
        stroke="#C9A167"
        strokeWidth="1"
        opacity=".65"
      />

      {/* 眼睛 + 鼻子；高光统一从左上打过来 */}
      <ellipse cx="27.6" cy="31.4" rx="1.7" ry="1.9" fill="#4A3423" />
      <ellipse cx="36.4" cy="31.4" rx="1.7" ry="1.9" fill="#4A3423" />
      <ellipse cx="32" cy="36.8" rx="2.2" ry="1.7" fill="#4A3423" />
      <ellipse cx="27.1" cy="30.6" rx=".55" ry=".6" fill="#FFFFFF" opacity=".85" />
      <ellipse cx="35.9" cy="30.6" rx=".55" ry=".6" fill="#FFFFFF" opacity=".85" />
    </g>
  )
}

/** 有专属图形的 id（测试用；也方便一眼看出新增游戏要不要补一支） */
export const GAME_ART_IDS: string[] = Object.keys(ART)

/* ============================ 各支主体 ============================ */

/** 农场：太阳 + 两道丘 + 一束麦穗（金黄 → 麦田，和云边小农场的绿色分开） */
function Farm({ deep }: { deep: string }) {
  return (
    <g>
      {/* 两道丘压得很轻：压深了这块金色就从「麦田」变成「沙丘」 */}
      <path d="M0 42c10-6 20-6 30-1s22-3 34-1v24H0Z" fill={deep} opacity=".3" />
      <path d="M0 51c12-6 24-6 34-1s20-2 30-1v15H0Z" fill={deep} opacity=".55" />
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

/** 我是一个农场主：一根胡萝卜 + 一段篱笆（偷菜农场的招牌画面） */
function Farmlord({ deep }: { deep: string }) {
  return (
    <g>
      {/* 土垄：压在下沿，和云边小农场那条绿丘分开 */}
      <path d="M0 50c10-6 22-6 32-2s22 1 32-2v18H0Z" fill={deep} opacity=".55" />

      {/* 篱笆：两根桩 + 一根横杆 */}
      <g fill="#F6E6C8">
        <rect x="5.5" y="29" width="4" height="21" rx="1.6" />
        <rect x="16" y="34" width="4" height="16" rx="1.6" />
        <rect x="4.5" y="35.4" width="17.5" height="3.4" rx="1.7" />
      </g>

      {/* 胡萝卜：先画暗面再画亮面，否则是一块平橘色 */}
      <path d="M44 21.5c5.2 0 9.3 4.1 9.3 8.9 0 6.2-6.8 15.4-9.3 17.9-2.5-2.5-9.3-11.7-9.3-17.9 0-4.8 4.1-8.9 9.3-8.9Z" fill="#F08A3C" />
      <path d="M47.8 23.6c3.5 1.1 5.5 3.7 5.5 6.8 0 4.8-4.6 11.8-7.2 15.1 1.5-4.6 3.7-9.8 3.7-13.9 0-3.3-.9-5.8-2-8Z" fill="#D96F26" opacity=".65" />

      {/* 缨：三片叶子，深浅错开 */}
      <path d="M44 21.5c-1-4.2-3.5-6.9-6.7-8.4 2.7 3.1 4 5.7 4.2 9Z" fill="#5FA83C" />
      <path d="M44 21.5c1.7-4.2 4.8-6.5 8.4-7.1-3.4 2.7-5.5 5-6.1 8Z" fill="#7BC24A" />
      <path d="M44 21.5c0-4.6 1.5-7.8 3.6-9.9-1.3 3.8-1.7 6.7-1.1 9.9Z" fill="#4E9330" />
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
 * 甜点魔法学院：一碟布丁（焦糖顶 + 樱桃），底下两颗糖珠。
 *
 * 为什么画布丁而不是画「棋盘」：前四支都是**机器 / 田地**（摇杆、爪子、田垄），
 * 72px 的小格里画格子盘会糊成一片马赛克；而布丁的**梯形剪影**在小尺寸下
 * 依然一眼可辨，也和「甜点」这个名字对得上。
 *
 * 底下那两颗糖珠是唯一的玩法提示（这是个三消游戏），**只放两颗**：
 * 放一排就变成「棋盘」，又回到糊掉那条路上了。
 */
function Sugar({ deep }: { deep: string }) {
  return (
    <g>
      {/* 盘子 */}
      <ellipse cx="32" cy="53" rx="18" ry="3.8" fill={deep} opacity=".26" />

      {/* 布丁主体：上窄下宽的梯形 */}
      <path d="M19.5 29h25l4 17.2c.5 2.1-1.1 4-3.3 4H18.8c-2.2 0-3.8-1.9-3.3-4Z" fill="#FFF0D2" />
      {/* 左侧高光：不加的话整块奶油色是平的 */}
      <path d="M23 32h5.4l-3 14.6h-4.3Z" fill="#FFFFFF" opacity=".6" />

      {/* 焦糖顶：上缘圆、下缘挂两滴 */}
      <path
        d="M18.6 29c0-3.5 2.8-6.3 6.3-6.3h14.2c3.5 0 6.3 2.8 6.3 6.3 0 2.3-1.9 3.3-3.5 2.1-1.6-1.2-2.5.4-4.2.4-2.5 0-2.8-2.1-5.2-2.1s-2.7 2.1-5.2 2.1c-1.7 0-2.6-1.6-4.2-.4-1.6 1.2-3.5.2-3.5-2.1Z"
        fill="#C4833F"
      />

      {/* 樱桃 + 梗 */}
      <circle cx="32" cy="16.6" r="4.8" fill="#E24B4A" />
      <circle cx="30.4" cy="15" r="1.4" fill="#FFFFFF" opacity=".55" />
      <path d="M32 11.8c.5-2.4 2-3.7 4-4.1" stroke="#5C8B3A" strokeWidth="1.7" fill="none" strokeLinecap="round" />

      {/* 两颗糖珠：唯一的玩法提示 */}
      <circle cx="10.5" cy="50.5" r="3.1" fill="#8FD3EE" />
      <circle cx="53.5" cy="50.5" r="3.1" fill="#FFE38A" />
    </g>
  )
}

/**
 * 蚂蚁搬家：一座蚁丘（洞口朝右下）+ 一只扛着叶子的蚂蚁。
 *
 * 为什么画「丘 + 叶子」而不是画蚂蚁特写：蚂蚁的**剪影**在小尺寸下和一只蜘蛛、
 * 一只苍蝇分不开（都是「三个小球 + 几条腿」）；而**土丘的弧线**加一片明显
 * 比蚂蚁大的叶子，72px 下才认得出「这是在搬东西」。
 *
 * 洞口那块深色是必要的：没有它，土丘就是一团米色，看着像个石头。
 */
function Anthill({ deep }: { deep: string }) {
  return (
    <g>
      {/* 地面阴影 */}
      <ellipse cx="32" cy="54" rx="20" ry="3.4" fill={deep} opacity=".26" />

      {/* 蚁丘：后面一小丘 + 前面一大丘（两层才有体积） */}
      <path d="M8.4 53c0-5.4 4.4-9.6 9.8-9.6S28 47.6 28 53Z" fill="#C99C64" />
      <path d="M20 53c0-8.6 7.4-15 16.4-15S52.8 44.4 52.8 53Z" fill="#E0B87F" />

      {/* 洞口 */}
      <ellipse cx="37" cy="48.6" rx="4.6" ry="3.8" fill="#4B3023" />

      {/* 扛着叶子的蚂蚁：头 / 胸 / 腹 + 两条腿 */}
      <g fill="#3E2A20">
        <circle cx="28.6" cy="30.6" r="2.5" />
        <circle cx="33.2" cy="28.9" r="2.1" />
        <ellipse cx="37.8" cy="30.7" rx="3.2" ry="2.6" />
      </g>
      <path d="M30.8 32.6 27.6 35.6M34.6 32.2 36.2 35.8" stroke="#3E2A20" strokeWidth="1.1" strokeLinecap="round" fill="none" />

      {/* 叶子：比蚂蚁明显大一圈，才看得出「在搬」 */}
      <path d="M33.6 25.2c2.6-5.2 9.4-7.2 13.4-5 2.4 1.3 2.2 4.4-.6 6-4.4 2.6-10.2 1.8-12.8-1Z" fill="#7CB342" />
      <path d="M34.6 25.6c3.8 1.2 8 1 11.2-.8" stroke="#5E8F32" strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  )
}

/**
 * 少女战记：一把剑 + 两点星芒。
 *
 * 这一款的画面是「粉紫天空 + 城堡 + 少女」，战斗本身是弹弓式的，
 * 但**弹弓在 58px 下认不出来**（三根皮筋糊成一团）。剑的剪影更稳：
 * 一条竖线 + 一道横挡，缩到 58px 依然一眼是「战斗」。
 *
 * 星芒只加两点、而且不对称 —— 对称摆会变成「装饰花纹」，不像战记。
 * 底色用 `berry`（粉紫），和它的实际配色一致，也和另外五款的绿/蓝/金分开。
 */
function Moestrike({ deep }: { deep: string }) {
  return (
    <g>
      {/* 地面阴影：先画，压住剑首下方的浮空感 */}
      <ellipse cx="32" cy="58" rx="12" ry="3" fill={deep} opacity=".24" />

      {/* 剑身：上窄下宽的一点锥度，纯直条会像「一根棍子」 */}
      <path d="M32 5.6 35.9 17v22.6H28.1V17Z" fill="#EEF4FF" />
      {/* 受光侧：只占剑身左侧 1/3，是「金属」和「纸片」的分界 */}
      <path d="M32 7.6 33.7 17v20.6h-1.7Z" fill="#FFFFFF" opacity=".8" />
      {/* 背光侧压一点冷色，剑身才有厚度 */}
      <path d="M35.9 17v22.6h-1.6V17Z" fill="#A9BCE8" opacity=".75" />

      {/* 护手：金色，下沿一道深色 —— 缺了它就是一块黄油 */}
      <rect x="20.4" y="39.6" width="23.2" height="5" rx="2.5" fill="#F5C64B" />
      <rect x="20.4" y="42.8" width="23.2" height="1.8" rx=".9" fill="#C9922A" opacity=".8" />
      {/* 护手中央那颗宝石：这一款的水晶是彩虹星，一颗小石头就够了 */}
      <circle cx="32" cy="42.1" r="2.2" fill="#FFF3C6" />
      <circle cx="32" cy="42.1" r="1.15" fill="#7A4FB5" opacity=".55" />

      {/* 握把 + 剑首（剑首比握把宽一圈，不然像棒棒糖） */}
      <rect x="29.7" y="44.6" width="4.6" height="9" rx="2.3" fill="#7A4FB5" />
      <circle cx="32" cy="55.4" r="2.7" fill="#F5C64B" />
      <circle cx="31.2" cy="54.5" r=".95" fill="#FFF2C9" />

      {/* 星芒：一大一小、不对称 —— 对称摆会变成装饰花纹 */}
      <path d="M14.6 12.2l1.5 4.1 4.1 1.5-4.1 1.5-1.5 4.1-1.5-4.1-4.1-1.5 4.1-1.5Z" fill="#FFE9A8" />
      <path d="M49 20.4l.9 2.5 2.5.9-2.5.9-.9 2.5-.9-2.5-2.5-.9 2.5-.9Z" fill="#FFE9A8" opacity=".9" />
    </g>
  )
}

/**
 * 爆汁瓜瓜罐：一只玻璃罐，里面一颗带条纹的西瓜。
 *
 * 画的顺序是**从里往外**：先西瓜，再玻璃罐身（半透明白 + 白描边），
 * 最后罐口那圈盖子和左侧高光。反过来先画罐子的话，西瓜会盖在玻璃上，
 * 看着像「西瓜贴在罐子外面」。
 *
 * ⚠️ 玻璃只用 `fillOpacity` 提亮，**不要**给它一个实色底：
 *    58px 下实色会把西瓜糊掉，只剩一个灰方块。
 */
function Melonjar({ deep }: { deep: string }) {
  return (
    <g>
      {/* 罐底阴影：有它罐子才「落在地上」，否则像浮着 */}
      <ellipse cx="32" cy="56.6" rx="13.6" ry="2.8" fill={deep} opacity=".42" />

      {/* 西瓜（在罐里） */}
      <circle cx="32" cy="44.6" r="9.6" fill="#3FAE5A" />
      <circle cx="32" cy="44.6" r="9.6" fill="none" stroke="#2A7F42" strokeWidth="1.1" opacity=".85" />
      {/* 深色条纹：三条竖弧，中间那条最长 */}
      <g stroke="#237A3C" strokeWidth="1.5" fill="none" opacity=".8" strokeLinecap="round">
        <path d="M27.2 37.8c-1.5 4.4-1.5 9.2 0 13.6" />
        <path d="M32 35.5c-1.8 5.4-1.8 12.8 0 18.2" />
        <path d="M36.8 37.8c1.5 4.4 1.5 9.2 0 13.6" />
      </g>
      <ellipse cx="28.5" cy="40.8" rx="2.4" ry="1.5" fill="#FFFFFF" opacity=".5" transform="rotate(-24 28.5 40.8)" />
      <path d="M32 35.2c.1-1.5 1.1-2.5 2.5-2.8" stroke="#2A7F42" strokeWidth="1.6" fill="none" strokeLinecap="round" />

      {/* 玻璃罐身 */}
      <path
        d="M20 26h24v22.4a6.1 6.1 0 0 1-6.1 6.1H26.1A6.1 6.1 0 0 1 20 48.4Z"
        fill="#FFFFFF"
        fillOpacity=".15"
        stroke="#FFFFFF"
        strokeOpacity=".8"
        strokeWidth="1.5"
      />
      {/* 左侧竖高光 */}
      <path d="M23.4 29.8v17.6" stroke="#FFFFFF" strokeOpacity=".7" strokeWidth="1.5" strokeLinecap="round" />

      {/* 罐口 + 盖子（盖子比罐身宽一圈，不然像瓶口） */}
      <rect x="18.2" y="20.4" width="27.6" height="5.6" rx="2.5" fill="#EAF6FF" />
      <rect x="18.2" y="20.4" width="27.6" height="2.1" rx="1.05" fill="#FFFFFF" />
      <rect x="19.6" y="25.6" width="24.8" height="1.5" rx=".75" fill={deep} opacity=".32" />
    </g>
  )
}

/**
 * 挖矿少女：一把镐，镐尖下压着一块矿。
 *
 * 为什么不画矿道剖面 / 矿车：剖面在 58px 下是一堆横线，会和 `anthill` 的土丘、
 * `farm` 的田垄糊成一片；矿车是个小方块，也认不出。**镐的剪影**（一条斜柄 +
 * 一道两端收尖的弯头）缩到 58px 依然一眼是「挖」。
 *
 * 镐头是「两条同向的弧围出来的一条月牙」—— 不是用 stroke 画一根弯条：
 * stroke 的端头是圆的（像镰刀），而两端收尖才像镐。
 *
 * 那块矿不是装饰：没有它，镐是悬空的；有了它，画面讲的是「挖出来的东西」。
 * 矿上两颗金点也是这一款的实际内容（挖矿石卖钱）。
 */
function Minergirl({ deep }: { deep: string }) {
  return (
    <g>
      {/* 地面阴影 */}
      <ellipse cx="32" cy="57.4" rx="17" ry="3.2" fill={deep} opacity=".3" />

      {/* 镐柄：右上 → 左下，斜着才不像一根竖棍 */}
      <path d="M40 17 25.6 55" stroke="#C98A4B" strokeWidth="4.6" strokeLinecap="round" />
      <path d="M39 18.6 24.8 55.4" stroke="#E7B47C" strokeWidth="1.3" strokeLinecap="round" opacity=".8" />

      {/* 镐头：外弧（更弯）减内弧（较平）＝ 两端收尖的月牙 */}
      <path d="M21 27.2Q40 5.4 59 27.2 40 16.2 21 27.2Z" fill="#D5DFEE" />
      {/* 下沿压一道冷色，金属才有厚度 */}
      <path d="M21 27.2Q40 16.2 59 27.2" stroke="#A9B8CE" strokeWidth="1.4" fill="none" />
      {/* 上沿高光 */}
      <path d="M24.8 24.4Q40 9.6 55.2 24.4" stroke="#FFFFFF" strokeWidth="1.3" fill="none" opacity=".65" />

      {/* 矿石：三个面（亮 / 中 / 暗），58px 下才有体积 */}
      <path d="M42.6 53.6 45.4 43.8 52.2 41.6 56.8 47.2 54.4 53.6Z" fill="#9BA8BC" />
      <path d="M45.4 43.8 52.2 41.6 50.6 48.4Z" fill="#C4D0E2" />
      <path d="M50.6 48.4 56.8 47.2 54.4 53.6Z" fill="#7E8CA3" />
      <circle cx="48.2" cy="47.4" r="1.5" fill="#FFD34E" />
      <circle cx="52" cy="50.4" r="1.1" fill="#FFD34E" />
    </g>
  )
}

/**
 * 跳绳羊群：一根甩起来的绳子 + 一只离地的羊。
 *
 * 为什么不画一群羊：58px 下五只羊会糊成一条白带，读者只看得出「有团白色」。
 * 一只悬空的羊 + 一道弧线，剪影清楚，而且「没踩在地上」这件事本身就说明它在跳。
 * 绳子用**细**线（2.2）而不是粗线：粗了会变成一根杠，看着像个球拍。
 */
function Ropeland({ deep }: { deep: string }) {
  return (
    <g>
      {/* 地面：一条浅弧，给「离地」一个参照 */}
      <path d="M0 55c14-4 26-4 38-1s22 1 26 0v9H0Z" fill={deep} opacity=".3" />

      {/* 绳子：两端在下面（被人握着），中段甩到羊脚下 */}
      <path
        d="M9 55.5C13.6 39 26 30.4 40 30.4s25 8 27 25"
        stroke="#B9834E"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* 握把：两个小方块，否则绳子两端像断在空中 */}
      <rect x="6.6" y="53.6" width="5.2" height="4.6" rx="2" fill="#8A5A32" />
      <rect x="64.2" y="53.6" width="5.2" height="4.6" rx="2" fill="#8A5A32" />

      {/* 羊身：云朵状，比正圆更像羊毛 */}
      <path
        d="M35 26.6c-3 0-5.2-1.8-5.2-4.2 0-1.9 1.2-3.4 3-4-.4-.7-.6-1.5-.6-2.3 0-2.7 2.4-4.9 5.4-4.9 1.4 0 2.7.5 3.6 1.3.9-2.1 3.1-3.6 5.7-3.6 2.3 0 4.3 1.1 5.4 2.8.5-.1 1.1-.2 1.7-.2 2.7 0 4.9 1.9 4.9 4.3 0 .7-.2 1.4-.5 2 1.5.7 2.5 2 2.5 3.6 0 2.4-2.3 5.2-5.3 5.2Z"
        fill="#F7F4EC"
      />
      {/* 毛的暗部：只在下半圈，压一点就够 */}
      <path d="M36 20.4c2.4 3.4 9.6 4.6 16.4 1.6" stroke="#D9D2C4" strokeWidth="1.6" fill="none" opacity=".9" />

      {/* 头：偏右，别和身体重叠成一个团 */}
      <ellipse cx="55.4" cy="14.4" rx="6.4" ry="5.6" fill="#4A3A2A" />
      {/* 耳朵：两片向下垂，这是羊最好认的地方 */}
      <ellipse cx="49.8" cy="14.2" rx="2.6" ry="4" fill="#3B2E21" transform="rotate(-18 49.8 14.2)" />
      <ellipse cx="61.2" cy="14.6" rx="2.6" ry="4" fill="#3B2E21" transform="rotate(18 61.2 14.6)" />
      {/* 眼睛：一颗白点，暗头上不点就像一坨墨 */}
      <circle cx="56.4" cy="13.4" r="1.25" fill="#FFFFFF" />

      {/* 腿：离地，四根短短的白线 */}
      <path d="M33.6 26.2v6.4M39 26.6v6.8M47 26.4v6.6M52.4 26v6.4" stroke="#F7F4EC" strokeWidth="2.2" strokeLinecap="round" />
      {/* 跳起的两道浪：有了它才读成「在跳」而不是「贴着绳子站着」 */}
      <path d="M23 35.4h5M67.6 36.4h5" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" opacity=".75" />
    </g>
  )
}

/**
 * 方块填空：一块 4×4 的米白棋盘，被四片彩纸拼片填掉 15 格，右下角留一个空格。
 *
 * 画的**就是它的玩法**：不是「一块拼图」（那会读成七巧板 / 拼图游戏），
 * 而是「几块形状不规则的纸片正好塞满一个方框，只剩一格」。留那一格是关键 ——
 * 填满的棋盘看起来像一张色块图案，留一格才看得出「还差一块」。
 */
function Blockfit({ deep }: { deep: string }) {
  /** 4×4，格 12，原点 (8,10)。用格子坐标写，改布局只改这一组常量 */
  const X = (c: number) => 8 + c * 12
  const Y = (r: number) => 10 + r * 12
  /** 一片拼片 = 一组格子；相邻格子共享边，同色填充所以内部缝隙看不见 */
  const piece = (cells: Array<[number, number]>) =>
    cells.map(([c, r]) => `M${X(c)} ${Y(r)}h12v12h-12z`).join('')

  return (
    <g>
      {/* 投影：只有它，棋盘才是「一张纸」而不是一块贴纸 */}
      <rect x="8" y="12" width="48" height="48" rx="6" fill={deep} opacity=".28" />
      {/* 棋盘：米白纸面 */}
      <rect x="8" y="10" width="48" height="48" rx="6" fill="#FDFBF2" />
      {/* 格线：画在拼片**下面**，空格里才看得见 */}
      <g stroke="#B8C8D8" strokeWidth=".9" opacity=".7">
        <path d="M20 10v48M32 10v48M44 10v48M8 22h48M8 34h48M8 46h48" />
      </g>

      {/* 四片彩纸：颜色取自游戏本体（青 / 蓝 / 紫 / 黄），和棋盘上看到的一致 */}
      <path d={piece([[0, 0], [1, 0], [0, 1]])} fill="#45B7A5" />
      <path d={piece([[2, 0], [3, 0], [3, 1], [3, 2]])} fill="#559CCF" />
      <path d={piece([[0, 2], [0, 3], [1, 3], [2, 3]])} fill="#9274C7" />
      <path d={piece([[1, 1], [2, 1], [1, 2], [2, 2]])} fill="#E7B84B" />

      {/* 纸的受光：只压在棋盘上沿，压多了会把四片颜色洗白 */}
      <rect x="8" y="10" width="48" height="14" rx="6" fill="#FFFFFF" opacity=".16" />

      {/* 空格：右下角留一格，中间一个小圆点表示「这里还要塞一块」 */}
      <circle cx={X(3) + 6} cy={Y(3) + 6} r="1.6" fill={deep} opacity=".38" />
    </g>
  )
}

/**
 * 一分钟卡组：三张扇形摊开的牌，正面那张印着火焰（打的是巨龙）。
 *
 * 为什么不是「一张牌」：单张竖着的牌在 58px 下和一张空白便利贴没区别；
 * 三张错开才有「一叠牌 / 构筑」的意思。正面那张的火焰是游戏里的攻击图标，
 * 也是整组里唯一的高饱和暖色 —— 一眼能从一排图标里挑出来。
 */
function Deckrush({ deep }: { deep: string }) {
  /** 一张牌：中心 (32,34)，22×30。`rot` 绕牌堆底部转，扇形才是从一点散开的 */
  const card = (rot: number, fill: string, key: string) => (
    <g key={key} transform={`rotate(${rot} 32 46)`}>
      <rect x="21" y="19" width="22" height="30" rx="3" fill={fill} stroke={deep} strokeOpacity=".18" strokeWidth=".8" />
    </g>
  )

  return (
    <g>
      {/* 投影：三张一起落在桌面上的那一片 */}
      <ellipse cx="32" cy="53" rx="19" ry="3.6" fill={deep} opacity=".26" />

      {/* 左右两张压在下面，只露出一半 —— 露太多会变成三张一样重的牌 */}
      {card(-24, '#E8D9A8', 'l')}
      {card(24, '#E8D9A8', 'r')}
      {/* 左牌的花色点（天蓝）、右牌的花色点（金）：和游戏里两种稀有度的配色一致 */}
      <circle cx="21.5" cy="26" r="2.2" fill="#357CA5" transform="rotate(-24 32 46)" />
      <circle cx="42.5" cy="26" r="2.2" fill="#E8B839" transform="rotate(24 32 46)" />

      {/* 正面那张：米白牌面 + 火焰 */}
      <rect x="21" y="19" width="22" height="30" rx="3" fill="#FBF3DC" />
      {/* 牌面受光：压在牌面上、**压在图徽下面** —— 压在火焰上面会把焰尖洗白 */}
      <rect x="21" y="19" width="22" height="8" rx="3" fill="#FFFFFF" opacity=".45" />
      {/* 牌面内框：一条细线就够，描粗会像贴纸 */}
      <rect x="23.2" y="21.2" width="17.6" height="25.6" rx="2" fill="none" stroke="#E0CFA4" strokeWidth=".8" />
      {/* 火焰：外焰珊瑚、内焰金 */}
      <path d="M32 25.5c3.4 4.6 5.2 7 5.2 10.1a5.2 5.2 0 0 1-10.4 0c0-3.1 1.8-5.5 5.2-10.1z" fill="#EF8354" />
      <path d="M32 30.5c1.6 2.2 2.5 3.4 2.5 4.9a2.5 2.5 0 0 1-5 0c0-1.5.9-2.7 2.5-4.9z" fill="#E8B839" />
    </g>
  )
}

/**
 * 柯基屁屁：一只从背后看的柯基屁股 —— 一坨橘色圆屁股、下半截两块奶油色脸颊、
 * 中间一道缝、下面两只后爪，顶上落一颗爱心。
 *
 * 为什么是屁股不是一张狗脸：这一款的核心动作就是「戳屁屁攒爱心」，
 * 标题画面上占满整屏的也是屁股。狗脸在 58px 下和别的宠物图标分不开，
 * 屁股 + 一颗爱心一眼就是它，而且那颗爱心正好是游戏里的货币。
 *
 * ⚠️ 第一版画错了，看着像**一张脸**：两块奶油画在正中间、爱心压在头顶 ⇒
 *    「两只眼睛 + 一颗心」。判据是「奶油必须在**下半截**」——
 *    屁股的浅色是两块坐在地上的脸颊，重心低了才是屁股。
 * ⚠️ 橘色不能太浅：底色是金色（`sun`），浅橘和它分不开，整支会糊成一坨。
 */
function Corgi({ deep }: { deep: string }) {
  return (
    <g>
      {/* 投影：屁股是「坐」在草地上的，没有它就飘着 */}
      <ellipse cx="32" cy="55.4" rx="16" ry="2.8" fill={deep} opacity=".24" />

      {/* 两只后爪：先画，上半截被屁股压住；放在屁股外侧下方，才像「坐着」 */}
      <ellipse cx="21.6" cy="51.6" rx="5.2" ry="3.2" fill="#FBEFD8" />
      <ellipse cx="42.4" cy="51.6" rx="5.2" ry="3.2" fill="#FBEFD8" />

      {/* 屁股本体：两瓣橘色叠出来的一个圆坨（比底色深一档，才分得开） */}
      <ellipse cx="23.6" cy="33.6" rx="13.4" ry="15.8" fill="#E07A2E" />
      <ellipse cx="40.4" cy="33.6" rx="13.4" ry="15.8" fill="#E07A2E" />

      {/*
       * 两块奶油脸颊：压在下半截、**彼此留一道橘色缝** —— 这是「像屁股」的关键。
       * ⚠️ 第一版两块挨太近（rx 7.4、中心只差 9.6），并成了一整块白 ⇒ 读成一张脸。
       */}
      <ellipse cx="25.2" cy="42.4" rx="6.8" ry="7.6" fill="#FBEFD8" />
      <ellipse cx="38.8" cy="42.4" rx="6.8" ry="7.6" fill="#FBEFD8" />

      {/* 中缝：压在奶油上，从屁股顶一直切到底 */}
      <path
        d="M32 29.6v19"
        stroke="#C25E1C"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity=".7"
        fill="none"
      />

      {/* 腮红：两块粉，位置在脸颊外侧的奶油上 */}
      <g fill="#F291A8" opacity=".9">
        <ellipse cx="21" cy="44.4" rx="2.2" ry="1.3" transform="rotate(-18 21 44.4)" />
        <ellipse cx="43" cy="44.4" rx="2.2" ry="1.3" transform="rotate(18 43 44.4)" />
      </g>

      {/* 顶光：只压屁股上沿，压多了橘色会发白（0.2 就会像一颗馒头） */}
      <ellipse cx="32" cy="23.4" rx="13" ry="4.4" fill="#FFFFFF" opacity=".12" />

      {/* 爱心：游戏里的货币就是爱心，也是这一款唯一的高饱和色 */}
      <path
        d="M32 20.4c-3.8-2.6-6.4-4.6-6.4-7.4a3.5 3.5 0 0 1 6.4-2 3.5 3.5 0 0 1 6.4 2c0 2.8-2.6 4.8-6.4 7.4z"
        fill="#E0457B"
      />
    </g>
  )
}

/**
 * 尖叫鸡：一只**方块鸡**的头 —— 立方体的三个面（顶亮 / 正面中 / 侧面暗）+ 三瓣红鸡冠
 * + 两只瞪圆的白眼睛 + 一张张开的嘴（里面是粉舌头）+ 下巴那片红肉髯。
 *
 * 为什么不画「一只完整的鸡」：这一款的鸡是**方块做的**，而且整局只有一个动作 ——
 * 脖子往前伸到撞墙。全身鸡在 58px 下会糊成「黄团 + 红点」；而**立方体的三个面**
 * 本身就带体积感，配上张开的嘴，「尖叫的方块鸡」一眼就成立。
 *
 * ⚠️ 嘴必须是**深色的洞**，不能只描一圈红线：58px 下一圈细线会消失，整只鸡就退化成
 *    「一个黄方块 + 两个白点」，读不出它在叫。粉舌头是为了让那个洞不变成「一个黑窟窿」。
 * ⚠️ 肉髯（下巴那两片红）不能省：省了之后红鸡冠 + 黄方块 + 橙嘴 = 一只黄鸭子。
 * ⚠️ 底色用 `sky`（就是它那块**还没铺到的蓝地板**），黄压蓝是整组里对比最强的一对，
 *    所以这支配色直接取游戏原色，不做任何调和。
 */
function Screamchick({ deep }: { deep: string }) {
  return (
    <g>
      {/* 投影：方块头是「立」在地板上的，没有它就浮着 */}
      <ellipse cx="32" cy="58.2" rx="15" ry="2.8" fill={deep} opacity=".3" />

      {/* 鸡冠：先画，底端被方块压住才像长在头上（后画会变成贴在头顶的三片红） */}
      <g fill="#E24B3F">
        <ellipse cx="21.4" cy="17.4" rx="4.2" ry="5.4" transform="rotate(-20 21.4 17.4)" />
        <ellipse cx="30" cy="14" rx="4.6" ry="6.2" />
        <ellipse cx="38.6" cy="17.4" rx="4.2" ry="5.4" transform="rotate(20 38.6 17.4)" />
      </g>

      {/*
       * 肉髯：一片**垂下来**的红，画在方块**之前** —— 上半截被方块头压住，
       * 只露下巴以下那一段，才像长在嘴上而不是贴上去的。
       * ⚠️ 不能画成左右对称的两片：那样一眼是个红蝴蝶结（第一版就是）。
       */}
      <path d="M26.8 49.4c0-1.8 2.3-2.6 5.2-2.6s5.2.8 5.2 2.6c0 4.2-2.4 6.6-5.2 6.6s-5.2-2.4-5.2-6.6Z" fill="#E24B3F" />

      {/* 立方体：顶面（最亮）→ 右侧面（最暗）→ 正面（中间调），三档黄才有体积 */}
      <path d="M18 24.6 24.6 18.6H49.4L42.8 24.6Z" fill="#FFDE6B" />
      <path d="M42.8 24.6 49.4 18.6v24.8l-6.6 6Z" fill="#D9A21F" />
      <path d="M18 24.6h24.8v24.8H18Z" fill="#F5C233" />

      {/* 眼睛：白眼球直径是瞳孔的四倍多，才是这一款那种「瞪圆了」的眼睛 */}
      <circle cx="24.6" cy="32.4" r="5.4" fill="#FFFFFF" />
      <circle cx="36.4" cy="32.4" r="5.4" fill="#FFFFFF" />
      <circle cx="25.4" cy="33" r="2.5" fill="#2A2118" />
      <circle cx="37.2" cy="33" r="2.5" fill="#2A2118" />
      <circle cx="24.4" cy="31.8" r=".9" fill="#FFFFFF" />
      <circle cx="36.2" cy="31.8" r=".9" fill="#FFFFFF" />

      {/* 嘴：上喙一道橙边 → 深色的口腔 → 粉舌头 → 下喙一道橙边 */}
      <path d="M25.4 40.6h13.2" stroke="#E8632E" strokeWidth="2.2" strokeLinecap="round" />
      <path
        d="M26 41.6h12l-1.6 5.8a2.4 2.4 0 0 1-2.3 1.6h-4.2a2.4 2.4 0 0 1-2.3-1.6Z"
        fill="#7C2622"
      />
      <path d="M27.8 45h8.4v1.8a2.2 2.2 0 0 1-2.2 2.2h-4a2.2 2.2 0 0 1-2.2-2.2Z" fill="#F2728C" />
      <path d="M27.4 49.8h9.2" stroke="#E8632E" strokeWidth="2" strokeLinecap="round" />
    </g>
  )
}

/**
 * 旋转灯泡：一块黏土六边形砖 + 一盏点亮的灯泡 + 一截接进来的管道。
 *
 * ⚠️ 三样东西缺一不可，少一样就「读成别的东西」：
 *   · 少了**六边形**，只剩一个灯泡 ⇒ 看起来像「手电筒 / 台灯」类应用；
 *   · 少了**管道**，六边形 + 灯泡 ⇒ 像一块太阳能板；
 *   · 灯泡**必须点亮**（暖黄 + 光晕 + 射线），熄的那个是米白，58px 下等于没有主体。
 *
 * 底色用 `grass`（游戏里那块浅绿背景），砖是米白 —— 和尖叫鸡的「黄压蓝」不撞。
 */
function Sweetspin({ deep }: { deep: string }) {
  return (
    <g>
      {/* 投影：砖是「立」在草地上的 */}
      <ellipse cx="32" cy="55" rx="16" ry="3" fill={deep} opacity=".3" />

      {/* 黏土六边形砖：深一号的侧边 + 米白顶面，才有厚度 */}
      <path d="M32 8 51.6 19.4v22.8L32 53.6 12.4 42.2V19.4Z" fill="#E8D2AE" />
      <path d="M32 8 51.6 19.4v22.8L32 53.6Z" fill="#F6E4C4" />
      <path d="M32 8 12.4 19.4v22.8L32 53.6Z" fill="#FFF7E6" />

      {/* 接进来的管道（游戏里的淡蓝管），从左侧砖边拐进来 */}
      <path
        d="M13.6 34.6h9.2a3.6 3.6 0 0 0 3.6-3.6v-1.4"
        fill="none"
        stroke="#86B6E0"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M13.6 34.6h9.2a3.6 3.6 0 0 0 3.6-3.6v-1.4"
        fill="none"
        stroke="#D6EBFA"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* 光晕：不加的话「亮着」只能靠颜色说，58px 下分不出亮没亮 */}
      <circle cx="35" cy="27.4" r="12.4" fill="#FFD45C" opacity=".28" />
      {/* 射线 */}
      <g stroke="#F5A623" strokeWidth="1.9" strokeLinecap="round" opacity=".95">
        <path d="M35 12.6v2.6" />
        <path d="M24.4 16.6l1.9 1.9" />
        <path d="M45.6 16.6l-1.9 1.9" />
        <path d="M20.6 27.4h2.6" />
        <path d="M46.8 27.4h2.6" />
      </g>
      {/* 灯泡玻璃：暖黄 + 左上高光 */}
      <circle cx="35" cy="27.4" r="8.4" fill="#FFC155" />
      <circle cx="35" cy="27.4" r="8.4" fill="none" stroke="#E5952E" strokeWidth="1" opacity=".55" />
      <path d="M31.4 22.6a4.6 4.6 0 0 1 4.4-1.8" stroke="#FFF1C4" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      {/* 灯头：两道金属螺纹 */}
      <rect x="31.6" y="35" width="6.8" height="4.6" rx="1.6" fill="#9AA5AE" />
      <path d="M31.8 37.2h6.4" stroke="#7C868E" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  )
}

/**
 * 收租公寓：一栋亮着灯的公寓 + 右上角「加盖」的橙色上升箭头。
 *
 * 三件东西缺一不可（58px 下靠它们认出是这款）：
 *   ① **竖向的楼**（不是方块）—— 楼顶压一道女儿墙，才不像一块饼干；
 *   ② **暖黄的窗**（三亮三暗）—— 全亮会变成「写字楼」，全暗又变成「空楼」，
 *      一亮一暗才读得出「有人住、还有空房」；
 *   ③ 右上角的**橙色上升箭头** —— 那是游戏底栏那个「加盖」按钮的动作，
 *      也是这一款唯一的核心动词（盖高 → 收更多租）。
 *
 * ⚠️ 三处踩过的坑（都是截图才看出来的，结构测试一律全绿）：
 *   · 雨棚和门**贴在一起**时，58px 下红 + 深灰糊成一块「红黑坨子」⇒ 中间留一道缝；
 *   · 雨棚 y 算高了会**压到最下一排窗**上，128px 下看着像窗上横了一道红杠；
 *   · 光晕如果**画在窗上面**，暗窗也被蒙一层黄 ⇒ 窗就不「暗」了，光晕要垫在窗下面。
 *
 * 纵向排布（楼体 20.6~56）是算出来的，不是摆的：三排窗 3×5.8 + 两道 2.4 的间隔
 * + 雨棚 1.6 + 门 6.8，上下各留一点余量 —— 改窗高记得连雨棚和门一起挪。
 */
function Renttower({ deep }: { deep: string }) {
  return (
    <g>
      {/* 投影：楼是立在地面上的 */}
      <ellipse cx="32" cy="57.4" rx="15" ry="2.8" fill={deep} opacity=".3" />

      {/* 楼体：正面米白，右立面压深一号，才有厚度 */}
      <rect x="18.6" y="20.6" width="27.4" height="35.4" rx="1.6" fill="#F7E8CB" />
      <path d="M39.4 20.6h6.6v35.4h-6.6Z" fill="#E3CBA4" />
      {/* 女儿墙：压出楼顶的厚度，否则就是一块饼干 */}
      <rect x="16.4" y="16.2" width="31.8" height="5.2" rx="1.6" fill="#CBB08A" />
      <rect x="16.4" y="16.2" width="31.8" height="2.2" rx="1.1" fill="#DCC29C" />

      {/* 光晕垫在窗下面：亮窗才「亮」，暗窗仍然是暗的 */}
      <g fill="#FFD264" opacity=".3">
        <rect x="20.2" y="22.6" width="8.4" height="7.4" rx="1.8" />
        <rect x="29.4" y="30.8" width="8.4" height="7.4" rx="1.8" />
        <rect x="20.2" y="39" width="8.4" height="7.4" rx="1.8" />
      </g>

      {/* 窗：三层，一亮一暗（暗的是空房） */}
      <g>
        <rect x="21" y="23.4" width="6.8" height="5.8" rx="1" fill="#FFD264" />
        <rect x="30.2" y="23.4" width="6.8" height="5.8" rx="1" fill="#8FA3B4" />
        <rect x="21" y="31.6" width="6.8" height="5.8" rx="1" fill="#8FA3B4" />
        <rect x="30.2" y="31.6" width="6.8" height="5.8" rx="1" fill="#FFD264" />
        <rect x="21" y="39.8" width="6.8" height="5.8" rx="1" fill="#FFD264" />
        <rect x="30.2" y="39.8" width="6.8" height="5.8" rx="1" fill="#8FA3B4" />
      </g>

      {/* 门厅：雨棚和门之间留一道缝，58px 下才不糊成一团红黑 */}
      <rect x="24.3" y="49.2" width="9.4" height="6.8" rx="1" fill="#8FA0AE" />
      <rect x="28.6" y="49.2" width=".9" height="6.8" fill="#7C8B99" />
      <rect x="23.3" y="47" width="11.4" height="1.6" rx=".8" fill="#E8604C" />

      {/* 加盖：橙底白箭头（游戏底栏那个动作），白环把角标和楼体分开 */}
      <circle cx="49.2" cy="16.6" r="7.6" fill="#E8604C" stroke="#FFFFFF" strokeWidth="1.4" />
      <path
        d="M49.2 20.2v-7.2M46.3 15.9l2.9-2.9 2.9 2.9"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/**
 * 堆呀堆：一座窄上去的彩色积木塔 + 顶上那块还在滑。
 *
 * 四块从下往上紫 / 青 / 粉 / 黄，是游戏里那套配色（`BLOCK_ASSETS` 的四张图）；
 * 每块比下面窄一点、x 稍微偏一点 —— 这就是「压歪了会被削掉」的样子。
 * 顶上那块单独一块、偏左、离得开一点，读出来是「还在左右滑、还没落」。
 */
function Stackmeow({ deep }: { deep: string }) {
  /** 积木：墨色描边 + 亮色面 + 一条浅高光，和游戏里的涂鸦风一致 */
  const Block = ({
    x,
    y,
    w,
    fill,
  }: {
    x: number
    y: number
    w: number
    fill: string
  }) => (
    <g>
      <rect x={x} y={y} width={w} height="7.4" rx="1.2" fill={fill} stroke="#14110F" strokeWidth="1.3" />
      <rect x={x + 2} y={y + 1.4} width={w - 4} height="1.7" rx=".8" fill="#FFFFFF" opacity=".34" />
    </g>
  )

  return (
    <g>
      {/* 投影：塔是立在地上的 */}
      <ellipse cx="32" cy="56.6" rx="16" ry="2.8" fill={deep} opacity=".3" />

      <Block x={15} y={47.2} w={34} fill="#7B4BD6" />
      <Block x={16.4} y={40.2} w={30.6} fill="#2EC4B6" />
      <Block x={18} y={33.2} w={27.4} fill="#FF3B8D" />
      <Block x={19.4} y={26.2} w={25} fill="#FFD23F" />

      {/* 顶上那块：偏左、离开一截 —— 「还在滑」 */}
      <Block x={11.4} y={13.4} w={21} fill="#FF3B8D" />
      {/* 下落轨迹（虚一点，别抢主体） */}
      <path
        d="M22 21.4v2.4"
        stroke="#14110F"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="1.6 1.8"
        opacity=".55"
      />

      {/* PERFECT 的小星：这一款的正反馈就长这样 */}
      <path
        d="M45.6 12.2l1.1 2.5 2.5 1.1-2.5 1.1-1.1 2.5-1.1-2.5-2.5-1.1 2.5-1.1Z"
        fill="#FFF3B0"
        stroke="#14110F"
        strokeWidth=".7"
      />
    </g>
  )
}

/**
 * 细胞守卫：一颗大病毒压过来，一颗小细胞举着星在底下顶着。
 *
 * 大的是紫色带刺的病毒（游戏里的怪就长这样），小的是青绿色细胞（玩家的英雄「阿兔」），
 * 中间一道抗体弹 —— 「通道上拦病毒」这一件事三样就都说完了。
 * 病毒比细胞大一圈是故意的：这一款的压力来自「怪比你能打」，靠的是摆武器不是硬拼。
 */
function Cellguard({ deep }: { deep: string }) {
  /** 病毒的一根刺：短柄 + 圆头，八根围着球 */
  const Spike = ({ deg }: { deg: number }) => (
    <g transform={`rotate(${deg} 27 25)`}>
      <path d="M27 15.4v-4.6" stroke="#2A1A3E" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="27" cy="10.2" r="2.1" fill="#9B6BF0" stroke="#2A1A3E" strokeWidth="1.1" />
    </g>
  )

  return (
    <g>
      {/* 投影 */}
      <ellipse cx="32" cy="57" rx="17" ry="2.8" fill={deep} opacity=".3" />

      {/* 大病毒 */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
        <Spike key={d} deg={d} />
      ))}
      <circle cx="27" cy="25" r="10.6" fill="#8B5CF6" stroke="#2A1A3E" strokeWidth="1.6" />
      <circle cx="23.4" cy="21.6" r="3.4" fill="#B18BFA" opacity=".55" />
      {/* 眼睛：一高一低，坏笑 */}
      <ellipse cx="23.6" cy="24" rx="1.5" ry="1.9" fill="#2A1A3E" />
      <ellipse cx="30.4" cy="24" rx="1.5" ry="1.9" fill="#2A1A3E" />
      <path d="M24 29.4q3 2.2 6 0" stroke="#2A1A3E" strokeWidth="1.3" fill="none" strokeLinecap="round" />

      {/* 小细胞（英雄）：青绿球 + 顶上一颗星 */}
      <circle cx="41" cy="48.4" r="7.6" fill="#7FE3B0" stroke="#2A1A3E" strokeWidth="1.6" />
      <circle cx="38.6" cy="46.2" r="2.4" fill="#C6F7DD" opacity=".7" />
      <ellipse cx="38.8" cy="48.2" rx="1.2" ry="1.5" fill="#2A1A3E" />
      <ellipse cx="43.6" cy="48.2" rx="1.2" ry="1.5" fill="#2A1A3E" />
      <path d="M39.4 52q1.8 1.5 3.6 0" stroke="#2A1A3E" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <path
        d="M41 36.6l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1Z"
        fill="#FFD23F"
        stroke="#2A1A3E"
        strokeWidth=".8"
      />

      {/*
       * 抗体弹：从细胞往病毒飞。
       * ★ 必须画在细胞**之后**（之前被那颗星和青绿球盖掉，58px 下只剩一条白边），
       *   位置卡在病毒右下缘和星星之间那道缝里（星星从 x≈39.7 开始）。
       */}
      <g transform="rotate(-36 33.5 34.6)">
        <rect x="28.4" y="32.8" width="10.2" height="3.6" rx="1.8" fill="#FFF3B0" stroke="#2A1A3E" strokeWidth="1" />
        <path d="M28.4 32.8l-2.6 1.8 2.6 1.8Z" fill="#FFD23F" stroke="#2A1A3E" strokeWidth=".8" strokeLinejoin="round" />
      </g>
    </g>
  )
}

/**
 * 别按红按钮：一颗圆顶红按钮 + 三道光 + 一枚金币。
 *
 * ★ 不画手指：58px 下那五根指头会糊成一团白，反而看不出是按钮。
 *   用「光 + 金币」表达「按下去会掉钱」，剪影靠那颗半球撑起来。
 * ★ 半球要有**底座**（下面那道更暗的椭圆）：只画一个红圆是贴纸，
 *   加一圈侧壁才有「按得下去」的厚度。
 */
function Redbutton({ deep }: { deep: string }) {
  return (
    <g>
      {/* 落地阴影 */}
      <ellipse cx="32" cy="55.5" rx="20" ry="4.2" fill={deep} opacity=".32" />
      {/* 侧壁（底座）：比顶面暗一档，制造厚度 */}
      <ellipse cx="32" cy="46.5" rx="19.5" ry="8" fill="#A81526" />
      {/* 顶面：上沿亮一档 */}
      <ellipse cx="32" cy="42" rx="19.5" ry="12.6" fill="#E52D38" />
      <ellipse cx="32" cy="39.6" rx="17.6" ry="10.4" fill="#F24A4A" />
      {/* 高光：偏左上，和顶光方向一致 */}
      <ellipse cx="25.4" cy="35.4" rx="6.4" ry="3.1" fill="#FFFFFF" opacity=".34" transform="rotate(-16 25.4 35.4)" />
      {/* 按下时的三道光 */}
      <g stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" opacity=".9">
        <path d="M32 15.5v4.4" />
        <path d="M24.2 18.6l1.9 3.4" />
        <path d="M39.8 18.6l-1.9 3.4" />
      </g>
      {/* 金币：压在右上角，和按钮错开 */}
      <circle cx="49.4" cy="21.6" r="6.6" fill="#FFD23F" stroke="#C98A12" strokeWidth="1" />
      <circle cx="49.4" cy="21.6" r="4" fill="none" stroke="#E8A81C" strokeWidth="1.1" opacity=".85" />
    </g>
  )
}

/**
 * 轮班守卫：一座奶油色小城堡 + 一条砖路，路边站着一个红斗篷弓兵。
 *
 * 三件东西缺一不可，而且顺序有讲究：
 *   ① 草地土丘（深色 `deep`）在最下面，负责「这是草地关卡」；
 *   ② 砖路**必须画在城堡之前** —— 它要从城堡门口往下拐出去，画在后面会盖住门；
 *   ③ 弓兵放最后，压在路边：58px 下它是唯一能读出「有人守着」的东西。
 */
function Guardshift({ deep }: { deep: string }) {
  return (
    <g>
      {/* 落地阴影（`deep` = 卡片底色的深色档，和背景同源才不会显脏） */}
      <ellipse cx="32" cy="51" rx="19" ry="5" fill={deep} opacity=".26" />
      {/* 草地土丘 */}
      <ellipse cx="32" cy="45" rx="23" ry="12.5" fill="#8FD06A" />
      <ellipse cx="32" cy="43" rx="23" ry="12.5" fill="#A8E07F" />
      {/* 砖路：从门口往下拐到左下角 */}
      <path
        d="M32 40v9c0 4-3 6-7 7l-11 3"
        fill="none"
        stroke="#F0D9A8"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path
        d="M32 40v9c0 4-3 6-7 7l-11 3"
        fill="none"
        stroke="#D8B87A"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="2 3"
      />
      {/* 城堡主体 */}
      <rect x="21.5" y="28" width="21" height="14.5" rx="1.6" fill="#FFF4DE" stroke="#4A3326" strokeWidth="1.5" />
      {/* 城垛：三小块 */}
      <g fill="#FFF4DE" stroke="#4A3326" strokeWidth="1.2">
        <rect x="21.5" y="25.6" width="4" height="3.4" />
        <rect x="30" y="25.6" width="4" height="3.4" />
        <rect x="38.5" y="25.6" width="4" height="3.4" />
      </g>
      {/* 两顶粉色尖顶塔 */}
      <g stroke="#4A3326" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M19.4 25.8l3.6-7.4 3.6 7.4Z" fill="#F2798E" />
        <path d="M37.4 25.8l3.6-7.4 3.6 7.4Z" fill="#F2798E" />
      </g>
      {/* 拱门 */}
      <path d="M29.6 42.5v-5.2a2.4 2.4 0 0 1 4.8 0v5.2Z" fill="#8A5A3B" stroke="#4A3326" strokeWidth="1.1" />
      {/* 弓兵：红斗篷 + 一张弓 */}
      <g>
        <circle cx="16.4" cy="41.6" r="4.1" fill="#C6394B" stroke="#4A3326" strokeWidth="1.2" />
        <circle cx="16.4" cy="42.6" r="2.1" fill="#FFE3C2" />
        <path d="M13.4 45.6c1.6-1.1 4.4-1.1 6 0l-.5 2.4h-5Z" fill="#C6394B" stroke="#4A3326" strokeWidth="1.1" />
        <path d="M21.6 39.6a4.2 4.2 0 0 1 0 5.2" fill="none" stroke="#FFD23F" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </g>
  )
}

/**
 * 偷偷投篮：一页横格纸 + 右边的手绘篮筐，球沿着虚线抛物线飞过去。
 *
 * 三件东西缺一不可：
 *   ① **横格纸 + 左侧红边线**是这款游戏的全部视觉语言（整屏就是一张纸），
 *      去掉它这块就退化成「一个篮球」；
 *   ② 虚线抛物线负责「这是投球，不是投篮游戏机」；
 *   ③ 球压在抛物线上、星压在球前面 —— 58px 下只能靠球和筐读出玩法。
 * 墨色用蓝黑 `#2C3444`（游戏里是蓝墨水勾线），不用其它图标的棕色。
 */
function Hoopsneak({ deep }: { deep: string }) {
  return (
    <g>
      {/* 落地阴影（`deep` = 卡片底色的深色档，和背景同源才不会显脏） */}
      <ellipse cx="32" cy="55.5" rx="18" ry="4.6" fill={deep} opacity=".24" />
      {/* 横格纸 */}
      <rect x="9.5" y="8.5" width="45" height="46" rx="2.6" fill="#FCF7E7" stroke="#2C3444" strokeWidth="1.5" />
      {/* 横格线（画在纸上，别压到边框） */}
      <g stroke="#C2CFE0" strokeWidth=".9" strokeLinecap="round">
        <path d="M14 20h36" />
        <path d="M14 28h36" />
        <path d="M14 36h36" />
        <path d="M14 44h36" />
      </g>
      {/* 左侧红边线 */}
      <path d="M16.4 11.5v40" stroke="#E8827F" strokeWidth=".9" opacity=".85" />
      {/* 抛物线（虚线）：从球当前位置继续往右上 */}
      <path
        d="M15.6 44.6c4.6-9.4 12.4-13.4 20.2-13.4"
        fill="none"
        stroke="#2C3444"
        strokeWidth="1.1"
        strokeLinecap="round"
        strokeDasharray="2.2 2.6"
        opacity=".55"
      />
      {/* 篮筐：背板 + 红圈 + 网 */}
      <path d="M46.2 15.6v9.2" stroke="#2C3444" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse cx="40.4" cy="26.4" rx="6.6" ry="2.3" fill="none" stroke="#D8494E" strokeWidth="2.1" />
      <path
        d="M34.6 28.2l1.9 5.6h7.8l1.9-5.6"
        fill="none"
        stroke="#9AA7BC"
        strokeWidth="1"
        strokeLinejoin="round"
      />
      <g stroke="#9AA7BC" strokeWidth=".8" opacity=".9">
        <path d="M37.2 28.4l.7 5.2" />
        <path d="M43.6 28.4l-.7 5.2" />
      </g>
      {/* 星：球刚吃到的那一颗（在球前面，压住纸面） */}
      <path
        d="M30.4 26.2l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5Z"
        fill="#FFD23F"
        stroke="#C98A12"
        strokeWidth=".9"
        strokeLinejoin="round"
      />
      {/* 球 */}
      <circle cx="20" cy="39.4" r="4.6" fill="#4A7BC8" stroke="#2C3444" strokeWidth="1.3" />
      <path d="M15.9 37.6c2.6 1.4 5.6 1.4 8.2 0" fill="none" stroke="#2C3444" strokeWidth=".8" opacity=".55" />
    </g>
  )
}

/**
 * 画马赛跑：点阵纸上一匹蜡笔画的马，旁边一支蜡笔。
 *
 * 三件东西缺一不可：
 *   ① **纸**是这款游戏的全部舞台（画室、预览、赛道都从这张纸长出来）；
 *   ② **马必须是一笔画出来的折线**，不能画成实心剪影 —— 这款游戏的核心是
 *      「你画的线会变成 3D 的管子」，实心马就把这件事说反了；
 *   ③ **蜡笔**说明是「你自己画」，不是选一匹马。
 * 线条用游戏里的蜡笔橙 `#E65C35`（不是墨色），因为玩家画出来的第一匹马就是橙的。
 */
function Doodlederby({ deep }: { deep: string }) {
  return (
    <g>
      {/* 落地阴影（`deep` = 卡片底色的深色档，和背景同源才不会显脏） */}
      <ellipse cx="32" cy="58" rx="17" ry="4.2" fill={deep} opacity=".24" />
      {/* 纸 */}
      <rect x="9" y="6.5" width="46" height="49.5" rx="2.4" fill="#FCF8EA" stroke="#3F3A33" strokeWidth="1.5" />
      {/* 纸上的点阵（只点几颗，58px 下再多就是噪点） */}
      <g fill="#D5CFBB">
        <circle cx="14" cy="13" r=".75" />
        <circle cx="24" cy="11.5" r=".75" />
        <circle cx="34" cy="13.5" r=".75" />
        <circle cx="14.5" cy="21" r=".75" />
      </g>
      {/* 马：一条折线走完身子 → 脖子 → 头，腿另起四笔（和游戏里画法一致） */}
      <g fill="none" stroke="#E65C35" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {/* 身子 + 脖子 + 头 */}
        <path d="M17.4 32.2 18 38.8 40.8 37.8 41.6 30.4 38.4 30.8 41.4 25.6 47 24 50.4 26.6 48.2 29.2 42.6 28.6" />
        {/* 耳朵 */}
        <path d="M44.6 25.2 45.4 22.6 46.6 24.8" />
        {/* 尾巴 */}
        <path d="M17.4 32.2 13.4 29.4 14.8 35.6" />
        {/* 四条腿（前两条、后两条），末端各一小横当蹄子 */}
        <path d="M39.4 37.6 40.2 45.4M36.2 37.9 35.8 45.2M21.8 38.4 20.8 45.6M25 38.2 25.4 45.4" />
        <path d="M40.2 45.4h2.2M35.8 45.2h2.1M20.8 45.6h2.1M25.4 45.4h2.1" />
      </g>
      {/* 眼睛 */}
      <circle cx="46.6" cy="26.4" r=".8" fill="#3F3A33" />
      {/* 蜡笔：压在纸的左下角，斜着放 */}
      <g transform="rotate(-26 21 51)">
        <rect x="13.6" y="48.8" width="12.6" height="4.8" rx="1" fill="#E65C35" stroke="#3F3A33" strokeWidth="1" />
        <rect x="23.2" y="48.8" width="3" height="4.8" rx=".8" fill="#C24A2A" />
        <path d="M13.6 48.8 9.4 51.2 13.6 53.6Z" fill="#F6D9B8" stroke="#3F3A33" strokeWidth="1" strokeLinejoin="round" />
      </g>
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
