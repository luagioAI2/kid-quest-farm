/**
 * 端到端验收脚本
 * ------------------------------------------------------------
 * 用真实 Chrome 跑一遍核心流程，捕捉只有运行时才会暴露的问题：
 *   - 控制台报错 / 未捕获异常
 *   - 三个主 Tab 能否渲染
 *   - 任务结算是否能正常入账（积分变化）
 *   - 农场能否种植 / 动物能否领养
 *   - 数据导出是否产出合法 JSON
 *   - 移动端视口下有无横向溢出
 *
 * 用法：node scripts/e2e-check.mjs [url]
 */
import puppeteer from 'puppeteer-core'
import { existsSync, writeFileSync, mkdirSync } from 'node:fs'
import { makeProfileDir } from './lib/profile.mjs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]

const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) {
  console.error('找不到 Chrome/Edge，无法执行 E2E')
  process.exit(2)
}

const errors = []
const warnings = []
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
  // profile 必须落在项目同盘 —— 系统盘满会让 Chrome 的 IndexedDB 直接罢工，
  // 症状是随机挂在任意一条用例上。见 scripts/lib/profile.mjs 顶部。
  userDataDir: makeProfileDir('check'),
})

try {
  const page = await browser.newPage()
  // iPhone 12 尺寸 —— 目标设备就是手机
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })

  page.on('console', (msg) => {
    const t = msg.type()
    const text = msg.text()
    if (t === 'error') errors.push(text)
    else if (t === 'warning') warnings.push(text)
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`))
  page.on('requestfailed', (r) => {
    const u = r.url()
    // 字体等外部资源在离线环境下失败不算问题
    if (!/fonts\.(googleapis|gstatic)/.test(u)) {
      errors.push(`REQFAIL: ${u} ${r.failure()?.errorText ?? ''}`)
    }
  })

  console.log(`\n打开 ${URL}\n`)
  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 })

  /* ---------- 1. 启动与渲染 ---------- */
  await page.waitForSelector('#root > *', { timeout: 20000 })
  // 等入场页过去。
  // 判据是「底部导航出现了」—— 导航只存在于主界面，入场页没有它。
  // 以前这里写的是 `!includes('小任务农场') || includes('任务')`，
  // 而入场页里就有「小任务农场」、主界面里到处是「任务」，
  // 两个分支必然有一个成立 → 这个条件**恒为真**，等于没等。
  // 入场页现在有 1.9s 最短停留，靠后面那句固定 1200ms 是等不过去的。
  await page
    .waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
    .catch(() => {})
  await new Promise((r) => setTimeout(r, 1200))

  const bodyText = await page.evaluate(() => document.body.innerText)
  check('页面渲染出内容', bodyText.length > 20, `${bodyText.length} 字符`)
  check('无启动报错', errors.length === 0, errors.slice(0, 3).join(' | '))

  /* ---------- 1b. 新手引导（全新 profile 必经） ----------
     ⚠️ 这一段**必须跑在最前面，而且必须真的把引导走完**。

     全新 profile 里 IndexedDB 是空的、`onboardingDone` 还是 false，
     向导会盖住整个主界面。而下面那些 Tab 检查用的是 DOM 的 `.click()` ——
     它**绕过命中测试**，被盖住也照样点得到，于是所有检查会继续变绿，
     而界面其实根本不能用。所以这里不只看「向导在不在」，
     还要用 elementFromPoint 证明它**真的**挡住了导航，
     走完引导之后再证明导航**真的**回到了最上层。
  */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  /** 点一个「文字正好等于 label」的按钮 */
  const clickByText = (label) =>
    page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => (x.textContent ?? '').trim() === t,
      )
      if (!b) return false
      b.click()
      return true
    }, label)

  /** 等某个选择器出现（超时返回 false，不抛） */
  const waitFor = (sel, timeout = 8000) =>
    page
      .waitForFunction((s) => !!document.querySelector(s), { timeout }, sel)
      .then(() => true, () => false)

  /**
   * 命中测试：某个元素**中心点**上最顶层的元素是不是它自己。
   * 判「有没有被盖住」只能靠这个 —— z-index 和肉眼都不算数
   * （页面外壳那层 anim-fade-in 的隐式层叠上下文就查不出来）。
   */
  const isReachable = (sel) =>
    page.evaluate((s) => {
      const el = document.querySelector(s)
      if (!el) return { found: false, ok: false, hit: 'null' }
      const r = el.getBoundingClientRect()
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return {
        found: true,
        ok: hit === el || el.contains(hit),
        hit: hit ? hit.tagName + (hit.className ? '.' + String(hit.className).split(' ')[0] : '') : 'null',
      }
    }, sel)

  check('首次启动弹出家长设置向导', await waitFor('[data-step="welcome"]'))

  const wizardBlocksNav = await isReachable('[data-tour="tab-tasks"]')
  check(
    '向导期间底部导航点不到（命中测试，不是靠 z-index 猜）',
    wizardBlocksNav.found && !wizardBlocksNav.ok,
    `该点最顶层是 ${wizardBlocksNav.hit}`,
  )

  await clickByText('开始设置')
  check('向导第二步：问名字和头像', await waitFor('input[aria-label="孩子的小名"]'))

  await clickByText('下一步')
  check('向导第三步：设家长密码', await waitFor('[data-step="pin"]'))

  // 走「以后再说」而不是真设密码 —— 后面第 6 节要用默认密码 0000 走家长确认
  await clickByText('以后再说')
  check('跳过密码后进到完成页', await waitFor('[data-step="done"]'))

  await clickByText('带宝贝看一遍')
  check('接着弹出给孩子的功能导览', await waitFor('[data-tour-bubble="tasks"]'))

  const tourBlocksNav = await isReachable('[data-tour="tab-tasks"]')
  check(
    '导览期间底部导航点不到',
    tourBlocksNav.found && !tourBlocksNav.ok,
    `该点最顶层是 ${tourBlocksNav.hit}`,
  )

  // 高亮框要真的套在「任务」那一格上，气泡要在它上方 ——
  // 否则孩子看到的只是一块压暗的屏幕，不知道在讲哪儿。
  const hole = await page.evaluate(() => {
    const tab = document.querySelector('[data-tour="tab-tasks"]')
    const bubble = document.querySelector('[data-tour-bubble]')
    if (!tab || !bubble) return null
    // 挖洞层是唯一一个带 9999px 外阴影的元素（见 ChildTour 的注释）
    const holeEl = [...document.querySelectorAll('div')].find((d) =>
      (d.getAttribute('style') ?? '').includes('9999px'),
    )
    if (!holeEl) return null
    const t = tab.getBoundingClientRect()
    const h = holeEl.getBoundingClientRect()
    return {
      covers:
        h.left <= t.left + 1 && h.right >= t.right - 1 && h.top <= t.top + 1 && h.bottom >= t.bottom - 1,
      bubbleAbove: bubble.getBoundingClientRect().bottom <= h.top + 1,
    }
  })
  check(
    '高亮框正好套住「任务」那一格，且气泡在它上方',
    !!hole && hole.covers && hole.bubbleAbove,
    hole ? `covers=${hole.covers} bubbleAbove=${hole.bubbleAbove}` : '没找到挖洞层',
  )

  const restSteps = ['farm', 'redeem', 'points']
  for (let n = 0; n < restSteps.length; n++) {
    await clickByText('下一步')
    await sleep(250)
    const k = restSteps[n]
    const ok = await page.evaluate(
      (key) => !!document.querySelector(`[data-tour-bubble="${key}"]`),
      k,
    )
    check(`导览第 ${n + 2} 步切到「${k}」`, ok)
  }

  await clickByText('知道啦')
  await sleep(400)
  check(
    '导览收尾后弹层消失',
    !(await page.evaluate(() => !!document.querySelector('[data-tour-bubble]'))),
  )

  // ★ 这一条才是这一段真正的重点：引导走完，导航必须**真的**能用
  const navOk = await isReachable('[data-tour="tab-tasks"]')
  check(
    '引导走完后底部导航恢复可点（命中测试）',
    navOk.found && navOk.ok,
    `该点最顶层是 ${navOk.hit}`,
  )

  // 引导标记要落库：重开一次不能再弹
  await sleep(600)
  await page.reload({ waitUntil: 'networkidle2' })
  await page
    .waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
    .catch(() => {})
  await sleep(1200)
  check(
    '重开 App 不再弹引导（onboardingDone 已落库）',
    !(await page.evaluate(() => !!document.querySelector('[data-step]'))),
  )

  /* ---------- 2. 四个主 Tab ---------- */
  const tabs = ['任务', '农场', '兑换', '积分']
  for (const t of tabs) {
    const clicked = await page.evaluate((label) => {
      // 底部导航按钮内容是 emoji + 换行 + 文字，因此取最后一行比对
      const btns = [...document.querySelectorAll('button')]
      const b = btns.find((x) => x.innerText.trim().split('\n').pop().trim() === label)
      if (b) { b.click(); return true }
      return false
    }, t)
    if (!clicked) {
      check(`Tab「${t}」可点击`, false, '没找到按钮')
      continue
    }
    await new Promise((r) => setTimeout(r, 900))
    const txt = await page.evaluate(() => document.body.innerText)
    check(`Tab「${t}」渲染`, txt.length > 30, `${txt.replace(/\s+/g, ' ').slice(0, 60)}…`)
  }

  /* ---------- 3. 横向溢出检测 ---------- */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
    )
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 800))
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }))
  check(
    '移动端无横向溢出',
    overflow.scrollW <= overflow.clientW + 2,
    `scrollW=${overflow.scrollW} clientW=${overflow.clientW}`,
  )

  /* ---------- 3b. 顶栏：两个币种都在，且塞得下长名字 ----------
     顶栏现在有 头像 + 名字 + 🪙 + 🌾 + 两个按钮，是全局最挤的一行。
     名字那个 span 上的 `truncate` **必须配 `min-w-0` 才会真的收缩** ——
     flex 子项默认 `min-width: auto`，不会小于内容宽度，
     于是长名字把整行顶出去；而桌面浏览器会用横向滚动条兜住，
     在手机上就是**直接被裁掉**（看不出来，除非专门量）。 */
  const headerProbe = await page.evaluate(async () => {
    const s = () => window.__kqf__.getState()
    const header = () => document.querySelector('header')
    const measure = () => {
      const h = header()
      const nameEl = h?.children?.[1]
      return {
        h: h ? Math.round(h.getBoundingClientRect().height) : -1,
        nameW: nameEl ? Math.round(nameEl.getBoundingClientRect().width) : -1,
        nameContentW: nameEl ? Math.round(nameEl.scrollWidth) : -1,
      }
    }

    const prev = s().settings.childName
    const short = measure() // 先量短名字当基准
    await s().updateSettings({ childName: '小明明的超级无敌长名字测试' })
    await new Promise((r) => setTimeout(r, 400))
    const long = measure()

    const labels = [...(header()?.querySelectorAll('[aria-label]') ?? [])].map((e) =>
      e.getAttribute('aria-label'),
    )
    return {
      prev,
      short,
      long,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
      labels,
    }
  })
  check(
    '长名字不会把顶栏顶出屏幕',
    headerProbe.scrollW <= headerProbe.clientW + 2,
    `scrollW=${headerProbe.scrollW} clientW=${headerProbe.clientW}，` +
      `名字容器 ${headerProbe.long.nameW}（内容 ${headerProbe.long.nameContentW}）`,
  )
  check(
    '长名字真的被省略号截断了',
    headerProbe.long.nameContentW > headerProbe.long.nameW && headerProbe.long.nameW > 0,
    `容器 ${headerProbe.long.nameW} < 内容 ${headerProbe.long.nameContentW}`,
  )
  /* 顶栏必须**始终一行高**。
     名字要是没被截断而是折行，横向溢出查不出来（`scrollW` 照样等于 `clientW`），
     但整行会被撑高、把下面的内容顶下去 —— 所以直接比高度。 */
  check(
    '长名字不会把顶栏撑高（仍然是一行）',
    headerProbe.long.h === headerProbe.short.h && headerProbe.short.h > 0,
    `短名字 ${headerProbe.short.h}px → 长名字 ${headerProbe.long.h}px`,
  )
  check(
    '顶栏同时显示积分和丰收币',
    headerProbe.labels.some((c) => c?.startsWith('积分')) &&
      headerProbe.labels.some((c) => c?.startsWith('丰收币')),
    headerProbe.labels.join(' / ') || '一个都没找到',
  )
  // 还原名字：后面几项会打印顶栏文字，改着名字会把输出搞乱
  await page.evaluate(async (prev) => {
    await window.__kqf__.getState().updateSettings({ childName: prev })
    await new Promise((r) => setTimeout(r, 300))
  }, headerProbe.prev)

  /* ---------- 4. 任务结算：开始计时 → 完成 → 积分入账 ---------- */
  const balanceBefore = await page.evaluate(() => {
    const m = document.body.innerText.match(/🪙\s*(\d+)/)
    return m ? Number(m[1]) : -1
  })

  // 打开第一个待完成任务的详情
  const opened = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')]
    const b = btns.find((x) => /开始|完成|去完成/.test(x.innerText))
    if (b) { b.click(); return b.innerText.trim() }
    return null
  })
  check('任务卡片有可点击的行动按钮', !!opened, opened ?? '未找到')

  if (opened) {
    await new Promise((r) => setTimeout(r, 1000))
    const sheetText = await page.evaluate(() => document.body.innerText)
    check('任务详情/结算面板打开', sheetText.length > 40)

    // 尝试提交（找"完成/提交"类按钮）
    const submitted = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')]
      const b = btns.find((x) => /提交|完成啦|确认完成|完成/.test(x.innerText) && x.offsetParent)
      if (b) { b.click(); return b.innerText.trim() }
      return null
    })
    if (submitted) {
      await new Promise((r) => setTimeout(r, 1600))
      const after = await page.evaluate(() => {
        const m = document.body.innerText.match(/🪙\s*(\d+)/)
        return m ? Number(m[1]) : -1
      })
      check(
        '提交任务后积分有变化或出现结果反馈',
        after !== balanceBefore || /分|完成|奖励/.test(await page.evaluate(() => document.body.innerText)),
        `before=${balanceBefore} after=${after}`,
      )
    } else {
      check('任务提交按钮存在', false, '未找到提交按钮')
    }
  }

  /* ---------- 4b. 长期任务：孩子端不许自评质量 ----------
     用户报的事故：「长期任务 孩子 做完确认时 为啥能自己评价和打分。」
     普通任务早就只让家长打分，长期任务那张表漏了 ——
     孩子能选「一般 / 不错 / 特别棒」，还能看见「+N 分」。
     这里在真浏览器里确认那张表真的干净（jsdom 的版本见
     src/features/tasks/PeriodSubmit.test.tsx）。 */
  await page.keyboard.press('Escape')
  await new Promise((r) => setTimeout(r, 400))
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
    )
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 800))

  const periodOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => /完成一次/.test(x.innerText) && x.offsetParent,
    )
    if (!b) return null
    b.scrollIntoView({ block: 'center' })
    b.click()
    return b.innerText.replace(/\s+/g, ' ').trim()
  })
  check('长期任务卡有「完成一次 ＋」按钮', !!periodOpened, periodOpened ?? '未找到')

  if (periodOpened) {
    await new Promise((r) => setTimeout(r, 700))
    const probe = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent)
      return {
        text: document.body.innerText,
        buttons: btns.map((b) => (b.innerText || '').replace(/\s+/g, ' ').trim()),
      }
    })
    const dirty = probe.buttons.filter((t) => /一般|不错|特别棒/.test(t))
    check('孩子端没有质量自评按钮', dirty.length === 0, dirty.join(' / ') || '干净')
    check('没有「做得怎么样？」这一问', !probe.text.includes('做得怎么样？'))
    check('确认按钮是「完成确认」', probe.buttons.some((t) => t === '完成确认'))

    /* 底部两键的排布。
       ⚠️ 这是真踩过的：原来只有右边那个带 `full`（w-full），
       左边「取消」被挤成竖排的「取 / 消」。两个字时看不出来，
       改成四个字的「完成确认」才露馅 —— 所以必须量，不能靠肉眼。
       量法：Range 的行盒数量。换行的文字会产出多个 rect。 */
    const pair = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('[role="dialog"] button')].filter(
        (b) => b.offsetParent,
      )
      const cancel = btns.find((b) => (b.innerText || '').trim() === '取消')
      const ok = btns.find((b) => (b.innerText || '').trim() === '完成确认')
      if (!cancel || !ok) return null
      const lineBoxes = (el) => {
        const r = document.createRange()
        r.selectNodeContents(el)
        return r.getClientRects().length
      }
      const a = cancel.getBoundingClientRect()
      const b = ok.getBoundingClientRect()
      return {
        sameTop: Math.abs(a.top - b.top) < 2,
        topGap: Math.round(Math.abs(a.top - b.top)),
        cancelLines: lineBoxes(cancel),
        okLines: lineBoxes(ok),
        widths: [Math.round(a.width), Math.round(b.width)],
      }
    })
    check(
      '底部两键并排（同一行）',
      pair?.sameTop === true,
      pair ? `top 差 ${pair.topGap}px，宽 ${pair.widths.join(' / ')}` : '未找到这两个按钮',
    )
    check(
      '底部两键各自只占一行（没被挤成竖排）',
      pair?.cancelLines === 1 && pair?.okLines === 1,
      pair ? `行盒 取消=${pair.cancelLines} 完成确认=${pair.okLines}` : '未找到这两个按钮',
    )
    // 关掉，别把弹层留给后面几节
    await page.keyboard.press('Escape')
    await new Promise((r) => setTimeout(r, 400))
  }

  /* ---------- 5. 农场：种植流程 ---------- */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '农场',
    )
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 1200))
  const farmText = await page.evaluate(() => document.body.innerText)
  check('农场页渲染', /种子|农场|地块|收获|🌱|🌾/.test(farmText), farmText.replace(/\s+/g, ' ').slice(0, 70))

  /* 币种不重复：全局顶栏（sticky）已经常驻显示 🪙 / 🌾，**页面正文里不该再放一遍**。
     ⚠️ 判据要按「**叶子节点、且整段文字就是一个图标**」来数，不能拿 innerText 数 ——
     「40 🪙」（地块解锁价）、「+7 🪙」（结算飘字）、「还能卖 2.8 🌾」（收获弹层）
     里也有图标，那些是**上下文**，不是重复。
     ⚠️ 必须**排除 `header` 和 `nav`**：
       · `header` 就是被比对的基准本身；
       · `nav` 是底部 TabBar，🪙 / 🌾 在那里是**导航图标**（积分 / 农场），
         不是币种展示 —— 探针实测：不排除的话会数出 2 个，误判成「还在重复」。
     可见性用 rect 而不是 offsetParent：顶栏是 sticky，别赌 offsetParent 的语义。 */
  const glyphCount = await page.evaluate(() => {
    const count = (g) =>
      [...document.querySelectorAll('span')].filter((el) => {
        const r = el.getBoundingClientRect()
        return (
          el.children.length === 0 &&
          r.width > 0 &&
          r.height > 0 &&
          (el.textContent ?? '').trim() === g &&
          !el.closest('header') &&
          !el.closest('nav')
        )
      }).length
    return { coin: count('🪙'), grain: count('🌾') }
  })
  check(
    '农场页正文里没有 🪙（不再和全局顶栏重复）',
    glyphCount.coin === 0,
    `正文里 🪙 x${glyphCount.coin}`,
  )
  check(
    '农场页正文里没有 🌾（不再和全局顶栏重复）',
    glyphCount.grain === 0,
    `正文里 🌾 x${glyphCount.grain}`,
  )
  // 反向保证：顶栏那两个确实还在（否则上面两条可以靠「把顶栏也删了」蒙过去）
  const headerCurrencies = await page.evaluate(() =>
    [...document.querySelectorAll('header [aria-label]')]
      .map((el) => el.getAttribute('aria-label') ?? '')
      .filter((l) => l.startsWith('积分') || l.startsWith('丰收币')),
  )
  check(
    '全局顶栏仍然显示积分和丰收币（上面两条不是因为顶栏被删才通过的）',
    headerCurrencies.length === 2,
    headerCurrencies.join(' / ') || '顶栏里一个都没找到',
  )

  // 打开种子商店
  const shopOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => /种子|商店/.test(x.innerText) || /种子|商店/.test(x.getAttribute('aria-label') ?? ''),
    )
    if (b) { b.click(); return true }
    return false
  })
  check('种子商店可打开', shopOpened)

  if (shopOpened) {
    await new Promise((r) => setTimeout(r, 1000))
    const shopText = await page.evaluate(() => document.body.innerText)
    check('种子商店列出作物', /胡萝卜|草莓|玉米|番茄/.test(shopText))

    // 开局死锁回归（2026-09-15）：种子商店曾经拿 `unlockLevel` 跟**收获次数**比，
    // 于是 0 收获时 `1 > 0` 恒真 —— 12 个种子全锁，而没种子就种不了、
    // 种不了就永远没收获。这里直接盯「至少有一个能点」。
    const seedPick = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('button')].filter((x) =>
        /选择.+种子/.test(x.getAttribute('aria-label') ?? ''),
      )
      return { total: rows.length, enabled: rows.filter((x) => !x.disabled).length }
    })
  check(
    '新农场至少有一个种子能买（否则开局即死锁）',
    seedPick.total > 0 && seedPick.enabled > 0,
    `${seedPick.enabled}/${seedPick.total} 个可点`,
  )
  }

  /* ---------- 5b. 市场弹层：结的是丰收币 🌾，不是积分 🪙 ----------
     2026-09-16 修的两个「文案和机制对不上」：

     ① `MarketSheet` 顶部币种胶囊错传了 `balance`（积分），而 `sellProduce`
        结的是 `harvestBalance`（丰收币）。孩子卖完东西，**眼前那个数字一动不动**，
        看起来就是「市场卖出坏了」。而且顶栏本来就已经有一颗 🪙 积分，
        弹层里再来一颗一模一样的，更容易看串。

     ② 弹层底部写过一行「全卖会拿到 X 分，和刚才比少了 N 分 —— 因为一次卖太多，
        价格被压下去了」，而 `N` 恒等于 0：`sellQuote` 是「现价 × 个数」，线性的，
        `unit * count - total` 只剩四舍五入的余数。等于自相矛盾地教了一条假规则。

     这两处都只能靠**渲染出来的字**钉住（领域函数是对的，错的是 UI 接线），
     所以放在第 4 层界面走查，不放单元测试。
     币种/文案那几条不依赖有没有货（空背包时弹层照样开、胶囊照样渲染），
     但**卖出按钮**只在「背包里有货」时才渲染 —— 空背包走的是
     「背包还是空的」空状态，连 `<ul>` 都没有。所以这里先补种补收一次。 */
  await page.evaluate(() => {
    // 先把种子商店关掉（✕ 有 aria-label="关闭"）
    const close = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === '关闭',
    )
    close?.click()
  })
  await new Promise((r) => setTimeout(r, 500))

  // 拧快农场时钟 + 关掉灾害，让胡萝卜两秒内成熟（只影响本段，末尾会还原）
  const seeded = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    if (!empty) return { ok: false, why: '没有已解锁的空地' }
    const planted = await st().plant(empty.index, 'carrot')
    return { ok: planted, index: empty.index }
  })
  if (seeded.ok) {
    await new Promise((r) => setTimeout(r, 2200))
    const stored = await page.evaluate(async (i) => {
      const st = () => window.__kqf__.getState()
      // 收进背包：市场里才会有货、展开行才会出现卖出按钮
      await st().harvest(i, 'store')
      await new Promise((r) => setTimeout(r, 600))
      return st().inventory.find((x) => x.itemId === 'produce-carrot')?.count ?? 0
    }, seeded.index)
    check('背包里补到了能卖的产出（卖出按钮才会渲染）', stored > 0, `胡萝卜 x${stored}`)
  } else {
    check('背包里补到了能卖的产出（卖出按钮才会渲染）', false, seeded.why ?? '种不下去')
  }

  const marketOpened = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /市场/.test(x.innerText))
    if (!b) return false
    b.click()
    return true
  })
  check('市场入口可打开', marketOpened)
  await new Promise((r) => setTimeout(r, 900))

  const marketRes = await page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, ' ')
    const h2 = [...document.querySelectorAll('h2')].find(
      (h) => (h.textContent ?? '').trim() === '农场市场',
    )
    // 弹层头 = h2 的父容器（BottomSheet 里 h2 和 headerRight 是兄弟）
    const head = h2?.parentElement ?? null
    const headGlyphs = head
      ? [...head.querySelectorAll('span')]
          .filter((s) => s.children.length === 0)
          .map((s) => (s.textContent ?? '').trim())
          .filter(Boolean)
      : []
    return {
      sheetOpen: !!h2,
      headGlyphs,
      hasFalseHint: /和刚才比少了/.test(text),
      saysFenPerUnit: /[\d.]+\s*分\s*\/\s*个/.test(text),
      saysFenTotal: /产出大约值\s*[\d.]+\s*分/.test(text),
    }
  })
  check('市场弹层已打开', marketRes.sheetOpen === true)
  check(
    '市场弹层顶部的币种是丰收币 🌾（不是积分 🪙）',
    marketRes.headGlyphs.includes('🌾') && !marketRes.headGlyphs.includes('🪙'),
    `弹层头里的图标：${JSON.stringify(marketRes.headGlyphs)}`,
  )
  check(
    '市场弹层里没有「和刚才比少了 N 分」那行假提示',
    marketRes.hasFalseHint === false,
  )
  check(
    '市场弹层里的单价/总额都写 🌾，不写「分」',
    marketRes.saysFenPerUnit === false && marketRes.saysFenTotal === false,
    `分/个=${marketRes.saysFenPerUnit} 值…分=${marketRes.saysFenTotal}`,
  )

  /* 卖出按钮的标签不许换行。
     ------------------------------------------------------------
     2026-09-16 修 bug 时踩的：给按钮加上币种单位「🌾」之后，三个按钮
     （flex-1 / flex-1 / flex-[1.4]）在 390px 视口下每个只剩 **94px**，
     而「卖 1 个 +2 🌾」要 ~97px → 🌾 被挤到第二行，按钮变成两行高。
     现在改成两行网格（上两个、全卖独占一行，宽 163 / 334），余量充足。

     ⚠️ **判「换没换行」只能用 Range。** 两个看似可行、实测都失效的判据：
       · `Element.getClientRects()` 对块级元素只返回 1 个矩形（元素框本身），
         永远看不出文字换了几行；
       · `scrollHeight > clientHeight` 也不行 —— 按钮有 `min-h-[46px]` 兜着，
         两行文字照样塞得下，scrollHeight 不变。
     `Range.getClientRects()` 是**每行一个矩形**，按 top 去重才是真行数。
     展开任意一行即可 —— 没货时按钮是 disabled，但照样渲染、照样能量。 */
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('li button')].find((b) => /有\s*\d/.test(b.innerText))
    row?.click()
  })
  await new Promise((r) => setTimeout(r, 700))

  /* ---------- 5c. 走势图上的「上限」必须是引擎真用的硬顶 ----------
     ------------------------------------------------------------
     2026-09-18 修：`MarketSheet` 给 `PriceChart` 传的还是**旧口径**
     `q.base * 1.6`（基准价的 1.6 倍），而引擎早就不在那儿封顶了。
     三个后果，一个比一个明显：

       ① 那条「上限」虚线画在真上限**上方 60%**，价格永远够不到 —— 是条假上限；
       ② `PriceChart` 用 `Math.max(...series, ceiling)` 定 y 轴标尺，
          多出来的那截空白把 7 天走势**压进图的下半部分**，看着像一条平线；
       ③ 标签印「上限 2.6」，而小胡萝卜的真上限是 1.6。

     `priceCeilingFor` 一直是对的，错的是 **UI 接线** —— 所以只能靠
     **渲染出来的字**钉住，和 5b 那两条同一个道理（第 4 层界面走查）。

     期望值**不写死**：向 `window.__kqf__.catalog.priceCeiling()` 要真实数值。
     写死的话，下次调经济数值这条就会变成「假失败」。 */
  const chartRes = await page.evaluate(() => {
    const ITEM = 'produce-carrot' // 本段只收过胡萝卜，展开的就是它
    const row = [...document.querySelectorAll('li')].find((li) =>
      /最近\s*7\s*天价格/.test(li.innerText),
    )
    return {
      rowFound: !!row,
      rowName: (row?.querySelector('p')?.textContent ?? '').trim(),
      capText: row?.innerText.match(/上限\s*([\d.]+)/)?.[1] ?? null,
      expected: window.__kqf__.catalog.priceCeiling(ITEM),
      base:
        window.__kqf__.getState().market.quotes.find((q) => q.itemId === ITEM)?.base ?? null,
    }
  })
  check('展开的行渲染出了走势图', chartRes.rowFound === true, `行名：${chartRes.rowName}`)
  {
    // 图上是按显示精度印的（< 10 保留一位小数，见 `price1`），所以按同精度比
    const dec = chartRes.expected < 10 ? 1 : 0
    const shown = Number(chartRes.capText)
    check(
      '走势图的「上限」== 引擎的硬顶（不是写死的基准价 × 1.6）',
      Number.isFinite(shown) &&
        Number(shown.toFixed(dec)) === Number(chartRes.expected.toFixed(dec)),
      `图上 ${chartRes.capText} / 引擎 ${chartRes.expected}（基准价 ${chartRes.base}）`,
    )
  }

  const sellBtns = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('li button')].filter((b) => /卖|全卖/.test(b.innerText))
    return btns.map((b) => {
      const range = document.createRange()
      range.selectNodeContents(b)
      const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size
      return {
        text: b.innerText.replace(/\s+/g, ' '),
        w: Math.round(b.getBoundingClientRect().width),
        lines,
      }
    })
  })
  check(
    '市场卖出按钮渲染出来了（展开行才有）',
    sellBtns.length === 3,
    sellBtns.map((b) => b.text).join(' | ') || '(一个都没有)',
  )
  check(
    '卖出按钮的文案都在一行里（币种 🌾 没被挤下去）',
    sellBtns.length > 0 && sellBtns.every((b) => b.lines === 1),
    sellBtns.map((b) => `${b.text} → ${b.lines} 行 / ${b.w}px`).join('；'),
  )
  check(
    '卖出按钮够宽，三、四位数也放得下',
    sellBtns.length > 0 && sellBtns.every((b) => b.w >= 150),
    sellBtns.map((b) => `${b.w}px`).join(' / '),
  )

  // 关掉，别污染后面的流程
  await page.evaluate(() => {
    const close = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === '关闭',
    )
    close?.click()
  })
  await new Promise((r) => setTimeout(r, 500))

  // 还原本段拧过的设置（时钟 / 灾害），后面的段落不该继承
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: true })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1 } })
  })

  /* ---------- 6. 家长确认：必须要求密码，且输对后能进入打分 ---------- */
  // 先设密码 + 造一个待审实例，否则队列是空的，测不出解锁效果
  await page.evaluate(async () => {
    const s = window.__kqf__.getState()
    await s.updateSettings({ parentPin: '1234', protectParentActions: true })
    const t = await s.addTask({
      title: '__e2e_review',
      category: 'study',
      cycle: 'once',
      plannedMinutes: 10,
      basePoints: 20,
      qualityBonusPoints: 0,
      allowOvertime: true,
      allowLateNoPenalty: false,
      qualityRated: false,
    })
    const inst = window.__kqf__
      .getState()
      .instances.find((i) => i.taskId === t.id && i.status === 'pending')
    if (inst) await window.__kqf__.getState().submitInstance(inst.id, 8, undefined)
  })
  await new Promise((r) => setTimeout(r, 900))

  const openedReview = await page.evaluate(() => {
    const b = document.querySelector('button[aria-label^="家长确认"]')
    if (b) { b.click(); return true }
    return false
  })
  check('顶栏有「家长确认」入口', openedReview)

  await new Promise((r) => setTimeout(r, 800))
  // 只看对话框内部 —— 页面背景里本来就有"确认奖励"这类字，
  // 用 document.body 会把背景文字也匹配进来，那是假阳性。
  const gate = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    return {
      text: d ? d.innerText : '',
      hasPinPad: !!d && [...d.querySelectorAll('button')].some((b) => b.innerText.trim() === '确定'),
      hasGradeBtn: !!d && [...d.querySelectorAll('button')].some((b) => /✅ 确认奖励/.test(b.innerText)),
    }
  })
  check(
    '家长确认打开后要求输入密码',
    /请爸爸妈妈来一下/.test(gate.text) && gate.hasPinPad,
    gate.text.replace(/\s+/g, ' ').slice(0, 60),
  )
  check('未通过密码时不渲染「确认奖励」按钮', gate.hasGradeBtn === false)

  // 逐个点 1 2 3 4 —— 必须验证"输对了真的能进去"。
  // 这正是之前的 bug：第 4 位自动提交读的是旧 state，输对了毫无反应。
  for (const k of ['1', '2', '3', '4']) {
    await page.evaluate((key) => {
      const d = document.querySelector('[role="dialog"]')
      const b = [...d.querySelectorAll('button')].find((x) => x.innerText.trim() === key)
      b?.click()
    }, k)
    await new Promise((r) => setTimeout(r, 200))
  }
  await new Promise((r) => setTimeout(r, 1200))

  const unlocked = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]')
    const t = d ? d.innerText : ''
    return {
      text: t.replace(/\s+/g, ' ').slice(0, 90),
      hasGradeBtn: !!d && [...d.querySelectorAll('button')].some((b) => /✅ 确认奖励/.test(b.innerText)),
      stillLocked: /请爸爸妈妈来一下/.test(t),
    }
  })
  check(
    '输对密码后进入打分界面（不再是锁屏）',
    unlocked.hasGradeBtn && !unlocked.stillLocked,
    unlocked.text,
  )

  // 点确认奖励 → 积分应到账
  const afterConfirm = await page.evaluate(async () => {
    const before = window.__kqf__.getState().balance
    const d = document.querySelector('[role="dialog"]')
    const b = [...d.querySelectorAll('button')].find((x) => /✅ 确认奖励/.test(x.innerText))
    b?.click()
    await new Promise((r) => setTimeout(r, 1200))
    return { before, after: window.__kqf__.getState().balance }
  })
  check(
    '家长确认后积分到账',
    afterConfirm.after > afterConfirm.before,
    `${afterConfirm.before} → ${afterConfirm.after}`,
  )

  // 关掉弹层
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '关闭')
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 600))

  /* ---------- 7. 数据导出 ---------- */
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('⚙️'))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 900))
  const settingsText = await page.evaluate(() => document.body.innerText)
  check('设置页可打开', /设置|孩子|规则|数据/.test(settingsText))

  const exported = await page.evaluate(async () => {
    // 通过窗口上的调试句柄触发导出逻辑，校验备份结构（不依赖真实下载行为）
    const w = window
    if (!w.__kqf__) return null
    return await w.__kqf__.exportBackup()
  })
  if (exported) {
    check('导出数据结构正确', exported.app === 'kid-quest-farm' && !!exported.data, JSON.stringify(Object.keys(exported.data ?? {})).slice(0, 120))
    check('导出含任务定义', Array.isArray(exported.data.tasks) && exported.data.tasks.length > 0, `${exported.data.tasks?.length} 个任务`)
  } else {
    check('导出数据', false, '未拿到导出结果')
  }

  /* ---------- 7b. 设置页的「音效 / 震动」开关 ---------- */
  // `soundEnabled` / `hapticsEnabled` 一直在 settings 里、默认都开着，
  // 但设置页**没有对应的开关** —— 也就是说家长根本关不掉。
  // 这条守的是「开关存在、能点、而且真的落库」。
  //
  // 前置：先把家长密码清掉，让「规则」页签里的开关可用。
  // 不去模拟 1-2-3-4 的键盘 —— 数字按钮在别的页签也会出现，选择器不稳。
  const soundToggle = await page.evaluate(async () => {
    await window.__kqf__.getState().updateSettings({ parentPin: '' })
    await new Promise((r) => setTimeout(r, 600))
    const tabBtn = [...document.querySelectorAll('button')].find((x) => /规则/.test(x.innerText))
    tabBtn?.click()
    await new Promise((r) => setTimeout(r, 600))
    const el = document.querySelector('button[role="switch"][aria-label="音效"]')
    const hz = document.querySelector('button[role="switch"][aria-label="震动"]')
    const s = window.__kqf__.getState().settings
    return {
      hasSound: !!el,
      hasHaptics: !!hz,
      soundChecked: el?.getAttribute('aria-checked') ?? null,
      hapticsChecked: hz?.getAttribute('aria-checked') ?? null,
      storeSound: s.soundEnabled,
      storeHaptics: s.hapticsEnabled,
    }
  })
  check('设置页有「音效」开关', soundToggle.hasSound)
  check('设置页有「震动」开关', soundToggle.hasHaptics)
  check(
    '两个开关的初始状态和 settings 一致',
    soundToggle.soundChecked === String(soundToggle.storeSound) &&
      soundToggle.hapticsChecked === String(soundToggle.storeHaptics),
    `音效 aria=${soundToggle.soundChecked}/store=${soundToggle.storeSound}；` +
      `震动 aria=${soundToggle.hapticsChecked}/store=${soundToggle.storeHaptics}`,
  )

  // 真的点一下 —— 只看"界面动了"不够，要确认**落库了**
  const flipped = await page.evaluate(async () => {
    const el = document.querySelector('button[role="switch"][aria-label="音效"]')
    if (!el) return { skipped: true }
    if (el.hasAttribute('disabled')) return { disabled: true }
    const before = window.__kqf__.getState().settings.soundEnabled
    el.click()
    await new Promise((r) => setTimeout(r, 700))
    return {
      before,
      after: window.__kqf__.getState().settings.soundEnabled,
      ariaAfter: document
        .querySelector('button[role="switch"][aria-label="音效"]')
        ?.getAttribute('aria-checked'),
    }
  })
  check(
    '点「音效」能真的关掉（落库 + 界面同步）',
    !flipped.skipped &&
      !flipped.disabled &&
      flipped.before === true &&
      flipped.after === false &&
      flipped.ariaAfter === 'false',
    flipped.skipped
      ? '没找到开关'
      : flipped.disabled
        ? '开关是禁用的（家长锁没开）'
        : `${flipped.before} → ${flipped.after}（aria=${flipped.ariaAfter}）`,
  )

  // 还原：音效拨回去、家长密码复原（默认是 '0000'），别影响后面的断言与截图
  await page.evaluate(async () => {
    const el = document.querySelector('button[role="switch"][aria-label="音效"]')
    if (el && !el.hasAttribute('disabled') && el.getAttribute('aria-checked') === 'false') el.click()
    await new Promise((r) => setTimeout(r, 400))
    await window.__kqf__.getState().updateSettings({ parentPin: '0000' })
    await new Promise((r) => setTimeout(r, 400))
  })

  /* ---------- 8. 同一个数只显示一次（兑换页 / 积分页） ---------- */
  // 用户报的：「兑换页有重复的积分显示，还有『你有 xx 积分』这句不需要；
  // 我的积分页也是一样。」
  // 规矩：余额只在全局顶栏（App.tsx 的 sticky header）说一次，
  // 页面正文不许再报一遍同一个数。
  //
  // ⚠️ 判据**不能**写成「页面里没有 🪙 这个字形」——
  //    兑换页每件商品的价签（farmUi.tsx 的 CoinPill）就带 🪙，
  //    那是**单价**，不是余额。按字形数会把价签全算成"重复显示"。
  //    真正的余额牌有个特征：🪙 图标**不带 aria-hidden**，且同一个容器里
  //    还有一个「整段文字就是余额数字」的叶子节点。价签的 🪙 恰好是
  //    aria-hidden 的，于是天然被排除 —— 判据锚在图标上，不锚在数字上。
  //
  // ⚠️ 判据**也不能**写成「整页只有一个元素的文字 == 余额」——
  //    e2e 跑的是全新档案，所有收入都发生在"今天"，于是积分页 7 日柱状图里
  //    "今天"那根柱子的数字**必然等于余额**（两者本来就是同一个和）。
  //    拿数字裸比一定误报，且误报得像"真发现了 bug"。
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /←|返回/.test(x.innerText))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 700))

  const probeBalanceChips = async (tabLabel) => {
    await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.innerText.trim().split('\n').pop().trim() === l,
      )
      b?.click()
    }, tabLabel)
    await new Promise((r) => setTimeout(r, 1000))
    return page.evaluate(() => {
      const bal = String(window.__kqf__.getState().balance)
      /**
       * 找「余额牌」：一个容器，里面同时有
       *   (a) 一个**不带 aria-hidden** 的 🪙 图标叶子节点，和
       *   (b) 一个整段文字就是余额数字的叶子节点。
       *
       * ⚠️ 向上找祖先时必须**卡在 root 里**（`root.contains(a)`）。
       *    否则会爬出页面内容区、一路爬到 App 外壳 ——
       *    外壳里同时装着顶栏和正文，于是底栏那个 🪙 导航图标
       *    会"找到"顶栏里的余额数字，把顶栏本身报成正文里的重复。
       *    （这条判据第一次就是这么做错的：报出来的"命中"文本是整个页面。）
       */
      const findChips = (root) => {
        const out = []
        for (const ic of root.querySelectorAll('*')) {
          const r = ic.getBoundingClientRect()
          if (ic.children.length !== 0 || r.width <= 0 || r.height <= 0) continue
          if ((ic.textContent ?? '').trim() !== '🪙') continue
          if (ic.hasAttribute('aria-hidden')) continue // 价签的图标，跳过
          for (let a = ic.parentElement, i = 0; a && i < 5 && root.contains(a); a = a.parentElement, i++) {
            const hasBalance = [...a.querySelectorAll('*')].some(
              (e) =>
                e.children.length === 0 &&
                (e.textContent ?? '').trim() === bal &&
                e.getBoundingClientRect().width > 0,
            )
            if (hasBalance) {
              out.push(a)
              break
            }
          }
        }
        return out
      }
      // 正文 = <main>（App.tsx 里顶栏 <header> 与 <main> 是兄弟节点，
      // 所以"在 main 里"就等于"不在顶栏里"，比 closest 过滤更不易漏）。
      const main = document.querySelector('main')
      const header = document.querySelector('header')
      const inBody = main ? findChips(main) : []
      return {
        bodyChips: inBody.length,
        sample: inBody.slice(0, 3).map((el) =>
          (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40),
        ),
        headerChips: header ? findChips(header).length : 0,
        headerText: (header?.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 60),
        text: document.body.innerText,
      }
    })
  }

  for (const [tab, pageName] of [['兑换', '兑换页'], ['积分', '积分页']]) {
    const p = await probeBalanceChips(tab)
    check(
      `${pageName}正文里没有余额牌（余额只在全局顶栏）`,
      p.bodyChips === 0,
      p.bodyChips === 0 ? '' : `命中 ${p.bodyChips} 处：${p.sample.join(' ｜ ')}`,
    )
    check(
      `${pageName}不再写「你有 N 分」/「现在一共有 N」`,
      !/你有/.test(p.text) && !/现在一共有/.test(p.text),
      `你有=${/你有/.test(p.text)} 现在一共有=${/现在一共有/.test(p.text)}`,
    )
  }

  // 反向保证：顶栏必须**还在**显示余额。
  // 否则"页面正文里没有余额牌"就成了"整屏都没有"，那是把功能删了而不是去重。
  const headerChip = await probeBalanceChips('任务')
  check(
    '全局顶栏仍然显示积分和丰收币',
    headerChip.headerChips >= 1 && /🪙/.test(headerChip.headerText) && /🌾/.test(headerChip.headerText),
    headerChip.headerText,
  )

  /* ---------- 9. 截图留档 ---------- */
  mkdirSync('screenshots', { recursive: true })
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /←|返回/.test(x.innerText))
    b?.click()
  })
  await new Promise((r) => setTimeout(r, 700))
  for (const [name, label] of [['tasks', '任务'], ['farm', '农场'], ['redeem', '兑换'], ['points', '积分']]) {
    await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.innerText.trim().split('\n').pop().trim() === l,
      )
      b?.click()
    }, label)
    await new Promise((r) => setTimeout(r, 1100))
    await page.screenshot({ path: `screenshots/${name}.png` })
  }
  check('截图已保存', true, 'screenshots/{tasks,farm,redeem,points}.png')

  /* ---------- 结果汇总 ---------- */
  console.log('\n' + '─'.repeat(58))
  const failed = results.filter((r) => !r.ok)
  console.log(`通过 ${results.length - failed.length}/${results.length}`)

  if (warnings.length) {
    const uniq = [...new Set(warnings)].slice(0, 5)
    console.log(`\n警告 (${warnings.length}):`)
    uniq.forEach((w) => console.log(`  ! ${w.slice(0, 160)}`))
  }
  if (errors.length) {
    console.log(`\n错误 (${errors.length}):`)
    const uniq = [...new Set(errors)].slice(0, 10)
    uniq.forEach((e) => console.log(`  ✗ ${e.slice(0, 200)}`))
  } else {
    console.log('\n控制台无错误 ✓')
  }

  writeFileSync(
    'screenshots/report.json',
    JSON.stringify({ url: URL, results, errors, warnings }, null, 2),
  )

  process.exitCode = failed.length === 0 && errors.length === 0 ? 0 : 1
} catch (e) {
  console.error('\nE2E 执行失败:', e.message)
  process.exitCode = 3
} finally {
  await browser.close()
}
