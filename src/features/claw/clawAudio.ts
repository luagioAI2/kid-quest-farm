/**
 * 娃娃机的**声音** —— 逐字移植参考实现 `E:\plan\test25\claw-machine\src\audio.ts`。
 *
 * ---------------------------------------------------------------------------
 * 为什么不能只用 `playTone('coin')`
 * ---------------------------------------------------------------------------
 * 参考实现的声音不是「几个提示音」，而是**一台机器在动**：
 *
 *   · 马达是**连续音**：小车一动就起转（`gantry`），速度决定音高与音量
 *     （`motorLevel`），下爪 / 提爪时换成更高的转速；
 *   · 合爪是**电磁铁**（`clank`：噪声 + 下滑的三角波）；
 *   · 娃娃掉进通道是**低通噪声 + 85Hz 闷响**（`chute`），随后才是两声中奖风铃；
 *   · 娃娃之间撞一下有 `thud`（按冲击强度给音量）。
 *
 * 这几层叠在一起才叫「在玩一台机器」。换成三个 beep 之后，爪子动起来是**静音**的
 * —— 孩子只能靠看，手感直接少一半。
 *
 * ---------------------------------------------------------------------------
 * ★ 和平台 `playTone()` 的关系
 * ---------------------------------------------------------------------------
 * 平台的 `playTone` 是「一次一个音」的短音队列，没有常驻振荡器，也没有参数联动。
 * 这里需要一个**常驻**的马达音（两个振荡器 + 带通 + 齿轮噪声）和一条总线，
 * 所以自己开一个 `AudioContext`。两个上下文并存是允许的，各自音量独立。
 *
 * ⚠️ 必须在**用户手势之后**才 `unlock()`（浏览器的自动播放策略）。
 *   页面里在第一次 `pointerdown` / `keydown` 上调它，和参考实现一致。
 *
 * ⚠️ 卸载时必须 `dispose()`：常驻振荡器不关掉的话，切走之后还会一直嗡嗡响。
 */

type AudioCtxCtor = typeof AudioContext

function audioCtor(): AudioCtxCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & { webkitAudioContext?: AudioCtxCtor }
  return window.AudioContext ?? w.webkitAudioContext ?? null
}

export class ClawSfx {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private motor: {
    osc: OscillatorNode
    osc2: OscillatorNode
    gain: GainNode
    filt: BiquadFilterNode
    gear: GainNode
  } | null = null
  private noiseBuf: AudioBuffer | null = null
  /** 用户设置里的「音效」开关。关着的时候 `unlock()` 也不建图。 */
  private enabled = true
  /** 已经 dispose 过 —— 之后再调用任何方法都直接返回（防卸载后还有人调） */
  private dead = false

