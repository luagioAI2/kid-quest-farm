/**
 * 插件包**接入规则**的机器校验 —— 以后每接一个新游戏，先跑这个。
 *
 * ```bash
 * node scripts/check-plugin.mjs public/games/prizepark/prizepark.plugin.mjs
 * node scripts/check-plugin.mjs ../prize-park-local/dist-plugin/prizepark.plugin.mjs --assets ../prize-park-local/assets
 * ```
 *
 * ## 为什么要有它
 *
 * `game-authoring-guide.md` 里那张清单是**给人看的**，而人一定会漏。
 * 这个项目已经吃过两次「清单上写着、实际没做、四层验收全绿」的亏：
 *
 *   · `mount` 必须同步返回卸载函数 → 第一个真插件就违反了，测试照不出来；
 *   · 插件样式必须收进根选择器 → 游戏自己的测试量的是游戏，量不到宿主。
 *
 * 所以把**能静态判定的**全部做成断言，一次跑完。
 *
 * ## 它检查什么 / 不检查什么
 *
 * | 能查 | 怎么查 |
 * | --- | --- |
 * | 单文件、零依赖 | 扫 `import ... from "x"` 的裸说明符、扫动态 `import()` |
 * | 导出形状 | 真的 `import()` 一次，看 `mount` / `manifest` |
 * | manifest 形状 | 复用宿主的 `describeManifestProblem`（**同一份实现**） |
 * | 宿主版本门 | `minHostApi ≤ HOST_API` |
 * | 经济闸门 | 复用 `checkPluginEconomy`（含「一局期望换出的券 < 成本」） |
 * | id 劫持 / 导航文案 | 撞内置 id、`tabLabel` 超 3 字 |
 * | 币的图标撞车 | 🪙 / 🎟️ / 💎 / 🕹️ 已经被占用 |
 * | 资源清单 | `assets/manifest.json` 每条的 sha256 与实际文件**逐字节对得上** |
 * | 体积 | 单文件 JS 的 gzip 估算 |
 *
 * | **不能**查 | 为什么 |
 * | --- | --- |
 * | CSS 有没有真的收进根选择器 | 需要真实布局。只能提示 `document.head` 的用法，
 *   真正的判据是浏览器里的**对照元素**（见 `_plugin-test.html` 的 `#ctlGrid`） |
 * | 卸载干不干净 | 要跑起来数 canvas / RAF。见 `prize-park-local/scripts/mount-test.cjs` |
 * | 观感 / 遮挡 | 四层验收的第 4 层，脚本永远代替不了截图走查 |
 */

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.dirname(HERE)

const argv = process.argv.slice(2)
const target = argv.find((a) => !a.startsWith('--'))
const assetsArg = argv.find((a) => a.startsWith('--assets='))
const jsonOut = argv.includes('--json')

if (!target) {
  console.error('用法: node scripts/check-plugin.mjs <包文件.mjs> [--assets=<资源目录>] [--json]')
  process.exit(2)
}

const abs = path.resolve(process.cwd(), target)
const rows = []
let failed = 0
let warned = 0

const pass = (msg, extra) => rows.push({ ok: true, msg, extra })
const fail = (msg, extra) => {
  failed++
  rows.push({ ok: false, msg, extra })
}
const warn = (msg, extra) => {
  warned++
  rows.push({ ok: null, msg, extra })
}

if (!fs.existsSync(abs)) {
  console.error('文件不存在:', abs)
  process.exit(2)
}

const code = fs.readFileSync(abs, 'utf8')
const bytes = Buffer.byteLength(code)
const gz = zlib.gzipSync(Buffer.from(code)).length

/* ---------------- 1. 单文件 / 零依赖 ---------------- */

