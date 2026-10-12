import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { MIN_TIER_RATIO } from '@/domain/tierRatio'
import { TaskEditor } from './TaskEditor'

/* ============================================================
   编辑器的「坚持的奖励阶梯」预览
   ------------------------------------------------------------
   阶梯**不是**存在任务上的字段，而是每次由
   `defaultTiers(cycle, 目标天数, 基础分, 倍率)` 现算的（家长 2026-09-30 定的口径：
   阶梯合计 = 倍率 × 基础分 × 目标天数，按 1:3:6 摊到三档）。

   所以「改了基础分，预览必须跟着重算」—— 写死或缓存住都会当场变成假话。
   上面那段 JSX 的注释里就是这么写的，但 `useMemo` 的依赖数组**漏了
   `basePoints`**，于是这条保证是假的：改了基础分，阶梯还停在旧数字上。

   2026-10-10 家长报「为啥阶梯分还是这么大」时查出来的。
   同一天家长还要「阶梯分设置」，于是那个写死的 0.8 提成了
   `settings.checkInTierRatio` —— 它也得进依赖数组，否则家长在设置里
   压了倍率，编辑器还在按旧倍率报价（下面最后一条盯着这件事）。
   ============================================================ */

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 读「坚持的奖励阶梯」那一块里的 +N（按显示顺序） */
function ladder(): number[] {
  const label = screen.getByText('坚持的奖励阶梯')
  const box = label.nextElementSibling as HTMLElement
  return Array.from(box.querySelectorAll('span'))
    .map((e) => (e.textContent ?? '').trim())
    .filter((t) => /^\+\d+$/.test(t))
    .map((t) => Number(t.slice(1)))
}

/** 按 Field 的标题定位它里面的数字输入框 */
function stepperInput(labelText: string): HTMLInputElement {
  const label = screen.getByText(labelText)
  const field = label.parentElement as HTMLElement
  const input = field.querySelector('input[type="number"]')
  if (!input) throw new Error(`找不到「${labelText}」里的数字输入框`)
  return input as HTMLInputElement
}

/** 开一个「每周 + 签到」的新任务编辑态 */
async function openWeeklyCheckIn(target: string) {
  const user = userEvent.setup()
  render(<TaskEditor open task={null} onClose={() => {}} />)

  // 家长密码闸门：默认 PIN 是 0000，第 4 位会自动提交
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole('button', { name: '0' }))
  }

  // 日 / 单次不支持签到，先切到每周
  await user.click(screen.getByRole('button', { name: '每周' }))
  await user.click(screen.getByRole('button', { name: /开启签到模式/ }))
  fireEvent.change(stepperInput('一共要签到几天'), { target: { value: target } })
}

