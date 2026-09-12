import type {
  Animal,
  AnimalMood,
  CropStage,
  FarmState,
  Plot,
} from './types'
import { ANIMAL_BY_ID, CROP_BY_ID } from './catalog'
import { farmMinutes, isAnimalExpired } from './farmEvents'

/* ============================================================
   农场引擎
   ------------------------------------------------------------
   全部按「真实时间推进」：离线期间作物照长、牛羊照产。
   打开 App 时用 advanceFarm() 一次性结算所有累积产出。

   时间流速（timeScale）：
   1 现实分钟 = timeScale 农场分钟。
   默认 1（与现实同速），家长可以在设置里调成 2 或 3，
   这样「农场一天」就相当于现实中的半天/8 小时，
   方便跟孩子解释"为什么萝卜长得这么快"。
   ============================================================ */

/** 默认地块：3 行 x 4 列 = 12 块，前 4 块免费 */
export function createInitialFarm(): FarmState {
  const plots: Plot[] = []
  const unlockCosts = [0, 0, 0, 0, 40, 70, 120, 200, 320, 520, 820, 1200]
  for (let i = 0; i < 12; i++) {
    plots.push({
      index: i,
      unlocked: i < 4,
      unlockCost: unlockCosts[i] ?? 1200,
    })
  }
  return {
    plots,
    animals: [],
    totalHarvests: 0,
    totalPlanted: 0,
    totalSheared: 0,
    farmDay: 0,
  }
}

/** 作物当前阶段 0-3 */
export function cropStage(plot: Plot, now = Date.now(), timeScale = 1): CropStage {
  if (!plot.crop) return 'seed'
  const def = CROP_BY_ID.get(plot.crop.cropId)
  if (!def) return 'seed'
  if (plot.crop.diedAt) return 'withered'
  const elapsed = farmMinutes(now - plot.crop.plantedAt, timeScale)
  const p = elapsed / def.growMinutes
  if (p >= 1) return 'mature'
  if (p >= 0.66) return 'growing'
  if (p >= 0.33) return 'sprout'
  return 'seed'
}

export function cropStageIndex(plot: Plot, now = Date.now(), timeScale = 1): 0 | 1 | 2 | 3 {
  const s = cropStage(plot, now, timeScale)
  return s === 'seed' ? 0 : s === 'sprout' ? 1 : s === 'growing' ? 2 : 3
}

/** 生长进度 0-1 */
export function cropProgress(plot: Plot, now = Date.now(), timeScale = 1): number {
  if (!plot.crop) return 0
  const def = CROP_BY_ID.get(plot.crop.cropId)
  if (!def || def.growMinutes <= 0) return 0
  return Math.min(1, farmMinutes(now - plot.crop.plantedAt, timeScale) / def.growMinutes)
}

/** 距离成熟还剩多少分钟（负数/0 表示已成熟） */
export function cropRemainingMinutes(plot: Plot, now = Date.now(), timeScale = 1): number {
  if (!plot.crop) return 0
  const def = CROP_BY_ID.get(plot.crop.cropId)
  if (!def) return 0
  const elapsed = farmMinutes(now - plot.crop.plantedAt, timeScale)
  return Math.max(0, def.growMinutes - elapsed)
}

export function isCropMature(plot: Plot, now = Date.now(), timeScale = 1): boolean {
  return !!plot.crop && cropStage(plot, now, timeScale) === 'mature'
}

/** 该作物还能收几次 */
export function cropRemainingHarvests(plot: Plot): number {
  if (!plot.crop) return 0
  const def = CROP_BY_ID.get(plot.crop.cropId)
  if (!def) return 0
  return Math.max(0, def.regrowCount - plot.crop.harvestedCount)
}

export function cropDefOf(plot: Plot) {
  return plot.crop ? CROP_BY_ID.get(plot.crop.cropId) : undefined
}

/** 多年生作物距离衰老还有多少农场分钟（undefined = 非多年生） */
export function cropRemainingLifeMinutes(
  plot: Plot,
  now = Date.now(),
  timeScale = 1,
): number | undefined {
  const def = cropDefOf(plot)
  if (!def?.lifespanMinutes || !plot.crop) return undefined
  const lived = farmMinutes(now - plot.crop.plantedAt, timeScale)
  return Math.max(0, def.lifespanMinutes - lived)
}

/** 多年生作物是否已经衰老（叶子黄了，还能收但快不行了） */
export function isCropAging(plot: Plot, now = Date.now(), timeScale = 1): boolean {
  const remain = cropRemainingLifeMinutes(plot, now, timeScale)
  const def = cropDefOf(plot)
  if (remain == null || !def?.lifespanMinutes) return false
  return remain <= def.lifespanMinutes * 0.2
}

/* ---------------- 动物 ---------------- */

export function animalDefOf(animal: Animal) {
  return ANIMAL_BY_ID.get(animal.animalId)
}

/** 是否已成年 */
export function isAnimalMature(animal: Animal, now = Date.now(), timeScale = 1): boolean {
  const def = animalDefOf(animal)
  if (!def) return false
  return farmMinutes(now - animal.bornAt, timeScale) >= def.matureMinutes
}

