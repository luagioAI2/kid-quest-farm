#!/usr/bin/env node
/**
 * catalog 的**签名工具**（spec §12.4 条件 3）。
 *
 *      node scripts/sign-catalog.mjs keygen            # 生成密钥对
 *      node scripts/sign-catalog.mjs sha <包文件…>      # 算 SHA-256（填 catalog 用）
 *      node scripts/sign-catalog.mjs sign <catalog.json>   # 产出 catalog.json.sig
 *      node scripts/sign-catalog.mjs verify <catalog.json> [sig]  # 自检
 *
 * ── 为什么私钥不进仓库 ──────────────────────────────────────────────
 *
 * 私钥 = 「我是这个 App 的作者」这个身份。它进了仓库，任何能读到仓库的人
 * 都能签一个「官方」的包 —— 而客户端**只认签名**，验签通过就执行。
 * 所以 `keygen` 把私钥写到 `catalog-keys/`（已在 .gitignore 里），
 * 且**已经存在就拒绝覆盖**（覆盖 = 永久丢掉签名身份，旧包再也签不出同一把）。
 *
 * 公钥则**必须**进仓库 —— 它烧进 APK（`src/games/catalogKey.ts`）。
 *
 * ── 这个文件为什么导出了函数 ────────────────────────────────────────
 *
 * 它同时被 `src/games/verify.test.ts` import，用来证明
 * **「签名工具产出的签名」和「App 里的验签」是同一种东西**。
 * 这两个实现一旦走散（比如签名吃的是 `JSON.stringify` 之后的字节、
 * 而 App 验的是文件原始字节），症状是「本地签得好好的，装上就验不过」——
 * 而且**零报错**，只会说「签名对不上」。所以那一条判据是钉着的。
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** 私钥落盘的位置（相对仓库根）。已 gitignore。 */
export const KEY_DIR = 'catalog-keys'
export const PRIVATE_KEY_PATH = join(KEY_DIR, 'catalog-private.pkcs8.pem')

const subtle = () => {
  const s = globalThis.crypto?.subtle
  if (!s) throw new Error('这个 Node 没有 WebCrypto —— 需要 Node 18+（实测 22 可用）')
  return s
}

const ED25519 = { name: 'Ed25519' }

const b64 = (bytes) => Buffer.from(bytes).toString('base64')
const fromB64 = (s) => new Uint8Array(Buffer.from(s.trim(), 'base64'))

/* ------------------------------------------------------------------ *
 * keygen
 * ------------------------------------------------------------------ */

/**
 * 生成一对 Ed25519 密钥。
 * @returns {{ privatePem: string, publicRawB64: string, publicPem: string }}
 */
export async function generateKeypair() {
  const kp = await subtle().generateKey(ED25519, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', kp.privateKey))
  const spki = new Uint8Array(await subtle().exportKey('spki', kp.publicKey))
  const raw = new Uint8Array(await subtle().exportKey('raw', kp.publicKey))
  if (raw.byteLength !== 32) throw new Error(`公钥应是 32 字节，实际 ${raw.byteLength}`)
  return {
    privatePem: pem('PRIVATE KEY', pkcs8),
    publicRawB64: b64(raw),
    publicPem: pem('PUBLIC KEY', spki),
  }
}

/** 包成 PEM（顺带让 openssl 也能读，方便以后换工具）。 */
function pem(label, der) {
  const body = b64(der).replace(/(.{64})/g, '$1\n').replace(/\n$/, '')
  return `-----BEGIN ${label}-----\n${body}\n-----END ${label}-----\n`
}

function pemToDer(text) {
  const body = text.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '')
  if (!body) throw new Error('PEM 里没有内容')
  return fromB64(body)
}

/* ------------------------------------------------------------------ *
 * sha256
 * ------------------------------------------------------------------ */

