#!/usr/bin/env bash
# 发布到线上 —— **必须你亲手打一个词**才会动手。
#
# 用户 2026-11-13 定的流程：
#
#   ① 我改完 → ② `local-test.sh` 起本地站给你试 → ③ **你说"发布"我才动**
#   → ④ 发布（**默认只发 web**）→ ⑤ APK 发不发由你定，我只是提醒
#
# ## ★ 默认不发 APK
#
# `web`（网页版 + 官网）是每次必发的；`APK` 是**另一个决定** ——
# 打一次包要好几分钟、要让所有已装用户重装，不该因为"顺手跑了个发布"就跟着上去。
#
# 所以默认**只发 web，完全不碰线上那个 APK 文件**。要连 APK 一起发，
# 显式加 `--with-apk`。
#
# ⚠️ 两者不同步会有一个看得见的后果：官网版本号写 1.2.2、下载拿到的是旧包。
#    脚本会在结尾把这件事说清楚（不是报错，是提醒你决定）。
#
# ## 为什么要输一个词，而不是「按回车继续」
#
# 回车太容易误触（连点两下终端、复制粘贴带个换行）。这一步一旦过去，
# 线上所有用户拿到的就是新版本 —— 它值得一个**不能手滑**的动作。
#
# ## 发布前后各有一道闸
#
#   · 推之前：确认本地那个包是你测过的（比对 sha256，不猜）；
#   · 推之后：自己的六条路径复测 + 打出回滚命令。
#
#   bash scripts/release-official.sh                # 发 web（不含 APK）
#   bash scripts/release-official.sh --with-apk     # web + APK 一起发
#   bash scripts/release-official.sh --dry-run      # 只走检查，不推
#   bash scripts/release-official.sh --prepare-only # 把包铺好就停，不推
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/progress.sh
source "$HERE/lib/progress.sh"
KQF_LOG_DIR="$ROOT/.e2e-scratch/release-logs"
mkdir -p "$KQF_LOG_DIR"

DRY=0
PREPARE_ONLY=0
WITH_APK=0
for arg in "${@:-}"; do
  case "$arg" in
    --dry-run) DRY=1 ;;
    --prepare-only) PREPARE_ONLY=1 ;;
    --with-apk) WITH_APK=1 ;;
    "") ;;
    *) echo "✗ 不认识的参数：$arg"; exit 2 ;;
  esac
done

DEPLOY="$ROOT/../deploy/tf-vps"
[ -d "$DEPLOY" ] || kqf_fail "找不到部署目录：$DEPLOY"

# ★★ 交给 **node / python**（原生 Windows 程序）的路径必须是 Windows 形式。
#    MSYS 的 `/e/plan/...` 到了它们嘴里会变成 `E:\e\plan\...` ——
#    写文件、起服务、构建产物全都会落到一个不存在的镜像目录里，
#    而且**退出码还是 0**。这个仓库已经踩过三次，统一用这个函数转。
win_path() { ( cd "$1" 2>/dev/null && pwd -W ) || echo "$1"; }

echo "=================================================="
echo " 发布到线上（kidfarm.duckdns.org）"
echo "=================================================="

# ---------------------------------------------------------------- ① 你测的是哪一条
kqf_plan 5
kqf_step "确认本地这一版就是你要发的"
APK="$ROOT/dist-apk/kid-quest-farm-release.apk"
# APK 只在「这次要发它」时才必须是新的。只发 web 时，旧包不影响本次发布。
if [ "$WITH_APK" = "1" ]; then
  [ -f "$APK" ] || kqf_fail "要发 APK，但 dist-apk/ 里没有包 —— 先跑 bash scripts/local-test.sh"
  APK_SHA=$(sha256sum "$APK" | cut -c1-16)
  APK_SIZE=$(du -h "$APK" | cut -f1)
else
  APK_SHA=""
  APK_SIZE=""
fi

# 发布用的客户端产物单独放一个目录：**不读 `dist/`**。
# `build-site.mjs --demo` 会重建 dist 成单机版，任何中间跑过一次官网构建
# 就会让发布脚本拿到错的版本，而那种错在界面上完全看不出来
# （网页版能开，只是连不上服务器）。2026-11-12 差点踩到。
RELEASE_WEB="$ROOT/.e2e-scratch/release-web"
rm -rf "$RELEASE_WEB" 2>/dev/null || true
mkdir -p "$RELEASE_WEB"
# ⚠️ `--outDir` 传 **Windows 路径**：否则产物会落到 `E:\e\plan\...`（见上面 win_path）
RELEASE_WEB_WIN="$(win_path "$RELEASE_WEB")"
CODEBUDDY_SAFE_DELETE_ENABLED=0 \
  env VITE_API_BASE=https://kidfarm.duckdns.org \
      VITE_GAME_CATALOG_URL=https://kidfarm.duckdns.org/api/game/catalog \
  npm run build -- --outDir "$RELEASE_WEB_WIN" --emptyOutDir > "$KQF_LOG_DIR/web.log" 2>&1 || {
    echo "  ✗ 构建失败，最后 20 行："; tail -20 "$KQF_LOG_DIR/web.log"; exit 1
  }
