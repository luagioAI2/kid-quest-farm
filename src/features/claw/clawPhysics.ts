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

/**
 * 爪子自己的碰撞体。
 *
 * 爪子的三根指头是 kinematic 的，碰撞体跟着 three 的世界矩阵走 ——
 * 这样「张开多少」只有 `applyProngs()` 一个事实源，这里不重算一遍角度。
 *
 * ⚠️ 这几个数**必须跟着 `clawScene` 里的指头几何走**，而且它是抄过去的一份，
 * 不是派生 —— 改了那边的 `CapsuleGeometry` / `arm.position` / `arm.rotation.z`
 * 就要回来改这里。抄错不会报错，只会「爪子推不动娃娃」或者「隔空把娃娃顶飞」。
 *
 * 现在对着的是：上臂 `Capsule(0.0105, 0.105)` 摆在 `(0.04, -0.062)` 转 `z=0.42`，
 * 爪尖 `Capsule(0.0145, 0.022)` 在 `(0.082, -0.118)`。
 * 两个端点连起来 ≈ 从 `(0.019, -0.014)` 到 `(0.082, -0.118)`，
 * 中点 `(0.05, -0.066)`、方向与竖直线夹角 `atan2(0.063, 0.104) ≈ 0.54`、
 * 半长 `≈ 0.048`（去掉两端球半径 0.013）。
 */
const PRONG_CAPSULE = { halfHeight: 0.048, radius: 0.013, x: 0.05, y: -0.066, z: 0, tiltZ: 0.54 }

/** hub 本体的球（比三个指头高一点，让爪子下压时能把娃娃拨开） */
const HUB_BALL_R = 0.056

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
  world.createCollider(R.ColliderDesc.ball(HUB_BALL_R).setFriction(0.4).setCollisionGroups(clawGroups), hubBody)

  const prongBodies = prongs.map(() =>
    // 先摆在 hub 那儿；第一次 `step()` 会用 three 的世界矩阵把它们挪到正确位置。
    // 这里**不**去读 `prong.getWorldPosition()` —— 建场景时 hub 还没被摆过，
    // 读到的是原点，反而更错。
    world.createRigidBody(
      R.RigidBodyDesc.kinematicPositionBased().setTranslation(hub.position.x, hub.position.y, hub.position.z),
    ),
  )
  const prongColliders = prongBodies.map((b) => {
    const tilt = Math.sin(PRONG_CAPSULE.tiltZ / 2)
    const desc = R.ColliderDesc.capsule(PRONG_CAPSULE.halfHeight, PRONG_CAPSULE.radius)
      .setTranslation(PRONG_CAPSULE.x, PRONG_CAPSULE.y, PRONG_CAPSULE.z)
      .setRotation({ x: 0, y: 0, z: tilt, w: Math.cos(PRONG_CAPSULE.tiltZ / 2) })
      .setFriction(1.1)
      .setCollisionGroups(clawGroups)
    return world.createCollider(desc, b)
  })

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
  let respawnCursor = 0
  let heldIndex: number | null = null
  let gripJoint: RAPIER.ImpulseJoint | null = null
  /** 交接插值：0 → 1，走完 0.35 秒。防止「物理一接管，整池娃娃瞬移」。 */
  let handover = 0
  let disposed = false

  /* ---------------- 夹住 / 松开 ---------------- */

  function releaseGrip(): void {
    if (gripJoint) {
      world.removeImpulseJoint(gripJoint, true)
      gripJoint = null
    }
    // 松手后指头恢复碰撞 —— 拿着的时候是关掉的，否则合爪会把娃娃挤飞
    for (const c of prongColliders) c.setEnabled(true)
    heldIndex = null
  }

  function grab(index: number, pose: ClawPhysicsPose): void {
    const pb = prizeBodies[index]
    if (!pb) return
    heldIndex = index
    // 拿着的时候，指头和娃娃不再碰：球铰已经把它固定住了，
    // 再让指头挤它，solver 会把娃娃往外顶（看着像夹不住）
    for (const c of prongColliders) c.setEnabled(false)

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

  return { step, nearest, positionOf, surfaceAt, squashOf, debug, dispose }
}

/* ============================ 小工具 ============================ */

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
