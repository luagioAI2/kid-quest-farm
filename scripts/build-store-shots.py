#!/usr/bin/env python
"""
把三个游戏的真机截图转成商店用的 webp（`public/store/<id>/<n>.webp`）。

## 为什么要转，不直接引用

源图是 780×1688 的 PNG（每张 300~600 KB）。三款游戏 × 4 张直接塞进 `public/`
就是 5 MB 级别的增量，而 APK 体积是这个项目一直在盯的东西。
转成 360 宽的 webp 之后每张 ~20 KB，**总量 < 300 KB**，观感在平板上也够。

## 为什么源图在外面

游戏工程都在 `../task-games/<项目名>/`（**不在本仓库里**，各自一个 git 仓库）。
这个脚本是**开发期工具**，产出物（`public/store/`）才是随 App 发布的东西 ——
所以别人 clone 本仓库不需要跑它。

⚠️ 目录名 ≠ 插件 id：`prize-park-local` 的 id 是 `prizepark`，`claw-machine` 是
`claw3d`。映射写死在下面的 `PLAN` 里，**加游戏必须在这里加一行**，否则详情页
那几张图永远是旧的（脚本不会报错，它只转 PLAN 里列出来的）。

用法：python scripts/build-store-shots.py [--check]
  --check 只比对，不写文件（判据：每张产物的 mtime 都比源图新）
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UP = os.path.dirname(ROOT)
GAMES = os.path.join(UP, "task-games")
OUT_ROOT = os.path.join(ROOT, "public", "store")

# (游戏 id, task-games 下的项目目录, [(源文件相对项目根, 输出名), ...])
PLAN = [
    ("cloudfarm", "cloudfarm", [
        ("screenshots/11-farm.png", "1"),
        ("screenshots/13-animals.png", "2"),
        ("screenshots/14-market.png", "3"),
        ("screenshots/18-pond.png", "4"),
    ]),
    # ⚠️ 2026-10-25：第一张原来是 ui-01-home（奖品货架九宫格），家长看完说
    # 「详情页没有娃娃机截图」—— 货架看着像电商，看不出这是个抓取游戏。
    # 换成 ui-06-play（真机台 + 正面/侧面切换），货架挪到第 2 张当「奖池」。
    ("prizepark", "prize-park-local", [
        ("shots/ui-06-play.png", "1"),
        ("shots/ui-01-home.png", "2"),
        ("shots/ui-03-collection.png", "3"),
        ("shots/ui-04-bag-sell.png", "4"),
    ]),
    # ⚠️ 2026-10-25：原来用的是 `ref-*.png` —— 那是**原版游戏**的参考截图
    # （机台上印的还是别人的海报）。而且第一张 `ref-0-home` 是奖品货架，
    # 说明却写「一台真的能转视角的娃娃机」—— 图和话对不上。
    # 换成 `smoke-*.png`：`npm run smoke` 对**当前构建**真跑一遍拍下来的，
    # 机台上的字就是现在的「抓娃娃」。
    # ⚠️ 源图必须在**已入库**的目录里。原来这里写的是 `shots/smoke-*.png`，
    # 而 `claw-machine/.gitignore` 里明确 ignore 了 `shots`（那是走查临时目录，
    # 「要留的图进 screenshots/」）⇒ 详情页这 3 张图的**唯一来源没有版本控制**，
    # 一旦 `shots/` 被清就再也生成不出来，而且不会有任何报错。
    # 现在这 3 张原封不动复制进 `screenshots/store-*.png`（字节相同，webp 逐字节不变）。
    ("claw3d", "claw-machine", [
        ("screenshots/store-1-machine.png", "1"),
        ("screenshots/store-2-front.png", "2"),
        ("screenshots/store-3-side.png", "3"),
    ]),
    # 2026-10-25 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，780×1688）。
    # 顺序按「先看它是什么 → 再看怎么玩」：标题 / 进化 / 关卡 / 棋盘。
    ("sugar", "sugar", [
        ("shots/01-title.png", "1"),
        ("shots/02-evolve.png", "2"),
        ("shots/03-map.png", "3"),
        ("shots/04-board.png", "4"),
    ]),
    # 2026-10-26 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 1，390×844）。
    # 顺序：先看它是什么（草地 + 蚂蚁搬叶子）→ 商店 / 设置 → 换世界。
    ("anthill", "anthill", [
        ("shots/01-main.png", "1"),
        ("shots/02-shop.png", "2"),
        ("shots/03-settings.png", "3"),
        ("shots/04-world2.png", "4"),
    ]),
    # 2026-10-26 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 1，390×844）。
    # 顺序：先看它是什么（标题 + 主视觉）→ 关卡地图 → 打起来是什么样 → 有哪些人。
    # ⚠️ 第 3 张必须是**战斗**：家长要看的是「玩起来是什么」，不是菜单。
    ("moestrike", "moestrike", [
        ("shots/01-home.png", "1"),
        ("shots/02-stages.png", "2"),
        ("shots/03-battle.png", "3"),
        ("shots/04-chars.png", "4"),
    ]),
    # 2026-10-26 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，780×1688）。
    # 顺序：先看它是什么（标题）→ 玩起来是什么样（罐里有果）→ 成长 → 长期目标。
    # ⚠️ 第 2 张必须是**对局中且有果**：只截标题或空罐子，家长看不出这是合成游戏。
    ("melonjar", "melonjar", [
        ("shots/01-title.png", "1"),
        ("shots/02-play.png", "2"),
        ("shots/03-upgrade.png", "3"),
        ("shots/04-achv.png", "4"),
    ]),
    # 2026-10-26 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，780×1688）。
    # 顺序：先看它是什么（矿道剖面 + 矿工在跑）→ 点矿道升级 → 重开矿场换投资人 → 皮肤阶梯。
    # ⚠️ 第 1 张必须是**有矿工在跑的剖面**：全新档只有一条空矿道，拍出来像一张静态插图。
    # ⚠️ 第 3 张投资人页的门槛是 $44.4B，全新档打开只有一个灰按钮（像坏了），
    #    所以 capture.mjs 会把累计收入放到 $200B 再拍。
    ("minergirl", "minergirl", [
        ("shots/01-mine.png", "1"),
        ("shots/02-level.png", "2"),
        ("shots/03-shop.png", "3"),
        ("shots/04-skins.png", "4"),
    ]),
    # 2026-10-26 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，780×1688）。
    # 顺序：先看它是什么（草地上的一群羊）→ 跳起来是什么样 → 结算 → 牧场升级。
    # ⚠️ 第 2 张必须是**对局中、羊在跳、有分数**：只拍标题，家长看不出这是节奏游戏。
    # ⚠️ 第 4 张要先 `P.wool = 260` 再拍：全新档羊毛为 0，升级按钮全是灰的（像坏了）。
    ("ropeland", "ropeland", [
        ("shots/store-1.png", "1"),
        ("shots/store-2.png", "2"),
        ("shots/store-3.png", "3"),
        ("shots/store-4.png", "4"),
    ]),
    # 2026-10-27 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，585×1055）。
    # 顺序：先看它是什么（标题）→ 怎么玩（棋盘 + 托盘里还剩两块）→ 有多少内容（15 道）
    # → 玩完得到什么（三枚印章）。
    # ⚠️ 第 2 张必须**真的摆上几块**：只点进第一题拍出来是空棋盘，看不出这是「往里塞」的游戏。
    # ⚠️ 第 4 张要等印章补间跑完（headless 比墙上时钟慢约 7×，约 9 秒），
    #    否则三枚印章 alpha 还是 0，拍出来是一张空面板（第一次就拍成了那样）。
    ("blockfit", "blockfit", [
        ("shots/01-title.png", "1"),
        ("shots/02-play.png", "2"),
        ("shots/03-select.png", "3"),
        ("shots/04-clear.png", "4"),
    ]),
    # 一分钟卡组：60 秒抽卡构筑 → 6 关牌战。
    # ⚠️ 第 2 张必须等**三张备选真的摊开**再拍：刚进构筑时 `offer` 是 null，
    #    拍出来只有一张倒计时，看不出这是「三选一抽卡」。
    # ⚠️ 第 3 张必须等**手牌发完**：发牌是补间，headless 慢约 7×，固定 sleep 会拍成空手牌。
    ("deckrush", "deckrush", [
        ("shots/01-title.png", "1"),
        ("shots/02-build.png", "2"),
        ("shots/03-battle.png", "3"),
        ("shots/04-cards.png", "4"),
    ]),
    # 2026-10-27 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，780×1688）。
    # 顺序：先看它是什么（标题 + 那只柯基）→ 玩起来是什么（屁屁 + 六档零食）
    # → 能换什么（衣柜）→ 长期目标（七种毛色的图鉴）。
    # ⚠️ 第 2 张必须是**主界面**而不是标题：这一款的全部玩法都压在这一屏上
    #    （点屁屁攒爱心、零食卡片、底栏五个页签），只拍标题家长看不出是养成。
    # ⚠️ 第 3 张的「穿上 +3% 产出」和游戏里一致；别换成只有图标没有说明的截图。
    ("corgi", "corgi", [
        ("shots/01-title.png", "1"),
        ("shots/02-garden.png", "2"),
        ("shots/03-closet.png", "3"),
        ("shots/04-collection.png", "4"),
    ]),
    # 2026-10-27 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，585×1055）。
    # 顺序：先看它是什么（标题 + 那只方块鸡）→ 有多少关（关卡网格）
    # → 玩起来是什么（脖子伸出去铺地）→ 玩完得到什么（三颗星）。
    # ⚠️ 第 2 张的存档是**页面里先塞进去的**（unlocked 13 / 27 颗星）：全新档打开是
    #    24 把灰锁，拍出来像「关卡还没做」。
    # ⚠️ 第 4 张要等三颗星一颗颗弹完（补间延迟 0.25/0.47/0.69 **游戏秒**，
    #    headless 下约 7 倍 ⇒ 实测要 14 秒）。等 7 秒只亮一颗星。
    ("screamchick", "screamchick", [
        ("shots/01-title.png", "1"),
        ("shots/02-levels.png", "2"),
        ("shots/03-play.png", "3"),
        ("shots/04-win.png", "4"),
    ]),
    # 旋转灯泡（Sweet Spin）：同样没有标题页，第 1 张是关卡盘。
    # 种子存档给了「前 12 关已通」，否则拍出来是 19 个锁。
    # ⚠️ 第 3 张不是「转一半」而是「差最后 3 下」：管道没接通时一盏灯都不亮，
    #    「一半」那张和开局几乎一样（实测两张看不出区别）。
    ("sweetspin", "sweetspin", [
        ("shots/01-levels.png", "1"),
        ("shots/02-play.png", "2"),
        ("shots/03-half.png", "3"),
        ("shots/04-win.png", "4"),
    ]),
    # 2026-10-27 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，390×844 容器）。
    # 顺序：一栋楼长什么样 → 点开一间房能改什么 → 能盖多高 → 唯一「手要动」的地方。
    # ⚠️ 这一款没有「关卡」，存档也不适合手搓 JSON（`serialize()` 字段多）——
    #    所以 4 张图都是**用游戏自己的 `__debug` 探针**摆出来的（加钱/加口碑/加盖/塞住户），
    #    不是真玩了两个小时。摆的时候把余额压到「刚够再盖一层」的量级：
    #    第一次给 5 亿，拍出来那栋楼像不要钱。
    # ⚠️ 第 3 张必须把新盖的楼层**塞满人**，否则 11 层全是「招租中」，看着像烂尾楼。
    ("renttower", "renttower", [
        ("shots/01-tower.png", "1"),
        ("shots/02-room.png", "2"),
        ("shots/03-tall.png", "3"),
        ("shots/04-shift.png", "4"),
    ]),
    # ⚠️ 第一张必须是「这是什么游戏」：对局里的彩色塔，不是标题字。
    # 这 4 张由 `task-games/stackmeow/scripts/capture.mjs` 对**当前构建**拍，
    # 顺序就是详情页的顺序（对局 → 标题 → 结算 → 暂停）。
    ("stackmeow", "stackmeow", [
        ("screenshots/store-1.png", "1"),
        ("screenshots/store-2.png", "2"),
        ("screenshots/store-3.png", "3"),
        ("screenshots/store-4.png", "4"),
    ]),
    # 2026-10-28 新增。源图是 `node scripts/capture.mjs` 拍的（DPR 2，390×844 容器）。
    # 顺序：首页（一眼看出是打病毒的关卡制）→ 对局 → 英雄加点 → 结算。
    # ⚠️ 对局那张拍在 **10%** 左右：25% 时通道口会堆成一面「病毒墙」，
    #    三十来个四位数血量叠在一起，看着像 bug。
    ("cellguard", "cellguard", [
        ("screenshots/store-1.png", "1"),
        ("screenshots/store-2.png", "2"),
        ("screenshots/store-3.png", "3"),
        ("screenshots/store-4.png", "4"),
    ]),
    # 顺序：首页（标题 + 那颗大红按钮）→ 连击 12（宝箱 + 金币）→ 升级面板 → 扭蛋机。
    # ⚠️ 第 2 张必须在**最后一按下之后立刻截**：连击文字只活 1.2 秒；
    #    但又要先等 2.6 秒让「升级！技能点 +1」的 toast 淡出（它会压住成就那一行）。
    ("redbutton", "redbutton", [
        ("screenshots/store-1.png", "1"),
        ("screenshots/store-2.png", "2"),
        ("screenshots/store-3.png", "3"),
        ("screenshots/store-4.png", "4"),
    ]),
    # 顺序：标题 → 战斗 → 伙伴图鉴 → 卡组。
    # ⚠️ 关卡列表那张**故意没拍**：整屏都是「未解锁」，放进商店像在展示「你玩不到」。
    ("guardshift", "guardshift", [
        ("screenshots/store-1.png", "1"),
        ("screenshots/store-2.png", "2"),
        ("screenshots/store-3.png", "3"),
        ("screenshots/store-4.png", "4"),
    ]),
    # 顺序：标题 → 球在半空 → 新机关说明卡 → 后面的机关关。
    # ⚠️ 选关页那张**故意没拍**：5 个圆钮里 4 个是「未解锁」，放进商店像在展示「你玩不到」。
    ("hoopsneak", "hoopsneak", [
        ("screenshots/store-1.png", "1"),
        ("screenshots/store-2.png", "2"),
        ("screenshots/store-3.png", "3"),
        ("screenshots/store-4.png", "4"),
    ]),
    ("doodlederby", "doodlederby", [
        ("screenshots/store-1.png", "1"),
        ("screenshots/store-2.png", "2"),
        ("screenshots/store-3.png", "3"),
        ("screenshots/store-4.png", "4"),
    ]),
    # 2026-11-08 新增（扒自 MakePlay 的 Harvest Heist，本地化成「我是一个农场主」）。
    # 源图由 `task-games/farmlord/_store-shots.mjs` 拍（DPR 2，420×880）。
    # 顺序：农场长什么样 → 商店种子 → 商店动物 → 邻居（能去别人家偷菜）。
    # ⚠️ 第 1 张必须**先把地种上**：全新档是 6 块秃地，拍出来像一张背景图。
    # ⚠️ 商店页签是**开关** —— 点已经选中的那个会把弹层关掉，
    #    第一次就是这么拍成农场的（脚本里现在只在没选中时才点）。
    ("farmlord", "farmlord", [
        ("screenshots/store-1-farm.png", "1"),
        ("screenshots/store-2-shop-seeds.png", "2"),
        ("screenshots/store-3-shop-animals.png", "3"),
        ("screenshots/store-4-neighbors.png", "4"),
    ]),
]

WIDTH = 360
QUALITY = 80


def main() -> int:
    check_only = "--check" in sys.argv
    missing = []
    stale = []
    total = 0
    for game, proj, items in PLAN:
        out_dir = os.path.join(OUT_ROOT, game)
        if not check_only:
            os.makedirs(out_dir, exist_ok=True)
        for rel, name in items:
            src = os.path.join(GAMES, proj, rel)
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
