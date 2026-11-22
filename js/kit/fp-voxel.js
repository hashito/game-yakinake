/* game-kit 93a3e709: js/fp-voxel.js — edit in game-kit and run tools/kit-sync.js */
// First-person hands and weapons as real 3D dot models (1.35.0, 夜勤明けの街 #1 「手や武器も3Dドットで作成してください」).
// The models are made of simple shapes (boxes, capsules, cylinders, ellipsoids; groups that turn) filled into a fine voxel grid
// (4 mm by default), meshed with the sprite-stack mesher (js/sprite-stack-mesh.js) and drawn IN the scene, attached to the camera,
// so the light, the fog and the dot post-process (js/dot-post.js) touch them like everything else. They are drawn last, on a cleared
// depth, so a wall never cuts through the hand. js/fp-voxel-parts.js has the shared parts (hands with a sleeve, the common weapons).
//
//   import { voxelVolume, buildVoxelGeometry, createFpRig } from './fp-voxel.js';
//   const rig = createFpRig(THREE, camera, { models: { pistol: spec, ... }, left: spec, self: 0.25 });
//   rig.set('pistol'); rig.update(dt, { swayX, swayY, kick, swing, strike: 'chop', reload, light, flash });
//   rig.bloody(1) / rig.bloody(0); rig.visible = false; rig.prebuild(ids) (at idle); rig.models (built ones)
//
// A spec: { vox: 0.004, shapes: [ ... ], muzzle: [x, u, f], blood: [x0, u0, f0, x1, u1, f1], twoHands, pose: { x, y, z } }.
// Coordinates are metres in the model's own frame: x to the right, u up, f forward (into the screen); the origin is the wrist.
// A shape: { box: [x0, u0, f0, x1, u1, f1] } | { cap: [[x, u, f], [x, u, f]], r } | { cyl: [x, u, f], r, len, axis: 'x' | 'u' | 'f' }
//          | { ell: [x, u, f], r: [rx, ru, rf] } | { group: [shapes], at: [x, u, f], rx, ry, rz } (turned about `at`, radians)
// with c: '#rrggbb' (colour), n: 0..1 (a speck of grain per voxel), cut: true (carves instead of fills). Later shapes paint over.
import { stackQuads, quadsToGeometry } from './sprite-stack-mesh.js';

const hex = (c) => (typeof c === 'number' ? c : parseInt(String(c || '#888888').replace('#', ''), 16));
const hash3 = (x, y, z) => { let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };

function rotM(rx = 0, ry = 0, rz = 0) {
  // R = Rz * Ry * Rx (applied to x, u, f with u as the vertical axis: rx tilts f up, ry turns about u, rz rolls about f)
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  const X = [1, 0, 0, 0, cx, -sx, 0, sx, cx];          // about x: (u, f)
  const Y = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];          // about u: (x, f)
  const Z = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];          // about f: (x, u)
  const mul = (a, b) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j]; return o; };
  return mul(Z, mul(Y, X));
}
const tr = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

