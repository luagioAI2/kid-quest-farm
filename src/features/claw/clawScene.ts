/**
 * 娃娃机的 3D 场景 —— **只负责画，不负责规则**。
 *
 * ---------------------------------------------------------------------------
 * 这个文件是 `E:/plan/test25/claw-machine` 那份参考实现**重写**来的
 * ---------------------------------------------------------------------------
 *
 * 保留的：Gen-2 商场柜的观感（白色亮面柜体 / 铝合金立柱 / LED 灯带 /
 * 玻璃 / 圆形取物口 / 灯箱 / 爪子和娃娃）。
 *
 * **刻意丢掉的**（每一条都有理由，别当成「还没做」）：
 *
 * | 丢掉 | 为什么 |
 * | --- | --- |
 * | 邻居柜子 | 家长 2026-10-16：「娃娃机 只用显示一台」 —— **别加回来**（连排第二台机器是这句话直接禁止的东西） |
 * | 商场房间 | 同上那句话只禁「第二台机器」，房间是 2026-10-17 **加回来的**：横屏两侧会空出 200~330px 的纯色，见下面「商场房间」那段 |
 * | OrbitControls / 多机位 | 家长 2026-10-17：「只保留一个（机位）」；而且自由旋转会把柜子转出画面 |
 * | 自带音效 / 浮层 / 全屏 / 手柄 | 宿主都有（`playTone` / `pushToast` / 触控），自己再造一份就是两套事实 |
 *
 * 曾经也丢过、**2026-10-17 又加回来**的两条（家长要求「原版功能都保留」）：
 *
 * | 加回来 | 代价 / 注意 |
 * | --- | --- |
 * | Rapier3D 物理 | 单独 chunk（gzip ≈755 KB，动态 import，没加载完照样能玩）。★ **它只演不算** —— 见 `clawPhysics.ts` 头注释 |
 * | EffectComposer 后处理 | 只在 `hardwareConcurrency > 4` 时开，而且**不是 bloom**（见下面「后处理」那段） |
 *
 * ---------------------------------------------------------------------------
 * ★★ 三条硬约束（本项目踩过坑，见 `docs/game-authoring-guide.md` §0.4）
 * ---------------------------------------------------------------------------
 *
 * ① **`setSize(w, h, false)`** —— 第三个参数 `updateStyle=false` 是必须的。
 *    否则 three 会往 canvas 上写行内 `style.width/height`，和宿主的响应式列
 *    （`.page-col`）打架：平板上被压两次、手机上撑出横向滚动。
 *
 * ② **DPR 封顶 2。** 手机常见 DPR=3，`3² = 9` 倍填充率，一个带光照的动画场景
 *    直接掉到 20fps。封到 2 几乎看不出差别，填充率少一半。
 *
 * ③ **尺寸来自 `ResizeObserver` 盯容器，不是 `window.resize`。**
 *    宿主给的宽度由 `.page-col` 决定，它**不跟着窗口变**
 *    （平板分屏、软键盘弹起都会变宽高但窗口尺寸不变）。
 *
 * 取景用 **contain**（柜子永远完整），不是 cover —— 同一个游戏要在
 * 430px 和 1024px 宽下都活着，宽高比差 2.4 倍，cover 必然裁掉东西。
 */
import {
  ACESFilmicToneMapping,
  BoxGeometry,
  CanvasTexture,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HalfFloatType,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RepeatWrapping,
  Scene,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { createClawPhysics, type ClawPhysics } from './clawPhysics'

/* ============================ 尺寸与配色 ============================ */

/** 柜体半宽 / 半深 / 玻璃区高度。和参考实现同一套比例（观感一致）。 */
const HX = 0.58
const HZ = 0.5
const GLASS_H = 1.2
const BODY_H = 1.0
/** 天车轨道的高度（爪子在它下面吊着） */
const RAIL_Y = GLASS_H - 0.12
/** 娃娃落进的那个洞（右下角）。掉进去 = 抓到了。 */
const HOLE = { x0: 0.26, x1: HX, z0: 0.06, z1: HZ }

/**
 * 柜子的**实际外框**（含立柱、灯箱、底座）。
 *
 * ★★ 这份边界**只有一份**：取景（`resize`）和走查（`debugFrame`）都读它。
 * 以前 `debugFrame` 自己写了一套数字、取景用的是另一套抽象「设计矩形」，
 * 两者不一致 —— 结果就是**量出来柜子底边掉在画布外 60px**
 * （2026-10-16 实测：390×844 下画布高 554，柜子底边在 614.7）。
 * 同一个事实存两份，必然走散。
 */
const BOX = {
  minX: -(HX + 0.04),
  maxX: HX + 0.04,
  minY: -BODY_H,
  maxY: GLASS_H + 0.32,
  minZ: -(HZ + 0.04),
  maxZ: HZ + 0.04,
}

/**
 * 相机 FOV。**和参考实现同一个数（45）**。
 *
 * ★ 曾经是 26 —— 那是「把整个柜子装进画面」的思路，结果透视极弱、画面像
 *   正交投影，而且相机离得很远，柜子只占画面宽度的 66%，四周一圈灰底。
 *   孩子看到的是一张「柜子的照片」，不是「站在柜子前面」。
 *   45 度才有那种往里看的纵深感。
 */
const FOV = 45

/**
 * 相机看哪里。**不是**柜子的几何中心。
 *
 * 取 `0.34`（玻璃区偏下）：玻璃是 0…1.2，看中心（0.6）的话池子和爪子会被
 * 推到画面下半，柜顶灯箱占掉太多。看 0.34 时池子落在画面下三分之一、
 * 爪子在中间偏上 —— 和参考实现一致（它的 `target.y` 在竖屏下是 0.35）。
 */
const LOOK_Y = 0.34

/**
 * 相机的极角（从 +Y 量，弧度）= 俯视多少。参考实现竖屏用 **1.28**。
 *
 * 1.28 rad ≈ 73°，也就是相机比视线高约 **17°**。这一点很关键：
 * 平视（`pol = π/2`）时池底几乎是一条线，娃娃看起来是**贴**在背景上；
 * 俯 17° 才能看见池底那块梯形，堆起来的娃娃才有「堆」的体积感。
 */
const CAM_POL = 1.28

/**
 * **取景框**：必须完整落在画面里的那块区域。
 *
 * ★★ 注意它**不是** `BOX`。原版是「站在柜子前」，画面里柜子**是满的、而且是被裁的** ——
 * 顶上的灯箱切掉一点、底下的机身切掉大半。我们之前用 `BOX`（含 1.0 高的底座）
 * 做 contain，为了把底座也装进去，相机被推得很远，玻璃区只剩画面宽度的 66%。
 *
 * 取景框 = 玻璃区 + 一点灯箱 + 一点机身（露出取物口）：
 *   · 上边界 `GLASS_H + 0.22` —— 灯箱露一条边，不切标题
 *   · 下边界 `-0.72` —— 露出取物口，机身下半截允许被裁
 *
 * `resize` 会把这个框**完整装进画面**，然后相机按 `CAM_POL` 俯视。
 * 因为框是「宽度主导」的，玻璃区会横向铺满 —— 这就是原版那种「贴着柜子站」的观感。
 */
const FRAME = {
  minX: -(HX + 0.05),
  maxX: HX + 0.05,
  minY: -0.72,
  maxY: GLASS_H + 0.22,
  minZ: -(HZ + 0.05),
  maxZ: HZ + 0.05,
}
const FRAME_W = FRAME.maxX - FRAME.minX
const FRAME_H = FRAME.maxY - FRAME.minY

/**
 * 取景留白：框最多占画面的 `1 / FIT_MARGIN`（约 97%）。
 *
 * 不设的话迭代会停在「刚好贴边」上 —— 实测底边离画布只剩 4px，
 * 换个 DPR 或者柜子高一点点就越界。
 */
const FIT_MARGIN = 1.03

/** 三档主题色。和参考实现一样给 3 个，默认第一个（粉）。 */
export const CLAW_THEMES = [
  { accent: 0xf47aa8, led: 0xff7ab0, name: '粉' },
  { accent: 0xf5c52a, led: 0xffd23a, name: '黄' },
  { accent: 0x3ec8d8, led: 0x4fd8e8, name: '青' },
] as const

/* ============================ 小工具 ============================ */

/** `0xf47aa8` → `'#f47aa8'`。给 canvas 画贴图用（`fillStyle` 只吃字符串）。 */
function hexOf(n: number): string {
  return `#${(n >>> 0).toString(16).padStart(6, '0')}`
}

/**
 * 把 canvas 画成贴图。**唯一一张贴图** —— 灯箱上的字。
 * 程序化生成（不落盘图片），和本项目「图片零落盘」的口径一致。
 */
/**
 * 柜内背板（贴纸）。
 *
 * ★ 参考实现里玻璃柜背面是一张**印好的海报**。没有它的话，柜子内部就是
 * 场景背景色 —— 一片惨白的空盒子，玩具只占底下一条
 * （2026-10-16 走查截图确认过：上半截全是空的）。
 *
 * canvas 画：竖向渐变 + 波点墙纸 + 底边一条主题色。
 *
 * ⚠️ 第一版中间画了一「团云」（一个大白圆）。结果它太大太白，在截图里
 * 读起来**还是一片空白** —— 白圆在浅粉底上等于没有图案。
 * 波点不一样：它是**重复的小图案**，一眼就能看出「这是有意画的」。
 *
 * ⚠️ 颜色**要够实**。柜内那盏点光源 + ACES 色调映射会把这里整体提亮一档，
 * 所以按「会被提亮」来挑色（第一版的「白 → #f6d9e5」实测被洗成全白）。
 *
 * ⚠️ **不写字** —— 「爪爪乐」已经在灯箱上了，背板再写一遍是同一件事说两遍。
 */
function makeBackdropTexture(accent: number): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, c.height)
    grad.addColorStop(0, '#f8c6dc')
    grad.addColorStop(0.55, '#f3aecd')
    grad.addColorStop(1, '#ea93bb')
    g.fillStyle = grad
    g.fillRect(0, 0, c.width, c.height)

    // 波点墙纸：交错排列（相邻行错开半个间距），看着比正方格柔和
    g.fillStyle = 'rgba(255,255,255,.42)'
    const step = 68
    for (let row = 0, y = 30; y < c.height - 34; row++, y += step) {
      const offset = (row % 2) * (step / 2)
      for (let x = 30 + offset; x < c.width; x += step) {
        g.beginPath()
        g.arc(x, y, 13, 0, Math.PI * 2)
        g.fill()
      }
    }

    // 底边一条主题色带子 —— 把背板和柜体绑在一起
    g.fillStyle = `#${(accent >>> 0).toString(16).padStart(6, '0')}`
    g.fillRect(0, c.height - 34, c.width, 34)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

