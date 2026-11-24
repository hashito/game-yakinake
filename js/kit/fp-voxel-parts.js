/* game-kit 70be00ae: js/fp-voxel-parts.js — edit in game-kit and run tools/kit-sync.js */
// The shared first-person parts for js/fp-voxel.js (1.35.0, 夜勤明けの街 #1): a hand with its sleeve that closes round a grip or
// a shaft or makes a fist, and the common weapons - the bare fist, a scalpel, a steel pipe, a fire axe, a nail gun, a pistol, a
// pump shotgun, a hunting rifle - and the off hand with a pen light. fpParts({ sleeve, cuff, skin }) colours the sleeve (a white
// coat for a doctor, a jacket, ...). Metres; x right, u up, f forward; the origin is about the right wrist (see js/fp-voxel.js).
const V = 0.004;

function sleeveArm(side, end, o) {
  // from below the edge of the view up to the wrist: the sleeve, the cuff, the bare wrist
  const s = side, [ex, eu, ef] = end;
  return [
    { cap: [[ex + s * 0.06, eu - 0.14, ef - 0.3], [ex + s * 0.004, eu - 0.012, ef - 0.05]], r: 0.04, r1: 0.034, c: o.sleeve, n: 0.22 },
    { cap: [[ex + s * 0.006, eu - 0.016, ef - 0.07], [ex + s * 0.002, eu - 0.008, ef - 0.04]], r: 0.036, c: o.cuff, n: 0.2 },
    { cap: [[ex, eu - 0.006, ef - 0.045], [ex, eu, ef]], r: 0.024, c: o.skin, n: 0.18 },
  ];
}
/** a right hand closed round a vertical grip at (x, f), from u0 up to u1; index on the trigger when `trigger` */
function gripHand(o, { x = 0, f = 0.04, u0 = -0.05, u1 = 0.03, w = 0.03, trigger = false, side = 1 } = {}) {
  const s = side, sk = o.skin, out = [];
  // the back of the hand on the outer side of the grip, the web over the top, the heel under it
  out.push({ box: s > 0 ? [x + w / 2 - 0.002, u0 + 0.004, f - 0.034, x + w / 2 + 0.024, u1 - 0.004, f + 0.026] : [x - w / 2 - 0.024, u0 + 0.004, f - 0.034, x - w / 2 + 0.002, u1 - 0.004, f + 0.026], c: sk, n: 0.2 });
  out.push({ ell: [x + s * 0.012, u1 - 0.004, f - 0.012], r: [0.03, 0.014, 0.026], c: sk, n: 0.2 });
  // four fingers round the front (each its own row, a line of shade between them), the knuckles bumping out
  const rows = trigger ? 3 : 4, step = (u1 - u0 - 0.012) / 4;
  for (let i = 0; i < rows; i++) {
    const u = u1 - 0.014 - (i + (trigger ? 1 : 0)) * step;
    out.push({ cap: [[x + s * (w / 2 + 0.014), u, f + 0.018], [x - s * (w / 2 - 0.002), u, f + 0.03]], r: 0.0105, c: sk, n: 0.25 });
    out.push({ ell: [x + s * (w / 2 + 0.018), u, f + 0.012], r: [0.009, 0.009, 0.009], c: o.knuckle, n: 0.2 });
  }
  if (trigger) { const u = u1 - 0.012; out.push({ cap: [[x + s * (w / 2 + 0.012), u, f + 0.016], [x + s * 0.004, u - 0.004, f + 0.052]], r: 0.0095, c: sk, n: 0.22 }); }
  // the thumb down the inner side
  out.push({ cap: [[x + s * 0.004, u1 + 0.004, f - 0.026], [x - s * (w / 2 + 0.006), u1 - 0.006, f + 0.024]], r: 0.0105, c: sk, n: 0.22 });
  out.push({ ell: [x - s * (w / 2 + 0.006), u1 - 0.006, f + 0.026], r: [0.008, 0.007, 0.008], c: o.nail });
  return out;
}
/** a fist, knuckles forward. 1.39.15 (夜勤明けの街 re-check 2026-11-24: "the bare hand is a beige box"): seen from behind and above, the
 *  back of the hand is rounded, the four knuckles stand up in a row with shade between them, the curled fingers fold down the front in
 *  four rows, tendons run from the wrist to the knuckles and the thumb crosses under the fingers */
