// Where the zombies are, room by room. { id, room, x, z, p (pattern of assets/zombies), yaw, state ('idle' | 'eat' | 'wake' | 'corpse'),
// stage (from this stage on), after (once this task is done), until (gone once this task is done), flag / notFlag (G.flags), chained }.
// The roof waves of the last stage are made by js/ext/story.js (G.extraZombie).
const W = Math.PI / 2;
export const SPAWNS = [
  // ---- the hospital ----
  { id: 'Z_SHO_EAT', room: 'H_SHO', x: 23.2, z: 2.9, p: 'doctor', state: 'eat', yaw: 0, stage: 'L1' },
  { id: 'Z_CRAWL', room: 'H_ROKA', x: 20.5, z: 6.5, p: 'crawler', yaw: -W, after: 'T_TOOLBOX', sight: 20 },
  { id: 'Z_ROKA1', room: 'H_ROKA', x: 13.5, z: 6.8, p: 'nurse-rot', yaw: W, stage: 'L2' },
  { id: 'Z_YAKU', room: 'H_YAKU', x: 14, z: 10.6, p: 'patient', yaw: 0, stage: 'L2' },
  { id: 'Z_ROKA2', room: 'H_ROKA', x: 5, z: 6.6, p: 'cleaner', yaw: W, after: 'T_SAFE' },
  { id: 'Z_REI1', room: 'H_REI', x: 21.6, z: 10.2, p: 'old-man', state: 'wake', after: 'T_REI' },
  { id: 'Z_REI2', room: 'H_REI', x: 23.6, z: 9.6, p: 'old-woman', state: 'wake', after: 'T_REI' },
  { id: 'Z_REI3', room: 'H_REI', x: 25.6, z: 10.0, p: 'salaryman', state: 'wake', after: 'T_REI' },
  { id: 'Z_HAN1', room: 'H_HAN', x: 30.2, z: 7.5, p: 'worker', yaw: -W, stage: 'L3' },
  // ---- the streets ----
  { id: 'Z_URA1', room: 'S_URA', x: 38.5, z: 7.2, p: 'salaryman', yaw: -W, after: 'T_SHUTTER' },
  { id: 'Z_URA2', room: 'S_URA', x: 42.5, z: 6.2, p: 'housewife', yaw: -W, after: 'T_SHUTTER' },
  { id: 'Z_URA3', room: 'S_URA', x: 36, z: 11.5, p: 'punk', yaw: 0, after: 'T_SHUTTER' },
  { id: 'Z_URA4', room: 'S_URA', x: 45, z: 10.5, p: 'clerk', yaw: -W, after: 'T_SHUTTER' },
  { id: 'Z_OD1', room: 'S_ODORI', x: 52.5, z: 1.4, p: 'office-woman', yaw: -W, stage: 'L4' },
  { id: 'Z_OD2', room: 'S_ODORI', x: 58, z: 1.8, p: 'salaryman-rot', yaw: -W, stage: 'L4' },
  { id: 'Z_OD3', room: 'S_ODORI', x: 63.5, z: -2.8, p: 'raincoat', yaw: -W, stage: 'L4' },
  { id: 'Z_OD4', room: 'S_ODORI', x: 63, z: 4.4, p: 'bloated', yaw: -W, stage: 'L4' },
  { id: 'Z_OD5', room: 'S_ODORI', x: 67.8, z: -1.6, p: 'spitter', yaw: -W, stage: 'L4' },
  { id: 'Z_OD6', room: 'S_ODORI', x: 55, z: -2.6, p: 'salaryman-dry', yaw: -W, stage: 'L4' },
  { id: 'Z_SH1', room: 'S_SHOTEN', x: 57, z: 19.4, p: 'old-woman', yaw: W, stage: 'L4' },
  { id: 'Z_SH2', room: 'S_SHOTEN', x: 64, z: 18.2, p: 'fisherman', yaw: -W, stage: 'L4' },
  { id: 'Z_SH3', room: 'S_SHOTEN', x: 72.5, z: 18.6, p: 'burnt', yaw: -W, stage: 'L4' },
  { id: 'Z_SH4', room: 'S_SHOTEN', x: 50, z: 20.4, p: 'kimono', yaw: W, stage: 'L4' },
  // the chained 「お還りさま」 of the 黎明の会 at the exit of the arcade: they stand on their chains; set loose when the fight starts
  { id: 'Z_CH1', room: 'S_SHOTEN', x: 80.4, z: 17.2, p: 'mourner', yaw: -W, stage: 'L4', chained: true, notFlag: 'cult:taken' },
  { id: 'Z_CH2', room: 'S_SHOTEN', x: 80.4, z: 20.8, p: 'bride', yaw: -W, stage: 'L4', chained: true, notFlag: 'cult:taken' },
  { id: 'Z_CH3', room: 'S_SHOTEN', x: 79.4, z: 19.0, p: 'yukata', yaw: -W, stage: 'L4', chained: true, notFlag: 'cult:taken' },
  { id: 'Z_CH4', room: 'S_SHOTEN', x: 79.8, z: 21.3, p: 'old-woman', yaw: -W, stage: 'L4', chained: true, notFlag: 'cult:taken', rot: 0.15 },
  { id: 'Z_HI1', room: 'S_HIROBA', x: 88, z: 15, p: 'police', yaw: -W, stage: 'L5' },
  { id: 'Z_HI2', room: 'S_HIROBA', x: 91.5, z: 8.2, p: 'salaryman-dry', yaw: W, stage: 'L5' },
  // ---- the police station ----
  { id: 'Z_PSHOKO', room: 'P_SHOKO', x: 118, z: 11.2, p: 'punk', yaw: Math.PI, stage: 'L5' },
  { id: 'Z_PROKA', room: 'P_ROKA', x: 112, z: 7.6, p: 'screamer', yaw: -W, after: 'T_GEN' },
  { id: 'Z_RYU1', room: 'P_RYU', x: 98, z: 18, p: 'riot', yaw: Math.PI, after: 'T_GEN' },
  { id: 'Z_RYU2', room: 'P_RYU', x: 101, z: 19.2, p: 'police', yaw: Math.PI, after: 'T_GEN' },
  { id: 'Z_RYU3', room: 'P_RYU', x: 103, z: 17, p: 'police', yaw: Math.PI, after: 'T_GEN', rot: 0.5 },
  { id: 'Z_RYU4', room: 'P_RYU', x: 99.5, z: 20.6, p: 'riot', yaw: Math.PI, after: 'T_GEN' },
  // ---- the back of the station and the plaza: the runners ----
  { id: 'Z_UR1', room: 'P_URA', x: 125, z: 9.5, p: 'runner', yaw: Math.PI, stage: 'L6' },
  { id: 'Z_UR2', room: 'P_URA', x: 124, z: 18.5, p: 'jogger', yaw: Math.PI, stage: 'L6' },
  { id: 'Z_UR3', room: 'P_URA', x: 127, z: 12.5, p: 'schoolboy', yaw: Math.PI, stage: 'L6' },
  { id: 'Z_UR4', room: 'P_URA', x: 123, z: 20.5, p: 'rider', yaw: Math.PI, stage: 'L6' },
  { id: 'Z_PL1', room: 'O_PLAZA', x: 140, z: 19.5, p: 'salaryman', yaw: -W, stage: 'L6' },
  { id: 'Z_PL2', room: 'O_PLAZA', x: 146, z: 21.5, p: 'office-woman', yaw: -W, stage: 'L6' },
  { id: 'Z_PL3', room: 'O_PLAZA', x: 134, z: 20.5, p: 'tall-coat', yaw: W, stage: 'L6' },
  // ---- the tower ----
  { id: 'Z_OL1', room: 'O_LOBBY', x: 136, z: 8.5, p: 'cleaner', yaw: 0, stage: 'L7' },
  { id: 'Z_OL2', room: 'O_LOBBY', x: 140.5, z: 11, p: 'salaryman-dry', yaw: 0, stage: 'L7' },
  { id: 'Z_OL3', room: 'O_LOBBY', x: 131.5, z: 6.2, p: 'office-woman', yaw: W, stage: 'L7' },
  { id: 'Z_K0', room: 'O_KAI0', x: 149.5, z: 11.6, p: 'hunched', yaw: -W, stage: 'L7' },
  { id: 'Z_OF1', room: 'O_OFF', x: 135, z: 6.5, p: 'salaryman', yaw: W, stage: 'L7' },
  { id: 'Z_OF2', room: 'O_OFF', x: 139.5, z: 11.2, p: 'salaryman-rot', yaw: W, stage: 'L7' },
  { id: 'Z_OF3', room: 'O_OFF', x: 131.5, z: 11.5, p: 'office-woman', yaw: W, stage: 'L7', rot: 0.4 },
  { id: 'Z_OF4', room: 'O_OFF', x: 141.5, z: 2.5, p: 'clerk', yaw: 0, stage: 'L7' },
  { id: 'Z_SRV', room: 'O_SRV', x: 147.6, z: 2.6, p: 'burnt', yaw: -W, stage: 'L7' },
  { id: 'Z_SK1', room: 'O_SHOK', x: 138, z: 12.2, p: 'chef', yaw: 0, stage: 'L7' },
  { id: 'Z_SK2', room: 'O_SHOK', x: 131.5, z: 3, p: 'clerk', yaw: W, stage: 'L7', rot: 0.55 },
  { id: 'Z_SK3', room: 'O_SHOK', x: 137, z: 6.6, p: 'salaryman', yaw: W, stage: 'L7', rot: 0.1 },
  { id: 'Z_YK1', room: 'O_YAKU', x: 136, z: 4.6, p: 'tall-coat', yaw: W, stage: 'L7' },
  { id: 'Z_YK2', room: 'O_YAKU', x: 140, z: 10.5, p: 'skeletal', yaw: W, stage: 'L7' },
  { id: 'Z_YK3', room: 'O_YAKU', x: 132.5, z: 11.4, p: 'bloated', yaw: W, stage: 'L7' },
  { id: 'Z_K3', room: 'O_KAI3', x: 150.2, z: 8.6, p: 'spitter', yaw: Math.PI, stage: 'L7' },
];
// the roof waves (story.js) draw from these
export const ROOF_WAVE = ['salaryman', 'office-woman', 'clerk', 'runner', 'salaryman-rot', 'cleaner', 'police', 'giant'];
export const PATTERNS = [...new Set([...SPAWNS.map((s) => s.p), ...ROOF_WAVE])];
