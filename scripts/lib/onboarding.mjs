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
 * 等引导**决定要不要弹**（`App.tsx` 的 `entered` 闸门）。
 *
 * ⚠️ ★ 这一步不能省，也不只是「多等一会儿」。实测（390×844，SwiftShader）：
 *   - `__kqf__` 就绪后约 1.5s 还在启动页（`header` 没有、`[data-step]` 没有）
 *   - 约 4s 时主界面出来，`useLayoutEffect` 同一帧盖上向导
 *   ⇒ 在 `__kqf__` 一就绪就查一次 `[data-step]`，读到的是 **`false`**，
 *     函数按「老 profile，本来就不弹」返回，脚本继续跑。
 *     **引导随后才弹出来**，于是后面每一次截图都是引导页、每一次点击都点在它后面。
 *
 *   这条 bug 特别阴：`.click()` 绕过命中测试，断言照样全绿；只有**看图**才发现。
 *   所以这里主动等主界面出现，再给 `useLayoutEffect` 一帧的余量。
 */
async function waitForGate(page, timeout = 20000) {
  const entered = await page
    .waitForFunction(() => !!document.querySelector('header') || !!document.querySelector('[data-step]'), { timeout })
    .then(() => true, () => false)
  // 主界面已经画出来了但向导还没盖上 —— layoutEffect 在同一帧，这里只是保险
  await new Promise((r) => setTimeout(r, 350))
  return entered
}

/**
 * 把家长密码钉成 0000（脚本全都按「输 4 个 0 就进家长区」写的）。
 *
 * 2026-10-30 起**新装没有家长密码**：引导只问小名和头像，家长第一次进
 * 家长区时闸门才要求设一个（输两遍）。要是让每个脚本自己补第二遍输入，
 * 十几份脚本迟早走散 —— 统一在这里钉一次。
 *
 * 想验「第一次用才要求设」那条流程的脚本，用
 * `dismissOnboarding(page, { seedPin: false })` 跳过这一步。
 */
export async function seedParentPin(page, pin = '0000') {
  const ok = await page.evaluate(async (p) => {
    const kqf = window.__kqf__
    if (!kqf) return false
    const st = kqf.getState()
    if (st.settings?.parentPin) return true
    await st.updateSettings({ parentPin: p })
    return true
  }, pin)
  if (!ok) console.warn('[onboarding] 没能钉家长密码（__kqf__ 还没就绪）')
  return ok
}

/**
 * 把新手引导整条走完（含给孩子的四步导览）。
 *
 * @param {{ seedPin?: boolean }} [opts]
 *   `seedPin: false` = 不钉默认密码，留给脚本自己走「第一次设密码」那条路
 * @returns {Promise<boolean>} 本来有没有弹引导（false = 没弹，可能是老 profile）
 */
export async function dismissOnboarding(page, { seedPin = true } = {}) {
  await waitForGate(page)
  if (!(await page.evaluate(() => !!document.querySelector('[data-step]')))) {
    return false
  }

  await clickExact(page, '开始设置')
  await waitFor(page, 'input[aria-label="孩子的小名"]')

  // 2026-10-30 起没有「设家长密码」这一步了：小名/头像 → 直接到完成
  await clickExact(page, '下一步')
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

  if (seedPin) await seedParentPin(page)

  return true
}
