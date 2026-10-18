import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '@/store/useApp'
import { hapticLight, playTone } from '@/platform/files'
import {
  CLAW_COIN_EMOJI,
  CLAW_COIN_NAME,
  CLAW_DEFAULT_EXCHANGE,
  CLAW_DEFAULT_WIN_RATE,
  CLAW_PLAY_COST,
  clampClawEconomy,
} from '@/domain/clawEconomy'
import {
  CLAW_HOLE_CENTER,
  CLAW_HX,
  CLAW_HZ,
  CLAW_PRONG_IDLE,
  CLAW_RAIL_Y,
  CLAW_THEMES,
  createClawStage,
  type ClawStage,
} from './clawScene'
import {
  clawCloseAt,
  clawHoldingAt,
  clawHubYAt,
  clawOutcomeText,
  clawPhaseAt,
  clawPositionAt,
} from './clawTimeline'
import './claw.css'

/* ============================================================
   娃娃机（2026-10-16 从 `E:\plan\test25\claw-machine` 重写进来）

   ## 这一页只做「演出」，不做「判分」

   中不中在**投币那一刻**就由 `store.settleClawRound(index)` 定死了
   （幂等伪随机，见 `domain/clawEconomy.ts` 的头注释）。这一页拿到
   `{ ok, won, coupons }` 之后，只负责把爪子**演得像那么回事**：

     中了   → 合爪、夹起一只、送到取物口
     没中   → 也合爪（演得像夹到了），提到一半滑掉（`SLIP_AT`）

   ★ 为什么不「看物理算出来什么」：物理驱动的抓取**期望值不可控**，
   而期望值正是那条不能破的不变量（`E < 1`）。真实商场的娃娃机也是这个账
   —— 抓力是程序设的，不是物理决定的。

   ## ⚠️ 瞄准**不影响结果**

   孩子会以为「对准了就能抓到」，那只是一种感觉。如果瞄准真的影响中奖率，
   期望值就变成「取决于玩家水平」，家长设的那个数就失效了。
   拖动唯一的作用是**决定爪子下在哪里**（也就是画面）。

   ## ⚠️ 为什么不是「先播动画、结束时再结算」

   那样的话，动画中途刷新 = 这一局没结算（币没扣、券没发），
   而局数也没走 ⇒ 重来一次还是同一个结果。听着无害，但反过来更糟：
   如果拿时间戳当 seed，刷新就成了**重掷**（刷到中为止）。
   ➜ 结算放在**投币那一刻**：币当场扣、券当场发、局数当场 +1。
   动画只是把这件已经发生的事演出来。
   ============================================================ */

/**
 * 待命时 hub 顶面离导轨多远 = **吊杆露出来的长度**。
 *
 * ★★ 2026-10-18：`0`（贴在导轨上）→ **`0.12`**，抄参考实现的 `L_MIN = 0.12`。
 *
 * 差在哪：缆绳是「从小车底面拉到 hub 顶面」的一段圆柱，长度就是这两个点的差。
 * 写成 `RAIL_Y - 0.02` 时差值是 0.02 —— 几乎为 0，缆绳缩成一个点，
 * 待命画面上就是**一个铁疙瘩悬在机顶下方**，没有「吊着」的感觉。
 * 原版待命时爪子上方有一段明显的杆，下落时那段杆才一点点被拉长。
 *
 * 爪子的**行程**没变（`bottomY` 还是探表面算的），变的只是最高点。
 */
const CLAW_HANG_MIN = 0.12
const HUB_TOP = CLAW_RAIL_Y - CLAW_HANG_MIN

/**
 * 爪子下爪时，hub 停在**探测到的面**上方多少。
 *
 * 原版是 `stopAt = max(PIVOT_MIN_Y, surf + 0.012)`，其中 `stopAt` 是**爪子底部**
 * 的高度；换成 hub 中心就是 `surf + 0.012 + HUB_HH(0.03) = surf + 0.042`。
 *
 * ⚠️ 这个值**不是**「爪子不碰到娃娃」的间隙 —— 恰恰相反，指头会压进娃娃 9 cm
 * （指头总长 ≈ 0.13，hub 中心只比娃娃顶高 0.042）。原版就是这样：爪子**扎进**池子
 * 里合爪，而不是悬在娃娃头顶上夹空气。想让它「不穿模」而调大这个数，
 * 反而会回到「悬在半空」那个毛病。
 */
const CLAW_STOP_GAP = 0.042

/**
 * hub 中心最低能到哪（`PIVOT_MIN_Y` + `HUB_HH`）。
 *
 * 池底是 y=0，但爪子不能真的贴到 0.042 —— 那是指头会插进地板。
 * 原版的 `PIVOT_MIN_Y = 0.13` 就是「爪子底部离地 0.13」，换成 hub 中心 = 0.16。
 */
