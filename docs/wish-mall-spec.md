# 心愿商城 设计

> 2026-10-28 起草，同日按用户口径重写为 v2。
>
> **v2 的核心变化**：心愿商城不是「兑换」的扩展，而是一个**独立的第五个 tab**。
> 它卖的是**外面世界的东西**（合作商商品 + 游戏），用的是**兑换券**，
> 成交发生在**淘宝/天猫/京东/闲鱼**，App 只做「意向 → 定价 → 兑换 → 引导购买」这条链。

---

## 0. 一句话

**孩子用兑换券表达想要，家长用兑换券定价，成交在 App 外面。**
App 不做收银台，也不代收货款。

---

## 1. 三套币的分工（这是整个设计的地基）

| 币 | 来源 | 去处 | 谁定价 |
| --- | --- | --- | --- |
| **积分** 🪙 | 任务 / 签到 / 农场 | **家庭内兑换**（零食、玩平板、出去玩） | 家长 |
| **兑换券** 🎫 | 农场产出 / 玩插件游戏 | **心愿商城**（游戏、实物礼物） | 家长 |
| **钻石** 💎 | 支付 / 兑换码（**当前仅测试**） | 直接买游戏 / 商品 | 运营 |

**三者之间一条通路都没有。** 这不是约定，是表结构保证的：
`ledger` / `harvestLedger` / `mallLedger` 三张表物理隔离，`currentBalance()`
只看得到 `db.ledger`，`currentHarvestBalance()` 只看得到 `db.harvestLedger`。

> ⚠️ 任何两条币之间的双向通路都是印钞机。加任何新边之前先读
> `types.ts` 里 `HarvestEntry` 那段注释。

**为什么心愿商城用兑换券而不是积分**：兑换券只能靠「玩」和「农场产出」赚，
积分靠「完成任务」赚。心愿商城卖的是玩具和游戏 —— 用「玩出来的钱」买「玩的东西」，
闭环是自洽的。而积分对应的是家长给的日常奖励，用去买 ¥69 的盲盒会让家长觉得
「我发出去的分变成了我的账单」。

---

## 2. 和「兑换」的区别（用户的核心诉求）

| | 兑换（现有，不动） | 心愿商城（新） |
| --- | --- | --- |
| 位置 | 底栏第 3 格 | **底栏第 4 格** |
| 商品 | **家长自己加的**，已经确认能兑现 | **合作商/运营提供的**，家长要先「开放」 |
| 币 | 积分 + 兑换券混付 | **只用兑换券** |
| 兑现方 | 家长本人（给零食、开平板） | **淘宝/天猫/京东/闲鱼** |
| 孩子能做什么 | 直接换 | **只能先表明意向** |

一句话：**兑换是家里的事，心愿商城是外面的事。**

---

## 3. 商品与分类

分类 tab（横向 chips，可滑动）：`全部 · 盲盒 · 游戏 · 玩具 · 学习 · 收藏`

**「全部」里游戏盲盒置顶**（用户要求：优先显示游戏盲盒）。

| 类型 | 是什么 | 兑换后发生什么 |
| --- | --- | --- |
| `blindbox` 游戏盲盒 | 随机开出 **1 款孩子还没有的**游戏 | App 内直接解锁，当场开箱 |
| `gamebox` 单个游戏 | **指定**某一款游戏 | App 内解锁那一款 |
| `toy` / `study` / `collectible` | 实物商品 | 家长去外链买，买好回来确认 |

> ⚠️ **`gamebox` 在界面上就叫「游戏」，不叫「盒子 / 指定款」**（用户 2026-10-28 原话：
> 「单个游戏就是游戏 不是盲盒」）。内部字段名保留 `gamebox` 是为了不动数据结构。
> 点进一款游戏时，摆的是**和「设置 → 游戏 → 详情」同一份内容**：手绘图标、版本、
> 适龄 / 一次多久 / 包多大、截图（可点开放大）、练什么、关于这款游戏。
> 只给一颗 emoji + 一句话，家长判断不了该不该让孩子攒券换。

