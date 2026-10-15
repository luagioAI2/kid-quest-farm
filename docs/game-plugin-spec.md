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
| 要能**独立下载 / 独立更新**的游戏：自带存储 + 实现 `exportData()` / `importData()`，并声明 `minHostApi` | 见 §12 —— 否则备份静默丢数据、或一次游戏更新把宿主搞崩 |

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

### 2.1 四个角色

| 角色 | 符号 | 谁产生 | 谁消耗 | 现有实现 |
| --- | --- | --- | --- | --- |
| **积分** | 🪙 | 任务结算（`settleNow` → `postLedger`） | **所有游戏**的投入 + 兑换 | `ledger` 表，`state.balance` |
| **游戏币** | 各游戏自定 | 该游戏内部的产出循环 | **只能**在兑换商城花 | 农场 = `harvestLedger` 表，`state.harvestBalance` |
| **商城币** | 🎫 | **【还没接】将来是付费购买 / 兑换码** | **买游戏**（家长栏 →「游戏」） | `mallLedger` 表，`state.mallBalance` |
| **兑换品** | — | 家长在「兑换商城」里配 | 孩子兑换，家长兑现 | `redeemItems` / `redeemRecords` |

**三套币，三张表，互相一条通路都没有。** 积分 ⇸ 丰收币、丰收币 ⇸ 积分、
商城币 ⇸ 任何别的币 —— 全都不存在。

⚠️ **任何两条币之间的双向通路都是印钞机**（见 §2.2 那张账）。加通路之前先把账重算一遍。

#### 商城币现在是什么状态（2026-10-14）

家长原话：

> 「商城币 跟积分 和 丰收币都不一样。首款免费并且默认购买。」
> 「（来源）以后支付购买。或者兑换码。」

所以**这一轮只建了钱包**：表、余额、扣款（`spendMall`）、购买动作（`buyGame`）
全都在并且有用例，但**没有任何发币入口**，余额恒为 0。

由此推出两条界面纪律（**别当成临时状态删掉**）：
1. `status: 'comingSoon'` 的游戏**不渲染购买按钮、也不显示价格** —— 买了也没得玩；
2. 家长栏的「商城币」卡片直接把「还没做」写出来，而不是摆一个按不动的按钮。

➜ 等付费 / 兑换码接上，把这两条改掉即可。**不要为了「让表里有东西」先塞一笔假币。**

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
分成三张表之后，`currentBalance()` 只读 `db.ledger`、`currentHarvestBalance()` 只读
`db.harvestLedger`、`currentMallBalance()` 只读 `db.mallLedger` —— 三个函数**在物理上
不可能**看到彼此的币。

**你的游戏必须自己开一张表**，不要往 `ledger` / `harvestLedger` / `mallLedger` 里塞。

⚠️ **扣款要带守卫时，守卫必须在事务里面。** 别写成「先 `currentXxxBalance()` 判断、
再 `postXxx()`」—— 两次并发调用会各自读到同一个「够」，于是都扣（**超支**），
而且每条 `balanceAfter` 都自洽、不报错。`spendMall` / `consumeItem` 是正确写法，
可以照抄；`consumeItem` 的注释里记着那次事故的实测数据（库存 1 个并发卖两次，
返回 `[true, true]`）。

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

**游戏那一格 tab 的锚点是 `tab-<当前游戏 id>`，不是固定的 `tab-game`。**

默认（农场）时它就是 `tab-farm`，而 `ChildTour.tsx` 的导览步骤（`anchor: 'tab-farm'`）、
`capture-tablet.mjs`、`e2e-check.mjs` 都钉着这个字符串。所以：

- ⚠️ **别把游戏格改成固定的 `tab-game`** —— 会同时弄断新手导览和两个走查脚本；
- 导览那一步的 `anchor` 要跟着当前游戏走，但它的 `tab` 字段**始终是 `'game'`**
  （`tab` 是「停在哪个页面」，`anchor` 是「高亮哪个元素」，两者 2026-10-14 起不再同名）；
- 底部导航另外三格（任务 / 兑换 / 积分）的锚点没变。

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

