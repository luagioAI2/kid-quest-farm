import { describe, expect, it } from 'vitest'
import { compareVersions, hasUpdate } from './version'

describe('compareVersions', () => {
  it('相等', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('补零后相等（1.0 与 1.0.0 是同一版）', () => {
    // 不补零的话这两个会被判成不同版本 ⇒ 界面给一个永远点不完的「更新」
    expect(compareVersions('1.0', '1.0.0')).toBe(0)
    expect(compareVersions('1.0.0.0', '1.0')).toBe(0)
  })

  it('主 / 次 / 补丁位逐级比较', () => {
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
    expect(compareVersions('1.1.0', '1.0.9')).toBe(1)
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
  })

  it('按数字比而不是按字典序（1.10 > 1.9）', () => {
    // 字典序会认为 '1.10' < '1.9'，于是「更新」永远不出现
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1)
  })

  it('容忍 v 前缀与空格', () => {
    expect(compareVersions('v1.0.2', '1.0.1')).toBe(1)
    expect(compareVersions(' 1.0.1 ', 'V1.0.1')).toBe(0)
  })

  it('非数字段按 0（1.0.0-beta 与 1.0.0 视为同版）', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBe(0)
  })
})

describe('hasUpdate', () => {
  it('目录更新 ⇒ true', () => {
    expect(hasUpdate('1.0.2', '1.0.0')).toBe(true)
  })

  it('目录同版 ⇒ false', () => {
    expect(hasUpdate('1.0.0', '1.0.0')).toBe(false)
  })

  it('★ 目录更旧（回滚）⇒ false', () => {
    // 这条是关键：用 `!==` 判的话回滚之后会一直劝人「更新」到旧版
    expect(hasUpdate('1.0.0', '1.0.2')).toBe(false)
  })
})
