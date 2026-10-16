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
import { CLAW_HOLE_CENTER, CLAW_RAIL_Y, createClawStage, type ClawStage } from './clawScene'
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

/** 待命高度：爪子贴着轨道下沿（和 `clawScene` 里缆绳锚点同一个高度）。 */
const HUB_TOP = CLAW_RAIL_Y - 0.02

/**
 * 抓取高度：爪子刚好罩住**最上面那层**娃娃的耳朵。
 *
 * 池子是三层堆起来的（见 `clawScene` 的 `initialPrizeLayout`），最上面那层
 * 在 y = 0.225、娃娃顶大约再高 0.16（耳朵 `position.y = 0.13` + 半径 0.03，
 * 见 `makePlush`）⇒ 0.42 就是「爪子压在顶层娃娃头上」。
 *
 * ⚠️ 这个数**跟着那三层走**：改堆的高度就要回来改它，否则爪子会穿进娃娃里
 * （或者悬在半空夹空气）。而被夹住的那只是摆在 `hubY − 0.16` 的，
 * 所以 0.42 时娃娃被提到略高于原位，看着就是「被提起来了」。
 */
const HUB_BOTTOM = 0.42

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

  const [busy, setBusy] = useState(false)
  const [noWebgl, setNoWebgl] = useState(false)
  const [result, setResult] = useState<{ text: string; won: boolean } | null>(null)

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
        ? `换到 ${r.coupons} 点券`
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

    /*
      走查脚本的钩子。

      `debugFrame()` 报的是「柜子投影到画布上的包围盒」——那是**相机算出来的**，
      DOM 里读不到，所以「柜子完整在容器里」这条判据只能从这里问。
      只读、不改行为；卸载时删掉，免得脚本拿到一个已经 `dispose()` 的场景。
    */
    ;(window as unknown as { __kqfClawStage?: ClawStage }).__kqfClawStage = s

    // 先画一帧静态的，别让容器空着（不然要等到第一次 rAF 才有画面）
    s.render(0, {
      clawX: aim.current.x,
      clawZ: aim.current.z,
      hubY: HUB_TOP,
      close: 0,
      held: null,
      winFlash: 0,
      busy: false,
    }, rmRef.current)

    return () => {
      delete (window as unknown as { __kqfClawStage?: ClawStage }).__kqfClawStage
      s.dispose()
      stage.current = null
    }
  }, [])

  /* ---------------- 每帧循环 ---------------- */

  useEffect(() => {
    let raf = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const s = stage.current
      if (!s) return
      const rm = rmRef.current
      const flash = flashRef.current > now ? 1 : 0
      const r = roundRef.current

      if (!r) {
        // 空闲：爪子停在瞄准位；刚演完那一局先停在取物口一会儿
        const at = holdRef.current > now ? CLAW_HOLE_CENTER : aim.current
        s.render(now / 1000, {
          clawX: at.x,
          clawZ: at.z,
          hubY: HUB_TOP,
          close: 0,
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
      s.render(now / 1000, {
        clawX: pos.x,
        clawZ: pos.z,
        hubY: clawHubYAt(m, HUB_TOP, HUB_BOTTOM),
        close: clawCloseAt(m),
        held: holding ? r.held : null,
        winFlash: flash,
        busy: m.phase !== 'idle' && m.phase !== 'done',
      }, rm)

      if (m.phase === 'done') finish(r)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
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
    const held = res.won && near.index >= 0 ? near.index : null

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
      startedAt: performance.now(),
    }

    if (rmRef.current) {
      // 关了动效：不播动画，直接把结果给孩子（姿势停在取物口）
      finish(round)
      return
    }
    roundRef.current = round
  }, [finish])

  /* ---------------- 拖动瞄准 ---------------- */

  const aimAt = useCallback((clientX: number, clientY: number) => {
    const s = stage.current
    if (!s || busyRef.current) return
    // `fieldFromScreen` 自己会把越界点夹在池子边缘（拖不到玻璃外面）
    aim.current = s.fieldFromScreen(clientX, clientY)
  }, [])

  /* ---------------- 界面 ---------------- */

  const canPlay = !busy && coins > 0 && !noWebgl
  const canBuy = !busy && points >= CLAW_PLAY_COST

  return (
    <div className="page-col flex flex-1 flex-col gap-2.5 px-3 pb-3 pt-3">
      {/* 币条：还有几个币 + 换币入口。
          ⚠️ 这里**不再显示 🪙 积分** —— 顶栏（`App.tsx`）常驻显示着，
          同一屏里同一件事出现两次。只在「换币」按钮上写要花几个积分。 */}
      <div className="flex items-center gap-2">
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
        <span className="ml-auto hidden shrink-0 text-xs font-bold text-ink-500 md:block">
          抓到一只 = {econ.exchangePerPrize} 点券
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
        <div
          ref={stageRef}
          data-claw-stage
          role="img"
          aria-label="娃娃机：拖动可以移动爪子"
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
      )}

      {/* 结果 + 下爪 */}
      <div className="flex items-center gap-3">
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
                  +{econ.exchangePerPrize} 点券
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-xs leading-snug text-ink-500">
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