⚠️ **2026-10-15 校正。** 这张表原来把「作物 15 × 4 = 60 帧」列成待做，
**和本文 §8.10C 自相矛盾** —— §8.10C 自己说 60 帧是浪费、正确目标是
**2 + 7 + 15 = 24 帧**，而 `cropSprites.tsx` **早就那么做了**。
照旧表做等于白画 36 帧。下面是校正后的口径。

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 作物 24 帧（2 共用 + 7 形态 + 15 果实） | ✅ **已完成** | 见 §8.10C。**不要再补成 60 帧** |
| 动物精灵 | ✅ **已完成**（2026-10-15） | 8 种 × 2 帧（幼崽 / 成年）= 16 帧，`animalSprites.tsx`；替掉了 emoji |
| 地块皮 | ⚠️ **做不了** | 旧表写的「已浇水 / 干旱 / 肥沃」**游戏里没有这三个状态**：`Plot` 上没有水 / 旱 / 肥字段，`water()` 其实是**施肥**（吃 `fertilizer`、把生长推进 50%）。**先有机制才谈得上画**。⚠️ 2026-10-15 又查出：连「施肥」这个状态本身**大多数孩子也走不到**（`fertilizer` 只从道具掉落来，而掉落默认关、商店不卖）—— 见下面「第三条教训」 |
| 动物走路 / 进食帧 | ⬜ 未做 | 动物小屋是**静态列表**，没有「走 / 吃」状态；同样要先有状态 |
| 昼夜（色调 + 日月） | ✅ **已完成**（2026-10-15，**改过一版**） | 四档色调（晨 / 昼 / 昏 / 夜）+ 内联 SVG 太阳 / 月亮 + 草地 / 山丘按档压暗。判据在 `domain/farmClock.ts` 的 `skyToneFor`，由**已经在顶栏显示的农场小时**驱动 —— 状态**存在**，所以这一条做得成。⚠️ **日月画在时钟条里，不在天空带子里**（第一版画在带子里，实测 0% 可见，见下面的「可见性」教训） |
| 雨 / 雪粒子 | ⚠️ **做不了** | 和「地块皮」同一类：天气是**收获时的一次性掷骰**（`weather_bad` 是 `FarmEvent`，带一个倍率），**没有「正在下雨」这种持续状态**。粒子没有东西驱动 |
| 收获 / 施肥特效 | 🟡 **一半**（2026-10-15） | **收获**：✅ 产出图案从土里蹦出来 + 两点星光（`FarmPage.tsx` 的 `PlotBurst` / `usePlotBurst`），由这一格自己的 `crop.harvestedCount` 推导 —— 收获有几条路径，回调只能覆盖一条，状态才是唯一的事实。**浇水 / 施肥**：⚠️ **不做** —— 不是没时间，是**那个状态大多数孩子走不到**（见「第三条教训」） |
| 建筑与装饰 | ⬜ 未做 | 谷仓 / 篱笆 / 水井 / 稻草人 |

★ **教训**：旧表里三条「待做」其实都**缺前置状态**（地块皮、走路帧，以及被高估的作物帧数）。
写美术 backlog 时先问一句「**这个外观对应游戏里的哪个状态？那个状态存在吗？**」——
否则画出来的东西没有数据能驱动它，只会变成死素材（本项目的说法：**界面不许承诺做不到的事**）。

★★ **第二条教训（2026-10-15，同一天踩到）：状态存在 ≠ 画出来就看得见。**
昼夜的第一版把太阳 / 月亮 / 星星画在页面顶上那条天空带子里，走查脚本**全绿** ——
因为它量的是「日月中心在不在天空框内」，那只证明它**画在**那里。
按 12×12 网格采样日月包围盒、用 `elementFromPoint` 数「最上层是不是它」之后：

    手机 390×844 ：天空可见 **0%** · 日月可见 **0%**（四档全 0）
    平板 834×1112：天空可见 17% · 日月可见 **0%**

原因：天空带子是 y=63..239，而顶栏那张 `.surface` 卡片是 y=79..187 —— 卡片把天空
从 79 一直盖到 176，只留下卡片两侧十几像素的缝。

➜ **判据：美术必须真的可见。画在别人底下 = 没画。**
  · 天空带子**只留色调**（卡片两侧的缝里看得见）；
  · 太阳 / 月亮搬进**时钟条**（内容层，一定在卡片上面）；
  · **草地 / 山丘跟着色调压暗** —— 它们是页面上唯一 100% 可见的大面积，
    昼夜靠它们才真的「感觉得到」。
  · 由此删掉了 `celestialFor()` 那条正弦弧（坐标没有任何地方能显示）
    和夜空那 10 颗星（20px 的时钟条里放不下）。
➜ 走查脚本里**必须有一条遮挡断言**（`capture-sky.mjs` 的
  「日月真的在最上面那一层」），而且**验过先红后绿**（把日月放回带子里 → 可见 0%、退出码 1）。

★★ **第二条教训 · 补丁（2026-10-15 下午，做收获特效时又踩到三个变种）：**
遮挡探针自己也有盲区，得三处加固 ——

  · **只测「某一瞬间」会漏。** 收获特效全长 900ms，位置最高的一帧比静止位置高 12px，
    单帧采样正好漏掉「峰值那一帧被盖住」。现在**逐帧采、取最差的一帧**
    （`capture-harvest-fx.mjs`）。顺带：前 ~100ms 弹层遮罩还在
    （`harvest()` 最后 await 了一次 refresh，特效先渲染、`onClose()` 还没跑），
    那几帧特效本身 `opacity:0`，不算「被盖住」，采样要从 100ms 之后算。
  · **探针必须自检。** 临时盖一层全屏遮罩，可见率要掉到 0%、拿掉又回 100%。
    没有这条，「探针烂掉」和「特效没被盖住」长得一模一样（恒绿）。
  · **顺带修掉一个更老的毛病：toast 栈不封顶。** 它是 `fixed top-3` 的浮层，
    一条 74px、活 3.4s，实测 3 条就盖到 y=250，而**农场第一排地块从 y=195 起**
    —— 收获特效可见率当场掉到 **31%**（平板 71%）。现在封顶 **2 条**
    （2 条时浮层底边 y=168，不碰地块）。**上限是按「别碰到地块」量出来的，不是拍脑袋。**
    这条也提醒：同一个浮层同样会盖住**原有的** `settleFlash` 飘字（它在 `top-[34%]`）。

