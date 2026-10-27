# 接一款新游戏：从地址到上架

> **一句话**：扒下来 → 起项目名 → 压资源 → 改经济 → 打包 → 落库 → 写详情 → 五层验收。
>
> 每一步都写了**判据**（怎么算做完了）。没有判据的一步等于没做 —— 这个项目
> 吃过太多次「清单上写着、实际没做、四层验收全绿」的亏。

配套文档（别重复读，按需跳）：

| 想知道什么 | 去哪 |
| --- | --- |
| 宿主 ↔ 插件的契约、生命周期、货币三段 | `docs/plugin-architecture.md` |
| 画布分辨率 / 美术口径 / 代码形态硬约束 | `docs/game-authoring-guide.md` |
| 经济系统的原始提案与全部不变量 | `docs/game-plugin-spec.md` |
| 抓娃娃机那一款的完整实施方案（历史） | `docs/prizepark-integration.md` |
| **游戏工程怎么放、怎么各自 git** | `../task-games/README.md` |
| **扒站的自动化流程（skill）** | `~/.workbuddy-ai/skills/scrape-game-into-farm/` |

---

## 0. 先分清三件东西

一款游戏在系统里是**三份东西**，各有各的真相来源。混在一起就会出「改了没生效」。

| | 在哪 | 谁维护 | 怎么更新 |
| --- | --- | --- | --- |
| ① **游戏工程**（源码） | `task-games/<项目>/` | 自己一个 git 仓库 | 改源码 → 重新打包 |
| ② **插件包**（产物） | `<项目>/dist-plugin/<id>.plugin.mjs` | `node scripts/build-plugin.mjs` | 每次改源码都要重打 |
| ③ **宿主里的副本 + 清单** | `public/games/<id>/` + `public/games/index.json` | 本仓库 | 拷包 + 重算哈希 |

信任根有两条，**别混**：

| 来源 | 包在哪 | 凭什么信 |
| --- | --- | --- |
| **本地**（随 App 发） | `public/games/<id>/` | SHA-256 **烧在 `src/games/localGames.ts`**（自动生成） |
| **远程**（任意 https） | 目录里的 URL | Ed25519 签名的 `catalog.json` → 目录里的 SHA-256 |

两条路的最后一步完全一样：`verifySha256` 通过 → 才 `importBundle`。

---

## 1. 工程放哪

**所有游戏工程都在 `E:\plan\test25\task-games\`**，一款一个目录、一个 git 仓库。
宿主仓库**不跟踪游戏源码**，只跟踪 `public/games/` 里的产物。

```
task-games/
  README.md                  ← 目录规范 + 映射表（先读它）
  prize-park-local/          ← 插件 id: prizepark
  cloudfarm/                 ← 插件 id: cloudfarm
  claw-machine/              ← 插件 id: claw3d
  <新项目>/                  ← 插件 id 一律等于目录名
```

⚠️ 前两个的目录名和 id 不一致是历史遗留（目录在定 id 之前就建好了）。
**新游戏一律「目录名 = 插件 id」**，映射只有一份权威来源：`scripts/build-store-shots.py` 的 `PLAN`。

判据：`cd task-games/<项目> && git log --oneline -1` 有输出，且 `git status` 干净。

---

## 2. 起项目名（五个字段，一次定死）

| 字段 | 规则 | 判据 / 反例 |
| --- | --- | --- |
| `id` | 小写字母数字，≤12 字符，**不与内置 id 撞**（`farm` / `fishing`） | `check-plugin.mjs` 会拒「id 劫持」 |
| `name` | 商城名，2~5 个汉字，说清「玩什么」 | 「抓奖乐园」「云边小农场」；反例：「快乐小屋」（说了等于没说） |
| `tabLabel` | **≤5 字**（2026-10-26 从 3 放宽），底部导航一格就那么大 | `check-plugin.mjs` 会拒 6 字 |
| `emoji` | **不能**用 🪙 🎟️ 💎 🕹️ —— 宿主的币种/入口已占用 | `check-plugin.mjs` 有黑名单 |
| `tint` | `grass` / `sky` / `sun` / `berry` 四档，**和已有三款要能一眼分开** | 列表里只有图标，底色是唯一的区分线索 |

⚠️ **改名是三处一起改**：`manifest`（包里）、`public/games/index.json`（清单）、
`src/games/storefront.ts`（商城文案）。只改一处 ⇒ 界面上两个名字并存。
另外机台上印的字是**贴图 / `textures.ts` 里的 `fillText`**，改 manifest 它不会跟着变
（爪爪乐改名那次就是漏了这个）。

---

## 3. 扒取与压资源

### 3.1 扒

用 skill 的脚本，别手点「另存为」：

```bash
node ~/.workbuddy-ai/skills/scrape-game-into-farm/scripts/scrape.mjs \
  https://<host>/v/<n>/index.html  task-games/<id>/_originals/<日期>
