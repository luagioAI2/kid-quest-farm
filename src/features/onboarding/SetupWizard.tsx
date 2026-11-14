import { useState } from 'react'
import { useApp } from '../../store/useApp'
import { AVATAR_CHOICES } from '../../domain/avatars'
import { Portal } from '../../components/Portal'

/* ============================================================
   新手引导 · 第一步：家长设置向导
   ------------------------------------------------------------
   只问两件事：**宝贝叫什么 / 长什么样**。

   ## 为什么不再问家长密码（2026-10-30）

   用户原话：「新号不要在引导前就要求设置家长密码，需要用的时候才要求
   第一次设置。」

   以前这一步是「设一个家长密码」，还配了个「以后再说」——
   而默认密码是 0000，等于每个新装的 App 都带着一个人人都知道的密码；
   选「以后再说」又等于完全不设防。两头都不对。

   现在：默认**没有密码**，引导只问小名和头像。家长第一次进家长区
   （审核、加任务、规则/游戏/数据栏、心愿家长区）时，闸门才当场要求
   设一个 4 位数字（输两遍确认）。见 `features/parent/ParentGate.tsx`。

   ## 两条仍然成立的设计决定

   1. **名字和头像先存本地，最后一步才落库。** 中途来回切步骤
      （上一步看一眼再回来）不会留下半截数据。
   2. **「重看」时不能改任何凭据。** 重看入口在设置页里是**不锁**的，
      而家长密码一旦在这里能被改，孩子点一下「重看引导」就能把它换成
      自己设的 —— 所以重看模式压根不碰 `parentPin`（现在这一步已经没了，
      这条约束仍然写在 `replay` 分支里，别再把设置密码加回来）。

   向导走完**不算引导结束** —— 后面还有七步功能导览
   （4 步给孩子 + 2 步给家长，见 ChildTour）。
   `onboardingDone` 由外层在导览结束时统一写。
   ============================================================ */

type Step = 'welcome' | 'profile' | 'done'

/** 首次引导与「重看」走同一套步骤 —— 没有密码那一步，也就没有区别了 */
const STEPS: Step[] = ['welcome', 'profile', 'done']

export function SetupWizard({
  onFinish,
  replay = false,
}: {
  onFinish: () => void
  /** true = 从设置页点「重看新手引导」进来的，不是首次引导 */
  replay?: boolean
}) {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)

  const [step, setStep] = useState<Step>('welcome')
  /** 名字先放本地，最后一步再落库（见文件头第 1 条） */
  const [name, setName] = useState(settings.childName)
  const [avatar, setAvatar] = useState(settings.avatar)

  const idx = STEPS.indexOf(step)
  const next = () => setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)])
  const back = () => setStep(STEPS[Math.max(idx - 1, 0)])

  /** 进「完成」这一步时，把前面攒的设置一次性写下去 */
  const goDone = async () => {
    await updateSettings({ childName: name.trim() || '宝贝', avatar })
    setStep('done')
  }

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[60] overflow-y-auto bg-paper"
        data-step={step}
      >
        <div className="mx-auto flex min-h-full max-w-2xl flex-col px-5 pb-safe pt-safe">
        {/* 进度点：让家长知道「还有几步」 */}
        <div className="flex items-center justify-center gap-2 pt-6">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={
                'h-2 rounded-full transition-all ' +
                (i === idx ? 'w-6 bg-sun-500' : i < idx ? 'w-2 bg-grass-400' : 'w-2 bg-ink-300')
              }
            />
          ))}
        </div>

        <div className="flex flex-1 flex-col justify-center py-6">
          {step === 'welcome' && (
            <div className="text-center">
              <div className="anim-float mx-auto grid h-24 w-24 place-items-center rounded-full bg-sun-200 text-5xl shadow-flat">
                🌾
              </div>
              <h1 className="mt-5 font-display text-2xl font-extrabold text-ink-900">
                {replay ? '再看一遍引导' : '欢迎来到小任务农场'}
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm font-bold leading-relaxed text-ink-600">
                {replay
                  ? '这次只过小名、头像和四个页面 —— 家长密码不会被动到。'
                  : '先花半分钟做两件事：给宝贝起个小名、选个头像。'}
                <br />
                {replay
                  ? '想改密码，回设置里的「规则」页改就行。'
                  : '家长密码不用现在设 —— 第一次用到家长区时会提醒你设。'}
              </p>
            </div>
          )}

          {step === 'profile' && (
            <div>
              <h1 className="font-display text-xl font-extrabold text-ink-900">
                宝贝叫什么、长什么样？
              </h1>
              <p className="mt-2 text-sm font-bold text-ink-500">
                小名会显示在最上面那一条，随时能在设置里改。
              </p>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={12}
                placeholder="宝贝"
                aria-label="孩子的小名"
                className="mt-5 w-full rounded-2xl border border-ink-900/10 bg-paper-2 px-4 py-3 text-lg font-bold text-ink-900 outline-none focus:border-sky-400"
              />

              <p className="mb-2 mt-5 text-xs font-extrabold text-ink-500">选一个头像</p>
              <div className="flex flex-wrap gap-2">
                {AVATAR_CHOICES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAvatar(a)}
                    aria-label={`头像 ${a}`}
                    aria-pressed={avatar === a}
                    className={
                      'btn h-14 w-14 rounded-2xl text-3xl shadow-flat transition active:btn-press ' +
                      (avatar === a ? 'scale-110 bg-sun-300 ring-4 ring-sun-400' : 'bg-white')
                    }
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="anim-bounce-in mx-auto grid h-24 w-24 place-items-center rounded-full bg-grass-200 text-5xl shadow-flat">
                ✅
              </div>
              <h1 className="mt-5 font-display text-2xl font-extrabold text-ink-900">
                都设好啦
              </h1>
              <p className="mx-auto mt-3 max-w-sm text-sm font-bold leading-relaxed text-ink-600">
                接下来带宝贝认识四个页面，最后两小步是给爸爸妈妈的 —— 一共六小步，随时可以跳过。
              </p>
            </div>
          )}
        </div>

        {/* 底部操作区 */}
        <div className="flex items-center gap-2 pb-6">
          {step === 'profile' && (
            <button
              type="button"
              onClick={back}
              className="btn min-h-[52px] shrink-0 rounded-2xl border border-ink-900/10 bg-white px-5 font-display font-extrabold text-ink-500 active:btn-press"
            >
              上一步
            </button>
          )}

          {step === 'welcome' && (
            <button
              type="button"
              onClick={next}
              className="btn min-h-[56px] w-full rounded-2xl bg-gradient-to-b from-grass-300 to-grass-500 font-display text-lg font-extrabold text-white shadow-flat active:btn-press"
            >
              开始设置
            </button>
          )}
          {step === 'profile' && (
            <button
              type="button"
              onClick={() => void goDone()}
              className="btn min-h-[56px] flex-1 rounded-2xl bg-gradient-to-b from-grass-300 to-grass-500 font-display text-lg font-extrabold text-white shadow-flat active:btn-press"
            >
              下一步
            </button>
          )}
          {step === 'done' && (
            <button
              type="button"
              onClick={onFinish}
              className="btn min-h-[56px] w-full rounded-2xl bg-gradient-to-b from-sun-300 to-sun-500 font-display text-lg font-extrabold text-ink-900 shadow-flat active:btn-press"
            >
              带宝贝看一遍
            </button>
          )}
        </div>
      </div>
      </div>
    </Portal>
  )
}
