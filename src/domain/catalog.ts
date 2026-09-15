import type { ItemDef, CropDef, AnimalDef } from './types'

/* ============================================================
   内容表：作物 / 动物 / 道具 / 市场价

   经济口径（2026-09-15 由用户锁死，改数值前必须先读）：

     上限回收   = 成本 × (1 + r)          r 由家长设，默认 0.6
     基准单价   = 上限回收 ÷ 总产出量      **按最高产量算，不做分位打折**
     总产出量   = 作物：收获次数
                  动物：产出次数 × 单次产量

   三个要点：
   1. **闸门是一轮的事，不是终身的事。** 卖满这一轮就结束，下一轮重新买种子。
      种子永远买得到、地永远能再种。
   2. **动物产够 `produceTimes` 次就停产，但动物留在农场里。**
      不要再退回「靠寿命一直产」——旧模型下小鸡成本 40 能换回约 20000。
   3. **配置表数值是定的，实际产出会被灾害打折。** 灾害把产量期望压到
      约 0.87 倍，所以实测期望浮盈 +31%~+41%，而不是贴着 60% 上限。
   4. **所有标的共用同一套灾害分布，没有「这作物更娇气」这回事。**
      旧的 `CropDef.fragility` 已删除（2026-09-15）：一旦每个作物有自己的
      减产概率，上面那条「基准单价 = 上限回收 ÷ 最高产量」推出来的
      期望浮盈就不再统一，§5.6 那张表全部作废。要差异化请改**成本 / 次数 / 间隔**，
      不要偷偷加回一个概率倍率。

   完整数值表见 docs/farm-economy-design.md §5.6（权威），
   每分钟浮盈必须严格随解锁等级递增，三档（作物 / 果树 / 动物）要拉开。
   ============================================================ */