/** 一个文件的 SHA-256（小写 hex）。**吃文件原始字节**，不做任何解码。 */
export async function sha256File(path) {
  const bytes = new Uint8Array(readFileSync(path))
  const d = await subtle().digest('SHA-256', bytes)
  return {
    hex: [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join(''),
    size: bytes.byteLength,
  }
}

/* ------------------------------------------------------------------ *
 * sign / verify
 * ------------------------------------------------------------------ */

/**
 * 签一个 catalog 文件。
 *
 * ★★ 签名吃的是**文件的原始字节**（`readFileSync` 拿到的 Buffer），
 * 不是 `JSON.parse` 再序列化的结果。App 那边验的也是取回来的原始字节
 * （`verify.ts` 文件头 ①）。两边必须对同一串字节操作 ——
 * 只要有一边做了「解析 → 重新序列化」，键序/空格/BOM 一变签名就废，
 * 而且报的是「签名对不上」，看着像被攻击了。
 *
 * @returns {Promise<{ signatureB64: string, bytes: number }>}
 */
export async function signCatalogFile(catalogPath, privateKeyPem) {
  const bytes = new Uint8Array(readFileSync(catalogPath))
  const key = await subtle().importKey('pkcs8', pemToDer(privateKeyPem), ED25519, false, ['sign'])
  const sig = new Uint8Array(await subtle().sign(ED25519, key, bytes))
  return { signatureB64: b64(sig), bytes: bytes.byteLength }
}

/** 验一个 catalog 文件的签名（工具侧自检用；App 侧是 `verify.ts`）。 */
export async function verifyCatalogFile(catalogPath, signatureB64, publicRawB64) {
  const bytes = new Uint8Array(readFileSync(catalogPath))
  const key = await subtle().importKey('raw', fromB64(publicRawB64), ED25519, false, ['verify'])
  return subtle().verify(ED25519, key, fromB64(signatureB64), bytes)
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function usage() {
  console.log(`用法：
  node scripts/sign-catalog.mjs keygen
  node scripts/sign-catalog.mjs sha <包文件…>
  node scripts/sign-catalog.mjs sign <catalog.json>
  node scripts/sign-catalog.mjs verify <catalog.json> [catalog.json.sig]

  sign 会写出 <catalog.json>.sig，并**立刻自检一遍**。`)
}

async function cmdKeygen() {
  if (existsSync(PRIVATE_KEY_PATH)) {
    console.error(
      `✗ ${PRIVATE_KEY_PATH} 已经存在，**拒绝覆盖**。\n` +
        '  覆盖 = 永久丢掉这把签名身份：以后签的包，装着旧公钥的 App 全都验不过。\n' +
        '  确实要换新钥匙：先把旧文件**备份到仓库外**，再手动删掉它。',
    )
    process.exit(2)
  }
  const { privatePem, publicRawB64, publicPem } = await generateKeypair()
  mkdirSync(KEY_DIR, { recursive: true })
  writeFileSync(PRIVATE_KEY_PATH, privatePem, { mode: 0o600 })
  writeFileSync(join(KEY_DIR, 'catalog-public.spki.pem'), publicPem)
  console.log(`✓ 私钥已写到 ${PRIVATE_KEY_PATH}（已 gitignore，别提交、别丢）`)
  console.log(`✓ 公钥（SPKI PEM）写到 ${join(KEY_DIR, 'catalog-public.spki.pem')}`)
  console.log('\n把下面这行粘进 src/games/catalogKey.ts 的 CATALOG_PUBLIC_KEY_B64：\n')
  console.log(publicRawB64)
  console.log(
    '\n⚠️ 公钥一改，**已经装出去的 APK 就认不了新签名的包** —— 换公钥 = 换版本，' +
      '要跟发版一起走。',
  )
}

async function cmdSha(files) {
  for (const f of files) {
    const { hex, size } = await sha256File(f)
    console.log(`${hex}  ${size.toString().padStart(10)}  ${f}`)
  }
  console.log('\n填进 catalog.json 的 `sha256` / `size` 字段（size 只做提示，不参与校验）。')
}

async function cmdSign(catalogPath) {
  if (!existsSync(PRIVATE_KEY_PATH)) {
    console.error(`✗ 找不到私钥 ${PRIVATE_KEY_PATH} —— 先跑 keygen。`)
    process.exit(2)
  }
  const pemText = readFileSync(PRIVATE_KEY_PATH, 'utf8')
  const { signatureB64, bytes } = await signCatalogFile(catalogPath, pemText)
  const sigPath = `${catalogPath}.sig`
  writeFileSync(sigPath, `${signatureB64}\n`)
  console.log(`✓ 已签 ${catalogPath}（${bytes} 字节）→ ${basename(sigPath)}`)

  // ★ 签完立刻自检：拿刚写出去的公钥验一遍。keygen 之后忘了粘公钥、
  //   或者粘错了一把，都在这里当场发现，而不是等装到手机上。
  const pubPath = join(KEY_DIR, 'catalog-public.spki.pem')
  if (existsSync(pubPath)) {
    // 从 SPKI 反推 raw 公钥：Ed25519 的 SPKI 尾部 32 字节就是原始公钥。
    const der = pemToDer(readFileSync(pubPath, 'utf8'))
    const raw = der.slice(der.byteLength - 32)
    const ok = await verifyCatalogFile(catalogPath, signatureB64, b64(raw))
    console.log(ok ? '✓ 自检：签名验得过' : '✗ 自检：签名**验不过**（别发出去）')
    if (!ok) process.exit(1)
  }
  console.log(
    '\n⚠️ 把 catalog.json 和 catalog.json.sig **一起**传上去。' +
      '改了 catalog 却忘了重签，客户端会直接拒用（这是设计如此，不是 bug）。',
  )
}

async function cmdVerify(catalogPath, sigPath) {
  const sp = sigPath ?? `${catalogPath}.sig`
  if (!existsSync(sp)) {
    console.error(`✗ 找不到签名文件 ${sp}`)
    process.exit(2)
  }
  const pubPath = join(KEY_DIR, 'catalog-public.spki.pem')
  if (!existsSync(pubPath)) {
    console.error(`✗ 找不到公钥 ${pubPath} —— 先跑 keygen。`)
    process.exit(2)
  }
  const der = pemToDer(readFileSync(pubPath, 'utf8'))
  const raw = der.slice(der.byteLength - 32)
  const sigB64 = readFileSync(sp, 'utf8')
  const ok = await verifyCatalogFile(catalogPath, sigB64, b64(raw))
  console.log(ok ? `✓ ${catalogPath} 的签名有效` : `✗ ${catalogPath} 的签名**无效**`)
  if (!ok) process.exit(1)
}

/* 只有被当脚本直接跑时才走 CLI；被 import（单测）时什么都不做。 */
const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isCli) {
  const [mode, ...rest] = process.argv.slice(2)
  // ⚠️ 这里**不能**写 `return usage(), process.exit(2)` —— ESM 模块顶层
  // 不允许 `return`，那是**解析期**错误，整个文件一行都跑不了
  // （症状是所有子命令都报 Illegal return statement，而不是某个模式不好使）。
  const needArgs = (n) => {
    if (rest.length < n) {
      usage()
      process.exit(2)
    }
  }
  try {
    if (mode === 'keygen') await cmdKeygen()
    else if (mode === 'sha') {
      needArgs(1)
      await cmdSha(rest)
    } else if (mode === 'sign') {
      needArgs(1)
      await cmdSign(rest[0])
    } else if (mode === 'verify') {
      needArgs(1)
      await cmdVerify(rest[0], rest[1])
    } else {
      usage()
      if (mode) process.exit(2)
    }
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
}
