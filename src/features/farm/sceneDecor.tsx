/**
 * 地平线装饰 —— ⑥ 建筑装饰（spec §8.5 的 ⑥）。
 *
 * ## 为什么画在这里（**先量过再画的**）
 *
 * 用 `scripts/measure-farm-scene.mjs` 量过「肉眼真正看得见的草地」：
 * 农场的场景层（天空 / 山丘 / 草地）在**手机上几乎被内容盖满** ——
 * 露着的只有地块之间两条 10px 缝 + **地块网格正下方那一条带**。
 *
 * 而那一条带在**两档视口上都存在**，因为它就在网格和底部按钮之间：
 *
 *   | 视口 | 网格底边 | 可见带 | 带高 |
 *   | --- | --- | --- | --- |
 *   | 390×844 | y 686 | 687–709 | **≈23px** |
 *   | 834×1112 | y 765 | 765–937 | **≈172px** |
 *
 * ➜ 所以装饰锚在**网格下沿**（`top-full`），而不是场景层的某个绝对 y ——
 *   那样换一档视口就跑到内容底下去了。两档都成立是量出来的，不是猜的。
 *
 * ⚠️ **手机只有 23px，放不下道具，只有篱笆。** 道具走 `hidden md:block`，
 * 平板那 172px 才装得下。**这不是「手机上藏起来」，是手机上真的没地方** ——
 * 量出来的数字就摆在上面的表里。
 *
 * ⚠️ 整个装饰是 `position:absolute` + `pointer-events:none`：
 * ① 手机上的布局余量只有 **约 8px**，任何参与布局的东西都会把页面撑溢出
 *   （农场根节点是 `overflow-hidden`，溢出 = 被裁掉）；
 * ② 命中测试必须仍然落在按钮 / 地块上。
 *
 * ------------------------------------------------------------
 * ★ 坐标约定（和 `cropSprites.tsx` 同一套）
 *   道具用 `viewBox="0 0 80 80"`，**地面线 y = 78**，
 *   **任何图形都不许越过 y=80**（越了就被裁掉 —— 胡萝卜的根踩过这个坑）。
 *   摆位由 `farm.css` 负责，symbol 里不写绝对像素。
 */

/** 木料 / 石头 / 稻草的材质色。主题里只有墨色 / 纸色 / 草绿，这几个是本模块新增的 */
const W = {
  wood: '#c08e5c',
  woodDark: '#8a6a4a',
  straw: '#f2cf7a',
  cloth: '#e2574c',
  stone: '#b9b0a4',
  stoneDark: '#8f867a',
  water: '#7dd3fc',
  barn: '#c9553f',
  barnRoof: '#8f3b2c',
  window: '#fde68a',
} as const

/* ============================================================
   篱笆 —— **平铺**画，不是一张拉伸的图
   ------------------------------------------------------------
   ⚠️ 不能用一个 `viewBox` + `preserveAspectRatio="none"` 的整图：
   那样横栏是对的，**立柱会被横向拉扁**（宽度一变，柱子粗细就跟着变）。
   所以横栏用两条 `<rect width="100%">`，立柱用 `<pattern>` 按 26px 平铺 ——
   任何宽度下立柱都保持同样的粗细和间距。
   ============================================================ */
export function FenceArt({ className }: { className?: string }) {
  return (
    <svg className={className} width="100%" height="20" aria-hidden focusable="false">
      <defs>
        {/* 一根立柱（左亮右暗，给一点体积感） */}
        <pattern id="kqf-fence-post" width="26" height="20" patternUnits="userSpaceOnUse">
          <rect x="10" y="0" width="6" height="20" rx="2" fill={W.wood} />
          <rect x="10" y="0" width="2" height="20" rx="1" fill={W.woodDark} />
        </pattern>
      </defs>
      {/* 两道横栏 */}
      <rect x="0" y="2" width="100%" height="4" rx="2" fill={W.wood} />
      <rect x="0" y="13" width="100%" height="4" rx="2" fill={W.wood} />
      {/* 立柱铺满整条 */}
      <rect x="0" y="0" width="100%" height="20" fill="url(#kqf-fence-post)" />
    </svg>
  )
}

/**
 * 装饰用的 `<symbol>` 定义。**渲染一次**，挂在页面根节点下。
 *
 * ⚠️ 别挪进 `<button>` 或任何 `overflow:hidden` 的容器 —— symbol 定义会被裁掉
 * （`cropSprites.tsx` 的 `FarmSpriteDefs` 同一个坑）。
 */
