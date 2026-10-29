/**
 * 游戏兑换码表 —— **由 `scripts/mint-codes.mjs` 生成，别手改**。
 *
 * 键是 **sha256(归一化后的码)**，值是游戏 id。所以这张表**反推不出任何一个码**：
 * 就算有人把 App 包拆开，也只拿到一堆哈希，猜不出能用的码。
 *
 * 明文码在 `scripts/_codes-*.txt`（gitignored，本地留档用来印卡片）。
 *
 * ## 重新生成
 *
 * ```
 *   node scripts/mint-codes.mjs --per-game 20
 * ```
 *
 * ⚠️ 不带 `--keep` 就是**换掉整张表** —— 已经印出去、还没卖掉的卡全部作废。
 * 补发某一款时用 `--only <id> --keep`。
 *
 * ## 现在的状态
 *
 * 每款一个码，只为了让这条链在真机上能走通（21 款游戏本来都免费，
 * 一个码的最坏后果就是「白装一款本来也能装的游戏」）。
 * 真要开卖之前必须 `--per-game` 重发一批 —— 一个码发给所有买家
 * 等于一个通用密码。
 */

/**
 * 生成这张表时用的字母表。
 *
 * ⚠️ **别删这个常量。** 脚本（`.mjs`）import 不了 `src/domain/gameCode.ts`，
 * 只能抄一份字母表；两份不一致的症状是「生成的码全部兑换失败」，
 * 而且不报错、只一直说「没有这个码」。`codeTable.test.ts` 拿这个常量
 * 和 App 那份逐字比 —— 删了它就没人挡这个了。
 */
export const GAME_CODE_ALPHABET_AT_MINT = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export const GAME_CODE_HASHES: Record<string, string> = {
  '7930cd6796fa2c1078cd6a60fdc6e8227b62d81b579a7562616948f8b1272802': 'anthill',
  '6c8b815f6a02b6f4e2e4cd75c861bd4406a412c73797691968de205d7e1d938e': 'blockfit',
  '6a14c914451417be0b81fe05e5fd1b3517a3183b6d5e3583089adf7623403553': 'cellguard',
  '4aa30e9ec20541fee25b123f748e51e5afaff9282d152f29d1a1c035e3915e2b': 'claw3d',
  'cd887701c089f4a6a798b005beb84b62087e73ff8ab2af80eb6d80e7ee8b556c': 'cloudfarm',
  'cf35d5852819f92cab37f63bc17fe89219f50b155410d0b1201dcba3d99292f0': 'corgi',
  '5fcdcfec3f33eb30c5a0234e9d9298c0fe8f13001b880b7cf714980ca155b287': 'deckrush',
  'a60e2c1657177db458dd8a7b69e3e094d669b6c87570267a7503b6b9b1a00fc3': 'doodlederby',
  '006552b9bd0393e8765e0b4adb9703d438080a17db00115cf8d28ba67e00fa37': 'guardshift',
  '367cca13d154d366e2ff1d7946a76467caf065b46b650e70ea13faab7d6dc8fe': 'hoopsneak',
  '3ccf4a1ff3089c0e6c1e055425618d1cf8c70571d3c4fe6d98a43da2c0582db9': 'melonjar',
  '64b1dcb64eb4f1d3a636714a224899c73a2c15ecaf5887ea5bd2d1c19c74e7fe': 'minergirl',
  '6c19b62f2b4cd4d67a0df12c23a4669f02add6b7567c9886bc245e1716ee5f5f': 'moestrike',
  'cbe4500bc853b6b1ff9334e9c18ca7c041349445bd4e3ce300c00ffea30c243f': 'prizepark',
  'e6588f3e83df309c0c625a48be5a0bb2f2fd5c21aef4161450a7d57e1d4f268b': 'redbutton',
  '52d06cdff0bb230530175b113de4ef68481b078709354aa301ad724e741ac165': 'renttower',
  '9fa214b16dca4b9340e9a7d145883b7044d1f3bb8471975f43da1adf8821f45d': 'ropeland',
  '22a0be663349e57c6bee1d6237847405ca85117e4ae0a2dc68caa0bc5dcb4155': 'screamchick',
  'ff10398323f4e5c99366bd4f86407df7bf814727799b94c7594bf6ba8210e87b': 'stackmeow',
  'f3e16fa8c9a60c1b590b95058a74a86727662e1edbb518ea68bed4d092b40efd': 'sugar',
  '7d445291fa4651ffcc914b1783a5cc90fe7b1e52e5a3d3e6357fbeea2f7efc83': 'sweetspin',
}
