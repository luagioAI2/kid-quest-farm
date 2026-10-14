/**
 * 游戏 id 的**唯一事实源**。
 *
 * ## 为什么单独一个文件、而且什么都不 import
 *
 * `db.ts` 的 `DEFAULT_SETTINGS.activeGame` 需要一个默认游戏 id，而
 * `registry.ts` 为了把页面组件挂上去，必然要 `import` 各个游戏的 `.tsx`。
 * 让**持久化层**去 import 一个会把整个 UI 拉进来的模块是错的层次
 * （`db.ts` 现在只依赖 `domain/*`，这条边界值得保住）。
 *
 * 所以把「纯常量」摘到这里：零依赖、谁都能安全引用，而且 id 只有一份。
 *
 * ⚠️ **别把 id 字面量散回各处**。`'farm'` 一旦在 `db.ts` 和 `registry.ts`
 * 各写一遍，改名时必然漏一个 —— 而漏掉的那处**不会报错**，只会静默失效。
 */

export const GAME_FARM = 'farm'
export const GAME_CLAW = 'claw'
export const GAME_FISHING = 'fishing'

/**
 * 首款游戏（免费、默认已拥有）。
 *
 * 也是「当前游戏」的兜底值：读到的 `settings.activeGame` 不可用时回落到它。
 * 它必须是 `defaultOwned` 的，否则兜底本身就会指向一个没买的游戏。
 */
export const DEFAULT_GAME_ID = GAME_FARM
