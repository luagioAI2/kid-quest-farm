# 小任务农场 · 游戏插件规范 v1

> **这份文档的读者是「另一个模型 / 另一个开发者」。**
> 目标是：按这份规范**独立做一个新游戏**（娃娃机、钓鱼、扭蛋……），
> 然后不改宿主代码就能接进现有 App；并且做出来的东西在**经济、UI、测试、美术**四个方面
> 和现有的「农场」插件是同一个物种。
>
> 文中所有路径、类型名、表名、公式**都来自现有代码**，不是设想。
> 标注 `【提案】` 的部分是本文档新提出、仓库里还没实现的。

---

## 0. 怎么用这份文档（给接手模型的指令）

如果你是被丢过来做新游戏的模型，请按这个顺序读：

1. **§2 货币体系** —— 这是唯一的跨模块接口，读不懂它就不要写代码。
2. **§5 经济契约** —— 数值不变量。违反了会被现有测试挡下来。
3. **§8 农场参考实现** —— 照抄它的结构，不要重新发明。
4. **§9 你的新游戏骨架** —— 把你的游戏套进去。
5. **§3 / §4 / §6 / §7** —— 契约细节，写代码时对照。

**硬性要求（不满足就不算接得上）**：

| 要求 | 为什么 |
| --- | --- |
| 只用宿主给的两个接口碰钱：`spendPoints()` / `mintGameCoin()` | 见 §2.2 的两条不可逆约束 |
| 自己的表带游戏前缀（`claw.*`），不碰别人的表 | 见 §4.3 |
| 不引用农场的任何模块（`features/farm/*`、`domain/catalog.ts`） | 两个插件之间必须零耦合 |
| 不引入新的运行时依赖（不许加 Pixi / three / 动画库） | 见 §6.2 的实测体积账 |
| 提供 `data-*` 锚点，不用下标定位 DOM | 见 §7.2 |
| 经济参数必须写进 manifest，可被家长看到 | 见 §4.4 |

---

## 1. 一句话架构

```
                    ┌─────────────────────────────────────────┐
   任务（做家务/学习） │              宿 主  Host                │
        │            │  积分账本 ledger（唯一入口）              │
        ▼            │  兑换商城 redeemItems / redeemRecords    │
   ┌─────────┐       │  家长闸门 ParentGate                     │
   │  积分 🪙  │───┐   │  存档 db.ts（Dexie / IndexedDB）          │
   └─────────┘   │   │  UI 外壳 App.tsx（tab / page-col / Portal）│
                 │   └─────────────────────────────────────────┘
      花积分买游戏资源 │            ▲                    ▲
                 ├───┴──► 农场插件 ─┘                    │
                 │         └── 丰收币 🌾（自己的账本）─────┤
                 └──────► 娃娃机插件 ─┐                   │
                           └── 游戏币 🎟️（自己的账本）────┤
                                                       │
                                        兑换商城（先花游戏币，再补积分）
```

**一句话**：积分是**唯一的入水口**，每个游戏有自己的**出水口**（自己的币），
出水口**只通向兑换商城**，永不回流。游戏之间互不相识，只认识宿主。

---

## 2. 货币体系（唯一的跨模块接口）

### 2.1 三个角色

| 角色 | 符号 | 谁产生 | 谁消耗 | 现有实现 |
| --- | --- | --- | --- | --- |
| **积分** | 🪙 | 任务结算（`settleNow` → `postLedger`） | **所有游戏**的投入 + 兑换 | `ledger` 表，`state.balance` |
| **游戏币** | 各游戏自定 | 该游戏内部的产出循环 | **只能**在兑换商城花 | 农场 = `harvestLedger` 表，`state.harvestBalance` |
| **兑换品** | — | 家长在「兑换商城」里配 | 孩子兑换，家长兑现 | `redeemItems` / `redeemRecords` |

**余额不是存出来的，是算出来的。** 这是本项目的一个关键选择：

```ts
// src/db/db.ts
export async function ledgerTip() {
  const rows = await db.ledger.toArray()
  return { balance: rows.reduce((sum, r) => sum + r.delta, 0) }   // 派生，不是计数器
}
```

好处：**不可能出现「余额和流水对不上」**。坏处：每次都要扫表（数据量小，无所谓）。
你的游戏币必须照这个模式做，**不要存一个 `balance` 字段**。

### 2.2 两条不可逆约束（整个经济系统的地基）

> 1. **游戏币 ⇸ 积分** —— 游戏币永远不能换回积分。
> 2. **游戏币 ⇸ 游戏投入** —— 游戏币不能买该游戏的种子 / 道具 / 地块。

这两条来自 `src/domain/types.ts` 里 `HarvestEntry` 的注释，原文照抄：

> 只堵第 1 条不够。只要农场产出能变回积分、积分又能买种子，就是闭环印钞机：
>
> ```
> 10 → 16 → 26 → 41 → 66 → 105 → 168 → 269 …（每轮 2 分钟，1 小时 30 轮 ≈ 1300 万）
> ```

所以：
- `plant` / `buyAnimal` / `unlockPlot` 这些**只读 `state.balance`**（积分）。
- 绝不允许出现 `balance + harvestBalance` 这种写法。
- 你的游戏同理：**投入只扣积分，产出只发自己的币。**

### 2.3 为什么用「独立账本表」而不是「一张表加 currency 字段」

**因为要把约束做成结构性的，而不是约定性的。**

同一张表加 `currency` 字段的话，`currentBalance()` 只要漏一个
`.filter(r => r.currency === 'points')`，游戏币就悄悄算进积分余额 —— **而且不报任何错**。
分成两张表之后，`currentBalance()` 只读 `db.ledger`，它**在物理上不可能**看到丰收币。

**你的游戏必须自己开一张表**，不要往 `ledger` / `harvestLedger` 里塞。

### 2.4 兑换时的付款规则（先花游戏币，再补积分）

```ts
// src/domain/redeem.ts —— 纯函数，UI 预览和真正扣款用同一份
planRedeemPayment(cost, harvestBalance, pointsBalance)
//   harvestPaid = min(harvestBalance, cost)     ← 先花游戏币
//   pointsPaid  = cost - harvestPaid            ← 不够的部分用积分补
//   affordable  = harvestBalance + pointsBalance >= cost
```

