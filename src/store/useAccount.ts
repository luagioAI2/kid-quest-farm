import { create } from 'zustand'
import { ApiError, bindAuthLost, bindGuestBlocked } from '../api/client'
import * as auth from '../api/auth'
import { getSession, sessionFrom, setSession, type Session } from '../api/session'
import { getDeviceId } from '../api/device'
import { lastWasRealAccount, rememberAccount } from '../api/lastAccount'
import { isOnlineMode } from '../sync/pull'
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

   ## 2026-11-03：从「先登录」改成「先进来，再保存」

   用户反馈新用户没耐心，一进门就要手机号 + 验证码，多半直接关掉。
   现在启动时**自动建一个游客账号**（`ensureGuest`），孩子不用注册就能玩；
   等他要花兑换券 / 兑东西了，再让他绑手机号（`bindMobile`）——
   绑的是**同一个 uid**，进度原地不动。

   这里有一条**不能省**的判断：上一次用的是**正式账号**时不许自动建游客。
   会话过期（refresh 只活 7 天）之后，悄悄把人换成一个空账号，
   等于「打开 App 发现东西全没了」。那种情况要请他用手机号登回来，
   判断依据在 `api/lastAccount.ts`。
   ============================================================ */

/** 为什么弹「保存进度」 */
export type BindReason =
  /** 花兑换券被服务端拦住（硬门槛，关不掉） */
  | 'coupon'
  /** 第 3 次启动时的温和提醒（一辈子只弹一次） */
  | 'launch'
  /** 自己点「保存进度」 */
  | 'manual'

interface AccountState {
  session: Session | null
  /** 正在请求（按钮转圈 + 防连点） */
  busy: boolean
  /** 上一次失败的原因；成功后清空 */
  error: string | null

  /**
   * 启动时「自动拿到账号」的结果。
   *
   * - `pending`     还没试
   * - `ready`       有会话（老会话，或刚建的游客）
   * - `needs-login` 上一次是正式账号，必须用手机号登回来（**不能**塞个游客）
   * - `failed`      连不上服务器（界面靠 `SyncBanner` 说话）
   */
  bootAccount: 'pending' | 'ready' | 'needs-login' | 'failed'

  /** 「保存进度」弹层 */
  bindSheet: { open: boolean; reason: BindReason | null }
  openBind: (reason: BindReason) => void
  closeBind: () => void

  /**
   * 启动时自动拿到一个账号（在线版）。幂等，并发调用会折叠成一次。
   *
   * @param opts.force 跳过「上一次是正式账号就别建游客」那道判断。
   *                   只有用户**显式**点「先随便玩玩」时才该传 ——
   *                   那是他自己的选择，不是我们替他做的决定。
   * @returns 是否拿到了会话
   */
  ensureGuest: (opts?: { force?: boolean }) => Promise<boolean>

