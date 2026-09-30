/* ============================================================
   小任务农场 · 官网交互
   ------------------------------------------------------------
   没有依赖、没有构建步骤，原生 ES 模块。
   所有效果都遵守 prefers-reduced-motion：用户关掉动画时，
   内容必须直接可见（而不是停在 opacity:0 上永远不出现）。
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- 1. 标记 JS 可用 ---------- */
// <html class="no-js"> 是给「JS 没跑起来」准备的兜底：
// 那时 .reveal 不能藏，否则整页内容全是空白。
document.documentElement.classList.remove('no-js')

/* ---------- 2. 年份 ---------- */
const yearEl = document.getElementById('year')
if (yearEl) yearEl.textContent = String(new Date().getFullYear())

/* ---------- 3. 阅读进度条 + 导航吸顶 ---------- */
const progress = document.getElementById('progress')
const nav = document.getElementById('nav')

let ticking = false
function onScroll() {
  if (ticking) return
  ticking = true
  requestAnimationFrame(() => {
    const doc = document.documentElement
    const max = doc.scrollHeight - window.innerHeight
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
    if (progress) progress.style.width = (ratio * 100).toFixed(2) + '%'
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 8)
    ticking = false
  })
}
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

/* ---------- 4. 移动端菜单 ---------- */
const burger = document.getElementById('burger')
const navlinks = document.getElementById('navlinks')

function closeMenu() {
  if (!nav) return
  nav.classList.remove('is-open')
  if (burger) burger.setAttribute('aria-expanded', 'false')
}

if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open')
    burger.setAttribute('aria-expanded', String(open))
  })
}

if (navlinks) {
  navlinks.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu()
  })
}

document.addEventListener('click', (e) => {
  if (!nav || !nav.classList.contains('is-open')) return
  if (!nav.contains(e.target)) closeMenu()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeMenu()
})

/* ---------- 5. 滚动揭示 ---------- */
const revealEls = Array.from(document.querySelectorAll('.reveal'))

/* 同一组里的元素依次出现，而不是一起冒出来 */
function stagger(el) {
  const parent = el.parentElement
  if (!parent) return 0
  const siblings = Array.from(parent.children).filter((c) => c.classList.contains('reveal'))
  const i = siblings.indexOf(el)
  return i > 0 ? Math.min(i * 90, 540) : 0
}

function show(el) {
  el.style.transitionDelay = stagger(el) + 'ms'
  el.classList.add('is-in')
  // 揭示后清掉 delay，避免以后 hover 之类的过渡被延迟
  window.setTimeout(() => {
    el.style.transitionDelay = ''
  }, 1200)
}

if (reduceMotion || !('IntersectionObserver' in window)) {
  // 关掉动画，或浏览器太老 —— 直接全部显示
  revealEls.forEach((el) => el.classList.add('is-in'))
} else {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          show(entry.target)
          io.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  )
  revealEls.forEach((el) => io.observe(el))
}

/* ---------- 6. 数字滚动 ---------- */
function countUp(el) {
  const target = Number(el.dataset.count)
  if (!Number.isFinite(target)) return
  if (reduceMotion || target === 0) {
    el.textContent = String(target)
    return
  }
  const dur = 900
  const t0 = performance.now()
  function tick(now) {
    const p = Math.min(1, (now - t0) / dur)
    // easeOutCubic
    const eased = 1 - Math.pow(1 - p, 3)
    el.textContent = String(Math.round(target * eased))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/* ---------- 7. 结算规则进度条 ---------- */
// 宽度由 data-bar 给出（百分比），滚动到视野里才拉出来
function fillBar(el) {
  const span = el.firstElementChild
  if (!span) return
  const pct = Number(el.dataset.bar)
  span.style.width = (Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0) + '%'
}

const barEls = Array.from(document.querySelectorAll('[data-bar]'))

if (reduceMotion || !('IntersectionObserver' in window)) {
  barEls.forEach(fillBar)
} else {
  const barIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // 等揭示动画把卡片推到位置之后再拉，否则条子会「先满后移」
          window.setTimeout(() => fillBar(entry.target), 260)
          barIO.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.4 },
  )
  barEls.forEach((el) => barIO.observe(el))
}

/* ---------- 8. 数字滚动挂到视野 ---------- */
const countEls = Array.from(document.querySelectorAll('[data-count]'))

if (reduceMotion || !('IntersectionObserver' in window)) {
  countEls.forEach(countUp)
} else {
  const countIO = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          countUp(entry.target)
          countIO.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.6 },
  )
  countEls.forEach((el) => countIO.observe(el))
}

/* ---------- 9. FAQ：一次只展开一个 ---------- */
// 手机上一屏放不下两个展开项，展开第二个时自动收起上一个。
const faqItems = Array.from(document.querySelectorAll('.faq details'))
faqItems.forEach((item) => {
  item.addEventListener('toggle', () => {
    if (!item.open) return
    faqItems.forEach((other) => {
      if (other !== item) other.open = false
    })
  })
})

/* ---------- 10. APK 下载：给个反馈 ---------- */
// 5.5 MB 的包点了没反应会让人以为按钮坏了。
const apkLinks = Array.from(document.querySelectorAll('a[download]'))
apkLinks.forEach((a) => {
  a.addEventListener('click', () => {
    const original = a.dataset.label ?? a.textContent
    a.dataset.label = original
    a.textContent = '⬇️ 开始下载…'
    window.setTimeout(() => {
      a.textContent = original
    }, 2600)
  })
})
