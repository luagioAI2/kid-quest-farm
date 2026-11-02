# 在线版：接上 `tf-platform-api`

> 2026-10-29 起，这个 App 从「纯本地」开始往「有账号、有服务端」走。
> 本文只记**已经接通的**那一截，以及**为什么是这么接的**。
> 没接通的部分在文末列成清单，别当成已经做好了。

---

## 0. 一句话现状

| 能力 | 状态 |
| --- | --- |
| 注册 / 登录 / 退出 | ✅ 接通 |
| 招商申请（家长 / 商家两路） | ✅ 接通（客户端只发 `role`） |
| 后台审核 + 回填后台链接 | ✅ 服务端有，`/api/admin/merchant/*`（`X-Api-Token`） |
| **任务 / 任务实例 / 计时 / 提交 / 审核 / 签到** | ✅ **写穿**（2026-11-02，见 §7） |
| **积分（余额 + 流水）** | ✅ **服务端为准**（同 §7） |
| 农场状态（地块 / 动物 / 背包 / 行情） | 🟡 服务端接口已就绪（`/api/farm/state/*`），客户端**还没接** |
| 兑换 / 心愿 / 游戏币 / 插件存档 | ❌ 服务端有接口，客户端还没接 |
| tf-admin 的招商审核页面 | ✅ 已做（`/mall/merchant`） |

> **这个 worktree（`kid-quest-farm-online`）默认就是服务器版**
> （`sync/pull.ts` 里 `VITE_APP_MODE` 缺省即 online）。
> 本地 Dexie 从「唯一真相」降级成**读缓存**：
> 读 = 先把服务端拉进本地表再渲染，写 = 先打服务端，成功才 refresh。
>
> 还没上云的那几块（农场本体、兑换、心愿、游戏币、插件存档）**仍然只在本机**，
> 而且**不会**和服务端混算 —— 边界见 §7.4。

---

## 1. 目录

```
src/api/
  types.ts     服务端返回的形状（snake_case，别改成 camelCase）
  session.ts   登录态（localStorage，不进 Dexie）
  client.ts    唯一的 fetch 出口（错误码 / 超时 / 401）
  auth.ts      /api/auth/*、/api/user/profile
  merchant.ts  /api/merchant/*
src/store/useAccount.ts       登录态 store（动作返回 boolean，不抛）
src/features/account/
  LoginSheet.tsx              登录 / 注册弹层
  AccountCard.tsx             设置 → 规则 → 账号
```

---

## 2. 四条约定（违反其中任何一条，症状都是「静默」）

### 2.1 业务失败也是 HTTP 200

`tf-platform-api` 的返回长这样：

```json
{ "code": 607, "error": "scene为必填字段", "data": null }
```

**HTTP 状态码是 200。** 所以 `res.ok` 判断等于没判断 ——
`client.ts` 里唯一有效的判据是 `body.code === 200`。
写成 `if (!res.ok) throw` 的话，所有业务错误都会被当成成功，
`data` 是 `null`，然后在很远的地方炸成「Cannot read properties of null」。

### 2.2 `snake_case` 原样保留

`src/api/types.ts` 里字段名就是 `access_token` / `created_at` / `admin_url`。
**不做驼峰转换**：转一层就要维护一层映射表，而漏一个字段的表现是
「某个数字永远显示 0」，比直接看见 `undefined` 难查得多。

时间戳是 **Unix 秒**，不是毫秒。`humanizeAgo(app.created_at * 1000)`。

### 2.3 手机号在客户端是脱敏的

登录 / 资料接口返回的是 `138****8000`。所以：

- 界面上**只能显示**，不能回填到输入框里当联系方式用；
- 招商申请的 `contact` **必须服务端从账号取**（`merchant_srv.go` 的 `identity()`）。

客户端要是自己拼一个，审核的人拿到的是假号码，而且**没人会发现**。

### 2.4 动作不抛异常，返回 `boolean`

`useAccount` 里 `login` / `register` / `sendCode` 全部返回 `boolean`，
错误写进 `error` 字段。

理由：这是事件处理器里 `void login()` 调用的。抛出去没人接，
控制台一行红字，而**界面上什么反应都没有** —— 用户只会一直点。

---

## 3. 招商这一条链路（唯一完整闭环）

```
客户端「申请」（只发 role）
   ↓ POST /api/merchant/apply   {"role":"parent"}
服务端 identity() 补 name / contact（昵称 + 账号手机号）
   ↓ 状态 pending
后台 POST /api/admin/merchant/review
        {"application_id":5,"approve":true,"admin_url":"https://..."}
   ↓ 状态 approved + admin_url
客户端 POST /api/merchant/my
   ↓ admin_url **只在 approved 时返回**（服务端抑制，不交给客户端判断）
界面显示「已通过」+「↗ 打开后台」
```

