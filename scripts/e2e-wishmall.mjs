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

/* ---------------- 「兑换」那一格：2026-10-29 起唯一的收银台 ----------------
 *
 * 家长口径：「兑换 里的东西都是一样，都能用兑换券或者积分，包括游戏也一样。
 * 不需要去心愿商城换。心愿商城只是标明心愿的。」
 *
 * 所以心愿详情**不再扣币**，只有一颗「🎁 去「兑换」换」—— 点下去是切到
 * 兑换那一格（`jumpToRedeem` → `pendingRedeemItem`）。真正成交要三步：
 *
 *   ① 详情里点 `[data-wish-to-redeem]`   → 切到「兑换」
 *   ② 兑换列表里点那一行的「换这个」      → 展开二次确认
 *   ③ 二次确认里点「换！」               → 扣币 + 生成订单
 *
 * ⚠️ 这三步必须**分开写**：合成一个 `page.click` 会在第 ① 步之后立刻找第 ② 步
 *    的按钮，而那时候页面还在心愿那一格 —— 静默空点，后面整段断言全红，
 *    报的却是「券没扣」。
 */
const goWish = async () => {
  await page.click('[data-tour="tab-wish"]')
  await wait(700)
}

/** 心愿列表里点开某件商品（按卡片文字认，别按位置） */
const openWishCard = async (name) => {
  const ok = await page.evaluate((n) => {
    const b = [...document.querySelectorAll('.grid > button')].find((x) =>
      x.textContent?.includes(n),
    )
    if (!b) return false
    b.click()
    return true
  }, name)
  await wait(650)
  return ok
}

/**
 * 在「兑换」那一格把某件心愿换掉。
 *
 * 返回 `{ ok, at }` —— `at` 说明卡在哪一步（`detail` / `row` / `confirm`），
 * 因为「没换成功」有四种完全不同的原因，只说一句「券没扣」查不出来。
 */
async function redeemInShop(itemId) {
  const jumped = await page.evaluate(() => {
    const b = document.querySelector('[data-wish-to-redeem]')
    if (!b || b.disabled) return false
    b.click()
    return true
  })
  if (!jumped) return { ok: false, at: 'detail' }
  await wait(1000)

  const opened = await page.evaluate((id) => {
    const row = document.querySelector(`[data-shop-row="${id}"]`)
    const b = [...(row?.querySelectorAll('button') ?? [])].find((x) =>
      /换这个/.test(x.textContent ?? ''),
    )
    if (!b || b.disabled) return false
    b.click()
    return true
  }, itemId)
  if (!opened) return { ok: false, at: 'row' }
  await wait(450)

  const confirmed = await page.evaluate((id) => {
    const row = document.querySelector(`[data-shop-row="${id}"]`)
    const b = [...(row?.querySelectorAll('button') ?? [])].find((x) =>
      /换！/.test(x.textContent ?? ''),
    )
    if (!b) return false
    b.click()
    return true
  }, itemId)
  return { ok: confirmed, at: confirmed ? 'done' : 'confirm' }
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

/* ---------- ⑤.5 家长侧必须看得见这个心愿（2026-10-29，当天改到 👀） ----------
   第一版把待办卡摆在**心愿页顶部**。家长当天改口：
   「心愿商城爸爸妈妈收到心愿，也跟任务一样，出现在上边栏的眼睛那，
   **而不是在心愿商城这里**」。所以判据也跟着挪：

     · 心愿页上**不该再有**那张卡（两个入口并存，家长不知道点哪个）；
     · 顶栏 👀 要亮出待办红点；
     · 点开 👀 过密码之后，队列第一条就是这条心愿，而且能就地定价。

   ⚠️ 判据取**页面/DOM 上的入口**，不是 `wishOrders` 里有没有这条 ——
      数据一直都在，看不见的从来是入口。 */
await page.evaluate(() => {
  document.querySelector('button[aria-label="返回"]')?.click()
})
await wait(600)

const wishEntry = await page.evaluate(() => {
  const badgeBtn = document.querySelector('[data-tour="header-review"]')
  return {
    stillOnWishPage: document.body.innerText.includes('心愿等你回应'),
    childSees: document.body.innerText.includes('已告诉爸妈'),
    dot: !!badgeBtn?.querySelector('span'),
    label: badgeBtn?.getAttribute('aria-label') ?? '',
  }
})
check('★ 心愿页不再摆家长待办卡（已移到顶栏 👀）', !wishEntry.stillOnWishPage)
check('孩子那一侧仍然写着「已告诉爸妈」', wishEntry.childSees)
check('★ 顶栏 👀 出现待办红点', wishEntry.dot && /待办/.test(wishEntry.label), wishEntry.label)

await page.evaluate(() => {
  document.querySelector('[data-tour="header-review"]')?.click()
})
await wait(500)
const reviewGated = await passPin(page)
check('打开 👀 要家长密码', reviewGated, reviewGated ? '已用 0000 通过' : '没有设密码')
const wishCard = await page.evaluate(() => {
  const el = document.querySelector('[data-wish-review]')
  return {
    has: !!el,
    text: (el?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
  }
})
check('★ 家长在 👀 里看到这条心愿', wishCard.has, wishCard.text)
await page.screenshot({ path: `${OUT}/04b-review-wish.png` })

// 关掉弹层（头部那颗 ✕；遮罩也是 aria-label=关闭，取最后一个）
await page.evaluate(() => {
  const bs = [...document.querySelectorAll('button[aria-label="关闭"]')]
  bs[bs.length - 1]?.click()
})
await wait(500)

// 回到那件商品的详情 —— 下一段（定价）要在详情页上做
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(600)

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
    // 2026-10-29：三种分支（现在就够 / 有日均收入 / 没流水）都以
    // 「孩子现在有 🎫 x 张 + 🪙 y 积分」开头 —— 混付之后必须报已有余额，
    // 不然「要攒几天」是按整价算的，会把家长带偏。
    hasRef: body.includes('孩子现在有'),
    // 定价页必须说清「积分也能补」，否则家长以为「定 80 张 = 必须有 80 张券」
    hasMixHint: body.includes('积分补'),
  }
})
check('定价页有步进器', offerInfo.hasStepper)
check('定价页报出孩子现有余额（券 + 积分）', offerInfo.hasRef, offerInfo.hasRef ? '' : '没有「孩子现在有」')
check('定价页说明积分能补差额', offerInfo.hasMixHint, offerInfo.hasMixHint ? '' : '没提积分')

