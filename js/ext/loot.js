// What lies in the world (picked up with [E] into the case) and what the boxes hold. { id, room, x, z, item, n, y? }
export const LOOT = [
  // the hospital
  { id: 'L_TOU_W', room: 'H_TOU', x: 4.6, z: 1.6, item: 'water', n: 1 },
  { id: 'L_NS_B', room: 'H_NS', x: 13.2, z: 2.4, item: 'bandage', n: 2 },
  { id: 'L_BYO_W', room: 'H_BYO', x: 17.5, z: 4.2, item: 'water', n: 1 },
  { id: 'L_YAKU_D', room: 'H_YAKU', x: 18.8, z: 10.4, item: 'disinfect', n: 1 },
  { id: 'L_YAKU_B', room: 'H_YAKU', x: 12.8, z: 10.2, item: 'bandage', n: 1 },
  { id: 'L_KEI_C', room: 'H_KEI', x: 8.4, z: 9.6, item: 'canned', n: 1 },
  { id: 'L_REI_N', room: 'H_REI', x: 26.2, z: 9.0, item: 'nails', n: 10 },
  { id: 'L_HAN_N', room: 'H_HAN', x: 31.6, z: 11.6, item: 'nails', n: 12 },
  { id: 'L_HAN_M', room: 'H_HAN', x: 28.6, z: 3.0, item: 'medkit', n: 1 },
  // the streets
  { id: 'L_URA_N', room: 'S_URA', x: 39.4, z: 5.0, item: 'nails', n: 16 },
  { id: 'L_URA_M', room: 'S_URA', x: 46.0, z: 8.6, item: 'aidkit', n: 1 },
  { id: 'L_OD_N', room: 'S_ODORI', x: 56.5, z: -3.3, item: 'nails', n: 12 },
  { id: 'L_OD_C', room: 'S_ODORI', x: 61.6, z: 5.0, item: 'canned', n: 1 },
  { id: 'L_OD_B', room: 'S_ODORI', x: 65.2, z: 4.8, item: 'bandage', n: 1 },
  { id: 'L_MART_C', room: 'S_MART', x: 60.6, z: 9.2, item: 'canned', n: 2 },
  { id: 'L_MART_W', room: 'S_MART', x: 67.6, z: 9.6, item: 'water', n: 1 },
  { id: 'L_SH_D', room: 'S_SHOTEN', x: 60.0, z: 17.0, item: 'disinfect', n: 1 },
  { id: 'L_SH_N', room: 'S_SHOTEN', x: 69.0, z: 21.3, item: 'nails', n: 12 },
  { id: 'L_YAMA_W', room: 'S_YAMA', x: 49.6, z: 27.0, item: 'water', n: 1 },
  { id: 'L_YAMA_B', room: 'S_YAMA', x: 52.2, z: 25.6, item: 'bandage', n: 2 },
  { id: 'L_KOMIN_C', room: 'S_KOMIN', x: 65.8, z: 29.8, item: 'canned', n: 1 },
  { id: 'L_HI_P', room: 'S_HIROBA', x: 86.2, z: 18.2, item: 'p9', n: 8 },
  { id: 'L_HI_B', room: 'S_HIROBA', x: 92.2, z: 20.2, item: 'bandage', n: 1 },
  // the police station
  { id: 'L_PL_P', room: 'P_LOBBY', x: 102.4, z: 12.6, item: 'p9', n: 8 },
  { id: 'L_PK_M', room: 'P_KYU', x: 103.2, z: 4.6, item: 'medkit', n: 1 },
  { id: 'L_PS_C', room: 'P_SHI', x: 110.6, z: 2.6, item: 'casing', n: 8 },
  { id: 'L_PH_N', room: 'P_HATSU', x: 106.0, z: 10.2, item: 'nails', n: 12 },
  { id: 'L_PT_B', room: 'P_TSU', x: 119.8, z: 4.6, item: 'bandage', n: 1 },
  { id: 'L_PR_P', room: 'P_ROKA', x: 119.4, z: 7.5, item: 'p9', n: 8 },
  { id: 'L_PU_P', room: 'P_URA', x: 123.2, z: 6.0, item: 'p9', n: 8 },
  { id: 'L_PU_S', room: 'P_URA', x: 126.6, z: 21.0, item: 'shell', n: 4 },
  // the tower
  { id: 'L_OL_P', room: 'O_LOBBY', x: 142.2, z: 2.6, item: 'p9', n: 8 },
  { id: 'L_OL_B', room: 'O_LOBBY', x: 130.4, z: 12.6, item: 'bandage', n: 2 },
  { id: 'L_OB_M', room: 'O_BOSAI', x: 146.6, z: 5.6, item: 'medkit', n: 1 },
  { id: 'L_OF_P', room: 'O_OFF', x: 143.6, z: 12.6, item: 'p9', n: 8 },
  { id: 'L_OF_C', room: 'O_OFF', x: 130.4, z: 1.2, item: 'canned', n: 1 },
  { id: 'L_OS_S', room: 'O_SRV', x: 151.0, z: 6.2, item: 'shell', n: 4 },
  { id: 'L_SK_W', room: 'O_SHOK', x: 141.6, z: 2.6, item: 'water', n: 1 },
  { id: 'L_K2_P', room: 'O_KAI2', x: 147.0, z: 9.0, item: 'p9', n: 8 },
  { id: 'L_YK_P', room: 'O_YAKU', x: 142.8, z: 2.2, item: 'p9', n: 8 },
  { id: 'L_YK_M', room: 'O_YAKU', x: 130.6, z: 12.8, item: 'medkit', n: 1 },
  // the roof: what the last stand needs
  { id: 'L_RF_P', room: 'O_ROOF', x: 131.0, z: 2.0, item: 'p9', n: 16 },
  { id: 'L_RF_S', room: 'O_ROOF', x: 143.0, z: 12.4, item: 'shell', n: 8 },
  { id: 'L_RF_R', room: 'O_ROOF', x: 130.6, z: 12.4, item: 'rifleAmmo', n: 3 },
  { id: 'L_RF_M', room: 'O_ROOF', x: 143.6, z: 1.6, item: 'medkit', n: 1 },
];
// the boxes (a task's station): what comes out
export const BOXES = {
  T_CART: [['scalpel', 1], ['bandage', 2]],
  T_TOOLBOX: [['pipe', 1]],
  T_CASE: [['nailgun', 1, { loaded: 12 }], ['nails', 24]],
  T_AXE: [['axe', 1]],
  T_FUEL: [['powder', 1], ['casing', 4]],
  T_SHOKO: [['shotgun', 1, { loaded: 4 }], ['shell', 8]],
  T_RIFLE: [['rifle', 1, { loaded: 3 }], ['rifleAmmo', 6]],
};
// the armory: shared half and half, or everything
export const RACK = { share: [['pistol', 1, { loaded: 8 }], ['p9', 24]], all: [['pistol', 1, { loaded: 8 }], ['p9', 48], ['shell', 8], ['medkit', 1]] };
