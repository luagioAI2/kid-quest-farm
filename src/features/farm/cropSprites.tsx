import clsx from 'clsx'
import { CROP_BY_ID } from '@/domain/catalog'

/* ============================================================
   2D 农场 · 地块 / 作物精灵（阶段 0）
   ------------------------------------------------------------
   为什么是内联 SVG 而不是 emoji / 图片 / Pixi：
   - emoji 的粗细、配色、基线由系统 emoji 字体决定，**永远调不了**
     （官网那轮已经因为这个吃过一次亏，见 .workbuddy-ai/memory/MEMORY.md）。
   - 图片要走网络或打包资源，本项目官网口径是「零外部请求」，
     App 侧也不想为 15 种作物 × 4 个阶段塞 60 张图。
   - 游戏引擎（Pixi）实测最小包 ≈ 整个 App 的体积，而这里只有 12 块地。
     结论与实测数字见 docs/2d-farm-proposal/README.md。

   DOM 契约：地块仍然是 `div.grid.grid-cols-3 > button`，
   这里的 SVG 全部 `pointer-events:none`，命中测试仍落在 button 上
   —— 4 个 e2e 脚本 + 遮挡探针一行都不用改。

   ⚠️ 本文件**只做外观**，不含任何业务逻辑。
   阶段语义来自 `domain/farm.ts` 的 `cropStageIndex()`：
   0 seed / 1 sprout / 2 growing / 3 mature。

   ------------------------------------------------------------
   ★ 坐标约定（改任何一株之前先读这条）
   ------------------------------------------------------------
   所有 symbol 共用 `viewBox="0 0 80 80"`，**地面线固定在 y = 78**，
   植物一律从 y=78 往上长，**任何图形都不许越过 y=80**（越了就被裁掉 ——
   第一版胡萝卜的根画到 y=87，在屏幕上就是「被切了一半」）。
   摆位由 `farm.css` 的 `.kqf-plot__art` 负责（bottom / height），
   这里只画形状，不写绝对像素。
   ============================================================ */

/* ---------------- 色板 ---------------- */

/**
 * 颜色取自 `styles/theme.css` 的 Tailwind token（改主题时这里要跟着改）。
 * 土壤棕是本模块**新增**的材质色 —— 主题里只有墨色 / 纸色 / 草绿，
 * 而地就该是土的颜色。集中在这里，别散到 JSX 里写第二份。
 */
const C = {
  grass300: '#86efac',
  grass400: '#4ade80',
  grass500: '#22c55e',
  grass600: '#16a34a',
  grass700: '#15803d',
  sun300: '#fcd34d',
  sun500: '#f59e0b',
  ink300: '#cbbba8',
  ink500: '#9a8875',
  ink700: '#574838',
  soilRim: '#7a5c3f',
  soil: '#a37f5a',
  soilDark: '#8a6a4a',
} as const

/** 地面线：所有植物的根部都落在这条线上 */
const GROUND = 78

/* ---------------- 作物外观表 ---------------- */

/**
 * 植株「形态」。同一形态的作物共用**成株**那一帧（都是绿色的），
 * 只有**成熟**那一帧才按各自的果实颜色分开画 ——
 * 这样 15 种作物不需要 60 张手绘图，只需 7 个形态 + 15 个果实。
 */
type Form = 'root' | 'bush' | 'grain' | 'vine' | 'tree' | 'flower' | 'spiky'

interface CropArt {
  form: Form
  /** 成熟果实的颜色 */
  fruit: string
  /** 果实的描边 / 阴影色。浅色果实（棉花、小萝卜）靠它才有轮廓 */
  fruitDark: string
}

/**
 * 15 种作物的外观登记表。
 *
 * ⚠️ 加新作物时**不必**改这里 —— 没登记的会按 `kind` 兜底（见 `formOf`），
 * 只是没有专属果实色。想要好看就补一行。
 */
