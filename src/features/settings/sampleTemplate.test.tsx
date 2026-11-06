/**
 * 「下载一个空模板看看」这条按钮
 * ------------------------------------------------------------
 * 2026-10-30。这个按钮原来直接调 `saveBlob`（浏览器下载那条腿），
 * 而同一个页面里的「导出到文件」早就换成了 `shareOrDownload`。
 *
 * 差别在 APK 里：WebView 里 `<a download>` + `blob:` 不落盘
 * （没有 DownloadListener），而且这里连 toast 都没有（`void saveBlob(...)`）
 * ⇒ 家长点了**什么都没发生，也没有任何提示**。
 *
 * 所以判据不是「函数被调用了」，而是：
 *   ① 走的是 `shareOrDownload`（不是 `saveBlob`）
 *   ② 内容确实是一份合法空模板（表名从 store 派生，不在这里手写）
 *   ③ 导出失败时**要说话**，不能静默
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'

/** `shareOrDownload` 收到的调用 */
let shared: { name: string; content: string }[] = []
/** 下一次调用返回什么 */
let shareOk = true
/** `saveBlob` 有没有被直接调用（= 走了浏览器那条腿） */
let blobCalled = false

/* ⚠️ 必须 `importOriginal` 保留其余导出。
   这个模块里还有 `playTone`（toast 会用它发音效），整个替换掉会让
   `pushToast` 在 `playTone` 上抛 TypeError —— 而且报错堆栈落在 store 里，
   看着完全不像「测试文件的 mock 写窄了」。 */
vi.mock('../../platform/files', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../platform/files')>()
  return {
    ...actual,
    saveBlob: async () => {
      blobCalled = true
      return true
    },
    shareOrDownload: async (name: string, content: string) => {
      shared.push({ name, content })
      return shareOk
    },
  }
})

import SettingsPage from './SettingsPage'

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
  await useApp.getState().updateSettings({ parentPin: '0000' })
}

async function openDataTab() {
  const user = userEvent.setup()
  render(<SettingsPage onBack={() => {}} />)
  await user.click(screen.getByRole('button', { name: /数据/ }))
  // 2026-11-06：闸门改成「锁卡 + 弹框」，先点开弹框再输密码
  await user.click(await screen.findByRole('button', { name: /爸妈：输密码/ }))
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole('button', { name: '0' }))
  }
  // 闸门过去的标志：导出按钮出现了
  await screen.findByRole('button', { name: /导出到文件/ })
}

async function waitToast(pred: (t: { title: string }) => boolean, ms = 4000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const hit = useApp.getState().toasts.find(pred)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 50))
  }
  return null
}

beforeEach(async () => {
  shared = []
  shareOk = true
  blobCalled = false
  useApp.setState({ toasts: [] })
  await bootStore()
})

afterEach(cleanup)

describe('空模板按钮', () => {
  it('走 shareOrDownload（不是浏览器下载那条腿）', async () => {
    await openDataTab()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /空模板/ }))

    expect(blobCalled, '又调回 saveBlob 了 —— APK 里点了会毫无反应').toBe(false)
    expect(shared).toHaveLength(1)
    expect(shared[0].name).toContain('示例')
  })

  it('内容是一份能过校验的合法模板：版本号 + 所有表都在', async () => {
    await openDataTab()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /空模板/ }))

    const parsed = JSON.parse(shared[0].content) as {
      app: string
      version: number
      data: Record<string, unknown>
    }
    expect(parsed.app).toBe('kid-quest-farm')
    expect(parsed.version).toBeGreaterThan(0)
    // 表名从 store 的 BACKUP_ARRAY_FIELDS 派生 —— 这里只钉「不是空的」
    const tables = Object.keys(parsed.data)
    expect(tables.length).toBeGreaterThan(10)
    // 空模板里不能有真实数据（否则「给家长看格式」变成另一种泄露）
    for (const k of tables) expect(parsed.data[k], k).toBeTruthy()
  })

  it('★ 导出失败时要说话，不能静默', async () => {
    shareOk = false
    await openDataTab()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /空模板/ }))

    const toast = await waitToast((t) => t.title === '模板没能导出')
    expect(toast, '导出失败了却一声不吭').toBeTruthy()
  })
})
