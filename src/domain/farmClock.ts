/* ============================================================
   农场世界的时间（不是现实时间）
   ------------------------------------------------------------
   家长需求（原话）：「农场系统有时间流速的概念，这样方便跟现实知识挂钩。」
   所以农场里显示的是**农场世界的时间** —— 流速 2 时，现实过 12 小时、
   农场就已经过了一整天。这让孩子理解「为什么萝卜几分钟就熟了」。

   ★ 为什么这个文件在 `domain/` 而不是留在 `FarmPage.tsx`：
   顶栏要显示 `hh:mm`，天空要按**同一个小时**换色调。
   两处各算一遍 = 同一个事实存两份，迟早走散
   （本项目已经因为 `Task` / `TaskInstance` 存两份出过「改得分不生效」）。
   所以换算只有这一份，UI 只负责显示。
   ============================================================ */

export interface FarmClock {
  /** 第几天，从 1 开始 */
  day: number
  /** 0-23 */
  hour: number
  /** 0-59 */
  minute: number
}

/**
 * 按流速把现实时间换算成农场时间。
 *
 * 以**当地今天 0 点**为农场世界的起点（用 `setHours(0,0,0,0)`，
 * 所以是本地时区，不是 UTC —— 换时区跑测试要留意这一点）。
 */
export function farmClockAt(now: number, timeScale: number): FarmClock {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const realMinutesToday = (now - start.getTime()) / 60000
  const farmMinutesToday = realMinutesToday * timeScale
  const minutesInDay = farmMinutesToday % (60 * 24)
  return {
    day: Math.floor(farmMinutesToday / (60 * 24)) + 1,
    hour: Math.floor(minutesInDay / 60),
    minute: Math.floor(minutesInDay % 60),
  }
}

/** `hh:mm`，给顶栏显示用 */
export function farmClockText(c: FarmClock): string {
  return `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`
}

/* ---------------- 天空 ---------------- */

/** 天空的四档色调 */
export type SkyTone = 'dawn' | 'day' | 'dusk' | 'night'

/**
 * 天空色调 —— 由**农场小时**驱动。
 *
 * ⚠️ 这不是「凭空加的一层装饰」：`farmClockAt` 的小时**已经在顶栏显示**了，
 * 天空跟着同一个值走。上一轮 spec §8.5 的「地块皮」之所以做不了，
 * 就是因为它要的「已浇水 / 干旱 / 肥沃」三个状态**游戏里根本不存在** ——
 * 判据是：**这个外观对应的状态，存在吗？** 这里存在。
 *
 * 分档（边界是闭开区间，别写成 `<=`，否则 5 点会同时属于两档）：
 *   05:00–07:59 晨 · 08:00–16:59 昼 · 17:00–19:59 昏 · 20:00–04:59 夜
 */
export function skyToneFor(hour: number): SkyTone {
  if (hour < 5 || hour >= 20) return 'night'
  if (hour < 8) return 'dawn'
  if (hour < 17) return 'day'
  return 'dusk'
}

/**
 * ⚠️ **墓碑：这里曾经有一个 `celestialFor(hour)`，别再把它加回来。**
 *
 * 它算的是「太阳 / 月亮在天空里的位置」，一条从左到右的正弦弧
 * （`x` 0.08→0.92、`y` 中高到低），还配了 7 条单测。2026-10-15 整个删掉，
 * 原因是**它算出来的坐标没有任何地方能显示出来**：
 * 天空那条带子被顶栏卡片盖住了 100%（实测见 `Sky.tsx` 的头注释），
 * 而时钟条只有 20px 高，放不下一条弧。
 *
 * 于是「是太阳还是月亮」改成在**画它的那一个地方**直接由色调推出来：
 *
 *     tone === 'night' ? 'moon' : 'sun'
 *
 * 比原来的「两个函数 + 一条一致性断言」更强 —— **同一个表达式，走散不了**。
 * 教训：**能靠结构保证的，别靠测试保证**；而「画了什么」和「看得见什么」
 * 是两件事，只有前者能被 `querySelector` 验证。
 */