**【提案】多游戏之后要改的地方**：现在 `RedeemItem.cost` 只有一种币，
`planRedeemPayment` 只认 `harvestBalance`。多游戏之后应当是：

```ts
// 【提案】RedeemItem 增加可选字段，缺省 = 'farm'（向后兼容，老数据不用迁移）
coin?: 'farm' | 'claw' | ...     // 这件兑换品吃哪个游戏的币

// 【提案】planRedeemPayment 改成按币种分发
planRedeemPayment(cost, coinBalances: Record<CoinId, number>, pointsBalance)
```

⚠️ **改这里必须同时写数据迁移**：`RedeemRecord.harvestPaid` 这个名字绑死在农场上，
新记录建议写 `coinPaid: { [coinId]: number }`，读的时候用 `paidOf()` 兼容老记录
（老记录 `harvestPaid` 缺省 **0**、`pointsPaid` 缺省 **cost − harvestPaid**，
两个字段的缺省方向**是相反的**，别记反）。

---

## 3. 宿主契约：插件能调用什么

### 3.1 存档 / 表 / 迁移

- 数据库：Dexie / IndexedDB，库名 `kid-quest-farm`（`src/db/db.ts`），**当前 version 5**。
- 现有表：`tasks` `taskInstances` `ledger` `harvestLedger` `inventory` `animals`
  `checkIns` `checkInProgress` `redeemItems` `redeemRecords` `farmEvents` `meta`。
- 有些东西存在 `meta` 里而不是独立表：`farm.plots`、`farm.market`、`settings`、
  农场累计统计。**你的游戏状态也可以放 `meta`**（键名带游戏前缀），
  但如果要按字段查询 / 需要复合索引，就开表。

**迁移纪律**（照抄 `db.ts` 的写法，每一版都写清楚为什么）：

```ts
this.version(6).stores({ 'claw.prizes': 'id, rarity, createdAt' })
```

⚠️ **加表 / 改索引必须新增一个 `version(n+1)`，不许改老的 version 块** ——
改老的会让已经装了 App 的设备（IndexedDB 里已经是 v5）**读不到新结构且不报错**。

### 3.2 扣积分（唯一的「花钱」入口）

```ts
// src/db/db.ts
postLedger({ delta: -cost, source, refId, memo })
```

- `delta` 为负 = 花钱；正 = 进账。
- `balanceAfter` 由 `postLedger` 自己算（读 tip + delta），**不要自己传**。
- ⚠️ `ledger.createdAt` 是**非唯一索引**，别拿「最后一条的 balanceAfter」当余额 ——
  同毫秒会乱序。一律走 `ledgerTip()`。

### 3.3 铸造游戏币

```ts
// 农场用 harvestLedger；你的游戏用你自己的表
postHarvest({ delta: +gain, source, refId, memo })
```

- **只在「产出被兑现」的那一刻铸造**，不要在「产出被获得」时铸造。
  农场是这样做的：收获只把产出物放进背包（`inventory`），
  **卖出**（市场 / 当场卖）才 `postHarvest`。这样「等好价再卖」才有意义。
- 铸造必须过**通胀闸门**，见 §5.3。

### 3.4 家长闸门

```tsx
// src/features/parent/ParentGate.tsx
const needsPin = !!settings.parentPin && settings.protectParentActions !== false
```

- 默认密码 `0000`（`src/db/db.ts` 的 `DEFAULT_SETTINGS`）。
- 凡是**会永久改变孩子的钱 / 内容**的操作都要过闸门：
  兑换、家长审核、编辑任务、改兑换品、**你的游戏里的「重置存档 / 改赔率」也要**。
- 孩子端**不许**出现任何能改经济参数或自评质量的入口
  （这条有 e2e 守着，见 §7.2）。

### 3.5 UI 容器

宿主提供（照用，别自己写一套）：

| 能力 | 现有实现 | 位置 |
| --- | --- | --- |
| 页面外壳 / 宽度 | `.page-col`（430 / 672 / 896 / 1024） | `src/styles/theme.css` |
| 底部 tab | `App.tsx` 的 `TABS` + `nav` | `src/App.tsx` |
| 底部弹层（手机）/ 居中对话框（≥768） | `BottomSheet` | `src/features/farm/farmUi.tsx` |
| 弹层必须 Portal 到 body | `Portal` | `src/components/Portal.tsx` |
| toast | `pushToast({ kind, title, emoji })` | store |
| 结算飘字 | `settleFlash` + `anim-coin-rise` | `FarmPage.tsx` |
| 进度条 / 药丸 | `GrowthBar` / `CoinPill` | `farmUi.tsx` |

⚠️ **弹层一定要 Portal**：页面外壳的 `anim-fade-in` 是层叠上下文，
弹层留在里面**压不过底部导航**（踩过）。
⚠️ **遮罩必须 `fixed inset-0`**，不是 `absolute`。

### 3.6 调试句柄

```ts
window.__kqf__ = { getState, addPoints, unlockAll, syncSeedTasks, exportBackup, importBackup, catalog }
```

- 给 e2e / 走查脚本用，**不是给孩子用的**。
- ⚠️ `unlockAll()` 的**最后一步是 `window.location.reload()`** ——
  任何脚本 `await` 它都会撞上 `Execution context was destroyed`。
  正确姿势：发出去不管，然后等 `performance.timeOrigin` 变了（见
  `.e2e-scratch/shot-farm2d.mjs` 的写法）。
- 你的游戏如果也需要「一键给资源」的调试口，**照这个形状加**，
  并且**结尾也 reload**（保证所有组件读到新状态）。

---

## 4. 插件契约：你必须实现什么

### 4.1 manifest（清单）

**【提案】新增 `src/games/<gameId>/manifest.ts`**，形状建议：

```ts
export const CLAW_MANIFEST = {
  id: 'claw',                      // 唯一 id，也是表前缀、meta 键前缀
  name: '娃娃机',
  emoji: '🕹️',
  tabLabel: '娃娃机',               // 底部导航文字（≤3 字，多了会挤）
  /** 本游戏的币 */
  coin: { id: 'claw', name: '游戏币', emoji: '🎟️' },
  /** 经济参数 —— 家长要能看见 */
  economy: {
    /** 一次投入多少积分 */
    playCost: 10,
    /** 期望产出（币）—— 必须 < playCost，见 §5.4 */
    expectedPayout: 6,
    /** 通胀闸门：单件奖品最多能卖出多少币 */
    capPerPrize: 18,
  },
  /** 默认是否在导航里显示 */
  defaultEnabled: true,
}
```

