/**
 * 量出入场页（SplashPage）**首帧**的配色，算出安卓原生启动图该用什么颜色。
 *
 * 为什么需要这个脚本
 * ------------------------------------------------------------
 * APK 冷启动时屏幕上先后出现两样东西：
 *
 *   1. **原生启动图** —— 由 `android/app/src/main/res/drawable/splash.xml`（窗口背景）
 *      和 `capacitor.config.json` 的 `SplashScreen.backgroundColor`（Android 12+ 系统
 *      启动屏底色，只能是**一个纯色**）决定；
 *   2. **入场页 SplashPage** —— React 起来之后才画出来。
 *
 * 两边对不上，交接那 200ms 就会「闪一下」。SplashPage.tsx 的注释里写死了这条纪律
 * （「改这里的颜色或透明度，必须重新量一次首帧平均色并同步那个值」），但那个值是
 * **手抄**的 —— 改了暗罩颜色/透明度之后极容易忘了同步。
 *
 * ⚠️ 别用「读 CSS 自己算」的办法（试过，错得很离谱）。
 *    CSS 的多层背景 + 椭圆 radial + premultiplied alpha 插值，
 *    自己实现一遍跟浏览器的实际渲染对不上，量出来的渐变方向甚至是反的。
 *    **唯一的真值是浏览器画出来的像素**，所以这里用真 Chrome 截图再回读像素。
 *
 * 做法
 * ------------------------------------------------------------
 *   1. 开真 Chrome，390×844（跟项目里量亮度用的机器一致）；
 *   2. 把入场动画全部停掉 —— 停掉之后 `.anim-dawn-lift` 的 opacity 就是它的
 *      基础值 1，正好是首帧该有的状态；
 *   3. 把中间那坨内容（插画卡 / 标题 / 格言 / 三个点）藏掉，**只留两层背景** ——
 *      首帧那一瞬间插画还没弹进来，量「带插画的平均色」会把背景算浅；
 *   4. 截图，丢回页面里用 canvas 读像素（省得在 Node 侧手写 PNG 解码）；
 *   5. 按行求横向平均 → 上/中/下三站（Android 的 <gradient> 只支持三站）；
 *      整幅平均 → `SplashScreen.backgroundColor`。
 *
 * 用法：
 *   node scripts/measure-splash.mjs [url]
 *   （url 默认 http://127.0.0.1:5180/，也就是 npm run dev 那个；
 *     也可以传 npm run preview 的 http://127.0.0.1:4180/）
 *
 *   node scripts/measure-splash.mjs --check
 *   量完之后顺手校验「实测值有没有真的落到那四个地方」，
 *   不一致就 exit 1。改完入场页跑一下，比肉眼看靠谱。
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateRawSync } from 'node:zlib'
import { makeProfileDir } from './lib/profile.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const argv = process.argv.slice(2)
/** --check：量完顺手校验四处颜色是否同步，不一致 exit 1（实现见文件末尾） */
const CHECK = argv.includes('--check')
const positional = argv.filter((a) => !a.startsWith('--'))

const URL = positional[0] ?? 'http://127.0.0.1:5180/'
const W = 390
const H = 844

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge，无法量色')
  process.exit(2)
}

const hex = (c) =>
  '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
/** Rec.709 亮度 —— 跟 SplashPage.tsx 注释里那张表同一个口径，方便直接对数字 */
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

// ────────────────────────────────────────────────────────────
// --check 用的工具函数
// ────────────────────────────────────────────────────────────

/**
 * 从 ZIP（APK 就是个 zip）里读一个 entry，不依赖任何第三方库。
 * 只在 --check 时用，只为拿到 resources.arsc 做字节搜索。
 */