★★ **第三条教训（2026-10-15，做收获特效的邻居时查出来）：状态存在 ≠ 用户走得到那个状态。**
这一批原本要连「浇水 / 施肥特效」一起做，查下去发现那条路**几乎没人能走到**：

    入口：点一块**成长中**的地 → `FarmPage` 的 `onTap` → `water(plot.index)`
    闸门：`water()` 里找 `inventory` 的 `fertilizer`，没有就只弹一句「没有神奇肥料了」
    而 fertilizer 从哪来：**只从道具掉落来**（`rarity: 'rare'`）
      · `settings.itemDropsEnabled` **默认 `false`**（`db.ts` 的 DEFAULT_SETTINGS）
      · 种子商店 / 市场**都不卖道具**（`SHOP_SEEDS` / `SHOP_ANIMALS` / `MARKET_GOODS` 里没有它）
      · 没有开局礼（`inventory` 初始为空）
    ⇒ 默认配置下，孩子点成长中的地**永远**得到「没有神奇肥料了」，
      而那句提示指向一个他**没有任何途径拿到**的东西。

➜ **判据：动手画之前先问「这个状态**谁**能触发？默认配置下能吗？」** ——
  答案要能在代码里指出来（哪一行让它变成可达的）。指不出来就先别画，
  否则做出来的是一幅**没人看得见的画**（和「画在别人底下」是同一类问题，
  只是这次连「画了」都白画）。
➜ 所以这一批**只做收获**。施肥特效等「fertilizer 有正经来源」之后再做 ——
  那是个产品决定（卖？开局送？还是把「点成长中的地」改成显示信息），不在这张美术表里。

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
1. 天空（**四档色调**，由 `skyToneFor(农场小时)` 选；`day` 那一档仍是 sky-300 → sky-200 → sun-100）
2. 太阳 / 月亮（内联 SVG，`celestialFor(农场小时)` 定位）+ 夜空 10 颗星 + 云（3 朵，不同延迟）
3. 远山（草地顶部的弧形，不侵入地块区）
4. 草地（grass-300，通栏）
5. 地块网格（.page-col 收窄）
6. 弹层 / 飘字
```

⚠️ **天空 / 草地 / 山丘是通栏的**（它们是场景，铺满才自然），
**地块和按钮收进 `.page-col`** —— 否则平板上 12 块地会被拉成一整排大格子。

**F. 待补素材（这才是真正的工程量）**

| 批次 | 内容 | 数量 | 优先级 | 状态 |
| --- | --- | --- | --- | --- |
| **① 作物** | ~~15 种 × 4 帧~~ → **2 + 7 + 15 = 24 帧**（见 C 节） | 24 | 高 | ✅ **已完成** |
| **② 地块皮** | 普通土 / 已浇水 / 干旱 / 肥沃 | 4~6 | 高 | ⚠️ **阻塞**：没有水 / 旱 / 肥状态（`water()` 是施肥） |
| **③ 动物** | 8 种 × 2 帧（幼崽 / 成年） | 16 | 中 | ✅ **已完成**（2026-10-15） |
| **④ 昼夜** | 天空四档色调 + 内联 SVG 太阳 / 月亮（画在**时钟条**里）+ 草地按档压暗（`Sky.tsx`） | 1 套 | 中 | ✅ **已完成**（2026-10-15，改过一版 —— 第一版画在天空带子里，实测 0% 可见） |
| **④b 雨 / 雪粒子** | 雨 / 雪 / 落叶粒子 | 1 套 | 中 | ⚠️ **阻塞**：天气是收获时的**一次性掷骰**，不是「正在下雨」这种持续状态 |
| **⑤ 特效** | ~~浇水 / 施肥 / 收获 / 升级~~ → **收获** | 1 | 中 | 🟡 **收获已完成**（2026-10-15）：`PlotBurst`，走查 `capture-harvest-fx.mjs`（22 条 ×2 档）。**浇水 / 施肥不做** —— `fertilizer` 没有正经来源，状态走不到（「第三条教训」）。**升级**：⬜ 未做，但**状态存在**（`selectFarmLevel` 由 `farmTotals` 推导），想做随时能做 |
| **⑥ 建筑装饰** | 谷仓 / 篱笆 / 水井 / 稻草人 / 告示牌 | 5~8 | 低 | ⬜ 未做 |

⚠️ **① 和 ③ 的数量都改过**：① 从 60 降到 24（C 节的理由），③ 从 24 降到 16
（旧表按「待机 / 走 / 吃」算，但**动物小屋是静态列表、没有这两个状态**；
实际需要的只是「幼崽 / 成年」两帧，正好对上 `emoji` / `babyEmoji` 的既有区分）。

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

**进度（2026-10-15）**：A、C、D 已完成；**E 进行中**（作物 24 帧、动物精灵、昼夜天空、
收获特效都已落地；地块皮 / 雨雪粒子**被前置状态卡住**，浇水 / 施肥特效
**被「状态走不到」卡住**）；B 未做，F 未开始。
**新增 G：平台化 / 游戏的独立分发**（家长 2026-10-15 提的目标）—— 见 **§12**，
其中 **P1（让游戏真的可插拔）是 P2（下载）的前置**，而 P2 的准入条件是
「哈希 + 签名校验」，不是可选项。

| 阶段 | 做什么 | 状态 |
| --- | --- | --- |
| **A** | 抽 `src/games/registry.ts` + `GameDef` 类型；农场改成第一个实现（**行为零变化**） | ✅ **已完成**。注册表是**纯数据**，页面在 `src/games/pages.ts` —— 理由见下 |
| **B** | `RedeemItem` 加 `coin?` 字段 + 迁移；`planRedeemPayment` 按币种分发 | ⬜ 未做 |
| **C** | 底部导航改成遍历注册表 | ✅ **已完成**（固定 3 格 + 游戏格运行时算；`data-tour` 见 §7.2） |
| **D** | 家长栏的「游戏」页：商城币钱包 + 已购买 + 当前游戏 + 购买动作 | ✅ **已完成**（购买按钮目前走不到，见 §2.1 末尾） |
| **E** | 农场美术补到 QQ 农场级（§8.5 的待做清单） | 🟡 **进行中**（2026-10-15）：**动物精灵已完成** —— 8 种 × 2 帧 = 16 帧，`animalSprites.tsx`；**昼夜已完成** —— 四档色调 + 内联 SVG 日月（在时钟条里）+ 草地按档压暗，`Sky.tsx` + `domain/farmClock.ts`；**收获特效已完成** —— 产出从土里蹦出来（`FarmPage.tsx` 的 `PlotBurst`），走查 `capture-harvest-fx.mjs`；作物 24 帧本来就有；**地块皮 / 雨雪粒子被前置状态卡住**，**浇水 / 施肥特效被「状态走不到」卡住**（见 §8.5 校正表） |
| **F** | 第二个游戏（娃娃机）按 §9 实现 | ⬜ 未开始 |

### ⚠️ A 阶段踩到的坑：注册表**不能 import 页面组件**

第一版把 `Page` 直接挂在 `GAMES` 的条目上，结果形成环：

```
store/useApp.ts  ──►  games/registry.ts  ──►  features/farm/FarmPage.tsx
       ▲                                              │
       └──────────────────────────────────────────────┘
