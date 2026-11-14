/**
 * 本地服务端 —— 把原版 `window.gp.server` 的那套接口在**本地**实现一遍。
 *
 * ## 为什么需要它
 *
 * 这游戏是**服务端权威**的：客户端只发动作（`/farm/local/plot/3/sow`），
 * 农场状态（种了什么、什么时候熟、收成几个、背包里有什么）全部由服务端算，
 * 客户端拿到结果再画。`main.js` 里 `localStorage` 出现 0 次。
 *
 * 所以「接进 App」= 把服务端换成本地实现，整份状态落到宿主存档里。
 *
 * ## 字段是从客户端反推的，不是猜的
 *
 * 下面这些函数名都是 `main.js` 里的原名，改公式时请对照：
 *
 * | 客户端 | 作用 | 本地对应 |
 * | --- | --- | --- |
 * | `We(plot,crop)` | 成熟耗时 `(s>0&&regrow?regrow:grow)*60000*C0` | `growMs()` |
 * | `C0(plot)` | 金土 ×0.8 | `soilMul()` |
 * | `qe(plot,crop)` | 成熟时刻 `p+We` | `ripeAt()` |
 * | `qu(plot,now)` | 阶段 0/1/2/3/4 | `stage()` |
 * | `vt(kind,ms)` | 病虫罚分 | `penaltyOf()` |
 * | `_0(plot,now)` | 总罚分（上限 50） | `penaltyTotal()` |
 * | `_t(n)` | 可再收阈值 `floor(n*0.6)` | `stealFloor()` |
 * | `x0(plot,now)` | 算产量写 `out/left` | `settlePlot()` |
 * | `Oe(plot,uid,now)` | 能不能收/偷 | `canGather()` |
 * | `_u(pen,now)` | 畜栏阶段 0/1/2/3 | `penStage()` |
 * | `Ye(pen,uid,now)` | 能不能收 | `canCollect()` |
 *
 * ## 地块对象（少一个字段客户端就抛）
 *
 * `{ c:作物id, p:种下时刻ms, s:浇水, w:枯萎, t:土力0/1/2,
 *    out:总产量|null, left:剩余, pb:[[kind,ts],...], pen:罚分, th:[偷过的uid] }`
 *
 * 注意 `pb` 里是**二元组数组**，客户端写的是 `for(let[n,d]of u.pb)`；
 * 早先版本往里面塞字符串，`for...of` 解构会拿到 `undefined` 而不报错，
 * 结果是「产量永远是满的」—— 静默算错，比崩掉更难发现。
 *
 * ## 畜栏对象
 *
 * `{ a:动物id, born:ms, fed:ms|0, stock:剩几个, made:本轮产了几个,
 *    pb:[[kind,ts],...], th:[收过的uid] }`
 */

/* ------------------------------------------------------------------ *
 * 数值表
 *
 * 从 `main.js` 的 `Pe / Ru / je / bt / pu / Ne / Le / yt / Et / wt / Ie`
 * 原样抽出来的**静态快照**（见 `_tables.mjs`）。
 *
 * 为什么不用 `window.__hh.data`：那张表要等 `/hello` + `/farm/enter` 跑完
 * 才挂上去，而 `/hello` 本身就要用作物表算东西 —— 启动阶段拿不到。
 * 所以这里自带一份；运行时若 `__hh.data` 已在，优先用它的（跟客户端同步）。
 * ------------------------------------------------------------------ */

const CROPS = [
  { id: 'wheat', lv: 1, seed: 6, sell: 2, yield: 10, exp: 3, grow: 10, seasons: 1, soil: 0 },
  { id: 'carrot', lv: 1, seed: 16, sell: 3, yield: 12, exp: 5, grow: 45, seasons: 1, soil: 0 },
  { id: 'corn', lv: 2, seed: 30, sell: 5, yield: 12, exp: 8, grow: 90, seasons: 1, soil: 0 },
  { id: 'cabbage', lv: 3, seed: 45, sell: 7, yield: 12, exp: 10, grow: 150, seasons: 1, soil: 0 },
  { id: 'tomato', lv: 4, seed: 70, sell: 5, yield: 14, exp: 12, grow: 180, seasons: 3, regrow: 90, soil: 0 },
  { id: 'potato', lv: 5, seed: 90, sell: 12, yield: 14, exp: 15, grow: 300, seasons: 1, soil: 0 },
  { id: 'strawberry', lv: 6, seed: 110, sell: 6, yield: 16, exp: 16, grow: 240, seasons: 3, regrow: 120, soil: 0 },
  { id: 'pumpkin', lv: 8, seed: 200, sell: 32, yield: 10, exp: 24, grow: 480, seasons: 1, soil: 0 },
  { id: 'eggplant', lv: 9, seed: 170, sell: 9, yield: 16, exp: 20, grow: 360, seasons: 2, regrow: 240, soil: 0 },
  { id: 'sunflower', lv: 10, seed: 240, sell: 22, yield: 14, exp: 28, grow: 600, seasons: 1, soil: 0 },
  { id: 'pepper', lv: 12, seed: 260, sell: 10, yield: 18, exp: 30, grow: 420, seasons: 3, regrow: 240, soil: 0 },
  { id: 'watermelon', lv: 14, seed: 400, sell: 60, yield: 10, exp: 40, grow: 780, seasons: 1, soil: 0 },
  { id: 'blueberry', lv: 16, seed: 420, sell: 12, yield: 20, exp: 42, grow: 540, seasons: 3, regrow: 300, soil: 0 },
  { id: 'grape', lv: 18, seed: 560, sell: 14, yield: 22, exp: 52, grow: 660, seasons: 3, regrow: 360, soil: 0 },
  { id: 'pineapple', lv: 20, seed: 720, sell: 90, yield: 10, exp: 70, grow: 1080, seasons: 1, soil: 0 },
  { id: 'chili', lv: 15, seed: 480, sell: 16, yield: 22, exp: 46, grow: 480, seasons: 3, regrow: 240, soil: 1 },
  { id: 'lavender', lv: 22, seed: 800, sell: 50, yield: 18, exp: 80, grow: 900, seasons: 1, soil: 1 },
  { id: 'starfruit', lv: 26, seed: 1100, sell: 30, yield: 22, exp: 100, grow: 720, seasons: 3, regrow: 420, soil: 1 },
  { id: 'goldpumpkin', lv: 28, seed: 1600, sell: 220, yield: 9, exp: 140, grow: 1200, seasons: 1, soil: 2 },
  { id: 'moonberry', lv: 30, seed: 1800, sell: 40, yield: 24, exp: 160, grow: 840, seasons: 3, regrow: 480, soil: 2 },
]