describe('任务编辑器：奖励阶梯预览必须跟着基础分走', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('阶梯按公式现算：base 10 / 目标 6 天 → 5 / 15 / 30', async () => {
    await openWeeklyCheckIn('6')

    // unit = round(0.8 × 10 × 6 / 10) = 5，1:3:6 → 5/15/30
    expect(ladder()).toEqual([5, 15, 30])
  })

  it('★ 改基础分，阶梯要跟着重算（这条以前是假的）', async () => {
    await openWeeklyCheckIn('6')
    expect(ladder(), '前提：默认基础分 10').toEqual([5, 15, 30])

    fireEvent.change(stepperInput('基础积分'), { target: { value: '5' } })

    // unit = round(0.8 × 5 × 6 / 10) = 2 → 2/6/12
    expect(ladder(), '改了基础分，阶梯必须跟着重算，不能停在旧数字上').toEqual([2, 6, 12])
  })

  it('改目标天数，阶梯跟着重算（并正确合并到同一天的档位）', async () => {
    await openWeeklyCheckIn('6')
    expect(ladder()).toEqual([5, 15, 30])

    fireEvent.change(stepperInput('一共要签到几天'), { target: { value: '3' } })

    /* unit = round(0.8 × 10 × 3 / 10) = 2。
       目标只有 3 天时，周档的 1/3/6 被 Math.min 压成 1/3/3 ——
       后两档落在同一天，`dedupeTiers` 保留高的那档 ⇒ [2, 12]（不是 2/6/12）。 */
    expect(ladder(), '改了目标天数，阶梯必须跟着重算').toEqual([2, 12])
  })

  it('基础分归零时，阶梯不该出现「+0」（公式有下限 1 分）', async () => {
    await openWeeklyCheckIn('6')
    fireEvent.change(stepperInput('基础积分'), { target: { value: '0' } })

    // 注意：basePoints=0 时 unit 仍 ≥ 1，所以阶梯不会变成 +0
    expect(ladder().every((p) => p >= 1)).toBe(true)
  })

  /* ⚠️ 这里原来有两条「家长在**设置页**压倍率 → 编辑器预览跟着重算」。
     2026-10-12 家长拍板「不需要全局设定梯度、连续的。每个任务单独，
     有默认的就行了」，设置页那张卡删了，所以这两条整体作废 ——
     倍率现在只能挂在任务上，而「改了倍率预览跟着重算」这件事
     由下面「单独设阶梯倍率」那一组里的
     「★ 打开开关 → 出现档位按钮；点 20% → 上面那几档跟着变小」接管
     （那条同时也是 `tiers` 那个 `useMemo` 依赖数组的护栏）。 */

  it('★ 任务自己带了倍率 → 打开编辑器就按它算，不是按默认的 80%', async () => {
    // 倍率现在只有一个来源：任务自己的 `checkInTierRatio`。
    // 这条钉的是「打开编辑器时确实把它读进来了」—— 漏读的话，
    // 家长在别处（导入的备份 / 另一台设备同步过来的库）设好的倍率
    // 会在编辑器里显示成默认值，他一点保存就把自己的设置抹平了。
    const task = anyCheckInTask()
    await useApp.getState().updateTask(task.id, { checkInTierRatio: MIN_TIER_RATIO })
    await openEdit(await savedTask(task.id))

    // 种子里这条签到任务是 base 5 / 目标 5。
    // unit = round(0.2 × 5 × 5 / 10) = round(0.5) = 1 → 1/3/6（默认 0.8 时是 2/6/12）
    expect(ladder(), '倍率压到下限，预览必须按任务的算').toEqual([1, 3, 6])
  })

  /* ------------------------------------------------------------
     ★ 删掉规则，别忘了删**话术**（2026-10-11）
     ------------------------------------------------------------
     签到连击整块删掉的那天，`TaskEditor` 里这段漏了 —— 编辑器还在承诺
     「🔥 连着来每天多 +1 分：第 1 天 5、第 2 天 6……断一天就从 5 重新开始」，
     而代码里已经没有任何东西会那样发分。

     漏掉的原因很具体：当天的走查和 e2e **只盯了任务页那张签到卡**
     （`e2e-check` 4c 那条禁令），没盯编辑器。家长当天问
     「为啥任务编辑里没有连击设置」时才撞出来。

     ⚠️ 下面两条**必须成对**：光断言「那段话不在」是很弱的 ——
     整块渲染失败它照样绿。所以配一条正向对照：同一块里必须出现那句实话，
     证明探针确实读到了这块内容。
     ------------------------------------------------------------ */
  it('★ 编辑器不再承诺已删掉的「签到连击」规则（且换上了实话）', async () => {
    await openWeeklyCheckIn('6')

    expect(
      screen.queryByText(/连着来每天多/),
      '签到连击 2026-10-11 已删，编辑器不许再承诺它',
    ).toBeNull()
    expect(screen.queryByText(/断一天就从/), '断签重来那句也是同一套规则的话术').toBeNull()

    // 正向对照：这块内容确实渲染出来了，而且说的是实话
    expect(
      screen.getByText(/签到只发上面的阶梯奖励/),
      '删了旧话术要换上「这里为什么没有连击」的实话，不能留一片空白',
    ).toBeTruthy()
  })
})

