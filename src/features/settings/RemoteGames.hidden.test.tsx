import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { GameMarket } from './GameStore'
import { CATALOG_URL, catalogConfigured } from '@/games/catalogUrl'

/* ============================================================
   「从服务器下载」这一块在**目录没配时不渲染**
   ------------------------------------------------------------
   这是本项目最忌讳的一条：**界面不许承诺它做不到的事**。
   配错 / 忘配目录地址时，如果摆一个点了必然失败的按钮，家长看到的是
   「服务器上没有游戏」，而真相是「这个包根本没配地址」。

   判据是 fail closed：`CATALOG_URL` 为空 ⇒ 整块 `null`，连标题都不出现。

   ⚠️ 这条测试依赖一个前提：**测试环境的 `CATALOG_URL` 必须是空的**
   （`vitest` 不注入 `VITE_GAME_CATALOG_URL`）。所以先断言这个前提 ——
   哪天有人在 `.env.test` 里配了它，这条测试会自己说出来，
   而不是变成「永远绿的空测试」。
   ============================================================ */

describe('设置 → 游戏：从服务器下载（目录未配置）', () => {
  it('前提：测试环境没有注入目录地址', () => {
    expect(CATALOG_URL).toBe('')
    expect(catalogConfigured()).toBe(false)
  })

  it('★ 目录没配 ⇒ 整块不渲染（不是「渲染了但点了失败」）', () => {
    render(<GameMarket gateOpen />)
    expect(document.querySelector('[data-remote-section]')).toBeNull()
    expect(document.body.textContent ?? '').not.toContain('从服务器下载')
  })
})
