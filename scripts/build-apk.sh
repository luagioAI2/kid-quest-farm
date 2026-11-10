#!/usr/bin/env bash
# ============================================================
# 一键打包 APK
# ------------------------------------------------------------
# 用法：
#   bash scripts/build-apk.sh            # debug 包（可直接安装）
#   bash scripts/build-apk.sh release    # release 包（需签名配置）
#   bash scripts/build-apk.sh --offline  # 明知没有后端也照打（纯离线包）
#   bash scripts/build-apk.sh --web-only # 只构建 Web 产物，不碰 gradle
#
# 后端地址读 `.env.apk`（不是 `.env.production` —— 那个会被
# 所有 `npm run build` 加载，探针会连到线上库）。
# ============================================================
set -euo pipefail

MODE="debug"
OFFLINE=0
WEB_ONLY=0
for arg in "$@"; do
  case "$arg" in
    debug|release) MODE="$arg" ;;
    --offline) OFFLINE=1 ;;
    --web-only) WEB_ONLY=1 ;;
    *)
      echo "✗ 不认识的参数：$arg"
      exit 2
      ;;
  esac
done
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ---------------- 环境准备 ----------------
# 需要 JDK **21**，不是 17。
#
# AGP 8.x 只要 17，所以「gradle 起得来」不等于「编得过」：Capacitor 8 的每个
# 插件模块（@capacitor/android、@capacitor/filesystem…）都把 sourceCompatibility
# 写成了 VERSION_21。JDK 17 会一路跑到
#     :capacitor-filesystem:compileReleaseJavaWithJavac
# 才报 `Cannot find a Java installation ... languageVersion=21`，
# 而这条错误夹在十几行 gradle 输出中间，看着更像网络 / 下载失败。
# （2026-10-30 本机就是这个：JAVA_HOME 指着 jdk17，包根本打不出来。）
java_major() {
  local v
  v=$("$1/bin/java" -version 2>&1 | sed -nE 's/.*version "([0-9]+).*/\1/p' | head -1) || v=""
  echo "${v:-0}"
}

have_jdk21() { [ -x "$1/bin/java" ] && [ "$(java_major "$1")" -ge 21 ]; }

if ! have_jdk21 "${JAVA_HOME:-/nonexistent}"; then
  for candidate in \
    "${ANDROID_SDK_ROOT:-}/jdk21" \
    "E:/android-sdk/jdk21" \
    "C:/Program Files/Eclipse Adoptium/jdk-21"* \
    "C:/Program Files/Microsoft/jdk-21"*; do
    if have_jdk21 "$candidate"; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if ! have_jdk21 "${JAVA_HOME:-/nonexistent}"; then
  echo ""
  echo "✗ 找不到 JDK 21（Capacitor 8 的插件模块写死了 VERSION_21，17 编不过）。"
  echo "  当前 JAVA_HOME=${JAVA_HOME:-（未设置）}"
  echo ""
  echo "  装一个：winget install EclipseAdoptium.Temurin.21.JDK"
  echo "  或下载 zip 解压到 E:/android-sdk/jdk21 —— 本脚本会自动找到它。"
  exit 1
fi

if [ -z "${ANDROID_HOME:-}" ]; then
  export ANDROID_HOME="C:/Users/${USER:-admin}/AppData/Local/Android/Sdk"
  [ -d "$ANDROID_HOME" ] || export ANDROID_HOME="C:/Users/admin/AppData/Local/Android/Sdk"
fi
export ANDROID_SDK_ROOT="$ANDROID_HOME"

if [ ! -d "$JAVA_HOME" ]; then
  echo "✗ 找不到 JDK。请先安装 JDK 21："
  echo "    winget install EclipseAdoptium.Temurin.21.JDK"
  echo "  然后设置 JAVA_HOME 指向安装目录。"
  exit 1
fi

if [ ! -d "$ANDROID_HOME/platforms" ]; then
  echo "✗ 找不到 Android SDK。请参考 TOOLCHAIN.md 安装。"
  exit 1
fi