/* ---------- ⑦ 真扣券（2026-10-29 起只在「兑换」那一格扣） ---------- */
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
await openWishCard('泡泡玛特')
const priceShown = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    cta: /去「兑换」换/.test(body),
    price: /换这个要\s*30/.test(body),
    // 详情页上**不许**再出现「就地换」的按钮文案 —— 那是第一版的做法，
    // 家长当场否掉：在兑换里开一道门通往另一个收银台。
    inPlace: /用\s*30\s*换/.test(body),
  }
})
check('定价后详情给出「🎁 去「兑换」换」', priceShown.cta)
check('并且写明这件要 30', priceShown.price)
check('详情里不再有「就地换」的按钮（收银台只有一个）', !priceShown.inPlace)

const redeem1 = await redeemInShop('wish-popmart')
check('★ 从详情 → 兑换那一行 → 就地换掉', redeem1.ok, `卡在 ${redeem1.at}`)
await wait(800)

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
await goWish()
await openWishCard('泡泡玛特')
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

/* ---------- ④b 确认 → 完成：券不退、订单走到 done ----------
 *
 * 这条以前**从来没走过**：走查只验证了「取消」，而 `done` 是整条流程的
 * 终点（家长去外链买完，回来点「已经买好了」）。它断了的话，订单永远
 * 停在 confirmed，家长那边看起来像「买完了但 App 不知道」。
 *
 * 判据刻意分开：状态 / 时间戳 / 券不退 / 不多写退款 —— 只看状态的话，
 * 「状态对了但券被退回去」这种错会漏掉。
 */
console.log('\n── 确认 → 完成 ──')
const openCard = async () => {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.grid > button')].find((x) =>
      x.textContent?.includes('泡泡玛特'),
    )
    b?.click()
  })
  await wait(600)
}
// 再兑换一次（上一单已取消，价格还是 30、余额 100）。
// ⚠️ 2026-10-29 起「兑换」只发生在兑换那一格 —— 这里是
//    「详情 → 去兑换 → 那一行 → 换！」，不再是一颗就地扣币的按钮。
await openCard()
const redeem2 = await redeemInShop('wish-popmart')
check('第二次兑换（为了走到 done）', redeem2.ok, `卡在 ${redeem2.at}`)
await wait(700)
await goWish()
await openCard()
await passPin(page) // committed 状态下，详情页底部就是 PIN 闸门
await wait(300)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('确认兑换'),
  )
  b?.click()
})
await wait(800)
await page.screenshot({ path: `${OUT}/06b-confirm-again.png` })
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.textContent?.trim() === '已经买好了',
  )
  b?.click()
})
await wait(1000)

const afterDone = await page.evaluate(() => {
  const s = window.__kqf__.getState()
  const o = s.wishOrders.find((x) => x.itemId === 'wish-popmart' && x.status === 'done')
  return {
    status: o?.status ?? '(没有 done 的单子)',
    doneAt: !!o?.doneAt,
    balance: s.harvestBalance,
    refunds: s.harvestLedger.filter((e) => e.source === 'wish_refund').length,
    redeemRows: s.harvestLedger.filter((e) => e.source === 'wish_redeem').length,
  }
})
check('订单走到 done', afterDone.status === 'done', String(afterDone.status))
check('done 有时间戳', afterDone.doneAt)
check('完成后券不退（成交在 App 外面）', afterDone.balance === 70, `余额 ${afterDone.balance}`)
check('完成没有多写退款流水', afterDone.refunds === 1, `${afterDone.refunds} 笔（取消那 1 笔）`)
check('扣券流水是 2 笔（两轮兑换）', afterDone.redeemRows === 2, `${afterDone.redeemRows} 笔`)