### 4.2 生命周期

```ts
interface GamePlugin {
  manifest: GameManifest
  /** 首次安装：建种子数据（幂等，可重复调用） */
  seed(): Promise<void>
  /** 每次 boot：补种子、跑迁移、清理过期数据（幂等） */
  reconcile(now: number): Promise<void>
  /** 每日切点钩子（逻辑日，见 §5.5），可为空 */
  onDayRollover?(todayKey: string): Promise<void>
  /** 渲染入口 */
  Page: React.ComponentType
}
```

⚠️ `seed()` / `reconcile()` **必须幂等**。现有代码的写法是「按名字只增」
（`backfillMissingTasks` / `backfillMissingRedeemItems`）——
老设备不会补、也不会改价，见 §10 的坑。

### 4.3 数据命名空间

- 表名 / meta 键一律带 `<gameId>.` 前缀：`claw.prizes`、`claw.plays`、`meta['claw.state']`。
- **不许读写别的插件的表**。宿主表（`ledger` / `settings` / `tasks`）只读 + 走 §3.2/§3.3 的入口写。
- 你的状态**必须能从零重建**（`exportBackup` / `importBackup` 要能带走它）。

### 4.4 必须声明的经济参数

放进 manifest，并且**在 UI 里对家长可见**（农场是把「成本 / 上限回收 / 每分钟收益」
写在种子商店和地块上的）。孩子看到的则是「要花多少、能得到什么」。

### 4.5 必须提供的测试钩子

每个可交互元素加 `data-*` 锚点（见 §7.2）。**不要依赖 CSS 类名或 DOM 顺序。**

---

## 5. 经济契约（数值不变量）

### 5.1 通用不变量

| 不变量 | 判据 | 农场怎么验的 |
| --- | --- | --- |
| 钱是整数 | 账本里所有 delta 都是整数 | `postLedger` 内部 `Math.round` |
| 价是整数 | 单价、成本都是整数 | `PRODUCE_UNIT` 表 |
| 余额 = 流水和 | `ledgerTip().balance === Σdelta` | `economy.test.ts` |
| 不出现负余额 | 扣款前先 `remainingCap` / 余额夹取 | `planRedeemPayment` 的 `affordable` |
| 每分钟收益单调递增 | 见 §5.2 第 3 条 | `economy.test.ts` 的手写期望表 |

### 5.2 农场踩出来的三条（照抄）

**① 产出必须封顶（`满产` 上限）**

```ts
// src/store/useApp.ts  harvest()
const rolled = Math.round(perHarvest * multiplier)   // 事件倍率
const got = Math.min(perHarvest, rolled)             // ← 上限在这里
```

⚠️ **副作用**：这条让「增产 / 赐福丰收」类加成**变成空操作**。
实测：中性档 0.92 与丰收档 1.1~1.2，在单次产量 4 时**都只出 4 件**。

➜ **你的游戏设计任何「加成」之前先想这条**：唯一有效的正向杠杆是
**把坏结果挡掉**（农场就是这么做的 —— 动物的特殊效果只挡「虫灾 / 病害 / 恶劣天气」，
不增加产量）。**别做「有概率多给币」的效果**，那是死的。

**② 整数化**：收获积分曾经是 `3.6` 这种连续小数，界面上写 `≈`；
整数化之后 `≈` 就变成谎话，被删掉了。**你的产出也必须是整数。**

**③ 每分钟收益严格递增**：同一 `kind` 内，等级 N 的最低每分钟收益
**必须 > 等级 N−1 的最高每分钟收益**。否则高等级作物是纯亏，家长会发现。
判据（`src/domain/economy.test.ts`）：

```
rate = (expectedRecovery - seedCost) / totalMinutes
min(rate@N) > max(rate@N-1)
```

### 5.3 通胀闸门（`上限回收`）

**这是本项目最重要的防通胀设计，你必须实现等价物。**

```ts
// src/domain/economy.ts
capFor(itemId, r) = 上限回收 = 单件成本 × (1 + r)      // r 默认 0.6
remainingCapFor(itemId, plots, animals, r, carry)      // 当前还能卖多少
```

- 闸门挂在**活着的标的**上（地块 / 动物），不是挂在「物品」上。
- 所以有 `leftoverCapFor`：**一次性标的收完就没了**，剩下的额度必须**结转**
  （`state.quotaCarry`），否则「收进背包」的产出**永远卖不出去**，
  而 UI 上还明写着「等价格好的时候自己卖」——
  这个 bug 是**第 4 层界面走查**发现的（`2026-09-15`）。
- 结转**不违反**「每轮上限」：一轮最多带出 `成本 × (1+r)`，攒 N 轮就最多 N 倍 ——
  那正是 N 轮该有的量（每轮都真花了钱）。

**娃娃机怎么套**：一次投入 10 分，奖品最多能卖出 `10 × 1.6 = 16` 币。
抓 10 次最多带出 160 币 —— 和农场同构。

### 5.4 定价公式

```
成本（积分） = 上限回收 ÷ (1 + r)
上限回收（币） = 成本 × (1 + r)
```

- `r` = `settings.profitRatio`，默认 **0.6**，家长可调（「设置 → 规则」）。
- **`r` 是唯一的全局旋钮**，你的游戏必须读它，不要自己写死 1.6。
- 硬顶：`priceCeilingFor(itemId, r)`。

### 5.5 日切点是「逻辑日」，不是日历日

```ts
todayKey = currentDayKey(settings.dayStartHour)   // dayStartHour 默认 4
```

⚠️ **凡是拿时间戳去和 `todayKey` 比的地方，必须用
`appDayKey(ts, settings.dayStartHour)`，不能用 `toDateKey(ts)`。**
两者在 **00:00–04:00** 差一天 —— 这个窗口里 `redeemedToday` 恒为 0
（每日限购静默失效）、连击把凌晨完成算成「明天」。

