/* ============================================================
   Portal —— 把弹层挂到 <body> 下
   ------------------------------------------------------------
   ⚠️ 这不是「讲究」，是必须的。踩过一次，现象很吓人：

   App 外壳里那层 `<main className="anim-fade-in">` 带一个 opacity
   淡入动画。浏览器会把「正在做 opacity 动画」的元素当成**层叠上下文**
   （等价于给它加了 will-change: opacity，而且这个隐式行为在
   getComputedStyle 里查不出来 —— opacity 显示 1、will-change 显示 auto）。

   于是它里面的东西全被关进一个小盒子里。底部导航是 z-30，
   小盒子整盒排在上面还是下面，只由 DOM 顺序决定 —— main 在前、导航在后，
   所以**导航永远压在弹层上面**。这时候把弹层的 z-index 抬到 9999 也没用。

   表现就是：任务详情弹层底部那个「我做完啦」/「好耶，收下」按钮
   被导航栏整个盖掉（实测按钮 759→803px，导航从 750px 开始），孩子点不到。

   解法只有一个：让弹层**跳出页面外壳**，直接挂到 body 下面，z-index 就正常了。

   以后新写任何「盖住整屏」的层（抽屉、弹窗、全屏页），
   只要它可能被渲染在某个页面组件内部，就套一层 <Portal>。
   详见 memory/2026-09-14.md §18.3。
   ============================================================ */

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Portal({ children }: { children: ReactNode }) {
  // 纯前端 SPA（Vite + Capacitor），渲染时 document.body 一定在。
  // 不走 useState + useEffect 那套「挂载后再 portal」，
  // 否则第一帧会闪一下空白。
  return createPortal(children, document.body)
}
