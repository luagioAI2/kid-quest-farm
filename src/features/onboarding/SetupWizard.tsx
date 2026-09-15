import { useState } from 'react'
import { useApp } from '../../store/useApp'
import { AVATAR_CHOICES } from '../../domain/avatars'
import { Portal } from '../../components/Portal'
import { PinPad } from '../parent/ParentGate'

/* ============================================================
   新手引导 · 第一步：家长设置向导
   ------------------------------------------------------------
   为什么要它：这个 App 一打开就是「宝贝 🐻、密码 0000」的默认状态，
   家长不改也能用，但孩子看到的是别人的名字、家长区是个人都能进。
   引导把这三件事一次问清：**叫什么 / 长什么样 / 家长密码**。

   四条设计决定：
   1. **名字和头像先存本地，最后一步才落库。** 中途来回切步骤
      （上一步看一眼再回来）不会留下半截数据。
   2. **密码要输两遍。** 项目**没有找回入口** —— 家长手滑输错一位、
      自己又没记住，就再也进不去家长区（打不了分、改不了任务）。
      多一步确认远比事后救火便宜。两次不一致就从头再来。
   3. **密码可以「以后再说」。** 不强制，保持默认 0000，
      并在文案里说清后果（谁都能进家长区），家长自己在设置里改。
   4. **「重看」时把密码这一步整个拿掉。** 重看入口在设置页里是**不锁**的，
      而密码这一步会直接覆盖 `parentPin` —— 留着它，孩子点一下
      「重看引导」就能把家长密码改成自己设的，家长区从此形同虚设。
      所以 `replay` 模式下 STEPS 里根本没有 'pin'：重看只能看，不能改凭据。

   向导走完**不算引导结束** —— 后面还有给孩子的功能导览（见 ChildTour）。
   `onboardingDone` 由外层在导览结束时统一写。
   ============================================================ */

type Step = 'welcome' | 'profile' | 'pin' | 'done'

/** 首次引导：四步全走 */
const FIRST_ORDER: Step[] = ['welcome', 'profile', 'pin', 'done']
/** 重看：**没有密码这一步**（理由见文件头第 4 条） */
const REPLAY_ORDER: Step[] = ['welcome', 'profile', 'done']

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

  const STEPS = replay ? REPLAY_ORDER : FIRST_ORDER
  const [step, setStep] = useState<Step>('welcome')
  /** 名字先放本地，最后一步再落库（见文件头第 1 条） */
  const [name, setName] = useState(settings.childName)
  const [avatar, setAvatar] = useState(settings.avatar)

  /** 第一遍输的密码。`null` = 还没输过第一遍 */
  const [pinFirst, setPinFirst] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [pinErr, setPinErr] = useState('')

  const idx = STEPS.indexOf(step)
  const next = () => setStep(STEPS[Math.min(idx + 1, STEPS.length - 1)])
  const back = () => setStep(STEPS[Math.max(idx - 1, 0)])

  /** 进「完成」这一步时，把前面攒的设置一次性写下去 */
  const goDone = async () => {
    await updateSettings({ childName: name.trim() || '宝贝', avatar })
    setStep('done')
  }

  const submitPin = async (final?: string) => {
    const v = final ?? pin
    if (v.length < 4) return
    if (pinFirst == null) {
      setPinFirst(v)
      setPin('')
      setPinErr('')
      return
    }
    if (v !== pinFirst) {
      setPinErr('两次不一样，重新设一次吧')
      setPinFirst(null)
      setPin('')
      return
    }
    await updateSettings({ childName: name.trim() || '宝贝', avatar, parentPin: v })
    setPinErr('')
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
                  : '先花一分钟做三件事：给宝贝起个小名、选个头像、设一个家长密码。'}
                <br />
                {replay
                  ? '想改密码，回设置里的「规则」页改就行。'
                  : '设完之后，宝贝就能开始做任务赚积分啦。'}
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

          {step === 'pin' && (
            <div>
              <h1 className="font-display text-xl font-extrabold text-ink-900">
                设一个家长密码
              </h1>
              <p className="mt-2 text-sm font-bold leading-relaxed text-ink-600">
                打分、改任务、看数据都要输这个密码。
                <br />
                现在的默认密码是 <span className="font-extrabold text-berry-500">0000</span> ——
                谁都能进家长区，建议改掉。
              </p>

              <p className="mb-3 mt-5 text-center text-sm font-extrabold text-ink-700">
                {pinFirst == null ? '输入 4 位数字' : '再输一次，确认没记错'}
              </p>
              <PinPad value={pin} onChange={setPin} onSubmit={(v) => void submitPin(v)} />
              {pinErr && (
                <p className="mt-3 text-center text-sm font-bold text-berry-500">{pinErr}</p>
              )}
              <p className="mt-4 text-center text-xs font-bold leading-relaxed text-ink-500">
                这个密码<span className="text-berry-500">没有找回入口</span>，记牢一点。
              </p>
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
                接下来带宝贝认识一下四个页面 —— 一共四小步，随时可以跳过。
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
          {step === 'pin' && (
            <>
              <button
                type="button"
                onClick={() => void goDone()}
                className="btn min-h-[52px] shrink-0 rounded-2xl border border-ink-900/10 bg-white px-5 font-display font-extrabold text-ink-500 active:btn-press"
              >
                以后再说
              </button>
              {pinFirst != null && (
                <button
                  type="button"
                  onClick={() => {
                    setPinFirst(null)
                    setPin('')
                    setPinErr('')
                  }}
                  className="btn min-h-[52px] shrink-0 rounded-2xl border border-ink-900/10 bg-white px-5 font-display font-extrabold text-ink-500 active:btn-press"
                >
                  重设
                </button>
              )}
            </>
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
              onClick={next}
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
