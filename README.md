# 🌾 小任务农场 · Kid Quest Farm

> 完成小任务，经营大农场。
> 一个给 6–9 岁孩子的「每日任务 + 积分 + 农场经营」激励 App。

单机运行，数据全部存在本机，支持 **Web / 手机浏览器 / 安卓 APK** 三端，可随时导出备份。

## 交付状态

| 项 | 状态 |
| --- | --- |
| 安卓 APK | ✅ `dist-apk/kid-quest-farm-debug.apk`（4.6 MB，可直接安装） |
| Web 产物 | ✅ `npm run build` → `dist/`（约 463 kB / 140 kB gzip） |
| 手机浏览器 | ✅ `npm run dev -- --host` 后同网段访问即可 |
| 单元测试 | ✅ 66 项通过（结算 41 / 周期 14 / 数据库 11） |
| 端到端测试 | ✅ 16/16 渲染 + 21/21 玩法，控制台零报错 |

---

## 它解决什么问题

孩子做作业、做家务靠催，做完也没什么正向反馈。这个 App 把「完成任务」变成一个
可视化的成长循环：

**领任务 → 按时完成 → 拿积分 → 种地养动物 → 看到农场变大 → 更愿意做任务**

关键设计是**时间被显式纳入结算**：不是"做完就给满分"，而是"什么时间做完，决定拿多少分"。
这让孩子自己学会管理节奏。

---

## 核心玩法

### 一、任务板块

#### 结算规则（App 的心脏）

| 情形 | 结果 |
| --- | --- |
| 在计划时间内完成 | **全额积分** |
| 超时但未超一倍 | **按超时比例线性衰减**（超出 50% → 拿一半） |
| 超过计划时间一倍 | **0 分** |
| 勾了「超期不扣分」 | 超时多久都**拿全额**（如「学会一项新本领」） |
| 勾了「严格限时」 | 只要超时**立刻 0 分**（种子任务里没留这一形态，可在「加任务」里自己勾） |
| 质量达到门槛 | 在基础分之上**额外加积分**（用时与质量是两个独立维度） |

衰减公式：`得分 = round(基础分 × (2 − 实际用时 ÷ 计划用时))`

只要还没到归零阈值，至少保留 1 分 —— 避免"差几秒就颗粒无收"挫伤积极性。

> 这些规则都有单元测试覆盖，见 `src/domain/settlement.test.ts`（41 个用例）。

#### 任务周期

- **单次** —— 只做这一次
- **每天** —— 每天自动生成（打开 App 时惰性补齐，漏几天补几天）
- **每周 / 每月 / 每年** —— 不预先展开成上百条空记录，而是把任务本身当作一个长待办，
  按「本周要做几次」拆成若干次提交，界面上显示为进度条

#### 签到任务

练字、阅读这类需要**养成习惯**的任务：每天签到一次，按周期内累计天数给阶梯奖励
（坚持 3 天 +30，坚持 5 天 +60 再送贴纸）。周期结束自动重置。

#### 家长审核（孩子端只管提交，分由家长给）

- **孩子端不自评质量。** 任务做完了只能提交（普通任务「我做完啦！」、长期任务「完成确认」），
  用时之外**不填任何分数**；提交后状态是「等爸爸妈妈看」，积分一分不发。
- 家长（密码解锁）在审核面板里给质量（😞 一般 / 🙂 不错 / 🤩 特别棒）并微调用时，
  点「确认奖励」才真正入账。达标质量给额外积分。
- 结算引擎是**同一套**（`domain/settlement.ts`）：家长只是「最后一公里」的确认人，
  不是另算一套规则。
- 孩子提交前看到的分数一律写「**大约**能拿到」—— 质量分还没定。
- 关掉「家长审核」开关才会回到孩子提交即结算的老行为。

#### 其他

- 连续完成有 🔥 连击奖励，每天递增、有上限
- **计时器暂时隐藏**（2026-09-21）：任务卡上不再有「▶️ 开始」的实时秒表，
  孩子直接填用时（`+/-` 步进器，或「按计划 / 两倍」快捷键）。
  开关在 `src/features/tasks/ui.tsx` 的 `TIMER_ENABLED`，改回 `true` 即恢复；
  **只关 UI 不动数据**，`startTimer` / `startedAt` / 超时扣分规则全部原样。
