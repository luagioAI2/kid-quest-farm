import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ============================================================
   外链（`openExternal` / `isOpenableUrl`）
   ------------------------------------------------------------
   这里原来**一条测试都没有**，而它藏着一个和导出备份同类的静默失败：

   Android 的 `AppLauncherPlugin.openUrl` **永远 resolve** —— 没有任何应用
   认领这个地址时，它不报错，而是 `put("completed", false)` 再 resolve。
   原实现 `await openUrl(...); return true` 只判「没抛异常」，于是
   「没装淘宝 / `taobao://` 没人认领」也被当成打开成功。

   后果不是「按钮坏了」那么明显 —— 是**界面说已打开、屏幕一动不动**，
   而且 `WishPage` 里那条「这个链接打不开，复制商品名去淘宝搜」
   的提示**永远不会出现**（它就是靠 `ok === false` 触发的）。
   ============================================================ */

/** 原生环境开关 */
let native = true
/** `openUrl` 的返回 / 抛错 */
let launcherResult: { completed: boolean } | 'throw' = { completed: true }
/** `window.open` 被调了几次、最后一次的地址 */
let opened: string[] = []
/** `window.open` 是否抛错 */
let openThrows = false

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native },
}))

vi.mock('@capacitor/app-launcher', () => ({
  AppLauncher: {
    openUrl: async ({ url }: { url: string }) => {
      if (launcherResult === 'throw') throw new Error('not implemented')
      opened.push(`launcher:${url}`)
      return launcherResult
    },
  },
}))

import { isOpenableUrl, openExternal } from './openUrl'

beforeEach(() => {
  native = true
  launcherResult = { completed: true }
  opened = []
  openThrows = false
  vi.spyOn(window, 'open').mockImplementation((url) => {
    if (openThrows) throw new Error('blocked')
    opened.push(String(url))
    return null
  })
})

describe('isOpenableUrl：只放行能交给系统的协议', () => {
  it('挡掉能在本 App 上下文里执行的协议', () => {
    for (const bad of [
      'javascript:alert(1)',
      'JavaScript:alert(1)',
      'data:text/html,<script>1</script>',
      'file:///data/data/x',
      'blob:https://a/b',
      'about:blank',
    ]) {
      expect(isOpenableUrl(bad), bad).toBe(false)
    }
  })

  it('挡掉没有协议头的（服务端校验漏了也不放行）', () => {
    expect(isOpenableUrl('merchant.example.com/x')).toBe(false)
    expect(isOpenableUrl('s.taobao.com')).toBe(false)
  })

  it('放行 https 与自定义 scheme', () => {
    expect(isOpenableUrl('https://s.taobao.com/x')).toBe(true)
    expect(isOpenableUrl('taobao://item?id=1')).toBe(true)
    expect(isOpenableUrl('openapp.jdmobile://virtual')).toBe(true)
  })

  it('空值 / 纯空格不放行', () => {
    for (const v of ['', '   ', null, undefined]) expect(isOpenableUrl(v)).toBe(false)
  })
})

describe('openExternal：原生走 AppLauncher', () => {
  it('completed:true 才算交出去', async () => {
    expect(await openExternal('https://s.taobao.com/x')).toBe(true)
    expect(opened).toEqual(['launcher:https://s.taobao.com/x'])
  })

  it('completed:false 必须返回 false（这条就是回归判据）', async () => {
    launcherResult = { completed: false }

    expect(await openExternal('taobao://item?id=1')).toBe(false)
    // 也不能再往 window.open 里丢 —— WebView 里它要么没反应、要么把界面换掉
    expect(opened).toEqual(['launcher:taobao://item?id=1'])
  })

  it('插件真抛错时，退回 window.open 再试一次', async () => {
    launcherResult = 'throw'

    expect(await openExternal('https://s.taobao.com/x')).toBe(true)
    expect(opened).toEqual(['https://s.taobao.com/x'])
  })

  it('非法协议根本不进插件', async () => {
    expect(await openExternal('javascript:alert(1)')).toBe(false)
    expect(opened).toEqual([])
  })
})

describe('openExternal：浏览器走 window.open', () => {
  it('不碰 AppLauncher', async () => {
    native = false

    expect(await openExternal('https://s.taobao.com/x')).toBe(true)
    expect(opened).toEqual(['https://s.taobao.com/x'])
  })

  it('window.open 抛错时返回 false', async () => {
    native = false
    openThrows = true

    expect(await openExternal('https://s.taobao.com/x')).toBe(false)
  })
})
