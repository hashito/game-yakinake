// 1.8.0 (2026-11-27 #3 「ゾンビのパラメータや能力をそれぞれ作って個体ごとに違う設計に」「各ゾンビの設定とゾンビ化した経緯…クリア後に確認」):
// every zombie of the game is someone. Each spawn of js/ext/spawns.js has a profile here: who they were (name, age, work), how they turned
// (the night of the city, told in two or three short sentences), and how their body moves now - a KIND (how fast, how tough, how far it
// reaches) and the MOVES it has (js/ext/moves.js, the ten attacks, each one telegraphed). The kinds and moves are chosen by design, room by
// room: the hospital teaches one move at a time, the streets mix them, the police and the tower combine them.
// After a clear, the 記録 (js/ext/bestiary.js) shows every profile.

// how the body moves: walk (x the pattern's walk), run (m/s, makes it a runner), hp (x), reach (m), damage (x), sight (m)
export const KINDS = {
  slow: { name: 'のろい', walk: 1.0, hp: 1.0, reach: 1.0, damage: 1.0, sight: 12, text: '歩きは遅い。囲まれなければ逃げられる。' },
  brisk: { name: '早足', walk: 1.9, hp: 1.0, reach: 1.0, damage: 1.0, sight: 14, text: '人の早歩きほどの速さで、まっすぐ来る。' },
  runner: { name: '走る', walk: 1.5, run: 2.6, hp: 0.8, reach: 1.0, damage: 0.9, sight: 18, role: 'runner', text: '見つけると走ってくる。体は脆い。' },
  heavy: { name: '重い', walk: 0.85, hp: 1.5, reach: 1.3, damage: 1.2, sight: 12, text: '遅いが固く、腕が長い。一撃が重い。' },
  crawler: { name: '這う', walk: 1.0, hp: 1.0, reach: 0.9, damage: 1.0, sight: 20, text: '床を這う。足もとに気をつける。' },
  brute: { name: '大きい', walk: 1.0, hp: 1.0, reach: 1.0, damage: 1.0, sight: 14, text: '大きく、固い。吠えて止まった後に突っ込んでくる。' },
  kept: { name: 'つながれた', walk: 1.0, hp: 1.0, reach: 1.0, damage: 1.0, sight: 10, text: '鎖につながれている。' },
};

// the ten attacks (js/ext/moves.js does them): the name and the tell, as the 記録 says it
export const MOVES = {
  dash: { name: '突進', tell: '身を低くして、息を吐く。', text: '3〜7 m 先から、まっすぐ走り込む。向きは走り出す前に決まるので、横へ避ける。' },
  pounce: { name: '跳びかかり', tell: '深くかがみ、甲高く叫ぶ。', text: '3〜4 m 先から跳び、つかみかかる。跳ぶ前に撃てば止まる。' },
  swipe: { name: '薙ぎ払い', tell: '腕を大きく引く。', text: '長い腕で横に払う。届く距離が長いので、下がって避ける。' },
  vomit: { name: '嘔吐', tell: '体を折って、えずく。', text: '近くで、腐った物を吐きかける。前に立っていると、しばらく体力が減る。' },
  ankle: { name: '足首つかみ', tell: '床の手が、ぴくりと動く。', text: '倒れたまま、通りかかった足首をつかむ。倒れた体の横は、離れて通る。' },
  throw: { name: '投げつけ', tell: 'かがんで物を拾い、腕を振りかぶる。', text: '5〜11 m 先から、拾った物を投げる。投げた後に動けば当たらない。' },
  frenzy: { name: '連続噛み', tell: '歯を鳴らし、首を振る。', text: 'すぐ近くで、二度続けて噛みつく。歯の音が聞こえたら下がる。' },
  rake: { name: '引っかき', tell: '両腕を高く上げる。', text: '爪で引っかく。傷から血が出て、手当てするまで体力が少しずつ減る。' },
  ambush: { name: '待ち伏せ', tell: '物陰で、湿った息をしている。', text: '動かずに待ち、近くを通ると飛び出す。息の音のする所には近づかない。' },
  tackle: { name: '押し倒し', tell: '頭を下げ、足で床をこする。', text: '体当たりで押し倒す。倒れると、起きるまで動けない。' },
};

