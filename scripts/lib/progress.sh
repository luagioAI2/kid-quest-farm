#!/usr/bin/env bash
# 打包 / 发布时的「进度提示」小工具（2026-11-13 用户要求）。
#
# 为什么需要：`gradlew assembleRelease` 和 `vite build` 都是**几分钟不出声**的，
# 而终端里一片安静的样子和「卡死」完全一样 —— 用户会以为脚本挂了，
# 于是 Ctrl+C 掉，然后拿到一个半成品包（甚至没打包）。
#
# 规矩：
#   · 每一步都写「第几步 / 共几步」，用户知道还剩多久；
#   · 长命令每 5 秒打一个已用时长，证明它活着；
#   · 失败时把**整段输出**留在日志里，并在屏幕上指出日志路径。
#
# 用法（被其它脚本 source）：
#   source scripts/lib/progress.sh
#   kqf_step 2 5 "打 APK（约 2-3 分钟）"
#   kqf_run "打 APK" ./gradlew assembleRelease
set -uo pipefail

# 颜色只在真终端里开（重定向到文件时留着会污染日志）
if [ -t 1 ]; then
  KQF_C_CYAN=$'\033[36m'; KQF_C_GREEN=$'\033[32m'; KQF_C_RED=$'\033[31m'
  KQF_C_DIM=$'\033[2m'; KQF_C_OFF=$'\033[0m'
else
  KQF_C_CYAN=''; KQF_C_GREEN=''; KQF_C_RED=''; KQF_C_DIM=''; KQF_C_OFF=''
fi

# 总步数与当前步
KQF_TOTAL=${KQF_TOTAL:-0}
KQF_NO=${KQF_NO:-0}

# kqf_plan <总步数> —— 一开始声明总共有几步
kqf_plan() { KQF_TOTAL="$1"; KQF_NO=0; }

# kqf_step <标题> —— 进入下一步（自动 +1，和总步数一起显示）
kqf_step() {
  KQF_NO=$((KQF_NO + 1))
  if [ "$KQF_TOTAL" -gt 0 ]; then
    printf '\n%s▸ [%d/%d] %s%s\n' "$KQF_C_CYAN" "$KQF_NO" "$KQF_TOTAL" "$1" "$KQF_C_OFF"
  else
    printf '\n%s▸ %s%s\n' "$KQF_C_CYAN" "$1" "$KQF_C_OFF"
  fi
  KQF_STEP_START=$(date +%s)
}

# 距上一步/本步开始过了多少秒（给「这一步用了 12s」用）
kqf_elapsed() { echo $(( $(date +%s) - ${KQF_STEP_START:-$(date +%s)} )); }

# kqf_ok <文字> —— 子步骤成功
kqf_ok() { printf '  %s✓%s %s\n' "$KQF_C_GREEN" "$KQF_C_OFF" "$1"; }

# kqf_warn <文字>
kqf_warn() { printf '  ⚠️  %s\n' "$1"; }

# kqf_fail <文字> —— 失败并退出 1
kqf_fail() { printf '  %s✗ %s%s\n' "$KQF_C_RED" "$1" "$KQF_C_OFF" >&2; exit 1; }

# kqf_hint <文字> —— 次要信息
kqf_hint() { printf '  %s%s%s\n' "$KQF_C_DIM" "$1" "$KQF_C_OFF"; }

# kqf_run <日志名> <命令...>
#   跑一条长命令，每 5 秒打一次已用时长。输出全部进日志，失败才打尾部。
#
# ⚠️ 必须把命令**原样**传进来（不要拼成字符串再 eval）：
#   路径里有空格（`Program Files`）时 eval 会把它拆开。
kqf_run() {
  local name="$1"; shift
  local log="${KQF_LOG_DIR:-.}/$name.log"
  mkdir -p "${KQF_LOG_DIR:-.}"

  "$@" > "$log" 2>&1 &
  local pid=$!
  local start; start=$(date +%s)
  local tick=0
  while kill -0 "$pid" 2>/dev/null; do
    sleep 1
    tick=$((tick + 1))
    # 每 5 秒一行心跳，用 \r 回到行首，不刷屏
    if [ $((tick % 5)) -eq 0 ]; then
      printf '\r  %s… %ds%s' "$KQF_C_DIM" "$tick" "$KQF_C_OFF"
    fi
  done
  printf '\r%*s\r' 40 ''   # 擦掉心跳那行

  wait "$pid"
  local code=$?
  local cost=$(( $(date +%s) - start ))
  if [ "$code" -ne 0 ]; then
    printf '  %s✗ %s 失败（%ds）%s\n' "$KQF_C_RED" "$name" "$cost" "$KQF_C_OFF" >&2
    printf '  —— 最后 20 行（完整日志：%s）——\n' "$log" >&2
    tail -20 "$log" >&2
    exit "$code"
  fi
  printf '  %s✓%s %s（%ds）\n' "$KQF_C_GREEN" "$KQF_C_OFF" "$name" "$cost"
  return 0
}
