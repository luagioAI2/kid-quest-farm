#!/usr/bin/env node
/**
 * 本地演示：让「从**已签名目录**安装一款游戏」这条链**真的在浏览器里跑一遍**。
 *
 *     node scripts/demo-catalog.mjs            # 准备 + 构建（用演示钥匙）+ 起目录服务
 *     node scripts/demo-catalog.mjs --serve    # 只起服务（已经构建过）
 *
 * ## 它做了什么
 *
 * 1. 生成一把**演示用**的 Ed25519 钥匙（`.e2e-scratch/demo-catalog/`，已 gitignore）；
 * 2. 把 `games-dist/demo.js`（`npm run build:games` 的真实产物）当作要下发的包，
 *    算它的 SHA-256，写进 `catalog.json`，再用演示私钥**签名**；
 * 3. **临时**把演示公钥写进 `src/games/catalogKey.ts`、把本地目录地址写进
 *    `src/games/catalogUrl.ts`，`npm run build`，然后**立刻还原**（还原后逐字节 `cmp`）；
 * 4. 起一个静态服务，**发 CORS 头**，同时托管三套东西：
 *
 *      /catalog.json          正常的一份   → 应该装得上
 *      /tampered/…            目录是**正确签名**的，但服务器上的包被换过
 *                             → 应该报 **SHA-256 对不上**
 *      /forged/…              目录用**另一把私钥**签的
 *                             → 应该报 **签名对不上**
 *
 *   后两套是**故意准备的**：一个「只会成功」的演示证明不了任何事。
 *
 * ## 为什么公钥是临时改、改完立刻还原
 *
 * 演示钥匙**绝不能**变成产品钥匙（它就在仓库旁边的 scratch 里）。
 * 所以：改 → 构建 → **马上还原**，让仓库里的 `catalogKey.ts` 始终是
 * 「空 = fail closed」那个真实状态。带演示公钥的只有 `dist/`。
 * ⚠️ 因此**演示完之后如果你重新 `npm run build`**，下载功能就又回到「不可用」——
 * 那是**对的**，不是坏了。
 *
 * ## 签名用的是**生产那套代码**
 *
 * 这里直接 import `sign-catalog.mjs` 的 `generateKeypair` / `signCatalogFile`，
 * 不另写一份 —— 否则「演示能过、真实工具不行」这种走散会一直藏着。
 */

import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateKeypair, sha256File, signCatalogFile } from './sign-catalog.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const WORK = join(ROOT, '.e2e-scratch/demo-catalog')
const KEY_PATH = join(WORK, 'demo-private.pem')
const FORGED_KEY_PATH = join(WORK, 'forged-private.pem')
const CATALOG_KEY_TS = join(ROOT, 'src/games/catalogKey.ts')
const CATALOG_URL_TS = join(ROOT, 'src/games/catalogUrl.ts')
const GAME_BUNDLE = join(ROOT, 'games-dist/demo.js')

const PORT = Number(process.env.DEMO_PORT ?? 4391)
const APP_PORT = Number(process.env.APP_PORT ?? 4390)

/** 目录里那一款游戏。id / name / version 要和 `games-dist/demo.js` 的 manifest 对得上。 */
const GAME_ID = 'demo'
const GAME_NAME = '许愿池'
const GAME_VERSION = '1.0.0'

const log = (...a) => console.log(...a)

/* ------------------------------------------------------------------ *
 * ① 钥匙
 * ------------------------------------------------------------------ */

function loadOrCreateKey(path, label) {
  if (existsSync(path)) {
    log(`   · 复用已有的${label}钥匙`)
    return { pem: readFileSync(path, 'utf8'), created: false }
  }
  return { pem: null, created: true, label }
}

async function ensureKeys() {
  mkdirSync(WORK, { recursive: true })

  let demo = loadOrCreateKey(KEY_PATH, '演示')
  if (demo.created) {
    const kp = await generateKeypair()
    writeFileSync(KEY_PATH, kp.privatePem)
    writeFileSync(join(WORK, 'demo-public.txt'), `${kp.publicRawB64}\n`)
    demo = { pem: kp.privatePem, publicB64: kp.publicRawB64 }
    log('   · 生成演示钥匙（公钥写进 dist，私钥留在 scratch）')
  } else {
    // 已有私钥 ⇒ 从它重新导出公钥，保证两边一致
    const { publicRawB64 } = await publicFromPrivate(demo.pem)
    demo.publicB64 = publicRawB64
  }

  let forged = loadOrCreateKey(FORGED_KEY_PATH, '伪造')
  if (forged.created) {
    const kp = await generateKeypair()
    writeFileSync(FORGED_KEY_PATH, kp.privatePem)
    forged = { pem: kp.privatePem }
    log('   · 生成「另一把」钥匙（用来演示签名被拒）')
  }
  return { demo, forged }
}

