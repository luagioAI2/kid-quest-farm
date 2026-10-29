import { afterAll, describe, expect, it } from 'vitest'
import { login } from './auth'
import { applyMerchant, myMerchant } from './merchant'
import { setSession, sessionFrom } from './session'

/* ============================================================
   真服务端联调（默认跳过）
   ------------------------------------------------------------
   用法：先在本机起 `tf-platform-api`（默认 `127.0.0.1:8090`），然后

       VITE_LIVE_API=1 npx vitest run src/api/live.test.ts

   为什么单列一份、不混进 `npm test`：
   这一组**要真连服务端**，而 CI 上没有它。塞进主套件的结果是
   「每次跑测试都红三条」，然后所有人学会忽略红色。

   它守的是**契约**：客户端只发 `role`，服务端从账号取 name / contact。
   这条链子一旦对不上，症状是「申请提交成功但列表里没有」或者
   「通过审核了却没有后台链接」—— 两种都不报错，只靠人肉点才发现。
   ============================================================ */

// ⚠️ 用 `import.meta.env`，不是 `process.env` —— 这个项目的 tsconfig
// 只给了 `types: ["vite/client"]`，`process` 在类型层面根本不存在。
const LIVE = import.meta.env.VITE_LIVE_API === '1'
const d = LIVE ? describe : describe.skip

/** 本地开发账号（`scripts/seed-dev-account.sh` 建的那个） */
const MOBILE = import.meta.env.VITE_LIVE_MOBILE ?? '13800138000'
const PASSWORD = import.meta.env.VITE_LIVE_PASSWORD ?? 'test123456'

d('live：招商接口（真服务端）', () => {
  it('登录 → 我的申请 → 只发 role 也能提交', async () => {
    const r = await login(MOBILE, PASSWORD)
    expect(r.access_token, '要拿到 token').toBeTruthy()
    expect(r.user.uid).toBeGreaterThan(0)
    // ⚠️ 手机号是脱敏的 —— 客户端补不出 contact，这正是要服务端取的原因
    expect(r.user.mobile).toContain('*')
    setSession(sessionFrom(r))

    const before = await myMerchant()
    expect(Array.isArray(before.applications)).toBe(true)

    // ★ 只发 role：name / contact 由服务端从账号取
    const app = await applyMerchant('parent')
    expect(app.role).toBe('parent')
    expect(['pending', 'approved', 'rejected']).toContain(app.status)
    expect(app.name, '服务端要从账号里取到名字').toBeTruthy()
    expect(app.contact, '服务端要从账号里取到联系方式').toBeTruthy()

    // 客户端永远推不到 approved；万一后台已经通过了，必须有 admin_url
    if (app.status !== 'approved') {
      expect(app.admin_url, '没通过就不许给后台地址').toBeUndefined()
    }
  })

  it('同一路再申请 = 改申请，不会变成两条', async () => {
    const r = await login(MOBILE, PASSWORD)
    setSession(sessionFrom(r))

    await applyMerchant('parent')
    const again = await myMerchant()
    const parents = again.applications.filter((a) => a.role === 'parent')
    expect(parents, '按 (uid, role) upsert').toHaveLength(1)
  })
})

afterAll(() => {
  setSession(null)
})
