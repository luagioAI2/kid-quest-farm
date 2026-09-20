import type { ItemDef, CropDef, AnimalDef } from './types'

/* ============================================================
   内容表：作物 / 动物 / 道具 / 市场价

   经济口径（2026-09-15 由用户锁死；2026-09-19 按 B1 整数化修订）：

     满产       = 作物：单次产量 × 收获次数
                  动物：单次产量 × 产出次数
     上限回收   = 满产 × 整数单价           ← 2026-09-19 改
     成本       = 上限回收 ÷ (1 + r)         r 由家长设，默认 0.6

   **2026-09-19 的改动（B1 整数化，见 docs/farm-economy-design.md §6.1.3）**

   原来 `上限回收 = 成本 × (1+r)` 是个**连续小数**（小萝卜 3.2），而单价是它的
   1/4（0.8）。孩子一颗一颗卖的时候，每笔都按 `round(0.8) = 1` 扣额度 ——
   扣得比单价多，卖到剩 1 个就卡住（额度剩 0.2，一颗要 1 枚，卖不动）。
   这是**额度 / 货 / 到手**三个单位混用的后果：额度是小数、货是整数、
   到手是整枚，三者对不齐。

   现在把**单价取整**，并令 `上限回收 = 满产 × 整数单价`。于是
   `round(单价 × n) ≡ 单价 × n`，报价天然可加，**一颗不剩**。
   代价：单价 1 的小萝卜只能表达 25% 的利润步长，所以它的成本被抬到 3
   （上限 4 = +33%），而不是 +60% —— 这是整数化的固有代价，见下面 `priceCeilingFor`。

   六个要点：

   1. **闸门是一轮的事，不是终身的事。** 卖满这一轮就结束，下一轮重新买种子。
      种子永远买得到、地永远能再种（用户 2026-09-15 明确）。
   2. **动物产够 `produceTimes` 次就停产，但动物留在农场里。**
      不要再退回「靠寿命一直产」——旧模型下小鸡成本 40 能换回约 20000。
   3. **配置表数值是定的，实际产出会被灾害打折。** 灾害把产量期望压到
      约 0.9 倍，所以实测期望浮盈 +44%~+48%，而不是贴着 60% 上限。
   4. **所有标的共用同一套灾害分布，没有「这作物更娇气」这回事。**
      旧的 `CropDef.fragility` 已删除（2026-09-15）：一旦每个作物有自己的
      减产概率，上面那条「单价 = 上限回收 ÷ 满产」推出来的
      期望浮盈就不再统一，§5.6 那张表全部作废。要差异化请改**成本 / 次数 / 间隔**，
      不要偷偷加回一个概率倍率。
   5. **成本必须是整数。** `postLedger` 里写着 `Math.round(entry.delta)` ——
      成本写成 2.5 的话，`plant()` 用 2.5 判余额、实际扣 3，账对不上。
      所以 B1 的推导里 `成本 = 满产 × 单价 ÷ 1.6` **必须落在整数上**，
      落不到就换一个单价（见 §5.6 的推表脚本）。
   6. **产量会被「满产」封顶（甲）。** 见 `useApp.harvest` ——
      周末 / 节假日的季节加成最多把产量顶到满产，不会再多。
      于是加成从「多赚钱」变成「倒霉的时候也能收满」，闸门永远兜得住。

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
    // 成本 2 → 3：满产 4 个，整数单价最小是 1，上限回收就是 4。
    // 成本 2 的话利润 +100%（越过家长的 60% 线），3 是**最小的合法整数成本**。
    seedCost: 3,
    harvestPoints: 4,
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
    seedCost: 5,
    harvestPoints: 8,
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
    seedCost: 15,
    harvestPoints: 8,
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
    // 24 → 30：胡萝卜的每分钟浮盈被 B1 抬到 0.755，草莓 24 只有 0.705，
    // 会**低于 L1** —— §5.4 的「同档位内随等级递增」就破了。抬到 30 恢复 0.845。
    seedCost: 30,
    harvestPoints: 24,
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
    // 45 → 50（单价 9 → 10）：胡萝卜的每分钟浮盈被 B1 抬到 0.754，
    // 而玉米 45 只有 0.750 —— L2 比 L1 还低一丁点，§5.4 的「同档位内递增」就破了。
    seedCost: 50,
    harvestPoints: 40,
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
    // 115 → 120：满产 12，整数单价只能取**偶数**才能让 `成本 = 12p/1.6` 落在整数上。
    // p = 15 → 112.5（非整数，`postLedger` 会四舍五入成 113，账对不上），
    // 所以取 p = 16 → 成本 120。
    seedCost: 120,
    harvestPoints: 64,
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
    seedCost: 300,
    harvestPoints: 60,
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
    seedCost: 675,
    harvestPoints: 108,
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
    seedCost: 795,
    harvestPoints: 212,
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
    cost: 75,
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
    cost: 125,
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
    cost: 555,
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
    // ⚠️ 单次产量必须和其他标的**保持一致（都是 4）**。
    // 减产骰子作用在**单次产出**上（见 `rollAnimalProduceEvent`），
    // 8 个的取整颗粒度太粗：`round(8 × 0.92) = 7`，掉 12.5%，
    // 而中性档的设计意图只是掉 8% —— 结果奶牛的期望浮盈只有 **+33%**，
    // 比其他动物（+44~47%）和作物（+44~48%）低 13 个点。
    // 改回 4 之后，总产出（16 × 4 = 64）和总时长（16 × 180 = 2880 分）
    // 与改之前**完全一样**，只是「每 3 小时攒 4 个」而不是「每 6 小时攒 8 个」。
    produceIntervalMinutes: 180,
    produceAmount: 4,
    produceTimes: 16,
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
 * 闸门：**一轮**最多能卖回多少丰收币 —— 家长定的那条线。
 *
 * 注意是「一轮」—— 卖满这一轮就结束，下一轮重新买种子、重新算上限。
 * 种子永远买得到、地永远能再种（用户 2026-09-15 明确）。
 *
 * ⚠️ **这是「规则线」，不是实际生效的闸门。** 实际闸门是 `capFor(itemId, r)`，
 * 它把这根线**夹到「满产 × 整数单价」**上（2026-09-19 B1）。
 * 两者的关系：`capFor(id, r) ≤ roundCap(成本, r)`，默认档下**恰好相等**。
 * 为什么不直接用这根线：它是连续小数（3.2），而孩子到手的丰收币是整枚，
 * 两者对不齐就会剩货 —— 见 §6.1.3。
 */
