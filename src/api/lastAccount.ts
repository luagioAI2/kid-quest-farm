/* ============================================================
   「这台设备上一次是谁在用」（2026-11-03）
   ------------------------------------------------------------
   只存两件事：uid 和「是不是游客」。

   ## 为什么不能只看 session

   会话（`api/session.ts`）在 401 之后会被清掉，而清掉之后**正好**是
   需要这个判断的时刻：

     · 上一次是**游客** ⇒ 清掉无所谓，下次启动重新建一个游客账号，
       服务端按设备号把原来那个还回来，进度一点不丢；
     · 上一次是**正式账号** ⇒ 千万**不能**自动建游客。
       那等于把人悄悄换成一个空账号 —— 他的任务、积分、券都还在
       原来那个账号里，而屏幕上是一片空白。他会以为数据没了。

   所以正式账号的会话过期之后，要**请他用手机号登回来**，而不是
   给他一个新账号。这条判断没有会话就做不出来，只能单独记一份。

   ## 退出登录**不清**它

   退出登录的意图是「换个人」，所以之后启动仍然应该请他登录
   （`needs-login`），而不是塞给他一个游客账号。真要「先随便玩玩」，
   登录面板上有一个显式入口（`LoginSheet` 的「先随便玩玩」）。
   ============================================================ */

import type { ApiUser } from './types'

const KEY = 'kqf.account.last.v1'

export interface LastAccount {
  uid: number
  /** 上一次用的是游客账号 */
  guest: boolean
}

/** 每次拿到会话（登录 / 注册 / 游客 / 刷新资料）都记一笔 */
export function rememberAccount(user: ApiUser): void {
  try {
    const v: LastAccount = { uid: user.uid, guest: user.is_guest === true }
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* 存不住就退化成「不知道上一次是谁」—— 下次启动会建游客账号。
       这比抛错好：抛错会把整个启动流程卡住。 */
  }
}

export function lastAccount(): LastAccount | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<LastAccount>
    if (typeof v?.uid !== 'number' || typeof v?.guest !== 'boolean') return null
    return { uid: v.uid, guest: v.guest }
  } catch {
    return null
  }
}

/**
 * 上一次用的是**正式账号**（不是游客，也不是「不知道」）。
 *
 * 「不知道」要当成 false：全新安装的机器不该被拦在登录面板前面 ——
 * 那正是「没耐心」的那批人。
 */
export function lastWasRealAccount(): boolean {
  const v = lastAccount()
  return v !== null && v.guest === false
}
