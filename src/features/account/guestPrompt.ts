/* ============================================================
   「什么时候提醒他保存进度」（2026-11-03）
   ------------------------------------------------------------
   游客账号的代价是**看不见的**：东西都在，直到换手机 / 清数据 / 卸载。
   所以要有提醒，但提醒多了就是骚扰 —— 而且这是给孩子用的 App，
   弹窗一多，孩子学会的是「点掉它」，家长反而更不会看。

   规则只有一条：**温和提醒一辈子只弹一次**（`nudged`）。
   其余的靠两个不打扰人的入口：
     · 顶栏下面那条常驻横条（`GuestBar`）—— 随时能点，不挡任何东西
     · 家长区那张账号卡 —— 家长本来就会去那里看

   硬门槛（花兑换券被服务端拒）不算「提醒」，它每次都弹：那一步
   本来就不允许继续，弹出来是解释，不是打扰。

   ## 为什么是第 3 次启动

   第 1 次：他刚进来，还不知道这 App 好不好玩 —— 这时候拦他等于赶人。
   第 2 次：他回来了，但手里大概率还没什么值得丢的东西。
   第 3 次：他已经回来两次了，说明会继续玩；而这时任务、积分、券
           都攒了一些，**丢了会心疼**。这是唯一值得开口的时刻。

   ## 为什么不用「第一次挣到积分」当弹窗时机

   那一刻孩子正在庆祝（任务通过 / 签到成功），弹一个表单会打断他，
   而且他多半直接点掉 —— 这一次机会就浪费了。
   改成**横条上的字变一下**（「已经攒了 12 分」），家长路过时自己会看到。
   ============================================================ */

const KEY = 'kqf.guest.prompt.v1'

interface PromptState {
  /** 这台设备第几次启动 */
  launches: number
  /** 温和提醒已经用掉了 */
  nudged: boolean
}

/** 第几次启动才开口 */
export const NUDGE_AT_LAUNCH = 3

function read(): PromptState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Partial<PromptState>
      if (typeof v?.launches === 'number' && typeof v?.nudged === 'boolean') {
        return { launches: v.launches, nudged: v.nudged }
      }
    }
  } catch {
    /* 存不住 / 内容坏了：当成第一次启动 */
  }
  return { launches: 0, nudged: false }
}

function write(v: PromptState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* 存不住就每次启动都当成「第 1 次」—— 于是**永远不弹**。
       这比每次启动都弹一次好：后者才是真正的骚扰。 */
  }
}

/** 本次启动是第几次。模块级缓存 ⇒ 一次页面加载只加一次（StrictMode 也不会加两次）。 */
let cached: number | null = null

export function launchCount(): number {
  if (cached !== null) return cached
  const v = read()
  v.launches += 1
  write(v)
  cached = v.launches
  return cached
}

/** 这次启动该不该弹「保存进度」 */
export function shouldNudgeOnLaunch(): boolean {
  const v = read()
  return !v.nudged && launchCount() >= NUDGE_AT_LAUNCH
}

/** 弹过了（不管他是关掉还是绑好了）—— 以后不再弹 */
export function markNudged() {
  const v = read()
  if (v.nudged) return
  v.nudged = true
  write(v)
}

/** 绑好手机号之后清掉：以后要是又变成游客（换设备 / 清数据），还能再提醒一次 */
export function resetGuestPrompt() {
  cached = null
  write({ launches: 0, nudged: false })
}

/**
 * 测试用：只清内存缓存，**保留** localStorage。
 *
 * 用来模拟「重开 App」—— 那次启动要能读到上一次落盘的状态，
 * 否则「弹过了就不再弹」这条跨重启的保证根本验不到。
 */
export function __resetLaunchCacheForTest() {
  cached = null
}

/** 测试用：全清 */
export function __resetGuestPromptForTest() {
  cached = null
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
