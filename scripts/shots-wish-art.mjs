/**
 * 走查：心愿商城的商品图（列表卡 / 盲盒头卡 / 详情大图）。
 *
 * 用法：node scripts/shots-wish-art.mjs [url]
 * 产物：.e2e-scratch/wish-art/*.png
 *
 * 只看三件事：插画有没有出来、有没有被裁掉、块里还剩多少空白。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const OUT = '.e2e-scratch/wish-art'
const URL = process.argv[2] ?? 'http://127.0.0.1:4399/'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  userDataDir: makeProfileDir('shots-wish-art'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })
await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 })
await dismissOnboarding(page)

// 底栏 → 心愿
await page.waitForSelector('[data-tour="tab-wish"]', { timeout: 20000 })
await page.click('[data-tour="tab-wish"]')
await wait(900)
await page.screenshot({ path: `${OUT}/01-list-top.png` })

// 数一下：这一屏有几张 <img>、几颗 emoji
const stat = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img')].filter((i) => i.naturalWidth > 0)
  return {
    imgs: imgs.length,
    srcs: imgs.map((i) => i.getAttribute('src')?.split('/').pop()).slice(0, 12),
  }
})
console.log('列表首屏已加载插画：', stat.imgs, stat.srcs)

// 滚到商品区底部，把「玩具 / 学习 / 美食」几类都拍进来
await page.evaluate(() => {
  const el = document.querySelector('[data-tour="tab-wish"]')
  el?.scrollIntoView({ block: 'end' })
})
await page.evaluate(() => window.scrollBy(0, 520))
await wait(500)
await page.screenshot({ path: `${OUT}/02-list-scrolled.png` })

// 进详情：找「泡泡玛特盲盒」那张卡
await page.evaluate(() => window.scrollTo(0, 0))
await wait(400)
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('泡泡玛特盲盒'),
  )
  b?.click()
  return !!b
})
console.log('点到泡泡玛特卡片：', opened)
await wait(900)
await page.screenshot({ path: `${OUT}/03-detail-popmart.png` })

// 返回 → 盲盒头卡（列表最上面那条）
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '返回')
  b?.click()
})
await wait(700)
await page.screenshot({ path: `${OUT}/04-list-blindbox-hero.png` })

// 滚到「游戏」那一段（sort_order 100+，排在 9 个商品之后）——
// 这一段原来显示的是 72px 的方形图标，现在换成 4:3 横幅
const reachedGame = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('柯基屁屁'),
  )
  if (!b) return false
  b.scrollIntoView({ block: 'center' })
  return true
})
console.log('滚到游戏卡片：', reachedGame)
await wait(700)
await page.screenshot({ path: `${OUT}/05-list-games.png` })

await browser.close()
console.log('OK', OUT)
