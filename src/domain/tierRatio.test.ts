import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIER_RATIO,
  MAX_TIER_RATIO,
  MIN_TIER_RATIO,
  TIER_RATIO_PRESETS,
  clampTierRatio,
  tierRatioFor,
} from './tierRatio'

/* ============================================================
   签到阶梯倍率（2026-10-10 家长要求「阶梯分设置」）
   ------------------------------------------------------------
   和 cash.ts 那组不一样：这个倍率**参与计算**（进 defaultTiers →
   checkInPayout → 真正落账的分数）。所以这里除了守住默认值和夹取
   区间，还要守住「默认值就是原来写死的那个 0.8」—— 老库升上来
   行为必须一字不变，否则等于偷偷改了一次家长没要求的数值。
   倍率**算出来的数**在 recurrence.test.ts 里测（那边能 import defaultTiers）。
   ============================================================ */

describe('阶梯倍率 —— 默认值与夹取', () => {
  it('默认 0.8 —— 就是原来写死在 defaultTiers 里的那个系数', () => {
    expect(DEFAULT_TIER_RATIO).toBe(0.8)
  })

  it('缺省 / 非法值一律退回默认档（不能变成 NaN 一路传进 Math.round）', () => {
    for (const bad of [undefined, NaN, Infinity, -Infinity]) {
      expect(clampTierRatio(bad), String(bad)).toBe(DEFAULT_TIER_RATIO)
    }
  })

  it('夹在 [0.2, 1.5]，且默认档落在区间内部', () => {
    expect(clampTierRatio(0)).toBe(MIN_TIER_RATIO)
    expect(clampTierRatio(-3)).toBe(MIN_TIER_RATIO)
    expect(clampTierRatio(99)).toBe(MAX_TIER_RATIO)
    expect(MIN_TIER_RATIO).toBeLessThan(DEFAULT_TIER_RATIO)
    expect(MAX_TIER_RATIO).toBeGreaterThan(DEFAULT_TIER_RATIO)
  })

  it('保留 2 位小数 —— 界面上的「80%」存下来必须还是同一个数', () => {
    expect(clampTierRatio(0.8)).toBe(0.8)
    expect(clampTierRatio(1.25)).toBe(1.25)
    // 手输的零头收掉，否则 0.333 会让三档分数都带上小尾巴
    expect(clampTierRatio(0.333)).toBe(0.33)
    expect(clampTierRatio(0.876)).toBe(0.88)
  })
})

/* ============================================================
   按任务取（2026-10-11 家长要「每个任务设一个倍率」）
   ------------------------------------------------------------
   这个函数是「这条签到任务实际按多少算」的**唯一事实源**，三个读者
   共用：编辑器预览、家长审核卡、真正发分（`checkInPayout`）。
   所以这里守的不是「算术对不对」，而是**取值规则有没有分叉**。

   ⚠️ 2026-10-12 家长拍板「不需要全局设定梯度、连续的。每个任务单独，
   有默认的就行了」，于是原来那个 `fallback` 参数（指向
   `settings.checkInTierRatio`）连同设置里那个字段一起删了。
   现在只有两级：**任务自己的 → 内置默认**。
   这几条测试也跟着从「任务 > 全局」改成「任务 → 默认」。
   ============================================================ */

describe('tierRatioFor —— 任务自己的，或者内置默认', () => {
  it('★ 任务设过 → 用任务的', () => {
    expect(tierRatioFor({ checkInTierRatio: 0.2 })).toBe(0.2)
    expect(tierRatioFor({ checkInTierRatio: 1.5 })).toBe(1.5)
  })

  it('★ 任务没设 → 兜到 DEFAULT_TIER_RATIO，不报错（老任务 / 老备份走的就是这条）', () => {
    expect(tierRatioFor({ checkInTierRatio: undefined })).toBe(DEFAULT_TIER_RATIO)
    expect(tierRatioFor({})).toBe(DEFAULT_TIER_RATIO)
  })

  it('★ 任务上是个越界值 → 走 clamp，不是原样透传', () => {
    // 导入的旧备份 / 手改的 IndexedDB 都能塞进越界值，而它会变成账本里的分
    expect(tierRatioFor({ checkInTierRatio: 99 })).toBe(MAX_TIER_RATIO)
    expect(tierRatioFor({ checkInTierRatio: 0 })).toBe(MIN_TIER_RATIO)
    expect(tierRatioFor({ checkInTierRatio: NaN })).toBe(DEFAULT_TIER_RATIO)
  })

  it('★ 任务上写了 0 也算「设过」—— 0 会被夹成下限，但**不会**兜到默认', () => {
    // 这条是「用 `!= null` 还是用 `||`」的分水岭：
    // 写成 `task.x || DEFAULT_TIER_RATIO` 的话，0 是 falsy，
    // 会静默兜到 0.8，家长设了个「最小档」，结果拿到的是默认的 80%。
    expect(tierRatioFor({ checkInTierRatio: 0 })).toBe(MIN_TIER_RATIO)
    expect(tierRatioFor({ checkInTierRatio: 0 })).not.toBe(DEFAULT_TIER_RATIO)
  })

  it('★ 不传参数 = 完全没有覆盖 = 内置默认（编辑器/设置页的「默认是多少」靠它）', () => {
    // `tierRatioFor({})` 被用来渲染「不单独设，用默认的 N%」那句。
    // 它必须等于真正的默认，否则界面上会写一个不存在的数。
    expect(tierRatioFor({})).toBe(DEFAULT_TIER_RATIO)
  })
})

describe('界面档位常量', () => {
  it('★ 首尾两项就是夹取上下限 —— 不然界面上会出现一个点不出效果的档', () => {
    expect(TIER_RATIO_PRESETS[0]).toBe(MIN_TIER_RATIO)
    expect(TIER_RATIO_PRESETS[TIER_RATIO_PRESETS.length - 1]).toBe(MAX_TIER_RATIO)
  })

  it('★ 每个档位原样夹一遍都不变 —— 预设值必须都在合法区间内', () => {
    for (const v of TIER_RATIO_PRESETS) {
      expect(clampTierRatio(v), `${Math.round(v * 100)}%`).toBe(v)
    }
  })

  it('★ 含默认档 0.8 —— 设置页和任务编辑页都靠它显示「现在是多少」', () => {
    expect(TIER_RATIO_PRESETS as readonly number[]).toContain(DEFAULT_TIER_RATIO)
  })
})
