// What goes into the case (the grid bag): weapons, ammunition, medicine, food and parts. The kit's 持ち物 (items.json) keeps only the
// keys and the story things; everything with a shape lives here. Shapes are cells (w x h, rotated by 90 degrees in the case).
//   melee: { dmg, reach (m), rate (s between swings), knock (0..1) }   gun: { dmg, pellets, spread (rad), mag, ammo, noise (m), rate }
export const CATALOG = {
  hands: { name: '素手', w: 0, h: 0, kind: 'weapon', melee: { dmg: 8, reach: 1.4, rate: 0.6, knock: 0.6 }, hidden: true },
  scalpel: { name: 'メス', w: 1, h: 2, kind: 'weapon', melee: { dmg: 24, reach: 1.6, rate: 0.42, knock: 0.1 }, desc: '救急カートのメス。軽くて速いが、届かない。', icon: 'scalpel' },
  pipe: { name: '鉄パイプ', w: 1, h: 4, kind: 'weapon', melee: { dmg: 40, reach: 2.1, rate: 0.85, knock: 0.9 }, desc: '配電室の鉄パイプ。重いが、頭に当てれば一撃。', icon: 'pipe' },
  axe: { name: '消防斧', w: 2, h: 4, kind: 'weapon', melee: { dmg: 75, reach: 2.2, rate: 1.05, knock: 1, sever: true }, desc: '消防団の斧。腕も脚も落とせる。', icon: 'axe' },
  nailgun: { name: '釘打ち機', w: 2, h: 2, kind: 'weapon', gun: { dmg: 24, mag: 12, ammo: 'nails', noise: 7, rate: 0.28, spread: 0.014 }, desc: '施設課の電動釘打ち機。音が小さい。', icon: 'nailgun' },
  pistol: { name: '拳銃', w: 2, h: 1, kind: 'weapon', gun: { dmg: 38, mag: 8, ammo: 'p9', noise: 22, rate: 0.3, spread: 0.008 }, desc: '署の拳銃。音で、遠くのゾンビも呼ぶ。', icon: 'pistol' },
  shotgun: { name: '散弾銃', w: 4, h: 1, kind: 'weapon', gun: { dmg: 14, pellets: 8, mag: 4, ammo: 'shell', noise: 30, rate: 0.95, spread: 0.07 }, desc: '押収品の散弾銃。近くの群れに。', icon: 'shotgun' },
  nails: { name: '釘', w: 1, h: 1, kind: 'ammo', stack: 24, desc: '釘打ち機の釘。', icon: 'nails' },
  p9: { name: '拳銃の弾', w: 1, h: 1, kind: 'ammo', stack: 16, desc: '拳銃の弾。', icon: 'p9' },
  shell: { name: '散弾', w: 1, h: 1, kind: 'ammo', stack: 8, desc: '散弾銃の弾。', icon: 'shell' },
  rifle: { name: '猟銃', w: 5, h: 2, kind: 'weapon', gun: { dmg: 120, mag: 3, ammo: 'rifleAmmo', noise: 34, rate: 1.25, spread: 0.002, pierce: 2 }, desc: '会長の猟銃。一発で二体を抜く。', icon: 'rifle' },
  rifleAmmo: { name: '猟銃の弾', w: 1, h: 1, kind: 'ammo', stack: 6, desc: '猟銃の弾。', icon: 'rifleAmmo' },
  bandage: { name: '包帯', w: 1, h: 1, kind: 'med', heal: 18, stack: 3, desc: '体力が少し戻る。消毒液と組み合わせると手当てセットになる。', icon: 'bandage' },
  disinfect: { name: '消毒液', w: 1, h: 1, kind: 'part', desc: '包帯と組み合わせる。', icon: 'disinfect' },
  aidkit: { name: '手当てセット', w: 1, h: 2, kind: 'med', heal: 45, desc: '包帯と消毒液。体力が半分ほど戻る。', icon: 'aidkit' },
  medkit: { name: '救急箱', w: 2, h: 2, kind: 'med', heal: 75, desc: '体力がほとんど戻る。', icon: 'medkit' },
  canned: { name: '缶詰', w: 1, h: 1, kind: 'med', heal: 10, stack: 2, desc: '食べると、体力が少し戻る。', icon: 'canned' },
  water: { name: '水', w: 1, h: 2, kind: 'med', heal: 8, desc: '飲むと、体力が少し戻る。', icon: 'water' },
  powder: { name: '火薬', w: 1, h: 1, kind: 'part', desc: '空の薬莢と組み合わせると、散弾になる。', icon: 'powder' },
  casing: { name: '空の薬莢', w: 1, h: 1, kind: 'part', stack: 8, desc: '火薬と組み合わせると、散弾になる。', icon: 'casing' },
};

// combining: two ids (either order) -> what they become
export const COMBOS = [
  { a: 'bandage', b: 'disinfect', make: { id: 'aidkit', n: 1 }, say: '包帯と消毒液で、手当てセットを作った。' },
  { a: 'powder', b: 'casing', make: { id: 'shell', n: 4 }, say: '空の薬莢に火薬を詰めて、散弾を四発作った。' },
];
export const comboOf = (a, b) => COMBOS.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a)) || null;

export const BAGS = { doctor: { name: '往診かばん', w: 6, h: 4 }, pack: { name: '登山リュック', w: 8, h: 5 } };
export const STORE = { w: 10, h: 8 };   // the storage box of the safe rooms (one shared box, like a locker the night staff share)

// pure grid helpers (tests: test/case.test.mjs)
export const dims = (it) => { const c = CATALOG[it.id]; return it.rot ? [c.h, c.w] : [c.w, c.h]; };
export function fits(list, W, H, it, x, y, rot = it.rot, skip = null) {
  const c = CATALOG[it.id]; const [w, h] = rot ? [c.h, c.w] : [c.w, c.h];
  if (x < 0 || y < 0 || x + w > W || y + h > H) return false;
  for (const o of list) {
    if (o === skip || o.uid === (skip && skip.uid)) continue;
    const [ow, oh] = dims(o);
    if (x < o.x + ow && o.x < x + w && y < o.y + oh && o.y < y + h) return false;
  }
  return true;
}
/** the first free place (rows first, unrotated then rotated) or null */
export function findPlace(list, W, H, it) {
  for (const rot of [0, 1]) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (fits(list, W, H, it, x, y, rot)) return { x, y, rot };
  return null;
}