const ART: Record<string, CropArt> = {
  radish: { form: 'root', fruit: '#fecdd3', fruitDark: '#fb7185' },
  carrot: { form: 'root', fruit: '#f97316', fruitDark: '#c2410c' },
  rose: { form: 'flower', fruit: '#f43f5e', fruitDark: '#be123c' },
  strawberry: { form: 'bush', fruit: '#ef4444', fruitDark: '#b91c1c' },
  corn: { form: 'grain', fruit: '#facc15', fruitDark: '#ca8a04' },
  cotton: { form: 'bush', fruit: '#ffffff', fruitDark: '#cbbba8' },
  tomato: { form: 'bush', fruit: '#ef4444', fruitDark: '#b91c1c' },
  pumpkin: { form: 'vine', fruit: '#f97316', fruitDark: '#c2410c' },
  watermelon: { form: 'vine', fruit: '#16a34a', fruitDark: '#14532d' },
  pineapple: { form: 'spiky', fruit: '#eab308', fruitDark: '#a16207' },
  'apple-tree': { form: 'tree', fruit: '#ef4444', fruitDark: '#b91c1c' },
  'lemon-tree': { form: 'tree', fruit: '#facc15', fruitDark: '#ca8a04' },
  plum: { form: 'tree', fruit: '#7c3aed', fruitDark: '#5b21b6' },
  sunflower: { form: 'flower', fruit: '#facc15', fruitDark: '#b45309' },
  'magic-bean': { form: 'grain', fruit: '#a855f7', fruitDark: '#7e22ce' },
}

const FORMS: Form[] = ['root', 'bush', 'grain', 'vine', 'tree', 'flower', 'spiky']

/** 没登记过的作物按生态位兜底，保证永远不会画成空白 */
const FORM_BY_KIND: Record<string, Form> = {
  annual: 'bush',
  perennial: 'tree',
  flower: 'flower',
}

function formOf(cropId: string): Form {
  const art = ART[cropId]
  if (art) return art.form
  return FORM_BY_KIND[CROP_BY_ID.get(cropId)?.kind ?? 'annual'] ?? 'bush'
}

/**
 * 作物 → 精灵符号 id。
 *
 * 0/1 阶段（种子 / 幼芽）所有作物长得一样 —— 现实里幼苗也都是绿的，
 * 所以共用两帧；2 阶段共用「形态」；3 阶段才是各作物专属。
 */
export function cropSpriteId(cropId: string, stage: number): string {
  if (stage <= 0) return 'kqf-s0'
  if (stage === 1) return 'kqf-s1'
  if (stage === 2 || !ART[cropId]) return `kqf-${formOf(cropId)}-2`
  return `kqf-${cropId}-3`
}

/* ---------------- 各形态的画 ---------------- */

