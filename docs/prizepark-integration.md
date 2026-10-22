# 把 Prize Park（3D 抓娃娃机）接入 farm-2d —— 实施方案

> **⚠️ 本文是 2026-10-21 的决策记录，不是现状说明。**
>
> 当时写的是「v2 插件、`HOST_API = 1`、`mount(container, host)`」。落地过程中契约升到了
> **v3**（`mount` 可返回 Promise、新增 `ctx`、新增 `redeemGameCoin`），并且已经**接完**：
> 本地包 + 签名目录两条来源、货币三段、数据桥、五层验收全部落地。
>
> - **要知道「现在是怎么跑的 / 新游戏怎么接」→ `docs/plugin-architecture.md`**（规则书）
> - **要写包 → `docs/game-authoring-guide.md`**
>
> 本文保留下来的价值是**当时的判断依据**：为什么选插件而不是 iframe、资源怎么从 63.7MB
> 压到 5.2MB、经济模型为什么要重写。这些数字都是实测的，别重复测。

> 目标：把 `E:\plan\test25\prize-park-local` 这个扒下来的 MakePlay 游戏，接进 `kid-quest-farm-2d`。
> 要求：**既能本地内置，也能远程下载**。
> 本文所有数字都是在这台机器上实测的，不是估的。

---

## 0. 结论先行

**路线选 v2 插件（运行时装配），不要 iframe，也不要打进主包。**

理由：farm-2d 已经有一套完整的插件系统（单文件 ESM + `mount(container, host)` + 签名目录 + SHA-256 校验），Prize Park 正好可以做成其中一个包。而"本地"和"远程"在这套架构里**只差一个取包的来源**——代码是同一份，适配层是同一份。

真正的工作量不在"接入"，在下面四件事：

| 优先级 | 事情 | 为什么难 |
|---|---|---|
| P0 | **把 `window.gp` 换成 `host`，且存档从同步改异步** | 游戏在模块顶层同步读存档，宿主 API 全是 async |
| P0 | **资源 63.7MB 怎么交付** | 不能进 JS。**但实测 WebP 后只剩 5.6MB**，见 §3 问题 1 |
| P1 | **`#app{position:fixed}` 会盖住整个宿主** | 一行 CSS 就能让 App 白屏 |
| P1 | **经济映射** | 游戏自带一套会印钱的模型，宿主的硬约束是"币只进不出、期望产出 < 投币" |

**已经验证过的三件事**（省得你怀疑可行性）：

1. three + rapier 打进单文件 = **2.08MB（gzip 790KB）**，无裸 import、无动态 import、wasm 以 1.83MB base64 内嵌 → **blob 模块能跑**。
2. Prize Park 的 3069 行 `game.js` 是**纯 ESM、零相对依赖**（只 import 那 5 个裸名）→ 改造成包没有结构性障碍。
3. 41 张 PNG 转 WebP **压缩 11.3 倍**（8 张样本实测），63.7MB → **5.6MB** → 全量离线可行，不用做分包。

---

## 1. 宿主现状盘点（别重复造轮子）

先把已有的东西列清楚，这些都不用你写：

### 1.1 插件系统（`src/games/`，3378 行，含 6 个测试文件）

```
plugin.ts      契约：HOST_API=1、GameManifestV2、HostApi(9 个方法)、GameBundle
loader.ts      importBundle(代码文本) → blob URL → import() → validateBundle
install.ts     catalog.json + .sig → 验签 → 找条目 → 取包 → 验 SHA-256 → 代码文本
verify.ts      Ed25519 验签、URL 白名单（只允许 https，localhost 例外）
hostApi.ts     HostApi 实现（积分扣款 / 铸币 / 命名空间 storage / 触感 / 音效）
PluginGameHost.tsx  容器 + 卸载兜底（disposed 标记 + replaceChildren）
catalogUrl.ts  CATALOG_URL —— **现在是空字符串，商店未配置**
```

**这条链已经能跑通**：`scripts/demo-catalog.mjs` 会起一个本地目录服务，`catalog:verify` 是走查脚本。

