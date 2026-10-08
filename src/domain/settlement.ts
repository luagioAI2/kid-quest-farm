import type {
  QualityGrade,
  SettlementResult,
  Task,
  TaskInstance,
} from './types'

/* ============================================================
   结算引擎
   ------------------------------------------------------------
   规则（严格对照需求）：

   1) 是否超时
      超时 = 实际用时 > 计划时长
      未开始计时 / 没填用时 → 视为「未按时返还」，按超时处理

   2) 免扣分任务（allowLateNoPenalty = true）
      → 无论超时多久，全额积分。例如「陪奶奶散步」这类不该用秒表衡量的任务。

   3) 非免扣分任务的超时结算
      a. allowOvertime = false（严格限时任务）
         → 只要超时即为 0 分。
      b. allowOvertime = true（宽容任务）
         → 在 [计划时长, 计划时长 × 2) 区间内，按超时比例线性衰减：
              得分 = round(基础分 × (2 - 实际/计划))
           实际用时 >= 计划时长 × 2 → 0 分（"时间超出一倍则无积分"）

   4) 质量系数（五档，见 QUALITY_META）
      很差 -100% / 一般 -50% / 良好 0 / 很好 +10% / 特别棒 +20%
      乘在**时间衰减之后**的分数上：

          得分 = round(时间分 × (1 + 系数))

      「良好」是中间档，不加不减。
      ⚠️ 时间分已经被扣成 0 时，乘任何系数都还是 0 ——
      超时归零的任务不会因为评「特别棒」而重新拿到分。

   5) 绝不出现负分：最终得分下限为 0（所以「很差」是扣光，不是倒扣）。
   ============================================================ */

/** 超时归零的倍数阈值 */
export const OVERTIME_ZERO_MULTIPLIER = 2

/* ---------------- 质量评级（五档） ---------------- */

/**
 * 名称、表情、系数。
 * 由低到高，`ok`（良好）是中间档，系数 0。
 */
export const QUALITY_META: Record<
  QualityGrade,
  { emoji: string; label: string; multiplier: number }
> = {
  awful: { emoji: '😞', label: '很差', multiplier: -1 },
  poor: { emoji: '😕', label: '一般', multiplier: -0.5 },
  ok: { emoji: '🙂', label: '良好', multiplier: 0 },
  good: { emoji: '😃', label: '很好', multiplier: 0.1 },
  great: { emoji: '🤩', label: '特别棒', multiplier: 0.2 },
}

/** 由低到高。UI 排列 / 默认值 / 遍历一律用它，别再手写数组 */
export const QUALITY_ORDER: QualityGrade[] = ['awful', 'poor', 'ok', 'good', 'great']

/** 中间档：不加不减的那一档 */
export const QUALITY_NEUTRAL: QualityGrade = 'ok'

/** 把系数格式化成「+10%」「-50%」「不加不减」 */
export function formatMultiplier(grade: QualityGrade): string {
  const m = QUALITY_META[grade].multiplier
  if (m === 0) return '不加不减'
  return `${m > 0 ? '+' : ''}${Math.round(m * 100)}%`
}

export interface SettleParams {
  /** 计划时长（分钟） */
  plannedMinutes: number
  /** 实际用时（分钟）。undefined 表示没有计时记录 */
  actualMinutes?: number
  /** 基础积分 */
  basePoints: number
  /** 质量评级 */
  quality?: QualityGrade
  /** 是否启用质量评级 */
  qualityRated: boolean
  /** 是否允许超时按比例结算 */
  allowOvertime: boolean
  /** 是否免扣分 */
  allowLateNoPenalty: boolean
  /** 全局：是否启用超时衰减（家长可一键关闭） */
  overtimeEnabled?: boolean
  /** 全局：是否启用质量加减分（关闭后五档系数一律按 0 算） */
  qualityBonusEnabled?: boolean
  /** 全局：超时衰减最低保留比例（0-1），低于该比例直接归零 */
  minRatioForPoints?: number
}

/** 把浮点分钟规整为 1 位小数的整数（避免 12.0000001 > 12 的误判） */
function normalizeMinutes(m: number): number {
  return Math.max(0, Math.round(m * 10) / 10)
}

/**
 * 纯函数结算：给定参数，算出应得积分。
 * 无副作用，便于单测与预览（孩子在提交前可以先看到"预计得分"）。
 */