/** flatten the groups: every primitive with the inverse transform from the model frame into its own frame, and its bounds */
function flatten(shapes, inv = null, out = []) {
  for (const s of shapes || []) {
    if (s.group) {
      const R = tr(rotM(s.rx, s.ry, s.rz)), at = s.at || [0, 0, 0];
      // p_local = R^T (p - at) + at, then the parent's inverse first
      const step = { R, at };
      flatten(s.group.map((g) => ({ ...g, c: g.c || s.c, n: g.n ?? s.n })), inv ? [...inv, step] : [step], out);
      continue;
    }
    out.push({ s, inv: inv || [] });
  }
  return out;
}
const toLocal = (inv, p) => {
  let x = p[0], u = p[1], f = p[2];
  for (const { R, at } of inv) {
    const dx = x - at[0], du = u - at[1], df = f - at[2];
    x = R[0] * dx + R[1] * du + R[2] * df + at[0]; u = R[3] * dx + R[4] * du + R[5] * df + at[1]; f = R[6] * dx + R[7] * du + R[8] * df + at[2];
  }
  return [x, u, f];
};
function inside(s, p) {
  const [x, u, f] = p;
  if (s.box) { const b = s.box; return x >= b[0] && x <= b[3] && u >= b[1] && u <= b[4] && f >= b[2] && f <= b[5]; }
  if (s.ell) { const c = s.ell, r = s.r; const a = (x - c[0]) / r[0], b = (u - c[1]) / r[1], d = (f - c[2]) / r[2]; return a * a + b * b + d * d <= 1; }
  if (s.cap) {
    const [A, B] = s.cap, ab = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], ap = [x - A[0], u - A[1], f - A[2]];
    const L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1e-9, t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L));
    const r = s.r1 != null ? s.r + (s.r1 - s.r) * t : s.r;
    const dx = ap[0] - ab[0] * t, du = ap[1] - ab[1] * t, df = ap[2] - ab[2] * t; return dx * dx + du * du + df * df <= r * r;
  }
  if (s.cyl) {
    const c = s.cyl, ax = s.axis || 'f', h = (s.len || 0.1);
    const along = ax === 'x' ? x - c[0] : ax === 'u' ? u - c[1] : f - c[2];
    if (along < 0 || along > h) return false;
    const a = ax === 'x' ? u - c[1] : x - c[0], b = ax === 'f' ? u - c[1] : f - c[2];
    return a * a + b * b <= s.r * s.r;
  }
  return false;
}
// the bounds of a primitive in the model frame: its own box, the 8 corners carried out through the turns (innermost first)
function bound(s, inv) {
  let lo, hi;
  if (s.box) { const b = s.box; lo = [b[0], b[1], b[2]]; hi = [b[3], b[4], b[5]]; }
  else if (s.ell) { lo = s.ell.map((v, k) => v - s.r[k]); hi = s.ell.map((v, k) => v + s.r[k]); }
  else if (s.cap) { const [A, B] = s.cap, r = Math.max(s.r, s.r1 || 0); lo = A.map((v, k) => Math.min(v, B[k]) - r); hi = A.map((v, k) => Math.max(v, B[k]) + r); }
  else if (s.cyl) { const k = { x: 0, u: 1, f: 2 }[s.axis || 'f'], h = s.len || 0.1; lo = s.cyl.map((v) => v - s.r); hi = s.cyl.map((v) => v + s.r); lo[k] = s.cyl[k]; hi[k] = s.cyl[k] + h; }
  else return null;
  if (!inv.length) return { lo, hi };
  const out = { lo: [Infinity, Infinity, Infinity], hi: [-Infinity, -Infinity, -Infinity] };
  for (let m = 0; m < 8; m++) {
    let p = [m & 1 ? hi[0] : lo[0], m & 2 ? hi[1] : lo[1], m & 4 ? hi[2] : lo[2]];
    for (let i = inv.length - 1; i >= 0; i--) { const { R, at } = inv[i]; const T = tr(R), dx = p[0] - at[0], du = p[1] - at[1], df = p[2] - at[2]; p = [T[0] * dx + T[1] * du + T[2] * df + at[0], T[3] * dx + T[4] * du + T[5] * df + at[1], T[6] * dx + T[7] * du + T[8] * df + at[2]]; }
    for (let k = 0; k < 3; k++) { out.lo[k] = Math.min(out.lo[k], p[k]); out.hi[k] = Math.max(out.hi[k], p[k]); }
  }
  return out;
}

