/**
 * 「我是一个农场主」—— 小任务农场插件包（模板，由 build-plugin.mjs 填充后发布）。
 *
 * ## 为什么是 srcdoc iframe，而不是直接往容器里画
 *
 * 这游戏不是「给我一个容器我自己画 canvas」那种组件，它是一张**完整网页**：
 * 自带 canvas、header、nav、几十个写死的 #id，而且 style.css 第一条就是
 * `html,body{margin:0;height:100%;overflow:hidden}`。直接塞进宿主 DOM 有三个后果，
 * 每个都很难查：
 *
 *   ① html/body 那条规则会**改掉宿主的整页样式**；
 *   ② #hud / #tools / #dock 这些 id 和宿主的撞了，querySelector 取到别人的节点；
 *   ③ 游戏的 position:fixed 层（引导遮罩 #tut）会盖住宿主底栏。
 *
 * 所以用 iframe 隔离。但**不能用 `<iframe src>`**：远程包在 API 那台机器上，
 * 和 App 不同源，contentWindow 拿不到 ⇒ 存储交接（host.storage）做不了。
 *
 * srcdoc 的关键性质：**文档继承父页面的 origin**。
 * 于是 contentWindow.__farmlordUseStorage 能直接调，localStorage 也是同一份。
 *
 * ## base href 是必须的
 *
 * srcdoc 的文档 URL 是 about:srcdoc，所有相对路径会以它为基准 ⇒ 全 404。
 * 加一条 `<base href="{assetBase}">` 把基准指到包目录，游戏里那些
 * assets/x.webp / fetch('assets/manifest.json') / ./i18n.js 才找得到。
 *
 * ## 存档怎么在启动前送进去
 *
 * 游戏是**同步**启动的：main.js 第一句 await gp.player.ready，
 * 紧接着 /hello + /farm/enter。那时 host.storage.get() 还没回来。
 * 所以在模块脚本**之前**内联一行 window.__farmlordBootSave = {...}，
 * gp-bridge.js 读它当初始状态。
 */

export const manifest = {
  "id": "farmlord",
  "name": "我是一个农场主",
  "emoji": "🌾",
  "tabLabel": "农场主",
  "version": "1.0.1",
  "minHostApi": 4,
  "coin": {
    "id": "crop",
    "name": "庄稼",
    "emoji": "🌾"
  },
  "economy": {
    "playCost": 1,
    "expectedPayout": 0,
    "capPerPrize": 1,
    "voucherPerCoin": 0
  }
}

/** body 里的静态标记（原 index.html 的 body，去掉三条 module 脚本） */
const BODY = "<canvas id=\"scene\"></canvas>\n<header id=\"hud\">\n  <div class=\"me\">\n    <div class=\"lvb\"><img src=\"assets/ui_xp.webp\" alt=\"\"><b id=\"lv\">1</b></div>\n    <div class=\"col\"><b id=\"pname\"></b><div class=\"xp\"><i id=\"xpbar\"></i></div></div>\n  </div>\n  <div class=\"cur\"><span><img src=\"assets/ui_coin.webp\" alt=\"\"><b id=\"money\">0</b></span><span><img src=\"assets/ui_gem.webp\" alt=\"\"><b id=\"gems\">0</b></span></div>\n  <div class=\"opts\"><button id=\"hh-gear\" aria-label=\"Settings\">⚙️</button></div>\n</header>\n<div id=\"visit\"><b id=\"visit-name\"></b><small id=\"visit-lv\"></small></div>\n<div id=\"actions\"><button id=\"act-all\"></button><button id=\"act-help\"></button></div>\n<div id=\"tools\"></div>\n<nav id=\"dock\">\n  <button id=\"btn-home\"><img src=\"assets/ui_home.webp\" alt=\"\"><span></span></button>\n  <button id=\"btn-shop\"><img src=\"assets/ui_shop.webp\" alt=\"\"><span></span></button>\n  <button id=\"btn-barn\"><img src=\"assets/ui_barnicon.webp\" alt=\"\"><span></span></button>\n  <button id=\"btn-friends\"><img src=\"assets/ui_friends.webp\" alt=\"\"><span></span></button>\n  <button id=\"btn-log\"><img src=\"assets/ui_log.webp\" alt=\"\"><span></span></button>\n</nav>\n<div id=\"toasts\"></div>\n<div id=\"loading\"><img src=\"assets/ui_logo.webp\" alt=\"Harvest Heist\"></div>\n<!-- 必须排在 main.js 前面：原版第一句就 `await window.gp.player.ready`，\n     拿不到 gp 直接 TypeError，首屏停在加载态。两个都是 module，按文档顺序求值。 -->"

