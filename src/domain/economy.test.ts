import { describe, expect, it } from 'vitest'
import {
  ANIMALS,
  ANIMAL_BY_ID,
  CROPS,
  DEFAULT_PROFIT_RATIO,
  MAX_PROFIT_RATIO,
  MIN_PROFIT_RATIO,
  PRODUCE_BASE_PRICE,
  priceCeilingFor,
  roundCap,
} from './catalog'
import {
  applyCapDeduction,
  capTargetsFor,
  isProduceOfSomething,
  leftoverCapFor,
  maxSellable,
  remainingCapFor,
} from './economy'
import { rollAnimalProduceEvent, rollHarvestEvent } from './farmEvents'
import { farmLevel } from './farm'
import type { Animal, Plot } from './types'

/* ============================================================
   卖出闸门（上限回收）测试
   ------------------------------------------------------------
   用户 2026-09-15 锁定的口径：

     上限回收 = 成本 × (1 + r)      r 默认 0.6，家长可调
     基准单价 = 上限回收 ÷ 总产出量（**按最高产量算**）
     闸门是「一轮」的，不是「终身」的

   这组用例分三段：
     A. 配置表自洽 —— 单价 × 满产 ≤ 上限回收（否则会留下卖不掉的死库存）
     B. 闸门算法 —— 归集、FIFO 扣减、封顶
     C. 真引擎对账 —— 用 `rollHarvestEvent` 实测期望浮盈 / 撞顶率
   ============================================================ */

function mkPlot(index: number, cropId: string, over: Partial<Plot> = {}): Plot {
  return {
    index,
    unlocked: true,
    unlockCost: 0,
    crop: { cropId, plantedAt: 0, harvestedCount: 0 },
    ...over,
  } as unknown as Plot
}

function mkAnimal(id: string, animalId: string, over: Partial<Animal> = {}): Animal {
  return {
    id,
    animalId,
    name: animalId,
    bornAt: 0,
    lastFedAt: 0,
    lastProduceAt: 0,
    pendingProduce: 0,
    ...over,
  } as unknown as Animal
}

/* ---------------- A. 配置表自洽 ---------------- */

