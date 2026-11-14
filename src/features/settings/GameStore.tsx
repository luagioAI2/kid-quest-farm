import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../../store/useApp'
import { Card } from './ui'
import { Portal } from '../../components/Portal'
import { LOCAL_GAMES, type LocalGameEntry } from '../../games/localGames'
import { GAME_KINDS, GAME_KIND_ORDER, type GameKind } from '../../games/kind'
import {
  STOREFRONT,
  storefrontOf,
  type StorefrontEntry,
  type StoreShot,
  type StoreTint,
} from '../../games/storefront'
import { GAMES, gameById, type GameDef } from '../../games/registry'
import { formatSize } from '../../games/size'
import { checkPluginEconomy, vouchersPerPlay } from '../../domain/pluginEconomy'
import { ownedSetFor } from '../../domain/ownership'
import { hasUpdate } from '../../games/version'
import { isOnlineMode } from '../../sync/pull'
import { GameIconArt } from './GameIcon'
import { SnapshotSection } from './SnapshotSection'
import { fetchVerifiedCatalog } from '../../games/install'
import { catalogPublicKeyRaw } from '../../games/catalogKey'
import { CATALOG_URL, catalogConfigured } from '../../games/catalogUrl'
import {
  barRatio,
  installButtonText,
  installProgressText,
} from '../../domain/installProgress'

/**
 * 我的游戏 —— 手机应用市场那种形态（2026-10-24 用户要求）。
 *
 * ```
 *   设置页 → 游戏   「我的游戏」卡片：所有游戏一张表，状态写在行上
 *     └─ 详情       大图 + 练什么 + 截图（可点开放大）+ 关于 + 安装 / 卸载
 * ```
 *
 * ## ⚠️ 2026-10-28：从「游戏市场」改成「我的游戏」
 *
 * 家长：「游戏市场换个名字，这些都是已经购买的游戏。在这里只是控制，
 * 下载，安装，卸载，选择当前。」
 *
 * ⇒ 这张表**不是商店**了：没有价格、没有「敬请期待」、没有购买按钮。
 *   它是一份「我有哪些游戏、现在装没装、当前是哪一款」的清单。
 *   （这也顺带解决了一件旧事：内置游戏早就一款标价的都没有了，
 *     那个购买分支一直是死代码 —— 死代码比错误的代码更难发现。）
 *
 * ## ⚠️ 这张卡 2026-10-25 被家长改了三次，三次都是「少一层、少一处」：
 *   ① 去掉「进入游戏市场」按钮 + 全屏列表（列表本来就是这张卡的内容）
 *   ② 「已购买 / 已下载 / 敬请期待」三张卡并进来（一款游戏一行，状态在行上）
 *   ③ 「练什么」从每一行挪进详情（一行四条子弹会把列表撑过一整屏）
 *   来龙去脉写在下面 ① 的注释里 —— 改结构时先读那一段，别只改代码。
 *
 * ## ⚠️ 全屏层必须走 `Portal`
 *
 * 外壳那层 `anim-fade-in` 是隐式层叠上下文（`getComputedStyle` 查不出来），
 * 里面的弹层永远压不过底部导航 —— z-index 抬到 9999 也没用。见 `Portal.tsx`。
 *
 * ## ⚠️ 平板上改成居中对话框
 *
 * 底部抽屉是手机范式。平板上一路铺到 1366px 会很难看，所以
 * `md:items-center md:p-6` + `md:max-w-2xl`；遮罩必须是 `fixed inset-0`
 * （父级一加 padding，`absolute` 就会缩进，四周露出一圈没盖住的地方）。
 *
 * ## 安装：一颗按钮，两条路（2026-11-08）
 *
 * 行上那颗按钮先走生产路径 `installFromCatalog`（验签目录 + 验 SHA-256），
 * 拿不到再退回 `installLocalGame`（随包发、哈希烧在 `localGames.ts` 里）。
 * 校验和落库都在 store 里，这一层只负责挑路。
 * `data-local-*` 这几个锚点是 e2e 在用的，**不能改名字**。
 */

