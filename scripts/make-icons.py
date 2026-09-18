#!/usr/bin/env python3
"""
⚠️ 已停用（2026-09-16）—— 图标改成 AI 插画方案了，本脚本是上一版的**手绘**方案。

   现在用的图标链路在 `assets/icon/`：
     source.png（AI 插画，暖白底）
       → make_transparent.py 抠掉背景 → icon-square.png
       → generate_icons.py 出全套 mipmap + favicon

   **别再直接跑这个脚本** —— 它会把插画图标覆盖回旧设计，而且不报错。
   真要跑得显式加 `--force-old-design`。

   参考它的时候注意：它出的是「渐变背景 + 矢量前景」，
   现在是「位图背景 + 位图前景」—— 资源名一样，内容完全是两回事。

生成 Android 启动图标（旧方案）。

设计：**金色的底 + 一张奶油色的任务卡（卡上一枚粗对勾）+ 卡顶长出一株两叶的小苗。**

为什么是这个图形
----------------
Capacitor 脚手架自带的是默认的 Capacitor 图标（蓝色闪电），跟这个 App 没关系；
上一版画的「蓝天 + 太阳 + 草坡 + 一株小苗」是农场，但**看不出这是个任务 App** ——
缩到 48px 就是一团风景，跟「任务清单」没有任何联想。

这一版把「任务」放在第一位，而且是**两个符号叠加**：
  · 奶油色的**卡片** = 一张待办卡；
  · 卡上的**粗对勾** = 「做完了」，全世界通用，缩到 48px 也认得出来；
  · 卡顶抽出来的**小苗** = 农场那半边 ——「打完勾，地里长出东西」，
    正好是 App 的核心循环（领任务 → 完成 → 拿积分 → 农场变大）。
试过几版对照（只留对勾 / 对勾尖端挂叶子 / 对勾 + 卡片）：
**卡片 + 对勾 + 苗**这版在小尺寸下信息最完整，只留对勾则完全没有农场味，
对勾尖端挂叶子则像个小风车（见下面对叶子形状的注释）。

配色沿用 theme.css 的 sun / grass 两系：金底配深绿，对比够，也跟 App 内一致。

技术要点
--------
1. **零依赖**。纯 Python 手写 PNG（zlib + struct），不装 Pillow。
2. **超采样抗锯齿**。每档尺寸都先按 4 倍画，再按面积平均降采样。
   上一版是硬边逐像素填的，边缘全是锯齿，在圆角上特别明显。
3. **形状用有符号距离场（SDF）**，覆盖率取 `clamp(0.5 - d)`，
   所以圆角、斜线、叶子的尖端都是平滑的，不用给每个形状单独写抗锯齿。
4. 自适应图标（API 26+）的**背景层改用 drawable 渐变**
   （`res/drawable/ic_launcher_background.xml`），不再出 PNG ——
   渐变本来就不需要位图，而且任何屏幕密度都不会有插值误差。
   前景层仍然出 PNG（`ic_launcher_foreground.png`）。

⚠️ 传统图标（API < 26）和自适应图标的**可视范围不一样**，别用同一套坐标：
   自适应图标的画布是 108×108，但系统只会露出中间约 72×72（再往外是给遮罩的出血）；
   传统图标是整张图都会被看到。
   所以传统图标要把设计网格的 **18~90** 这 72 个单位铺满整张图（见 LEGACY_ORIGIN），
   否则同一个图形在两种图标上会一个大一个小。
"""

import math
import os
import re
import struct
import sys
import zlib

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# 传统图标（API < 26）：一张方形合成图，各密度一张
LEGACY = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
# 自适应图标前景层：比传统图标大，系统会裁切
ADAPTIVE = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

SS = 4  # 超采样倍数
GRID = 108.0  # 设计网格：自适应图标的标准尺寸，下面所有坐标都写在这个网格上
VISIBLE = 72.0  # 自适应图标真正会被露出来的边长
LEGACY_ORIGIN = (GRID - VISIBLE) / 2.0  # 传统图标从这里开始铺（= 18）

