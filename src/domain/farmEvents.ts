import type { Animal, CropDef, FarmEvent, Plot } from './types'

/* ============================================================
   农场随机事件引擎 —— 「像赌场下注一样」

   家长需求原话：
   「类似概率，植物种植，养小动物时，也会出现随机事件，影响收成，
     甚至颗粒无收，甚至死亡。购买植物动物，就像赌场下注一样，
     投入产出可能（现实中农民也是如此），可能损失，可能丰收。」
   「节假日有产出加成，不需要明面体现。用户会自己感知到。周六日会比较高。」
   「某些植物比如果树是长期的，也可能随事件死亡。」

   设计原则：
   1. **期望值为正但方差可观** —— 长期一定赚，单次可能亏。
      这是「赌场下注」的关键：不是赌博，是投资。
   2. 事件在**收获时结算**，而不是后台悄悄扣。孩子必须"看到"损失才学得到。
   3. 周末/节假日加成**不显示在任何 UI 上**，只体现在最终数字上。
      孩子自己会发现「周末收成特别好」。
   4. 死亡是真实存在的，但会给征兆（多年生作物连续歉收会先"叶子黄了"）。
   ============================================================ */

/** 稳定的伪随机（同 seed 同结果，保证幂等） */
function hashRandom(seed: number): number {
  let x = Math.sin(seed * 12.9898) * 43758.5453
  x = x - Math.floor(x)
  return x
}

/** 把任意字符串转成稳定数值种子 */
function seedOf(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h) % 100000
}

/* ---------------- 节假日 / 周末加成 ---------------- */

/**
 * 产出加成倍率 —— **刻意不暴露给 UI**。
 *
 * 周末明显更高，节假日再高一点。孩子会自己察觉到规律，
 * 这正是我们想要的「用户会自己感知到」。
 *
 * 注意：这里的 date 用本地时间判断。
 */
export function seasonalBonus(now: number): number {
  const d = new Date(now)
  const dow = d.getDay() // 0=周日

  // 周六日：明显加成
  let bonus = 1
  if (dow === 0 || dow === 6) bonus = 1.35
  else if (dow === 5) bonus = 1.12 // 周五也给一点点，形成"周末要来了"的感觉

  // 法定节假日（月-日）：给孩子一点惊喜
  const key = `${d.getMonth() + 1}-${d.getDate()}`
  const HOLIDAYS: Record<string, number> = {
    '1-1': 1.6, // 元旦
    '5-1': 1.5,
    '6-1': 1.8, // 儿童节，必须最高
    '10-1': 1.6,
    '10-2': 1.6,
    '10-3': 1.5,
  }
  if (HOLIDAYS[key]) bonus = Math.max(bonus, HOLIDAYS[key])

  return bonus
}

/** 农场时间流速：把现实经过的毫秒换算成农场分钟 */
export function farmMinutes(elapsedMs: number, timeScale: number): number {
  return (elapsedMs / 60000) * timeScale
}

/* ---------------- 收获事件 ---------------- */

export interface HarvestEventResult {
  /** 最终产量倍率（1 = 正常） */
  multiplier: number
  /** 是否颗粒无收 */
  wipedOut: boolean
  /** 是否作物死亡（多年生被带走） */
  died: boolean
  /** 生成的事件（可能为空 = 风调雨顺） */
  event?: FarmEvent
}

const GOOD_EVENTS: Array<{ kind: FarmEvent['kind']; msg: string; emoji: string }> = [
  { kind: 'weather_good', msg: '这几天阳光雨水刚刚好，收成不错！', emoji: '☀️' },
  { kind: 'harvest_bumper', msg: '大丰收！这次摘得特别多～', emoji: '🧺' },
]

const BAD_EVENTS: Array<{ kind: FarmEvent['kind']; msg: string; emoji: string }> = [
  { kind: 'weather_bad', msg: '下了好几天大雨，收成少了一些。', emoji: '🌧️' },
  { kind: 'pest', msg: '来了些小虫子，吃掉了一部分。', emoji: '🐛' },
  { kind: 'disease', msg: '作物有点生病了，长得不太好。', emoji: '🤒' },
  { kind: 'harvest_poor', msg: '今年这片地有点瘦，收得少。', emoji: '😢' },
]

