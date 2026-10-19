/**
 * 毛绒娃娃的**模型** —— 逐字抄参考实现（`claw-machine/src/plush.ts`）。
 *
 * 一只娃娃 = 一堆基本体按材质合并成几个 mesh（一次 draw call 一个材质），
 * 再叠一层「毛壳」（`InstancedMesh` + 顶点沿法线外推 + 片元按噪声裁掉），
 * 外加一个顶点着色器里的软体变形：撞击压扁、爪子按出的凹坑、陷进池底。
 *
 * ---------------------------------------------------------------------------
 * ★ 为什么值得抄
 * ---------------------------------------------------------------------------
 *
 * 我们自己那版是「球 + 球 + 球」：身子一个球、两只耳朵两个球、加个鼻子。
 * 远看是**一坨毛球**，近看没有脸、没有接缝、没有标签 ——
 * 而娃娃机画面里**娃娃占了三分之一的像素**，这就是「跟原版不一样」的大头。
 *
 * 原版每只娃娃有：脸颊 / 肚子（浅一号的同色布）、眼睛（带高光）、
 * 嘴（缝线）、腮红、耳朵内侧（粉色布）、四肢、尾巴 / 喙 / 猪鼻、
 * 侧缝的洗水标。而且**同一只**的耳朵角度、腮红位置都带一点点随机偏移
 * （`seed` 决定），所以一池子摆出来不像复制粘贴。
 *
 * ⚠️ 这里的尺寸是**世界单位**（一只约 0.09 宽），和 `prizeTypes.ts` 的
 *   碰撞体尺寸是同一套比例。改一边必须改另一边。
 */
import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  Group,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Texture,
  TorusGeometry,
  Vector2,
  Vector3,
  Vector4,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { fabricDetail, fabricNormal, furNoise } from './textures'
import type { PrizeType } from './prizeTypes'

const V = (x = 0, y = 0, z = 0) => new Vector3(x, y, z)
const E = (x = 0, y = 0, z = 0) => new Euler(x, y, z)

/* ============================ 毛壳 ============================ */

/**
 * 毛壳的全局 uniform（所有娃娃共用一份）。
 *
 * `uShells` 是层数，`uFurLen` 是毛长。层数越多越像毛绒，代价是 **draw call × 层数**
 * —— 30 只娃娃 × 5 个材质 × 6 层，只有开了 InstancedMesh 才扛得住。
 */
export const furGlobals = { uShells: { value: 6 }, uFurLen: { value: 0.0032 }, uFurTex: { value: null as Texture | null } }
let furCount = 6
const allFur = new Set<InstancedMesh>()

/** 低端机降级：把毛壳层数调小（0 = 完全不要毛壳）。 */
export function setFurShells(n: number): void {
  furCount = n
  furGlobals.uShells.value = Math.max(1, n)
  for (const m of allFur) {
    m.count = n
    m.visible = n > 0
  }
}

/* ============================ 材质 ============================ */

export interface PlushUniforms {
  uCenter: { value: Vector3 }
  uDent: { value: Vector4[] }
  uSquash: { value: Vector4 }
  uFloorY: { value: number }
}

export function makePlushUniforms(): PlushUniforms {
  return {
    uCenter: { value: V() },
    uDent: { value: [new Vector4(0, 0, 0, 0), new Vector4(0, 0, 0, 0), new Vector4(0, 0, 0, 0)] },
    uSquash: { value: new Vector4(0, 1, 0, 0) },
    uFloorY: { value: 0 },
  }
}

const WHITE = new Color(0xffffff)

/**
 * 毛绒材质。
 *
 * 三件事叠起来才像毛绒（少一件就是「哑光塑料球」）：
 *   ① `sheen` —— 布料边缘的绒光（这是最关键的，漫反射做不出来）；
 *   ② 纤维法线贴图 —— 表面有方向性的细碎起伏；
 *   ③ 缝线 albedo —— 球面 UV 的两侧接缝。
 */
