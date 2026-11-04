/**
 * 逐件看九个实物 / 盲盒的详情大图 —— 一张一张拍，便于挑毛病。
 *
 * 用法：node scripts/shots-wish-goods.mjs [url]
 * 产物：.e2e-scratch/wish-goods/<序号>-<item_id>.png
 *
 * 为什么要逐件拍：列表卡只有 153×115，图的毛病（比例、主体太小、多余元素）
 * 在那个尺寸下看不出来；详情页是 358×269，一眼就能挑。
 *
 * ⚠️ 两个「起服务」的坑（2026-11-04 各踩一次，症状都长得像「脚本坏了」）：
 *   ① **端口必须在后端 CORS 白名单里**（`configs/config.yaml` 的 `AllowOrigins`：
 *      4180 / 4391 / 4393 / 4401 / 4396 …）。用 4403 起预览 ⇒ 每个接口被 CORS 拦成
 *      `ERR_FAILED` ⇒ 启动页停在「📡 还没连上服务器」⇒ 脚本报的却是
 *      `Waiting failed: 20000ms exceeded`（等 `[data-tour="tab-wish"]` 超时），
 *      看起来像选择器写错了。
 *   ② **在线版构建必须先把后端跑起来**（前端默认打 `127.0.0.1:8090`；本机那次实际在
 *      8080，用 `VITE_API_BASE` 覆盖）。后端没起 = 同一个「还没连上服务器」。
 *      ➜ 只想看插画、不想碰后端：`VITE_APP_MODE=local` 构建，数据全在本机。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const OUT = '.e2e-scratch/wish-goods'
const URL = process.argv[2] ?? 'http://127.0.0.1:4399/'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** 按商品名进详情。名字是界面上那行标题，改文案时这里要跟着改 */
const GOODS = [
  ['01', '游戏盲盒 · 5 连开', 'wish-blindbox-5'],
  ['02', '泡泡玛特盲盒', 'wish-popmart'],
  ['03', '儿童学习机', 'wish-study-pad'],
  ['04', '恐龙模型套装', 'wish-dino'],
  ['05', '1000 片拼图', 'wish-puzzle'],
  ['06', '闪光贴纸册', 'wish-sticker'],
  ['07', '生日蛋糕', 'wish-cake'],
  ['08', '动物园一日游', 'wish-zoo'],
]

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  userDataDir: makeProfileDir('shots-wish-goods'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
await dismissOnboarding(page)
await page.waitForSelector('[data-tour="tab-wish"]', { timeout: 20000 })
await page.click('[data-tour="tab-wish"]')
await wait(900)

for (const [idx, name, id] of GOODS) {
  const ok = await page.evaluate((n) => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.includes(n))
    if (!b) return false
    b.scrollIntoView({ block: 'center' })
    b.click()
    return true
  }, name)
  if (!ok) {
    console.log(`✗ 找不到「${name}」`)
    continue
  }
  await wait(800)
  // 只截大图那一块（元素级截图），别把标题和按钮带进来
  const shot = await page.evaluate(() => {
    const img = document.querySelector('img')
    if (!img) return false
    const box = img.parentElement
    box?.setAttribute('data-shot', '1')
    return true
  })
  if (!shot) {
    console.log(`✗ 「${name}」没有大图元素`)
  } else {
    const el = await page.$('[data-shot="1"]')
    if (el) {
      await el.screenshot({ path: `${OUT}/${idx}-${id}.png` })
      await el.dispose()
    }
    await page.evaluate(() =>
      document.querySelector('[data-shot="1"]')?.removeAttribute('data-shot'),
    )
  }
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === '返回',
    )
    b?.click()
  })
  await wait(600)
  console.log(`✓ ${name}`)
}

await browser.close()
console.log('OK', OUT)
