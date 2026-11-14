import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, NETWORK } from '../api/client'
import type { SnapshotRow } from '../api/snapshot'
import {
  diffPreview,
  groupMoments,
  isAutoNote,
  listMoments,
  momentLabel,
  previewMoment,
  reasonLabel,
  restoreToMoment,
  snapshotFailText,
} from './snapshot'

/* ============================================================
   在线版 · 存档还原点
   ------------------------------------------------------------
   这一层只干两件事，但两件都容易做错且**不报错**：

     ① 分组：同一时刻的多个 key 要合成一个还原点。
        分错了的后果不是报错，是界面上一排「同一个时间」的重复行，
        或者反过来把两次不同的存点并成一次（家长以为只存了一份）。
     ② 回档后必须 `pullGameKv`。不拉一次，服务端已经退回去了，
        本地 Dexie 还是新的那份 ⇒ 界面显示「没退回去」，而服务端其实退了。
        这种「两边不一样且不报错」正是本项目最怕的形态。

   真连服务端是 `scripts/_probe-snapshot-online.mjs` 的活。
   ============================================================ */

const listMock = vi.fn()
const restoreByTimeMock = vi.fn()
const logsMock = vi.fn()
const kvListMock = vi.fn()
const pullKvMock = vi.fn()
const getMock = vi.fn()

vi.mock('../api/snapshot', () => ({
  snapshotList: (g: string, k: string | undefined, limit: number) => listMock(g, k, limit),
  snapshotRestoreByTime: (g: string, at: number, maxId = 0, k?: string, r?: string) =>
    restoreByTimeMock(g, at, maxId, k, r),
  snapshotRestoreLogs: (g: string, limit: number) => logsMock(g, limit),
  snapshotGet: (id: number) => getMock(id),
  snapshotRestore: vi.fn(),
}))

vi.mock('../api/gameKv', () => ({
  gameKvList: (g: string) => kvListMock(g),
  gameKvGet: vi.fn(),
  gameKvSet: vi.fn(),
  gameKvDelete: vi.fn(),
  gameKvUsage: vi.fn(),
}))

vi.mock('./kv', () => ({
  pullGameKv: (g: string) => pullKvMock(g),
}))

/** 造一条快照。`at` 是秒 */
const row = (p: Partial<SnapshotRow> & { at: number }): SnapshotRow => ({
  id: p.id ?? p.at,
  game_id: 'cloudfarm',
  key: p.key ?? 'save',
  size: p.size ?? 100,
  version: p.version ?? 1,
  reason: p.reason ?? 'auto',
  is_daily_baseline: p.is_daily_baseline ?? false,
  note: p.note ?? '',
  created_at: p.at,
})

beforeEach(() => {
  listMock.mockReset()
  restoreByTimeMock.mockReset()
  logsMock.mockReset()
  kvListMock.mockReset()
  pullKvMock.mockReset()
})

