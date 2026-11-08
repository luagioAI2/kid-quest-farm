import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { useApp } from '@/store/useApp'
import { GameMarket } from './GameStore'
import type { GameManifestV2 } from '@/games/plugin'
import { CATALOG_URL, catalogConfigured } from '@/games/catalogUrl'
import { LOCAL_GAMES } from '@/games/localGames'

/* ============================================================
   设置 → 游戏：**一款游戏只出现一次**（2026-11-08）
   ------------------------------------------------------------
   家长第三次提同一件事了：

     2026-10-25「感觉没必要 单独 已购买，已下载，敬请期待，直接 在 游戏市场。
                 每个游戏 不同状态呗。」
     2026-11-07「未拥有的游戏不要显示在上面，除非已经激活拥有。」
     2026-11-08「为啥 设置 游戏里 会有 从服务器下载 … 上面不是已经有游戏列表吗，
                 没下载就是没下载的状态呀。」

   ⇒ 「从服务器下载」那一块已经并进上面那张表：行上的按钮就是**下载**，
     先走 `installFromCatalog`（验签 + 哈希），拿不到再用随包发的本地包。

   这条测试钉两件事，两件都可能被「图省事」改回去：
     ① 第二块列表不许回来（`data-remote-*` 那套锚点一个都不许有）；
     ② 已拥有但没装的那一行，按钮文案是「下载」—— 家长就是这么读的。

   ⚠️ 前提：测试环境的 `CATALOG_URL` 必须是空的（`vitest` 不注入
   `VITE_GAME_CATALOG_URL`）。先断言前提，否则这条会退化成永远绿。
   ============================================================ */

describe('设置 → 游戏：一款游戏只出现一次', () => {
  it('前提：测试环境没有注入目录地址', () => {
    expect(CATALOG_URL).toBe('')
    expect(catalogConfigured()).toBe(false)
  })

  it('★ 没有第二块「从服务器下载」', () => {
    render(<GameMarket gateOpen />)
    expect(document.querySelector('[data-remote-section]')).toBeNull()
    expect(document.querySelector('[data-remote-row]')).toBeNull()
    expect(document.querySelector('[data-remote-install]')).toBeNull()
    // 判据最后落在**用户看到的字**上：锚点可能改名，文案才是事实
    expect(document.body.textContent ?? '').not.toContain('从服务器下载')
  })

  it('★ 已拥有但没下载：行上那颗按钮就叫「下载」', () => {
    useApp.setState({ ownedGameIds: ['cloudfarm'], installedGames: {} })
    render(<GameMarket gateOpen />)

    const btn = document.querySelector('[data-local-install="cloudfarm"]') as HTMLButtonElement | null
    expect(btn, '没拥有/没装的行必须有安装入口').toBeTruthy()
    expect(btn!.textContent, '家长说的就是「下载」这个词').toContain('下载')

    // 同一款游戏只许出现一行（两处能改，就一定会走散）
    expect(document.querySelectorAll('[data-local-row="cloudfarm"]').length).toBe(1)
  })

  /* 「更新」这条链是 2026-11-07 补的：只给「设为当前」的话，发一版修好的包，
     装过旧版的机器永远看不到它。合并成一张表之后这条链要跟着活下来。 */
  /* ★ 别写死版本号：`localGames.ts` 是构建时算出来的，手抄一份必然有一天走散
     （1.1.4 → 1.1.6 那次就是，红了但原因是测试自己过期）。这里直接读清单。 */
  const CLOUDFARM_VERSION = LOCAL_GAMES.find((g) => g.id === 'cloudfarm')!.version
  const oldCloudfarm: GameManifestV2 = {
    id: 'cloudfarm',
    name: '云边小农场',
    emoji: '🌾',
    tabLabel: '云边',
    version: '1.1.0',
    minHostApi: 1,
    coin: { id: 'cf_coin', name: '麦粒', emoji: '🌾' },
    economy: { playCost: 10, expectedPayout: 6, capPerPrize: 30, voucherPerCoin: 1 },
  }

  it('★ 装的是旧版：按钮写「更新」，版本号写「旧 → 新」', () => {
    useApp.setState({ ownedGameIds: ['cloudfarm'], installedGames: { cloudfarm: oldCloudfarm } })
    render(<GameMarket gateOpen />)

    const btn = document.querySelector('[data-local-install="cloudfarm"]') as HTMLButtonElement | null
    expect(btn, '旧版也要有升级入口').toBeTruthy()
    expect(btn!.textContent, '按钮说的是「更新」而不是「下载」').toContain('更新')

    const row = document.querySelector('[data-local-row="cloudfarm"]') as HTMLElement
    expect(row.textContent, '只写目标版本会让人以为装的就是那一版').toContain(
      `v1.1.0 → v${CLOUDFARM_VERSION}`,
    )
  })
})