⚠️ 这类 bug **白天跑测试永远绿**，只有凌晨才红。
见到「只在某个时间段红」的用例，先怀疑逻辑日 / 日历日。

---

## 6. UI / 美术契约

### 6.1 页面外壳

- 宽度**只有一个来源**：`.page-col`（430 / 672（≥768）/ 896（≥1024）/ 1024（≥1280））。
  **页面里不要再写 `max-w-[...]`。**
- 外壳（顶栏 / 底栏）通栏，内容收进 `page-col`。
- 栅格**加列不加格子**：`grid-cols-3 md:grid-cols-4 xl:grid-cols-6`。
- 触控目标 **≥ 44×44**。
- 弹层 ≥768px 是**居中对话框**，遮罩 `fixed inset-0`。

### 6.2 美术口径：不用 emoji，不上游戏引擎

**① 不用 emoji 画图案。** emoji 的粗细、配色、基线由系统 emoji 字体决定，
**永远调不了** —— 这是「看着不细腻」的主因。官网那轮已经因为这个吃过一次亏。

> 注意区分：**emoji 当「操作图标」可以用**（🌱 种子按钮、🔒 锁、➕ 空位），
> 因为那本来就是符号；**当「游戏画面」不行**（作物、动物、奖品）。

**② 不上游戏引擎（Pixi / three / Cocos）。** 实测（esbuild `--bundle --minify` + gzip）：

| 打包内容 | raw | gzip |
| --- | --- | --- |
| **现有整个 App**（4 个 tab + 农场 + 市场 + 积分 + 全部逻辑） | 594,769 | **176,456** |
| Pixi 最小用法（Application + Sprite + Assets） | 589,003 | **172,947** |
| Pixi 农场级用法（+ Text / Graphics / 滤镜） | 622,280 | **183,632** |

一个**最小**的 Pixi 包，几乎等于**整个 App 现在的大小**。
它换来的能力（上千精灵、着色器、粒子）在「12 块地 + 8 只动物」这个量级上**一点用不到**。

**③ 图案用内联 SVG，形状用 `<symbol>` + `<use>`。** 好处：
- 零外部请求（本项目官网口径是「零外部请求」，App 也保持离线优先）。
- 改颜色 / 粗细就是改一个属性，**可以调到像素级**。
- 跟着 CSS 变量走，天然支持暗色 / 主题。
- **可测**：还是普通 DOM，`querySelector` 能拿到，e2e 不用改（见 §7.2）。

**④ 真正的成本是美术，不是引擎。** 15 种作物 × 4 阶段 = 60 张图 + 8 动物 + 12 地皮
≈ **90~100 个素材**。这部分无论用 DOM 还是 Pixi 都要做。
所以**先把钱和时间花在素材上**，表现层用最省事、最可测、最不容易翻车的方案。

### 6.3 精灵规范（农场已经建立的约定，照抄）

```
viewBox="0 0 80 80"        // 所有 symbol 统一
地面线 y = 78              // 所有植物从 y=78 往上长
禁止越过 y=80              // 越了就被 overflow:hidden 裁掉
```

⚠️ **这条是血泪**：第一版胡萝卜的根画到 `y=87`，屏幕上就是「根被切了一半」。
**画之前先算清楚最下沿。**

摆位由 CSS 负责，**symbol 里不写绝对像素**：

```css
/* src/features/farm/farm.css */
.kqf-plot__art {
  position: absolute; left: 4%; right: 4%; bottom: 37%; height: 62%;
  pointer-events: none;    /* ← 命中测试必须落在 button 上，见 §7.2 */
}
```

**阶段 / 状态机**（农场作物是 4 帧，你的奖品同理）：

| 帧 | 含义 | 共用策略 |
| --- | --- | --- |
| 0 | 种子 / 幼芽 | **所有种类共用**（现实里幼苗都是绿的） |
| 1 | 苗 | 所有种类共用 |
| 2 | 成株 | **按「形态」共用**（7 种形态） |
| 3 | 成熟 | **按种类各画一帧**（15 种，只有果实颜色不同） |

➜ 15 种作物只用了 **2 + 7 + 15 = 24 个 symbol**，而不是 60 个。
**你的游戏也这么做**：能共用的帧一律共用，只让「最后一眼的差别」分开画。

### 6.4 动效

- 全部用 CSS `@keyframes`，不写 JS 动画循环。
- **必须带 `prefers-reduced-motion` 降级**：
  ```css
  @media (prefers-reduced-motion: reduce) {
    .kqf-plot__art, .kqf-plot--mature::after { animation: none !important; }
  }
  ```
- 复用现有的：`anim-sway`（摇摆，自带 `transform-origin: 50% 100%`）、
  `anim-float`、`anim-pop`、`anim-sparkle`、`anim-coin-rise`、`anim-sheet-up`、`anim-fade-in`。
  **别在游戏里再定义一份同名的。**

### 6.5 体积预算

- 现在的整包：**604 KB raw / 181 KB gzip**（加了农场 SVG 精灵层之后，+10 KB raw / +4.4 KB gzip）。
- **一个新游戏插件的增量应控制在 +15 KB gzip 以内**（纯 SVG + 逻辑，不含位图）。
- 如果某个素材必须用位图（比如照片级奖品图），走 `site/app/` 那套资源链路，
  并且**必须 `loading="lazy"` + 明确尺寸**（避免布局抖动）。

---

## 7. 测试与验收契约

### 7.1 四层验收（缺一层就等于没验）

| 层 | 命令 | 能发现 | 盲区 |
| --- | --- | --- | --- |
| 1 类型 | `npm run lint`（`tsc -b --noEmit`） | 字段改名 / 参数不匹配 | 运行期逻辑 |
| 2 单测 | `npm test`（vitest，现有 524 条 / 21 文件） | 经济公式、边界、日切 | 界面 |
| 3 e2e | `node scripts/e2e-*.mjs <url>` | 真实点击、命中测试、遮挡 | 观感、引导气泡 |
| 4 界面走查 | `node scripts/capture.mjs <url>` | 观感、排版、错位 | 不会断言 |

⚠️ **第 3 层全绿但界面不能用**是本项目最忌讳的假通过：
脚本几乎都用 DOM 的 `.click()`，而 `.click()` **绕过命中测试** ——
被弹层盖住也照样点得到。所以关键点击必须用**真实鼠标事件 + 遮挡探针**：

