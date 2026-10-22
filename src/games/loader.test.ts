import { describe, expect, it, vi } from 'vitest'
import { BundleLoadError, mountBundle, validateBundle } from './loader'
import { HOST_API, type GameBundle, type GameManifestV2, type HostApi, type MountContext } from './plugin'

/* ============================================================
   游戏包的准入校验 —— **三道门**（spec §12.5）

   这里测的是 `validateBundle`（纯函数），不是 `importBundle` ——
   后者的 `Blob → createObjectURL → import()` 在 node/jsdom 里根本跑不起来
   （没有 `URL.createObjectURL`，也没有 blob 模块解析）。把校验拆出来
   就是为了让「坏包会被拒」这件事**能被断言**，而不是只能靠嘴说。
   真实那条链路由 `scripts/capture-game-bundle.mjs` 在浏览器里证明。
   ============================================================ */

function goodManifest(over: Partial<GameManifestV2> = {}): GameManifestV2 {
  return {
    id: 'demo',
    name: '许愿池',
    emoji: '🌟',
    tabLabel: '许愿池',
    version: '1.0.0',
    minHostApi: HOST_API,
    coin: { id: 'star', name: '星币', emoji: '⭐' },
    economy: { playCost: 5, expectedPayout: 3, capPerPrize: 9 },
    ...over,
  }
}

/** 一个形状正确的包（`mount` 是空实现，这里不真的挂） */
function goodBundle(over: Partial<GameManifestV2> = {}) {
  return { manifest: goodManifest(over), mount: () => () => {} }
}

describe('validateBundle —— 认得出的包', () => {
  it('形状正确就放行', () => {
    const b = validateBundle({ default: goodBundle() })
    expect(b.manifest.id).toBe('demo')
    expect(typeof b.mount).toBe('function')
  })

  it('打包器把 default 拍平时也认（整个模块就是包）', () => {
    // 有些产物是 `export const manifest = ...; export function mount(){}`
    // 而不是 `export default {...}`。两种都要能装，否则「换了个打包器就装不上」。
    const b = validateBundle(goodBundle())
    expect(b.manifest.id).toBe('demo')
  })
})

describe('validateBundle —— 第一道门：形状', () => {
  it('导出不是对象 → shape', () => {
    const err = (() => {
      try {
        validateBundle('我不是包')
        return null
      } catch (e) {
        return e as BundleLoadError
      }
    })()
    expect(err?.kind).toBe('shape')
  })

  it('没有 mount → shape，而且错误信息里带上实际类型', () => {
    let err: BundleLoadError | null = null
    try {
      validateBundle({ default: { manifest: goodManifest(), mount: '不是函数' } })
    } catch (e) {
      err = e as BundleLoadError
    }
    expect(err?.kind).toBe('shape')
    // 「加载失败」对排查毫无帮助 —— 必须说清是哪个字段、拿到了什么
    expect(err?.message).toContain('mount')
    expect(err?.message).toContain('string')
  })

  it('`null` 导出 → shape（不是崩，是「包不对」）', () => {
    let err: BundleLoadError | null = null
    try {
      validateBundle(null)
    } catch (e) {
      err = e as BundleLoadError
    }
    expect(err?.kind).toBe('shape')
  })
})

describe('validateBundle —— 第二道门：manifest 字段', () => {
  it('缺 id → manifest，且报出是哪个字段', () => {
    let err: BundleLoadError | null = null
    try {
      validateBundle({ default: goodBundle({ id: '' }) })
    } catch (e) {
      err = e as BundleLoadError
    }
    expect(err?.kind).toBe('manifest')
    expect(err?.message).toContain('id')
  })

  it('minHostApi 不是数字 → manifest，且报出实际值', () => {
    let err: BundleLoadError | null = null
    try {
      validateBundle({ default: goodBundle({ minHostApi: '1' as unknown as number }) })
    } catch (e) {
      err = e as BundleLoadError
    }
    expect(err?.kind).toBe('manifest')
    expect(err?.message).toContain('minHostApi')
  })

  it('coin 缺失 → manifest', () => {
    let err: BundleLoadError | null = null
    try {
      const bad = { manifest: { ...goodManifest(), coin: undefined }, mount: () => () => {} }
      validateBundle({ default: bad })
    } catch (e) {
      err = e as BundleLoadError
    }
    expect(err?.kind).toBe('manifest')
    expect(err?.message).toContain('coin')
  })
})

describe('validateBundle —— 第三道门：宿主 API 版本', () => {
  it('包要求更高的宿主 → hostApi，并且**提示先更新 App**', () => {
    let err: BundleLoadError | null = null
    try {
      validateBundle({ default: goodBundle({ minHostApi: HOST_API + 1 }) })
    } catch (e) {
      err = e as BundleLoadError
    }
    expect(err?.kind).toBe('hostApi')
    // 这道门的价值在于**报错方向是对的** —— 没有它，崩的是宿主的调用点，
    // 排查的人会去查宿主自己的代码。
    expect(err?.message).toContain('更新 App')
  })

  it('包要求**更低或相等**的宿主 → 放行（老包在新宿主上照常跑）', () => {
    expect(() => validateBundle({ default: goodBundle({ minHostApi: 1 }) })).not.toThrow()
  })
})

/* ============================================================
   mountBundle —— 同步 / 异步 mount **都收**（HOST_API 3 起）

   这一组是为了钉住一个真实事故：契约原来只允许同步返回卸载函数，
   而第一个真插件（3D 娃娃机）是 `async mount`。宿主拿到 Promise 就
   判「没有卸载函数」→ 只 warn → 返回空函数 ⇒ **destroy() 永远不跑**
   （WebGL context / Rapier world / 4 个 setInterval 全留着）。
   而当时的测试脚本自己 `await mount()`，所以四层验收全绿也照不出来。
   ============================================================ */

const CTX: MountContext = {
  assetBase: '/games/demo/',
  assetUrl: (rel) => '/games/demo/' + rel,
  locale: 'zh',
}

function bundleWith(mount: GameBundle['mount']): GameBundle {
  return { manifest: goodManifest(), mount }
}

describe('mountBundle：卸载函数怎么拿', () => {
  it('同步返回：原样透传，并把 ctx 交给插件', async () => {
    let got: MountContext | undefined
    const inner = (): void => {}
    const unmount = await mountBundle(
      document.createElement('div'),
      bundleWith((_c, _h, ctx) => {
        got = ctx
        return inner
      }),
      {} as HostApi,
      CTX,
    )
    expect(unmount).toBe(inner)
    expect(got).toBe(CTX)
  })

  it('★ 返回 Promise：await 之后拿到**真的**卸载函数（不是兜底空函数）', async () => {
    let destroyed = 0
    const unmount = await mountBundle(
      document.createElement('div'),
      bundleWith(async () => () => {
        destroyed++
      }),
      {} as HostApi,
      CTX,
    )
    expect(typeof unmount).toBe('function')
    await unmount()
    expect(destroyed).toBe(1)
  })

  it('异步 mount 抛错：错误要冒出来（调用方才能显示「打不开」）', async () => {
    await expect(
      mountBundle(
        document.createElement('div'),
        bundleWith(async () => {
          throw new Error('纹理加载失败')
        }),
        {} as HostApi,
        CTX,
      ),
    ).rejects.toThrow('纹理加载失败')
  })

  it('没返回卸载函数：只 warn，不抛（游戏还能玩，走查脚本数这个）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const unmount = await mountBundle(
      document.createElement('div'),
      bundleWith((() => undefined) as unknown as GameBundle['mount']),
      {} as HostApi,
      CTX,
    )
    expect(typeof unmount).toBe('function')
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
