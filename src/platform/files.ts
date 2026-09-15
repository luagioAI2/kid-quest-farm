import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/* ============================================================
   平台适配：文件导出 / 分享
   ------------------------------------------------------------
   浏览器：Blob + <a download>，退化为新窗口打开
   APK   ：写入 Documents 目录，再用系统分享面板发出
   ============================================================ */

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

/** 触发浏览器下载 */
export async function saveBlob(filename: string, content: string): Promise<boolean> {
  try {
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    // 让浏览器有时间发起下载再回收
    setTimeout(() => URL.revokeObjectURL(url), 4000)
    return true
  } catch {
    return false
  }
}

/**
 * 导出文本：原生环境走「写入文件 + 系统分享」，Web 走下载。
 * 返回值仅表示"是否成功发起了导出动作"。
 */
export async function shareOrDownload(filename: string, content: string): Promise<boolean> {
  if (isNative()) {
    try {
      // 写到应用文档目录，用户可在文件管理器里找到
      const res = await Filesystem.writeFile({
        path: filename,
        data: content,
        directory: Directory.Documents,
        encoding: Encoding.UTF8,
        recursive: true,
      })
      try {
        await Share.share({
          title: '小任务农场 · 数据备份',
          text: '这是小任务农场的数据备份文件，请妥善保存。',
          url: res.uri,
          dialogTitle: '保存或分享备份',
        })
      } catch {
        // 用户取消了分享面板 —— 文件已经写好了，仍算成功
      }
      return true
    } catch {
      // 原生路走不通时退回下载
      return saveBlob(filename, content)
    }
  }
  return saveBlob(filename, content)
}

/** 原生：读取用户选中的文本文件；Web 由 <input type=file> 处理 */
export async function readTextFile(uri: string): Promise<string | null> {
  try {
    const res = await Filesystem.readFile({ path: uri, encoding: Encoding.UTF8 })
    return typeof res.data === 'string' ? res.data : null
  } catch {
    return null
  }
}

/** 轻量触感反馈（原生才有，Web 静默忽略） */
export async function hapticLight(enabled: boolean): Promise<void> {
  if (!enabled || !isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch {
    /* 忽略 */
  }
}

/** 轻量音效：用 WebAudio 合成，无需音频资源文件 */
let audioCtx: AudioContext | null = null

/** 音效种类。`entry` 是入场音（打开 App / 进入主界面时那一下）。 */
export type ToneKind = 'success' | 'fail' | 'coin' | 'entry'

interface Note {
  /** 起始频率（Hz） */
  freq: number
  /** 相对起播时刻（秒） */
  at: number
  /** 时长（秒） */
  dur: number
  /** 从这个频率**滑上来**。给了就做一段上滑 —— 比直接起音俏皮得多。 */
  glideFrom?: number
  /** 音量倍率 */
  gain?: number
}

const TONES: Record<ToneKind, Note[]> = {
  success: [
    { freq: 523.25, at: 0, dur: 0.26 }, // C5
    { freq: 659.25, at: 0.09, dur: 0.26 }, // E5
    { freq: 783.99, at: 0.18, dur: 0.26 }, // G5
  ],
  coin: [
    { freq: 880, at: 0, dur: 0.16 }, // A5
    { freq: 1174.66, at: 0.08, dur: 0.22 }, // D6
  ],
  fail: [
    { freq: 392, at: 0, dur: 0.22 }, // G4
    { freq: 311.13, at: 0.12, dur: 0.26 }, // Eb4
  ],
  /**
   * 入场音：要「可爱」。
   *
   * 可爱 ≈ 高音区 + 短促 + 有弹跳 + 结尾往上翘。
   * 所以是「**上滑** → 蹦一下 → 回一口气 → 高音甜甜收尾 → 一点星芒」，
   * 而不是 `success` 那种四平八稳的上行琶音 —— 那个是「任务做完了」的反馈，
   * 听感是「完成」，不是「欢迎」。
   *
   * 全部落在 C6~E7（1kHz 以上）：小孩子的耳朵对这个频段最敏感，
   * 手机小喇叭也放得出来，听起来就是「叮咚」那种亮亮的糖音。
   */
  entry: [
    { freq: 1046.5, at: 0, dur: 0.13, glideFrom: 784.0, gain: 0.9 }, // G5 → C6 上滑
    { freq: 1567.98, at: 0.14, dur: 0.1, gain: 0.75 }, // G6 蹦一下
    { freq: 1318.51, at: 0.25, dur: 0.1, gain: 0.6 }, // E6 回落
    { freq: 2093.0, at: 0.36, dur: 0.36, gain: 1 }, // C7 甜甜的收尾
    { freq: 2637.02, at: 0.64, dur: 0.2, gain: 0.42 }, // E7 一点星芒
  ],
}

function renderTone(ctx: AudioContext, kind: ToneKind): void {
  for (const n of TONES[kind]) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'triangle'
    // 留 20ms 余量：currentTime 到真正出声之间还有一点调度延迟，
    // 排得太贴边会被削掉起音（听感是「啪」而不是「叮」）。
    const t0 = ctx.currentTime + 0.02 + n.at
    if (n.glideFrom != null) {
      osc.frequency.setValueAtTime(n.glideFrom, t0)
      osc.frequency.exponentialRampToValueAtTime(n.freq, t0 + 0.06)
    } else {
      osc.frequency.setValueAtTime(n.freq, t0)
    }
    const peak = 0.14 * (n.gain ?? 1)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t0)
    osc.stop(t0 + n.dur + 0.05)
  }
}