- 漏填或填错了可以事后「补做」
- 完成掉落道具（贴纸、奖章、宝石），进背包收藏

### 二、游戏板块（农场）

- **种地**：12 块地，前 4 块免费。8 种作物，生长周期从 3 分钟到 6 小时。
  草莓、玉米等可**反复收获**；南瓜、西瓜一次性。
- **养动物**：小鸡 / 小鸭 / 小羊 / 小猪 / 奶牛。先养大成年，之后按间隔持续产出
  鸡蛋、羊毛、牛奶、松露、羽毛。
- **离线生长**：作物和动物按真实时间推进，关掉 App 也在长。回来一次性结算产出。
- **交易**：产出物在市场上卖成**丰收币** —— 一张**独立账本，不能变回积分**
  （见 `docs/farm-economy-design.md` §2）。每个标的**每一轮**最多卖回
  「成本 × (1+r)」，卖满就停；种子随时能再买、地随时能再种。
- **收成有波动**：每次收获 / 收下产出都会掷一次骰子，可能丰收也可能遇到虫灾。
  作物和动物**共用同一套分布**，所以两边的期望浮盈在同一档（+44% ~ +48%）。
  动物**不会**因为灾害死掉，只是这一批少收点。
- **道具**：神奇肥料让作物立刻长一半。

### 三、数据

- 全量导出为 JSON（任务、实例、积分流水、背包、农场、设置）
- 从 JSON 恢复，换设备/换浏览器都能接着玩
- 家长设置：孩子昵称头像、积分规则开关、**自定义一天从几点开始**（孩子熬夜到 1 点
  做的作业仍算"昨天"）、家长密码锁

### 四、新手引导（首次启动）

分两段，一次走完：

1. **家长设置向导**：给宝贝起小名、选头像、设家长密码。密码输两遍（项目没有找回
   入口，输错一位就进不去家长区了），也可以「以后再说」，保持默认的 `0000`。
2. **功能导览（六步）**：整屏压暗、把当前那一个元素挖亮，一步一步跟着看。
   - **前四步给孩子**：底部四个 tab 各讲一句。
   - **后两步给家长**（2026-09-21 补）：顶栏的 👀「家长确认」和 ⚙️「设置」，
     气泡上打「给家长」小标。原因见下面那条 ⚠️。

   ⚠️ **农场那一步不是操作说明**，讲的是「花积分买种子是投入、收成是回报，
   什么时候卖决定了回报多少」—— 这是家长要的「投资 / 市场意识」的**引子**。
   完整的一课其实在别处：收获弹层的「当场卖 / 收进背包等好价」二选一，
   以及市场页的行情指数、涨跌箭头、7 日走势图和「货一多价就跌」的提示。
   ⚠️ 注意别写成「一次卖太多会砸盘、所以分批更划算」—— `sellQuote` 是线性的
   （现价 × 个数），那个差额恒为 0，2026-09-16 修过一次，见
   `docs/farm-economy-design.md` §6.4。
   但孩子走完导览若只知道「农场能种地」，那一课就没有引子 ——
   **别把这一步的文案改回纯操作说明。**

   ⚠️ **为什么必须有最后两步**：这个 App 的核心闭环是「孩子交上来 → 家长确认 →
   积分到账」，而家长确认的入口是顶栏那个 👀。原导览只走底部 tab，
   家长设完密码就卡住了 —— 孩子交了一堆任务，没人知道要去点那个眼睛。
   同理 ⚙️ 里的规则 / 兑换 / 数据也没人讲。**删掉这两步等于把闭环讲断。**

走完写一个 `onboardingDone` 标记，之后不再弹；设置 →「孩子」页里有「重看新手引导」。

⚠️ **重看模式下没有密码那一步。** 重看入口在不锁密码的页面里，而密码步骤会直接
覆盖 `parentPin` —— 留着它，孩子点一下「重看引导」就能把家长密码改成自己设的，
家长区从此形同虚设。（回归测试见 `src/features/onboarding/onboarding.test.tsx`。）

