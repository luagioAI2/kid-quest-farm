#!/usr/bin/env bash
# 本地打一版、起本地服务让你先试 —— **不碰线上**。
#
# 用户 2026-11-13：「能否先让我本地测试完，我确认后再发布到官方，
#                  另外打包也需要提示。」
#
# 它只做四件事，最后停在那里等你：
#   ① 类型检查 + 单元测试（`--skip-tests` 跳过，约省 6 分钟）
#   ② 构建 Web 产物（照**线上接口**构建，和你手机上那一版同一口径）
#   ③ 打 APK（默认打；`--no-apk` 跳过，只是改 UI 时够用）
#   ④ 摆一个本地站点 + 起服务，打印地址
#
# 常用：
#   bash scripts/local-test.sh                # 全量（含 APK）
#   bash scripts/local-test.sh --no-apk       # 只出网页版，快
#   bash scripts/local-test.sh --skip-tests   # 只构建+起站，几分钟内能点
#   bash scripts/local-test.sh --skip-build   # 连构建都省，直接起现有 dist（几秒）
#
# ⚠️ 它**不会**推服务器。发布是 `release-official.sh`，那一步要你手输「发布」。
#
# ## ★★ 端口必须是后端 CORS 白名单里的
#
# 客户端产物里的接口地址是**构建期常量**（线上域名），浏览器从
# `http://127.0.0.1:<端口>` 去请求线上 —— 那是跨源。后端白名单只认
# 特定的几个来源（见 `tf-platform-api/configs/config.yaml` 的 `AllowOrigins`）。
#
# 端口不在白名单里会怎样：**页面能打开、任务列表空着、下载全失败**，
# 只有浏览器控制台有一句 CORS。2026-11-13 实测踩到（4412 被拒），
# 第一反应是「后端挂了」，其实一个请求都没发出去。
#
# 所以端口只能从白名单里挑，脚本自动找第一个空闲的。
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/progress.sh
source "$HERE/lib/progress.sh"
KQF_LOG_DIR="$ROOT/.e2e-scratch/local-test-logs"
mkdir -p "$KQF_LOG_DIR"

API_BASE="https://kidfarm.duckdns.org"

# 后端 `AllowOrigins` 里的本机端口。**加端口要同时改后端配置**，
# 否则界面只说「连不上服务器」，看不出是 CORS。
WHITELIST_PORTS="4391 4393 4396 4401 5173 4180"

BUILD_APK=1
WANT_PORT=""
SKIP_TESTS=0
SKIP_BUILD=0
while [ $# -gt 0 ]; do
  case "$1" in
    --no-apk) BUILD_APK=0; shift ;;
    --port) WANT_PORT="${2:?--port 后面要跟端口号}"; shift 2 ;;
    --skip-tests) SKIP_TESTS=1; shift ;;
    --skip-build) SKIP_TESTS=1; SKIP_BUILD=1; shift ;;
    -h|--help) sed -n '2,27p' "$0"; exit 0 ;;
    *) echo "✗ 不认识的参数：$1"; exit 2 ;;
  esac
done

port_busy() { netstat -ano 2>/dev/null | grep -q ":$1 .*LISTENING"; }

if [ -n "$WANT_PORT" ]; then
  case " $WHITELIST_PORTS " in
    *" $WANT_PORT "*) PORT="$WANT_PORT" ;;
    *)
      echo "✗ 端口 $WANT_PORT 不在后端 CORS 白名单里，本地测会「页面能开、数据全空」。"
      echo "  可用端口：$WHITELIST_PORTS"
      echo "  （要加新端口，得同时改 tf-platform-api/configs/config.yaml 的 AllowOrigins）"
      exit 2
      ;;
  esac
  port_busy "$PORT" && { echo "✗ 端口 $PORT 被占用，换一个：$WHITELIST_PORTS"; exit 2; }
else
  PORT=""
  for p in $WHITELIST_PORTS; do
    if ! port_busy "$p"; then PORT="$p"; break; fi
  done
  [ -n "$PORT" ] || {
    echo "✗ 白名单里的端口都占用了（$WHITELIST_PORTS）。"
    echo "  先关掉占用的进程，或在后端 AllowOrigins 里加一个新端口。"
    exit 2
  }
fi

# 总步数按实际会走的段算（`--skip-*` 会让步数变，写死就会出现 `[5/4]` 这种）
KQF_TOTAL_STEPS=2   # 摆站点 + 起服务，这两步永远走
[ "$SKIP_TESTS" = "1" ] || KQF_TOTAL_STEPS=$((KQF_TOTAL_STEPS + 1))
[ "$SKIP_BUILD" = "1" ] || KQF_TOTAL_STEPS=$((KQF_TOTAL_STEPS + 1))
[ "$BUILD_APK" = "1" ] && KQF_TOTAL_STEPS=$((KQF_TOTAL_STEPS + 1))
kqf_plan "$KQF_TOTAL_STEPS"

echo "=================================================="
echo " 本地测试版（只在本机，不会发布）"
echo "=================================================="
echo "  端口   $PORT（在后端 CORS 白名单里）"
echo "  接口   $API_BASE"

# ---------------------------------------------------------------- ①
if [ "$SKIP_TESTS" = "1" ]; then
  echo ""
  echo "（跳过类型检查与单元测试 —— 这次只是把服务起起来给你点）"
fi
if [ "$SKIP_TESTS" != "1" ]; then
kqf_step "类型检查 + 单元测试"
# ⚠️ 判据是**退出码**，不是 grep 输出
kqf_run "lint" npm run lint
kqf_run "unit" npx vitest run --maxWorkers=3
fi