// one profile per spawn: n (name), age, job, kind, moves, how (how they turned). A spawn with no profile gets its pattern's default.
export const PROFILES = {
  // ---- the hospital: one move at a time
  Z_SHO_EAT: { n: '坂口 啓介', age: 41, job: '内科の当直医', kind: 'slow', moves: ['frenzy'], how: '私の前の当直。処置室で、運ばれてきた男を診ていた。男が起き上がった時、最初に噛まれたのが彼だった。それでも、男の手当てをやめなかった。' },
  Z_CRAWL: { n: '中井 亮', age: 29, job: '放射線科の技師', kind: 'crawler', moves: ['ankle'], how: '検査室から逃げる途中、防火扉に脚を挟まれた。外れないまま夜が来て、噛まれた。脚は、扉の向こうに置いてきた。' },
  Z_ROKA1: { n: '田辺 早苗', age: 34, job: '病棟の看護師', kind: 'brisk', moves: ['rake'], how: '申し送りの紙を書いた人。暴れる患者を押さえて、腕を引っかかれた。「大丈夫」と書き残して、廊下で倒れた。' },
  Z_YAKU: { n: '大川 正', age: 67, job: '612号室の入院患者', kind: 'slow', moves: ['ambush'], how: '眠れずに薬剤部へ薬を探しに来た。棚の陰で倒れた看護師を起こそうとして、噛まれた。今も棚の陰にいる。' },
  Z_WATARI: { n: '名前の分からない男性', age: 52, job: '東病棟の入院患者', kind: 'slow', moves: [], how: '東病棟で夜を越した人。渡り廊下の天井が落ちて、向こう側に取り残された。瓦礫の上から、こちらへ手を伸ばしている。' },
  Z_ROKA2: { n: '佐野 和子', age: 58, job: '夜の清掃係', kind: 'slow', moves: ['ankle'], how: '廊下の床を拭いていた。這ってきた技師に足首をつかまれた。倒れたまま、通る足を待っている。' },
  Z_REI1: { n: '名前の分からない男性', age: 80, job: '病棟から霊安室へ', kind: 'slow', moves: [], how: '夕方、病棟で亡くなった人。噛まれてはいない。それでも、夜のうちに起き上がった。……死ねば誰でも起きる、ということだ。' },
  Z_REI2: { n: '名前の分からない女性', age: 74, job: '救急外来から霊安室へ', kind: 'slow', moves: ['rake'], how: '救急で運ばれ、間に合わなかった人。シーツの下で、爪が伸びたままの手が出ていた。' },
  Z_REI3: { n: '名前の分からない男性', age: 45, job: '処置室から霊安室へ', kind: 'brisk', moves: ['dash'], how: '最初に噛まれて運ばれた人。処置室で一度死に、霊安室へ移された。誰より早く、誰より長く、この体で動いている。' },
  Z_HAN1: { n: '大塚 武', age: 52, job: '施設課の職員', kind: 'heavy', moves: ['throw'], how: '搬入口のシャッターを閉めに来て、外から入ってきた群れに追いつかれた。工具を投げて戦った。今も、手に触れた物を投げる。' },
  // ---- the streets
  Z_URA1: { n: '谷口 誠', age: 38, job: '製薬会社の営業', kind: 'slow', moves: ['ankle'], how: '病院へ薬を届けに来た夜だった。駐車場で車を降りたところを噛まれ、車の横で倒れていた。' },
  Z_URA2: { n: '原田 由美', age: 44, job: '主婦', kind: 'brisk', moves: ['rake'], how: '熱を出した息子を連れて夜間外来に来た。息子を先に逃がして、自分は残った。' },
  Z_URA3: { n: '岩井 翔', age: 19, job: '専門学校生', kind: 'runner', moves: ['dash'], how: 'バイクで友達を病院へ運んできた。友達は助からず、起き上がった友達に噛まれた。若い脚で、今もよく走る。' },
  Z_URA4: { n: '松浦 浩二', age: 33, job: '夜間の受付係', kind: 'slow', moves: ['swipe'], how: '受付の窓口を閉めて帰る途中、駐車場で倒れた。長い腕を振り回して、まだ誰かを追い返そうとしている。' },
  Z_OD1: { n: '森田 沙織', age: 27, job: '会社員', kind: 'brisk', moves: [], how: '終電を逃して大通りを歩いていた。止まった車の間で、運転手だった人に噛まれた。' },
  Z_OD2: { n: '杉本 一郎', age: 56, job: '会社員', kind: 'slow', moves: ['vomit'], how: '飲み会の帰り、気分が悪くなって車に乗せてもらった。その車の中で、隣の人が起き上がった。' },
  Z_OD3: { n: '名前の分からない人', age: null, job: '雨合羽の人', kind: 'slow', moves: ['ambush'], how: 'バスの陰に立っていた。いつから、なぜ雨合羽なのかは分からない。動かずに、通る人を待っている。' },
  Z_OD4: { n: '倉持 保', age: 61, job: 'タクシーの運転手', kind: 'heavy', moves: ['vomit'], how: '客を乗せたまま、大通りで車が止まった。客を守ろうとして、車の中で何度も噛まれた。体が腐って膨れている。撃つと破裂する。' },
  Z_OD5: { n: '名前の分からない人', age: null, job: '吐きかける者', kind: 'slow', moves: [], how: '喉が腐って、中身を遠くへ吐きかけるようになった。いつ、どこで噛まれたのかは誰も見ていない。' },
  Z_OD6: { n: '吉村 健', age: 48, job: '会社員', kind: 'slow', moves: ['throw'], how: '大通りで車を捨てて歩いていた。歩道の植木鉢を投げて群れを追い払おうとして、追いつかれた。' },
  Z_OD_R1: { n: '小西 恵', age: 39, job: '主婦', kind: 'slow', moves: ['ankle'], how: 'バスを待っていた。バスは来ず、停留所で倒れた。倒れたまま、通る足を待っている。' },
  Z_SATAKE: { n: '佐竹 茂', age: 58, job: '佐竹工務店の大工', kind: 'heavy', moves: ['swipe'], how: '病院の窓をふさぐ仕事の帰り、搬入口で噛まれた。釘で切ったと言い張り、釘打ち機を借りて家に戻った。最後に、それを医者に渡した。「そいつで、頼む」と言い残して。' },
  Z_MF1: { n: '本田 大作', age: 45, job: '引っ越し業者', kind: 'brute', moves: ['swipe'], how: '丸福マートのフードコートで、最後まで客を外へ出していた。戸を閉めた権藤たちに置いていかれた。大きな体は、今もフードコートを守っている。' },
  Z_MF2: { n: '岡 真由', age: 24, job: 'フードコートの店員', kind: 'runner', moves: ['pounce'], how: '閉店の片付けをしていた。ガラスを割って入ってきた群れから、テーブルを跳び越えて逃げた。その跳び方のまま、今は跳びかかる。' },
  Z_MF3: { n: '西川 誠', age: 31, job: 'マートの店員', kind: 'slow', moves: ['frenzy'], how: 'フードコートを閉めるために残された。床に倒れたまま、歯を鳴らしている。' },
  Z_MC1: { n: '石田 ふみ', age: 79, job: '常連の客', kind: 'slow', moves: ['rake'], how: '倒れた客は冷蔵室に運ばれた。その一人。権藤たちは「死体だ」と言って扉を閉めた。' },
  Z_MC2: { n: '中山 久美', age: 41, job: '常連の客', kind: 'slow', moves: ['ambush'], how: '冷蔵室に運ばれた一人。冷たい部屋の奥で、動かずに戸が開くのを待っている。' },
  Z_MR1: { n: '名前の分からない人', age: null, job: '屋上の見張り', kind: 'slow', moves: ['throw'], how: 'マートの屋上で見張りをしていた店の人。噛まれたことを隠して、見張りを続けていた。屋上の物を、下へ投げる。' },
  Z_SH1: { n: '坂田 キヨ', age: 83, job: '乾物屋の店主', kind: 'slow', moves: [], how: '商店街で五十年、店を開けてきた。シャッターを下ろす前に、客が倒れこんできた。' },
  Z_SH2: { n: '長尾 勝', age: 57, job: '魚屋', kind: 'heavy', moves: ['swipe'], how: '工事用のヘルメットをかぶって、商店街の入口を守っていた。頭は固いまま、腕の力も残っている。' },
  Z_SH3: { n: '村上 達也', age: 35, job: '焼き鳥屋', kind: 'brisk', moves: ['frenzy'], how: '店に火が回った夜、逃げ遅れた客を中から出した。焼けた体で、今も店の前を歩いている。' },
  Z_SH4: { n: '佐伯 しのぶ', age: 62, job: '呉服屋のおかみ', kind: 'slow', moves: ['pounce'], how: '着物の展示会の夜だった。店の奥に逃げ込み、戸を開けた客に噛まれた。' },
  Z_CH1: { n: '白坂 修の兄', age: 70, job: '黎明の会の信者', kind: 'kept', moves: ['rake'], how: '弟の白坂が「お還りさま」と呼び、鎖でつないだ最初の一人。噛まれたのは、会の集まりの夜だった。' },
  Z_CH2: { n: '名前の分からない花嫁', age: 28, job: '式の帰りの花嫁', kind: 'kept', moves: ['pounce'], how: '公民館で式の二次会をしていた。会の人たちは、花嫁を「清い」と言って鎖でつないだ。' },
  Z_CH3: { n: '名前の分からない少女', age: 16, job: '浴衣の少女', kind: 'kept', moves: ['frenzy'], how: '夏祭りの準備に来ていた。会の人たちは、浴衣のまま鎖につないだ。' },
  Z_CH4: { n: '名前の分からない老女', age: 81, job: '黎明の会の信者', kind: 'kept', moves: [], how: '会のいちばん古い信者。自分から鎖につながれることを望んだと、会の人は言う。' },
  Z_PEN1: { n: '白坂 千代', age: 66, job: '白坂の妻', kind: 'kept', moves: [], how: '白坂の妻。夫は、彼女が「還ってきた」と信じた。ガラスの囲いの中で、白い着物のまま立っている。' },
  Z_PEN2: { n: '名前の分からない老女', age: 77, job: '黎明の会の信者', kind: 'kept', moves: [], how: '囲いの中の一人。会の人は毎朝、ガラス越しに手を合わせる。' },
  Z_PEN3: { n: '名前の分からない少女', age: 14, job: '信者の娘', kind: 'kept', moves: [], how: '母親が会に連れてきた娘。母親は、もう公民館にいない。' },
  Z_HI1: { n: '小林 健太', age: 26, job: '機動隊員', kind: 'heavy', moves: ['tackle'], how: '署の前の広場を、盾と防具で守っていた。防具は今も体を守っている。押し倒す力も残っている。' },
  Z_HI_B: { n: '大河原 猛', age: 30, job: 'ジムのトレーナー', kind: 'brute', moves: ['throw'], how: '署へ避難しようとする人たちを運んでいた。広場で噛まれ、そのまま大きな体で人を追い返している。' },
  Z_HI2: { n: '高木 渉', age: 50, job: '会社員', kind: 'brisk', moves: ['dash'], how: '署へ助けを求めに来た。土のうの前で、入れてもらえないまま夜が明けた。' },
  // ---- the police station
  Z_PSHOKO: { n: '留置番号 7', age: 22, job: '留置されていた男', kind: 'runner', moves: ['pounce'], how: '万引きで捕まり、留置場にいた。騒ぎの中で鍵を開けてもらい、証拠品の保管庫に隠れた。そこで噛まれた。' },
  Z_PROKA: { n: '石田 誠', age: 25, job: '巡査', kind: 'brisk', moves: ['dash'], how: '叫んで皆を呼び、逃がそうとした。噛まれた後も、喉は叫ぶことを覚えている。叫べば、ほかの者が集まる。' },
  Z_RYU1: { n: '北村 大輔', age: 33, job: '警備課の警官', kind: 'brute', moves: ['tackle'], how: '留置場の見張り。防護服のまま、閉じ込めた署長たちと一緒に残った。防具は今も弾を弾く。' },
  Z_RYU2: { n: '藤原 恒夫', age: 58, job: '灯ヶ浦警察署の署長', kind: 'slow', moves: ['swipe'], how: '日誌に「留置場に避難する」と書いた署長。噛まれた部下を中に入れた夜、留置場は閉じられた。' },
  Z_RYU3: { n: '原 和也', age: 46, job: '巡査部長', kind: 'brisk', moves: ['frenzy'], how: '署長と一緒に留置場に閉じ込められた。最後まで、鍵を開けるなと言っていた。' },
  Z_RYU4: { n: '三浦 隆', age: 29, job: '警備課の警官', kind: 'heavy', moves: ['tackle'], how: '盾を、最後まで離さなかった。その腕で、今も押し倒そうとする。' },
  Z_UR1: { n: '佐々木 拓', age: 23, job: '陸上部の大学生', kind: 'runner', moves: ['pounce'], how: '夜のランニングの途中、署の裏の駐車場に逃げ込んだ。走る脚だけは、生きていた頃のままだ。' },
  Z_UR2: { n: '井上 美咲', age: 31, job: '夜のジョギングの人', kind: 'runner', moves: ['dash'], how: '毎晩、港まで走っていた。昨夜も、走って逃げきれるはずだった。' },
  Z_UR3: { n: '川口 悠真', age: 16, job: '高校生', kind: 'runner', moves: ['frenzy'], how: '塾の帰り、署に逃げ込もうとした。裏口は、もう閉められていた。' },
  Z_UR4: { n: '前田 健二', age: 37, job: '配達の人', kind: 'runner', moves: ['tackle'], how: '伝票に、この署の宛名。届けに来て、裏の駐車場で噛まれた。ヘルメットはかぶったまま。' },
  Z_PL1: { n: '今井 信也', age: 42, job: 'ビルの会社員', kind: 'brisk', moves: ['throw'], how: 'ビルから広場へ逃げ出した。広場の物を投げて群れを止めようとして、囲まれた。' },
  Z_PL2: { n: '上田 彩', age: 26, job: 'ビルの会社員', kind: 'runner', moves: ['dash'], how: '残業の帰りに、ビルの前で倒れた人を助け起こした。' },
  Z_PL3: { n: '名前の分からない男', age: null, job: '長いコートの男', kind: 'heavy', moves: ['swipe'], how: '広場をうろついていた背の高い男。腕が長い。誰なのかは分からない。' },
  // ---- the tower
  Z_OL1: { n: '島田 節子', age: 63, job: 'ビルの清掃係', kind: 'slow', moves: ['ambush'], how: '夜明け前の掃除の人。ロビーの柱の陰で、噛まれた手を洗っていた。' },
  Z_OL2: { n: '村瀬 洋平', age: 39, job: '総務部', kind: 'brisk', moves: ['rake'], how: '社員証を首から下げたまま。避難の案内をしようとして、ロビーで引っかかれた。' },
  Z_OL3: { n: '小池 由香', age: 25, job: 'ロビーの受付', kind: 'runner', moves: ['pounce'], how: '自動ドアが止まる前に、外の人を中へ入れた。入れた中の一人が、噛まれていた。' },
  Z_K0: { n: '名前の分からない警備員', age: 55, job: 'ビルの夜間警備', kind: 'slow', moves: ['ambush'], how: '名簿の「ほか二名」の一人。階段の下で、上がってくる者を待つように立っている。' },
  Z_OF1: { n: '森下 剛', age: 36, job: '営業二課', kind: 'brisk', moves: ['dash'], how: '残業中に騒ぎを聞き、同僚を連れて逃げようとした。同僚の吉岡は、もう噛まれていた。' },
  Z_OF2: { n: '吉岡 誠司', age: 44, job: '営業二課', kind: 'slow', moves: ['vomit'], how: '外回りの帰りに噛まれ、黙って会社に戻った。気分が悪いと言って、机に伏せていた。' },
  Z_OF3: { n: '堀 智子', age: 33, job: '経理部', kind: 'slow', moves: ['ankle'], how: '机の下に隠れていた。隠れたまま倒れ、隠れたまま待っている。' },
  Z_OF4: { n: '坂井 亮介', age: 24, job: '派遣社員', kind: 'heavy', moves: ['tackle'], how: '入館証の日付は昨日。初日の夜に、防災用のヘルメットとベストを着て、同僚を守った。' },
  Z_SRV: { n: '岩田 俊', age: 41, job: '情報システム部', kind: 'brisk', moves: ['frenzy'], how: 'サーバー室の火を消そうとして、焼けた。焼けながら、噛まれていた。' },
  Z_SK1: { n: '名前の分からない調理人', age: 48, job: '社員食堂の調理人', kind: 'brute', moves: ['throw'], how: '厨房に逃げ込んできた人たちに飯を作っていた。白い帽子のまま、鍋や皿を投げる。' },
  Z_SK2: { n: '中川 美穂', age: 30, job: '総務部', kind: 'slow', moves: ['ankle'], how: '食堂で休憩していた。机の間に倒れたまま、足を待っている。' },
  Z_SK3: { n: '松井 拓也', age: 28, job: '営業一課', kind: 'brisk', moves: ['frenzy'], how: '箸を持ったまま。夜食を食べていた時、隣の席の人が起き上がった。' },
  Z_YK1: { n: '藤田 玲子', age: 47, job: '秘書室', kind: 'brute', moves: ['swipe'], how: '会長室の前で、会長を待っていた。会長は来なかった。大きくなった体で、今も扉の前に立つ。' },
  Z_YK2: { n: '名前の分からない人', age: null, job: '法務部', kind: 'runner', moves: ['pounce'], how: '社員証の名前の所が、もうない。体もほとんど骨だが、軽くなった分、よく跳ぶ。' },
  Z_YK3: { n: '沢口 實', age: 64, job: '役員運転手', kind: 'heavy', moves: ['vomit'], how: '会長を乗せる車を地下で待っていた。体が膨れて、撃つと破裂する。' },
  Z_K3: { n: '名前の分からない警備員', age: 49, job: 'ビルの夜間警備', kind: 'slow', moves: [], how: '名簿の、もう一人。階段の上で、喉の奥の物を吐きかける。' },
  // ---- the roof: the big one
  ROOF_GIANT: { n: '名前の分からない大男', age: null, job: '屋上に上がってきた者', kind: 'brute', moves: ['tackle'], how: 'ヘリの音に集まった群れの、いちばん後ろから上がってきた。どこから来たのかは、誰も知らない。' },
};

// a spawn without a profile (a roof wave): its pattern decides
const BY_PATTERN = { runner: 'runner', jogger: 'runner', schoolboy: 'runner', police: 'heavy', riot: 'heavy', giant: 'brute', crawler: 'crawler', spitter: 'slow', bloated: 'heavy' };
const ROOF_MOVES = { salaryman: ['dash'], 'office-woman': ['pounce'], clerk: ['frenzy'], runner: ['dash'], 'salaryman-rot': ['vomit'], cleaner: ['rake'], police: ['tackle'], giant: ['tackle'] };
export function profileOf(def) {
  const P = PROFILES[def.id] || (def.p === 'giant' ? PROFILES.ROOF_GIANT : null);
  if (P) return { ...P, id: def.id };
  const roof = def.room === 'O_ROOF', kind = def.chained ? 'kept' : def.brute ? 'brute' : BY_PATTERN[def.p] || (roof ? 'brisk' : 'slow');
  return { id: def.id, n: '', kind, moves: roof ? ROOF_MOVES[def.p] || [] : [], how: '' };
}