function makeSignTexture(text: string, bg: string, fg: string): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = bg
    g.fillRect(0, 0, c.width, c.height)
    g.fillStyle = 'rgba(255,255,255,.22)'
    g.fillRect(0, 0, c.width, 18)
    g.fillStyle = fg
    g.font = 'bold 150px "PingFang SC","Microsoft YaHei",sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(text, c.width / 2, c.height / 2 + 8)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/**
 * 商场地面贴图 —— 淡紫灰地砖。
 *
 * ★ 为什么要地砖而不是一整块纯色：柜子两侧在横屏下会露出 200~330px 的空白
 *   （实测：phone-landscape 左右各 218px、desktop 各 332px）。纯色读起来像
 *   「3D 没加载完」；有透视收敛的地砖线，那块空白立刻变成「站在商场里」。
 *   参考实现用的就是 tile 贴图（`floorTiles()`），同一个理由。
 *
 * ⚠️ 颜色是**量出来的，不是调出来的**。第一版取 `#d7d1e2`（"只比背景深一点"），
 *   截图取样一看：墙 L=198 / 地板 L=195 / 柜身 L=200 —— 三个数挤在 5 级以内，
 *   等于没有分层，整个画面糊成一团奶白。现在这组让地板比柜身低 25~40 级，
 *   白柜子才立得住。
 *   ➜ 以后改这三个颜色，改完**取像素比一下**，别只看截图"感觉还行"
 *     （`.e2e-scratch/sample-px.mjs` 就是干这个的）。
 */
function makeRoomFloorTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')
  if (g) {
    g.fillStyle = '#9a93ab'
    g.fillRect(0, 0, c.width, c.height)
    // 砖缝
    g.strokeStyle = '#837c96'
    g.lineWidth = 2
    for (let i = 0; i <= c.width; i += 64) {
      g.beginPath()
      g.moveTo(i, 0)
      g.lineTo(i, c.height)
      g.stroke()
      g.beginPath()
      g.moveTo(0, i)
      g.lineTo(c.width, i)
      g.stroke()
    }
    // 每块砖里一点极淡的斑驳，免得 16 块砖看着像复制粘贴
    g.fillStyle = 'rgba(255,255,255,.14)'
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if ((row * 4 + col) % 3 !== 0) continue
        g.fillRect(col * 64 + 10, row * 64 + 10, 44, 44)
      }
    }
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  return t
}

/**
 * 商场后墙 —— 竖向渐变 + 一条踢脚线。
 *
 * ⚠️ 墙**必须比地板亮**，而且上下要有渐变。纯色墙 + 纯色地板在截图里会糊成
 *   一整片，看不出「这是两面墙」，反而比原来的纯背景更糊。
 */
function makeRoomWallTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 256
  const g = c.getContext('2d')
  if (g) {
    // ⚠️ canvas 的 y 轴向下，而 plane 的 uv 是向上 —— 所以「顶部亮」要画在 y=0
    const grad = g.createLinearGradient(0, 0, 0, c.height)
    grad.addColorStop(0, '#c2bcd1')
    grad.addColorStop(1, '#a79fb9')
    g.fillStyle = grad
    g.fillRect(0, 0, c.width, c.height)
    // 踢脚线（贴地的最后 6%）
    g.fillStyle = '#8b8499'
    g.fillRect(0, c.height - 15, c.width, 15)
  }
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/* ---------------- 娃娃的布料：绒毛法线 + 纤维斑驳 + 缝线 ---------------- */

/**
 * 定种子伪随机。
 *
 * ★ 贴图噪声**不用 `Math.random()`**：走查脚本会采样像素判断「这一块是不是白成一片」，
 *   每次刷新都换一套噪点，改前 / 改后的数字就没法比。
 *   （游戏逻辑那边禁 `Math.random()` 是另一条理由：结算必须幂等。）
 */
function seeded(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function blankCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')!]
}

/**
 * 高度图 → 切线空间法线贴图。
 *
 * 为什么现算而不是引一张 png：整个娃娃机都是**程序生成**的（无外部贴图资源），
 * 这样 APK 不会因为漏打包一张图而变成一堆白球。
 */
function heightToNormal(src: HTMLCanvasElement, strength: number): CanvasTexture {
  const w = src.width
  const h = src.height
  const sd = src.getContext('2d')!.getImageData(0, 0, w, h).data
  const [c, g] = blankCanvas(w, h)
  const out = g.createImageData(w, h)
  // 取高度时**环绕取模**：贴图是平铺的，边界上的斜率必须接得上，否则平铺缝处会出现一圈硬边
  const H = (x: number, y: number) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * w + x) * 4
      out.data[i] = (-dx / l) * 0.5 * 255 + 127.5
      out.data[i + 1] = (dy / l) * 0.5 * 255 + 127.5
      out.data[i + 2] = (1 / l) * 0.5 * 255 + 127.5
      out.data[i + 3] = 255
    }
  }
  g.putImageData(out, 0, 0)
  const t = new CanvasTexture(c)
  t.wrapS = RepeatWrapping
  t.wrapT = RepeatWrapping
  return t
}

let fabricN: CanvasTexture | null = null

/** 绒毛纤维的法线 —— 「毛绒」和「塑料球」之间最主要的差别就在这张图上。 */
function fabricNormal(): CanvasTexture {
  if (fabricN) return fabricN
  const S = 256
  const [c, g] = blankCanvas(S, S)
  // 底色 #808080 = 高度 0.5（法线朝正前方），纤维才是在它上面起伏
  g.fillStyle = '#808080'
  g.fillRect(0, 0, S, S)
  g.lineCap = 'round'
  const rnd = seeded(0x5eed)
  for (let i = 0; i < 5000; i++) {
    const x = rnd() * S
    const y = rnd() * S
    const a = rnd() * Math.PI * 2
    const l = 2 + rnd() * 6
    const v = Math.floor(90 + rnd() * 90)
    g.strokeStyle = `rgba(${v},${v},${v},0.55)`
    g.lineWidth = 0.6 + rnd()
    // ★ 九宫格各画一遍（-S / 0 / +S）：纤维跨过边界时另一侧要接得上，
    //   只画中间那格的话，平铺后每隔一格能看到一条**没有纤维的空缝**
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

let fabricD: CanvasTexture | null = null

/** 纤维斑驳 + 两侧缝线（球 UV 的 u=0 / 0.5 / 1 正好落在侧面，缝线就该在那儿）。 */
function fabricDetail(): CanvasTexture {
  if (fabricD) return fabricD
  const W = 512
  const H = 256
  const [c, g] = blankCanvas(W, H)
  // 底是近白不是纯白：`map` 会和底色相乘，纯白等于「没有贴图」
  g.fillStyle = '#f4f4f4'
  g.fillRect(0, 0, W, H)
  const rnd = seeded(0xfab2)
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
    // 缝线：一针一针斜着走，不是一条直线
    g.strokeStyle = 'rgba(70,50,50,0.45)'
    g.lineWidth = 1.4
    for (let y = 6; y < H - 6; y += 7) {
      g.beginPath()
      g.moveTo(x - 3.5, y)
      g.lineTo(x + 3.5, y + 3)
      g.stroke()
    }
  }
  fabricD = new CanvasTexture(c)
  fabricD.colorSpace = SRGBColorSpace
  fabricD.anisotropy = 4
  fabricD.wrapS = RepeatWrapping
  return fabricD
}

const PLUSH_WHITE = new Color(0xffffff)
/** 同色只建一次材质（一只娃娃 3 个材质 × 12 只 = 36 个，没必要） */
const plushMats = new Map<string, MeshPhysicalMaterial>()

/**
 * 娃娃的毛绒材质。
 *
 * ★★ 为什么不是 `MeshStandardMaterial({ roughness: 0.95 })`：那在屏幕上是**哑光塑料球**
 *    —— 表面没有任何可分辨的细节，40px 宽时只剩一团淡色。
 *    参考实现看着「渲染很好」，靠的就是这三样：
 *    ① `sheen` —— 逆光时边缘一圈绒光，绒毛和光滑球的分界线就在这里；
 *    ② `normalMap` —— 纤维起伏把高光打碎成一片，而不是一个干净的圆斑；
 *    ③ `map` —— 纤维斑驳 + 两侧缝线（只有身体要，肚皮 / 耳朵内侧是光面布）。
 */
function plushMaterial(color: number, seams: boolean): MeshPhysicalMaterial {
  const key = `${color}:${seams ? 1 : 0}`
  const hit = plushMats.get(key)
  if (hit) return hit
  const c = new Color(color)
  const m = new MeshPhysicalMaterial({
    color: c,
    roughness: 0.96,
    metalness: 0,
    sheen: 0.8,
    sheenRoughness: 0.5,
    // sheen 颜色比底色亮 30%：和底色同色的话，绒边在亮背景上根本看不见
    sheenColor: c.clone().lerp(PLUSH_WHITE, 0.3),
    normalMap: fabricNormal(),
    normalScale: new Vector2(0.5, 0.5),
    ...(seams ? { map: fabricDetail() } : {}),
  })
  plushMats.set(key, m)
  return m
}

/** 一只娃娃：身体 + 两只耳朵 + 眼睛 + 鼻子。用基本体拼，够认出来就行。 */
function makePlush(color: number, body: number, ear: number, seed: number): Group {
  const g = new Group()
  const fur = plushMaterial(color, true)
  const dark = new MeshStandardMaterial({ color: 0x2a2430, roughness: 0.6 })
  const bodyMat = plushMaterial(body, false)

  // 身体（压扁一点，坐着的形状）
  const b = new Mesh(new SphereGeometry(0.075, 18, 14), fur)
  b.scale.set(1, 0.88, 0.94)
  b.position.y = 0.066
  g.add(b)
  // 肚皮
  const belly = new Mesh(new SphereGeometry(0.048, 14, 12), bodyMat)
  belly.scale.set(1, 0.85, 0.6)
  belly.position.set(0, 0.055, 0.05)
  g.add(belly)
  // 耳朵
  for (const s of [-1, 1]) {
    const e = new Mesh(new SphereGeometry(0.03, 12, 10), fur)
    e.scale.set(0.85, 1, 0.6)
    e.position.set(s * 0.048, 0.13, -0.004)
    e.rotation.z = s * 0.25
    g.add(e)
    const inner = new Mesh(new SphereGeometry(0.017, 10, 8), bodyMat)
    inner.scale.set(0.8, 1, 0.5)
    inner.position.set(s * 0.05, 0.132, 0.014)
    inner.rotation.z = s * 0.25
    g.add(inner)
    void ear
  }
  // 眼睛
  for (const s of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.011, 10, 8), dark)
    eye.position.set(s * 0.028, 0.088, 0.063)
    g.add(eye)
  }
  // 鼻子
  const nose = new Mesh(new SphereGeometry(0.009, 10, 8), dark)
  nose.scale.set(1.25, 0.8, 0.8)
  nose.position.set(0, 0.062, 0.072)
  g.add(nose)

  // 每只歪一点点，看着不像复制粘贴
  const r = (n: number) => {
    const x = Math.sin((seed + n) * 12.9898) * 43758.5453
    return x - Math.floor(x)
  }
  g.rotation.y = (r(1) - 0.5) * 1.4
  g.scale.setScalar(0.92 + r(2) * 0.16)
  return g
}

/** 娃娃的配色。名字只给走查脚本 / 无障碍用，界面上不显示。 */
const PLUSH_KINDS = [
  { name: '粉兔', fur: 0xf2a7c0, belly: 0xfff1f5 },
  { name: '奶熊', fur: 0xf7d9a8, belly: 0xfff6e6 },
  { name: '小鸭', fur: 0xf5d36a, belly: 0xfff3c4 },
  { name: '蓝鲸', fur: 0x9fd8e8, belly: 0xe6f7fb },
  { name: '紫喵', fur: 0xb9a6e8, belly: 0xefe9ff },
  { name: '白云', fur: 0xeceff5, belly: 0xffffff },
] as const

