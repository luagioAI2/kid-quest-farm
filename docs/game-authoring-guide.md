# 加一个新游戏 —— 作者手册

> 这份是**上手用的清单**，把散在 `game-plugin-spec.md`（81 KB）里的硬约束
> 收成一页。每条都指回原文章节，要细节就点进去。
>
> 契约的**唯一事实源**是 `src/games/plugin.ts`（类型）+ `src/games/loader.ts`（校验）。
> 本文和它冲突时，**以代码为准**。
>
> ★ **2026-10-22 起分了两份**：
> - **本文 = 怎么写一个包**（尺寸 / 画布 / DOM 锚点 / 观感 / 清单）
> - **`docs/plugin-architecture.md` = 规则与架构**（本地/远程两种来源、安装链路、
>   数据桥、货币三段、`mount` 契约、卸载、五层验收）
>
> 换一款新扒的游戏，**先读架构那份的 §9 五步**，再回来看本文的画布与排版。
>
> ⚠️ **2026-10-23：内置娃娃机已整台移除。** 本文多处拿它当「画布游戏」的例子
> （体积 / 取景 / 懒加载 / 卸载），那些**结论仍然有效**，但凡是提到
> `src/features/claw/ClawPage` 这类路径的地方都已经是历史 —— 文件不在了。
> 娃娃机现在是一个**插件**（`claw-machine` 那套代码，走 `public/games/` 那条链）。

---

## 0. 先纠正一个前提：**「分辨率」取决于你用什么渲染**

> ⚠️ **这一节改过一版。** 第一版写的是「**没有『游戏分辨率』这回事**」——
> 那句话**只对 DOM 游戏成立**，对 three.js / WebGL 游戏是**错的**
> （家长 2026-10-16 指出：「我现在要接入一个娃娃机的，用的 three.js」）。
> 下面按两条路分开写。

两条路，**分辨率这件事完全不同**：

| | **DOM 游戏**（内联 SVG / 普通 DOM） | **画布游戏**（three.js / WebGL / Canvas2D） |
| --- | --- | --- |
| 有没有画布 | **没有** | **有**，而且它有**独立于 CSS 尺寸的绘制缓冲** |
| 「分辨率」 | **不是问题** —— 矢量 + 弹性布局，四档各自成立 | **是第一决策** —— 见 §0.4 |
| 倍图 | 没有倍图概念（矢量） | **有** `devicePixelRatio`，且**必须封顶** |
| 典型体积 | 几十 KB | **three.js 最小 135 KB gzip**（实测，见 §0.4 末） |
| 本项目的例子 | 农场（作物 / 动物 / 场景装饰全是内联 SVG） | **娃娃机（曾用 three.js + 懒加载；2026-10-23 已改为插件）** |

**下面 §0.1 ~ §0.3 两条路都适用**（容器的宽、验收档位、触控口径）；
**§0.4 只对画布游戏**。

> 为什么会写错：第一版是从**农场**的实践里总结的。农场确实没有画布
> （spec §6.2 定了「不上游戏引擎」），但那是**农场的**结论，不是**所有游戏**的结论。
> ➜ 教训：**从一个个例总结出的「通则」，先想想它在什么条件下会失效。**

### 0.1 宽度只有一个来源：`.page-col`

```
430px（手机）  672px（≥768）  896px（≥1024）  1024px（≥1280）
```

- 宿主**已经把容器收好了宽**（`PluginGameHost.tsx` 外面就是 `.page-col`）。
  你的游戏**不要再写 `max-w-[...]`** —— 那会和宿主打架，表现为平板上被收两次。
- 内边距由**你自己**给（宿主只保证宽度）。手机参考 `padding: 12~16px`。
- 外壳（顶栏 / 底栏）是通栏的，那是宿主的事，不用你管。

### 0.2 要按**两档**验收，不是一档

| 档 | 视口 | 说明 |
| --- | --- | --- |
| 手机 | **390 × 844** | 主战场，先保证这档不难看 |
| 平板 | **834 × 1112** | 横屏 / 大屏会暴露「内容被拉长」「两边空一大块」 |

⚠️ **画布游戏还要多测一档：横屏手机（844 × 390）。**
宽高比从 0.46 翻到 2.16 —— DOM 游戏只是变挤，**画布游戏是取景整个变样**
（§0.4 的 `contain` 就是为这个写的）。2026-10-16 农场装饰就是**只看宽度**的
断点在横屏上翻的车（`capture-horizon-decor.mjs` 的注释里有完整的表）。

⚠️ **走查图集里看不见的改动 ≈ 没验过**（spec §7.3）。新界面必须加进走查脚本。

### 0.3 其它尺寸口径

| 项 | 标准 |
| --- | --- |
| 触控目标 | **≥ 44 × 44**（孩子手指粗，这条是硬的） |
| 栅格 | **加列，不加格子**：`grid-cols-3 md:grid-cols-4 xl:grid-cols-6` |
| 弹层 | ≥768px 用**居中对话框**；遮罩必须 `fixed inset-0` |
| 精灵画布 | `viewBox="0 0 80 80"`（所有 symbol 统一） |
| **地面线** | **`y = 78`**，**绝不许越过 `y = 80`** |

> ★ 地面线那条是血泪：第一版胡萝卜的根画到 `y=87`，屏幕上就是「根被切了一半」。
> **画之前先算清楚最下沿。**（spec §6.3）

---

## 0.4 【画布游戏】分辨率分**三层**，别混在一起

用 three.js 时，「分辨率」不是**一个**数字，是**三个**，而且**只有一个由你定**：

| 层 | 谁定 | 是什么 | 你写在哪 |
| --- | --- | --- | --- |
| ① **CSS 尺寸** | **宿主** | 画布在屏幕上占多大 | 只写 `width/height: 100%`，宽度由 `.page-col` 给 |
| ② **绘制缓冲尺寸** | **你** | 真正渲染多少像素 | `renderer.setSize(w, h, false)` + `setPixelRatio()` |
| ③ **取景 / 构图** | **你** | 相机看多大范围 | 视锥（`aspect` 或正交的 `left/right/top/bottom`） |

⚠️ **① 和 ② 必须分开。** `setSize(w, h, false)` 第三个参数 `updateStyle=false`
就是「别动 CSS，CSS 我自己管」。**忘了它**，three.js 会往 canvas 上写 inline
`style.width/height`，**和宿主的响应式打架** —— 表现为平板上画布被收两次、
手机上撑出横向滚动。