### 1.2 已有一台娃娃机（v1 内置）

`src/features/claw/` —— **6522 行**，React 组件，`React.lazy` 加载：

| 文件 | 行数 | 职责 |
|---|---|---|
| `ClawPage.tsx` | 1112 | 页面 + UI |
| `clawScene.ts` | 2534 | three.js 场景 |
| `clawPhysics.ts` | 1597 | Rapier 物理 |
| `clawTimeline.ts` | 306 | 抓取时间轴 |
| `clawAudio.ts` | 329 | 音频 |
| `clawEconomy.ts`（在 `domain/`） | — | **经济不变量 + 单测** |

它已经解决了你即将遇到的问题：**积分 → 币 → 投币 → 奖品 → 兑换**，而且 `clawEconomy.ts` 里写着一条硬不变量：

> **每局期望产出必须 ≤ 0.8**（不是 < 1，是 ≤ 0.8 留 20% 余量）
> 否则「1 积分买 1 币、1 币玩 1 局、1 币 ≡ 1 积分」就变成一台把积分变多的机器，**而且不报错**。

### 1.3 依赖已就位

`package.json` 里已经有 `three@0.186.1` 和 `@dimforge/rapier3d-compat@0.12.0`。Vite 8.3.0（rolldown）。

⚠️ 但**不要想着复用宿主的这两份**——插件包是独立构建、独立执行的，复用就必须共享模块，那就退化成"同一个构建"，失去独立更新能力（`games-src/vite.config.ts` 的头注释专门写了这条）。

---

## 2. 三条路线对比

| | A. iframe | B. v1 内置（打进 App） | **C. v2 插件（推荐）** |
|---|---|---|---|
| 工作量 | 最小 | 中 | 中大 |
| 经济打通 | ✗ 要自己写 postMessage 桥 | ✓ 直接调 db | ✓ 走 HostApi |
| 独立更新 | ✓ | ✗ 要重发 APK | ✓ 换 catalog 即可 |
| 资源离线 | 要整包塞进 public/ | 要整包进 APK（+63.7MB） | 可下载到 Filesystem |
| 与宿主外观一致 | ✗ 两套 CSS | ✓ | 中（游戏自带 CSS） |
| 卸载干净 | 难（iframe 里的 RAF 不可控） | ✓ React 生命周期 | ✓ `unmount()` 契约 |
| Play 政策 | 中风险（webview 加载未验证 URL） | ✓ | ✓ 已按政策设计 |

**A 为什么不行**：不只是经济，`catalogUrl.ts` 的注释里写得很清楚——Play 政策把"webview 加载未验证的 URL"列为违规示例。iframe 加载远程页面正好踩这条。

**B 为什么不做**：Prize Park 不是 React 组件，塞进 v1 要把它包成 `<ClawProPage/>`，而且 63.7MB 资源会进 APK。这跟"可远程下载"的诉求直接矛盾。

**C 的代价**：你要写一层适配（把 `window.gp` 桥到 `HostApi`），并且要处理资源交付。但这是**一次性的**，之后换游戏只换包。

---

## 3. 六个硬问题，逐个给解法

### 问题 1：资源 63.7MB，不能进 JS，也不该进 APK

41 张 PNG，实测分组：

| 组 | 体积 | 张数 |
|---|---|---|
| 桥机/蛋糕 | 10.12MB | 5 |
| 抱枕 | 8.86MB | 4 |
| 零食 | 8.08MB | 5 |
| 吉祥物 | 8.04MB | 7 |
| 桥机/手办 | 6.53MB | 4 |
| UI/环境 | 6.46MB | 5 |
| 桥机/夜神 | 6.24MB | 3 |
| BIG小熊 | 5.39MB | 5 |
| 邻机 | 2.67MB | 2 |
| 章鱼烧 | 1.32MB | 1 |
| **合计** | **63.7MB** | **41** |

