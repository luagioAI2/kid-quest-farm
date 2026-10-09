/**
 * 官网（site/）检查器
 * ------------------------------------------------------------
 * 和 e2e-check.mjs 同一套思路：用真 Chrome 打开官网，断言「对不对」，
 * 顺便出一套走查图（桌面 + 手机），因为落地页的成败一半在「好不好看」。
 *
 * 用法：
 *   node scripts/check-site.mjs [url] [输出目录]
 * 例：
 *   python -m http.server 5190 --directory site &
 *   node scripts/check-site.mjs http://127.0.0.1:5190/ .e2e-scratch/site-shots
 *
 * 断言分四类：
 *   A. SEO / 元信息   —— 这是官网的主要用途之一，必须可断言
 *   B. 结构完整性     —— 图片真的加载了、锚点真的有落点、法务页真的存在
 *   C. 渲染健康       —— 控制台零报错、无横向溢出、揭示动画真的揭示出来
 *   D. 出图           —— 桌面 + 手机整页截图，供人肉眼过一遍
 *
 * ⚠️ 全页截图前**必须先把页面从头滚到底**。reveal 用的是
 *   IntersectionObserver，从没进过视口的元素会停在 opacity:0；
 *   而 Chrome 的 fullPage 截图是「不滚动、直接扩画布」，
 *   不先滚一遍的话，截图下半部分会全是空白 —— 看着像页面坏了。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const BASE = process.argv[2] ?? 'http://127.0.0.1:5190/'
const OUT = resolve(process.argv[3] ?? '.e2e-scratch/site-shots')
const SITE_DIR = resolve('site')
// ⚠️ 别把这个常量命名成 URL —— 会把全局的 URL 构造函数遮住，
//    后面 `new URL(f, BASE)` 就会炸 "URL is not a constructor"。

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge，无法检查')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${name}${detail ? ' — ' + detail : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
  }
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 轮询到条件成立为止。返回 true/false，不抛异常。 */
async function waitFor(page, fn, { timeout = 8000, interval = 150 } = {}) {
  const t0 = Date.now()
  for (;;) {
    if (await page.evaluate(fn)) return true
    if (Date.now() - t0 > timeout) return false
    await wait(interval)
  }
}

/**
 * 从头滚到底再滚回来，把 reveal 和 lazy 图都唤醒。
 *
 * ⚠️ **必须先关掉 `scroll-behavior: smooth`。**
 *   站点的 html 上写了 `scroll-behavior: smooth`（锚点跳转要动画，是给用户看的），
 *   但它是**全局生效**的 —— `window.scrollTo()` 也会变成一段动画。
 *   结果：`scrollTo(0, scrollHeight)` 之后等 600ms，页面其实还在一半的位置，
 *   最底部那一两个元素**从来没进过视口** → 永远拿不到 is-in →
 *   检查器报「揭示元素没显示出来」，而人手动滚一遍完全正常。
 *   实测：9206 的目标只走到了 9044，差 162px 就够让最后两个元素不触发。
 *
 * ⚠️ 循环条件里每次都重读 `de.scrollHeight`，不能缓存在外面 ——
 *   lazy 图加载和 reveal 展开都会让页面变高，缓存住就会少滚一截。
 */
async function primePage(page) {
  await page.evaluate(async () => {
    const de = document.documentElement
    const prev = de.style.scrollBehavior
    de.style.scrollBehavior = 'auto'
    const step = Math.round(window.innerHeight * 0.6)
    for (let y = 0; y < de.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 90))
    }
    window.scrollTo(0, de.scrollHeight)
    await new Promise((r) => setTimeout(r, 500))
    window.scrollTo(0, 0)
    await new Promise((r) => setTimeout(r, 300))
    de.style.scrollBehavior = prev
  })
}

