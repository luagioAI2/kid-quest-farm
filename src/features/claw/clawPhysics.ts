/**
 * 娃娃机的**物理层**（Rapier3D）—— 只负责「看起来是真的」，**不负责输赢**。
 *
 * ---------------------------------------------------------------------------
 * ★★★ 最重要的一条：这里没有 `won`，也永远不该有
 * ---------------------------------------------------------------------------
 *
 * 参考实现（`E:/plan/test25/claw-machine/src/physics.ts`）里有个 `checkPrizes()`：
 * 娃娃掉进洞口就算赢、`roundWins++`。**那个函数不能搬过来。**
 *
 * 本项目的输赢在**投币那一刻**就由 `domain/clawEconomy.ts` 的 `settleClawRound()`
 * 定死了（幂等伪随机，期望值 `E < 1`）。如果让物理再判一次：
 *
 *   · 物理判「赢」而账本判「没中」→ 孩子看见娃娃进洞了，却什么都没拿到；
 *   · 物理判「没中」而账本判「中」→ 孩子看见娃娃滑掉了，积分却加了。
 *
 * 两条都是**对孩子说谎**。更糟的是第二条会被当成「物理没调好」去调参数，
 * 而期望值那条不变量就悄悄破了 —— 那是印钞机，而且零报错。
 *
 * 所以分工是死的：
 *
 *   | 谁 | 管什么 |
 *   | --- | --- |
 *   | `clawEconomy` + `clawTimeline` | 中不中、什么时候夹、什么时候松手 |
 *   | **这个文件** | 娃娃怎么堆、被爪子推开、被提起来晃、松手后怎么掉 |
 *
 * 页面每帧把「手里有没有、夹到多紧」算好传进来（`ClawPhysicsPose`），
 * 这里只**跟随**，从不反过来影响结果。
 *
 * ---------------------------------------------------------------------------
 * ★ 为什么爪子是 kinematic 而不是「动态爪 + 电机」
 * ---------------------------------------------------------------------------
 *
 * 原版的三个爪是动态刚体 + 转轴 + 位置电机，抓力是物理算的。那样好看，
 * 但抓力一旦是物理算的，**它就会决定娃娃掉不掉** —— 又回到上面那条。
 *
 * 这里爪子是 kinematic（位置由动画直接摆），它照样**推得动**池子里的娃娃，
 * 只是自己不会被推开。夹住是**软握持**（每步把娃娃的速度朝目标推，
 * 见 `driveHeld()`），松手就是把目标撤掉、让它自己掉下去。
 * 看着和原版一样，但「掉不掉」是时间线说的。
 *
 * ---------------------------------------------------------------------------
 * ★ 加载与降级
 * ---------------------------------------------------------------------------
 *
 * Rapier 是**动态 import** 的（`rapier.es.js` gzip 约 **755 KB**，单独一个
 * chunk）。它没加载完、加载失败、或者设备跑不动，场景都照常显示 ——
 * `clawScene` 那边会退回「手写的三层摆放 + 插值回位」那条老路。
 * **物理是锦上添花，不是能不能玩的前提。**
 */
import type { Group } from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import { topOf, type PrizeType } from './scene/prizeTypes'
import { softStep } from './clawSoft'

/**
 * Rapier 的运行时命名空间类型。
 *
 * `@dimforge/rapier3d-compat` 的 `export default` 是一个 namespace 对象，
 * 所以 `typeof import(...).default` 才是「这个对象」的类型。
 */
type RapierNS = typeof import('@dimforge/rapier3d-compat').default

/* ============================ 碰撞分组 ============================ */

/**
 * 谁和谁碰。
 *
 * Rapier 的分组是 `(member << 16) | filter`：两个碰撞体**互相都要**在
 * 对方的 filter 里才会产生接触。
 *
 * 这里只有三组，而且故意让娃娃和娃娃碰（`PRIZE` 的 filter 含 `PRIZE`）——
 * 不碰的话娃娃会叠在一起穿模，那正是「像贴纸」的来源。
 */
const G_STATIC = 0x0001
const G_CLAW = 0x0002
const G_PRIZE = 0x0004

function groups(member: number, filter: number): number {
  return ((member & 0xffff) << 16) | (filter & 0xffff)
}

/* ============================ 时间步 ============================ */

/**
 * 固定步长。**不用 `dt` 直接当步长** —— 掉帧时步长变大会让娃娃穿墙，
 * 而且同样的操作在 30fps / 60fps 下结果不一样，截图走查就不可复现了。
 *
 * 1/60 是 Rapier 的默认值，对「几十个球」这个量级足够；
 * 1/120（原版用的）在这个尺寸下看不出差别，但 CPU 翻倍。
 */
const FIXED_DT = 1 / 60

/**
 * 一帧最多补几步。
 *
 * 切后台回来 / 长任务卡住时 `dt` 会很大（比如 2 秒），不限的话一次要补 120 步，
 * 直接卡死一帧，然后更卡 —— 典型的死亡螺旋。丢掉多余的模拟时间是对的：
 * 玩家看不见的那段时间本来就不需要演。
 */
const MAX_STEPS = 4

/* ============================ 娃娃的碰撞体 ============================ */

/**
 * ★★ 2026-10-19：娃娃的碰撞体**不再是我们手搓的三个球**，而是
 * `scene/prizeTypes.ts` 里每种娃娃自己的 `parts`（照搬原版）。
 *
 * 以前五种娃娃共用「身子 + 两只耳朵」，企鹅和兔子摸起来一模一样；
 * 而视觉那边（`scene/plush.ts`）是**按种类**画的 —— 于是「看得见的耳朵」
 * 和「摸得到的耳朵」不是同一个东西，抓企鹅的鳍会滑过去。
 *
 * ➜ 现在两边读同一份 `PRIZE_TYPES`：形状、质量、「头顶在哪」全从它推。
 *
 * 为什么不是一个球：一个球会**滚**。娃娃在池子里滚来滚去不像毛绒玩具，
 * 而且滚起来之后 `nearestPrize` 会一直变。多球拼出来的轮廓是扁的、带凸起，
 * 摩擦力一咬就停住，像真的堆在那。
 */

/* ============================ 爪子的几何 ============================ */

/**
 * hub 本体的尺寸。**视觉和碰撞体共用这两个数**。
 *
 * 原来是「视觉用圆柱 0.056 / 碰撞体用一个 r=0.056 的球」—— 球的底部比圆柱
 * 底面低 0.026，于是爪子还没碰到娃娃，一个看不见的球先把娃娃顶开了。
 */
export const HUB_R = 0.056
export const HUB_HH = 0.03

/** 指根到 hub 轴线的距离。指头挂在这个半径上，不是从 hub 中心长出来。 */
export const PIVOT_R = 0.026

/**
 * 指头中心线：`(径向 r, 高度 y)`，相对**指根**、合拢姿态。
 *
 * ★★ 2026-10-18 整段抄自参考实现（`claw-machine/src/physics.ts` 的 `PRONG_PTS`）。
 *   原来我们是一根**直胶囊**（`Capsule(0.0105, 0.105)` 斜着摆），远看是个夹子；
 *   原版是**外张再内收的钩子** —— 先向外鼓到 r=0.052，再收回 r=0.004，
 *   这才有「爪子」的形状。用户反馈「连爪子形状都不同」指的就是这里。
 *
 * ⚠️ 这份数据是**视觉和碰撞体的唯一来源**：`clawScene.ts` 用它生成 `TubeGeometry`，
 *   这里用它生成分段胶囊。抄成两份就会出现「看得见的钩子、摸不到的直杆」。
 */
export const PRONG_PTS: [number, number][] = [
  [0, 0],
  [0.045, -0.055],
  [0.052, -0.115],
  [0.032, -0.152],
  [0.004, -0.166],
]
/**
 * 指头的粗细（管子半径 / 胶囊半径，**视觉和碰撞体共用**）。
 *
 * ★ 0.0125 不是原版的 0.0075，是**按娃娃的尺度折算**过的：
 *   原版的娃娃半径 0.043，我们的 `PRIZE_PARTS` 是 0.072（1.67 倍），
 *   所以指头也该粗 1.67 倍 —— `0.0075 × 0.072 / 0.043 ≈ 0.0125`。
 *   照抄 0.0075 的话，在手机上指头只有 **1.5 个像素**宽：钩子的形状
 *   「技术上是对的」，看上去仍然是一根铁丝。hub 那边也是同一个比例
 *   （`HUB_R = 0.056 = 0.034 × 1.65`），所以粗细关系是自洽的。
 *
 * ⚠️ **长度**（`PRONG_PTS` 的 y 到 −0.166）故意**没有**跟着放大 1.67 倍。
 *   原版的指头是动态刚体，合拢时被娃娃顶住就停；我们是 kinematic，
 *   合拢角度直接摆到 0.86，指头再长 1.67 倍就会**扎穿**娃娃。
 *   要放大长度，得先有「合到碰到娃娃为止」的判定，不是改一个数的事。
 */
export const PRONG_RADIUS = 0.0125
/** 三个指头的方位角（绕 Y）。和原版一致：90° / 210° / 330°。 */
export const PRONG_AZ = [Math.PI / 2, Math.PI / 2 + (2 * Math.PI) / 3, Math.PI / 2 + (4 * Math.PI) / 3]

/**
 * 指头的三个角度（绕**径向轴**的切向轴转，弧度）。
 *
 * ★★ 2026-10-19：**唯一来源改成 `scene/dims.ts`**（原版的数）。
 *
 *   这里以前自己写了一份 `ANG_IDLE = 0.8`，理由是：
 *   「原版是力控电机、力矩 0.25 顶不住指头自重，画面停在 ≈0.9；
 *     我们是 kinematic 没有重力，照抄 0.32 会缩成一个闭合的芽」。
 *
 *   那个理由**只对老几何成立**。老指头是一根直的 `CapsuleGeometry` 斜着摆，
 *   本身没有外扩的弧度，只能靠张角把它「掰开」。现在的 `PRONG_PTS` 是
 *   原版那条**向外弯再勾回来**的曲线 —— 静止时指尖本来就已经在 ~24°，
 *   再叠 0.8 就变成四脚蜘蛛（实测 `debugProng() = 0.8`，
 *   和原版 `1-idle.png` 一比，指尖比 hub 还高，完全不像）。
 *
 *   ➜ 结论：换成原版的 0.32，画面就和 `1-idle.png` 对上了
 *     （指尖落在 hub 下方约 2.5 个 hub 直径处，钩子朝下）。
 *   ⚠️ 别再在别处写第二份角度 —— `dims.ts` 是唯一来源，
 *      `ANG_*` 从那里 re-export，`applyProngs()` 和碰撞体读的是同一个数。
 */