### 盲盒的三条硬约束

1. **池子里只放孩子还没有的游戏**。全都有了就不能买 —— 按钮显示「全都玩过了」，
   不要让人抽到一个空盒。
2. **池子空了要能优雅收场**：随机前先算 `pool ∩ 未拥有`，为空直接拒绝，
   **不要先扣券再发现没得开**。
3. **盲盒不能比盒子便宜太多**。否则所有人都买盲盒、没人买指定款，
   而盲盒的期望成本是一样的 —— 定价上盲盒应当**略便宜**（10~20%），
   而不是便宜一半。这条写在这里是因为它只在数值上看得出来，代码里看不出来。

---

## 4. 状态机

```
（商品层）locked ──家长定价──▶ open
                                  │
（订单层）wished ──孩子确定兑换──▶ committed ──家长确认──▶ confirmed ──▶ done
   ▲                                  │
   └────────── 取消（退券）─────────────┴──▶ cancelled
```

| 状态 | 谁推进 | 券 | 说明 |
| --- | --- | --- | --- |
| 商品 `locked` | — | — | 家长还没开放。孩子只能「想要这个」 |
| 商品 `open` | 家长 | — | 已定价，孩子可以换 |
| `wished` | 孩子 | 不动 | 只是意向，随时可撤 |
| `committed` | 孩子 | **扣掉** | 已兑换，等家长确认 |
| `confirmed` | 家长 | 不动 | 家长已去外链购买 |
| `done` | 家长 | 不动 | 买好了 / 收到了 |
| `cancelled` | 家长 | **退回** | 买不成、不想要了 |

⚠️ **商品层的 `open` 是「本家庭的设置」，不是商品的全局属性。**
`WishItem` 是常量目录，`open` + `voucherPrice` 存在 `WishOffer` 表里。
不要往常量里写可变状态。

### ⚠️ 数字商品和实物共用这套状态，但**文案必须分叉**

盲盒 / 盒子在**兑换那一刻就交付**（当场开箱、当场装包），实物才要等爸妈去淘宝买。
两者都停在 `committed`，界面上却必须是两句话：

| | 交付时点 | `committed` 的意思 | 界面上该说 |
| --- | --- | --- | --- |
| 盲盒 / 盒子 | 兑换当场（`openedGameId` 就是凭证） | 东西**已经给了**，只差家长收尾 | 「已经放进你的游戏柜了」 |
| 玩具 / 学习 / 收藏 | 家长买完、点「已经买好了」 | 等家长去外链买 | 「等爸妈确认」「确认兑换 · 去购买」 |

判据是 `order.openedGameId`（装包成功才会写），不是 `kind` —— 盒子装包失败
会走 `wishCancel` 退回，那种单子本来就不该显示成「已交付」。

反例（2026-10-28 走查抓到的）：孩子刚开完箱、游戏已经能玩，列表上挂着
「等爸妈确认」，点进详情先撞一道家长密码「确认兑换需要密码」，底下按钮
写着「去购买」。三句话单独看都合法，合起来自相矛盾，而结构断言全绿。

### ★ 家长待办：`wished` 也算（2026-10-29）

家长原话：「现在心愿商城里 已告诉爸爸妈妈，爸爸妈妈如何处理。」

改动之前，心愿商城的待办卡**只收 `committed` / `confirmed`** —— 也就是
孩子**已经花掉券**的单子。于是孩子点完「🤍 想要这个」、他那一侧写着
「已经告诉爸妈，等他们定价」，家长那一侧却**一片安静**：没有红点、
没有卡片，商品卡上只是标签从「等爸妈开放」变成「已告诉爸妈」。

现在分成两张卡，因为**该做的动作不一样**：

