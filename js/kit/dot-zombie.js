/* game-kit f89b1fcd: js/dot-zombie.js — edit in game-kit and run tools/kit-sync.js */
// Dot zombies with parts that come off (docs/zombies.md). 50 patterns in assets/zombies/ (tools/sprite-stacks/zombie_export.py).
// A zombie is 13 rigid sprite-stack pieces on the shared rig (11 parts: head, chest, pelvis, upper arms, forearms with
// hands, thighs, shins with feet). A shot part comes off: a stump cap shows on the body, the piece falls as a gib and
// stays on the floor, and the body goes on with what it has left (no legs: it crawls on its arms toward the target).
//
//   import { loadZombiePattern, createZombie, createGoreFx } from './dot-zombie.js';
//   const pat = await loadZombiePattern(THREE, 'assets/zombies/salaryman.json');   // geometry built here (load first)
//   const z = createZombie(pat, { position: [0, 0, -6], gore: 'full' });
//   scene.add(z.root);
//   const fx = createGoreFx(THREE, scene, { gore: 'full' }); fx.watch(z);            // blood spray, decals, gibs
//   z.on('attack', (e) => player.hurt(e.damage));
//   const r = z.hit(raycaster.ray, 30);   // or z.hit('thighL', 30)  -> { part, severed, killed, point }
//   z.update(dt, { position: camera.position, camera });                            // every frame
//
// Works without three.js for the logic (tests, servers): loadZombiePattern(null, json) / createZombie(json) keep the
// state machine, the damage table and hit(partId) and skip every mesh.
// A zombie's body is ONE SkinnedMesh (one draw call): every piece merged per pattern, each vertex bound to one bone (rigid
// skinning; a part that is gone has its bone scaled to 0). The wound caps are a second one, drawn only once a part is off. The geometry is
// shared by every zombie of the pattern; far zombies switch to the res 1 merge (LOD) at opts.lodDistance (default 9 m).

