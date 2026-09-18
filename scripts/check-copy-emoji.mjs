/**
 * 检查按钮 / 可交互控件的文案：emoji 必须在**前面**。
 *
 *   node scripts/check-copy-emoji.mjs
 *
 * 退出码 0 = 干净；1 = 有尾随 emoji 的控件文案（并逐条打印出来）。
 *
 * ── 为什么不用 grep ──────────────────────────────────────────
 * 踩过两个判据陷阱，都会让结果**静默变假**：
 *
 * ① **逐行正则会漏掉跨行的 JSX 文本节点。** JSX 文本可以跨行：
 *      <button>
 *        我放弃了 🥲
 *      </button>
 *    `>([^<>{}]+)<` 在一行内匹配，`>` 和文本之间隔着换行就抓不到。
 *    实测漏掉了 `TaskDetail.tsx` 的「我放弃了 🥲」。
 *
 * ② **只看 `JsxText` 会漏掉 `{}` 里的字符串字面量。** 而且不能只看直接父节点：
 *      {busy ? '…' : inst.status === 'expired' ? '🌟 现在补做掉' : '✅ 我做完啦！'}
 *    字符串的父节点是 `ConditionalExpression`，不是 `JsxExpression` —— 要**向上找**。
 *    实测漏掉了整条。
 *
 * ③ 另外，**本机 git-bash 的 grep 匹配不了非 BMP 的 emoji**（U+1F3E1 这类）：
 *    同一批模式里只有 U+2705（BMP）能匹配，U+1F3E1 / U+1F389 / U+1F4EE 全部静默返回空。
 *    所以「没搜到」既可能是真的不在，也可能是判据根本匹配不上 ——
 *    **这类检查一律用 node 当裁判，不要用 grep。**
 *
 * ── 口径 ────────────────────────────────────────────────────
 * 只管**可交互控件**（button / Btn / TabButton / TabBtn / Link，以及
 * aria-label / title / placeholder）。`<p>` 里的散文**不管** ——
 * 「这次先跳过了，明天见 👋」这种句子尾随 emoji 是正常中文写法。
 */
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = path.join(process.cwd(), 'src')
const files = []
;(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.tsx$/.test(e.name)) files.push(p)
  }
})(root)

const PICTO = /\p{Extended_Pictographic}/u
const CONTROL = new Set(['button', 'Btn', 'TabButton', 'TabBtn', 'Link'])
const ATTRS = new Set(['aria-label', 'title', 'placeholder'])

const bad = []
let checked = 0

function classify(txt) {
  const chars = [...txt]
  const head = PICTO.test(chars[0])
  const tail = PICTO.test(chars[chars.length - 1])
  if (head && tail) return 'ICON' // 纯 emoji，位置无关
  if (head) return 'HEAD'
  if (tail) return 'TAIL'
  return null
}

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const rel = path.relative(process.cwd(), f).split(path.sep).join('/')

  function ownerOf(node) {
    let p = node.parent
    while (p) {
      if (ts.isJsxElement(p)) return p.openingElement.tagName.getText(sf)
      if (ts.isJsxSelfClosingElement(p)) return p.tagName.getText(sf)
      if (ts.isJsxAttribute(p)) return '@' + p.name.getText(sf)
      p = p.parent
    }
    return '?'
  }

  function record(node, txt) {
    const pos = classify(txt)
    if (!pos || pos === 'ICON') return
    const owner = ownerOf(node)
    const isAttr = owner.startsWith('@')
    if (!isAttr && !CONTROL.has(owner)) return
    if (isAttr && !ATTRS.has(owner.slice(1))) return
    checked++
    if (pos === 'TAIL') {
      const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
      bad.push({ file: rel, line: line + 1, owner, text: txt })
    }
  }

  function visit(node) {
    if (ts.isJsxText(node)) {
      const txt = node.text.replace(/\s+/g, ' ').trim()
      if (txt) record(node, txt)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // 向上找，遇到 JSX 元素 / 语句 / 函数边界就停 —— 不能只看直接父节点。
      let inJsx = false
      let p = node.parent
      while (p) {
        if (ts.isJsxExpression(p) || ts.isJsxAttribute(p)) { inJsx = true; break }
        if (ts.isJsxElement(p) || ts.isJsxSelfClosingElement(p) || ts.isJsxFragment(p)) break
        if (ts.isStatement(p) || ts.isFunctionLike(p) || ts.isSourceFile(p)) break
        p = p.parent
      }
      if (inJsx) {
        const txt = node.text.replace(/\s+/g, ' ').trim()
        if (txt) record(node, txt)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

console.log('检查了 ' + checked + ' 条控件文案（' + files.length + ' 个 tsx 文件）')

if (bad.length === 0) {
  console.log('✅ 没有尾随 emoji 的控件文案')
  process.exit(0)
}

console.log('\n❌ 这些控件文案的 emoji 在后面，应该挪到前面：')
for (const r of bad) {
  console.log('  <' + r.owner + '>  ' + r.file + ':' + r.line + '  ' + JSON.stringify(r.text))
}
process.exit(1)