function fist(o, { x = 0, u = 0, f = 0, side = 1 } = {}) {
  const s = side, sk = o.skin, out = [
    { ell: [x, u - 0.004, f + 0.016], r: [0.031, 0.022, 0.034], c: sk, n: 0.18 },                        // the back of the hand
    { box: [x - 0.028, u - 0.03, f + 0.0, x + 0.028, u - 0.006, f + 0.044], c: sk, n: 0.2 },               // the palm side, under it
  ];
  for (let i = 0; i < 4; i++) {
    const fx = x + s * (0.0225 - i * 0.015);
    out.push({ ell: [fx, u + 0.012, f + 0.046], r: [0.0078, 0.0085, 0.0085], c: o.knuckle, n: 0.22 });   // the knuckle
    out.push({ cap: [[fx, u + 0.006, f + 0.058], [fx, u - 0.022, f + 0.062]], r: 0.0072, c: sk, n: 0.22 }); // the curled finger down the front
    out.push({ ell: [fx, u - 0.024, f + 0.056], r: [0.006, 0.004, 0.005], c: o.knuckle, n: 0.15 });      // the fingertip tucked in
    if (i < 3) out.push({ cap: [[x + s * (0.012 - i * 0.012), u + 0.016, f - 0.012], [fx - s * 0.002, u + 0.014, f + 0.038]], r: 0.0032, c: o.knuckle, n: 0.1 }); // a tendon
  }
  out.push({ cap: [[x - s * 0.034, u - 0.008, f - 0.002], [x - s * 0.006, u - 0.02, f + 0.068]], r: 0.0105, c: sk, n: 0.22 });   // the thumb across the fingers
  out.push({ ell: [x - s * 0.004, u - 0.02, f + 0.07], r: [0.008, 0.006, 0.006], c: o.nail });
  return out;
}
const flip = (shapes) => shapes.map((s) => {
  const m = (p) => [-p[0], p[1], p[2]];
  if (s.box) return { ...s, box: [-s.box[3], s.box[1], s.box[2], -s.box[0], s.box[4], s.box[5]] };
  if (s.ell) return { ...s, ell: m(s.ell) };
  if (s.cap) return { ...s, cap: [m(s.cap[0]), m(s.cap[1])] };
  if (s.cyl) return { ...s, cyl: m(s.cyl) };
  if (s.group) return { ...s, at: s.at ? m(s.at) : s.at, ry: -(s.ry || 0), rz: -(s.rz || 0), group: flip(s.group) };
  return s;
});

