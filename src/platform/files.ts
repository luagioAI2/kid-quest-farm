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
export function playTone(
  enabled: boolean,
  kind: 'success' | 'fail' | 'coin' = 'success',
): void {
  if (!enabled) return
  try {
    type Ctor = typeof AudioContext
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
    const Ctx = w.AudioContext ?? w.webkitAudioContext
    if (!Ctx) return
    audioCtx ??= new Ctx()
    const ctx = audioCtx
    if (ctx.state === 'suspended') void ctx.resume()

    const notes =
      kind === 'success'
        ? [523.25, 659.25, 783.99] // C5 E5 G5
        : kind === 'coin'
          ? [880, 1174.66] // A5 D6
          : [392, 311.13] // G4 Eb4

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const t0 = ctx.currentTime + i * 0.09
      gain.gain.setValueAtTime(0.0001, t0)
      gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.26)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(t0)
      osc.stop(t0 + 0.3)
    })
  } catch {
    /* 忽略音频失败 */
  }
}
