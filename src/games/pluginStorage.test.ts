import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 用**假包**替掉真加载器。
 *
 * 真的 `importBundle` 走 `Blob → createObjectURL → import()`，这条链在
 * node/jsdom 里跑不起来（没有 `URL.createObjectURL`）。这里要测的是
 * **store 的接线**（下载 → 落盘 → 派生清单 → 解析当前游戏 → 卸载回落），
 * 不是加载器本身 —— 所以把「代码文本 → GameBundle」这一跳换成一个
 * 读 JSON 的假实现：测试里传的「包」就是一段 JSON 文本，好读好断言。
 *
 * ⚠️ 加载器自己的三道门由 `loader.test.ts` 覆盖（纯函数），
 * 浏览器里那条真实链路由 `scripts/capture-game-bundle.mjs` 覆盖。
 */
vi.mock('./loader', () => ({
  BundleLoadError: class extends Error {},
  validateBundle: () => {
    throw new Error('测试里不该走 validateBundle')
  },
  importBundle: async (code: string) => {
    const manifest = JSON.parse(code) as Record<string, unknown>
    return { manifest, mount: () => () => {} }
  },
  mountBundle: () => () => {},
}))

const { db, getGameKv, setGameKv, listGameKv, clearGameKv, listInstalledBundles, BUNDLE_KEY } =
  await import('../db/db')
const { useApp } = await import('../store/useApp')
const { makeHostApi } = await import('./hostApi')
const { GAME_FARM } = await import('./ids')

async function boot() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
}

/** 一段合法的「假包」代码（测试里 `importBundle` 会把它当 JSON 读） */
function fakeBundleCode(id: string, over: Record<string, unknown> = {}) {
  return JSON.stringify({
    id,
    name: `游戏 ${id}`,
    emoji: '🎲',
    tabLabel: id,
    version: '1.0.0',
    minHostApi: 1,
    coin: { id: 'c', name: '币', emoji: '🪙' },
    economy: { playCost: 5, expectedPayout: 3, capPerPrize: 9 },
    ...over,
  })
}

/** 让 `installGameFromUrl` 里的 `fetch` 返回给定的代码文本 */
function stubFetch(code: string) {
  vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, text: async () => code }))
}

beforeEach(async () => {
  vi.unstubAllGlobals()
  await boot()
})

/* ============================================================
   ① gameKv —— 命名空间隔离
   ============================================================ */

describe('gameKv 的命名空间', () => {
  it('两款游戏写同一个键，互不覆盖', async () => {
    // 这是这张表存在的**唯一理由**：一张表装所有游戏的私有状态。
    // 前缀拼错（或者干脆忘了拼）就会让两个游戏互相踩，而且不报错。
    await setGameKv('a', 'score', 1)
    await setGameKv('b', 'score', 2)
    expect(await getGameKv<number>('a', 'score')).toBe(1)
    expect(await getGameKv<number>('b', 'score')).toBe(2)
  })

  it('`listGameKv` 只返回自己那款游戏的键', async () => {
    await setGameKv('a', 'score', 1)
    await setGameKv('a', 'level', 3)
    await setGameKv('b', 'score', 99)
    expect(await listGameKv('a')).toEqual({ score: 1, level: 3 })
  })

  it('`clearGameKv` 只清自己那款，碰不到别人', async () => {
    await setGameKv('a', 'score', 1)
    await setGameKv('b', 'score', 2)
    const removed = await clearGameKv('a')
    expect(removed).toBe(1)
    expect(await getGameKv('a', 'score')).toBeUndefined()
    expect(await getGameKv<number>('b', 'score')).toBe(2)
  })

  it('前缀是 `<gameId>:`，而且 gameId 里带冒号也不会串味', async () => {
    // `listGameKv` 是靠 `slice(gameId.length + 1)` 剥前缀的。
    // gameId 本身含 `:` 时，剥前缀仍然只按**长度**剥，不会切错。
    await setGameKv('a:b', 'k', 'v')
    expect(await listGameKv('a:b')).toEqual({ k: 'v' })
    expect(await getGameKv<string>('a:b', 'k')).toBe('v')
  })

  it('`listInstalledBundles` 只认 `__bundle` 键，普通状态不算包', async () => {
    await setGameKv('demo', BUNDLE_KEY, 'CODE')
    await setGameKv('demo', 'score', 7)
    await setGameKv('other', 'score', 8)
    expect(await listInstalledBundles()).toEqual([{ gameId: 'demo', code: 'CODE' }])
  })

  it('`__bundle` 存的值不是字符串就不算已安装（脏数据不炸）', async () => {
    await setGameKv('demo', BUNDLE_KEY, { 不是: '字符串' })
    expect(await listInstalledBundles()).toEqual([])
  })
})