| 状态 | 卡 | 家长要做的 | 出口 |
| --- | --- | --- | --- |
| `wished` | 「有 N 个心愿等你回应」 | 定价，或者这次先不换 | `wishSetOffer` / `wishCancel` |
| `committed` / `confirmed` | 「有 N 单在等爸妈处理」 | 去外链买，或者收尾 | `wishConfirm` / `wishDone` |

⚠️ 合成一张卡的话，文案只能写成「有 N 单等你处理」，等于什么都没说。

⚠️ **`wished` 必须有「不换」这个出口**。没有它，孩子的心愿会永远停在
「等他们回应」—— 他既不能自己撤回，家长也没有拒绝的选项。
走 `wishCancel`（事务内重读状态；对 `wished` **不碰账本**，还没扣过券），
`cancelReason` 写「爸妈这次先不换」，在**兑换记录**里对孩子可见。

---

## 5. 券的扣与退（唯一会碰账本的地方）

```
孩子确定兑换： delta = -price, source = 'wish_redeem', memo = '兑换：XX'
家长取消：     delta = +price, source = 'wish_refund', memo = '取消兑换退回：XX'
```

需要给 `HarvestSource` 加两个值：`wish_redeem` / `wish_refund`。

### 为什么必须真扣（而不是像积分那样只做门槛）

因为**成交在 App 外面**。券如果不扣，孩子可以同时挂 10 个「已兑换」，
家长每个都要去淘宝买 —— 那是灾难。

### 防重复退款

取消必须在**事务内**先读 `status`，只有 `committed` / `confirmed` 才允许转 `cancelled`。
不要靠按钮 disabled —— 两个标签页同时点会各退一次。

### 券不够怎么办

**不混付。** 兑换（家庭内）允许「券 + 积分」，心愿商城**只收券**。
理由：混付会让「积分能不能换实物」变成一个是非题，而它应该是「不能」。

券不够时按钮是灰的，写「还差 12 张」。

### 数字商品的「拥有」必须有一份卸载不掉的记录

游戏类商品（盲盒 / 盒子）的交付 = **装包**，而「拥有」一直是从
`installedGames` 派生的。问题是 `uninstallGame` 会把包**和存档**一起删掉
（`clearGameKv`）—— 删完之后这个游戏既不在 `installedGames`，
也不在 `ownedGameIds`（心愿商城不走钻石账本）：

| 后果 | 表现 |
| --- | --- |
| 盒子卡片变回可兑换 | 孩子**再扣一次券**，游戏重装一遍 |
| 盲盒池子把它放回去 | **再开出来一次** |

全程不报错，账面上是两笔合法的 `wish_redeem`。券是真金白银攒的，
卸载一次就白扣一次。

**规矩：**「拥有」= 账本买过 ∪ 现在装着 ∪ **心愿单里兑换到手过的**
（`redeemedGameIdsFrom(wishOrders)`，取 `committed` / `confirmed` / `done`
且带 `openedGameId` 的）。

两处必须用**同一个**派生函数：`wishRedeem` 的闸门、`WishPage` 的
「已经有了」判断。各写一遍就会变成「卡片说能换、点下去被拒」或反过来。

⚠️ 实物**不适用**：同一个玩具买第二次是合理的，所以只有带
`openedGameId`（数字交付）的订单参与计算。

### 取消 = 撤销交易，所以**游戏要一起收回**

不变量只有一条：**券和游戏不能同时到手。**

| | 券 | 游戏 |
| --- | --- | --- |
| `committed` / `done` | 扣着 | 装着 |
| `cancelled` | 退回 | **必须收回** |

不收回会同时踩两个坑：白拿一个游戏；而且取消之后 `redeemedGameIdsFrom`
不再认它（`cancelled` 不算），孩子还能**再兑换一次**。

