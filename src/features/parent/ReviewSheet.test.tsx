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

    /* ⚠️ 判据必须是 **store**，不能是「库行」：
       `user.click` 只等到事件派发，保存按钮的 async 处理函数还在跑 ——
       它先 `put`（库行立刻就对），再 `await refresh()`（要读十几张表）。
       拿库行当判据会在 put 一落地就通过，于是用例结束、下一条 `beforeEach`
       的 `db.delete()` 把还在读表的 `refresh()` 掀翻 ——
       症状是「全绿 + 一条 DatabaseClosedError」。
       store 那份是 `refresh()` 末尾赋的值，读到它就等于 refresh 收工了。 */
    await waitFor(() => {
      const offer = useApp.getState().wishOffers.find((o) => o.itemId === 'wish-blindbox')
      expect(offer?.voucherPrice, '定价要真的写进 wishOffers').toBe(30)
    })
    expect((await db.wishOffers.get('wish-blindbox'))?.voucherPrice).toBe(30)
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

    /* ⚠️ 判据必须是 **store**，不能是「库行」：
       `user.click` 只等到事件派发，保存按钮的 async 处理函数还在跑 ——
       它先 `put`（库行立刻就对），再 `await refresh()`（要读十几张表）。
       拿库行当判据会在 put 一落地就通过，于是用例结束、下一条 `beforeEach`
       的 `db.delete()` 把还在读表的 `refresh()` 掀翻 ——
       症状是「全绿 + 一条 DatabaseClosedError」。
       store 那份是 `refresh()` 末尾赋的值，读到它就等于 refresh 收工了。 */
    await waitFor(() => {
      const row = useApp.getState().wishOrders.find((o) => o.id === 'wo_wish')
      expect(row?.status, '回绝之后不能还停在 wished').toBe('cancelled')
      // 理由的落点是商品详情页那句「上次爸妈说：…」（「我许的愿」2026-10-29 下线）
      expect(row?.cancelReason, '孩子再点进那件商品就能看到理由').toContain('先不换')
    })
    expect((await db.wishOrders.get('wo_wish'))?.cancelReason).toContain('先不换')
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

/* ============================================================
   第六轮：审核时一起定「能兑换几次」（2026-11-06）
   ------------------------------------------------------------
   用户原话：「家长审核设定兑换卷数量时，还得填是否一次性兑换，
   都设定好后，接着加入到兑换列表。」

   这条如果只在心愿页的定价屏（`OfferView`）做，家长从 👀 进来审核
   时就没有这个选项 —— 而 👀 才是他们真正用的那个入口。
   ============================================================ */
describe('家长审核面板：能兑换几次', () => {
  it('★ 默认：盲盒 / 游戏是一次性（省得家长每次都点）', async () => {
    await db.wishOrders.put(wishedOrder() as never)
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<ReviewSheet />)
    await user.click(await screen.findByRole('button', { name: /开放兑换 · 30 张/ }))

    await waitFor(() => {
      const offer = useApp.getState().wishOffers.find((o) => o.itemId === 'wish-blindbox')
      expect(offer?.oneTime, '游戏类默认一次性').toBe(true)
    })
    expect((await db.wishOffers.get('wish-blindbox'))?.oneTime).toBe(true)
  })

  it('★ 实物默认可重复；点「只兑换一次」后跟着券价一起落库', async () => {
    await db.wishOrders.put(
      wishedOrder({
        itemId: 'wish-dino',
        itemName: '恐龙模型套装',
        itemEmoji: '🦕',
        kind: 'toy',
      }) as never,
    )
    await useApp.getState().refresh()

    const user = userEvent.setup()
    render(<ReviewSheet />)
    expect(await screen.findByText('能兑换几次？'), '审核卡上要有这一项').toBeTruthy()

    await user.click(screen.getByText('只兑换一次'))
    await user.click(await screen.findByRole('button', { name: /开放兑换 · 30 张/ }))

    await waitFor(() => {
      const offer = useApp.getState().wishOffers.find((o) => o.itemId === 'wish-dino')
      expect(offer?.voucherPrice).toBe(30)
      expect(offer?.oneTime, '选了「只兑换一次」要真的写进去').toBe(true)
    })
    const saved = await db.wishOffers.get('wish-dino')
    expect(saved?.voucherPrice).toBe(30)
    expect(saved?.oneTime, '真的落盘了').toBe(true)
  })
})
