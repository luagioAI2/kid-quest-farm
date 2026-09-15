import { describe, expect, it } from 'vitest'
import { farmMinutes, isAnimalExpired, rollAnimalEvent, rollHarvestEvent, seasonalBonus } from './farmEvents'
import type { Animal, CropDef, Plot } from './types'

/* ============================================================
   农场随机事件引擎测试
   ------------------------------------------------------------
   2026-09-15 口径变更（用户锁定）：

     基准单价 = 上限回收 ÷ 总产出量（按最高产量算）

   也就是说 60% 的浮盈**已经算进单价里了**，产量端本来就该打折。
   `E[倍率] ≈ 0.87 < 1` 是设计，不是 bug。

   ⚠️ 旧的「期望必须 > 1」是**旧口径**的要求（当时基准价按无灾产出反推，
   期望 > 1 才不亏）。那批断言已经作废，不要因为「测试红了」就把它改回来。

   现在真正要守住的四条：
     1. **幂等** —— 刷新页面不能重新掷骰子
     2. **有硬上限** —— 单次最多 1.2 倍，撑不爆经济
     3. **分布是共享的** —— 期望倍率与作物 id 无关（没有「这作物更娇气」）
     4. **两头都要有** —— 绝收 1% 的「赌场感」 + 风调雨顺 10% 的惊喜
   ============================================================ */

function mkPlot(index: number, harvestedCount = 0): Plot {
  return {
    index,
    unlocked: true,
    crop: {
      cropId: 'carrot',
      plantedAt: 0,
      harvestedCount,
      lastWateredAt: 0,
    },
  } as unknown as Plot
}

function mkCrop(over: Partial<CropDef> = {}): CropDef {
  return {
    id: 'carrot',
    name: '胡萝卜',
    emoji: '🥕',
    seedCost: 4,
    growMinutes: 3,
    harvestPoints: 6.4,
    produceItemId: 'produce-carrot',
    produceAmount: 4,
    regrowCount: 1,
    stageEmojis: ['🌱', '🌿', '🥕'],
    ...over,
  } as CropDef
}

function mkAnimal(over: Partial<Animal> = {}): Animal {
  return {
    id: 'an-1',
    animalId: 'chicken',
    name: '小鸡',
    bornAt: 0,
    lastFedAt: 0,
    lastCollectAt: 0,
    pending: 0,
    ...over,
  } as Animal
}

/** 采样若干次收获，返回平均倍率 */
function meanMultiplier(crop: CropDef, n: number): number {
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum += rollHarvestEvent(mkPlot(i, i), crop, 1_700_000_000 + i, true, i).multiplier
  }
  return sum / n
}

/* ---------------- 节假日 / 周末加成 ---------------- */

describe('seasonalBonus —— 刻意不暴露在 UI 上的产出加成', () => {
  /** 构造一个确定是星期几的本地时间 */
  function atSundayOffset(daysFromSunday: number): number {
    // 2026-09-06 是周日
    const d = new Date(2026, 8, 6 + daysFromSunday, 12, 0, 0)
    return d.getTime()
  }

  it('周六和周日明显高于工作日', () => {
    const sunday = seasonalBonus(atSundayOffset(0))
    const monday = seasonalBonus(atSundayOffset(1))
    const saturday = seasonalBonus(atSundayOffset(6))
    expect(sunday).toBeGreaterThan(monday)
    expect(saturday).toBeGreaterThan(monday)
  })

  it('周五有小幅加成，制造「周末要来了」的感觉', () => {
    const friday = seasonalBonus(atSundayOffset(5))
    const tuesday = seasonalBonus(atSundayOffset(2))
    expect(friday).toBeGreaterThan(tuesday)
    expect(friday).toBeLessThan(seasonalBonus(atSundayOffset(6)))
  })

  it('儿童节加成最高', () => {
    const childrensDay = new Date(2026, 5, 1, 12, 0, 0).getTime()
    expect(seasonalBonus(childrensDay)).toBeGreaterThanOrEqual(1.8)
  })

  it('普通工作日就是 1 倍，不会莫名其妙变高', () => {
    // 2026-09-08 是周二，无节假日
    expect(seasonalBonus(new Date(2026, 8, 8, 12, 0, 0).getTime())).toBe(1)
  })

  it('任何时候加成都是正数，不会把收成变成 0 或负数', () => {
    for (let i = 0; i < 400; i++) {
      const t = new Date(2026, 0, 1, 12).getTime() + i * 86400000
      expect(seasonalBonus(t)).toBeGreaterThan(0)
    }
  })
})