**收回用 `detachGameKv`（只删 `__bundle` / `__assets`），不是 `clearGameKv`。**
撤销的是这笔交易，不是孩子玩出来的进度 —— 家长点「取消」的动机通常只是
「价格定错了」，不该顺手把存档抹掉。存档留着，将来重新兑换能接着玩。

⚠️ 界面上**必须先说清楚**（「取消会把游戏收回，进度保留」），否则游戏
从孩子的游戏柜里消失而家长毫无预期。

⚠️ `wishRedeem` 装包失败时也走 `wishCancel`：那时 `gameKv` 里没有包，
`detachGameKv` 删 0 行，无副作用 —— 别为这条路再分叉出一个「不收回」的参数。

---

## 6. 外链与码

### 外链

商品带 `buyUrl`（淘宝/天猫/京东/闲鱼）。**只在家长确认页出现**，孩子端看不到。

点了就是 `window.open(buyUrl)`，App 不知道也不关心成交结果 ——
家长回来点「已经买好了」才算 `done`。

⚠️ 文案必须写清楚 **「App 不代收货款」**。本项目最忌讳界面承诺它做不到的事。

### 码（P2，✅ 2026-10-29）

游戏之后也会上淘宝：用户付款 → 拿到码 → 在 App 里输码解锁。

- `MallSource` 里**已经留了 `redemption_code`**
- `purchasedIdsFrom()` 必须一起改 —— 它对 `redemption_code` **不看 delta**
  （码解锁的 delta 恒为 0，写 0 是事实）。只看 `game_purchase && delta < 0`
  的话，码解锁了游戏却不显示「已拥有」，而且**零报错**
- 码表只存 `sha256`，不存明文；已用码进 `wishCodes` 表防重

#### 实现要点（改这块之前先读）

| 件 | 在哪 | 干什么 |
| --- | --- | --- |
| 格式 | `src/domain/gameCode.ts` | 6 位 Crockford Base32（去掉 I L O U），手输友好：`I`/`L`→`1`、`O`→`0` |
| 码表 | `src/games/codeTable.ts` | **生成文件**，`{ sha256: gameId }`。反推不出明文 |
| 查表 | `src/games/codeLookup.ts` | 归一化 → sha256 → 查表 |
| 发码 | `scripts/mint-codes.mjs` | 写码表 + 明文清单（`scripts/_codes-*.txt`，gitignored），**写完自检** |
| 兑换 | `useApp.redeemGameCode` | 查重 → 记 `wishCodes` → 记账本（delta 0）→ 装包 |

**四件「不烧码」的事**：格式不对 / 表里没有 / 本机用过 / 已经有了 /
这个版本没有这款游戏。码是一次性资源，浪费一张少卖一张。

**装包失败要退码**：事务提交之后才装包（网络 + 执行不能塞进 Dexie 事务），
装失败就把 `wishCodes` 和账本那两行删掉。否则孩子拿到「装包失败」而码已经没了。

⚠️ **防重只在本机**。没有账号、没有服务器 ⇒ 文案里不许写「一次性」。
换台设备可以再用一次。

---

## 7. 数据模型

