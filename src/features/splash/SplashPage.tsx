/* ============================================================
   入场页（Splash）
   ------------------------------------------------------------
   以前这里只是「🌾 + 小任务农场 + 三个点」的加载占位 —— 数据一读完就
   一闪而过，既不好看也没有任何作用。现在它是一个真正的入场：
   可爱的小农场插画 + 每次打开都换一句的鼓励格言。

   五条纪律：
   1. **零图片**。插画全是程序化 SVG（APK 里不放图片，也不请求网络）。
   2. **格言不用成语**。「天道酬勤」「持之以恒」孩子看不懂，也跟今天
      要做的事没关系。这里每一句都能直接对应「今天做一件小事」。
   3. **整体比主界面暗一档**（暖金 / 黄昏前的阳光）。主界面是干净的白纸，
      入场页要是也白，从入场切进任务页就「没有换场景」的感觉。
      暗是**暖着暗**，不是做成夜景 —— 这是给小孩用的，别整深色。
   4. **太阳升起来，天跟着亮。** 太阳从远山背后升起（起始位移低到被山完全
      挡住，是「真的被遮住」而不是淡入），同时整页那层暖色暗罩淡出。
      两者**同一个时长、同一条缓动**（theme.css 的 anim-sunrise / anim-dawn-lift），
      否则太阳升到位了天还没亮，看着像两件互不相干的事。
   5. ⚠️ **只做「变亮」，不要顺手把色相也换掉。** 试过一版：1.5s 里让整页
      从紫罗兰（#7a6a9c）一路走到金（#f2c463），还让插画的天空和两片山丘
      同时换色 —— 四样东西一起变、色相甩了 200 多度，看起来是「闪了一下」，
      不是「天亮了」。原话是「变化的太突兀了，还不如之前」。
      **「日出到天亮」只是在同一个暖色家族里变亮变浅，色相基本不动**
      （现在全程 H38~43°）。要调就调**明度**和**饱和**，别动色相。
      同理**插画不参与变色** —— 只让暗罩淡出就够了，多动一样就多一分突兀。

   实测平均亮度（Rec.709，390×844）：

   | 时刻 | 亮度 |
   | --- | --- |
   | 日出（暗罩 opacity 0.92） | **173.2** |
   | 天亮（暗罩 opacity 0.02） | **209.2** |
   | 任务页（对照） | 238.9 |

   也就是：**先比主界面暗 66，最后暗 30** —— 天确实亮起来了（+36），
   但结尾仍然明显比主界面暗，切进任务页那一下的「换场景」对比没被吃掉。
   ⚠️ 这个 **+36** 是刻意压住的：改之前是 +43，试过的那版是 +67 ——
   差值越大越像「闪一下」。调色时盯住这个差值，别让它涨回去。
   ⚠️ 动画时长必须明显短于 `SPLASH_MIN_MS = 1900`（App.tsx），
   否则「全亮」那一帧还没出现就切走了，这个效果等于白做。
   ⚠️ 改暗罩的颜色或透明度时，下面四处要**一起**改，否则原生启动图会和这一页闪一下：
     ① `capacitor.config.json` 的 `SplashScreen.backgroundColor`（现为 `#cfa356`）
     ② `res/values/colors.xml` 的 `splash_background`（同一个值，Android 12+ 系统启动屏用）
     ③ `res/drawable/splash.xml` 的三站渐变（现为 `#cd9840` / `#cea050` / `#d2af74`）
     ④ `res/values/styles.xml` 不用改，它只引用上面两个
   取值口径见下面「天光」那段注释 —— ①②是**首帧整幅的平均色**，③是 y=0/50/100% 三点。
   ⚠️ 别手抄，手抄必漏。跑 `npm run splash:check`：它会重量一遍首帧，
   然后逐个核对上面四处（连打包产物 APK 内部一起查），不一致就 exit 1。
   ⚠️ 量亮度时**每个采样点要重新开一次页面**。同一个页面里连续采样的话，
   一次截图 + 解码要几百毫秒，「打算等到的时刻」和「真实时刻」能差出一倍，
   量到的其实是已经切走之后的主界面（三个读数一模一样就是铁证）。
   ============================================================ */

import { useMemo } from 'react'

