import clsx from 'clsx'

/* ============================================================
   2D 农场 · 动物精灵
   ------------------------------------------------------------
   为什么动物也要画成内联 SVG（而不是继续用 emoji）：
   - **一致性**。作物已经是手绘 SVG 了（`cropSprites.tsx`），
     动物还是系统 emoji —— 同一张卡片上两种画风，看着就是「没做完」。
     官网那轮「不够细腻」的根因也是 emoji：粗细 / 配色 / 基线全由
     系统 emoji 字体决定，**永远调不了**。
   - 8 种动物 × 2 个阶段（幼崽 / 成年）= 16 帧，体积可控。

   DOM 契约：本文件只画形状，全部 `pointer-events:none`，
   点击仍落在 `<button>` / `<li>` 上 —— 走查脚本一行都不用改。

   ★ 坐标约定（和 `cropSprites.tsx` 同一套，改任何一只之前先读）
   ------------------------------------------------------------
   所有 symbol 共用 `viewBox="0 0 80 80"`，**地面线固定在 y = 78**，
   动物一律从 y=78 往上站，**任何图形都不许越过 y=80**。
   主体（最高点到地面线）占画布 **55%~75%** —— 太小看不出是什么。
   摆位和尺寸由**调用方**的 className 决定，这里不写绝对像素。

   ⚠️ 幼崽帧不是另画一套：**同一套几何按 (40, 78) 缩到 0.62**，
   所以「脚踩在地面线上」这件事对两帧同时成立，不会一只浮空。
   ============================================================ */

/* ---------------- 色板 ---------------- */

/**
 * 和 `cropSprites.tsx` 一样，颜色集中在这里，别散到 JSX 里写第二份。
 * 草绿 / 阳光 / 墨色 / 纸色取自 `styles/theme.css`；
 * 动物毛色是本模块新增的材质色。
 *
 * 描边一律用**同色系加深**，不用纯黑（儿童向，见 spec §8.10 A）。
 */
const C = {
  ink500: '#9a8875',
  ink700: '#574838',
  ink900: '#33281e',
  paper: '#fffaf2',
  grass300: '#86efac',
  grass500: '#22c55e',
  sun300: '#fcd34d',
  sun500: '#f59e0b',
  /* 动物材质色 */
  cream: '#fffaf2',
  creamDark: '#cbbba8',
  feather: '#f8fafc',
  featherDark: '#cbd5e1',
  chick: '#fcd34d',
  chickDark: '#f59e0b',
  comb: '#ef4444',
  combDark: '#b91c1c',
  pig: '#f9a8d4',
  pigDark: '#db2777',
  wool: '#f1f5f9',
  woolDark: '#cbd5e1',
  hide: '#fef3c7',
  hideDark: '#d6b47a',
  patch: '#33281e',
  dogFur: '#d9a05b',
  dogFurDark: '#a16207',
  bear: '#f8fafc',
  bearDark: '#cbd5e1',
  giraffe: '#fcd34d',
  giraffeDark: '#b45309',
  giraffePatch: '#a16207',
  nose: '#7a5c3f',
} as const

/** 地面线：所有动物的脚都落在这条线上 */
const GROUND = 78

/** 幼崽的缩放比。两帧共用几何，靠它区分大小。 */
const BABY_SCALE = 0.62

/* ---------------- 动物外观表 ---------------- */

type Shape = 'bird' | 'quad' | 'longneck'

interface AnimalArt {
  shape: Shape
  /** 成年体色 */
  body: string
  /** 成年描边（同色系加深） */
  dark: string
  /** 嘴 / 鼻子 */
  accent: string
  /** 幼崽体色（雏鸟是黄的，和成年明显不同） */
  babyBody?: string
  babyDark?: string
  /** 鸡冠（只有鸡有） */
  comb?: string
  /** 扁嘴（鸭） */
  bill?: boolean
  /** 花斑（奶牛 / 长颈鹿） */
  patch?: string
  /** 绵羊的蓬松毛 */
  wool?: boolean
  ears?: 'round' | 'flop' | 'tiny'
  /** 额外的点缀（北极熊的❄️、奶牛的乳房） */
  extra?: 'udder' | 'snow'
}