```ts
type WishKind = 'blindbox' | 'gamebox' | 'toy' | 'study' | 'collectible'

/** 商品目录：TS 常量，不入库 */
interface WishItem {
  id: string
  kind: WishKind
  name: string
  emoji: string
  tint: 'sun' | 'grass' | 'sky' | 'grape' | 'tan' | 'berry'
  partnerName?: string
  /** blindbox 的池子（游戏 id 列表） */
  pool?: string[]
  /** gamebox 指定的游戏 id */
  gameId?: string
  /** 参考零售价（分）。**只展示，不参与计算** */
  priceCents?: number
  ageRange?: [number, number]
  notice?: string
  /** 外链，只在家长确认页出现 */
  buyUrl?: string
  buyLabel?: string
  archived?: boolean
  sortOrder?: number
}

/** 家长对本商品的开放设置（可变状态，入库） */
interface WishOffer {
  itemId: string
  voucherPrice: number
  /** 钻石价，测试用；0 / 不填 = 不卖 */
  diamondPrice?: number
  openedAt: number
  closedAt?: number
}

interface WishOrder {
  id: string
  itemId: string
  // 快照：商品改名/下架后历史仍可读
  itemName: string
  itemEmoji: string
  kind: WishKind
  partnerName?: string
  voucherPrice: number
  /** 盲盒开出的是哪一款（只在 blindbox 上有） */
  openedGameId?: string

  status: 'wished' | 'committed' | 'confirmed' | 'done' | 'cancelled'
  vouchersHeld: number

  codeTail?: string
  codeHash?: string

  ship?: ShipInfo
  trackingNo?: string

  createdAt: number
  committedAt?: number
  confirmedAt?: number
  doneAt?: number
  cancelledAt?: number
  cancelReason?: string
}

interface ShipInfo {
  receiver: string
  phone: string
  region: string
  address: string
  note?: string
  /** 到期自动抹除，见 §9 */
  purgeAfter: number
}
```

Dexie v9 新增三张表：
`wishOffers`（`itemId`）、`wishOrders`（`id, itemId, status, createdAt`）、`wishCodes`（`hash`）。

设置项：`wishMallEnabled`（默认 **false**，家长主动开）。

---

## 8. 界面

底栏从 4 格变 **5 格**：`任务 · 游戏 · 兑换 · 心愿 · 积分`。

⚠️ 底栏现在是 `grid-template-columns: repeat(5,1fr)`。390px 上每格 78px，
图标 19px + 文字 10.5px 放得下。**这是布局改动，不是加个按钮** ——
e2e 里所有按索引取 tab 的地方都要复查。

七屏（稿子见 `docs/mockups/wish-mall.html`）：

1. **商城列表** — chips 分类 + 盲盒 hero 置顶 + 两列卡片
   + **待家长处理入口**（有 `committed` / `confirmed` 单子时出现在顶部，
   写清「有 N 单在等爸妈处理」和是哪些商品）
2. **详情 · 未开放** — 只有「想要这个」
3. **已表明意向** — 等家长定价
4. **详情 · 可兑换** — 券价 + 进度 + 「用 N 张兑换」
5. **家长 · 定价** — 步进器 + 「孩子最近 7 天赚了多少」参考
6. **家长 · 确认购买** — 外链按钮 + 「已经买好了」
7. **开盲盒** — 开出结果
8. **单个游戏详情** — 图标 + 版本 + 适龄/时长/体积 + 截图（点开放大）+ 练什么
   + 关于这款游戏，**和「设置 → 游戏 → 详情」是同一份内容**；
   兑换按钮在上、说明在下（不让说明把「现在能不能换」挤出第一屏）
9. **兑换记录** — 列表页右上角进入，按时间倒序列出 `wishOrders`（最近 50 条），
   每行写清「什么时候 / 花了多少张 / 现在到哪一步」。
   ⚠️ **这一屏是 `done` / `cancelled` 唯一的可见处**：卡片只显示还没走完的单子
   （`activeOrderOf`），待办入口只算 `committed` / `confirmed` —— 没有它，
   孩子换到手的东西过一天就查不到「我到底换过没有」。

⚠️ **待处理入口只跳「商品详情」，不直连确认页**：确认页上有「取消兑换」
和「去商店购买」，而密码闸门只渲染在详情页底部 —— 直连等于让孩子绕开
家长密码（2026-10-28 在详情页右上角那个入口上踩过一次）。

### 价格怎么显示（财商教育）

孩子端**显示参考价**，但必须满足两条：

1. **和券价不在同一行**，中间隔一层（分隔线 / 留白）
2. 价格旁写 **「家长支付」**

理由：`80 张` 和 `¥69` 并排，孩子会自己算出 1 张 ≈ ¥0.86 —— 这是算术本能，
挡不住。能挡住的只有**归属**：「我攒券，爸妈付钱」。两个主体、两件事，比率就不成立。