export const CROPS: CropDef[] = [
  {
    id: 'radish',
    name: '小萝卜',
    emoji: '🥬',
    stageEmojis: ['🌱', '🌿', '🌿', '🥬'],
    growMinutes: 2,
    seedCost: 2,
    harvestPoints: 3.2,
    produceItemId: 'produce-radish',
    produceAmount: 4,
    regrowCount: 1,
    kind: 'annual',
    unlockLevel: 1,
  },
  {
    id: 'carrot',
    name: '胡萝卜',
    emoji: '🥕',
    stageEmojis: ['🌱', '🌿', '🌿', '🥕'],
    growMinutes: 3,
    seedCost: 4,
    harvestPoints: 6.4,
    produceItemId: 'produce-carrot',
    produceAmount: 4,
    regrowCount: 1,
    kind: 'annual',
    unlockLevel: 1,
  },
  {
    id: 'rose',
    name: '玫瑰花',
    emoji: '🌹',
    stageEmojis: ['🌱', '🌿', '🌷', '🌹'],
    growMinutes: 6,
    regrowMinutes: 4,
    seedCost: 16,
    harvestPoints: 8.5,
    produceItemId: 'rose-bloom',
    produceAmount: 4,
    regrowCount: 3,
    kind: 'flower',
    unlockLevel: 1,
  },
  {
    id: 'strawberry',
    name: '草莓',
    emoji: '🍓',
    stageEmojis: ['🌱', '🌿', '🌸', '🍓'],
    growMinutes: 10,
    regrowMinutes: 7,
    seedCost: 24,
    harvestPoints: 19.2,
    produceItemId: 'produce-strawberry',
    produceAmount: 4,
    regrowCount: 2,
    kind: 'annual',
    unlockLevel: 2,
  },
  {
    id: 'corn',
    name: '玉米',
    emoji: '🌽',
    stageEmojis: ['🌱', '🌿', '🌾', '🌽'],
    growMinutes: 16,
    regrowMinutes: 11,
    seedCost: 44,
    harvestPoints: 35.2,
    produceItemId: 'produce-corn',
    produceAmount: 4,
    regrowCount: 2,
    kind: 'annual',
    unlockLevel: 2,
  },
  {
    id: 'tomato',
    name: '番茄',
    emoji: '🍅',
    stageEmojis: ['🌱', '🌿', '🍀', '🍅'],
    growMinutes: 20,
    regrowMinutes: 14,
    seedCost: 115,
    harvestPoints: 61.3,
    produceItemId: 'produce-tomato',
    produceAmount: 4,
    regrowCount: 3,
    kind: 'annual',
    unlockLevel: 3,
  },
  {
    id: 'pumpkin',
    name: '南瓜',
    emoji: '🎃',
    stageEmojis: ['🌱', '🌿', '🍃', '🎃'],
    growMinutes: 10,
    regrowMinutes: 7,
    seedCost: 60,
    harvestPoints: 24,
    produceItemId: 'produce-pumpkin',
    produceAmount: 4,
    regrowCount: 4,
    kind: 'annual',
    unlockLevel: 3,
  },
  {
    id: 'watermelon',
    name: '西瓜',
    emoji: '🍉',
    stageEmojis: ['🌱', '🌿', '🌼', '🍉'],
    growMinutes: 30,
    regrowMinutes: 21,
    seedCost: 240,
    harvestPoints: 96,
    produceItemId: 'produce-watermelon',
    produceAmount: 4,
    regrowCount: 4,
    kind: 'annual',
    unlockLevel: 4,
  },
  /* ---------------- 多年生：一次种下，反复结果 ---------------- */
  {
    id: 'apple-tree',
    name: '苹果树',
    emoji: '🍎',
    stageEmojis: ['🌱', '🌿', '🌳', '🍎'],
    growMinutes: 45,
    regrowMinutes: 30,
    seedCost: 305,
    harvestPoints: 61,
    produceItemId: 'produce-apple',
    produceAmount: 4,
    regrowCount: 8,
    kind: 'perennial',
    lifespanMinutes: 60 * 24 * 20,
    unlockLevel: 4,
  },
  {
    id: 'lemon-tree',
    name: '柠檬树',
    emoji: '🍋',
    stageEmojis: ['🌱', '🌿', '🌳', '🍋'],
    growMinutes: 60,
    regrowMinutes: 45,
    seedCost: 670,
    harvestPoints: 107.2,
    produceItemId: 'lemonade',
    produceAmount: 4,
    regrowCount: 10,
    kind: 'perennial',
    lifespanMinutes: 60 * 24 * 26,
    unlockLevel: 5,
  },
  {
    id: 'sunflower',
    name: '向日葵',
    emoji: '🌻',
    stageEmojis: ['🌱', '🌿', '🌿', '🌻'],
    growMinutes: 50,
    regrowMinutes: 35,
    seedCost: 500,
    harvestPoints: 200,
    produceItemId: 'produce-sunflower',
    produceAmount: 4,
    regrowCount: 4,
    kind: 'flower',
    unlockLevel: 5,
  },
  {
    id: 'magic-bean',
    name: '魔法豆',
    emoji: '🫘',
    stageEmojis: ['🌱', '🌿', '✨', '🫘'],
    growMinutes: 40,
    regrowMinutes: 28,
    seedCost: 800,
    harvestPoints: 213.3,
    produceItemId: 'produce-magic-bean',
    produceAmount: 4,
    regrowCount: 6,
    kind: 'annual',
    unlockLevel: 6,
  },
]

/**
 * 动物：**产够 `produceTimes` 次就停产，但动物留在农场里。**
 *
 * `lifespanMinutes` 已降级为纯展示（等于生产窗口），**不再决定产出**。
 * 老模型是「活 8 天、每 12 分钟下一个蛋」，小鸡成本 40 能换回约 20000 —— 已废弃。
 */