/**
 * 8 种动物的外观登记表。
 *
 * ⚠️ 加新动物时**不必**改这里 —— 没登记的会在调用点回落成 emoji
 * （见 `AnimalIcon`），只是画风会不一致。想要统一就补一行。
 */
const ART: Record<string, AnimalArt> = {
  chicken: {
    shape: 'bird',
    body: C.cream,
    dark: C.creamDark,
    accent: C.sun500,
    comb: C.comb,
    babyBody: C.chick,
    babyDark: C.chickDark,
  },
  duck: {
    shape: 'bird',
    body: C.feather,
    dark: C.featherDark,
    accent: C.sun500,
    bill: true,
    babyBody: C.chick,
    babyDark: C.chickDark,
  },
  sheep: {
    shape: 'quad',
    body: C.wool,
    dark: C.woolDark,
    accent: C.ink700,
    wool: true,
    ears: 'tiny',
  },
  pig: {
    shape: 'quad',
    body: C.pig,
    dark: C.pigDark,
    accent: C.pigDark,
    ears: 'tiny',
  },
  cow: {
    shape: 'quad',
    body: C.hide,
    dark: C.hideDark,
    accent: C.pig,
    patch: C.patch,
    ears: 'round',
    extra: 'udder',
  },
  dog: {
    shape: 'quad',
    body: C.dogFur,
    dark: C.dogFurDark,
    accent: C.ink900,
    ears: 'flop',
  },
  'polar-bear': {
    shape: 'quad',
    body: C.bear,
    dark: C.bearDark,
    accent: C.ink700,
    ears: 'round',
    extra: 'snow',
  },
  giraffe: {
    shape: 'longneck',
    body: C.giraffe,
    dark: C.giraffeDark,
    accent: C.giraffeDark,
    patch: C.giraffePatch,
    ears: 'tiny',
  },
}

/** 幼崽帧的颜色覆盖（没写就用成年体色） */
function colorsOf(a: AnimalArt, baby: boolean) {
  return {
    body: baby ? (a.babyBody ?? a.body) : a.body,
    dark: baby ? (a.babyDark ?? a.dark) : a.dark,
  }
}

/* ---------------- 三种体型 ---------------- */

/** 鸟（鸡 / 鸭）：椭圆身 + 圆头 + 两条腿 */
function BirdArt({ a, baby }: { a: AnimalArt; baby: boolean }) {
  const { body, dark } = colorsOf(a, baby)
  return (
    <>
      <g stroke={a.accent} strokeWidth={2.6} strokeLinecap="round">
        <path d="M34 66v12" />
        <path d="M44 66v12" />
      </g>
      {/* 尾巴 */}
      <path d="M22 47c-6-4-9-9-8-14 5 1 9 5 11 10Z" fill={body} stroke={dark} strokeWidth={1.4} />
      {/* 身体 */}
      <ellipse cx="38" cy="54" rx="17" ry="13" fill={body} stroke={dark} strokeWidth={1.6} />
      {/* 翅膀 */}
      <ellipse cx="35" cy="55" rx="8.5" ry="6.5" fill={dark} opacity={0.3} />
      {/* 头 */}
      <circle cx="54" cy="36" r="11" fill={body} stroke={dark} strokeWidth={1.6} />
      {/* 眼 */}
      <circle cx="57.5" cy="34" r="1.9" fill={C.ink900} />
      {/* 嘴 / 扁嘴 */}
      {a.bill ? (
        <path d="M64 36c6-1 9 0 9 3s-4 4-9 3Z" fill={a.accent} />
      ) : (
        <path d="M64 33l8 3-8 3Z" fill={a.accent} />
      )}
      {/* 鸡冠 */}
      {a.comb ? (
        <path
          d="M47 27c-1-4 2-6 4-4 1-3 4-3 5 0 2-2 4 1 2 4Z"
          fill={a.comb}
          stroke={C.combDark}
          strokeWidth={1}
        />
      ) : null}
    </>
  )
}

