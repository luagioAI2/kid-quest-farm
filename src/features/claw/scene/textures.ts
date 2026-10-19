/**
 * 娃娃机上**所有画出来的贴图** —— 逐字抄参考实现（`claw-machine/src/textures.ts`）。
 *
 * ---------------------------------------------------------------------------
 * ★ 唯一一处改动：`Math.random()` 换成**种子随机**
 * ---------------------------------------------------------------------------
 *
 * 原版是每次都重新掷骰子（纤维、斑点、污渍的位置都随机）。我们这边不行：
 * 走查脚本会**采样像素**比较「改之前 / 改之后」，贴图每次不一样的话，
 * 同一份代码跑两次的数值都在抖，判据就只能卡得很松 —— 那等于没有判据。
 *
 * ➜ `seeded()` 是线性同余（LCG），同一个种子永远画出同一张图。
 *   画面上看不出任何区别，但走查从此可复现。
 */
import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three'

/** 线性同余伪随机 —— 同一个种子 ⇒ 同一张图。 */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function canvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}

/** height canvas → 切线空间法线贴图 */
function heightToNormal(src: HTMLCanvasElement, strength: number): CanvasTexture {
  const w = src.width
  const h = src.height
  const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const { c, g } = canvas(w, h)
  const out = g.createImageData(w, h)
  // 环绕取模：贴图是平铺的，边界斜率必须接得上
  const H = (x: number, y: number) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      out.data[i] = (-dx / l * 0.5 + 0.5) * 255
      out.data[i + 1] = (dy / l * 0.5 + 0.5) * 255
      out.data[i + 2] = (1 / l * 0.5 + 0.5) * 255
      out.data[i + 3] = 255
    }
  }
  g.putImageData(out, 0, 0)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  return t
}

