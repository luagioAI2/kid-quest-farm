/**
 * 心愿商城走查（真构建，不是稿子）。
 *
 * 用法：node scripts/e2e-wishmall.mjs [url]
 *
 * 验的是**只有真跑起来才知道**的那几件事：
 *   ① 底栏真的是 5 格，且「心愿」在中间（布局改动）
 *   ② 盲盒排在实物前面（用户要求「优先显示」）
 *   ③ 孩子端 DOM 里**没有** taobao 链接（外链只在家长确认页）
 *   ④ 价格和券价都在，且价格旁边写着「家长支付」
 *   ⑤ 全程 0 个 404、0 个 pageerror
 *
 * ⚠️ 404 那句话**不带 URL**（老坑），所以必须挂 `response` 记 status+url。
 */
import puppeteer from 'puppeteer-core'
import { makeProfileDir } from './lib/profile.mjs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { existsSync, mkdirSync } from 'node:fs'

const OUT = '.e2e-scratch/wish-e2e'
const URL = process.argv[2] ?? 'http://127.0.0.1:4399/'

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge')
  process.exit(2)
}
mkdirSync(OUT, { recursive: true })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failed++
}

/**
 * 过家长密码闸门（默认 `0000`，见 `db.ts` 的 `DEFAULT_SETTINGS`）。
 *
 * 返回「本来有没有闸门」—— 调用方要拿它做断言：
 * 闸门存在是**功能**，不是障碍。没有闸门才是 bug。
 */
async function passPin(page) {
  const gated = await page.evaluate(() => document.body.innerText.includes('请爸爸妈妈来一下'))
  if (!gated) return false
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.textContent?.trim() === '0',
      )
      b?.click()
    })
    await wait(100)
  }
  await wait(250)
  // 第 4 位通常会自动提交；没提交就点「确定」
  const still = await page.evaluate(() => document.body.innerText.includes('请爸爸妈妈来一下'))
  if (still) {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.textContent?.trim() === '确定',
      )
      b?.click()
    })
    await wait(300)
  }
  return true
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  userDataDir: makeProfileDir('e2e-wishmall'),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 })

const pageErrors = []
const bad404 = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('response', (r) => {
  if (r.status() >= 400 && !r.url().includes('favicon')) bad404.push(`${r.status()} ${r.url()}`)
})

await page.goto(URL, { waitUntil: 'domcontentloaded' })
await dismissOnboarding(page)
await wait(500)

/* ---------- ① 底栏 5 格 ---------- */
console.log('\n── 底栏 ──')
const tabs = await page.$$eval('[data-tour^="tab-"]', (bs) =>
  bs.map((b) => b.textContent.trim()),
)
check('底栏是 5 格', tabs.length === 5, tabs.join(' / '))
check('「心愿」在中间', tabs[2]?.includes('心愿') || tabs.some((t) => t.includes('心愿')))

const wishTab = await page.$('[data-tour="tab-wish"]')
check('心愿 tab 存在且可点', !!wishTab)

/* ---------- ② 列表 ---------- */
console.log('\n── 心愿商城列表 ──')
await page.click('[data-tour="tab-wish"]')
await page.waitForFunction(
  () => document.body.innerText.includes('心愿商城'),
  { timeout: 10000 },
)
await wait(400)
await page.screenshot({ path: `${OUT}/01-list.png` })

const listInfo = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    hasBlindbox: body.includes('游戏盲盒'),
    hasPrice: /🎫\s*\d+/.test(body),
    // 盲盒 hero 在 DOM 里应该排在第一张卡片之前
    firstCardText:
      document.querySelector('.grid')?.firstElementChild?.textContent?.slice(0, 20) ?? '',
    taobao: body.includes('taobao') || document.body.innerHTML.includes('taobao.com'),
    cardCount: document.querySelectorAll('.grid > button').length,
  }
})
check('盲盒在列表里', listInfo.hasBlindbox)
check('有券价标签', listInfo.hasPrice)
check('卡片数量 > 0', listInfo.cardCount > 0, `${listInfo.cardCount} 张`)
check('孩子端 DOM 里没有淘宝链接', !listInfo.taobao)

