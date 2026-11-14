/* ============================================================
   主线活动（Campaign）—— 纯逻辑
   ------------------------------------------------------------
   用户 2026-11-12：「添加活动模块，比如完成 5 个任务免费激活下落的2048，
   比如兑换券满 100 激活云边小农场，类似主线任务。」

   ## 三条设计口径（改之前先读完）

   1. **关卡之间不设门禁。**
      每关的进度**各自独立**判定：攒够 300 张券的人可以直接领第 4 关，
      不必先领前 3 关。
      反过来（前一关不领就不算后一关）看着更像主线，但会造出一种很难解释的局面：
      孩子明明攒够了券，界面上却写着「先完成第 1 关」——而第 1 关他早就够条件了，
      只是没点领取。那种设计只会教孩子乱点按钮。

   2. **「累计赚到」而不是「当前余额」。**
      兑换券花掉不该让进度倒退。用余额的话，孩子攒到 99 张、换了个玩具，
      进度掉回 0，会把「攒钱」这件事教成「不许花钱」。
      ⇒ 口径 = 账本里**赚进来**的那些正数流水之和（白名单见 `EARN_SOURCES`），
        退款和家长手工调整都不算。

   3. **奖励是「送一款游戏」。**
      送的是**拥有关系**（永久），不是「体验券」。所以领取之后孩子
      在「设置 / 游戏」里看到的是「未装 / 下载」，点一下就能玩。

   ⚠️ **奖励不能选「默认免费」的游戏**——那样这一关一开局就能领，领了什么都不多。

   ★★ 2026-11-14 用户明确要求第 2 关送「云边小农场」（`cloudfarm`），
      而它在**服务端**是 `default_owned=1`（登录时 `EnsureUserGames` 直接塞进
      `user_game`）⇒ 这一关对所有人是白送。
      处理：把服务端 seed 的 `DefaultOwned` 改成 false，并 UPDATE 线上库；
      **已有的 `user_game` 记录保留** ⇒ 老用户不受影响，新用户才需要靠这一关解锁。
      `campaign.test.ts` 有一条断言钉着「不能送客户端认为默认拥有的游戏」。
   ============================================================ */

import type { HarvestEntry, TaskInstance } from './types'

/** 进度指标 —— 只有这两种，加新的要同时改服务端 `campaign.go` 的同名常量 */
export type CampaignMetric = 'task_done' | 'coupon_earned'

export interface CampaignStep {
  /** 稳定 id：**服务端的领取记录按它去重**，改了等于把老记录作废 */
  id: string
  title: string
  emoji: string
  goal: { metric: CampaignMetric; target: number }
  /**
   * 奖励：送哪款游戏（`name` 只是兜底文案，真名优先取目录里的）。
   *
   * `random: true` ⇒ **具体哪一款由服务端挑**（见 `entities/campaign.go`）：
   * 它知道用户已经拥有什么，客户端不知道别人的账号状态。
   * 这时 `gameId` / `name` 只是没拿到结果前的兜底文案。
   */
  reward: { gameId: string; name: string; random?: boolean }
  /** 领完那一句鼓励，给孩子看的 */
  cheer: string
}

/**
 * 主线关卡表。**顺序就是界面顺序**。
 *
 * 加一关要动的地方：这里、服务端 `campaign.go` 的 `campaignSteps`、
 * 以及 `campaign.test.ts` 里那条「id 与奖励都不能撞」的断言。
 */