describe('配置表：上限回收与基准单价自洽', () => {
  it('roundCap = 成本 × (1 + r)，并把 r 夹在安全区间内', () => {
    expect(roundCap(100)).toBeCloseTo(160, 6)
    expect(roundCap(100, 0.5)).toBeCloseTo(150, 6)
    // 家长乱填也不能把闸门拧成负数或天文数字
    expect(roundCap(100, -5)).toBeCloseTo(100 * (1 + MIN_PROFIT_RATIO), 6)
    expect(roundCap(100, 99)).toBeCloseTo(100 * (1 + MAX_PROFIT_RATIO), 6)
  })

  it('默认 r 是 0.6', () => {
    expect(DEFAULT_PROFIT_RATIO).toBe(0.6)
  })

  it('每个作物：满产 × 基准单价 ≤ 上限回收（否则会剩一个卖不掉的）', () => {
    for (const c of CROPS) {
      const cap = roundCap(c.seedCost)
      const units = (c.produceAmount ?? 1) * c.regrowCount
      const price = PRODUCE_BASE_PRICE[c.produceItemId]
      expect(price, `${c.name} 的产出物 ${c.produceItemId} 没有基准单价`).toBeTypeOf('number')
      expect(
        units * price,
        `${c.name}：${units} 个 × ${price} = ${units * price} 超过了上限 ${cap}`,
      ).toBeLessThanOrEqual(cap + 1e-9)
    }
  })

  it('每只动物：满产 × 基准单价 ≤ 上限回收', () => {
    for (const a of ANIMALS) {
      const cap = roundCap(a.cost)
      const units = a.produceTimes * a.produceAmount
      const price = PRODUCE_BASE_PRICE[a.produceItemId]
      expect(price, `${a.name} 的产出物 ${a.produceItemId} 没有基准单价`).toBeTypeOf('number')
      expect(
        units * price,
        `${a.name}：${units} 个 × ${price} = ${units * price} 超过了上限 ${cap}`,
      ).toBeLessThanOrEqual(cap + 1e-9)
    }
  })

  /**
   * 2026-09-18 家长定的规则：
   * 「设定里市场盈利最高 60%，那最高市场价应该是成本 × 1.6。
   *   意思是波动不能够超过它。」
   *
   * 现价硬顶 = `上限回收 ÷ 满产` = 单位成本 × (1 + r)。这条同时钉住两件事：
   *
   *   ① `硬顶 × 满产 ≤ 上限回收` —— 行情再好也不越过「成本 + 60%」；
   *   ② `round(硬顶 × 满产) ≤ 上限回收` —— 行情最好的时候**一个不剩**。
   *
   * ② 里的 `round` 不能省：`sellQuote` 是 `Math.round(现价 × 个数)`，
   * 玫瑰花 25.6 ÷ 12 = 2.1333… 直接取 2.13 就会 `round(25.56) = 26 > 25.6`，
   * 最后一朵还是卖不掉 —— `priceCeilingFor` 里那个 `floor(上限) + 0.5` 正是为它准备的。
   *
   * 历史：旧口径是 `PRICE_CEILING = 1.6`（基准价的 1.6 倍）。基准价本身就已经等于
   * 「满产刚好卖光」那条线，再乘 1.6 等于把天花板抬到闸门上方 —— 实测 730 天里
   * 6.1% 的产出因此烂在背包里，而多出来的价一分钱都拿不到（被闸门全额追回）。
   */
  it('现价硬顶：满产 × 硬顶 四舍五入后也不越上限（行情最好时一个不剩）', () => {
    const cases = [
      ...CROPS.map((c) => ({
        name: c.name,
        cost: c.seedCost,
        units: (c.produceAmount ?? 1) * c.regrowCount,
        itemId: c.produceItemId,
      })),
      ...ANIMALS.map((a) => ({
        name: a.name,
        cost: a.cost,
        units: a.produceTimes * a.produceAmount,
        itemId: a.produceItemId,
      })),
    ]

    for (const { name, cost, units, itemId } of cases) {
      const cap = roundCap(cost)
      const ceiling = priceCeilingFor(itemId)

      expect(ceiling, `${name} 没有现价硬顶`).toBeGreaterThan(0)
      expect(
        ceiling * units,
        `${name}：硬顶 ${ceiling} × 满产 ${units} 越过了上限回收 ${cap}`,
      ).toBeLessThanOrEqual(cap + 1e-9)
      expect(
        Math.round(ceiling * units),
        `${name}：行情最好时 ${units} 个卖不完（记账 ${Math.round(ceiling * units)} > 上限 ${cap}）`,
      ).toBeLessThanOrEqual(cap)
      expect(
        ceiling,
        `${name} 的硬顶低于基准价，第 0 天建仓价会被夹下去`,
      ).toBeGreaterThanOrEqual((PRODUCE_BASE_PRICE[itemId] ?? 0) - 1e-9)
    }
  })

  it('硬顶跟着家长的 r 走 —— 调档之后「满产卖得完」仍然成立', () => {
    // 家长在设置里能把市场盈利上限调到 `MIN_PROFIT_RATIO ~ MAX_PROFIT_RATIO`。
    // 硬顶 = `上限回收 ÷ 满产`，必须跟着 r 一起动。
    //
    // ⚠️ 这条是补一个**我自己刚犯过的错**：第一版 `priceCeilingFor` 里加了
    // `Math.max(算出来的线, 基准价)` 防止第 0 天建仓价被夹低。但基准价是按
    // `r = 0.6` 算的静态值 —— 家长把 r 调低之后，那个「保底」反而把硬顶顶到
    // 闸门上方，剩货就又回来了。所以保底已删。
    for (const r of [MIN_PROFIT_RATIO, 0.3, DEFAULT_PROFIT_RATIO, 0.9, MAX_PROFIT_RATIO]) {
      for (const c of CROPS) {
        const units = (c.produceAmount ?? 1) * c.regrowCount
        const cap = roundCap(c.seedCost, r)
        expect(
          Math.round(priceCeilingFor(c.produceItemId, r) * units),
          `r=${r} ${c.name}：行情最好时卖不完`,
        ).toBeLessThanOrEqual(cap)
      }
      for (const a of ANIMALS) {
        const units = a.produceTimes * a.produceAmount
        const cap = roundCap(a.cost, r)
        expect(
          Math.round(priceCeilingFor(a.produceItemId, r) * units),
          `r=${r} ${a.name}：行情最好时卖不完`,
        ).toBeLessThanOrEqual(cap)
      }
    }
    // 硬顶确实随 r 变（不是把默认档写死了）
    expect(priceCeilingFor('produce-radish', MIN_PROFIT_RATIO)).toBeLessThan(
      priceCeilingFor('produce-radish', MAX_PROFIT_RATIO),
    )
  })

  it('harvestPoints 是「每次收获的毛收入」，× 收获次数 ≈ 上限回收', () => {
    for (const c of CROPS) {
      const cap = roundCap(c.seedCost)
      const gross = c.harvestPoints * c.regrowCount
      // 展示值只保留 1 位小数，允许 0.5% 的取整误差
      expect(Math.abs(gross - cap) / cap, `${c.name} 的 harvestPoints 与上限对不上`).toBeLessThan(
        0.005,
      )
    }
  })

  it('每个标的的产出物 id 都唯一 —— 闸门才能靠 itemId 归集', () => {
    const seen = new Map<string, string>()
    for (const c of [...CROPS, ...ANIMALS]) {
      const owner = seen.get(c.produceItemId)
      expect(owner, `${c.produceItemId} 同时属于 ${owner} 和 ${c.name}`).toBeUndefined()
      seen.set(c.produceItemId, c.name)
    }
  })
})

