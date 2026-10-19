/**
 * 娃娃机的 3D 场景 —— **只负责画，不负责规则**。
 *
 * ---------------------------------------------------------------------------
 * 这个文件是 `E:/plan/test25/claw-machine` 那份参考实现**重写**来的
 * ---------------------------------------------------------------------------
 *
 * 保留的：Gen-2 商场柜的观感（白色亮面柜体 / 铝合金立柱 / LED 灯带 /
 * 玻璃 / 圆形取物口 / 灯箱 / 爪子和娃娃）。
 *
 * **刻意丢掉的**（每一条都有理由，别当成「还没做」）：
 *
 * | 丢掉 | 为什么 |
 * | --- | --- |
 * | 邻居柜子 | 家长 2026-10-16：「娃娃机 只用显示一台」 —— **别加回来**（连排第二台机器是这句话直接禁止的东西） |
 * | 商场房间 | 同上那句话只禁「第二台机器」，房间是 2026-10-17 **加回来的**：横屏两侧会空出 200~330px 的纯色，见下面「商场房间」那段 |
 * | OrbitControls / 多机位 | 家长 2026-10-17：「只保留一个（机位）」；而且自由旋转会把柜子转出画面 |
 * | 自带音效 / 浮层 / 全屏 / 手柄 | 宿主都有（`playTone` / `pushToast` / 触控），自己再造一份就是两套事实 |
 *
 * 曾经也丢过、**2026-10-17 又加回来**的两条（家长要求「原版功能都保留」）：
 *
 * | 加回来 | 代价 / 注意 |
 * | --- | --- |
 * | Rapier3D 物理 | 单独 chunk（gzip ≈755 KB，动态 import，没加载完照样能玩）。★ **它只演不算** —— 见 `clawPhysics.ts` 头注释 |
 * | EffectComposer 后处理 | 只在 `hardwareConcurrency > 4` 时开，而且**不是 bloom**（见下面「后处理」那段） |
 *
 * ---------------------------------------------------------------------------
 * ★★ 三条硬约束（本项目踩过坑，见 `docs/game-authoring-guide.md` §0.4）
 * ---------------------------------------------------------------------------
 *
 * ① **`setSize(w, h, false)`** —— 第三个参数 `updateStyle=false` 是必须的。
 *    否则 three 会往 canvas 上写行内 `style.width/height`，和宿主的响应式列
 *    （`.page-col`）打架：平板上被压两次、手机上撑出横向滚动。
 *
 * ② **DPR 封顶 2。** 手机常见 DPR=3，`3² = 9` 倍填充率，一个带光照的动画场景
 *    直接掉到 20fps。封到 2 几乎看不出差别，填充率少一半。
 *
 * ③ **尺寸来自 `ResizeObserver` 盯容器，不是 `window.resize`。**
 *    宿主给的宽度由 `.page-col` 决定，它**不跟着窗口变**
 *    （平板分屏、软键盘弹起都会变宽高但窗口尺寸不变）。
 *
 * 取景用 **contain**（柜子永远完整），不是 cover —— 同一个游戏要在
 * 430px 和 1024px 宽下都活着，宽高比差 2.4 倍，cover 必然裁掉东西。
 */
import {
  ACESFilmicToneMapping,
  Color,
  DirectionalLight,
  Group,
  HalfFloatType,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ANG_CLOSED, ANG_IDLE, ANG_OPEN, createClawPhysics, type ClawPhysics } from './clawPhysics'
import {
  CAB,
  CARRIAGE_Y,
  HOLE,
  OX,
  OZ,
  PH,
  HOME,
  PICKUP,
  PICKUP_RING,
} from './scene/dims'
import { buildMachine, buildRoom, buildEnvScene, disposeMachine, M, applyTheme } from './scene/machine'
import { buildPrize, disposePlush, setFurShells, type PlushModel } from './scene/plush'
import { PRIZE_TYPES, type PrizeType } from './scene/prizeTypes'
import { CLAW_THEMES } from './scene/themes'

export { CLAW_THEMES }

/* ============================ 尺寸 ============================ */

/*
  柜体的所有尺寸都来自 `scene/dims.ts` —— 那是参考实现的一份逐字搬运。
  这里只做**别名**，因为文件后半段（取景 / 走查）到处在用 `HX` / `HZ` / `GLASS_H`。

  ★★ 2026-10-19：`HX/HZ` 从 **0.58 / 0.5** 改成 **0.5 / 0.4**。
    以前这两个数是「机身外框」的尺寸，被当成玻璃柜用了 ——
    于是玻璃柜比原版大 16%，同一套取景参数下柜子显得**矮胖**，
    而且娃娃相对柜子更大。原版的 `CAB` 是玻璃柜内尺寸，
    外框另有 `OX / OZ`（0.58 / 0.5）。
*/
const HX = CAB.hx
const HZ = CAB.hz
const GLASS_H = CAB.top
/** 天车轨道的高度（爪子在它下面吊着）。 */
const RAIL_Y = CARRIAGE_Y

/**
 * 取物口的**可视窗口**（宽 × 高，世界单位）—— `doorPose()` 按它算距离。
 *
 * ★★ 必须是**外径**，不是黑洞的直径。一开始照抄原版的 `0.32 × 0.34`
 *   （那是他们那台机器窗口的实际大小），可我们的圆环外径是
 *   `(0.22 + 0.022) × 2 = 0.484` —— 窗口比被 fit 的尺寸大 1.5 倍，
 *   蹲下去时圆环**撑出画面**，整屏只剩一个黑圆。
 *   ➜ 从几何常量派生，改圆环大小自动跟着变。
 */
const PICKUP_WINDOW = { w: (PICKUP_RING.r + PICKUP_RING.t) * 2, h: (PICKUP_RING.r + PICKUP_RING.t) * 2 }

/**
 * 取物口窗口的 4 个角（世界坐标，贴在机身正面）。
 *
 * ★ 只给 `debugCamera().winW / winH` 用：它让走查能直接问
 *   「蹲下去以后这个窗口在画面里**比平时大多少倍**」——
 *   这是**同一个物体、同一个投影片面**的两次测量，比例干净。
 */
const PICKUP_QUAD: [number, number, number][] = (() => {
  const r = PICKUP_WINDOW.w / 2
  return [
    [PICKUP.x - r, PICKUP.y - r, PICKUP.z],
    [PICKUP.x + r, PICKUP.y - r, PICKUP.z],
    [PICKUP.x + r, PICKUP.y + r, PICKUP.z],
    [PICKUP.x - r, PICKUP.y + r, PICKUP.z],
  ]
})()

/**
 * 整台机器的**实际外框**（含立柱、灯箱、底座）。`debugFrame` 用它报 `cabinet`。
 *
 * ★★ 这份边界**只有一份**：走查和取景都读它。以前 `debugFrame` 自己写了一套数字、
 *   取景用的是另一套抽象「设计矩形」，两者不一致 —— 结果就是
 *   **量出来柜子底边掉在画布外 60px**（2026-10-16 实测）。同一个事实存两份，必然走散。
 */
const BOX = {
  minX: -(OX + 0.04),
  maxX: OX + 0.04,
  minY: -PH,
  maxY: GLASS_H + 0.32,
  minZ: -(OZ + 0.04),
  maxZ: OZ + 0.04,
}

/**
 * 相机 FOV。**和参考实现同一个数（45）**。
 *
 * ★ 曾经是 26 —— 那是「把整个柜子装进画面」的思路，结果透视极弱、画面像
 *   正交投影，而且相机离得很远，柜子只占画面宽度的 66%，四周一圈灰底。
 *   孩子看到的是一张「柜子的照片」，不是「站在柜子前面」。
 *   45 度才有那种往里看的纵深感。
 */
const FOV = 45

/** 临时：`?fit` 时把取景各阶段的 dist / 投影打到 console（排查用，平时关着）。 */
const DEBUG_FIT =
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('fit')

/**
 * 相机看哪里。**不是**柜子的几何中心。
 *
 * 取 `0.34`（玻璃区偏下）：玻璃是 0…1.2，看中心（0.6）的话池子和爪子会被
 * 推到画面下半，柜顶灯箱占掉太多。看 0.34 时池子落在画面下三分之一、
 * 爪子在中间偏上 —— 和参考实现一致（它的 `target.y` 在竖屏下是 0.35）。
 */
const LOOK_Y = 0.34

/**
 * **横屏**的视线高度。
 *
 * ★★ 2026-10-19：横屏原来也用 `LOOK_Y = 0.34`，结果**机顶灯箱整个被顶出画面**
 *   （实测 `FRAME.top = −38.7px`，舞台只有 228px 高）。
 *   原因很直接：横屏的画布又宽又矮，而「玻璃必须完整」这条把 `dist` 锁死了 ——
 *   玻璃刚好占满高度，上面就一点余量都没有，而灯箱在玻璃**上面**
 *   （`CAB.top + 0.32 ≈ 1.52`，`machine.ts` 里 `top + 0.16 ± 0.16`）。
 *
 * ➜ 抬视线 = 画面整体下移：灯箱进来、机身被裁。
 *   这正是原版的横屏构图（它的 `target.y` 横屏 **0.45**、竖屏 **0.35** ——
 *   横屏也抬了一点，只是它画布高得多，抬 0.1 就够）。
 *
 * ⚠️ 别再抬到 0.6 以上：玻璃底会被顶出画面下沿，池子和娃娃就看不见了。
 */
const LOOK_Y_WIDE = 0.52

/**
 * 相机的极角（从 +Y 量，弧度）= 俯视多少。参考实现竖屏用 **1.28**。
 *
 * 1.28 rad ≈ 73°，也就是相机比视线高约 **17°**。这一点很关键：
 * 平视（`pol = π/2`）时池底几乎是一条线，娃娃看起来是**贴**在背景上；
 * 俯 17° 才能看见池底那块梯形，堆起来的娃娃才有「堆」的体积感。
 */
const CAM_POL = 1.28

/**
 * 中奖后蹲在取物口前面**停留**多久（秒）。
 *
 * 参考实现是 `doorCam = 3.5`：1.1 秒蹲下去、1.1 秒站起来，中间留 1.3 秒看清窗口里的奖品。
 * 短于 2 秒的话，蹲下去和站起来会连成一气，像镜头抽了一下。
 */
const DOOR_HOLD = 3.5

/**
 * **取景框**：必须完整落在画面里的那块区域。
 *
 * ★★ 注意它**不是** `BOX`。原版是「站在柜子前」，画面里柜子**是满的、而且是被裁的** ——
 * 顶上的灯箱切掉一点、底下的机身切掉大半。我们之前用 `BOX`（含 1.0 高的底座）
 * 做 contain，为了把底座也装进去，相机被推得很远，玻璃区只剩画面宽度的 66%。
 *
 * 取景框 = 玻璃区 + 一点灯箱 + 一点机身（露出取物口）：
 *   · 上边界 `GLASS_H + 0.22` —— 灯箱露一条边，不切标题
 *   · 下边界 `-0.72` —— 露出取物口，机身下半截允许被裁
 *
 * `resize` 会把这个框**完整装进画面**，然后相机按 `CAM_POL` 俯视。
 * 因为框是「宽度主导」的，玻璃区会横向铺满 —— 这就是原版那种「贴着柜子站」的观感。
 */
const FRAME = {
  minX: -(HX + 0.05),
  maxX: HX + 0.05,
  /*
    ★★ 2026-10-18：`-0.72` → **`-0.42`**。用户原话「游戏开始的视角要近一点」。

    差在哪：玻璃区是 `0…1.2`。用 `-0.72` 时整个框高 **2.18**，玻璃只占 **55%**；
    参考实现竖屏的 `fitDist()` 把 `0.95` 的高度装进可见区 ——
    也就是**玻璃几乎占满画面高度**，只露一条机顶、机身基本看不见。
    `-0.42` 让框高 → 1.88，玻璃占 ≈ 64%，机身只露出取物口上沿。

    ⚠️ 别再往下压到 `-0.2` 以下：取物口在 `y = -0.52`，框底高于它之后
      「蹲下去看取物口」那个过场就会从一个**完全看不见**的地方开始。
  */
  minY: -0.42,
  maxY: GLASS_H + 0.22,
  minZ: -(HZ + 0.05),
  maxZ: HZ + 0.05,
}

/**
 * 玻璃区在画面上至少要占多少（取**较满的那个方向**，0~1）。
 *
 * ★★ 2026-10-18 改判据：原来只看**高度**占比。但手机是窄屏，
 *   约束方向一直是**宽度** —— 只量高度的话，「宽度上已经怼满了」和
 *   「整台机器缩在中间」量出来没区别（两者高度都接近 1）。
 *   ➜ 现在取 `max(高度占比, 宽度占比)`，两个方向谁满算谁。
 *
 * 取值 **0.86**（竖屏）：玻璃横向被裁掉一点（参考实现就裁约 23%），
 * 但**不许**整柜缩进去。实测竖屏 `glassFill ≈ 1.03`。
 *
 * ⚠️ **横屏不用这个数**（2026-10-19 起）。
 *   横屏的承诺是「**整台机器完整**」：装下 [玻璃底, 灯箱顶]（`VERT_CORNERS_WIDE`），
 *   玻璃就注定只占 ~0.60。以前那个 `GLASS_MIN_FILL_WIDE = 0.74` 是在
 *   「横屏只装玻璃」的年代定的，现在既做不到、也不该做到 ——
 *   再往前推就是把灯箱裁掉（那是用户抱怨过的「机器被切头」）。
 *   ➜ 横屏的「够不够近」由走查量**整机纵向占比**，判据和承诺同一口径。
 */
const GLASS_MIN_FILL = 0.86

/**
 * 宽屏取景的修正系数 —— 对应参考实现的 `hFrac / visFrac`。
 *
 * 它的画面被 UI 吃掉了：两侧操作列占 `2 × 230~320px`，上下是 LED 板与操作台。
 * 我们这边宽屏时页面是 `.page-col`（672~1024）居中，两侧留白更大，
 * 所以不是照抄 `0.15 / 0.72` 的比例，而是给固定值：横屏拟合 `0.72 / 0.86` 宽、`1.22 / 0.93` 高。
 * 数值本身不重要 —— 重要的是**横屏不能沿用竖屏的 `0.62`**：
 * 横屏画面宽得多，沿用窄值会让柜子只剩画面中间一小条。
 */
