/**
 * 回归测试：新手引导（家长设置向导 + 给孩子的功能导览）。
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
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

/** 按 PinPad 上的数字键。4 位会自动提交（见 ParentGate 里那段注释）。 */
async function typePin(user: ReturnType<typeof userEvent.setup>, digits: string) {
  for (const d of digits) {
    await user.click(screen.getByRole('button', { name: d }))
  }
}

/**
 * 密码页在不在。
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
  it('首次引导：走到第三步确实是「设一个家长密码」（第 4 条的对照组）', async () => {
    const user = userEvent.setup()
    render(<SetupWizard onFinish={() => {}} />)

    await gotoProfile(user)
    // 第一步还没到密码页
    expect(pinPadPresent()).toBe(false)

    await user.click(screen.getByRole('button', { name: '下一步' }))

    // 同一套查询手法，这里必须查得到 —— 否则第 4 条就是假绿
    expect(pinPadPresent()).toBe(true)
    expect(screen.getByText('设一个家长密码')).toBeInTheDocument()
  })

  it('两次输的不一样 → 报错、回到第一遍，且**不落库**', async () => {
    await freshStore({ parentPin: '1111' })
    const user = userEvent.setup()
    render(<SetupWizard onFinish={() => {}} />)

    await gotoProfile(user)
    await user.click(screen.getByRole('button', { name: '下一步' }))

    await typePin(user, '1234')
    // 第一遍输完，提示语应该切到「再输一次」
    expect(screen.getByText('再输一次，确认没记错')).toBeInTheDocument()

    await typePin(user, '5678')

    expect(screen.getByText('两次不一样，重新设一次吧')).toBeInTheDocument()
    // 关键：不一致绝不能写进去，老密码原封不动
    expect(currentSettings().parentPin).toBe('1111')
    // 而且要回到「第一遍」的状态，不是停在报错里
    expect(screen.getByText('输入 4 位数字')).toBeInTheDocument()
  })

  it('两次输的一样 → 落库，并进到「都设好啦」', async () => {
    const user = userEvent.setup()
    render(<SetupWizard onFinish={() => {}} />)

    await gotoProfile(user)
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await typePin(user, '1234')
    await typePin(user, '1234')

    // ⚠️ 必须用 findBy*（轮询），不能 getBy*：submitPin 里先 `await updateSettings()`
    // 再 `setStep('done')`，而写库要走一趟 IndexedDB（fake-indexeddb 用宏任务调度），
    // 所以点完这一下，界面不是立刻切 —— getBy 会抢在切之前断言，随机红。
    expect(await screen.findByText('都设好啦')).toBeInTheDocument()
    expect(currentSettings().parentPin).toBe('1234')
  })

  it('密码可以「以后再说」—— 跳过之后老密码不动', async () => {
    await freshStore({ parentPin: '1111' })
    const user = userEvent.setup()
    render(<SetupWizard onFinish={() => {}} />)

    await gotoProfile(user)
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '以后再说' }))

    expect(await screen.findByText('都设好啦')).toBeInTheDocument()
    expect(currentSettings().parentPin).toBe('1111')
  })

  /**
   * ⚠️ 安全回归：这一条守的是「孩子点重看引导就能改家长密码」那个洞。
   */
  it('重看模式：整条流程里没有密码页，也动不了 parentPin', async () => {
    await freshStore({ parentPin: '9999', onboardingDone: true })
    const user = userEvent.setup()
    render(<SetupWizard replay onFinish={() => {}} />)

    await gotoProfile(user)
    expect(pinPadPresent()).toBe(false)

    await user.click(screen.getByRole('button', { name: '下一步' }))

    // 第二步之后**直接到完成**，中间没有密码页
    expect(pinPadPresent()).toBe(false)
    expect(screen.queryByText('设一个家长密码')).toBeNull()
    expect(screen.getByText('都设好啦')).toBeInTheDocument()

    // 老密码必须原封不动 —— 这是这一条真正的断言
    expect(currentSettings().parentPin).toBe('9999')
  })

  it('重看模式的欢迎页不复述「设家长密码」', () => {
    render(<SetupWizard replay onFinish={() => {}} />)

    expect(screen.getByText('再看一遍引导')).toBeInTheDocument()
    // 首次引导的文案里才有「设一个家长密码」这件事
    expect(screen.queryByText(/设一个家长密码/)).toBeNull()
  })

  it('「完成」页的按钮把孩子交给导览', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<SetupWizard onFinish={onFinish} />)

    await gotoProfile(user)
    await user.click(screen.getByRole('button', { name: '下一步' }))
    await user.click(screen.getByRole('button', { name: '以后再说' }))
    // 同上：这一步也是先写库再切页，得等
    await user.click(await screen.findByRole('button', { name: '带宝贝看一遍' }))

    expect(onFinish).toHaveBeenCalledTimes(1)
  })
})

/* ============================================================
   给孩子的功能导览
   ============================================================ */

describe('给孩子的功能导览', () => {
  it('跟着走四步，每一步都把底部 tab 切过去；最后一步收尾', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    const onStepChange = vi.fn()
    render(<ChildTour onFinish={onFinish} onStepChange={onStepChange} />)

    expect(onStepChange).toHaveBeenLastCalledWith('tasks')
    expect(screen.getByRole('dialog')).toHaveAttribute('data-tour-bubble', 'tasks')
    expect(screen.getByText('1 / 4')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(onStepChange).toHaveBeenLastCalledWith('farm')

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(onStepChange).toHaveBeenLastCalledWith('redeem')

    await user.click(screen.getByRole('button', { name: '下一步' }))
    expect(onStepChange).toHaveBeenLastCalledWith('points')
    expect(screen.getByText('4 / 4')).toBeInTheDocument()

    // 最后一步没有「下一步」了，换成「知道啦」
    expect(screen.queryByRole('button', { name: '下一步' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '知道啦' }))

    expect(onFinish).toHaveBeenCalledTimes(1)
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
