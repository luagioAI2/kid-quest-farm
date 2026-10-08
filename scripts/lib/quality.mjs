/**
 * 五档评级的「显示名」—— 从源码里读，不在 e2e 脚本里再抄一份
 * ------------------------------------------------------------
 * 为什么要有这个文件：
 *
 * e2e-check.mjs 里有一条守卫，检查**孩子端不该出现质量自评按钮**
 * （用户报的事故：「长期任务 孩子 做完确认时 为啥能自己评价和打分。」）。
 * 它原来靠一个硬编码的正则来认这些按钮：
 *
 *     const dirty = probe.buttons.filter((t) => /一般|不错|特别棒/.test(t))
 *
 * 2026-10 把三档改成五档时，中间档的显示名从「不错」变成了「良好」——
 * 正则里的「不错」从此永远匹配不到任何东西。**守卫没有报错，只是变弱了。**
 * 同一天在 PeriodSubmit.test.tsx 里也踩了同一个坑（那边是
 * `expected 3 but got 2` 才暴露的，纯属运气）。
 *
 * 所以：不要在验收脚本里抄第二份名字列表。
 * 抄一份 = 多一个会过期的事实源，而且它过期时**不会响**。
 *
 * 这里直接解析 `src/domain/settlement.ts` 的 QUALITY_META，并且
 * **要求至少解析出 5 条**：解析失败必须炸出来。
 * 如果放任它返回空数组，`new RegExp('')` 会匹配**所有**按钮，
 * 守卫就变成了「随便什么按钮都算命中」—— 比不写还糟。
 */
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SETTLEMENT_SRC = join(PROJECT_ROOT, 'src', 'domain', 'settlement.ts')

/** 期望的档位数量。低于这个数说明解析坏了（或有人删了档位），必须人工看一眼。 */
const EXPECTED_GRADES = 5

/**
 * 读出五档的显示名，例如 ['很差', '一般', '良好', '很好', '特别棒']。
 * @returns {string[]}
 */
export function readQualityLabels() {
  let text
  try {
    text = readFileSync(SETTLEMENT_SRC, 'utf8')
  } catch (e) {
    throw new Error(`读不到 ${SETTLEMENT_SRC}：${e.message}`)
  }

  const start = text.indexOf('QUALITY_META')
  if (start < 0) {
    throw new Error('settlement.ts 里找不到 QUALITY_META —— 是不是改名了？')
  }

  // QUALITY_META 的对象字面量以行首的 `}` 结束。
  const rest = text.slice(start)
  const end = rest.indexOf('\n}')
  const block = end < 0 ? rest : rest.slice(0, end)

  const labels = [...block.matchAll(/label:\s*'([^']+)'/g)].map((m) => m[1])

  if (labels.length < EXPECTED_GRADES) {
    throw new Error(
      `只从 QUALITY_META 解析出 ${labels.length} 个档位名（期望 ${EXPECTED_GRADES}）：` +
        `${JSON.stringify(labels)} —— 解析规则或源码结构变了，先修这里再用。`,
    )
  }
  return labels
}

/**
 * 一个能认出「任意一档质量评级按钮」的正则。
 * 用它来断言孩子端**没有**这种东西。
 * @returns {RegExp}
 */
export function qualityLabelRegex() {
  const labels = readQualityLabels()
  return new RegExp(labels.join('|'))
}
