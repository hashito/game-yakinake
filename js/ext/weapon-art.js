// The weapon in the hand: fine dot pictures seen from behind the shoulder (assets/fp/<id>.png, tools/dot/fpweapons.py, 320 x 192 px
// since 1.2.0: fingers, knuckles, nails, the coat's cuff; each weapon in its own grip), drawn on a small canvas that the CSS enlarges
// with crisp pixels at the lower right. The motions (1.2.0, play test #7):
//   sway   - the hand lags the look a little and bobs with the steps (o.swayX / o.swayY in px of the picture, from js/ext/combat.js)
//   recoil - a shot kicks it up and back toward the shoulder, the muzzle tipping up (more for the heavier guns), with a flash
//   reload - down and turned in, out of the sights, and back (o.reload 0..1 through the reload)
//   strike - by the kind: a short stab for the scalpel, a wind-up and a chop for the bar and the axe, a shove with the gun / the fist
//   light  - the left hand with the pen light at the lower left while the light is on (one-handed weapons)
const FP = new URL('../../assets/fp/', import.meta.url).href;
const IDS = ['hands', 'scalpel', 'pipe', 'axe', 'nailgun', 'pistol', 'shotgun', 'rifle', 'flashlight'];
const pics = new Map();
let meta = { w: 320, h: 192, weapons: {} };
fetch(`${FP}fp.json`).then((r) => r.json()).then((m) => { meta = m; }).catch(() => {});
for (const id of IDS) { const im = new Image(); im.src = `${FP}${id}.png`; im.onload = () => { pics.set(id, im); }; }
// how far each gun kicks (1 = the pistol) and how big its flash is
export const KICK = { nailgun: 0.4, pistol: 1, rifle: 1.5, shotgun: 2.2 };
const FLASH = { nailgun: 0.5, pistol: 1, rifle: 1.3, shotgun: 1.8 };
const TWO_HANDS = new Set(['shotgun', 'rifle']);
const STRIKE = { scalpel: 'stab', pipe: 'chop', axe: 'chop', hands: 'shove' };   // the guns: a shove with the gun
export const FP_SIZE = [320, 192];
const YEL = '#ffe08a', WHITE = '#fff8e0', ORANGE = '#ff9a3a';
const PIVOT = [232, 168];   // the wrist

const ease = (t) => t * t * (3 - 2 * t);

// where the picture is and how it is turned for a strike at s (1 = just struck, falling to 0)
function strikePose(kind, s) {
  if (s <= 0) return [0, 0, 0];
  const p = 1 - s;   // 0 -> 1 through the strike
  if (kind === 'stab') { const k = p < 0.35 ? ease(p / 0.35) : 1 - ease((p - 0.35) / 0.65); return [-44 * k, -34 * k, -0.18 * k]; }
  if (kind === 'chop') {
    if (p < 0.2) { const k = ease(p / 0.2); return [18 * k, -18 * k, 0.4 * k]; }               // up and back
    if (p < 0.5) { const k = ease((p - 0.2) / 0.3); return [18 - 98 * k, -18 + 58 * k, 0.4 - 1.5 * k]; }   // down across
    const k = ease((p - 0.5) / 0.5); return [-80 * (1 - k), 40 * (1 - k), -1.1 * (1 - k)];
  }
  const k = p < 0.3 ? ease(p / 0.3) : 1 - ease((p - 0.3) / 0.7); return [-56 * k, -20 * k, -0.08 * k];   // shove
}

export function drawWeapon(cv, id, o = {}) {
  const im = pics.get(id) || pics.get('hands');
  const s = o.swing || 0, k = o.kick || 0, f = o.flash ? 1 : 0, r = o.reload || 0, sx = o.swayX || 0, sy = o.swayY || 0;
  const light = !!o.light && !TWO_HANDS.has(id) && pics.get('flashlight');
  const key = `${id}|${!!im}|${s.toFixed(2)}|${k.toFixed(2)}|${f}|${r.toFixed(2)}|${sx.toFixed(1)}|${sy.toFixed(1)}|${!!light}`;
  if (cv._key === key) return;
  cv._key = key;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, cv.width, cv.height);
  if (!im) return;
  // the pen light in the left hand: its own small sway, behind the weapon
  if (light) { g.save(); g.translate(Math.round(sx * 0.6), Math.round(sy * 0.8 + (r > 0 ? Math.sin(r * Math.PI) * 10 : 0))); g.drawImage(light, 0, 0); g.restore(); }
  const kk = k * (KICK[id] || 1);
  const [mx0, my0, mr] = strikePose(STRIKE[id] || (TWO_HANDS.has(id) || KICK[id] ? 'shove' : 'shove'), s);
  const dip = r > 0 ? Math.sin(Math.min(1, r) * Math.PI) : 0;
  g.save();
  // sway + recoil (up and back toward the shoulder) + reload (down and in) + strike
  g.translate(Math.round(sx + kk * 10 + mx0 + dip * 26), Math.round(sy + kk * 14 + my0 + dip * 74));
  const turn = -kk * 0.06 + mr + dip * (TWO_HANDS.has(id) ? 0.35 : 0.55);
  if (turn) { g.translate(PIVOT[0], PIVOT[1]); g.rotate(turn); g.translate(-PIVOT[0], -PIVOT[1]); }
  g.drawImage(im, 0, 0);
  const m = meta.weapons && meta.weapons[id] && meta.weapons[id].muzzle;
  if (f && m) {
    // a star of hard pixels, three colours, sized by the gun
    const [mx, my] = m, z = FLASH[id] || 1, rr = Math.round(18 * z), q = Math.round(8 * z);
    const ray = (dx, dy, len, w, c) => { g.fillStyle = c; for (let i = 0; i < len; i += 2) g.fillRect(Math.round(mx + dx * i - w / 2), Math.round(my + dy * i - w / 2), w, w); };
    for (const [dx, dy] of [[0, -1], [-0.8, -0.6], [0.8, -0.6], [-1, 0.1], [1, 0.1]]) ray(dx, dy, rr, 6, ORANGE);
    for (const [dx, dy] of [[-0.4, -0.9], [0.4, -0.9], [-0.9, -0.3], [0.9, -0.3]]) ray(dx, dy, Math.round(rr * 0.7), 4, YEL);
    g.fillStyle = YEL; g.fillRect(mx - q, my - q, q * 2, q * 2);
    g.fillStyle = WHITE; g.fillRect(mx - Math.ceil(q / 2), my - Math.ceil(q / 2), q, q);
  }
  g.restore();
}
