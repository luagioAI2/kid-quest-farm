import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'

/* jsdom 不做布局，`Element.prototype.scrollIntoView` 在它里面**根本不存在** ——
   调用就是 `TypeError: el.scrollIntoView is not a function`，而且报在组件里，
   看着像产品代码炸了。

   兑换页「从心愿页跳过来 → 滚到那一行」要用它（`RedeemSheet` 的 flash 效果）。

   ⚠️ 这是**测试环境**的补丁，别拿它去给产品代码兜底：组件里写
   `el?.scrollIntoView?.()` 会把真机上「找不到元素」的失败一起吞掉。 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