export { ANG_CLOSED, ANG_IDLE, ANG_OPEN } from './scene/dims'

/**
 * 把中心线拆成若干段胶囊（**指头本地坐标系**，径向 = +X）。
 *
 * Rapier 的 capsule 只有「一根直线 + 半径」，弯的钩子只能用**一串**去近似。
 * 末端那一段半径放大 1.25 倍 —— 原版的爪尖也是加粗的橡胶头。
 *
 * ★ 本地方向为什么是 +X：碰撞体的位姿直接取 `prongInners[i].matrixWorld`
 *   （那一层已经带了方位角 yaw），所以指头的「径向」在本地就是 +X。
 *   原版是反过来做的（body 不带 yaw，`prongSegments(az)` 自己算 cos/sin）——
 *   两种都对，但只能选一种，混用就是「三个指头挤在一边」。
 */
function prongSegments(): { a: [number, number, number]; b: [number, number, number]; r: number }[] {
  const segs: { a: [number, number, number]; b: [number, number, number]; r: number }[] = []
  for (let i = 0; i < PRONG_PTS.length - 1; i++) {
    const [r0, y0] = PRONG_PTS[i]
    const [r1, y1] = PRONG_PTS[i + 1]
    segs.push({
      a: [r0, y0, 0],
      b: [r1, y1, 0],
      r: i === PRONG_PTS.length - 2 ? PRONG_RADIUS * 1.25 : PRONG_RADIUS,
    })
  }
  return segs
}

/**
 * 娃娃「头顶」在自己本地坐标里的高度 —— 握持时它才是那个「挂点」。
 *
 * ★ 从**这只娃娃的种类**推出来（`topOf`），不写死：兔子耳朵顶到 0.162，
 *   小鸡只有 0.052。按头顶算吊高，娃娃才**垂在**钩子下面；按腰算会像用托盘端着。
 *   以前五种娃娃共用一套碰撞体，所以只能取一个折中值 —— 现在每只都不一样。
 */
function anchorOf(index: number, types: PrizeType[], prizes: Group[]): number {
  const t = types[index]
  if (!t) return 0.1
  return topOf(t) * (prizes[index]?.scale.x || 1)
}

/**
 * 钩子尖端在 hub 本地坐标里的高度（`PRONG_PTS` 最后一点 + 指根的挂高）。
 *
 * ★ 也是推出来的：指头形状一改，握持高度跟着改，不用再手调一个数。
 */
const PRONG_TIP_HUB_Y = -HUB_HH + PRONG_PTS[PRONG_PTS.length - 1][1]

/**
 * 钩子尖端**扎进娃娃头顶**多少。
 *
 * ★★ 2026-10-19：0.045 → **0.03**。娃娃换成原版尺寸之后（一只约 0.09 宽），
 *   钩子围出来的兜（最宽 r=0.052）**装得下**一只娃娃的头了 ——
 *   原来是娃娃比兜还大，只能扣在头顶上，所以埋得很深。
 *   现在埋 0.03：三个尖端正好扎进头顶的毛里，钩子最鼓那圈在耳朵两侧擦过。
 *   太浅（<0.015）像悬在头顶没碰上，太深（>0.06）整根钩子都看不见了。
 */
const PRONG_BITE = 0.03

/**
 * 夹住之后，娃娃头顶在 hub 本地坐标里的高度。
 * 再减掉锚点到娃娃原点的距离，就是娃娃原点该待的地方。
 */
const GRIP_TOP_HUB_Y = PRONG_TIP_HUB_Y + PRONG_BITE

/**
 * 夹住之后，娃娃**吊正**时原点在 hub 本地坐标里的高度。
 *
 * 头顶落在钩子尖端下 `PRONG_BITE` 的地方，再减掉头顶到原点的距离。
 */
function hangYOf(index: number, types: PrizeType[], prizes: Group[]): number {
  return GRIP_TOP_HUB_Y - anchorOf(index, types, prizes)
}

/**
 * 夹住之后，娃娃水平方向最多偏离爪子轴线多少（世界单位）。
 *
 * ★ 0.05 ≈ hub 半径（0.056）以内。见 `grab()` 里的注释：不夹这个偏移，
 *   娃娃会一直吊在爪子**侧面**（指头扫进堆里时把它推开了 0.16）。
 */
const GRIP_MAX_OFFSET = 0.05

/**
 * 抬多高之后娃娃才算「吊正」（0 → 抓的那一刻的相对位置，1 → `GRIP_HANG_Y`）。
 *
 * ★★ 为什么不是「一夹住就吊正」：爪子是**扎进娃娃堆**里合的爪，抓的那一刻
 *   hub 常常只比池底高 0.2，而吊正要低 0.307 —— 直接摆过去就是把娃娃
 *   **塞进池底**。实测那一帧娃娃在钩子外面，画面像「没夹住」。
 *   ➜ 抓住时保持相对位置（跟着爪子刚性上升），抬到 0.35 之后才吊正：
 *     画面上就是「先扣住、提起来，再垂下去」，跟真的爪子一样。
 */
const GRIP_SETTLE_RISE = 0.35

/**
 * 握持的跟随速度（1/s）：位置误差按 `e^(-k·t)` 收敛，16 ⇒ 0.1 秒收掉 80%。
 *
 * ★ 不是铰：铰把位置**锁死**，而这里需要「软」一点 —— 娃娃被爪子提着走，
 *   但抬起来的过程中要能从「扣住的姿势」滑到「吊在下面」。
 */
const GRIP_FOLLOW = 16

/** 跟随速度上限（世界单位/秒）—— 免得建握那一帧娃娃「嗖」地窜过去。 */
const GRIP_MAX_SPEED = 2.5

/** 娃娃原点低于这个高度就插进池底了（它的碰撞体最低点在原点下方 0.006）。 */
const GRIP_FLOOR_Y = 0.006

/** 单位四元数 = 娃娃「正着」（本地 +Y 朝上）。见 `driveHeld()` 的姿势回正。 */
const UPRIGHT = { x: 0, y: 0, z: 0, w: 1 }

/* ============================ 掉进洞之后 ============================ */

/**
 * 低于这个高度 = 已经离开池子、进了取物通道（池底 y=0）。
 *
 * ★★ 2026-10-18：`-0.12` → **`-0.58`**。
 *
 * 原来 `-0.12` 只比池底低一点点，那是为「池底侧面的竖井」设的。
 * 现在娃娃是从**取物口上方松手、落进下面的滑道**（跟参考实现一样），
 * 路径上一路都在 `y < -0.12`：`-0.12` 一到就 `recycle()`，
 * 孩子看到的是娃娃**刚落下去就凭空回到池子里** —— 「抓取后移动到出口有问题」里
 * 最刺眼的一条。
 *
 * `-0.58` 在取物口（−0.52）下面、托盘（−0.66）上面：
 * 娃娃要走完滑道、滑到窗口，才被收走。
 *
 * ⚠️ 这个值和 `recycle()` / `nearest()` / `positionOf()` 共用 —— 改它只改一处，
 *   别在别处再写一个「−0.12」。
 */
const CHUTE_Y = -0.58

/**
 * 放回池子的**候选点** —— 由柜子尺寸推，不是写死的一张表。
 *
 * ★★ 2026-10-19：这张表原来是写死的 8 个坐标，按**旧的宽柜子**（`hx 0.58 / hz 0.5`）挑的。
 *   换成原版尺寸（`hx 0.5 / hz 0.4`）之后，8 个点全挤在中间偏左，
 *   右边和前面各留下一条空垫子 —— 30 只娃娃看着像「一撮」，不像「一池」。
 *   （写死坐标还踩过更狠的一次：`(0.18, 0)` 离洞只有 0.100，小于一只娃娃的直径，
 *     放回去正好卡在口沿上，一挤又推下去 ⇒「掉洞 → 放回洞口 → 再掉洞」。）
 *
 * ➜ 现在铺 4×4 网格盖满池底、内缩 `INSET`（≈半只娃娃），
 *   再剔掉**洞口矩形 + `CLEAR` 余量**里的点。洞口在哪完全由 `hole` 决定，
 *   不假设它贴着哪个角。
 *
 * 最终用哪个点由 `pickRespawnSpot()` 按「离洞口最远 + 被占得最少」现算，
 * 并随 `recycled` 轮转 —— 两只同时掉下去不会叠在同一个点上被弹飞。
 */
function respawnCandidates(hx: number, hz: number, hole: ClawPhysicsCabinet['hole']) {
  const INSET = 0.07 // 半只娃娃：别贴着玻璃
  const CLEAR = 0.06 // 洞口外再让一圈，别放在口沿上
  const COLS = 4
  const ROWS = 4
  const out: { x: number; z: number }[] = []
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const x = -hx + INSET + (c / (COLS - 1)) * (2 * (hx - INSET))
      const z = -hz + INSET + (r / (ROWS - 1)) * (2 * (hz - INSET))
      const inHole =
        x > hole.x0 - CLEAR && x < hole.x1 + CLEAR && z > hole.z0 - CLEAR && z < hole.z1 + CLEAR
      if (!inHole) out.push({ x, z })
    }
  }
  return out
}

/** 从多高放回去。太高会砸得整池子跳，太低会凭空出现。 */
const RESPAWN_Y = 0.72

/* ============================ 对外接口 ============================ */

/** 柜子的尺寸。**由调用方传进来**，这里不抄一份 —— 抄一份就是两个事实源。 */
export interface ClawPhysicsCabinet {
  hx: number
  hz: number
  glassH: number
  hole: { x0: number; x1: number; z0: number; z1: number }
}

/** 这一帧爪子在哪、夹得多紧、手里有没有东西。**页面算好传进来。** */
export interface ClawPhysicsPose {
  clawX: number
  clawZ: number
  hubY: number
  /** 0 = 张开，1 = 合上 */
  close: number
  /** 手里那只娃娃的下标；`null` = 空手 */
  held: number | null
  /**
   * hub 的朝向（四元数）。**摆动**时爪子是沿绳子倾斜的，hub 碰撞体也要跟着转 ——
   * 不传就是竖直，撞娃娃的位置会比画面偏一点。
   */
  rot?: { x: number; y: number; z: number; w: number }
}

