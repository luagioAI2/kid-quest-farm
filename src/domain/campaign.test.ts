import { describe, expect, it } from 'vitest'
import {
  CAMPAIGN_STEPS,
  campaignProgressText,
  campaignStatsFrom,
  campaignSummary,
  campaignViews,
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

  it('同一款游戏不能在两关里各送一次', () => {
    const rewarded = CAMPAIGN_STEPS.map((s) => s.reward.gameId)
    expect(new Set(rewarded).size).toBe(rewarded.length)
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
