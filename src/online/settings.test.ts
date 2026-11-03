import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, DEFAULT_SETTINGS, getMeta, loadSettings, saveSettings, setMeta } from '../db/db'
import { setSession } from '../api/session'
import type { AppSettings } from '../domain/types'
import { appDayKey } from '../domain/time'
import {
  USAGE_PUSH_EVERY_SEC,
  cloudPayload,
  isUsageOnly,
  noteUsagePushed,
  oSaveSettings,
  pullSettings,
  pushUsageBestEffort,
  resetSettingsSyncState,
  settingsFromCloud,
  shouldPushUsage,
} from './settings'

/* ============================================================
   在线版 · 家长设置上云
   ------------------------------------------------------------
   这一层错了也都**不报错**：
     · 用量（`gameClock`）**不上云** ⇒ 重装 App / 换台设备，每日限时重置；
     · 用量走普通设置的「写穿 + 失败回退」⇒ 断网时时长不累计 ⇒ 孩子无限玩；
     · 拉取时用云端那份盖掉本机 `gameClock` ⇒ 拉一次退回去一点，额度用不完；
     · 用量一分钟推一次 ⇒ 请求打满（所以有节流）；
     · 云端为空时什么都不做 ⇒ 老账号的设置永远上不去（换台设备全丢）；
     · 读响应比写更晚回来还照用 ⇒ 刚存的设置被上一份读结果盖回去。

   真连服务端是 `scripts/_probe-settings-online.mjs` 的活。
   ============================================================ */

const getMock = vi.fn()
const saveMock = vi.fn()

vi.mock('../api/settings', () => ({
  settingsGet: () => getMock(),
  settingsSave: (payload: string, version: number) => saveMock(payload, version),
}))

/* ⚠️ `gameClock.day` 必须是**今天**（走 `appDayKey`，和 `mergeGameClock` 同一个口径）。
   写死一个日期的话，`mergeGameClock` 会把它当成「别的日子」归 0，
   下面的断言就全变成了在测 0 == 0。 */
const TODAY = appDayKey(Date.now(), DEFAULT_SETTINGS.dayStartHour)
const LOCAL: AppSettings = {
  ...DEFAULT_SETTINGS,
  childName: '小明',
  parentPin: '2468',
  gameClock: { day: TODAY, sec: 420 },
}

beforeEach(async () => {
  await db.meta.clear()
  resetSettingsSyncState()
  setSession(null)
  getMock.mockReset()
  saveMock.mockReset()
})

describe('cloudPayload：什么上云、什么不上云', () => {
  it('gameClock **也**上云 —— 否则重装 App 就把每日限时重置了', () => {
    const o = JSON.parse(cloudPayload(LOCAL)) as Record<string, unknown>
    expect(o.gameClock).toEqual(LOCAL.gameClock)
    expect(o.childName).toBe('小明')
  })

  it('parentPin **要**上云 —— 和备份那份清单不一样是有意的', () => {
    /* 备份会剥 PIN（文件会被发到微信 / 网盘），云端不剥
       （换台设备要能用同一个 PIN 开门）。
       把这两处「统一」的人，要么把 PIN 泄露进备份，要么让换机后开不了门。 */
    const o = JSON.parse(cloudPayload(LOCAL)) as Record<string, unknown>
    expect(o.parentPin).toBe('2468')
  })

  it('isUsageOnly：只碰 gameClock 才为真（真了就走「尽力而为」，不走写穿）', () => {
    expect(isUsageOnly({ gameClock: { day: TODAY, sec: 1 } })).toBe(true)
    expect(isUsageOnly({ gameClock: { day: TODAY, sec: 1 }, childName: 'x' })).toBe(false)
    expect(isUsageOnly({})).toBe(false)
  })
})

describe('settingsFromCloud：合回一份能用的设置', () => {
  it('云端没有 gameClock ⇒ 保留本机那份', () => {
    const got = settingsFromCloud(JSON.stringify({ childName: '小红' }), LOCAL)
    expect(got?.childName).toBe('小红')
    expect(got?.gameClock).toEqual(LOCAL.gameClock)
  })

  it('云端那份更大 ⇒ 取云端的（另一台设备玩得更多）', () => {
    const got = settingsFromCloud(
      JSON.stringify({ gameClock: { day: TODAY, sec: 900 } }),
      LOCAL,
    )
    expect(got?.gameClock).toEqual({ day: TODAY, sec: 900 })
  })

  it('云端那份更小 ⇒ 取本机的（**别**被拉回去，否则额度永远用不完）', () => {
    const got = settingsFromCloud(
      JSON.stringify({ gameClock: { day: TODAY, sec: 100 } }),
      LOCAL,
    )
    expect(got?.gameClock).toEqual({ day: TODAY, sec: 420 })
  })

  it('云端那份是别的日子 ⇒ 不算今天的', () => {
    const got = settingsFromCloud(
      JSON.stringify({ gameClock: { day: '2000-01-01', sec: 99999 } }),
      LOCAL,
    )
    expect(got?.gameClock).toEqual({ day: TODAY, sec: 420 })
  })

  it('解析不出来一律 null —— 让调用方保留本地，而不是清成默认值', () => {
    expect(settingsFromCloud('', LOCAL)).toBeNull()
    expect(settingsFromCloud('   ', LOCAL)).toBeNull()
    expect(settingsFromCloud('childName=小明', LOCAL)).toBeNull()
    expect(settingsFromCloud('[1,2]', LOCAL)).toBeNull()
    expect(settingsFromCloud('"小明"', LOCAL)).toBeNull()
    expect(settingsFromCloud('null', LOCAL)).toBeNull()
  })
})

