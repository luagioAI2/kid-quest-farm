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
 * | 邻居柜子 + 商场房间 | 家长 2026-10-16：「娃娃机 只用显示一台」 |
 * | Rapier3D 物理引擎 | 实测 **+1.65 MB gzip**；而且物理驱动的抓取**期望值不可控** —— 见 `domain/clawEconomy.ts` 头注释 |
 * | OrbitControls / 多机位 | 宿主容器很小，而且自由旋转会把柜子转出画面 |
 * | EffectComposer 后处理 | 手机上太贵；而且它要额外的 render target |
 * | 自带音效 / 浮层 / 全屏 / 手柄 | 宿主都有（`playTone` / `pushToast` / 触控），自己再造一份就是两套事实 |
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
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

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
const BOX_W = BOX.maxX - BOX.minX
const BOX_H = BOX.maxY - BOX.minY

const FOV = 26
/**
 * 相机看的高度 = **柜子的垂直中心**。
 *
 * 和 `BOX` 绑在一起而不是写死一个数：柜子加高一点（比如换个灯箱），
 * 取景会自己跟着走，不用回来重新对。
 */
const LOOK_Y = (BOX.minY + BOX.maxY) / 2

/** 取景迭代的起点（`resize` 会按真实外框再收紧，见那边的注释）。 */
const DESIGN_W = BOX_W
const DESIGN_H = BOX_H

/**
 * 取景留白：柜子最多占画面的 `1 / FIT_MARGIN`（约 97%）。
 *
 * 不设的话迭代会停在「刚好贴边」上 —— 实测底边离画布只剩 4px，
 * 换个 DPR 或者柜子高一点点就越界。
 */
const FIT_MARGIN = 1.03

/** 三档主题色。和参考实现一样给 3 个，默认第一个（粉）。 */
export const CLAW_THEMES = [
  { accent: 0xf47aa8, led: 0xff7ab0 },
  { accent: 0xf5c52a, led: 0xffd23a },
  { accent: 0x3ec8d8, led: 0x4fd8e8 },
] as const

/* ============================ 小工具 ============================ */

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

