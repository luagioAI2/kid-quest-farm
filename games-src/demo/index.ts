/**
 * 示例游戏：「许愿池」—— **独立构建产物的样板**（spec §12.5）。
 *
 * ## 这个文件为什么长这样
 *
 * 它是**另一份构建产物**，不在 App 的 Vite 构建里。所以：
 *
 * - **不许 import 宿主的任何运行时模块**（`store/`、`db/`、`features/`）——
 *   那些模块在它的产物里根本不存在，构建时就会炸。
 *   唯一能用的是**类型**（`import type` 编译期就擦掉了，不产生 import）。
 * - **不许有裸模块说明符**（`import x from 'react'` 之类）—— blob 模块解析不了，
 *   加载时会抛「Failed to resolve module specifier」。所以这里**零依赖**，
 *   连 React 都不用（这也顺便证明了契约确实与框架无关）。
 * - 所有能力都从 `host: HostApi` 拿。
 *
 * ## 玩法（故意做得极简，它的作用是证明管道通）
 *
 * 花 5 积分抽一次，抽到的「星」记成自己的币；抽的次数存在自己的键值里。
 * 它用到了 `HostApi` 的**每一类**能力：钱（spendPoints / mintGameCoin /
 * gameCoinBalance）、存储（storage）、反馈（pushToast / tone / haptic）、
 * 只读（balance）。
 *
 * ## ⚠️ `mount` 是**同步**的，异步初始化放在里面自己跑
 *
 * 契约是 `mount(container, host): () => void` —— 同步返回卸载函数。
 * 所以「读存档」这类异步动作**不能** await 在 mount 的顶层：
 * 那样卸载函数要等 promise 才有值，中间那一小段里**卸载会被丢掉**
 * （切走 → 存档还没读完 → 卸载函数还不存在 → 定时器/监听留了下来）。
 * 正确写法见下面：先同步建好 DOM 和卸载函数，再让 async 的 `init()` 去填内容，
 * 并且用 `disposed` 挡住「卸载之后才回来的异步结果」。
 */

import type { GameBundle, HostApi } from '../../src/games/plugin'

/** 一次投入多少积分。**必须和 manifest.economy.playCost 一致** —— 走查脚本会核对。 */
const PLAY_COST = 5

/** 抽一次的产出（自己的币）。必须 < playCost（spec §5.4）。 */
const PAYOUT = 3

/** 奖品表。纯本地数据，不需要宿主参与。 */
const PRIZES = ['🌟', '💫', '✨', '🌙', '☄️'] as const

/** 抽奖次数存在自己的命名空间里（宿主自动加 `<gameId>:` 前缀）。 */
const DRAWS_KEY = 'draws'

const CSS = {
  root: [
    'font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
    'background:#FFFAF2',
    'color:#3A2E28',
    'padding:16px',
    'border-radius:16px',
    'box-sizing:border-box',
  ].join(';'),
  head: 'display:flex;align-items:center;gap:8px;margin-bottom:10px',
  title: 'font-size:18px;font-weight:700;margin:0',
  row: 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px',
  chip: [
    'display:inline-flex;align-items:center;gap:6px',
    'background:#FFF3D6;border-radius:999px;padding:6px 12px',
    'font-size:13px;font-weight:700',
  ].join(';'),
  stage: [
    'min-height:96px;display:flex;align-items:center;justify-content:center',
    'font-size:44px;background:#FFFFFF;border-radius:14px',
    'border:1px solid rgba(58,46,40,0.12);margin-bottom:12px',
  ].join(';'),
  btn: [
    'width:100%;min-height:48px;border:0;border-radius:14px;cursor:pointer',
    'background:#F5C542;color:#3A2E28;font-size:16px;font-weight:700',
    'font-family:inherit',
  ].join(';'),
  note: 'font-size:12px;color:#8A7A70;margin:10px 0 0;line-height:1.6',
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.setAttribute('style', style)
  if (text != null) node.textContent = text
  return node
}