### ② 绘制缓冲：跟着**容器**走，DPR 封顶 2

```ts
const dpr = Math.min(window.devicePixelRatio || 1, 2)   // ← 必须封顶
renderer.setPixelRatio(dpr)
renderer.setSize(w, h, false)
```

**为什么 DPR 要封顶**：手机常见 DPR 3，`3² = 9` 倍像素填充。
娃娃机这种「每帧都在动 + 有光照」的场景，中低端机会直接掉到 20fps。
封在 2 是「画质几乎看不出、填充量砍掉约 55%」的那一档。

**尺寸来源必须是容器，不是 window**：

```ts
const ro = new ResizeObserver(() => { /* 每帧最多 resize 一次 */ })
ro.observe(container)
// 清理函数里必须 ro.disconnect()
```

⚠️ 别用 `window.addEventListener('resize')` —— 宿主给的宽度来自 `.page-col`，
它**不保证**和 window 一起变（平板分栏、软键盘弹出都不触发 window resize）。

### ③ 取景：娃娃机是「竖柜子」→ 用 `contain`，别用 `cover`

这是 three.js 游戏最容易翻车的一条：**同一个游戏要同时活在 430 宽和 1024 宽**，
宽高比差 2.4 倍。按「填满容器」来做（`cover`），窄屏会把柜子两侧切掉、
宽屏会把爪子切掉 —— 而娃娃机的**爪子、柜内奖品、出货口必须在画面里**。

定一个**设计矩形**（世界单位）。娃娃机是竖的，取 3:4，例如 `DESIGN_W = 9`、`DESIGN_H = 12`：

```ts
// contain：让设计矩形**永远完整可见**，多出来的地方让给背景
const a = w / h
const frustumH = Math.max(DESIGN_H, DESIGN_W / a)
const frustumW = frustumH * a
camera.left = -frustumW / 2; camera.right = frustumW / 2
camera.top  =  frustumH / 2; camera.bottom = -frustumH / 2
camera.updateProjectionMatrix()
```

- 容器比 3:4 **更窄**（手机竖屏）→ 以宽度为准，上下多出来的给背景
- 容器比 3:4 **更宽**（平板 / 桌面）→ 以高度为准，左右多出来的给背景
- **柜子本身永远完整** —— 这是硬要求，**走查要断言**（别只截一张图看）

★ **优先 `OrthographicCamera`**：娃娃机是固定机位的柜子，正交投影没有近大远小，
上面那段就是全部（直接算视锥矩形）。要用 `PerspectiveCamera` 也行，
但把相机**拉远 + `fov` 收小**（≈30°），否则窄屏和宽屏看到的柜子**形状**都不一样。

#### ⚠️⚠️ 上面那段是**起点，不是终点** —— 娃娃机实测踩过（2026-10-16）

**「设计矩形装得下」≠「柜子装得下」。** 娃娃机用的是 `PerspectiveCamera`，
相机是**斜的**（略微俯视 + 偏侧），于是：

- 设计矩形是**屏幕平面**上的一个矩形，而柜子是一个**有厚度的包围盒**；
- 斜着看过去，包围盒的**近端下沿**会投影到比设计矩形**更低**的地方 ——
  实测柜底投影到 **614.7**，而画布只有 **554** 高 ⇒ **柜子被截掉 60px**。
- 症状是**零报错、截图上一眼看不出来**（缺的是柜底那一小条）。

**正确的做法：投影真实包围盒的 8 个角，迭代缩放到装得下。**

```ts
// BOX = 柜体的真实包围盒（世界单位）—— 它是 resize() 和 debugFrame() 的唯一来源
const BOX_CORNERS: [number, number, number][] = []
for (const x of [BOX.minX, BOX.maxX])
  for (const y of [BOX.minY, BOX.maxY])
    for (const z of [BOX.minZ, BOX.maxZ]) BOX_CORNERS.push([x, y, z])

// 每次：摆好相机 → 投影 8 个角 → 量溢出多少 → 按溢出比例把相机推远 → 再来
for (let i = 0; i < 8; i++) {
  placeCamera(dist)
  const over = boxOverflow() * FIT_MARGIN      // FIT_MARGIN = 1.03（留 3% 白边）
  if (over <= 1) break
  dist *= over
}
placeCamera(dist)
```

三条**必须**记住：

1. ⚠️ **`placeCamera` 里必须调 `camera.updateMatrixWorld()`** ——
   `project()` 读的是 `matrixWorldInverse`，而它由 `updateMatrixWorld()` 更新。
   不调的话，第一次投影量到的是**上一帧的相机**，迭代会收敛到错误的距离（且不报错）。
2. **`BOX` 是唯一的尺寸来源** —— 别把柜子高度写成常量。改柜子（加个灯箱）时
   包围盒跟着变，取景自动跟上；写死就变成「改了美术，取景悄悄截掉一块」。
3. **`FIT_MARGIN` 要留在悬崖内侧**（这里是 1.03 = 柜子最多占 97%）——
   留白是为了容忍浮点与像素取整，不是为了好看。

### 画布游戏的其它硬约束

| 项 | 标准 | 为什么 |
| --- | --- | --- |
| 渲染循环 | `requestAnimationFrame`，**卸载时 `cancelAnimationFrame`** | `mount()` 必须返回**同步**清理函数 |
| 资源释放 | `renderer.dispose()` **+ 每个 geometry / material / texture 各自 `.dispose()`** | 不释放 = 显存泄漏，玩几次就崩 |
| 上下文丢失 | 监听 `webglcontextlost` → `preventDefault()`，`webglcontextrestored` 重建 | 手机切后台 / 来电极常见 |
| 触控 | canvas 上 `touch-action: none`；按钮 ≥44×44 | 拖爪子时不许页面跟着滚 |
| 动效开关 | `prefers-reduced-motion` → **停动画，停在静态姿态** | 不是删掉画面（同 spec §7.4） |
| 单文件 | 下载的游戏必须是**单文件零依赖 ESM**（blob URL 加载） | three.js 必须**打进去**，不能留裸模块名 |
| 首帧 | 先给静态占位，别让屏幕空 1 秒 | 中低端机初始化 WebGL 要几百 ms |

### ⚠️ 体积：这才是 three.js 真正的门槛（**实测**，不是估的）

| 东西 | raw | gzip |
| --- | --- | --- |
| **最小 tree-shaken three.js**（Scene / Camera / Renderer + 几个 geometry / material / light） | **540,699 B** | **135,162 B** |
| 整个 App 现在的 JS（`dist/assets/index-*.js`） | 636,937 B | 189,440 B |
| release APK | — | 4,425,376 B（4.2 MB） |

