import { describe, expect, it } from 'vitest'
import { GAME_CODE_ALPHABET_AT_MINT, GAME_CODE_HASHES } from './codeTable'
import { codeTableSize, gameIdForCode } from './codeLookup'
import { GAME_CODE_ALPHABET, isGameCode } from '../domain/gameCode'
import { LOCAL_GAMES } from './localGames'
import { GAMES } from './registry'

/*
  ⚠️ 这个文件**不许 import `node:fs`**。
  `tsc -b` 会把测试文件也过一遍，而 App 的 tsconfig 没有 Node 类型 ——
  一 import 就 `TS2591: Cannot find name 'node:fs'`，整个 `npm run lint` 红。

  所以「明文码 ↔ 表」的真·roundtrip 不在单测里，在
  `scripts/mint-codes.mjs` 的自检里（写完文件读回来逐个查）。
  那一步比单测更靠近危险现场：它跑在**发码那一刻**。
*/

/** 这个版本里真有的游戏 id（内置 + 随包发的插件） */
const KNOWN_IDS = new Set([...GAMES.map((g) => g.id), ...LOCAL_GAMES.map((g) => g.id)])

describe('兑换码表', () => {
  it('每一条的键都是 64 位小写十六进制（sha256）', () => {
    for (const k of Object.keys(GAME_CODE_HASHES)) {
      expect(k, `「${k}」不是 sha256`).toMatch(/^[0-9a-f]{64}$/)
    }
  })

  it('★ 每一条的值都是这个版本里真有的游戏 id', () => {
    // 写错一个字母的症状：码能兑换成功、账本也写了，但界面上永远找不到那款游戏。
    for (const [hash, id] of Object.entries(GAME_CODE_HASHES)) {
      expect(KNOWN_IDS.has(id), `${hash.slice(0, 8)}… 指向了不存在的游戏「${id}」`).toBe(true)
    }
  })

  it('表里没有明文码（键是 64 位哈希，不是 6 位码）', () => {
    for (const k of Object.keys(GAME_CODE_HASHES)) {
      expect(k.length).not.toBe(6)
      expect(isGameCode(k), '键本身不能长得像一个能用的码').toBe(false)
    }
  })

  it('★ 生成这张表时用的字母表和 App 的逐字相同', () => {
    // 脚本是 `.mjs`，import 不了 `.ts`，只能抄一份字母表。
    // 两份不一致的症状是「生成的码全部兑换失败」，而且不报错 ——
    // 只会一直说「没有这个码」。所以生成器把当时用的字母表也写进了表里。
    expect(GAME_CODE_ALPHABET_AT_MINT).toBe(GAME_CODE_ALPHABET)
  })

  it('查不到就是 undefined，不抛异常', async () => {
    expect(await gameIdForCode('ZZZZZZ')).toBeUndefined()
    expect(await gameIdForCode('')).toBeUndefined()
    expect(await gameIdForCode('  --  ')).toBeUndefined()
  })

  it('codeTableSize() 和表的真实条数一致', () => {
    expect(codeTableSize()).toBe(Object.keys(GAME_CODE_HASHES).length)
  })

  it('表不是空的（空表 = 所有码都兑换失败，而界面照常能点）', () => {
    expect(codeTableSize()).toBeGreaterThan(0)
  })
})