# ---------------------------------------------------------------- 配色
# 底色：暖金竖向渐变 + 顶部一团柔光（跟入场页那层「下午四点的阳光」呼应）
GOLD_TOP = (0xF7, 0xD0, 0x6A)
GOLD_BOT = (0xDD, 0x98, 0x20)
GOLD_GLOW = (0xFF, 0xEC, 0xB8)
# 对勾：深绿，压在奶油色卡上对比够
CHECK = (0x15, 0x80, 0x3D)
# 任务卡：奶油白（跟 theme.css 的 paper 同色系），压在金底上自己就跳出来了
CARD = (0xFF, 0xFD, 0xF8)
# 卡的投影：半透明深金，往下偏一点点，让卡「浮」在金底上
CARD_SHADOW = (0x8C, 0x55, 0x00)
# 叶子：一深一浅，看着有层次
LEAF_A = (0x4A, 0xDE, 0x80)
LEAF_B = (0x22, 0xC5, 0x5E)
LEAF_VEIN = (0x15, 0x80, 0x3D)

# ---------------------------------------------------------------- 图形（108 网格）
# 任务卡：横着一点的圆角方块，像一张卡而不是一个方块
CARD_BOX = (34.0, 44.0, 74.0, 79.0)  # x0, y0, x1, y1
CARD_R = 9.5  # 圆角半径

# 对勾三个折点。比例按「短臂 : 长臂 ≈ 1 : 2」、夹角 ≈ 96° 定的 ——
# 这是对勾最容易被一眼认出来的比例，再扁一点就像个「V」了。
# 整体在卡内留 3 个单位左右的边距，别顶到卡边。
CHECK_PTS = [(41.0, 61.0), (51.0, 71.0), (68.0, 51.0)]
CHECK_W = 8.0  # 笔画粗细

# 小苗：从卡顶往上抽一根短茎，茎顶左右各一片叶子。
# ⚠️ 茎要**短**。留 8 个单位就够了 —— 第一版留了 10 个，缩到 192px 就像
#    卡上插了根天线，叶子也飘在离卡很远的地方，跟卡不成一体。
# ⚠️ 叶子形状调过三轮，别退回「圆滚滚」：
#    9.5×6（长宽比 1.6）缩到 48px 是一小团绿点；
#    12×7.5（2.0）像两片花瓣/领结；
#    10×5.2 + ±42° 两片叶子在基部糊成一个绿蘑菇。
#    现在 12×4.2（2.9，够瘦）+ ±45°，两片叶子才分得开、看得出是叶子。
SPROUT_BASE = (60.0, 45.0)  # 起点在卡里面，被卡盖住，所以看不出接缝
SPROUT_TIP = (60.0, 37.0)
SPROUT_W = 3.2
LEAVES = [
    # (从正上方顺时针的角度, 叶长, 叶宽, 颜色)
    (-45.0, 12.0, 4.2, LEAF_A),
    (45.0, 12.0, 4.2, LEAF_B),
]

# 自适应图标的安全区：以中心为圆心、半径 33 的圆。
# 超出这个圆的元素，在圆形 / 水滴形遮罩的启动器上会被切掉。
SAFE_R = 33.0


# ================================================================ PNG 输出
def write_png(path, width, height, pixels):
    """pixels: 扁平 bytearray，长度 width*height*4（RGBA）"""
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0
        raw.extend(pixels[y * stride:(y + 1) * stride])

    def chunk(tag, data):
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


