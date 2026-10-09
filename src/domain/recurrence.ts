import type { Task, TaskInstance } from './types'
import { appDayKey, periodKeyFor, periodStartDateKey } from './time'

/* ============================================================
   任务实例生成
   ------------------------------------------------------------
   设计取舍（重要）：
   * 只有「单次任务」和「每日任务」预先落库成 TaskInstance。
   * 「每周 / 每月 / 每年」任务**不预先展开**，而是把任务定义本身
     当作一个长长的待办，按时长拆成若干次提交（见 splitPeriodTask）。
     这样才不会在数据库里堆出成百上千条空实例。
   ============================================================ */

let seq = 0
export function uid(prefix = 'id'): string {
  seq = (seq + 1) % 100000
  const t = Date.now().toString(36)
  const r = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${t}${r}${seq.toString(36)}`
}

/** 需要预先展开成实例的周期 */
export function isPreGenerated(cycle: Task['cycle']): boolean {
  return cycle === 'once' || cycle === 'daily'
}

/**
 * 为一个任务定义生成某个逻辑日的实例。
 * 返回 null 表示该任务在这一天不需要出现。
 */
export function makeInstance(
  task: Task,
  dayKey: string,
  dayStartHour = 0,
): TaskInstance | null {
  if (task.archived) return null
  if (!isPreGenerated(task.cycle)) return null
  /* 签到任务**不预生成实例**。签到走的是 checkIns + checkInProgress 两条表
     （见 useApp 的 doCheckIn / grantCheckIn），从不读 TaskInstance；
     而卡片渲染是「签到进『坚持签到』区块」这一个口径。
     不挡住的话，一个 cycle: 'daily' 的签到任务会生成实例 →
     同一张任务在「今日任务」和「坚持签到」各渲染一次，看起来像建重了。
     （种子里的签到任务都是 weekly、本来就不预生成，所以以前没暴露。）
     判据用 isCheckInTask 而不是裸的 checkInEnabled —— 见那个函数的注释。 */
  if (isCheckInTask(task)) return null

  // 单次任务：只在创建当天及之后出现一次，由调用方保证只建一次
  const periodKey = periodKeyFor(task.cycle, Date.now(), dayStartHour)
  const now = Date.now()
  const inst: TaskInstance = {
    id: uid('ti'),
    taskId: task.id,
    periodKey: task.cycle === 'daily' ? dayKey : periodKey,
    date: dayKey,
    title: task.title,
    category: task.category,
    cycle: task.cycle,
    plannedMinutes: task.plannedMinutes,
    basePoints: task.basePoints,
    allowOvertime: task.allowOvertime,
    allowLateNoPenalty: task.allowLateNoPenalty,
    qualityRated: task.qualityRated,
    rewardItemIds: task.rewardItemIds ?? [],
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  }
  return inst
}

/**
 * 惰性补齐：给定已有实例列表，算出还需要为哪些 (taskId, dayKey) 生成实例。
 * 这是"每天自动生成任务"的核心 —— 打开 App 时补齐缺失的那几天。
 *
 * @param tasks 所有任务定义
 * @param existing 现有实例（至少要包含 taskId 与 periodKey）
 * @param fromDayKey 补齐起始逻辑日（含）
 * @param toDayKey 补齐结束逻辑日（含）
 * @returns 需要新建的实例数组
 */
export function planMissingInstances(
  tasks: Task[],
  existing: Pick<TaskInstance, 'taskId' | 'periodKey' | 'cycle'>[],
  fromDayKey: string,
  toDayKey: string,
  dayStartHour = 0,
): TaskInstance[] {
  const have = new Set(existing.map((e) => `${e.taskId}::${e.periodKey}`))
  const out: TaskInstance[] = []

  for (const task of tasks) {
    if (task.archived || !isPreGenerated(task.cycle)) continue

    if (task.cycle === 'daily') {
      for (const day of eachDay(fromDayKey, toDayKey)) {
        if (have.has(`${task.id}::${day}`)) continue
        const inst = makeInstance(task, day, dayStartHour)
        if (inst) out.push(inst)
      }
      continue
    }

    // 单次任务：只在当前逻辑日生成一次，且全生命周期只生成一次
    const anyExists = existing.some((e) => e.taskId === task.id)
    if (anyExists) continue
    const inst = makeInstance(task, toDayKey, dayStartHour)
    if (inst) out.push(inst)
  }

  return out
}

/**
 * 从 from 到 to 的每一天（含两端），迭代器。
 *
 * 上限 3660 天（约 10 年）只是防御「日期字符串损坏导致死循环」的保险丝。
 * 正常调用方（惰性补齐）的区间是「最早实例日 → 今天」，永远够用。
 * 一旦真的触到上限，说明数据异常；此时明确抛出而不是静默截断 ——
 * 静默少生成几天任务，用户是无感的，问题会一直藏着。
 */
export function* eachDay(fromDayKey: string, toDayKey: string): Generator<string> {
  const MAX_DAYS = 3660
  let cur = fromDayKey
  let guard = 0
  while (cur <= toDayKey) {
    if (guard >= MAX_DAYS) {
      throw new Error(
        `eachDay: 日期区间超过 ${MAX_DAYS} 天（${fromDayKey} → ${toDayKey}），疑似日期数据损坏`,
      )
    }
    yield cur
    const next = new Date(`${cur}T00:00:00`).getTime() + 24 * 3600_000
    const d = new Date(next)
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    cur = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    guard++
  }
}

/**
 * 把「周期任务」拆成可多次提交的子目标。
 * 例：每周跑 3 次，每次 30 分钟 → 返回 3 个 unit。
 * UI 上表现为「本周进度 1/3」。
 */
export interface PeriodUnit {
  index: number
  label: string
  done: boolean
  /** 已交上去、等家长审核（既不是空格子，也还没算完成） */
  pending?: boolean
  completedAt?: number
  actualMinutes?: number
  earnedPoints?: number
}

export function buildPeriodUnits(
  task: Task,
  submissions: TaskInstance[],
): PeriodUnit[] {
  const total = Math.max(1, task.checkInTargetCount ?? 1)
  const sorted = [...submissions].sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))
  const units: PeriodUnit[] = []
  for (let i = 0; i < total; i++) {
    const s = sorted[i]
    units.push({
      index: i,
      label: `第 ${i + 1} 次`,
      done: !!s && (s.status === 'completed' || s.status === 'failed'),
      // 待审核的格子必须和「还没做」区分开 —— 否则孩子看到空格子会再交一次，
      // 家长那边就冒出两条一模一样的待办。
      pending: !!s && s.status === 'submitted',
      completedAt: s?.completedAt,
      actualMinutes: s?.actualMinutes,
      earnedPoints: s?.earnedPoints,
    })
  }
  return units
}

/**
 * 签到阶梯奖励。
 * 例如「一周练字 5 天」→ 第 3 天给 6 分，第 5 天再给 12 分。
 */
export interface CheckInTier {
  days: number
  points: number
  itemId?: string
  label: string
}

/**
 * 一个周期内**最多能签几天** —— 也就是阶梯天数的上限。
 *
 * 为什么需要它：`checkInTargetCount` 输入框的上限写死 366，
 * 而周期容量比它小得多（日 / 单次只有 **1** 天、一周 7 天）。
 * 目标填得比容量大时，最后一档**永远到不了**，界面上却照常写着「+12 分」
 * —— 又一个「界面承诺了发不出来的东西」。
 * 编辑器拿它做校验，给家长一句实话。
 *
 * ⚠️ 月 / 年取的是**理论上限**（31 / 366），所以 2 月填 31 天仍会漏判。
 *    宁可漏判也不要误报：一个会误报的提示，家长很快就学会无视它。
 */
export function checkInCapacity(cycle: Task['cycle']): number {
  switch (cycle) {
    case 'once':
    case 'daily':
      return 1
    case 'weekly':
      return 7
    case 'monthly':
      return 31
    case 'yearly':
      return 366
  }
}

/**
 * 这个周期**能不能用签到模式**。
 *
 * 判据就是「一个周期是不是只有一天」—— 复用 `checkInCapacity`，
 * 不再写第二份周期清单：两处各写一遍，加周期时必然走散。
 *
 * 为什么日 / 单次不行：签到整套东西（日历格、已坚持 X/Y 天、连击、
 * 阶梯）都是按「**一个周期内**坚持几天」设计的，而日 / 单次的
 * `periodKey` 就是当天，进度行每天重置 —— 目标天数永远到不了。
 * 2026-10-09 家长定：这两种周期直接**不显示**签到开关。
 */
export function checkInSupported(cycle: Task['cycle']): boolean {
  return checkInCapacity(cycle) > 1
}

/**
 * 这个任务**实际是不是**签到任务 —— 唯一事实源。
 *
 * ⚠️ 不能只看 `task.checkInEnabled`：日 / 单次周期上这个标志是无效的
 * （编辑器已经不显示了，但老库里可能留着 `true`）。
 * 若各处各判各的，就会出现「生成处挡了、读取处没挡」这类分叉；
 * 更糟的是**两个读取处口径相反**时，任务会从所有区块一起消失。
 * 所以 makeInstance、今日任务、长期任务、坚持签到四处必须共用这一个判定。
 */
export function isCheckInTask(task: Pick<Task, 'checkInEnabled' | 'cycle'>): boolean {
  return !!task.checkInEnabled && checkInSupported(task.cycle)
}

/**
 * 签到阶梯奖励。
 *
 * 口径（2026-09-30 起，家长定）：
 *   **每完成一次，阶梯合计给 `0.8 × 基础分`**，按 1:3:6 摊到三档上。
 *   于是「每次（单次完成）的积分」不随周期变化 —— 周 / 月 / 年一个价。
 *   周档 base 5 / target 5 → 合计 20 → **2 / 6 / 12**
 *   （2026-10-09 家长把原来的 10 / 30 / 60 压下来的结果：结构不动，只压数字）。
 *
 * ⚠️ 这个公式需要 `basePoints`。老签名只有 `(cycle, target)`，
 *    月 / 年档只能写死绝对数（`50/150/400`、`300/1500/5000`）——
 *    和基础分彻底脱钩：一个「每月读一本书」（base 15）掉 400 分，
 *    是单次基础分的 26 倍，比正课还赚。
 *    家长 2026-09-30 的要求就是「月年**每次（单次完成）**的积分也是一样的」。
 *
 * ⚠️ 周档原来写死 `2/6/12`、不看基础分。现在统一走公式：base 5 / target 5
 *    仍然**精确等于** 2 / 6 / 12（`0.8×5×5/10 = 2`），所以周档行为没变；
 *    基础分改成别的值时阶梯才会跟着按比例走 —— 那才是「一样的」。
 */
export function defaultTiers(
  cycle: Task['cycle'],
  target: number,
  basePoints = 5,
): CheckInTier[] {
  const base = Math.max(1, target)
  /* 1:3:6 三档合计 10 份；每份 = 0.8×基础分×目标天数 / 10。
     至少 1 分，否则小目标 + 小基础分会算出 0 分档，界面上会出现「+0」。 */
  const unit = Math.max(1, Math.round((0.8 * Math.max(0, basePoints) * base) / 10))
  const pts = (n: number) => unit * n

  if (cycle === 'weekly') {
    return dedupeTiers([
      { days: Math.min(base, 1), points: pts(1), label: '开了个好头' },
      { days: Math.min(base, 3), points: pts(3), label: '坚持 3 天' },
      { days: base, points: pts(6), itemId: 'sticker', label: `一周坚持 ${base} 天` },
    ])
  }
  if (cycle === 'monthly') {
    return dedupeTiers([
      { days: Math.min(base, 5), points: pts(1), label: '坚持 5 天' },
      { days: Math.min(base, 15), points: pts(3), itemId: 'sticker', label: '坚持半个月' },
      { days: base, points: pts(6), itemId: 'medal', label: `整月坚持 ${base} 天` },
    ])
  }
  if (cycle === 'yearly') {
    return dedupeTiers([
      { days: Math.min(base, 30), points: pts(1), label: '坚持 30 天' },
      { days: Math.min(base, 180), points: pts(3), itemId: 'medal', label: '坚持半年' },
      { days: base, points: pts(6), itemId: 'gem', label: `全年坚持 ${base} 天` },
    ])
  }
  return dedupeTiers([
    { days: Math.min(base, 3), points: pts(3), label: '坚持 3 天' },
    { days: base, points: pts(6), itemId: 'sticker', label: `坚持 ${base} 天` },
  ])
}

/**
 * 合并「天数相同」的阶梯。
 *
 * 小目标（比如每周只签 2 天）会让 Math.min(base, N) 把多个阶梯压到同一天数，
 * 此时必须做两件事：
 *  1. 保留奖励最高的那一档 —— 否则玩家会因为名字排前面反而少拿分；
 *  2. 重写 label —— 「坚持 3 天」挂在 days=2 上是明确的错误文案。
 * label 一律按最终天数重新生成，保证显示与事实一致。
 */
function dedupeTiers(tiers: CheckInTier[]): CheckInTier[] {
  const best = new Map<number, CheckInTier>()
  for (const t of tiers) {
    if (t.days < 1) continue
    const prev = best.get(t.days)
    if (!prev || rewardScore(t) > rewardScore(prev)) best.set(t.days, t)
  }
  return [...best.values()]
    .sort((a, b) => a.days - b.days)
    .map((t) => ({ ...t, label: `坚持 ${t.days} 天` }))
}

/** 粗略比较两档奖励的高低，用于同天数合并时挑更好的那档 */
function rewardScore(t: CheckInTier): number {
  // 道具奖励视为比纯积分更有价值，给一个溢价，避免被低分档挤掉。
  return t.points + (t.itemId ? 1000 : 0)
}

/** 已签到天数 → 当前已达成但未领取的阶梯 */
export function claimableTiers(
  tiers: CheckInTier[],
  daysCount: number,
  claimed: number[],
): CheckInTier[] {
  return tiers.filter((t) => daysCount >= t.days && !claimed.includes(t.days))
}

/**
 * 连续完成天数（连击）。用于全局连击奖励。
 * 以「当天至少完成 1 个任务」为一天有效。
 */
export function computeStreak(datesWithCompletion: string[], todayKey: string): number {
  const set = new Set(datesWithCompletion)
  let count = 0
  let cursor = todayKey
  // 今天没完成也不立刻断，从昨天开始算（给孩子留缓冲）
  if (!set.has(cursor)) {
    cursor = shiftDay(cursor, -1)
    if (!set.has(cursor)) return 0
  }
  while (set.has(cursor)) {
    count++
    cursor = shiftDay(cursor, -1)
  }
  return count
}

function shiftDay(key: string, delta: number): string {
  const ts = new Date(`${key}T12:00:00`).getTime() + delta * 24 * 3600_000
  const d = new Date(ts)
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/* ============================================================
   签到连击（**单个签到任务**的连续天数）
   ------------------------------------------------------------
   ⚠️ 和上面的 `computeStreak` 不是一回事，别混：
     · `computeStreak` 是**全局**连击 —— 「当天完成了任意一个任务」就算一天，
       奖励来自 settings 的 streakBonusPerDay / Cap，每天只发一次。
     · 这里是**任务内**连击 —— 只看这一个签到任务自己连着签了几天。

   家长原话（2026-10-09）：「每次基本分是5分。连续+1」。
   所以第 N 天 = 基础分 + (N-1)：5、6、7、8、9。
   ============================================================ */

/**
 * 以 `date` 结尾、连续多少个**日历日**都签到了。
 *
 * 「断了就重新」：中间缺一天就从缺的那天断开，只数断点之后的天数。
 * 例：签了 周一/周二/周四，问周四 → 1（周三缺，只数周四）；
 *     签了 周一~周五，问周五 → 5。
 *
 * 注意 `days` 只传**本周期**的已确认日期（`CheckInProgress.days`），
 * 所以跨周天然重置 —— 上周的五连不会带进新的一周。
 */
export function checkInStreak(days: string[], date: string): number {
  const set = new Set(days)
  let count = 0
  let cursor = date
  while (set.has(cursor)) {
    count++
    cursor = shiftDay(cursor, -1)
  }
  return count
}

/**
 * 连击加成：连续第 N 天多给 N-1 分，**封顶为一次的基础分**。
 *
 * 为什么要封顶：家长明确说了「连击应该很难超过单次分」。
 * 一周最多签 7 天 → 加成最多 6 分，而基础分是 5 —— 不封顶的话，
 * 签满一周时加成会反超基础分。封顶后「加成 ≤ 单次分」永远成立。
 */
export function checkInStreakBonus(streak: number, basePoints: number): number {
  const base = Math.max(0, Math.round(basePoints))
  if (base <= 0) return 0
  return Math.max(0, Math.min(streak - 1, base))
}

/**
 * 「今天签下去会是连续第几天」—— 给界面预告今天能拿多少分用。
 *
 * 今天已经签了 → 就是当前连击；
 * 今天还没签 → 看昨天那条连击，+1（昨天没签则从 1 重新开始）。
 */
export function checkInStreakIfSigned(days: string[], todayKey: string): number {
  if (days.includes(todayKey)) return checkInStreak(days, todayKey)
  return checkInStreak(days, shiftDay(todayKey, -1)) + 1
}

/** 一次签到的发放明细 */
export interface CheckInPayout {
  /** 基础分（任务定义上的 basePoints） */
  base: number
  /** 这一签之后是连续第几天 */
  streak: number
  /** 连击加成 */
  streakBonus: number
  /** 这一签同时达成的阶梯（要逐个落账，所以给列表而不是只给合计） */
  tiers: CheckInTier[]
  /** 阶梯奖励合计 */
  tierPoints: number
  /** 最后达成的那一档的名字（用于文案） */
  tierLabel?: string
  /** 实际到账 = base + streakBonus + tierPoints */
  total: number
}

/**
 * 一次签到**发多少分** —— 唯一事实源。
 *
 * ⚠️ 发分（`useApp.grantCheckIn`）和「确认后得到 N 分」的**展示**必须共用
 * 这个函数。分成两处算就一定会走散：家长审核面板上原来只写
 * `+task.basePoints`，而实际到账还要加连击和阶梯 —— 首日就写 5 实发 7。
 * 这是本项目的老毛病（同一个事实存两份），别再开第二份。
 */
export function checkInPayout(
  task: Pick<Task, 'basePoints' | 'cycle' | 'checkInTargetCount'>,
  confirmedDays: string[],
  claimedTiers: number[],
  date: string,
): CheckInPayout {
  const base = Math.max(0, Math.round(task.basePoints))
  const nextDays = [...confirmedDays, date].sort()
  const streak = checkInStreak(nextDays, date)
  const streakBonus = checkInStreakBonus(streak, base)

  const allTiers = defaultTiers(task.cycle, task.checkInTargetCount ?? 5, task.basePoints)
  const tiers = claimableTiers(allTiers, nextDays.length, claimedTiers)
  const tierPoints = tiers.reduce((n, t) => n + t.points, 0)

  return {
    base,
    streak,
    streakBonus,
    tiers,
    tierPoints,
    tierLabel: tiers.length > 0 ? tiers[tiers.length - 1].label : undefined,
    total: base + streakBonus + tierPoints,
  }
}

/** 是否在允许的完成时间窗内 */
export function inTimeWindow(task: Task, ts = Date.now()): boolean {
  if (task.windowStartMinute == null || task.windowEndMinute == null) return true
  const d = new Date(ts)
  const cur = d.getHours() * 60 + d.getMinutes()
  const { windowStartMinute: s, windowEndMinute: e } = task
  // 支持跨零点窗口，如 21:00 - 06:00
  return s <= e ? cur >= s && cur <= e : cur >= s || cur <= e
}

/** 当前逻辑日 —— 供 UI 直接用 */
export function currentDayKey(dayStartHour = 0): string {
  return appDayKey(Date.now(), dayStartHour)
}

export { periodStartDateKey }
