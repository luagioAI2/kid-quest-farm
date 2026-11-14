#!/usr/bin/env node
/**
 * APK 上线前自检 · 后端地址
 *
 * 打 APK 时最容易错的三件事，**装到手机上才炸**，而症状都是同一句话
 * 「连不上服务器」（家长只会说「打不开」）：
 *
 *   ① 地址是 `127.0.0.1` —— 在手机上那是**手机自己**；
 *   ② 协议是 `http` —— `allowMixedContent:false`，WebView 直接拦；
 *   ③ 服务端 CORS 没放行 App 的 Origin —— 浏览器里能开，WebView 里不行。
 *
 * 这个脚本把这三件事**在电脑上**先验一遍，外加两条只有真机才会暴露的：
 *   ④ 证书不被信任（自签 / 过期 / 域名对不上）—— WebView 不给你「继续访问」；
 *   ⑤ 回包是网关的 HTML 错误页（代理 / 反代配错），看着 200 其实不是我们的 API。
 *
 * 用法：
 *   node scripts/check-apk-endpoint.mjs                      # 读 .env.apk
 *   node scripts/check-apk-endpoint.mjs https://api.x.com
 *   node scripts/check-apk-endpoint.mjs --allow-http http://192.168.1.9:8090
 *     ↑ 局域网调试用；打正式包**不要**加这个开关
 *
 * ⚠️ 它只发**不写数据**的请求：`/api/ping` + 一次故意失败的登录。
 *    所以可以对着生产库随便跑。
 */

import fs from 'node:fs'

/* ---------------- 参数 ---------------- */
let allowHttp = false
const args = []
for (const a of process.argv.slice(2)) {
  if (a === '--allow-http') allowHttp = true
  else if (a === '-h' || a === '--help') {
    console.log('用法：node scripts/check-apk-endpoint.mjs [--allow-http] [baseURL]')
    process.exit(0)
  } else args.push(a)
}

function fromEnvFile() {
  for (const f of ['.env.apk', '.env.production']) {
    if (!fs.existsSync(f)) continue
    const line = fs
      .readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('VITE_API_BASE='))
    if (line) {
      const v = line.slice('VITE_API_BASE='.length).replace(/^["']|["']$/g, '').trim()
      if (v) return { url: v, from: f }
    }
  }
  return null
}

const picked = args[0] ? { url: args[0], from: '命令行' } : fromEnvFile()
if (!picked) {
  console.error('✗ 没有地址。给一个，或先写 .env.apk：')
  console.error("    echo 'VITE_API_BASE=https://api.你的域名.com' > .env.apk")
  process.exit(2)
}

const raw = picked.url
const base = raw.replace(/\/+$/, '')

const results = []
function check(name, ok, detail) {
  results.push({ name, ok })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
  return ok
}

console.log(`\n地址：${base}（来自 ${picked.from}）\n`)

/* ---------------- ① 形状 ---------------- */
check('末尾没有多余的斜杠', raw === base, raw === base ? '' : `${raw} → 应该是 ${base}`)

const isHttps = /^https:\/\//i.test(base)
if (allowHttp) {
  check('协议（--allow-http 放行）', /^https?:\/\//i.test(base), isHttps ? 'https' : 'http')
} else {
  check(
    '必须是 https',
    isHttps,
    isHttps ? '' : 'allowMixedContent=false，WebView 会直接拦掉 http 接口',
  )
}

const host = (() => {
  try {
    return new URL(base).hostname
  } catch {
    return ''
  }
})()
const loopback = /^(127\.0\.0\.1|localhost|\[?::1\]?)$/i.test(host)
check(
  '不能是回环地址（手机上那是「手机自己」）',
  !loopback,
  loopback ? `${host} 装到手机后只会说「连不上服务器」` : host,
)

if (!/^https?:\/\//i.test(base)) {
  console.log('\n地址形状就不对，后面的检查跳过。\n')
  process.exit(1)
}

/* ---------------- ② 连得上 + 证书可信 ---------------- */
const CERT_HINTS = [
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'CERT_HAS_EXPIRED',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
]

async function tryFetch(url, init) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) })
    return { ok: true, res }
  } catch (e) {
    const code = e?.cause?.code || e?.code || ''
    return { ok: false, code, message: e?.cause?.message || e?.message || String(e) }
  }
}