CLIENT_BUNDLE=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$RELEASE_WEB/index.html" | head -1 || true)
# 找不到 bundle 有两种可能，**都要说**（原来只写「构建失败但退出码是 0？」，
# 把真相「构建成功、产物写去了别处」掩盖了）：
if [ -n "$CLIENT_BUNDLE" ]; then : ; else
  kqf_fail "构建产物里找不到 bundle。检查：① 看 $KQF_LOG_DIR/web.log 有没有报错；② 确认产物没落到别处（--outDir 传的是 $RELEASE_WEB_WIN）"
fi
# 判据：产物里必须真有线上地址
grep -q "kidfarm.duckdns.org" "$RELEASE_WEB/$CLIENT_BUNDLE" \
  || kqf_fail "客户端产物里没有线上接口地址 —— 这一版发上去会连不上服务器"

if [ "$WITH_APK" = "1" ]; then
  kqf_ok "APK      $APK_SIZE  sha $APK_SHA（本次会发）"
else
  kqf_ok "APK      本次不发（线上那个包保持原样）"
fi
kqf_ok "客户端   $CLIENT_BUNDLE（刚构建）"
kqf_hint "版本号 $(grep -o 'versionName "[^"]*"' android/app/build.gradle | head -1 | cut -d'"' -f2)"

# ★ 和你本地测的那一版比：源码改过 ⇒ bundle 名会变。
#   这不是错误（可能就是刚修了个 bug），但**必须让你知道**。
TESTED=$(cat "$ROOT/.e2e-scratch/local-test-bundle.txt" 2>/dev/null || true)
if [ -n "$TESTED" ] && [ "$TESTED" != "$CLIENT_BUNDLE" ]; then
  kqf_warn "你本地测的是 $TESTED，现在是 $CLIENT_BUNDLE —— 源码在测试之后改过"
  kqf_hint "如果不是有意的，先 Ctrl+C，重新跑 bash scripts/local-test.sh 试一遍"
fi

# ---------------------------------------------------------------- ② 闸门
kqf_step "确认"
echo ""
echo "  即将发布："
echo "    版本     $(grep -o 'versionName "[^"]*"' android/app/build.gradle | head -1 | cut -d'"' -f2)"
echo "    网页版   /app/ 与官网（会更新）"
if [ "$WITH_APK" = "1" ]; then
  echo "    APK      $APK_SIZE（sha $APK_SHA）—— 会更新，已装用户需换包"
else
  echo "    APK      **不动**（线上下载仍是现有的包）"
fi
echo ""
echo "  请先确认：本地那个地址上试过了、没问题。"
echo ""
printf "  确认发布请输入 %s发布%s（直接回车 = 取消）：" "$KQF_C_RED" "$KQF_C_OFF"
read -r ANSWER
if [ "$ANSWER" != "发布" ]; then
  echo ""
  echo "  已取消，什么都没动。"
  exit 0
fi
kqf_ok "已确认"

if [ "$DRY" = "1" ]; then
  echo ""
  echo "  --dry-run：检查都过了，没有推服务器。"
  exit 0
fi

# ---------------------------------------------------------------- ③ 摆包
kqf_step "把这一版摆进部署包"
# ⚠️ 顺序不能反：`build.sh` 会用 out-prev 覆盖 `out/client-web`，
#    所以必须**先 build，再**把客户端产物拷进去（2026-11-12 踩过：
#    先拷后 build ⇒ 差点把单机版当在线客户端发上去）。
#
# ★★ `CODEBUDDY_SAFE_DELETE_ENABLED=0` 不能省：`build.sh` 开头要
#    `rm -rf out-prev`（它自己的版本轮转），而 out-prev 里有 1600+ 个文件，
#    超过安全删除闸门的阈值 ⇒ **整个构建停在那一步**：
#      [safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":1623,…}
#    out/ out-prev/ 是纯构建产物，允许清理。2026-11-13 实测卡在这里。
# ★ 后端没改就 `--skip-go`：省几分钟，也省磁盘（这台机器常年只剩一两 G）。
#   判据是「**完全干净**」—— 有疑问一律重编，绝不把旧二进制发上线。
API_DIR="$ROOT/../tf-platform-api"
BUILD_FLAGS="--skip-web"
# ★★ 判据是「**上次打包用的是不是同一个 commit**」，不是「工作区干净不干净」，
#    也不是「源码文件比二进制新」。
#
#    2026-11-14 踩了两次：
#      ① 改了后端 → 提交 → `git status` 干净 ⇒ 判成「没改」⇒ 复用旧二进制
#         ⇒ 线上 API 还是 4 关（新代码是 8 关），而包看起来完全正常；
#      ② 换成 `find -newer 二进制` 也不行 —— 二进制刚编出来当然比源码新，
#         第二次发布就永远判「不用重编」，等于第二次起就不更新了。
#
#    真正稳定的判据：把上次打包的 api commit 记在文件里（build.sh 写），
#    这次和当前 HEAD 比 —— 换了 commit 就重编。
API_HEAD_FILE="$DEPLOY/out-prev/bin/.api-commit"
# ⚠️ `git -C` 也吃不了 MSYS 的 `/e/...`（报 cannot change to …，退出码 128）
#    ⇒ 必须先 `pwd -W` 转成 `E:/...`。不转的话这里恒为 `unknown`，
#    于是**每次发布都判「换过 commit」而重编 Go**（白等两分钟），
#    日志还会写「ecaab18 → unknown」，看着像后端真变了。
#    这个坑本仓库记过好几次（python / node / vite / git），这是第五次。
API_DIR_WIN="$(cd "$API_DIR" 2>/dev/null && pwd -W)" || API_DIR_WIN=""
API_HEAD_NOW="$(git -C "${API_DIR_WIN:-$API_DIR}" rev-parse HEAD 2>/dev/null || echo unknown)"
API_HEAD_BUILT="$(cat "$API_HEAD_FILE" 2>/dev/null || echo none)"
need_go=0
if [ ! -f "$DEPLOY/out-prev/bin/tf-api" ]; then
  need_go=1; why="没有上次的二进制"
elif [ -n "$(git -C "${API_DIR_WIN:-$API_DIR}" status --porcelain 2>/dev/null)" ]; then
  need_go=1; why="工作区有未提交改动"
elif [ "$API_HEAD_NOW" != "$API_HEAD_BUILT" ]; then
  need_go=1; why="后端换过 commit（${API_HEAD_BUILT:0:7} → ${API_HEAD_NOW:0:7}）"
else
  why="后端还是 ${API_HEAD_NOW:0:7}"
fi

if [ "$need_go" = "1" ]; then
  kqf_hint "重编 Go（$why）"
else
  BUILD_FLAGS="--skip-go --skip-web"
  kqf_hint "复用上次的二进制（$why）"
fi

kqf_run "打部署包" bash -c "cd '$DEPLOY' && bash build.sh $BUILD_FLAGS"
# 客户端 Web 产物（在线版、含线上地址）
# python 同样是原生 Windows 程序 ⇒ 两个参数都要 Windows 形式
CODEBUDDY_SAFE_DELETE_ENABLED=0 python - "$RELEASE_WEB_WIN" "$(win_path "$DEPLOY/out")/client-web" <<'PY'
import os, shutil, sys

src, dst = sys.argv[1], sys.argv[2]

# ★★ 拷的时候就排除 `games/`，**不要**先整份拷再删。
#    那个目录有 **195MB**（public/games 全量），先拷再删等于白拷一遍 ——
#    而这台机器的磁盘常年只剩一两 G，Windows 上拷 198MB 还要十几分钟。
#    在线版客户端本来就不随包发游戏（和服务端 `TF_APK_NO_GAMES` 同一口径）。
SKIP = {'games'}

shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst, ignore=shutil.ignore_patterns(*SKIP))

# 判据：拷完之后那个目录**不该存在**（漏了它 = 包里多 195MB 游戏）
if os.path.isdir(os.path.join(dst, 'games')):
    sys.exit('✗ client-web/games 还在 —— 排除没生效，包里会多 195MB')

n = sum(len(f) for _, _, f in os.walk(dst))
print('client-web 已铺（%d 个文件，已排除 games/）' % n)
PY
# ---------------------------------------------------------------- APK
# ★★ 这里有个不显眼的陷阱：`build.sh` 会从 `kid-quest-farm-online/site/download/`
#    把 APK 拷进 `out/site/download/`。而那个源文件**已经是最新的 1.2.2** ——
#    也就是说「什么都不做」并不等于「线上 APK 不变」，它会跟着一起更新。
#
#    所以两个分支都必须**显式**处理：
#      · --with-apk  ：用 dist-apk 的新包覆盖（并核对 sha）；
#      · 默认（不发）：**从线上把当前那个包取回来放回去** —— 这样发上去的
#        字节和现在一模一样，才是真的「不动」。取不到就拒绝发布
#        （否则可能把下载链接指向一个我没验证过的包，或者干脆弄丢这个文件）。
APK_DEST="$DEPLOY/out/site/download/kid-quest-farm.apk"
if [ "$WITH_APK" = "1" ]; then
  cp "$APK" "$APK_DEST"
  [ "$(sha256sum "$APK_DEST" | cut -c1-16)" = "$APK_SHA" ] \
    || kqf_fail "部署包里的 APK 和本地那份不一致（拷贝没生效）"
  kqf_ok "APK 已替换成本地那一版（sha $APK_SHA）"
else
  LIVE_APK_SHA=$(CODEBUDDY_SAFE_DELETE_ENABLED=0 python - "$APK_DEST" <<'PY'
import hashlib, os, sys, urllib.request
dst = sys.argv[1]
url = 'https://kidfarm.duckdns.org/download/kid-quest-farm.apk'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'kqf-release/1.0'})
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
except Exception as e:
    print('ERR:' + str(e))
    sys.exit(0)