/**
 * 每次打开随机抽一句。
 *
 * 都是「今天/此刻」口吻 —— 入场页只出现两秒，说太远的话留不下印象。
 */
const QUOTES = [
  '今天做一件小事，明天就多一分底气。',
  '小苗不问土有多深，只问自己长没长。',
  '你认真做事的样子，特别好看。',
  '土里长出来的，都是你亲手种的。',
  '慢一点没关系，别停下就好。',
  '每一个打勾，都是你给自己发的奖状。',
  '今天的你，比昨天多会了一点点。',
  '坚持这件事本身，就已经很了不起。',
  '种子埋在土里的时候，也一直在努力。',
  '做完一件小事，心里就多亮一盏灯。',
  '不用跟别人比，跟昨天的自己比就好。',
  '你今天的努力，农场都替你记着呢。',
  '一步一步走，路就自己出来了。',
  '愿意开始，就已经赢了一半。',
  '把小事做好，就是大本事。',
  '今天的太阳，是专门给你准备的。',
  '攒下来的每一分，都是你自己挣的。',
  '认真的人，运气都不会太差。',
  '成长这件事急不来，但它一定会来。',
  '再坚持一下，小苗就破土了。',
  '你比你以为的更能干。',
  '今天的努力，是明天拆的礼物。',
  '做完了，记得奖励自己一个笑。',
  '田里不长着急的苗，只长踏实的根。',
]

/* ---------------- 插画 ---------------- */

/** 太阳的八道光芒（预先算好坐标，避免在渲染里做三角函数） */
const RAYS: [number, number, number, number][] = [
  [216, 46, 224, 46],
  [208.4, 64.4, 214, 70],
  [190, 72, 190, 80],
  [171.6, 64.4, 166, 70],
  [164, 46, 156, 46],
  [171.6, 27.6, 166, 22],
  [190, 20, 190, 12],
  [208.4, 27.6, 214, 22],
]

/**
 * 小农场插画。
 *
 * 外框交给调用处的 `.surface` 容器（圆角 + 发丝线 + 柔投影），
 * 所以 SVG 自己不做圆角裁切 —— 画面直接铺满 viewBox 就行，
 * 免得多写一层 clipPath 还跟外框对不齐。
 *
 * 配色是「下午四点的阳光」：天空偏暖金、草地压深一档。
 * 太阳本身还是亮的（`#fbbf24` + 琥珀色光芒），所以在暖金天上仍然跳得出来。
 */