export const ANIMALS: AnimalDef[] = [
  {
    id: 'chicken',
    name: '小鸡',
    emoji: '🐔',
    babyEmoji: '🐤',
    matureMinutes: 15,
    cost: 78,
    produceItemId: 'egg',
    produceItemName: '鸡蛋',
    produceEmoji: '🥚',
    produceIntervalMinutes: 60,
    produceAmount: 4,
    produceTimes: 5,
    lifespanMinutes: 315,
    fragility: 0.3,
    unlockLevel: 1,
  },
  {
    id: 'duck',
    name: '小鸭',
    emoji: '🦆',
    babyEmoji: '🐥',
    matureMinutes: 20,
    cost: 130,
    produceItemId: 'feather',
    produceItemName: '羽毛',
    produceEmoji: '🪶',
    produceIntervalMinutes: 90,
    produceAmount: 4,
    produceTimes: 5,
    lifespanMinutes: 470,
    fragility: 0.5,
    unlockLevel: 2,
  },
  {
    id: 'sheep',
    name: '绵羊',
    emoji: '🐑',
    babyEmoji: '🐏',
    matureMinutes: 30,
    cost: 270,
    produceItemId: 'wool',
    produceItemName: '羊毛',
    produceEmoji: '🧶',
    produceIntervalMinutes: 150,
    produceAmount: 4,
    produceTimes: 6,
    lifespanMinutes: 930,
    fragility: 0.7,
    unlockLevel: 2,
  },
  {
    id: 'pig',
    name: '小猪',
    emoji: '🐷',
    babyEmoji: '🐖',
    matureMinutes: 40,
    cost: 550,
    produceItemId: 'truffle',
    produceItemName: '松露',
    produceEmoji: '🍄',
    produceIntervalMinutes: 240,
    produceAmount: 4,
    produceTimes: 6,
    lifespanMinutes: 1480,
    fragility: 1,
    unlockLevel: 3,
  },
  {
    id: 'cow',
    name: '奶牛',
    emoji: '🐄',
    babyEmoji: '🐮',
    matureMinutes: 60,
    cost: 1400,
    produceItemId: 'milk',
    produceItemName: '牛奶',
    produceEmoji: '🥛',
    produceIntervalMinutes: 360,
    produceAmount: 8,
    produceTimes: 8,
    lifespanMinutes: 2940,
    fragility: 1.2,
    unlockLevel: 4,
  },
]