/**
 * 反复「滚一遍 + 查条件」，直到成立为止。
 *
 * ⚠️ 为什么一次不够：primePage 的最后一次 `scrollTo(0, scrollHeight)` 读的是
 *   **那一刻**的高度，而 lazy 图是边滚边加载的 —— 图加载完页面会变高，
 *   于是那次「滚到底」只滚到了当时那个（更矮的）底，
 *   页面下半部分的元素**从头到尾没进过视口**，IntersectionObserver 自然不触发。
 *   症状是揭示动画和进度条整批不动，看着像 JS 挂了，其实只是没滚到。
 *   机器一忙、图加载一慢就必现（实测同一份代码连着跑，一次 47/47、一次 47/50）。
 */
async function primeUntil(page, fn, tries = 3) {
  for (let i = 0; i < tries; i++) {
    await primePage(page)
    if (await waitFor(page, fn, { timeout: 5000 })) return true
  }
  return false
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  userDataDir: makeProfileDir('site'),
})

try {
  const page = await browser.newPage()

  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text())
  })
  page.on('requestfailed', (r) => {
    errors.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText ?? ''))
  })

  /* ---------------- A. 桌面 ---------------- */
  console.log('\n【A】SEO 与元信息')
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
  await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })

  const meta = await page.evaluate(() => {
    const g = (sel, attr = 'content') => document.querySelector(sel)?.getAttribute(attr) ?? null
    const ld = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map(
      (s) => s.textContent,
    )
    return {
      lang: document.documentElement.getAttribute('lang'),
      title: document.title,
      desc: g('meta[name="description"]'),
      keywords: g('meta[name="keywords"]'),
      canonical: g('link[rel="canonical"]', 'href'),
      robots: g('meta[name="robots"]'),
      viewport: g('meta[name="viewport"]'),
      ogTitle: g('meta[property="og:title"]'),
      ogDesc: g('meta[property="og:description"]'),
      ogImage: g('meta[property="og:image"]'),
      ogUrl: g('meta[property="og:url"]'),
      ogType: g('meta[property="og:type"]'),
      twCard: g('meta[name="twitter:card"]'),
      icon: g('link[rel="icon"]', 'href'),
      manifest: g('link[rel="manifest"]', 'href'),
      h1: Array.from(document.querySelectorAll('h1')).map((h) => h.innerText.trim()),
      h2count: document.querySelectorAll('h2').length,
      ld,
      imgNoAlt: Array.from(document.querySelectorAll('img')).filter(
        (i) => !i.hasAttribute('alt'),
      ).length,
      themeColor: g('meta[name="theme-color"]'),
    }
  })

  check('lang 是 zh-CN', meta.lang === 'zh-CN', String(meta.lang))
  check('title 存在且长度合适', !!meta.title && meta.title.length >= 12 && meta.title.length <= 70,
    `${meta.title?.length} 字`)
  check('description 长度合适（60–200）',
    !!meta.desc && meta.desc.length >= 60 && meta.desc.length <= 200, `${meta.desc?.length} 字`)
  check('keywords 存在', !!meta.keywords, `${meta.keywords?.split(',').length} 个`)
  check('canonical 存在且是绝对地址', !!meta.canonical && /^https?:\/\//.test(meta.canonical),
    meta.canonical ?? 'null')
  check('robots 允许收录', !!meta.robots && meta.robots.includes('index'), meta.robots ?? 'null')
  check('viewport 有 width=device-width', !!meta.viewport && meta.viewport.includes('width=device-width'))
  check('Open Graph 齐全（type/title/desc/image/url）',
    !!(meta.ogType && meta.ogTitle && meta.ogDesc && meta.ogImage && meta.ogUrl))
  check('og:image 是绝对地址', !!meta.ogImage && /^https?:\/\//.test(meta.ogImage), meta.ogImage ?? '')
  check('twitter:card = summary_large_image', meta.twCard === 'summary_large_image', meta.twCard ?? 'null')
  check('favicon 存在', !!meta.icon, meta.icon ?? 'null')
  check('manifest 存在', !!meta.manifest, meta.manifest ?? 'null')
  check('theme-color 存在', !!meta.themeColor, meta.themeColor ?? 'null')
  check('有且只有一个 h1', meta.h1.length === 1, `${meta.h1.length} 个：${meta.h1[0] ?? ''}`)
  check('h2 分级存在（≥5 个）', meta.h2count >= 5, `${meta.h2count} 个`)
  check('所有 img 都有 alt', meta.imgNoAlt === 0, `${meta.imgNoAlt} 张缺 alt`)

  // JSON-LD 必须能解析，且含 SoftwareApplication + FAQPage
  let ldOk = true
  let ldTypes = []
  try {
    ldTypes = meta.ld.flatMap((raw) => {
      const j = JSON.parse(raw)
      const g = j['@graph'] ?? [j]
      return g.map((n) => n['@type'])
    })
  } catch (e) {
    ldOk = false
  }
  check('JSON-LD 可解析', ldOk)
  check('JSON-LD 含 SoftwareApplication', ldTypes.includes('SoftwareApplication'), ldTypes.join(','))
  check('JSON-LD 含 FAQPage', ldTypes.includes('FAQPage'))
  check('JSON-LD 含 WebSite', ldTypes.includes('WebSite'))

  console.log('\n【B】结构完整性')

  // ⚠️「图片真的加载了」这条**不能放在这里**。图廊那几张是 loading="lazy"，
  //    此刻它们还没进过视口，naturalWidth 必然是 0 —— 会红成「图片全挂了」。
  //    所以挪到【C】滚完之后再查（见下面 "所有图片真的加载了"）。

  // 锚点都有落点
  const anchors = await page.evaluate(() => {
    const hrefs = Array.from(document.querySelectorAll('a[href^="#"]'))
      .map((a) => a.getAttribute('href'))
      .filter((h) => h && h !== '#' && h.length > 1)
    const uniq = Array.from(new Set(hrefs))
    return uniq.map((h) => ({ href: h, exists: !!document.querySelector(h) }))
  })
  const deadAnchors = anchors.filter((a) => !a.exists)
  check(`所有页内锚点都有落点（共 ${anchors.length} 个）`, deadAnchors.length === 0,
    deadAnchors.map((a) => a.href).join(', '))

  // 站内相对链接的落点文件真的存在
  const relLinks = await page.evaluate(() =>
    Array.from(new Set(Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href'))))
      .filter((h) => h && !/^(#|https?:|mailto:|tel:)/.test(h)),
  )
  const missingFiles = []
  for (const href of relLinks) {
    const clean = href.split('#')[0].split('?')[0]
    if (!clean || clean === './') continue
    if (!existsSync(resolve(SITE_DIR, clean))) missingFiles.push(href)
  }
  check(`站内链接的文件都存在（共 ${relLinks.length} 个）`, missingFiles.length === 0,
    missingFiles.join(', '))

  /* ---------- 下载的 APK 装的是不是**这一版**代码 ----------
     2026-10-09：官网挂的 APK 还是 10-05 的，而代码已经改了四天 ——
     上面那条「文件都存在」一直绿，因为它只 `existsSync`：
     **文件在 ≠ 文件是新的**。这正是 `build-apk.sh` 注释里那个
     「同一份产物存在两处就一定会走散」的另一半 —— 走散之后没人报错。

     判据：APK 里必须装着和 `site/app/`（网页版试玩）**同一份 bundle**。
     文件名带内容 hash，所以「名字对上」=「代码对上」。

     ⚠️ 不用解压、不用引 zip 库：ZIP 的中央目录把文件名**原样存**，
       直接在大字节串里搜那个文件名就行（实测：当前包命中、
       09-30 的旧 debug 包不命中）。 */
  const appHtml = readFileSync(resolve(SITE_DIR, 'app/index.html'), 'utf8')
  const bundleName = (appHtml.match(/assets\/(index-[\w-]+\.js)/) ?? [])[1] ?? null
  check('读得到网页版的 bundle 名（staleness 检查的前提）', !!bundleName, bundleName ?? '没匹配到 assets/index-*.js')
  const apkPath = resolve(SITE_DIR, 'download/kid-quest-farm.apk')
  if (bundleName && existsSync(apkPath)) {
    const apkBytes = readFileSync(apkPath)
    const hit = apkBytes.includes(`assets/public/assets/${bundleName}`)
    check(
      `下载的 APK 里装的是同一版代码（${bundleName}）`,
      hit,
      hit ? '' : 'APK 是旧的 —— 里面没有这一版的 bundle，重跑 bash scripts/build-apk.sh release 再发布',
    )
  }

  // 法务页 + 备案号
  for (const f of ['privacy.html', 'terms.html']) {
    check(`法务页存在：${f}`, existsSync(resolve(SITE_DIR, f)))
  }
  const footerText = await page.evaluate(() => document.querySelector('.footer__legal')?.innerText ?? '')
  check('页脚有 ICP 备案号', /ICP备/.test(footerText), footerText.replace(/\s+/g, ' ').slice(0, 90))
  check('备案号链接到 beian.miit.gov.cn',
    /beian\.miit\.gov\.cn/.test(await page.evaluate(() => document.querySelector('.footer__legal')?.innerHTML ?? '')))

  // robots.txt / sitemap.xml
  for (const f of ['robots.txt', 'sitemap.xml', 'og-cover.png', 'manifest.webmanifest']) {
    check(`站点根有 ${f}`, existsSync(resolve(SITE_DIR, f)))
  }
  const sitemap = readFileSync(resolve(SITE_DIR, 'sitemap.xml'), 'utf8')
  check('sitemap 是合法 urlset', sitemap.includes('<urlset') && sitemap.includes('</urlset>'))
  check('sitemap 里的 loc 数量 ≥ 3', (sitemap.match(/<loc>/g) ?? []).length >= 3,
    `${(sitemap.match(/<loc>/g) ?? []).length} 条`)

  console.log('\n【C】渲染健康')

  // 先滚到底，把 reveal 全部触发、把 lazy 图全部拉起来
  // （否则整页截图下半部分是空白，lazy 图也全是 0×0）
  const revealOk = await primeUntil(page, () =>
    Array.from(document.querySelectorAll('.reveal')).every(
      (el) => Number(getComputedStyle(el).opacity) >= 0.9,
    ),
  )

  const imgOk = await waitFor(page, () =>
    Array.from(document.images).every((i) => i.complete && i.naturalWidth > 0),
  )
  const imgs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img')).map((i) => ({
      src: i.getAttribute('src'),
      w: i.naturalWidth,
    })),
  )
  const brokenImgs = imgs.filter((i) => i.w === 0)
  check(`所有图片真的加载了（共 ${imgs.length} 张）`, imgOk && brokenImgs.length === 0,
    brokenImgs.map((i) => i.src).join(', '))

  const revealStats = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('.reveal'))
    const hidden = all.filter((el) => Number(getComputedStyle(el).opacity) < 0.9)
    return { total: all.length, hidden: hidden.length, cls: hidden.map((e) => e.className).slice(0, 3) }
  })
  check(`揭示元素全部显示出来（共 ${revealStats.total} 个）`, revealOk, revealStats.cls.join(' | '))

  // 进度条是另一套 IntersectionObserver（threshold 0.4）+ 260ms 延迟。
  // ⚠️ 必须和揭示动画一样用 primeUntil，不能只 waitFor ——
  //   primePage 最后一次「滚到底」读的是**那一刻**的页高，图加载完页面变高之后，
  //   结算卡片就可能整批没进过视口，进度条永远停在 width:0。
  //   实测：同一份代码连着跑，出现过「100%, 50%, 3%」和「, , 3%」两种结果，
  //   也就是前两条没拉到、第三条拉到了 —— 典型的「只滚到一半」。
  const barsOk = await primeUntil(page, () =>
    Array.from(document.querySelectorAll('[data-bar] span')).every(
      (s) => s.style.width && s.style.width !== '0%',
    ),
  )
  const bars = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-bar] span')).map((s) => s.style.width),
  )
  check('结算规则进度条都拉起来了', barsOk, bars.join(', '))

  // 首屏那条「数据条」（12 块土地 / 8 种作物 / 5 种动物 / 0 条广告）已整块删除。
  // 这里反过来断言它**真的删干净了**：
  // 只删 HTML 不删 JS 的话，main.js 会留一段永远匹配不到元素的死代码 ——
  // 那种残留不会报错，只会一直躺在那里骗下一个人。
  const leftoverCounts = await page.evaluate(
    () => document.querySelectorAll('[data-count]').length,
  )
  const mainJsSrc = readFileSync(resolve(SITE_DIR, 'main.js'), 'utf8')
  check('首屏数据条已移除（HTML 无 data-count）', leftoverCounts === 0, `${leftoverCounts} 个残留`)
  check(
    '首屏数据条已移除（main.js 无 countUp 残留）',
    !/countUp|data-count/.test(mainJsSrc),
  )

  for (const vp of [
    { name: '桌面 1440', width: 1440, height: 960 },
    { name: '平板 834', width: 834, height: 1112 },
    { name: '手机 390', width: 390, height: 844 },
    { name: '窄屏 320', width: 320, height: 640 },
  ]) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 })
    await wait(400)
    const over = await page.evaluate(() => {
      const de = document.documentElement
      // 找出真正溢出的元素，方便定位
      const wide = []
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.right > de.clientWidth + 1) {
          wide.push(`${el.tagName.toLowerCase()}.${(el.className || '').toString().split(' ')[0]}`)
        }
      }
      return {
        scrollW: de.scrollWidth,
        clientW: de.clientWidth,
        wide: Array.from(new Set(wide)).slice(0, 5),
      }
    })
    check(`${vp.name}：无横向溢出`, over.scrollW <= over.clientW + 1,
      `scrollW=${over.scrollW} clientW=${over.clientW}${over.wide.length ? ' 溢出元素: ' + over.wide.join(', ') : ''}`)
  }

  console.log('\n【D】走查出图')
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
  await primePage(page)
  await page.screenshot({ path: `${OUT}/desktop-full.png`, fullPage: true })
  console.log('  桌面整页 → desktop-full.png')
  await page.screenshot({ path: `${OUT}/desktop-hero.png`, clip: { x: 0, y: 0, width: 1440, height: 960 } })
  console.log('  桌面首屏 → desktop-hero.png')

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  await wait(500)
  await primePage(page)

  // ⚠️ 手机端**不要用 fullPage 整页截图**。
  //    这张页面在 390 宽下高约 14300 CSS px，deviceScaleFactor=2 就是 28600 设备像素 ——
  //    超出 Chrome 单次截图的处理能力，出来的 PNG 尺寸是对的，但**内容被压缩/错位**：
  //    实测裁 y=26400..28612（按 2× 推算应该是页脚）拿到的却是页面中段的「玩法闭环」，
  //    而同一张图里 y=0..1100 又完全正确 —— 也就是上下比例不一致，没法按比例定位。
  //    （不滚动的对照截图更明显：整页内容只铺到 66% 处，剩下 34% 是空白背景。）
  //    改成**逐屏拍**：每屏一张，位置由 scrollTop 显式给定，完全可控，也好逐屏走查。
  const metrics = await page.evaluate(() => ({
    total: document.documentElement.scrollHeight,
    vh: window.innerHeight,
  }))
  // ⚠️ 上限要给够。第一次写死 12 屏，而这页要 17 屏 ——
  //    结果「下载 / 常见问题 / 页脚」三段压根没进走查图，
  //    看着像页面只有三分之二长。（等于把走查本身漏掉了。）
  const frames = Math.min(24, Math.ceil(metrics.total / metrics.vh))
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto'
  })
  for (let i = 0; i < frames; i++) {
    // 最后一屏贴底，保证页脚一定被拍到
    const y = i === frames - 1 ? metrics.total - metrics.vh : i * metrics.vh
    await page.evaluate((yy) => window.scrollTo(0, yy), y)
    await wait(260)
    await page.screenshot({
      path: `${OUT}/mobile-${String(i + 1).padStart(2, '0')}.png`,
    })
  }
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = ''
  })
  console.log(`  手机逐屏 → mobile-01..${String(frames).padStart(2, '0')}.png（共 ${frames} 屏 / 页面高 ${metrics.total}px）`)

  // 手机端菜单
  await page.click('#burger')
  await wait(320)
  await page.screenshot({ path: `${OUT}/mobile-menu.png` })
  const menuOpen = await page.evaluate(
    () => getComputedStyle(document.getElementById('navlinks')).display !== 'none',
  )
  check('手机端汉堡菜单能展开', menuOpen)
  await page.keyboard.press('Escape')
  await wait(200)
  const menuClosed = await page.evaluate(() => !document.getElementById('nav').classList.contains('is-open'))
  check('Esc 能收起手机端菜单', menuClosed)

  // 法务页也扫一眼
  for (const f of ['privacy.html', 'terms.html']) {
    const p = await browser.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    await p.goto(new globalThis.URL(f, BASE).href, { waitUntil: 'networkidle2', timeout: 60000 })
    const info = await p.evaluate(() => ({
      h1: document.querySelectorAll('h1').length,
      title: document.title,
      hasIcp: /ICP备/.test(document.body.innerText),
    }))
    check(`${f}：有 h1 / 有标题 / 有备案号`, info.h1 === 1 && !!info.title && info.hasIcp,
      `h1=${info.h1} title="${info.title}"`)
    check(`${f}：无 JS 报错`, errs.length === 0, errs.join(' | '))
    await p.close()
  }

  // 官网里那份「在线体验」是真的 App 构建产物，必须能起来
  {
    const p = await browser.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    p.on('console', (m) => {
      if (m.type() === 'error') errs.push(m.text())
    })
    await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    await p.goto(new globalThis.URL('app/', BASE).href, { waitUntil: 'networkidle2', timeout: 60000 })
    // 冷启动会先播入场页（SPLASH_MIN_MS = 1900ms），再弹新手引导把主界面整个盖住。
    // 不等这两步走完就去断言「有四个 tab」，只会红成「App 坏了」。
    await wait(2600)
    await dismissOnboarding(p)
    await wait(600)
    const app = await p.evaluate(() => ({
      rootChildren: document.querySelector('#root')?.children.length ?? 0,
      // ⚠️ 取**整段** innerText。底部 tab 栏在 DOM 最后，截前 600 字会把它切掉，
      //    然后报「渲染不出四个 tab」—— 而截图里四个 tab 明明都在。
      text: document.body.innerText,
      title: document.title,
    }))
    check('网页版能启动（#root 有内容）', app.rootChildren > 0, `#root 子节点 ${app.rootChildren}`)
    check('网页版渲染出了四个 tab', ['任务', '农场', '兑换', '积分'].every((t) => app.text.includes(t)),
      app.text.replace(/\s+/g, ' ').slice(-120))
    check('网页版无 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '))
    await p.screenshot({ path: `${OUT}/app-web.png` })
    console.log('  网页版首屏 → app-web.png')
    await p.close()
  }

  console.log('\n【E】控制台')
  check('全站无控制台错误 / 资源加载失败', errors.length === 0, errors.slice(0, 4).join(' | '))

  console.log(`\n通过 ${pass}/${pass + fail}`)
  if (fail > 0) console.log(`失败 ${fail} 条`)
  console.log(`走查图已输出到 ${OUT}`)
  process.exitCode = fail > 0 ? 1 : 0
} finally {
  await browser.close()
}
