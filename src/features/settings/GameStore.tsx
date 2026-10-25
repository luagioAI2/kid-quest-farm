import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useApp } from '../../store/useApp'
import { Card } from './ui'
import { Portal } from '../../components/Portal'
import { LOCAL_GAMES } from '../../games/localGames'
import {
  storefrontOf,
  type StorefrontEntry,
  type StoreShot,
  type StoreTint,
} from '../../games/storefront'
import { gameById } from '../../games/registry'
import { formatSize } from '../../games/size'
import { checkPluginEconomy } from '../../domain/pluginEconomy'

/**
 * 游戏市场 —— 手机应用市场那种形态（2026-10-24 用户要求）。
 *
 * ```
 *   设置页           「游戏市场」卡片：三张封面 + 「进入游戏市场」
 *     └─ 商店（全屏）  列表：封面 / 名字 / 一句话 / 适龄 / 安装
 *          └─ 详情     大图 + 帮助孩子 + 截图（可点开放大）+ 关于
 * ```
 *
 * ## 为什么商店是**全屏页**，不是设置页里的一张大卡片
 *
 * 设置页已经是一长串卡片（钻石 / 已购买 / 在线商店 / 已下载 / 敬请期待）。
 * 再把三张带封面的游戏卡塞进去，那一页就变成「什么都有、什么都找不到」。
 * 应用市场的做法是**把浏览和设置分开**：设置里只留一个入口。
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
  size?: 'sm' | 'lg'
}) {
  const installedGames = useApp((s) => s.installedGames)
  const local = LOCAL_GAMES.find((g) => g.id === id)
  const installed = installedGames[id]
  const upToDate = !!installed && !!local && installed.version === local.version
  // 下载来的包不许占用内置 id（`installFromCatalog` 也会拒），这里直接把按钮拿掉
  const clashes = !!gameById(id)

  const pad = size === 'lg' ? 'h-12 px-6 text-base' : 'h-10 px-3.5 text-xs'

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
   ① 设置页里的入口卡
   ============================================================ */
export function GameStoreEntry({ gateOpen }: { gateOpen: boolean }) {
  const [open, setOpen] = useState(false)
  const shown = LOCAL_GAMES.map((g) => storefrontOf(g.id)).filter(
    (g): g is StorefrontEntry => !!g,
  )

  return (
    <>
      <Card title="游戏市场" emoji="🏬">
        <p className="text-sm leading-relaxed text-ink-500">
          装上就能在底部那个游戏按钮里玩。每一款都写了它是让孩子练什么的。
        </p>

        <div className="mt-3 flex gap-2">
          {shown.map((g) => (
            <div key={g.id} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <GameIcon g={g} />
              <p className="w-full truncate text-center text-[11px] font-extrabold text-ink-700">
                {g.name}
              </p>
            </div>
          ))}
        </div>

        <button
          disabled={!gateOpen}
          data-open-store
          onClick={() => setOpen(true)}
          className="btn mt-3 h-12 w-full rounded-2xl bg-sky-300 text-sm font-extrabold text-ink-900 shadow-flat active:btn-press disabled:opacity-50"
        >
          进入游戏市场
        </button>
      </Card>

      {open && <GameStoreSheet gateOpen={gateOpen} onClose={() => setOpen(false)} />}
    </>
  )
}

/* ============================================================
   ② 商店（全屏）：列表 → 详情
   ============================================================ */
function GameStoreSheet({ gateOpen, onClose }: { gateOpen: boolean; onClose: () => void }) {
  const [detailId, setDetailId] = useState<string | null>(null)
  const { install, installingId } = useInstall()

  // Esc 关闭：桌面/平板上家长很自然会按
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (detailId) setDetailId(null)
      else onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [detailId, onClose])

  const detail = detailId ? storefrontOf(detailId) : null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
        <button
          aria-label="关闭游戏市场"
          onClick={onClose}
          className="anim-fade-in fixed inset-0 bg-ink-900/40 backdrop-blur-[2px]"
        />
        <div
          role="dialog"
          aria-label="游戏市场"
          className="anim-sheet-up relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl bg-paper shadow-2xl md:max-h-[85vh] md:max-w-2xl md:rounded-3xl"
        >
          {/* 抓手：手机上表示「能往下拉」，平板居中对话框上没有意义 */}
          <div className="pt-2.5 md:hidden">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-ink-900/15" />
          </div>

          {detail ? (
            <DetailView
              g={detail}
              gateOpen={gateOpen}
              installingId={installingId}
              onInstall={install}
              onBack={() => setDetailId(null)}
              onClose={onClose}
            />
          ) : (
            <ListView
              gateOpen={gateOpen}
              installingId={installingId}
              onInstall={install}
              onOpenDetail={setDetailId}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </Portal>
  )
}

