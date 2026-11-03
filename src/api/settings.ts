import { api } from './client'

/* ============================================================
   在线版 · 家长设置（`/api/user/settings/*`）
   ------------------------------------------------------------
   服务端存的是**整份 JSON 字符串**，不解释字段：

     { payload: "{\"childName\":\"小明\",\"parentPin\":\"1234\"}", version: 3 }

   为什么整份存（而不是一列一个字段）：`AppSettings` 有 20 多个字段、还在加。
   拆列意味着每加一个字段要改「实体 / 仓储 upsert 的列清单 / 映射」三处，
   漏一处的表现是「家长设了、服务端没存」—— 不报错，重启后回退。

   服务端只校验**形状**：非空、≤ 32 KiB、合法 JSON、顶层是对象
   （见 `internal/app/service/user_settings_srv.go`）。所以客户端加字段
   不用动服务端，但发上来的东西必须是对象。

   ⚠️ 失败码：
     · `10041301` settings-invalid   —— 不是 JSON 对象 / 空
     · `10041302` settings-too-large —— 超过 32 KiB（文案里带上限）
   两个分开是因为 i18n 的 `T()` 是 `fmt.Sprintf`，**只有传了参数才会渲染** ——
   共用一个码的话，不传参的那几条分支会把 `%d` 原样吐给用户。
   ============================================================ */

export interface ServerSettings {
  /** 整份设置的 JSON 字符串；**从没保存过是空串**，不是 404 */
  payload: string
  /** 服务端最后写入时间（Unix 秒） */
  updated_at: number
  /** 客户端带上来的序号，只用于「别用旧响应盖掉新写入」 */
  version: number
}

/** 读当前账号的设置。没设置过返回 `payload: ''`，不是错误 */
export const settingsGet = () => api<ServerSettings>('/user/settings/get', {})

/**
 * 整份覆盖写。
 *
 * ⚠️ 是**覆盖**不是合并：本地删掉的键，写上去之后服务端也不会留着。
 *    靠的是服务端 `OnConflict(uid).Update(payload, size, version)`。
 */
export const settingsSave = (payload: string, version: number) =>
  api<ServerSettings>('/user/settings/save', { payload, version })
