import { beforeEach, describe, expect, it, vi } from 'vitest'

/* ============================================================
   音效层（`playTone`）
   ------------------------------------------------------------
   这一层此前**零测试**，而且藏着一个静默丢音的坑：
   被自动播放策略拦住、等手势补播时，只存了「最后一个」音色 ——
   后一声会**覆盖**前一声，被覆盖的那声不报错、就这么没了；
   更糟的是 `gestureHooked` 一旦是 true，新来的音再没有补播机会。

   jsdom 里没有 `AudioContext`，所以下面手写一个假的：
   只实现 `renderTone` 真正用到的那几个方法，并把每次 `osc.start()`
   记下来 —— 频率就是音色的指纹。
   ============================================================ */

/** 每次振荡器 `start()` 时的频率（= 哪个音色） */
let started: number[] = []
/** `resume()` 被调了几次 */
let resumeCalls = 0
/** 手势到达后上下文是否真的能起来（用来模拟 resume 失败） */
let resumeWorks = true
/** 用户手势是否已经发生过 */
let gestureSeen = false
/** 新上下文初始状态 */
let initialCtxState: 'suspended' | 'running' = 'suspended'

class FakeParam {
  value = 0
  setValueAtTime(v: number) {
    this.value = v
  }
  exponentialRampToValueAtTime(v: number) {
    this.value = v
  }
}

class FakeGain {
  gain = new FakeParam()
  connect() {}
}

class FakeOscillator {
  type = ''
  frequency = new FakeParam()
  connect() {}
  start() {
    started.push(this.frequency.value)
  }
  stop() {}
}

class FakeAudioContext {
  state: 'suspended' | 'running'
  currentTime = 0
  destination = {}
  constructor() {
    this.state = initialCtxState
  }
  createOscillator() {
    return new FakeOscillator()
  }
  createGain() {
    return new FakeGain()
  }
  resume() {
    resumeCalls++
    return Promise.resolve().then(() => {
      // ⚠️ 这里是整个假实现的关键：**没有用户手势时，`resume()` 会「成功返回」
      // 但上下文仍然是 `suspended`** —— 这正是自动播放策略的坑。
      // 假实现要是不模拟这一条，它就无法区分「攒着没放」和「已经放了」，
      // 用例也就测不出任何东西。
      if (resumeWorks && gestureSeen) this.state = 'running'
    })
  }
}

/** 音色指纹：各音色里最容易区分的一声 */
const ENTRY_LAST = 2637.02 // entry 末音 E7
const SUCCESS_FIRST = 523.25 // success 首音 C5
const COIN_LAST = 1174.66 // coin 末音 D6

/**
 * 取一份**全新的** `files` 模块。
 * 它把 `audioCtx` / 补播队列 / `gestureHooked` 都存在模块级变量里，
 * 不重置模块的话用例之间会互相污染。
 */
async function freshModule() {
  vi.resetModules()
  return (await import('./files')) as typeof import('./files')
}

const tick = () => new Promise((r) => setTimeout(r, 0))

/**
 * 模拟一次用户手势。
 * 真实浏览器里 `resume()` 只有在这之后才可能真的把上下文叫醒，
 * 所以假实现靠这个开关来还原平台行为。
 */
function gesture(type: 'pointerdown' | 'keydown' = 'pointerdown') {
  gestureSeen = true
  document.dispatchEvent(new Event(type))
}

beforeEach(() => {
  started = []
  resumeCalls = 0
  resumeWorks = true
  gestureSeen = false
  initialCtxState = 'suspended'
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
})

describe('playTone', () => {
  it('关掉音效就一声都不响，连上下文都不去碰', async () => {
    const { playTone } = await freshModule()
    playTone(false, 'entry')
    await tick()
    expect(started).toHaveLength(0)
    expect(resumeCalls).toBe(0)
  })

  it('上下文已经在跑 → 立刻响，不用等手势', async () => {
    initialCtxState = 'running'
    const { playTone } = await freshModule()
    playTone(true, 'success')
    await tick()
    expect(started[0]).toBeCloseTo(SUCCESS_FIRST)
    expect(resumeCalls).toBe(0)
  })

  it('被自动播放策略拦住时，第一次手势把它补上', async () => {
    const { playTone } = await freshModule()
    playTone(true, 'entry')
    await tick()
    expect(started).toHaveLength(0) // 还没手势 → 哑的

    gesture()
    await tick()
    await tick()
    expect(started).toContain(ENTRY_LAST)
  })

  it('⚠️ 拦住期间响两声，手势到达后两声都要出来（不能只留最后一声）', async () => {
    const { playTone } = await freshModule()
    playTone(true, 'entry')
    playTone(true, 'success')
    await tick()
    expect(started).toHaveLength(0)

    gesture()
    await tick()
    await tick()
    // 单变量版本这里只会剩 success —— entry 被静默覆盖掉了
    expect(started).toContain(ENTRY_LAST)
    expect(started).toContain(SUCCESS_FIRST)
  })

  it('键盘手势也算数（不只认 pointerdown）', async () => {
    const { playTone } = await freshModule()
    playTone(true, 'coin')
    await tick()
    expect(started).toHaveLength(0)

    gesture('keydown')
    await tick()
    await tick()
    expect(started).toContain(COIN_LAST)
  })

  it('手势之后上下文仍起不来 → 下一次调用自己补播，不会永久卡住', async () => {
    resumeWorks = false
    const { playTone } = await freshModule()
    playTone(true, 'entry')
    gesture()
    await tick()
    await tick()
    // resume 没成功 —— 确实还没响，而且此时手势监听已经摘掉了，
    // 旧写法会让这一声永远出不来
    expect(started).toHaveLength(0)

    resumeWorks = true
    playTone(true, 'coin')
    await tick()
    await tick()
    expect(started).toContain(ENTRY_LAST) // 攒着的那声没丢
    expect(started).toContain(COIN_LAST)
  })

  it('补播是幂等的：手势与 resume 两条路都触发时不会重播', async () => {
    const { playTone } = await freshModule()
    playTone(true, 'entry')
    await tick()
    gesture()
    await tick()
    await tick()
    const afterGesture = started.length
    // 再来一次手势：监听已摘掉，不该再多响
    gesture()
    await tick()
    await tick()
    expect(started.length).toBe(afterGesture)
  })
})