/* ============================================================
   按任务覆盖奖励设置（2026-10-11）
   ------------------------------------------------------------
   家长问了两遍：「为什么任务编辑里还是没有编辑连续奖励和梯度奖励」。
   以前这两样只在「设置 → 规则」里，而且是**全局**的 —— 改一次，
   所有签到任务的阶梯倍率、所有长期任务的连击加成一起变。
   现在每条任务可以自己覆盖一份。

   这一组盯的是**界面这一层**（域逻辑在 domain/*.test.ts，
   发分在 store/useApp.test.ts）：

     ① 开关关着时，界面上显示的必须是**当前实际生效**的那个数
        —— 显示 0 或空白会让家长以为这条任务没有奖励；
     ② 开关关掉 → 存 `undefined`（真的回到全局默认，不留旧值）；
     ③ 签到任务上**不出现**连击设置，长期任务上**不出现**阶梯倍率
        —— 家长的原话是「不能两种同时都有」。
   ============================================================ */

/** 解锁家长闸门（默认 PIN 0000，第 4 位自动提交） */
async function unlock(user: ReturnType<typeof userEvent.setup>) {
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole('button', { name: '0' }))
  }
}

/**
 * 开一个「编辑已有任务」的编辑态。
 *
 * 返回的 `saved` 是一个 promise，在编辑器调用 `onClose` 时 resolve ——
 * `handleSave` 的最后一步就是 `onClose()`，所以 `await saved` 等于
 * 「等整条保存链（写库 → 同步实例 → refresh）跑完」。
 *
 * ⚠️ 为什么非要等这一下：`user.click` **不会** await 事件处理器返回的
 *    promise。不等的话，测试结束 / 下一个 `beforeEach` 里的 `db.delete()`
 *    会撞上还在飞的异步写库，vitest 抛 `DatabaseClosedError`
 *    （unhandled rejection）。那不是「测试环境的噪音」——
 *    它意味着断言可能读到写了一半的状态，正是假绿的温床。
 *    2026-10-12 加这批测试时实测到的。
 */
async function openEdit(task: Parameters<typeof TaskEditor>[0]['task']) {
  const user = userEvent.setup()
  let done!: () => void
  const saved = new Promise<void>((resolve) => {
    done = resolve
  })
  render(<TaskEditor open task={task} onClose={done} />)
  await unlock(user)
  return { user, saved }
}

/** 从 store 里拿一条签到任务 */
function anyCheckInTask() {
  const t = useApp.getState().tasks.find((x) => x.checkInEnabled)
  if (!t) throw new Error('种子里应该有签到任务')
  return t
}

/** 从 store 里拿一条长期任务（非签到） */
function anyPeriodTask() {
  const t = useApp
    .getState()
    .tasks.find((x) => !x.checkInEnabled && (x.cycle === 'weekly' || x.cycle === 'monthly' || x.cycle === 'yearly'))
  if (!t) throw new Error('种子里应该有长期任务')
  return t
}

/* ⚠️ 「保存后」的断言一律读 **Dexie**，不读 `useApp.getState().tasks`。
   原因实测过：`handleSave` 是 async，而 `user.click` 不会等它 ——
   点击返回时库里已经写好了，store 的内存快照却还没 `refresh` 回来，
   读 store 会拿到**旧值**（甚至 undefined），测试红得毫无道理。
   「保存」这件事的判据本来就该是「落库了没有」，所以读库更准。 */
async function savedTask(id: string) {
  const row = await db.tasks.get(id)
  if (!row) throw new Error(`库里找不到任务 ${id}`)
  return row
}