（three `0.186.1`，esbuild `--bundle --minify --format=esm`，只 import 必需项。
⚠️ 这是**下限** —— 真娃娃机还要加模型 / 贴图 / 动画，只会更大。）

⇒ **three.js 一个库 ≈ 整个 App JS 的 71% gzip。**
⇒ 但它只让 **APK 涨约 12%** —— APK 大头是 Android 外壳，不是网页。

**结论（三条，别跳过）**：

1. **three.js 游戏可以做，而且已经做过**（娃娃机，2026-10-16 上线；2026-10-23 整台移除、改成插件）。
   ⚠️ **这一条在 2026-10-16 被改过。** 原文写的是「**别在 P2 之前把 three.js 直接 import 进 `src/`**」，
   理由是「那会一次性给首装包加上 135 KB gzip」—— **那个推理漏了一条路：懒加载**。
   当年娃娃机就是这么做的，首装包**没有**被加上 135 KB（下面的数字是当年的实测，
   文件已删，**手法**仍然照用）：
   - `src/games/pages.ts` 里 `lazy(() => import('../features/claw/ClawPage'))`（**已删**），`App.tsx` 外套 `<Suspense>`；
   - 实测：`ClawPage-*.js` **142.4 KB gzip**（three 在里面），而**主 chunk 只涨 +8.3 KB**（那 8.3 KB 是新 UI 代码）；
   - **判据是字符串不是体积**：`grep -c WebGLRenderer dist/assets/index-*.js` 必须为 **0**。
   ➜ **该守的纪律是「three.js 不许进首装包」，不是「不许 import」** —— 懒加载就满足了前者。
   ⚠️ **别拿「主包只涨 8.3 KB」当「three 很小」的证据** —— 那只证明懒加载生效了。
2. **spec 里「美术预算 ≤ +15 KB gzip」这条，只对「打进主包的美术」成立** ——
   three.js 是它的 **9 倍**。**懒加载的 chunk 该有自己的预算（另定）。**
   别拿 15 KB 去否决娃娃机，那是**用错了尺子**。
3. **想不懒加载就上 three.js 的路只有两条**：**(a)** 先用**内联 SVG / DOM** 做 2D 版；
   **(b)** 老老实实接受首装包涨 135 KB。**推荐 (a) 或者懒加载** —— 别走第三条（直接同步 import）。

---

## 1. 风格

### 1.1 图案用内联 SVG，**不用 emoji 画图案**

emoji 的粗细 / 配色 / 基线由**系统 emoji 字体**决定，永远调不了 ——
这是「看着不细腻」的主因。

> ⚠️ **区分两种用途**：
> - emoji 当**操作图标**（🌱 种子按钮、🔒 锁、➕ 空位）→ **可以**，它本来就是符号；
> - emoji 当**游戏画面**（奖品、角色、作物）→ **不行**。

内联 SVG 的好处：零外部请求（保持离线优先）、改色改粗细就是一个属性、
跟着 CSS 变量走、而且**仍然是普通 DOM**（`querySelector` 能拿到，e2e 不用改）。

### 1.2 颜色：一条主色 + 墨色 / 纸色

- 颜色从 `src/styles/theme.css` 的 token / CSS 变量取，**别写死十六进制**。
- 层级靠**字重 + 留白**，不靠颜色。
- 主色是草地绿 `--accent` 系（`grass-*`）；墨色 `ink-*`、纸色 `paper*`。
- ⚠️ **`ink-900` 是棕色（#33281e），不是黑**。要深蓝得自己写（夜空就是这么处理的）。

### 1.3 不为「2D 精灵」上游戏引擎（这条有实测数字）

> ⚠️ **别把这条读成「不许有 three」** —— 适用范围见 §0.4 结论 1。当年的娃娃机就用了 three.js（懒加载 + 独立 chunk）。
> 这里禁的是「**为了画 2D 精灵**去上一个 2D 引擎」。

| 打包内容 | raw | gzip |
| --- | --- | --- |
| **整个 App**（4 个 tab + 农场 + 市场 + 积分 + 全部逻辑） | 594,769 | **176,456** |
| Pixi 最小用法（Application + Sprite + Assets） | 589,003 | **172,947** |
| Pixi 农场级用法（+ Text / Graphics / 滤镜） | 622,280 | **183,632** |

一个**最小**的 Pixi 包 ≈ **整个 App**。它换来的能力（上千精灵、着色器、粒子）
在「12 块地 + 8 只动物」这个量级上**一点用不到**。
**真正的成本是美术，不是引擎** —— 先把钱和时间花在素材上。（spec §6.2）

### 1.4 排版

- 字重一律 **700**（不用 800 / 900）。
- **中文标题不用负字距**（汉字是满格方块，负字距会挤成一堵墙）。
- 标题与正文的尺度差控制在 **2 ~ 2.5 倍**；正文行高 **1.9**。

### 1.5 动效

- 全部用 **CSS `@keyframes`**，**不写 JS 动画循环**。
- **必须带 `prefers-reduced-motion` 降级**。
  口径是「**停掉位移 / 缩放，但保留内容**」—— 减少动效 ≠ 删掉反馈。
- **复用现成的**，别再造一份同名的：
  `anim-sway` / `anim-float` / `anim-pop` / `anim-sparkle` / `anim-coin-rise` /
  `anim-sheet-up` / `anim-fade-in` / `anim-bounce-in` / `anim-delay-1..5`

### 1.6 素材数量：**能共用的一律共用**

农场作物 4 帧（种子 / 苗 / 成株 / 成熟），压缩策略是：

| 帧 | 共用策略 |
| --- | --- |
| 种子 / 幼芽 | **所有种类共用 1 帧**（现实里幼苗本来就长得像） |
| 苗 | 所有种类共用 1 帧 |
| 成株 | **按「形态」共用**（7 种） |
| 成熟 | 按种类各 1 帧（15 种，**只有果实颜色不同**） |

➜ 15 种作物 = **2 + 7 + 15 = 24 个 symbol**，而不是 60 个。
**你的游戏也这么做**：只让「最后一眼的差别」分开画。

---

## 2. 代码形态（这几条是硬约束，违反了直接加载失败）

### 2.1 一个**单文件、自包含、零依赖**的 ESM

游戏是**另一份构建产物**，运行时下载进来（`fetch` → `Blob` → `import()`）。