/* ---------- ⑧ 券不够：按钮灰掉 + 说清还差多少（两种币合计） ----------
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
  const s = window.__kqf__.getState()
  const btns = [...document.querySelectorAll('button')]
  // 底部那颗大按钮：文案只有两种形态 ——「🎫 用 N 换」/「还差 N」。
  // ⚠️ 够换的那一档**开头有 emoji**，所以不能锚 `^用`。
  // ⚠️ 2026-10-29 起可以券 + 积分混付，「还差」后面**不再有「张」** ——
  //    差额是两种币合起来算的，写「张」就成了谎话。
  const action = btns.find((x) =>
    /^(?:还差\s*\d+|🎁\s*去「兑换」换)$/.test((x.textContent ?? '').trim()),
  )
  const note = [...document.querySelectorAll('*')].find(
    (x) => x.children.length === 0 && /换这个要\s*\d+/.test(x.textContent ?? ''),
  )
  return {
    text: (action?.textContent ?? '').trim() || '(没找到按钮)',
    disabled: !!action?.disabled,
    note: (note?.textContent ?? '').trim(),
    vouchers: s.harvestBalance,
    points: s.balance,
  }
})
check('券不够时按钮是灰的（disabled）', poor.disabled, poor.text)
check(
  '券不够时按钮写「还差 N」（不带「张」）',
  /^还差\s*\d+$/.test(poor.text),
  poor.text,
)
check(
  '进度条下方写清「换这个要 9999，兑换券和积分加起来还差 M」',
  /换这个要\s*9999，兑换券和积分加起来还差\s*\d+/.test(poor.note),
  poor.note,
)
/* 差额必须是**两种币合计**算出来的。
 * 只按券算的话，一个「券 100、积分 300」的孩子会被告知「还差 9899」，
 * 而正确答案是 9599 —— 差的那 300 正是这次要修的东西，而且它不报错。 */
const expectShort = 9999 - (poor.vouchers + poor.points)
check(
  `还差的数量按两种币合计（应 ${expectShort}）`,
  new RegExp(`还差\\s*${expectShort}$`).test(poor.note),
  poor.note,
)

/* ---------- ⑧b 券不够、但积分能补 → 真的能换（2026-10-29） ----------
 *
 * 这条是这次改动的**唯一正向判据**。只测「还差」那一档的话，一个
 * 「把积分算进差额、但点下去仍然拒绝」的实现照样全绿 —— 界面写着够、
 * 实际换不了，是最难发现的那种。
 *
 * 不动券余额：把价格定在 `(券, 券+积分]` 区间内，分账必然出现两段。
 * 积分用调试句柄补到 300（`ledger` 表，和券那侧的退款流水计数互不干扰）。
 */
await page.evaluate(() => window.__kqf__.addPoints(300))
await wait(200)
const mix = await page.evaluate(async () => {
  const s = window.__kqf__.getState()
  // 券 + 50 分：券必然花光，剩下的必须从积分出
  const price = s.harvestBalance + 50
  await s.wishSetOffer('wish-popmart', price)
  return { price, vouchers: s.harvestBalance, points: s.balance }
})
check(
  '前提：孩子积分够补这 50（否则这条测不了混付）',
  mix.points >= 50,
  `积分 ${mix.points}`,
)
await wait(400)
const mixUi = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const action = btns.find((x) =>
    /^(?:还差\s*\d+|🎁\s*去「兑换」换)$/.test((x.textContent ?? '').trim()),
  )
  const note = [...document.querySelectorAll('*')].find(
    (x) => x.children.length === 0 && /换这个要\s*\d+/.test(x.textContent ?? ''),
  )
  return {
    text: (action?.textContent ?? '').trim(),
    disabled: !!action?.disabled,
    note: (note?.textContent ?? '').trim(),
  }
})
check('券不够但积分能补 → 按钮是亮的', !mixUi.disabled, mixUi.text)
check(
  '券不够但积分能补 → 进度条下方写出两种币各付多少',
  /付款：.*兑换券.*积分/.test(mixUi.note),
  mixUi.note,
)
await page.screenshot({ path: `${OUT}/06b-mixed-pay-detail.png` })

/* 列表卡片也得能看出来。看不到的话，孩子连点进详情的机会都没有 ——
 * 这是「能用积分」这件事在**入口**上的唯一线索。 */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.getAttribute('aria-label') === '返回',
  )
  b?.click()
})
await wait(600)
const listTag = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  return (card?.textContent ?? '').trim()
})
check('列表卡片也标出「🪙 补 N」', /🪙\s*补\s*\d+/.test(listTag), listTag)
await page.screenshot({ path: `${OUT}/06c-mixed-pay-list.png` })

// 回到详情 —— 后面的 ⑨ 断言要求「停在泡泡玛特详情」。
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(600)

/* ---------- ⑧c 纯积分：券 0，全靠积分（最常见的那一类孩子） ----------
 *
 * 一个只做任务、不玩农场的孩子手里**一张券都没有**。这一档以前直接
 * 「还差 N 张」、按钮灰着；现在必须能换，而且按钮上的图标不能还挂着 🎫
 * —— 同一屏上面刚写着「付款：60 积分」，图标说券，就是自相矛盾。
 *
 * 用完把券原样还回去，后面几段的余额算术不受影响。
 */