export interface ClawPhysics {
  /**
   * 推进物理并把结果写回 three 的 `Group`。
   *
   * `dt` 是**真实**间隔（秒），内部会切成固定步长。
   */
  step(dt: number, pose: ClawPhysicsPose): void
  /** 离 `(x, z)` 最近、且还在池子里的娃娃。 */
  nearest(x: number, z: number): { index: number; dist: number }
  /** 第 `index` 只娃娃**现在**在哪；越界 / 已掉走返回 `null`。 */
  positionOf(index: number): { x: number; y: number; z: number } | null
  /**
   * 走查脚本用：第 `index` 只的**原始刚体位置**。
   *
   * ⚠️ 和 `positionOf` 的区别只有一个，但很要命：`positionOf` 是**玩法**口径
   *   （掉进通道就返回 `null`，当作「池子里没有它」）；这个照实返回，掉到
   *   −0.6 也给你 −0.6。诊断「它到底掉没掉下去」只能用它。
   */
  rawPositionOf(index: number): { x: number; y: number; z: number } | null
  /**
   * `(x, z)` 正下方最高的那个面（娃娃顶 / 池底）的高度。
   *
   * 页面用它决定「下爪停在哪」—— 原版就是这么做的（`probeSurface()`），
   * 而**不是**停在一个写死的 0.42。差别很直观：对着空地按下去，
   * 写死的高度会让爪子悬在半空合爪；探到池底才会一直压到底。
   *
   * ★ 只认「地板 + 娃娃」，**不认爪子自己**（分组过滤掉了 `G_CLAW`）——
   *   不然爪子越往下，探到的就是自己的指头，永远停不下来。
   */
  surfaceAt(x: number, z: number): number
  /**
   * 第 `index` 只娃娃当前的「挤压量」（>0 压扁，<0 回弹拉长）。
   *
   * ★ **纯视觉**：`clawScene` 拿它做非等比缩放，碰撞体本身不变。
   *   所以探面（`surfaceAt`）、夹取、输赢都读不到这个值 —— 也就不会互相污染。
   */
  squashOf(index: number): number
  /**
   * 第 `index` 只娃娃身上的 3 个**压痕**（局部坐标 + 深度 `w`，0 = 没有）。
   *
   * ★ 和 `squashOf` 一样是**纯视觉**：`clawScene` 把它们喂给顶点着色器。
   *   `w` 已经按 `exp(-12·dt)` 衰减过，指头一松开自己就淡掉。
   */
  dentsOf(index: number): { x: number; y: number; z: number; w: number }[]
  /**
   * 这一刻有几根指头压在 `index` 那只娃娃身上（0~3）。
   *
   * ★ 走查用：证明「捏扁」不是到点就播的动画，而是**真的碰到了**。
   *   同时它也是挤压目标的唯一判据（≥2 才捏），所以不能只报个假数。
   */
  gripCount(index: number): number
  /** 走查脚本用：证明物理**真的在跑**，而不是只把开关打开了。 */
  debug(): {
    bodies: number
    held: boolean
    /** 还醒着的刚体数 —— 全睡了说明模拟已经停了（不是坏事，但要知道） */
    awake: number
    recycled: number
    /** 回收记录（最近 24 条）—— 见 `recycledLog` 的注释 */
    recycledLog: { index: number; x: number; y: number; z: number }[]
    steps: number
    /** 当前所有娃娃里最大的 |挤压量| —— 用来证明「软体手感」不是空操作 */
    maxSquash: number
    /** 当前最深的压痕（0 = 没有任何指头压着）—— 见 `dentsOf` */
    maxDent: number
  }
  dispose(): void
}

export interface ClawPhysicsOpts {
  cabinet: ClawPhysicsCabinet
  /** 每只娃娃的 three Group（位置 / 朝向由物理写回） */
  prizes: Group[]
  /**
   * 每只娃娃的**种类**（和 `prizes` 一一对应）。
   *
   * 碰撞体形状 / 质量 / 「头顶在哪」全部从它推出来 —— 见 `scene/prizeTypes.ts`。
   * ★ 视觉和物理共用同一份数据，才不会出现「看得见的耳朵、摸不到的耳朵」。
   */
  types: PrizeType[]
  /** 爪子的 hub（位置由动画摆，物理只读） */
  hub: Group
  /** 三个指头的**内层** Group（带着开合的旋转） */
  prongs: Group[]
}

/* ============================ 实现 ============================ */

/** three 的 `Quaternion` 在 0.12 的 `Rotation` 结构里就是 `{x,y,z,w}`，直接传。 */
interface V3 {
  x: number
  y: number
  z: number
}

/**
 * 建一个物理世界。
 *
 * 失败就**抛**（让调用方记下原因、退回静态摆放），不要返回半个世界 ——
 * 半个世界比没有更难查。
 */
