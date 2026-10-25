#!/usr/bin/env python
"""
把三个游戏的真机截图转成商店用的 webp（`public/store/<id>/<n>.webp`）。

## 为什么要转，不直接引用

源图是 780×1688 的 PNG（每张 300~600 KB）。三款游戏 × 4 张直接塞进 `public/`
就是 5 MB 级别的增量，而 APK 体积是这个项目一直在盯的东西。
转成 360 宽的 webp 之后每张 ~20 KB，**总量 < 300 KB**，观感在平板上也够。

## 为什么源图在外面

`cloudfarm/` / `prize-park-local/` / `claw-machine/` 都不在本仓库里（它们是
独立的游戏工程）。这个脚本是**开发期工具**，产出物（`public/store/`）才是随
App 发布的东西 —— 所以别人 clone 本仓库不需要跑它。

用法：python scripts/build-store-shots.py [--check]
  --check 只比对，不写文件（判据：每张产物的 mtime 都比源图新）
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = os.path.dirname(ROOT)
OUT_ROOT = os.path.join(ROOT, "public", "store")

# (游戏 id, [(源文件, 输出名), ...])
PLAN = [
    ("cloudfarm", [
        (os.path.join(UP, "cloudfarm/screenshots/11-farm.png"), "1"),
        (os.path.join(UP, "cloudfarm/screenshots/13-animals.png"), "2"),
        (os.path.join(UP, "cloudfarm/screenshots/14-market.png"), "3"),
        (os.path.join(UP, "cloudfarm/screenshots/18-pond.png"), "4"),
    ]),
    ("prizepark", [
        (os.path.join(UP, "prize-park-local/shots/ui-01-home.png"), "1"),
        (os.path.join(UP, "prize-park-local/shots/ui-03-collection.png"), "2"),
        (os.path.join(UP, "prize-park-local/shots/ui-04-bag-sell.png"), "3"),
    ]),
    ("claw3d", [
        (os.path.join(UP, "claw-machine/shots/ref-0-home.png"), "1"),
        (os.path.join(UP, "claw-machine/shots/ref-1-play.png"), "2"),
        (os.path.join(UP, "claw-machine/shots/ref-2-side.png"), "3"),
    ]),
]

WIDTH = 360
QUALITY = 80


def main() -> int:
    check_only = "--check" in sys.argv
    missing = []
    stale = []
    total = 0
    for game, items in PLAN:
        out_dir = os.path.join(OUT_ROOT, game)
        if not check_only:
            os.makedirs(out_dir, exist_ok=True)
        for src, name in items:
            dst = os.path.join(out_dir, name + ".webp")
            if not os.path.exists(src):
                missing.append(src)
                continue
            if check_only:
                if not os.path.exists(dst) or os.path.getmtime(dst) < os.path.getmtime(src):
                    stale.append(dst)
                if os.path.exists(dst):
                    total += os.path.getsize(dst)
                continue
            im = Image.open(src).convert("RGB")
            h = round(im.height * WIDTH / im.width)
            im = im.resize((WIDTH, h), Image.LANCZOS)
            im.save(dst, "WEBP", quality=QUALITY, method=6)
            total += os.path.getsize(dst)
            print("  %-42s -> %-28s %5.1f KB" % (os.path.basename(src), os.path.relpath(dst, ROOT), os.path.getsize(dst) / 1024))

    if missing:
        print("\n缺源图：")
        for m in missing:
            print("  " + m)
        return 2
    if check_only and stale:
        print("\n产物比源图旧（要重跑）：")
        for s in stale:
            print("  " + s)
        return 1
    print("\n共 %.1f KB" % (total / 1024))
    return 0


if __name__ == "__main__":
    sys.exit(main())
