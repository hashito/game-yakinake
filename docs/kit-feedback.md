# 夜勤明けの街からキットへ（気づいたこと）

作っていて、キットに入れると他の作品にも効きそうなこと。キットに入れたものは版を書く。

## 入れたもの

- **1.25.3**：夜の街の部品（`yakinake-*`、族 yk-car・yk-bus・yk-helicopter・yk-weapon-box）。車 6 種・パトカー・救急車・横倒しのバス・救助ヘリ・救急カート・工具箱・銃の保管庫（満・半分・空）・銃のケース。

## まだのもの（提案）

- **dot-zombie に部屋の中を歩く足がない**：`z.update` はまっすぐ進むだけで、壁も家具も抜ける。この作品は `js/ext/zombies.js` で、部屋の矩形・開いた戸・家具の当たり箱で押し戻し、戸から戸へ BFS で進ませている（`settle`・`nextDoor`）。プランを持つ作品なら同じ形で使えるので、キットの `zombie-nav.js` にできる。
- **dot-zombie の素材が型ごとに共有**：一体ずつ色・腐り具合を変えるには、作った後に材質を複製して色を掛ける必要があった（`spawn` の traverse）。`createZombie(pat, { tint, decay })` があると楽。
- **ext.registerSystem を game:ready の中で呼ぶと動かない**：何も言わずに無視される。boot の後の登録は警告を出すか、そのまま足すとよい（この作品は dot 層で一度はまった）。
- **reading lane（物の札）が開いている間、`g.blocked()` は true だが `g.ui.open`・`g.wm.isOpen` は false**：テストの「窓を閉じる」がこれを見落とす。smoke.mjs の dismiss も `ctx.blockers` を見るとよい。
- **`ctx.wm.isOpen` は真偽値**：関数だと思って `isOpen('case')` と書くと、窓が開いたときだけ例外になる。`wm.current` と並べて書いてあると間違えにくい。
- **check-select-range の 120 秒**：ゾンビ 37 型・人 10 人・写真をドットにする作品は起動に 60〜90 秒かかり、雛形の test/select.test.mjs の spawn の timeout（120 s）では足りなかった（280 s にした）。