describe('pullSettings：云端 → 本地 meta', () => {
  it('云端有设置 ⇒ applied，且写进 meta', async () => {
    getMock.mockResolvedValue({
      payload: JSON.stringify({
        childName: '小红',
        parentPin: '1111',
        gameClock: { day: TODAY, sec: 900 },
      }),
      updated_at: 1,
      version: 2,
    })
    await saveSettings(LOCAL)

    expect(await pullSettings(await loadSettings())).toBe('applied')

    const got = await loadSettings()
    expect(got.childName).toBe('小红')
    expect(got.parentPin).toBe('1111')
    // 用量取 max：云端 900 > 本机 420
    expect(got.gameClock).toEqual({ day: TODAY, sec: 900 })
  })

  it('**覆盖**而不是合并：云端没有的键不会从本地复活', async () => {
    await saveSettings(LOCAL)
    getMock.mockResolvedValue({
      payload: JSON.stringify({ childName: '小红' }),
      updated_at: 1,
      version: 2,
    })

    await pullSettings(await loadSettings())

    // 本地原来是 '2468'，云端那份里没有这个键 ⇒ 应该没了
    expect((await loadSettings()).parentPin).toBeUndefined()
  })

  it('云端为空 ⇒ 把本机这份推上去（老账号首次上云）', async () => {
    await saveSettings(LOCAL)
    getMock.mockResolvedValue({ payload: '', updated_at: 0, version: 0 })
    saveMock.mockImplementation((payload: string, version: number) =>
      Promise.resolve({ payload, updated_at: 9, version }),
    )

    expect(await pullSettings(await loadSettings())).toBe('pushed')

    // 推上去的那份里必须有 PIN（换台设备要能开门），也必须有今天的用量
    // （否则重装 App 就把限时重置了）
    const sent = JSON.parse(saveMock.mock.calls[0][0] as string) as Record<string, unknown>
    expect(sent.parentPin).toBe('2468')
    expect(sent.gameClock).toEqual(LOCAL.gameClock)
    // 本地设置不该被这次推上去的动作改掉
    expect((await loadSettings()).childName).toBe('小明')
  })

  it('推不上去（网络）⇒ kept，本地不动、也不抛', async () => {
    await saveSettings(LOCAL)
    getMock.mockResolvedValue({ payload: '', updated_at: 0, version: 0 })
    saveMock.mockRejectedValue(new Error('连不上服务器'))

    expect(await pullSettings(await loadSettings())).toBe('kept')
    expect((await loadSettings()).childName).toBe('小明')
  })

  it('换了账号：本地这份不是我的 ⇒ **一个字都不许推上去**', async () => {
    /* `signOut` 不清 Dexie（离线也要能退出去），所以换账号登录时
       meta 里还留着上一个人的设置。这时云端是空的 —— 照推的话，
       等于把**上一个人的家长锁 PIN** 写进新账号。 */
    await saveSettings(LOCAL)
    await setMeta('settings.owner', 5) // 上一个人
    setSession({
      token: 't',
      refreshToken: 'r',
      user: { uid: 7 } as never,
      expiresAt: 0,
    })
    getMock.mockResolvedValue({ payload: '', updated_at: 0, version: 0 })

    expect(await pullSettings(await loadSettings())).toBe('reset')
    expect(saveMock).not.toHaveBeenCalled()

    /* 重置成默认值，而且**连 gameClock 一起**：
       · 留着 PIN ⇒ 新账号被上一个人的家长锁关在外面；
       · 留着 childName ⇒ 新账号看到上一个人孩子的名字；
       · 留着 gameClock ⇒ 上一个人今天玩的时长吃掉这个人的额度。 */
    const after = await loadSettings()
    expect(after.parentPin).toBeUndefined()
    expect(after.childName).toBe(DEFAULT_SETTINGS.childName)
    expect(after.gameClock).toBeUndefined()
    // 归属改成新账号，下次就不会再重置一遍
    expect(await getMeta('settings.owner', null)).toBe(7)
  })

  it('★ 读请求在写之前发出 ⇒ 回来时必须丢弃（哪怕它的序号更大）', async () => {
    /* 服务端的 `version` 是**它自己那份**的序号（线上可能已经 999），
       而客户端的计数器是**本进程从 0 开始**的 —— 两者不可比。
       所以「序号更小」不能当「响应更旧」的判据：

       引导流程里就是这样：登录触发的那次 `settings/get` 还在飞，
       家长已经把新小名写成功了（客户端发的是 version=1），
       读响应回来带着 999 ⇒ 按序号判是「更新」，照用就把刚写的小名盖回去，
       下次启动「变回旧名字」，全程不报错。 */
    await saveSettings(LOCAL)
    let releaseGet: (v: { payload: string; updated_at: number; version: number }) => void = () => {}
    getMock.mockReturnValue(
      new Promise((res) => {
        releaseGet = res
      }),
    )
    saveMock.mockImplementation((payload: string, version: number) =>
      Promise.resolve({ payload, updated_at: 9, version }),
    )

    const inflight = pullSettings(await loadSettings()) // 读先发出，卡在网络上
    await oSaveSettings({ ...LOCAL, childName: '刚改的名字' }) // 写入成功
    releaseGet({ payload: JSON.stringify({ childName: '很久以前的名字' }), updated_at: 1, version: 999 })

    expect(await inflight).toBe('stale')
    expect((await loadSettings()).childName).toBe('小明')
  })

  it('★ 两次拉取并发、后发的先回 ⇒ 先发的那份作废（别拿旧快照盖新的）', async () => {
    /* `refresh()` 会被前台、登录、切页同时触发。两次读同时在路上时，
       回来的顺序**不保证**是发出的顺序 —— 后发的先回、先发的后回很正常。
       拿「服务端 version」判谁新是不行的（那个号是客户端自己传的，
       每个进程从 0 开始，跨设备不可比，见 settings.ts 里 `pullSeq` 的注释），
       所以用本进程的拉取序号。 */
    await saveSettings(LOCAL)
    const pending: Array<(v: { payload: string; updated_at: number; version: number }) => void> = []
    getMock.mockImplementation(
      () =>
        new Promise((res) => {
          pending.push(res)
        }),
    )
    const waitPending = async (n: number) => {
      for (let i = 0; i < 100 && pending.length < n; i++) await new Promise((r) => setTimeout(r, 5))
      expect(pending.length).toBe(n)
    }

    const first = pullSettings(await loadSettings())
    await waitPending(1)
    const second = pullSettings(await loadSettings())
    await waitPending(2)

    // 后发的先回，带的是更新的一份
    pending[1]({ payload: JSON.stringify({ childName: '新名字' }), updated_at: 2, version: 2 })
    expect(await second).toBe('applied')

    // 先发的后回，带的是旧快照 ⇒ 必须丢掉，否则「新名字」被盖回「旧名字」
    pending[0]({ payload: JSON.stringify({ childName: '旧名字' }), updated_at: 1, version: 1 })
    expect(await first).toBe('stale')
    expect((await loadSettings()).childName).toBe('新名字')
  })

})

