# 心愿商城 · 商品插画规格书

> 这份文档是给**生图工具**看的，不是给开发看的。
> 第 6 节每个商品一段，把「提示词」整段复制过去就能出图；
> 第 4 节是尺寸和技术要求，第 7 节说图放哪里。

---

## 1. 现在是什么样（先看清问题）

心愿商城一共 30 个商品，分两类：

| 类 | 数量 | 现在的图 |
| --- | --- | --- |
| 实物 / 盲盒 | 9 | **一个 emoji**（🧸 🦖 🍰 🎡 …） |
| 游戏 | 22 | 手绘矢量图标（64×64 的「应用图标」） |

量出来的实际尺寸（390px 宽手机，2 倍屏）：

| 位置 | 显示尺寸（CSS） | 2 倍屏实际像素 | 现在里面是什么 |
| --- | --- | --- | --- |
| 列表卡（两列） | 153 × 115 | 306 × 230 | 一颗 30px 的 emoji |
| 详情页大图 | 358 × 269 | 716 × 538 | 一颗 72px 的 emoji |
| 盲盒头卡 | 85 × 64 | 170 × 128 | 一颗 24px 的 emoji |
| 家长定价 / 确认页 | 69 × 52 | 138 × 104 | 一颗 20px 的 emoji |

所以「图太大」其实说反了 —— **是底太大、图太小**：详情页那块 358×269 的粉紫底上，
只有一颗 72px 的字形浮在正中间，四周全是空的。空底看起来就像「这一块占得太多了」。

一句话概括要做的事：**把这块底填满**。底（浅色背景）留在原地，图铺进去。

---

## 2. 一条铁律：图里不要画背景

卡片本身已经有一层底色（六选一，见第 3 节），插画**只画主体 + 一层接触阴影**，
背景透明。这样：

- 同一张图能放在任何底色上，换风格不用重出图；
- 六种底色配同一套图不会花；
- 图里再画一层背景，就成了「底色上贴了一张有底色的图」，边缘会露出一圈方形。

**唯一的例外**：主体需要有地方站（动物园、城堡、恐龙），可以画一小片**很浅的**
地面弧线，宽度不超过画布的 70%，颜色取底色再深一档（不要画草地纹理）。

---

## 3. 美术风格（30 张必须像同一个人画的）

这套图要和 App 里已有的东西放在一起，所以风格不是自由发挥：

1. **扁平矢量**，色块 + 圆角，**不描外轮廓**。描边会把它变成贴纸，
   而卡片已经有圆角和阴影了，再描一圈就厚。
2. **每个物体 2～3 个色阶**（亮面 / 本色 / 暗面），不是 1 个平色。
   平色是廉价感的主要来源；三档就够，不要渐变网格。
3. **一个光源，从左上**。所以高光在左上，接触阴影在正下方偏右一点点。
4. **一层接触阴影**：一个扁椭圆，`#5A3A1E`、透明度 12%～14%，宽度约主体的 80%。
   不要做「整张图后面的投影」，也不要羽化很重。
5. **主体占画布 70%～80%**，居中，四周留白均匀。宁可画小一点也别顶到边 ——
   圆角会切掉。
6. **圆角**：所有转折用圆角，最小半径约画布短边的 1.5%。不要尖锐的三角形尖角
   （除了星星、箭头这类「本来就尖」的元素）。
7. **不要文字**。中文、英文、数字、价格、logo 全都不要 —— 画上去就再也改不了。
8. **不要拟真**：不要照片感、不要 3D 渲染、不要金属反光、不要环境光遮蔽。

### 配色（直接用这六个色系，别自己调）