⚠️ 体积大**不是因为分辨率高**。实测尺寸是 `1024×1024`（10 张）和 `1536×1024`（10 张），最大也就 1706×922。2.4MB 的 1024×1024 说明**这是照片级的连续色调图，PNG 压不动**——用错了格式。

#### ★ 先做这一步：转 WebP（实测压缩 11 倍）

我抽了 8 张跑了一遍真实转码（WebP q82, method 6）：

| 文件 | PNG | WebP | WebP@1024 |
|---|---|---|---|
| pillow-dog.png | 2.33MB | 0.21MB | 0.12MB |
| pop-bigbear-main.png | 2.48MB | 0.22MB | 0.13MB |
| cake-plate-box-sheet.png | 2.38MB | 0.21MB | 0.11MB |
| figure-box-sheet.png | 2.24MB | 0.18MB | 0.09MB |
| pop-pillow.png | 2.36MB | 0.19MB | 0.12MB |
| cake-parfait-box-sheet.png | 2.31MB | 0.21MB | 0.12MB |
| bigbear-plush.png | 0.76MB | 0.10MB | 0.10MB |
| pop-badge-hot.png | 0.45MB | 0.04MB | 0.04MB |
| **样本合计** | **15.31MB** | **1.36MB** | **0.82MB** |

**压缩比 11.3×（仅转码）/ 18.6×（转码 + 长边限 1024）。**

全量推算：

```
63.7MB  →  5.6MB（只转 WebP）
        →  3.4MB（转 WebP + 长边限 1024）
```

⚠️ 有例外：`figure-box-sheet.png` / `noctis-box-sheet.png` 这类是**包装展开图，靠 UV 窗口切图**，限制到 1024 会让切出来的面变糊。**这几张要保持原尺寸，只转码不缩放。**

#### 于是资源策略完全变了

原本以为"63.7MB 太大，只能按机台分包"，实测之后 **9MB 出头就能全量离线**：

| | 做法 | 首包 | 离线 | 工作量 |
|---|---|---|---|---|
| S1 | 全走 CDN 绝对 URL | 0 | ✗ 每次玩要联网 | 小 |
| **S2** | **安装时全量下载（WebP 化后）** | **~5.6MB** | ✓ | 中 |
| S3 | 按机台分包 | 1~2MB | 部分 | 大 |

**推荐 S2**：一次性下载 5.6MB 资源 + 3.3MB 代码 ≈ **9MB**，装在 Filesystem 里，之后完全离线。对儿童 App 来说，"装一次、以后不用网"比"每次进游戏等加载"重要得多。

**具体做法**：

1. 转码脚本（一次性）：`sharp` 或 Python PIL 遍历 `assets/`，输出 `.webp`，box-sheet 类跳过缩放
2. 生成 `assets/manifest.json`：`{ "big-bear/pop.png": { "sha256": "...", "bytes": 12345 } }`
3. 安装时按 manifest 逐个下载 → 校验 → 写 `Filesystem` → 存根目录 URI
4. 游戏内 `texLoader.load("assets/xxx.png")` 改成 `texLoader.load(assetUrl("xxx.png"))`
   - 远程模式：CDN 绝对地址
   - 本地模式：Capacitor 的 `convertFileSrc(uri)`（安卓上是 `http://localhost/_capacitor_file_/...`）

⚠️ **不要走"把图片 base64 塞进 JS"**。base64 让体积 +33%，而且 blob 模块解析几十 MB 的字符串会直接卡死浏览器。

⚠️ **WebP 兼容性**：安卓 WebView 5.0+ 和 iOS 14+ 都支持，本项目 Capacitor 8 的最低版本远高于此，**不用担心**。

### 问题 2：`#app{position:fixed;inset:0}` 会盖住整个宿主

游戏入口 CSS（`game.js` 第 44~63 行）里有：

```css
#app{position:fixed;inset:0}
.screen{position:absolute;inset:0;bottom:var(--navH)}
#app{--navH:calc(62px + env(safe-area-inset-bottom))}
```

`position:fixed` 是相对视口的，挂进宿主容器后会**盖住底部导航和顶栏**，孩子点不到"返回"。

