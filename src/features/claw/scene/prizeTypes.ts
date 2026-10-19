/**
 * 五种娃娃的**定义**：碰撞体形状 + 名字 + 配色。
 *
 * 逐字抄参考实现（`claw-machine/src/physics.ts` 的 `PRIZE_TYPES`）。
 *
 * ★★ `parts` 是**碰撞体和视觉的共同事实源**：
 *   · `clawPhysics.ts` 拿它建球 / 胶囊碰撞体；
 *   · `plush.ts` 用同一套比例画毛绒（所以「看得见的耳朵」= 「摸得到的耳朵」）。
 *   以前我们只有「身子 + 两只耳朵」三个球，五种娃娃共用一套碰撞体 ——
 *   企鹅和兔子摸起来一模一样。
 */

export interface Part {
  kind: 'ball' | 'capsule'
  p: [number, number, number]
  r: number
  hh?: number
}

export interface PrizeType {
  id: 'bear' | 'bunny' | 'chick' | 'penguin' | 'pig'
  name: string
  emoji: string
  parts: Part[]
  /** 一只多重（kg）。按体积反推密度，所以小娃娃不会被大娃娃压扁。 */
  mass: number
  colors: number[]
  colorNames: string[]
}

export const PRIZE_TYPES: PrizeType[] = [
  {
    id: 'bear',
    name: '小熊',
    emoji: '🧸',
    mass: 0.13,
    colors: [0x8b6a4f, 0xc9b394, 0x6b5546, 0xc99e96],
    colorNames: ['棕色', '奶茶色', '咖啡色', '豆沙粉'],
    parts: [
      { kind: 'ball', p: [0, 0, 0], r: 0.043 },
      { kind: 'ball', p: [0, 0.07, 0.004], r: 0.045 },
      { kind: 'ball', p: [-0.035, 0.107, 0], r: 0.015 },
      { kind: 'ball', p: [0.035, 0.107, 0], r: 0.015 },
      { kind: 'ball', p: [-0.044, 0.008, 0.016], r: 0.018 },
      { kind: 'ball', p: [0.044, 0.008, 0.016], r: 0.018 },
      { kind: 'ball', p: [-0.024, -0.038, 0.022], r: 0.019 },
      { kind: 'ball', p: [0.024, -0.038, 0.022], r: 0.019 },
    ],
  },
  {
    id: 'bunny',
    name: '兔子',
    emoji: '🐰',
    mass: 0.11,
    colors: [0xe8e3da, 0xaaa5a0, 0xd3bfae],
    colorNames: ['米白', '灰色', '浅咖'],
    parts: [
      { kind: 'ball', p: [0, 0, 0], r: 0.04 },
      { kind: 'ball', p: [0, 0.064, 0.004], r: 0.042 },
      { kind: 'capsule', p: [-0.017, 0.128, -0.004], r: 0.012, hh: 0.022 },
      { kind: 'capsule', p: [0.017, 0.128, -0.004], r: 0.012, hh: 0.022 },
      { kind: 'ball', p: [-0.022, -0.036, 0.02], r: 0.017 },
      { kind: 'ball', p: [0.022, -0.036, 0.02], r: 0.017 },
    ],
  },
  {
    id: 'chick',
    name: '小鸡',
    emoji: '🐥',
    mass: 0.085,
    colors: [0xdcb956, 0xe8d38e],
    colorNames: ['鹅黄', '浅黄'],
    parts: [
      { kind: 'ball', p: [0, 0, 0], r: 0.052 },
      { kind: 'ball', p: [-0.048, -0.004, 0], r: 0.016 },
      { kind: 'ball', p: [0.048, -0.004, 0], r: 0.016 },
    ],
  },
  {
    id: 'penguin',
    name: '企鹅',
    emoji: '🐧',
    mass: 0.12,
    colors: [0x2c313b, 0x46546a],
    colorNames: ['黑色', '藏青'],
    parts: [
      { kind: 'capsule', p: [0, 0.01, 0], r: 0.044, hh: 0.026 },
      { kind: 'ball', p: [-0.044, 0.005, 0], r: 0.014 },
      { kind: 'ball', p: [0.044, 0.005, 0], r: 0.014 },
    ],
  },
  {
    id: 'pig',
    name: '小猪',
    emoji: '🐷',
    mass: 0.11,
    colors: [0xdca69c, 0xcfb39b],
    colorNames: ['粉色', '肉桂'],
    parts: [
      { kind: 'ball', p: [0, 0, 0], r: 0.054 },
      { kind: 'ball', p: [-0.03, 0.045, -0.006], r: 0.014 },
      { kind: 'ball', p: [0.03, 0.045, -0.006], r: 0.014 },
      { kind: 'ball', p: [-0.026, -0.046, 0.016], r: 0.014 },
      { kind: 'ball', p: [0.026, -0.046, 0.016], r: 0.014 },
    ],
  },
]

/** 一只娃娃的「头顶」高度（本地坐标）—— 握持时按它吊，不按腰吊。 */
export function topOf(type: PrizeType): number {
  let top = 0
  for (const part of type.parts) {
    const h = part.kind === 'capsule' ? (part.hh ?? 0) + part.r : part.r
    top = Math.max(top, part.p[1] + h)
  }
  return top
}
