import { useState, type ReactNode } from 'react'

/**
 * 商品插画：**放文件即生效，不用改代码**。
 *
 * 规则只有一条 —— 文件名 = `item_id`（就是 `wish_item.item_id`，和后台
 * 「商品 ID」那一栏一模一样），扩展名 `png` / `webp` / `svg` 任选：
 *
 *     src/features/wish/art/wish-cake.webp      →  生日蛋糕
 *     src/features/wish/art/wish-dino.png       →  恐龙模型套装
 *
 * 为什么用 `import.meta.glob` 而不是一张手写映射表：手写表意味着「美术给了图，
 * 开发还要改一行代码」，而漏改的那一款**不报错**，只是继续显示 emoji ——
 * 这正是最难发现的那种「改了一半」。目录扫描把这件事变成「文件名对就行」。
 *
 * ⚠️ 文件名**必须**和 `item_id` 完全一致（含 `wish-` 前缀、连字符）。
 *    后台改了 item_id 之后图会静默失效、退回 emoji —— 判据是
 *    `WISH_ART_IDS` 里有没有它。
 * ⚠️ 这个文件叫 `WishArt.tsx`、映射也放在里面，**不要**再拆一个
 *    `wishArt.ts`：Windows 文件系统不区分大小写，两个名字只差一个字母的
 *    文件会让 tsc 报 TS1261（"differs only in casing"），而错误信息看起来
 *    像是「没导出这个成员」。
 *
 * 尺寸 / 风格 / 每个商品画什么 → `docs/wish-item-art-spec.md`。
 */

const FILES = import.meta.glob('./art/*.{png,webp,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

/** `./art/wish-cake.webp` → `wish-cake` */
function stemOf(path: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1)
  return file.slice(0, file.lastIndexOf('.'))
}

const BY_ID: Record<string, string> = {}
for (const [path, url] of Object.entries(FILES)) {
  BY_ID[stemOf(path)] = url
}

/** 这个商品有没有专属插画。没有 ⇒ 调用方回退到 emoji / 游戏图标 */
export function wishArtUrl(itemId: string): string | undefined {
  return BY_ID[itemId]
}

/** 当前有插画的 item_id（测试与自检用） */
export const WISH_ART_IDS: string[] = Object.keys(BY_ID)

/**
 * 商品图：**有插画就用插画，没有就回退**（游戏 → 手绘图标，其余 → emoji）。
 *
 * 为什么要一个组件而不是每处写一遍 `img or emoji`：同一件商品出现在
 * 四个地方（列表卡 / 盲盒头卡 / 详情页大图 / 家长定价页），四处各写一遍
 * 必然有一处忘了改 —— 而「某一屏还在显示 emoji」不会报错。
 *
 * ## 回退顺序
 *
 *   ① `art/<item_id>.*` 有图 → `<img>`
 *   ② 传了 `fallback`（游戏用它那支手绘图标）→ 用它
 *   ③ 都没有 → emoji
 *
 * `object-contain` 而不是 `cover`：插画母版是 4:3，但盲盒头卡和定价页的
 * 容器是正方形。用 `cover` 会把两边的礼物盒裁掉（五连开那张一眼就能看出来），
 * `contain` 只是上下留一点底色，永远不切内容。
 */
export function WishArt({
  itemId,
  emoji,
  className,
  emojiClassName,
  fallback,
}: {
  itemId: string
  /** 没有插画时的兜底字形 */
  emoji: string
  /** 给 `<img>` 的类（尺寸由调用方的容器决定） */
  className?: string
  /** 给 emoji 的类 */
  emojiClassName?: string
  /** 比 emoji 更合适的兜底（游戏用手绘图标） */
  fallback?: ReactNode
}) {
  const src = wishArtUrl(itemId)
  /**
   * 记「哪一张加载失败」而不是一个布尔：布尔在切换商品时不会复位，
   * 一件坏图会让后面所有商品一起退回 emoji（而原因早就换了一个）。
   */
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null)

  if (src && src !== brokenSrc) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        draggable={false}
        className={className}
        onError={() => setBrokenSrc(src)}
      />
    )
  }

  if (fallback) return <>{fallback}</>
  return (
    <span aria-hidden className={emojiClassName}>
      {emoji}
    </span>
  )
}