export function roundCap(cost: number, r = DEFAULT_PROFIT_RATIO): number {
  const clamped = Math.min(MAX_PROFIT_RATIO, Math.max(MIN_PROFIT_RATIO, r))
  return cost * (1 + clamped)
}

/**
 * 产出物 → **一轮的满产量**。
 *
 * 作物 = `单次产量 × 收获次数`；动物 = `单次产量 × 产出次数`。
 * **单次产量取 4 是为了让灾害倍率（0.45~1.2）能用整数表达** ——
 * 每次只产 1 个的话 `round(1 × 0.7) = 1`，灾害就完全看不见了。
 * 放大单次产量**不改变任何经济数值**（`产量 × 单价` 恒定），只改变颗粒度。
 *
 * 但注意：满产**越小，整数单价的颗粒度越粗**（小萝卜满产 4、单价 1，
 * 一档就是 25% 的利润），所以满产小的标的成本会被抬得比较难看 —— 见 §6.1.3。
 */
const YIELD_BY_ITEM = new Map<string, number>([
  ...CROPS.map((c) => [c.produceItemId, (c.produceAmount ?? 1) * c.regrowCount] as const),
  ...ANIMALS.map((a) => [a.produceItemId, a.produceAmount * a.produceTimes] as const),
])

/** 该产出物一轮的满产量。不是产出物 → 0。 */
export function yieldOf(itemId: string): number {
  return YIELD_BY_ITEM.get(itemId) ?? 0
}

