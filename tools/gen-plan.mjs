#!/usr/bin/env node
// data/plan.json of 夜勤明けの街 from the compact tables below (rooms, doors, stations, furniture). Coordinates in metres: x east, z south,
// a room's (x, z) is its north-west corner; a door's (x, z) is the middle of its opening on the shared wall; furniture (x, z) is its centre.
//   node tools/gen-plan.mjs        (writes data/plan.json; then npm run plan)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// [id, name, x, z, w, d, { floor, kind, type, safe, lamp, h, edge, step }]
const R = [
  // ---- 1 病院 (灯ヶ浦市民病院 2 階の内科病棟と、1 階の裏) ----
  ['H_TOU', '当直室', 0, 0, 6, 5, { type: 'hospital', safe: true, lamp: '#f2d9a8' }],
  ['H_NS', 'ナースステーション', 6, 0, 8, 5, { type: 'hospital', lamp: '#dfeef0' }],
  ['H_BYO', '四人部屋の病室', 14, 0, 7, 5, { type: 'hospital', lamp: '#cfe3e3' }],
  ['H_SHO', '処置室', 21, 0, 6, 5, { type: 'hospital', lamp: '#bcd6d0' }],
  ['H_ROKA', '病棟の廊下', 0, 5, 27, 3, { kind: 'corridor', type: 'corridor', lamp: '#9fc6bc' }],
  ['H_DEN', '配電室', 0, 8, 6, 5, { type: 'workshop', lamp: '#c9d4c8' }],
  ['H_KEI', '警備室', 6, 8, 6, 5, { type: 'office', lamp: '#d4dde0' }],
  ['H_YAKU', '薬剤部', 12, 8, 8, 5, { type: 'hospital', lamp: '#e3eeea' }],
  ['H_REI', '霊安室', 20, 8, 7, 5, { type: 'hospital', lamp: '#a8c4c8' }],
  ['H_HAN', '搬入口', 27, 0, 6, 13, { type: 'workshop', lamp: '#b8c2b0' }],
  // ---- 2 街 (夜の灯ヶ浦、ナトリウム灯) ----
  ['S_URA', '病院裏の駐車場', 33, 0, 14, 13, { kind: 'outdoor', type: 'street', edge: 'none', lamp: '#f0a050' }],
  ['S_ODORI', '大通り', 47, -4, 25, 10, { kind: 'outdoor', type: 'street', edge: 'none', lamp: '#f0a050' }],
  ['S_MART', '丸福マート', 58, 6, 12, 10, { type: 'shop', lamp: '#f4ecd0' }],
  ['S_SHOTEN', '商店街', 47, 16, 36, 6, { kind: 'outdoor', type: 'street', edge: 'none', lamp: '#e89a48' }],
  ['S_YAMA', '山とキャンプの店', 47, 22, 8, 6, { type: 'shop', safe: true, lamp: '#f0d8a8' }],
  ['S_SHOBO', '消防団の倉庫', 55, 22, 5, 6, { type: 'storage', lamp: '#d8b890' }],
  ['S_KOMIN', '公民館', 64, 22, 12, 9, { type: 'office', lamp: '#f0b870' }],
  ['S_HIROBA', '署前の広場', 83, 6, 12, 16, { kind: 'outdoor', type: 'street', edge: 'none', lamp: '#8fb0e8' }],
  // ---- 3 警察署 (灯ヶ浦警察署) ----
  ['P_LOBBY', '署のロビー', 95, 6, 10, 8, { type: 'office', lamp: '#bcd0f0' }],
  ['P_KYU', '休憩室', 95, 0, 10, 6, { type: 'office', safe: true, lamp: '#e8d8b0' }],
  ['P_ROKA', '署の廊下', 105, 6, 16, 3, { kind: 'corridor', type: 'corridor', lamp: '#9cb4e0' }],
  ['P_SHI', '資料室', 105, 0, 8, 6, { type: 'office', lamp: '#c8d4ec' }],
  ['P_TSU', '通信室', 113, 0, 8, 6, { type: 'office', lamp: '#b0c8f0' }],
  ['P_HATSU', '発電機室', 105, 9, 6, 6, { type: 'workshop', lamp: '#c0c8d8' }],
  ['P_BUKI', '武器庫', 111, 9, 5, 6, { type: 'storage', lamp: '#c8d0e0' }],
  ['P_SHOKO', '証拠品保管庫', 116, 9, 5, 6, { type: 'storage', lamp: '#c0c8d8' }],
  ['P_RYU', '留置場', 95, 14, 10, 8, { type: 'workshop', lamp: '#a0b0d0' }],
  ['P_URA', '署の裏の駐車場', 121, 0, 8, 22, { kind: 'outdoor', type: 'street', edge: 'none', lamp: '#f0a050' }],
  // ---- 4 臨港セントラルビル (0〜3 階、4 階は屋上) ----
  ['O_PLAZA', 'ビル前の広場', 129, 14, 24, 10, { kind: 'outdoor', type: 'street', edge: 'none', lamp: '#e8eef8' }],
  ['O_LOBBY', 'ビルのロビー', 129, 0, 16, 14, { type: 'office', lamp: '#eef4ff' }],
  ['O_BOSAI', '防災センター', 145, 0, 8, 7, { type: 'office', safe: true, lamp: '#dce8f4' }],
  ['O_KAI0', '非常階段（1階）', 145, 7, 8, 7, { kind: 'stairs', type: 'corridor', lamp: '#c8d8c0' }],
  ['O_OFF', '2階のオフィス', 129, 0, 16, 14, { floor: 1, type: 'office', lamp: '#eef4ff' }],
  ['O_SRV', 'サーバー室', 145, 0, 8, 7, { floor: 1, type: 'workshop', lamp: '#b8d0ff' }],
  ['O_KAI1', '非常階段（2階）', 145, 7, 8, 7, { kind: 'stairs', floor: 1, type: 'corridor', lamp: '#c8d8c0' }],
  ['O_SHOK', '3階の社員食堂', 129, 0, 16, 14, { floor: 2, type: 'office', lamp: '#f4f0e0' }],
  ['O_CHU', '厨房', 145, 0, 8, 7, { floor: 2, type: 'kitchen', lamp: '#f0ece0' }],
  ['O_KAI2', '非常階段（3階）', 145, 7, 8, 7, { kind: 'stairs', floor: 2, type: 'corridor', lamp: '#c8d8c0' }],
  ['O_YAKU', '4階の役員フロア', 129, 0, 16, 14, { floor: 3, type: 'office', lamp: '#f0e4cc' }],
  ['O_KAICHO', '会長室', 145, 0, 8, 7, { floor: 3, type: 'office', lamp: '#f0d8b0' }],
  ['O_KAI3', '非常階段（4階）', 145, 7, 8, 7, { kind: 'stairs', floor: 3, type: 'corridor', lamp: '#c8d8c0' }],
  ['O_ROOF', '屋上ヘリポート', 129, 0, 16, 14, { floor: 4, kind: 'outdoor', type: 'street', edge: 'none', lamp: '#f8c8a0' }],
  ['O_KAI4', '屋上の塔屋', 145, 7, 8, 7, { kind: 'stairs', floor: 4, type: 'corridor', lamp: '#d0d8c8' }],
];