| 底色名 | 卡片底色 | 主色（主体用它） | 暗部 |
| --- | --- | --- | --- |
| `sun` | `#FEF3C7` | `#FFC247` | `#DFA118` |
| `grass` | `#DCFCE7` | `#7FC15C` | `#4E9B33` |
| `sky` | `#E0F2FE` | `#7FC8F0` | `#3E86B8` |
| `grape` | `#EDE9FE` | `#C8A2F0` | `#8B5CC4` |
| `berry` | `#FFE4E6` | `#FF93AE` | `#D9556F` |
| `tangerine` | `#FFEDD5` | `#FFA85C` | `#D9772A` |

补充色（少量点缀用）：奶油白 `#FFF7EA`、墨色 `#2A2118`（只用于眼睛 / 极小面积）、
阴影 `#5A3A1E`。

⚠️ **主体不要用和底色同色系的浅色**。比如 `sun` 底上画浅黄蛋糕 = 糊成一坨。
主体要么比底色深两档，要么换一个色系。

---

## 4. 技术规格

| 项 | 值 |
| --- | --- |
| 画布比例 | **4:3**（横向）。全 App 只有这一个比例，别出正方形 |
| 母版尺寸 | **1536 × 1152**（或等比放大） |
| 安全区 | 主体落在中间 **80%** 以内（左右各留 10%，上下各留 10%） |
| 背景 | **透明**（PNG-24 带 alpha，或 SVG） |
| 落地格式 | 优先 **SVG**（扁平矢量、任意尺寸清晰、单张 1～3 KB）<br>否则 **WebP** 质量 82，或 PNG-24 |
| 落地尺寸 | 1200 × 900 |
| 单张体积 | ≤ 80 KB（9 张合计 ≤ 0.5 MB） |
| 命名 | `<item_id>.svg` / `.webp` / `.png` —— **必须和 item_id 一字不差** |
| 图层 | 不要合并后加白边、不要加画布外的裁切标记 |

**为什么是 4:3**：列表卡、详情大图、盲盒头卡、定价页这四个容器的比例全是 4:3
（`aspect-[4/3]`）。图按 4:3 出，四个位置都正好铺满，一个像素都不浪费。

**如果工具只能出正方形**：出 1024×1024 也能用，组件会居中显示，
左右各留一条底色 —— 不会裁切，只是两侧多一点空。但**首选 4:3**。

---

## 5. 提示词模板

每个商品的提示词都按这个结构写，出图风格才会统一：

```
<风格前缀> + <主体> + <构图> + <负向>
```

**风格前缀（每条都加）**

```
Flat vector illustration for a children's app, soft pastel palette,
rounded shapes, no outlines, two to three tones per object,
single light source from top-left with a soft top highlight,
one flat elliptical contact shadow underneath in warm brown at 12% opacity,
centered composition, subject fills 75% of the frame,
transparent background, 4:3 aspect ratio, clean and friendly, no text
```

**负向（每条都加）**

```
text, letters, numbers, watermark, logo, photorealistic, 3D render,
harsh black outline, heavy drop shadow, busy background, scenery,
gradient mesh, metallic reflection, cluttered details
```

**构图（每条都加）**

```
subject centered, generous even margins, nothing touching the canvas edge
```

---

## 6. 逐条清单

### 6.1 实物 / 盲盒（9 张 · 第一批）

#### `wish-blindbox` · 游戏盲盒
- **底色** `sun` `#FEF3C7`
- **画什么**：一个珊瑚色礼物盒，盒盖被掀到左边斜靠着，里面跳出一个紫灰色游戏手柄，
  周围三颗礼花。要一眼看出「盒子装的是游戏」。
- **提示词**
  ```
  A coral gift box with its lid tipped over and leaning on the left side,
  a small purple-grey game controller popping out of the open box,
  a few tiny confetti sparkles around, flat vector, soft pastel,
  rounded shapes, no outline, soft contact shadow underneath,
  centered, transparent background, 4:3
  ```

#### `wish-blindbox-5` · 游戏盲盒 · 5 连开
- **底色** `grape` `#EDE9FE`
- **画什么**：五个礼物盒堆成一小摞 —— 前排三个（珊瑚 / 金 / 天蓝），
  后排两个（浅紫 / 珊瑚）露上半截。每个盒子上一条金色缎带。上方几粒礼花。
