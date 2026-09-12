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

   4) 质量加分
      仅在 qualityRated 为 true 且评级达到阈值时叠加，且**不因超时而消失**
      （质量与用时是两个独立维度）。

   5) 绝不出现负分：最终得分下限为 0。
   ============================================================ */

/** 超时归零的倍数阈值 */
export const OVERTIME_ZERO_MULTIPLIER = 2

export interface SettleParams {
  /** 计划时长（分钟） */
  plannedMinutes: number
  /** 实际用时（分钟）。undefined 表示没有计时记录 */
  actualMinutes?: number
  /** 基础积分 */
  basePoints: number
  /** 质量奖励积分 */
  qualityBonusPoints: number
  /** 质量评级 */
  quality?: QualityGrade
  /** 是否启用质量加分 */
  qualityRated: boolean
  /** 是否允许超时按比例结算 */
  allowOvertime: boolean
  /** 是否免扣分 */
  allowLateNoPenalty: boolean
  /** 全局：是否启用超时衰减（家长可一键关闭） */
  overtimeEnabled?: boolean
  /** 全局：质量加分的评级阈值 */
  qualityBonusThreshold?: QualityGrade
  /** 全局：超时衰减最低保留比例（0-1），低于该比例直接归零 */
  minRatioForPoints?: number
}

const GRADE_ORDER: Record<QualityGrade, number> = { poor: 0, ok: 1, great: 2 }

/** 评级是否达到阈值 */
export function gradeReaches(grade: QualityGrade, threshold: QualityGrade): boolean {
  return GRADE_ORDER[grade] >= GRADE_ORDER[threshold]
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
  const qualityBonus = Math.max(0, Math.round(p.qualityBonusPoints))

  // ---------- 质量分（独立维度） ----------
  const threshold = p.qualityBonusThreshold ?? 'ok'
  const qualityEarned =
    p.qualityRated && p.quality && gradeReaches(p.quality, threshold) && qualityBonus > 0
      ? qualityBonus
      : 0

  // ---------- 免扣分：全额 ----------
  if (p.allowLateNoPenalty) {
    const overtime = actual > planned
    return {
      points: base + qualityEarned,
      overtime,
      ratio: planned > 0 && Number.isFinite(actual) ? actual / planned : 0,
      zeroed: false,
      reason:
        base + qualityEarned > 0
          ? overtime
            ? `虽然晚了一点，但这类任务不扣分，拿到全部 ${base} 分`
            : `按时完成，拿到全部 ${base} 分`
          : '没有积分奖励，但完成啦！',
    }
  }

  // ---------- 没开始 / 没有用时记录 ----------
  if (!Number.isFinite(actual)) {
    return {
      points: qualityEarned,
      overtime: true,
      ratio: Number.POSITIVE_INFINITY,
      zeroed: true,
      zeroReason: 'not_returned',
      reason:
        qualityEarned > 0
          ? `没有在规定时间内记录完成，基础分没有了，但质量很棒还是有 ${qualityEarned} 分`
          : '没有在规定时间内记录完成，这次没有积分哦',
    }
  }

  // ---------- 未超时 ----------
  if (planned <= 0 || actual <= planned) {
    return {
      points: base + qualityEarned,
      overtime: false,
      ratio: planned > 0 ? actual / planned : 0,
      zeroed: false,
      reason:
        qualityEarned > 0
          ? `又快又好！${base} + 质量奖励 ${qualityEarned} = ${base + qualityEarned} 分`
          : `按时完成，拿到全部 ${base} 分`,
    }
  }

  // ---------- 超时 ----------
  const ratio = actual / planned

  // 全局关闭超时衰减 → 全额
  if (p.overtimeEnabled === false) {
    return {
      points: base + qualityEarned,
      overtime: true,
      ratio,
      zeroed: false,
      reason: `超时了但今天不扣分，拿到全部 ${base} 分`,
    }
  }

  // 严格限时任务：超时即 0
  if (!p.allowOvertime) {
    return {
      points: qualityEarned,
      overtime: true,
      ratio,
      zeroed: true,
      zeroReason: 'overtime_limit',
      reason:
        qualityEarned > 0
          ? `超出时间了，基础分没有啦，质量奖励保留 ${qualityEarned} 分`
          : `超出时间了，这次没有积分哦，下次准时试试`,
    }
  }

  // 宽容任务：超出计划一倍（ratio >= 2）归零
  if (ratio >= OVERTIME_ZERO_MULTIPLIER) {
    return {
      points: qualityEarned,
      overtime: true,
      ratio,
      zeroed: true,
      zeroReason: 'overtime_limit',
      reason:
        qualityEarned > 0
          ? `用时超过一倍了，基础分没有了，质量奖励保留 ${qualityEarned} 分`
          : `用时超过 ${
              planned * OVERTIME_ZERO_MULTIPLIER
            } 分钟了，这次没有积分，明天早一点开始吧`,
    }
  }

  // 线性衰减：ratio=1 → 100%，ratio→2 → 0%
  const decay = 2 - ratio
  const minRatio = p.minRatioForPoints ?? 0
  if (decay <= minRatio) {
    return {
      points: qualityEarned,
      overtime: true,
      ratio,
      zeroed: true,
      zeroReason: 'overtime_limit',
      reason: `超出时间太多了，这次没有积分`,
    }
  }

  const decayedBase = Math.round(base * decay)
  // 只要还在惩罚区间内，至少给 1 分 —— 否则孩子会看到"差 6 秒"却颗粒无收，
  // 这是最打击积极性的一种反馈。归零只发生在真正到达阈值时。
  const flooredBase = base > 0 ? Math.max(1, decayedBase) : 0
  const total = flooredBase + qualityEarned
  return {
    points: total,
    overtime: true,
    ratio,
    zeroed: false,
    reason:
      `用了 ${Math.round(actual)} 分钟，比计划的 ${planned} 分钟慢了一点，` +
      `拿到 ${flooredBase} 分` +
      (qualityEarned > 0 ? `，加上质量奖励 ${qualityEarned} 分，共 ${total} 分` : ''),
  }
}