/** 从私钥导出公钥（原始 32 字节 → base64）。 */
async function publicFromPrivate(privatePem) {
  const body = privatePem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  const der = Uint8Array.from(Buffer.from(body, 'base64'))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'Ed25519' }, true, ['sign'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', await publicOf(key)))
  return { publicRawB64: Buffer.from(raw).toString('base64') }
}

/** 从 PKCS8 私钥算出公钥（Node 的 WebCrypto 不支持直接导出公钥，用 JWK 中转）。 */
async function publicOf(privateKey) {
  const jwk = await crypto.subtle.exportKey('jwk', privateKey)
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, crv: jwk.crv, x: jwk.x },
    { name: 'Ed25519' },
    true,
    ['verify'],
  )
}

/* ------------------------------------------------------------------ *
 * ② 造目录（正常 / 被换包 / 被伪造）
 * ------------------------------------------------------------------ */

async function buildCatalog(dir, { sha256, size, signWithPem }) {
  mkdirSync(dir, { recursive: true })
  const catalogPath = join(dir, 'catalog.json')
  writeFileSync(
    catalogPath,
    `${JSON.stringify(
      {
        version: 1,
        games: [
          {
            id: GAME_ID,
            name: GAME_NAME,
            version: GAME_VERSION,
            url: './demo.js',
            sha256,
            size,
          },
        ],
      },
      null,
      2,
    )}\n`,
  )
  const { signatureB64 } = await signCatalogFile(catalogPath, signWithPem)
  writeFileSync(`${catalogPath}.sig`, `${signatureB64}\n`)
  return catalogPath
}

async function buildAll({ demo, forged }) {
  if (!existsSync(GAME_BUNDLE)) {
    throw new Error(`找不到 ${GAME_BUNDLE} —— 先跑 \`npm run build:games\``)
  }
  const bundle = readFileSync(GAME_BUNDLE)
  const { hex, size } = await sha256File(GAME_BUNDLE)
  log(`   · 包 ${GAME_ID}.js：${size} 字节，sha256 ${hex.slice(0, 16)}…`)

  // ── 正常：目录和包一致，签名正确
  const good = join(WORK, 'good')
  mkdirSync(good, { recursive: true })
  writeFileSync(join(good, 'demo.js'), bundle)
  await buildCatalog(good, { sha256: hex, size, signWithPem: demo.pem })

  // ── 被换包：目录**签名正确**（还是说「包应该是 good 那份」），
  //    但服务器上摆的是被改过的包 ⇒ 验哈希这一步必须拦住。
  const tampered = join(WORK, 'tampered')
  mkdirSync(tampered, { recursive: true })
  writeFileSync(
    join(tampered, 'demo.js'),
    Buffer.concat([
      bundle,
      Buffer.from('\n// ← 演示：这一行是服务器上被人塞进去的\nconsole.log("被篡改的包真的跑了")\n'),
    ]),
  )
  await buildCatalog(tampered, { sha256: hex, size, signWithPem: demo.pem })

  // ── 被伪造：目录内容一模一样，但用**另一把私钥**签 ⇒ 验签必须拦住。
  const forgedDir = join(WORK, 'forged')
  mkdirSync(forgedDir, { recursive: true })
  writeFileSync(join(forgedDir, 'demo.js'), bundle)
  await buildCatalog(forgedDir, { sha256: hex, size, signWithPem: forged.pem })

  return { good, tampered, forged: forgedDir }
}

/* ------------------------------------------------------------------ *
 * ③ 临时换公钥 + 目录地址 → 构建 → 立刻还原
 * ------------------------------------------------------------------ */

/**
 * 把演示钥匙和本地目录地址**临时**写进源码，构建，然后还原。
 *
 * ⚠️ 两个常量都要改：只换公钥、不写 `CATALOG_URL` 的话，设置页那一栏会停在
 *    「这个版本没有配置游戏商店」—— 因为 `CATALOG_URL` 空着就是**没配**。
 *    （这正是 fail closed 该有的样子，不是 bug。）
 */