- **提示词**
  ```
  Five small gift boxes stacked in two rows, three in front and two peeking
  behind, each with a gold ribbon, colors coral gold sky-blue lavender,
  a few confetti sparkles above, flat vector, soft pastel, rounded shapes,
  no outline, soft contact shadow, centered, transparent background, 4:3
  ```

#### `wish-popmart` · 泡泡玛特盲盒
- **底色** `grape` `#EDE9FE`
- **画什么**：一个粉色盒子，盒盖斜靠在左边，盒里探出一个奶油白的小公仔 ——
  圆脑袋、两只粉色耳朵、腮红、头顶一颗金色小圆。要「盲盒开出一个公仔」的感觉。
- **提示词**
  ```
  A pink box with its lid leaning on the left, a cute cream-white chibi figure
  popping out of the box, round head, pink inner ears, blush cheeks,
  a small gold ball on top of its head, flat vector, soft pastel,
  rounded shapes, no outline, soft contact shadow, centered,
  transparent background, 4:3
  ```

#### `wish-study-pad` · 儿童学习机
- **底色** `sky` `#E0F2FE`
- **画什么**：一台白色平板，屏幕上三根彩色柱子（黄 / 蓝 / 绿，像进度条）+
  左上角一个粉色圆点。右边斜靠一支天蓝色触控笔。右下角一颗金星。
- **提示词**
  ```
  A white kids learning tablet with a light blue screen showing three simple
  colored bar-chart bars in yellow blue green and one pink dot,
  a sky-blue stylus leaning against its right side, a small gold star beside it,
  flat vector, soft pastel, rounded shapes, no outline, soft contact shadow,
  centered, transparent background, 4:3
  ```

#### `wish-dino` · 恐龙模型套装
- **底色** `grass` `#DCFCE7`
- **画什么**：一只绿色长颈小恐龙（背上有三片深绿三角板）+ 前面一只橙色的小恐龙。
  两只都朝右，圆润、可爱，不是写实恐龙。
- **提示词**
  ```
  Two cute toy dinosaurs, a larger green long-neck dinosaur with three dark green
  back plates and a smaller orange baby dinosaur in front of it, both facing right,
  chubby rounded bodies, flat vector, soft pastel, rounded shapes, no outline,
  soft contact shadow, centered, transparent background, 4:3
  ```

#### `wish-puzzle` · 1000 片拼图
- **底色** `tan` `#FFEDD5`
- **画什么**：四块拼图摆成 2×2，其中三块已拼好（黄 / 蓝 / 绿），
  右下角那一格是空的（白色虚线框），第四块（紫色）歪在右下角还没放进去。
- **提示词**
  ```
  Four jigsaw puzzle pieces arranged in a 2x2 grid, three pieces placed
  in yellow blue and green, the bottom-right slot empty with a dashed outline,
  the fourth purple piece lying tilted next to the gap, flat vector,
  soft pastel, rounded shapes, no outline, soft contact shadow,
  centered, transparent background, 4:3
  ```

#### `wish-sticker` · 闪光贴纸册
- **底色** `berry` `#FFE4E6`
- **画什么**：一本黄色封面的贴纸册，稍微歪着，底下一叠白纸页露出来。
  封面上印着三张贴纸（粉星 / 蓝心 / 绿圆），四周四颗闪光。
- **提示词**
  ```
  A yellow sticker booklet slightly tilted with a stack of white pages peeking out
  behind it, three die-cut stickers on the cover: a pink star, a blue heart,
  a green circle, four small four-point sparkles around, flat vector,
  soft pastel, rounded shapes, no outline, soft contact shadow,
  centered, transparent background, 4:3
  ```