export function fpParts(c = {}) {
  const o = { sleeve: '#e4e8e6', cuff: '#c4ccc8', skin: '#dba882', knuckle: '#c99272', nail: '#ecc8b0', ...c };
  const DARK = '#24262a', STEEL = '#4c5258', STEEL2 = '#6a7076', WOOD = '#4e2e16', WOOD2 = '#5e381c';
  const arm = (end) => sleeveArm(1, end, o);
  // 1.37.7 (夜勤明けの街 1.4.3): in portrait (the narrow end of fit) the weapons stand higher so the hand and the grip sit above the phone's
  // two rows of buttons; the long guns also turn (ry) so their stocks leave by the right edge, not down behind 操作 / 撃つ
  const models = {
    hands: { vox: V, pose: { x: 0.12, y: -0.112, z: -0.32 }, blood: [-0.03, -0.03, 0.04, 0.03, 0.02, 0.075],
      shapes: [...arm([0.0, -0.01, -0.01]), { group: fist(o, { x: 0, u: 0, f: 0 }), at: [0, 0, 0.02], rz: -0.95, rx: 0.45 }] },   // 1.39.15: turned (a boxer's guard) so the curled fingers and the thumb face the eye, not the flat back
    // 1.37.7 (夜勤明けの街 1.4.3: in portrait the scalpel read as a lump of hand - its blade pointed straight away from the eye): the
    // scalpel stands up out of the top of the fist, leaning forward and a little left, its blade's flat towards the eye, bright steel
    // with a lit edge and a dark spine, the handle long enough to read past the knuckles
    scalpel: { vox: V, pose: { x: 0.12, y: -0.125, z: -0.27 }, blood: { box: [-0.014, -0.005, 0.1, 0.016, 0.005, 0.16], at: [0.002, 0.012, 0.03], rx: -1.05, rz: 0.45 },
      shapes: [...arm([0.0, -0.01, -0.01]), ...fist(o), { group: [
        { box: [-0.0065, -0.0045, -0.03, 0.0065, 0.0045, 0.096], c: '#9aa6ae', n: 0.12 }, { box: [-0.0045, -0.0055, -0.02, 0.0045, 0.0055, 0.09], c: '#5e686e' },
        { box: [-0.008, -0.005, 0.092, 0.008, 0.005, 0.1], c: '#c8d2d8' },
        { ell: [0.002, 0, 0.13], r: [0.016, 0.004, 0.036], c: '#eef4f8', n: 0.06 }, { box: [-0.016, -0.007, 0.098, -0.004, 0.007, 0.17], c: '#000000', cut: true },
        { box: [-0.004, -0.0045, 0.1, -0.001, 0.0045, 0.158], c: '#9aa4ac' }, { ell: [0.0125, 0, 0.13], r: [0.0045, 0.0045, 0.028], c: '#ffffff' }],
        at: [0.002, 0.012, 0.03], rx: -1.05, rz: 0.45 }] },
    pipe: { vox: V, pose: { x: 0.15, y: -0.24, z: -0.4 }, fit: { kx: 0.6, dy: 0.04, rz: -0.3, dyw: -0.05, rzw: -0.15 }, blood: { box: [-0.026, 0.34, 0.006, 0.026, 0.49, 0.064], at: [0, 0, 0.03], rx: 0.55, rz: 0.12 },
      shapes: [...arm([0.024, -0.02, -0.02]), { group: [
        { cyl: [0, -0.07, 0.035], r: 0.017, len: 0.58, axis: 'u', c: STEEL2, n: 0.35 }, { cyl: [0, -0.07, 0.035], r: 0.011, len: 0.6, axis: 'u', c: '#000000', cut: true },
        { cyl: [0, 0.46, 0.035], r: 0.021, len: 0.03, axis: 'u', c: '#5a5048', n: 0.3 },
        ...gripHand(o, { f: 0.035, u0: -0.05, u1: 0.03, w: 0.034 })], at: [0, 0, 0.03], rx: 0.55, rz: 0.12 }] },
    axe: { vox: V, pose: { x: 0.16, y: -0.25, z: -0.42 }, fit: { kx: 0.8, dy: 0.015, rz: -0.3, kxw: 1.6, dyw: -0.12, rzw: -0.2 }, blood: { box: [-0.13, 0.38, 0.014, 0.03, 0.52, 0.056], at: [0, 0, 0.03], rx: 0.6, rz: 0.1 },
      shapes: [...arm([0.024, -0.02, -0.02]), { group: [
        { cyl: [0, -0.08, 0.035], r: 0.016, len: 0.56, axis: 'u', c: WOOD2, n: 0.3 }, { cyl: [0, -0.08, 0.035], r: 0.019, len: 0.02, axis: 'u', c: DARK },
        { box: [-0.02, 0.4, 0.016, 0.03, 0.5, 0.054], c: '#b0281e', n: 0.25 },
        { group: [{ box: [-0.12, 0.39, 0.02, -0.02, 0.51, 0.05], c: '#b0281e', n: 0.25 }, { box: [-0.13, 0.38, 0.026, -0.105, 0.52, 0.044], c: '#c8ccd0', n: 0.2 }], at: [-0.02, 0.45, 0.035], rz: 0 },
        { box: [0.03, 0.43, 0.026, 0.07, 0.47, 0.044], c: '#8a1e16' },
        ...gripHand(o, { f: 0.035, u0: -0.05, u1: 0.03, w: 0.032 })], at: [0, 0, 0.03], rx: 0.6, rz: 0.1 }] },
    nailgun: { vox: V, pose: { x: 0.13, y: -0.16, z: -0.31 }, fit: { dy: 0.008 }, muzzle: [0, 0.07, 0.25], blood: [-0.03, 0.03, 0.18, 0.03, 0.12, 0.24],
      shapes: [...arm([0.026, -0.03, -0.01]),
        { box: [-0.016, -0.06, 0.0, 0.016, 0.035, 0.036], c: '#202020', n: 0.25 },
        { box: [-0.03, 0.03, -0.03, 0.03, 0.12, 0.19], c: '#e0a020', n: 0.25 }, { box: [-0.031, 0.06, 0.02, 0.031, 0.1, 0.15], c: '#c07a10' },
        { box: [-0.026, 0.11, -0.05, 0.026, 0.13, 0.04], c: '#e0a020', n: 0.2 },
        { cyl: [0, 0.07, 0.19], r: 0.013, len: 0.06, axis: 'f', c: DARK, n: 0.2 },
        { group: [{ box: [-0.01, -0.04, 0.12, 0.01, 0.06, 0.2], c: '#3a3a3a', n: 0.2 }, { box: [-0.006, -0.03, 0.13, 0.006, 0.06, 0.19], c: '#a8a8a8' }], at: [0, 0.06, 0.18], rx: -0.5 },
        ...gripHand(o, { f: 0.018, u0: -0.055, u1: 0.03, w: 0.032, trigger: true })] },
    pistol: { vox: V, pose: { x: 0.1, y: -0.14, z: -0.33 }, muzzle: [0, 0.064, 0.185], blood: [-0.016, 0.04, 0.12, 0.016, 0.08, 0.185],
      shapes: [...arm([0.024, -0.03, -0.02]),
        { group: [{ box: [-0.014, -0.065, 0.012, 0.014, 0.035, 0.044], c: DARK, n: 0.3 }], at: [0, 0.035, 0.03], rx: -0.22 },
        { box: [-0.013, 0.03, -0.005, 0.013, 0.05, 0.16], c: '#30333a', n: 0.2 },
        { box: [-0.0155, 0.05, -0.01, 0.0155, 0.078, 0.18], c: STEEL, n: 0.22 },
        { box: [-0.016, 0.054, 0.0, 0.016, 0.075, 0.03], c: '#3a3e44' },
        { box: [-0.003, 0.078, 0.168, 0.003, 0.086, 0.176], c: '#e8e0a0' }, { box: [-0.008, 0.078, -0.008, 0.008, 0.087, 0.0], c: DARK },
        { box: [-0.006, 0.006, 0.05, 0.006, 0.03, 0.095], c: '#2a2c30' }, { box: [-0.007, 0.012, 0.056, 0.007, 0.026, 0.088], c: '#000000', cut: true },
        { cyl: [0, 0.064, 0.178], r: 0.005, len: 0.006, axis: 'f', c: '#000000', cut: true },
        ...gripHand(o, { f: 0.025, u0: -0.06, u1: 0.03, w: 0.03, trigger: true })] },
    shotgun: { vox: V, twoHands: true, pose: { x: 0.07, y: -0.125, z: -0.2 }, fit: { kxw: 1.35, dyw: -0.025, kx: 0.9, dy: 0.035, ry: 0.16 }, muzzle: [0, 0.052, 0.66], blood: [-0.02, 0.02, 0.5, 0.02, 0.07, 0.66],
      shapes: [...arm([0.024, -0.04, -0.02]),
        { group: [{ box: [-0.02, -0.07, -0.26, 0.02, -0.01, 0.0], c: WOOD, n: 0.35 }, { box: [-0.016, -0.03, -0.02, 0.016, 0.03, 0.03], c: WOOD2, n: 0.3 }], at: [0, 0, 0], rx: 0.12 },
        { box: [-0.02, 0.0, -0.01, 0.02, 0.05, 0.16], c: '#2c2e32', n: 0.2 },
        { cyl: [0, 0.052, 0.12], r: 0.0115, len: 0.54, axis: 'f', c: STEEL, n: 0.2 }, { cyl: [0, 0.03, 0.14], r: 0.009, len: 0.46, axis: 'f', c: '#3a3d42' },
        { box: [-0.022, 0.012, 0.3, 0.022, 0.044, 0.44], c: WOOD2, n: 0.3 },
        { cyl: [0, 0.052, 0.655], r: 0.007, len: 0.01, axis: 'f', c: '#000000', cut: true },
        { box: [-0.006, 0.0, 0.03, 0.006, 0.012, 0.06], c: DARK },
        ...gripHand(o, { f: 0.0, u0: -0.05, u1: 0.012, w: 0.032, trigger: true }),
        // the left hand under the pump, the left sleeve coming in from the lower left
        ...leftFore(o, 0.37),
        { group: flip(gripHand(o, { f: 0.0, u0: -0.02, u1: 0.026, w: 0.044 })), at: [0, 0, 0], rx: 1.45, ry: 0, rz: 0 }].map((s) => s) },
    rifle: { vox: V, twoHands: true, pose: { x: 0.065, y: -0.12, z: -0.19 }, fit: { kxw: 1.35, dyw: -0.025, kx: 1.0, dy: 0, dz: -0.09, ry: 0.2 }, muzzle: [0, 0.048, 0.76], blood: [-0.02, 0.02, 0.56, 0.02, 0.07, 0.76],
      shapes: [...arm([0.024, -0.04, -0.02]),
        { group: [{ box: [-0.019, -0.075, -0.27, 0.019, -0.005, 0.02], c: WOOD2, n: 0.35 }, { box: [-0.019, -0.03, -0.27, 0.019, -0.005, -0.25], c: DARK }], at: [0, 0, 0], rx: 0.1 },
        { box: [-0.018, -0.01, 0.0, 0.018, 0.04, 0.42], c: WOOD2, n: 0.3 },
        { box: [-0.016, 0.026, -0.02, 0.016, 0.052, 0.16], c: '#2c2e32', n: 0.2 },
        { cyl: [0, 0.046, 0.15], r: 0.009, len: 0.62, axis: 'f', c: STEEL, n: 0.2 },
        { cyl: [0, 0.082, -0.03], r: 0.016, len: 0.26, axis: 'f', c: '#1c1e22', n: 0.2 }, { cyl: [0, 0.082, -0.04], r: 0.02, len: 0.03, axis: 'f', c: '#1c1e22' }, { cyl: [0, 0.082, 0.22], r: 0.02, len: 0.04, axis: 'f', c: '#1c1e22' },
        { box: [-0.006, 0.052, 0.02, 0.006, 0.066, 0.04], c: DARK }, { box: [-0.006, 0.052, 0.12, 0.006, 0.066, 0.14], c: DARK },
        { box: [0.016, 0.03, 0.06, 0.04, 0.038, 0.07], c: '#8a9096' },
        { cyl: [0, 0.046, 0.762], r: 0.005, len: 0.01, axis: 'f', c: '#000000', cut: true },
        ...gripHand(o, { f: 0.0, u0: -0.05, u1: 0.012, w: 0.032, trigger: true }),
        ...leftFore(o, 0.33),
        { group: flip(gripHand(o, { f: 0.0, u0: -0.02, u1: 0.026, w: 0.04 })), at: [0, 0, 0], rx: 1.45 }] },
  };
  // the left hands of the long guns: the grip shapes are made about the origin and moved to the fore-end
  for (const [id, f] of [['shotgun', 0.37], ['rifle', 0.33]]) {
    const sh = models[id].shapes, g = sh[sh.length - 1];
    g.group = g.group.map((s) => move(s, [-0.0, 0.0, f])); g.at = [0, 0.0, f];
  }
  const left = { vox: V, pose: { x: -0.16, y: -0.19, z: -0.32 },
    shapes: flip([...sleeveArm(1, [0.0, -0.01, -0.01], o), ...fist(o), { cyl: [0, -0.002, -0.03], r: 0.011, len: 0.15, axis: 'f', c: '#2a2c30', n: 0.25 }, { cyl: [0, -0.002, 0.11], r: 0.014, len: 0.02, axis: 'f', c: '#8a9096' }, { cyl: [0, -0.002, 0.128], r: 0.011, len: 0.004, axis: 'f', c: '#fff6c8' }]) };
  return { models, left };
}
// the left forearm of a long gun: in from the lower left to the fore-end at f
function leftFore(o, f) {
  return [
    { cap: [[-0.26, -0.2, f - 0.24], [-0.05, -0.04, f - 0.04]], r: 0.04, r1: 0.034, c: o.sleeve, n: 0.22 },
    { cap: [[-0.075, -0.06, f - 0.07], [-0.045, -0.035, f - 0.035]], r: 0.042, c: o.cuff, n: 0.2 },
    { cap: [[-0.045, -0.035, f - 0.04], [-0.02, -0.018, f - 0.005]], r: 0.024, c: o.skin, n: 0.18 },
  ];
}
function move(s, d) {
  const m = (p) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
  if (s.box) return { ...s, box: [s.box[0] + d[0], s.box[1] + d[1], s.box[2] + d[2], s.box[3] + d[0], s.box[4] + d[1], s.box[5] + d[2]] };
  if (s.ell) return { ...s, ell: m(s.ell) };
  if (s.cap) return { ...s, cap: [m(s.cap[0]), m(s.cap[1])] };
  if (s.cyl) return { ...s, cyl: m(s.cyl) };
  if (s.group) return { ...s, at: s.at ? m(s.at) : d, group: s.group.map((g) => move(g, d)) };
  return s;
}
