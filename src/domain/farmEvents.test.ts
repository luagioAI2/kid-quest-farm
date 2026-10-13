import { describe, expect, it } from 'vitest'
import {
  NEUTRAL_MULT,
  farmMinutes,
  isAnimalExpired,
  rollAnimalEvent,
  rollAnimalProduceEvent,
  rollHarvestEvent,
  seasonalBonus,
} from './farmEvents'
import { ANIMALS } from './catalog'
import type { Animal, AnimalDef, CropDef, Plot } from './types'

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

   ⚠️ **第 3 条在 2026-10-12 被家长有意放宽了一次**，但只放宽了「动物 + 明写的效果」：
   三个带 `trait` 的动物（田园犬 / 北极熊 / 长颈鹿）可以挡掉自己这一批的坏档。
   放宽的边界写在文件末尾那组 `AnimalTrait` 用例里，改之前先读完。
   **作物仍然一条都不能有** —— 上面「所有作物共用同一套分布」那条没动。
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

/* ============================================================
   特殊效果（2026-10-12 家长要求）
   ------------------------------------------------------------
   家长原话：

   > 「也可以设定特殊效果。比如狗狗对某些事件预防，长颈鹿会有几率赐福丰收，
   >   北极熊有几率抵御严寒之类的 你看情况设计。」

   这是对 2026-09-15 那条「所有标的共用同一套分布」的**有意放宽**，
   但只放宽了一半：**动物 + 明写在数据里的效果**可以，作物一条都不行。
   这组用例守的就是放宽之后的四条边界：

     1. 效果必须**写在 `AnimalDef.trait` 里**（不是藏在函数里）；
     2. 效果**只能挡坏档** —— 写了好档一律变空操作，宁可无效也不许减产；
     3. 挡掉之后按**中性档**结算，不是按 1（按 1 会超过满产，多出来的卖不掉）；
     4. **幂等**，而且关掉事件开关时不生效（和作物同一条规矩）。

   ⚠️ 别把「chance = 0 等于没有效果」那条删掉 —— 它是**反向验证**：
   没有它，上面「效果真的生效」的断言有可能是空转（比如 warded 恒为 true 也能绿）。
   ============================================================ */

/** 一只最小可用的测试动物（产出物借用鸡蛋，不参与经济，只验机制） */
const BASE_ANIMAL: AnimalDef = {
  id: 'test-animal',
  name: '测试兽',
  emoji: '🐾',
  babyEmoji: '🐾',
  matureMinutes: 10,
  cost: 100,
  produceItemId: 'egg',
  produceItemName: '蛋',
  produceEmoji: '🥚',
  produceIntervalMinutes: 60,
  produceAmount: 4,
  produceTimes: 5,
}

function mkProduceAnimal(id: string, animalId: string, produceCount = 0): Animal {
  return {
    id,
    animalId,
    name: animalId,
    bornAt: 0,
    lastFedAt: 0,
    lastProduceAt: 0,
    pendingProduce: 0,
    produceCount,
  } as unknown as Animal
}