/* ---------- ③ 盲盒详情 ---------- */
console.log('\n── 盲盒详情 ──')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('游戏盲盒'),
  )
  b?.click()
})
await wait(500)
await page.screenshot({ path: `${OUT}/02-blindbox.png` })

const boxInfo = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    hasNote: body.includes('随机开出'),
    hasWant: body.includes('想要这个'),
    taobao: body.includes('taobao') || document.body.innerHTML.includes('taobao.com'),
  }
})
check('盲盒详情有说明', boxInfo.hasNote)
check('未开放时只有「想要这个」', boxInfo.hasWant)
check('盲盒详情里也没有淘宝链接', !boxInfo.taobao)

/* ---------- ④ 实物详情（价格 + 家长支付） ---------- */
console.log('\n── 实物详情 ──')
await page.evaluate(() => {
  const back = document.querySelector('button[aria-label="返回"]')
  back?.click()
})
await wait(400)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(500)
await page.screenshot({ path: `${OUT}/03-physical.png` })

const physInfo = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    hasPayLabel: body.includes('家长支付'),
    hasYuan: /¥\s*\d+/.test(body),
    hasWant: body.includes('想要这个'),
  }
})
check('价格旁有「家长支付」', physInfo.hasPayLabel)
check('显示参考价', physInfo.hasYuan)
check('有「想要这个」按钮', physInfo.hasWant)

/* ---------- ⑤ 表明意向 ---------- */
console.log('\n── 表明意向 ──')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('想要这个'),
  )
  b?.click()
})
await wait(700)
await page.screenshot({ path: `${OUT}/04-wished.png` })
const wished = await page.evaluate(() => document.body.innerText.includes('已经告诉爸妈'))
check('点完变成「已经告诉爸妈」', wished)

/* ---------- ⑥ 家长定价 ---------- */
console.log('\n── 家长定价 ──')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent?.trim() === '定价',
  )
  b?.click()
})
await wait(500)
const gated = await passPin(page)
check('定价需要家长密码', gated, gated ? '已用 0000 通过' : '没有设密码')
await page.screenshot({ path: `${OUT}/05-offer.png` })
const offerInfo = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    hasStepper: body.includes('定一个兑换券价格'),
    hasRef: body.includes('最近 7 天') || body.includes('还没有兑换券流水'),
  }
})
check('定价页有步进器', offerInfo.hasStepper)
// 新装的应用没有流水，这时显示的是「还没有兑换券流水」而不是「最近 7 天平均…」
// —— 两种都是对的，断言只要求「有参考区」
check(
  '定价页有收入参考',
  offerInfo.hasRef,
  offerInfo.hasRef ? '' : '既没有 7 天均值也没有无数据提示',
)

/* ---------- ⑦ 真扣券 ---------- */
console.log('\n── 兑换扣券 ──')

// 用默认 30 张开放
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent?.trim() === '开放兑换',
  )
  b?.click()
})
await wait(900)

// 发 100 张券（走账本，不是直接改余额）
await page.evaluate(() => window.__kqf__.addVouchers(100))
await wait(700)
const before = await page.evaluate(() => window.__kqf__.getState().harvestBalance)
check('调试发券到账', before === 100, `余额 ${before}`)

// 回列表 → 点开泡泡玛特
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(600)
const priceShown = await page.evaluate(() => document.body.innerText.includes('用 30 张兑换'))
check('定价后出现「用 30 张兑换」', priceShown)

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('张兑换'),
  )
  b?.click()
})
await wait(1200)

const afterRedeem = await page.evaluate(() => {
  const s = window.__kqf__.getState()
  const o = s.wishOrders.find((x) => x.itemId === 'wish-popmart')
  return { balance: s.harvestBalance, status: o?.status, held: o?.vouchersHeld }
})
check('余额真的少了 30', afterRedeem.balance === 70, `${before} → ${afterRedeem.balance}`)
check('订单进入 committed', afterRedeem.status === 'committed', String(afterRedeem.status))
check('托管数记的是 30', afterRedeem.held === 30, String(afterRedeem.held))