---

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 框架 | React 19 + TypeScript | strict 模式，`noUnusedLocals` / `erasableSyntaxOnly` 全开 |
| 构建 | Vite 8 | `base: './'`，兼容 APK 的 `file://` 与子目录部署 |
| 样式 | Tailwind CSS v4 | 设计令牌集中在 `src/styles/theme.css` |
| 状态 | Zustand 5 | 派生数据统一走 `useShallow` 包装的 hooks |
| 存储 | Dexie (IndexedDB) | 单机优先，无服务端 |
| 打包 | Capacitor 8 | 同一套代码产出 Web + APK |
| 测试 | Vitest + Puppeteer | 单元测试 + 真实浏览器端到端验证 |

**无图片资源** —— 所有插画、天空、草地、地块都用 CSS 渐变、圆角、阴影和 emoji 绘制。
音效由 WebAudio 实时合成，不依赖音频文件。这让包体积很小且完全离线可用。

`playTone` 有 4 种音色（`src/platform/files.ts`）：`success` / `fail` / `coin` / `entry`。

| 时机 | 音色 |
| --- | --- |
| 进入主页（一次） | `entry` —— 高音区、首音上滑的五音小动机，走可爱路线 |
| `success` 类提示（做完了、搞定） | `success` |
| `reward` 类提示（+N 分到手） | `coin` |
| `warn` 类提示（出错、被扣分） | `fail` |
| `info` 类提示（已下架 / 备份已导出） | **不出声也不震** |

**音效与震动统一挂在 store 的 `pushToast` 上**，不散到几十个调用点去加 ——
toast 是「发生了一件值得告诉孩子的事」的唯一收口（任务结算、签到、农场收获、
兑换、家长操作都会经过它），散着加必然漏，以后新增事件还会忘。
`hapticLight()`（轻震）走同一条路。两个开关在设置页「规则」里：
**音效** / **震动**（都默认开）。

> ⚠️ 入场音有个坑：浏览器自动播放策略下，没有用户手势时 `AudioContext` 会停在
> `suspended`，`resume()` **会「成功返回」但上下文仍然是哑的**。所以 `playTone`
> 遇到 `suspended` 时把音色**攒进队列**，挂一次 `pointerdown`/`keydown`（capture），
> 等第一个手势到达再补播；并且**必须确认 `ctx.state === 'running'` 才放音** ——
> 否则等于把音倒进一个哑掉的上下文，队列清空、耳朵里什么都没有（静默丢音）。
> 回归用例见 `src/platform/sound.test.ts`（7 条）与 `src/store/feedback.test.ts`（8 条）。
>
> 音效 / 震动只在**原生 App** 里可靠：Web 上震动被静默忽略，入场音还要等一次手势。

---

## 快速开始

```bash
npm install

npm run dev          # 开发服务器 http://localhost:5180
npm run build        # 生产构建 → dist/
npm run preview      # 预览生产构建 http://localhost:4180

npm test             # 跑单元测试（结算引擎等）
npm run lint         # 类型检查
```

### 手机上打开

开发服务器已开 `--host`，手机连同一个 WiFi，访问 `http://<电脑IP>:5180` 即可。

### 打包 APK

见 [`TOOLCHAIN.md`](./TOOLCHAIN.md) 准备 JDK 与 Android SDK，然后：

```bash
bash scripts/build-apk.sh          # debug 包，可直接安装
bash scripts/build-apk.sh release  # release 包，需先配置签名
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`（约 4.3 MB）

安装：`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

> 如果 `platforms/android-36` 只剩一个空壳（里面只有 `.installer/`），
> 说明上一次 SDK 下载被中断了。Gradle 会误以为平台已装好，然后在编译期报
> `Failed to install the following SDK components`。清掉这个空壳重装即可：
>
> ```bash
> export JAVA_HOME="C:/Program Files/Eclipse Adoptium/jdk-21.0.12.101-hotspot"
> SDK="C:/Users/<你>/AppData/Local/Android/Sdk"
> rm -rf "$SDK/platforms/android-36"
> "$SDK/cmdline-tools/latest/bin/sdkmanager.bat" --sdk_root="$SDK" "platforms;android-36"
> ```
>
> 注意 `sdkmanager` 必须用 JDK 17+ 运行，否则会报
> `UnsupportedClassVersionError`（系统默认的 JDK 8 跑不动它）。

### 应用图标

图标是**一张 AI 生成的插画**（小女孩 + 奶牛 + 小鸡 + 菜地 + 谷仓），
不是程序化画的。源图放在 `assets/icon/source.png`。

> 上一版是 `scripts/make-icons.py` 程序化画的「金底 + 任务卡 + 对勾 + 小苗」。
> **那个脚本已停用**（默认跑会直接拒绝执行），它会把插画图标覆盖回旧设计且不报错。
> 真要跑得加 `--force-old-design`。

处理链路是两步：

```bash
PY=C:/Users/admin/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe

# ① 抠掉暖白底 → 透明 PNG
"$PY" <skill>/make_transparent.py --src assets/icon/source.png --out-dir assets/icon

# ② 出全套 Android / Web 图标
"$PY" <skill>/generate_icons.py \
    --art assets/icon/icon-square.png \
    --res android/app/src/main/res \
    --public public \
    --preview assets/icon/icon-set-preview.png
```

> ⚠️ **抠背景不是「把接近白色的像素变透明」。** 那样会把插画**内部**所有白东西
> 一起打穿 —— 云、白衬衫、纸、小鸡。正确做法是**从画布边框向内做洪水填充**，
> 让插画自己的轮廓把内部的白挡住。
> 另外这张图的底不是纯白，实测是 `#FDFCFA`（暖白），得量出来而不是假设 255。
> 细节和三种失败模式见 skill 的 `references/pitfalls.md`。

产出：

| 输出 | 尺寸 | 用途 |
| --- | --- | --- |
| `mipmap-*/ic_launcher.png` / `_round.png` | 48dp | 传统图标（API < 26） |
| `mipmap-*/ic_launcher_foreground.png` | 108dp | 自适应图标前景 |
| `mipmap-*/ic_launcher_background.png` | 108dp | 自适应图标背景 |
| `public/favicon.png` / `apple-touch-icon.png` | 64 / 180px | 网页 |

关键规则：**自适应图标 108dp 画布里，插画只占 74dp**。
系统只保证露出中间 72dp，把插画铺满 108dp 会白白丢掉三分之一的构图。
背景层是同一张 74dp 合成图把透明区**向外做边缘延展**，这样万一某个启动器
露出的比 72dp 多，也不会看到透明边。

> ⚠️ 前景层和背景层**必须成对替换**，只换一层会出现「新插画 + 旧底色」的错位。

**为什么原生启动图不带这个图标：** 见下一节 —— 入场页本身没有 logo，
原生启动图先闪一个 logo 再消失，等于在交接处多造一次跳变。
`generate_icons.py` 顺手产出的 `splash_icon.webp` 因此**没有进 `res/`**，
放在 `assets/icon/splash-mark-unused.webp` 备用（想启用见下一节）。

> ⚠️ **favicon 在 16px 下基本是一团色块**（插画细节太多）。这是
> 「和 App 图标保持一致」换来的代价，是有意选的；浏览器标签页 32px 起才勉强认得出。
> 想要小尺寸清晰，得单独做一版简化图形。

### 启动画面（原生启动图 ↔ 入场页）

APK 冷启动时屏幕上的顺序是：

```
系统启动屏 / 窗口背景（原生，暖金）
   ↓ 淡出
入场页 SplashPage（React，暖金 + 插画 + 格言）
```

两边颜色必须对得上，否则交接那 200ms 会「闪一下」。取色不要手抄：

```bash
npm run splash:measure        # 需要先起 dev server（默认量 5180）
```

它会开真 Chrome，把入场动画停在 t=0、藏掉插画卡那一坨，只留背景两层截图，
然后逐行取横向平均，打印三个可以直接抄的值：

| 输出 | 抄到哪 |
| --- | --- |
| `startColor` / `centerColor` / `endColor` | `android/app/src/main/res/drawable/splash.xml` |
| 整幅平均色 | `values/colors.xml` 的 `splash_background`（Android 12+ 系统启动屏只认纯色） |

**抄完记得验一遍** —— 这四个值分散在四处，漏抄一处就会闪：

```bash
npm run splash:check          # 量 + 校验四处是否一致，不一致 exit 1
```

