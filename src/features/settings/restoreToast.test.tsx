/**
 * 「从备份恢复」那条提示
 * ------------------------------------------------------------
 * 2026-10-30。换机探针里 20 条断言全绿，**看图**才发现提示长这样：
 *
 *     数据已恢复
 *     数据已恢复
 *
 * 因为 `importBackup` 返回的是一整句（「数据已恢复；游戏装回 2 款」），
 * 而 toast 自己有标题，整句塞进 detail 就成了同一句话说两遍 ——
 * 真正有用的后半句（哪几款游戏没装回来）反而被挤到第二行去读。
 *
 * 这个文件有两组：
 *   ① 纯函数 `restoreToastDetail` 的规则（文案会改，重复这件事不会自己好）
 *   ② **走界面**的那一条 —— 单测函数是不够的：函数测了、调用点改回
 *      `detail: res.message` 照样全绿。本项目最典型的假绿就是这个。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import SettingsPage, { restoreToastDetail } from './SettingsPage'

/** toast 上那行标题。`App.tsx` 里成功/失败各一句，这里照抄常量只为比对 */
const TITLE_OK = '数据已恢复'

describe('恢复提示：第二行不能和标题重复（纯函数）', () => {
  it('没有后半句时，第二行整个不出现（返回空串）', () => {
    const detail = restoreToastDetail(true, TITLE_OK)
    expect(detail).toBe('')
    // 空串在 App.tsx 里是 `{t.detail && …}` —— 整行不渲染，不是留一个空行
    expect(detail).not.toBe(TITLE_OK)
  })

  it('有后半句时只留后半句', () => {
    expect(restoreToastDetail(true, '数据已恢复；游戏装回 2 款')).toBe('游戏装回 2 款')
    expect(restoreToastDetail(true, '数据已恢复；「蚂蚁搬家」要去「游戏」页重新装一次')).toBe(
      '「蚂蚁搬家」要去「游戏」页重新装一次',
    )
  })

  it('★ 不管 store 怎么拼，第二行都不许以标题开头', () => {
    const messages = [
      TITLE_OK,
      '数据已恢复；游戏装回 2 款',
      '数据已恢复；游戏装回 2 款，但「蚂蚁搬家」要去「游戏」页重新装一次',
      '数据已恢复；「A」「B」「C」 等 5 款要去「游戏」页重新装一次',
    ]
    for (const m of messages) {
      const detail = restoreToastDetail(true, m)
      expect(detail.startsWith(TITLE_OK), `「${m}」剥完还剩「${detail}」`).toBe(false)
    }
  })

  it('失败时原样保留原因 —— 那才是家长唯一能看懂的线索', () => {
    const reason = '这是一份空模板，没有可恢复的内容'
    expect(restoreToastDetail(false, reason)).toBe(reason)
    // 反向：失败时**不能**因为「开头不是数据已恢复」就被清空
    expect(restoreToastDetail(false, reason)).not.toBe('')
  })
})

/* ============================================================
   ② 走界面：真的把文件喂给那个 input
   ============================================================ */

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
  // 数据 tab 有家长闸门；钉一个已知密码，下面「按 4 个 0」才进得去
  await useApp.getState().updateSettings({ parentPin: '0000' })
}

/** 打开「数据」页并过掉闸门，返回渲染结果（要拿里面的 file input） */
async function openDataTab() {
  const user = userEvent.setup()
  const r = render(<SettingsPage onBack={() => {}} />)
  await user.click(screen.getByRole('button', { name: /数据/ }))
  for (let i = 0; i < 4; i++) {
    await user.click(screen.getByRole('button', { name: '0' }))
  }
  // 闸门过去的标志：导出按钮出现了（不然下面喂文件是喂给不存在的界面）
  await screen.findByRole('button', { name: /导出到文件/ })
  return r
}

/**
 * 轮询 store 里那条 toast。
 *
 * ⚠️ 提示条由 `App.tsx` 的 `ToastHost` 渲染，单独渲染设置页看不到 DOM；
 *    而 `ToastHost` 就是把 `title` 和 `detail` 各渲染一行，所以在这一层
 *    断言「两条一模一样」等价于断言「屏幕上说两遍」。
 * ⚠️ 轮询到「那件事发生」，不要 `sleep(固定时长)`。
 */