```

它做四件事：解析 importmap（裸说明符 → 引擎地址）、按 import 图递归抓、
扫 JS/CSS 里的资源字面量（`assets/xxx.png`、`url(...)`）、把 `*manifest.json` 里列的帧全展开。

**为什么不能 wget 一把梭**：这类站的入口只引一个 `game.js`，真正的资源清单藏在
import 图和运行时拼出来的路径里。静态扫只能拿到「代码里写死的」，帧序列 / 按等级
解锁的贴图要靠运行时补（`--browse` 用真 Chrome 收全部请求）。

**第三类漏抓：流式音频。** `sound.manifest.json` 的 `packs.main.url` 指向一个容器包
（`sound.pack`），而音乐常常再被列成 `assets[*].variants[*].url` 的**独立文件** ——
它们在游戏里是「进了某个场景才加载」，**静态扫和 `--browse` 都收不到**。
症状是**整局没有音乐，而且 0 个 404**（没人请求，当然不 404）。
抓法：按清单里每条声明的 `bytes` 逐条补抓并比对字节数（见 `fetch-missing.mjs` 的 `manifestAudio()`）。
另外容器包总比声明的负载大一点（头部 + 对齐），判「已经抓好」要用**容差**而不是相等。

**判据**：整轮加载 **0 个 404**（`e2e-*.mjs` 里已断言，排除 favicon）。
⚠️ 只数「抓了多少个文件」不算判据 —— 抓漏了不会报错，只会在某个二级页面变成一片空白。

### 3.2 压

```bash
python scripts/convert-webp.py            # png/jpg → webp（脚本随项目走）
```

三条硬规则：

1. **UV 锁定的图绝对不能缩放**。游戏拿 1024 宽的源图开像素窗口（如云边小农场的
   `ranch frame (0,0,1024,960)`），缩放 = 窗口错位（背景拼缝错开、桥面浮到水面上），
   **而且不报错**。这类图只转格式、不改尺寸。
2. 其余按长边 ≤1024 缩。
3. 引用侧（`ALL_TEXTURES` / `ui.js` 的 ico/itemImg）**要和资源同步改成 `.webp`** ——
   两边必须一起改。

体积参考（都是实测，不是估的）：

| 项目 | 单文件 JS | 资源 | 音频 | 合计 |
| --- | --- | --- | --- | --- |
| `prizepark` | 3.24 MB | 5.2 MB | 2.2 MB (`sound.pack`) | **≈ 10.7 MB**（改造前 73 MB） |
| `cloudfarm` | 4.29 MB | 11 MB | 0.5 MB | **≈ 15 MB** |
| `claw3d` | 4.98 MB | 少量 | — | **≈ 5 MB** |

> 宿主里 `public/games/` 的三个目录现在合计 **31 MB**，会进 APK。想减包体就把资源改成
> 「首次进入时下载」（见 `plugin-architecture.md` §10 的取舍表）。

---

## 4. 改造（三层，按顺序做）

### 4.1 插件化：把「一个网页」改成「一个能挂载/卸载的东西」

五件事，缺一个就挂不上或切走切不回：

| # | 改什么 | 反例症状 |
| --- | --- | --- |
| ① | 根节点**由外部传入**（`mount(container, host, ctx)`），不写 `document.body` | 整个 App 被游戏盖住 |
| ② | 存档走 `host.storage`（键 `save` / `settings`），不碰 `localStorage` | 卸载重装捡到旧档 / 独立运行与插件两套数据 |
| ③ | 所有 `rAF` / 定时器 / 事件监听加 `alive` 守卫，`destroy()` 里全摘 | 切走后后台还在跑，切回来跑两遍 |
| ④ | 3D：`renderer.forceContextLoss()` | 切几次之后场景变黑（WebGL context 超上限被丢弃） |
| ⑤ | 样式收进自己的根选择器（`scopeCss()`，抄 `prize-park-local/scope-css.js`） | 宿主的按钮全变成游戏的样子 |

`mount` **可以同步返回卸载函数，也可以返回 Promise**（v3 起合法，宿主会 `await`）。
3D 游戏要 await 资源，就走异步。

⚠️ **不要改宿主给的容器定位**。宿主给的是写在**类**里的 `absolute inset-0`，
用 `container.style.position` 判断会读成空串 ⇒ 补一个 `relative` ⇒ inline 胜过类 ⇒
盒子退回内容高度（平板 966 → 600）。判据用 `getComputedStyle(...).position === 'static'`。

### 4.2 经济：先选一条路，别硬改

**这是整件事里唯一需要「判断」的一步**，其余都是机械活。

| 路 | 形态 | 什么时候用 | manifest |
| --- | --- | --- | --- |
| **A 完整三段** | 积分 → **游戏币** → 玩 → 产出 → 兑换券 | 游戏里「一次机会」本身就是玩法（抓娃娃、抽奖、开箱）。币让「再玩一次」有成本感 | `coin` 必填，`voucherPerCoin > 0` |
| **B 只花积分**（默认） | 积分 → 直接买（种子/道具/关卡）→ 产出卖券 | 经营、消除、养成、跑酷。**币是多余的中间层**，硬加只会多一次点击 | `coin` 留 schema 占位，`voucherPerCoin: 0` |
| **C 纯玩不发券** | 积分 → 买币 → 玩，产出只是分数/记录 | 没有可积累产出（音游、反应类） | `voucherPerCoin: 0`，`expectedPayout: 0` |

**默认选 B。** 云边小农场就是 B：`economy: { playCost: 10, expectedPayout: 6.7, capPerPrize: 2000, voucherPerCoin: 0 }`。
改造时要**删掉原版的加币按钮 / 看广告送币 / 每日签到送币** —— 插件侧没有任何 API
能往积分账本写正数，留着这些按钮只会点到没反应。

两条**不可逆**约束（整个经济系统的地基，`pluginEconomy.ts` 有单测钉着）：

1. **插件不能发积分**。`mintGameCoin` 只收正数，币换不回积分。
2. **一局的期望产出 < 一局的成本**：`expectedPayout × voucherPerCoin < playCost`，
   且 `expectedPayout ≤ 0.8 × playCost`。否则「坐着玩就能刷积分」，任务就白设计了。

⚠️ **有加成机制（组合 / 连击 / 暴击 / 倍率）就必须申报加成后的期望值**。
`prizepark` 申报 0.75 不是基础值 0.6 —— 是 0.6 × (1 + 组合最高加成 25%)。
按基础值申报 = 漏报 = 闸门失效。

⚠️ **凡是「A→B、B 又能换回 A」的闭环，先问那条回边该不该存在**。
`prizepark` 早期回收娃娃给的是**币** ⇒ 抓娃娃能自己续玩 ⇒ 100% 抓到就是永动机。
删掉那条回边（回收只给券）才是关死。

### 4.3 目标：**用游戏的吸引力换任务，不是让孩子泡在游戏里**

设计每一款的经济时都要能回答这个问题：

- 孩子做完任务拿到的积分，在这款游戏里**能撑多久**？（`session` 那一栏要诚实）
- 产出能不能**攒成看得见的东西**（券 / 图鉴 / 一套）？攒不下来就没有「换」的意义。
- 有没有「**不上线就亏**」的机制（限时、连续登录奖励、体力恢复）？**有就砍掉** ——
  那是把游戏留在孩子手机上的钩子，和这个 App 的目的相反。

---

## 5. 打包与落库（六条命令）

```bash
# ① 打包（在游戏工程里）
cd task-games/<项目>
CODEBUDDY_SAFE_DELETE_ENABLED=0 node scripts/build-plugin.mjs
#   判据：输出里有「导出 mount/manifest: true true」「裸说明符: 0」「动态 import: 0」

