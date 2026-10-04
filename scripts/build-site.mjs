/**
 * 官网构建
 * ------------------------------------------------------------
 * site/ 是**纯静态**目录，没有构建步骤 —— 直接把整个目录丢到任意静态托管
 * （Nginx / OSS / 对象存储 / Vercel）就能用，备案也只需要这一个目录。
 *
 * 但其中有两块是「生成物」，改了 App 之后要重新生成：
 *   ① site/app/       —— App 的 Web 构建产物（官网里的「在线体验」就是它）
 *   ② site/img/*.png  —— 从 App 界面截图压缩来的
 * 这个脚本把两件事串起来，省得每次手敲。
 *
 * 用法：
 *   node scripts/build-site.mjs             # 全量：构建 App + 复制 + 出图
 *   node scripts/build-site.mjs --no-build  # 跳过 vite build，只复制 dist/ 和出图
 *   node scripts/build-site.mjs --no-shots  # 跳过界面截图（不想重截时用）
 *
 * ⚠️ 界面截图来自 `.e2e-scratch/landing-shots/`，要先跑：
 *      node scripts/capture.mjs http://127.0.0.1:5180/ .e2e-scratch/landing-shots
 *    没跑过就只会跳过那一步，不会报错。
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const SITE = resolve(ROOT, 'site')
const DIST = resolve(ROOT, 'dist')
const APP_OUT = resolve(SITE, 'app')

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--no-build')
const skipShots = args.has('--no-shots')

const sh = (cmd, argv) => {
  console.log(`\n$ ${cmd} ${argv.join(' ')}`)
  execFileSync(cmd, argv, { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' })
}

/* ---------- 1. 构建 App ---------- */
if (skipBuild) {
  console.log('① 跳过构建（--no-build），直接用现有的 dist/')
} else {
  console.log('① 构建 App → dist/')
  sh('npm', ['run', 'build'])
}

if (!existsSync(DIST)) {
  console.error('✗ 找不到 dist/，先跑一次 npm run build（或去掉 --no-build）')
  process.exit(1)
}

/* ---------- 2. dist → site/app ---------- */
// 先整个删掉再拷：vite 每次产出的是带 hash 的文件名，
// 不删旧的会在 site/app/assets/ 里堆出一大堆再也引用不到的残留。
// 删不掉时**不要中断** —— 直接覆盖也能得到一个完整的 App，
// 只是 assets/ 里可能留下几份用不到的旧 hash 文件。
// （某些带回收站拦截的环境里 rmSync 会失败，这里必须容错。）
if (existsSync(APP_OUT)) {
  try {
    rmSync(APP_OUT, { recursive: true, force: true })
  } catch {
    console.warn(
      '⚠️ 清不掉旧的 site/app/（多半是回收站机制拦住了删除）。\n' +
        '   改为直接覆盖：功能完整，但 site/app/assets/ 里可能残留旧 hash 文件。',
    )
  }
}
mkdirSync(APP_OUT, { recursive: true })
cpSync(DIST, APP_OUT, { recursive: true })
console.log(`② dist/ → site/app/  ✓`)

/* ---------- 2b. 安装包 → site/download ---------- */
// site/download/ 在 .gitignore 里（安装包是产物，不该进版本库），
// 所以这一步是**唯一的**生成方式 —— 少了它，克隆下来点「下载 APK」就是 404。
const DL_OUT = resolve(SITE, 'download')
/* ⚠️ 顺序 = 优先级：**release 在前**。
   2026-10-03 之前 debug 排第一，于是官网「下载 APK」给出去的是
   `kid-quest-farm-debug.apk`（5.8 MB、可调试），而 release 只有 4.4 MB。
   给用户试用的包不该是 debug 包。debug 保留为兜底（还没签过名时）。 */
const APK_CANDIDATES = [
  resolve(ROOT, 'dist-apk', 'kid-quest-farm-release.apk'),
  resolve(ROOT, 'android/app/build/outputs/apk/release/app-release.apk'),
  resolve(ROOT, 'dist-apk', 'kid-quest-farm-debug.apk'),
  resolve(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk'),
]
const apk = APK_CANDIDATES.find((p) => existsSync(p))
if (apk) {
  mkdirSync(DL_OUT, { recursive: true })
  cpSync(apk, resolve(DL_OUT, 'kid-quest-farm.apk'))
  console.log(
    `②b ${apk.replace(ROOT, '').replace(/\\/g, '/')} → site/download/kid-quest-farm.apk  ✓` +
      `（${(statSync(apk).size / 1024 / 1024).toFixed(1)} MB）`,
  )
} else {
  console.warn(
    '⚠️ 没找到 APK，site/download/ 会是空的（页面上「下载 APK」会 404）。\n' +
      '   先跑一次 bash scripts/build-apk.sh release，或手动把包放到\n' +
      '   dist-apk/kid-quest-farm-release.apk（没签名时 debug 包也能兜底）。',
  )
}

/* ---------- 3. 图标 / 分享图 / 界面截图 ---------- */
if (skipShots) {
  console.log('③ 跳过素材生成（--no-shots）')
} else {
  console.log('③ 生成图标、og-cover 与界面截图')
  // 依次试几个解释器。系统自带的 python 常常没装 Pillow，
  // 而项目里那个隔离 venv 是装了的 —— 不试一遍就会白白跳过素材生成。
  const candidates = [
    process.env.PY,
    'python',
    'python3',
    'C:/Users/admin/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe',
  ].filter(Boolean)

  let done = false
  let lastErr = ''
  for (const py of candidates) {
    try {
      sh(py, [resolve(ROOT, 'scripts', 'make-site-assets.py')])
      done = true
      break
    } catch (e) {
      lastErr = String(e.message ?? e).split('\n')[0]
    }
  }
  if (!done) {
    console.error(
      `⚠️ 素材生成失败，试过的解释器都不行（最后一条：${lastErr}）。\n` +
        '   site/ 其余部分不受影响。装上 Pillow 后重跑，或用 PY=<python 路径> node scripts/build-site.mjs。',
    )
  }
}

/* ---------- 4. 汇总 ---------- */
const size = (p) => {
  if (!existsSync(p)) return '—'
  const s = statSync(p)
  return s.isDirectory() ? '目录' : `${(s.size / 1024).toFixed(1)} KB`
}
console.log('\n产出：')
for (const f of [
  'index.html',
  'styles.css',
  'main.js',
  'privacy.html',
  'terms.html',
  'robots.txt',
  'sitemap.xml',
  'manifest.webmanifest',
  'og-cover.png',
]) {
  console.log(`  ${size(resolve(SITE, f)).padStart(10)}  site/${f}`)
}
console.log('  （另有 site/app/ 网页版、site/img/ 配图、site/download/ 安装包）')
console.log('\n本地预览：python -m http.server 5190 --directory site')
console.log('自检：    node scripts/check-site.mjs http://127.0.0.1:5190/')