# ---------------------------------------------------------------- ②
if [ "$SKIP_BUILD" = "1" ]; then
  [ -f dist/index.html ] || kqf_fail "没有 dist/，不能 --skip-build —— 去掉这个参数重跑"
  BUNDLE=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1 || true)
  echo ""
  echo "（跳过构建，复用现有 dist：$BUNDLE）"
  # 复用也要验：产物必须连线上接口，否则你测的是单机版
  grep -q "kidfarm.duckdns.org" "dist/$BUNDLE" || kqf_fail "现有 dist 是单机版（没有线上地址）—— 去掉 --skip-build 重新构建"
else
kqf_step "构建 Web 产物"
CODEBUDDY_SAFE_DELETE_ENABLED=0 \
  env VITE_API_BASE="$API_BASE" \
      VITE_GAME_CATALOG_URL="$API_BASE/api/game/catalog" \
  npm run build > "$KQF_LOG_DIR/web.log" 2>&1 || {
    echo "  ✗ Web 构建失败，最后 20 行："; tail -20 "$KQF_LOG_DIR/web.log"; exit 1
  }
BUNDLE=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1 || true)
[ -n "$BUNDLE" ] || kqf_fail "构建产物里找不到 bundle（构建失败但退出码是 0？）"
kqf_ok "Web 产物：$BUNDLE"
# 判据：产物里必须有线上接口地址 —— 否则本地测的是单机版
grep -q "kidfarm.duckdns.org" "dist/$BUNDLE" || kqf_fail "产物里没有线上接口地址"
fi
# 记下来：发布脚本要拿它比对「你测的那版」和「现在源码构建出来的那版」
printf '%s\n' "$BUNDLE" > "$ROOT/.e2e-scratch/local-test-bundle.txt"

# ---------------------------------------------------------------- ③
APK_PATH=""
if [ "$BUILD_APK" = "1" ]; then
  kqf_step "打 APK（gradle 约 2 分钟）"
  # 后台跑 + 每 5 秒报一次已用时长：gradle 那两分钟不出声，
  # 一片安静和「卡死」看起来完全一样，会有人 Ctrl+C 掉再拿到半成品。
  TF_APK_NO_GAMES=1 bash scripts/build-apk.sh release > "$KQF_LOG_DIR/apk.log" 2>&1 &
  GRADLE_PID=$!
  tick=0
  while kill -0 "$GRADLE_PID" 2>/dev/null; do
    sleep 5
    tick=$((tick + 5))
    printf '\r  %s… 已用 %ds%s' "$KQF_C_DIM" "$tick" "$KQF_C_OFF"
  done
  printf '\r%*s\r' 40 ''
  if ! wait "$GRADLE_PID"; then
    echo "  ✗ 打包失败，最后 25 行（完整：$KQF_LOG_DIR/apk.log）："
    tail -25 "$KQF_LOG_DIR/apk.log"
    exit 1
  fi
  APK_PATH="$ROOT/dist-apk/kid-quest-farm-release.apk"
  [ -f "$APK_PATH" ] || kqf_fail "脚本说成功，但 dist-apk/ 里没有包"
  kqf_ok "APK：$(du -h "$APK_PATH" | cut -f1)  sha $(sha256sum "$APK_PATH" | cut -c1-16)"
fi

# ---------------------------------------------------------------- ④
kqf_step "摆本地站点（官网 + /app/ + APK 下载）"
SITE="$ROOT/.e2e-scratch/local-site"
CODEBUDDY_SAFE_DELETE_ENABLED=0 rm -rf "$SITE" 2>/dev/null || true
mkdir -p "$SITE/app"
# 官网：复用现成的构建脚本，但**不推服务器**
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-site.mjs --no-build --no-app \
  > "$KQF_LOG_DIR/site.log" 2>&1 || {
    echo "  ✗ 官网构建失败，最后 20 行："; tail -20 "$KQF_LOG_DIR/site.log"; exit 1
  }
cp -r site/* "$SITE"/ 2>/dev/null || true
# `/app/` = 客户端 Web 产物（和你手机上那个是同一份代码）
cp -r dist/* "$SITE/app"/
if [ -n "$APK_PATH" ]; then
  mkdir -p "$SITE/download"
  cp "$APK_PATH" "$SITE/download/kid-quest-farm.apk"
fi
kqf_ok "站点已就位"

# ---------------------------------------------------------------- ⑤
kqf_step "启动本地服务"
URL="http://127.0.0.1:$PORT"
echo ""
echo "--------------------------------------------------"
echo " 请在这里试："
echo "   网页版   $URL/app/"
echo "   官网     $URL/"
if [ -n "$APK_PATH" ]; then
  echo "   装包     $URL/download/kid-quest-farm.apk"
  echo "            （手机上装之前先卸旧的；同一签名可覆盖升级）"
fi
echo ""
echo " 试完跟我说一声，我再发布到线上。"
echo " ⚠️ 这个脚本不会推服务器；发布是另一步（要你亲手确认）。"
echo "--------------------------------------------------"
echo ""

# 前台跑着，Ctrl+C 结束。
#
# ★★ 必须 `cd` 进去再用，**不能** `python -m http.server --directory "$SITE"`：
#    `$SITE` 是 MSYS 路径（`/e/plan/...`），而 python 是原生 Windows 程序，
#    它把 `/e/...` 当成 `E:\e\...` ⇒ **整站 404，且日志里一句报错都没有**。
#    2026-11-13 实测踩到（站点明明有文件，所有路径全 404）。
cd "$SITE"
exec python -m http.server "$PORT" --bind 127.0.0.1
