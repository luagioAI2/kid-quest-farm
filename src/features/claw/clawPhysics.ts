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
 * 只是自己不会被推开。夹住用的是一个显式球铰（`JointData.spherical`），
 * 松手就是拆掉那个铰。看着和原版一样，但「掉不掉」是时间线说的。
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
 * 一只娃娃由 3 个球拼成：身子一个大的、两只耳朵各一个小的。
 *
 * 为什么不是「一个球」：一个球会**滚**。娃娃在池子里滚来滚去不像毛绒玩具，
 * 而且滚起来之后 `nearestPrize` 会一直变。三个球拼出来的轮廓是扁的、带凸起，
 * 摩擦力一咬就停住，像真的堆在那。
 *
 * 数值对着 `clawScene.makePlush()` 的几何抄：身子球 r=0.075 压在 y=0.066，
 * 耳朵 r=0.03 在 (±0.048, 0.13)。
 */
const PRIZE_PARTS = [
  { r: 0.072, x: 0, y: 0.066, z: 0 },
  { r: 0.028, x: -0.048, y: 0.128, z: -0.004 },
  { r: 0.028, x: 0.048, y: 0.128, z: -0.004 },
] as const

/** 一只娃娃大约 0.12 kg（真毛绒玩具的量级）。按体积反推密度。 */
const PRIZE_DENSITY = 70

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
 * 指头的两个极限角度（绕**径向轴**的切向轴转，弧度）。
 *
 * 待命 = 0.8（几乎全张），下爪张到 0.95，合拢 −0.32 ⇒ 扫过 **1.27 rad ≈ 73°**。
 * 老实现是 0 → −0.28，只扫 16°，远看完全看不出在抓。
 *
 * ★★ 待命为什么是 0.8 而不是原版那个 `ANG_IDLE = 0.32`：
 *   原版的指头是**动态刚体 + 力控电机**，待命时给的最大力矩只有 0.25 ——
 *   顶不住指头自己的重量，所以它是**挂在重力里张开的**，实际停在 ≈0.9 附近。
 *   `ANG_IDLE = 0.32` 在那个实现里只是「电机想去的角度」，不是画面的角度。
 *
 *   我们这边是 kinematic（位置直接摆），没有重力帮忙 —— 照抄 0.32 的结果是
 *   爪子永远缩成一个**闭合的芽**，而原版是一个**张开的钩子**。
 *   用户说「连爪子形状都不同」，一半是曲线（见 `PRONG_PTS`），一半就是这个张角。
 */
export const ANG_OPEN = 0.95
export const ANG_IDLE = 0.8
export const ANG_CLOSED = -0.32

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
 * 夹住时，球铰在娃娃身上的锚点（娃娃本地坐标）。
 *
 * 0.15 ≈ 头顶。从头顶提起来，娃娃会自然**垂在**爪子下面，
 * 而不是被从腰上顶起来（那看着像用托盘端着）。
 */
const GRIP_ANCHOR_Y = 0.15

/* ============================ 掉进洞之后 ============================ */

/** 低于这个高度 = 已经掉进取物通道了（池底 y=0）。 */
const CHUTE_Y = -0.12

/**
 * 娃娃掉进通道后，从这些点重新放回池子里。
 *
 * **确定性**（不是 `Math.random()`）：同一局重放，池子里的变化要一样，
 * 否则截图走查每次都不一样，也说不清「这次是不是真坏了」。
 * 都避开了取物口（`x > 0.26 && z > 0.06`）。
 */
const RESPAWN_SPOTS = [
  { x: -0.34, z: -0.3 },
  { x: -0.06, z: -0.32 },
  { x: 0.2, z: -0.24 },
  { x: -0.32, z: 0.0 },
  { x: 0.02, z: -0.02 },
  { x: 0.18, z: 0.0 },
  { x: -0.14, z: 0.22 },
  { x: 0.06, z: 0.2 },
] as const

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
  }
  dispose(): void
}

export interface ClawPhysicsOpts {
  cabinet: ClawPhysicsCabinet
  /** 每只娃娃的 three Group（位置 / 朝向由物理写回） */
  prizes: Group[]
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

  const { cabinet, prizes, hub, prongs } = opts
  const { hx, hz, glassH, hole } = cabinet

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
  const backDepth = (hole.z0 + hz) / 2
  addStatic(R.ColliderDesc.cuboid(hx, FLOOR_T, backDepth), 0, -FLOOR_T, -hz + backDepth)

  // 前半块：从 -hx 一直到 hole.x0（**不是**从 hole.x1 开始 —— 那是洞的右边缘，
  // 洞本来就顶到柜子右边，那样算出来的宽度是 0，等于整个前半块没有地板）
  const frontHalfW = (hole.x0 + hx) / 2
  const holeHalfD = (hole.z1 - hole.z0) / 2
  addStatic(
    R.ColliderDesc.cuboid(frontHalfW, FLOOR_T, holeHalfD),
    -hx + frontHalfW,
    -FLOOR_T,
    (hole.z0 + hole.z1) / 2,
  )