describe('AnimalTrait —— 特殊效果只能挡坏档，不能加产量', () => {
  /** 必定触发、只挡虫害的测试效果（chance 单独覆盖） */
  const ALWAYS_PEST: AnimalDef['trait'] = {
    name: '测试效果',
    desc: '有几率把虫害挡在外面',
    wardMsg: '把虫子挡在了外面',
    emoji: '🛡️',
    wards: ['pest'],
    chance: 1,
  }

  /** 每批产出的**期望倍率**（含枯萎病那一档的 0） */
  function meanMult(def: AnimalDef, n: number): number {
    let sum = 0
    for (let i = 0; i < n; i++) {
      sum += rollAnimalProduceEvent(mkProduceAnimal(`a${i}`, def.id, 3), def, 1_700_000_000 + i, true)
        .multiplier
    }
    return sum / n
  }

  /** 单次产出的**期望个数** —— 和 `useApp.collectAnimal` 同口径 */
  function meanItems(def: AnimalDef, n: number): number {
    const per = def.produceAmount || 1
    let sum = 0
    for (let i = 0; i < n; i++) {
      const r = rollAnimalProduceEvent(mkProduceAnimal(`a${i}`, def.id, 3), def, 1_700_000_000 + i, true)
      sum += r.wipedOut ? 0 : Math.max(0, Math.round(per * r.multiplier))
    }
    return sum / n
  }

  it('中性档倍率是「从表里取」的，不是另外写死一个 0.92', () => {
    expect(NEUTRAL_MULT).toBe(0.92)
    // 两边必须同源：作物的中性档就是这个常量
    for (let i = 0; i < 3000; i++) {
      const r = rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i)
      if (!r.event && !r.wipedOut) expect(r.multiplier).toBe(NEUTRAL_MULT)
    }
  })

  it('关掉事件开关时，效果也不生效（连骰子都不掷）', () => {
    const def: AnimalDef = { ...BASE_ANIMAL, trait: ALWAYS_PEST }
    for (let i = 0; i < 300; i++) {
      const r = rollAnimalProduceEvent(mkProduceAnimal(`o${i}`, def.id, i), def, 1_700_000_000 + i, false)
      expect(r).toEqual({ multiplier: 1, wipedOut: false })
    }
  })

  it('chance = 1 时声明过的坏档一个都漏不掉；没声明的照旧会来', () => {
    // ⚠️ 这条同时钉两件事，缺一不可：
    //   ① 声明过的 `pest` 在 chance = 1 下**一次都不能漏**；
    //   ② 没声明的 `disease` / `weather_bad` **照旧发生** ——
    //      否则说明效果被写成了「一键无敌」，而不是「按档位挡」。
    // 只断言 ① 的话，一个「把所有坏档都挡掉」的实现也能绿。
    const def: AnimalDef = { ...BASE_ANIMAL, trait: ALWAYS_PEST }
    let warded = 0
    const escaped = new Set<string>()
    for (let i = 0; i < 5000; i++) {
      const r = rollAnimalProduceEvent(mkProduceAnimal(`a${i}`, def.id, i), def, 1_700_000_000 + i, true)
      if (r.warded) {
        warded++
        // 按 1 结算会让这一批超过满产，多出来的永远卖不掉（见 useApp.harvest 的甲）
        expect(r.multiplier, '挡掉之后必须是中性档，不是 1').toBe(NEUTRAL_MULT)
        expect(r.wipedOut).toBe(false)
        expect(r.event?.kind).toBe('warded')
        expect(r.event?.message).toContain(def.name)
        expect(r.event?.refId).toBe(`a${i}`)
        continue
      }
      if (r.event && !r.wipedOut) escaped.add(r.event.kind)
    }
    expect(warded, 'chance = 1 却一次都没挡到，说明 wards 或档位对不上').toBeGreaterThan(0)
    expect(escaped.has('pest'), '声明了挡虫害，却还有虫害漏出来').toBe(false)
    expect(escaped.has('disease'), '没声明挡病害，病害却不来了 —— 效果成了「一键无敌」').toBe(true)
    expect(escaped.has('weather_bad'), '没声明挡风灾，风灾却不来了 —— 效果成了「一键无敌」').toBe(true)
  })

  it('挡掉之后这一批「一点没少」—— 产出正好等于满产，不会超过', () => {
    const per = BASE_ANIMAL.produceAmount
    // 中性档 round(4 × 0.92) = 4 = 满产。多一点就会变成卖不掉的库存。
    expect(Math.round(per * NEUTRAL_MULT)).toBe(per)
  })

  it('chance = 0 等于完全没写效果 —— 逐次逐字段一致（反向验证）', () => {
    const plain: AnimalDef = { ...BASE_ANIMAL }
    const zero: AnimalDef = { ...BASE_ANIMAL, trait: { ...ALWAYS_PEST!, chance: 0 } }
    for (let i = 0; i < 3000; i++) {
      const a = rollAnimalProduceEvent(mkProduceAnimal(`a${i}`, plain.id, i), plain, 1_700_000_000 + i, true)
      const b = rollAnimalProduceEvent(mkProduceAnimal(`a${i}`, zero.id, i), zero, 1_700_000_000 + i, true)
      expect(b).toEqual(a)
    }
  })

  it('带效果的动物期望产出确实更高 —— 不是白写一行数据', () => {
    const plain: AnimalDef = { ...BASE_ANIMAL }
    const withTrait: AnimalDef = { ...BASE_ANIMAL, trait: { ...ALWAYS_PEST!, chance: 0.6 } }
    // 只挡虫害（p=0.15）时理论增量 = 0.15 × 0.6 × (4-3) = 0.09 个/次
    expect(meanItems(withTrait, 6000)).toBeGreaterThan(meanItems(plain, 6000) + 0.05)
  })

  it('万一有人把好档写进 wards，效果会变成空操作 —— 绝不反过来减产', () => {
    // `!isGood` 那道兜底就是为这个准备的：误声明由数据契约用例钓出来，
    // 但不能让孩子的收成真的被扣掉。
    const weird: AnimalDef = {
      ...BASE_ANIMAL,
      trait: { ...ALWAYS_PEST!, wards: ['weather_good'] },
    }
    const plain: AnimalDef = { ...BASE_ANIMAL }
    for (let i = 0; i < 3000; i++) {
      const a = rollAnimalProduceEvent(mkProduceAnimal(`a${i}`, weird.id, i), weird, 1_700_000_000 + i, true)
      const b = rollAnimalProduceEvent(mkProduceAnimal(`a${i}`, plain.id, i), plain, 1_700_000_000 + i, true)
      expect(a.multiplier).toBe(b.multiplier)
    }
  })

  it('幂等：同一只动物、同一批产出，刷新多少次都是同一个结果', () => {
    const def: AnimalDef = { ...BASE_ANIMAL, trait: { ...ALWAYS_PEST!, chance: 0.5 } }
    for (let i = 0; i < 300; i++) {
      const a = mkProduceAnimal('same-id', def.id, i)
      expect(rollAnimalProduceEvent(a, def, 1_700_000_000 + i, true)).toEqual(
        rollAnimalProduceEvent(a, def, 1_700_000_000 + i, true),
      )
    }
  })

  it('没有 trait 的动物仍然和作物共用同一套分布（放宽没波及它们）', () => {
    const N = 20000
    let cropSum = 0
    for (let i = 0; i < N; i++) {
      cropSum += rollHarvestEvent(mkPlot(i, i), mkCrop(), 1_700_000_000 + i, true, i).multiplier
    }
    const cropMean = cropSum / N
    const untraited = ANIMALS.filter((a) => !a.trait)
    expect(untraited.length, '没有一只普通动物了？那这条用例就没意义了').toBeGreaterThan(0)
    for (const a of untraited) {
      const m = meanMult(a, N)
      expect(
        Math.abs(m - cropMean),
        `${a.name} 的期望倍率 ${m.toFixed(4)} 偏离作物 ${cropMean.toFixed(4)}`,
      ).toBeLessThan(0.03)
    }
  })
})

