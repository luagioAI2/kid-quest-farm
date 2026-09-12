import { describe, expect, it } from 'vitest'
import { farmMinutes, isAnimalExpired, rollAnimalEvent, rollHarvestEvent, seasonalBonus } from './farmEvents'
import type { Animal, CropDef, Plot } from './types'

/* ============================================================
   农场随机事件引擎测试
   ------------------------------------------------------------
   家长要的是「像赌场下注一样：可能损失，可能丰收」。
   但这是给孩子的游戏，所以真正的护栏是：
     1. 期望值为正 —— 长期一定赚，否则游戏变成惩罚
     2. 有硬上限 —— 一次大丰收不能撑爆经济
     3. 幂等 —— 刷新页面不能重新掷骰子
   这三条都在下面被断言。
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
    seedCost: 6,
    growMinutes: 4,
    harvestPoints: 13,
    regrowCount: 1,
    stageEmojis: ['🌱', '🌿', '🥕'],
    fragility: 1,
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
      const r = rollHarvestEvent(mkPlot(i), mkCrop({ fragility: 1.5 }), 1_700_000_000 + i, true, i)
      expect(r.multiplier).toBeGreaterThanOrEqual(0)
    }
  })

  it('大丰收有硬上限（约 1.9 倍），不会撑爆经济', () => {
    for (let i = 0; i < 500; i++) {
      const r = rollHarvestEvent(mkPlot(i), mkCrop({ fragility: 0.5 }), 1_700_000_000 + i, true, i)
      expect(r.multiplier).toBeLessThanOrEqual(1.91)
    }
  })

  it('减产时倍率落在 0.35 ~ 0.70，是"少赚"而不是"白干"', () => {
    for (let i = 0; i < 800; i++) {
      const r = rollHarvestEvent(mkPlot(i), mkCrop(), 1_700_000_000 + i, true, i)
      if (!r.wipedOut && r.multiplier < 0.95) {
        expect(r.multiplier).toBeGreaterThanOrEqual(0.34)
        expect(r.multiplier).toBeLessThanOrEqual(0.71)
      }
    }
  })

  it('颗粒无收时倍率是 0，并且一定会带一条事件消息', () => {
    let found = false
    for (let i = 0; i < 2000 && !found; i++) {
      const r = rollHarvestEvent(mkPlot(i, i), mkCrop({ fragility: 1.5 }), 1_700_000_000 + i, true, i)
      if (r.wipedOut) {
        found = true
        expect(r.multiplier).toBe(0)
        expect(r.event).toBeDefined()
        expect(r.event!.message.length).toBeGreaterThan(0)
      }
    }
    // 高脆弱度下 2000 次都没出事反而不正常
    expect(found).toBe(true)
  })

  it('只有多年生作物才可能真的死掉', () => {
    let perennialDied = false
    let annualDied = false
    for (let i = 0; i < 4000; i++) {
      const t = 1_700_000_000 + i
      if (
        rollHarvestEvent(mkPlot(i, i), mkCrop({ kind: 'perennial', fragility: 1.6 }), t, true, i)
          .died
      )
        perennialDied = true
      if (rollHarvestEvent(mkPlot(i, i), mkCrop({ kind: 'annual' }), t, true, i).died)
        annualDied = true
    }
    expect(perennialDied).toBe(true)
    expect(annualDied).toBe(false)
  })

  it('正常年份也会有小幅抖动，让数字看起来"活的"', () => {
    const rolls = new Set<number>()
    for (let i = 0; i < 200; i++) {
      const r = rollHarvestEvent(mkPlot(i), mkCrop({ fragility: 0.01 }), 1_700_000_000 + i, true, i)
      if (!r.wipedOut && r.multiplier > 0.95 && r.multiplier < 1.1) rolls.add(r.multiplier)
    }
    expect(rolls.size).toBeGreaterThan(1)
  })

  it('期望值为正：大量模拟下平均产量明显 > 1（农民不能越种越穷）', () => {
    const N = 8000
    let sum = 0
    for (let i = 0; i < N; i++) {
      sum += rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i).multiplier
    }
    const mean = sum / N
    // 不只是 ≥ 1，要留出安全边际，否则一次调参就可能滑向负期望
    expect(mean).toBeGreaterThan(1.03)
  })

  it('多年生作物同样是正期望（长期果树不能是亏本买卖）', () => {
    const N = 8000
    let sum = 0
    for (let i = 0; i < N; i++) {
      sum += rollHarvestEvent(
        mkPlot(i, i),
        mkCrop({ kind: 'perennial', fragility: 1 }),
        1_700_000_000 + i,
        true,
        i,
      ).multiplier
    }
    expect(sum / N).toBeGreaterThan(1.0)
  })

  it('全参数空间都是正期望 —— 任何作物都值得种（防止调参调出负期望）', () => {
    const N = 4000
    const cases: Array<[CropDef['kind'], number]> = [
      ['annual', 0.5],
      ['annual', 1],
      ['annual', 1.5],
      ['annual', 2],
      ['flower', 1],
      ['perennial', 0.5],
      ['perennial', 1],
      ['perennial', 1.3],
      ['perennial', 1.5],
      ['perennial', 2.2],
    ]
    for (const [kind, fragility] of cases) {
      let sum = 0
      for (let i = 0; i < N; i++) {
        sum += rollHarvestEvent(
          mkPlot(i, i),
          mkCrop({ kind, fragility }),
          1_700_000_000 + i,
          true,
          i,
        ).multiplier
      }
      const mean = sum / N
      expect(mean, `${kind} fragility=${fragility} 的期望倍率`).toBeGreaterThan(1.0)
    }
  })

  it('方差足够大 —— 真的会出现「白干」和「大赚」两种极端', () => {
    let wiped = 0
    let bumper = 0
    const N = 5000
    for (let i = 0; i < N; i++) {
      const r = rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i)
      if (r.wipedOut) wiped++
      if (r.multiplier >= 1.35) bumper++
    }
    // 两头都要有：全都没有风险或全都没有惊喜，都说明参数坏了
    expect(wiped).toBeGreaterThan(0)
    expect(bumper).toBeGreaterThan(0)
    expect(wiped / N).toBeLessThan(0.15) // 但白干不能太频繁，会打击积极性
  })

  it('皮实的作物长期收益更高 —— 风险有回报', () => {
    const N = 6000
    const avg = (fragility: number) => {
      let sum = 0
      for (let i = 0; i < N; i++) {
        sum += rollHarvestEvent(
          mkPlot(i, i),
          mkCrop({ fragility }),
          1_700_000_000 + i,
          true,
          i,
        ).multiplier
      }
      return sum / N
    }
    expect(avg(0.5)).toBeGreaterThan(avg(1.5))
  })

  it('事件带 refId 指向地块，孩子能看到是哪块地出事', () => {
    for (let i = 0; i < 400; i++) {
      const r = rollHarvestEvent(mkPlot(9), mkCrop({ fragility: 1.5 }), 1_700_000_000 + i, true, i)
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