/** 一次「装」的状态，列表和详情共用，避免两处各写一套（连点会装两遍） */
function useInstall() {
  const installLocalGame = useApp((s) => s.installLocalGame)
  const installFromCatalog = useApp((s) => s.installFromCatalog)
  /* 进度只走 store：按钮和行内细进度条各读一次，显示同一个数字。
     写在组件 state 里会变成「按钮 40%、进度条 0%」。 */
  const reportProgress = useApp((s) => s.reportInstallProgress)
  const pushToast = useApp((s) => s.pushToast)
  const [installingId, setInstallingId] = useState<string | null>(null)

  /*
    ★ 2026-11-08 家长：「上面不是已经有游戏列表吗，没下载就是没下载的状态呀。」

    ⇒ 「从服务器下载」那一块并进这张表，行上那颗按钮就是**下载**：
      先走生产路径 `installFromCatalog`（验签目录 → 验 SHA-256 → 才执行），
      拿不到再用随包发的本地包（`localGames.ts` 里烧着的 SHA-256）。

    为什么还留着本地包这条路：这 App 是离线优先的（APK / 没网都是常态），
    两条路**门槛同一份**（拥有判定都在 store 里），谁也不会绕过校验。
    只有「目录没配 / 没网 / 验签失败」才落到本地包，toast 里会写明走了备用路。
  */
  const install = async (id: string) => {
    if (installingId) return
    setInstallingId(id)
    reportProgress({ gameId: id, phase: 'catalog', percent: -1, received: 0, total: 0 })
    try {
      let res: { ok: boolean; message: string } | null = null
      /* 先记下「这个包知不知道去哪下载」。
         ★ 这一条单独判，是因为它的表现和网络故障一模一样（都落到本地包 404），
           但修法完全不同：一个是重装新版 App，一个是查网络/证书。
           2026-11-12 用户就被那句 HTTP 404 带偏过一次。 */
      const canRemote = catalogConfigured()
      if (canRemote) {
        res = await installFromCatalog(CATALOG_URL, id, reportProgress)
      }
      if (!res?.ok) {
        const remoteMsg = res?.message ?? ''
        const local = await installLocalGame(id, reportProgress)
        /* ★ 两条都失败时必须**两条都写**。
           原来这里只留本地那条 ⇒ 不管真因是「没网 / 目录里没这款 / 验签失败 /
           这个地址不是 https」，界面上永远是同一句「读取本地包失败：HTTP 404」，
           而 404 恰恰是最不可能的那个原因（在线版 APK 本来就不随包发游戏）。
           2026-11-12 用户就是被这句话带去了错误方向。 */
        res = {
          ok: local.ok,
          message: local.ok
            ? `${local.message}（用 App 自带的包）`
            : !canRemote
              ? `这个安装包没配下载服务器（只能用自带的包），而自带的包里也没有这款：${local.message} —— 装个新版 App 再试`
              : remoteMsg
                ? `服务器下载没成功（${remoteMsg}）；App 自带的包也没有（${local.message}）`
                : local.message,
        }
      }
      pushToast({
        kind: res.ok ? 'success' : 'warn',
        title: res.ok ? '装好了' : '没装成',
        detail: res.message,
        emoji: res.ok ? '✅' : '⚠️',
      })
    } finally {
      setInstallingId(null)
      /* ★ 一定要清。留着的话那一行会长期显示「下载中 87%」——
         而装包早就结束了，看起来像卡住。 */
      reportProgress(null)
    }
  }
  return { install, installingId }
}

/** 安装按钮 / 已安装标记 —— 列表和详情页都要用同一套判断 */
function InstallAction({
  id,
  gateOpen,
  installingId,
  onInstall,
  target,
  size = 'sm',
}: {
  id: string
  gateOpen: boolean
  installingId: string | null
  onInstall: (id: string) => void
  /** 该装哪一版：目录里有就用目录的（可能有新包），否则用随包发的 */
  target?: string
  size?: 'xs' | 'sm' | 'lg'
}) {
  const installedGames = useApp((s) => s.installedGames)
  /* 只认"正在装的那一款"的进度 —— store 里只放一条，这里再按 id 对一次，
     避免上一款收尾时的最后一帧画到这一行上。 */
  const progress = useApp((s) => (s.installProgress?.gameId === id ? s.installProgress : null))
  const local = LOCAL_GAMES.find((g) => g.id === id)
  const installed = installedGames[id]
  const want = target ?? local?.version
  /* 判据用 `hasUpdate` 而不是 `!==`：目录回滚时（目录 1.0.0、机器 1.0.2）
     不能劝人「更新」，那会把人降级还显示成功。 */
  const upToDate = !!installed && !!want && !hasUpdate(want, installed.version)
  // 下载来的包不许占用内置 id（`installFromCatalog` 也会拒），这里直接把按钮拿掉
  const clashes = !!gameById(id)

  const pad =
    size === 'lg'
      ? 'h-12 px-6 text-base'
      : size === 'xs'
        ? 'h-8 px-3.5 text-[12.5px]' // 列表行里的药丸
        : 'h-10 px-3.5 text-xs'

  if (clashes) {
    return (
      <span className="rounded-full bg-ink-900/5 px-3 py-1.5 text-xs font-extrabold text-ink-500">
        和自带游戏重名
      </span>
    )
  }
  if (upToDate) {
    return (
      <span
        data-local-installed={id}
        className={
          'grid place-items-center rounded-full bg-grass-300 font-extrabold text-ink-900 ' + pad
        }
      >
        已安装
      </span>
    )
  }
  return (
    <button
      disabled={!gateOpen || installingId !== null}
      data-local-install={id}
      onClick={() => onInstall(id)}
      className={
        'btn shrink-0 rounded-full bg-sun-300 font-extrabold text-ink-900 shadow-flat active:btn-press disabled:opacity-50 ' +
        pad
      }
    >
      {/* 有进度就报进度（「下载 42%」/「安装中…」），没有才退回笼统的一句。
          ⚠️ 不能只写「正在下载…」—— 用户明确要的是**看得见进度**。 */}
      {installingId === id && progress
        ? installButtonText(progress)
        : installingId === id
          ? '正在下载…'
          : installed
            ? '更新'
            : '下载'}
    </button>
  )
}

/* ============================================================
   ① 游戏市场 —— **所有游戏一张表，状态写在行上**（2026-10-25）
   ============================================================ */
