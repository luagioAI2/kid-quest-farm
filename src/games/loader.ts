/**
 * 运行时加载器 —— **「运行时装配」的边界**（spec §12.5）。
 *
 * ## 加载一个游戏包，一共三步
 *
 * ```
 * 代码文本 ──► Blob ──► URL.createObjectURL ──► import() ──► 校验 ──► GameBundle
 * ```
 *
 * ## 为什么走 Blob URL，而不是直接 `import('https://...')`
 *
 * **blob URL 继承页面的 origin**。直接 `import()` 一个远端 URL 的话：
 * ① 要那个服务器发对的 CORS 头；② 模块内部的相对 import 会相对**远端**解析
 * （于是每个包都得带一串远端路径）；③ 在 Capacitor 里还要操心
 * `allowMixedContent` / CSP。走 blob 这三件事一起消失。
 *
 * **代价**：blob 模块**不能有裸模块说明符**（`import React from 'react'` 会
 * 直接抛「Failed to resolve module specifier」）。所以每个游戏包必须是
 * **单文件自包含**的（自己的依赖全打进去）。见 `games-src/` 的构建配置。
 *
 * ## 为什么校验要「报出具体哪里不对」
 *
 * 包是**另一份构建产物**，宿主看不见它的源码。如果只说「加载失败」，
 * 排查的人会去查宿主的代码（而问题在包里）。所以这里的错误信息
 * 一律带上**字段名 + 实际值**。
 */

import { HOST_API, describeManifestProblem, type GameBundle, type HostApi } from './plugin'

/** 加载失败的分类。调用方据此决定「重试」还是「标记为损坏」。 */
export type LoadFailure =
  | 'syntax' // 代码本身跑不起来（import() 抛）
  | 'shape' // 跑起来了，但不是个游戏包（没有 default / 没有 mount）
  | 'manifest' // 有 manifest，但字段不对
  | 'hostApi' // 包要求的宿主版本比现在的新

export class BundleLoadError extends Error {
  readonly kind: LoadFailure
  constructor(kind: LoadFailure, message: string) {
    super(message)
    this.name = 'BundleLoadError'
    this.kind = kind
  }
}

/**
 * 把一段**代码文本**变成 `GameBundle`。
 *
 * ⚠️ 这个函数**不做完整性校验**（哈希 / 签名）—— 那是下载层的事
 * （spec §12.4），它必须发生在**调用本函数之前**：先验签，再执行。
 * 顺序反了就等于「先把陌生代码跑起来，再检查它该不该被跑」。
 */
export async function importBundle(code: string): Promise<GameBundle> {
  if (typeof code !== 'string' || code.trim().length === 0) {
    throw new BundleLoadError('syntax', '代码为空')
  }

  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  let mod: unknown
  try {
    mod = await import(/* @vite-ignore */ url)
  } catch (e) {
    // 语法错误 / 运行时错误都在这里。**把原始信息带上** ——
    // 「加载失败」这四个字对排查毫无帮助。
    const msg = e instanceof Error ? e.message : String(e)
    throw new BundleLoadError('syntax', `包执行失败：${msg}`)
  } finally {
    // 已经求值完了，可以回收。放在 finally 里，失败路径也不泄漏。
    URL.revokeObjectURL(url)
  }

  return validateBundle(mod)
}

/**
 * 校验一个**已经求值出来的模块**是不是合规的游戏包。
 *
 * 从 `importBundle` 里拆出来的，就一个原因：**这三道门必须能被单测覆盖**。
 * 原来它们埋在 `Blob → createObjectURL → import()` 后面，而那条链路
 * 在 node/jsdom 里跑不起来（没有 `URL.createObjectURL`，也没有 blob 模块解析）
 * —— 于是「包不合规会被拒」这件事**只能靠嘴说**，或者只能等浏览器走查。
 * 拆出来之后，坏包 / 版本门 / 缺 mount 全都能用普通对象喂进去验。
 *
 * `importBundle` = 求值 + 本函数；浏览器里那条真实链路由
 * `scripts/capture-game-bundle.mjs` 负责证明。
 */
export function validateBundle(mod: unknown): GameBundle {
  // 默认导出优先，但也接受「整个模块就是包」—— 有些打包器会把
  // `export default {...}` 拍平。两种都认，但**形状仍然要校验**。
  const candidate = ((mod as { default?: unknown })?.default ?? mod) as Partial<GameBundle>

  if (!candidate || typeof candidate !== 'object') {
    throw new BundleLoadError('shape', `包的导出不是对象（拿到 ${typeof candidate}）`)
  }
  if (typeof candidate.mount !== 'function') {
    throw new BundleLoadError(
      'shape',
      `包没有 mount(container, hostApi) —— 导出里没有可调用的 mount（拿到 ${typeof candidate.mount}）`,
    )
  }

  const problem = describeManifestProblem(candidate.manifest)
  if (problem) throw new BundleLoadError('manifest', problem)

  const manifest = candidate.manifest!

  // ★ 版本门：包要求的宿主 API 比现在的新 → 拒绝。
  // 没有这道门，一次游戏更新就能把宿主搞崩，而报错会指向**宿主自己**的代码
  // （因为崩的是宿主的 API 调用点），排查方向从第一秒就是错的。
  if (manifest.minHostApi > HOST_API) {
    throw new BundleLoadError(
      'hostApi',
      `这个游戏要求宿主 API ≥ ${manifest.minHostApi}，当前是 ${HOST_API} —— 请先更新 App`,
    )
  }

  return candidate as GameBundle
}

/**
 * 把一个已加载的包挂进容器，返回**卸载函数**。
 *
 * ⚠️ 卸载必须真的被调用（切走 / 卸载游戏时）。插件在里面注册的
 * 定时器 / 事件监听不会自己消失 —— 症状是「切回来以后跑了两遍」。
 * 所以调用方**不要**自己 try/finally 忘掉它，见 `PluginGameHost`。
 */
export function mountBundle(
  container: HTMLElement,
  bundle: GameBundle,
  host: HostApi,
): () => void {
  const unmount = bundle.mount(container, host)
  if (typeof unmount !== 'function') {
    // 包忘了返回卸载函数 —— 不当成致命错误（游戏还能玩），
    // 但要能查出来：这属于「契约没守」，走查脚本会数这个。
    console.warn(`[games] 包 ${bundle.manifest.id} 的 mount() 没有返回卸载函数`)
    return () => {}
  }
  return unmount
}
