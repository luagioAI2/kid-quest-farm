import type { ItemDef, CropDef, AnimalDef } from './types'

/* ============================================================
   内容表：作物 / 动物 / 道具 / 市场价
   低龄友好 —— 名字短、emoji 大、生长周期短（分钟级到小时级）

   经济平衡总原则（重要，改数值前先读）：
   1. 一切以「每分钟净收益」为标尺，目标区间 1.5 ~ 4 分/分钟。
      低于 1.5 太劝退，高于 4 就会通货膨胀、兑换失控。
   2. 种子越贵、周期越长，单位时间收益只允许「略微」更高（风险溢价），
      不允许翻倍 —— 长周期用「随机事件风险」换收益空间。
   3. 一次性作物给「回本快」的小额确定性收益；
      多年生作物（果树）给「持续现金流」，但随时可能被事件带走。
   4. 所有 harvestPoints / seedCost 都只是「基准值」，
      实际到手按当日市价浮动（见 market.ts）。
   ============================================================ */

export const CROPS: CropDef[] = [
  {
    id: 'radish',
    name: '小萝卜',
    emoji: '🥬',
    stageEmojis: ['🌱', '🌿', '🌿', '🥬'],
    growMinutes: 2,
    seedCost: 3,
    harvestPoints: 6,
    regrowCount: 1,
    kind: 'annual',
    fragility: 0.6,
    unlockLevel: 1,
  },
  {
    id: 'carrot',
    name: '胡萝卜',
    emoji: '🥕',
    stageEmojis: ['🌱', '🌿', '🌿', '🥕'],
    growMinutes: 4,
    seedCost: 6,
    harvestPoints: 13,
    regrowCount: 1,
    kind: 'annual',
    fragility: 0.7,
    unlockLevel: 1,
  },
  {
    id: 'rose',
    name: '玫瑰花',
    emoji: '🌹',
    stageEmojis: ['🌱', '🌿', '🌷', '🌹'],
    growMinutes: 6,
    seedCost: 10,
    harvestPoints: 22,
    harvestItemId: 'rose-bloom',
    harvestItemCount: 1,
    regrowCount: 3,
    kind: 'flower',
    fragility: 1.2,
    unlockLevel: 1,
  },
  {
    id: 'strawberry',
    name: '草莓',
    emoji: '🍓',
    stageEmojis: ['🌱', '🌿', '🌸', '🍓'],
    growMinutes: 10,
    seedCost: 18,
    harvestPoints: 36,
    harvestItemId: 'seed-strawberry',
    harvestItemCount: 1,
    regrowCount: 2,
    kind: 'annual',
    fragility: 1,
    unlockLevel: 2,
  },
  {
    id: 'corn',
    name: '玉米',
    emoji: '🌽',
    stageEmojis: ['🌱', '🌿', '🌾', '🌽'],
    growMinutes: 18,
    seedCost: 34,
    harvestPoints: 68,
    regrowCount: 2,
    kind: 'annual',
    fragility: 0.9,
    unlockLevel: 2,
  },
  {
    id: 'tomato',
    name: '番茄',
    emoji: '🍅',
    stageEmojis: ['🌱', '🌿', '🍀', '🍅'],
    growMinutes: 25,
    seedCost: 55,
    harvestPoints: 108,
    harvestItemId: 'fertilizer',
    harvestItemCount: 1,
    regrowCount: 3,
    kind: 'annual',
    fragility: 1.1,
    unlockLevel: 3,
  },
  {
    id: 'pumpkin',
    name: '南瓜',
    emoji: '🎃',
    stageEmojis: ['🌱', '🌿', '🍃', '🎃'],
    growMinutes: 40,
    seedCost: 100,
    harvestPoints: 196,
    regrowCount: 1,
    kind: 'annual',
    fragility: 1,
    unlockLevel: 3,
  },
  {
    id: 'watermelon',
    name: '西瓜',
    emoji: '🍉',
    stageEmojis: ['🌱', '🌿', '🌼', '🍉'],
    growMinutes: 60,
    seedCost: 170,
    harvestPoints: 330,
    harvestItemId: 'seed-watermelon',
    harvestItemCount: 1,
    regrowCount: 2,
    kind: 'annual',
    fragility: 1.3,
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
    seedCost: 130,
    harvestPoints: 128,
    regrowCount: 8,
    kind: 'perennial',
    lifespanMinutes: 60 * 24 * 20,
    fragility: 1.1,
    unlockLevel: 4,
  },
  {
    id: 'lemon-tree',
    name: '柠檬树',
    emoji: '🍋',
    stageEmojis: ['🌱', '🌿', '🌳', '🍋'],
    growMinutes: 60,
    regrowMinutes: 45,
    seedCost: 240,
    harvestPoints: 232,
    harvestItemId: 'lemonade',
    harvestItemCount: 1,
    regrowCount: 10,
    kind: 'perennial',
    lifespanMinutes: 60 * 24 * 26,
    fragility: 1.2,
    unlockLevel: 5,
  },
  {
    id: 'sunflower',
    name: '向日葵',
    emoji: '🌻',
    stageEmojis: ['🌱', '🌿', '🌿', '🌻'],
    growMinutes: 100,
    seedCost: 280,
    harvestPoints: 580,
    harvestItemId: 'golden-coin',
    harvestItemCount: 1,
    regrowCount: 3,
    kind: 'flower',
    fragility: 1,
    unlockLevel: 5,
  },
  {
    id: 'magic-bean',
    name: '魔法豆',
    emoji: '🫘',
    stageEmojis: ['🌱', '🌿', '✨', '🫘'],
    growMinutes: 240,
    seedCost: 800,
    harvestPoints: 2050,
    harvestItemId: 'lucky-star',
    harvestItemCount: 1,
    regrowCount: 2,
    kind: 'annual',
    fragility: 1.6,
    unlockLevel: 6,
  },
]

