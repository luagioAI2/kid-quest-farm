#!/usr/bin/env bash
# 变异验证：把每条新守卫「弄坏」，确认它真的会红。
# 只读/只改工作区文件，跑完用 git checkout 还原到 HEAD。
set -uo pipefail
cd "$(dirname "$0")/.."

# ⚠️ 别写成 `npx vitest … | grep -q "Tests N failed"`。
#    vitest 在「有测试失败」时**退出码非 0**，而 `set -o pipefail` 会把
#    整条管道的状态判成那个非 0 —— 于是「红了」被读成「没红」，
#    12 条变异全部报 GREEN，看起来像守卫全失效（第一版就是这么翻车的）。
#    先把输出落盘、再单独 grep，vitest 的退出码就影响不到判断了。
# ⚠️⚠️ 必须带 `NO_COLOR=1`。vitest 默认给摘要行上色，
#    `Tests \e[22m \e[1m\e[31m1 failed` —— 「Tests」和「1 failed」之间
#    夹着转义序列，`grep -E "Tests +[0-9]+ failed"` **永远匹配不上**。
#    第二版就是这么翻车的：12 条变异又全报 GREEN，而且这次连
#    「日志里明明写着 1 failed」都看不出来，只有 `cat -A` 才现形。
#    教训：拿文本当判据之前，先确认那行文本长什么样（`cat -A`）。
LOG=$(mktemp)
run() { NO_COLOR=1 npx vitest run --config vitest.config.ts "$1" -t "$2" >"$LOG" 2>&1 || true; }

# 变异有效 = 至少跑了 1 条测试、且有测试失败。
# 只 grep「failed」是不够的：`-t` 打错字时 vitest 会跑 0 条测试然后正常退出，
# 那也是「没红」，但原因完全不同（守卫根本没被碰到）。
red() {
  run "$1" "$2"
  grep -qE "Tests +[0-9]+ failed" "$LOG" || return 1
  grep -qE "Tests +[0-9]+ (passed|failed)" "$LOG" || return 1
  # 排除「failed 0」这种（vitest 不这么打，但防一手）
  grep -qE "Tests +0 failed" "$LOG" && return 1
  return 0
}

pass=0
fail=0

check() { # name file testname
  if red "$2" "$3"; then
    echo "  RED  ✓ $1"
    pass=$((pass + 1))
  else
    echo "  GREEN ✗ $1   <-- 守卫没红！"
    echo "         （实际输出：$(grep -E 'Tests +' "$LOG" | head -1 | sed 's/^ *//'))"
    fail=$((fail + 1))
  fi
}

mutate() { # file python-expression
  python - "$1" "$2" <<'PY'
import io, sys
p, kind = sys.argv[1], sys.argv[2]
s = io.open(p, encoding='utf-8').read()
reps = {
 'm1': ("return clampTierRatio(task.checkInTierRatio)",
        "return clampTierRatio(task.checkInTierRatio || undefined)"),
 'm2': ("return clampStreakPerDay(task.streakPerDay)",
        "return clampStreakPerDay(task.streakPerDay || undefined)"),
 'm3': ("checkInTierRatio: checkInEnabled && tierRatioOn ? effectiveTierRatio : undefined,",
        "checkInTierRatio: checkInEnabled ? effectiveTierRatio : undefined,"),
 'm4': ("? defaultTiers(cycle, checkInTargetCount, basePoints, effectiveTierRatio) : []",
        "? defaultTiers(cycle, checkInTargetCount, basePoints, defaultTierRatio) : []"),
 'm5': ("const perDay = streakPerDayFor(task)",
        "const perDay = streakPerDayFor({})"),
 'm6': ("const ratio = tierRatioFor(task)",
        "const ratio = tierRatioFor({})"),
 'm7': ("        {isPeriod && (", "        {true && ("),
 'm8': ("{!settings.streakBonusEnabled && (", "{false && ("),
 'm9': ("export const TIER_RATIO_PRESETS = [0.2, 0.4, 0.6, 0.8, 1.0, 1.5] as const",
        "export const TIER_RATIO_PRESETS = [0.4, 0.4, 0.6, 0.8, 1.0, 1.5] as const"),
 'm10': ("return defaultTiers(task.cycle, target, task.basePoints, tierRatioFor(task))",
         "return defaultTiers(task.cycle, target, task.basePoints, tierRatioFor({}))"),
 # M11 的目标是「签到详情整块」的外层门（`checkInEnabled`），
 # 不是里面那个 `tierRatioOn` —— 只把 tierRatioOn 变 true，
 # 长期任务上因为 checkInEnabled 是 false 根本渲染不到，变异等于没做。
 'm11': ("""          {checkInEnabled && (
            <div className="anim-fade-in space-y-3 rounded-2xl border border-sun-300 bg-sun-50 p-3">""",
          """          {true && (
            <div className="anim-fade-in space-y-3 rounded-2xl border border-sun-300 bg-sun-50 p-3">"""),
 'm12': ("streakPerDay: isPeriod && streakOn ? effectiveStreakPerDay : undefined,",
         "streakPerDay: isPeriod ? effectiveStreakPerDay : undefined,"),
}
old, new = reps[kind]
assert old in s, 'mutation target not found: ' + kind
io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
PY
}