# ================================================================ 画布
class Buf:
    """
    RGBA 画布。

    对外一律用「设计网格坐标」（0~108），内部按 `scale` 换算成像素；
    `origin` 是「哪个设计坐标对应像素 0」——
    自适应图标是 0（整块 108 都在画布里），
    传统图标是 18（只把中间 72 铺满整张图）。
    """

    def __init__(self, size, scale, origin=0.0):
        self.size = size
        self.scale = scale
        self.origin = origin
        self.px = bytearray(size * size * 4)

    def _px(self, v):
        return (v - self.origin) * self.scale

    @staticmethod
    def cov(d):
        """SDF 距离（像素）→ 覆盖率 0..1。0.5px 的羽化足够平滑"""
        return 0.0 if d >= 0.5 else (1.0 if d <= -0.5 else 0.5 - d)

    def blend(self, x, y, color, a):
        """src-over 混合"""
        if a <= 0.0:
            return
        if a > 1.0:
            a = 1.0
        i = (y * self.size + x) * 4
        buf = self.px
        da = buf[i + 3] / 255.0
        oa = a + da * (1.0 - a)
        if oa <= 0.0:
            return
        for k in range(3):
            s = color[k] * a
            d = buf[i + k] * da * (1.0 - a)
            buf[i + k] = min(255, round((s + d) / oa))
        buf[i + 3] = min(255, round(oa * 255))

    def _span(self, box):
        """设计坐标的包围盒 → 画布内的像素范围（多留 1px 给羽化）"""
        x0 = max(0, int(math.floor(self._px(box[0]))) - 1)
        y0 = max(0, int(math.floor(self._px(box[1]))) - 1)
        x1 = min(self.size, int(math.ceil(self._px(box[2]))) + 2)
        y1 = min(self.size, int(math.ceil(self._px(box[3]))) + 2)
        return x0, y0, x1, y1

    def disc(self, cx, cy, r, color, alpha=1.0):
        s = self.scale
        x0, y0, x1, y1 = self._span((cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1))
        pcx, pcy, pr = self._px(cx), self._px(cy), r * s
        for y in range(y0, y1):
            dy = y + 0.5 - pcy
            for x in range(x0, x1):
                a = self.cov(math.hypot(x + 0.5 - pcx, dy) - pr) * alpha
                if a > 0:
                    self.blend(x, y, color, a)

    def capsule(self, ax, ay, bx, by, w, color, alpha=1.0):
        """带圆头的粗线段 —— 对勾、叶脉、茎都用它。两段交叠即圆角接头。"""
        s = self.scale
        r = w / 2.0
        x0, y0, x1, y1 = self._span(
            (min(ax, bx) - r - 1, min(ay, by) - r - 1,
             max(ax, bx) + r + 1, max(ay, by) + r + 1)
        )
        axp, ayp, bxp, byp, pr = self._px(ax), self._px(ay), self._px(bx), self._px(by), r * s
        vx, vy = bxp - axp, byp - ayp
        vv = vx * vx + vy * vy
        for y in range(y0, y1):
            py = y + 0.5
            for x in range(x0, x1):
                px = x + 0.5
                if vv <= 1e-9:
                    d = math.hypot(px - axp, py - ayp)
                else:
                    t = ((px - axp) * vx + (py - ayp) * vy) / vv
                    t = 0.0 if t < 0 else (1.0 if t > 1 else t)
                    d = math.hypot(px - (axp + vx * t), py - (ayp + vy * t))
                a = self.cov(d - pr) * alpha
                if a > 0:
                    self.blend(x, y, color, a)

    def leaf(self, ax, ay, angle_deg, length, width, color, vein=None, alpha=1.0):
        """
        「柳叶」：两个等半径圆求交，交集两端自然是尖的。
        （拿椭圆当叶子的话两头是圆的，小尺寸下会跟「一团绿点」分不清。）

        angle_deg 从**正上方**顺时针量起。
        """
        r = (length * length + width * width) / (4.0 * width)
        d = 2.0 * r - width
        rad = math.radians(angle_deg)
        ux, uy = math.sin(rad), -math.cos(rad)  # 叶尖方向
        mx, my = ax + ux * length / 2.0, ay + uy * length / 2.0
        c1 = (mx - ux * d / 2.0, my - uy * d / 2.0, r)
        c2 = (mx + ux * d / 2.0, my + uy * d / 2.0, r)

        s = self.scale
        x0, y0, x1, y1 = self._span((mx - r - 1, my - r - 1, mx + r + 1, my + r + 1))
        c1x, c1y, c1r = self._px(c1[0]), self._px(c1[1]), c1[2] * s
        c2x, c2y, c2r = self._px(c2[0]), self._px(c2[1]), c2[2] * s
        for y in range(y0, y1):
            py = y + 0.5
            for x in range(x0, x1):
                px = x + 0.5
                # 交集 = 两个圆距离取 max
                d1 = math.hypot(px - c1x, py - c1y) - c1r
                d2 = math.hypot(px - c2x, py - c2y) - c2r
                a = self.cov(max(d1, d2)) * alpha
                if a > 0:
                    self.blend(x, y, color, a)

        if vein:
            # 叶脉要**很淡**。画重了叶子会被中间那道深色一分为二，
            # 看着像一对翅膀而不是一片叶子。
            self.capsule(ax, ay, ax + ux * length * 0.78, ay + uy * length * 0.78,
                         max(0.6, width * 0.14), vein, alpha * 0.32)

    def rect(self, x0, y0, x1, y1, color, radius=0.0, alpha=1.0):
        """圆角矩形"""
        s = self.scale
        bx0, by0, bx1, by1 = self._span((x0 - 1, y0 - 1, x1 + 1, y1 + 1))
        cx, cy = (x0 + x1) / 2.0, (y0 + y1) / 2.0
        hw, hh = (x1 - x0) / 2.0 - radius, (y1 - y0) / 2.0 - radius
        for y in range(by0, by1):
            py = (y + 0.5) / s + self.origin - cy
            for x in range(bx0, bx1):
                px = (x + 0.5) / s + self.origin - cx
                qx, qy = abs(px) - hw, abs(py) - hh
                d = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0)
                a = self.cov((d - radius) * s) * alpha
                if a > 0:
                    self.blend(x, y, color, a)