- ❌ **不许 import 宿主的运行时模块**（`store/` `db/` `features/`）——
  那些模块在你的产物里根本不存在，构建时就炸。
  ✅ 唯一能用的是**类型**：`import type { GameBundle, HostApi } from '.../plugin'`
  （`import type` 编译期就擦掉了，不产生 import）。
- ❌ **不许有裸模块说明符**（`import x from 'react'`）——
  blob 模块解析不了，运行时报
  `Failed to resolve module specifier`。
  ➜ **要 React 就自己打进去**（或干脆不用 —— 样板游戏「许愿池」就是零依赖的）。
- 所有能力都从 `host: HostApi` 拿。**这是插件唯一能碰外面的口子。**

### 2.2 `mount` 可以同步返回卸载函数，**也可以返回 Promise**（v3）

```ts
mount(container: HTMLElement, host: HostApi, ctx: MountContext): Unmount | Promise<Unmount>
```

- **推荐同步**：先建好 DOM 和卸载函数，再让内部的 `async init()` 去填内容，
  用 `disposed` 标志挡住「卸载之后才回来的异步结果」。
- **异步也合法**（2026-10-22 起）：3D 游戏要 `await` 纹理 / 物理 wasm，
  宿主 `mountBundle` 会 `await` 你返回的 Promise。
  ⚠️ 代价：卸载函数落地之前容器是空的，而且 `unmount` 必须能在
  「刚建好就被调用」时安全执行（孩子秒切 tab）。
- **`ctx` 的第三个参数必须用**：资源路径只能从 `ctx.assetUrl(rel)` 拿。
  自己拼相对路径会以 `blob:` 为基准解析 ⇒ 全 404，报错是
  `could not load texture`，看着像打包坏了。
  ⚠️ `rel` 的口径是**相对 `assets/`**（`assetUrl('assets/ui/x.webp')`）。
  如果你的游戏从 MakePlay 扒下来，`rel` 就是 `"assets/" + p` —— 千万别在
  「插件分支」里把它省掉（2026-10-24 云边小农场：省掉之后 12 个
  `manifest.json` 全 404，而 `res.json()` 吃进 404 正文抛的是
  `SyntaxError: Unexpected non-whitespace character after JSON at position 4`
  —— 因为正文是 `404 Not Found`：`404` 当数字解析完，第 4 个字符 `N` 成了"多余内容"。
  **这个报错完全不像 404**，会把人往"存档坏了 / 序列化"方向带。
  判据：e2e 里断言**整轮挂载 0 个 404**（排除 favicon），静态扫描靠不住）。
- **卸载必须清掉自己注册的定时器 / 监听。**
  ⚠️ `removeEventListener` 要传**同一个函数**：写成
  `addEventListener('click', () => void play())` 的话，
  `removeEventListener` 拿着另一个新函数去删，**一个也删不掉** ——
  症状是切走再切回来，一次点击抽两次。**把 handler 具名。**
- 关于定时器：按钮可用性若取决于 `host.balance()`，而余额会在挂载**之后**变
  （家长去加了个分），`HostApi` 上**没有**「余额变了通知我」的订阅 ——
  所以你只能自己定时重绘。**不清掉的话，切走再切回来就有两个。**

> 这条规则**改过一次**，原因值得记住：旧版写的是「必须同步返回」，
> 而第一个真插件（3D 娃娃机）做不到 —— 它要 await 纹理。结果宿主拿到
> Promise 就当成「没有卸载函数」，只 warn 然后返回空函数，
> `destroy()` **永远不跑**。而当时的测试自己 `await mount()`，所以全绿。
> ➜ **契约如果逼着实现者违反它，那是契约的问题，不是实现的问题。**

#### 2.2.1 反复挂载会踩的四件事（2026-10-23 接爪爪乐时全部踩过）

插件不是"开一次关一次"，是**切 tab 就卸、切回来再挂**。下面四条只有在
"挂第二次"时才会暴露，而它们**都不报错**：

1. **模块顶层不要碰 `document` / `window`。** 任何"建 canvas / 建纹理 / 建材质 /
   挂监听 / 读设置"的代码都必须放进函数里。症状：`node scripts/check-plugin.mjs`
   报 `document is not defined` 或 `window is not defined`（它在 Node 里真
   `import()` 一次来验导出形状），看着像包坏了。爪爪乐原来在 `models.ts` 顶层就
   `glossWhite()`，改成懒建的工厂（`useFreshMaterials()`）。
   云边小农场 2026-10-24 也踩了一次：`window.addEventListener("pagehide", …)`
   和 `void loadAudioPrefs()` 都在模块顶层 —— 后者更阴，它跑的时候
   `__cfStore` 还是 `null`（`start()` 才注入），异常被 `catch` 吞掉，
   **音量/静音设置从来没被恢复过**，而一切看起来正常。
   ➜ 凡是"读存档"的初始化，都必须排在 `start()` 注入后端**之后**。
2. **材质 / 纹理必须每次挂载新建。** 上一轮 `unmount` 已经 `dispose()` 了，
   模块级单例第二轮拿到的是**已销毁的对象** ⇒ 黑屏或纯白，**不报错**。
   判据：切走再切回，画面还能看（`e2e-plugin-claw3d.mjs` ④ 段）。
3. **`Object.assign(debug, { get x() { return x } })` 会当场求值**，
   把那一刻的值拷进去。走查脚本于是永远读到 `intro: true`，
   表现成"点了开始游戏没反应"。要挂**活的**读取器就用
   `Object.defineProperties(debug, { x: { get: () => x } })`。
4. **别在 `document` 上 `preventDefault`。** 爪爪乐原来为了"不许滚动/捏合"
   在 `document` 上挂了 `touchmove` 的 `preventDefault` —— 插件里那等于
   让**宿主整页**滑不动，而症状是"农场页滚不了了"，没人会想到是娃娃机干的。
   收到**自己的根节点**上（`root.addEventListener`）。
5. **卸载时把全局调试钩子摘掉**（`window.__farm` / `window.__gpPlayable` 之类）。
   2026-10-24 实测：云边小农场切走后容器没了，但 `window.__farm` 还指着
   **已销毁**的实例 ⇒ 外部根本判不出"卸载到底跑没跑"（判据失效），
   而第二次挂载时它被覆盖，症状被盖住。
   `__gpPlayable` 更危险：留成 `true` 的话，**第二次挂载时**任何
   「等 `__gpPlayable`」的脚本会立刻通过 —— 那时纹理可能还没加载完，纯假通过。
   ➜ 判据用**身份比较**，别删别人的：`if (globalThis.__farm === game) delete globalThis.__farm`。