/**
 * 这张卡两天里被家长改了两次，两次都是同一件事：**少一层、少一处**。
 *
 * ### 第一次：不要「进入游戏市场」按钮 + 弹层列表
 *
 * 原来这里是一张「三张封面 + 进入游戏市场」的卡，列表 / 详情 / 截图全在
 * `Portal` 全屏层里。家长原话：
 *
 *   「为啥还要点进入游戏市场，直接在游戏页展示不行吗。装上就能在底部那个
 *     游戏按钮里玩。每一款都写了它是让孩子练什么的。在这展示列表就行了吧。」
 *
 * 说得对：**列表本来就是这张卡的内容**，中间那一次点击什么也没换来。
 * 所以列表摊平到页面上；弹层只留「详情（截图 + 关于）」—— 那是真的
 * 需要更多地方才放得下的东西。（`data-open-store` 随那个按钮一起没了，
 * 脚本那边同步改成「确认列表在页面上」。）
 *
 * ### 第二次：不要「已购买 / 已下载 / 敬请期待」三张卡
 *
 * 原来同一款游戏会在两三处出现：买了在「已购买」、装好了在「已下载」、
 * 没做的在「敬请期待」，而且**每处都能改它的状态**（买 / 装 / 设为当前 / 卸载）。
 * 家长原话：
 *
 *   「感觉没必要 单独 已购买，已下载，敬请期待，直接 在 游戏市场。
 *     每个游戏 不同状态呗。」
 *
 * ⇒ 一款游戏一行。状态是**这一行上的一个事实**（当前 / 已装 / 可装 / 要买 /
 *   敬请期待），改状态的按钮也只在这一行上 —— 两处能改，就一定会走散。
 *
 * ### 第三次：「练什么」挪进详情
 *
 * 一行四条子弹（`learn`）把每行撑到 ~200px，三款游戏就超过一屏 —— 列表是
 * 用来挑的，不是用来读的。家长原话：「练什么也放详情吧。」
 * ⇒ 行上只留 `pitch` 一句话 + 状态；`learn` 全文在详情里，标题就叫「练什么」。
 *
 * ## 两种来源，一张表
 *
 * | 来源 | 从哪来 | 谁决定它的状态 |
 * | --- | --- | --- |
 * | 内置 | `registry.ts`，编译进 App | `activeGameId`（是不是当前那款） |
 * | 插件 | `public/games/`，随包发 | `installedGames`（装没装）+ `activeGameId` |
 *
 * ⚠️ 锚点：`data-local-row` / `data-local-install` / `data-local-installed` /
 *   `data-store-detail` 是 e2e 与截图脚本在用的，**不能改名**；
 *   `data-plugin-installed-row` / `data-plugin-set-current` / `data-plugin-uninstall*`
 *   也一样（原来在「已下载」卡上，现在挪到这一行上）。
 */
/*
 * 行尾那颗药丸。iOS 应用市场的一行**只有一个动作**（获取 / 打开），就这一颗。
 *
 * 两种配色对应两种语义，别再临时拼颜色：
 *   · SOFT  —— 可做但不算主动作（设为当前）
 *   · MUTE  —— 状态，不可点（当前）
 *
 * ⚠️ 2026-10-28 删掉了 `MAIN`（亮黄那颗）。它只服务「💎 价格」购买按钮，
 *   购买分支删掉之后一个读者都没有了。**别把它加回来** ——
 *   这页现在没有「主动作」这一档：安装/更新走 `InstallAction` 自己的按钮。
 */
const PILL_BASE =
  'btn h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-extrabold active:btn-press disabled:opacity-50'
const PILL_SOFT = PILL_BASE + ' border border-ink-200 bg-white text-ink-700'
const PILL_MUTE =
  'grid h-8 shrink-0 place-items-center rounded-full bg-ink-100 px-3.5 text-[12.5px] font-extrabold text-ink-500'

/** 列表行左边的图标：矢量插画（见 `GameIcon.tsx`），内置的用默认底色 */
function RowIcon({ id, tint }: { id: string; tint?: StoreTint }) {
  return (
    <span
      aria-hidden
      className="h-[58px] w-[58px] shrink-0 overflow-hidden rounded-[15px] border-2 border-ink-900/10 shadow-flat"
    >
      <GameIconArt id={id} tint={tint} className="h-full w-full" />
    </span>
  )
}

/**
 * 一行。
 *
 * iOS 的做法：**整行可点进详情**，但行里那颗药丸要能单独点。
 * 所以铺一层透明的覆盖按钮（`absolute inset-0`）当点击区，内容层
 * `pointer-events-none` 让点击穿过去，只有药丸那一簇 `pointer-events-auto`。
 *
 * ⚠️ 别把覆盖层放在内容**上面**（`z-10`）—— 那会把药丸盖住，
 *   `el.click()` 照样绿（它不走命中测试），真人点却点不动。
 */