# ================================================================ 内容
def draw_background(size):
    """金色底：竖向渐变 + 顶部一团柔光。整张图都铺满（背景不吃设计网格）"""
    px = bytearray(size * size * 4)
    gcx, gcy, gr = 0.5, 0.10, 0.78
    for y in range(size):
        v = y / max(1, size - 1)
        base = [GOLD_TOP[k] + (GOLD_BOT[k] - GOLD_TOP[k]) * v for k in range(3)]
        gy = (v - gcy) / gr
        # 柔光强度只跟 y 有关，横向用同一个二次衰减 —— 比逐像素开根号快得多
        for x in range(size):
            gx = (x / max(1, size - 1) - gcx) / gr
            f = 1.0 - math.hypot(gx, gy)
            col = base
            if f > 0.0:
                w = f * f * 0.55
                col = [base[k] + (GOLD_GLOW[k] - base[k]) * w for k in range(3)]
            i = (y * size + x) * 4
            px[i] = min(255, round(col[0]))
            px[i + 1] = min(255, round(col[1]))
            px[i + 2] = min(255, round(col[2]))
            px[i + 3] = 255
    return px


def draw_foreground(size, origin):
    """前景：小苗 + 任务卡 + 对勾。绘制顺序就是叠放顺序（后画的在上）"""
    b = Buf(size, size / (GRID - 2.0 * origin), origin)

    # ① 小苗。起点在卡里面，等下被卡盖住，所以看不出接缝
    b.capsule(SPROUT_BASE[0], SPROUT_BASE[1], SPROUT_TIP[0], SPROUT_TIP[1],
              SPROUT_W, LEAF_VEIN)
    for ang, ln, wd, col in LEAVES:
        b.leaf(SPROUT_TIP[0], SPROUT_TIP[1], ang, ln, wd, col, vein=LEAF_VEIN)

    # ② 卡的投影。先画一张下偏 2.2 个单位的同形状卡，再拿真卡盖掉大部分，
    #    只露出下面那条 —— 金底上多一层「浮起来」的感觉，不用真做模糊
    x0, y0, x1, y1 = CARD_BOX
    b.rect(x0, y0 + 2.2, x1, y1 + 2.2, CARD_SHADOW, radius=CARD_R, alpha=0.20)

    # ③ 任务卡
    b.rect(x0, y0, x1, y1, CARD, radius=CARD_R)

    # ④ 对勾：两段 capsule 交叠，折点自然就是圆角
    for i in range(len(CHECK_PTS) - 1):
        (ax, ay), (bx, by) = CHECK_PTS[i], CHECK_PTS[i + 1]
        b.capsule(ax, ay, bx, by, CHECK_W, CHECK)

    return b.px