绝对不许出现：「1 张 = ¥x」「你省了 ¥x」。

---

## 9. 隐私

收货人 + 手机 + 家庭地址，绑在儿童账号上 = 敏感个人信息。

1. **备份里不能有 `ship`**。`exportBackup()` 是逐表列举的，新表默认不导出 ——
   真实风险是有人为了保住兑换历史把 `wishOrders` 整表塞进去，顺手带出地址。
   导出前 strip 掉 `ship`，只留 `region` + `phoneTail`。备份 `version` 2 → 3。
2. **完成 30 天后自动抹除**：`ship` 降级成 `{ region, phoneTail }`。启动时扫 `purgeAfter`。
3. **不进日志 / toast / 埋点**。
4. **孩子端完全看不到** `ship` 和 `buyUrl`。

---

## 10. 分期

| 期 | 内容 | 状态 |
| --- | --- | --- |
| P1 | 商品目录 + 列表/详情 + 意向 + 家长定价 + 兑换（扣券/退券）+ 外链确认 | ✅ 2026-10-28 |
| P1.5 | 游戏盲盒 / 盒子（App 内解锁）+ 开箱页 + 数字商品的交付文案 | ✅ 2026-10-28 |
| P2 | **码解锁**（`redemption_code` + `wishCodes` 表 + `purchasedIdsFrom` 一起改） | ✅ 2026-10-29 |
| P3 | 收货信息、快递、自动抹除、服务端 | ⬜ 未做 |

> ⚠️ 码解锁不是「加个输入框」：`purchasedIdsFrom()` 现在只认
> `source === 'game_purchase' && delta < 0`，加 `redemption_code` 时必须**一起改**，
> 否则码解锁了游戏却不显示「已拥有」，而且零报错（见 §6）。

---

## 11. 验收判据

> **2026-10-28：P1 全部通过。** 每条后面标的是**判据在哪**——
> 以后改这块代码，先跑对应的那一条，别凭「我改得很小心」。
> 命令：`npm test`（单测）· `node scripts/e2e-wishmall.mjs <url>`（本功能走查）
> · `node scripts/e2e-check.mjs <url>`（全站回归）· `node scripts/e2e-upgrade.mjs <url>`（老库升级）

- [x] 孩子确定兑换后余额**真的**少了 `voucherPrice`，且流水有一条 `wish_redeem`
      —— `e2e-wishmall` ③（100 → 70，订单 `committed`，`vouchersHeld` = 30）
- [x] 取消后余额**真的**回来，且**只有一笔** `wish_refund`（两标签页同时点也只退一次）
      —— `e2e-wishmall` ④（退款流水恰好 1 笔）；防重复退款在事务内重读 `status`
- [x] 取消**已交付游戏**的订单时，游戏要一起收回（只摘安装、**保留存档**）
      —— `useApp.test.ts` ⑦：退券后 `__bundle` 消失、插件存档还在；
      实物的取消页**不许**出现「收回游戏」的提示 —— `e2e-wishmall` ④
- [x] 兑换来的游戏**卸载之后**不能再兑换一次
      —— `useApp.test.ts` ⑥（`redeemedGameIdsFrom` 兜住，判据是
      「不许出现 `wish_redeem` 流水」，不是文案）
- [x] 券不够时按钮是灰的，不出现「券 + 积分」混付
      —— `e2e-wishmall` ⑧（把价格抬到 9999，按钮 `disabled` +「还差 N 张」；
      混付判据只看那颗按钮，不看 `body.innerText`——顶栏本来就有 🪙）
- [x] 盲盒池子里没有孩子已拥有的游戏；全拥有时不能购买
      —— `domain/wish.test.ts`（`blindBoxRemaining` / `pickBlindBox`）
      + `useApp.test.ts` ⑤（池子买空后 `wishRedeem` 返回 `ok:false`）
