/**
 * 整台机器的**模型** —— 逐字抄参考实现（`claw-machine/src/models.ts`）。
 *
 * ---------------------------------------------------------------------------
 * 抄的是什么
 * ---------------------------------------------------------------------------
 *
 * 一台 Gen-2 商场娃娃机的所有零件，按「人站在机器前面会看到什么」排：
 *
 *   下半截  圆角亮面白机身 + 圆形取物口（贴纸 + 灯环 + 黑洞）
 *           + 检修门（吉祥物贴纸 + 锁）+ 控制台（摇杆 / 红色按钮 / 小 LCD）
 *           + 四个脚轮
 *   上半截  四根铝合金立柱 + 正面两条 LED 灯带（上下各一条横的）
 *           + 三面玻璃（淡色 + 反射 + 污渍三层）+ 柜内「HAPPY GAMES」横幅
 *           + 背板海报 + 深蓝灰地垫 + 取物口的亚克力围栏和「出口」标签
 *   顶上    灯箱（白底 + 吉祥物 + 品牌字）+ 两根日光灯管
 *   里面    天车横梁 / 小车 / 缆绳 / 爪子
 *
 * 这些东西我们以前是**按比例自己搭**的（见 git 历史里那版 600 行的柜子），
 * 远看「像娃娃机」，近看每个零件都不对：机身太方、没有控制台、没有脚轮、
 * 玻璃只有一层淡色、背板是一张纯粉海报。
 *
 * ---------------------------------------------------------------------------
 * 我们这边的两条差异（都是**故意的**，别改回去）
 * ---------------------------------------------------------------------------
 *
 * ① **没有邻居柜子。** 参考实现的 `buildRoom()` 会在两侧摆 6 台机器，
 *    家长 2026-10-16 明确说过「娃娃机只用显示一台」。这里只留地板 + 后墙。
 *
 * ② **`prongs` 返回的是「内层」Group**（带着方位角和开合角的那一层），
 *    不是参考实现里的外层。因为我们的爪子是 kinematic —— 物理层要读
 *    `matrixWorld` 去摆碰撞体，读到的必须是**真的转了那 73°** 的那一层。
 */
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  Texture,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CAB, CARRIAGE_Y, HOLE, HUB_HH, HUB_R, OX, OZ, PH, PICKUP, PIVOT_R, PRONG_AZ, PRONG_PTS, PRONG_RADIUS } from './dims'
import {
  backboardPrint,
  doorSticker,
  fabricNormal,
  feltPlain,
  floorTiles,
  glassReflection,
  glassSmudge,
  glossWhite,
  headerSign,
  labelTexture,
  ledgeLabel,
  prizeOutRing,
} from './textures'
import { CLAW_THEMES, hexOf, type ClawTheme } from './themes'

const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z)

/** 机身亮面白漆的那张微噪点贴图（所有机身零件共用一张）。 */
const whiteMap = glossWhite()

/**
 * 机器上用到的**全部材质**。和参考实现一一对应。
 *
 * ⚠️ 这些是**模块级单例**：`applyTheme()` 直接改它们的颜色 / 自发光，
 *   所以同一时刻只能有一台机器（本项目就是这样）。
 */