### 3.1 为什么 `admin_url` 由服务端抑制

客户端要是自己判断「这个状态该不该渲染链接」，那么状态判断一错，
用户看到的就是一个写着「已通过」、点进去 404 的按钮 ——
看着像我们把他账号弄丢了。抑制放在服务端，客户端只管「有没有这个字段」。

### 3.2 为什么本地不再存一份

第一版（没有后端时）把申请存在 `settings.merchantApps`。现在删掉了。

两份状态一定会对不上，而对不上的表现是「界面写着审核中、后台其实已经通过了」——
**这种不一致没有任何测试能查出来**，只有用户来问。

### 3.3 未登录时这一屏只做一件事

说清楚为什么登录，给一个登录按钮。**不偷偷存本地假装成功** ——
家长会以为申请已经发出去了，然后一直等。

---

## 4. 本地怎么跑

```bash
# ① 后端（8080 在这台机器上被别的服务占着，用 8090）
cd tf-platform-api
go build -o tf-api.exe ./cmd/tf-api
TF_LISTEN=127.0.0.1:8090 ./tf-api.exe web      # 注意要 web 子命令，否则打印帮助就退出

# ② 前端
cd kid-quest-farm-2d
npm run build && npx vite preview --port 4401 --strictPort
```

### 4.1 验证码在哪

本地不发短信，验证码打在**服务端日志**里：

```
DEV SMS CODE	{"mobile": "138****8000", "scene": "login", "code": "473325"}
```

⚠️ `send-sms-code` 的 `scene` 是**必填**（`login` / `register` / …），
漏了会返回 `code: 607`。

### 4.2 后台令牌怎么来

`/api/admin/*` 用的是 HMAC 令牌（`X-Api-Token`），不是登录拿的 JWT：

```
base64url( "<unix秒>:<userID>:<hex(hmac_sha256(userID:unix秒, AdminSignKey))>" )
```

`AdminSignKey` 在 `configs/config.yaml`（该文件不进 git）。

### 4.3 验收命令

```bash
# 契约测试（真连服务端；默认 skip）
VITE_LIVE_API=1 npx vitest run src/api/live.test.ts

# 界面走查（真登录 + 真申请 + 拿界面状态去对服务端状态）
node scripts/_probe-online.mjs http://127.0.0.1:4401/ 390 844
node scripts/_probe-online.mjs http://127.0.0.1:4401/ 834 1112
```

⚠️ `_probe-online` 断言的是「**界面显示的状态 == 服务端返回的状态**」，
不是「点完一定显示审核中」。写死后者会在账号已被审过时假红，
而人第一反应是「我改的代码坏了」。

---

## 5. 游戏激活码这一条链路（2026-10-30）

家长在淘宝/天猫/京东买到游戏卡 → 卡背面一串激活码 → 输进
**设置 / 游戏 / 有兑换码？** → 服务端验码并授予游戏 → 那款游戏从
「心愿商城」消失、在「我的游戏」里变成已拥有。

```
心愿商城（家长确认页）
  └─ 「↗ 去商店购买」→ openExternal(buy_url)     ← 装了淘宝就直接进淘宝
        ↓ 家长自己付款，卡到手
设置 / 游戏 / 有兑换码？
  └─ redeemGameCode(code)
        ├─ 登录了  → POST /api/wish/redeem-code   ← 真相在服务端
        └─ 没登录  → 本机码表（离线 / 单测）
              ↓ 服务端一个事务里：验码 → 标记已用 → 写 user_game
        本地补一笔账本（source=redemption_code, delta=0）→ ownedGameIds 认它
              ↓
        插件包 installLocalGame(gameId)  → 装好就能玩
```

### 5.1 为什么本地还要补一笔账本

`ownedGameIds` 是从本地账本推的（`purchasedIdsFrom`），不是从服务端拉的。
服务端给了游戏但本地不记这一笔，「我的游戏」里就不显示已拥有 ——
而服务端明明已经给了。**delta 必须是 0**：码解锁一分钻石都没花。

### 5.2 三个「必须分开说」的失败

| 情况 | 家长该做什么 | 文案必须说明 |
| --- | --- | --- |
| 连不上服务器 | 过会儿再试 | **这张码没被用掉** |
| 登录过期 | 重新登录 | **这张码没被用掉** |
| 码无效 / 已用过 / 已过期 | 别再试了，找卖家 | 照抄服务端文案 |

合成一句「兑换失败」，前两种情况下家长会以为卡废了，再去买一张。

### 5.3 装包失败 ≠ 兑换失败

码已经在服务端用掉了，客户端回滚不掉。所以装包失败时**不能报失败** ——
报失败会让人以为码没用上。照实说「已激活，但没装成功，去「我的游戏」里点安装」：
已拥有是有出口的（点安装就行），码没了才是没出口。

