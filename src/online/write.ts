import { ApiError, GUEST_NEED_BIND, NETWORK } from '../api/client'

/* ============================================================
   在线版 · 写穿的统一出口
   ------------------------------------------------------------
   在线版的铁律：**服务端成功了才算成功**。

   所以这里只做一件事 —— 把「调接口」包成「不抛、给结论」：

     const r = await onlineWrite(() => createTask(body))
     if (!r.ok) { toast(writeFailToast(r.error, '这条任务')); return }

   ★ 失败时**绝不落本地**。这是写穿和「先存本地再补传」最根本的区别：
     先存本地的话，孩子看到「交上去啦」，家长那边永远收不到，
     而两边都没有任何报错 —— 这类问题只有用户来问才发现。
   ============================================================ */

export type WriteOutcome<T> = { ok: true; data: T } | { ok: false; error: ApiError }

/** 调一次写接口，把异常收成结论 */
export async function onlineWrite<T>(run: () => Promise<T>): Promise<WriteOutcome<T>> {
  try {
    return { ok: true, data: await run() }
  } catch (e) {
    return { ok: false, error: asApiError(e) }
  }
}

function asApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e
  const msg = (e as { message?: string })?.message
  return new ApiError(NETWORK, msg || '操作没成功')
}

/** 提示条的形状（和 `store/useApp.ts` 的 `Toast` 兼容，但不 import 它，避免环依赖） */
export interface FailToast {
  kind: 'warn'
  title: string
  detail?: string
  emoji: string
}

/**
 * 把失败翻成一句家长看得懂的话。
 *
 * @param what 出问题的是哪件事（「这条任务」「这次兑换」），拼进标题里 ——
 *             只说「操作失败」的话，家长不知道刚才那一下到底算不算数。
 */
export function writeFailToast(e: ApiError, what: string): FailToast {
  if (e.isNetwork) {
    return {
      kind: 'warn',
      title: `${what}没发出去`,
      detail: '连不上服务器。刚才那一步**没有生效**，网络好了再试一次。',
      emoji: '📡',
    }
  }
  if (e.isAuth) {
    return {
      kind: 'warn',
      title: '登录过期了，请重新登录',
      detail: `${what}没有生效。`,
      emoji: '🔒',
    }
  }
  /* 游客被门槛拦住。这里**不要**写「失败」—— 服务端拒得有道理，
     而且弹层已经在 `client` 里弹出来了，这句话只是补一句原因。 */
  if (e.code === GUEST_NEED_BIND) {
    return {
      kind: 'warn',
      title: '先绑定手机号再兑换',
      detail: `${what}没有生效。绑定之后，这台手机上的进度也会存到账号里。`,
      emoji: '🔖',
    }
  }
  return { kind: 'warn', title: `${what}没成功`, detail: e.message, emoji: '⚠️' }
}