# ② 静态规则校验（不通过别往下走）
cd ../../kid-quest-farm-2d
node scripts/check-plugin.mjs ../task-games/<项目>/dist-plugin/<id>.plugin.mjs \
     --assets ../task-games/<项目>/assets

# ③ 拷进宿主（包 + 资源）
#    拷什么，看项目里有什么 —— 三款现有游戏的差别就是这三行：
#      包              dist-plugin/<id>.plugin.mjs    必拷
#      贴图/音频资源    assets/                        有就拷成 public/games/<id>/assets/
#      声音包          sound.pack + sound.manifest.json 有就拷到 public/games/<id>/ 根
cp ../task-games/<项目>/dist-plugin/<id>.plugin.mjs public/games/<id>/
cp -r ../task-games/<项目>/assets public/games/<id>/assets        # 没有 assets 就跳过
cp ../task-games/<项目>/sound.* public/games/<id>/ 2>/dev/null    # 没有声音包就跳过
ls public/games/<id>    # 判据：包 + 它运行时要的每个文件都在这一层或 assets/ 下

# ④ 登记清单（id / 名字 / 版本 / 路径）
#    编辑 public/games/index.json —— version 必须等于包里的 manifest.version
#    ⚠️ 改了包就必须升 version，否则「已是最新」永远为真，用户收不到更新