它检查 `splash.xml` 三站 / `colors.xml` / `capacitor.config.json`，
以及**打包产物 APK 内部**（防止「源码改了但忘了重新打包」）。

> ⚠️ 查 APK 时注意两个坑：
> ① 三个色站在**编译后的二进制 XML** `res/drawable/splash.xml` 里，
> 不在 `resources.arsc` —— 只查 arsc 会漏掉三站，看着像没重新打包；
> ② arsc/XML 里颜色是**小端 uint32 ARGB**，`#cd9840` 存成 `40 98 cd ff`
> （B G R A，**alpha 在最后**），不是 ASCII 的 `#cd9840`，直接搜字符串搜不到。

> ⚠️ **不要用「读 CSS 自己算」的办法。** 试过一版纯 Python 复刻 CSS 渐变，
> 多层背景 + 椭圆 radial + premultiplied alpha 插值全都要自己实现，
> 结果连渐变方向都算反了。唯一的真值是浏览器画出来的像素。

> ⚠️ 全 App **没有 ActionBar**（`values/styles.xml` 里三条主题全是 `NoActionBar`）。
> 原来是 `Theme.AppCompat.Light.DarkActionBar`，启动时会在启动图和入场页中间
> 多出一条写着应用名的标题栏；而且 `Theme.SplashScreen` 自带的
> `postSplashScreenTheme` 是 `?android:attr/theme`，会解析回那条带 ActionBar 的
> 应用主题 —— 所以启动主题里必须**显式**写 `postSplashScreenTheme`。

---

## 端到端验证

不只是跑单元测试 —— 用真实 Chrome 在手机视口下跑完整流程：

```bash
npm run preview &                        # 先起预览服务
node scripts/e2e-check.mjs               # 70 项：新手引导 / 渲染 / 导航 / 溢出 / 顶栏 / 长期任务孩子端 / 音效开关 / 币种只在一处显示 / 市场走势图 / 导出
node scripts/e2e-gameplay.mjs            # 49 项：结算规则 / 账本 / 农场 / 签到 / 收获二选一 / 备份往返（含背包与结转额度）/ 脏数据
node scripts/e2e-upgrade.mjs             # 12 项：老库升级路径（不丢数据、不炸索引）
node scripts/e2e-bag-sell.mjs            # 23 项：收进背包 → 市场卖出整条链（含丰收币到账、卖压、空背包空状态）
node scripts/e2e-regressions.mjs         # 20 项：**回归守卫** —— 已经修过的具体 bug 别再改回去
```

`e2e-gameplay.mjs` 会验证每一条结算规则在真实环境下的积分入账结果，
以及「任务 → 积分 → 农场消费」整条链路的账本一致性。

> ✅ **2026-09-19：三条红的守卫已修好，现在是绿的。**
> 它们钉的是同一个不变量「**单轮满产一个不剩**」，当时有两个独立破口：
> ① 周末 / 节假日的季节加成把产量顶过了 `满产`（额度按 4 个配，周末收 5 个）；
> ② 额度是**小数**、结算是**整枚**、货是**整颗**，三个单位混用 →
> `round(单价) > 单价`，一颗一颗卖会多扣额度，最后剩 1 个永远卖不掉。
> 用户 2026-09-19 定：**B1（整数化）+ 甲（产量封顶）**。两处都改了，
> 三条守卫由红转绿（`e2e-bag-sell 23/23`、`e2e-regressions 20/20`）。
> 病因、修法与代价见 `docs/farm-economy-design.md` §6.1.2 / §6.1.3。
>
> ⚠️ 那几条断言**不要改松**。它们是这个不变量的唯一守卫，
> 而且都做过**负向验证**（把 `min(满产, …)` 或 `capFor` 改回旧口径，立刻变红）。

`e2e-regressions.mjs` 和上面几套的分工：那几套验「功能对不对」（按页面组织、覆盖广），
它验「**这几个坑别再踩**」（按 bug 组织、覆盖窄，每条都带日期和病因）。
修完一个 bug 就往里加一条。里面有几条**必须在 CPU 降速下跑**（脚本自己设了 20×）——
满速桌面复现不出来，真机上必现，详见该文件头部注释。

