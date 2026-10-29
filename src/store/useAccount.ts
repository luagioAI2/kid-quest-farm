import { create } from 'zustand'
import { ApiError, bindAuthLost } from '../api/client'
import * as auth from '../api/auth'
import { getSession, sessionFrom, setSession, type Session } from '../api/session'
import type { SmsScene } from '../api/auth'

/* ============================================================
   登录态（2026-10-29 起，在线版）
   ------------------------------------------------------------
   这个 store **只管「我是谁」**，不碰业务数据：
   业务数据仍然在 `useApp`（Dexie）里，在线同步是后面几轮的事。

   为什么单独一个 store：`useApp` 已经 3700 行、几十个 action，
   再往里塞登录态会让它的每个测试都跟着变；而且登录态是**设备级**的，
   存档是**孩子级**的 —— 混在一起，导出存档就会把 token 一起导出。

   ## 错误怎么给到人

   所有动作都返回 `boolean`，失败原因放 `error`（中文、可直接显示）。
   不 throw：调用点在弹层里，throw 出去没人接，控制台报错而界面毫无反应 ——
   那是最难查的一种「点了没反应」。
   ============================================================ */

interface AccountState {
  session: Session | null
  /** 正在请求（按钮转圈 + 防连点） */
  busy: boolean
  /** 上一次失败的原因；成功后清空 */
  error: string | null

  login: (mobile: string, password: string) => Promise<boolean>
  register: (mobile: string, password: string, code: string, nickname?: string) => Promise<boolean>
  sendCode: (mobile: string, scene: SmsScene) => Promise<boolean>
  /**
   * 忘记密码：验证码 + 新密码。
   *
   * 成功后服务端会把**这台账号所有设备的票全撤掉**，所以这里只返回 true，
   * 不写会话 —— 调用方应该把人送回登录态，让他用新密码登一次。
   */
  resetPassword: (mobile: string, code: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  /** 用服务端最新资料覆盖本地那份（昵称/头像可能被后台改过） */
  refresh: () => Promise<void>
  /** 只清本地登录态（401 时由 `client` 调） */
  clear: () => void
}

const message = (e: unknown) =>
  e instanceof ApiError ? e.message : '出了点问题，请稍后再试'

export const useAccount = create<AccountState>((set, get) => ({
  session: getSession(),
  busy: false,
  error: null,

  login: async (mobile, password) => {
    set({ busy: true, error: null })
    try {
      const data = await auth.login(mobile.trim(), password)
      const s = sessionFrom(data)
      setSession(s)
      set({ session: s, busy: false })
      return true
    } catch (e) {
      set({ busy: false, error: message(e) })
      return false
    }
  },

  register: async (mobile, password, code, nickname) => {
    set({ busy: true, error: null })
    try {
      const data = await auth.register(mobile.trim(), password, code.trim(), nickname?.trim())
      const s = sessionFrom(data)
      setSession(s)
      set({ session: s, busy: false })
      return true
    } catch (e) {
      set({ busy: false, error: message(e) })
      return false
    }
  },

  sendCode: async (mobile, scene) => {
    set({ busy: true, error: null })
    try {
      await auth.sendSmsCode(mobile.trim(), scene)
      set({ busy: false })
      return true
    } catch (e) {
      set({ busy: false, error: message(e) })
      return false
    }
  },

  resetPassword: async (mobile, code, password) => {
    set({ busy: true, error: null })
    try {
      await auth.resetPassword(mobile.trim(), code.trim(), password)
      set({ busy: false })
      return true
    } catch (e) {
      set({ busy: false, error: message(e) })
      return false
    }
  },

  signOut: async () => {
    // 先调服务端（把 jti 拉黑），失败也照常清本地 ——
    // 否则「断网时退不出去」，人会以为账号被锁死了
    try {
      await auth.logout()
    } catch {
      /* 忽略 */
    }
    setSession(null)
    set({ session: null, error: null })
  },

  refresh: async () => {
    if (!get().session) return
    try {
      const user = await auth.profile()
      const cur = get().session
      if (!cur) return
      const next: Session = { ...cur, user }
      setSession(next)
      set({ session: next })
    } catch {
      /* 刷新资料失败不影响使用，token 真失效时 `client` 会走 401 那条 */
    }
  },

  clear: () => {
    setSession(null)
    set({ session: null, error: '登录已过期，请重新登录' })
  },
}))

/**
 * 401 的时候把本地登录态清掉。
 *
 * 注册在模块加载时（一次），不放在组件里 —— 放在组件里的话，
 * 那个组件没挂载时 401 就没人处理，人会一直点、一直失败。
 */
bindAuthLost(() => useAccount.getState().clear())