export function SceneDecorDefs() {
  return (
    <svg className="kqf-sprite" aria-hidden focusable="false">
      {/* 谷仓（最大的一件，放在最左边） */}
      <symbol id="kqf-decor-barn" viewBox="0 0 80 80">
        <rect x="15" y="36" width="50" height="42" rx="2" fill={W.barn} />
        <path d="M8 38 L40 13 L72 38 Z" fill={W.barnRoof} />
        <rect x="33" y="54" width="15" height="24" rx="2" fill={W.woodDark} />
        <rect x="39" y="54" width="3" height="24" fill={W.wood} />
        <rect x="33" y="64" width="15" height="3" fill={W.wood} />
        <rect x="21" y="45" width="9" height="9" rx="1.5" fill={W.window} />
        <rect x="51" y="45" width="9" height="9" rx="1.5" fill={W.window} />
      </symbol>

      {/* 告示牌 */}
      <symbol id="kqf-decor-sign" viewBox="0 0 80 80">
        <rect x="36" y="28" width="8" height="50" rx="2" fill={W.woodDark} />
        <rect x="14" y="16" width="52" height="28" rx="4" fill={W.wood} />
        <rect x="21" y="25" width="30" height="3" rx="1.5" fill={W.woodDark} />
        <rect x="21" y="33" width="21" height="3" rx="1.5" fill={W.woodDark} />
      </symbol>

      {/* 稻草人 */}
      <symbol id="kqf-decor-scarecrow" viewBox="0 0 80 80">
        <rect x="14" y="38" width="52" height="5" rx="2.5" fill={W.woodDark} />
        <rect x="37" y="26" width="6" height="52" rx="2" fill={W.woodDark} />
        <circle cx="15" cy="40" r="4" fill={W.straw} />
        <circle cx="65" cy="40" r="4" fill={W.straw} />
        <path d="M29 41 L51 41 L55 68 L25 68 Z" fill={W.cloth} />
        <circle cx="40" cy="27" r="10" fill={W.straw} />
        <path d="M25 21 L55 21 L47 11 L33 11 Z" fill={W.woodDark} />
        <rect x="23" y="20" width="34" height="4" rx="2" fill={W.woodDark} />
        <circle cx="36" cy="27" r="1.6" fill={W.woodDark} />
        <circle cx="44" cy="27" r="1.6" fill={W.woodDark} />
      </symbol>

      {/* 水井 */}
      <symbol id="kqf-decor-well" viewBox="0 0 80 80">
        <path d="M22 78 L26 52 L54 52 L58 78 Z" fill={W.stone} />
        <rect x="18" y="45" width="44" height="9" rx="3" fill={W.stoneDark} />
        <ellipse cx="40" cy="49" rx="15" ry="3.5" fill={W.water} />
        <rect x="25" y="20" width="5" height="27" rx="2" fill={W.woodDark} />
        <rect x="50" y="20" width="5" height="27" rx="2" fill={W.woodDark} />
        <path d="M13 21 L40 6 L67 21 Z" fill={W.wood} />
        <rect x="36" y="31" width="9" height="8" rx="1.5" fill={W.woodDark} />
      </symbol>
    </svg>
  )
}

/**
 * 地平线装饰本体。
 *
 * 调用方负责定位（`farm.css` 的 `.kqf-decor`）—— 它挂在**地块网格的包裹层**里，
 * 锚在网格下沿，所以两档视口都落在真正露着的那条带上。
 */
export function HorizonDecor() {
  return (
    <div className="kqf-decor" aria-hidden data-farm-decor="horizon">
      {/* 道具：手机那 23px 装不下，`md:` 起（平板 172px）才有 */}
      <div className="kqf-decor__props">
        <svg className="kqf-decor__item kqf-decor__item--barn" data-decor-item="barn">
          <use href="#kqf-decor-barn" />
        </svg>
        <svg className="kqf-decor__item kqf-decor__item--well" data-decor-item="well">
          <use href="#kqf-decor-well" />
        </svg>
        <svg className="kqf-decor__item kqf-decor__item--scarecrow" data-decor-item="scarecrow">
          <use href="#kqf-decor-scarecrow" />
        </svg>
        <svg className="kqf-decor__item kqf-decor__item--sign" data-decor-item="sign">
          <use href="#kqf-decor-sign" />
        </svg>
      </div>
      {/* 篱笆：两档都看得见（手机上就靠它） */}
      <FenceArt className="kqf-decor__fence" />
    </div>
  )
}