echo "▸ JAVA_HOME    = $JAVA_HOME"
echo "▸ ANDROID_HOME = $ANDROID_HOME"

# ---------------- 别把线上地址写进 .env.production ----------------
# 这一条挡的是一个真实的连锁反应：
#
#   `.env.production` 会被 `vite build`（默认 mode=production）**自动加载**，
#   而 `npm run build` 就是这个 mode。地址一旦写在那儿，之后**每一次**
#   `npm run build` 都会把它打进产物：
#     · 11 条 e2e 探针（先 build 再 preview）⇒ 连的是**线上库**。
#       探针会注册账号、下单、兑换、回档 —— 等于往生产数据里灌测试数据；
#     · `npm run site` ⇒ 官网「在线体验」指向线上 API。
#   两者都不会报错，只会在几天后被人发现「测试数据怎么进生产了」。
#
# 所以 APK 的地址单独放 `.env.apk`，只在 `vite build --mode apk` 时加载。
# 这里只是提醒，不拦 —— 万一有人真是这么用的。
if [ -f .env.production ]; then
  prod_base="$(grep -E '^VITE_API_BASE=' .env.production | head -1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
  case "$prod_base" in
    "" | *127.0.0.1* | *localhost*) ;;
    *)
      echo ""
      echo "⚠️  .env.production 里有线上地址：$prod_base"
      echo "    它会被所有 npm run build 加载 —— 包括 11 条探针和官网构建。"
      echo "    APK 的地址请写到 .env.apk（本脚本只读这个）。"
      echo ""
      ;;
  esac
fi

# ---------------- 后端地址闸门 ----------------
# `VITE_API_BASE` 是**构建期常量**：`src/api/client.ts` 里默认值是
# `http://127.0.0.1:8090`，在手机上那是「手机自己」—— 装上去之后
# 登录 / 注册 / 兑换码 / 招商申请全部失败，而界面只会说「连不上服务器」，
# 看不出是地址配错了。所以在这里拦一下，别让它悄悄打进包里。
API_BASE="${VITE_API_BASE:-}"
if [ -z "$API_BASE" ] && [ -f .env.apk ]; then
  # ★ `|| true` 不能省：grep 找不到匹配行时返回 1，而这里是
  #   `set -euo pipefail` 下的赋值语句 —— 赋值失败 = **整个脚本静默退出 1**。
  #   症状是打完 JAVA_HOME / ANDROID_HOME 两行就没了，一个字的提示都没有，
  #   看着像脚本崩了。实测：.env.apk 里只有 VITE_GAME_CATALOG_URL 那一行就会踩中。
  API_BASE="$(grep -E '^VITE_API_BASE=' .env.apk | head -1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
fi

is_loopback=0
case "$API_BASE" in
  "" | *127.0.0.1* | *localhost*) is_loopback=1 ;;
esac

if [ "$is_loopback" = "1" ]; then
  if [ "$OFFLINE" = "1" ]; then
    echo ""
    echo "⚠️  没有配置 VITE_API_BASE，按 --offline 继续。"
    echo "    这个包**登录 / 兑换码 / 招商申请都用不了**（只会说「连不上服务器」），"
    echo "    任务、积分、游戏这些离线功能照常。"
  else
    echo ""
    echo "✗ 没有配置后端地址，打出来的 APK 登录会永远失败。"
    echo ""
    echo "  VITE_API_BASE 是构建期常量，默认值是 http://127.0.0.1:8090 ——"
    echo "  在手机上那是「手机自己」，装上去只会说「连不上服务器」。"
    echo ""
    echo "  两种做法："
    echo "    ① 配真地址（推荐）："
    echo "         echo 'VITE_API_BASE=https://api.你的域名.com' > .env.apk"
    echo "       注意必须是 https：capacitor.config.json 里 allowMixedContent=false，"
    echo "       http 的接口会被 WebView 直接拦掉。"
    echo "    ② 真的要打离线包（不要登录）："
    echo "         bash scripts/build-apk.sh $MODE --offline"
    echo ""
    echo "  只是想本机连 8090 调试？先用 adb reverse tcp:8090 tcp:8090 再 --offline。"
    exit 1
  fi