/** 成株 / 成熟两帧。`mature` 为假时果实是青的（或干脆没有）。 */
function PlantArt({ form, art, mature }: { form: Form; art: CropArt; mature: boolean }) {
  const fruit = mature ? art.fruit : C.grass300
  const dark = mature ? art.fruitDark : C.grass500

  switch (form) {
    /* 根菜（小萝卜 / 胡萝卜）：叶子在上面，成熟时根鼓出地面 */
    case 'root':
      return (
        <>
          <path d={`M40 ${GROUND}V54`} stroke={C.grass700} strokeWidth={3.4} strokeLinecap="round" />
          <g fill={C.grass500}>
            <path d="M40 64c-10-2-14-9-13-18 9 1 13 9 13 18Z" />
            <path d="M40 60c10-2 14-9 13-18-9 1-13 9-13 18Z" />
          </g>
          <path d="M40 68c-8-1-11-6-10-13 7 0 10 6 10 13Z" fill={C.grass300} />
          {mature && (
            <>
              <path
                d="M40 56c7 0 11 6 10 11-1 6-5 11-10 11s-9-5-10-11c-1-5 3-11 10-11Z"
                fill={fruit}
              />
              <path
                d="M36 62c-3 3-4 8-2 12M44 62c3 3 4 8 2 12"
                stroke={dark}
                strokeWidth={1.6}
                fill="none"
                strokeLinecap="round"
                opacity={0.6}
              />
            </>
          )}
        </>
      )

    /* 矮丛（草莓 / 番茄 / 棉花）：果子挂在叶丛上 */
    case 'bush':
      return (
        <>
          <path d={`M40 ${GROUND}V66`} stroke={C.grass700} strokeWidth={3} strokeLinecap="round" />
          <g fill={C.grass500}>
            <ellipse cx="26" cy="66" rx="11" ry="9.5" />
            <ellipse cx="54" cy="66" rx="11" ry="9.5" />
            <ellipse cx="40" cy="56" rx="13.5" ry="11" />
          </g>
          <path
            d="M40 48c-9 1-13 6-13 14"
            stroke={C.grass300}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          {mature && (
            <>
              <circle cx="27" cy="64" r="6.4" fill={fruit} stroke={dark} strokeWidth={1.2} />
              <circle cx="53" cy="61" r="6.4" fill={fruit} stroke={dark} strokeWidth={1.2} />
              <circle cx="40" cy="73" r="5.6" fill={fruit} stroke={dark} strokeWidth={1.2} />
              <g fill="#ffffff" opacity={0.5}>
                <circle cx="25" cy="62" r="1.7" />
                <circle cx="51" cy="59" r="1.7" />
              </g>
            </>
          )}
        </>
      )

    /* 高秆（玉米 / 魔法豆）：穗子长在顶端 */
    case 'grain':
      return (
        <>
          <g stroke={C.grass600} strokeWidth={3.2} strokeLinecap="round" fill="none">
            <path d={`M30 ${GROUND}V44`} />
            <path d={`M40 ${GROUND}V38`} />
            <path d={`M50 ${GROUND}V44`} />
          </g>
          <g fill={C.grass500}>
            <path d="M30 64c-9-1-13-7-12-15 8 1 12 7 12 15Z" />
            <path d="M50 64c9-1 13-7 12-15-8 1-12 7-12 15Z" />
          </g>
          <path d="M40 68c-8-1-11-6-10-13 7 0 10 6 10 13Z" fill={C.grass300} />
          {mature && (
            <>
              <ellipse cx="30" cy="40" rx="4.8" ry="7.6" fill={fruit} />
              <ellipse cx="40" cy="33" rx="5" ry="8.2" fill={fruit} />
              <ellipse cx="50" cy="40" rx="4.8" ry="7.6" fill={fruit} />
              <g fill={C.sun300} opacity={0.75}>
                <ellipse cx="30" cy="34" rx="3" ry="4.4" />
                <ellipse cx="40" cy="27" rx="3.1" ry="4.8" />
                <ellipse cx="50" cy="34" rx="3" ry="4.4" />
              </g>
            </>
          )}
        </>
      )

    /* 藤蔓（南瓜 / 西瓜）：大果趴在叶子上 */
    case 'vine':
      return (
        <>
          <g fill={C.grass500}>
            <path d="M40 76c-15-1-22-6-22-14 12-2 21 3 22 14Z" />
            <path d="M40 76c15-1 22-6 22-14-12-2-21 3-22 14Z" />
          </g>
          <path d="M40 70c-7-9-5-18 0-22 5 4 7 13 0 22Z" fill={C.grass300} />
          <path d={`M40 ${GROUND}V64`} stroke={C.grass700} strokeWidth={2.6} strokeLinecap="round" />
          {mature && (
            <>
              <ellipse cx="40" cy="62" rx="16" ry="14" fill={fruit} />
              <g stroke={dark} strokeWidth={2} fill="none" opacity={0.6} strokeLinecap="round">
                <path d="M26 60c4 5 4 11 0 16" />
                <path d="M40 49c4 5 4 15 0 22" />
                <path d="M54 60c-4 5-4 11 0 16" />
              </g>
              <path
                d="M40 48c1-5 6-8 9-7"
                stroke={C.grass600}
                strokeWidth={2.4}
                fill="none"
                strokeLinecap="round"
              />
            </>
          )}
        </>
      )

    /* 果树（苹果 / 柠檬 / 西梅）：树干 + 树冠 + 果子 */
    case 'tree':
      return (
        <>
          <path d={`M36 ${GROUND}h8V50h-8Z`} fill={C.soilDark} />
          <g fill={C.grass500}>
            <circle cx="40" cy="38" r="18" />
            <circle cx="25" cy="47" r="11.5" />
            <circle cx="55" cy="47" r="11.5" />
          </g>
          <path
            d="M30 27c-7 3-10 9-10 15"
            stroke={C.grass300}
            strokeWidth={2.2}
            fill="none"
            strokeLinecap="round"
            opacity={0.7}
          />
          {mature && (
            <>
              <circle cx="30" cy="45" r="5.6" fill={fruit} />
              <circle cx="50" cy="41" r="5.6" fill={fruit} />
              <circle cx="40" cy="55" r="5.2" fill={fruit} />
              <g fill="#ffffff" opacity={0.45}>
                <circle cx="28" cy="43" r="1.5" />
                <circle cx="48" cy="39" r="1.5" />
              </g>
            </>
          )}
        </>
      )

    /* 花（玫瑰 / 向日葵）：成株是花苞、成熟才开花 */
    case 'flower':
      return (
        <>
          <path d={`M40 ${GROUND}V34`} stroke={C.grass600} strokeWidth={3.2} strokeLinecap="round" />
          <g fill={C.grass500}>
            <path d="M40 62c-9-1-12-6-11-12 8 0 11 6 11 12Z" />
            <path d="M40 55c9-1 12-6 11-12-8 0-11 6-11 12Z" fill={C.grass400} />
          </g>
          {mature ? (
            <>
              <g fill={fruit}>
                <ellipse cx="40" cy="21" rx="4.8" ry="7.6" />
                <ellipse cx="40" cy="47" rx="4.8" ry="7.6" />
                <ellipse cx="27" cy="34" rx="7.6" ry="4.8" />
                <ellipse cx="53" cy="34" rx="7.6" ry="4.8" />
                <ellipse cx="31" cy="25" rx="6.4" ry="4.4" transform="rotate(-45 31 25)" />
                <ellipse cx="49" cy="25" rx="6.4" ry="4.4" transform="rotate(45 49 25)" />
                <ellipse cx="31" cy="43" rx="6.4" ry="4.4" transform="rotate(45 31 43)" />
                <ellipse cx="49" cy="43" rx="6.4" ry="4.4" transform="rotate(-45 49 43)" />
              </g>
              <circle cx="40" cy="34" r="7" fill={dark} />
            </>
          ) : (
            <ellipse cx="40" cy="34" rx="7" ry="9" fill={C.grass400} />
          )}
        </>
      )

    /* 菠萝：叶子像扇子摊开，果子带鳞纹和冠叶 */
    case 'spiky':
      return (
        <>
          <g fill={C.grass500}>
            <path d="M40 74C23 72 15 63 15 52c11 0 21 9 25 22Z" />
            <path d="M40 74c17-2 25-11 25-22-11 0-21 9-25 22Z" />
          </g>
          <g fill={C.grass400}>
            <path d="M40 72C30 63 26 52 28 41c9 4 14 18 12 31Z" />
            <path d="M40 72c10-9 14-20 12-31-9 4-14 18-12 31Z" />
          </g>
          {mature && (
            <>
              <ellipse cx="40" cy="64" rx="12" ry="14" fill={fruit} />
              <g stroke={dark} strokeWidth={1.3} opacity={0.55}>
                <path d="M29 57l22 9" />
                <path d="M29 66l22-9" />
                <path d="M28 71h24" />
              </g>
              <path d="M40 50c-4-8-2-15 0-19 2 4 4 11 0 19Z" fill={C.grass600} />
            </>
          )}
        </>
      )
  }
}

