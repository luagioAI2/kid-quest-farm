#!/usr/bin/env bash
# 本地打一版、起本地服务让你先试 —— **不碰线上**。
#
# 用户 2026-11-13：「能否先让我本地测试完，我确认后再发布到官方，
#                  另外打包也需要提示。」
#
# 这个脚本只做三件事，最后一件是停下来等你：
#   ① 构建 Web + APK（每步都有提示和心跳，gradle 那两分钟不会看着像卡死）
#   ② 把产物摆到一个**本地**站点，起一个服务
#   ③ 打印地址和自检清单，然后**停在那里**等你点完
#
# ⚠️ 它**不会**推服务器。发不发、什么时候发，是 `release-official.sh` 的事，
#    那一步要你亲手打一个词。两条路分开，是为了避免「本来只想看看，
#    结果一不小心发上线了」。
#
#   bash scripts/local-test.sh              # 全量：Web + APK + 本地站点
#   bash scripts/local-test.sh --no-apk     # 只出网页版（快，改 UI 时够用）
#   bash scripts/local-test.sh --port 4400
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
cd "$ROOT"

# shellcheck source=lib/progress.sh
source "$HERE/lib/progress.sh"
KQF_LOG_DIR="$ROOT/.e2e-scratch/local-test-logs"
mkdir -p "$KQF_LOG_DIR"

PORT=4399
BUILD_APK=1
while [ $# -gt 0 ]; do
  case "$1" in
    --no-apk) BUILD_APK=0; shift ;;
    --port) PORT="${2:?--port 后面要跟端口号}"; shift 2 ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "✗ 不认识的参数：$1"; exit 2 ;;
  esac
done

# ---- 端口占用先查：被别人的服务占着时，本地测试会**测到别人** ----
if netstat -ano 2>/dev/null | grep -q ":$PORT .*LISTENING"; then
  echo "✗ 端口 $PORT 已被占用，换一个：bash scripts/local-test.sh --port 44xx"
  netstat -ano 2>/dev/null | grep ":$PORT " | head -3
  exit 1
fi

# 4 步：类型+单测 / 构建 Web / 打 APK（可选）/ 摆站点+起服务
if [ "$BUILD_APK" = "1" ]; then kqf_plan 4; else kqf_plan 3; fi

echo "=================================================="
echo " 本地测试版（只在本机，不会发布）"
echo "=================================================="

# ---------------------------------------------------------------- ① 类型 + 单测
kqf_step "类型检查 + 单元测试"
# ⚠️ 判据是**退出码**，不是 grep 输出（见 MEMORY：别对 build 结果接管道）
kqf_run "lint" npm run lint
kqf_run "unit" npx vitest run --maxWorkers=3

# ---------------------------------------------------------------- ② Web
kqf_step "构建 Web 产物"
# 在线版地址：本地这一版**也要连线上接口**，否则测的是单机版，
# 而你要验的恰恰是「装包 / 兑换 / 活动」这些要服务端的路径。
CODEBUDDY_SAFE_DELETE_ENABLED=0 \
  env VITE_API_BASE=https://kidfarm.duckdns.org \
      VITE_GAME_CATALOG_URL=https://kidfarm.duckdns.org/api/game/catalog \
  bash -c 'npm run build' > "$KQF_LOG_DIR/web.log" 2>&1 || {
    echo "  ✗ Web 构建失败，最后 20 行："; tail -20 "$KQF_LOG_DIR/web.log"; exit 1
  }
BUNDLE=$(grep -o 'assets/index-[A-Za-z0-9_-]*\.js' dist/index.html | head -1 || true)
kqf_ok "Web 产物：${BUNDLE:-（没取到 bundle 名）}"
# 记下来：发布脚本要拿它比对「你测的那版」和「现在源码构建出来的那版」
mkdir -p "$ROOT/.e2e-scratch"
printf '%s\n' "$BUNDLE" > "$ROOT/.e2e-scratch/local-test-bundle.txt"
# 判据：产物里必须真有线上地址 —— 否则本地测的是单机版
if ! grep -q "kidfarm.duckdns.org" "dist/$BUNDLE" 2>/dev/null; then
  kqf_fail "产物里没有线上接口地址 —— 这一版装到手机上会连不上服务器"
fi

# ---------------------------------------------------------------- ③ APK
APK_PATH=""
if [ "$BUILD_APK" = "1" ]; then
  kqf_step "打 APK（gradle 大约 2 分钟，会显示已用时长）"
  # `TF_APK_NO_GAMES=1` = 在线版客户端不随包发游戏（和正式发布同一个口径）
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

# ---------------------------------------------------------------- ④ 摆本地站点
kqf_step "准备本地站点（官网 + /app/ + APK 下载）"
SITE="$ROOT/.e2e-scratch/local-site"
rm -rf "$SITE" 2>/dev/null || true
mkdir -p "$SITE"
# 官网：用现成的构建脚本，但**不推服务器**
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-site.mjs --no-build --no-app \
  > "$KQF_LOG_DIR/site.log" 2>&1 || {
    echo "  ✗ 官网构建失败，最后 20 行："; tail -20 "$KQF_LOG_DIR/site.log"; exit 1
  }
cp -r site/* "$SITE"/ 2>/dev/null || true
# `/app/` = 客户端 Web 产物（和你手机上装的那个是同一份代码）
mkdir -p "$SITE/app"
cp -r dist/* "$SITE/app"/
if [ -n "$APK_PATH" ]; then
  mkdir -p "$SITE/download"
  cp "$APK_PATH" "$SITE/download/kid-quest-farm.apk"
fi
kqf_ok "站点已就位：$SITE"

# ---------------------------------------------------------------- ⑤ 起服务
kqf_step "启动本地服务（Ctrl+C 结束）"
URL="http://127.0.0.1:$PORT"
kqf_hint "服务跑起来后，**先确认这一页是不是你自己的构建**："
kqf_hint "  bundle 应该是 $BUNDLE"
echo ""
echo "--------------------------------------------------"
echo " 请在这里试："
echo "   网页版   $URL/app/"
echo "   官网     $URL/"
if [ -n "$APK_PATH" ]; then
  echo "   装包     $URL/download/kid-quest-farm.apk"
  echo "            （手机上装之前，先卸旧的；同一签名可覆盖升级）"
fi
echo ""
echo " 试完跟我说一声，我再发布到线上。"
echo " ⚠️ 这个脚本**不会**推服务器；发布是另一步（要你亲手确认）。"
echo "--------------------------------------------------"
echo ""

# 前台跑着，Ctrl+C 结束。用 python 的 http.server：零依赖、能直接服务
# 子目录（vite preview 不认 /app/ 这种子路径）。
#
# ★★ 必须 `cd` 进去再用，**不能** `--directory "$SITE"`：
#    `$SITE` 是 MSYS 路径（`/e/plan/...`），而 python 是原生 Windows 程序，
#    它把 `/e/...` 当成 `E:\e\...` ⇒ 整站 404，而且日志里一句报错都没有。
#    2026-11-13 实测踩到（站点明明有文件，所有路径全 404）。
cd "$SITE"
exec python -m http.server "$PORT" --bind 127.0.0.1