export const M = {
  body: new MeshPhysicalMaterial({ color: 0xffffff, map: whiteMap, roughness: 0.22, metalness: 0.05, clearcoat: 0.85, clearcoatRoughness: 0.18 }),
  accent: new MeshPhysicalMaterial({ color: CLAW_THEMES[0].accent, roughness: 0.28, metalness: 0.08, clearcoat: 0.7, clearcoatRoughness: 0.25 }),
  accentSoft: new MeshStandardMaterial({ color: CLAW_THEMES[0].accentSoft, roughness: 0.45 }),
  alu: new MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.28, metalness: 0.95 }),
  chrome: new MeshStandardMaterial({ color: 0xe0e2e6, roughness: 0.18, metalness: 1 }),
  steel: new MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.35, metalness: 0.92 }),
  blackPlastic: new MeshStandardMaterial({ color: 0x222226, roughness: 0.55 }),
  dark: new MeshStandardMaterial({ color: 0x0e0e12, roughness: 0.9 }),
  /** 爪尖那层红色橡胶 —— 原版的爪尖是**加粗的红头**，不是金属尖。 */
  rubber: new MeshStandardMaterial({ color: 0x8a2a24, roughness: 0.7 }),
  ballRed: new MeshPhysicalMaterial({ color: 0xd62828, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.35 }),
  buttonRed: new MeshPhysicalMaterial({ color: 0xe03030, roughness: 0.25, clearcoat: 0.75, clearcoatRoughness: 0.3 }),
  /**
   * 玻璃的**底色**。
   *
   * ★★ 只有 0.04。玻璃是整面均匀蒙在柜子上的：每多 1% 不透明度，
   *   里面所有东西就统一降 1% 对比度。参考实现的「玻璃感」来自
   *   `glassSmudge` / `glassReflection` 两张**局部**贴图，不是整面加雾。
   *   ⚠️ 别再往上调：0.10 时背板和娃娃看上去像隔着一层毛玻璃。
   */
  glassTint: new MeshStandardMaterial({ color: 0xe8f2f0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.04, depthWrite: false, side: DoubleSide }),
  /** 玻璃的**反射**（三块灯管的倒影，加法混合）。 */
  glassRefl: new MeshPhysicalMaterial({ color: 0x000000, roughness: 0.03, metalness: 0, envMapIntensity: 3.8, transparent: true, blending: AdditiveBlending, depthWrite: false, clearcoat: 1, clearcoatRoughness: 0.02 }),
  /** 取物口那圈亚克力围栏。 */
  acrylic: new MeshStandardMaterial({ color: 0xd0e4ea, roughness: 0.12, transparent: true, opacity: 0.2, depthWrite: false, side: DoubleSide }),
  /** 日光灯管（自发光）。 */
  tube: new MeshStandardMaterial({ color: 0x000000, emissive: 0xf5f8ff, emissiveIntensity: 2.8 }),
  /** 取物口的灯环 —— 中奖时会闪。 */
  doorLamp: new MeshStandardMaterial({ color: 0x222222, emissive: CLAW_THEMES[0].led, emissiveIntensity: 0.15 }),
  /** 正面两条 LED 灯带 —— 会「跑马」呼吸。 */
  ledStrip: new MeshStandardMaterial({ color: 0x111111, emissive: CLAW_THEMES[0].led, emissiveIntensity: 1.8 }),
  wheel: new MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.7 }),
}

function mesh(
  geo: import('three').BufferGeometry,
  mat: import('three').Material,
  x: number,
  y: number,
  z: number,
  parent: Object3D,
  shadow = true,
): Mesh {
  const m = new Mesh(geo, mat)
  m.position.set(x, y, z)
  m.castShadow = shadow
  m.receiveShadow = true
  parent.add(m)
  return m
}

function decal(map: Texture, w: number, h: number, x: number, y: number, z: number, parent: Object3D, rough = 0.4): Mesh {
  const m = new Mesh(
    new PlaneGeometry(w, h),
    new MeshStandardMaterial({ map, roughness: rough, transparent: true, polygonOffset: true, polygonOffsetFactor: -2 }),
  )
  m.position.set(x, y, z)
  m.receiveShadow = true
  parent.add(m)
  return m
}

export interface MachineParts {
  root: Group
  beam: Object3D
  carriage: Object3D
  cable: Mesh
  hub: Group
  /** ★ 三个指头的**内层** Group（见文件头 ②） */
  prongs: Object3D[]
  doorPos: Vector3
  ledStrips: Mesh[]
  prizeRing: Mesh
  themeables: { mat: MeshStandardMaterial | MeshPhysicalMaterial; kind: 'accent' | 'led' | 'soft' }[]
  signMesh: Mesh
  backMesh: Mesh
  ledgeLbl: Mesh
  doorDec: Mesh
  ringDec: Mesh
}