### 5.4 服务端修掉的两个坑

1. **先判「是不是已经有了」再烧码**。原来是先 CAS 标记已用、再
   `ON CONFLICT DO NOTHING` 授予 ⇒ 孩子早就有了那款游戏时，码被烧掉、
   什么都没换到，界面还显示「兑换成功」。现在返回 `game-already-owned`
   （「你已经拥有这个游戏了」），码保留。
2. **`user_game.created_at` 落 0**。平台 `BaseModel` 是 `autoCreateTime:false`，
   四个授予点都没手写时间戳。已收进 `stampGrant()` 统一补。

### 5.5 APK 上的外链

`window.open` 在 Capacitor WebView 里**不生效**（没有地址栏、没有新标签页），
表现是「点了没反应、零报错」。走 `src/platform/openUrl.ts`：

- 原生 → `AppLauncher.openUrl()`（Android `ACTION_VIEW` / iOS `UIApplication.open`）：
  装了淘宝且它认领了该域名 ⇒ 直接进 App；否则落浏览器。
- Web → `window.open(..., 'noopener,noreferrer')`。

`javascript:` / `data:` / `file:` 一律拒（第二道闸，服务端那道不代替这道）。

> ⚠️ 加了原生插件 `@capacitor/app-launcher@8.0.1`，**打 APK 前要 `npx cap sync android`**，
> 否则原生侧没有这个插件，`openUrl` 会走 catch 落到 `window.open`（等于没修）。

### 5.6 装包要过「已拥有」这道门（2026-10-30 起）

原来 21 款随包游戏在「我的游戏」里**全部能免费点安装** —— 于是激活码在设置页
看不出任何区别：激活前也能装，激活后也一样。现在 `installLocalGame` 先判拥有，
没拥有时那一格显示「去心愿商城」，不摆一个点了才告诉你「还没拥有」的按钮。

「拥有」有**三个来源**，收在 `wishOwnedSet(ownedGameIds, installedGames, wishOrders)`：

| 来源 | 什么时候有 |
| --- | --- |
| 本地账本 `game_purchase` / `redemption_code` | 用钻石买 / 用激活码解锁 |
| 已装包 `installedGames` | 加门槛之前就装上的（**不能因为加门槛把它们锁死**） |
| 心愿单 `openedGameId` | 心愿商城换到并已开箱 |

⚠️ 只按账本判会把「心愿商城换来的游戏」一起锁死 —— 那批订单不写 `game_purchase`。

⚠️ `installLocalGame` 里的判定**读库不读 store 快照**：兑换流程是
「先记账本 → 再装包」，同一轮里 store 还没刷新，读快照会把刚兑换的判成没拥有。

e2e 里点安装前要先 `await grantGame(page, GAME_ID)`（`scripts/lib/own.mjs`，
走 `window.__kqf__.grantGame`）—— 21 个脚本已统一加好。

---

## 6. 还没接的（按优先级）

1. **任务 / 积分上云** —— `/api/task/*`、`/api/wallet/*` 都在，客户端仍是纯本地。
2. **存档上云** —— `/api/game/kv/*`、`/api/game/snapshot/*`。
   这块要小心：本地 Dexie 是唯一真相的现状一旦打破，
   就要处理「两边都改过」的冲突，不能只做「覆盖上传」。
3. **心愿 / 兑换上云** —— `/api/wish/*`、`/api/redeem/*`。
   （激活码那一条已经接了，见 §5；剩下的是许愿/兑换单本身。）

> ⚠️ 1~3 有一个共同前提：**先把「谁是真相」定下来**。
> 现在客户端写本地、服务端也有一份，两边都改过之后谁赢，
> 没有答案之前不要开始同步 —— 会造出一批「偶发丢数据」。

### 已完成

- **招商这一条闭环**（§3）：申请 → 后台审核 → 客户端拿到后台链接。
- **tf-admin 的招商审核页**（2026-10-30）：`/mall/merchant`，菜单「商城运营 / 招商审核」。
  共享库的 `sys_*` 表用 `tf-admin/server/cmd/tfinitdb` 补建（幂等，跑第二遍什么都不做）。
- **游戏激活码**（§5）。

---

## 7. 第二期：写穿（2026-11-02）

第一期只做了「读」（登录后把服务端拉进 Dexie）。写还在本地，
于是 `VITE_APP_MODE=online` 的包其实是「看得见云端、改的是本机」——
换台设备就发现白改了。这一期把**任务这一整条**改成写穿。

### 7.1 形状

```
界面 → store 动作 → if (isOnlineMode) → online/*.ts → src/api/* → tf-platform-api
                                      ↓ 成功
                                   refresh()（重拉）→ Dexie → 界面
                                      ↓ 失败
                            toast「没发出去，刚才那一步没有生效」+ **什么都不写**
```