export const PARTS = ['head', 'chest', 'pelvis', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', 'thighL', 'thighR', 'shinL', 'shinR'];
export const PART_JA = {
  head: '頭', chest: '胸', pelvis: '腰', upperArmL: '左の上腕', upperArmR: '右の上腕', foreArmL: '左の前腕と手',
  foreArmR: '右の前腕と手', thighL: '左の太もも', thighR: '右の太もも', shinL: '左のすねと足', shinR: '右のすねと足',
};
export const BONES = ['pelvis', 'chest', 'head', 'upperArmL', 'foreArmL', 'upperArmR', 'foreArmR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
export const PART_OF = Object.fromEntries(BONES.map((b) => [b, b.startsWith('foot') ? 'shin' + b.slice(-1) : b]));
// (parent part, child part, joint)
export const JOINTS = [['chest', 'head', 'neck'], ['pelvis', 'chest', 'waist'], ['chest', 'upperArmL', 'shoulderL'],
  ['chest', 'upperArmR', 'shoulderR'], ['upperArmL', 'foreArmL', 'elbowL'], ['upperArmR', 'foreArmR', 'elbowR'],
  ['pelvis', 'thighL', 'hipL'], ['pelvis', 'thighR', 'hipR'], ['thighL', 'shinL', 'kneeL'], ['thighR', 'shinR', 'kneeR']];
// depth priority of coincident faces at a joint: a parent's round end wins over its child's
const LEVEL = { pelvis: 0, chest: 1, thighL: 1, thighR: 1, head: 2, upperArmL: 2, upperArmR: 2, shinL: 2, shinR: 2, foreArmL: 3, foreArmR: 3, footL: 3, footR: 3 };
export const GORE = ['full', 'low', 'off'];

const swapSide = (n) => (/[LR]$/.test(n) ? n.slice(0, -1) + (n.endsWith('L') ? 'R' : 'L') : n);

/** a missing part takes its children with it (the waist is the exception: a split leaves the upper half going) */
export function closure(missing) {
  const out = new Set(missing);
  let grow = true;
  while (grow) {
    grow = false;
    for (const [par, ch] of JOINTS) {
      if (out.has(par) && !out.has(ch) && !(par === 'pelvis' && ch === 'chest')) { out.add(ch); grow = true; }
    }
  }
  return out;
}

/** what a body can still do: legs (standing legs, each a thigh and a shin), arms (whole arms), stubs */
export function bodyOf(missing) {
  const m = closure(missing);
  const leg = (k) => !m.has('pelvis') && !m.has('thigh' + k) && !m.has('shin' + k);
  const arm = (k) => !m.has('chest') && !m.has('upperArm' + k) && !m.has('foreArm' + k);
  return {
    missing: m, legL: leg('L'), legR: leg('R'), armL: arm('L'), armR: arm('R'),
    legs: (leg('L') ? 1 : 0) + (leg('R') ? 1 : 0), arms: (arm('L') ? 1 : 0) + (arm('R') ? 1 : 0),
    head: !m.has('head') && !m.has('chest'), upper: !m.has('chest'), lower: !m.has('pelvis'),
  };
}

/** the motion for what the body wants to do, from what it has left: { name, mirror }.
 *  kind: idle | move | run | attack | flinch-head | flinch-torso | flinch-arm | flinch-leg | knockback | stagger | kneel |
 *        fall | die | die-back | corpse | corpse-back | eat | wake | climb | get-up | headless | twitch
 *  side: the side that was hit ('L' | 'R') for one-sided reactions. o.role 'runner' prefers hopping on one leg. */
export function chooseMotion(kind, missing, o = {}) {
  const b = bodyOf(missing);
  const side = o.side || 'R';
  const M = (name, mirror = false) => ({ name, mirror });
  if (!b.upper) return M('twitch');                                       // a lower half
  const standing = b.legs === 2;
  const hopper = b.legs === 1 && (o.hop || o.role === 'runner' || b.arms === 0);
  const down = !standing && !hopper;
  const crawl = () => (b.arms === 2 ? M('crawl') : b.arms === 1 ? M('crawl1', !b.armR) : M('squirm'));
  switch (kind) {
    case 'die': case 'die-fwd': return down ? M('corpse-fwd') : M('die-fwd');
    case 'die-back': return down ? M('corpse-fwd') : M('die-back');
    case 'corpse': case 'corpse-fwd': return M('corpse-fwd');
    case 'corpse-back': return down ? M('corpse-fwd') : M('corpse-back');
    case 'twitch': return M('twitch');
    case 'fall': return b.lower ? M('fall-leg', b.legs === 1 ? !b.legL : side === 'L') : crawl();
    default:
  }
  if (down) {                                                             // on the floor: it crawls, bites, squirms
    if (kind === 'attack' || kind === 'swing') return b.head ? M('crawl-bite') : crawl();
    return crawl();
  }
  if (hopper && (kind === 'move' || kind === 'run' || kind === 'headless')) return M('hop', !b.legR);
  switch (kind) {
    case 'idle': return M('idle');
    case 'move': return M(b.head ? 'walk' : 'headless');
    case 'run': return M(b.head ? (b.legs === 2 ? 'run' : 'walk') : 'headless');
    case 'headless': return M('headless');
    case 'eat': return M(standing ? 'eat' : 'idle');
    case 'wake': return M(standing ? 'wake' : 'stagger');
    case 'kneel': case 'get-up': return M(standing ? kind : 'stagger');
    case 'attack':
      if (b.arms === 2) return M(o.lunge && standing ? 'lunge' : 'grab');
      if (b.arms === 1) return M('grab1', !b.armR);
      return M(b.head ? 'bite' : 'stagger');
    case 'swing': return b.arms ? M('swing', !b.armR) : M(b.head ? 'bite' : 'stagger');
    case 'flinch-arm': return M('flinch-arm', side === 'L');
    case 'flinch-leg': return M(standing ? 'flinch-leg' : 'stagger', side === 'L' && standing);
    case 'climb': return M(standing ? 'climb' : 'stagger');
    case 'flinch-head': case 'flinch-torso': case 'knockback': case 'stagger':
      return M(kind);
    default: return M('idle');
  }
}

/** every motion kind the state machine asks for (zombie checks Z2: each resolves for every set of missing parts) */
export const KINDS = ['idle', 'move', 'run', 'attack', 'swing', 'flinch-head', 'flinch-torso', 'flinch-arm', 'flinch-leg', 'knockback',
  'stagger', 'kneel', 'fall', 'die', 'die-back', 'corpse', 'corpse-back', 'eat', 'wake', 'climb', 'get-up', 'headless', 'twitch'];

/** does a motion suit a body (its support: 'shin' motions need a standing leg, a walk / run / climb / flinch-leg two) */
export function motionFits(motions, name, missing) {
  const d = motions[name];
  if (!d) return false;
  const b = bodyOf(missing);
  if (!b.upper) return name === 'twitch' || name.startsWith('corpse');
  if (d.support === 'shin') {
    if (['walk', 'run', 'lunge', 'climb', 'flinch-leg', 'kneel', 'get-up', 'eat', 'wake'].includes(name)) return b.legs === 2;
    return b.legs >= 1;
  }
  if (name === 'crawl') return b.arms === 2;
  if (name === 'crawl1') return b.arms >= 1;
  if (name === 'crawl-bite') return b.head;
  if (name === 'die-back' || name === 'die-fwd') return b.legs >= 1;
  if (name === 'fall-leg') return b.lower;
  return true;
}

// ------------------------------------------------------------------ loading
export function stripVol(px, p) {
  const W = px.width, data = px.data;
  return {
    w: p.w, d: p.d, n: p.n,
    at(x, y, z) { const i = ((p.y + y) * W + p.x + z * p.w + x) * 4; return data[i + 3] > 127 ? i : -1; },
    rgb(i) { return [data[i], data[i + 1], data[i + 2]]; },
  };
}

/** a pattern: its JSON, the rig of its build, and (with THREE) the geometry of every piece, cap and LOD piece.
 *  src: a URL, or the JSON itself with o.rig (the rig JSON) for a logic-only zombie. */
export async function loadZombiePattern(THREE, src, o = {}) {
  let json = src, rig = o.rig, base = null;
  if (typeof src === 'string') {
    base = new URL(src, typeof location !== 'undefined' ? location.href : 'file:///');
    json = await (await fetch(base.href)).json();
  }
  if (!rig) rig = await (await fetch(new URL(json.rig, base).href)).json();
  const pat = { json, rig, THREE, geo: null };
  if (THREE) {
    const { quadsToGeometry, stackQuads, loadPixels, loadBakedQuads } = await import('./sprite-stack-mesh.js');
    // 1.33.0: the baked quads (tools/bake-stacks.mjs) when there are: no atlas to decode, no meshing on the phone
    const baked = base && o.baked !== false && !o.pixels ? await loadBakedQuads(base.href, json.id) : null;
    const keys = [...json.pieces.map((p) => `fine:${p.name}`), ...json.lod.map((p) => `lod:${p.name}`), ...json.caps.map((c) => `cap:${c.name}`)];
    const allBaked = !!baked && keys.every((k) => baked.has(k));
    const px = allBaked ? null : o.pixels || await loadPixels(new URL(json.atlas, base).href);
    pat.baked = allBaked;
    const make = (p, mpp, key) => {
      const q = allBaked ? baked.get(key) : stackQuads(stripVol(px, p));
      const g = quadsToGeometry(THREE, q, { mpp, pivot: [p.pivot[0], p.pivot[1]] });
      g.translate(0, -(p.pivot[2] + 0.5) * mpp, 0);
      g.computeBoundingBox(); g.computeBoundingSphere();
      return g;
    };
    pat.geo = { fine: {}, lod: {}, cap: {}, capGrey: {} };
    for (const p of json.pieces) pat.geo.fine[p.name] = make(p, json.mpp, `fine:${p.name}`);
    for (const p of json.lod) pat.geo.lod[p.name] = make(p, json.mpp * 2, `lod:${p.name}`);
    for (const c of json.caps) {
      const g = make(c, json.mpp, `cap:${c.name}`);
      pat.geo.cap[c.name] = g;
      const grey = g.clone();                                   // gore off: the wound cap in the clothes' shadow grey
      const col = grey.getAttribute('color');
      for (let i = 0; i < col.count; i++) {
        const v = 0.02 + 0.25 * (0.3 * col.getX(i) + 0.59 * col.getY(i) + 0.11 * col.getZ(i));
        col.setXYZ(i, v, v, v * 1.05);
      }
      pat.geo.capGrey[c.name] = grey;
    }
    pat.materials = materials(THREE);
    // one skinned body per zombie (one draw call): every piece and cap merged, each vertex bound to one bone (rigid).
    // Bones: the 13 of the rig, then one per cap (a cap shows or hides by its own bone's scale). A child piece is pulled
    // in along its normals by a fraction of a millimetre per level, so the parent's round end wins where they coincide.
    pat.capIndex = Object.fromEntries(json.caps.map((c, i) => [c.name, BONES.length + i]));
    const body = (pieceGeo) => mergeSkinned(THREE, json.pieces.map((p) => [pieceGeo[p.name], BONES.indexOf(p.bone), (LEVEL[p.name] ?? 2) * 0.0003]));
    const caps = (grey) => mergeSkinned(THREE, json.caps.map((c) => [(grey ? pat.geo.capGrey : pat.geo.cap)[c.name], pat.capIndex[c.name], -0.0004]));
    // the caps are a second skinned mesh on the same bones, drawn only while a wound shows (an intact zombie: 1 draw call)
    pat.skin = { fine: body(pat.geo.fine), lod: body(pat.geo.lod), caps: caps(false), capsGrey: caps(true) };
  }
  return pat;
}

/** merge [geometry, bone index, inset (m, along the normals)] into one skinned geometry */
function mergeSkinned(THREE, list) {
  let nv = 0, ni = 0;
  for (const [g] of list) { nv += g.getAttribute('position').count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3);
  const si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
  let v = 0, k = 0;
  for (const [g, bone, inset] of list) {
    const P = g.getAttribute('position'), N = g.getAttribute('normal'), C = g.getAttribute('color'), I = g.index;
    for (let i = 0; i < P.count; i++) {
      const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
      pos[(v + i) * 3] = P.getX(i) - nx * inset; pos[(v + i) * 3 + 1] = P.getY(i) - ny * inset; pos[(v + i) * 3 + 2] = P.getZ(i) - nz * inset;
      nor[(v + i) * 3] = nx; nor[(v + i) * 3 + 1] = ny; nor[(v + i) * 3 + 2] = nz;
      col[(v + i) * 3] = C.getX(i); col[(v + i) * 3 + 1] = C.getY(i); col[(v + i) * 3 + 2] = C.getZ(i);
      si[(v + i) * 4] = bone; sw[(v + i) * 4] = 1;
    }
    for (let j = 0; j < I.count; j++) idx[k + j] = I.getX(j) + v;
    v += P.count; k += I.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** every pattern listed in patterns.json (the lab demo picks from it) */
export async function loadZombieIndex(url) {
  return (await fetch(url)).json();
}

const MATS = new WeakMap();
function materials(THREE) {
  if (MATS.has(THREE)) return MATS.get(THREE);
  const m = [0, 1, 2, 3].map((lv) => new THREE.MeshLambertMaterial({
    vertexColors: true, polygonOffset: true, polygonOffsetFactor: -(3 - lv) * 0.6, polygonOffsetUnits: -(3 - lv) * 2,
  }));
  m.skinned = new THREE.MeshLambertMaterial({ vertexColors: true });     // the body: one skinned mesh
  MATS.set(THREE, m);
  return m;
}

// ------------------------------------------------------------------ the zombie
const lerp = (a, b, t) => a + (b - a) * t;
function slerp(a, b, t, out) {
  let [ax, ay, az, aw] = a; let [bx, by, bz, bw] = b;
  let c = ax * bx + ay * by + az * bz + aw * bw;
  if (c < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; c = -c; }
  let k0 = 1 - t, k1 = t;
  if (c < 0.9995) { const th = Math.acos(c), s = Math.sin(th); k0 = Math.sin((1 - t) * th) / s; k1 = Math.sin(t * th) / s; }
  out[0] = ax * k0 + bx * k1; out[1] = ay * k0 + by * k1; out[2] = az * k0 + bz * k1; out[3] = aw * k0 + bw * k1;
  const n = Math.hypot(out[0], out[1], out[2], out[3]) || 1;
  out[0] /= n; out[1] /= n; out[2] /= n; out[3] /= n;
  return out;
}
// rotate a three.js vector (x, y, z) by a quaternion
function qrot(q, v) {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}

/** opts: position [x, y, z], yaw, gore 'full' | 'low' | 'off', missing [parts], state ('idle' | 'eat' | 'wake' | 'chase'),
 *  lodDistance (m), smooth (interpolate between frames, default true), scale, sight (m, default 14), reach (m),
 *  rng (a function like Math.random) */
export function createZombie(pattern, opts = {}) {
  const pat = pattern.json ? pattern : { json: pattern, rig: opts.rig, THREE: null };
  const J = pat.json, R = pat.rig, THREE = pat.THREE;
  const rng = opts.rng || Math.random;
  const stats = { ...J.stats };
  const parts = {};
  for (const k of PARTS) parts[k] = { ...J.parts[k], max: J.parts[k].hp };
  const listeners = {};
  const z = {
    id: J.id, name: J.name, role: J.role, pattern: pat, stats, parts,
    life: stats.life, maxLife: stats.life, missing: closure([...(J.missing || []), ...(opts.missing || [])]),
    state: 'idle', motion: null, mirror: false, phase: 0, time: 0, dead: false, gore: opts.gore || 'full',
    yaw: opts.yaw || 0, pos: [...(opts.position || [0, 0, 0])], halves: [], lower: !!opts.lower,
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return z; },
    off(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); return z; },
    emit(ev, e = {}) { e.zombie = z; for (const fn of listeners[ev] || []) fn(e); for (const fn of listeners['*'] || []) fn(ev, e); },
  };
  for (const p of z.missing) if (parts[p]) parts[p].hp = 0;
  const motions = R.motions;
  let cooldown = 0, flinchCool = 0, hurtCool = 0, headlessTime = 0, sawTarget = false, lastHitDir = [0, 0, 1];
  let torsoChain = 0, torsoT = 0;   // 1.30.0: hits to the body in a row (within 0.9 s): the second one stops it (a stagger)
  let pending = null;   // a motion that plays after the current one-shot (fall -> crawl)

  // ---------------------------------------------------------------- meshes
  // the body is one SkinnedMesh (fine) + one for far away (LOD) on the same bones; the per-piece meshes are made only
  // for what falls off (gibs share the per-piece geometry of the pattern)
  let root = null, body = null, bones = {}, capBones = {}, skinned = null, skinnedLod = null, skinnedCaps = null;
  if (THREE) {
    root = new THREE.Group();
    root.name = 'zombie:' + J.id;
    body = new THREE.Group();
    root.add(body);
    const list = [];
    for (const b of BONES) { const o = new THREE.Bone(); o.name = b; bones[b] = o; list.push(o); }
    for (const c of J.caps) {
      const o = new THREE.Bone(); o.name = c.name; o.position.set(c.at[0], c.at[1], c.at[2]); o.scale.setScalar(0);
      bones[c.bone].add(o); capBones[c.name] = o; list.push(o);
    }
    for (const b of BONES) body.add(bones[b]);
    const skeleton = new THREE.Skeleton(list, list.map(() => new THREE.Matrix4()));
    const mk = (geo) => {
      const m = new THREE.SkinnedMesh(geo, pat.materials.skinned);
      m.bind(skeleton, new THREE.Matrix4());
      m.frustumCulled = false;
      m.userData.zombie = z;
      body.add(m);
      return m;
    };
    skinned = mk(pat.skin.fine);
    skinnedLod = mk(pat.skin.lod);
    skinnedLod.visible = false;
    skinnedCaps = mk(z.gore === 'off' ? pat.skin.capsGrey : pat.skin.caps);
    skinnedCaps.visible = false;
    root.position.set(z.pos[0], z.pos[1], z.pos[2]);
    root.rotation.y = z.yaw;
    if (opts.scale) root.scale.setScalar(opts.scale);
    root.userData.zombie = z;
  }
  z.root = root;
  z.body = body;
  z.bones = bones;
  const hidden = new Set();          // pieces hidden by bone scale (a bone carries one piece; a foot bone its foot)

  function visibleSet() {
    // under a mirrored motion the parts swap sides (the picture is flipped as a whole)
    const m = z.mirror ? new Set([...z.missing].map(swapSide)) : z.missing;
    return m;
  }
  function refreshVisibility() {
    if (!THREE) return;
    const m = visibleSet();
    hidden.clear();
    let anyCap = false;
    for (const p of J.pieces) if (m.has(p.part)) hidden.add(p.bone);
    for (const c of J.caps) {
      const [par, ch] = JOINTS.find((j) => j[2] === c.joint);
      const on = c.side === 'stump' ? !m.has(par) && m.has(ch) : !m.has(ch) && m.has(par);
      capBones[c.name].scale.setScalar(on ? 1 : 0);
      anyCap = anyCap || on;
    }
    skinnedCaps.visible = anyCap;
    skinned.visible = !z._lod; skinnedLod.visible = !!z._lod;
    body.scale.x = z.mirror ? -1 : 1;
  }

  // ---------------------------------------------------------------- the pose of the current time
  const qa = [0, 0, 0, 1];
  function framePose(name) { return R.frames[name] || R.frames['z-idle.1']; }
  function sample() {
    const d = motions[z.motion];
    const fr = d.frames;
    let f = z.phase * d.fps, i = Math.floor(f), t = f - i;
    if (d.loop) { i %= fr.length; } else if (i >= fr.length - 1) { i = fr.length - 1; t = 0; }
    const j = d.loop ? (i + 1) % fr.length : Math.min(i + 1, fr.length - 1);
    if (opts.smooth === false) t = 0;
    return { a: framePose(fr[i]), b: framePose(fr[j]), fa: fr[i], fb: fr[j], t };
  }
  function lowest(fa, fb, t) {
    const m = visibleSet();
    let lo = Infinity;
    for (const p of J.pieces) {
      if (m.has(p.part)) continue;
      const v = lerp(J.zmin[fa][p.name], J.zmin[fb][p.name], t);
      if (v < lo) lo = v;
    }
    return lo === Infinity ? 0 : lo;
  }
  /** pelvis point of a pose in the body group (three metres, before the root) */
  function pelvisAt(name, mirror, t = 0) {
    const d = motions[name];
    const f = d.frames[Math.min(d.frames.length - 1, Math.floor(t * d.fps))];
    const p = framePose(f).b.pelvis;
    return [mirror ? -p[4] : p[4], p[6]];
  }
  function apply() {
    if (!THREE) return;
    const s = sample();
    for (const b of BONES) {
      const A = s.a.b[b], B = s.b.b[b];
      slerp(A, B, s.t, qa);
      const o = bones[b];
      o.quaternion.set(qa[0], qa[1], qa[2], qa[3]);
      o.position.set(lerp(A[4], B[4], s.t), lerp(A[5], B[5], s.t), lerp(A[6], B[6], s.t));
      o.scale.setScalar(hidden.has(b) ? 0 : 1);
    }
    const g = lerp(s.a.ground || 0, s.b.ground || 0, s.t);
    body.position.y = g - lowest(s.fa, s.fb, s.t);
  }

  /** play a motion by name (the lab previews every motion this way) */
  z.play = function play(name, o = {}) {
    if (!motions[name]) return z;
    const mirror = !!o.mirror;
    if (name === z.motion && mirror === z.mirror && !o.restart) return z;
    // anchor: the pelvis stays where it was (the root moves instead), so a body that fell and starts crawling does not jump
    if (z.motion && o.anchor !== false) {
      const a = pelvisAt(z.motion, z.mirror, z.phase), b = pelvisAt(name, mirror, 0);
      const dx = a[0] - b[0], dz = a[1] - b[1];
      const c = Math.cos(z.yaw), sn = Math.sin(z.yaw);
      z.pos[0] += c * dx + sn * dz; z.pos[2] += -sn * dx + c * dz;
    }
    z.motion = name; z.mirror = mirror; z.phase = 0; z.oneShotDone = false;
    refreshVisibility();
    apply();
    z.emit('motion', { name, mirror });
    return z;
  };
  z.do = function act(kind, o = {}) {
    const m = chooseMotion(kind, z.missing, { role: J.role, ...o });
    return z.play(m.name, { mirror: m.mirror, restart: o.restart });
  };

  // ---------------------------------------------------------------- damage
  const ray = { o: [0, 0, 0], d: [0, 0, 1] };
  function rayHit(r) {
    if (!THREE) return null;
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4(), o = new THREE.Vector3(), d = new THREE.Vector3();
    let best = null;
    const m = visibleSet();
    for (const p of J.pieces) {
      if (m.has(p.part)) continue;
      const h = J.hits[p.name];
      const bone = bones[p.bone];
      inv.copy(bone.matrixWorld).invert();
      o.copy(r.origin).applyMatrix4(inv);
      d.copy(r.direction).transformDirection(inv);
      // the direction was normalised in bone space: the distance is measured back in world space
      let t0 = -Infinity, t1 = Infinity;
      for (let a = 0; a < 3; a++) {
        const oa = o.getComponent(a) - h.c[a], da = d.getComponent(a), lo = -h.h[a], hi = h.h[a];
        if (Math.abs(da) < 1e-9) { if (oa < lo || oa > hi) { t0 = Infinity; break; } continue; }
        let ta = (lo - oa) / da, tb = (hi - oa) / da;
        if (ta > tb) [ta, tb] = [tb, ta];
        t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
      }
      if (t0 > t1 || t1 < 0) continue;
      const pl = o.clone().addScaledVector(d, Math.max(t0, 0));
      const pw = pl.applyMatrix4(bone.matrixWorld);
      const dist = pw.distanceTo(r.origin);
      if (!best || dist < best.dist) best = { name: p.name, part: p.part, dist, point: pw };
    }
    if (best && z.mirror) best.part = swapSide(best.part);
    return best;
  }

  /** the nearest visible piece along a ray (no damage): { part, dist, point } | null */
  z.raycast = (r) => rayHit(r);

  /** shoot: target = a part id, or a ray ({ origin, direction } as THREE.Vector3, e.g. raycaster.ray).
   *  -> { part, severed, killed, point } (part null on a miss). o.force: knockback strength; o.dir: shot direction */
  z.hit = function hit(target, damage = 25, o = {}) {
    let part = null, point = null, dir = o.dir;
    if (typeof target === 'string') part = target;
    else if (target && target.origin) {
      const h = rayHit(target);
      if (!h) return { part: null, severed: false, killed: false };
      part = h.part; point = h.point; dir = dir || [target.direction.x, target.direction.y, target.direction.z];
    }
    if (!part || z.missing.has(part) || !parts[part]) return { part: null, severed: false, killed: false };
    if (z.dead && !o.corpse) return { part, severed: false, killed: false, dead: true, point };
    if (dir) lastHitDir = dir;
    const P = parts[part];
    const dmg = damage * P.armor;
    // the body loses what the part could take (a huge shot to an arm takes the arm, not the whole life)
    const took = P.hp > 0 ? Math.min(dmg, P.hp) : dmg * 0.25;
    P.hp -= dmg;
    z.life -= took * P.mult;
    const side = /[LR]$/.test(part) ? part.slice(-1) : (rng() < 0.5 ? 'L' : 'R');
    z.emit('hit', { part, damage: dmg, point, dir });
    z.emit('sound', { kind: P.armor < 0.5 ? 'hit-armor' : 'hit', part });
    let severed = false, killed = false;
    if (P.hp <= 0 && P.severable) severed = sever(part, { point, dir });
    if (!z.dead) {
      if (part === 'head' && severed) killed = !J.headless;
      if (part === 'chest' && P.hp <= 0) killed = true;
      if (z.life <= 0) killed = true;
      if (!bodyOf(z.missing).upper) killed = true;
      if (killed) die(dir);
      else react(part, side, dmg, severed, o);
    }
    return { part, severed, killed, point, life: z.life };
  };

  function react(part, side, dmg, severed, o) {
    const b = bodyOf(z.missing);
    if (!b.head && J.headless && z.state !== 'headless') { z.state = 'headless'; headlessTime = 2.2 + rng(); z.do('headless'); return; }
    if (severed && /^(thigh|shin)/.test(part)) {
      if (b.legs < 2) { z.state = 'fall'; z.do('fall', { side }); pending = 'loco'; z.emit('sound', { kind: 'fall' }); return; }
    }
    if (severed && part === 'pelvis') { z.state = 'chase'; z.do('move'); return; }
    if (b.legs < 2) return;                                // on the floor: no flinch, it keeps coming
    if (stats.knockImmune) return;
    const region = part === 'head' ? 'flinch-head' : /Arm/.test(part) ? 'flinch-arm' : /thigh|shin/.test(part) ? 'flinch-leg' : 'flinch-torso';
    // 1.30.0 (夜勤明けの街 1.2.1): body hits in a row stop it - the second within 0.9 s is a stagger it has to stand through,
    // even inside the flinch cool-down or after a knockback (a tough zombie must still show that the shots land)
    if (region === 'flinch-torso') { torsoChain = torsoT > 0 ? torsoChain + 1 : 1; torsoT = 0.9; } else torsoChain = 0;
    if (torsoChain >= 2 && !stats.staggerImmune) {
      torsoChain = 0; flinchCool = 0.5; hurtCool = 0.7; z.state = 'hurt'; z.do('stagger', { restart: true });
      z.emit('react', { kind: 'stagger', part, side }); return;
    }
    // a strong push throws the body back; the head and the arms keep their own reaction (the head snaps, the arm jerks) unless the
    // blow is huge (1.30.0: a pistol's force 1 to the head was a knockback, so the parts never showed)
    if ((o.force > 0.6 && !/head|Arm/.test(part)) || dmg > 45) { z.state = 'hurt'; z.do('knockback', { restart: true }); hurtCool = 0.8; z.emit('react', { kind: 'knockback', part, side }); return; }
    if (flinchCool > 0 && !severed) return;
    flinchCool = 0.35;
    z.state = 'hurt';
    let kind = region;
    if (/thigh|shin/.test(part) && parts[part].hp < parts[part].max * 0.4 && rng() < 0.5) kind = 'kneel';
    else if (severed) kind = 'stagger';
    z.do(kind, { side, restart: true });
    z.emit('react', { kind, part, side });
  }

  function sever(part, info) {
    if (!THREE && !parts[part]) return false;
    const before = new Set(z.missing);
    const add = part === 'pelvis' ? new Set(['pelvis', 'thighL', 'thighR', 'shinL', 'shinR']) : closure([part]);
    for (const p of add) z.missing.add(p);
    const gone = [...z.missing].filter((p) => !before.has(p));
    for (const p of gone) parts[p].hp = 0;
    let object = null, lower = null;
    if (THREE) {
      if (part === 'pelvis') {
        // the lower half: a zombie of its own with only the pelvis and the legs, twitching where it stood
        lower = createZombie(pat, { position: [...z.pos], yaw: z.yaw, gore: z.gore, lower: true, missing: ['chest', 'head', 'upperArmL', 'upperArmR', 'foreArmL', 'foreArmR', ...[...before].filter((p) => /thigh|shin/.test(p))], rng });
        lower.missing.add('chest');
        lower.play('twitch');
        lower.dead = true;
        lower.state = 'twitch';
        z.halves.push(lower);
        if (root.parent) root.parent.add(lower.root);
        object = lower.root;
      } else object = makeGib(gone, info);
    }
    refreshVisibility();
    z.emit('sever', { part, parts: gone, object, lower, point: info.point, dir: info.dir });
    z.emit('sound', { kind: part === 'head' ? 'sever-head' : 'sever', part });
    if (z.gore !== 'off') z.emit('blood', { point: info.point, dir: info.dir, amount: part === 'head' || part === 'pelvis' ? 2 : 1, part });
    return true;
  }

  /** the severed pieces as one falling group (shared geometry, world transform of the moment), stays on the floor */
  function makeGib(gone, info) {
    root.updateMatrixWorld(true);
    const g = new THREE.Group();
    g.name = 'gib:' + gone.join('+');
    const vis = z.mirror ? new Set(gone.map(swapSide)) : new Set(gone);
    for (const p of J.pieces) {
      if (!vis.has(p.part)) continue;
      const m = new THREE.Mesh(pat.geo.fine[p.name], pat.materials[LEVEL[p.name] ?? 2]);
      m.matrix.copy(bones[p.bone].matrixWorld);
      m.matrix.decompose(m.position, m.quaternion, m.scale);
      g.add(m);
    }
    // the end cap of the loose piece (where it came off): the cap of the gib's root part
    for (const c of J.caps) {
      if (c.side !== 'end' || !vis.has(c.part)) continue;
      const [par] = JOINTS.find((j) => j[2] === c.joint);
      if (vis.has(par)) continue;
      const m = new THREE.Mesh(z.gore === 'off' ? pat.geo.capGrey[c.name] : pat.geo.cap[c.name], pat.materials[0]);
      bones[c.bone].updateMatrixWorld(true);
      const w = new THREE.Matrix4().makeTranslation(c.at[0], c.at[1], c.at[2]).premultiply(bones[c.bone].matrixWorld);
      w.decompose(m.position, m.quaternion, m.scale);
      m.userData.cap = true;
      g.add(m);
    }
    // re-centre the group on its pieces so it tumbles about its own middle
    const c = new THREE.Vector3();
    let n = 0;
    for (const m of g.children) { c.add(m.position); n++; }
    c.multiplyScalar(1 / Math.max(1, n));
    for (const m of g.children) m.position.sub(c);
    g.position.copy(c);
    const d = info.dir || [0, 0, 1];
    const hor = Math.hypot(d[0], d[2]) || 1;
    g.userData.gib = {
      v: [d[0] / hor * (1.2 + rng()), 1.4 + rng() * 1.2, d[2] / hor * (1.2 + rng())],
      w: [(rng() - 0.5) * 9, (rng() - 0.5) * 6, (rng() - 0.5) * 9], floor: z.pos[1], rest: false, t: 0,
    };
    if (root.parent) root.parent.add(g);
    z.gibs = z.gibs || [];
    z.gibs.push(g);
    return g;
  }

  function stepGibs(dt) {
    if (!z.gibs) return;
    const box = new THREE.Box3(), tmp = new THREE.Box3();
    for (const g of z.gibs) {
      const s = g.userData.gib;
      if (s.rest) continue;
      s.t += dt;
      s.v[1] -= 9.8 * dt;
      g.position.x += s.v[0] * dt; g.position.y += s.v[1] * dt; g.position.z += s.v[2] * dt;
      g.rotation.x += s.w[0] * dt; g.rotation.y += s.w[1] * dt; g.rotation.z += s.w[2] * dt;
      g.updateMatrixWorld(true);
      box.makeEmpty();
      for (const m of g.children) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); box.union(tmp); }
      const under = s.floor - box.min.y;
      if (under > 0) {
        g.position.y += under;
        if (s.v[1] < -1.2) { s.v[1] = -s.v[1] * 0.25; s.v[0] *= 0.5; s.v[2] *= 0.5; s.w = s.w.map((w) => w * 0.4); z.emit('sound', { kind: 'gib-land' }); }
        else {
          s.v = [0, 0, 0];
          s.rest = true;
          layDown(g, s.floor);
          z.emit('gib-rest', { object: g });
          if (z.gore !== 'off') z.emit('decal', { point: [g.position.x, s.floor, g.position.z], size: 0.18 + rng() * 0.1 });
        }
      }
      if (s.t > 6) s.rest = true;
    }
  }

  /** a piece at rest lies on its longest side (a leg does not stand on its end), then sits on the floor */
  function layDown(g, floor) {
    const box = new THREE.Box3(), tmp = new THREE.Box3(), inv = new THREE.Matrix4();
    g.updateMatrixWorld(true);
    inv.copy(g.matrixWorld).invert();
    for (const m of g.children) { tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrix); box.union(tmp); }
    const size = box.getSize(new THREE.Vector3());
    const ax = size.x >= size.y && size.x >= size.z ? new THREE.Vector3(1, 0, 0) : size.y >= size.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
    const world = ax.clone().applyQuaternion(g.quaternion);
    const flat = new THREE.Vector3(world.x, 0, world.z);
    if (flat.lengthSq() < 1e-4) flat.set(1, 0, 0);
    flat.normalize();
    g.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(world.normalize(), flat));
    g.updateMatrixWorld(true);
    box.makeEmpty();
    for (const m of g.children) { tmp.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld); box.union(tmp); }
    g.position.y += floor - box.min.y;
    void inv;
  }

  function die(dir) {
    z.dead = true;
    z.state = 'dying';
    let back = false;
    if (dir) {
      // shot from the front (the shot travels against the zombie's facing): it falls on its back
      const fx = Math.sin(z.yaw), fz = Math.cos(z.yaw);
      back = dir[0] * fx + dir[2] * fz < -0.2 && rng() < 0.7;
    }
    z.do(back ? 'die-back' : 'die');
    z.emit('died', { back });
    z.emit('sound', { kind: 'die' });
    if (stats.explode) z.emit('explode', { point: [...z.pos], radius: stats.explode });
  }
  z.kill = (dir) => { if (!z.dead) { z.life = 0; die(dir); } return z; };

  // ---------------------------------------------------------------- the state machine
  const reach = opts.reach || (stats.knockImmune ? 1.4 : 1.0);
  const sight = opts.sight || 14;
  /** dt seconds; target { position: [x, y, z] | Vector3, camera } (no target: it stands or wanders) */
  z.update = function update(dt, target) {
    z.time += dt;
    cooldown -= dt; flinchCool -= dt; hurtCool -= dt; torsoT -= dt;
    for (const h of z.halves) h.update(dt, null);
    const d = motions[z.motion];
    let tp = null, dist = Infinity, ang = 0;
    if (target && target.position) {
      const p = target.position;
      tp = Array.isArray(p) ? p : [p.x, p.y, p.z];
      const dx = tp[0] - z.pos[0], dz = tp[2] - z.pos[2];
      dist = Math.hypot(dx, dz);
      ang = Math.atan2(dx, dz);
    }
    const b = bodyOf(z.missing);
    const oneShot = d && !d.loop;
    const finished = oneShot && z.phase * d.fps >= d.frames.length;
    let speed = 0;
    if (!z.lower) switch (z.state) {
      case 'dying':
        if (finished) { z.state = 'dead'; z.play(z.motion === 'die-back' ? 'corpse-back' : 'corpse-fwd', { anchor: true }); z.emit('corpse', {}); }
        break;
      case 'dead': break;
      case 'eat':
        if (dist < sight * 0.5) { z.state = 'wake'; z.do('get-up'); }
        break;
      case 'wake': case 'hurt': case 'fall': case 'attack': case 'climb':
        if (finished) {
          if (z.state === 'attack') cooldown = stats.attack;
          z.state = 'chase';
          z.do(pending === 'loco' ? 'move' : 'idle');
          pending = null;
        } else if (z.state === 'attack' && z.motion) {
          const hitF = Math.floor(z.phase * d.fps);
          if (hitF >= d.frames.length - 2 && !z._struck) {
            z._struck = true;
            if (dist <= reach + 0.35) z.emit('attack', { damage: b.arms ? stats.damage : Math.round(stats.damage * 0.7), kind: z.motion, grab: z.motion.startsWith('grab') ? stats.grab : 0 });
          }
        }
        break;
      case 'headless':
        headlessTime -= dt;
        speed = (stats.walk || 0.5) * 0.6;
        if (headlessTime <= 0) { z.dead = true; z.state = 'dying'; z.do('die'); z.emit('died', { back: false }); }
        break;
      default: {                                              // idle / chase
        if (tp && dist < sight) {
          if (!sawTarget) { sawTarget = true; z.emit('sound', { kind: 'groan' }); if (stats.scream) z.emit('scream', { point: [...z.pos], radius: stats.scream }); }
          z.state = 'chase';
          z.yaw = turnToward(z.yaw, ang, dt, b.legs === 2 ? 3 : 1.4);
          const facing = Math.abs(angDiff(z.yaw, ang)) < 0.5;
          if (stats.spit && dist > 2.5 && dist < stats.spit && cooldown <= 0 && b.head && facing) {
            cooldown = stats.attack * 1.5;
            z.emit('spit', { from: headPoint(), to: tp, damage: stats.damage });
            z.emit('sound', { kind: 'spit' });
          }
          if (dist <= reach && cooldown <= 0 && facing) {
            z.state = 'attack'; z._struck = false;
            z.do('attack', { lunge: J.role === 'runner' && b.legs === 2, restart: true });
            z.emit('sound', { kind: 'attack' });
          } else if (dist > reach * 0.8) {
            const run = J.role === 'runner' && stats.run && dist > 3 && b.legs === 2;
            z.do(run ? 'run' : 'move');
            const m = z.motion;
            speed = m === 'run' ? stats.run : m === 'walk' || m === 'headless' ? stats.walk
              : m === 'hop' ? stats.walk * 0.7 : m === 'crawl' ? Math.min(0.42, stats.walk * 0.7) : m === 'crawl1' ? 0.28 : m === 'squirm' ? 0.14 : stats.walk;
          } else z.do('idle');
        } else if (z.state === 'chase' || !z.motion) { z.state = 'idle'; z.do('idle'); }
      }
    }
    // advance: a cyclic motion with a stride is timed by the distance covered (the feet do not slide)
    const dm = motions[z.motion];
    if (dm) {
      if (dm.loop && dm.stride && speed > 0) z.phase += dt * speed / dm.stride * (dm.frames.length / dm.fps);
      else z.phase += dt;
      if (dm.loop) z.phase %= dm.frames.length / dm.fps;
      if (z.lower && z.time > 5) z.phase = 0;              // the lower half twitches a while, then lies still
    }
    if (speed > 0) { z.pos[0] += Math.sin(z.yaw) * speed * dt; z.pos[2] += Math.cos(z.yaw) * speed * dt; }
    if (THREE) {
      apply();
      root.position.set(z.pos[0], z.pos[1], z.pos[2]);
      root.rotation.y = z.yaw;
      stepGibs(dt);
      const cam = target && target.camera;
      if (cam) {
        const far = Math.hypot(cam.position.x - z.pos[0], cam.position.z - z.pos[2]) > (opts.lodDistance || 9);
        if (far !== !!z._lod) { z._lod = far; refreshVisibility(); }
      }
    }
    return z;
  };

  function headPoint() {
    const p = R.frames['z-idle.1'].b.head;
    return [z.pos[0], z.pos[1] + p[5] + 0.12, z.pos[2]];
  }
  z.setGore = function setGore(g) {
    z.gore = g;
    if (THREE) skinnedCaps.geometry = g === 'off' ? pat.skin.capsGrey : pat.skin.caps;
    for (const h of z.halves) h.setGore(g);
    return z;
  };
  /** a body for a corpse pile or a test: these parts gone without effects */
  z.remove = function remove(list) { for (const p of closure(list)) { z.missing.add(p); if (parts[p]) parts[p].hp = 0; } refreshVisibility(); return z; };
  z.dispose = function dispose() {
    if (!THREE) return;
    for (const g of z.gibs || []) g.removeFromParent();
    for (const h of z.halves) h.dispose();
    root.removeFromParent();
  };

  const start = opts.state || 'idle';
  if (start === 'eat') { z.state = 'eat'; z.do('eat'); }
  else if (start === 'wake') { z.state = 'wake'; z.do('wake'); }
  else if (start === 'corpse') { z.dead = true; z.state = 'dead'; z.do('corpse'); }
  else if (!z.lower) { z.state = 'idle'; z.do(bodyOf(z.missing).legs === 2 ? 'idle' : 'move'); }
  return z;
}

