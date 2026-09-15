/**
 * 新手引导的公共处理
 * ------------------------------------------------------------
 * 为什么需要它：
 *   所有 e2e / 截图脚本都用**全新的 Chrome profile**，也就是全新的库，
 *   `onboardingDone` 是 false —— 家长设置向导会盖住整个主界面。
 *
 *   ⚠️ 危险的是这个「盖住」**不会**让老脚本报错：它们几乎都用 DOM 的
 *   `.click()`，而 `.click()` **绕过命中测试**，被盖住也照样点得到。
 *   于是脚本继续全绿，实际界面根本不能用 —— 正是这个项目最忌讳的假通过。
 *
 *   所以：任何「想直接测主界面」的脚本，进来先把它走完。
 *   （想截引导本身的图，就自己先截再调这个，见 capture.mjs。）
 */

/** 点一个「文字正好等于 label」的按钮。返回是否点到。 */
function clickExact(page, label) {
  return page.evaluate((t) => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => (x.textContent ?? '').trim() === t,
    )
    if (!b) return false
    b.click()
    return true
  }, label)
}

/** 等某个选择器出现；超时返回 false，不抛。 */
function waitFor(page, sel, timeout = 8000) {
  return page
    .waitForFunction((s) => !!document.querySelector(s), { timeout }, sel)
    .then(() => true, () => false)
}

/**
 * 把新手引导整条走完（含给孩子的四步导览）。
 *
 * 走的是「以后再说」而不是真设家长密码 —— 免得把 `parentPin` 改掉，
 * 后面要验家长确认的脚本还得用默认的 0000。
 *
 * @returns {Promise<boolean>} 本来有没有弹引导（false = 没弹，可能是老 profile）
 */
export async function dismissOnboarding(page) {
  if (!(await page.evaluate(() => !!document.querySelector('[data-step]')))) {
    return false
  }

  await clickExact(page, '开始设置')
  await waitFor(page, 'input[aria-label="孩子的小名"]')

  await clickExact(page, '下一步')
  await waitFor(page, '[data-step="pin"]')

  await clickExact(page, '以后再说')
  await waitFor(page, '[data-step="done"]')

  await clickExact(page, '带宝贝看一遍')
  await waitFor(page, '[data-tour-bubble]')

  // 导览可以随时跳过 —— 这里本来就不是在验导览
  await clickExact(page, '跳过')
  await page
    .waitForFunction(() => !document.querySelector('[data-tour-bubble]'), { timeout: 8000 })
    .catch(() => {})

  // 等 `onboardingDone` 真的落库（finishTour 里是 await updateSettings）
  await new Promise((r) => setTimeout(r, 600))

  return true
}