const ping = await tryFetch(base + '/api/ping', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})

if (!ping.ok) {
  const cert = CERT_HINTS.some((c) => String(ping.code).includes(c))
  check(
    cert ? '证书不被信任（WebView 不会给「继续访问」）' : '连不上',
    false,
    `${ping.code || ''} ${ping.message}`.trim(),
  )
  console.log('\n✗ 地址不通，后面的检查跳过。\n')
  process.exit(1)
}

const pingRes = ping.res
check('能连上（/api/ping）', true, `HTTP ${pingRes.status}`)
check('没有被重定向到别处', !pingRes.redirected, pingRes.redirected ? `最终落到 ${pingRes.url}` : '')

const pingText = await pingRes.text()
let pingJson = null
try {
  pingJson = JSON.parse(pingText)
} catch {
  /* 不是 JSON */
}
check(
  '回包是我们的 API（JSON，带 code 字段）',
  !!pingJson && typeof pingJson.code === 'number',
  pingJson ? `code=${pingJson.code}` : `拿到的是 ${pingText.slice(0, 60).replace(/\s+/g, ' ')}…（网关错误页？）`,
)
check('业务码是 200', pingJson?.code === 200, pingJson ? `code=${pingJson.code}` : '')

/* ---------------- ③ CORS：两个 Origin 都要过 ---------------- */
/* Android（Capacitor 6+ 默认 androidScheme=https）发 `https://localhost`；
   iOS 发 `capacitor://localhost`。**这两个不在白名单里，APK 里登录必失败**，
   而浏览器只会报「连不上服务器」—— 看不出是 CORS。
   服务端 configs/config.yaml 的 CorsSettings.AllowOrigins 要放行前者，
   CustomSchemas 要登记 `capacitor://`（否则 gin-contrib/cors 启动就 panic）。 */
const ORIGINS = [
  ['Android（https://localhost）', 'https://localhost'],
  ['iOS（capacitor://localhost）', 'capacitor://localhost'],
]

for (const [label, origin] of ORIGINS) {
  const r = await tryFetch(base + '/api/auth/login', {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })
  if (!r.ok) {
    check(`CORS 预检 · ${label}`, false, r.code || r.message)
    continue
  }
  const got = r.res.headers.get('access-control-allow-origin')
  check(
    `CORS 预检 · ${label}`,
    got === origin || got === '*',
    got ? `Allow-Origin=${got}` : '没有 Access-Control-Allow-Origin（白名单里没这个 Origin）',
  )
}

/* ---------------- ④ 真实请求也得带 ACAO ---------------- */
/* 预检过了不等于实际响应过了：gin-contrib/cors 在预检和实际响应上分别加头，
   配错成 `AllowOrigins` 之外的自定义 Origin 时，只有预检那一条会绿。 */
const loginTry = await tryFetch(base + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://localhost' },
  /* 故意用不存在的账号：**不写任何数据**，只验回包头 */
  body: JSON.stringify({ mobile: '00000000000', password: '__check__' }),
})
if (!loginTry.ok) {
  check('真实 POST 带 CORS 头', false, loginTry.code || loginTry.message)
} else {
  const acao = loginTry.res.headers.get('access-control-allow-origin')
  check(
    '真实 POST 也带 Access-Control-Allow-Origin',
    acao === 'https://localhost' || acao === '*',
    acao ? `Allow-Origin=${acao}` : '预检过了但实际响应没有 —— WebView 会把它当跨域失败',
  )
  const t = await loginTry.res.text()
  let j = null
  try {
    j = JSON.parse(t)
  } catch {
    /* 非 JSON */
  }
  /* 这里**必须**失败（账号不存在 / 密码错），只要不是「连不上」就说明链路通 */
  check(
    '登录接口能返回业务错误（说明鉴权链路是通的）',
    !!j && typeof j.code === 'number',
    j ? `code=${j.code}${j.error ? ' ' + j.error : ''}` : `非 JSON：${t.slice(0, 60)}`,
  )
}

