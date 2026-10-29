import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db, loadSettings } from '@/db/db'
import { useApp } from '@/store/useApp'
import type { MerchantApplication } from '@/domain/types'
import { RedeemBody } from '../redeem/RedeemSheet'
import WishPage from './WishPage'

/* ============================================================
   招商（2026-10-29，第二轮按用户纠正重做）
   ------------------------------------------------------------
   第一版做错了三件事，全部是**设计**层面的，测试也一起错：
     ① 入口放在了「📜 兑换记录」底部；
     ② 家长那一路写成「邀请商家入驻」；
     ③ 带一张表单（称呼 / 联系方式），点提交才生效。

   用户原话（第二次纠正）：
     「在 心愿右上角 把兑换记录 去掉 换成招商按钮。点开 看到招商合作。
       **不是在兑换/兑换记录里显示**。另外家长申请 不是 邀请商家
       而是**分享让其他家长使用**。**点申请即可**。不需要填 称呼 这些。
       因为会根据当前账号，申请。之后会接入服务端的。」

   所以这一组守五件事：
     ① 入口在**心愿页右上角**，而且**兑换记录里没有**（反向钉住那次纠正）；
     ② 家长那一路说的是「分享给其他家长」，不是「邀请商家」；
     ③ **一个输入框都没有**，点一下就提交；
     ④ 客户端只写 `pending`，`approved` + `adminUrl` 只能由后端回填；
     ⑤ 提交**真的落盘**（`loadSettings` + 重新 `boot()`），不是只在内存里。
   ============================================================ */

beforeEach(async () => {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
  // store 是模块级单例，上一个用例留下的跳转通道会漏到这里来
  useApp.setState({ pendingRedeemItem: null })
})

/** 心愿页 → 右上角「招商」。两步都要等，别用固定 sleep */
async function openMerchant(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: '招商' }))
  await screen.findByText('招商合作')
}

const seed = async (apps: MerchantApplication[]) => {
  await useApp.getState().updateSettings({ merchantApps: apps })
}

const parentApp = (patch: Partial<MerchantApplication> = {}): MerchantApplication => ({
  role: 'parent',
  status: 'pending',
  createdAt: Date.now(),
  ...patch,
})

describe('招商：入口在心愿商城右上角', () => {
  it('★ 心愿页右上角有「招商」，点开是家长 / 商家两路', async () => {
    const user = userEvent.setup()
    render(<WishPage />)

    // 前提：先确认自己在心愿页上，否则下面全是空断言
    expect(await screen.findByText('心愿商城')).toBeTruthy()

    await openMerchant(user)
    expect(screen.getByText('家长申请')).toBeTruthy()
    expect(screen.getByText('商家申请')).toBeTruthy()
  })

  it('★ 家长那一路说的是「分享给其他家长」，不是「邀请商家」', async () => {
    const user = userEvent.setup()
    render(<WishPage />)
    await openMerchant(user)

    // 这一路的全部动机就是分成 —— 写错成「邀请商家」等于换了个人群
    expect(screen.getByText('分享给其他家长，别人用起来你拿分成')).toBeTruthy()
    expect(screen.queryByText(/邀请商家/), '2026-10-29 用户当场纠正过这个说法').toBeNull()
  })

  it('★ 兑换记录里**没有**招商入口（第一版就错在这儿）', async () => {
    const user = userEvent.setup()
    render(<RedeemBody />)

    await user.click(await screen.findByRole('button', { name: /兑换记录/ }))
    // 前提：确实落在记录屏上（空库 ⇒ 空态那句），否则「没有招商」恒真
    expect(await screen.findByText('还没有兑换过')).toBeTruthy()

    expect(
      screen.queryByRole('button', { name: /招商/ }),
      '用户原话：「不是在兑换/兑换记录里显示」',
    ).toBeNull()
  })
})

