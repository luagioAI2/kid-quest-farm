# 插件游戏接入架构（v3 · 2026-10-22）

> **这份是"规则"**：包长什么样、从哪来、怎么装、装完怎么跑、数据怎么存、钱怎么流。
> **怎么写一个包**（尺寸 / 画布 / DOM 锚点 / 观感）看 `game-authoring-guide.md`。
>
> 契约的唯一事实源是 `src/games/plugin.ts`（类型 + `HOST_API`）。
> 本文和代码冲突时**以代码为准**，并且应当立刻改本文。
>
> 换一款新扒的游戏时，按 §9 的五步走，最后一步是 `node scripts/check-plugin.mjs`。

---

## 1. 一句话架构

**游戏是"另一份构建产物"，不是 App 的一个组件。**

```
    ┌─────────────── App（宿主）───────────────┐
    │  积分账本   兑换券账本   钻石账本         │
    │  家长闸门   TabBar   Toast   音效/触感     │
    │                                           │
    │   ┌──── HostApi（9 个方法）────┐          │
    │   │ 余额/扣分/买币/扣币/铸币/   │          │
    │   │ 换券/存储/Toast/音效        │          │
    │   └────────────┬───────────────┘          │
    │                │ mount(container, host, ctx)
    │   ┌────────────▼───────────────┐          │
    │   │ 游戏包（单文件 ESM，另一份构建）│      │
    │   └────────────────────────────┘          │
    └───────────────────────────────────────────┘
```

- 宿主和包之间**没有模块级 import**，只有运行时的一次函数调用。
  所以宿主用什么框架、包用什么框架，互不相干（包可以不用 React）。
- 包**看不到** `store/` `db/` `features/` —— 那些模块在它的产物里根本不存在。
  它唯一能碰外面的口子是 `host`。

## 2. 四段链路（每一段都有自己的信任根）

| 段 | 做什么 | 信任根 | 失败长什么样 |
| --- | --- | --- | --- |
| ① **构建** | 把游戏打成单文件 ESM | —— | blob 里 `Failed to resolve module specifier` |
| ② **取包** | 本地：同源文件；远程：签名目录 | 本地=烧进代码的 SHA-256；远程=Ed25519 目录签名 | 「哈希不对」「签名不对」「目录里没有这款」 |
| ③ **落库** | `__bundle` + `__assets` 写进 `gameKv` | —— | 「装了但打不开」 |
| ④ **挂载** | `mount(container, host, ctx)` | —— | 白屏 / 白模 / 切走再回来跑两遍 |

### 2.1 两种来源，**同一条落库口**

```
本地（随 App 发布）                     远程（商店）
public/games/<id>/<包>                 catalog.json + catalog.json.sig
        │                                      │
        │ 比对 localGames.ts 里的 sha256        │ 验签 → 解析 → 找条目 → 取包
        │                                      │ 比对目录里的 sha256
        └──────────────┬───────────────────────┘
                       ▼
             importBundle(code) → validateBundle()
                       ▼
                 commitPluginBundle()
        （拦内置 id / 校验经济 / 写 __bundle + __assets）
```

- **本地包不需要网络**，也不需要目录和公钥。它省掉的是"信任根从哪来"，
  **不是**省掉校验：`public/` 是发布物，包不能自证，所以哈希必须编译进 JS
  （`src/games/localGames.ts`，由 `scripts/make-local-catalog.mjs` 生成）。
- **远程包**要求 `CATALOG_URL` 与 `CATALOG_PUBLIC_KEY_B64` 都配好。
  两者空着时**下载功能整体关闭**（fail closed），设置页只显示一句说明。
- 两条路的最后三步**完全一样**。抄两份的后果是必然的：总有一天只改了其中一条。

### 2.2 安装后存在哪

| 键（`gameKv`，宿主自动加 `<gameId>:` 前缀） | 内容 | 谁写 |
| --- | --- | --- |
| `__bundle` | 包的代码文本 | 宿主（安装时） |
| `__assets` | 资源根（`/games/<id>/` 或 CDN 前缀） | 宿主（安装时） |
| `__coin` | 币账本（`{delta, memo, at}[]`） | 宿主（只经三扇门） |
| 其它任意键 | 游戏自己的存档 | 游戏（`host.storage`） |