def check_safe_zone():
    """自检：所有前景元素必须落在安全圆里，否则圆形遮罩的启动器会切掉叶子。"""
    x0, y0, x1, y1 = CARD_BOX
    pts = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]  # 卡的四角是最容易出界的
    pts += list(CHECK_PTS)
    r = CHECK_W / 2.0
    for ax, ay in CHECK_PTS:
        for dx, dy in ((r, 0), (-r, 0), (0, r), (0, -r)):
            pts.append((ax + dx, ay + dy))
    pts += [SPROUT_BASE, SPROUT_TIP]
    for ang, ln, wd, _ in LEAVES:
        rad = math.radians(ang)
        ux, uy = math.sin(rad), -math.cos(rad)
        for t, w in ((ln, 0.0), (ln * 0.5, wd / 2.0), (ln * 0.5, -wd / 2.0)):
            pts.append((SPROUT_TIP[0] + ux * t - uy * w, SPROUT_TIP[1] + uy * t + ux * w))
    worst = max(math.hypot(x - GRID / 2.0, y - GRID / 2.0) for x, y in pts)
    # 顺便报一下包围盒中心：整组图形偏出去太多的话，方形图标里看着会歪
    bcx = (min(p[0] for p in pts) + max(p[0] for p in pts)) / 2.0
    bcy = (min(p[1] for p in pts) + max(p[1] for p in pts)) / 2.0
    ok = worst <= SAFE_R
    print(f"  安全区自检：最远元素距圆心 {worst:.1f}，上限 {SAFE_R:.0f} —— "
          f"{'✓ 通过' if ok else '✗ 超出，圆形遮罩的启动器会切掉'}")
    print(f"  构图中心：({bcx:.1f}, {bcy:.1f})，网格中心 (54.0, 54.0) —— "
          f"偏离 {math.hypot(bcx - 54.0, bcy - 54.0):.1f}")
    return ok


# ================================================================ 降采样 / 合成
def downsample(src, src_size, dst_size):
    """
    整数倍面积平均降采样（RGBA）。
    ⚠️ 必须在**预乘 alpha** 的空间里平均，否则透明边缘会把黑色混进来，
       前景层在自适应图标里会显出一圈灰边。
    """
    k = src_size // dst_size
    assert src_size == dst_size * k, (src_size, dst_size)
    if k == 1:
        return bytearray(src)
    out = bytearray(dst_size * dst_size * 4)
    n = k * k
    for y in range(dst_size):
        for x in range(dst_size):
            ar = ag = ab = aa = 0
            for dy in range(k):
                row = (y * k + dy) * src_size
                for dx in range(k):
                    i = (row + x * k + dx) * 4
                    a = src[i + 3]
                    ar += src[i] * a
                    ag += src[i + 1] * a
                    ab += src[i + 2] * a
                    aa += a
            o = (y * dst_size + x) * 4
            if aa > 0:
                out[o] = min(255, round(ar / aa))
                out[o + 1] = min(255, round(ag / aa))
                out[o + 2] = min(255, round(ab / aa))
                out[o + 3] = min(255, round(aa / n))
    return out


def over(bg, fg):
    """fg over bg（都是扁平 RGBA，长度相同）"""
    out = bytearray(len(bg))
    for i in range(0, len(bg), 4):
        a = fg[i + 3] / 255.0
        if a <= 0.0:
            out[i:i + 4] = bg[i:i + 4]
        elif a >= 1.0:
            out[i:i + 4] = fg[i:i + 4]
        else:
            out[i] = round(fg[i] * a + bg[i] * (1 - a))
            out[i + 1] = round(fg[i + 1] * a + bg[i + 1] * (1 - a))
            out[i + 2] = round(fg[i + 2] * a + bg[i + 2] * (1 - a))
            out[i + 3] = 255
    return out


def mask_round(buf, size, radius):
    """圆角方形遮罩（传统图标用 —— API < 26 的启动器不会自己裁）"""
    r = radius * size
    for y in range(size):
        for x in range(size):
            cx = min(max(x + 0.5, r), size - r)
            cy = min(max(y + 0.5, r), size - r)
            if math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r:
                buf[(y * size + x) * 4 + 3] = 0
    return buf


