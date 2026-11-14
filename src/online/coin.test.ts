import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { db, gameCoinBalanceOf, getGameKv, mirrorGameCoinBalance } from '../db/db'
import {
  coinFailToast,
  newCoinRequestId,
  oBuyCoins,
  oMintCoins,
  oMintVouchers,
  oRedeemCoins,
  oSpendCoins,
  oSpendPoints,
} from './coin'

/* ============================================================
   在线版 · 游戏币：**契约对齐** + 镜像
   ------------------------------------------------------------
   这一层的两个错法都**不报错**：
     ① 返回值契约和本地版不一致（`undefined` vs `false`）⇒ 插件里
        `if (ok)` 恒真 / 恒假，游戏行为变成「点了没反应」；
     ② 写成功但没把服务端那个 `balance` 镜像回去 ⇒ 插件读到的余额
        停在旧值，而流水是对的 —— 只有孩子会发现「币数不对」。

   真连服务端是 `scripts/_probe-coin-online.mjs` 的活。
   ============================================================ */

const buyMock = vi.fn()
const spendMock = vi.fn()
const mintMock = vi.fn()
const redeemMock = vi.fn()
const voucherMock = vi.fn()
const listMock = vi.fn()
const walletSpendMock = vi.fn()

vi.mock('../api/coin', () => ({
  buyCoins: (b: unknown) => buyMock(b),
  spendCoins: (b: unknown) => spendMock(b),
  mintCoins: (b: unknown) => mintMock(b),
  redeemCoins: (b: unknown) => redeemMock(b),
  mintVouchers: (b: unknown) => voucherMock(b),
  listCoinInfo: () => listMock(),
  coinInfo: () => listMock(),
  coinLedger: () => Promise.resolve({ count: 0, list: [] }),
}))
vi.mock('../api/wallet', () => ({
  walletSpend: (b: unknown) => walletSpendMock(b),
}))

const GAME = 'cloudfarm'

beforeEach(async () => {
  await db.gameKv.clear()
  for (const m of [buyMock, spendMock, mintMock, redeemMock, voucherMock, listMock, walletSpendMock]) {
    m.mockReset()
  }
})