describe('用量上云：节流 + 尽力而为', () => {
  it('第一次推；累计不到 5 分钟不推；到了就推', () => {
    expect(shouldPushUsage(undefined)).toBe(false)
    expect(shouldPushUsage({ day: TODAY, sec: 100 })).toBe(true)

    noteUsagePushed({ day: TODAY, sec: 100 })
    expect(shouldPushUsage({ day: TODAY, sec: 100 + USAGE_PUSH_EVERY_SEC - 1 })).toBe(false)
    expect(shouldPushUsage({ day: TODAY, sec: 100 + USAGE_PUSH_EVERY_SEC })).toBe(true)
  })

  it('跨天一定推 —— 否则云端永远停在昨天，换台设备拉下来就是「昨天玩满了」', () => {
    noteUsagePushed({ day: TODAY, sec: 1800 })
    expect(shouldPushUsage({ day: '2000-01-02', sec: 0 })).toBe(true)
  })

  it('推不上去**不抛也不回退**，下一次 tick 会重试', async () => {
    saveMock.mockRejectedValue(new Error('连不上服务器'))
    await expect(pushUsageBestEffort(LOCAL)).resolves.toBeUndefined()

    // 失败了 ⇒ 节流状态没变，下一次还会试
    expect(shouldPushUsage(LOCAL.gameClock)).toBe(true)
  })

  it('推成功之后按节流走：30 秒后的那次不推', async () => {
    saveMock.mockImplementation((payload: string, version: number) =>
      Promise.resolve({ payload, updated_at: 9, version }),
    )

    await pushUsageBestEffort(LOCAL)
    expect(saveMock).toHaveBeenCalledTimes(1)

    await pushUsageBestEffort({
      ...LOCAL,
      gameClock: { day: TODAY, sec: 420 + 30 },
    })
    expect(saveMock).toHaveBeenCalledTimes(1)

    await pushUsageBestEffort({
      ...LOCAL,
      gameClock: { day: TODAY, sec: 420 + USAGE_PUSH_EVERY_SEC },
    })
    expect(saveMock).toHaveBeenCalledTimes(2)
  })
})