describe('farmMinutes', () => {
  it('按 timeScale 线性换算现实时间', () => {
    expect(farmMinutes(60000, 1)).toBe(1)
    expect(farmMinutes(60000, 12)).toBe(12)
    expect(farmMinutes(0, 60)).toBe(0)
  })

  it('timeScale = 0 时农场时间冻结（用于暂停）', () => {
    expect(farmMinutes(86400000, 0)).toBe(0)
  })
})

/* ---------------- 收获事件 ---------------- */

describe('rollHarvestEvent —— 种植的下注感', () => {
  it('关掉事件开关时永远风调雨顺、倍率恰好 1', () => {
    for (let i = 0; i < 50; i++) {
      const r = rollHarvestEvent(mkPlot(i), mkCrop(), 1_700_000_000_000, false, i)
      expect(r).toEqual({ multiplier: 1, wipedOut: false, died: false })
    }
  })

  it('同一块地 + 同一次收获 → 结果完全一致（刷新不会重掷）', () => {
    const t = 1_700_000_000_000
    const a = rollHarvestEvent(mkPlot(3, 2), mkCrop(), t, true, 7)
    const b = rollHarvestEvent(mkPlot(3, 2), mkCrop(), t, true, 7)
    expect(a).toEqual(b)
  })

  it('换一块地或换一次收获，结果会不同（不是所有地一起遭殃）', () => {
    const t = 1_700_000_000_000
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      seen.add(JSON.stringify(rollHarvestEvent(mkPlot(i), mkCrop(), t, true, 0).multiplier))
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('倍率永远非负 —— 绝不会算出负收成', () => {
    for (let i = 0; i < 300; i++) {
      const r = rollHarvestEvent(mkPlot(i), mkCrop(), 1_700_000_000 + i, true, i)
      expect(r.multiplier).toBeGreaterThanOrEqual(0)
    }
  })

  it('大丰收有硬上限（1.2 倍），不会撑爆经济', () => {
    for (let i = 0; i < 3000; i++) {
      const r = rollHarvestEvent(mkPlot(i), mkCrop(), 1_700_000_000 + i, true, i)
      expect(r.multiplier).toBeLessThanOrEqual(1.2)
    }
  })

  it('减产档落在 0.45 ~ 0.80，是「少赚」而不是「白干」', () => {
    let checked = 0
    for (let i = 0; i < 4000; i++) {
      const r = rollHarvestEvent(mkPlot(i), mkCrop(), 1_700_000_000 + i, true, i)
      if (!r.wipedOut && r.multiplier < 0.9) {
        checked++
        expect(r.multiplier).toBeGreaterThanOrEqual(0.44)
        expect(r.multiplier).toBeLessThanOrEqual(0.81)
      }
    }
    // 减产档合计 25%（虫灾 15 + 病毒 6 + 风灾 4），不可能一次都没抽到
    expect(checked).toBeGreaterThan(500)
  })

  it('「什么都没发生」是一个固定档：恰好 0.92，而且不生成事件', () => {
    let neutral = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      const r = rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i)
      if (!r.event && !r.wipedOut) {
        neutral++
        expect(r.multiplier).toBe(0.92)
      }
    }
    // 中性档 p = 0.64，应该是绝对大头
    expect(neutral / N).toBeGreaterThan(0.5)
  })

  it('颗粒无收时倍率是 0，并且一定会带一条事件消息', () => {
    let found = false
    for (let i = 0; i < 2000 && !found; i++) {
      const r = rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i)
      if (r.wipedOut) {
        found = true
        expect(r.multiplier).toBe(0)
        expect(r.event).toBeDefined()
        expect(r.event!.message.length).toBeGreaterThan(0)
      }
    }
    // 枯萎病 1%，2000 次都没出事反而不正常
    expect(found).toBe(true)
  })

  it('只有多年生作物才可能真的死掉', () => {
    let perennialDied = false
    let annualDied = false
    for (let i = 0; i < 4000; i++) {
      const t = 1_700_000_000 + i
      if (rollHarvestEvent(mkPlot(i, i), mkCrop({ kind: 'perennial' }), t, true, i).died)
        perennialDied = true
      if (rollHarvestEvent(mkPlot(i, i), mkCrop({ kind: 'annual' }), t, true, i).died)
        annualDied = true
    }
    expect(perennialDied).toBe(true)
    expect(annualDied).toBe(false)
  })

  /* ---------------- 新口径的核心断言 ---------------- */

  it('期望倍率 ≈ 0.87，故意小于 1 —— 不要去「修」', () => {
    // 旧口径要求 > 1（基准价按无灾产出反推，期望必须 > 1 才不亏）。
    // 新口径下 60% 浮盈已经算进基准单价里，产量端本来就该打折。
    const mean = meanMultiplier(mkCrop(), 20000)
    expect(mean).toBeGreaterThan(0.85)
    expect(mean).toBeLessThan(0.9)
  })

  it('所有作物共用同一套分布 —— 期望倍率与作物 id 无关', () => {
    // 一旦给某个作物单独调概率，§5.6 那张「期望浮盈 +31%~+41%」的表就作废了。
    for (const id of ['radish', 'rose', 'pumpkin', 'magic-bean', 'apple-tree']) {
      const mean = meanMultiplier(mkCrop({ id }), 8000)
      expect(mean, `${id} 的期望倍率`).toBeGreaterThan(0.83)
      expect(mean, `${id} 的期望倍率`).toBeLessThan(0.92)
    }
  })

  it('档位频率与配置表一致（改表必须同步改这里）', () => {
    const N = 30000
    const counts: Record<string, number> = {}
    let wiped = 0
    for (let i = 0; i < N; i++) {
      const r = rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i)
      if (r.wipedOut) {
        wiped++
        continue
      }
      const k = r.event?.kind ?? 'none'
      counts[k] = (counts[k] ?? 0) + 1
    }
    const f = (k: string) => (counts[k] ?? 0) / N
    expect(wiped / N).toBeCloseTo(0.01, 2)
    expect(f('none')).toBeCloseTo(0.64, 1)
    expect(f('weather_good')).toBeCloseTo(0.1, 1)
    expect(f('pest')).toBeCloseTo(0.15, 1)
    expect(f('disease')).toBeCloseTo(0.06, 1)
    expect(f('weather_bad')).toBeCloseTo(0.04, 2)
  })

  it('方差足够大 —— 真的会出现「白干」和「大赚」两种极端', () => {
    let wiped = 0
    let bumper = 0
    const N = 8000
    for (let i = 0; i < N; i++) {
      const r = rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i)
      if (r.wipedOut) wiped++
      if (r.multiplier >= 1.1) bumper++
    }
    // 两头都要有：全都没有风险或全都没有惊喜，都说明参数坏了
    expect(wiped).toBeGreaterThan(0)
    expect(bumper).toBeGreaterThan(0)
    // 但绝收不能太频繁，会打击积极性（表里 1%）
    expect(wiped / N).toBeLessThan(0.03)
    // 风调雨顺 10%，是「下注赢了」的正反馈来源
    expect(bumper / N).toBeGreaterThan(0.05)
  })

  it('事件带 refId 指向地块，孩子能看到是哪块地出事', () => {
    for (let i = 0; i < 400; i++) {
      const r = rollHarvestEvent(mkPlot(9), mkCrop(), 1_700_000_000 + i, true, i)
      if (r.event) {
        expect(r.event.refId).toBe('9')
        expect(r.event.createdAt).toBe(1_700_000_000 + i)
        break
      }
    }
  })
})

