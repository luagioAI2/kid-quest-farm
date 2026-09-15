import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ============================================================
   toast → 音效 / 震动
   ------------------------------------------------------------
   反馈统一挂在 store 的 `pushToast` 上（那是「发生了一件值得告诉孩子的事」
   的唯一收口），所以这一层测的就是**映射**：
   哪种 toast 该响哪个音、哪种该闭嘴、两个开关有没有被传下去。

   「关掉之后真的没声音」不在这里测 —— 那是 `playTone` / `hapticLight`
   自己的事，`src/platform/sound.test.ts` 已经锁住了。
   这一层只断言**开关的值被如实传了下去**，两层合起来才是完整链路。
   ============================================================ */

// `vi.mock` 会被提升到 import 之前，所以替身必须用 `vi.hoisted` 建，
// 否则工厂里会读到「还没初始化」的变量。
const spies = vi.hoisted(() => ({
  playTone: vi.fn(),
  hapticLight: vi.fn(),
}))

vi.mock('../platform/files', () => ({
  playTone: spies.playTone,
  hapticLight: spies.hapticLight,
  isNative: () => false,
}))

const { useApp } = await import('./useApp')

const push = (kind: 'success' | 'info' | 'warn' | 'reward') =>
  useApp.getState().pushToast({ kind, title: 't' })

beforeEach(async () => {
  spies.playTone.mockClear()
  spies.hapticLight.mockClear()
  // 每个用例都从「两个开关都开」这个默认态出发
  await useApp.getState().updateSettings({ soundEnabled: true, hapticsEnabled: true })
})

describe('pushToast 的反馈映射', () => {
  it('success → 响 success 音', () => {
    push('success')
    expect(spies.playTone).toHaveBeenCalledWith(true, 'success')
  })

  it('reward（+N 分）→ 响 coin 音，和 success 分开', () => {
    push('reward')
    expect(spies.playTone).toHaveBeenCalledWith(true, 'coin')
  })

  it('warn → 响 fail 音', () => {
    push('warn')
    expect(spies.playTone).toHaveBeenCalledWith(true, 'fail')
  })

  it('info 是纯告知 → 不出声、也不震', () => {
    push('info')
    expect(spies.playTone).not.toHaveBeenCalled()
    expect(spies.hapticLight).not.toHaveBeenCalled()
  })

  it('该震的时候会震（非 info）', () => {
    push('reward')
    expect(spies.hapticLight).toHaveBeenCalledWith(true)
  })

  it('关掉音效 → 把 false 传下去（由 playTone 自己吞掉）', async () => {
    await useApp.getState().updateSettings({ soundEnabled: false })
    push('success')
    expect(spies.playTone).toHaveBeenCalledWith(false, 'success')
  })

  it('关掉震动 → 把 false 传下去', async () => {
    await useApp.getState().updateSettings({ hapticsEnabled: false })
    push('success')
    expect(spies.hapticLight).toHaveBeenCalledWith(false)
  })

  it('两个开关互不影响：关音效不静音震动', async () => {
    await useApp.getState().updateSettings({ soundEnabled: false })
    push('reward')
    expect(spies.playTone).toHaveBeenCalledWith(false, 'coin')
    expect(spies.hapticLight).toHaveBeenCalledWith(true)
  })
})