/**
 * 娃娃在池子里的初始布局。**确定性**（走查脚本要能稳定复现）。
 *
 * ★★ 堆成**三层**，不是平铺一层。
 *
 * 参考实现里池子是**满**的（约 40 只堆成一个小山），因为那正是娃娃机的卖点
 * ——「一池子娃娃」。第一版平铺了一层 17 只、还都贴着地板，玻璃柜看上去就是
 * 个**空盒子**（2026-10-16 截图确认：娃娃只占柜子高度的一成）。
 *
 * ⚠️ 不用物理沉降（那要多引 1.65MB 的 Rapier，见文件头），所以三层是**手写**的：
 * 下密上疏、逐层错开、每层收窄一点 —— 看着像个堆，位置全确定，脚本不会抖。
 *
 * ⚠️ `y` 一定要跟着返回：调用方以前写死 `0.004`，三层就叠不起来了。
 */
function initialPrizeLayout(): { x: number; z: number; y: number; kind: number; seed: number }[] {
  const out: { x: number; z: number; y: number; kind: number; seed: number }[] = []
  let n = 0
  /** 每层：[横向收窄系数, 高度, 列数, 行数] */
  const LAYERS: [number, number, number, number][] = [
    [1.0, 0.004, 5, 4],
    [0.8, 0.115, 4, 3],
    [0.58, 0.225, 3, 2],
  ]
  for (const [k, y, cols, rows] of LAYERS) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x =
          ((c - (cols - 1) / 2) / Math.max(1, cols - 1)) * 2 * 0.44 * k + (r % 2) * 0.03 * k
        const z = ((r - (rows - 1) / 2) / Math.max(1, rows - 1)) * 2 * 0.36 * k
        // 让开取物口
        if (x > HOLE.x0 - 0.1 && z > HOLE.z0 - 0.1) continue
        out.push({ x, z, y, kind: n % PLUSH_KINDS.length, seed: n * 7 + 3 })
        n++
      }
    }
  }
  return out
}

/* ============================ 对外接口 ============================ */

/** 爪子 / 娃娃的**视觉状态**。页面每帧算好传进来，这里只负责摆。 */
export interface ClawVisual {
  /** 爪子中心（世界坐标 x / z），以及 hub 的高度 y */
  clawX: number
  clawZ: number
  hubY: number
  /** 合爪程度：0 = 完全张开，1 = 完全合上 */
  close: number
  /**
   * 张开程度：`0.35` = 待命（微张），`1` = 下爪时张到最大。
   *
   * ⚠️ 不能只用 `close` 表达：`close` 在「待命」和「下爪」时都是 0，
   * 而这两种状态要的姿势不一样（待命微张 / 下爪全张）。
   */
  spread: number
  /** 正被爪子夹着的那只娃娃的下标；没有就是 null */
  held: number | null
  /** 取物口灯闪烁（抓到那一刻） */
  winFlash: number
  /** 爪子是不是在下爪/提起（用来决定电机声和轻微抖动） */
  busy: boolean
}

export interface ClawStage {
  /** 每帧调一次。`t` 是秒（做 LED 呼吸用），`reducedMotion` 时停掉动画但保留静态姿势。 */
  render(t: number, v: ClawVisual, reducedMotion: boolean): void
  /** 容器尺寸变了要调（内部也挂了 ResizeObserver，一般不用手动调） */
  resize(): void
  /** ★ 必须调 —— 不调会漏 GPU 显存（几何 / 材质 / 贴图 / renderer 都要 dispose） */
  dispose(): void
  /**
   * 给走查脚本用：把柜子的包围盒**投影到画布坐标**。
   *
   * 用来断言「柜子完整在容器里」（contain 取景的核心判据）。
   * 靠肉眼截图看「好像没被裁」不算证据 —— 这里给的是可断言的数字。
   */
  debugFrame(): {
    /** ★ 判据：玻璃区必须**完整**在画布内，而且横向要铺满 */
    glass: { left: number; top: number; right: number; bottom: number }
    /** 取景框（必须完整可见的那块） */
    frame: { left: number; top: number; right: number; bottom: number }
    /** 整台机器 —— **允许越界**（原版就是裁掉底座的） */
    cabinet: { left: number; top: number; right: number; bottom: number }
    canvas: { w: number; h: number }
    dpr: number
    /** 商场房间（地板 + 后墙）这一档开没开 —— 只在两侧有空白时开，见 `resize()` */
    roomVisible: boolean
    /**
     * 阴影贴图一个 texel 覆盖多少世界单位（从实际投影矩阵反推）。
     * ★ 忘了 `shadow.camera.updateProjectionMatrix()` 时它会变成 0.0098 而不是 0.0008。
     */
    shadowTexel: number
  }
  /** 走查脚本用：娃娃数量 */
  prizeCount(): number
  /**
   * 指头**实际**摆到的角度（弧度，`prongInners[0].rotation.z`）。
   *
   * ★ 为什么单独给一个：`debugVisual()` 报的是页面**传进来**的 `close` ——
   *   那是**意图**，不是画面。`applyProngs()` 里还有「夹着娃娃就合到 0.86
   *   为止」这种换算，光看 `close` 分不出「指头真的转了」和「参数变了但没画」。
   *   只有这个数能证明指头**真的扫过那 70°**。
   */
  debugProng(): number
  /**
   * 离 `(x, z)` 最近的娃娃下标，一个都没有就是 `-1`。
   *
   * 页面用它来区分「夹住了又滑掉」和「压根没夹到」——
   * 两句给孩子的话不一样（`clawTimeline.ts` 的 `clawOutcomeText`）。
   *
   * ⚠️ 比的是娃娃的**静止位置**，不是动画中的位置 ——
   * 问的是「下爪那一刻底下有没有东西」。
   */
  nearestPrize(x: number, z: number): { index: number; dist: number }
  /**
   * 第 `index` 只娃娃**静止时**的位置；越界返回 `null`。
   *
   * 页面在「中了但没对准」时用它把下爪点挪到最近的娃娃上 ——
   * 不挪的话爪子会在半空合上、娃娃**瞬移**到爪子里（`render` 里
   * 被夹住的那只是直接 `position.set` 过去的），那一跳很显眼。
   */
  prizeAt(index: number): { x: number; z: number } | null
  /**
   * `(x, z)` 正下方最高的那个面（娃娃顶 / 池底）的高度。
   *
   * 页面用它算「这一局爪子下到多深」—— 原版是探出来的（`probeSurface()`），
   * 不是写死一个高度。写死的话，对着空地按下去爪子会**悬在半空合爪**，
   * 那正是「下钩差很多」里最显眼的一条。
   */
  surfaceAt(x: number, z: number): number
  /**
   * 屏幕坐标（`clientX/clientY`）→ 池子里的世界坐标。
   *
   * 给「拖着爪子瞄准」用。超出池子会被**夹在池子边缘**（不能把爪子拖到玻璃外面）。
   *
   * ⚠️ 这里用的是**线性映射**（把池底矩形投影到屏幕再按比例换算），
   * 不是射线求交。相机基本是正对的，透视误差很小，瞄准够用；
   * 换成 raycaster 会更准，但要多引一个模块，不值得。
   */
  fieldFromScreen(clientX: number, clientY: number): { x: number; z: number }
  /**
   * 换配色（`0..CLAW_THEMES.length-1`）。越界会取模，调用方不用自己夹。
   *
   * ★ 换的不只是柜身的 `accent`，还包括 **LED 灯带 / 灯箱 / 背板** ——
   * 后两个是画在 canvas 上的贴图，只改材质色不会跟着变。
   */
  setTheme(index: number): void
  /** 当前配色下标。走查脚本用它断言「换色真的生效了」，不靠看截图。 */
  themeIndex(): number
  /**
   * 走查脚本用：**这一帧到底开了哪些效果**。
   *
   * ★ 为什么需要它：「代码里写了 `shadowMap.enabled = true`」和
   * 「运行时真的开着」是两件事 —— 后者才决定孩子看到什么。
   * 有了它就能断言，而不用去比截图（截图逐字节比对本来就不稳）。
   */
  debugEffects(): {
    /** 阴影渲染开没开 */
    shadows: boolean
    /** 有多少个 mesh 真的在投影（= 0 说明遍历没生效） */
    shadowCasters: number
    /** 环境贴图挂上了没 */
    envMap: boolean
    /** 后处理链在不在（低端机会退化成直接 render） */
    post: boolean
    /** 当前配色下标 */
    theme: number
  }
  /**
   * 走查脚本用：**最后一帧收到的视觉状态**。
   *
   * 断言「摇杆 / 键盘真的把爪子挪了」只能靠它 —— `ClawVisual` 是页面算完
   * 传进来的，DOM 里读不到，而截图只能证明「看起来动了一点」。
   */
  debugVisual(): ClawVisual | null
  /**
   * 走查脚本用：**物理层到底在不在跑**。
   *
   * ★ 必须能区分三种状态，否则「物理没起来」会被看成「物理没问题」：
   *   · `loading` —— 还在下载 755 KB 的 chunk（正常，前 1 秒）
   *   · `failed`  —— 起不来，已经退回静态摆放（**能玩，但没有物理**）
   *   · `ready`   —— 真的在跑，`bodies` / `awake` 才有意义
   */
  debugPhysics(): {
    state: 'loading' | 'ready' | 'failed' | 'off'
    bodies: number
    /** 手里有没有东西（球铰建起来没有） */
    held: boolean
    /** 还醒着的刚体数 —— 全睡了说明模拟真的停了 */
    awake: number
    /** 掉进通道、被放回池子的次数 */
    recycled: number
    steps: number
    error: string
  }
}

/**
 * 建场景。**WebGL 起不来就返回 `null`**（别抛 —— 宿主那边要能优雅降级）。
 */
