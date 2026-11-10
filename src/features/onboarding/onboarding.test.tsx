/**
 * 回归测试：新手引导（家长设置向导 + 功能导览）。
 * 功能导览是 7 步：前 5 步讲底栏四格 + 顶栏那颗 🪙（给孩子），
 * 后 2 步讲顶栏的「家长确认」和「设置」（给家长，2026-09-21 补）。
 *
 * 这一组里**最值钱的是「重看模式没有密码步骤」那一条**，它守的是一个安全洞：
 *
 *   「重看新手引导」的入口在设置页的「孩子」页里，而那一页是**不锁密码**的。
 *   向导里本来有「设一个家长密码」这一步，而这一步是直接覆盖 `parentPin` 的。
 *   两者凑在一起，孩子只要点一下「重看引导」，走到第三步就能把家长密码
 *   改成自己设的 —— 从此家长区（打分、改任务、看数据）对他完全敞开。
 *
 *   所以 `replay` 模式下 STEPS 里根本没有 'pin'（见 SetupWizard 文件头第 4 条）。
 *   下面第 4 条测的就是这个。
 *
 * ⚠️ 但「查不到密码页」这种断言**天生不可靠** —— 如果密码页是因为别的
 * 原因没渲染出来（步骤常量写错、按钮名字改了、整个向导根本没渲染），
 * 这条断言照样是绿的，等于没测。所以第 1 条是**对照组**：
 * 同样的查询手法，在首次引导里**必须**查得到密码页。
 * 两条一起看，才说明「replay 没有密码页」是真的因为它被拿掉了。
 *
 * ------------------------------------------------------------
 * 2026-11-10 重做导览之后，这里多守一条**结构性**的东西：
 *
 *   `onStepChange` **一次都不许收到 `'game'`**。
 *
 * 游戏那一格是全屏的（App 收掉顶栏和底栏），导览一旦切进去就没有任何
 * `data-tour` 元素可指，挖洞层不渲染、整屏还被拦截层压着 —— 孩子看到的
 * 是一张指不到任何东西的卡片。这一步在类型层面已经堵了（`TourTabKey`
 * 里没有 `'game'`），但类型挡不住「有人把 setTab 直接接到别处」，
 * 所以再在行为上钉一条。
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppSettings } from '@/domain/types'
import { DEFAULT_SETTINGS, db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { SetupWizard } from './SetupWizard'
import { ChildTour } from './ChildTour'

/* ---------------- 脚手架 ---------------- */

async function freshStore(over: Partial<AppSettings> = {}) {
  await db.delete()
  await db.open()
  useApp.setState({ settings: { ...DEFAULT_SETTINGS, ...over } })
}

function currentSettings(): AppSettings {
  return useApp.getState().settings
}

/**
 * 密码页在不在。
 *
 * 2026-10-30 起向导里**不该有**这一页（第一次用家长区时才要求设），
 * 所以这个 helper 现在只用来做**反向断言**。按键盘的 helper 在
 * `ParentGate.test.tsx` 里 —— 逻辑跟着闸门走了。
 *
 * ⚠️ 用「确定」这个按键判，不用 `queryByText('设一个家长密码')` ——
 * 后者是标题文本，改个文案就失效了；而 `PinPad` 的 12 个键是它的**结构特征**，
 * 只要键盘还在，就一定查得到「确定」。
 */
function pinPadPresent(): boolean {
  return screen.queryByRole('button', { name: '确定' }) !== null
}

/** 走到「宝贝叫什么」这一步（首屏按钮是「开始设置」） */
async function gotoProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '开始设置' }))
}

beforeEach(async () => {
  await freshStore()
})

/* ============================================================
   家长设置向导
   ============================================================ */

