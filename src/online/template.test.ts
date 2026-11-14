import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ============================================================
   首次落地模板（`src/online/template.ts`）
   ------------------------------------------------------------
   这里最重要的一条是 **「绑定邀请码失败时不许铺模板」**。

   铺模板一辈子只铺一次（服务端 `template_apply` 的 uid 唯一键），
   所以顺序错了不是「下次改正」，而是**永久**给这个账号发错一套内容：
   推广用户看到的是官方模板，商家归属后来绑上了，模板却再也换不回来。
   而界面上不会有任何异常 —— 只有商家发现「我推来的人没用我的任务」。

   其余几条测的都是「别把新用户卡在空界面上」：坏码、断网、apply 500
   都不该让启动失败，但也不能把「没铺」记成「铺过了」。
   ============================================================ */

const bindInvite = vi.fn()
const applyTemplate = vi.fn()
const getToken = vi.fn()
const getSession = vi.fn()

vi.mock('../api/template', () => ({
  bindInvite: (...a: unknown[]) => bindInvite(...a),
  applyTemplate: (...a: unknown[]) => applyTemplate(...a),
}))

vi.mock('../api/session', () => ({
  getToken: () => getToken(),
  getSession: () => getSession(),
}))

/* 本地版没有这套东西 —— 用 mock 直接钉成在线版，免得依赖构建期变量 */
vi.mock('../sync/pull', () => ({ isOnlineMode: true }))

import { ApiError, NETWORK } from '../api/client'
import { clearInviteCode, peekInviteCode, stashInviteCode } from './inviteCode'
import { ensureTemplateApplied } from './template'

const GUEST = { user: { uid: 1, is_guest: true } }
const REAL = { user: { uid: 2, is_guest: false } }

const APPLIED = {
  applied: true,
  reason: '',
  task_template_id: 1,
  redeem_template_id: 2,
  task_count: 16,
  redeem_count: 15,
  source_merchant_uid: 0,
}

beforeEach(() => {
  localStorage.clear()
  bindInvite.mockReset()
  applyTemplate.mockReset()
  getToken.mockReset()
  getSession.mockReset()
  getToken.mockReturnValue('tkn')
  getSession.mockReturnValue(REAL)
  applyTemplate.mockResolvedValue({ ...APPLIED })
})

describe('ensureTemplateApplied', () => {
  it('没登录 ⇒ 一个请求都不打', async () => {
    getToken.mockReturnValue(null)
    expect(await ensureTemplateApplied()).toBeNull()
    expect(bindInvite).not.toHaveBeenCalled()
    expect(applyTemplate).not.toHaveBeenCalled()
  })

  it('没有码 ⇒ 直接铺，铺完返回结果', async () => {
    const r = await ensureTemplateApplied()
    expect(r?.applied).toBe(true)
    expect(bindInvite).not.toHaveBeenCalled()
    expect(applyTemplate).toHaveBeenCalledTimes(1)
  })

  it('★ 先绑码再铺模板（顺序反了会铺成官方模板）', async () => {
    stashInviteCode('TF73-DC44')
    bindInvite.mockResolvedValue({ source_merchant_uid: 73, invite_code: 'TF73-DC44' })

    await ensureTemplateApplied()

    expect(bindInvite).toHaveBeenCalledWith('TF73-DC44')
    /* 两条都调过，而且绑定在铺之前 —— 用调用顺序断言，别只看「都调了」 */
    expect(bindInvite.mock.invocationCallOrder[0]).toBeLessThan(
      applyTemplate.mock.invocationCallOrder[0],
    )
  })

  it('绑到**正式账号**上 ⇒ 码清掉（不再重复绑）', async () => {
    stashInviteCode('TF73-DC44')
    bindInvite.mockResolvedValue({ source_merchant_uid: 73, invite_code: 'TF73-DC44' })

    await ensureTemplateApplied()

    expect(peekInviteCode()).toBeNull()
  })

  it('★ 游客绑上了也要**留着**码：注册会新建一个 uid，那个号还得再绑一次', async () => {
    getSession.mockReturnValue(GUEST)
    stashInviteCode('TF73-DC44')
    bindInvite.mockResolvedValue({ source_merchant_uid: 73, invite_code: 'TF73-DC44' })

    await ensureTemplateApplied()

    expect(peekInviteCode()).toBe('TF73-DC44')
  })

  it('★★ 绑定**网络失败** ⇒ 不铺模板，码留着下次再试', async () => {
    stashInviteCode('TF73-DC44')
    bindInvite.mockRejectedValue(new ApiError(NETWORK, '连不上服务器'))

    const r = await ensureTemplateApplied()

    expect(r).toBeNull()
    expect(applyTemplate, '这时候铺出来的一定是官方模板，而且改不回来').not.toHaveBeenCalled()
    expect(peekInviteCode()).toBe('TF73-DC44')
  })

  it('码被服务端拒绝（校验位错 / 商家没审核）⇒ 清掉，按官方模板继续', async () => {
    stashInviteCode('TF73-DC44')
    bindInvite.mockRejectedValue(new ApiError(10010400, '邀请码无效'))

    const r = await ensureTemplateApplied()

    expect(r?.applied).toBe(true)
    expect(applyTemplate).toHaveBeenCalledTimes(1)
    expect(peekInviteCode()).toBeNull()
  })

  it('apply 失败 ⇒ 返回 null，不抛（别让新用户卡在开场页）', async () => {
    applyTemplate.mockRejectedValue(new ApiError(500, '服务器开小差'))

    await expect(ensureTemplateApplied()).resolves.toBeNull()
  })

  it('并发两次只跑一趟（StrictMode 会把启动 effect 跑两遍）', async () => {
    const [a, b] = await Promise.all([ensureTemplateApplied(), ensureTemplateApplied()])
    expect(applyTemplate).toHaveBeenCalledTimes(1)
    expect(a).toEqual(b)
  })

  it('跑完之后可以再跑（下一次启动 / 换账号）', async () => {
    await ensureTemplateApplied()
    await ensureTemplateApplied()
    expect(applyTemplate).toHaveBeenCalledTimes(2)
  })

  it('清过的码不会再被绑', async () => {
    stashInviteCode('TF73-DC44')
    bindInvite.mockResolvedValue({ source_merchant_uid: 73, invite_code: 'TF73-DC44' })
    await ensureTemplateApplied()

    clearInviteCode()
    await ensureTemplateApplied()

    expect(bindInvite).toHaveBeenCalledTimes(1)
  })
})