export function settle(p: SettleParams): SettlementResult {
  const planned = Math.max(0, p.plannedMinutes)
  // 没填用时也当成超时（保守：宁可少给，也不能白给）
  const actualRaw = p.actualMinutes ?? Number.POSITIVE_INFINITY
  const actual = Number.isFinite(actualRaw) ? normalizeMinutes(actualRaw) : Number.POSITIVE_INFINITY

  const base = Math.max(0, Math.round(p.basePoints))

  // ---------- 第一步：时间维度，先算出「时间分」 ----------
  // 质量是独立维度，但按约定乘在**时间衰减之后**的分数上（见文件头规则 4）。
  let timePoints = base
  let overtime = false
  let zeroed = false
  let zeroReason: SettlementResult['zeroReason']
  let ratio = 0
  let timeReason = ''

  if (p.allowLateNoPenalty) {
    // 免扣分：无论超时多久都给全额
    overtime = actual > planned
    ratio = planned > 0 && Number.isFinite(actual) ? actual / planned : 0
    timeReason = overtime ? '虽然晚了一点，但这类任务不扣分' : '按时完成'
  } else if (!Number.isFinite(actual)) {
    // 没开始 / 没有用时记录
    overtime = true
    zeroed = true
    zeroReason = 'not_returned'
    ratio = Number.POSITIVE_INFINITY
    timePoints = 0
    timeReason = '没有在规定时间内记录完成'
  } else if (planned <= 0 || actual <= planned) {
    overtime = false
    ratio = planned > 0 ? actual / planned : 0
    timeReason = '按时完成'
  } else {
    overtime = true
    ratio = actual / planned
    if (p.overtimeEnabled === false) {
      // 全局关闭超时衰减 → 全额
      timeReason = '超时了但今天不扣分'
    } else if (!p.allowOvertime) {
      // 严格限时任务：超时即 0
      zeroed = true
      zeroReason = 'overtime_limit'
      timePoints = 0
      timeReason = '超出时间了'
    } else if (ratio >= OVERTIME_ZERO_MULTIPLIER) {
      // 宽容任务：超出计划一倍归零
      zeroed = true
      zeroReason = 'overtime_limit'
      timePoints = 0
      timeReason = `用时超过 ${planned * OVERTIME_ZERO_MULTIPLIER} 分钟了，明天早一点开始吧`
    } else {
      // 线性衰减：ratio=1 → 100%，ratio→2 → 0%
      const decay = 2 - ratio
      const minRatio = p.minRatioForPoints ?? 0
      if (decay <= minRatio) {
        zeroed = true
        zeroReason = 'overtime_limit'
        timePoints = 0
        timeReason = '超出时间太多了'
      } else {
        const decayedBase = Math.round(base * decay)
        // 只要还在惩罚区间内，至少给 1 分 —— 否则孩子会看到"差 6 秒"却颗粒无收，
        // 这是最打击积极性的一种反馈。归零只发生在真正到达阈值时。
        timePoints = base > 0 ? Math.max(1, decayedBase) : 0
        timeReason = `用了 ${Math.round(actual)} 分钟，比计划的 ${planned} 分钟慢了一点`
      }
    }
  }

  // ---------- 第二步：质量系数乘在时间分上 ----------
  const grade = p.qualityRated && p.qualityBonusEnabled !== false ? p.quality : undefined
  const mult = grade ? QUALITY_META[grade].multiplier : 0
  const points = Math.max(0, Math.round(timePoints * (1 + mult)))

  return {
    points,
    overtime,
    ratio,
    zeroed,
    zeroReason,
    reason: composeReason(timeReason, timePoints, points, grade, zeroed),
  }
}

/**
 * 拼结算文案。
 * 质量分要能看出「乘在多少上」，否则家长看到 10 分变 5 分会以为算错了。
 */
function composeReason(
  timeReason: string,
  timePoints: number,
  points: number,
  grade: QualityGrade | undefined,
  zeroed: boolean,
): string {
  const meta = grade ? QUALITY_META[grade] : undefined
  const adjusted = meta !== undefined && meta.multiplier !== 0

  if (zeroed) {
    return adjusted && meta.multiplier > 0
      ? `${timeReason}，这次没有积分哦（时间分已经是 0，质量再好也乘不出来）`
      : `${timeReason}，这次没有积分哦`
  }
  if (adjusted) {
    return `${timeReason}，${timePoints} 分，质量「${meta.label}」${formatMultiplier(
      grade as QualityGrade,
    )} → ${points} 分`
  }
  if (points > 0) return `${timeReason}，拿到全部 ${points} 分`
  return '没有积分奖励，但完成啦！'
}

/** 全局结算开关（由 settings 派生，保证预览与真实结算同源） */
export type GlobalSettleParams = Pick<
  SettleParams,
  'overtimeEnabled' | 'qualityBonusEnabled' | 'minRatioForPoints'
>

/** 便捷重载：直接从任务定义 + 实际用时结算 */
export function settleTask(
  task: Pick<
    Task,
    | 'plannedMinutes'
    | 'basePoints'
    | 'allowOvertime'
    | 'allowLateNoPenalty'
    | 'qualityRated'
  >,
  actualMinutes: number | undefined,
  quality: QualityGrade | undefined,
  global?: GlobalSettleParams,
): SettlementResult {
  return settle({
    plannedMinutes: task.plannedMinutes,
    actualMinutes,
    basePoints: task.basePoints,
    quality,
    qualityRated: task.qualityRated,
    allowOvertime: task.allowOvertime,
    allowLateNoPenalty: task.allowLateNoPenalty,
    ...global,
  })
}

/** 便捷重载：从任务实例结算 */
export function settleInstance(
  inst: TaskInstance,
  global?: GlobalSettleParams,
): SettlementResult {
  return settleTask(inst, inst.actualMinutes, inst.quality, global)
}

/**
 * 由实际用时推算质量评级的建议值（给 UI 做默认选中，家长仍可改）。
 * 低龄友好：默认给中间档「良好」，避免因为不懂而全选最差。
 */
export function suggestQuality(result: SettlementResult): QualityGrade {
  if (!result.overtime) return QUALITY_NEUTRAL
  if (result.zeroed) return QUALITY_NEUTRAL
  return QUALITY_NEUTRAL
}

/** 结算前预览：给孩子看"如果现在提交能拿多少分" */
export function previewPoints(
  inst: TaskInstance,
  actualMinutes: number | undefined,
  quality: QualityGrade | undefined,
  global?: GlobalSettleParams,
): SettlementResult {
  return settle({
    plannedMinutes: inst.plannedMinutes,
    actualMinutes,
    basePoints: inst.basePoints,
    quality,
    qualityRated: inst.qualityRated,
    allowOvertime: inst.allowOvertime,
    allowLateNoPenalty: inst.allowLateNoPenalty,
    ...global,
  })
}
