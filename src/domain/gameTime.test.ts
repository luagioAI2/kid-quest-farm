import { describe, expect, it } from 'vitest'
import {
  GAME_DAILY_PRESETS,
  MAX_GAME_DAILY_MINUTES,
  clampGameDailyMinutes,
  formatPlayed,
  isGameLocked,
  playedSecToday,
  remainingSec,
  rollGameClock,
} from './gameTime'
import { appDayKey } from './time'

/* ============================================================
   每天游戏时长（家长 2026-10-28 的「沉迷设定」）
   ------------------------------------------------------------
   这一组函数的错法都很安静：
     · 跨天不归零 ⇒ 昨天玩满，今天一开就锁死；
     · 跨天归零写反 ⇒ 额度永远不锁（等于没做）；
     · 不限时返回 0 而不是 Infinity ⇒ 所有人在第一秒就被锁住。
   三条都不会报错，只会在某一天突然出现。所以逐条钉住。
   ============================================================ */

describe('clampGameDailyMinutes', () => {
  it('0 / 负数 / 空 / NaN 都是「不限」', () => {
    // 家长想关掉这项功能时最自然的动作就是清空输入框
    for (const v of [0, -1, -60, '', null, undefined, NaN, 'abc']) {
      expect(clampGameDailyMinutes(v)).toBe(0)
    }
  })

  it('正常档位原样返回', () => {
    for (const v of GAME_DAILY_PRESETS) expect(clampGameDailyMinutes(v)).toBe(v)
  })

  it('手改备份塞一个巨大的数会被硬顶夹住', () => {
    // 不夹的话「上限 999999 分钟」= 把闸门关死，而且家长以为自己设了
    expect(clampGameDailyMinutes(1e9)).toBe(MAX_GAME_DAILY_MINUTES)
    expect(clampGameDailyMinutes('120')).toBe(120)
  })
})

describe('rollGameClock：跨天归零', () => {
  const today = '2026-10-28'

  it('没有存档（老库）当成今天的 0，不需要数据迁移', () => {
    expect(rollGameClock(undefined, today)).toEqual({ day: today, sec: 0 })
  })

  it('是同一天就保留秒数', () => {
    expect(rollGameClock({ day: today, sec: 600 }, today)).toEqual({ day: today, sec: 600 })
  })

  it('★ 不是同一天就归零（昨天玩满不该锁住今天）', () => {
    expect(rollGameClock({ day: '2026-10-27', sec: 1800 }, today)).toEqual({
      day: today,
      sec: 0,
    })
  })

  it('脏数据（负数 / NaN / 字符串日期）不会漏出去', () => {
    expect(rollGameClock({ day: today, sec: -5 }, today).sec).toBe(0)
    expect(rollGameClock({ day: today, sec: NaN }, today).sec).toBe(0)
    expect(rollGameClock({ day: 1 as never, sec: 60 }, today)).toEqual({ day: today, sec: 0 })
  })
})

describe('remainingSec / isGameLocked', () => {
  it('不限时返回 Infinity，且永远不锁', () => {
    // ⚠️ 这里如果返回 0，所有人第一秒就被锁在门外
    expect(remainingSec(0, 99999)).toBe(Infinity)
    expect(isGameLocked(0, 99999)).toBe(false)
  })

  it('30 分钟上限、已经玩 10 分钟 ⇒ 还剩 20 分钟', () => {
    expect(remainingSec(30, 600)).toBe(1200)
    expect(isGameLocked(30, 600)).toBe(false)
  })

  it('刚好玩满就锁，超过也不会变成负数', () => {
    expect(remainingSec(30, 1800)).toBe(0)
    expect(isGameLocked(30, 1800)).toBe(true)
    expect(remainingSec(30, 9999)).toBe(0)
  })

  it('脏的已玩秒数（负数 / NaN）当成 0，不会把额度撑大', () => {
    expect(remainingSec(30, -100)).toBe(1800)
    expect(remainingSec(30, NaN)).toBe(1800)
  })
})

describe('playedSecToday：跨天口径跟 dayStartHour 走', () => {
  it('凌晨 1 点、新的一天从 4 点算 ⇒ 仍算昨天', () => {
    // 家长把「新的一天」设成 4 点时，孩子 1 点还在玩，额度不该被重置
    const ts = new Date(2026, 9, 29, 1, 30).getTime()
    const yesterdayKey = appDayKey(ts, 4)
    expect(playedSecToday({ day: yesterdayKey, sec: 900 }, 4, ts)).toBe(900)
    // 同一个时刻，按「0 点换日」就是另一天了 ⇒ 归零
    expect(playedSecToday({ day: yesterdayKey, sec: 900 }, 0, ts)).toBe(0)
  })
})

describe('formatPlayed', () => {
  it('0 秒说「还没玩」，不说「0 分钟」', () => {
    expect(formatPlayed(0)).toBe('还没玩')
    expect(formatPlayed(NaN)).toBe('还没玩')
  })

  it('不足一分钟说「不到 1 分钟」', () => {
    expect(formatPlayed(45)).toBe('不到 1 分钟')
  })

  it('整分钟向下取整', () => {
    expect(formatPlayed(600)).toBe('10 分钟')
    expect(formatPlayed(659)).toBe('10 分钟')
  })
})