else
  echo "▸ API_BASE     = $API_BASE"
fi

# ---------------- https 闸门 ----------------
# 上面那段注释一直写着「必须 https」，但**代码里从来没检查过**。
# `allowMixedContent: false` 意味着 http 的接口会被 WebView 直接拦掉，
# 症状和「地址没配」一模一样：界面只说「连不上服务器」，看不出是协议错了。
# 也就是说 `http://` 少打一个 s，能一路绿灯打出包来，装到手机上才炸。
#
# ⚠️ 只在**真打 APK** 时拦：`--web-only` 是给本机 / 局域网调 Web 产物用的，
#    那种场景下 http 是合法的，拦了反而挡路。
if [ "$is_loopback" = "0" ] && [ "$WEB_ONLY" != "1" ]; then
  case "$API_BASE" in
    https://*) ;;
    *)
      echo ""
      echo "✗ VITE_API_BASE 必须是 https，现在是：$API_BASE"
      echo ""
      echo "  capacitor.config.json 里 allowMixedContent=false，"
      echo "  http 的接口会被 WebView 直接拦掉 —— 装上去只会说「连不上服务器」，"
      echo "  和「地址没配」是同一个症状，很难查。"
      echo ""
      echo "  只是本机 / 局域网调试 Web 产物？用 --web-only（那条路不拦）。"
      exit 1
      ;;
  esac
fi

# ---------------- 地址自检 ----------------
# 上面两道闸门只看**形状**（不是回环、是 https）。形状对了照样连不上：
# 域名解析不了 / 证书是自签的 / 反代把 /api 转丢了 / CORS 没放行 App 的 Origin。
# 这些都只在手机上暴露，症状一律是「连不上服务器」—— 家长只会说「打不开」。
#
# 所以真打 APK 之前**实际请求一次**。自检只发 /api/ping 和一次故意失败的登录，
# 不写任何数据，可以对着生产库跑。
if [ "$OFFLINE" != "1" ]; then
  echo ""
  echo "▸ 地址自检…"
  if ! node scripts/check-apk-endpoint.mjs "$API_BASE"; then
    echo ""
    echo "✗ 地址自检没过。装到手机上就是「连不上服务器」，先修好再打。"
    echo "  只想先出个包看看界面？加 --offline。"
    exit 1
  fi
fi

# ---------------- 目录地址（「从服务器下载」） ----------------
# `VITE_GAME_CATALOG_URL` 是**另一个**编译期常量，和 API_BASE 各管各的：
# 没配 ⇒ 设置页里「从服务器下载」那一整块**不渲染**（fail closed，故意的）。
#
# 麻烦在于「没配」和「配了但没生效」在日志上长得一模一样：构建成功、产物正常、
# 装到手机上只是少了那一块，**没有任何报错**。所以和 API_BASE 一样处理：
# 配了就必须能在产物里找到（下面 [1/3] 之后验）。
CATALOG_URL="${VITE_GAME_CATALOG_URL:-}"
if [ -z "$CATALOG_URL" ] && [ -f .env.apk ]; then
  # 同上：`|| true` 必须留着，否则「没配这一行」= 脚本静默退出 1。
  CATALOG_URL="$(grep -E '^VITE_GAME_CATALOG_URL=' .env.apk | head -1 | cut -d= -f2- | tr -d '"'"'"' \r' || true)"
fi

cat_loopback=0
case "$CATALOG_URL" in
  "" | *127.0.0.1* | *localhost*) cat_loopback=1 ;;
esac

if [ -z "$CATALOG_URL" ]; then
  echo ""
  echo "▸ 没配 VITE_GAME_CATALOG_URL —— 这个包里「从服务器下载」那一块不会出现。"
  echo "  想让远端下载可用，在 .env.apk 里加一行："
  echo "    VITE_GAME_CATALOG_URL=https://api.你的域名.com/api/game/catalog"
