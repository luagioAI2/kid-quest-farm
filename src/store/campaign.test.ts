import { beforeEach, describe, expect, it, vi } from 'vitest'

/* 主线活动 · 领奖走的是**本地**这条路（未登录 / 单机版）。

   要守的是「领了到底算不算拥有」：
   拥有关系是**从 `mallLedger` 推出来的**（`purchasedIdsFrom`），
   所以领奖必须真的写进账本 —— 只改一个内存里的「已领」标记，
   界面上会显示「已领取」，而游戏库里根本没有那款，且**不报错**。
*/

import { db, getMeta } from '../db/db'
import { useApp } from './useApp'
import { CAMPAIGN_STEPS } from '../domain/campaign'

const FALL = CAMPAIGN_STEPS.find((s) => s.id === 'first5')!

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 直接塞 N 个「已完成」的任务实例（不走计时/审核，那些有自己的测试） */
async function seedDoneTasks(n: number) {
  const now = Date.now()
  for (let i = 0; i < n; i++) {
    await db.taskInstances.put({
      id: `inst-${i}`,
      taskId: 't1',
      periodKey: `2026-11-${String(i + 1).padStart(2, '0')}`,
      date: `2026-11-${String(i + 1).padStart(2, '0')}`,
      title: `任务 ${i + 1}`,
      category: 'study',
      cycle: 'daily',
      plannedMinutes: 20,
      basePoints: 10,
      allowOvertime: false,
      allowLateNoPenalty: false,
      qualityRated: false,
      rewardItemIds: [],
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    })
  }
  await useApp.getState().refresh()
}

beforeEach(async () => {
  await boot()
  // 装包不动网络：这个文件只测「领奖算不算拥有」
  useApp.setState({
    installGameAuto: async () => ({ ok: true, message: '已安装（测试）' }),
  })
})

describe('主线活动：条件不够时不许领', () => {
  it('差 3 个任务 → 拒绝，一个字节都不写', async () => {
    await seedDoneTasks(2)
    const before = await db.mallLedger.count()

    const r = await useApp.getState().claimCampaignStep('first5')

    expect(r.ok).toBe(false)
    expect(r.message).toContain('还差 3')
    expect(await db.mallLedger.count()).toBe(before)
    expect(useApp.getState().campaignClaims).not.toContain('first5')
  })

  it('不存在的关卡 → 明确说没有，不崩', async () => {
    const r = await useApp.getState().claimCampaignStep('nope')
    expect(r.ok).toBe(false)
    expect(r.message).toContain('没有这一关')
  })
})

describe('主线活动：领到之后必须真的算拥有', () => {
  it('★ 完成 5 个任务 → 领取 → 账本有 campaign 行、拥有列表里有那款、标记已领', async () => {
    await seedDoneTasks(5)

    const r = await useApp.getState().claimCampaignStep('first5')
    expect(r.ok).toBe(true)
    expect(r.message).toContain(FALL.reward.name)

    // ① 账本：delta 恒为 0（活动奖励不花币，写别的数就是假账）
    const rows = (await db.mallLedger.toArray()).filter((x) => x.source === 'campaign')
    expect(rows).toHaveLength(1)
    expect(rows[0].delta).toBe(0)
    expect(rows[0].refId).toBe(FALL.reward.gameId)

    // ② 拥有关系是从账本推的 —— 这条才是「领了到底算不算有」
    expect(useApp.getState().ownedGameIds).toContain(FALL.reward.gameId)

    // ③ 已领标记（内存 + meta 两处都要对：前者管界面，后者管重启后还记得）
    expect(useApp.getState().campaignClaims).toContain('first5')
    expect(await getMeta<string[]>('campaign.claimed', [])).toContain('first5')
  })

  it('★ 同一关不能领两次（第二次一分不写）', async () => {
    await seedDoneTasks(5)
    await useApp.getState().claimCampaignStep('first5')
    const rows1 = (await db.mallLedger.toArray()).filter((x) => x.source === 'campaign')

    const again = await useApp.getState().claimCampaignStep('first5')

    expect(again.ok).toBe(false)
    expect(again.message).toContain('已经领过')
    const rows2 = (await db.mallLedger.toArray()).filter((x) => x.source === 'campaign')
    expect(rows2).toHaveLength(rows1.length)
  })

  it('装包失败不算领取失败 —— 游戏已经在库里了', async () => {
    await seedDoneTasks(5)
    useApp.setState({
      installGameAuto: async () => ({ ok: false, message: '下载超时' }),
    })

    const r = await useApp.getState().claimCampaignStep('first5')

    expect(r.ok).toBe(true)
    expect(r.message).toContain('没装成功')
    expect(r.message).toContain('我的游戏')
    expect(useApp.getState().ownedGameIds).toContain(FALL.reward.gameId)
  })
})

