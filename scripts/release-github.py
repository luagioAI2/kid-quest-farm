"""
发 GitHub Release（幂等 + 自推导 + 发布后自验）。

为什么不用 `gh`：这台机器上没装 gh，所以直接走 REST API。

★ 一切自推导，**不要**手工改常量
  ——「手工步骤一定会和产物走散」在本项目已经栽过两次
  （dist-apk 手工拷 → 官网给的是旧包；versionName 写两处 → 对不上）。

    version   ← android/app/build.gradle 的 versionName
    tag       ← v<version>
    target    ← git rev-parse HEAD
    asset     ← kid-quest-farm-<tag>.apk
    body      ← release-notes/<tag>.md（在仓库里，随代码一起走）

★ 代理拓扑是**互补**的，别搞混：

    git push（github.com）              → 用户自己的 7897
    api.github.com / uploads.github.com → 沙箱代理（默认环境变量）

  所以**这里不要**设 7897 的代理变量。
  令牌从 `~/.git-credentials` 读（不进 shell 历史、不打印）。

★ 三道守卫：
  1. tag 必须**已存在**，且它的提交**能从 HEAD 走到**（ancestor，不是「等于 HEAD」——
     发完版之后正常还会往 main 提交，那时 HEAD 越过 tag 不算错）—— 否则停，
     防止发出一个指向无关提交的 release；
  2. release 幂等：已存在就复用；
  3. 资源**按 sha256 判重**：已存在且一致就跳过（不做「先删后传」，那有中断窗口）；
     最后把资源**下载回来比对 sha256** —— 不比时间戳，比内容。

用法：
    python scripts/release-github.py --dry-run    # 只打印将要做什么，不写远端
    python scripts/release-github.py              # 真发
"""

import hashlib
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = "luagioAI2/kid-quest-farm"
API = "https://api.github.com"
GRADLE = ROOT / "android" / "app" / "build.gradle"
APK = ROOT / "dist-apk" / "kid-quest-farm-release.apk"
DRY = "--dry-run" in sys.argv


def die(msg):
    sys.exit(f"✗ {msg}")


# ---------- 令牌（脱敏） ----------
creds = (Path.home() / ".git-credentials").read_text(encoding="utf-8")
m = re.search(r"^https://[^:]+:([^@]+)@github\.com\s*$", creds, re.M)
if not m:
    die("~/.git-credentials 里找不到 github.com 的凭据")
TOKEN = m.group(1)

HDR = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kid-quest-farm-release",
}


def call(url, data=None, method="GET", headers=None, raw=False):
    h = dict(HDR)
    if headers:
        h.update(headers)
    body = data
    if data is not None and not raw:
        body = json.dumps(data).encode("utf-8")
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.loads(r.read().decode("utf-8"))


# ---------- 自推导 ----------
g = GRADLE.read_text(encoding="utf-8")
vm = re.search(r'versionName\s+"([^"]+)"', g)
if not vm:
    die("build.gradle 里找不到 versionName")
