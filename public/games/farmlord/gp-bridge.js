/**
 * 宿主桥 —— 把原版依赖的 `window.gp`（MakePlay 平台注入）在本地补齐。
 *
 * 原版启动第一句就是 `await window.gp.player.ready`（`main.js` 的 `M0()`），
 * 拿不到 gp 直接 `TypeError: Cannot read properties of undefined (reading 'player')`
 * —— 首屏就停在加载态。所以这个文件**必须在 main.js 之前执行**
 * （`index.html` 里排在它前面；两个都是 module，按文档顺序求值）。
 *
 * ## 三层存储（用户 2026-11-08 定的口径）
 *
 * > 「现在先本地存档，所有游戏应该都是统一的本地存档，另外允许服务器存档。
 * >   就是在存储接口那看是否本地和服务器吧。」
 *
 * 1. **独立网页**：`localStorage`（键 `farmlord:save:v1`）
 * 2. **插件里**：`host.storage`（宿主 `gameKv`，自动带 `<gameId>:` 前缀）
 * 3. **服务器存档**：宿主自己会同步 `gameKv`，**这一层不归插件管** ——
 *    插件只认 `host.storage`，本地还是远端由宿主决定。
 *
 * ## 为什么要有 `?boot=<nonce>`
 *
 * 插件挂载时，存档已经在宿主那边（IndexedDB）了，但游戏是**同步**启动的：
 * `main.js` 一进来就 `await gp.player.ready`，紧接着 `/hello` + `/farm/enter`，
 * 那时候 `host.storage.get()` 这个 Promise 还没回来。
 *
 * 所以插件走一条**一次性投递**：
 *
 * 1. 插件把存档写进 `localStorage['farmlord:boot:<nonce>']`（同源，iframe 看得见）
 * 2. `iframe.src = index.html?boot=<nonce>`
 * 3. 本文件读到 `?boot=`，把那份存档当初始状态，**读完立刻删掉**
 * 4. 启动完成后插件再调 `__farmlordUseStorage()` 把后续写入接到宿主
 *
 * 为什么不用「直接写 `farmlord:save:v1` 再加载」：那样同一台设备上
 * 两个账号会互相覆盖 —— 而账号隔离正是宿主 `gameKv` 存在的理由。
 * nonce 一次一换，投递完就删，不留痕迹。
 */
import { createLocalServer } from './local-server.js'

const KEY = 'farmlord:save:v1'

function readLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function writeLocal(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* 隐私模式 / 配额满：忽略，游戏照常跑 */
  }
}

/**
 * 取一次性投递的存档，取完就删。
 *
 * 两个入口，按可靠性排序：
 *   ① `window.__farmlordBootSave` —— 插件把整个页面塞进 `srcdoc` 时，
 *      在模块脚本之前内联一行赋值。**首选**：srcdoc 的 `location.search`
 *      是空的（URL 是 `about:srcdoc`），走不了 query。
 *   ② `?boot=<nonce>` —— 独立网页形态下备用。
 *
 * 判据是「**键在不在**」而不是「值真不真」：空存档 `{}` 也是合法投递，
 * 用 `if (!raw)` 判会把「新玩家、宿主明确说没有存档」当成「没人投递」，
 * 于是又去读 localStorage 里的旧档 —— 换账号时会读到上一个人的农场。
 */
function takeBootSave() {
  try {
    if ('__farmlordBootSave' in window) {
      const v = window.__farmlordBootSave
      try {
        delete window.__farmlordBootSave
      } catch {}
      return v === null ? undefined : v
    }
    const nonce = new URLSearchParams(location.search).get('boot')
    if (!nonce) return undefined
    const bootKey = `farmlord:boot:${nonce}`
    const raw = localStorage.getItem(bootKey)
    localStorage.removeItem(bootKey)
    if (raw === null) return undefined
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const boot = takeBootSave()

let store = {
  load: () => (boot === undefined ? readLocal() : boot),
  save: writeLocal,
}
let server = null

function ensureServer() {
  if (!server) server = createLocalServer(store)
  return server
}

/**
 * 换掉底层存储（插件挂载时调）。
 *
 * `load` / `save` 都是**同步**签名 —— 宿主的 `storage.get/set` 是异步的，
 * 所以 `plugin.js` 会先 `await` 把存档读出来（并通过 `?boot=` 投递），
 * 之后 `save` 返回 Promise 也没关系：`local-server` 那边会 `catch`。
 *
 * ⚠️ 用 `_setStore` 而不是重建 server：重建会用 `load()` 再读一遍，
 * 把内存里刚跑出来的状态（引导进度、刚种下的作物）退回去。
 */
export function useStorage(next) {
  store = next
  if (server) {
    server._setStore(next)
    return server
  }
  server = createLocalServer(store)
  return server
}

/** 拿当前服务端实例（调试桥 / e2e 用） */
export function getServer() {
  return ensureServer()
}

/* 只有「宿主没给 gp」时才装本地实现 —— 真平台里必须让原版走自己的桥。 */
if (!window.gp) {
  const s = ensureServer()
  window.gp = {
    player: {
      ready: Promise.resolve({ user: { id: 'local', name: '小农场主', locale: 'zh', avatar: '' } }),
      onChange() {},
      requestLogin() {},
      current: { id: 'local', name: '小农场主', locale: 'zh', avatar: '' },
    },
    server: {
      get: (path, body) => s.get(path, body),
      post: (path, body) => s.post(path, body),
      inbox: () => s.inbox(),
    },
    /* ⚠️ 故意不给 `pay` / `share`：
       客户端用 `gp.pay?.available` 与 `gp.share?.available === true` 当开关，
       没有这两块，内购商店与分享卡片就**自动隐藏**，不需要改游戏代码。
       经济口径是「只花积分」（2026-11-08 用户选的 B），
       所以真钱买宝石这条路必须关掉，而关的方式是「不给能力」而不是「藏按钮」。 */
  }
  window.__farmlord = s
  /* 给插件用（跨 iframe 只能挂在 window 上，模块导出过不去） */
  window.__farmlordUseStorage = useStorage
  window.__farmlordGetServer = getServer

  /* 关页面前把没落盘的那一次写掉（节流 300ms，最后一个动作很容易还没写） */
  addEventListener('pagehide', () => s._flush())
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) s._flush()
  })
}