/** 四足（绵羊 / 猪 / 奶牛 / 狗 / 北极熊） */
function QuadArt({ a, baby }: { a: AnimalArt; baby: boolean }) {
  const { body, dark } = colorsOf(a, baby)
  return (
    <>
      <g stroke={dark} strokeWidth={3.4} strokeLinecap="round">
        <path d="M26 58v20" />
        <path d="M35 60v18" />
        <path d="M48 60v18" />
        <path d="M57 58v20" />
      </g>
      {/* 尾巴 */}
      <path
        d="M18 44c-5-1-7-6-5-10"
        stroke={dark}
        strokeWidth={2.6}
        fill="none"
        strokeLinecap="round"
      />
      {/* 身体 */}
      <ellipse cx="40" cy="48" rx="21" ry="13" fill={body} stroke={dark} strokeWidth={1.6} />
      {/* 蓬松毛（绵羊） */}
      {a.wool ? (
        <g fill={body} stroke={dark} strokeWidth={1.2}>
          <circle cx="26" cy="38" r="8" />
          <circle cx="40" cy="34" r="9" />
          <circle cx="54" cy="38" r="8" />
        </g>
      ) : null}
      {/* 花斑（奶牛） */}
      {a.patch ? (
        <g fill={a.patch} opacity={0.85}>
          <ellipse cx="33" cy="45" rx="6" ry="4.6" />
          <ellipse cx="50" cy="53" rx="5" ry="3.6" />
        </g>
      ) : null}
      {/* 乳房（奶牛） */}
      {a.extra === 'udder' ? (
        <ellipse cx="42" cy="61" rx="7" ry="4.5" fill={a.accent} />
      ) : null}
      {/* 头 */}
      <circle cx="60" cy="42" r="11.5" fill={body} stroke={dark} strokeWidth={1.6} />
      {/* 耳朵 */}
      {a.ears === 'flop' ? (
        <g fill={dark}>
          <ellipse cx="50" cy="36" rx="4" ry="7" transform="rotate(-18 50 36)" />
          <ellipse cx="69" cy="36" rx="4" ry="7" transform="rotate(18 69 36)" />
        </g>
      ) : a.ears === 'round' ? (
        <g fill={dark}>
          <circle cx="52" cy="32" r="4.4" />
          <circle cx="68" cy="32" r="4.4" />
        </g>
      ) : (
        <g fill={dark}>
          <ellipse cx="52" cy="34" rx="3" ry="4.4" transform="rotate(-24 52 34)" />
          <ellipse cx="68" cy="34" rx="3" ry="4.4" transform="rotate(24 68 34)" />
        </g>
      )}
      {/* 鼻子 / 口鼻 */}
      <ellipse cx="69" cy="45" rx="5.2" ry="4.2" fill={a.accent} />
      {/* 眼 */}
      <circle cx="60" cy="38" r="1.9" fill={C.ink900} />
      {/* 雪花（北极熊） */}
      {a.extra === 'snow' ? (
        <path
          d="M16 22v10M11.7 24.5l8.6 5M20.3 24.5l-8.6 5"
          stroke={C.featherDark}
          strokeWidth={1.6}
          strokeLinecap="round"
          fill="none"
        />
      ) : null}
    </>
  )
}

/** 长颈鹿：四足 + 长脖子 */
function LongNeckArt({ a, baby }: { a: AnimalArt; baby: boolean }) {
  const { body, dark } = colorsOf(a, baby)
  return (
    <>
      <g stroke={dark} strokeWidth={3.4} strokeLinecap="round">
        <path d="M22 58v20" />
        <path d="M31 60v18" />
        <path d="M44 60v18" />
        <path d="M53 58v20" />
      </g>
      <path
        d="M14 46c-4-1-6-5-4-9"
        stroke={dark}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
      />
      {/* 身体 */}
      <ellipse cx="36" cy="50" rx="19" ry="12" fill={body} stroke={dark} strokeWidth={1.6} />
      {/* 脖子：先用更粗的深色描边垫底，再用体色压上去 ——
          这样脖子有 1.5px 的同色系描边，和身体 / 头的观感一致。
          （单画一条 stroke 是描不出边的：stroke 没有 outline。） */}
      <path
        d="M48 44c3-9 6-15 9-18"
        stroke={dark}
        strokeWidth={13}
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M48 44c3-9 6-15 9-18"
        stroke={body}
        strokeWidth={10}
        strokeLinecap="round"
        fill="none"
      />
      {/* 头 */}
      <ellipse cx="59" cy="26" rx="9" ry="6.6" fill={body} stroke={dark} strokeWidth={1.6} />
      {/* 角（两只小突起） */}
      <g stroke={dark} strokeWidth={2.2} strokeLinecap="round">
        <path d="M54 20v-5" />
        <path d="M63 20v-5" />
      </g>
      <circle cx="54" cy="15" r="2" fill={dark} />
      <circle cx="63" cy="15" r="2" fill={dark} />
      {/* 口鼻 */}
      <ellipse cx="67" cy="28" rx="4.4" ry="3.6" fill={a.accent} />
      {/* 眼 */}
      <circle cx="59" cy="24" r="1.8" fill={C.ink900} />
      {/* 花斑 */}
      {a.patch ? (
        <g fill={a.patch} opacity={0.8}>
          <ellipse cx="30" cy="46" rx="5" ry="4" />
          <ellipse cx="44" cy="52" rx="4.4" ry="3.4" />
          <ellipse cx="51" cy="36" rx="3.4" ry="2.8" />
        </g>
      ) : null}
    </>
  )
}

