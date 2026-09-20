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
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * 自动清理：套件跑完（`browser.close()` 之后）进程退出时删掉 profile。
 * 放在这里而不是让每个脚本自己 `rmSync`：六个套件各写一遍必然漏。
 * 删不掉就删不掉（Chrome 可能还没松手），`force` + 吞异常，不干扰退出码。
 */
let cleanupHooked = false
function hookCleanup() {
  if (cleanupHooked) return
  cleanupHooked = true
  process.once('exit', () => {
    try {
      rmSync(SCRATCH_BASE, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  })
}

export function makeProfileDir(tag) {
  const base = process.env.KQF_SCRATCH_DIR
    ? process.env.KQF_SCRATCH_DIR
    : join(PROJECT_ROOT, '.e2e-scratch')
  mkdirSync(base, { recursive: true })
  hookCleanup()
  return mkdtempSync(join(base, `${tag}-`))
}

export const SCRATCH_BASE = process.env.KQF_SCRATCH_DIR ?? join(PROJECT_ROOT, '.e2e-scratch')