const HUB_MIN_Y = 0.16

/**
 * 「爪子底下有娃娃」的判定半径。
 *
 * 娃娃半径 ≈ 0.075 × 0.92 ≈ 0.07，初始布局的格距 ≈ 0.18
 * （见 `initialPrizeLayout` 的 cols/rows）。取 0.12：够宽，不会把「明明对着
 * 娃娃」判成「差一点」；又小于格距，不会把邻座也算进来。
 *
 * ⚠️ 这个数**只影响没中时那句文案**（「滑掉了」vs「差一点」），
 * 不影响中不中 —— 别把它当成中奖范围。
 */
const GRAB_RANGE = 0.12

/**
 * 摇杆 / 键盘 / 手柄的移动速度（世界单位 / 秒）。
 *
 * 池子宽 `2 × CLAW_HX = 1.16`、深 `2 × CLAW_HZ = 1.0`。
 * 0.52 ⇒ 横穿一次约 2.2 秒：够快（不用等），又够细
 * （60 帧下每帧只走 0.0087，能停在两只娃娃之间）。
 *
 * ⚠️ 这个值**只影响手感**，不影响中奖率 —— 瞄准哪里都不改变结果
 * （见 `clawTimeline.ts` 头注释）。
 */
const AIM_SPEED = 0.52

/**
 * 爪子离玻璃的边缘留白。
 * ⚠️ **必须和 `clawScene.fieldFromScreen` 里的 `pad` 一致** —— 不一致的话，
 * 拖到边缘停下的位置和摇杆推到边缘停下的位置会差一截，同一个池子两种边界。
 */
const AIM_PAD = 0.09

/** 夹到区间里。`MathUtils.clamp` 要 import three，这里不值得为一行拉进来。 */
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v)

/** 移动用的键：WASD + 方向键（和参考实现一致）。 */
const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
])

/**
 * 虚拟摇杆的四个方向。
 *
 * ⚠️ `z` 的符号和屏幕是**反的**：`fieldFromScreen` 里屏幕往下 = 世界 z 变大，
 * 所以「上」是 `z: -1`。写成 +1 的话上下会颠倒，而拖动瞄准又是对的 ——
 * 这种「两种输入方向相反」的 bug 只有真按一次才发现。
 */
const DPAD = [
  { x: 0, z: -1, label: '上', glyph: '▲', cls: 'col-start-2 row-start-1' },
  { x: -1, z: 0, label: '左', glyph: '◀', cls: 'col-start-1 row-start-2' },
  { x: 1, z: 0, label: '右', glyph: '▶', cls: 'col-start-3 row-start-2' },
  { x: 0, z: 1, label: '下', glyph: '▼', cls: 'col-start-2 row-start-3' },
] as const

/** 一局的完整状态。`startedAt` 是 `performance.now()`。 */
interface Round {
  won: boolean
  coupons: number
  /** 被爪子夹着的那只娃娃的下标；池子里一只都没有时是 `null` */
  held: number | null
  /** 下爪那一刻爪子底下有没有娃娃 —— 决定没中时说的是「滑掉了」还是「差一点」 */
  hadPrize: boolean
  /** 爪子从哪儿下去（瞄准点；中了但没对准时会被挪到最近那只娃娃头上） */
  fromX: number
  fromZ: number
  /**
   * 这一局 hub 下到的最低高度 —— 投币那一刻按 `(fromX, fromZ)` 探出来的。
   *
   * ★ 只在开局算**一次**，不是每帧算：下爪过程中爪子会把娃娃推开，
   *   每帧重探的话目标高度会一路往下爬，看着像爪子「陷进」池子里。
   *   开局定死 = 这一局的下爪深度是确定的，同一局重放也一样。
   */
  bottomY: number
  startedAt: number
}