#### `wish-cake` · 生日蛋糕
- **底色** `berry` `#FFE4E6`
- **画什么**：白色盘子上的双层奶油蛋糕，两层都挂着粉色糖霜（带几滴垂下来的），
  上层插三根不等高的蓝蜡烛，火苗暖黄。下层撒六颗彩色糖针。
- **提示词**
  ```
  A two-tier cream birthday cake on a white plate, pink frosting dripping down
  both tiers, three blue candles of different heights with warm yellow flames,
  colorful sprinkles on the bottom tier, flat vector, soft pastel,
  rounded shapes, no outline, soft contact shadow, centered,
  transparent background, 4:3
  ```

#### `wish-zoo` · 动物园一日游
- **底色** `grass` `#DCFCE7`
- **画什么**：左边一座奶油色大门（两根柱子 + 一道拱 + 拱顶一块白牌子，牌上画一片叶子），
  右边一只黄色长颈鹿站着（身上有深黄斑点）。两根柱子脚下各一丛灌木。
- **提示词**
  ```
  A cream-colored zoo entrance gate with two pillars and an arch with a small
  white sign board on top, a friendly yellow giraffe standing to the right of it
  with darker spots, two small green bushes at the base, flat vector,
  soft pastel, rounded shapes, no outline, soft contact shadow,
  centered, transparent background, 4:3
  ```

---

### 6.2 游戏（22 张 · 第二批）

这 22 款现在用的是 64×64 的「应用图标」（一支手绘矢量），放进 153×115 的卡里只有
72px，四周空一大圈。要统一，就得把它们**扩成 4:3 的场景图** —— 主体不变，
只是多给一点环境（地面弧线、光斑、小道具），让画面铺满。

> 第二批可以晚点做。做的时候**主体必须和下面写的那个一致**，
> 否则同一款游戏在「商店」和「心愿」两处会长得不一样。

| item_id | 名称 | 底色 | 画什么 |
| --- | --- | --- | --- |
| `wish-game-cloudfarm` | 云边小农场 | grass | 一朵白云托着一座红顶奶油墙的谷仓，云下是绿色草地 |
| `wish-game-prizepark` | 抓奖乐园 | berry | 金属吊爪吊着一只金色礼物盒，粉色背景，两点白色星芒 |
| `wish-game-claw3d` | 抓娃娃 | sky | 粉色娃娃机（顶棚 + 玻璃柜 + 底座），柜里一只棕色小熊，爪子悬在它头顶 |
| `wish-game-sugar` | 甜点魔法学院 | sun | 一碟奶油布丁，焦糖顶挂两滴，顶上两颗樱桃，旁边两颗彩色糖珠 |
| `wish-game-anthill` | 蚂蚁搬家 | grass | 两座土黄色蚁丘（一大一小），洞口深色，一只黑蚂蚁扛着一片绿叶 |
| `wish-game-moestrike` | 少女战记 | berry | 一把竖着的剑（银白剑身 + 金色护手 + 紫握把），两侧各一点金色星芒 |
| `wish-game-melonjar` | 爆汁瓜瓜罐 | sky | 一只透明玻璃罐，里面一颗带深绿条纹的西瓜，罐口一圈白色盖子 |
| `wish-game-minergirl` | 挖矿少女 | sun | 一把木柄铁镐斜插着，镐头下压着一块灰色矿石（上面两颗金点） |
| `wish-game-ropeland` | 跳绳羊群 | grass | 一道甩起来的绳子弧线，中间一只离地的白色羊（黑头、垂耳） |
| `wish-game-blockfit` | 方块填空 | sun | 4×4 米白棋盘，四片彩纸拼片（青 / 蓝 / 紫 / 黄）填掉 15 格，右下留一格 |
| `wish-game-deckrush` | 一分钟卡组 | berry | 三张扇形摊开的牌，正面那张印一团橘金火焰，左右两张只露一半 |
| `wish-game-corgi` | 柯基屁屁 | sun | 一只从背后看的柯基屁股（橘色圆屁股 + 下半截两块奶油脸颊 + 两只后爪），顶上落一颗红爱心 |
| `wish-game-screamchick` | 尖叫鸡 | sky | 一个黄色立方体鸡头（三个面明暗不同），三瓣红鸡冠、瞪圆的白眼睛、张开的嘴、下巴红肉髯 |
| `wish-game-sweetspin` | 旋转灯泡 | grass | 一块米白六边形黏土砖，中间一盏亮着的暖黄灯泡（带光晕和射线），左侧一根淡蓝管道接进来 |
| `wish-game-renttower` | 收租公寓 | sky | 一栋米白老公寓，三排窗一亮一暗，底部红雨棚和门，右上角一个橙色圆标 + 白色上升箭头 |
| `wish-game-stackmeow` | 堆呀堆 | berry | 一座窄上去的积木塔（紫 / 青 / 粉 / 黄四块，墨色描边），顶上那块偏左悬着，旁边一颗小星 |
| `wish-game-cellguard` | 细胞守卫 | grass | 一颗紫色带刺大病毒压在上面，底下一颗青绿小细胞举着一颗黄星，中间一颗黄白抗体弹 |
| `wish-game-redbutton` | 别按红按钮 | berry | 一颗红色圆顶按钮（有侧壁厚度），上方三道光，右上角一枚金币 |
| `wish-game-guardshift` | 轮班守卫 | sun | 一座奶油色小城堡（两顶粉尖塔 + 城垛），一条砖路从门口拐向左下，路边一个红斗篷弓兵 |
| `wish-game-hoopsneak` | 偷偷投篮 | sky | 一页横格纸（左侧红边线），右上角一个手绘红圈篮筐，虚线抛物线从球飞向筐，一颗蓝球 |
| `wish-game-doodlederby` | 画马赛跑 | grass | 一页点阵纸，上面一匹橙色蜡笔画的马（一笔折线 + 四条腿），左下角斜着一支橙蜡笔 |

