import { ApiError } from '../api/client'
import { getSession, getToken } from '../api/session'
import { applyTemplate, bindInvite, type TemplateApplyResult } from '../api/template'
import { isOnlineMode } from '../sync/pull'
import { clearInviteCode, peekInviteCode, stashInviteFromUrl } from './inviteCode'

/* ============================================================
   首次落地模板（在线版）
   ------------------------------------------------------------
   启动顺序里这一步必须**紧挨着** `boot()`，而且要在它**前面**：

     ensureGuest()  →  ensureTemplateApplied()  →  boot()

   因为 `boot()` 里的第一次 `refresh()` 负责把服务端数据拉进 Dexie。
   先铺后拉，孩子第一屏就能看到那 16 条任务；先拉后铺，这一屏是空的，
   要等下一次启动才补上 —— 而新用户不会给第二次机会。

   ## 为什么「绑邀请码」和「铺模板」绑在一起

   顺序敏感：铺模板时服务端看的是「这个账号属于哪个商家」。
   先铺后绑的话，铺出来的是**官方**模板，而 apply 一辈子只铺一次 ——
   商家归属后来绑上了，模板却永远修不回来。

   所以这里把两件事串成一条链，并且**网络失败时宁可整条不铺**
   （见 `run` 里那段注释），下一次启动重来。
   ============================================================ */

/** 并发折叠：StrictMode 会把启动 effect 跑两遍、`boot()` 也可能重入 */
let running: Promise<TemplateApplyResult | null> | null = null

/**
 * 保证这个账号的初始内容已经铺过。幂等，可以每次启动都调。
 *
 * @returns 铺的结果；本地版 / 没登录 / 失败时返回 null（调用方不必分支）
 */
export function ensureTemplateApplied(): Promise<TemplateApplyResult | null> {
  if (!isOnlineMode) return Promise.resolve(null)
  if (!getToken()) return Promise.resolve(null)
  if (running) return running
  running = run().finally(() => {
    running = null
  })
  return running
}

async function run(): Promise<TemplateApplyResult | null> {
  /* 商家链接里的码（`?invite=TF…`）先收下 —— 它可能比账号还早到 */
  stashInviteFromUrl()

  const code = peekInviteCode()
  if (code) {
    try {
      await bindInvite(code)
      /* ★ 游客**不清**这个码。
         游客账号和后来的手机号账号是**两个 uid**（注册是新建号，不是升级）。
         现在清掉的话，推广用户「先玩两把 → 再注册」那一步会掉到官方模板，
         而新 uid 的模板已经铺过了，改不回来。
         留着让新账号再绑一次；绑到正式账号上才清。 */
      if (!getSession()?.user.is_guest) clearInviteCode()
    } catch (e) {
      /* ★ 网络失败 ⇒ **先别铺**。
         这时候铺出来的一定是官方模板（归属还没写上去），而 apply 只铺一次，
         商家归属后来绑上了也修不回来。留着重试比「先给一套错的」好得多。 */
      if (e instanceof ApiError && e.isNetwork) return null
      /* 码本身不成立（校验位错 / 那个商家没审核 / 已经归属别人）：
         清掉，按官方模板继续 —— 不能让一个坏码把新用户卡在空界面上。 */
      clearInviteCode()
    }
  }

  try {
    return await applyTemplate()
  } catch {
    /* 铺失败不该挡住启动：孩子先看到一个空任务板（和以前一样），
       下次启动会再试一次。这里不 toast —— 新用户看到的第一句话
       不该是「模板下发失败」。 */
    return null
  }
}