### 2.3 容器是**定高盒子**：`height:100%` 一定解析得到

宿主给你的 `container` 是一个**高度确定**的盒子 —— 正好等于「顶栏和底栏之间那块」
（390×844 上量到 698px，834×1112 上是 966px）。所以：

```css
/* 推荐：一屏游戏的根节点就这么写 */
.pp-root { position: relative; width: 100%; height: 100%; overflow: hidden }
```

- **别写 `min-height:100vh` / `100dvh`** —— 那会算上宿主的顶栏和底栏，
  在手机上正好把底栏盖掉一截。
- **容器不会随内容长高**。内容超过一屏就得**自己滚**（`overflow-y:auto` 放在
  你自己的滚动区里，不是放在根节点上 —— 根节点还要装绝对定位的层）。
- 高度变化（转屏、平板）宿主会重新布局，`height:100%` 自动跟着走；
  **画布游戏的绘制缓冲要监听 `ResizeObserver`**（见 §0.4 ②）。

> ⚠️ **这一条是用一次「整屏空白」换来的**（2026-10-22，接入奖品公园时）。
>
> 当时宿主给的是 `min-h-0 flex-1`（靠 flex-grow 撑到 698px）。量出来：
> **容器 698px、插件根节点 0px** —— 整屏空白，而 `canvas` 在、
> `__gpPlayable` 是 true、所有功能断言全绿。只有走查截图能看出来。
>
> 原因：插件根节点写的是 `height:100%`，它对着**父节点的 `height` 属性**解析；
> 而父节点是靠 `flex:1 1 0%` 撑出来的，`height` 属性仍是 `auto`。
> 在**多层嵌套**的 flex 链里，浏览器不把「靠 flex-grow 得到的 used height」
> 当成 definite，于是 `height:100%` 退化成 `auto`，而插件的子元素又全是绝对定位 ⇒ 0。
>
> 现在宿主改成「`relative` 父 + `absolute inset-0` 子」：绝对定位盒子的高度由
> `inset` 定死，与 `height` 属性无关，`height:100%` 必然解析得到。
>
> **验收判据必须写成「等于」而不是「大于 0」**：
> `Math.abs(rootHeight - containerHeight) <= 1`。
> 「h > 0」这条断言在 0px 那次是**唯一**能抓到它的，但它当时写的是 `> 0`，
> 于是抓不到 —— 改成等于之后，`scripts/e2e-plugin-local.mjs` 才真的拦住这一类。

#### 2.3.1 **别动容器的定位**（2026-10-24 接云边小农场时踩的）

宿主的容器是 `<div class="absolute inset-0">` —— `position:absolute` 在**类**里。
云边小农场的 `mount()` 原来这样写：

```js
const prevPos = container.style.position          // ← 读 inline，得到 ""
if (!prevPos || prevPos === 'static') container.style.position = 'relative'  // ← 覆盖了 absolute
```

`container.style.position` 读的是 **inline** 值，宿主的定位在**类**里，于是读成空串，
判定为"没定位"就补了个 `relative`。而 **inline 胜过类**，盒子从
「绝对定位铺满」变成「普通流里的相对定位」：

- `inset-0` 的 `bottom:0` 对 `relative` **不生效**（只认 `top`）；
- 高度退回**内容高度** = canvas 高度。

实测：平板上父容器 966px，插件盒只有 **600px**，底部多出一条空白带。
手机上同样少了 98px（698 → 600）。

**而所有断言照样绿** —— 因为当时写的是 `canvasH === hostH`，两个数一起错
（容器就是被 canvas 撑出来的）。这和 §2.3 那次「整屏空白但全绿」是同一类。

判据要改成**跟父容器比**：

```js
// ★ 不是 canvas == 容器，而是 容器 == 父容器
Math.abs(box.getBoundingClientRect().height - box.parentElement.getBoundingClientRect().height) <= 1
```

写代码时：判断"要不要补定位"必须用**计算值**，并且只还原自己改过的那一项。

```js
const patchedPos = getComputedStyle(container).position === 'static'
if (patchedPos) container.style.position = 'relative'
// unmount: if (patchedPos) container.style.position = prevPos
```


### 2.4 体积预算

**纯 DOM 游戏（内联 SVG + 逻辑）的增量 ≤ +15 KB gzip。**
确实需要位图（照片级奖品图）时走 `site/app/` 那套资源链路，
并且**必须 `loading="lazy"` + 明确宽高**（避免布局抖动）。（spec §6.5）

**3D / 引擎类游戏不受这条约束**，因为它们必然要带 three.js（最小 135 KB gzip）
甚至 Rapier（+ 1.8MB base64 wasm）。替代口径：

- **不进主包**：包是运行时下载的，所以**首装体积不变**；
- **单文件包 ≤ 4 MB**（gzip ≤ 1.2 MB）是**纯 DOM 游戏**的实测可接受上限
  （奖品公园 3.24MB / 1.06MB）；
- **3D + 物理引擎的包会更大，那是引擎的地板价**：爪爪乐（2026-10-23 接入）
  4.98 MB / gzip 1.76 MB —— 其中 three 约 0.7MB、`@dimforge/rapier3d-compat`
  的 wasm 内联成 base64 约 2.6MB。**这两块省不掉**（wasm 不能另发：插件在
  `blob:` 模块里，取不到第二个文件）。判据不是"小"，而是"装得下、起得来"：
  真宿主里从挂载到 `__claw.ready` 实测 3~6 秒（headless SwiftShader，
  真机更快），期间开场页自己在转 loading 条。
- ⚠️ **本地包（`public/games/<id>/`）会进 APK** —— 上面"首装体积不变"只对
  **远程目录**成立。爪爪乐 5MB 是加在 APK 上的；嫌大就只发远程目录，
  别放 `public/`；
- **资源另发**，不进 JS（base64 会让体积 +33%，而且 blob 模块解析几十 MB 字符串会卡死）；
- 资源必须**转 WebP** 并出 `assets/manifest.json`（每张 sha256）。
  奖品公园实测：41 张 PNG 63.7MB → 5.2MB（12.7×）。

---

## 3. 经济契约（数字不变量）