const zeroed = await page.evaluate(async () => {
  const st = () => window.__kqf__.getState()
  const had = st().harvestBalance
  await window.__kqf__.addVouchers(-had)
  await st().wishSetOffer('wish-popmart', 60)
  return { had, points: st().balance }
})
await wait(500)
const purePoints = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const action = btns.find((x) =>
    /^(?:还差\s*\d+|🎁\s*去「兑换」换)$/.test((x.textContent ?? '').trim()),
  )
  const note = [...document.querySelectorAll('*')].find(
    (x) => x.children.length === 0 && /换这个要\s*\d+/.test(x.textContent ?? ''),
  )
  return {
    text: (action?.textContent ?? '').trim(),
    disabled: !!action?.disabled,
    note: (note?.textContent ?? '').trim(),
  }
})
check('前提：积分够 60（否则测不了纯积分）', zeroed.points >= 60, `积分 ${zeroed.points}`)
check('券 0 也能换 —— 按钮是亮的', !purePoints.disabled && /去「兑换」换/.test(purePoints.text), purePoints.text)
check(
  '纯积分时付款只写积分，不写「0 兑换券」',
  /付款：\s*60\s*积分$/.test(purePoints.note),
  purePoints.note,
)
/* 2026-10-29 改口径后，这颗按钮**不再标币种**（它只是「去兑换」）。
   原来那句「图标必须是 🪙 不能是 🎫」的判据跟着作废了 —— 现在要守的是
   「币种只出现在付款行里」，所以反向断言：按钮上不许再挂 🎫。 */
check(
  '纯积分时按钮不挂 🎫（币种只在付款行里说）',
  !purePoints.text.includes('🎫'),
  purePoints.text,
)
await page.screenshot({ path: `${OUT}/06d-pure-points.png` })

// 券原样还回去
await page.evaluate(async (had) => {
  if (had > 0) await window.__kqf__.addVouchers(had)
  await window.__kqf__.getState().wishSetOffer('wish-popmart', had + 50)
}, zeroed.had)
await wait(400)

/* 家长主动来定价（孩子没提过意向）时，页面不能替孩子说「想要这个」。
 *
 * ⚠️ 必须换一件**从没下过单**的商品来测（这里用「儿童学习机」）。
 * 原来用的是泡泡玛特 —— 但走到这一步它已经有过 cancelled + done 两单了，
 * 判据就变成「有单子却说不想要」，测的是**另一个**场景。
 * 而 `childAsked` 的口径是「有没有单子」，泡泡玛特那里说「孩子想要这个」
 * 是对的。要测「没提过」，就得找一件真的没提过的。
 *
 * 原来的文案是写死的，孩子明明没点过也照样显示，属于「图对、说明错」，
 * 结构断言完全看不见，只有截图走查会撞见。 */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.getAttribute('aria-label') === '返回',
  )
  b?.click()
})
await wait(500)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('儿童学习机'),
  )
  b?.click()
})
await wait(700)
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
/* ⚠️ 要按**两次**返回：定价页的返回回到「儿童学习机详情」，
   再按一次才回到列表。只按一次就去找 `.grid > button`，那里根本没有
   网格（在详情页）⇒ 点击静默无效、停在错误页面，⑨ 的判据全红。 */
for (let i = 0; i < 2; i++) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === '返回',
    )
    b?.click()
  })
  await wait(450)
}
/* 回到泡泡玛特的详情（那件有 9999 的报价）——
   ⑨ 要同时看到「家长支付」和「换这个要 N 张」两块，只有定价过的商品才有。 */
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(700)

/* ---------- ⑨ 价格与券价分层 + 没有汇率换算 ---------- */
/* 前置：必须停在**定价过的**商品详情上，否则这条判据测的是空气
   （曾经在「儿童学习机」的详情上跑：它有「家长支付」但没有券价块，
   于是「券价顶部 -1」，看着像布局坏了，其实是走错页）。 */
const onRightPage = await page.evaluate(() => {
  const t = document.body.innerText
  return { title: t.split('\n').filter(Boolean).slice(0, 3).join(' / '), hasItem: t.includes('泡泡玛特盲盒') }
})
check(
  '⑨ 的前置：停在泡泡玛特详情（有参考价也有券价）',
  onRightPage.hasItem,
  onRightPage.title,
)

const layering = await page.evaluate(() => {
  const body = document.body.innerText
  // 参考价那张卡（「家长支付 ¥69」）和券价说明必须在**上下两块**里，
  // 不能并排 —— 并排孩子就会自己算出 1 张 ≈ 多少钱（spec §8）。
  const payLabel = [...document.querySelectorAll('*')].find(
    (x) => x.children.length === 0 && (x.textContent ?? '').trim() === '家长支付',
  )
  const payCard = payLabel?.closest('div')
  const voucherNote = [...document.querySelectorAll('*')].find(
    // 2026-10-29 起这句不再带「张」（券 + 积分混付，差额按两种币合计）
    (x) => x.children.length === 0 && /换这个要\s*\d+/.test(x.textContent ?? ''),
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

/* ---------- ⑪ 数字商品：兑换即交付，别让界面说「等爸妈确认」 ----------
 *
 * 盲盒/盒子在「兑换」那一刻就交付（当场开箱 / 当场装包），实物才要等
 * 爸妈去淘宝买。两者共用 `committed` 状态，所以**文案必须分叉**。
 *
 * 2026-10-28 走查抓到过：孩子刚开完箱、游戏已经能玩，列表上挂着
 * 「等爸妈确认」，点进详情先撞一道家长密码「确认兑换需要密码」，
 * 底下按钮写着「去购买」。三句话单独看都合法，合起来是自相矛盾。
 * 结构断言全绿 —— 只有真跑一遍才知道。
 */
console.log('\n── 数字商品（盲盒）交付 ──')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => x.getAttribute('aria-label') === '返回',
  )
  b?.click()
})
await wait(500)

