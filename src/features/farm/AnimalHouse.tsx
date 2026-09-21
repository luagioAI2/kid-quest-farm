import { useState } from 'react'
import clsx from 'clsx'
import { useApp } from '@/store/useApp'
import { ANIMALS, produceUnitOf } from '@/domain/catalog'
import { humanizeMinutes } from '@/domain/time'
import {
  animalDefOf,
  animalMaturityProgress,
  animalMood,
  animalNextProduceMinutes,
  farmLevel,
  isAnimalMature,
} from '@/domain/farm'
import type { Animal, AnimalDef, AnimalMood } from '@/domain/types'
import { BottomSheet, CoinPill, GrowthBar, countdownText } from './farmUi'

type Tab = 'mine' | 'adopt'

const MOOD_FACE: Record<AnimalMood, string> = {
  happy: '😊',
  normal: '😐',
  hungry: '😫',
  sick: '🤒',
  old: '🧓',
  spent: '💤',
}

const MOOD_LABEL: Record<AnimalMood, string> = {
  happy: '很开心',
  normal: '还不错',
  hungry: '饿了',
  sick: '生病了',
  old: '快产完了',
  // 产够次数就停产，但动物还在 —— 用户 2026-09-15：「虽然鸡还在」
  spent: '已经产完了',
}

/** 动物小屋：领养 + 我的动物 */
export function AnimalHouse({
  open,
  onClose,
  now,
}: {
  open: boolean
  onClose: () => void
  /** 来自 useFarmTick 的当前时间，用于倒计时/进度刷新 */
  now: number
}) {
  const balance = useApp((s) => s.balance)
  const animals = useApp((s) => s.animals)
  const level = useApp((s) => s.farmTotals.harvests)
  const [tab, setTab] = useState<Tab>(animals.length > 0 ? 'mine' : 'adopt')
  const farmLv = farmLevel(level).level

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      emoji="🐾"
      title="动物小屋"
      headerRight={<CoinPill amount={balance} />}
    >
      <div className="mb-3 flex gap-2 rounded-full border border-ink-900/10 bg-white p-1">
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')}>
          🐾 我的动物
          {animals.length > 0 ? (
            <span className="tnum ml-1 rounded-full bg-grape-400 px-1.5 text-xs text-white">
              {animals.length}
            </span>
          ) : null}
        </TabButton>
        <TabButton active={tab === 'adopt'} onClick={() => setTab('adopt')}>
          ➕ 领养一只
        </TabButton>
      </div>

      {tab === 'mine' ? (
        animals.length === 0 ? (
          <EmptyBarn onAdopt={() => setTab('adopt')} />
        ) : (
          <ul className="space-y-3 pb-4">
            {animals.map((a) => (
              <MyAnimalCard key={a.id} animal={a} now={now} />
            ))}
          </ul>
        )
      ) : (
        <ul className="space-y-3 pb-4">
          {ANIMALS.map((def) => (
            <AdoptRow key={def.id} def={def} balance={balance} level={farmLv} />
          ))}
        </ul>
      )}
    </BottomSheet>
  )
}

/* ---------------- 领养 ---------------- */

