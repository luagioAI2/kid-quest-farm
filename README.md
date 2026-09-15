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
- 忘记计时可以手动补填用时，或事后「补做」
- 完成掉落道具（贴纸、奖章、宝石），进背包收藏

### 二、游戏板块（农场）

- **种地**：12 块地，前 4 块免费。8 种作物，生长周期从 3 分钟到 6 小时。
  草莓、玉米等可**反复收获**；南瓜、西瓜一次性。
- **养动物**：小鸡 / 小鸭 / 小羊 / 小猪 / 奶牛。先养大成年，之后按间隔持续产出
  鸡蛋、羊毛、牛奶、松露、羽毛。
- **离线生长**：作物和动物按真实时间推进，关掉 App 也在长。回来一次性结算产出。
- **交易**：产出物可卖成积分，形成经济循环。
- **道具**：神奇肥料让作物立刻长一半。

### 三、数据

- 全量导出为 JSON（任务、实例、积分流水、背包、农场、设置）
- 从 JSON 恢复，换设备/换浏览器都能接着玩
- 家长设置：孩子昵称头像、积分规则开关、**自定义一天从几点开始**（孩子熬夜到 1 点
  做的作业仍算"昨天"）、家长密码锁

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

`scripts/make-icons.py` 用纯 Python 生成全套启动图标（自适应前景/背景层 +
5 种密度的传统 PNG），不依赖 Pillow：

```bash
python scripts/make-icons.py
```

改配色就改脚本顶部的 `SKY_TOP` / `GRASS_MID` / `SUN` 等常量，重跑即可。

---

## 端到端验证

不只是跑单元测试 —— 用真实 Chrome 在手机视口下跑完整流程：

```bash
npm run preview &                        # 先起预览服务
node scripts/e2e-check.mjs               # 45 项：渲染 / 导航 / 溢出 / 顶栏 / 长期任务孩子端 / 音效开关 / 币种只在一处显示 / 导出
node scripts/e2e-gameplay.mjs            # 46 项：结算规则 / 账本 / 农场 / 签到 / 收获二选一 / 脏数据
node scripts/e2e-upgrade.mjs             # 12 项：老库升级路径（不丢数据、不炸索引）
```

`e2e-gameplay.mjs` 会验证每一条结算规则在真实环境下的积分入账结果，
以及「任务 → 积分 → 农场消费」整条链路的账本一致性。

断言截图会输出到 `screenshots/`（会被覆盖）。

### 界面走查图集（只出图，不断言）

```bash
node scripts/capture.mjs                 # → screenshots/redesign/，14 张
```

`capture.mjs` 只负责「好不好看」，和 `e2e-*.mjs` 的「对不对」分工不同，互不覆盖。

⚠️ **新加的界面必须加进 `capture.mjs`**，否则走查图里根本看不到它 ——
打开 `screenshots/redesign/` 却看不出改过什么，等于没走查过。
（2026-09-15 踩过：加了三处新界面，但图集里 8 张有 6 张和改版前**逐字节相同**。）

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
    time.ts           逻辑日、周期键、时长格式化
  db/db.ts          Dexie schema 与原子写操作
  store/useApp.ts   全局状态与所有业务动作
  features/
    tasks/          任务板块
    farm/           农场板块
    settings/       家长设置 / 数据导入导出
  platform/files.ts 浏览器与 APK 的文件导出适配
  components/       ErrorBoundary 等通用组件
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
- **减少动画偏好**：全局支持 `prefers-reduced-motion`
- **安全区适配**：`env(safe-area-inset-*)`，刘海屏与手势条不遮挡内容