def mask_circle(buf, size):
    """圆形遮罩（round icon）"""
    c = size / 2.0
    for y in range(size):
        for x in range(size):
            if math.hypot(x + 0.5 - c, y + 0.5 - c) > c:
                buf[(y * size + x) * 4 + 3] = 0
    return buf


# ================================================================ 预览图
def _paste(buf, w, img, size, x0, y0):
    for y in range(size):
        row = (y0 + y) * w
        for x in range(size):
            i = (y * size + x) * 4
            a = img[i + 3] / 255.0
            o = (row + x0 + x) * 4
            for k in range(3):
                buf[o + k] = round(img[i + k] * a + buf[o + k] * (1 - a))
            buf[o + 3] = 255


def _adaptive(size, mask_radius):
    """
    模拟启动器真正露出来的样子：
    自适应图标的 108 画布里只有中间 72 会被看到，所以先按 1.5 倍画再裁中间那块，
    然后套上遮罩 —— 直接用整张 108 出图会比手机上看到的小一圈。
    """
    layer = int(size * GRID / VISIBLE)
    ss = layer * SS
    img = over(draw_background(ss), draw_foreground(ss, 0.0))
    img = downsample(img, ss, layer)
    off = (layer - size) // 2
    crop = bytearray(size * size * 4)
    for y in range(size):
        s = ((y + off) * layer + off) * 4
        crop[y * size * 4:(y + 1) * size * 4] = img[s:s + size * 4]
    if mask_radius is None:
        return mask_circle(crop, size)
    return mask_round(crop, size, mask_radius)


def _legacy(size):
    ss = size * SS
    img = over(draw_background(ss), draw_foreground(ss, LEGACY_ORIGIN))
    return downsample(mask_round(bytearray(img), ss, 0.22), ss, size)