describe('任务编辑器：单独设阶梯倍率（签到任务）', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('★ 默认不覆盖 —— 开关关着，显示的「现在是多少」是全局默认，不是 0', async () => {
    await openEdit(anyCheckInTask())

    const sw = screen.getByRole('button', { name: /单独设阶梯倍率/ })
    expect(sw.getAttribute('aria-pressed'), '新任务默认不覆盖').toBe('false')
    // ⚠️ 这条是关键：关着的时候必须显示**实际生效**的那个百分比。
    //    显示 0% / 空白会让家长以为这条任务的阶梯是白送的。
    expect(
      screen.getByText(/不单独设，用默认的 80%/),
      '关着时要告诉家长「不设就是默认的 80%」，不能留空、也不能写 0%',
    ).toBeTruthy()
  })

  it('★ 打开开关 → 出现档位按钮；点 20% → 上面那几档跟着变小', async () => {
    const { user } = await openEdit(anyCheckInTask())

    // 前提：全局 0.8，base 5 / 目标 5 → 2/6/12
    expect(ladder(), '前提：默认倍率下的阶梯').toEqual([2, 6, 12])

    await user.click(screen.getByRole('button', { name: /单独设阶梯倍率/ }))
    await user.click(screen.getByRole('button', { name: '20%' }))

    // unit = round(0.2 × 5 × 5 / 10) = round(0.5) = 1 → 1/3/6
    expect(ladder(), '改成 20% 后，上面那几档必须当场重算').toEqual([1, 3, 6])
  })

  it('★ 关掉开关 → 阶梯立刻回到全局默认（不是停在 20%）', async () => {
    const { user } = await openEdit(anyCheckInTask())
    const sw = () => screen.getByRole('button', { name: /单独设阶梯倍率/ })

    await user.click(sw())
    await user.click(screen.getByRole('button', { name: '20%' }))
    expect(ladder()).toEqual([1, 3, 6])

    await user.click(sw())
    expect(ladder(), '关掉覆盖必须回到全局默认，不能停在刚才那个 20%').toEqual([2, 6, 12])
  })

  it('★ 保存 → 写进任务；再打开开关关掉保存 → 字段被真的删掉', async () => {
    const task = anyCheckInTask()
    const { user, saved } = await openEdit(task)

    await user.click(screen.getByRole('button', { name: /单独设阶梯倍率/ }))
    await user.click(screen.getByRole('button', { name: '20%' }))
    await user.click(screen.getByRole('button', { name: /保存修改/ }))
    await saved

    expect(
      (await savedTask(task.id)).checkInTierRatio,
      '保存后任务上要真的带上这个倍率',
    ).toBe(0.2)

    // 重新打开（拿库里的那一行），把开关关掉再存一次
    cleanup()
    const reopened = await savedTask(task.id)
    const { user: user2, saved: saved2 } = await openEdit(reopened)
    const sw = screen.getByRole('button', { name: /单独设阶梯倍率/ })
    expect(sw.getAttribute('aria-pressed'), '重新打开时开关应该是开着的').toBe('true')
    await user2.click(sw)
    await user2.click(screen.getByRole('button', { name: /保存修改/ }))
    await saved2

    // ⚠️ 必须真的**没有**这个键，不能是 0 / NaN / 留着旧值 ——
    //    留着旧值的话，界面上写着「跟着设置走」，发分却按旧数，家长抓不到。
    expect(
      (await savedTask(task.id)).checkInTierRatio,
      '关掉覆盖要把字段删掉（存 undefined）',
    ).toBeUndefined()
  })

  it('★ 这条签到任务上**没有**连击设置 —— 家长定「不能两种同时都有」', async () => {
    await openEdit(anyCheckInTask())
    expect(
      screen.queryByRole('button', { name: /单独设连击奖励/ }),
      '签到只走阶梯，编辑器不许给签到任务一个连击开关',
    ).toBeNull()
  })
})