/* ---------------- 精灵表 ---------------- */

/**
 * 精灵表：所有图案的**唯一定义处**。
 * 在页面里渲染一次，之后用 `<CropSprite>` 之类的组件 `<use>` 引用。
 *
 * ⚠️ 一定要挂在**页面根节点**下（`position:absolute; 0×0`），
 * 别放进 `<button>` —— `<symbol>` 定义在 button 里虽然也能引用，
 * 但地块会被重排、且 `overflow:hidden` 会把它裁掉。
 */
export function FarmSpriteDefs() {
  return (
    <svg className="kqf-sprite" aria-hidden focusable="false">
      {/* 翻好的土垄 —— 所有地块的底图 */}
      <symbol id="kqf-bed" viewBox="0 0 80 80">
        <rect x="3" y="9" width="74" height="66" rx="16" fill={C.soilRim} />
        <rect x="5" y="11" width="70" height="62" rx="14" fill={C.soil} />
        <g stroke={C.soilDark} strokeWidth="2.4" strokeLinecap="round" opacity="0.5">
          <path d="M16 30h48" />
          <path d="M14 42h52" />
          <path d="M18 54h44" />
        </g>
        <g fill="#8f6c48" opacity="0.45">
          <circle cx="24" cy="24" r="2.2" />
          <circle cx="54" cy="36" r="1.9" />
          <circle cx="34" cy="62" r="2" />
          <circle cx="62" cy="58" r="1.7" />
        </g>
      </symbol>

      {/* 枯死的茬子 */}
      <symbol id="kqf-dead" viewBox="0 0 80 80">
        <path d={`M40 ${GROUND}V56`} stroke={C.ink500} strokeWidth={3} strokeLinecap="round" />
        <g stroke={C.ink300} strokeWidth={3} strokeLinecap="round" fill="none">
          <path d="M40 64c-8 0-12-4-13-10" />
          <path d="M40 62c8 0 12-4 13-10" />
        </g>
      </symbol>

      {/* 阶段 0/1：所有作物共用的幼芽与幼苗（现实里幼苗也都是绿的） */}
      <symbol id="kqf-s0" viewBox="0 0 80 80">
        <path d={`M40 ${GROUND}V62`} stroke={C.grass700} strokeWidth={3} strokeLinecap="round" />
        <path d="M40 66c-7-1-10-5-9-11 6 0 9 5 9 11Z" fill={C.grass500} />
        <path d="M40 64c7-1 10-5 9-11-6 0-9 5-9 11Z" fill={C.grass300} />
      </symbol>
      <symbol id="kqf-s1" viewBox="0 0 80 80">
        <path d={`M40 ${GROUND}V50`} stroke={C.grass700} strokeWidth={3.2} strokeLinecap="round" />
        <g fill={C.grass500}>
          <path d="M40 62c-10-1-14-7-13-15 9 1 13 7 13 15Z" />
          <path d="M40 58c10-1 14-7 13-15-9 1-13 7-13 15Z" />
        </g>
        <path d="M40 66c-8-1-11-5-10-11 7 0 10 5 10 11Z" fill={C.grass300} />
      </symbol>

      {/* 阶段 2：按形态共用（还没挂果，都是绿的） */}
      {FORMS.map((form) => (
        <symbol key={form} id={`kqf-${form}-2`} viewBox="0 0 80 80">
          <PlantArt
            form={form}
            art={{ form, fruit: C.grass300, fruitDark: C.grass500 }}
            mature={false}
          />
        </symbol>
      ))}

      {/* 阶段 3：按作物各画一帧（果实颜色不同） */}
      {Object.entries(ART).map(([cropId, art]) => (
        <symbol key={cropId} id={`kqf-${cropId}-3`} viewBox="0 0 80 80">
          <PlantArt form={art.form} art={art} mature />
        </symbol>
      ))}
    </svg>
  )
}

