/**
 * 第四层验收的补充：**旧库升级**（v4 → v5）。
 *
 * 为什么单开一个脚本 —— e2e-check.mjs / e2e-gameplay.mjs 每次都用全新的 Chrome
 * profile，也就是**全新的库**，走的是「一次性建表」；单元测试用 fake-indexeddb，
 * 同样是全新库。于是「老用户升级」这条路径四层验收里没有任何一层走到过。
 *
 * 这个 App 有已发布的 APK，真实用户手上就是 v4 的库。v5 加了 `harvestLedger`
 * 表，一旦 Dexie 的版本声明写错（比如某个 version 里漏写了表、或者忘了合并），
 * 表现是**老用户数据被清空**，而且不报错 —— 正是这个项目反复踩过的那类坑。
 *
 * 做法：
 *   1. 先落在一个**不启动 App 的同源页面**（favicon.svg），
 *      否则 Dexie 会抢先建出 v5 的库，而且它握着连接，
 *      deleteDatabase 会被 onblocked 挡住 —— 上一版探针就是这么假通过的。
 *   2. 手搓一个 v4 的库（IDB 版本 40，Dexie 把声明版本 ×10），塞入真实数据。
 *   3. 进 App，让它以 v5 打开、触发真实升级。
 *   4. 回读：表有没有丢、数据有没有丢、余额算得对不对、有没有报错。
 *
 * 用法：node scripts/e2e-upgrade.mjs http://127.0.0.1:4180/
 */
import puppeteer from 'puppeteer-core'
import { existsSync, rmSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const URL = process.argv[2] ?? 'http://127.0.0.1:4180/'
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const chrome = CHROME_CANDIDATES.find((p) => existsSync(p))
if (!chrome) throw new Error('找不到 Chrome/Edge')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const profileDir = mkdtempSync(join(tmpdir(), 'kqf-upgrade-'))
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  userDataDir: profileDir,
})
const page = await browser.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text())
})

console.log(`\n升级验收 ${URL}\n`)

// 关键：先落在一个**不启动 App** 的同源页面
await page.goto(`${URL.replace(/\/$/, '')}/favicon.svg`, {
  waitUntil: 'domcontentloaded',
})

/* ---------- 1. 手搓一个 v4 的库，塞入真实数据 ---------- */

/** v1..v4 合并后的真实 schema（Dexie 每个 version 只声明变动表，这里写全） */
const V4_SCHEMA = {
  tasks: 'id, cycle, category, archived, createdAt',
  taskInstances:
    'id, taskId, periodKey, date, status, [date+status], [status+submittedAt], &[taskId+periodKey+date]',
  ledger: 'id, source, createdAt, refId',
  inventory: 'itemId',
  animals: 'id, animalId, bornAt',
  checkIns: 'id, taskId, date, periodKey, [taskId+periodKey], &[taskId+date]',
  checkInProgress: 'id, taskId, periodKey, [taskId+periodKey]',
  meta: 'key',
  redeemItems: 'id, category, archived, cost, createdAt',
  redeemRecords: 'id, itemId, createdAt, fulfilled',
  farmEvents: 'id, kind, createdAt, refId',
}

