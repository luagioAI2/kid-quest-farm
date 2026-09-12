#!/usr/bin/env python3
"""
生成 Android 启动图标。

Capacitor 脚手架自带的是默认的 Capacitor 图标（蓝色闪电），
装到手机上跟 App 完全没有关系。这里按项目的农场主题重画一套：
  - 自适应图标（API 26+）：前景层 + 背景层分离
  - 传统 PNG（API < 26）：各密度一张合成图

不依赖任何三方库，用纯 Python 写 PNG（zlib + struct）。
"""
import os
import struct
import zlib
import math

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# 各密度对应的方形边长
DENSITIES = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# 自适应图标前景层尺寸（比传统图标大，因为系统会裁切）
ADAPTIVE = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}

# ---- 配色（跟 theme.css 的 sun / grass / sky 系一致）----
SKY_TOP = (186, 230, 253)
SKY_BOT = (224, 242, 254)
SUN = (252, 211, 77)
GRASS_LIGHT = (74, 222, 128)
GRASS_MID = (34, 197, 94)
GRASS_DARK = (22, 163, 74)
SOIL = (146, 100, 62)
SOIL_DARK = (120, 80, 48)
WHITE = (255, 255, 255)


def blend(dst, src, alpha):
    """把 src 以 alpha(0..1) 混到 dst 上，返回新颜色"""
    return tuple(round(d + (s - d) * alpha) for d, s in zip(dst, src))


def write_png(path, width, height, pixels):
    """
    pixels: 扁平 bytearray，长度 width*height*4（RGBA）
    """
    raw = bytearray()
    stride = width * 4
    for y in range(height):
        raw.append(0)  # filter type 0
        raw.extend(pixels[y * stride:(y + 1) * stride])

    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return c + struct.pack(">I", crc)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(png)


class Canvas:
    def __init__(self, w, h, bg=None):
        self.w, self.h = w, h
        self.buf = bytearray(w * h * 4)
        if bg:
            for i in range(w * h):
                self.buf[i * 4] = bg[0]
                self.buf[i * 4 + 1] = bg[1]
                self.buf[i * 4 + 2] = bg[2]
                self.buf[i * 4 + 3] = 255

    def px(self, x, y, color, alpha=1.0):
        if x < 0 or y < 0 or x >= self.w or y >= self.h or alpha <= 0:
            return
        i = (y * self.w + x) * 4
        if alpha >= 1.0:
            self.buf[i] = color[0]
            self.buf[i + 1] = color[1]
            self.buf[i + 2] = color[2]
            self.buf[i + 3] = 255
        else:
            base = (self.buf[i], self.buf[i + 1], self.buf[i + 2])
            a0 = self.buf[i + 3] / 255.0
            out = blend(base, color, alpha)
            self.buf[i] = out[0]
            self.buf[i + 1] = out[1]
            self.buf[i + 2] = out[2]
            self.buf[i + 3] = min(255, round((a0 + alpha * (1 - a0)) * 255))

    def rect(self, x0, y0, x1, y1, color, alpha=1.0, radius=0):
        for y in range(max(0, int(y0)), min(self.h, int(y1))):
            for x in range(max(0, int(x0)), min(self.w, int(x1))):
                if radius > 0:
                    # 圆角裁切
                    cx = min(max(x, x0 + radius), x1 - radius - 1)
                    cy = min(max(y, y0 + radius), y1 - radius - 1)
                    d = math.hypot(x - cx, y - cy)
                    if d > radius:
                        continue
                self.px(x, y, color, alpha)

    def disc(self, cx, cy, r, color, alpha=1.0):
        for y in range(max(0, int(cy - r)), min(self.h, int(cy + r) + 1)):
            for x in range(max(0, int(cx - r)), min(self.w, int(cx + r) + 1)):
                if math.hypot(x - cx, y - cy) <= r:
                    self.px(x, y, color, alpha)


def curve_bottom(canvas, y_base, amp, color, alpha=1.0, phase=0.0):
    """画一条正弦起伏的草地边缘，往下填满"""
    for x in range(canvas.w):
        t = x / canvas.w
        y = y_base + amp * math.sin(t * math.pi * 2 + phase)
        for yy in range(int(y), canvas.h):
            canvas.px(x, yy, color, alpha)