export default function ClawPage() {
  const coins = useApp((s) => s.clawCoins)
  const points = useApp((s) => s.balance)
  const winRateRaw = useApp((s) => s.settings.clawWinRate ?? CLAW_DEFAULT_WIN_RATE)
  const exchangeRaw = useApp((s) => s.settings.clawExchangePerPrize ?? CLAW_DEFAULT_EXCHANGE)

  /**
   * **实际生效**的经济参数（夹过一遍的）。
   *
   * 页面显示的是 `econ.exchangePerPrize` 而**不是** `exchangeRaw`：
   * 老存档 / 手改过的 IndexedDB 里那个数可能是不安全的，`settleClawRound`
   * 结算时会夹紧。显示原始值 = 跟孩子说一个他拿不到的数目。
   * 夹紧的逻辑只有一份（`clampClawEconomy`），这里只是照抄它。
   */
  const econ = useMemo(
    () => clampClawEconomy({ winRate: winRateRaw, exchangePerPrize: exchangeRaw }),
    [winRateRaw, exchangeRaw],
  )

  const stageRef = useRef<HTMLDivElement>(null)
  const stage = useRef<ClawStage | null>(null)
  /** 爪子现在瞄准池子里的哪一点（世界坐标）。拖动只改它。 */
  const aim = useRef({ x: 0, z: 0 })
  const roundRef = useRef<Round | null>(null)
  /** 这一局结束后，爪子**停在取物口**到什么时候（`performance.now()`）—— 免得它「嗖」地弹回瞄准位 */
  const holdRef = useRef(0)
  /** 取物口灯闪到什么时候 */
  const flashRef = useRef(0)
  /** 防重入：一局没演完，不能再投币 */
  const busyRef = useRef(false)
  /** 关了动效就不播动画（`prefers-reduced-motion`）。循环里每帧读，所以放 ref。 */
  const rmRef = useRef(false)

  /**
   * 键盘当前按下的键（`KeyboardEvent.code`）。
   *
   * ★ 三个输入源（键盘 / 虚拟摇杆 / 手柄）在每帧循环里**合成一个**方向，
   * 不各自改 `aim.current`。各自改的话「按住 D + 推摇杆」会每帧互相覆盖，
   * 松手时还会留下一个没清掉的方向。
   */
  const keysRef = useRef(new Set<string>())
  /** 手柄按钮的上一帧状态 —— 做「按下沿」检测，按住不能连发投币 */
  const padPrevRef = useRef<boolean[]>([])
  /** 上一帧的时间戳（算 dt 用；不用固定步长，掉帧时移动才不会变慢） */
  const lastFrameRef = useRef(0)
  /** 摇杆是否正被按住（按住才移动；抬起立刻停） */
  const joyRef = useRef({ x: 0, z: 0, active: false })
  /**
   * 键盘「按了一下」的**锁存**：`keydown` 里置位，每帧循环消费一次。
   *
   * ★ 为什么不是「循环里读 `keysRef` 判断按下沿」：
   *   一次很快的按键（`keydown` + `keyup` 落在同一帧之间）在循环里**完全看不到** ——
   *   这一帧读到的是「没按」，下一帧已经是「松开」，于是空格什么都不做。
   *   实测就是这么丢的：`keyboard.press('Space')` 默认零间隔，连续几局都没开始，
   *   而 `debugVisual` 里爪子一动不动 —— 看着像「键盘坏了」。
   *
   *   锁存之后，哪怕按下和抬起在同一毫秒，动作也一定会被执行一次。
   *   `keydown` 的自动重复不会重复置位（`keysRef` 里已经有了这个 code）。
   */
  const tapRef = useRef({ play: false, buy: false })
  /**
   * 下爪 / 换币的**最新实现**。
   * 循环 effect 在 `play` / `buy` 之前定义（源码顺序），闭包里拿不到它们 ⇒
   * 用 ref 过渡。直接写 `playRef.current = play` 会捕获第一次渲染的版本，
   * 所以赋值处包一层箭头函数（每次渲染都指向最新的那个 `play`）。
   */
  const playRef = useRef<() => void>(() => {})
  const buyRef = useRef<() => void>(() => {})

  const [busy, setBusy] = useState(false)
  const [noWebgl, setNoWebgl] = useState(false)
  const [result, setResult] = useState<{ text: string; won: boolean } | null>(null)

  /**
   * 配色：**唯一事实源是 store**（`settings.clawTheme`），不在页面里另存一份 state。
   * 存两份的话，「设置页改了配色」和「这页刚换的」就会走散。
   */
  const themeIdx = useApp((s) => s.settings.clawTheme ?? 0)
  /** 建场景的 effect 依赖是 `[]`，闭包里读不到最新的 `themeIdx` ⇒ 用 ref 过渡 */
  const themeRef = useRef(themeIdx)
  themeRef.current = themeIdx

  /* ---------------- 动效偏好 ---------------- */

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      rmRef.current = mq.matches
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  /* ---------------- 一局的收尾 ---------------- */

  /**
   * 一局演完了：出文案、响一声、给个震动。
   *
   * 用 `useCallback([])` + `useApp.getState()` 而不是订阅 store：
   * 这个函数会被 rAF 循环闭包捕获，依赖一变循环就得重建，
   * 而重建的那一帧正好可能落在 `done` 上 —— 那就是**结算两次**。
   * 从 `getState()` 现读永远是最新的，且身份恒定。
   */
  const finish = useCallback((r: Round) => {
    roundRef.current = null
    busyRef.current = false
    setBusy(false)

    const now = performance.now()
    holdRef.current = now + 900
    if (r.won) flashRef.current = now + 1500

    const text = clawOutcomeText(r.won, r.hadPrize)
    setResult({ text, won: r.won })

    const st = useApp.getState()
    st.pushToast({
      kind: r.won ? 'success' : 'info',
      title: text,
      detail: r.won
        ? `换到 ${r.coupons} 商城币`
        : r.hadPrize
          ? '夹住了又滑掉了，再试一次'
          : '爪子底下没有娃娃',
      emoji: r.won ? '🎉' : '🙂',
    })
    void playTone(st.settings.soundEnabled, r.won ? 'success' : 'fail')
    void hapticLight(st.settings.hapticsEnabled)
  }, [])

  /* ---------------- 建场景 / 拆场景 ---------------- */

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const s = createClawStage(el)
    if (!s) {
      // WebGL 起不来就**不抛** —— 页面改成一句说明（见 JSX）。
      setNoWebgl(true)
      return
    }
    stage.current = s
    // 建场景时用的是默认（粉），先把存档里选的配色补上
    s.setTheme(themeRef.current)

    /*
      走查脚本的钩子。

      `debugFrame()` 报的是「柜子投影到画布上的包围盒」——那是**相机算出来的**，
      DOM 里读不到，所以「柜子完整在容器里」这条判据只能从这里问。
      只读、不改行为；卸载时删掉，免得脚本拿到一个已经 `dispose()` 的场景。
    */
    ;(window as unknown as { __kqfClawStage?: ClawStage }).__kqfClawStage = s

    /*
      ★ 瞄准点的**测试**写入口（只有走查脚本用）。

      为什么需要它：默认瞄准点是池子正中 `(0, 0)`，而三层摆放的正中间
      恰好是**空隙**（见 `clawScene.initialPrizeLayout`）—— 那是一个合法的
      「对着空地按下去」场景，但走查还想证明「对着娃娃按下去会停在娃娃顶上」。
      没有这个入口，就只能靠按住方向键几百毫秒去凑位置，而那个时长在软件渲染下
      不可复现（同一份脚本两次跑到的落点不一样）。

      它和拖动 / 方向键走的是**同一个** `aim.current`，不绕过任何逻辑。
    */
    ;(window as unknown as { __kqfClawAim?: (x: number, z: number) => void }).__kqfClawAim = (
      x: number,
      z: number,
    ) => {
      aim.current = {
        x: clamp(x, -CLAW_HX + AIM_PAD, CLAW_HX - AIM_PAD),
        z: clamp(z, -CLAW_HZ + AIM_PAD, CLAW_HZ - AIM_PAD),
      }
    }

    // 先画一帧静态的，别让容器空着（不然要等到第一次 rAF 才有画面）
    s.render(0, {
      clawX: aim.current.x,
      clawZ: aim.current.z,
      hubY: HUB_TOP,
      close: 0,
      spread: CLAW_PRONG_IDLE,
      held: null,
      winFlash: 0,
      busy: false,
    }, rmRef.current)

    return () => {
      delete (window as unknown as { __kqfClawStage?: ClawStage }).__kqfClawStage
      delete (window as unknown as { __kqfClawAim?: (x: number, z: number) => void }).__kqfClawAim
      s.dispose()
      stage.current = null
    }
  }, [])

  /* ---------------- 换配色 ---------------- */

  // store 里的配色变了就同步进场景（换色按钮走这一条，页面不另存 state）
  useEffect(() => {
    stage.current?.setTheme(themeIdx)
  }, [themeIdx])

  /* ---------------- 键盘 ---------------- */

  /**
   * 键盘只**记录按下状态**，真正移动在每帧循环里做（要乘 dt 才不随帧率变快慢）。
   *
   * ⚠️ 只在挂载期间监听，卸载就摘掉 —— 否则切到农场后按空格还会去下爪。
   * ⚠️ `preventDefault` 只对方向键和空格：别的键照常让浏览器处理，
   * 否则会破坏 Tab 焦点和页面滚动，那是无障碍问题，不只是手感。
   * ⚠️ 窗口失焦要**清空**：不然「按住 D 切走再回来」会一直往右走。
   */
  useEffect(() => {
    const isTyping = (t: EventTarget | null): boolean => {
      const el = t as HTMLElement | null
      return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return
      // 新按下（不是自动重复）→ 锁存一次动作键
      if (!keysRef.current.has(e.code)) {
        if (e.code === 'Space') tapRef.current.play = true
        if (e.code === 'Enter') tapRef.current.buy = true
      }
      keysRef.current.add(e.code)
      if (MOVE_KEYS.has(e.code) || e.code === 'Space') e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code)
    }
    const blur = () => {
      keysRef.current.clear()
      tapRef.current.play = false
      tapRef.current.buy = false
    }

    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
      keysRef.current.clear()
    }
  }, [])

  /* ---------------- 每帧循环 ---------------- */

  useEffect(() => {
    let raf = 0

    /*
      输入合成：键盘 / 虚拟摇杆 / 手柄 → **一个**方向。

      ★ 为什么三路都要走这里而不是各自改 `aim.current`：
        各自改的话，「推着摇杆同时按 D」会每帧互相覆盖，结果取决于执行顺序；
        松手时还会留下一个没清掉的方向。合成成一个 `(dx, dz)` 就没有这个问题。
      ★ 优先级：虚拟摇杆 > 手柄 > 键盘。摇杆是触屏上最直接的意图，
        手柄摇杆是模拟量（比键盘的 ±1 细腻），键盘是离散的。
    */
    /** 手柄按钮的「按下沿」 */
    const padEdge = (pads: (Gamepad | null)[], idx: number): boolean => {
      const pressed = !!pads[0]?.buttons[idx]?.pressed
      const prev = padPrevRef.current[idx] ?? false
      padPrevRef.current[idx] = pressed
      return pressed && !prev
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const s = stage.current
      if (!s) return
      const rm = rmRef.current
      const flash = flashRef.current > now ? 1 : 0
      const r = roundRef.current

      /* ---------------- ① 合成输入 ---------------- */
      const k = keysRef.current
      let dx = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0)
      let dz = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0)

      const pads = navigator.getGamepads?.() ?? []
      const gp = pads[0]
      if (gp) {
        const ax = gp.axes[0] ?? 0
        const ay = gp.axes[1] ?? 0
        // 0.18 的死区：手柄摇杆回中时会有零点几的漂移，不去掉会自己慢慢走
        if (Math.hypot(ax, ay) > 0.18) {
          dx = ax
          dz = ay
        }
      }
      if (joyRef.current.active) {
        dx = joyRef.current.x
        dz = joyRef.current.z
      }
      // 斜着推不能比直着推快
      const mag = Math.hypot(dx, dz)
      if (mag > 1) {
        dx /= mag
        dz /= mag
      }

      /* ---------------- ② 移动瞄准点 ---------------- */
      // dt 用真实间隔（掉帧时移动不会变慢）；封顶 0.1s 防止切回标签页时瞬移
      const dt = lastFrameRef.current ? Math.min(0.1, (now - lastFrameRef.current) / 1000) : 0
      lastFrameRef.current = now
      // 一局演完之前不给动 —— 和拖动瞄准同一条规矩（`aimAt` 里也是这么判的）
      if (!busyRef.current && (dx !== 0 || dz !== 0)) {
        aim.current = {
          x: clamp(aim.current.x + dx * AIM_SPEED * dt, -CLAW_HX + AIM_PAD, CLAW_HX - AIM_PAD),
          z: clamp(aim.current.z + dz * AIM_SPEED * dt, -CLAW_HZ + AIM_PAD, CLAW_HZ - AIM_PAD),
        }
      }

      /* ---------------- ③ 按钮 ---------------- */
      // 空格 / 手柄 A = 下爪；回车 / 手柄 X = 换币
      // 键盘走**锁存**（见 `tapRef` 的注释），手柄走按下沿
      const tapPlay = tapRef.current.play
      const tapBuy = tapRef.current.buy
      tapRef.current.play = false
      tapRef.current.buy = false
      if (tapPlay || padEdge(pads, 0)) playRef.current()
      if (tapBuy || padEdge(pads, 2)) buyRef.current()

      /* ---------------- ④ 渲染 ---------------- */
      if (!r) {
        // 空闲：爪子停在瞄准位；刚演完那一局先停在取物口一会儿
        const at = holdRef.current > now ? CLAW_HOLE_CENTER : aim.current
        s.render(now / 1000, {
          clawX: at.x,
          clawZ: at.z,
          hubY: HUB_TOP,
          close: 0,
          // 待命：微张。张到最大会像个蜘蛛趴在轨道上
          spread: CLAW_PRONG_IDLE,
          held: null,
          winFlash: flash,
          busy: false,
        }, rm)
        return
      }

      const m = clawPhaseAt((now - r.startedAt) / 1000)
      const pos = clawPositionAt(m, { x: r.fromX, z: r.fromZ }, CLAW_HOLE_CENTER)
      // `held` 只在「这一刻手里真有东西」时才传 —— 滑掉之后娃娃就回池子了
      const holding = r.held !== null && clawHoldingAt(m, r.won)
      /*
        张开程度（见 `clawScene` 的 `ClawVisual.spread`）。

        ★ 下爪 / 合爪 / 松手这三段**必须张到最大**：
          · 下爪：不张开就只是个「垂直移动的铁疙瘩」，看不出要抓；
          · 合爪：`close` 从 0 走到 1，起点得是最大张角，才有 73° 的合拢行程；
          · 松手：`close` 从 1 回到 0，不张到最大就成了「慢慢松开一条缝」。
        其余（提起 / 平移）已经合上了，用待命角度即可。
      */
      const spread =
        m.phase === 'drop' || m.phase === 'close' || m.phase === 'release' ? 1 : CLAW_PRONG_IDLE
      s.render(now / 1000, {
        clawX: pos.x,
        clawZ: pos.z,
        hubY: clawHubYAt(m, HUB_TOP, r.bottomY),
        close: clawCloseAt(m),
        spread,
        held: holding ? r.held : null,
        winFlash: flash,
        busy: m.phase !== 'idle' && m.phase !== 'done',
      }, rm)

      if (m.phase === 'done') finish(r)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      lastFrameRef.current = 0
    }
  }, [finish])

  /* ---------------- 买币 ---------------- */

  const buy = useCallback(async () => {
    const st = useApp.getState()
    if (busyRef.current) return
    if (st.balance < CLAW_PLAY_COST) {
      st.pushToast({
        kind: 'warn',
        title: '积分不够',
        detail: `换 1 个${CLAW_COIN_NAME}要 ${CLAW_PLAY_COST} 积分`,
        emoji: '🪙',
      })
      return
    }
    const ok = await st.buyClawCoin()
    st.pushToast(
      ok
        ? { kind: 'success', title: '换好了', detail: `多了 1 个${CLAW_COIN_NAME}`, emoji: '✅' }
        : { kind: 'warn', title: '没换成', detail: '积分不够', emoji: '⚠️' },
    )
    if (ok) void playTone(st.settings.soundEnabled, 'coin')
  }, [])

  /* ---------------- 投币下爪 ---------------- */

  const play = useCallback(async () => {
    if (busyRef.current) return
    const st = useApp.getState()
    if (st.clawCoins <= 0) {
      st.pushToast({
        kind: 'warn',
        title: `没有${CLAW_COIN_NAME}了`,
        detail: `先花 ${CLAW_PLAY_COST} 积分换一个`,
        emoji: '🪙',
      })
      void playTone(st.settings.soundEnabled, 'fail')
      return
    }

    busyRef.current = true
    setBusy(true)
    setResult(null)

    // ★ 结果在**投币这一刻**定死。`clawPlays` 就是「这是第几局」，
    //   而它只在结算之后 +1 ⇒ 同一局刷新也是同一个结果。
    const res = await st.settleClawRound(st.clawPlays)
    if (!res.ok) {
      // 币一个都没扣成（并发撞车 / 余额刚被别的入口花掉）。
      // ⚠️ 这里**不能**按「没抓到」处理 —— 那是给孩子说一句假话。
      busyRef.current = false
      setBusy(false)
      st.pushToast({ kind: 'warn', title: '这一局没开始', detail: '币不够了', emoji: '⚠️' })
      return
    }

    const s = stage.current
    const aim0 = { ...aim.current }
    const near = s ? s.nearestPrize(aim0.x, aim0.z) : { index: -1, dist: Infinity }
    // 这句文案问的是「**孩子瞄的地方**底下有没有娃娃」，所以用原始瞄准点算
    const hadPrize = near.dist <= GRAB_RANGE
    /*
      「手里夹着哪一只」。

      ★ 中奖：**一定**夹最近那只（下面会把下爪点挪过去），所以不管瞄得准不准。
      ★ 没中：只有**爪子底下真有娃娃**时才夹 —— 那才是「夹住了又滑掉」。
        底下是空地就不该凭空抓一只（`clawOutcomeText` 会说「差一点」）。

      ⚠️ 以前这里写的是 `res.won && ...`，也就是**没中就永远不夹**。
        结果是 `clawTimeline.clawHoldingAt()` 里那条「没中 → 提到 SLIP_AT 松手」
        的分支**从来没被执行过** —— 孩子看到的是「对着娃娃夹了个空」，
        而 toast 上写着「夹住了又滑掉了」。两套说法，物理一接手就更明显了。
    */
    const held = near.index < 0 ? null : res.won || hadPrize ? near.index : null

    /*
      中了、但孩子瞄的是空地：把下爪点挪到最近那只娃娃头上。

      不挪的话爪子会在半空合上，而被夹住的那只在 `render` 里是直接
      `position.set` 到爪子上的（见 clawScene 的娃娃循环）—— 那一跳很显眼。
      挪一下就是「爪子伸过去把最近的捞起来了」，看着合理。
    */
    let from = aim0
    if (res.won && near.index >= 0 && near.dist > GRAB_RANGE) {
      const p = s?.prizeAt(near.index)
      if (p) from = { x: p.x, z: p.z }
    }

    void playTone(st.settings.soundEnabled, 'coin')
    void hapticLight(st.settings.hapticsEnabled)

    const round: Round = {
      won: res.won,
      coupons: res.coupons,
      held,
      hadPrize,
      fromX: from.x,
      fromZ: from.z,
      bottomY: s
        ? Math.max(HUB_MIN_Y, s.surfaceAt(from.x, from.z) + CLAW_STOP_GAP)
        : HUB_MIN_Y,
      startedAt: performance.now(),
    }

    if (rmRef.current) {
      // 关了动效：不播动画，直接把结果给孩子（姿势停在取物口）
      finish(round)
      return
    }
    roundRef.current = round
  }, [finish])

  // 循环里的「空格 / 手柄 A」要能调到**最新**的 play / buy（见 playRef 的注释）
  playRef.current = () => void play()
  buyRef.current = () => void buy()

  /* ---------------- 拖动瞄准 ---------------- */

  const aimAt = useCallback((clientX: number, clientY: number) => {
    const s = stage.current
    if (!s || busyRef.current) return
    // `fieldFromScreen` 自己会把越界点夹在池子边缘（拖不到玻璃外面）
    aim.current = s.fieldFromScreen(clientX, clientY)
  }, [])

  /* ---------------- 换色 ---------------- */

  /**
   * 换配色。**只写 store**，场景由 `[themeIdx]` 那个 effect 同步。
   * 不在这里直接调 `stage.setTheme` —— 那样「设置页改配色」这条路就漏了，
   * 同一个状态两条写入路径，迟早走散。
   */
  const pickTheme = useCallback((i: number) => {
    void useApp.getState().updateSettings({ clawTheme: i })
    void hapticLight(useApp.getState().settings.hapticsEnabled)
  }, [])

  /* ---------------- 界面 ---------------- */

  const canPlay = !busy && coins > 0 && !noWebgl
  const canBuy = !busy && points >= CLAW_PLAY_COST

  return (
    <div className="kqf-claw-page page-col flex flex-1 flex-col gap-2.5 px-3 pb-3 pt-3">
      {/* 币条：还有几个币 + 换币入口。
          ⚠️ 这里**不再显示 🪙 积分** —— 顶栏（`App.tsx`）常驻显示着，
          同一屏里同一件事出现两次。只在「换币」按钮上写要花几个积分。 */}
      <div className="kqf-claw-coins flex items-center gap-2">
        <span
          data-claw-coins
          aria-label={`${CLAW_COIN_NAME} ${coins}`}
          className="flex shrink-0 items-center gap-1 rounded-full bg-sky-200 px-3 py-1.5 shadow-flat"
        >
          <span className="text-base leading-none">{CLAW_COIN_EMOJI}</span>
          <span className="tnum font-display text-base font-extrabold leading-none text-ink-900">
            {coins}
          </span>
          <span className="text-xs font-bold text-ink-700">个币</span>
        </span>
        <button
          onClick={() => void buy()}
          disabled={!canBuy}
          data-claw-buy
          className="btn h-11 shrink-0 rounded-full bg-sun-300 px-3 text-sm font-extrabold text-ink-900 shadow-flat active:btn-press disabled:opacity-50"
        >
          🪙 {CLAW_PLAY_COST} 换 1 个
        </button>
        <span className="kqf-claw-rate ml-auto hidden shrink-0 text-xs font-bold text-ink-500 md:block">
          抓到一只 = {econ.exchangePerPrize} 商城币
        </span>
      </div>

      {/* 画布容器。`flex-1` ⇒ 高度吃掉剩下的空间，取景交给场景里的
          `contain`（同一款游戏要在 430px 和 1024px 下都完整）。 */}
      {noWebgl ? (
        <div className="flex flex-1 items-center justify-center rounded-[1.25rem] bg-paper-2 p-6">
          <p className="text-center text-sm leading-relaxed text-ink-500">
            这台设备的浏览器打不开 3D 画面，
            <br />
            娃娃机暂时玩不了。
          </p>
        </div>
      ) : (
        /*
          ⚠️ 画布外面包一层 `relative`，摇杆和色块是它的**兄弟节点**，
          不是画布的子节点。原因：画布带 `role="img"`，里面塞按钮是无效的
          ARIA（读屏软件会把按钮当成图片的一部分读掉）。
          包一层之后，按钮既在视觉上叠在画面上，语义上又是独立的控件。
        */
        <div className="kqf-claw-stagewrap relative flex flex-1 flex-col">
          <div
            ref={stageRef}
            data-claw-stage
            role="img"
            aria-label="娃娃机：拖动可以移动爪子，也可以用右下角的方向键"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              aimAt(e.clientX, e.clientY)
            }}
            onPointerMove={(e) => {
              // 只认「按着拖」；`pointercapture` 之后移出容器也能继续跟
              if (e.buttons === 0) return
              aimAt(e.clientX, e.clientY)
            }}
            className="kqf-claw-stage"
          />

          {/* 换配色：三颗色块，点一下就换（柜身 / 灯带 / 灯箱 / 背板一起换） */}
          <div
            data-claw-themes
            className="absolute right-2 top-2 flex gap-1.5"
            role="group"
            aria-label="娃娃机配色"
          >
            {CLAW_THEMES.map((th, i) => (
              <button
                key={th.name}
                type="button"
                onClick={() => pickTheme(i)}
                aria-label={`换成${th.name}色`}
                aria-pressed={i === themeIdx}
                data-claw-theme={i}
                className={
                  'size-7 rounded-full border-2 shadow-flat transition-transform active:scale-90 ' +
                  (i === themeIdx ? 'border-ink-900' : 'border-white/80')
                }
                style={{ background: `#${th.accent.toString(16).padStart(6, '0')}` }}
              />
            ))}
          </div>

          {/* 虚拟摇杆：触屏上的「移动爪子」，和拖动瞄准写同一个 `aim`。
              ⚠️ 放**右下**不是左下：左下正好压着取物口（那个黑色圆洞），
              白按钮压在黑洞上既难看，又把「奖品从这里出来」这件事遮掉了。 */}
          <div
            data-claw-dpad
            className="absolute bottom-2 right-2 grid grid-cols-3 grid-rows-3 gap-0.5"
            role="group"
            aria-label="移动爪子"
          >
            {DPAD.map((d) => (
              <button
                key={d.label}
                type="button"
                aria-label={`把爪子往${d.label}移`}
                data-claw-dir={d.label}
                // ⚠️ 按下沿开始移动、抬起/取消/丢捕获都要停。
                //   少一个就会「松手了还在走」——而那是孩子最常遇到的手势
                //   （手指滑出按钮范围）。
                onPointerDown={(e) => {
                  e.stopPropagation()
                  e.currentTarget.setPointerCapture(e.pointerId)
                  joyRef.current = { x: d.x, z: d.z, active: true }
                }}
                onPointerUp={() => {
                  joyRef.current = { x: 0, z: 0, active: false }
                }}
                onPointerCancel={() => {
                  joyRef.current = { x: 0, z: 0, active: false }
                }}
                onLostPointerCapture={() => {
                  joyRef.current = { x: 0, z: 0, active: false }
                }}
                className={
                  'grid size-9 place-items-center rounded-xl border border-white/70 ' +
                  'bg-white/75 text-xs font-extrabold text-ink-700 shadow-flat ' +
                  'active:bg-white ' +
                  d.cls
                }
              >
                {d.glyph}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 结果 + 下爪 */}
      <div className="kqf-claw-foot flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {result ? (
            <span
              key={result.text + String(result.won)}
              data-claw-result
              data-claw-won={result.won ? '1' : '0'}
              className={
                'kqf-claw-result inline-block font-display text-xl font-extrabold ' +
                (result.won ? 'text-grass-600' : 'text-ink-500')
              }
            >
              {result.won ? '🎉 ' : ''}
              {result.text}
              {result.won ? (
                <span className="ml-1 text-sm font-bold text-ink-700">
                  +{econ.exchangePerPrize} 商城币
                </span>
              ) : null}
            </span>
          ) : (
            <span className="kqf-claw-hint text-xs leading-snug text-ink-500">
              按住画面拖动，把爪子移到想抓的娃娃上面。
              <br />
              {CLAW_PLAY_COST} 积分换 1 个币，1 个币玩 1 局。
            </span>
          )}
        </div>
        <button
          onClick={() => void play()}
          disabled={!canPlay}
          data-claw-drop
          className="btn h-14 shrink-0 rounded-2xl bg-grass-300 px-6 font-display text-lg font-extrabold text-ink-900 shadow-flat active:btn-press disabled:opacity-50"
        >
          {busy ? '抓…' : coins > 0 ? '下爪' : '没币了'}
        </button>
      </div>
    </div>
  )
}