function angDiff(a, b) { return ((b - a) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI; }
function turnToward(a, target, dt, rate) {
  const d = angDiff(a, target), m = rate * dt;
  return Math.abs(d) <= m ? target : a + Math.sign(d) * m;
}

// ------------------------------------------------------------------ blood: spray, decals (gore full | low | off)
/** effects for the zombie events: blood spray (small voxel cubes), floor decals (dark red squares that stay), and the
 *  gibs' landing. o: { gore, maxDecals (64), maxDrops (400) }. fx.watch(zombie); fx.update(dt) every frame. */
export function createGoreFx(THREE, scene, o = {}) {
  let gore = o.gore || 'full';
  const maxDrops = o.maxDrops || 400, maxDecals = o.maxDecals || 64;
  const cube = new THREE.BoxGeometry(0.025, 0.025, 0.025);
  const dropMat = new THREE.MeshLambertMaterial({ color: 0x6a0c10 });
  const drops = new THREE.InstancedMesh(cube, dropMat, maxDrops);
  drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  drops.count = 0;
  drops.frustumCulled = false;
  scene.add(drops);
  const live = [];
  const decalGeo = new THREE.PlaneGeometry(1, 1);
  decalGeo.rotateX(-Math.PI / 2);
  const decalTex = pixelSplat(THREE);
  const decalMat = new THREE.MeshLambertMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const decals = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3();
  // 1.30.0: a small hit flash where a shot lands (a hard-pixel star, additive, 0.09 s; also with the gore off - it is not blood)
  const flashTex = pixelStar(THREE), flashes = [];
  const fx = {
    get gore() { return gore; },
    set gore(g) { gore = g; for (const d of decals) d.visible = g !== 'off'; },
    watch(z) {
      z.on('blood', (e) => fx.spray(e.point, e.dir, e.amount));
      z.on('hit', (e) => { if (e.point) { fx.spray(e.point, e.dir, 0.35); fx.flash(e.point, e.part === 'head' ? 1.3 : 1); } });
      z.on('decal', (e) => fx.decal(e.point, e.size));
      z.on('died', () => fx.decal([z.pos[0], z.pos[1], z.pos[2]], 0.45));
      return fx;
    },
    spray(point, dir, amount = 1) {
      if (gore === 'off' || !point) return;
      const p = point.isVector3 ? [point.x, point.y, point.z] : point;
      const d = dir || [0, 0, 1];
      const n = Math.round((gore === 'low' ? 6 : 22) * amount);
      for (let i = 0; i < n; i++) {
        if (live.length >= maxDrops) live.shift();
        live.push({ p: [...p], v: [d[0] * 1.4 + (Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.8, d[2] * 1.4 + (Math.random() - 0.5) * 1.6], t: 0, floor: o.floor || 0 });
      }
    },
    decal(point, size = 0.25) {
      if (gore === 'off' || !point) return;
      const s = gore === 'low' ? size * 0.6 : size;
      let m;
      if (decals.length >= maxDecals) { m = decals.shift(); } else { m = new THREE.Mesh(decalGeo, decalMat); m.renderOrder = 1; scene.add(m); }
      m.position.set(point[0] + (Math.random() - 0.5) * 0.1, (o.floor || 0) + 0.003, point[2] + (Math.random() - 0.5) * 0.1);
      m.scale.set(s, 1, s);
      m.rotation.y = Math.floor(Math.random() * 4) * Math.PI / 2;
      decals.push(m);
    },
    flash(point, size = 1) {
      if (!point || !THREE.Sprite) return;
      const p = point.isVector3 ? point : new THREE.Vector3(point[0], point[1], point[2]);
      let f = flashes.find((x) => x.t >= x.life);
      if (!f) {
        if (flashes.length >= 8) f = flashes[0];
        else { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: 0xfff0c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); m.renderOrder = 5; scene.add(m); f = { m }; flashes.push(f); }
      }
      f.t = 0; f.life = 0.09; f.s = 0.16 * size; f.m.position.copy(p); f.m.material.rotation = Math.floor(Math.random() * 4) * Math.PI / 4; f.m.visible = true;
    },
    update(dt) {
      for (const f of flashes) { if (f.t >= f.life) { f.m.visible = false; continue; } f.t += dt; const u = Math.min(1, f.t / f.life); f.m.scale.setScalar(f.s * (0.7 + u * 0.6)); f.m.material.opacity = 1 - u; }
      let k = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const d = live[i];
        d.t += dt;
        d.v[1] -= 9.8 * dt;
        d.p[0] += d.v[0] * dt; d.p[1] += d.v[1] * dt; d.p[2] += d.v[2] * dt;
        if (d.p[1] <= d.floor) { live.splice(i, 1); if (Math.random() < 0.12) fx.decal(d.p, 0.06 + Math.random() * 0.05); }
      }
      for (const d of live) {
        m4.compose(pv.set(d.p[0], d.p[1], d.p[2]), q, sc.set(1, 1, 1));
        drops.setMatrixAt(k++, m4);
      }
      drops.count = k;
      drops.instanceMatrix.needsUpdate = true;
    },
    dispose() { scene.remove(drops); for (const d of decals) scene.remove(d); for (const f of flashes) scene.remove(f.m); },
  };
  return fx;
}

function pixelStar(THREE) {
  const N = 16, data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = Math.abs(x - 7.5), dy = Math.abs(y - 7.5), i = (y * N + x) * 4;
    const core = dx < 2 && dy < 2, ray = (dx < 1 && dy < 7) || (dy < 1 && dx < 7) || (Math.abs(dx - dy) < 1 && dx < 4.5);
    const v = core ? 255 : ray ? 200 : 0;
    data[i] = v; data[i + 1] = core ? 255 : Math.round(v * 0.85); data[i + 2] = core ? 240 : Math.round(v * 0.5); data[i + 3] = v;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

function pixelSplat(THREE) {
  const N = 16, data = new Uint8Array(N * N * 4);
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (x - 7.5) / 7.5, dy = (y - 7.5) / 7.5, d = Math.hypot(dx, dy) + (r() - 0.5) * 0.35;
    const i = (y * N + x) * 4;
    const dark = r() < 0.3;
    data[i] = dark ? 60 : 92; data[i + 1] = dark ? 6 : 12; data[i + 2] = dark ? 8 : 14;
    data[i + 3] = d < 0.8 ? 235 : 0;
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}