// [id, a, b, x, z, { width, unlock, hint, kind, look, open, ends, label }]
const D = [
  ['D_TOU', 'H_TOU', 'H_ROKA', 3, 5, {}],
  ['D_NS', 'H_NS', 'H_ROKA', 10, 5, { unlock: 'ward', hint: '中から何かで押さえられている。叩くと、女の人の声が「電気が戻るまで開けられない」と言った。' }],
  ['D_BYO', 'H_BYO', 'H_ROKA', 17.5, 5, { unlock: 'ward', hint: '病室の戸は電気の錠。電気が戻るまで開かない。' }],
  ['D_SHO', 'H_SHO', 'H_ROKA', 24, 5, { unlock: 'morgue', look: 'glass', hint: 'ガラス戸の向こうで、何かが床の人を食べている。いまは開けない。' }],
  ['D_DEN', 'H_DEN', 'H_ROKA', 3, 8, {}],
  ['D_KEI', 'H_KEI', 'H_ROKA', 9, 8, { unlock: 'ward', hint: '電気の錠が落ちている。電気が戻るまで開かない。' }],
  ['D_YAKU', 'H_YAKU', 'H_ROKA', 16, 8, { unlock: 'ward', hint: '薬剤部は電気の錠。電気が戻るまで開かない。' }],
  ['D_REI', 'H_REI', 'H_ROKA', 23.5, 8, { unlock: 'morgue', hint: '霊安室は、警備室のカードで開く。' }],
  ['D_HAN', 'H_ROKA', 'H_HAN', 27, 6.5, { unlock: 'morgue', hint: '搬入口への扉は、警備室のカードで開く。' }],
  ['D_SHUT', 'H_HAN', 'S_URA', 33, 6.5, { width: 2.6, unlock: 'street', hint: 'シャッターは下りたまま。霊安室の鍵束に、シャッターの鍵があるはず。' }],
  ['D_URA_OD', 'S_URA', 'S_ODORI', 47, 2.5, { width: 5, open: true }],
  ['D_MART_F', 'S_ODORI', 'S_MART', 62, 6, { width: 1.8, look: 'glass' }],
  ['D_MART_B', 'S_MART', 'S_SHOTEN', 62, 16, { width: 1.6, hint: '権藤が、レジの前から見張っている。話をつけるまで、奥へは通してくれない。' }],
  ['D_MART_K', 'S_MART', 'S_SHOTEN', 68.5, 16, { width: 1.4, hint: '搬入口の戸。内側からかんぬき、外に南京錠。' }],
  ['D_YAMA', 'S_SHOTEN', 'S_YAMA', 51, 22, { width: 1.6, look: 'glass' }],
  ['D_SHOBO', 'S_SHOTEN', 'S_SHOBO', 57.5, 22, { width: 1.6, hint: '消防団の倉庫。南京錠がかかっている。鍵は団員が持っている。' }],
  ['D_KOMIN', 'S_SHOTEN', 'S_KOMIN', 70, 22, { width: 1.8 }],
  ['D_SHO_HI', 'S_SHOTEN', 'S_HIROBA', 83, 19, { width: 4, unlock: 'police', hint: '商店街の出口に縄が張られ、鎖につながれたゾンビが並んでいる。公民館の人たちのしわざだ。' }],
  ['D_PLOBBY', 'S_HIROBA', 'P_LOBBY', 95, 10, { width: 1.8, look: 'glass', unlock: 'police', hint: '署の入口は、中から土のうでふさがれている。' }],
  ['D_PKYU', 'P_LOBBY', 'P_KYU', 100, 6, { hint: '休憩室の戸は、中から机で押さえられている。' }],
  ['D_PROKA', 'P_LOBBY', 'P_ROKA', 105, 7.5, {}],
  ['D_PSHI', 'P_ROKA', 'P_SHI', 109, 6, {}],
  ['D_PTSU', 'P_ROKA', 'P_TSU', 117, 6, { hint: '通信室は、電気が来るまで電気錠が開かない。' }],
  ['D_PHATSU', 'P_ROKA', 'P_HATSU', 108, 9, {}],
  ['D_PBUKI', 'P_ROKA', 'P_BUKI', 113.5, 9, { hint: '武器庫の扉は、金庫のような番号錠。番号は、片桐さんも知らない。' }],
  ['D_PSHOKO', 'P_ROKA', 'P_SHOKO', 118.5, 9, {}],
  ['D_PRYU', 'P_LOBBY', 'P_RYU', 100, 14, { hint: '留置場の扉。中で何かが鉄格子を叩いている。' }],
  ['D_PURA', 'P_ROKA', 'P_URA', 121, 7.5, { unlock: 'backyard', hint: '裏口は、片桐さんたちが鎖で縛ってある。署の用が済むまで開けない、と言っていた。' }],
  ['D_URA_PL', 'P_URA', 'O_PLAZA', 129, 18, { width: 4, open: true }],
  ['D_OLOBBY', 'O_PLAZA', 'O_LOBBY', 137, 14, { width: 2.4, look: 'glass', unlock: 'tower', hint: 'ガラスの自動ドアは止まっている。' }],
  ['D_OBOSAI', 'O_LOBBY', 'O_BOSAI', 145, 3.5, {}],
  ['D_OKAI0', 'O_LOBBY', 'O_KAI0', 145, 10.5, {}],
  ['D_OSRV', 'O_OFF', 'O_SRV', 145, 3.5, {}],
  ['D_OKAI1', 'O_OFF', 'O_KAI1', 145, 10.5, {}],
  ['D_OCHU', 'O_SHOK', 'O_CHU', 145, 3.5, { hint: '厨房の戸は、中から押さえられている。' }],
  ['D_OKAI2', 'O_SHOK', 'O_KAI2', 145, 10.5, {}],
  ['D_OKAICHO', 'O_YAKU', 'O_KAICHO', 145, 3.5, {}],
  ['D_OKAI3', 'O_YAKU', 'O_KAI3', 145, 10.5, {}],
  ['D_OROOF', 'O_KAI4', 'O_ROOF', 145, 10.5, { width: 1.4, unlock: 'rooftop', hint: '屋上への扉。鍵がかかっている。鍵は会長室にあると、野口さんが言っていた。' }],
  // floors of the tower
  ['ST01', 'O_KAI0', 'O_KAI1', null, null, { kind: 'stairs', look: 'flight', label: '非常階段を上がる', ends: { a: { x: 149, z: 9, arrive: [148, 12], yaw: Math.PI }, b: { x: 149, z: 12.6, arrive: [149, 10.2], yaw: 0 } } }],
  ['EV12', 'O_OFF', 'O_SHOK', null, null, { kind: 'lift', label: 'エレベーターで3階へ', ends: { a: { x: 143.5, z: 7, arrive: [142, 7], yaw: -Math.PI / 2 }, b: { x: 143.5, z: 7, arrive: [142, 7], yaw: -Math.PI / 2 } } }],
  ['ST23', 'O_KAI2', 'O_KAI3', null, null, { kind: 'stairs', look: 'flight', label: '非常階段を上がる', ends: { a: { x: 149, z: 9, arrive: [148, 12], yaw: Math.PI }, b: { x: 149, z: 12.6, arrive: [149, 10.2], yaw: 0 } } }],
  ['ST34', 'O_KAI3', 'O_KAI4', null, null, { kind: 'stairs', look: 'flight', label: '塔屋へ上がる', ends: { a: { x: 151.5, z: 9, arrive: [151, 12], yaw: Math.PI }, b: { x: 151.5, z: 12.6, arrive: [150, 10], yaw: 0 } } }],
];