export function createClawStage(container: HTMLElement): ClawStage | null {
  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  } catch {
    return null
  }

  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(x: T): T => {
    disposables.push(x)
    return x
  }

  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  canvas.style.touchAction = 'none'
  container.appendChild(canvas)

  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.0

  /*
    阴影 —— 2026-10-17 补上。

    ★ 这一条是「看着不 3D」的最大单一原因：没有接触阴影时，娃娃之间、
      娃娃和底板之间全是悬空的，大脑会把「没有落地感」读成「像贴纸」。
      之前只有直射光造成的明暗，没有投影。

    ⚠️ 用 `PCFSoftShadowMap` 不是 `PCFShadowMap`：后者边缘是硬锯齿，
      在这么小的柜子里（1.16 × 1.0 世界单位）尤其明显。
    ⚠️ 阴影贴图**只有一张**（key light），别给每个灯都开 —— 手机上每多一张
      就是一次完整的额外渲染。
  */
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap

  const scene = new Scene()
  scene.background = new Color(0xe9e6f2)

  /*
    环境贴图 —— 2026-10-17 补上。

    ★ 为什么这条比「加更多灯」有用：`MeshPhysicalMaterial` 的 `clearcoat`
      和玻璃的反射**需要一个环境去反射**。没有 `scene.environment` 时，
      clearcoat 的高光只能来自直射光 ⇒ 整片糊成一块死白。
      这正是旧代码里那句注释的根因：「clearcoat 从 1 降到 0.4：整面玻璃上
      那层清漆高光会糊成一大片白」—— 当时是**压参数掩盖症状**，现在治根。

    `RoomEnvironment` 是程序生成的（无外部贴图、离线可用），
    经 `PMREMGenerator` 预卷积成 mipmap 链。只生成一次，之后零成本。
  */
  const pmrem = new PMREMGenerator(renderer)
  const roomEnv = new RoomEnvironment()
  const envRT = pmrem.fromScene(roomEnv, 0.04)
  scene.environment = envRT.texture
  // 0.55：够让白柜子和玻璃有层次，又不至于把暖色灯光冲淡
  scene.environmentIntensity = 0.55

  const camera = new PerspectiveCamera(FOV, 1, 0.05, 40)
  camera.position.set(0, LOOK_Y, 4)

  // 取景距离：resize 算完 contain-fit 后存到这里，render 的「呼吸」微动要拿它当基准
  let cameraDist = 4
  // 中奖特写的缓动值（host 给的 `winFlash` 是二值的，这里自己缓动一下，避免中奖瞬间硬切）
  let winZoom = 0

  /* ---------------- 灯光：暖顶光 + 柜内冷白 ---------------- */
  /*
    光照按参考实现的量级重调过（2026-10-17）。

    ★ 之前环境光是 **1.5**，参考实现是 **0.55**。环境光不是「越亮越清楚」——
      它会把所有阴影**填平**，柜子就没有体积感了，看着发灰。
      加了阴影之后这一点尤其明显：环境光一高，影子淡到看不见。
  */
  scene.add(new HemisphereLight(0xfff5f0, 0xc8c0b8, 0.3))
  const key = new DirectionalLight(0xfff8f2, 2.6)
  /*
    ★ 主光放**正上方**（参考实现是 0.05, 3.2, 0.35），不是斜前方。
    影子垂直落在娃娃正下方 ⇒ 看得出「一层层堆起来」；
    侧光会把影子拉成长条，堆叠关系反而糊。
  */
  key.position.set(0.05, 3.2, 0.35)
  scene.add(key)

  /*
    只让主光投影。正交阴影相机要**刚好裹住柜子**：

    ★★ 2026-10-18：这里原来是 `±1.35 / ±1.7`（2.7 × 3.4 的范围），而柜子只有
       **1.24 × 1.1** —— 等于把 1024² 的贴图摊到 5 倍的面积上，一个 texel 覆盖
       2.6mm，娃娃（0.15 宽）只有 57 个 texel。后果不是「影子糊一点」，
       而是**娃娃之间根本没有可辨认的接触阴影**，整池娃娃看着像漂着。
       参考实现是 `±0.62 / ±0.55` + 2048²（texel 密度是我们的 **4.4 倍**）。

    ➜ 现在收紧到 `±0.8`（外框 + 一点余量）+ 2048² ⇒ texel 从 2.6mm 降到 0.8mm。
      **别再放大范围**：范围一大，同一张 map 摊得更薄，接触阴影立刻消失，
      而画面整体亮度几乎不变 —— 这种退化在截图上是「看不出哪里变了」。
    near / far 只包住柜子在光轴上的跨度（光在 y=3.2，柜顶 1.5、柜底 -1.0）。
  */
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.near = 1.2
  key.shadow.camera.far = 5.2
  key.shadow.camera.left = -0.8
  key.shadow.camera.right = 0.8
  key.shadow.camera.top = 0.8
  key.shadow.camera.bottom = -0.8
  // bias 处理自阴影（acne）；normalBias 处理薄面（灯带 / 玻璃框）上的漏光
  key.shadow.bias = -0.0006
  // 0.012（参考实现的数）：texel 变细之后，normalBias 给大了会让影子**整体离开物体**
  key.shadow.normalBias = 0.012
  /*
    ★★★ 这一行**不能删**，删了上面六个数字全部作废。

    three 的 `LightShadow` **不会**在渲染前更新阴影相机的投影矩阵 ——
    `OrthographicCamera` 只在构造时算一次（默认 `-5..5 / -5..5 / 0.5..500`）。
    所以只写 `camera.left = -0.8` 而不调这个函数，阴影贴图**仍然铺在 10×10 的范围上**：
    1024² ⇒ 一个 texel 覆盖 **9.8mm**，而娃娃只有 150mm 宽 = 15 个 texel
    ⇒ 娃娃之间**不可能有可辨认的接触阴影**，整池看着像漂着。
    （2026-10-18 就是靠这条查出来的：改了范围却量不出任何变化。）
    ➜ 改完范围必须紧接着调一次；`debugFrame().shadowTexel` 会把它暴露出来。
  */
  key.shadow.camera.updateProjectionMatrix()
  const fill = new DirectionalLight(0xffe8f0, 0.4)
  fill.position.set(-0.8, 2.6, 3.2)
  scene.add(fill)
  /*
    柜内顶灯 —— **SpotLight 不是 PointLight**。

    ★ PointLight 是全向的：它把娃娃堆正面照得很平。SpotLight 有 `distance` + `decay`，
      光落成一个**池子**，池边和娃娃缝隙自然暗下去。参考实现就是
      `SpotLight(0xfff5fa, 2.8, 2.2, 1.0, 0.8, 1.5)`，角度 1.0rad ≈ 57°、
      penumbra 0.8（池边是渐变不是硬圈）。

    ★★ 但**换成 SpotLight 只挪了一点点**：娃娃堆 p5 从 0.545 到 0.533。
      原因不是灯的形状，是**光比** —— 全场景只有主光投影，其余四盏
      （柜内灯 / 半球 / 环境 / 补光）都是**不投影的平光**：
      影子里的娃娃照样能收到约 70% 的光，影子当然看不见。
      ➜ 所以这里把柜内灯从 2.8 降到 **1.5**，同时半球 0.5→0.3、补光 0.7→0.4、
        主光 1.9→2.6：让「会投影的那盏」在总量里占大头。
      **别只盯着单盏灯的绝对值** —— 决定层次的是投影光 : 平光的比例。
  */
  const inner = new SpotLight(0xfff5fa, 1.5, 2.2, 1.0, 0.8, 1.5)
  inner.position.set(0, GLASS_H - 0.03, 0.3)
  // target 必须一起进场景，否则它的世界矩阵不更新，光会一直朝原点外的默认方向打
  scene.add(inner, inner.target)

  /* ---------------- 材质 ---------------- */
  const M = {
    body: track(
      new MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.22,
        metalness: 0.05,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18,
      }),
    ),
    accent: track(new MeshPhysicalMaterial({ color: CLAW_THEMES[0].accent, roughness: 0.28, clearcoat: 0.7 })),
    alu: track(new MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.28, metalness: 0.95 })),
    chrome: track(new MeshStandardMaterial({ color: 0xe0e2e6, roughness: 0.18, metalness: 1 })),
    steel: track(new MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.35, metalness: 0.92 })),
    dark: track(new MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 })),
    blackPlastic: track(new MeshStandardMaterial({ color: 0x222226, roughness: 0.55 })),
    /*
      池底垫子。参考实现是一块**蓝灰色的地垫**。
      ⚠️ 原来是草绿（`0x6f8f66`）—— 在一池粉紫娃娃底下铺一块草地绿，
      截图里很跳（2026-10-16 走查确认）。换成冷灰蓝，和暖色的柜体、娃娃分开。
      ★ 2026-10-18 又压暗了一档（`0x93a1b0` → `0x6d7889`）：娃娃是**浅色**的，
        垫子也是浅灰时两者之间没有明度差，整池看上去是「一坨浅色的东西」。
        垫子压暗之后，娃娃的轮廓才立得住 —— 这也是参考版那块深色垫子的作用。
    */
    felt: track(new MeshStandardMaterial({ color: 0x6d7889, roughness: 0.97 })),
    glass: track(
      new MeshPhysicalMaterial({
        color: 0xe8f2f0,
        roughness: 0.06,
        metalness: 0,
        transparent: true,
        /*
          ★★ 0.10 → 0.05（2026-10-18）。玻璃是**整面均匀**蒙在柜子上的：
            每多 1% 不透明度，里面所有东西就统一降 1% 对比度，而且是**一层雾**。
            参考实现的 `glassTint` 只有 **0.04**，它的「玻璃感」来自局部的
            污渍 / 反射贴图，不是整面调不透明度。
            ⚠️ 别再往上调：调到 0.10 时，背板和娃娃看上去像隔着一层毛玻璃，
              而那正是「渲染不好」最直接的那个观感。
        */
        opacity: 0.05,
        depthWrite: false,
        side: 2,
        /*
          clearcoat 1 → 0.4（2026-10-17）→ **0.15**（2026-10-18）。

          两层原因叠在一起：① 清漆高光在整面玻璃上糊成一片白，把柜内洗白；
          ② 加了 `scene.environment` 之后，玻璃还会**反射环境贴图**，
             两股高光叠加 ⇒ 上半截直接是一片白。0.15 只留一道若有若无的光。
        */
        clearcoat: 0.15,
        clearcoatRoughness: 0.06,
      }),
    ),
    led: track(new MeshStandardMaterial({ color: 0x111111, emissive: CLAW_THEMES[0].led, emissiveIntensity: 1.8 })),
    lamp: track(new MeshStandardMaterial({ color: 0x222222, emissive: CLAW_THEMES[0].led, emissiveIntensity: 0.4 })),
    tube: track(new MeshStandardMaterial({ color: 0x000000, emissive: 0xf5f8ff, emissiveIntensity: 2.6 })),
  }

  const root = new Group()
  scene.add(root)

  const add = <T extends Mesh>(m: T, parent: Group = root): T => {
    parent.add(m)
    return m
  }
  const box = (w: number, h: number, d: number, mat: MeshStandardMaterial | MeshPhysicalMaterial, x: number, y: number, z: number, parent?: Group) =>
    add(new Mesh(track(new BoxGeometry(w, h, d)), mat), parent).translateX(x).translateY(y).translateZ(z)

  /* ---------------- 下半柜体 ---------------- */
  {
    const b = new Mesh(track(new RoundedBoxGeometry(HX * 2, BODY_H - 0.01, HZ * 2 - 0.28, 4, 0.02)), M.body)
    b.position.set(0, -BODY_H / 2, -0.14)
    add(b)
    // 前脸
    const f = new Mesh(track(new RoundedBoxGeometry(HX * 2, BODY_H - 0.12, 0.26, 3, 0.015)), M.body)
    f.position.set(0, -BODY_H / 2 + 0.04, HZ - 0.16)
    add(f)
    /*
      取物口：黑洞 + LED 圆环。

      ★★ z 值不能再改回 `HZ - 0.03`。上面那块前脸 `f` 是**深度 0.26 的盒子**，
         放在 `HZ - 0.16` ⇒ 它的正面正好落在 `HZ - 0.03`，和原来的圆片**完全共面**。
         两个共面片抢深度缓冲，画出来就是一块**黑白棋盘**（走查图里左下那个圆
         看着像贴图坏了，其实就是这个）。
      ➜ 圆片往前挪 0.012、圆环再往前 0.006。0.012 个世界单位在柜子（宽 1.16）上
         不到 1 像素，肉眼看不出来，但足够让深度分出先后。
    */
    const hole = new Mesh(track(new CircleGeometry(0.19, 32)), M.dark)
    hole.position.set(-HX + 0.28, -0.52, HZ - 0.018)
    add(hole)
    const ring = new Mesh(track(new TorusGeometry(0.225, 0.022, 12, 44)), M.lamp)
    ring.position.set(-HX + 0.28, -0.52, HZ - 0.012)
    add(ring)
    // 控制台
    const ledge = new Mesh(track(new RoundedBoxGeometry(HX * 1.45, 0.08, 0.22, 3, 0.03)), M.accent)
    ledge.position.set(0, -0.02, HZ + 0.06)
    ledge.rotation.x = 0.12
    add(ledge)
    // 摇杆 + 红按钮（纯装饰 —— 真的操作在 DOM 上，触控目标才够大）
    const stick = new Mesh(track(new CylinderGeometry(0.006, 0.006, 0.08, 10)), M.steel)
    stick.position.set(-0.16, 0.06, HZ + 0.06)
    add(stick)
    const ball = new Mesh(track(new SphereGeometry(0.022, 20, 14)), M.accent)
    ball.position.set(-0.16, 0.105, HZ + 0.06)
    add(ball)
    const btn = new Mesh(track(new CylinderGeometry(0.04, 0.042, 0.016, 28)), M.lamp)
    btn.position.set(0.14, 0.03, HZ + 0.06)
    btn.rotation.x = 0.12
    add(btn)
  }

  /* ---------------- 立柱 + LED 灯带 ---------------- */
  const ledStrips: Mesh[] = []
  {
    const post = track(new RoundedBoxGeometry(0.04, GLASS_H + 0.02, 0.04, 2, 0.005))
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = new Mesh(post, M.alu)
        p.position.set(sx * (HX + 0.02), GLASS_H / 2, sz * (HZ + 0.02))
        add(p)
      }
    }
    const stripGeo = track(new BoxGeometry(0.012, GLASS_H - 0.04, 0.012))
    for (const sx of [-1, 1]) {
      const s = new Mesh(stripGeo, M.led)
      s.position.set(sx * (HX + 0.006), GLASS_H / 2, HZ + 0.008)
      add(s)
      ledStrips.push(s)
    }
    const hGeo = track(new BoxGeometry(HX * 2 - 0.04, 0.01, 0.01))
    for (const y of [GLASS_H - 0.02, 0.02]) {
      const s = new Mesh(hGeo, M.led)
      s.position.set(0, y, HZ + 0.008)
      add(s)
      ledStrips.push(s)
    }
  }

  /* ---------------- 玻璃 ---------------- */
  {
    const paneGeo = track(new PlaneGeometry(HX * 2, GLASS_H))
    const front = new Mesh(paneGeo, M.glass)
    front.position.set(0, GLASS_H / 2, HZ + 0.01)
    add(front)
    const sideGeo = track(new PlaneGeometry(HZ * 2, GLASS_H))
    for (const sx of [-1, 1]) {
      const s = new Mesh(sideGeo, M.glass)
      s.position.set(sx * (HX + 0.01), GLASS_H / 2, 0)
      s.rotation.y = (sx * Math.PI) / 2
      add(s)
    }
  }

  /* ---------------- 柜内背板 ----------------
     没有它的话柜子内部就是场景背景色 —— 一个惨白的空盒子（见
     `makeBackdropTexture` 的注释）。挂在玻璃**里面**（z = -HZ + 0.02）。

     ⚠️ 材质单独留一个引用：换色时要**重画贴图**（`setTheme` 用）。
     背板的花纹是画在 CanvasTexture 上的，改 `material.color` 对它没用。 */
  let backdropMat: MeshStandardMaterial
  {
    const tex = track(makeBackdropTexture(CLAW_THEMES[0].accent))
    backdropMat = track(new MeshStandardMaterial({ map: tex, roughness: 0.95 }))
    const back = new Mesh(track(new PlaneGeometry(HX * 2 - 0.02, GLASS_H - 0.02)), backdropMat)
    back.position.set(0, GLASS_H / 2, -HZ + 0.02)
    add(back)
  }

  /* ---------------- 地板 + 取物口 ---------------- */
  {
    const floor = new Mesh(track(new PlaneGeometry(HX * 2, HZ * 2)), M.felt)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = 0.002
    add(floor)
    // 取物口是个真的凹坑（BackSide 的盒子），娃娃掉进去就看不见了
    const pitW = HOLE.x1 - HOLE.x0
    /*
      ★ 深度比 `HOLE` 的 z 跨度**短 0.06**，整体再往后挪 0.03。

      前脸 `f` 占 z 0.21~0.47，而 `HOLE.z1` 是 0.5 —— 直接用 `HOLE.z1 - HOLE.z0`
      会让凹坑的前壁从柜门里**探出 0.03**，在白柜体右下角留下一个 **L 形黑边**
      （走查截图里一直有，2026-10-18 才定位到是它）。收进去之后照样看不见坑底，
      但不会再露边。`HOLE` 本身**不动** —— 它是「爪子把娃娃送到哪算赢」的判据，
      改了就是改玩法。
    */
    const pitD = HOLE.z1 - HOLE.z0 - 0.06
    const pit = new Mesh(track(new BoxGeometry(pitW, 0.4, pitD)), track(new MeshStandardMaterial({ color: 0x141416, roughness: 0.9, side: 1 })))
    pit.position.set((HOLE.x0 + HOLE.x1) / 2, -0.2, (HOLE.z0 + HOLE.z1) / 2 - 0.03)
    add(pit)
    // 洞口的高亮边（告诉孩子「这里就是出口」）
    const edge = new Mesh(track(new BoxGeometry(pitW + 0.01, 0.008, 0.008)), M.accent)
    edge.position.set((HOLE.x0 + HOLE.x1) / 2, 0.005, HOLE.z0)
    add(edge)
  }

  /* ---------------- 灯箱 ---------------- */
  /** 灯箱材质 —— 换色时 `map` 和 `emissiveMap` 都要换（`setTheme` 用） */
  let signMat: MeshStandardMaterial
  {
    const head = new Mesh(track(new RoundedBoxGeometry(HX * 2, 0.32, HZ * 2 - 0.04, 3, 0.02)), M.body)
    head.position.set(0, GLASS_H + 0.16, 0)
    add(head)
    const signTex = track(makeSignTexture('爪爪乐', hexOf(CLAW_THEMES[0].accent), '#ffffff'))
    signMat = track(
      new MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.95, roughness: 0.3 }),
    )
    const sign = new Mesh(track(new PlaneGeometry(1.06, 0.24)), signMat)
    sign.position.set(0, GLASS_H + 0.17, HZ - 0.014)
    add(sign)
    // 柜内顶上的日光灯管
    const tubeGeo = track(new CylinderGeometry(0.009, 0.009, HX * 1.7, 10))
    tubeGeo.rotateZ(Math.PI / 2)
    const tube = new Mesh(tubeGeo, M.tube)
    tube.position.set(0, GLASS_H - 0.03, HZ - 0.06)
    add(tube)
  }

  /* ---------------- 商场房间（地板 + 后墙） ----------------
     2026-10-17 加回来的一半（另一半「邻居柜子」仍然不做，理由见文件头表格）。

     ★ 加它的**理由是可量化的**：横屏时柜子是按高度取景的，两侧会剩下
       一大片空白 —— 实测 phone-landscape 左右各 **218px**、tablet-landscape 各 **257px**、
       desktop 各 **332px**（画布 1000px 宽，柜子只占中间三分之一）。
       那片空白以前是 `scene.background` 的一整块纯色，读起来像「3D 没加载完」。
       地板 + 后墙一放，同样那块地方就变成「站在商场里，机器立在脚边」。

     ⚠️ 只画地板和墙，**不画第二台机器**：家长 2026-10-16 明确说「只用显示一台」。
     ⚠️ 竖屏时柜子横向铺满（phone 左右各只剩 7px），房间**整个藏起来**
        （`resize` 末尾按「两侧空白」开关 `room.visible`），一分钱都不花。
  */
  const room = new Group()
  scene.add(room)
  {
    const floorTex = track(makeRoomFloorTexture())
    // 16 单位铺 8 遍 ⇒ 一张贴图管 2 单位，贴图里是 4×4 块砖 ⇒ 一块砖 ≈ 0.5 单位
    floorTex.repeat.set(8, 8)
    const roomFloor = new Mesh(
      track(new PlaneGeometry(16, 16)),
      track(new MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.03 })),
    )
    roomFloor.rotation.x = -Math.PI / 2
    // 和柜体底面同一高度：高一点柜子会「陷进地里」，低一点会「浮在空中」
    roomFloor.position.y = -BODY_H
    /*
      ⚠️ 不接阴影。主光的阴影相机只裹住柜子（±1.35 / ±1.7），
      地板一旦 `receiveShadow`，影子会在那个方框边缘**凭空断掉**，
      露出来的那截比没有影子更假。
    */
    room.add(roomFloor)

    const wall = new Mesh(
      track(new PlaneGeometry(16, 8)),
      track(new MeshStandardMaterial({ map: track(makeRoomWallTexture()), roughness: 0.95 })),
    )
    // 墙底 = 地板面（`-BODY_H`），再往上 8 个单位 ⇒ 中心在 `-BODY_H + 4`
    wall.position.set(0, -BODY_H + 4, -1.6)
    room.add(wall)

    /*
      ⚠️ 这里**故意没有**「柜脚接触阴影」那张贴片。写过一版，删掉了：
      取景是「站在机器前面」，五档视口下柜身底边**全都落在画布外**
      （实测 phone -35 / tablet -65 / desktop -40 px）——
      没有「柜脚」可压，贴片永远在画外。想让它露出来就得把地板整个抬起来，
      那又会让柜子浮空。等哪天取景改成「看得到底座」再加回来。
    */
  }
  // 默认关掉，由 `resize()` 末尾按「两侧还有没有空白」决定开不开
  room.visible = false

  /* ---------------- 天车（横梁 + 小车 + 缆绳） ---------------- */
  const beam = new Group()
  root.add(beam)
  const carriage = new Group()
  root.add(carriage)
  {
    for (const s of [-1, 1]) {
      const rail = box(0.02, 0.025, HZ * 2, M.alu, s * (HX - 0.012), RAIL_Y + 0.035, 0)
      void rail
    }
    const bar = new Mesh(track(new BoxGeometry(HX * 2 - 0.02, 0.02, 0.028)), M.alu)
    bar.position.set(0, RAIL_Y + 0.025, 0)
    beam.add(bar)
    const car = new Mesh(track(new RoundedBoxGeometry(0.075, 0.05, 0.07, 2, 0.006)), M.blackPlastic)
    car.position.set(0, RAIL_Y + 0.005, 0)
    carriage.add(car)
  }
  // 缆绳：单位长度朝下，靠 scale.y 拉长
  const cableGeo = track(new CylinderGeometry(0.0018, 0.0018, 1, 6))
  cableGeo.translate(0, -0.5, 0)
  const cable = new Mesh(cableGeo, M.steel)
  root.add(cable)

  /* ---------------- 爪子 ---------------- */
  const hub = new Group()
  root.add(hub)
  /**
   * 三个指头的**内层** Group —— 开合旋转就在这一层上。
   *
   * 物理层要拿它的世界矩阵去摆 kinematic 碰撞体（见 `clawPhysics.ts`），
   * 这样「张开多少」只有 `applyProngs()` 一个事实源，物理那边不重算角度。
   */
  const prongInners: Group[] = []
  {
    const HUB_R = 0.056
    const HUB_HH = 0.03
    const h1 = new Mesh(track(new CylinderGeometry(HUB_R, HUB_R * 0.94, HUB_HH * 2, 24)), M.chrome)
    hub.add(h1)
    const h2 = new Mesh(track(new CylinderGeometry(0.016, HUB_R * 0.95, 0.038, 20)), M.blackPlastic)
    h2.position.y = HUB_HH + 0.019
    hub.add(h2)
    const band = new Mesh(track(new CylinderGeometry(HUB_R * 1.03, HUB_R * 1.03, HUB_HH * 0.7, 24)), M.steel)
    band.position.y = -HUB_HH * 0.15
    hub.add(band)

    /*
      三个爪子，间隔 120°。每只自己一组，靠 `inner.rotation.z` 张开 / 合上。

      ★★ 2026-10-17 把指头**加长加粗**了（原来 0.085，现在 0.105）：
        取景拉近之后，原来那套爪子只有柜子宽度的 12%，看着像个小玩具夹子；
        参考实现里爪子约占柜宽的 20%。加长之后张开时才「撑得开」。
    */
    const prongGeo = track(new CapsuleGeometry(0.0105, 0.105, 4, 8))
    const tipGeo = track(new CapsuleGeometry(0.0145, 0.022, 4, 8))
    const tipMat = track(new MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.7 }))
    for (let i = 0; i < 3; i++) {
      const g = new Group()
      g.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 2
      const inner = new Group()
      g.add(inner)
      // 上臂
      const arm = new Mesh(prongGeo, M.chrome)
      arm.position.set(0.04, -0.062, 0)
      arm.rotation.z = 0.42
      inner.add(arm)
      // 爪尖
      const tip = new Mesh(tipGeo, tipMat)
      tip.position.set(0.082, -0.118, 0)
      tip.rotation.z = -0.5
      inner.add(tip)
      hub.add(g)
      prongInners.push(inner)
    }
  }

  /**
   * 指头的两个极限角度（绕 hub 的 z 轴，弧度）。
   *
   * ★★ 原来的张开角度是 **0**，合上是 −0.28 —— 整个动作只扫 16°，
   *   远看几乎是**不动**的。参考实现是 `ANG_OPEN 0.95 → ANG_CLOSED −0.32`，
   *   扫 **73°**。这就是「下钩抓的过程差很多」的主要来源：爪子得**张开**才像爪子。
   */
  const PRONG_OPEN = 0.62
  const PRONG_CLOSED = -0.3

  /**
   * 爪子的开合。
   *
   * `close`：0 = 张开，1 = 合上（时间线给的）。
   * `spread`：0.35 = **待命**姿势（微张，像原版 idle），1 = 下爪时张到最大。
   * `holding`：手里有娃娃 —— 合到 0.86 就停，指头**夹在娃娃外面**。
   *
   * ⚠️ 为什么需要 `spread` 这个额外参数：`close` 在「待命」和「下爪」时**都是 0**，
   *    光看它分不出这两种状态。待命就张到最大会像个蜘蛛；下爪不张到最大又不像在下爪。
   *
   * ⚠️ 为什么需要 `holding`：夹着娃娃还合到底，指头会穿进娃娃身体里。
   *    原版是靠「抓力上限」自然卡住的（`setProngs(ANG_CLOSED, grip)`，娃娃顶住就合不动）。
   *    我们这里是 kinematic 直接摆角度，所以得显式留出那点缝。
   */
  const applyProngs = (close: number, spread: number, holding: boolean) => {
    const cap = holding ? 0.86 : 1
    const k = MathUtils.clamp(close, 0, cap)
    const open = PRONG_OPEN * MathUtils.clamp(spread, 0, 1)
    for (const inner of prongInners) {
      inner.rotation.z = PRONG_CLOSED + (open - PRONG_CLOSED) * (1 - k)
      inner.scale.setScalar(1 - 0.06 * k)
    }
  }

  /* ---------------- 娃娃 ---------------- */
  const prizeGroups: Group[] = []
  const prizeRest: { x: number; z: number; y: number }[] = []
  {
    for (const p of initialPrizeLayout()) {
      const kind = PLUSH_KINDS[p.kind]
      const g = makePlush(kind.fur, kind.belly, kind.fur, p.seed)
      g.position.set(p.x, p.y, p.z)
      // 记下「原始大小」：撞击挤压是**乘法**叠在这个基准上，不能把它覆盖掉
      g.userData.baseScale = g.scale.x
      // 娃娃自己带的那几个材质也要能 dispose
      g.traverse((o) => {
        const m = o as Mesh
        if (m.isMesh) {
          track(m.geometry)
          const mat = m.material
          if (Array.isArray(mat)) mat.forEach((x) => track(x))
          else if (mat) track(mat)
        }
      })
      root.add(g)
      prizeGroups.push(g)
      prizeRest.push({ x: p.x, z: p.z, y: p.y })
    }
  }

  /* ---------------- 阴影开关：等所有东西都进 root 之后再统一开 ----------------
     ⚠️ 必须放在**娃娃之后** —— 娃娃也是 `root` 的子节点，先开就会漏掉它们，
     而「娃娃没有影子」正是这次要修的那个「像贴纸」的观感。

     排除三类：透明玻璃（投出来是一块实心黑）、自发光灯带（它自己是光源）、
     洞口黑面（平贴在柜门上，投影只会打架）。 */
  {
    const noShadow = new Set<unknown>([M.glass, M.led, M.lamp, M.tube, M.dark])
    root.traverse((o) => {
      const m = o as Mesh
      if (!m.isMesh) return
      const mat = m.material as unknown
      if (noShadow.has(mat)) {
        m.castShadow = false
        m.receiveShadow = false
        return
      }
      m.receiveShadow = true
      // 地板只接收：它是水平面，投影只会和自己打架（acne）
      m.castShadow = mat !== M.felt
    })
  }

  /* ============================ 取景（contain） ============================ */

  let dpr = 1

  /** 柜子 8 个角（只算一次）—— 走查用，整机允许被裁。 */
  const BOX_CORNERS: [number, number, number][] = []
  for (const x of [BOX.minX, BOX.maxX]) {
    for (const y of [BOX.minY, BOX.maxY]) {
      for (const z of [BOX.minZ, BOX.maxZ]) BOX_CORNERS.push([x, y, z])
    }
  }
  /**
   * 取景框**正面**的 4 个角 —— 取景迭代用它。
   *
   * ★★ 为什么只取 `z = maxZ` 这一面、而不是 8 个角：
   *   相机是**斜着俯视**的，柜子前脸（z=+0.55）离相机近得多，同样 x 的角点
   *   投出来**宽**很多。拿 8 个角去拟合，决定距离的是**前脸**那几个点 ——
   *   等于「把前脸装进画面」，后面的角自然更小。
   *
   *   但用 8 个角会让迭代**多收几轮**：它会先按后脸估一个距离、发现前脸越界、
   *   再放大…… 收敛得慢，而且中途的估计值没有意义。
   *   直接拟合前脸，一步到位。
   */
  const FRAME_CORNERS: [number, number, number][] = []
  for (const x of [FRAME.minX, FRAME.maxX]) {
    for (const y of [FRAME.minY, FRAME.maxY]) FRAME_CORNERS.push([x, y, FRAME.maxZ])
  }
  /** 玻璃区 8 个角 —— 走查断言「柜子内部完整可见」用它。 */
  const GLASS_CORNERS: [number, number, number][] = []
  for (const x of [-HX, HX]) {
    for (const y of [0, GLASS_H]) {
      for (const z of [-HZ, HZ]) GLASS_CORNERS.push([x, y, z])
    }
  }

  const _p = new Vector3()

  /**
   * 相机摆位：**绕 `LOOK_Y` 按 `CAM_POL` 俯视**，不是平视。
   *
   * 球坐标：水平距离 `dist·sin(pol)`、高度 `LOOK_Y + dist·cos(pol)`。
   * 这样「俯角」是相机自己的属性，跟距离无关 —— 换个画布尺寸不会突然变平视。
   */
  function placeCamera(dist: number): void {
    const sp = Math.sin(CAM_POL)
    const cp = Math.cos(CAM_POL)
    camera.position.set(0, LOOK_Y + dist * cp, dist * sp)
    camera.lookAt(0, LOOK_Y, 0)
    camera.updateProjectionMatrix()
    // ★ `project()` 读的是 `matrixWorldInverse`，而它由 `updateMatrixWorld()` 更新。
    //   不调的话这里算出来的角点坐标是**上一帧**相机下的 —— 迭代会收敛到错的地方。
    camera.updateMatrixWorld()
  }

  /** 把一组世界坐标角点投影成画布矩形。 */
  function projectRect(corners: [number, number, number][], w: number, h: number) {
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const [x, y, z] of corners) {
      const p = _p.set(x, y, z).project(camera)
      const sx = ((p.x + 1) / 2) * w
      const sy = ((1 - p.y) / 2) * h
      left = Math.min(left, sx)
      right = Math.max(right, sx)
      top = Math.min(top, sy)
      bottom = Math.max(bottom, sy)
    }
    return { left, top, right, bottom }
  }

  /**
   * 取景框 8 个角里最「越界」的那个，以 NDC 为单位。**≤ 1 = 整个框都在画面里。**
   *
   * 投影是「距离越远、画面越小」，比例大致是 1/dist，所以这个数直接就是
   * 「距离还要再乘几倍」的估计值（迭代几次收敛）。
   */
  function frameOverflow(): number {
    let m = 0
    for (const [x, y, z] of FRAME_CORNERS) {
      _p.set(x, y, z).project(camera)
      const a = Math.abs(_p.x)
      const b = Math.abs(_p.y)
      if (a > m) m = a
      if (b > m) m = b
    }
    return m
  }

  /**
   * 后处理链。`null` = 不启用（低端机 / WebGL 起不来），直接 `renderer.render`。
   *
   * ⚠️ 必须是 `let` 且在 `resize` 之前声明 —— `resize` 里要按新尺寸调
   * `composer.setSize`，而 composer 本身要在拿到尺寸后才建。
   */
  let composer: EffectComposer | null = null

  function resize(): void {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    // ★ DPR 封顶 2：手机上 DPR=3 ⇒ 9 倍填充率，动画直接掉帧
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    // ★ 第三个参数必须是 false，否则 three 会写行内 style，和宿主的响应式列打架
    renderer.setSize(w, h, false)
    // composer 有自己的 render target，尺寸要单独跟
    composer?.setPixelRatio(dpr)
    composer?.setSize(w, h)

    const aspect = w / h
    camera.aspect = aspect

    /*
      contain 的**起点**：让「设计矩形」整个装得下。取两个方向需要的距离里更大的那个。

      ★★ 但起点**不是终点** —— 相机是**斜的**（`placeCamera` 里那个 `dist * 0.09` /
      `dist * 0.075` 偏移），所以「设计矩形装得下」不等于「柜子的角装得下」。
      2026-10-16 实测：390×844 下画布高 554，而柜子底边投影在 **614.7**
      —— 柜子被裁掉了一截，而这是**纯几何**的问题，肉眼扫一眼截图看不出来
      （底部那截正好是深色的底座）。

      ➜ 所以再按**真实外框**收一次：把 8 个角投出来，越界就把距离按需要的比例放大。
        迭代几次就收敛；而且**以后改柜子的尺寸也不用回来重新调参数**。
    */
    const vt = Math.tan(MathUtils.degToRad(FOV / 2))
    let dist = Math.max(FRAME_H / 2 / vt, FRAME_W / 2 / (vt * aspect))
    /*
      ★ 迭代到 `over ≈ 1`，**不是**「`over ≤ 1` 就收工」。

      只判「装得下」会**严重欠收**：起点距离是按「取景框在目标平面上」估的，
      可前脸比目标平面近 0.8 个单位，一测就超了 ⇒ `dist *= over` 一步放大 1.5 倍
      ⇒ 再测就变成 0.86（装得下）⇒ 停。
      结果柜子只占画面宽度的 **86%**，四周还留一圈空 —— 看着就是「没怼上去」。
      实测就是这么来的（玻璃区只占 76%）。

      `dist` 和 `over` 是单调的，所以反复乘会收敛（几步就到 1.00）。
    */
    for (let i = 0; i < 12; i++) {
      placeCamera(dist)
      // ×FIT_MARGIN：框最多占画面的 1/1.03 ≈ 97%，别正好贴边（浮点一动就走查红）
      const over = frameOverflow() * FIT_MARGIN
      if (Math.abs(over - 1) < 0.005) break
      dist *= over
    }
    placeCamera(dist)
    cameraDist = dist // 存给 render 的「呼吸」微动当基准

    /*
      商场房间开不开：看**柜身两侧在画布上还剩多少像素**。

      ★★ 一开始想用公式估（`dist * tan(fov/2) * aspect > HX + 0.14`），**估错了**：
        那个式子算的是「目标平面（z=0）」上的可视半宽，而取景框的约束角点在
        `z = +0.55`（离相机更近），同一条光线在那儿只有 71% 的宽度。
        结果 phone 档（左右实际只剩 **7px**）被判成「有地方」，房间白开着。

      ➜ 所以直接量：把 `BOX_CORNERS` 投出来，和 `debugFrame()` / 走查脚本
        **用同一套投影**。这样「判据量到的空白」和「开关依据的空白」不可能走散 ——
        同一个事实存两份就一定会走散，这条在这台机器上已经踩过太多次。
    */
    const cb = projectRect(BOX_CORNERS, w, h)
    room.visible = Math.min(cb.left, w - cb.right) > 24
  }

  /*
    后处理：**暗角 + 胶片颗粒**，和参考实现同一套（它也是 `RenderPass → OutputPass → 颗粒`）。

    ★★ 这里踩过一个坑，别再犯：一开始加的是 `UnrealBloomPass`（辉光），
      实测**整个画面过曝成一片白**，柜子只剩一个幽灵轮廓。
      原因是 bloom 跑在**线性 HDR** 空间（色调映射在 `OutputPass` 才做），
      而白柜子在线性空间本来就 > 1 —— 阈值 0.86 把整块柜体都算成「过曝」，
      于是每一处都在晕开，叠起来就是全白。
      **参考实现根本没用 bloom**：它的电影感来自暗角 + 颗粒。
      ➜ 想让灯带发光，该调的是 `emissiveIntensity`，不是加 bloom。

    ⚠️ 走 composer 就**必须自己开 MSAA**：`WebGLRenderer({ antialias: true })`
      只作用于默认帧缓冲；渲染到 render target 时它不生效，
      柜子的立柱和灯带边缘会出锯齿。`samples: 2` 在手机上够用且便宜。
    ⚠️ `OutputPass` 负责色调映射 + sRGB 转换，**必须在颗粒之前** ——
      颗粒要在显示空间里叠（线性空间里叠噪点会偏色）。
    ⚠️ 按 CPU 核数挡一道：4 核及以下直接退回 `renderer.render`，
      少一个全屏 pass 和一个多采样 RT。
  */
  let grain: ShaderPass | null = null
  {
    const cores = navigator.hardwareConcurrency ?? 8
    if (cores > 4) {
      const w = Math.max(1, container.clientWidth)
      const h = Math.max(1, container.clientHeight)
      const d = Math.min(window.devicePixelRatio || 1, 2)
      const rt = new WebGLRenderTarget(w * d, h * d, { type: HalfFloatType, samples: 2 })
      const c = new EffectComposer(renderer, rt)
      c.addPass(new RenderPass(scene, camera))
      c.addPass(new OutputPass())
      grain = new ShaderPass({
        uniforms: {
          tDiffuse: { value: null },
          uT: { value: 0 },
          // 0.018：看得出是「照片」而不是「塑料模型」，又不至于像电视雪花
          uAmt: { value: 0.018 },
        },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform sampler2D tDiffuse;
          uniform float uT;
          uniform float uAmt;
          varying vec2 vUv;
          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233)) + uT) * 43758.5453);
          }
          void main() {
            vec4 c = texture2D(tDiffuse, vUv);
            // 暗角：越靠边越暗（0.30 是强度，别调太大，孩子会以为屏幕脏了）
            vec2 q = vUv - 0.5;
            c.rgb *= 1.0 - dot(q, q) * 0.30;
            c.rgb += (hash(gl_FragCoord.xy) - 0.5) * uAmt;
            gl_FragColor = vec4(c.rgb, 1.0);
          }
        `,
      })
      c.addPass(grain)
      composer = c
    }
  }

  resize()
  const ro = new ResizeObserver(() => resize())
  ro.observe(container)

  /* ============================ 物理 ============================ */

  /**
   * Rapier3D 那一层。`null` = 还没加载好 / 加载失败 / 已经 dispose。
   *
   * ★ 它**只演不算**：输赢在投币那一刻由 `settleClawRound()` 定死，
   *   物理只决定娃娃怎么堆、怎么被推开、松手后怎么掉。见 `clawPhysics.ts` 头注释。
   *
   * ★ 动态 import：Rapier 是 gzip 755 KB 的单独 chunk。它没到之前，
   *   下面那条「手写摆放 + 插值回位」的老路照常跑 —— 场景**不等它**。
   */
  let phys: ClawPhysics | null = null
  /** 走查脚本要能区分「没加载好」和「加载失败了」 */
  let physState: 'loading' | 'ready' | 'failed' | 'off' = 'off'
  let physError = ''
  /** 上一帧的 `t`（秒）—— `render()` 只收到绝对时间，dt 要自己算 */
  let lastPhysT = 0
  let disposed = false

  function startPhysics(): void {
    physState = 'loading'
    void createClawPhysics({
      cabinet: { hx: HX, hz: HZ, glassH: GLASS_H, hole: HOLE },
      prizes: prizeGroups,
      hub,
      prongs: prongInners,
    })
      .then((p) => {
        // 加载期间页面可能已经切走了 —— 那样必须立刻回收，不然漏一整个物理世界
        if (disposed) {
          p.dispose()
          return
        }
        phys = p
        physState = 'ready'
      })
      .catch((e: unknown) => {
        physState = 'failed'
        physError = e instanceof Error ? e.message : String(e)
        // 降级，不报错弹窗：孩子不该看到「物理引擎加载失败」
        console.warn('[claw] 物理没起来，退回静态摆放：', physError)
      })
  }

  // 不 await —— 场景先画出来，物理到了再接管（`render()` 里按 `phys` 分支）
  startPhysics()

  /* ============================ 渲染 ============================ */

  const tmp = new Vector3()

  /** 最后一帧收到的视觉状态（`debugVisual` 用）。 */
  let lastVisual: ClawVisual | null = null

  function render(t: number, v: ClawVisual, reducedMotion: boolean): void {
    lastVisual = v
    // ---- 天车 / 缆绳 / 爪子 ----
    beam.position.z = v.clawZ
    carriage.position.set(v.clawX, 0, v.clawZ)
    hub.position.set(v.clawX, v.hubY, v.clawZ)
    applyProngs(v.close, v.spread, v.held !== null)

    // 缆绳从小车底面拉到 hub 顶面
    const top = tmp.set(v.clawX, RAIL_Y - 0.02, v.clawZ)
    const dx = v.clawX - top.x
    const dy = v.hubY + 0.03 - top.y
    const dz = v.clawZ - top.z
    const len = Math.max(0.001, Math.hypot(dx, dy, dz))
    cable.position.copy(top)
    cable.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), new Vector3(dx, dy, dz).normalize())
    cable.scale.set(1, len, 1)

    // ---- 娃娃 ----
    if (phys) {
      /*
        ★ 物理接管之前必须先把 three 的矩阵刷出来：`clawPhysics` 读的是
          `prongInners[i].matrixWorld`（指头的世界位姿），而 `matrixWorld`
          只在 `updateMatrixWorld()` 里更新。不调的话它拿到的是**上一帧**
          的指头位置 —— 合爪时会看到碰撞体比爪子慢半拍。
      */
      hub.updateMatrixWorld(true)
      const dt = lastPhysT ? Math.min(0.1, t - lastPhysT) : 1 / 60
      lastPhysT = t
      phys.step(dt, { clawX: v.clawX, clawZ: v.clawZ, hubY: v.hubY, close: v.close, held: v.held })
    } else {
      // 降级路径：被夹住的那只跟着爪子，其余插值回原位
      for (let i = 0; i < prizeGroups.length; i++) {
        const g = prizeGroups[i]
        if (i === v.held) {
          g.position.set(v.clawX, v.hubY - 0.16, v.clawZ)
          g.rotation.z = Math.sin(t * 6) * 0.12 // 被提着晃
        } else if (g.visible) {
          const r = prizeRest[i]
          g.position.x += (r.x - g.position.x) * 0.12
          g.position.y += (r.y - g.position.y) * 0.12
          g.position.z += (r.z - g.position.z) * 0.12
          g.rotation.z *= 0.9
        }
      }
    }

    // ---- 软体手感：撞击压扁 + 回弹（纯视觉；碰撞体不动，所以探面 / 输赢都不受影响）----
    for (let i = 0; i < prizeGroups.length; i++) {
      const g = prizeGroups[i]
      const s = phys ? phys.squashOf(i) : 0
      const base = (g.userData.baseScale as number | undefined) ?? 1
      // s > 0 = 压扁（矮一点、胖一点）；s < 0 = 回弹拉长
      g.scale.set(base * (1 + s * 0.5), base * (1 - s), base * (1 + s * 0.5))
    }

    // ---- 灯：呼吸 + 中奖闪烁 ----
    const breathe = reducedMotion ? 1.6 : 1.5 + 0.6 * Math.sin(t * 2.6)
    const flash = v.winFlash > 0 && !reducedMotion ? 1.6 * Math.abs(Math.sin(t * 14)) : 0
    M.led.emissiveIntensity = breathe + flash
    M.lamp.emissiveIntensity = (0.4 + 0.2 * Math.sin(t * 2.2)) * (v.winFlash > 0 ? 4 : 1)
    M.tube.emissiveIntensity = reducedMotion ? 2.6 : 2.6 + Math.sin(t * 13.1) * 0.03

    // 颗粒每帧换一次种子（静态颗粒像屏幕脏了，动起来才像胶片）
    if (grain) grain.uniforms.uT.value = t

    // ---- 相机：待机「呼吸」微动（参考实现的氛围来源；纯视觉，不动经济/物理不变式）----
    // ★ 只在非 reducedMotion 下动相机；reducedMotion 时相机停在 resize 算好的静态位
    if (!reducedMotion) {
      // flash 是二值的（中奖后 1500ms 内 = 1），自己缓动一下，避免中奖瞬间硬切
      const zoomTarget = v.winFlash > 0 ? 1 : 0
      winZoom += (zoomTarget - winZoom) * 0.08
      if (winZoom < 0.001) winZoom = 0

      const az = Math.sin(t * 0.19) * 0.1              // 水平微摆（±~5.7°），比参考小，卡在卡片里不会裁边
      const pol = CAM_POL + Math.sin(t * 0.27) * 0.018 // 俯角微浮（±~1°）
      const sp = Math.sin(pol)
      const cp = Math.cos(pol)
      let d = cameraDist
      let lookY = LOOK_Y
      // 中奖特写：极轻地拉近 + 视线略往下压到取物口（缩到 5% 以内，不会冲出 contain-fit）
      if (winZoom > 0) {
        d *= 1 - 0.05 * winZoom
        lookY -= 0.1 * winZoom
      }
      const hx = d * sp * Math.sin(az)
      const hz = d * sp * Math.cos(az)
      const hy = lookY + d * cp
      // 轻微手持晃动（中奖特写期间关掉，免得晃）
      const sway = winZoom > 0 ? 0 : 1
      const sx = (Math.sin(t * 0.71) + Math.sin(t * 1.37 + 1) * 0.5) * 0.008 * sway
      const sy = (Math.sin(t * 0.53 + 2) + Math.sin(t * 1.13) * 0.4) * 0.006 * sway
      camera.position.set(hx + sx, hy + sy, hz)
      camera.lookAt(0, lookY, 0)
      // ★ 项目铁律：动完相机必须刷世界矩阵（resize 里的 placeCamera 也这么干）
      camera.updateMatrixWorld(true)
    }

    if (composer) composer.render()
    else renderer.render(scene, camera)
  }

  /* ============================ 换色 ============================ */

  let themeIdx = 0

  /**
   * 换配色。
   *
   * ★ 必须同时换**两张画出来的贴图**（灯箱、背板）—— 它们是 `CanvasTexture`，
   * 改 `material.color` 对它们没有任何作用。只换材质色的话，孩子会看到
   * 「柜身变青了，灯箱还是粉的、背板还是粉的」，比不换更奇怪。
   *
   * ⚠️ 旧贴图**必须 dispose**：换色可以来回点，不释放就是每点一次漏一张
   * 1024×256 / 512×512 的贴图，而且没有任何报错。
   */
  function setTheme(index: number): void {
    const n = CLAW_THEMES.length
    const idx = ((Math.round(index) % n) + n) % n
    themeIdx = idx
    const th = CLAW_THEMES[idx]

    // 柜身的强调色（控制台 / 摇杆球 / 取物口高亮边都共用这一个材质）
    M.accent.color.setHex(th.accent)
    // LED 灯带 + 取物口圆环
    M.led.emissive.setHex(th.led)
    M.lamp.emissive.setHex(th.led)

    // 灯箱：`map` 和 `emissiveMap` 指向同一张，两个都要换
    const oldSign = signMat.map
    const signTex = makeSignTexture('爪爪乐', hexOf(th.accent), '#ffffff')
    signMat.map = signTex
    signMat.emissiveMap = signTex
    signMat.needsUpdate = true
    oldSign?.dispose()

    // 背板
    const oldBack = backdropMat.map
    const backTex = makeBackdropTexture(th.accent)
    backdropMat.map = backTex
    backdropMat.needsUpdate = true
    oldBack?.dispose()
  }

  /* ============================ 收尾 ============================ */

  function dispose(): void {
    disposed = true
    // 物理世界是 WASM 里的一块内存，`renderer.dispose()` 管不到它
    phys?.dispose()
    phys = null
    physState = 'off'
    ro.disconnect()
    for (const d of disposables) {
      try {
        d.dispose()
      } catch {
        /* 已经释放过就算了 —— dispose 不该因为重复调用而炸 */
      }
    }
    disposables.length = 0
    // 后处理链有自己的 render target，`renderer.dispose()` 不管它
    composer?.dispose()
    composer = null
    // 环境贴图这条链上的三个对象都要单独放：PMREM 的中间 render target
    // 不释放就是一块常驻显存（而且切走再进来会再分配一块）
    scene.environment = null
    envRT.dispose()
    roomEnv.dispose()
    pmrem.dispose()
    // 换色会替换这两张贴图；当前这一张不在 `disposables` 里（换过之后是新 new 的）
    signMat.map?.dispose()
    backdropMat.map?.dispose()
    renderer.dispose()
    canvas.remove()
  }

  /** 把柜子的 8 个角投影到画布坐标 —— 走查脚本用它断言「柜子完整」。 */
  function debugFrame() {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    /*
      ★ 几何判据必须是**静态取景**下的数字，不能被 `render()` 里的「呼吸」微动带偏
        （呼吸只改 `camera.position` + `lookAt`，不改这里）。所以投影前先临时把相机
        摆回 `resize` 算好的静态位，量完再还原呼吸位姿 —— 下一帧 render 也会重设，
        但立刻还原更稳（截图脚本可能量完不等下一帧就截）。
    */
    const savedPos = camera.position.clone()
    const savedQuat = camera.quaternion.clone()
    placeCamera(cameraDist)
    camera.updateMatrixWorld(true)
    const glass = projectRect(GLASS_CORNERS, w, h)
    const frame = projectRect(FRAME_CORNERS, w, h)
    const cabinet = projectRect(BOX_CORNERS, w, h)
    camera.position.copy(savedPos)
    camera.quaternion.copy(savedQuat)
    camera.updateMatrixWorld(true)
    return {
      /**
       * ★ 判据换成**玻璃区**了。
       *
       * 之前断言的是「整个柜子（含 1.0 高的底座）完整在画面里」，那是
       * 「contain 装下整台机器」的思路 —— 为了装下底座，相机被推到很远，
       * 玻璃区只剩画面宽度的 66%，看着像一张柜子的照片。
       *
       * 现在按原版取景：**玻璃区必须完整、而且要横向铺满**；
       * 底座允许被裁（`cabinet` 会超出画面，这是**预期**，不是 bug）。
       */
      glass,
      /** 取景框（必须完整可见的那块） */
      frame,
      /** 整台机器 —— 允许越界 */
      cabinet,
      canvas: { w, h },
      dpr,
      roomVisible: room.visible,
      /**
       * 阴影贴图一个 texel 覆盖多少**世界单位**。
       *
       * ★★ 这个数是从**实际投影矩阵**反推的，不是从上面的常量抄的 —— 正因为如此，
       *   它能抓住「改了 `shadow.camera.left/right` 却忘了 `updateProjectionMatrix()`」：
       *   那种情况下矩阵还是默认的 ±5，这里会返回 **0.0098**（10 / 1024），
       *   而正确值 ≈ **0.0008**。差 12 倍，画面上只表现为「影子有点糊」，
       *   肉眼和截图都看不出来 —— 所以必须有个数字盯着它。
       *   （正交投影：`elements[0] = 2 / (right - left)`。）
       */
      shadowTexel: 2 / key.shadow.camera.projectionMatrix.elements[0] / key.shadow.mapSize.x,
    }
  }

  /**
   * 「写了」和「开着」是两件事 —— 这个函数回答后者。
   * 走查脚本拿它断言，别去比截图（抖动 3~252 B，逐字节比对本来就不稳）。
   */
  function debugEffects() {
    let casters = 0
    root.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh && m.castShadow) casters++
    })
    return {
      shadows: renderer.shadowMap.enabled,
      shadowCasters: casters,
      envMap: !!scene.environment,
      post: !!composer,
      theme: themeIdx,
    }
  }

  return {
    render,
    resize,
    dispose,
    debugFrame,
    debugEffects,
    debugVisual: () => lastVisual,
    setTheme,
    themeIndex: () => themeIdx,
    prizeCount: () => prizeGroups.length,
    debugProng: () => prongInners[0]?.rotation.z ?? 0,
    nearestPrize: (x: number, z: number) => {
      // 物理在跑的时候问**活的**位置：娃娃会被爪子推、会滚，静止坐标早就过期了
      if (phys) return phys.nearest(x, z)
      let best = -1
      let bestD = Infinity
      for (let i = 0; i < prizeRest.length; i++) {
        const d = Math.hypot(prizeRest[i].x - x, prizeRest[i].z - z)
        if (d < bestD) {
          bestD = d
          best = i
        }
      }
      return { index: best, dist: bestD }
    },
    prizeAt: (index: number) => {
      if (phys) {
        const p = phys.positionOf(index)
        return p ? { x: p.x, z: p.z } : null
      }
      const p = prizeRest[index]
      return p ? { x: p.x, z: p.z } : null
    },
    surfaceAt: (x: number, z: number) => {
      // 物理在跑：射线探，地板和娃娃都算（和原版同一条路）
      if (phys) return phys.surfaceAt(x, z)
      /*
        物理没起来（还在加载 / 加载失败）：用 three 里那几只的当前位置估一个顶面。
        娃娃顶 ≈ 中心 + 0.16（耳朵 `y=0.128` + 半径 0.028，见 `PRIZE_PARTS`），
        水平方向只认「爪子正下方」那一圈，别把隔壁那只算进来。
      */
      let best = 0
      for (const g of prizeGroups) {
        if (!g.visible) continue
        const dx = g.position.x - x
        const dz = g.position.z - z
        if (dx * dx + dz * dz > 0.1 * 0.1) continue
        best = Math.max(best, g.position.y + 0.16)
      }
      return best
    },
    debugPhysics: () => {
      const d = phys?.debug()
      return {
        state: physState,
        bodies: d?.bodies ?? 0,
        held: d?.held ?? false,
        awake: d?.awake ?? 0,
        recycled: d?.recycled ?? 0,
        steps: d?.steps ?? 0,
        maxSquash: d?.maxSquash ?? 0,
        error: physError,
      }
    },
    fieldFromScreen: (clientX: number, clientY: number) => {
      const r = container.getBoundingClientRect()
      const w = Math.max(1, r.width)
      const h = Math.max(1, r.height)
      // 池底矩形（y=0）的四个角投到屏幕，取包围盒
      let left = Infinity
      let right = -Infinity
      let top = Infinity
      let bottom = -Infinity
      for (const x of [-HX, HX]) {
        for (const z of [-HZ, HZ]) {
          const p = new Vector3(x, 0, z).project(camera)
          const sx = ((p.x + 1) / 2) * w
          const sy = ((1 - p.y) / 2) * h
          left = Math.min(left, sx)
          right = Math.max(right, sx)
          top = Math.min(top, sy)
          bottom = Math.max(bottom, sy)
        }
      }
      const nx = (clientX - r.left - left) / Math.max(1, right - left)
      const ny = (clientY - r.top - top) / Math.max(1, bottom - top)
      // 留一点边距，爪子不会贴着玻璃
      const pad = 0.09
      return {
        x: MathUtils.clamp(-HX + pad + nx * (HX * 2 - pad * 2), -HX + pad, HX - pad),
        z: MathUtils.clamp(-HZ + pad + ny * (HZ * 2 - pad * 2), -HZ + pad, HZ - pad),
      }
    },
  }
}

/** 取物口中心（世界坐标）—— 爪子把娃娃送到这里就算拿到了。 */
export const CLAW_HOLE_CENTER = { x: (HOLE.x0 + HOLE.x1) / 2, z: (HOLE.z0 + HOLE.z1) / 2 }
/** 取物口的世界坐标范围 —— 页面判定「娃娃有没有掉进去」时要用同一个数。 */
export const CLAW_HOLE = HOLE
/** 天车轨道高度 —— 页面算 hubY 的起点。 */
export const CLAW_RAIL_Y = RAIL_Y
export { HX as CLAW_HX, HZ as CLAW_HZ, GLASS_H as CLAW_GLASS_H }
