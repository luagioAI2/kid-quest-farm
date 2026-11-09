#!/usr/bin/env node
/**
 * 验「某一款游戏的远程包」是否真的可装：目录 → 包 → 资源清单，逐层比对。
 *
 * 为什么单独有这个脚本：`check-plugin.mjs` 只看**本地**那份 dist-plugin，
 * 而线上装不上的原因九成在「目录里的哈希 / 包里的字节 / 资源目录」这三者不同步。
 * 这个脚本把三段一次跑完，判据全是字节，不看文案。
 *
 * 用法：
 *   node scripts/check-remote-package.mjs --id redbutton
 *   node scripts/check-remote-package.mjs --id fall2048 --origin https://192.168.101.12:4443
 *
 * 前置：后端在跑（默认 8091 的目录接口）；自签证书靠 NODE_TLS_REJECT_UNAUTHORIZED=0。
 */
import { createHash } from 'node:crypto'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const argv = process.argv.slice(2)
const arg = (k, d) => {
  const i = argv.indexOf('--' + k)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d
}

const ID = arg('id')
const ORIGIN = arg('origin', 'https://192.168.101.12:4443')
if (!ID) {
  console.error('用法：node scripts/check-remote-package.mjs --id <game_id> [--origin https://ip:4443]')
  process.exit(2)
}

const sha = (b) => createHash('sha256').update(b).digest('hex')
let bad = 0
let warns = 0
const warn = (label) => {
  console.log(`! ${label}`)
  warns++
}
const ok = (label, cond, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) bad++
}

try {
  const cat = await (await fetch(`${ORIGIN}/api/game/catalog`)).json()
  const g = (cat.games ?? []).find((x) => x.id === ID)
  ok(`目录里有 ${ID}`, !!g)
  if (!g) {
    console.log(`\n结果：1 条失败（目录 ${cat.games?.length ?? 0} 款里没有 ${ID}）`)
    process.exit(1)
  }

  ok('目录里同一 id 只有一条', (cat.games ?? []).filter((x) => x.id === ID).length === 1)
  console.log(`  · 版本 ${g.version} · size ${g.size}`)

  const url = g.url.startsWith('http') ? g.url : ORIGIN + g.url
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
  ok('包能下载', buf.length > 0, `${(buf.length / 1024).toFixed(0)} KB`)
  ok('包 sha256 与目录一致', sha(buf) === g.sha256, sha(buf).slice(0, 12))

  const base = (g.assetBase ?? url.replace(/[^/]+$/, '')).replace(/\/?$/, '/')
  const mres = await fetch(base + 'assets/manifest.json')
  if (mres.status !== 200) {
    // 软提示：缺清单不等于装不上，但发布方就少了一道「逐个资源校验」
    // 资源全内联进 .mjs 的游戏（cellguard / claw3d）本来就没有 assets/，这条可忽略
    warn(`没有 assets/manifest.json（${mres.status}）：资源没法逐个校验（资源全内联的可忽略）`)
  } else {
    const m = await mres.json()
    const list = Array.isArray(m.assets) ? m.assets : null
    if (!list) {
      // 有些游戏把 assets/manifest.json 用作**自己的图集索引**（名字 → 裁切矩形），
      // 那种没有 sha256，跟发布方的完整性清单是两回事 ⇒ 只提示
      warn('assets/manifest.json 不是发布方清单（没有 assets 数组），跳过逐个校验')
    } else {
      ok('清单是发布方清单', true, `${list.length} 条`)
      let miss = 0
      for (const a of list) {
        const r = await fetch(base + 'assets/' + a.file)
        if (r.status !== 200) {
          console.log('   404:', a.file)
          miss++
          continue
        }
        const h = sha(Buffer.from(await r.arrayBuffer()))
        if (h !== a.sha256) {
          console.log('   哈希不符:', a.file)
          miss++
        }
      }
      ok('清单里每个资源都能下且哈希对得上', miss === 0, `坏 ${miss} 条`)
    }
  }
} catch (e) {
  console.log('✗ 探针中断：' + e.message)
  bad++
}

console.log(
  bad === 0
    ? `\n结果：全过${warns ? `（${warns} 条提示）` : ''}`
    : `\n结果：${bad} 条失败${warns ? ` · ${warns} 条提示` : ''}`,
)
process.exit(bad === 0 ? 0 : 1)
