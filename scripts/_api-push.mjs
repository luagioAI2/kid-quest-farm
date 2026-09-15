/**
 * 用 GitHub REST API 推送（当 github.com 的 git 通道不通时的退路）
 * ------------------------------------------------------------
 * 背景：这个环境里 `github.com` 基本连不上（`git push` / `ls-remote`
 * 大量 `Failed to connect`），但 `api.github.com` 一直是通的（几百毫秒）。
 * 于是走 Git Data API 把本地提交「重放」上去：blob → tree → commit → ref。
 *
 * ⚠️ 它会**自检**：重放出来的 tree sha 必须和本地 `git rev-parse <c>^{tree}`
 * 一模一样。sha 是内容寻址的，对得上就说明文件内容逐字节一致 ——
 * 不然就是重放漏了文件，会当场停下。
 *
 * 令牌从 `~/.git-credentials` 读（credential.helper=store），
 * 不从命令行参数拿，免得进 shell 历史。
 *
 * 用法：node scripts/_api-push.mjs [--dry-run]
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DRY = process.argv.includes('--dry-run')
const FORCE = process.argv.includes('--force')
const BASE = (process.argv.find((a) => a.startsWith('--base=')) ?? '').slice(7) || null
/** 重放出来的 commit sha 和本地不一致的（正常应该为空） */
const shaMismatch = []
const OWNER = 'luagioAI2'
const REPO = 'kid-quest-farm'
const BRANCH = 'main'
const API = 'https://api.github.com'

/* ---------- 令牌 ---------- */
function token() {
  const raw = readFileSync(join(homedir(), '.git-credentials'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^https:\/\/([^:]+):([^@]+)@github\.com$/)
    if (m) return { user: m[1], tok: m[2] }
  }
  throw new Error('~/.git-credentials 里没有 github.com 的条目')
}
const { tok } = token()

/* ---------- git 小工具（都返回原始 Buffer / 字符串，不做编码猜测） ---------- */
const git = (args, opts = {}) =>
  execFileSync('git', args, { maxBuffer: 256 * 1024 * 1024, ...opts })

const gitText = (args) => git(args).toString('utf8')

/* ---------- API ---------- */
async function api(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tok}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'kqf-api-push',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* 非 JSON 就留着原文 */
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`)
  }
  return json
}

/* ---------- 1. 远端现在停在哪 ---------- */
// ⚠️ GET 用**单数** /git/ref/{ref}，PATCH 用**复数** /git/refs/{ref}。
// 两个都写单数的话，GET 正常、PATCH 回 404 Not Found —— 而且看不出是路径问题。
const refPath = `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`
const refsPath = `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`
const remoteRef = await api('GET', refPath)
const remoteHead = remoteRef.object.sha
const localHead = gitText(['rev-parse', 'HEAD']).trim()

console.log(`远端 ${BRANCH} = ${remoteHead}`)
console.log(`本地 HEAD   = ${localHead}`)

if (remoteHead === localHead) {
  console.log('\n已经是最新的，不用推。')
  process.exit(0)
}

// 从哪个提交开始重放。默认「远端现在停的地方」，可用 --base 覆盖 ——
// 上一次用有 bug 的版本推过之后，远端会留下一串「内容对、sha 不同」的平行历史，
// 那时就得用 --base 指回共同祖先，把本地这一串原样重放一遍。
// ⚠️ 一定要 `rev-parse` 展开成完整的 40 位：API 不认缩写 sha，会直接 404
// （而且报的是 "Not Found"，看不出是缩写的问题）。
const base = gitText(['rev-parse', BASE ?? remoteHead]).trim()

const isAncestor = (() => {
  try {
    git(['merge-base', '--is-ancestor', base, localHead])
    return true
  } catch {
    return false
  }
})()

if (!isAncestor && !FORCE) {
  // 常见情形：远端内容其实和本地一模一样，只是提交 id 分叉了
  // （比如上一次推送时把提交消息的尾部换行去掉了）。
  const remoteTree = (await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${remoteHead}`)).tree.sha
  const localTree = gitText(['rev-parse', `${localHead}^{tree}`]).trim()
  if (remoteTree === localTree) {
    throw new Error(
      '远端内容和本地 HEAD 完全一致，但提交 sha 不同（平行历史）。\n' +
        '  这会让以后普通 `git push` 被当成 non-fast-forward 拒掉。\n' +
        '  修法：加 `--force --base=<两边共同的那个祖先>` 重跑，把本地这一串原样重放上去。',
    )
  }
  throw new Error(`${base} 不是本地的祖先（落后或有分叉），拒绝推送 —— 先人工看一眼`)
}

/* ---------- 2. 待推的提交（从旧到新） ---------- */
const pending = gitText(['rev-list', '--reverse', `${base}..${localHead}`])
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
console.log(`待推 ${pending.length} 个提交（基准 ${base.slice(0, 8)}）：`)
for (const c of pending) {
  console.log(`  ${c.slice(0, 8)}  ${gitText(['log', '-1', '--format=%s', c]).trim()}`)
}
if (DRY) {
  console.log('\n--dry-run：到此为止。')
  process.exit(0)
}