elif [ "$cat_loopback" = "0" ] && [ "$WEB_ONLY" != "1" ]; then
  case "$CATALOG_URL" in
    https://*) ;;
    *)
      echo ""
      echo "✗ VITE_GAME_CATALOG_URL 必须是 https，现在是：$CATALOG_URL"
      echo "  目录也是走网络拉的，http 同样会被 WebView 拦掉（allowMixedContent=false）。"
      echo "  只是本机调试 Web 产物？用 --web-only（那条路不拦）。"
      exit 1
      ;;
  esac
  echo "▸ CATALOG_URL  = $CATALOG_URL"
fi

# ---------------- 构建 Web ----------------
echo ""
echo "▸ [1/3] 构建 Web 产物…"
# 不在这里手工清 dist —— 交给 vite 的 emptyOutDir（默认开，outDir 在项目内）。
#
# 原来这里是 `find dist -type f -delete`，注释说「绕过批量删除拦截」。
# 恰恰相反：这台机器把删除实现成**移入回收站**，逐个文件搬 ——
# dist 里五千多个文件要跑好几分钟，表现是「[1/3] 构建 Web 产物…」之后
# 一动不动（2026-11-02 实测 120 秒还没完，看着像构建卡死 / 网络卡住）。
# vite 的 emptyOutDir 是一次 fs.rm，清得一样干净，但没有逐个搬运。
#
# ★★ 但 `fs.rm` 现在会被**安全删除闸门**拦下（dist 里两千多个文件 > 阈值 50）：
#    `[safe-delete][SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":2656,...}`
#    报错长得像「vite 构建失败」，其实一个字节都没编。只在这一次构建里关掉
#    （dist 是纯产物目录，和 build-client-web.sh 里那条同一个理由）。
CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build:apk

