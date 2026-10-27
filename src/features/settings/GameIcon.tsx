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
}: {
  id: string
  tint?: StoreTint
  className?: string
}) {
  const [top, bottom, deep] = BG[tint] ?? BG[DEFAULT_TINT]
  const uid = `${id}-${tint}`
  const bgId = `gi-${uid}-bg`
  const glossId = `gi-${uid}-gloss`
  /** 没有专属图形就用兜底那支 —— 不在表里 ≠ 报错，但也不假装是那个游戏 */
  const Art = ART[id] ?? Fallback

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

      <Art deep={deep} />
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