// 家长开放盲盒 + 补券（都走 store/账本，不点 UI）
const beforeDigital = await page.evaluate(async () => {
  const st = window.__kqf__.getState()
  await st.wishSetOffer('wish-blindbox', 20)
  await window.__kqf__.addVouchers(100)
  return { balance: window.__kqf__.getState().harvestBalance }
})
await wait(600)

await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('游戏盲盒'),
  )
  b?.click()
})
await wait(700)
// 2026-10-29：盲盒也在「兑换」那一格成交 —— 开箱层跟着搬到了那边（Portal）
const redeemBox = await redeemInShop('wish-blindbox')
check('★ 盲盒在兑换那一格换掉（不是心愿页）', redeemBox.ok, `卡在 ${redeemBox.at}`)
// 装包要读本地包 + 装配，给足时间，用轮询而不是固定 sleep
await page
  .waitForFunction(() => document.body.innerText.includes('抽到了新游戏'), { timeout: 30000 })
  .catch(() => {})
await wait(500)
await page.screenshot({ path: `${OUT}/07-box-reveal.png` })

const opened = await page.evaluate(() => {
  const s = window.__kqf__.getState()
  const o = s.wishOrders.find((x) => x.itemId === 'wish-blindbox')
  return {
    onBoxPage: document.body.innerText.includes('抽到了新游戏'),
    status: o?.status ?? '(没有单子)',
    gameId: o?.openedGameId ?? '',
    installed: Object.keys(s.installedGames),
    balance: s.harvestBalance,
  }
})
check('兑换后进开箱页', opened.onBoxPage)
check('订单带 openedGameId（交付凭证）', !!opened.gameId, opened.gameId)
check('游戏真的装上了', opened.installed.includes(opened.gameId), opened.installed.join(','))
check(
  '券扣了 20 张',
  opened.balance === beforeDigital.balance - 20,
  `${beforeDigital.balance} → ${opened.balance}`,
)

// 收下 → 回心愿列表：不许再说「等爸妈确认」
// ⚠️ 开箱层盖在**兑换**那一格上，收下之后仍停在兑换 —— 得先切回心愿，
//    否则下面读的是兑换列表，`已放进游戏柜` 当然找不到（第一版就这么红过）。
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => (x.textContent ?? '').trim() === '收下',
  )
  b?.click()
})
await wait(900)
await goWish()
await page.screenshot({ path: `${OUT}/07b-list-after-box.png` })
const listAfterBox = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    waiting: body.includes('等爸妈确认'),
    delivered: body.includes('已放进游戏柜'),
    banner: body.includes('在等爸妈处理'),
  }
})
check('列表不再说「等爸妈确认」', !listAfterBox.waiting)
check('列表写「已放进游戏柜」', listAfterBox.delivered)
/* 家长端唯一的提示：孩子换了东西，列表顶部要说清有几单、是什么。
   没有它，家长只能逐个商品点开看标记。 */
check('列表顶部有「等爸妈处理」入口', listAfterBox.banner)

// 详情：主内容是「已经拿到」，不是密码闸门 + 去购买
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('游戏盲盒'),
  )
  b?.click()
})
await wait(700)
await page.screenshot({ path: `${OUT}/07c-detail-after-box.png` })
const detailAfterBox = await page.evaluate(() => {
  const body = document.body.innerText
  return {
    delivered: body.includes('已经放进你的游戏柜了'),
    gated: body.includes('请爸爸妈妈来一下'),
    buy: body.includes('去购买'),
    parentEntry: body.includes('完成这一单'),
  }
})
check('详情写「已经放进你的游戏柜了」', detailAfterBox.delivered)
check('详情没有先摆家长密码闸门', !detailAfterBox.gated)
check('详情没有「去购买」（App 内已解锁）', !detailAfterBox.buy)
check('家长收尾的入口还在', detailAfterBox.parentEntry)

// 家长收尾：入口 → 密码 → 完成这一单 → 订单 done、券不动
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    x.textContent?.includes('完成这一单'),
  )
  b?.click()
})
await wait(500)
await passPin(page)
await wait(400)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => (x.textContent ?? '').trim() === '完成这一单',
  )
  b?.click()
})
await wait(800)
await page.screenshot({ path: `${OUT}/07d-confirm-digital.png` })
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => (x.textContent ?? '').trim() === '完成这一单',
  )
  b?.click()
})
await wait(900)

const digitalDone = await page.evaluate(() => {
  const s = window.__kqf__.getState()
  const o = s.wishOrders.find((x) => x.itemId === 'wish-blindbox')
  return {
    status: o?.status ?? '(没有单子)',
    doneAt: !!o?.doneAt,
    balance: s.harvestBalance,
    refunds: s.harvestLedger.filter((e) => e.source === 'wish_refund').length,
    banner: document.body.innerText.includes('在等爸妈处理'),
  }
})
check('订单收尾到 done', digitalDone.status === 'done', String(digitalDone.status))
check('done 有时间戳', digitalDone.doneAt)
check(
  '收尾时券不退（东西已经给了）',
  digitalDone.balance === opened.balance,
  `${opened.balance} → ${digitalDone.balance}`,
)
check('收尾没多写退款流水', digitalDone.refunds === 1, `${digitalDone.refunds} 笔（前面取消那 1 笔）`)
check('单子收尾后「等爸妈处理」入口消失', !digitalDone.banner)

