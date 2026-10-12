import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STREAK_CAP,
  DEFAULT_STREAK_PER_DAY,
  MAX_STREAK_CAP,
  MAX_STREAK_PER_DAY,
  MIN_STREAK_CAP,
  MIN_STREAK_PER_DAY,
  STREAK_PAY_FROM_DAY,
  clampStreakCap,
  clampStreakPerDay,
  streakCapFor,
  streakPaysOn,
  streakPerDayFor,
} from './streakBonus'

/* ============================================================
   连击奖励的加成分（2026-10-11 家长要求「可以设置连续的加成的分」）
   ------------------------------------------------------------
   和 tierRatio.ts 同一类：这两个值**参与计算**，会变成账本里真实的
   分。所以这里守住三件事：
     ① 默认值就是原来写死的 2 / 20 —— 老库升上来行为一字不变；
     ② 缺省 / 非法值退回默认档，不能变成 NaN 一路乘进账本；
     ③ 夹取区间包含 0（0 = 不发，语义干净）。
   夹出来的**实际发放数**在 useApp.test.ts 里测（那边能跑完整结算）。
   ============================================================ */

describe('连击加成分 —— 默认值与夹取', () => {
  it('默认 2 / 20 —— 就是原来写死在 DEFAULT_SETTINGS 里的那两个数', () => {
    expect(DEFAULT_STREAK_PER_DAY).toBe(2)
    expect(DEFAULT_STREAK_CAP).toBe(20)
  })

  it('缺省 / 非法值一律退回默认档（不能变成 NaN 一路乘进账本）', () => {
    for (const bad of [undefined, NaN, Infinity, -Infinity]) {
      expect(clampStreakPerDay(bad), `perDay ${String(bad)}`).toBe(DEFAULT_STREAK_PER_DAY)
      expect(clampStreakCap(bad), `cap ${String(bad)}`).toBe(DEFAULT_STREAK_CAP)
    }
  })

  it('下限是 0（0 就是「不发」，等价于关掉开关）', () => {
    expect(clampStreakPerDay(-5)).toBe(MIN_STREAK_PER_DAY)
    expect(clampStreakPerDay(0)).toBe(0)
    expect(clampStreakCap(-5)).toBe(MIN_STREAK_CAP)
    expect(clampStreakCap(0)).toBe(0)
  })

  it('上限封死，且默认档落在区间内部', () => {
    expect(clampStreakPerDay(999)).toBe(MAX_STREAK_PER_DAY)
    expect(clampStreakCap(99999)).toBe(MAX_STREAK_CAP)
    expect(MIN_STREAK_PER_DAY).toBeLessThan(DEFAULT_STREAK_PER_DAY)
    expect(MAX_STREAK_PER_DAY).toBeGreaterThan(DEFAULT_STREAK_PER_DAY)
    expect(MIN_STREAK_CAP).toBeLessThan(DEFAULT_STREAK_CAP)
    expect(MAX_STREAK_CAP).toBeGreaterThan(DEFAULT_STREAK_CAP)
  })

  it('取整 —— 分只能是整数，界面上「3.7 分」没有意义', () => {
    expect(clampStreakPerDay(3.4)).toBe(3)
    expect(clampStreakPerDay(3.6)).toBe(4)
    expect(clampStreakCap(20.5)).toBe(21)
  })
})

/* ============================================================
   按任务取（2026-10-11 家长要「每个长期任务单独设」）
   ------------------------------------------------------------
   和 `tierRatioFor` 是同一套取值规则，三个读者共用：
   编辑器预览 / 设置页那句「不设就用默认的 N 分」/ 真正发分
   （`maybePayStreakBonus`）。这里守的是**取值规则有没有分叉**，不是算术。

   ⚠️ 2026-10-12 家长拍板「不需要全局设定梯度、连续的。每个任务单独，
   有默认的就行了」，于是 `fallback` 参数和设置里那两个全局字段一起删了。
   现在只有两级：**任务自己的 → 内置默认**。
   ============================================================ */