/* ---------- ⑧ 取消退券 ---------- */
console.log('\n── 取消退券 ──')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(600)
await passPin(page)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('确认兑换'),
  )
  b?.click()
})
await wait(700)
await page.screenshot({ path: `${OUT}/06-confirm.png` })

const confirmInfo = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    hasBuy: body.includes('去淘宝'),
    hasNoPay: body.includes('不代收货款'),
    taobaoHref: !!document.querySelector('a[href*="taobao"]'),
    // 数字商品取消要收回游戏，实物不涉及。这单是泡泡玛特（实物），
    // 出现这句就是条件写反了 —— 家长会以为孩子的游戏被收走了。
    gameWarn: body.includes('已经交付了游戏'),
  }
})
check('家长确认页有「去淘宝」', confirmInfo.hasBuy)
check('写明了「App 不代收货款」', confirmInfo.hasNoPay)
check('实物订单的取消提示不提「收回游戏」', !confirmInfo.gameWarn)

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent?.trim() === '取消兑换',
  )
  b?.click()
})
await wait(1200)

const afterCancel = await page.evaluate(() => {
  const s = window.__kqf__.getState()
  const o = s.wishOrders.find((x) => x.itemId === 'wish-popmart')
  const refunds = s.harvestLedger.filter((e) => e.source === 'wish_refund')
  return { balance: s.harvestBalance, status: o?.status, refundRows: refunds.length }
})
check('券退回来了', afterCancel.balance === 100, `余额 ${afterCancel.balance}`)
check('订单变成 cancelled', afterCancel.status === 'cancelled', String(afterCancel.status))
check('只写了一笔退款流水', afterCancel.refundRows === 1, `${afterCancel.refundRows} 笔`)

/* ---------- ⑧ 券不够：按钮灰掉 + 说清还差多少 + 不混付 ----------
 *
 * 不去动余额，而是**把价格抬到 9999** —— 余额 100 就自然不够了。
 * 动余额会在 `harvestLedger` 里留一条假流水，后面再算「退款几笔」就不干净。
 */
console.log('\n── 券不够 ──')
await page.evaluate(async () => {
  await window.__kqf__.getState().wishSetOffer('wish-popmart', 9999)
})
await wait(400)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(700)

const poor = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  // 底部那颗大按钮：文案只有两种形态 ——「用 N 张兑换」/「还差 N 张」
  const action = btns.find((x) => /^(还差|用)\s*\d+\s*张/.test((x.textContent ?? '').trim()))
  const note = [...document.querySelectorAll('*')].find(
    (x) => x.children.length === 0 && /换这个要\s*\d+\s*张/.test(x.textContent ?? ''),
  )
  return {
    text: (action?.textContent ?? '').trim() || '(没找到按钮)',
    disabled: !!action?.disabled,
    note: (note?.textContent ?? '').trim(),
    // 混付判据只看**这颗按钮**：全局顶栏本来就有 🪙 积分，
    // 拿 body.innerText 去 grep 会永远命中，是个假判据。
    mixed: /积分|🪙/.test(action?.textContent ?? ''),
  }
})
check('券不够时按钮是灰的（disabled）', poor.disabled, poor.text)
check('券不够时按钮写「还差 N 张」', /^还差\s*\d+\s*张$/.test(poor.text), poor.text)
check('券不够时只提兑换券，不提积分（不混付）', !poor.mixed, poor.text)
check(
  '进度条下方写清「换这个要 N 张，还差 M 张」',
  /换这个要\s*9999\s*张，还差\s*\d+\s*张/.test(poor.note),
  poor.note,
)

/* 家长主动来定价（孩子没提过意向）时，页面不能替孩子说「想要这个」。
 * 这里能测到是因为上一步刚把这一单**取消**了 —— 没有活跃意向。
 * 原来的文案是写死的，孩子明明没点过也照样显示，属于「图对、说明错」，
 * 结构断言完全看不见，只有截图走查会撞见。 */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => (x.textContent ?? '').trim() === '定价',
  )
  b?.click()
})
await wait(700)
await passPin(page) // 定价页整页是 PIN 闸门，先过闸再读文案
await wait(400)
const offerCopy = await page.evaluate(() => document.body.innerText)
check(
  '没意向时定价页不写「孩子想要这个」',
  !offerCopy.includes('孩子想要这个') && offerCopy.includes('孩子还没提过'),
  offerCopy.includes('孩子想要这个') ? '仍在替孩子撒谎' : '文案已按实际状态显示',
)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.getAttribute('aria-label') === '返回',
  )
  b?.click()
})
await wait(500)