// [id, room, x, z, label, { talk, reach }]
const S = [
  ['S_CART', 'H_TOU', 1.0, 3.6, '救急カート'],
  ['S_TOOL', 'H_DEN', 5.2, 12.2, '工具箱'],
  ['S_BREAKER', 'H_DEN', 0.6, 10.5, '非常用の配電盤'],
  ['S_CHISATO', 'H_NS', 9.5, 1.6, '宮下さん', { talk: true }],
  ['S_RADIO', 'H_NS', 12.6, 0.6, '防災無線の受信機'],
  ['S_NOTE', 'H_KEI', 7.0, 12.2, '警備主任の机'],
  ['S_SAFE', 'H_KEI', 11.4, 9.0, '警備室の金庫'],
  ['S_DRUGS', 'H_YAKU', 15.5, 12.4, '薬品棚'],
  ['S_GENZO', 'H_BYO', 19.5, 2.0, '戸川さん', { talk: true }],
  ['S_MDESK', 'H_REI', 26.3, 12.2, '霊安室の机'],
  ['S_FCASE', 'H_REI', 20.6, 12.3, '施設課の工具ケース'],
  ['S_SHUTTER', 'H_HAN', 32.4, 4.2, 'シャッターの巻き上げ'],
  ['S_GONDO', 'S_MART', 62, 8.2, '権藤', { talk: true }],
  ['S_MARTLOCK', 'S_MART', 68.5, 15.3, '搬入口の南京錠'],
  ['S_CAGE', 'S_YAMA', 53.6, 26.5, '燃料の鍵付きの棚'],
  ['S_PACK', 'S_YAMA', 48.4, 24.5, '登山リュックの棚'],
  ['S_AXE', 'S_SHOBO', 59.4, 26.8, '消防団の道具箱'],
  ['S_SHIRA', 'S_KOMIN', 70, 29.2, '白坂', { talk: true }],
  ['S_ROPE', 'S_SHOTEN', 81.4, 19, '参道の縄'],
  ['S_KATA', 'P_KYU', 100, 1.6, '片桐さん', { talk: true }],
  ['S_GEN', 'P_HATSU', 106, 13.8, '非常用発電機'],
  ['S_RECORD', 'P_SHI', 106.4, 1.0, '当直の記録の棚'],
  ['S_ARMORY', 'P_ROKA', 113.5, 8.6, '武器庫の番号錠'],
  ['S_RACK', 'P_BUKI', 113.5, 14.3, '銃の保管庫'],
  ['S_BOARD', 'P_TSU', 120.3, 2.0, '通信室の交換台'],
  ['S_TAPE', 'P_TSU', 114.0, 1.0, '留守番の録音機'],
  ['S_EVID', 'P_SHOKO', 120.4, 13.0, '押収品のロッカー'],
  ['S_NOGUCHI', 'O_BOSAI', 149, 2.0, '野口さん', { talk: true }],
  ['S_SERVER', 'O_SRV', 152.4, 2.4, 'サーバーの冷却盤'],
  ['S_HAYASE', 'O_SHOK', 144.2, 3.5, '厨房の戸の向こうの男', { talk: true }],
  ['S_ODOOR', 'O_PLAZA', 137, 14.6, '止まった自動ドア'],
  ['S_FORCE', 'O_KAI4', 145.7, 9.2, '屋上への扉の錠'],
  ['S_RIFLE', 'O_KAICHO', 152.3, 4.5, '猟銃のケース'],
  ['S_HELI', 'O_ROOF', 135, 6, 'ヘリポート'],
];