function mount(container: HTMLElement, host: HostApi): () => void {
  container.innerHTML = ''
  container.setAttribute('data-demo-game', 'root')

  const root = el('div', CSS.root)
  root.setAttribute('data-demo-game', 'panel')

  const head = el('div', CSS.head)
  head.append(el('h2', CSS.title, '许愿池'))
  root.append(head)

  const chips = el('div', CSS.row)
  const coinChip = el('span', CSS.chip, '⭐ 0')
  coinChip.setAttribute('data-demo-game', 'coin')
  const drawChip = el('span', CSS.chip, '🎯 抽了 0 次')
  drawChip.setAttribute('data-demo-game', 'draws')
  chips.append(coinChip, drawChip)
  root.append(chips)

  const stage = el('div', CSS.stage, '·')
  stage.setAttribute('data-demo-game', 'stage')
  root.append(stage)

  const btn = el('button', CSS.btn, `花 ${PLAY_COST} 积分抽一次`)
  btn.setAttribute('data-demo-game', 'play')
  root.append(btn)

  root.append(
    el(
      'p',
      CSS.note,
      '这个游戏是独立构建的包，通过 mount(container, hostApi) 挂进来。' +
        '它的次数和星币存在自己的命名空间里。',
    ),
  )

  container.append(root)

  /* ---------------- 状态 ---------------- */

  let disposed = false
  let busy = false
  let draws = 0

  async function paint(): Promise<void> {
    if (disposed) return
    coinChip.textContent = `⭐ ${await host.gameCoinBalance()}`
    if (disposed) return
    drawChip.textContent = `🎯 抽了 ${draws} 次`
    const poor = host.balance() < PLAY_COST
    btn.textContent = poor ? `积分不够（要 ${PLAY_COST}）` : `花 ${PLAY_COST} 积分抽一次`
    btn.disabled = busy || poor
    btn.setAttribute('style', `${CSS.btn}${busy || poor ? ';opacity:.5;cursor:default' : ''}`)
  }

  async function play(): Promise<void> {
    if (busy || disposed) return
    busy = true
    await paint()

    const paid = await host.spendPoints(PLAY_COST, '许愿池抽一次')
    if (disposed) return
    if (!paid) {
      host.pushToast({ kind: 'warn', title: '积分不够啦' })
      host.tone('fail')
      busy = false
      await paint()
      return
    }

    const prize = PRIZES[Math.floor(Math.random() * PRIZES.length)]
    stage.textContent = prize
    await host.mintGameCoin(PAYOUT, `许愿池 · ${prize}`)
    draws += 1
    await host.storage.set(DRAWS_KEY, draws)
    if (disposed) return

    host.tone('coin')
    host.haptic()
    host.pushToast({ kind: 'success', title: `抽到 ${prize}`, detail: `星币 +${PAYOUT}` })

    busy = false
    await paint()
  }

  /**
   * ⚠️ 必须**具名**（或存进变量）再注册。
   * `addEventListener('click', () => void play())` 每次都是一个新函数，
   * 于是 `removeEventListener` 拿着另一个新函数去删 —— **一个也删不掉**。
   * 症状是切走再切回来，一次点击抽两次（而且每次切换多抽一次）。
   */
  const onClick = (): void => void play()
  btn.addEventListener('click', onClick)

  /**
   * 定时重绘「按钮能不能点」。
   *
   * ## 为什么必须有这个定时器
   *
   * 按钮的可用性取决于**宿主的积分余额**（`host.balance()`），而余额会在
   * 游戏挂载**之后**变 —— 家长去任务页加个分、或者孩子刚结算完一笔。
   * `HostApi` 上**没有**「余额变了通知我」这种订阅（那是宿主的事，不该塞进
   * 契约里），所以游戏只能自己隔一会儿问一次。
   *
   * 没有它的话，症状是：孩子把积分花光 → 按钮变灰 → 家长加了分 →
   * **按钮永远灰着**，得退出重进。而且不报错，看起来像「加了分没用」。
   *
   * ## 它顺便证明了一件事
   *
   * 这个定时器**必须在卸载时清掉** —— 这正是契约要求 `mount` 返回
   * 卸载函数的原因。走查脚本会验「切走再切回来，定时器没留下第二个」。
   */
  const REPAINT_MS = 1500
  const repaintTimer = setInterval(() => void paint(), REPAINT_MS)

  // 异步初始化：不 await，但要能在卸载后停下来（`paint` 里有 disposed 闸）
  void (async () => {
    draws = (await host.storage.get<number>(DRAWS_KEY)) ?? 0
    await paint()
  })()

  return () => {
    disposed = true
    clearInterval(repaintTimer)
    btn.removeEventListener('click', onClick)
    container.innerHTML = ''
  }
}

const bundle: GameBundle = {
  manifest: {
    id: 'demo',
    name: '许愿池',
    emoji: '🌟',
    tabLabel: '许愿池',
    version: '1.0.0',
    minHostApi: 1,
    coin: { id: 'star', name: '星币', emoji: '⭐' },
    economy: { playCost: PLAY_COST, expectedPayout: PAYOUT, capPerPrize: 9 },
  },
  mount,
}

export default bundle
