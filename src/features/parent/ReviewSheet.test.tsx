import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { ReviewSheet } from './ReviewSheet'

/* ============================================================
   家长审核面板 —— 孩子的心愿也进这个队列（2026-10-29）
   ------------------------------------------------------------
   家长原话：「我希望 心愿商城 爸爸妈妈收到心愿，也跟任务一样，出现在
   上边栏的 眼睛那，而不是在心愿商城这里。爸爸妈妈会查看处理。」

   第一版把入口摆在**心愿页顶部**，家长当天就要求挪到 👀。所以：

     · 队列里多了一种条目（`kind: 'wish'`），和任务 / 签到并排；
     · 回应就地完成（定价 / 这次先不换），**不用**再跳去心愿商城；
     · 定价之后那条心愿必须**离开队列**，否则顶栏红点永远消不掉 ——
       因为家长定完价，单子在数据上**仍然是 `wished`**（等孩子来换）。
       判据在 `wishesAwaitingReply`：这件商品现在有没有开放价。
   ============================================================ */

const wishedOrder = (patch: Record<string, unknown> = {}) => ({
  id: 'wo_wish',
  itemId: 'wish-blindbox',
  itemName: '游戏盲盒',
  itemEmoji: '🎁',
  kind: 'blindbox' as const,
  voucherPrice: 0,
  status: 'wished' as const,
  vouchersHeld: 0,
  createdAt: Date.now(),
  ...patch,
})

beforeEach(async () => {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
})

describe('家长审核面板：孩子的心愿', () => {
  it('★ 孩子点过「想要」的商品出现在待办队列里', async () => {
    await db.wishOrders.put(wishedOrder() as never)
    await useApp.getState().refresh()

    render(<ReviewSheet />)

    expect(await screen.findByText('游戏盲盒'), '心愿要出现在队列里').toBeTruthy()
    expect(screen.getByText(/孩子想要这个/), '家长要知道这是孩子主动提的').toBeTruthy()
    // 定价靠的是「孩子攒不攒得到」，所以余额必须摆出来
    expect(screen.getByText('孩子现在有')).toBeTruthy()
  })

  it('★ 就地定价：定完价这件商品对孩子开放，待办清掉', async () => {
    await db.wishOrders.put(wishedOrder() as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<ReviewSheet />)
    // 默认 30 张（和心愿页的定价屏同一个起点）
    await user.click(await screen.findByRole('button', { name: /开放兑换 · 30 张/ }))

    await waitFor(async () => {
      const offer = await db.wishOffers.get('wish-blindbox')
      expect(offer?.voucherPrice, '定价要真的写进 wishOffers').toBe(30)
    })
    /* 定价 = 回应。这条心愿立刻离开队列 —— 否则家长定完价、孩子还没换的
       那段时间里，顶栏 👀 的红点会一直亮着一个已经处理过的待办。 */
    expect(await screen.findByText(/都看完啦/), '队列要清空').toBeTruthy()
  })

  it('★ 已经定过价的心愿不再占着待办（红点才会消）', async () => {
    // 对照组：数据里那条单子**仍然是 `wished`**（等孩子来兑换），
    // 只有「有没有开放价」这一个判据能把它排除掉。
    await db.wishOrders.put(wishedOrder() as never)
    await db.wishOffers.put({
      itemId: 'wish-blindbox',
      voucherPrice: 20,
      openedAt: Date.now(),
    } as never)
    await useApp.getState().refresh()

    render(<ReviewSheet />)

    expect(await screen.findByText(/都看完啦/)).toBeTruthy()
    expect(screen.queryByText('游戏盲盒'), '开放了就不该还在待办里').toBeNull()
  })

  it('★ 「这次先不换」：单子真的结束，理由孩子看得到', async () => {
    await db.wishOrders.put(wishedOrder() as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<ReviewSheet />)
    await user.click(await screen.findByRole('button', { name: /这次先不换/ }))

    await waitFor(async () => {
      const row = await db.wishOrders.get('wo_wish')
      expect(row?.status, '回绝之后不能还停在 wished').toBe('cancelled')
      expect(row?.cancelReason, '孩子要在「我许的愿」里看到理由').toContain('先不换')
    })
    expect(await screen.findByText(/都看完啦/)).toBeTruthy()
  })

  it('心愿排在任务/签到前面（孩子在等回话）', async () => {
    // 签到按天攒，晚几分钟确认不影响；一条心愿是孩子**只能干等**的事。
    await db.wishOrders.put(wishedOrder() as never)
    const inst = useApp
      .getState()
      .instances.find((i) => i.status === 'pending' && i.cycle === 'daily')
    expect(inst, '全新档案里应该有今天的每日任务').toBeTruthy()
    await useApp.getState().submitInstance(inst!.id, 10, undefined)
    await useApp.getState().refresh()

    render(<ReviewSheet />)

    // 队列里两条：第 1 个是心愿
    expect(await screen.findByText(/第 1 \/ 2 个/)).toBeTruthy()
    expect(screen.getByText('游戏盲盒')).toBeTruthy()
    expect(screen.queryByText(inst!.title), '心愿没看完之前不该先摆任务').toBeNull()
  })
})