/**
 * 产出的**基准单价**（丰收币/个）—— **一律是整数**（2026-09-19 B1）。
 *
 * 为什么必须整数：`sellQuote` 是 `Math.round(单价 × 个数)`，而孩子到手的
 * 丰收币是**整枚**。单价带小数时 `round(单价) > 单价`（小萝卜 0.8 → 1），
 * 一颗一颗卖等于每笔都多扣额度，卖到剩 1 个就卡住 —— 这就是「背包里那个
 * 卖不掉的萝卜」。单价取整之后 `round(单价 × n) ≡ 单价 × n`，报价可加，
 * 卖到最后恰好用完，一颗不剩。
 *
 * 数值推导（见 docs/farm-economy-design.md §5.6 的推表脚本）：
 *
 *     单价 = round(成本 × 1.6 ÷ 满产)      ← 先用现值估一个整数
 *     成本 = 满产 × 单价 ÷ 1.6             ← 再回推成本，保证利润率**恰好** 60%
 *     成本必须落在整数上（`postLedger` 会 `Math.round` 扣款）
 *
 * 回推不出整数的标的就换一个单价。落不下的两处：
 *   · 小萝卜（满产 4）：单价 1 → 成本 2.5（非整数）→ 只能抬到 3，利润率降到 +33%
 *   · 番茄（满产 12）：单价 15 → 成本 112.5（非整数）→ 换成单价 16 → 成本 120
 */
export const PRODUCE_BASE_PRICE: Record<string, number> = {
  // 作物
  'produce-radish': 1,
  'produce-carrot': 2,
  'rose-bloom': 2,
  'produce-strawberry': 6,
  'produce-corn': 10,
  'produce-tomato': 16,
  'produce-pumpkin': 6,
  'produce-watermelon': 24,
  'produce-apple': 15,
  lemonade: 27,
  'produce-sunflower': 50,
  'produce-magic-bean': 53,
  // 动物
  egg: 6,
  feather: 10,
  wool: 18,
  truffle: 37,
  milk: 35,
}

/** 市场里可以卖的产出，按展示顺序 */
export const MARKET_GOODS = Object.keys(PRODUCE_BASE_PRICE)

/* ------------------------------------------------------------
   现价硬顶 / 上限回收（2026-09-18 家长定规则，2026-09-19 B1 整数化）
   ------------------------------------------------------------
   家长原话：

   > 「设定里市场盈利最高 60%，那最高市场价应该是成本 × 1.6。
   >   意思是波动不能够超过它。」

   所以硬顶 = `上限回收 ÷ 满产` = **单位成本 × (1 + r)**。
   波动不得超过它 —— 这是**绝对上限**，不是「基准价的某个倍数」。

   2026-09-19 起，硬顶**取整**，并且上限回收被定义成 `满产 × 硬顶`，
   于是 `满产 × 硬顶 = 上限回收` **恰好相等且都是整数**。行情再好也能把
   这一轮收的全卖掉、一个不剩，同时到手永远不突破闸门。
   这两件事本来就是同一个数，不该由两个旋钮各管一半。
   ------------------------------------------------------------ */

let ceilingCacheKey = Number.NaN
let ceilingCache = new Map<string, number>()

/**
 * 该产出物的**单价**（丰收币/个，**整数**）。不是产出物 → `Infinity`（不受限）。
 *
 * 默认档（`r = 0.6`）下恰好等于 `PRODUCE_BASE_PRICE`。家长把 r 调高时单价跟着涨，
 * 但**仍然取整** —— 只有整数单价才能保证 `round(单价 × n) ≡ 单价 × n`。
 *
 * ⚠️ **r 调低时整数单价会「卡住不动」**，这是整数化的固有代价，不是 bug：
 * 小萝卜基准价 1，r 在 [0.2, 1.2] 全程都算不出 ≥ 2 的整数价，于是 r 对它就失效。
 * 单价 1 的 25% 就是 0.25，比 r 的最小步长（0.2）还粗。
 * 想让 r 生效只能把该标的的**满产做大**（满产越大 → 单价越大 → 步长越细）。
 *
 * 按 `r` 记忆化：`r` 是家长可调的（0.2 ~ 1.2），换档才重算。
 */
