import { useMemo, useState } from 'react'
import clsx from 'clsx'
import { humanizeAgo, addDays } from '@/domain/time'
import type { LedgerEntry, LedgerSource } from '@/domain/types'
import { selectStreak, useApp } from '@/store/useApp'

/* ============================================================
   我的积分 · 流水 / 7 日柱状图 / 成就收集
   ------------------------------------------------------------
   图表全部手写 div + CSS（项目没有装图表库，也不新增依赖）。
   成就全部由真实数据推导，孩子能看到自己攒到了什么。
   ============================================================ */

/** 流水一次渲染多少条，点「再看早一点」再追加一批 */
const PAGE_SIZE = 30
/** 首屏渲染条数 */
const INITIAL_ROWS = 30

export default function PointsPage() {
  const ledger = useApp((s) => s.ledger)
  const instances = useApp((s) => s.instances)
  const checkIns = useApp((s) => s.checkIns)
  const farmTotals = useApp((s) => s.farmTotals)
  const streak = useMemo(() => selectStreak(useApp.getState()), [instances])
  const todayKey = useApp((s) => s.todayKey)

  // 流水全量在手（账要对得上），但只先渲染最近一批 ——
  // 既保证页面对孩子足够轻快，又不会让历史记录"消失"。
  const [visibleCount, setVisibleCount] = useState(INITIAL_ROWS)

  const completedCount = useMemo(
    () => instances.filter((i) => i.status === 'completed' || i.status === 'failed').length,
    [instances],
  )
  const perfectCount = useMemo(
    () =>
      instances.filter(
        (i) =>
          (i.earnedPoints ?? 0) > 0 && i.actualMinutes != null && i.actualMinutes <= i.plannedMinutes,
      ).length,
    [instances],
  )

  const week = useMemo(() => buildWeek(ledger, todayKey), [ledger, todayKey])

  const achievements = useMemo(
    () => buildAchievements({ completedCount, perfectCount, streak, checkIns: checkIns.length, farmTotals }),
    [completedCount, perfectCount, streak, checkIns.length, farmTotals],
  )

  const unlocked = achievements.filter((a) => a.unlocked).length

  return (
    <div className="mx-auto w-full max-w-[430px] px-4 pb-28">
      {/*
        ⚠️ 这里**不再有「🪙 现在一共有 N」那张余额大卡**。
        全局顶栏（`App.tsx` 的 sticky header）已经常驻显示同一个数，
        同一屏里同一个数出现两次，孩子反而不知道该看哪个。
        这一页的职责是「这些分是怎么来的 / 攒到了哪些成就」，
        余额只在顶栏说一次。
        （e2e-check 有断言守着；同一条规矩也适用于兑换页和农场卡。）
      */}
      <header className="pt-safe pt-4">
        <h1 className="font-display text-xl font-extrabold text-ink-900">我的积分</h1>
      </header>

      {/* ================= 7 日柱状图 ================= */}
      <section className="surface mt-4 border border-sky-300 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-base font-extrabold text-ink-900">最近 7 天赚到的分</h2>
          <span className="tnum text-xs font-bold text-ink-500">
            共 +{week.reduce((s, d) => s + d.total, 0)}
          </span>
        </div>
        <div className="mt-4 flex h-[132px] items-end justify-between gap-1.5">
          {week.map((d) => {
            const h = week.max > 0 ? (d.total / week.max) * 100 : 0
            return (
              <div key={d.key} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <span
                  className={clsx(
                    'tnum text-[10px] font-extrabold',
                    d.total > 0 ? 'text-ink-700' : 'text-ink-300',
                  )}
                >
                  {d.total > 0 ? d.total : ''}
                </span>
                <div className="flex h-[76px] w-full items-end">
                  <div
                    className={clsx(
                      'w-full rounded-t-lg border border-b-0 transition-all duration-500',
                      d.isToday ? 'border-sun-500 bg-sun-300' : 'border-sky-400 bg-sky-300',
                      d.total === 0 && 'border-ink-100 bg-ink-100',
                    )}
                    style={{ height: `${Math.max(d.total > 0 ? 10 : 4, h)}%` }}
                  />
                </div>
                <span
                  className={clsx(
                    'text-[10px] font-bold',
                    d.isToday ? 'text-sun-600' : 'text-ink-500',
                  )}
                >
                  {d.label}
                </span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ================= 成就 ================= */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden className="text-xl">
            🏆
          </span>
          <h2 className="font-display text-lg font-extrabold text-ink-900">我的成就</h2>
          <span className="tnum rounded-pill bg-sun-200 px-2 py-0.5 text-xs font-extrabold text-sun-700">
            {unlocked}/{achievements.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {achievements.map((a) => (
            <div
              key={a.id}
              title={a.desc}
              className={clsx(
                'surface flex min-h-[104px] flex-col items-center justify-center gap-1 border p-2 text-center',
                a.unlocked
                  ? clsx(a.border, a.bg)
                  : 'border-dashed border-ink-300 bg-white/60 opacity-70',
              )}
            >
              <span className={clsx('text-3xl', a.unlocked ? 'anim-bounce-in' : 'grayscale')}>
                {a.unlocked ? a.emoji : '🔒'}
              </span>
              <span
                className={clsx(
                  'font-display text-[11px] font-extrabold leading-tight',
                  a.unlocked ? 'text-ink-900' : 'text-ink-500',
                )}
              >
                {a.name}
              </span>
              <span className="tnum text-[10px] font-bold text-ink-500">
                {a.progressText}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 积分流水 ================= */}
      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <span aria-hidden className="text-xl">
            📜
          </span>
          <h2 className="font-display text-lg font-extrabold text-ink-900">积分流水</h2>
        </div>
        {ledger.length === 0 ? (
          <div className="surface-paper p-4 text-sm font-bold text-ink-500">
            还没有记录，去完成一个任务吧 ✨
          </div>
        ) : (
          <>
            <ul className="space-y-2">
              {ledger.slice(0, visibleCount).map((e) => (
                <LedgerRow key={e.id} entry={e} />
              ))}
            </ul>
            {ledger.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="btn active:btn-press mt-3 w-full rounded-btn border border-ink-200 bg-white py-2.5 text-sm font-extrabold text-ink-700"
              >
                再看早一点的记录（还有 {ledger.length - visibleCount} 条）
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}

/* ============================================================
   流水行
   ============================================================ */

const SOURCE: Record<LedgerSource, { emoji: string; label: string }> = {
  task: { emoji: '✅', label: '完成任务' },
  checkin: { emoji: '📅', label: '签到' },
  checkin_bonus: { emoji: '🎁', label: '签到奖励' },
  farm_plant: { emoji: '🌱', label: '买种子' },
  farm_harvest: { emoji: '🌾', label: '农场收入' },
  farm_feed: { emoji: '🐣', label: '喂食' },
  farm_shear: { emoji: '✂️', label: '互动' },
  farm_purchase: { emoji: '🛒', label: '农场支出' },
  farm_market: { emoji: '🏪', label: '市场卖出' },
  redeem: { emoji: '🎁', label: '兑换' },
  streak_bonus: { emoji: '🔥', label: '连续奖励' },
  manual_adjust: { emoji: '🔧', label: '手动调整' },
}

function LedgerRow({ entry }: { entry: LedgerEntry }) {
  const meta = SOURCE[entry.source] ?? { emoji: '🪙', label: '积分' }
  const positive = entry.delta > 0
  const zero = entry.delta === 0
  return (
    <li className="surface flex items-center gap-3 border border-ink-100 bg-white p-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ink-100/60 text-xl">
        {meta.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-ink-900">{entry.memo}</p>
        <p className="text-[11px] font-bold text-ink-500">
          {meta.label} · {humanizeAgo(entry.createdAt)}
        </p>
      </div>
      <span
        className={clsx(
          'tnum shrink-0 font-display text-lg font-extrabold',
          zero ? 'text-ink-300' : positive ? 'text-grass-600' : 'text-berry-500',
        )}
      >
        {zero ? '±0' : positive ? `+${entry.delta}` : String(entry.delta)}
      </span>
    </li>
  )
}

/* ============================================================
   7 日汇总
   ============================================================ */

interface DayBar {
  key: string
  label: string
  total: number
  isToday: boolean
}

function buildWeek(
  ledger: LedgerEntry[],
  todayKey: string,
): DayBar[] & { max: number } {
  const totals = new Map<string, number>()
  for (const e of ledger) {
    if (e.delta <= 0) continue
    const key = dateKeyOf(e.createdAt)
    totals.set(key, (totals.get(key) ?? 0) + e.delta)
  }
  const days: DayBar[] = []
  for (let i = 6; i >= 0; i--) {
    const key = addDays(todayKey, -i)
    const d = new Date(`${key}T12:00:00`)
    days.push({
      key,
      label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
      total: totals.get(key) ?? 0,
      isToday: key === todayKey,
    })
  }
  const max = days.reduce((m, d) => Math.max(m, d.total), 0)
  return Object.assign(days, { max })
}

function dateKeyOf(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/* ============================================================
   成就推导
   ============================================================ */

interface Achievement {
  id: string
  name: string
  emoji: string
  desc: string
  unlocked: boolean
  progressText: string
  bg: string
  border: string
}

function buildAchievements(input: {
  completedCount: number
  perfectCount: number
  streak: number
  checkIns: number
  farmTotals: { harvests: number; planted: number; sheared: number }
}): Achievement[] {
  const { completedCount, perfectCount, streak, checkIns, farmTotals } = input

  const tiers = [
    { n: 10, name: '小试牛刀', emoji: '🌱', bg: 'bg-grass-100', border: 'border-grass-300' },
    { n: 50, name: '任务高手', emoji: '🌳', bg: 'bg-grass-100', border: 'border-grass-300' },
    { n: 200, name: '任务大师', emoji: '🏔️', bg: 'bg-grass-100', border: 'border-grass-300' },
  ]
  let taskAch: Achievement
  const next = tiers.find((t) => completedCount < t.n)
  if (next) {
    taskAch = {
      id: 'task-count',
      name: next.name,
      emoji: next.emoji,
      desc: `累计完成 ${next.n} 个任务`,
      unlocked: false,
      progressText: `${completedCount}/${next.n}`,
      bg: next.bg,
      border: next.border,
    }
  } else {
    const last = tiers[tiers.length - 1]
    taskAch = {
      id: 'task-count',
      name: last.name,
      emoji: last.emoji,
      desc: `累计完成 ${last.n} 个任务`,
      unlocked: true,
      progressText: `${completedCount} 个`,
      bg: last.bg,
      border: last.border,
    }
  }

  const streakGoal = 7
  const harvestGoal = 10
  const checkInGoal = 20

  return [
    taskAch,
    {
      id: 'perfect',
      name: '准时小达人',
      emoji: '⚡',
      desc: '准时完成任务',
      unlocked: perfectCount >= 5,
      progressText: `${Math.min(perfectCount, 5)}/5`,
      bg: 'bg-sky-100',
      border: 'border-sky-300',
    },
    {
      id: 'streak',
      name: '连续之火',
      emoji: '🔥',
      desc: `连续 ${streakGoal} 天完成任务`,
      unlocked: streak >= streakGoal,
      progressText: `${Math.min(streak, streakGoal)}/${streakGoal} 天`,
      bg: 'bg-tangerine-100',
      border: 'border-tangerine-300',
    },
    {
      id: 'harvest',
      name: '丰收小农夫',
      emoji: '🌾',
      desc: '在农场收获作物',
      unlocked: farmTotals.harvests >= harvestGoal,
      progressText: `${Math.min(farmTotals.harvests, harvestGoal)}/${harvestGoal} 次`,
      bg: 'bg-grass-100',
      border: 'border-grass-300',
    },
    {
      id: 'plant',
      name: '播种者',
      emoji: '🌱',
      desc: '种下第一颗种子',
      unlocked: farmTotals.planted >= 1,
      progressText: `${Math.min(farmTotals.planted, 1)}/1 次`,
      bg: 'bg-grass-100',
      border: 'border-grass-300',
    },
    {
      id: 'checkin',
      name: '签到之星',
      emoji: '📅',
      desc: `累计签到 ${checkInGoal} 天`,
      unlocked: checkIns >= checkInGoal,
      progressText: `${Math.min(checkIns, checkInGoal)}/${checkInGoal} 天`,
      bg: 'bg-grape-100',
      border: 'border-grape-300',
    },
    {
      id: 'shear',
      name: '动物好友',
      emoji: '🐑',
      desc: '和农场动物互动',
      unlocked: farmTotals.sheared >= 5,
      progressText: `${Math.min(farmTotals.sheared, 5)}/5 次`,
      bg: 'bg-berry-100',
      border: 'border-berry-300',
    },
  ]
}