/** 便捷重载：直接从任务定义 + 实际用时结算 */
export function settleTask(
  task: Pick<
    Task,
    | 'plannedMinutes'
    | 'basePoints'
    | 'qualityBonusPoints'
    | 'allowOvertime'
    | 'allowLateNoPenalty'
    | 'qualityRated'
  >,
  actualMinutes: number | undefined,
  quality: QualityGrade | undefined,
  global?: Pick<SettleParams, 'overtimeEnabled' | 'qualityBonusThreshold' | 'minRatioForPoints'>,
): SettlementResult {
  return settle({
    plannedMinutes: task.plannedMinutes,
    actualMinutes,
    basePoints: task.basePoints,
    qualityBonusPoints: task.qualityBonusPoints,
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
  global?: Pick<SettleParams, 'overtimeEnabled' | 'qualityBonusThreshold' | 'minRatioForPoints'>,
): SettlementResult {
  return settleTask(inst, inst.actualMinutes, inst.quality, global)
}

/**
 * 由实际用时推算质量评级的建议值（给 UI 做默认选中，孩子仍可改）。
 * 低龄友好：默认给"不错"，避免孩子因为不懂而全选最差。
 */
export function suggestQuality(result: SettlementResult): QualityGrade {
  if (!result.overtime) return 'great'
  if (result.zeroed) return 'ok'
  return 'ok'
}

/** 结算前预览：给孩子看"如果现在提交能拿多少分" */
export function previewPoints(
  inst: TaskInstance,
  actualMinutes: number | undefined,
  quality: QualityGrade | undefined,
  global?: Pick<SettleParams, 'overtimeEnabled' | 'qualityBonusThreshold' | 'minRatioForPoints'>,
): SettlementResult {
  return settle({
    plannedMinutes: inst.plannedMinutes,
    actualMinutes,
    basePoints: inst.basePoints,
    qualityBonusPoints: inst.qualityBonusPoints,
    quality,
    qualityRated: inst.qualityRated,
    allowOvertime: inst.allowOvertime,
    allowLateNoPenalty: inst.allowLateNoPenalty,
    ...global,
  })
}
