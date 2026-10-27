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
    "name": "抓奖乐园",
    "version": "1.6.2",
    "url": "/games/prizepark/prizepark.plugin.mjs",
    "sha256": "9ae0f5473e3940b87655f65ba2a56755e3b0fce7dc2a3d7e3746f02bab15fe86",
    "bytes": 3396733,
    "assetBase": "/games/prizepark/"
  },
  {
    "id": "claw3d",
    "name": "抓娃娃",
    "version": "1.0.1",
    "url": "/games/claw3d/claw3d.plugin.mjs",
    "sha256": "99e8e82061696134a871dc594fdd721a919492c36513d047570b2e1484657f69",
    "bytes": 5225796,
    "assetBase": "/games/claw3d/"
  },
  {
    "id": "cloudfarm",
    "name": "云边小农场",
    "version": "1.1.4",
    "url": "/games/cloudfarm/cloudfarm.plugin.mjs",
    "sha256": "e9470d0f9f2080cdc288e8f9d9437dff81d0985d8eb69915f295f597c490557d",
    "bytes": 4493618,
    "assetBase": "/games/cloudfarm/"
  },
  {
    "id": "sugar",
    "name": "甜点魔法学院",
    "version": "1.0.0",
    "url": "/games/sugar/sugar.plugin.mjs",
    "sha256": "ee351fe13ead7f418e4f9c9e10ab16a2238975be5777142e933b4d77a8f5c758",
    "bytes": 1021949,
    "assetBase": "/games/sugar/"
  },
  {
    "id": "anthill",
    "name": "蚂蚁搬家",
    "version": "1.0.0",
    "url": "/games/anthill/anthill.plugin.mjs",
    "sha256": "314b721d24981279a2302445afd348402fabc80c49df808b74caadffd3407f70",
    "bytes": 4310548,
    "assetBase": "/games/anthill/"
  },
  {
    "id": "moestrike",
    "name": "少女战记",
    "version": "1.0.1",
    "url": "/games/moestrike/moestrike.plugin.mjs",
    "sha256": "3edc2b77a658c79253c73603c3d8d953c5b7b7efa72ae7a476cbfbbf813b6918",
    "bytes": 4302668,
    "assetBase": "/games/moestrike/"
  },
  {
    "id": "melonjar",
    "name": "爆汁瓜瓜罐",
    "version": "1.0.0",
    "url": "/games/melonjar/melonjar.plugin.mjs",
    "sha256": "22a3d9f52c8a8473d50923c38a9f140864a8436ee4fa652d9d31eb4f39b9e23c",
    "bytes": 5993596,
    "assetBase": "/games/melonjar/"
  },
  {
    "id": "minergirl",
    "name": "挖矿少女",
    "version": "1.0.1",
    "url": "/games/minergirl/minergirl.plugin.mjs",
    "sha256": "2135931d9f1c2e60b05b7904da150559557991a6c0ee10ae30c6f26204ec1e13",
    "bytes": 1170500,
    "assetBase": "/games/minergirl/"
  },
  {
    "id": "ropeland",
    "name": "跳绳羊群",
    "version": "1.0.0",
    "url": "/games/ropeland/ropeland.plugin.mjs",
    "sha256": "e0930995ace757888a98bc20229ce757e0b02702670acdf70aade85660c950d1",
    "bytes": 4298589,
    "assetBase": "/games/ropeland/"
  },
  {
    "id": "blockfit",
    "name": "方块填空",
    "version": "1.0.0",
    "url": "/games/blockfit/blockfit.plugin.mjs",
    "sha256": "734c3de97de53eff76377fe0f6300476f9d1bd3807009b9cdf8b8dde41cb9be2",
    "bytes": 4371633,
    "assetBase": "/games/blockfit/"
  },
  {
    "id": "deckrush",
    "name": "一分钟卡组",
    "version": "1.0.0",
    "url": "/games/deckrush/deckrush.plugin.mjs",
    "sha256": "50f4b49e5c9ee36eb0934d998522678a0f65ecfe9df3fad0774905028b79c592",
    "bytes": 4331925,
    "assetBase": "/games/deckrush/"
  },
  {
    "id": "corgi",
    "name": "柯基屁屁",
    "version": "1.0.0",
    "url": "/games/corgi/corgi.plugin.mjs",
    "sha256": "7bf98367145834a0a0fafe1444852571cf28ab0bfbd3fc228805581526d1f19e",
    "bytes": 1939221,
    "assetBase": "/games/corgi/"
  },
  {
    "id": "screamchick",
    "name": "尖叫鸡",
    "version": "1.0.0",
    "url": "/games/screamchick/screamchick.plugin.mjs",
    "sha256": "7918af7274bd19897c9329df3717c229b6ce3acced6a2e8ab6f8851e8537d09b",
    "bytes": 991750,
    "assetBase": "/games/screamchick/"
  },
  {
    "id": "sweetspin",
    "name": "旋转灯泡",
    "version": "1.0.0",
    "url": "/games/sweetspin/sweetspin.plugin.mjs",
    "sha256": "0b58db812e6d6f94da1024168000546ba63a5627656bbe89cdef186e9748980d",
    "bytes": 108344,
    "assetBase": "/games/sweetspin/"
  },
  {
    "id": "renttower",
    "name": "收租公寓",
    "version": "1.0.0",
    "url": "/games/renttower/renttower.plugin.mjs",
    "sha256": "3cebf49680965d6a0310821f4b062ab361a95877626041c5e20a4439d7c88974",
    "bytes": 4593256,
    "assetBase": "/games/renttower/"
  },
  {
    "id": "stackmeow",
    "name": "堆呀堆",
    "version": "1.0.0",
    "url": "/games/stackmeow/stackmeow.plugin.mjs",
    "sha256": "6749bb8c90d156e5ac3c5a41fbc494cb50f5220b93c0872bce62f66dddccd270",
    "bytes": 4247977,
    "assetBase": "/games/stackmeow/"
  },
  {
    "id": "cellguard",
    "name": "细胞守卫",
    "version": "1.0.0",
    "url": "/games/cellguard/cellguard.plugin.mjs",
    "sha256": "758f56b723d3f683f3c631a35da94eb0db7109bad5a1719089611831ee6982be",
    "bytes": 307406,
    "assetBase": "/games/cellguard/"
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