/* ---------------- 动物事件 ---------------- */

describe('rollAnimalEvent —— 养动物的风险', () => {
  it('事件开关关掉时不会生病', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollAnimalEvent(mkAnimal({ id: `a${i}` }), { id: 'chicken', name: '鸡', emoji: '🐔' }, 5, Date.now(), false)
      expect(r).toEqual({ sick: false, died: false })
    }
  })

  it('没经过农场天数就不掷骰子（刚养的动物不会立刻生病）', () => {
    for (let i = 0; i < 100; i++) {
      const r = rollAnimalEvent(mkAnimal({ id: `a${i}` }), { id: 'chicken', name: '鸡', emoji: '🐔' }, 0, Date.now(), true)
      expect(r.sick).toBe(false)
    }
  })

  it('已经离世的动物不再触发任何事件', () => {
    const dead = mkAnimal({ id: 'dead-1', deceased: true })
    for (let i = 0; i < 100; i++) {
      const r = rollAnimalEvent(dead, { id: 'chicken', name: '鸡', emoji: '🐔' }, 30, Date.now(), true)
      expect(r).toEqual({ sick: false, died: false })
    }
  })

  it('长时间不管时确实会出现生病，并带上可读消息', () => {
    let found = false
    for (let i = 0; i < 3000 && !found; i++) {
      const r = rollAnimalEvent(
        mkAnimal({ id: `a${i}` }),
        { id: 'chicken', name: '小鸡', emoji: '🐔', fragility: 1.5 },
        10,
        1_700_000_000 + i,
        true,
      )
      if (r.sick) {
        found = true
        expect(r.event?.kind).toBe('animal_sick')
        expect(r.event?.message).toContain('小鸡')
      }
    }
    expect(found).toBe(true)
  })

  it('同一天重复检查结果一致（幂等）', () => {
    const a = mkAnimal({ id: 'x-1', lastFedAt: 1_700_000_000_000 })
    const t = 1_700_100_000_000
    const def = { id: 'chicken', name: '鸡', emoji: '🐔', fragility: 1.4 }
    expect(rollAnimalEvent(a, def, 7, t, true)).toEqual(rollAnimalEvent(a, def, 7, t, true))
  })

  it('喂食后风险重新掷骰（喂过就换了一个 seed）', () => {
    const hungry = mkAnimal({ id: 'x-2', lastFedAt: 0 })
    const fed = mkAnimal({ id: 'x-2', lastFedAt: 999_999_999_999 })
    const def = { id: 'chicken', name: '鸡', emoji: '🐔', fragility: 2 }
    const t = 1_700_000_000_000
    const a = rollAnimalEvent(hungry, def, 20, t, true)
    const b = rollAnimalEvent(fed, def, 20, t, true)
    // 至少不能因为「喂过」就让风险变高
    expect(a.died).toBe(false)
    expect(b.died).toBe(false)
  })

  it('脆弱度越高越容易生病', () => {
    const count = (fragility: number) => {
      let n = 0
      for (let i = 0; i < 4000; i++) {
        if (
          rollAnimalEvent(mkAnimal({ id: `z${i}` }), { id: 'c', name: 'c', emoji: '🐔', fragility }, 6, 1_700_000_000 + i, true).sick
        )
          n++
      }
      return n
    }
    expect(count(1.6)).toBeGreaterThan(count(0.5))
  })
})

describe('isAnimalExpired —— 动物有寿命', () => {
  it('没有设定寿命的动物永远不老', () => {
    expect(isAnimalExpired(mkAnimal(), undefined, Date.now(), 1)).toBe(false)
  })

  it('活的农场时间超过寿命就自然老去', () => {
    const born = 1_700_000_000_000
    // 寿命 100 农场分钟，1× 流速下需要现实 100 分钟
    expect(isAnimalExpired(mkAnimal({ bornAt: born }), 100, born + 99 * 60000, 1)).toBe(false)
    expect(isAnimalExpired(mkAnimal({ bornAt: born }), 100, born + 100 * 60000, 1)).toBe(true)
  })

  it('时间流速调快，寿命对应缩短（这才是"时间流速"的意义）', () => {
    const born = 1_700_000_000_000
    // 12× 流速下，现实 10 分钟 = 农场 120 分钟 > 100
    expect(isAnimalExpired(mkAnimal({ bornAt: born }), 100, born + 10 * 60000, 12)).toBe(true)
  })
})
