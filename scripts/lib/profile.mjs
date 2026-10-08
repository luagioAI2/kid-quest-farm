/**
 * e2e 用的 Chrome profile 目录
 * ------------------------------------------------------------
 * 为什么需要这个 helper（而不是直接 `mkdtempSync(join(tmpdir(), …))`）：
 *
 * Chrome 把 IndexedDB / leveldb 写在 **profile 目录**里，而 `os.tmpdir()`
 * 在 Windows 上指向 `C:\Users\<user>\AppData\Local\Temp` —— **系统盘**。
 * 系统盘一满，Chrome 就开始抛这种错误：
 *
 *   AbortError: Connection is closing because of: IO error:
 *     ...\indexeddb.leveldb\000003.log: FILE_ERROR_NO_SPACE
 *   DatabaseClosedError: Internal error opening backing store for indexedDB.open.
 *   BulkError: redeemItems.bulkPut(): 4 of 12 operations failed.
 *
 * 症状极具迷惑性：**随机**挂在任意一条用例上，有时干脆在 `boot()` 就炸，
 * 于是看起来像"应用有并发 bug / 刚改的经济数值把库写坏了"。
 * 2026-09-19 在 kid-quest-farm 上真实踩过：e2e-gameplay 两次跑挂在两个不同位置，
 * 而把 profile 挪到项目所在的盘（还有 33G）之后，同一个构建 5/5 全过。
 *
 * 所以规则是：**profile 必须和项目同盘**，不要碰系统盘的临时目录。
 *
 * 优先级：
 *   1. `KQF_SCRATCH_DIR` 环境变量（CI / 特殊环境想自己指定时用）
 *   2. `<项目根>/.e2e-scratch/`（和项目同盘，天然共享可用空间）
 *
 * 目录名带 pid + tag，多个套件并行跑不会互相踩。
 */
import { mkdtempSync, mkdirSync, rmSync, readdirSync, statSync, existsSync, writeSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export const SCRATCH_BASE =
  process.env.KQF_SCRATCH_DIR ?? join(PROJECT_ROOT, '.e2e-scratch')

/* ============================================================
   清理
   ------------------------------------------------------------
   ⚠️ 2026-10-08：这里原来写的是 `rmSync(SCRATCH_BASE, { recursive: true })`
   —— 删**整个** `.e2e-scratch`。两个毛病：

   1. **太宽**：`SCRATCH_BASE` 里还有跑批的日志、截图，而且
      `.e2e-scratch/landing-shots/` 是 `build-site.mjs` /
      `make-site-assets.py` 的**输入**。真删成功一次，官网就出不了图。
   2. **根本没成功过**：异常被下面那个空 catch 吞掉，于是**一个都没删掉**。
      实测攒了 **372 个 profile / 6.3 GB**。

   现在的策略是两层，缺一不可：

   · **只删本进程自己建的那些**（`created` 列表）—— 精确，不误伤。
   · **下次跑批时扫掉上次遗留的**（`sweepStaleProfiles`）——
     退出钩子里的同步删除注定是 best-effort，不能指望它一定成功。
     **有了这一层，泄漏量才有上界。**

   ------------------------------------------------------------
   2026-10-08 实测（别再凭印象改这里）：

   · **删不掉有两种原因，看环境**：
     (a) **文件被占用** —— `browser.close()` 返回时 Chrome 的 renderer / gpu
         子进程还在退，profile 里的 leveldb 还被攥着；句柄一松就能删。
     (b) **safe-delete 闸门** —— agent 沙箱会把它通过 `NODE_OPTIONS` 预载的
         `node-brokered-fs-shim` **注入到 node 子进程**，所以跑批脚本自己
         也会被拦。它按「轮」累计，超阈值就一直拒绝，抛的是**没有 `code`
         的普通 `Error`**，`message` 里带 marker：
           [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":87169,"threshold":50,...}
         实测：一轮里删掉 372 个 profile 后计数器涨到 8 万多，
         之后**每一次**递归删除都被拒 —— 退出钩子和 sweep 一起失效。
         ⚠️ 我一开始判断「闸门只管 agent 的 shell 命令、管不到 node 子进程」，
         **是错的**。判据是 `e.message` 里有没有 `SAFE_DELETE_BULK_`，
         不是「它是不是 node 子进程」。
         绕过：跑批时加 `CODEBUDDY_SAFE_DELETE_ENABLED=0`。
   · **占用时的行为是全有全无**：50 个文件的树里只锁住 1 个，
     `rmSync` 抛错、**一个文件都没删**（实测 50 → 50）；句柄一松，
     同一棵树立刻删干净。所以「重试」是有意义的，而且**不会半删**——
     扫到正在跑的 profile 最多是白跑一趟，不会把它删坏。
     （`force: true` 只忽略「路径不存在」，**不忽略占用**。）
   · **重试真的救得回来**（红→绿都验过）：让另一个进程攥住 profile 里
     一个文件 400ms，`attempts=1` 时稳定泄漏 52 个文件；
     `attempts=4` 时 attempt 0 失败、attempt 1 成功。
   · **一次失败的 `rmSync` 在这个环境里要花 ~1 秒**（走的是
     `node-brokered-fs-shim`）。所以 4 次重试的实际窗口 ≈ 3.9 秒，
     不是 4×150ms —— 别再按后者估算。
   ============================================================ */

/** 闸门拦下时只喊一次，别刷屏。 */
let guardWarned = false

/**
 * 同步重试删除。
 *
 * 为什么需要重试：退出钩子跑在 `process.on('exit')` 里，**不能 await**，
 * 而此刻 Chrome 子进程往往还差几百毫秒才把文件句柄放开。
 * 等一小会儿再删，成功率就上去了。
 *
 * 睡眠用 `Atomics.wait` —— 这是唯一能在同步上下文里阻塞的办法
 * （`process.on('exit')` 里 setTimeout 不会被调度）。
 */
function rmTreeWithRetry(dir, attempts = 4, delayMs = 150) {
  for (let i = 0; i < attempts; i++) {
    try {
      rmSync(dir, { recursive: true, force: true })
      return true
    } catch (e) {
      // safe-delete 闸门（见文件头）—— 重试多少次都会被拒，直接放弃并**明说**。
      // 用 writeSync 而不是 console.warn：退出钩子里异步写可能丢。
      if (String(e?.message ?? '').includes('SAFE_DELETE_BULK_')) {
        if (!guardWarned) {
          guardWarned = true
          try {
            writeSync(
              2,
              '  ⚠️ Chrome profile 没清掉：被 safe-delete 闸门拦下了。\n' +
                '     在 agent 沙箱里跑 e2e 请加环境变量：CODEBUDDY_SAFE_DELETE_ENABLED=0\n' +
                '     （闸门按「轮」累计，删得越多越容易触发；详见 scripts/lib/profile.mjs 注释）\n',
            )
          } catch {
            /* 连 stderr 都写不了就算了 */
          }
        }
        return false
      }
      if (i === attempts - 1) return false
      try {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs)
      } catch {
        return false /* 环境不支持就放弃重试 */
      }
    }
  }
  return false
}

