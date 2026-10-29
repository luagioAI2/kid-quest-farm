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
| 任务 / 积分 / 心愿 / 兑换上云 | ❌ 服务端有接口，客户端还没接 |
| 存档（`game/kv`、`game/snapshot`）上云 | ❌ 同上 |
| tf-admin 的招商审核页面 | ❌ 后台服务端模块也还没有 |

> 「本地数据」和「云端数据」现在是**两套互不同步的东西**：
> 孩子的任务、积分、心愿单仍然只在本机 Dexie 里。
> 只有账号和招商申请走服务端。

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

## 5. 还没接的（按优先级）

1. **tf-admin 的招商审核页** —— 现在只能 curl。后台 `server/` 有 7 个
   `mall/*` 路由但**一个页面都没有**（`web/src/view/` 下没有 `mall/`），
   菜单和 casbin 权限也都要在 DB 里注册。
2. **任务 / 积分上云** —— `/api/task/*`、`/api/wallet/*` 都在，客户端仍是纯本地。
3. **存档上云** —— `/api/game/kv/*`、`/api/game/snapshot/*`。
   这块要小心：本地 Dexie 是唯一真相的现状一旦打破，
   就要处理「两边都改过」的冲突，不能只做「覆盖上传」。
4. **心愿 / 兑换上云** —— `/api/wish/*`、`/api/redeem/*`。

> ⚠️ 2~4 有一个共同前提：**先把「谁是真相」定下来**。
> 现在客户端写本地、服务端也有一份，两边都改过之后谁赢，
> 没有答案之前不要开始同步 —— 会造出一批「偶发丢数据」。