const ANIMALS = [
  { id: 'chicken', lv: 3, price: 120, grow: 30, make: 60, yield: 4, sell: 12, exp: 8, eats: 'wheat', product: 'egg' },
  { id: 'duck', lv: 5, price: 260, grow: 60, make: 120, yield: 4, sell: 22, exp: 12, eats: 'wheat', product: 'feather' },
  { id: 'cow', lv: 7, price: 600, grow: 120, make: 180, yield: 3, sell: 60, exp: 20, eats: 'corn', product: 'milk' },
  { id: 'pig', lv: 10, price: 900, grow: 180, make: 300, yield: 3, sell: 110, exp: 30, eats: 'carrot', product: 'truffle' },
  { id: 'sheep', lv: 13, price: 1300, grow: 240, make: 360, yield: 3, sell: 150, exp: 38, eats: 'cabbage', product: 'wool' },
  { id: 'goat', lv: 17, price: 2000, grow: 300, make: 480, yield: 3, sell: 230, exp: 50, eats: 'pumpkin', product: 'cheese' },
]

const DOGS = [
  { id: 'mutt', price: 800, gems: 0, catch: 0.2 },
  { id: 'corgi', price: 6000, gems: 0, catch: 0.3 },
  { id: 'shepherd', price: 18000, gems: 0, catch: 0.4 },
  { id: 'husky', price: 0, gems: 60, catch: 0.5 },
]

const DECOR = [
  { id: 'house_cottage', lv: 0, price: 0, gems: 0, slot: 'house' },
  { id: 'house_stone', lv: 8, price: 12000, gems: 0, slot: 'house' },
  { id: 'house_mushroom', lv: 14, price: 0, gems: 40, slot: 'house' },
  { id: 'house_windmill', lv: 20, price: 60000, gems: 0, slot: 'house' },
  { id: 'barn_red', lv: 0, price: 0, gems: 0, slot: 'barn' },
  { id: 'barn_blue', lv: 10, price: 15000, gems: 0, slot: 'barn' },
  { id: 'barn_log', lv: 16, price: 0, gems: 35, slot: 'barn' },
  { id: 'doghouse_wood', lv: 0, price: 0, gems: 0, slot: 'doghouse' },
  { id: 'doghouse_castle', lv: 12, price: 9000, gems: 0, slot: 'doghouse' },
  { id: 'doghouse_igloo', lv: 18, price: 0, gems: 25, slot: 'doghouse' },
]

const FERT = {
  basic: { price: 60, gems: 0, cut: 60 },
  super: { price: 0, gems: 2, cut: 240 },
}

const FEED = { price: 30 }
const DOGFOOD = { price: 300, days: 1 }

/** `[需要等级, 价格]` */
const PLOT_COST = [
  [3, 800],
  [5, 1600],
  [7, 3200],
  [9, 6000],
  [11, 10000],
  [14, 16000],
  [17, 26000],
  [20, 40000],
  [24, 60000],
  [28, 90000],
]
const PEN_COST = [
  [4, 1000],
  [7, 3000],
  [10, 7000],
  [14, 14000],
  [18, 26000],
  [23, 45000],
]
const SOIL_COST = [
  { lv: 12, price: 4000, step: 1500, gems: 0 },
  { lv: 22, price: 20000, step: 6000, gems: 3 },
]

const START = { money: 400, gems: 50, plots: 6, pens: 2, seeds: { wheat: 6, carrot: 2 }, fert: 2 }

/* 上限：`He=16` / `b0=8` */
const PLOT_MAX = 16
const PEN_MAX = 8

/** 客户端 `le` —— 一分钟的毫秒数，所有时间都是「分钟 × 它」 */
const LE = 60000
/** 客户端 `w0` —— 可再收阈值比例 */
const STEAL_RATIO = 0.6
/** 客户端 `E0` —— 每日使坏上限 */
const BAD_DAILY = 10
const BAD_FARM = 3

const now = () => Date.now()

/* ------------------------------------------------------------------ *
 * 数据表取值（运行时优先用客户端那张，保证两边口径一致）
 * ------------------------------------------------------------------ */

function table(name, fallback) {
  const t = globalThis.__hh?.data?.[name]
  return Array.isArray(t) && t.length ? t : fallback
}

const cropOf = (id) => table('crops', CROPS).find((c) => c.id === id) ?? CROPS.find((c) => c.id === id)
const animalOf = (id) => table('animals', ANIMALS).find((a) => a.id === id) ?? ANIMALS.find((a) => a.id === id)
const dogOf = (id) => table('dogs', DOGS).find((d) => d.id === id) ?? DOGS.find((d) => d.id === id)
const decorOf = (id) => table('decor', DECOR).find((d) => d.id === id) ?? DECOR.find((d) => d.id === id)
const fertOf = (id) => (FERT[id] ? { ...FERT[id], ...(globalThis.__hh?.data?.fert?.[id] ?? {}) } : undefined)
const feedCfg = () => ({ ...FEED, ...(globalThis.__hh?.data?.feed ?? {}) })
const dogfoodCfg = () => ({ ...DOGFOOD, ...(globalThis.__hh?.data?.dogfood ?? {}) })
const plotCost = () => table('plotCost', PLOT_COST)
const penCost = () => table('penCost', PEN_COST)
const soilCost = () => table('soil', SOIL_COST)

/* ------------------------------------------------------------------ *
 * 客户端同款数学
 * ------------------------------------------------------------------ */

/** `C0` —— 金土（t===2）成熟快 20% */
const soilMul = (plot) => (plot.t === 2 ? 0.8 : 1)

/** `We` —— 成熟要多久（浇过水的连作作物走 regrow） */
function growMs(plot, crop) {
  const base = plot.s > 0 && crop.regrow ? crop.regrow : crop.grow
  return base * LE * soilMul(plot)
}

/** `qe` —— 成熟时刻 */
const ripeAt = (plot, crop) => plot.p + growMs(plot, crop)

/** `qu` —— 生长阶段：-1 空地 / 0 芽 / 1 小 / 2 大 / 3 熟 / 4 枯 */
function stage(plot, t = now()) {
  if (!plot?.c) return -1
  if (plot.w) return 4
  const crop = cropOf(plot.c)
  if (!crop) return 4
  const a = (t - plot.p) / growMs(plot, crop)
  if (a >= 1) return 3
  if (plot.s > 0) return 2
  if (a < 0.15) return 0
  if (a < 0.45) return 1
  return 2
}