export async function createClawPhysics(opts: ClawPhysicsOpts): Promise<ClawPhysics> {
  const R: RapierNS = (await import('@dimforge/rapier3d-compat')).default
  await R.init()

  const { cabinet, prizes, types, hub, prongs } = opts
  const { hx, hz, glassH, hole } = cabinet

  /** 放回池子的候选点 —— 由柜子尺寸推，不写死（见 `respawnCandidates()`） */
  const respawnSpots = respawnCandidates(hx, hz, hole)

  const world = new R.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = FIXED_DT
  // 6 次就够：池子里没有堆叠得很高的塔，迭代多了只是白烧 CPU
  world.numSolverIterations = 6

  /* ---------------- 静态：地板（带洞）、四壁、取物通道 ---------------- */

  const staticGroups = groups(G_STATIC, G_PRIZE | G_CLAW)
  const addStatic = (desc: RAPIER.ColliderDesc, x: number, y: number, z: number) => {
    world.createCollider(desc.setTranslation(x, y, z).setFriction(0.9).setCollisionGroups(staticGroups))
  }

  const FLOOR_T = 0.05
  /*
    地板被取物口挖掉一块，所以是**两块**拼起来的（不是一块完整的板）。

    ★★ 这里曾经写错过一次，症状很隐蔽：娃娃一只只**从池底漏下去**，
      然后被 `recycle()` 放回池子、再漏下去 —— 池子一直在动（空转 1.3 秒
      位移 0.64 个世界单位），但**一只都没少**，所以「数量对不对」查不出来。
      走查里那条「池子是静的」断言才是抓它的那个。

    取物口在**右下角**：x ∈ [hole.x0, hole.x1]，z ∈ [hole.z0, hole.z1]。
    所以：
      · 靠后那一条（z < hole.z0）是**整宽**的；
      · 靠前那一条（z > hole.z0）只有**洞口左边**那截。
  */
  /*
    ★★ 2026-10-19：这段改成**按洞的实际位置**拼，不再假设「洞在右下角」。

    原版的取物洞在**左下角**（`HOLE.x0 === -hx`，`z1 === hz`），
    而我们的老代码写死了「洞顶到右边」—— 换成原版尺寸之后，
    那个式子算出来的前半块宽度是 **0**，等于整个前半块没有地板：
    娃娃会一只只从池底漏下去，然后被 `recycle()` 放回来、再漏。
    （这种「数量一直对、池子一直在动」的 bug 只有「池子是静的」那条断言能抓。）

    ➜ 现在三块地板都由洞的边界推：
      · 后半块（z < hole.z0）：整宽；
      · 前半块（z > hole.z0）：洞左边一截 + 洞右边一截（哪边没有就跳过）。
  */
  const holeHalfD = (hole.z1 - hole.z0) / 2
  const frontCz = (hole.z0 + hole.z1) / 2
  // 后半块
  const backDepth = hole.z0 + hz
  if (backDepth > 0.01) {
    addStatic(R.ColliderDesc.cuboid(hx, FLOOR_T, backDepth / 2), 0, -FLOOR_T, -hz + backDepth / 2)
  }
  // 前半块：洞左边
  const leftW = hole.x0 + hx
  if (leftW > 0.01) {
    addStatic(R.ColliderDesc.cuboid(leftW / 2, FLOOR_T, holeHalfD), -hx + leftW / 2, -FLOOR_T, frontCz)
  }
  // 前半块：洞右边
  const rightW = hx - hole.x1
  if (rightW > 0.01) {
    addStatic(R.ColliderDesc.cuboid(rightW / 2, FLOOR_T, holeHalfD), hole.x1 + rightW / 2, -FLOOR_T, frontCz)
  }

  /** 洞口中心（滑道 / 接货盘都以它对齐，只算一次） */
  const cx = (hole.x0 + hole.x1) / 2
  const cz = (hole.z0 + hole.z1) / 2

  /*
    ★★★ 洞口围栏（亚克力挡板）—— **没有它，池子会自己「发奖」**。

    2026-10-18 实测：池子从 52 只加到 96 只（为了堆出两层）之后，
    两局里 **15 只散货**被邻居挤进洞口（`recycled` 单局 +11）。
    这不是显示问题：掉进洞口在**视觉上等于抓到**，而结算其实早就定死了
    —— 于是孩子会看到「明明没夹到，娃娃自己滚进洞里了」。

    参考实现在洞口周围立了一圈高 `0.055` 的挡板（`buildStatic` 里
    "acrylic barrier around the drop hole"）：散货沿着挡板滑过去，
    只有**从上方**放下的娃娃（爪子送进来的）才越过它落进洞里。
    我们原来没有这一圈，是因为以前池子只有一层、娃娃根本挤不到洞口。

    ⚠️ 三面即可：洞口顶在柜子右边（`hole.x1 === hx`）和前面（`hole.z1 === hz`），
      那两面就是柜壁，再立挡板会穿出去。
    ⚠️ 挡板**不能太高**：爪子的指头合拢后从 `hubY - 0.166` 往下探，
      0.055 只有指长的一半，爪子能把娃娃放到洞口正上方再松手。
  */
  {
    const BH = 0.055
    const BT = 0.004
    const holeHalfW = (hole.x1 - hole.x0) / 2
    const holeHalfD = (hole.z1 - hole.z0) / 2
    /*
      ★ 只立**不是柜壁**的那两面。原版的洞顶在左壁和前脸（`x0 === -hx`、`z1 === hz`），
        所以立的是**右沿**（x = hole.x1）和**后沿**（z = hole.z0）。
        写死「后沿 + 左沿」的话，换成原版位置之后右边是敞开的 ——
        散货会从右边滚进洞里，孩子看到「没夹到却自己掉进去了」。
    */
    const EPS = 1e-6
    if (hole.z0 > -hz + EPS) addStatic(R.ColliderDesc.cuboid(holeHalfW, BH, BT), cx, BH, hole.z0 - BT)
    if (hole.z1 < hz - EPS) addStatic(R.ColliderDesc.cuboid(holeHalfW, BH, BT), cx, BH, hole.z1 + BT)
    if (hole.x0 > -hx + EPS) addStatic(R.ColliderDesc.cuboid(BT, BH, holeHalfD), hole.x0 - BT, BH, cz)
    if (hole.x1 < hx - EPS) addStatic(R.ColliderDesc.cuboid(BT, BH, holeHalfD), hole.x1 + BT, BH, cz)
  }

  // 四壁 + 顶（顶是为了不让娃娃被弹飞出去 —— 没有它偶尔会飞出一只）
  const T = 0.02
  addStatic(R.ColliderDesc.cuboid(T, glassH / 2, hz + T), -hx - T, glassH / 2, 0)
  addStatic(R.ColliderDesc.cuboid(T, glassH / 2, hz + T), hx + T, glassH / 2, 0)
  addStatic(R.ColliderDesc.cuboid(hx, glassH / 2, T), 0, glassH / 2, -hz - T)
  addStatic(R.ColliderDesc.cuboid(hx, glassH / 2, T), 0, glassH / 2, hz + T)
  addStatic(R.ColliderDesc.cuboid(hx, T, hz), 0, glassH + T, 0)

  /* ================= 取物通道 ================= */

  /*
    ★★★ 2026-10-18 最重要的一条更正：**通道是一个「封起来的盒子」，不是几条板子。**

    实测（`claw-hole-idle.mjs`，完全不玩、空转 25 秒）：

        起步 recycled=1，空转 25 秒 → 变化 0
        回收记录： #71(-0.45, -37.20, 0.31)

    `y = -37.20` 的意思是那只娃娃**穿过地板掉了 37 米** —— 它根本没碰到滑道。
    成因是：洞是 `x 0.26…0.58 × z 0.06…0.50`，而滑道只有 `x 0.27…0.57`、
    而且只在 `z` 中段 —— 洞的四条边各留了一条**一两厘米的缝**，垂直落下的娃娃
    从缝里钻过去，一路掉到 `CHUTE_Y` 之下才被 `recycle()` 捞回来。

    症状有两层，都很容易被误判：
      · 建池时白白 `recycle()` 一只（池子「自己少了一只又补一只」）；
      · 走查里「没中的那局，夹住的那只掉进通道了」—— 其实那是 `recycle()`
        **把它搬到了通道里**，不是爪子漏了。

    ➜ 现在把工艺反过来：**先按洞的边界造一个封闭盒子**，滑道只是盒子里的一块斜板。
      这样不管娃娃从洞的哪一点落下来，先被接住，再顺着斜面滚出去。
  */
  {
    const GAP = 0.006
    const yTop = -0.02
    const yBot = CHUTE_Y - 0.02
    const bh = (yTop - yBot) / 2
    const by = (yTop + yBot) / 2
    const halfW = (hole.x1 - hole.x0) / 2 + GAP
    const halfD = (hole.z1 - hole.z0) / 2 + GAP
    const panX = (hole.x0 + hole.x1) / 2 + 0.28
    addStatic(R.ColliderDesc.cuboid(halfW, bh, 0.004), cx, by, hole.z0 - 0.004)
    addStatic(R.ColliderDesc.cuboid(0.004, bh, halfD), hole.x0 - 0.004, by, cz)
    addStatic(R.ColliderDesc.cuboid(halfW, bh, 0.004), cx, by, hz + GAP + 0.004)
    addStatic(R.ColliderDesc.cuboid(0.004, bh, halfD), hx + GAP + 0.004, by, cz)
    // 盒底（兜底）：滑道在盒子里，盒底只负责「绝不穿到虚空里」
    addStatic(R.ColliderDesc.cuboid(halfW, 0.004, halfD), cx, yBot, cz)
    // 盒底再往前伸一段，接住从取物口缝隙漏下来的（取物口下面本来就是托盘）
    addStatic(R.ColliderDesc.cuboid(0.16, 0.004, halfD), Math.max(cx, panX), yBot, cz)
  }

  /*
    取物通道：**斜坡滑道，不是竖井**。

    ★★ 2026-10-18 改掉了原来的「方井 + 井底」。

    原来爪子把娃娃送到池子**侧面**的洞口、从池底高度塞下去，娃娃在井里往下掉，
    `CHUTE_Y` 一到就被 `recycle()` 放回池子。孩子看到的是「娃娃在池底消失」。

    参考实现的走法是：爪子移到**取物口正上方**松手 → 娃娃落进**取物口正下方**的
    滑道 → 顺着斜面滚出去 → 从机身正面的取物口里探出来。这就是「抓取后移动到
    出口」的正确样子（用户原话点名的那个问题）。

    ➜ 所以井底换成**朝正面（+z）倾斜的斜坡**：落到斜坡上的娃娃会自己滑向取物窗口，
      而 `recycle()` 仍然按 `CHUTE_Y` 把它收走（账务上的中奖次数不变）。

    ⚠️ 斜坡用**四元数绕 x 轴转 `RAMP_ANG`**。写 `{x: sin(a/2), ...}` 是 three/Rapier
      都认的四元数，但符号写反会让坡朝后倾斜 —— 娃娃会往后墙滚，永远滑不出来。
  */
  /*
    ★★ 2026-10-18 按参考实现重新落位（原来 -0.36 / 半长 0.22，低端比托盘高 0.26
    —— 娃娃顺着斜面滑到底会**悬空掉一段**，看着像掉进虚空）。

    参考实现的关键一句是 *"ramp's lower (front) edge meets the bin floor"*：
    **斜面低端与托盘面平齐**，娃娃是「滑」进窗口的，中间没有落差。
    所以这里用同一条式子算高度：托盘面 + 半厚，再往上抬斜面长度的一半 × sin。
  */
  const RAMP_ANG = 0.5
  const ramp = R.ColliderDesc.cuboid(0.16, 0.01, 0.2).setRotation({
    x: Math.sin(RAMP_ANG / 2),
    y: 0,
    z: 0,
    w: Math.cos(RAMP_ANG / 2),
  })
  const BIN_FLOOR_Y = -0.66
  addStatic(ramp, cx, BIN_FLOOR_Y + 0.096 - 0.004, 0.32 - 0.176)
  addStatic(R.ColliderDesc.cuboid(0.16, 0.01, 0.13), cx, BIN_FLOOR_Y - 0.01, 0.345)

  /* ---------------- 取物口下面的接货盘 ---------------- */

  /*
    娃娃从滑道滚出来之后得**有个东西托住**（不然它会一直往下掉，看起来像掉进虚空）。

    取物口在机身正面：`y ≈ −0.52`、`z ≈ HZ`。这里放一块浅底盘 + 后挡板，
    前面**不封** —— 从正面（相机那一侧）能看见娃娃躺在里面。

    ⚠️ 纯视觉托盘，**不参与输赢**。`recycle()` 到了 `CHUTE_Y` 就把这个娃娃收走了，
      所以托盘上通常什么都没有。真正「告诉孩子到手了」的是页面上的中奖卡片
      （参考实现也一样：`showWin()` 弹一个小转盘渲染图）。
  */
  {
    const BIN_Y = BIN_FLOOR_Y
    const BIN_Z = hz + 0.12
    addStatic(R.ColliderDesc.cuboid(0.16, 0.012, 0.16), cx, BIN_Y - 0.012, BIN_Z) // 盘底
    addStatic(R.ColliderDesc.cuboid(0.16, 0.1, 0.012), cx, BIN_Y + 0.088, BIN_Z - 0.16) // 后挡板
    addStatic(R.ColliderDesc.cuboid(0.012, 0.1, 0.16), cx - 0.16, BIN_Y + 0.088, BIN_Z) // 左挡板
    addStatic(R.ColliderDesc.cuboid(0.012, 0.1, 0.16), cx + 0.16, BIN_Y + 0.088, BIN_Z) // 右挡板
  }

  /* ---------------- 爪子：hub + 三根指头，全是 kinematic ---------------- */

  const clawGroups = groups(G_CLAW, G_STATIC | G_PRIZE)
  const hubBody = world.createRigidBody(
    R.RigidBodyDesc.kinematicPositionBased().setTranslation(hub.position.x, hub.position.y, hub.position.z),
  )
  /*
    hub 用**圆柱**，尺寸和视觉上的那个圆柱完全一致（`HUB_R` / `HUB_HH`）。

    以前这里是一个半径 0.056 的**球** —— 球的底部比圆柱底面低 0.026，
    于是「爪子还没碰到娃娃，先被一个看不见的球顶开」。肉眼看不出来，
    只会觉得「爪子老是差一点点够不着」。
  */
  world.createCollider(
    R.ColliderDesc.cylinder(HUB_HH, HUB_R).setFriction(0.4).setCollisionGroups(clawGroups),
    hubBody,
  )

  const prongBodies = prongs.map(() =>
    // 先摆在 hub 那儿；第一次 `step()` 会用 three 的世界矩阵把它们挪到正确位置。
    // 这里**不**去读 `prong.getWorldPosition()` —— 建场景时 hub 还没被摆过，
    // 读到的是原点，反而更错。
    world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(hub.position.x, hub.position.y, hub.position.z),
    ),
  )
  /*
    每根指头 = **一串**胶囊（`PRONG_PTS` 拆出来的 4 段），不是一根直胶囊。

    ★★ 这是「爪子形状」在物理侧的全部事实。改 `PRONG_PTS` 之后，
      `clawScene` 画的管子和这里的碰撞体**同时**变 —— 因为两边读的是同一份数据。
      抄成两份的症状：看得见钩子、摸到的是直杆（或者反过来，娃娃被一根
      不存在的直杆隔空顶飞）。
  */
  const prongColliders: RAPIER.Collider[] = []
  /**
   * 指头碰撞体 → 第几根指头（0~2）。
   *
   * ★★ 为什么必须分开数：一根指头由 **4 段胶囊**拼出来，一次接触就能产生
   *   好几个接触点。按「接触点 ≥2 就算捏住」判，**一根指头**蹭一下
   *   就能让娃娃整只鼓起来 —— 实测点数能到 11（3 根指头 × 4 段）。
   */
  const colliderProng = new Map<number, number>()
  {
    const UP = { x: 0, y: 1, z: 0 }
    for (let prongIdx = 0; prongIdx < prongBodies.length; prongIdx++) {
      const b = prongBodies[prongIdx]
      for (const s of prongSegments()) {
        const dx = s.b[0] - s.a[0]
        const dy = s.b[1] - s.a[1]
        const dz = s.b[2] - s.a[2]
        const len = Math.hypot(dx, dy, dz)
        const dir = { x: dx / len, y: dy / len, z: dz / len }
        const col = world.createCollider(
          R.ColliderDesc.capsule(len / 2, s.r)
            .setTranslation((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2)
            // capsule 的轴默认是 +Y，转到这一段的方向上
            .setRotation(quatFromUnitVectors(UP, dir))
            .setFriction(1.1)
            .setCollisionGroups(clawGroups),
          b,
        )
        prongColliders.push(col)
        // 一根指头 = 4 段胶囊，压痕/捏合要按**指头**数，不是按段数
        colliderProng.set(col.handle, prongIdx)
      }
    }
  }

  /* ---------------- 娃娃 ---------------- */

  interface PrizeBody {
    body: RAPIER.RigidBody
    /** 交给物理之前的位置 —— 交接的那 0.35 秒从它插值过去 */
    from: V3
    /** 软体手感：挤压位移 / 速度（弹簧），以及上一帧速度（用来识别撞击） */
    squash: number
    squashV: number
    lastSpeed: number
    /**
     * 指头压出来的 3 个**压痕**（娃娃的局部坐标 + 深度），照抄参考实现。
     *
     * ★ 为什么不是「压扁整只」而是压痕：三根指头是**点**接触，
     *   真实的毛绒被捏住时是**接触点凹进去**、旁边的绒鼓出来。
     *   只压扁整只会像个被踩了一脚的球。
     * ★ 纯视觉（着色器里的顶点位移）：`w` 按 `exp(-12·dt)` 自己衰减，
     *   指头一松开就看不见了。碰撞体、探面、输赢都读不到它。
     */
    dents: { x: number; y: number; z: number; w: number }[]
  }

  const newDent = () => ({ x: 0, y: 0, z: 0, w: 0 })

  /**
   * 碰撞体句柄 → 第几只娃娃。
   *
   * ★ 接触对只给「另一个 collider」，不给「那是谁」；而一只娃娃由好几个
   *   球/胶囊拼出来（头、身子、耳朵）。所以压痕必须靠这张表反查，
   *   不能假设「一只娃娃一个碰撞体」。
   */
  const colliderPrize = new Map<number, number>()

  const prizeBodies: PrizeBody[] = prizes.map((g, index) => {
    const scale = g.scale.x || 1
    const body = world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(g.position.x, g.position.y, g.position.z)
        // 朝向沿用 three 里那一份（每只歪一点，看着不像复制粘贴）
        .setRotation({ x: g.quaternion.x, y: g.quaternion.y, z: g.quaternion.z, w: g.quaternion.w })
        .setLinearDamping(0.55)
        .setAngularDamping(1.5)
        .setCcdEnabled(true),
    )
    /*
      按**这只娃娃的种类**建碰撞体（`PRIZE_TYPES[i].parts`）。

      ★ 密度按「质量 / 体积」反推，不是写死一个数：小鸡（0.085 kg）和
        企鹅（0.12 kg）体积差很多，同一个密度会让小鸡轻得像纸片、
        被爪子一碰就飞。原版就是这么算的。
    */
    const type = types[index]
    if (type) {
      let vol = 0
      for (const part of type.parts) {
        vol +=
          part.kind === 'ball'
            ? (4 / 3) * Math.PI * (part.r * scale) ** 3
            : Math.PI * (part.r * scale) ** 2 * (2 * (part.hh ?? 0) * scale + (4 / 3) * part.r * scale)
      }
      const density = vol > 0 ? (type.mass * scale ** 3) / vol : 70
      for (const part of type.parts) {
        const d =
          part.kind === 'ball'
            ? R.ColliderDesc.ball(part.r * scale)
            : R.ColliderDesc.capsule((part.hh ?? 0.02) * scale, part.r * scale)
        const col = world.createCollider(
          d
            .setTranslation(part.p[0] * scale, part.p[1] * scale, part.p[2] * scale)
            .setDensity(density)
            .setFriction(0.85)
            .setRestitution(0.05)
            .setCollisionGroups(groups(G_PRIZE, 0xffff)),
          body,
        )
        // 接触点只给句柄，得能反查「这是第几只」才能算压痕
        colliderPrize.set(col.handle, index)
      }
    }
    return {
      body,
      from: { x: g.position.x, y: g.position.y, z: g.position.z },
      squash: 0,
      squashV: 0,
      lastSpeed: 0,
      dents: [newDent(), newDent(), newDent()],
    }
  })

  /* ---------------- 建池：分波从空中落下，让它们自己堆 ---------------- */

  /*
    ★★★ 2026-10-18 整段重写：原来是把 `clawScene.initialPrizeLayout()` 的手写四层
    直接交给物理，空跑 1.5 秒「把重叠推开」。实测**堆不起来**：
      · 布局写的是四层（y = 0.004 / 0.112 / 0.220 / 0.320），
        但同一层的娃娃是**水平摆**的、相邻间距又大于一只的直径 ⇒ 「层」其实是
        **悬空的**；
      · 一开跑，上面几层同时自由落体砸下去，把下面一层压平 —— 最后变成
        平均 0.133、最高 0.216 的**一层**（`claw-pose.mjs` 量出来的数）。

    参考实现的做法是 `fill(30)`：**分波从空中投放**，每批 6 只、`y = 0.12~0.37`，
    每批之间步进 90 次，最后再沉降 360 次。这样堆是**物理自己长出来的**
    —— 会互相搭着、会靠着墙斜着，正是娃娃机那种「有点乱的堆」。

    ➜ 这里照抄它的**手法**：投放点**铺满整个池底**（不是复用一个固定小表），
      高度 `0.12~0.37`，每只再加一点确定性的位置/朝向扰动。
      扰动很关键：位置完全相同的一摞会精确地叠成一根柱子。

    ★★ 2026-10-19：投放点从「`RESPAWN_SPOTS` 里挑 8 个」改成**照抄原版 `fill()` 的取点公式**：
      `x ∈ [-(hx-0.07), hx-0.07]`、`z ∈ [-(hz-0.07), hz-0.07]`，随机撒、碰到洞口就重抽，
      再往**后 / 右**偏一点（`x*0.9+0.03`、`z*0.9-0.03`）——
      原版注释说是「像一台被玩过一阵的机台」。
      之前复用 8 个固定点，30 只娃娃全落在中间那一条，
      前半边池底空着 —— 一眼就不像原版那个「满池子」。
  */

  /** 确定性伪随机：同一局重放，池子变化完全一样（走查截图不会每次不同）。 */
  const jitter = (n: number) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
    return x - Math.floor(x)
  }

  /** 取一个投放点：铺满池底、避开洞口（洞口位置由 `hole` 决定，不假设在哪个角）。 */
  const fillSpot = (i: number): { x: number; z: number } => {
    const mx = hx - 0.07 // 留半只娃娃，别贴着玻璃
    const mz = hz - 0.07
    let x = 0
    let z = 0
    for (let t = 0; t < 30; t++) {
      x = -mx + jitter(i * 91 + t * 7 + 1) * 2 * mx
      z = -mz + jitter(i * 91 + t * 7 + 2) * 2 * mz
      const inHole =
        x > hole.x0 - 0.08 && x < hole.x1 + 0.08 && z > hole.z0 - 0.08 && z < hole.z1 + 0.08
      if (!inHole) break
    }
    // 原版：往**后 / 右**偏一点，像被玩过一阵的机台
    return { x: x * 0.9 + 0.03, z: z * 0.9 - 0.03 }
  }

  /** 一次投放。`i` 只用于扰动，决定它是「第几只」，不参与任何玩法判定。 */
  const dropOne = (pb: PrizeBody, i: number) => {
    const spot = fillSpot(i)
    // 高度照抄原版 `0.12 + rng()*0.25` —— 别从玻璃顶往下倒
    const y = 0.12 + jitter(i * 3 + 4) * 0.25
    const turn = jitter(i * 3 + 3) * Math.PI * 2
    pb.body.setTranslation({ x: spot.x, y, z: spot.z }, true)
    pb.body.setRotation({ x: 0, y: Math.sin(turn / 2), z: 0, w: Math.cos(turn / 2) }, true)
    pb.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    pb.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    pb.from = { x: spot.x, y, z: spot.z }
  }

  /*
    ★ 投放高度由 `dropOne()` 自己算（`0.12~0.37`），**不再按波次递增**。
      别一上来就放到接近玻璃顶（1.2）：落下来的速度太快，会把下面压塌成一层，
      而且第一帧看起来像「有人往柜子里倒娃娃」。
    ⚠️ 别调成「只放一波、全部同高」—— 同一高度同一点投放必然叠成柱。
  */
  const WAVE = 6
  for (let i = 0; i < prizeBodies.length; i += WAVE) {
    for (let j = 0; j < WAVE && i + j < prizeBodies.length; j++) {
      dropOne(prizeBodies[i + j], i + j)
    }
    // 每波之间让它落稳（60Hz × 0.75s，等价于原版的 90 × 1/120）
    for (let k = 0; k < 45; k++) world.step()
  }
  /*
    最后再沉降 4 秒。

    ★ 这一步**不能省**，也不能短。2026-10-18 三次数值：
      · 90 步（1.5 秒）：截图里还有两只娃娃卡在半空（被邻居架住）；
      · 155 步（2.6 秒）：走查「空转 1.3 秒后池子是静的」仍然红，
        最大位移 **0.906** —— 说明那 1.3 秒里还有娃娃在掉，池子没静下来；
      · 240 步（4 秒）：目标是把所有娃娃落到**静止**（`sleep`）为止。
    ⚠️ 判据不能只看「建世界花多久」：这 4 秒是同步空跑，约 30~50ms，
      在物理 chunk 加载完之后才跑，玩家看不到。
    ⚠️ 如果以后又加娃娃（>120 只），这里还得加长 —— 判据是走查那条
      「空转 1.3 秒后最大位移 < 0.05」，不是这里写了多少步。
  */
  for (let i = 0; i < 240; i++) world.step()

  /* ---------------- 状态 ---------------- */

  let accumulator = 0
  let steps = 0
  let recycled = 0
  /**
   * 回收记录：**哪一只、从哪儿掉下去的**（只留最近 24 条）。
   *
   * ★ 为什么光有 `recycled` 这个数字不够：它把两件事混成了一个数 ——
   *   ①「这一局夹住的那只被送进通道」（中奖的正常表现）
   *   ②「池子里有散货被挤进洞」（洞就在池底，娃娃互相挤会掉进去）
   *   实测一次 `recycled +2` 花半小时写探针才分清是哪一种。
   *   记下下标之后，走查脚本可以直接断言
   *   「**手里那只**掉没掉下去」，而不是「总数对不对」。
   */
  let recycledLog: { index: number; x: number; y: number; z: number }[] = []
  let heldIndex: number | null = null
  /**
   * 握持的相对位置：抓的那一刻娃娃在 hub 本地坐标里的位置，以及当时的 hub 高度。
   *
   * ★ 见 `GRIP_SETTLE_RISE`：抬升过程中从这个相对位置**过渡**到 `GRIP_HANG_Y`，
   *   而不是一夹住就摆到吊正的位置（那会把娃娃塞进池底）。
   */
  let gripRel = { x: 0, y: 0, z: 0 }
  let gripHubY = 0
  /**
   * 抓的那一刻娃娃的姿势。抬升过程中从它 slerp 到「正着」（单位四元数）。
   *
   * ★ 不 slerp 的话，堆里躺着的娃娃会**躺着**被吊上来（实测截图：整只横过来，
   *   像被拎着耳朵），而且看上去和钩子完全没接触。
   */
  let gripQuat = { x: 0, y: 0, z: 0, w: 1 }
  /** 上一帧爪子在哪 —— 用来算爪子速度（握持前馈）。 */
  let lastHub = { x: 0, y: 0, z: 0 }
  /** 交接插值：0 → 1，走完 0.35 秒。防止「物理一接管，整池娃娃瞬移」。 */
  let handover = 0
  let disposed = false

  /* ---------------- 夹住 / 松开 ---------------- */

  /**
   * 指头碰撞体的开关。
   *
   * ★★ 为什么「拿着娃娃」和「刚松手」这两段都必须**关着**：
   *
   *   拿着的时候关，是为了让握持**独占**这只娃娃（开着的话合爪会把娃娃往外顶）。
   *
   *   刚松手的时候也必须关 —— 这一条是 2026-10-18 踩出来的：
   *   时间线里 `release` 只占 0.5 秒，`held` 在它一半的时候就变 null 了，
   *   而那一刻指头**还半合着**（`close ≈ 0.5`），娃娃正好卡在三个钩子中间。
   *   这时候把碰撞体打开 = 三根钩子同时顶它一下，娃娃被顶出洞口、
   *   落回池子里 ⇒ **中奖了但没掉进通道**。
   *   症状是 `e2e-claw-physics` 那条「掉进通道的娃娃数 == 中奖次数」变红，
   *   而画面上看起来只是「这次没夹稳」—— 很容易被当成手感问题去调参数。
   *
   *   ➜ 所以恢复碰撞要**等到指头张到快全开**（见 `step()` 里的 `pendingProngsOn`）。
   */
  let pendingProngsOn = false

  function setProngColliders(on: boolean): void {
    for (const c of prongColliders) c.setEnabled(on)
  }

  function releaseGrip(): void {
    /*
      ★ 松手之后 `heldIndex` 变成 null，但「这只**就是**这局中奖的那只」这件事
        要一直记着 —— 它要留在取物窗口里当证据（`WIN_HOLD`）。
        所以另存一份 `winIndex`，只有**下一次开抓**才会被覆盖。
    */
    if (heldIndex !== null) winIndex = heldIndex
    heldIndex = null
    winHold = 0
    // 不在这里 `setProngColliders(true)` —— 见上面 `pendingProngsOn` 的注释
    pendingProngsOn = true
  }

  function grab(index: number, pose: ClawPhysicsPose): void {
    const pb = prizeBodies[index]
    if (!pb) return
    heldIndex = index
    pendingProngsOn = false
    // 拿着的时候，指头和娃娃不再碰：握持已经把它固定住了，
    // 再让指头挤它，solver 会把娃娃往外顶（看着像夹不住）
    setProngColliders(false)

    /*
      ★★ 握持是**软约束**（每步把速度朝目标推），不是铰。三段都是 2026-10-18 实测的：

      ① **球铰锁不住姿势**。球铰只让「两个点」重合，娃娃还能绕那个点**自由转**。
         实测：锚点已经夹到离轴线 0.05 以内了，提到半空时娃娃原点仍然在
         `dx=0.169 / dz=-0.132` —— 它不是被挪开的，是**转开**的（原点绕着头顶
         那个锚点摆出去了），画面上像粘在爪子的肩膀上。
      ② **固定铰又会把娃娃塞进池底**。爪子是扎进娃娃堆里合的爪，抓的那一刻
         hub 常常只比池底高 0.2，而「吊在下面」要低 0.307 —— 位置被锁死的话，
         那一帧娃娃直接进地板，然后被接触推出来，`合爪` 的截图里它根本不在钩子里。
      ③ 所以抓的那一刻**只记相对位置**（跟着爪子刚性上升），抬到
         `GRIP_SETTLE_RISE` 之后才过渡到「吊正」。水平方向同时夹到
         `GRIP_MAX_OFFSET` 以内 —— 指头扫进堆里会把娃娃推开（实测 0.16），
         不夹的话它一直吊在爪子**侧面**。
    */
    const p = pb.body.translation()
    gripRel = {
      x: Math.max(-GRIP_MAX_OFFSET, Math.min(GRIP_MAX_OFFSET, p.x - pose.clawX)),
      y: p.y - pose.hubY,
      z: Math.max(-GRIP_MAX_OFFSET, Math.min(GRIP_MAX_OFFSET, p.z - pose.clawZ)),
    }
    gripHubY = pose.hubY
    gripQuat = pb.body.rotation()
  }

  /* ---------------- 掉进通道就放回池子 ---------------- */

  /**
   * 通道里那只既然「到手了」，就**得在取物窗口里被看见**。
   *
   * ★★ 2026-10-18：这是用户那句「抓取后移动到出口位置有问题」的最后一块。
   *   原来 `recycle()` 在 `CHUTE_Y`（−0.58）就把它搬回池子，而托盘面在 −0.66
   *   —— **托盘永远是空的**。孩子看到的是：娃娃滑到窗口边上、然后凭空消失。
   *   参考实现不是这样：中奖的那只**躺在窗口里**，家长按「拿走」它才滑出去
   *   （`takePrizes()`，0.45 秒缩没）。
   *
   *   ➜ 放进窗口的那只（= `heldIndex`，也就是这局中奖的那只）先**不动**；
   *     等它真的落到托盘面上（`BIN_FLOOR_Y - 0.04` 以下）再过 `WIN_HOLD` 秒
   *     才搬走。搬走的那一刻 `recycled` 才 +1，走查「这局少了一只」的账不变。
   *
   * ⚠️ 计时放在物理层（用 `world.step()` 累加）而不是页面层：
   *    走查是直接调 `step()` 的，用 `performance.now()` 的话「快进」会让它永远不触发。
   */
  const WIN_HOLD = 1.6
  let winHold = 0
  /**
   * 「这局到手的那只」—— 松爪之后仍然记着（`heldIndex` 会变 null）。
   * 它要在取物窗口里躺 `WIN_HOLD` 秒再被搬回池子，否则托盘永远是空的。
   */
  let winIndex: number | null = null

  function pickRespawnSpot(skip: number): { x: number; z: number } {
    let best: { x: number; z: number } = respawnSpots[0]
    let bestScore = -Infinity
    for (let k = 0; k < respawnSpots.length; k++) {
      const s = respawnSpots[(k + recycled) % respawnSpots.length]
      // 离洞口越远越好（**点到矩形**的距离，不假设洞在哪个角）
      const dx = Math.max(0, Math.max(hole.x0 - s.x, s.x - hole.x1))
      const dz = Math.max(0, Math.max(hole.z0 - s.z, s.z - hole.z1))
      let score = Math.hypot(dx, dz)
      // 被占得越多越差：8 cm 以内每只扣 0.05
      for (let j = 0; j < prizeBodies.length; j++) {
        if (j === skip) continue
        const q = prizeBodies[j].body.translation()
        if (Math.abs(q.x - s.x) + Math.abs(q.z - s.z) < 0.08) score -= 0.05
      }
      if (score > bestScore) {
        bestScore = score
        best = s
      }
    }
    return best
  }

  function recycle(dt: number): void {
    /* 中奖的那只已经躺在窗口里了？开始计时（只有**松过爪**的那只算） */
    if (winIndex !== null) {
      const p = prizeBodies[winIndex]?.body.translation()
      if (p && p.y <= BIN_FLOOR_Y + 0.06) winHold += dt
    }
    const winDone = winIndex !== null && winHold >= WIN_HOLD

    for (let i = 0; i < prizeBodies.length; i++) {
      if (i === heldIndex) continue
      const pb = prizeBodies[i]
      const p = pb.body.translation()
      /* ★ 中奖的那只**留在取物窗口里**，别急着搬走（见 `WIN_HOLD`） */
      if (i === winIndex && !winDone) continue
      if (p.y > CHUTE_Y) continue
      const spot = pickRespawnSpot(i)
      recycled++
      recycledLog.push({ index: i, x: p.x, y: p.y, z: p.z })
      if (recycledLog.length > 24) recycledLog.shift()
      pb.body.setTranslation({ x: spot.x, y: RESPAWN_Y, z: spot.z }, true)
      pb.body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      pb.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
      // 重生的那只不参与交接插值（不然会从池底「飞」回来）
      pb.from = { x: spot.x, y: RESPAWN_Y, z: spot.z }
    }
  }

  /* ---------------- 每帧 ---------------- */

  /**
   * 把夹住的那只往「它该在的位置」推（每个物理子步都推一次）。
   *
   * 目标 = 从 `gripRel`（抓的那一刻的相对位置）**过渡**到 `GRIP_HANG_Y`（吊正），
   * 过渡量按爪子**抬了多少**算（`GRIP_SETTLE_RISE`）。于是：
   *   · 刚合爪：目标和它现在的位置重合 ⇒ 一动不动（不会塞进池底）；
   *   · 抬起来：目标越来越低 ⇒ 它相对爪子往下沉，最后正好吊在钩子下面。
   *
   * ★ 只改**速度**、不 `setTranslation`：这样接触还能拦住它（娃娃被别的娃娃
   *   压着的时候不会穿过去），而且松手之后它就是「带着这点速度往下掉」，
   *   不需要额外的交接。
   */
  function driveHeld(pose: ClawPhysicsPose, hubV: { x: number; y: number; z: number }): void {
    if (heldIndex === null) return
    const pb = prizeBodies[heldIndex]
    if (!pb) return

    // 抬升进度 0 → 1，用 smoothstep 免得起点/终点有速度突变
    const w = Math.max(0, Math.min(1, (pose.hubY - gripHubY) / GRIP_SETTLE_RISE))
    const k = w * w * (3 - 2 * w)
    const relY = gripRel.y + (hangYOf(heldIndex, types, prizes) - gripRel.y) * k
    const relX = gripRel.x * (1 - k)
    const relZ = gripRel.z * (1 - k)
    // 爪子还扎在堆里的时候，吊在下面会插进池底 ⇒ 至少让它贴着池底
    const ty = Math.max(pose.hubY + relY, GRIP_FLOOR_Y)

    const p = pb.body.translation()
    /*
      ★ 前馈（`hubV * k`）：光有 P 项的话，爪子在以 0.8/s 抬升时娃娃会**稳定地**
        落后 `0.8 / GRIP_FOLLOW = 0.05` —— 实测截图里钩子和娃娃之间一道明显的缝，
        看着像根本没夹到它。加上前馈，误差项只需要修「初始偏差」，抬升过程中
        娃娃和爪子**同速**走。
      ★ 乘 `k` 是为了抓住那一刻不前馈：那一帧 hub 正在往下扎（≈ −1/s），
        前馈会把娃娃往池底按。
    */
    let vx = (pose.clawX + relX - p.x) * GRIP_FOLLOW + hubV.x * k
    let vy = (ty - p.y) * GRIP_FOLLOW + hubV.y * k
    let vz = (pose.clawZ + relZ - p.z) * GRIP_FOLLOW + hubV.z * k
    const sp = Math.hypot(vx, vy, vz)
    if (sp > GRIP_MAX_SPEED) {
      const s = GRIP_MAX_SPEED / sp
      vx *= s
      vy *= s
      vz *= s
    }
    pb.body.setLinvel({ x: vx, y: vy, z: vz }, true)
    // 被夹住就不许转：爪子是硬的，娃娃在钩子里不会自己翻滚
    pb.body.setAngvel({ x: 0, y: 0, z: 0 }, true)
    // 姿势跟着抬升进度正过来（躺着被吊上来像被拎着耳朵）
    if (k > 0) pb.body.setRotation(slerpQuat(gripQuat, UPRIGHT, k), true)
  }

  /*
    ---- 指头压出来的手感（挤压 + 压痕） ----

    ★ 这两个数是**视觉**的：`-0.07` 直接抄原版，`0.012` 是压痕最深值。
      为什么不能凭感觉调大：`uSquash` 是沿轴拉长 + 垂直收缩，
      0.07 大约 7% / 3.9%，再大就变成「橡皮泥」了。
  */
  const GRIP_SQUASH = -0.07
  const DENT_MAX = 0.012
  const DENT_RADIUS = 0.015
  /** 第几只娃娃身上有哪些指头接触点（世界坐标 + 冲量 + 是第几根指头） */
  const prongContacts = new Map<number, { x: number; y: number; z: number; imp: number; prong: number }[]>()

  /** 有**几根指头**压在这只娃娃身上（0~3）—— 不是接触点数，见 `colliderProng`。 */
  function prongCountOf(arr: { prong: number }[] | undefined): number {
    if (!arr || !arr.length) return 0
    let mask = 0
    for (const c of arr) mask |= 1 << c.prong
    let n = 0
    for (; mask; mask >>= 1) n += mask & 1
    return n
  }

  /** 单位四元数旋转一个向量（逆旋转就是传共轭）。不 import three —— 见文件头。 */
  function rotateByQuat(x: number, y: number, z: number, q: { x: number; y: number; z: number; w: number }): V3 {
    const tx = 2 * (q.y * z - q.z * y)
    const ty = 2 * (q.z * x - q.x * z)
    const tz = 2 * (q.x * y - q.y * x)
    return {
      x: x + q.w * tx + (q.y * tz - q.z * ty),
      y: y + q.w * ty + (q.z * tx - q.x * tz),
      z: z + q.w * tz + (q.x * ty - q.y * tx),
    }
  }

  /**
   * 把「指头 ↔ 娃娃」的接触点收一遍（照抄原版 `gatherProngContacts`）。
   *
   * ★ 为什么用真接触而不是「指头离娃娃多近」：距离判据分不出
   *   「轻轻碰到」和「使劲捏着」，压痕深度就没有依据；而且爪子在池子里
   *   扫过一堆娃娃时，距离判据会给**没被夹住**的那些也画上压痕。
   */
  function gatherProngContacts(): void {
    prongContacts.clear()
    for (const c of prongColliders) {
      const prong = colliderProng.get(c.handle) ?? 0
      world.contactPairsWith(c, (other) => {
        const idx = colliderPrize.get(other.handle)
        if (idx === undefined) return
        world.contactPair(c, other, (m) => {
          const n = m.numSolverContacts()
          if (!n) return
          let imp = 0
          for (let i = 0; i < n; i++) imp += m.contactImpulse(i)
          for (let i = 0; i < n; i++) {
            const pt = m.solverContactPoint(i)
            if (!pt) continue
            let arr = prongContacts.get(idx)
            if (!arr) {
              arr = []
              prongContacts.set(idx, arr)
            }
            arr.push({ x: pt.x, y: pt.y, z: pt.z, imp: imp / n, prong })
          }
        })
      })
    }
  }

  /**
   * 压痕：接触点换算到娃娃的**局部坐标**，写进 3 个槽位，按 `exp(-12·dt)` 衰减。
   *
   * 换算是必须的：着色器里的 `transformed` 是模型局部坐标（而且**没乘** Group 的
   * 缩放），拿世界坐标直接当局部坐标用，压痕会出现在完全不相干的位置 ——
   * 症状是「娃娃身上随机某个地方凹一下」，很难联想到坐标没换算。
   */
  function driveDents(pb: PrizeBody, index: number, cs: { x: number; y: number; z: number; imp: number }[] | undefined, dt: number): void {
    const dents = pb.dents
    const decay = Math.exp(-12 * dt)
    for (const d of dents) {
      d.w *= decay
      // 衰减到「看不出来」就归零：着色器里 `uDent[i].w <= 0` 会整段跳过，
      // 留着 1e-15 的残渣只是白算三次 normalize
      if (d.w < 1e-5) d.w = 0
    }
    if (!cs || !cs.length) return
    const tr = pb.body.translation()
    const rq = pb.body.rotation()
    // 共轭 = 逆旋转（单位四元数）
    const inv = { x: -rq.x, y: -rq.y, z: -rq.z, w: rq.w }
    const sc = prizes[index]?.scale.x || 1
    let n = 0
    for (const c of cs) {
      if (n >= 3) break
      const l = rotateByQuat(c.x - tr.x, c.y - tr.y, c.z - tr.z, inv)
      const lx = l.x / sc
      const ly = l.y / sc
      const lz = l.z / sc
      let dup = false
      for (let j = 0; j < n; j++) {
        if (Math.hypot(dents[j].x - lx, dents[j].y - ly, dents[j].z - lz) < DENT_RADIUS) dup = true
      }
      if (dup) continue
      const slot = dents[n]
      const w = Math.min(DENT_MAX, 0.004 + c.imp * 0.6)
      slot.x = lx
      slot.y = ly
      slot.z = lz
      slot.w = Math.max(slot.w, w)
      n++
    }
  }

  function step(dt: number, pose: ClawPhysicsPose): void {
    if (disposed) return

    /* ① 爪子跟着动画走（kinematic 的位置是「下一帧要去的地方」） */
    hubBody.setNextKinematicTranslation({ x: pose.clawX, y: pose.hubY, z: pose.clawZ })
    hubBody.setNextKinematicRotation(pose.rot ?? { x: 0, y: 0, z: 0, w: 1 })

    // 指头的世界位姿直接读 three —— 开合角度的唯一事实源是 `applyClose()`
    for (let i = 0; i < prongBodies.length; i++) {
      const m = prongs[i].matrixWorld
      prongBodies[i].setNextKinematicTranslation({ x: m.elements[12], y: m.elements[13], z: m.elements[14] })
      // 从旋转矩阵取四元数（three 的 matrixWorld 是列主序）
      const q = quatFromMatrix(m.elements)
      prongBodies[i].setNextKinematicRotation(q)
    }

    /* ② 手里那只变了就换握 */
    const want = pose.held
    if (want !== heldIndex) {
      if (heldIndex !== null) releaseGrip()
      if (want !== null) grab(want, pose)
    }
    // 松手之后、指头张到快全开才恢复碰撞（见 `pendingProngsOn` 的注释）。
    // 0.1：`release` 段末尾 `close` 走到 0，这里留一点余量，避免卡在边界上。
    if (pendingProngsOn && pose.close < 0.1) {
      setProngColliders(true)
      pendingProngsOn = false
    }

    /* ③ 推进（固定步长 + 补步上限） */
    /*
      爪子这一帧的速度 —— 握持的前馈项用（见 `driveHeld()`）。
      夹 ±6 是为了挡住「切后台回来 dt 很小」那种尖峰。
    */
    const hubV = { x: 0, y: 0, z: 0 }
    if (dt > 1e-4) {
      const inv = 1 / dt
      const clamp6 = (v: number) => Math.max(-6, Math.min(6, v))
      hubV.x = clamp6((pose.clawX - lastHub.x) * inv)
      hubV.y = clamp6((pose.hubY - lastHub.y) * inv)
      hubV.z = clamp6((pose.clawZ - lastHub.z) * inv)
    }
    lastHub = { x: pose.clawX, y: pose.hubY, z: pose.clawZ }

    accumulator += Math.min(dt, 0.25)
    let n = 0
    while (accumulator >= FIXED_DT && n < MAX_STEPS) {
      driveHeld(pose, hubV)
      world.step()
      accumulator -= FIXED_DT
      steps++
      n++
    }
    // 补不完的丢掉（切后台回来时不要试图追回几秒钟）
    if (n === MAX_STEPS) accumulator = 0

    recycle(dt)

    /*
      软体手感：撞击（速度骤降）→ 弹簧挤压。和参考实现同一条路
      （`squashV += min(6, dv*4)`，再跑一个 `-900*x - 16*v` 的弹簧）。
      ★ 只改视觉缩放，不改碰撞体 —— 探面和输赢都读不到它，不会互相污染。
    */
    gatherProngContacts()
    for (let i = 0; i < prizeBodies.length; i++) {
      const pb = prizeBodies[i]
      const lv = pb.body.linvel()
      const sp = Math.hypot(lv.x, lv.y, lv.z)
      const dv = pb.lastSpeed - sp
      pb.lastSpeed = sp
      if (dv > 0.3) pb.squashV += Math.min(6, dv * 4)
      /*
        ★★ 挤压目标由**接触**决定，不是由 `held` 决定（2026-10-20 照抄原版）。

        原版是 `cs.length >= 2 ? -0.07 : 0`：两根以上指头压上来就捏住。
        我们之前写的是 `held ? +0.08 : 0`，方向是**反的** ——
        被捏住时应该是「横向被挤、沿自由轴鼓出来」，不是「压扁」。

        符号约定（见 `plush.ts` 的顶点着色器）：`uSquash.w > 0` 沿轴压扁，
        `< 0` 沿轴拉长、垂直方向收缩。指头从三个方向夹住 ⇒ 自由轴是**上**，
        所以被夹住要**负**值。
      */
      const cs = prongContacts.get(i)
      const grip = prongCountOf(cs) >= 2 ? GRIP_SQUASH : 0
      /*
        ★★ 弹簧分小步积分（`softStep` 内部做，见那个文件的注释）。
          直接一帧一积分的话，headless 的 5~10 fps 会让它发散 ——
          `squash` 在 +0.25 / −0.20 之间跳，娃娃一帧胖一帧瘦。
      */
      softStep(pb, grip, dt)
      driveDents(pb, i, cs, dt)
    }

    /* ④ 写回 three */
    if (handover < 1) handover = Math.min(1, handover + dt / 0.35)
    const k = handover * handover * (3 - 2 * handover) // smoothstep
    for (let i = 0; i < prizeBodies.length; i++) {
      const pb = prizeBodies[i]
      const p = pb.body.translation()
      const q = pb.body.rotation()
      const g = prizes[i]
      if (k < 1) {
        g.position.set(
          pb.from.x + (p.x - pb.from.x) * k,
          pb.from.y + (p.y - pb.from.y) * k,
          pb.from.z + (p.z - pb.from.z) * k,
        )
      } else {
        g.position.set(p.x, p.y, p.z)
      }
      g.quaternion.set(q.x, q.y, q.z, q.w)
    }
  }

  /* ---------------- 查询 ---------------- */

  function nearest(x: number, z: number): { index: number; dist: number } {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < prizeBodies.length; i++) {
      const p = prizeBodies[i].body.translation()
      // 已经掉进通道的不算 —— 问的是「池子里底下有没有东西」
      if (p.y < CHUTE_Y) continue
      const d = Math.hypot(p.x - x, p.z - z)
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return { index: best, dist: bestD }
  }

  function rawPositionOf(index: number): { x: number; y: number; z: number } | null {
    const pb = prizeBodies[index]
    if (!pb) return null
    const p = pb.body.translation()
    return { x: p.x, y: p.y, z: p.z }
  }

  function positionOf(index: number): { x: number; y: number; z: number } | null {
    const pb = prizeBodies[index]
    if (!pb) return null
    const p = pb.body.translation()
    if (p.y < CHUTE_Y) return null
    return { x: p.x, y: p.y, z: p.z }
  }

  /**
   * 从上往下打一条射线，只认「地板 + 娃娃」。
   *
   * 起点取**玻璃顶**（而不是 hub 底下）：这样返回值只跟池子有关，
   * 跟爪子当前在哪无关 —— 同一帧里先探高度再算爪子位置，不会自我递归。
   */
  const SURFACE_FILTER = groups(0xffff, G_STATIC | G_PRIZE)
  const DOWN = { x: 0, y: -1, z: 0 }

  function surfaceAt(x: number, z: number): number {
    const originY = glassH - 0.01
    const ray = new R.Ray({ x, y: originY, z }, DOWN)
    // `solid = true`：起点恰好落在某个碰撞体里时也算命中（不至于穿过去）
    const hit = world.castRay(ray, glassH + 1, true, undefined, SURFACE_FILTER)
    if (!hit) return 0
    // ⚠️ 这个版本的 Rapier 字段叫 `toi`，不叫 `timeOfImpact`（原版是更新的版本）。
    // 方向是单位向量 ⇒ `toi` 就是距离。
    return Math.max(0, originY - hit.toi)
  }

  function debug() {
    let awake = 0
    let maxSquash = 0
    let maxDent = 0
    for (const pb of prizeBodies) {
      if (!pb.body.isSleeping()) awake++
      const a = Math.abs(pb.squash)
      if (a > maxSquash) maxSquash = a
      for (const d of pb.dents) if (d.w > maxDent) maxDent = d.w
    }
    return {
      bodies: prizeBodies.length,
      held: heldIndex !== null,
      awake,
      recycled,
      recycledLog: recycledLog.slice(),
      steps,
      maxSquash,
      /** 全场最深的压痕 —— 证明「捏出手印」真的发生了（不是只有代码路径） */
      maxDent,
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    releaseGrip()
    world.free()
  }

  const squashOf = (index: number): number => prizeBodies[index]?.squash ?? 0
  const dentsOf = (index: number) => prizeBodies[index]?.dents ?? []
  const gripCount = (index: number): number => prongCountOf(prongContacts.get(index))

  return { step, nearest, positionOf, rawPositionOf, surfaceAt, squashOf, dentsOf, gripCount, debug, dispose }
}