/** 成年进度 0-1 */
export function animalMaturityProgress(animal: Animal, now = Date.now(), timeScale = 1): number {
  const def = animalDefOf(animal)
  if (!def || def.matureMinutes <= 0) return 1
  return Math.min(1, farmMinutes(now - animal.bornAt, timeScale) / def.matureMinutes)
}

/**
 * 距离下次产出还需分钟；0 表示可以收了。
 * 幼崽不产出；生病的动物不产出。
 */
export function animalNextProduceMinutes(
  animal: Animal,
  now = Date.now(),
  timeScale = 1,
): number {
  const def = animalDefOf(animal)
  if (!def) return 0
  if (animal.sickAt) return Number.POSITIVE_INFINITY
  if (!isAnimalMature(animal, now, timeScale)) {
    return def.matureMinutes - farmMinutes(now - animal.bornAt, timeScale)
  }
  if (animal.pendingProduce > 0) return 0
  const sinceLast = farmMinutes(now - animal.lastProduceAt, timeScale)
  return Math.max(0, def.produceIntervalMinutes - sinceLast)
}

/**
 * 心情：投喂得当就开心。
 * 生病 → sick；12 小时没喂 → hungry；快老去 → old；3 小时内喂过 → happy。
 */
export function animalMood(animal: Animal, now = Date.now(), timeScale = 1): AnimalMood {
  if (animal.sickAt) return 'sick'
  const def = animalDefOf(animal)
  if (def?.lifespanMinutes) {
    const lived = farmMinutes(now - animal.bornAt, timeScale)
    if (lived >= def.lifespanMinutes * 0.85) return 'old'
  }
  const sinceFed = farmMinutes(now - animal.lastFedAt, timeScale) / 60
  if (sinceFed >= 12) return 'hungry'
  if (sinceFed <= 3) return 'happy'
  return 'normal'
}

/** 动物年龄进度 0-1（相对于寿命） */
export function animalAgeProgress(animal: Animal, now = Date.now(), timeScale = 1): number {
  const def = animalDefOf(animal)
  if (!def?.lifespanMinutes) return 0
  return Math.min(1, farmMinutes(now - animal.bornAt, timeScale) / def.lifespanMinutes)
}

/**
 * 推进农场到 now：把所有已到期的产出累积到 pendingProduce。
 * 纯函数，返回新的 animals 数组。
 *
 * 用算术式推算产出次数，而不是循环累加 —— 离线 30 天时循环会跑很多次，
 * 且有被上限截断导致产出丢失的风险。
 *
 * 同时处理动物寿命：到寿的动物自然老去（时间流速下按农场时间算）。
 */
export function advanceAnimals(
  animals: Animal[],
  now = Date.now(),
  timeScale = 1,
): Animal[] {
  // 单只动物的待收产出上限，防止极端情况下数字失控
  const PENDING_CAP = 999
  let changed = false

  const next: Animal[] = []

  for (const a of animals) {
    const def = animalDefOf(a)
    if (!def) {
      next.push(a)
      continue
    }

    // 已经离世的动物，跳过
    if (a.deceased) {
      next.push(a)
      continue
    }

    // 寿命检查
    if (def.lifespanMinutes && isAnimalExpired(a, def.lifespanMinutes, now, timeScale)) {
      changed = true
      next.push({
        ...a,
        deceased: true,
        diedAt: now,
        lastEvent: `${a.name}陪了我们好久，安安静静地睡着了。`,
      })
      continue
    }

    // 生病期间不产出
    if (a.sickAt) {
      next.push(a)
      continue
    }

    if (!isAnimalMature(a, now, timeScale)) {
      next.push(a)
      continue
    }

    const interval = def.produceIntervalMinutes * 60000
    if (interval <= 0) {
      next.push(a)
      continue
    }

    // 从成年时刻与上次产出时刻中较晚的一个开始算
    const matureAt = a.bornAt + def.matureMinutes * 60000
    const last = Math.max(a.lastProduceAt, matureAt)
    const elapsed = now - last
    if (elapsed < interval) {
      next.push(a)
      continue
    }

    const times = Math.floor(elapsed / interval)
    const gained = times * def.produceAmount
    if (gained <= 0) {
      next.push(a)
      continue
    }

    changed = true
    next.push({
      ...a,
      pendingProduce: Math.min(PENDING_CAP, a.pendingProduce + gained),
      lastProduceAt: last + times * interval,
    })
  }

  return changed ? next : animals
}

/** 农场等级：由累计收获数推算（1 级起步，每级需求递增） */
export function farmLevel(totalHarvests: number): { level: number; into: number; need: number } {
  let level = 1
  let need = 5
  let acc = 0
  while (totalHarvests >= acc + need && level < 99) {
    acc += need
    level++
    need = Math.round(need * 1.45)
  }
  return { level, into: totalHarvests - acc, need }
}

/** 各类作物的上市等级要求（不满足则在商店里显示"未解锁"） */
export function cropUnlockLevel(cropId: string): number {
  return CROP_BY_ID.get(cropId)?.unlockLevel ?? 1
}

/** 动物的上市等级要求 */
export function animalUnlockLevel(animalId: string): number {
  return ANIMAL_BY_ID.get(animalId)?.unlockLevel ?? 1
}