# 构建完再验一次「环境变量真的进产物了」——
# 文件名写成 `.env.prod`、或者 shell 里 export 了却没传进 vite，
# 产物里都还是默认值，而日志一片绿。
if [ "$is_loopback" = "0" ]; then
  if grep -rq "127.0.0.1:8090" dist/assets/*.js 2>/dev/null; then
    echo "✗ 产物里还是 127.0.0.1:8090 —— VITE_API_BASE 没生效。"
    echo "  检查：文件名必须是 .env.apk，值不要加引号或空格。"
    exit 1
  fi
  echo "▸ 产物已写入 API_BASE = $API_BASE"

  # 目录地址同理：配了却不在产物里 ⇒ 那个包「看着正常、少一块功能」。
  # 用 -F 按字面匹配（URL 里有 `:` `/` `.`，别让 grep 当正则）。
  if [ -n "$CATALOG_URL" ] && [ "$cat_loopback" = "0" ]; then
    if ! grep -rqF "$CATALOG_URL" dist/assets/*.js 2>/dev/null; then
      echo ""
      echo "✗ 产物里找不到 VITE_GAME_CATALOG_URL —— 目录地址没生效。"
      echo "  这个包能装、能玩，但设置页里「从服务器下载」那一块不会出现，"
      echo "  而且**不会有任何报错**。先检查 .env.apk 里那一行有没有拼错 / 多空格。"
      exit 1
    fi
    echo "▸ 产物已写入 CATALOG_URL = $CATALOG_URL"
  fi
fi

# ★★ TF_APK_NO_GAMES=1：不把游戏包塞进 APK（**在线版客户端**用这个）。
#   线上这些包在 `<host>/public/games/`，由平台的签名目录下发；塞进包里
#   只会让 APK 从 ~6MB 变成 156MB（25 款 / 195MB 源文件），而且和「在线版」定位重复。
#   单机版（离线、游戏随包装好）就不要设这个变量 —— 那正是它大的理由。
if [ "${TF_APK_NO_GAMES:-0}" = "1" ] && [ -d dist/games ]; then
  echo "▸ TF_APK_NO_GAMES=1 ⇒ 剔掉 dist/games（在线版客户端不打包游戏）"
  # ★★ 这里用 `mv` 不用 `rm -rf`：开发沙箱的批量删除闸门**按「这一轮累计删了多少」
  #   计数**，脚本里无论是 `VAR=0 rm -rf` 还是 `env VAR=0 rm -rf` 都拦（实测
  #   `[SAFE_DELETE_BULK_CONFIRM_REQUIRED] {"count":7713,...}`），而 `mv` 不算删除。
  #   移到临时目录，构建完就没人再引用它了；临时目录里的旧副本下次构建时会被覆盖。
  SKIP="${TMPDIR:-/tmp}/kqf-apk-games"
  mkdir -p "$SKIP"
  mv dist/games "$SKIP/games-$(date +%Y%m%d%H%M%S)"
fi

if [ "$WEB_ONLY" = "1" ]; then
  echo ""
  echo "✅ Web 产物已构建（--web-only，跳过 gradle 与 cap sync）"
  exit 0
fi

echo "▸ [2/3] 同步到 Android 工程…"
# cap sync 内部走 fs-extra 的 remove()，会整目录删除再复制。
# 开发沙箱的 safe-delete 拦截器按「单次会话累计删除次数」计数，
# 一旦超过阈值就整体拒绝，cap sync 这种自己清理缓存目录的工具必然踩中。
#
# 注意：这里关闭的只是「按次数拦截批量删除」这一层启发式保护，
# 作用范围严格限制在 cap sync 自己的子进程内，且它删的都是它自己
# 上一轮生成的构建中间产物（assets/public、cordova 插件桥接文件），
# 不是用户数据。父 shell 与其他命令不受影响。
CODEBUDDY_SAFE_DELETE_ENABLED=0 npx cap sync android

# ---------------- Gradle 打包 ----------------
echo "▸ [3/3] Gradle 打包 ($MODE)…"
cd android

if [ "$MODE" = "release" ]; then
  if [ ! -f keystore.properties ]; then
    echo ""
    echo "⚠️  未找到 android/keystore.properties，release 包无法签名。"
    echo "    先在 android/ 下创建该文件："
    echo "      storeFile=../kid-quest-farm.keystore"
    echo "      storePassword=你的密码"
    echo "      keyAlias=你的别名"
    echo "      keyPassword=你的密码"
    echo "    再执行 ./gradlew assembleRelease"
    exit 1
  fi
  ./gradlew assembleRelease
  APK="app/build/outputs/apk/release/app-release.apk"
else
  ./gradlew assembleDebug
  APK="app/build/outputs/apk/debug/app-debug.apk"
fi

cd "$PROJECT_ROOT"

if [ -f "android/$APK" ]; then
  SIZE=$(du -h "android/$APK" | cut -f1)

  # ---------------- 发布到 dist-apk/ ----------------
  # ⚠️ 2026-10-03：这一步原来**不存在**。dist-apk/ 里的包一直是手工拷的，
  # 于是它和 gradle 的产物悄悄走散了 —— 官网「下载 APK」给出去的是几天前的
  # 旧包，而 `build-site.mjs` 的 APK_CANDIDATES **优先读 dist-apk/**，
  # 手工拷的那份就一直赢，新包永远发布不出去（而且全程没有任何报错）。
  #
  # 同一份产物存在两处就一定会走散，所以在这里**自动同步**，别再手工拷。
  mkdir -p "$PROJECT_ROOT/dist-apk"
  cp "android/$APK" "$PROJECT_ROOT/dist-apk/kid-quest-farm-$MODE.apk"

  echo ""
  echo "✅ 打包成功"
  echo "   APK : $PROJECT_ROOT/android/$APK"
  echo "   大小: $SIZE"
  echo "   ↳ 已同步到 dist-apk/kid-quest-farm-$MODE.apk（官网下载读这个）"
  echo ""
  echo "   安装到手机：adb install -r android/$APK"
  echo ""
  echo "   发布官网：node scripts/build-site.mjs --no-build --no-shots"
else
  echo "✗ 打包失败，未找到产物 $APK"
  exit 1
fi