/* ============================ 小工具 ============================ */

/**
 * 把单位向量 `a` 转到单位向量 `b` 的最短旋转（四元数）。
 *
 * 给胶囊定向用：Rapier 的 capsule 轴固定是 +Y，而指头每一段的方向都不一样。
 *
 * ★ `r < 1e-6` 那一支是**反平行**（a 和 b 正好相反）的退化情况 ——
 *   此时叉积是零向量，`l` 会变成 0，直接除就是 NaN，而 Rapier 拿到 NaN
 *   四元数不会报错，只会让那个碰撞体**静默消失**。必须挑一条垂直轴兜住。
 */
function quatFromUnitVectors(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): { x: number; y: number; z: number; w: number } {
  let r = a.x * b.x + a.y * b.y + a.z * b.z + 1
  let x: number
  let y: number
  let z: number
  if (r < 1e-6) {
    r = 0
    if (Math.abs(a.x) > Math.abs(a.z)) {
      x = -a.y
      y = a.x
      z = 0
    } else {
      x = 0
      y = -a.z
      z = a.y
    }
  } else {
    x = a.y * b.z - a.z * b.y
    y = a.z * b.x - a.x * b.z
    z = a.x * b.y - a.y * b.x
  }
  const l = Math.hypot(x, y, z, r)
  return { x: x / l, y: y / l, z: z / l, w: r / l }
}