// [id, room, x, z, w, d, kind, { rot, args, opts }]
const F = [
  ['F_TOU_SOFA', 'H_TOU', 3.2, 0.6, 1.8, 0.8, 'bench'],
  ['F_TOU_DESK', 'H_TOU', 5.2, 3.2, 1.2, 0.6, 'desk', { rot: 90 }],
  ['F_TOU_LOCK', 'H_TOU', 0.4, 1.2, 0.5, 0.6, 'locker', { rot: 90 }],
  ['F_NS_COUNTER', 'H_NS', 10, 3.6, 4.0, 0.6, 'counter', { args: [4] }],
  ['F_NS_SHELF', 'H_NS', 6.4, 1.6, 0.45, 1.8, 'shelf', { rot: 90 }],
  ['F_BYO_BED1', 'H_BYO', 15.4, 1.3, 1.0, 2.0, 'bed'],
  ['F_BYO_BED2', 'H_BYO', 19.6, 3.6, 1.0, 2.0, 'bed'],
  ['F_SHO_BED', 'H_SHO', 24, 1.4, 1.0, 2.0, 'bed'],
  ['F_DEN_SHELF', 'H_DEN', 3, 12.6, 1.8, 0.45, 'shelf'],
  ['F_DEN_DRUM', 'H_DEN', 5.4, 8.6, 0.6, 0.6, 'drum'],
  ['F_KEI_DESK', 'H_KEI', 7.4, 12.4, 1.4, 0.7, 'desk'],
  ['F_KEI_MON', 'H_KEI', 11.4, 10.8, 0.6, 1.4, 'steelDesk', { rot: 90 }],
  ['F_YAKU_S1', 'H_YAKU', 13.5, 12.6, 2.4, 0.45, 'shelf'],
  ['F_YAKU_S2', 'H_YAKU', 17.8, 12.6, 2.4, 0.45, 'shelf'],
  ['F_YAKU_CNT', 'H_YAKU', 16, 9.4, 3.0, 0.6, 'counter', { args: [3] }],
  ['F_REI_CAB', 'H_REI', 23.4, 12.5, 3.0, 0.8, 'bodyCabinets'],
  ['F_REI_DESK', 'H_REI', 26.3, 11.6, 0.7, 1.2, 'desk', { rot: 90 }],
  ['F_HAN_CRATE1', 'H_HAN', 28, 11.8, 0.8, 0.8, 'crate'],
  ['F_HAN_CRATE2', 'H_HAN', 28.9, 12.2, 0.8, 0.8, 'crate'],
  ['F_HAN_PALLET', 'H_HAN', 30.4, 1.0, 1.2, 1.0, 'pallet'],
  // the street: cars that will not move shape the way (the dot layer swaps each car body for a car part)
  ['F_CAR1', 'S_URA', 37, 2.2, 1.8, 4.2, 'car', { rot: 0 }],
  ['F_CAR2', 'S_URA', 41.5, 10.5, 4.2, 1.8, 'car', { rot: 90 }],
  ['F_AMBU', 'S_URA', 44.2, 3.5, 2.0, 5.0, 'car', { rot: 10 }],
  ['F_CAR3', 'S_ODORI', 51, -1.6, 4.2, 1.8, 'car', { rot: 90 }],
  ['F_CAR4', 'S_ODORI', 55.5, 3.6, 4.2, 1.8, 'car', { rot: 75 }],
  ['F_CAR5', 'S_ODORI', 60, -2.0, 4.2, 1.8, 'car', { rot: 100 }],
  ['F_CAR6', 'S_ODORI', 66.2, 2.5, 4.2, 1.8, 'car', { rot: 80 }],
  ['F_BUS', 'S_ODORI', 70.4, 1, 2.6, 9.6, 'car', { rot: 0 }],
  ['F_MART_S1', 'S_MART', 59, 12.5, 0.45, 5.0, 'shelf', { rot: 90 }],
  ['F_MART_S2', 'S_MART', 65.4, 11, 0.45, 4.0, 'shelf', { rot: 90 }],
  ['F_MART_CNT', 'S_MART', 66.8, 7.0, 2.4, 0.6, 'counter', { args: [2.4] }],
  ['F_MART_FRIDGE', 'S_MART', 69.4, 11.6, 0.7, 2.0, 'fridge', { rot: -90 }],
  ['F_SHOTEN_V', 'S_SHOTEN', 48.0, 16.6, 0.7, 0.7, 'vendingMachine'],
  ['F_SHOTEN_CAR', 'S_SHOTEN', 75, 20.6, 4.2, 1.8, 'car', { rot: 90 }],
  ['F_YAMA_S1', 'S_YAMA', 47.5, 26, 0.45, 2.4, 'shelf', { rot: 90 }],
  ['F_YAMA_CNT', 'S_YAMA', 51.5, 23.0, 2.0, 0.6, 'counter', { args: [2] }],
  ['F_SHOBO_S', 'S_SHOBO', 55.4, 25, 0.45, 2.0, 'shelf', { rot: 90 }],
  ['F_KOMIN_T', 'S_KOMIN', 70, 27.6, 2.4, 0.9, 'table'],
  ['F_KOMIN_B1', 'S_KOMIN', 66, 25, 1.8, 0.5, 'bench'],
  ['F_KOMIN_B2', 'S_KOMIN', 74, 25, 1.8, 0.5, 'bench'],
  ['F_HIRO_CAR', 'S_HIROBA', 89, 9.5, 1.8, 4.4, 'car', { rot: 15 }],
  ['F_P_CNT', 'P_LOBBY', 100, 8.6, 3.0, 0.6, 'counter', { args: [3] }],
  ['F_P_BENCH', 'P_LOBBY', 96, 12.8, 0.5, 1.8, 'bench', { rot: 90 }],
  ['F_P_KYU_T', 'P_KYU', 98, 3.2, 1.2, 0.7, 'table'],
  ['F_P_KYU_L', 'P_KYU', 104.4, 1.6, 0.5, 0.6, 'locker', { rot: -90 }],
  ['F_P_SHI_S1', 'P_SHI', 109, 0.4, 2.4, 0.45, 'shelf'],
  ['F_P_SHI_D', 'P_SHI', 111.5, 4.0, 1.4, 0.7, 'desk'],
  ['F_P_TSU_D', 'P_TSU', 117, 0.5, 2.0, 0.7, 'steelDesk'],
  ['F_P_GEN', 'P_HATSU', 108.6, 14.2, 1.6, 0.9, 'tank'],
  ['F_P_BUKI_L', 'P_BUKI', 115.6, 11.5, 0.5, 2.0, 'locker', { rot: -90 }],
  ['F_P_SHOKO_S', 'P_SHOKO', 117.5, 14.6, 2.4, 0.45, 'shelf'],
  ['F_P_RYU_B', 'P_RYU', 96.0, 18, 0.5, 1.8, 'bench', { rot: 90 }],
  ['F_P_CAR', 'P_URA', 125, 4, 1.8, 4.2, 'car', { rot: 0 }],
  ['F_P_CAR2', 'P_URA', 125.8, 15, 1.8, 4.2, 'car', { rot: 0 }],
  ['F_PL_CAR', 'O_PLAZA', 148, 19, 4.2, 1.8, 'car', { rot: 90 }],
  ['F_O_CNT', 'O_LOBBY', 133, 3.0, 3.0, 0.6, 'counter', { args: [3] }],
  ['F_O_BENCH', 'O_LOBBY', 130, 10, 0.5, 1.8, 'bench', { rot: 90 }],
  ['F_O_BOSAI_D', 'O_BOSAI', 150.5, 0.5, 2.0, 0.7, 'steelDesk'],
  ['F_O_OFF_D1', 'O_OFF', 133, 4, 1.4, 0.7, 'desk'],
  ['F_O_OFF_D2', 'O_OFF', 137, 4, 1.4, 0.7, 'desk'],
  ['F_O_OFF_D3', 'O_OFF', 133, 9, 1.4, 0.7, 'desk'],
  ['F_O_OFF_D4', 'O_OFF', 137, 9, 1.4, 0.7, 'desk'],
  ['F_O_OFF_S', 'O_OFF', 129.4, 6, 0.45, 2.4, 'shelf', { rot: 90 }],
  ['F_O_SRV1', 'O_SRV', 147, 5.8, 1.2, 0.8, 'cabinet'],
  ['F_O_SRV2', 'O_SRV', 149, 5.8, 1.2, 0.8, 'cabinet'],
  ['F_O_SHOK_T1', 'O_SHOK', 134, 4, 2.4, 0.9, 'table'],
  ['F_O_SHOK_T2', 'O_SHOK', 134, 9, 2.4, 0.9, 'table'],
  ['F_O_SHOK_T3', 'O_SHOK', 139, 6.5, 2.4, 0.9, 'table'],
  ['F_O_CHU_C', 'O_CHU', 149, 6.2, 3.0, 0.6, 'counter', { args: [3] }],
  ['F_O_CHU_F', 'O_CHU', 152.5, 4.0, 0.7, 0.7, 'fridge', { rot: -90 }],
  ['F_O_YAKU_S', 'O_YAKU', 131, 1.8, 2.0, 0.9, 'bench'],
  ['F_O_YAKU_D', 'O_YAKU', 138, 7, 1.4, 0.7, 'desk'],
  ['F_O_KAICHO_D', 'O_KAICHO', 149, 2.2, 1.6, 0.8, 'desk'],
];