let fabricN: CanvasTexture | null = null
/** 毛绒的**纤维法线**：5000 根短线，九宫格各画一遍保证平铺无缝。 */
export function fabricNormal(): CanvasTexture {
  if (fabricN) return fabricN
  const rnd = seeded(0x5eed)
  const S = 256
  const { c, g } = canvas(S, S)
  g.fillStyle = '#808080'
  g.fillRect(0, 0, S, S)
  g.lineCap = 'round'
  for (let i = 0; i < 5000; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const a = rnd() * Math.PI * 2
    const l = 2 + rnd() * 6
    const v = Math.floor(90 + rnd() * 90)
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`
    g.lineWidth = 0.6 + rnd()
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        g.beginPath()
        g.moveTo(x + ox, y + oy)
        g.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l)
        g.stroke()
      }
    }
  }
  fabricN = heightToNormal(c, 2.2)
  fabricN.repeat.set(3, 3)
  return fabricN
}

/** 一段带光晕的文字（灯箱 / 标签用）。 */
export function labelTexture(
  text: string,
  color = '#fff',
  bg = 'rgba(0,0,0,0)',
  w = 256,
  h = 96,
  font = 'bold 56px sans-serif',
): CanvasTexture {
  const { c, g } = canvas(w, h)
  g.fillStyle = bg
  g.fillRect(0, 0, w, h)
  g.font = font
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillStyle = color
  g.shadowColor = color
  g.shadowBlur = 14
  g.fillText(text, w / 2, h / 2)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

let detailT: CanvasTexture | null = null
/**
 * 毛绒的**颜色细节**：纤维斑点 + 两侧的缝合线。
 *
 * 球面 UV 的 `u = 0 / 0.5 / 1` 正好是侧面接缝的位置 —— 缝线画在那儿，
 * 一只娃娃看上去就是「两片布缝起来的」，而不是一个整球。
 */
export function fabricDetail(): CanvasTexture {
  if (detailT) return detailT
  const rnd = seeded(0xfab2)
  const W = 512
  const H = 256
  const { c, g } = canvas(W, H)
  g.fillStyle = '#f4f4f4'
  g.fillRect(0, 0, W, H)
  for (let i = 0; i < 14000; i++) {
    const v = 200 + rnd() * 55
    g.fillStyle = `rgba(${v},${v},${v},0.5)`
    g.fillRect(rnd() * W, rnd() * H, 1.5, 1.5)
  }
  for (const u of [0, 0.5, 1]) {
    const x = u * W
    const grd = g.createLinearGradient(x - 6, 0, x + 6, 0)
    grd.addColorStop(0, 'rgba(0,0,0,0)')
    grd.addColorStop(0.5, 'rgba(60,40,40,0.38)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(x - 6, 0, 12, H)
    g.strokeStyle = 'rgba(70,50,50,0.45)'
    g.lineWidth = 1.4
    for (let y = 6; y < H - 6; y += 7) {
      g.beginPath()
      g.moveTo(x - 3.5, y)
      g.lineTo(x + 3.5, y + 3)
      g.stroke()
    }
  }
  detailT = new CanvasTexture(c)
  detailT.colorSpace = SRGBColorSpace
  detailT.anisotropy = 4
  detailT.wrapS = RepeatWrapping
  return detailT
}

let furT: CanvasTexture | null = null
/** 毛壳（fur shell）用的**每像素毛高**。 */
export function furNoise(): CanvasTexture {
  if (furT) return furT
  const rnd = seeded(0xf00d)
  const S = 128
  const { c, g } = canvas(S, S)
  const img = g.createImageData(S, S)
  for (let i = 0; i < S * S; i++) {
    const v = Math.pow(rnd(), 0.6) * 255
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = 255
  }
  g.putImageData(img, 0, 0)
  furT = new CanvasTexture(c)
  furT.wrapS = furT.wrapT = RepeatWrapping
  furT.colorSpace = NoColorSpace
  return furT
}

const FONT = '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC",sans-serif'

function tex(c: HTMLCanvasElement, srgb = true, repeat = false): CanvasTexture {
  const t = new CanvasTexture(c)
  if (srgb) t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  return t
}

/** 玻璃上极轻的指纹 —— 新机器是擦干净的，只留一点点。 */
export function glassSmudge(): CanvasTexture {
  const rnd = seeded(0x51a6)
  const W = 512
  const H = 640
  const { c, g } = canvas(W, H)
  g.clearRect(0, 0, W, H)
  const r2 = (a: number, b: number) => a + rnd() * (b - a)
  for (let i = 0; i < 4; i++) {
    g.save()
    g.translate(r2(80, W - 80), r2(H * 0.55, H * 0.95))
    g.rotate(r2(-0.4, 0.4))
    const r = r2(30, 70)
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, r)
    grd.addColorStop(0, 'rgba(255,255,255,0.1)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.scale(1, r2(0.3, 0.55))
    g.fillStyle = grd
    g.fillRect(-r, -r, r * 2, r * 2)
    g.restore()
  }
  for (let i = 0; i < 120; i++) {
    g.fillStyle = `rgba(255,255,255,${r2(0.04, 0.14)})`
    g.fillRect(rnd() * W, rnd() * H, 1, 1)
  }
  return tex(c)
}

/** 亮面白漆（极细的颗粒，没有划痕 / 磨损）。 */
export function glossWhite(): CanvasTexture {
  const rnd = seeded(0x9011)
  const S = 512
  const { c, g } = canvas(S, S)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 800; i++) {
    const v = 245 + rnd() * 10
    g.fillStyle = `rgba(${v},${v},${v},0.4)`
    g.fillRect(rnd() * S, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2)
  }
  return tex(c, true, true)
}

/** 那个圆头圆脑的吉祥物（灯箱 / 背板 / 门贴共用）。 */
function drawMascot(g: CanvasRenderingContext2D, x: number, y: number, s: number, accent: string, soft: string) {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.fillStyle = soft
  g.beginPath()
  g.ellipse(0, 8, 38, 34, 0, 0, 7)
  g.fill()
  g.fillStyle = '#fff'
  g.beginPath()
  g.ellipse(0, 0, 34, 32, 0, 0, 7)
  g.fill()
  g.strokeStyle = accent
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(0, -32)
  g.lineTo(0, -48)
  g.stroke()
  g.fillStyle = accent
  g.beginPath()
  g.arc(0, -52, 6, 0, 7)
  g.fill()
  g.fillStyle = '#2a2a2e'
  for (const sx of [-1, 1]) {
    g.beginPath()
    g.ellipse(sx * 12, -4, 5, 7, 0, 0, 7)
    g.fill()
  }
  g.fillStyle = '#fff'
  for (const sx of [-1, 1]) {
    g.beginPath()
    g.arc(sx * 13.5, -6.5, 2, 0, 7)
    g.fill()
  }
  g.strokeStyle = '#2a2a2e'
  g.lineWidth = 2.2
  g.beginPath()
  g.arc(0, 6, 8, 0.15, Math.PI - 0.15)
  g.stroke()
  g.fillStyle = accent
  for (const sx of [-1, 1]) {
    g.beginPath()
    g.ellipse(sx * 22, 6, 6, 4, 0, 0, 7)
    g.fill()
  }
  g.restore()
}

/** 顶部灯箱：品牌 + 吉祥物。 */
export function headerSign(accentHex: string, softHex: string): CanvasTexture {
  const W = 1024
  const H = 220
  const { c, g } = canvas(W, H)
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, softHex)
  bg.addColorStop(1, '#ffffff')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)
  g.fillStyle = accentHex
  g.fillRect(0, 0, W, 10)
  g.fillRect(0, H - 10, W, 10)
  for (let i = 0; i < 14; i++) {
    g.fillStyle = i % 2 ? accentHex : '#ffffff'
    g.fillRect(i * 18, 14, 16, 18)
    g.fillRect(i * 18, H - 32, 16, 18)
  }
  drawMascot(g, 150, H / 2 + 4, 1.35, accentHex, softHex)
  g.fillStyle = accentHex
  g.font = `900 96px ${FONT}`
  g.textBaseline = 'middle'
  g.fillText('爪爪乐', 260, H / 2 - 6)
  g.fillStyle = '#3a3a40'
  g.font = `bold 28px ${FONT}`
  g.fillText('PAW PLAY', 270, H / 2 + 46)
  g.fillStyle = accentHex
  g.font = `bold 22px ${FONT}`
  g.fillText('HAPPY GAMES', 480, H / 2 + 46)
  return tex(c)
}

/** 柜内背板：柔和的几何图形 + 吉祥物 + 「好抓!」。 */
export function backboardPrint(accentHex: string, softHex: string): CanvasTexture {
  const rnd = seeded(0xbb01)
  const W = 512
  const H = 640
  const { c, g } = canvas(W, H)
  const sky = g.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, softHex)
  sky.addColorStop(0.55, '#ffffff')
  sky.addColorStop(1, accentHex + '55')
  g.fillStyle = sky
  g.fillRect(0, 0, W, H)
  g.fillStyle = accentHex + '33'
  for (let y = 20; y < H * 0.55; y += 28) {
    for (let x = 20; x < W; x += 28) {
      g.beginPath()
      g.arc(x + (y % 56) * 0.15, y, 4, 0, 7)
      g.fill()
    }
  }
  const r2 = (a: number, b: number) => a + rnd() * (b - a)
  for (let i = 0; i < 10; i++) {
    g.fillStyle = [accentHex + '55', '#ffffffaa', '#ffe08a88'][i % 3]
    const x = r2(30, W - 30)
    const y = r2(40, H * 0.5)
    const r = r2(10, 28)
    if (i % 3 === 0) {
      g.beginPath()
      g.arc(x, y, r, 0, 7)
      g.fill()
    } else if (i % 3 === 1) {
      g.fillRect(x - r, y - r * 0.6, r * 2, r * 1.2)
    } else {
      g.beginPath()
      g.moveTo(x, y - r)
      g.lineTo(x + r, y + r * 0.6)
      g.lineTo(x - r, y + r * 0.6)
      g.fill()
    }
  }
  g.fillStyle = accentHex + '40'
  g.beginPath()
  g.ellipse(W / 2, H * 0.78, W * 0.55, 70, 0, 0, 7)
  g.fill()
  drawMascot(g, W * 0.32, H * 0.62, 2.2, accentHex, softHex)
  g.fillStyle = '#fff'
  g.beginPath()
  if (g.roundRect) g.roundRect(W * 0.52, H * 0.42, 180, 70, 16)
  else g.rect(W * 0.52, H * 0.42, 180, 70)
  g.fill()
  g.beginPath()
  g.moveTo(W * 0.55, H * 0.52)
  g.lineTo(W * 0.48, H * 0.58)
  g.lineTo(W * 0.58, H * 0.55)
  g.fill()
  g.fillStyle = accentHex
  g.font = `900 36px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('好抓!', W * 0.52 + 90, H * 0.42 + 36)
  g.textAlign = 'left'
  g.fillStyle = accentHex
  g.fillRect(0, H - 56, W, 56)
  g.fillStyle = '#fff'
  g.font = `bold 28px ${FONT}`
  g.fillText('爪爪乐  ·  PAW PLAY', 24, H - 28)
  return tex(c)
}

/** 取物口那圈贴纸（PRIZE OUT / 取物口）。 */
export function prizeOutRing(accentHex: string): CanvasTexture {
  const S = 512
  const { c, g } = canvas(S, S)
  g.clearRect(0, 0, S, S)
  g.fillStyle = accentHex
  g.beginPath()
  g.arc(S / 2, S / 2, S / 2 - 4, 0, 7)
  g.arc(S / 2, S / 2, S / 2 - 48, 0, 7, true)
  g.fill()
  g.fillStyle = '#1a1a1e'
  g.beginPath()
  g.arc(S / 2, S / 2, S / 2 - 52, 0, 7)
  g.fill()
  g.fillStyle = '#fff'
  g.font = `900 52px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('PRIZE OUT', S / 2, S / 2 - 8)
  g.font = `bold 28px ${FONT}`
  g.fillText('取物口', S / 2, S / 2 + 32)
  return tex(c)
}

/** 控制台上那条品牌条。 */
export function ledgeLabel(accentHex: string): CanvasTexture {
  const W = 512
  const H = 96
  const { c, g } = canvas(W, H)
  g.fillStyle = accentHex
  g.fillRect(0, 0, W, H)
  g.fillStyle = '#fff'
  g.font = `900 44px ${FONT}`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('爪爪乐  PAW PLAY', W / 2, H / 2)
  return tex(c)
}

/** 机身正面那扇检修门上的贴纸。 */
export function doorSticker(accentHex: string, softHex: string): CanvasTexture {
  const W = 256
  const H = 320
  const { c, g } = canvas(W, H)
  g.fillStyle = '#ffffff'
  g.fillRect(0, 0, W, H)
  g.strokeStyle = accentHex
  g.lineWidth = 10
  g.strokeRect(5, 5, W - 10, H - 10)
  drawMascot(g, W / 2, H * 0.42, 2.0, accentHex, softHex)
  g.fillStyle = accentHex
  g.font = `bold 26px ${FONT}`
  g.textAlign = 'center'
  g.fillText('爪爪乐', W / 2, H * 0.82)
  return tex(c)
}

/** 商场地面：浅色瓷砖。 */
export function floorTiles(): CanvasTexture {
  const S = 512
  const { c, g } = canvas(S, S)
  g.fillStyle = '#e8e6e2'
  g.fillRect(0, 0, S, S)
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const v = 225 + ((x + y) % 2) * 8
      g.fillStyle = `rgb(${v},${v - 1},${v - 3})`
      g.fillRect((x * S) / 4, (y * S) / 4, S / 4, S / 4)
    }
  }
  g.strokeStyle = '#cfcac3'
  g.lineWidth = 2
  for (let i = 0; i <= 4; i++) {
    g.beginPath()
    g.moveTo((i * S) / 4, 0)
    g.lineTo((i * S) / 4, S)
    g.moveTo(0, (i * S) / 4)
    g.lineTo(S, (i * S) / 4)
    g.stroke()
  }
  const t = tex(c, true, true)
  t.repeat.set(6, 6)
  return t
}

/** 池底那块**深蓝灰**的地垫。 */
export function feltPlain(): CanvasTexture {
  const rnd = seeded(0xfe17)
  const S = 256
  const { c, g } = canvas(S, S)
  g.fillStyle = '#3a4a62'
  g.fillRect(0, 0, S, S)
  for (let i = 0; i < 4000; i++) {
    const v = rnd() * 20 - 10
    g.fillStyle = `rgba(${58 + v},${74 + v},${98 + v},0.55)`
    g.fillRect(rnd() * S, rnd() * S, 1.4, 1.4)
  }
  const t = tex(c, true, true)
  t.repeat.set(3, 3)
  return t
}

/** 玻璃上的**反射条**（三块灯管的倒影）—— 玻璃感的主要来源。 */
export function glassReflection(): CanvasTexture {
  const W = 256
  const H = 320
  const { c, g } = canvas(W, H)
  g.fillStyle = '#000'
  g.fillRect(0, 0, W, H)
  g.filter = 'blur(8px)'
  for (const [y, w, h] of [
    [30, 90, 16],
    [70, 70, 12],
    [105, 50, 8],
  ] as const) {
    for (const x of [W * 0.28, W * 0.72]) {
      g.fillStyle = 'rgba(255,250,240,0.85)'
      g.fillRect(x - w / 2, y, w, h)
    }
  }
  g.filter = 'none'
  return tex(c)
}