```js
const top = document.elementFromPoint(x, y)
const ok = !!top?.closest('div.grid.grid-cols-3')   // 顶层元素必须在我这块地里
```

### 7.2 必须保留的 DOM 锚点

**现有 4 个脚本**靠这个定位农场地块（约 16 处调用点）：

```js
document.querySelector('div.grid.grid-cols-3')          // 网格
  .querySelectorAll(':scope > button')                  // 地块 = 直接子 button，顺序 == plots 顺序
```

⚠️ **不要改成 canvas**，也不要给网格套一层包裹 —— 会让 4 个脚本同时失效。
⚠️ **不要引入下标定位**（`children[1]`）—— 加一层包裹就会静默失效
（曾经 `header.children[1]` 当锚点，加包裹后断言**假失败**，已改成 `[data-child-name]`）。

**你的游戏**：网格 / 列表容器加 `data-*`，元素加 `data-<thing>-id`，例如
`[data-claw-grid]` / `[data-claw-prize="bear"]`。

### 7.3 走查脚本规则

- **绝不写死步数 / 条数**，要「跟着状态走」+ **硬断言 + 非零退出码**。
  （曾写死 `for (i < 4)` 而导览实际 **6 步** → 脚本全绿却漏掉最坏的两步，
  报出的数字是假的。）
- **截图逐字节比对在本项目上无效**（无头 Chrome 不确定）。
  判「抖动还是真变」看文件大小：差 **3~252 字节** = 抖动；真改版面差**几十 KB**。
  要证明「某档没变」就**量几何数值**（`getBoundingClientRect`）。
- 走查图集看不见的改动 ≈ 没验过。新增界面**必须加进走查脚本**。

---

## 8. 参考实现：农场（照这个抄）

### 8.1 玩法循环

```
积分 ──买种子──► 地块 ──浇水/等待──► 成熟 ──┬─「当场卖」──► 丰收币（立刻结算）
                                            └─「收进背包」──► 背包 ──市场卖──► 丰收币
                                                                  ▲
                                              市场价随卖出量下跌（卖压）
```

- **成熟了不直接收**：先让孩子选「当场卖」还是「收进背包」。
  这是用户明确要的「提供选择」，**不要替孩子做决定**。
- 市场是**双向**的：卖得多价格跌，价格会回归。这是「等好价再卖」的意义来源。

### 8.2 内容清单（当前口径）

| 类别 | 数量 | 备注 |
| --- | --- | --- |
| 地块 | 12 | 3 列（手机）/ 4 列（≥768）/ 6 列（≥1280） |
| 作物 | **15** | 10 一年生 + 2 花卉 + 3 多年生 |
| 动物 | **8** | 鸡 / 鸭 / 羊 / 猪 / 牛 / 田园犬 / 北极熊 / 长颈鹿 |
| 农场事件 | 5 类 | 虫灾 / 病害 / 恶劣天气 / 丰收 / 中性 |
| 时钟 | 1 | `timeScale`：1 现实分钟 = N 农场分钟（默认 1，调试常用 1200） |

⚠️ **数量口径一共 4 处要同步**（官网 3 处 + README 1 处），
`check-site.mjs` 有闸门钉着。改内容记得同步。

### 8.3 数据结构（关键几个）

```ts
Plot      { index, unlocked, unlockCost, crop?: { cropId, plantedAt, earnedSoFar, diedAt?, ... } }
CropDef   { id, name, emoji, stageEmojis, growMinutes, seedCost, produceItemId, produceAmount,
            regrowCount, kind: 'annual'|'perennial'|'flower', unlockLevel, ... }
AnimalDef { id, name, emoji, cost, produceItemId, produceAmount, produceMinutes, lifeHours?, trait? }
AnimalTrait { name, desc, wardMsg, emoji, wards: FarmEvent['kind'][], chance }
FarmEvent { id, kind, message, emoji, multiplier, createdAt, refId }
MarketState { quotes: MarketQuote[], history: MarketHistoryPoint[] }
```

**动物特殊效果（`AnimalTrait`）的边界**（有意放宽的一条锁）：

- 只能**挡坏档**（`!isGood` 才生效），不能增产。
- 载体（该动物）的期望收益必须落在 **+40%~55%**。
- **只挡自己，不做全场光环** —— 因为 `economy.test.ts` 直接调 `roll*` 函数，
  **看不到农场构成**，光环会让它**绿着说谎**。

### 8.4 数值表（一年生，节选）

| 作物 | 种子成本 | 生长(分) | 产出 | 单价 | 上限回收 |
| --- | --- | --- | --- | --- | --- |
| 小萝卜 | 5 | 2 | 4 | 2 | 8 |
| 胡萝卜 | 10 | 3 | 4 | 4 | 16 |
| 棉花 | 25 | 4 | 4 | 10 | 40 |
| 菠萝 | 240 | 24 | 4 | 96 | 384 |

（`r = 0.6`：上限回收 = 成本 × 1.6。完整表见 `src/domain/catalog.ts`。）

### 8.5 美术清单

**已做（阶段 0，分支 `farm-2d`）**：
- 地块底图（土垄）+ 7 种形态 × 2 帧（成株 / 成熟）+ 15 个果实色 + 幼芽 / 幼苗 / 枯茬。
- 实现：`src/features/farm/cropSprites.tsx`（精灵表 + 引用组件）+ `farm.css`（摆位 / 动效）。
- 产物：24 个 `<symbol>`，整包 **+10 KB raw / +4.4 KB gzip**。

**待做（要达到「QQ 农场」的观感，这才是真正的工程量）**：

| 项 | 数量 | 说明 |
| --- | --- | --- |
| 作物按种类各画 4 帧 | 15 × 4 = 60 | 现在只做了「成株/成熟」按种类分，幼芽/幼苗是共用的 |
| 地块皮 | 4~6 种 | 普通土 / 已浇水（深色）/ 干旱（裂纹）/ 肥沃（发黑） |
| 动物精灵 + 走路帧 | 8 × 3 = 24 | 待机 / 走 / 吃 |
| 天气与昼夜 | 1 套 | 天空渐变 + 云 + 雨/雪粒子（CSS） |
| 收获 / 浇水 / 施肥特效 | 3~5 | 现在有水滴和飘字，可以再加 |
| 建筑与装饰 | 5~8 | 谷仓 / 篱笆 / 水井 / 稻草人 |