describe('groupMoments（把按 key 的快照合成还原点）', () => {
  it('同一秒的两个 key 合成一个还原点', () => {
    const ms = groupMoments([row({ at: 1000, key: 'save' }), row({ at: 1000, key: 'bag' })])
    expect(ms).toHaveLength(1)
    expect(ms[0].keys.sort()).toEqual(['bag', 'save'])
    expect(ms[0].at).toBe(1000)
  })

  it('★ 跨一秒（一局结束先写 save 再写 settings）仍然合成一个 —— 否则界面上是两行', () => {
    const ms = groupMoments([row({ at: 1000, key: 'save' }), row({ at: 1002, key: 'bag' })])
    expect(ms).toHaveLength(1)
    expect(ms[0].at, '代表时间取**新**那条，回档要用它').toBe(1002)
  })

  it('★ 差得远的两批不能并（那是两次存点）', () => {
    const ms = groupMoments([
      row({ at: 1000, key: 'save' }),
      row({ at: 1300, key: 'save' }),
    ])
    expect(ms).toHaveLength(2)
    expect(ms.map((m) => m.at)).toEqual([1300, 1000])
  })

  it('按时间倒序返回（最新的还原点在最上面）', () => {
    const ms = groupMoments([
      row({ at: 100 }),
      row({ at: 300 }),
      row({ at: 200 }),
    ])
    expect(ms.map((m) => m.at)).toEqual([300, 200, 100])
  })

  it('★ 同一个 key 几秒内连存两条，size 只算最新那份（不能翻倍）', () => {
    const ms = groupMoments([
      row({ at: 1000, key: 'save', size: 500 }),
      row({ at: 1001, key: 'save', size: 120 }),
    ])
    expect(ms).toHaveLength(1)
    expect(ms[0].keys).toEqual(['save'])
    expect(ms[0].size).toBe(120)
  })

  it('多 key 的 size 是各 key 之和', () => {
    const ms = groupMoments([
      row({ at: 1000, key: 'save', size: 500 }),
      row({ at: 1000, key: 'bag', size: 300 }),
    ])
    expect(ms[0].size).toBe(800)
  })

  it('reasons 去重且保持顺序；note 取第一条非空；baseline 有一个就算', () => {
    const ms = groupMoments([
      row({ at: 1000, key: 'save', reason: 'manual', note: '' }),
      row({ at: 1000, key: 'bag', reason: 'manual', note: '打boss前' }),
      row({ at: 1001, key: 'settings', reason: 'daily', is_daily_baseline: true }),
    ])
    // 行是按时间**倒序**处理的，所以原因的顺序跟着走：最新那条的在前
    expect(ms[0].reasons).toEqual(['daily', 'manual'])
    expect(ms[0].note).toBe('打boss前')
    expect(ms[0].baseline).toBe(true)
  })

  it('★★ maxId 取这一组里最大的 id（回档时钉住「界面看到的那批」）', () => {
    const ms = groupMoments([
      row({ at: 1000, id: 40, key: 'save' }),
      row({ at: 1000, id: 41, key: 'bag' }),
    ])
    expect(ms[0].maxId).toBe(41)
  })

  it('★★ 每个还原点各带自己的 maxId（不能用「整屏最大的那个」）', () => {
    const ms = groupMoments([
      row({ at: 2000, id: 90, key: 'save' }),
      row({ at: 1000, id: 40, key: 'save' }),
    ])
    expect(ms.map((m) => m.maxId)).toEqual([90, 40])
  })

  it('空列表 ⇒ 空结果（不是 undefined）', () => {
    expect(groupMoments([])).toEqual([])
  })

  it('不改入参（排序在副本上做）', () => {
    const rows = [row({ at: 100 }), row({ at: 300 })]
    groupMoments(rows)
    expect(rows.map((r) => r.created_at)).toEqual([100, 300])
  })
})

describe('reasonLabel', () => {
  it('认识服务端那几个原因', () => {
    expect(reasonLabel('auto')).toBe('自动')
    expect(reasonLabel('daily')).toBe('当天起点')
    expect(reasonLabel('manual')).toBe('手动')
    expect(reasonLabel('before_restore')).toBe('回档前')
    expect(reasonLabel('restore')).toBe('回档后')
  })

  it('★ 不认识的原样显示，不吞成「未知」', () => {
    expect(reasonLabel('milestone')).toBe('milestone')
  })
})

describe('momentLabel', () => {
  /* 固定一个本地时间当「现在」：2026-11-02 12:44:15（本地时区） */
  const NOW = new Date(2026, 10, 2, 12, 44, 15).getTime()
  const sec = (ms: number) => Math.floor(ms / 1000)

  it('今天 / 昨天 / 更早', () => {
    expect(momentLabel(sec(new Date(2026, 10, 2, 9, 5, 0).getTime()), NOW)).toBe('今天 09:05')
    expect(momentLabel(sec(new Date(2026, 10, 1, 20, 11, 0).getTime()), NOW)).toBe('昨天 20:11')
    expect(momentLabel(sec(new Date(2026, 9, 28, 7, 30, 0).getTime()), NOW)).toBe('10月28日 07:30')
  })

  it('★★ 入参是 Unix 秒 —— 当成毫秒会显示成 1970 年', () => {
    /* 这条断言就是为了钉住单位：写错的时候不报错，只是日期全错，
       而界面上看起来像「日期格式没写好」（实测显示成「1月22日 02:13」）。 */
    const at = sec(new Date(2026, 10, 2, 12, 44, 0).getTime())
    expect(momentLabel(at, NOW)).toBe('今天 12:44')
    expect(momentLabel(at, NOW)).not.toContain('1月')
  })
})

describe('isAutoNote', () => {
  it('认出服务端回档时自动写的备注', () => {
    expect(isAutoNote('从快照 #40 回档')).toBe(true)
    expect(isAutoNote('从快照 #7 回档')).toBe(true)
  })

  it('★ 认不出来就照常显示（别把家长写的备注吞掉）', () => {
    expect(isAutoNote('手动')).toBe(false)
    expect(isAutoNote('挑战 BOSS 之前')).toBe(false)
    expect(isAutoNote('')).toBe(false)
  })
})

