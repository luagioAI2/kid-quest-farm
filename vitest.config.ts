import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

/**
 * 测试专用配置。
 * 与 vite.config.ts 分开，避免 vitest 的类型扩展污染生产构建配置。
 */
export default defineConfig({
  plugins: [react()],
  /**
   * 单测一律跑**本地模式**。
   *
   * 这个 worktree 的 App 默认是在线版（`sync/pull.ts` 里默认 online），
   * 而 store 的单测断言的是本地领域逻辑（播种、结算、农场推进）。
   * 不钉死的话，每条用例都会去发 HTTP —— 不是报错，是**变慢 + 结果取决于网络**，
   * 而失败信息会是「fetch is not defined」，看起来像环境问题。
   *
   * 在线版自己的逻辑（id 映射、字段映射）是纯函数，单独测，不需要这个开关。
   */
  define: {
    'import.meta.env.VITE_APP_MODE': JSON.stringify('local'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    /**
     * 2026-10-24 放宽超时：默认 5s 会让**整轮**出现假红。
     *
     * 实测：`TaskEditor.tiers.test.tsx` / `SettingsPage.noGlobalRewards.test.tsx`
     * 单独跑 19/19、3/3 全绿（单条 1.8s 内完），整轮 34 个文件并行时却报
     * `Test timed out in 5000ms` —— 每次红 2~3 条、位置还会漂。
     * 那是 jsdom + `userEvent` 的重用例在满载下的真实开销，不是逻辑错。
     *
     * 15s ≈ 满载 3 倍余量：**真挂住的用例照样会红**，只是晚 10 秒；
     * 而 5s 的代价是「每次跑都有一两条红」→ 人会开始忽略红色，比没有用例更糟。
     */
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