  // 四壁 + 顶（顶是为了不让娃娃被弹飞出去 —— 没有它偶尔会飞出一只）
  const T = 0.02
  addStatic(R.ColliderDesc.cuboid(T, glassH / 2, hz + T), -hx - T, glassH / 2, 0)
  addStatic(R.ColliderDesc.cuboid(T, glassH / 2, hz + T), hx + T, glassH / 2, 0)
  addStatic(R.ColliderDesc.cuboid(hx, glassH / 2, T), 0, glassH / 2, -hz - T)
  addStatic(R.ColliderDesc.cuboid(hx, glassH / 2, T), 0, glassH / 2, hz + T)
  addStatic(R.ColliderDesc.cuboid(hx, T, hz), 0, glassH + T, 0)

  // 取物通道：洞口下面一个方井，娃娃掉进去就看不见了
  const CHUTE_DEPTH = 0.6
  const cx = (hole.x0 + hole.x1) / 2
  const cz = (hole.z0 + hole.z1) / 2
  addStatic(R.ColliderDesc.cuboid(hx, T, hz), cx, -CHUTE_DEPTH, cz) // 井底
  addStatic(R.ColliderDesc.cuboid(T, CHUTE_DEPTH, (hole.z1 - hole.z0) / 2), hole.x0 - T, -CHUTE_DEPTH / 2, cz)
  addStatic(R.ColliderDesc.cuboid((hole.x1 - hole.x0) / 2, CHUTE_DEPTH, T), cx, -CHUTE_DEPTH / 2, hole.z0 - T)
  addStatic(R.ColliderDesc.cuboid(T, CHUTE_DEPTH, (hole.z1 - hole.z0) / 2), hole.x1 + T, -CHUTE_DEPTH / 2, cz)
  addStatic(R.ColliderDesc.cuboid((hole.x1 - hole.x0) / 2, CHUTE_DEPTH, T), cx, -CHUTE_DEPTH / 2, hole.z1 + T)

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
  {
    const UP = { x: 0, y: 1, z: 0 }
    for (const b of prongBodies) {
      for (const s of prongSegments()) {
        const dx = s.b[0] - s.a[0]
        const dy = s.b[1] - s.a[1]
        const dz = s.b[2] - s.a[2]
        const len = Math.hypot(dx, dy, dz)
        const dir = { x: dx / len, y: dy / len, z: dz / len }
        prongColliders.push(
          world.createCollider(
            R.ColliderDesc.capsule(len / 2, s.r)
              .setTranslation((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2)
              // capsule 的轴默认是 +Y，转到这一段的方向上
              .setRotation(quatFromUnitVectors(UP, dir))
              .setFriction(1.1)
              .setCollisionGroups(clawGroups),
            b,
          ),
        )
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
  }

  const prizeBodies: PrizeBody[] = prizes.map((g) => {
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
    for (const part of PRIZE_PARTS) {
      world.createCollider(
        R.ColliderDesc.ball(part.r * scale)
          .setTranslation(part.x * scale, part.y * scale, part.z * scale)
          .setDensity(PRIZE_DENSITY)
          .setFriction(0.95)
          .setRestitution(0.04)
          .setCollisionGroups(groups(G_PRIZE, 0xffff)),
        body,
      )
    }
    return {
      body,
      from: { x: g.position.x, y: g.position.y, z: g.position.z },
      squash: 0,
      squashV: 0,
      lastSpeed: 0,
    }
  })

  /* ---------------- 先让它自己沉一下 ---------------- */

  /*
    手写的那套三层摆放**不完全满足接触约束**（层与层之间有几厘米的重叠）。
    直接开跑的话，前 0.5 秒整池娃娃会同时往外弹一下 —— 像被吹了口气。

    这里先空跑 90 步（1.5 秒）把重叠推开，再交接给渲染。
    代价约 10~30 ms，发生在物理加载完的那一帧，用户还看不出区别。
  */
  for (let i = 0; i < 90; i++) world.step()

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
  let respawnCursor = 0
  let heldIndex: number | null = null
  let gripJoint: RAPIER.ImpulseJoint | null = null
  /** 交接插值：0 → 1，走完 0.35 秒。防止「物理一接管，整池娃娃瞬移」。 */
  let handover = 0
  let disposed = false

  /* ---------------- 夹住 / 松开 ---------------- */

  /**
   * 指头碰撞体的开关。
   *
   * ★★ 为什么「拿着娃娃」和「刚松手」这两段都必须**关着**：
   *
   *   拿着的时候关，是为了让球铰独占这只娃娃（开着的话合爪会把娃娃往外顶）。
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
    if (gripJoint) {
      world.removeImpulseJoint(gripJoint, true)
      gripJoint = null
    }
    heldIndex = null
    // 不在这里 `setProngColliders(true)` —— 见上面 `pendingProngsOn` 的注释
    pendingProngsOn = true
  }

  function grab(index: number, pose: ClawPhysicsPose): void {
    const pb = prizeBodies[index]
    if (!pb) return
    heldIndex = index
    pendingProngsOn = false
    // 拿着的时候，指头和娃娃不再碰：球铰已经把它固定住了，
    // 再让指头挤它，solver 会把娃娃往外顶（看着像夹不住）
    setProngColliders(false)

    const p = pb.body.translation()
    // 锚点取娃娃**头顶现在的位置**，换算到 hub 本地 —— 这样建铰的瞬间
    // 两端已经重合，不会「啪」地被拽一下
    const topY = p.y + GRIP_ANCHOR_Y
    const ax = p.x - pose.clawX
    const ay = topY - pose.hubY
    const az = p.z - pose.clawZ
    const jd = R.JointData.spherical({ x: ax, y: ay, z: az }, { x: 0, y: GRIP_ANCHOR_Y, z: 0 })
    gripJoint = world.createImpulseJoint(jd, hubBody, pb.body, true)
  }

  /* ---------------- 掉进通道就放回池子 ---------------- */

  function recycle(): void {
    for (let i = 0; i < prizeBodies.length; i++) {
      if (i === heldIndex) continue
      const pb = prizeBodies[i]
      const p = pb.body.translation()
      if (p.y > CHUTE_Y) continue
      const spot = RESPAWN_SPOTS[respawnCursor % RESPAWN_SPOTS.length]
      respawnCursor++
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

  function step(dt: number, pose: ClawPhysicsPose): void {
    if (disposed) return

    /* ① 爪子跟着动画走（kinematic 的位置是「下一帧要去的地方」） */
    hubBody.setNextKinematicTranslation({ x: pose.clawX, y: pose.hubY, z: pose.clawZ })
    hubBody.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 })

    // 指头的世界位姿直接读 three —— 开合角度的唯一事实源是 `applyClose()`
    for (let i = 0; i < prongBodies.length; i++) {
      const m = prongs[i].matrixWorld
      prongBodies[i].setNextKinematicTranslation({ x: m.elements[12], y: m.elements[13], z: m.elements[14] })
      // 从旋转矩阵取四元数（three 的 matrixWorld 是列主序）
      const q = quatFromMatrix(m.elements)
      prongBodies[i].setNextKinematicRotation(q)
    }

    /* ② 手里那只变了就换铰 */
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
    accumulator += Math.min(dt, 0.25)
    let n = 0
    while (accumulator >= FIXED_DT && n < MAX_STEPS) {
      world.step()
      accumulator -= FIXED_DT
      steps++
      n++
    }
    // 补不完的丢掉（切后台回来时不要试图追回几秒钟）
    if (n === MAX_STEPS) accumulator = 0

    recycle()

    /*
      软体手感：撞击（速度骤降）→ 弹簧挤压。和参考实现同一条路
      （`squashV += min(6, dv*4)`，再跑一个 `-900*x - 16*v` 的弹簧）。
      ★ 只改视觉缩放，不改碰撞体 —— 探面和输赢都读不到它，不会互相污染。
    */
    for (let i = 0; i < prizeBodies.length; i++) {
      const pb = prizeBodies[i]
      const lv = pb.body.linvel()
      const sp = Math.hypot(lv.x, lv.y, lv.z)
      const dv = pb.lastSpeed - sp
      pb.lastSpeed = sp
      if (dv > 0.3) pb.squashV += Math.min(6, dv * 4)
      // 被夹住的那只轻轻鼓一点（软软地被捏住），其余回弹到 0
      const target = i === heldIndex ? 0.08 : 0
      pb.squashV += (-900 * (pb.squash - target) - 16 * pb.squashV) * dt
      pb.squash = Math.max(-0.2, Math.min(0.25, pb.squash + pb.squashV * dt))
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
    for (const pb of prizeBodies) {
      if (!pb.body.isSleeping()) awake++
      const a = Math.abs(pb.squash)
      if (a > maxSquash) maxSquash = a
    }
    return {
      bodies: prizeBodies.length,
      held: heldIndex !== null && gripJoint !== null,
      awake,
      recycled,
      recycledLog: recycledLog.slice(),
      steps,
      maxSquash,
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    releaseGrip()
    world.free()
  }

  const squashOf = (index: number): number => prizeBodies[index]?.squash ?? 0

  return { step, nearest, positionOf, rawPositionOf, surfaceAt, squashOf, debug, dispose }
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
