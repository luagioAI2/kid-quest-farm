import { describe, expect, it } from 'vitest'
import { CATEGORY, CATEGORY_ORDER, FALLBACK_CATEGORY, categoryOf } from './ui'
import type { TaskCategory } from '@/domain/types'

/* ============================================================
   分类样式：认不出来的分类必须兜得住
   ------------------------------------------------------------
   `Task.category` 在**类型**上是联合类型，运行时却不是 ——
   导入备份（`importBackup` 只校验结构，不逐个校验 category）、
   或者更老版本留下的数据，都可能带着一个现在已经不存在的分类。

   那时 `CATEGORY[unknown]` 是 `undefined`，渲染里紧接着的
   `cat.solid` / `cat.emoji` 直接抛 TypeError →
   ErrorBoundary 把**整个任务页**换成崩溃页。
   一个字段不认识，代价是整页打不开。

   2026-09-15 修：所有渲染改走 `categoryOf()`，这里把兜底钉住。
   ============================================================ */

/** 不在 `TaskCategory` 里的值 —— 模拟备份 / 老数据里的脏分类 */
const UNKNOWN = 'dance-party'

describe('分类样式：认不出来的分类必须兜得住', () => {
  it('已知分类原样返回（兜底不能把正常分类也吃掉）', () => {
    for (const c of CATEGORY_ORDER) {
      expect(categoryOf(c), c).toBe(CATEGORY[c])
    }
  })

  it('未知分类返回兜底对象，绝不返回 undefined', () => {
    const got = categoryOf(UNKNOWN as TaskCategory)
    expect(got, '认不出来的分类必须兜住，不能返回 undefined').toBeDefined()
    expect(got).toBe(FALLBACK_CATEGORY)
  })

  it('空字符串 / 大小写不对 / 原型链上的名字都要兜住', () => {
    // 故意试几个「能骗过朴素实现」的输入：
    // `constructor` / `toString` 在 `{}` 上取得到，直接用对象索引会拿到函数
    for (const bad of ['', 'Study', 'STUDY', 'constructor', 'toString', '__proto__']) {
      const got = categoryOf(bad)
      expect(got, `输入 ${JSON.stringify(bad)}`).toBe(FALLBACK_CATEGORY)
      expect(typeof got.label, `输入 ${JSON.stringify(bad)} 的 label`).toBe('string')
    }
  })

  it('兜底样式的每个字段都要有值（少一个就是崩溃或空白）', () => {
    for (const k of ['label', 'emoji', 'solid', 'soft', 'ink', 'border', 'ring'] as const) {
      expect(FALLBACK_CATEGORY[k], `FALLBACK_CATEGORY.${k}`).toBeTruthy()
    }
  })

  it('渲染要用的样式类在所有分类上都齐全', () => {
    const all = [...CATEGORY_ORDER.map((c) => CATEGORY[c]), FALLBACK_CATEGORY]
    for (const style of all) {
      for (const k of ['solid', 'soft', 'ink', 'border', 'ring'] as const) {
        expect(style[k], `${style.label} 的 ${k}`).toBeTruthy()
      }
    }
  })

  /* ---------------- 样式类名的形状 ---------------- */

  /**
   * Tailwind v4 对**写错颜色的类名是静默失败**：`bg-ink-400` 不会报错，
   * 只是**一个字节 CSS 都不生成**，于是那一块直接没背景色。
   * 类型系统也管不了 —— 类名就是字符串。
   *
   * ⚠️ 「这个类名对应的 CSS 到底生成了没有」在**单元测试里测不了**：
   * Vitest 默认把 CSS 导入 stub 成空（`css: false`），拿不到 theme.css 的内容，
   * 而 `tsconfig.app.json` 给 `src` 的 types 只有 `["vite/client"]`，
   * 用 `node:fs` 读文件会 TS2591 **直接把构建弄挂**。
   *
   * 所以分工是：
   *   · 这里只查**形状**（是不是 `bg-<色板>-<档位>` 这种规范写法、有没有空格拼错）；
   *   · 「CSS 真的生成了」交给 E2E —— 读 `getComputedStyle` 的
   *     `backgroundColor` 是不是透明。那比解析令牌表更硬：
   *     它直接证明浏览器里真的画出来了。
   */
  it('样式类名形状规范，没有空串或多余空格', () => {
    const all = [...CATEGORY_ORDER.map((c) => CATEGORY[c]), FALLBACK_CATEGORY]
    for (const style of all) {
      for (const k of ['solid', 'soft', 'ink', 'border', 'ring'] as const) {
        const cls = style[k]
        expect(cls, `${style.label}.${k} 不该有首尾空格`).toBe(cls.trim())
        expect(cls, `${style.label}.${k} 不该有多余空格`).not.toMatch(/\s{2,}/)
        expect(cls.split(' ').length, `${style.label}.${k} 应该是单个类名`).toBe(1)
        // 形状：<前缀>-<色板>-<档位>，例如 bg-sky-400
        expect(cls, `${style.label}.${k} = ${cls} 不符合 <前缀>-<色板>-<档位>`).toMatch(
          /^(?:bg|text|border|ring)-[a-z]+-\d+$/,
        )
      }
    }
  })

  it('兜底分类用的是中性色，不能跟任何真实分类撞色', () => {
    // 兜底要是长得像「学习」，家长会以为这个任务被归到学习里了
    const real = CATEGORY_ORDER.map((c) => CATEGORY[c].solid)
    expect(real, '兜底的实色不能和任何真实分类重复').not.toContain(FALLBACK_CATEGORY.solid)
    expect(FALLBACK_CATEGORY.solid, '兜底应该是中性色').toContain('ink-')
  })
})