function plushMaterial(color: number, u: PlushUniforms, fur: boolean): MeshPhysicalMaterial {
  const c = new Color(color)
  const m = new MeshPhysicalMaterial({
    color: c,
    roughness: 0.96,
    metalness: 0,
    sheen: 0.8,
    sheenRoughness: 0.5,
    sheenColor: c.clone().lerp(WHITE, 0.3),
    map: fabricDetail(),
    normalMap: fabricNormal(),
    normalScale: new Vector2(0.5, 0.5),
  })
  furGlobals.uFurTex.value = furNoise()
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, furGlobals)
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform vec3 uCenter; uniform vec4 uDent[3]; uniform vec4 uSquash; uniform float uFloorY; uniform float uShells; uniform float uFurLen;
varying float vShell;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vShell = 0.0;
${fur ? 'vShell = float(gl_InstanceID + 1) / uShells; transformed += normalize(objectNormal) * uFurLen * vShell; transformed.y -= uFurLen * 0.35 * vShell * vShell;' : ''}
{ float ax = dot(transformed, uSquash.xyz);
  transformed += uSquash.xyz * ax * (-uSquash.w) + (transformed - uSquash.xyz * ax) * (uSquash.w * 0.55); }
for (int i = 0; i < 3; i++) {
  if (uDent[i].w <= 0.0) continue;
  float dd = length(transformed - uDent[i].xyz);
  float f = clamp(1.0 - dd / 0.034, 0.0, 1.0); f = f * f * (3.0 - 2.0 * f);
  transformed -= normalize(uDent[i].xyz + vec3(1e-5)) * uDent[i].w * f;
}`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 wp0 = modelMatrix * vec4(transformed, 1.0);
{ float pen = uFloorY - wp0.y; if (pen > 0.0) { vec2 o = wp0.xz - uCenter.xz; float lo = length(o); wp0.y = uFloorY - pen * 0.15; if (lo > 1e-4) wp0.xz += o / lo * pen * 0.45; } }
vec4 mvPosition = viewMatrix * wp0;
gl_Position = projectionMatrix * mvPosition;`,
      )
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vShell; uniform sampler2D uFurTex;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
${fur ? '{ float n = texture2D(uFurTex, vMapUv * vec2(16.0, 8.0)).r; if (n < vShell) discard; diffuseColor.rgb *= mix(0.74, 1.1, vShell); }' : 'diffuseColor.rgb *= 0.9;'}`,
      )
  }
  m.customProgramCacheKey = () => (fur ? 'plush-fur' : 'plush')
  m.userData.plush = true
  if (fur) m.userData.fur = true
  return m
}

/* ============================ 小零件材质 ============================ */

const MAT = {
  eye: new MeshPhysicalMaterial({ color: 0x0b0b10, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 }),
  tag: new MeshStandardMaterial({ color: 0xf2efe8, roughness: 0.85, side: 2 }),
  tagPrint: new MeshStandardMaterial({ color: 0x9a3a34, roughness: 0.85 }),
  eyeHi: new MeshBasicMaterial({ color: 0xffffff }),
  eyeWhite: new MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
  thread: new MeshStandardMaterial({ color: 0x3a2420, roughness: 0.95 }),
  nose: new MeshPhysicalMaterial({ color: 0x3a2018, roughness: 0.25, clearcoat: 0.8 }),
  felt: new MeshStandardMaterial({ color: 0xcf8a3e, roughness: 0.9 }),
  ribbon: new MeshPhysicalMaterial({ color: 0x9c3a40, roughness: 0.45, sheen: 0.7, sheenColor: new Color(0xd9a0a6), sheenRoughness: 0.4 }),
  blush: new MeshStandardMaterial({ color: 0xd88f8c, roughness: 1, transparent: true, opacity: 0.32, depthWrite: false }),
}

const sphere = new SphereGeometry(1, 24, 16)
const sphereLo = new SphereGeometry(1, 14, 10)
const cone = new ConeGeometry(1, 1, 14)
const cyl = new CylinderGeometry(1, 1, 1, 16)
const box = new BoxGeometry(1, 1, 1)
const smile = new TorusGeometry(0.0055, 0.0011, 5, 14, Math.PI)
const capsule = (r: number, hh: number) => new CapsuleGeometry(r, hh * 2, 6, 18)

/* ============================ 拼装 ============================ */

class Builder {
  parts = new Map<Material, BufferGeometry[]>()
  add(geo: BufferGeometry, mat: Material, p: Vector3, s: Vector3 | number, rot?: Euler) {
    const m = new Matrix4().compose(p, new Quaternion().setFromEuler(rot ?? E()), typeof s === 'number' ? V(s, s, s) : s)
    const g = geo.index ? geo.toNonIndexed() : geo.clone()
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name)
    g.applyMatrix4(m)
    const arr = this.parts.get(mat) ?? []
    arr.push(g)
    this.parts.set(mat, arr)
  }
  build(furFor: Map<Material, Material>) {
    const grp = new Group()
    for (const [mat, geos] of this.parts) {
      const geo = mergeGeometries(geos)
      const mesh = new Mesh(geo, mat)
      const tr = (mat as MeshStandardMaterial).transparent
      mesh.castShadow = !tr && !!mat.userData.plush
      mesh.receiveShadow = !tr
      grp.add(mesh)
      const furMat = furFor.get(mat)
      if (furMat) {
        const fm = new InstancedMesh(geo, furMat, 10)
        fm.count = furCount
        fm.visible = furCount > 0
        fm.castShadow = false
        fm.receiveShadow = true
        allFur.add(fm)
        grp.add(fm)
      }
    }
    return grp
  }
}

export interface PlushModel {
  group: Group
  u: PlushUniforms
}

export function disposePlush(m: PlushModel): void {
  m.group.traverse((o) => {
    if ((o as InstancedMesh).isInstancedMesh) allFur.delete(o as InstancedMesh)
    const mesh = o as Mesh
    if (mesh.isMesh) {
      mesh.geometry.dispose()
      const mt = mesh.material as Material
      if (mt.userData.plush) mt.dispose()
    }
  })
}

/**
 * 造一只娃娃。
 *
 * `seed` 决定「这一只」的细节偏移（颜色微偏、耳朵角度、腮红位置、标签朝哪边）——
 * 同一个 seed 永远造出同一只，走查才能复现。
 */
export function buildPrize(type: PrizeType, color: number, seed = 0.5): PlushModel {
  const u = makePlushUniforms()
  // 确定性扰动：颜色微偏 + 缝合不对称 + 耳朵角度
  let st = Math.floor(seed * 2147483646) + 1
  const r = () => (st = (st * 16807) % 2147483647) / 2147483647
  const j = (a: number) => (r() * 2 - 1) * a
  {
    const hsl = { h: 0, s: 0, l: 0 }
    const cc = new Color(color)
    cc.getHSL(hsl)
    cc.setHSL(hsl.h + j(0.012), Math.max(0, hsl.s * (0.9 + j(0.12))), hsl.l * (0.95 + j(0.06)))
    color = cc.getHex()
  }
  const b = new Builder()
  const furFor = new Map<Material, Material>()
  const cache = new Map<number, Material>()
  const F = (col: number) => {
    let m = cache.get(col)
    if (!m) {
      m = plushMaterial(col, u, false)
      cache.set(col, m)
      furFor.set(m, plushMaterial(col, u, true))
    }
    return m
  }
  const base = F(color)
  const light = F(new Color(color).lerp(new Color(0xf0e7d8), 0.55).getHex())
  const pink = F(0xd6a3a0)
  const eyes = (y: number, z: number, dx: number, rr = 0.0062, tilt = 0) => {
    for (const s of [-1, 1]) b.add(sphereLo, MAT.eye, V(s * dx + j(0.0012), y + j(0.0012), z + 0.0026), V(rr, rr * 1.12, rr * 0.75), E(-tilt, 0, 0))
  }
  const mouth = (y: number, z: number, tiltX = 0.25) => {
    for (const s of [-1, 1]) b.add(smile, MAT.thread, V(s * 0.0054, y, z + 0.0022), 1, E(tiltX, 0, Math.PI))
  }
  const blush = (y: number, z: number, dx: number, rotY = 0.5) => {
    for (const s of [-1, 1]) b.add(sphereLo, MAT.blush, V(s * dx, y, z + 0.0028), V(0.0085, 0.0052, 0.0015), E(0, s * rotY, 0))
  }

  switch (type.id) {
    case 'bear': {
      b.add(sphere, base, V(0, 0, 0), V(0.045, 0.047, 0.042))
      b.add(sphere, light, V(0, -0.006, 0.027), V(0.028, 0.03, 0.018))
      b.add(sphere, base, V(0, 0.07, 0.004), V(0.048, 0.044, 0.044))
      b.add(sphere, light, V(0, 0.06, 0.041), V(0.021, 0.016, 0.012))
      b.add(sphereLo, MAT.nose, V(0, 0.066, 0.0545), V(0.0085, 0.006, 0.0055))
      mouth(0.0555, 0.0515)
      eyes(0.079, 0.0435, 0.0175, 0.0064, 0.15)
      blush(0.064, 0.042, 0.03)
      for (const s of [-1, 1]) {
        b.add(sphere, base, V(s * 0.035, 0.106, 0), V(0.016, 0.016, 0.0095), E(0, 0, j(0.25)))
        b.add(sphere, pink, V(s * 0.035, 0.105, 0.0058), V(0.0095, 0.0095, 0.004))
        b.add(capsule(0.0165, 0.012), base, V(s * 0.043, 0.004, 0.016), 1, E(0.6, 0, s * 0.75))
        b.add(sphere, base, V(s * 0.023, -0.037, 0.022), V(0.02, 0.018, 0.024))
        b.add(sphere, light, V(s * 0.023, -0.039, 0.043), V(0.012, 0.011, 0.004))
      }
      if (r() < 0.5) {
        b.add(cone, MAT.ribbon, V(-0.011, 0.031, 0.036), V(0.009, 0.018, 0.006), E(0, 0, Math.PI / 2))
        b.add(cone, MAT.ribbon, V(0.011, 0.031, 0.036), V(0.009, 0.018, 0.006), E(0, 0, -Math.PI / 2))
        b.add(sphereLo, MAT.ribbon, V(0, 0.031, 0.038), 0.0045)
      }
      break
    }
    case 'bunny': {
      b.add(sphere, base, V(0, 0, 0), V(0.041, 0.043, 0.039))
      b.add(sphere, light, V(0, -0.004, 0.025), V(0.024, 0.027, 0.016))
      b.add(sphere, base, V(0, 0.064, 0.004), V(0.045, 0.041, 0.041))
      b.add(sphereLo, pink, V(0, 0.062, 0.0465), V(0.0055, 0.0042, 0.003))
      mouth(0.0545, 0.0435)
      eyes(0.072, 0.039, 0.016, 0.0062, 0.1)
      blush(0.058, 0.038, 0.027)
      for (const s of [-1, 1]) {
        b.add(capsule(0.012, 0.022), base, V(s * 0.017, 0.128, -0.004), V(1, 1, 0.55), E(j(0.2), 0, -s * 0.16 + j(0.22)))
        b.add(capsule(0.007, 0.018), pink, V(s * 0.0175, 0.128, 0.0016), V(1, 1, 0.3), E(0, 0, -s * 0.16))
        b.add(sphere, base, V(s * 0.021, -0.035, 0.02), V(0.017, 0.015, 0.022))
        b.add(capsule(0.012, 0.01), base, V(s * 0.037, 0.002, 0.021), 1, E(0.5, 0, s * 0.5))
      }
      b.add(sphere, F(0xffffff), V(0, -0.012, -0.041), 0.014)
      break
    }
    case 'chick': {
      b.add(sphere, base, V(0, 0, 0), V(0.054, 0.052, 0.053))
      b.add(cone, MAT.felt, V(0, 0.004, 0.056), V(0.0095, 0.016, 0.009), E(Math.PI / 2, 0, 0))
      eyes(0.017, 0.0485, 0.019, 0.0068)
      blush(0.0, 0.048, 0.031, 0.6)
      for (const s of [-1, 1]) {
        b.add(sphere, base, V(s * 0.05, -0.004, -0.002), V(0.01, 0.023, 0.018), E(0, 0, s * 0.4))
        b.add(sphere, MAT.felt, V(s * 0.018, -0.05, 0.02), V(0.012, 0.005, 0.016))
      }
      for (let i = -1; i <= 1; i++) b.add(sphere, base, V(i * 0.008, 0.056, -0.004), V(0.006, 0.013, 0.006), E(0, 0, i * 0.45))
      break
    }
    case 'penguin': {
      b.add(capsule(0.044, 0.026), base, V(0, 0.01, 0), 1)
      b.add(capsule(0.04, 0.02), F(0xece8df), V(0, 0.002, 0.019), V(0.84, 0.98, 0.78))
      b.add(cone, MAT.felt, V(0, 0.036, 0.048), V(0.008, 0.014, 0.006), E(Math.PI / 2, 0, 0))
      for (const s of [-1, 1]) {
        b.add(sphereLo, MAT.eyeWhite, V(s * 0.0145, 0.05, 0.0405), V(0.0085, 0.0095, 0.004))
        b.add(sphereLo, MAT.eye, V(s * 0.0145, 0.0495, 0.0435), V(0.0048, 0.0058, 0.003))
        b.add(sphere, base, V(s * 0.045, 0.004, 0), V(0.008, 0.028, 0.016), E(0, 0, s * 0.35))
        b.add(sphere, MAT.felt, V(s * 0.017, -0.06, 0.018), V(0.013, 0.005, 0.017))
      }
      blush(0.036, 0.04, 0.027)
      break
    }
    default: {
      // pig
      b.add(sphere, base, V(0, 0, 0), V(0.056, 0.054, 0.055))
      const snout = F(new Color(color).multiplyScalar(0.86).getHex())
      b.add(cyl, snout, V(0, -0.003, 0.054), V(0.019, 0.012, 0.014), E(Math.PI / 2, 0, 0))
      for (const s of [-1, 1]) {
        b.add(sphereLo, MAT.nose, V(s * 0.006, -0.003, 0.0625), V(0.003, 0.0045, 0.002))
        b.add(sphere, base, V(s * 0.03, 0.047, -0.004), V(0.017, 0.015, 0.006), E(0.35 + j(0.15), 0, -s * 0.6 + j(0.2)))
        b.add(sphere, snout, V(s * 0.026, -0.046, 0.016), V(0.014, 0.012, 0.016))
      }
      mouth(-0.02, 0.0525, 0.6)
      eyes(0.023, 0.051, 0.021, 0.0064)
      blush(0.008, 0.051, 0.036, 0.6)
    }
  }
  // 侧缝上的洗水标
  {
    const side = r() < 0.5 ? -1 : 1
    const ty = type.id === 'chick' || type.id === 'pig' ? -0.03 : -0.022
    const tx = side * (type.id === 'chick' || type.id === 'pig' ? 0.036 : 0.026)
    const rot = E(j(0.3), side * 0.9, j(0.4) + side * 0.2)
    b.add(box, MAT.tag, V(tx, ty - 0.012, -0.027), V(0.014, 0.026, 0.0012), rot)
    b.add(box, MAT.tagPrint, V(tx, ty - 0.006, -0.027), V(0.0145, 0.003, 0.0014), rot)
  }
  return { group: b.build(furFor), u }
}
