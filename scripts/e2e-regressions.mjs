/**
 * 回归守卫：钉住「已经修过的具体 bug」，防止改回去
 * ------------------------------------------------------------
 * 和 `e2e-check` / `e2e-gameplay` 的分工：
 *   那两套验的是「功能对不对」（覆盖广、按页面组织）；
 *   这一套验的是「**这几个坑别再踩**」（覆盖窄、按 bug 组织，每条都带日期和病因）。
 *   一个 bug 修完就往这里加一条 —— 它们是回归，不是新功能。
 *
 * 当前守着 4 条（2026-09-18 家长报的）：
 *   1. 设置页改「孩子的小名」后点头像，名字被吃回去
 *      → `updateSettings` 的 `set` 落在了 `await` 之后
 *   2. 「设置 → 任务掉落」开关能控制任务编辑页里的「完成后掉落」
 *      → 新功能，顺带钉住默认值和落库
 *   3. 市场里有货的行要有标记（绿点 + 绿色数量胶囊 + 描边）
 *   4. 市场「全卖」按钮报的个数/金额必须真能拿到
 *      → 原来是按「不限额度」报价，承诺「全卖 4 个 +4」实际只卖 3 个
 *
 * 跑法：node scripts/e2e-regressions.mjs [url]   （默认 http://127.0.0.1:4180/）
 * 前置：先 `npm run preview`
 *
 * ⚠️ 第 1 条**必须在 CPU 降速下测**（脚本里设了 20×）。
 * 满速的桌面浏览器复现不出来 —— 写入窗口只有几毫秒，真人手速赶不上；
 * 但真机（尤其 APK）上必现。降速是为了把那个窗口放大到可观测。
 *
 * 负向验证（2026-09-18 做过）：把 `updateSettings` 改回旧顺序、
 * 把「全卖」标签改回 `quoteFor(itemId, count)`，本脚本会红 5 条
 * （打字被吃 ×2、丢更新 ×1、承诺 ≠ 实卖 ×1、汇总 ×1），其余照旧绿。
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { dismissOnboarding } from './lib/onboarding.mjs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const errors = []
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 })
  await page.waitForFunction(() => !!document.querySelector('nav button'), { timeout: 20000 })
  await sleep(1200)
  await dismissOnboarding(page)
  await sleep(800)

  /**
   * 遇到家长密码锁（PinPad）就输默认密码 0000。
   * ⚠️ 设置页的「规则 / 数据」两个 tab 和任务编辑页都是**锁着的** ——
   * 不先输密码，那些 switch 压根不在 DOM 里（第一版探针就栽在这：
   * 报「没找到开关」，其实是没进门，属于假失败）。
   */
  const enterPinIfLocked = async () => {
    const locked = await page.evaluate(() =>
      [...document.querySelectorAll('button')].some((x) => x.textContent?.trim() === '清空'),
    )
    if (!locked) return false
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '0')
        b?.click()
      })
      await sleep(220)
    }
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '确定')
      b?.click()
    })
    await sleep(900)
    return true
  }

  const openSettings = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('header button')].find(
        (x) => (x.getAttribute('aria-label') ?? '').includes('设置') || x.innerText.includes('⚙'),
      )
      b?.click()
    })
    await sleep(900)
  }
  const closeSettings = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '返回',
      )
      b?.click()
    })
    await sleep(700)
  }
  const gotoTab = async (label) => {
    await page.evaluate((l) => {
      const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim().endsWith(l))
      b?.click()
    }, label)
    await sleep(600)
    await enterPinIfLocked()
  }

  /* ============ 3. 市场行标记（先做，因为它不需要降速） ============ */
  console.log('\n【3】市场行的「有货」标记')
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await st().updateSettings({ farmEventsEnabled: false })
    await st().updateSettings({ farmClock: { ...st().settings.farmClock, timeScale: 1200 } })
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    await st().plant(empty.index, 'carrot')
  })
  // 等成熟 → 收进背包
  const idx = await page.evaluate(() => window.__kqf__.getState().plots.find((p) => p.crop)?.index ?? 0)
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate((k) => {
      const g = document.querySelector('div.grid.grid-cols-3')
      const tiles = g ? [...g.querySelectorAll(':scope > button')] : []
      return tiles[k]?.innerText ?? ''
    }, idx)
    if (/可以收啦/.test(t)) break
    await sleep(250)
  }
  await page.evaluate(async (i) => {
    await window.__kqf__.getState().harvest(i, 'store')
  }, idx)
  await sleep(1200)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('nav button')].find(
      (x) => x.innerText.trim().split('\n').pop().trim() === '农场',
    )
    b?.click()
  })
  await sleep(900)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /市场/.test(x.innerText))
    b?.click()
  })
  await sleep(900)

  const rowInfo = await page.evaluate(() => {
    const lis = [...document.querySelectorAll('li')].filter((li) => li.querySelector('button'))
    return lis.slice(0, 3).map((li) => {
      const btn = li.querySelector('button')
      const pill = [...btn.querySelectorAll('span')].find((s) => /^有 \d+ 个$/.test(s.textContent.trim()))
      const none = [...btn.querySelectorAll('span')].find((s) => s.textContent.trim() === '没有')
      const dot = [...btn.querySelectorAll('span')].find((s) =>
        s.className.includes('rounded-full') && s.className.includes('size-2'),
      )
      return {
        text: btn.innerText.replace(/\s+/g, ' ').trim().slice(0, 40),
        pillClass: pill?.className ?? null,
        pillText: pill?.textContent.trim() ?? null,
        noneClass: none?.className ?? null,
        hasDot: !!dot,
        liRing: li.className.includes('ring-2'),
      }
    })
  })
  const stocked = rowInfo.find((r) => r.pillText)
  const emptyRow = rowInfo.find((r) => r.noneClass)
  check(
    '有货的行：数量是绿色胶囊',
    !!stocked && /bg-grass-200/.test(stocked.pillClass) && /text-grass-700/.test(stocked.pillClass),
    stocked ? `${stocked.pillText} → ${stocked.pillClass}` : '(没有找到有货的行)',
  )
  check('有货的行：有绿点标记', !!stocked && stocked.hasDot, stocked ? `dot=${stocked.hasDot}` : '')
  check('有货的行：整行加了描边', !!stocked && stocked.liRing, stocked ? `ring=${stocked.liRing}` : '')
  check(
    '没货的行：显示「没有」且是浅灰（不抢眼）',
    !!emptyRow && /text-ink-400/.test(emptyRow.noneClass),
    emptyRow ? emptyRow.noneClass : '(没有找到没货的行)',
  )

  /* ============ 4. 「全卖」按钮不再撒谎 ============ */
  console.log('\n【4】市场「全卖」按钮的诚实性（小萝卜）')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '关闭')
    b?.click()
  })
  await sleep(600)
  // 补一块小萝卜
  await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    const empty = st().plots.find((p) => p.unlocked && !p.crop)
    await st().plant(empty.index, 'radish')
  })
  const ridx = await page.evaluate(() => {
    const s = window.__kqf__.getState()
    return s.plots.find((p) => p.crop?.cropId === 'radish')?.index ?? -1
  })
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate((k) => {
      const g = document.querySelector('div.grid.grid-cols-3')
      const tiles = g ? [...g.querySelectorAll(':scope > button')] : []
      return tiles[k]?.innerText ?? ''
    }, ridx)
    if (/可以收啦/.test(t)) break
    await sleep(250)
  }
  await page.evaluate(async (i) => {
    await window.__kqf__.getState().harvest(i, 'store')
  }, ridx)
  await sleep(1200)

  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /市场/.test(x.innerText))
    b?.click()
  })
  await sleep(900)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('li button')].find((b) => /小萝卜/.test(b.innerText))
    row?.click()
  })
  await sleep(800)

  const sellUI = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('li button')].filter((b) => /卖|全卖/.test(b.innerText))
    const held = window.__kqf__.getState().inventory.find((i) => i.itemId === 'produce-radish')?.count ?? 0
    return {
      held,
      labels: btns.map((b) => b.innerText.replace(/\s+/g, ' ').trim()),
      disabled: btns.map((b) => b.disabled),
      quotaLine: (document.body.innerText.match(/这一轮还能卖[^\n]{0,60}/) ?? [''])[0].replace(/\s+/g, ' '),
    }
  })
  const allLabel = sellUI.labels.find((l) => l.startsWith('全卖')) ?? ''
  const m = allLabel.match(/全卖\s*(\d+)\s*个\s*\+(\d+)/)
  const promised = m ? Number(m[1]) : NaN
  check(
    '「全卖」按钮报的个数 <= 背包里的个数（不再超卖）',
    promised <= sellUI.held,
    `按钮「${allLabel}」，背包 ${sellUI.held} 个`,
  )
  /*
    ⚠️ 2026-09-18 改口径，这条断言跟着换了。
    原来钉的是「卖不光时给出了额度解释」—— 那时硬顶是 `基准价 × 1.6`，
    单轮满产在贵的时候会剩货，所以要检查 UI 有没有解释清楚。
    现在硬顶 = `上限回收 ÷ 满产`（家长：「波动不能够超过成本 × 1.6」），
    `满产 × 硬顶 = 上限回收` 恰好相等 → **单轮满产一定卖得光**，
    「卖不光」在单轮场景下已经不可能发生（那正是修好的 bug），
    再断言解释文字就会变成一条永远假的失败。
    所以改成钉新规则本身：按钮承诺的个数必须**等于**背包里的个数，一个都不剩。
  */
  check(
    '单轮满产：行情到顶也一个不剩（承诺的个数 = 背包里的个数）',
    promised === sellUI.held,
    `按钮承诺 ${promised} 个，背包 ${sellUI.held} 个`,
  )

  // 真点一下，看是不是真的只卖按钮上写的那么多
  const box = await page.evaluate(() => {
    const b = [...document.querySelectorAll('li button')].find((x) => /全卖/.test(x.innerText))
    if (!b) return null
    const r = b.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })
  if (box) await page.mouse.click(box.x, box.y)
  await sleep(1500)
  const after = await page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      held: s.inventory.find((i) => i.itemId === 'produce-radish')?.count ?? 0,
      balance: s.harvestBalance,
    }
  })
  const sold = sellUI.held - after.held
  check(
    '实卖个数 == 按钮承诺的个数',
    sold === promised,
    `承诺 ${promised} 个，实卖 ${sold} 个，到手 ${after.balance} 丰收币`,
  )

  /* ============ 2. 任务掉落开关 ============ */
  console.log('\n【2】「设置 → 任务掉落」开关')
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === '关闭')
    b?.click()
  })
  await sleep(600)
  await openSettings()
  await gotoTab('规则')

  const toggleInfo = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="任务掉落"]')
    return {
      found: !!btn,
      ariaChecked: btn?.getAttribute('aria-checked') ?? null,
      text: (btn?.closest('section')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 70),
    }
  })
  check('设置里出现了「任务掉落」开关', toggleInfo.found, toggleInfo.text || '')
  check('开关默认是「开」', toggleInfo.ariaChecked === 'true', `aria-checked=${toggleInfo.ariaChecked}`)

  // 打开任务编辑页，确认默认（开着）能看到掉落选项
  await closeSettings()
  const openEditor = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('nav button')].find(
        (x) => x.innerText.trim().split('\n').pop().trim() === '任务',
      )
      b?.click()
    })
    await sleep(700)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '新建任务',
      )
      b?.click()
    })
    await sleep(700)
    // 「加任务」对孩子是先弹一句「这里要爸爸妈妈来弄」，要走「我是家长」才进编辑页
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /我是家长/.test(x.innerText))
      b?.click()
    })
    await sleep(900)
  }
  const closeEditor = async () => {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => x.getAttribute('aria-label') === '关闭',
      )
      b?.click()
    })
    await sleep(600)
  }
  const editorHasDrops = () => page.evaluate(() => /完成后掉落/.test(document.body.innerText))

  /** 编辑页有家长密码锁（默认 0000），要先进去；返回是否真的进到了表单 */
  const unlockEditor = async () => {
    await enterPinIfLocked()
    return page.evaluate(() => /任务叫什么/.test(document.body.innerText))
  }

  await openEditor()
  const editorOpen = await unlockEditor()
  check('任务编辑页打开了（不是卡在密码锁上）', editorOpen === true, `editorOpen=${editorOpen}`)
  const hasDropsOn = await editorHasDrops()
  check('开关为「开」时，任务编辑页有「完成后掉落」', hasDropsOn === true, `hasDrops=${hasDropsOn}`)
  await closeEditor()

  // 关掉开关
  await openSettings()
  await gotoTab('规则')
  await page.evaluate(() => {
    document.querySelector('button[aria-label="任务掉落"]')?.click()
  })
  await sleep(900)
  const offNow = await page.evaluate(() => window.__kqf__.getState().settings.taskDropsEnabled)
  check('点开关后设置真的落库了', offNow === false, `taskDropsEnabled=${offNow}`)
  await closeSettings()

  await openEditor()
  const editorOpen2 = await unlockEditor()
  check('任务编辑页打开了（对照组）', editorOpen2 === true, `editorOpen=${editorOpen2}`)
  const hasDropsOff = await editorHasDrops()
  check('开关为「关」时，任务编辑页**不再显示**「完成后掉落」', hasDropsOff === false, `hasDrops=${hasDropsOff}`)
  await closeEditor()

  // 还原
  await page.evaluate(async () => {
    await window.__kqf__.getState().updateSettings({ taskDropsEnabled: true })
  })
  await sleep(400)

  /* ============ 1. 名字不再被吃回去 ============ */
  console.log('\n【1】设置页改名字后点头像（20× CPU 降速，模拟真机）')
  const client = await page.createCDPSession()
  await client.send('Emulation.setCPUThrottlingRate', { rate: 20 })

  await openSettings()
  await gotoTab('孩子')
  const sel = 'input[placeholder="宝贝"]'
  let lost = 0
  const names = ['小明', '小红']
  for (const want of names) {
    await page.evaluate(async (n) => {
      await window.__kqf__.getState().updateSettings({ childName: n })
    }, '基线')
    await sleep(700)
    await page.click(sel)
    await page.keyboard.down('Control')
    await page.keyboard.press('KeyA')
    await page.keyboard.up('Control')
    await page.type(sel, want, { delay: 45 })
    const typed = await page.$eval(sel, (e) => e.value)
    /*
      ⚠️ 打字这一步本身也是被测对象，**不能 skip**。
      旧代码下受控输入框会被旧值覆盖，输入「小明」实际只剩「明」——
      如果把这种情况当成「环境问题跳过」，这条断言就永远绿，
      正是本项目最忌讳的假通过。所以这里直接判红。
    */
    check(
      `「${want}」能完整打进去（受控输入框没把字吃掉）`,
      typed === want,
      `input="${typed}"，期望 "${want}"`,
    )
    if (typed !== want) {
      lost++
      continue
    }
    // 马上点头像（真实鼠标）
    const ab = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => (x.textContent ?? '').trim() === '🐰' && x.className.includes('h-14'),
      )
      if (!b) return null
      const r = b.getBoundingClientRect()
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
    })
    if (ab) await page.mouse.click(ab.x, ab.y)
    await sleep(1300)
    const store = await page.evaluate(() => window.__kqf__.getState().settings.childName)
    const input = await page.$eval(sel, (e) => e.value)
    if (store !== want) lost++
    check(`「${want}」+ 点头像后名字保住了`, store === want, `input="${input}" store="${store}"`)
  }
  check('降速下打字不再丢字（2 轮全对）', lost === 0, `丢了 ${lost} 轮`)

  // 同 tick 连续两次更新
  const race = await page.evaluate(async () => {
    const st = () => window.__kqf__.getState()
    await Promise.all([
      st().updateSettings({ childName: '同Tick' }),
      st().updateSettings({ avatar: '🦄' }),
    ])
    return { childName: st().settings.childName, avatar: st().settings.avatar }
  })
  check(
    '同一 tick 连调两次 updateSettings，两次改动都生效',
    race.childName === '同Tick' && race.avatar === '🦄',
    JSON.stringify(race),
  )

  console.log('\n' + '─'.repeat(58))
  const failed = results.filter((r) => !r.ok)
  console.log(`通过 ${results.length - failed.length}/${results.length}`)
  if (failed.length) {
    console.log('\n失败项：')
    for (const f of failed) console.log(`  ✗ ${f.name}${f.detail ? ` — ${f.detail}` : ''}`)
  }
  console.log(errors.length ? `\n控制台错误 ${errors.length} 条：\n${errors.join('\n')}` : '\n控制台无错误 ✓')
  process.exitCode = failed.length ? 1 : 0
} catch (e) {
  console.error('\n探针崩了：', e)
  process.exitCode = 1
} finally {
  await browser.close()
}