describe('特殊效果的数据契约（catalog.ts）', () => {
  /** 表里**真的会掷出来**的坏档。`harvest_poor` / `crop_died` 是枯萎病那条分支的，
   *  不走 `pickTier`，挡它们没有意义（也挡不到）—— 所以不在白名单里。 */
  const ROLLABLE_BAD = new Set(['pest', 'disease', 'weather_bad'])

  it('三只带效果的动物都在，效果名对得上', () => {
    const byId = new Map(ANIMALS.map((a) => [a.id, a]))
    expect(byId.get('dog')?.trait?.name).toBe('看家')
    expect(byId.get('polar-bear')?.trait?.name).toBe('御寒')
    expect(byId.get('giraffe')?.trait?.name).toBe('赐福')
  })

  it('目前**只有三只**带效果 —— 加第四只之前先想清楚经济（见 catalog 文件头第 4 条）', () => {
    expect(
      ANIMALS.filter((a) => a.trait)
        .map((a) => a.id)
        .sort(),
    ).toEqual(['dog', 'giraffe', 'polar-bear'])
  })

  it('效果只能挡「真的会掷出来的坏档」，概率在 (0, 1] 内，且不许重复', () => {
    for (const a of ANIMALS) {
      if (!a.trait) continue
      const t = a.trait
      expect(t.chance, `${a.name} 的概率 ${t.chance}`).toBeGreaterThan(0)
      expect(t.chance, `${a.name} 的概率 ${t.chance}`).toBeLessThanOrEqual(1)
      expect(t.wards.length, `${a.name} 一个档都没挡`).toBeGreaterThan(0)
      expect(new Set(t.wards).size, `${a.name} 的 wards 有重复`).toBe(t.wards.length)
      for (const w of t.wards) {
        expect(ROLLABLE_BAD.has(w), `${a.name} 的 wards 里有挡不到的「${w}」`).toBe(true)
      }
    }
  })

  it('每个效果都能显示出来 —— 界面不能有一个说不出口的效果', () => {
    // 「做了界面不说」和「界面承诺做不到的事」是同一种病：
    // 孩子看不见效果，就学不到东西，这个效果等于白做。
    for (const a of ANIMALS) {
      if (!a.trait) continue
      const t = a.trait
      expect(t.name.length, `${a.name} 的效果没名字`).toBeGreaterThan(0)
      expect(t.wardMsg.length, `${a.name} 的效果没有成功提示`).toBeGreaterThan(0)
      expect(t.emoji.length, `${a.name} 的效果没有 emoji`).toBeGreaterThan(0)
      // 效果是概率的，说明里必须写「有几率」—— 写成必定发生就是骗人
      expect(t.desc, `${a.name} 的说明没写「有几率」`).toContain('有几率')
    }
  })
})
