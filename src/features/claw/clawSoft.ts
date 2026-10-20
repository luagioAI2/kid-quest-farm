/**
 * 娃娃的「软体手感」弹簧（挤压位移）。
 *
 * 从 `clawPhysics` 里抽出来的原因：这段数学**和 Rapier 无关**，
 * 但它有一个只在低帧率下才暴露的坑 —— 放在纯函数里才能写回归测试。
 *
 * ★★ 坑（2026-10-20 实测）：`k = 900` ⇒ ω = 30 rad/s。显式欧拉要稳，
 *   `ω·dt` 得远小于 2。headless（SwiftShader）跑娃娃机只有 5~10 fps，
 *   `dt` 到 0.1~0.2 ⇒ `ω·dt = 3~6`，**直接发散**。
 *   症状不是报错，而是 `squash` 在 `+0.25 / −0.20` 两个夹紧值之间一帧一跳 ——
 *   娃娃在画面上一帧胖、一帧瘦。看代码完全正常。
 *
 * ➜ 解法：内部按 `dt ≤ 1/120` 切小步（和 `clawSwingStep` 同一个手法）。
 */

/** 弹簧刚度（原版就是这个数） */
export const SOFT_K = 900
/** 阻尼（原版就是这个数，ζ ≈ 0.27，捏一下会回弹一次） */
export const SOFT_C = 16
/** 挤压下限 / 上限（超出就是「被捏成纸片」了） */
export const SOFT_MIN = -0.2
export const SOFT_MAX = 0.25

/** 积分用的最大步长。`1/120` ⇒ `ω·h = 0.25`，显式欧拉稳得很。 */
const MAX_H = 1 / 120

export interface SoftBody {
  /** 当前挤压量（`> 0` 沿轴压扁，`< 0` 沿轴拉长 —— 见 `plush.ts` 的着色器） */
  squash: number
  /** 挤压速度 */
  squashV: number
}

/**
 * 把 `s` 往 `target` 推进一步。
 *
 * @param s      被推进的弹簧（就地修改）
 * @param target 目标挤压量。被两根以上指头捏住时是负的（横向被挤、往上鼓）
 * @param dt     这一帧的真实间隔（秒）
 */
export function softStep(s: SoftBody, target: number, dt: number): void {
  if (!(dt > 0)) return
  // 一帧掉到 0.2 秒也最多切 24 步 —— 切后台回来时不要白烧 CPU
  const sub = Math.max(1, Math.min(24, Math.ceil(dt / MAX_H)))
  const h = dt / sub
  for (let i = 0; i < sub; i++) {
    s.squashV += (-SOFT_K * (s.squash - target) - SOFT_C * s.squashV) * h
    s.squash = Math.max(SOFT_MIN, Math.min(SOFT_MAX, s.squash + s.squashV * h))
  }
}