def write_preview():
    """
    出一张对比图，方便肉眼过一遍图标在各种遮罩 / 尺寸下的样子。
    ⚠️ 改完图形一定要看一眼这张图 —— 192px 下好看不代表 48px 下还认得出。
    """
    cells = [
        # (标签, 出图函数 → (RGBA, 边长))
        ("legacy 192", lambda: (_legacy(192), 192)),
        ("legacy 96", lambda: (_legacy(96), 96)),
        ("legacy 48", lambda: (_legacy(48), 48)),
        ("legacy 32", lambda: (_legacy(32), 32)),
        ("圆形遮罩", lambda: (_adaptive(176, None), 176)),
        ("方圆遮罩", lambda: (_adaptive(176, 0.42), 176)),
        ("圆角方形", lambda: (_adaptive(176, 0.22), 176)),
        ("自适应 56", lambda: (_adaptive(56, 0.42), 56)),
    ]
    cols, cell = 4, 208
    rows = (len(cells) + cols - 1) // cols
    w, h = cell * cols, cell * rows
    buf = bytearray(w * h * 4)
    for i in range(w * h):
        buf[i * 4:i * 4 + 4] = bytes((0xF2, 0xF1, 0xEF, 255))

    for i, (_, fn) in enumerate(cells):
        img, size = fn()
        cx = (i % cols) * cell + (cell - size) // 2
        cy = (i // cols) * cell + (cell - size) // 2
        _paste(buf, w, img, size, cx, cy)

    path = os.path.join(ROOT, "screenshots", "icon-preview.png")
    write_png(path, w, h, buf)
    print("  ✓ %s  (%d bytes)  ← 改完图形先看这张" % (os.path.relpath(path, ROOT), os.path.getsize(path)))


# ================================================================ favicon 调色板自检
def check_favicon_palette():
    """favicon.svg **不是**本脚本生成的，是手写的 —— 所以它的颜色会悄悄跑偏。

    README 里写着「两个地方要一起改」，但那句话靠人记。这里把它变成每次跑脚本
    都会看到的检查：favicon 里出现了调色板之外的颜色就报出来。

    为什么要查：图标是同一套图形，改了主色却只重新生成了 PNG 那一半，
    浏览器标签页上的 favicon 还是旧色 —— 这两处平时很难同时看到，最容易漏。
    （和 splash 那套四处同步是同一类问题，见 scripts/measure-splash.mjs --check。）
    """
    path = os.path.join(ROOT, "public", "favicon.svg")
    if not os.path.exists(path):
        print("  ⚠️  找不到 public/favicon.svg，跳过调色板自检")
        return

    with open(path, encoding="utf-8") as f:
        svg = f.read()

    palette = {
        "GOLD_TOP": GOLD_TOP,
        "GOLD_BOT": GOLD_BOT,
        "GOLD_GLOW": GOLD_GLOW,
        "CHECK": CHECK,
        "CARD": CARD,
        "CARD_SHADOW": CARD_SHADOW,
        "LEAF_A": LEAF_A,
        "LEAF_B": LEAF_B,
        "LEAF_VEIN": LEAF_VEIN,
    }
    allowed = {"#%02x%02x%02x" % c for c in palette.values()}
    used = {m.lower() for m in re.findall(r"#[0-9a-fA-F]{6}", svg)}

    extra = sorted(used - allowed)
    missing = sorted(allowed - used)

    if not extra:
        print("  favicon 调色板自检：%d 色，全部在调色板内 —— ✓ 通过" % len(used))
        if missing:
            print("       （没用到：%s，可能只是没画到，不一定是错）" % " ".join(missing))
        return

    print("  ✗ favicon.svg 用了调色板外的颜色：%s" % " ".join(extra))
    print("       当前调色板：")
    for name in sorted(palette):
        print("         %-12s #%02x%02x%02x" % (name, *palette[name]))
    print("     → 如果刚改了图标主色，public/favicon.svg 要一起改（README 有写）")


# ================================================================ 主流程
def main():
    made = []

    # ---- 传统图标：方形 + 圆形，各密度一张 ----
    for d, size in LEGACY.items():
        ss = size * SS
        img = over(draw_background(ss), draw_foreground(ss, LEGACY_ORIGIN))
        target = os.path.join(RES, f"mipmap-{d}")
        # 遮罩在超采样尺寸上做，做完再降采样 —— 圆角边缘才有抗锯齿
        p = os.path.join(target, "ic_launcher.png")
        write_png(p, size, size, downsample(mask_round(bytearray(img), ss, 0.22), ss, size))
        made.append(p)
        p = os.path.join(target, "ic_launcher_round.png")
        write_png(p, size, size, downsample(mask_circle(bytearray(img), ss), ss, size))
        made.append(p)

    # ---- 自适应图标：只出前景层，背景层是 drawable 渐变 ----
    for d, size in ADAPTIVE.items():
        ss = size * SS
        p = os.path.join(RES, f"mipmap-{d}", "ic_launcher_foreground.png")
        write_png(p, size, size, downsample(draw_foreground(ss, 0.0), ss, size))
        made.append(p)

    for p in made:
        print("  ✓ %s  (%d bytes)" % (os.path.relpath(p, ROOT), os.path.getsize(p)))
    print("\n共生成 %d 个图标文件" % len(made))
    write_preview()


if __name__ == "__main__":
    # 这个脚本已经被插画方案取代了。它会覆盖 mipmap-*/ic_launcher*.png，
    # 也就是把 AI 插画图标换回旧的手绘设计 —— 而且不会报任何错，
    # 只有下次打开 App 才会发现图标变了。所以默认拒绝运行。
    if "--force-old-design" not in sys.argv:
        raise SystemExit(
            "✗ scripts/make-icons.py 已停用（图标已换成 AI 插画方案）。\n"
            "\n"
            "  当前图标链路：assets/icon/  →  make_transparent.py  →  generate_icons.py\n"
            "  直接跑本脚本会把插画图标覆盖回旧的手绘设计，所以默认拦住。\n"
            "\n"
            "  确实要用旧设计的话，加 --force-old-design 显式确认。"
        )

    if not check_safe_zone():
        raise SystemExit("✗ 安全区自检没过，先调图形再生成")
    main()
    check_favicon_palette()