**解法**：给游戏根节点换一个类，改成容器内定位。

```css
/* 接入版追加，覆盖掉 fixed */
.pp-root{position:absolute!important;inset:0;overflow:hidden}
```

同时：
- 把 `#app` 改成 `#pp-app`（避免和宿主的 `#root` 内部结构冲突，也避免两个游戏同时挂载时 id 撞车）
- `--navH` 置 0（游戏自己的底部导航要删掉，见问题 5）
- 删掉 `#title` 启动页（宿主已经有自己的入口）

### 问题 3：存档是**同步**读的，宿主 API 是**异步**的

这是最容易埋雷的一条。游戏模块顶层：

```js
const save = { v: 1, coins: 3000, ... }
function loadSave() {
  const s = gp.player.saves.latestSync   // ← 同步 getter
  ...
}
loadSave()   // 模块求值时立刻执行
```

而 `HostApi.storage.get()` 返回 `Promise`。**不能**在模块顶层 await（会变成异步模块，`mount` 拿不到同步返回值）。

**解法：把"读存档"从模块顶层搬到 `mount` 里。**

```ts
// 改造前（模块顶层）
loadSave()
boot()

// 改造后
export default {
  manifest,
  async mount(container, host) {
    const saved = await host.storage.get('save')        // ← 异步在这里等
    return startGame(container, host, saved ?? null)    // ← 同步建场景，返回 unmount
  }
}
```

⚠️ 注意 `mount` 的契约是**同步返回卸载函数**（`plugin.ts` 的注释专门强调过）。所以 `mount` 不能是 `async`——要用上面这种"外层 async 工厂、内层同步 mount"的写法，或者让 `PluginGameHost` 接受一个 async mount（那要改宿主）。

**推荐不改宿主**：在包内做

```ts
export default {
  manifest,
  mount(container, host) {
    let disposed = false
    let inner: (() => void) | null = null
    void (async () => {
      const saved = await host.storage.get('save')
      if (disposed) return                    // ← 关键：读完存档人已经走了
      inner = startGame(container, host, saved)
    })()
    return () => { disposed = true; inner?.() }
  },
}
```

这个 `disposed` 标记和 `PluginGameHost` 里的写法是同一个模式——**孩子秒切 tab 时，异步读存档回来必须立刻丢弃**。

### 问题 4：`window.gp` 的 6 个 API 要桥到 `host`

| 游戏用的 | 宿主给的 | 映射 |
|---|---|---|
| `gp.player.saves.latestSync` | `host.storage.get('save')` | 改成 async，见问题 3 |
| `gp.player.saves.putLatest(save)` | `host.storage.set('save', save)` | 直接映射 |
| `gp.player.user` | 无 | 造一个本地用户 `{id:'local', name:'Player', locale:'zh'}` |
| `gp.player.ready` | 无 | 立刻 resolve |
| `gp.player.submitScore(n)` | 无排行榜 | 写进 `storage('best')`，不联网 |
| `gp.player.topScores(n)` | 无 | 读 `storage('best')`，返回单条 |

⚠️ **一个坑**：游戏的 `persist()` 是**高频**调用的（每次投币、每次 GET、每次离场）。`host.storage.set` 走的是 Dexie 事务，比 localStorage 慢。建议包内做 500ms 防抖 + 离场强制刷盘，否则玩起来会有卡顿。

### 问题 5：裸模块说明符 → 必须打进单文件

游戏用 5 个裸名：`three`、`three/addons/controls/OrbitControls.js`、`@dimforge/rapier3d-compat`、`@makeplay/fx`、`@makeplay/sound`。

blob 模块解析不了裸名（会抛 `Failed to resolve module specifier`）。所以要在 `games-src/` 里单独建一份构建，全部 inline。

**实测结论**（我用宿主现成的 vite 8.3 跑了一次探针）：

```
three + rapier3d-compat → 单文件 2.08MB（gzip 790KB）
  ├─ 含 1.83MB base64 wasm 字面量   ✓ 自包含
  ├─ 裸 import 数量：0              ✓
  └─ 动态 import 数量：0            ✓
```