  login: (mobile: string, password: string) => Promise<boolean>
  register: (mobile: string, password: string, code: string, nickname?: string) => Promise<boolean>
  /** 绑定手机号：游客转正。绑的是同一个 uid，进度不动。 */
  bindMobile: (mobile: string, code: string, password?: string) => Promise<boolean>
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

/**
 * `ensureGuest` 的并发锁。
 *
 * 为什么必须有：React 18 的 StrictMode 会把启动 effect 跑两遍，而两次
 * 请求都会到服务端 —— 服务端有唯一索引兜着不会建出两个号，但第二个请求
 * 会撞唯一索引、走「读回来」那条分支，白白多一次往返；更麻烦的是两次
 * `setSession` 可能交错，把后拿到的令牌覆盖成先拿到的。
 */
let ensuring: Promise<boolean> | null = null

export const useAccount = create<AccountState>((set, get) => ({
  session: getSession(),
  busy: false,
  error: null,
  bootAccount: 'pending',
  bindSheet: { open: false, reason: null },

  openBind: (reason) => set({ bindSheet: { open: true, reason } }),
  closeBind: () => set({ bindSheet: { open: false, reason: null } }),

  ensureGuest: (opts) => {
    if (ensuring) return ensuring

    ensuring = (async () => {
      /* 已经有会话（上次存下来的 token 还在）⇒ 什么都不用做。
         `client` 会在过期时自己换票。 */
      if (get().session) {
        set({ bootAccount: 'ready' })
        return true
      }

      /* 本地版没有账号这个概念 */
      if (!isOnlineMode) {
        set({ bootAccount: 'ready' })
        return true
      }

      /* ★ 上一次是正式账号 ⇒ 不建游客。
         建了等于把他悄悄换成一个空账号：任务、积分、券都还在原来那个
         账号里，而屏幕上是一片空白。请他用手机号登回来。
         `force` 是用户在登录面板上**显式**点了「先随便玩玩」，跳过这道判断。 */
      if (!opts?.force && lastWasRealAccount()) {
        set({ bootAccount: 'needs-login' })
        return false
      }

      set({ busy: true, error: null })
      try {
        const data = await auth.guest(getDeviceId())
        const s = sessionFrom(data)
        setSession(s)
        rememberAccount(s.user)
        set({ session: s, busy: false, bootAccount: 'ready', error: null })
        return true
      } catch (e) {
        set({ busy: false, bootAccount: 'failed', error: message(e) })
        return false
      }
    })().finally(() => {
      ensuring = null
    })

    return ensuring
  },

  login: async (mobile, password) => {
    set({ busy: true, error: null })
    try {
      const data = await auth.login(mobile.trim(), password)
      const s = sessionFrom(data)
      setSession(s)
      rememberAccount(s.user)
      set({ session: s, busy: false, bootAccount: 'ready' })
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
      rememberAccount(s.user)
      set({ session: s, busy: false, bootAccount: 'ready' })
      return true
    } catch (e) {
      set({ busy: false, error: message(e) })
      return false
    }
  },

  bindMobile: async (mobile, code, password) => {
    set({ busy: true, error: null })
    try {
      const user = await auth.bindMobile(mobile.trim(), code.trim(), password)
      const cur = get().session
      /* 没会话就绑不了 —— 服务端要求 JWT。正常不会走到这里，
         但真走到了要说清楚，不能静默返回 true 让弹层关掉。 */
      if (!cur) {
        set({ busy: false, error: '登录状态丢了，请重开一次 App' })
        return false
      }
      const next: Session = { ...cur, user }
      setSession(next)
      rememberAccount(user)
      set({
        session: next,
        busy: false,
        bindSheet: { open: false, reason: null },
      })
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
    /* ★ 退出登录**不清**设备号，也**不清** `lastAccount`。
       两者一起决定了「下次启动是自动进游客，还是请他登录」：
         · 上次是游客 ⇒ 自动建回来（同一个人，同一台机器）；
         · 上次是正式账号 ⇒ 请他登录（退出的意图就是换个人）。
       真要「不登录先玩」，登录面板上有显式入口。 */
    set({ session: null, error: null, bootAccount: 'needs-login' })
  },

  refresh: async () => {
    if (!get().session) return
    try {
      const user = await auth.profile()
      const cur = get().session
      if (!cur) return
      const next: Session = { ...cur, user }
      setSession(next)
      rememberAccount(user)
      set({ session: next })
    } catch {
      /* 刷新资料失败不影响使用，token 真失效时 `client` 会走 401 那条 */
    }
  },

  clear: () => {
    /* 本来就没登录 ⇒ 这不是「过期」，别去兜底。
       否则 `ensureGuest` 里那次请求万一也 401，就会 clear → ensure → clear
       自激下去，界面上表现为一直在转圈。 */
    const had = get().session !== null
    setSession(null)
    set({ session: null, error: '登录已过期，请重新登录' })
    if (!had) return
    /* 兜底：游客就按设备号把原来那个账号要回来；正式账号则转成
       `needs-login`，由界面请他重新登录。 */
    void get().ensureGuest()
  },
}))

/**
 * 401 的时候把本地登录态清掉。
 *
 * 注册在模块加载时（一次），不放在组件里 —— 放在组件里的话，
 * 那个组件没挂载时 401 就没人处理，人会一直点、一直失败。
 */
bindAuthLost(() => useAccount.getState().clear())

/**
 * 游客被服务端拦住（要花兑换券 / 兑实物）⇒ 弹「保存进度」。
 *
 * 挂在这里而不是每个调用点：花券的地方有五处，以后还会加，
 * 漏一处就是「点了兑换，转一圈，什么都没发生」。
 */
bindGuestBlocked(() => useAccount.getState().openBind('coupon'))