export const ITEMS: ItemDef[] = [
  // --- 种子（直接用于种植） ---
  { id: 'seed-radish', name: '小萝卜种子', emoji: '🌰', desc: '2 分钟就能拔的小萝卜，新手首选', rarity: 'common', speciesId: 'radish' },
  { id: 'seed-carrot', name: '胡萝卜种子', emoji: '🌰', desc: '种下去，一会儿就能拔胡萝卜', rarity: 'common', speciesId: 'carrot' },
  { id: 'seed-rose', name: '玫瑰种子', emoji: '🌰', desc: '开花了可以反复摘，很受欢迎', rarity: 'common', speciesId: 'rose' },
  { id: 'seed-strawberry', name: '草莓种子', emoji: '🌰', desc: '甜甜的草莓，还能反复结果', rarity: 'common', speciesId: 'strawberry' },
  { id: 'seed-corn', name: '玉米种子', emoji: '🌰', desc: '金黄的玉米棒子', rarity: 'common', speciesId: 'corn' },
  { id: 'seed-tomato', name: '番茄种子', emoji: '🌰', desc: '红彤彤的番茄', rarity: 'rare', speciesId: 'tomato' },
  { id: 'seed-pumpkin', name: '南瓜种子', emoji: '🌰', desc: '能长好大的南瓜', rarity: 'rare', speciesId: 'pumpkin' },
  { id: 'seed-watermelon', name: '西瓜种子', emoji: '🌰', desc: '夏天最想要的西瓜', rarity: 'rare', speciesId: 'watermelon' },
  { id: 'seed-apple-tree', name: '苹果树苗', emoji: '🌳', desc: '种一次，年年都有苹果摘', rarity: 'rare', speciesId: 'apple-tree' },
  { id: 'seed-lemon-tree', name: '柠檬树苗', emoji: '🌳', desc: '结的柠檬能榨汁卖钱', rarity: 'epic', speciesId: 'lemon-tree' },
  { id: 'seed-sunflower', name: '向日葵种子', emoji: '🌰', desc: '会朝着太阳开花', rarity: 'epic', speciesId: 'sunflower' },
  { id: 'seed-magic-bean', name: '魔法豆种子', emoji: '✨', desc: '传说中的魔法豆，长得很慢但很值钱', rarity: 'epic', speciesId: 'magic-bean' },

  // --- 动物幼崽 ---
  { id: 'baby-chicken', name: '小鸡仔', emoji: '🐤', desc: '毛绒绒的小黄球', rarity: 'common', animalId: 'chicken' },
  { id: 'baby-duck', name: '小鸭仔', emoji: '🐥', desc: '摇摇摆摆走路', rarity: 'common', animalId: 'duck' },
  { id: 'baby-sheep', name: '小羊羔', emoji: '🐏', desc: '软绵绵的，会产羊毛', rarity: 'rare', animalId: 'sheep' },
  { id: 'baby-pig', name: '小猪仔', emoji: '🐖', desc: '会帮你找松露', rarity: 'rare', animalId: 'pig' },
  { id: 'baby-cow', name: '小牛犊', emoji: '🐮', desc: '长大后产牛奶', rarity: 'epic', animalId: 'cow' },

  // --- 收获产出物（**可卖**，是收入本体） ---
  { id: 'produce-radish', name: '小萝卜', emoji: '🥬', desc: '刚从地里拔出来的', rarity: 'common' },
  { id: 'produce-carrot', name: '胡萝卜', emoji: '🥕', desc: '脆生生的', rarity: 'common' },
  { id: 'rose-bloom', name: '玫瑰花', emoji: '🌹', desc: '可以送人，也可以卖掉', rarity: 'common' },
  { id: 'produce-strawberry', name: '草莓', emoji: '🍓', desc: '甜甜的，市场里很抢手', rarity: 'common' },
  { id: 'produce-corn', name: '玉米', emoji: '🌽', desc: '金灿灿的玉米棒', rarity: 'common' },
  { id: 'produce-tomato', name: '番茄', emoji: '🍅', desc: '红彤彤的', rarity: 'rare' },
  { id: 'produce-pumpkin', name: '南瓜', emoji: '🎃', desc: '好大一个', rarity: 'rare' },
  { id: 'produce-watermelon', name: '西瓜', emoji: '🍉', desc: '夏天最想要的', rarity: 'rare' },
  { id: 'produce-apple', name: '苹果', emoji: '🍎', desc: '树上刚摘的', rarity: 'rare' },
  { id: 'lemonade', name: '柠檬汁', emoji: '🍹', desc: '酸酸甜甜', rarity: 'rare' },
  { id: 'produce-sunflower', name: '向日葵', emoji: '🌻', desc: '朝着太阳开的花', rarity: 'epic' },
  { id: 'produce-magic-bean', name: '魔法豆', emoji: '🫘', desc: '传说中的魔法豆', rarity: 'epic' },
  { id: 'egg', name: '鸡蛋', emoji: '🥚', desc: '小鸡的礼物', rarity: 'common' },
  { id: 'feather', name: '羽毛', emoji: '🪶', desc: '轻飘飘的', rarity: 'common' },
  { id: 'wool', name: '羊毛', emoji: '🧶', desc: '可以织毛衣', rarity: 'common' },
  { id: 'truffle', name: '松露', emoji: '🍄', desc: '很稀有的美味', rarity: 'rare' },
  { id: 'milk', name: '牛奶', emoji: '🥛', desc: '每天一杯长高高', rarity: 'common' },

  // --- 收藏品（**不可卖**，只是纪念） ---
  { id: 'fertilizer', name: '神奇肥料', emoji: '💩', desc: '让作物立刻长大一截', rarity: 'rare' },
  { id: 'golden-coin', name: '金币', emoji: '🪙', desc: '亮闪闪的纪念品', rarity: 'epic' },
  { id: 'lucky-star', name: '幸运星', emoji: '⭐', desc: '最稀有的收藏品', rarity: 'epic' },
  { id: 'sticker', name: '奖励贴纸', emoji: '🌟', desc: '贴在日记本上的奖励', rarity: 'common' },
  { id: 'medal', name: '小奖章', emoji: '🏅', desc: '坚持的证明', rarity: 'rare' },
  { id: 'gem', name: '宝石', emoji: '💎', desc: '超级稀有的奖励', rarity: 'epic' },
]

/* ---------------- 索引 ---------------- */

export const CROP_BY_ID = new Map(CROPS.map((c) => [c.id, c]))
export const ANIMAL_BY_ID = new Map(ANIMALS.map((a) => [a.id, a]))
export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]))

/** 可购买的种子（按农场商店展示顺序） */
export const SHOP_SEEDS = CROPS.map((c) => c.id)