  /** 开关音效。关掉只把总线拉到 0（不销毁图，开回来是瞬时的）。 */
  setEnabled(on: boolean): void {
    this.enabled = on
    if (!this.ctx || !this.master) return
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.05)
    if (!on) this.motorLevel(0, 1)
  }

  /** 第一次用户手势时调一次。重复调用是安全的（会顺手 `resume()`）。 */
  unlock(): void {
    if (this.dead || !this.enabled) return
    if (this.ctx) {
      void this.ctx.resume().catch(() => {})
      return
    }
    const AC = audioCtor()
    if (!AC) return
    let c: AudioContext
    try {
      c = new AC()
    } catch {
      return
    }
    this.ctx = c
    const master = c.createGain()
    master.gain.value = this.enabled ? 0.8 : 0
    this.master = master
    const comp = c.createDynamicsCompressor()
    master.connect(comp)
    comp.connect(c.destination)

    const len = Math.floor(c.sampleRate * 2)
    const buf = c.createBuffer(1, len, c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.noiseBuf = buf

    // 小直流电机：锯齿基频 + 换向器啸叫 + 齿轮啮合的噪声调幅
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 95
    const osc2 = c.createOscillator()
    osc2.type = 'triangle'
    osc2.frequency.value = 760
    const filt = c.createBiquadFilter()
    filt.type = 'bandpass'
    filt.frequency.value = 600
    filt.Q.value = 0.8
    const gain = c.createGain()
    gain.gain.value = 0
    const o2g = c.createGain()
    o2g.gain.value = 0.25
    osc.connect(filt)
    osc2.connect(o2g)
    o2g.connect(filt)
    filt.connect(gain)
    gain.connect(master)
    const gn = c.createBufferSource()
    gn.buffer = buf
    gn.loop = true
    const gf = c.createBiquadFilter()
    gf.type = 'bandpass'
    gf.frequency.value = 2400
    gf.Q.value = 2
    const gear = c.createGain()
    gear.gain.value = 0
    gn.connect(gf)
    gf.connect(gear)
    gear.connect(master)
    osc.start()
    osc2.start()
    gn.start()
    this.motor = { osc, osc2, gain, filt, gear }

    // 商场环境底噪（很轻的低频隆隆），让静音时不是「真空」
    const an = c.createBufferSource()
    an.buffer = buf
    an.loop = true
    an.playbackRate.value = 0.5
    const af = c.createBiquadFilter()
    af.type = 'lowpass'
    af.frequency.value = 420
    const amb = c.createGain()
    amb.gain.value = 0.035
    an.connect(af)
    af.connect(amb)
    amb.connect(master)
    an.start()
  }

  /** 切走页面时静音（常驻振荡器不能一直在后台响）。 */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {})
  }

  /** 回到页面时恢复。 */
  resume(): void {
    if (!this.dead && this.ctx && this.enabled && this.ctx.state !== 'running') {
      void this.ctx.resume().catch(() => {})
    }
  }

  dispose(): void {
    this.dead = true
    this.motorLevel(0, 1)
    try {
      this.motor?.osc.stop()
      this.motor?.osc2.stop()
    } catch {
      /* 已经停过 */
    }
    this.motor = null
    this.noiseBuf = null
    this.master = null
    const c = this.ctx
    this.ctx = null
    if (c) void c.close().catch(() => {})
  }

  private get ready(): boolean {
    return !this.dead && this.enabled && !!this.ctx && !!this.master
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType = 'sine',
    vol = 0.2,
    when = 0,
    slide = 0,
    attack = 0.004,
  ): void {
    const c = this.ctx
    const master = this.master
    if (!c || !master) return
    const t = c.currentTime + when
    const o = c.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private noise(
    dur: number,
    vol: number,
    freq: number,
    q = 1,
    when = 0,
    type: BiquadFilterType = 'bandpass',
  ): void {
    const c = this.ctx
    const master = this.master
    const buf = this.noiseBuf
    if (!c || !master || !buf) return
    const t = c.currentTime + when
    const s = c.createBufferSource()
    s.buffer = buf
    s.playbackRate.value = 0.8 + Math.random() * 0.4
    const f = c.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    const g = c.createGain()
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f)
    f.connect(g)
    g.connect(master)
    s.start(t, Math.random())
    s.stop(t + dur + 0.02)
  }

  /** 马达转速：`level` 0~1，`pitch` 是音高倍数。 */
  motorLevel(level: number, pitch = 1): void {
    const c = this.ctx
    const m = this.motor
    if (!c || !m) return
    const t = c.currentTime
    m.gain.gain.setTargetAtTime(Math.max(0, level) * 0.08, t, 0.06)
    m.gear.gain.setTargetAtTime(Math.max(0, level) * 0.03, t, 0.06)
    m.osc.frequency.setTargetAtTime(80 * pitch, t, 0.1)
    m.osc2.frequency.setTargetAtTime(700 * pitch, t, 0.1)
    m.filt.frequency.setTargetAtTime(450 + 400 * pitch, t, 0.1)
  }

  /** 投币：几粒金属碰撞 + 摇杆里的哗啦声 */
  coin(): void {
    if (!this.ready) return
    const partials = [2960, 4410, 6120]
    ;[0, 0.07, 0.115].forEach((w, i) => {
      for (const p of partials) this.tone(p * (1 - i * 0.03), 0.18 - i * 0.04, 'sine', 0.05 - i * 0.012, w)
    })
    this.noise(0.09, 0.1, 5000, 3, 0.16)
    this.noise(0.06, 0.12, 900, 2, 0.24)
    this.chime(0.45, true)
  }

  /** 塑料微动开关的「嗒」 */
  click(): void {
    if (!this.ready) return
    this.noise(0.025, 0.25, 3200, 4)
    this.tone(1800, 0.02, 'square', 0.03)
  }

  /** 合爪：电磁铁吸合 */
  clank(): void {
    if (!this.ready) return
    this.noise(0.05, 0.35, 1400, 2)
    this.tone(140, 0.09, 'triangle', 0.2, 0, -50)
    this.noise(0.12, 0.08, 4000, 6, 0.02)
  }

  /** 娃娃撞池底 / 互相撞（`s` = 冲击强度） */
  thud(s: number): void {
    if (!this.ready) return
    this.noise(0.09, Math.min(0.22, 0.05 * s), 260, 1.2)
  }

  /** 小车起停时的一记摩擦声 */
  gantry(start: boolean): void {
    if (!this.ready) return
    this.noise(0.04, 0.08, start ? 1200 : 800, 3)
  }

  /** 娃娃顺着通道掉进取物盘 */
  chute(): void {
    if (!this.ready) return
    this.noise(0.18, 0.12, 700, 1.5)
    this.noise(0.22, 0.4, 150, 1, 0.22, 'lowpass')
    this.tone(85, 0.22, 'sine', 0.35, 0.22, -35)
    this.noise(0.1, 0.12, 400, 1, 0.42, 'lowpass')
  }

  /** 机器自带的两声风铃（和真机一样） */
  chime(when = 0, soft = false): void {
    if (!this.ready) return
    const v = soft ? 0.04 : 0.11
    for (const [f, w] of [
      [1318.5, 0],
      [1046.5, 0.32],
    ] as const) {
      this.tone(f, 1.1, 'sine', v, when + w, 0, 0.003)
      this.tone(f * 2.76, 0.4, 'sine', v * 0.25, when + w, 0, 0.002)
    }
  }

  /** 推开取物口的挡片、把娃娃拿走 */
  take(): void {
    if (!this.ready) return
    this.noise(0.06, 0.18, 1800, 2)
    this.noise(0.25, 0.06, 900, 0.8, 0.05)
    this.noise(0.05, 0.14, 1500, 2, 0.32)
  }

  win(): void {
    if (!this.ready) return
    this.chime(0.05)
    this.chime(0.75)
  }

  /** 没抓到 */
  lose(): void {
    if (!this.ready) return
    this.tone(330, 0.16, 'triangle', 0.06)
    this.tone(262, 0.3, 'triangle', 0.06, 0.18)
  }
}