/**
 * 四元数球面插值：`t=0` → `a`，`t=1` → `b`。
 *
 * 给「被夹住的娃娃慢慢正过来」用（见 `driveHeld()`）。
 *
 * ★ 自己写而不是用 three 的 `Quaternion.slerp`：这个文件只 import 了 three 的
 *   **类型**（物理层不碰渲染），为了一个插值把 three 的运行时拉进来不值当。
 * ★★ `cos < 0` 那一支不能省：两个四元数点积为负说明它们表示**同一姿势的
 *   反向**（q 和 −q 等价）。不翻符号的话插值会走「长的那一圈」——
 *   娃娃会在半空里转 300° 才正过来，而且看不出来是哪行代码干的。
 */
function slerpQuat(
  a: { x: number; y: number; z: number; w: number },
  b: { x: number; y: number; z: number; w: number },
  t: number,
): { x: number; y: number; z: number; w: number } {
  let cos = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w
  let bx = b.x
  let by = b.y
  let bz = b.z
  let bw = b.w
  if (cos < 0) {
    cos = -cos
    bx = -bx
    by = -by
    bz = -bz
    bw = -bw
  }
  if (cos > 0.9995) {
    // 几乎重合：`sin(θ)` 趋于 0，除不了 ⇒ 线性插值再归一化
    const x = a.x + (bx - a.x) * t
    const y = a.y + (by - a.y) * t
    const z = a.z + (bz - a.z) * t
    const w = a.w + (bw - a.w) * t
    const l = Math.hypot(x, y, z, w) || 1
    return { x: x / l, y: y / l, z: z / l, w: w / l }
  }
  const th = Math.acos(cos)
  const s = Math.sin(th)
  const wa = Math.sin((1 - t) * th) / s
  const wb = Math.sin(t * th) / s
  return { x: a.x * wa + bx * wb, y: a.y * wa + by * wb, z: a.z * wa + bz * wb, w: a.w * wa + bw * wb }
}

