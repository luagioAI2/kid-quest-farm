import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_STEPS,
  campaignProgressText,
  campaignStatsFrom,
  campaignSummary,
  campaignViews,
  pickRandomReward,
  spotlightStep,
  type CampaignStats,
} from './campaign'
import { GAMES, ownedByDefault } from '../games/registry'

/* 主线活动：算得对不对、能不能领、该主推哪一关。
   这里守三件最容易「静默做坏」的事：
     ① 指标算错（退款 / 家长手工加券被当成「赚到」）；
     ② 奖励送的是默认免费游戏（领了什么都不多）；
     ③ 主推逻辑挑错关卡（够条件的不推、推一个还差的）。 */

const stats = (tasksDone: number, couponsEarned: number): CampaignStats => ({
  tasksDone,
  couponsEarned,
})

describe('campaignStatsFrom', () => {
  it('completed 和 failed 都算「做完一个」；submitted / pending 不算', () => {
    const s = campaignStatsFrom(
      [
        { status: 'completed' },
        { status: 'failed' },
        { status: 'submitted' },
        { status: 'pending' },
        { status: 'expired' },
        { status: 'rejected' },
      ],
      [],
    )
    expect(s.tasksDone).toBe(2)
  })

  it('★ 兑换券只数「赚进来的」，退款和家长手工发放都不算', () => {
    const s = campaignStatsFrom(
      [],
      [
        { delta: 40, source: 'farm_harvest' },
        { delta: 10, source: 'farm_market' },
        // 退款：退回来的是自己花掉的，不是赚的
        { delta: 500, source: 'wish_refund' },
        // 家长手工加券：算进去的话发一笔就能点亮全部活动
        { delta: 300, source: 'manual_adjust' },
        // 花出去的不该是负数进度
        { delta: -80, source: 'harvest_redeem' },
      ],
    )
    expect(s.couponsEarned).toBe(50)
  })

  it('空数据是 0，不是 NaN', () => {
    const s = campaignStatsFrom([], [])
    expect(s.tasksDone).toBe(0)
    expect(s.couponsEarned).toBe(0)
  })
})

describe('campaignViews', () => {
  it('三态：doing / ready / claimed', () => {
    const views = campaignViews(stats(5, 0), [])
    const byId = Object.fromEntries(views.map((v) => [v.step.id, v]))
    // first5 完成 5 个 ⇒ ready
    expect(byId.first5.state).toBe('ready')
    // coupon100 一张券都没有 ⇒ doing
    expect(byId.coupon100.state).toBe('doing')
  })

  it('领过的就是 claimed，哪怕进度还够着', () => {
    const views = campaignViews(stats(5, 0), ['first5'])
    expect(views.find((v) => v.step.id === 'first5')!.state).toBe('claimed')
  })

  it('进度封顶 100%，但 have 保留真实值', () => {
    const v = campaignViews(stats(9, 0), []).find((x) => x.step.id === 'first5')!
    expect(v.percent).toBe(100)
    expect(v.have).toBe(9)
    expect(v.shortfall).toBe(0)
  })

  it('差一点点时 shortfall 是真实差值', () => {
    const v = campaignViews(stats(3, 60), []).find((x) => x.step.id === 'coupon100')!
    expect(v.shortfall).toBe(40)
    expect(v.percent).toBe(60)
  })
})

describe('spotlightStep：卡片主推哪一关', () => {
  it('★ 有能领的就推能领的，而不是「第一个没领的」', () => {
    // 第 1 关还差 2 个任务，但第 2 关的券已经够了
    const views = campaignViews(stats(3, 100), [])
    const pick = spotlightStep(views)!
    expect(pick.step.id).toBe('coupon100')
    expect(pick.state).toBe('ready')
  })

  it('都领完了就没有主推（卡片只在有待办时出现）', () => {
    const views = campaignViews(stats(999, 999), CAMPAIGN_STEPS.map((s) => s.id))
    expect(spotlightStep(views)).toBeUndefined()
  })
})

describe('文案', () => {
  it('三种状态各说各自的话', () => {
    const views = campaignViews(stats(3, 0), [])
    const doing = views.find((v) => v.step.id === 'first5')!
    expect(campaignProgressText(doing)).toBe('还差 2 个任务')

    const ready = campaignViews(stats(5, 0), []).find((v) => v.step.id === 'first5')!
    expect(campaignProgressText(ready)).toBe('可以领取啦')

    const claimed = campaignViews(stats(5, 0), ['first5']).find((v) => v.step.id === 'first5')!
    expect(campaignProgressText(claimed)).toBe('已领取')
  })
})