describe('主线活动：奖励本来就有时别撒谎', () => {
  it('★ 早就拥有这款游戏 → 说「本来就有」，不说「已经放进游戏柜啦」', async () => {
    await seedDoneTasks(5)
    // 先把它变成「已拥有」（模拟之前买过 / 用码换过）
    const gameId = FALL.reward.gameId
    const { postMall } = await import('../db/db')
    await postMall({ delta: 0, source: 'redemption_code', refId: gameId, memo: '之前换过' })
    await useApp.getState().refresh()
    expect(useApp.getState().ownedGameIds).toContain(gameId)

    const install = vi.fn(async () => ({ ok: true, message: '已安装' }))
    useApp.setState({ installGameAuto: install })

    const r = await useApp.getState().claimCampaignStep('first5')

    expect(r.ok).toBe(true)
    expect(r.message).toContain('本来就有')
    expect(r.message).not.toContain('放进游戏柜')
    // 本来就有就不用再装一遍
    expect(install).not.toHaveBeenCalled()
  })

  it('没有过 → 正常说「放进游戏柜」', async () => {
    await seedDoneTasks(5)
    const r = await useApp.getState().claimCampaignStep('first5')
    expect(r.message).toContain('放进游戏柜')
  })
})

describe('主线活动：奖励本来就有时别撒谎', () => {
  it('★ 早就拥有这款游戏 → 说「本来就有」，不说「已经放进游戏柜啦」', async () => {
    await seedDoneTasks(5)
    // 先把它变成「已拥有」（模拟之前买过 / 用码换过）
    const gameId = FALL.reward.gameId
    const { postMall } = await import('../db/db')
    await postMall({ delta: 0, source: 'redemption_code', refId: gameId, memo: '之前换过' })
    await useApp.getState().refresh()
    expect(useApp.getState().ownedGameIds).toContain(gameId)

    const install = vi.fn(async () => ({ ok: true, message: '已安装' }))
    useApp.setState({ installGameAuto: install })

    const r = await useApp.getState().claimCampaignStep('first5')

    expect(r.ok).toBe(true)
    expect(r.message).toContain('本来就有')
    expect(r.message).not.toContain('放进游戏柜')
    // 本来就有就不用再装一遍
    expect(install).not.toHaveBeenCalled()
  })

  it('没有过 → 正常说「放进游戏柜」', async () => {
    await seedDoneTasks(5)
    const r = await useApp.getState().claimCampaignStep('first5')
    expect(r.message).toContain('放进游戏柜')
  })
})

describe('主线活动：券那一关按「累计赚到」算', () => {
  it('★ 攒够 100 张券就能领；花掉一部分不影响（累计口径）', async () => {
    // 赚 120、花 100 ⇒ 余额 20，但累计赚到 120 ≥ 100，这一关仍然可领
    const { postHarvest } = await import('../db/db')
    await postHarvest({ delta: 120, source: 'farm_harvest', memo: '收成' })
    await postHarvest({ delta: -100, source: 'harvest_redeem', memo: '换了东西' })
    await useApp.getState().refresh()

    const r = await useApp.getState().claimCampaignStep('coupon100')

    expect(r.ok).toBe(true)
    expect(useApp.getState().ownedGameIds).toContain('renttower')
  })

  it('家长手工发的券不算「赚到」（否则发一笔就能点亮全部关卡）', async () => {
    const { postHarvest } = await import('../db/db')
    await postHarvest({ delta: 500, source: 'manual_adjust', memo: '家长发放' })
    await useApp.getState().refresh()

    const r = await useApp.getState().claimCampaignStep('coupon100')

    expect(r.ok).toBe(false)
    expect(r.message).toContain('还差 100')
  })
})