function RowShell({
  builtinId,
  pluginId,
  installedRowId,
  upToDateId,
  icon,
  name,
  note,
  subtitle,
  meta,
  pill,
  onOpen,
}: {
  builtinId?: string
  pluginId?: string
  installedRowId?: string
  upToDateId?: string
  icon: ReactNode
  name: string
  note?: string
  subtitle: string
  meta?: ReactNode
  pill: ReactNode
  onOpen?: () => void
}) {
  return (
    <li
      data-market-builtin={builtinId}
      data-local-row={pluginId}
      data-plugin-installed-row={installedRowId}
      data-local-installed={upToDateId}
      className="relative border-t border-ink-100 first:border-t-0"
    >
      {onOpen && pluginId && (
        <button
          type="button"
          data-store-detail={pluginId}
          onClick={onOpen}
          aria-label={`查看 ${name} 的详情`}
          className="absolute inset-0 z-0"
        />
      )}
      <div className="pointer-events-none relative flex items-center gap-3 py-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate font-display text-[15px] font-extrabold leading-tight text-ink-900">
              {name}
            </span>
            {note && <span className="shrink-0 text-[10px] font-bold text-ink-300">{note}</span>}
          </div>
          {/* 一句话简介给**两行**：iOS 那行副标题只有「摄影与录像」这么短，
              我们这句是完整句子，压成一行会截在「把收成拿到…」这种地方 */}
          <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-ink-500">{subtitle}</p>
          {meta && (
            <p className="mt-0.5 truncate text-[10.5px] font-bold leading-snug text-ink-500">
              {meta}
            </p>
          )}
          <InstallBar gameId={pluginId} />
        </div>
        <div className="pointer-events-auto shrink-0">{pill}</div>
        {/*
          箭头用 SVG 不用「›」那个字形：它的大小/基线跟着字体走，
          换字体就变成一个小点（平板截图上几乎看不见）。iOS 用的也是矢量箭头。
        */}
        {onOpen && (
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-ink-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        )}
      </div>
    </li>
  )
}

/**
 * 列表行里那条**细进度条**（2026-11-13）。
 *
 * 只在"这一行正在装"时出现：平时不渲染（`null`），不占版式 ——
 * 列表的行高是一行行量过的，凭空多一块会把整列往下推。
 *
 * `percent < 0`（总长未知）时不画比例，改用一条来回滚动的条：
 * 画一条停在 0% 的实心条会让人以为卡死。
 */
export function InstallBar({ gameId }: { gameId?: string }) {
  const progress = useApp((s) => (s.installProgress?.gameId === gameId ? s.installProgress : null))
  if (!progress) return null
  const known = progress.percent >= 0
  const ratio = barRatio(progress)
  return (
    <div className="mt-1.5" data-install-bar={gameId}>
      <div className="h-1 overflow-hidden rounded-pill bg-ink-100">
        <div
          className={
            known
              ? 'h-full rounded-pill bg-grass-400 transition-[width] duration-200'
              : 'indeterminate h-full w-1/3 rounded-pill bg-grass-400'
          }
          style={known ? { width: `${Math.round(ratio * 100)}%` } : undefined}
          data-install-bar-fill={known ? Math.round(ratio * 100) : -1}
        />
      </div>
      <div className="mt-0.5 text-[10px] font-bold text-ink-500" data-install-phase={progress.phase}>
        {installProgressText(progress)}
      </div>
    </div>
  )
}

type BuiltinRow = { src: 'builtin'; game: GameDef; kind: GameKind }
type PluginRow = { src: 'plugin'; local: LocalGameEntry; g: StorefrontEntry; kind: GameKind }
type MarketRow = BuiltinRow | PluginRow