# ⑤ 重算哈希（烧进 src/games/localGames.ts）
node scripts/make-local-catalog.mjs
#   判据：git diff src/games/localGames.ts 里那一行 sha256 变了

# ⑥ 构建 + 真机走一遍
CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build     # 判据：输出里有 built in
CODEBUDDY_SAFE_DELETE_ENABLED=0 npx vite preview --port 4393 --strictPort
node scripts/e2e-plugin-local.mjs http://127.0.0.1:4393/ phone
node scripts/e2e-plugin-local.mjs http://127.0.0.1:4393/ tablet
```

⚠️ **端口别用 4180 / 4190 / 5190** —— 那几个常年被别的项目占着，`--strictPort` 绑不上
而 `curl` 照样 200，整套 e2e 会跑在**别人的 App** 上。起完先确认服务的是本次构建：
`dist/assets/index-*.js` 的文件名要和页面里引用的一致。

⚠️ **`public/games/` 必须 `-text`**（`.gitattributes` 已钉）。按字节哈希校验的包被换行符
改写就装不上，而症状是「装不上」⇒ 人会先去查网络，方向从第一秒就是错的。

---

## 6. 商城详情（家长唯一会看的那一页）

### 6.1 三处登记，一处都不能漏

| 文件 | 放什么 | 漏了会怎样 |
| --- | --- | --- |
| `public/games/index.json` | id / 名字 / 版本 / 包路径 / 资源前缀 | 市场里没有这一款 |
| `src/games/localGames.ts` | **自动生成**（哈希 + 字节数） | 装的时候报「包内容校验不过」 |
| `src/games/storefront.ts` | 商城的全部文案与截图 | `storefront.test.ts` 直接红（双向反查） |

`storefront.test.ts` 是**双向**的：包 → 介绍、介绍 → 包。所以「加了包忘了写介绍」
和「写了介绍但包没了」都会红，不会静默少一款。

### 6.2 `storefront.ts` 每个字段的口径

| 字段 | 口径 | 反例 |
| --- | --- | --- |
| `emoji` | 列表图标用 emoji + 底色，**不用截图缩略图**（9:16 塞进 72px 是一团糊色） | 用截图当图标 |
| `tint` | 图标底色，四档里挑一个和别的款分开的 | 四款都用 `grass` |
| `kind` | `think`（动脑 · 有产出）/ `play`（纯玩 · 图个乐）。**必须和真实经济一致** | 靠运气抓娃娃却归到 `think` |
| `pitch` | 一句话：**孩子在里面做什么** | 「寓教于乐的精品小游戏」 |
| `learn` | 3~4 条「练什么」，**必须是这个游戏里真的会发生的事**（可观察） | 「培养延迟满足能力」 |
| `age` / `session` | 适龄（软建议）/ 一次玩多久 | 「3~99 岁」「玩到停不下来」 |
| `shots` | 截图 + `caption`。**≥3 张**，第一张必须一眼看出这是什么游戏 | 第一张是奖品货架（看着像电商） |
| `about` | 2~3 段，讲「玩起来是什么样」 | 讲开发技术、讲理念 |

**文案红线**（家长点过名，判据在记忆里「文案不能像传销」）：

- **陈述句，不写卖点**。不写「让孩子赢在起跑线」「不只是游戏，而是……」。
- `learn` 里每一条都要能指着截图说「就在这里发生」。
- 「无限 / 永久 / ∞」这类措辞，背后一旦有了上限就必须同步改
  （云边小农场 `times` 365 → 22 之后卡面还写「∞ 次产出」，四层验收全盖不到）。

### 6.3 截图从哪来

```
游戏工程里真机截的图（shots/*.png 或 screenshots/*.png）
   ↓  scripts/build-store-shots.py（360 宽 webp，q80）
public/store/<id>/<n>.webp  ← 商城详情页直接引用
```

三条要求：

1. **必须对当前构建真跑一遍再截**。用原版游戏的参考截图 ⇒ 机台上印的还是别人的海报
   （`claw3d` 第一版就是 `ref-*.png`，被家长抓出来）。
2. **第一张是「这个游戏是什么」**，不是最漂亮的那张。
3. **每张都要有 `caption`，而且只能描述截图里真的有的东西**。

体积参考：11 张合计 **291 KB**（单张 13~20 KB）。别直接引用 780×1688 的 PNG（单张 300~600 KB）。

### 6.4 三道自动闸门

```bash
npm run check:registry          # 四处登记一次性对齐（见下）
npm test -- storefront          # 双向反查 + 分类合法 + 「练什么」非空且不空话
node scripts/capture-store-detail.mjs http://127.0.0.1:4393/ .e2e-scratch/store-detail
#   · 每一款都点开、都截图
#   · 每款截图 ≥3 张、每张 <img> 真的解码出来（naturalWidth > 0）
#   · 每张都有说明文字
```

`check:registry`（`scripts/check-game-registry.mjs`）查的是**四份文件之间的一致性**：
`index.json` ↔ `localGames.ts`（含包体 sha256 / 字节数 / 包里 manifest 的版本）↔
`storefront.ts`（kind / pitch / 练什么 ≥3 条 / about / 截图 ≥3 张且文件真的在）↔
`build-store-shots.py` 的 `PLAN`（**漏一行 = 详情页的图永远是旧的，而且零报错**）。
它带 `--self-test`：把 8 类变异逐个喂进去，证明**每一条检查都会红**（不是恒真）。

⚠️ 结构断言盖不住「图对、说明错」。**图片类走查必须自己看图** —— 断言只能查
「张数 / 是否真解码 / 有没有说明」，查不出「这张图是货架，说明写的是机台」。

---

## 7. 验收：五层 + 两档

| 层 | 命令 | 能发现 | 盲区 |
| --- | --- | --- | --- |
| 1 静态规则 | `node scripts/check-plugin.mjs <包> --assets <目录>` | 裸说明符 / 动态 import / manifest 形状 / 经济闸门 / id 劫持 / 资源哈希 | 运行期、CSS 作用域、观感 |
| 2 类型 + 单测 | `npm run lint` · `npm test` | 宿主侧改动 | 插件产物（另一份构建） |
| 3 假宿主挂载 | `<项目>/scripts/plugin-test.cjs <port>` | blob 加载 / 卸载 / 经济链 / **样式对照** | 真宿主的 TabBar、Portal、动画层；容器高度 |
| 4 真 App e2e | `node scripts/e2e-plugin-local.mjs <url> phone\|tablet` | 装 → 设为当前 → 买币 → 玩一局 → 换券 → 切走切回 → 卸载 | 观感 |
| 5 截图走查 | `capture*.mjs` + `capture-store-detail.mjs` | 排版 / 错位 / 遮挡 | 不会断言 |

三条最容易骗人的：

- **第 3 层全绿最假**：脚本里 `.click()` **绕过命中测试**，被弹层盖住也点得到。
- **第 3 层盖不到容器高度**：假宿主给的是 `100vh` 绝对定位盒子，`height:100%` 恰好能解析。
  第 4 层那条「根节点高度 **等于** 容器高度」是唯一能抓到「整屏空白而全部断言全绿」的判据。
- **两档都要跑**：容器高度、底栏文案在 phone / tablet 上不一样。

⚠️ 两个重活 e2e（3D 游戏）**别并行跑**，会互相饿死（WebGL 初始化被拖垮 ⇒
一个报「钩子没装」、另一个报「根节点 0」）。红的项全是挂载期的、换个跑法就好 ⇒ 是争抢不是坏。

---

## 8. 远程分发（可选）

本地包只适合「随 App 发」的几款。要上架更多，走签名目录：

```bash
node scripts/demo-catalog.mjs        # 生成示例 catalog
node scripts/sign-catalog.mjs        # Ed25519 签名 → catalog.json.sig
bash scripts/check-catalog-signing.sh # 验签名链
```

然后 `src/games/catalogUrl.ts` 的 `CATALOG_URL` 填 `https://…/catalog.json`（`.sig` 自动拼）。
⚠️ 这个地址**必须烧进 App**，不能做成输入框 —— Play 政策把「webview 加载来自不可信来源的
URL」列为违规示例，这是过审论据的一部分。空着的时候设置页会明说「没配置商店」，
**不摆一个点了必然失败的按钮**。

---

## 9. 总清单（照勾）

```
□ task-games/<id>/ 建好，git init + 首次提交（.gitignore / .gitattributes）
□ README 有「接入信息」表（id / 版本 / 来源 / 详情与截图位置）
□ _originals/<日期>/ 存了原始镜像（不入 git）
□ 资源转 webp，UV 锁定的图没缩放，引用侧同步改
□ 插件化五件事（根节点 / storage / alive / forceContextLoss / scopeCss）
□ 经济选定 A/B/C，manifest 四个数与真实玩法一致（含加成后的期望）
□ 没留下任何「送币 / 看广告 / 签到」的入口
□ build-plugin 通过（裸说明符 0 / 动态 import 0 / 导出齐全）
□ check-plugin 通过（含 --assets 哈希）
□ public/games/index.json 登记 + 版本号升了
□ make-local-catalog 重算（localGames.ts 的 sha256 变了）
□ storefront.ts 写了（pitch / learn / age / session / shots / about）
□ 截图 ≥3 张，第一张是「这是什么游戏」，每张有 caption
□ build-store-shots.py 的 PLAN 加了一行，重跑过
□ npm run check:registry 绿（四处登记一致；加 --self-test 确认检查不是恒真）
□ npm run lint / npm test 全绿
□ e2e phone + tablet 各跑一遍
□ capture-store-detail 跑过，**自己看了图**
□ 提交：宿主一个 commit（清单 + 哈希 + 文案），游戏工程一个 commit（版本号）
```

---

## 10. 事故清单（都是真踩过的，改之前先看）

| 症状 | 真因 | 判据 / 修法 |
| --- | --- | --- |
| 装不上，报「包内容校验不过」 | 拷了包没重跑 `make-local-catalog`，或 `.gitattributes` 缺 `-text` | 比 `public/games/*/*.mjs` 的 sha256 与 `localGames.ts` |
| 界面显示「已是最新」但没更新 | 改了包没升 `version` | `PluginStoreCard` 只比 `installed.version === g.version` |
| 挂上了、`ready` 也是 true，但 DOM 不在容器里 | **StrictMode 双挂载**（dev 里 effect 跑两遍，两次 mount 并发共用一个容器，先回来的 unmount 把后来的根节点清了） | 宿主已修（每次挂载给自己的 slot div）。**别用「关掉 StrictMode」收工** |
| 整屏空白但断言全绿 | 容器高度塌成 0 | 断言「根节点高度 == 容器高度」 |
| 资源全 404，报错是 `Unexpected non-whitespace character after JSON at position 4` | `assetUrl(rel)` 的 `rel` 相对 `assets/`，漏了这层；`res.json()` 吃进 404 正文 | 断言整轮 0 个 404 |
| 切走再切回来，后台跑两遍 | `destroy()` 没摘干净（rAF / 监听 / 调试钩子 `window.__xxx`） | 用身份比较删钩子；留 `__gpPlayable = true` 会让第二次挂载立刻「就绪」 |
| 弹层被底部 TabBar 压住，z-index 9999 也没用 | 外壳 `anim-fade` 是隐式层叠上下文 | 盖住整屏的层一律 Portal 到 `document.body` |
| 改完数值，卡面文案还是旧的 | 文案和数值是两处，四层验收全盖不到 | 凡是「无限/永久」措辞都要跟着上限改 |
| 走查截图拍出来是引导页 | 三层遮罩没关（onboarding → 插件欢迎层 → 教练卡） | 判据：截图里文案在 = 探针坏了 |
| 构建报错栈里全是 rolldown | safe-delete 闸门（`SAFE_DELETE_BULK_CONFIRM_REQUIRED`） | 加 `CODEBUDDY_SAFE_DELETE_ENABLED=0` |
| 一按「回标题 / 暂停 / 结算」就抛 `Cannot read properties of undefined (reading 'then')` | 存档适配层的 `putLatest` 返回了 `undefined`，而调用处是 `putLatest(...).then(...)`；**可选链只挡 nullish，方法存在就会调** | 适配层里凡是被 `.then()` 的方法**必须返回 Promise**（`Promise.resolve(true)`） |
| 独立网页全白、canvas 0、**一个错都不报** | 把模块顶层 `await` 改成 `export async function start()` 后模块体不再自执行，而 `index.html` 还挂着 `<script src="./game.js">` ⇒ 什么都没跑 | 入口改成 `import { start }` + `start({container})`；判据是 canvas ≥ 1 **且** 截图颜色 ≥ 20 |
| 整局没有音乐，且 **0 个 404** | 音乐是**流式变体**（`sound.manifest.json` 的 `variants[*].url`），静态扫和 `--browse` 都抓不到；清单路径还漏了 `A()` | 按清单里的 `bytes` 补抓并逐条比对字节数 |
| 按钮看得见、点不到，控制台干净 | `mountDisplay({...})` 没给 `host` ⇒ 它量的是 `#app`/`document.body`（整个视口），canvas 比容器大，超出的部分在容器外 | 传 `host: container`；判据 `elementFromPoint(中心)` 仍在容器内 |

