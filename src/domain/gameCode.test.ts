import { describe, expect, it } from 'vitest'
import {
  GAME_CODE_ALPHABET,
  GAME_CODE_LEN,
  formatGameCode,
  isGameCode,
  mintGameCode,
  normalizeGameCode,
} from './gameCode'

describe('兑换码格式', () => {
  it('字母表正好 32 个字符，且不含 I L O U', () => {
    expect(GAME_CODE_ALPHABET.length).toBe(32)
    expect(new Set(GAME_CODE_ALPHABET).size, '不能有重复字符').toBe(32)
    for (const ch of 'ILOU') expect(GAME_CODE_ALPHABET).not.toContain(ch)
  })

  it('★ 易混字符自动纠正：I/L → 1、O → 0', () => {
    // 孩子照着卡片敲成小写、或者把手写的 1 看成 I，都不该被拒绝
    expect(normalizeGameCode('abc-dei')).toBe('ABCDE1')
    expect(normalizeGameCode('ABC-DEL')).toBe('ABCDE1')
    expect(normalizeGameCode('ABC-DEO')).toBe('ABCDE0')
    expect(normalizeGameCode(' abc def ')).toBe('ABCDEF')
  })

  it('★ 非法字符不删：删了就等于让乱输入通过', () => {
    // 「ABCDEF!!」不能被归一化成合法的「ABCDEF」
    expect(normalizeGameCode('ABCDEF!!')).toBe('ABCDEF!!')
    expect(isGameCode('ABCDEF!!')).toBe(false)
    expect(isGameCode('ABCDEF')).toBe(true)
  })

  it('长度不对一律拒绝', () => {
    expect(isGameCode('ABCDE')).toBe(false)
    expect(isGameCode('ABCDEFG')).toBe(false)
    expect(isGameCode('')).toBe(false)
  })

  it('显示带一横，输入可以不带', () => {
    expect(formatGameCode('ABCDEF')).toBe('ABC-DEF')
    expect(formatGameCode('abc-def')).toBe('ABC-DEF')
    // 长度不对就原样返回，别硬切成两段骗人
    expect(formatGameCode('ABC')).toBe('ABC')
  })

  it('生成的码自己就能过校验，且长度固定', () => {
    for (let i = 0; i < 200; i += 1) {
      const c = mintGameCode()
      expect(c.length).toBe(GAME_CODE_LEN)
      expect(isGameCode(c), `生成的「${c}」过不了自己的校验`).toBe(true)
    }
  })

  it('生成的码不是同一个（不是写死/常量）', () => {
    const set = new Set(Array.from({ length: 50 }, () => mintGameCode()))
    expect(set.size).toBe(50)
  })
})