const HFRAC_WIDE = 0.86
const VISFRAC_WIDE = 0.93


/**
 * 待命时指头张开多少（`ClawVisual.spread` 的口径：0~1，1 = 张到最大）。
 *
 * ★ 数值来自 `clawPhysics` 的 `ANG_IDLE / ANG_OPEN`，**别在页面里再写一个 0.35** ——
 *   写死的话，以后调待命角度只改一边，页面就会把爪子摆成另一个姿势。
 */
export const CLAW_PRONG_IDLE = ANG_IDLE / ANG_OPEN

/**
 * 爪子的**待命位**（原版的 `HOME`：左前角）。
 *
 * ★ 页面用它当瞄准的初值 —— 原版空转时爪子就停在那儿，不是池子正中。
 *   写死 `{x:0,z:0}` 的话，开局那一帧爪子在正中间，第一次投币前会「飘」一下。
 */
export const CLAW_HOME: { x: number; z: number } = { x: HOME.x, z: HOME.z }

/* ============================ 娃娃 ============================ */

/**
 * 池子里放多少只 —— 参考实现是 `game.fill(30)`。
 *
 * ★★ 从 **96 只缩到 30 只**（2026-10-19，照搬原版）。
 *   我们以前一只娃娃直径 0.144（原版是 0.09~0.11），为了把池子堆满硬塞了 96 只，
 *   代价是每只 9 个 mesh ⇒ 近 900 次 draw call，而且娃娃**个头太大**，
 *   看上去像一池子抱枕 —— 这也是「跟原版不一样」的一条。
 *
 *   现在娃娃是原版尺寸、原版造型（五种），30 只正好堆成原版那种
 *   「满到需要拨开、但还看得见垫子」的样子。
 */
const PRIZE_COUNT = 30

/**
 * 娃娃的**初始布局**。
 *
 * ⚠️ 这**不是**最终位置：物理可用时 `clawPhysics` 会按自己的确定性扰动
 *   分波从空中投放，让它们自己堆（见那边的「建池」）。这里只提供三件事：
 *   ① 有几只；② 每只是什么种类 / 颜色 / 种子；③ 物理起不来时的降级位置。
 *
 * ⚠️ 必须确定性（不用 `Math.random()`）：走查要能复现同一池子。
 */
function initialPrizeLayout(): {
  x: number
  z: number
  y: number
  type: number
  color: number
  seed: number
  scale: number
}[] {
  const out: {
    x: number
    z: number
    y: number
    type: number
    color: number
    seed: number
    scale: number
  }[] = []
  /** 确定性伪随机（和物理那边同源手法，但各算各的，互不依赖）。 */
  const rnd = (n: number) => {
    const v = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return v - Math.floor(v)
  }
  const mx = HX - 0.07
  const mz = HZ - 0.07
  for (let i = 0; i < PRIZE_COUNT; i++) {
    /*
      ★★ 2026-10-19：这里原来是一张 6×5 的**阅兵网格**，而且「碰到洞口就 `continue`」
        —— 于是 30 只变成 26 只（`debugPhysics().bodies` 一直是 26，一直没人发现）。
        网格还只铺到 `x ±0.40 / z -0.30…0.28`，比池底小一圈 ⇒ 前半边永远是空的。

      ➜ 现在和物理的 `fillSpot()` 用同一套口径：铺满池底、碰到洞口**重抽**（不是丢弃），
        所以**数量恒等于 `PRIZE_COUNT`**，位置也是原版那种散开的堆。
        这仍然只是「物理起不来时的降级位置」，真正落点由物理投放决定。
    */
    let x = 0
    let z = 0
    for (let t = 0; t < 30; t++) {
      x = -mx + rnd(i * 91 + t * 7 + 1) * 2 * mx
      z = -mz + rnd(i * 91 + t * 7 + 2) * 2 * mz
      const inHole =
        x > HOLE.x0 - 0.08 && x < HOLE.x1 + 0.08 && z > HOLE.z0 - 0.08 && z < HOLE.z1 + 0.08
      if (!inHole) break
    }
    x = x * 0.9 + 0.03
    z = z * 0.9 - 0.03
    const type = i % PRIZE_TYPES.length
    const colors = PRIZE_TYPES[type].colors
    out.push({
      x,
      z,
      // 降级摆放的层高：让它们**看起来**是一堆，而不是平铺一层
      y: 0.02 + rnd(i * 17 + 5) * 0.18,
      type,
      color: colors[(i * 3 + 1) % colors.length],
      seed: ((i * 37) % 97) / 97,
      /*
        ★★ 每只的**尺寸**在 0.95~1.25 之间浮动 —— 照抄原版
          （`physics.ts` 的 `spawnPrize`：`sc = 0.95 + rng()*0.3`）。

        这不是装饰：全部一样大时池子看着像「一排复制粘贴」，
        而且平均小 10%（1.0 vs 1.1）⇒ 30 只铺不满池底、还堆不起来，
        和原版那种「满到要拨开」的观感差一截。

        ⚠️ 只在这里算一次。视觉和碰撞体**都读这个数**：
          视觉是 `group.scale`，物理在 `clawPhysics` 里读 `g.scale.x`
          再乘到每个零件的半径上 —— 所以不会出现「看得见的大、摸得着的小」。
      */
      scale: 0.95 + rnd(i * 53 + 11) * 0.3,
    })
  }
  return out
}


/* ============================ 对外接口 ============================ */

/** 爪子 / 娃娃的**视觉状态**。页面每帧算好传进来，这里只负责摆。 */
export interface ClawVisual {
  /** 爪子中心（世界坐标 x / z），以及 hub 的高度 y */
  clawX: number
  clawZ: number
  hubY: number
  /** 合爪程度：0 = 完全张开，1 = 完全合上 */
  close: number
  /**
   * 张开程度：`CLAW_PRONG_IDLE`（≈0.84）= 待命，`1` = 下爪时张到最大。
   *
   * ⚠️ 不能只用 `close` 表达：`close` 在「待命」和「下爪」时都是 0，
   * 而这两种状态要的姿势不一样（待命微张 / 下爪全张）。
   */
  spread: number
  /** 正被爪子夹着的那只娃娃的下标；没有就是 null */
  held: number | null
  /** 取物口灯闪烁（抓到那一刻） */
  winFlash: number
  /** 爪子是不是在下爪/提起（用来决定电机声和轻微抖动） */
  busy: boolean
}

export interface ClawStage {
  /** 每帧调一次。`t` 是秒（做 LED 呼吸用），`reducedMotion` 时停掉动画但保留静态姿势。 */
  render(t: number, v: ClawVisual, reducedMotion: boolean): void
  /** 容器尺寸变了要调（内部也挂了 ResizeObserver，一般不用手动调） */
  resize(): void
  /** ★ 必须调 —— 不调会漏 GPU 显存（几何 / 材质 / 贴图 / renderer 都要 dispose） */
  dispose(): void
  /**
   * 给走查脚本用：把柜子的包围盒**投影到画布坐标**。
   *
   * 用来断言「柜子完整在容器里」（contain 取景的核心判据）。
   * 靠肉眼截图看「好像没被裁」不算证据 —— 这里给的是可断言的数字。
   */
  debugFrame(): {
    /** ★ 判据：玻璃区必须**完整**在画布内，而且横向要铺满 */
    glass: { left: number; top: number; right: number; bottom: number }
    /** ★ 判据：玻璃区占画面高度的比例 */
    glassFillY: number
    /** ★ 判据：玻璃区占画面宽度的比例（竖屏时它才是约束方向） */
    glassFillX: number
    /** ★ 判据：`max(glassFillX, glassFillY)`，必须 ≥ `glassFillMin` —— 走查只认这两个 */
    glassFill: number
    /**
     * ★ **竖屏**的合格线（`GLASS_MIN_FILL`）。
     *
     * ⚠️ 横屏不要用它 —— 横屏的承诺是「整台机器完整」，玻璃只占约 0.60，
     *   走查在横屏改量 `cabinet` 的纵向占比（见 `capture-claw.mjs`）。
     */
    glassFillMin: number
    /** 取景框（必须完整可见的那块） */
    frame: { left: number; top: number; right: number; bottom: number }
    /** 整台机器 —— **允许越界**（原版就是裁掉底座的） */
    cabinet: { left: number; top: number; right: number; bottom: number }
    canvas: { w: number; h: number }
    dpr: number
    /** 商场房间（地板 + 后墙）这一档开没开 —— 只在两侧有空白时开，见 `resize()` */
    roomVisible: boolean
    /**
     * 阴影贴图一个 texel 覆盖多少世界单位（从实际投影矩阵反推）。
     * ★ 忘了 `shadow.camera.updateProjectionMatrix()` 时它会变成 0.0098 而不是 0.0008。
     */
    shadowTexel: number
    /**
     * 天车导轨 / 待命位（爪子上方那条缆绳露出来多少，走查要量）。
     * `railY - hubY` 就是待命时的吊杆长度 —— 原版是 `L_MIN = 0.12`。
     */
    railY: number
  }
  /** 走查脚本用：娃娃数量 */
  prizeCount(): number
  /**
   * 机位现在是什么状态（默认机位 / 蹲在取物口）。
   *
   * ★ 中奖后那 3.5 秒的「蹲下去」是个**演出**，截图缩略图上很容易看成
   *   「差不多」；这里给数字，让走查能断言「目标点真的移到了取物口」。
   */
  debugCamera(): {
    mode: 'view' | 'door'
    /** 相机到目标点的**直线**距离（`view` 模式下它在「呼吸」里会微动） */
    dist: number
    /** 蹲到取物口时的设计距离 `doorPose()` 算出来的 `d`（和上面同单位、不同口径） */
    doorDist: number
    /** 取物口窗口在**画面宽度**里占多少（当前机位下投出来的，默认机位也有值） */
    winW: number
    /** 取物口窗口在**画面高度**里占多少 */
    winH: number
    /** 相机看着的那一点（蹲下去时会移到取物口附近） */
    look: { x: number; y: number; z: number }
    /** 取物口的世界坐标 —— 和 `look` 比就知道看的是不是它 */
    pickup: { x: number; y: number; z: number }
    doorHold: number
    /** 正摆在取物口的那只奖品（−1 = 没有） */
    winPrize: number
    winShow: number
  }
  /**
   * 指头**实际**摆到的角度（弧度，`prongInners[0].rotation.z`）。
   *
   * ★ 为什么单独给一个：`debugVisual()` 报的是页面**传进来**的 `close` ——
   *   那是**意图**，不是画面。`applyProngs()` 里还有「夹着娃娃就合到 0.86
   *   为止」这种换算，光看 `close` 分不出「指头真的转了」和「参数变了但没画」。
   *   只有这个数能证明指头**真的扫过那 70°**。
   */
  debugProng(): number
  /**
   * 离 `(x, z)` 最近的娃娃下标，一个都没有就是 `-1`。
   *
   * 页面用它来区分「夹住了又滑掉」和「压根没夹到」——
   * 两句给孩子的话不一样（`clawTimeline.ts` 的 `clawOutcomeText`）。
   *
   * ⚠️ 比的是娃娃的**静止位置**，不是动画中的位置 ——
   * 问的是「下爪那一刻底下有没有东西」。
   */
  nearestPrize(x: number, z: number): { index: number; dist: number }
  /**
   * 第 `index` 只娃娃**静止时**的位置；越界返回 `null`。
   *
   * 页面在「中了但没对准」时用它把下爪点挪到最近的娃娃上 ——
   * 不挪的话爪子会在半空合上、娃娃**瞬移**到爪子里（`render` 里
   * 被夹住的那只是直接 `position.set` 过去的），那一跳很显眼。
   */
  prizeAt(index: number): { x: number; z: number } | null
  /**
   * 第 `index` 只娃娃**画面上**的三维位置（three 的 `Group.position`）。
   *
   * ★ 和 `prizeAt()` 的区别：那个给的是「池子里的平面位置」，给页面做瞄准用；
   *   这个给的是**这一刻画出去的位置**，包括物理写回的结果。
   *   走查用它抓「娃娃被爪子顶飞到半空」——那种 bug 在截图里很容易被当成
   *   「堆得高」，只有数字能分辨。
   */
  debugPrizePos(index: number): { x: number; y: number; z: number } | null
  /**
   * `(x, z)` 正下方最高的那个面（娃娃顶 / 池底）的高度。
   *
   * 页面用它算「这一局爪子下到多深」—— 原版是探出来的（`probeSurface()`），
   * 不是写死一个高度。写死的话，对着空地按下去爪子会**悬在半空合爪**，
   * 那正是「下钩差很多」里最显眼的一条。
   */
  surfaceAt(x: number, z: number): number
  /**
   * 屏幕坐标（`clientX/clientY`）→ 池子里的世界坐标。
   *
   * 给「拖着爪子瞄准」用。超出池子会被**夹在池子边缘**（不能把爪子拖到玻璃外面）。
   *
   * ⚠️ 这里用的是**线性映射**（把池底矩形投影到屏幕再按比例换算），
   * 不是射线求交。相机基本是正对的，透视误差很小，瞄准够用；
   * 换成 raycaster 会更准，但要多引一个模块，不值得。
   */
  fieldFromScreen(clientX: number, clientY: number): { x: number; z: number }
  /**
   * 换配色（`0..CLAW_THEMES.length-1`）。越界会取模，调用方不用自己夹。
   *
   * ★ 换的不只是柜身的 `accent`，还包括 **LED 灯带 / 灯箱 / 背板** ——
   * 后两个是画在 canvas 上的贴图，只改材质色不会跟着变。
   */
  setTheme(index: number): void
  /** 当前配色下标。走查脚本用它断言「换色真的生效了」，不靠看截图。 */
  themeIndex(): number
  /**
   * 走查脚本用：**这一帧到底开了哪些效果**。
   *
   * ★ 为什么需要它：「代码里写了 `shadowMap.enabled = true`」和
   * 「运行时真的开着」是两件事 —— 后者才决定孩子看到什么。
   * 有了它就能断言，而不用去比截图（截图逐字节比对本来就不稳）。
   */
  debugEffects(): {
    /** 阴影渲染开没开 */
    shadows: boolean
    /** 有多少个 mesh 真的在投影（= 0 说明遍历没生效） */
    shadowCasters: number
    /** 环境贴图挂上了没 */
    envMap: boolean
    /** 后处理链在不在（低端机会退化成直接 render） */
    post: boolean
    /** 当前配色下标 */
    theme: number
  }
  /**
   * 「再画一帧，而且**这一帧**强制开/关阴影」—— 只给走查做 A/B 对照。
   *
   * ★★★ 为什么必须做到「同一帧」：前面三版 A/B 都是「截图 → 调开关 → 再截图」，
   *   **全部不可证伪**，而且变异测试三版全绿。两层原因：
   *
   *   ① 截图时机：`debugSetShadows()` 同步返回，页面**下一帧**才重画；
   *      紧跟其后的截图可能拍到还没重画的那帧。
   *   ② 画面自己会动：软体回弹 / LED 呼吸 / 光晕都在改像素。实测「**同一状态**
   *      连拍两张」的平均差 3.7~4.5 个色阶，而「开 vs 关」只差 8.6~25 ——
   *      只有 2~5 倍。判据卡在这个量级上，换个时间跑就会翻。
   *
   *   ➜ 这个接口把开关翻在 `render()` **内部**：同步画一帧，用的 `t` 是
   *     **上一帧那个**（灯光呼吸 / 相机缓动全冻在同一时刻），
   *     所以两张图的唯一变量就是「这一帧有没有画阴影贴图」。
   *
   * ⚠️ 它**不参与任何游戏逻辑**（只是把最后一次的视觉状态重画一遍），
   *   页面里没有任何调用点。返回值 = 这一帧**真的用**的那个开关值
   *   （读回真实状态，不是回显入参 —— 见 `debugSetShadows` 那段说明）。
   */
  debugForceShadowFrame(on: boolean): { shadows: boolean; drew: boolean }
  /**
   * 开关阴影贴图 —— **只给走查做 A/B 对照**（页面里没有任何调用点）。
   * 返回切换之后的值；用完必须 `debugSetShadows(true)` 调回去。
   */
  debugSetShadows(on: boolean): boolean
  /**
   * 走查脚本用：**最后一帧收到的视觉状态**。
   *
   * 断言「摇杆 / 键盘真的把爪子挪了」只能靠它 —— `ClawVisual` 是页面算完
   * 传进来的，DOM 里读不到，而截图只能证明「看起来动了一点」。
   */
  debugVisual(): ClawVisual | null
  /**
   * 走查脚本用：**物理层到底在不在跑**。
   *
   * ★ 必须能区分三种状态，否则「物理没起来」会被看成「物理没问题」：
   *   · `loading` —— 还在下载 755 KB 的 chunk（正常，前 1 秒）
   *   · `failed`  —— 起不来，已经退回静态摆放（**能玩，但没有物理**）
   *   · `ready`   —— 真的在跑，`bodies` / `awake` 才有意义
   */
  debugPhysics(): {
    state: 'loading' | 'ready' | 'failed' | 'off'
    bodies: number
    /** 手里有没有东西（握持目标还挂着没有） */
    held: boolean
    /** 还醒着的刚体数 —— 全睡了说明模拟真的停了 */
    awake: number
    /** 掉进通道、被放回池子的次数 */
    recycled: number
    /** 回收记录（最近 24 条）—— 能分清「夹住那只被送进去」和「散货被挤进去」 */
    recycledLog: { index: number; x: number; y: number; z: number }[]
    steps: number
    error: string
  }
}