/**
 * 从 three 的 4×4 世界矩阵（列主序 `elements`）里取出旋转四元数。
 *
 * 为什么不直接 `prong.getWorldQuaternion()`：那要 import three 的 `Quaternion`
 * 并新建对象，而这是**每帧 3 次**的热路径。这里只做 6 个加法/乘法。
 */
function quatFromMatrix(e: ArrayLike<number>): { x: number; y: number; z: number; w: number } {
  const m11 = e[0], m12 = e[4], m13 = e[8]
  const m21 = e[1], m22 = e[5], m23 = e[9]
  const m31 = e[2], m32 = e[6], m33 = e[10]
  const trace = m11 + m22 + m33
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1)
    return { x: (m32 - m23) * s, y: (m13 - m31) * s, z: (m21 - m12) * s, w: 0.25 / s }
  }
  if (m11 > m22 && m11 > m33) {
    const s = 2 * Math.sqrt(1 + m11 - m22 - m33)
    return { x: 0.25 * s, y: (m12 + m21) / s, z: (m13 + m31) / s, w: (m32 - m23) / s }
  }
  if (m22 > m33) {
    const s = 2 * Math.sqrt(1 + m22 - m11 - m33)
    return { x: (m12 + m21) / s, y: 0.25 * s, z: (m23 + m32) / s, w: (m13 - m31) / s }
  }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22)
  return { x: (m13 + m31) / s, y: (m23 + m32) / s, z: 0.25 * s, w: (m21 - m12) / s }
}