/** 换配色：材质 + 五张画出来的贴图（灯箱 / 背板 / 取物口 / 控制台 / 门贴）。 */
export function applyTheme(parts: MachineParts, theme: ClawTheme): void {
  for (const t of parts.themeables) {
    if (t.kind === 'accent') t.mat.color.setHex(theme.accent)
    else if (t.kind === 'soft') t.mat.color.setHex(theme.accentSoft)
    else t.mat.emissive.setHex(theme.led)
  }
  M.accent.color.setHex(theme.accent)
  M.accentSoft.color.setHex(theme.accentSoft)
  M.ledStrip.emissive.setHex(theme.led)
  M.doorLamp.emissive.setHex(theme.led)

  const softHex = hexOf(theme.accentSoft)
  const hardHex = theme.accentHex
  const sign = headerSign(hardHex, softHex)
  const bb = backboardPrint(hardHex, softHex)
  const ring = prizeOutRing(hardHex)
  const ledge = ledgeLabel(hardHex)
  const door = doorSticker(hardHex, softHex)
  const setMap = (m: Mesh, map: Texture, emissive = false) => {
    const mat = m.material as MeshStandardMaterial
    mat.map?.dispose()
    if (emissive && mat.emissiveMap) mat.emissiveMap.dispose()
    mat.map = map
    if (emissive) {
      mat.emissiveMap = map
      mat.emissive.setHex(0xffffff)
    }
    mat.needsUpdate = true
  }
  setMap(parts.signMesh, sign, true)
  setMap(parts.backMesh, bb, true)
  setMap(parts.ringDec, ring)
  setMap(parts.ledgeLbl, ledge)
  setMap(parts.doorDec, door)
}

/**
 * 释放一台机器的 GPU 资源。
 *
 * ★★ 只能放**这台机器自己的**那些：`M` 里那批材质和 `whiteMap` / `fabricNormal`
 *   是模块级单例（娃娃也在用），释放了再进一次娃娃就变成白球。
 *   ➜ 共享的那几个跳过，其余的（贴纸材质、玻璃的污渍 / 反射、地垫、背板……）全放。
 */
const SHARED_MATS = new Set<unknown>(Object.values(M))

export function disposeMachine(parts: MachineParts): void {
  // ⚠️ 在函数里才建这个集合：`fabricNormal()` 要 document，模块加载时建会在
  //    没有 DOM 的环境（单测）里直接抛。
  const sharedTex = new Set<unknown>([whiteMap, fabricNormal()])
  parts.root.traverse((o) => {
    const m = o as Mesh
    if (!m.isMesh) return
    m.geometry.dispose()
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      if (!mat || SHARED_MATS.has(mat)) continue
      const mm = mat as MeshStandardMaterial
      if (mm.map && !sharedTex.has(mm.map)) mm.map.dispose()
      if (mm.emissiveMap && mm.emissiveMap !== mm.map && !sharedTex.has(mm.emissiveMap)) mm.emissiveMap.dispose()
      if (mm.normalMap && !sharedTex.has(mm.normalMap)) mm.normalMap.dispose()
      mat.dispose()
    }
  })
}