function buildWithDemoKey(publicB64) {
  const keyOriginal = readFileSync(CATALOG_KEY_TS)
  const urlOriginal = readFileSync(CATALOG_URL_TS)
  const keyBefore = keyOriginal.toString()
  const urlBefore = urlOriginal.toString()

  const KEY_ANCHOR = "export const CATALOG_PUBLIC_KEY_B64 = ''"
  const URL_ANCHOR = "export const CATALOG_URL = ''"
  // 锚点必须**唯一**：多一处就说明有人复制了常量，那样替换会改错地方
  for (const [anchor, text] of [
    [KEY_ANCHOR, keyBefore],
    [URL_ANCHOR, urlBefore],
  ]) {
    if (text.split(anchor).length - 1 !== 1) {
      throw new Error(`锚点不唯一，拒绝改：${anchor}`)
    }
  }

  const demoCatalogUrl = `http://127.0.0.1:${PORT}/catalog.json`
  try {
    writeFileSync(CATALOG_KEY_TS, keyBefore.replace(KEY_ANCHOR, `export const CATALOG_PUBLIC_KEY_B64 = '${publicB64}'`))
    writeFileSync(CATALOG_URL_TS, urlBefore.replace(URL_ANCHOR, `export const CATALOG_URL = '${demoCatalogUrl}'`))
    log(`   · 临时写入演示公钥 + 目录地址（${demoCatalogUrl}），开始构建…`)
    execFileSync('npm', ['run', 'build'], {
      cwd: ROOT,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, CODEBUDDY_SAFE_DELETE_ENABLED: '0' },
    })
  } finally {
    writeFileSync(CATALOG_KEY_TS, keyOriginal)
    writeFileSync(CATALOG_URL_TS, urlOriginal)
    if (readFileSync(CATALOG_KEY_TS).toString() !== keyBefore) {
      throw new Error('还原失败！catalogKey.ts 内容和改之前不一致')
    }
    if (readFileSync(CATALOG_URL_TS).toString() !== urlBefore) {
      throw new Error('还原失败！catalogUrl.ts 内容和改之前不一致')
    }
    log('   · 已还原 catalogKey.ts / catalogUrl.ts（逐字节确认一致）')
  }
}

/* ------------------------------------------------------------------ *
 * ④ 静态服务（发 CORS 头）
 * ------------------------------------------------------------------ */

const TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.sig': 'text/plain; charset=utf-8',
}

function serve(dirs) {
  const routes = new Map()
  const add = (url, file) => routes.set(url, file)

  add('/catalog.json', join(dirs.good, 'catalog.json'))
  add('/catalog.json.sig', join(dirs.good, 'catalog.json.sig'))
  add('/demo.js', join(dirs.good, 'demo.js'))
  add('/tampered/catalog.json', join(dirs.tampered, 'catalog.json'))
  add('/tampered/catalog.json.sig', join(dirs.tampered, 'catalog.json.sig'))
  add('/tampered/demo.js', join(dirs.tampered, 'demo.js'))
  add('/forged/catalog.json', join(dirs.forged, 'catalog.json'))
  add('/forged/catalog.json.sig', join(dirs.forged, 'catalog.json.sig'))
  add('/forged/demo.js', join(dirs.forged, 'demo.js'))

  const server = createServer((req, res) => {
    // ★★ 这一行就是 spec §12.3 说的「托管侧必须发 CORS 头」。
    //    少了它，浏览器把响应整个挡掉，`fetch` 只抛一句
    //    `TypeError: Failed to fetch` —— 看不出是跨域。
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Cache-Control', 'no-store')

    const path = (req.url ?? '/').split('?')[0]
    const file = routes.get(path)
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end(`没有 ${path}\n`)
      return
    }
    const ext = file.slice(file.lastIndexOf('.'))
    res.writeHead(200, { 'Content-Type': TYPES[ext] ?? 'application/octet-stream' })
    res.end(readFileSync(file))
  })

  return new Promise((ok, no) => {
    server.once('error', no)
    server.listen(PORT, '127.0.0.1', () => ok(server))
  })
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

const serveOnly = process.argv.includes('--serve')

log('\n── 准备演示目录 ──')
const { demo, forged } = await ensureKeys()
const dirs = await buildAll({ demo, forged })

if (!serveOnly) {
  log('\n── 用演示公钥构建 App ──')
  buildWithDemoKey(demo.publicB64)
} else {
  log('\n（--serve：跳过构建，直接用现有 dist）')
}

await serve(dirs)
const base = `http://127.0.0.1:${PORT}`

log(`
══════════════════════════════════════════════════════════════
  演示目录已经起来了（发 CORS 头）

  ① 另开一个终端起 App：
       CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port ${APP_PORT} --strictPort
  ② 浏览器打开 http://localhost:${APP_PORT}
  ③ 打开控制台（F12），粘这三条，一条一条试：

  应该成功：
    await __kqf__.plugin.installFromCatalog('${base}/catalog.json', '${GAME_ID}')

  应该失败 —— 服务器上的包被换过（哈希对不上）：
    await __kqf__.plugin.installFromCatalog('${base}/tampered/catalog.json', '${GAME_ID}')

  应该失败 —— 目录不是我们签的（签名对不上）：
    await __kqf__.plugin.installFromCatalog('${base}/forged/catalog.json', '${GAME_ID}')

  装成功之后：设置 → 游戏 → 「已下载」里会多出「${GAME_NAME}」，
  可以直接切过去玩（那是个真的能玩的小游戏）。

  想再看一遍「装成功」：先在设置里卸载，或者刷新页面重跑第一条。
══════════════════════════════════════════════════════════════
`)

// 常驻，Ctrl-C 退出
process.on('SIGINT', () => {
  log('\n目录服务已停。')
  process.exit(0)
})