describe('streakPerDayFor / streakCapFor —— 任务自己的，或者内置默认', () => {
  it('★ 任务设过 → 用任务的', () => {
    expect(streakPerDayFor({ streakPerDay: 10 })).toBe(10)
    expect(streakCapFor({ streakCap: 200 })).toBe(200)
  })

  it('★ 任务没设 → 兜到默认档，不报错（老任务 / 老备份走的就是这条）', () => {
    expect(streakPerDayFor({ streakPerDay: undefined })).toBe(DEFAULT_STREAK_PER_DAY)
    expect(streakCapFor({ streakCap: undefined })).toBe(DEFAULT_STREAK_CAP)
    expect(streakPerDayFor({})).toBe(DEFAULT_STREAK_PER_DAY)
    expect(streakCapFor({})).toBe(DEFAULT_STREAK_CAP)
  })

  it('★ 任务上是个越界值 → 走 clamp，不是原样透传', () => {
    expect(streakPerDayFor({ streakPerDay: 9999 })).toBe(MAX_STREAK_PER_DAY)
    expect(streakCapFor({ streakCap: 9999 })).toBe(MAX_STREAK_CAP)
    expect(streakPerDayFor({ streakPerDay: -3 })).toBe(MIN_STREAK_PER_DAY)
  })

  it('★ 任务上写了 0 也算「设过」—— 0 是「这条不发连击」，不是「兜到默认」', () => {
    // 写成 `task.x || DEFAULT_STREAK_PER_DAY` 就会在这里翻车：0 是 falsy，
    // 家长明明把这条任务的连击关成 0，发出去的却是默认的 2 分。
    expect(streakPerDayFor({ streakPerDay: 0 })).toBe(0)
    expect(streakPerDayFor({ streakPerDay: 0 })).not.toBe(DEFAULT_STREAK_PER_DAY)
    expect(streakCapFor({ streakCap: 0 })).toBe(0)
  })

  it('★ 两个值互不影响 —— 只设了 perDay 时，cap 仍走内置默认', () => {
    // 编辑器里两个开关是**一组**，但数据模型上是两个独立字段；
    // 只设一个（导入的备份 / 手改的库）不该把另一个也变成 0。
    expect(streakPerDayFor({ streakPerDay: 5 })).toBe(5)
    expect(streakCapFor({})).toBe(DEFAULT_STREAK_CAP)
  })

  it('★ 不传参数 = 完全没有覆盖 = 内置默认（设置页那句「用默认的 N 分」靠它）', () => {
    // `streakPerDayFor({})` 就是设置页连击卡上那个 N。
    // 它必须等于真正的默认，否则界面上会写一个不存在的数。
    expect(streakPerDayFor({})).toBe(DEFAULT_STREAK_PER_DAY)
    expect(streakCapFor({})).toBe(DEFAULT_STREAK_CAP)
  })
})

/* ============================================================
   连击从第几天开始发（2026-10-12 家长拍板）
   ------------------------------------------------------------
   这条判据有**两个读者**，所以必须只有一个定义：
     · `useApp.maybePayStreakBonus` —— 决定发不发分
     · `TaskPage` 那个「🔥 连续 N 天」徽章 —— 决定显不显示
   以前是两边各写一份（发分写 `streak <= 1`、徽章写 `streak > 0`），
   于是第 1 天**徽章挂着、分却不发** —— 界面承诺了一个发不出来的奖励。
   家长原话：「第 1 天不显示徽章」。
   ============================================================ */

describe('连击从第几天开始发 —— 发分与徽章共用的那一个判据', () => {
  it('起点是第 2 天（连到第 1 天只说明「今天做了」，第 2 天才叫「连续」）', () => {
    expect(STREAK_PAY_FROM_DAY).toBe(2)
  })

  it('★ 第 0 / 1 天不发 —— 徽章也不显示', () => {
    expect(streakPaysOn(0)).toBe(false)
    expect(streakPaysOn(1)).toBe(false)
  })

  it('★ 第 2 天起发 —— 徽章从这天开始挂', () => {
    expect(streakPaysOn(2)).toBe(true)
    expect(streakPaysOn(3)).toBe(true)
    expect(streakPaysOn(30)).toBe(true)
  })

  it('★ 边界卡死在 1 和 2 之间 —— 往两个方向改各有一条断言兜着', () => {
    // 判据是 `>= STREAK_PAY_FROM_DAY`，起点常量 = 2。所以：
    //   · 常量改成 1（第 1 天也发）→ 上一条 `streakPaysOn(1) === false` 红；
    //   · `>=` 写成 `>`（起点变成 3）→ 上一条 `streakPaysOn(2) === true` 红。
    // 也就是这个边界往哪边挪都会红，不是只测了一侧。
    expect([0, 1, 2, 3].map(streakPaysOn)).toEqual([false, false, true, true])
  })
})