`__` 开头是**宿主保留**：`storage.get/set` 撞上会**抛**，`list()` 会滤掉。
这条是堵后门 —— 否则 `storage.set('__coin', [])` 能把自己的币账本清空。

## 3. 契约 v3（`HOST_API = 3`）

```ts
export interface GameBundle {
  manifest: GameManifestV2
  mount(container: HTMLElement, host: HostApi, ctx: MountContext): Unmount | Promise<Unmount>
}
```

### 3.1 `mount` 可以同步，也可以返回 Promise

```ts
type Unmount = () => void | Promise<void>
```

- 宿主 `mountBundle` 两种都收：`typeof r === 'function' ? r : await r`。
- **推荐同步**：先建 DOM + 返回卸载函数，再让内部 `async init()` 填内容，
  用 `disposed` 挡住"卸载之后才回来的异步结果"。
- **异步也合法**（3D 游戏必须 await 纹理 / 物理 wasm）。代价是
  **卸载函数落地之前容器是空的**，所以：
  ① 别在 mount 里做超过 ~2s 的事（要有自己的加载画面）；
  ② `unmount` 必须能在"刚建好就被调用"时安全执行（孩子秒切 tab）。

> **为什么放宽**：旧契约只允许同步，逼每个插件写"同步壳 + disposed 闸"。
> 第一个真插件（3D 娃娃机）直接违反了，而当时的测试自己 `await mount()`，
> 所以四层验收全绿也照不出来 —— 宿主拿到 Promise 就当成"没有卸载函数"，
> 只 warn，然后返回空函数，于是 `destroy()` **永远不跑**。

### 3.2 `ctx`：资源在哪，由宿主告诉插件

```ts
interface MountContext {
  assetBase: string                    // 以 / 结尾；可能为空串
  assetUrl(rel: string): string        // 唯一正确的拼法
  locale: string                       // 'zh'
}
```

**必须用 `ctx.assetUrl()`，不要自己拼相对路径。** 插件在 `blob:` 模块里跑，
相对路径会以 `blob:` 为基准解析 ⇒ 全 404，而报错是一堆
`could not load texture`，看着像打包坏了。

| 形态 | `assetBase` 实际值 |
| --- | --- |
| 本地内置 | `/games/<id>/` |
| 远程 + CDN | `https://cdn…/<id>/`（目录条目的 `assetBase`） |
| 远程（缺省） | 包地址所在目录 |

### 3.3 容器是**定高盒子**（宿主给，插件填）

`mount` 拿到的 `container` **高度是确定的** —— 等于「顶栏与底栏之间那块」
（390×844 → 698px，834×1112 → 966px）。宿主用「`relative` 父 + `absolute inset-0` 子」
保证这一点，所以插件的 `height:100%` 一定解析得到。

- 插件根节点写 `width:100%; height:100%`（推荐 `position:relative; overflow:hidden`）。
- **别用 `100vh` / `100dvh`** —— 那会把宿主的顶栏 / 底栏也算进去。
- 容器**不随内容长高**；内容超一屏自己滚（滚动区放在自己的内层，不放根节点）。

> ⚠️ 这条是 2026-10-22 用一次**整屏空白**换来的。宿主原来用 `min-h-0 flex-1`
> （靠 flex-grow 撑到 698px），量出来**容器 698px、插件根节点 0px**：
> 插件的 `height:100%` 对着父节点的 `height` 属性解析，而父节点是 `auto`，
> 在多层嵌套 flex 链里浏览器不把 flex-grow 得到的 used height 当 definite。
> 同一结构在**一层** flex 里能量出 698 —— 所以这个坑只在深链上出现，
> jsdom 完全不做布局，假宿主又恰好给了绝对定位盒子 ⇒ **只有真 App + 截图看得见**。
> 验收判据因此写成「根节点高度 **等于** 容器高度」（不是 `> 0`）。

