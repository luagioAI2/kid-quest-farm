import { describe, expect, it } from 'vitest'
import { celestialFor, farmClockAt, farmClockText, skyToneFor } from './farmClock'

/* ============================================================
   农场世界的时间 + 天空（2026-10-15，阶段 E「天气与昼夜」）
   ------------------------------------------------------------
   这个文件守两类东西，而且它们的失败方式完全不同：

   ① `farmClockAt` 是**算术**。算错了，顶栏的 `hh:mm` 就是错的。
   ② `skyToneFor` / `celestialFor` 是**分档**。档分错了不会报错，
      只会「天黑了太阳还挂着」—— 所以这里最重要的一条是
      **色调和日月必须共用同一个判据**（见最后一组）。

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

describe('celestialFor —— 太阳 / 月亮', () => {
  it('★ 色调和日月共用同一个判据 —— 不会出现「天是黑的、太阳还挂着」', () => {
    // 这是这一组里最值钱的一条：它把两个函数的**一致性**钉住。
    // 任何一边单独改分档（比如只把 skyToneFor 的 20 改成 21），
    // 这一条立刻红 —— 而分别测各自的边界是测不出来的。
    for (let h = 0; h < 24; h++) {
      const expected = skyToneFor(h) === 'night' ? 'moon' : 'sun'
      expect(celestialFor(h).kind, `${h} 点`).toBe(expected)
    }
  })

  it('白天是太阳、夜里是月亮（含两个交界点）', () => {
    expect(celestialFor(5).kind).toBe('sun')
    expect(celestialFor(12).kind).toBe('sun')
    expect(celestialFor(19).kind).toBe('sun')
    expect(celestialFor(20).kind).toBe('moon')
    expect(celestialFor(0).kind).toBe('moon')
    expect(celestialFor(4).kind).toBe('moon')
  })

  it('★ 位置永远落在框内（0..1）—— 否则太阳会飞出天空那条带子', () => {
    for (let h = 0; h < 24; h++) {
      const c = celestialFor(h)
      expect(c.x, `${h} 点 x`).toBeGreaterThanOrEqual(0)
      expect(c.x, `${h} 点 x`).toBeLessThanOrEqual(1)
      expect(c.y, `${h} 点 y`).toBeGreaterThanOrEqual(0)
      expect(c.y, `${h} 点 y`).toBeLessThanOrEqual(1)
    }
  })

  it('★ 太阳从左走到右，且正午最高（y 越小越高）', () => {
    expect(celestialFor(8).x).toBeLessThan(celestialFor(12).x)
    expect(celestialFor(12).x).toBeLessThan(celestialFor(17).x)
    // 正午比早晨 / 傍晚都高
    expect(celestialFor(12).y).toBeLessThan(celestialFor(8).y)
    expect(celestialFor(12).y).toBeLessThan(celestialFor(17).y)
    // 且确实「到了中高处」，不是只抬高了一点点
    expect(celestialFor(12).y).toBeLessThan(0.2)
  })

  it('★ 月亮从 20:00 的左边升起来，半夜到最高，次日 5 点落到右边', () => {
    const rise = celestialFor(20)
    const apex = celestialFor(0)
    const set = celestialFor(4)
    expect(rise.x).toBeLessThan(apex.x)
    expect(apex.x).toBeLessThan(set.x)
    // 半夜比刚升起时高
    expect(apex.y).toBeLessThan(rise.y)
  })

  it('起点贴着左边、终点贴着右边（弧要铺满整条天空）', () => {
    expect(celestialFor(5).x).toBeCloseTo(0.08, 5)
    expect(celestialFor(4.999).x).toBeGreaterThan(0.9)
  })
})
