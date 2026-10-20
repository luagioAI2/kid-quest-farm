/**
 * 娃娃机一局的**时间线** —— 纯函数，不碰 three，也不碰 React。
 *
 * 拆出来的理由：爪子什么时候下降、什么时候合、什么时候滑掉，
 * 是一串**可枚举的时段**。把它写成纯函数，就能单测「每个时刻落在哪一段」
 * 而不必起浏览器 —— 否则这段逻辑只能靠肉眼看动画，而肉眼看不出
 * 「合爪发生在下降结束之前」这种错。
 *
 * ---------------------------------------------------------------------------
 * ★★ 结果**不是**这里决定的
 * ---------------------------------------------------------------------------
 *
 * 「这一局中不中」在投币那一刻就由 `domain/clawEconomy.ts` 的
 * `clawResolveRound()` 定死了（幂等伪随机），这里只负责**演得像**：
 *   · 中了 → 爪子夹住一只娃娃，一路送到出口
 *   · 没中 → 爪子**夹到一半滑掉**（`SLIP_AT` 那一刻松手）
 *
 * 为什么不「看物理算出来什么」：物理驱动的抓取**期望值不可控**，
 * 而期望值正是那条不能破的不变量（见 `clawEconomy.ts` 头注释）。
 * 真实商场的娃娃机也是这个账 —— 抓力是程序设的，不是物理决定的。
 *
 * ⚠️ 顺带一条：**玩家瞄准哪里不影响结果**。孩子会以为「对准了就能抓到」，
 * 那只是一种感觉；如果瞄准真的影响中奖率，期望值就变成「取决于玩家水平」，
 * 家长设的那个数就失效了。
 */

export type ClawPhase = 'idle' | 'drop' | 'close' | 'lift' | 'move' | 'release' | 'done'

interface PhaseSpan {
  phase: Exclude<ClawPhase, 'idle' | 'done'>
  /** 这一段持续多少秒 */
  seconds: number
}

/**
 * 一局的时段表。改这里就等于改动画节奏 ——
 * 但**别改总时长**：走查脚本会用它算「什么时候该截图」，
 * 而且 `CLAW_TOTAL` 是「这一局结束」的唯一判据。
 *
 * ★★ 2026-10-17：`close` 从 **0.40 改成 0.75**。这是「抓的过程差很多」的
 *    第二个来源 —— 0.40 秒合爪只有 24 帧，看着像**开关**，不像机器在使劲。
 *    参考实现是 **0.9 秒**（`stateT > 0.9` 才切 `lift`），而且它在合爪前
 *    还有 0.15 秒的停顿（`stateT > 0.15` 才开始收指头）。
 *    这里没有单独的停顿段，靠 `smoothstep` 的起步慢来代替。
 */
export const CLAW_SPANS: readonly PhaseSpan[] = [
  { phase: 'drop', seconds: 1.10 },
  { phase: 'close', seconds: 0.75 },
  { phase: 'lift', seconds: 1.00 },
  { phase: 'move', seconds: 1.15 },
  { phase: 'release', seconds: 0.50 },
]

/** 一局的总秒数（不含 `idle` 和 `done`）。 */
export const CLAW_TOTAL = CLAW_SPANS.reduce((a, s) => a + s.seconds, 0)

/**
 * 没中时，爪子在哪一刻松手（相对 `lift` 段的进度）。
 *
 * 0.55 ⇒ 提起来一半才滑掉，看着像「真的夹不住了」；
 * 太早（< 0.3）像「根本没夹到」，太晚（> 0.85）像「快到顶了才掉」。
 */
export const SLIP_AT = 0.55

export interface ClawMoment {
  phase: ClawPhase
  /** 当前这一段内部的进度，0~1（`idle` / `done` 恒为 0） */
  t: number
  /** 整局的进度，0~1 */
  overall: number
}

/**
 * 这一局的第 `elapsed` 秒落在哪一段。
 *
 * `elapsed < 0` 当 0；超过总时长就是 `done`。
 */
export function clawPhaseAt(elapsed: number): ClawMoment {
  if (!Number.isFinite(elapsed) || elapsed <= 0) return { phase: 'idle', t: 0, overall: 0 }
  if (elapsed >= CLAW_TOTAL) return { phase: 'done', t: 0, overall: 1 }
  let acc = 0
  for (const s of CLAW_SPANS) {
    if (elapsed < acc + s.seconds) {
      return { phase: s.phase, t: (elapsed - acc) / s.seconds, overall: elapsed / CLAW_TOTAL }
    }
    acc += s.seconds
  }
  return { phase: 'done', t: 0, overall: 1 }
}

/**
 * 爪子中心该在哪。
 *
 * `from` 是玩家瞄准的位置（爪子下降的地方），`to` 是取物口中心。
 * 只有 `move` 段会横向移动 —— 而且用的是**平滑插值**，
 * 不然爪子会在两段之间瞬移。
 */