**美术交付规范（给画师 / 生图模型）**：
1. 统一 `viewBox="0 0 80 80"`，地面线 `y=78`，不越 `y=80`。
2. 线宽 2.4~3.4，圆头（`stroke-linecap="round"`），不用尖角。
3. 颜色只用主题色板（`theme.css` 的 `--color-*`）+ 土壤三色。
4. 每帧导出成 `<symbol>`，id 形如 `kqf-<cropId>-<stage>`。
5. 单帧节点数控制在 **30 个以内**（渲染性能 + 可读性）。
6. **必须带 `prefers-reduced-motion` 的静态回退**。

### 8.6 随机事件系统（`src/domain/farmEvents.ts`）

**每次收获**抽一档（枯萎病先单独判），抽到的倍率乘在**基础产出**上：

| 档位 | `kind` | 概率 | 倍率区间 | 语义 |
| --- | --- | --- | --- | --- |
| 🌈 风调雨顺 | `weather_good` | 0.10 | 1.10 ~ 1.20 | 好档（**当前是空操作**，见 §5.2①） |
| 🐛 虫灾 | `pest` | 0.15 | 0.70 ~ 0.80 | 坏档 |
| 🦠 病害 | `disease` | 0.06 | 0.55 ~ 0.65 | 坏档 |
| 🌪️ 恶劣天气 | `weather_bad` | 0.04 | 0.45 ~ 0.55 | 坏档 |
| — 什么都没发生 | `none` | 0.64 | 0.92 | 中性档 |
| ☠️ 枯萎病 | `wither` | 0.01 | **绝收** | 多年生还可能整棵枯死 |

设计要点（照抄）：

1. **概率和区间只有一个来源**（`HARVEST_TIERS`）。作物和动物**共用同一套分布** ——
   两处各写一遍循环迟早漂移。
2. **倍率是「稳定随机」**：`hashRandom(seed)`，同一个 seed → 同一个倍率。
   所以任何一次结算都能**复现**，测试不用 mock 随机数。
3. **`NEUTRAL_MULT` 从表里取**（`HARVEST_TIERS.find(t => t.kind === 'none').lo`），
   **不要另写一个 0.92**。它是「动物挡灾之后按哪一档结算」的锚点。
4. **中性档和好档算出来的产出本来就一样**（都顶到满产）——
   所以「挡掉减产」是这个模型里唯一能真实生效的增益。
5. 事件要写进 `farmEvents` 表并**给孩子看**（农场日志）。孩子要知道
   「这次为什么只收了 2 个」—— 这是教育价值的一部分，不是日志。

### 8.7 动物养成（`AnimalDef` / `Animal`）

| 字段 | 含义 | 备注 |
| --- | --- | --- |
| `matureMinutes` | 幼崽 → 成年 | 幼崽期不产出 |
| `cost` | 购买成本（**积分**） | |
| `produceIntervalMinutes` | 产出间隔 | |
| `produceAmount` | 单次产出数量 | 整数 |
| **`produceTimes`** | **总产出次数** | ★ 产够就停产，**动物留在农场** |
| `lifespanMinutes` | 预期寿命 | **已降级为纯展示**，不再决定产出 |
| `fragility` | 生病 / 意外概率倍率 | 1 = 基准 |
| `trait` | 特殊效果 | 见 §8.3 的三条约束 |
| `unlockLevel` | 上市解锁的农场等级 | |

⚠️ **`produceTimes` 取代了「靠寿命一直产」的旧模型**。旧模型下：
小鸡成本 40 能换回约 **20000** —— 这是本项目最严重的一次数值事故。
**你的游戏不许出现「无限产出」的标的**，每个产出源都必须有**次数或额度上限**。

**心情**：`happy | normal | hungry | sick | old | spent`。
「用户 2026-09-15 定：鸡也是到了周期就不生蛋了，虽然鸡还在」——
**动物不消失**，这是情感设计，不是经济设计。

### 8.8 市场行情（`src/domain/market.ts`）

- 每种产出物一个报价 `MarketQuote`，价格随**卖出量下跌**（`applySell` 的卖压）。
- **硬下限**：`base × PRICE_FLOOR`（`PRICE_FLOOR = 0.55`），永不跌破（现状够不到，纯兜底）。
- 行情随时间**回归**（`advanceMarket`），有 7 天走势 `priceSeries()`。
- 收获的两种处置（用户 2026-09-15 明确要求「提供选择」）：

  | 模式 | 行为 | 风险 |
  | --- | --- | --- |
  | `sell`（当场卖） | 按**当日市价**立刻结算 | 可能卖在低点 |
  | `store`（收进背包） | 只进背包，之后按**卖出日市价**卖 | 要占着额度、要等 |

➜ **市场是「等好价再卖」这个决策的全部意义来源。** 如果没有价格波动，
两种处置就没有区别，那个「提供选择」的 UI 就是假的。

### 8.9 等级与解锁

- `selectFarmLevel(state)` 从 `farmTotals`（收获 / 种植 / 剪毛次数）算等级。
- 地块有 `unlockCost`（积分），作物 / 动物有 `unlockLevel`。
- ⚠️ **等级必须靠「行为次数」而不是「资产数量」** —— 否则买一堆不种也能升级。

### 8.10 美术规格书（目标：QQ 农场观感）

这一节是**给画师或生图模型的交付标准**。农场现在的水平是「能看出是什么」，
要到「QQ 农场」还差**质感**，差的就是下面这些。

**A. 视角与比例（全游戏统一，不能一帧一个视角）**

| 项 | 规格 |
| --- | --- |
| 视角 | **3/4 俯视**（不是正俯视、不是正视） |
| 画布 | `viewBox="0 0 80 80"`，**地面线 `y = 78`**，**禁止越过 `y = 80`** |
| 主体占比 | 植株最高点到地面线占画布 **55%~75%**（太小看不出是什么） |
| 线宽 | 主体轮廓 3.0~3.4，细节 1.4~2.0，一律 `stroke-linecap="round"` |
| 圆角 | 一律圆角，**不用尖角**（儿童向） |
| 描边 | 深色描边用**同色系加深**，不用纯黑 |