- [x] 盲盒「先算池子再扣券」：池子为空时不产生任何流水
      —— `useApp.test.ts` ⑤：**余额、`wish_redeem` 流水条数、订单条数三样都不许变**
      （只钉「返回 ok:false」是不够的：算池子挪到扣券之后，那条断言照样绿）
- [x] 孩子端 DOM 里 `grep` 不到 `buyUrl` 和 `ship`
      —— `e2e-wishmall` ②③（列表页和详情页的 `body.innerHTML` 都没有 `taobao`）；
      `buyUrl` 只在家长确认页被 `window.open`，从不写进 `href`
- [x] 价格与券价不在同一行，且价格旁有「家长支付」
      —— `e2e-wishmall` ⑨（比两块元素的 `getBoundingClientRect()`：
      参考价底部 ≤ 券价顶部）
- [x] `grep` 不到「1 张 = ¥」形式换算
      —— `e2e-wishmall` ⑨（正则 `1\s*张\s*[=≈]\s*[¥￥]`，另外也拦 `¥x/张`）
- [x] `exportBackup()` 产物里 `grep` 不到完整手机号 / 门牌号
      —— `useApp.test.ts` ④（**字符串级**：在 `JSON.stringify(backup)` 里搜
      姓名/手机/门牌，字段改名或嵌套都逃不掉）+ `e2e-check` 导出段（`"ship"` 这个 key 不存在）
- [x] 老库升级到 v9 后，`redeemItems` / `redeemRecords` 一条不少
      —— `e2e-upgrade`：造一个 v4 老库并**种进**一条兑换商品 + 一条兑换记录，
      升级后按 id 找回来（判据是 `some(id)` 不是条数——App 会自己补默认商品）
- [x] 底栏 5 格在 390px 下不挤、不换行
      —— `e2e-wishmall` ⑩（右边界 ≤ 390、无横向溢出、**5 个 label 都是单行**；
      只查「没溢出」是不够的：挤到换行也算「放得下」）
- [x] 数字商品兑换后，界面**不再说**「等爸妈确认」「去购买」
      —— `e2e-wishmall` ⑪（列表 / 详情两处都判）+ `WishPage.test.tsx`
      （3 条：列表说法、详情主内容不是密码闸门、实物那条**照旧**要去购买）
- [x] 数字商品的家长收尾：入口 → 密码 → 完成，订单到 `done` 且**券不退**
      —— `e2e-wishmall` ⑪（150 → 150、退款流水仍是 1 笔）+ `useApp.test.ts` ⑧
- [x] 开箱页真的拍进图集（新界面必须进 `capture.mjs`）
      —— `capture.mjs` 的 `10e-wish-box`
- [x] 有 `committed` / `confirmed` 单子时，列表顶部有「有 N 单在等爸妈处理」
      —— `WishPage.test.tsx`（4 条：出现 / 实物说法 / 处理完消失 / **点它只进详情**）
      + `e2e-wishmall` ⑪（收尾前出现、收尾后消失）
- [x] 待处理入口**不能**绕开家长密码
      —— `WishPage.test.tsx`：点它之后必须撞到「请爸爸妈妈来一下」，
      且确认页才有的「取消兑换」不许出现
- [x] 单个游戏在界面上叫「游戏」，**不出现**「盒子 / 指定款」
      —— `e2e-wishmall` ⑫（`body.innerText` 里 `grep` 这两词）+ `WishPage.test.tsx`
- [x] 单个游戏详情有截图 / 练什么 / 关于，截图能点开放大，放大层**盖住底部导航**
      —— `e2e-wishmall` ⑫（`elementFromPoint` 判命中，不是看 z-index）
      + `WishPage.test.tsx`（截图 caption / learn[0] 必须来自这款游戏自己的数据）