/**
 * 建场景。**WebGL 起不来就返回 `null`**（别抛 —— 宿主那边要能优雅降级）。
 */
export function createClawStage(container: HTMLElement): ClawStage | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }

  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  container.appendChild(canvas)

  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  /*
    阴影 —— 2026-10-17 补上。

    ★ 这一条是「看着不 3D」的最大单一原因：没有接触阴影时，娃娃之间、
      娃娃和底板之间全是悬空的，大脑会把「没有落地感」读成「像贴纸」。
      之前只有直射光造成的明暗，没有投影。

    ⚠️ 用 `PCFSoftShadowMap` 不是 `PCFShadowMap`：后者边缘是硬锯齿，
      在这么小的柜子里（1.16 × 1.0 世界单位）尤其明显。
    ⚠️ 阴影贴图**只有一张**（key light），别给每个灯都开 —— 手机上每多一张
      就是一次完整的额外渲染。
  */
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  /*
    毛壳层数（娃娃身上那层「毛」）按设备分档。

    ★ 参考实现是 6 层。每层都是一次完整的 instanced draw，
      30 只娃娃 × 每个材质一份 ⇒ 低端机上这是最大的一笔开销。
      `hardwareConcurrency <= 4` 时降到 3 层：毛的边缘会硬一点，
      但在手机上根本看不出来，帧率却是实打实的。
  */
  setFurShells((navigator.hardwareConcurrency || 4) > 4 ? 6 : 3)

  const scene = new Scene()
  scene.background = new Color(0xe9e6f2)

  /*
    环境贴图 —— 2026-10-17 补上。

    ★ 为什么这条比「加更多灯」有用：`MeshPhysicalMaterial` 的 `clearcoat`
      和玻璃的反射**需要一个环境去反射**。没有 `scene.environment` 时，
      clearcoat 的高光只能来自直射光 ⇒ 整片糊成一块死白。
      这正是旧代码里那句注释的根因：「clearcoat 从 1 降到 0.4：整面玻璃上
      那层清漆高光会糊成一大片白」—— 当时是**压参数掩盖症状**，现在治根。

    `RoomEnvironment` 是程序生成的（无外部贴图、离线可用），
    经 `PMREMGenerator` 预卷积成 mipmap 链。只生成一次，之后零成本。
  */
  const pmrem = new PMREMGenerator(renderer)
  /*
    ★★★ 环境贴图**不能用 `RoomEnvironment`**（2026-10-18 换掉）。

    它是「摄影棚」：四周一圈白色柔光箱，**从各个方向**均匀照亮，
    也就是最常见的「无方向环境光」。后果不是「亮了点」，而是
    **接触阴影被从下面填平** —— 娃娃之间的缝隙照样收到光，
    于是没有任何影子，整池娃娃像贴在背景上。

    这正是「没有影子」那条投诉的根因之一（另一半是 `key.target` 没进场景，
    见上方主光那一段）。把 `shadowMap.enabled` 打开、把 mapSize 调到 2048
    都改变不了它：影子**画出来了**，只是被环境光洗掉了。

    ➜ 换成参考实现的 `buildEnvScene()`：一个**浅色**盒子 + **顶部一排自发光面板**
      （面板 `emissiveIntensity = 10`，所以能量几乎全在正上方）+ 三块弱的侧灯。
      环境光本身「从上往下」，缝隙里收不到 ⇒ 接触阴影留得住，金属爪子也仍有东西可反射。

    ⚠️ 盒子别改成深色（我一开始写了 `0x2a2730`）：参考实现是 `0xe8e4de`。
      深色盒子 + PMREM 之后，柜体白面会**整体发闷**，而影子并不会因此更明显 ——
      对比度不够是「主光 : 平光」的比例问题，不是绝对亮度。
  */
  const envRT = pmrem.fromScene(buildEnvScene(), 0.02)
  scene.environment = envRT.texture
  /*
    参考实现是 **0.65**。之前我们写 0.55 却「没有影子」，原因不在这个数，
    而在 `RoomEnvironment` 是全向的（见上）。换成有方向的环境之后，
    照抄参考实现的 0.65 —— 环境光在这里负责的是「玻璃和镀铬的反射」，
    往低压只会让柜子发脏，对影子没有帮助。
  */
  scene.environmentIntensity = 0.4

  const camera = new PerspectiveCamera(FOV, 1, 0.05, 40)
  camera.position.set(0, LOOK_Y, 4)

  /* ---------------- 机位 ---------------- */

  /** 取景距离：resize 算完 contain-fit 后存到这里，render 的「呼吸」微动要拿它当基准 */
  let cameraDist = 4
  /** 蹲到取物口时的距离（`debugCamera().dist` 在中奖镜头下读它，和上面同单位） */
  let doorDist = 0

  /**
   * 当前机位。
   *
   * `view` = 站在柜子前面（默认）；`door` = **蹲下去看取物口**（中奖那几秒）。
   *
   * ★ 家长 2026-10-17 定的是「只保留一个机位」，指的是**不要给玩家自由旋转**。
   *   中奖那一蹲不是第二个机位 —— 它是原版就有的一段演出（`goDoor()`），
   *   玩家不能自己切过去、也不能自己转，几秒后自己回来。
   */
  let camMode: 'view' | 'door' = 'view'
  /** 机位之间的缓动。`null` = 已经停住了。 */
  let camAnim: { p0: Vector3; t0: Vector3; p1: Vector3; t1: Vector3; k: number; dur: number } | null = null
  /** 蹲在取物口还剩多少秒（≤0 就缓动回默认机位） */
  let doorHold = 0
  /** 上一帧的 `winFlash` —— 用它抓 0 → 1 那个沿 */
  let prevFlash = 0
  /** 上一帧的时间（秒）—— 相机缓动要 dt，而 `render()` 只收到绝对时间 */
  let lastCamT = 0

  /** 缓动 / 摆位的临时向量（每帧都用，不在循环里 new） */
  const poseP = new Vector3()
  const poseT = new Vector3()
  const animP = new Vector3()
  const animT = new Vector3()
  /** 相机现在看着哪一点 —— 起手缓动时要用它当起点 */
  const curLook = new Vector3(0, LOOK_Y, 0)

  /* ---------------- 中奖演出：把奖品摆到取物口 ---------------- */

  /**
   * 这一局中奖的那只娃娃（`prizeGroups` 下标）。−1 = 没有。
   *
   * ★★ 为什么要**纯视觉**地摆过去，而不是让物理把它运到窗口：
   *   我们的取物通道在池底洞口正下方（右侧），取物口在机身正面**左下** ——
   *   两者之间没有通路，娃娃掉进通道就被 `recycle()` 放回池子了。
   *   于是「中奖」在孩子眼里是**什么都没发生**：爪子松手，娃娃不见了。
   *   蹲下去看取物口，看到的会是一个空黑洞。
   *
   *   ➜ 所以中奖那只在镜头蹲下时**从窗口探出来**，镜头回来时滑走 + 缩小
   *     （和原版 `takePrizes()` 一个意思）。
   *   ⚠️ 这里只改 three 的 `Group`，物理那边那只已经回池子了 ——
   *     不碰账本、不碰碰撞体、不碰探面，所以不可能影响输赢。
   */
  let winPrize = -1
  /** 最近一次被夹住的那只 —— 中奖那一刻 `held` 已经是 null 了，只能靠它记着 */
  let lastHeld = -1
  /** 上一帧的 `busy`：抓「新一局」的沿，用来清掉上一局的记忆 */
  let prevBusy = false
  /** 奖品从窗口「探出来」的程度 0~1 */
  let winShow = 0
  /** 奖品「被取走」的程度 0~1（往外滑 + 缩到 0） */
  let winGone = 0

  /**
   * 当前画幅的视线高度。`resize()` 按横竖屏切换（见 `LOOK_Y_WIDE`）。
   *
   * ★ 必须是**变量**：`viewPose()` 的默认参数、`placeCamera()`、`debugFrame()`
   *   和 `render()` 的呼吸都要读到**同一个**值 —— 写死 `LOOK_Y` 的话，
   *   横屏的实际画面和 `debugFrame()` 量的会差一截（那种「判据绿着、画面歪着」）。
   */
  let camLookY = LOOK_Y

  /**
   * 默认机位：绕 `(0, lookY, 0)` 按 `pol` 俯视 `dist` 远。
   *
   * ★★ 球坐标公式**只有这一份**：`placeCamera()`（静态位 / `debugFrame`）
   *   和 `render()`（带「呼吸」微动）都走它。写两份的话，`debugFrame` 量到的
   *   取景和玩家看到的迟早不是同一个 —— 那种「判据绿着，画面歪着」最难查。
   */
  function viewPose(dist: number, az = 0, pol = CAM_POL, lookY = camLookY): void {
    const sp = Math.sin(pol)
    const cp = Math.cos(pol)
    poseP.set(dist * sp * Math.sin(az), lookY + dist * cp, dist * sp * Math.cos(az))
    poseT.set(0, lookY, 0)
  }

  /**
   * 蹲下去看取物口 —— 参考实现的 `goDoor()`。
   *
   * ★★ 为什么不是「把默认机位拉近一点」：
   *   取物口在**机身正面下方**（`PICKUP.y = −0.52`），默认机位看的是池子
   *   （`LOOK_Y = 0.34`）—— 两者差 0.86 个世界单位，相当于整个玻璃柜的高度。
   *   光改距离只能把池子放大，取物口**永远在画面外**。
   *   必须换**目标点**：`poseT` 移到取物口，相机跟着降下去。
   *   （这就是之前「缩到 5%」和原版「完全不是一回事」的根因。）
   *
   * 距离按取物口的可视窗口重算（原版是 0.32 × 0.34）：
   * 宽、高各算一次「窗口占画面多少」需要多远，取更远的那个。
   * 这样换画布尺寸 / 横竖屏都不用回来调参数。
   *
   * ★★ 2026-10-18 的教训（改了三次才对，写下来免得再来一次）：
   *
   *   ① 原版那两行是 `d = max(0.32/(vt·aspect·hFrac), 0.34/(vt·visFrac))`。
   *      我一开始把 `hFrac`/`visFrac` 当成「可用区还要收窄 0.82」——
   *      分母变小 ⇒ 反而**更远**（2.79 → 2.20），走查直接变红。
   *      它们是「机身占画面的比例」，作用方向是让窗口**填得更满**（更近）。
   *
   *   ② 门槛 0.6（蹲位距离 < 默认机位的 60%）在窄屏上**结构上达不到**：
   *      390×844 下「窗口宽占画面」那一项永远赢（`0.494/(vt·aspect·H)`），
   *      把 H 提到 0.98 也只有 0.71。再往前推就会把圆环顶出画布左右。
   *
   *   ③ 根本原因：两边的「1 倍」不是同一个东西 ——
   *      默认机位 fit 的是**整台机器**，蹲位 fit 的是**窗口**。而窗口外径
   *      0.494 已经接近机身宽度 1.24 的一半（原版是 1.24 里的 0.32，只有 1/4）。
   *      ➜ 我们这台机器上「窗口 vs 整机」天然就只差 2.4 倍，不是原版的 3.9 倍。
   *
   *   ➜ 别再往 `H_FRAC`/`V_FRAC` 里加码：它们已经贴着 1 了（窗口几乎占满画布）。
   *     判据看的是**放大倍数**（走查 `mag`），实测 1.66×，门槛 1.5。
   */
  function doorPose(): void {
    const t = poseT.set(PICKUP.x + 0.08, PICKUP.y, 0.36)
    const vt = Math.tan(MathUtils.degToRad(FOV / 2))
    // 「窗口占画面」的比例（横向 / 纵向）。越接近 1 越近。见上面 ③，别再往上加。
    const H_FRAC = 0.95
    const V_FRAC = 0.94
    const d = Math.max(
      PICKUP_WINDOW.w / (vt * camera.aspect * H_FRAC),
      PICKUP_WINDOW.h / (vt * V_FRAC),
    )
    // 偏右一点、抬高一点再往前看 —— 纯正对会像一张贴图
    poseP.set(t.x + d * 0.1, t.y + d * 0.16, t.z + d * 0.98)
    doorDist = d
  }

  /** 起手一段机位缓动（原版 `animCam`：smoothstep，1.1 秒）。 */
  function animCamTo(mode: 'view' | 'door', dur = 1.1): void {
    if (mode === 'door') doorPose()
    else viewPose(cameraDist)
    camAnim = {
      p0: camera.position.clone(),
      t0: curLook.clone(),
      p1: poseP.clone(),
      t1: poseT.clone(),
      k: 0,
      dur,
    }
    camMode = mode
  }

  /* ---------------- 灯光：暖顶光 + 柜内冷白 ---------------- */
  /*
    光照按参考实现的量级重调过（2026-10-17）。

    ★ 之前环境光是 **1.5**，参考实现是 **0.55**。环境光不是「越亮越清楚」——
      它会把所有阴影**填平**，柜子就没有体积感了，看着发灰。
      加了阴影之后这一点尤其明显：环境光一高，影子淡到看不见。
  */
  scene.add(new HemisphereLight(0xfff5f0, 0xc8c0b8, 0.35))
  /*
    ★★ 四盏灯是**一组比例**，单独改任何一个都会把「投影光 : 平光」弄丢。
    当前生效（2026-10-19 实测校准，改前先看 `capture-claw.mjs` 的影子 A/B）：

        半球 0.35 · 主光 2.0（唯一投影）· 补光 0.9 · 柜内 Spot 1.5

    为什么不是照抄参考实现的 0.55 / 1.5 / 0.9 / 2.8：我们多了一层
    `scene.environment`（PMREM，见 `makeEnvScene`），那是一层**不投影的平光**，
    参考实现没有。照抄的绝对值会让平光总量偏大 ⇒ 影子被填平（实测玻璃区里
    关掉阴影只有 2.6% 的像素变亮）。现在这组数让「会投影的那盏」在总量里占大头。

    ⚠️ 2026-10-18 那轮曾把主光推到 2.6（当时 `key.target` 没进场景、影子全歪出画面，
      只能靠加亮补偿）。根因修掉后 2.6 会把柜顶烤成死白，所以停在 2.0。
  */
  const key = new DirectionalLight(0xfff8f2, 2.0)
  /*
    ★ 主光放**正上方**（参考实现是 0.05, 3.2, 0.35），不是斜前方。
    影子垂直落在娃娃正下方 ⇒ 看得出「一层层堆起来」；
    侧光会把影子拉成长条，堆叠关系反而糊。
  */
  key.position.set(0.05, 3.2, 0.35)
  /*
    ★★★ `key.target` **必须一起进场景**，否则整片阴影是歪的 —— 而且完全不报错。

    three 的 `LightShadow.getFrustum()` 会读 `light.target.matrixWorld` 来定
    阴影相机朝向（见 `three/src/lights/LightShadow.js`）。但 `Object3D` 的
    `matrixWorld` 只在**它在场景里**的时候才会被 `updateMatrixWorld()` 刷到 ——
    不在场景里就永远是默认的 `(0,0,0)` 且 `matrixWorld` 是单位阵。

    这里的光在 `y=3.2`，默认 target 是原点 ⇒ 光轴几乎垂直朝下，方向碰巧还行，
    所以**看着像没问题**；但一旦有人把光挪成斜的（参考实现是 `0.05, 3.2, 0.35`），
    阴影就整体歪到画面外，而灯光本身照得好好的 —— 症状是「灯是亮的，就是没有影子」。

    ⚠️ 参考实现写的是 `scene.add(sun, sun.target)`；我们少了第二个参数。
  */
  scene.add(key, key.target)

  /*
    只让主光投影。正交阴影相机要**刚好裹住柜子**：

    ★★ 2026-10-18：这里原来是 `±1.35 / ±1.7`（2.7 × 3.4 的范围），而柜子只有
       **1.24 × 1.1** —— 等于把 1024² 的贴图摊到 5 倍的面积上，一个 texel 覆盖
       2.6mm，娃娃（0.15 宽）只有 57 个 texel。后果不是「影子糊一点」，
       而是**娃娃之间根本没有可辨认的接触阴影**，整池娃娃看着像漂着。
       参考实现是 `±0.62 / ±0.55` + 2048²（texel 密度是我们的 **4.4 倍**）。

    ➜ 现在收紧到 `±0.8`（外框 + 一点余量）+ 2048² ⇒ texel 从 2.6mm 降到 0.8mm。
      **别再放大范围**：范围一大，同一张 map 摊得更薄，接触阴影立刻消失，
      而画面整体亮度几乎不变 —— 这种退化在截图上是「看不出哪里变了」。
    near / far 只包住柜子在光轴上的跨度（光在 y=3.2，柜顶 1.5、柜底 -1.0）。
  */
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  // 参考实现：`{ left: -0.62, right: 0.62, top: 0.55, bottom: -0.55, near: 1.6, far: 4 }`
  // 我们这里比它宽一圈（±0.8），因为爪子在 `x = ±0.5` 的轨道上跑，要连爪子一起罩住
  key.shadow.camera.near = 1.2
  key.shadow.camera.far = 5.2
  key.shadow.camera.left = -0.8
  key.shadow.camera.right = 0.8
  key.shadow.camera.top = 0.8
  key.shadow.camera.bottom = -0.8
  // bias 处理自阴影（acne）；normalBias 处理薄面（灯带 / 玻璃框）上的漏光
  key.shadow.bias = -0.0006
  // 0.012（参考实现的数）：texel 变细之后，normalBias 给大了会让影子**整体离开物体**
  key.shadow.normalBias = 0.003
  /*
    `radius = 4`（参考实现的数）。`PCFSoftShadowMap` 会**忽略**这个值，
    所以它是「以后换成 PCFShadowMap 时不用回来调」的预留 —— 我们目前用 Soft，看不到效果。
  */
  key.shadow.radius = 4
  /*
    ★★★ 这一行**不能删**，删了上面六个数字全部作废。

    three 的 `LightShadow` **不会**在渲染前更新阴影相机的投影矩阵 ——
    `OrthographicCamera` 只在构造时算一次（默认 `-5..5 / -5..5 / 0.5..500`）。
    所以只写 `camera.left = -0.8` 而不调这个函数，阴影贴图**仍然铺在 10×10 的范围上**：
    1024² ⇒ 一个 texel 覆盖 **9.8mm**，而娃娃只有 150mm 宽 = 15 个 texel
    ⇒ 娃娃之间**不可能有可辨认的接触阴影**，整池看着像漂着。
    （2026-10-18 就是靠这条查出来的：改了范围却量不出任何变化。）
    ➜ 改完范围必须紧接着调一次；`debugFrame().shadowTexel` 会把它暴露出来。
  */
  key.shadow.camera.updateProjectionMatrix()
  const fill = new DirectionalLight(0xffe8f0, 0.9)
  fill.position.set(-0.8, 2.6, 3.2)
  scene.add(fill)
  /*
    柜内顶灯 —— **SpotLight 不是 PointLight**。

    ★ PointLight 是全向的：它把娃娃堆正面照得很平。SpotLight 有 `distance` + `decay`，
      光落成一个**池子**，池边和娃娃缝隙自然暗下去。参考实现就是
      `SpotLight(0xfff5fa, 2.8, 2.2, 1.0, 0.8, 1.5)`，角度 1.0rad ≈ 57°、
      penumbra 0.8（池边是渐变不是硬圈）。

    ★★ 但**换成 SpotLight 只挪了一点点**：娃娃堆 p5 从 0.545 到 0.533。
      原因不是灯的形状，是**光比** —— 全场景只有主光投影，其余四盏
      （柜内灯 / 半球 / 环境 / 补光）都是**不投影的平光**：
      影子里的娃娃照样能收到约 70% 的光，影子当然看不见。
      ➜ 所以柜内灯从参考实现的 2.8 降到 **1.5**（其余三盏的当前值见主光上方那段），
        让「会投影的那盏」在总量里占大头。
      **别只盯着单盏灯的绝对值** —— 决定层次的是投影光 : 平光的比例。
  */
  const inner = new SpotLight(0xfff5fa, 1.5, 2.2, 1.0, 0.8, 1.5)
  inner.position.set(0, GLASS_H - 0.03, 0.3)
  // target 必须一起进场景，否则它的世界矩阵不更新，光会一直朝原点外的默认方向打
  scene.add(inner, inner.target)

  /* ============================ 机器（照搬原版） ============================ */

  /*
    整台机器来自 `scene/machine.ts` —— 那是参考实现 `models.ts` 的逐字搬运：
    亮面白机身 / 圆形取物口 / 检修门 / 控制台（摇杆 + 红按钮 + LCD）/ 脚轮 /
    铝合金立柱 / LED 灯带 / 三面玻璃（淡色 + 反射 + 污渍）/ 柜内横幅 /
    背板海报 / 深蓝灰地垫 / 亚克力围栏 / 灯箱 / 日光灯管 / 天车。

    ★ 以前这里是 600 行手搓的柜子。手搓的问题是「每个零件都差一点」：
      机身太方、没有控制台和脚轮、玻璃只有一层淡色、背板是一张纯粉海报。
      单独看每一条都不起眼，叠在一起就是「像娃娃机，但不是那一台」。
  */
  const machine = buildMachine(CLAW_THEMES[0])
  const root = machine.root
  scene.add(root)

  const { beam, carriage, cable, hub } = machine
  /**
   * 三个指头的**内层** Group（带方位角 + 开合角）。
   *
   * 物理层读它的 `matrixWorld` 去摆 kinematic 碰撞体 —— 所以「张开多少」
   * 只有 `applyProngs()` 一个事实源，物理那边不重算角度。
   */
  const prongInners = machine.prongs as unknown as Group[]

  /**
   * 爪子的开合。
   *
   * `close`：0 = 张开，1 = 合上（时间线给的）。
   * `spread`：`CLAW_PRONG_IDLE`（≈0.34）= **待命**姿势（张开的钩子），1 = 下爪时张到最大。
   * `holding`：手里有娃娃 —— 合到 0.86 就停，指头**夹在娃娃外面**。
   *
   * ⚠️ 为什么需要 `spread` 这个额外参数：`close` 在「待命」和「下爪」时**都是 0**，
   *    光看它分不出这两种状态。待命就张到最大会像个蜘蛛；下爪不张到最大又不像在下爪。
   *
   * ⚠️ 为什么需要 `holding`：夹着娃娃还合到底，指头会穿进娃娃身体里。
   *    原版是靠「抓力上限」自然卡住的（`setProngs(ANG_CLOSED, grip)`，娃娃顶住就合不动）。
   *    我们这里是 kinematic 直接摆角度，所以得显式留出那点缝。
   *
   * ⚠️ 这里**不能**再缩放 `inner`：碰撞体的位姿只取 `matrixWorld` 的平移和旋转，
   *    缩放不进 Rapier ⇒「看得见的指头缩了 6%，摸得到的没缩」，合爪瞬间多一条缝。
   */
  const applyProngs = (close: number, spread: number, holding: boolean) => {
    const cap = holding ? 0.86 : 1
    const k = MathUtils.clamp(close, 0, cap)
    const open = ANG_OPEN * MathUtils.clamp(spread, 0, 1)
    for (const inner of prongInners) {
      inner.rotation.z = ANG_CLOSED + (open - ANG_CLOSED) * (1 - k)
    }
  }

  /* ============================ 商场（地板 + 后墙） ============================ */

  /*
    ⚠️ 只画地板和墙，**不画第二台机器**：家长 2026-10-16 明确说「只用显示一台」。
    ⚠️ 竖屏时柜子横向铺满（phone 左右各只剩几像素），房间**整个藏起来**
       （`resize` 末尾按「两侧空白」开关 `room.visible`），一分钱都不花。
  */
  const room = buildRoom()
  scene.add(room)
  room.visible = false

  /* ============================ 娃娃 ============================ */

  const prizeGroups: Group[] = []
  /** 每只娃娃的**种类**（交给物理建碰撞体 —— 见 `clawPhysics` 的 `types`）。 */
  const prizeTypes: PrizeType[] = []
  /** 每只娃娃的着色器 uniform（软体变形：压扁 / 爪子按出的凹坑 / 陷进池底）。 */
  const prizeModels: PlushModel[] = []
  const prizeRest: { x: number; z: number; y: number }[] = []
  {
    for (const p of initialPrizeLayout()) {
      const model = buildPrize(PRIZE_TYPES[p.type], p.color, p.seed)
      const g = model.group
      g.position.set(p.x, p.y, p.z)
      // ★ 尺寸差异（见 `initialPrizeLayout` 的 `scale`）：物理读的就是这个 `scale`
      g.scale.setScalar(p.scale)
      /*
        ★ `baseScale` 是**降级路径**（物理起不来时中奖动画）读的那份基准。
        以前只有读、没有写（`?? 1` 兜底），所以那只娃娃会在中奖瞬间
        **跳回 1.0** —— 现在每只尺寸都不一样，不写就会看到「大小突变」。
      */
      g.userData.baseScale = p.scale
      root.add(g)
      prizeGroups.push(g)
      prizeTypes.push(PRIZE_TYPES[p.type])
      prizeModels.push(model)
      prizeRest.push({ x: p.x, z: p.z, y: p.y })
    }
  }

  /* ---------------- 阴影：等所有东西都进 root 之后再统一开 ----------------
     ⚠️ 必须放在**娃娃之后** —— 娃娃也是 `root` 的子节点，先开就会漏掉它们，
     而「娃娃没有影子」正是「像贴纸」那条观感的根。

     ★★ 参考实现的取舍和这里**相反**：它把整台机器 `castShadow = false`，
       只让天车 / 爪子 / 娃娃投影。因为机身是白的、又是自己的光源，
       机身投影只会把柜内压暗；真正需要影子的是「娃娃之间」和「爪子压在娃娃上」。
       ➜ 这里照抄它的取舍。
  */
  {
    root.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      m.castShadow = false
      m.receiveShadow = true
    })
    // 只有爪子和娃娃投影
    for (const o of [machine.beam, machine.carriage, machine.hub, machine.cable, ...machine.prongs]) {
      o.traverse((c) => {
        const m = c as Mesh
        if (m.isMesh) m.castShadow = true
      })
    }
    for (const g of prizeGroups) {
      g.traverse((c) => {
        const m = c as Mesh
        if (!m.isMesh) return
        const tr = (m.material as MeshStandardMaterial).transparent
        m.castShadow = !tr
        m.receiveShadow = !tr
      })
    }
  }


  /* ============================ 取景（contain） ============================ */

  let dpr = 1

  /** 柜子 8 个角（只算一次）—— 走查用，整机允许被裁。 */
  const BOX_CORNERS: [number, number, number][] = []
  for (const x of [BOX.minX, BOX.maxX]) {
    for (const y of [BOX.minY, BOX.maxY]) {
      for (const z of [BOX.minZ, BOX.maxZ]) BOX_CORNERS.push([x, y, z])
    }
  }
  /**
   * 取景框**正面**的 4 个角。
   *
   * ★★ 2026-10-18：它**不再参与取景距离的计算**（距离已改为照抄参考实现
   *   `fitDist()` 的「拟合玻璃」口径，见 `resize()`）。
   *   保留它只为一件事：`debugFrame().frame` —— 走查脚本用它断言
   *   「灯箱露一条、机身裁掉大半」这种**构图**，这是和参考实现对齐的另一半证据。
   *
   * ⚠️ 如果以后想把它重新接进取景，先读 `resize()` 里那段注释：
   *   用 `FRAME` 做 contain 时，**宽度永远是约束方向**，改高度毫无效果。
   */
  const FRAME_CORNERS: [number, number, number][] = []
  for (const x of [FRAME.minX, FRAME.maxX]) {
    for (const y of [FRAME.minY, FRAME.maxY]) FRAME_CORNERS.push([x, y, FRAME.maxZ])
  }
  /** 玻璃区 8 个角 —— 走查断言「柜子内部完整可见」用它。 */
  const GLASS_CORNERS: [number, number, number][] = []
  for (const x of [-HX, HX]) {
    for (const y of [0, GLASS_H]) {
      for (const z of [-HZ, HZ]) GLASS_CORNERS.push([x, y, z])
    }
  }

  /**
   * 灯箱上沿（世界高度）。
   *
   * 取自 `machine.ts` 的几何：灯箱是 `top + 0.16 ± 0.16` ⇒ 顶在 `top + 0.32`，
   * 上面再留 0.02 的余量。**别在这里写死 1.52** —— `CAB.top` 改了它要跟着走。
   */
  const SIGN_TOP_Y = CAB.top + 0.34

  /**
   * **横屏**的纵向取景边界：玻璃底 → 灯箱顶。
   *
   * ★★ 2026-10-19：横屏原来只要求「玻璃完整」，于是玻璃把画面高度占满，
   *   灯箱（在玻璃**上面**）整个被顶出画面 —— 实测 `FRAME.top = −38.7px`。
   *   而把视线抬到 0.52 也没用：那个循环会继续把玻璃钉在画面里，
   *   抬视线只是让相机更近、裁得更狠（实测 `FRAME.top` 反而变 −53）。
   *
   * ➜ 直接改**边界**：横屏要求 [玻璃底, 灯箱顶] 这一段完整可见。
   *   机身（底座）允许被裁 —— 原版横屏也是裁的。
   *   代价是相机要退一点、柜子小一点；换来的是「整台机器是完整的」。
   */
  const VERT_CORNERS_WIDE: [number, number, number][] = []
  for (const x of [-HX, HX]) {
    for (const y of [0, SIGN_TOP_Y]) {
      for (const z of [-HZ, HZ]) VERT_CORNERS_WIDE.push([x, y, z])
    }
  }

  const _p = new Vector3()

  /**
   * 相机摆位：**绕 `LOOK_Y` 按 `CAM_POL` 俯视**，不是平视。
   *
   * 球坐标：水平距离 `dist·sin(pol)`、高度 `LOOK_Y + dist·cos(pol)`。
   * 这样「俯角」是相机自己的属性，跟距离无关 —— 换个画布尺寸不会突然变平视。
   */
  function placeCamera(dist: number): void {
    viewPose(dist)
    camera.position.copy(poseP)
    camera.lookAt(poseT)
    camera.updateProjectionMatrix()
    // ★ `project()` 读的是 `matrixWorldInverse`，而它由 `updateMatrixWorld()` 更新。
    //   不调的话这里算出来的角点坐标是**上一帧**相机下的 —— 迭代会收敛到错的地方。
    camera.updateMatrixWorld()
  }

  /** 把一组世界坐标角点投影成画布矩形。 */
  function projectRect(corners: [number, number, number][], w: number, h: number) {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const [x, y, z] of corners) {
      const p = _p.set(x, y, z).project(camera)
      const sx = ((p.x + 1) / 2) * w
      const sy = ((1 - p.y) / 2) * h
      left = Math.min(left, sx)
      right = Math.max(right, sx)
      top = Math.min(top, sy)
      bottom = Math.max(bottom, sy)
    }
    return { left, top, right, bottom }
  }

  /**
   * 后处理链。`null` = 不启用（低端机 / WebGL 起不来），直接 `renderer.render`。
   *
   * ⚠️ 必须是 `let` 且在 `resize` 之前声明 —— `resize` 里要按新尺寸调
   * `composer.setSize`，而 composer 本身要在拿到尺寸后才建。
   */
  let composer: EffectComposer | null = null

  function resize(): void {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    // ★ DPR 封顶 2：手机上 DPR=3 ⇒ 9 倍填充率，动画直接掉帧
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    // ★ 第三个参数必须是 false，否则 three 会写行内 style，和宿主的响应式列打架
    renderer.setSize(w, h, false)
    // composer 有自己的 render target，尺寸要单独跟
    composer?.setPixelRatio(dpr)
    composer?.setSize(w, h)

    const aspect = w / h
    camera.aspect = aspect

    /*
      取景距离 —— **照抄参考实现的 `fitDist()` 的形状**。

      ★★★ 2026-10-18 的重要更正：**取景的约束方向是宽度，不是高度。**

      之前一直用「整个 `FRAME` 框 contain 进画面」。`FRAME` 宽 `1.26`、高 `1.64`，
      而手机是窄屏（390×844，`aspect ≈ 0.46`）⇒
        · 宽度需要 `1.26 / 2 / (vt·aspect) ≈ 3.63`
        · 高度需要 `1.64 / 2 / vt      ≈ 1.98`
      **宽度那一条永远赢**，所以改 `FRAME.minY` 对镜头远近**一点影响都没有** ——
      这正是「改了框高、实测玻璃占比还从 0.539 没动」的原因。

      参考实现竖屏拟合的是**固定的世界尺寸**（不是包围盒）：
        · 宽 `0.62`  —— 玻璃只有 `1.16` 宽，所以它**允许被裁掉左右各 0.27**
        · 高 `0.95`  —— 玻璃高 `1.2`，上下各让 0.12 出去
      取两者中更远的那个。宽屏则拟合 `0.72 × 1.22`（带 `hFrac / visFrac`，
      因为宽屏时两侧有操作列、上下有顶栏，画面被 UI 吃掉了一部分）。

      ➜ 这里直接量**真实的玻璃投影**而不是抄那个常数：
        「把 `GLASS_CORNERS` 里最宽的那一对角点装进 `FIT_W × FIT_H` 的世界尺寸」，
        等价于 `fitDist()`，但以后改柜子尺寸不用回来重算常数。
    */
    const vt = Math.tan(MathUtils.degToRad(FOV / 2))
    const wide = aspect > 1.05
    /*
      ★ 横屏抬高视线（见 `LOOK_Y_WIDE`）。必须在**第一次 `placeCamera()` 之前**设，
        否则第一轮投影用的是竖屏视线，后面几个迭代循环会围着错的框收敛。
    */
    camLookY = wide ? LOOK_Y_WIDE : LOOK_Y
    const fitW = wide ? 0.72 / HFRAC_WIDE : 0.62
    const fitH = wide ? 1.22 / VISFRAC_WIDE : 0.95
    let dist = Math.max(fitH / 2 / vt, fitW / 2 / (vt * aspect))
    placeCamera(dist)

    /*
      ★ 只在 `fitDist()` 之上再做一件事：**别把整个画面填满到看不见柜体轮廓**。
      参考实现靠 `setViewOffset` 把可视窗口压到 LED 板与操作台之间；
      我们的取景框是和画布等大的，所以用「玻璃的横向投影别超过画面 92%」当上限。
      这个值只影响横屏（窄屏那边是高度在约束），但它保证横屏不会把柜子怼到贴边。
    */
    const CLOSE_MAX_W = 0.92
    for (let i = 0; i < 8; i++) {
      placeCamera(dist)
      const g = projectRect(GLASS_CORNERS, w, h)
      const gw = (g.right - g.left) / w
      if (DEBUG_FIT) console.log(`[fit] close i=${i} dist=${dist.toFixed(3)} gw=${gw.toFixed(3)}`)
      if (gw <= CLOSE_MAX_W) break
      // 投影宽度 ∝ 1/dist，一次乘到位
      dist *= gw / CLOSE_MAX_W
    }
    placeCamera(dist)
    cameraDist = dist // 存给 render 的「呼吸」微动当基准
    if (DEBUG_FIT) {
      const g = projectRect(GLASS_CORNERS, w, h)
      console.log(`[fit] init w=${w} h=${h} aspect=${aspect.toFixed(3)} dist=${dist.toFixed(3)} gw=${((g.right - g.left) / w).toFixed(3)} top=${g.top.toFixed(1)} bot=${g.bottom.toFixed(1)}`)
    }

    /*
      ★★ 上界：玻璃**上下不能出画** —— 这是「近」往上走到哪里的边界。

      镜头再近，玻璃顶（灯箱下沿）和池底都必须留在画面里：
      顶被裁掉 ⇒ 看不到吊杆和爪子起始位置；底被裁掉 ⇒ 看不到娃娃堆和爪子下到底。

      ⚠️ 2026-10-18 第一版这里写成了「超出去的**像素**按比例退回」，
      横屏实测 `top = −17.4`（玻璃顶跑出画布 17px）没被修 ——
      因为它只判了**超出多少**，没判**缺多少**。
      ➜ 现在改成**迭代**：只要任一方向出界就把 `dist` 按比例拉远，最多 8 轮。
        这种「按比例乘」对透视投影是单调收敛的（`dist` 和投影尺寸近似成反比）。
    */
    /*
      ★ 余量 2px（不是 0.004×h）：实测 tablet-landscape 收敛到 `top = -1.9`，
        也就是「刚好贴边再差一点点」。判据那边留 0.5px 容差，这里必须比它更宽，
        否则两边在同一条边界上互相打架：场景认为「够了」、走查认为「越界 1.9px」。
    */
    const SLACK_PX = 2
    /*
      ★ 横屏量的是 **[玻璃底, 灯箱顶]**（`VERT_CORNERS_WIDE`），竖屏仍是玻璃本身。
        横屏若只量玻璃，玻璃会把画面高度占满、灯箱被顶出去（见 `VERT_CORNERS_WIDE`）。
    */
    const vertCorners = wide ? VERT_CORNERS_WIDE : GLASS_CORNERS
    for (let i = 0; i < 8; i++) {
      placeCamera(dist)
      const g = projectRect(vertCorners, w, h)
      const needTop = (-g.top + SLACK_PX) / h // > 0 = 顶部出界（含余量）
      const needBot = (g.bottom - h + SLACK_PX) / h // > 0 = 底部出界（含余量）
      const need = Math.max(needTop, needBot)
      if (need <= 0) break
      /*
        出界比例 `need` 是「画面上还要再留这么多」，换算成距离：
        把投影高度再缩到 `1 / (1 + need)`，距离就乘 `1 + need`。
        （多留 15% 冗余，避免在两帧之间来回抖。）
      */
      dist *= 1 + need * 1.15
    }
    placeCamera(dist)
    cameraDist = dist
    if (DEBUG_FIT) {
      const g = projectRect(vertCorners, w, h)
      console.log(`[fit] vert  dist=${dist.toFixed(3)} top=${g.top.toFixed(1)} bot=${g.bottom.toFixed(1)} wide=${wide}`)
    }

    /*
      ★★ 「视角够近」的**下界兜底**：玻璃长度的投影必须占画面一定比例。

      为什么它不是只写在走查脚本里：靠肉眼看截图分不出「玻璃占 55%」和「占 65%」，
      而用户说的「游戏开始的视角要近一点」正是这条。所以由场景自己量、自己收。
      量法用的是**同一套投影**（`GLASS_CORNERS`），所以它和 `debugFrame()`
      报的 `glassFillY / glassFillX` 不可能走散。

      ⚠️ 判据取 `max(高占比, 宽占比)`，**不是只看高**：
      竖屏时宽度才是约束（玻璃被允许裁掉左右），此时高度占比会接近 1；
      横屏时反过来。只看一个方向的话，另一个方向上「整台机器缩在中间」测不出来 ——
      这正是 10-18 之前一直误判的原因。

      ★★★ 但它**必须让位给上面的「上下不出画」**。
      2026-10-18 横屏实测：上界把 dist 从 1.668 拉到约 1.95（玻璃刚好装进 228px 的画布），
      紧接着这一段又按 `fill / 0.86` 把它拉回 2.157 —— 两段**互相拆台**，
      最终 `top = −16.8`（玻璃顶被裁），而 `glassFill` 看着是 0.892「合格」。
      ➜ 所以这里只在「拉近之后上下仍然完整」时才动手；否则保留上界的结果，
        并把实际 fill 报给走查（`glassFill` 会低于阈值 ⟹ **判据红，而不是画面红**）。

      ⚠️ 横屏的根因是**画布太扁**：844×390 的视口里舞台只有 384×228，
        玻璃高 1.2 + 俯视 17° 投影下来撑不进 228px。这不是取景参数能解决的，
        是「横屏要不要把玻璃完整装进画面」的产品取舍。当前选择：装完整。
    */
    {
      const g0 = projectRect(GLASS_CORNERS, w, h)
      const fill0 = Math.max((g0.bottom - g0.top) / h, (g0.right - g0.left) / w)
      /*
        ★★ 2026-10-19：这一整段**只在竖屏跑**。

        横屏的承诺变了：从「玻璃占满画面」改成「**整台机器完整**（灯箱顶不裁）」
        —— 见 `VERT_CORNERS_WIDE`。横屏既然要装下 [玻璃底, 灯箱顶]，
        玻璃就注定只能占约 60%，`fill0 < 0.74` 永远成立；
        再按 `fill0/want` 把相机往前推，`stillInside` 一定会否掉（灯箱会出画），
        所以这段在横屏下是**纯空转**：白算一轮投影，还让人以为它在起作用。

        ➜ 横屏的「够不够近」改由走查量**整机的纵向占比**（`capture-claw.mjs`），
          判据和承诺在同一个口径上。
      */
      if (!wide && fill0 < GLASS_MIN_FILL) {
        const trial = dist * (fill0 / GLASS_MIN_FILL)
        placeCamera(trial)
        let g1 = projectRect(vertCorners, w, h)
        let accepted = g1.top >= -0.5 && g1.bottom <= h + 0.5
        /*
          ★★ 2026-10-19：顶部被裁时**别直接否掉，先抬视线**。

          实测（tablet 834×1112，舞台 648×822，aspect 0.788）：
            拉近到 `trial = 2.147` 时玻璃是 `top = −52.9 / bottom = 645.8`
            —— 高度只占 85%、底下还空着 176px，**完全装得下**，
            只是**位置偏上**（`LOOK_Y = 0.34` 是照手机那种瘦长画布定的）。
            原来这里一看 `top < -0.5` 就放弃，于是相机退回 3.692，
            画面变成一张**远距离全柜照**（整台机器带 PRIZE OUT 底座）——
            正是走查里「又退回全柜了」那条要抓的东西。

          ➜ 现在按「顶部差多少」把视线抬起来（画面整体下移），
            抬完再验一次：**上下都进得去**才接受这个更近的距离。
            手机（aspect 0.66）本来就不裁顶，这段是 no-op，构图一点不变。
        */
        if (!accepted && g1.top < -0.5) {
          const pxPerUnit = (g1.bottom - g1.top) / GLASS_H
          const saved = camLookY
          camLookY = saved + (-g1.top + 1) / Math.max(1e-3, pxPerUnit)
          placeCamera(trial)
          g1 = projectRect(vertCorners, w, h)
          accepted = g1.top >= -0.5 && g1.bottom <= h + 0.5
          // 抬了还是装不下（比如画布太扁）⇒ 视线退回原值，距离也保持原来的
          if (!accepted) camLookY = saved
        }
        if (accepted) {
          dist = trial
          cameraDist = dist
        }
        if (DEBUG_FIT) {
          console.log(`[fit] fill  fill0=${fill0.toFixed(3)} trial=${trial.toFixed(3)} g1=${g1.top.toFixed(1)}..${g1.bottom.toFixed(1)} h=${h} accepted=${accepted} lookY=${camLookY.toFixed(3)} → dist=${dist.toFixed(3)}`)
        }
      }
    }

    /*
      商场房间开不开：看**柜身两侧在画布上还剩多少像素**。

      ★★ 一开始想用公式估（`dist * tan(fov/2) * aspect > HX + 0.14`），**估错了**：
        那个式子算的是「目标平面（z=0）」上的可视半宽，而取景框的约束角点在
        `z = +0.55`（离相机更近），同一条光线在那儿只有 71% 的宽度。
        结果 phone 档（左右实际只剩 **7px**）被判成「有地方」，房间白开着。

      ➜ 所以直接量：把 `BOX_CORNERS` 投出来，和 `debugFrame()` / 走查脚本
        **用同一套投影**。这样「判据量到的空白」和「开关依据的空白」不可能走散 ——
        同一个事实存两份就一定会走散，这条在这台机器上已经踩过太多次。
    */
    const cb = projectRect(BOX_CORNERS, w, h)
    room.visible = Math.min(cb.left, w - cb.right) > 24
  }

  /*
    后处理：**暗角 + 胶片颗粒**，和参考实现同一套（它也是 `RenderPass → OutputPass → 颗粒`）。

    ★★ 这里踩过一个坑，别再犯：一开始加的是 `UnrealBloomPass`（辉光），
      实测**整个画面过曝成一片白**，柜子只剩一个幽灵轮廓。
      原因是 bloom 跑在**线性 HDR** 空间（色调映射在 `OutputPass` 才做），
      而白柜子在线性空间本来就 > 1 —— 阈值 0.86 把整块柜体都算成「过曝」，
      于是每一处都在晕开，叠起来就是全白。
      **参考实现根本没用 bloom**：它的电影感来自暗角 + 颗粒。
      ➜ 想让灯带发光，该调的是 `emissiveIntensity`，不是加 bloom。

    ⚠️ 走 composer 就**必须自己开 MSAA**：`WebGLRenderer({ antialias: true })`
      只作用于默认帧缓冲；渲染到 render target 时它不生效，
      柜子的立柱和灯带边缘会出锯齿。`samples: 2` 在手机上够用且便宜。
    ⚠️ `OutputPass` 负责色调映射 + sRGB 转换，**必须在颗粒之前** ——
      颗粒要在显示空间里叠（线性空间里叠噪点会偏色）。
    ⚠️ 按 CPU 核数挡一道：4 核及以下直接退回 `renderer.render`，
      少一个全屏 pass 和一个多采样 RT。
  */
  let grain: ShaderPass | null = null
  {
    const cores = navigator.hardwareConcurrency ?? 8
    if (cores > 4) {
      const w = Math.max(1, container.clientWidth)
      const h = Math.max(1, container.clientHeight)
      const d = Math.min(window.devicePixelRatio || 1, 2)
      const rt = new WebGLRenderTarget(w * d, h * d, { type: HalfFloatType, samples: 2 })
      const c = new EffectComposer(renderer, rt)
      c.addPass(new RenderPass(scene, camera))
      c.addPass(new OutputPass())
      grain = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uT: { value: 0 },
          // 0.018：看得出是「照片」而不是「塑料模型」，又不至于像电视雪花
          uAmt: { value: 0.018 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse;
          uniform float uT;
          uniform float uAmt;
          varying vec2 vUv;
          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233)) + uT) * 43758.5453);
          }
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            // 暗角：越靠边越暗（0.30 是强度，别调太大，孩子会以为屏幕脏了）
            vec2 q = vUv - 0.5;
            c.rgb *= 1.0 - dot(q, q) * 0.30;
            c.rgb += (hash(gl_FragCoord.xy) - 0.5) * uAmt;
            gl_FragColor = vec4(c.rgb, 1.0);
          }
        `,
      })
      c.addPass(grain)
      composer = c
    }
  }

  resize()
  const ro = new ResizeObserver(() => resize())
  ro.observe(container)

  /* ============================ 物理 ============================ */

  /**
   * Rapier3D 那一层。`null` = 还没加载好 / 加载失败 / 已经 dispose。
   *
   * ★ 它**只演不算**：输赢在投币那一刻由 `settleClawRound()` 定死，
   *   物理只决定娃娃怎么堆、怎么被推开、松手后怎么掉。见 `clawPhysics.ts` 头注释。
   *
   * ★ 动态 import：Rapier 是 gzip 755 KB 的单独 chunk。它没到之前，
   *   下面那条「手写摆放 + 插值回位」的老路照常跑 —— 场景**不等它**。
   */
  let phys: ClawPhysics | null = null
  /** 走查脚本要能区分「没加载好」和「加载失败了」 */
  let physState: 'loading' | 'ready' | 'failed' | 'off' = 'off'
  let physError = ''
  /** 上一帧的 `t`（秒）—— `render()` 只收到绝对时间，dt 要自己算 */
  let lastPhysT = 0
  let disposed = false

  function startPhysics(): void {
    physState = 'loading'
    void createClawPhysics({
      cabinet: { hx: HX, hz: HZ, glassH: GLASS_H, hole: HOLE },
      prizes: prizeGroups,
      types: prizeTypes,
      hub,
      prongs: prongInners,
    })
      .then((p) => {
        // 加载期间页面可能已经切走了 —— 那样必须立刻回收，不然漏一整个物理世界
        if (disposed) {
          p.dispose()
          return
        }
        phys = p
        physState = 'ready'
      })
      .catch((e: unknown) => {
        physState = 'failed'
        physError = e instanceof Error ? e.message : String(e)
        // 降级，不报错弹窗：孩子不该看到「物理引擎加载失败」
        console.warn('[claw] 物理没起来，退回静态摆放：', physError)
      })
  }

  // 不 await —— 场景先画出来，物理到了再接管（`render()` 里按 `phys` 分支）
  startPhysics()

  /* ============================ 渲染 ============================ */

  const tmp = new Vector3()

  /** 最后一帧收到的视觉状态（`debugVisual` 用）。 */
  let lastVisual: ClawVisual | null = null
  /** 最后一帧的时间戳 —— `debugForceShadowFrame()` 要用它「重画同一个时刻」。 */
  let lastT = 0
  /**
   * 「这一次 render 强制开/关阴影」—— **只给 `debugForceShadowFrame()` 用**。
   * 平时是 null；非 null 时代替 `shadowMap.enabled`，render 完就恢复。
   */
  let shadowAB: boolean | null = null
  /** 上一个「强制相位」**实际**用的开关值（`render()` 真跑完才写） */
  let usedShadow = true

  function render(t: number, v: ClawVisual, reducedMotion: boolean): void {
    lastVisual = v
    lastT = t
    /*
      ★★ 开关必须在**交给 `drawFrame()` 之前**设好，不能在 `drawFrame` 里面设。

      踩了两次：
        · 在 `render()` 里设、`finally` 里恢复 —— 但 `renderShadowAB()` 调的就是
          `render()`，于是强制相位刚设好就被自己恢复掉了（实测 off 相位
          读回来还是 `true`，两张图一模一样，差 −0.02）；
        · 在 `drawFrame` 的 `try/finally` 里设 —— 那行 `if (shadowAB …)` 离真正
          `renderer.render()` 隔着几十行，中间任何提前 return 都会让开关停住。
      ➜ 现在：`render()` 只负责「按相位设开关 → 画 → 记下实际值」，恢复由
        `renderShadowAB()` 自己做，路径最短。
    */
    if (shadowAB !== null) renderer.shadowMap.enabled = shadowAB
    drawFrame(t, v, reducedMotion)
    usedShadow = renderer.shadowMap.enabled
  }

  function drawFrame(t: number, v: ClawVisual, reducedMotion: boolean): void {
    // ---- 天车 / 缆绳 / 爪子 ----
    beam.position.z = v.clawZ
    carriage.position.set(v.clawX, 0, v.clawZ)
    hub.position.set(v.clawX, v.hubY, v.clawZ)
    applyProngs(v.close, v.spread, v.held !== null)

    // 缆绳从小车底面拉到 hub 顶面
    const top = tmp.set(v.clawX, RAIL_Y - 0.02, v.clawZ)
    const dx = v.clawX - top.x
    const dy = v.hubY + 0.03 - top.y
    const dz = v.clawZ - top.z
    const len = Math.max(0.001, Math.hypot(dx, dy, dz))
    cable.position.copy(top)
    cable.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), new Vector3(dx, dy, dz).normalize())
    cable.scale.set(1, len, 1)

    // ---- 娃娃 ----
    if (phys) {
      /*
        ★ 物理接管之前必须先把 three 的矩阵刷出来：`clawPhysics` 读的是
          `prongInners[i].matrixWorld`（指头的世界位姿），而 `matrixWorld`
          只在 `updateMatrixWorld()` 里更新。不调的话它拿到的是**上一帧**
          的指头位置 —— 合爪时会看到碰撞体比爪子慢半拍。
      */
      hub.updateMatrixWorld(true)
      const dt = lastPhysT ? Math.min(0.1, t - lastPhysT) : 1 / 60
      lastPhysT = t
      phys.step(dt, { clawX: v.clawX, clawZ: v.clawZ, hubY: v.hubY, close: v.close, held: v.held })
    } else {
      // 降级路径：被夹住的那只跟着爪子，其余插值回原位
      for (let i = 0; i < prizeGroups.length; i++) {
        const g = prizeGroups[i]
        if (i === v.held) {
          g.position.set(v.clawX, v.hubY - 0.16, v.clawZ)
          g.rotation.z = Math.sin(t * 6) * 0.12 // 被提着晃
        } else if (g.visible) {
          const r = prizeRest[i]
          g.position.x += (r.x - g.position.x) * 0.12
          g.position.y += (r.y - g.position.y) * 0.12
          g.position.z += (r.z - g.position.z) * 0.12
          g.rotation.z *= 0.9
        }
      }
    }

    /*
      ---- 软体手感：撞击压扁 + 回弹 ----

      ★★ 2026-10-19 从「缩放 Group」改成**着色器里的顶点变形**（照搬原版）：
        缩放 Group 会把碰撞体也一起缩（视觉和物理对不上），而且挤压方向永远是
        世界 Y。原版是在顶点着色器里沿 `uSquash.xyz` 挤、垂直方向鼓出来，
        碰撞体一动不动 —— 纯视觉，探面 / 输赢都读不到它。

      `uCenter` / `uFloorY` 管另一件事：娃娃**陷进池底**时把下半截压扁、
        往外挤一点（像真的坐在垫子上），不然堆底那几只像插在板子里。
    */
    for (let i = 0; i < prizeGroups.length; i++) {
      const u = prizeModels[i]?.u
      if (!u) continue
      const g = prizeGroups[i]
      u.uSquash.value.set(0, 1, 0, phys ? phys.squashOf(i) : 0)
      u.uCenter.value.copy(g.position)
      u.uFloorY.value = 0
    }

    /* ---- 中奖演出：奖品从取物口探出来（纯视觉，见 `winPrize` 的注释） ---- */

    const camDt = lastCamT ? Math.min(0.1, t - lastCamT) : 1 / 60
    lastCamT = t

    /** `winFlash` 的**沿**：中奖后它会在 1 上停 1.5 秒，按电平判会每帧重新起手 */
    const winEdge = v.winFlash > 0 && prevFlash === 0

    // 新一局开始 → 忘掉上一局夹的是哪只（否则第二局没中奖也会摆一只出来）
    if (v.busy && !prevBusy) lastHeld = -1
    prevBusy = v.busy
    if (v.held !== null) lastHeld = v.held

    /*
      中奖 → **蹲下去看取物口**（原版 `goDoor()`）。

      ★ 触发用 `winFlash` 的**沿**（`winEdge`），不是电平：中奖后它会在 1 上停
        1.5 秒，按电平判会每帧重新起手，相机永远走不完那 1.1 秒的缓动。
      ★ 蹲多久是**场景自己**的事（`DOOR_HOLD`），不是宿主那个 1.5 秒 ——
        原版是 3.5 秒，够看清楚窗口里的奖品。
      ★ `reducedMotion` 下整段跳过：相机停在 resize 算好的静态位。
      ★ 顺序要紧：这一段必须在下面「奖品探出来」**之前**跑 ——
        奖品那一块要读本帧刚设好的 `doorHold` / `camMode`，晚一帧就会
        「窗口里还没东西，镜头已经开始往回走了」。
    */
    if (!reducedMotion) {
      if (winEdge) {
        doorHold = DOOR_HOLD
        animCamTo('door')
      }
      prevFlash = v.winFlash
      /*
        一开新的一局就立刻回来 —— 否则孩子按了下爪，镜头还在取物口那边
        （要等 3.5 秒才转回来，那几秒爪子已经在池子里动了，完全看不到）。

        ⚠️ 必须**真的调** `animCamTo('view')`，不能只把 `doorHold` 清 0：
           下面那段 `if (doorHold > 0)` 一旦不成立就再也不会调它，镜头
           会**永远停在取物口**（下次中奖再 `animCamTo('door')` 也是原地不动）。
           `camMode === 'door'` 这个条件同时挡住了重复触发（第一帧就切走了）。
      */
      if (v.busy && camMode === 'door') {
        doorHold = 0
        animCamTo('view')
      }
      if (doorHold > 0) {
        doorHold -= camDt
        if (doorHold <= 0) animCamTo('view')
      }
    }

    if (winEdge) {
      winPrize = lastHeld
      winShow = 0
      winGone = 0
    }
    /*
      探出来的时机跟着**镜头**走（`camAnim.k`）：镜头还在半路上就把奖品摆出来，
      会在画面左下角看到一个玩具凭空冒出来 —— 那是「动画没对齐」的典型样子。

      ★★ 「镜头离窗口多近」= `arrive`，**回来的时候也要按它褪**：
        原来写的是 `camMode === 'door' ? k : 0`，一往回走就变成 0，于是
        镜头还贴在窗口前（缓动前 0.3 秒几乎没动）娃娃就**凭空消失**了。
        实测截图：蹲镜最后那段是一圈**空窗口**，看着像「赢了但什么都没给」。
        现在回来时 `arrive = 1 - k`，娃娃随着镜头拉远一起缩小。
    */
    const arrive = camMode === 'door' ? (camAnim ? camAnim.k : 1) : camAnim ? 1 - camAnim.k : 0
    const showTarget = arrive
    winShow += (showTarget - winShow) * Math.min(1, camDt / 0.22)
    // 镜头已经离开窗口（`arrive < 0.15`，娃娃这时基本看不见了）才真的「取走」。
    // 在窗口前就收 = 凭空消失；等镜头走了再收，玩家只会觉得「娃娃被拿走了」。
    if (winPrize >= 0 && doorHold <= 0 && arrive < 0.15) winGone = Math.min(1, winGone + camDt / 0.4)
    if (winPrize >= 0 && winShow > 0.004) {
      const g = prizeGroups[winPrize]
      if (g) {
        const base = (g.userData.baseScale as number | undefined) ?? 1
        const e = winShow * winShow * (3 - 2 * winShow)
        const gone = winGone * winGone
        g.position.set(
          PICKUP.x,
          // 落在窗口**下沿**（原版那个奖品也是坐在取物口底板上，不是浮在正中）
          PICKUP.y - 0.11 + 0.03 * e,
          // 从窗口里「探出来」：只探出 9 cm，再多就像贴在柜门外面了
          PICKUP.z + 0.02 + 0.07 * e + 0.2 * gone,
        )
        g.rotation.set(0, 0, Math.sin(t * 2.4) * 0.05 * e)
        g.scale.setScalar(base * e * (1 - gone))
      }
    }
    if (winPrize >= 0 && winGone >= 0.999) winPrize = -1

    // ---- 灯：呼吸 + 中奖闪烁 ----
    /*
      ★★ 关键：**影子 A/B 的两个相位必须看见同一套灯**。

      原来这两个是 `reducedMotion ? 1.6 : …` —— 也就是一进 `renderShadowAB()`
      （它传 `reducedMotion = true` 为了冻住物理），LED 会从 1.5±0.6 跳到 **1.6**，
      而 1.6 在灯带本身的高光上正好落在另一侧 ⇒ 整圈灯带换一个样子。
      那个差值（实测 5~7 个色阶）**比影子本身还大**，把信号完全淹掉。

      ➜ 所以这里改成用 `t` 算（`t` 就是上一帧那个，两相位相同），
        `reducedMotion` 只挡「闪烁」这种**额外**的脉冲，不改基值。
    */
    const breathe = 1.5 + 0.6 * Math.sin(t * 2.6)
    const flash = v.winFlash > 0 && !reducedMotion ? 1.6 * Math.abs(Math.sin(t * 14)) : 0
    M.ledStrip.emissiveIntensity = breathe + flash
    M.doorLamp.emissiveIntensity = (0.4 + 0.2 * Math.sin(t * 2.2)) * (v.winFlash > 0 ? 4 : 1)
    M.tube.emissiveIntensity = 2.8 + Math.sin(t * 13.1) * 0.03

    // 颗粒每帧换一次种子（静态颗粒像屏幕脏了，动起来才像胶片）
    if (grain) grain.uniforms.uT.value = t

    // ---- 相机（触发在「中奖演出」那段，这里只负责**摆**）----
    if (camAnim) {
      camAnim.k = Math.min(1, camAnim.k + camDt / camAnim.dur)
      // smoothstep：起步和收尾都不像开关
      const e = camAnim.k * camAnim.k * (3 - 2 * camAnim.k)
      animP.lerpVectors(camAnim.p0, camAnim.p1, e)
      animT.lerpVectors(camAnim.t0, camAnim.t1, e)
      camera.position.copy(animP)
      curLook.copy(animT)
      camera.lookAt(curLook)
      if (camAnim.k >= 1) camAnim = null
      camera.updateMatrixWorld(true)
    } else if (camMode === 'door') {
      // 蹲在取物口：每帧重算（`camera.aspect` 可能刚被 resize 改过）
      doorPose()
      camera.position.copy(poseP)
      curLook.copy(poseT)
      camera.lookAt(curLook)
      camera.updateMatrixWorld(true)
    } else if (!reducedMotion) {
      /*
        默认机位 + 待机「呼吸」微动。

        az / pol 的扰动幅度和参考实现同量级（±5.7° / ±1°）——
        这是「有人在柜子前面站着」而不是「三脚架」的来源。
        手持晃动再小一档（0.008 / 0.006 世界单位）：再大就会看出画面在飘。
      */
      const az = Math.sin(t * 0.19) * 0.1
      const pol = CAM_POL + Math.sin(t * 0.27) * 0.018
      viewPose(cameraDist, az, pol)
      const sx = (Math.sin(t * 0.71) + Math.sin(t * 1.37 + 1) * 0.5) * 0.008
      const sy = (Math.sin(t * 0.53 + 2) + Math.sin(t * 1.13) * 0.4) * 0.006
      camera.position.set(poseP.x + sx, poseP.y + sy, poseP.z)
      curLook.copy(poseT)
      camera.lookAt(curLook)
      // ★ 项目铁律：动完相机必须刷世界矩阵（resize 里的 placeCamera 也这么干）
      camera.updateMatrixWorld(true)
    }

    if (composer) composer.render()
    else renderer.render(scene, camera)
  }

  /*
    ★★★ 同一帧的 on/off 对拍必须**自己把世界矩阵刷一遍**。

    three 的 `renderer.render()` 是「先算世界矩阵、再画阴影、再画场景」。
    如果两个相位之间**什么都没变**（同样的 `t`、同样的 `ClawVisual`），
    第二次 `render()` 时 `matrixWorldAutoUpdate` 已经全部算过，
    于是「这一帧物体有没有动」的信息没了 —— 阴影图不会被重画，
    两个相位拍出来是**同一张图**（实测差 0.29 个色阶，比噪声 1.47 还小）。

    `scene.updateMatrixWorld(true)` 强制重刷，`matrixWorldNeedsUpdate`
    重新变 true ⇒ 两帧各自完整地走一遍「算影子 + 画场景」。
  */
  /**
   * 把所有材质标脏，让它们按**当前**的 `shadowMap.enabled` 重新编译。
   *
   * ★★ `USE_SHADOWMAP` 是 shader 的**编译期**分支：只翻
   *   `renderer.shadowMap.enabled` 而不重编，已编译的材质仍然会去采样
   *   `shadowMap` 那张贴图 —— 于是「关掉阴影」的两帧长得一模一样。
   *   （实测冻结帧 A/B 只差 **6 个色阶 / 0.31% 像素**，正是这个原因。）
   */
  function recompileShadowMaterials(): void {
    root.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) if (mat) mat.needsUpdate = true
    })
  }

  function renderShadowAB(on: boolean): void {
    if (shadowAB !== null) return
    const v = lastVisual
    if (!v) return
    const normal = renderer.shadowMap.enabled
    scene.updateMatrixWorld(true)
    shadowAB = on
    try {
      /*
        ★ 开关变了就必须重编材质（见 `recompileShadowMaterials`）。
          少了这一步，两个相位差不到 1 个色阶 —— A/B 就成了「同一张图」。
      */
      if (normal !== on) recompileShadowMaterials()
      render(lastT, v, true)
    } finally {
      shadowAB = null
      renderer.shadowMap.enabled = normal
      // 还原之后也要重编回去，否则调试口退出时材质还停在另一个分支上
      if (normal !== on) recompileShadowMaterials()
    }
  }

  /* ============================ 换色 ============================ */

  let themeIdx = 0

  /**
   * 换配色。
   *
   * ★ 必须同时换**两张画出来的贴图**（灯箱、背板）—— 它们是 `CanvasTexture`，
   * 改 `material.color` 对它们没有任何作用。只换材质色的话，孩子会看到
   * 「柜身变青了，灯箱还是粉的、背板还是粉的」，比不换更奇怪。
   *
   * ⚠️ 旧贴图**必须 dispose**：换色可以来回点，不释放就是每点一次漏一张
   * 1024×256 / 512×512 的贴图，而且没有任何报错。
   */
  function setTheme(index: number): void {
    const n = CLAW_THEMES.length
    const idx = ((Math.round(index) % n) + n) % n
    themeIdx = idx
    /*
      所有染色都交给 `applyTheme()`（照搬原版）：柜身 / 控制台 / LED 灯带 /
      取物口灯环，以及**五张画出来的贴图**（灯箱 / 背板 / 取物口 / 控制台条 / 门贴）。

      ★ 只改 `material.color` 是不够的：那几张是 `CanvasTexture`，
        颜色是**画进像素里**的。以前只换柜身，孩子看到的是
        「柜身变青了，灯箱还是粉的、背板还是粉的」—— 比不换更奇怪。
      ⚠️ 旧贴图由 `applyTheme` 内部 `dispose()`（换色可以来回点，不释放就是每点一次漏一张）。
    */
    applyTheme(machine, CLAW_THEMES[idx])
  }

  /* ============================ 收尾 ============================ */

  function dispose(): void {
    disposed = true
    // 物理世界是 WASM 里的一块内存，`renderer.dispose()` 管不到它
    phys?.dispose()
    phys = null
    physState = 'off'
    ro.disconnect()
    // 后处理链有自己的 render target，`renderer.dispose()` 不管它
    composer?.dispose()
    composer = null
    // 环境贴图这条链上的两个对象都要单独放：PMREM 的中间 render target
    // 不释放就是一块常驻显存（而且切走再进来会再分配一块）
    // ⚠️ 2026-10-18：`RoomEnvironment` 换成自建的 `buildEnvScene()` 之后，
    //   已经没有 `roomEnv` 这个对象了 —— 那边 new 出来的只是普通的
    //   Geometry / Material，走 `renderer.dispose()` 就够，别再加一行它的 dispose。
    scene.environment = null
    envRT.dispose()
    pmrem.dispose()
    /*
      机器和娃娃的几何 / 贴纸材质都不在 `disposables` 里（它们是照搬原版那套模块
      现建的）。不释放的话，每进出一次娃娃机页就漏一整套几何 + 十几张贴图，
      而且没有任何报错。
      ⚠️ 共享材质（`M` / `fabricNormal` / `whiteMap`）由这两个函数自己跳过 ——
        娃娃在用的纤维法线贴图不能被柜子那边放掉。
    */
    disposeMachine(machine)
    for (const m of prizeModels) disposePlush(m)
    renderer.dispose()
    canvas.remove()
  }

  /** 把柜子的 8 个角投影到画布坐标 —— 走查脚本用它断言「柜子完整」。 */
  function debugFrame() {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    /*
      ★ 几何判据必须是**静态取景**下的数字，不能被 `render()` 里的「呼吸」微动带偏
        （呼吸只改 `camera.position` + `lookAt`，不改这里）。所以投影前先临时把相机
        摆回 `resize` 算好的静态位，量完再还原呼吸位姿 —— 下一帧 render 也会重设，
        但立刻还原更稳（截图脚本可能量完不等下一帧就截）。
    */
    const savedPos = camera.position.clone()
    const savedQuat = camera.quaternion.clone()
    placeCamera(cameraDist)
    camera.updateMatrixWorld(true)
    const glass = projectRect(GLASS_CORNERS, w, h)
    const frame = projectRect(FRAME_CORNERS, w, h)
    const cabinet = projectRect(BOX_CORNERS, w, h)
    camera.position.copy(savedPos)
    camera.quaternion.copy(savedQuat)
    camera.updateMatrixWorld(true)
    return {
      /**
       * ★ 判据换成**玻璃区**了。
       *
       * 之前断言的是「整个柜子（含 1.0 高的底座）完整在画面里」，那是
       * 「contain 装下整台机器」的思路 —— 为了装下底座，相机被推到很远，
       * 玻璃区只剩画面宽度的 66%，看着像一张柜子的照片。
       *
       * 现在按原版取景：**玻璃区必须完整、而且要横向铺满**；
       * 底座允许被裁（`cabinet` 会超出画面，这是**预期**，不是 bug）。
       */
      glass,
      /**
       * 玻璃区占画面高 / 宽的比例。
       *
       * ★ 这是「视角够不够近」的判据（见 `GLASS_MIN_FILL`）。单独给数而不是让
       *   脚本自己用 `glass` 算：脚本手里那份 `canvas.h` 是 DOM 量的，
       *   这里的 `h` 是渲染器量的，两者在 DPR / 边界上差一点时，
       *   同一个判据会得出两个结论。**判据的数字由场景给。**
       *
       * ⚠️ 走查要断言的是 `glassFill`（两者的 max），**不是 `glassFillY`**：
       *   竖屏时宽度是约束方向，高度占比永远接近 1，单看它会「绿着说谎」。
       */
      glassFillY: (glass.bottom - glass.top) / h,
      glassFillX: (glass.right - glass.left) / w,
      glassFill: Math.max((glass.bottom - glass.top) / h, (glass.right - glass.left) / w),
      glassFillMin: GLASS_MIN_FILL,
      /**
       * 取景的**设计距离**和**视线高度**（不是 `camera.position` 的实时值）。
       *
       * ★ 给走查用：横竖屏用的是不同的 `LOOK_Y`（见 `LOOK_Y_WIDE`），
       *   而 `frame.top` 那种像素判据一旦红了，光看像素分不清是
       *   「视线抬得不够」还是「距离拉得不对」——这两个数能直接分开。
       */
      camDist: cameraDist,
      lookY: camLookY,
      railY: RAIL_Y,
      /** 取景框（必须完整可见的那块） */
      frame,
      /** 整台机器 —— 允许越界 */
      cabinet,
      canvas: { w, h },
      dpr,
      roomVisible: room.visible,
      /**
       * 阴影贴图一个 texel 覆盖多少**世界单位**。
       *
       * ★★ 这个数是从**实际投影矩阵**反推的，不是从上面的常量抄的 —— 正因为如此，
       *   它能抓住「改了 `shadow.camera.left/right` 却忘了 `updateProjectionMatrix()`」：
       *   那种情况下矩阵还是默认的 ±5，这里会返回 **0.0098**（10 / 1024），
       *   而正确值 ≈ **0.0008**。差 12 倍，画面上只表现为「影子有点糊」，
       *   肉眼和截图都看不出来 —— 所以必须有个数字盯着它。
       *   （正交投影：`elements[0] = 2 / (right - left)`。）
       */
      shadowTexel: 2 / key.shadow.camera.projectionMatrix.elements[0] / key.shadow.mapSize.x,
    }
  }

  /**
   * 「写了」和「开着」是两件事 —— 这个函数回答后者。
   * 走查脚本拿它断言，别去比截图（抖动 3~252 B，逐字节比对本来就不稳）。
   */
  /**
   * 「写了」和**「开着」**是两件事 —— 这个函数回答后者。
   *
   * ★★ 2026-10-18：这里加了 `debugSetShadows()`，**只为走查做 A/B 对照**。
   *
   * 为什么非要有它：之前量影子用的是「整块画布下半部的亮度分位数」，
   * 结果在参考实现上把 `shadowMap.enabled` 关掉，p2 只动 1 个色阶 ——
   * **那个判据根本分辨不出影子**，因为它被背景和地面淹掉了。
   * 要证伪「有没有影子」，只能做**同机、同池、同光**的两张图，唯一变量是阴影；
   * 而本项目不暴露 renderer（有意的），所以只能开这个口子。
   *
   * ⚠️ 它**不参与任何游戏逻辑**，页面里没有任何调用点；走查脚本用完必须调回去。
   */
  function debugEffects() {
    let casters = 0
    root.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && m.castShadow) casters++
    })
    return {
      shadows: renderer.shadowMap.enabled,
      shadowCasters: casters,
      envMap: !!scene.environment,
      post: !!composer,
      theme: themeIdx,
    }
  }

  return {
    render,
    resize,
    dispose,
    debugFrame,
    debugEffects,
    /**
     * 开关阴影贴图 —— **只给走查做 A/B 对照**，页面里没有任何调用点。
     *
     * ⚠️ 用完必须 `debugSetShadows(true)` 调回去（否则后面的截图全是没影子的）。
     *
     * ★★ 返回值必须**读回真实状态**，不能写 `return on`：
     *   变异测试时把赋值改成 `renderer.shadowMap.enabled = false && on`（永远 false），
     *   如果这里返回入参 `on`，走查就会以为「关了」，实际一直开着 ——
     *   于是「关掉阴影后画面应该变亮」这条断言**永远绿着**，实测就是这么漏过去的。
     *   ➜ `debugEffects().shadows` 也读同一个字段，两边必须对得上。
     */
    /**
     * 「再画一帧，而且**这一帧**强制开/关阴影」—— 只给走查做 A/B 对照。
     *
     * ★★★ 为什么必须做到「同一帧」：前面三版 A/B 都是「截图 → 调开关 → 再截图」，
     *   **全部不可证伪**，而且变异测试三版全绿。两层原因：
     *
     *   ① 截图时机：`debugSetShadows()` 同步返回，页面**下一帧**才重画；
     *      紧跟其后的截图可能拍到还没重画的那帧。
     *   ② 画面自己会动：软体回弹 / LED 呼吸 / 光晕都在改像素。实测「**同一状态**
     *      连拍两张」的平均差 3.7~4.5 个色阶，而「开 vs 关」只差 8.6~25 ——
     *      只有 2~5 倍。判据卡在这个量级上，换个时间跑就会翻。
     *
     *   ➜ 这个接口把开关翻在 `render()` **内部**：同步画两帧（先 on 再 off），
     *     两次用的是**同一个 `t` / 同一个 `ClawVisual`**，中间不可能插进动画。
     *     两张图的唯一变量就是「这一帧有没有画阴影贴图」。
     *
     * ⚠️ 它**不参与任何游戏逻辑**（只是把最后一次的视觉状态重画两遍），
     *   页面里没有任何调用点；返回值 = 这一帧真的用的那个开关值。
     */
    debugForceShadowFrame(on: boolean): { shadows: boolean; drew: boolean } {
      renderShadowAB(on)
      return { shadows: usedShadow, drew: lastVisual !== null }
    },
    debugSetShadows: (on: boolean) => {
      renderer.shadowMap.enabled = on
      // 材质必须重新编译（原因见 `recompileShadowMaterials`）
      recompileShadowMaterials()
      return renderer.shadowMap.enabled
    },
    /**
     * 机位现在是什么状态 —— 走查脚本用它断言「中奖后真的蹲下去了」。
     *
     * ★ 判据不能只看截图：蹲没蹲下去在缩略图上都能看成「差不多」。
     *   这里给的是**数**：`mode`、目标点 `look`、以及取物口本身的位置 `pickup`
     *   —— 脚本可以自己算「看的是不是取物口」，而不是抄一份期望坐标。
     */
    debugCamera: () => ({
      mode: camMode,
      dist: camera.position.distanceTo(curLook),
      /**
       * ★ 蹲到取物口时的**设计距离**（`doorPose()` 算出来的那个 `d`）。
       *
       * 只给 `dist` 是不够的：它量的是「相机到目标点」的**直线**距离，
       * 而蹲位是斜着往上看的（`+d*0.16` / `+d*0.98`），直线距离比 `d`
       * 大 1.5%——小的差别，但走查拿它跟默认机位的 `dist` 比比例，
       * 两个口径混着用就会得出「蹲下去没近多少」这种假结论。
       * ➜ 要走查按比例比，就两条都读**同一个口径**。
       */
      doorDist,
      /**
       * ★★ 取物口窗口在画面里占多少（宽 / 高，都不是 0~1 归一，是「相对画布」）。
       *
       * 这是**当前机位下投**出来的，所以默认机位也能读 —— 于是走查可以问
       * 「蹲下去之后窗口比平时大多少倍」，而不是拿两个不同口径的距离相除。
       *
       * 踩过的坑：用 `dist` 比比例时，两个机位的 `dist` 是**两种 fit**算出来的
       * （一个 fit 玻璃、一个 fit 窗口），比例里混着「窗口外径 0.494 vs 原版 0.32」
       * 这种和自己的画面无关的量 ⇒ 门槛只能靠猜。
       */
      winW: (() => {
        if (!renderer) return 0
        const w = renderer.domElement.clientWidth
        return projectRect(PICKUP_QUAD, w, renderer.domElement.clientHeight).right / w
      })(),
      winH: (() => {
        if (!renderer) return 0
        const w = renderer.domElement.clientWidth
        const h = renderer.domElement.clientHeight
        const g = projectRect(PICKUP_QUAD, w, h)
        return (g.bottom - g.top) / h
      })(),
      look: { x: curLook.x, y: curLook.y, z: curLook.z },
      pickup: { x: PICKUP.x, y: PICKUP.y, z: PICKUP.z },
      /** 蹲在取物口的剩余秒数（0 = 已经回到默认机位） */
      doorHold,
      /** 正摆在取物口的那只奖品（−1 = 没有） */
      winPrize,
      winShow,
    }),
    debugVisual: () => lastVisual,
    setTheme,
    themeIndex: () => themeIdx,
    prizeCount: () => prizeGroups.length,
    debugProng: () => prongInners[0]?.rotation.z ?? 0,
    nearestPrize: (x: number, z: number) => {
      // 物理在跑的时候问**活的**位置：娃娃会被爪子推、会滚，静止坐标早就过期了
      if (phys) return phys.nearest(x, z)
      let best = -1
      let bestD = Infinity
      for (let i = 0; i < prizeRest.length; i++) {
        const d = Math.hypot(prizeRest[i].x - x, prizeRest[i].z - z)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return { index: best, dist: bestD }
    },
    prizeAt: (index: number) => {
      if (phys) {
        const p = phys.positionOf(index)
        return p ? { x: p.x, z: p.z } : null
      }
      const p = prizeRest[index]
      return p ? { x: p.x, z: p.z } : null
    },
    debugPrizePos: (index: number) => {
      /*
        ★ 读**物理刚体**的位置，不读视觉 group 的位置。

        踩过：中奖之后那只娃娃的 group 会被「取物窗里摆一只」那段代码
        直接 `position.set(PICKUP...)`（纯视觉），于是探针量到的是
        **窗口里那只摆设**（y ≈ −0.6、x = −0.3），不是它真实的刚体位置 ——
        看起来像「它掉进通道了」，其实物理那边还在池子里。
        这种「探针量到了动画、没量到对象」的坑，光看数字是分不出来的。
      */
      const p = phys?.rawPositionOf(index)
      if (p) return { x: p.x, y: p.y, z: p.z }
      const g = prizeGroups[index]
      if (!g) return null
      return { x: g.position.x, y: g.position.y, z: g.position.z }
    },
    surfaceAt: (x: number, z: number) => {
      // 物理在跑：射线探，地板和娃娃都算（和原版同一条路）
      if (phys) return phys.surfaceAt(x, z)
      /*
        物理没起来（还在加载 / 加载失败）：用 three 里那几只的当前位置估一个顶面。
        娃娃顶 ≈ 中心 + 0.16（耳朵 `y=0.128` + 半径 0.028，见 `PRIZE_PARTS`），
        水平方向只认「爪子正下方」那一圈，别把隔壁那只算进来。
      */
      let best = 0
      for (const g of prizeGroups) {
        if (!g.visible) continue
        const dx = g.position.x - x
        const dz = g.position.z - z
        if (dx * dx + dz * dz > 0.1 * 0.1) continue
        best = Math.max(best, g.position.y + 0.16)
      }
      return best
    },
    debugPhysics: () => {
      const d = phys?.debug()
      return {
        state: physState,
        bodies: d?.bodies ?? 0,
        held: d?.held ?? false,
        awake: d?.awake ?? 0,
        recycled: d?.recycled ?? 0,
        recycledLog: d?.recycledLog ?? [],
        steps: d?.steps ?? 0,
        maxSquash: d?.maxSquash ?? 0,
        error: physError,
      }
    },
    fieldFromScreen: (clientX: number, clientY: number) => {
      const r = container.getBoundingClientRect()
      const w = Math.max(1, r.width)
      const h = Math.max(1, r.height)
      // 池底矩形（y=0）的四个角投到屏幕，取包围盒
      let left = Infinity
      let right = -Infinity
      let top = Infinity
      let bottom = -Infinity
      for (const x of [-HX, HX]) {
        for (const z of [-HZ, HZ]) {
          const p = new Vector3(x, 0, z).project(camera)
          const sx = ((p.x + 1) / 2) * w
          const sy = ((1 - p.y) / 2) * h
          left = Math.min(left, sx)
          right = Math.max(right, sx)
          top = Math.min(top, sy)
          bottom = Math.max(bottom, sy)
        }
      }
      const nx = (clientX - r.left - left) / Math.max(1, right - left)
      const ny = (clientY - r.top - top) / Math.max(1, bottom - top)
      // 留一点边距，爪子不会贴着玻璃
      const pad = 0.09
      return {
        x: MathUtils.clamp(-HX + pad + nx * (HX * 2 - pad * 2), -HX + pad, HX - pad),
        z: MathUtils.clamp(-HZ + pad + ny * (HZ * 2 - pad * 2), -HZ + pad, HZ - pad),
      }
    },
  }
}

/** 取物口中心（世界坐标）—— 爪子把娃娃送到这里就算拿到了。 */
export const CLAW_HOLE_CENTER = { x: (HOLE.x0 + HOLE.x1) / 2, z: (HOLE.z0 + HOLE.z1) / 2 }
/** 取物口的世界坐标范围 —— 页面判定「娃娃有没有掉进去」时要用同一个数。 */
export const CLAW_HOLE = HOLE
/** 天车轨道高度 —— 页面算 hubY 的起点。 */
export const CLAW_RAIL_Y = RAIL_Y
export { HX as CLAW_HX, HZ as CLAW_HZ, GLASS_H as CLAW_GLASS_H }