function AnimalArtShape({ a, baby }: { a: AnimalArt; baby: boolean }) {
  switch (a.shape) {
    case 'bird':
      return <BirdArt a={a} baby={baby} />
    case 'quad':
      return <QuadArt a={a} baby={baby} />
    case 'longneck':
      return <LongNeckArt a={a} baby={baby} />
  }
}

/* ---------------- 精灵表 ---------------- */

/**
 * 精灵表：所有动物图案的**唯一定义处**。
 * 在页面里渲染一次，之后用 `<AnimalSprite>` 引用。
 *
 * ⚠️ 和作物一样，必须挂在**页面根节点**下（`position:absolute; 0×0`），
 * 别放进 `<button>` —— `overflow:hidden` 会把它裁掉。
 */
export function FarmAnimalSpriteDefs() {
  return (
    <svg className="kqf-sprite" aria-hidden focusable="false">
      {Object.entries(ART).map(([id, a]) =>
        [false, true].map((baby) => (
          <symbol
            /* ★ id 后缀的约定：**-0 = 幼崽 / -1 = 成年**，和 `AnimalSprite` 的
               `mature ? 1 : 0` 是一对。
               ⚠️ 第一版这里写的是 `baby ? 1 : 0` —— **正好写反**，
               于是「幼崽」那一格画的是成年鸡、「成年」画的是缩小的幼崽。
               更糟的是走查脚本当时只数了「-0 有 8 个、-1 有 8 个」，
               **照样全绿**（数量对、语义反）。是眼睛看出来的。
               改这里必须同时看 `AnimalSprite` 那边，别只改一处。 */
            key={`${id}-${baby ? 0 : 1}`}
            id={`kqf-a-${id}-${baby ? 0 : 1}`}
            viewBox="0 0 80 80"
          >
            {/* 幼崽：绕 (40, 78) 缩小 —— 脚仍然踩在同一条地面线上 */}
            {baby ? (
              <g transform={`translate(40 ${GROUND}) scale(${BABY_SCALE}) translate(-40 -${GROUND})`}>
                <AnimalArtShape a={a} baby />
              </g>
            ) : (
              <AnimalArtShape a={a} baby={false} />
            )}
          </symbol>
        )),
      )}
    </svg>
  )
}

/* ---------------- 引用组件 ---------------- */

/** 这只动物画过精灵没有？没画过的在调用点回落成 emoji。 */
export function hasAnimalSprite(animalId: string): boolean {
  return animalId in ART
}

/**
 * 一只动物。
 *
 * ⚠️ 调用前先问 `hasAnimalSprite()` —— 这个组件对没登记的动物返回 `null`，
 * 兜底交给调用方（见 `AnimalHouse` 的 `AnimalIcon`），
 * 这样「用 emoji 还是用精灵」的判据只有一处。
 */
export function AnimalSprite({
  animalId,
  mature,
  className,
}: {
  animalId: string
  mature: boolean
  className?: string
}) {
  if (!hasAnimalSprite(animalId)) return null
  return (
    <svg
      className={clsx('kqf-animal', className)}
      viewBox="0 0 80 80"
      aria-hidden
      focusable="false"
    >
      <use href={`#kqf-a-${animalId}-${mature ? 1 : 0}`} />
    </svg>
  )
}