/**
 * 产量档位表（2026-09-15 重写，用户锁定口径）。
 *
 * **两处关键改动，改回去会直接退回「恒定 1.6 倍」那个 bug：**
 *
 * 1. **中性档从 1.00 降到 0.92。**
 *    基准单价 = `上限回收 ÷ 总产出量`（按最高产量算），所以
 *    `产量 100% × 基准价` **正好等于上限回收** —— 也就是说「什么都没发生」
 *    本身就已经顶到闸门了。孩子十次有九次看到同一个数字。
 *    压到 0.92 才留出 8% 的浮动空间，价格波动才有意义。
 *
 * 2. **每档乘数取区间，不再是定值。**
 *    只收 1 次的标的（小萝卜、胡萝卜）等于只掷一次骰子，
 *    定值会让结局只剩两三种；取区间把离散性抹掉。
 *
 * ⚠️ **新口径下 `E[产量倍率] ≈ 0.87`，故意小于 1，不要去「修」。**
 * 旧的注释写着「保证期望 > 1」，那是**旧口径**的要求（当时基准价按无灾产出反推，
 * 所以期望必须 > 1 才不亏）。现在 60% 的浮盈已经算进基准单价里了，
 * 产量端**本来就该打折**。实测期望浮盈 +31%~+41%，见 §5.6。
 */
const HARVEST_TIERS: Array<{
  kind: FarmEvent['kind'] | 'none'
  p: number
  lo: number
  hi: number
}> = [
  { kind: 'weather_good', p: 0.1, lo: 1.1, hi: 1.2 }, // 🌈 风调雨顺
  { kind: 'pest', p: 0.15, lo: 0.7, hi: 0.8 }, // 🐛 虫灾
  { kind: 'disease', p: 0.06, lo: 0.55, hi: 0.65 }, // 🦠 病毒
  { kind: 'weather_bad', p: 0.04, lo: 0.45, hi: 0.55 }, // 🌪️ 风灾
  { kind: 'none', p: 0.64, lo: 0.92, hi: 0.92 }, // 什么都没发生
]

/** 枯萎病：直接绝收，多年生还可能整棵枯死 */
const WITHER_P = 0.01

/** 结算一次收获的随机事件。 */
export function rollHarvestEvent(
  plot: Plot,
  crop: CropDef,
  now: number,
  enabled = true,
  salt = 0,
): HarvestEventResult {
  if (!enabled) return { multiplier: 1, wipedOut: false, died: false }

  // 种子必须**幂等**：同一块地、同一次收获，刷新多少次都是同一个结果。
  // 千万不要改成 Math.random()。
  const seed = seedOf(`${plot.index}|${crop.id}|${plot.crop?.harvestedCount ?? 0}|${salt}`)
  const isPerennial = crop.kind === 'perennial'
  const roll = hashRandom(seed)

  // --- 枯萎病：绝收 ---
  if (roll < WITHER_P) {
    const died = isPerennial && hashRandom(seed + 5) < 0.45
    if (died) {
      return {
        multiplier: 0,
        wipedOut: true,
        died: true,
        event: {
          id: `ev-${seed}-d`,
          kind: 'crop_died',
          message: `${crop.name}没能撑住，枯掉了……重新种一棵吧。`,
          emoji: '🥀',
          multiplier: 0,
          createdAt: now,
          refId: String(plot.index),
        },
      }
    }
    return {
      multiplier: 0,
      wipedOut: true,
      died: false,
      event: {
        id: `ev-${seed}-w`,
        kind: 'harvest_poor',
        message: '这次一颗都没收到，好可惜。',
        emoji: '🪹',
        multiplier: 0,
        createdAt: now,
        refId: String(plot.index),
      },
    }
  }

  // --- 按档位抽产量倍率 ---
  let acc = WITHER_P
  for (const t of HARVEST_TIERS) {
    acc += t.p
    if (roll >= acc) continue

    // 区间内取一个稳定值（同一个 seed → 同一个倍率）
    const mult = round2(t.lo + hashRandom(seed + 7) * (t.hi - t.lo))

    // 中性档：不生成事件、不给提示 —— 大部分时候就该是「什么都没发生」
    if (t.kind === 'none') return { multiplier: mult, wipedOut: false, died: false }

    const pool = t.lo >= 1 ? GOOD_EVENTS : BAD_EVENTS
    const e = pool[Math.floor(hashRandom(seed + 3) * pool.length)]
    return {
      multiplier: mult,
      wipedOut: false,
      died: false,
      event: {
        id: `ev-${seed}-${t.kind}`,
        kind: t.kind,
        message:
          t.lo >= 1
            ? e.msg
            : `${e.msg}（这次只剩 ${Math.round(mult * 100)}%）`,
        emoji: e.emoji,
        multiplier: mult,
        createdAt: now,
        refId: String(plot.index),
      },
    }
  }

  // 兜底（概率表加起来应该是 1，走到这里说明表写错了）
  return { multiplier: 0.92, wipedOut: false, died: false }
}

