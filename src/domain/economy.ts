import type { Animal, Plot } from './types'
import {
  ANIMALS,
  ANIMAL_BY_ID,
  CROP_BY_ID,
  CROPS,
  DEFAULT_PROFIT_RATIO,
  roundCap,
} from './catalog'

/* ============================================================
   卖出闸门（上限回收）
   ------------------------------------------------------------
   规则（用户 2026-09-15 锁定）：

     上限回收 = 成本 × (1 + r)          r 由家长设，默认 0.6
     闸门是「一轮」的，不是「终身」的 —— 卖满这一轮就结束，
     下一轮重新买种子、重新算上限。种子永远买得到、地永远能再种。

   为什么归集在**标的**上而不是给背包物品记来源：
   每个标的的产出物 id 是唯一的（蛋 / 毛 / 奶 / 萝卜各归各的），
   所以只要按标的汇总「未结清对象的剩余额度」就够了，
   不需要改 `inventory` 的主键（那要一次 v6 迁移 + 数据迁移）。

   「直接卖」和「存储后市场卖」走的是**同一个**闸门 —— 两条路都从这里扣。
   ============================================================ */

/** 一个「还没卖满」的产出对象（一块地的一轮 / 一只动物的一生） */
export interface CapTarget {
  kind: 'plot' | 'animal'
  /** 地块用 `plot.index`，动物用 `animal.id` */
  ref: string
  /** 还剩多少额度可以卖 */
  remaining: number
}

/* ---------------- 产出物 → 标的 反查 ---------------- */

function buildProducerIndex(): Map<string, { crops: string[]; animals: string[] }> {
  const idx = new Map<string, { crops: string[]; animals: string[] }>()
  const get = (itemId: string) => {
    let v = idx.get(itemId)
    if (!v) {
      v = { crops: [], animals: [] }
      idx.set(itemId, v)
    }
    return v
  }
  for (const c of CROPS) get(c.produceItemId).crops.push(c.id)
  for (const a of ANIMALS) get(a.produceItemId).animals.push(a.id)
  return idx
}

const PRODUCERS = buildProducerIndex()

/** 这个物品是不是某个标的的产出物（不是产出物就卖不了） */
export function isProduceOfSomething(itemId: string): boolean {
  return PRODUCERS.has(itemId)
}

/**
 * 列出该产出物所有「还没卖满」的对象，**按先种 / 先买的顺序**（FIFO 扣减）。
 *
 * 已经卖满的对象**不出现**在结果里 —— 它们就是「毕业」了，
 * 但动物还在农场里、地块也还能再种。
 */
export function capTargetsFor(
  itemId: string,
  plots: Plot[],
  animals: Animal[],
  r = DEFAULT_PROFIT_RATIO,
): CapTarget[] {
  const prod = PRODUCERS.get(itemId)
  if (!prod) return []

  const out: CapTarget[] = []

  for (const cropId of prod.crops) {
    const def = CROP_BY_ID.get(cropId)
    if (!def) continue
    const cap = roundCap(def.seedCost, r)
    // 同一作物的多块地：先种的先扣
    const planted = plots
      .filter((p) => p.crop?.cropId === cropId)
      .sort((a, b) => (a.crop!.plantedAt - b.crop!.plantedAt) || (a.index - b.index))
    for (const p of planted) {
      const remaining = cap - (p.crop!.earnedSoFar ?? 0)
      if (remaining > 0) out.push({ kind: 'plot', ref: String(p.index), remaining })
    }
  }

  for (const animalId of prod.animals) {
    const def = ANIMAL_BY_ID.get(animalId)
    if (!def) continue
    const cap = roundCap(def.cost, r)
    const owned = animals
      .filter((a) => a.animalId === animalId)
      .sort((a, b) => (a.bornAt - b.bornAt) || a.id.localeCompare(b.id))
    for (const a of owned) {
      const remaining = cap - (a.earnedSoFar ?? 0)
      if (remaining > 0) out.push({ kind: 'animal', ref: a.id, remaining })
    }
  }

  return out
}