```

`FarmPage` 要读 store，所以注册表只要静态 import 它，环就成立。环本身不致命，
但**谁先 import 注册表谁就炸** —— `useApp.ts` 的模块顶层会遍历 `GAMES` 算初始值，
而那一刻注册表还没求值完，读到的 `GAMES` 还在暂时性死区里：

```
TypeError: GAMES is not iterable
```

加 `registry.test.ts` 时就是这么炸的（测试文件先 import 了注册表）。
**应用里没炸只是碰巧 import 顺序对** —— 这种「靠顺序活着」的依赖不能留。

➜ 拆成两个文件：
- `src/games/registry.ts` —— 纯数据 + 类型 + 纯函数（`store` 读它）；
- `src/games/pages.ts` —— `GAME_PAGES: Record<id, ComponentType>`（只有 `App.tsx` 读它）。

两边的一致性由 `registry.test.ts` 钉着（可玩的必须有页面、`pages.ts` 里不许有野页面）。
**加游戏时数据加 registry、页面加 pages。**

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
| **农场时间 / 昼夜分档** | `src/domain/farmClock.ts`（`farmClockAt` / `skyToneFor`）。⚠️ 曾有 `celestialFor`（日月沿正弦弧定位），2026-10-15 **已删** —— 坐标没有任何地方能显示出来 |
| 任务评分（五档系数） | `src/domain/settlement.ts` |
| 打卡 / 连击 | `src/domain/recurrence.ts`、`streakBonus.ts`、`tierRatio.ts` |
| 持久化 / 迁移 | `src/db/db.ts` |
| store（所有动作） | `src/store/useApp.ts` |
| 页面外壳 / tab | `src/App.tsx` |
| **游戏注册表（纯数据）** | `src/games/registry.ts` |
| **游戏 id 常量** | `src/games/ids.ts` |
| **游戏 id → 页面组件** | `src/games/pages.ts` |
| **家长栏「游戏」页** | `src/features/settings/GamesSection.tsx` |
| 农场页面 | `src/features/farm/FarmPage.tsx` |
| 农场精灵表 | `src/features/farm/cropSprites.tsx` |
| 动物精灵表 | `src/features/farm/animalSprites.tsx` |
| 天空（昼夜 + 日月） | `src/features/farm/Sky.tsx` |
| 收获特效（产出从土里蹦出来） | `src/features/farm/FarmPage.tsx`（`PlotBurst` / `usePlotBurst`）+ `farm.css` 的 `kqf-harvest-pop` |
| 农场样式 / 动效 | `src/features/farm/farm.css` |
| 家长闸门 | `src/features/parent/ParentGate.tsx` |
| 主题色板 | `src/styles/theme.css` |
| 2D 农场方案与实测 | `docs/2d-farm-proposal/README.md`、`demo.html` |
| 走查脚本 | `scripts/capture.mjs`；**盲区各有一份**：`capture-games.mjs`（游戏栏）、`capture-animals.mjs`（动物小屋）、`capture-sky.mjs`（天空昼夜，用 `evaluateOnNewDocument` 钉死 `Date.now` 才有确定性）、`capture-harvest-fx.mjs`（收获特效，**逐帧**采遮挡 + 探针自检）、`capture-tablet-onboarding.mjs`（新手导览） |
| e2e 套件 | `scripts/e2e-check.mjs`、`e2e-gameplay.mjs`、`e2e-bag-sell.mjs`、`e2e-regressions.mjs` |
| 官网事实闸门 | `scripts/check-site.mjs` |

### 11.2 术语表

| 词 | 含义 |
| --- | --- |
| **积分 🪙** | 任务赚来的唯一货币，所有游戏的入水口 |
| **丰收币 🌾** | 农场的游戏币，只能在兑换商城花 |
| **商城币 🎫** | 第三套币，用来**买游戏**。来源（付费 / 兑换码）还没接，余额恒为 0 |
| **上限回收** | `成本 × (1 + r)`，一件产出物一辈子最多能卖多少币 —— 通胀闸门 |
| **满产** | 单次收获的上限，`min(满产, round(基础 × 倍率))` |
| **逻辑日** | `dayStartHour`（默认 4）划出来的「一天」，00:00–04:00 算前一天 |
| **一次性作物** | 收完地块就变空（小萝卜 / 胡萝卜），额度要结转 |
| **长期任务** | `!isCheckInTask && !isPreGenerated(cycle)`，周 / 月 / 年 —— 只有它能触发连击 |
| **声明腐坏** | 删了功能但页面文案没删，界面继续把话说满 |

---

*本规范 v1 基于 `kid-quest-farm` 仓库 2026-10-14 的状态写成。
标 `【提案】` 的部分尚未实现；其余全部来自现有代码。*

*v1.1（同日）：插件化 A / C / D 已落地（`src/games/*`、家长栏「游戏」页、
商城币钱包），§2.1 与 §10 已按实际实现改写。B（多币种兑换）与 E / F 仍未做。*

*v1.2（2026-10-15）：E 阶段开工，**动物精灵落地**（8 种 × 2 帧 = 16 帧，
`animalSprites.tsx`，替掉 emoji）。同时**校正了 §8.5 / §8.10F 的自相矛盾**：
旧表把「作物 60 帧」列成待做（与 §8.10C 冲突，实际 24 帧早已完成），
并把「地块皮 / 动物走路帧」列成待做（**前置状态不存在** —— `water()` 是施肥，
动物小屋是静态列表）。写 backlog 前先问「这个外观对应哪个状态」。*

*v1.3（2026-10-15）：E 阶段第二批 —— **昼夜天空落地**。天空从一条静态渐变
改成**四档色调**（晨 / 昼 / 昏 / 夜）+ 内联 SVG 太阳 / 月亮 + 夜空 10 颗星
（`Sky.tsx`）。判据抽到 `domain/farmClock.ts` 的 `skyToneFor` / `celestialFor`，
**顶栏时钟和天空共用同一次换算**（`FarmPage` 算一次、两处读），
色调和日月共用同一个分档 —— 所以不可能出现「天是黑的、太阳还挂着」。
「雨 / 雪粒子」一并标成**被前置状态卡住**（天气是收获时的一次性掷骰）。

⚠️ **这一版当天就被 v1.4 推翻了** —— 它把日月画在天空带子里，而那条带子
被顶栏卡片盖住 100%，日月**一个像素都看不见**。保留在此仅作记录。*

> ★ **这次新增的走查教训**：**按时间变化的界面，截图天生不确定** ——
> 跑一次是白天、跑一次是夜里。`capture-sky.mjs` 用
> `page.evaluateOnNewDocument` 把 `Date.now()` 钉在指定的本地小时上
> （只改 `Date.now`，不动 `window.Date`，免得波及 Dexie），
> 四个时刻各跑一遍，四档就都被覆盖到。而且分档边界**从 `farmClock.ts` 读**、
> 不抄进脚本 —— 抄一份的话改了分档脚本还是绿的（守卫**悄悄变弱**而不是变红，
> 本项目已经踩过两次）。断言里必须有一条**对照组**：
> 四个时刻要真的产出四档**不同**的色调，否则「天空跟着小时走」根本没被验证。

*v1.4（2026-10-15，**同一天推翻 v1.3**）：昼夜**改成看得见的版本**。
起因是「**看截图**」—— 走查脚本全绿，但手机上图里只有一条深紫的缝，
月亮和星星全被顶栏卡片盖住。随后量出来：**天空可见 0% / 日月可见 0%**
（平板也只有 17% / 0%）。修法：

- 天空带子**只留色调**（卡片两侧的缝里看得见）；
- 太阳 / 月亮搬进**时钟条**（内容层，一定在卡片上面），时钟条底色也跟着色调变；
- **草地 / 山丘跟着色调压暗** —— 它们是页面上唯一 100% 可见的大面积，
  昼夜靠它们才真的「感觉得到」；
- 删掉 `celestialFor()` 那条正弦弧（坐标没有任何地方能显示）和夜空 10 颗星
  （20px 的时钟条里放不下）。

> ★★ **这次最值钱的教训：断言「画了什么」不等于「看得见什么」。**
> 上一版断言的是「日月中心在天空框内」—— 那只证明它**画在**那里，
> 被盖住也照样绿。现在的守卫换了个层次：`capture-sky.mjs` 按 8×8 网格采样
> 日月的包围盒，用 `elementFromPoint` 数「最上层是不是它」，**要求 100%**。
>
> ⚠️ 而且探针自己也有个坑：**不能**写 `el.contains(body)` —— 那样
> 「被祖先兜住」也算可见，而 `pointer-events:none` / 被兄弟盖住时
> `elementFromPoint` 返回的正好就是祖先，断言就永远绿了。
> 只认 `el === body || body.contains(el)`。
>
> ★ 这条断言**验过先红后绿**：把日月放回天空带子里 → `可见 0%`、
> 还打印出挡住它的是 `div.page-col.relative`、退出码 1；改回来 → 全绿。
> 这是本项目第三次栽在「守卫看着绿、其实在说谎」上（前两次：动物两帧 id 写反、
> 硬编码档位名少匹配一档），而**三次都是靠「换个层次量」而不是「看得更仔细」解决的**。

*v1.5（2026-10-15，同一天）：阶段 E **第 ⑤ 批「收获特效」** —— 产出从土里蹦出来。
只做了收获，因为查下去发现「浇水 / 施肥」那条路**大多数孩子走不到**（第三条教训）。

**做了什么**

- `FarmPage.tsx` 新增 `PlotBurst` + `usePlotBurst`：产出图案从土面蹦出来 + 两点星光，
  900ms 后自己消失。图案取自 `CROP_BY_ID.get(cropId).emoji`，**不是**新画的素材。
- 触发**不靠回调、靠状态**：`PlotTile` 自己比较 `crop.harvestedCount` 是否前进
  （一次性作物则看 `crop` 是否被清空，并**排除「清理枯茬」** —— 那条路也会置空，
  但 `before.diedAt` 有值）。理由：收获有两条路径（孩子走 `HarvestSheet`、
  调试句柄直接调 store），回调只能覆盖一条，而 `harvestedCount` 是唯一的事实。
- 落点有讲究：一次性作物收完那一格会切到**空地分支**，所以特效要挂在**两个分支**上，
  只挂一处就会出现「收白萝卜看得见、收胡萝卜看不见」。
- `farm.css` 加 `kqf-harvest-pop`（位移留在格子内 —— 地块是 `overflow-hidden`），
  `prefers-reduced-motion` 下**去掉位移但保留图案**（减少动效 ≠ 删掉反馈）。

**顺手修掉的两件事**（都是被这一批的验收「钓」出来的）

1. **toast 栈不封顶** → 封顶 2 条。它是 `fixed top-3` 浮层，一条 74px、活 3.4s；
   实测 3 条就盖到 y=250，而**农场第一排地块从 y=195 起** —— 收获特效可见率
   当场掉到 **31%**（平板 71%）。2 条时浮层底边 y=168，不碰地块。
   **上限是按「别碰到地块」量出来的。**
2. **`e2e-upgrade.mjs` 的目标版本写死成 50**（「声明 v5」），v6 落地后（`262f23d`）
   一直是红的。现在版本号和表名都从 `src/db/db.ts` **读**出来 —— 再加 v7 不用回来改。
   顺带修掉它自己踩的 `const URL = ...` 遮住全局 `URL` 构造器的坑（`new URL` 直接抛）。

**验收（全部对同一份 dist）**

    npm run lint                  干净
    npm test                      566 条 / 24 文件
    capture-harvest-fx.mjs        22 条 × 2 档视口（逐帧采遮挡 + 探针自检）
    e2e-check.mjs                 120/120
    e2e-gameplay.mjs              57/57
    e2e-regressions / bag-sell / upgrade / wipe   35 / 23 / 12 / 18
    capture-animals / games / sky                 全绿
    包体                          621.6 KB raw / 185.2 KB gzip（+1.0 KB / +2.0 KB）

> ★★ **这一批最值钱的教训：状态存在 ≠ 用户走得到那个状态。**
> 收获特效做成了，但它的邻居「浇水特效」查下去发现：`fertilizer` 只从道具掉落来，
> 而 `itemDropsEnabled` **默认 false**、商店不卖、没有开局礼 ⇒ 默认配置下
> 孩子点成长中的地**永远**得到「没有神奇肥料了」。**画它等于画一幅没人看得见的画。**
> ➜ 动手前先问「这个状态**谁**能触发？默认配置下能吗？」，答案要能在代码里指出来。
>
> ★★ **遮挡探针的加固（第二条教训的三个变种）**：① 只测一帧会漏掉峰值帧
> （900ms 动画里最高的一帧比静止位置高 12px）→ 改成**逐帧采、取最差**；
> ② 探针要**自检**（临时盖全屏遮罩 → 可见率必须掉到 0%，拿掉又回 100%），
> 否则「探针烂掉」和「没被盖住」长得一模一样；③ 前 ~100ms 弹层遮罩还在
> （`harvest()` 内部 await 了 refresh），那几帧特效本身 `opacity:0`，不算被盖住。
> 先红后绿的证据：把 toast 封顶去掉 → 手机 **31%** / 平板 **71%**、退出码 1。

---

## 12. 平台化：游戏的**独立分发**（2026-10-15 提案）

家长原话：

> 「最终 我希望的是 app 最后成为平台。设置 游戏里 可以 展示新的游戏。用户可以点购买下载。
> 所以我需要游戏能够比较独立。游戏也在项目里。以后会添加更多的游戏。
> 但是允许用户独立更新下载。第一次安装只是农场。以免包太大了。」

### 12.1 现状 vs 目标（哪些已经对了，哪些是假的）

| 目标 | 现状 | 判据 |
| --- | --- | --- |
| 游戏之间互相独立 | ✅ **已经对了** | 各自的账本表、各自的页面、互不 import（§4.3 / §10 的环） |
| 第一次安装只有农场 | ⚠️ **只是碰巧** | 现在确实只有农场能玩，但那是因为**别的游戏还没做**；构建上所有游戏都打进同一个包（`pages.ts` 静态 `Record<id, ComponentType>`） |
| 独立下载 / 独立更新 | ❌ **做不到** | 没有任何下载路径；App **零网络请求**（`grep -rn "fetch(" src/` 为空） |
| 包体不随游戏增长 | ❌ **做不到** | 加一个游戏 = 重打 APK |

**已经就位的底座**（这部分不用动）：`@capacitor/filesystem` 已在用（`src/platform/files.ts`）、
`INTERNET` 权限已在 manifest、Capacitor `webDir: dist` / `allowMixedContent: false`、
游戏有自己的账本与命名空间、`buyGame` 的扣款守卫已在事务里。

### 12.2 ★★ 先解决这个：现有数据模型**装不下**下载来的游戏

§4.3 说「表名带 `<gameId>.` 前缀（`claw.prizes`）」。但表**必须声明在 `src/db/db.ts` 里**，
而 `db.ts` 是**打进 APK 的编译产物**（`this.version(N).stores({...})` 是固定列表，
`scripts/e2e-upgrade.mjs` 就是解析它来对账的）。

> **⇒ 下载安装的游戏无法给自己建表。** 不解决这条，「独立下载」就是假的 ——
> 每个新游戏仍然要发一次 APK。

两条出路，**建议同时支持、按需选**：

| 方案 | 机制 | 好处 | 代价 |
| --- | --- | --- | --- |
| **(a) 宿主通用表**（默认） | 宿主加一张 `gameKv: { key, value }`，key = `${gameId}:${k}` | `exportBackup` / `importBackup` **天然覆盖**，零额外工作 | 游戏拿不到索引查询，只能整块读写 |
| **(b) 游戏自带 IndexedDB** | 游戏 bundle 里自带 Dexie，运行时开**自己的库** | 真正独立、可以有自己的表结构 | 宿主 `exportBackup` **枚举不到**它 ⇒ 游戏**必须**实现 `exportData()` / `importData()` |

⚠️ 选 (b) 却不实现导出钩子 = **备份静默丢数据**，正是本项目最忌讳的那类 bug
（「同一个事实存两份就一定会走散」的同族）。所以 (b) 的钩子是**强制**的，且要有断言钉住。

### 12.3 三种分发方案（技术选型）

| 方案 | 怎么做 | 适配本项目？ |
| --- | --- | --- |
| **A. 远端 ESM + blob 加载**（**推荐**） | 每个游戏**独立 Vite 构建**成自包含 ESM；下载 → 校验 → 存 Filesystem → `Blob` + `import()` | ✅ 与 sideload APK 兼容，浏览器里就能验 |
| **B. iframe 小程序** | 每个游戏是一个下载来的 HTML，塞进 `<iframe>`，`postMessage` 通信 | ✅ 隔离最强；但边界重，游戏得自己管整页 |
| **C. Play Feature Delivery** | Android 官方的「按需下载模块」 | ❌ 要求走 **Google Play**；本项目是 GitHub Releases 分发 sideload APK |
| **D. 只下数据、不下代码** | 游戏 = 数据，引擎内置在 APK | ✅ 最安全最小；但游戏形态被限死 |

**推荐 A**。加载机制（关键：blob URL 继承页面 origin，绕开 CORS / 混合内容）：

```ts
const code = await fetch(url).then((r) => r.text())
await assertSha256(code, expected)                       // 见 12.4，不可省
await Filesystem.writeFile({
  path: `games/${id}/${version}/game.js`,
  data: code, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true,
})
const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
const mod = await import(/* @vite-ignore */ blobUrl)
mod.default.mount(container, hostApi)                     // 见 12.5
```

⇒ 因为 blob 模块**不能有裸模块说明符**，每个游戏必须打成**单文件自包含** ESM
（自带 React / 自带依赖）。这正好也把「游戏和宿主零耦合」变成物理事实。

### 12.4 ★ 安全：不可让步的一条

**下载并执行远端 JS = 在这个 App 里执行任意代码**，而它握着孩子的数据、还能写文件系统。所以：

1. 必须 HTTPS（`allowMixedContent: false` 已经堵了 http 降级）；
2. `catalog.json` 里每个游戏带 **SHA-256**，**安装前校验**；
3. `catalog.json` 本身用 **Ed25519 签名**（`catalog.json.sig`），公钥**烧进 APK**。

> 不做 2 / 3 = **谁拿下那台静态服务器，谁就能在孩子的手机里跑任意代码**。
> 这不是「以后再加」的项，是 P2 的准入条件。

### 12.5 运行时契约 v2（【提案】，取代 §4.2 的 `Page: React.ComponentType`）

```ts
interface GameBundle {
  manifest: {
    id: string; name: string; emoji: string; tabLabel: string
    version: string          // 语义化版本，用于「可更新」判断
    minHostApi: number       // 见下
    coin: { id: string; name: string; emoji: string }
    economy: { playCost: number; expectedPayout: number; capPerPrize: number }
  }
  /** 挂到一个容器里；返回卸载函数（切走 / 卸载游戏时调用） */
  mount(container: HTMLElement, host: HostApi): () => void
}

