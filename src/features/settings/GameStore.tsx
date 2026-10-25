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
import { CURRENCY } from '../../domain/currency'
import { formatSize } from '../../games/size'
import { checkPluginEconomy } from '../../domain/pluginEconomy'
import { GameIconArt } from './GameIcon'

/**
 * 游戏市场 —— 手机应用市场那种形态（2026-10-24 用户要求）。
 *
 * ```
 *   设置页 → 游戏   「游戏市场」卡片：所有游戏一张表，状态写在行上
 *     └─ 详情       大图 + 练什么 + 截图（可点开放大）+ 关于 + 安装
 * ```
 *
 * ⚠️ 这张卡 2026-10-25 被家长改了三次，三次都是「少一层、少一处」：
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
 * ## 安装仍然是**同一条链**
 *
 * 这里只调用 `installLocalGame`（`store/useApp.ts`），校验/落库一行都没动。
 * `data-local-*` 这几个锚点是 e2e 在用的，**不能改名字**。
 */

/** 一次「装」的状态，列表和详情共用，避免两处各写一套（连点会装两遍） */
function useInstall() {
  const installLocalGame = useApp((s) => s.installLocalGame)
  const pushToast = useApp((s) => s.pushToast)
  const [installingId, setInstallingId] = useState<string | null>(null)

  const install = async (id: string) => {
    if (installingId) return
    setInstallingId(id)
    try {
      const res = await installLocalGame(id)
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
  return { install, installingId }
}

/** 安装按钮 / 已安装标记 —— 列表和详情页都要用同一套判断 */
function InstallAction({
  id,
  gateOpen,
  installingId,
  onInstall,
  size = 'sm',
}: {
  id: string
  gateOpen: boolean
  installingId: string | null
  onInstall: (id: string) => void
  size?: 'xs' | 'sm' | 'lg'
}) {
  const installedGames = useApp((s) => s.installedGames)
  const local = LOCAL_GAMES.find((g) => g.id === id)
  const installed = installedGames[id]
  const upToDate = !!installed && !!local && installed.version === local.version
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
      {installingId === id ? '正在装…' : installed ? '更新' : '安装'}
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
 * | 内置 | `registry.ts`，编译进 App | `ownedGameIds`（买没买）+ `activeGameId` |
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
 * 三种配色对应三种语义，别再临时拼颜色：
 *   · MAIN  —— 这一步该做的事（安装 / 更新 / 花钻石买）
 *   · SOFT  —— 可做但不算主动作（设为当前）
 *   · MUTE  —— 状态，不可点（当前 / 敬请期待）
 */
const PILL_BASE =
  'btn h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-extrabold active:btn-press disabled:opacity-50'
const PILL_MAIN = PILL_BASE + ' bg-sun-300 text-ink-900'
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

type BuiltinRow = { src: 'builtin'; game: GameDef; kind: GameKind }
type PluginRow = { src: 'plugin'; local: LocalGameEntry; g: StorefrontEntry; kind: GameKind }
type MarketRow = BuiltinRow | PluginRow

export function GameMarket({ gateOpen }: { gateOpen: boolean }) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { install, installingId } = useInstall()

  const installedGames = useApp((s) => s.installedGames)
  const activeGameId = useApp((s) => s.activeGameId)
  const ownedGameIds = useApp((s) => s.ownedGameIds)
  const setActiveGame = useApp((s) => s.setActiveGame)
  const buyGame = useApp((s) => s.buyGame)
  const pushToast = useApp((s) => s.pushToast)

  // 内置在前（农场是首款），插件按 `storefront.ts` 的书写顺序跟在后面。
  // 分组顺序由 `GAME_KIND_ORDER` 定，空分类不渲染。
  const rows: MarketRow[] = [
    ...GAMES.map((game) => ({ src: 'builtin' as const, game, kind: game.kind })),
    ...STOREFRONT.map((g) => {
      const local = LOCAL_GAMES.find((x) => x.id === g.id)
      return local ? { src: 'plugin' as const, local, g, kind: g.kind } : null
    }).filter((r): r is PluginRow => r !== null),
  ]

  const buy = async (id: string) => {
    const res = await buyGame(id)
    pushToast({
      kind: res.ok ? 'success' : 'warn',
      title: res.ok ? '买好了' : '没买成',
      detail: res.message,
      emoji: res.ok ? '✅' : '⚠️',
    })
  }

  return (
    <>
      <Card title="游戏市场" emoji="🏬">
        <p className="text-sm leading-relaxed text-ink-500">
          点「详情」看每一款是让孩子练什么的。装好之后在这一行点「设为当前」，底部那个游戏按钮就是它。
        </p>

        {GAME_KIND_ORDER.map((kind) => {
          const group = rows.filter((r) => r.kind === kind)
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
                    const owned = ownedGameIds.includes(game.id)
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
                          `comingSoon` **只显示状态**：不写价格、不给购买按钮 ——
                          买了也没得玩，那就是「界面承诺了它做不到的事」。
                        */
                        pill={
                          game.status === 'comingSoon' ? (
                            <span className={PILL_MUTE}>敬请期待</span>
                          ) : !owned ? (
                            <button
                              disabled={!gateOpen}
                              data-buy-game={game.id}
                              onClick={() => void buy(game.id)}
                              className={PILL_MAIN}
                            >
                              {CURRENCY.mall.emoji} {game.priceMall}
                            </button>
                          ) : isCurrent ? (
                            <span className={PILL_MUTE}>当前</span>
                          ) : (
                            <button
                              disabled={!gateOpen}
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
                  const upToDate = !!installed && installed.version === local.version
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
                      note={`v${local.version}`}
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
                        ) : (
                          <InstallAction
                            id={local.id}
                            gateOpen={gateOpen}
                            installingId={installingId}
                            onInstall={install}
                            size="xs"
                          />
                        )
                      }
                    />
                  )
                })}
              </ul>
            </section>
          )
        })}

        <p className="mt-4 text-[11px] leading-snug text-ink-500">
          装之前会核对包的内容（本地包对内置哈希）。卸载在「详情」最下面 —— 会把存档一起删掉。
        </p>
      </Card>

      {detailId && (
        <GameDetailSheet id={detailId} gateOpen={gateOpen} onClose={() => setDetailId(null)} />
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
  onClose,
}: {
  id: string
  gateOpen: boolean
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
  installingId,
  onInstall,
  onClose,
}: {
  g: StorefrontEntry
  gateOpen: boolean
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
              {local && <Chip>{formatSize(local.bytes)}</Chip>}
            </div>
          </div>
        </div>

        {/* ⚠️ `flex` 不能省：`InstallAction` 的「已安装」是个 `<span class="grid">`，
            在块级容器里会自动铺满整行 —— 而「安装」是 `<button>`（inline-block，只有内容宽）。
            少了这一层，同一位置装前是一个小药丸、装后是一条通栏绿条，看着像换了个控件。 */}
        <div className="mt-3 flex">
          <InstallAction
            id={g.id}
            gateOpen={gateOpen}
            installingId={installingId}
            onInstall={onInstall}
            size="lg"
          />
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

        <p className="mt-5 rounded-2xl bg-paper-2 px-3 py-2.5 text-[11px] leading-snug text-ink-500">
          这个游戏花的是 App 里的积分（家长在「设置 → 游戏」里能看到每一局花多少、期望收回多少）。
          它不能自己发积分。
        </p>

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
