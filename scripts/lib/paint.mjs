/**
 * 「这一点上肉眼真正看到的是什么？」—— 走查脚本共用的判据。
 *
 * ## 为什么要单独一份
 *
 * 「装饰画了没有」和「装饰看不看得见」是两件事。而这个项目的美术
 * **主要是内联 SVG**（作物 / 动物 / 场景装饰都是），于是判据里最容易错的一条是：
 *
 *   ★★ SVG 图形是用 **`fill`** 上色的，**不是 `background-color`**。
 *
 * 只查 `backgroundColor` 的话，`<rect fill="#c08e5c">` 的 `backgroundColor`
 * 是 `rgba(0,0,0,0)` —— 判据会**当成透明**，一路穿过去看到它下面的草地，
 * 于是「篱笆明明画在屏幕上了」却报「这里什么都没有」。
 * **2026-10-16 画 ⑥ 地平线装饰时踩到的**：量出来「可见草地」和加装饰前
 * 一字不差，而截图里篱笆清清楚楚。
 *
 * 所以这份判据必须**同时**认识两种上色方式，而且只能有**一份** ——
 * 抄成两份的话，改了一份另一份就静默失准（本项目的老毛病）。
 *
 * ## 用法
 *
 * 这段代码要在**页面里**跑，所以以「字符串」形式导出，脚本先注入一次：
 *
 * ```js
 * import { PAINT_HELPERS } from './lib/paint.mjs'
 * await page.evaluate(PAINT_HELPERS)          // 定义 window.__paintAt
 * const top = await page.evaluate((x, y) => window.__paintAt(x, y), 10, 20)
 * ```
 */

/** 真正会往屏幕上落色的 SVG 图形元素（`<g>` / `<defs>` 不会） */
const SVG_PAINTERS = ['rect', 'circle', 'ellipse', 'path', 'polygon', 'polyline', 'line', 'image', 'text', 'use']

export const PAINT_HELPERS = `
window.__paintAt = function (x, y) {
  const PAINTERS = ${JSON.stringify(SVG_PAINTERS)}
  for (const el of document.elementsFromPoint(x, y)) {
    const cs = getComputedStyle(el)
    const tag = el.tagName.toLowerCase()

    if (PAINTERS.includes(tag)) {
      // SVG：看 fill / stroke，不看 backgroundColor
      const fill = cs.fill || ''
      const stroke = cs.stroke || ''
      const filled = fill && fill !== 'none' && !/rgba?\\(\\s*0,\\s*0,\\s*0,\\s*0\\s*\\)/.test(fill)
      const stroked = stroke && stroke !== 'none' && cs.strokeWidth !== '0px'
      if (filled || stroked) return el
      continue
    }

    // HTML：看不透明背景 / 背景图
    const bg = cs.backgroundColor || ''
    const opaque = bg && bg !== 'transparent' && !/rgba?\\(\\s*[\\d.]+,\\s*[\\d.]+,\\s*[\\d.]+,\\s*0\\s*\\)/.test(bg)
    const img = cs.backgroundImage && cs.backgroundImage !== 'none'
    if (opaque || img) return el
  }
  return null
}
`
