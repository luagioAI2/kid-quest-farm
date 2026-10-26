/**
 * 数一张 PNG 里有多少种颜色 —— 给「整屏 canvas 的游戏到底画出来没有」用。
 *
 * ## 为什么不能用 `drawImage(webglCanvas)` 采样
 *
 * three / PixiJS 默认 `preserveDrawingBuffer: false`。帧画完、合成器取走之后，
 * 那块 backbuffer 就「未定义」了 —— 此时 `ctx.drawImage(glCanvas, …)` 得到的
 * 往往是**全黑或全透明**。于是「颜色种类 = 1」，看着像「游戏没画出来」，
 * 而实际上画面完全正常。★ 这是判据错了，不是游戏坏了。
 *
 * 正确的取样点是**合成之后**的截图（`page.screenshot()`），它拿的是浏览器
 * 已经合成好的位图，跟用户看到的同一份。
 *
 * ## 为什么自己解 PNG
 *
 * 只为这一件事装 sharp / pngjs 不值得。PNG 的 IDAT 就是 zlib 流，
 * `node:zlib` 直接解；剩下只要处理 5 种 scanline filter。
 * 支持 colorType 2（RGB）/ 6（RGBA）/ 0（灰度），bitDepth 8 —— 截图都是这几类。
 *
 * 用法：
 * ```js
 * import { countColors } from './lib/png-colors.mjs'
 * const n = countColors(await page.screenshot())   // 每 4 个像素取 1 个，RGB 各留 4 bit
 * ```
 */
import zlib from 'node:zlib'

function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p - a)
  const pb = Math.abs(p - b)
  const pc = Math.abs(p - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

/**
 * @param {Buffer} png 整张 PNG 的字节
 * @param {number} step 每隔几个像素取一个（默认 4）
 * @returns {number} 颜色种类数（RGB 各量化到 4 bit ⇒ 最多 4096）
 */
export function countColors(png, step = 4) {
  if (!Buffer.isBuffer(png) || png.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('不是 PNG')
  }
  let pos = 8
  let w = 0
  let h = 0
  let colorType = 6
  let bitDepth = 8
  const idat = []
  while (pos < png.length) {
    const len = png.readUInt32BE(pos)
    const type = png.toString('ascii', pos + 4, pos + 8)
    const data = png.subarray(pos + 8, pos + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') break
    pos += 12 + len
  }
  if (bitDepth !== 8) throw new Error(`只支持 8 bit（拿到 ${bitDepth}）`)
  const ch = colorType === 2 ? 3 : colorType === 6 ? 4 : colorType === 0 ? 1 : 0
  if (!ch) throw new Error(`不支持的 colorType ${colorType}`)

  const raw = zlib.inflateSync(Buffer.concat(idat))
  const stride = w * ch
  const out = Buffer.alloc(stride * h)
  let rp = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++]
    const row = raw.subarray(rp, rp + stride)
    rp += stride
    const cur = out.subarray(y * stride, (y + 1) * stride)
    const prev = y ? out.subarray((y - 1) * stride, y * stride) : null
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= ch ? prev[x - ch] : 0
      let v = row[x]
      if (filter === 1) v += a
      else if (filter === 2) v += b
      else if (filter === 3) v += (a + b) >> 1
      else if (filter === 4) v += paeth(a, b, c)
      cur[x] = v & 0xff
    }
  }

  const seen = new Set()
  const total = w * h
  for (let i = 0; i < total; i += step) {
    const o = i * ch
    const r = ch === 1 ? out[o] : out[o]
    const g = ch === 1 ? out[o] : out[o + 1]
    const bl = ch === 1 ? out[o] : out[o + 2]
    seen.add(((r >> 4) << 8) | ((g >> 4) << 4) | (bl >> 4))
  }
  return seen.size
}
