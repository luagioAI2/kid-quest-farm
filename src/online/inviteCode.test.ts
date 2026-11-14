import { beforeEach, describe, expect, it } from 'vitest'

/* ============================================================
   邀请码暂存（`src/online/inviteCode.ts`）
   ------------------------------------------------------------
   这里测的是「码从哪来、什么时候清」这两件事。它们错了的表现都是**静默**的：

     · 粗筛太松 ⇒ 把用户随手粘的一段话发到服务端，被拒，然后**永远**掉到官方模板；
     · 该清没清 ⇒ 换了账号还在绑别人的码；
     · 不该清却清了 ⇒ 商家归属永久丢失，而这个账号一辈子看哪套模板就此定死。
   ============================================================ */

import {
  clearInviteCode,
  looksLikeInviteCode,
  normalizeInviteCode,
  peekInviteCode,
  stashInviteCode,
  stashInviteFromUrl,
} from './inviteCode'

beforeEach(() => {
  localStorage.clear()
})

describe('normalizeInviteCode / looksLikeInviteCode', () => {
  it('去掉空格并转大写（从微信复制常带空格，手打常是小写）', () => {
    expect(normalizeInviteCode('  tf73-dc44 ')).toBe('TF73-DC44')
    expect(normalizeInviteCode('TF 73 - DC 44')).toBe('TF73-DC44')
  })

  it('认得住真正的码', () => {
    expect(looksLikeInviteCode('TF73-DC44')).toBe(true)
    expect(looksLikeInviteCode(' tf1-0a0a ')).toBe(true)
    expect(looksLikeInviteCode('TFZZZZZZ-FFFF')).toBe(true)
  })

  it('★ 明显不是码的不许混进来（校验位对不对由服务端判）', () => {
    for (const bad of [
      '',
      'hello',
      'TF73',
      'TF73-DC4', // 校验位少一位
      'TF73-DC44X', // 多一位
      'AB73-DC44', // 前缀不对
      'TF- DC44', // 没有 uid 部分
      'TF73-DC4G', // 校验位里有非 16 进制字符
    ]) {
      expect(looksLikeInviteCode(bad), bad).toBe(false)
    }
  })
})

describe('stash / peek / clear', () => {
  it('存进去能读出来', () => {
    expect(stashInviteCode('tf73-dc44')).toBe(true)
    expect(peekInviteCode()).toBe('TF73-DC44')
  })

  it('★ 形状不对的**不存**（别让它一路带到服务端再被拒）', () => {
    expect(stashInviteCode('随便写的')).toBe(false)
    expect(peekInviteCode()).toBeNull()
  })

  it('clear 之后就没有了', () => {
    stashInviteCode('TF73-DC44')
    clearInviteCode()
    expect(peekInviteCode()).toBeNull()
  })

  it('库里存了脏数据 ⇒ 当作没有（不是抛错）', () => {
    localStorage.setItem('kqf.invite.pending.v1', 'garbage')
    expect(peekInviteCode()).toBeNull()
  })
})

describe('stashInviteFromUrl', () => {
  it('?invite= 能读到', () => {
    expect(stashInviteFromUrl('?invite=TF73-DC44', '')).toBe(true)
    expect(peekInviteCode()).toBe('TF73-DC44')
  })

  it('#invite= 也能读到（hash 路由下商家链接常长这样）', () => {
    expect(stashInviteFromUrl('', '#invite=TF1-0A0A')).toBe(true)
    expect(peekInviteCode()).toBe('TF1-0A0A')
  })

  it('?code= 也认（物料上常这么印）', () => {
    expect(stashInviteFromUrl('?code=TF1-0A0A', '')).toBe(true)
    expect(peekInviteCode()).toBe('TF1-0A0A')
  })

  it('没有码 ⇒ 什么都不做（别把上一次的码盖掉/清掉）', () => {
    stashInviteCode('TF73-DC44')
    expect(stashInviteFromUrl('?foo=1', '')).toBe(false)
    expect(peekInviteCode()).toBe('TF73-DC44')
  })

  it('码是垃圾 ⇒ 不存', () => {
    expect(stashInviteFromUrl('?invite=hello', '')).toBe(false)
    expect(peekInviteCode()).toBeNull()
  })
})