/** `vt` —— 单条病虫的罚分（每 10 分钟涨一档） */
function penaltyOf(kind, ms) {
  const t = Math.ceil(Math.max(0, ms) / (10 * LE))
  return kind === 3 ? Math.min(30, t * 3 + 2) : Math.min(24, t * 2 + 1)
}

/** `_0` —— 总罚分，封顶 50 */
function penaltyTotal(plot, t) {
  let sum = plot.pen || 0
  for (const [k, ts] of plot.pb ?? []) sum += penaltyOf(k, t - ts)
  return Math.min(50, sum)
}

/** `_t` —— 「还能再收」的门槛：剩余 > 总产量 60% */
const stealFloor = (n) => Math.floor(n * STEAL_RATIO)

/**
 * `x0` —— 熟了就把产量算出来写进 `out/left`。
 *
 * 客户端每秒也会跑一次同样的逻辑，但它**只改自己内存里的副本**，
 * 不会把 `out` 发给服务端。所以服务端必须自己算，否则
 * `left` 永远是 0、收成永远是 0。
 */
function settlePlot(plot, t = now()) {
  if (!plot?.c || plot.w || plot.out !== null) return false
  const crop = cropOf(plot.c)
  if (!crop) return false
  const ripe = ripeAt(plot, crop)
  if (t < ripe) return false
  const pen = penaltyTotal(plot, ripe)
  let out = Math.max(1, Math.round((crop.yield * (100 - pen)) / 100))
  if (plot.t > crop.soil) out = Math.floor(out * (plot.t === 2 ? 1.2 : 1.1))
  plot.out = out
  plot.left = out
  plot.pb = []
  plot.pen = 0
  return true
}

/** `Oe` —— 这个 uid 现在能不能收/偷这块地 */
function canGather(plot, uid, t = now()) {
  if (!plot?.c || plot.w) return false
  if ((plot.th ?? []).includes(uid)) return false
  const crop = cropOf(plot.c)
  if (!crop) return false
  if (t < ripeAt(plot, crop)) return false
  settlePlot(plot, t)
  if (plot.out === null) return true
  return plot.left > stealFloor(plot.out)
}

/** `_u` —— 畜栏阶段：0 幼崽 / 1 饿 / 2 长 / 3 可收 */
function penStage(pen, t = now()) {
  const a = animalOf(pen.a)
  if (!a) return 1
  if (t < pen.born + a.grow * LE) return 0
  if (pen.stock > 0) return 3
  if (!pen.fed) return 1
  return t >= penMakeAt(pen, a) ? 3 : 2
}

/** `Ge` —— 长大时刻 */
const penGrowAt = (pen, a) => pen.born + a.grow * LE

/** `Ue` —— 产出时刻（喂过之后才开始算） */
const penMakeAt = (pen, a) => Math.max(pen.fed, penGrowAt(pen, a)) + a.make * LE

/** `Ye` —— 这个 uid 现在能不能收畜产品 */
function canCollect(pen, uid, t = now()) {
  if (penStage(pen, t) !== 3) return false
  if ((pen.th ?? []).includes(uid)) return false
  return pen.made ? pen.stock > stealFloor(pen.made) : true
}

/** `Re` —— 等级曲线 */
const lvOf = (exp) => Math.max(1, Math.floor(Math.sqrt(Math.max(0, exp) / 25)) + 1)

/* ------------------------------------------------------------------ *
 * 状态
 * ------------------------------------------------------------------ */

function emptyPlot(soil = 0) {
  return { c: '', p: 0, s: 0, w: 0, t: soil, out: null, left: 0, pb: [], pen: 0, th: [] }
}

function emptyPen() {
  return null
}

function newPen(animalId, t = now()) {
  return { a: animalId, born: t, fed: 0, stock: 0, made: 0, pb: [], th: [] }
}

/** 默认装饰：房子/谷仓/狗窝各一个免费的（原版 `lv:0,price:0`） */
function defaultDecor() {
  const d = {}
  for (const it of DECOR) {
    if (it.lv === 0 && it.price === 0 && it.gems === 0) d[it.slot] = it.id
  }
  return d
}

export function freshState(name = '小农场主') {
  const uid = 'local'
  const plots = Array.from({ length: START.plots }, () => emptyPlot())
  const pens = Array.from({ length: START.pens }, () => emptyPen())
  return {
    v: 1,
    seen: false,
    me: {
      uid,
      name,
      avatar: '',
      money: START.money,
      gems: START.gems,
      exp: 0,
      seeds: { ...START.seeds },
      items: {},
      lock: {},
      /* 原版 `Ie.fert` 是数字，但客户端读的是 `C.fert.basic` ⇒ 这里规整成对象 */
      fert: { basic: START.fert ?? 0 },
      feed: 0,
      dogfood: 0,
      dogs: [],
      decors: [],
      stolen: 0,
      caught: 0,
      help: 0,
      harvested: 0,
      /* 新手引导进度。`tutorial.js` 读 `player.tut ?? {s:0,tips:{}}`，
         而它**自己不做持久化**（`j` 是内存对象）⇒ 不存就等于每次重播。 */
      tut: { s: 0, tips: {}, done: 0 },
      /* 设置页（语言 / 音乐）落这里，`tutorial.js` 读 `player.cfg` */
      cfg: {},
      title: '',
      likes: 0,
      liked: {},
    },
    farm: {
      uid,
      name,
      plots,
      pens,
      dog: null,
      decor: defaultDecor(),
      look: 0,
      exp: 0,
      bad: { today: 0, farm: 0 },
      rain: 0,
      canAct: true,
      limits: { badDaily: BAD_DAILY, badFarm: BAD_FARM },
      log: [],
      notes: [],
    },
    npcs: {},
  }
}

/* ------------------------------------------------------------------ *
 * NPC 邻居
 *
 * 原版是线上真人邻居。本地没人，但「邻居」页空着会让「偷菜」这条
 * 社交线整个消失 —— 那是这游戏一半的乐趣。所以造几个固定的 NPC 农场：
 * 状态存在存档里（偷过的会一直记得），作物按「半熟到过熟」随机铺。
 * ------------------------------------------------------------------ */

const NPC_NAMES = ['隔壁老李', '王阿姨', '小林', '阿强']