export function clawPositionAt(
  m: ClawMoment,
  from: { x: number; z: number },
  to: { x: number; z: number },
): { x: number; z: number } {
  if (m.phase === 'move' || m.phase === 'release' || m.phase === 'done') {
    const k = m.phase === 'move' ? smoothstep(m.t) : 1
    // 端点直接给 `to` 本身，不走一遍 lerp —— `from + (to − from) × 1` 会留下
    // 一个 4e-17 的尾巴（实测 `0.12 + 0.3 = 0.42000000000000004`）。
    // 渲染上无所谓，但「一局结束时爪子**就在**取物口中心」是个能直接断言的
    // 事实，不该被浮点噪声变成「约等于」。
    if (k >= 1) return { x: to.x, z: to.z }
    return { x: from.x + (to.x - from.x) * k, z: from.z + (to.z - from.z) * k }
  }
  return { x: from.x, z: from.z }
}

/**
 * 爪子的开合程度：0 = 张开，1 = 合上。
 *
 * `drop` 段保持张开；`close` 段合上；之后一直合着（夹着娃娃）；
 * `release` 段张开（松手）。
 */
export function clawCloseAt(m: ClawMoment): number {
  switch (m.phase) {
    case 'close':
      return smoothstep(m.t)
    case 'lift':
    case 'move':
      return 1
    case 'release':
      return 1 - smoothstep(m.t)
    case 'done':
      return 0
    default:
      return 0
  }
}

/**
 * 爪子（hub）的高度。
 *
 * `top` = 轨道下面待命的高度，`bottom` = 池底（抓取高度）。
 * `drop` 下去、`lift` 回来，其余时候停在 `top`。
 */
export function clawHubYAt(m: ClawMoment, top: number, bottom: number): number {
  if (m.phase === 'drop') return top + (bottom - top) * smoothstep(m.t)
  if (m.phase === 'lift') return bottom + (top - bottom) * smoothstep(m.t)
  if (m.phase === 'close') return bottom
  if (m.phase === 'idle') return top
  return top
}

/**
 * 这一刻爪子**手里有没有娃娃**。
 *
 * 中奖：`close` 合上之后一直拿着，直到 `release` 段**过半**（0.5）—— 那一刻在
 *       取物口上方松手，娃娃落到下面的滑道里（`clawPhysics` 那边有真的滑道）。
 *
 *       ★★ 为什么是「松手」而不是「送进洞口」：
 *         原来的实现是爪子一路挪到池子**侧的洞口**（`CLAW_HOLE_CENTER`）再把娃娃
 *         塞下去 —— 可取物口在**机身正面下方**（y≈−0.52），池子里的洞口在
 *         **池底同一平面**。两者根本不是一回事：孩子看到的是娃娃在池底凭空消失，
 *         而不是「从机器下面掉出来」。参考实现是前者（松手 → 滑道 → 取物口）。
 *
 * 没中：`close` 之后也拿着（演得像夹到了），到 `lift` 的 `SLIP_AT` 就松手 ——
 * 这一段「拿过又掉了」正是孩子看到的「滑掉了」。
 */
export function clawHoldingAt(m: ClawMoment, won: boolean): boolean {
  if (m.phase === 'close') return false
  if (m.phase === 'lift') return won ? true : m.t < SLIP_AT
  if (m.phase === 'move') return won
  // 松手过半就放开 —— 松手动作是「指头张开」，放开之后娃娃才开始自由落体
  if (m.phase === 'release') return m.t < 0.5
  return false
}

/** 结果文案：告诉孩子刚才发生了什么。中奖和三种没中的说法不一样。 */
export function clawOutcomeText(won: boolean, hadPrizeUnderClaw: boolean): string {
  if (won) return '抓到了！'
  return hadPrizeUnderClaw ? '滑掉了' : '差一点'
}

/** 平滑插值（smoothstep）—— 让启动和停止不像开关。 */
export function smoothstep(t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t
  return k * k * (3 - 2 * k)
}

/* ============================ 摆动（单摆） ============================ */

/** 摆的状态：两个方向的角度（弧度）和角速度。 */
export interface ClawSwing {
  x: number
  z: number
  vx: number
  vz: number
}

/** 重力加速度 —— 和参考实现同一个数。 */
const SWING_G = 9.81
/**
 * 阻尼系数。参考实现是 **1.6**，我们取 **2.2**。
 *
 * 为什么加重：我们的绳长只有 0.12 m（`CLAW_HANG_MIN`），ω = √(g/L) ≈ 9 rad/s，
 * ζ = 1.6 / (2ω) ≈ 0.09 —— 松手后要荡 5 秒才停。实测「移动一下，三秒后还在晃」，
 * 看着像爪子坏了。2.2 ⇒ ζ ≈ 0.12，两三下停住，但仍然是**看得见的晃**。
 * 再大（> 3）就变成「拖着一块铁」，反而不像吊着的爪子。
 */
