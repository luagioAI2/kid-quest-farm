#!/usr/bin/env node
/* 本地测试用的静态服务 + `/gva` 反向代理（2026-11-13）。
 *
 * ## 为什么需要代理
 *
 * 后台（tf-admin）的 axios 基址是**相对路径** `/gva`（部署时 `VITE_BASE_API=/gva`
 * 编进去的，见 deploy/tf-vps/build.sh）。本地起个静态服务的话，
 * `/gva/base/captcha` 会被 SPA 兜底成 index.html ⇒ 前端拿到 HTML 去 `JSON.parse`
 * ⇒ 登录页永远转圈，控制台只有一句「Unexpected token '<'」。
 *
 * 所以这里把 `/gva/` 转发到线上。**服务端到服务端**，不涉及 CORS。
 *
 * ## 只代理 `/gva/`，不代理 `/api/`
 *
 * App（`/app/`）里的接口地址是**构建期写死的绝对 URL**，本来就不经过这里。
 * 少代理一条路径 = 少一个"本地操作打到线上库"的入口。
 *
 * ## ⚠️ 重要：后台连的是**线上真库**
 *
 * `kidfarm.duckdns.org/gva` 背后是生产数据库。在这里点「删除用户」「下架游戏」
 * 会**真的改线上数据**。这个服务只是让你看界面、验布局 ——
 * 别拿它做破坏性操作。
 *
 *   node scripts/lib/local-server.mjs --dir <站点目录> --port 4391 [--target https://…]
 */
import { createServer } from 'node:http'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'

const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = argv.indexOf(name)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt
}

/** 目录分隔符要按运行平台取，别写死 '/' —— Windows 上 join 会混用两种斜杠。 */
const DIR = resolve(arg('--dir', '.'))
const PORT = Number(arg('--port', '4391'))
const TARGET = arg('--target', 'https://kidfarm.duckdns.org').replace(/\/+$/, '')

if (!existsSync(join(DIR, 'index.html'))) {
  console.error(`✗ ${DIR} 里没有 index.html —— 先构建`)
  process.exit(1)
}

/** 只有后台的接口前缀。见文件头「只代理 /gva/」。 */
const PROXY_PREFIXES = ['/gva/']

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.apk': 'application/vnd.android.package-archive',
}

function proxy(req, res) {
  const target = new URL(TARGET)
  const isHttps = target.protocol === 'https:'
  const doRequest = isHttps ? httpsRequest : httpRequest

  const headers = { ...req.headers }
  // 服务端到服务端，别把浏览器带来的 Origin 转过去（后端按它判 CORS）
  delete headers.origin
  delete headers.referer
  headers.host = target.host

  const up = doRequest(
    {
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: req.url,
      method: req.method,
      headers,
    },
    (upRes) => {
      const out = { ...upRes.headers }
      delete out['access-control-allow-origin']
      res.writeHead(upRes.statusCode ?? 502, out)
      upRes.pipe(res)
    },
  )

  up.on('error', (e) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`代理失败：${e.message}`)
  })

  req.pipe(up)
}

/* 把 URL 路径安全地映射到 DIR 下的文件（挡掉 `..` 穿越）。 */
function safeJoin(urlPath) {
  const clean = normalize(urlPath).replace(/^([/\\]|\.\.[/\\])+/, '')
  return join(DIR, clean)
}

/**
 * `/games/...` → `/app/games/...`（2026-11-13）。
 *
 * 客户端的 `localGames.ts` 里，随包游戏的地址是**相对文档根**的
 * `/games/xxx/xxx.plugin.mjs` —— 在 APK 里 App 就在根目录，所以能用。
 *
 * 但本地测试站把 App 挂在 `/app/` 下（为了同时给官网留出 `/`），
 * 于是 `/games/...` 会落到**网站根**、被 SPA 兜底成 `index.html`：
 *
 *   · 返回 HTTP **200**（不是 404，所以看起来一切正常）
 *   · 内容是首页 HTML
 *   · `fetchVerifiedPackage` 拿它算 SHA-256 ⇒ 与清单里的值对不上
 *   · `installLocalGame` 返回「SHA-256 对不上」
 *   · 激活码那条链把它包成「装包没成功，码没扣」
 *   · ⇒ 界面上**不弹激活成功框**，看着像「点了没反应」
 *
 * 这是本机跑出来的，线上 web 版同样存在（`/games/` 在线上是 404），
 * 但线上本来就该走目录下载、不依赖本地包，所以那只影响走查。
 * 这里补一条别名，让本地测试和 APK 里的解析结果一致。
 */
function aliasGamesToApp(urlPath) {
  return urlPath.startsWith('/games/') ? join('app', urlPath) : urlPath
}

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0])

  if (PROXY_PREFIXES.some((p) => url.startsWith(p))) return proxy(req, res)

  let file = safeJoin(aliasGamesToApp(url))
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')

  if (!existsSync(file)) {
    /* SPA 兜底要**落在同一前缀下**：
       `/app/xxx` → `app/index.html`、`/admin/xxx` → `admin/index.html`、
       其余 → 根 `index.html`。
       一律回落到根的话，在 `/app/` 里刷新会拿到官网首页（白屏但无报错）。 */
    const m = url.match(/^\/(app|admin)(\/|$)/)
    file = join(DIR, m ? m[1] : '', 'index.html')
  }
  if (!existsSync(file)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('404')
    return
  }

  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream'
  // 不缓存：本地测试要的是「改了就看到」
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
  createReadStream(file).pipe(res)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  本地服务：http://127.0.0.1:${PORT}`)
  console.log(`  静态目录：${DIR}`)
  console.log(`  /gva 代理：${TARGET}（后台接口，⚠️ 连的是线上真库）`)
  console.log(`  Ctrl+C 结束\n`)
})