/* ---------------- B. 闸门算法 ---------------- */

describe('闸门：归集与扣减', () => {
  it('收藏品不是任何标的的产出物，卖不了', () => {
    expect(isProduceOfSomething('produce-radish')).toBe(true)
    expect(isProduceOfSomething('egg')).toBe(true)
    expect(isProduceOfSomething('fertilizer')).toBe(false)
    expect(isProduceOfSomething('golden-coin')).toBe(false)
  })

  it('非产出物没有闸门对象', () => {
    expect(capTargetsFor('fertilizer', [mkPlot(0, 'radish')], [])).toEqual([])
  })

  it('额度 = 成本 × 1.6，已经卖满的地块不再出现在结果里', () => {
    const fresh = mkPlot(0, 'radish') // 成本 2 → 3.2
    const used = mkPlot(1, 'radish')
    used.crop!.earnedSoFar = 3.2

    const targets = capTargetsFor('produce-radish', [fresh, used], [])
    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({ kind: 'plot', ref: '0', remaining: 3.2 })
  })

  it('同一作物的多块地按「先种的先扣」排序', () => {
    const late = mkPlot(5, 'radish', {
      crop: { cropId: 'radish', plantedAt: 2000, harvestedCount: 0 },
    })
    const early = mkPlot(2, 'radish', {
      crop: { cropId: 'radish', plantedAt: 1000, harvestedCount: 0 },
    })
    const targets = capTargetsFor('produce-radish', [late, early], [])
    expect(targets.map((t) => t.ref)).toEqual(['2', '5'])
  })

  it('多块地的额度会累加', () => {
    const plots = [mkPlot(0, 'radish'), mkPlot(1, 'radish'), mkPlot(2, 'radish')]
    expect(remainingCapFor('produce-radish', plots, [])).toBeCloseTo(3.2 * 3, 6)
  })

  it('动物按「先买的先扣」，额度用成本算', () => {
    const a = mkAnimal('a1', 'chicken', { bornAt: 100 })
    const b = mkAnimal('a2', 'chicken', { bornAt: 50 })
    const targets = capTargetsFor('egg', [], [a, b])
    expect(targets.map((t) => t.ref)).toEqual(['a2', 'a1'])
    expect(targets[0].remaining).toBeCloseTo(roundCap(78), 6)
  })

  it('扣减是纯函数：不改入参，额度按顺序溢出到下一个对象', () => {
    const p0 = mkPlot(0, 'radish')
    const p1 = mkPlot(1, 'radish')
    const targets = capTargetsFor('produce-radish', [p0, p1], [])

    // 要扣 4 块钱，第一块地只有 3.2，溢出的 0.8 落到第二块
    const { plots } = applyCapDeduction(targets, 4, [p0, p1], [])

    expect(p0.crop!.earnedSoFar ?? 0, '入参不能被改').toBe(0)
    expect(plots[0].crop!.earnedSoFar).toBeCloseTo(3.2, 6)
    expect(plots[1].crop!.earnedSoFar).toBeCloseTo(0.8, 6)
  })

  it('扣减超过总额度时只扣到 0，不会变成负数', () => {
    const p0 = mkPlot(0, 'radish')
    const targets = capTargetsFor('produce-radish', [p0], [])
    const { plots } = applyCapDeduction(targets, 999, [p0], [])
    expect(plots[0].crop!.earnedSoFar).toBeCloseTo(3.2, 6)
  })

  it('动物额度同样会被扣', () => {
    const a = mkAnimal('a1', 'chicken')
    const targets = capTargetsFor('egg', [], [a])
    const { animals } = applyCapDeduction(targets, 10, [], [a])
    expect(animals[0].earnedSoFar).toBeCloseTo(10, 6)
  })
})