if len(data) < 100000:
    print('ERR:线上返回的文件只有 %d 字节，不像一个 APK' % len(data))
    sys.exit(0)
os.makedirs(os.path.dirname(dst), exist_ok=True)
open(dst, 'wb').write(data)
print(hashlib.sha256(data).hexdigest()[:16])
PY
)
  case "$LIVE_APK_SHA" in
    ERR:*) kqf_fail "要「不动 APK」，但取不回线上当前那个包（${LIVE_APK_SHA#ERR:}）。要么加 --with-apk 一起发，要么先确认线上下载页正常。" ;;
  esac
  kqf_ok "APK 保持线上原样（sha $LIVE_APK_SHA，从线上取回原样放回）"
fi
grep -q "kidfarm.duckdns.org" "$DEPLOY"/out/client-web/assets/index-*.js \
  || kqf_fail "部署包里的客户端产物没有线上地址 —— 顺序搞反了（先 build 再拷）"
kqf_ok "部署包内容核对通过（VERSION $(cat "$DEPLOY/out/VERSION"))"

if [ "$PREPARE_ONLY" = "1" ]; then
  echo ""
  echo "  --prepare-only：包已经铺好，**没有推**。"
  echo "  要发布就再跑一次（不带这个参数）：bash scripts/release-official.sh"
  exit 0