加上 Prize Park 自己的 279KB，再加 fx 3.2MB + sound 121KB，**全量单文件约 5.7~6.5MB（gzip 约 2MB）**。

**强烈建议砍掉 `@makeplay/fx`**：3.2MB 只为了 4 个预设（`light-hit` / `land-dust` / `teleport-light` / `legendary-reward`）。用 60 行自己写个粒子系统替代，包体立刻 **6.5MB → 3.3MB**。

fx 同时管着两件别的事，要一起补：

```ts
// fx.update(dt) 返回 timeScale（顿帧），游戏主循环拿它缩放 gameplayDt
// fxImpulse 是相机冲击，渲染前加偏移、渲染后还原
const timeScale = 1 - hitStop          // 自己算
camera.position.x += impX * 0.02       // 自己算
```

### 问题 6：没有卸载路径

游戏只有：

```js
addEventListener("pagehide", () => { saveLayout(); sound?.dispose(); fx.dispose() }, { once: true })
```

`pagehide` 在 SPA 切 tab 时**不会触发**。不补卸载，症状是：切走再切回，**RAF 跑两遍、物理步进两遍、音效叠在一起**（`PluginGameHost.tsx` 的头注释就在讲这个）。

**必须补的 `dispose()`**：

```ts
return () => {
  cancelAnimationFrame(rafId)
  clearInterval(busyTickTimer); clearInterval(cardTimer)
  resizeObserver.disconnect()
  removeEventListener('keydown', onKeyDown); removeEventListener('keyup', onKeyUp)
  removeEventListener('resize', resize)
  world?.free()                    // Rapier 必须显式 free，否则 wasm 内存泄漏
  renderer.dispose(); renderer.forceContextLoss()
  scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose?.() })
  texLoader 加载中的 texture 也要 dispose
  sound?.dispose()
  container.replaceChildren()
}
```

⚠️ `renderer.forceContextLoss()` 不能省。一个页面里反复创建 WebGL context 超过 8~16 个，浏览器会开始丢弃最旧的 context（"Too many active WebGL contexts"），表现为**切几次之后场景变黑**。

---

## 4. 经济映射（有硬约束，不能随手接）

### 4.1 宿主的不变量

```
1 积分 → 买 1 币 → 玩 1 局 → 期望拿回 E 币 → E 币 ≡ E 积分
净收益 = E − 1
```

`clawEconomy.ts` 要求 **E ≤ 0.8**。这不是洁癖，是"孩子坐着玩就能刷积分"的防线。

### 4.2 Prize Park 的模型（不能直接用）

| 现状 | 问题 |
|---|---|
| 初始 3000 金币，玩一次 100 | 金币是**存量**，用完就没了 → 不构成印钱，但和积分体系对不上 |
| 奖品 → 跳蚤市场卖 ¥ | ¥ 是第二套货币 |
| **¥ 可以直接抵扣投币**（`startPlay(false, true)`） | ⚠️ **这条是印钞机**：卖奖品得 ¥ → ¥ 换局 → 再抓 → 再卖，完全绕过 `spendPoints` |
| 每日印章 / 任务发金币 | 金币若可换积分，就是第二条印钞路径 |

### 4.3 建议映射

| 游戏内 | 接入后 | 处理 |
|---|---|---|
| 投币（100 金币） | `host.spendPoints(PLAY_COST)` | **删掉金币层**，直接扣积分 |
| 券（免费玩一次） | 保留，但券只能从游戏内任务得 | 不影响积分账本 |
| 跳蚤市场 | **砍掉**，或只保留"估价展示" | 绝不允许 ¥ 抵扣投币 |
| 抓到奖品 | `host.mintGameCoin(1)` | 唯一的出口 |
| 每日印章 / 任务的金币 | 保留为**游戏内装饰** | 不可换积分 |