/* ============================================================
   额度结转：作物离场后，没用完的额度去哪了
   ------------------------------------------------------------
   闸门挂在**活着的**标的上。一次性作物（小萝卜 / 胡萝卜）收完地块就变空地，
   标的消失 → 剩下那点额度会跟着蒸发 → 存进背包的产出永远卖不掉。
   `leftoverCapFor` 就是「作物离场时该搬走多少」。
   ============================================================ */
describe('额度结转：作物离场时把没用完的额度搬走', () => {
  it('一次没收过就离场 → 整份额度都要搬走', () => {
    expect(leftoverCapFor('radish', 0)).toBeCloseTo(3.2, 6) // 成本 2 × 1.6
  })

  it('已经卖过一部分 → 只搬剩下的', () => {
    expect(leftoverCapFor('radish', 3)).toBeCloseTo(0.2, 6)
  })

  it('卖满了再离场 → 没有额度可搬（不能搬出负数）', () => {
    expect(leftoverCapFor('radish', 3.2)).toBeCloseTo(0, 6)
    expect(leftoverCapFor('radish', 99), '卖超了也不能搬出负数').toBe(0)
  })

  it('结转的额度要算进「还能卖多少」', () => {
    // 地里什么都没有（作物已经收掉），但结转里还有 3.2
    expect(remainingCapFor('produce-radish', [], [], DEFAULT_PROFIT_RATIO, 3.2)).toBeCloseTo(3.2, 6)
  })

  it('结转和活着的标的是相加关系', () => {
    const plots = [mkPlot(0, 'radish')] // 活着的那块 3.2
    expect(remainingCapFor('produce-radish', plots, [], DEFAULT_PROFIT_RATIO, 1.5)).toBeCloseTo(
      4.7,
      6,
    )
  })

  it('不传结转时行为和以前完全一样（向后兼容）', () => {
    const plots = [mkPlot(0, 'radish')]
    expect(remainingCapFor('produce-radish', plots, [])).toBeCloseTo(3.2, 6)
  })

  it('家长的 r 同时作用于结转额度的来源（并且照样被夹在 [0.2, 1.2]）', () => {
    // r 会被 roundCap 夹到 MIN_PROFIT_RATIO —— 不能出现「回本都回不了」的设置
    expect(leftoverCapFor('radish', 0, 0)).toBeCloseTo(2 * (1 + MIN_PROFIT_RATIO), 6)
    expect(leftoverCapFor('radish', 0, 1)).toBeCloseTo(4, 6)
    expect(leftoverCapFor('radish', 0, 99)).toBeCloseTo(2 * (1 + MAX_PROFIT_RATIO), 6)
  })
})