/** a spec -> a volume for the mesher ({ w, d, n, at, rgb } of js/sprite-stack-mesh.js) and where the model's origin sits in it */
export function voxelVolume(spec) {
  const v = spec.vox || 0.004, prims = flatten(spec.shapes).map((q) => ({ ...q, b: bound(q.s, q.inv) })).filter((q) => q.b);
  if (!prims.length) return null;
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const q of prims) if (!q.s.cut) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q.b.lo[k]); hi[k] = Math.max(hi[k], q.b.hi[k]); }
  const W = Math.ceil((hi[0] - lo[0]) / v) + 1, D = Math.ceil((hi[2] - lo[2]) / v) + 1, N = Math.ceil((hi[1] - lo[1]) / v) + 1;
  if (W * D * N > 6e6) throw new Error(`fp-voxel: the model is too big (${W}x${D}x${N})`);
  const col = new Int32Array(W * D * N).fill(-1);
  // stack (ix, iy, iz): ix = x, iy = forward reversed (towards the viewer: three's +z), iz = up
  for (const q of prims) {
    const { s, inv, b } = q, c = s.cut ? -1 : hex(s.c), grain = s.n || 0;
    const x0 = Math.max(0, Math.floor((b.lo[0] - lo[0]) / v)), x1 = Math.min(W - 1, Math.ceil((b.hi[0] - lo[0]) / v));
    const u0 = Math.max(0, Math.floor((b.lo[1] - lo[1]) / v)), u1 = Math.min(N - 1, Math.ceil((b.hi[1] - lo[1]) / v));
    const f0 = Math.max(0, Math.floor((b.lo[2] - lo[2]) / v)), f1 = Math.min(D - 1, Math.ceil((b.hi[2] - lo[2]) / v));
    for (let iz = u0; iz <= u1; iz++) for (let fi = f0; fi <= f1; fi++) for (let ix = x0; ix <= x1; ix++) {
      const p = [lo[0] + (ix + 0.5) * v, lo[1] + (iz + 0.5) * v, lo[2] + (fi + 0.5) * v];
      if (!inside(s, inv.length ? toLocal(inv, p) : p)) continue;
      const iy = D - 1 - fi, j = (iz * D + iy) * W + ix;
      if (c < 0) { col[j] = -1; continue; }
      let cc = c;
      if (grain) { const k = 1 + (hash3(ix, iy, iz) - 0.5) * grain * 0.5; const r = Math.min(255, Math.round(((c >> 16) & 255) * k)), g = Math.min(255, Math.round(((c >> 8) & 255) * k)), bl = Math.min(255, Math.round((c & 255) * k)); cc = (r << 16) | (g << 8) | bl; }
      col[j] = cc;
    }
  }
  return {
    w: W, d: D, n: N, lo, hi, vox: v,
    at(x, y, z) { const j = (z * D + y) * W + x; return col[j] >= 0 ? j : -1; },
    rgb(j) { const c = col[j]; return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; },
  };
}

/** a spec -> a BufferGeometry in the model frame (three: x right, y up, -z forward), origin = the spec's origin */
export function buildVoxelGeometry(THREE, spec) {
  const vol = voxelVolume(spec); if (!vol) return null;
  const q = stackQuads(vol);
  const geo = quadsToGeometry(THREE, q, { mpp: vol.vox, pivot: [-0.5, -0.5] });
  // the mesher puts stack x at x * vox, stack y at y * vox (three z) and the lowest solid slice at y 0: back to the model frame
  const fwdMax = vol.lo[2] + vol.d * vol.vox;
  geo.translate(vol.lo[0], vol.lo[1] + q.z0 * vol.vox, -fwdMax);
  // the faces are shaded by where they face (top light, sides less, under dark): the rig's material is unlit, so a light at the
  // camera (the torch) cannot blow the near hand out to white; the rig scales the whole by the light around (rig.update({ level }))
  const nor = geo.attributes.normal.array, col = geo.attributes.color.array;
  for (let i = 0; i < nor.length; i += 3) { const ny = nor[i + 1], nx = nor[i], k = ny > 0.5 ? 1 : ny < -0.5 ? 0.52 : Math.abs(nx) > 0.5 ? (nx > 0 ? 0.8 : 0.72) : 0.88; col[i] *= k; col[i + 1] *= k; col[i + 2] *= k; }
  geo.computeBoundingBox(); geo.computeBoundingSphere();
  geo.userData.fpVoxel = { quads: q.quads.length / 7, size: [vol.w, vol.n, vol.d] };
  return geo;
}

