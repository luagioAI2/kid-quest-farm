/**
 * 心愿商城的**商品目录**。
 *
 * 和 `storefront.ts` 同一个路子：**只放数据，一行逻辑都没有**。
 * 而且同样**不入库** —— 改一个商品文案不该触发 Dexie 迁移，
 * 也不该被「导入备份」用一份旧目录覆盖掉。
 *
 * ## 两类商品，来源不同
 *
 * * **游戏**（盲盒 / 盒子）：从 `LOCAL_GAMES` + `STOREFRONT` **推导**，
 *   不手写。21 款游戏各写一条的话，下次加游戏就一定会漏 ——
 *   而漏掉的那款在界面上表现为「盒子里没有它」，不报错。
 * * **实物**：手写。这些是商家给的东西，没法推导。
 *
 * ## 外链（2026-11-06 第七轮：只剩服务端那一份）
 *
 * 目录里**不再有** `buyUrl` / `buyLabel`。外链的唯一来源是
 * `wish_item.buy_url`（运营在 tf-admin「商城」列表里配的那条），
 * 由服务端随商品列表下发，客户端缓存在 `wishBuyLinks` 里
 * （`db.ts` 的 `WISH_BUY_LINKS_KEY`）。
 *
 * ⚠️ 这里原来有一套「没配就现拼一条淘宝搜索页」的兜底（`wishBuyUrl`）。
 *    删掉是因为它让**「后台没配」和「配了」在界面上长得一模一样** ——
 *    用户看到的是一颗永远在、但和后台配置毫无关系的按钮。
 *    现在：没配 = 没有按钮。
 */

import type { WishItem } from '../domain/types'
import { LOCAL_GAMES } from './localGames'
import { STOREFRONT } from './storefront'

/** 盲盒的商品 id（列表要把它钉在最前面，所以需要常量） */
export const WISH_BLINDBOX_ID = 'wish-blindbox'

/** 盲盒池 = 全部随包发布的插件游戏 */
const GAME_POOL: string[] = LOCAL_GAMES.map((g) => g.id)

/**
 * 「一次开 5 款」盲盒的商品 id。
 *
 * 与服务端 `seed/wish_catalog.go` 的 `WishBlindBox5ID` 保持一致 ——
 * 两边不一致的症状是「本地有这个商品，服务端说没有这件商品」，
 * 孩子点兑换只会收到一句「商品不存在」。
 */
export const WISH_BLINDBOX5_ID = 'wish-blindbox-5'

const BLINDBOX: WishItem = {
  id: WISH_BLINDBOX_ID,
  kind: 'blindbox',
  name: '游戏盲盒',
  emoji: '🎁',
  tint: 'sun',
  pool: GAME_POOL,
  note: '随机开出 1 款你还没有的游戏',
  notice: '不会开出你已经有的游戏。全部都有了就不能买啦。',
  sortOrder: 0,
}

/**
 * 5 连开。池子**照抄**单开的（全部游戏）—— 拥有关系是每个家庭不同的，
 * 「已经解锁的不计算」是靠开奖时先减掉已拥有实现的，不能写进池子。
 *
 * `sortOrder: 1` ⇒ 排在单开盲盒后面、实物前面（见 `compareWishItem`）。
 */
const BLINDBOX5: WishItem = {
  id: WISH_BLINDBOX5_ID,
  kind: 'blindbox',
  name: '游戏盲盒 · 5 连开',
  emoji: '🎉',
  tint: 'grape',
  pool: GAME_POOL,
  unlockCount: 5,
  note: '一次开出 5 款你还没有的游戏',
  notice: '只会开出你还没有的游戏。没解锁的不足 5 款时换不了 —— 等新的游戏再来。',
  sortOrder: 1,
}

/**
 * 游戏盒子：一款一条，**从现有的商店目录推导**。
 *
 * 用 `STOREFRONT` 而不是 `LOCAL_GAMES` 取名字和图标，是因为
 * `LOCAL_GAMES` 是脚本生成的（名字来自包的 manifest，偏机械），
 * 而 `STOREFRONT` 是给家长看的文案，名字和图标更适合摆在商城里。
 * 两个列表的 id 一一对应由 `check:registry` 保证。
 *
 * ⚠️ `sortOrder` 从 **100** 起，故意排在实物（20~24）后面。
 * 21 款游戏盒子如果排在前面，会把泡泡玛特、学习机这些**商家商品**
 * 全部压到屏幕外 —— 而「接商家」才是这个商城的目的。
 * 盲盒仍然是 0（用户要求优先显示），所以顺序是：盲盒 → 实物 → 游戏盒子。
 */