describe('maxSellable：在闸门内最多能卖几个', () => {
  it('装得下就全卖', () => {
    expect(maxSellable(5, 100, (n) => n * 10)).toEqual({ count: 5, total: 50 })
  })

  it('装不下就削到不超闸门', () => {
    const { count, total } = maxSellable(100, 30, (n) => n * 10)
    expect(total).toBeLessThanOrEqual(30)
    expect(count).toBe(3)
  })

  it('额度为 0 时一个都不卖（这一轮已经卖满）', () => {
    expect(maxSellable(10, 0, (n) => n * 10)).toEqual({ count: 0, total: 0 })
  })

  it('卖压让单价随数量下降时，削完仍然不超闸门', () => {
    // 次线性报价：卖得越多单价越低
    const quote = (n: number) => n * 10 * Math.pow(0.98, n)
    const { total } = maxSellable(50, 120, quote)
    expect(total).toBeLessThanOrEqual(120)
  })
})

/* ---------------- C. 真引擎对账（2026-09-15 实测） ---------------- */

describe('真引擎对账：期望浮盈与撞顶率', () => {
  /** 样本量。跑一次缓存住，三个用例共用 —— 否则 12 个标的 × 3 遍太慢。 */
  const N = 6000
  const cache = new Map<string, { expRecovery: number; capHit: number; cap: number }>()

  /** 用真 `rollHarvestEvent` 跑一整轮，返回期望回收与撞顶率 */
  function simulate(cropId: string) {
    const hit = cache.get(cropId)
    if (hit) return hit

    const def = CROPS.find((c) => c.id === cropId)!
    const cap = roundCap(def.seedCost)
    const price = PRODUCE_BASE_PRICE[def.produceItemId]
    const perHarvest = def.produceAmount ?? 1

    let sum = 0
    let capped = 0
    for (let t = 0; t < N; t++) {
      let items = 0
      for (let h = 0; h < def.regrowCount; h++) {
        const roll = rollHarvestEvent(
          mkPlot(t, cropId, { crop: { cropId, plantedAt: 0, harvestedCount: h } }),
          def,
          1_700_000_000 + t * 97 + h,
          true,
          t,
        )
        if (roll.wipedOut) continue
        items += Math.max(0, Math.round(perHarvest * roll.multiplier))
      }
      const value = items * price
      sum += Math.min(value, cap)
      if (value > cap) capped++
    }
    const out = { expRecovery: sum / N, capHit: capped / N, cap }
    cache.set(cropId, out)
    return out
  }

  it('作物期望浮盈落在 +40% ~ +55%（口径：60% 上限 × 灾害期望 0.87）', () => {
    for (const c of CROPS) {
      const { expRecovery } = simulate(c.id)
      const profit = (expRecovery - c.seedCost) / c.seedCost
      expect(profit, `${c.name} 的期望浮盈`).toBeGreaterThan(0.4)
      expect(profit, `${c.name} 的期望浮盈`).toBeLessThan(0.55)
    }
  })

  it('撞顶率不再失控 —— 每个作物都低于 25%', () => {
    // §5.6 曾担心「按最高产量定价 → 撞顶率 90%」。
    // 真引擎实测 7%~17%：单次产量 4 的颗粒度 + 中性档 0.92 一起压住了它。
    for (const c of CROPS) {
      const { capHit } = simulate(c.id)
      expect(capHit, `${c.name} 的撞顶率`).toBeLessThan(0.25)
    }
  })

  /* ---------------- 动物：减产骰子（2026-09-16 新增） ---------------- */

  // 周二，避开周末加成，和 §5.6 的口径一致
  const T_ANIMAL = 1_700_000_000

  /**
   * 一次「收下产出」拿到多少 —— 逐字复刻 `useApp.collectAnimal` 的算法：
   *
   *   perCycleOut = round(单次产量 × 骰子倍率)
   *   这一批收到   = perCycleOut × 批里的轮数
   *
   * 骰子走**真引擎** `rollAnimalProduceEvent`（和作物共用同一套 `HARVEST_TIERS`）。
   * `cycles` = 这一批攒了几轮，`produceCount` = 那一刻已产过几轮 ——
   * 两者必须分开传：种子用的是 `produceCount`，批次大小用的是 `cycles`。
   */
  function animalBatch(
    a: (typeof ANIMALS)[number],
    cycles: number,
    produceCount: number,
    t: number,
  ): number {
    const roll = rollAnimalProduceEvent(
      mkAnimal(`a${t}`, a.id, { produceCount }),
      a,
      T_ANIMAL + t * 97,
      true,
    )
    const perCycle = a.produceAmount || 1
    const perCycleOut = roll.wipedOut ? 0 : Math.max(0, Math.round(perCycle * roll.multiplier))
    return perCycleOut * cycles
  }

  /** `collectAll = true` 攒满整批一次收；`false` 每产出一轮就收一次 */
  function animalProfit(a: (typeof ANIMALS)[number], collectAll: boolean): number {
    const cap = roundCap(a.cost)
    const price = PRODUCE_BASE_PRICE[a.produceItemId]
    let sum = 0
    for (let t = 0; t < N; t++) {
      let items = 0
      if (collectAll) {
        items = animalBatch(a, a.produceTimes, a.produceTimes, t)
      } else {
        for (let c = 1; c <= a.produceTimes; c++) items += animalBatch(a, 1, c, t)
      }
      sum += Math.min(items * price, cap)
    }
    return (sum / N - a.cost) / a.cost
  }

  it('动物也吃减产骰子，期望浮盈落到和作物同一档（+40% ~ +55%）', () => {
    // 2026-09-16 用户定：给动物也加一层减产。
    // 改之前动物**不掷骰子**（`advanceAnimals` 只按算术累加产出），
    // 所以期望回收 = 上限回收 → 浮盈恒为 +60%，比作物的 +44~48% 高出一截。
    // 现在动物和作物**共用同一套 `HARVEST_TIERS`**，浮盈落回同一档。
    for (const a of ANIMALS) {
      const profit = animalProfit(a, true)
      expect(profit, `${a.name} 的期望浮盈`).toBeGreaterThan(0.4)
      expect(profit, `${a.name} 的期望浮盈`).toBeLessThan(0.55)
    }
  })

  it('动物的期望浮盈和「攒几轮一起收」无关 —— 只和标的本身有关', () => {
    // ⚠️ 这条是防回归的关键。`round()` 的颗粒度是 1 个：如果骰子直接乘**整批**，
    // 取整落在不同位置会算出不同的期望（实测 小鸡 34.5% vs 45.9%，差 11 个点）——
    // 等于**孩子的收益取决于他怎么点按钮**，而这个他根本看不见。
    // 现在骰子作用在**单次产出**上再线性放大，两种收货方式必须基本一致。
    for (const a of ANIMALS) {
      const all = animalProfit(a, true)
      const oneByOne = animalProfit(a, false)
      expect(
        Math.abs(all - oneByOne),
        `${a.name}：攒满整批收 ${(all * 100).toFixed(1)}% vs 每轮各收一次 ${(oneByOne * 100).toFixed(1)}%`,
      ).toBeLessThan(0.04)
    }
  })

  it('动物的减产骰子真的掷得出多种结果（不是恒等于 1）', () => {
    // 反向验证：万一哪天有人把减产挪进 `advanceAnimals`、或让 multiplier 恒为 1，
    // 上面两条会红；这条再补一刀 —— 直接断言「确实掷出过不止一种倍率」。
    const a = ANIMALS[0]
    const outcomes = new Set<number>()
    for (let t = 0; t < 400; t++) {
      const roll = rollAnimalProduceEvent(
        mkAnimal(`z${t}`, a.id, { produceCount: a.produceTimes }),
        a,
        T_ANIMAL + t * 97,
        true,
      )
      outcomes.add(roll.multiplier)
    }
    expect(outcomes.size, '减产骰子只掷出一种结果 = 等于没掷').toBeGreaterThan(1)
    expect(outcomes.has(1), '必须能掷到小于 1 的减产结果').toBe(false)
  })

  it('每分钟浮盈：同一个档位内随解锁等级递增（被动档位故意更低）', () => {
    // §5.4 三档定位：作物（主动，要一直回来收）1×、果树（半挂机）约 0.5×、
    // 动物（纯挂机）0.2~0.3×。所以「全局严格递增」是**错的** ——
    // 苹果树 L4 的每分钟浮盈低于番茄 L3，那是用「不用一直回来」换来的。
    // 真正要守的是：**同一个档位内部**，高等级不能比低等级差。
    const groups = new Map<string, Array<{ name: string; level: number; rate: number }>>()
    for (const c of CROPS) {
      const { expRecovery } = simulate(c.id)
      const total = c.growMinutes + (c.regrowCount - 1) * (c.regrowMinutes ?? c.growMinutes)
      const kind = c.kind ?? 'annual'
      const list = groups.get(kind) ?? []
      list.push({ name: c.name, level: c.unlockLevel ?? 1, rate: (expRecovery - c.seedCost) / total })
      groups.set(kind, list)
    }

    for (const [kind, list] of groups) {
      const levels = [...new Set(list.map((x) => x.level))].sort((a, b) => a - b)
      let prevMax = Number.NEGATIVE_INFINITY
      let prevLevel = -1
      for (const lv of levels) {
        const rates = list.filter((x) => x.level === lv).map((x) => x.rate)
        const lo = Math.min(...rates)
        if (prevLevel >= 0) {
          expect(
            lo,
            `${kind} 档 L${lv} 的最低每分钟浮盈 ${lo.toFixed(3)} 低于 L${prevLevel} 的最高值 ${prevMax.toFixed(3)}`,
          ).toBeGreaterThan(prevMax)
        }
        prevMax = Math.max(...rates)
        prevLevel = lv
      }
    }
  })

  it('ANIMAL_BY_ID 覆盖了所有动物（闸门反查用）', () => {
    for (const a of ANIMALS) expect(ANIMAL_BY_ID.get(a.id)).toBeDefined()
  })
})

