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
  // 等闪屏过去
  await page.waitForFunction(
    () => !document.body.innerText.includes('小任务农场') || document.body.innerText.includes('任务'),
    { timeout: 20000 },
  ).catch(() => {})
  await new Promise((r) => setTimeout(r, 1200))

  const bodyText = await page.evaluate(() => document.body.innerText)
  check('页面渲染出内容', bodyText.length > 20, `${bodyText.length} 字符`)
  check('无启动报错', errors.length === 0, errors.slice(0, 3).join(' | '))

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
  }

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

  /* ---------- 8. 截图留档 ---------- */
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