// blood specks over a part of a model (the head of the axe, the knuckles): a few voxels in the box, seeded
function bloodSpec(box, vox, density, seed = 7) {
  const shapes = [];
  const [x0, u0, f0, x1, u1, f1] = box; let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const n = Math.round(density * Math.max(4, ((x1 - x0) * (u1 - u0) * (f1 - f0)) / (vox * vox * vox) * 0.08));
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * (x1 - x0), u = u0 + rnd() * (u1 - u0), f = f0 + rnd() * (f1 - f0), r = vox * (0.6 + rnd() * 1.4);
    shapes.push({ ell: [x, u, f], r: [r * (1 + rnd()), r, r * (1 + rnd())], c: rnd() < 0.5 ? '#5a0a0c' : '#7a1012' });
  }
  return { vox, shapes };
}

/**
 * The rig: the models on the camera, the motions, the muzzle flash, the blood after a strike.
 * o: { models: { id: spec }, left: spec (the off hand with the light), level (0..1: the starting brightness; update({ level }) follows the light around), place: { x, y, z } }
 */
export function createFpRig(THREE, camera, o = {}) {
  const root = new THREE.Group(); root.name = 'fp-rig'; camera.add(root);
  const self = o.self ?? 0.25;
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: true, fog: false });
  mat.name = 'fp-voxel'; mat.color.setScalar(o.level ?? 0.7);
  void self;
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffd070, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  let frame = 0, cleared = -1;
  // drawn last (the transparent list, renderOrder high) on a depth cleared once a frame: nothing in the world cuts the hand
  const onTop = (m) => { m.renderOrder = 9990; m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.onBeforeRender = (r) => { if (cleared !== frame) { cleared = frame; r.clearDepth(); } }; };
  const built = new Map();
  const place = { x: 0.15, y: -0.175, z: -0.3, ...(o.place || {}) };
  function build(id) {
    if (built.has(id)) return built.get(id);
    const spec = id === '__left' ? o.left : o.models[id]; if (!spec) return null;
    const g = new THREE.Group(); g.name = `fp:${id}`; g.visible = false;
    const geo = buildVoxelGeometry(THREE, spec); if (!geo) return null;
    const m = new THREE.Mesh(geo, mat); onTop(m); g.add(m);
    let flash = null;
    if (spec.muzzle) {
      const fg = new THREE.Group(), mk = (sx, sy, sz) => { const b = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), flashMat); onTop(b); fg.add(b); return b; };
      mk(0.05, 0.016, 0.016); mk(0.016, 0.05, 0.016); mk(0.022, 0.022, 0.06).position.z = -0.025;
      fg.position.set(spec.muzzle[0], spec.muzzle[1], -spec.muzzle[2]); fg.visible = false; g.add(fg); flash = fg;
    }
    let blood = null;
    if (spec.blood) { const bg = buildVoxelGeometry(THREE, bloodSpec(spec.blood, spec.vox || 0.004, 1)); if (bg) { blood = new THREE.Mesh(bg, mat); onTop(blood); blood.visible = false; g.add(blood); } }
    const p = { ...place, ...(spec.pose || {}) };
    g.userData.base = p; g.position.set(p.x, p.y, p.z);
    root.add(g);
    const rec = { id, g, mesh: m, flash, blood, spec, quads: geo.userData.fpVoxel.quads };
    built.set(id, rec); return rec;
  }
  let cur = null, left = null, bloodK = 0;
  const rig = {
    root, built,
    get current() { return cur ? cur.id : null; },
    set visible(v) { root.visible = !!v; }, get visible() { return root.visible; },
    prebuild(ids) { for (const id of ids) build(id); },
    set(id) {
      const r = build(id) || build('hands');
      if (cur && cur !== r) { cur.g.visible = false; if (cur.blood) cur.blood.visible = false; }
      cur = r; if (cur) { cur.g.visible = true; if (cur.blood) cur.blood.visible = bloodK > 0; }
      return rig;
    },
    /** blood on the weapon / the knuckles after a strike (0 clears) */
    bloody(k) { bloodK = k; if (cur && cur.blood) cur.blood.visible = k > 0; },
    /** o: { swayX, swayY (the old picture's px), kick 0..1 (x the gun's kick), swing 0..1, strike 'stab' | 'chop' | 'shove', reload 0..1, light, flash, level 0..1 } */
    update(dt, s = {}) {
      frame++;
      if (s.level != null) { const L = mat.color.r + (s.level - mat.color.r) * Math.min(1, dt * 6); mat.color.setScalar(L); }
      if (!cur) return;
      const g = cur.g, b = g.userData.base, two = !!cur.spec.twoHands;
      const sx = (s.swayX || 0) * 0.00055, sy = (s.swayY || 0) * 0.00055, k = s.kick || 0;
      const dip = s.reload > 0 ? Math.sin(Math.min(1, s.reload) * Math.PI) : 0;
      const sw = s.swing || 0, p = 1 - sw, ease = (t) => t * t * (3 - 2 * t);
      let mx = 0, my = 0, mz = 0, rx = 0, ry = 0, rz = 0;
      if (sw > 0) {
        if (s.strike === 'stab') { const q = p < 0.35 ? ease(p / 0.35) : 1 - ease((p - 0.35) / 0.65); mz = -0.13 * q; mx = -0.05 * q; my = 0.03 * q; rx = -0.1 * q; }
        else if (s.strike === 'chop') {
          if (p < 0.2) { const q = ease(p / 0.2); my = 0.06 * q; mx = 0.03 * q; rx = 0.55 * q; rz = -0.25 * q; }
          else if (p < 0.5) { const q = ease((p - 0.2) / 0.3); my = 0.06 - 0.16 * q; mx = 0.03 - 0.12 * q; mz = -0.06 * q; rx = 0.55 - 1.5 * q; rz = -0.25 + 0.7 * q; }
          else { const q = 1 - ease((p - 0.5) / 0.5); my = -0.1 * q; mx = -0.09 * q; mz = -0.06 * q; rx = -0.95 * q; rz = 0.45 * q; }
        } else { const q = p < 0.3 ? ease(p / 0.3) : 1 - ease((p - 0.3) / 0.7); mz = -0.1 * q; mx = -0.04 * q; rx = -0.08 * q; }
      }
      g.position.set(b.x + sx + mx + dip * 0.03, b.y - sy + my + k * 0.012 - dip * 0.13, b.z + mz + k * 0.045);
      g.rotation.set(rx + k * 0.16 - dip * 0.45, ry, rz + dip * (two ? 0.35 : 0.6), 'YXZ');
      if (cur.flash) { cur.flash.visible = !!s.flash; if (s.flash) cur.flash.rotation.z = Math.random() * Math.PI; }
      // the off hand with the light: one-handed weapons only, its own smaller sway
      const wantLeft = !!s.light && !two && !!o.left;
      if (wantLeft && !left) left = build('__left');
      if (left) {
        left.g.visible = wantLeft;
        if (wantLeft) { const lb = left.g.userData.base; left.g.position.set(lb.x + sx * 0.6, lb.y - sy * 0.8 - dip * 0.05, lb.z); }
      }
    },
    dispose() { for (const r of built.values()) { r.mesh.geometry.dispose(); if (r.blood) r.blood.geometry.dispose(); } camera.remove(root); },
  };
  return rig;
}