const GAME_BOXES: WishItem[] = STOREFRONT.map((s, i) => ({
  id: `wish-game-${s.id}`,
  kind: 'gamebox',
  name: s.name,
  emoji: s.emoji,
  tint: s.tint,
  gameId: s.id,
  note: s.pitch,
  sortOrder: 100 + i,
  /**
   * 游戏在淘宝上是**卖卡**的（卡背印激活码），所以搜的是「名字 + 激活码」。
   *
   * 2026-10-30 之前这里**一个外链都没有** —— 家长在心愿商城看上一款游戏，
   * 想花钱买却点不到任何东西（只有「定券价」那条路），
   * 而 `wish_item.buy_url` 在库里也是空的。
   *
   * 用搜索页而不是具体商品链接，理由和实物商品一样：链接会失效 / 换 SKU /
   * 被下架，而目录跟着版本发布 —— **一个失效的链接比没有链接更糟**。
   */
}))

/**
 * 实物商品。
 *
 * 这些是**样例数据** —— 合作商还没正式接进来，先用手写的几条把链路跑通。
 * 接商家时整块替换，不需要改任何逻辑。
 */
const PHYSICAL: WishItem[] = [
  {
    id: 'wish-popmart',
    kind: 'collectible',
    name: '泡泡玛特盲盒',
    emoji: '🧸',
    tint: 'grape',
    partnerName: '泡泡玛特',
    priceCents: 6900,
    ageRange: [6, 99],
    note: '随机款，不指定款式',
    notice: '盲盒不指定款式。拆开之后不能退换。',
    sortOrder: 20,
  },
  {
    id: 'wish-study-pad',
    kind: 'study',
    name: '儿童学习机',
    emoji: '📚',
    tint: 'sky',
    partnerName: '小天才',
    priceCents: 39900,
    ageRange: [6, 12],
    note: '10.1 英寸 · 含学习卡',
    notice: '大件商品，建议先和爸妈一起看看型号再决定。',
    sortOrder: 21,
  },
  {
    id: 'wish-dino',
    kind: 'toy',
    name: '恐龙模型套装',
    emoji: '🦖',
    tint: 'grass',
    partnerName: '玩具仓',
    priceCents: 8900,
    ageRange: [4, 10],
    note: '12 只装 · 带收纳盒',
    sortOrder: 22,
  },
  {
    id: 'wish-puzzle',
    kind: 'toy',
    name: '1000 片拼图',
    emoji: '🧩',
    tint: 'tan',
    partnerName: '拼图工坊',
    priceCents: 4500,
    ageRange: [8, 99],
    note: '风景款 · 成品 70×50cm',
    sortOrder: 23,
  },
  {
    id: 'wish-sticker',
    kind: 'toy',
    name: '闪光贴纸册',
    emoji: '✨',
    tint: 'berry',
    partnerName: '文具角',
    priceCents: 1900,
    ageRange: [4, 12],
    note: '含 200 张 · 可反复贴',
    sortOrder: 24,
  },
  /* ---- 2026-10-29 新增两档分类的样例（用户要求「前面再加美食，出行」）----
     没有这两条的话，心愿页和兑换页会各多出一个**点进去是空的**分类按钮。
     和上面几条一样是样例数据，接商家时整块替换。 */
  {
    id: 'wish-cake',
    kind: 'food',
    name: '生日蛋糕',
    emoji: '🍰',
    tint: 'berry',
    partnerName: '甜心烘焙',
    priceCents: 12800,
    ageRange: [3, 99],
    note: '6 寸 · 可以写名字',
    notice: '要提前一天预订，爸妈下单时记得选日期。',
    sortOrder: 25,
  },
  {
    id: 'wish-zoo',
    kind: 'outing',
    name: '动物园一日游',
    emoji: '🎡',
    tint: 'grass',
    partnerName: '城市动物园',
    priceCents: 12000,
    ageRange: [3, 12],
    note: '含 1 大 1 小两张门票',
    notice: '出行类按当天预约情况走，去之前先确认场次。',
    sortOrder: 26,
  },
]

/** 全部商品。顺序由 `compareWishItem` 在渲染时决定，这里只管内容 */
export const WISH_ITEMS: WishItem[] = [BLINDBOX, BLINDBOX5, ...GAME_BOXES, ...PHYSICAL]

/** 按 id 找商品。找不到返回 `undefined` —— 老存档里可能有已下架的商品 id */
export function wishItemById(id: string): WishItem | undefined {
  return WISH_ITEMS.find((i) => i.id === id)
}

/** 盲盒的候选池（未减去已拥有；减法是 `domain/wish.ts` 的 `blindBoxRemaining`） */
export const WISH_BLINDBOX_POOL: readonly string[] = GAME_POOL