function ListView({
  gateOpen,
  installingId,
  onInstall,
  onOpenDetail,
  onClose,
}: {
  gateOpen: boolean
  installingId: string | null
  onInstall: (id: string) => void
  onOpenDetail: (id: string) => void
  onClose: () => void
}) {
  // 订阅已安装清单：装完之后「参数异常」要跟着更新，不能停在旧值
  const installedGames = useApp((s) => s.installedGames)
  return (
    <>
      <header className="flex items-start gap-3 px-4 pb-3 pt-3 md:pt-5">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-extrabold text-ink-900">🏬 游戏市场</h2>
          <p className="mt-0.5 text-xs leading-snug text-ink-500">
            点开任意一款，能看到它让孩子练什么、里面长什么样。
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="关闭"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink-900/5 text-lg text-ink-700 active:bg-ink-900/10"
        >
          ✕
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">
        <ul className="space-y-3">
          {LOCAL_GAMES.map((local) => {
            const g = storefrontOf(local.id)
            if (!g) return null
            // 只有装过才谈得上「参数异常」—— 没装时没有 manifest 可校验
            const m = installedGames[local.id]
            const issue = m ? !!checkPluginEconomy(m.economy) : false
            return (
              <li
                key={local.id}
                data-local-row={local.id}
                className="flex items-center gap-3 rounded-2xl border-3 border-ink-900/10 bg-paper-2 p-2.5"
              >
                {/* 图标本身就是「点开详情」的按钮 —— 应用市场里整张卡都能点 */}
                <button
                  data-store-detail={local.id}
                  onClick={() => onOpenDetail(local.id)}
                  aria-label={'查看 ' + g.name + ' 的详情'}
                  className="shrink-0 active:scale-[.97]"
                >
                  <GameIcon g={g} />
                </button>

                <button
                  onClick={() => onOpenDetail(local.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-display text-base font-extrabold text-ink-900">
                      {g.name}
                    </span>
                    <span className="shrink-0 text-[11px] font-bold text-ink-500">
                      v{local.version}
                    </span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-ink-600">
                    {g.pitch}
                  </span>
                  <span className="mt-1 block text-[11px] font-bold text-ink-500">
                    {g.age} · {g.session} · {formatSize(local.bytes)}
                    {issue && <span className="ml-1 text-berry-500">· 参数异常</span>}
                  </span>
                </button>

                <InstallAction
                  id={local.id}
                  gateOpen={gateOpen}
                  installingId={installingId}
                  onInstall={onInstall}
                />
              </li>
            )
          })}
        </ul>

        <p className="mt-4 text-[11px] leading-snug text-ink-500">
          装之前会核对包的内容（本地包对内置哈希）。核对不过的一律不装。
        </p>
      </div>
    </>
  )
}

function DetailView({
  g,
  gateOpen,
  installingId,
  onInstall,
  onBack,
  onClose,
}: {
  g: StorefrontEntry
  gateOpen: boolean
  installingId: string | null
  onInstall: (id: string) => void
  onBack: () => void
  onClose: () => void
}) {
  const [zoom, setZoom] = useState<StoreShot | null>(null)
  const local = LOCAL_GAMES.find((x) => x.id === g.id)

  return (
    <>
      <header className="flex items-center gap-2 px-4 pb-2 pt-3 md:pt-5">
        <button
          data-store-back
          onClick={onBack}
          className="flex h-10 shrink-0 items-center gap-1 rounded-full bg-ink-900/5 px-3 text-sm font-extrabold text-ink-700 active:bg-ink-900/10"
        >
          ← 返回
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-xs font-extrabold text-ink-500">
          游戏市场
        </span>
        <button
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

        {/* 帮助孩子 */}
        <section className="mt-5">
          <h4 className="font-display text-base font-extrabold text-ink-900">帮助孩子</h4>
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
 * 游戏图标 = 一块着色方块 + emoji。
 *
 * 为什么不是截图缩略图（第一版就是那么做的，试过）：
 * 真机截图是 9:16，塞进 72px 宽的小方格里只剩一条竖着的窄缝 ——
 * 放大到列表尺寸后是一团花掉的颜色，家长根本认不出是什么游戏。
 * 应用商店也是这个做法：**列表给图标，截图留到详情页**（那里有 132px 宽 + 能点开放大）。
 *
 * 底色跟游戏主题走（`tint` 在 `storefront.ts` 里声明），
 * 这样三款游戏在列表里一眼能分开，又不用引入图片资源。
 */
const TINT_BG: Record<StoreTint, string> = {
  grass: 'bg-grass-200',
  sky: 'bg-sky-200',
  sun: 'bg-sun-200',
  berry: 'bg-berry-200',
}

function GameIcon({ g, size = 'md' }: { g: StorefrontEntry; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-20 w-20 rounded-[22px] text-4xl' : 'h-14 w-14 rounded-2xl text-2xl'
  return (
    <span
      aria-hidden
      className={
        'grid shrink-0 place-items-center border-3 border-ink-900/10 shadow-flat ' +
        box +
        ' ' +
        TINT_BG[g.tint]
      }
    >
      {g.emoji}
    </span>
  )
}