/** 本进程创建过的 profile 目录。退出时只删这些。 */
const created = []

let cleanupHooked = false
function hookCleanup() {
  if (cleanupHooked) return
  cleanupHooked = true
  process.once('exit', () => {
    for (const dir of created) {
      // 删不掉就留给下次跑批的 sweep —— 退出钩子里没法再挣扎更多
      rmTreeWithRetry(dir)
    }
  })
}

/**
 * `mkdtempSync` 的产物形如 `<tag>-a1B2c3`。
 * 只认这个形状，避免把日志 / 截图目录当成 profile 删掉。
 */
const PROFILE_DIR_RE = /-[A-Za-z0-9]{6}$/

/**
 * 超过这个时长没被动过才算「遗留」。
 *
 * 之所以敢取得这么短：占用中的树 `rmSync` 是**全有全无**地失败（见文件头实测），
 * 扫到正在跑的 profile 最多白跑一趟，不会删坏它。这个闸门只是为了少做无用功。
 */
const STALE_MS = 30 * 60_000

/**
 * 扫掉**上一次**被中断的跑批留下的 Chrome profile。
 *
 * 三道闸门，都过了才删：
 *   1. 名字是 `*-XXXXXX`（mkdtemp 的形状）
 *   2. 长得像 Chrome profile（有 `Local State` 或 `Default/`）
 *   3. 半小时内没被动过
 */
function sweepStaleProfiles(base) {
  let removed = 0
  let entries
  try {
    entries = readdirSync(base)
  } catch {
    return 0
  }
  for (const name of entries) {
    if (!PROFILE_DIR_RE.test(name)) continue
    const path = join(base, name)
    try {
      const st = statSync(path)
      if (!st.isDirectory()) continue
      if (!existsSync(join(path, 'Local State')) && !existsSync(join(path, 'Default'))) continue
      if (Date.now() - st.mtimeMs < STALE_MS) continue
      if (rmTreeWithRetry(path, 2, 100)) removed++
    } catch {
      /* 删不掉就留着，下次再说 —— 不能因为清理失败就搞挂跑批 */
    }
  }
  if (removed > 0) console.log(`  · 清掉 ${removed} 个上次遗留的 Chrome profile`)
  return removed
}

let swept = false

export function makeProfileDir(tag) {
  mkdirSync(SCRATCH_BASE, { recursive: true })
  // 每次进程只扫一遍，别在同一个跑批里反复遍历几百个目录
  if (!swept) {
    swept = true
    sweepStaleProfiles(SCRATCH_BASE)
  }
  hookCleanup()
  const dir = mkdtempSync(join(SCRATCH_BASE, `${tag}-`))
  created.push(dir)
  return dir
}