function AdoptRow({ def, balance, level }: { def: AnimalDef; balance: number; level: number }) {
  const buyAnimal = useApp((s) => s.buyAnimal)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState(def.name)

  const locked = level < (def.unlockLevel ?? 1)
  const affordable = balance >= def.cost && !locked

  // 日收益估算：让家长/孩子直观看到"这笔投入多久回本"
  const perMinute =
    def.produceIntervalMinutes > 0 ? def.produceAmount / def.produceIntervalMinutes : 0
  const lifeHours = def.lifespanMinutes ? Math.round(def.lifespanMinutes / 60) : 0

  const confirm = async () => {
    const ok = await buyAnimal(def.id, name.trim() || def.name)
    if (ok) {
      setName(def.name)
      setNaming(false)
    }
  }

  return (
    <li
      className={clsx(
        'surface overflow-hidden',
        locked ? 'opacity-60' : !affordable && 'opacity-60 grayscale',
      )}
    >
      <div className="flex items-center gap-3 p-3">
        <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-sun-50">
          <span className="flex items-center text-2xl">
            {def.babyEmoji}
            <span className="mx-0.5 text-xs text-ink-500">→</span>
            {def.emoji}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="font-display text-lg font-extrabold text-ink-900">{def.name}</p>
            {def.fragility != null && def.fragility > 1 ? (
              <span className="text-[11px] font-bold text-berry-500">比较娇气</span>
            ) : null}
          </div>
          <p className="text-xs text-ink-500">🍼 {humanizeMinutes(def.matureMinutes)}长大</p>
          <p className="mt-0.5 text-sm text-ink-700">
            {def.produceEmoji} 每 {humanizeMinutes(def.produceIntervalMinutes)}产{' '}
            {def.produceAmount} {produceUnitOf(def.produceItemId)}
            {def.produceItemName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <CoinPill amount={def.cost} tone={affordable ? 'sun' : 'danger'} />
            {lifeHours > 0 ? (
              <span className="text-[11px] text-ink-500">
                能陪我们约 {Math.round(lifeHours / 24)} 天
              </span>
            ) : null}
            {perMinute > 0 ? (
              <span className="text-[11px] text-ink-500">
                每小时约产 {(perMinute * 60).toFixed(1)} {produceUnitOf(def.produceItemId)}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {locked ? (
        <div className="border-t-2 border-ink-900/5 bg-ink-100/50 p-3 text-center">
          <p className="text-sm font-bold text-ink-500">
            🔒 农场 {def.unlockLevel ?? 1} 级才能领养
          </p>
        </div>
      ) : naming ? (
        <div className="border-t-2 border-ink-900/5 bg-grass-50/60 p-3">
          <p className="mb-1.5 text-xs font-bold text-ink-700">给它起个名字吧</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 8))}
              placeholder={def.name}
              className="min-h-[44px] min-w-0 flex-1 rounded-2xl border border-ink-900/10 bg-white px-3 font-display font-bold text-ink-900 outline-none focus:border-grass-400"
            />
            <button
              type="button"
              onClick={() => void confirm()}
              className="btn min-h-[44px] shrink-0 rounded-2xl border border-grass-600/30 bg-grass-400 px-4 text-white active:btn-press"
            >
              🏡 带回家
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t-2 border-ink-900/5 p-2">
          <button
            type="button"
            disabled={!affordable}
            onClick={() => setNaming(true)}
            className={clsx(
              'btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border font-display font-extrabold',
              affordable
                ? 'border-grape-500/30 bg-grape-400 text-white active:btn-press'
                : 'cursor-not-allowed border-ink-900/10 bg-ink-100 text-ink-300',
            )}
          >
            {affordable ? '🐣 领养它' : `还差 ${def.cost - balance} 🪙`}
          </button>
        </div>
      )}
    </li>
  )
}

/* ---------------- 我的动物 ---------------- */