function ensureCtx(): AudioContext | null {
  try {
    type Ctor = typeof AudioContext
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
    const Ctx = w.AudioContext ?? w.webkitAudioContext
    if (!Ctx) return null
    audioCtx ??= new Ctx()
    return audioCtx
  } catch {
    return null
  }
}

/**
 * 还没拿到用户手势时，先把这一声记下来，等第一次点击/触摸补播。
 *
 * ⚠️ 浏览器的自动播放策略：**没有用户手势，`AudioContext` 会一直是 `suspended`**，
 * `resume()` 也不会真的生效。所以「打开 App 就响一声」在浏览器/WebView 里
 * **默认是被拦掉的** —— 这不是代码写错了，是平台的规矩。
 * 处置：不硬扛，也不静默丢掉 —— 挂一个一次性的手势监听，
 * 孩子第一次碰屏幕时把攒下的那几声补上（听感上仍像「欢迎音」，只是晚一拍）。
 *
 * ⚠️ 用**队列**而不是「一个变量存最后一个」：单变量时后一声会覆盖前一声，
 * 被覆盖的那一声**静默消失且不报错**；而且一旦 `gestureHooked` 已经是 true，
 * 新来的音就再也没有补播的机会（没有手势监听会再挂上去了）。
 * 队列 + 「队列清空是幂等的」让这两条路都堵死。
 */
let pending: ToneKind[] = []
let gestureHooked = false

/** 把攒下的音一次性放出来。可重复调用 —— 放完队列就空了，重复调用是空操作。 */
function flushPending(ctx: AudioContext): void {
  if (pending.length === 0) return
  const q = pending
  pending = []
  for (const k of q) renderTone(ctx, k)
}

/**
 * `resume()` 之后才敢放音，而且**必须确认上下文真的变成 running 了**。
 *
 * ⚠️ 不能写成 `resume().then(() => flushPending(ctx))` ——
 * `resume()` 的 promise **resolve 了也不代表上下文起来了**：
 * 没有用户手势时它会「成功返回」但 state 仍然是 `suspended`。
 * 这时候 flush 就等于把攒下的音倒进一个哑掉的上下文里 ——
 * **队列清空了、耳朵里什么都没有**，正是「静默丢音」本身。
 * 所以起不来就**继续攒着**，等下一次调用再试（不设上限，宁可晚不可丢）。
 */
function resumeThenFlush(ctx: AudioContext): void {
  void ctx
    .resume()
    .then(() => {
      if (ctx.state === 'running') flushPending(ctx)
    })
    .catch(() => {
      /* 起不来就留着，等下一次 */
    })
}

function hookFirstGesture(): void {
  if (gestureHooked || typeof document === 'undefined') return
  gestureHooked = true
  const onFirst = () => {
    document.removeEventListener('pointerdown', onFirst, true)
    document.removeEventListener('keydown', onFirst, true)
    const ctx = ensureCtx()
    if (!ctx) return
    resumeThenFlush(ctx)
  }
  document.addEventListener('pointerdown', onFirst, true)
  document.addEventListener('keydown', onFirst, true)
}

export function playTone(
  enabled: boolean,
  kind: ToneKind = 'success',
): void {
  if (!enabled) return
  try {
    const ctx = ensureCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') {
      pending.push(kind)
      hookFirstGesture()
      // 两条路都试：手势监听负责「第一次点击」；这里的 resume 负责
      // 「手势已经发生过了、只是上下文还没起来」那种情况。
      // 两边都会 flushPending，而 flush 是幂等的，所以不会重播。
      resumeThenFlush(ctx)
      return
    }
    renderTone(ctx, kind)
  } catch {
    /* 忽略音频失败 */
  }
}