/** 可购买的动物幼崽 */
export const SHOP_ANIMALS = ANIMALS.map((a) => a.id)

/* ============================================================
   经济口径
   ============================================================ */

/** 家长设的浮盈倍率默认值。`上限回收 = 成本 × (1 + r)` */
export const DEFAULT_PROFIT_RATIO = 0.6
/** 家长可调范围。低于 0.2 种地没意义，高于 1.2 通胀 */
export const MIN_PROFIT_RATIO = 0.2
export const MAX_PROFIT_RATIO = 1.2

/**
 * 闸门：**一轮**最多能卖回多少丰收币。
 *
 * 注意是「一轮」—— 卖满这一轮就结束，下一轮重新买种子、重新算上限。
 * 种子永远买得到、地永远能再种（用户 2026-09-15 明确）。
 */
export function roundCap(cost: number, r = DEFAULT_PROFIT_RATIO): number {
  const clamped = Math.min(MAX_PROFIT_RATIO, Math.max(MIN_PROFIT_RATIO, r))
  return cost * (1 + clamped)
}

/**
 * 产出的「基准市场价」= `上限回收 ÷ 总产出量`（**按最高产量算**）。
 *
 * 分母 = 作物 `收获次数 × 4`；动物 `产出次数 × 单次产量`。
 * **单次产量取 4 是为了让灾害倍率（0.45~1.2）能用整数表达** ——
 * 每次只产 1 个的话 `round(1 × 0.7) = 1`，灾害就完全看不见了。
 * 放大单次产量**不改变任何经济数值**（`产量 × 单价` 恒定），只改变颗粒度。
 *
 * 价格取 1 位小数，并且**一律向下取**（`floor`）：
 *
 *     单价 = floor(上限回收 ÷ 总产出量 × 10) / 10
 *
 * 为什么必须向下：向上取整会让「满产 × 单价」**超过**上限回收，
 * 于是最后 1 个产出永远卖不掉（闸门不让过），背包里留一个死库存。
 * 苹果（15.3 → 32 个 = 489.6 > 488）和小猪（36.7 → 24 个 = 880.8 > 880）
 * 就是这么被抓出来的。改配置表必须重跑 `domain/economy.test.ts` 的对账。
 */
export const PRODUCE_BASE_PRICE: Record<string, number> = {
  // 作物
  'produce-radish': 0.8,
  'produce-carrot': 1.6,
  'rose-bloom': 2.1,
  'produce-strawberry': 4.8,
  'produce-corn': 8.8,
  'produce-tomato': 15.3,
  'produce-pumpkin': 6,
  'produce-watermelon': 24,
  'produce-apple': 15.2,
  lemonade: 26.8,
  'produce-sunflower': 50,
  'produce-magic-bean': 53.3,
  // 动物
  egg: 6.2,
  feather: 10.4,
  wool: 18,
  truffle: 36.6,
  milk: 35,
}

/** 市场里可以卖的产出，按展示顺序 */
export const MARKET_GOODS = Object.keys(PRODUCE_BASE_PRICE)

/**
 * 价格浮动上限系数。
 * 现价永远 <= base * PRICE_CEILING，保证「上限以下浮动」。
 */
export const PRICE_CEILING = 1.6
/** 价格下限系数，避免跌破成本让人绝望 */
export const PRICE_FLOOR = 0.55

/** 价格每日最大波动幅度（±%） */
export const PRICE_DAILY_SWING = 0.22

/** 行情历史保留天数 */
export const MARKET_HISTORY_DAYS = 14

/**
 * 单日卖出对价格的下压系数：
 * 每卖出 1 个，价格向下跌 0.6%，最低不低于 base * PRICE_FLOOR。
 * 这样「一口气全卖光」会砸盘，教会孩子分批出货 —— 市场教育点。
 */
export const SELL_IMPACT_PER_UNIT = 0.006

/** 从作物定义取指定阶段的 emoji */
export function cropStageEmoji(crop: CropDef, stage: 0 | 1 | 2 | 3): string {
  return crop.stageEmojis[stage]
}

/** 兼容旧引用：产出出售基准价 */
export const PRODUCE_SELL_PRICE: Record<string, number> = PRODUCE_BASE_PRICE