### 3.4 `HostApi`（10 个方法）

| 方法 | 语义 | 关键约束 |
| --- | --- | --- |
| `balance()` | 当前积分（只读） | 现读，不要缓存 |
| `spendPoints(n, memo)` | 花积分 | **唯一**扣分入口，守卫在事务里 |
| `mintGameCoin(n, memo)` | 铸自己的币 | 只接受正数（币只进不出） |
| `spendGameCoin(n, memo)` | 花自己的币（玩一局） | 余额不够返回 `false`，一个不扣 |
| `buyGameCoin(count, rate, memo)` | 积分 → 币 | 扣分与记币在**同一个事务** |
| `redeemGameCoin(count, memo)` | 币 → **兑换券**（没用完的币） | 汇率由宿主从 manifest 读，调用方传不进来 |
| `mintVoucher(count, memo)` | **奖品 → 兑换券**（不经过币） | 2026-10-23 加（HOST_API 4）。娃娃不许产币 |
| `gameCoinBalance()` | 币余额 | **算出来的**（Σdelta），不存 balance |
| `storage.get/set/list` | 自己的命名空间 | `__` 开头抛错 |
| `pushToast/haptic/tone` | 反馈 | 别自己画浮层 |

## 4. 货币三段（唯一正确的流向）

```
   积分 🪙 ──buyGameCoin──▶ 游戏币（每款游戏自己的）──redeemGameCoin──▶ 兑换券 🎟️
     ▲                                                                     │
     │                    奖品 ──mintVoucher──▶ 兑换券（不经过币）           │
  任务/签到                                                                ▼
                                                                   兑换商城
```

★ **币只有一个来源：买。奖品不产币**（2026-10-23 改）。
币是「入场券」，券是「战利品」。奖品如果能变回币，而币能直接开局，
那就是「抓娃娃本身能续玩」—— 一条不花积分的刷券路径。

**三条不可逆约束**（改了就是印钞机）：

1. **兑换券 ⇸ 积分** —— 兑换券永远换不回积分。
2. **兑换券 ⇸ 农场投入** —— 不能买种子 / 地块。
3. **游戏币 ⇸ 积分** —— 币只能玩，不能变回积分。

### 4.1 manifest 里的四个数，和两道闸门

```ts
economy: {
  playCost: 1,            // 一局花多少积分（= 币价，1 币 = 1 积分）
  expectedPayout: 0.6,    // 一局期望产出多少币（**申报值**）
  capPerPrize: 5,         // 单件最多回收多少币
  voucherPerCoin: 1,      // 1 币换几张兑换券；不写 = 不开放兑换
}
```

`src/domain/pluginEconomy.ts` 的 `checkPluginEconomy` 在**安装时**把关：

```
0 < playCost
0 ≤ expectedPayout ≤ 0.8 × playCost        ← 不能有正期望（留 20% 边际）
1 ≤ capPerPrize
expectedPayout × voucherPerCoin < playCost ← 真正的印钞机闸门
```

最后一条是前一条的加强版：兑换券 ≡ 1 积分，所以"一局期望换出多少积分"
才是要守住的数。`expectedPayout < playCost` 只保证**币**不超发；
`voucherPerCoin = 10` 的话 1 个币换 10 张券，照样能刷。

### 4.2 为什么"币"要有两扇门

只有 `mintGameCoin` 的话，币**只进不出**：玩家抓着抓着币越来越多，
却永远花不掉，那个"币"就没有意义。只有 `spendGameCoin` 的话，
币没有来源。两扇门是一对反向门，**都不是"币能换回积分"那条路**。

### 4.3 奖品 → 兑换券：为什么不能用 `mintGameCoin` + `redeemGameCoin` 凑

奖品公园第一版就是「娃娃 → 币」，于是币有了**第二个来源**。用两个门凑成
「铸币再烧掉」看着等价，其实有两个洞：

1. **两个事务**。中间崩一下（或玩家在这几毫秒里关掉 App）就留下**真实的币**，
   而币能直接开局 —— 正好是要堵的那条回路；