/* ---------------- ⑤ 游戏目录地址（配了才查） ---------------- */
/* 「从服务器下载」那块游戏的目录地址是**编译期**变量 `VITE_GAME_CATALOG_URL`。
   它和 `VITE_API_BASE` 是两个独立的地址（目录将来会挪到 CDN / OSS），所以
   配错了 `VITE_API_BASE` 全绿也说明不了它没问题。

   症状很隐蔽：App 一切正常，只有「设置 → 游戏」里那块要么整块不出现
   （地址为空），要么写一句「目录没拉下来」。家长会理解成「服务器上没有游戏」。

   三条判据和主地址一样：https、不是回环、拉得下来且签名能验（只验形状，
   验签要公钥，那是客户端的事 —— 这里只确认「拿到的是一份 JSON 目录」）。 */
const catLine = ['.env.apk', '.env.production']
  .filter((f) => fs.existsSync(f))
  .map((f) => ({
    f,
    v: fs
      .readFileSync(f, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('VITE_GAME_CATALOG_URL=')),
  }))
  .find((x) => x.v)

if (!catLine) {
  console.log('\n· 没有配 VITE_GAME_CATALOG_URL —— 打出来的包里没有「从服务器下载」这一块')
} else {
  const catUrl = catLine.v
    .slice('VITE_GAME_CATALOG_URL='.length)
    .replace(/^["']|["']$/g, '')
    .trim()
  console.log(`\n游戏目录：${catUrl}（来自 ${catLine.f}）\n`)
  const catHttps = /^https:\/\//i.test(catUrl)
  check('目录地址是 https', catHttps, catHttps ? '' : 'WebView 会拦掉 http')
  const catHost = (() => {
    try {
      return new URL(catUrl).hostname
    } catch {
      return ''
    }
  })()
  check(
    '目录地址不是回环',
    !/^(127\.0\.0\.1|localhost|\[?::1\]?)$/i.test(catHost),
    catHost || '解析不出主机名',
  )
  const catTry = await tryFetch(catUrl)
  if (!catTry.ok) {
    check('目录拉得下来', false, catTry.code || catTry.message)
  } else {
    const t = await catTry.res.text()
    let j = null
    try {
      j = JSON.parse(t)
    } catch {
      /* 非 JSON */
    }
    check('目录拉得下来', catTry.res.status === 200, `HTTP ${catTry.res.status}`)
    check(
      '是一份目录（JSON，带 games 数组）',
      !!j && Array.isArray(j.games),
      j ? `${j.games?.length ?? 0} 款` : `拿到的是 ${t.slice(0, 60).replace(/\s+/g, ' ')}…`,
    )
    /* 包地址和目录地址**不同源**是常态（CDN），所以单独看一眼第一款包的协议 */
    const firstPkg = j?.games?.[0]?.url
    if (firstPkg) {
      check(
        '包地址也是 https',
        /^https:\/\//i.test(firstPkg),
        firstPkg.slice(0, 70),
      )
    }
  }
}

/* ---------------- 汇总 ---------------- */
const bad = results.filter((r) => !r.ok)
console.log('')
if (bad.length === 0) {
  console.log(`✅ ${results.length} 项全过。可以打 APK 了：`)
  console.log('     bash scripts/build-apk.sh release')
  console.log('')
  process.exit(0)
}
console.log(`✗ ${bad.length}/${results.length} 项没过：`)
for (const b of bad) console.log('   · ' + b.name)
console.log('')
process.exit(1)
