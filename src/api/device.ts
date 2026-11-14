/* ============================================================
   设备号（2026-11-03）
   ------------------------------------------------------------
   游客账号「认设备」就靠这一串。首次启动生成一个随机串，之后一直用它
   换同一个 uid —— 孩子不注册也能一直玩下去，进度不会每次重开都清零。

   ## 为什么存 localStorage，不存 Dexie

   Dexie 的表会进备份 / 导出（`db.ts` 的导出是整表扫的）。设备号是**凭据**：
   跟着备份跑到另一台设备上，那台机器就会顶掉原主人的账号 —— 和
   `api/session.ts` 里的 token 是同一类东西，所以放同一层。

   ## 为什么不是「设备指纹」

   指纹（UA + 屏幕 + 时区…）看着更省事，但它会**误伤**：同一款手机的两个孩子
   指纹一模一样，第二个人进来直接看到第一个人的账号。宁可换机时认不出来，
   也不能让两个孩子串号。

   ## 存不住怎么办

   隐私模式下 localStorage 会抛，这时只能退化成「本次运行有效」——
   重开 App 就是一个新账号。`deviceIdPersisted()` 把这个事实暴露出去，
   界面上的「临时账号」提示照旧成立（本来就该说清楚）。
   ============================================================ */

const KEY = 'kqf.device.id.v1'

/** 服务端 `deviceIDRe` 的白名单，两边必须一致（服务端拒了只会报「参数错误」） */
const SHAPE = /^[A-Za-z0-9_-]{8,64}$/

let memo: string | null = null
let persisted = true

function makeId(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  /* 老 WebView 没有 randomUUID（Android 8 的 WebView 就没有）。
     退回 getRandomValues；再没有就只能 Math.random —— 那种情况下
     设备号本来也不安全，够用即可，别为了它把整个启动流程卡住。 */
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** 这台设备的标识。同一次运行里恒定，跨启动也恒定（除非存不住）。 */
export function getDeviceId(): string {
  if (memo) return memo

  try {
    const saved = localStorage.getItem(KEY)
    /* 形状不对就当没有：手改过的、被别的版本写坏的，拿去请求服务端
       只会得到一句「参数错误」，而人根本看不出是设备号的问题。 */
    if (saved && SHAPE.test(saved)) {
      memo = saved
      return memo
    }
  } catch {
    persisted = false
  }

  const id = makeId()
  memo = id
  try {
    localStorage.setItem(KEY, id)
  } catch {
    persisted = false
    console.warn('[kqf] 设备号存不住（隐私模式？）—— 重开 App 会是一个新账号')
  }
  return memo
}

/** 设备号是否真的落盘了。`false` ⇒ 重开就是新账号，界面上要说得更明白。 */
export function deviceIdPersisted(): boolean {
  if (!memo) getDeviceId()
  return persisted
}

/** 测试用：清掉内存里那份（localStorage 由测试自己清） */
export function __resetDeviceIdForTest() {
  memo = null
  persisted = true
}