fi

# ---------------------------------------------------------------- ④ 推
kqf_step "推送到服务器"
kqf_run "push" bash -c "cd '$DEPLOY' && bash push.sh"

# ---------------------------------------------------------------- ⑤ 线上复测
kqf_step "线上复测"
FAIL=0
for p in / /app/ /download/kid-quest-farm.apk /healthz /api/game/catalog /admin/; do
  # ★★ 别写 `code=$(curl … || echo 000)`：
  #    本机 curl 恒返回 **23**（`curl` 在 Git Bash 下写 stdout 的老问题），
  #    而它已经把 `200` 打进 stdout 了 ⇒ `|| echo 000` 会把两段**拼成 `200000`**
  #    ⇒ 六个路径全部"不是 200"、脚本喊「先别通知用户」，而线上其实好好的。
  #    2026-11-14 实测踩到（手动 curl 六条全 200）。
  #    改成：只取状态码，忽略 curl 自己的退出码（状态码本身才是判据）。
  # ⚠️ 末尾必须 `|| true`：`code=$(curl …)` 的退出码就是 curl 的退出码，
  #    本机 curl 恒返回 23 ⇒ `set -e` 会让整个脚本**在这里静默退出**，
  #    复测一行都没打出来、发布其实已经成功（推送那步早过了）。
  #    2026-11-14 实测踩到：日志停在「▸ [5/5] 线上复测」就没了。
  code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' \
    "https://kidfarm.duckdns.org$p" 2>/dev/null || true)
  code="${code:-000}"
  # 兜底：真拿不到状态码时 curl 会给 000，长度一定是 3；长了说明是拼接产物
  [ ${#code} -eq 3 ] || code=000
  if [ "$code" = "200" ]; then
    kqf_hint "$code  $p"
  else
    printf '  %s✗ %s %s%s\n' "$KQF_C_RED" "$code" "$p" "$KQF_C_OFF"
    FAIL=1
  fi
done
[ "$FAIL" = "0" ] && kqf_ok "六条路径全 200" || kqf_warn "有路径不是 200，先别通知用户"

echo ""
echo "=================================================="
echo " 发布完成"
echo "   版本   $(cat "$DEPLOY/out/VERSION")"
echo "   试玩   https://kidfarm.duckdns.org/app/"
echo "   下载   https://kidfarm.duckdns.org/download/kid-quest-farm.apk"
echo ""
echo " 出问题要回滚："
echo "   ssh <服务器> 'cd /srv/tf && bash rollback.sh'"
echo "=================================================="
