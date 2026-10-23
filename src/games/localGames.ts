/**
 * 本地包清单 —— **自动生成，别手改**（`node scripts/make-local-catalog.mjs`）。
 *
 * ## 为什么哈希在这里，而不在 `public/games/index.json` 里
 *
 * 因为 `public/` 是**发布物**，它和代码一起被替换。把「该信哪个哈希」
 * 也放在发布物里，等于让包自己证明自己 —— 那不是校验，是自证。
 * 只有编译进 JS 的那份哈希才拦得住「有人换掉 public 里的文件」。
 *
 * 输入是 `public/games/index.json`（只有 id / 名字 / 版本 / 路径），
 * 哈希由脚本现算。所以「清单说是什么」和「跑的是什么」不可能走散。
 *
 * ## 和远程目录的关系
 *
 * | | 信任根 | 什么时候验 |
 * | --- | --- | --- |
 * | 本地（本文件） | 烧进代码的 SHA-256 | 安装时 |
 * | 远程（`catalog.json`） | Ed25519 签名 → 目录里的 SHA-256 | 安装时 |
 *
 * 两条路的**最后一步完全一样**：`verifySha256` → 才 `importBundle`。
 */

export interface LocalGameEntry {
  id: string
  name: string
  version: string
  /** 站点绝对路径（`/games/<id>/<包>`），dev / preview / Capacitor 都一样 */
  url: string
  sha256: string
  bytes: number
  /** 资源根，以 `/` 结尾 */
  assetBase: string
}

export const LOCAL_GAMES: LocalGameEntry[] = [
  {
    "id": "prizepark",
    "name": "奖品公园",
    "version": "1.5.1",
    "url": "/games/prizepark/prizepark.plugin.mjs",
    "sha256": "619242a8f69f04f72ef63d21b417da43101cfb6a41bc8b719dd28619d2b48d25",
    "bytes": 3389682,
    "assetBase": "/games/prizepark/"
  }
]

/**
 * 按 id 查本地包。
 *
 * ★ 用 `Map` 而不是对象下标：`OBJ[key] ?? 兜底` 挡不住 `constructor` /
 *   `toString` / `__proto__`（它们从 `Object.prototype` 取得到值，`??` 不触发），
 *   后面 `entry.sha256` 就是 `undefined` —— 校验被静默跳过。
 */
const BY_ID = new Map(LOCAL_GAMES.map((g) => [g.id, g]))

export function localGameById(id: string): LocalGameEntry | undefined {
  return BY_ID.get(id)
}