function makeNpc(index, t = now()) {
  const uid = `npc${index + 1}`
  const name = NPC_NAMES[index % NPC_NAMES.length]
  const lowCrops = CROPS.filter((c) => c.lv <= 6)
  const plots = Array.from({ length: 6 }, (_, i) => {
    /* 前 4 块一定有作物，后 2 块留空 —— 看着像人种的 */
    if (i >= 4) return emptyPlot()
    const crop = lowCrops[(index * 3 + i) % lowCrops.length]
    const plot = emptyPlot()
    plot.c = crop.id
    /* 0.35~1.4 倍成熟时间：既有刚种下的，也有已经能偷的 */
    plot.p = t - Math.round(crop.grow * LE * (0.35 + ((index + i) % 5) * 0.22))
    return plot
  })
  const pens = [null, null]
  return {
    uid,
    name,
    lv: 2 + index,
    plots,
    pens,
    dog: index % 2 === 0 ? { id: 'mutt', food: t + 86400000 } : null,
    decor: defaultDecor(),
    exp: 120 * (index + 1),
    bad: { today: 0, farm: 0 },
    rain: 0,
    canAct: true,
    limits: { badDaily: BAD_DAILY, badFarm: BAD_FARM },
    log: [],
    notes: [],
  }
}

/* ------------------------------------------------------------------ *
 * 服务端
 * ------------------------------------------------------------------ */