**B. 色板（只能用这些，改主题时一起改）**

```
草绿  300 #86efac  400 #4ade80  500 #22c55e  600 #16a34a  700 #15803d
阳光  300 #fcd34d  500 #f59e0b
土壤  面 #a37f5a   暗 #8a6a4a   边 #7a5c3f      ← 本模块新增的材质色
墨色  300 #cbbba8  500 #9a8875  700 #574838  900 #33281e
纸色  #fffaf2
果实色  每个作物一个「主色 + 暗色」（见 cropSprites.tsx 的 ART 表）
```

**C. 每帧必须有的状态（4 帧）**

| 帧 | 画什么 | 共用策略 |
| --- | --- | --- |
| 0 种子 / 幼芽 | 土里冒两片小叶 | **所有作物共用 1 帧** |
| 1 苗 | 茎 + 3~4 片叶，还是绿的 | **所有作物共用 1 帧** |
| 2 成株 | 该形态的完整轮廓，**没挂果 / 果是青的** | **按 7 种形态共用** |
| 3 成熟 | 完整轮廓 + **成熟色的果实** | **按作物各画 1 帧（15 帧）** |

**为什么这么分**：15 × 4 = 60 帧是浪费。现实里幼苗本来就长得像，
所以 60 帧压缩成 **2 + 7 + 15 = 24 帧**（`cropSprites.tsx` 已经是这么做的）。
你的游戏照这个思路压缩。

**D. 动画清单（全 CSS `@keyframes`，必须带 `prefers-reduced-motion` 回退）**

| 动效 | 触发 | 复用 |
| --- | --- | --- |
| 摇摆 | 生长中（持续） | `anim-sway`（自带 `transform-origin: 50% 100%`） |
| 上浮 | 成熟（持续） | `anim-float` |
| 弹一下 | 点击 | `anim-pop` |
| 星光 | 成熟（持续） | `anim-sparkle` |
| 金币飘升 | 结算 | `anim-coin-rise` |
| 水滴下落 | 浇水 | 现有 `.drop`（`farm.css` / demo） |
| 云飘 | 场景 | `kqf-cloud`（`kqf-drift`） |

**E. 场景图层（自下而上）**

```
1. 天空渐变（sky-300 → sky-200 → sun-100）
2. 太阳 + 云（3 朵，不同延迟）
3. 远山（草地顶部的弧形，不侵入地块区）
4. 草地（grass-300，通栏）
5. 地块网格（.page-col 收窄）
6. 弹层 / 飘字
```

⚠️ **天空 / 草地 / 山丘是通栏的**（它们是场景，铺满才自然），
**地块和按钮收进 `.page-col`** —— 否则平板上 12 块地会被拉成一整排大格子。

**F. 待补素材（这才是真正的工程量）**

| 批次 | 内容 | 数量 | 优先级 |
| --- | --- | --- | --- |
| **① 作物补全** | 15 种作物 × 4 帧（现在 0/1 帧是共用的，要各自画） | 60 | 高 |
| **② 地块皮** | 普通土 / 已浇水（深色）/ 干旱（裂纹）/ 肥沃（发黑） | 4~6 | 高 |
| **③ 动物** | 8 种 × 3 帧（待机 / 走 / 吃） | 24 | 中 |
| **④ 天气昼夜** | 天空渐变 4 套 + 雨 / 雪 / 落叶粒子 | 1 套 | 中 |
| **⑤ 特效** | 浇水 / 施肥 / 收获 / 升级 | 4~5 | 中 |
| **⑥ 建筑装饰** | 谷仓 / 篱笆 / 水井 / 稻草人 / 告示牌 | 5~8 | 低 |

**G. 验收（每一批都要过）**

1. 单帧 SVG 节点数 **≤ 30**（渲染性能 + 可读性）。
2. 单帧导出后 **≤ 2 KB**（未压缩）。
3. 走查图在 **390×844 和 834×1112 两档**都看过，且**量过几何**
   （`getBoundingClientRect`，不是靠眼睛）—— 见 §7.3。
4. 整包增量 **≤ +15 KB gzip**。
5. `prefers-reduced-motion` 下所有动效**能停**。
6. 地面线 `y=78`、不越 `y=80`（**这条被违反过一次**：胡萝卜的根画到 `y=87`，
   屏幕上就是「根被切了一半」）。

---

## 9. 第二个插件骨架：娃娃机

把 §4 的契约套进去，得到：

```ts
// src/games/claw/manifest.ts
export const CLAW_MANIFEST = {
  id: 'claw', name: '娃娃机', emoji: '🕹️', tabLabel: '娃娃机',
  coin: { id: 'claw', name: '游戏币', emoji: '🎟️' },
  economy: { playCost: 10, expectedPayout: 6, capPerPrize: 16 },
  defaultEnabled: true,
}
```

**表**

```ts
// db.ts 新增
this.version(6).stores({
  'claw.prizes': 'id, rarity, createdAt',
  'claw.plays':  'id, prizeId, createdAt',        // 每次抓取
  'claw.ledger': 'id, source, createdAt, refId',  // 游戏币账本（和 harvestLedger 同形）
})
```

**经济映射**

| 农场 | 娃娃机 |
| --- | --- |
| 买种子（扣积分） | 投币开抓（扣积分 `playCost`） |
| 收获 → 背包（不铸币） | 抓到 → 奖品盒（**不铸币**） |
| 市场卖出（铸丰收币） | 「换成游戏币」按钮（铸游戏币） |
| `remainingCapFor` 闸门 | 单个奖品最多卖 `capPerPrize` 币 |
| 收进背包的额度要结转 | 没换币的奖品也要能结转 |

**必须挡住的坑**

1. **概率必须由「家长可见的赔率」决定，且期望值 < 投入。**
   `expectedPayout (6) < playCost (10)` —— 否则就是印钞机。
2. **不许「有概率多给币」的加成**（§5.2 第 1 条）。
3. **不许把游戏币换回积分**（§2.2）。
4. **「重置存档 / 改赔率」必须过家长闸门**。
5. **`data-claw-grid` / `data-claw-prize` 锚点**，别用下标。
6. **`prefers-reduced-motion`**：爪子摆动、奖品弹跳都要能停。