function readZipEntry(file, wanted) {
  const buf = readFileSync(file)
  // 从尾部往前找 EOCD（0x06054b50），注释区最多 64KB
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null

  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16) // central directory 起始偏移

  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null
    const method = buf.readUInt16LE(p + 10)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)

    if (name === wanted) {
      // local header 的 name/extra 长度可能跟 central 不一致，必须重新读
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const dataOff = localOff + 30 + lNameLen + lExtraLen
      const size = buf.readUInt32LE(p + 20)
      const raw = buf.subarray(dataOff, dataOff + size)
      return method === 0 ? raw : inflateRawSync(raw)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

/**
 * #RRGGBB → resources.arsc 里的小端 uint32 ARGB 字节。
 *
 * ⚠️ 这里踩过坑：arsc 存的不是 ASCII 的 "#cd9840"，而是 uint32 0xffcd9840，
 *    按小端写出来是 `40 98 cd ff`（B G R A）—— **alpha 在最后**。
 *    一开始写成 `ff 98 cd 40`，搜了四遍全是 0 命中，白排查一轮。
 */
const leArgb = (hexColor) => {
  const r = hexColor.slice(1, 3)
  const g = hexColor.slice(3, 5)
  const b = hexColor.slice(5, 7)
  return Buffer.from(b + g + r + 'ff', 'hex')
}

/**
 * 校验实测值有没有真的落到那四个地方去。
 *
 * SplashPage.tsx 里写着一条纪律：改了底色/暗罩就要重新量、并同步那些值。
 * 但那些值是**手抄**的 —— 抄漏一处，交接处就会闪一下，而且肉眼不一定看得出来
 * （比如只在 Android 12+ 才露馅，因为系统启动屏只认 colors.xml 那个纯色）。
 * 所以做成脚本，别靠记性。
 */
function checkSync({ start, center, end, avg }) {
  const fails = []
  const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)
  const ok = (label, got, want) => {
    const pass = norm(got) === norm(want)
    if (!pass) fails.push(label)
    console.log(`  ${pass ? '✅' : '❌'} ${label.padEnd(42)} ${got ?? '(缺失)'}${pass ? '' : `  ← 应为 ${want}`}`)
  }

  // ① drawable/splash.xml —— 三个色站
  const splashPath = join(ROOT, 'android/app/src/main/res/drawable/splash.xml')
  const sx = readFileSync(splashPath, 'utf8')
  console.log('\n① res/drawable/splash.xml')
  ok('android:startColor', sx.match(/startColor="(#[0-9a-fA-F]{6})"/)?.[1], start)
  ok('android:centerColor', sx.match(/centerColor="(#[0-9a-fA-F]{6})"/)?.[1], center)
  ok('android:endColor', sx.match(/endColor="(#[0-9a-fA-F]{6})"/)?.[1], end)

  // ② values/colors.xml —— Android 12+ 系统启动屏底色（只有一个纯色）
  const colorsPath = join(ROOT, 'android/app/src/main/res/values/colors.xml')
  const cx = readFileSync(colorsPath, 'utf8')
  console.log('② res/values/colors.xml')
  ok('splash_background', cx.match(/name="splash_background">(#[0-9a-fA-F]{6})</)?.[1], avg)

  // ③ capacitor.config.json —— 插件侧同名配置，必须跟 ② 一致
  const cfgPath = join(ROOT, 'capacitor.config.json')
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'))
  console.log('③ capacitor.config.json')
  ok('SplashScreen.backgroundColor', cfg?.plugins?.SplashScreen?.backgroundColor, avg)

  // ④ 编译产物 —— 防止「源码改了但忘了重新打包」
  const apkPath = join(ROOT, 'android/app/build/outputs/apk/debug/app-debug.apk')
  console.log('④ APK 编译产物')
  if (!existsSync(apkPath)) {
    console.log('  ⏭  APK 还没打包，跳过（跑 npm run apk 之后再查一次）')
  } else {
    // ⚠️ 三个色站不在 resources.arsc 里 —— 它们在**编译后的二进制 XML**
    //    res/drawable/splash.xml 里。只查 arsc 会漏掉三站、只剩 splash_background 能中，
    //    看着像「源码改了但没重新打包」，其实是查错了地方。
    const blob = Buffer.concat(
      ['resources.arsc', 'res/drawable/splash.xml']
        .map((n) => readZipEntry(apkPath, n))
        .filter(Boolean),
    )
    if (!blob.length) {
      console.log('  ⚠️  读不出 APK 内的资源，跳过')
    } else {
      for (const [label, v] of [
        ['splash.xml startColor', start],
        ['splash.xml centerColor', center],
        ['splash.xml endColor', end],
        ['splash_background', avg],
      ]) {
        const pass = blob.indexOf(leArgb(v)) >= 0
        if (!pass) fails.push(`APK ${label}`)
        console.log(`  ${pass ? '✅' : '❌'} APK 内含 ${label.padEnd(28)} ${v}`)
      }
    }
  }

  console.log()
  if (fails.length) {
    console.log('❌ 有漂移，上面标 ❌ 的地方要同步：')
    for (const f of fails) console.log(`   · ${f}`)
    return 1
  }
  console.log('✅ 四处一致，原生启动图与入场页首帧对得上。')
  return 0
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  // profile 必须落在项目同盘 —— 系统盘满会让 Chrome 的 IndexedDB 直接罢工，
  // 症状是随机挂在任意一条用例上。见 scripts/lib/profile.mjs 顶部。
  userDataDir: makeProfileDir('splash'),
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30_000 })

  // 入场页至少要待 SPLASH_MIN_MS(1.9s) 才切走，这里只等它画出来就行
  await page.waitForSelector('.anim-dawn-lift', { timeout: 10_000 })

  // ① 停掉所有动画：暗罩的 opacity 回到基础值 1（= 首帧）
  // ② 藏掉中间的内容：首帧插画还没弹进来，留着会把背景算浅
  await page.addStyleTag({
    content: `
      * { animation: none !important; transition: none !important; }
      .anim-dawn-lift { opacity: 1 !important; }
    `,
  })
  await page.evaluate(() => {
    const overlay = document.querySelector('.anim-dawn-lift')
    const root = overlay?.parentElement
    if (!root) return
    for (const el of Array.from(root.children)) {
      // 两层背景都是 absolute，其余（插画卡那一坨）藏掉
      if (el !== overlay && !el.className.includes('absolute')) {
        el.style.visibility = 'hidden'
      }
    }
  })

  const b64 = await page.screenshot({ encoding: 'base64' })

  // 把截图丢回页面里用 canvas 读像素，避免在 Node 侧手写 PNG 解码
  const rows = await page.evaluate(
    async (b64, w, h) => {
      const img = new Image()
      img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(img, 0, 0, w, h)
      const d = ctx.getImageData(0, 0, w, h).data
      const out = []
      for (let y = 0; y < h; y++) {
        const acc = [0, 0, 0]
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4
          acc[0] += d[o]
          acc[1] += d[o + 1]
          acc[2] += d[o + 2]
        }
        out.push(acc.map((v) => v / w))
      }
      return out
    },
    b64,
    W,
    H,
  )

  const avg = [0, 1, 2].map((j) => rows.reduce((s, r) => s + r[j], 0) / rows.length)
  const pick = (p) => rows[Math.min(H - 1, Math.round((p / 100) * (H - 1)))]

  console.log(`来源      : ${URL}`)
  console.log(`取样      : ${W}×${H}（动画停在 t=0，只留背景两层）`)
  console.log()
  console.log('── 逐行色带（每 5% 一行）' + '─'.repeat(34))
  for (let i = 0; i <= 100; i += 5) {
    const c = pick(i)
    console.log(`  y=${String(i).padStart(3)}%  ${hex(c)}   Rec.709 亮度 ${lum(c).toFixed(1)}`)
  }
  console.log()
  console.log('── 抄进 android/app/src/main/res/drawable/splash.xml ' + '─'.repeat(14))
  console.log(`  android:startColor="${hex(pick(0))}"     ← y=0%`)
  console.log(`  android:centerColor="${hex(pick(50))}"    ← y=50%`)
  console.log(`  android:endColor="${hex(pick(100))}"     ← y=100%`)
  console.log()
  console.log('── 抄进 capacitor.config.json 的 SplashScreen.backgroundColor ' + '─'.repeat(7))
  console.log(`  "${hex(avg)}"   （整幅平均色，实测亮度 ${lum(avg).toFixed(1)}）`)
  console.log()
  console.log('⚠️  Android 的 <gradient> 只支持 start/center/end 三站，所以这里按')
  console.log('   「首帧真的长什么样」取三个点，而不是简单取平均色 ——')
  console.log('   顶部那团太阳光晕会让上三分之一明显偏暖，取平均会把它抹平。')
  console.log('⚠️  backgroundColor 只能是**一个纯色**，所以用整幅平均色；')
  console.log('   它只在 Android 12+ 的系统启动屏上用，覆盖时间很短。')

  const out = positional[1]
  if (out) {
    const shot = Buffer.from(b64, 'base64')
    writeFileSync(out, shot)
    console.log(`\n首帧截图已存到 ${out}`)
  }

  // 把刚量出来的值顺手跟那四个地方对一遍
  if (CHECK) {
    console.log('\n── 校验：实测值有没有同步到那四个地方 ' + '─'.repeat(12))
    process.exitCode = checkSync({
      start: hex(pick(0)),
      center: hex(pick(50)),
      end: hex(pick(100)),
      avg: hex(avg),
    })
  }
} finally {
  await browser.close()
}
