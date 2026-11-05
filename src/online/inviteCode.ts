/* ============================================================
   待绑定的商家邀请码（暂存）
   ------------------------------------------------------------
   邀请码有三个来源，落点却只有一个 ——「这个账号第一次启动时绑上」：

     1. 商家发出去的链接：`https://…/?invite=TF73-DC44`
     2. 注册面板上手动填的（见 `LoginSheet`）
     3. 家长从微信里复制、粘到「设置 → 账号」里的

   ## 为什么要暂存，而不是当场绑

   来源 1 是**先打开 App、后建账号**：URL 里的码在 `ensureGuest` 之前就拿到了，
   但那一刻还没有 token，绑不了。来源 2 更绕：注册那一刻才拿到新 uid，
   而绑邀请码和铺模板必须是**同一个顺序**（先绑后铺），中间不能插一次
   可能失败的请求。

   所以统一成：谁拿到码谁 `stash`，真正绑的时候由 `online/template.ts`
   一次性取走（`take`）。暂存落 localStorage —— 链接里的码要活过
   「下载 App → 打开」这一段，内存变量活不过。

   ## ★ 取走（take）的时机

   只在**服务端确认这个码有效**之后才清。否则「第一次打开时没网」会把
   商家归属永久丢掉 —— 而它决定这个账号一辈子看哪套模板。
   ============================================================ */

const KEY = 'kqf.invite.pending.v1'

/**
 * 邀请码的形状：`TF<uid 的 36 进制>-<4 位校验>`。
 *
 * 这里只做**粗筛**（别把用户随手粘的一段话当码发上去），
 * 真正的校验位判定在服务端 —— 两边各判一遍是有意的：
 * 客户端拦「明显不是码」，服务端拦「码是伪造的 / 商家没审核」。
 */
const SHAPE = /^TF[0-9A-Z]+-[0-9A-F]{4}$/

/** 规范化：去空格、转大写（用户从微信复制常带空格，手打常是小写） */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase()
}

/** 形状对不对（不判真伪） */
export function looksLikeInviteCode(raw: string): boolean {
  return SHAPE.test(normalizeInviteCode(raw))
}

/** 存一个待绑定的码。形状不对的直接忽略（别让它一路带到服务端再被拒）。 */
export function stashInviteCode(raw: string): boolean {
  const code = normalizeInviteCode(raw)
  if (!SHAPE.test(code)) return false
  try {
    localStorage.setItem(KEY, code)
  } catch {
    /* 隐私模式 / 配额满：这一趟就绑不上了，但不该让 App 起不来 */
  }
  return true
}

/** 看看有没有待绑的码（不清） */
export function peekInviteCode(): string | null {
  try {
    const v = localStorage.getItem(KEY)
    if (!v) return null
    return SHAPE.test(v) ? v : null
  } catch {
    return null
  }
}

/** 清掉（绑定成功 / 服务端明确拒绝之后调） */
export function clearInviteCode(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 忽略 */
  }
}

/**
 * 从当前地址里读邀请码并暂存。
 *
 * 支持 `?invite=TF…`、`#invite=TF…`，以及 `?code=`（商家物料上常这么印）。
 * ★ 读出来**不删 URL**：那是商家链接的一部分，用户刷新一下还在；
 *   而「待绑定」的清除由 `clearInviteCode` 负责 —— 两件事不要混在一起。
 */
export function stashInviteFromUrl(search = window.location.search, hash = window.location.hash): boolean {
  for (const raw of [search, hash]) {
    if (!raw) continue
    const q = raw.startsWith('#') ? raw.slice(1) : raw
    const params = new URLSearchParams(q)
    for (const name of ['invite', 'invite_code', 'code']) {
      const v = params.get(name)
      if (v && stashInviteCode(v)) return true
    }
  }
  return false
}