/* ---------- ⑫ 单个游戏：就是那个游戏，不是「盒子里的一张卡」 ----------
 *
 * 用户口径（2026-10-28）：「单个游戏就是游戏 不是盲盒」「点游戏的时候，
 * 也要展示类似设置里游戏/详情页的东西」。所以这里要验三件事：
 *   ① 分类叫「游戏」，界面上不出现「盒子 / 指定款」；
 *   ② 详情里有截图 / 练什么 / 关于（和「设置 → 游戏 → 详情」同一份内容）；
 *   ③ **换视图要回到顶部** —— 游戏卡片在列表很下面，滚下去点开，
 *      不重置滚动就停在详情中段（截图/练什么），名字和兑换按钮全在屏幕外，
 *      看着像「点了没反应」。
 */
console.log('\n── 单个游戏详情 ──')
const scrolledToGames = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.querySelector('svg'),
  )
  if (!card) return false
  card.scrollIntoView({ block: 'center' })
  return true
})
await wait(500)
check('列表里能找到游戏卡片（有手绘图标）', scrolledToGames)

const gameName = await page.evaluate(() => {
  const card = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.querySelector('svg'),
  )
  const name = card?.innerText?.split('\n')[0] ?? ''
  card?.click()
  return name
})
await wait(800)
await page.screenshot({ path: `${OUT}/08-game-detail.png` })

const gameDetail = await page.evaluate(() => {
  const body = document.body.innerText
  const main = document.querySelector('main')
  const back = document.querySelector('button[aria-label="返回"]')
  return {
    hasShots: body.includes('截图'),
    hasLearn: body.includes('练什么'),
    hasAbout: body.includes('关于这款游戏'),
    // 分类文案：不该再有「盒子」「指定款」
    boxWord: body.includes('盒子'),
    specWord: body.includes('指定款'),
    scrollTop: Math.round(main?.scrollTop ?? -1),
    // 顶栏 + 返回按钮必须在视口内 —— 换视图回到顶部的判据
    backTop: back ? Math.round(back.getBoundingClientRect().top) : -1,
    shots: document.querySelectorAll('img').length,
  }
})
check('游戏详情有截图', gameDetail.hasShots, `${gameDetail.shots} 张图`)
check('游戏详情有「练什么」', gameDetail.hasLearn)
check('游戏详情有「关于这款游戏」', gameDetail.hasAbout)
check('界面上没有「盒子」「指定款」字样', !gameDetail.boxWord && !gameDetail.specWord)
check('换视图后回到顶部（不是停在详情中段）', gameDetail.scrollTop === 0, `scrollTop=${gameDetail.scrollTop}`)
check('返回按钮在视口内', gameDetail.backTop >= 0 && gameDetail.backTop < 200, `top=${gameDetail.backTop}`)

// 截图能点开（放大层挂在 body 上，不能被底部导航压住）
await page.evaluate(() => {
  const img = document.querySelector('img')
  img?.closest('button')?.click()
})
await wait(500)
const zoomed = await page.evaluate(() => {
  const layer = document.querySelector('button[aria-label="关闭大图"]')
  if (!layer) return { open: false }
  /* 「盖住了没有」只能靠 `elementFromPoint` —— 底部导航那一点命中的是谁，
     就是谁在最上面。`z-index` 抬到 9999 也可能被外壳的层叠上下文关住
     （`anim-fade` 是隐式层叠上下文，见 `components/Portal.tsx`）。 */
  const hit = document.elementFromPoint(195, window.innerHeight - 40)
  return {
    open: true,
    coversNav: !!hit && (hit === layer || layer.contains(hit)),
  }
})
check('点截图能放大', zoomed.open)
check('放大层盖住底部导航（Portal 生效）', zoomed.coversNav)
await page.evaluate(() => {
  document.querySelector('button[aria-label="关闭大图"]')?.click()
})
await wait(300)
await page.evaluate(() => {
  document.querySelector('button[aria-label="返回"]')?.click()
})
await wait(500)
void gameName

/* ---------- ⑬ 兑换记录：结束的单子不能「消失」 ----------
 *
 * `done` / `cancelled` 的单子在别处看不见：卡片只显示还没走完的，
 * 待办入口只算 committed / confirmed。没有这一屏，孩子换到手的东西
 * 过一天就查不到了 —— 而这正是「我到底换过没有」的唯一答案。
 *
 * 走到这里手上应该有 3 单：泡泡玛特（取消）、泡泡玛特（完成）、盲盒（完成）。
 */
console.log('\n── 我许的愿（原「兑换记录」）──')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find(
    (x) => (x.textContent ?? '').trim() === '我许的愿',
  )
  b?.click()
})
await wait(700)
await page.screenshot({ path: `${OUT}/09-orders.png` })

