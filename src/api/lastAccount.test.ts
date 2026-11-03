import { beforeEach, describe, expect, it } from 'vitest'
import { lastAccount, lastWasRealAccount, rememberAccount } from './lastAccount'
import type { ApiUser } from './types'

/* ============================================================
   「这台设备上一次是谁」（2026-11-03）
   ------------------------------------------------------------
   它只决定一件事：会话过期之后，是**自动建一个游客账号**，
   还是**请他用手机号登回来**。

   判错的方向只有一个是有害的：把正式账号当成游客 ⇒ 悄悄给他一个空账号，
   他打开 App 发现东西全没了。所以「不知道」必须当成「不是正式账号」吗？

   —— 不。全新安装的机器 `lastAccount()` 是 null，那时候**必须**当成游客
   （否则「没耐心」的那批人一进来又被拦在登录面板前）。
   所以 `lastWasRealAccount()` 对 null 返回 false，而**只有明确的
   `guest: false`** 才返回 true。
   ============================================================ */

const user = (uid: number, isGuest: boolean): ApiUser => ({
  uid,
  username: '',
  mobile: '',
  mobile_verified: false,
  nickname: '',
  avatar: '',
  gender: 0,
  language: 'zh',
  is_guest: isGuest,
  has_password: false,
  has_wechat: false,
  created_at: 0,
})

describe('上一次是谁', () => {
  beforeEach(() => localStorage.clear())

  it('全新安装：不知道 ⇒ 不算正式账号（新用户不该被拦在登录面板前）', () => {
    expect(lastAccount()).toBeNull()
    expect(lastWasRealAccount()).toBe(false)
  })

  it('记游客', () => {
    rememberAccount(user(7, true))
    expect(lastAccount()).toEqual({ uid: 7, guest: true })
    expect(lastWasRealAccount()).toBe(false)
  })

  it('★ 记正式账号 ⇒ 以后启动要请他登录，不能塞个游客', () => {
    rememberAccount(user(9, false))
    expect(lastWasRealAccount()).toBe(true)
  })

  it('后写的覆盖先写的（同一个人换了账号）', () => {
    rememberAccount(user(9, false))
    rememberAccount(user(10, true))
    expect(lastAccount()).toEqual({ uid: 10, guest: true })
  })

  it('坏数据当成「不知道」，不抛', () => {
    localStorage.setItem('kqf.account.last.v1', '{不是 json')
    expect(lastAccount()).toBeNull()
    expect(lastWasRealAccount()).toBe(false)
  })

  it('形状不对也当成「不知道」', () => {
    localStorage.setItem('kqf.account.last.v1', JSON.stringify({ uid: '9' }))
    expect(lastAccount()).toBeNull()
  })
})