```ts
manifest: {
  id: string          // ★ 不许占用内置游戏的 id（会被判为劫持，spec §12.5.1）
  name: string
  emoji: string
  tabLabel: string    // 底部导航文字，≤3 字，多了会挤；**也不能和内置游戏同名**
  version: string     // 语义化版本，用来判断「可更新」
  minHostApi: number  // 要求的最低宿主 API 版本，现在是 3
  coin: { id, name, emoji }                        // 自己的币
  economy: {
    playCost, expectedPayout, capPerPrize,
    voucherPerCoin?,   // 1 币换几张兑换券；不写 = 不开放兑换
  }
}
```

**五条铁律**

1. **`expectedPayout ≤ 0.8 × playCost`** —— 不能有正期望。这不是平衡问题，
   是「积分不能被游戏刷出来」的地基（spec §5.4）。
2. **`expectedPayout × voucherPerCoin < playCost`** —— 兑换券 ≡ 1 积分，
   所以「一局期望换出多少积分」才是真正要守的数。第 1 条只保证**币**不超发。
3. **币是「算出来的」，不是「存出来的」** —— 余额 = 账本里全部 delta 之和。
   存一个 `balance` 字段就会出现「余额和流水对不上」，而且**不报错**。
   ➜ 用 `host.mintGameCoin()` 进，用 `host.gameCoinBalance()` 读。
4. **币只进不出，且换不回积分**（spec §2.2）。出口只有兑换商城。
5. **扣分只有一个入口**：`host.spendPoints()` —— 守卫和扣款在**同一个事务**里，
   余额不够返回 `false` 且一分不扣。**别自己去算余额再扣。**

**四条钱路，各管一段**（详见 `plugin-architecture.md` §4）

```
积分 ──buyGameCoin──▶ 币 ──redeemGameCoin──▶ 兑换券
                        ▲
                        └── mintGameCoin（抓到奖品）
```

- 买币用 `buyGameCoin(count, rate, memo)`，**不要**自己写「先 spendPoints 再 mint」
  —— 那是两个独立事务，中间崩一下就是「积分扣了、币没到」。
- 换券用 `redeemGameCoin(count, memo)`，**汇率不归你传**：宿主从
  已安装的 manifest 里读 `voucherPerCoin`。所以界面显示的是**返回值**，
  不是自己乘出来的数。

### 3.1 第二种合法形态：**不设币**，积分直接花、卖出直接出券

不是每个游戏都需要中间那枚游戏币。云边小农场（2026-10-24）就是这样接的：

```
积分 🪙 ──spendPoints──▶ 买种子 / 开地 / 领动物 ──▶ 收成 ──卖出──▶ 兑换券 🎟️
                    （mintVoucher，不经过币）
```

申报写法：

```js
economy: { playCost: 10, expectedPayout: 6.5, capPerPrize: 2000, voucherPerCoin: 0 }
```

- `voucherPerCoin: 0` = **不开放「币 → 券」**。`checkPluginEconomy` 对 `rate === 0`
  会跳过第 4 条不变量，这是它明确允许的形态。`check-plugin.mjs` 会给一条提示
  「这个游戏的币只能玩，换不成兑换券」—— 对这类游戏是**预期**，不是错误。
- `manifest.coin` 仍要写（宿主 schema 必填），但它只是占位：本作一次
  `mintGameCoin` / `spendGameCoin` 都没调，币余额恒为 0。
- **`expectedPayout` 按「最坏的那一项」申报，不取平均**。云边小农场逐项算
  「满产卖出 ÷ 种子成本」落在 0.40~0.67，再乘天气/虫害的期望折损 ≈0.87，
  实际期望 0.4~0.55 —— 申报取 0.65（贴着最坏项）。按平均值申报等于漏报，
  漏报的那一刻闸门就失效了。

#### ⚠️⚠️ 插件**不能**发积分，奖励要改投「游戏内资源」

这是本形态最容易犯的错。原版扒下来的游戏里常有「看广告 +50 金币」「清虫 +2 金币」
这类小奖励，直接照搬就会变成**游戏自己印积分** —— 而 HostApi 里根本没有
往 `db.ledger` 写正数的接口（`spendPoints` 只写负数）。有人会想"那我用
`mintGameCoin` 再 `redeemGameCoin` 换出来" —— 那是**绕闸门**，`voucherPerCoin: 0`
时换不出来，写非 0 又会触发第 4 条不变量。

正确做法：**把这些奖励改成游戏内资源**。云边小农场把三处金币奖励
（清虫 / 戳气球 / 消毒）统一改成发 **🧪 神奇肥料**（游戏内道具），
奖励的手感还在，而不变量一点没破。

#### HUD 上别重复画宿主顶栏已有的币种

宿主的顶栏常驻显示 🪙 积分。插件 HUD 再画一个 🪙 胶囊 = 同一个数字画两遍，
而且孩子会以为是两种钱。云边小农场最终是：

| 位置 | 画什么 | 为什么 |
| --- | --- | --- |
| 插件 HUD | 🎟️ 兑换券 | 宿主顶栏**没有**这一项，必须自己显示 |
| 打开种子/动物弹层 | 🪙 余额 | 这里是**花钱**的地方，就近给个"够不够"的参照，只读、没有「＋」 |
| 宿主顶栏 | 🪙 积分 | 宿主的事，插件不要碰 |

「＋ 加积分」这类**入口**一律删掉 —— 积分只能由 App 发（任务 / 打卡 / 家长）。

**`storage` 上以 `__` 开头的键是宿主保留的**
（`__bundle` 存包代码 / `__coin` 存币账本 / `__assets` 存资源根）：

| 方法 | 对 `__` 开头的键 |
| --- | --- |
| `get` / `set` | **抛错**（不静默忽略 —— 那是插件的 bug，必须看得见） |
| `list` | **滤掉**，你只看到自己那部分 |

> ⚠️ 这条是**堵后门**：没有它，`storage.set('__coin', [])` 能把自己的币账本
> 清空，正好绕过 `mintGameCoin` 里「拒绝 `n<=0`」那条守卫。**别想着这么干。**

---

## 4. DOM 锚点

- 网格 / 列表容器加 `data-*`，元素加 `data-<thing>-id`。
  例：`[data-claw-grid]`、`[data-claw-prize="bear"]`。
- ❌ **绝不引入下标定位**（`children[1]`）—— 加一层包裹就静默失效。
  （曾经 `header.children[1]` 当锚点，加包裹后断言**假失败**，已改成 `[data-child-name]`。）
