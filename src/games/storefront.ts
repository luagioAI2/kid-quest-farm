/**
 * 游戏市场的**内容**（不是玩法数据，也不是安装逻辑）。
 *
 * 一款游戏在商店里长什么样、怎么介绍、有哪些截图，全在这里。
 * 安装仍然走 `games/localGames.ts`（哈希）和 `store/useApp.ts`（落库）——
 * 这个文件**只放文案和图片路径**，一行逻辑都没有。
 *
 * ## 为什么单独一个文件
 *
 * 商店的文案会被反复改（家长看的就是这几句），而安装/校验逻辑一行都不该跟着动。
 * 把两者混在组件里，改文案的 diff 和改逻辑的 diff 就分不开了。
 *
 * ## 文案口径
 *
 * **陈述句，不写卖点。** 不写「让孩子赢在起跑线」「不只是游戏，而是……」这类句子
 * （这个项目被家长点过名，判据见 `docs/` 与记忆里的「文案不能像传销」）。
 * 每条 `learn` 都必须是**这个游戏里真的会发生的事**，不是它「可能培养的能力」：
 * 「买种子先花钱、收成要等」是可观察的；「培养延迟满足能力」不是。
 *
 * ## 截图
 *
 * 图片由 `scripts/build-store-shots.py` 从各游戏工程的真机截图转出来，
 * 放在 `public/store/<id>/<n>.webp`（360 宽，全量 ~300 KB）。
 * `caption` 是给家长看的说明，**只能描述截图里真的有的东西**。
 */

/** 图标底色档位（对应 `theme.css` 的色板）。三款游戏要能一眼分开 */
export type StoreTint = 'grass' | 'sky' | 'sun' | 'berry'

export interface StoreShot {
  /** 相对 `public/` 的路径 */
  src: string
  caption: string
}

export interface StorefrontEntry {
  /** 和 `localGames.ts` / `registry.ts` 的 id 对齐 */
  id: string
  name: string
  emoji: string
  /**
   * 图标底色。
   *
   * ⚠️ 列表里**用图标，不用截图缩略图**：真机截图是 9:16，塞进 72px 宽的小格里
   * 就是一团花掉的颜色（试过，家长根本看不出是什么游戏）。应用商店也是这么做的
   * —— 列表给图标，截图留到详情页。
   */
  tint: StoreTint
  /** 一句话：这个游戏里孩子会做什么 */
  pitch: string
  /** 「帮助孩子」——3~4 条，必须是游戏里真的会发生的事 */
  learn: string[]
  /** 适龄（软性建议，不是硬门槛） */
  age: string
  /** 一次玩多久 */
  session: string
  shots: StoreShot[]
  /** 关于：2~3 段，讲清楚「玩起来是什么样」 */
  about: string[]
}

export const STOREFRONT: StorefrontEntry[] = [
  {
    id: 'cloudfarm',
    name: '云边小农场',
    emoji: '🌾',
    tint: 'grass',
    pitch: '种菜、养动物、把收成拿到市场上卖掉。',
    learn: [
      '买种子要先花钱，收成要等 —— 投入在前，回报在后',
      '行情每天会变，同一件东西不同时候卖，价钱不一样',
      '地是一块一块解锁的，想种更多就得先攒够',
      '动物要喂、要摸 —— 有生命的东西得照顾',
    ],
    age: '6 岁以上',
    session: '一次 5~10 分钟',
    shots: [
      { src: '/store/cloudfarm/1.webp', caption: '田里一共 12 块地，种下去等它长大' },
      { src: '/store/cloudfarm/2.webp', caption: '动物要喂、要摸，产出得自己收' },
      { src: '/store/cloudfarm/3.webp', caption: '市场按当天的行情收你的收成' },
      { src: '/store/cloudfarm/4.webp', caption: '鱼塘可以钓鱼，也能养水里的动物' },
    ],
    about: [
      '一块地、一把种子、一个市场。种下去要等它长大，长成了摘下来，拿到市场上卖。卖早了价钱低，卖晚了占着地方。',
      '动物是另一条线：要喂、要摸，产出要自己收。收成和照顾是两件事，孩子会先体会到这一点。',
      'App 里的积分用来买种子，卖出收成换的是兑换券 —— 两种币不互通，孩子没办法自己造钱。',
    ],
  },
  {
    id: 'prizepark',
    name: '奖品公园',
    emoji: '🎁',
    tint: 'berry',
    pitch: '用币换奖品，换到的东西收进背包。',
    learn: [
      '每件奖品都有标价 —— 先看价，再决定买不买',
      '重复的可以卖回去，不用一直攒着',
      '币能换成兑换券：留着还是换出去，是个选择',
      '同样的东西稀有度不一样，价值也不一样',
    ],
    age: '6 岁以上',
    session: '一次 3~8 分钟',
    shots: [
      { src: '/store/prizepark/1.webp', caption: '奖品按分类排好，每件都有标价' },
      { src: '/store/prizepark/2.webp', caption: '换到的东西进背包，攒了多少一眼能看到' },
      { src: '/store/prizepark/3.webp', caption: '重复的奖品可以卖回去，也能换成兑换券' },
    ],
    about: [
      '这里不是抓娃娃，是「攒够了再换」。奖品有分类、有标价，点开能看到自己攒到哪儿了。',
      '背包里能看到稀有度，重复的可以卖回去 —— 卖掉换币，还是留着凑套，孩子得自己决定。',
    ],
  },
  {
    id: 'claw3d',
    name: '爪爪乐',
    emoji: '🕹️',
    tint: 'sky',
    pitch: '一台 3D 娃娃机，看准了再下爪。',
    learn: [
      '换个角度看，爪子和娃娃的位置就不一样',
      '不是每次都能抓到 —— 运气是真实存在的',
      '币花完就是花完了，试错有成本',
    ],
    age: '6 岁以上',
    session: '一次 3~5 分钟',
    shots: [
      { src: '/store/claw3d/1.webp', caption: '一台真的能转视角的娃娃机' },
      { src: '/store/claw3d/2.webp', caption: '正面看：爪子正对着娃娃' },
      { src: '/store/claw3d/3.webp', caption: '侧面看：才知道爪子到底偏了多少' },
    ],
    about: [
      '机器可以换视角看，正面看是「正对着」，侧面看才知道偏了多少。下爪之前多看一眼，是这里唯一能提高成功率的事。',
      '抓不到是常态。一次一币，币花完了就是花完了 —— 这件事本身就是内容的一部分。',
    ],
  },
]

/** 按 id 取；没有内容时返回 null（商店里就不展示这一款，而不是显示一张空卡） */
export function storefrontOf(id: string): StorefrontEntry | null {
  return STOREFRONT.find((g) => g.id === id) ?? null
}