/** 该产出物当前总共还能卖出多少丰收币（= 所有未结清对象剩余额度之和 + 结转过来的） */
export function remainingCapFor(
  itemId: string,
  plots: Plot[],
  animals: Animal[],
  r = DEFAULT_PROFIT_RATIO,
  /**
   * 从**已经收掉的地块**上结转过来、还没用掉的额度。
   *
   * 没有它的话，「收进背包」对一次性作物就是死路一条 —— 详见
   * `leftoverCapFor` 的注释。
   */
  carry = 0,
): number {
  return capTargetsFor(itemId, plots, animals, r).reduce((s, t) => s + t.remaining, 0) + carry
}

/**
 * 一块地「这一轮」还没用掉的额度 —— 作物离场时要把这个数**结转**出去。
 *
 * 为什么必须有这个函数：闸门是挂在**活着的**标的上的（`capTargetsFor` 只看
 * plots / animals）。而小萝卜、胡萝卜这些**一次性作物收完就变空地**
 * （`useApp.harvest` 里 `crop: undefined`）→ 标的消失 → 剩余额度**凭空蒸发**
 * → 存进背包的那批产出再也找不到额度可卖，`sellProduce` 还会骗孩子说
 * 「这一轮已经卖满啦」。
 *
 * 2026-09-15 由第 4 层界面走查发现：「收进背包」按钮上明写着
 * 「先存着，等市场上价格好的时候自己卖」，而它当时**永远卖不出去**。
 *
 * 结转不违反「每轮上限」：一轮种下去最多还是只带出 `成本 × (1+r)` 的额度，
 * 攒 N 轮就最多带出 N 倍 —— 那正是 N 轮该有的量（每轮都真花了种子钱）。
 */
export function leftoverCapFor(
  cropId: string,
  earnedSoFar: number,
  r = DEFAULT_PROFIT_RATIO,
): number {
  const def = CROP_BY_ID.get(cropId)
  if (!def) return 0
  return Math.max(0, roundCap(def.seedCost, r) - earnedSoFar)
}

/**
 * 把 `amount` 从各对象上按顺序扣掉，返回**新的** plots / animals。
 *
 * 纯函数：不改入参。`amount` 超过总额度时只扣到 0（调用方应先用
 * `remainingCapFor` 夹住，这里是最后一道保险）。
 */
export function applyCapDeduction(
  targets: CapTarget[],
  amount: number,
  plots: Plot[],
  animals: Animal[],
): { plots: Plot[]; animals: Animal[] } {
  if (amount <= 0 || targets.length === 0) return { plots, animals }

  const plotDeduct = new Map<number, number>()
  const animalDeduct = new Map<string, number>()
  let left = amount

  for (const t of targets) {
    if (left <= 0) break
    const take = Math.min(t.remaining, left)
    if (take <= 0) continue
    left -= take
    if (t.kind === 'plot') {
      const idx = Number(t.ref)
      plotDeduct.set(idx, (plotDeduct.get(idx) ?? 0) + take)
    } else {
      animalDeduct.set(t.ref, (animalDeduct.get(t.ref) ?? 0) + take)
    }
  }

  const nextPlots = plots.map((p) => {
    const d = plotDeduct.get(p.index)
    if (!d || !p.crop) return p
    return { ...p, crop: { ...p.crop, earnedSoFar: (p.crop.earnedSoFar ?? 0) + d } }
  })

  const nextAnimals = animals.map((a) => {
    const d = animalDeduct.get(a.id)
    if (!d) return a
    return { ...a, earnedSoFar: (a.earnedSoFar ?? 0) + d }
  })

  return { plots: nextPlots, animals: nextAnimals }
}

/**
 * 在「不超闸门」的前提下，最多能卖几个。
 *
 * 返回 0 就是**这一轮已经卖满了** —— UI 应该说「这轮卖满啦，换点别的种吧」，
 * 而不是让孩子白扔东西。
 *
 * @param quote 卖出 `n` 个能拿多少钱（用市场的 sellQuote，价格有卖压衰减）
 */
export function maxSellable(
  wantCount: number,
  remainingCap: number,
  quote: (n: number) => number,
): { count: number; total: number } {
  if (wantCount <= 0 || remainingCap <= 0) return { count: 0, total: 0 }
  if (quote(wantCount) <= remainingCap) return { count: wantCount, total: quote(wantCount) }
  // 卖压让 quote 次线性，所以按比例缩是安全的上界，再往下修到不超
  let n = Math.max(0, Math.floor((wantCount * remainingCap) / quote(wantCount)))
  while (n > 0 && quote(n) > remainingCap) n--
  return { count: n, total: n > 0 ? quote(n) : 0 }
}
