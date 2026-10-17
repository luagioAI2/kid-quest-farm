import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { db } from '@/db/db'
import { useApp } from '@/store/useApp'
import { PluginStoreCard } from './PluginStoreCard'

/* ============================================================
   游戏商店 —— **配好了托管地址** 的那一半（发布方填了 `CATALOG_URL` 之后）。

   ⚠️ 「没配」那一半在 `PluginStoreCard.off.test.tsx`，那边**不 mock**，
      读的是仓库里真实的空常量。两个文件分开是因为这里必须 mock 常量，
      而「线上状态」恰恰是**不许 mock** 的那个 —— 混在一个文件里，
      迟早有人顺手 mock 掉，于是「没配就不摆按钮」那条就永远绿着说谎。
   ============================================================ */

const STORE_URL = 'https://cdn.example.com/games/catalog.json'

/**
 * `vi.mock` 的工厂会被**提升到 import 之上**，所以不能直接引用下面声明的
 * `vi.fn()`（会 `Cannot access before initialization`）。`vi.hoisted` 就是
 * 干这个的：把可变状态一起提到前面去。
 */
const h = vi.hoisted(() => ({ fetchCatalog: vi.fn(), install: vi.fn() }))

vi.mock('../../games/catalogUrl', () => ({
  CATALOG_URL: 'https://cdn.example.com/games/catalog.json',
  catalogConfigured: () => true,
}))

vi.mock('../../games/catalogKey', () => ({
  CATALOG_PUBLIC_KEY_B64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  ED25519_PUBLIC_KEY_BYTES: 32,
  parseCatalogPublicKey: () => new Uint8Array(32),
  catalogPublicKeyRaw: () => new Uint8Array(32),
}))

vi.mock('../../games/install', () => ({ fetchVerifiedCatalog: h.fetchCatalog }))

async function bootStore() {
  await db.delete()
  await db.open()
  await useApp.getState().boot()
  // 安装动作换成假的：这里测的是「界面有没有把对的参数传下去」，
  // 真正的安装链在 `src/games/install.test.ts` / `installStore.test.ts` 里钉着。
  useApp.setState({ installFromCatalog: h.install })
}

const oneGame = {
  id: 'demo',
  name: '许愿池',
  version: '1.0.0',
  url: 'https://cdn.example.com/games/demo.js',
  sha256: 'a'.repeat(64),
  size: 130 * 1024,
}

describe('游戏商店：配好地址之后', () => {
  beforeEach(async () => {
    h.fetchCatalog.mockReset()
    h.install.mockReset()
    await bootStore()
  })
  afterEach(cleanup)

  it('点「检查」→ 列出目录里的游戏（名字 / 版本 / 体积）', async () => {
    h.fetchCatalog.mockResolvedValue({ version: 1, games: [oneGame] })
    const user = userEvent.setup()
    render(<PluginStoreCard gateOpen />)

    await user.click(document.querySelector('[data-plugin-check]') as HTMLElement)

    await waitFor(() => {
      expect(document.querySelector('[data-plugin-row="demo"]'), '列表没渲染出来').toBeTruthy()
    })
    const row = document.querySelector('[data-plugin-row="demo"]') as HTMLElement
    expect(row.textContent).toContain('许愿池')
    expect(row.textContent).toContain('v1.0.0')
    expect(row.textContent).toContain('130 KB')
    // 正向对照：真的去取目录了，而且用的是烧进包里的那个地址
    expect(h.fetchCatalog).toHaveBeenCalledTimes(1)
    expect(h.fetchCatalog.mock.calls[0][0].catalogUrl).toBe(STORE_URL)
  })

  it('点「安装」→ 把（商店地址, 那一款的 id）交给安装链', async () => {
    h.fetchCatalog.mockResolvedValue({ version: 1, games: [oneGame] })
    h.install.mockResolvedValue({ ok: true, message: '已安装「许愿池」v1.0.0' })
    const user = userEvent.setup()
    render(<PluginStoreCard gateOpen />)

    await user.click(document.querySelector('[data-plugin-check]') as HTMLElement)
    await waitFor(() => expect(document.querySelector('[data-plugin-install="demo"]')).toBeTruthy())

    await user.click(document.querySelector('[data-plugin-install="demo"]') as HTMLElement)

    await waitFor(() => expect(h.install).toHaveBeenCalledTimes(1))
    expect(h.install.mock.calls[0]).toEqual([STORE_URL, 'demo'])
  })

  it('★ 检查失败 → 把**原文**显示出来，不糊成「失败了，请重试」', async () => {
    // `install.ts` 已经区分了「签名不对」「公钥没配」「跨域」——
    // 再包一层笼统文案，等于把三种处置方式糊成一句，排查方向直接跑偏。
    const detail = '拉取目录签名失败：TypeError: Failed to fetch。最可能是**跨域**'
    h.fetchCatalog.mockRejectedValue(new Error(detail))
    const user = userEvent.setup()
    render(<PluginStoreCard gateOpen />)

    await user.click(document.querySelector('[data-plugin-check]') as HTMLElement)

    await waitFor(() => expect(document.querySelector('[data-plugin-error]')).toBeTruthy())
    const box = document.querySelector('[data-plugin-error]') as HTMLElement
    expect(box.textContent).toContain(detail)
    // 出错时不该留下一个「看起来装好了」的列表
    expect(document.querySelector('[data-plugin-row="demo"]')).toBeNull()
  })

  it('家长闸门关着 → 检查按钮在，但点不动（不是消失）', () => {
    // 「没配地址」是「没得操作」（按钮不该存在）；
    // 「闸门没开」是「现在不能操作」（按钮在、disabled）。两者别混。
    render(<PluginStoreCard gateOpen={false} />)
    const btn = document.querySelector('[data-plugin-check]') as HTMLButtonElement
    expect(btn).toBeTruthy()
    expect(btn.disabled).toBe(true)
    expect(screen.getByRole('heading', { name: /游戏商店/ })).toBeTruthy()
  })
})