**参数建议**：`playCost = 5`，每抓到 1 个 `mintGameCoin(1)`。按 Prize Park 的难度（`armPower` 0.8~1.0，实际抓取率大约 20~40%），E ≈ 0.2~0.4 币/局 ≪ 5，**安全余量极大**。

⚠️ 别把 `playCost` 定成 1。定成 1 的话 E 必须 ≤ 0.8，而抓娃娃的天然成功率就可能接近这个数——那正是 `clawEconomy.ts` 反复警告的那一侧。

### 4.4 两套娃娃机共存怎么办

`registry.ts` 里娃娃机（`claw`）已经占了底部导航一格。Prize Park 接进来有两条路：

| | 做法 | 代价 |
|---|---|---|
| **共存** | 新增 id `prize-park`，`tabLabel` 叫「奖品园」 | 导航变成 4 格（农场/娃娃机/奖品园/钓鱼），手机上会挤 |
| **替换** | 把 `features/claw` 下线，`prize-park` 顶它的位置 | 丢掉 6522 行已测代码 + `clawEconomy` 的经济护栏 |

**建议共存，但先只做「设置 → 游戏商店」里的入口，不占底部导航**（`tabLabel` 用「奖品园」，等导航真的挤了再说）。理由：内置娃娃机有完整的家长可调参数（中奖率、兑换价）和单测，是"安全的那台"；Prize Park 是"好玩的那台"，让它先以可选安装的形式存在。

---

## 5. 分阶段实施

### P0 · 可行性验证（0.5 天）

**不写产品代码**，只验证三个假设：

```
1. 用 games-src 的构建配置，把 three + rapier + 一个空 mount 打成单文件
   → 已做：2.08MB，无裸 import ✓
2. 把 Prize Park 的 game.js 原样塞进这个包，只改 window.gp 为桩
   → 验证：能 mount、能渲染、能点 PLAY
3. 用 PluginGameHost 挂上去，确认容器尺寸/卸载正常
```

**验收**：能在 farm-2d 里点开、看到 3D 机台、投一次币、抓到或没抓到、切走再切回不卡死。

### P1 · 适配层（2~3 天）

按这个顺序改，每步都能单独验：

| # | 改什么 | 验收 |
|---|---|---|
| 1 | `#app` → `#pp-app`，`position:fixed` → `absolute`，删启动页和底部导航 | 挂进容器不盖住宿主 |
| 2 | `window.gp` → `host` 桥（6 个 API） | 存档能存能读，刷新后金币还在 |
| 3 | `loadSave()` 从模块顶层搬进 mount（异步） | 秒切 tab 不崩、不留孤儿 |
| 4 | 补 `dispose()` | 切 5 次回来，RAF 只跑一遍（用 `performance.now()` 打点验） |
| 5 | 经济：删 ¥ 抵扣、投币走 `spendPoints`、GET 走 `mintGameCoin` | 余额和流水对得上；不投币玩不了 |

### P2 · 资源（1.5~2 天，走 S2 全量离线）

```
1. 全部 PNG → WebP q82（实测 63.7MB → 5.6MB）
   ⚠️ box-sheet 类（figure/cake/noctis 的展开图）只转码、不缩放 ——
      它们靠 UV 窗口切面，缩了会糊
2. 生成 assets/manifest.json：每张的 sha256 + bytes
3. 加 assetUrl() 间接层（远程 CDN / 本地 convertFileSrc 两种实现）
4. 安装流程：按 manifest 下载 → 校验 → 写 Filesystem → 存根目录 URI
```

**验收**：断网能玩全部 9 台机；卸载游戏后 Filesystem 里的 5.6MB 资源被清干净（不清就是垃圾）。

### P3 · 打包与签名（1 天）

```
1. games-src/prizepark/vite.config.ts（抄 demo 的，改 entry）
2. npm run build:games → games-dist/prizepark.js
3. scripts/sign-catalog.mjs sign → catalog.json + catalog.json.sig
4. 填 CATALOG_URL（现在还是空字符串）
5. npm run catalog:verify 走查
```

### P4 · 本地内置模式（0.5 天）