const SWING_DAMP = 2.2
/** 摆角上限（弧度，≈20°）。防止某帧 dt 抖动把角度甩飞。 */
const SWING_MAX = 0.25

/**
 * 单摆一步（小角度、带阻尼）——**照搬参考实现**：
 *
 *     v += (−k·θ − a/L − 1.6·v)·dt      k = g / L
 *
 * 三个要点，少一个都不像：
 *   · `−k·θ` 是重力回正 —— 摆开去会自己荡回来；
 *   · `−a/L` 是**惯性**：小车一加速，爪子就往后甩。★ 关键是「加速」不是「移动」：
 *     匀速平移时 `a = 0`，爪子应该**竖直挂着不晃**（很多人以为是「移动就晃」，
 *     照那个写出来的是一块被拖着的铁块）；
 *   · `−1.6·v` 是阻尼 —— 不写的话它会一直荡下去。
 *
 * @param ax 小车加速度（m/s²，世界 x）
 * @param az 小车加速度（m/s²，世界 z）
 * @param ropeLen 绳长（米）。`CLAW_RAIL_Y − hubY` —— 吊得越低摆得越慢。
 */
export function clawSwingStep(s: ClawSwing, ax: number, az: number, ropeLen: number, dt: number): void {
  if (!(dt > 0)) return
  const L = Math.max(0.08, ropeLen)
  const k = SWING_G / L
  /*
    ★★ 固定子步（≤ 1/120 秒），不是「一步走完这一帧」。

    绳长只有 0.12 m ⇒ ω = √(g/L) ≈ 9 rad/s，频率 1.4 Hz。
    60fps 下 ω·dt ≈ 0.15，随便怎么积都稳；但**掉帧到 10fps** 时 ω·dt ≈ 0.9，
    显式积分会把振幅越积越大（实测：松手 2 秒后还在 0.1 rad 上荡）。
    这不是「动画难看一点」，是数值发散。
  */
  let rem = dt
  while (rem > 0) {
    const h = Math.min(rem, 1 / 120)
    rem -= h
    s.vx += (-k * s.x - ax / L - SWING_DAMP * s.vx) * h
    s.vz += (-k * s.z - az / L - SWING_DAMP * s.vz) * h
    s.x = Math.max(-SWING_MAX, Math.min(SWING_MAX, s.x + s.vx * h))
    s.z = Math.max(-SWING_MAX, Math.min(SWING_MAX, s.z + s.vz * h))
  }
}

/** 小车的运动状态（位置 + 速度）。摆是被**加速度**甩起来的，所以要单独跟踪速度。 */
export interface ClawCarriage {
  x: number
  z: number
  vx: number
  vz: number
}

/**
 * 小车加速度上限（m/s²）。
 *
 * ★ 参考实现是 0.85 —— 它的输入是摇杆模拟量，速度本来就是渐变的。
 *   我们的方向键是「一按就满速」，位置差分出来的加速度是一个 **30 m/s² 的尖峰**，
 *   摆一下就被顶到上限（实测直接吃满 20°）。
 *
 * 取 **0.7** 是量出来的：平衡角 θ ≈ a/g ≈ 4°，加上起步 / 急停的过冲也就 7~8°。
 * 再大（1.2）时实测峰值到 0.2 rad（11°）而且 3 秒还在荡 —— 那不是「晃」，
 * 是「爪子松了」。
 */
const CARRIAGE_A_MAX = 0.7

/**
 * 推进一帧小车，返回**这一帧的加速度**（给 `clawSwingStep` 用）。
 *
 * 速度朝「位置差分出来的目标速度」逼近，但每帧最多变 `A_MAX × dt` ——
 * 这样 `a` 天然被限制在 `±A_MAX` 内，不需要再对结果做裁剪。
 */
export function clawCarriageAccel(
  s: ClawCarriage,
  cx: number,
  cz: number,
  dt: number,
): { ax: number; az: number } {
  if (!(dt > 0)) {
    s.x = cx
    s.z = cz
    return { ax: 0, az: 0 }
  }
  const tvx = (cx - s.x) / dt
  const tvz = (cz - s.z) / dt
  const ovx = s.vx
  const ovz = s.vz
  const ex = tvx - ovx
  const ez = tvz - ovz
  const e = Math.hypot(ex, ez)
  const step = CARRIAGE_A_MAX * dt
  if (e <= step) {
    s.vx = tvx
    s.vz = tvz
  } else {
    s.vx = ovx + (ex / e) * step
    s.vz = ovz + (ez / e) * step
  }
  s.x = cx
  s.z = cz
  return { ax: (s.vx - ovx) / dt, az: (s.vz - ovz) / dt }
}