/* ============================================================
   ② 备份往返 —— 下载来的游戏不能一备份就没
   ============================================================ */

describe('备份带上 gameKv', () => {
  it('导出 → 清空 → 导入，游戏的状态和包都回来了', async () => {
    // ★ 这条是本组的**核心**。`gameKv` 漏出备份的话，家长换手机 /
    //   清库恢复之后，所有下载来的游戏会**静默消失** —— 不报错，
    //   只是「我明明装过的游戏没了」。
    await setGameKv('demo', BUNDLE_KEY, fakeBundleCode('demo'))
    await setGameKv('demo', 'draws', 12)

    const backup = await useApp.getState().exportBackup()

    await db.gameKv.clear()
    expect(await getGameKv('demo', 'draws')).toBeUndefined()

    const res = await useApp.getState().importBackup(backup)
    expect(res.ok).toBe(true)

    expect(await getGameKv<number>('demo', 'draws')).toBe(12)
    expect(await listInstalledBundles()).toEqual([
      { gameId: 'demo', code: fakeBundleCode('demo') },
    ])
  })

  it('导入后 `installedGames` 立刻派生出来（不用重启）', async () => {
    await setGameKv('demo', BUNDLE_KEY, fakeBundleCode('demo'))
    const backup = await useApp.getState().exportBackup()
    await db.gameKv.clear()
    await useApp.getState().importBackup(backup)
    expect(Object.keys(useApp.getState().installedGames)).toEqual(['demo'])
  })
})

/* ============================================================
   ③ HostApi —— 插件的币是「算出来」的
   ============================================================ */

function hostFor(gameId: string) {
  return makeHostApi({
    getBalance: () => useApp.getState().balance,
    refresh: () => useApp.getState().refresh(),
    pushToast: () => {},
    soundEnabled: () => false,
    hapticsEnabled: () => false,
  })(gameId)
}

describe('HostApi：插件的币', () => {
  it('余额 = 全部 delta 之和（不存 balance 字段）', async () => {
    const host = hostFor('demo')
    await host.mintGameCoin(3, '第一次')
    await host.mintGameCoin(4, '第二次')
    expect(await host.gameCoinBalance()).toBe(7)
  })

  it('铸 0 或负数**一笔都不写**（不是写了个 0 进去）', async () => {
    // 插件不该有「销毁自己的币」这条能力。写成 `if (n < 0) return` 就会
    // 往账本里塞 0 行 —— 余额看着对，流水却多出无意义的行。
    const host = hostFor('demo')
    await host.mintGameCoin(0, '零')
    await host.mintGameCoin(-5, '负')
    expect(await host.gameCoinBalance()).toBe(0)
    // ★ 判据是「**连账本行都不存在**」，不是「账本是空数组」——
    //   后者在「压根没写过」和「写了个空的进去」两种情况下都成立。
    expect(await getGameKv<unknown[]>('demo', '__coin')).toBeUndefined()
  })

  it('币是**按游戏分开**的', async () => {
    await hostFor('demo').mintGameCoin(5, 'x')
    expect(await hostFor('other').gameCoinBalance()).toBe(0)
  })

  it('脏账本（不是数组）当空账，不炸', async () => {
    await setGameKv('demo', '__coin', '我不是数组')
    expect(await hostFor('demo').gameCoinBalance()).toBe(0)
  })

  it('账本里混进坏行只丢坏行，好行照算', async () => {
    await setGameKv('demo', '__coin', [{ delta: 3, memo: 'ok', at: 1 }, null, { 没有: 'delta' }])
    expect(await hostFor('demo').gameCoinBalance()).toBe(3)
  })
})