/*
 * 这里**没有** `saveSnapshotNow` 的测试 —— 2026-11-02 起前端不再主动存点，
 * 快照由服务端在每次 `storage.set` 之后按版本自己留。
 * 「自动留的到底对不对」不归单测管（那是服务端策略），真连服务端的验证在
 * `scripts/_probe-snapshot-online.mjs` 第 2 步：不点任何按钮，写一次存档，
 * 界面上就该多出一个还原点。
 */

describe('restoreToMoment', () => {
  it('★ 按时间点回档（一次调用恢复整个游戏），**并且**拉一次本地', async () => {
    restoreByTimeMock.mockResolvedValue({ restored_keys: 3 })
    pullKvMock.mockResolvedValue({ written: 3, skipped: 0, removed: 0 })
    const r = await restoreToMoment('cloudfarm', 1793183000, 77, '家长回档')
    expect(r.restored).toBe(3)
    expect(restoreByTimeMock).toHaveBeenCalledWith(
      'cloudfarm',
      1793183000,
      77,
      undefined,
      '家长回档',
    )
    expect(pullKvMock, '不拉这一下，界面会显示「没退回去」').toHaveBeenCalledWith('cloudfarm')
  })

  it('★ 回档成功但本地拉取失败 —— 也要把 restored 交出去（服务端已经退了）', async () => {
    restoreByTimeMock.mockResolvedValue({ restored_keys: 1 })
    pullKvMock.mockRejectedValue(new ApiError(NETWORK, '连不上'))
    await expect(restoreToMoment('cloudfarm', 1, 0)).rejects.toBeInstanceOf(ApiError)
  })

  it('restored_keys 缺失时按 0 处理（别把 undefined 当成功）', async () => {
    restoreByTimeMock.mockResolvedValue({})
    pullKvMock.mockResolvedValue({ written: 0, skipped: 0, removed: 0 })
    await expect(restoreToMoment('cloudfarm', 1, 0)).resolves.toEqual({ restored: 0 })
  })
})

describe('listMoments', () => {
  it('list 为 null（没有快照）时返回空数组', async () => {
    listMock.mockResolvedValue({ count: 0, list: null })
    await expect(listMoments('cloudfarm')).resolves.toEqual([])
  })

  it('把服务端那堆按 key 的行交给 groupMoments', async () => {
    listMock.mockResolvedValue({
      count: 2,
      list: [row({ at: 1000, key: 'save' }), row({ at: 1000, key: 'bag' })],
    })
    const ms = await listMoments('cloudfarm')
    expect(ms).toHaveLength(1)
    expect(ms[0].keys).toHaveLength(2)
  })
})

describe('snapshotFailText', () => {
  it('断网 / 未登录 / 快照没了 / 未拥有 各说各的话', () => {
    expect(snapshotFailText(new ApiError(NETWORK, ''))).toContain('连不上服务器')
    expect(snapshotFailText(new ApiError(401, ''))).toContain('重新登录')
    expect(snapshotFailText(new ApiError(10041001, ''))).toContain('已经被清理')
    expect(snapshotFailText(new ApiError(10040401, ''))).toContain('还没兑换')
  })

  it('★ 不认识的错误码要带上码（别只说「失败」）', () => {
    expect(snapshotFailText(new ApiError(99999, ''))).toContain('99999')
  })

  it('不是 ApiError 也有话说', () => {
    expect(snapshotFailText(new Error('boom'))).toContain('再试一次')
  })
})

