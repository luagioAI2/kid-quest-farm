import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

/**
 * **游戏包的独立构建**（spec §12.3 方案 A）。
 *
 * 和 `vite.config.ts`（App 本体）是**两份完全独立的构建** —— 这正是重点：
 * 游戏产物不能和 App 共享模块，否则又变回「同一个构建」，
 * 就谈不上独立下载 / 独立更新了。
 *
 * ## 产出要求（加载器依赖它们）
 *
 * 1. **单文件**（`codeSplitting: false`）—— 加载器只取一个 URL / 一段文本；
 *    ⚠️ 别写 `inlineDynamicImports` —— 在这个项目的 Vite 8（rolldown）里
 *    已经弃用，会打一条 WARN 出来（2026-10-15 实测）。
 * 2. **ESM**（`formats: ['es']`）—— 走 `import()`；
 * 3. **自包含**：产物里**不许有裸模块说明符**。blob 模块解析不了
 *    `import x from 'react'`，会在加载时抛
 *    「Failed to resolve module specifier」。所以游戏要么零依赖，
 *    要么把依赖全打进来（不要 `external`）。
 *    走查脚本 `scripts/capture-game-bundle.mjs` 会**检查产物里没有裸 import**。
 * 4. **无 CSS 资源**：样式走内联（游戏产物拿不到宿主的 Tailwind）。
 *    若某天确实要发 CSS，产物就变成「多文件」，加载器也要跟着改。
 *
 * ## 加一款新游戏
 *
 * 现在只有 `demo` 一款。多游戏时把 `lib.entry` 换成按 id 循环
 * （每个游戏单独一次构建，各自一个文件 —— 这样它们才能**各自**更新）。
 */
export default defineConfig({
  // ⚠️ 必须关掉：默认会把 `public/` 整个复制进 outDir，于是 App 的
  // favicon / apple-touch-icon 会被塞进**游戏包**里（2026-10-15 实测）。
  // 游戏包是要下发的，不该背 App 的图标 —— 而且那会让「包体 = 游戏大小」
  // 这个前提失真（走查脚本会核对产物里只有预期的东西）。
  publicDir: false,
  build: {
    // 产物**不进 App 的 dist** —— 它不该被打进 APK。
    // ⚠️ 必须用**绝对路径**：`outDir` 是相对 Vite 的 `root`（= cwd）解析的，
    // 写成 `'../games-dist'` 会落到**项目外面**去
    // （2026-10-15 实测落到了 `E:\plan\test25\games-dist`，那个目录里
    //  还躺着别的项目的图标文件）。用 `import.meta.url` 锚定，谁都改不歪。
    outDir: fileURLToPath(new URL('../games-dist', import.meta.url)),
    emptyOutDir: true,
    target: 'es2022',
    // ⚠️ 不要写 `minify: 'esbuild'` —— 这个项目的 Vite 8 走 rolldown，
    // esbuild 不在依赖里，显式指定会在构建时抛
    // `Cannot find package 'esbuild'`（2026-10-15 踩过）。用默认压缩即可。
    sourcemap: false,
    // ★ 单文件：**不许**代码分割。加载器拿到的是一段文本 / 一个 URL，
    // 拆出第二个 chunk 就等于「包里还有个包」，而 blob 模块解析不了相对路径。
    // （rolldown 用这个键；老的 `rollupOptions.output.inlineDynamicImports`
    //  已经弃用，见文件头。）
    codeSplitting: false,
    lib: {
      entry: fileURLToPath(new URL('./demo/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'demo.js',
    },
  },
})