describe('HostApi：花积分', () => {
  /**
   * ⚠️ 断言一律**相对**开局余额，不写死数字。
   * 开局是有赠送积分的（`boot()` 会种一笔），写死 `toBe(4)` 这种
   * 就等于把种子数据抄进了测试 —— 改了赠送额度，测试会红得莫名其妙，
   * 而它想守的其实是「扣了多少」。
   */
  it('余额不够 → 返回 false，**一分都不扣**', async () => {
    const before = useApp.getState().balance
    const host = hostFor('demo')
    expect(await host.spendPoints(before + 1, '玩一次')).toBe(false)
    expect(await host.gameCoinBalance()).toBe(0)
    expect(useApp.getState().balance).toBe(before)
    // 连一笔账都不该写 —— 「守卫失败但仍记了一笔 0」也是账本污染
    expect((await db.ledger.toArray()).filter((r) => r.source === 'game_spend')).toEqual([])
  })

  it('余额够 → 扣掉，并记成 `game_spend`（refId 是游戏 id）', async () => {
    const before = useApp.getState().balance
    const host = hostFor('demo')
    expect(await host.spendPoints(5, '玩一次')).toBe(true)
    expect(useApp.getState().balance).toBe(before - 5)

    // 记 source 和 refId 是为了让家长能看出「这 5 分是哪款游戏花的」。
    // 少了 refId，账本就是一堆「-5 游戏投入」，分不清谁花的。
    const rows = await db.ledger.toArray()
    const spend = rows.find((r) => r.source === 'game_spend')
    expect(spend?.delta).toBe(-5)
    expect(spend?.refId).toBe('demo')
  })
})

describe('HostApi：storage 绑定 gameId', () => {
  it('插件给「自己的键」，前缀由宿主拼 —— 两个实例互不可见', async () => {
    const a = hostFor('a')
    const b = hostFor('b')
    await a.storage.set('score', 1)
    await b.storage.set('score', 2)
    expect(await a.storage.get<number>('score')).toBe(1)
    expect(await b.storage.get<number>('score')).toBe(2)
    expect(await a.storage.list()).toEqual({ score: 1 })
  })

  /**
   * ★★ 宿主保留键（`__` 开头）必须挡住。
   *
   * 这条是走查脚本 `capture-game-bundle.mjs` 第一次跑**真的撞出来**的：
   * 另一个游戏调 `storage.list()` 看到了 `__bundle`（它自己的源码）。
   * 顺着查下去发现更严重的 —— `storage.set('__coin', [])` 能把
   * **自己的币账本清空**，正好绕过 `mintGameCoin` 里那条
   * 「拒绝 n<=0」（插件不该有销毁自己币的能力）的守卫。
   */
  it('★ `list` 不返回宿主保留键（看不到 `__bundle` / `__coin`）', async () => {
    const host = hostFor('demo')
    await host.storage.set('draws', 3)
    await host.mintGameCoin(5, 'x') // 会写 `__coin`
    await setGameKv('demo', BUNDLE_KEY, 'CODE') // 模拟已安装

    expect(await host.storage.list()).toEqual({ draws: 3 })
  })

  it('★★ 写保留键会**抛**（不是静默忽略 —— 那是插件的 bug，要看得见）', async () => {
    const host = hostFor('demo')
    await expect(host.storage.set('__coin', [])).rejects.toThrow(/保留/)
    await expect(host.storage.get('__coin')).rejects.toThrow(/保留/)
  })

  it('★★ 那条后门真的关上了：写过 `__coin` 之后币还在', async () => {
    const host = hostFor('demo')
    await host.mintGameCoin(7, '赚到的')
    await host.storage.set('__coin', []).catch(() => {}) // 试着清空
    expect(await host.gameCoinBalance()).toBe(7)
  })
})

/* ============================================================
   ④ store 接线 —— 装 / 切 / 卸
   ============================================================ */