2. 每卖一只娃娃，账本上留一对 `+2 / -2`，家长看到的流水没法读。

所以 2026-10-23 加了 `mintVoucher`（HOST_API 4），实现是
`db.mintGameVouchers` → `postHarvest({ source: 'claw_prize', refId: gameId })`
—— 和**内置娃娃机**同一个入口、同一套口径（内置那台一直是「扣 1 币 + 当场发券」，
在 `useApp.settleClawRound` 里同一个事务）。

> 判据：**看币账本**。卖完娃娃如果 `__coin` 里多了一行，就是写错了。
> `src/db/gameCoin.test.ts` 的 `mintGameVouchers` 那组第一条断言就是
> 「币账本一行都不写」。

## 5. 数据桥：存档怎么过

游戏原本多半是"同步读存档"（`gp.player.saves.latestSync`），
而宿主 `storage` 是**异步**的。**不要**在模块顶层 `await`（那会变成异步模块）。

标准姿势：

```ts
export async function mount(container, host, ctx) {
  const saved = await host.storage.get('save')   // ① 先读快照
  const root = document.createElement('div')     // ② 再建 DOM
  container.replaceChildren(root)
  const game = await createGame({ container: root, host, save: saved, ...ctx })
  return () => game.destroy()                    // ③ 最后返回卸载
}
```

写入侧：**防抖 + 卸载时强制 flush**。

```ts
let timer = 0
function schedule() { clearTimeout(timer); timer = setTimeout(flush, 400) }
async function flush() { await host.storage.set('save', latest) }
// destroy() 里：clearTimeout(timer); await flush()
```

- 400ms 是实测值：`persist()` 在投币 / GET / 离场时都会调，
  每次都写 Dexie 事务会让投币有延迟。
- **`save` 里不要存余额**。币的事实只在 `__coin` 账本里；
  存档里那份 `coins` 只用于老档迁移，迁移完就不要再写
  （"同一个事实存两份必然走散"）。

## 6. 样式：必须收进自己的根选择器

包里的 CSS 是 `document.head.appendChild(style)` 注入的，**全局生效**。
而 Tailwind v4 的工具类在 `@layer utilities` 里，**未分层的样式胜过 `@layer`** ——
所以游戏里一条 `.grid{overflow-y:auto;cursor:grab;…}` 会盖掉宿主 **43 处** `.grid`。

规则：

1. 根节点用**自己的前缀类**（`.pp-root` / `.xx-root`），所有选择器以它开头。
2. `@media` / `@supports` 要**递归**收进去；`@keyframes` / `@font-face` 原样保留。
3. 不要用 Shadow DOM 除非游戏本来就不用 `document.getElementById`
   （塞进 shadow root 之后那些调用全部返回 `null`）。
4. 判据不是"看着没坏"，而是浏览器里的**对照元素**：
   在挂载前后量一个宿主自己的 `.grid` 的 `cursor` / `overflow-y`，必须**没变**。

现成实现：`prize-park-local/scope-css.js`（含 5 个坑的注释），可直接抄。

## 7. 卸载：漏一个就"切回来跑两遍"

```ts
return () => {
  alive = false
  cancelAnimationFrame(rafId)
  clearInterval(t); clearInterval(t2)
  ro.disconnect()
  removeEventListener('keydown', onKey)      // handler 必须具名
  world?.free()                              // Rapier 必须显式 free
  renderer?.dispose(); renderer?.forceContextLoss()
  sound?.dispose()
  container.replaceChildren()
}
```

`forceContextLoss()` 不能省：一个页面里 WebGL context 超过 8~16 个，
浏览器会开始丢弃最旧的，表现为"切几次之后场景变黑"。

## 8. 验收：五层，每层都有盲区

