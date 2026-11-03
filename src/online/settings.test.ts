import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, DEFAULT_SETTINGS, getMeta, loadSettings, saveSettings, setMeta } from '../db/db'
import { setSession } from '../api/session'
import type { AppSettings } from '../domain/types'
import {
  cloudPayload,
  isDeviceLocalOnly,
  oSaveSettings,
  pullSettings,
  resetSettingsSyncState,
  settingsFromCloud,
} from './settings'

/* ============================================================
   在线版 · 家长设置上云
   ------------------------------------------------------------
   这一层错了也都**不报错**：
     · 把 `gameClock` 传上去 ⇒ 一分钟一个 POST，而且断网时本地也写不进去
       ⇒ 时长不累计 ⇒ 孩子无限玩；
     · 拉取时用云端那份盖掉本机 `gameClock` ⇒ 杀 App 重开就刷回额度；
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

const LOCAL: AppSettings = {
  ...DEFAULT_SETTINGS,
  childName: '小明',
  parentPin: '2468',
  gameClock: { day: '2026-11-03', sec: 420 },
}

beforeEach(async () => {
  await db.meta.clear()
  resetSettingsSyncState()
  setSession(null)
  getMock.mockReset()
  saveMock.mockReset()
})

describe('cloudPayload：什么上云、什么不上云', () => {
  it('剥掉 gameClock（用量不上云）', () => {
    const o = JSON.parse(cloudPayload(LOCAL)) as Record<string, unknown>
    expect(o.gameClock).toBeUndefined()
    expect(o.childName).toBe('小明')
  })

  it('parentPin **要**上云 —— 和备份那份清单不一样是有意的', () => {
    /* 备份会剥 PIN（文件会被发到微信 / 网盘），云端不剥
       （换台设备要能用同一个 PIN 开门）。
       把这两处「统一」的人，要么把 PIN 泄露进备份，要么让换机后开不了门。 */
    const o = JSON.parse(cloudPayload(LOCAL)) as Record<string, unknown>
    expect(o.parentPin).toBe('2468')
  })

  it('isDeviceLocalOnly：只碰 gameClock 才为真', () => {
    expect(isDeviceLocalOnly({ gameClock: { day: '2026-11-03', sec: 1 } })).toBe(true)
    expect(isDeviceLocalOnly({ gameClock: { day: '2026-11-03', sec: 1 }, childName: 'x' })).toBe(
      false,
    )
    expect(isDeviceLocalOnly({})).toBe(false)
  })
})

describe('settingsFromCloud：合回一份能用的设置', () => {
  it('保留本机的 gameClock（云端那份可能是别的设备 / 别的日子）', () => {
    const got = settingsFromCloud(JSON.stringify({ childName: '小红' }), LOCAL)
    expect(got?.childName).toBe('小红')
    expect(got?.gameClock).toEqual(LOCAL.gameClock)
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
      payload: JSON.stringify({ childName: '小红', parentPin: '1111' }),
      updated_at: 1,
      version: 2,
    })
    await saveSettings(LOCAL)

    expect(await pullSettings(await loadSettings())).toBe('applied')

    const got = await loadSettings()
    expect(got.childName).toBe('小红')
    expect(got.parentPin).toBe('1111')
    // 设备本地字段还是本机那份
    expect(got.gameClock).toEqual(LOCAL.gameClock)
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

    // 推上去的那份里必须有 PIN（否则换台设备开不了门），但没有 gameClock
    const sent = JSON.parse(saveMock.mock.calls[0][0] as string) as Record<string, unknown>
    expect(sent.parentPin).toBe('2468')
    expect(sent.gameClock).toBeUndefined()
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

  it('读结果比本地写入更旧 ⇒ stale，**不覆盖**本地', async () => {
    /* 场景：家长刚改了名字（写成功，version=1），这时一个更早发出的
       `settings/get` 才回来，带的是 version=0 的旧内容。
       照用的话，刚改的名字会被盖回去 —— 而且不报错。 */
    await saveSettings(LOCAL)
    saveMock.mockImplementation((payload: string, version: number) =>
      Promise.resolve({ payload, updated_at: 9, version }),
    )
    await oSaveSettings({ ...LOCAL, childName: '刚改的名字' })
    expect(saveMock).toHaveBeenCalledTimes(1)

    getMock.mockResolvedValue({
      payload: JSON.stringify({ childName: '很久以前的名字' }),
      updated_at: 1,
      version: 0,
    })

    expect(await pullSettings(await loadSettings())).toBe('stale')
    expect((await loadSettings()).childName).toBe('小明')
  })
})