export function buildMachine(theme: ClawTheme = CLAW_THEMES[0]): MachineParts {
  const root = new Group()
  const { hx, hz, top } = CAB
  const themeables: MachineParts['themeables'] = []
  const track = (mat: MeshStandardMaterial | MeshPhysicalMaterial, kind: 'accent' | 'led' | 'soft') => {
    themeables.push({ mat, kind })
    return mat
  }

  /* ---------------- 下半截：亮面白机身 ---------------- */
  mesh(new RoundedBoxGeometry(OX * 2, PH - 0.012, 0.72, 4, 0.02), M.body, 0, -PH / 2 - 0.006, -0.14, root)
  // 正面那块板（取物口就开在它上面）
  mesh(new RoundedBoxGeometry(OX * 2, PH - 0.12, 0.28, 3, 0.015), M.body, 0, -PH / 2 + 0.04, 0.36, root)
  // 机身下沿那圈彩色保险杠
  const bumpMat = track(M.accent, 'accent')
  mesh(new BoxGeometry(OX * 2 + 0.004, 0.04, 0.012), bumpMat, 0, -0.08, 0.505, root)

  /* ---------------- 圆形取物口 ---------------- */
  const ringTex = prizeOutRing(theme.accentHex)
  const ringDec = decal(ringTex, 0.48, 0.48, PICKUP.x, PICKUP.y, 0.505, root, 0.35)
  // 贴纸后面那个黑井
  mesh(new CircleGeometry(0.18, 32), M.dark, PICKUP.x, PICKUP.y, 0.49, root, false)
  const prizeRing = mesh(new TorusGeometry(0.22, 0.022, 12, 48), track(M.doorLamp, 'led'), PICKUP.x, PICKUP.y, 0.502, root, false)

  /* ---------------- 检修门 + 吉祥物贴纸 ---------------- */
  mesh(new RoundedBoxGeometry(0.38, 0.55, 0.02, 2, 0.01), M.body, 0.32, -0.52, 0.495, root)
  mesh(new BoxGeometry(0.39, 0.02, 0.022), bumpMat, 0.32, -0.25, 0.506, root)
  mesh(new BoxGeometry(0.39, 0.02, 0.022), bumpMat, 0.32, -0.79, 0.506, root)
  mesh(new BoxGeometry(0.02, 0.55, 0.022), bumpMat, 0.13, -0.52, 0.506, root)
  mesh(new BoxGeometry(0.02, 0.55, 0.022), bumpMat, 0.51, -0.52, 0.506, root)
  const doorDec = decal(doorSticker(theme.accentHex, hexOf(theme.accentSoft)), 0.22, 0.28, 0.32, -0.55, 0.508, root)
  // 锁
  mesh(new CylinderGeometry(0.012, 0.012, 0.01, 16), M.chrome, 0.32, -0.28, 0.51, root, false).rotation.x = Math.PI / 2

  /* ---------------- 控制台（摇杆 / 红按钮 / LCD） ---------------- */
  const ledge = mesh(new RoundedBoxGeometry(OX * 2 * 0.72, 0.08, 0.22, 3, 0.03), bumpMat, 0, -0.02, 0.58, root)
  ledge.rotation.x = 0.12
  const ledgeLbl = decal(ledgeLabel(theme.accentHex), 0.5, 0.09, 0, 0.02, 0.695, root)
  ledgeLbl.rotation.x = -0.12
  const stick = new Group()
  stick.position.set(-0.18, 0.03, 0.58)
  stick.rotation.x = 0.12
  root.add(stick)
  mesh(new CylinderGeometry(0.032, 0.034, 0.01, 28), M.chrome, 0, 0, 0, stick)
  mesh(new CylinderGeometry(0.0055, 0.0055, 0.07, 10), M.steel, 0, 0.04, 0, stick)
  mesh(new SphereGeometry(0.02, 24, 16), M.ballRed, 0, 0.082, 0, stick)
  const btn = new Group()
  btn.position.set(0.18, 0.032, 0.58)
  btn.rotation.x = 0.12
  root.add(btn)
  mesh(new CylinderGeometry(0.042, 0.044, 0.012, 32), M.chrome, 0, 0, 0, btn)
  mesh(new CylinderGeometry(0.034, 0.036, 0.018, 32), M.buttonRed, 0, 0.012, 0, btn)
  const lcd = mesh(new BoxGeometry(0.16, 0.07, 0.01), M.blackPlastic, 0, 0.028, 0.64, root)
  lcd.rotation.x = -0.2
  const lcdFace = mesh(
    new PlaneGeometry(0.14, 0.055),
    new MeshStandardMaterial({ color: 0x0e1a14, emissive: 0x1a3a28, emissiveIntensity: 0.6, roughness: 0.4 }),
    0,
    0.03,
    0.646,
    root,
    false,
  )
  lcdFace.rotation.x = -0.2

  /* ---------------- 脚轮 ---------------- */
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      mesh(new CylinderGeometry(0.035, 0.035, 0.02, 16), M.wheel, sx * 0.48, -PH + 0.02, sz * 0.28 - 0.05, root, false).rotation.z = Math.PI / 2
    }
  }

  /* ---------------- 上半截：铝合金立柱 + LED 灯带 ---------------- */
  const postG = new RoundedBoxGeometry(0.04, top + 0.02, 0.04, 2, 0.005)
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) mesh(postG, M.alu, sx * (hx + 0.02), top / 2, sz * (hz + 0.02), root)
  }
  mesh(new BoxGeometry(hx * 2 + 0.08, 0.025, 0.04), M.alu, 0, 0.0, hz + 0.02, root)

  const ledStrips: Mesh[] = []
  const ledMat = track(M.ledStrip, 'led')
  for (const sx of [-1, 1]) {
    ledStrips.push(mesh(new BoxGeometry(0.012, top - 0.04, 0.012), ledMat, sx * (hx + 0.005), top / 2, hz + 0.008, root, false))
  }
  ledStrips.push(mesh(new BoxGeometry(hx * 2 - 0.04, 0.01, 0.01), ledMat, 0, top - 0.02, hz + 0.008, root, false))
  ledStrips.push(mesh(new BoxGeometry(hx * 2 - 0.04, 0.01, 0.01), ledMat, 0, 0.02, hz + 0.008, root, false))

  /* ---------------- 三面玻璃 ---------------- */
  const smudge = new MeshBasicMaterial({ map: glassSmudge(), transparent: true, opacity: 0.14, depthWrite: false })
  const reflMat = new MeshBasicMaterial({ map: glassReflection(), transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false })
  const addPane = (w: number, x: number, z: number, ry: number, smudged: boolean) => {
    const g = new PlaneGeometry(w, top)
    const a = mesh(g, M.glassTint, x, top / 2, z, root, false)
    a.rotation.y = ry
    a.renderOrder = 3
    const b = mesh(g, M.glassRefl, x, top / 2, z, root, false)
    b.rotation.y = ry
    b.renderOrder = 4
    if (smudged) {
      const c = mesh(g, smudge, x, top / 2, z + 0.001, root, false)
      c.rotation.y = ry
      c.renderOrder = 5
      const r = mesh(g, reflMat, x, top / 2, z + 0.0015, root, false)
      r.rotation.y = ry
      r.renderOrder = 6
    }
  }
  addPane(hx * 2, 0, hz + 0.01, 0, true)
  addPane(hz * 2, -hx - 0.01, 0, -Math.PI / 2, false)
  addPane(hz * 2, hx + 0.01, 0, Math.PI / 2, false)

  /* ---------------- 柜内横幅 + 背板海报 ---------------- */
  {
    const ban = labelTexture('HAPPY GAMES  ·  PAW PLAY', '#ffffff', theme.accentHex, 512, 64, 'bold 36px sans-serif')
    for (const y of [0.18, top - 0.12]) {
      const b = decal(ban, hx * 1.7, 0.045, 0, y, -hz + 0.01, root)
      const bm = b.material as MeshStandardMaterial
      bm.emissiveMap = ban
      bm.emissive.setHex(0xffffff)
      bm.emissiveIntensity = 0.4
    }
  }
  const softHex = hexOf(theme.accentSoft)
  const bb = backboardPrint(theme.accentHex, softHex)
  const backMesh = mesh(
    new PlaneGeometry(hx * 2, top),
    new MeshStandardMaterial({ map: bb, roughness: 0.55, emissive: 0xffffff, emissiveMap: bb, emissiveIntensity: 0.22 }),
    0,
    top / 2,
    -hz - 0.002,
    root,
    false,
  )

  /* ---------------- 池底地垫（挖掉取物洞） ---------------- */
  {
    const fs = new Shape()
    fs.moveTo(-hx, -hz)
    fs.lineTo(hx, -hz)
    fs.lineTo(hx, hz)
    fs.lineTo(HOLE.x1, hz)
    fs.lineTo(HOLE.x1, HOLE.z0)
    fs.lineTo(-hx, HOLE.z0)
    fs.lineTo(-hx, -hz)
    const fGeo = new ShapeGeometry(fs)
    fGeo.rotateX(Math.PI / 2)
    const floor = new Mesh(
      fGeo,
      new MeshStandardMaterial({
        map: feltPlain(),
        roughness: 0.97,
        normalMap: fabricNormal(),
        normalScale: new Vector2(0.35, 0.35),
        side: DoubleSide,
      }),
    )
    floor.receiveShadow = true
    floor.position.y = 0.003
    root.add(floor)
  }

  /* ---------------- 取物通道 + 亚克力围栏 ---------------- */
  {
    const pitW = HOLE.x1 - HOLE.x0
    const pitD = HOLE.z1 - HOLE.z0
    const pitH = 0.4
    const pit = new Mesh(new BoxGeometry(pitW, pitH, pitD), new MeshStandardMaterial({ color: 0x141416, roughness: 0.9, side: BackSide }))
    pit.position.set((HOLE.x0 + HOLE.x1) / 2, -pitH / 2 - 0.002, (HOLE.z0 + HOLE.z1) / 2)
    root.add(pit)
    const bh = 0.11
    const b1 = mesh(new PlaneGeometry(pitW, bh), M.acrylic, (HOLE.x0 + HOLE.x1) / 2, bh / 2, HOLE.z0 - 0.004, root, false)
    b1.renderOrder = 2
    const b2 = mesh(new PlaneGeometry(pitD, bh), M.acrylic, HOLE.x1 + 0.004, bh / 2, (HOLE.z0 + HOLE.z1) / 2, root, false)
    b2.rotation.y = Math.PI / 2
    b2.renderOrder = 2
    mesh(new BoxGeometry(pitW, 0.006, 0.006), M.alu, (HOLE.x0 + HOLE.x1) / 2, bh, HOLE.z0 - 0.004, root)
    mesh(new BoxGeometry(0.006, 0.006, pitD), M.alu, HOLE.x1 + 0.004, bh, (HOLE.z0 + HOLE.z1) / 2, root)
    decal(
      labelTexture('出口', '#fff', theme.accentHex, 160, 64, 'bold 40px sans-serif'),
      0.07,
      0.028,
      (HOLE.x0 + HOLE.x1) / 2,
      bh * 0.62,
      HOLE.z0 - 0.0015,
      root,
    )
  }

  /* ---------------- 顶部灯箱 ---------------- */
  mesh(new RoundedBoxGeometry(OX * 2, 0.32, OZ * 2 - 0.04, 3, 0.02), M.body, 0, top + 0.16, 0, root)
  mesh(new BoxGeometry(OX * 2 + 0.004, 0.03, OZ * 2 - 0.036), bumpMat, 0, top + 0.01, 0, root)
  const sign = headerSign(theme.accentHex, softHex)
  const signMesh = new Mesh(
    new PlaneGeometry(1.08, 0.24),
    new MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.95, roughness: 0.25 }),
  )
  signMesh.position.set(0, top + 0.17, OZ - 0.014)
  root.add(signMesh)

  /* ---------------- 日光灯管 + 柜顶 ---------------- */
  const tubeG = new CylinderGeometry(0.009, 0.009, hx * 2 - 0.1, 12)
  tubeG.rotateZ(Math.PI / 2)
  mesh(tubeG, M.tube, 0, top - 0.025, hz - 0.04, root, false)
  mesh(tubeG, M.tube, 0, top - 0.025, -hz + 0.06, root, false)
  mesh(new PlaneGeometry(hx * 2, hz * 2), M.dark, 0, top - 0.002, 0, root, false).rotation.x = Math.PI / 2

  /* ---------------- 天车 ---------------- */
  for (const s of [-1, 1]) mesh(new BoxGeometry(0.02, 0.025, hz * 2), M.alu, s * (hx - 0.012), CARRIAGE_Y + 0.035, 0, root)
  const beam = new Group()
  root.add(beam)
  mesh(new BoxGeometry(hx * 2 - 0.02, 0.02, 0.028), M.alu, 0, CARRIAGE_Y + 0.025, 0, beam)
  for (const s of [-1, 1]) mesh(new BoxGeometry(0.04, 0.035, 0.05), M.blackPlastic, s * (hx - 0.012), CARRIAGE_Y + 0.035, 0, beam)
  const carriage = new Group()
  root.add(carriage)
  mesh(new RoundedBoxGeometry(0.075, 0.05, 0.07, 2, 0.006), M.blackPlastic, 0, CARRIAGE_Y + 0.005, 0, carriage)
  const pul = mesh(new CylinderGeometry(0.013, 0.013, 0.018, 16), M.steel, 0, CARRIAGE_Y - 0.02, 0, carriage)
  pul.rotation.z = Math.PI / 2
  const cg = new CylinderGeometry(0.0018, 0.0018, 1, 6)
  cg.translate(0, -0.5, 0)
  const cable = mesh(cg, M.steel, 0, 0, 0, root)

  /* ---------------- 爪子 ---------------- */
  const hub = new Group()
  root.add(hub)
  mesh(new CylinderGeometry(HUB_R, HUB_R * 0.94, HUB_HH * 2, 28), M.chrome, 0, 0, 0, hub)
  mesh(new CylinderGeometry(0.014, HUB_R * 0.95, 0.034, 24), M.blackPlastic, 0, HUB_HH + 0.017, 0, hub)
  mesh(new CylinderGeometry(HUB_R * 1.02, HUB_R * 1.02, HUB_HH * 0.7, 28), M.steel, 0, -HUB_HH * 0.15, 0, hub)
  mesh(new CylinderGeometry(0.006, 0.006, 0.012, 10), M.steel, 0, -HUB_HH - 0.004, 0, hub)
  const prongs: Object3D[] = []
  for (const az of PRONG_AZ) {
    const g = new Group()
    // 方位角在外层：三个指头绕 Y 各转 120°
    /*
      ★★ 必须挂在 **`hub`** 下面，不能挂 `root`。

      参考实现挂的是 `root`，但它每一帧都用物理刚体的位姿**覆盖**这三个
      Group 的 `position/quaternion`（`main.ts`: `machine.prongs[i].position.set(p.x,…)`），
      所以挂在哪儿都一样。我们改成「只摆 `inner.rotation.z`」之后，
      外层 Group 的位置**再也没人写** —— 挂 `root` 就等于把三个指头
      钉在柜子原点（池子正中的娃娃堆里），画面上根本看不到爪子。

      2026-10-19 实测症状：玻璃里只有 hub 和一根缆绳，三个钩子「消失」。
      ➜ 挂 `hub`：`hub.position` 每帧都在动，指头自然跟着走，
        而且物理读 `inner.matrixWorld` 时也会带上 hub 的位移。
    */
    g.rotation.y = az
    hub.add(g)
    const inner = new Group()
    /*
      ★ 指根在 hub **底面外缘**（`PIVOT_R`），不是 hub 中心。
      省掉这一行，三个指头会从轴心长出来、合拢时互相穿过去。

      ★★ 物理层读的就是**这一层**的 `matrixWorld`（位置 = 指根、旋转 = 方位角 × 开合角），
        碰撞体按 `PRONG_PTS` 摆 —— 所以「看得见的钩子」和「摸得到的钩子」是同一个位姿。
    */
    inner.position.set(PIVOT_R, -HUB_HH, 0)
    g.add(inner)
    const curve = new CatmullRomCurve3(PRONG_PTS.map(([rr, y]) => V(rr, y, 0)), false, 'centripetal')
    mesh(new TubeGeometry(curve, 28, PRONG_RADIUS, 8, false), M.chrome, 0, 0, 0, inner)
    const last = PRONG_PTS[PRONG_PTS.length - 1]
    const prev = PRONG_PTS[PRONG_PTS.length - 2]
    const tip = mesh(
      new CapsuleGeometry(PRONG_RADIUS * 1.3, 0.02, 4, 10),
      M.rubber,
      (last[0] + prev[0]) / 2,
      (last[1] + prev[1]) / 2,
      0,
      inner,
    )
    tip.quaternion.setFromUnitVectors(V(0, 1, 0), V(last[0] - prev[0], last[1] - prev[1], 0).normalize())
    const pin = mesh(new CylinderGeometry(0.006, 0.006, 0.02, 10), M.steel, 0, 0, 0, inner)
    pin.rotation.x = Math.PI / 2
    prongs.push(inner)
  }

  return {
    root,
    beam,
    carriage,
    cable,
    hub,
    prongs,
    doorPos: V(PICKUP.x, PICKUP.y, PICKUP.z),
    ledStrips,
    prizeRing,
    themeables,
    signMesh,
    backMesh,
    ledgeLbl,
    doorDec,
    ringDec,
  }
}