const REASON = {
  D_PKYU: 'the break room opens off the lobby counter (a small station: the lobby is its hall)',
  D_PRYU: 'the cells are reached through the lobby desk, so the desk officer watches them',
  default: 'an open-plan office floor: the side rooms and the fire stair open straight off it',
  stair: 'the fire stair: one flight per floor',
};
const round = (v) => Math.round(v * 1000) / 1000;
const plan = { lampPool: true, rooms: [], doors: [], stations: [], furniture: [], start: 'H_TOU', spawn: { x: 2.6, z: 2.3, yaw: Math.PI }, exits: ['O_ROOF'],
  checks: { ignore: ['no-loop', 'exits-few', 'direct-total', 'direct-per-room', 'no-corridor'], why: 'a one-way escape across a town: hospital ward -> streets -> police station -> an office tower climbed floor by floor. Each building is its own short level; the only way out is the roof helipad, and the tower floors are open-plan halls with side rooms off them. The enemies are slow zombies that wander and gather to noise, not a chaser that needs a loop.' } };
for (const [id, name, x, z, w, d, o] of R) {
  const r = { id, name, x, z, w, d, kind: o.kind || 'room', ...(o.floor ? { floor: o.floor } : {}), type: o.type, ...(o.safe ? { safe: true } : {}), ...(o.edge ? { edge: o.edge } : {}), ...(o.lamp ? { lamp: o.lamp } : {}), ...(o.step ? { step: o.step } : {}) };
  plan.rooms.push(r);
}
for (const [id, a, b, x, z, o] of D) {
  const dd = { id, a, b, ...(x != null ? { x, z } : {}), width: o.width || 1.4, ...o };
  delete dd.width; dd.width = o.width || 1.4;
  if (dd.ends) for (const k of ['a', 'b']) { const e = dd.ends[k]; if (e.yaw != null) e.yaw = round(e.yaw); }
  if (/^(D_O|ST|EV)/.test(id) || REASON[id]) dd.reason = REASON[id] || (/^(ST|EV)/.test(id) ? REASON.stair : REASON.default);
  plan.doors.push(dd);
}
for (const [id, room, x, z, label, o = {}] of S) plan.stations.push({ id, room, x, z, label, ...o });
for (const [id, room, x, z, w, d, kind, o = {}] of F) plan.furniture.push({ id, room, x, z, w, d, kind, ...o });
fs.writeFileSync(path.join(ROOT, 'data/plan.json'), JSON.stringify(plan, null, 1) + '\n');
console.log(`plan: ${plan.rooms.length} rooms, ${plan.doors.length} doors, ${plan.stations.length} stations, ${plan.furniture.length} furniture`);
