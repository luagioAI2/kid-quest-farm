//#region i18n.js
var e = "Cell, Not Today!", t = `普通|Common|ノーマル
稀有|Rare|レア
史诗|Epic|エピック
传说|Legendary|レジェンド
神话|Mythic|ミシック
绿色|Green|緑
蓝色|Blue|青
紫色|Purple|紫
橙色|Orange|橙
红色|Red|赤
抗体飞弹|Antibody Dart|抗体弾
远程·追踪|Ranged · Homing|遠距離・追尾
自动瞄准最近的病毒发射抗体弹。|Fires antibodies at the nearest virus.|最も近いウイルスへ抗体弾を発射。
分裂抗体|Split Antibodies|分裂抗体
命中后分裂出2枚小抗体继续攻击。|Splits into 2 small antibodies on hit.|命中すると小さな抗体2発に分裂。
弹数|Shots|弾数
射速|Fire rate|連射速度
穿刺针剂|Piercing Needle|貫通注射
远程·穿透|Ranged · Pierce|遠距離・貫通
阵地战中垂直向上发射，天生穿透2个目标。|Fires upward in Line Defense and pierces 2 targets.|陣地戦では真上に発射し、2体を貫通。
无限贯穿|Infinite Pierce|無限貫通
针剂可无限穿透，伤害+60%。|Unlimited piercing and +60% damage.|無限に貫通し、ダメージ+60%。
针数|Needles|針の数
环绕胶囊|Orbit Capsules|旋回カプセル
近战·环绕|Melee · Orbit|近距離・旋回
胶囊环绕英雄旋转，持续撞击靠近的病毒。|Orbiting capsules strike nearby viruses.|周囲を回るカプセルが近くの敵に体当たり。
胶囊风暴|Capsule Storm|カプセルの嵐
胶囊+2，旋转半径周期性大幅扩张。|Adds 2 capsules; orbit periodically expands.|カプセル+2。旋回半径が周期的に拡大。
胶囊数|Capsules|カプセル数
转速|Spin rate|回転速度
半径|Radius|半径
消毒喷雾|Sanitizer Spray|消毒スプレー
近战·范围|Melee · Area|近距離・範囲
向前方扇形持续喷洒，伤害范围内所有病毒。|Sprays a cone, damaging every virus within.|前方の扇形範囲に噴射し、全ての敵を攻撃。
强效消毒|Deep Clean|強力消毒
射程+50%，喷射角度更大，并使病毒减速。|+50% range, wider spray, and slows viruses.|射程+50%。噴射角度が拡大し、敵を減速。
频率|Frequency|頻度
射程|Range|射程
创可贴回旋镖|Bandage Boomerang|絆創膏ブーメラン
远程·往返|Ranged · Return|遠距離・往復
飞出后折返，往返路径上的病毒都会受伤。|Hits viruses on both its outward and return paths.|往路と復路の両方で敵にダメージ。
三重回旋|Triple Spin|三重旋回
回旋镖+2，体积与伤害大幅提升。|Adds 2 boomerangs with greater size and damage.|ブーメラン+2。サイズと威力が大幅上昇。
数量|Count|数量
投掷速度|Throw rate|投擲速度
高烧电弧|Fever Arc|高熱アーク
连锁·弹射|Chain · Bounce|連鎖・反射
释放电弧，在病毒之间连续跳跃。|An electric arc jumps between viruses.|電流がウイルスの間を連続で跳ぶ。
雷暴|Thunderstorm|雷嵐
跳跃次数+3，每次命中有概率再次落雷。|+3 jumps; hits may trigger an extra lightning strike.|連鎖+3。命中時に確率で追加の落雷。
跳跃|Jumps|連鎖数
施放速度|Cast rate|発動速度
跳跃距离|Jump range|連鎖距離
泡腾炸弹|Fizzy Bomb|発泡ボム
范围·爆炸|Area · Blast|範囲・爆発
投掷泡腾弹，落地爆炸造成范围伤害。|Throws a fizzy bomb that explodes on landing.|着弾時に爆発する発泡弾で範囲攻撃。
持续泡腾|Endless Fizz|持続発泡
爆炸后留下泡腾区域，持续灼烧病毒。|Leaves a fizzing zone that keeps burning viruses.|爆発後の発泡エリアが継続ダメージを与える。
爆炸范围|Blast area|爆発範囲
冷冻针|Frost Needle|冷凍針
远程·减速|Ranged · Slow|遠距離・減速
命中后使整条病毒链减速，最多叠加3层。|Slows the entire virus chain on hit, up to 3 stacks.|命中でウイルス列全体を減速。最大3重。
绝对零度|Absolute Zero|絶対零度
每隔一段时间冻结病毒链1.5秒。|Periodically freezes the chain for 1.5 seconds.|一定間隔でウイルス列を1.5秒凍結。
声波脉冲|Sonic Pulse|音波パルス
近战·冲击|Melee · Shockwave|近距離・衝撃波
以英雄为中心释放扩散声波，伤害沿途所有病毒。|An expanding sonic wave hits all viruses in its path.|英雄を中心に広がる音波で全ての敵を攻撃。
双重共振|Double Resonance|二重共鳴
声波范围+50%，并连续释放两道。|+50% wave range; releases two waves in succession.|音波範囲+50%。連続で2波を放つ。
释放速度|Pulse rate|発動速度
范围|Area|範囲
追踪抗体|Homing Antibodies|追尾抗体
远程·追踪爆炸|Ranged · Homing blast|遠距離・追尾爆発
发射会自动追踪的抗体导弹，命中小范围爆炸。|Homing antibody missiles explode in a small area.|追尾する抗体ミサイルが命中時に小範囲爆発。
饱和打击|Saturation Strike|飽和攻撃
导弹+3，爆炸范围大幅提升。|Adds 3 missiles and greatly increases blast area.|ミサイル+3。爆発範囲が大幅拡大。
导弹数|Missiles|ミサイル数
紫外光束|UV Beam|紫外線ビーム
直线·持续|Line · Sustained|直線・持続
发射持续的紫外光束，灼烧直线上所有病毒。|A sustained UV beam burns all viruses in a line.|持続する紫外線で直線上の全ての敵を焼く。
广谱照射|Broad Spectrum|広域照射
光束更宽，持续时间+50%。|Wider beams with +50% duration.|ビームが太くなり、持続時間+50%。
光束数|Beams|ビーム数
充能速度|Charge rate|充填速度
宽度|Width|幅
抗生素光剑|Antibiotic Saber|抗生物質セイバー
近战·斩击|Melee · Slash|近距離・斬撃
向前方挥出巨大的扇形斩击，造成海量伤害。|A massive frontal slash deals heavy damage.|前方へ巨大な扇形の斬撃を放ち、大ダメージ。
回旋斩|Spinning Slash|回転斬り
同时向前后斩击，范围+30%。|Slashes forward and backward with +30% area.|前後を同時に斬り、範囲+30%。
挥砍速度|Slash rate|斬撃速度
全面强化|Full Upgrade|全面強化
精准打击|Precision Strike|精密攻撃
致命要害|Vital Strike|急所攻撃
肾上腺素|Adrenaline|アドレナリン
病毒迟缓|Sluggish Virus|ウイルス鈍化
紧急击退|Emergency Push|緊急撃退
熬夜病毒|Night-Owl Virus|夜更かしウイルス
“再刷五分钟就睡。”——凌晨三点|“Five more minutes.” — 3 a.m.|「あと5分だけ。」——午前3時
拖延症病毒|Procrastination Virus|先延ばしウイルス
“明天再说吧。”|“I'll do it tomorrow.”|「明日でいいや。」
手机上瘾病毒|Phone Addiction Virus|スマホ依存ウイルス
解锁手机，只为了看一眼时间。|Unlocking the phone just to check the time.|時刻を見るだけのつもりでスマホを開く。
脱发病毒|Hair-Loss Virus|抜け毛ウイルス
发际线正在战略性撤退。|The hairline is making a tactical retreat.|生え際が戦略的撤退中。
社恐病毒|Social Anxiety Virus|人見知りウイルス
电话响了，假装不在家。|The phone rings. Pretend you're not home.|電話が鳴った。留守のふりをしよう。
暴食病毒|Snack Attack Virus|食べ過ぎウイルス
“吃饱了才有力气减肥。”|“I need energy to go on a diet.”|「ダイエットするにも腹ごしらえ。」
内卷病毒|Rat-Race Virus|競争疲れウイルス
别人卷，你也不得不卷。|Everyone hustles, so you hustle too.|みんなが頑張るから、自分も頑張るしかない。
选择困难病毒|Indecision Virus|優柔不断ウイルス
中午吃什么？这是个哲学问题。|What's for lunch? A philosophical question.|昼ごはんは何にする？哲学的な問題だ。
起床困难病毒|Snooze Virus|二度寝ウイルス
闹钟响了八次，被窝赢了八次。|Eight alarms. Eight wins for the blanket.|目覚まし8回、布団の8勝。
摸鱼病毒|Slacker Virus|サボりウイルス
看起来在工作，其实在摸鱼。|Looks like work. Actually slacking.|仕事中に見えて、実はサボり中。
健忘病毒|Forgetful Virus|物忘れウイルス
我进这个房间是要干嘛来着？|Why did I come into this room?|この部屋に何をしに来たんだっけ？
躺平病毒|Couch-Potato Virus|ごろ寝ウイルス
终极病毒：什么都不想干。|The final virus: doing absolutely nothing.|究極のウイルス：何もしたくない。
困难|Hard|ハード
噩梦|Nightmare|ナイトメア
阿免|Amian|アミアン
见习免疫卫士|Immune Rookie|免疫見習い
橙小维|Vita|ヴィータ
维C爆破手|Vitamin C Bomber|ビタミンC爆破士
雷小伏|Volt|ヴォルト
高烧电工|Fever Electrician|高熱電気技師
冰小凝|Frosty|フロスティ
冷敷专家|Cold-Pack Expert|冷却の専門家
光小剑|Lumen|ルーメン
紫外线骑士|UV Knight|紫外線の騎士
保温杯|Thermos|保温ボトル
人到中年不得已，保温杯里泡枸杞。|A thermos of goji tea keeps you going.|クコ茶入りボトルで今日も元気に。
一包枸杞|Goji Berries|クコの実
养生从娃娃抓起。|Healthy habits start early.|健康習慣は早いうちから。
泡脚桶|Foot Bath|足湯桶
泡完脚，环绕胶囊都转得更快了。|Warm feet, faster capsules.|足が温まればカプセルも快調。
蒸汽眼罩|Steam Eye Mask|蒸気アイマスク
闭眼五分钟，攻速提升百分之一。|Five minutes of shut-eye for a little more speed.|目を閉じて5分、攻撃速度アップ。
速溶咖啡|Instant Coffee|インスタントコーヒー
三合一，开局多一发抗体。|Three-in-one, plus one starting antibody.|3-in-1で開始時の抗体弾+1。
防蓝光眼镜|Blue-Light Glasses|ブルーライト眼鏡
专业对付紫外线和蓝光。|Made to handle UV and blue light.|紫外線とブルーライト対策のプロ。
护腰|Back Brace|腰サポーター
久坐一族的最后防线。|The desk worker's last line of defense.|座りっぱなしの人の最後の防衛線。
U型颈枕|Neck Pillow|ネックピロー
在哪都能睡，在哪都能战。|Sleep anywhere. Fight anywhere.|どこでも眠れて、どこでも戦える。
机械键盘|Mechanical Keyboard|メカニカルキーボード
青轴的声音，就是针剂的穿透力。|Clicky keys, piercing needles.|キーの打鍵音が針の貫通力に。
四叶草|Four-Leaf Clover|四つ葉のクローバー
据说能刷出更好的词条。|Rumored to roll better upgrades.|良い強化を引けるらしい。
锦鲤贴纸|Lucky Koi Sticker|幸運の鯉シール
转发这条锦鲤，战斗奖励翻倍（并不会）。|Share this koi for double rewards. (Not really.)|この鯉を広めると報酬2倍。（なりません）
转运红绳|Lucky Red Cord|幸運の赤い紐
复活时击退更远。|Pushes viruses farther on revival.|復活時に敵をより遠くへ押し戻す。
养生三件套|Wellness Trio|健康3点セット
熬夜冠军|Night-Owl Champion|夜更かし王者
打工人套装|Office Warrior|会社員セット
欧皇附体|Lucky Streak|幸運の加護
欧气满满|Feeling Lucky|幸運いっぱい
再来一次|One More Try|もう一回
每个宝箱额外 1 次免费刷新|One extra free reroll per chest|宝箱ごとに無料更新+1回
寻宝达人|Treasure Hunter|お宝ハンター
开局补给|Starting Supplies|開始時の補給
战斗开始时获得 1 个银色宝箱|Start each battle with 1 silver chest|戦闘開始時に銀の宝箱を1個獲得
绝地反击|Last Stand|背水の反撃
完成 3 场战斗|Complete 3 battles|戦闘を3回完了
开启 10 个局内宝箱|Open 10 battle chests|戦闘中に宝箱を10個開く
英雄升级 3 次|Upgrade heroes 3 times|英雄を3回強化
领取 1 次挂机奖励|Claim idle rewards once|放置報酬を1回受け取る
新武器|New weapon|新武器
全局|Global|全体
觉醒|Awakened|覚醒
伤害|Damage|ダメージ
飞行速度|Projectile speed|弾速
弹速|Shot speed|弾速
穿透|Pierce|貫通
商店|Shop|ショップ
武器|Weapons|武器
战斗|Battle|戦闘
英雄|Heroes|英雄
藏品|Relics|コレクション
金币|Gold|ゴールド
钻石|Gems|ダイヤ
体力|Stamina|スタミナ
密宝钥匙|Hero key|秘宝の鍵
藏品钥匙|Relic key|収集の鍵
绿色碎片|Green shards|緑の欠片
蓝色碎片|Blue shards|青の欠片
紫色碎片|Purple shards|紫の欠片
橙色碎片|Orange shards|橙の欠片
红色碎片|Red shards|赤の欠片
解锁|Unlock|解放
确定|Confirm|確認
取消|Cancel|キャンセル
超级强化|Super upgrade|超強化
小技巧：点击病毒可以集火攻击它！|Tip: tap a virus to focus fire!|ヒント：ウイルスをタップで集中攻撃！
击破金色宝箱获得新武器|Break a gold chest for a new weapon|金の宝箱を壊すと新武器を獲得
击破银色宝箱获得强化|Break a silver chest for an upgrade|銀の宝箱を壊すと強化を獲得
本局次数已用完|No uses left this battle|今回の使用回数は残っていません
钻石不足|Not enough gems|ダイヤが足りません
刷新次数已用完|No rerolls left|更新回数が残っていません
阵地战|Line Defense|陣地戦
包围战|Encirclement|包囲戦
病毒从上方蜿蜒而下，穿透与直线武器更强！|Viruses wind down from above. Piercing weapons excel!|敵が上から蛇行してくる。貫通武器が有効！
病毒四面合围，近战与范围武器更强！|Surrounded! Melee and area weapons excel!|四方から包囲される。近距離・範囲武器が有効！
⚠ 病毒逼近！|⚠ Viruses closing in!|⚠ ウイルス接近！
❄ 冻结|❄ Frozen|❄ 凍結
强化|Upgrade|強化
宝箱掉落啦！点击宝箱挑选强化|Chest dropped! Tap it to choose an upgrade.|宝箱が落ちた！タップして強化を選ぼう。
金色宝箱＝新武器，银色宝箱＝强化属性。可以先攒着，等拿到好武器再开！|Gold chests give weapons; silver chests give upgrades. Save them for a better loadout!|金は新武器、銀は能力強化。良い武器を得てから開けてもOK！
金色宝箱 · 选择新武器|Gold Chest · Pick a Weapon|金の宝箱・武器を選択
银色宝箱 · 强化属性|Silver Chest · Upgrade|銀の宝箱・能力強化
刷新可能出现更高级的词条|Reroll for a chance at better upgrades|更新で上位の強化が出ることも
免费刷新|Free reroll|無料更新
免费刷新后可用|Use the free reroll first|無料更新後に使用可能
复活|Revive|復活
复活后大幅度击退病毒|Reviving pushes viruses far back|復活すると敵を大きく押し戻す
免费复活|Free revive|無料復活
放弃复活|Give up|復活を諦める
暂停|Paused|一時停止
音效：|SFX: |効果音：
音乐：|Music: |音楽：
开|On|オン
关|Off|オフ
退出战斗|Leave battle|戦闘を終了
继续战斗|Resume|戦闘を再開
胜利！|Victory!|勝利！
战斗结束|Battle over|戦闘終了
生存进度|Progress|生存進度
消灭病毒|Viruses defeated|撃破数
战斗时长|Time|戦闘時間
新的最高进度！|New best progress!|最高進度を更新！
首次通关！额外钻石奖励|First clear! Bonus gems earned|初クリア！追加ダイヤ獲得
解锁新武器：|New weapon: |新武器解放：
（已自动上阵）|(auto-equipped)|（自動編成済み）
返回|Back|戻る
每日任务|Daily tasks|デイリー
已领取|Claimed|受取済み
任务奖励|Task rewards|任務報酬
领取|Claim|受け取る
完成全部任务|Complete all tasks|全任務を達成
额外奖励|Bonus rewards|追加報酬
全部完成|All done|全て達成
每日 0 点刷新|Resets daily at midnight|毎日0時に更新
七日签到|7-Day Check-in|7日間ログイン
今天已经签到过了|Already checked in today|本日は受取済みです
签到奖励|Check-in rewards|ログイン報酬
明天再来|Come back tomorrow|また明日
签到|Check in|ログイン
密宝钥匙不足（可在商店购买）|Not enough hero keys. Visit the shop.|秘宝の鍵が足りません。ショップで購入できます。
英雄密宝|Hero Vault|英雄の秘宝
已满星，转化为钻石|Max stars: converted to gems|星が最大のためダイヤに変換
重复获得 · 星级+1|Duplicate · +1 star|重複獲得・星+1
新英雄！|New hero!|新英雄！
金币不足|Not enough gold|ゴールドが足りません
攻击力|Attack|攻撃力
暴击|Critical|クリティカル
攻速|Attack speed|攻撃速度
专属武器：|Signature weapon: |専用武器：
天赋：|Talent: |特性：
属性加点|Stat upgrades|能力強化
（任意加一点，英雄升一级）|(Each upgrade grants a hero level)|（能力強化で英雄レベル+1）
被动技能|Passives|パッシブ
（可重复获得并叠加）|(Can be gained again and stacked)|（繰り返し獲得して重複可能）
出战|Active|出撃
品质：|Rarity: |レア度：
（开局自带）|(Starting weapon)|（開始時に所持）
星级：|Stars: |星数：
出战中|Active|出撃中
设为出战|Select hero|出撃させる
去英雄密宝抽取|Visit Hero Vault|英雄の秘宝へ
挂机宝箱|Idle Chest|放置宝箱
领取次数越多，挂机宝箱品质越高|Claim more often to improve chest quality|受取回数に応じて宝箱品質が上昇
再挂机一会儿吧|Let the chest fill a little longer|もう少し待ちましょう
挂机收益|Idle rewards|放置報酬
关卡选择|Chapters|章を選択
请先通关上一章|Clear the previous chapter first|前の章を先にクリアしてください
已通关|Cleared|クリア済み
知道了|Got it|了解
下一章|Next|次の章
已满|Full|満杯
最高生存进度：|Best progress: |最高生存進度：
开始战斗|Start battle|戦闘開始
藏品宝箱|Relic Chest|収集宝箱
随机获得藏品或藏品碎片|Random relics or relic shards|ランダムな収集品または欠片を獲得
开启 ×1|Open ×1|開く ×1
开启 ×10|Open ×10|開く ×10
套装：|Set: |セット：
满级|Max level|最大レベル
未获得|Not owned|未獲得
获得藏品|Relics obtained|収集品を獲得
碎片不足，多开藏品宝箱吧|Need more shards. Open relic chests.|欠片が足りません。収集宝箱を開きましょう。
每日福利|Daily rewards|毎日の特典
每日补给|Daily supplies|毎日の補給
武器碎片+金币|Weapon shards + gold|武器の欠片＋ゴールド
免费|Free|無料
每日金币|Daily gold|毎日のゴールド
今日次数已用完|Daily limit reached|本日の回数上限に達しました
武器宝箱|Weapon chests|武器宝箱
蓝色武器箱|Blue weapon chest|青の武器箱
绿/蓝碎片，小概率开出新武器|Green/blue shards; a chance of a new weapon|緑・青の欠片。低確率で新武器
紫色武器箱|Purple weapon chest|紫の武器箱
超值|Value|お得
钥匙|Keys|鍵
开启藏品宝箱|Opens relic chests|収集宝箱を開く
开启英雄密宝|Opens the Hero Vault|英雄の秘宝を開く
藏品钥匙 +1|Relic key +1|収集の鍵 +1
密宝钥匙 +1|Hero key +1|秘宝の鍵 +1
金币商店|Gold shop|ゴールド交換
最划算|Best value|一番お得
常用|Standard|定番
小袋|Small bag|小袋
推荐|Recommended|おすすめ
上阵武器|Loadout|編成武器
金色宝箱只会开出上阵的武器——根据战场类型搭配你的武器池！|Gold chests only offer equipped weapons. Build your loadout for each battlefield!|金の宝箱からは編成武器のみ出現。戦場に合わせて編成しよう！
上阵|Equip|編成
未解锁|Locked|未解放
穿透：无限|Pierce: unlimited|貫通：無限
局内获得 4 次强化后，银色宝箱可能出现觉醒|After 4 upgrades, silver chests may offer awakening|戦闘中に4回強化すると銀の宝箱に覚醒が出現することも
至少保留 1 把上阵武器|Keep at least 1 weapon equipped|武器を最低1つ編成してください
已上阵|Equipped|編成済み
已下阵|Unequipped|編成解除
下阵|Unequip|外す
升级|Upgrade|強化
体力不足|Not enough stamina|スタミナ不足
完成每日任务、领取进度宝箱也能获得体力|Get stamina from daily tasks and progress chests|デイリー任務や進度宝箱でもスタミナを獲得
设置|Settings|設定
重置存档|Reset progress|進度リセット
确定清空全部进度重新开始吗？此操作无法撤销。|Erase all progress and start again? This cannot be undone.|全進度を消して最初から始めますか？元に戻せません。
重置|Reset|リセット
${e} · 原创轻度塔防肉鸽 · 所有角色与美术均为程序绘制|${e} · Casual defense roguelite with original procedural art|${e}・オリジナルの軽快な防衛ローグライト
收下|Collect|受け取る
语言|Language|言語
自动存档已启用|Autosave enabled|自動保存は有効です
进度已交给平台保存|Progress sent to platform autosave|進度を自動保存に送信しました
正在保存进度…|Saving progress…|進度を保存中…
暂未保存成功，请重试|Save not accepted. Please retry.|保存できませんでした。再試行してください
登录后可跨设备同步进度|Sign in to sync progress across devices|ログインすると端末間で進度を同期できます
存档无法读取，已保留原数据|Save unreadable; original data preserved|保存データを読めません。元データは保護されています
重试存档|Retry save|保存を再試行
登录|Sign in|ログイン
重置失败，请稍后再试|Reset failed. Please try again.|リセット失敗。後で再試行してください
战斗每10秒自动记录，离开时再次记录|Battles checkpoint every 10 seconds and on exit|戦闘は10秒ごとと離脱時に保存
所有武器伤害|All weapon damage|全武器ダメージ
所有武器攻速|All weapon speed|全武器攻撃速度
高品质词条出现概率|Better upgrade chance|上位強化の出現率
高品质词条概率|Better upgrade chance|上位強化の出現率
暴击率|Critical chance|クリティカル率
暴击伤害|Critical damage|クリティカルダメージ
暴伤|Crit damage|クリティカルダメージ
病毒移动速度|Virus speed|ウイルス移動速度
病毒减速|Virus slow|ウイルス減速
复活时击退距离|Revive knockback|復活時の撃退距離
复活击退|Revive knockback|復活時の撃退
战斗奖励|Battle rewards|戦闘報酬
基础攻击|Base attack|基礎攻撃
星级攻击|Star attack bonus|星の攻撃補正
奖励|Rewards|報酬
战斗力|Power|戦闘力
推荐战力|Rec. power|推奨戦闘力
初始|Starting |初期
刷新|Reroll|更新
获得全部|Take all|全て獲得
当前 Lv.|Current Lv.|現在 Lv.
下一级 Lv.|Next Lv.|次 Lv.
已挂机|Idle time|放置時間
最多累积|Accumulates up to|蓄積上限
小时 · 宝箱品质 Lv.|hours · Chest Lv.|時間・宝箱品質 Lv.
每分钟|Per minute|毎分
金币 · 每小时|gold · Per hour|ゴールド・毎時
剩余|Left:|残り
次|uses|回
只差|Only|あと
通关|to clear|でクリア
剩余次数 ×|Uses left ×|残り回数 ×
再抽|Guaranteed hero within|あと
次内必出英雄！|more draws!|回以内に英雄確定！
每次消耗 1 把密宝钥匙 · 最多 6 次必出英雄（已抽|1 hero key per draw. Hero guaranteed within 6 draws (drawn:|1回につき秘宝の鍵1個。6回以内に英雄確定（現在
次）· 重复英雄提升星级（最高|draws). Duplicates add stars (max|回）。重複で星アップ（最大
星）|stars)|星）
开启 ×1（拥有|Open ×1 (owned:|1回開く（所持
/ 5（每星攻击 +|/ 5 (Attack per star +|/ 5（星ごとの攻撃 +
场 · 胜利|battles · Wins|回・勝利
场 · 消灭病毒|· Viruses defeated|回・撃破数
当前体力|Stamina|現在のスタミナ
，每 5 分钟恢复 1 点|; regenerates 1 every 5 minutes|、5分ごとに1回復
购买|Buy|購入
体力（今日剩余|stamina (left today:|スタミナ（本日残り
碎片不足|shards needed|の欠片が不足
间隔：|Interval: |間隔：
秒|s|秒
第|No. |第
最高生存进度达到|Reach best progress of|最高生存進度が
% 即可领取|% to claim|%で受取可能
章|Ch.|章
天|day|日
绿|G|緑
蓝|B|青
紫|P|紫
橙|O|橙
红|R|赤`, n = {
	zh: {},
	en: {},
	ja: {}
};
for (let e of t.split("\n")) {
	let [t, r, i] = e.split("|");
	if (r === void 0 || i === void 0) throw Error(`Invalid translation: ${t}`);
	n.zh[t] = t, n.en[t] = r, n.ja[t] = i;
}
var r = [
	[
		"立即将病毒击退 {0} 距离",
		"Immediately pushes viruses back {0} units",
		"敵を即座に{0}押し戻す"
	],
	[
		"本局剩余 {0} 次",
		"{0} uses left this battle",
		"今回の残り{0}回"
	],
	[
		"英雄 Lv.{0} 奖励",
		"Hero Lv.{0} rewards",
		"英雄 Lv.{0} 報酬"
	],
	[
		"解锁被动：{0}",
		"Passive unlocked: {0}",
		"パッシブ解放：{0}"
	],
	[
		"通关普通难度第1章后解锁{0}",
		"Clear Normal Chapter 1 to unlock {0}",
		"ノーマル第1章クリアで{0}を解放"
	],
	[
		"进度 {0}% 宝箱",
		"{0}% progress chest",
		"進度{0}%の宝箱"
	],
	[
		"{0}% 进度宝箱",
		"{0}% progress chest",
		"進度{0}%の宝箱"
	],
	[
		"最高生存进度达到 {0}% 即可领取",
		"Reach {0}% best progress to claim",
		"最高生存進度{0}%で受取可能"
	],
	[
		"藏品钥匙不足（需要 {0} 把），进度宝箱、签到和商店都能获得",
		"Need {0} relic keys. Get them from progress chests, check-ins or the shop.",
		"収集の鍵が{0}個必要です。進度宝箱・ログイン・ショップで入手。"
	],
	[
		"今日剩余 {0} 次",
		"{0} left today",
		"本日残り{0}回"
	],
	[
		"高级碎片，概率开出新武器（今日 {0}）",
		"Rare shards; chance of a new weapon ({0} left today)",
		"上位の欠片。確率で新武器（本日残り{0}）"
	],
	[
		"通关第{0}章",
		"Clear Chapter {0}",
		"第{0}章をクリア"
	],
	[
		"最多上阵 {0} 把武器",
		"Equip up to {0} weapons",
		"武器は最大{0}個まで編成可能"
	],
	[
		"普通难度通关第 {0} 章解锁，商店武器宝箱也有概率获得",
		"Clear Normal Chapter {0}, or find it in shop weapon chests.",
		"ノーマル第{0}章クリアで解放。ショップの武器箱からも確率で入手。"
	],
	[
		"{0} 出战！",
		"{0} is ready!",
		"{0}、出撃！"
	],
	[
		"第{0}天",
		"Day {0}",
		"{0}日目"
	],
	[
		"第{0}章{1}",
		"Chapter {0} {1}",
		"第{0}章{1}"
	]
];
for (let [e, t, i] of r) n.zh[e] = e, n.en[e] = t, n.ja[e] = i;
var i = (e) => e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), a = r.map(([e]) => ({
	key: e,
	re: RegExp("^" + e.split(/\{\d+\}/).map(i).join("(.*?)") + "$")
})), o = Object.keys(n.zh).filter((e) => !e.includes("{")).sort((e, t) => t.length - e.length), s = new RegExp(o.map(i).join("|"), "g"), c = "zh", l = !1, u = /* @__PURE__ */ new Set(), d = null;
function f(e) {
	d = e;
}
var p = () => c;
function m(e) {
	let t = String(e || "").slice(0, 2).toLowerCase();
	return t in n ? t : "zh";
}
function h(e, t = !0) {
	if (t || !l) {
		c = m(e), t && (l = !0), typeof document < "u" && (d ?? document.documentElement).style.setProperty("--font", c === "ja" ? "\"Hiragino Kaku Gothic ProN\", \"Yu Gothic\", \"Meiryo\", system-ui, sans-serif" : c === "zh" ? "\"PingFang SC\", \"Microsoft YaHei\", system-ui, sans-serif" : "system-ui, Arial, sans-serif");
		for (let e of u) e(c);
	}
}
function g(e) {
	return u.add(e), () => u.delete(e);
}
function _(t, r = c) {
	if (typeof t != "string" || r === "zh" || !t || t === "Cell, Not Today!" || t === "中文" || t === "日本語" || t === "English") return t;
	let i = n[r][t];
	if (i !== void 0) return i;
	if (t.includes("Cell, Not Today!")) return t.split(e).map((e) => _(e, r)).join(e);
	let o = t.trim(), l = n[r][o];
	if (l !== void 0) return t.slice(0, t.indexOf(o)) + l + t.slice(t.indexOf(o) + o.length);
	for (let { key: e, re: i } of a) {
		let a = i.exec(t);
		if (a) return n[r][e].replace(/\{(\d+)\}/g, (e, t) => _(a[Number(t) + 1], r));
	}
	return t.replace(s, (e) => n[r][e]).replace(/，/g, r === "en" ? ", " : "、").replace(/：/g, r === "en" ? ": " : "：").replace(/（/g, " (").replace(/）/g, ")");
}
function v(e) {
	if (typeof e == "string") return _(e);
	if (!Array.isArray(e)) return e;
	let t = [], n = "", r = () => {
		n &&= (t.push(_(n)), "");
	};
	for (let i of e) typeof i == "string" || typeof i == "number" ? n += i : (r(), t.push(Array.isArray(i) ? v(i) : i));
	return r(), t;
}
function y(e) {
	return Number.isFinite(e) ? new Intl.NumberFormat(c === "zh" ? "zh-CN" : c === "ja" ? "ja-JP" : "en-US", {
		notation: "compact",
		maximumFractionDigits: 1
	}).format(e) : "∞";
}
//#endregion
//#region saves.js
var b = "imhero.save.v1";
function ee(e, t, n) {
	if (e == null) return {
		meta: null,
		battle: null,
		invalid: !1
	};
	try {
		let r = typeof e == "string" ? JSON.parse(e) : e;
		if (r && b in r && (r = typeof r[b] == "string" ? JSON.parse(r[b]) : r[b]), r?.schema && r.schema !== 2) return {
			meta: null,
			battle: null,
			invalid: !0
		};
		let i = r?.schema === 2 ? r.meta : r;
		if (!i || !Number.isFinite(i.gold) || !Number.isFinite(i.gems) || !i.weapons || !i.heroes || !Array.isArray(i.loadout)) return {
			meta: null,
			battle: null,
			invalid: !0
		};
		let a = t(i, n);
		return a ? {
			meta: a,
			battle: r?.schema === 2 ? r.battle ?? null : null,
			invalid: !1
		} : {
			meta: null,
			battle: null,
			invalid: !0
		};
	} catch {
		return {
			meta: null,
			battle: null,
			invalid: !0
		};
	}
}
function te(e, t, n, r = () => {}) {
	let i = ee(e?.latestSync, t, Date.now()), a = i.invalid ? "invalid" : "idle", o = null, s = !1, c = 0, l = (e) => {
		a = e, r(e);
	};
	return {
		meta: i.meta ?? n(Date.now()),
		battle: i.battle,
		get status() {
			return a;
		},
		async write(t, n = null) {
			if (i.invalid) return !1;
			s = !0;
			let { settings: r, ...a } = t;
			o = JSON.parse(JSON.stringify({
				schema: 2,
				meta: a,
				battle: n
			}));
			let u = ++c;
			if (!e?.putLatest) return l("error"), !1;
			l("saving");
			let d = await e.putLatest(o, "kv");
			return u === c && l(d ? "accepted" : "error"), !!d;
		},
		async retry() {
			if (!o || i.invalid) return !1;
			l("saving");
			let t = ++c, n = await e?.putLatest(o, "kv");
			return t === c && l(n ? "accepted" : "error"), !!n;
		},
		async reset() {
			c++;
			let t = await e?.clearLatest();
			return t ? (o = null, s = !1, i.invalid = !1, l("idle")) : l("error"), !!t;
		},
		get changed() {
			return s;
		}
	};
}
function x(e) {
	let t = [], n = /* @__PURE__ */ new Map();
	function r(e) {
		if (typeof e != "object" || !e) return e;
		if (n.has(e)) return { $ref: n.get(e) };
		let i = t.length;
		n.set(e, i), t.push(null);
		let a = e instanceof Set ? "set" : e instanceof Map ? "map" : Array.isArray(e) ? "array" : "object", o = a === "set" ? [...e].map(r) : a === "map" ? [...e].map(([e, t]) => [r(e), r(t)]) : a === "array" ? e.map(r) : Object.fromEntries(Object.entries(e).map(([e, t]) => [e, r(t)]));
		return t[i] = {
			kind: a,
			data: o
		}, { $ref: i };
	}
	return {
		root: r(e),
		nodes: t
	};
}
function ne(e) {
	if (!e || !Array.isArray(e.nodes) || e.nodes.length > 3e4) throw Error("Invalid battle snapshot");
	let t = e.nodes.map((e) => e.kind === "set" ? /* @__PURE__ */ new Set() : e.kind === "map" ? /* @__PURE__ */ new Map() : e.kind === "array" ? [] : {});
	function n(e) {
		if (e && typeof e == "object" && "$ref" in e) {
			if (!t[e.$ref]) throw Error("Bad save reference");
			return t[e.$ref];
		}
		return e;
	}
	return e.nodes.forEach((e, r) => {
		let i = t[r];
		if (e.kind === "set") e.data.forEach((e) => i.add(n(e)));
		else if (e.kind === "map") e.data.forEach(([e, t]) => i.set(n(e), n(t)));
		else if (e.kind === "array") e.data.forEach((e) => i.push(n(e)));
		else for (let [t, r] of Object.entries(e.data)) {
			if ([
				"__proto__",
				"constructor",
				"prototype"
			].includes(t)) throw Error("Bad save key");
			i[t] = n(r);
		}
	}), n(e.root);
}
function re(e, t, n) {
	if (!e || t?.t === "result") return null;
	let r = /* @__PURE__ */ new Set([
		"layout",
		"rng",
		"fx",
		"sfx",
		"tmp",
		"setup",
		"stats"
	]), i = x({
		state: Object.fromEntries(Object.entries(e).filter(([e]) => !r.has(e))),
		overlay: t,
		speed: n
	});
	return {
		version: 1,
		setup: e.setup,
		rng: e.rng.s,
		data: i
	};
}
function ie(e, t) {
	if (!e || e.version !== 1 || !e.setup || !["line", "ring"].includes(e.setup.mode)) throw Error("Invalid battle checkpoint");
	let n = ne(e.data);
	if (!Array.isArray(n.state?.segs) || !Array.isArray(n.state?.weapons)) throw Error("Incomplete battle checkpoint");
	let r = new t(e.setup);
	return Object.assign(r, n.state), r.rng.s = e.rng, r.fx = [], r.sfx = [], r.placeSegs(), {
		battle: r,
		overlay: n.overlay ?? { t: "none" },
		speed: n.speed === 2 ? 2 : 1
	};
}
//#endregion
//#region scope-css.js
function S(e) {
	let t = [], n = 0, r = "";
	for (let i of e) i === "(" || i === "[" ? n++ : (i === ")" || i === "]") && (n = Math.max(0, n - 1)), i === "," && n === 0 ? (t.push(r), r = "") : r += i;
	return t.push(r), t;
}
function ae(e, t) {
	let n = e.trim();
	if (!n) return "";
	if (n === t || n.startsWith(t + ".") || n.startsWith(t + " ") || n.startsWith(t + ":")) return n;
	let r = n.match(/^(:root|html|body)\b/);
	return r ? t + n.slice(r[0].length) : t + " " + n;
}
function oe(e, t) {
	let n = e.replace(/\/\*[\s\S]*?\*\//g, ""), r = "", i = 0;
	for (; i < n.length;) {
		let e = n.indexOf("{", i);
		if (e === -1) {
			r += n.slice(i);
			break;
		}
		let a = n.slice(i, e), o = a.trim(), s = 0, c = e;
		for (; c < n.length; c++) if (n[c] === "{") s++;
		else if (n[c] === "}" && (s--, s === 0)) break;
		let l = n.slice(e + 1, c);
		if (/^@(media|supports|container|layer)\b/.test(o)) r += a + "{" + oe(l, t) + "}";
		else if (o.startsWith("@")) r += a + "{" + l + "}";
		else {
			let e = S(o).map((e) => ae(e, t)).filter(Boolean).join(",");
			r += e + "{" + l + "}";
		}
		i = c + 1;
	}
	return r;
}
//#endregion
//#region game.js
var C = null, w = null, se = async () => !0, ce = 0;
function le() {
	let e = null;
	return {
		get latestSync() {
			return e;
		},
		putLatest: async (t) => (e = t, !0),
		clearLatest: async () => (e = null, !0)
	};
}
async function T(t = {}) {
	var n = Object.defineProperty, r = (e, t, r) => t in e ? n(e, t, {
		enumerable: !0,
		configurable: !0,
		writable: !0,
		value: r
	}) : e[t] = r, i = (e, t, n) => r(e, typeof t == "symbol" ? t : t + "", n), a, o, s, c, l, u, d, m, b, ee, x, ne, S, ae, T, ue = {}, de = [], fe = /acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i, pe = Array.isArray;
	function me(e, t) {
		for (var n in t) e[n] = t[n];
		return e;
	}
	function he(e) {
		e && e.parentNode && e.parentNode.removeChild(e);
	}
	function ge(e, t, n) {
		var r, i, o, s = {};
		for (o in t) o == "key" ? r = t[o] : o == "ref" ? i = t[o] : s[o] = t[o];
		if (arguments.length > 2 && (s.children = arguments.length > 3 ? a.call(arguments, 2) : n), typeof e == "function" && e.defaultProps != null) for (o in e.defaultProps) s[o] === void 0 && (s[o] = e.defaultProps[o]);
		return _e(e, s, r, i, null);
	}
	function _e(e, t, n, r, i) {
		var a = {
			type: e,
			props: t,
			key: n,
			ref: r,
			__k: null,
			__: null,
			__b: 0,
			__e: null,
			__c: null,
			constructor: void 0,
			__v: i ?? ++s,
			__i: -1,
			__u: 0
		};
		return i == null && o.vnode != null && o.vnode(a), a;
	}
	function ve(e) {
		return e.children;
	}
	function ye(e, t) {
		this.props = e, this.context = t;
	}
	function be(e, t) {
		if (t == null) return e.__ ? be(e.__, e.__i + 1) : null;
		for (var n; t < e.__k.length; t++) if ((n = e.__k[t]) != null && n.__e != null) return n.__e;
		return typeof e.type == "function" ? be(e) : null;
	}
	function xe(e) {
		if (e.__P && e.__d) {
			var t = e.__v, n = t.__e, r = [], i = [], a = me({}, t);
			a.__v = t.__v + 1, o.vnode && o.vnode(a), Me(e.__P, a, t, e.__n, e.__P.namespaceURI, 32 & t.__u ? [n] : null, r, n ?? be(t), !!(32 & t.__u), i), a.__v = t.__v, a.__.__k[a.__i] = a, Pe(r, a, i), t.__e = t.__ = null, a.__e != n && Se(a);
		}
	}
	function Se(e) {
		if ((e = e.__) != null && e.__c != null) return e.__e = e.__c.base = null, e.__k.some(function(t) {
			if (t != null && t.__e != null) return e.__e = e.__c.base = t.__e;
		}), Se(e);
	}
	function Ce(e) {
		(!e.__d && (e.__d = !0) && l.push(e) && !we.__r++ || u != o.debounceRendering) && ((u = o.debounceRendering) || d)(we);
	}
	function we() {
		try {
			for (var e, t = 1; l.length;) l.length > t && l.sort(m), e = l.shift(), t = l.length, xe(e);
		} finally {
			l.length = we.__r = 0;
		}
	}
	function Te(e, t, n, r, i, a, o, s, c, l, u) {
		var d, f, p, m, h, g, _ = r && r.__k || de, v = t.length;
		for (c = Ee(n, t, _, c, v), d = 0; d < v; d++) (p = n.__k[d]) != null && (f = p.__i != -1 && _[p.__i] || ue, p.__i = d, g = Me(e, p, f, i, a, o, s, c, l, u), m = p.__e, p.ref && f.ref != p.ref && (f.ref && Le(f.ref, null, p), u.push(p.ref, p.__c || m, p)), h == null && m != null && (h = m), 4 & p.__u ? (c = De(p, c, e), f.__e && (f.__e = null)) : typeof p.type == "function" && g !== void 0 ? c = g : m && (c = m.nextSibling), p.__u &= -7);
		return n.__e = h, c;
	}
	function Ee(e, t, n, r, i) {
		var a, o, s, c, l, u = n.length, d = u, f = 0;
		for (e.__k = Array(i), a = 0; a < i; a++) (o = t[a]) != null && typeof o != "boolean" && typeof o != "function" ? (typeof o == "string" || typeof o == "number" || typeof o == "bigint" || o.constructor == String ? o = e.__k[a] = _e(null, o, null, null, null) : pe(o) ? o = e.__k[a] = _e(ve, { children: o }, null, null, null) : o.constructor === void 0 && o.__b > 0 ? o = e.__k[a] = _e(o.type, o.props, o.key, o.ref ? o.ref : null, o.__v) : e.__k[a] = o, c = a + f, o.__ = e, o.__b = e.__b + 1, s = null, (l = o.__i = Oe(o, n, c, d)) != -1 && (d--, (s = n[l]) && (s.__u |= 2)), s == null || s.__v == null ? (l == -1 && (i > u ? f-- : i < u && f++), typeof o.type != "function" && (o.__u |= 4)) : l != c && (l == c - 1 ? f-- : l == c + 1 ? f++ : (l > c ? f-- : f++, o.__u |= 4))) : e.__k[a] = null;
		if (d) for (a = 0; a < u; a++) (s = n[a]) != null && !(2 & s.__u) && (s.__e == r && (r = be(s)), Re(s, s));
		return r;
	}
	function De(e, t, n) {
		var r, i;
		if (typeof e.type == "function") {
			for (r = e.__k, i = 0; r && i < r.length; i++) r[i] && (r[i].__ = e, t = De(r[i], t, n));
			return t;
		}
		e.__e != t && (t && e.type && !t.parentNode && (t = be(e)), t = n.insertBefore(e.__e, t || null));
		do
			t &&= t.nextSibling;
		while (t != null && t.nodeType == 8);
		return t;
	}
	function Oe(e, t, n, r) {
		var i, a, o, s = e.key, c = e.type, l = t[n], u = l != null && !(2 & l.__u);
		if (l === null && s == null || u && s == l.key && c == l.type) return n;
		if (r > +!!u) {
			for (i = n - 1, a = n + 1; i >= 0 || a < t.length;) if ((l = t[o = i >= 0 ? i-- : a++]) != null && !(2 & l.__u) && s == l.key && c == l.type) return o;
		}
		return -1;
	}
	function ke(e, t, n) {
		t[0] == "-" ? e.setProperty(t, n ?? "") : e[t] = n == null ? "" : typeof n != "number" || fe.test(t) ? n : n + "px";
	}
	function Ae(e, t, n, r, i) {
		var a, o;
		e: if (t == "style") {
			if (typeof n == "string") e.style.cssText = n;
			else {
				if (typeof r == "string" && (e.style.cssText = r = ""), r) for (t in r) n && t in n || ke(e.style, t, "");
				if (n) for (t in n) r && n[t] == r[t] || ke(e.style, t, n[t]);
			}
		} else if (t[0] == "o" && t[1] == "n") a = t != (t = t.replace(ne, "$1")), o = t.toLowerCase(), t = o in e || t == "onFocusOut" || t == "onFocusIn" ? o.slice(2) : t.slice(2), e.l ||= {}, e.l[t + a] = n, n ? r ? n[x] = r[x] : (n[x] = S, e.addEventListener(t, a ? T : ae, a)) : e.removeEventListener(t, a ? T : ae, a);
		else {
			if (i == "http://www.w3.org/2000/svg") t = t.replace(/xlink(H|:h)/, "h").replace(/sName$/, "s");
			else if (t != "width" && t != "height" && t != "href" && t != "list" && t != "form" && t != "tabIndex" && t != "download" && t != "rowSpan" && t != "colSpan" && t != "role" && t != "popover" && t in e) try {
				e[t] = n ?? "";
				break e;
			} catch {}
			typeof n == "function" || (n == null || n === !1 && t[4] != "-" ? e.removeAttribute(t) : e.setAttribute(t, t == "popover" && n == 1 ? "" : n));
		}
	}
	function je(e) {
		return function(t) {
			if (this.l) {
				var n = this.l[t.type + e];
				if (t[ee] == null) t[ee] = S++;
				else if (t[ee] < n[x]) return;
				return n(o.event ? o.event(t) : t);
			}
		};
	}
	function Me(e, t, n, r, i, a, s, c, l, u) {
		var d, f, p, m, h, g, _, v, y, b, ee, te, x, ne, re, ie, S = t.type;
		if (t.constructor !== void 0) return null;
		128 & n.__u && (l = !!(32 & n.__u), a = [c = t.__e = n.__e]), (d = o.__b) && d(t);
		e: if (typeof S == "function") {
			f = s.length;
			try {
				if (y = t.props, b = S.prototype && S.prototype.render, ee = (d = S.contextType) && r[d.__c], te = d ? ee ? ee.props.value : d.__ : r, n.__c ? v = (p = t.__c = n.__c).__ = p.__E : (b ? t.__c = p = new S(y, te) : (t.__c = p = new ye(y, te), p.constructor = S, p.render = ze), ee && ee.sub(p), p.state || (p.state = {}), p.__n = r, m = p.__d = !0, p.__h = [], p._sb = []), b && p.__s == null && (p.__s = p.state), b && S.getDerivedStateFromProps != null && (p.__s == p.state && (p.__s = me({}, p.__s)), me(p.__s, S.getDerivedStateFromProps(y, p.__s))), h = p.props, g = p.state, p.__v = t, m) b && S.getDerivedStateFromProps == null && p.componentWillMount != null && p.componentWillMount(), b && p.componentDidMount != null && p.__h.push(p.componentDidMount);
				else {
					if (b && S.getDerivedStateFromProps == null && y !== h && p.componentWillReceiveProps != null && p.componentWillReceiveProps(y, te), t.__v == n.__v || !p.__e && p.shouldComponentUpdate != null && p.shouldComponentUpdate(y, p.__s, te) === !1) {
						t.__v != n.__v && (p.props = y, p.state = p.__s, p.__d = !1), t.__e = n.__e, t.__k = n.__k, t.__k.some(function(e) {
							e && (e.__ = t);
						}), de.push.apply(p.__h, p._sb), p._sb = [], p.__h.length && s.push(p), c = be(n);
						break e;
					}
					p.componentWillUpdate != null && p.componentWillUpdate(y, p.__s, te), b && p.componentDidUpdate != null && p.__h.push(function() {
						p.componentDidUpdate(h, g, _);
					});
				}
				if (p.context = te, p.props = y, p.__P = e, p.__e = !1, x = o.__r, ne = 0, b) p.state = p.__s, p.__d = !1, x && x(t), d = p.render(p.props, p.state, p.context), de.push.apply(p.__h, p._sb), p._sb = [];
				else do
					p.__d = !1, x && x(t), d = p.render(p.props, p.state, p.context), p.state = p.__s;
				while (p.__d && ++ne < 25);
				p.state = p.__s, p.getChildContext != null && (r = me(me({}, r), p.getChildContext())), b && !m && p.getSnapshotBeforeUpdate != null && (_ = p.getSnapshotBeforeUpdate(h, g)), re = d != null && d.type === ve && d.key == null ? Fe(d.props.children) : d, c = Te(e, pe(re) ? re : [re], t, n, r, i, a, s, c, l, u), p.base = t.__e, t.__u &= -161, p.__h.length && s.push(p), v && (p.__E = p.__ = null);
			} catch (e) {
				if (s.length = f, t.__v = null, l || a != null) {
					if (e.then) {
						for (t.__u |= l ? 160 : 128; c && c.nodeType == 8 && c.nextSibling;) c = c.nextSibling;
						a != null && (a[a.indexOf(c)] = null), t.__e = c;
					} else if (a != null) for (ie = a.length; ie--;) he(a[ie]);
				} else t.__e = n.__e;
				t.__k ??= n.__k || [], e.then || Ne(t), o.__e(e, t, n);
			}
		} else a == null && t.__v == n.__v ? (t.__k = n.__k, t.__e = n.__e) : c = t.__e = Ie(n.__e, t, n, r, i, a, s, l, u);
		return (d = o.diffed) && d(t), 128 & t.__u ? void 0 : c;
	}
	function Ne(e) {
		e && (e.__c && (e.__c.__e = !0), e.__k && e.__k.some(Ne));
	}
	function Pe(e, t, n) {
		for (var r = 0; r < n.length; r++) Le(n[r], n[++r], n[++r]);
		o.__c && o.__c(t, e), e.some(function(t) {
			try {
				e = t.__h, t.__h = [], e.some(function(e) {
					e.call(t);
				});
			} catch (e) {
				o.__e(e, t.__v);
			}
		});
	}
	function Fe(e) {
		return typeof e != "object" || !e || e.__b > 0 ? e : pe(e) ? e.map(Fe) : e.constructor === void 0 ? me({}, e) : null;
	}
	function Ie(e, t, n, r, i, s, c, l, u) {
		var d, f, p, m, h, g, _, v = n.props || ue, y = t.props, b = t.type;
		if (b == "svg" ? i = "http://www.w3.org/2000/svg" : b == "math" ? i = "http://www.w3.org/1998/Math/MathML" : i ||= "http://www.w3.org/1999/xhtml", s != null) {
			for (d = 0; d < s.length; d++) if ((h = s[d]) && "setAttribute" in h == !!b && (b ? h.localName == b : h.nodeType == 3)) {
				e = h, s[d] = null;
				break;
			}
		}
		if (e == null) {
			if (b == null) return document.createTextNode(y);
			e = document.createElementNS(i, b, y.is && y), l &&= (o.__m && o.__m(t, s), !1), s = null;
		}
		if (b == null) v === y || l && e.data == y || (e.data = y);
		else {
			if (s = b == "textarea" && y.defaultValue != null ? null : s && a.call(e.childNodes), !l && s != null) for (v = {}, d = 0; d < e.attributes.length; d++) v[(h = e.attributes[d]).name] = h.value;
			for (d in v) h = v[d], d == "dangerouslySetInnerHTML" ? p = h : d == "children" || d in y || d == "value" && "defaultValue" in y || d == "checked" && "defaultChecked" in y || Ae(e, d, null, h, i);
			for (d in y) h = y[d], d == "children" ? m = h : d == "dangerouslySetInnerHTML" ? f = h : d == "value" ? g = h : d == "checked" ? _ = h : l && typeof h != "function" || v[d] === h || Ae(e, d, h, v[d], i);
			if (f) l || p && (f.__html == p.__html || f.__html == e.innerHTML) || (e.innerHTML = f.__html), t.__k = [];
			else if (p && (e.innerHTML = ""), Te(t.type == "template" ? e.content : e, pe(m) ? m : [m], t, n, r, b == "foreignObject" ? "http://www.w3.org/1999/xhtml" : i, s, c, s ? s[0] : n.__k && be(n, 0), l, u), s != null) for (d = s.length; d--;) he(s[d]);
			l && b != "textarea" || (d = "value", b == "progress" && g == null ? e.removeAttribute("value") : g != null && (g !== e[d] || b == "progress" && !g || b == "option" && g != v[d]) && Ae(e, d, g, v[d], i), d = "checked", _ != null && _ != e[d] && Ae(e, d, _, v[d], i));
		}
		return e;
	}
	function Le(e, t, n) {
		try {
			if (typeof e == "function") {
				var r = typeof e.__u == "function";
				r && e.__u(), r && t == null || (e.__u = e(t));
			} else e.current = t;
		} catch (e) {
			o.__e(e, n);
		}
	}
	function Re(e, t, n) {
		var r, i;
		if (o.unmount && o.unmount(e), (r = e.ref) && (r.current && r.current != e.__e || Le(r, null, t)), (r = e.__c) != null) {
			if (r.componentWillUnmount) try {
				r.componentWillUnmount();
			} catch (e) {
				o.__e(e, t);
			}
			r.base = r.__P = r.__n = null;
		}
		if (r = e.__k) for (i = 0; i < r.length; i++) r[i] && Re(r[i], t, n || typeof e.type != "function");
		n || he(e.__e), e.__c = e.__ = e.__e = void 0;
	}
	function ze(e, t, n) {
		return this.constructor(e, n);
	}
	function Be(e, t, n) {
		var r, i, s, c;
		t == document && (t = document.documentElement), o.__ && o.__(e, t), i = (r = typeof n == "function") ? null : n && n.__k || t.__k, s = [], c = [], Me(t, e = (!r && n || t).__k = ge(ve, null, [e]), i || ue, ue, t.namespaceURI, !r && n ? [n] : i ? null : t.firstChild ? a.call(t.childNodes) : null, s, !r && n ? n : i ? i.__e : t.firstChild, r, c), Pe(s, e, c), e.props.children = null;
	}
	a = de.slice, o = { __e: function(e, t, n, r) {
		for (var i, a, o; t = t.__;) if ((i = t.__c) && !i.__) try {
			if ((a = i.constructor) && a.getDerivedStateFromError != null && (i.setState(a.getDerivedStateFromError(e)), o = i.__d), i.componentDidCatch != null && (i.componentDidCatch(e, r || {}), o = i.__d), o) return i.__E = i;
		} catch (t) {
			e = t;
		}
		throw e;
	} }, s = 0, c = function(e) {
		return e != null && e.constructor === void 0;
	}, ye.prototype.setState = function(e, t) {
		var n = this.__s != null && this.__s != this.state ? this.__s : this.__s = me({}, this.state);
		typeof e == "function" && (e = e(me({}, n), this.props)), e && me(n, e), e != null && this.__v && (t && this._sb.push(t), Ce(this));
	}, ye.prototype.forceUpdate = function(e) {
		this.__v && (this.__e = !0, e && this.__h.push(e), Ce(this));
	}, ye.prototype.render = ve, l = [], d = typeof Promise == "function" ? Promise.prototype.then.bind(Promise.resolve()) : setTimeout, m = function(e, t) {
		return e.__v.__b - t.__v.__b;
	}, we.__r = 0, b = Math.random().toString(8), ee = "__d" + b, x = "__a" + b, ne = /(PointerCapture)$|Capture$/i, S = 0, ae = je(!1), T = je(!0);
	var Ve = ":root {\n  --u: 16px;\n  --ink: #2a1a3e;\n  --cream: #fff7e6;\n  --cream2: #ffe9c2;\n  --yellow: #ffd23f;\n  --r0: #47d16c;\n  --r1: #3ba4ff;\n  --r2: #b35cff;\n  --r3: #ffae1a;\n  --r4: #ff4b4b;\n  --font: \"PingFang SC\", \"Hiragino Sans GB\", \"Microsoft YaHei\", \"Noto Sans SC\", system-ui, sans-serif;\n}\n* {\n  box-sizing: border-box;\n}\nhtml,\nbody {\n  font-family: var(--font);\n  color: var(--ink);\n}\nbutton {\n  font-family: inherit;\n  color: inherit;\n  border: 0;\n  background: none;\n  padding: 0;\n  cursor: pointer;\n  -webkit-tap-highlight-color: transparent;\n}\nimg.ico {\n  display: inline-block;\n  vertical-align: middle;\n  pointer-events: none;\n  flex: none;\n}\n.root {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: radial-gradient(circle at 50% 30%, #3b2a7a, #140d26 70%);\n  overflow: hidden;\n}\n.stage {\n  position: relative;\n  overflow: hidden;\n  background: #3a2a8f;\n  box-shadow: 0 0 60px rgba(0, 0, 0, 0.6);\n  font-size: calc(var(--u) * 1);\n  user-select: none;\n  -webkit-user-select: none;\n}\n.outline,\n.ribbon,\n.chapter-name,\n.hud-title,\n.btn,\n.tab span,\n.mode-banner b {\n  text-shadow:\n    0 0.12em 0 var(--ink),\n    0.07em 0.07em 0 var(--ink),\n    -0.07em 0.07em 0 var(--ink),\n    0.07em -0.07em 0 var(--ink),\n    -0.07em -0.07em 0 var(--ink);\n}\n.muted {\n  color: #7a6a8e;\n  font-size: calc(var(--u) * 0.78);\n}\n.small-text {\n  font-size: calc(var(--u) * 0.72);\n}\n.center-text {\n  text-align: center;\n}\n.center-col {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.7);\n}\n.tag-green {\n  display: inline-block;\n  background: #35b84a;\n  color: #fff;\n  border-radius: calc(var(--u) * 0.5);\n  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.45);\n  font-size: calc(var(--u) * 0.72);\n  font-weight: 800;\n  font-style: normal;\n  border: calc(var(--u) * 0.12) solid var(--ink);\n}\n\n/* ---------- buttons ---------- */\n.btn {\n  position: relative;\n  display: inline-flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: calc(var(--u) * 0.05);\n  min-width: calc(var(--u) * 5.5);\n  padding: calc(var(--u) * 0.55) calc(var(--u) * 1) calc(var(--u) * 0.65);\n  border-radius: calc(var(--u) * 1);\n  border: calc(var(--u) * 0.16) solid var(--ink);\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 1);\n  letter-spacing: 0.02em;\n  box-shadow:\n    inset 0 calc(var(--u) * -0.3) 0 rgba(0, 0, 0, 0.18),\n    inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.45),\n    0 calc(var(--u) * 0.22) 0 var(--ink);\n  transition: transform 0.06s;\n}\n.btn span {\n  display: inline-flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.2);\n}\n.btn small {\n  font-size: calc(var(--u) * 0.66);\n  font-weight: 700;\n  opacity: 0.95;\n}\n.btn:active {\n  transform: translateY(calc(var(--u) * 0.16));\n  box-shadow:\n    inset 0 calc(var(--u) * -0.2) 0 rgba(0, 0, 0, 0.18),\n    inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.45),\n    0 calc(var(--u) * 0.06) 0 var(--ink);\n}\n.btn-yellow {\n  background: linear-gradient(#ffe066, #ffb31a);\n}\n.btn-green {\n  background: linear-gradient(#7ef08a, #2fb34a);\n}\n.btn-blue {\n  background: linear-gradient(#6fd3ff, #2f86ff);\n}\n.btn-red {\n  background: linear-gradient(#ff8f8f, #e53b4a);\n}\n.btn-purple {\n  background: linear-gradient(#cf9bff, #8243f5);\n}\n.btn-gray {\n  background: linear-gradient(#e2e2ea, #a4a4b6);\n}\n.btn.is-disabled {\n  filter: grayscale(0.85) brightness(0.92);\n}\n.btn-sm {\n  min-width: calc(var(--u) * 4);\n  padding: calc(var(--u) * 0.32) calc(var(--u) * 0.6) calc(var(--u) * 0.42);\n  font-size: calc(var(--u) * 0.82);\n  border-radius: calc(var(--u) * 0.75);\n}\n.btn-big {\n  min-width: calc(var(--u) * 10);\n  padding: calc(var(--u) * 0.75) calc(var(--u) * 1.4) calc(var(--u) * 0.85);\n  font-size: calc(var(--u) * 1.25);\n  border-radius: calc(var(--u) * 1.2);\n}\n.row-btns {\n  display: flex;\n  gap: calc(var(--u) * 0.7);\n  justify-content: center;\n  flex-wrap: wrap;\n  margin-top: calc(var(--u) * 0.4);\n}\n.dot {\n  position: absolute;\n  top: calc(var(--u) * -0.25);\n  right: calc(var(--u) * -0.25);\n  min-width: calc(var(--u) * 1.05);\n  height: calc(var(--u) * 1.05);\n  padding: 0 calc(var(--u) * 0.2);\n  border-radius: calc(var(--u) * 1);\n  background: #ff3b4e;\n  border: calc(var(--u) * 0.12) solid #fff;\n  color: #fff;\n  font-size: calc(var(--u) * 0.62);\n  font-weight: 900;\n  line-height: calc(var(--u) * 0.85);\n  text-align: center;\n  box-shadow: 0 calc(var(--u) * 0.1) 0 rgba(0, 0, 0, 0.3);\n  animation: dotpop 1.4s infinite;\n}\n.dot.up {\n  background: #35b84a;\n}\n@keyframes dotpop {\n  0%,\n  100% {\n    transform: scale(1);\n  }\n  50% {\n    transform: scale(1.18);\n  }\n}\n\n/* ---------- bars ---------- */\n.bar {\n  position: relative;\n  width: 100%;\n  height: calc(var(--u) * 0.9);\n  border-radius: calc(var(--u) * 1);\n  background: #3a2c52;\n  border: calc(var(--u) * 0.12) solid var(--ink);\n  overflow: hidden;\n}\n.bar-fill {\n  height: 100%;\n  background: linear-gradient(#7ef08a, #2fb34a);\n  border-radius: calc(var(--u) * 1);\n  transition: width 0.25s;\n}\n.bar-label {\n  position: absolute;\n  inset: 0;\n  font-size: calc(var(--u) * 0.6);\n  font-weight: 900;\n  color: #fff;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  text-shadow: 0 calc(var(--u) * 0.06) 0 var(--ink);\n}\n\n/* ---------- menu frame ---------- */\n.menu {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  flex-direction: column;\n  background:\n    radial-gradient(circle at 20% 10%, rgba(255, 255, 255, 0.08) 0 calc(var(--u) * 3), transparent calc(var(--u) * 3.1)),\n    radial-gradient(circle at 85% 40%, rgba(255, 255, 255, 0.06) 0 calc(var(--u) * 4), transparent calc(var(--u) * 4.1)),\n    linear-gradient(#5a45d6, #3a2a8f 60%, #2c2070);\n}\n.resbar {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.4);\n  padding: calc(var(--u) * 0.5) calc(var(--u) * 2.6) calc(var(--u) * 0.4) calc(var(--u) * 0.5);\n  padding-top: max(calc(var(--u) * 0.5), env(safe-area-inset-top));\n  z-index: 5;\n}\n.avatar {\n  position: relative;\n  flex: none;\n  width: calc(var(--u) * 3);\n  height: calc(var(--u) * 3);\n  border-radius: calc(var(--u) * 0.9);\n  background: linear-gradient(#8fe9ff, #3fa9ff);\n  border: calc(var(--u) * 0.16) solid var(--ink);\n  box-shadow: 0 calc(var(--u) * 0.18) 0 var(--ink);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  cursor: pointer;\n}\n.avatar-pow {\n  position: absolute;\n  bottom: calc(var(--u) * -0.55);\n  left: 50%;\n  transform: translateX(-50%);\n  background: #2a1a3e;\n  color: #ffd23f;\n  font-size: calc(var(--u) * 0.62);\n  font-weight: 900;\n  border-radius: calc(var(--u) * 0.6);\n  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.35) calc(var(--u) * 0.05) calc(var(--u) * 0.15);\n  white-space: nowrap;\n  display: flex;\n  align-items: center;\n}\n.chips {\n  display: flex;\n  gap: calc(var(--u) * 0.3);\n  flex: 1;\n  min-width: 0;\n}\n.chip {\n  position: relative;\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.15);\n  height: calc(var(--u) * 1.75);\n  padding: 0 calc(var(--u) * 1.1) 0 calc(var(--u) * 0.1);\n  background: rgba(20, 10, 40, 0.55);\n  border: calc(var(--u) * 0.13) solid var(--ink);\n  border-radius: calc(var(--u) * 1);\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.78);\n  cursor: pointer;\n  white-space: nowrap;\n}\n.chip span {\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.chip .ico {\n  margin-left: calc(var(--u) * -0.25);\n}\n.chip-sub {\n  position: absolute;\n  bottom: calc(var(--u) * -0.72);\n  left: calc(var(--u) * 1.3);\n  font-size: calc(var(--u) * 0.55);\n  font-style: normal;\n  color: #c9f8a8;\n}\n.plus {\n  position: absolute;\n  right: calc(var(--u) * 0.12);\n  width: calc(var(--u) * 0.95);\n  height: calc(var(--u) * 0.95);\n  border-radius: 50%;\n  background: #35b84a;\n  border: calc(var(--u) * 0.1) solid var(--ink);\n  font-size: calc(var(--u) * 0.75);\n  line-height: calc(var(--u) * 0.7);\n  text-align: center;\n  color: #fff;\n}\n.gear {\n  position: absolute;\n  top: max(calc(var(--u) * 0.55), env(safe-area-inset-top));\n  right: calc(var(--u) * 0.5);\n  width: calc(var(--u) * 1.9);\n  height: calc(var(--u) * 1.9);\n  border-radius: calc(var(--u) * 0.6);\n  background: rgba(20, 10, 40, 0.55);\n  border: calc(var(--u) * 0.13) solid var(--ink);\n  color: #fff;\n  font-size: calc(var(--u) * 1.1);\n  z-index: 6;\n}\n.content {\n  flex: 1;\n  min-height: 0;\n  overflow-y: auto;\n  overflow-x: hidden;\n  -webkit-overflow-scrolling: touch;\n  touch-action: pan-y;\n}\n.content::-webkit-scrollbar {\n  display: none;\n}\n.tabbar {\n  flex: none;\n  display: flex;\n  align-items: flex-end;\n  justify-content: space-around;\n  height: calc(var(--u) * 4.4);\n  padding: 0 calc(var(--u) * 0.3) max(calc(var(--u) * 0.3), env(safe-area-inset-bottom));\n  background: linear-gradient(#2f2360, #1d1540);\n  border-top: calc(var(--u) * 0.18) solid var(--ink);\n  box-shadow: inset 0 calc(var(--u) * 0.18) 0 rgba(255, 255, 255, 0.12);\n}\n.tab {\n  position: relative;\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.05);\n  padding: calc(var(--u) * 0.35) 0 calc(var(--u) * 0.25);\n  border-radius: calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0 0;\n  color: #cfc4f5;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.72);\n  transition: transform 0.15s;\n}\n.tab .ico {\n  filter: saturate(0.6) brightness(0.9);\n}\n.tab.on {\n  color: #fff;\n  transform: translateY(calc(var(--u) * -0.35));\n}\n.tab.on .ico {\n  filter: none;\n}\n.tab.on::before {\n  content: \"\";\n  position: absolute;\n  inset: 0 calc(var(--u) * 0.15) calc(var(--u) * -0.4);\n  z-index: -1;\n  border-radius: calc(var(--u) * 0.9);\n  background: linear-gradient(#ffd23f, #ff9f1a);\n  border: calc(var(--u) * 0.16) solid var(--ink);\n}\n.tab .dot {\n  top: calc(var(--u) * 0.1);\n  right: calc(var(--u) * 0.6);\n}\n\n/* ---------- panels ---------- */\n.screen {\n  padding: calc(var(--u) * 0.6) calc(var(--u) * 0.6) calc(var(--u) * 1.2);\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.6);\n}\n.panel {\n  position: relative;\n  background: linear-gradient(var(--cream), var(--cream2));\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  border-radius: calc(var(--u) * 1.1);\n  padding: calc(var(--u) * 0.7);\n  box-shadow:\n    inset 0 calc(var(--u) * 0.18) 0 #fff,\n    0 calc(var(--u) * 0.25) 0 rgba(20, 10, 40, 0.5);\n}\n.panel-title {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.4);\n  font-weight: 900;\n  font-size: calc(var(--u) * 1);\n  margin-bottom: calc(var(--u) * 0.5);\n}\n\n/* ---------- home ---------- */\n.home {\n  display: flex;\n  flex-direction: column;\n  min-height: 100%;\n  padding: calc(var(--u) * 0.3) calc(var(--u) * 0.5) calc(var(--u) * 0.6);\n  gap: calc(var(--u) * 0.5);\n}\n.chapter-card {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.3);\n  background: linear-gradient(#ffcf5a, #ff9e2c);\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  border-radius: calc(var(--u) * 1.2);\n  padding: calc(var(--u) * 0.4);\n  box-shadow:\n    inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.5),\n    0 calc(var(--u) * 0.25) 0 var(--ink);\n}\n.arrow {\n  width: calc(var(--u) * 2.2);\n  height: calc(var(--u) * 2.6);\n  border-radius: calc(var(--u) * 0.8);\n  background: var(--cream);\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  font-size: calc(var(--u) * 1.6);\n  font-weight: 900;\n  line-height: 1;\n}\n.arrow {\n  position: relative;\n}\n.arrow:disabled {\n  opacity: 0.35;\n}\n.arrow.pulse {\n  background: linear-gradient(#7ef08a, #2fb34a);\n  color: #fff;\n  animation: breathe 0.9s infinite;\n}\n.arrow-new {\n  position: absolute;\n  bottom: calc(var(--u) * -0.85);\n  left: 50%;\n  transform: translateX(-50%);\n  white-space: nowrap;\n  font-size: calc(var(--u) * 0.55);\n  font-style: normal;\n  font-weight: 900;\n  color: #fff;\n  background: #ff3b4e;\n  border: calc(var(--u) * 0.1) solid var(--ink);\n  border-radius: calc(var(--u) * 0.5);\n  padding: 0 calc(var(--u) * 0.25);\n}\n.chapter-mid {\n  flex: 1;\n  text-align: center;\n  cursor: pointer;\n}\n.chapter-name {\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 1.28);\n}\n.chapter-sub {\n  display: flex;\n  justify-content: center;\n  gap: calc(var(--u) * 0.4);\n  margin-top: calc(var(--u) * 0.15);\n}\n.diff-tag {\n  font-size: calc(var(--u) * 0.72);\n  font-weight: 900;\n  color: #fff;\n  border-radius: calc(var(--u) * 0.6);\n  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.5);\n  border: calc(var(--u) * 0.12) solid var(--ink);\n  background: #35b84a;\n}\n.diff-tag.d1 {\n  background: #ff8a1f;\n}\n.diff-tag.d2 {\n  background: #e53b4a;\n}\n.rec {\n  font-size: calc(var(--u) * 0.75);\n  font-weight: 900;\n  border-radius: calc(var(--u) * 0.6);\n  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.5);\n  background: rgba(42, 26, 62, 0.75);\n}\n.rec.ok {\n  color: #9dff8a;\n}\n.rec.low {\n  color: #ff8a8a;\n}\n.scene-wrap {\n  position: relative;\n  flex: 1;\n  min-height: calc(var(--u) * 15);\n  border-radius: calc(var(--u) * 1.2);\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  overflow: hidden;\n  box-shadow: 0 calc(var(--u) * 0.25) 0 rgba(20, 10, 40, 0.5);\n}\n.scene {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n}\n.quote {\n  position: absolute;\n  left: 50%;\n  bottom: calc(var(--u) * 0.4);\n  transform: translateX(-50%);\n  white-space: nowrap;\n  font-size: calc(var(--u) * 0.72);\n  font-weight: 700;\n  color: #5a3f22;\n  background: rgba(255, 247, 230, 0.85);\n  border-radius: calc(var(--u) * 0.8);\n  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.6);\n  border: calc(var(--u) * 0.1) solid rgba(42, 26, 62, 0.4);\n}\n.side {\n  position: absolute;\n  top: calc(var(--u) * 0.5);\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.5);\n}\n.side-l {\n  left: calc(var(--u) * 0.4);\n}\n.side-r {\n  right: calc(var(--u) * 0.4);\n}\n.side-btn {\n  position: relative;\n  width: calc(var(--u) * 3.3);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  padding: calc(var(--u) * 0.15) 0 calc(var(--u) * 0.2);\n  border-radius: calc(var(--u) * 0.9);\n  background: rgba(255, 247, 230, 0.92);\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  box-shadow: 0 calc(var(--u) * 0.16) 0 var(--ink);\n  font-size: calc(var(--u) * 0.6);\n  font-weight: 900;\n  white-space: nowrap;\n}\n.miles {\n  background: rgba(20, 10, 40, 0.5);\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 1);\n  padding: calc(var(--u) * 0.35) calc(var(--u) * 1.4) calc(var(--u) * 1.7);\n}\n.miles-label {\n  text-align: center;\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.85);\n  margin-bottom: calc(var(--u) * 1.3);\n}\n.miles-label b {\n  color: #ffd23f;\n}\n.miles-track {\n  position: relative;\n  height: calc(var(--u) * 0.8);\n  background: #3a2c52;\n  border: calc(var(--u) * 0.13) solid var(--ink);\n  border-radius: calc(var(--u) * 1);\n}\n.miles-fill {\n  height: 100%;\n  border-radius: calc(var(--u) * 1);\n  background: linear-gradient(#7ef08a, #2fb34a);\n}\n.mile {\n  position: absolute;\n  top: 50%;\n  transform: translate(-50%, -62%);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  color: #fff;\n  font-size: calc(var(--u) * 0.66);\n  font-weight: 900;\n  text-shadow: 0 calc(var(--u) * 0.08) 0 var(--ink);\n}\n.mile span {\n  margin-top: calc(var(--u) * -0.3);\n}\n.mile.ready .ico {\n  animation: bounce 0.8s infinite;\n  filter: drop-shadow(0 0 calc(var(--u) * 0.4) #ffe066);\n}\n.mile.claimed .ico {\n  filter: grayscale(1) brightness(0.8);\n  opacity: 0.7;\n}\n@keyframes bounce {\n  0%,\n  100% {\n    transform: translateY(0) rotate(0);\n  }\n  50% {\n    transform: translateY(calc(var(--u) * -0.3)) rotate(-6deg);\n  }\n}\n.start-wrap {\n  position: relative;\n  display: flex;\n  justify-content: center;\n  padding-bottom: calc(var(--u) * 0.2);\n}\n.start-btn {\n  font-size: calc(var(--u) * 1.6);\n  min-width: calc(var(--u) * 14);\n  padding: calc(var(--u) * 0.7) calc(var(--u) * 1.5) calc(var(--u) * 0.75);\n  animation: breathe 1.8s infinite;\n}\n.start-btn .cost {\n  font-size: calc(var(--u) * 0.8);\n  background: rgba(42, 26, 62, 0.55);\n  border-radius: calc(var(--u) * 0.8);\n  padding: 0 calc(var(--u) * 0.6) 0 calc(var(--u) * 0.2);\n  margin-top: calc(var(--u) * 0.1);\n  text-shadow: none;\n}\n@keyframes breathe {\n  0%,\n  100% {\n    transform: scale(1);\n  }\n  50% {\n    transform: scale(1.04);\n  }\n}\n.finger {\n  position: absolute;\n  right: calc(var(--u) * 2.4);\n  bottom: calc(var(--u) * -0.6);\n  font-size: calc(var(--u) * 2.2);\n  animation: tapfinger 1s infinite;\n  pointer-events: none;\n}\n@keyframes tapfinger {\n  0%,\n  100% {\n    transform: translate(0, 0);\n  }\n  50% {\n    transform: translate(calc(var(--u) * -0.3), calc(var(--u) * -0.5));\n  }\n}\n\n/* ---------- modals ---------- */\n.modal-back {\n  position: absolute;\n  inset: 0;\n  z-index: 50;\n  background: rgba(10, 5, 25, 0.7);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  padding: calc(var(--u) * 1);\n  animation: fadein 0.18s;\n}\n@keyframes fadein {\n  from {\n    opacity: 0;\n  }\n}\n.modal {\n  position: relative;\n  width: 100%;\n  max-height: 92%;\n  display: flex;\n  flex-direction: column;\n  background: linear-gradient(var(--cream), var(--cream2));\n  border: calc(var(--u) * 0.2) solid var(--ink);\n  border-radius: calc(var(--u) * 1.3);\n  box-shadow:\n    inset 0 calc(var(--u) * 0.2) 0 #fff,\n    0 calc(var(--u) * 0.35) 0 var(--ink);\n  animation: popin 0.25s cubic-bezier(0.2, 1.4, 0.4, 1);\n}\n@keyframes popin {\n  from {\n    transform: scale(0.7);\n    opacity: 0;\n  }\n}\n.modal-title {\n  margin: calc(var(--u) * -1.1) auto 0;\n  padding: calc(var(--u) * 0.35) calc(var(--u) * 1.6);\n  background: linear-gradient(#b889ff, #7a3cf0);\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  border-radius: calc(var(--u) * 0.9);\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 1.1);\n  box-shadow: 0 calc(var(--u) * 0.2) 0 var(--ink);\n  text-shadow: 0 calc(var(--u) * 0.1) 0 var(--ink);\n}\n.modal-x {\n  position: absolute;\n  top: calc(var(--u) * -0.7);\n  right: calc(var(--u) * -0.5);\n  width: calc(var(--u) * 2.2);\n  height: calc(var(--u) * 2.2);\n  border-radius: 50%;\n  background: linear-gradient(#ff8f8f, #e53b4a);\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  color: #fff;\n  font-size: calc(var(--u) * 1.4);\n  font-weight: 900;\n  line-height: 1;\n  box-shadow: 0 calc(var(--u) * 0.16) 0 var(--ink);\n}\n.modal-body {\n  padding: calc(var(--u) * 0.9);\n  overflow-y: auto;\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.7);\n  align-items: stretch;\n}\n.modal-body > .btn {\n  align-self: center;\n}\n.rewards {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  gap: calc(var(--u) * 0.5);\n}\n.reward {\n  position: relative;\n  color: var(--ink);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  min-width: calc(var(--u) * 4.4);\n  padding: calc(var(--u) * 0.3) calc(var(--u) * 0.3) calc(var(--u) * 0.35);\n  background: #fff;\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 0.8);\n  box-shadow: 0 calc(var(--u) * 0.15) 0 rgba(42, 26, 62, 0.5);\n  animation: popin 0.35s both;\n}\n.reward b {\n  font-size: calc(var(--u) * 0.9);\n  font-weight: 900;\n}\n.reward span {\n  font-size: calc(var(--u) * 0.62);\n  color: #7a6a8e;\n  font-weight: 700;\n}\n.rewards-sm {\n  gap: calc(var(--u) * 0.25);\n  justify-content: flex-start;\n}\n.rewards-sm .reward {\n  min-width: 0;\n  flex-direction: row;\n  gap: calc(var(--u) * 0.1);\n  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.35) calc(var(--u) * 0.1) calc(var(--u) * 0.1);\n  border-radius: calc(var(--u) * 0.6);\n  border-width: calc(var(--u) * 0.12);\n  animation: none;\n  box-shadow: none;\n}\n.rewards-sm .reward b {\n  font-size: calc(var(--u) * 0.75);\n}\n.reward-back {\n  z-index: 60;\n}\n.reward-pop {\n  position: relative;\n  width: 100%;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 1);\n  padding: calc(var(--u) * 1.5) calc(var(--u) * 0.8);\n  animation: popin 0.3s cubic-bezier(0.2, 1.4, 0.4, 1);\n}\n.reward-rays {\n  position: absolute;\n  left: 50%;\n  top: 50%;\n  width: calc(var(--u) * 26);\n  height: calc(var(--u) * 26);\n  margin: calc(var(--u) * -13) 0 0 calc(var(--u) * -13);\n  background: repeating-conic-gradient(rgba(255, 230, 120, 0.22) 0 12deg, transparent 12deg 30deg);\n  border-radius: 50%;\n  mask: radial-gradient(circle, #000 30%, transparent 70%);\n  -webkit-mask: radial-gradient(circle, #000 30%, transparent 70%);\n  animation: spin 12s linear infinite;\n  pointer-events: none;\n}\n@keyframes spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n.ribbon {\n  position: relative;\n  padding: calc(var(--u) * 0.4) calc(var(--u) * 2);\n  font-size: calc(var(--u) * 1.4);\n  font-weight: 900;\n  color: #fff;\n  background: linear-gradient(#ffcf5a, #ff8a1f);\n  border: calc(var(--u) * 0.2) solid var(--ink);\n  border-radius: calc(var(--u) * 0.8);\n  box-shadow: 0 calc(var(--u) * 0.25) 0 var(--ink);\n}\n.toasts {\n  position: absolute;\n  left: 0;\n  right: 0;\n  top: 38%;\n  z-index: 80;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.4);\n  pointer-events: none;\n}\n.toast {\n  max-width: 85%;\n  background: rgba(20, 10, 40, 0.88);\n  color: #fff;\n  font-weight: 800;\n  font-size: calc(var(--u) * 0.85);\n  border-radius: calc(var(--u) * 1);\n  padding: calc(var(--u) * 0.45) calc(var(--u) * 1);\n  border: calc(var(--u) * 0.13) solid #ffd23f;\n  text-align: center;\n  animation: toastin 1.8s both;\n}\n@keyframes toastin {\n  0% {\n    opacity: 0;\n    transform: translateY(calc(var(--u) * 0.6)) scale(0.9);\n  }\n  12%,\n  80% {\n    opacity: 1;\n    transform: none;\n  }\n  100% {\n    opacity: 0;\n    transform: translateY(calc(var(--u) * -0.6));\n  }\n}\n\n/* chapter list */\n.diff-row {\n  display: flex;\n  gap: calc(var(--u) * 0.4);\n  justify-content: center;\n}\n.diff-chip {\n  padding: calc(var(--u) * 0.3) calc(var(--u) * 1);\n  border-radius: calc(var(--u) * 0.8);\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  background: #e8e2f2;\n  font-weight: 900;\n}\n.diff-chip.on {\n  background: linear-gradient(#ffe066, #ffb31a);\n}\n.diff-chip.locked {\n  opacity: 0.45;\n}\n.chapter-list {\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.4);\n  max-height: 60vh;\n  overflow-y: auto;\n}\n.chapter-item {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.5);\n  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.6);\n  background: #fff;\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 0.9);\n  cursor: pointer;\n}\n.chapter-item.cur {\n  background: #fff3c4;\n  box-shadow: inset 0 0 0 calc(var(--u) * 0.15) #ffb31a;\n}\n.chapter-item.locked {\n  opacity: 0.55;\n}\n.ci-main {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n}\n.ci-best {\n  font-weight: 900;\n}\n\n/* daily / sign / idle / vault */\n.task-list {\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.45);\n}\n.task {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.4);\n  background: #fff;\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 0.9);\n  padding: calc(var(--u) * 0.45) calc(var(--u) * 0.5);\n}\n.task-main {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.25);\n  font-size: calc(var(--u) * 0.85);\n}\n.task .rewards {\n  width: auto;\n  flex: none;\n}\n.task-all {\n  background: #fff3c4;\n}\n.sign-grid {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: calc(var(--u) * 0.4);\n}\n.sign-day {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.2);\n  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.2);\n  background: #fff;\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 0.8);\n  font-size: calc(var(--u) * 0.7);\n  font-weight: 900;\n}\n.sign-day .rewards-sm {\n  justify-content: center;\n}\n.sign-day.big {\n  grid-column: span 2;\n  background: #fff3c4;\n}\n.sign-day.today {\n  box-shadow: 0 0 0 calc(var(--u) * 0.2) #ffb31a;\n  animation: breathe 1.4s infinite;\n}\n.sign-day.done {\n  opacity: 0.55;\n}\n.sign-check {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  font-size: calc(var(--u) * 2);\n  color: #35b84a;\n  text-shadow: 0 calc(var(--u) * 0.1) 0 var(--ink);\n}\n.idle-top {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.6);\n}\n.idle-time {\n  font-size: calc(var(--u) * 1.2);\n  font-weight: 900;\n}\n.vault-stage {\n  min-height: calc(var(--u) * 12);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  background: radial-gradient(circle, #6a4bd6, #2c1f63);\n  border-radius: calc(var(--u) * 1);\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  padding: calc(var(--u) * 0.6);\n}\n.vault-pool {\n  display: flex;\n  flex-wrap: wrap;\n  gap: calc(var(--u) * 0.35);\n  justify-content: center;\n}\n.vault-cell {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  background: rgba(255, 255, 255, 0.12);\n  border: calc(var(--u) * 0.15) solid;\n  border-radius: calc(var(--u) * 0.8);\n  padding: calc(var(--u) * 0.2) calc(var(--u) * 0.3);\n  font-size: calc(var(--u) * 0.65);\n  font-weight: 900;\n}\n.vault-spin {\n  animation: shakebox 0.18s infinite;\n}\n@keyframes shakebox {\n  0%,\n  100% {\n    transform: rotate(-6deg) scale(1.05);\n  }\n  50% {\n    transform: rotate(6deg) scale(1.1);\n  }\n}\n.vault-hero {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.3);\n  color: #fff;\n  font-weight: 900;\n  border: calc(var(--u) * 0.2) solid transparent;\n  border-radius: calc(var(--u) * 1);\n  padding: calc(var(--u) * 0.5) calc(var(--u) * 1);\n  animation: popin 0.4s cubic-bezier(0.2, 1.4, 0.4, 1);\n}\n.vault-hero b {\n  font-size: calc(var(--u) * 1.3);\n}\n\n/* ---------- hero screen ---------- */\n.hero-head {\n  display: flex;\n  gap: calc(var(--u) * 0.7);\n  align-items: center;\n}\n.hero-portrait {\n  position: relative;\n  flex: none;\n  border-radius: calc(var(--u) * 1);\n  border: calc(var(--u) * 0.22) solid;\n  background: radial-gradient(circle at 50% 40%, #bff3ff, #5aa8ff);\n}\n.stars {\n  position: absolute;\n  bottom: calc(var(--u) * -0.5);\n  left: 0;\n  right: 0;\n  text-align: center;\n  font-size: calc(var(--u) * 0.85);\n  color: #7a6a8e;\n  text-shadow: 0 calc(var(--u) * 0.08) 0 var(--ink);\n}\n.stars .on {\n  color: #ffd23f;\n}\n.hero-info {\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.2);\n  min-width: 0;\n}\n.hero-name {\n  font-size: calc(var(--u) * 1.3);\n  font-weight: 900;\n}\n.hero-name small {\n  font-size: calc(var(--u) * 0.75);\n  color: #7a6a8e;\n}\n.hero-lv {\n  display: inline-block;\n  align-self: flex-start;\n  background: #2a1a3e;\n  color: #ffd23f;\n  border-radius: calc(var(--u) * 0.6);\n  padding: 0 calc(var(--u) * 0.5);\n  font-weight: 900;\n}\n.hero-pow {\n  font-weight: 800;\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.2);\n}\n.hero-pow b {\n  color: #e5533b;\n  font-size: calc(var(--u) * 1.15);\n}\n.stat-row {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.5);\n  padding: calc(var(--u) * 0.4) calc(var(--u) * 0.3);\n  border-bottom: calc(var(--u) * 0.12) dashed rgba(42, 26, 62, 0.2);\n}\n.stat-main {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n}\n.stat-val {\n  font-weight: 900;\n  font-size: calc(var(--u) * 1.05);\n  color: #3b54d8;\n}\n.next-reward {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.5);\n  margin-top: calc(var(--u) * 0.5);\n  font-weight: 800;\n  font-size: calc(var(--u) * 0.8);\n}\n.passives {\n  display: grid;\n  grid-template-columns: 1fr 1fr;\n  gap: calc(var(--u) * 0.4);\n  margin-bottom: calc(var(--u) * 0.4);\n}\n.passive {\n  display: flex;\n  flex-direction: column;\n  padding: calc(var(--u) * 0.35) calc(var(--u) * 0.5);\n  border-radius: calc(var(--u) * 0.8);\n  background: #e8e2f2;\n  border: calc(var(--u) * 0.13) solid rgba(42, 26, 62, 0.4);\n  opacity: 0.6;\n  font-size: calc(var(--u) * 0.72);\n}\n.passive b {\n  font-size: calc(var(--u) * 0.85);\n}\n.passive em {\n  color: #e5533b;\n  margin-left: calc(var(--u) * 0.2);\n}\n.passive.on {\n  opacity: 1;\n  background: #fff3c4;\n  border-color: var(--ink);\n}\n.roster {\n  display: flex;\n  gap: calc(var(--u) * 0.4);\n  overflow-x: auto;\n  padding-bottom: calc(var(--u) * 0.3);\n}\n.roster-cell {\n  position: relative;\n  flex: none;\n  width: calc(var(--u) * 4.6);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  padding: calc(var(--u) * 0.25) calc(var(--u) * 0.2) calc(var(--u) * 0.35);\n  background: #fff;\n  border: calc(var(--u) * 0.18) solid;\n  border-radius: calc(var(--u) * 0.9);\n  font-size: calc(var(--u) * 0.66);\n  font-weight: 900;\n  cursor: pointer;\n}\n.roster-cell b {\n  font-size: calc(var(--u) * 0.8);\n}\n.roster-cell.on {\n  background: #fff3c4;\n  box-shadow: 0 0 0 calc(var(--u) * 0.15) #ffb31a;\n}\n.roster-cell em {\n  position: absolute;\n  top: calc(var(--u) * -0.3);\n  right: calc(var(--u) * -0.3);\n}\n.roster-cell.locked {\n  background: #d9d3e4;\n}\n.hero-detail {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.25);\n  font-weight: 700;\n  font-size: calc(var(--u) * 0.9);\n}\n\n/* ---------- weapons ---------- */\n.loadout {\n  display: grid;\n  grid-template-columns: repeat(4, 1fr);\n  gap: calc(var(--u) * 0.4);\n}\n.slot {\n  aspect-ratio: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  background: #fff;\n  border: calc(var(--u) * 0.2) solid;\n  border-radius: calc(var(--u) * 0.9);\n  font-size: calc(var(--u) * 0.66);\n  font-weight: 900;\n}\n.slot.empty {\n  border: calc(var(--u) * 0.16) dashed rgba(42, 26, 62, 0.35);\n  color: rgba(42, 26, 62, 0.3);\n  font-size: calc(var(--u) * 1.6);\n  background: rgba(255, 255, 255, 0.4);\n}\n.frag-bar {\n  display: flex;\n  justify-content: space-around;\n  background: rgba(20, 10, 40, 0.55);\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 1);\n  padding: calc(var(--u) * 0.25);\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.78);\n}\n.frag {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.1);\n}\n.weapon-grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: calc(var(--u) * 0.5);\n}\n.wcard {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.15);\n  padding: calc(var(--u) * 0.4) calc(var(--u) * 0.35) calc(var(--u) * 0.45);\n  border-radius: calc(var(--u) * 1);\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  background: linear-gradient(#fff, #f1e9ff);\n  box-shadow: 0 calc(var(--u) * 0.2) 0 rgba(20, 10, 40, 0.5);\n  font-size: calc(var(--u) * 0.8);\n}\n.wcard b {\n  font-size: calc(var(--u) * 0.78);\n  white-space: nowrap;\n}\n.wicon {\n  position: relative;\n  width: 100%;\n  display: flex;\n  justify-content: center;\n  border-radius: calc(var(--u) * 0.7);\n  padding: calc(var(--u) * 0.2) 0;\n}\n.r0 .wicon,\n.r0 .relic-icon,\n.wd-icon.r0,\n.relic-icon.r0 {\n  background: radial-gradient(circle, #b9f5c8, #47d16c);\n}\n.r1 .wicon,\n.r1 .relic-icon,\n.wd-icon.r1,\n.relic-icon.r1 {\n  background: radial-gradient(circle, #bfe3ff, #3ba4ff);\n}\n.r2 .wicon,\n.r2 .relic-icon,\n.wd-icon.r2,\n.relic-icon.r2 {\n  background: radial-gradient(circle, #e7ccff, #b35cff);\n}\n.r3 .wicon,\n.r3 .relic-icon,\n.wd-icon.r3,\n.relic-icon.r3 {\n  background: radial-gradient(circle, #ffe3a8, #ffae1a);\n}\n.r4 .wicon,\n.r4 .relic-icon,\n.wd-icon.r4,\n.relic-icon.r4 {\n  background: radial-gradient(circle, #ffc2c2, #ff4b4b);\n}\n.wcard.locked,\n.relic.locked {\n  filter: grayscale(0.9);\n  opacity: 0.75;\n}\n.wlock {\n  position: absolute;\n  right: calc(var(--u) * 0.1);\n  bottom: calc(var(--u) * 0.1);\n}\n.wlv {\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.72);\n  color: #3b54d8;\n}\n.wtag {\n  position: absolute;\n  top: calc(var(--u) * -0.35);\n  left: calc(var(--u) * -0.3);\n  z-index: 2;\n  background: #ff5f7a;\n  color: #fff;\n  font-size: calc(var(--u) * 0.62);\n  font-weight: 900;\n  font-style: normal;\n  border: calc(var(--u) * 0.12) solid var(--ink);\n  border-radius: calc(var(--u) * 0.5);\n  padding: 0 calc(var(--u) * 0.3);\n}\n.wcard .dot,\n.relic .dot {\n  z-index: 2;\n}\n.wd-top {\n  display: flex;\n  gap: calc(var(--u) * 0.7);\n  align-items: flex-start;\n}\n.wd-icon {\n  flex: none;\n  border-radius: calc(var(--u) * 1);\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  padding: calc(var(--u) * 0.3);\n}\n.wd-info {\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.3);\n  font-size: calc(var(--u) * 0.85);\n}\n.wd-tag {\n  margin-left: calc(var(--u) * 0.4);\n  font-size: calc(var(--u) * 0.7);\n  background: #2a1a3e;\n  color: #fff;\n  border-radius: calc(var(--u) * 0.5);\n  padding: 0 calc(var(--u) * 0.35);\n}\n.wd-stats {\n  display: flex;\n  flex-wrap: wrap;\n  gap: calc(var(--u) * 0.25);\n}\n.wd-stats span {\n  font-size: calc(var(--u) * 0.7);\n  background: #fff;\n  border: calc(var(--u) * 0.1) solid rgba(42, 26, 62, 0.3);\n  border-radius: calc(var(--u) * 0.5);\n  padding: 0 calc(var(--u) * 0.3);\n}\n.wd-awaken {\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.15);\n  background: linear-gradient(#ffe9e9, #ffd3d3);\n  border: calc(var(--u) * 0.15) solid #ff4b4b;\n  border-radius: calc(var(--u) * 0.8);\n  padding: calc(var(--u) * 0.4) calc(var(--u) * 0.6);\n  font-size: calc(var(--u) * 0.8);\n}\n.wd-awaken b {\n  color: #d9263a;\n}\n.wd-level {\n  display: flex;\n  justify-content: space-between;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.9);\n}\n.wd-cost {\n  display: flex;\n  justify-content: center;\n  gap: calc(var(--u) * 1);\n  font-weight: 900;\n}\n.wd-cost span {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.2);\n}\n.wd-cost .lack {\n  color: #e53b4a;\n}\n\n/* ---------- relics ---------- */\n.relic-box-panel {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.5);\n  background: linear-gradient(#dff0ff, #b9d8ff);\n}\n.rb-main {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.1);\n  font-size: calc(var(--u) * 0.85);\n  font-weight: 800;\n}\n.rb-main b {\n  font-size: calc(var(--u) * 1.05);\n}\n.rb-btns {\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.35);\n}\n.set-panel .panel-title {\n  justify-content: space-between;\n  font-size: calc(var(--u) * 0.95);\n}\n.set-panel .panel-title span {\n  font-size: calc(var(--u) * 0.7);\n  font-weight: 800;\n}\n.set-on {\n  color: #1f9a3a;\n}\n.relic-row {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: calc(var(--u) * 0.45);\n}\n.relic {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.15);\n  padding: calc(var(--u) * 0.35);\n  background: #fff;\n  border: calc(var(--u) * 0.16) solid var(--ink);\n  border-radius: calc(var(--u) * 0.9);\n  font-size: calc(var(--u) * 0.75);\n}\n.relic b {\n  font-size: calc(var(--u) * 0.75);\n  white-space: nowrap;\n}\n.relic-icon {\n  width: 100%;\n  display: flex;\n  justify-content: center;\n  border-radius: calc(var(--u) * 0.7);\n  padding: calc(var(--u) * 0.15) 0;\n}\n.relic-icon.big {\n  width: auto;\n  padding: calc(var(--u) * 0.4);\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  border-radius: calc(var(--u) * 1);\n}\n.relic-detail {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.3);\n  text-align: center;\n}\n.relic-eff {\n  display: flex;\n  gap: calc(var(--u) * 0.5);\n  width: 100%;\n}\n.relic-eff > div {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.15);\n  background: #fff;\n  border: calc(var(--u) * 0.13) solid rgba(42, 26, 62, 0.3);\n  border-radius: calc(var(--u) * 0.8);\n  padding: calc(var(--u) * 0.4);\n  font-size: calc(var(--u) * 0.8);\n  font-weight: 800;\n}\n.relic-eff em {\n  font-style: normal;\n  color: #7a6a8e;\n  font-size: calc(var(--u) * 0.72);\n}\n.relic-results {\n  display: grid;\n  grid-template-columns: repeat(5, 1fr);\n  gap: calc(var(--u) * 0.3);\n}\n.relic-res {\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  background: #fff;\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 0.7);\n  padding: calc(var(--u) * 0.2) 0;\n  font-size: calc(var(--u) * 0.6);\n  font-weight: 900;\n  animation: popin 0.35s both;\n}\n.relic-res b {\n  white-space: nowrap;\n  font-size: calc(var(--u) * 0.6);\n}\n\n/* ---------- shop ---------- */\n.shop-grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: calc(var(--u) * 0.45);\n}\n.shop-item {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.2);\n  padding: calc(var(--u) * 0.45) calc(var(--u) * 0.25);\n  background: #fff;\n  border: calc(var(--u) * 0.16) solid var(--ink);\n  border-radius: calc(var(--u) * 0.9);\n  text-align: center;\n}\n.shop-item b {\n  font-size: calc(var(--u) * 0.8);\n}\n.shop-item .muted {\n  font-size: calc(var(--u) * 0.62);\n  min-height: calc(var(--u) * 1.6);\n}\n.shop-item .btn {\n  min-width: 0;\n  width: 100%;\n}\n.shop-item.sold {\n  opacity: 0.6;\n}\n.shop-tag {\n  position: absolute;\n  top: calc(var(--u) * -0.4);\n  right: calc(var(--u) * -0.3);\n  background: #ff3b4e;\n  color: #fff;\n  font-size: calc(var(--u) * 0.6);\n  font-weight: 900;\n  font-style: normal;\n  border: calc(var(--u) * 0.12) solid var(--ink);\n  border-radius: calc(var(--u) * 0.5);\n  padding: 0 calc(var(--u) * 0.3);\n  transform: rotate(8deg);\n}\n\n/* ---------- battle ---------- */\n.battle {\n  position: absolute;\n  inset: 0;\n  background: #120a22;\n  overflow: hidden;\n}\n.battle-cv {\n  position: absolute;\n  left: 0;\n  top: 0;\n  touch-action: none;\n}\n.hud {\n  position: absolute;\n  top: 0;\n  left: 0;\n  right: 0;\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.5);\n  padding: max(calc(var(--u) * 0.5), env(safe-area-inset-top)) calc(var(--u) * 0.5) calc(var(--u) * 0.5);\n  pointer-events: none;\n  background: linear-gradient(rgba(10, 5, 25, 0.75), rgba(10, 5, 25, 0));\n}\n.hud > * {\n  pointer-events: auto;\n}\n.hud-btn {\n  flex: none;\n  width: calc(var(--u) * 2.5);\n  height: calc(var(--u) * 2.5);\n  border-radius: calc(var(--u) * 0.8);\n  background: linear-gradient(#6fd3ff, #2f86ff);\n  border: calc(var(--u) * 0.16) solid var(--ink);\n  box-shadow: 0 calc(var(--u) * 0.16) 0 var(--ink);\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 1);\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n.hud-btn.speed.on {\n  background: linear-gradient(#ffe066, #ffb31a);\n}\n.pause-ico {\n  width: calc(var(--u) * 0.85);\n  height: calc(var(--u) * 1);\n  border-left: calc(var(--u) * 0.3) solid #fff;\n  border-right: calc(var(--u) * 0.3) solid #fff;\n}\n.hud-mid {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.2);\n}\n.hud-title {\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.85);\n}\n.hud-bar {\n  position: relative;\n  width: 100%;\n  height: calc(var(--u) * 1.3);\n  border-radius: calc(var(--u) * 1);\n  background: rgba(20, 10, 40, 0.8);\n  border: calc(var(--u) * 0.16) solid var(--ink);\n  overflow: hidden;\n}\n.hud-bar.big {\n  height: calc(var(--u) * 1.6);\n}\n.hud-fill {\n  height: 100%;\n  background: linear-gradient(#ffe066, #ff8a1f);\n  border-radius: calc(var(--u) * 1);\n  transition: width 0.2s;\n  box-shadow: inset 0 calc(var(--u) * 0.2) 0 rgba(255, 255, 255, 0.5);\n}\n.hud-bar span {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.85);\n  text-shadow:\n    0 calc(var(--u) * 0.08) 0 var(--ink),\n    calc(var(--u) * 0.06) 0 0 var(--ink),\n    calc(var(--u) * -0.06) 0 0 var(--ink);\n}\n.mode-banner {\n  position: absolute;\n  top: 28%;\n  left: 0;\n  right: 0;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.3);\n  padding: calc(var(--u) * 0.7) 0;\n  background: linear-gradient(90deg, transparent, rgba(20, 10, 40, 0.8) 20%, rgba(20, 10, 40, 0.8) 80%, transparent);\n  color: #fff;\n  pointer-events: none;\n  animation: bannerin 2.2s both;\n}\n.mode-banner b {\n  font-size: calc(var(--u) * 2.2);\n  font-weight: 900;\n  color: #ffd23f;\n  letter-spacing: 0.2em;\n}\n.mode-banner span {\n  font-size: calc(var(--u) * 0.85);\n  font-weight: 700;\n}\n@keyframes bannerin {\n  0% {\n    opacity: 0;\n    transform: scaleY(0.2);\n  }\n  12%,\n  80% {\n    opacity: 1;\n    transform: none;\n  }\n  100% {\n    opacity: 0;\n  }\n}\n.danger-tag,\n.frozen-tag {\n  position: absolute;\n  top: calc(var(--u) * 4.4);\n  left: 50%;\n  transform: translateX(-50%);\n  background: #e53b4a;\n  color: #fff;\n  font-weight: 900;\n  border: calc(var(--u) * 0.15) solid var(--ink);\n  border-radius: calc(var(--u) * 1);\n  padding: calc(var(--u) * 0.15) calc(var(--u) * 0.8);\n  animation: breathe 0.6s infinite;\n  pointer-events: none;\n}\n.frozen-tag {\n  top: calc(var(--u) * 6.2);\n  background: #3fa9ff;\n}\n.tray {\n  position: absolute;\n  transform: translate(-50%, 50%);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  filter: grayscale(0.85) brightness(0.8);\n  opacity: 0.8;\n  transition: filter 0.2s;\n}\n.tray.has {\n  filter: none;\n  opacity: 1;\n  animation: bounce 1s infinite;\n}\n.tray em {\n  position: absolute;\n  top: calc(var(--u) * 0.2);\n  right: calc(var(--u) * -0.2);\n  min-width: calc(var(--u) * 1.4);\n  height: calc(var(--u) * 1.4);\n  border-radius: calc(var(--u) * 1);\n  background: #ff3b4e;\n  border: calc(var(--u) * 0.15) solid #fff;\n  color: #fff;\n  font-style: normal;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.8);\n  line-height: calc(var(--u) * 1.1);\n}\n.tray span {\n  margin-top: calc(var(--u) * -0.6);\n  background: rgba(20, 10, 40, 0.8);\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.7);\n  border-radius: calc(var(--u) * 0.6);\n  padding: 0 calc(var(--u) * 0.4);\n  border: calc(var(--u) * 0.12) solid var(--ink);\n}\n.tip-back {\n  position: absolute;\n  inset: 0;\n  z-index: 30;\n  background: rgba(10, 5, 25, 0.55);\n}\n.tip-bubble {\n  position: absolute;\n  left: 50%;\n  transform: translateX(-50%);\n  width: calc(var(--u) * 17);\n  background: #fff;\n  border: calc(var(--u) * 0.18) solid var(--ink);\n  border-radius: calc(var(--u) * 1);\n  padding: calc(var(--u) * 0.6) calc(var(--u) * 0.8);\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.95);\n  box-shadow: 0 calc(var(--u) * 0.2) 0 var(--ink);\n}\n.tip-bubble small {\n  font-weight: 700;\n  font-size: calc(var(--u) * 0.72);\n  color: #7a6a8e;\n}\n.tip-hand {\n  position: absolute;\n  transform: translate(-50%, 0);\n  font-size: calc(var(--u) * 2.6);\n  animation: tapfinger 0.8s infinite;\n}\n\n.ov {\n  position: absolute;\n  inset: 0;\n  z-index: 40;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  justify-content: center;\n  gap: calc(var(--u) * 0.7);\n  padding: calc(var(--u) * 1) calc(var(--u) * 0.6);\n  background: rgba(10, 5, 25, 0.78);\n  animation: fadein 0.2s;\n}\n.rar-legend {\n  display: flex;\n  gap: calc(var(--u) * 0.25);\n}\n.rar-legend span {\n  width: calc(var(--u) * 1.6);\n  text-align: center;\n  color: #fff;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.7);\n  border-radius: calc(var(--u) * 0.5);\n  border: calc(var(--u) * 0.12) solid var(--ink);\n  text-shadow: 0 calc(var(--u) * 0.06) 0 var(--ink);\n}\n.cards {\n  display: flex;\n  gap: calc(var(--u) * 0.5);\n  width: 100%;\n  justify-content: center;\n}\n.card-wrap {\n  flex: 1;\n  max-width: calc(var(--u) * 7.6);\n  transition:\n    transform 0.2s,\n    opacity 0.2s;\n}\n.card-wrap.chosen {\n  transform: scale(1.1) translateY(calc(var(--u) * -0.5));\n}\n.card-wrap.dim {\n  opacity: 0.25;\n  transform: scale(0.9);\n}\n.card {\n  position: relative;\n  display: block;\n  width: 100%;\n  padding-top: calc(var(--u) * 2.1);\n  animation: cardin 0.35s both cubic-bezier(0.2, 1.3, 0.4, 1);\n}\n.card-shape {\n  filter: drop-shadow(calc(var(--u) * 0.16) 0 0 var(--ink)) drop-shadow(calc(var(--u) * -0.16) 0 0 var(--ink)) drop-shadow(0 calc(var(--u) * 0.16) 0 var(--ink))\n    drop-shadow(0 calc(var(--u) * -0.16) 0 var(--ink)) drop-shadow(0 calc(var(--u) * 0.3) 0 rgba(0, 0, 0, 0.35));\n}\n.card-body {\n  min-height: calc(var(--u) * 12.5);\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.4);\n  padding: calc(var(--u) * 2.95) calc(var(--u) * 0.45) calc(var(--u) * 2);\n  border-radius: calc(var(--u) * 0.9) calc(var(--u) * 0.9) 0 0;\n  clip-path: polygon(0 0, 100% 0, 100% 86%, 50% 100%, 0 86%);\n  background:\n    radial-gradient(circle at 50% 0, rgba(255, 255, 255, 0.45), rgba(255, 255, 255, 0) 55%),\n    linear-gradient(color-mix(in srgb, var(--rc) 72%, #fff), color-mix(in srgb, var(--rc) 80%, #1a0a30));\n  color: #fff;\n}\n@keyframes cardin {\n  from {\n    transform: translateY(calc(var(--u) * 2)) rotateY(80deg);\n    opacity: 0;\n  }\n}\n.card-wrap {\n  position: relative;\n}\n.card-gem {\n  position: absolute;\n  top: 0;\n  left: 50%;\n  transform: translateX(-50%) rotate(45deg);\n  width: calc(var(--u) * 4);\n  height: calc(var(--u) * 4);\n  border: calc(var(--u) * 0.2) solid var(--ink);\n  border-radius: calc(var(--u) * 0.8);\n  background: linear-gradient(135deg, #fff, var(--rc));\n  box-shadow: 0 0 calc(var(--u) * 0.9) var(--rc);\n  z-index: 2;\n}\n.card-gem-in {\n  position: absolute;\n  inset: 0;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  transform: rotate(-45deg);\n}\n.card-badge {\n  position: absolute;\n  right: calc(var(--u) * -0.9);\n  bottom: calc(var(--u) * -0.2);\n  transform: rotate(-45deg);\n  background: var(--ink);\n  color: #fff;\n  font-style: normal;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.6);\n  border-radius: calc(var(--u) * 0.5);\n  padding: calc(var(--u) * 0.05) calc(var(--u) * 0.3);\n  white-space: nowrap;\n  border: calc(var(--u) * 0.1) solid #fff;\n}\n.card-title {\n  font-size: calc(var(--u) * 1);\n  font-weight: 900;\n  text-align: center;\n  line-height: 1.2;\n  text-shadow:\n    0 calc(var(--u) * 0.1) 0 var(--ink),\n    calc(var(--u) * 0.06) calc(var(--u) * 0.06) 0 var(--ink),\n    calc(var(--u) * -0.06) calc(var(--u) * 0.06) 0 var(--ink),\n    calc(var(--u) * 0.06) calc(var(--u) * -0.06) 0 var(--ink),\n    calc(var(--u) * -0.06) calc(var(--u) * -0.06) 0 var(--ink);\n}\n.card-desc {\n  font-size: calc(var(--u) * 0.82);\n  font-weight: 800;\n  text-align: center;\n  background: rgba(20, 10, 40, 0.45);\n  border-radius: calc(var(--u) * 0.5);\n  padding: calc(var(--u) * 0.25) calc(var(--u) * 0.3);\n  width: 100%;\n  line-height: 1.35;\n}\n.card-note {\n  font-size: calc(var(--u) * 0.66);\n  font-weight: 800;\n  color: #fff7c2;\n}\n.card.r4 .card-gem {\n  animation: glowpulse 1s infinite;\n}\n@keyframes glowpulse {\n  50% {\n    box-shadow: 0 0 calc(var(--u) * 1.8) var(--rc);\n  }\n}\n.card.r3 .card-gem {\n  box-shadow: 0 0 calc(var(--u) * 1.3) var(--rc);\n}\n.chest-hint {\n  color: #cfc4f5;\n  font-size: calc(var(--u) * 0.8);\n  font-weight: 800;\n}\n.chest-btns {\n  display: flex;\n  gap: calc(var(--u) * 0.6);\n}\n.chest-btns .btn {\n  min-width: calc(var(--u) * 8.5);\n}\n.owned {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  gap: calc(var(--u) * 0.3);\n}\n.owned-w {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  background: rgba(255, 255, 255, 0.12);\n  border: calc(var(--u) * 0.13) solid var(--ink);\n  border-radius: calc(var(--u) * 0.7);\n  padding: calc(var(--u) * 0.1) calc(var(--u) * 0.2);\n}\n.owned-w em {\n  font-style: normal;\n  font-size: calc(var(--u) * 0.6);\n  font-weight: 900;\n  color: #ffd23f;\n}\n.owned-w.awk {\n  box-shadow: 0 0 calc(var(--u) * 0.6) #ff4b4b;\n}\n.owned.detail .owned-w {\n  background: #fff;\n  min-width: calc(var(--u) * 4.2);\n}\n.owned.detail b {\n  font-size: calc(var(--u) * 0.62);\n}\n.owned.detail em {\n  color: #e5533b;\n}\n.owned-glob {\n  width: 100%;\n  display: flex;\n  flex-wrap: wrap;\n  gap: calc(var(--u) * 0.3) calc(var(--u) * 0.8);\n  justify-content: center;\n}\n.revive-card,\n.result-card {\n  position: relative;\n  width: 100%;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.6);\n  background: linear-gradient(#4b3a9e, #2c2070);\n  border: calc(var(--u) * 0.2) solid var(--ink);\n  border-radius: calc(var(--u) * 1.4);\n  padding: calc(var(--u) * 1.2) calc(var(--u) * 0.9) calc(var(--u) * 1);\n  color: #fff;\n  box-shadow: 0 calc(var(--u) * 0.35) 0 var(--ink);\n  animation: popin 0.3s cubic-bezier(0.2, 1.4, 0.4, 1);\n}\n.revive-card .ribbon {\n  background: linear-gradient(#6fd3ff, #2f86ff);\n}\n.revive-hero,\n.result-hero {\n  border-radius: 50%;\n  background: radial-gradient(circle, rgba(255, 255, 255, 0.3), transparent 70%);\n}\n.revive-text {\n  font-size: calc(var(--u) * 1.2);\n  font-weight: 900;\n}\n.revive-text b {\n  color: #ffd23f;\n  font-size: calc(var(--u) * 1.5);\n}\n.revive-sub {\n  color: #ffd23f;\n  font-weight: 900;\n}\n.result-card.win .ribbon {\n  background: linear-gradient(#7ef08a, #2fb34a);\n}\n.result-card.lose .ribbon {\n  background: linear-gradient(#cf9bff, #8243f5);\n}\n.result-stats {\n  display: flex;\n  gap: calc(var(--u) * 0.5);\n  width: 100%;\n}\n.result-stats div {\n  flex: 1;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  background: rgba(0, 0, 0, 0.25);\n  border-radius: calc(var(--u) * 0.8);\n  padding: calc(var(--u) * 0.3);\n  font-size: calc(var(--u) * 0.7);\n}\n.result-stats b {\n  font-size: calc(var(--u) * 1.15);\n  color: #ffd23f;\n}\n.result-note {\n  color: #9dff8a;\n  font-weight: 900;\n  font-size: calc(var(--u) * 0.85);\n}\n.result-card .reward {\n  color: var(--ink);\n}\n.dmg-list {\n  width: 100%;\n  display: flex;\n  flex-direction: column;\n  gap: calc(var(--u) * 0.2);\n}\n.dmg-row {\n  display: flex;\n  align-items: center;\n  gap: calc(var(--u) * 0.35);\n  font-size: calc(var(--u) * 0.72);\n  font-weight: 800;\n}\n.dmg-name {\n  width: calc(var(--u) * 5.2);\n  white-space: nowrap;\n  overflow: hidden;\n}\n.dmg-bar {\n  flex: 1;\n  height: calc(var(--u) * 0.55);\n  background: rgba(0, 0, 0, 0.35);\n  border-radius: calc(var(--u) * 1);\n  overflow: hidden;\n}\n.dmg-bar div {\n  height: 100%;\n  border-radius: calc(var(--u) * 1);\n}\n.pause-card {\n  width: 100%;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  gap: calc(var(--u) * 0.7);\n  padding-top: calc(var(--u) * 1.4);\n}\n.pause-card .ribbon {\n  position: absolute;\n  top: calc(var(--u) * -1.4);\n}\n.herocv {\n  display: block;\n}\n  button {min-width:48px;min-height:48px;}\n  .resbar {padding-right:58px;}\n  .gear {width:48px;height:48px;}\n  .mile {min-width:48px;min-height:48px;}\n  .arrow {flex:none;}\n  .tabbar {min-height:58px;}\n  .tab {min-width:48px;min-height:48px;}\n  .game-title { color:var(--cream); text-align:center; font-weight:900; font-size:calc(var(--u) * 0.8); padding:calc(var(--u) * 0.15); }\n  .pause-card .game-title { color:var(--ink); }\n  .language-row {display:flex;flex-wrap:wrap;justify-content:center;gap:8px;width:100%;}\n  .language-button {min-width:64px;min-height:48px;padding:8px;border:2px solid var(--ink);border-radius:12px;background:var(--cream);font:700 14px var(--font);}\n  .language-button[aria-pressed=true] {background:var(--yellow);}\n  .save-status {font-size:14px;text-align:center;line-height:1.4;max-width:100%;}\n  .save-status p {margin:calc(var(--u) * 0.3) 0;}\n  .quote {white-space:normal;width:90%;text-align:center;line-height:1.3;}\n  .side-btn,.wcard b,.relic b,.relic-res b,.dmg-name {white-space:normal;overflow-wrap:anywhere;}\n  .chapter-mid,.hud-mid,.task-main,.rb-main,.wd-info {min-width:0;}\n  .chapter-name {font-size:calc(var(--u) * 1.1);line-height:1.25;}\n  .btn span {max-width:100%;flex-wrap:wrap;justify-content:center;}\n  .card-title,.card-desc,.modal-title {overflow-wrap:anywhere;}\n  .ov {overflow-y:auto;justify-content:safe center;}\n  .rar-legend span {width:auto;min-width:calc(var(--u) * 1.6);}\n  html[lang=en] .side-btn,html[lang=ja] .side-btn {width:calc(var(--u) * 3.6);font-size:calc(var(--u) * 0.62);}\n  html[lang=en] .mode-banner b {font-size:calc(var(--u) * 1.7);letter-spacing:0;}\n  .mode-banner span {max-width:92%;text-align:center;}\n  .chest-btns {flex-wrap:wrap;justify-content:center;}\n  .panel-title {flex-wrap:wrap;}\n  .task {flex-wrap:wrap;}\n  @media (orientation:landscape) and (max-height:600px) {\n    .home {display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,0.8fr);grid-template-rows:22px 65px 1fr;gap:8px;min-height:100%;height:100%;padding:4px 12px;}\n    .home>.game-title {grid-column:1/-1;grid-row:1;}\n    .home>.chapter-card {grid-column:2;grid-row:2;}\n    .home>.scene-wrap {grid-column:1;grid-row:2/4;min-height:0;}\n    .home>.miles {grid-column:2;grid-row:3;align-self:start;height:85px;padding:3px 20px 22px;}\n    .home>.start-wrap {grid-column:2;grid-row:3;align-self:end;}\n    .start-btn {min-width:180px;font-size:20px;padding:4px 18px;}\n    .start-btn .cost {font-size:12px;}\n    .home .finger {right:4px;bottom:0;}\n    .miles-label {margin-bottom:18px;font-size:12px;}\n    .quote {font-size:11px;}\n    .side {gap:4px;}\n    .side-btn {min-height:48px;font-size:11px;}\n    .side-btn .ico {width:24px!important;height:24px!important;}\n    .resbar {min-height:52px;padding-top:4px;padding-bottom:4px;}\n    .tabbar {height:56px;min-height:56px;}\n    .tab .ico {width:22px!important;height:22px!important;}\n    .tab.on {transform:none;}\n    .chapter-name {font-size:16px;}\n    .chapter-sub {font-size:12px;}\n    .ov {justify-content:flex-start;}\n  }\n  .roster-cell b {text-align:center;}\n", He = [
		"普通",
		"稀有",
		"史诗",
		"传说",
		"神话"
	], Ue = [
		"绿色",
		"蓝色",
		"紫色",
		"橙色",
		"红色"
	], E = [
		"#47d16c",
		"#3ba4ff",
		"#b35cff",
		"#ffae1a",
		"#ff4b4b"
	], We = [
		"#1f7a3a",
		"#1a5aa8",
		"#6325a8",
		"#b36b00",
		"#a81f1f"
	], Ge = [
		{
			id: "dart",
			name: "抗体飞弹",
			rarity: 0,
			tag: "远程·追踪",
			desc: "自动瞄准最近的病毒发射抗体弹。",
			awakenName: "分裂抗体",
			awakenDesc: "命中后分裂出2枚小抗体继续攻击。",
			base: {
				dmg: 1,
				cd: .5,
				count: 1,
				pierce: 0,
				speed: 900,
				area: 0
			},
			ups: [
				"dmg",
				"rate",
				"speed",
				"pierce",
				"count",
				"awaken"
			],
			caps: {
				count: 7,
				pierce: 6
			},
			unlock: "start",
			countLabel: "弹数",
			rateLabel: "射速",
			areaLabel: ""
		},
		{
			id: "needle",
			name: "穿刺针剂",
			rarity: 0,
			tag: "远程·穿透",
			desc: "阵地战中垂直向上发射，天生穿透2个目标。",
			awakenName: "无限贯穿",
			awakenDesc: "针剂可无限穿透，伤害+60%。",
			base: {
				dmg: 1.5,
				cd: 1,
				count: 1,
				pierce: 2,
				speed: 1150,
				area: 0
			},
			ups: [
				"dmg",
				"rate",
				"speed",
				"pierce",
				"count",
				"awaken"
			],
			caps: {
				count: 6,
				pierce: 12
			},
			unlock: "start",
			countLabel: "针数",
			rateLabel: "射速",
			areaLabel: ""
		},
		{
			id: "orbit",
			name: "环绕胶囊",
			rarity: 1,
			tag: "近战·环绕",
			desc: "胶囊环绕英雄旋转，持续撞击靠近的病毒。",
			awakenName: "胶囊风暴",
			awakenDesc: "胶囊+2，旋转半径周期性大幅扩张。",
			base: {
				dmg: .9,
				cd: .3,
				count: 2,
				pierce: 0,
				speed: 0,
				area: 120
			},
			ups: [
				"dmg",
				"rate",
				"count",
				"area",
				"awaken"
			],
			caps: { count: 8 },
			unlock: "start",
			countLabel: "胶囊数",
			rateLabel: "转速",
			areaLabel: "半径"
		},
		{
			id: "spray",
			name: "消毒喷雾",
			rarity: 1,
			tag: "近战·范围",
			desc: "向前方扇形持续喷洒，伤害范围内所有病毒。",
			awakenName: "强效消毒",
			awakenDesc: "射程+50%，喷射角度更大，并使病毒减速。",
			base: {
				dmg: .42,
				cd: .12,
				count: 1,
				pierce: 0,
				speed: 0,
				area: 250
			},
			ups: [
				"dmg",
				"rate",
				"area",
				"awaken"
			],
			caps: {},
			unlock: "start",
			countLabel: "",
			rateLabel: "频率",
			areaLabel: "射程"
		},
		{
			id: "boomerang",
			name: "创可贴回旋镖",
			rarity: 1,
			tag: "远程·往返",
			desc: "飞出后折返，往返路径上的病毒都会受伤。",
			awakenName: "三重回旋",
			awakenDesc: "回旋镖+2，体积与伤害大幅提升。",
			base: {
				dmg: 1.3,
				cd: 1.5,
				count: 1,
				pierce: 999,
				speed: 720,
				area: 470
			},
			ups: [
				"dmg",
				"rate",
				"speed",
				"count",
				"area",
				"awaken"
			],
			caps: { count: 6 },
			unlock: "start",
			countLabel: "数量",
			rateLabel: "投掷速度",
			areaLabel: "射程"
		},
		{
			id: "chain",
			name: "高烧电弧",
			rarity: 2,
			tag: "连锁·弹射",
			desc: "释放电弧，在病毒之间连续跳跃。",
			awakenName: "雷暴",
			awakenDesc: "跳跃次数+3，每次命中有概率再次落雷。",
			base: {
				dmg: 1.5,
				cd: 1,
				count: 3,
				pierce: 0,
				speed: 0,
				area: 180
			},
			ups: [
				"dmg",
				"rate",
				"count",
				"area",
				"awaken"
			],
			caps: { count: 14 },
			unlock: 1,
			countLabel: "跳跃",
			rateLabel: "施放速度",
			areaLabel: "跳跃距离"
		},
		{
			id: "bomb",
			name: "泡腾炸弹",
			rarity: 2,
			tag: "范围·爆炸",
			desc: "投掷泡腾弹，落地爆炸造成范围伤害。",
			awakenName: "持续泡腾",
			awakenDesc: "爆炸后留下泡腾区域，持续灼烧病毒。",
			base: {
				dmg: 2.6,
				cd: 1.7,
				count: 1,
				pierce: 0,
				speed: 0,
				area: 90
			},
			ups: [
				"dmg",
				"rate",
				"count",
				"area",
				"awaken"
			],
			caps: { count: 6 },
			unlock: 2,
			countLabel: "数量",
			rateLabel: "投掷速度",
			areaLabel: "爆炸范围"
		},
		{
			id: "frost",
			name: "冷冻针",
			rarity: 2,
			tag: "远程·减速",
			desc: "命中后使整条病毒链减速，最多叠加3层。",
			awakenName: "绝对零度",
			awakenDesc: "每隔一段时间冻结病毒链1.5秒。",
			base: {
				dmg: 1.2,
				cd: .85,
				count: 1,
				pierce: 1,
				speed: 820,
				area: 0
			},
			ups: [
				"dmg",
				"rate",
				"speed",
				"pierce",
				"count",
				"awaken"
			],
			caps: {
				count: 5,
				pierce: 6
			},
			unlock: 3,
			countLabel: "针数",
			rateLabel: "射速",
			areaLabel: ""
		},
		{
			id: "pulse",
			name: "声波脉冲",
			rarity: 3,
			tag: "近战·冲击",
			desc: "以英雄为中心释放扩散声波，伤害沿途所有病毒。",
			awakenName: "双重共振",
			awakenDesc: "声波范围+50%，并连续释放两道。",
			base: {
				dmg: 2.4,
				cd: 2,
				count: 1,
				pierce: 0,
				speed: 0,
				area: 270
			},
			ups: [
				"dmg",
				"rate",
				"area",
				"awaken"
			],
			caps: {},
			unlock: 4,
			countLabel: "",
			rateLabel: "释放速度",
			areaLabel: "范围"
		},
		{
			id: "homing",
			name: "追踪抗体",
			rarity: 3,
			tag: "远程·追踪爆炸",
			desc: "发射会自动追踪的抗体导弹，命中小范围爆炸。",
			awakenName: "饱和打击",
			awakenDesc: "导弹+3，爆炸范围大幅提升。",
			base: {
				dmg: 1.9,
				cd: 1.2,
				count: 2,
				pierce: 0,
				speed: 500,
				area: 45
			},
			ups: [
				"dmg",
				"rate",
				"speed",
				"count",
				"area",
				"awaken"
			],
			caps: { count: 10 },
			unlock: 5,
			countLabel: "导弹数",
			rateLabel: "射速",
			areaLabel: "爆炸范围"
		},
		{
			id: "beam",
			name: "紫外光束",
			rarity: 3,
			tag: "直线·持续",
			desc: "发射持续的紫外光束，灼烧直线上所有病毒。",
			awakenName: "广谱照射",
			awakenDesc: "光束更宽，持续时间+50%。",
			base: {
				dmg: .5,
				cd: 3,
				count: 1,
				pierce: 999,
				speed: 0,
				area: 28
			},
			ups: [
				"dmg",
				"rate",
				"count",
				"area",
				"awaken"
			],
			caps: { count: 4 },
			unlock: 6,
			countLabel: "光束数",
			rateLabel: "充能速度",
			areaLabel: "宽度"
		},
		{
			id: "saber",
			name: "抗生素光剑",
			rarity: 4,
			tag: "近战·斩击",
			desc: "向前方挥出巨大的扇形斩击，造成海量伤害。",
			awakenName: "回旋斩",
			awakenDesc: "同时向前后斩击，范围+30%。",
			base: {
				dmg: 6.5,
				cd: 2.4,
				count: 1,
				pierce: 999,
				speed: 0,
				area: 310
			},
			ups: [
				"dmg",
				"rate",
				"area",
				"awaken"
			],
			caps: {},
			unlock: 8,
			countLabel: "",
			rateLabel: "挥砍速度",
			areaLabel: "范围"
		}
	], D = Object.fromEntries(Ge.map((e) => [e.id, e]));
	function Ke(e) {
		return 1 + .12 * (e - 1);
	}
	function qe(e, t) {
		let n = [
			6,
			5,
			4,
			3,
			2
		][e];
		return Math.round(n * (1 + (t - 1) * .6));
	}
	function Je(e, t) {
		return Math.round((80 + e * 60) * 1.22 ** (t - 1));
	}
	var Ye = 8, Xe = {
		dmg: [
			.2,
			.35,
			.55,
			.85,
			1.3
		],
		rate: [
			.1,
			.16,
			.24,
			.35,
			.5
		],
		speed: [
			.15,
			.25,
			.4,
			.6,
			.85
		],
		pierce: [
			1,
			1,
			2,
			2,
			3
		],
		count: [
			1,
			1,
			1,
			2,
			2
		],
		area: [
			.12,
			.2,
			.3,
			.45,
			.6
		]
	}, Ze = [
		{
			id: "allDmg",
			name: "全面强化",
			values: [
				.08,
				.12,
				.18,
				.26,
				.36
			],
			text: (e) => `所有武器伤害 +${Math.round(e * 100)}%`,
			minRarity: 0
		},
		{
			id: "crit",
			name: "精准打击",
			values: [
				.03,
				.05,
				.08,
				.12,
				.16
			],
			text: (e) => `暴击率 +${Math.round(e * 100)}%`,
			minRarity: 0
		},
		{
			id: "critDmg",
			name: "致命要害",
			values: [
				.2,
				.3,
				.45,
				.65,
				.9
			],
			text: (e) => `暴击伤害 +${Math.round(e * 100)}%`,
			minRarity: 0
		},
		{
			id: "allRate",
			name: "肾上腺素",
			values: [
				.05,
				.08,
				.12,
				.16,
				.22
			],
			text: (e) => `所有武器攻速 +${Math.round(e * 100)}%`,
			minRarity: 1
		},
		{
			id: "slow",
			name: "病毒迟缓",
			values: [
				.03,
				.05,
				.07,
				.1,
				.12
			],
			text: (e) => `病毒移动速度 -${Math.round(e * 100)}%`,
			minRarity: 1
		},
		{
			id: "knock",
			name: "紧急击退",
			values: [
				220,
				330,
				480,
				680,
				950
			],
			text: (e) => `立即将病毒击退 ${Math.round(e)} 距离`,
			minRarity: 0
		}
	], Qe = Object.fromEntries(Ze.map((e) => [e.id, e])), $e = [
		46,
		31,
		16,
		6,
		1
	], et = { count: 1 }, tt = 4, O = [
		[
			"熬夜病毒",
			265,
			"“再刷五分钟就睡。”——凌晨三点"
		],
		[
			"拖延症病毒",
			200,
			"“明天再说吧。”"
		],
		[
			"手机上瘾病毒",
			190,
			"解锁手机，只为了看一眼时间。"
		],
		[
			"脱发病毒",
			30,
			"发际线正在战略性撤退。"
		],
		[
			"社恐病毒",
			320,
			"电话响了，假装不在家。"
		],
		[
			"暴食病毒",
			10,
			"“吃饱了才有力气减肥。”"
		],
		[
			"内卷病毒",
			290,
			"别人卷，你也不得不卷。"
		],
		[
			"选择困难病毒",
			150,
			"中午吃什么？这是个哲学问题。"
		],
		[
			"起床困难病毒",
			45,
			"闹钟响了八次，被窝赢了八次。"
		],
		[
			"摸鱼病毒",
			175,
			"看起来在工作，其实在摸鱼。"
		],
		[
			"健忘病毒",
			225,
			"我进这个房间是要干嘛来着？"
		],
		[
			"躺平病毒",
			340,
			"终极病毒：什么都不想干。"
		]
	].map(([e, t, n], r) => ({
		id: r + 1,
		name: e,
		hue: t,
		quote: n,
		rec: Math.round(100 * 1.36 ** r / 10) * 10,
		segs: Math.min(104, 60 + r * 4)
	})), nt = [
		.55,
		.68,
		.95,
		1.05,
		1.12,
		1.2,
		1.3,
		1.4,
		1.5,
		1.6,
		1.7,
		1.8
	], rt = [
		{
			name: "普通",
			hp: 1,
			reward: 1,
			rec: 1
		},
		{
			name: "困难",
			hp: 2.4,
			reward: 2,
			rec: 2.2
		},
		{
			name: "噩梦",
			hp: 6,
			reward: 3.5,
			rec: 5
		}
	], it = [
		{
			id: "amian",
			name: "阿免",
			title: "见习免疫卫士",
			rarity: 1,
			weapon: "dart",
			bonus: { atkPct: .05 },
			bonusText: "攻击力 +5%",
			body: "#5fe3c0",
			accent: "#3a7bff",
			deco: "cape"
		},
		{
			id: "vita",
			name: "橙小维",
			title: "维C爆破手",
			rarity: 2,
			weapon: "bomb",
			bonus: {
				atkPct: .08,
				area: .15
			},
			bonusText: "攻击力 +8%，范围 +15%",
			body: "#ffab3d",
			accent: "#3fbf4f",
			deco: "leaf"
		},
		{
			id: "volt",
			name: "雷小伏",
			title: "高烧电工",
			rarity: 2,
			weapon: "chain",
			bonus: {
				crit: .08,
				critDmg: .2
			},
			bonusText: "暴击率 +8%，暴击伤害 +20%",
			body: "#b27bff",
			accent: "#ffe14a",
			deco: "bolt"
		},
		{
			id: "frosty",
			name: "冰小凝",
			title: "冷敷专家",
			rarity: 3,
			weapon: "frost",
			bonus: {
				slow: .1,
				rate: .08
			},
			bonusText: "病毒减速 10%，攻速 +8%",
			body: "#8fdcff",
			accent: "#ffffff",
			deco: "snow"
		},
		{
			id: "lumen",
			name: "光小剑",
			title: "紫外线骑士",
			rarity: 4,
			weapon: "beam",
			bonus: {
				atkPct: .18,
				luck: .05
			},
			bonusText: "攻击力 +18%，高品质词条概率 +5%",
			body: "#ffe066",
			accent: "#ff4f6a",
			deco: "visor"
		}
	], k = Object.fromEntries(it.map((e) => [e.id, e])), at = .06, ot = 5, st = [
		{
			id: "cup",
			name: "保温杯",
			rarity: 0,
			set: "health",
			per: { atkPct: .03 },
			flavor: "人到中年不得已，保温杯里泡枸杞。"
		},
		{
			id: "goji",
			name: "一包枸杞",
			rarity: 0,
			set: "health",
			per: { crit: .006 },
			flavor: "养生从娃娃抓起。"
		},
		{
			id: "tub",
			name: "泡脚桶",
			rarity: 1,
			set: "health",
			per: {
				wDmg: ["orbit", .1],
				critDmg: .02
			},
			flavor: "泡完脚，环绕胶囊都转得更快了。"
		},
		{
			id: "mask",
			name: "蒸汽眼罩",
			rarity: 0,
			set: "night",
			per: { rate: .012 },
			flavor: "闭眼五分钟，攻速提升百分之一。"
		},
		{
			id: "coffee",
			name: "速溶咖啡",
			rarity: 1,
			set: "night",
			per: { wDmg: ["dart", .1] },
			start: {
				weapon: "dart",
				count: 1
			},
			flavor: "三合一，开局多一发抗体。"
		},
		{
			id: "glasses",
			name: "防蓝光眼镜",
			rarity: 2,
			set: "night",
			per: {
				wDmg: ["beam", .14],
				critDmg: .03
			},
			flavor: "专业对付紫外线和蓝光。"
		},
		{
			id: "belt",
			name: "护腰",
			rarity: 1,
			set: "worker",
			per: { critDmg: .05 },
			flavor: "久坐一族的最后防线。"
		},
		{
			id: "pillow",
			name: "U型颈枕",
			rarity: 0,
			set: "worker",
			per: { atkPct: .025 },
			flavor: "在哪都能睡，在哪都能战。"
		},
		{
			id: "keyboard",
			name: "机械键盘",
			rarity: 2,
			set: "worker",
			per: { wDmg: ["needle", .12] },
			start: {
				weapon: "needle",
				pierce: 1
			},
			flavor: "青轴的声音，就是针剂的穿透力。"
		},
		{
			id: "clover",
			name: "四叶草",
			rarity: 3,
			set: "luck",
			per: {
				luck: .015,
				atkPct: .02
			},
			flavor: "据说能刷出更好的词条。"
		},
		{
			id: "koi",
			name: "锦鲤贴纸",
			rarity: 2,
			set: "luck",
			per: { reward: .05 },
			flavor: "转发这条锦鲤，战斗奖励翻倍（并不会）。"
		},
		{
			id: "rope",
			name: "转运红绳",
			rarity: 3,
			set: "luck",
			per: {
				knock: .05,
				atkPct: .03
			},
			flavor: "复活时击退更远。"
		}
	], ct = Object.fromEntries(st.map((e) => [e.id, e])), lt = [
		{
			id: "health",
			name: "养生三件套",
			bonus: { atkPct: .12 },
			text: "攻击力 +12%"
		},
		{
			id: "night",
			name: "熬夜冠军",
			bonus: { rate: .1 },
			text: "攻速 +10%"
		},
		{
			id: "worker",
			name: "打工人套装",
			bonus: { critDmg: .35 },
			text: "暴击伤害 +35%"
		},
		{
			id: "luck",
			name: "欧皇附体",
			bonus: {
				luck: .06,
				reward: .1
			},
			text: "高品质词条概率 +6%，奖励 +10%"
		}
	], ut = 10;
	function dt(e) {
		return e <= 0 ? 1 : e + 1;
	}
	var ft = {
		luck: {
			id: "luck",
			name: "欧气满满",
			text: "高品质词条出现概率 +5%"
		},
		refresh: {
			id: "refresh",
			name: "再来一次",
			text: "每个宝箱额外 1 次免费刷新"
		},
		treasure: {
			id: "treasure",
			name: "寻宝达人",
			text: "战斗奖励 +10%"
		},
		startChest: {
			id: "startChest",
			name: "开局补给",
			text: "战斗开始时获得 1 个银色宝箱"
		},
		tough: {
			id: "tough",
			name: "绝地反击",
			text: "复活时击退距离 +15%"
		}
	}, pt = [
		[3, "refresh"],
		[6, "startChest"],
		[10, "luck"],
		[14, "treasure"],
		[18, "tough"],
		[23, "luck"],
		[28, "startChest"],
		[34, "treasure"],
		[40, "refresh"],
		[47, "luck"],
		[55, "tough"],
		[63, "treasure"],
		[72, "startChest"],
		[82, "luck"],
		[95, "treasure"]
	], mt = 20, ht = 2, gt = .05, _t = .008, vt = .03, yt = 1.5, bt = .012, xt = .75, St = 1.2;
	function Ct(e) {
		return Math.round(50 * 1.115 ** (e - 1) + e * 10);
	}
	var wt = 30, Tt = 300, Et = 43200;
	function A(e) {
		return y(e);
	}
	function Dt(e, t = 0) {
		let n = 10 ** t;
		return `${Math.round(e * 100 * n) / n}%`;
	}
	function Ot(e) {
		e = Math.max(0, Math.floor(e));
		let t = Math.floor(e / 3600), n = Math.floor(e % 3600 / 60), r = e % 60, i = (e) => String(e).padStart(2, "0");
		return t > 0 ? `${i(t)}:${i(n)}:${i(r)}` : `${i(n)}:${i(r)}`;
	}
	function kt(e) {
		let t = new Date(e);
		return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
	}
	var At = 1, jt = (e, t) => `${e}-${t}`;
	function Mt(e) {
		return {
			day: kt(e),
			battles: 0,
			chests: 0,
			heroUps: 0,
			idleClaims: 0,
			claimed: 0,
			staminaBuys: 0,
			freeChest: !1,
			freeGold: !1,
			signed: !1,
			purpleBox: 0
		};
	}
	function Nt(e) {
		let t = {};
		for (let e of Ge) e.unlock === "start" && (t[e.id] = { lv: 1 });
		return {
			version: At,
			gold: 300,
			gems: 150,
			stamina: wt,
			staminaAt: e,
			keyGold: 1,
			keySilver: 3,
			frags: [
				10,
				0,
				0,
				0,
				0
			],
			pts: {
				atk: 0,
				crit: 0,
				rate: 0
			},
			heroes: { amian: { stars: 0 } },
			hero: "amian",
			pity: 0,
			weapons: t,
			loadout: Ge.filter((e) => e.unlock === "start").map((e) => e.id),
			relics: {},
			chapter: 1,
			diff: 0,
			best: {},
			miles: {},
			fails: {},
			cleared: 0,
			clearedDiff: [
				0,
				0,
				0
			],
			idleAt: e,
			idlePts: 0,
			signCount: 0,
			daily: Mt(e),
			lvRewarded: 1,
			settings: {
				sfx: !0,
				music: !0
			},
			stats: {
				battles: 0,
				wins: 0,
				kills: 0,
				chests: 0
			},
			tut: {
				battle: !1,
				chest: !1,
				hero: !1,
				focus: !1
			},
			seen: e
		};
	}
	function Pt(e, t) {
		if (!e || typeof e != "object") return null;
		let n = e;
		if (typeof n.version != "number" || n.version > At) return null;
		let r = Nt(t), i = {
			...r,
			...n
		};
		i.pts = {
			...r.pts,
			...n.pts ?? {}
		}, i.settings = {
			...r.settings,
			...n.settings ?? {}
		}, i.stats = {
			...r.stats,
			...n.stats ?? {}
		}, i.tut = {
			...r.tut,
			...n.tut ?? {}
		}, i.daily = {
			...Mt(t),
			...n.daily ?? {}
		}, (!Array.isArray(i.frags) || i.frags.length !== 5) && (i.frags = r.frags), (!Array.isArray(i.clearedDiff) || i.clearedDiff.length !== 3) && (i.clearedDiff = [
			i.cleared || 0,
			0,
			0
		]), (!i.heroes || !i.heroes[i.hero]) && (i.heroes = {
			...i.heroes || {},
			amian: { stars: 0 }
		}), k[i.hero] || (i.hero = "amian"), i.loadout = (i.loadout || []).filter((e) => D[e] && i.weapons[e]).slice(0, Ye), i.loadout.length === 0 && (i.loadout = ["dart"]);
		for (let e of [
			"gold",
			"gems",
			"stamina",
			"keyGold",
			"keySilver"
		]) (typeof i[e] != "number" || !isFinite(i[e])) && (i[e] = r[e]);
		return i.version = At, i;
	}
	function Ft(e, t) {
		if (t < e.seen - 6e4 && (e.staminaAt = t, e.idleAt = Math.min(e.idleAt, t)), e.seen = Math.max(e.seen, t), e.stamina >= wt) e.staminaAt = t;
		else {
			let n = Math.floor((t - e.staminaAt) / (Tt * 1e3));
			n > 0 && (e.stamina = Math.min(wt, e.stamina + n), e.staminaAt = e.stamina >= wt ? t : e.staminaAt + n * Tt * 1e3);
		}
		let n = kt(t);
		e.daily.day !== n && (e.daily = Mt(t));
	}
	function It(e, t) {
		return e.stamina >= wt ? 0 : Math.max(0, Tt - (t - e.staminaAt) / 1e3);
	}
	function Lt(e, t) {
		if (e.gold += Math.round(t.gold ?? 0), e.gems += Math.round(t.gems ?? 0), e.stamina += Math.round(t.stamina ?? 0), e.keyGold += t.keyGold ?? 0, e.keySilver += t.keySilver ?? 0, t.frags) for (let [n, r] of Object.entries(t.frags)) e.frags[Number(n)] += Math.round(r ?? 0);
		t.weapon && Rt(e, t.weapon), t.relic && zt(e, t.relic);
	}
	function Rt(e, t) {
		return !e.weapons[t] && (e.weapons[t] = { lv: 1 }, e.loadout.length < Ye && e.loadout.push(t), !0);
	}
	function zt(e, t) {
		var n;
		let r = (n = e.relics)[t] ?? (n[t] = {
			lv: 0,
			shards: 0
		});
		r.lv === 0 ? r.lv = 1 : r.shards += 1;
	}
	function Bt(e) {
		let t = {};
		for (let n of e) {
			for (let e of [
				"gold",
				"gems",
				"stamina",
				"keyGold",
				"keySilver"
			]) n[e] && (t[e] = (t[e] ?? 0) + n[e]);
			if (n.frags) {
				t.frags ??= {};
				for (let [e, r] of Object.entries(n.frags)) {
					let n = Number(e);
					t.frags[n] = (t.frags[n] ?? 0) + (r ?? 0);
				}
			}
			n.weapon && (t.weapon = n.weapon), n.relic && (t.relic = n.relic), n.hero && (t.hero = n.hero);
		}
		return t;
	}
	function Vt(e, t, n) {
		let r = rt[t].reward, i = Math.round(90 * 1.3 ** (e - 1) * r);
		if (n === 0) return {
			gold: i,
			frags: { 0: 6 + e }
		};
		if (n === 1) return {
			gold: i * 2,
			stamina: 6,
			gems: 30
		};
		let a = {
			gems: Math.round(100 * r),
			frags: {
				0: 10 + e * 2,
				1: 5 + e
			}
		};
		return e >= 3 && (a.frags[2] = Math.floor(e / 2) * r), (e % 2 == 0 || t > 0) && (a.keyGold = 1), a.keySilver = 2, a;
	}
	function Ht(e, t, n, r, i, a) {
		let o = rt[t].reward * i, s = Math.max(0, Math.min(1, n)), c = Math.round((90 + 130 * 1.3 ** (e - 1)) * (.25 + s) * o * (r ? 1.5 : 1)), l = {}, u = Math.round((3 + e * .8) * (.3 + s) * o);
		l[0] = Math.max(1, Math.round(u * .7)), l[1] = Math.round(u * .3 * (.5 + a.next())), e >= 3 && r && (l[2] = Math.max(0, Math.round((e - 2) * .5 * o * a.next() + .3))), e >= 6 && r && a.chance(.3 + t * .2) && (l[3] = 1);
		let d = {
			gold: c,
			frags: l
		};
		return r && (d.gems = Math.round(10 + e * 2)), d;
	}
	function Ut(e, t) {
		return Math.max(0, Math.min(Et, (t - e.idleAt) / 1e3));
	}
	function Wt(e) {
		return 1 + e.pts.atk + e.pts.crit + e.pts.rate;
	}
	function Gt(e) {
		let t = Wt(e), n = {
			luck: 0,
			refresh: 0,
			treasure: 0,
			startChest: 0,
			tough: 0
		};
		for (let [e, r] of pt) t >= e && (n[r] += 1);
		return n;
	}
	function Kt(e) {
		if (e % 5 != 0) return null;
		let t = e / 5;
		return t % 4 == 0 ? {
			keyGold: 1,
			gems: 50
		} : t % 4 == 2 ? {
			keySilver: 2,
			gems: 30
		} : t % 4 == 1 ? {
			gems: 60,
			frags: {
				0: 8,
				1: 3
			}
		} : {
			gems: 40,
			frags: {
				1: 5,
				2: 1
			}
		};
	}
	function qt(e, t) {
		let n = Ct(Wt(e));
		if (e.gold < n) return { ok: !1 };
		e.gold -= n, e.pts[t] += 1, e.daily.heroUps += 1;
		let r = Wt(e), i = null;
		if (r > e.lvRewarded) {
			let t = [];
			for (let n = e.lvRewarded + 1; n <= r; n++) {
				let e = Kt(n);
				e && t.push(e);
			}
			e.lvRewarded = r, t.length && (i = Bt(t), Lt(e, i));
		}
		return {
			ok: !0,
			reward: i
		};
	}
	function Jt(e, t) {
		let n = e.weapons[t];
		if (!n) return !1;
		let r = D[t];
		return e.frags[r.rarity] >= qe(r.rarity, n.lv) && e.gold >= Je(r.rarity, n.lv);
	}
	function Yt(e, t) {
		if (!Jt(e, t)) return !1;
		let n = e.weapons[t], r = D[t];
		return e.frags[r.rarity] -= qe(r.rarity, n.lv), e.gold -= Je(r.rarity, n.lv), n.lv += 1, !0;
	}
	function Xt(e, t) {
		if (!e.weapons[t]) return "locked";
		let n = e.loadout.indexOf(t);
		return n >= 0 ? e.loadout.length <= 1 ? "last" : (e.loadout.splice(n, 1), "off") : e.loadout.length >= Ye ? "full" : (e.loadout.push(t), "on");
	}
	function Zt(e, t) {
		let n = e.relics[t];
		return !!n && n.lv > 0 && n.lv < ut && n.shards >= dt(n.lv);
	}
	function Qt(e, t) {
		if (!Zt(e, t)) return !1;
		let n = e.relics[t];
		return n.shards -= dt(n.lv), n.lv += 1, !0;
	}
	var $t = [
		50,
		30,
		15,
		5,
		0
	];
	function en(e, t, n) {
		if (e.keySilver < t) return null;
		e.keySilver -= t;
		let r = [];
		for (let i = 0; i < t; i++) {
			let t = n.weighted($t), i = st.filter((e) => e.rarity === t), a = n.pick(i.length ? i : st);
			zt(e, a.id), r.push(a.id);
		}
		return r;
	}
	var tn = {
		amian: 30,
		vita: 30,
		volt: 30,
		frosty: 14,
		lumen: 5
	};
	function nn(e, t) {
		if (e.keyGold < 1) return null;
		if (--e.keyGold, e.pity += 1, e.pity >= 6 || t.chance(.22)) {
			e.pity = 0;
			let n = it.map((e) => e.id), r = t.weighted(n.map((e) => tn[e] ?? 10)), i = n[Math.max(0, r)], a = e.heroes[i];
			if (!a) return e.heroes[i] = { stars: 0 }, {
				hero: i,
				dup: !1
			};
			if (a.stars < ot) return a.stars += 1, {
				hero: i,
				dup: !0
			};
			let o = { gems: 200 };
			return Lt(e, o), {
				hero: i,
				dup: !0,
				reward: o
			};
		}
		let n = t.int(4), r = Math.max(1, e.cleared), i = n === 0 ? { gold: 400 + r * 150 } : n === 1 ? { frags: {
			1: 6 + r,
			2: 1 + Math.floor(r / 3)
		} } : n === 2 ? { gems: 60 } : { keySilver: 2 };
		return Lt(e, i), { reward: i };
	}
	var j = {
		staminaGems: 50,
		staminaAmount: 15,
		staminaBuysPerDay: 5,
		blueBoxGems: 30,
		purpleBoxGems: 200,
		purpleBoxPerDay: 3,
		silverKeyGems: 90,
		goldKeyGems: 280,
		goldPacks: [
			{
				gems: 50,
				mult: 1
			},
			{
				gems: 220,
				mult: 5
			},
			{
				gems: 600,
				mult: 15
			}
		]
	};
	function rn(e, t) {
		return Math.round((500 + e.cleared * 250) * t);
	}
	function an(e) {
		return e.gems < j.staminaGems || e.daily.staminaBuys >= j.staminaBuysPerDay ? !1 : (e.gems -= j.staminaGems, e.stamina += j.staminaAmount, e.daily.staminaBuys += 1, !0);
	}
	function on(e, t) {
		return Ge.filter((n) => !e.weapons[n.id] && n.rarity <= t && n.rarity < 4).map((e) => e.id);
	}
	function sn(e, t, n) {
		let r = Math.max(1, e.cleared);
		if (t === "free") {
			if (e.daily.freeChest) return null;
			e.daily.freeChest = !0;
			let t = {
				frags: {
					0: 6 + r,
					1: 2 + Math.floor(r / 2)
				},
				gold: 100 + r * 40
			};
			return Lt(e, t), t;
		}
		if (t === "blue") {
			if (e.gems < j.blueBoxGems) return null;
			e.gems -= j.blueBoxGems;
			let t = { frags: {
				0: 8 + n.int(6),
				1: 3 + n.int(4)
			} }, r = on(e, 1);
			return r.length && n.chance(.08) && (t.weapon = n.pick(r)), Lt(e, t), t;
		}
		if (e.gems < j.purpleBoxGems || e.daily.purpleBox >= j.purpleBoxPerDay) return null;
		e.gems -= j.purpleBoxGems, e.daily.purpleBox += 1;
		let i = { frags: {
			1: 10 + n.int(6),
			2: 4 + n.int(4),
			3: n.chance(.4) ? 2 : 1
		} }, a = on(e, 3);
		return a.length && n.chance(.25) && (i.weapon = n.pick(a)), Lt(e, i), i;
	}
	function cn(e, t) {
		let n = j.goldPacks[t];
		if (!n || e.gems < n.gems) return 0;
		e.gems -= n.gems;
		let r = rn(e, n.mult);
		return e.gold += r, r;
	}
	function ln(e, t) {
		let n = t === "gold" ? j.goldKeyGems : j.silverKeyGems;
		return e.gems < n ? !1 : (e.gems -= n, t === "gold" ? e.keyGold += 1 : e.keySilver += 1, !0);
	}
	var un = [
		{
			id: 0,
			name: "完成 3 场战斗",
			goal: 3,
			value: (e) => e.daily.battles,
			reward: { gems: 50 }
		},
		{
			id: 1,
			name: "开启 10 个局内宝箱",
			goal: 10,
			value: (e) => e.daily.chests,
			reward: { gems: 40 }
		},
		{
			id: 2,
			name: "英雄升级 3 次",
			goal: 3,
			value: (e) => e.daily.heroUps,
			reward: { gold: 800 }
		},
		{
			id: 3,
			name: "领取 1 次挂机奖励",
			goal: 1,
			value: (e) => e.daily.idleClaims,
			reward: {
				gems: 30,
				stamina: 5
			}
		}
	];
	function dn(e) {
		let t = 0;
		for (let n of un) !(e.daily.claimed & 1 << n.id) && n.value(e) >= n.goal && t++;
		return un.every((t) => e.daily.claimed & 1 << t.id) && !(e.daily.claimed & 16) && t++, t;
	}
	function fn(e, t, n) {
		return t < 1 || t > O.length ? !1 : n === 0 ? t <= e.cleared + 1 : e.clearedDiff[n - 1] >= t && t <= e.clearedDiff[n] + 1;
	}
	function pn(e, t) {
		return Ft(e, t), !0;
	}
	function mn(e, t, n, r, i, a) {
		let o = jt(t, n), s = Math.floor(r.progress * 100), c = s > (e.best[o] ?? 0);
		c && (e.best[o] = s), e.stats.battles += 1, e.stats.kills += r.kills, e.stats.chests += r.chests, e.daily.battles += 1;
		let l = Ht(t, n, r.progress, r.won, i, a), u = !1, d;
		if (r.won) {
			if (e.stats.wins += 1, e.fails[o] = 0, e.clearedDiff[n] < t && (e.clearedDiff[n] = t, u = !0, l.gems = (l.gems ?? 0) + 50 * (n + 1), n === 0)) {
				e.cleared = t;
				let n = Ge.find((n) => n.unlock === t && !e.weapons[n.id]);
				n && (l.weapon = n.id, d = n.id);
			}
		} else e.fails[o] = (e.fails[o] ?? 0) + 1;
		return Lt(e, l), {
			reward: l,
			firstClear: u,
			newBest: c,
			unlockedWeapon: d
		};
	}
	function hn(e, t, n, r) {
		let i = jt(t, n), a = [
			25,
			50,
			100
		][r], o = 1 << r;
		if ((e.best[i] ?? 0) < a || (e.miles[i] ?? 0) & o) return null;
		e.miles[i] = (e.miles[i] ?? 0) | o;
		let s = Vt(t, n, r);
		return Lt(e, s), s;
	}
	function gn(e) {
		let t = 0;
		for (let [n, r] of Object.entries(e.best)) {
			let i = e.miles[n] ?? 0;
			r >= 25 && !(i & 1) && t++, r >= 50 && !(i & 2) && t++, r >= 100 && !(i & 4) && t++;
		}
		return t;
	}
	var _n, vn = null, M = null, yn = () => ({ t: "none" }), bn = () => 1, xn = !1;
	function Sn(e) {
		return _n = te(e ?? void 0, Pt, Nt, () => {
			fa.value++;
		}), vn = _n.battle, _n.meta;
	}
	function Cn(e) {
		xn = !0, _n.write(e, re(M, yn(), bn()));
	}
	function wn(e) {
		Cn(e);
	}
	async function Tn() {
		let e = await _n.reset();
		return e || X("重置失败，请稍后再试"), e;
	}
	function En() {
		(xn || M) && Cn(q());
	}
	var Dn = [], N = null, On = null, kn = null, P = null, An = null, jn = !0, Mn = !0, Nn = {}, Pn = {
		shoot: .07,
		hit: .05,
		pop: .045,
		bigpop: .08,
		zap: .08,
		boom: .07,
		chest: .1,
		pulse: .1,
		slash: .1
	};
	function Fn() {
		if (N) {
			N.state === "suspended" && N.resume();
			return;
		}
		let e = window.AudioContext || window.webkitAudioContext;
		if (!e) return;
		try {
			N = new e();
		} catch {
			N = null;
			return;
		}
		On = N.createGain(), On.gain.value = .8, On.connect(N.destination), kn = N.createGain(), kn.gain.value = jn ? .55 : 0, kn.connect(On), P = N.createGain(), P.gain.value = Mn ? .22 : 0, P.connect(On), An = N.createBuffer(1, N.sampleRate * .5, N.sampleRate);
		let t = An.getChannelData(0);
		for (let e = 0; e < t.length; e++) t[e] = Math.random() * 2 - 1;
		qn && tr(qn), zn();
	}
	var In = /* @__PURE__ */ new Map(), Ln = !1, Rn = {
		shoot: .35,
		hit: .35,
		pop: .7,
		click: .6,
		warn: .7
	};
	async function zn() {
		if (Ln || !N || !Dn.length) return;
		Ln = !0;
		let e = N;
		if (await Promise.all(Dn.map(async (t) => {
			try {
				let n = await fetch(`assets/audio/${t}.mp3`);
				if (!n.ok) return;
				In.set(t, await e.decodeAudioData(await n.arrayBuffer()));
			} catch {}
		})), Jn) {
			let e = Jn;
			Jn = null, tr(e);
		}
	}
	function Bn(e, t, n = 1) {
		if (!N || !kn) return;
		let r = N.createBufferSource();
		r.buffer = e, r.playbackRate.value = n;
		let i = N.createGain();
		i.gain.value = t, r.connect(i), i.connect(kn), r.start();
	}
	var Vn = null, Hn = null;
	function Un() {
		if (!N || !Vn || !Hn) return;
		let e = Vn;
		Hn.gain.setTargetAtTime(0, N.currentTime, .25), setTimeout(() => {
			try {
				e.stop();
			} catch {}
		}, 1200), Vn = null, Hn = null;
	}
	function Wn(e) {
		if (!N || !P) return;
		Un();
		let t = N.createBufferSource();
		t.buffer = e, t.loop = !0;
		let n = e.getChannelData(0), r = 0, i = n.length - 1;
		for (; r < n.length && Math.abs(n[r]) < .004;) r++;
		for (; i > r && Math.abs(n[i]) < .004;) i--;
		t.loopStart = r / e.sampleRate, t.loopEnd = Math.max(t.loopStart + 1, i / e.sampleRate);
		let a = N.createGain();
		a.gain.setValueAtTime(0, N.currentTime), a.gain.linearRampToValueAtTime(2.2, N.currentTime + 1.2), t.connect(a), a.connect(P), t.start(0, t.loopStart), Vn = t, Hn = a;
	}
	function Gn(e, t) {
		jn = e, Mn = t, N && kn && P && (kn.gain.setTargetAtTime(e ? .55 : 0, N.currentTime, .05), P.gain.setTargetAtTime(t ? .22 : 0, N.currentTime, .1));
	}
	function F(e, t, n, r, i = {}) {
		if (!N) return;
		let a = N.currentTime + (i.delay ?? 0), o = N.createOscillator(), s = N.createGain();
		o.type = n, o.frequency.setValueAtTime(e, a), i.slide && o.frequency.exponentialRampToValueAtTime(Math.max(20, i.slide), a + t);
		let c = i.attack ?? .005;
		s.gain.setValueAtTime(1e-4, a), s.gain.linearRampToValueAtTime(r, a + c), s.gain.exponentialRampToValueAtTime(1e-4, a + t), o.connect(s), s.connect(i.bus ?? kn), o.start(a), o.stop(a + t + .02);
	}
	function Kn(e, t, n, r = {}) {
		if (!N || !An) return;
		let i = N.currentTime + (r.delay ?? 0), a = N.createBufferSource();
		a.buffer = An;
		let o = N.createBiquadFilter();
		o.type = r.type ?? "bandpass", o.frequency.value = n, o.Q.value = r.q ?? 1;
		let s = N.createGain();
		s.gain.setValueAtTime(t, i), s.gain.exponentialRampToValueAtTime(1e-4, i + e), a.connect(o), o.connect(s), s.connect(r.bus ?? kn), a.start(i), a.stop(i + e + .02);
	}
	function I(e) {
		if (!N || !jn) return;
		let t = N.currentTime, n = Pn[e] ?? .03;
		if (t - (Nn[e] ?? -1) < n) return;
		Nn[e] = t;
		let r = In.get(e);
		if (r) {
			Bn(r, Rn[e] ?? .85, 1 + (Math.random() - .5) * .08);
			return;
		}
		let i = 1 + (Math.random() - .5) * .1;
		switch (e) {
			case "shoot":
				F(880 * i, .06, "square", .05, { slide: 440 });
				break;
			case "hit":
				F(300 * i, .04, "triangle", .08, { slide: 150 });
				break;
			case "pop":
				F(520 * i, .09, "sine", .22, { slide: 140 }), Kn(.06, .08, 1800, { q: .8 });
				break;
			case "bigpop":
				F(320 * i, .18, "sine", .3, { slide: 70 }), Kn(.14, .14, 900, { q: .7 });
				break;
			case "chest":
				[
					1047,
					1319,
					1568
				].forEach((e, t) => F(e, .16, "triangle", .16, { delay: t * .05 }));
				break;
			case "zap":
				Kn(.12, .16, 3500, { q: 2 }), F(1400 * i, .1, "sawtooth", .04, { slide: 300 });
				break;
			case "boom":
				Kn(.28, .28, 400, {
					q: .6,
					type: "lowpass"
				}), F(140, .25, "sine", .25, { slide: 45 });
				break;
			case "slash":
				Kn(.2, .2, 2600, {
					q: .6,
					type: "highpass"
				}), F(600, .18, "sawtooth", .05, { slide: 1500 });
				break;
			case "pulse":
				F(220, .3, "sine", .2, { slide: 90 }), F(440, .25, "triangle", .06, { slide: 180 });
				break;
			case "freeze":
				[
					1760,
					2093,
					2637,
					3136
				].forEach((e, t) => F(e, .25, "sine", .06, { delay: t * .04 })), Kn(.4, .06, 6e3, { q: 3 });
				break;
			case "knock":
				F(180, .35, "sine", .3, { slide: 60 }), Kn(.35, .18, 700, { q: .5 });
				break;
			case "click":
				F(1200, .04, "square", .05);
				break;
			case "open":
				[
					523,
					659,
					784,
					1047
				].forEach((e, t) => F(e, .2, "triangle", .14, { delay: t * .06 }));
				break;
			case "pick":
				F(784, .1, "square", .08), F(1175, .2, "square", .08, { delay: .08 });
				break;
			case "coin":
				F(1319, .06, "square", .06), F(1760, .16, "square", .06, { delay: .06 });
				break;
			case "up":
				[
					659,
					880,
					1109,
					1319
				].forEach((e, t) => F(e, .14, "triangle", .12, { delay: t * .045 }));
				break;
			case "win":
				[
					523,
					659,
					784,
					1047,
					784,
					1047,
					1319
				].forEach((e, t) => F(e, t === 6 ? .6 : .16, "square", .08, { delay: t * .12 }));
				break;
			case "lose":
				[
					392,
					349,
					311,
					262
				].forEach((e, t) => F(e, t === 3 ? .6 : .22, "triangle", .14, { delay: t * .2 }));
				break;
			case "warn":
				F(880, .12, "square", .05), F(660, .12, "square", .05, { delay: .14 });
				break;
			case "revive": [
				392,
				523,
				659,
				784,
				1047
			].forEach((e, t) => F(e, .2, "triangle", .14, { delay: t * .06 })), Kn(.5, .1, 1200, { q: .5 });
		}
	}
	var qn = null, Jn = null, Yn = null, Xn = 0, Zn = 0, Qn = (e) => 220 * 2 ** (e / 12), $n = {
		menu: {
			bpm: 104,
			bass: [
				-12,
				-99,
				-5,
				-99,
				-9,
				-99,
				-5,
				-99,
				-14,
				-99,
				-7,
				-99,
				-12,
				-99,
				-7,
				-99
			],
			lead: [
				12,
				-99,
				15,
				17,
				19,
				-99,
				17,
				15,
				12,
				-99,
				10,
				12,
				15,
				-99,
				-99,
				-99,
				12,
				-99,
				15,
				17,
				22,
				-99,
				19,
				17,
				15,
				-99,
				12,
				10,
				12,
				-99,
				-99,
				-99
			],
			drums: "k.h.s.h.k.h.s.hh"
		},
		battle: {
			bpm: 138,
			bass: [
				-12,
				-12,
				-99,
				-12,
				-5,
				-99,
				-7,
				-99,
				-9,
				-9,
				-99,
				-9,
				-7,
				-99,
				-5,
				-99
			],
			lead: [
				12,
				15,
				17,
				15,
				19,
				17,
				15,
				12,
				10,
				12,
				15,
				12,
				17,
				15,
				12,
				10,
				12,
				15,
				17,
				19,
				22,
				19,
				17,
				15,
				17,
				15,
				12,
				15,
				10,
				12,
				-99,
				-99
			],
			drums: "k.hsk.hsk.hsk.hs"
		}
	};
	function er(e) {
		if (!N || !Jn || !P) return;
		let t = $n[Jn], n = Zn, r = t.bass[n % t.bass.length], i = t.lead[n % t.lead.length], a = 60 / t.bpm / 2, o = t.drums[n % t.drums.length], s = e - N.currentTime;
		r > -99 && F(Qn(r), a * 1.6, "triangle", .5, {
			delay: s,
			bus: P
		}), i > -99 && F(Qn(i), a * .9, "square", .12, {
			delay: s,
			bus: P,
			attack: .01
		}), o === "k" && F(110, .14, "sine", .6, {
			delay: s,
			slide: 40,
			bus: P
		}), o === "s" && Kn(.12, .25, 1800, {
			delay: s,
			q: .7,
			bus: P
		}), o === "h" && Kn(.04, .12, 8e3, {
			delay: s,
			q: 1,
			type: "highpass",
			bus: P
		}), Zn++;
	}
	function tr(e) {
		if (qn = e, !N) return;
		let t = In.get(`bgm_${e}`);
		if (t) {
			if (Jn === e && Vn) return;
			Jn = e, Yn !== null && window.clearInterval(Yn), Yn = null, Wn(t);
			return;
		}
		Jn === e && Yn !== null || (Un(), Jn = e, Zn = 0, Xn = N.currentTime + .1, Yn !== null && window.clearInterval(Yn), Yn = window.setInterval(() => {
			if (!N || !Jn) return;
			let e = 60 / $n[Jn].bpm / 2;
			for (; Xn < N.currentTime + .25;) er(Xn), Xn += e;
		}, 60));
	}
	function nr(e) {
		N && (e ? N.suspend() : N.resume());
	}
	var rr, L, ir, ar, or = 0, sr = [], R = o, cr = R.__b, lr = R.__r, ur = R.diffed, dr = R.__c, fr = R.unmount, pr = R.__;
	function mr(e, t) {
		R.__h && R.__h(L, e, or || t), or = 0;
		var n = L.__H || (L.__H = {
			__: [],
			__h: []
		});
		return e >= n.__.length && n.__.push({}), n.__[e];
	}
	function hr(e) {
		return or = 1, gr(Er, e);
	}
	function gr(e, t, n) {
		var r = mr(rr++, 2);
		if (r.t = e, !r.__c && (r.__ = [n ? n(t) : Er(void 0, t), function(e) {
			var t = r.__N ? r.__N[0] : r.__[0], n = r.t(t, e);
			t !== n && (r.__N = [n, r.__[1]], r.__c.setState({}));
		}], r.__c = L, !L.__f)) {
			var i = function(e, t, n) {
				if (!r.__c.__H) return !0;
				var i = !1, o = r.__c.props !== e;
				if (r.__c.__H.__.some(function(e) {
					if (e.__N) {
						i = !0;
						var t = e.__[0];
						e.__ = e.__N, e.__N = void 0, t !== e.__[0] && (o = !0);
					}
				}), a) {
					var s = a.call(this, e, t, n);
					return i ? s || o : s;
				}
				return !i || o;
			};
			L.__f = !0;
			var a = L.shouldComponentUpdate, o = L.componentWillUpdate;
			L.componentWillUpdate = function(e, t, n) {
				if (this.__e) {
					var r = a;
					a = void 0, i(e, t, n), a = r;
				}
				o && o.call(this, e, t, n);
			}, L.shouldComponentUpdate = i;
		}
		return r.__N || r.__;
	}
	function _r(e, t) {
		var n = mr(rr++, 3);
		!R.__s && Tr(n.__H, t) && (n.__ = e, n.u = t, L.__H.__h.push(n));
	}
	function vr(e) {
		return or = 5, yr(function() {
			return { current: e };
		}, []);
	}
	function yr(e, t) {
		var n = mr(rr++, 7);
		return Tr(n.__H, t) && (n.__ = e(), n.__H = t, n.__h = e), n.__;
	}
	function br() {
		for (var e; e = sr.shift();) {
			var t = e.__H;
			if (e.__P && t) try {
				t.__h.some(Cr), t.__h.some(wr), t.__h = [];
			} catch (n) {
				t.__h = [], R.__e(n, e.__v);
			}
		}
	}
	R.__b = function(e) {
		L = null, cr && cr(e);
	}, R.__ = function(e, t) {
		e && t.__k && t.__k.__m && (e.__m = t.__k.__m), pr && pr(e, t);
	}, R.__r = function(e) {
		lr && lr(e), rr = 0;
		var t = (L = e.__c).__H;
		t && (ir === L ? (t.__h = [], L.__h = [], t.__.some(function(e) {
			e.__N && (e.__ = e.__N), e.u = e.__N = void 0;
		})) : (t.__h.some(Cr), t.__h.some(wr), t.__h = [], rr = 0)), ir = L;
	}, R.diffed = function(e) {
		ur && ur(e);
		var t = e.__c;
		t && t.__H && (t.__H.__h.length && (sr.push(t) !== 1 && ar === R.requestAnimationFrame || ((ar = R.requestAnimationFrame) || Sr)(br)), t.__H.__.some(function(e) {
			e.u &&= (e.__H = e.u, void 0);
		})), ir = L = null;
	}, R.__c = function(e, t) {
		t.some(function(e) {
			try {
				e.__h.some(Cr), e.__h = e.__h.filter(function(e) {
					return !e.__ || wr(e);
				});
			} catch (n) {
				t.some(function(e) {
					e.__h &&= [];
				}), t = [], R.__e(n, e.__v);
			}
		}), dr && dr(e, t);
	}, R.unmount = function(e) {
		fr && fr(e);
		var t, n = e.__c;
		n && n.__H && (n.__H.__.some(function(e) {
			try {
				Cr(e);
			} catch (e) {
				t = e;
			}
		}), n.__H = void 0, t && R.__e(t, n.__v));
	};
	var xr = typeof requestAnimationFrame == "function";
	function Sr(e) {
		var t, n = function() {
			clearTimeout(r), xr && cancelAnimationFrame(t), setTimeout(e);
		}, r = setTimeout(n, 35);
		xr && (t = requestAnimationFrame(n));
	}
	function Cr(e) {
		var t = L, n = e.__c;
		typeof n == "function" && (e.__c = void 0, n()), L = t;
	}
	function wr(e) {
		var t = L;
		e.__c = e.__(), L = t;
	}
	function Tr(e, t) {
		return !e || e.length !== t.length || t.some(function(t, n) {
			return t !== e[n];
		});
	}
	function Er(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	var Dr = class {
		constructor(e) {
			i(this, "s"), this.s = e >>> 0 || 2654435769;
		}
		next() {
			let e = this.s = this.s + 1831565813 >>> 0;
			return e = Math.imul(e ^ e >>> 15, e | 1), e ^= e + Math.imul(e ^ e >>> 7, e | 61), ((e ^ e >>> 14) >>> 0) / 4294967296;
		}
		range(e, t) {
			return e + (t - e) * this.next();
		}
		int(e) {
			return Math.floor(this.next() * e);
		}
		chance(e) {
			return this.next() < e;
		}
		pick(e) {
			return e[this.int(e.length)];
		}
		weighted(e) {
			let t = 0;
			for (let n of e) t += Math.max(0, n);
			if (t <= 0) return -1;
			let n = this.next() * t;
			for (let t = 0; t < e.length; t++) if (n -= Math.max(0, e[t]), n < 0) return t;
			return e.length - 1;
		}
		shuffle(e) {
			for (let t = e.length - 1; t > 0; t--) {
				let n = this.int(t + 1);
				[e[t], e[n]] = [e[n], e[t]];
			}
			return e;
		}
	};
	function Or(e, t, n, r) {
		t.atkPct && (r.v += t.atkPct * n), t.crit && (e.crit += t.crit * n), t.critDmg && (e.critDmg += t.critDmg * n), t.rate && (e.rate += t.rate * n), t.luck && (e.luck += t.luck * n), t.reward && (e.reward += t.reward * n), t.knock && (e.knock += t.knock * n), t.wDmg && (e.wDmg[t.wDmg[0]] = (e.wDmg[t.wDmg[0]] ?? 0) + t.wDmg[1] * n);
	}
	function kr(e) {
		var t, n;
		let r = k[e.hero] ?? k.amian, i = e.heroes[e.hero]?.stars ?? 0, a = Gt(e), o = {
			atk: 0,
			crit: gt + e.pts.crit * _t,
			critDmg: yt + e.pts.crit * vt,
			rate: e.pts.rate * bt,
			luck: a.luck * .05,
			reward: a.treasure * .1,
			knock: a.tough * .15,
			slow: 0,
			area: 0,
			freeRefresh: 1 + a.refresh,
			startChests: a.startChest,
			wDmg: {},
			wStart: {},
			wLevel: {}
		}, s = { v: i * at }, c = r.bonus;
		s.v += c.atkPct ?? 0, o.crit += c.crit ?? 0, o.critDmg += c.critDmg ?? 0, o.rate += c.rate ?? 0, o.slow += c.slow ?? 0, o.luck += c.luck ?? 0, o.area += c.area ?? 0;
		let l = {};
		for (let [r, i] of Object.entries(e.relics)) {
			let e = ct[r];
			if (!(!e || i.lv <= 0) && (Or(o, e.per, i.lv, s), l[e.set] = (l[e.set] ?? 0) + 1, e.start)) {
				let r = (t = o.wStart)[n = e.start.weapon] ?? (t[n] = {
					count: 0,
					pierce: 0
				});
				r.count += e.start.count ?? 0, r.pierce += e.start.pierce ?? 0;
			}
		}
		for (let e of lt) (l[e.id] ?? 0) >= 3 && Or(o, e.bonus, 1, s);
		o.atk = (mt + e.pts.atk * ht) * (1 + s.v), o.crit = Math.min(xt, o.crit), o.rate = Math.min(St, o.rate);
		for (let [t, n] of Object.entries(e.weapons)) n && (o.wLevel[t] = n.lv);
		return o;
	}
	function Ar(e, t) {
		let n = k[e.hero] ?? k.amian, r = /* @__PURE__ */ new Set([...e.loadout, n.weapon]), i = 0, a = 0;
		for (let e of r) {
			let n = t.wLevel[e] ?? 1, r = 1 + D[e].rarity * .08;
			i += Ke(n) * r * (1 + (t.wDmg[e] ?? 0)), a++;
		}
		return a ? i / a : 1;
	}
	function jr(e, t = kr(e)) {
		let n = 1 + t.crit * (t.critDmg - 1), r = t.atk * n * (1 + t.rate) * Ar(e, t) * (1 + t.luck * .5) * 5;
		return Math.round(r * .94);
	}
	function Mr(e, t) {
		let n = O[e - 1] ?? O[O.length - 1];
		return Math.round(n.rec * rt[t].rec / 10) * 10;
	}
	function Nr(e, t, n = 0) {
		let r = Math.max(0, Math.min(.6, t)), i = [
			$e[0] * Math.max(.15, 1 - r * 2.2),
			$e[1],
			$e[2] * (1 + r * 4),
			$e[3] * (1 + r * 7),
			$e[4] * (1 + r * 10)
		];
		for (let e = 0; e < n; e++) i[e] = 0;
		return Math.max(n, e.weighted(i));
	}
	function Pr(e, t) {
		let n = D[t.id];
		return n.ups.filter((e) => e === "awaken" ? !t.awakened && t.ups >= tt : !(e === "count" && n.caps.count !== void 0 && t.count >= n.caps.count || e === "pierce" && n.caps.pierce !== void 0 && t.pierce >= n.caps.pierce || e === "pierce" && t.id === "needle" && t.awakened));
	}
	function Fr(e, t, n) {
		if (t === "awaken") return {
			t: "up",
			weapon: e,
			stat: t,
			rarity: 4,
			value: 1
		};
		let r = Math.max(n, et[t] ?? 0);
		return {
			t: "up",
			weapon: e,
			stat: t,
			rarity: r,
			value: Xe[t][r]
		};
	}
	function Ir(e, t) {
		let n = Qe[e], r = Math.max(t, n.minRarity);
		return {
			t: "glob",
			stat: e,
			rarity: r,
			value: n.values[r]
		};
	}
	var Lr = (e) => e.t === "glob" ? `g:${e.stat}` : e.t === "new" ? `n:${e.weapon}` : `u:${e.weapon}:${e.stat}`;
	function Rr(e, t, n = 0, r = 3) {
		let i = [], a = /* @__PURE__ */ new Set(), o = e.owned.filter((t) => Pr(e, t).includes("awaken"));
		if (o.length && t.chance(.4 + e.luck)) {
			let e = Fr(t.pick(o).id, "awaken", 4);
			i.push(e), a.add(Lr(e));
		}
		let s = 0;
		for (; i.length < r && s++ < 60;) {
			let r, o = Nr(t, e.luck, n);
			if (e.owned.length && t.chance(.72)) {
				let n = t.weighted(e.owned.map((e) => 1 + Math.min(4, e.ups) * .25)), i = e.owned[Math.max(0, n)], a = Pr(e, i).filter((e) => e !== "awaken");
				if (!a.length) continue;
				r = Fr(i.id, t.pick(a), o);
			} else {
				let e = Ze[t.weighted(Ze.map((e) => e.id === "knock" ? .6 : e.id === "slow" ? .7 : 1))];
				r = Ir(e.id, o);
			}
			let s = Lr(r);
			a.has(s) || (a.add(s), i.push(r));
		}
		return i;
	}
	function zr(e, t, n = 3) {
		let r = new Set(e.owned.map((e) => e.id)), i = e.loadout.filter((e) => !r.has(e));
		t.shuffle(i);
		let a = i.slice(0, n).map((e) => ({
			t: "new",
			weapon: e,
			rarity: D[e].rarity
		}));
		if (a.length < n) {
			let r = Rr(e, t, 2, n - a.length + 1).slice(0, n - a.length);
			a.push(...r);
		}
		return a;
	}
	function Br(e) {
		if (e.t === "new") {
			let t = D[e.weapon];
			return {
				title: t.name,
				desc: t.desc,
				badge: "新武器",
				icon: e.weapon
			};
		}
		if (e.t === "glob") {
			let t = Qe[e.stat];
			return {
				title: t.name,
				desc: t.text(e.value),
				badge: "全局",
				icon: e.stat
			};
		}
		let t = D[e.weapon], n = (e) => `+${Math.round(e * 100)}%`;
		switch (e.stat) {
			case "awaken": return {
				title: t.awakenName,
				desc: t.awakenDesc,
				badge: "觉醒",
				icon: e.weapon
			};
			case "dmg": return {
				title: `${t.name}`,
				desc: `伤害 ${n(e.value)}`,
				badge: "伤害",
				icon: e.weapon
			};
			case "rate": return {
				title: `${t.name}`,
				desc: `${t.rateLabel} ${n(e.value)}`,
				badge: t.rateLabel,
				icon: e.weapon
			};
			case "speed": return {
				title: `${t.name}`,
				desc: `飞行速度 ${n(e.value)}`,
				badge: "弹速",
				icon: e.weapon
			};
			case "pierce": return {
				title: `${t.name}`,
				desc: `穿透 +${e.value}`,
				badge: "穿透",
				icon: e.weapon
			};
			case "count": return {
				title: `${t.name}`,
				desc: `${t.countLabel} +${e.value}`,
				badge: t.countLabel,
				icon: e.weapon
			};
			case "area": return {
				title: `${t.name}`,
				desc: `${t.areaLabel} ${n(e.value)}`,
				badge: t.areaLabel,
				icon: e.weapon
			};
		}
	}
	var Vr = class {
		constructor(e, t = 2) {
			i(this, "xs"), i(this, "ys"), i(this, "step"), i(this, "length"), i(this, "n"), i(this, "sx"), i(this, "sy"), i(this, "ex"), i(this, "ey");
			let n = [0];
			for (let t = 1; t < e.length; t++) n.push(n[t - 1] + Math.hypot(e[t].x - e[t - 1].x, e[t].y - e[t - 1].y));
			let r = n[n.length - 1], a = Math.max(2, Math.ceil(r / t) + 1);
			this.xs = new Float32Array(a), this.ys = new Float32Array(a);
			let o = 0;
			for (let i = 0; i < a; i++) {
				let a = Math.min(r, i * t);
				for (; o < n.length - 2 && n[o + 1] < a;) o++;
				let s = n[o + 1] - n[o] || 1, c = (a - n[o]) / s;
				this.xs[i] = e[o].x + (e[o + 1].x - e[o].x) * c, this.ys[i] = e[o].y + (e[o + 1].y - e[o].y) * c;
			}
			this.step = t, this.length = (a - 1) * t, this.n = a;
			let s = Math.min(a - 1, 4), c = Math.hypot(this.xs[s] - this.xs[0], this.ys[s] - this.ys[0]) || 1;
			this.sx = (this.xs[s] - this.xs[0]) / c, this.sy = (this.ys[s] - this.ys[0]) / c;
			let l = Math.max(0, a - 5), u = Math.hypot(this.xs[a - 1] - this.xs[l], this.ys[a - 1] - this.ys[l]) || 1;
			this.ex = (this.xs[a - 1] - this.xs[l]) / u, this.ey = (this.ys[a - 1] - this.ys[l]) / u;
		}
		at(e, t = {
			x: 0,
			y: 0
		}) {
			if (e <= 0) return t.x = this.xs[0] + this.sx * e, t.y = this.ys[0] + this.sy * e, t;
			if (e >= this.length) {
				let n = e - this.length;
				return t.x = this.xs[this.n - 1] + this.ex * n, t.y = this.ys[this.n - 1] + this.ey * n, t;
			}
			let n = e / this.step, r = Math.floor(n), i = n - r;
			return t.x = this.xs[r] + (this.xs[r + 1] - this.xs[r]) * i, t.y = this.ys[r] + (this.ys[r + 1] - this.ys[r]) * i, t;
		}
		angle(e) {
			if (e <= 0) return Math.atan2(this.sy, this.sx);
			if (e >= this.length) return Math.atan2(this.ey, this.ex);
			let t = Math.min(this.n - 2, Math.floor(e / this.step)), n = Math.min(this.n - 1, t + 3), r = Math.max(0, t - 2);
			return Math.atan2(this.ys[n] - this.ys[r], this.xs[n] - this.xs[r]);
		}
	}, Hr = 132;
	function Ur(e, t, n, r, i, a, o = 6) {
		let s = Math.max(2, Math.ceil(Math.abs(a - i) * r / o));
		for (let o = 1; o <= s; o++) {
			let c = i + (a - i) * o / s;
			e.push({
				x: t + Math.cos(c) * r,
				y: n + Math.sin(c) * r
			});
		}
	}
	function Wr(e, t) {
		let n = t - 215, r = n - 78, i = (n - 215 - 250) / 7, a = [{
			x: -40,
			y: 250
		}], o = 1;
		for (let t = 0; t < 8; t++) {
			let n = 250 + t * i, r = t === 7, s = r ? e / 2 + (o > 0 ? -i / 2 : i / 2) : o > 0 ? e - 66 : 66;
			if (a.push({
				x: s,
				y: n
			}), r) {
				let e = s, t = n + i / 2;
				o > 0 ? Ur(a, e, t, i / 2, -Math.PI / 2, 0) : Ur(a, e, t, i / 2, -Math.PI / 2, -Math.PI);
			} else {
				let e = s, t = n + i / 2;
				o > 0 ? Ur(a, e, t, i / 2, -Math.PI / 2, Math.PI / 2) : Ur(a, e, t, i / 2, -Math.PI / 2, -Math.PI * 1.5), o = -o;
			}
		}
		a.push({
			x: e / 2,
			y: n - 34
		});
		let s = new Vr(a), c = s.length / Hr;
		return {
			mode: "line",
			W: e,
			H: t,
			path: s,
			hero: {
				x: e / 2,
				y: n
			},
			lineY: r,
			cx: e / 2,
			cy: n,
			spacing: c,
			radius: c * .5
		};
	}
	function Gr(e, t) {
		let n = e / 2, r = Math.round(t * .5), i = e / 2 - 38, a = Math.max(1, Math.min(1.55, (r - 250) / i)), o = [{
			x: n,
			y: -60
		}], s = -Math.PI / 2, c = Math.PI * 2 * 3.25;
		for (let e = 0; e <= 900; e++) {
			let t = e / 900, l = s + c * t, u = i - (i - 92) * t;
			o.push({
				x: n + Math.cos(l) * u,
				y: r + Math.sin(l) * u * (a - (a - 1) * t)
			});
		}
		let l = o[o.length - 1], u = Math.atan2(r - l.y, n - l.x);
		o.push({
			x: n - Math.cos(u) * 34,
			y: r - Math.sin(u) * 34
		});
		let d = new Vr(o), f = d.length / Hr;
		return {
			mode: "ring",
			W: e,
			H: t,
			path: d,
			hero: {
				x: n,
				y: r
			},
			lineY: r,
			cx: n,
			cy: r,
			spacing: f,
			radius: f * .5
		};
	}
	var Kr = globalThis.process?.env ?? {}, qr = Number(Kr.HP_K ?? 1.4), Jr = Number(Kr.LINE_HP ?? .85), Yr = Number(Kr.TRAV ?? 105), Xr = 3.2, Zr = .24, Qr = .34, $r = 20, ei = 60, ti = 2, ni = 3, ri = [
		0,
		40,
		80
	], ii = 3, ai = class {
		constructor(e) {
			i(this, "setup"), i(this, "layout"), i(this, "rng"), i(this, "stats"), i(this, "total"), i(this, "segs", []), i(this, "weapons", []), i(this, "projs", []), i(this, "lobs", []), i(this, "zones", []), i(this, "pulses", []), i(this, "slashes", []), i(this, "fx", []), i(this, "sfx", []), i(this, "fxOn", !0), i(this, "state", "play"), i(this, "paused", !1), i(this, "time", 0), i(this, "killed", 0), i(this, "chests", {
				gold: 0,
				silver: 0
			}), i(this, "chestsOpened", 0), i(this, "revives", 0), i(this, "takeAllUsed", 0), i(this, "focus", null), i(this, "run", {
				allDmg: 0,
				crit: 0,
				critDmg: 0,
				allRate: 0,
				slow: 0
			}), i(this, "frost", []), i(this, "freezeT", 0), i(this, "heroKick", 0), i(this, "damageDealt", 0), i(this, "bestProgress", 0), i(this, "entering", !0), i(this, "baseSpeed"), i(this, "tmp", {
				x: 0,
				y: 0
			}), this.setup = e, this.stats = e.stats, this.rng = new Dr(e.seed), this.layout = e.mode === "line" ? Wr(e.W, e.H) : Gr(e.W, e.H), this.baseSpeed = this.layout.path.length / Yr, this.buildChain(), this.total = this.segs.length;
			let t = k[e.hero] ?? k.amian;
			this.addWeapon(t.weapon), this.chests.silver += this.stats.startChests;
		}
		buildChain() {
			let { chapter: e, diff: t, fails: n } = this.setup, r = O[e - 1] ?? O[0], i = this.setup.tutorial ? 56 : r.segs, a = 1 - Math.min(.175, n * .035), o = nt[e - 1] ?? nt[nt.length - 1], s = this.setup.mode === "line" ? Jr : 1, c = qr * r.rec * o * s * rt[t].hp * a * (this.setup.tutorial ? .55 : 1), l = (26 + e * 1.5) ** (1 / (i - 1)), u = new Set([
				.09,
				.3,
				.52,
				.74
			].map((e) => Math.round(e * (i - 1)))), d = this.layout.spacing;
			for (let e = 0; e < i; e++) {
				let t = 0;
				u.has(e) ? t = 2 : e >= 4 && e % 7 == 4 && e < i - 2 && (t = 1);
				let n = Math.round(c * l ** +e * (t === 2 ? 1.6 : t === 1 ? 1.3 : 1) * (.94 + .12 * this.rng.next()));
				this.segs.push({
					id: e + 1,
					idx: e,
					d: -e * d,
					x: 0,
					y: 0,
					hp: n,
					maxHp: n,
					kind: t,
					alive: !0,
					flash: 0
				});
			}
			this.placeSegs();
		}
		makeWeapon(e) {
			let t = D[e], n = this.stats.wLevel[e] ?? 1, r = this.stats.wStart[e];
			return {
				id: e,
				base: this.stats.atk * t.base.dmg * Ke(n) * (1 + (this.stats.wDmg[e] ?? 0)),
				dmgPct: 0,
				ratePct: 0,
				speedPct: 0,
				areaPct: 0,
				count: t.base.count + (r?.count ?? 0),
				pierce: t.base.pierce + (r?.pierce ?? 0),
				awakened: !1,
				ups: 0,
				timer: .2 + this.rng.next() * .3,
				phase: this.rng.next() * Math.PI * 2,
				beamT: 0,
				beamAng: [],
				aux: 0,
				hitCd: /* @__PURE__ */ new Map(),
				dealt: 0
			};
		}
		addWeapon(e) {
			this.weapons.some((t) => t.id === e) || this.weapons.push(this.makeWeapon(e));
		}
		dmgOf(e) {
			let t = 1 + e.dmgPct + this.run.allDmg;
			return e.awakened && (t *= e.id === "needle" ? 1.6 : e.id === "boomerang" ? 1.35 : 1.25), e.base * t;
		}
		cdOf(e) {
			return D[e.id].base.cd / ((1 + e.ratePct) * (1 + this.stats.rate + this.run.allRate));
		}
		speedOf(e) {
			return D[e.id].base.speed * (1 + e.speedPct);
		}
		areaOf(e) {
			let t = D[e.id].base.area * (1 + e.areaPct + this.stats.area);
			return e.awakened && (e.id === "spray" || e.id === "pulse") && (t *= 1.5), e.awakened && e.id === "saber" && (t *= 1.3), e.awakened && e.id === "homing" && (t *= 1.8), e.awakened && e.id === "beam" && (t *= 1.9), t;
		}
		get progress() {
			return this.total ? this.killed / this.total : 0;
		}
		get front() {
			return this.segs[0] ?? null;
		}
		get danger() {
			let e = this.front;
			return e ? Math.max(0, this.layout.path.length - e.d) : this.layout.path.length;
		}
		get speedMul() {
			if (this.freezeT > 0) return 0;
			let e = this.frost.length * .08;
			return Math.max(.35, 1 - this.run.slow - this.stats.slow - e);
		}
		step(e) {
			if (!(this.state !== "play" || this.paused) && (this.time += e, this.heroKick = Math.max(0, this.heroKick - e * 6), this.moveChain(e), this.state === "play")) {
				for (let t of this.weapons) this.updateWeapon(t, e);
				this.updateProjs(e), this.updateLobs(e), this.updateZones(e), this.updatePulses(e);
				for (let t = this.slashes.length - 1; t >= 0; t--) this.slashes[t].t -= e, this.slashes[t].t <= 0 && this.slashes.splice(t, 1);
				for (let t of this.segs) t.flash > 0 && (t.flash -= e);
				this.cleanup(), this.segs.length === 0 && this.state === "play" && (this.state = "won", this.bestProgress = 1);
			}
		}
		moveChain(e) {
			let t = this.segs, n = t.length;
			if (!n) return;
			this.freezeT > 0 && (this.freezeT -= e);
			for (let e = this.frost.length - 1; e >= 0; e--) this.frost[e] <= this.time && this.frost.splice(e, 1);
			let r = this.layout.path.length, i = this.layout.spacing, a = this.baseSpeed * this.speedMul;
			this.entering && (t[0].d < r * Zr ? a *= Xr : this.entering = !1), t[n - 1].d += a * e;
			for (let e = n - 2; e >= 0; e--) {
				let n = t[e + 1].d + i;
				t[e].d < n && (t[e].d = n);
			}
			this.placeSegs(), t[0].d >= r && (this.state = "dead", this.bestProgress = Math.max(this.bestProgress, this.progress));
		}
		placeSegs() {
			let e = this.layout.path;
			for (let t of this.segs) e.at(t.d, this.tmp), t.x = this.tmp.x, t.y = this.tmp.y;
		}
		cleanup() {
			this.segs.some((e) => !e.alive) && (this.segs = this.segs.filter((e) => e.alive)), this.focus && !this.focus.alive && (this.focus = null);
		}
		targetable(e) {
			let { W: t, H: n } = this.layout;
			return e.alive && e.d > 0 && e.x > -10 && e.x < t + 10 && e.y > 60 && e.y < n + 10;
		}
		pickTarget() {
			if (this.focus && this.targetable(this.focus)) return this.focus;
			for (let e of this.segs) if (this.targetable(e)) return e;
			return null;
		}
		nearest(e, t, n, r) {
			let i = null, a = n * n;
			for (let n of this.segs) {
				if (!this.targetable(n) || r && r.has(n.id)) continue;
				let o = n.x - e, s = n.y - t, c = o * o + s * s;
				c < a && (a = c, i = n);
			}
			return i;
		}
		segAt(e, t) {
			let n = null, r = (this.layout.radius * 1.9) ** 2;
			for (let i of this.segs) {
				if (!this.targetable(i)) continue;
				let a = (i.x - e) ** 2 + (i.y - t) ** 2;
				a < r && (r = a, n = i);
			}
			return n;
		}
		setFocus(e) {
			this.focus = e && e !== this.focus ? e : null;
		}
		damage(e, t, n, r = e.x, i = e.y) {
			if (!e.alive) return;
			let a = this.stats.crit + this.run.crit, o = this.rng.next() < a, s = o ? t * (this.stats.critDmg + this.run.critDmg) : t, c = Math.min(e.hp, s);
			e.hp -= s, e.flash = .07, n.dealt += c, this.damageDealt += c, this.fxOn && this.fx.push({
				t: "hit",
				x: r,
				y: i,
				dmg: s,
				crit: o,
				kind: n.id
			}), e.hp <= 0 && this.kill(e);
		}
		kill(e) {
			if (e.alive && (e.alive = !1, this.killed += 1, e.kind === 2 ? this.chests.gold += 1 : e.kind === 1 && (this.chests.silver += 1), this.fxOn)) {
				let t = e === this.segs[0] || e.kind > 0;
				this.fx.push({
					t: "kill",
					x: e.x,
					y: e.y,
					r: this.layout.radius,
					kind: e.kind,
					big: t
				}), e.kind && this.fx.push({
					t: "chest",
					x: e.x,
					y: e.y,
					kind: e.kind
				}), this.sfx.push(e.kind ? "chest" : t ? "bigpop" : "pop");
			}
		}
		aoe(e, t, n, r, i) {
			let a = this.layout.radius;
			for (let o of this.segs) this.targetable(o) && (o.x - e) ** 2 + (o.y - t) ** 2 < (n + a * .8) ** 2 && this.damage(o, r, i);
		}
		kick(e, t) {
			if (this.heroKick = 1, this.fxOn) {
				let n = this.layout.hero;
				this.fx.push({
					t: "muzzle",
					x: n.x + Math.cos(e) * 34,
					y: n.y + Math.sin(e) * 34,
					ang: e,
					kind: t
				}), this.sfx.push("shoot");
			}
		}
		updateWeapon(e, t) {
			let n = this.layout.hero;
			switch (e.id) {
				case "orbit": return this.updateOrbit(e, t);
				case "spray": return this.updateSpray(e, t);
				case "beam":
					this.updateBeam(e, t);
					break;
				case "frost": e.awakened && (e.aux -= t, e.aux <= 0 && (e.aux = 7, this.freezeT = 1.5, this.fxOn && (this.fx.push({ t: "freeze" }), this.sfx.push("freeze"))));
			}
			if (e.timer -= t, e.timer > 0) return;
			let r = this.pickTarget();
			if (!r) {
				e.timer = .05;
				return;
			}
			e.timer += this.cdOf(e), e.timer < 0 && (e.timer = 0);
			let i = Math.atan2(r.y - n.y, r.x - n.x);
			switch (e.id) {
				case "dart":
				case "frost": {
					let t = e.count;
					for (let n = 0; n < t; n++) {
						let r = i + (n - (t - 1) / 2) * .09;
						this.shoot(e, r, 0, e.id === "frost" ? 11 : 10);
					}
					this.kick(i, e.id);
					break;
				}
				case "needle": {
					let t = this.layout.mode === "line" ? -Math.PI / 2 : i, n = e.count;
					for (let r = 0; r < n; r++) this.shoot(e, t, (r - (n - 1) / 2) * 24, 8);
					this.kick(t, e.id);
					break;
				}
				case "boomerang": {
					let t = e.count + (e.awakened ? 2 : 0);
					for (let n = 0; n < t; n++) {
						let r = i + (n - (t - 1) / 2) * .32, a = this.shoot(e, r, 0, 18 * (e.awakened ? 1.4 : 1) * (1 + e.areaPct * .3));
						a.out = !0, a.travelled = 0, a.range = this.areaOf(e), a.pierce = 999, a.life = 6;
					}
					this.kick(i, e.id);
					break;
				}
				case "chain":
					this.fireChain(e, r);
					break;
				case "bomb": {
					let t = e.count, a = this.areaOf(e);
					for (let i = 0; i < t; i++) {
						let t = i === 0 ? null : this.segs.filter((e) => this.targetable(e)), o = i === 0 || !t || !t.length ? r : t[Math.min(t.length - 1, i * 3)], s = .55, c = this.layout.path.at(o.d + this.baseSpeed * this.speedMul * s * .8, {
							x: 0,
							y: 0
						});
						this.lobs.push({
							sx: n.x,
							sy: n.y - 20,
							tx: c.x,
							ty: c.y,
							t: 0,
							T: s,
							dmg: this.dmgOf(e),
							r: a,
							w: e
						});
					}
					this.kick(i, e.id);
					break;
				}
				case "homing": {
					let t = e.count + (e.awakened ? 3 : 0);
					for (let n = 0; n < t; n++) {
						let a = -Math.PI / 2 + (n - (t - 1) / 2) * .5 + (this.rng.next() - .5) * .3, o = this.shoot(e, this.layout.mode === "line" ? a : i + (n - (t - 1) / 2) * .6, 0, 9), s = this.segs.filter((e) => this.targetable(e));
						o.target = s[Math.min(s.length - 1, n)] ?? r, o.explode = this.areaOf(e), o.life = 4, o.pierce = 0;
					}
					this.kick(i, e.id);
					break;
				}
				case "beam": {
					let t = e.count;
					e.beamT = 1.1 * (e.awakened ? 1.5 : 1), e.beamAng = [];
					for (let n = 0; n < t; n++) e.beamAng.push(i + (n - (t - 1) / 2) * .2);
					e.aux = 0, this.kick(i, e.id);
					break;
				}
				case "pulse": {
					let t = this.areaOf(e), r = e.awakened ? 2 : 1;
					for (let i = 0; i < r; i++) this.pulses.push({
						x: n.x,
						y: n.y,
						r: 20,
						maxR: t,
						speed: t / .45,
						dmg: this.dmgOf(e),
						hit: /* @__PURE__ */ new Set(),
						w: e,
						delay: i * .28
					});
					this.heroKick = 1, this.fxOn && this.sfx.push("pulse");
					break;
				}
				case "saber": {
					let t = this.areaOf(e), r = e.awakened ? [i, i + Math.PI] : [i], a = 70 * Math.PI / 180;
					for (let i of r) {
						this.slashes.push({
							x: n.x,
							y: n.y,
							ang: i,
							half: a,
							r: t,
							t: .28
						});
						for (let r of this.segs) {
							if (!this.targetable(r)) continue;
							let o = r.x - n.x, s = r.y - n.y;
							if (Math.hypot(o, s) > t + this.layout.radius) continue;
							let c = Math.atan2(s, o) - i;
							c = Math.atan2(Math.sin(c), Math.cos(c)), Math.abs(c) <= a && this.damage(r, this.dmgOf(e), e);
						}
					}
					this.heroKick = 1, this.fxOn && this.sfx.push("slash");
					break;
				}
			}
		}
		shoot(e, t, n, r) {
			let i = this.layout.hero, a = this.speedOf(e) || 600, o = -Math.sin(t) * n, s = Math.cos(t) * n, c = {
				kind: e.id,
				x: i.x + Math.cos(t) * 30 + o,
				y: i.y + Math.sin(t) * 30 + s,
				vx: Math.cos(t) * a,
				vy: Math.sin(t) * a,
				r,
				dmg: this.dmgOf(e),
				pierce: e.id === "needle" && e.awakened ? 999 : e.pierce,
				life: 2.2,
				hit: /* @__PURE__ */ new Set(),
				w: e,
				spin: 0
			};
			return this.projs.push(c), c;
		}
		updateOrbit(e, t) {
			let n = this.layout.hero, r = e.count + (e.awakened ? 2 : 0), i = 3 * (1 + e.ratePct * .5);
			e.phase += i * t;
			let a = this.areaOf(e);
			e.awakened && (a *= 1.25 + .65 * Math.sin(this.time * 2.4)), e.aux = a;
			let o = this.cdOf(e), s = this.dmgOf(e);
			for (let t = 0; t < r; t++) {
				let i = e.phase + t * Math.PI * 2 / r, c = n.x + Math.cos(i) * a, l = n.y + Math.sin(i) * a;
				for (let n of this.segs) {
					if (!this.targetable(n) || (n.x - c) ** 2 + (n.y - l) ** 2 > (17 + this.layout.radius) ** 2) continue;
					let r = n.id * 16 + t;
					(e.hitCd.get(r) ?? 0) > this.time || (e.hitCd.set(r, this.time + o), this.damage(n, s, e, c, l));
				}
			}
			e.hitCd.size > 4e3 && e.hitCd.clear();
		}
		updateSpray(e, t) {
			let n = this.layout.hero, r = this.areaOf(e), i = this.nearest(n.x, n.y, r + this.layout.radius);
			if (!i) {
				e.beamT = 0;
				return;
			}
			let a = Math.atan2(i.y - n.y, i.x - n.x);
			if (e.beamAng = [a], e.beamT = .2, e.timer -= t, e.timer > 0) return;
			e.timer += this.cdOf(e), e.timer < 0 && (e.timer = 0);
			let o = (e.awakened ? 42 : 27) * Math.PI / 180, s = this.dmgOf(e), c = !1;
			for (let t of this.segs) {
				if (!this.targetable(t)) continue;
				let i = t.x - n.x, l = t.y - n.y;
				if (i * i + l * l > (r + this.layout.radius) ** 2) continue;
				let u = Math.atan2(l, i) - a;
				u = Math.atan2(Math.sin(u), Math.cos(u)), Math.abs(u) <= o + .12 && (this.damage(t, s, e), c = !0);
			}
			c && e.awakened && this.frost.length < 1 && this.frost.push(this.time + .4);
		}
		updateBeam(e, t) {
			if (e.beamT <= 0) return;
			e.beamT -= t;
			let n = this.layout.hero, r = this.pickTarget();
			if (r) {
				let i = Math.atan2(r.y - n.y, r.x - n.x), a = e.beamAng.length;
				for (let n = 0; n < a; n++) {
					let r = i + (n - (a - 1) / 2) * .2 - e.beamAng[n];
					r = Math.atan2(Math.sin(r), Math.cos(r)), e.beamAng[n] += r * Math.min(1, t * 5);
				}
			}
			if (e.aux -= t, e.aux > 0) return;
			e.aux += .1;
			let i = this.areaOf(e), a = this.dmgOf(e);
			for (let t of e.beamAng) {
				let r = Math.cos(t), o = Math.sin(t);
				for (let t of this.segs) {
					if (!this.targetable(t)) continue;
					let s = t.x - n.x, c = t.y - n.y, l = s * r + c * o;
					l < 0 || l > 1800 || Math.abs(s * o - c * r) < i / 2 + this.layout.radius && this.damage(t, a, e);
				}
			}
		}
		fireChain(e, t) {
			let n = this.layout.hero, r = e.count + (e.awakened ? 3 : 0), i = this.areaOf(e), a = this.dmgOf(e), o = /* @__PURE__ */ new Set(), s = [{
				x: n.x,
				y: n.y - 20
			}], c = t;
			for (let t = 0; t <= r && c; t++) {
				o.add(c.id), s.push({
					x: c.x,
					y: c.y
				});
				let t = c;
				this.damage(t, a, e), e.awakened && this.rng.chance(.25) && this.damage(t, a, e), a *= .92, c = this.nearest(t.x, t.y, i, o);
			}
			this.heroKick = 1, this.fxOn && (this.fx.push({
				t: "arc",
				pts: s
			}), this.sfx.push("zap"));
		}
		updateProjs(e) {
			let t = this.layout.radius, { W: n, H: r } = this.layout, i = this.layout.hero;
			for (let a = this.projs.length - 1; a >= 0; a--) {
				let o = this.projs[a];
				if (o.life -= e, o.spin += e * 14, o.kind === "boomerang") {
					let t = this.speedOf(o.w);
					if (o.out) o.travelled += t * e, o.travelled >= o.range && (o.out = !1, o.hit.clear());
					else {
						let n = i.x - o.x, r = i.y - o.y, a = Math.hypot(n, r) || 1;
						o.vx += (n / a * t * 1.1 - o.vx) * Math.min(1, e * 6), o.vy += (r / a * t * 1.1 - o.vy) * Math.min(1, e * 6), a < 30 && (o.life = 0);
					}
				} else if (o.kind === "homing" && ((!o.target || !o.target.alive) && (o.target = this.nearest(o.x, o.y, 2e3)), o.target)) {
					let t = Math.atan2(o.target.y - o.y, o.target.x - o.x), n = Math.atan2(o.vy, o.vx), r = t - n;
					r = Math.atan2(Math.sin(r), Math.cos(r));
					let i = Math.sign(r) * Math.min(Math.abs(r), 6.5 * e), a = Math.min(this.speedOf(o.w) * 1.6, Math.hypot(o.vx, o.vy) + 500 * e), s = n + i;
					o.vx = Math.cos(s) * a, o.vy = Math.sin(s) * a;
				}
				if (o.x += o.vx * e, o.y += o.vy * e, o.life <= 0 || o.x < -60 || o.x > n + 60 || o.y < -60 || o.y > r + 60) {
					this.projs.splice(a, 1);
					continue;
				}
				let s = !1;
				for (let e of this.segs) {
					if (!e.alive || e.d <= 0) continue;
					let n = o.r + t, r = e.x - o.x, i = e.y - o.y;
					if (!(r * r + i * i > n * n) && !o.hit.has(e.id)) {
						if (o.hit.add(e.id), o.explode) {
							this.aoe(o.x, o.y, o.explode, o.dmg, o.w), this.fxOn && (this.fx.push({
								t: "boom",
								x: o.x,
								y: o.y,
								r: o.explode,
								color: "#8ff7ff"
							}), this.sfx.push("boom")), s = !0;
							break;
						}
						if (this.damage(e, o.dmg, o.w, o.x, o.y), o.kind === "frost" && (this.frost.length < 3 ? this.frost.push(this.time + 2.5) : this.frost[0] = this.time + 2.5), o.kind === "dart" && o.w.awakened && !o.mini) {
							let t = Math.atan2(o.vy, o.vx);
							for (let n of [-.6, .6]) {
								let r = Math.hypot(o.vx, o.vy), i = {
									kind: "dart",
									x: o.x,
									y: o.y,
									vx: Math.cos(t + n) * r,
									vy: Math.sin(t + n) * r,
									r: 7,
									dmg: o.dmg * .5,
									pierce: 0,
									life: .8,
									hit: /* @__PURE__ */ new Set([e.id]),
									w: o.w,
									mini: !0,
									spin: 0
								};
								this.projs.push(i);
							}
						}
						if (o.pierce <= 0) {
							s = !0;
							break;
						}
						--o.pierce;
					}
				}
				s && this.projs.splice(a, 1);
			}
		}
		updateLobs(e) {
			for (let t = this.lobs.length - 1; t >= 0; t--) {
				let n = this.lobs[t];
				n.t += e, !(n.t < n.T) && (this.lobs.splice(t, 1), this.aoe(n.tx, n.ty, n.r, n.dmg, n.w), n.w.awakened && this.zones.push({
					x: n.tx,
					y: n.ty,
					r: n.r * .85,
					t: 3,
					tick: 0,
					dmg: n.dmg * .16,
					w: n.w
				}), this.fxOn && (this.fx.push({
					t: "boom",
					x: n.tx,
					y: n.ty,
					r: n.r,
					color: "#ffcf4a"
				}), this.sfx.push("boom")));
			}
		}
		updateZones(e) {
			for (let t = this.zones.length - 1; t >= 0; t--) {
				let n = this.zones[t];
				n.t -= e, n.tick -= e, n.tick <= 0 && (n.tick += .25, this.aoe(n.x, n.y, n.r, n.dmg, n.w)), n.t <= 0 && this.zones.splice(t, 1);
			}
		}
		updatePulses(e) {
			let t = this.layout.radius;
			for (let n = this.pulses.length - 1; n >= 0; n--) {
				let r = this.pulses[n];
				if (r.delay > 0) {
					r.delay -= e;
					continue;
				}
				let i = r.r;
				r.r += r.speed * e;
				for (let e of this.segs) {
					if (!this.targetable(e) || r.hit.has(e.id)) continue;
					let n = Math.hypot(e.x - r.x, e.y - r.y);
					n >= i - t && n <= r.r + t && (r.hit.add(e.id), this.damage(e, r.dmg, r.w));
				}
				r.r >= r.maxR && this.pulses.splice(n, 1);
			}
		}
		rollContext() {
			let e = this.stats.luck + Math.min(.1, this.setup.fails * .02);
			return {
				loadout: this.setup.loadout,
				owned: this.weapons.map((e) => ({
					id: e.id,
					ups: e.ups,
					count: e.count,
					pierce: e.pierce,
					awakened: e.awakened
				})),
				luck: e
			};
		}
		openChest(e) {
			return (e === 2 ? this.chests.gold <= 0 : this.chests.silver <= 0) ? null : (e === 2 ? --this.chests.gold : --this.chests.silver, this.chestsOpened += 1, {
				kind: e,
				cards: this.roll(e),
				freeLeft: this.stats.freeRefresh,
				paidLeft: ni
			});
		}
		roll(e) {
			let t = this.rollContext();
			return e === 2 ? zr(t, this.rng) : Rr(t, this.rng);
		}
		reroll(e, t) {
			if (t) {
				if (e.paidLeft <= 0) return !1;
				--e.paidLeft;
			} else {
				if (e.freeLeft <= 0) return !1;
				--e.freeLeft;
			}
			return e.cards = this.roll(e.kind), !0;
		}
		apply(e) {
			if (e.t === "new") {
				this.addWeapon(e.weapon);
				return;
			}
			if (e.t === "glob") {
				switch (e.stat) {
					case "allDmg":
						this.run.allDmg += e.value;
						break;
					case "crit":
						this.run.crit += e.value;
						break;
					case "critDmg":
						this.run.critDmg += e.value;
						break;
					case "allRate":
						this.run.allRate += e.value;
						break;
					case "slow":
						this.run.slow = Math.min(.4, this.run.slow + e.value);
						break;
					case "knock": this.knockBack(e.value);
				}
				return;
			}
			let t = this.weapons.find((t) => t.id === e.weapon);
			if (!t) return;
			t.ups += 1;
			let n = D[t.id];
			switch (e.stat) {
				case "dmg":
					t.dmgPct += e.value;
					break;
				case "rate":
					t.ratePct += e.value;
					break;
				case "speed":
					t.speedPct += e.value;
					break;
				case "area":
					t.areaPct += e.value;
					break;
				case "pierce":
					t.pierce = Math.min(n.caps.pierce ?? 99, t.pierce + e.value);
					break;
				case "count":
					t.count = Math.min(n.caps.count ?? 99, t.count + e.value);
					break;
				case "awaken": t.awakened = !0, t.aux = .5;
			}
		}
		knockBack(e) {
			for (let t of this.segs) t.d -= e;
			this.placeSegs(), this.fxOn && (this.fx.push({ t: "knock" }), this.sfx.push("knock"));
		}
		reviveCost() {
			return this.revives >= ii ? null : ri[this.revives];
		}
		revive() {
			return this.state !== "dead" || this.revives >= ii ? !1 : (this.revives += 1, this.state = "play", this.projs = [], this.knockBack(this.layout.path.length * Qr * (1 + this.stats.knock)), !0);
		}
		summary() {
			return {
				won: this.state === "won",
				progress: this.state === "won" ? 1 : Math.max(this.bestProgress, this.progress),
				kills: this.killed,
				chests: this.chestsOpened,
				time: this.time,
				top: this.weapons.map((e) => ({
					id: e.id,
					dealt: e.dealt
				})).sort((e, t) => t.dealt - e.dealt)
			};
		}
	}, z = "#2a1a3e";
	function B(e, t, n, r, i, a) {
		let o = Math.min(a, r / 2, i / 2);
		e.beginPath(), e.moveTo(t + o, n), e.arcTo(t + r, n, t + r, n + i, o), e.arcTo(t + r, n + i, t, n + i, o), e.arcTo(t, n + i, t, n, o), e.arcTo(t, n, t + r, n, o), e.closePath();
	}
	function V(e, t, n, r) {
		e.beginPath(), e.arc(t, n, r, 0, Math.PI * 2);
	}
	function H(e, t, n, r, i, a = 0) {
		e.beginPath(), e.ellipse(t, n, Math.max(.01, r), Math.max(.01, i), a, 0, Math.PI * 2);
	}
	function U(e, t, n, r = z) {
		e.fillStyle = t, e.fill(), n > 0 && (e.lineWidth = n, e.strokeStyle = r, e.lineJoin = "round", e.stroke());
	}
	function oi(e, t) {
		let n = parseInt(e.slice(1), 16), r = n >> 16 & 255, i = n >> 8 & 255, a = n & 255;
		return t >= 0 ? (r += (255 - r) * t, i += (255 - i) * t, a += (255 - a) * t) : (r *= 1 + t, i *= 1 + t, a *= 1 + t), `rgb(${r | 0},${i | 0},${a | 0})`;
	}
	function si(e, t, n, r, i = .45, a = 5, o = -Math.PI / 2) {
		e.beginPath();
		for (let s = 0; s < a * 2; s++) {
			let c = o + s * Math.PI / a, l = s % 2 ? r * i : r, u = t + Math.cos(c) * l, d = n + Math.sin(c) * l;
			s === 0 ? e.moveTo(u, d) : e.lineTo(u, d);
		}
		e.closePath();
	}
	function ci(e, t, n, r) {
		e.beginPath(), e.moveTo(t + .15 * r, n - .5 * r), e.lineTo(t - .28 * r, n + .08 * r), e.lineTo(t - .02 * r, n + .08 * r), e.lineTo(t - .15 * r, n + .5 * r), e.lineTo(t + .3 * r, n - .1 * r), e.lineTo(t + .04 * r, n - .1 * r), e.closePath();
	}
	function li(e, t, n, r, i, a) {
		let o = a.t, s = a.kick ?? 0, c = Math.sin(o * 3.2) * i * .04, l = 1 + Math.sin(o * 3.2) * .025 - s * .06, u = Math.max(2, i * .09), d = a.silhouette, f = d ? "#3b3052" : t.body, p = d ? "#2f2744" : t.accent;
		if (e.save(), e.translate(n, r + c), e.fillStyle = "rgba(0,0,0,0.25)", H(e, 0, i * .98 - c, i * .85, i * .2), e.fill(), t.deco === "cape" || t.deco === "visor") {
			let t = Math.sin(o * 5) * i * .08;
			e.beginPath(), e.moveTo(-i * .62, -i * .2), e.quadraticCurveTo(-i * 1.15, i * .5, -i * .9 + t, i * .98), e.lineTo(i * .9 - t, i * .98), e.quadraticCurveTo(i * 1.15, i * .5, i * .62, -i * .2), e.closePath(), U(e, p, u);
		}
		for (let n of [-1, 1]) H(e, n * i * .38, i * .86, i * .26, i * .16), U(e, d ? f : oi(t.body, -.35), u);
		e.save(), e.scale(1 / l, l), V(e, 0, 0, i);
		let m = f;
		if (d || (m = e.createRadialGradient(-i * .35, -i * .4, i * .1, 0, 0, i * 1.05), m.addColorStop(0, oi(t.body, .45)), m.addColorStop(.55, t.body), m.addColorStop(1, oi(t.body, -.25))), U(e, m, u), !d && (e.fillStyle = "rgba(255,255,255,0.28)", H(e, -i * .38, -i * .5, i * .22, i * .13, -.6), e.fill(), t.deco === "leaf")) {
			e.strokeStyle = "rgba(255,255,255,0.35)", e.lineWidth = u * .6;
			for (let t = 0; t < 6; t++) {
				let n = t * Math.PI / 3 + .3;
				e.beginPath(), e.moveTo(Math.cos(n) * i * .55, Math.sin(n) * i * .55 + i * .25), e.lineTo(Math.cos(n) * i * .8, Math.sin(n) * i * .8 + i * .1), e.stroke();
			}
		}
		e.restore();
		let h = s * i * .25;
		for (let t of [-1, 1]) H(e, t * i * .98, i * .18 - (t > 0 ? h : 0), i * .19, i * .24, t * .4), U(e, f, u);
		if (!d) {
			let n = a.look ?? -Math.PI / 2, r = Math.cos(n) * i * .06, o = Math.sin(n) * i * .05;
			if (t.deco === "visor") B(e, -i * .72, -i * .42, i * 1.44, i * .42, i * .2), U(e, t.accent, u), e.fillStyle = "rgba(255,255,255,0.7)", B(e, -i * .55, -i * .34, i * .4, i * .1, i * .05), e.fill(), e.fillStyle = "#fff", H(e, -i * .3 + r, -i * .2, i * .1, i * .08), e.fill(), H(e, i * .3 + r, -i * .2, i * .1, i * .08), e.fill();
			else for (let t of [-1, 1]) H(e, t * i * .32, -i * .18, i * .2, i * .25), U(e, "#fff", u * .7), a.happy ? (e.beginPath(), e.arc(t * i * .32, -i * .12, i * .12, Math.PI * 1.1, Math.PI * 1.9), e.lineWidth = u, e.strokeStyle = z, e.stroke()) : (H(e, t * i * .32 + r, -i * .14 + o, i * .11, i * .14), e.fillStyle = z, e.fill(), e.fillStyle = "#fff", V(e, t * i * .32 + r - i * .04, -i * .2 + o, i * .045), e.fill());
			t.deco === "bolt" && (e.strokeStyle = z, e.lineWidth = u * .8, e.beginPath(), e.moveTo(-i * .95, -i * .3), e.lineTo(-i * .52, -i * .24), e.moveTo(i * .52, -i * .24), e.lineTo(i * .95, -i * .3), e.stroke()), e.fillStyle = "rgba(255,90,120,0.35)", H(e, -i * .58, i * .12, i * .14, i * .08), e.fill(), H(e, i * .58, i * .12, i * .14, i * .08), e.fill(), e.beginPath(), s > .3 ? (H(e, 0, i * .2, i * .13, i * .12), U(e, "#a8243f", u * .7)) : (e.arc(0, i * .1, i * .16, Math.PI * .15, Math.PI * .85), e.lineWidth = u * .9, e.strokeStyle = z, e.lineCap = "round", e.stroke());
		}
		if (t.deco === "cape") e.beginPath(), e.arc(0, 0, i * .98, Math.PI * 1.13, Math.PI * 1.87), e.lineWidth = i * .17, e.strokeStyle = d ? p : z, e.stroke(), e.lineWidth = i * .1, e.strokeStyle = d ? p : "#ffffff", e.stroke(), si(e, 0, -i * .93, i * .24), U(e, d ? p : "#ffd23f", u * .8), si(e, 0, i * .55, i * .13), U(e, d ? p : "#ffd23f", u * .6);
		else if (t.deco === "leaf") e.save(), e.translate(i * .1, -i * .95), e.rotate(.5 + Math.sin(o * 4) * .08), H(e, i * .22, 0, i * .3, i * .14), U(e, p, u * .8), e.restore(), B(e, -i * .05, -i * 1.1, i * .1, i * .22, i * .05), U(e, d ? p : "#7a4a1a", u * .6), B(e, -i * .7, i * .46, i * 1.4, i * .2, i * .1), U(e, p, u * .8);
		else if (t.deco === "bolt") ci(e, i * .05, -i * 1.12, i * .75), U(e, p, u * .8);
		else if (t.deco === "snow") {
			e.save(), e.translate(i * .55, -i * .72), e.strokeStyle = d ? p : "#ffffff", e.lineWidth = i * .07, e.lineCap = "round";
			for (let t = 0; t < 3; t++) e.rotate(Math.PI / 3), e.beginPath(), e.moveTo(-i * .22, 0), e.lineTo(i * .22, 0), e.stroke();
			e.restore(), B(e, -i * .75, i * .42, i * 1.5, i * .22, i * .11), U(e, d ? p : "#e8f7ff", u * .8);
		} else t.deco === "visor" && (e.beginPath(), e.moveTo(0, -i * .95), e.quadraticCurveTo(i * .2, -i * 1.5, i * .65, -i * 1.35), e.quadraticCurveTo(i * .3, -i * 1.2, i * .18, -i * .9), e.closePath(), U(e, p, u * .8));
		e.restore();
	}
	function W(e, t, n, r = 1) {
		return `hsla(${e},${t}%,${n}%,${r})`;
	}
	function ui(e, t, n, r, i, a, o) {
		let s = Math.max(1.5, i * .1), c = a ? 10 : 8, l = W(t, 55, 18);
		e.save(), e.translate(n, r);
		for (let n = 0; n < c; n++) {
			let r = n / c * Math.PI * 2 + o * .7, u = i * (a ? 1.32 : 1.24), d = Math.cos(r) * i * .8, f = Math.sin(r) * i * .8, p = Math.cos(r) * u, m = Math.sin(r) * u;
			e.strokeStyle = l, e.lineWidth = i * .2, e.lineCap = "round", e.beginPath(), e.moveTo(d, f), e.lineTo(p, m), e.stroke(), e.strokeStyle = W(t, 70, 50), e.lineWidth = i * .09, e.stroke(), V(e, p, m, i * .16), U(e, W(t, 85, 72), s * .7, l);
		}
		V(e, 0, 0, i);
		let u = e.createRadialGradient(-i * .35, -i * .4, i * .1, 0, 0, i);
		u.addColorStop(0, W(t, 90, 78)), u.addColorStop(.6, W(t, 75, 58)), u.addColorStop(1, W(t, 70, 40)), U(e, u, s, l), e.fillStyle = W(t, 70, 38, .45);
		for (let t = 0; t < 3; t++) {
			let n = o * 2.1 + t * 2.2;
			V(e, Math.cos(n) * i * .45, Math.sin(n) * i * .45 + i * .1, i * (.12 + .05 * t)), e.fill();
		}
		if (e.fillStyle = "rgba(255,255,255,0.45)", H(e, -i * .38, -i * .45, i * .25, i * .14, -.6), e.fill(), a) {
			for (let t of [-1, 1]) H(e, t * i * .36, -i * .12, i * .22, i * .2), U(e, "#fff", s * .7, l), V(e, t * i * .3, -i * .08, i * .1), e.fillStyle = z, e.fill(), e.beginPath(), e.moveTo(t * i * .62, -i * .46), e.lineTo(t * i * .12, -i * .26), e.lineWidth = s * 1.1, e.strokeStyle = l, e.lineCap = "round", e.stroke();
			e.beginPath(), e.moveTo(-i * .42, i * .28), e.quadraticCurveTo(0, i * .7, i * .42, i * .28), e.closePath(), U(e, "#5a0d24", s * .8, l), e.fillStyle = "#fff";
			for (let t of [-1, 1]) e.beginPath(), e.moveTo(t * i * .3, i * .31), e.lineTo(t * i * .18, i * .31), e.lineTo(t * i * .24, i * .44), e.closePath(), e.fill();
		}
		e.restore();
	}
	function di(e, t, n, r, i, a = 0) {
		let o = Math.max(1.5, r * .07), s = r * 1.9, c = r * 1.45, l = i ? "#ffc43d" : "#cfd8e6", u = i ? "#b86b0c" : "#6b7a96", d = i ? "#e0621f" : "#4f6ee0";
		e.save(), e.translate(t, n);
		let f = e.createRadialGradient(0, 0, r * .2, 0, 0, r * 1.6);
		f.addColorStop(0, i ? "rgba(255,220,90,0.55)" : "rgba(170,210,255,0.5)"), f.addColorStop(1, "rgba(255,255,255,0)"), e.fillStyle = f, V(e, 0, 0, r * 1.6), e.fill(), B(e, -s / 2, -c * .12, s, c * .62, r * .14);
		let p = e.createLinearGradient(0, -c * .1, 0, c * .5);
		p.addColorStop(0, oi(l, .2)), p.addColorStop(1, oi(l, -.2)), U(e, p, o), e.save(), e.translate(0, -c * .12), e.rotate(-a * .5), e.beginPath(), e.moveTo(-s / 2, 0), e.lineTo(-s / 2, -c * .22), e.quadraticCurveTo(0, -c * .62, s / 2, -c * .22), e.lineTo(s / 2, 0), e.closePath();
		let m = e.createLinearGradient(0, -c * .5, 0, 0);
		m.addColorStop(0, oi(l, .35)), m.addColorStop(1, l), U(e, m, o), e.restore(), e.fillStyle = u;
		for (let t of [-s * .32, s * .32]) e.fillRect(t - r * .1, -c * .5, r * .2, c * .98);
		e.strokeStyle = z, e.lineWidth = o * .6;
		for (let t of [-s * .32, s * .32]) e.strokeRect(t - r * .1, -c * .12, r * .2, c * .62);
		e.beginPath(), e.moveTo(0, -c * .34), e.lineTo(r * .26, -c * .1), e.lineTo(0, c * .16), e.lineTo(-r * .26, -c * .1), e.closePath(), U(e, d, o * .8), e.fillStyle = "rgba(255,255,255,0.7)", e.beginPath(), e.moveTo(0, -c * .28), e.lineTo(r * .1, -c * .12), e.lineTo(-r * .06, -c * .12), e.closePath(), e.fill(), e.restore();
	}
	function fi(e, t, n, r, i, a, o, s, c) {
		e.save(), e.translate(t, n), e.rotate(a), e.beginPath(), e.arc(-r / 2, 0, i, Math.PI / 2, Math.PI * 1.5), e.lineTo(0, -i), e.lineTo(0, i), e.closePath(), e.fillStyle = o, e.fill(), e.beginPath(), e.arc(r / 2, 0, i, -Math.PI / 2, Math.PI / 2), e.lineTo(0, i), e.lineTo(0, -i), e.closePath(), e.fillStyle = s, e.fill(), e.beginPath(), e.arc(-r / 2, 0, i, Math.PI / 2, Math.PI * 1.5), e.lineTo(r / 2, -i), e.arc(r / 2, 0, i, -Math.PI / 2, Math.PI / 2), e.closePath(), e.lineWidth = c, e.strokeStyle = z, e.stroke(), e.fillStyle = "rgba(255,255,255,0.55)", B(e, -r / 2, -i * .6, r * .8, i * .35, i * .2), e.fill(), e.restore();
	}
	function pi(e, t, n, r, i, a, o) {
		e.save(), e.translate(t, n), e.rotate(i + Math.PI / 2), e.lineCap = "round", e.lineJoin = "round";
		let s = () => {
			e.beginPath(), e.moveTo(0, r * .55), e.lineTo(0, 0), e.lineTo(-r * .4, -r * .5), e.moveTo(0, 0), e.lineTo(r * .4, -r * .5);
		};
		s(), e.strokeStyle = z, e.lineWidth = r * .34 + o, e.stroke(), s(), e.strokeStyle = a, e.lineWidth = r * .34, e.stroke(), e.restore();
	}
	function mi(e, t, n, r, i) {
		let a = Math.max(1.5, i * .06);
		switch (e.save(), e.translate(n, r), t) {
			case "dart":
				pi(e, -i * .18, i * .12, i * .55, -Math.PI / 4, "#7ff0ff", a), pi(e, i * .22, -i * .18, i * .42, -Math.PI / 4, "#ffffff", a);
				break;
			case "needle":
				e.rotate(-Math.PI / 4), B(e, -i * .5, -i * .13, i * .62, i * .26, i * .05), U(e, "#bff3ff", a), e.fillStyle = "#39b8ff", e.fillRect(-i * .46, -i * .07, i * .36, i * .14), B(e, -i * .66, -i * .2, i * .16, i * .4, i * .04), U(e, "#8a9bb8", a), e.beginPath(), e.moveTo(i * .12, -i * .05), e.lineTo(i * .62, 0), e.lineTo(i * .12, i * .05), e.closePath(), U(e, "#e6edf5", a * .7);
				break;
			case "orbit":
				e.strokeStyle = "rgba(255,255,255,0.5)", e.lineWidth = a, e.setLineDash([i * .08, i * .08]), V(e, 0, 0, i * .42), e.stroke(), e.setLineDash([]), fi(e, -i * .3, -i * .28, i * .36, i * .14, -.6, "#ff5f7a", "#ffffff", a), fi(e, i * .3, i * .28, i * .36, i * .14, -.6, "#3fd0ff", "#ffffff", a);
				break;
			case "spray":
				B(e, -i * .45, -i * .1, i * .4, i * .6, i * .1), U(e, "#6ee07a", a), B(e, -i * .36, -i * .3, i * .22, i * .22, i * .04), U(e, "#f2f2f2", a), e.fillStyle = "#fff", B(e, -i * .38, i * .05, i * .26, i * .2, i * .05), e.fill(), e.fillStyle = "rgba(200,255,220,0.9)";
				for (let t = 0; t < 6; t++) V(e, i * (0 + t * .09), -i * .2 + t % 3 * i * .1 - i * .05 * t * .2, i * (.05 + t * .012)), e.fill();
				break;
			case "boomerang":
				e.rotate(-.5), B(e, -i * .55, -i * .18, i * 1.1, i * .36, i * .18), U(e, "#f5c79a", a), B(e, -i * .18, -i * .14, i * .36, i * .28, i * .06), U(e, "#fff1e3", a * .6), e.fillStyle = "#c98f5e";
				for (let t of [
					-.4,
					-.3,
					.3,
					.4
				]) V(e, i * t, 0, i * .025), e.fill();
				break;
			case "chain":
				ci(e, 0, 0, i * 1.15), U(e, "#ffe14a", a), e.fillStyle = "rgba(255,255,255,0.7)", ci(e, -i * .03, -i * .06, i * .5), e.fill();
				break;
			case "bomb":
				V(e, 0, i * .05, i * .42), U(e, "#ff9f2e", a), e.strokeStyle = "rgba(255,255,255,0.8)", e.lineWidth = a * .8, V(e, 0, i * .05, i * .26), e.stroke(), e.fillStyle = "rgba(255,255,255,0.9)";
				for (let [t, n, r] of [
					[
						.35,
						-.38,
						.09
					],
					[
						.5,
						-.52,
						.06
					],
					[
						.2,
						-.5,
						.05
					]
				]) V(e, i * t, i * n, i * r), e.fill();
				e.font = `900 ${i * .34}px sans-serif`, e.textAlign = "center", e.textBaseline = "middle", e.fillStyle = "#fff", e.fillText("C", 0, i * .07);
				break;
			case "frost":
				e.rotate(-Math.PI / 4), e.beginPath(), e.moveTo(i * .6, 0), e.lineTo(0, -i * .18), e.lineTo(-i * .55, 0), e.lineTo(0, i * .18), e.closePath(), U(e, "#aee9ff", a), e.fillStyle = "rgba(255,255,255,0.8)", e.beginPath(), e.moveTo(i * .45, 0), e.lineTo(0, -i * .08), e.lineTo(-i * .2, 0), e.closePath(), e.fill();
				break;
			case "pulse":
				for (let t = 3; t >= 1; t--) e.beginPath(), e.arc(-i * .3, 0, i * .22 * t, -.9, .9), e.lineWidth = i * .1, e.strokeStyle = z, e.stroke(), e.lineWidth = i * .06, e.strokeStyle = t === 3 ? "#ff8ad8" : t === 2 ? "#ffc0ec" : "#ffffff", e.stroke();
				V(e, -i * .34, 0, i * .1), U(e, "#ff5fc4", a);
				break;
			case "homing":
				e.rotate(-Math.PI / 4), e.fillStyle = "#ffb13d", e.beginPath(), e.moveTo(-i * .4, -i * .1), e.lineTo(-i * .7, 0), e.lineTo(-i * .4, i * .1), e.closePath(), e.fill(), B(e, -i * .42, -i * .13, i * .72, i * .26, i * .12), U(e, "#f4f7ff", a), e.beginPath(), e.moveTo(i * .25, -i * .13), e.quadraticCurveTo(i * .55, 0, i * .25, i * .13), e.closePath(), U(e, "#ff4b6a", a), e.beginPath(), e.moveTo(-i * .3, -i * .12), e.lineTo(-i * .42, -i * .3), e.lineTo(-i * .12, -i * .12), e.moveTo(-i * .3, i * .12), e.lineTo(-i * .42, i * .3), e.lineTo(-i * .12, i * .12), U(e, "#ff4b6a", a * .8);
				break;
			case "beam": {
				let t = e.createLinearGradient(-i * .5, 0, i * .6, 0);
				t.addColorStop(0, "#b35cff"), t.addColorStop(1, "#ffffff"), e.rotate(-Math.PI / 4), B(e, -i * .1, -i * .12, i * .75, i * .24, i * .12), e.fillStyle = t, e.fill(), B(e, -i * .6, -i * .22, i * .5, i * .44, i * .12), U(e, "#6a4bd6", a), V(e, -i * .35, 0, i * .1), e.fillStyle = "#e9d8ff", e.fill();
				break;
			}
			case "saber": {
				e.rotate(-Math.PI / 4);
				let t = e.createLinearGradient(-i * .2, 0, i * .7, 0);
				t.addColorStop(0, "#74ffb4"), t.addColorStop(1, "#e5fff1"), B(e, -i * .15, -i * .11, i * .85, i * .22, i * .11), e.fillStyle = t, e.fill(), e.lineWidth = a, e.strokeStyle = "#1c8f57", e.stroke(), B(e, -i * .62, -i * .09, i * .42, i * .18, i * .06), U(e, "#6d7b93", a), B(e, -i * .24, -i * .24, i * .1, i * .48, i * .04), U(e, "#ffd23f", a);
				break;
			}
		}
		e.restore();
	}
	function hi(e, t, n, r) {
		let i = n ? "#ffcf3a" : "#d6e0ee";
		e.save(), e.rotate(-Math.PI / 4), B(e, -t * .05, -t * .09, t * .62, t * .18, t * .06), U(e, i, r), B(e, t * .38, t * .02, t * .1, t * .2, t * .03), U(e, i, r), B(e, t * .2, t * .02, t * .1, t * .15, t * .03), U(e, i, r), V(e, -t * .25, 0, t * .27), U(e, i, r), V(e, -t * .25, 0, t * .1), U(e, n ? "#b8741a" : "#6f7f9a", r * .7), e.restore();
	}
	function gi(e, t, n) {
		V(e, 0, 0, t * .46);
		let r = e.createRadialGradient(-t * .15, -t * .18, t * .05, 0, 0, t * .5);
		r.addColorStop(0, "#fff3a8"), r.addColorStop(.6, "#ffcc2f"), r.addColorStop(1, "#e08d0b"), U(e, r, n), V(e, 0, 0, t * .32), e.strokeStyle = "#c77a08", e.lineWidth = n * .8, e.stroke(), B(e, -t * .1, -t * .1, t * .2, t * .2, t * .02), U(e, "#c77a08", n * .6);
	}
	function _i(e, t, n, r = "#c56bff") {
		e.beginPath(), e.moveTo(-t * .42, -t * .12), e.lineTo(-t * .22, -t * .38), e.lineTo(t * .22, -t * .38), e.lineTo(t * .42, -t * .12), e.lineTo(0, t * .45), e.closePath();
		let i = e.createLinearGradient(0, -t * .4, 0, t * .45);
		i.addColorStop(0, oi(r, .45)), i.addColorStop(1, oi(r, -.25)), U(e, i, n), e.strokeStyle = "rgba(255,255,255,0.65)", e.lineWidth = n * .6, e.beginPath(), e.moveTo(-t * .42, -t * .12), e.lineTo(t * .42, -t * .12), e.moveTo(-t * .12, -t * .38), e.lineTo(-t * .18, -t * .12), e.lineTo(0, t * .42), e.moveTo(t * .12, -t * .38), e.lineTo(t * .18, -t * .12), e.stroke();
	}
	function vi(e, t, n, r) {
		let i = E[r];
		e.beginPath(), e.moveTo(0, -t * .46), e.lineTo(t * .3, -t * .05), e.lineTo(t * .12, t * .46), e.lineTo(-t * .22, t * .3), e.lineTo(-t * .3, -t * .12), e.closePath();
		let a = e.createLinearGradient(-t * .3, -t * .4, t * .3, t * .4);
		a.addColorStop(0, oi(i, .5)), a.addColorStop(1, We[r]), U(e, a, n), e.strokeStyle = "rgba(255,255,255,0.7)", e.lineWidth = n * .6, e.beginPath(), e.moveTo(0, -t * .46), e.lineTo(-t * .02, t * .1), e.lineTo(t * .12, t * .46), e.stroke();
	}
	function yi(e, t, n, r) {
		switch (t) {
			case "cup":
				B(e, -n * .2, -n * .3, n * .4, n * .72, n * .1), U(e, "#5b8cff", r), B(e, -n * .24, -n * .44, n * .48, n * .16, n * .05), U(e, "#c9d6ff", r), e.fillStyle = "rgba(255,255,255,0.4)", B(e, -n * .14, -n * .2, n * .07, n * .5, n * .03), e.fill(), e.fillStyle = "#ff5a5a", V(e, n * .02, n * .08, n * .06), e.fill();
				break;
			case "goji":
				B(e, -n * .32, -n * .28, n * .64, n * .66, n * .12), U(e, "#f8e2b0", r);
				for (let t = 0; t < 7; t++) {
					let i = t * .9;
					H(e, Math.cos(i) * n * .16, n * .06 + Math.sin(i) * n * .14, n * .09, n * .05, i), U(e, "#ff3d3d", r * .5);
				}
				B(e, -n * .34, -n * .36, n * .68, n * .12, n * .04), U(e, "#e05c2a", r);
				break;
			case "tub":
				e.beginPath(), e.moveTo(-n * .42, -n * .12), e.lineTo(n * .42, -n * .12), e.lineTo(n * .32, n * .4), e.lineTo(-n * .32, n * .4), e.closePath(), U(e, "#b0764a", r), e.strokeStyle = "#7a4a28", e.lineWidth = r * .7;
				for (let t of [.05, .25]) e.beginPath(), e.moveTo(-n * .4, n * t), e.lineTo(n * .4, n * t), e.stroke();
				H(e, 0, -n * .12, n * .42, n * .1), U(e, "#7fd6ff", r), e.strokeStyle = "rgba(255,255,255,0.8)", e.lineWidth = r * .7;
				for (let t of [
					-.15,
					.05,
					.22
				]) e.beginPath(), e.moveTo(n * t, -n * .28), e.quadraticCurveTo(n * (t + .08), -n * .36, n * t, -n * .46), e.stroke();
				break;
			case "mask":
				H(e, -n * .2, 0, n * .24, n * .2), U(e, "#ffb3cf", r), H(e, n * .2, 0, n * .24, n * .2), U(e, "#ffb3cf", r), e.strokeStyle = z, e.lineWidth = r, e.beginPath(), e.arc(-n * .2, -n * .02, n * .1, .2, Math.PI - .2), e.moveTo(n * .3, -n * .02), e.arc(n * .2, -n * .02, n * .1, .2, Math.PI - .2), e.stroke(), e.strokeStyle = "#ff7aa8", e.lineWidth = r * 1.4, e.beginPath(), e.moveTo(-n * .44, -n * .04), e.lineTo(-n * .5, -n * .1), e.moveTo(n * .44, -n * .04), e.lineTo(n * .5, -n * .1), e.stroke();
				break;
			case "coffee":
				B(e, -n * .18, -n * .46, n * .36, n * .9, n * .06), U(e, "#8a4b2a", r), e.fillStyle = "#ffd98a", e.fillRect(-n * .18, -n * .12, n * .36, n * .22), e.fillStyle = "#8a4b2a", e.font = `900 ${n * .18}px sans-serif`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("3in1", 0, 0), e.strokeStyle = z, e.lineWidth = r * .6, e.beginPath(), e.moveTo(-n * .18, -n * .36), e.lineTo(n * .18, -n * .36), e.stroke();
				break;
			case "glasses":
				e.strokeStyle = z, e.lineWidth = r * 1.5, e.beginPath(), e.moveTo(-n * .1, -n * .05), e.quadraticCurveTo(0, -n * .12, n * .1, -n * .05), e.stroke();
				for (let t of [-1, 1]) B(e, t * n * .28 - n * .19, -n * .18, n * .38, n * .3, n * .1), U(e, "rgba(120,160,255,0.75)", r), e.fillStyle = "rgba(255,255,255,0.6)", e.fillRect(t * n * .28 - n * .12, -n * .12, n * .08, n * .06);
				break;
			case "belt":
				B(e, -n * .48, -n * .2, n * .96, n * .4, n * .12), U(e, "#6b5bd6", r), B(e, -n * .14, -n * .16, n * .28, n * .32, n * .05), U(e, "#ffd23f", r), e.strokeStyle = "rgba(255,255,255,0.5)", e.lineWidth = r * .6, e.setLineDash([n * .05, n * .05]), e.beginPath(), e.moveTo(-n * .44, -n * .12), e.lineTo(-n * .18, -n * .12), e.moveTo(n * .18, -n * .12), e.lineTo(n * .44, -n * .12), e.stroke(), e.setLineDash([]);
				break;
			case "pillow":
				e.beginPath(), e.arc(0, 0, n * .4, Math.PI * .05, Math.PI * .95, !0), e.lineWidth = n * .26 + r * 2, e.strokeStyle = z, e.lineCap = "round", e.stroke(), e.lineWidth = n * .26, e.strokeStyle = "#7ad0a0", e.stroke(), e.lineWidth = n * .06, e.strokeStyle = "rgba(255,255,255,0.5)", e.beginPath(), e.arc(0, 0, n * .44, Math.PI * 1.2, Math.PI * 1.8), e.stroke();
				break;
			case "keyboard":
				B(e, -n * .48, -n * .24, n * .96, n * .48, n * .08), U(e, "#3d4560", r);
				for (let t = 0; t < 3; t++) for (let r = 0; r < 5; r++) B(e, -n * .4 + r * n * .165, -n * .16 + t * n * .12, n * .13, n * .09, n * .02), e.fillStyle = (t + r) % 4 == 0 ? "#6ff0ff" : "#e8ecf5", e.fill();
				break;
			case "clover":
				for (let t = 0; t < 4; t++) e.save(), e.rotate(t * Math.PI / 2 + Math.PI / 4), e.beginPath(), e.moveTo(0, 0), e.bezierCurveTo(-n * .35, -n * .1, -n * .2, -n * .5, 0, -n * .28), e.bezierCurveTo(n * .2, -n * .5, n * .35, -n * .1, 0, 0), U(e, "#4ed26a", r), e.restore();
				e.strokeStyle = "#2c8c43", e.lineWidth = r * 1.4, e.beginPath(), e.moveTo(0, 0), e.quadraticCurveTo(n * .1, n * .3, n * .25, n * .45), e.stroke();
				break;
			case "koi":
				e.beginPath(), e.moveTo(-n * .4, 0), e.quadraticCurveTo(-n * .1, -n * .32, n * .25, -n * .05), e.lineTo(n * .45, -n * .22), e.lineTo(n * .4, n * .2), e.lineTo(n * .25, n * .05), e.quadraticCurveTo(-n * .1, n * .32, -n * .4, 0), U(e, "#ff6a3d", r), e.fillStyle = "#fff", H(e, -n * .08, -n * .02, n * .12, n * .08), e.fill(), e.fillStyle = z, V(e, -n * .28, -n * .04, n * .04), e.fill();
				break;
			case "rope": {
				e.strokeStyle = z, e.lineWidth = n * .14 + r * 2, e.lineCap = "round";
				let t = () => {
					e.beginPath(), e.moveTo(-n * .42, n * .1), e.bezierCurveTo(-n * .2, -n * .5, n * .2, n * .5, n * .42, -n * .1);
				};
				t(), e.stroke(), e.strokeStyle = "#ff3b4e", e.lineWidth = n * .14, t(), e.stroke(), V(e, 0, 0, n * .12), U(e, "#ffd23f", r);
				break;
			}
		}
	}
	function bi(e, t, n, r) {
		switch (t) {
			case "allDmg":
			case "atk":
				e.save(), e.rotate(-Math.PI / 4), B(e, -n * .07, -n * .5, n * .14, n * .7, n * .04), U(e, "#e8eef8", r), B(e, -n * .24, n * .16, n * .48, n * .1, n * .04), U(e, "#ffd23f", r), B(e, -n * .06, n * .24, n * .12, n * .22, n * .04), U(e, "#a0522d", r), e.restore(), t === "allDmg" && (e.beginPath(), e.moveTo(n * .32, -n * .46), e.lineTo(n * .5, -n * .2), e.lineTo(n * .14, -n * .2), e.closePath(), U(e, "#4cd964", r * .8));
				break;
			case "crit":
				V(e, 0, 0, n * .42), U(e, "#ff5a5a", r), V(e, 0, 0, n * .28), U(e, "#fff", r * .7), V(e, 0, 0, n * .13), U(e, "#ff5a5a", r * .7);
				break;
			case "critDmg":
				si(e, 0, 0, n * .48, .5, 8), U(e, "#ff8a1f", r), si(e, 0, 0, n * .26, .5, 8), e.fillStyle = "#fff3b0", e.fill();
				break;
			case "allRate":
			case "rate":
				for (let t of [-.18, .12]) e.beginPath(), e.moveTo(-n * .35, n * (t + .2)), e.lineTo(0, n * (t - .12)), e.lineTo(n * .35, n * (t + .2)), e.lineWidth = n * .16 + r * 2, e.strokeStyle = z, e.lineCap = "round", e.lineJoin = "round", e.stroke(), e.lineWidth = n * .16, e.strokeStyle = "#3fd0ff", e.stroke();
				break;
			case "slow":
				H(e, 0, n * .25, n * .45, n * .12), U(e, "#b6e36c", r), V(e, -n * .02, -n * .02, n * .28), U(e, "#f2a64a", r), e.strokeStyle = "#a45a12", e.lineWidth = r, e.beginPath();
				for (let t = 0; t < Math.PI * 4; t += .2) {
					let r = n * .02 + t * n * .018, i = -n * .02 + Math.cos(t) * r, a = -n * .02 + Math.sin(t) * r;
					t === 0 ? e.moveTo(i, a) : e.lineTo(i, a);
				}
				e.stroke(), e.strokeStyle = z, e.beginPath(), e.moveTo(n * .34, n * .18), e.lineTo(n * .42, -n * .12), e.moveTo(n * .28, n * .18), e.lineTo(n * .28, -n * .1), e.stroke();
				break;
			case "knock": for (let t = 0; t < 3; t++) e.beginPath(), e.arc(0, n * .3, n * (.2 + t * .16), Math.PI * 1.15, Math.PI * 1.85), e.lineWidth = n * .08 + r * 2, e.strokeStyle = z, e.stroke(), e.lineWidth = n * .08, e.strokeStyle = [
				"#fff",
				"#9fe6ff",
				"#3fa9ff"
			][t], e.stroke();
		}
	}
	function xi(e, t, n, r) {
		B(e, -t * .42, -t * .12, t * .84, t * .54, t * .08), U(e, r, n), B(e, -t * .46, -t * .3, t * .92, t * .22, t * .06), U(e, oi(r, .25), n), e.fillStyle = "#ffd23f", e.fillRect(-t * .08, -t * .3, t * .16, t * .72), e.strokeStyle = z, e.lineWidth = n * .7, e.strokeRect(-t * .08, -t * .3, t * .16, t * .72);
	}
	function Si(e, t, n, r = 0) {
		let i = Math.max(1.5, n * .055);
		if (t.startsWith("weapon_")) return mi(e, t.slice(7), 0, 0, n * .9);
		if (t.startsWith("relic_")) return yi(e, t.slice(6), n * .95, i);
		if (t.startsWith("hero_")) return li(e, k[t.slice(5)] ?? k.amian, 0, n * .02, n * .32, {
			t: r,
			look: Math.PI / 2
		});
		if (t.startsWith("virus_")) return ui(e, Number(t.slice(6)), 0, 0, n * .3, !0, 1);
		switch (t) {
			case "gold": return gi(e, n, i);
			case "gem": return _i(e, n, i);
			case "stamina":
				ci(e, 0, 0, n * 1.05), U(e, "#8cf04a", i), e.fillStyle = "rgba(255,255,255,0.6)", ci(e, -n * .03, -n * .06, n * .45), e.fill();
				return;
			case "keyGold": return hi(e, n, !0, i);
			case "keySilver": return hi(e, n, !1, i);
			case "frag0":
			case "frag1":
			case "frag2":
			case "frag3":
			case "frag4": return vi(e, n, i, Number(t.slice(4)));
			case "chestGold": return di(e, 0, n * .06, n * .36, !0);
			case "chestSilver": return di(e, 0, n * .06, n * .36, !1);
			case "boxBlue": return xi(e, n, i, "#3ba4ff");
			case "boxPurple": return xi(e, n, i, "#b35cff");
			case "gift": return xi(e, n, i, "#ff5f7a");
			case "idle":
				di(e, 0, n * .1, n * .3, !0), V(e, n * .26, -n * .24, n * .18), U(e, "#fff", i), e.strokeStyle = z, e.lineWidth = i, e.beginPath(), e.moveTo(n * .26, -n * .34), e.lineTo(n * .26, -n * .24), e.lineTo(n * .34, -n * .2), e.stroke();
				return;
			case "task":
				B(e, -n * .34, -n * .42, n * .68, n * .84, n * .08), U(e, "#fff7e0", i), B(e, -n * .16, -n * .48, n * .32, n * .14, n * .04), U(e, "#ff9f2e", i), e.strokeStyle = "#4cd964", e.lineWidth = i * 1.3, e.lineCap = "round";
				for (let t of [
					-.18,
					.06,
					.28
				]) e.beginPath(), e.moveTo(-n * .22, n * t), e.lineTo(-n * .16, n * (t + .05)), e.lineTo(-n * .08, n * (t - .05)), e.stroke();
				e.strokeStyle = "#b9a98a";
				for (let t of [
					-.18,
					.06,
					.28
				]) e.beginPath(), e.moveTo(n * 0, n * t), e.lineTo(n * .22, n * t), e.stroke();
				return;
			case "sign":
				B(e, -n * .4, -n * .34, n * .8, n * .74, n * .1), U(e, "#fff", i), B(e, -n * .4, -n * .34, n * .8, n * .24, n * .1), U(e, "#ff5a5a", i), e.fillStyle = z, e.font = `900 ${n * .32}px sans-serif`, e.textAlign = "center", e.textBaseline = "middle", e.fillText("✓", 0, n * .14);
				return;
			case "lock":
				e.beginPath(), e.arc(0, -n * .08, n * .2, Math.PI, 0), e.lineWidth = n * .1 + i * 2, e.strokeStyle = z, e.stroke(), e.lineWidth = n * .1, e.strokeStyle = "#c9d2e3", e.stroke(), B(e, -n * .3, -n * .1, n * .6, n * .46, n * .08), U(e, "#ffcf3a", i), V(e, 0, n * .1, n * .07), e.fillStyle = z, e.fill();
				return;
			case "power":
				e.beginPath(), e.moveTo(0, -n * .46), e.lineTo(n * .38, -n * .3), e.lineTo(n * .34, n * .12), e.quadraticCurveTo(n * .2, n * .36, 0, n * .46), e.quadraticCurveTo(-n * .2, n * .36, -n * .34, n * .12), e.lineTo(-n * .38, -n * .3), e.closePath(), U(e, "#ff5a5a", i), ci(e, 0, 0, n * .6), e.fillStyle = "#ffe14a", e.fill();
				return;
			case "star":
				si(e, 0, 0, n * .46), U(e, "#ffd23f", i);
				return;
			case "vault":
				B(e, -n * .42, -n * .36, n * .84, n * .76, n * .12), U(e, "#6a4bd6", i), V(e, 0, n * .02, n * .24), U(e, "#ffd23f", i), e.strokeStyle = z, e.lineWidth = i;
				for (let t = 0; t < 4; t++) {
					let i = t * Math.PI / 2 + r;
					e.beginPath(), e.moveTo(Math.cos(i) * n * .08, n * .02 + Math.sin(i) * n * .08), e.lineTo(Math.cos(i) * n * .2, n * .02 + Math.sin(i) * n * .2), e.stroke();
				}
				return;
			default: return bi(e, t, n, i);
		}
	}
	var Ci = /* @__PURE__ */ new Map();
	function wi(e, t = 96) {
		let n = `${e}@${t}`, r = Ci.get(n);
		if (r) return r;
		let i = document.createElement("canvas");
		i.width = t, i.height = t;
		let a = i.getContext("2d");
		a.translate(t / 2, t / 2), Si(a, e, t * .86);
		let o = i.toDataURL("image/png");
		return Ci.set(n, o), o;
	}
	var Ti = {
		gold: {
			x: 92,
			dy: 118
		},
		silver: {
			x: 628,
			dy: 118
		}
	}, Ei = "\"PingFang SC\",\"Hiragino Sans GB\",\"Microsoft YaHei\",\"Noto Sans SC\",system-ui,sans-serif";
	function Di(e, t, n, r) {
		let i = document.createElement("canvas");
		i.width = Math.max(1, Math.ceil(e * n)), i.height = Math.max(1, Math.ceil(t * n));
		let a = i.getContext("2d");
		return a.scale(n, n), a.translate(e / 2, t / 2), r(a), i;
	}
	var Oi = class {
		constructor(e, t) {
			i(this, "canvas"), i(this, "ctx"), i(this, "b"), i(this, "scale", 1), i(this, "dpr", 1), i(this, "bg", null), i(this, "spr", /* @__PURE__ */ new Map()), i(this, "parts", []), i(this, "texts", []), i(this, "flies", []), i(this, "arcs", []), i(this, "booms", []), i(this, "muzzles", []), i(this, "shake", 0), i(this, "flash", 0), i(this, "iceFlash", 0), i(this, "time", 0), i(this, "hue"), i(this, "onChestLanded"), this.canvas = e, this.ctx = e.getContext("2d"), this.b = t, this.hue = (O[t.setup.chapter - 1] ?? O[0]).hue;
		}
		get W() {
			return this.b.layout.W;
		}
		get H() {
			return this.b.layout.H;
		}
		resize(e, t) {
			this.dpr = Math.min(2, window.devicePixelRatio || 1), this.canvas.width = Math.round(e * this.dpr), this.canvas.height = Math.round(t * this.dpr), this.canvas.style.width = `${e}px`, this.canvas.style.height = `${t}px`, this.scale = e * this.dpr / this.W, this.bg = null, this.spr.clear();
		}
		toWorld(e, t) {
			let n = this.dpr / this.scale;
			return {
				x: e * n,
				y: t * n
			};
		}
		getSprite(e, t, n, r) {
			let i = this.spr.get(e);
			return i || (i = Di(t, n, this.scale, r), this.spr.set(e, i)), i;
		}
		segSprite(e, t, n) {
			let r = this.b.layout.radius;
			if (e === 1 || e === 2) {
				let t = r * 1.05;
				return this.getSprite(`chest${e}`, t * 3.4, t * 3.4, (n) => di(n, 0, 0, t, e === 2));
			}
			let i = t ? r * 1.38 : r * .96, a = n % 3, o = this.hue + (a - 1) * 8;
			return this.getSprite(`v${t ? "h" : "b"}${a}`, i * 2.9, i * 2.9, (e) => ui(e, o, 0, 0, i, t, a));
		}
		projSprite(e, t) {
			let n = `p_${e}${t ? "m" : ""}`, r = t ? .7 : 1;
			switch (e) {
				case "dart": return this.getSprite(n, 40 * r, 40 * r, (e) => {
					e.scale(r, r);
					let t = e.createRadialGradient(0, 0, 2, 0, 0, 18);
					t.addColorStop(0, "rgba(140,250,255,0.9)"), t.addColorStop(1, "rgba(140,250,255,0)"), e.fillStyle = t, e.beginPath(), e.arc(0, 0, 18, 0, Math.PI * 2), e.fill(), e.rotate(Math.PI / 2), e.lineCap = "round", e.lineJoin = "round";
					let n = () => {
						e.beginPath(), e.moveTo(0, 9), e.lineTo(0, 0), e.lineTo(-7, -8), e.moveTo(0, 0), e.lineTo(7, -8);
					};
					n(), e.strokeStyle = z, e.lineWidth = 7.5, e.stroke(), n(), e.strokeStyle = "#e8feff", e.lineWidth = 4, e.stroke();
				});
				case "needle": return this.getSprite(n, 56, 20, (e) => {
					let t = e.createLinearGradient(-26, 0, 26, 0);
					t.addColorStop(0, "rgba(90,200,255,0)"), t.addColorStop(.5, "rgba(90,200,255,0.6)"), t.addColorStop(1, "rgba(255,255,255,1)"), e.fillStyle = t, B(e, -26, -4, 50, 8, 4), e.fill(), e.fillStyle = "#fff", e.beginPath(), e.moveTo(26, 0), e.lineTo(8, -3), e.lineTo(8, 3), e.closePath(), e.fill();
				});
				case "frost": return this.getSprite(n, 40, 24, (e) => {
					e.fillStyle = "rgba(160,230,255,0.35)", B(e, -20, -6, 30, 12, 6), e.fill(), e.beginPath(), e.moveTo(18, 0), e.lineTo(2, -8), e.lineTo(-12, 0), e.lineTo(2, 8), e.closePath(), e.fillStyle = "#c9f2ff", e.fill(), e.lineWidth = 2, e.strokeStyle = "#2d7fb3", e.stroke();
				});
				case "homing": return this.getSprite(n, 40, 24, (e) => {
					e.fillStyle = "#ffb13d", e.beginPath(), e.moveTo(-10, -5), e.lineTo(-20, 0), e.lineTo(-10, 5), e.fill(), B(e, -12, -5, 22, 10, 5), e.fillStyle = "#f4f7ff", e.fill(), e.lineWidth = 2, e.strokeStyle = z, e.stroke(), e.beginPath(), e.moveTo(6, -5), e.quadraticCurveTo(16, 0, 6, 5), e.closePath(), e.fillStyle = "#ff4b6a", e.fill(), e.stroke();
				});
				case "boomerang": return this.getSprite(n, 64, 64, (e) => {
					B(e, -26, -9, 52, 18, 9), e.fillStyle = "#f5c79a", e.fill(), e.lineWidth = 3, e.strokeStyle = z, e.stroke(), B(e, -9, -7, 18, 14, 3), e.fillStyle = "#fff1e3", e.fill(), e.lineWidth = 2, e.stroke();
				});
				default: return this.getSprite(n, 30, 30, (e) => {
					e.fillStyle = "#fff", e.beginPath(), e.arc(0, 0, 8, 0, Math.PI * 2), e.fill();
				});
			}
		}
		buildBg() {
			let { W: e, H: t, mode: n, path: r, hero: i, lineY: a, radius: o } = this.b.layout, s = document.createElement("canvas");
			s.width = Math.ceil(e * this.scale), s.height = Math.ceil(t * this.scale);
			let c = s.getContext("2d");
			c.scale(this.scale, this.scale);
			let l = (this.hue + 190) % 360;
			if (n === "line") {
				let e = c.createLinearGradient(0, 0, 0, t);
				e.addColorStop(0, W(l, 42, 30)), e.addColorStop(1, W(l, 48, 16)), c.fillStyle = e;
			} else {
				let n = c.createRadialGradient(e / 2, this.b.layout.cy, 40, e / 2, this.b.layout.cy, t * .7);
				n.addColorStop(0, W(l, 45, 32)), n.addColorStop(1, W(l, 52, 13)), c.fillStyle = n;
			}
			c.fillRect(0, 0, e, t);
			let u = 7 + this.b.setup.chapter * 13, d = () => (u = u * 16807 % 2147483647, u / 2147483647);
			for (let n = 0; n < 46; n++) {
				let n = d() * e, r = d() * t, i = 14 + d() * 48;
				c.beginPath(), c.arc(n, r, i, 0, Math.PI * 2), c.fillStyle = W(l, 45, 40, .25), c.fill(), c.lineWidth = 3, c.strokeStyle = W(l, 50, 55, .22), c.stroke(), c.beginPath(), c.arc(n + i * .25, r - i * .1, i * .28, 0, Math.PI * 2), c.fillStyle = W(l, 50, 60, .18), c.fill();
			}
			if (n === "ring") {
				c.strokeStyle = W(l, 50, 50, .1), c.lineWidth = 2;
				for (let n = 120; n < t; n += 110) c.beginPath(), c.arc(e / 2, this.b.layout.cy, n, 0, Math.PI * 2), c.stroke();
			}
			let f = () => {
				c.beginPath();
				for (let e = 0; e <= r.length; e += 8) {
					let t = r.at(e);
					e === 0 ? c.moveTo(t.x, t.y) : c.lineTo(t.x, t.y);
				}
				let e = r.at(r.length);
				c.lineTo(e.x, e.y);
			};
			if (c.lineCap = "round", c.lineJoin = "round", f(), c.lineWidth = o * 2 + 24, c.strokeStyle = "rgba(10,0,20,0.35)", c.stroke(), f(), c.lineWidth = o * 2 + 10, c.strokeStyle = W(l, 30, 22, .9), c.stroke(), f(), c.lineWidth = o * 2 - 4, c.strokeStyle = W(l, 32, 27, .9), c.stroke(), f(), c.setLineDash([6, 16]), c.lineWidth = 3, c.strokeStyle = W(l, 60, 70, .14), c.stroke(), c.setLineDash([]), n === "line") {
				let t = c.createLinearGradient(0, a - 18, 0, a + 18);
				t.addColorStop(0, "rgba(90,240,255,0)"), t.addColorStop(.5, "rgba(90,240,255,0.35)"), t.addColorStop(1, "rgba(90,240,255,0)"), c.fillStyle = t, c.fillRect(0, a - 18, e, 36), c.strokeStyle = "rgba(160,250,255,0.8)", c.lineWidth = 3, c.setLineDash([22, 12]), c.beginPath(), c.moveTo(0, a), c.lineTo(e, a), c.stroke(), c.setLineDash([]);
				for (let t = 30; t < e; t += 110) B(c, t - 7, a - 16, 14, 32, 5), c.fillStyle = "#3a5a7a", c.fill(), c.lineWidth = 3, c.strokeStyle = z, c.stroke(), c.fillStyle = "#8ff7ff", c.beginPath(), c.arc(t, a - 10, 4, 0, Math.PI * 2), c.fill();
			}
			let p = c.createRadialGradient(i.x, i.y + 20, 10, i.x, i.y + 20, 90);
			return p.addColorStop(0, "rgba(120,255,230,0.35)"), p.addColorStop(1, "rgba(120,255,230,0)"), c.fillStyle = p, c.beginPath(), c.ellipse(i.x, i.y + 24, 90, 40, 0, 0, Math.PI * 2), c.fill(), c.strokeStyle = "rgba(160,255,235,0.55)", c.lineWidth = 3, c.beginPath(), c.ellipse(i.x, i.y + 26, 58, 22, 0, 0, Math.PI * 2), c.stroke(), s;
		}
		consumeFx() {
			let e = this.b;
			for (let t of e.fx) switch (t.t) {
				case "hit":
					if (this.texts.length > 70 && !t.crit) break;
					this.texts.push({
						x: t.x + (Math.random() - .5) * 18,
						y: t.y - 10,
						vy: -70 - Math.random() * 30,
						text: A(t.dmg),
						life: t.crit ? .8 : .55,
						max: t.crit ? .8 : .55,
						size: t.crit ? 34 : 22,
						color: t.crit ? "#ffd23f" : "#ffffff"
					});
					break;
				case "kill": {
					let e = t.big ? 18 : 10, n = t.kind === 2 ? "#ffd23f" : t.kind === 1 ? "#dfe8ff" : W(this.hue, 80, 62);
					for (let r = 0; r < e; r++) {
						let e = Math.random() * Math.PI * 2, r = 90 + Math.random() * (t.big ? 320 : 220);
						this.parts.push({
							x: t.x,
							y: t.y,
							vx: Math.cos(e) * r,
							vy: Math.sin(e) * r,
							life: .55,
							max: .55,
							r: 4 + Math.random() * 6,
							color: n,
							kind: +!!t.kind,
							drag: 3
						});
					}
					this.parts.push({
						x: t.x,
						y: t.y,
						vx: 0,
						vy: 0,
						life: .3,
						max: .3,
						r: t.r * (t.big ? 2.2 : 1.6),
						color: "#ffffff",
						kind: 3,
						drag: 0
					}), t.big && (this.shake = Math.max(this.shake, 5));
					break;
				}
				case "chest": {
					let e = t.kind === 2 ? Ti.gold : Ti.silver;
					this.flies.push({
						x: t.x,
						y: t.y,
						tx: e.x,
						ty: this.H - e.dy,
						t: 0,
						kind: t.kind
					});
					break;
				}
				case "boom":
					this.booms.push({
						x: t.x,
						y: t.y,
						r: t.r,
						t: 0,
						color: t.color
					});
					for (let e = 0; e < 8; e++) {
						let e = Math.random() * Math.PI * 2, n = 60 + Math.random() * 140;
						this.parts.push({
							x: t.x,
							y: t.y,
							vx: Math.cos(e) * n,
							vy: Math.sin(e) * n,
							life: .45,
							max: .45,
							r: 5 + Math.random() * 5,
							color: t.color,
							kind: 2,
							drag: 2
						});
					}
					break;
				case "arc":
					this.arcs.push({
						pts: t.pts,
						t: .2
					});
					break;
				case "muzzle":
					this.muzzles.length < 8 && this.muzzles.push({
						x: t.x,
						y: t.y,
						t: .08
					});
					break;
				case "knock":
					this.flash = .35, this.parts.push({
						x: this.b.layout.hero.x,
						y: this.b.layout.hero.y,
						vx: 0,
						vy: 0,
						life: .5,
						max: .5,
						r: 700,
						color: "#bff6ff",
						kind: 3,
						drag: 0
					});
					break;
				case "freeze": this.iceFlash = .4;
			}
			e.fx.length = 0;
		}
		frame(e) {
			let t = this.b;
			this.time += e, this.consumeFx();
			let n = this.ctx, { W: r, H: i } = this;
			n.setTransform(1, 0, 0, 1, 0, 0), this.bg ||= this.buildBg();
			let a = 0, o = 0;
			this.shake > 0 && (this.shake = Math.max(0, this.shake - e * 30), a = (Math.random() - .5) * this.shake * this.scale, o = (Math.random() - .5) * this.shake * this.scale), n.drawImage(this.bg, a, o), n.setTransform(this.scale, 0, 0, this.scale, a, o), this.drawZones(), this.drawChain(), this.drawPulses(), this.drawSlashes(), this.drawBeams(), this.drawHero(), this.drawOrbits(), this.drawProjs(), this.drawLobs(), this.updateParticles(e), this.drawArcs(e), this.drawBooms(e), this.drawMuzzles(e), this.drawFlies(e), this.drawTexts(e), this.drawFocus(), (t.freezeT > 0 || this.iceFlash > 0) && (this.iceFlash = Math.max(0, this.iceFlash - e), n.fillStyle = `rgba(150,220,255,${.08 + this.iceFlash * .5})`, n.fillRect(0, 0, r, i)), this.flash > 0 && (this.flash = Math.max(0, this.flash - e), n.fillStyle = `rgba(255,255,255,${this.flash})`, n.fillRect(0, 0, r, i));
			let s = t.danger;
			if (t.state === "play" && s < 800) {
				let e = (1 - s / 800) * (.45 + .2 * Math.sin(this.time * 9)), t = n.createRadialGradient(r / 2, i / 2, i * .3, r / 2, i / 2, i * .75);
				t.addColorStop(0, "rgba(255,0,40,0)"), t.addColorStop(1, `rgba(255,20,60,${e})`), n.fillStyle = t, n.fillRect(0, 0, r, i);
			}
		}
		drawChain() {
			let e = this.ctx, t = this.b, n = t.segs, r = t.layout.radius, i = this.time, a = t.freezeT > 0, o = -1;
			for (let t = n.length - 1; t >= 0; t--) {
				let s = n[t];
				if (s.d < -r * 2 || s.y < -60 || s.x < -60 || s.x > this.W + 60) continue;
				let c = t === 0 && s.kind === 0, l = this.segSprite(s.kind, c, s.idx), u = l.width / this.scale, d = l.height / this.scale, f = 1 + Math.sin(i * 6 + s.id * 1.7) * .04;
				e.save(), e.translate(s.x, s.y), s.kind === 0 && e.rotate(Math.sin(i * 1.6 + s.id) * (c ? .08 : .25)), e.scale(f, f), e.drawImage(l, -u / 2, -d / 2, u, d), s.flash > 0 && (e.globalAlpha = Math.min(1, s.flash / .07) * .55, e.fillStyle = "#fff", e.beginPath(), e.arc(0, 0, c ? r * 1.38 : r, 0, Math.PI * 2), e.fill(), e.globalAlpha = 1), a && (e.fillStyle = "rgba(180,235,255,0.45)", e.beginPath(), e.arc(0, 0, c ? r * 1.38 : r, 0, Math.PI * 2), e.fill()), e.restore();
				let p = A(Math.max(1, s.hp)), m = Math.round((c ? r * .95 : r * .82) * (p.length > 4 ? .78 : p.length > 3 ? .9 : 1));
				m !== o && (e.font = `900 ${m}px ${Ei}`, o = m), e.textAlign = "center", e.textBaseline = "middle";
				let h = s.kind ? s.y + r * 1.15 : c ? s.y + r * .62 : s.y + 1;
				e.lineWidth = m * .28, e.lineJoin = "round", e.strokeStyle = "rgba(30,10,40,0.9)", e.strokeText(p, s.x, h), e.fillStyle = "#fff", e.fillText(p, s.x, h);
			}
		}
		drawHero() {
			let e = this.b, t = k[e.setup.hero] ?? k.amian, n = e.pickTarget(), r = e.layout.hero, i = n ? Math.atan2(n.y - r.y, n.x - r.x) : -Math.PI / 2;
			li(this.ctx, t, r.x, r.y, 38, {
				t: this.time,
				kick: e.heroKick,
				look: i
			});
		}
		drawOrbits() {
			let e = this.ctx, t = this.b.layout.hero;
			for (let n of this.b.weapons) {
				if (n.id !== "orbit") continue;
				let r = n.count + (n.awakened ? 2 : 0), i = n.aux || 120;
				e.strokeStyle = "rgba(255,255,255,0.12)", e.lineWidth = 2, e.beginPath(), e.arc(t.x, t.y, i, 0, Math.PI * 2), e.stroke();
				for (let a = 0; a < r; a++) {
					let o = n.phase + a * Math.PI * 2 / r, s = t.x + Math.cos(o) * i, c = t.y + Math.sin(o) * i;
					e.save(), e.translate(s, c), e.rotate(o + Math.PI / 2);
					let l = a % 2 ? "#3fd0ff" : "#ff5f7a";
					B(e, -20, -10, 40, 20, 10), e.fillStyle = "#fff", e.fill(), e.save(), e.beginPath(), e.rect(-20, -10, 20, 20), e.clip(), B(e, -20, -10, 40, 20, 10), e.fillStyle = l, e.fill(), e.restore(), B(e, -20, -10, 40, 20, 10), e.lineWidth = 3, e.strokeStyle = z, e.stroke(), e.fillStyle = "rgba(255,255,255,0.6)", B(e, -14, -6, 22, 4, 2), e.fill(), e.restore();
				}
			}
		}
		drawBeams() {
			let e = this.ctx, t = this.b, n = t.layout.hero;
			for (let r of t.weapons) {
				if (r.id === "spray" && r.beamT > 0) {
					let e = r.beamAng[0], i = t.areaOf(r), a = (r.awakened ? 42 : 27) * Math.PI / 180;
					for (let t = 0; t < 3; t++) {
						let t = e + (Math.random() - .5) * 2 * a, o = i * (1.6 + Math.random() * .8);
						this.parts.push({
							x: n.x + Math.cos(e) * 26,
							y: n.y + Math.sin(e) * 26,
							vx: Math.cos(t) * o,
							vy: Math.sin(t) * o,
							life: .42,
							max: .42,
							r: 8 + Math.random() * 8,
							color: r.awakened ? "#bff3ff" : "#c8ffd6",
							kind: 2,
							drag: 1.5
						});
					}
				}
				if (r.id !== "beam" || r.beamT <= 0) continue;
				let i = t.areaOf(r), a = .85 + Math.random() * .3;
				for (let t of r.beamAng) {
					let r = n.x + Math.cos(t) * 1800, o = n.y + Math.sin(t) * 1800;
					e.lineCap = "round", e.strokeStyle = `rgba(170,90,255,${.35 * a})`, e.lineWidth = i * 1.9, e.beginPath(), e.moveTo(n.x, n.y), e.lineTo(r, o), e.stroke(), e.strokeStyle = `rgba(215,170,255,${.8 * a})`, e.lineWidth = i, e.stroke(), e.strokeStyle = "rgba(255,255,255,0.95)", e.lineWidth = i * .35, e.stroke();
				}
			}
		}
		drawPulses() {
			let e = this.ctx;
			for (let t of this.b.pulses) {
				if (t.delay > 0) continue;
				let n = t.r / t.maxR;
				e.strokeStyle = `rgba(255,150,230,${.9 * (1 - n)})`, e.lineWidth = 16 * (1 - n) + 4, e.beginPath(), e.arc(t.x, t.y, t.r, 0, Math.PI * 2), e.stroke(), e.strokeStyle = `rgba(255,255,255,${.9 * (1 - n)})`, e.lineWidth = 3, e.stroke();
			}
		}
		drawSlashes() {
			let e = this.ctx;
			for (let t of this.b.slashes) {
				let n = t.t / .28, r = 1 - n, i = t.ang - t.half, a = i + t.half * 2 * Math.min(1, r * 1.6);
				e.save(), e.globalAlpha = Math.min(1, n * 2), e.beginPath(), e.arc(t.x, t.y, t.r, i, a), e.arc(t.x, t.y, t.r * .72, a, i, !0), e.closePath();
				let o = e.createRadialGradient(t.x, t.y, t.r * .7, t.x, t.y, t.r);
				o.addColorStop(0, "rgba(120,255,190,0)"), o.addColorStop(.7, "rgba(140,255,200,0.75)"), o.addColorStop(1, "rgba(240,255,250,0.95)"), e.fillStyle = o, e.fill(), e.restore();
			}
		}
		drawZones() {
			let e = this.ctx;
			for (let t of this.b.zones) {
				e.fillStyle = `rgba(255,180,60,${.16 + .05 * Math.sin(this.time * 12)})`, e.beginPath(), e.arc(t.x, t.y, t.r, 0, Math.PI * 2), e.fill(), e.fillStyle = "rgba(255,240,200,0.7)";
				for (let n = 0; n < 5; n++) {
					let r = this.time * 2 + n * 1.3, i = t.r * ((this.time * .8 + n * .37) % 1) * .9;
					e.beginPath(), e.arc(t.x + Math.cos(r) * i, t.y + Math.sin(r) * i, 4, 0, Math.PI * 2), e.fill();
				}
			}
		}
		drawProjs() {
			let e = this.ctx;
			for (let t of this.b.projs) {
				let n = this.projSprite(t.kind, !!t.mini), r = n.width / this.scale, i = n.height / this.scale;
				if (e.save(), e.translate(t.x, t.y), t.kind === "boomerang") {
					let n = t.r / 18;
					e.scale(n, n), e.rotate(t.spin);
				} else e.rotate(Math.atan2(t.vy, t.vx));
				e.drawImage(n, -r / 2, -i / 2, r, i), e.restore(), t.kind === "homing" && Math.random() < .5 && this.parts.push({
					x: t.x,
					y: t.y,
					vx: -t.vx * .1,
					vy: -t.vy * .1,
					life: .3,
					max: .3,
					r: 4,
					color: "#ffc46b",
					kind: 2,
					drag: 2
				});
			}
		}
		drawLobs() {
			let e = this.ctx;
			for (let t of this.b.lobs) {
				let n = Math.min(1, t.t / t.T), r = t.sx + (t.tx - t.sx) * n, i = t.sy + (t.ty - t.sy) * n, a = Math.sin(n * Math.PI) * 140;
				e.fillStyle = "rgba(0,0,0,0.25)", e.beginPath(), e.ellipse(r, i, 14, 6, 0, 0, Math.PI * 2), e.fill(), e.save(), e.translate(r, i - a), e.rotate(n * 8), e.beginPath(), e.arc(0, 0, 15, 0, Math.PI * 2), e.fillStyle = "#ff9f2e", e.fill(), e.lineWidth = 3, e.strokeStyle = z, e.stroke(), e.strokeStyle = "rgba(255,255,255,0.85)", e.lineWidth = 2.5, e.beginPath(), e.arc(0, 0, 8, 0, Math.PI * 2), e.moveTo(-15, 0), e.lineTo(15, 0), e.stroke(), e.restore();
			}
		}
		updateParticles(e) {
			let t = this.ctx;
			this.parts.length > 500 && this.parts.splice(0, this.parts.length - 500);
			for (let n = this.parts.length - 1; n >= 0; n--) {
				let r = this.parts[n];
				if (r.life -= e, r.life <= 0) {
					this.parts.splice(n, 1);
					continue;
				}
				let i = r.life / r.max;
				r.x += r.vx * e, r.y += r.vy * e;
				let a = Math.max(0, 1 - r.drag * e);
				if (r.vx *= a, r.vy *= a, r.kind === 3) {
					let e = r.r * (1 - i) + 6;
					t.strokeStyle = r.color, t.globalAlpha = i * .8, t.lineWidth = 6 * i + 2, t.beginPath(), t.arc(r.x, r.y, e, 0, Math.PI * 2), t.stroke(), t.globalAlpha = 1;
					continue;
				}
				if (t.globalAlpha = r.kind === 2 ? i * .5 : Math.min(1, i * 1.6), t.fillStyle = r.color, r.kind === 1) {
					let e = r.r * (.6 + i * .6);
					t.beginPath();
					for (let n = 0; n < 8; n++) {
						let i = n * Math.PI / 4 + r.life * 6, a = n % 2 ? e * .4 : e, o = r.x + Math.cos(i) * a, s = r.y + Math.sin(i) * a;
						n === 0 ? t.moveTo(o, s) : t.lineTo(o, s);
					}
					t.closePath(), t.fill();
				} else t.beginPath(), t.arc(r.x, r.y, r.kind === 2 ? r.r * (1.6 - i * .6) : r.r * (.5 + i * .5), 0, Math.PI * 2), t.fill();
				t.globalAlpha = 1;
			}
		}
		drawArcs(e) {
			let t = this.ctx;
			for (let n = this.arcs.length - 1; n >= 0; n--) {
				let r = this.arcs[n];
				if (r.t -= e, r.t <= 0) {
					this.arcs.splice(n, 1);
					continue;
				}
				let i = [];
				for (let e = 0; e < r.pts.length - 1; e++) {
					let t = r.pts[e], n = r.pts[e + 1];
					for (let e = 0; e < 5; e++) {
						let r = e / 5, a = e === 0 ? 0 : 14;
						i.push({
							x: t.x + (n.x - t.x) * r + (Math.random() - .5) * a,
							y: t.y + (n.y - t.y) * r + (Math.random() - .5) * a
						});
					}
				}
				i.push(r.pts[r.pts.length - 1]);
				let a = r.t / .2;
				for (let [e, n] of [[12, `rgba(255,230,80,${.35 * a})`], [5, `rgba(255,250,200,${a})`]]) t.strokeStyle = n, t.lineWidth = e, t.lineJoin = "round", t.beginPath(), i.forEach((e, n) => n ? t.lineTo(e.x, e.y) : t.moveTo(e.x, e.y)), t.stroke();
			}
		}
		drawBooms(e) {
			let t = this.ctx;
			for (let n = this.booms.length - 1; n >= 0; n--) {
				let r = this.booms[n];
				r.t += e;
				let i = r.t / .35;
				if (i >= 1) {
					this.booms.splice(n, 1);
					continue;
				}
				t.globalAlpha = 1 - i;
				let a = t.createRadialGradient(r.x, r.y, 0, r.x, r.y, r.r * (.6 + i * .5));
				a.addColorStop(0, "rgba(255,255,255,0.9)"), a.addColorStop(.5, r.color), a.addColorStop(1, "rgba(255,255,255,0)"), t.fillStyle = a, t.beginPath(), t.arc(r.x, r.y, r.r * (.6 + i * .5), 0, Math.PI * 2), t.fill(), t.globalAlpha = 1;
			}
		}
		drawMuzzles(e) {
			let t = this.ctx;
			for (let n = this.muzzles.length - 1; n >= 0; n--) {
				let r = this.muzzles[n];
				if (r.t -= e, r.t <= 0) {
					this.muzzles.splice(n, 1);
					continue;
				}
				t.fillStyle = `rgba(255,255,220,${r.t / .08})`, t.beginPath(), t.arc(r.x, r.y, 12, 0, Math.PI * 2), t.fill();
			}
		}
		drawFlies(e) {
			let t = this.ctx;
			for (let n = this.flies.length - 1; n >= 0; n--) {
				let r = this.flies[n];
				if (r.t += e / .7, r.t >= 1) {
					this.flies.splice(n, 1), this.onChestLanded?.(r.kind);
					continue;
				}
				let i = r.t * r.t * (3 - 2 * r.t);
				di(t, r.x + (r.tx - r.x) * i, r.y + (r.ty - r.y) * i - Math.sin(r.t * Math.PI) * 120, 22 + Math.sin(r.t * Math.PI) * 10, r.kind === 2);
			}
		}
		drawTexts(e) {
			let t = this.ctx;
			t.textAlign = "center", t.textBaseline = "middle", t.lineJoin = "round";
			for (let n = this.texts.length - 1; n >= 0; n--) {
				let r = this.texts[n];
				if (r.life -= e, r.life <= 0) {
					this.texts.splice(n, 1);
					continue;
				}
				r.y += r.vy * e, r.vy *= 1 - e * 3;
				let i = r.max - r.life, a = i < .1 ? 1.5 - i * 5 : 1, o = r.size * a;
				t.globalAlpha = Math.min(1, r.life / (r.max * .4)), t.font = `900 ${o}px ${Ei}`, t.lineWidth = o * .22, t.strokeStyle = "rgba(40,10,40,0.95)", t.strokeText(r.text, r.x, r.y), t.fillStyle = r.color, t.fillText(r.text, r.x, r.y), t.globalAlpha = 1;
			}
		}
		drawFocus() {
			let e = this.b.focus;
			if (!e || !e.alive) return;
			let t = this.ctx, n = this.b.layout.radius * 1.7;
			t.save(), t.translate(e.x, e.y), t.rotate(this.time * 2), t.strokeStyle = "#ff3b5c", t.lineWidth = 4, t.setLineDash([10, 8]), t.beginPath(), t.arc(0, 0, n, 0, Math.PI * 2), t.stroke(), t.setLineDash([]);
			for (let e = 0; e < 4; e++) t.rotate(Math.PI / 2), t.beginPath(), t.moveTo(n + 2, 0), t.lineTo(n + 14, -7), t.lineTo(n + 14, 7), t.closePath(), t.fillStyle = "#ff3b5c", t.fill();
			t.restore();
		}
	}, ki = Symbol.for("preact-signals");
	function Ai() {
		if (Fi > 1) Fi--;
		else {
			var e, t = !1;
			for ((function() {
				var e = zi;
				for (zi = void 0; e !== void 0;) {
					var t = e.S;
					if (t.v === e.v) for (var n = t.t; n !== void 0; n = n.x) n.i === e.i && (n.i = t.i);
					e = e.o;
				}
			})(); Pi !== void 0;) {
				var n = Pi;
				for (Pi = void 0, Ii++; n !== void 0;) {
					var r = n.u;
					if (n.u = void 0, n.f &= -3, !(8 & n.f) && Ui(n)) try {
						n.c();
					} catch (n) {
						t ||= (e = n, !0);
					}
					n = r;
				}
			}
			if (Ii = 0, Fi--, t) throw e;
		}
	}
	function ji(e) {
		if (Fi > 0) return e();
		Ri = ++Li, Fi++;
		try {
			return e();
		} finally {
			Ai();
		}
	}
	var Mi, G = void 0;
	function Ni(e) {
		var t = G, n = Mi;
		G = void 0, Mi = void 0;
		try {
			return e();
		} finally {
			G = t, Mi = n;
		}
	}
	var Pi = void 0, Fi = 0, Ii = 0, Li = 0, Ri = 0, zi = void 0, Bi = 0;
	function Vi(e) {
		if (G !== void 0) {
			var t = e.n;
			if (t === void 0 || t.t !== G) return t = {
				i: 0,
				S: e,
				p: G.s,
				n: void 0,
				t: G,
				e: void 0,
				x: void 0,
				r: t
			}, G.s !== void 0 && (G.s.n = t), G.s = t, e.n = t, 32 & G.f && e.S(t), t;
			if (t.i === -1) return t.i = 0, t.n !== void 0 && (t.n.p = t.p, t.p !== void 0 && (t.p.n = t.n), t.p = G.s, t.n = void 0, G.s.n = t, G.s = t), t;
		}
	}
	function K(e, t) {
		this.v = e, this.i = 0, this.n = void 0, this.t = void 0, this.l = 0, this.W = t?.watched, this.Z = t?.unwatched, this.name = t?.name;
	}
	K.prototype.brand = ki, K.prototype.h = function() {
		return !0;
	}, K.prototype.S = function(e) {
		var t = this, n = this.t;
		n !== e && e.e === void 0 && (e.x = n, this.t = e, n === void 0 ? Ni(function() {
			var e;
			(e = t.W) == null || e.call(t);
		}) : n.e = e);
	}, K.prototype.U = function(e) {
		var t = this;
		if (this.t !== void 0) {
			var n = e.e, r = e.x;
			n !== void 0 && (n.x = r, e.e = void 0), r !== void 0 && (r.e = n, e.x = void 0), e === this.t && (this.t = r, r === void 0 && Ni(function() {
				var e;
				(e = t.Z) == null || e.call(t);
			}));
		}
	}, K.prototype.subscribe = function(e) {
		var t = this;
		return Qi(function() {
			var n = t.value;
			Ni(function() {
				return e(n);
			});
		}, { name: "sub" });
	}, K.prototype.valueOf = function() {
		return this.value;
	}, K.prototype.toString = function() {
		return this.value + "";
	}, K.prototype.toJSON = function() {
		return this.value;
	}, K.prototype.peek = function() {
		var e = this;
		return Ni(function() {
			return e.value;
		});
	}, Object.defineProperty(K.prototype, "value", {
		get: function() {
			var e = Vi(this);
			return e !== void 0 && (e.i = this.i), this.v;
		},
		set: function(e) {
			if (e !== this.v) {
				if (Ii > 100) throw Error("Cycle detected");
				(function(e) {
					Fi !== 0 && Ii === 0 && e.l !== Ri && (e.l = Ri, zi = {
						S: e,
						v: e.v,
						i: e.i,
						o: zi
					});
				})(this), this.v = e, this.i++, Bi++, Fi++;
				try {
					for (var t = this.t; t !== void 0; t = t.x) t.t.N();
				} finally {
					Ai();
				}
			}
		}
	});
	function Hi(e, t) {
		return new K(e, t);
	}
	function Ui(e) {
		for (var t = e.s; t !== void 0; t = t.n) if (t.S.i !== t.i || !t.S.h() || t.S.i !== t.i) return !0;
		return !1;
	}
	function Wi(e) {
		for (var t = e.s; t !== void 0; t = t.n) {
			var n = t.S.n;
			if (n !== void 0 && (t.r = n), t.S.n = t, t.i = -1, t.n === void 0) {
				e.s = t;
				break;
			}
		}
	}
	function Gi(e) {
		for (var t = e.s, n = void 0; t !== void 0;) {
			var r = t.p;
			t.i === -1 ? (t.S.U(t), r !== void 0 && (r.n = t.n), t.n !== void 0 && (t.n.p = r)) : n = t, t.S.n = t.r, t.r !== void 0 && (t.r = void 0), t = r;
		}
		e.s = n;
	}
	function Ki(e, t) {
		K.call(this, void 0, t), this.x = e, this.s = void 0, this.g = Bi - 1, this.f = 4;
	}
	Ki.prototype = new K(), Ki.prototype.h = function() {
		if (this.f &= -3, 1 & this.f) return !1;
		if ((36 & this.f) == 32 || (this.f &= -5, this.g === Bi)) return !0;
		if (this.g = Bi, this.f |= 1, this.i > 0 && !Ui(this)) return this.f &= -2, !0;
		var e = G;
		try {
			Wi(this), G = this;
			var t = this.x();
			(16 & this.f || this.v !== t || this.i === 0) && (this.v = t, this.f &= -17, this.i++);
		} catch (e) {
			this.v = e, this.f |= 16, this.i++;
		}
		return G = e, Gi(this), this.f &= -2, !0;
	}, Ki.prototype.S = function(e) {
		if (this.t === void 0) {
			this.f |= 36;
			for (var t = this.s; t !== void 0; t = t.n) t.S.S(t);
		}
		K.prototype.S.call(this, e);
	}, Ki.prototype.U = function(e) {
		if (this.t !== void 0 && (K.prototype.U.call(this, e), this.t === void 0)) {
			this.f &= -33;
			for (var t = this.s; t !== void 0; t = t.n) t.S.U(t);
		}
	}, Ki.prototype.N = function() {
		if (!(2 & this.f)) {
			this.f |= 6;
			for (var e = this.t; e !== void 0; e = e.x) e.t.N();
		}
	}, Object.defineProperty(Ki.prototype, "value", { get: function() {
		if (1 & this.f) throw Error("Cycle detected");
		var e = Vi(this);
		if (this.h(), e !== void 0 && (e.i = this.i), 16 & this.f) throw this.v;
		return this.v;
	} });
	function qi(e, t) {
		return new Ki(e, t);
	}
	function Ji(e) {
		var t = e.m;
		if (e.m = void 0, typeof t == "function") {
			Fi++;
			var n = G;
			G = void 0;
			try {
				t();
			} catch (t) {
				throw e.f &= -2, e.f |= 8, Yi(e), t;
			} finally {
				G = n, Ai();
			}
		}
	}
	function Yi(e) {
		for (var t = e.s; t !== void 0; t = t.n) t.S.U(t);
		e.x = void 0, e.s = void 0, Ji(e);
	}
	function Xi(e) {
		if (G !== this) throw Error("Out-of-order effect");
		Gi(this), G = e, this.f &= -2, 8 & this.f && Yi(this), Ai();
	}
	function Zi(e, t) {
		this.x = e, this.m = void 0, this.s = void 0, this.u = void 0, this.f = 32, this.name = t?.name, Mi && Mi.push(this);
	}
	Zi.prototype.c = function() {
		var e = this.S();
		try {
			if (8 & this.f || this.x === void 0) return;
			var t = this.x();
			typeof t == "function" && (this.m = t);
		} finally {
			e();
		}
	}, Zi.prototype.S = function() {
		if (1 & this.f) throw Error("Cycle detected");
		this.f |= 1, this.f &= -9, Ji(this), Wi(this), Fi++;
		var e = G;
		return G = this, Xi.bind(this, e);
	}, Zi.prototype.N = function() {
		2 & this.f || (this.f |= 2, this.u = Pi, Pi = this);
	}, Zi.prototype.d = function() {
		this.f |= 8, 1 & this.f || Yi(this);
	}, Zi.prototype.dispose = function() {
		this.d();
	};
	function Qi(e, t) {
		var n = new Zi(e, t);
		try {
			n.c();
		} catch (e) {
			throw n.d(), e;
		}
		var r = n.d.bind(n);
		return r[Symbol.dispose] = r, r;
	}
	var $i, ea, ta = typeof window < "u" && !!window.__PREACT_SIGNALS_DEVTOOLS__, na = [];
	Qi(function() {
		$i = this.N;
	})();
	function ra(e, t) {
		o[e] = t.bind(null, o[e] || function() {});
	}
	function ia(e) {
		if (ea) {
			var t = ea;
			ea = void 0, t();
		}
		ea = e && e.S();
	}
	function aa(e) {
		var t = this, n = e.data, r = sa(n);
		r.name = "ReactiveDom", r.value = n;
		var i = yr(function() {
			for (var e = t, n = t.__v; n = n.__;) if (n.__c) {
				n.__c.__$f |= 4;
				break;
			}
			var i = qi(function() {
				var e = r.value.value;
				return e === 0 ? 0 : e === !0 ? "" : e || "";
			}), a = qi(function() {
				return !Array.isArray(i.value) && !c(i.value);
			}), o = Qi(function() {
				if (this.N = ua, a.value) {
					var t = i.value;
					e.__v && e.__v.__e && e.__v.__e.nodeType === 3 && (e.__v.__e.data = t);
				}
			}), s = t.__$u.d;
			return t.__$u.d = function() {
				o(), s.call(this);
			}, [a, i];
		}, []), a = i[0], o = i[1];
		return a.value ? o.peek() : o.value;
	}
	aa.displayName = "ReactiveTextNode", Object.defineProperties(K.prototype, {
		constructor: {
			configurable: !0,
			value: void 0
		},
		type: {
			configurable: !0,
			value: aa
		},
		props: {
			configurable: !0,
			get: function() {
				var e = this;
				return { data: { get value() {
					return e.value;
				} } };
			}
		},
		__b: {
			configurable: !0,
			value: 1
		}
	}), ra("__b", function(e, t) {
		if (ia(), typeof t.type == "string") {
			var n, r = t.props;
			for (var i in r) if (i !== "children") {
				var a = r[i];
				a instanceof K && (n || (t.__np = n = {}), n[i] = a, r[i] = a.peek());
			}
		}
		e(t);
	}), ra("__r", function(e, t) {
		if (e(t), t.type !== ve) {
			ia();
			var n, r = t.__c;
			r && (r.__$f &= -2, (n = r.__$u) === void 0 && (r.__$u = n = (function(e, t) {
				var n;
				return Qi(function() {
					n = this;
				}, { name: t }), n.c = e, n;
			})((function(e) {
				return function() {
					var t;
					ta && ((t = this.y) == null || t.call(this)), e.__$f |= 1, e.setState({});
				};
			})(r), typeof t.type == "function" ? t.type.displayName || t.type.name : ""))), ia(n);
		}
	}), ra("__e", function(e, t, n, r) {
		ia(), e(t, n, r);
	}), ra("diffed", function(e, t) {
		ia();
		var n;
		if (typeof t.type == "string" && (n = t.__e)) {
			var r = t.__np, i = t.props, a = n.U;
			if (a) for (var o in a) {
				var s = a[o];
				s === void 0 || r && o in r || (s.d(), a[o] = void 0);
			}
			if (r) for (var c in a || (a = {}, n.U = a), r) {
				var l = a[c], u = r[c];
				l === void 0 ? (l = oa(n, c, u, i), a[c] = l) : l.o(u, i);
			}
		}
		e(t);
	});
	function oa(e, t, n, r) {
		var i = t in e && e.ownerSVGElement === void 0, a = Hi(n);
		return {
			o: function(e, t) {
				a.value = e, r = t;
			},
			d: Qi(function() {
				this.N = ua;
				var n = a.value.value;
				r[t] !== n && (r[t] = n, i ? e[t] = n : n != null && (n !== !1 || t[4] === "-") ? e.setAttribute(t, n) : e.removeAttribute(t));
			})
		};
	}
	ra("unmount", function(e, t) {
		if (typeof t.type == "string") {
			var n = t.__e;
			if (n) {
				var r = n.U;
				if (r) for (var i in n.U = void 0, r) {
					var a = r[i];
					a && a.d();
				}
			}
			var o = t.__np;
			if (o) {
				var s = t.props;
				for (var c in o) s[c] = o[c];
			}
			t.__np = void 0;
		} else {
			var l = t.__c;
			if (l) {
				var u = l.__$u;
				u && (l.__$u = void 0, u.d());
			}
		}
		e(t);
	}), ra("__h", function(e, t, n, r) {
		r < 3 && (t.__$f |= 2), e(t, n, r);
	}), ye.prototype.shouldComponentUpdate = function(e, t) {
		if (this.__R) return !0;
		var n = this.__$u, r = n && n.s !== void 0;
		for (var i in t) return !0;
		if (this.__f || typeof this.u == "boolean" && this.u === !0) {
			var a = 2 & this.__$f;
			if (!(r || a || 4 & this.__$f) || 1 & this.__$f) return !0;
		} else if (!(r || 4 & this.__$f) || 3 & this.__$f) return !0;
		for (var o in e) if (o !== "__source" && e[o] !== this.props[o]) return !0;
		for (var s in this.props) if (!(s in e)) return !0;
		return !1;
	};
	function sa(e, t) {
		return yr(function() {
			return Hi(e, t);
		}, []);
	}
	var ca = function(e) {
		queueMicrotask(function() {
			queueMicrotask(e);
		});
	};
	function la() {
		ji(function() {
			for (var e; e = na.shift();) $i.call(e);
		});
	}
	function ua() {
		na.push(this) === 1 && (o.requestAnimationFrame || ca)(la);
	}
	var da = Hi(0), fa = Hi(0);
	g(() => {
		da.value++, ma.value++;
	});
	var pa = null, ma = Hi(0), ha = Hi("home"), ga = Hi(!1), _a = Hi(null), va = Hi([]), ya = Hi(Date.now());
	function ba(e) {
		pa = e, ma.value++;
	}
	function q() {
		if (!pa) throw Error("meta not loaded");
		return pa;
	}
	function J() {
		return da.value, ma.value, q();
	}
	function Y(e = !1) {
		ma.value++, e ? Cn(q()) : wn(q());
	}
	var xa = 0;
	function X(e) {
		let t = ++xa;
		va.value = [...va.value.slice(-2), {
			id: t,
			text: e
		}], setTimeout(() => {
			va.value = va.value.filter((e) => e.id !== t);
		}, 1800);
	}
	function Sa(e) {
		_a.value = e;
	}
	function Ca() {
		_a.value = null;
	}
	var wa = Hi([]);
	function Ta(e, t, n) {
		wa.value = [...wa.value, {
			title: e,
			reward: t,
			note: n
		}];
	}
	function Ea() {
		return setInterval(() => {
			let e = Date.now();
			if (ya.value = e, pa) {
				let t = pa.stamina, n = pa.daily.day;
				Ft(pa, e), (pa.stamina !== t || pa.daily.day !== n) && Y();
			}
		}, 1e3);
	}
	var Da = 0;
	function Z(e, t, n, r, i, a) {
		if (da.value, t ||= {}, typeof e == "string" || e === ve) {
			"children" in t && (t = {
				...t,
				children: v(t.children)
			});
			for (let e of [
				"title",
				"aria-label",
				"placeholder"
			]) typeof t[e] == "string" && (t[e] = _(t[e]));
			typeof t.class == "string" && /(?:content|modal-body|chapter-list|roster|ov)/.test(t.class) && (t["data-mp-scroll"] = "");
		}
		var s, c, l = t;
		if ("ref" in l) for (c in l = {}, t) c == "ref" ? s = t[c] : l[c] = t[c];
		var u = {
			type: e,
			props: l,
			key: n,
			ref: s,
			__k: null,
			__: null,
			__b: 0,
			__e: null,
			__c: null,
			constructor: void 0,
			__v: --Da,
			__i: -1,
			__u: 0,
			__source: i,
			__self: a
		};
		if (typeof e == "function" && (s = e.defaultProps)) for (c in s) l[c] === void 0 && (l[c] = s[c]);
		return o.vnode && o.vnode(u), u;
	}
	function Q({ id: e, size: t = 1.6, class: n }) {
		return Z("img", {
			class: `ico ${n ?? ""}`,
			src: wi(e, 128),
			style: {
				width: `calc(var(--u) * ${t})`,
				height: `calc(var(--u) * ${t})`
			},
			draggable: !1,
			alt: ""
		});
	}
	function $(e) {
		return Z("button", {
			class: `btn btn-${e.color ?? "yellow"} ${e.small ? "btn-sm" : ""} ${e.big ? "btn-big" : ""} ${e.disabled ? "is-disabled" : ""} ${e.class ?? ""}`,
			style: e.style,
			onClick: (t) => {
				if (t.stopPropagation(), e.disabled) {
					I("click");
					return;
				}
				I("click"), e.onClick?.();
			},
			children: e.children
		});
	}
	function Oa({ show: e, n: t }) {
		return e ? Z("span", {
			class: "dot",
			children: t && t > 1 ? t : ""
		}) : null;
	}
	function ka({ onPlus: e }) {
		let t = J(), n = ya.value;
		return It(t, n), Z("div", {
			class: "resbar",
			children: [Z("div", {
				class: "avatar",
				onClick: () => ha.value = "hero",
				children: [Z(Fa, {
					heroId: (k[t.hero] ?? k.amian).id,
					size: 2.6
				}), Z("div", {
					class: "avatar-pow",
					children: [Z(Q, {
						id: "power",
						size: .9
					}), A(jr(t))]
				})]
			}), Z("div", {
				class: "chips",
				children: [Z("div", {
					class: "chip",
					onClick: () => e?.("gold"),
					children: [
						Z(Q, {
							id: "gold",
							size: 1.25
						}),
						Z("span", { children: A(t.gold) }),
						Z("b", {
							class: "plus",
							children: "+"
						})
					]
				}), Z("div", {
					class: "chip",
					onClick: () => e?.("gems"),
					children: [
						Z(Q, {
							id: "gem",
							size: 1.25
						}),
						Z("span", { children: A(t.gems) }),
						Z("b", {
							class: "plus",
							children: "+"
						})
					]
				})]
			})]
		});
	}
	var Aa = [
		{
			id: "shop",
			label: "商店",
			icon: "gift"
		},
		{
			id: "weapons",
			label: "武器",
			icon: "weapon_needle"
		},
		{
			id: "home",
			label: "战斗",
			icon: "atk"
		},
		{
			id: "hero",
			label: "英雄",
			icon: "hero_amian"
		},
		{
			id: "relics",
			label: "藏品",
			icon: "relic_cup"
		}
	];
	function ja({ dots: e }) {
		let t = ha.value;
		return Z("nav", {
			class: "tabbar",
			children: Aa.map((n) => Z("button", {
				class: `tab ${t === n.id ? "on" : ""} ${n.id === "home" ? "tab-main" : ""}`,
				onClick: () => {
					I("click"), ha.value = n.id;
				},
				children: [
					Z(Q, {
						id: n.icon,
						size: n.id === "home" ? 2.3 : 1.9
					}),
					Z("span", { children: n.label }),
					Z(Oa, { show: !!e[n.id] })
				]
			}, n.id))
		});
	}
	function Ma(e) {
		let t = e.onClose ?? Ca;
		return Z("div", {
			class: "modal-back",
			onClick: () => !e.noClose && t(),
			children: Z("div", {
				class: `modal ${e.class ?? ""}`,
				onClick: (e) => e.stopPropagation(),
				children: [
					e.title && Z("div", {
						class: "modal-title",
						children: e.title
					}),
					!e.noClose && Z("button", {
						class: "modal-x",
						onClick: () => {
							I("click"), t();
						},
						children: "×"
					}),
					Z("div", {
						class: "modal-body",
						children: e.children
					})
				]
			})
		});
	}
	function Na(e) {
		let t = [];
		if (e.gold && t.push({
			icon: "gold",
			label: "金币",
			amount: A(e.gold)
		}), e.gems && t.push({
			icon: "gem",
			label: "钻石",
			amount: A(e.gems)
		}), e.keyGold && t.push({
			icon: "keyGold",
			label: "密宝钥匙",
			amount: String(e.keyGold)
		}), e.keySilver && t.push({
			icon: "keySilver",
			label: "藏品钥匙",
			amount: String(e.keySilver)
		}), e.frags) {
			let n = [
				"绿色碎片",
				"蓝色碎片",
				"紫色碎片",
				"橙色碎片",
				"红色碎片"
			];
			for (let [r, i] of Object.entries(e.frags)) {
				let e = Number(r);
				i && t.push({
					icon: `frag${e}`,
					label: n[e],
					amount: String(i),
					rarity: e
				});
			}
		}
		return e.weapon && t.push({
			icon: `weapon_${e.weapon}`,
			label: D[e.weapon].name,
			amount: "解锁",
			rarity: D[e.weapon].rarity
		}), e.relic && t.push({
			icon: `relic_${e.relic}`,
			label: ct[e.relic].name,
			amount: "+1",
			rarity: ct[e.relic].rarity
		}), e.hero && t.push({
			icon: `hero_${e.hero}`,
			label: k[e.hero].name,
			amount: "英雄",
			rarity: k[e.hero].rarity
		}), t;
	}
	function Pa({ reward: e, small: t }) {
		let n = Na(e);
		return Z("div", {
			class: `rewards ${t ? "rewards-sm" : ""}`,
			children: n.map((e, n) => Z("div", {
				class: "reward",
				style: {
					animationDelay: `${n * .06}s`,
					borderColor: e.rarity === void 0 ? void 0 : E[e.rarity]
				},
				children: [
					Z(Q, {
						id: e.icon,
						size: t ? 1.6 : 2.2
					}),
					Z("b", { children: e.amount }),
					!t && Z("span", { children: e.label })
				]
			}, n))
		});
	}
	function Fa({ heroId: e, size: t, happy: n, silhouette: r, virusHue: i }) {
		let a = vr(null);
		return _r(() => {
			let o = a.current, s = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16, c = Math.min(2, window.devicePixelRatio || 1), l = Math.round(t * s);
			o.width = l * c, o.height = l * c;
			let u = o.getContext("2d"), d = 0, f = performance.now(), p = () => {
				let t = (performance.now() - f) / 1e3;
				u.setTransform(c, 0, 0, c, 0, 0), u.clearRect(0, 0, l, l), i === void 0 ? li(u, k[e] ?? k.amian, l / 2, l * .52, l * .3, {
					t,
					happy: n,
					silhouette: r,
					look: Math.PI / 2
				}) : ui(u, i, l / 2, l / 2 + Math.sin(t * 2) * l * .03, l * .3, !0, 1), d = requestAnimationFrame(p);
			};
			return p(), () => cancelAnimationFrame(d);
		}, [
			e,
			t,
			n,
			r,
			i
		]), Z("canvas", {
			ref: a,
			class: "herocv",
			style: {
				width: `calc(var(--u) * ${t})`,
				height: `calc(var(--u) * ${t})`
			}
		});
	}
	function Ia({ value: e, max: t, color: n, label: r }) {
		return Z("div", {
			class: "bar",
			children: [Z("div", {
				class: "bar-fill",
				style: {
					width: `${(t > 0 ? Math.max(0, Math.min(1, e / t)) : 0) * 100}%`,
					background: n
				}
			}), r !== void 0 && Z("span", {
				class: "bar-label",
				children: r
			})]
		});
	}
	function La(e, t, n, r = "确定") {
		Sa(() => Z(Ma, {
			title: e,
			children: [Z("p", {
				class: "center-text",
				children: t
			}), Z("div", {
				class: "row-btns",
				children: [Z($, {
					color: "gray",
					onClick: Ca,
					children: "取消"
				}), Z($, {
					color: "red",
					onClick: () => {
						Ca(), n();
					},
					children: r
				})]
			})]
		}));
	}
	function Ra(e) {
		return e.t === "glob" ? e.stat : `weapon_${e.weapon}`;
	}
	function za({ c: e, onPick: t, idx: n }) {
		let r = Br(e), i = E[e.rarity];
		return Z("button", {
			class: `card r${e.rarity}`,
			style: {
				animationDelay: `${n * .07}s`,
				"--rc": i
			},
			onClick: t,
			children: [Z("div", {
				class: "card-shape",
				children: Z("div", {
					class: "card-body",
					children: [
						Z("b", {
							class: "card-title",
							children: r.title
						}),
						Z("span", {
							class: "card-desc",
							children: r.desc
						}),
						e.t === "new" && Z("span", {
							class: "card-note",
							children: D[e.weapon].tag
						}),
						e.t === "up" && e.stat === "awaken" && Z("span", {
							class: "card-note",
							children: "超级强化"
						})
					]
				})
			}), Z("div", {
				class: "card-gem",
				children: [Z("div", {
					class: "card-gem-in",
					children: Z(Q, {
						id: Ra(e),
						size: 2.6
					})
				}), Z("em", {
					class: "card-badge",
					children: r.badge
				})]
			})]
		});
	}
	function Ba({ onExit: e }) {
		let t = vr(null), n = vr(null), r = vr(null), i = vr(null), [a, o] = hr({
			pct: 0,
			gold: 0,
			silver: 0,
			danger: !1,
			frozen: !1
		}), [s, c] = hr({ t: "none" }), l = vr(s);
		l.current = s, M === r.current && (yn = () => l.current);
		let [u, d] = hr(1), f = vr(1);
		f.current = u;
		let [p, m] = hr(!0), [, h] = hr(0), [g, _] = hr(null), v = q(), y = jt(v.chapter, v.diff), b = O[v.chapter - 1] ?? O[0], ee = !v.tut.battle, te = vr(vn?.setup?.mode ?? (ee || Math.random() < .5 ? "line" : "ring")).current;
		_r(() => {
			let e = t.current, a = e.clientWidth, s = e.clientHeight, u = Math.round(720 * s / a), p = kr(v), h = new ai({
				chapter: v.chapter,
				diff: v.diff,
				mode: te,
				W: 720,
				H: u,
				seed: Date.now() & 16777215 ^ 1540483477,
				stats: p,
				hero: v.hero,
				loadout: v.loadout,
				fails: v.fails[y] ?? 0,
				tutorial: ee
			});
			if (vn) {
				try {
					let e = ie(vn, ai);
					h = e.battle, c(e.overlay), l.current = e.overlay, d(e.speed), f.current = e.speed;
				} catch {
					X("存档无法读取，已保留原数据");
				}
				vn = null;
			}
			r.current = h, M = h, yn = () => l.current, bn = () => f.current, xn && En();
			let g = performance.now(), _ = new Oi(n.current, h);
			_.resize(a, s), i.current = _, _.onChestLanded = () => {
				!q().tut.chest && l.current.t === "none" && (h.paused = !0, c({ t: "tip-chest" }));
			}, tr("battle");
			let b = 0, ne = performance.now(), re = 0, S = "", ae = !1, oe = !1, C = 0, w = (e) => {
				let t = Math.min(.05, (e - ne) / 1e3);
				ne = e, e - g >= 1e4 && (g = e, l.current.t !== "result" && En());
				let n = h.paused || l.current.t !== "none";
				if (!n && h.state === "play") {
					re += t * f.current;
					let e = 0;
					for (; re >= 1 / 60 && e++ < 8 && (h.step(1 / 60), re -= 1 / 60, h.state === "play"););
					e >= 8 && (re = 0);
				}
				_.frame(n ? 0 : t * Math.min(f.current, 1.5));
				for (let e of h.sfx) I(e);
				h.sfx.length = 0;
				let r = h.danger < 520 && h.state === "play";
				r && !n && (C -= t, C <= 0 && (I("warn"), C = 1.2));
				let i = {
					pct: Math.floor(h.progress * 100),
					gold: h.chests.gold,
					silver: h.chests.silver,
					danger: r,
					frozen: h.freezeT > 0
				}, a = `${i.pct}|${i.gold}|${i.silver}|${i.danger}|${i.frozen}`;
				a !== S && (S = a, o(i)), h.state === "dead" && !ae && (ae = !0, I("lose"), h.revives < 3 ? c({ t: "revive" }) : x(!1)), h.state === "play" && (ae = !1), h.state === "won" && !oe && (oe = !0, setTimeout(() => x(!0), 700)), b = requestAnimationFrame(w);
			};
			b = requestAnimationFrame(w);
			let se = setTimeout(() => m(!1), 2200), ce = setTimeout(() => {
				q().tut.focus || (X("小技巧：点击病毒可以集火攻击它！"), q().tut.focus = !0);
			}, 9e3), le = () => {
				En(), document.hidden && l.current.t === "none" && h.state === "play" && c({ t: "pause" });
			};
			return document.addEventListener("visibilitychange", le), () => {
				M = null, cancelAnimationFrame(b), clearTimeout(se), clearTimeout(ce), document.removeEventListener("visibilitychange", le), tr("menu");
			};
		}, []);
		let x = (e) => {
			let t = r.current, n = q(), i = t.summary(), a = kr(n), o = mn(n, n.chapter, n.diff, {
				won: e,
				progress: i.progress,
				kills: i.kills,
				chests: i.chests
			}, 1 + a.reward, new Dr(Date.now() >>> 0));
			n.tut.battle = !0, n.tut.chest = !0, M = null, Y(!0), e && I("win"), c({
				t: "result",
				won: e,
				settle: o,
				summary: i
			});
		}, ne = (e) => {
			let t = r.current;
			if (!t || t.state !== "play") return;
			let n = t.openChest(e);
			if (!n) {
				X(e === 2 ? "击破金色宝箱获得新武器" : "击破银色宝箱获得强化");
				return;
			}
			q().daily.chests += 1, q().tut.chest = !0, I("open"), _(null), c({
				t: "chest",
				s: n
			}), l.current = {
				t: "chest",
				s: n
			}, Y();
		}, re = (e, t) => {
			g === null && (_(t), I("pick"), setTimeout(() => {
				r.current.apply(e.cards[t]), _(null), c({ t: "none" }), l.current = { t: "none" }, Y();
			}, 260));
		}, S = (e) => {
			let t = r.current, n = q();
			if (t.takeAllUsed >= ti) return X("本局次数已用完");
			if (n.gems < ei) return X("钻石不足");
			n.gems -= ei, t.takeAllUsed += 1;
			for (let n of e.cards) t.apply(n);
			I("up"), c({ t: "none" }), l.current = { t: "none" }, Y();
		}, ae = (e) => {
			let t = r.current, n = q();
			if (e.freeLeft > 0) t.reroll(e, !1);
			else {
				if (e.paidLeft <= 0) return X("刷新次数已用完");
				if (n.gems < $r) return X("钻石不足");
				n.gems -= $r, t.reroll(e, !0), Y();
			}
			I("open"), c({
				t: "chest",
				s: { ...e }
			}), l.current = {
				t: "chest",
				s: { ...e }
			}, Y();
		}, oe = () => {
			let e = r.current, t = q(), n = e.reviveCost();
			if (n !== null) {
				if (t.gems < n) return X("钻石不足");
				t.gems -= n, e.revive(), I("revive"), c({ t: "none" }), l.current = { t: "none" }, Y();
			}
		}, C = (e) => {
			let t = r.current, a = i.current;
			if (!t || !a || l.current.t !== "none") return;
			let o = n.current.getBoundingClientRect(), s = a.toWorld(e.clientX - o.left, e.clientY - o.top), c = t.segAt(s.x, s.y);
			c && (t.setFocus(c), I("click"));
		}, w = r.current, se = w?.layout.H ?? 1280, ce = (e, t) => ({
			left: `${e / 720 * 100}%`,
			bottom: `${t / se * 100}%`
		}), le = 100 - a.pct, T = q();
		return Z("div", {
			class: "battle",
			ref: t,
			children: [
				Z("canvas", {
					ref: n,
					class: "battle-cv",
					onPointerDown: (e) => C(e)
				}),
				Z("div", {
					class: "hud",
					children: [
						Z("button", {
							class: "hud-btn",
							onClick: () => (I("click"), c({ t: "pause" })),
							children: Z("span", { class: "pause-ico" })
						}),
						Z("div", {
							class: "hud-mid",
							children: [Z("div", {
								class: "hud-title",
								children: [
									"第",
									b.id,
									"章 ",
									b.name,
									" · ",
									rt[T.diff].name
								]
							}), Z("div", {
								class: "hud-bar",
								children: [Z("div", {
									class: "hud-fill",
									style: { width: `${a.pct}%` }
								}), Z("span", { children: [a.pct, "%"] })]
							})]
						}),
						Z("button", {
							class: `hud-btn speed ${u > 1 ? "on" : ""}`,
							onClick: () => (I("click"), d(u > 1 ? 1 : 2)),
							children: ["×", u]
						})
					]
				}),
				p && Z("div", {
					class: "mode-banner",
					children: [Z("b", { children: te === "line" ? "阵地战" : "包围战" }), Z("span", { children: te === "line" ? "病毒从上方蜿蜒而下，穿透与直线武器更强！" : "病毒四面合围，近战与范围武器更强！" })]
				}),
				a.danger && Z("div", {
					class: "danger-tag",
					children: "⚠ 病毒逼近！"
				}),
				a.frozen && Z("div", {
					class: "frozen-tag",
					children: "❄ 冻结"
				}),
				Z("button", {
					class: `tray tray-gold ${a.gold ? "has" : ""}`,
					style: ce(Ti.gold.x, Ti.gold.dy),
					onClick: () => ne(2),
					children: [
						Z(Q, {
							id: "chestGold",
							size: 3.6
						}),
						Z("em", { children: a.gold }),
						Z("span", { children: "新武器" })
					]
				}),
				Z("button", {
					class: `tray tray-silver ${a.silver ? "has" : ""}`,
					style: ce(Ti.silver.x, Ti.silver.dy),
					onClick: () => ne(1),
					children: [
						Z(Q, {
							id: "chestSilver",
							size: 3.6
						}),
						Z("em", { children: a.silver }),
						Z("span", { children: "强化" })
					]
				}),
				s.t === "tip-chest" && Z("div", {
					class: "tip-back",
					onClick: () => (r.current.paused = !1, c({ t: "none" }), ne(a.gold ? 2 : 1)),
					children: [Z("div", {
						class: "tip-bubble",
						style: { bottom: `${(Ti.gold.dy + 150) / se * 100}%` },
						children: [
							"宝箱掉落啦！点击宝箱挑选强化",
							Z("br", {}),
							Z("small", { children: "金色宝箱＝新武器，银色宝箱＝强化属性。可以先攒着，等拿到好武器再开！" })
						]
					}), Z("div", {
						class: "tip-hand",
						style: ce(a.gold ? Ti.gold.x : Ti.silver.x, Ti.gold.dy + 40),
						children: "👇"
					})]
				}),
				s.t === "chest" && Z("div", {
					class: "ov ov-chest",
					children: [
						Z("div", {
							class: "ribbon",
							children: s.s.kind === 2 ? "金色宝箱 · 选择新武器" : "银色宝箱 · 强化属性"
						}),
						Z("div", {
							class: "rar-legend",
							children: Ue.map((e, t) => Z("span", {
								style: { background: E[t] },
								children: e.slice(0, 1)
							}, t))
						}),
						Z("div", {
							class: `cards ${g === null ? "" : "picking"}`,
							children: s.s.cards.map((e, t) => Z("div", {
								class: `card-wrap ${g === t ? "chosen" : g === null ? "" : "dim"}`,
								children: Z(za, {
									c: e,
									idx: t,
									onPick: () => re(s.s, t)
								})
							}, `${t}-${Br(e).title}-${e.rarity}`))
						}),
						Z("div", {
							class: "chest-hint",
							children: kr(T).luck > 0 ? `高品质词条概率 +${Math.round(kr(T).luck * 100)}%` : "刷新可能出现更高级的词条"
						}),
						Z("div", {
							class: "chest-btns",
							children: [s.s.freeLeft > 0 ? Z($, {
								color: "blue",
								onClick: () => ae(s.s),
								children: ["免费刷新", Z("small", { children: [
									"剩余 ",
									s.s.freeLeft,
									" 次"
								] })]
							}) : Z($, {
								color: "blue",
								disabled: s.s.paidLeft <= 0,
								onClick: () => ae(s.s),
								children: [Z("span", { children: [
									Z(Q, {
										id: "gem",
										size: 1
									}),
									" ",
									$r,
									" 刷新"
								] }), Z("small", { children: [
									"剩余 ",
									s.s.paidLeft,
									" 次"
								] })]
							}), Z($, {
								color: "yellow",
								disabled: s.s.freeLeft > 0 || (w?.takeAllUsed ?? 0) >= ti,
								onClick: () => S(s.s),
								children: [Z("span", { children: [
									Z(Q, {
										id: "gem",
										size: 1
									}),
									" ",
									ei,
									" 获得全部"
								] }), Z("small", { children: s.s.freeLeft > 0 ? "免费刷新后可用" : `本局剩余 ${ti - (w?.takeAllUsed ?? 0)} 次` })]
							})]
						}),
						Z(Va, { b: w })
					]
				}),
				s.t === "revive" && w && Z("div", {
					class: "ov ov-revive",
					children: Z("div", {
						class: "revive-card",
						children: [
							Z("div", {
								class: "revive-hero",
								children: Z(Fa, {
									heroId: T.hero,
									size: 6
								})
							}),
							Z("div", {
								class: "ribbon",
								children: "复活"
							}),
							Z("div", {
								class: "revive-text",
								children: [
									"只差 ",
									Z("b", { children: [le, "%"] }),
									" 通关"
								]
							}),
							Z("div", {
								class: "hud-bar big",
								children: [Z("div", {
									class: "hud-fill",
									style: { width: `${a.pct}%` }
								}), Z("span", { children: [a.pct, "%"] })]
							}),
							Z("div", {
								class: "revive-sub",
								children: "复活后大幅度击退病毒"
							}),
							Z("div", {
								class: "row-btns",
								children: [Z($, {
									color: "yellow",
									big: !0,
									onClick: oe,
									children: [Z("span", { children: w.reviveCost() === 0 ? "免费复活" : Z(ve, { children: [
										Z(Q, {
											id: "gem",
											size: 1.1
										}),
										" ",
										w.reviveCost(),
										" 复活"
									] }) }), Z("small", { children: ["剩余次数 ×", 3 - w.revives] })]
								}), Z($, {
									color: "gray",
									big: !0,
									onClick: () => x(!1),
									children: "放弃复活"
								})]
							})
						]
					})
				}),
				s.t === "pause" && Z("div", {
					class: "ov ov-pause",
					children: Z("div", {
						class: "panel pause-card",
						children: [
							Z("div", {
								class: "ribbon",
								children: "暂停"
							}),
							Z("div", {
								class: "game-title notranslate",
								lang: "en",
								translate: "no",
								children: "Cell, Not Today!"
							}),
							Z(uo, {}),
							Z(Va, {
								b: w,
								detail: !0
							}),
							Z("div", {
								class: "row-btns",
								children: [Z($, {
									color: "gray",
									small: !0,
									onClick: () => {
										T.settings.sfx = !T.settings.sfx, Gn(T.settings.sfx, T.settings.music), ma.value++, h((e) => e + 1);
									},
									children: ["音效：", T.settings.sfx ? "开" : "关"]
								}), Z($, {
									color: "gray",
									small: !0,
									onClick: () => {
										T.settings.music = !T.settings.music, Gn(T.settings.sfx, T.settings.music), ma.value++, h((e) => e + 1);
									},
									children: ["音乐：", T.settings.music ? "开" : "关"]
								})]
							}),
							Z("div", {
								class: "row-btns",
								children: [Z($, {
									color: "red",
									onClick: () => x(!1),
									children: "退出战斗"
								}), Z($, {
									color: "green",
									onClick: () => c({ t: "none" }),
									children: "继续战斗"
								})]
							})
						]
					})
				}),
				s.t === "result" && Z("div", {
					class: "ov ov-result",
					children: Z("div", {
						class: `result-card ${s.won ? "win" : "lose"}`,
						children: [
							Z("div", {
								class: "ribbon",
								children: s.won ? "胜利！" : "战斗结束"
							}),
							Z("div", {
								class: "result-hero",
								children: Z(Fa, {
									heroId: T.hero,
									size: 6,
									happy: s.won
								})
							}),
							Z("div", {
								class: "result-stats",
								children: [
									Z("div", { children: [Z("span", { children: "生存进度" }), Z("b", { children: [Math.floor(s.summary.progress * 100), "%"] })] }),
									Z("div", { children: [Z("span", { children: "消灭病毒" }), Z("b", { children: s.summary.kills })] }),
									Z("div", { children: [Z("span", { children: "战斗时长" }), Z("b", { children: Ot(s.summary.time) })] })
								]
							}),
							s.settle.newBest && !s.won && Z("div", {
								class: "result-note",
								children: "新的最高进度！"
							}),
							s.settle.firstClear && Z("div", {
								class: "result-note",
								children: "首次通关！额外钻石奖励"
							}),
							s.settle.unlockedWeapon && Z("div", {
								class: "result-note",
								children: [
									"解锁新武器：",
									D[s.settle.unlockedWeapon].name,
									"（已自动上阵）"
								]
							}),
							Z(Pa, { reward: s.settle.reward }),
							Z(Ha, { top: s.summary.top }),
							Z("div", {
								class: "row-btns",
								children: Z($, {
									color: s.won ? "green" : "yellow",
									big: !0,
									onClick: () => e({}),
									children: "返回"
								})
							})
						]
					})
				})
			]
		});
	}
	function Va({ b: e, detail: t }) {
		return e ? Z("div", {
			class: `owned ${t ? "detail" : ""}`,
			children: [e.weapons.map((e) => Z("div", {
				class: `owned-w r${D[e.id].rarity} ${e.awakened ? "awk" : ""}`,
				children: [
					Z(Q, {
						id: `weapon_${e.id}`,
						size: t ? 2.2 : 1.7
					}),
					t && Z("b", { children: D[e.id].name }),
					Z("em", { children: e.awakened ? "觉醒" : `+${e.ups}` })
				]
			}, e.id)), t && Z("div", {
				class: "owned-glob muted",
				children: [
					e.run.allDmg > 0 && Z("span", { children: [
						Qe.allDmg.name,
						" +",
						Math.round(e.run.allDmg * 100),
						"%"
					] }),
					e.run.crit > 0 && Z("span", { children: [
						"暴击率 +",
						Math.round(e.run.crit * 100),
						"%"
					] }),
					e.run.critDmg > 0 && Z("span", { children: [
						"暴伤 +",
						Math.round(e.run.critDmg * 100),
						"%"
					] }),
					e.run.allRate > 0 && Z("span", { children: [
						"攻速 +",
						Math.round(e.run.allRate * 100),
						"%"
					] }),
					e.run.slow > 0 && Z("span", { children: [
						"病毒减速 ",
						Math.round(e.run.slow * 100),
						"%"
					] })
				]
			})]
		}) : null;
	}
	function Ha({ top: e }) {
		let t = Math.max(1, ...e.map((e) => e.dealt));
		return Z("div", {
			class: "dmg-list",
			children: e.slice(0, 5).map((e) => Z("div", {
				class: "dmg-row",
				children: [
					Z(Q, {
						id: `weapon_${e.id}`,
						size: 1.5
					}),
					Z("span", {
						class: "dmg-name",
						children: D[e.id].name
					}),
					Z("div", {
						class: "dmg-bar",
						children: Z("div", { style: {
							width: `${e.dealt / t * 100}%`,
							background: E[D[e.id].rarity]
						} })
					}),
					Z("b", { children: A(e.dealt) })
				]
			}, e.id))
		});
	}
	function Ua() {
		let e = () => {
			let e = J(), [t, n] = hr(null), [r, i] = hr(!1);
			return Z(Ma, {
				title: "英雄密宝",
				class: "modal-vault",
				children: [
					Z("div", {
						class: "vault-stage",
						children: r ? Z("div", {
							class: "vault-spin",
							children: Z(Q, {
								id: "vault",
								size: 6
							})
						}) : t?.hero ? Z("div", {
							class: "vault-hero",
							style: { borderColor: E[k[t.hero].rarity] },
							children: [
								Z(Fa, {
									heroId: t.hero,
									size: 7,
									happy: !0
								}),
								Z("b", { children: k[t.hero].name }),
								Z("span", { children: t.dup ? t.reward ? "已满星，转化为钻石" : "重复获得 · 星级+1" : "新英雄！" }),
								t.reward && Z(Pa, {
									reward: t.reward,
									small: !0
								})
							]
						}) : t?.reward ? Z("div", {
							class: "vault-hero",
							children: [Z(Pa, { reward: t.reward }), Z("span", { children: [
								"再抽 ",
								Math.max(1, 6 - e.pity),
								" 次内必出英雄！"
							] })]
						}) : Z("div", {
							class: "vault-pool",
							children: it.map((t) => Z("div", {
								class: "vault-cell",
								style: { borderColor: E[t.rarity] },
								children: [Z(Fa, {
									heroId: t.id,
									size: 3.2,
									silhouette: !e.heroes[t.id]
								}), Z("span", {
									style: { color: E[t.rarity] },
									children: He[t.rarity]
								})]
							}, t.id))
						})
					}),
					Z("p", {
						class: "muted center-text",
						children: [
							"每次消耗 1 把密宝钥匙 · 最多 6 次必出英雄（已抽 ",
							e.pity,
							" 次）· 重复英雄提升星级（最高 ",
							ot,
							" 星）"
						]
					}),
					Z("div", {
						class: "row-btns",
						children: Z($, {
							big: !0,
							disabled: r || e.keyGold < 1,
							onClick: () => {
								if (e.keyGold < 1) return X("密宝钥匙不足（可在商店购买）");
								i(!0), I("open"), setTimeout(() => {
									let t = nn(e, new Dr((Date.now() ^ e.stats.battles * 7919) >>> 0));
									i(!1), n(t), t?.hero ? I("win") : I("coin"), Y(!0);
								}, 900);
							},
							children: [
								Z(Q, {
									id: "keyGold",
									size: 1.4
								}),
								" 开启 ×1（拥有 ",
								e.keyGold,
								"）"
							]
						})
					})
				]
			});
		};
		Sa(() => Z(e, {}));
	}
	function Wa() {
		let e = J(), t = kr(e), n = Wt(e), r = Ct(n), i = Gt(e), a = pt.find(([e]) => e > n), o = n + 1;
		for (; !Kt(o) && o < n + 10;) o++;
		let s = Kt(o), c = it.find((t) => t.id === e.hero), l = e.heroes[e.hero]?.stars ?? 0, u = (t) => {
			let n = qt(e, t);
			if (!n.ok) return X("金币不足");
			I("up"), e.tut.hero = !0, Y(), n.reward && Ta(`英雄 Lv.${Wt(e)} 奖励`, n.reward);
			let r = Wt(e), i = pt.find(([e]) => e === r);
			i && X(`解锁被动：${ft[i[1]].name}`);
		}, d = [
			{
				id: "atk",
				icon: "atk",
				name: "攻击力",
				value: A(t.atk),
				next: `基础攻击 +${ht}`
			},
			{
				id: "crit",
				icon: "crit",
				name: "暴击",
				value: `${Dt(t.crit, 1)} / ${Dt(t.critDmg)}`,
				next: `暴击率 +${Dt(_t, 1)} 暴伤 +${Dt(vt)}`
			},
			{
				id: "rate",
				icon: "rate",
				name: "攻速",
				value: `+${Dt(t.rate, 1)}`,
				next: `攻速 +${Dt(bt, 1)}`
			}
		];
		return Z("div", {
			class: "screen hero-screen",
			children: [
				Z("div", {
					class: "hero-head panel",
					children: [Z("div", {
						class: "hero-portrait",
						style: { borderColor: E[c.rarity] },
						children: [Z(Fa, {
							heroId: e.hero,
							size: 7.5
						}), Z("div", {
							class: "stars",
							children: Array.from({ length: 5 }, (e, t) => Z("span", {
								class: t < l ? "on" : "",
								children: "★"
							}, t))
						})]
					}), Z("div", {
						class: "hero-info",
						children: [
							Z("div", {
								class: "hero-name",
								children: [
									c.name,
									" ",
									Z("small", { children: c.title })
								]
							}),
							Z("div", {
								class: "hero-lv",
								children: ["Lv.", n]
							}),
							Z("div", {
								class: "hero-pow",
								children: [
									Z(Q, {
										id: "power",
										size: 1.2
									}),
									" 战斗力 ",
									Z("b", { children: A(jr(e)) })
								]
							}),
							Z("div", {
								class: "muted",
								children: ["专属武器：", D[c.weapon].name]
							}),
							Z("div", {
								class: "muted",
								children: [
									"天赋：",
									c.bonusText,
									l ? `，星级攻击 +${Math.round(l * at * 100)}%` : ""
								]
							})
						]
					})]
				}),
				Z("div", {
					class: "panel stat-panel",
					children: [
						Z("div", {
							class: "panel-title",
							children: ["属性加点 ", Z("span", {
								class: "muted",
								children: "（任意加一点，英雄升一级）"
							})]
						}),
						d.map((t) => Z("div", {
							class: "stat-row",
							children: [
								Z(Q, {
									id: t.icon,
									size: 2
								}),
								Z("div", {
									class: "stat-main",
									children: [
										Z("b", { children: t.name }),
										Z("span", {
											class: "stat-val",
											children: t.value
										}),
										Z("span", {
											class: "muted",
											children: t.next
										})
									]
								}),
								Z($, {
									small: !0,
									color: e.gold >= r ? "green" : "gray",
									onClick: () => u(t.id),
									children: [
										Z(Q, {
											id: "gold",
											size: 1
										}),
										" ",
										A(r)
									]
								})
							]
						}, t.id)),
						s && Z("div", {
							class: "next-reward",
							children: [Z("span", { children: [
								"Lv.",
								o,
								" 奖励"
							] }), Z(Pa, {
								reward: s,
								small: !0
							})]
						})
					]
				}),
				Z("div", {
					class: "panel",
					children: [
						Z("div", {
							class: "panel-title",
							children: ["被动技能 ", Z("span", {
								class: "muted",
								children: "（可重复获得并叠加）"
							})]
						}),
						Z("div", {
							class: "passives",
							children: Object.keys(ft).map((e) => Z("div", {
								class: `passive ${i[e] ? "on" : ""}`,
								children: [Z("b", { children: [ft[e].name, i[e] > 0 && Z("em", { children: ["×", i[e]] })] }), Z("span", { children: ft[e].text })]
							}, e))
						}),
						a && Z("div", {
							class: "muted center-text",
							children: [
								"Lv.",
								a[0],
								" 解锁：",
								ft[a[1]].name
							]
						})
					]
				}),
				Z("div", {
					class: "panel",
					children: [Z("div", {
						class: "panel-title",
						children: ["英雄 ", Z($, {
							small: !0,
							color: "purple",
							onClick: Ua,
							style: { marginLeft: "auto" },
							children: [
								Z(Q, {
									id: "keyGold",
									size: 1
								}),
								" 英雄密宝 (",
								e.keyGold,
								")"
							]
						})]
					}), Z("div", {
						class: "roster",
						children: it.map((t) => {
							let n = e.heroes[t.id], r = e.hero === t.id;
							return Z("div", {
								class: `roster-cell ${r ? "on" : ""} ${n ? "" : "locked"}`,
								style: { borderColor: E[t.rarity] },
								onClick: () => Ga(t.id),
								children: [
									Z(Fa, {
										heroId: t.id,
										size: 3.6,
										silhouette: !n
									}),
									Z("b", { children: t.name }),
									Z("span", {
										style: { color: E[t.rarity] },
										children: He[t.rarity]
									}),
									r && Z("em", {
										class: "tag-green",
										children: "出战"
									})
								]
							}, t.id);
						})
					})]
				})
			]
		});
	}
	function Ga(e) {
		let t = () => {
			let t = J(), n = it.find((t) => t.id === e), r = t.heroes[e];
			return Z(Ma, {
				title: n.name,
				children: [Z("div", {
					class: "hero-detail",
					children: [
						Z(Fa, {
							heroId: e,
							size: 8,
							silhouette: !r,
							happy: !!r
						}),
						Z("div", {
							class: "muted",
							children: n.title
						}),
						Z("div", { children: ["品质：", Z("b", {
							style: { color: E[n.rarity] },
							children: He[n.rarity]
						})] }),
						Z("div", { children: [
							"专属武器：",
							D[n.weapon].name,
							"（开局自带）"
						] }),
						Z("div", { children: ["天赋：", n.bonusText] }),
						r && Z("div", { children: [
							"星级：",
							r.stars,
							" / 5（每星攻击 +",
							Math.round(at * 100),
							"%）"
						] })
					]
				}), r ? Z($, {
					big: !0,
					color: t.hero === e ? "gray" : "green",
					disabled: t.hero === e,
					onClick: () => {
						t.hero = e, Y(), Ca(), X(`${n.name} 出战！`);
					},
					children: t.hero === e ? "出战中" : "设为出战"
				}) : Z($, {
					big: !0,
					color: "purple",
					onClick: Ua,
					children: "去英雄密宝抽取"
				})]
			});
		};
		Sa(() => Z(t, {}));
	}
	function Ka(e, t, n, r, i, a) {
		let o = e.createLinearGradient(0, 0, 0, n);
		o.addColorStop(0, "#7fd8ff"), o.addColorStop(.7, "#c9f3ff"), o.addColorStop(1, "#e9fbff"), e.fillStyle = o, e.fillRect(0, 0, t, n), e.fillStyle = "rgba(255,255,255,0.9)";
		for (let i = 0; i < 4; i++) {
			let a = (i * .31 + r * .012 * (1 + i * .3)) % 1.3 * t * 1.1 - t * .15, o = n * (.12 + i * .07);
			for (let [n, r, i] of [
				[
					0,
					0,
					.05
				],
				[
					.05,
					-.02,
					.06
				],
				[
					.1,
					0,
					.045
				]
			]) e.beginPath(), e.arc(a + n * t, o + r * t, i * t, 0, Math.PI * 2), e.fill();
		}
		e.fillStyle = "#9fd0e8";
		for (let r = 0; r < 9; r++) {
			let i = t * .11, a = n * (.18 + r * 37 % 5 * .045);
			e.fillRect(r * t * .115 - t * .02, n * .68 - a, i, a);
		}
		e.fillStyle = "rgba(255,255,255,0.5)";
		for (let r = 0; r < 9; r++) {
			let i = n * (.18 + r * 37 % 5 * .045);
			for (let a = 0; a < 3; a++) e.fillRect(r * t * .115 + t * .01, n * .68 - i + n * .03 + a * n * .05, t * .025, n * .025);
		}
		let s = e.createLinearGradient(0, n * .66, 0, n);
		s.addColorStop(0, "#8fdc6a"), s.addColorStop(1, "#5cb84a"), e.fillStyle = s, e.beginPath(), e.moveTo(0, n * .7), e.quadraticCurveTo(t * .5, n * .62, t, n * .7), e.lineTo(t, n), e.lineTo(0, n), e.fill(), e.fillStyle = "#e8d7a8", e.beginPath(), e.ellipse(t * .5, n * .9, t * .42, n * .1, 0, 0, Math.PI * 2), e.fill();
		let c = e.createRadialGradient(t * .5, n * .4, 10, t * .5, n * .4, t * .45);
		c.addColorStop(0, W(i, 80, 60, .35)), c.addColorStop(1, W(i, 80, 60, 0)), e.fillStyle = c, e.fillRect(0, 0, t, n);
		let l = Math.sin(r * 1.8) * n * .02;
		for (let a = 0; a < 5; a++) {
			let o = r * .8 + a * Math.PI * 2 / 5;
			ui(e, i + 10, t * .5 + Math.cos(o) * t * .3, n * .4 + Math.sin(o) * n * .1 + l, t * .045, !1, a);
		}
		ui(e, i, t * .5, n * .4 + l, t * .15, !0, 3), li(e, k[a] ?? k.amian, t * .5, n * .82, t * .09, {
			t: r,
			look: -Math.PI / 2
		});
	}
	function qa({ hue: e, heroId: t }) {
		let n = vr(null);
		return _r(() => {
			let r = n.current, i = Math.min(2, window.devicePixelRatio || 1), a = 0, o = performance.now(), s = () => {
				let n = r.clientWidth, c = r.clientHeight;
				(r.width !== Math.round(n * i) || r.height !== Math.round(c * i)) && (r.width = Math.round(n * i), r.height = Math.round(c * i));
				let l = r.getContext("2d");
				l.setTransform(i, 0, 0, i, 0, 0), Ka(l, n, c, (performance.now() - o) / 1e3, e, t), a = requestAnimationFrame(s);
			};
			return s(), () => cancelAnimationFrame(a);
		}, [e, t]), Z("canvas", {
			ref: n,
			class: "scene"
		});
	}
	function Ja(e) {
		let t = () => {
			let e = J();
			return Z(Ma, {
				title: "关卡选择",
				class: "modal-chapters",
				children: [Z("div", {
					class: "diff-row",
					children: rt.map((t, n) => Z("button", {
						class: `diff-chip ${e.diff === n ? "on" : ""} ${fn(e, 1, n) ? "" : "locked"}`,
						onClick: () => {
							if (!fn(e, 1, n)) return X(`通关普通难度第1章后解锁${t.name}`);
							e.diff = n, fn(e, e.chapter, n) || (e.chapter = Math.max(1, Math.min(e.chapter, e.clearedDiff[n] + 1))), Y();
						},
						children: t.name
					}, n))
				}), Z("div", {
					class: "chapter-list",
					children: O.map((t) => {
						let n = fn(e, t.id, e.diff), r = e.best[jt(t.id, e.diff)] ?? 0, i = e.clearedDiff[e.diff] >= t.id;
						return Z("div", {
							class: `chapter-item ${n ? "" : "locked"} ${e.chapter === t.id ? "cur" : ""}`,
							onClick: () => {
								if (!n) return X("请先通关上一章");
								e.chapter = t.id, Y(), Ca();
							},
							children: [
								Z("div", {
									class: "ci-virus",
									children: n ? Z(Q, {
										id: `virus_${t.hue}`,
										size: 2.6
									}) : Z(Q, {
										id: "lock",
										size: 2
									})
								}),
								Z("div", {
									class: "ci-main",
									children: [Z("b", { children: [
										"第",
										t.id,
										"章 ",
										t.name
									] }), Z("span", {
										class: "muted",
										children: ["推荐战力 ", A(Mr(t.id, e.diff))]
									})]
								}),
								Z("div", {
									class: "ci-best",
									children: i ? Z("span", {
										class: "tag-green",
										children: "已通关"
									}) : n ? `${r}%` : ""
								})
							]
						}, t.id);
					})
				})]
			});
		};
		Sa(() => Z(t, {}));
	}
	function Ya({ onStart: t }) {
		let n = J(), r = ya.value, i = O[n.chapter - 1] ?? O[0], a = jt(n.chapter, n.diff), o = n.best[a] ?? 0, s = n.miles[a] ?? 0, c = Mr(n.chapter, n.diff), l = jr(n);
		Ut(n, r), dn(n);
		let u = n.chapter > 1, d = fn(n, n.chapter + 1, n.diff), f = (e) => {
			let t = jt(e, n.diff), r = n.best[t] ?? 0, i = n.miles[t] ?? 0;
			return r >= 25 && !(i & 1) || r >= 50 && !(i & 2) || r >= 100 && !(i & 4);
		}, p = O.some((e) => e.id < n.chapter && f(e.id)), m = O.some((e) => e.id > n.chapter && f(e.id)), h = d && n.clearedDiff[n.diff] >= n.chapter, g = [
			[25, 0],
			[50, 1],
			[100, 2]
		], _ = (e) => {
			let t = [
				25,
				50,
				100
			][e];
			if (o < t) {
				Sa(() => Z(Ma, {
					title: `进度 ${t}% 宝箱`,
					children: [
						Z("p", {
							class: "center-text",
							children: [
								"最高生存进度达到 ",
								t,
								"% 即可领取"
							]
						}),
						Z(Pa, { reward: Vt(n.chapter, n.diff, e) }),
						Z($, {
							onClick: Ca,
							children: "知道了"
						})
					]
				}));
				return;
			}
			let r = hn(n, n.chapter, n.diff, e);
			r && (I("open"), Y(!0), Ta(`${t}% 进度宝箱`, r));
		};
		return Z("div", {
			class: "home",
			children: [
				Z("div", {
					class: "game-title notranslate",
					lang: "en",
					translate: "no",
					children: e
				}),
				Z("div", {
					class: "chapter-card",
					children: [
						Z("button", {
							class: "arrow",
							disabled: !u,
							onClick: () => u && (--n.chapter, Y(), I("click")),
							children: ["‹", Z(Oa, { show: p })]
						}),
						Z("div", {
							class: "chapter-mid",
							onClick: () => Ja(n),
							children: [Z("div", {
								class: "chapter-name",
								children: [
									"第",
									i.id,
									"章 · ",
									i.name
								]
							}), Z("div", {
								class: "chapter-sub",
								children: [Z("span", {
									class: `diff-tag d${n.diff}`,
									children: rt[n.diff].name
								}), Z("span", {
									class: `rec ${l >= c ? "ok" : "low"}`,
									children: ["推荐战力 ", A(c)]
								})]
							})]
						}),
						Z("button", {
							class: `arrow ${h ? "pulse" : ""}`,
							disabled: !d,
							onClick: () => d && (n.chapter += 1, Y(), I("click")),
							children: [
								"›",
								Z(Oa, { show: m }),
								h && Z("em", {
									class: "arrow-new",
									children: "下一章"
								})
							]
						})
					]
				}),
				Z("div", {
					class: "scene-wrap",
					children: [
						Z(qa, {
							hue: i.hue,
							heroId: n.hero
						}),
						Z("div", {
							class: "quote",
							children: i.quote
						}),
						Z("div", {
							class: "side side-l",
							children: [Z("button", {
								class: "side-btn",
								onClick: () => Ja(n),
								children: [Z(Q, {
									id: `virus_${i.hue}`,
									size: 2.2
								}), Z("span", { children: "关卡选择" })]
							})]
						}),
						Z("div", {
							class: "side side-r",
							children: [Z("button", {
								class: "side-btn",
								onClick: () => Ua(),
								children: [
									Z(Q, {
										id: "vault",
										size: 2.2
									}),
									Z("span", { children: "英雄密宝" }),
									Z(Oa, {
										show: n.keyGold > 0,
										n: n.keyGold
									})
								]
							})]
						})
					]
				}),
				Z("div", {
					class: "miles",
					children: [Z("div", {
						class: "miles-label",
						children: ["最高生存进度：", Z("b", { children: [o, "%"] })]
					}), Z("div", {
						class: "miles-track",
						children: [Z("div", {
							class: "miles-fill",
							style: { width: `${o}%` }
						}), g.map(([e, t]) => {
							let n = !!(s & 1 << t);
							return Z("button", {
								class: `mile ${o >= e && !n ? "ready" : ""} ${n ? "claimed" : ""}`,
								style: { left: `${e === 100 ? 94 : e}%` },
								onClick: () => _(t),
								children: [Z(Q, {
									id: n ? "chestSilver" : "chestGold",
									size: 2.4
								}), Z("span", { children: [e, "%"] })]
							}, e);
						})]
					})]
				}),
				Z("div", {
					class: "start-wrap",
					children: [Z($, {
						big: !0,
						class: "start-btn",
						onClick: t,
						children: "开始战斗"
					}), !n.tut.battle && Z("div", {
						class: "finger",
						children: "👆"
					})]
				})
			]
		});
	}
	function Xa(e, t) {
		let n = [], r = (e, n = 0) => `${Math.round(e * t * 100 * 10 ** n) / 10 ** n}%`;
		return e.atkPct && n.push(`攻击力 +${r(e.atkPct, 1)}`), e.crit && n.push(`暴击率 +${r(e.crit, 1)}`), e.critDmg && n.push(`暴击伤害 +${r(e.critDmg)}`), e.rate && n.push(`攻速 +${r(e.rate, 1)}`), e.luck && n.push(`高品质词条概率 +${r(e.luck, 1)}`), e.reward && n.push(`战斗奖励 +${r(e.reward)}`), e.knock && n.push(`复活击退 +${r(e.knock)}`), e.wDmg && n.push(`${D[e.wDmg[0]].name}伤害 +${Math.round(e.wDmg[1] * t * 100)}%`), n;
	}
	function Za(e) {
		if (!e.start) return null;
		let t = D[e.start.weapon].name;
		return e.start.count ? `${t}初始${D[e.start.weapon].countLabel} +${e.start.count}` : e.start.pierce ? `${t}初始穿透 +${e.start.pierce}` : null;
	}
	function Qa() {
		let e = J();
		return Z("div", {
			class: "screen relics-screen",
			children: [Z("div", {
				class: "panel relic-box-panel",
				children: [
					Z(Q, {
						id: "chestSilver",
						size: 4
					}),
					Z("div", {
						class: "rb-main",
						children: [
							Z("b", { children: "藏品宝箱" }),
							Z("span", {
								class: "muted",
								children: "随机获得藏品或藏品碎片"
							}),
							Z("span", { children: [
								Z(Q, {
									id: "keySilver",
									size: 1.2
								}),
								" 藏品钥匙 × ",
								e.keySilver
							] })
						]
					}),
					Z("div", {
						class: "rb-btns",
						children: [Z($, {
							small: !0,
							color: "blue",
							onClick: () => $a(1),
							children: "开启 ×1"
						}), Z($, {
							small: !0,
							color: "purple",
							onClick: () => $a(10),
							children: "开启 ×10"
						})]
					})
				]
			}), lt.map((t) => {
				let n = st.filter((e) => e.set === t.id), r = n.every((t) => (e.relics[t.id]?.lv ?? 0) > 0);
				return Z("div", {
					class: "panel set-panel",
					children: [Z("div", {
						class: "panel-title",
						children: [t.name, Z("span", {
							class: r ? "set-on" : "muted",
							children: [
								r ? "✓ " : "",
								"套装：",
								t.text
							]
						})]
					}), Z("div", {
						class: "relic-row",
						children: n.map((t) => {
							let n = e.relics[t.id], r = n?.lv ?? 0;
							return Z("button", {
								class: `relic r${t.rarity} ${r ? "" : "locked"}`,
								onClick: () => eo(t),
								children: [
									r > 0 && Zt(e, t.id) && Z("span", {
										class: "dot up",
										children: "↑"
									}),
									Z("div", {
										class: "relic-icon",
										children: Z(Q, {
											id: `relic_${t.id}`,
											size: 2.8
										})
									}),
									Z("b", { children: t.name }),
									r > 0 ? Z(ve, { children: [Z("span", {
										class: "wlv",
										children: ["Lv.", r]
									}), r < ut ? Z(Ia, {
										value: n.shards,
										max: dt(r),
										color: E[t.rarity],
										label: `${n.shards}/${dt(r)}`
									}) : Z("span", {
										class: "tag-green",
										children: "满级"
									})] }) : Z("span", {
										class: "muted",
										children: "未获得"
									})
								]
							}, t.id);
						})
					})]
				}, t.id);
			})]
		});
	}
	function $a(e) {
		let t = q();
		if (t.keySilver < e) {
			X(`藏品钥匙不足（需要 ${e} 把），进度宝箱、签到和商店都能获得`);
			return;
		}
		let n = en(t, e, new Dr(Date.now() * 31 + t.stats.chests >>> 0));
		n && (I("open"), Y(!0), Sa(() => Z(Ma, {
			title: "获得藏品",
			class: "modal-reward",
			children: Z("div", {
				class: "relic-results",
				children: n.map((e, t) => {
					let n = st.find((t) => t.id === e);
					return Z("div", {
						class: `relic-res r${n.rarity}`,
						style: { animationDelay: `${t * .08}s` },
						children: [
							Z(Q, {
								id: `relic_${e}`,
								size: 2.6
							}),
							Z("b", { children: n.name }),
							Z("span", {
								style: { color: E[n.rarity] },
								children: He[n.rarity]
							})
						]
					}, t);
				})
			})
		})));
	}
	function eo(e) {
		let t = () => {
			let t = J(), n = t.relics[e.id], r = n?.lv ?? 0, i = Za(e);
			return Z(Ma, {
				title: e.name,
				class: `r${e.rarity}`,
				children: [Z("div", {
					class: "relic-detail",
					children: [
						Z("div", {
							class: `relic-icon big r${e.rarity}`,
							children: Z(Q, {
								id: `relic_${e.id}`,
								size: 5
							})
						}),
						Z("b", {
							style: { color: E[e.rarity] },
							children: He[e.rarity]
						}),
						Z("p", {
							class: "muted",
							children: e.flavor
						}),
						Z("div", {
							class: "relic-eff",
							children: [Z("div", { children: [
								Z("em", { children: ["当前 Lv.", r] }),
								(r ? Xa(e.per, r) : ["未获得"]).map((e) => Z("span", { children: e }, e)),
								r > 0 && i && Z("span", { children: i })
							] }), r > 0 && r < ut && Z("div", { children: [Z("em", { children: ["下一级 Lv.", r + 1] }), Xa(e.per, r + 1).map((e) => Z("span", { children: e }, e))] })]
						})
					]
				}), r > 0 && r < ut && Z($, {
					big: !0,
					color: "green",
					disabled: !Zt(t, e.id),
					onClick: () => {
						if (!Qt(t, e.id)) return X("碎片不足，多开藏品宝箱吧");
						I("up"), Y();
					},
					children: [
						"升级（",
						n.shards,
						"/",
						dt(r),
						"）"
					]
				})]
			});
		};
		Sa(() => Z(t, {}));
	}
	function to(e) {
		return Z("div", {
			class: `shop-item ${e.disabled ? "sold" : ""}`,
			children: [
				e.tag && Z("em", {
					class: "shop-tag",
					children: e.tag
				}),
				Z(Q, {
					id: e.icon,
					size: 3.4
				}),
				Z("b", { children: e.name }),
				Z("span", {
					class: "muted",
					children: e.desc
				}),
				Z($, {
					small: !0,
					color: e.disabled ? "gray" : "green",
					disabled: e.disabled,
					onClick: e.onBuy,
					children: e.price
				})
			]
		});
	}
	var no = (e) => Z(ve, { children: [
		Z(Q, {
			id: "gem",
			size: 1
		}),
		" ",
		e
	] });
	function ro() {
		let e = J(), t = () => new Dr((Date.now() ^ e.gems * 131) >>> 0), n = () => X("钻石不足");
		return Z("div", {
			class: "screen shop-screen",
			children: [
				Z("div", {
					class: "panel",
					children: [Z("div", {
						class: "panel-title",
						children: "武器宝箱"
					}), Z("div", {
						class: "shop-grid",
						children: [Z(to, {
							icon: "boxBlue",
							name: "蓝色武器箱",
							desc: "绿/蓝碎片，小概率开出新武器",
							price: no(j.blueBoxGems),
							onBuy: () => {
								let r = sn(e, "blue", t());
								if (!r) return n();
								I("open"), Y(!0), Ta("蓝色武器箱", r);
							}
						}), Z(to, {
							icon: "boxPurple",
							name: "紫色武器箱",
							desc: `高级碎片，概率开出新武器（今日 ${j.purpleBoxPerDay - e.daily.purpleBox}）`,
							tag: "超值",
							price: no(j.purpleBoxGems),
							disabled: e.daily.purpleBox >= j.purpleBoxPerDay,
							onBuy: () => {
								let r = sn(e, "purple", t());
								if (!r) return e.gems < j.purpleBoxGems ? n() : X("今日次数已用完");
								I("open"), Y(!0), Ta("紫色武器箱", r);
							}
						})]
					})]
				}),
				Z("div", {
					class: "panel",
					children: [Z("div", {
						class: "panel-title",
						children: "钥匙"
					}), Z("div", {
						class: "shop-grid",
						children: [Z(to, {
							icon: "keySilver",
							name: "藏品钥匙",
							desc: "开启藏品宝箱",
							price: no(j.silverKeyGems),
							onBuy: () => {
								if (!ln(e, "silver")) return n();
								I("coin"), Y(!0), X("藏品钥匙 +1");
							}
						}), Z(to, {
							icon: "keyGold",
							name: "密宝钥匙",
							desc: "开启英雄密宝",
							price: no(j.goldKeyGems),
							onBuy: () => {
								if (!ln(e, "gold")) return n();
								I("coin"), Y(!0), X("密宝钥匙 +1");
							}
						})]
					})]
				}),
				Z("div", {
					class: "panel",
					children: [Z("div", {
						class: "panel-title",
						children: "金币商店"
					}), Z("div", {
						class: "shop-grid",
						children: j.goldPacks.map((t, r) => Z(to, {
							icon: "gold",
							name: `${A(rn(e, t.mult))} 金币`,
							desc: r === 2 ? "最划算" : r === 1 ? "常用" : "小袋",
							tag: r === 2 ? "推荐" : void 0,
							price: no(t.gems),
							onBuy: () => {
								let t = cn(e, r);
								if (!t) return n();
								I("coin"), Y(!0), X(`金币 +${A(t)}`);
							}
						}, r))
					})]
				})
			]
		});
	}
	function io() {
		let e = J(), t = Array.from({ length: Ye }, (t, n) => e.loadout[n] ?? null);
		return Z("div", {
			class: "screen weapons-screen",
			children: [
				Z("div", {
					class: "panel",
					children: [
						Z("div", {
							class: "panel-title",
							children: ["上阵武器 ", Z("span", {
								class: "muted",
								children: [
									e.loadout.length,
									"/",
									Ye
								]
							})]
						}),
						Z("div", {
							class: "loadout",
							children: t.map((t, n) => t ? Z("button", {
								class: "slot",
								style: { borderColor: E[D[t].rarity] },
								onClick: () => oo(t),
								children: [Z(Q, {
									id: `weapon_${t}`,
									size: 2.4
								}), Z("span", { children: ["Lv.", e.weapons[t]?.lv ?? 1] })]
							}, n) : Z("div", {
								class: "slot empty",
								children: "+"
							}, n))
						}),
						Z("p", {
							class: "muted small-text",
							children: "金色宝箱只会开出上阵的武器——根据战场类型搭配你的武器池！"
						})
					]
				}),
				Z("div", {
					class: "frag-bar",
					children: e.frags.map((e, t) => Z("div", {
						class: "frag",
						children: [Z(Q, {
							id: `frag${t}`,
							size: 1.3
						}), Z("span", { children: A(e) })]
					}, t))
				}),
				Z("div", {
					class: "weapon-grid",
					children: Ge.map((t) => {
						let n = e.weapons[t.id], r = e.loadout.includes(t.id), i = n ? qe(t.rarity, n.lv) : 0;
						return Z("button", {
							class: `wcard r${t.rarity} ${n ? "" : "locked"}`,
							onClick: () => oo(t.id),
							children: [
								r && Z("em", {
									class: "wtag",
									children: "上阵"
								}),
								n && Jt(e, t.id) && Z("span", {
									class: "dot up",
									children: "↑"
								}),
								Z("div", {
									class: "wicon",
									children: [Z(Q, {
										id: `weapon_${t.id}`,
										size: 3
									}), !n && Z(Q, {
										id: "lock",
										size: 1.4,
										class: "wlock"
									})]
								}),
								Z("b", { children: t.name }),
								n ? Z(ve, { children: [Z("span", {
									class: "wlv",
									children: ["Lv.", n.lv]
								}), Z(Ia, {
									value: e.frags[t.rarity],
									max: i,
									color: E[t.rarity],
									label: `${A(e.frags[t.rarity])}/${i}`
								})] }) : Z("span", {
									class: "muted",
									children: typeof t.unlock == "number" ? `通关第${t.unlock}章` : "未解锁"
								})
							]
						}, t.id);
					})
				})
			]
		});
	}
	function ao(e) {
		let t = D[e], n = t.base, r = [`伤害：攻击力×${n.dmg}`, `间隔：${n.cd}秒`];
		return t.countLabel && n.count && r.push(`${t.countLabel}：${n.count}`), n.pierce && n.pierce < 99 && r.push(`穿透：${n.pierce}`), n.pierce >= 99 && r.push("穿透：无限"), t.areaLabel && n.area && r.push(`${t.areaLabel}：${n.area}`), r;
	}
	function oo(e) {
		let t = () => {
			let t = J(), n = D[e], r = t.weapons[e], i = t.loadout.includes(e), a = r?.lv ?? 1, o = qe(n.rarity, a), s = Je(n.rarity, a);
			return Z(Ma, {
				title: n.name,
				class: `modal-weapon r${n.rarity}`,
				children: [
					Z("div", {
						class: "wd-top",
						children: [Z("div", {
							class: `wd-icon r${n.rarity}`,
							children: Z(Q, {
								id: `weapon_${e}`,
								size: 5
							})
						}), Z("div", {
							class: "wd-info",
							children: [
								Z("div", { children: [Z("b", {
									style: { color: E[n.rarity] },
									children: [
										He[n.rarity],
										" · ",
										Ue[n.rarity]
									]
								}), Z("span", {
									class: "wd-tag",
									children: n.tag
								})] }),
								Z("div", { children: n.desc }),
								Z("div", {
									class: "wd-stats",
									children: ao(e).map((e) => Z("span", { children: e }, e))
								})
							]
						})]
					}),
					Z("div", {
						class: "wd-awaken",
						children: [
							Z("b", { children: ["觉醒 · ", n.awakenName] }),
							Z("span", { children: n.awakenDesc }),
							Z("em", {
								class: "muted",
								children: "局内获得 4 次强化后，银色宝箱可能出现觉醒"
							})
						]
					}),
					r ? Z(ve, { children: [
						Z("div", {
							class: "wd-level",
							children: [Z("span", { children: [
								"Lv.",
								a,
								" → Lv.",
								a + 1
							] }), Z("span", { children: [
								"伤害 ×",
								Ke(a).toFixed(2),
								" → ×",
								Ke(a + 1).toFixed(2)
							] })]
						}),
						Z("div", {
							class: "wd-cost",
							children: [Z("span", {
								class: t.frags[n.rarity] >= o ? "" : "lack",
								children: [
									Z(Q, {
										id: `frag${n.rarity}`,
										size: 1.3
									}),
									" ",
									A(t.frags[n.rarity]),
									"/",
									o
								]
							}), Z("span", {
								class: t.gold >= s ? "" : "lack",
								children: [
									Z(Q, {
										id: "gold",
										size: 1.3
									}),
									" ",
									A(s)
								]
							})]
						}),
						Z("div", {
							class: "row-btns",
							children: [Z($, {
								color: i ? "gray" : "blue",
								onClick: () => {
									let n = Xt(t, e);
									if (n === "full") return X(`最多上阵 ${Ye} 把武器`);
									if (n === "last") return X("至少保留 1 把上阵武器");
									Y(), X(n === "on" ? "已上阵" : "已下阵");
								},
								children: i ? "下阵" : "上阵"
							}), Z($, {
								color: "green",
								disabled: !Jt(t, e),
								onClick: () => {
									if (!Yt(t, e)) return X(t.frags[n.rarity] < o ? `${Ue[n.rarity]}碎片不足` : "金币不足");
									I("up"), Y();
								},
								children: "升级"
							})]
						})
					] }) : Z("p", {
						class: "center-text muted",
						children: typeof n.unlock == "number" ? `普通难度通关第 ${n.unlock} 章解锁，商店武器宝箱也有概率获得` : ""
					})
				]
			});
		};
		Sa(() => Z(t, {}));
	}
	function so() {
		if (!C) return;
		let e = parseFloat(C.dataset.u0 || "");
		if (!e) return;
		let t = C.querySelector(".menu.tab-home .content");
		if (!t) return;
		let n = t.clientHeight - 10;
		if (n <= 0) return;
		let r = t.scrollHeight / n;
		r > 1.005 && C.style.setProperty("--u", `${e / r}px`);
	}
	function co() {
		let e = () => {
			let e = C && C.clientWidth || window.innerWidth, t = C && C.clientHeight || window.innerHeight, n = Math.floor(e > t && t < 600 ? Math.min(e, 920) : Math.min(e, Math.max(320, t / 1.6)));
			return {
				w: n,
				h: Math.floor(Math.min(t, n * 2.25))
			};
		}, [t, n] = hr(e);
		return _r(() => {
			let t = () => n(e());
			return window.addEventListener("resize", t), window.addEventListener("orientationchange", t), () => {
				window.removeEventListener("resize", t), window.removeEventListener("orientationchange", t);
			};
		}, []), _r(() => {
			let e = C && C.clientWidth || window.innerWidth, n = C && C.clientHeight || window.innerHeight;
			if (!C) return;
			let r = e > n && n < 600 ? 14 : 16 * t.w / 390;
			C.dataset.u0 = String(r), C.style.setProperty("--u", `${r}px`), so();
		}, [t.w]), t;
	}
	function lo() {
		let e = () => {
			let e = J(), t = j.staminaBuysPerDay - e.daily.staminaBuys;
			return Z(Ma, {
				title: "体力不足",
				children: Z("div", {
					class: "center-col",
					children: [
						Z(Q, {
							id: "stamina",
							size: 4
						}),
						Z("p", {
							class: "center-text",
							children: [
								"当前体力 ",
								e.stamina,
								"/",
								wt,
								"，每 5 分钟恢复 1 点"
							]
						}),
						Z($, {
							big: !0,
							color: "green",
							disabled: t <= 0,
							onClick: () => {
								if (!an(e)) return X(e.gems < j.staminaGems ? "钻石不足" : "今日次数已用完");
								I("coin"), Y(!0), Ca(), X(`体力 +${j.staminaAmount}`);
							},
							children: [
								Z(Q, {
									id: "gem",
									size: 1.1
								}),
								" ",
								j.staminaGems,
								" 购买 ",
								j.staminaAmount,
								" 体力（今日剩余 ",
								t,
								"）"
							]
						}),
						Z("p", {
							class: "muted center-text",
							children: "完成每日任务、领取进度宝箱也能获得体力"
						})
					]
				})
			});
		};
		Sa(() => Z(e, {}));
	}
	function uo() {
		return da.value, Z("div", {
			class: "language-row",
			role: "group",
			"aria-label": _("语言"),
			children: [
				["zh", "中文"],
				["en", "English"],
				["ja", "日本語"]
			].map(([e, t]) => Z("button", {
				class: "language-button",
				lang: e,
				"aria-pressed": p() === e,
				onClick: () => h(e),
				children: t
			}, e))
		});
	}
	function fo() {
		fa.value;
		let e = _n.status;
		return Z("div", {
			class: "save-status",
			role: "status",
			children: [
				Z("p", { children: e === "invalid" ? "存档无法读取，已保留原数据" : e === "error" ? "暂未保存成功，请重试" : e === "saving" ? "正在保存进度…" : e === "accepted" ? "进度已交给平台保存" : "自动存档已启用" }),
				Z("p", { children: "战斗每10秒自动记录，离开时再次记录" }),
				e === "error" && Z($, {
					onClick: () => _n.retry(),
					children: "重试存档"
				})
			]
		});
	}
	function po() {
		let t = () => {
			let t = J();
			return Z(Ma, {
				title: "设置",
				children: Z("div", {
					class: "center-col",
					children: [
						Z(uo, {}),
						Z(fo, {}),
						Z("div", {
							class: "row-btns",
							children: [Z($, {
								color: t.settings.sfx ? "green" : "gray",
								onClick: () => {
									t.settings.sfx = !t.settings.sfx, Gn(t.settings.sfx, t.settings.music), ma.value++;
								},
								children: ["音效：", t.settings.sfx ? "开" : "关"]
							}), Z($, {
								color: t.settings.music ? "green" : "gray",
								onClick: () => {
									t.settings.music = !t.settings.music, Gn(t.settings.sfx, t.settings.music), ma.value++;
								},
								children: ["音乐：", t.settings.music ? "开" : "关"]
							})]
						}),
						Z("div", {
							class: "muted center-text",
							children: [
								"战斗 ",
								t.stats.battles,
								" 场 · 胜利 ",
								t.stats.wins,
								" 场 · 消灭病毒 ",
								A(t.stats.kills)
							]
						}),
						Z($, {
							color: "red",
							small: !0,
							onClick: () => La("重置存档", "确定清空全部进度重新开始吗？此操作无法撤销。", () => {
								Tn().then((e) => {
									e && (xn = !1, M = null, location.reload());
								});
							}, "重置"),
							children: "重置存档"
						}),
						Z("p", {
							class: "muted center-text small-text",
							children: `${e} · 原创轻度塔防肉鸽 · 所有角色与美术均为程序绘制`
						})
					]
				})
			});
		};
		Sa(() => Z(t, {}));
	}
	function mo() {
		let e = wa.value;
		if (!e.length) return null;
		let t = e[0], n = () => {
			wa.value = wa.value.slice(1);
		};
		return Z("div", {
			class: "modal-back reward-back",
			onClick: n,
			children: Z("div", {
				class: "reward-pop",
				onClick: (e) => e.stopPropagation(),
				children: [
					Z("div", { class: "reward-rays" }),
					Z("div", {
						class: "ribbon",
						children: t.title
					}),
					Z(Pa, { reward: t.reward }),
					t.note && Z("p", {
						class: "center-text",
						children: t.note
					}),
					Z($, {
						big: !0,
						onClick: n,
						children: "收下"
					})
				]
			})
		});
	}
	function ho() {
		da.value;
		let e = co(), t = J();
		ya.value;
		let n = ga.value, r = ha.value, i = _a.value;
		_r(() => {
			n || tr("menu");
		}, [n]);
		let a = async () => {
			if (await se()) {
				if (!pn(q(), Date.now())) {
					lo();
					return;
				}
				I("open"), Y(!0), Ca(), ga.value = !0;
			}
		}, o = Wt(t), s = t.tut.battle ? {
			home: gn(t) > 0,
			hero: t.gold >= Ct(o) || t.tut.battle && !t.tut.hero,
			weapons: Ge.some((e) => t.weapons[e.id] && Jt(t, e.id)),
			relics: t.keySilver > 0 || st.some((e) => Zt(t, e.id)),
			shop: !1
		} : { home: !1 };
		return Z("div", {
			class: "root",
			children: Z("div", {
				class: "stage",
				style: {
					width: `${e.w}px`,
					height: `${e.h}px`
				},
				children: [
					n ? Z(Ba, { onExit: () => {
						ga.value = !1, ha.value = "home";
					} }) : Z("div", {
						class: `menu tab-${r}`,
						children: [
							Z(ka, { onPlus: (e) => {
								e === "stamina" ? lo() : ha.value = "shop";
							} }),
							Z("button", {
								class: "gear",
								onClick: () => (I("click"), po()),
								children: "⚙"
							}),
							Z("div", {
								class: "content",
								children: [
									r === "home" && Z(Ya, { onStart: a }),
									r === "hero" && Z(Wa, {}),
									r === "weapons" && Z(io, {}),
									r === "relics" && Z(Qa, {}),
									r === "shop" && Z(ro, {})
								]
							}),
							Z(ja, { dots: s })
						]
					}),
					i && Z(i, {}),
					Z(mo, {}),
					Z("div", {
						class: "toasts",
						children: va.value.map((e) => Z("div", {
							class: "toast",
							children: e.text
						}, e.id))
					})
				]
			})
		});
	}
	async function go(e = {}) {
		let t = e.container ?? document.getElementById("app");
		w = e.store ?? le(), se = typeof e.chargePlay == "function" ? e.chargePlay : async () => !0;
		let n = document.createElement("style");
		n.textContent = oe(Ve, ".cg"), document.head.appendChild(n), C = document.createElement("div"), C.className = "cg", C.style.cssText = "position:relative;width:100%;height:100%;overflow:hidden", t.appendChild(C), f(C), ha.value = "home", ga.value = !1, _a.value = null, va.value = [];
		let r = Date.now(), i = await Sn(w);
		Ft(i, r), ba(i), Gn(i.settings.sfx, i.settings.music), ce = Ea(), h(navigator.language, !1), vn && (ga.value = !0), Be(Z(ho, {}), C);
		let a = 0, o = 0, s = new MutationObserver(() => {
			a ||= requestAnimationFrame(() => {
				a = 0;
				let e = Date.now();
				e - o < 200 || (o = e, so());
			});
		});
		s.observe(C, {
			childList: !0,
			subtree: !0
		});
		let c = [], l = (e, t, n, r) => {
			e.addEventListener(t, n, r), c.push(() => e.removeEventListener(t, n, r));
		}, u = () => Fn();
		l(window, "pointerdown", u, { passive: !0 }), l(window, "keydown", u), l(document, "visibilitychange", () => {
			document.hidden && En(), nr(document.hidden);
		}), l(window, "pagehide", En), l(document, "gesturestart", (e) => e.preventDefault()), l(document, "contextmenu", (e) => e.preventDefault());
		let d = {
			ready: !0,
			state: () => {
				let e = J();
				return {
					tab: ha.value,
					battle: !!ga.value,
					chapter: e.chapter,
					diff: e.diff,
					gold: e.gold,
					gems: e.gems,
					battles: e.stats.battles,
					modal: !!_a.value,
					pct: M ? Math.floor(M.progress * 100) : 0,
					killed: M ? M.killed : 0
				};
			}
		};
		return window.__cellguard = d, async function() {
			c.forEach((e) => e()), s.disconnect(), a && cancelAnimationFrame(a), clearInterval(ce), ce = 0;
			try {
				_n && await _n.write(q(), re(M, yn(), bn()));
			} catch {}
			try {
				Be(null, C);
			} catch {}
			try {
				N &&= (await N.close(), null);
			} catch {}
			n.remove(), C.remove(), C = null, w = null, f(null), M = null, xn = !1, window.__cellguard === d && delete window.__cellguard;
		};
	}
	return await go(t);
}
//#endregion
//#region plugin.js
var ue = 4, de = 10, fe = {
	id: "cellguard",
	name: "细胞守卫",
	emoji: "🦠",
	tabLabel: "细胞守卫",
	version: "1.0.0",
	minHostApi: ue,
	coin: {
		id: "cg-gem",
		name: "钻石",
		emoji: "💠"
	},
	economy: {
		playCost: de,
		expectedPayout: 0,
		capPerPrize: 1
	},
	kind: "chill"
};
async function pe(e, t, n = {}) {
	let r = getComputedStyle(e).position === "static", i = {
		position: e.style.position,
		overflow: e.style.overflow,
		touchAction: e.style.touchAction,
		userSelect: e.style.userSelect
	};
	r && (e.style.position = "relative"), e.style.overflow = "hidden", e.style.touchAction = "none", e.style.userSelect = "none";
	let a = () => {
		r && (e.style.position = i.position), e.style.overflow = i.overflow, e.style.touchAction = i.touchAction, e.style.userSelect = i.userSelect;
	}, o;
	try {
		o = await t.storage.get("save");
	} catch (e) {
		console.warn("[cellguard] 读存档失败，按新档开始", e);
	}
	let s = {
		latestSync: o ?? null,
		putLatest: async (e) => {
			try {
				return await t.storage.set("save", e), !0;
			} catch (e) {
				return console.warn("[cellguard] 写存档失败", e), !1;
			}
		},
		clearLatest: async () => {
			try {
				return await t.storage.set("save", null), !0;
			} catch (e) {
				return console.warn("[cellguard] 清存档失败", e), !1;
			}
		}
	}, c = async () => {
		let e = (e, n) => (t.pushToast?.({
			kind: "warn",
			title: e,
			detail: n
		}), !1);
		try {
			if (typeof t.balance == "function" && t.balance() < de || !await t.spendPoints(de, "细胞守卫 · 打一局")) return e("积分不够啦", `玩一局要 ${de} 积分 —— 去做个任务攒一点吧`);
		} catch (t) {
			return console.error("[cellguard] 开局扣分失败", t), e("扣分失败", "稍后再试一次");
		}
		return t.tone?.("coin"), !0;
	}, l = null;
	try {
		l = await T({
			container: e,
			store: s,
			chargePlay: c
		});
	} catch (e) {
		throw console.error("[cellguard] mount 失败", e), a(), e;
	}
	return async function() {
		try {
			await l?.();
		} catch (e) {
			console.warn("[cellguard] 卸载出错", e);
		}
		a();
	};
}
var me = {
	manifest: fe,
	mount: pe
};
//#endregion
export { me as default, fe as manifest, pe as mount };