/* ---------------- 动物事件 ---------------- */

export interface AnimalEventResult {
  /** 是否生病 */
  sick: boolean
  /** 是否离世 */
  died: boolean
  event?: FarmEvent
}

/**
 * 动物每日风险检查（在 advanceAnimals 时按"经过的农场天数"调用）。
 *
 * 生病的动物会停止产出，喂一喂 / 摸一摸就能治好。
 * 长时间不管（12 小时）才可能恶化离世 —— 给了足够的补救窗口。
 */
export function rollAnimalEvent(
  animal: Animal,
  def: { id: string; name: string; emoji: string; fragility?: number },
  farmDaysPassed: number,
  now: number,
  enabled = true,
): AnimalEventResult {
  if (!enabled || animal.deceased || farmDaysPassed <= 0) {
    return { sick: false, died: false }
  }

  const fragility = def.fragility ?? 1
  const seed = seedOf(`${animal.id}|${animal.animalId}|${Math.floor(animal.lastFedAt / 60000)}`)

  // 每天生病概率 ~2%，按经过的农场天数累加
  const sickChance = 0.02 * fragility * farmDaysPassed
  if (hashRandom(seed) < sickChance) {
    return {
      sick: true,
      died: false,
      event: {
        id: `ev-${seed}-s`,
        kind: 'animal_sick',
        message: `${animal.name}有点不舒服，喂喂它就会好起来。`,
        emoji: '🤒',
        createdAt: now,
        refId: animal.id,
      },
    }
  }

  return { sick: false, died: false }
}

/** 动物寿命检查：超过预期寿命就自然老去 */
export function isAnimalExpired(
  animal: Animal,
  lifespanMinutes: number | undefined,
  now: number,
  timeScale: number,
): boolean {
  if (!lifespanMinutes) return false
  const livedFarmMinutes = farmMinutes(now - animal.bornAt, timeScale)
  return livedFarmMinutes >= lifespanMinutes
}

/** 给事件挑一个合适的 emoji（兜底） */
export function eventEmoji(kind: FarmEvent['kind']): string {
  switch (kind) {
    case 'weather_good':
    case 'harvest_bumper':
      return '🌈'
    case 'weather_bad':
      return '🌧️'
    case 'pest':
      return '🐛'
    case 'disease':
      return '🤒'
    case 'harvest_poor':
      return '😢'
    case 'crop_died':
      return '🥀'
    case 'animal_sick':
      return '🤒'
    case 'animal_recovered':
      return '💚'
    case 'animal_died':
      return '🕊️'
    case 'market_surge':
      return '📈'
    case 'market_crash':
      return '📉'
    case 'holiday_bonus':
      return '🎉'
    default:
      return '❓'
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