export function createLocalServer(initial = {}) {
  /* `let` 而不是解构常量：插件挂载后要把存储换成宿主的 `host.storage`
     （见 `_setStore`），换的时候**不能重建** server —— 重建会丢掉
     已经跑过的内存状态，而那一刻正是引导刚播完、作物刚种下的时候。 */
  let { load, save, onDirty } = initial
  const loaded = load?.() ?? null
  let state = loaded && loaded.v === 1 ? loaded : freshState()

  /* 老存档补字段：加过字段之后旧存档不会自动有，缺了就会 `undefined.includes` 崩 */
  state.me.dogs ??= []
  state.me.decors ??= []
  state.me.stolen ??= 0
  state.me.caught ??= 0
  state.me.help ??= 0
  state.me.harvested ??= 0
  state.me.fert ??= { basic: 0 }
  state.me.tut ??= { s: 0, tips: {}, done: 0 }
  state.me.tut.tips ??= {}
  state.me.cfg ??= {}
  state.me.title ??= ''
  state.me.likes ??= 0
  state.me.liked ??= {}
  state.farm.look ??= 0
  state.farm.log ??= []
  state.farm.notes ??= []
  state.npcs ??= {}

  /* 邻居懒生成：第一次进来才铺，之后走存档 */
  function ensureNpcs(t = now()) {
    let made = false
    for (let i = 0; i < NPC_NAMES.length; i++) {
      const uid = `npc${i + 1}`
      if (!state.npcs[uid]) {
        state.npcs[uid] = makeNpc(i, t)
        made = true
      }
    }
    return made
  }

  /* 整份状态落盘。节流 300ms：连收 6 块地合并成一次写。
     宿主 `storage.set` 是异步的 ⇒ 这里用 Promise 兜住，别让未捕获 rejection 掀翻页面。 */
  let dirty = false
  let timer = null
  function flushNow() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    dirty = false
    try {
      const r = save?.(state)
      if (r && typeof r.then === 'function') r.catch((e) => console.warn('[farmlord] 存档失败', e))
    } catch (e) {
      console.warn('[farmlord] 存档失败', e)
    }
    onDirty?.()
  }
  function touch() {
    dirty = true
    if (timer) return
    timer = setTimeout(() => {
      timer = null
      if (!dirty) return
      flushNow()
    }, 300)
  }

  const me = () => state.me
  const farm = () => state.farm
  const farmByUid = (uid) => (uid === state.farm.uid ? state.farm : state.npcs[uid] ?? null)

  const ok = (data) => ({ ok: true, data })
  const err = (code, message) => ({ ok: false, code, message })

  /* ------------------------------ 视图 ------------------------------ */

  function playerView() {
    const p = me()
    return {
      uid: p.uid,
      id: p.uid,
      name: p.name,
      avatar: p.avatar,
      money: p.money,
      gems: p.gems,
      exp: p.exp,
      seeds: { ...p.seeds },
      items: { ...p.items },
      lock: { ...p.lock },
      fert: { ...p.fert },
      feed: p.feed,
      dogfood: p.dogfood,
      dogs: [...p.dogs],
      decors: [...p.decors],
      stolen: p.stolen,
      caught: p.caught,
      help: p.help,
      harvested: p.harvested ?? 0,
      tut: { ...p.tut, tips: { ...p.tut.tips } },
      cfg: { ...p.cfg },
      title: p.title,
      likes: p.likes,
    }
  }

  function farmView(f) {
    return {
      uid: f.uid,
      name: f.name,
      lv: lvOf(f.exp ?? 0),
      now: now(),
      plots: f.plots,
      pens: f.pens,
      dog: f.dog,
      decor: f.decor,
      look: f.look ?? 0,
      exp: f.exp ?? 0,
      bad: { today: f.bad?.today | 0, farm: f.bad?.farm | 0 },
      rain: f.rain ?? 0,
      canAct: f.canAct !== false,
      limits: f.limits ?? { badDaily: BAD_DAILY, badFarm: BAD_FARM },
      log: f.log ?? [],
      msg: f.notes ?? [],
    }
  }

  /** 进/同步时把整块农场「结算」一遍：熟了就定产量，畜栏到了就出货 */
  function settleFarm(f, t = now()) {
    let changed = false
    for (const plot of f.plots) {
      if (plot && settlePlot(plot, t)) changed = true
    }
    for (const pen of f.pens) {
      if (!pen) continue
      const a = animalOf(pen.a)
      if (!a) continue
      if (pen.stock === 0 && pen.fed && t >= penMakeAt(pen, a)) {
        pen.stock = Math.max(1, (a.yield ?? 1) - (pen.pb?.length ?? 0))
        pen.made = pen.stock
        changed = true
      }
    }
    return changed
  }

  function gainExp(n) {
    const p = me()
    const before = lvOf(p.exp)
    p.exp += n
    state.farm.exp = p.exp
    const after = lvOf(p.exp)
    return after > before ? after : undefined
  }

  function pushLog(f, entry) {
    f.log ??= []
    f.log.unshift({ t: now(), ...entry })
    if (f.log.length > 40) f.log.length = 40
  }

  /* ------------------------------ 地块动作 ------------------------------ */

  function actPlot(uid, i, act, body) {
    const f = farmByUid(uid)
    if (!f) return err('no_farm')
    const mine = uid === state.farm.uid
    const plot = f.plots[i]
    if (!plot) return err('no_plot')
    const t = now()

    switch (act) {
      /* 播种：扣种子，记时刻。土力沿用这块地原来的 `t` */
      case 'sow': {
        if (!mine) return err('not_yours')
        if (plot.c) return err('occupied')
        const seed = body?.seed
        if (!seed) return err('no_seed')
        const crop = cropOf(seed)
        if (!crop) return err('unknown')
        if (!(me().seeds?.[seed] > 0)) return err('no_seed')
        if (plot.t < crop.soil) return err('need_soil')
        me().seeds[seed] -= 1
        if (me().seeds[seed] <= 0) delete me().seeds[seed]
        const np = emptyPlot(plot.t)
        np.c = seed
        np.p = t

        /* 新手引导那一步要「等它熟」，而小麦是 10 分钟。
           让用户对着屏幕等 10 分钟，引导就等于做不下去 ⇒ 第一茬直接算熟。
           做法是把 `p` 往前拨一整个生长周期（客户端按 `p + grow*60000` 判熟），
           不另设字段 —— 否则客户端和本地服务端两套口径，早晚对不上。 */
        const p0 = me()
        p0.tut ??= { s: 0, tips: {}, done: 0 }
        let fast = false
        if (!p0.tut.done && !p0.tut.fastUsed) {
          p0.tut.fastUsed = 1
          np.p = t - Math.ceil(growMs(np, crop)) - 1000
          fast = true
        }

        f.plots[i] = np
        touch()
        return ok({
          plot: np,
          bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 },
          me: playerView(),
          fast,
        })
      }

      /* 浇水：`s>0` 让 `qu()` 直接跳到「大」，连作作物还会切成 regrow 计时 */
      case 'water': {
        if (!mine) return err('not_yours')
        if (!plot.c || plot.w || plot.s > 0) return err('nothing')
        plot.s = 1
        touch()
        return ok({ plot, bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 } })
      }

      /* 施肥：土力 +1，上限 3 */
      case 'fert': {
        if (!mine) return err('not_yours')
        if (!plot.c) return err('nothing')
        if ((plot.t | 0) >= 3) return err('max')
        const kind = body?.id ?? body?.kind
        if (!kind || !(me().fert?.[kind] > 0)) return err('no_fert')
        me().fert[kind] -= 1
        if (me().fert[kind] <= 0) delete me().fert[kind]
        plot.t = Math.min(3, (plot.t | 0) + 1)
        touch()
        return ok({ plot, bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 }, me: playerView() })
      }

      /* 除草 / 捉虫 / 赶鸟 / 扫粪：摘掉一条病虫记录 */
      case 'weed':
      case 'bug':
      case 'swat':
      case 'sweep': {
        if (!plot.c) return err('nothing')
        if (plot.pb?.length) plot.pb.pop()
        touch()
        return ok({ plot, bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 } })
      }

      /* 使坏：往别人地里放虫/草。受每日上限与单块地上限约束 */
      case 'bad': {
        if (mine) return err('not_yours')
        const kind = body?.kind === 'bug' ? 3 : 1
        if (!plot.c) return err('nothing')
        plot.pb ??= []
        if (plot.pb.length >= 2) return err('bad_full')
        if ((f.bad?.today | 0) >= BAD_DAILY) return err('bad_daily')
        if ((f.bad?.farm | 0) >= BAD_FARM) return err('bad_farm')
        plot.pb.push([kind, t])
        f.bad = { today: (f.bad?.today | 0) + 1, farm: (f.bad?.farm | 0) + 1 }
        touch()
        return ok({ plot, bad: { today: f.bad.today, farm: f.bad.farm } })
      }

      /* 锄地：清回空地（土力保留，种子不退） */
      case 'hoe':
      case 'till': {
        if (!mine) return err('not_yours')
        f.plots[i] = emptyPlot(plot.t | 0)
        touch()
        return ok({ plot: f.plots[i], bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 } })
      }

      /* 收获 / 偷菜 */
      case 'harvest':
      case 'steal': {
        const crop = plot.c ? cropOf(plot.c) : null
        if (!crop) return err('nothing')
        if (!canGather(plot, me().uid, t)) return err('not_ripe')

        /* 自己的地：整块收走。别人的地：最多拿 40%，且记进 `th` 防止反复偷 */
        const isSteal = !mine || act === 'steal'
        const take = isSteal ? Math.max(1, Math.round(plot.left * 0.4)) : plot.left
        const got = Math.max(0, Math.min(take, plot.left))
        if (!got) return err('nothing')

        plot.left -= got
        me().items[plot.c] = (me().items[plot.c] ?? 0) + got
        if (!isSteal) me().harvested += got
        const lv = gainExp(Math.max(1, crop.exp ?? 1))

        if (isSteal) {
          plot.th ??= []
          plot.th.push(me().uid)
          me().stolen += got
          pushLog(f, { k: 'steal', n: me().name, x: got, c: plot.c })
          /* 狗在守夜：按 `catch` 概率罚钱 */
          if (f.dog && f.dog.food > t) {
            const dog = dogOf(f.dog.id)
            if (dog && Math.random() < dog.catch) {
              const fine = Math.min(me().money, Math.round(got * (crop.sell ?? 1) * 2))
              me().money -= fine
              me().caught += 1
              touch()
              return ok({
                plot,
                bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 },
                me: playerView(),
                caught: fine,
                lv,
              })
            }
          }
          touch()
          return ok({ plot, bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 }, me: playerView(), got, item: plot.c, lv })
        }

        /* 自己的地收完：连作作物留桩继续长，一季的作物清地 */
        const seasonsLeft = (crop.seasons ?? 1) - 1
        if (crop.regrow && seasonsLeft > 0) {
          plot.p = t
          plot.s = 0
          plot.out = null
          plot.left = 0
          plot.pb = []
          plot.pen = 0
          plot.th = []
        } else {
          f.plots[i] = emptyPlot(plot.t | 0)
        }
        touch()
        return ok({
          plot: f.plots[i],
          bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 },
          me: playerView(),
          got,
          item: plot.c,
          lv,
        })
      }

      default:
        /* 不认识的动作**不要报错**：`G()` 见到 !ok 会弹 toast，
           而客户端还有一批动作名（badweed/badbug/badfly）走的是 `bad` 分支。 */
        return ok({ plot, bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 } })
    }
  }

  /* ------------------------------ 畜栏动作 ------------------------------ */

  function actPen(uid, i, act) {
    const f = farmByUid(uid)
    if (!f) return err('no_farm')
    const mine = uid === state.farm.uid
    const pen = f.pens[i]
    if (!pen) return err('nothing')
    const a = animalOf(pen.a)
    if (!a) return err('nothing')
    const t = now()
    const bad = { today: f.bad.today | 0, farm: f.bad.farm | 0 }

    switch (act) {
      case 'feed': {
        if (!mine) return err('not_yours')
        if (!(me().feed > 0)) return err('no_feed')
        if (pen.fed) return err('fed')
        me().feed -= 1
        pen.fed = t
        touch()
        return ok({ pen, bad, me: playerView() })
      }

      case 'collect':
      case 'steal': {
        if (!canCollect(pen, me().uid, t)) return err('not_ready')
        const isSteal = !mine || act === 'steal'
        const take = isSteal ? Math.max(1, Math.round(pen.stock * 0.4)) : pen.stock
        const got = Math.max(0, Math.min(take, pen.stock))
        if (!got) return err('nothing')
        pen.stock -= got
        me().items[a.product] = (me().items[a.product] ?? 0) + got
        const lv = gainExp(Math.max(1, a.exp ?? 1))
        if (isSteal) {
          pen.th ??= []
          pen.th.push(me().uid)
          me().stolen += got
          pushLog(f, { k: 'steal', n: me().name, x: got, c: a.product })
        } else if (pen.stock <= 0) {
          /* 收干净了：要吃下一顿才继续产 */
          pen.stock = 0
          pen.made = 0
          pen.fed = 0
          pen.th = []
        }
        touch()
        return ok({ pen, bad, me: playerView(), got, item: a.product, lv })
      }

      /* 驱虫 / 扫粪：摘一条病虫 */
      case 'swat':
      case 'sweep': {
        if (pen.pb?.length) pen.pb.pop()
        touch()
        return ok({ pen, bad })
      }

      default:
        return ok({ pen, bad })
    }
  }

  /* ------------------------------ 背包 ------------------------------ */

  /** 单价：作物看 `sell`，畜产品从动物表按 `product` 反查（同客户端 `r0()`） */
  function priceOf(id) {
    const c = cropOf(id)
    if (c) return c.sell ?? 1
    const a = table('animals', ANIMALS).find((x) => x.product === id)
    return a?.sell ?? 0
  }

  function sell(body) {
    const p = me()
    const items = p.items ?? {}
    const lock = p.lock ?? {}
    const ids = body?.id ? [body.id] : Object.keys(items).filter((k) => items[k] > 0 && !lock[k])
    let money = 0
    for (const id of ids) {
      const n = items[id] ?? 0
      if (n <= 0) continue
      const unit = priceOf(id)
      if (!unit) continue
      money += unit * n
      delete items[id]
    }
    if (!money) return err('empty')
    p.money += money
    const lv = gainExp(Math.max(1, Math.round(money / 10)))
    touch()
    return ok({ player: playerView(), money, lv })
  }

  /* ------------------------------ 商店 ------------------------------ */

  function buy(body) {
    const p = me()
    const f = farm()
    const n = Math.max(1, Math.min(10, body?.n ?? 1))
    const id = body?.id
    const kind = body?.kind

    const spend = (money = 0, gems = 0) => {
      if (money && p.money < money) return err('poor')
      if (gems && p.gems < gems) return err('poor')
      p.money -= money
      p.gems -= gems
      return null
    }

    if (kind === 'seed') {
      const c = cropOf(id)
      if (!c) return err('unknown')
      const bad = spend((c.seed ?? 5) * n)
      if (bad) return bad
      p.seeds[id] = (p.seeds[id] ?? 0) + n
    } else if (kind === 'animal') {
      const a = animalOf(id)
      if (!a) return err('unknown')
      const slot = f.pens.findIndex((x) => !x)
      if (slot < 0) return err('no_pen')
      const bad = spend(a.price ?? 0)
      if (bad) return bad
      f.pens[slot] = newPen(id)
    } else if (kind === 'fert') {
      const cfg = fertOf(id)
      if (!cfg) return err('unknown')
      const bad = spend((cfg.price ?? 0) * n, (cfg.gems ?? 0) * n)
      if (bad) return bad
      p.fert[id] = (p.fert[id] ?? 0) + n
    } else if (kind === 'feed') {
      const bad = spend(feedCfg().price * n)
      if (bad) return bad
      p.feed = (p.feed ?? 0) + n
    } else if (kind === 'dogfood') {
      const cfg = dogfoodCfg()
      const bad = spend(cfg.price * n)
      if (bad) return bad
      p.dogfood = (p.dogfood ?? 0) + n
    } else if (kind === 'dog') {
      const d = dogOf(id)
      if (!d) return err('unknown')
      if (p.dogs.includes(id)) return err('owned')
      const bad = spend(d.price ?? 0, d.gems ?? 0)
      if (bad) return bad
      p.dogs.push(id)
    } else if (kind === 'decor') {
      const d = decorOf(id)
      if (!d) return err('unknown')
      if (p.decors.includes(id)) return err('owned')
      const bad = spend(d.price ?? 0, d.gems ?? 0)
      if (bad) return bad
      p.decors.push(id)
    } else {
      return err('unknown')
    }

    touch()
    return ok({ player: playerView(), farm: farmView(f) })
  }

  function applyDecor(body) {
    const p = me()
    const f = farm()
    const kind = body?.kind
    const id = body?.id
    if (kind === 'dog') {
      const d = dogOf(id)
      if (!d) return err('unknown')
      if (!p.dogs.includes(id)) return err('not_owned')
      const days = Math.max(1, p.dogfood > 0 ? 1 : 0)
      if (days) p.dogfood -= 1
      f.dog = { id, food: now() + (dogfoodCfg().days ?? 1) * 86400000 * days }
    } else {
      const d = decorOf(id)
      if (!d) return err('unknown')
      if (!p.decors.includes(id)) return err('not_owned')
      f.decor[d.slot] = id
    }
    touch()
    return ok({ decor: f.decor, dog: f.dog })
  }

  /** 扩地 / 扩栏：`kind` 是 `plot` 或 `pen` */
  function expand(kind) {
    const p = me()
    const f = farm()
    if (kind === 'plot') {
      if (f.plots.length >= PLOT_MAX) return err('max')
      const step = f.plots.length - START.plots
      const row = plotCost()[step]
      if (!row) return err('max')
      const [needLv, price] = row
      if (lvOf(p.exp) < needLv) return err('level')
      if (p.money < price) return err('poor')
      p.money -= price
      f.plots.push(emptyPlot())
    } else if (kind === 'pen') {
      if (f.pens.length >= PEN_MAX) return err('max')
      const step = f.pens.length - START.pens
      const row = penCost()[step]
      if (!row) return err('max')
      const [needLv, price] = row
      if (lvOf(p.exp) < needLv) return err('level')
      if (p.money < price) return err('poor')
      p.money -= price
      f.pens.push(emptyPen())
    } else {
      return err('unknown')
    }
    touch()
    return ok({ player: playerView(), plots: f.plots, pens: f.pens })
  }

  /** 升土力：`to` 是 1 或 2，一次升一块（同客户端 `data-upgrade`） */
  function upgrade(to) {
    const p = me()
    const f = farm()
    const idx = (to | 0) - 1
    const cfg = soilCost()[idx]
    if (!cfg) return err('unknown')
    if (lvOf(p.exp) < cfg.lv) return err('level')
    const i = f.plots.findIndex((x) => (x.t | 0) < to)
    if (i < 0) return err('max')
    const price = cfg.price + cfg.step * f.plots.filter((x) => (x.t | 0) >= to).length
    if (p.money < price) return err('poor')
    if (cfg.gems && p.gems < cfg.gems) return err('poor')
    p.money -= price
    p.gems -= cfg.gems ?? 0
    f.plots[i] = { ...f.plots[i], t: to }
    touch()
    return ok({ i, plot: f.plots[i], player: playerView() })
  }

  /* ------------------------------ 一键全做 ------------------------------ */

  function allAct(uid, act) {
    const f = farmByUid(uid)
    if (!f) return err('no_farm')
    const mine = uid === state.farm.uid
    const t = now()
    const results = []

    for (let i = 0; i < f.plots.length; i++) {
      const plot = f.plots[i]
      if (!plot) continue

      if (act === 'help') {
        /* 帮忙浇水：只有别人家的地、且没浇过的才动 */
        if (mine || !plot.c || plot.w || plot.s > 0) continue
        const r = actPlot(uid, i, 'water', {})
        if (r.ok) results.push({ kind: 'plot', i, plot: r.data.plot, act: 'water' })
        continue
      }

      if (act === 'harvest' || act === 'steal') {
        if (!plot.c) continue
        if (!canGather(plot, me().uid, t)) continue
        const r = actPlot(uid, i, act, {})
        if (r.ok) results.push({ kind: 'plot', i, ...r.data })
      }
    }

    for (let i = 0; i < f.pens.length; i++) {
      const pen = f.pens[i]
      if (!pen) continue
      if (act === 'harvest' || act === 'steal') {
        if (!canCollect(pen, me().uid, t)) continue
        const r = actPen(uid, i, act === 'steal' ? 'steal' : 'collect')
        if (r.ok) results.push({ kind: 'pen', i, ...r.data })
      }
    }

    if (act === 'help' && results.length) me().help += results.length
    touch()
    return ok({ results, me: playerView(), bad: { today: f.bad.today | 0, farm: f.bad.farm | 0 } })
  }

  /* ------------------------------ 邻居 ------------------------------ */

  function friendRow(f, t) {
    /* `ripe` = 最早能偷的那块地的成熟时刻（已熟就是过去时刻） */
    let ripe = 0
    for (const plot of f.plots ?? []) {
      if (!plot?.c || plot.w) continue
      const crop = cropOf(plot.c)
      if (!crop) continue
      const at = ripeAt(plot, crop)
      if (!ripe || at < ripe) ripe = at
    }
    return {
      uid: f.uid,
      n: f.name,
      exp: f.exp ?? 0,
      dog: f.dog?.id ?? '',
      ripe,
    }
  }

  function friends() {
    const t = now()
    const list = Object.values(state.npcs).map((f) => friendRow(f, t))
    return ok({
      now: t,
      friends: list,
      top: [...list].sort((a, b) => b.exp - a.exp).slice(0, 3),
      near: list.slice(0, 3),
    })
  }

  /* ------------------------------ 引导 / 名片 / 设置 ------------------------------ */

  /** `tutorial.js` 里那张称号表，顺序别改（`t_<id>` / `tq_<id>` 是 i18n 键） */
  const TITLES = [
    'newbie',
    'green_thumb',
    'wheat_tycoon',
    'thief_novice',
    'master_thief',
    'ghost',
    'good_heart',
    'popular',
    'heartthrob',
    'landlord',
    'collector',
    'rich',
  ]

  function earnedTitles() {
    const p = me()
    const out = ['newbie']
    const push = (id, cond) => {
      if (cond) out.push(id)
    }
    push('green_thumb', p.exp >= 100)
    push('wheat_tycoon', p.exp >= 500)
    push('thief_novice', p.stolen >= 10)
    push('master_thief', p.stolen >= 100)
    push('ghost', p.caught >= 20)
    push('good_heart', p.help >= 20)
    push('popular', (p.likes ?? 0) >= 5)
    push('heartthrob', (p.likes ?? 0) >= 20)
    push('landlord', state.farm.plots.length >= 12)
    push('collector', p.decors.length >= 6)
    push('rich', p.money >= 50000)
    return TITLES.filter((t) => out.includes(t))
  }

  const dayKey = (t = now()) => new Date(t).toISOString().slice(0, 10)

  /**
   * `/card/:uid` —— 邻居名片。
   *
   * 客户端读得很硬：`s.rare.length`、`s.titles.includes(...)`、`s.stats.harvested`…
   * 少一个字段就是 `Cannot read properties of undefined`，整张名片打不开。
   */
  function cardOf(uid) {
    const self = uid === state.farm.uid
    const f = self ? state.farm : state.npcs[uid]
    if (!f) return err('no_farm')
    const p = me()
    return ok({
      uid,
      name: self ? p.name : f.name,
      avatar: self ? p.avatar : '',
      lv: lvOf(self ? p.exp : f.exp ?? 0),
      title: self ? p.title : '',
      titles: self ? earnedTitles() : [],
      likes: self ? p.likes ?? 0 : f.likes ?? 0,
      likedToday: !!p.liked?.[`${uid}:${dayKey()}`],
      /* `rare` 里 `dog_xxx` 原样用，其余客户端会补 `decor_` 前缀 */
      rare: self ? [...p.dogs.map((d) => `dog_${d}`), ...p.decors] : [],
      stats: {
        harvested: self ? p.harvested ?? 0 : 0,
        stolen: self ? p.stolen : 0,
        helped: self ? p.help : 0,
        caught: self ? p.caught : 0,
        plots: f.plots.length,
      },
    })
  }

  /** `/tut` —— 引导进度。客户端**不落盘**，全靠这个接口记 */
  function tut(body) {
    const p = me()
    p.tut ??= { s: 0, tips: {}, done: 0 }
    p.tut.tips ??= {}
    if (body?.step != null) p.tut.s = Math.max(p.tut.s | 0, body.step | 0)
    if (body?.tip) p.tut.tips[body.tip] = 1
    if (body?.cfg && typeof body.cfg === 'object') p.cfg = { ...p.cfg, ...body.cfg }
    if (body?.done) {
      let reward = 0
      if (!p.tut.done) {
        p.tut.done = 1
        p.tut.s = 3
        reward = 100
        p.money += reward
      }
      touch()
      return ok({ player: playerView(), reward })
    }
    touch()
    return ok({ player: playerView() })
  }

  /** 一粒种子都没有、钱也不够买 —— 送几粒，别把人卡死 */
  const isStuck = () => !Object.values(me().seeds ?? {}).some((n) => n > 0) && me().money < 6

  function relief() {
    if (!isStuck()) return err('not_needed')
    const n = 5
    me().seeds.wheat = (me().seeds.wheat ?? 0) + n
    touch()
    return ok({ player: playerView(), seeds: n })
  }

  function setTitle(id) {
    const p = me()
    if (id && !earnedTitles().includes(id)) return err('title_locked')
    p.title = id ?? ''
    touch()
    return ok({ player: playerView() })
  }

  function setStyle(scheme) {
    const p = me()
    const next = scheme | 0
    if ((state.farm.look ?? 0) === next) return ok({ look: next })
    const cost = 5
    if (p.gems < cost) return err('gems')
    p.gems -= cost
    state.farm.look = next
    touch()
    return ok({ look: next })
  }

  function likeFarm(uid) {
    const p = me()
    const key = `${uid}:${dayKey()}`
    if (p.liked?.[key]) return err('liked')
    p.liked ??= {}
    p.liked[key] = 1
    if (uid === state.farm.uid) {
      p.likes = (p.likes ?? 0) + 1
    } else {
      const f = state.npcs[uid]
      if (!f) return err('no_farm')
      f.likes = (f.likes ?? 0) + 1
      pushLog(f, { k: 'like', n: p.name })
    }
    touch()
    return ok({ likes: uid === state.farm.uid ? p.likes : state.npcs[uid].likes })
  }

  /* ------------------------------ 路由 ------------------------------ */

  function route(method, path, body) {
    const parts = path.replace(/^\//, '').split('/')
    const [p0, p1, p2, p3, p4] = parts

    /* `/me` 顺带结算一下，不然「按等级解锁」的按钮会一直灰着。
       `relief` 是「没种子也没钱」时的救济提示，客户端读到就会弹按钮。 */
    if (p0 === 'me') {
      if (settleFarm(state.farm)) touch()
      return ok({ player: playerView(), relief: isStuck() ? 5 : undefined })
    }

    if (p0 === 'tut') return tut(body)
    if (p0 === 'relief') return relief()
    if (p0 === 'title') return setTitle(body?.id)
    if (p0 === 'style') return setStyle(body?.scheme)
    if (p0 === 'card' && p1) return cardOf(decodeURIComponent(p1))

    if (p0 === 'hello') {
      const fresh = !state.seen
      if (body?.name) {
        me().name = body.name
        state.farm.name = body.name
      }
      if (body?.avatar) me().avatar = body.avatar
      state.seen = true
      if (ensureNpcs()) touch()
      if (settleFarm(state.farm)) touch()
      touch()
      return ok({ now: now(), player: playerView(), farm: farmView(state.farm), fresh })
    }

    if (p0 === 'friends') {
      if (p1 === 'sync') return ok({})
      if (ensureNpcs()) touch()
      return friends()
    }

    if (p0 === 'farm' && p1) {
      const uid = p1
      const f = farmByUid(uid)
      if (!f) return err('no_farm')

      if (p2 === 'enter') {
        if (settleFarm(f)) touch()
        return ok(farmView(f))
      }
      if (p2 === 'sync') {
        if (settleFarm(f)) touch()
        return ok(farmView(f))
      }
      if (p2 === 'msg') {
        const text = String(body?.text ?? '').trim().slice(0, 140)
        if (!text) return err('empty')
        f.notes ??= []
        f.notes.unshift({ n: me().name, text, t: now() })
        if (f.notes.length > 30) f.notes.length = 30
        pushLog(f, { k: 'msg', n: me().name, text })
        touch()
        return ok({ msg: f.notes })
      }
      if (p2 === 'plot') return actPlot(uid, Number(p3), p4, body)
      if (p2 === 'pen') return actPen(uid, Number(p3), p4)
      if (p2 === 'all') return allAct(uid, p3)
      if (p2 === 'like') return likeFarm(uid)
      return err('not_found', path)
    }

    if (p0 === 'bag') {
      if (p1 === 'sell') return sell(body)
      if (p1 === 'lock') {
        const id = body?.id
        if (!id) return err('empty')
        me().lock[id] = !me().lock[id]
        touch()
        return ok({ player: playerView() })
      }
      return err('not_found', path)
    }

    if (p0 === 'shop' && p1 === 'buy') return buy(body)
    if (p0 === 'decor' && p1 === 'apply') return applyDecor(body)
    if (p0 === 'expand') return expand(p1)
    if (p0 === 'upgrade') return upgrade(p1)

    return err('not_found', path)
  }

  return {
    get: async (path, body) => route('GET', path, body),
    post: async (path, body) => route('POST', path, body),
    inbox: async () => ({ ok: true, data: { items: [] } }),
    /** 调试桥 / e2e 用 */
    _state: () => state,
    _flush: flushNow,
    /**
     * 换底层存储 —— 插件挂载后把 `localStorage` 换成宿主 `host.storage`。
     *
     * **不重建 server**：`state` 是内存里那份活的，重建会用 `load()` 再读一遍，
     * 而宿主那边可能还没写完，等于把刚种下的作物退回去。
     * 换完立刻整份写一次，保证宿主侧从这一刻起拿到的是最新状态。
     */
    _setStore(next = {}) {
      if (next.load) load = next.load
      if (next.save) save = next.save
      if (next.onDirty) onDirty = next.onDirty
      flushNow()
    },
  }
}