export function GameMarket({ gateOpen }: { gateOpen: boolean }) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { install, installingId } = useInstall()

  const installedGames = useApp((s) => s.installedGames)
  const activeGameId = useApp((s) => s.activeGameId)
  const setActiveGame = useApp((s) => s.setActiveGame)
  const ownedGameIds = useApp((s) => s.ownedGameIds)
  const wishOrders = useApp((s) => s.wishOrders)

  /*
    目录里的版本号（id → version）。

    ★ **拉不到就退回本地版本，列表照常渲染** —— 这张表是「我的游戏」的控制台，
      不能因为一次网络抖动整张空掉。原来那块「从服务器下载」就是为了隔离这个
      失败模式才单独开一块的；现在并进来之后，隔离点变成「只有『有没有新版』
      这一条信息会缺」，而不是整张表。
  */
  const [catalogVer, setCatalogVer] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    if (!catalogConfigured()) return
    let alive = true
    fetchVerifiedCatalog({ catalogUrl: CATALOG_URL, publicKeyRaw: catalogPublicKeyRaw() })
      .then((cat) => {
        if (alive) setCatalogVer(Object.fromEntries(cat.games.map((g) => [g.id, g.version])))
      })
      .catch(() => {
        /* 静默：目录没配 / 没网 / 验签失败，都只意味着「不知道有没有新版」 */
      })
    return () => {
      alive = false
    }
  }, [])

  // 内置在前（农场是首款），插件按 `storefront.ts` 的书写顺序跟在后面。
  // 分组顺序由 `GAME_KIND_ORDER` 定，空分类不渲染。
  const rows: MarketRow[] = [
    ...GAMES.map((game) => ({ src: 'builtin' as const, game, kind: game.kind })),
    ...STOREFRONT.map((g) => {
      const local = LOCAL_GAMES.find((x) => x.id === g.id)
      return local ? { src: 'plugin' as const, local, g, kind: g.kind } : null
    }).filter((r): r is PluginRow => r !== null),
  ]

  /*
    「拥有」的口径收在 `ownedSetFor` 里 —— **和 `installLocalGame` 的门槛同一口径**。
    两处各写一份的话，会出现「按钮亮着、点下去说没拥有」这种最难受的组合。
    这里读 store 快照是安全的：这是渲染，不是写入路径。

    ★★ 在线版这里**只认服务端名单**：本地装了包、心愿单兑换过，都不算。
      算上的话，界面会显示「已拥有」，而存档写穿会被 `10040401` 拒 ——
      孩子玩一下午进度全丢，界面上全程正常。见 `domain/ownership.ts`。
  */
  const ownedSet = ownedSetFor(isOnlineMode, ownedGameIds, installedGames, wishOrders)

  /*
    2026-11-07 家长：「未拥有的游戏不要显示在上面，除非已经激活拥有」。

    ⇒ 没拥有的插件**整行不渲染**（原来是显示一颗「未拥有」药丸）。理由：
      这一屏叫「我的游戏」，列一堆自己打不开的东西，只会让家长以为自己买过。

    三条例外，都是「已经在这台机器上生效了」，藏掉会更糟：
      · `installedGames[id]` —— 装过。万一服务端把拥有权撤了，藏掉的话
        家长既看不到它、也没地方卸载，包白占空间；
      · `activeGameId === id` —— 当前正在用的那款。列表里没有「当前」是最诡异的；
      · 内置游戏一律显示 —— 它们随包发、不存在「未拥有」，`RowShell` 里写的是「自带」。
  */
  const visibleRows = rows.filter((row) => {
    if (row.src === 'builtin') return true
    const id = row.local.id
    return ownedSet.has(id) || !!installedGames[id] || activeGameId === id
  })

  /*
    ⚠️ 这里原来有一个 `buy()` —— 点「💎 价格」调 `buyGame`。
    2026-10-28 购买分支整段删掉之后它没有读者了，一起删。
    （`buyGame` 本身还在 store 里：心愿商城的数字商品走的是另一条链，别顺手删。）
  */

  return (
    <>
      <Card title="我的游戏" emoji="🎮">
        {/*
          2026-11-07 家长要求：把「我的游戏」下面那两段说明**去掉**
          （「这些游戏是任务之后的奖励…」一直到「…底部那个游戏按钮就是它」）。

          ⚠️ 别再加回来。这一屏的定位是**控制台**，不是介绍页：
          家长进来是要切换 / 卸载游戏，不是读理念。
          文案口径本身没变（见 `GamesSection.tsx` 头注释），只是不摆在这儿。
        */}
        {GAME_KIND_ORDER.map((kind) => {
          const group = visibleRows.filter((r) => r.kind === kind)
          if (group.length === 0) return null
          return (
            <section key={kind} data-market-kind={kind} className="mt-5">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display text-[13px] font-extrabold tracking-wide text-ink-600">
                  {GAME_KINDS[kind].label}
                </h3>
                <span className="shrink-0 text-[11px] font-bold text-ink-300">{group.length} 款</span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-500">
                {GAME_KINDS[kind].note}
              </p>

              <ul className="mt-1">
                {group.map((row) => {
                  /* ---------- 内置：状态只有 当前 / 设为当前 / 要买 / 敬请期待 ---------- */
                  if (row.src === 'builtin') {
                    const { game } = row
                    const isCurrent = activeGameId === game.id
                    return (
                      <RowShell
                        key={game.id}
                        builtinId={game.id}
                        icon={<RowIcon id={game.id} />}
                        name={game.name}
                        note="自带"
                        subtitle={game.tagline}
                        /*
                          ⚠️ 2026-10-28 这里只剩「当前 / 设为当前」两个状态。
                          原来还有「要买（💎 价格）」和「敬请期待」两条，家长：
                            「这些都是已经购买的游戏。在这里只是控制，下载，
                              安装，卸载，选择当前。」
                          ⇒ 购买与占位两条分支整段删掉（`buyGame` / `priceMall` /
                            `GameStatus` 在这张表里一个读者都没有了）。

                          这是**删规则不是藏规则**：留下「没买就显示价格」的分支，
                          将来某款游戏 `priceMall` 被填上，界面会突然冒出一个
                          没有发币入口、按下去必然失败的购买按钮。
                        */
                        pill={
                          isCurrent ? (
                            <span className={PILL_MUTE}>当前</span>
                          ) : (
                            <button
                              disabled={!gateOpen}
                              data-builtin-set-current={game.id}
                              onClick={() => void setActiveGame(game.id)}
                              className={PILL_SOFT}
                            >
                              设为当前
                            </button>
                          )
                        }
                      />
                    )
                  }

                  /* ---------- 插件：可装 / 已装 / 当前 ---------- */
                  const { local, g } = row
                  const installed = installedGames[local.id]
                  /* 该装哪一版：目录里有就用目录的（服务器可能有新包），否则随包发的那版 */
                  const target = catalogVer?.[local.id] ?? local.version
                  const upToDate = !!installed && !hasUpdate(target, installed.version)
                  const isCurrent = activeGameId === local.id
                  // 只有装过才谈得上「参数异常」—— 没装时没有 manifest 可校验
                  const issue = installed ? !!checkPluginEconomy(installed.economy) : false

                  return (
                    <RowShell
                      key={local.id}
                      pluginId={local.id}
                      installedRowId={installed ? local.id : undefined}
                      upToDateId={upToDate ? local.id : undefined}
                      icon={<RowIcon id={g.id} tint={g.tint} />}
                      name={g.name}
                      /*
                        装了旧版时写「旧 → 新」。只写目标版本的话，家长会以为
                        装的就是那一版（原来是「已装 v1.0.0 · 有新版本 v1.0.2」，
                        一行塞不下；箭头是同一个意思，占一半地方）。
                      */
                      note={
                        installed && hasUpdate(target, installed.version)
                          ? `v${installed.version} → v${target}`
                          : `v${target}`
                      }
                      subtitle={g.pitch}
                      /*
                        行上只留「适龄 · 一次多久」。**体积不放这儿** ——
                        iOS 应用市场的列表也不放，它属于详情。挤上来会把
                        「一次 5~10 分钟」截断成「一次 5~10 分…」，正好截掉最要紧那半句。
                      */
                      meta={
                        <>
                          {g.age} · {g.session}
                          {issue && <span className="text-berry-500"> · 参数异常</span>}
                        </>
                      }
                      onOpen={() => setDetailId(local.id)}
                      pill={
                        upToDate ? (
                          isCurrent ? (
                            <span className={PILL_MUTE}>当前</span>
                          ) : (
                            <button
                              disabled={!gateOpen}
                              data-plugin-set-current={local.id}
                              onClick={() => void setActiveGame(local.id)}
                              className={PILL_SOFT}
                            >
                              设为当前
                            </button>
                          )
                        ) : ownedSet.has(local.id) ? (
                          <InstallAction
                            id={local.id}
                            gateOpen={gateOpen}
                            installingId={installingId}
                            onInstall={install}
                            target={target}
                            size="xs"
                          />
                        ) : (
                          /* 没拥有：**不摆按钮**。摆一个「安装」再点出一句
                             「还没拥有」是最差的组合 —— 界面先承诺，再当场否认。

                             2026-10-30 文案从「去心愿商城」改成「未拥有」：
                             那颗药丸是 `PILL_MUTE`（`span`，不可点），而它坐在
                             **动作列**里、外面还裹着 `pointer-events-auto` ——
                             整行别处都能点进详情，唯独这块点下去什么都不发生。
                             写着「去…」就一定会有人去点。它现在只陈述状态 ——
                             这一屏也不再说「怎么解锁」：家长 2026-11-07 要求
                             把表格底下那几句说明连同「有兑换码？」一起删掉，
                             解锁只剩「心愿 → 那件商品 → 爸妈定价页」一条路。 */
                          <span className={PILL_MUTE} data-local-need-own={local.id}>
                            未拥有
                          </span>
                        )
                      }
                    />
                  )
                })}
              </ul>
            </section>
          )
        })}
      </Card>

      {detailId && (
        /*
          ★ 把「有没有拥有」传下去。详情页里那颗大按钮和列表行是**同一个动作的
          两个入口** —— 列表那边判了拥有、详情这边没判，就会出现
          「列表写『未拥有』、点进详情一个大黄『安装』」（2026-10-30 截图实拍到的）。
          点下去当然装不成，弹一句「没装成 / 还没拥有」——
          正是列表注释里说的「界面先承诺，再当场否认」。

          不要让它自己去 `wishOwnedSet` 算：两处各写一份，迟早走散。
        */
        <GameDetailSheet
          id={detailId}
          gateOpen={gateOpen}
          owned={ownedSet.has(detailId)}
          targetVersion={catalogVer?.[detailId]}
          onClose={() => setDetailId(null)}
        />
      )}
    </>
  )
}