const ordersView = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('[data-wish-order]')]
  const text = document.body.innerText
  return {
    count: rows.length,
    hasCancelled: text.includes('已取消'),
    doneCount: rows.filter((r) => r.innerText.includes('已经拿到')).length,
    // 记录里也要标出「已放进游戏柜」，不然「已拿到」和「游戏在哪」是两回事
    delivered: text.includes('已放进游戏柜'),
    empty: text.includes('还没有换过东西'),
  }
})
check('兑换记录列出全部 3 单', ordersView.count === 3, `${ordersView.count} 单`)
check('取消过的单子还在（不是消失了）', ordersView.hasCancelled)
check('两单完成的是「已经拿到」', ordersView.doneCount === 2, `${ordersView.doneCount} 单`)
check('已交付的数字商品有标记', ordersView.delivered)
check('有单子时不显示空态', !ordersView.empty)

await page.evaluate(() => {
  document.querySelector('button[aria-label="返回"]')?.click()
})
await wait(500)

/* ---------- ⑭ 爸妈定好价的心愿 = 兑换列表里的普通一行（2026-10-29，第二轮） ----------
 *
 * 家长原话（两轮，第二轮回过头纠正了第一轮的做法）：
 *   「爸爸妈妈已经定好价格的，相当于添加了兑换，应该出现在兑换列表里。」
 *   「兑换 里的东西都是一样，都能用兑换券或者积分，包括游戏也一样。
 *    不需要去心愿商城换。心愿商城只是标明心愿的。」
 *
 * 第一版做成了「兑换里摆一块心愿货架、点一下跳到心愿页去换」—— 被当场否掉：
 * 那等于在兑换里开一道门，通往**另一个收银台**。
 *
 * 所以这一段守三件事，而且只有真跑起来才知道（单测里 `tab` 那个 useState 不存在）：
 *   ① 心愿商品是**普通一行**（`[data-shop-row]`），没有「爸妈开放了」那块标题；
 *   ② 它和家里的兑换品在**同一个 ul** 里（同一张表，按价混排）；
 *   ③ 点「换这个」→「换！」**就地扣币**并生成 committed 单子，不跳页。
 *
 * 走到这里手上定过价的商品：泡泡玛特、游戏盲盒（20）。
 * 儿童学习机**没定过价**，它不该出现（对照组）。
 */
console.log('\n── 兑换列表里的心愿 ──')

// 先把泡泡玛特的价钉成 40：保证「两种币加起来够」，后面点「换！」不会灰着
await page.evaluate(async () => {
  await window.__kqf__.getState().wishSetOffer('wish-popmart', 40)
})
await wait(500)

await page.evaluate(() => {
  const b = [...document.querySelectorAll('[data-tour^="tab-"]')].find((x) =>
    (x.innerText ?? '').includes('兑换'),
  )
  b?.click()
})
await wait(900)
await page.screenshot({ path: `${OUT}/10-redeem-wish-row.png` })

const shelf = await page.evaluate(() => {
  const row = document.querySelector('[data-shop-row="wish-popmart"]')
  const ul = row?.closest('ul')
  return {
    hasPop: !!row,
    hasBox: !!document.querySelector('[data-shop-row="wish-blindbox"]'),
    hasStudyPad: !!document.querySelector('[data-shop-row="wish-study-pad"]'),
    // 家长反对的正是这个标题 —— 它意味着「兑换里还有另一个入口」
    hasBlockTitle: document.body.innerText.includes('爸妈开放了'),
    // 「同一张表」的判据：这一行所在的 ul 里还有**家里的**兑换品
    // （没有 data-shop-row 的 li）。分成两块的话这里恒 false。
    sameListAsFamily:
      !!ul && [...ul.children].some((li) => li.tagName === 'LI' && !li.hasAttribute('data-shop-row')),
  }
})
check('★ 定过价的心愿就是兑换列表里的一行', shelf.hasPop)
check('盲盒（定过价 20）也在同一张表里', shelf.hasBox)
check('★ 没有「心愿商城 · 爸妈开放了」那一块', !shelf.hasBlockTitle)
check('没定过价的心愿不出现（儿童学习机）', !shelf.hasStudyPad)
check('★ 和家里的兑换品在同一个列表里（不是另起一块）', shelf.sameListAsFamily)

// 心愿页 →「去「兑换」换」→ 落到兑换那一格、并闪到那一行。
// `tab` 是 App 的 useState，心愿页拿不到 setter ⇒ 只能走 store 通道。
await page.click('[data-tour="tab-wish"]')
await wait(700)
await page.evaluate(() => {
  const b = [...document.querySelectorAll('.grid > button')].find((x) =>
    x.textContent?.includes('泡泡玛特'),
  )
  b?.click()
})
await wait(700)
const jumpBtn = await page.evaluate(() => {
  const b = document.querySelector('[data-wish-to-redeem]')
  return { exists: !!b, disabled: !!b?.disabled, text: (b?.textContent ?? '').trim() }
})
check('心愿详情里有「去「兑换」换」', jumpBtn.exists, jumpBtn.text)
check('前提：这一件孩子换得起（否则按钮是灰的）', !jumpBtn.disabled, jumpBtn.text)