---

## 附录：现有十二款（2026-10-27 快照）

| id | 目录 | 包 | 经济 | 商城分类 |
| --- | --- | --- | --- | --- |
| `prizepark` | `task-games/prize-park-local` | 3.24 MB | 积分 → 币 → 奖品 → 券 | `think` |
| `cloudfarm` | `task-games/cloudfarm` | 4.29 MB | 积分直接花 → 收成卖券 | `think` |
| `claw3d` | `task-games/claw-machine` | 4.98 MB | 积分 → 币 → 抓到即发券 | `play` |
| `sugar` | `task-games/sugar` | 0.97 MB | 积分直接花（**不设币、不发券**，开局 20） | `chill` |
| `anthill` | `task-games/anthill` | 4.11 MB | 积分直接花（**不设币、不发券**，进场 15 + 10 分钟宽限） | `chill` |
| `moestrike` | `task-games/moestrike` | 4.10 MB | 积分直接花（**不设币、不发券**，出击 10，每场都收） | `chill` |
| `melonjar` | `task-games/melonjar` | 5.72 MB | 积分直接花（**不设币、不发券**，开局 8，每局都收） | `chill` |
| `minergirl` | `task-games/minergirl` | 1.11 MB | 积分直接花（**不设币、不发券**，进场 15 + 10 分钟宽限） | `chill` |
| `ropeland` | `task-games/ropeland` | 4.10 MB | 积分直接花（**不设币、不发券**，开局 20，每局都收）；羊毛只买升级/外观，**不换券** | `chill` |
| `blockfit` | `task-games/blockfit` | 4.17 MB | 积分直接花（**不设币、不发券**，点开一道题 10，每局都收）；印章只是 45 枚收集进度，**不换券** | `chill` |
| `deckrush` | `task-games/deckrush` | 4.13 MB | 积分直接花（**不设币、不发券**，点「开始」10，**点「继续」不重复收**）；60 秒构筑 + 6 关战斗 | `chill` |
| `corgi` | `task-games/corgi` | 1.85 MB | 积分直接花（**不设币、不发券**，`mount()` 进场 10 + 10 分钟宽限）；爱心只在游戏存档里，不换券 | `chill` |