---

## 7. 图放哪里（放进去就生效，不用改代码）

```
kid-quest-farm-online/src/features/wish/art/
├── wish-blindbox.svg
├── wish-cake.webp
├── wish-dino.png
└── …（文件名 = item_id）
```

规则只有一条：**文件名去掉扩展名之后，必须等于 `wish_item.item_id`**。

- 支持 `.svg` / `.webp` / `.png`，同名不同扩展名时**只放一个**。
- 加图、换图、删图都**不需要改任何 `.tsx`**，下次构建自动带上。
- 小于 4 KB 的图会被 Vite 内联进 JS（省一次请求），这是正常的，不影响使用。
- 没有图的商品会**自动回退**：游戏用手绘图标，实物用 emoji —— 所以可以分批交，
  交一批就生效一批，不会出现空白框。

### 交之前自检三条

1. **文件名对不对**：跑 `npx vitest run src/features/wish/WishArt.test.tsx`。
   里面有一条「每张图都对得上一个真实商品」，拼错一个字母就会红
   （否则它只是静默退回 emoji，谁也不会发现）。
2. **透明底**：把图放在浅紫色上打开看一眼，边缘不能有一圈白或一圈方框。
3. **缩到 130px 还认得出**：把图缩到 153×115 看 —— 认不出就是细节太多了。

---

## 8. 验收清单

出图之后对着这张表过一遍，30 张都能打勾才算完：

- [ ] 30 张都是 **4:3**，不是正方形、不是 16:9
- [ ] 背景**透明**，图里没有自带底色
- [ ] 主体居中，四周留白均匀，**没有碰到边**
- [ ] 缩到 **153×115** 还能一眼认出是什么
- [ ] 30 张放在一起，**像同一个人画的**（圆角、色阶数、阴影方向一致）
- [ ] 没有文字 / 数字 / 水印 / logo
- [ ] 主体颜色和底色**拉得开**（浅色底上不画浅色主体）
- [ ] 文件名 = item_id，一字不差
- [ ] 单张 ≤ 80 KB
