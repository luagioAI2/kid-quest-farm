import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, BackupFile } from '../../domain/types'
import { useApp } from '../../store/useApp'
import { DEFAULT_PROFIT_RATIO } from '../../domain/catalog'
import { humanizeAgo } from '../../domain/time'
import { saveBlob, shareOrDownload } from '../../platform/files'
// 复用家长端同一个 PinPad，不要在这里再抄一份 —— 之前抄出来的副本
// 带着"第 4 位自动提交读不到最新值"的 bug，两边各修一次很容易漏。
import { PinPad, ParentPinPanel } from '../parent/ParentGate'

/* ============================================================
   家长设置 + 数据导出/导入
   ------------------------------------------------------------
   导出走 JSON 全量快照，可在任何设备上恢复（单机优先，不依赖服务端）。
   ============================================================ */

type Tab = 'child' | 'rules' | 'data'

export default function SettingsPage({ onBack }: { onBack: () => void }) {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const exportBackup = useApp((s) => s.exportBackup)
  const importBackup = useApp((s) => s.importBackup)
  const resetAll = useApp((s) => s.resetAll)
  const pushToast = useApp((s) => s.pushToast)

  const [tab, setTab] = useState<Tab>('child')
  const [locked, setLocked] = useState(true)
  const [dataLocked, setDataLocked] = useState(true)
  const [pin, setPin] = useState('')
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /** 家长锁：默认锁定写入型操作，避免孩子乱改规则 */
  const needsPin = !!settings.parentPin
  const gateOpen = !needsPin || !locked

  // 切到 data tab 时自动上锁，防止孩子趁家长没注意时导出/恢复/清空
  useEffect(() => {
    if (tab === 'data') setDataLocked(true)
  }, [tab])

  const handleExport = useCallback(async () => {
    const data = (await exportBackup()) as BackupFile
    const name = `小任务农场-备份-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    const json = JSON.stringify(data, null, 2)
    const ok = await shareOrDownload(name, json)
    pushToast(
      ok
        ? { kind: 'success', title: '备份已导出', detail: name, emoji: '💾' }
        : { kind: 'warn', title: '导出失败', detail: '请重试', emoji: '⚠️' },
    )
  }, [exportBackup, pushToast])

  const handleImportFile = useCallback(
    async (file: File) => {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        pushToast({ kind: 'warn', title: '文件读不出来', detail: '不是有效的备份文件', emoji: '⚠️' })
        return
      }
      const res = await importBackup(parsed)
      pushToast({
        kind: res.ok ? 'success' : 'warn',
        title: res.ok ? '数据已恢复' : '恢复失败',
        detail: res.message,
        emoji: res.ok ? '✅' : '⚠️',
      })
    },
    [importBackup, pushToast],
  )

  const downloadSample = useCallback(() => {
    void saveBlob(
      '小任务农场-备份示例.json',
      JSON.stringify({ app: 'kid-quest-farm', version: 1, exportedAt: Date.now(), data: {} }, null, 2),
    )
  }, [])

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-900/10 bg-paper/95 px-4 py-3 backdrop-blur">
        <button
          onClick={onBack}
          className="btn flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl shadow-flat active:btn-press"
          aria-label="返回"
        >
          ←
        </button>
        <h1 className="font-display text-2xl font-extrabold text-ink-900">⚙️ 设置</h1>
      </header>

      <nav className="flex gap-2 overflow-x-auto px-4 py-3 no-scrollbar">
        {(
          [
            ['child', '👦 孩子'],
            ['rules', '📏 规则'],
            ['data', '💾 数据'],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={
              'btn shrink-0 rounded-full px-5 py-2.5 text-base font-bold ' +
              (tab === k
                ? 'bg-sun-300 text-ink-900 shadow-flat'
                : 'bg-white text-ink-500 shadow-flat')
            }
          >
            {label}
          </button>
        ))}
      </nav>

      <main className="space-y-4 px-4 pb-10">
        {tab === 'child' && (
          <>
            <Card title="孩子的小名" emoji="✏️">
              <input
                value={settings.childName}
                onChange={(e) => void updateSettings({ childName: e.target.value })}
                maxLength={12}
                className="w-full rounded-2xl border-3 border-ink-900/10 bg-paper-2 px-4 py-3 text-lg font-bold outline-none focus:border-sky-400"
                placeholder="宝贝"
              />
            </Card>

            <Card title="选一个头像" emoji="🎭">
              <div className="flex flex-wrap gap-2">
                {['🐻', '🐰', '🐱', '🐶', '🦊', '🐼', '🐨', '🦁', '🐯', '🐸', '🐵', '🦄'].map(
                  (a) => (
                    <button
                      key={a}
                      onClick={() => void updateSettings({ avatar: a })}
                      className={
                        'btn h-14 w-14 rounded-2xl text-3xl shadow-flat transition ' +
                        (settings.avatar === a
                          ? 'scale-110 bg-sun-300 ring-4 ring-sun-400'
                          : 'bg-white')
                      }
                    >
                      {a}
                    </button>
                  ),
                )}
              </div>
            </Card>

            <Card title="新的一天从几点开始" emoji="🌅">
              <p className="mb-3 text-sm text-ink-500">
                比如设成早上 4 点，孩子熬夜到 1 点完成的作业还算作「昨天」，不会被判定为超时过期。
              </p>
              <div className="flex flex-wrap gap-2">
                {[0, 2, 3, 4, 5, 6].map((h) => (
                  <button
                    key={h}
                    onClick={() => void updateSettings({ dayStartHour: h })}
                    className={
                      'btn rounded-full px-4 py-2 font-bold shadow-flat ' +
                      (settings.dayStartHour === h ? 'bg-sky-300 text-ink-900' : 'bg-white text-ink-500')
                    }
                  >
                    {h === 0 ? '0 点' : `凌晨 ${h} 点`}
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === 'rules' && (
          <>
            {needsPin && locked ? (
              <Card title="请输入家长密码" emoji="🔒">
                <PinPad
                  value={pin}
                  onChange={setPin}
                  onSubmit={(final) => {
                    const candidate = final ?? pin
                    if (candidate === settings.parentPin) {
                      setLocked(false)
                      setPin('')
                    } else {
                      pushToast({ kind: 'warn', title: '密码不对哦', emoji: '🔒' })
                      setPin('')
                    }
                  }}
                />
              </Card>
            ) : (
              <>
                <Toggle
                  label="超时扣分"
                  hint="关闭后，所有任务超时也都给满分"
                  emoji="⏱️"
                  checked={settings.overtimeEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ overtimeEnabled: v })}
                />
                <Toggle
                  label="质量加分"
                  hint="完成得好可以拿到额外积分"
                  emoji="🌟"
                  checked={settings.qualityBonusEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ qualityBonusEnabled: v })}
                />
                <Card title="质量加分的门槛" emoji="🤔">
                  <div className="flex gap-2">
                    {(
                      [
                        ['ok', '🙂 不错以上'],
                        ['great', '🤩 只有特别棒'],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        disabled={!gateOpen}
                        onClick={() => void updateSettings({ qualityBonusThreshold: v })}
                        className={
                          'btn flex-1 rounded-2xl px-3 py-3 font-bold shadow-flat disabled:opacity-50 ' +
                          (settings.qualityBonusThreshold === v
                            ? 'bg-grass-300 text-ink-900'
                            : 'bg-white text-ink-500')
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </Card>

                <Toggle
                  label="连续完成奖励"
                  hint={`每连击一天多给 ${settings.streakBonusPerDay} 分，最多 ${settings.streakBonusCap} 分`}
                  emoji="🔥"
                  checked={settings.streakBonusEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ streakBonusEnabled: v })}
                />

                <Toggle
                  label="家长确认后才发积分"
                  hint="孩子点「我做完啦」只是交上来，要用密码确认质量和奖励才真正到账"
                  emoji="📮"
                  checked={settings.parentReviewEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ parentReviewEnabled: v })}
                />

                <Toggle
                  label="保护家长操作"
                  hint="开启后，改任务、改兑换品、审核打分都需要密码"
                  emoji="🔐"
                  checked={settings.protectParentActions}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ protectParentActions: v })}
                />

                <Toggle
                  label="开启兑换"
                  hint="孩子可以用积分换零食、礼物、玩平板等（家长可随时加或改）"
                  emoji="🎁"
                  checked={settings.redeemEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ redeemEnabled: v })}
                />

                <Toggle
                  label="农场随机事件"
                  hint="庄稼可能丰收也可能减产，动物会生病。关掉之后收成完全稳定"
                  emoji="🎲"
                  checked={settings.farmEventsEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ farmEventsEnabled: v })}
                />

                {/* 音效 / 震动。这两个字段一直在 settings 里、默认开着，
                    但之前**设置页没有开关** —— 也就是说家长根本关不掉。
                    反馈统一挂在 store 的 pushToast 上（见 useApp.ts）。 */}
                <Toggle
                  label="音效"
                  hint="完成任务、积分到账、有情况时会响一声（含进入 App 的欢迎音）"
                  emoji="🔊"
                  checked={settings.soundEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ soundEnabled: v })}
                />

                <Toggle
                  label="震动"
                  hint="完成任务、积分到账时轻震一下。装到手机上才有效果"
                  emoji="📳"
                  checked={settings.hapticsEnabled}
                  disabled={!gateOpen}
                  onChange={(v) => void updateSettings({ hapticsEnabled: v })}
                />
                <p className="-mt-1 px-4 text-xs font-bold leading-snug text-ink-500">
                  💡 周末和节假日的收成会悄悄多一些，这个不用告诉孩子 —— 他自己会慢慢感觉到。
                </p>

                <Card title="每一轮最多能赚多少" emoji="📈">
                  <p className="mb-3 text-sm text-ink-500">
                    种子和动物的价格是定好的，孩子把产出卖完，总收入不会超过成本的这个比例。
                    调低 = 细水长流；调高 = 回报更痛快，但农场币膨胀也更快。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {([0.2, 0.4, 0.6, 0.8, 1.0, 1.2] as number[]).map((v) => {
                      const cur = settings.profitRatio ?? DEFAULT_PROFIT_RATIO
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={!gateOpen}
                          onClick={() => void updateSettings({ profitRatio: v })}
                          className={
                            'btn rounded-full px-4 py-2 font-bold shadow-flat disabled:opacity-50 ' +
                            (cur === v ? 'bg-grass-300 text-ink-900' : 'bg-white text-ink-500')
                          }
                        >
                          {Math.round(v * 100)}%
                        </button>
                      )
                    })}
                  </div>
                  <p className="tnum mt-2 text-xs font-bold leading-snug text-ink-500">
                    当前：孩子每花 10 🪙 成本，最多能收回{' '}
                    {(10 * (1 + (settings.profitRatio ?? DEFAULT_PROFIT_RATIO))).toFixed(0)} 🌾。
                    改这个会同时改变所有种子和动物的上限，已经种下的也按新上限算。
                  </p>
                </Card>

                <Card title="农场的时钟走得有多快" emoji="⏩">
                  <p className="mb-3 text-sm text-ink-500">
                    真实 1 分钟 = 农场里的多少分钟。调快一点，孩子不用等太久就能看到变化；
                    调成 1 倍就是和现实一样的时间感。
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        [1, '1× 真实'],
                        [6, '6× 快点'],
                        [12, '12× 很快'],
                        [24, '24× 超快'],
                        [60, '60× 一小时一天'],
                      ] as [number, string][]
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        disabled={!gateOpen}
                        onClick={() =>
                          void updateSettings({
                            farmClock: { ...settings.farmClock, timeScale: v },
                          })
                        }
                        className={
                          'btn rounded-full px-4 py-2 font-bold shadow-flat disabled:opacity-50 ' +
                          (settings.farmClock.timeScale === v
                            ? 'bg-grass-300 text-ink-900'
                            : 'bg-white text-ink-500')
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <Toggle
                    label="显示农场时间"
                    hint="在农场顶部显示「农场第 N 天 · HH:MM」"
                    emoji="🕐"
                    checked={settings.farmClock.showClock}
                    disabled={!gateOpen}
                    onChange={(v) =>
                      void updateSettings({ farmClock: { ...settings.farmClock, showClock: v } })
                    }
                  />
                </Card>

                <Card title="家长密码" emoji="🔑">
                  <p className="mb-3 text-sm text-ink-500">
                    设一个 4 位数字，防止孩子自己改规则。留空表示不设密码。
                  </p>
                  <PinSetting
                    current={settings.parentPin}
                    disabled={!gateOpen}
                    onSave={(p) => {
                      void updateSettings({ parentPin: p || undefined })
                      pushToast({
                        kind: 'success',
                        title: p ? '密码已设置' : '已取消密码',
                        emoji: '🔑',
                      })
                    }}
                  />
                </Card>
              </>
            )}
          </>
        )}

        {tab === 'data' && (
          <>
            {needsPin && dataLocked ? (
              <Card title="数据操作需要密码" emoji="🔒">
                <p className="mb-3 text-sm text-ink-500">
                  导出、恢复、清空数据都需要家长密码，防止孩子误操作。
                </p>
                <ParentPinPanel
                  title="请爸爸妈妈来一下"
                  hint="导出、恢复或清空数据，需要先输密码"
                  onPass={() => setDataLocked(false)}
                />
              </Card>
            ) : (
              <>
                <Card title="导出备份" emoji="💾">
                  <p className="mb-3 text-sm text-ink-500">
                    把所有任务、积分、农场数据打包成一个 JSON 文件。建议每周导出一次。
                  </p>
                  <button
                    onClick={() => void handleExport()}
                    className="btn w-full rounded-2xl bg-sky-300 py-4 text-lg font-extrabold text-ink-900 shadow-flat"
                  >
                    📤 导出到文件
                  </button>
                </Card>

                <Card title="从备份恢复" emoji="📥">
                  <p className="mb-3 text-sm text-ink-500">
                    ⚠️ 恢复会**覆盖**当前全部数据，请先导出一次现有数据。
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) void handleImportFile(f)
                      e.target.value = ''
                    }}
                  />
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="btn w-full rounded-2xl bg-white py-4 text-lg font-extrabold text-ink-900 shadow-flat"
                  >
                    📂 选择备份文件
                  </button>
                </Card>

                <Card title="备份格式说明" emoji="📄">
                  <p className="text-sm text-ink-500">
                    导出的是纯文本 JSON，包含任务定义、每日实例、积分流水、背包、农场和设置。
                    你可以自己保存到网盘，之后换手机或换浏览器都能导入回来。
                  </p>
                  <button
                    onClick={downloadSample}
                    className="btn mt-3 w-full rounded-2xl bg-paper-2 py-3 font-bold text-ink-500 shadow-flat"
                  >
                    下载一个空模板看看
                  </button>
                </Card>

                <Card title="危险操作" emoji="☠️">
                  {!confirmReset ? (
                    <>
                      <p className="mb-3 text-sm text-ink-500">
                        清空所有数据并重新开始。这个操作**无法撤销**。
                      </p>
                      <button
                        onClick={() => setConfirmReset(true)}
                        className="btn w-full rounded-2xl bg-berry-300 py-4 text-lg font-extrabold text-ink-900 shadow-flat"
                      >
                        🗑️ 清空全部数据
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="mb-3 font-bold text-berry-500">
                        真的要清空吗？所有积分、任务和农场都会消失！
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmReset(false)}
                          className="btn flex-1 rounded-2xl bg-white py-3 font-bold text-ink-500 shadow-flat"
                        >
                          我再想想
                        </button>
                        <button
                          onClick={() => {
                            void resetAll()
                            setConfirmReset(false)
                            pushToast({ kind: 'info', title: '已重新开始', emoji: '🌱' })
                          }}
                          className="btn flex-1 rounded-2xl bg-berry-500 py-3 font-bold text-white shadow-flat"
                        >
                          确认清空
                        </button>
                      </div>
                    </>
                  )}
                </Card>
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

/* ---------------- 小组件 ---------------- */

function Card({
  title,
  emoji,
  children,
}: {
  title: string
  emoji: string
  children: React.ReactNode
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

function Toggle({
  label,
  hint,
  emoji,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  emoji: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <section className="surface flex items-center gap-3 p-4">
      <span className="text-2xl">{emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="font-display text-base font-extrabold text-ink-900">{label}</div>
        <div className="text-sm text-ink-500">{hint}</div>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={
          'relative h-9 w-16 shrink-0 rounded-full transition-colors disabled:opacity-50 ' +
          (checked ? 'bg-grass-400' : 'bg-ink-300')
        }
      >
        <span
          className={
            'absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ' +
            (checked ? 'left-8' : 'left-1')
          }
        />
      </button>
    </section>
  )
}

function PinSetting({
  current,
  onSave,
  disabled,
}: {
  current?: string
  onSave: (pin: string) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(current ?? '')
  const valid = draft === '' || /^\d{4}$/.test(draft)
  return (
    <div className="space-y-3">
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        inputMode="numeric"
        placeholder="4 位数字，留空取消"
        className="w-full rounded-2xl border-3 border-ink-900/10 bg-paper-2 px-4 py-3 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-sky-400"
      />
      <button
        disabled={!valid || disabled}
        onClick={() => onSave(draft)}
        className="btn w-full rounded-2xl bg-sun-300 py-3 font-extrabold text-ink-900 shadow-flat disabled:opacity-50"
      >
        保存密码
      </button>
    </div>
  )
}

export { humanizeAgo }
export type { AppSettings }
