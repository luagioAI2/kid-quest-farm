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

   ⚠️ 2026-09-21：用户要求把任务积分整体减半（每日任务改成 10 分）。
   逐条对照表见下面 `SEED_REDEEM_ITEMS` 上方的定价锚点注释。
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
    basePoints: 10,
    qualityBonusPoints: 4,
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
    basePoints: 10,
    qualityBonusPoints: 4,
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
    basePoints: 10,
    qualityBonusPoints: 4,
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
    basePoints: 10,
    qualityBonusPoints: 4,
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
    basePoints: 10,
    qualityBonusPoints: 4,
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
    basePoints: 10,
    qualityBonusPoints: 4,
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
    basePoints: 6,
    qualityBonusPoints: 3,
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
    basePoints: 4,
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
    basePoints: 4,
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
    basePoints: 4,
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
    basePoints: 15,
    qualityBonusPoints: 8,
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
    basePoints: 50,
    qualityBonusPoints: 25,
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
     6 个每日任务 × 10 分 + 1 个家务 6 分 = 66 分
     （家长打了质量分后最高 93 分）
     + 农场 1~2 小时 ≈ 100~200 分
     ≈ 166~266 分/天（有连击和签到奖励时更高）。

   **2026-09-21：任务积分整体减半。** 用户原话：

   > 「帮我把现在的固定的默认的每日任务改成 10 积分，其他的也缩小
   >   2 倍吧。现有的。积分取整。」

   改动范围是**任务**这一侧（每日 / 签到 / 长期），逐条：
     学科任务   20 + 8  →  10 + 4
     家务       12 + 6  →   6 + 3
     签到        8      →   4
     月度       30 + 15 →  15 + 8    ← 15 ÷ 2 = 7.5，按「取整」进到 8
     年度      100 + 50 →  50 + 25
   于是每日任务收入从 132 分（打质量分 186 分）降到 66 分（93 分）。

   ⚠️ **下面这几档价格没有跟着降，农场收入也没动 —— 这是有意的，不是漏改。**
   后果要说清楚：孩子的攒钱速度大致减半，所以
     · 「大件愿望」从攒一周左右变成**攒两周左右**；
     · 收入结构从「任务 ≈ 农场」变成**农场占大头**（66 vs 100~200）。
   这是把经济**收紧**了 —— 家长谈判空间更大，但孩子的即时反馈也变慢了。
   若只想让数字变小、不想动难度，就把下面所有 cost 和农场 `seedCost` /
   `cost` / 解锁价一起减半（那样整体是等比缩放，难度不变）。

   ⚠️ **还有两处积分来源这次没动，是有意留着等家长确认的**（不要以为减半
   已经覆盖了全部任务侧收入）：
     · **签到阶梯奖励** —— `domain/recurrence.ts` 的 `defaultTiers()`：
       每周 10 / 30 / 60、每月 50 / 150 / 400、每年 300 / 1500 / 5000。
       三个签到任务加起来 ≈ 300 分/周 ≈ 43 分/天，**不是小数目**。
       用户说的是「每日任务改成 10 分、其他的也缩小 2 倍」，阶梯奖励是
       **规则模板**（任何签到任务都用），不是种子任务里的数值，所以没算进去。
     · **连击奖励** —— `DEFAULT_SETTINGS.streakBonusPerDay/Cap`（2 / 20）。
       同上，是全局规则默认值。
   要一起减半的话说一声，两处都是单点改动。

   所以（保持原档位不变）：
   * 「日常小确幸」定在 30~60 分 —— 每天都能换到一次，保持动力
   * 「周末特权」定在 150~300 分 —— 需要攒一两天
   * 「大件愿望」定在 600~1500 分 —— 需要攒一周左右
     ⚠️ 2026-09-21 起实际要攒**两周左右**，见上面的减半说明。

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
