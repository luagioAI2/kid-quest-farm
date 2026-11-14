import { Capacitor } from '@capacitor/core'
import { AppLauncher } from '@capacitor/app-launcher'

/* ============================================================
   打开外部链接（淘宝 / 天猫 / 京东 / 后台地址 …）
   ------------------------------------------------------------
   浏览器里这件事就是 `window.open`。**APK 里不是。**

   Capacitor 的 WebView 没有地址栏，也没有「新标签页」。
   在里面 `window.open` 一个淘宝链接，结果取决于 WebView 的
   拦截策略 —— 实测最常见的是**什么都不发生**（家长点了按钮没反应，
   也没有任何报错，只能以为按钮坏了）。

   ## 所以走 AppLauncher

   `AppLauncher.openUrl()` 在 Android 上是 `Intent.ACTION_VIEW`，
   在 iOS 上是 `UIApplication.open`。这是**系统级**的「打开这个地址」：

     · 手机装了淘宝、且它认领了 `s.taobao.com` ⇒ 直接进淘宝 App；
     · 没装 / 没认领 ⇒ 系统浏览器。

   这正是家长想要的行为，而且不用为每家店各写一套判断。
   卡片上印的是 `taobao://…` 这种自定义 scheme 时也一样能用
   （`openUrl` 对 scheme 和 https 一视同仁）。

   ## 只放行「能交给系统」的协议

   `javascript:` / `data:` / `file:` 这类必须挡住 —— 它们不是「外部链接」，
   在 WebView 里执行等于让一段来路不明的字符串在本 App 的上下文里跑。
   链接来自服务端（`wish_item.buy_url`、`merchant_application.admin_url`），
   服务端那边已经有格式校验；这里是**第二道**，因为「服务端校验过」
   不该成为客户端不校验的理由。
   ============================================================ */

/** 明确不允许交出去的协议（小写比较） */
const BLOCKED_SCHEME = /^(javascript|data|file|blob|about|vbscript):/i

/** 任意协议头：`https:` / `taobao:` / `openapp.jdmobile:` … */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** 这个地址能不能交给系统打开 */
export function isOpenableUrl(url: string | null | undefined): boolean {
  if (!url) return false
  const s = url.trim()
  if (!s) return false
  if (BLOCKED_SCHEME.test(s)) return false
  // 没有协议头的一律不认：`merchant.example.com/x` 在系统眼里不是链接，
  // 交出去只会静默失败（服务端那个「要以 http:// 开头」的校验就是为了这个）。
  return HAS_SCHEME.test(s)
}

/**
 * 打开一个外部链接。返回「是否成功交出去了」。
 *
 * ⚠️ 返回值**不代表「对方页面真的打开了」** —— 系统只告诉我们
 * intent 有没有被接收。别拿它当「用户已经买好了」的判据。
 */
export async function openExternal(url: string): Promise<boolean> {
  if (!isOpenableUrl(url)) return false
  const target = url.trim()

  if (Capacitor.isNativePlatform()) {
    try {
      const res = await AppLauncher.openUrl({ url: target })
      // ⚠️ 必须看 `completed`，不能只看「没抛异常」。
      //
      // Android 侧的 `AppLauncherPlugin.openUrl` **永远 resolve**：
      // 没有任何应用认领这个地址时，它不报错，而是 `put("completed", false)`
      // 再 resolve（见插件里 canLaunchIntent 那段）。只判「没抛」就会把
      // 「没装淘宝 / `taobao://` 没人认领」当成打开成功 —— 界面说「已打开」，
      // 屏幕一动不动，而且下面那条 `window.open` 兜底**永远不会被执行**
      // （它是靠 catch 触发的）。
      //
      // 这和导出备份那条是同一类问题：**返回值说成功，实际什么都没发生**。
      if (res?.completed !== false) return true
      // 系统明确说「没有任何应用认领」时**不再往 `window.open` 里丢**：
      // Capacitor 的 WebView 里它要么什么都不做（家长以为按钮坏了），
      // 要么把页面整块换掉（App 界面没了）。直接返回 false，
      // 让调用方弹那条已经写好的「这个链接打不开 / 复制商品名去淘宝搜」。
      return false
    } catch {
      // 真抛了（插件没注册、参数非法）才往下走，再试一次 `window.open`
    }
  }

  try {
    // `noopener,noreferrer`：不给对方 `window.opener`。
    // 注意这两个参数会让 `window.open` **返回 null**，所以不能拿返回值判成败。
    window.open(target, '_blank', 'noopener,noreferrer')
    return true
  } catch {
    return false
  }
}