function MyAnimalCard({ animal, now }: { animal: Animal; now: number }) {
  const collectAnimal = useApp((s) => s.collectAnimal)
  const feedAnimal = useApp((s) => s.feedAnimal)
  const shearAnimal = useApp((s) => s.shearAnimal)
  const removeAnimal = useApp((s) => s.removeAnimal)
  const timeScale = useApp((s) => s.settings.farmClock.timeScale)

  const def = animalDefOf(animal)
  const mature = isAnimalMature(animal, now, timeScale)
  const mood = animalMood(animal, now, timeScale)
  const maturity = animalMaturityProgress(animal, now, timeScale)
  const nextMinutes = animalNextProduceMinutes(animal, now, timeScale)
  const hasProduce = animal.pendingProduce > 0
  const sick = mood === 'sick'
  const aging = mood === 'old'

  // ---- 已经离世 ----
  if (animal.deceased) {
    return (
      <li className="surface overflow-hidden opacity-80">
        <div className="flex items-center gap-3 p-4">
          <div className="grid size-[68px] shrink-0 place-items-center rounded-2xl border border-ink-900/10 bg-ink-100">
            <span className="text-4xl">🕊️</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-extrabold text-ink-900">
              {animal.name}
            </p>
            <p className="mt-0.5 text-sm text-ink-500">
              {animal.lastEvent ?? '它陪了我们好久，安安静静地睡着了。'}
            </p>
          </div>
        </div>
        <div className="border-t-2 border-ink-900/5 p-2">
          <button
            type="button"
            onClick={() => void removeAnimal(animal.id)}
            className="btn flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-ink-900/10 bg-white font-display font-extrabold text-ink-500 active:btn-press"
          >
            好好道别 🕯️
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="surface overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <div
          className={clsx(
            'relative grid size-[68px] shrink-0 place-items-center rounded-2xl border border-ink-900/10',
            sick ? 'bg-berry-50' : mature ? 'bg-grass-50' : 'bg-sun-50',
          )}
        >
          <span
            className={clsx(
              'text-4xl',
              sick ? 'anim-wiggle' : mature ? 'anim-float' : 'anim-wiggle',
            )}
          >
            {mature ? (def?.emoji ?? '🐾') : (def?.babyEmoji ?? '🐣')}
          </span>
          <span
            className="absolute -bottom-1 -right-1 grid size-7 place-items-center rounded-full border border-white bg-white text-lg shadow-flat"
            aria-label={`状态：${MOOD_LABEL[mood]}`}
          >
            {MOOD_FACE[mood]}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="truncate font-display text-lg font-extrabold text-ink-900">
              {animal.name}
            </p>
            {!mature ? <span className="text-xs text-ink-500">幼崽</span> : null}
            {sick ? (
              <span className="rounded-full bg-berry-200 px-2 text-xs font-bold text-berry-600">
                生病
              </span>
            ) : null}
            {aging ? (
              <span className="rounded-full bg-sun-200 px-2 text-xs font-bold text-ink-700">
                年纪大了
              </span>
            ) : null}
          </div>

          {sick ? (
            <p className="mt-1 text-sm font-bold text-berry-600">
              它不舒服，喂一喂或者摸摸它就会好起来
            </p>
          ) : !mature ? (
            <div className="mt-1">
              <GrowthBar value={maturity} tone="sun" />
              <p className="tnum mt-1 text-xs text-ink-500">
                长大还要 {countdownText(nextMinutes).replace('还要 ', '')}
              </p>
            </div>
          ) : hasProduce ? (
            <p className="tnum mt-1 text-sm font-bold text-grape-500">
              攒了 {animal.pendingProduce} {produceUnitOf(def?.produceItemId)}{' '}
              {def?.produceEmoji ?? ''}
            </p>
          ) : (
            <p className="tnum mt-1 text-sm text-ink-500">
              {def?.produceEmoji} {countdownText(nextMinutes)}
            </p>
          )}

          {animal.lastEvent && !sick ? (
            <p className="mt-1 truncate text-[11px] text-ink-500">{animal.lastEvent}</p>
          ) : null}
        </div>
      </div>

      {hasProduce ? (
        <div className="border-t-2 border-ink-900/5 p-2">
          <button
            type="button"
            onClick={() => void collectAnimal(animal.id)}
            className="btn anim-float flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl border border-grape-500/30 bg-gradient-to-b from-grape-300 to-grape-500 font-display text-lg font-extrabold text-white shadow-flat active:btn-press"
          >
            <span className="text-2xl">{def?.produceEmoji ?? '🎁'}</span>
            收下产出 +{animal.pendingProduce}
          </button>
        </div>
      ) : null}

      <div className="flex gap-2 border-t-2 border-ink-900/5 p-2">
        <button
          type="button"
          onClick={() => void feedAnimal(animal.id)}
          className={clsx(
            'btn flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-2xl border font-display font-extrabold active:btn-press',
            sick
              ? 'anim-pop border-berry-500/40 bg-berry-300 text-white'
              : 'border-tangerine-400/40 bg-tangerine-300 text-ink-900',
          )}
        >
          {sick ? '💊 喂它吃药' : '🍽 喂一喂'}
        </button>
        <button
          type="button"
          onClick={() => void shearAnimal(animal.id)}
          className="btn flex min-h-[48px] flex-1 items-center justify-center gap-1 rounded-2xl border border-berry-400/40 bg-berry-200 font-display font-extrabold text-ink-900 active:btn-press"
        >
          🤗 摸摸它
        </button>
      </div>
    </li>
  )
}

/* ---------------- 空状态 ---------------- */

function EmptyBarn({ onAdopt }: { onAdopt: () => void }) {
  return (
    <div className="surface mb-4 flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="relative grid size-28 place-items-center">
        <span className="absolute inset-0 rounded-full bg-gradient-to-b from-sky-100 to-grass-100" />
        <span className="anim-float relative text-6xl">🏚️</span>
        <span className="absolute -right-1 top-0 text-2xl anim-sparkle">✨</span>
      </div>
      <p className="font-display text-lg font-extrabold text-ink-900">还没有小动物</p>
      <p className="text-sm text-ink-500">去领养一只吧，它会给你带来礼物哦</p>
      <button
        type="button"
        onClick={onAdopt}
        className="btn mt-1 flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-grape-500/30 bg-grape-400 px-6 font-display text-lg font-extrabold text-white active:btn-press"
      >
        🐤 去领养
      </button>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'btn flex min-h-[44px] flex-1 items-center justify-center rounded-full text-[15px] active:btn-press',
        active ? 'bg-grape-400 text-white shadow-flat' : 'bg-transparent text-ink-500',
      )}
    >
      {children}
    </button>
  )
}