### 文案一致性（按钮 emoji 位置）

```bash
node scripts/check-copy-emoji.mjs        # 退出码 0 = 干净；1 = 有尾随 emoji 的控件文案
```

按钮文案统一成「**emoji 在前**」（`✅ 我做完啦！`，不是 `我做完啦 ✅`）。
这个检查器用 **TypeScript 编译器 API** 解析 TSX，而不是正则 ——
逐行正则会漏掉跨行的 JSX 文本节点，只看 `JsxText` 会漏掉 `{}` 里的字符串字面量，
**本机 git-bash 的 `grep` 还匹配不了非 BMP 的 emoji**（U+1F3E1 这类会静默返回空）。
三种判据都会让结果**静默变假**，所以这里一律用 node 当裁判。

⚠️ 只管**可交互控件**。`<p>` 里的散文不管 ——
「这次先跳过了，明天见 👋」这种句子尾随 emoji 是正常中文写法。

断言截图会输出到 `screenshots/`（会被覆盖）。

### 界面走查图集（只出图，不断言）

```bash
node scripts/capture.mjs                 # → screenshots/redesign/，21 张
```

`capture.mjs` 只负责「好不好看」，和 `e2e-*.mjs` 的「对不对」分工不同，互不覆盖。

⚠️ **新加的界面必须加进 `capture.mjs`**，否则走查图里根本看不到它 ——
打开 `screenshots/redesign/` 却看不出改过什么，等于没走查过。
（2026-09-15 踩过：加了三处新界面，但图集里 8 张有 6 张和改版前**逐字节相同**。）

⚠️ **`capture.mjs` / `e2e-gameplay.mjs` 都跑在全新的 Chrome profile 上**，
所以一定会撞上新手引导，而它**盖住整个主界面**。这两个脚本用的是 DOM 的
`.click()`，它**绕过命中测试** —— 被盖住照样点得到，于是脚本继续全绿、
界面其实根本不能用。要测主界面的脚本一律先调
`scripts/lib/onboarding.mjs` 的 `dismissOnboarding(page)` 把引导走完。

⚠️ **e2e 的 Chrome profile 一律走 `scripts/lib/profile.mjs` 的 `makeProfileDir()`**，
它把 profile 放在**项目同盘的 `.e2e-scratch/`**（已 gitignore），**不要用 `os.tmpdir()`**。
2026-09-19 真踩过：系统盘写满 → Chrome 的 IndexedDB 抛
`FILE_ERROR_NO_SPACE` / `DatabaseClosedError` / `BulkError`，
症状是 e2e **随机**挂在任意一条用例上（同一套件两次跑挂在两个不同位置，
其中一次干脆在 `boot()` 就炸），看起来完全像「应用有并发 bug」。
把 profile 挪到还有空间的盘之后，同一个构建立刻全绿。

---

## 项目结构

```
src/
  domain/           纯业务逻辑（无 React、无 IO，全可单测）
    types.ts          领域模型
    settlement.ts     结算引擎 ← 核心
    recurrence.ts     周期任务生成 / 签到阶梯 / 连击
    farm.ts           作物与动物的时间推进
    catalog.ts        作物 / 动物 / 道具内容表
    seedTasks.ts      首次启动的示例任务
    avatars.ts        可选头像（设置页与引导向导共用，防两边漂移）
    time.ts           逻辑日、周期键、时长格式化
  db/db.ts          Dexie schema 与原子写操作
  store/useApp.ts   全局状态与所有业务动作
  features/
    tasks/          任务板块
    farm/           农场板块
    settings/       家长设置 / 数据导入导出
    onboarding/     新手引导（家长设置向导 + 功能导览：4 步给孩子 + 2 步给家长）
    parent/         家长确认与打分
  platform/files.ts 浏览器与 APK 的文件导出适配 / 合成音效
  components/       Portal（弹层挂 body）、ErrorBoundary 等通用组件
  styles/theme.css  设计令牌（颜色 / 圆角 / 阴影 / 动画）
```

**分层原则**：`domain/` 不依赖任何框架或 IO，业务规则集中在这里并被测试覆盖；
`store/` 是唯一允许写数据库的地方；组件只读 store、只调 store 的 action。

---

## 设计说明