// 裸说明符：`from "three"` 这种（blob 模块里解析不了）
const bare = [...code.matchAll(/(?:^|[;\n}])\s*(?:import|export)[^;]*?from\s*["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((s) => !/^[./]/.test(s) && !/^(blob:|data:|https?:)/.test(s))

const dyn = [...code.matchAll(/\bimport\s*\(\s*["']([^"']+)["']/g)].map((m) => m[1])

bare.length === 0 ? pass('没有裸模块说明符（blob 里能解析）') : fail('还有裸模块说明符', bare.slice(0, 5))
dyn.length === 0 ? pass('没有动态 import（不会产出第二个 chunk）') : fail('还有动态 import', dyn.slice(0, 5))

pass(`体积 ${(bytes / 1024 / 1024).toFixed(2)} MB（gzip ${(gz / 1024 / 1024).toFixed(2)} MB）`)

/* ---------------- 2. 真的 import 一次，看导出 ---------------- */

const hostPlugin = await import(pathToFileURL(path.join(ROOT, 'src/games/plugin.ts')).href)
const econMod = await import(pathToFileURL(path.join(ROOT, 'src/domain/pluginEconomy.ts')).href)
const { HOST_API, describeManifestProblem } = hostPlugin
const { checkPluginEconomy } = econMod

let mod
try {
  mod = await import(pathToFileURL(abs).href)
} catch (e) {
  fail('包执行失败（import() 抛）', String(e && e.message ? e.message : e).slice(0, 300))
}

const bundle = mod ? (mod.default ?? mod) : null

if (bundle) {
  typeof bundle.mount === 'function'
    ? pass('导出 mount(container, host, ctx)')
    : fail('没有可调用的 mount', typeof bundle.mount)

  const problem = describeManifestProblem(bundle.manifest)
  problem ? fail('manifest 形状不对', problem) : pass('manifest 形状正确')

  const m = bundle.manifest
  if (m && typeof m === 'object') {
    // 3. 版本门
    if (typeof m.minHostApi === 'number' && m.minHostApi <= HOST_API) {
      pass(`minHostApi ${m.minHostApi} ≤ 宿主 ${HOST_API}`)
    } else {
      fail(`minHostApi ${m.minHostApi} 高于宿主 ${HOST_API}（这个包装不上）`)
    }

    // 4. 导航文案
    const len = [...String(m.tabLabel ?? '')].length
    len <= 3 ? pass(`tabLabel「${m.tabLabel}」${len} 字`) : fail(`tabLabel「${m.tabLabel}」${len} 字，超过 3 字会挤`)

    // 5. id 劫持：内置 id 从 ids.ts 里读（不 import —— 那个文件是无扩展名相对导入）
    const idsSrc = fs.readFileSync(path.join(ROOT, 'src/games/ids.ts'), 'utf8')
    const builtinIds = [...idsSrc.matchAll(/=\s*['"]([a-z0-9-]+)['"]/g)].map((x) => x[1])
    builtinIds.includes(m.id)
      ? fail(`id「${m.id}」和内置游戏撞车（会被当成劫持）`)
      : pass(`id「${m.id}」不撞内置（${builtinIds.join(' / ')}）`)

    // 6. 币的图标不能和宿主那四套撞
    const TAKEN = ['🪙', '🎟️', '💎', '🕹️']
    TAKEN.includes(m.coin?.emoji)
      ? fail(`coin.emoji ${m.coin?.emoji} 已被宿主币占用（同屏会看不出在扣哪个）`)
      : pass(`coin.emoji ${m.coin?.emoji ?? '?'} 不和宿主币撞`)

    // 7. 经济闸门（复用宿主那份实现）
    const issue = checkPluginEconomy(m.economy)
    issue ? fail(`经济参数不合法（${issue.code}）`, issue.message) : pass('经济参数通过闸门')

    const e = m.economy ?? {}
    if (typeof e.voucherPerCoin === 'number' && e.voucherPerCoin > 0) {
      pass(`开放兑换：1 ${m.coin?.name ?? '币'} = ${e.voucherPerCoin} 兑换券`)
    } else {
      warn('没开放兑换（voucherPerCoin 缺省）：这个游戏的币只能玩，换不成兑换券')
    }
  }
}

/* ---------------- 8. 资源清单：哈希逐条对得上 ---------------- */

const assetsDir = assetsArg
  ? path.resolve(process.cwd(), assetsArg.split('=')[1])
  : path.join(path.dirname(abs), 'assets')

if (fs.existsSync(assetsDir)) {
  const manifestPath = path.join(assetsDir, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    warn('有 assets/ 但没有 manifest.json（发布方就没法逐个校验资源）', path.relative(ROOT, assetsDir))
  } else {
    let man
    try {
      man = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    } catch (e) {
      fail('assets/manifest.json 不是合法 JSON', String(e.message).slice(0, 200))
    }
    const list = Array.isArray(man?.assets) ? man.assets : null
    if (!list) {
      warn('assets/manifest.json 里没有 `assets` 数组（这份清单没法用来校验）')
    } else {
      const crypto = await import('node:crypto')
      let bad = 0
      let missing = 0
      for (const a of list) {
        const f = path.join(assetsDir, a.file ?? '')
        if (!a.file || !fs.existsSync(f)) {
          missing++
          continue
        }
        if (typeof a.sha256 !== 'string') {
          bad++
          continue
        }
        const h = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
        if (h !== a.sha256.toLowerCase()) bad++
      }
      if (missing === 0 && bad === 0) {
        pass(`资源清单 ${list.length} 条，哈希与文件逐条对得上`)
      } else {
        fail(`资源清单有问题：缺 ${missing} 个文件、${bad} 条哈希对不上`, path.relative(ROOT, assetsDir))
      }
    }
  }
} else {
  warn('没找到 assets/ 目录（如果游戏没有资源就忽略这条）')
}

/* ---------------- 9. 只能提示、不能判定的项 ---------------- */

if (code.includes('document.head')) {
  warn(
    '包里出现了 document.head —— 样式/节点是**全局**注入的。' +
      '必须确认所有选择器都收在自己的根类名下（否则会改写宿主的 Tailwind 工具类），' +
      '判据是浏览器里的对照元素，见 _plugin-test.html 的 #ctlGrid',
  )
}
if (/\bdocument\.body\b/.test(code)) {
  warn('包里引用了 document.body —— 弹层/抽屉应该 Portal 到宿主给的容器里，别挂到 body')
}

/* ---------------- 输出 ---------------- */

if (jsonOut) {
  console.log(JSON.stringify({ file: abs, failed, warned, rows }, null, 2))
} else {
  console.log(`\n检查 ${path.relative(process.cwd(), abs)}`)
  for (const r of rows) {
    console.log(`  ${r.ok === true ? '✓' : r.ok === false ? '✗' : '!'} ${r.msg}${r.extra === undefined ? '' : `\n      ${typeof r.extra === 'string' ? r.extra : JSON.stringify(r.extra)}`}`)
  }
  console.log(
    failed === 0
      ? `\n=== 通过（${warned} 条提示）===`
      : `\n=== 不通过：${failed} 条硬错误、${warned} 条提示 ===`,
  )
}

process.exit(failed ? 1 : 0)
