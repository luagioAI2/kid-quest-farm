# 加一个新游戏 —— 作者手册

> 这份是**上手用的清单**，把散在 `game-plugin-spec.md`（81 KB）里的硬约束
> 收成一页。每条都指回原文章节，要细节就点进去。
>
> 契约的**唯一事实源**是 `src/games/plugin.ts`（类型）+ `src/games/loader.ts`（校验）。
> 本文和它冲突时，**以代码为准**。

---

## 0. 先纠正一个前提：**没有「游戏分辨率」这回事**

这大概是加游戏时最容易想错的一条。这个 App 不是画布，**是响应式 DOM**
（原因见 spec §6.2：不上游戏引擎）。所以：

| 你可能会想 | 实际 |
| --- | --- |
| 「我的画布设成 750×1334 还是 1080×1920？」 | **没有画布。** 宽度由宿主给的容器决定，你只管容器**内部**的排版 |
| 「按 375 宽设计，别的尺寸缩放」 | **不缩放。** 用弹性布局 + 断点，四档各自成立 |
| 「图要出 2x / 3x 吗？」 | 矢量（内联 SVG），**没有倍图概念** |

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

### 1.3 不上游戏引擎（这条有实测数字）

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

### 2.2 `mount` 必须**同步**返回卸载函数

```ts
mount(container: HTMLElement, host: HostApi): () => void
```

- 「读存档」这类异步动作**不能** `await` 在 `mount` 顶层 ——
  写成 `async mount` 会让宿主在「还没拿到卸载函数」的那一小段里**丢掉卸载**。
  ➜ 正确姿势：先同步建好 DOM 和卸载函数，再让内部的 `async init()` 去填内容，
  并用 `disposed` 标志挡住「卸载之后才回来的异步结果」。
- **卸载必须清掉自己注册的定时器 / 监听。**
  ⚠️ `removeEventListener` 要传**同一个函数**：写成
  `addEventListener('click', () => void play())` 的话，
  `removeEventListener` 拿着另一个新函数去删，**一个也删不掉** ——
  症状是切走再切回来，一次点击抽两次。**把 handler 具名。**
- 关于定时器：按钮可用性若取决于 `host.balance()`，而余额会在挂载**之后**变
  （家长去加了个分），`HostApi` 上**没有**「余额变了通知我」的订阅 ——
  所以你只能自己定时重绘。**不清掉的话，切走再切回来就有两个。**

### 2.3 体积预算

**一个新游戏插件的增量 ≤ +15 KB gzip**（纯 SVG + 逻辑，不含位图）。
确实需要位图（照片级奖品图）时走 `site/app/` 那套资源链路，
并且**必须 `loading="lazy"` + 明确宽高**（避免布局抖动）。（spec §6.5）

---

## 3. 经济契约（数字不变量）

```ts
manifest: {
  id: string          // ★ 不许占用内置游戏的 id（会被判为劫持，spec §12.5.1）
  name: string
  emoji: string
  tabLabel: string    // 底部导航文字，≤3 字，多了会挤
  version: string     // 语义化版本，用来判断「可更新」
  minHostApi: number  // 要求的最低宿主 API 版本，现在是 1
  coin: { id, name, emoji }                        // 自己的币
  economy: { playCost, expectedPayout, capPerPrize }
}
```

**四条铁律**

1. **`expectedPayout < playCost`** —— 不能有正期望。这不是平衡问题，
   是「积分不能被游戏刷出来」的地基（spec §5.4）。
2. **币是「算出来的」，不是「存出来的」** —— 余额 = 账本里全部 delta 之和。
   存一个 `balance` 字段就会出现「余额和流水对不上」，而且**不报错**。
   ➜ 用 `host.mintGameCoin()` 进，用 `host.gameCoinBalance()` 读。
3. **币只进不出，且换不回积分**（spec §2.2）。出口只有兑换商城。
4. **扣分只有一个入口**：`host.spendPoints()` —— 守卫和扣款在**同一个事务**里，
   余额不够返回 `false` 且一分不扣。**别自己去算余额再扣。**

**`storage` 上以 `__` 开头的键是宿主保留的**
（`__bundle` 存包代码 / `__coin` 存币账本）：

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
- [ ] `mount` 同步返回卸载函数；异步初始化放在内部 + `disposed` 闸
- [ ] handler 具名；卸载时清定时器 / 监听
- [ ] 能力只走 `host.*`；币只用 `mintGameCoin` / `gameCoinBalance`
- [ ] 容器加 `data-*` 锚点，不用下标定位

**交之前**

- [ ] `npm run lint` 干净
- [ ] `npm test` 全绿（新逻辑要有单测）
- [ ] 走查脚本：**390×844 和 834×1112 两档**，量过几何，有遮挡探针 + 自检
- [ ] 整包增量 ≤ +15 KB gzip

---

## 7. 最小骨架

照抄 `games-src/demo/index.ts`（「许愿池」，零依赖样板，注释把每个坑都写了）。

```ts
import type { GameBundle, HostApi } from '../../src/games/plugin'

const PLAY_COST = 5      // 必须和 manifest.economy.playCost 一致
const PAYOUT = 3         // 必须 < PLAY_COST
const KEY = 'draws'      // 存在自己的命名空间里（宿主自动加 `<gameId>:` 前缀）

function mount(container: HTMLElement, host: HostApi): () => void {
  container.innerHTML = ''
  // ... 同步建 DOM ...
  let disposed = false
  const btn = document.createElement('button')
  const onClick = (): void => void play()   // ★ 具名，否则 removeEventListener 删不掉
  btn.addEventListener('click', onClick)
  const timer = setInterval(() => void paint(), 1500)  // 余额会在挂载后变，得自己重绘
  return () => {
    disposed = true
    clearInterval(timer)
    btn.removeEventListener('click', onClick)
    container.innerHTML = ''
  }
}

const bundle: GameBundle = {
  manifest: {
    id: 'demo', name: '许愿池', emoji: '🌟', tabLabel: '许愿池',
    version: '1.0.0', minHostApi: 1,
    coin: { id: 'star', name: '星币', emoji: '⭐' },
    economy: { playCost: PLAY_COST, expectedPayout: PAYOUT, capPerPrize: 9 },
  },
  mount,
}
export default bundle
```

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
| 契约全文、货币体系、定价公式 | `docs/game-plugin-spec.md` §2 / §3 / §4 / §5 |
| UI / 美术契约原文 | 同上 §6 |
| 测试与验收原文、DOM 锚点 | 同上 §7 |
| 参考实现（农场）拆解 | 同上 §8 |
| 第二个游戏的骨架示例（娃娃机） | 同上 §9 |
| 平台化 / 独立分发（P2 下载、签名） | 同上 §12 |
| 契约的**代码**事实源 | `src/games/plugin.ts`、`src/games/loader.ts` |
| 零依赖样板 | `games-src/demo/index.ts` |
