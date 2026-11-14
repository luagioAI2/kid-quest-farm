import { describe, expect, it } from 'vitest'
import { IMPORT_REFUSAL, RESET_REFUSAL, onlineDataOpRefusal } from './backup'

/* ============================================================
   在线版的「从备份恢复 / 清空数据」闸门
   ------------------------------------------------------------
   这两件事在在线版都会**先承诺再否认**：
     · 导入的旧账和服务端那份叠加（余额虚高、任务重复）；
     · 清空之后下一次刷新又把服务端那份拉回来。
   所以在线版直接拒绝，理由写在消息里。

   这条规则只能单测：`isOnlineMode` 是构建期常量，`vitest.config.ts`
   钉成 local，store 里造不出在线版。
   ============================================================ */

describe('onlineDataOpRefusal', () => {
  it('本地版一律放行（导入 / 清空都是本地版的正当能力）', () => {
    expect(onlineDataOpRefusal(false, 'import')).toBeNull()
    expect(onlineDataOpRefusal(false, 'reset')).toBeNull()
  })

  it('★ 在线版：导入和清空都挡，而且各有各的理由', () => {
    expect(onlineDataOpRefusal(true, 'import')).toBe(IMPORT_REFUSAL)
    expect(onlineDataOpRefusal(true, 'reset')).toBe(RESET_REFUSAL)
    expect(IMPORT_REFUSAL).not.toBe(RESET_REFUSAL)
  })

  it('★ 拒绝消息要说出「那怎么办」，不能只说「不支持」', () => {
    // 只说「不支持」的提示，家长的下一个动作是「再点一次」或「问客服」
    expect(IMPORT_REFUSAL).toContain('登录同一个账号')
    expect(RESET_REFUSAL).toContain('退出登录')
  })

  it('★ 别把内部词漏给家长（Dexie / 缓存 / srv_ / 服务端 之类）', () => {
    for (const msg of [IMPORT_REFUSAL, RESET_REFUSAL]) {
      expect(msg).not.toMatch(/Dexie|srv_|缓存|服务端|服务器/)
    }
  })
})