`src/online/` 三个文件：

| 文件 | 职责 |
| --- | --- |
| `ids.ts` | 本地 id ↔ 服务端数字 id（`srv_task_12` ↔ `12`） |
| `write.ts` | `onlineWrite()` 把「调接口」收成 `{ok, data} / {ok, error}`；`writeFailToast()` 翻成人话 |
| `tasks.ts` | 一对一映射 store 动作；`camelCase → snake_case` 只有一张表 |

### 7.2 三条铁律

1. **失败绝不落本地。** 先存本地再补传的话，孩子看到「交上去啦」、
   家长永远收不到，而两边都不报错。写穿的整个价值就在这一条上。
2. **写完不自己算，`refresh()` 重拉。** 结算规则在服务端
   （`task_settlement.go`），本地再算一遍 = 两份真相。
3. **单测跑本地模式。** `vitest.config.ts` 里 `define` 把 `VITE_APP_MODE`
   钉成 `local` —— 否则 1067 条用例全都会去发 HTTP，失败信息还是
   `fetch is not defined`，看起来像环境问题。

### 7.3 三个「服务端没这个语义」的地方

| 客户端动作 | 服务端的现实 | 在线版怎么办 |
| --- | --- | --- |
| 提交后**立即结算**（家长关掉了审核） | `/task/submit` 一律进 `submitted` | 紧接着自己调一次 `/task/review` 通过，把语义补回来 |
| **签到审核**（`approveCheckIn` / `rejectCheckIn`） | 服务端签到**一步做完**，`NeedReview` 恒 false | 在线版不会有待审条目，这三个动作自然没被点到 |
| 连签**阶梯领奖**（`claimCheckInTier`） | 服务端自动发（`claimed_tiers`） | 同上，界面不会出现「领取」按钮 |

### 7.4 还没上云的，边界在哪

农场本体、兑换券、兑换单、心愿单、游戏币、插件存档 —— **仍然只在本机**。
这一期**故意不混算**：积分由服务端算，兑换券仍由本地账本算，
两边各管一摊，互不覆盖。所以换设备后：

- 任务、今日任务板、积分、流水 → 一致 ✅
- 农场、兑换券、心愿单、游戏存档 → **还是各设备各一份** ❌

> ⚠️ 下一期接农场时**必须先解决「谁是兑换券的真相」**：
> 卖菜得券是本地算的（行情 / 额度 / 品质都在 `src/domain/`），
> 服务端现在只能收「结果」。`/api/farm/state/save` 已经支持
> 「随状态一起提交账本变动」（幂等键 `op_id`，同一个事务入账），
> 但客户端**还没用**。用之前要先把本地 `harvestLedger` / `mallLedger`
> 从「账本」降级成「服务端流水的镜像」，否则一拉就双算。

### 7.5 农场接口（服务端已就绪，客户端待接）

```
POST /api/farm/state/get   → { empty, rev, payload, updated_at }
POST /api/farm/state/save  → { conflict, rev, applied, balances }
       body: { payload, rev, ledger?: [{currency, delta, source, memo, op_id}], force? }
```

- `payload` 是**整块 JSON**（地块 / 动物 / 背包 / 行情 / 世界日 / 额度结转 / 事件）。
  服务端不理解玩法，只负责「谁的那一份」。
- `rev` 是乐观锁：两台设备同时改，后到的拿 `conflict=true`，**什么都没写**。
- `ledger` 是随状态一起提交的币变动，**同一个事务**入账 ——
  拆成两次请求的话，中间断网就是「菜没了、券没到」。
- `op_id` 是幂等键（服务端拼 `farm:<uid>:<op_id>`），重试 / 连点不会多给一次。
- `source` 有白名单（`farm_harvest` / `animal_produce` / `seed_purchase` /
  `animal_purchase` / `plugin_mint`）：账本来源是给家长看流水的，
  客户端不能把自己的消费记成 `task_reward`。

验收：`node scripts/_probe-farm-state.mjs`（12 条，可反复跑）。

### 7.6 验收命令

```bash
npm run lint                                   # tsc -b --noEmit
npm test                                       # 1067 + 14 条（在线版纯函数）
npm run build                                  # 看退出码，别看 "built in"
node scripts/_probe-farm-state.mjs             # 服务端契约（12 条）
node scripts/_probe-write-through.mjs          # 浏览器真跑写穿（15 条）
```

`_probe-write-through` 断言的是「**界面 == 服务端**」：
建任务后本地 id 必须是 `srv_task_<服务端 id>`、提交后服务端 `status=submitted`、
家长确认后 `界面拿到的分 == 服务端加的分 == 本地余额`，
以及**断网时一个字都不落本地**。
