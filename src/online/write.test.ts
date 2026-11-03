import { describe, expect, it } from 'vitest'

/* ============================================================
   在线写通道 + 失败文案（`src/online/write.ts`）
   ------------------------------------------------------------
   这个文件只有两个东西，但两件都是「用户唯一会读到的解释」：

     ① `onlineWrite` 的契约：**不抛、给结论**。抛出去没人接，控制台报错
        而界面毫无反应 —— 那是最难查的一种「点了没反应」。
     ② `writeFailToast` 的文案。家长看到的就是这几句，而写错的表现是
        「他以为刚才那一下算数了」或者「他以为是自己的错」。

   所以这里不测实现细节，只测**承诺**。
   ============================================================ */

import { ApiError, NETWORK, UNAUTHORIZED } from '../api/client'
import { GUEST_NEED_BIND } from '../api/client'
import { onlineWrite, writeFailToast } from './write'

describe('onlineWrite：不抛、给结论', () => {
  it('成功 ⇒ ok:true + data', async () => {
    const r = await onlineWrite(async () => ({ id: 1 }))
    expect(r).toEqual({ ok: true, data: { id: 1 } })
  })

  it('★ 失败**不抛**，把异常收成 ok:false（否则「点了没反应」）', async () => {
    const r = await onlineWrite(async () => {
      throw new ApiError(10020301, '余额不足')
    })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('不该走到这里')
    expect(r.error.code).toBe(10020301)
    expect(r.error.message).toBe('余额不足')
  })

  it('★ 不是 ApiError 的异常也要包成 ApiError（别让调用方拿到裸 Error）', async () => {
    const r = await onlineWrite(async () => {
      throw new TypeError('x is not a function')
    })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('不该走到这里')
    expect(r.error).toBeInstanceOf(ApiError)
    /* 归成网络类：调用方按 `isNetwork` 分支时才不会漏掉这种情况 */
    expect(r.error.isNetwork).toBe(true)
    expect(r.error.message).toContain('x is not a function')
  })

  it('抛的东西连 message 都没有 ⇒ 也要有一句能看的话', async () => {
    const r = await onlineWrite(async () => {
      throw undefined
    })
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('不该走到这里')
    expect(r.error.message).toBeTruthy()
  })
})

describe('writeFailToast：家长读到的那句话', () => {
  const what = '这次兑换'

  it('★ 游客被拦：说「先绑定手机号」，**不能**说「失败」', () => {
    const t = writeFailToast(new ApiError(GUEST_NEED_BIND, 'guest-need-bind'), what)
    expect(t.title).toBe('先绑定手机号再兑换')
    /* 服务端拒得有道理，面板也已经弹出来了 —— 再写一句「失败」
       会让人以为是自己操作错了 */
    expect(t.title).not.toContain('失败')
    expect(t.detail).toContain(what)
    expect(t.detail, '要说清「没有生效」，否则他会以为已经兑换了').toContain('没有生效')
  })

  it('★ 网络问题：说清「没发出去」+「没有生效」', () => {
    const t = writeFailToast(new ApiError(NETWORK, '连不上服务器'), what)
    expect(t.title).toContain('没发出去')
    expect(t.detail).toContain('没有生效')
    expect(t.emoji).toBeTruthy()
  })

  it('★ 登录过期：给出下一步（重新登录），而不是只说失败了', () => {
    const t = writeFailToast(new ApiError(UNAUTHORIZED, '登录已过期'), what)
    expect(t.title).toContain('重新登录')
    expect(t.detail).toContain('没有生效')
  })

  it('★ 别的业务错误：标题带「哪件事」，正文带服务端的原话', () => {
    const t = writeFailToast(new ApiError(10020301, '余额不足'), what)
    expect(t.title).toContain(what)
    expect(t.title).toContain('没成功')
    expect(t.detail).toBe('余额不足')
  })

  it('★ 每种都是 warn（别用「成功」那种绿条骗人）', () => {
    const cases = [
      new ApiError(GUEST_NEED_BIND, 'g'),
      new ApiError(NETWORK, 'n'),
      new ApiError(UNAUTHORIZED, 'a'),
      new ApiError(1, 'x')
    ]
    for (const e of cases) expect(writeFailToast(e, what).kind).toBe('warn')
  })
})