/* ============================================================
   ② 详情（截图 + 关于）—— 唯一还留在弹层里的东西
   ============================================================ */
function GameDetailSheet({
  id,
  gateOpen,
  owned,
  targetVersion,
  onClose,
}: {
  id: string
  gateOpen: boolean
  /** 已拥有（含兑换码 / 心愿兑换 / 已装包三种来源，由 `GameMarket` 统一算） */
  owned: boolean
  /** 目录里的版本；拉不到就是 undefined（退回随包发的版本） */
  targetVersion?: string
  onClose: () => void
}) {
  const { install, installingId } = useInstall()
  const g = storefrontOf(id)

  // Esc 关闭：桌面/平板上家长很自然会按
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!g) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
        <button
          aria-label="关闭游戏详情"
          onClick={onClose}
          className="anim-fade-in fixed inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        />
        <div
          role="dialog"
          aria-label="游戏详情"
          className="anim-sheet-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl md:max-h-[85vh] md:max-w-2xl md:rounded-3xl"
        >
          {/* 抓手：手机上表示「能往下拉」，平板居中对话框上没有意义 */}
          <div className="pt-2.5 md:hidden">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-900/15" />
          </div>

          <DetailView
            g={g}
            gateOpen={gateOpen}
            owned={owned}
            targetVersion={targetVersion}
            installingId={installingId}
            onInstall={install}
            onClose={onClose}
          />
        </div>
      </div>
    </Portal>
  )
}

