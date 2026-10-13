#!/usr/bin/env bash
# 变异验证：把「动物特殊效果」的每条守卫「弄坏」，确认它真的会红。
#
#   bash scripts/mutate-farm-traits.sh
#
# ── 2026-10-12 第一版翻车记录（三条，全都会让结果**静默变假**）────────
#
# ① **`mktemp -d` 在本机返回的是 Windows 路径**（`C:\Users\...\Temp\tmp.xxx`）。
#    把它拼进 `$BACKUP/xxx` 之后，Git Bash 会解析成
#    `/e/plan/test25/kid-quest-farm/C:/Users/.../tmp.xxx/xxx` —— **不存在的目录**。
#    于是 `cp` 备份**静默失败**（`set -uo pipefail` 里没有 `-e`），
#    `revert` 也就复制不回任何东西 → **变异留在工作区里了**。
#    更坏的是：第一次跑被 SIGTERM 掐掉，T9 的变异就此留在 `catalog.ts` 里，
#    第二次跑时 T9 的锚点「找不到」（因为已经被改过了），
#    而残留的变异又让测试红了 —— 看起来像「守卫正常工作」。
#    ➜ 备份目录改成**仓库内**的 `.e2e-scratch/.mutate-backup`（已 gitignore），
#      并且每次 `cp` 都检查退出码。
#
# ② **锚点不唯一时，脚本把「没应用上」报成了「守卫没红」。**
#    T3 的锚点 `multiplier: NEUTRAL_MULT,` 在文件里出现 2 次，
#    python 退出 4、**没改任何东西**，然后 check 在**原文件**上跑测试 →
#    测试当然通过 → 打印 `GREEN ✗ 守卫没红！`。
#    这是**假警报**，而且方向最坏：会让人去「加固」一条本来就好的守卫。
#    ➜ 现在分三类结果：RED（守卫有效）/ GREEN（守卫真的失效）/
#      **SETUP ✗（变异没应用上，脚本的锅）**，而且 SETUP 直接中止。
#
# ③ **锚点会被当成正则**（vitest 的 `-t`）。测试名里有 `**`（markdown 加粗）时
#    `**` 是非法量词 —— 所以下面挑的都是不含 `*` 的子串。
#
# 另外：整轮要跑 ~3 分钟（9 条变异 × vitest 冷启动）。前台跑会被超时掐掉，
# 建议 `bash scripts/mutate-farm-traits.sh > .e2e-scratch/mutate-farm.log 2>&1 &`
# 或者后台跑 —— 被掐掉**正好会制造上面第 ① 条那个残留**。
set -uo pipefail
cd "$(dirname "$0")/.."

LOG=".e2e-scratch/.mutate-farm.log"
# ⚠️ 备份目录必须在**仓库内**。见文件头第 ① 条：本机 `mktemp -d` 返回
#    Windows 路径，拼进 Git Bash 的相对路径后会指向不存在的目录，
#    `cp` 静默失败 → 变异留在工作区里。
BACKUP=".e2e-scratch/.mutate-backup"
mkdir -p .e2e-scratch
rm -rf "$BACKUP"
mkdir -p "$BACKUP"
slot() { echo "$BACKUP/$(echo "$1" | tr '/' '_')"; }

# ⚠️ vitest 有失败时退出码非 0，`set -o pipefail` 会把管道判成非 0 ——
#    「红了」会被读成「没红」。所以先落盘、再单独 grep。
# ⚠️⚠️ 必须带 `NO_COLOR=1`：vitest 给摘要行上色，「Tests」和「1 failed」之间
#    夹着转义序列，`grep -E "Tests +[0-9]+ failed"` **永远匹配不上**，
#    于是全部变异报 GREEN，看起来像守卫集体失效。
run() { NO_COLOR=1 npx vitest run --config vitest.config.ts "$1" -t "$2" >"$LOG" 2>&1 || true; }