describe('家长设置向导', () => {
  /* 2026-10-30 用户原话：「新号不要在引导前就要求设置家长密码，
     需要用的时候才要求第一次设置。」

     所以这一组从「三次密码交互」变成「整条流程里根本不该出现密码键盘」。
     密码那套交互（输两遍 / 不一致不落库）搬到了 `ParentGate.test.tsx`，
     因为逻辑跟着闸门走了 —— 留在这儿测的就是「引导里不许设密码」。 */

  it('★ 首次引导全程没有密码页，也不写 parentPin', async () => {
    const user = userEvent.setup()
    render(<SetupWizard onFinish={() => {}} />)

    await gotoProfile(user)
    expect(pinPadPresent(), '第一步就不该有键盘').toBe(false)

    await user.click(screen.getByRole('button', { name: '下一步' }))

    // 以前这里必须是密码页（对照组）；现在必须是「都设好啦」
    expect(pinPadPresent()).toBe(false)
    expect(await screen.findByText('都设好啦')).toBeInTheDocument()
    expect(currentSettings().parentPin, '引导不许写密码').toBeUndefined()
  })

  it('★ 欢迎页就说清「密码以后要用时再设」', () => {
    render(<SetupWizard onFinish={() => {}} />)
    expect(screen.getByText(/第一次用到家长区时会提醒你设/)).toBeInTheDocument()
  })

  /**
   * ⚠️ 安全回归：这一条守的是「孩子点重看引导就能改家长密码」那个洞。
   * 密码页已经整个没了，但断言要留着 —— 将来谁再把「设置密码」加回来，
   * 这条会红。
   */
  it('重看模式：动不了 parentPin', async () => {
    await freshStore({ parentPin: '9999', onboardingDone: true })
    const user = userEvent.setup()
    render(<SetupWizard replay onFinish={() => {}} />)

    await gotoProfile(user)
    expect(pinPadPresent()).toBe(false)

    await user.click(screen.getByRole('button', { name: '下一步' }))

    expect(pinPadPresent()).toBe(false)
    expect(await screen.findByText('都设好啦')).toBeInTheDocument()
    expect(currentSettings().parentPin).toBe('9999')
  })

  it('「完成」页的按钮把孩子交给导览', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<SetupWizard onFinish={onFinish} />)

    await gotoProfile(user)
    await user.click(screen.getByRole('button', { name: '下一步' }))
    // 这一步是先写库再切页，得等
    await user.click(await screen.findByRole('button', { name: '带宝贝看一遍' }))

    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})

/* ============================================================
   给孩子的功能导览
   ============================================================ */

describe('功能导览（5 步给孩子 + 2 步给家长）', () => {
  it('跟着走七步：五步给孩子、两步给家长；最后一步收尾', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const onStepChange = vi.fn()
    render(<ChildTour onFinish={onFinish} onStepChange={onStepChange} />)

    expect(onStepChange).toHaveBeenLastCalledWith('tasks')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tour-bubble', 'tasks')
    expect(screen.getByText('1 / 7')).toBeInTheDocument()

    /* ⚠️ 「游戏」这一步**故意停在任务页**（`tab: 'tasks'`）。
       2026-11-09 起 `tab === 'game'` 是全屏的：App 会收掉顶栏和底栏，
       只留一条「退出游戏」，那一刻 `[data-tour="tab-farm"]` 根本不存在
       ⇒ 挖洞层不渲染、整屏被拦截层压着。见 ChildTour 文件头第 1 条。 */
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tour-bubble', 'game')
    expect(onStepChange).toHaveBeenLastCalledWith('tasks')

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(onStepChange).toHaveBeenLastCalledWith('redeem')

    // 2026-10-28 加的「心愿」：和兑换并列，不是它的子页
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tour-bubble', 'wish')
    expect(onStepChange).toHaveBeenLastCalledWith('wish')
    expect(screen.getByText('4 / 7')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下一步' }))
    // ⚠️ 2026-11-05：底栏那格「积分」删掉了，明细改从顶栏那颗 🪙 点开
    // （`header-points`）。所以这一步**不再切 tab**，停在任务页 ——
    // 顶栏每个 tab 都在，写 `'points'` 会切到一页根本不渲染的空白。
    expect(onStepChange).toHaveBeenLastCalledWith('tasks')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tour-bubble', 'points')
    expect(screen.getByText('5 / 7')).toBeInTheDocument()

    // ---- 后两步是给家长的：回到「任务」页，讲顶栏那两个按钮 ----
    // （顶栏按钮哪个 tab 都在，但背景停在任务页才讲得通，见 ChildTour 文件头）
    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tour-bubble', 'review')
    expect(onStepChange).toHaveBeenLastCalledWith('tasks')

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tour-bubble', 'settings')
    expect(screen.getByText('7 / 7')).toBeInTheDocument()

    // 最后一步没有「下一步」了，换成「知道啦」
    expect(screen.queryByRole('button', { name: '下一步' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '知道啦' }))

    expect(onFinish).toHaveBeenCalledTimes(1)

    /* ★ 全程一次都没让 App 切进「游戏」—— 这是 2026-11-10 那条结构性约束。
       用「调用参数里有没有 'game'」判，不数调用次数（次数会随步数变）。 */
    const keys = onStepChange.mock.calls.map((c) => c[0])
    expect(keys).not.toContain('game')
  })

  /**
   * 家长那两步必须**自己**说明是给家长看的。
   *
   * 为什么值得单独一条：导览是连续的一条流，第 6 步开始画面没有任何变化
   * （顶栏本来就一直在），拿手机的人会以为「还是给孩子看的东西」而划过去。
   * 所以气泡上那个「给家长」小标是这两步唯一的身份提示，掉了就等于没加。
   *
   * ⚠️ 断言用「哪几步带标」而不是「一共有几个标」：后者在别人把标记
   * 加到孩子那几步上时照样是绿的。
   */
  it('只有最后两步带「给家长」标记', async () => {
    const user = userEvent.setup()
    render(<ChildTour onFinish={() => {}} onStepChange={() => {}} />)

    const hasParentBadge = () => screen.queryByText('给家长') !== null

    expect(hasParentBadge()).toBe(false) // 第 1 步：任务（给孩子）
    for (let n = 0; n < 4; n++) await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(hasParentBadge()).toBe(false) // 第 5 步：积分（给孩子）

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(hasParentBadge()).toBe(true) // 第 6 步：家长确认

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(hasParentBadge()).toBe(true) // 第 7 步：设置
  })

  it('「跳过」直接收尾', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<ChildTour onFinish={onFinish} onStepChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: '跳过' }))

    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  /**
   * 项目硬约束：盖住整屏的层必须 Portal 到 body。
   *
   * 现象（踩过一次，见 components/Portal.tsx 顶部注释）：页面外壳那层
   * `anim-fade-in` 带 opacity 动画，浏览器把它当成层叠上下文，里面的弹层
   * 全被关进小盒子 —— 底部导航 z-30 永远压在弹层上面，抬到 9999 也没用。
   *
   * jsdom 不做布局，量不出「谁盖住了谁」，但能锁住**结构特征**：
   * 遮罩到底在不在那层动画外壳**里面**。
   */
  it('导览遮罩必须跳出页面外壳（Portal 到 body）', () => {
    render(
      <div className="anim-fade-in" data-testid="shell">
        <ChildTour onFinish={() => {}} onStepChange={() => {}} />
      </div>,
    )

    const bubble = screen.getByRole('dialog')
    const shell = screen.getByTestId('shell')

    expect(document.body.contains(bubble)).toBe(true)
    expect(shell.contains(bubble)).toBe(false)
  })

  /**
   * 对照组：把**没套 Portal** 的版本渲染出来，上面那条断言必须抓得住它。
   *
   * 没有这一条的话，`shell.contains(bubble) === false` 可能只是因为
   * `data-testid` 写错了、shell 压根没渲染 —— 那种情况下断言永远绿。
   */
  it('对照组：不套 Portal 的弹层确实会落在外壳里面', () => {
    function LegacyTour() {
      return (
        <div role="dialog" data-tour-bubble="tasks">
          <button type="button">下一步</button>
        </div>
      )
    }

    render(
      <div className="anim-fade-in" data-testid="shell">
        <LegacyTour />
      </div>,
    )

    const bubble = screen.getByRole('dialog')
    const shell = screen.getByTestId('shell')

    // 这一条是上面那条的反面 —— 两者一起才说明断言有分辨力
    expect(shell.contains(bubble)).toBe(true)
  })
})