describe('任务编辑器：单独设连击奖励（长期任务）', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('★ 长期任务上出现连击开关，且关着时显示的是当前生效的数', async () => {
    await openEdit(anyPeriodTask())

    const sw = screen.getByRole('button', { name: /单独设连击奖励/ })
    expect(sw.getAttribute('aria-pressed'), '默认不覆盖').toBe('false')
    expect(
      screen.getByText(/不单独设，用默认的每连一天 \+2 分，最多 \+20 分/),
      '关着时要显示内置默认的 2 / 20',
    ).toBeTruthy()
  })

  it('★ 打开开关 → 两个数字框出现；把「每连一天」改成 10 → 预览跟着变', async () => {
    const { user } = await openEdit(anyPeriodTask())
    await user.click(screen.getByRole('button', { name: /单独设连击奖励/ }))

    fireEvent.change(stepperInput('每连一天多给'), { target: { value: '10' } })

    // 预览那句是现算的：连到第 3 天 min(封顶 20, 3×10) = 20
    expect(screen.getByText(/连击第 N 天多给「N × 10」分，最多 20 分/)).toBeTruthy()
    expect(screen.getByText(/连到第 3 天多给 20 分/)).toBeTruthy()
  })

  it('★ 保存 → 两个值都写进任务', async () => {
    const task = anyPeriodTask()
    const { user, saved } = await openEdit(task)

    await user.click(screen.getByRole('button', { name: /单独设连击奖励/ }))
    fireEvent.change(stepperInput('每连一天多给'), { target: { value: '10' } })
    fireEvent.change(stepperInput('一次最多加'), { target: { value: '50' } })
    await user.click(screen.getByRole('button', { name: /保存修改/ }))
    await saved

    const row = await savedTask(task.id)
    expect(row.streakPerDay).toBe(10)
    expect(row.streakCap).toBe(50)
  })

  it('★ 输入框里塞越界值 → 存下去的是夹紧后的数（输入框不是唯一的闸门）', async () => {
    const task = anyPeriodTask()
    const { user, saved } = await openEdit(task)

    await user.click(screen.getByRole('button', { name: /单独设连击奖励/ }))
    // stepper 的 onChange 里有 clamp，但这里直接打一个越界值进去，
    // 验的是「存下去的那一刻也夹过」—— 两条路都得是同一个数。
    fireEvent.change(stepperInput('每连一天多给'), { target: { value: '9999' } })
    await user.click(screen.getByRole('button', { name: /保存修改/ }))
    await saved

    const row = await savedTask(task.id)
    expect(row.streakPerDay, '9999 要被夹成上限 20').toBe(20)
  })

  it('★ 全局开关关着 → 编辑器要说出来「设了也不会发」，而不是默不作声', async () => {
    await act(async () => {
      await useApp.getState().updateSettings({ streakBonusEnabled: false })
    })
    await openEdit(anyPeriodTask())

    // ⚠️ 这块**照常渲染**（不渲染家长就找不到 —— 他正是因为找不到才来问的），
    //    但必须挂一条实话。渲染了却不提醒 = 界面在承诺一件不会发生的事。
    expect(
      screen.getByText(/连击奖励总开关现在/),
      '全局关着时必须提醒，不能默默收下这个设置',
    ).toBeTruthy()
    expect(screen.getByText(/这里设好了也不会发/)).toBeTruthy()
  })

  it('★ 今日任务上**没有**连击设置 —— 连击只给长期任务', async () => {
    const daily = useApp.getState().tasks.find((t) => t.cycle === 'daily' && !t.checkInEnabled)!
    await openEdit(daily)
    expect(
      screen.queryByRole('button', { name: /单独设连击奖励/ }),
      '今日任务天天都要做，不搭连击这趟车',
    ).toBeNull()
  })

  it('★ 长期任务上**没有**阶梯倍率开关 —— 阶梯只给签到任务', async () => {
    await openEdit(anyPeriodTask())
    expect(
      screen.queryByRole('button', { name: /单独设阶梯倍率/ }),
      '没开签到的任务不该出现阶梯倍率设置',
    ).toBeNull()
  })
})