- [x] 换视图（列表 → 详情）**回到顶部**，不是停在上一页的滚动位置
      —— `e2e-wishmall` ⑫（`main.scrollTop === 0` + 返回按钮 `top < 200`）
- [x] 单个游戏详情进图集
      —— `capture.mjs` 的 `10f-wish-game`
- [x] `done` / `cancelled` 的单子能查到（不是消失了）
      —— `WishPage.test.tsx`（空态 / 两种结束状态都在 / 点一条回商品）
      + `e2e-wishmall` ⑬（3 单全在、取消那单还在、完成 2 单）
      + `capture.mjs` 的 `10g-wish-orders`

### P2 兑换码（2026-10-29）

- [x] 输对码 → 那款游戏变成「已拥有」并装好，账本有一笔 `redemption_code`、**delta 0**
      —— `redeemGameCode.test.ts`（`ownedGameIds` 含它 / delta 是 0 / 余额不变）
- [x] 同一个码第二次拒绝（换大小写、带不带横都算同一个）
      —— `redeemGameCode.test.ts`（先抹掉「已拥有」再试，否则停在更前面那道守卫）
- [x] 四种情况**不烧码**：格式不对 / 表里没有 / 已经有了 / 这个版本没有这款游戏
      —— `redeemGameCode.test.ts`（每一种都断言 `wishCodes` 还是 0 条）
- [x] 装包失败要把码退回来
      —— `redeemGameCode.test.ts`（`wishCodes` 0 条 + 账本没有那一行 + 不算已拥有）
- [x] 码表里没有明文，生成时用的字母表和 App 那份逐字相同
      —— `codeTable.test.ts` + `mint-codes.mjs` 的自检
- [x] 手输友好：`i`/`l`→`1`、`o`→`0`，大小写和分隔符都不计较
      —— `gameCode.test.ts`

### 家长待办：`wished` 也要看得见（2026-10-29）

- [x] 孩子点完「想要这个」，列表顶部出现「有 N 个心愿等你回应」
      —— `WishPage.test.tsx`
- [x] 家长锁开着时，详情里先是一道入口（不是直接给按钮）
      —— `WishPage.test.tsx`（没过密码看不到「这次先不换」）
- [x] 回绝之后单子真的结束（`cancelled` + `cancelReason`）
      —— `WishPage.test.tsx` + `e2e-wishmall`

### 走查抓到的、结构断言抓不住的问题（都已修）

| 现象 | 怎么发现的 | 为什么断言看不见 |
| --- | --- | --- |
| 年龄显示成「6–成人 岁」 | 截图走查 | 文案拼接错误，DOM 里字段都在 |
| 刚装的应用显示「每天赚 0 张」 | 截图走查 | 数字合法，只是没意义 |
| 21 个游戏盒子把商家商品挤到首屏外 | 截图走查 | 列表渲染完全正常，只是顺序错 |
| 孩子表过态、家长定价后仍显示「等爸妈定价」，**兑换按钮不出现** | e2e 走查（第 3 层） | 三个分支各自都对，组合起来才错 |
| 定价页替孩子说「孩子想要这个」 | 截图走查 | 文案写死，与真实状态无关 |
| 数字商品兑换完，列表挂着「等爸妈确认」、详情先撞家长密码、按钮写「去购买」 | e2e 走查（第 3 层，`_wish-digital-probe.mjs`） | 三句话**单独看都合法**，只有走完「兑换 → 收下 → 再点进去」才看得出矛盾 |
| 点开一款游戏，看到的是详情页**中段**（截图/练什么），名字和兑换按钮都在屏幕外 | 截图走查（`_wish-game-probe.mjs`） | 每个区块单独渲染都正常；问题在「换视图没重置滚动」，DOM 里看不出 |
| 游戏卡片和实物卡片长得一样（emoji 色块），家长分不清哪个是游戏 | 截图走查 | 结构上都是「一张卡 + 名字 + 标签」，只有并排看才觉得「游戏没被当游戏」 |