**接进 App 只需要改一处**

```tsx
// src/App.tsx
const TABS = [
  { key: 'tasks', label: '任务', emoji: '📋' },
  { key: 'farm',  label: '农场', emoji: '🌾' },
  { key: 'claw',  label: '娃娃机', emoji: '🕹️' },   // ← 加这一行
  { key: 'redeem', label: '兑换', emoji: '🎁' },
  { key: 'points', label: '积分', emoji: '🪙' },
]
```

**【提案】真正插件化要做的重构**（现在 `App.tsx` 是硬编码的 4 个 tab）：

```ts
// src/games/registry.ts 【提案】
export const GAMES: GamePlugin[] = [farmPlugin, clawPlugin]
// App.tsx 改成遍历 GAMES 渲染 tab + 页面；
// 家长设置里按 manifest.defaultEnabled / settings.enabledGames 决定显示哪些。
```

⚠️ 注意：**tab 最多 4~5 个**。手机上每个 tab 只有 ~97px 宽，
标签超过 3 个汉字就会被挤成两行（农场踩过：5 个块挤在 390px 里，
`gap-3` 把「1 级农场」挤到换行，整行 44px → 54px 把顶栏裁掉）。
多出来的游戏应该收进「更多」或者家长开关里。

---

## 10. 落地路线（把现有 App 插件化）

| 阶段 | 做什么 | 验收 |
| --- | --- | --- |
| **A** | 抽 `src/games/registry.ts` + `GameManifest` 类型；农场改成第一个实现（**行为零变化**） | 现有 524 单测 + 6 个 e2e 套件全绿，且**截图逐字节无差异** |
| **B** | `RedeemItem` 加 `coin?` 字段 + 迁移；`planRedeemPayment` 按币种分发 | 新老记录都能读出正确的分账（`paidOf()` 兼容） |
| **C** | 底部导航改成遍历 registry；tab 超过 5 个时收进「更多」 | 手机上 tab 不换行、触控 ≥44 |
| **D** | 家长设置加「游戏开关」（`settings.enabledGames`） | 关掉的游戏不渲染 tab，但**存档保留** |
| **E** | 农场美术补到 QQ 农场级（§8.5 的待做清单） | 走查图 + 单帧节点数 ≤30 + 体积 ≤ +15KB gzip |
| **F** | 第二个游戏（娃娃机）按 §9 实现 | 同上四层验收 |

### 这一路上最容易踩的坑（都是本项目真实踩过的）

1. **改了种子，App 里还是老的** —— 老设备**不会补、也不会改价**（不是构建问题）。
   固定动作：① 先证明产物里真的有（查 `dist` / `site/app` / APK 三处的 bundle 名；
   ⚠️ APK 里搜不到中文是正常的，ZIP 压过了）；② 再看是不是已装设备。
2. **「文件在」≠「文件是新的」** —— 验证要比**包内特征值**（`index-<hash>.js`），
   不要看时间戳。
3. **同一个事实存了两份，就一定会走散** —— 农场里 `Task` 和 `TaskInstance`
   就因此出过「改得分不生效」。你的游戏状态**只存一份**。
4. **删了规则要连话术一起删** —— 删代码是静默的，界面照样把话说满。
5. **别并发跑两个会写 `dist/` 的任务**（`build-*` 会清空 dist，
   截图脚本会撞 404 但**脚本还是绿的**，那一轮数据全不可信）。

---

## 11. 附录

### 11.1 现有代码索引

| 关注点 | 文件 |
| --- | --- |
| 类型总表 | `src/domain/types.ts` |
| 经济公式 / 闸门 | `src/domain/economy.ts` |
| 兑换付款规则 | `src/domain/redeem.ts` |
| 内容清单（作物 / 动物 / 物品） | `src/domain/catalog.ts` |
| 随机事件 / 动物特殊效果 | `src/domain/farmEvents.ts` |
| 生长阶段 / 成熟判断 | `src/domain/farm.ts` |
| 任务评分（五档系数） | `src/domain/settlement.ts` |
| 打卡 / 连击 | `src/domain/recurrence.ts`、`streakBonus.ts`、`tierRatio.ts` |
| 持久化 / 迁移 | `src/db/db.ts` |
| store（所有动作） | `src/store/useApp.ts` |
| 页面外壳 / tab | `src/App.tsx` |
| 农场页面 | `src/features/farm/FarmPage.tsx` |
| 农场精灵表 | `src/features/farm/cropSprites.tsx` |
| 农场样式 / 动效 | `src/features/farm/farm.css` |
| 家长闸门 | `src/features/parent/ParentGate.tsx` |
| 主题色板 | `src/styles/theme.css` |
| 2D 农场方案与实测 | `docs/2d-farm-proposal/README.md`、`demo.html` |
| 走查脚本 | `scripts/capture.mjs` |
| e2e 套件 | `scripts/e2e-check.mjs`、`e2e-gameplay.mjs`、`e2e-bag-sell.mjs`、`e2e-regressions.mjs` |
| 官网事实闸门 | `scripts/check-site.mjs` |

### 11.2 术语表

| 词 | 含义 |
| --- | --- |
| **积分 🪙** | 任务赚来的唯一货币，所有游戏的入水口 |
| **丰收币 🌾** | 农场的游戏币，只能在兑换商城花 |
| **上限回收** | `成本 × (1 + r)`，一件产出物一辈子最多能卖多少币 —— 通胀闸门 |
| **满产** | 单次收获的上限，`min(满产, round(基础 × 倍率))` |
| **逻辑日** | `dayStartHour`（默认 4）划出来的「一天」，00:00–04:00 算前一天 |
| **一次性作物** | 收完地块就变空（小萝卜 / 胡萝卜），额度要结转 |
| **长期任务** | `!isCheckInTask && !isPreGenerated(cycle)`，周 / 月 / 年 —— 只有它能触发连击 |
| **声明腐坏** | 删了功能但页面文案没删，界面继续把话说满 |

---

*本规范 v1 基于 `kid-quest-farm` 仓库 2026-10-14 的状态写成。
标 `【提案】` 的部分尚未实现；其余全部来自现有代码。*
