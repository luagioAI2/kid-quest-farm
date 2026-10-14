import type { ReactNode } from 'react'

/**
 * 设置页的小组件。
 *
 * 抽出来是因为设置页现在被拆成了两个文件（`SettingsPage.tsx` 和
 * `GamesSection.tsx`），`Card` 两边都要用。
 *
 * ⚠️ **不要在两个文件里各留一份 `Card`** —— 那是同一个事实存两份，
 * 改样式时必然只改一处，然后两块卡片长得不一样，而且**不报错**。
 * （`src/features/tasks/ui.tsx` 是同样的做法，可以对照。）
 */

export function Card({
  title,
  emoji,
  children,
}: {
  title: string
  emoji: string
  children: ReactNode
}) {
  return (
    <section className="surface p-4">
      <h2 className="mb-3 font-display text-lg font-extrabold text-ink-900">
        {emoji} {title}
      </h2>
      {children}
    </section>
  )
}