def draw_scene(c, size, inset, sky=True):
    """
    在画布上画「蓝天 + 太阳 + 两片草坡 + 一株小苗」。
    inset: 前景层要留出安全边距，传统图标可以少留一点。
    sky:   自适应图标的前景层要留空，天空由背景层提供 ——
           否则渐变矩形会在图标里显出一个生硬的方形边界。
    """
    s = size
    pad = s * inset

    if sky:
        # 蓝天渐变
        for y in range(int(pad), int(s - pad)):
            t = (y - pad) / max(1, (s - 2 * pad))
            col = blend(SKY_TOP, SKY_BOT, t)
            for x in range(int(pad), int(s - pad)):
                c.px(x, y, col)

    # 太阳（右上）
    sun_r = s * 0.09
    c.disc(s * 0.70, s * 0.30, sun_r, SUN)
    c.disc(s * 0.70, s * 0.30, sun_r * 0.72, (253, 224, 71))

    # 远山草坡
    curve_bottom(c, s * 0.62, s * 0.035, GRASS_LIGHT, phase=0.4)
    # 近处草坡
    curve_bottom(c, s * 0.72, s * 0.03, GRASS_MID, phase=2.1)

    # 一株小苗：茎 + 两片叶
    stem_x = s * 0.40
    stem_top = s * 0.44
    stem_w = max(1.0, s * 0.028)
    c.rect(stem_x - stem_w / 2, stem_top, stem_x + stem_w / 2, s * 0.78, GRASS_DARK)

    leaf_rx, leaf_ry = s * 0.13, s * 0.075
    for sign, ly in ((-1, s * 0.50), (1, s * 0.56)):
        cx = stem_x - sign * s * 0.02
        cy = ly
        for y in range(int(cy - leaf_ry), int(cy + leaf_ry) + 1):
            for x in range(int(cx - leaf_rx), int(cx + leaf_rx) + 1):
                dx = (x - cx) / leaf_rx
                dy = (y - cy) / leaf_ry
                # 叶片斜向拉伸
                ang = math.radians(-28 * sign)
                rx = dx * math.cos(ang) + dy * math.sin(ang)
                ry = -dx * math.sin(ang) + dy * math.cos(ang)
                if rx * rx + ry * ry <= 1.0:
                    c.px(x, y, GRASS_DARK)

    # 泥土小丘
    c.rect(s * 0.30, s * 0.78, s * 0.50, s * 0.90, SOIL, radius=s * 0.04)
    c.rect(s * 0.30, s * 0.78, s * 0.50, s * 0.815, SOIL_DARK, radius=s * 0.04)


def make_legacy(path, size):
    """传统方形图标：圆角方块 + 场景"""
    c = Canvas(size, size, None)
    r = size * 0.22
    # 圆角底
    c.rect(0, 0, size, size, SKY_TOP, radius=r)
    draw_scene(c, size, 0.06)
    # 再叠一层圆角遮罩，把四角清掉
    for y in range(size):
        for x in range(size):
            cx = min(max(x, r), size - r)
            cy = min(max(y, r), size - r)
            if math.hypot(x - cx, y - cy) > r:
                i = (y * size + x) * 4
                c.buf[i + 3] = 0
    write_png(path, size, size, c.buf)


def make_adaptive_layer(path, size, background):
    """自适应图标的一层：background=True 画纯色，False 画透明前景"""
    if background:
        c = Canvas(size, size, SKY_TOP)
        # 背景层：柔和的天空渐变，铺满
        for y in range(size):
            t = y / size
            col = blend(SKY_TOP, SKY_BOT, t)
            for x in range(size):
                c.px(x, y, col)
    else:
        c = Canvas(size, size, None)
        # 前景层不画天空：让背景层的渐变透上来，避免出现方形天空边界
        draw_scene(c, size, 0.16, sky=False)
    write_png(path, size, size, c.buf)


def main():
    made = []

    for d, size in DENSITIES.items():
        target = os.path.join(RES, f"mipmap-{d}")
        p = os.path.join(target, "ic_launcher.png")
        make_legacy(p, size)
        made.append(p)
        p = os.path.join(target, "ic_launcher_round.png")
        make_legacy(p, size)
        made.append(p)

    for d, size in ADAPTIVE.items():
        target = os.path.join(RES, f"mipmap-{d}")
        p = os.path.join(target, "ic_launcher_foreground.png")
        make_adaptive_layer(p, size, background=False)
        made.append(p)
        p = os.path.join(target, "ic_launcher_background.png")
        make_adaptive_layer(p, size, background=True)
        made.append(p)

    for p in made:
        print(f"  ✓ {os.path.relpath(p, ROOT)}  ({os.path.getsize(p)} bytes)")
    print(f"\n共生成 {len(made)} 个图标文件")


if __name__ == "__main__":
    main()