/** 按顺序加载的模块（必须 gp-bridge 在前：原版第一句就要 window.gp） */
const SCRIPTS = ["gp-bridge.js","main.js?v=20","tutorial.js?v=20"]

/** 存档键 —— 宿主 gameKv 里这个名字 */
const SAVE_KEY = 'save'

/** iframe 的样式：铺满宿主给的容器，去掉边框与背景缝 */
const FRAME_CSS = [
  'position:absolute',
  'inset:0',
  'width:100%',
  'height:100%',
  'border:0',
  'display:block',
  'background:#7fb24a',
].join(';')

/** 内联进 <script> 的 JSON：只需要挡住 </script 提前闭合 */
function esc(s) {
  return String(s).replace(/<\/(script)/gi, '<\\/$1')
}

export async function mount(container, host, ctx) {
  /* ① 先把存档读出来（异步），等会内联进 srcdoc */
  let save = null
  try {
    const v = await host.storage.get(SAVE_KEY)
    if (v !== undefined && v !== null) save = v
  } catch (e) {
    console.warn('[farmlord] 读存档失败，按新档启动', e)
  }

  const base = ctx.assetBase || ''
  const url = (rel) => ctx.assetUrl(rel)

  /* ② 拼 srcdoc */
  const doc = [
    '<!doctype html><html lang="zh"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">',
    '<title>' + manifest.name + '</title>',
    /* ★ 基准：没有它，srcdoc 里所有相对路径都会以 about:srcdoc 为基准 ⇒ 全 404 */
    '<base href="' + base + '">',
    '<link rel="stylesheet" href="' + url('style.css?v=20') + '">',
    /* 存档必须在模块脚本之前就位 —— 游戏是同步启动的 */
    '<script>window.__farmlordBootSave=' + esc(JSON.stringify(save)) + ';<\/script>',
    '<script type="importmap">' +
      esc(JSON.stringify({ imports: { '@makeplay/sound': url('runtime/sound-1.js') } })) +
      '<\/script>',
    '</head><body>',
    BODY,
    ...SCRIPTS.map((s) => '<script type="module" src="' + url(s) + '"><\/script>'),
    '</body></html>',
  ].join('')

  /* ③ 建 iframe */
  const frame = document.createElement('iframe')
  frame.setAttribute('title', manifest.name)
  frame.setAttribute('allow', 'autoplay')
  frame.style.cssText = FRAME_CSS
  frame.srcdoc = doc

  const loaded = new Promise((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true })
  })

  container.replaceChildren(frame)
  await loaded

  const win = frame.contentWindow
  if (!win) {
    frame.remove()
    throw new Error('游戏框架没起来（contentWindow 为空）')
  }

  /* ④ 等游戏自己报 ready（main.js 结尾会 dispatch hh:ready）。
     拿不到也继续 —— 引导层可能已经在跑，不该因为等待超时就不给玩。 */
  await new Promise((resolve) => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      try {
        win.removeEventListener('hh:ready', finish)
      } catch {}
      clearTimeout(timer)
      resolve()
    }
    const timer = setTimeout(finish, 12000)
    try {
      win.addEventListener('hh:ready', finish, { once: true })
    } catch {
      finish()
    }
  })

  /* ⑤ 把后续写入接到宿主存储。
     用 _setStore 而不是重建 server —— 重建会把内存里刚跑出来的状态退回去。 */
  let unmounted = false
  if (typeof win.__farmlordUseStorage === 'function') {
    win.__farmlordUseStorage({
      /* load 给「当前内存状态」：这一刻服务端已经跑起来了，
         再读一遍宿主可能读到旧值。 */
      load: () => win.__farmlordGetServer && win.__farmlordGetServer()._state(),
      save: (state) => host.storage.set(SAVE_KEY, state),
    })
  }

  /* ⑥ 卸载：落盘 + 摘 iframe。不落盘会丢最后一个动作（节流 300ms 还没写） */
  return async () => {
    if (unmounted) return
    unmounted = true
    try {
      const s = win.__farmlordGetServer && win.__farmlordGetServer()
      if (s && s._flush) s._flush()
    } catch (e) {
      console.warn('[farmlord] 卸载时落盘失败', e)
    }
    frame.remove()
  }
}