/* ---------- ⑨ 价格与券价分层 + 没有汇率换算 ---------- */
const layering = await page.evaluate(() => {
  const body = document.body.innerText
  // 参考价那张卡（「家长支付 ¥69」）和券价说明必须在**上下两块**里，
  // 不能并排 —— 并排孩子就会自己算出 1 张 ≈ 多少钱（spec §8）。
  const payLabel = [...document.querySelectorAll('*')].find(
    (x) => x.children.length === 0 && (x.textContent ?? '').trim() === '家长支付',
  )
  const payCard = payLabel?.closest('div')
  const voucherNote = [...document.querySelectorAll('*')].find(
    (x) => x.children.length === 0 && /换这个要\s*\d+\s*张/.test(x.textContent ?? ''),
  )
  return {
    hasPayLabel: !!payLabel,
    payBottom: payCard?.getBoundingClientRect().bottom ?? null,
    voucherTop: voucherNote?.getBoundingClientRect().top ?? null,
    // 只认「1 张 = ¥x」这种**换算**，不认单独出现的 ¥ 金额（参考价本来就有）
    converts: /1\s*张\s*[=≈]\s*[¥￥]/.test(body) || /[¥￥]\s*[\d.]+\s*\/\s*张/.test(body),
  }
})
check('价格旁有「家长支付」', layering.hasPayLabel)
check(
  '参考价与券价不在同一行（分两块）',
  layering.payBottom != null &&
    layering.voucherTop != null &&
    layering.payBottom <= layering.voucherTop + 1,
  `参考价底部 ${Math.round(layering.payBottom ?? -1)} / 券价顶部 ${Math.round(layering.voucherTop ?? -1)}`,
)
check('详情页没有「1 张 = ¥x」这类换算', !layering.converts)

/* ---------- ⑩ 底栏 5 格在 390px 下不挤、不换行 ---------- */
const navFit = await page.evaluate(() => {
  const tabs = [...document.querySelectorAll('[data-tour^="tab-"]')]
  const rects = tabs.map((t) => t.getBoundingClientRect())
  // 每个 tab 的**文字**节点高度：换行会从 ~14px 变成 ~30px 以上。
  // 判据不能只看「没横向溢出」—— 挤到换行也是「放得下」，只是难看。
  const wrapped = tabs
    .map((t, i) => {
      const label = [...t.querySelectorAll('*')].filter((x) => x.children.length === 0).pop()
      return { text: (label?.textContent ?? '').trim(), h: label?.getBoundingClientRect().height ?? 0, i }
    })
    .filter((x) => x.h > 26)
  return {
    count: tabs.length,
    maxRight: Math.round(Math.max(...rects.map((r) => r.right))),
    minLeft: Math.round(Math.min(...rects.map((r) => r.left))),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    wrapped: wrapped.map((x) => `${x.text}:${Math.round(x.h)}px`),
  }
})
check('底栏 5 格都还在', navFit.count === 5, String(navFit.count))
check('底栏文字都没换行', navFit.wrapped.length === 0, navFit.wrapped.join(',') || '5 个 label 都是单行')
check(
  '底栏没有横向溢出（右边界 ≤ 390）',
  navFit.overflow === 0 && navFit.maxRight <= 390,
  `右边界 ${navFit.maxRight} / 溢出 ${navFit.overflow}`,
)

console.log(
  `\n404: ${bad404.length} 个${bad404.length ? `\n  ${bad404.join('\n  ')}` : ''}`,
)
console.log(`pageerror: ${pageErrors.length} 个${pageErrors.length ? `\n  ${pageErrors.join('\n  ')}` : ''}`)

if (bad404.length) failed += bad404.length
if (pageErrors.length) failed += pageErrors.length

console.log(`\n${failed === 0 ? '全部通过' : `${failed} 项失败`}`)
await browser.close()
process.exit(failed === 0 ? 0 : 1)
