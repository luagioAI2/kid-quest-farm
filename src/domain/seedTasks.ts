import type { RedeemItem, Task } from './types'

/* ============================================================
   首次启动的示例任务
   ------------------------------------------------------------
   分三块，对应孩子端的三个区块：

   * 每日任务（cycle: 'daily'）—— 每天固定要做的 6 个学科任务
     （各 45 分钟）+ 1 个家务。
   * 签到任务（checkInEnabled）—— 每天点一下，攒坚持天数换阶梯奖。
   * 长期任务（周 / 月 / 年）—— 一段时间内做满若干次。

   每日任务的规则刻意统一（宽容超时 + 质量加分）：
   这是"作业"最自然的形态 —— 晚一点做完不扣分，拖太久按比例
   衰减，做完由家长打质量分。免扣分的形态在「学会一项新本领」
   里示范（`allowLateNoPenalty: true`）。
   ============================================================ */

type SeedTask = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>

export const SEED_TASKS: SeedTask[] = [
  /* ---------------- 每日任务：6 个学科任务 + 1 个家务 ---------------- */

  {
    title: '完成语文作业',
    note: '认真写，字要工整哦',
    category: 'study',
    cycle: 'daily',
    plannedMinutes: 45,
    basePoints: 20,
    qualityBonusPoints: 8,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
    remindAt: '18:30',
  },
  {
    title: '完成数学作业',
    note: '先做会的，不会的想一想再问',
    category: 'study',
    cycle: 'daily',
    plannedMinutes: 45,
    basePoints: 20,
    qualityBonusPoints: 8,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
    remindAt: '19:00',
  },
  {
    title: '完成英语作业',
    note: '写完读一遍，单词顺手背了',
    category: 'study',
    cycle: 'daily',
    plannedMinutes: 45,
    basePoints: 20,
    qualityBonusPoints: 8,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
    remindAt: '19:30',
  },
  {
    title: '语文课外练习',
    note: '阅读理解、看图写话都可以',
    category: 'study',
    cycle: 'daily',
    plannedMinutes: 45,
    basePoints: 20,
    qualityBonusPoints: 8,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
  },
  {
    title: '数学课外练习',
    note: '错的题在错题本上再算一遍',
    category: 'study',
    cycle: 'daily',
    plannedMinutes: 45,
    basePoints: 20,
    qualityBonusPoints: 8,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
  },
  {
    title: '英语课外练习',
    note: '读一读、写一写，大声念出来',
    category: 'study',
    cycle: 'daily',
    plannedMinutes: 45,
    basePoints: 20,
    qualityBonusPoints: 8,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
  },
  {
    title: '清理自己的房间',
    note: '书桌、床、玩具都要归位',
    category: 'chore',
    cycle: 'daily',
    plannedMinutes: 15,
    basePoints: 12,
    qualityBonusPoints: 6,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
  },

  /* ---------------- 签到任务：每天点一下，攒坚持天数 ---------------- */

  {
    title: '练字签到',
    note: '每天写一页，坚持一周有大奖励',
    category: 'art',
    cycle: 'weekly',
    plannedMinutes: 15,
    basePoints: 8,
    qualityBonusPoints: 0,
    allowOvertime: false,
    allowLateNoPenalty: true,
    qualityRated: false,
    checkInEnabled: true,
    checkInTargetCount: 5,
  },
  {
    title: '日记',
    note: '今天发生了什么？写几句话就好',
    category: 'art',
    cycle: 'weekly',
    plannedMinutes: 15,
    basePoints: 8,
    qualityBonusPoints: 0,
    allowOvertime: false,
    allowLateNoPenalty: true,
    qualityRated: false,
    checkInEnabled: true,
    checkInTargetCount: 5,
  },
  {
    title: '晨读',
    note: '早上大声读一会儿，一天都精神',
    category: 'reading',
    cycle: 'weekly',
    plannedMinutes: 15,
    basePoints: 8,
    qualityBonusPoints: 0,
    allowOvertime: false,
    allowLateNoPenalty: true,
    qualityRated: false,
    checkInEnabled: true,
    checkInTargetCount: 5,
  },

  /* ---------------- 长期任务：一段时间内做满若干次 ---------------- */

  {
    title: '读一本完整的故事书',
    note: '厚一点也没关系，慢慢读',
    category: 'reading',
    cycle: 'monthly',
    plannedMinutes: 40,
    basePoints: 30,
    qualityBonusPoints: 15,
    allowOvertime: true,
    allowLateNoPenalty: false,
    qualityRated: true,
    checkInEnabled: false,
    checkInTargetCount: 4,
    rewardItemIds: ['sticker'],
  },
  {
    title: '学会一项新本领',
    note: '比如游泳、骑车、魔方……今年内学会就行',
    category: 'habit',
    cycle: 'yearly',
    plannedMinutes: 60,
    basePoints: 100,
    qualityBonusPoints: 50,
    allowOvertime: true,
    allowLateNoPenalty: true,
    qualityRated: true,
    checkInTargetCount: 6,
    rewardItemIds: ['medal'],
  },
]