describe('oBuyCoins', () => {
  it('成功后把**服务端返回的** balance 镜像进 `__coin`', async () => {
    buyMock.mockResolvedValue({ game_id: GAME, balance: 9, amount: 5, points: 50 })
    expect(await oBuyCoins(GAME, 5, 10)).toBe(true)
    expect(await gameCoinBalanceOf(GAME)).toBe(9)

    const body = buyMock.mock.calls[0][0] as { count: number; points_per_coin?: number }
    // 驼峰在 api/coin.ts 里翻成 snake —— 这里只看传进去的那个对象
    expect(body.count).toBe(5)
  })

  it('积分不够 → false（不是抛），而且**不写镜像**', async () => {
    buyMock.mockRejectedValue(new ApiError(10020301, '余额不足'))
    expect(await oBuyCoins(GAME, 5, 10)).toBe(false)
    expect(await getGameKv(GAME, '__coin')).toBeUndefined()
  })

  it('★ 数量 / 单价非正数**一个请求都不发**（服务端会把 0 兜底成 10）', async () => {
    expect(await oBuyCoins(GAME, 0, 10)).toBe(false)
    expect(await oBuyCoins(GAME, 5, 0)).toBe(false)
    expect(await oBuyCoins(GAME, -3, 10)).toBe(false)
    expect(buyMock).not.toHaveBeenCalled()
  })

  it('断网（网络错误）**继续抛** —— 由 hostApi 弹提示，不能装作成功', async () => {
    buyMock.mockRejectedValue(new ApiError(-1, '连不上'))
    await expect(oBuyCoins(GAME, 5, 10)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('oSpendCoins', () => {
  it('玩一局：成功后镜像服务端余额', async () => {
    spendMock.mockResolvedValue({ game_id: GAME, balance: 8, amount: -1 })
    expect(await oSpendCoins(GAME, 1, '玩一局')).toBe(true)
    expect(await gameCoinBalanceOf(GAME)).toBe(8)
  })

  it('币不够 → false（和本地 `spendGameCoin` 同一个契约）', async () => {
    spendMock.mockRejectedValue(new ApiError(10040901, '游戏币不足'))
    expect(await oSpendCoins(GAME, 1, '玩一局')).toBe(false)
    expect(await gameCoinBalanceOf(GAME)).toBe(0)
  })

  it('数量非正 → false，不发请求', async () => {
    expect(await oSpendCoins(GAME, 0, 'x')).toBe(false)
    expect(spendMock).not.toHaveBeenCalled()
  })

  it('★ 每次调用带一个**不同**的幂等键（否则第二次玩会报「已经做过了」）', async () => {
    spendMock.mockResolvedValue({ game_id: GAME, balance: 0, amount: -1 })
    await oSpendCoins(GAME, 1, 'a')
    await oSpendCoins(GAME, 1, 'b')
    const k1 = (spendMock.mock.calls[0][0] as { clientRequestId: string }).clientRequestId
    const k2 = (spendMock.mock.calls[1][0] as { clientRequestId: string }).clientRequestId
    expect(k1).toBeTruthy()
    expect(k1).not.toBe(k2)
  })
})

describe('oMintCoins', () => {
  it('铸币成功后镜像余额', async () => {
    mintMock.mockResolvedValue({ game_id: GAME, balance: 3, amount: 3 })
    await oMintCoins(GAME, 3, '赚到的')
    expect(await gameCoinBalanceOf(GAME)).toBe(3)
  })

  it('★ 0 / 负数**不发请求**（本地版对 `n <= 0` 是静默不写，服务端会报参数错误）', async () => {
    await oMintCoins(GAME, 0, '零')
    await oMintCoins(GAME, -5, '负')
    expect(mintMock).not.toHaveBeenCalled()
  })
})

describe('oRedeemCoins', () => {
  it('★ 汇率写 0（manifest 说不开放）时**一个请求都不发** —— 服务端不知道这件事', async () => {
    expect(await oRedeemCoins(GAME, 4, 0)).toBe(0)
    expect(redeemMock).not.toHaveBeenCalled()
  })

  it('★ 返回**服务端**发的券数，不是本地乘出来的', async () => {
    // manifest 说 1 币 = 2 券，服务端写死 1:1 只发 2 张
    redeemMock.mockResolvedValue({ game_id: GAME, balance: 0, amount: -2, vouchers: 2 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await oRedeemCoins(GAME, 2, 2)).toBe(2)
    // 而且必须留下一条能看懂的 warning，别让人去猜「券怎么少了」
    expect(warn).toHaveBeenCalled()
    expect(String(warn.mock.calls[0][0])).toContain('汇率不一致')
    warn.mockRestore()
  })

  it('汇率一致时安静通过（当前发布的插件全是 1:1）', async () => {
    redeemMock.mockResolvedValue({ game_id: GAME, balance: 2, amount: -3, vouchers: 3 })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await oRedeemCoins(GAME, 3, 1)).toBe(3)
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('币不够 → 0', async () => {
    redeemMock.mockRejectedValue(new ApiError(10040901, '游戏币不足'))
    expect(await oRedeemCoins(GAME, 3, 1)).toBe(0)
  })
})

describe('oMintVouchers', () => {
  it('返回服务端发的券数', async () => {
    voucherMock.mockResolvedValue({ game_id: GAME, vouchers: 4, coupon_balance: 40 })
    expect(await oMintVouchers(GAME, 4, '抓到娃娃')).toBe(4)
  })

  it('0 / 负数不发请求', async () => {
    expect(await oMintVouchers(GAME, 0, 'x')).toBe(0)
    expect(voucherMock).not.toHaveBeenCalled()
  })
})

describe('oSpendPoints（插件开局费）', () => {
  it('带 `refId = gameId`（家长看流水时要知道是哪款游戏扣的）', async () => {
    walletSpendMock.mockResolvedValue({ uid: 3, points: 90, coupon: 0, diamond: 0 })
    expect(await oSpendPoints(10, GAME, '开局')).toBe(true)
    const body = walletSpendMock.mock.calls[0][0] as { amount: number; refId: string }
    expect(body.amount).toBe(10)
    expect(body.refId).toBe(GAME)
  })

  it('积分不够 → false', async () => {
    walletSpendMock.mockRejectedValue(new ApiError(10020301, '余额不足'))
    expect(await oSpendPoints(10, GAME, '开局')).toBe(false)
  })

  it('★ 重试（同一个 request_id）被服务端按成功处理 —— 这里不能把它翻成 false', async () => {
    // 服务端 `SpendPoints` 对 `DuplicateLedgerEntry` 是**按成功返回**的，
    // 所以真到客户端这边只会是一个正常的 200。这条断言锁住「不要自己造一个 610」。
    walletSpendMock.mockResolvedValue({ uid: 3, points: 80, coupon: 0, diamond: 0 })
    expect(await oSpendPoints(10, GAME, '开局')).toBe(true)
  })
})

describe('newCoinRequestId', () => {
  it('每次都不同', () => {
    const a = newCoinRequestId()
    const b = newCoinRequestId()
    expect(a).not.toBe(b)
    expect(a.startsWith('gc-')).toBe(true)
  })
})

describe('coinFailToast', () => {
  it('币不够 / 积分不够各有一句人话', () => {
    expect(coinFailToast(new ApiError(10040901, 'x')).title).toBe('游戏币不够啦')
    expect(coinFailToast(new ApiError(10020301, 'x')).title).toBe('积分不够啦')
  })

  it('★ 断网时说清「刚才那一步没有生效」', () => {
    const t = coinFailToast(new ApiError(-1, '连不上'))
    expect(t.detail).toContain('没有生效')
  })
})

describe('mirrorGameCoinBalance', () => {
  it('写成单行账本：求和就是那个数，重写会覆盖而不是累加', async () => {
    await mirrorGameCoinBalance(GAME, 5)
    await mirrorGameCoinBalance(GAME, 2)
    expect(await gameCoinBalanceOf(GAME)).toBe(2)
  })
})