/** 一只娃娃：身体 + 两只耳朵 + 眼睛 + 鼻子。用基本体拼，够认出来就行。 */
function makePlush(color: number, body: number, ear: number, seed: number): Group {
  const g = new Group()
  const fur = new MeshStandardMaterial({ color, roughness: 0.95 })
  const dark = new MeshStandardMaterial({ color: 0x2a2430, roughness: 0.6 })
  const bodyMat = new MeshStandardMaterial({ color: body, roughness: 0.9 })

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
    cabinet: { left: number; top: number; right: number; bottom: number }
    canvas: { w: number; h: number }
    dpr: number
  }
  /** 走查脚本用：娃娃数量 */
  prizeCount(): number
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
   * 屏幕坐标（`clientX/clientY`）→ 池子里的世界坐标。
   *
   * 给「拖着爪子瞄准」用。超出池子会被**夹在池子边缘**（不能把爪子拖到玻璃外面）。
   *
   * ⚠️ 这里用的是**线性映射**（把池底矩形投影到屏幕再按比例换算），
   * 不是射线求交。相机基本是正对的，透视误差很小，瞄准够用；
   * 换成 raycaster 会更准，但要多引一个模块，不值得。
   */
  fieldFromScreen(clientX: number, clientY: number): { x: number; z: number }
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

  const scene = new Scene()
  scene.background = new Color(0xe9e6f2)

  const camera = new PerspectiveCamera(FOV, 1, 0.05, 40)
  camera.position.set(0, LOOK_Y, 4)

  /* ---------------- 灯光：暖顶光 + 柜内冷白 ---------------- */
  scene.add(new HemisphereLight(0xfff5f0, 0xc8c0b8, 1.5))
  const key = new DirectionalLight(0xfff8f2, 2.1)
  key.position.set(0.6, 3.4, 2.6)
  scene.add(key)
  const fill = new DirectionalLight(0xffe8f0, 0.8)
  fill.position.set(-2.2, 1.6, 1.8)
  scene.add(fill)
  /** 柜内顶灯（让娃娃有明暗层次，不然一团糊） */
  const inner = new PointLight(0xfff5fa, 2.4, 3.2, 2)
  inner.position.set(0, GLASS_H - 0.06, 0.1)
  scene.add(inner)

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
    */
    felt: track(new MeshStandardMaterial({ color: 0x93a1b0, roughness: 0.97 })),
    glass: track(
      new MeshPhysicalMaterial({
        color: 0xe8f2f0,
        roughness: 0.06,
        metalness: 0,
        transparent: true,
        opacity: 0.10,
        depthWrite: false,
        side: 2,
        // ⚠️ clearcoat 从 1 降到 0.4：整面玻璃上那层清漆高光会糊成一大片白，
        // 把柜子内部（背板 + 娃娃）一起洗白 —— 实测截图里上半截就是一片白，
        // 看着像「柜子是空的」。玻璃还是要有点反光，但不能盖过里面的东西。
        clearcoat: 0.4,
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
    // 取物口：黑洞 + LED 圆环
    const hole = new Mesh(track(new CircleGeometry(0.19, 32)), M.dark)
    hole.position.set(-HX + 0.28, -0.52, HZ - 0.03)
    add(hole)
    const ring = new Mesh(track(new TorusGeometry(0.225, 0.022, 12, 44)), M.lamp)
    ring.position.set(-HX + 0.28, -0.52, HZ - 0.025)
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
     `makeBackdropTexture` 的注释）。挂在玻璃**里面**（z = -HZ + 0.02）。 */
  {
    const tex = track(makeBackdropTexture(CLAW_THEMES[0].accent))
    const back = new Mesh(
      track(new PlaneGeometry(HX * 2 - 0.02, GLASS_H - 0.02)),
      track(new MeshStandardMaterial({ map: tex, roughness: 0.95 })),
    )
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
    const pitD = HOLE.z1 - HOLE.z0
    const pit = new Mesh(track(new BoxGeometry(pitW, 0.4, pitD)), track(new MeshStandardMaterial({ color: 0x141416, roughness: 0.9, side: 1 })))
    pit.position.set((HOLE.x0 + HOLE.x1) / 2, -0.2, (HOLE.z0 + HOLE.z1) / 2)
    add(pit)
    // 洞口的高亮边（告诉孩子「这里就是出口」）
    const edge = new Mesh(track(new BoxGeometry(pitW + 0.01, 0.008, 0.008)), M.accent)
    edge.position.set((HOLE.x0 + HOLE.x1) / 2, 0.005, HOLE.z0)
    add(edge)
  }

  /* ---------------- 灯箱 ---------------- */
  {
    const head = new Mesh(track(new RoundedBoxGeometry(HX * 2, 0.32, HZ * 2 - 0.04, 3, 0.02)), M.body)
    head.position.set(0, GLASS_H + 0.16, 0)
    add(head)
    const signTex = track(makeSignTexture('爪爪乐', '#f47aa8', '#ffffff'))
    const sign = new Mesh(
      track(new PlaneGeometry(1.06, 0.24)),
      track(new MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 0.95, roughness: 0.3 })),
    )
    sign.position.set(0, GLASS_H + 0.17, HZ - 0.014)
    add(sign)
    // 柜内顶上的日光灯管
    const tubeGeo = track(new CylinderGeometry(0.009, 0.009, HX * 1.7, 10))
    tubeGeo.rotateZ(Math.PI / 2)
    const tube = new Mesh(tubeGeo, M.tube)
    tube.position.set(0, GLASS_H - 0.03, HZ - 0.06)
    add(tube)
  }

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
  const prongGroups: Group[] = []
  {
    const HUB_R = 0.052
    const HUB_HH = 0.028
    const h1 = new Mesh(track(new CylinderGeometry(HUB_R, HUB_R * 0.94, HUB_HH * 2, 24)), M.chrome)
    hub.add(h1)
    const h2 = new Mesh(track(new CylinderGeometry(0.014, HUB_R * 0.95, 0.034, 20)), M.blackPlastic)
    h2.position.y = HUB_HH + 0.017
    hub.add(h2)
    const band = new Mesh(track(new CylinderGeometry(HUB_R * 1.03, HUB_R * 1.03, HUB_HH * 0.7, 24)), M.steel)
    band.position.y = -HUB_HH * 0.15
    hub.add(band)

    // 三个爪子，间隔 120°。每只自己一组，靠 rotation.x 张开/合上。
    const prongGeo = track(new CapsuleGeometry(0.0095, 0.085, 4, 8))
    const tipGeo = track(new CapsuleGeometry(0.013, 0.018, 4, 8))
    const tipMat = track(new MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.7 }))
    for (let i = 0; i < 3; i++) {
      const g = new Group()
      g.rotation.y = (i / 3) * Math.PI * 2 + Math.PI / 2
      const inner = new Group()
      g.add(inner)
      // 上臂
      const arm = new Mesh(prongGeo, M.chrome)
      arm.position.set(0.036, -0.05, 0)
      arm.rotation.z = 0.42
      inner.add(arm)
      // 爪尖
      const tip = new Mesh(tipGeo, tipMat)
      tip.position.set(0.068, -0.095, 0)
      tip.rotation.z = -0.5
      inner.add(tip)
      hub.add(g)
      prongGroups.push(g)
    }
  }
  /** 爪子的开合：0 = 张开，1 = 合上。绕 z 轴转（越合越往里收）。 */
  const applyClose = (close: number) => {
    const k = MathUtils.clamp(close, 0, 1)
    for (const g of prongGroups) {
      const inner = g.children[0] as Group
      inner.rotation.z = -0.28 * k
      inner.scale.setScalar(1 - 0.08 * k)
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

  /* ============================ 取景（contain） ============================ */

  let dpr = 1

  /** 柜子 8 个角（只算一次）—— 取景迭代和 `debugFrame` 共用。 */
  const BOX_CORNERS: [number, number, number][] = []
  for (const x of [BOX.minX, BOX.maxX]) {
    for (const y of [BOX.minY, BOX.maxY]) {
      for (const z of [BOX.minZ, BOX.maxZ]) BOX_CORNERS.push([x, y, z])
    }
  }

  const _p = new Vector3()

  function placeCamera(dist: number): void {
    // 稍微偏一点、高一点，柜子才有立体感（偏移量按 dist 走，各宽高比下观感一致）
    camera.position.set(dist * 0.09, LOOK_Y + dist * 0.075, dist)
    camera.lookAt(0, LOOK_Y, 0)
    camera.updateProjectionMatrix()
    // ★ `project()` 读的是 `matrixWorldInverse`，而它由 `updateMatrixWorld()` 更新。
    //   不调的话这里算出来的角点坐标是**上一帧**相机下的 —— 迭代会收敛到错的地方。
    camera.updateMatrixWorld()
  }

  /**
   * 柜子 8 个角里最「越界」的那个，以 NDC 为单位。**≤ 1 = 整个柜子都在画面里。**
   *
   * 投影是「距离越远、画面越小」，比例大致是 1/dist，所以这个数直接就是
   * 「距离还要再乘几倍」的估计值（迭代几次收敛）。
   */
  function boxOverflow(): number {
    let m = 0
    for (const [x, y, z] of BOX_CORNERS) {
      _p.set(x, y, z).project(camera)
      const a = Math.abs(_p.x)
      const b = Math.abs(_p.y)
      if (a > m) m = a
      if (b > m) m = b
    }
    return m
  }

  function resize(): void {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    // ★ DPR 封顶 2：手机上 DPR=3 ⇒ 9 倍填充率，动画直接掉帧
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    renderer.setPixelRatio(dpr)
    // ★ 第三个参数必须是 false，否则 three 会写行内 style，和宿主的响应式列打架
    renderer.setSize(w, h, false)

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
    let dist = Math.max(DESIGN_H / 2 / vt, DESIGN_W / 2 / (vt * aspect))
    for (let i = 0; i < 8; i++) {
      placeCamera(dist)
      // ×FIT_MARGIN：要求柜子最多占到画面的 1/1.03 ≈ 97%，
      // 别让它正好贴在边上（浮点一动就又越界，走查会红）
      const over = boxOverflow() * FIT_MARGIN
      if (over <= 1) break
      dist *= over
    }
    placeCamera(dist)
  }

  resize()
  const ro = new ResizeObserver(() => resize())
  ro.observe(container)

  /* ============================ 渲染 ============================ */

  const tmp = new Vector3()

  function render(t: number, v: ClawVisual, reducedMotion: boolean): void {
    // ---- 天车 / 缆绳 / 爪子 ----
    beam.position.z = v.clawZ
    carriage.position.set(v.clawX, 0, v.clawZ)
    hub.position.set(v.clawX, v.hubY, v.clawZ)
    applyClose(v.close)

    // 缆绳从小车底面拉到 hub 顶面
    const top = tmp.set(v.clawX, RAIL_Y - 0.02, v.clawZ)
    const dx = v.clawX - top.x
    const dy = v.hubY + 0.03 - top.y
    const dz = v.clawZ - top.z
    const len = Math.max(0.001, Math.hypot(dx, dy, dz))
    cable.position.copy(top)
    cable.quaternion.setFromUnitVectors(new Vector3(0, -1, 0), new Vector3(dx, dy, dz).normalize())
    cable.scale.set(1, len, 1)

    // ---- 娃娃：被夹住的那只跟着爪子走 ----
    for (let i = 0; i < prizeGroups.length; i++) {
      const g = prizeGroups[i]
      if (i === v.held) {
        g.position.set(v.clawX, v.hubY - 0.16, v.clawZ)
        g.rotation.z = Math.sin(t * 6) * 0.12 // 被提着晃
      } else if (g.visible) {
        // 没被夹住的回到原位（简化：不做物理沉降）
        const r = prizeRest[i]
        g.position.x += (r.x - g.position.x) * 0.12
        g.position.y += (r.y - g.position.y) * 0.12
        g.position.z += (r.z - g.position.z) * 0.12
        g.rotation.z *= 0.9
      }
    }

    // ---- 灯：呼吸 + 中奖闪烁 ----
    const breathe = reducedMotion ? 1.6 : 1.5 + 0.6 * Math.sin(t * 2.6)
    const flash = v.winFlash > 0 && !reducedMotion ? 1.6 * Math.abs(Math.sin(t * 14)) : 0
    M.led.emissiveIntensity = breathe + flash
    M.lamp.emissiveIntensity = (0.4 + 0.2 * Math.sin(t * 2.2)) * (v.winFlash > 0 ? 4 : 1)
    M.tube.emissiveIntensity = reducedMotion ? 2.6 : 2.6 + Math.sin(t * 13.1) * 0.03

    renderer.render(scene, camera)
  }

  /* ============================ 收尾 ============================ */

  function dispose(): void {
    ro.disconnect()
    for (const d of disposables) {
      try {
        d.dispose()
      } catch {
        /* 已经释放过就算了 —— dispose 不该因为重复调用而炸 */
      }
    }
    disposables.length = 0
    renderer.dispose()
    canvas.remove()
  }

  /** 把柜子的 8 个角投影到画布坐标 —— 走查脚本用它断言「柜子完整」。 */
  function debugFrame() {
    const w = Math.max(1, container.clientWidth)
    const h = Math.max(1, container.clientHeight)
    let left = Infinity
    let top = Infinity
    let right = -Infinity
    let bottom = -Infinity
    for (const [x, y, z] of BOX_CORNERS) {
      const p = _p.set(x, y, z).project(camera)
      const sx = ((p.x + 1) / 2) * w
      const sy = ((1 - p.y) / 2) * h
      left = Math.min(left, sx)
      right = Math.max(right, sx)
      top = Math.min(top, sy)
      bottom = Math.max(bottom, sy)
    }
    return {
      cabinet: { left, top, right, bottom },
      canvas: { w, h },
      dpr,
    }
  }

  return {
    render,
    resize,
    dispose,
    debugFrame,
    prizeCount: () => prizeGroups.length,
    nearestPrize: (x: number, z: number) => {
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
      const p = prizeRest[index]
      return p ? { x: p.x, z: p.z } : null
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