export const ANIMALS: AnimalDef[] = [
  {
    id: 'chicken',
    name: '小鸡',
    emoji: '🐔',
    babyEmoji: '🐤',
    matureMinutes: 10,
    cost: 40,
    produceItemId: 'egg',
    produceItemName: '鸡蛋',
    produceEmoji: '🥚',
    produceIntervalMinutes: 12,
    produceAmount: 1,
    lifespanMinutes: 60 * 24 * 8,
    fragility: 0.6,
    unlockLevel: 1,
  },
  {
    id: 'duck',
    name: '小鸭',
    emoji: '🦆',
    babyEmoji: '🐥',
    matureMinutes: 14,
    cost: 70,
    produceItemId: 'feather',
    produceItemName: '羽毛',
    produceEmoji: '🪶',
    produceIntervalMinutes: 15,
    produceAmount: 1,
    lifespanMinutes: 60 * 24 * 9,
    fragility: 0.7,
    unlockLevel: 2,
  },
  {
    id: 'sheep',
    name: '绵羊',
    emoji: '🐑',
    babyEmoji: '🐏',
    matureMinutes: 24,
    cost: 150,
    produceItemId: 'wool',
    produceItemName: '羊毛',
    produceEmoji: '🧶',
    produceIntervalMinutes: 25,
    produceAmount: 1,
    lifespanMinutes: 60 * 24 * 14,
    fragility: 0.9,
    unlockLevel: 2,
  },
  {
    id: 'pig',
    name: '小猪',
    emoji: '🐷',
    babyEmoji: '🐖',
    matureMinutes: 30,
    cost: 220,
    produceItemId: 'truffle',
    produceItemName: '松露',
    produceEmoji: '🍄',
    produceIntervalMinutes: 40,
    produceAmount: 1,
    lifespanMinutes: 60 * 24 * 12,
    fragility: 1.1,
    unlockLevel: 3,
  },
  {
    id: 'cow',
    name: '奶牛',
    emoji: '🐄',
    babyEmoji: '🐮',
    matureMinutes: 45,
    cost: 420,
    produceItemId: 'milk',
    produceItemName: '牛奶',
    produceEmoji: '🥛',
    produceIntervalMinutes: 45,
    produceAmount: 2,
    lifespanMinutes: 60 * 24 * 22,
    fragility: 1,
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

  // --- 产出物 ---
  { id: 'egg', name: '鸡蛋', emoji: '🥚', desc: '小鸡的礼物', rarity: 'common' },
  { id: 'wool', name: '羊毛', emoji: '🧶', desc: '可以织毛衣', rarity: 'common' },
  { id: 'milk', name: '牛奶', emoji: '🥛', desc: '每天一杯长高高', rarity: 'common' },
  { id: 'truffle', name: '松露', emoji: '🍄', desc: '很稀有的美味', rarity: 'rare' },
  { id: 'feather', name: '羽毛', emoji: '🪶', desc: '轻飘飘的', rarity: 'common' },
  { id: 'rose-bloom', name: '玫瑰花', emoji: '🌹', desc: '可以送人，也可以卖掉', rarity: 'common' },
  { id: 'lemonade', name: '柠檬汁', emoji: '🍹', desc: '酸酸甜甜，市场里很抢手', rarity: 'rare' },

  // --- 特殊道具 ---
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

/**
 * 产出的「基准市场价」。
 *
 * 定价逻辑：让每个产出在正常市价下，其来源设施每分钟净收益
 * 稳定落在 1.5 ~ 4 分/分钟 的区间里。
 *
 *   egg      : 小鸡   40 分成本 / 12 分钟产 1 个  → 价 21 时约 1.75 分/分钟
 *   feather  : 小鸭   70 分成本 / 15 分钟产 1 个  → 价 30 时约 2.0
 *   wool     : 绵羊  150 分成本 / 25 分钟产 1 个  → 价 55 时约 2.2
 *   truffle  : 小猪  220 分成本 / 40 分钟产 1 个  → 价 90 时约 2.25
 *   milk     : 奶牛  420 分成本 / 45 分钟产 2 个  → 价 55 时约 2.4
 *   rose-bloom / lemonade 作为加工/观赏溢价品，价更高但产量稀缺
 */
export const PRODUCE_BASE_PRICE: Record<string, number> = {
  egg: 21,
  feather: 30,
  wool: 55,
  truffle: 90,
  milk: 55,
  'rose-bloom': 26,
  lemonade: 120,
}

/** 市场里可以卖的产出，按展示顺序 */
export const MARKET_GOODS = Object.keys(PRODUCE_BASE_PRICE)

/**
 * 价格浮动上限系数。
 * 现价永远 <= base * PRICE_CEILING，保证「上限以下浮动」。
 * 用户需求原话：「价格浮动，上限以下浮动」。
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
