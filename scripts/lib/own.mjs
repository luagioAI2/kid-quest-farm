/**
 * 给 e2e 预置「已拥有」
 * ------------------------------------------------------------
 * 2026-10-30 起 **「设置 / 游戏」加了门槛：没拥有不能装**（家长拍板）。
 * 21 款随包游戏全部要先用兑换券换、或者用激活码解锁。
 *
 * 于是每个游戏 e2e 在点「安装」之前都得先让它拥有 —— 否则
 * `[data-local-install]` 那个按钮**根本不存在**，`clickSel` 点空，
 * 报错却是后面那句「那一行没变成已装」，排查方向整个是错的。
 *
 * ## 为什么走 `window.__kqf__.grantGame` 而不是直接写 IndexedDB
 *
 * 那个句柄走的是**和真实兑换完全一样的那一笔账**
 * （`source: 'redemption_code'`，delta 0）。直接写库要抄一遍
 * 表名 / 字段 / id 生成规则 —— 抄的那份过期时不会响。
 * 这也是本项目的老规矩：验收脚本里不抄第二份事实。
 *
 * ⚠️ 句柄不存在就必须**炸**。安静返回会让后面的断言
 * 「按钮可点 = false」看起来像功能坏了，而不是脚本没准备好。
 */

/**
 * @param {import('playwright').Page} page
 * @param {string} gameId
 */
export async function grantGame(page, gameId) {
  const res = await page.evaluate(async (id) => {
    const api = /** @type {any} */ (window).__kqf__
    if (!api?.grantGame) return 'missing'
    await api.grantGame(id)
    return 'ok'
  }, gameId)

  if (res === 'missing') {
    throw new Error(
      'window.__kqf__.grantGame 不存在 —— 预置拥有失败。' +
        '下面的「安装」一定点空，先确认构建里带了这个调试桥。',
    )
  }
}