describe('diffPreview（退回去会变成什么）', () => {
  it('标量字段：左边现在、右边退回后', () => {
    const r = diffPreview({ level: 99, tag: 'v99' }, { level: 1, tag: 'v1' })
    expect(r.lines).toEqual(['level：99 → 1', 'tag：“v99” → “v1”'])
    expect(r.more).toBe(0)
  })

  it('一模一样 ⇒ 一行都不给（界面说「和现在一模一样」）', () => {
    expect(diffPreview({ a: 1, b: [1, 2] }, { a: 1, b: [1, 2] }).lines).toEqual([])
  })

  it('★ 现在没有、退回去有 ⇒ 说「会补回来」，不是「会丢」', () => {
    const r = diffPreview({}, { coins: 20 })
    expect(r.lines).toEqual(['coins：会补回来（20）'])
  })

  it('★ 现在有、退回去没有 ⇒ 说「会被删掉」', () => {
    const r = diffPreview({ coins: 20 }, {})
    expect(r.lines).toEqual(['coins：会被删掉（现在是 20）'])
  })

  it('数组：长度变了报项数，长度没变但内容不同别写成「3 项 → 3 项」', () => {
    expect(diffPreview({ plots: [1, 2, 3] }, { plots: [1, 2] }).lines).toEqual(['plots：3 项 → 2 项'])
    expect(diffPreview({ plots: [1, 2, 3] }, { plots: [4, 5, 6] }).lines).toEqual([
      'plots：内容不一样（都是 3 项）',
    ])
  })

  it('布尔写成人话（是 / 否），null 写「空」', () => {
    const r = diffPreview({ paused: false, pet: null }, { paused: true, pet: null })
    expect(r.lines).toEqual(['paused：否 → 是'])
  })

  it('★ 超过上限就截断，剩下的报个数（存档明细不能刷屏）', () => {
    const cur = { a: 1, b: 2, c: 3, d: 4, e: 5 }
    const snap = { a: 9, b: 9, c: 9, d: 9, e: 9 }
    const r = diffPreview(cur, snap, 2)
    expect(r.lines).toHaveLength(2)
    expect(r.more).toBe(3)
  })

  it('长字符串截断，不把整段存档文本倒出来', () => {
    const long = 'x'.repeat(50)
    const r = diffPreview({ name: long }, { name: 'a' })
    expect(r.lines[0]).toContain('…')
    expect(r.lines[0].length).toBeLessThan(40)
  })

  it('整个值是个数组 ⇒ 报项数（家长能看懂的那一句）', () => {
    expect(diffPreview([1, 2], [1, 3]).lines).toEqual(['2 项 → 2 项'])
    expect(diffPreview([1, 2, 3], [1]).lines).toEqual(['3 项 → 1 项'])
    expect(diffPreview([1, 2], [1, 2]).lines).toEqual([])
  })

  it('一边数组一边对象（形状都变了）⇒ 只能说「都不一样」', () => {
    expect(diffPreview([1, 2], { a: 1 }).lines).toEqual(['整份存档都不一样'])
    expect(diffPreview(5, { a: 1 }).lines).toEqual(['整份存档都不一样'])
  })
})

describe('previewMoment（点开才取内容）', () => {
  const m = groupMoments([
    row({ at: 1000, key: 'save', id: 11, version: 2 }),
    row({ at: 1000, key: 'bag', id: 12, version: 1 }),
  ])[0]

  it('★ 每个 key 各取一次 get，再取一次现在的值', async () => {
    kvListMock.mockResolvedValue({
      game_id: 'cloudfarm',
      data: { save: { level: 99 }, bag: [1, 2, 3] },
      versions: {},
      count: 2,
    })
    getMock.mockImplementation(async (id: number) =>
      id === 11 ? { id, value: { level: 1 } } : { id, value: [1] },
    )

    const out = await previewMoment('cloudfarm', m)
    expect(getMock.mock.calls.map((c) => c[0]).sort()).toEqual([11, 12])
    expect(kvListMock).toHaveBeenCalledTimes(1)
    /* ⚠️ 别按下标断言：`snapshots` 的顺序是 id 倒序（最新写的那份在前），
       不是「按 key 名字排」。按 key 查更稳。 */
    const byKey = Object.fromEntries(out.map((k) => [k.key, k]))
    expect(Object.keys(byKey).sort()).toEqual(['bag', 'save'])
    expect(byKey.save.lines).toEqual(['level：99 → 1'])
    expect(byKey.bag.lines).toEqual(['3 项 → 1 项'])
  })

  it('★ 单个 key 被保留策略淘汰 ⇒ 只有那一个报错，其余照常显示', async () => {
    kvListMock.mockResolvedValue({ game_id: 'cloudfarm', data: { save: { level: 99 } }, versions: {}, count: 1 })
    getMock.mockImplementation(async (id: number) => {
      if (id === 11) throw new ApiError(10041001, '快照不存在')
      return { id, value: [1] }
    })

    const out = await previewMoment('cloudfarm', m)
    const byKey = Object.fromEntries(out.map((k) => [k.key, k]))
    expect(byKey.save.error).toContain('已经被清理掉')
    expect(byKey.save.lines).toEqual([])
    expect(byKey.bag.error).toBeUndefined()
    expect(byKey.bag.lines).toEqual(['会补回来（1 项）'])
  })

  it('现在服务端已经没有这个 key（刚卸载过）⇒ 「会补回来」', async () => {
    kvListMock.mockResolvedValue({ game_id: 'cloudfarm', data: {}, versions: {}, count: 0 })
    getMock.mockResolvedValue({ id: 11, value: { level: 1 } })
    const out = await previewMoment('cloudfarm', groupMoments([row({ at: 1000, id: 11 })])[0])
    expect(out[0].lines).toEqual(['level：会补回来（1）'])
  })
})