# 变异有效 = 至少跑了 1 条测试、且有测试失败。
# 只 grep「failed」不够：`-t` 打错字时 vitest 跑 0 条测试然后正常退出，
# 那也是「没红」，但原因完全不同（守卫根本没被碰到）。
red() {
  run "$1" "$2"
  grep -qE "Tests +[0-9]+ failed" "$LOG" || return 1
  grep -qE "Tests +[0-9]+ (passed|failed)" "$LOG" || return 1
  grep -qE "Tests +0 failed" "$LOG" && return 1
  return 0
}

# 变异表：id → (文件, 锚点, 替换)。**文件路径只有这一个来源**，
# 免得 shell 里再写一份、两边漂开。
run_py() {
  python - "$@" <<'PY'
import io, sys

M = {
 # ---- farmEvents.ts：机制本身 ----
 't1': ('src/domain/farmEvents.ts',
        "hashRandom(seed + 11) < trait.chance",
        "hashRandom(seed + 11) < 0"),
 # T2 效果无条件触发（无视 chance）—— 专打「chance = 0 等于没写效果」那条反向验证
 't2': ('src/domain/farmEvents.ts',
        "hashRandom(seed + 11) < trait.chance",
        "hashRandom(seed + 11) < 1"),
 # T3 挡掉之后按 1 结算（会超过满产，多出来的卖不掉）。
 # ⚠️ 锚点必须带上后面两行 —— 单独一句 `multiplier: NEUTRAL_MULT,` 出现 2 次，
 #    不唯一的话 python 会拒改，那次的「没红」就是假警报。
 't3': ('src/domain/farmEvents.ts',
        "      multiplier: NEUTRAL_MULT,\n      wipedOut: false,\n      warded: true,",
        "      multiplier: 1,\n      wipedOut: false,\n      warded: true,"),
 # T4 去掉 `!isGood` 兜底 —— 好档被写进 wards 时就会反过来减产
 't4': ('src/domain/farmEvents.ts',
        "if (trait && !isGood && trait.wards.includes(kind)",
        "if (trait && trait.wards.includes(kind)"),
 # T5 无视 wards 声明，什么坏档都挡 —— 效果变成「一键无敌」
 't5': ('src/domain/farmEvents.ts',
        "trait.wards.includes(kind) && hashRandom(seed + 11)",
        "true && hashRandom(seed + 11)"),
 # T6 中性档不再从表里取，改成另一个数（表改了它也不会跟着动）
 't6': ('src/domain/farmEvents.ts',
        "export const NEUTRAL_MULT = HARVEST_TIERS.find((t) => t.kind === 'none')!.lo",
        "export const NEUTRAL_MULT = 0.95"),
 # ---- catalog.ts：数据契约 ----
 # T7 数据上写了效果，概率却是 0（永远不生效）
 't7': ('src/domain/catalog.ts', "      chance: 0.6,", "      chance: 0,"),
 # T8 往 wards 里塞一个好档（数据契约用例必须拦下来）
 't8': ('src/domain/catalog.ts',
        "      wards: ['pest', 'disease'],",
        "      wards: ['pest', 'disease', 'weather_good'],"),
 # T9 效果没有成功提示 —— 界面说不出来，孩子学不到
 't9': ('src/domain/catalog.ts',
        "      wardMsg: '赐福了这一批',",
        "      wardMsg: '',"),
}

def load(p):
    return io.open(p, encoding='utf-8').read()

mode = sys.argv[1]

if mode == 'check':
    bad = []
    for k in sorted(M):
        p, old, _new = M[k]
        try:
            n = load(p).count(old)
        except IOError as e:
            bad.append('%s: 读不到 %s (%s)' % (k, p, e))
            continue
        if n != 1:
            bad.append('%s: 锚点在 %s 里出现 %d 次（必须恰好 1 次）' % (k, p, n))
    if bad:
        sys.stderr.write('预检失败：\n  ' + '\n  '.join(bad) + '\n')
        sys.exit(2)
    print('  锚点预检通过（%d 条，全部唯一）' % len(M))
    sys.exit(0)

if mode == 'path':
    sys.stdout.write(M[sys.argv[2]][0])
    sys.exit(0)

if mode == 'apply':
    k = sys.argv[2]
    p, old, new = M[k]
    s = load(p)
    if s.count(old) != 1:
        sys.stderr.write('anchor not unique for %s (%d hits)\n' % (k, s.count(old)))
        sys.exit(3)
    io.open(p, 'w', encoding='utf-8', newline='').write(s.replace(old, new, 1))
    sys.exit(0)

sys.stderr.write('unknown mode: %s\n' % mode)
sys.exit(9)
PY
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

# 变异没应用上 → 直接中止。**绝不能**继续跑 check ——
# 在原文件上跑测试必然通过，会被报成「守卫没红」，把人引去加固一条好守卫。
mutate() { # id
  local f
  f=$(run_py path "$1") || { echo "  SETUP ✗ 取不到 $1 的文件路径"; exit 2; }
  cp "$f" "$(slot "$f")" || { echo "  SETUP ✗ 备份 $f 失败"; exit 2; }
  cmp -s "$f" "$(slot "$f")" || { echo "  SETUP ✗ 备份内容与 $f 不一致"; exit 2; }
  if ! run_py apply "$1"; then
    echo "  SETUP ✗ 变异 $1 没应用上（锚点不唯一 / 找不到）—— 脚本的问题，不是守卫的问题"
    exit 2
  fi
  cmp -s "$f" "$(slot "$f")" && { echo "  SETUP ✗ 变异 $1 跑完但文件没变"; exit 2; }
  return 0
}

# 还原之后**校验**一次。第一次翻车就是还原静默失败、变异留在工作区里。
revert() { # id
  local f
  f=$(run_py path "$1") || exit 2
  cp "$(slot "$f")" "$f" || { echo "  SETUP ✗ 还原 $f 失败"; exit 2; }
  cmp -s "$f" "$(slot "$f")" || { echo "  SETUP ✗ 还原后 $f 和备份不一致"; exit 2; }
}

echo "— 预检 —"
run_py check || { echo "预检没过 —— 先修锚点，别急着看结果"; exit 2; }

TF=src/domain/farmEvents.test.ts

echo "== T1 效果永远不触发 =="
mutate t1; check "带效果的动物期望产出确实更高" $TF "带效果的动物期望产出确实更高"
revert t1

echo "== T2 效果无条件触发（无视 chance）=="
mutate t2; check "chance = 0 等于完全没写效果" $TF "chance = 0 等于完全没写效果"
revert t2

echo "== T3 挡掉之后按 1 结算 =="
mutate t3; check "挡掉后必须是中性档" $TF "声明过的坏档一个都漏不掉"
revert t3

echo "== T4 去掉 !isGood 兜底 =="
mutate t4; check "好档写进 wards 不会反过来减产" $TF "万一有人把好档写进 wards"
revert t4

echo "== T5 无视 wards，什么坏档都挡 =="
mutate t5; check "没声明的坏档照旧会来" $TF "声明过的坏档一个都漏不掉"
revert t5

echo "== T6 中性档不从表里取 =="
mutate t6; check "中性档倍率从表里取" $TF "从表里取"
revert t6

echo "== T7 数据上写了效果，概率却是 0 =="
mutate t7; check "概率必须在 (0, 1] 内" $TF "真的会掷出来的坏档"
revert t7

echo "== T8 往 wards 里塞一个好档 =="
mutate t8; check "wards 只能是坏档" $TF "真的会掷出来的坏档"
revert t8

echo "== T9 效果没有成功提示 =="
mutate t9; check "每个效果都能显示出来" $TF "每个效果都能显示出来"
revert t9

echo
echo "结果：红了 $pass 条，没红 $fail 条"
echo "（另：跑完请 `git diff --stat` 确认工作区没有残留变异）"
[ "$fail" -eq 0 ]
