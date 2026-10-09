"""
官网素材生成
------------------------------------------------------------
只做两件事，都是「必须由代码画、不能让 AI 生图」的类型：

1. 图标派生：从 assets/icon/icon-transparent.png 出 512 / 192 两档，
   放在暖白底上并留出安全边距（manifest 的 maskable 图标会被裁成圆形，
   贴边会被切掉）。
2. og-cover.png（1200×630）：社交平台分享卡片。
   ⚠️ 图上有中文，必须用 PIL + 微软雅黑画。AI 生图渲染中文一定糊字/错字。
   ⚠️ 全程不用 emoji：PIL 不能可靠渲染彩色 emoji 字体（Segoe UI Emoji 是
      CBDT/CBLC 位图彩色字体），画出来要么空白要么是黑白轮廓。

另外把 App 的界面截图压缩后复制到 site/img/。

用法：python make-site-assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
IMG = SITE / "img"
SHOTS_SRC = ROOT / ".e2e-scratch" / "landing-shots"

FONT_BOLD = "C:/Windows/Fonts/msyhbd.ttc"
FONT_REG = "C:/Windows/Fonts/msyh.ttc"

INK_900 = (51, 40, 30)
INK_700 = (87, 72, 56)
INK_600 = (122, 104, 87)
INK_500 = (154, 136, 117)
SUN_500 = (245, 158, 11)
SUN_600 = (217, 119, 6)
SUN_700 = (180, 83, 9)
SUN_100 = (254, 243, 199)
SUN_200 = (253, 230, 138)
PAPER = (255, 250, 242)
# 官网主色（site/styles.css 的 --accent）。og-cover 的副标题用它 ——
# 原来用的是 SUN_600（橙 #d97706），和网页的绿对不上（2026-10-03 修）。
ACCENT = (22, 163, 74)  # #16a34a

# 需要搬过来的界面截图：目标名 -> 源名
SHOT_MAP = {
    "shot-tasks.png": "02-tasks.png",
    "shot-running.png": "02b-task-running.png",
    "shot-farm.png": "05-farm.png",
    "shot-harvest.png": "06-harvest-sheet.png",
    "shot-market.png": "08b-market-sheet.png",
    "shot-redeem.png": "09-redeem.png",
    "shot-points.png": "10-points.png",
    "shot-review.png": "13-parent-review.png",
}

# 图标源图，按优先级排。
# ⚠️ 只有 source.png 进了版本库（其余都在 .gitignore 里，见 README「应用图标」）。
#    所以**不能只认 icon-transparent.png** —— 全新克隆里它不存在，
#    脚本会直接崩，而且崩得看不出是「缺中间产物」还是「代码写错了」。
ICON_SOURCES = [
    "assets/icon/icon-transparent.png",  # 抠过底，最理想
    "assets/icon/icon-square.png",       # 暖白底还在，但能凑合
    "assets/icon/source.png",            # 原图，底色一定在
]


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def rounded(img: Image.Image, radius: int) -> Image.Image:
    """给图片加圆角（返回带 alpha 的新图）。"""
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, img.size[0] - 1, img.size[1] - 1), radius, fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def radial(size, center, radius, color, alpha):
    """在透明层上画一团柔光。用同心椭圆 + 高斯模糊近似 radial-gradient。"""
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    steps = 48
    for i in range(steps, 0, -1):
        r = radius * i / steps
        a = int(alpha * (1 - i / steps) ** 1.5)
        d.ellipse(
            (center[0] - r, center[1] - r, center[0] + r, center[1] + r),
            fill=(*color, a),
        )
    return layer.filter(ImageFilter.GaussianBlur(radius * 0.16))


def vgrad(size, top, bottom):
    """竖直渐变底。"""
    w, h = size
    img = Image.new("RGB", (1, h))
    px = img.load()
    for y in range(h):
        t = y / max(1, h - 1)
        px[0, y] = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
    return img.resize((w, h), Image.BILINEAR)


# ---------------------------------------------------------------- 1. 图标
def build_icons():
    src_path = next((ROOT / p for p in ICON_SOURCES if (ROOT / p).exists()), None)
    if src_path is None:
        print("   ⚠️ 找不到任何图标源图，跳过（site/img/icon-*.png 保持原样）")
        return []
    if src_path.name != "icon-transparent.png":
        print(f"   ⚠️ 用的是 {src_path.name}（不是抠过底的版本），图标会带底色。")
        print("      想更干净：先按 README「应用图标」跑一遍 make_transparent.py。")

    src = Image.open(src_path).convert("RGBA")
    made = []
    for size, pad_ratio, bg in ((512, 0.12, (255, 253, 248)), (192, 0.12, (255, 253, 248))):
        canvas = Image.new("RGBA", (size, size), (*bg, 255))
        inner = int(size * (1 - pad_ratio * 2))
        art = src.resize((inner, inner), Image.LANCZOS)
        off = (size - inner) // 2
        canvas.alpha_composite(art, (off, off))
        out = IMG / f"icon-{size}.png"
        canvas.convert("RGB").save(out, optimize=True)
        made.append((out.name, out.stat().st_size))
    return made


# ---------------------------------------------------------------- 2. OG 卡片
def build_og():
    W, H = 1200, 630
    base = vgrad((W, H), (255, 252, 245), (255, 236, 205)).convert("RGBA")

    # 两团柔光：右上暖阳、左下青草
    base.alpha_composite(radial((W, H), (1005, 95), 430, SUN_200, 150))
    base.alpha_composite(radial((W, H), (120, 585), 380, (187, 247, 208), 135))
    base.alpha_composite(radial((W, H), (610, 20), 300, (253, 186, 116), 70))

    d = ImageDraw.Draw(base)

    f_pill = font(FONT_BOLD, 25)
    f_title = font(FONT_BOLD, 88)
    f_sub = font(FONT_BOLD, 46)
    f_desc = font(FONT_REG, 27)
    f_chip = font(FONT_BOLD, 23)
    f_foot = font(FONT_REG, 22)

    x = 76

    # --- 顶部小胶囊
    pill_text = "6–14 岁 · 完全离线 · 不用注册"
    tw = d.textlength(pill_text, font=f_pill)
    d.rounded_rectangle((x, 78, x + tw + 46, 78 + 50), 25, fill=SUN_100)
    d.text((x + 23, 78 + 11), pill_text, font=f_pill, fill=SUN_700)

    # --- 主标题
    y = 152
    d.text((x, y), "小任务农场", font=f_title, fill=INK_900)
    y += 108

    # --- 副标题：用官网主色（草地绿），文案与网页 <h1> 逐字一致
    #     （原来是橙色 SUN_600 + 「完成任务」，和网页对不上）
    d.text((x, y), "完成小任务，经营大农场", font=f_sub, fill=ACCENT)
    y += 74

    # --- 描述
    d.text((x, y), "给 6–14 岁孩子的任务激励 App", font=f_desc, fill=INK_700)
    y += 56

    # --- 三个特性胶囊
    chips = ["无广告", "无内购", "数据只存本机"]
    cx = x
    for text in chips:
        tw = d.textlength(text, font=f_chip)
        w = tw + 40
        d.rounded_rectangle((cx, y, cx + w, y + 46), 23, fill=(255, 255, 255))
        d.rounded_rectangle((cx, y, cx + w, y + 46), 23, outline=(226, 214, 198), width=1)
        d.text((cx + 20, y + 10), text, font=f_chip, fill=INK_700)
        cx += w + 12

    # --- 底部一行
    d.text(
        (x, H - 74),
        "安卓 APK · 手机浏览器 · 电脑浏览器   |   免费 · 不用注册",
        font=f_foot,
        fill=INK_500,
    )

    # --- 右侧：手机模型 + 截图
    pw, ph = 262, 566
    px, py = 852, 40

    # 机身阴影
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle(
        (px - 6, py + 18, px + pw + 6, py + ph + 26), 48, fill=(51, 40, 30, 105)
    )
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(26)))

    # 机身
    d.rounded_rectangle((px, py, px + pw, py + ph), 46, fill=(36, 27, 19))
    d.rounded_rectangle((px, py, px + pw, py + ph), 46, outline=(90, 72, 56), width=2)

    # 截图（优先用任务页；没有就用目录里任意一张，别直接崩）
    hero_shot = SHOTS_SRC / "02-tasks.png"
    if not hero_shot.exists():
        pool = sorted(SHOTS_SRC.glob("*.png")) if SHOTS_SRC.exists() else []
        hero_shot = pool[0] if pool else None
    if hero_shot is None:
        return None
    shot = Image.open(hero_shot).convert("RGB")
    iw, ih = pw - 22, ph - 22
    shot = shot.resize((iw, ih), Image.LANCZOS)
    base.alpha_composite(rounded(shot, 36).convert("RGBA"), (px + 11, py + 11))

    # 刘海
    d.rounded_rectangle(
        (px + pw // 2 - 34, py + 20, px + pw // 2 + 34, py + 29), 5, fill=(20, 14, 9, 150)
    )

    # --- 应用图标徽章（压在手机左下角）
    # 图标没生成出来时（缺源图）就跳过徽章，别让整张分享图挂掉。
    icon_path = IMG / "icon-512.png"
    if icon_path.exists():
        badge = 136
        bx, by = px - 78, py + ph - badge - 26
        ring = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(ring).rounded_rectangle(
            (bx - 7, by - 7, bx + badge + 7, by + badge + 7), 40, fill=(255, 255, 255, 255)
        )
        base.alpha_composite(ring.filter(ImageFilter.GaussianBlur(1.2)))
        icon = Image.open(icon_path).convert("RGB").resize((badge, badge), Image.LANCZOS)
        base.alpha_composite(rounded(icon, 34).convert("RGBA"), (bx, by))
    else:
        print("   ⚠️ 没有 site/img/icon-512.png，分享图省掉图标徽章")

    out = SITE / "og-cover.png"
    base.convert("RGB").save(out, optimize=True)
    return out


# ---------------------------------------------------------------- 3. 界面截图
def copy_shots():
    IMG.mkdir(parents=True, exist_ok=True)
    rows = []
    for dst, src in SHOT_MAP.items():
        p = SHOTS_SRC / src
        if not p.exists():
            rows.append((dst, -1, "MISSING"))
            continue
        im = Image.open(p).convert("RGB")
        # 统一到 780 宽（390 逻辑宽 @2x），保证 Retina 下清晰
        if im.width != 780:
            im = im.resize((780, round(im.height * 780 / im.width)), Image.LANCZOS)
        out = IMG / dst
        im.save(out, optimize=True)
        rows.append((dst, out.stat().st_size, f"{im.width}x{im.height}"))

    # 把「这批图是从哪一版 bundle 截的」一起搬到 site/ 下。
    # check-site 拿它和当前 bundle 比 —— 官网的界面截图是发布物，
    # 改了 App 没重拍时页面上就是旧界面的图，而且零报错。
    # （capture.mjs 写 SHOTS-BUILD.txt；这一行负责让它跟着发布。）
    marker = SHOTS_SRC / "SHOTS-BUILD.txt"
    if marker.exists():
        (IMG / "shots-source.txt").write_text(
            marker.read_text(encoding="utf-8"), encoding="utf-8"
        )
    return rows


if __name__ == "__main__":
    IMG.mkdir(parents=True, exist_ok=True)

    print("① 图标")
    for name, size in build_icons():
        print(f"   {name:18} {size / 1024:7.1f} KB")

    print("② 分享卡片")
    og = build_og()
    if og is None:
        print("   ⚠️ 没有可用的界面截图，跳过（site/og-cover.png 保持原样）")
    else:
        print(f"   {og.name:18} {og.stat().st_size / 1024:7.1f} KB")

    print("③ 界面截图")
    total = 0
    for name, size, dim in copy_shots():
        if size < 0:
            print(f"   {name:18} 缺失（源图不存在）")
            continue
        total += size
        print(f"   {name:18} {size / 1024:7.1f} KB  {dim}")
    print(f"   合计 {total / 1024:.1f} KB")