/* ---------------- 引用组件 ---------------- */

/** 地块底图（土垄）。铺满整块地，不接收点击。 */
export function PlotBed({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('kqf-plot__bed', className)}
      viewBox="0 0 80 80"
      aria-hidden
      focusable="false"
    >
      <use href="#kqf-bed" />
    </svg>
  )
}

/** 枯死的茬子 */
export function PlotDead({ className }: { className?: string }) {
  return (
    <svg
      className={clsx('kqf-plot__art', className)}
      viewBox="0 0 80 80"
      aria-hidden
      focusable="false"
    >
      <use href="#kqf-dead" />
    </svg>
  )
}

/**
 * 一株作物。
 *
 * `stage` 直接吃 `cropStageIndex()` 的返回值（0-3），
 * 传别的值会被夹到 0-3，不会引用到不存在的 symbol。
 */
export function CropSprite({
  cropId,
  stage,
  className,
}: {
  cropId: string
  stage: number
  className?: string
}) {
  const s = Math.max(0, Math.min(3, Math.round(stage)))
  return (
    <svg
      className={clsx('kqf-plot__art', className)}
      viewBox="0 0 80 80"
      aria-hidden
      focusable="false"
    >
      <use href={`#${cropSpriteId(cropId, s)}`} />
    </svg>
  )
}
