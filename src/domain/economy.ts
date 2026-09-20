import type { Animal, Plot } from './types'
import {
  ANIMALS,
  ANIMAL_BY_ID,
  capFor,
  CROP_BY_ID,
  CROPS,
  DEFAULT_PROFIT_RATIO,
} from './catalog'

/* ============================================================
   卖出闸门（上限回收）
   ------------------------------------------------------------
   规则（用户 2026-09-15 锁定；2026-09-19 按 B1 整数化）：

     上限回收 = 满产 × 整数单价     ← 由 `capFor()` 给（默认档下 = 成本 × 1.6）
     闸门是「一轮」的，不是「终身」的 —— 卖满这一轮就结束，
     下一轮重新买种子、重新算上限。种子永远买得到、地永远能再种。

   ⚠️ **本文件里所有额度一律走 `capFor(itemId, r)`，不要再退回
   `roundCap(成本, r)`。** 后者是连续小数，孩子到手的丰收币是整枚，
   两者对不齐就会剩货 —— 2026-09-19 修的那个「背包里的萝卜卖不掉」
   正是这么来的，详见 docs/farm-economy-design.md §6.1.3。

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
  // 同一产出物的所有标的共用同一个上限（单价按产出物定，满产也是）
  const cap = capFor(itemId, r)

  for (const cropId of prod.crops) {
    const def = CROP_BY_ID.get(cropId)
    if (!def) continue
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
  return Math.max(0, capFor(def.produceItemId, r) - earnedSoFar)
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
 * @param quote 卖出 `n` 个能拿多少钱（`sellQuote`：现价 × 个数，**线性**）
 */
export function maxSellable(
  wantCount: number,
  remainingCap: number,
  quote: (n: number) => number,
): { count: number; total: number } {
  if (wantCount <= 0 || remainingCap <= 0) return { count: 0, total: 0 }
  if (quote(wantCount) <= remainingCap) return { count: wantCount, total: quote(wantCount) }

  // ⚠️ **不能按比例估。** `sellQuote` 里有 `Math.round`，所以 `quote(n) / n`
  // 并不恒等于单价：单价 0.8、n = 6 时 `round(4.8) = 5`，5 ÷ 6 = 0.833 > 0.8，
  // 按比例估出来只有 3 个，而 `round(0.8 × 4) = 3 ≤ 3.2` 明明卖得掉 4 个。
  // 孩子看到的是「明明还有货、额度也够，就是不让卖」—— 和闸门按金额封顶
  // 造成的剩货是两回事，这个纯粹是算错。
  // （2026-09-18 由 `useApp.test.ts` 的「额度之外的货留在背包里」抓出来：
  //   `sold` 期望 ≥ 4，实际 3。原实现是「按比例估 + 只往下修」，方向反了。）
  //
  // `quote` 单调不减 → 二分找最后一个装得下的 n，结果是**恰好**的。
  //
  // 2026-09-19 补：B1 之后单价是整数，`quote(n) = 单价 × n` 精确可加，
  // 所以这里其实直接 `floor(remainingCap / 单价)` 也行。二分留着是因为
  // `sellQuote` 读的是**当日现价**（会低于单价），线性仍然成立但斜率不是单价。
  let lo = 0
  let hi = wantCount
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (quote(mid) <= remainingCap) lo = mid
    else hi = mid - 1
  }
  return { count: lo, total: lo > 0 ? quote(lo) : 0 }
}
