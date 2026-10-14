import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 往注册表里**注入一款「已经能买」的测试游戏**。
 *
 * 真实注册表里一条都没有 —— 农场免费、另外两条是 `comingSoon`，
 * 所以「买成功」这条路在真实数据下走不到。不注入的话，这个文件里
 * 最关键的那条断言（付了钱 → 账本里多一笔 → 拥有关系跟着变）就只能靠嘴说。
 *
 * `vi.mock` 的工厂会被提升到文件顶部，所以它**不能引用外部变量** ——
 * 测试游戏只能就地定义。
 */
vi.mock('./registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./registry')>()
  const testGame = {
    id: 'test-game',
    name: '测试游戏',
    emoji: '🧪',
    tagline: '只在测试里存在',
    status: 'available' as const,
    priceMall: 50,
    defaultOwned: false,
  }
  const games = [...actual.GAMES, testGame]
  return {
    ...actual,
    GAMES: games,
    /*
      ⚠️ **`gameById` 必须跟着一起换掉。**
      它是个闭包，引用的是模块内部那个 `GAMES` 绑定 —— 只替换导出数组的话，
      它照样去**原来的**数组里找，于是 `gameById('test-game')` 返回 undefined，
      而 `buyGame` 的第一道守卫就会静默地判「没有这款游戏」。
      症状特别像「mock 没生效」，其实是只换了一半。
    */
    gameById: (id?: string) => games.find((g) => g.id === id),
  }
})

const { db, currentMallBalance, postMall } = await import('../db/db')
const { useApp } = await import('../store/useApp')
const { GAME_CLAW, GAME_FARM } = await import('./ids')

/* ============================================================
   买游戏 / 切当前 —— 插件骨架的经济闭环
   ============================================================ */

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 给钱包塞点商城币（真实 App 里还没有这个入口，见 MallSource 的注释） */
async function grantMall(amount: number) {
  await postMall({ delta: amount, source: 'manual_adjust', memo: '测试充值' })
  await useApp.getState().refresh()
}

beforeEach(async () => {
  await boot()
})

describe('默认状态', () => {
  it('只有首款是已购买，当前游戏也是它', () => {
    expect(useApp.getState().ownedGameIds).toEqual([GAME_FARM])
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })

  it('商城币从 0 开始（这一轮没有发币入口）', () => {
    expect(useApp.getState().mallBalance).toBe(0)
  })
})

describe('买游戏', () => {
  it('商城币不够就买不了，而且**一笔账都不写**', async () => {
    const res = await useApp.getState().buyGame('test-game')
    expect(res.ok).toBe(false)
    expect(await db.mallLedger.count()).toBe(0)
    expect(useApp.getState().ownedGameIds).not.toContain('test-game')
  })

  it('够钱就买得下来：扣币 + 拥有关系从账本派生出来', async () => {
    await grantMall(100)
    const res = await useApp.getState().buyGame('test-game')
    expect(res.ok).toBe(true)
    expect(useApp.getState().mallBalance).toBe(50)
    // 拥有关系**不是**另存的，是 refresh 时从账本重新推出来的
    expect(useApp.getState().ownedGameIds).toContain('test-game')
    expect(await currentMallBalance()).toBe(50)
  })

  it('买完不会自动切成当前（切当前是一次显式操作）', async () => {
    await grantMall(100)
    await useApp.getState().buyGame('test-game')
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })

  it('已经买过的不让再买一次（不会重复扣币）', async () => {
    await grantMall(200)
    await useApp.getState().buyGame('test-game')
    const again = await useApp.getState().buyGame('test-game')
    expect(again.ok).toBe(false)
    expect(useApp.getState().mallBalance).toBe(150)
  })

  it('还没做好的游戏买不了（`comingSoon` 不给买）', async () => {
    await grantMall(9999)
    const res = await useApp.getState().buyGame(GAME_CLAW)
    expect(res.ok).toBe(false)
    expect(useApp.getState().mallBalance).toBe(9999)
  })

  it('不存在的游戏买不了', async () => {
    await grantMall(9999)
    const res = await useApp.getState().buyGame('没有这款')
    expect(res.ok).toBe(false)
  })
})

describe('切「当前游戏」', () => {
  it('买过的才能切成当前', async () => {
    await grantMall(100)
    await useApp.getState().buyGame('test-game')
    await useApp.getState().setActiveGame('test-game')
    expect(useApp.getState().activeGameId).toBe('test-game')
  })

  it('没买的切不过去，而且是**安静地**拒绝（不抛异常）', async () => {
    await useApp.getState().setActiveGame('test-game')
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })

  it('还没做好的切不过去', async () => {
    await useApp.getState().setActiveGame(GAME_CLAW)
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })

  it('不存在的 id 切不过去', async () => {
    await useApp.getState().setActiveGame('幽灵游戏')
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })

  it('当前游戏会落进设置（重启后还在）', async () => {
    await grantMall(100)
    await useApp.getState().buyGame('test-game')
    await useApp.getState().setActiveGame('test-game')
    expect(useApp.getState().settings.activeGame).toBe('test-game')
  })
})

describe('存档里的当前游戏失效时兜底', () => {
  it('指向一款不存在的游戏 → 回落到首款', async () => {
    await useApp.getState().updateSettings({ activeGame: '幽灵游戏' })
    await useApp.getState().refresh()
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })

  it('指向一款「还没做好的」游戏 → 回落到首款', async () => {
    // 家长栏里看到的「已购买」和底部导航必须是同一件事：
    // 存档被手改 / 导入了别的设备的备份，都不能让导航指向一个空白页。
    await useApp.getState().updateSettings({ activeGame: GAME_CLAW })
    await useApp.getState().refresh()
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })
})