describe('安装', () => {
  it('从 URL 装下来：落进 gameKv，并出现在 installedGames 里', async () => {
    stubFetch(fakeBundleCode('demo'))
    const res = await useApp.getState().installGameFromUrl('https://example.com/demo.js')
    expect(res.ok).toBe(true)
    expect(await getGameKv<string>('demo', BUNDLE_KEY)).toBe(fakeBundleCode('demo'))
    expect(useApp.getState().installedGames.demo?.name).toBe('游戏 demo')
  })

  it('★★ 包用了**内置游戏的 id** → 拒绝安装', async () => {
    // 不拦的话，一个包就能顶掉「农场」：`gameById` 先命中注册表，
    // 家长看到的是「农场」，玩到的却是别人的代码；卸载它还会把
    // 内置游戏一起带下水。这不是重名，是**劫持**。
    stubFetch(fakeBundleCode(GAME_FARM))
    const res = await useApp.getState().installGameFromUrl('https://example.com/evil.js')
    expect(res.ok).toBe(false)
    expect(res.message).toContain(GAME_FARM)
    expect(await getGameKv<string>(GAME_FARM, BUNDLE_KEY)).toBeUndefined()
    expect(useApp.getState().installedGames[GAME_FARM]).toBeUndefined()
  })

  it('下载失败（HTTP 500）→ 报错，**不写任何东西**', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 500, text: async () => '' }))
    const res = await useApp.getState().installGameFromUrl('https://example.com/x.js')
    expect(res.ok).toBe(false)
    expect(res.message).toContain('500')
    expect(await db.gameKv.count()).toBe(0)
  })

  it('包本身不合规 → 报错，且**不落盘**（坏包不该进库）', async () => {
    stubFetch('这不是 JSON')
    const res = await useApp.getState().installGameFromUrl('https://example.com/bad.js')
    expect(res.ok).toBe(false)
    expect(await db.gameKv.count()).toBe(0)
  })
})

describe('切「当前游戏」：下载来的游戏', () => {
  it('装好之后能设为当前，而且 `activeGameId` 真的解析成它', async () => {
    // ★ 这是整个 P1 的**成败点**。`resolveActiveGame` 原来只认注册表，
    //   而下载来的游戏**不在注册表里** —— 于是「装好了却切不过去」，
    //   整个插件系统退化成「能装不能玩」，且不报错。
    stubFetch(fakeBundleCode('demo'))
    await useApp.getState().installGameFromUrl('https://example.com/demo.js')
    await useApp.getState().setActiveGame('demo')
    expect(useApp.getState().settings.activeGame).toBe('demo')
    expect(useApp.getState().activeGameId).toBe('demo')
  })

  it('没装的 id 切不过去（安静地拒绝）', async () => {
    await useApp.getState().setActiveGame('幽灵游戏')
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })
})

describe('卸载', () => {
  it('卸载正在玩的那款 → 回落到农场，并且包和状态一起没了', async () => {
    stubFetch(fakeBundleCode('demo'))
    await useApp.getState().installGameFromUrl('https://example.com/demo.js')
    await useApp.getState().setActiveGame('demo')
    await setGameKv('demo', 'draws', 9)

    await useApp.getState().uninstallGame('demo')

    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
    expect(useApp.getState().settings.activeGame).toBe(GAME_FARM)
    // 只删包不删状态的话，重装会**捡到上一次的存档** —— 看起来像「卸载没生效」
    expect(await getGameKv('demo', 'draws')).toBeUndefined()
    expect(useApp.getState().installedGames.demo).toBeUndefined()
  })

  it('卸载**没在玩**的那款 → 当前游戏不动', async () => {
    stubFetch(fakeBundleCode('demo'))
    await useApp.getState().installGameFromUrl('https://example.com/demo.js')
    await useApp.getState().uninstallGame('demo')
    expect(useApp.getState().activeGameId).toBe(GAME_FARM)
  })
})

describe('重启（refresh）后还在', () => {
  it('包和「当前游戏」都从库里恢复，不靠内存', async () => {
    stubFetch(fakeBundleCode('demo'))
    await useApp.getState().installGameFromUrl('https://example.com/demo.js')
    await useApp.getState().setActiveGame('demo')

    // 模拟冷启动：不删库，只让 store 重新读一遍
    await useApp.getState().refresh()

    expect(useApp.getState().installedGames.demo?.id).toBe('demo')
    expect(useApp.getState().activeGameId).toBe('demo')
  })
})