function FarmArt() {
  return (
    <svg
      viewBox="0 0 240 200"
      // ⚠️ 别把 width="100%" height="auto" 写成 svg 属性 —— height 只认长度值，
      // 写 "auto" 会在控制台报 `Expected length, "auto"`。走 style。
      style={{ width: '100%', height: 'auto', display: 'block' }}
      aria-hidden
    >
      <defs>
        <linearGradient id="splash-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fbe9bd" />
          <stop offset="100%" stopColor="#eff1d6" />
        </linearGradient>
        <linearGradient id="splash-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a6ddb6" />
          <stop offset="100%" stopColor="#77c792" />
        </linearGradient>
        <linearGradient id="splash-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#55c77c" />
          <stop offset="100%" stopColor="#2da759" />
        </linearGradient>
      </defs>

      {/* 天空 */}
      <rect x="0" y="0" width="240" height="200" fill="url(#splash-sky)" />

      {/* 太阳：从远山背后升上来；升到位之后光芒慢慢转、整颗轻轻上下浮。

          三层 <g> 各管一件事（升 / 浮 / 转），别合并成一条 animation ——
          合并就得手写关键帧把位移和旋转乘在一起，改一个参数要重算一遍。

          为什么是「真的被挡住」而不是淡入：山是在**这之后**画的，
          所以太阳升到山脊线以下时确实被山的填充盖住，
          看着就是「从山后面出来」。调起始位移时记住这一点（见 theme.css）。 */}
      <g className="anim-sunrise">
        <g className="anim-float">
          <g className="anim-spin-slow" style={{ transformOrigin: '190px 46px' }}>
            {RAYS.map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#f59e0b"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
          </g>
          <circle cx="190" cy="46" r="17" fill="#fbbf24" />
        </g>
      </g>

      {/* 云：两朵，一高一低错开 */}
      <g fill="#ffffff">
        <ellipse cx="52" cy="48" rx="17" ry="11" />
        <ellipse cx="67" cy="46" rx="12" ry="9" />
        <ellipse cx="39" cy="51" rx="10" ry="7" />
        <ellipse cx="122" cy="28" rx="11" ry="8" />
        <ellipse cx="132" cy="27" rx="8" ry="6" />
      </g>

      {/* 蝴蝶：比「天上两道弧」的小鸟更小、更清楚 ——
          同一个尺寸下，两道弧会被看成一道污点，蝴蝶的翅膀一眼就认得出来。
          位置要挑空着的左上角天空：右边有太阳和小屋，撞上去就糊成一团。 */}
      <g transform="translate(86 82)">
        <ellipse cx="-5" cy="-3.5" rx="5" ry="6" fill="#fcd34d" />
        <ellipse cx="5" cy="-3.5" rx="5" ry="6" fill="#fcd34d" />
        <ellipse cx="-4" cy="4" rx="3.4" ry="4" fill="#fbbf24" />
        <ellipse cx="4" cy="4" rx="3.4" ry="4" fill="#fbbf24" />
        <rect x="-0.9" y="-6" width="1.8" height="12" rx="0.9" fill="#8a7663" />
      </g>

      {/* 远山 + 一间小屋，一眼认出是「农场」不是「公园」 */}
      <path
        d="M0 122 C 40 102 80 114 120 108 C 160 102 200 116 240 102 L240 200 L0 200 Z"
        fill="url(#splash-far)"
      />
      <g>
        <rect x="160" y="92" width="17" height="13" rx="1.5" fill="#fffdf8" />
        <path d="M156 92 L168.5 81 L181 92 Z" fill="#f0867f" />
        <rect x="166" y="97" width="5.5" height="8" rx="1" fill="#a98a6d" />
      </g>

      {/* 近处的坡 */}
      <path
        d="M0 154 C 44 134 92 148 140 142 C 186 136 214 148 240 142 L240 200 L0 200 Z"
        fill="url(#splash-near)"
      />

      {/* 小苗：主角，画大一点 —— 它是这个 App 的隐喻 */}
      <g className="anim-sway" style={{ transformOrigin: '112px 160px' }}>
        <path
          d="M112 160 C 112 142 111 130 112 116"
          fill="none"
          stroke="#15803d"
          strokeWidth="4.5"
          strokeLinecap="round"
        />
        <path d="M112 134 C 95 131 85 120 89 108 C 105 108 112 119 112 134 Z" fill="#22c55e" />
        <path d="M112 126 C 130 123 140 112 136 100 C 120 100 112 111 112 126 Z" fill="#4ade80" />
        <path
          d="M110 132 C 103 125 96 117 92 111"
          fill="none"
          stroke="#166534"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.45"
        />
        <path
          d="M114 124 C 121 117 128 109 132 103"
          fill="none"
          stroke="#166534"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.45"
        />
      </g>

      {/* 两株小苗：暗示「一片田」，不是孤零零一根 */}
      <g fill="#34d399">
        <path d="M62 170 C 62 162 62 156 62 150" stroke="#15803d" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M62 158 C 55 156 51 151 53 145 C 60 145 62 151 62 158 Z" />
        <path d="M62 155 C 69 153 73 148 71 142 C 64 142 62 148 62 155 Z" />
        <path d="M178 166 C 178 159 178 154 178 149" stroke="#15803d" strokeWidth="2.6" strokeLinecap="round" fill="none" />
        <path d="M178 156 C 171 154 167 149 169 143 C 176 143 178 149 178 156 Z" />
        <path d="M178 153 C 185 151 189 146 187 140 C 180 140 178 146 178 153 Z" />
      </g>

      {/* 草叶：几个小尖角，让坡面不那么空 */}
      <g stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.75">
        <path d="M34 176 l0 -9" />
        <path d="M44 180 l0 -7" />
        <path d="M208 172 l0 -9" />
        <path d="M218 176 l0 -7" />
        <path d="M146 182 l0 -8" />
      </g>
    </svg>
  )
}

/* ---------------- 入场页 ---------------- */

export function SplashPage() {
  // 只抽一次：组件挂载期间不会因为重渲染换句子（换句子会显得很慌）
  const quote = useMemo(() => QUOTES[Math.floor(Math.random() * QUOTES.length)], [])

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      {/* 背景：暖金渐变 —— 「下午四点的阳光」。
          比主界面（白纸）暗一档，切进任务页时才有「换了个场景」的对比。
          顶上一团更亮的光晕代表太阳，别整片压平，不然会发闷。

          ⚠️ 下面两站原来是 #e4ddab / #cfe0ba（偏草色的黄绿），本身饱和度
          就只有 25% / 17%，明度又在 88% 上下 —— 正好落在「中高明度 + 低饱和 +
          黄绿」的泥色区，暗罩一压就显脏（实测 H65~81 S17~21）。
          现在四站全部收在暖橙区间（H 39~43°），最后一站靠**极高明度**
          （V97%，读起来是奶油色）而不是靠低饱和来变浅。
          **别再往这里加偏绿的浅色。** */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(96% 58% at 50% 14%, #f8d57e 0%, rgba(248,213,126,0) 72%),' +
            'linear-gradient(180deg, #e8ac3f 0%, #efc45f 34%, #f4d488 64%, #f8e2ac 100%)',
        }}
      />

      <div className="relative flex w-full max-w-[300px] flex-col items-center">
        {/* 插画：外面这层 .surface 负责圆角 + 发丝线 + 柔投影，
            SVG 直接铺满，省得在 SVG 里再画一圈圆角裁切。
            白卡在暖金背景上自己就跳出来了，不用再加描边。 */}
        <div className="anim-bounce-in surface w-full overflow-hidden">
          <FarmArt />
        </div>

        {/* 品牌 */}
        <h1 className="anim-bounce-in anim-delay-2 mt-2 font-display text-3xl font-extrabold tracking-wide text-ink-900">
          小任务农场
        </h1>
        {/* 副标题用 ink-700 而不是 ink-500：底色变暖金之后，
            ink-500 的对比度掉到 2:1 左右，小字会糊在背景里。 */}
        <p className="anim-fade-in anim-delay-3 mt-1 text-xs font-bold text-ink-700">
          做一件小事 · 种一片田野
        </p>

        {/* 格言 */}
        <div className="anim-fade-in anim-delay-4 surface mt-6 w-full px-4 py-3.5">
          <p className="text-center text-sm font-bold leading-relaxed text-ink-700">
            {quote}
          </p>
        </div>

        {/* 加载指示：三个点，尽量不抢戏。
            用 grass-600 而不是 grass-400 —— 底色暗了，浅绿点会看不见。 */}
        <div className="anim-fade-in anim-delay-5 mt-7 flex gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="anim-sparkle h-2 w-2 rounded-full bg-grass-600"
              style={{ animationDelay: `${i * 0.18}s` }}
            />
          ))}
        </div>
      </div>

      {/* 天光：一层暖色暗罩，随太阳升起淡出（keyframes 见 theme.css）。

          ⚠️ 它盖在**所有内容之上**（连白卡和文字一起压暗）。只压背景的话
          白卡纹丝不动，看着像「背景色改了」，不像「天亮了」——
          而日出本来就该是整个场景一起亮起来。

          ⚠️ 原生启动图那边只能填**一个纯色**（Android 12+ 的系统启动屏 API 不认渐变），
          所以 `capacitor.config.json` 里填的是**首帧整幅的平均色**（现为 `#cfa356`，
          实测），不是渐变某一站的色值 —— 整屏铺一个颜色，用平均色接上去最不容易
          看出接缝。渐变的三个色站另写在 `res/drawable/splash.xml`。
          **改这里的颜色或透明度，四个地方必须一起同步，跑 `npm run splash:check` 验。**

          ⚠️ 暗罩要**高饱和的暖色**（深琥珀 #8a4d08），不要用发灰的棕。
          旧值 rgba(88,60,26,0.3) 会连同背景渐变里那两站低饱和的黄绿一起
          算出卡其色（实测 H65 S21 V71），那正是「脏」的来源。
          判据与推导见 theme.css 的 kqf-dawn-lift。 */}
      <div
        className="anim-dawn-lift pointer-events-none absolute inset-0"
        style={{ background: 'rgba(138, 77, 8, 0.34)' }}
        aria-hidden
      />
    </div>
  )
}
