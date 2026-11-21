// The weapon in the hand: dot pictures seen from behind the shoulder (assets/fp/<id>.png, tools/dot/fpweapons.py, 160 x 96 px),
// drawn on a small canvas that the CSS enlarges with crisp pixels at the lower right. A shot kicks the weapon up and back (more for
// the heavier guns) and puts a muzzle flash on the muzzle point of assets/fp/fp.json; a strike swings it from the right down to the left.
const FP = new URL('../../assets/fp/', import.meta.url).href;
const IDS = ['hands', 'scalpel', 'pipe', 'axe', 'nailgun', 'pistol', 'shotgun', 'rifle'];
const pics = new Map();
let meta = { weapons: {} };
fetch(`${FP}fp.json`).then((r) => r.json()).then((m) => { meta = m; }).catch(() => {});
for (const id of IDS) { const im = new Image(); im.src = `${FP}${id}.png`; im.onload = () => { pics.set(id, im); }; }
// how far each gun kicks (1 = the pistol) and how big its flash is
export const KICK = { nailgun: 0.4, pistol: 1, rifle: 1.5, shotgun: 2.2 };
const FLASH = { nailgun: 0.5, pistol: 1, rifle: 1.3, shotgun: 1.8 };
const YEL = '#ffe08a', WHITE = '#fff8e0', ORANGE = '#ff9a3a';

export function drawWeapon(cv, id, o = {}) {
  const im = pics.get(id) || pics.get('hands');
  const s = o.swing || 0, k = o.kick || 0, f = o.flash ? 1 : 0;
  const key = `${id}|${!!im}|${s.toFixed(2)}|${k.toFixed(2)}|${f}`;
  if (cv._key === key) return;
  cv._key = key;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  if (!im) return;
  const kk = k * (KICK[id] || 1);
  g.save();
  // the kick: up and back toward the shoulder, the muzzle tipping up; the swing: a turn about the wrist from the right to the left
  g.translate(Math.round(kk * 5 - s * 40), Math.round(kk * 7 + (s > 0.5 ? (1 - s) * 22 : s * 22)));
  if (kk > 0) { g.translate(116, 80); g.rotate(-kk * 0.06); g.translate(-116, -80); }
  if (s > 0) { g.translate(116, 84); g.rotate(-s * 0.9); g.translate(-116, -84); }
  g.drawImage(im, 0, 0);
  const m = meta.weapons && meta.weapons[id] && meta.weapons[id].muzzle;
  if (f && m) {
    // a star of hard pixels, three colours, sized by the gun
    const [mx, my] = m, z = FLASH[id] || 1, r = Math.round(9 * z), q = Math.round(4 * z);
    const ray = (dx, dy, len, w, c) => { g.fillStyle = c; for (let i = 0; i < len; i++) g.fillRect(Math.round(mx + dx * i - w / 2), Math.round(my + dy * i - w / 2), w, w); };
    for (const [dx, dy] of [[0, -1], [-0.8, -0.6], [0.8, -0.6], [-1, 0.1], [1, 0.1]]) ray(dx, dy, r, 3, ORANGE);
    for (const [dx, dy] of [[-0.4, -0.9], [0.4, -0.9], [-0.9, -0.3], [0.9, -0.3]]) ray(dx, dy, Math.round(r * 0.7), 2, YEL);
    g.fillStyle = YEL; g.fillRect(mx - q, my - q, q * 2, q * 2);
    g.fillStyle = WHITE; g.fillRect(mx - Math.ceil(q / 2), my - Math.ceil(q / 2), q, q);
  }
  g.restore();
}