"本地"和"远程"在 v2 架构里只差取包来源。本地模式：

```ts
// 不发网络请求，直接从 public/ 或打包进来的字符串取
const code = await fetch('/games/prizepark.js').then(r => r.text())
const bundle = await importBundle(code)
```

⚠️ 但**别跳过验签**。本地包同样要过 SHA-256（至少），否则"本地"就成了一个后门——将来有人替换 `public/` 里的文件就能执行任意代码。

---

## 6. 风险清单

| 风险 | 触发条件 | 后果 | 缓解 |
|---|---|---|---|
| **WebGL context 泄漏** | `dispose()` 漏了 `forceContextLoss` | 切 8~16 次后场景变黑 | P1-4 必须验 |
| **Rapier wasm 泄漏** | 漏 `world.free()` | 内存持续涨，安卓低端机 OOM | 同上 |
| **两套 Rapier 共存** | 插件自带 0.14，宿主是 0.12 | 各自独立 world，不冲突但内存翻倍（+2.2MB） | 可接受，别想着共享 |
| **存档写得太频繁** | `persist()` 每次投币都写 | Dexie 事务排队，投币有延迟 | 500ms 防抖 |
| **资源 404** | CDN 路径写错 | 场景能跑但全是白模/黑洞 | 走查脚本要检查 `Network.responseReceived` 里没有 4xx |
| **经济失衡** | `playCost` 定太低 | 孩子刷积分，家长投诉 | `E ≤ 0.8` 写成单测（抄 `clawEconomy.test.ts`） |
| **`position:fixed` 残留** | 只改了 `#app` 没改 `.screen` | 弹层盖住宿主导航 | 全局搜 `fixed` 逐个改 |
| **包体过大** | 没砍 fx | 6.5MB 下载，弱网首装超时 | 砍 fx → 3.3MB |

---

## 7. 最小改造清单（按文件）

```
prize-park-local/
├─ index.html                → 不用（宿主提供 HTML）
├─ platform-stub.js          → 重写成 host-bridge.ts（桥到 HostApi）
├─ game.js                   → 拆成：
│    ├─ boot.ts               init(container, host, saved) 入口
│    ├─ game/                 （原样搬，3069 行里的大头）
│    ├─ ui/                   （CSS 字符串 + DOM 模板，改 id 前缀 + 定位）
│    └─ dispose.ts            卸载
├─ config.js                 → 原样搬（219 行，纯数据）
├─ i18n.js                   → 原样搬（275 键 × 3 语言）
├─ daily.js                  → 原样搬（70 行，纯函数）
├─ market.js                 → **砍掉**（或只保留估价展示）
├─ assets/                   → WebP 化 + 按机台分目录
├─ sound.pack / manifest     → 可选（不接就全用 host.tone()）
└─ engines/ runtime/         → 由构建 inline 进来，不再需要独立文件
```

**能原样搬的**：`config.js`、`i18n.js`、`daily.js`（合计 430 行纯逻辑，零依赖）。这是最省力的部分。

**要动手术的**：`game.js` 的三个位置——模块顶层副作用、`window.gp` 调用点（**9 处**：`ready`×1、`saves`×2、`user`×4、`submitScore`×1、`topScores`×1）、CSS 定位。

⚠️ 别把 `gp.body.*` 那 4 处当成平台调用——那是 Rapier 的刚体变量，跟平台无关，不要动。

---

## 8. 一句话回答

> **接入本身不难**（宿主已经有完整的插件系统和一台跑通的样板），真正的两个坎是 **资源怎么交付** 和 **同步存档改异步**。
>
> 好消息：资源这个坎比预想小得多——**实测 WebP 压缩 11 倍，63.7MB 只要 5.6MB**，全量离线完全可行，不用做按机台分包。
>
> 顺序建议：**先转 WebP（半天，砍 91% 体积）→ 再砍 fx 库（JS 砍一半）→ 然后才是写适配层**。
> 先做完这两件"减法"，剩下的就是照着契约填代码。