- **低龄友好**：大按钮（最小 44px，主操作 56px+）、emoji 优先于文字、
  每个操作都有即时反馈（缩放 / 弹跳 / 飘分 / 音效 / 震动）
  —— 音效与震动挂在 toast 上，设置页可关（见上方「无图片资源」那段）
- **同一个数只在一处显示**：积分 / 丰收币由全局顶栏（`App.tsx` 里那个 `sticky top-0`
  的 header）统一承担，**页面正文里不再重复摆一遍** —— 农场卡、兑换页页头、
  积分页页头曾经各放了一份（还有兑换页正文那句「🪙 你有 N 分。」），
  同一屏里同一个数出现两次，孩子反而不知道该看哪个，已全部删掉
  （`e2e-check` §5 / §8 有断言守着）。
  正文里的币种只出现在**有上下文的动作旁边**：种子价、地块解锁价、卖出所得、
  收获额度、兑换品单价 —— 这些是**单价**，不是余额，必须留着。
  写断言时注意：判据要锚在「不带 `aria-hidden` 的 🪙 图标」上，
  不能按字形数（会把价签算进来），也不能拿余额数字裸比
  （全新档案里"今天赚到的分"必然等于余额，7 日柱状图一定误报）。
- **不惩罚**：0 分时给鼓励文案而非责备；未到阈值至少 1 分；
  出错时 ErrorBoundary 兜底提示"数据都还在"
- **卡通质感**：粗描边、大圆角、实体按钮下沉手感、暖色纸感背景
- **入场页比主界面暗一档，并且会「天亮」**：主界面是干净白纸（实测平均亮度
  任务 239 / 兑换 243 / 积分 244），入场页要是也白，切进去就**没有换场景**的感觉。
  所以入场页走暖金，并做了日出 —— 太阳**从山后升起来**（它的 `<g>` 画在山丘 path
  **之前**，由山真实遮挡，不是淡入），同时一层暖色暗罩淡出：
  首帧 **173.2** → 末帧 **209.2**（比主界面仍暗 30，即「先暗 66、最后暗 30」）。
  动画 1.5s，必须**短于** `SPLASH_MIN_MS = 1900`（在 `App.tsx`），且用 ease-in-out
  而不是 ease-out，否则「还暗着」的那一帧根本看不见。
  ⚠️ **只做「变亮」，别顺手换色相。** 试过一版在 1.5s 里让整页从紫罗兰走到金、
  连插画的山丘一起换色 —— 四样东西同时变、色相甩了 200 多度，读起来是「闪了一下」
  而不是「天亮了」（反馈原话：「变化的太突兀了，还不如之前」）。
  现在全程 H38~43° 的同一个暖色家族，**只动明度 / 饱和**；插画不参与变色。
  那个 **+36** 的亮度差也是刻意压住的：改之前 +43、那版 +67，差值越大越像闪一下。
  ⚠️ **「脏」的判据**：低饱和只在明度极端时才干净（V>92% 是奶油色、V<30% 是干净的
  深色）；**中明度 + 低饱和 + 黄绿（V 60~88% + S<35% + H 45~110°）= 泥（卡其）**。
  改之前背景渐变下面两站是 `#e4ddab`(S25) / `#cfe0ba`(S17)，叠上暗罩实测
  H65 S21 V71 —— 正是「脏」的来源；现在整帧 10 条分带 **0 条**落进泥色区间。
  ⚠️ 改这里的颜色要同步四处，别手抄 —— 跑 `npm run splash:check` 逐个核对
  （`capacitor.config.json` 的 `backgroundColor` 与 `res/values/colors.xml` 的
  `splash_background` 都是 **首帧整幅的平均色**，现为 `#cfa356`；渐变的三个色站
  另写在 `res/drawable/splash.xml`）。对不上 Android 上原生启动图与网页首帧
  就会闪一下。详见上面「启动画面（原生启动图 ↔ 入场页）」。
  （`capture.mjs` 会拍两张：`01a-splash-dawn` / `01-splash`，并断言当时暗罩的 opacity。）
- **减少动画偏好**：全局支持 `prefers-reduced-motion`
- **安全区适配**：`env(safe-area-inset-*)`，刘海屏与手势条不遮挡内容
