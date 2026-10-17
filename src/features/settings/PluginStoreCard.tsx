import { useState } from 'react'
import { useApp } from '../../store/useApp'
import { Card } from './ui'
import { CATALOG_URL, catalogConfigured } from '../../games/catalogUrl'
import { catalogPublicKeyRaw } from '../../games/catalogKey'
import { fetchVerifiedCatalog } from '../../games/install'
import type { CatalogGame } from '../../games/verify'
import { gameById } from '../../games/registry'

/**
 * 家长栏 → 「游戏商店」：把**已签名目录**里的游戏列出来、装进来（spec §12.4）。
 *
 * ## 三种状态，三种界面（不是同一种界面的三种文案）
 *
 * | 情况 | 界面 |
 * | --- | --- |
 * | 这个版本没配托管地址（`CATALOG_URL` 空） | 一句说明，**没有按钮** |
 * | 配了，还没检查 | 一个「检查有没有新游戏」按钮 |
 * | 检查中 / 出错 / 拿到列表 | 加载态 / 原文错误 + 重试 / 列表 |
 *
 * ★ 「没配就摆一个按钮」是**故意不做**的：按下去必然失败，等于界面承诺了它
 *   做不到的事（这个项目的老毛病，`GamesSection` 的注释里也写着同一条）。
 *   现在的线上版本就是「没配」——`CATALOG_PUBLIC_KEY_B64` 和 `CATALOG_URL`
 *   都故意留空，下载功能 fail closed。
 *
 * ## 为什么列表和安装是两条路
 *
 * 列表走 `fetchVerifiedCatalog`（**一个包都不取**），点安装才走
 * `installFromCatalog`（取包 + 验 SHA-256 + 跑代码 + 落库）。
 * 家长只是「看一眼有什么」的时候，不该让任何代码下到手机里。
 *
 * ## 错误文案直接原文显示
 *
 * `verify.ts` / `install.ts` 抛的错已经分得很细（「签名对不上」vs「公钥没配」
 * vs「跨域」），这里**不要**再包一层「安装失败，请重试」——
 * 那句会把三种完全不同的处置方式糊成一句。
 */
export function PluginStoreCard({ gateOpen }: { gateOpen: boolean }) {
  const installedGames = useApp((s) => s.installedGames)
  const installFromCatalog = useApp((s) => s.installFromCatalog)
  const pushToast = useApp((s) => s.pushToast)

  const [checking, setChecking] = useState(false)
  /** 正在装的那一款（防止连点两次装两遍） */
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [games, setGames] = useState<CatalogGame[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  /* ---------------- 没配托管地址：只有一句说明 ---------------- */
  if (!catalogConfigured()) {
    return (
      <Card title="游戏商店" emoji="📥">
        <p data-plugin-store="off" className="text-sm leading-relaxed text-ink-500">
          这个版本没有配置游戏商店，所以只能玩 App 里自带的游戏。
        </p>
        <p className="mt-2 text-xs leading-snug text-ink-500">
          商店要由发布方定好托管地址，并且把签名公钥一起打进安装包才能用。
        </p>
      </Card>
    )
  }

  const check = async () => {
    if (checking) return
    setChecking(true)
    setError(null)
    try {
      // 公钥没配 / 配错会在这一步**抛**（不是返回空列表）——
      // 那是「我们没配好」，和「签名不对」必须分开报。
      const catalog = await fetchVerifiedCatalog({
        catalogUrl: CATALOG_URL,
        publicKeyRaw: catalogPublicKeyRaw(),
      })
      setGames(catalog.games)
    } catch (e) {
      setGames(null)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setChecking(false)
    }
  }

  const install = async (id: string) => {
    if (installingId) return
    setInstallingId(id)
    try {
      const res = await installFromCatalog(CATALOG_URL, id)
      pushToast({
        kind: res.ok ? 'success' : 'warn',
        title: res.ok ? '装好了' : '没装成',
        detail: res.message,
        emoji: res.ok ? '✅' : '⚠️',
      })
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <Card title="游戏商店" emoji="📥">
      <button
        disabled={!gateOpen || checking}
        data-plugin-check
        onClick={() => void check()}
        className="btn h-11 rounded-full bg-white px-4 text-sm font-extrabold text-ink-700 shadow-flat active:btn-press disabled:opacity-50"
      >
        {checking ? '正在检查…' : games ? '再检查一次' : '检查有没有新游戏'}
      </button>

      {/* 出错：原文显示 + 重试。别糊成「失败了，请重试」 */}
      {error && (
        <div data-plugin-error className="mt-3 rounded-2xl border-3 border-berry-500/30 bg-white px-3 py-2.5">
          <p className="text-sm font-extrabold text-berry-500">检查失败</p>
          <p className="mt-1 break-words text-xs leading-snug text-ink-700">{error}</p>
        </div>
      )}

      {/* 列表 */}
      {games && games.length === 0 && (
        <p data-plugin-empty className="mt-3 text-sm text-ink-500">
          目录是空的，暂时没有可装的游戏。
        </p>
      )}
      {games && games.length > 0 && (
        <ul className="mt-3 space-y-2">
          {games.map((g) => {
            const installed = installedGames[g.id]
            /*
              ★ 下载来的包**不许**占用内置游戏的 id（spec §12.2）。
                `installFromCatalog` 会拒绝，但这里就先把按钮拿掉 ——
                摆一个按下去必然被拒的按钮，家长会以为是网络问题。
            */
            const clashes = !!gameById(g.id)
            const upToDate = installed && installed.version === g.version
            return (
              <li
                key={g.id}
                data-plugin-row={g.id}
                className="flex items-center gap-3 rounded-2xl border-3 border-ink-900/10 bg-paper-2 px-3 py-2.5"
              >
                <span className="text-2xl">{installed?.emoji ?? '🎮'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-base font-extrabold text-ink-900">
                    {g.name}
                    <span className="ml-1.5 text-xs font-bold text-ink-500">v{g.version}</span>
                  </span>
                  <span className="block text-xs leading-snug text-ink-500">
                    {clashes ? '和自带游戏重名，不能装' : `${formatSize(g.size)} · 由发布方签名`}
                  </span>
                </span>
                {clashes ? (
                  <span className="shrink-0 rounded-full bg-ink-900/5 px-3 py-1 text-xs font-extrabold text-ink-500">
                    跳过
                  </span>
                ) : upToDate ? (
                  <span className="shrink-0 rounded-full bg-grass-300 px-3 py-1 text-xs font-extrabold text-ink-900">
                    已安装
                  </span>
                ) : (
                  <button
                    disabled={!gateOpen || installingId !== null}
                    data-plugin-install={g.id}
                    onClick={() => void install(g.id)}
                    className="btn shrink-0 rounded-full bg-sun-300 px-3 py-1.5 text-xs font-extrabold text-ink-900 shadow-flat active:btn-press disabled:opacity-50"
                  >
                    {installingId === g.id ? '正在装…' : installed ? '更新' : '安装'}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-3 text-xs leading-snug text-ink-500">
        装之前会先核对发布方的签名和每个包的 SHA-256。核对不过的一律不装。
      </p>
    </Card>
  )
}

/** `size` 是目录里给的可选提示（不是校验依据），没有就不显示。 */
function formatSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '大小未知'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