async function waitToast(
  pred: (t: { title: string; detail?: string }) => boolean,
  ms = 8000,
): Promise<{ title: string; detail?: string } | null> {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const hit = useApp.getState().toasts.find(pred)
    if (hit) return hit
    await new Promise((r) => setTimeout(r, 50))
  }
  return null
}

describe('从备份恢复 → 界面上的提示（走真界面）', () => {
  beforeEach(bootStore)
  afterEach(cleanup)

  it('★ 标题只出现一次，后半句点名装不回来的游戏', async () => {
    const r = await openDataTab()

    /* 造一份**能过校验**的备份：直接用真实导出，再往 meta 里塞一款
       这个版本没有的游戏 —— 真实路径就是「备份来自装了更多游戏的版本」。 */
    const backup = (await useApp.getState().exportBackup()) as {
      data: Record<string, unknown> & { meta?: Record<string, unknown> }
    }
    expect(Array.isArray(backup.data.tasks) && backup.data.tasks.length > 0).toBe(true)
    backup.data.meta = { ...(backup.data.meta ?? {}), installedGameIds: ['no-such-game'] }

    const input = r.container.querySelector('input[type=file]') as HTMLInputElement
    expect(input, '数据页里找不到 file input').toBeTruthy()
    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(backup)], 'b.json', { type: 'application/json' })] },
    })

    /* 恢复是异步的（写库 + 重装游戏），轮询到那条 toast 为止。
       ⚠️ 别用固定 sleep —— 这里等的是一件事，不是一个时长。

       断言读的是 `toasts`（store 里的那条），不是 DOM：提示条由 `App.tsx`
       的 `ToastHost` 渲染，单独渲染设置页看不到它。而 `ToastHost` 就是
       把 `title` 和 `detail` 各渲染一行 —— 所以「两条一模一样」这件事
       在这一层就能钉死，不需要把整个 App 拉起来。 */
    const toast = await waitToast((t) => t.title === TITLE_OK)
    expect(toast, '没弹出「数据已恢复」—— 恢复根本没跑起来').toBeTruthy()

    /* ★ 真正守的那条：第二行**不许以标题开头**。
       判据不能写 `!== TITLE_OK` —— 带后半句时它是「数据已恢复；「X」要去…」，
       和标题不相等，但屏幕上照样是「数据已恢复」说两遍（前半句重复）。
       必须从"开头"判，两种形态才都能拦住。 */
    expect(
      toast!.detail!.startsWith(TITLE_OK),
      `第二行以标题开头 —— 屏幕上会看到「${TITLE_OK}」说两遍：${toast!.detail}`,
    ).toBe(false)
    // 正向对照：后半句真的点出了那一款，而且说清了去哪装
    expect(toast!.detail).toMatch(/no-such-game/)
    expect(toast!.detail).toMatch(/去「游戏」页重装/)
  })

  it('★ 比当前新的备份：提示要落到「恢复失败」并让人先更新', async () => {
    const r = await openDataTab()

    const snap = (await useApp.getState().exportBackup()) as {
      version: number
      data: Record<string, unknown>
    }
    const future = { ...snap, version: snap.version + 1 }

    const input = r.container.querySelector('input[type=file]') as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File([JSON.stringify(future)], 'b.json', { type: 'application/json' })] },
    })

    /* 被拒绝时 toast 的标题是「恢复失败」，detail 才是原因。
       ⚠️ 这条同时守两件事：闸门真的接进了界面、原因真的显示出来了 ——
          只测 store 的话，界面把 message 丢掉也不会红。 */
    const toast = await waitToast((t) => t.title === '恢复失败')
    expect(toast, '比当前新的备份被放行了（或者失败提示没弹出来）').toBeTruthy()
    expect(toast!.detail).toContain('更新')
    // 反面对照：不许说「数据已恢复」
    expect(toast!.detail).not.toContain('数据已恢复')
  })
})