const seeded = await page.evaluate(
  async ({ schema }) => {
    // 删干净。onblocked 绝不能当成「删完了」—— 那正是上一版的假通过
    await new Promise((res, rej) => {
      const r = indexedDB.deleteDatabase('kid-quest-farm')
      r.onsuccess = () => res()
      r.onerror = () => rej(r.error)
      r.onblocked = () => rej(new Error('deleteDatabase 被阻塞：还有连接没关'))
    })
    const db = await new Promise((res, rej) => {
      // Dexie 把声明版本 ×10 落到 IndexedDB：声明 v4 → IDB 版本 40
      const r = indexedDB.open('kid-quest-farm', 40)
      r.onupgradeneeded = () => {
        const d = r.result
        for (const [name, spec] of Object.entries(schema)) {
          const parts = spec.split(',').map((s) => s.trim())
          const store = d.createObjectStore(name, { keyPath: parts[0] })
          for (const p of parts.slice(1)) {
            const unique = p.startsWith('&')
            const body = unique ? p.slice(1) : p
            const fields = body.replace(/^\[|\]$/g, '').split('+')
            store.createIndex(body, fields, { unique })
          }
        }
      }
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const tx = db.transaction(['ledger', 'tasks', 'meta', 'farmEvents'], 'readwrite')
    tx.objectStore('ledger').put({
      id: 'lg_seed_1', delta: 50, balanceAfter: 50, source: 'manual_adjust',
      memo: '欢迎来到小任务农场！', createdAt: 1000,
    })
    tx.objectStore('ledger').put({
      id: 'lg_seed_2', delta: 30, balanceAfter: 80, source: 'task_reward',
      memo: '按时完成', createdAt: 2000,
    })
    tx.objectStore('ledger').put({
      id: 'lg_seed_3', delta: -6, balanceAfter: 74, source: 'farm_plant',
      memo: '买胡萝卜种子', createdAt: 3000,
    })
    // 注意：category 存的是英文枚举 id（study/chore/…），不是界面上的中文标签。
    // 写成 '学习' 会让 CATEGORY['学习'] 查不到 → `.solid` 直接崩整页。
    tx.objectStore('tasks').put({
      id: 'tk_seed', title: '老数据任务', cycle: 'daily', category: 'study',
      archived: false, createdAt: 900,
    })
    tx.objectStore('meta').put({ key: 'seedIfEmpty', value: true })
    tx.objectStore('farmEvents').put({
      id: 'fe_seed', kind: 'disaster', createdAt: 2500, refId: 'plot:0',
    })
    await new Promise((res) => { tx.oncomplete = res })
    db.close()
    // 读回来，别把自己写进去的字面量当证据
    return await new Promise((res) => {
      const r = indexedDB.open('kid-quest-farm')
      r.onsuccess = () => {
        const d = r.result
        const out = { version: d.version, stores: Array.from(d.objectStoreNames) }
        d.close()
        res(out)
      }
    })
  },
  { schema: V4_SCHEMA },
)

check('起点确实是 v4 老库（读回 IDB 版本 40）', seeded.version === 40, `实际 ${seeded.version}`)
check(
  '起点没有 harvestLedger 表（否则「升级」是假的）',
  !seeded.stores.includes('harvestLedger'),
  `起点 ${seeded.stores.length} 张表`,
)

/* ---------- 2. 进 App，触发真实升级 ---------- */
pageErrors.length = 0
await page.goto(URL, { waitUntil: 'networkidle2' })
await new Promise((r) => setTimeout(r, 1500))

const after = await page.evaluate(async () => {
  const db = await new Promise((res, rej) => {
    const r = indexedDB.open('kid-quest-farm')
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
  const readAll = (store) =>
    new Promise((res) => {
      if (!db.objectStoreNames.contains(store)) return res(null)
      const rq = db.transaction(store).objectStore(store).getAll()
      rq.onsuccess = () => res(rq.result)
      rq.onerror = () => res('ERR')
    })
  const out = {
    version: db.version,
    stores: Array.from(db.objectStoreNames).sort(),
    ledger: await readAll('ledger'),
    tasks: await readAll('tasks'),
    farmEvents: await readAll('farmEvents'),
    harvestLedger: await readAll('harvestLedger'),
  }
  db.close()
  return out
})

check('库版本升到 50（声明 v5）', after.version === 50, `实际 ${after.version}`)
check('新表 harvestLedger 建出来了', after.stores.includes('harvestLedger'), `共 ${after.stores.length} 张表`)
check(
  '旧表一张都没丢',
  Object.keys(V4_SCHEMA).every((s) => after.stores.includes(s)),
  `v4 的 ${Object.keys(V4_SCHEMA).length} 张表都在`,
)
check(
  '积分流水 3 条原样还在',
  Array.isArray(after.ledger) && after.ledger.length === 3,
  `实际 ${Array.isArray(after.ledger) ? after.ledger.length : after.ledger} 条`,
)
check('旧任务数据还在', Array.isArray(after.tasks) && after.tasks.some((t) => t.id === 'tk_seed'))
check('农场事件日志还在', Array.isArray(after.farmEvents) && after.farmEvents.length === 1)
check(
  '新表初始为空（没被旧数据污染）',
  Array.isArray(after.harvestLedger) && after.harvestLedger.length === 0,
  `实际 ${Array.isArray(after.harvestLedger) ? after.harvestLedger.length : after.harvestLedger} 条`,
)

/* ---------- 3. 升级后余额算得对 ---------- */
const state = await page.evaluate(async () => {
  for (let i = 0; i < 40; i++) {
    const s = window.__kqf__?.getState?.()
    if (s && typeof s.balance === 'number') {
      return { balance: s.balance, harvest: s.harvestBalance }
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  return null
})
check('升级后余额 = 三条流水之和 74', state?.balance === 74, `实际 ${state?.balance}`)
check('升级后丰收币余额 = 0', state?.harvest === 0, `实际 ${state?.harvest}`)

/* ---------- 4. 升级没报错 ---------- */
const realErrors = pageErrors.filter(
  (e) => !/favicon|Download the React DevTools/i.test(e),
)
check('升级过程无报错', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

console.log('\n' + '─'.repeat(58))
const failed = results.filter((r) => !r.ok)
console.log(`通过 ${results.length - failed.length}/${results.length}`)
if (failed.length) {
  console.log('失败项：')
  for (const f of failed) console.log(`  - ${f.name} ${f.detail}`)
}

await browser.close()
rmSync(profileDir, { recursive: true, force: true })
process.exit(failed.length ? 1 : 0)
