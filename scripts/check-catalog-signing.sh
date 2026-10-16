#!/usr/bin/env bash
#
# 验收 `scripts/sign-catalog.mjs` —— 签名工具本身对不对，以及它的守卫会不会咬人。
#
#     CODEBUDDY_SAFE_DELETE_ENABLED=0 bash scripts/check-catalog-signing.sh
#
# ── 为什么这个脚本值钱 ─────────────────────────────────────────────
#
# 签名链的失效方向**全是静默的**：
#   · 忘了重新签 → 客户端拒用，看着像「下载功能坏了」；
#   · 签名吃的是「解析后重新序列化」的字节、而 App 验的是原始字节
#     → 本地签得好好的，装到手机上验不过；
#   · keygen 覆盖了旧私钥 → 已经装出去的 App 永远验不了新包，**不可逆**。
#
# 所以这里不只测「能签能验」，还**故意把每一处弄坏**，确认它会红，
# 再把它弄回去，确认它会绿 —— 一个只会绿的探针证明不了任何事。
#
# 全程在 `.e2e-scratch/`（已 gitignore）里跑，仓库根不会多出 catalog-keys/。

set -u
# ⚠️ 用 `pwd -W` 拿 **Windows 形式**的绝对路径，不要用 `pwd`。
#
# 这台机器上 node 是**被包装过的**（WorkBuddy 的 fs shim），它**不做 MSYS 路径转换**：
# 传 `/e/plan/…/sign-catalog.mjs` 进去，它当成「当前盘符下的相对路径」解析成
# `E:\e\plan\…` —— 报 MODULE_NOT_FOUND，看着像脚本文件没了。
# `pwd` 给的是 `/e/plan/…`（POSIX），`pwd -W` 给的是 `E:/plan/…`（Node 认识）。
#
# 另外：脚本中途要 cd 进工作目录，所以这里的路径必须是绝对的。
ROOT_RAW="$(cd "$(dirname "$0")/.." && pwd)"
ROOT="$(cd "$ROOT_RAW" && pwd -W 2>/dev/null || echo "$ROOT_RAW")"
cd "$ROOT"

SIGN="node $ROOT/scripts/sign-catalog.mjs"
WORK="$ROOT/.e2e-scratch/catalog-signing-check"
fail=0

note() { echo; echo "──── $* ────"; }
bad() { echo "✗ $*"; fail=1; }

# 每轮从干净状态开始：上一轮留下的 catalog-keys/ 会让 keygen 直接拒绝覆盖，
# 于是后面每一步都跟着红 —— 看着像脚本坏了，其实是残留。
rm -rf "$WORK"
mkdir -p "$WORK"
cd "$WORK"

note "⓪ 脚本本身能被解析"
# 曾经栽在这里：CLI 块里写了顶层 `return usage(), process.exit(2)`，
# 那是**解析期**错误 —— 整个文件一行都跑不了，所有子命令一起报
# `Illegal return statement`。所以先单独确认语法。
node --check "$ROOT/scripts/sign-catalog.mjs" || bad "node --check 没过（语法错）"
$SIGN 2>&1 | grep -q 'keygen' || bad "没打印用法"

note "① 算包的 SHA-256"
printf 'export default { mount() { return () => {} } }\n' > bundle.js
HASH=$($SIGN sha bundle.js | head -1 | awk '{print $1}')
SIZE=$($SIGN sha bundle.js | head -1 | awk '{print $2}')
echo "HASH=$HASH  SIZE=$SIZE"
[ "${#HASH}" -eq 64 ] || bad "哈希长度不是 64（得到 ${#HASH}）"

note "② 按这个哈希写一份 catalog.json"
node -e '
const fs = require("fs")
fs.writeFileSync("catalog.json", JSON.stringify({
  version: 1,
  games: [{
    id: "demo", name: "许愿池", version: "1.0.0",
    url: "https://cdn.example.com/demo.js",
    sha256: process.argv[1], size: Number(process.argv[2]),
  }],
}, null, 2) + "\n")
' "$HASH" "$SIZE"
node -e 'JSON.parse(require("fs").readFileSync("catalog.json","utf8"))' || bad "catalog.json 不是合法 JSON"

note "③ keygen"
$SIGN keygen > /dev/null || bad "keygen 失败"
[ -f catalog-keys/catalog-private.pkcs8.pem ] || bad "私钥没落盘"
[ -f catalog-keys/catalog-public.spki.pem ] || bad "公钥没落盘"

note "④ 再跑一次 keygen —— 必须**拒绝覆盖**（exit 2）"
$SIGN keygen > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ] || bad "覆盖守卫没生效：期望 exit 2，实际 $rc"
echo "exit=$rc ✓（私钥没被覆盖）"

note "⑤ sign —— 产出 .sig 并自检"
$SIGN sign catalog.json > /dev/null || bad "sign 失败"
[ -f catalog.json.sig ] || bad "没产出 catalog.json.sig"

note "⑥ verify —— 应通过（exit 0）"
$SIGN verify catalog.json > /dev/null; rc=$?
[ "$rc" -eq 0 ] || bad "verify 应为 0，实际 $rc"

note "⑦ 改一个字符的 catalog 再 verify —— 必须失败（exit 1）"
node -e '
const fs = require("fs")
fs.writeFileSync("catalog.json", fs.readFileSync("catalog.json","utf8").replace("许愿池","许愿池2"))
'
$SIGN verify catalog.json > /dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ] || bad "篡改后 verify 应为 1，实际 $rc"
echo "exit=$rc ✓（篡改被抓到）"

note "⑧ 改回去 —— 必须又通过（证明⑦红的是**内容**，不是文件坏了）"
node -e '
const fs = require("fs")
fs.writeFileSync("catalog.json", fs.readFileSync("catalog.json","utf8").replace("许愿池2","许愿池"))
'
$SIGN verify catalog.json > /dev/null; rc=$?
[ "$rc" -eq 0 ] || bad "改回去后 verify 应为 0，实际 $rc"

note "⑨ 换成另一把钥匙的公钥 —— 必须验不过（exit 1）"
mv catalog-keys/catalog-public.spki.pem catalog-keys/catalog-public.spki.pem.orig
mv catalog-keys/catalog-private.pkcs8.pem catalog-keys/catalog-private.pkcs8.pem.orig
$SIGN keygen > /dev/null || bad "第二次 keygen 失败"
$SIGN verify catalog.json > /dev/null 2>&1; rc=$?
[ "$rc" -eq 1 ] || bad "换钥匙后 verify 应为 1，实际 $rc"
echo "exit=$rc ✓（换钥匙被抓到）"

note "⑩ 恢复旧公钥 —— 必须又通过（证明⑨红的是**钥匙**，不是文件）"
mv catalog-keys/catalog-public.spki.pem.orig catalog-keys/catalog-public.spki.pem
$SIGN verify catalog.json > /dev/null; rc=$?
[ "$rc" -eq 0 ] || bad "恢复公钥后 verify 应为 0，实际 $rc"

note "⑪ 签名文件缺失 —— 必须明确报错（exit 2），不是静默通过"
rm -f catalog.json.sig
$SIGN verify catalog.json > /dev/null 2>&1; rc=$?
[ "$rc" -eq 2 ] || bad "缺签名文件时应 exit 2，实际 $rc"
echo "exit=$rc ✓"

cd "$ROOT"
echo
if [ "$fail" -eq 0 ]; then
  echo "══ 全部通过 ══"
else
  echo "══ 有失败 ══"
fi
exit "$fail"