await page.evaluate(() => document.querySelector('[data-wish-to-redeem]')?.click())
await wait(1000)
await page.screenshot({ path: `${OUT}/10b-jumped-to-redeem.png` })
const jumped = await page.evaluate(() => {
  const row = document.querySelector('[data-shop-row="wish-popmart"]')
  return {
    onRedeemTab:
      document.querySelector('[data-tour="tab-redeem"]')?.getAttribute('aria-current') === 'page',
    flash: !!row && /ring-grass-400/.test(row.className),
    pending: window.__kqf__.getState().pendingRedeemItem,
  }
})
check('★ 跳过来落在「兑换」那一格', jumped.onRedeemTab)
check('★ 并且闪到那一行（不是让孩子自己翻）', jumped.flash)
check(
  '通道取走就清空（不然切回来会被反复拽到同一行）',
  jumped.pending == null,
  String(jumped.pending),
)

/* 就地换：点「换这个」→「换！」
 *
 * ⚠️ 判据看**账本派生的余额**和 `wishOrders`，不看按钮文案 ——
 *    「文案对了但没扣」是这个项目最经典的静默失败。
 */
const walletBefore = await page.evaluate(() => {
  const st = window.__kqf__.getState()
  return { vouchers: st.harvestBalance, points: st.balance }
})
const confirmOpened = await page.evaluate(() => {
  const row = document.querySelector('[data-shop-row="wish-popmart"]')
  const b = [...(row?.querySelectorAll('button') ?? [])].find((x) =>
    /换这个/.test(x.textContent ?? ''),
  )
  if (!b) return { ok: false }
  b.click()
  return { ok: true }
})
await wait(500)
const confirmed = await page.evaluate(() => {
  const row = document.querySelector('[data-shop-row="wish-popmart"]')
  const b = [...(row?.querySelectorAll('button') ?? [])].find((x) =>
    /换！/.test(x.textContent ?? ''),
  )
  if (!b) return { ok: false, hint: (row?.innerText ?? '').slice(0, 160) }
  b.click()
  return { ok: true }
})
check('点「换这个」展开二次确认', confirmOpened.ok)
check('二次确认里有「换！」（就地成交，不跳页）', confirmed.ok, confirmed.hint ?? '')
await wait(1500)
await page.screenshot({ path: `${OUT}/10c-redeemed-in-place.png` })

const walletAfter = await page.evaluate(() => {
  const st = window.__kqf__.getState()
  const order = st.wishOrders.find((o) => o.itemId === 'wish-popmart' && o.status === 'committed')
  return {
    vouchers: st.harvestBalance,
    points: st.balance,
    onRedeemTab:
      document.querySelector('[data-tour="tab-redeem"]')?.getAttribute('aria-current') === 'page',
    rowGone: !document.querySelector('[data-shop-row="wish-popmart"]'),
    order: order
      ? { price: order.voucherPrice, held: order.vouchersHeld, points: order.pointsHeld ?? 0 }
      : null,
  }
})
const spent = walletBefore.vouchers + walletBefore.points - (walletAfter.vouchers + walletAfter.points)
check('★ 就地扣了 40（券 + 积分合计）', spent === 40, `少了 ${spent}`)
check('★ 生成 committed 单子（不是跳去心愿页换）', !!walletAfter.order, JSON.stringify(walletAfter.order))
check(
  '押的就是实际扣掉的两种币（退款按它退）',
  !!walletAfter.order && walletAfter.order.held + walletAfter.order.points === 40,
  JSON.stringify(walletAfter.order),
)
check('换完这一行消失（在走流程的不再上架）', walletAfter.rowGone)
check('扣币之后没被弹到别处', walletAfter.onRedeemTab)

/* ★ 换完必须在「📜 兑换记录」里看得到（2026-10-29 家长报的 bug）
 *
 * 「孩子刚兑换了一个游戏，为啥我兑换记录里看不到。」
 * 记录页原来只读 `redeemRecords`（家里那几件），而游戏/心愿写的是
 * `wishOrders` —— 券扣了、游戏装上了，记录里一个字都没有，界面零异常。
 *
 * ⚠️ 判据要扫**全部行**，不能只看第一行：`wishRedeem` 会复用那条 `wished`
 *    单子并保留它原来的 `createdAt`，所以刚换的这一单在时间线上可能不在最上面。
 */
const recordsTab = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) =>
    /兑换记录/.test(x.textContent ?? ''),
  )
  if (!b) return false
  b.click()
  return true
})
await wait(800)
await page.screenshot({ path: `${OUT}/10d-redeem-records.png` })
const recordRows = await page.evaluate(() =>
  [...document.querySelectorAll('[data-redeem-record]')].map((r) => (r.textContent ?? '').trim()),
)
check('★ 兑换记录里能看到刚换的那一单', recordsTab && recordRows.some((t) => t.includes('泡泡玛特')))
check(
  '记录里写出了扣掉多少（对账要看这个）',
  recordRows.some((t) => t.includes('泡泡玛特') && t.includes('40 兑换券')),
  recordRows.find((t) => t.includes('泡泡玛特')) ?? '(没找到)',
)
/* 前面 ⑪ 换的盲盒（游戏）也必须在同一屏里 —— 家长问的就是「游戏去哪了」 */
check(
  '★ 之前换的游戏也在同一份记录里',
  recordRows.some((t) => t.includes('游戏盲盒')),
  `${recordRows.length} 行`,
)


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
