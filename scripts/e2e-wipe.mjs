/**
 * 「设置 → 💾 数据 → 清空全部数据」端到端验收
 * ------------------------------------------------------------
 * 为什么值得单独一个脚本：**这是全项目唯一一条不可逆的破坏性路径，却一直
 * 没有任何守卫**（2026-09-21 查过：`wipeAll` 只在 `useApp.ts` 里被调用，
 * 五套 e2e 一个都没碰）。
 *
 * 它坏起来的样子特别难发现：清空**没清干净**（漏了某张表）在界面上看不出来，
 * 要等用户下次开机发现「去年那批任务还在」才知道。所以这里**直接读 IndexedDB
 * 每张表的条数**，不信 store 的快照 —— 快照是内存里的，清表漏了它照样是空的。
 *
 * 另一件要守住的事：清空后必须**重新播种 + 重新弹新手引导**，否则孩子打开
 * 就是一片空白，看起来像"App 坏了"。
 *
 * 用法：node scripts/e2e-wipe.mjs [url]     （默认 http://127.0.0.1:4180/）
 * 前置：先 `npm run preview`（或任何在跑的静态服务）
 *
 * ⚠️ 这个脚本会**真的清库**，所以用独立的 profile 目录（`makeProfileDir`），
 * 不碰你平时那个浏览器配置。
 */
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { dismissOnboarding } from './lib/onboarding.mjs'
import { makeProfileDir } from './lib/profile.mjs'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
if (!CHROME) {
  console.error('找不到 Chrome/Edge，无法执行 E2E')
  process.exit(2)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const errors = []
const results = []

function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  userDataDir: makeProfileDir('e2e-wipe'),
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true })
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle2', timeout: 45000 })
  await page.waitForFunction(() => !!window.__kqf__, { timeout: 20000 })
  await sleep(1500)

  /* ---------- 0. 先记下「全新装机」的基线 ----------
     ⚠️ 必须在 `dismissOnboarding` **之前**读 `onboardingDone` ——
     那个 helper 会把向导 / 导览走完，顺手把它写成 `true`。
     第一版放在后面读，于是「前置：onboardingDone 为 false」**永远红**。
     ⚠️ 也别拿 0 当余额基线。全新装机**不是空的**：seed 会写一条 +50 的 ledger
     （欢迎礼），所以 balance 是 50、任务有 12 条。清空之后应该**回到这个基线**，
     而不是回到 0 —— 第一版脚本就是按 0 断言的，红得莫名其妙。 */
  const fresh = await page.evaluate(() => {
    const s = window.__kqf__.getState()
    return {
      balance: s.balance,
      onboardingDone: s.settings.onboardingDone,
      taskCount: s.tasks.length,
    }
  })
  check('前置：全新装机时 onboardingDone 为 false', fresh.onboardingDone === false, `=${fresh.onboardingDone}`)
  check('前置：全新装机已有播种数据（基线不是空的）', fresh.taskCount > 0, `任务 ${fresh.taskCount} 条，余额 ${fresh.balance}`)

  await dismissOnboarding(page)
  await sleep(800)

  /**
   * 直接读 IndexedDB 每张表的条数。
   * ⚠️ 别改成读 `window.__kqf__.getState()` —— 那是内存快照，
   * 「表没删干净但内存里清了」这种情况它会漏报，而那正是本脚本要抓的。
   */
  const tableCounts = () =>
    page.evaluate(
      () =>
        new Promise((res) => {
          const req = indexedDB.open('kid-quest-farm')
          req.onerror = () => res({ __err: String(req.error) })
          req.onsuccess = () => {
            const db = req.result
            const names = [...db.objectStoreNames]
            if (!names.length) return res({})
            const out = {}
            let left = names.length
            const done = () => {
              if (--left === 0) {
                db.close()
                res(out)
              }
            }
            for (const n of names) {
              const c = db.transaction(n, 'readonly').objectStore(n).count()
              c.onsuccess = () => {
                out[n] = c.result
                done()
              }
              c.onerror = () => {
                out[n] = 'err'
                done()
              }
            }
          }
        }),
    )

  const clickByText = (text) =>
    page.evaluate((t) => {
      const b = [...document.querySelectorAll('button')].find(
        (x) => (x.innerText ?? '').trim() === t || (x.textContent ?? '').trim() === t,
      )
      b?.click()
      return !!b
    }, text)

  const MARK = '__e2e_wipe__'

  /* ---------- 1. 造「非默认」状态 ----------
     不清不楚的库分不出「清干净了」和「本来就是空的」，所以先塞脏数据。
     ⚠️ 这里每一条都要 check —— 前置失败必须判红，不能当「环境问题」跳过去
     （本项目最忌讳的假通过，见 §14.1）。 */
  console.log('\n【1】造状态')
  const seeded = await page.evaluate(
    async (mark) => {
      const s = window.__kqf__.getState()
      await s.updateSettings({ childName: mark })
      for (let i = 1; i <= 3; i++) {
        await s.addTask({
          title: `${mark}任务${i}`,
          category: 'study',
          cycle: 'once',
          plannedMinutes: 20,
          basePoints: 10,
          qualityBonusPoints: 0,
          allowOvertime: true,
          allowLateNoPenalty: false,
          qualityRated: false,
        })
      }
      const st = window.__kqf__.getState()
      return { childName: st.settings.childName, titles: st.tasks.map((t) => t.title) }
    },
    MARK,
  )
  check('前置：childName 已改成标记值', seeded.childName === MARK, `childName=${seeded.childName}`)
  check(
    '前置：3 条标记任务已入库',
    seeded.titles.filter((t) => t.includes(MARK)).length === 3,
    `命中 ${seeded.titles.filter((t) => t.includes(MARK)).length} 条`,
  )

  const countsBefore = await tableCounts()
  const dirtyBefore = Object.entries(countsBefore).filter(([, n]) => typeof n === 'number' && n > 0)
  check('前置：清空前库里确实有数据', dirtyBefore.length > 0, JSON.stringify(countsBefore))

  /* ---------- 2. 走真实 UI 清空 ---------- */
  console.log('\n【2】走真实 UI：设置 → 💾 数据 → PIN → 清空 → 确认')
  const openedSettings = await page.evaluate(() => {
    const b = [...document.querySelectorAll('header button')].find(
      (x) =>
        (x.getAttribute('aria-label') ?? '').includes('设置') || (x.innerText ?? '').includes('⚙'),
    )
    b?.click()
    return !!b
  })
  check('能打开设置页', openedSettings)
  await sleep(900)

  check('能切到「💾 数据」tab', await clickByText('💾 数据'))
  await sleep(900)

  // 数据 tab 是锁着的，先输默认密码 0000
  const wasLocked = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((x) => (x.textContent ?? '').trim() === '清空'),
  )
  if (wasLocked) {
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(
          (x) => (x.textContent ?? '').trim() === '0',
        )
        b?.click()
      })
      await sleep(200)
    }
    await sleep(800)
  }
  console.log(`  （数据 tab ${wasLocked ? '上锁，已输 0000 解锁' : '没上锁'}）`)

  check('能找到并点中「🗑️ 清空全部数据」', await clickByText('🗑️ 清空全部数据'))
  await sleep(700)
  check('点「确认清空」二次确认', await clickByText('确认清空'))

  /* ---------- 3. 等清完 + 重新播种 ---------- */
  await sleep(3000)

  const countsAfter = await tableCounts()
  const after = await page.evaluate((mark) => {
    const s = window.__kqf__.getState()
    return {
      childName: s.settings.childName,
      balance: s.balance,
      harvestBalance: s.harvestBalance,
      onboardingDone: s.settings.onboardingDone,
      taskCount: s.tasks.length,
      titles: s.tasks.map((t) => t.title),
      marked: s.tasks.filter((t) => t.title.includes(mark)).length,
    }
  }, MARK)

  /* ---------- 4. 判定 ---------- */
  console.log('\n【3】判定')
  check(
    '标记任务在 store 里被清掉',
    after.marked === 0,
    `还剩 ${after.marked} 条：${JSON.stringify(after.titles.filter((t) => t.includes(MARK)))}`,
  )
  check('改过的 childName 被复位', after.childName !== MARK, `childName=${JSON.stringify(after.childName)}`)
  // ⚠️ 判据是「回到全新装机基线」，不是「归零」—— 见上面 fresh 的注释
  check(
    '积分回到全新装机基线（不是归零）',
    after.balance === fresh.balance,
    `${after.balance} vs 基线 ${fresh.balance}`,
  )
  check('丰收币归零', after.harvestBalance === 0, `harvestBalance=${after.harvestBalance}`)
  check('任务数回到播种基线', after.taskCount === fresh.taskCount, `${after.taskCount} vs ${fresh.taskCount}`)
  check(
    'onboardingDone 被复位成 false',
    after.onboardingDone === false,
    `=${after.onboardingDone}`,
  )

  // ★ 最硬的一条：库本身也要是干净的。store 快照可能是「内存清了、表没删」。
  const dbStillDirty = await page.evaluate(
    (mark) =>
      new Promise((res) => {
        const req = indexedDB.open('kid-quest-farm')
        req.onerror = () => res('open-failed')
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('tasks')) return res('')
          const all = db.transaction('tasks', 'readonly').objectStore('tasks').getAll()
          all.onsuccess = () => {
            const hit = (all.result ?? []).filter((t) => String(t?.title ?? '').includes(mark))
            db.close()
            res(hit.map((t) => t.title).join(','))
          }
          all.onerror = () => {
            db.close()
            res('read-failed')
          }
        }
      }),
    MARK,
  )
  check(
    '★ IndexedDB 里也没有残留的标记任务（不是只清了内存快照）',
    dbStillDirty === '',
    `库内残留="${dbStillDirty}"`,
  )
  check('清空后库里仍有重新播种的数据（不是一片空白）', Object.keys(countsAfter).length > 0)

  console.log('\n清空前: ' + JSON.stringify(countsBefore))
  console.log('清空后: ' + JSON.stringify(countsAfter))

  /* ---------- 5. 重载后引导要重新弹出 ----------
     ⚠️ **必须重载**才验得出来。向导的门是 `App.tsx` 里 `gateDecided` 的**一次性**
     判断（进 App 时定一次）。清空是会话中途做的，那时门早定过了，所以当场
     不会弹 —— 那不是 bug。真正该验的是「下次开机（= 重载）会不会弹」，
     而那取决于 `onboardingDone` 有没有被复位。
     第一版脚本就是在**没重载**的情况下查 `[data-step="welcome"]`，红得毫无意义。 */
  await page.reload({ waitUntil: 'networkidle2', timeout: 45000 })
  await page.waitForFunction(() => !!window.__kqf__, { timeout: 20000 })
  await sleep(1500)
  const wizardBack = await page.evaluate(() => ({
    wizard: !!document.querySelector('[data-step="welcome"]'),
    onboardingDone: window.__kqf__.getState().settings.onboardingDone,
  }))
  check(
    '★ 重载后新手引导重新弹出（证明清空真的复位了 onboardingDone）',
    wizardBack.wizard,
    `onboardingDone=${wizardBack.onboardingDone}`,
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