/**
 * 商场：一块瓷砖地 + 一面白墙。
 *
 * ★ **不画邻居柜子** —— 参考实现两侧摆了 6 台，家长 2026-10-16 说过
 *   「娃娃机只用显示一台」。这两块只在画幅两侧有空白时才显示
 *   （见 `clawScene.resize`），贴着柜子看的时候根本用不上。
 */
export function buildRoom(): Group {
  const room = new Group()
  const floor = new Mesh(
    new PlaneGeometry(16, 16),
    new MeshStandardMaterial({ map: floorTiles(), roughness: 0.4, metalness: 0.05 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -1.0
  floor.receiveShadow = true
  room.add(floor)
  const wall = new Mesh(new PlaneGeometry(18, 6), new MeshStandardMaterial({ color: 0xf0eeea, roughness: 0.92 }))
  wall.position.set(0, 2, -1.6)
  room.add(wall)
  return room
}

/**
 * 给 `PMREMGenerator` 用的环境：一个大暗盒 + 顶上一排发光面板 + 几块「隔壁店铺」。
 *
 * ★★ 为什么不用 three 自带的 `RoomEnvironment`：那是「摄影棚」—— 四周一圈
 *   白色柔光箱，从**所有方向**均匀照亮，会把娃娃之间的接触阴影从下面填平。
 *   这里要的是「商场顶灯 + 远处的店招」，有方向、有亮暗。
 */
export function buildEnvScene(): import('three').Scene {
  const s = new Scene()
  const box = new Mesh(new BoxGeometry(16, 5, 16), new MeshStandardMaterial({ color: 0xe8e4de, side: BackSide, roughness: 1 }))
  box.position.y = 1.5
  s.add(box)
  const panel = new MeshStandardMaterial({ color: 0x000000, emissive: 0xfff6ea, emissiveIntensity: 10 })
  for (let x = -6; x <= 6; x += 2.4) {
    for (let z = -6; z <= 6; z += 2.4) {
      const p = new Mesh(new PlaneGeometry(1.2, 0.35), panel)
      p.rotation.x = Math.PI / 2
      p.position.set(x, 3.95, z)
      s.add(p)
    }
  }
  const shop = (c: number, x: number, z: number, ry: number, w = 3, i = 1.8) => {
    const m = new Mesh(new PlaneGeometry(w, 1.2), new MeshStandardMaterial({ color: 0x000000, emissive: c, emissiveIntensity: i }))
    m.position.set(x, 1.2, z)
    m.rotation.y = ry
    s.add(m)
  }
  shop(0xfff0f5, 0, 7.9, Math.PI, 6, 2.4)
  shop(0xffe8a0, -7.9, 2, Math.PI / 2)
  shop(0xb8f0f6, 7.9, -1, -Math.PI / 2)
  shop(0xf47aa8, 3, 7.9, Math.PI, 1.5, 1.6)
  s.add(new HemisphereLight(0xfff5f0, 0xb0a898, 0.7))
  return s
}