export function priceCeilingFor(itemId: string, r = DEFAULT_PROFIT_RATIO): number {
  if (r !== ceilingCacheKey) {
    const clamped = Math.min(MAX_PROFIT_RATIO, Math.max(MIN_PROFIT_RATIO, r))
    const m = new Map<string, number>()
    for (const [id, base] of Object.entries(PRODUCE_BASE_PRICE)) {
      // `(1 + r) / (1 + 0.6)` —— 默认档下这个因子恰好是 1，硬顶回到基准价本身。
      // `+1e-9` 只吸收浮点噪声（0.6 / 1.6 会飘到 0.9999999999999999）。
      const factor = (1 + clamped) / (1 + DEFAULT_PROFIT_RATIO)
      m.set(id, Math.max(1, Math.floor(base * factor + 1e-9)))
    }
    ceilingCache = m
    ceilingCacheKey = r
  }
  return ceilingCache.get(itemId) ?? Number.POSITIVE_INFINITY
}

/**
 * 一轮的**上限回收**（丰收币，整数）= `满产 × 单价`。
 *
 * 一定是单价的**整数倍** —— 这正是 B1 要的性质：卖到最后一颗时，
 * 剩余额度恰好是单价的整数倍，`round(单价 × 剩余颗数)` 一分不差，
 * 于是「背包里永远不会有卖不掉的货」。
 *
 * 默认档下 `capFor(id, 0.6) === roundCap(成本, 0.6) === 成本 × 1.6`（有测试钉住）。
 * 其他档位下会被夹到单价的整数倍，所以**只会比规则线更低**（更严是允许的）。
 */
export function capFor(itemId: string, r = DEFAULT_PROFIT_RATIO): number {
  const n = yieldOf(itemId)
  if (n <= 0) return 0
  return n * priceCeilingFor(itemId, r)
}

/**
 * 价格下限系数：现价 ≥ 基准价 × 本系数。
 *
 * 现状下**从来不会生效** —— 日波动 ±22% + 漂移 ±6% 最多把价格压到基准价的
 * 0.72 倍，够不到 0.55。留着是为了 `r` 调小、或将来加大波动时兜底。
 */
export const PRICE_FLOOR = 0.55

/** 价格每日最大波动幅度（±%） */
export const PRICE_DAILY_SWING = 0.22

/** 行情历史保留天数 */
export const MARKET_HISTORY_DAYS = 14

/**
 * 单日卖出对价格的下压系数：
 * 每卖出 1 个，价格向下跌 0.6%，最低不低于 base * PRICE_FLOOR。
 *
 * ⚠️ **只作用在「卖出之后」的行情上，不进 `sellQuote` 的报价。**
 * 也就是说：这一笔的到手价还是卖出前的现价，跌价要到**下一笔**才吃到。
 * 所以孩子看到的是「货一多，价钱就往下走」，而不是「一次卖太多会当场少拿钱」。
 *
 * 2026-09-16 定：**报价保持线性（现价 × 个数），不改。**
 * 原先市场弹层写过「全卖会少拿 N 分，因为一次卖太多」，但 N 恒为 0，
 * 等于教了一条假规则 —— 那行提示已删。真要做「分批更划算」，
 * 得让 `sellQuote` 按本系数对整笔卖出做衰减积分，那是改经济数值，
 * 见 `docs/farm-economy-design.md` §6.4。
 */
export const SELL_IMPACT_PER_UNIT = 0.006

/** 从作物定义取指定阶段的 emoji */
export function cropStageEmoji(crop: CropDef, stage: 0 | 1 | 2 | 3): string {
  return crop.stageEmojis[stage]
}

/** 兼容旧引用：产出出售基准价 */
export const PRODUCE_SELL_PRICE: Record<string, number> = PRODUCE_BASE_PRICE
