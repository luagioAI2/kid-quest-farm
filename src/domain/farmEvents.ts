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
 * 结算一次收获的随机事件。
 *
 * @param plot      当前地块
 * @param crop      作物定义
 * @param now       当前时间戳
 * @param enabled   farmEventsEnabled，关掉就是风调雨顺
 * @param salt      额外盐值（比如收获次数），保证同一块地多次收获结果不同
 */
export function rollHarvestEvent(
  plot: Plot,
  crop: CropDef,
  now: number,
  enabled = true,
  salt = 0,
): HarvestEventResult {
  if (!enabled) return { multiplier: 1, wipedOut: false, died: false }

  const fragility = crop.fragility ?? 1
  const seed = seedOf(`${plot.index}|${crop.id}|${plot.crop?.harvestedCount ?? 0}|${salt}`)

  // 风险基准：一年生 12%，多年生更高（因为它要"撑住"多次收获）
  const isPerennial = crop.kind === 'perennial'
  const baseRisk = isPerennial ? 0.16 : 0.12
  const risk = Math.min(0.55, baseRisk * fragility)

  // 关键设计（踩过的坑，别改回去）：
  //
  // 1) 大丰收的**概率是固定的 20%**，不随脆弱度缩小。
  //    早先的写法是 `pGood / fragility`，看起来"娇气就少走运"很合理，
  //    但它会同时压低收益和抬高期望值缺口，实测最娇气的多年生作物
  //    期望只有 0.92 —— 越种越穷。孩子一旦发现就再也不碰它了，
  //    那不是"下注感"而是"劝退"。风险应该体现在**方差**上，
  //    而不是体现在**负期望**上。
  //
  // 2) 脆弱度带来的超额风险，全部换成**更大的丰收倍率**（luckBonus）。
  //    于是 fragile 作物的真实含义变成：
  //      「更容易白干，但一旦丰收就赚得特别多」
  //    这才是家长要的「像赌场下注一样」——高风险高回报。
  //
  // ⚠️ 改任何系数前先验算期望值，保证从 fragility 0.5 到 2.2 全都 > 1。
  const pGood = 0.2
  const pBad = risk * 0.75

  // 超出基准风险的部分，用来放大丰收的手气（0 → 不放大）
  const extraRisk = Math.max(0, risk - baseRisk)
  const luckBonus = extraRisk * 2.4

  const roll = hashRandom(seed)

  // --- 大丰收 ---
  if (roll < pGood) {
    const e = GOOD_EVENTS[Math.floor(hashRandom(seed + 1) * GOOD_EVENTS.length)]
    return {
      multiplier: round2(1.35 + luckBonus + hashRandom(seed + 2) * (0.55 + luckBonus)), // 1.35+ ~ 1.90+
      wipedOut: false,
      died: false,
      event: {
        id: `ev-${seed}-g`,
        kind: e.kind,
        message: e.msg,
        emoji: e.emoji,
        createdAt: now,
        refId: String(plot.index),
      },
    }
  }

  // --- 减产 ---
  if (roll < pGood + pBad) {
    const e = BAD_EVENTS[Math.floor(hashRandom(seed + 3) * BAD_EVENTS.length)]
    const mult = round2(0.35 + hashRandom(seed + 4) * 0.35) // 0.35 ~ 0.70
    return {
      multiplier: mult,
      wipedOut: false,
      died: false,
      event: {
        id: `ev-${seed}-b`,
        kind: e.kind,
        message: `${e.msg}（只剩 ${Math.round(mult * 100)}%）`,
        emoji: e.emoji,
        multiplier: mult,
        createdAt: now,
        refId: String(plot.index),
      },
    }
  }

  // --- 颗粒无收 / 死亡（剩下的小概率，但它是"赌场感"的来源） ---
  if (roll < pGood + risk) {
    const died = isPerennial && hashRandom(seed + 5) < 0.45 // 多年生才可能整棵死掉
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

  // --- 正常 ---
  return {
    multiplier: round2(0.95 + hashRandom(seed + 6) * 0.12), // 0.95 ~ 1.07，小幅抖动
    wipedOut: false,
    died: false,
  }
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