- ❌ **别把网格改成 canvas**，也别给网格套一层包裹 —— 会让现有 4 个 e2e 脚本同时失效。
- 底部导航那一格的锚点是 **`tab-<当前游戏 id>`**（不是固定的 `tab-game`）。
  默认（农场）时它正好是 `tab-farm`，而新手导览和两个走查脚本都钉着这个字符串。

---

## 5. 验收（四层，缺一层就等于没验）

| 层 | 命令 | 能发现 | 盲区 |
| --- | --- | --- | --- |
| 1 类型 | `npm run lint` | 字段改名 / 参数不匹配 | 运行期逻辑 |
| 2 单测 | `npm test` | 经济公式、边界、日切 | 界面 |
| 3 e2e | `node scripts/e2e-*.mjs <url>` | 真实点击、命中测试、遮挡 | 观感、引导气泡 |
| 4 界面走查 | `node scripts/capture*.mjs <url>` | 观感、排版、错位 | 不会断言 |

⚠️ **第 3 层全绿但界面不能用**是本项目最忌讳的假通过：脚本几乎都用 DOM 的
`.click()`，而 `.click()` **绕过命中测试** —— 被弹层盖住也照样点得到。
关键点击必须用**真实鼠标事件 + 遮挡探针**。

**走查脚本的三条规则**（spec §7.3）

1. **绝不写死步数 / 条数**，要「跟着状态走」+ **硬断言 + 非零退出码**。
   （曾写死 `for (i < 4)` 而实际 **6 步** → 脚本全绿却漏掉最坏的两步，报出的数字是假的。）
2. **截图逐字节比对在本项目上无效**（无头 Chrome 不确定）。
   判「抖动还是真变」看文件大小：差 **3~252 字节** = 抖动；真改版面差**几十 KB**。
   要证明「某档没变」就**量几何数值**（`getBoundingClientRect`）。
3. 探针要**自检**：临时盖一层全屏遮罩，可见率**必须掉到 0%**，拿掉又回 100%。
   否则「探针烂掉」和「没被盖住」长得一模一样。

> ★★ 还有一个更隐蔽的：**探针的问法要跟着「特效挂在哪一层」变**。
> 「最上层还在不在这块地里」在**地块级**特效上是个强问题；
> 同样的问法用在**页面级**浮层上就退化成「还在不在这个页面里」= 几乎恒真，
> 脚本会全绿而什么都没验。（2026-10-16 升级特效时踩到，见 spec v1.6）

---

## 6. 上手清单

**动手前**

- [ ] 玩法一句话说清；**这个状态用户怎么走到**？（「状态存在 ≠ 用户走得到」）
- [ ] `id` 不撞内置游戏；`tabLabel` ≤3 字
- [ ] `playCost` / `expectedPayout` / `capPerPrize` 定好，`expectedPayout < playCost`
- [ ] 素材清单：哪些帧共用、哪些各画一张

**画的时候**

- [ ] 内联 SVG（不用 emoji 画图案），`viewBox="0 0 80 80"`，地面线 `y=78`
- [ ] 颜色取 theme token，不写死十六进制
- [ ] 触控目标 ≥ 44×44
- [ ] 动效走 CSS keyframes + `prefers-reduced-motion` 降级

**写的时候**

- [ ] 单文件零依赖，无裸模块名
- [ ] `mount(container, host, ctx)`：同步返回卸载函数，**或**返回 Promise（宿主会 await）
- [ ] 根节点 `height:100%`（容器是定高盒子，§2.3）；内容超一屏**自己滚**，别用 `100vh`
- [ ] 资源**只**走 `ctx.assetUrl('assets/x.webp')`，不自己拼相对路径 ——
      **拼进 `innerHTML` 的 `<img src>` 也算**（`<img src="assets/x.webp">` 在假宿主里是对的、
      在真宿主里 404，因为假宿主把游戏目录当站点根；判据只能是 `naturalWidth > 0`）
- [ ] **不要再挂自己的底部导航**（`.bnav` 那类）—— 宿主 TabBar 就是导航，两条叠着白吃 60px；
      页面内的入口照农场写成底部一排动作磁贴
- [ ] 样式全部收进自己的根类（`@media` 递归收），不写全局 `.grid` / `.card`
- [ ] handler 具名；卸载时清定时器 / 监听 / rAF / WebGL context / 物理 world
- [ ] 能力只走 `host.*`；币只用 `mintGameCoin` / `spendGameCoin` / `gameCoinBalance`
- [ ] 买币走 `buyGameCoin`、换券走 `redeemGameCoin`（不要自己拆成两步事务）
- [ ] 存档在 `mount` 里先读快照再建游戏；写入 400ms 防抖 + 卸载时 flush
- [ ] 容器加 `data-*` 锚点，不用下标定位

**交之前**

- [ ] `npm run lint` 干净
- [ ] `npm test` 全绿（新逻辑要有单测）
- [ ] `node scripts/check-plugin.mjs <包> --assets=<资源目录>` 通过
- [ ] 假宿主挂载：`prize-park-local/scripts/plugin-test.cjs <port>` 通过（含**样式对照**与卸载）
- [ ] 真 App 里装一次：设为当前 → 玩一局 → 换券 → 切走切回 → 卸载
      （`node scripts/e2e-plugin-local.mjs <url> phone|tablet`，**两档都跑**）
- [ ] 走查脚本：**390×844 和 834×1112 两档**，量过几何，有遮挡探针 + 自检
- [ ] 整包体积：纯 DOM ≤ +15 KB gzip；3D 单文件 ≤ 4 MB（gzip ≤ 1.2 MB），资源另发

> 最后那条「真 App 里装一次」**不是可选项**。`plugin-test.cjs` 用的是假宿主，
> `npm test` 跑在 jsdom 里 —— 两者都**不做布局**，也都**不经过真宿主**。
> 2026-10-22 那次「容器 698px / 根节点 0px / 整屏空白」在假宿主里是全绿的
> （假宿主给的是一个 `100vh` 的绝对定位盒子，`height:100%` 恰好解析得到）。
> 只有真宿主 + 截图能看见它。
>
> 同一次还抓到另一条同源的：机台卡片上的奖品图**全是空白**，而「点得动 / 进得去 / 扣钱对」
> 全绿。原因是 `<img src="assets/…">` 没走 `assetUrl()`；假宿主的站点根**恰好**就是游戏目录，
> 所以那边永远是对的。现在真宿主 e2e 里有一条「奖品图全部解码（`naturalWidth > 0`）」。

---

## 7. 最小骨架