VERSION = vm.group(1)
vc = re.search(r"versionCode\s+(\d+)", g)
VERSION_CODE = vc.group(1) if vc else "?"
TAG = f"v{VERSION}"
TARGET = subprocess.run(
    ["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True
).stdout.strip()
ASSET_NAME = f"kid-quest-farm-{TAG}.apk"
BODY_FILE = ROOT / "release-notes" / f"{TAG}.md"

print(f"版本    {VERSION}（versionCode {VERSION_CODE}）")
print(f"tag     {TAG}")
print(f"target  {TARGET}")
print(f"资源    {ASSET_NAME}")
print(f"说明    {BODY_FILE.relative_to(ROOT)}")

if not APK.exists():
    die(f"找不到 {APK} —— 先跑 bash scripts/build-apk.sh release")
if not BODY_FILE.exists():
    die(f"找不到 {BODY_FILE} —— 先写这一版的发布说明")
if DRY:
    print("\n（--dry-run：只打印，不写远端）")
    sys.exit(0)

# ---------- 守卫 1：tag 必须存在，且它的提交必须能从 HEAD 走到 ----------
# 注意不是「tag == HEAD」：发完 v1.1.0 之后正常还会往 main 上提交（比如改文档），
# 那时 HEAD 已经越过 tag —— 那不算错。要拦的是「tag 指向一个跟 main 无关
# 或更旧的提交」，所以判据是 ancestor（git merge-base --is-ancestor）。
try:
    ref = call(f"{API}/repos/{REPO}/git/ref/tags/{TAG}")
    sha = ref["object"]["sha"]
    if ref["object"]["type"] == "tag":  # 附注标签要再解一层
        sha = call(f"{API}/repos/{REPO}/git/tags/{sha}")["object"]["sha"]
    anc = subprocess.run(
        ["git", "merge-base", "--is-ancestor", sha, TARGET], cwd=ROOT
    ).returncode
    if anc != 0:
        die(f"tag {TAG} 指向 {sha[:8]}，但它不是 HEAD（{TARGET[:8]}）的祖先 —— 先推对 tag 再发")
    same = "（就是 HEAD）" if sha == TARGET else f"（HEAD 已在其之后）"
    print(f"✓ tag {TAG} → {sha[:8]} 可从 HEAD 走到 {same}")
except urllib.error.HTTPError as e:
    if e.code == 404:
        die(f"远端没有 tag {TAG} —— 先 git push origin {TAG}")
    raise

# ---------- 守卫 2：release 幂等 ----------
try:
    rel = call(f"{API}/repos/{REPO}/releases/tags/{TAG}")
    print(f"⚠️ release {TAG} 已存在（id={rel['id']}），复用")
except urllib.error.HTTPError as e:
    if e.code != 404:
        raise
    rel = call(
        f"{API}/repos/{REPO}/releases",
        data={
            "tag_name": TAG,
            "target_commitish": TARGET,
            "name": f"小任务农场 {TAG}",
            "body": BODY_FILE.read_text(encoding="utf-8"),
            "draft": False,
            "prerelease": False,
        },
        method="POST",
    )
    print(f"✓ 已创建 release {rel['tag_name']}  id={rel['id']}")

# ---------- 守卫 3：按 sha256 判重，再上传 ----------
local_sha = hashlib.sha256(APK.read_bytes()).hexdigest()
print(f"本地 {APK.name}  {APK.stat().st_size} 字节  sha256={local_sha[:16]}…")

existing = next(
    (a for a in call(f"{API}/repos/{REPO}/releases/{rel['id']}/assets") if a["name"] == ASSET_NAME),
    None,
)
if existing:
    with urllib.request.urlopen(existing["browser_download_url"], timeout=300) as r:
        remote_sha = hashlib.sha256(r.read()).hexdigest()
    if remote_sha == local_sha:
        print("✓ 远端同名资源已是最新（sha256 一致），跳过上传")
    else:
        call(f"{API}/repos/{REPO}/releases/assets/{existing['id']}", method="DELETE")
        print(f"  旧资源 sha256 不一致（{remote_sha[:16]}…），已删，重新上传")
        existing = None

if not existing:
    asset = call(
        f"https://uploads.github.com/repos/{REPO}/releases/{rel['id']}/assets?name={ASSET_NAME}",
        data=APK.read_bytes(),
        method="POST",
        headers={"Content-Type": "application/vnd.android.package-archive"},
        raw=True,
    )
    print(f"✓ 资源已上传 {asset['name']}  {asset['size']} 字节")

# ---------- 自验：回下载比对 sha256 ----------
asset = next(
    a for a in call(f"{API}/repos/{REPO}/releases/{rel['id']}/assets") if a["name"] == ASSET_NAME
)
with urllib.request.urlopen(asset["browser_download_url"], timeout=300) as r:
    back = r.read()
back_sha = hashlib.sha256(back).hexdigest()
ok = back_sha == local_sha and len(back) == APK.stat().st_size
print(f"{'✓' if ok else '✗'} 回下载比对  {len(back)} 字节  sha256={back_sha[:16]}…  "
      f"{'逐字节一致' if ok else '不一致！'}")
print(f"\nrelease 页面：{rel['html_url']}")
if not ok:
    sys.exit("✗ 资源回下载校验失败")