revert() { git checkout -- "$1"; }

T=src/domain/tierRatio.test.ts
S=src/domain/streakBonus.test.ts
E=src/features/tasks/TaskEditor.tiers.test.tsx
U=src/store/useApp.test.ts
D=src/db/db.test.ts

echo "== M1 tierRatioFor 用 || 代替「只看 null =="
mutate src/domain/tierRatio.ts m1; check "tierRatioFor 的 0 守卫" $T "0 也算"
revert src/domain/tierRatio.ts

echo "== M2 streakPerDayFor 用 || =="
mutate src/domain/streakBonus.ts m2; check "streakPerDayFor 的 0 守卫" $S "0 也算"
revert src/domain/streakBonus.ts

echo "== M3 保存时不管开关，永远写覆盖值 =="
mutate src/features/tasks/TaskEditor.tsx m3; check "关掉覆盖要删字段" $E "字段被真的删掉"
revert src/features/tasks/TaskEditor.tsx

echo "== M4 阶梯预览忽略任务自己的倍率 =="
mutate src/features/tasks/TaskEditor.tsx m4; check "点 20% 阶梯要跟着变" $E "上面那几档跟着变小"
revert src/features/tasks/TaskEditor.tsx

echo "== M5 发连击时忽略任务自己的设置 =="
mutate src/store/useApp.ts m5; check "任务自己的连击设置要生效" $U "发的是 10，不是设置里的 2"
revert src/store/useApp.ts

echo "== M6 发阶梯时忽略任务自己的倍率 =="
mutate src/domain/recurrence.ts m6; check "任务自己的阶梯倍率要生效" $U "阶梯按 20% 发"
revert src/domain/recurrence.ts

echo "== M7 今日任务也渲染连击设置 =="
mutate src/features/tasks/TaskEditor.tsx m7; check "今日任务不许有连击设置" $E "没有\*\*连击设置"
revert src/features/tasks/TaskEditor.tsx

echo "== M8 全局开关关着时不提醒 =="
mutate src/features/tasks/TaskEditor.tsx m8; check "全局关着要提醒" $E "设了也不会发"
revert src/features/tasks/TaskEditor.tsx

echo "== M9 档位常量首项被改坏 =="
mutate src/domain/tierRatio.ts m9; check "档位常量首尾=上下限" $T "首尾两项就是夹取上下限"
revert src/domain/tierRatio.ts

echo "== M10 tiersFor 忽略任务倍率 =="
mutate src/store/useApp.ts m10; check "tiersFor 跟着任务倍率" $U "tiersFor 跟着任务自己的倍率走"
revert src/store/useApp.ts

echo "== M11 长期任务也渲染阶梯倍率开关 =="
mutate src/features/tasks/TaskEditor.tsx m11; check "长期任务不许有阶梯开关" $E "没有\*\*阶梯倍率开关"
revert src/features/tasks/TaskEditor.tsx

echo "== M12 保存时不管连击开关 =="
mutate src/features/tasks/TaskEditor.tsx m12; check "连击覆盖也要能关掉" $E "两个字段都被删掉"
revert src/features/tasks/TaskEditor.tsx

echo
rm -f "$LOG"
echo "结果：红了 $pass 条，没红 $fail 条"
[ "$fail" -eq 0 ]