interface HostApi {
  spendPoints(n: number, memo: string): Promise<boolean>
  mintGameCoin(n: number, memo: string): Promise<void>
  storage: { get(k: string): Promise<unknown>; set(k: string, v: unknown): Promise<void> }
  /** 只有选 12.2(b) 的游戏需要实现 */
  exportData?(): Promise<unknown>
  importData?(d: unknown): Promise<void>
  pushToast(t: { kind: string; title: string; detail?: string }): void
  haptic(): void
  tone(kind: string): void
}
```

**两点变化，都是有意的**：

- **不再传 React 组件，传「容器 + 纯数据 API」**。游戏可以用任何框架、自带 React、
  和宿主零耦合 —— 顺手把 §10 那个「注册表不能 import 页面组件」的环**从根上解掉**。
- **`minHostApi` 版本门**：宿主声明 `HOST_API`，游戏声明它要求的最低版本；
  不匹配就**拒绝安装 / 提示升级 App**。没有这道门，一次游戏更新就能把宿主搞崩。

### 12.6 离线与降级（现在是零网络应用，别把它弄丢）

- **农场永远内置**，离线永远可用（它是首款、免费、默认拥有）；
- 已下载的游戏**存本地**，离线可用；
- 拉不到 `catalog.json` → **只显示已安装的**，不报错、不空转、不摆灰按钮
  （沿用 §2.1 末尾那条纪律：不承诺做不到的事）。

### 12.7 分阶段路线

| 阶段 | 做什么 | 能不能只靠浏览器验 |
| --- | --- | --- |
| **P0** | 拍板：游戏包放哪 / 上不上 Play / 隔离模型（A 还是 B） | — |
| **P1** | 让「游戏」**真的可插拔**：独立构建产物 + `mount()` 契约 + 通用存储 + 导出钩子。**先不做下载** | ✅ 能（本地路径先当「已安装」） |
| **P2** | 下载与安装：catalog + 哈希/签名校验 + Filesystem + 从存储加载 + 设置页（商店 / 已安装 / 可更新 / 卸载） | 部分（浏览器用 fetch 模拟） |
| **P3** | 更新与回滚：原子安装（临时目录 → 校验 → 替换）、加载失败回滚、`minHostApi` 门 | 部分 |
| **P4** | **发币入口**（付费 / 兑换码）—— 没有它「购买」永远点不通 | ✅ 能 |

> ⚠️ **P1 是关键**：它不涉及网络，却把「宿主 ↔ 游戏」的边界从「同一份构建」改成
> 「运行时装配」。**P1 做完，P2 只是加一条下载管道**；P1 不做，P2 无从下手。
>
> ⚠️ P4 与 §2.1 是同一件事 —— 现在「购买」按钮走不到，就是因为没有发币入口。

### 12.8 需要家长拍板的五件事

1. **游戏包放哪？**（GitHub Releases / 对象存储 / 自建）—— 项目目前**没有任何后端**；
2. **上不上 Google Play？** —— 决定能不能用官方的按需下载（方案 C）；
3. **游戏存储走 (a) 还是 (b)？**（建议：默认 (a)，允许 (b)，(b) 强制实现导出钩子）
4. **接受「App 从零网络 → 需要网络拉目录」吗？**（离线仍可用，但产品语义变了）
5. **首批几个游戏、单包体上限多少？**（现在整包 185 KB gzip，§6.5 给美术的上限是 +15 KB gzip）
