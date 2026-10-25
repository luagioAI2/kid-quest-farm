import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 往注册表里**注入一款「已经能买」的测试游戏**。
 *
 * 真实注册表里农场免费、娃娃机卖 120 钻石 —— 都能买，但价格和 id 会跟着
 * 版本变。注入一款自己的，断言就不用去猜「现在哪款是卖的」。
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
    kind: 'play' as const,
    status: 'available' as const,
    priceMall: 50,
    defaultOwned: false,
  }
  /*
    「还没做好」的那款也**注入**（2026-10-25）。
    原来是从真注册表里 `find(status === 'comingSoon')` —— 钓鱼池删掉之后
    一条都没有了，四条断言当场失去对照组。注入之后，不管注册表里有什么，
    「comingSoon 买不了 / 切不过去」都在被真的验。
  */
  const testSoon = {
    id: 'test-soon',
    name: '占位游戏',
    emoji: '🧪',
    tagline: '还没做好',
    kind: 'play' as const,
    status: 'comingSoon' as const,
    priceMall: 150,
    defaultOwned: false,
  }
  const games = [...actual.GAMES, testGame, testSoon]
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
const { GAME_FARM } = await import('./ids')
const { GAMES } = await import('./registry')

/**
 * 「还没做好的那款游戏」——**由上面的 mock 注入**，不从真注册表里找。
 *
 * ⚠️ 这段历史值得留着：原来写死 `GAME_CLAW`，2026-10-16 娃娃机上线
 * （`comingSoon` → `available`）之后三条断言当场就红了，红的原因是
 * 「例子过期了」，不是「功能坏了」；改成从注册表 `find(comingSoon)` 之后，
 * 2026-10-25 钓鱼池一删，注册表里**一条 comingSoon 都没有**，四条又红了。
 * ➜ 结论：**对照组要在用例里自己造**，不能指望生产数据里刚好有。
 */
const SOON = GAMES.find((g) => g.id === 'test-soon')

/* ============================================================
   买游戏 / 切当前 —— 插件骨架的经济闭环
   ============================================================ */

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 给钱包塞点钻石（真实 App 里还没有这个入口，见 MallSource 的注释） */
async function grantMall(amount: number) {
  await postMall({ delta: amount, source: 'manual_adjust', memo: '测试充值' })
  await useApp.getState().refresh()
}

beforeEach(async () => {
  await boot()
  // 抹平首装赠送的 500 钻石，让本文件所有用例的「钻石基线」回到 0。
  // 首装种子的专门断言在 useApp.test.ts 的「首装赠送 500 钻石」里。
  await db.mallLedger.clear()
  await useApp.getState().refresh()
})

describe('默认状态', () => {
  it('只有首款是已购买，当前游戏也是它', () => {
    expect(useApp.getState().ownedGameIds).toEqual([GAME_FARM])
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })

  it('钻石从 0 开始（家长栏里那个「手动发放」不点就是 0）', () => {
    expect(useApp.getState().mallBalance).toBe(0)
  })

  it('★ 注入的占位游戏真的在注册表里 —— 下面几条断言的对照组', () => {
    // 没有这一条的话，`SOON` 一旦变成 undefined，那几条「买不了 / 切不过去」
    // 就会**因为别的原因**通过（拿 undefined 去调 buyGame 当然失败），
    // 看着全绿，其实什么都没验。
    expect(SOON, '占位游戏没被注入 GAMES，下面几条断言会假绿').toBeTruthy()
  })
})

describe('买游戏', () => {
  it('钻石不够就买不了，而且**一笔账都不写**', async () => {
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
    const res = await useApp.getState().buyGame(SOON!.id)
    expect(res.ok).toBe(false)
    expect(useApp.getState().mallBalance).toBe(9999)
  })

  it('★ 内置娃娃机已整台移除（`claw` 不许回到注册表）', () => {
    // 2026-10-23：那台机器（ClawPage + clawEconomy + store 动作）全删了，
    // 娃娃机改由**插件**提供（`public/games/` + `localGames.ts`）。
    //
    // 这条断言钉的是「别再回来」：一旦有人把 `claw` 加回 `GAMES`，
    // 家长栏会多出一个付费格子，而 `pages.ts` 里没有它的页面 ——
    // 买下来、切成当前，孩子看到的就是一片空白。**而且不报错。**
    //
    // 原来这里验的是「真游戏买得下来 → 能切成当前」。那条链的每一环
    // 上面 `test-game` 那几条都覆盖了（买 → 扣钻石 → 拥有派生 → 切当前 → 落进设置），
    // 所以删掉它没有留下空洞。
    expect(GAMES.map((g) => g.id)).not.toContain('claw')
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
    await useApp.getState().setActiveGame(SOON!.id)
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
    await useApp.getState().updateSettings({ activeGame: SOON!.id })
    await useApp.getState().refresh()
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })
})
