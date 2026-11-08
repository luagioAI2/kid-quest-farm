#!/usr/bin/env node
/* 把 C:/tmp/kqf-uploads/*.zip 逐个上传并发布到平台后端。
 *
 *     TF_ADMIN_KEY=… node _upload-games.mjs [--api http://127.0.0.1:8090]
 *
 * 每个包走 `/api/admin/game/release/upload`（multipart）：
 * 服务端把它解到 `<StaticPath>/games/<id>/<ver>/`，算**落盘后**的 sha256，
 * 再写 `game_release`（同 game_id 的旧版本自动 active=0）并失效目录缓存。
 *
 * 失败不中断：21 个包跑完再统一报，免得一个坏包挡住后面 20 个。
 */
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const args = process.argv.slice(2)
const arg = (n, d = '') => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : d
}
const API = (arg('api', process.env.TF_API ?? 'http://127.0.0.1:8090')).replace(/\/$/, '')
const KEY = arg('key', process.env.TF_ADMIN_KEY ?? '')
if (!KEY) {
  console.error('缺 TF_ADMIN_KEY（= 服务端 ServiceSettings.AdminSignKey）')
  process.exit(2)
}

function mintAdminToken(key, userID = '1') {
  const ts = Math.floor(Date.now() / 1000)
  const sig = createHmac('sha256', key).update(`${userID}:${ts}`).digest('hex')
  const b64 = Buffer.from(`${ts}:${userID}:${sig}`, 'utf8').toString('base64url')
  return b64 + '='.repeat((4 - (b64.length % 4)) % 4)
}

const manifest = JSON.parse(readFileSync('C:/tmp/kqf-uploads/manifest.json', 'utf8'))
console.log(`后端 ${API} · ${manifest.length} 个包\n`)

const failed = []
for (const [i, row] of manifest.entries()) {
  const buf = readFileSync(row.zip)
  const form = new FormData()
  form.set('game_id', row.id)
  form.set('version', row.version)
  form.set('channel', 'stable')
  form.set('file', new Blob([buf]), basename(row.zip))

  const t0 = Date.now()
  let text = ''
  let status = 0
  try {
    const res = await fetch(`${API}/api/admin/game/release/upload`, {
      method: 'POST',
      headers: { 'X-Api-Token': mintAdminToken(KEY) },
      body: form,
    })
    status = res.status
    text = await res.text()
  } catch (e) {
    failed.push({ id: row.id, why: `请求失败：${e.message}` })
    console.log(`${String(i + 1).padStart(2)}. ✗ ${row.id} —— ${e.message}`)
    continue
  }

  const ms = Date.now() - t0
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* 非 JSON 说明打到了别的东西（代理 / 静态页），下面按原文报 */
  }
  const ok = status === 200 && json?.code === 200
  const detail = ok
    ? `release#${json.data?.id} ${(json.data?.size / 1048576).toFixed(1)}MB`
    : `${status} ${(json?.msg ?? text).slice(0, 120)}`
  if (!ok) failed.push({ id: row.id, why: detail })
  console.log(`${String(i + 1).padStart(2)}. ${ok ? '✓' : '✗'} ${row.id.padEnd(12)} v${row.version.padEnd(8)} ${String(ms).padStart(6)}ms  ${detail}`)
}

console.log(`\n===== ${manifest.length - failed.length} 成功 / ${failed.length} 失败 =====`)
for (const f of failed) console.log(`  ✗ ${f.id}：${f.why}`)
process.exit(failed.length === 0 ? 0 : 1)