/* ============================================================
   首次启动的示例兑换品
   ------------------------------------------------------------
   定价锚点说明（重要）：
   孩子一天的稳定收入大约是
     6 个每日任务 × 20 分 + 1 个家务 12 分 = 132 分
     （家长打了质量分后最高约 186 分）
     + 农场 1~2 小时 ≈ 100~200 分
     ≈ 250~330 分/天左右（有连击和签到奖励时更高）。

   注：每日任务从「6 个 × 10~20 分」改成「6 个 × 20 分 + 家务」
   之后，每日收入上浮了约 30%。下面这几档价格**没有跟着涨** ——
   相当于整体便宜了一点，孩子攒大件更快。若要维持原来的攒钱
   节奏，把 600 / 1500 两档各上调约 30% 即可。

   所以：
   * 「日常小确幸」定在 30~60 分 —— 每天都能换到一次，保持动力
   * 「周末特权」定在 150~300 分 —— 需要攒一两天
   * 「大件愿望」定在 600~1500 分 —— 需要攒一周左右

   这样「积分不会膨胀到兑换失控」：孩子每次想换大件都得等，
   家长就有充足的谈判空间。
   ============================================================ */

type SeedRedeem = Omit<RedeemItem, 'id' | 'createdAt' | 'updatedAt'>

export const SEED_REDEEM_ITEMS: SeedRedeem[] = [
  {
    name: '一份小零食',
    emoji: '🍪',
    category: 'snack',
    cost: 30,
    note: '饼干、酸奶、水果，任选一样',
    limitPerDay: 2,
    createdByParent: true,
  },
  {
    name: '一杯喜欢的饮料',
    emoji: '🧃',
    category: 'snack',
    cost: 45,
    note: '果汁或者牛奶',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '玩 30 分钟平板',
    emoji: '📱',
    category: 'screen',
    cost: 60,
    note: '自己定闹钟，时间到了就收起来',
    limitPerDay: 2,
    createdByParent: true,
  },
  {
    name: '看一集动画片',
    emoji: '📺',
    category: 'screen',
    cost: 50,
    note: '一集，看完就关',
    limitPerDay: 2,
    createdByParent: true,
  },
  {
    name: '晚睡 30 分钟',
    emoji: '🌙',
    category: 'privilege',
    cost: 120,
    note: '周末才能用哦',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '去朋友家玩半天',
    emoji: '🏃',
    category: 'outing',
    cost: 200,
    note: '要提前跟爸爸妈妈约时间',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '一起去公园 / 游乐场',
    emoji: '🎡',
    category: 'outing',
    cost: 300,
    note: '挑个好天气去',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '挑一个小玩具',
    emoji: '🧸',
    category: 'gift',
    cost: 600,
    note: '和爸爸妈妈一起选，预算内自己定',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '点一次想要的晚餐',
    emoji: '🍕',
    category: 'privilege',
    cost: 260,
    note: '今天吃什么你说了算',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '一次「免做一项家务」',
    emoji: '🎫',
    category: 'privilege',
    cost: 150,
    note: '任何一项家务都可以，用掉就没了',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '和爸爸妈妈独处的一下午',
    emoji: '💛',
    category: 'privilege',
    cost: 400,
    note: '想去哪、做什么，你决定',
    limitPerDay: 1,
    createdByParent: true,
  },
  {
    name: '一个大愿望',
    emoji: '🎁',
    category: 'gift',
    cost: 1500,
    note: '攒够了一起商量，比如一次短途旅行',
    limitPerDay: 1,
    createdByParent: true,
  },
]
