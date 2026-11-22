// What lies in the world (picked up with [E] into the case) and what the boxes hold. { id, room, x, z, item, n, on?, at?, lvl?, why? }
// 1.2.0 (play test #4 「基本的に棚や床に落ちているものを取得する感じ」): most things lie on furniture - on: the furniture id (data/plan.json, the
// room types' auto_* pieces, or a mood prop's id in js/dot/index.js), at: where along its long side (0..1), lvl: 'mid' / 'low' for a shelf's
// boards. js/dot/index.js puts each one down on the first surface under it. A few lie on the floor, each for a reason (why: dropped, by a body).
// x / z stay as the place on the floor when the furniture is missing.
export const LOOT = [
  // the hospital
  { id: 'L_TOU_W', room: 'H_TOU', x: 4.6, z: 1.6, item: 'water', n: 1, on: 'F_TOU_DESK', at: 0.05 },
  { id: 'L_NS_B', room: 'H_NS', x: 13.2, z: 2.4, item: 'bandage', n: 2, on: 'auto_H_NS_0', at: 0.3 },
  { id: 'L_BYO_W', room: 'H_BYO', x: 17.5, z: 4.2, item: 'water', n: 1, on: 'auto_H_BYO_0', at: 0.6 },
  { id: 'L_YAKU_D', room: 'H_YAKU', x: 18.8, z: 10.4, item: 'disinfect', n: 1, on: 'F_YAKU_S2', at: 0.4 },
  { id: 'L_YAKU_B', room: 'H_YAKU', x: 12.8, z: 10.2, item: 'bandage', n: 1, on: 'F_YAKU_CNT', at: 0.2 },
  { id: 'L_KEI_C', room: 'H_KEI', x: 8.4, z: 9.6, item: 'canned', n: 1, on: 'F_KEI_DESK', at: 0.8 },
  { id: 'L_REI_N', room: 'H_REI', x: 26.2, z: 9.0, item: 'nails', n: 10, on: 'auto_H_REI_0', at: 0.5 },
  { id: 'L_HAN_N', room: 'H_HAN', x: 31.6, z: 11.6, item: 'nails', n: 12, on: 'auto_H_HAN_0', at: 0.3 },
  { id: 'L_HAN_M', room: 'H_HAN', x: 28.6, z: 3.0, item: 'medkit', n: 1, on: 'F_HAN_CRATE1' },
  // the streets
  { id: 'L_URA_N', room: 'S_URA', x: 39.4, z: 5.0, item: 'nails', n: 20, why: 'dropped by the shutter' },
  { id: 'L_URA_M', room: 'S_URA', x: 46.0, z: 8.6, item: 'aidkit', n: 1, on: 'P_URA_GURNEY', at: 0.6 },
  { id: 'L_OD_N', room: 'S_ODORI', x: 56.5, z: -3.3, item: 'nails', n: 18, on: 'F_CAR3', at: 0.1 },
  { id: 'L_OD_C', room: 'S_ODORI', x: 61.6, z: 5.0, item: 'canned', n: 1, on: 'F_CAR6', at: 0.5 },
  { id: 'L_OD_B', room: 'S_ODORI', x: 65.2, z: 4.8, item: 'bandage', n: 1, why: 'by a body at the bus' },
  { id: 'L_MART_C', room: 'S_MART', x: 60.6, z: 9.2, item: 'canned', n: 2, on: 'F_MART_S1', at: 0.4 },
  { id: 'L_MART_W', room: 'S_MART', x: 67.6, z: 9.6, item: 'water', n: 1, on: 'auto_S_MART_0', at: 0.5 },
  { id: 'L_SH_D', room: 'S_SHOTEN', x: 60.0, z: 17.0, item: 'disinfect', n: 1, on: 'F_SHOTEN_STALL', at: 0.2 },
  { id: 'L_SH_N', room: 'S_SHOTEN', x: 67.6, z: 21.3, item: 'nails', n: 18, on: 'F_SHOTEN_CRATE' },
  { id: 'L_YAMA_W', room: 'S_YAMA', x: 49.6, z: 27.0, item: 'water', n: 1, on: 'F_YAMA_S1', at: 0.6 },
  { id: 'L_YAMA_B', room: 'S_YAMA', x: 52.2, z: 25.6, item: 'bandage', n: 2, on: 'auto_S_YAMA_1', at: 0.4 },
  { id: 'L_KOMIN_C', room: 'S_KOMIN', x: 65.8, z: 29.8, item: 'canned', n: 1, on: 'F_KOMIN_T', at: 0.15 },
  { id: 'L_HI_P', room: 'S_HIROBA', x: 86.2, z: 18.2, item: 'p9', n: 8, on: 'F_HIRO_CAR', at: 0.25 },
  { id: 'L_HI_N', room: 'S_HIROBA', x: 88.8, z: 9.2, item: 'nails', n: 18, on: 'F_HIRO_CAR', at: 0.7 },
  // the mart and the 公民館 (1.4.0): nails by the big one in the food court, shells on the roof, food in the kitchen
  { id: 'L_MF_N', room: 'S_MFOOD', x: 75.8, z: 7.4, item: 'nails', n: 16, on: 'F_MFOOD_CNT', at: 0.4 },
  { id: 'L_MF_B', room: 'S_MFOOD', x: 72.6, z: 9.2, item: 'bandage', n: 1, on: 'F_MFOOD_T1', at: 0.5 },
  { id: 'L_MR_S', room: 'S_MROOF', x: 66.4, z: 13.4, item: 'shell', n: 4, on: 'F_MROOF_C' },
  { id: 'L_MR_N', room: 'S_MROOF', x: 61.0, z: 9.0, item: 'nails', n: 12, on: 'F_MROOF_T', at: 0.3 },
  { id: 'L_MS_M', room: 'S_MSEC', x: 57.6, z: 10.2, item: 'aidkit', n: 1, on: 'F_MSEC_L' },
  { id: 'L_KD_C', room: 'S_KDAI', x: 60.5, z: 28.5, item: 'canned', n: 2, on: 'F_KDAI_C', at: 0.5 },
  { id: 'L_YU_N', room: 'S_YAMAURA', x: 54.4, z: 30, item: 'nails', n: 14, on: 'F_YAMAURA_S', at: 0.5 },
  { id: 'L_HI_B', room: 'S_HIROBA', x: 92.2, z: 20.2, item: 'bandage', n: 1, why: 'dropped by the sandbags' },
  // the police station
  { id: 'L_PL_P', room: 'P_LOBBY', x: 102.4, z: 12.6, item: 'p9', n: 8, on: 'auto_P_LOBBY_0', at: 0.3 },
  { id: 'L_PK_M', room: 'P_KYU', x: 103.2, z: 4.6, item: 'medkit', n: 1, on: 'auto_P_KYU_3', at: 0.5 },
  { id: 'L_PS_C', room: 'P_SHI', x: 110.6, z: 2.6, item: 'casing', n: 8, on: 'F_P_SHI_D', at: 0.3 },
  { id: 'L_PH_N', room: 'P_HATSU', x: 106.0, z: 10.2, item: 'nails', n: 12, on: 'auto_P_HATSU_0', at: 0.85 },
  { id: 'L_PT_B', room: 'P_TSU', x: 119.8, z: 4.6, item: 'bandage', n: 1, on: 'auto_P_TSU_0', at: 0.7 },
  { id: 'L_PR_P', room: 'P_ROKA', x: 119.4, z: 7.5, item: 'p9', n: 8, why: 'dropped in the corridor' },
  { id: 'L_PU_P', room: 'P_URA', x: 123.2, z: 6.0, item: 'p9', n: 8, on: 'F_P_CAR', at: 0.2 },
  { id: 'L_PR_S', room: 'P_LOBBY', x: 99.0, z: 13.2, item: 'shell', n: 4, why: 'by the cell door: for the big one in the cells' },
  { id: 'L_PU_S', room: 'P_URA', x: 126.6, z: 21.0, item: 'shell', n: 4, why: 'by a body at the back' },
  // the tower
  { id: 'L_OL_P', room: 'O_LOBBY', x: 142.2, z: 2.6, item: 'p9', n: 8, on: 'F_O_CNT', at: 0.8 },
  { id: 'L_OL_B', room: 'O_LOBBY', x: 130.4, z: 12.6, item: 'bandage', n: 2, on: 'F_O_BENCH' },
  { id: 'L_OB_M', room: 'O_BOSAI', x: 146.6, z: 5.6, item: 'medkit', n: 1, on: 'auto_O_BOSAI_3', at: 0.4 },
  { id: 'L_OF_P', room: 'O_OFF', x: 143.6, z: 12.6, item: 'p9', n: 8, on: 'F_O_OFF_D4', at: 0.75 },
  { id: 'L_OF_C', room: 'O_OFF', x: 130.4, z: 1.2, item: 'canned', n: 1, on: 'F_O_OFF_D1', at: 0.2 },
  { id: 'L_OS_S', room: 'O_SRV', x: 151.0, z: 6.2, item: 'shell', n: 4, on: 'auto_O_SRV_0', at: 0.8 },
  { id: 'L_SK_P', room: 'O_SHOK', x: 134, z: 9, item: 'p9', n: 8, on: 'F_O_SHOK_T2', at: 0.5 },
  { id: 'L_SK_W', room: 'O_SHOK', x: 141.6, z: 2.6, item: 'water', n: 1, on: 'F_O_SHOK_T1', at: 0.7 },
  { id: 'L_K2_P', room: 'O_KAI2', x: 147.0, z: 9.0, item: 'p9', n: 8, why: 'by a body on the stairs' },
  { id: 'L_YK_P', room: 'O_YAKU', x: 142.8, z: 2.2, item: 'p9', n: 8, on: 'F_O_YAKU_D', at: 0.3 },
  { id: 'L_YK_M', room: 'O_YAKU', x: 130.6, z: 12.8, item: 'medkit', n: 1, on: 'auto_O_YAKU_3', at: 0.5 },
  // the roof: what the last stand needs, on the rescue crates
  { id: 'L_RF_P', room: 'O_ROOF', x: 131.0, z: 2.0, item: 'p9', n: 32, on: 'F_RF_C1' },
  { id: 'L_RF_S', room: 'O_ROOF', x: 143.0, z: 12.4, item: 'shell', n: 12, on: 'F_RF_C4' },
  { id: 'L_RF_R', room: 'O_ROOF', x: 130.6, z: 12.4, item: 'rifleAmmo', n: 6, on: 'F_RF_C3' },
  { id: 'L_RF_M', room: 'O_ROOF', x: 143.6, z: 1.6, item: 'medkit', n: 1, on: 'F_RF_C2' },
];
// the boxes (a task's station): what comes out
export const BOXES = {
  T_CART: [['scalpel', 1], ['bandage', 2]],
  T_TOOLBOX: [['pipe', 1]],
  T_CASE: [['nailgun', 1, { loaded: 12 }], ['nails', 30]],
  T_AXE: [['axe', 1]],
  T_FUEL: [['powder', 1], ['casing', 4]],
  T_SHOKO: [['shotgun', 1, { loaded: 4 }], ['shell', 8]],
  T_RIFLE: [['rifle', 1, { loaded: 3 }], ['rifleAmmo', 6]],
};
// the armory: shared half and half, or everything
export const RACK = { share: [['pistol', 1, { loaded: 8 }], ['p9', 24]], all: [['pistol', 1, { loaded: 8 }], ['p9', 48], ['shell', 8], ['medkit', 1]] };
