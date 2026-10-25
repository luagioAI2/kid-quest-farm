import { useState } from 'react'
import { useApp } from '../../store/useApp'
import { Card } from './ui'
import { CATALOG_URL, catalogConfigured } from '../../games/catalogUrl'
import { catalogPublicKeyRaw } from '../../games/catalogKey'
import { fetchVerifiedCatalog } from '../../games/install'
import type { CatalogGame } from '../../games/verify'
import { gameById } from '../../games/registry'
import { formatSize } from '../../games/size'
import { vouchersPerPlay } from '../../domain/pluginEconomy'

/**
 * 家长栏 → 「游戏商店」：把游戏装进来（spec §12.4）。
 *
 * ## 这张卡现在只管**远程**
 *
 * 2026-10-24 起，「随 App 附带」那三款搬到了**游戏市场**（`GameStore.tsx`，
 * 应用市场形态：列表 / 详情 / 截图）。所以这里只剩远程目录一件事，
 * 标题也从「游戏商店」改成「在线商店」—— 继续叫「游戏商店」会让人
 * 以为本地那三款也在这儿。
 *
 * | 来源 | 从哪来 | 凭什么信 | 在哪 |
 * | --- | --- | --- | --- |
 * | **本地** | `public/games/`，随 App 发布 | SHA-256 烧在 `localGames.ts` 里 | `GameStore.tsx`（不需要联网） |
 * | **远程**（本卡片） | 已签名 `catalog.json` + 包 | Ed25519 目录签名 → 目录里的 SHA-256 | 配了托管地址才显示按钮 |
 *
 * 两条路最后都走 `commitPluginBundle`（拦内置 id / 校验经济 / 写 `__bundle`+`__assets`）。
 *
 * ## ⚠️ 搬走的时候别把那条规矩一起丢了
 *
 * 本地包**不能**跟着 `catalogConfigured()` 一起藏起来：它根本不需要商店地址。
 * 跟着藏的话，「没配托管地址的版本」就等于「一个游戏都装不了」—— 而它明明
 * 带着三个包。这是本项目反复写的「界面承诺了它做不到的事」的**反面**：
 * 明明做得到，界面却说做不到。所以 `GameStore.tsx` 里的入口**永远渲染**，
 * 只有按钮受家长闸门（`gateOpen`）控制。
 *
 * ## 远程那一栏的三种状态（不是同一种界面的三种文案）
 *
 * | 情况 | 界面 |
 * | --- | --- |
 * | 这个版本没配托管地址 | 一句说明，**没有按钮** |
 * | 配了，还没检查 | 一个「检查有没有新游戏」按钮 |
 * | 检查中 / 出错 / 拿到列表 | 加载态 / 原文错误 + 重试 / 列表 |
 *
 * ★ 「没配就摆一个按钮」是**故意不做**的：按下去必然失败。
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

  const toast = (ok: boolean, message: string) =>
    pushToast({
      kind: ok ? 'success' : 'warn',
      title: ok ? '装好了' : '没装成',
      detail: message,
      emoji: ok ? '✅' : '⚠️',
    })

  const installRemote = async (id: string) => {
    if (installingId) return
    setInstallingId(id)
    try {
      const res = await installFromCatalog(CATALOG_URL, id)
      toast(res.ok, res.message)
    } finally {
      setInstallingId(null)
    }
  }

  return (
    <Card title="在线商店" emoji="📥">
      {/* ---------------- 远程商店 ----------------
          ⚠️ 这里原来还有一行小标题「在线商店」，和卡片标题重复了。
          那张小标题是「游戏商店」当标题时留下的分区标签；标题改名之后
          就变成同一句话印两遍（走查图 11c 里一眼能看到）。 */}
      {!catalogConfigured() ? (
        <p data-plugin-store="off" className="mt-2 text-sm leading-relaxed text-ink-500">
          这个版本没有配置游戏商店，装不了新的在线游戏。
        </p>
      ) : (
        <>
          <button
            disabled={!gateOpen || checking}
            data-plugin-check
            onClick={() => void check()}
            className="mt-2 btn h-11 rounded-full bg-white px-4 text-sm font-extrabold text-ink-700 shadow-flat active:btn-press disabled:opacity-50"
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
                        onClick={() => void installRemote(g.id)}
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
        </>
      )}

      {/* ---------------- ③ 已安装游戏的家长可见参数 ---------------- */}
      {Object.values(installedGames).length > 0 && (
        <div data-plugin-economy className="mt-4 rounded-2xl bg-paper-2 px-3 py-2.5">
          <p className="text-xs font-extrabold text-ink-500">这些游戏的经济参数</p>
          <ul className="mt-1.5 space-y-1">
            {Object.values(installedGames).map((m) => {
              const v = vouchersPerPlay(m.economy)
              return (
                <li key={m.id} className="text-xs leading-snug text-ink-700">
                  {m.emoji} {m.name}：一局 {m.economy.playCost} 积分，
                  期望产出 {m.economy.expectedPayout} {m.coin.name}
                  {v > 0
                    ? `（1 ${m.coin.name} = ${m.economy.voucherPerCoin} 兑换券，一局期望 ${+v.toFixed(2)} 兑换券）`
                    : '（不开放兑换券）'}
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs leading-snug text-ink-500">
        装之前会核对包的内容（对发布方签名）。核对不过的一律不装。
      </p>
    </Card>
  )
}

/** `size` 是目录里给的可选提示（不是校验依据），没有就不显示。
 *  实现搬去了 `games/size.ts` —— 游戏市场那边也要显示同一个数字，
 *  两处各写一份必然走散（同一个包显示两个大小）。 */