describe('招商：点申请即可', () => {
  it('★ 一个输入框都没有 —— 身份用当前账号', async () => {
    const user = userEvent.setup()
    const { container } = render(<WishPage />)
    await openMerchant(user)

    expect(
      container.querySelectorAll('input, textarea, select'),
      '「不需要填 称呼 这些。因为会根据当前账号，申请」',
    ).toHaveLength(0)
    expect(screen.getByText(/不用另外填资料/)).toBeTruthy()
  })

  /* ⚠️ 这条只断言**内存里的 store**。名字里不写「落库」——「落库」是下面
     「申请真的落盘」那一组的事。把 `updateSettings` 换成
     `useApp.setState(...)`（只写内存、不写库）之后，**这一条照样绿**。 */
  it('★ 点一下「申请」就提交：store 里有，状态 pending，没有后台地址', async () => {
    const user = userEvent.setup()
    render(<WishPage />)
    await openMerchant(user)

    await user.click(screen.getByRole('button', { name: '家长申请' }))

    await waitFor(() => {
      const apps = useApp.getState().settings.merchantApps ?? []
      expect(apps, '要落进 settings，不能只存在组件里').toHaveLength(1)
      expect(apps[0].role).toBe('parent')
      expect(apps[0].status, '客户端只能提交，通过与否是后台的事').toBe('pending')
      expect(apps[0].adminUrl, '没有后端，不许自己造后台地址').toBeUndefined()
    })
    // 提交之后那一路换成「审核中」，按钮消失（避免重复提交）；另一路照旧
    expect(await screen.findByText('审核中')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '家长申请' })).toBeNull()
    expect(screen.getByRole('button', { name: '商家申请' })).toBeTruthy()
  })

  it('两路互不覆盖：申请商家不会动到已提交的家长', async () => {
    const askedAt = Date.now() - 60_000
    await seed([parentApp({ createdAt: askedAt })])

    const user = userEvent.setup()
    render(<WishPage />)
    await openMerchant(user)

    await user.click(screen.getByRole('button', { name: '商家申请' }))

    await waitFor(() => {
      const apps = useApp.getState().settings.merchantApps ?? []
      expect(apps, '两条角色各存一条，不是覆盖').toHaveLength(2)
      expect(apps.map((a) => a.role).sort()).toEqual(['merchant', 'parent'])
      expect(
        apps.find((a) => a.role === 'parent')?.createdAt,
        '家长那条是上一次申请的时间，不该被刷新',
      ).toBe(askedAt)
    })
  })
})

describe('招商：审核通过之后', () => {
  it('★ 已通过且有后台链接：直出「打开后台」，点了才 window.open', async () => {
    await seed([
      {
        role: 'merchant',
        status: 'approved',
        createdAt: Date.now(),
        adminUrl: 'https://example.com/admin',
      },
    ])
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)

    const user = userEvent.setup()
    render(<WishPage />)
    await openMerchant(user)

    await user.click(await screen.findByRole('button', { name: /打开后台/ }))
    expect(open).toHaveBeenCalledWith(
      'https://example.com/admin',
      '_blank',
      'noopener,noreferrer',
    )
    open.mockRestore()
  })

  it('★ 已通过但链接还没生成：不画按钮，只说明在生成', async () => {
    await seed([{ role: 'merchant', status: 'approved', createdAt: Date.now() }])

    const user = userEvent.setup()
    render(<WishPage />)
    await openMerchant(user)

    expect(await screen.findByText('已通过')).toBeTruthy()
    expect(
      screen.queryByRole('button', { name: /打开后台/ }),
      '点了什么都不发生的按钮，比没有这颗按钮更糟',
    ).toBeNull()
    expect(screen.getByText(/后台链接还在生成/)).toBeTruthy()
  })
})

/* ============================================================
   存档：申请必须真的落盘
   ------------------------------------------------------------
   ⚠️ 上面那条只断言了 `useApp.getState().settings` —— 那是**内存**。
   `updateSettings` 是「先同步 set 内存、再串行落库」，落库那一半失败
   （写库被拦、Dexie 事务回滚）时内存照样是新的，测试也照样绿。
   本项目的老毛病：**同一份内存里读回恒真**。

   所以这里从 DB 重新读一次（`loadSettings`），再 `boot()` 一次
   —— 等于「关掉 App 再打开」。
   ============================================================ */
describe('招商：申请真的落盘（不是只在内存里）', () => {
  it('★ 提交之后从 DB 读得回来，重开 App 还显示「审核中」', async () => {
    const user = userEvent.setup()
    const first = render(<WishPage />)
    await openMerchant(user)

    await user.click(screen.getByRole('button', { name: '家长申请' }))

    await waitFor(async () => {
      // 判据取 DB，不取 store —— store 里那份在写库失败时也是对的
      const saved = await loadSettings()
      expect(saved.merchantApps, 'DB 里要有这一条').toHaveLength(1)
      expect(saved.merchantApps?.[0].role).toBe('parent')
      expect(saved.merchantApps?.[0].status).toBe('pending')
    })

    // 「重开 App」：卸载 → 重新 boot（从 DB 读设置）→ 再挂载
    first.unmount()
    await useApp.getState().boot()

    const second = render(<WishPage />)
    await openMerchant(user)
    expect(await screen.findByText('审核中')).toBeTruthy()
    expect(screen.getByText(/已经提交，等我们审核/)).toBeTruthy()
    second.unmount()
  })
})