export const CAMPAIGN_STEPS: readonly CampaignStep[] = [
  {
    id: 'first5',
    title: '先做 5 个任务',
    emoji: '🌱',
    goal: { metric: 'task_done', target: 5 },
    reward: { gameId: 'fall2048', name: '下落的2048' },
    cheer: '第一关就过了，送你一款新游戏！',
  },
  {
    id: 'coupon100',
    title: '攒够 100 张兑换券',
    emoji: '🎫',
    goal: { metric: 'coupon_earned', target: 100 },
    reward: { gameId: 'cloudfarm', name: '云边小农场' },
    cheer: '会攒钱也会玩，云边小农场归你啦。',
  },
  {
    id: 'first15',
    title: '再做 10 个任务（累计 15 个）',
    emoji: '📚',
    goal: { metric: 'task_done', target: 15 },
    reward: { gameId: 'screamchick', name: '尖叫鸡' },
    cheer: '坚持下来的人才有这一关，尖叫鸡归你了。',
  },
  {
    id: 'coupon300',
    title: '累计攒到 300 张兑换券',
    emoji: '🏦',
    goal: { metric: 'coupon_earned', target: 300 },
    reward: { gameId: 'hoopsneak', name: '偷偷投篮' },
    cheer: '你是真的会攒钱，偷偷投篮送你。',
  },
  {
    /* 用户 2026-11-14：「第5关 完成 50 个任务，奖励随机一个没拥有的游戏。」
       随机由服务端挑 —— 只有它知道这个账号已经有哪些。 */
    id: 'first50',
    title: '完成 50 个任务',
    emoji: '🎲',
    goal: { metric: 'task_done', target: 50 },
    reward: { gameId: 'blockfit', name: '随机一款你没玩过的', random: true },
    cheer: '50 个任务！这一关送你一款你还没有的游戏。',
  },
  {
    id: 'coupon600',
    title: '累计攒到 600 张兑换券',
    emoji: '💎',
    goal: { metric: 'coupon_earned', target: 600 },
    reward: { gameId: 'blockfit', name: '方块填空' },
    cheer: '600 张券，方块填空归你。',
  },
  {
    id: 'first100',
    title: '完成 100 个任务',
    emoji: '🏅',
    goal: { metric: 'task_done', target: 100 },
    reward: { gameId: 'prizepark', name: '抓奖乐园' },
    cheer: '一百个任务，抓奖乐园开张了。',
  },
  {
    id: 'coupon1000',
    title: '累计攒到 1000 张兑换券',
    emoji: '👑',
    goal: { metric: 'coupon_earned', target: 1000 },
    reward: { gameId: 'claw3d', name: '抓娃娃' },
    cheer: '四位数！最后一关也过了，抓娃娃送你。',
  },
]

/**
 * 算作「赚到兑换券」的来源白名单。
 *
 * ⚠️ 必须是**白名单**，不能写成「所有正数流水」：
 *   · `wish_refund` 是退款 —— 退回来的是自己花掉的，不是赚的；
 *   · `manual_adjust` 是家长手工加的 —— 把它算进去，家长发一笔 300 券
 *     就能一键点亮全部活动，那这条主线就失去意义了。
 */
const EARN_SOURCES: ReadonlySet<string> = new Set([
  'farm_harvest',
  'farm_market',
  'claw_prize',
  'game_redeem',
])

/** 指标的中文说法（进度文案、单位都在这里，别在组件里手写） */
export const CAMPAIGN_METRIC_META: Record<CampaignMetric, { label: string; unit: string }> = {
  task_done: { label: '完成任务', unit: '个' },
  coupon_earned: { label: '累计赚到兑换券', unit: '张' },
}

export interface CampaignStats {
  tasksDone: number
  couponsEarned: number
}

/**
 * 从本地数据算出两个指标。
 *
 * `tasksDone` 只认 `completed` / `failed`：
 * 后者是「做完了但超时零分」，对孩子来说仍然是**做完了一个任务**。
 * `submitted`（等家长看一眼）**不算** —— 还没被认。
 */
export function campaignStatsFrom(
  instances: readonly Pick<TaskInstance, 'status'>[],
  harvest: readonly Pick<HarvestEntry, 'delta' | 'source'>[],
): CampaignStats {
  let tasksDone = 0
  for (const i of instances) {
    if (i.status === 'completed' || i.status === 'failed') tasksDone++
  }
  let couponsEarned = 0
  for (const e of harvest) {
    if (e.delta > 0 && EARN_SOURCES.has(e.source)) couponsEarned += e.delta
  }
  return { tasksDone, couponsEarned }
}

export function statOf(stats: CampaignStats, metric: CampaignMetric): number {
  return metric === 'task_done' ? stats.tasksDone : stats.couponsEarned
}

/**
 * 一关的三种状态。
 *
 * ⚠️ 没有 `'locked'`：见文件头第 1 条 —— 关卡之间不设门禁。
 */
export type CampaignStepState = 'claimed' | 'ready' | 'doing'

export interface CampaignStepView {
  step: CampaignStep
  state: CampaignStepState
  /** 当前进度（可能超过 target，展示时按 target 截断） */
  have: number
  need: number
  /** 0–100，已封顶 */
  percent: number
  /** 还差多少（已领 / 已达成时为 0） */
  shortfall: number
}