function DetailView({
  g,
  gateOpen,
  owned,
  targetVersion,
  installingId,
  onInstall,
  onClose,
}: {
  g: StorefrontEntry
  gateOpen: boolean
  owned: boolean
  targetVersion?: string
  installingId: string | null
  onInstall: (id: string) => void
  onClose: () => void
}) {
  const [zoom, setZoom] = useState<StoreShot | null>(null)
  const local = LOCAL_GAMES.find((x) => x.id === g.id)

  const installedGames = useApp((s) => s.installedGames)
  const uninstallGame = useApp((s) => s.uninstallGame)
  /** 卸载的二次确认：会连存档一起删，不能一下点掉 */
  const [confirmingUninstall, setConfirmingUninstall] = useState(false)
  const installed = installedGames[g.id]

  return (
    <>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3 md:pt-5">
        <span className="min-w-0 flex-1 truncate text-sm font-extrabold text-ink-700">
          游戏详情
        </span>
        <button
          data-store-close
          onClick={onClose}
          aria-label="关闭"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-900/5 text-lg text-ink-700 active:bg-ink-900/10"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {/* 头图 + 基本信息：图标是「身份」，截图是「预览」—— 两者别混用。
            原来这里塞的是 `shots[0]`（104px 宽），跟下面的截图区重复，
            而且 9:16 裁到 104 宽只剩一条竖缝，看不清是什么。 */}
        <div className="flex gap-3">
          <GameIcon g={g} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-extrabold leading-tight text-ink-900">
              {g.name}
            </h3>
            {local && (
              <p className="mt-0.5 text-[11px] font-bold text-ink-500">v{local.version}</p>
            )}
            <p className="mt-1.5 text-sm leading-snug text-ink-700">{g.pitch}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Chip>{g.age}</Chip>
              <Chip>{g.session}</Chip>
              {local && <Chip>{formatSize(local.totalBytes || local.bytes)}</Chip>}
            </div>
          </div>
        </div>

        {/* ⚠️ `flex` 不能省：`InstallAction` 的「已安装」是个 `<span class="grid">`，
            在块级容器里会自动铺满整行 —— 而「安装」是 `<button>`（inline-block，只有内容宽）。
            少了这一层，同一位置装前是一个小药丸、装后是一条通栏绿条，看着像换了个控件。 */}
        <div className="mt-3 flex flex-col items-start gap-1.5">
          {owned ? (
            <InstallAction
              id={g.id}
              gateOpen={gateOpen}
              installingId={installingId}
              onInstall={onInstall}
              target={targetVersion}
              size="lg"
            />
          ) : (
            /*
              没拥有：和列表行同一个口径 —— 不摆按钮。详情页是**单独的屏**，
              列表底部那句说明它看不到，所以这里必须自己说一句怎么解锁。
            */
            <>
              {/*
                整串写出来，不拼 `PILL_MUTE`。

                拼接**是能覆盖的**（实测 `h-8 h-10` → 40px、`text-[12.5px] text-sm` → 16px，
                与 class 书写顺序无关），但那是 Tailwind 生成顺序碰巧如此 ——
                读的人没法从这一行看出「最后是哪个值生效」，改的人也不敢动。
                这颗要的尺寸和行内药丸本来就不是一档，写清比省 30 个字符值。

                为什么比上面那排 Chip 大一档：它写的是**状态**，
                跟「6 岁以上 · 4.3MB」那类规格挤在同一层级会被读成第 4 条规格。
              */}
              <span
                className="grid h-10 shrink-0 place-items-center rounded-full bg-ink-100 px-4 text-sm font-extrabold text-ink-500"
                data-local-need-own={g.id}
              >
                未拥有
              </span>
              <p className="text-[11.5px] font-bold leading-snug text-ink-500">
                让孩子在「心愿」里说要哪款，你定价之后到「兑换」里换；
                兑换码输在列表最下面。
              </p>
            </>
          )}
        </div>

        {/* 练什么 —— 列表里已经不放这一栏了，家长要看就点进详情（2026-10-25） */}
        <section className="mt-5">
          <h4 className="font-display text-base font-extrabold text-ink-900">练什么</h4>
          <ul className="mt-2 space-y-2">
            {g.learn.map((line) => (
              <li key={line} className="flex gap-2 text-sm leading-snug text-ink-700">
                <span className="mt-[3px] shrink-0 text-grass-600">·</span>
                <span className="min-w-0">{line}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 截图 */}
        <section className="mt-5">
          <h4 className="font-display text-base font-extrabold text-ink-900">截图</h4>
          <p className="mt-0.5 text-[11px] font-bold text-ink-500">点一下能放大</p>
          <div className="-mx-4 mt-2 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1">
            {g.shots.map((s) => (
              <button
                key={s.src}
                data-store-shot
                onClick={() => setZoom(s)}
                className="w-[132px] shrink-0 snap-start text-left active:scale-[.98]"
              >
                <img
                  src={s.src}
                  alt=""
                  className="w-full rounded-xl border-2 border-ink-900/10 object-cover object-top"
                  loading="lazy"
                />
                <span className="mt-1 block text-[11px] leading-snug text-ink-500">
                  {s.caption}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 关于 */}
        <section className="mt-5">
          <h4 className="font-display text-base font-extrabold text-ink-900">关于这款游戏</h4>
          <div className="mt-2 space-y-2">
            {g.about.map((p) => (
              <p key={p} className="text-sm leading-relaxed text-ink-700">
                {p}
              </p>
            ))}
          </div>
        </section>

        {/*
          经济参数 —— `docs/game-plugin-spec.md` §4.4 要求「必须对家长可见」。
          它原来在「游戏市场」那张卡里（`PluginStoreCard.tsx`），
          2026-10-29 那张卡整体删掉时**连它一起删了**，契约就断了（22 个 e2e 的
          断言还指着它，从此一直红）。现在收进**详情**：家长点进哪款就看哪款，
          列表页仍然只有「装 / 卸 / 设为当前」，不加回一层。
          ⚠️ 只有装了才有参数可看（没装时 manifest 还没下来）。
        */}
        {installed && (
          <section className="mt-5" data-plugin-economy>
            <h4 className="font-display text-base font-extrabold text-ink-900">花多少积分</h4>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">
              一局 {installed.economy.playCost} 积分，期望产出 {installed.economy.expectedPayout}{' '}
              {installed.coin.name}
              {(() => {
                const v = vouchersPerPlay(installed.economy)
                return v > 0
                  ? `（1 ${installed.coin.name} = ${installed.economy.voucherPerCoin} 兑换券，一局期望 ${+v.toFixed(2)} 兑换券）`
                  : '（不开放兑换券）'
              })()}
            </p>
          </section>
        )}

        <p className="mt-5 rounded-2xl bg-paper-2 px-3 py-2.5 text-[11px] leading-snug text-ink-500">
          这个游戏花的是 App 里的积分（每一局花多少、期望收回多少，就在上面「花多少积分」那一栏）。
          它不能自己发积分。
        </p>

        {/*
          存档还原点 —— **只有在线版有**。本地版的历史版本根本不存在
          （Dexie 里就是一份当前存档），摆个空壳只会让人以为「功能坏了」。

          放在卸载正上方是有意的：卸载那段写的是「会连存档一起删掉」，
          紧挨着就是「想退回去用还原点」，两句读下来是一个完整的意思。
        */}
        {installed && isOnlineMode && (
          <SnapshotSection gameId={g.id} gameName={g.name} />
        )}

        {/*
          卸载放在**详情最下面**（2026-10-25）。
          列表行上只留一个动作（iOS 应用市场就是这样），而「删存档」是不可逆的，
          不该躺在孩子每天滚的那一屏里等着被误触。
        */}
        {installed && (
          <section className="mt-6 border-t border-ink-100 pt-4">
            {confirmingUninstall ? (
              <div className="rounded-2xl bg-berry-100 px-3 py-3">
                <p className="text-[12.5px] leading-snug text-ink-700">
                  卸载会连「{g.name}」的存档一起删掉，下次装回来是重新开始。
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    data-plugin-uninstall-confirm={g.id}
                    onClick={() => {
                      void (async () => {
                        setConfirmingUninstall(false)
                        await uninstallGame(g.id)
                        onClose()
                      })()
                    }}
                    className="btn h-10 flex-1 rounded-full bg-berry-500 text-sm font-extrabold text-white active:btn-press"
                  >
                    确认卸载
                  </button>
                  <button
                    onClick={() => setConfirmingUninstall(false)}
                    className="btn h-10 flex-1 rounded-full bg-white text-sm font-extrabold text-ink-700 active:btn-press"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                data-plugin-uninstall={g.id}
                onClick={() => setConfirmingUninstall(true)}
                className="btn h-10 w-full rounded-full bg-white text-sm font-extrabold text-berry-500 active:btn-press"
              >
                卸载这个游戏
              </button>
            )}
          </section>
        )}
      </div>

      {zoom && (
        <button
          onClick={() => setZoom(null)}
          aria-label="关闭大图"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-ink-900/80 p-5"
        >
          <img
            src={zoom.src}
            alt=""
            className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain"
          />
          <span className="text-center text-sm font-bold text-white/90">{zoom.caption}</span>
        </button>
      )}
    </>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-ink-900/5 px-2.5 py-1 text-[11px] font-extrabold text-ink-600">
      {children}
    </span>
  )
}

/**
 * 详情页顶部那颗大图标 —— 和列表行里的是**同一支插画**，只是尺寸不同。
 *
 * 为什么不用截图当图标（第一版就是那么做的，试过）：
 * 真机截图是 9:16，塞进方形图标里只剩一条竖着的窄缝 ——
 * 缩小到列表尺寸后是一团花掉的颜色，家长根本认不出是什么游戏。
 * 应用商店也是这个做法：**列表给图标，截图留到详情页**（那里有 132px 宽 + 能点开放大）。
 *
 * 所以图标是**手画的**，主体按游戏挑（见 `GameIcon.tsx` 头注释），
 * 底色仍跟 `tint` 走 —— 两款农场（内置 / 云边）靠底色区分。
 */
function GameIcon({ g, size = 'md' }: { g: StorefrontEntry; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-20 w-20 rounded-[22px]' : 'h-14 w-14 rounded-2xl'
  return (
    <span
      aria-hidden
      className={
        'shrink-0 overflow-hidden border-3 border-ink-900/10 shadow-flat ' + box
      }
    >
      <GameIconArt id={g.id} tint={g.tint} className="h-full w-full" />
    </span>
  )
}