/* ---------------- D. 种子解锁（2026-09-15 死锁修复） ---------------- */

describe('种子解锁：新农场必须能开局', () => {
  it('0 收获时农场就是 1 级', () => {
    expect(farmLevel(0).level).toBe(1)
  })

  it('0 收获时，L1 作物必须是解锁的 —— 否则农场开局即死锁', () => {
    // 曾经的 bug：种子商店拿 `unlockLevel` 跟**收获次数**比，于是 `1 > 0` 恒真，
    // **12 个种子全是锁的**；而没种子就种不了、种不了就永远没收获。
    // 判据必须是「农场等级」。E2E 探针实测过：0 收获时 12/12 按钮 disabled。
    const lv = farmLevel(0).level
    const openable = CROPS.filter((c) => (c.unlockLevel ?? 1) <= lv)
    expect(openable.length, '至少要有一档开局就能买的种子').toBeGreaterThan(0)
    for (const c of openable) {
      expect((c.unlockLevel ?? 0) > lv, `${c.name} 在 0 收获时被锁住了`).toBe(false)
    }
  })

  it('每个作物的解锁等级都真的能达到（不会卡在某个等级上）', () => {
    for (const c of CROPS) {
      const need = c.unlockLevel ?? 1
      let h = 0
      while (farmLevel(h).level < need && h < 5000) h++
      expect(h, `${c.name} 需要 ${need} 级农场，但 5000 次收获都升不到`).toBeLessThan(5000)
    }
  })
})