/** 把关卡表 + 统计 + 已领集合拼成可直接渲染的视图 */
export function campaignViews(
  stats: CampaignStats,
  claimed: readonly string[],
): CampaignStepView[] {
  const got = new Set(claimed)
  return CAMPAIGN_STEPS.map((step) => {
    const have = statOf(stats, step.goal.metric)
    const need = step.goal.target
    const isClaimed = got.has(step.id)
    const done = have >= need
    return {
      step,
      state: isClaimed ? 'claimed' : done ? 'ready' : 'doing',
      have,
      need,
      percent: need <= 0 ? 100 : Math.min(100, Math.floor((have / need) * 100)),
      shortfall: isClaimed || done ? 0 : need - have,
    }
  })
}

/** 总览：几关、领了几关、能不能领 */
export function campaignSummary(views: readonly CampaignStepView[]) {
  return {
    total: views.length,
    claimed: views.filter((v) => v.state === 'claimed').length,
    ready: views.filter((v) => v.state === 'ready').length,
  }
}

/**
 * 卡片上要「主推」的那一关：**先可领取、再下一个进行中的**。
 *
 * 为什么不是「第一个没领的」：第 2 关够了、第 1 关还差 3 个任务时，
 * 第一个没领的是第 1 关 ⇒ 卡片会让已经够条件的孩子继续去做任务，
 * 而他手上明明有一份能立刻领的奖励。
 */
export function spotlightStep(views: readonly CampaignStepView[]): CampaignStepView | undefined {
  return views.find((v) => v.state === 'ready') ?? views.find((v) => v.state === 'doing')
}

/** 进度文案：`3 / 5 个任务`、`还差 2 个任务` */
export function campaignProgressText(v: CampaignStepView): string {
  const meta = CAMPAIGN_METRIC_META[v.step.goal.metric]
  if (v.state === 'claimed') return '已领取'
  if (v.state === 'ready') return '可以领取啦'
  return `还差 ${v.shortfall} ${meta.unit === '张' ? '张兑换券' : '个任务'}`
}

/* ------------------------------------------------------------------ *
 * 随机奖励（2026-11-14，第 5 关）
 * ------------------------------------------------------------------ */

/**
 * 从「随包的游戏」里挑一款**孩子还没有的**，给「随机一款」那一关用。
 *
 * 用户原话：「第5关 完成 50 个任务，奖励随机一个没拥有的游戏。」
 *
 * ## 为什么是纯函数（传 ownedIds 和随机源进来）
 *
 * 直接在 store 里写 `Math.random()` 的话，这条逻辑**没法测** ——
 * 单测只能反复跑碰运气。这里把「候选集」和「随机源」都做成入参：
 *
 *     pickRandomReward(['anthill'], () => 0)   // 必定挑第一个候选
 *
 * ## 候选集怎么定
 *
 * 只从 `localGames`（随包的那批）里挑：单机版没有目录服务，
 * 挑了没包的游戏等于给一个装不上的奖励。
 *
 * 排除三类：
 *   ① 已拥有（`ownedIds`）；
 *   ② 内置农场（`farm`，本来就默认拥有，不在这份表里）；
 *   ③ 主线关卡已经明码送过的（`CAMPAIGN_STEPS` 里的 gameId）——
 *      不然「随机」可能抽到第 1 关刚送的那款，孩子看到「又是这个」。
 */
export function pickRandomReward(
  ownedIds: readonly string[],
  /** 候选池。⚠️ **必传**：`domain/` 不能反向依赖 `games/`（会成环），
   *  所以由调用方（store）把「随包游戏」传进来；单测传小样本。 */
  pool: readonly { id: string; name: string }[],
  rand: () => number = Math.random,
): { id: string; name: string } | undefined {
  const owned = new Set(ownedIds)
  /* 明码送过的那些不算「随机」，否则会撞：孩子刚领完下落的2048，
     第 5 关又抽到它，界面还会说「送你一款新游戏」。 */
  const fixedGifts = new Set(CAMPAIGN_STEPS.filter((s) => !s.reward.random).map((s) => s.reward.gameId))

  const candidates = pool.filter((g) => !owned.has(g.id) && !fixedGifts.has(g.id))
  if (candidates.length === 0) return undefined

  /* 夹一下：`rand()` 可能返回 1（有些实现是 [0,1] 闭区间）或 NaN，
     直接当索引会拿到 undefined。 */
  const r = rand()
  const i = Number.isFinite(r) ? Math.min(candidates.length - 1, Math.max(0, Math.floor(r * candidates.length))) : 0
  return candidates[i]
}
