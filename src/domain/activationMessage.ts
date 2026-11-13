/* ============================================================
   激活结果的文案（生成 + 解析，**同一处定义**）
   ------------------------------------------------------------
   2026-11-13 抓到的 bug：这两个方向各自写了一遍，而且对不上 ——

     生成（store）  `，但 ${failed} 款没装成功（…）`   ← 中间有数字
     解析（组件）   done.includes('，但没装成功')      ← 中间没数字

   `includes` **永远不命中**。后果不是"少显示一行"，而是判反了：

     · `installFailed` 恒为 false ⇒ 走「成功」那一支
     · 界面写「游戏已经进「我的游戏」了」—— 而包根本没装上
     · 长串技术原因被当成标题整段显示（`headline = done`）

   用户报的是「激活的时候没有提示成功 似乎」—— 症状看着像"没提示"，
   实际是**提示说反了**，还夹着一串报错。

   ## 为什么做成一对函数而不是修一下正则

   正则能修这一次（`/，但 \d+ 款没装成功/`），但两个方向仍然是**各写一遍**，
   下次改文案还会再错一次。这里把「怎么拼」和「怎么拆」放在同一个文件、
   用同一个常量，让它们**不可能**各自漂移。

   ⚠️ 别把 `INSTALL_FAIL_MARK` 改成会出现在正常文案里的词 ——
      它是判据，不是给人看的（人看的是前后那两句）。
   ============================================================ */

/**
 * 装包失败时追加的那半句的**标记词**。
 *
 * 生成和解析都用它 ⇒ 只改这里一处，两边一起变。
 * 前面留一个空格是因为句子里有数量：`，但 1 款没装成功`。
 */
export const INSTALL_FAIL_MARK = '款没装成功'

/** 拼在激活结果后面（`failed > 0` 时）。 */
export function installFailNote(failed: number, firstMsg: string): string {
  return `，但 ${failed} ${INSTALL_FAIL_MARK}（${firstMsg}），去「我的游戏」里点安装`
}

export interface ParsedActivation {
  /** 只留「已激活 X」这一句，不含技术原因（弹框标题用） */
  headline: string
  /** 包没装上 —— 界面不能再说「已经进你的游戏柜了」 */
  installFailed: boolean
  /** 括号里那段技术原因（单独一行小字，不是标题） */
  reason: string
}

/**
 * 把 store 给的整句拆成「标题 / 装没装成 / 原因」。
 *
 * 解析失败的兜底很重要：万一文案又变了、这里拆不出来，
 * **宁可当成成功**（`installFailed: false`）也**不能**当成失败 ——
 * 判成失败会让一个真的成功的激活显示「没装上，去我的游戏里点安装」，
 * 家长会去点一个已经装好的游戏。
 */
export function parseActivationMessage(done: string): ParsedActivation {
  const fail = done.includes(INSTALL_FAIL_MARK)
  if (!fail) return { headline: done, installFailed: false, reason: '' }

  /* 标题 = 标记词之前那句，并把收尾的「，但 N 」一起切掉。
     `，但 2 款没装成功` ⇒ 标题只留「已激活 X」。 */
  const at = done.indexOf(INSTALL_FAIL_MARK)
  const headline = done
    .slice(0, at)
    .replace(/，但\s*\d*\s*$/, '')
    .trim()

  // 原因 = 标记词之后**第一对**括号里的内容
  const tail = done.slice(at)
  const reason = (tail.match(/（([^）]*)）/) ?? [])[1] ?? ''

  return { headline: headline || done, installFailed: true, reason }
}