/* ============================================================
   「游戏」那一步的锚点跟着当前游戏走
   ------------------------------------------------------------
   底栏游戏那一格的 `data-tour` 是 `tab-<当前游戏 id>`（App.tsx）。
   以前这里写死 `tab-farm`，并且「当前游戏不是农场」时**把整步删掉**
   —— 孩子换了插件游戏就再也看不到「游戏在哪」。

   2026-11-10 改成占位符：`anchor: 'tab-game'` 在渲染时解析成
   `tab-<当前游戏 id>`，步数恒为 7。判据是气泡上的 `data-tour-anchor`。
   ============================================================ */
describe('功能导览：游戏那一步的锚点', () => {
  /* ⚠️ 必须包 `act`：RTL 的自动 cleanup 和这里的 afterEach 谁先跑不确定，
     如果这条先跑，上一条用例的 `ChildTour` 还挂着 —— 它订阅了 `useApp`，
     在 act 外面收到更新就会刷一屏警告（虽然不影响结果，但会淹掉真问题）。 */
  afterEach(() => {
    act(() => useApp.setState({ activeGameId: 'farm' }))
  })

  it('★ 换成插件游戏：仍然是 7 步，锚点跟着变成 tab-cloudfarm', async () => {
    act(() => useApp.setState({ activeGameId: 'cloudfarm' }))
    const user = userEvent.setup()
    render(<ChildTour onFinish={() => {}} onStepChange={() => {}} />)

    expect(screen.getByText('1 / 7')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '下一步' }))

    const bubble = screen.getByRole('dialog')
    expect(bubble).toHaveAttribute('data-tour-bubble', 'game')
    expect(bubble).toHaveAttribute('data-tour-anchor', 'tab-cloudfarm')
    // 当前不是农场，就不该讲「买种子」
    expect(bubble.textContent).not.toContain('买种子')
    expect(bubble.textContent).toContain('退出游戏')
  })

  it('★ 对照组：当前是农场时讲的是农场那段', async () => {
    act(() => useApp.setState({ activeGameId: 'farm' }))
    const user = userEvent.setup()
    render(<ChildTour onFinish={() => {}} onStepChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: '下一步' }))

    const bubble = screen.getByRole('dialog')
    expect(bubble).toHaveAttribute('data-tour-anchor', 'tab-farm')
    expect(bubble.textContent).toContain('买种子')
  })
})