`games-src/demo/index.ts`（「许愿池」）是**纯 DOM 的最小样板**：零依赖、同步 `mount`、
只用 `spendPoints` / `mintGameCoin` / `storage` 三类能力，`minHostApi: 1` 也照样能跑。

下面这份是**带 `ctx` / 兑换券 / 定高容器**的 v3 版骨架（3D 游戏和要接兑换的游戏照这个写）。
字段和签名与 `src/games/plugin.ts`（契约的事实源）逐字对应。

```ts
import type { GameBundle, HostApi, MountContext, Unmount } from '../../src/games/plugin'

const PLAY_COST = 5          // 必须和 manifest.economy.playCost 一致
const PAYOUT = 3             // 必须 < PLAY_COST
const VOUCHER_PER_COIN = 1   // 1 币换几张兑换券；宿主会验 PAYOUT × 它 < PLAY_COST
const DRAWS_KEY = 'draws'    // 自己的键（宿主自动加 `<gameId>:` 前缀；`__` 开头是保留的）

async function mount(
  container: HTMLElement,
  host: HostApi,
  ctx: MountContext,          // ★ v3：资源只能从 ctx.assetUrl() 拿
): Promise<Unmount> {
  container.replaceChildren()

  const root = document.createElement('div')
  root.className = 'wish-root'
  // ★ 容器是**定高盒子**（见 §2.3），所以 height:100% 一定解析得到
  root.style.cssText = 'position:relative;width:100%;height:100%;overflow:hidden'
  container.append(root)

  let disposed = false
  const draws = (await host.storage.get<number>(DRAWS_KEY)) ?? 0
  if (disposed) return () => {}          // 读存档期间就被切走了

  // ... 建 DOM（图片一律 ctx.assetUrl('assets/x.webp')）...

  const btn = document.createElement('button')
  const onClick = (): void => void play()   // ★ 具名，否则 removeEventListener 删不掉
  btn.addEventListener('click', onClick)
  const timer = setInterval(() => void paint(), 1500)  // 余额会在挂载后变，得自己重绘

  async function play(): Promise<void> {
    // 钱只走这三扇门（详见 §3）：
    //   host.buyGameCoin(1, 1, memo)        积分 → 币（一个事务）
    //   host.spendGameCoin(1, memo)         玩一局
    //   host.redeemGameCoin(n, memo)        币 → 兑换券（汇率由宿主从 manifest 读）
    const paid = await host.spendPoints(PLAY_COST, '许愿池抽一次')
    if (!paid || disposed) return
    await host.mintGameCoin(PAYOUT, '许愿池中奖')
    await host.storage.set(DRAWS_KEY, draws + 1)
  }

  return () => {
    disposed = true
    clearInterval(timer)
    btn.removeEventListener('click', onClick)
    // 自己塞进 document.head 的 <style>、WebGL context、物理 world 也要在这里收掉
    container.replaceChildren()
  }
}

const bundle: GameBundle = {
  manifest: {
    id: 'demo', name: '许愿池', emoji: '🌟',
    tabLabel: '许愿池',      // ★ 底部导航用的是**这个**（≤3 字），不是 name
    version: '1.0.0',
    minHostApi: 3,          // 3 = 有 ctx / 异步 mount / redeemGameCoin
    coin: { id: 'star', name: '星币', emoji: '⭐' },
    economy: {
      playCost: PLAY_COST,
      expectedPayout: PAYOUT,
      capPerPrize: 9,
      voucherPerCoin: VOUCHER_PER_COIN,
    },
  },
  mount,
}
export default bundle
```

**几处容易抄错的**（每一条都对应一次真事故）

| 抄成 | 会怎样 |
| --- | --- |
| `minHostApi: 1` 却用了 `ctx` / `redeemGameCoin` | 老宿主照样加载，运行到那一步抛 TypeError，症状是「点了没反应」 |
| `mount` 里 `await` 之后才建 DOM，却不给加载态 | 3D 包要 2~5 秒，孩子看到的是**空白** |
| 根节点写 `min-height:100vh` | 算上宿主顶栏 / 底栏，把底栏盖掉一截 |
| 卸载时只清 `container.innerHTML` | 定时器 / `<style>` / WebGL context 全留着，切回来「跑两遍」 |
| `tabLabel` 写成 `name` | 4 个字的游戏名挤进底栏（导航格只按 3 个字设计） |

> ⚠️ `demo` 那份**故意不写** `voucherPerCoin`：它没有兑换入口，
> 写了就等于在家长栏承诺「这游戏能换券」，而孩子找不到那颗按钮。
> 你的游戏**接了 `redeemGameCoin` 再写**它 —— 那才是一条走得通的链。

**独立构建**：`games-src/vite.config.ts`（`npm run build:games`）。
注意三件事：`publicDir: false`（否则 `public/` 会被复制进产物）、
`outDir` 要用 `fileURLToPath(new URL(...))`（相对 Vite root 解析）、
`codeSplitting: false`（Vite 8 用 rolldown，`inlineDynamicImports` 已废弃）。

**本地调试**：起一个**带 CORS 头**的静态服务。
⚠️ 没有 `Access-Control-Allow-Origin` 时，`fetch` 只会报
`TypeError: Failed to fetch`（信息量为零，真正的原因只在 Console 里）——
这是**托管方的准入条件**，不是可选项。（spec §12.3）

---

## 8. 相关文档

| 想知道 | 去哪 |
| --- | --- |
| **现在是怎么跑的 / 新游戏怎么接（先读这个）** | `docs/plugin-architecture.md` |
| 契约全文、货币体系、定价公式 | `docs/game-plugin-spec.md` §2 / §3 / §4 / §5（**v1 规范：看理由，签名以 `plugin.ts` 为准**） |
| UI / 美术契约原文 | 同上 §6 |
| 测试与验收原文、DOM 锚点 | 同上 §7 |
| 参考实现（农场）拆解 | 同上 §8 |
| 第二个游戏的骨架示例（娃娃机） | 同上 §9 |
| 平台化 / 独立分发（P2 下载、签名） | 同上 §12（**落地细节见 `plugin-architecture.md` §2**） |
| 契约的**代码**事实源 | `src/games/plugin.ts`、`src/games/loader.ts` |
| 零依赖样板 | `games-src/demo/index.ts` |
| 真 App 全链路验收 | `scripts/e2e-plugin-local.mjs` |
| 接入方案的历史决策（为什么不走 iframe、资源怎么压） | `docs/prizepark-integration.md` |
