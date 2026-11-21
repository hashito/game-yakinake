// The weapon in the hand, drawn as pixel art on a small canvas (96 x 64, shown scaled up with crisp pixels at the lower right).
// Each weapon is a list of rectangles [x, y, w, h, colour] in the canvas's pixels, the hand (sleeve of the white coat) under it.
const SKIN = '#c89a7a', SKIN_D = '#9a7058', COAT = '#e4e2da', COAT_D = '#a8a69e', STEEL = '#9aa2aa', STEEL_D = '#5a6068', DARK = '#24262a', WOOD = '#7a4a28', WOOD_D = '#4e2e18', RED = '#b8262a', YEL = '#ffe08a';
const HAND = [[60, 44, 22, 20, COAT], [60, 44, 22, 3, COAT_D], [62, 38, 14, 10, SKIN], [62, 46, 14, 2, SKIN_D]];
const ART = {
  hands: [[56, 36, 16, 12, SKIN], [56, 46, 16, 3, SKIN_D], [52, 46, 26, 18, COAT], [52, 46, 26, 3, COAT_D]],
  scalpel: [[66, 30, 3, 14, STEEL_D], [67, 18, 2, 13, STEEL], [66, 16, 2, 3, '#d8e0e8'], ...HAND],
  pipe: [[64, 4, 6, 46, STEEL_D], [65, 4, 2, 46, STEEL], [63, 2, 8, 3, DARK], ...HAND],
  axe: [[66, 14, 5, 40, WOOD], [67, 14, 2, 40, WOOD_D], [54, 6, 16, 12, RED], [50, 8, 6, 8, STEEL], [48, 9, 3, 6, '#d8e0e8'], ...HAND],
  nailgun: [[44, 26, 34, 12, '#d0a020'], [44, 26, 34, 3, '#f0c040'], [36, 29, 9, 6, DARK], [64, 36, 10, 14, DARK], [52, 38, 12, 8, '#d0a020'], ...HAND],
  pistol: [[44, 30, 30, 9, DARK], [44, 30, 30, 2, STEEL_D], [64, 37, 9, 14, DARK], [40, 32, 5, 4, STEEL_D], ...HAND],
  shotgun: [[14, 30, 58, 6, STEEL_D], [14, 30, 58, 2, STEEL], [30, 36, 22, 5, WOOD], [66, 34, 22, 10, WOOD], [66, 42, 22, 3, WOOD_D], ...HAND],
  rifle: [[6, 28, 66, 5, DARK], [6, 28, 66, 1, STEEL_D], [36, 22, 22, 6, DARK], [38, 23, 18, 3, '#3a5a7a'], [62, 32, 30, 10, WOOD], [62, 40, 30, 3, WOOD_D], ...HAND],
};
const MUZZLE = { nailgun: [34, 32], pistol: [38, 34], shotgun: [12, 33], rifle: [4, 30] };

export function drawWeapon(cv, id, o = {}) {
  const key = `${id}|${o.swing.toFixed(2)}|${o.kick.toFixed(2)}|${o.flash ? 1 : 0}`;
  if (cv._key === key) return;
  cv._key = key;
  const g = cv.getContext('2d');
  g.clearRect(0, 0, cv.width, cv.height);
  const art = ART[id] || ART.hands;
  g.save();
  // a strike swings the weapon from the right down to the left; a shot kicks it up and back
  const s = o.swing || 0, k = o.kick || 0;
  g.translate(Math.round(-s * 26 + k * 3), Math.round(s * (s > 0.5 ? 10 : -6) - k * 5 + k * 0));
  if (s > 0) { g.translate(70, 50); g.rotate(-s * 0.7); g.translate(-70, -50); }
  for (const [x, y, w, h, c] of art) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  if (o.flash && MUZZLE[id]) { const [mx, my] = MUZZLE[id]; g.fillStyle = YEL; g.fillRect(mx - 6, my - 3, 7, 6); g.fillStyle = '#fff6d0'; g.fillRect(mx - 3, my - 1, 3, 2); g.fillStyle = '#ff9a3a'; g.fillRect(mx - 9, my - 1, 3, 2); }
  g.restore();
}