包大小是 `localGames.ts` 里 `bytes` 的口径（`make-local-catalog` 现算），
改完包要重算，否则这张表会和清单说的不是一回事。

`HOST_API = 4`（10-23 加 `mintVoucher`：抓到奖品**直接发券**，不经过币）。

`sugar` 是第一款**完全不产出**的游戏，所以 `kind` 多了第三类 `chill`
（`think`/`play` 的说明都写着「花积分换币」，对它就是假话）。
它的「进化经验」存在**游戏自己的存档**里，不进宿主账本 ——
`manifest.coin` 只是闸门要求必填的占位。

现在 `chill` 有九款（`sugar` / `anthill` / `moestrike` / `melonjar` / `minergirl` / `ropeland` / `blockfit` / `deckrush` / `corgi`），
差别只在**收费点**：

| 游戏 | 收费点 | 宽限 |
| --- | --- | --- |
| `sugar` | 「开局」 | 无 |
| `anthill` | `mount()` 进场收一次 | 10 分钟（放置类没有「一局」） |
| `moestrike` | 每次「出击」`enterBattle(n)` | 无（关卡制，每场都是新的一场） |
| `melonjar` | 「开局」 | 无 |
| `minergirl` | `mount()` 进场收一次 | 10 分钟（养成类没有「一局」） |
| `ropeland` | 每次「开始跳绳」`startRun()` | 无（三只铃铛掉光就是一局） |
| `blockfit` | 每次「点开一道题」`startMain()` / `startTa()` | 无（点开就是一局，**翻目录/看标题屏免费**） |
| `deckrush` | 标题屏点「开始」`onStart(fresh)` | 无（**点「继续」是接着上一局，不再收一次**） |
| `corgi` | `mount()` 进场收一次 | 10 分钟（养成类没有「一局」） |

判据一句话：**游戏里有没有「一局」这个动作** —— 有就按局收（关卡 / 回合制 / 抓娃娃），
没有（放置 / 养成）就进场收一次 + 宽限期，且 `paidAt` **必须写存档**（写内存变量等于切走就失效）。