describe('关卡表本身的约束', () => {
  it('id 不重复', () => {
    const ids = CAMPAIGN_STEPS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('★ 奖励不能是「默认免费」的游戏 —— 否则这一关领了什么都不多', () => {
    // cloudfarm（云边小农场）就是默认拥有：用户举例时正好举了它，
    // 照抄会做出一关「一开局就能领、领完啥也没有」。
    const freeIds = GAMES.filter(ownedByDefault).map((g) => g.id)
    for (const step of CAMPAIGN_STEPS) {
      expect(freeIds, `${step.id} 送的是默认免费游戏`).not.toContain(step.reward.gameId)
    }
  })

  it('同一款游戏不能在两关里各送一次（随机那关不算）', () => {
    /* 随机奖励的 `gameId` 只是**兜底文案**，真送哪款由服务端挑
       ⇒ 它不该参与「不重复」的判定，否则会为了凑唯一性去挑一款用不上的兜底。 */
    const rewarded = CAMPAIGN_STEPS.filter((s) => !s.reward.random).map((s) => s.reward.gameId)
    expect(new Set(rewarded).size).toBe(rewarded.length)
  })

  it('★ 只有一关是「随机」，且它必须标 random 并给兜底文案', () => {
    /* 为什么只允许一关：随机送的游戏不可预期，多了孩子记不住
       "哪一关会给我新东西"。用户只要求第 5 关随机。 */
    const randoms = CAMPAIGN_STEPS.filter((s) => s.reward.random)
    expect(randoms).toHaveLength(1)
    // 兜底文案不能是空 —— 服务端还没回包时界面要显示它
    expect(randoms[0].reward.name.length).toBeGreaterThan(0)
  })

  it('★ 目标值随关卡递增（不能后面比前面还容易）', () => {
    /* 用户：「数值 要增加」。按指标各自比 —— 任务是任务、券是券，
       两种指标不能直接比大小。 */
    for (const metric of ['task_done', 'coupon_earned'] as const) {
      const targets = CAMPAIGN_STEPS.filter((s) => s.goal.metric === metric).map((s) => s.goal.target)
      for (let i = 1; i < targets.length; i++) {
        expect(targets[i], `${metric} 第 ${i + 1} 个目标没比前一个大`).toBeGreaterThan(targets[i - 1])
      }
    }
  })

  it('目标值都是正整数', () => {
    for (const s of CAMPAIGN_STEPS) {
      expect(Number.isInteger(s.goal.target)).toBe(true)
      expect(s.goal.target).toBeGreaterThan(0)
    }
  })
})

describe('campaignSummary', () => {
  it('数得对', () => {
    const views = campaignViews(stats(5, 100), ['first5'])
    const sum = campaignSummary(views)
    expect(sum.total).toBe(CAMPAIGN_STEPS.length)
    expect(sum.claimed).toBe(1)
    expect(sum.ready).toBe(1) // coupon100
  })
})

describe('pickRandomReward（第 5 关的「随机一款」）', () => {
  const pool = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
    { id: 'fall2048', name: '下落的2048' }, // 第 1 关明码要送的
    { id: 'screamchick', name: '尖叫鸡' }, // 第 3 关明码要送的
  ]

  it('只从「没拥有」的里挑', () => {
    const got = pickRandomReward(['a', 'b'], pool, () => 0)
    expect(got?.id).toBe('c')
  })

  it('★ 不挑主线明码送过的那几款（否则孩子会「又是这个」）', () => {
    /* 把 a/b/c 都标记为已拥有 ⇒ 只剩 fall2048 / screamchick，
       而它们都被前面的关卡送了 ⇒ 没有候选，返回 undefined。 */
    const got = pickRandomReward(['a', 'b', 'c'], pool, () => 0)
    expect(got).toBeUndefined()
  })

  it('rand 返回 1（有些实现是闭区间）不会越界拿到 undefined', () => {
    const got = pickRandomReward([], pool, () => 1)
    expect(got).toBeDefined()
  })

  it('rand 返回 NaN 时退到第一个候选，不崩', () => {
    const got = pickRandomReward([], pool, () => NaN)
    expect(got).toBeDefined()
  })

  it('候选集不同位置取样都对（0 / 0.5 / 接近 1）', () => {
    const at0 = pickRandomReward([], [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }], () => 0)
    const at1 = pickRandomReward([], [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }], () => 0.99)
    expect(at0?.id).toBe('x')
    expect(at1?.id).toBe('y')
  })
})
