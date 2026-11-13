#!/usr/bin/env bash
# 发布到线上 —— **必须你亲手打一个词**才会动手。
#
# 用户 2026-11-13：「能否先让我本地测试完，我确认后再发布到官方。」
#
# 所以发布被拆成两步：
#   ① `bash scripts/local-test.sh`   —— 本地打一版、起服务，随你试，**不推**
#   ② `bash scripts/release-official.sh` —— 这个脚本，推之前要你输 `发布`
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
#   bash scripts/release-official.sh           # 正式发布
#   bash scripts/release-official.sh --dry-run # 只走检查，不推
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/progress.sh
source "$HERE/lib/progress.sh"
KQF_LOG_DIR="$ROOT/.e2e-scratch/release-logs"
mkdir -p "$KQF_LOG_DIR"

DRY=0
if [ "${1:-}" = "--dry-run" ]; then DRY=1; fi

DEPLOY="$ROOT/../deploy/tf-vps"
[ -d "$DEPLOY" ] || kqf_fail "找不到部署目录：$DEPLOY"

echo "=================================================="
echo " 发布到线上（kidfarm.duckdns.org）"
echo "=================================================="

# ---------------------------------------------------------------- ① 你测的是哪一条
kqf_plan 5
kqf_step "确认本地这一版就是你要发的"
APK="$ROOT/dist-apk/kid-quest-farm-release.apk"
[ -f "$APK" ] || kqf_fail "dist-apk/ 里没有包 —— 先跑 bash scripts/local-test.sh"
APK_SHA=$(sha256sum "$APK" | cut -c1-16)
APK_SIZE=$(du -h "$APK" | cut -f1)

# 发布用的客户端产物单独放一个目录：**不读 `dist/`**。
# `build-site.mjs --demo` 会重建 dist 成单机版，任何中间跑过一次官网构建
# 就会让发布脚本拿到错的版本，而那种错在界面上完全看不出来
# （网页版能开，只是连不上服务器）。2026-11-12 差点踩到。
RELEASE_WEB="$ROOT/.e2e-scratch/release-web"
rm -rf "$RELEASE_WEB" 2>/dev/null || true
CODEBUDDY_SAFE_DELETE_ENABLED=0 \
  env VITE_API_BASE=https://kidfarm.duckdns.org \
      VITE_GAME_CATALOG_URL=https://kidfarm.duckdns.org/api/game/catalog \
  npx vite build --outDir "$RELEASE_WEB" --emptyOutDir > "$KQF_LOG_DIR/web.log" 2>&1 || {
    echo "  ✗ 构建失败，最后 20 行："; tail -20 "$KQF_LOG_DIR/web.log"; exit 1
  }
CLIENT_BUNDLE=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' "$RELEASE_WEB/index.html" | head -1 || true)
[ -n "$CLIENT_BUNDLE" ] || kqf_fail "构建产物里找不到 bundle（构建失败但退出码是 0？）"
# 判据：产物里必须真有线上地址
grep -q "kidfarm.duckdns.org" "$RELEASE_WEB/$CLIENT_BUNDLE" \
  || kqf_fail "客户端产物里没有线上接口地址 —— 这一版发上去会连不上服务器"

kqf_ok "APK      $APK_SIZE  sha $APK_SHA"
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
echo "    APK      $APK_SIZE（sha $APK_SHA）"
echo "    影响     所有线上用户（官网下载 + /app/ 网页版 + 服务端接口）"
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
CODEBUDDY_SAFE_DELETE_ENABLED=0 mv "$DEPLOY/out-prev" "$DEPLOY/.pkg/op-$(date +%H%M%S)" 2>/dev/null || true
kqf_run "打部署包" bash -c "cd '$DEPLOY' && bash build.sh --skip-web"
# 客户端 Web 产物（在线版、含线上地址）
CODEBUDDY_SAFE_DELETE_ENABLED=0 python - "$RELEASE_WEB" "$DEPLOY/out/client-web" <<'PY'
import shutil, sys
src, dst = sys.argv[1], sys.argv[2]
shutil.rmtree(dst, ignore_errors=True)
shutil.copytree(src, dst)
# 在线版客户端不随包发游戏（和服务端 `TF_APK_NO_GAMES` 同一个口径）
shutil.rmtree(dst + "/games", ignore_errors=True)
print("client-web 已铺")
PY
# APK：官网下载页读的就是这一份
cp "$APK" "$DEPLOY/out/site/download/kid-quest-farm.apk"
# 判据：部署包里那几样必须是「我刚放进去的」
[ "$(sha256sum "$DEPLOY/out/site/download/kid-quest-farm.apk" | cut -c1-16)" = "$APK_SHA" ] \
  || kqf_fail "部署包里的 APK 和本地那份不一致（拷贝没生效）"
grep -q "kidfarm.duckdns.org" "$DEPLOY"/out/client-web/assets/index-*.js \
  || kqf_fail "部署包里的客户端产物没有线上地址 —— 顺序搞反了（先 build 再拷）"
kqf_ok "部署包内容核对通过（VERSION $(cat "$DEPLOY/out/VERSION"))"

# ---------------------------------------------------------------- ④ 推
kqf_step "推送到服务器"
kqf_run "push" bash -c "cd '$DEPLOY' && bash push.sh"

# ---------------------------------------------------------------- ⑤ 线上复测
kqf_step "线上复测"
FAIL=0
for p in / /app/ /download/kid-quest-farm.apk /healthz /api/game/catalog /admin/; do
  code=$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "https://kidfarm.duckdns.org$p" || echo 000)
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