/* ---------- 3. 逐个重放 ---------- */
let remoteParent = base
// 基准提交的 tree —— 它已经在远端了，取一次即可
let remoteParentTree = (await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${base}`)).tree.sha

const localParentTree = gitText(['rev-parse', `${base}^{tree}`]).trim()
if (remoteParentTree !== localParentTree) {
  throw new Error(
    `起点就对不上：远端 ${base} 的 tree 是 ${remoteParentTree}，` +
      `本地算出来是 ${localParentTree} —— 说明本地和远端不是同一份历史，停下`,
  )
}
console.log(`\n起点 tree 校验通过：${remoteParentTree}`)

for (const c of pending) {
  const short = c.slice(0, 8)
  const parent = gitText(['rev-parse', `${c}^`]).trim()

  // 改动清单（-z：路径里可能有非 ASCII，别按行切）
  const changed = gitText(['diff-tree', '-r', '--no-commit-id', '--name-only', '-z', parent, c])
    .split('\0')
    .filter(Boolean)

  console.log(`\n▸ ${short}  改动 ${changed.length} 个文件`)

  const entries = []
  for (const path of changed) {
    // 这个路径在**新**提交里长什么样：查得到 = 新增/修改，查不到 = 删除
    const line = gitText(['ls-tree', '-z', c, '--', path]).split('\0').filter(Boolean)[0]
    if (!line) {
      entries.push({ path, mode: '100644', type: 'blob', sha: null })
      continue
    }
    const m = line.match(/^(\d+)\s+blob\s+([0-9a-f]+)\t/)
    if (!m) throw new Error(`解析 ls-tree 失败：${line.slice(0, 120)}`)
    const [, mode, blobSha] = m
    const content = git(['cat-file', 'blob', blobSha])
    const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, {
      content: content.toString('base64'),
      encoding: 'base64',
    })
    entries.push({ path, mode, type: 'blob', sha: blob.sha })
  }

  const tree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, {
    base_tree: remoteParentTree,
    tree: entries,
  })

  // ★ 自检：重放出来的 tree 必须和本地那个提交的 tree 逐字节一致
  const expectedTree = gitText(['rev-parse', `${c}^{tree}`]).trim()
  if (tree.sha !== expectedTree) {
    throw new Error(
      `tree 对不上！重放得到 ${tree.sha}，本地是 ${expectedTree}（${short}）—— 停下来别推`,
    )
  }
  console.log(`  tree ✓ ${tree.sha}`)

  const meta = gitText([
    'log',
    '-1',
    '--format=%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI',
    c,
  ]).split('\0')
  const [an, ae, aI, cn, ce, cI] = meta

  // ⚠️ 消息必须**逐字节**照抄。第一版写成 `msg.replace(/\n+$/, '')` 去掉尾部换行，
  // 结果 commit sha 全变了 —— 提交对象里消息末尾那个换行是**内容的一部分**。
  // 后果很隐蔽：远端内容完全正确（tree 一致），但提交 id 和本地分叉，
  // 以后普通 `git push` 会被当成 non-fast-forward 拒掉。
  // 所以从原始 commit 对象里切，别用 %B（它后面还会被 git log 补一个换行）。
  const raw = gitText(['cat-file', 'commit', c])
  const msg = raw.slice(raw.indexOf('\n\n') + 2)

  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
    message: msg,
    tree: tree.sha,
    parents: [remoteParent],
    author: { name: an, email: ae, date: aI },
    committer: { name: cn, email: ce, date: cI },
  })
  if (commit.sha === c) {
    console.log(`  commit ✓ ${commit.sha}（和本地完全一致）`)
  } else {
    console.log(`  commit ~ ${commit.sha}（与本地 ${short} 不同，但 tree 相同）`)
    shaMismatch.push({ local: c, remote: commit.sha })
  }

  remoteParent = commit.sha
  remoteParentTree = tree.sha
}

/* ---------- 4. 挪 ref ---------- */
await api('PATCH', refsPath, { sha: remoteParent, force: FORCE })
console.log(`\n✓ ${BRANCH} 已更新到 ${remoteParent}`)

const after = await api('GET', refPath)
console.log(`  远端复核：${after.object.sha}`)
console.log(after.object.sha === remoteParent ? '  ✓ 远端确认' : '  ✗ 远端不是这个值！')

if (shaMismatch.length) {
  console.log(`\n⚠️ 有 ${shaMismatch.length} 个提交 sha 和本地不一致（tree 相同、内容一致）：`)
  for (const m of shaMismatch) {
    console.log(`  本地 ${m.local.slice(0, 8)} → 远端 ${m.remote.slice(0, 8)}`)
  }
  console.log('  → 本地和远端历史分叉了，以后普通 git push 会被当成 non-fast-forward 拒掉。')
} else {
  console.log('\n✓ 所有提交 sha 与本地完全一致 —— 本地和远端是同一份历史，以后能正常 push。')
}