| 层 | 命令 | 能发现 | 盲区 |
| --- | --- | --- | --- |
| 1 静态规则 | `node scripts/check-plugin.mjs <包>` | 裸说明符 / 动态 import / manifest / 经济 / id 劫持 / 资源哈希 | 运行期、CSS 作用域、观感 |
| 2 类型 + 单测 | `npm run lint` · `npm test` | 宿主侧改动 | 插件产物（另一份构建） |
| 3 假宿主挂载 | `prize-park-local/scripts/plugin-test.cjs` | blob 加载 / 卸载 / 经济链 / **样式对照** | 真实宿主的 TabBar、Portal、动画层 |
| 4 真 App e2e | `node scripts/e2e-plugin-local.mjs <url> phone\|tablet` | 装 → 设为当前 → 买币 → 玩一局 → 换券 → 切走切回 → 卸载（含**根节点高度 = 容器高度**） | 观感 |
| 5 截图走查 | `capture*.mjs` | 排版 / 错位 / 遮挡 | 不会断言 |

⚠️ 第 3 层"全绿"最容易骗人：脚本里 `.click()` **绕过命中测试**，
被弹层盖住也照样点得到。判"有没有被盖住"只能靠 `elementFromPoint`。

⚠️ 第 3 层还**盖不到容器高度**：假宿主给的是 `100vh` 的绝对定位盒子，
`height:100%` 恰好能解析；真宿主那套嵌套 flex 才是会塌成 0 的那种。
所以第 4 层里那条「根节点高度**等于**容器高度」不是重复劳动 ——
它是**唯一**能抓到「整屏空白而全部断言全绿」的判据（2026-10-22 实测）。

## 9. 接一款新游戏：五步

```bash
# ① 改造：根节点外部传入、gp 桥到 host、rAF 加 alive 守卫、末尾 return { destroy }
#    （参考 prize-park-local 的 plugin.js / gp-bridge.js / wallet.js）

# ② 打包成单文件 ESM（0 裸说明符 / 0 动态 import）
node scripts/build-plugin.mjs

# ③ 静态规则校验（不通过别往下走）
node scripts/check-plugin.mjs ../<新游戏>/dist-plugin/<x>.plugin.mjs --assets=../<新游戏>/assets

# ④ 放进 App 的本地包目录，重新生成清单（哈希烧进代码）
cp <包> public/games/<id>/ && cp -r <资源> public/games/<id>/assets/
#    编辑 public/games/index.json（id / name / version / file / assetBase）
node scripts/make-local-catalog.mjs

# ⑤ 真 App 里走一遍（两档都跑：容器高度 / 底栏文案在这两档上不一样）
npm run build
CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
node scripts/e2e-plugin-local.mjs http://127.0.0.1:4393/ phone
node scripts/e2e-plugin-local.mjs http://127.0.0.1:4393/ tablet
```

> ⚠️ 端口别用 4180 / 4190 / 5190 —— 那几个常被别的项目占着，
> `--strictPort` 绑不上而 `curl` 照样 200，整套 e2e 会跑在**别人的 App** 上。
> 起完先确认服务的是本次构建：`dist/assets/index-*.js` 的文件名要和页面里引用的一致。

装进 App 之后：设置 → 游戏 → 游戏商店 → 「随 App 附带」里点安装 →
「已下载」里设为当前 → 底部导航出现这一格。

## 10. 已知的取舍（写下来，免得以后当成 bug）

| 取舍 | 现状 | 以后怎么办 |
| --- | --- | --- |
| 包代码存在 `gameKv`（IndexedDB 的键值表） | 3.2MB 字符串，能用 | 挪到 `Filesystem`，`gameKv` 只留元数据 |
| 远程资源不做本地缓存 | 走 CDN，每次联网取 | 装到 Filesystem + `convertFileSrc`（`@capacitor/filesystem` 已装） |
| 本地包会进 APK | `public/games/` 会被打包 | 想减包体就把资源改成"首次进入时下载" |
| 一个游戏一份 WebGL 上下文 | 卸载后 `forceContextLoss` 回收 | 同时挂两个 3D 游戏会吃内存（各自独立 Rapier world） |
| 宿主只有中文 | `ctx.locale = 'zh'` | 加 `settings.locale` 后从这里传 |
