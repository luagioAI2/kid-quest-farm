import { describe, expect, it } from 'vitest'
import { farmClockAt, farmClockText, skyToneFor } from './farmClock'

/* ============================================================
   农场世界的时间 + 天空（2026-10-15，阶段 E「天气与昼夜」）
   ------------------------------------------------------------
   这个文件守两类东西，而且它们的失败方式完全不同：

   ① `farmClockAt` 是**算术**。算错了，顶栏的 `hh:mm` 就是错的。
   ② `skyToneFor` 是**分档**。档分错了不会报错，只会「天黑了天空还是亮的」——
      所以这里最重要的是**边界**（05 / 08 / 17 / 20 都是闭开区间）
      和「0–23 每一小时恰好落进一档」。

   ⚠️ 时间戳一律用 `new Date(y, mo, d, h, m)`（**本地时区**）构造。
   `farmClockAt` 内部是 `setHours(0,0,0,0)`，也是本地时区 ——
   用 `Date.UTC(...)` 造时间戳的话，这条测试在 UTC+8 和 UTC-5 上
   会得出不同结果，变成一条「换个机器就红」的假失败。
   ============================================================ */

/** 本地时间 `h:m` 的时间戳 */
function at(h: number, m = 0): number {
  return new Date(2026, 9, 15, h, m, 0, 0).getTime()
}

describe('farmClockAt —— 现实时间 → 农场时间', () => {
  it('流速 1 时和现实同步：00:00 是第 1 天的 00:00', () => {
    expect(farmClockAt(at(0), 1)).toEqual({ day: 1, hour: 0, minute: 0 })
  })

  it('流速 1 时读得出「现实几点」', () => {
    expect(farmClockAt(at(12, 30), 1)).toEqual({ day: 1, hour: 12, minute: 30 })
    expect(farmClockAt(at(23, 59), 1)).toEqual({ day: 1, hour: 23, minute: 59 })
  })

  it('★ 流速 2：现实中午 12 点 = 农场第 2 天 0 点（一天正好翻过去）', () => {
    // 12 小时 × 60 × 2 = 1440 农场分钟 = 正好一整天
    expect(farmClockAt(at(12), 2)).toEqual({ day: 2, hour: 0, minute: 0 })
  })

  it('★ 流速 2：跨天之后小时数是从 0 重新数的，不是 24+', () => {
    // 6:30 → 390 分钟 × 2 = 780 农场分钟 = 第 1 天 13:00
    expect(farmClockAt(at(6, 30), 2)).toEqual({ day: 1, hour: 13, minute: 0 })
    // 13:00 → 780 分钟 × 2 = 1560 = 第 2 天 2:00
    expect(farmClockAt(at(13), 2)).toEqual({ day: 2, hour: 2, minute: 0 })
  })

  it('★ day 从 1 开始（不是 0）—— 界面写的是「农场第 N 天」', () => {
    expect(farmClockAt(at(0), 1).day).toBe(1)
    // 差 48 农场分钟满一圈：00:29 起步、流速 48 → 1392 分钟，仍是第 1 天
    expect(farmClockAt(at(0, 29), 48).day).toBe(1)
    // 刚好满一圈：00:30 起步、流速 48 → 1440 分钟 = 第 2 天 00:00
    expect(farmClockAt(at(0, 30), 48)).toEqual({ day: 2, hour: 0, minute: 0 })
  })

  it('分钟向下取整（1 秒不显示，和 `hh:mm` 的精度一致）', () => {
    const t = at(8, 5) + 59_000
    expect(farmClockAt(t, 1)).toEqual({ day: 1, hour: 8, minute: 5 })
  })
})

describe('farmClockText —— 顶栏显示的 `hh:mm`', () => {
  it('★ 补零：9:05 必须显示成 09:05，不是 9:5', () => {
    expect(farmClockText({ day: 1, hour: 9, minute: 5 })).toBe('09:05')
  })

  it('零点', () => {
    expect(farmClockText({ day: 3, hour: 0, minute: 0 })).toBe('00:00')
  })

  it('★ 和 farmClockAt 接得上：文本里的小时就是算出来的小时', () => {
    const c = farmClockAt(at(7, 3), 1)
    expect(farmClockText(c)).toBe('07:03')
  })
})

describe('skyToneFor —— 四档色调的边界', () => {
  it('★ 边界是**闭开**的：05:00 属于晨、20:00 属于夜', () => {
    // 写成 `hour <= 5` 的话，5 点会同时属于「夜」和「晨」，
    // 天空的判定就依赖 if 的书写顺序 —— 这种 bug 看不出来，只会偶尔闪一下。
    expect(skyToneFor(5)).toBe('dawn')
    expect(skyToneFor(4)).toBe('night')
    expect(skyToneFor(20)).toBe('night')
    expect(skyToneFor(19)).toBe('dusk')
    expect(skyToneFor(8)).toBe('day')
    expect(skyToneFor(7)).toBe('dawn')
    expect(skyToneFor(17)).toBe('dusk')
    expect(skyToneFor(16)).toBe('day')
  })

  it('★ 0–23 每一小时都恰好落进一档（没有空洞、没有重叠）', () => {
    const seen: Record<string, number> = { dawn: 0, day: 0, dusk: 0, night: 0 }
    for (let h = 0; h < 24; h++) seen[skyToneFor(h)] += 1
    expect(seen).toEqual({ dawn: 3, day: 9, dusk: 3, night: 9 })
  })
})

/* ============================================================
   ⚠️ **这里曾经有一组 `celestialFor` 的测试（7 条），别再补回来。**

   它们测的是「太阳 / 月亮在天空里的位置」那条正弦弧：x 单调递增、
   正午最高、起点贴左边、终点贴右边……**全绿**。
   但那条弧**一个像素都显示不出来** —— 天空带子被顶栏卡片盖住 100%
   （实测见 `src/features/farm/Sky.tsx` 的头注释）。

   这是本项目第二次栽在同一件事上：**断言「画了什么」，不等于「看得见什么」。**
   上一轮是动物幼崽 / 成年两帧的 id 写反（数量对、语义反，走查全绿）。
   现在的守卫换了个层次：`scripts/capture-sky.mjs` 用 `elementFromPoint`
   按网格采样，**断言日月真的在最上面那一层**。
   ============================================================ */
