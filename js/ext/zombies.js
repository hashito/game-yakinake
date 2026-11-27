// The zombies: the kit's dot zombies (js/kit/dot-zombie.js, 50 patterns, parts that come off) placed room by room (js/ext/spawns.js),
// woken by sight and by noise, walking only through open doors, kept off the furniture, at most MAX on screen (phones fewer, LOD 9 m).
// Every one is a little different: height, stoop, the colour of the skin and the clothes, how far it has rotted.
// Their sounds (groans, screams, bursting) are the game's own files (assets/sfx/z-*.mp3, made through the local media queue).
import * as THREE from 'three';
import { loadZombiePattern, createZombie, createGoreFx } from '../kit/dot-zombie.js';
import { SPAWNS, PATTERNS } from './spawns.js';
import { corpseLine } from './corpses.js';

const ZDIR = new URL('../../assets/zombies/', import.meta.url).href;

export function installZombies(ext, G) {
  const pats = new Map();
  const live = new Map();    // spawn id -> { def, z, room, floor, alert, wp, lastGroan, home }
  G.killed = new Set();
  G.killedAt = {};   // 1.4.0 #4: where each one fell (the bodies stay where they fell, after a save and a death too)
  let ctx = null, fx = null, rooms = [], roomById = new Map(), doorList = [];
  const touch = () => (ctx && ctx.isTouch) || matchMedia('(pointer: coarse)').matches;
  const MAX = () => (touch() ? 12 : 15);
  const RADIUS = 26;

  // 1.3.0 (play test #10 「重すぎて開かない」): the patterns are loaded block by block (js/ext/blocks.js), not all 40 behind the title.
  // loadPatterns(ids): the ones not loaded yet; unloadPatterns(keep): every other one goes, with the bodies made of it (they are far away)
  G.loadPatterns = async (ids, report = () => {}) => {
    const want = [...new Set(ids)].filter((id) => PATTERNS.includes(id) && !pats.has(id));
    let k = 0;
    await Promise.all(want.map(async (id) => {
      try { pats.set(id, await loadZombiePattern(THREE, `${ZDIR}${id}.json`)); } catch (e) { console.warn('[yakinake] zombie pattern', id, e); }
      report(++k / Math.max(1, want.length), `ゾンビを準備中… ${Math.round((k / Math.max(1, want.length)) * 100)}%`);
    }));
    return want.length;
  };
  G.ensurePatterns = (ids) => G.loadPatterns(ids).then(() => true);   // tests: a pattern from another block, before extraZombie
  G.unloadPatterns = (keep) => {
    const K = new Set(keep || []);
    for (const [id, L] of [...live]) if (!K.has(L.def.p)) despawn(id);
    let n = 0;
    for (const [id, pat] of [...pats]) {
      if (K.has(id)) continue;
      const geos = [...Object.values(pat.geo || {}).flatMap((g) => Object.values(g)), ...Object.values(pat.skin || {})];
      for (const g of geos) if (g && g.dispose) g.dispose();
      pats.delete(id); n++;
    }
    return n;
  };
  G.loadedPatterns = () => [...pats.keys()];
  G.patternOf = (id) => pats.get(id) || null;

  ext.on('game:ready', (c) => {
    ctx = c;
    rooms = (ctx.data.plan.rooms || []).map((r) => ({ ...r, floor: r.floor || 0 }));
    for (const r of rooms) roomById.set(r.id, r);
    doorList = (ctx.data.plan.doors || []).filter((d) => d.x != null && (!d.kind || d.kind === 'door' || d.kind === 'exit'));
    fx = createGoreFx(THREE, ctx.scene, { gore: G.gore, maxDecals: touch() ? 32 : 64, maxDrops: touch() ? 200 : 400 });
    G.zfx = fx;
  });
  G.on('gore', (g) => { if (fx && fx.setGore) fx.setGore(g); for (const L of live.values()) L.z.setGore(g); });

  // ---------------------------------------------------------------- the house rules for a body that walks
  const roomAtP = (x, z, floor) => { for (const r of rooms) if (r.floor === floor && x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) return r; return null; };
  G.roomAtP = roomAtP;
  const doorOpen = (d) => { const w = ctx.world.doors && ctx.world.doors.get(d.id); return d.open && !d.unlock ? true : !!(w && w.isOpen); };
  const doorsBetween = (a, b) => doorList.filter((d) => ((d.a === a && d.b === b) || (d.a === b && d.b === a)));
  // the room graph through open doors, for a woken body two rooms away
  function nextDoor(fromRoom, toRoom) {
    if (!fromRoom || !toRoom || fromRoom === toRoom) return null;
    const prev = new Map([[fromRoom, null]]), q = [fromRoom];
    while (q.length) {
      const r = q.shift(); if (r === toRoom) break;
      for (const d of doorList) {
        if (!doorOpen(d)) continue;
        const n = d.a === r ? d.b : d.b === r ? d.a : null; if (!n || prev.has(n)) continue;
        prev.set(n, { r, d }); q.push(n);
      }
    }
    if (!prev.has(toRoom)) return null;
    let cur = toRoom, step = prev.get(cur);
    while (step && step.r !== fromRoom) { cur = step.r; step = prev.get(cur); }
    return step ? step.d : null;
  }
  // a point just past the door, into the next room (the body walks through, not into the frame)
  function pastDoor(d, fromRoom) {
    const a = roomById.get(fromRoom) || {}, ax = (a.x || 0) + (a.w || 0) / 2, az = (a.z || 0) + (a.d || 0) / 2;
    const dx = d.x - ax, dz = d.z - az, horiz = Math.abs(dx) * (a.d || 1) > Math.abs(dz) * (a.w || 1);
    return horiz ? [d.x + Math.sign(dx) * 1.2, d.z] : [d.x, d.z + Math.sign(dz) * 1.2];
  }
  // keep the body in the rooms and out of the furniture: undo a step that leaves every room, or crosses a wall away from an open door
  function settle(L, ox, oz) {
    const z = L.z, fl = L.floor, nx = z.pos[0], nz = z.pos[2];
    let r = roomAtP(nx, nz, fl);
    if (!r) { z.pos[0] = ox; z.pos[2] = oz; return; }
    if (L.room && r.id !== L.room) {
      const ds = doorsBetween(L.room, r.id).filter(doorOpen);
      const ok = ds.some((d) => Math.hypot(nx - d.x, nz - d.z) < (d.width || 1.4) / 2 + 0.15);
      if (!ok) { z.pos[0] = ox; z.pos[2] = oz; return; }
      L.room = r.id;
    } else L.room = r.id;
    // walls: 0.3 m from the room's sides except in a doorway
    const R = roomById.get(L.room), m = 0.3;
    const inDoor = doorList.some((d) => doorOpen(d) && (d.a === L.room || d.b === L.room) && Math.hypot(nx - d.x, nz - d.z) < (d.width || 1.4) / 2 + 0.05);
    if (!inDoor && R) { z.pos[0] = Math.min(R.x + R.w - m, Math.max(R.x + m, z.pos[0])); z.pos[2] = Math.min(R.z + R.d - m, Math.max(R.z + m, z.pos[2])); }
    // furniture and the other colliders (on this floor's height)
    const y0 = ctx.world.floorY(fl);
    for (const c of ctx.world.colliders) {
      if (c.off || !c.box) continue; const b = c.box;
      if (b.max.y < y0 + 0.3 || b.min.y > y0 + 1.6) continue;
      const px = z.pos[0], pz = z.pos[2], rr = 0.28;
      if (px > b.min.x - rr && px < b.max.x + rr && pz > b.min.z - rr && pz < b.max.z + rr) {
        const dl = px - (b.min.x - rr), dr = (b.max.x + rr) - px, dt = pz - (b.min.z - rr), db = (b.max.z + rr) - pz, mn = Math.min(dl, dr, dt, db);
        if (mn === dl) z.pos[0] = b.min.x - rr; else if (mn === dr) z.pos[0] = b.max.x + rr; else if (mn === dt) z.pos[2] = b.min.z - rr; else z.pos[2] = b.max.z + rr;
      }
    }
  }

  // ---------------------------------------------------------------- one body
  const rnd = (seed) => { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); };
  const hash = (s) => { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 100000; return h; };
  // 1.2.0 (play test #2 「ゾンビの体力が少ないので、強くしてください」): toughness by block, weak in the hospital and stronger on the way
  // to the roof. Life and every part's hp are multiplied, so a head shot stays the quick way (the head breaks after 2-3 pistol rounds
  // everywhere) and the body takes more: pistol rounds to the chest 4 / 5 / 5 / 6 / 7 (was 3). The giant (330 life) gets its own.
  // tools/ammo-budget.mjs adds up what each block needs against the ammo lying in it.
  G.TOUGH = { H: 1.3, S: 1.6, P: 1.9, O: 2.2, ROOF: 2.4, giant: 1.6 };
  const BLOCK_OF = { O_PLAZA: 'P' };   // the plaza in front of the tower is still the police block's fight
  G.toughOf = (def) => def.p === 'giant' ? G.TOUGH.giant : def.room === 'O_ROOF' ? G.TOUGH.ROOF : G.TOUGH[BLOCK_OF[def.room] || String(def.room || '').charAt(0)] || 1;
  // 1.6.0 (play test 2 #5 「敵をもう少し強くしてダメージを食らうように」): by block they hit harder, strike again sooner and close in a little
  // faster (bite 15 -> hospital 18, streets 20, police and tower 23, roof 20; the strike every 1.4 s -> 1.26 / 1.19 / 1.12 / 1.12 / 1.26 s). The roof
  // was x1.75 first: a human-paced bot fell in all four tries within 55 s, so the roof is x1.3
  G.FIERCE = { H: [1.2, 0.9, 1.08], S: [1.35, 0.85, 1.12], P: [1.5, 0.8, 1.15], O: [1.5, 0.8, 1.15], ROOF: [1.3, 0.9, 1.08] };
  // the giant keeps its own numbers (40 a blow, every 2 s): it is the set piece, and at x1.45 two blows ended the roof in the bot runs
  const fiercen = (z, def) => {
    if (def.p === 'giant') return;
    const b = def.room === 'O_ROOF' ? 'ROOF' : BLOCK_OF[def.room] || String(def.room || '').charAt(0), F = G.FIERCE[b]; if (!F) return;
    z.stats.damage = Math.round((z.stats.damage || 15) * F[0]); z.stats.attack = +((z.stats.attack || 1.4) * F[1]).toFixed(2); if (z.stats.walk) z.stats.walk = +(z.stats.walk * F[2]).toFixed(3);
  };
  const toughen = (z, k) => { if (k === 1) return; for (const P of Object.values(z.parts)) { P.max = Math.round(P.max * k); P.hp = P.hp > 0 ? P.max : 0; } z.life = z.maxLife = Math.round(z.maxLife * k); z.tough = k; };
  // 1.4.0 #6 「釘が効かないヘルメットや装備の個体。体の一部だけ」: armour on some parts (a helmet, a vest, pads). Nails, the scalpel, the
  // fists and the pistol glance off it (a spark and a clink, no harm); the bar knocks through a little; the axe, the shotgun and the
  // rifle go through at 60 %. The bare parts take everything. The riot police's own gear (their pattern) counts as armour too.
  const ARMOR_KIT = {
    helmet: ['head'], vest: ['chest', 'pelvis'], pads: ['shinL', 'shinR', 'foreArmL', 'foreArmR'],
  };
  const POWER = { nailgun: 'weak', scalpel: 'weak', hands: 'weak', pistol: 'weak', pipe: 'blunt', axe: 'strong', shotgun: 'strong', rifle: 'strong' };
  // #12: how much blood a hit throws, by the weapon
  const SPRAY = { shotgun: 2.4, rifle: 1.8, axe: 2.0, pistol: 1.0, pipe: 0.8, nailgun: 0.5, scalpel: 0.7, hands: 0.35 };
  const armoredParts = (L) => {
    const s = new Set(); for (const k of L.def.armor || []) for (const p of ARMOR_KIT[k] || []) s.add(p);
    for (const [p, P] of Object.entries(L.z.parts)) if (P.armor < 0.5) s.add(p);
    return s;
  };
  function spawn(def) {
    const pat = pats.get(def.p); if (!pat) return null;
    const R = roomById.get(def.room); if (!R) return null;
    const floor = R.floor, y = ctx.world.floorY(floor);
    const dead = G.killed.has(def.id) || def.state === 'corpse', at = G.killedAt[def.id];
    const state = dead ? 'corpse' : def.riser ? 'lie' : def.state || 'idle';
    const z = createZombie(pat, { position: [at ? at[0] : def.x, y, at ? at[1] : def.z], yaw: at ? at[2] : def.yaw ?? Math.PI, gore: G.gore, state, missing: def.missing || [], lodDistance: touch() ? 7 : 9, sight: def.sight || 13 });
    // the person it was: height, stoop, the colour of the clothes and the skin, how far it has rotted
    const r = rnd(hash(def.id));
    // 1.4.0 #2 「大きくて強い個体」: a brute is half as big again, slow and heavy, three times as tough, hits harder and charges
    const tall = def.brute ? 1.45 : def.p === 'crawler' || def.p === 'giant' ? 1 : 0.9 + r() * 0.18;
    z.root.scale.setScalar(tall);
    toughen(z, G.toughOf(def) * (def.brute ? 3 : 1));
    fiercen(z, def);
    if (def.brute) { z.stats.walk = (z.stats.walk || 0.5) * 0.85; z.stats.damage = Math.round((z.stats.damage || 15) * 1.6); z.stats.grab = Math.max(z.stats.grab || 0, 1.1); z.stats.knockImmune = true; }
    z.body.rotation.x = (r() - 0.35) * 0.12;   // some lean forward, a few lean back
    const rot = def.rot ?? (/-rot|drowned|bloated/.test(def.p) ? 0.6 : /-dry|skeletal|burnt/.test(def.p) ? 0.3 : r() * 0.45);
    z.root.traverse((m) => {
      if (!m.isSkinnedMesh) return;
      m.material = m.material.clone();
      const c = new THREE.Color(1, 1, 1);
      const hsl = { h: 0, s: 0, l: 0 };
      // decay: towards a grey-green; then a little hue and brightness of its own
      c.setRGB(1 - rot * 0.18, 1 - rot * 0.06, 1 - rot * 0.22);
      c.getHSL(hsl); c.setHSL((hsl.h + (r() - 0.5) * 0.06 + 1) % 1, Math.min(1, hsl.s + (r() - 0.5) * 0.2), Math.min(1, hsl.l * (0.86 + r() * 0.24)));
      if (def.p === 'skeletal') c.setRGB(1.3, 1.26, 1.16);   // the half-skeleton: the bones read pale even in the dark
      m.material.color.copy(c);
      m.material.name = `zombie-skin:${def.id}`;
    });
    ctx.scene.add(z.root);
    fx.watch(z);
    const L = { def, z, room: def.room, floor, alert: 0, wp: null, groan: 2 + r() * 6, wander: r() * 4, home: [def.x, def.z], alive: !dead, r, charge: 0, chargeCool: 3, step: 0 };
    L.armor = armoredParts(L);
    for (const p of L.armor) z.parts[p].armor = 1;   // the game's armour rule decides (hitZombie), not the kit's flat factor
    if (def.armor && def.armor.length) addArmorLook(L);
    if (dead) { L.alive = false; setTimeout(() => layBody(L, { quiet: true }), 50); }
    else if (def.sheet && state === 'lie') L.sheet = { g: makeSheet(def), t: 0, placed: false };
    z.on('attack', (e) => {
      const p = ctx.camera.position;
      if (Math.hypot(p.x - z.pos[0], p.z - z.pos[2]) > 1.55 || ctx.floor !== L.floor) return;
      G.hurt(e.damage, { grab: e.grab, reason: 'bitten', by: L });
    });
    z.on('spit', (e) => { const p = ctx.camera.position; if (Math.hypot(p.x - z.pos[0], p.z - z.pos[2]) < 9 && ctx.floor === L.floor) setTimeout(() => G.hurt(e.damage * 0.6, { reason: 'spit' }), 450); });
    z.on('explode', () => { const p = ctx.camera.position; G.sfx3d('z-burst', z.root.position); G.emit('zombie:burst', { point: z.root.position.clone().setY(y + 1.0), floorY: y }); if (Math.hypot(p.x - z.pos[0], p.z - z.pos[2]) < 2.6) G.hurt(40, { reason: 'burst' }); });
    z.on('scream', (e) => { G.sfx3d('z-scream', z.root.position); G.noise(new THREE.Vector3(z.pos[0], y, z.pos[2]), e.radius || 14, { floor }); });
    z.on('sound', (e) => {
      const k = e.kind;
      if (k === 'groan') G.sfx3d(`z-groan-${1 + Math.floor(r() * 6)}`, z.root.position);
      else if (k === 'attack') G.sfx3d(`z-attack-${1 + Math.floor(r() * 3)}`, z.root.position);
      else if (k === 'die') G.sfx3d(`z-die-${1 + Math.floor(r() * 3)}`, z.root.position);
      else if (k === 'hit' || k === 'hit-armor') G.sfx3d(k === 'hit' ? 'hit-flesh' : 'hit-armor', z.root.position);
      else if (k === 'sever' || k === 'sever-head') G.sfx3d('sever', z.root.position);
      else if (k === 'fall' || k === 'gib-land') G.sfx3d('fall', z.root.position);
      else if (k === 'spit') G.sfx3d('z-spit', z.root.position);
    });
    // 1.7.0 #4: the cubes of the part that came off fly from where it broke (js/ext/impacts.js)
    z.on('sever', (e) => { G.emit('zombie:sever', { id: def.id, parts: e.parts, part: e.part, point: e.point || (z.bones[e.part] ? z.bones[e.part].getWorldPosition(new THREE.Vector3()) : null), dir: e.dir, floorY: y }); });
    z.on('died', () => { L.alive = false; G.killed.add(def.id); G.emit('zombie:died', { id: def.id, p: def.p, brute: !!def.brute }); setTimeout(() => { G.killedAt[def.id] = [Math.round(z.pos[0] * 100) / 100, Math.round(z.pos[2] * 100) / 100, Math.round(z.yaw * 100) / 100]; layBody(L); }, 1600); });
    live.set(def.id, L);
    return L;
  }
  // 1.2.0 #6: a fallen one can be looked at ([E]): a low box over the body once it lies still, one short line of who it was
  const bodyBoxes = new Map(), bodyMat = new THREE.MeshBasicMaterial({ visible: false });
  const unbody = (id) => { const b = bodyBoxes.get(id); if (!b) return; b.removeFromParent(); const W = ctx && ctx.world, i = W ? W.interactables.indexOf(b) : -1; if (i >= 0) W.interactables.splice(i, 1); bodyBoxes.delete(id); };
  const layBody = (L, o = {}) => {
    const line = corpseLine(L.def); if (!line || !ctx || !live.has(L.def.id)) return;
    unbody(L.def.id);
    // #12: a pool spreads under a fallen body (at once under one that lay there already)
    if (fx && fx.pool && !L.pooled) { L.pooled = true; fx.pool([L.z.pos[0], ctx.world.floorY(L.floor), L.z.pos[2]], L.def.brute ? 1.5 : 1.0, o.quiet ? 0.01 : 9); }
    const z = L.z, c = new THREE.Vector3(); let n = 0;
    { const a = z.root.matrixWorldAutoUpdate; z.root.matrixWorldAutoUpdate = true; z.root.updateMatrixWorld(true); z.root.matrixWorldAutoUpdate = a; }   // an unseen body too (1.6.0)
    z.root.traverse((m) => { if (m.isBone && /chest|pelvis|spine|head/i.test(m.name)) { c.add(m.getWorldPosition(new THREE.Vector3())); n++; } });
    if (n) c.multiplyScalar(1 / n); else c.set(z.pos[0], z.pos[1], z.pos[2]);
    const y = ctx.world.floorY(L.floor), b = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1.2), bodyMat);
    b.position.set(c.x, y + 0.25, c.z); b.name = `corpse:${L.def.id}`;
    b.userData.interact = { kind: 'corpse', id: L.def.id, label: '倒れた人' };
    ctx.world.group.add(b); ctx.world.interactables.push(b); bodyBoxes.set(L.def.id, b);
  };
  ext.registerInteract('corpse', {
    prompt: () => '[E] 調べる：倒れた人',
    run: (o) => { const L = live.get(o.id); const line = corpseLine(L ? L.def : SPAWNS.find((d) => d.id === o.id)); if (line) ctx.ui.say(line, 4); },
  });
  G.corpseLine = (id) => { const L = live.get(id); return corpseLine(L ? L.def : SPAWNS.find((d) => d.id === id)); };
  G.bodyBox = (id) => bodyBoxes.get(id) || null;
  const despawn = (id) => { const L = live.get(id); if (!L) return; unbody(id); if (L.sheet) L.sheet.g.removeFromParent(); L.z.dispose(); live.delete(id); };

  // which spawns are in the world now: their condition (a stage reached, a task done, a flag) holds and they are not dead
  const wanted = (def) => {
    const st = ctx.state;   // 1.4.0 #4: the dead are wanted too - they lie where they fell
    if (def.stage && ctx.levelIndex(def.stage) > (ctx.prog ? ctx.prog.index : 0)) return false;
    if (def.after && !st.tasks.includes(def.after)) return false;
    if (def.flag && !G.flags[def.flag]) return false;
    if (def.notFlag && G.flags[def.notFlag]) return false;
    if (def.until && st.tasks.includes(def.until)) return false;
    return true;
  };
  G.syncZombies = () => {
    if (!ctx || !pats.size) return;
    for (const def of SPAWNS) {
      const ok = wanted(def), L = live.get(def.id);
      if (ok && !L) spawn(def); else if (!ok && L && L.alive) despawn(def.id);
    }
  };
  // the helmet, the vest, the pads: dark boxes on the bones (so the armour is seen before it is hit)
  const armorMat = new THREE.MeshLambertMaterial({ color: 0x2a3036 }); armorMat.name = 'yk-armor';
  const helmetMat = new THREE.MeshLambertMaterial({ color: 0xd8b020 }); helmetMat.name = 'yk-helmet';
  function addArmorLook(L) {
    const b = L.z.bones, kinds = L.def.armor || [];
    const put = (bone, w, h, d, y, mat, dz = 0) => { if (!b[bone]) return; const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(0, y, dz); m.name = 'zombie-armor'; b[bone].add(m); };
    // 1.6.2 (re-check 2026-11-24): the helmet sat inside the dot head (its top 1.65 m, the head's 1.72 m) and only grey hair showed (the brim ran across
    // the eyes) - 8 cm higher, a shell over the crown and its brim at the brow, so the armoured one is seen before it is hit
    if (kinds.includes('helmet')) { const riot = L.def.helmet === 'riot'; put('head', 0.25, riot ? 0.15 : 0.11, 0.27, riot ? 0.2 : 0.23, riot ? armorMat : helmetMat); if (!riot) put('head', 0.3, 0.025, 0.32, 0.18, helmetMat); }
    if (kinds.includes('vest')) put('chest', 0.38, 0.4, 0.26, 0.14, armorMat);
    if (kinds.includes('pads')) { for (const s of ['shinL', 'shinR']) put(s, 0.13, 0.22, 0.13, -0.12, armorMat, 0.02); }
  }
  /** back to how the zombies were at the checkpoint: the dead stay dead, the rest stand where they started */
  G.resetZombies = (killed, at) => {
    G.killed = new Set(killed || []);
    if (at) G.killedAt = { ...at };
    for (const id of [...live.keys()]) despawn(id);
    G.syncZombies();
  };
  G.extraZombie = (def) => { const L = spawn(def); if (L) { L.alert = 30; } return L; };
  G.liveZombies = () => [...live.values()];

  // noise: every body within r metres (through any open way) wakes and comes to where the noise was
  G.noise = (p, r, o = {}) => {
    const fl = o.floor ?? (ctx ? ctx.floor : 0);
    for (const L of live.values()) {
      if (!L.alive || L.floor !== fl) continue;
      const d = Math.hypot(L.z.pos[0] - p.x, L.z.pos[2] - p.z);
      if (d < r) { L.alert = Math.max(L.alert, 10); L.heard = [p.x, p.z]; }
    }
  };

  // the targets for the weapons
  const aim = new THREE.Vector3();
  G.zombieTargets = () => {
    const out = [];
    for (const L of live.values()) {
      if (!L.z.root.visible) continue;
      const z = L.z;
      out.push({ kind: 'zombie', id: L.def.id, alive: L.alive && !z.dead, corpse: z.dead, pos: z.root.position, dist: 0,
        raycast: (r) => z.raycast(r), hit: (r, dmg, o = {}) => hitZombie(L, r, dmg, o),
        aimPoints: () => { const b = z.bones; const pts = []; for (const k of ['head', 'chest']) { if (b[k] && !z.missing.has(k)) { b[k].getWorldPosition(aim); pts.push(aim.clone().setY(aim.y + (k === 'head' ? 0.08 : 0.15))); } } if (!pts.length) pts.push(z.root.position.clone().setY(z.root.position.y + 0.3)); return pts; } });
    }
    return out;
  };

  // a hit: a lying riser gets up; armour by the weapon (a glance: spark, clink, nothing else); the blood by the weapon
  const tmpV = new THREE.Vector3();
  function hitZombie(L, r, dmg, o) {
    const z = L.z, w = o.weapon || 'hands';
    if (z.lying && z.lying()) riseNow(L, true);
    let part = typeof r === 'string' ? r : null, point = null;
    if (!part) { const q = z.raycast(r); if (!q) return { part: null }; part = q.part; point = q.point; }
    L.alert = 30;
    if (L.armor.has(part) && !z.dead) {
      const pw = POWER[w] || 'weak';
      if (pw === 'weak') {
        const p = point || (z.bones[part] ? z.bones[part].getWorldPosition(tmpV).clone() : z.root.position.clone());
        if (fx) fx.flash(p, 1.4); G.sfx3d('hit-armor', z.root.position);
        if (!G.flags['hint:armor']) { G.flags['hint:armor'] = true; setTimeout(() => ctx.ui.say(part === 'head' ? 'ヘルメットに弾かれた。むき出しの所を狙う。' : '防具に弾かれた。むき出しの所を狙う。', 5, { urgent: true }), 200); }
        G.emit('armor:glance', { id: L.def.id, part, weapon: w });
        return { part, armor: true };
      }
      dmg *= pw === 'blunt' ? 0.3 : 0.6;
      G.sfx3d('hit-armor', z.root.position);
    }
    const res = z.hit(r, dmg, { ...o, corpse: false });
    if (o.sever && res && res.part && !res.severed && !z.dead && z.parts[res.part] && z.parts[res.part].hp > 0 && res.part !== 'chest') z.hit(res.part, z.parts[res.part].hp + 1);
    // #12: more blood the heavier the weapon (the kit throws a little on every hit already)
    if (res && res.part && fx && G.gore !== 'off') {
      const p = res.point || point || (z.bones[res.part] ? z.bones[res.part].getWorldPosition(tmpV).clone() : null);
      if (p) { fx.spray(p, o.dir || [0, 0, 1], (SPRAY[w] || 0.6) * (L.armor.has(res.part) ? 0.4 : 1)); if (SPRAY[w] >= 1.8) fx.decal([p.x, ctx.world.floorY(L.floor), p.z], 0.2 + Math.random() * 0.15); }
    }
    return res;
  }
  // 1.4.0 #4: a riser - a body on the floor that is not dead. It gets up when the player passes close (3 m), or turns away from it
  // nearby (7 m, 1.2 s), or a noise reaches it, or it is hit. First a twitch and a wet breath (0.9 s) - a fair warning - then up.
  // 1.6.0 (play test 2 #6): a body under a sheet - an off-white sheet of dot cloth over the lying body (its outline: the head, the chest,
  // the feet), stained at the head. When the body stirs the sheet slides off it to the floor and stays there.
  // 1.6.1 (D-2 / D-4, "stepped white boxes, not people"): a body under a sheet - the head's bump, the shoulders wider than the chest, the
  // cloth sagging between the legs, the feet tenting it, the edges hanging down onto the floor - in cool greys (lit top, shaded folds),
  // and from one of them (Z_REI2) a hand and forearm out from under the edge
  const sheetMat = new THREE.MeshLambertMaterial({ color: 0x9eaab4 }); sheetMat.name = 'yk-sheet';
  const sheetDeep = new THREE.MeshLambertMaterial({ color: 0x46505a }); sheetDeep.name = 'yk-sheet-deep';
  const deadSkin = new THREE.MeshLambertMaterial({ color: 0x9aa08e }); deadSkin.name = 'yk-dead-skin';
  // 1.6.2 (re-check 2026-11-24, "the sheet's shape is still boxes up close"): the cloth is one draped surface of fine dot columns (2.5 cm),
  // not a few big boxes - a height field: the body under it (head, neck, shoulders, chest, belly, hips, the two legs, the feet standing up)
  // and the cloth falling from it to the floor at a cloth's slope, bridging the gap between the legs and tenting off the toes; the shade
  // goes darker where the cloth hangs and in the hollows, with a stain at the head. Built once and shared by every sheet.
  let sheetGeo = null;
  function sheetGeometry() {
    if (sheetGeo) return sheetGeo;
    const C = 0.025, NX = 88, NZ = 36, X0 = -1.1, Z0 = -0.45;   // x along the body (head +x, feet -x), z across
    const sm = (e0, e1, v) => { const t = Math.min(1, Math.max(0, (v - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
    const blob = (x, z, cx, cz, rx, rz, h) => { const d = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2; return d < 1 ? h * Math.sqrt(1 - d) : 0; };
    const body = (x, z) => Math.max(
      blob(x, z, 0.84, 0, 0.13, 0.11, 0.21),          // the head
      blob(x, z, 0.69, 0, 0.06, 0.06, 0.12),          // the neck
      blob(x, z, 0.5, 0, 0.13, 0.25, 0.2),            // the shoulders
      blob(x, z, 0.27, 0, 0.2, 0.21, 0.25),           // the chest
      blob(x, z, 0.04, 0, 0.14, 0.18, 0.16),          // the belly, lower
      blob(x, z, -0.2, 0, 0.16, 0.2, 0.18),           // the hips
      blob(x, z, -0.55, 0.1, 0.3, 0.08, 0.14), blob(x, z, -0.55, -0.1, 0.3, 0.08, 0.14),   // the thighs and shins
      blob(x, z, -0.93, 0.1, 0.05, 0.05, 0.24), blob(x, z, -0.93, -0.1, 0.05, 0.05, 0.24)); // the feet standing up
    const B = [], H = [];
    for (let i = 0; i < NX; i++) { B.push([]); for (let k = 0; k < NZ; k++) B[i].push(body(X0 + (i + 0.5) * C, Z0 + (k + 0.5) * C)); }
    const R = 7, SL = 0.85 * C;   // the cloth falls 0.85 per unit across (steep, as a sheet hangs) over up to 7 cells
    for (let i = 0; i < NX; i++) { H.push([]); for (let k = 0; k < NZ; k++) {
      let h = B[i][k];
      for (let di = -R; di <= R; di++) for (let dk = -R; dk <= R; dk++) { const ii = i + di, kk = k + dk; if (ii < 0 || kk < 0 || ii >= NX || kk >= NZ) continue; const v = B[ii][kk] - Math.hypot(di, dk) * SL; if (v > h) h = v; }
      const x = X0 + (i + 0.5) * C, z = Z0 + (k + 0.5) * C;
      const edge = Math.min(sm(-1.1, -1.04, x), 1 - sm(1.04, 1.1, x), sm(-0.45, -0.4, z), 1 - sm(0.4, 0.45, z));
      h = Math.max(0.008, h) * (0.35 + 0.65 * edge);
      H[i].push(Math.round(h / 0.0125) * 0.0125 || 0.006);
    } }
    const pos = [], nor = [], col = [];
    const base = new THREE.Color(0x9eaab4), fold = new THREE.Color(0x6a7682), stain = new THREE.Color(0x5e1814);
    const shade = (i, k) => { const x = X0 + (i + 0.5) * C, z = Z0 + (k + 0.5) * C, h = H[i][k], b = B[i][k];
      if (Math.hypot((x - 0.3) / 0.07, (z - 0.06) / 0.05) < 1 || Math.hypot((x - 0.22) / 0.04, (z - 0.11) / 0.035) < 1) return stain;
      const hang = h - b; const c = base.clone(); if (b < 0.02) c.lerp(fold, Math.min(0.6, 0.2 + (0.12 - h) * 3)); else if (hang > 0.03) c.lerp(fold, 0.4);   // the hanging cloth and the hem on the floor are a little darker, still a white sheet
      return c; };
    const quad = (a, b2, c, d, n, cl) => { for (const v of [a, b2, c, a, c, d]) { pos.push(...v); nor.push(...n); col.push(cl.r, cl.g, cl.b); } };
    for (let i = 0; i < NX; i++) for (let k = 0; k < NZ; k++) {
      const x0 = X0 + i * C, x1 = x0 + C, z0 = Z0 + k * C, z1 = z0 + C, h = H[i][k], cl = shade(i, k);
      quad([x0, h, z0], [x0, h, z1], [x1, h, z1], [x1, h, z0], [0, 1, 0], cl);
      const side = cl.clone().multiplyScalar(0.8);
      const nb = (ii, kk) => (ii < 0 || kk < 0 || ii >= NX || kk >= NZ ? 0 : H[ii][kk]);
      let n = nb(i + 1, k); if (n < h) quad([x1, h, z0], [x1, h, z1], [x1, n, z1], [x1, n, z0], [1, 0, 0], side);
      n = nb(i - 1, k); if (n < h) quad([x0, h, z1], [x0, h, z0], [x0, n, z0], [x0, n, z1], [-1, 0, 0], side);
      n = nb(i, k + 1); if (n < h) quad([x1, h, z1], [x0, h, z1], [x0, n, z1], [x1, n, z1], [0, 0, 1], side);
      n = nb(i, k - 1); if (n < h) quad([x0, h, z0], [x1, h, z0], [x1, n, z0], [x0, n, z0], [0, 0, -1], side);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    return (sheetGeo = geo);
  }
  const clothMat = new THREE.MeshLambertMaterial({ vertexColors: true }); clothMat.name = 'yk-sheet-cloth';
  function makeSheet(def = {}) {
    const g = new THREE.Group(); g.name = 'yk-sheet';
    const add = (w, h, d, x, y, z, m = sheetMat, rx = 0, rz = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
    add(2.0, 0.003, 0.8, 0, 0.0015, 0, sheetDeep);   // the hem's shadow on the floor (first: it stays when the cloth slides off)
    const cloth = new THREE.Mesh(sheetGeometry(), clothMat); cloth.name = 'yk-sheet-cloth'; cloth.castShadow = true; cloth.receiveShadow = true; g.add(cloth);
    if (def.id === 'Z_REI2') {
      // a hand out from under the edge: the forearm across the floor, the fingers curled
      add(0.3, 0.06, 0.08, 0.12, 0.03, 0.5, deadSkin, 0, 0).rotation.y = -0.35;
      add(0.1, 0.04, 0.1, -0.04, 0.02, 0.58, deadSkin);
      for (let f = 0; f < 4; f++) add(0.06, 0.02, 0.018, -0.11, 0.012, 0.545 + f * 0.024, deadSkin);
    }
    return g;
  }
  // laid over the body once its bones lie still: from the feet to the head
  function placeSheet(L) {
    const b = L.z.bones || {}, hd = b.head, fl = b.shinL || b.shinR; if (!hd || !fl) return false;
    { const a = L.z.root.matrixWorldAutoUpdate; L.z.root.matrixWorldAutoUpdate = true; L.z.root.updateMatrixWorld(true); L.z.root.matrixWorldAutoUpdate = a; }
    const h = hd.getWorldPosition(new THREE.Vector3()), f = fl.getWorldPosition(new THREE.Vector3()), y0 = ctx.world.floorY(L.floor);
    const S = L.sheet.g; S.position.set((h.x + f.x) / 2 + (h.x - f.x) * 0.08, y0, (h.z + f.z) / 2 + (h.z - f.z) * 0.08); S.rotation.y = Math.atan2(-(h.z - f.z), h.x - f.x);
    // the cloth covers the whole body: as high as the body lies (the voxel bodies lie 0.35-0.5 m thick) and a little wider
    S.scale.set(1.05, 1.15, 1.05);
    ctx.scene.add(S); L.sheet.placed = true; return true;
  }
  function slideSheet(L) { const S = L.sheet; if (!S || S.off) return; S.off = 0.001; S.g.children.forEach((c) => { if (c.material === deadSkin) c.visible = false; });   /* the hand belongs to the body, which shows now */ S.dir = S.g.rotation.y + Math.PI / 2; }
  function sheetTick(L, dt) {
    const S = L.sheet; if (!S) return;
    S.g.visible = L.z.root.visible || !!S.off;
    if (!S.placed) { S.t += dt; if (S.t > 0.25) placeSheet(L); return; }
    if (!S.off) L.z.root.visible = false;   // under the cloth only its shape shows (the voxel legs stood through it)
    if (S.off && S.off < 1) { S.off = Math.min(1, S.off + dt * 1.4); S.g.position.x += Math.cos(S.dir) * dt * 0.8; S.g.position.z -= Math.sin(S.dir) * dt * 0.8; S.g.children.forEach((c, i) => { if (i) c.scale.y = Math.max(0.15, 1 - S.off); }); S.g.rotation.z = 0; }
    // 1.7.0 (2026-11-27 #1 「起き上がった後にもシーツが残っている…立ち上がった後は消していい」): once it has slid off and the body stands, the
    // cloth on the floor goes - it settles flat for a moment, then sinks away (0.9 s) and is removed with its hem shadow
    else if (S.off >= 1) {
      S.gone = (S.gone || 0) + dt;
      if (S.gone > 0.7) { const k = Math.max(0, 1 - (S.gone - 0.7) / 0.9); S.g.scale.y = 1.15 * k; S.g.visible = k > 0.02; }
      if (S.gone > 1.6) { S.g.removeFromParent(); L.sheet = null; }
    }
  }
  function riseNow(L, now = false) {
    if (L.rising || !L.z.lying || !L.z.lying()) return;
    L.rising = now ? 0.01 : 0.9; L.twitch = 0;
    if (L.sheet) slideSheet(L);
    G.sfx3d(`z-groan-${1 + Math.floor(L.r() * 6)}`, L.z.root.position);
    G.emit('zombie:twitch', { id: L.def.id });
  }
  G.riseNow = (id) => { const L = live.get(id); if (L) riseNow(L, true); };
  G.wakeSlow = (id) => { const L = live.get(id); if (L) riseNow(L); };   // the twitch and the wet breath first (0.9 s), then up
  const look = new THREE.Vector3();
  function riserTick(L, d, dt) {
    const z = L.z;
    if (L.rising != null) {
      L.rising -= dt; L.twitch += dt;
      z.body.rotation.z = Math.sin(L.twitch * 40) * 0.04;   // the twitch
      if (L.rising <= 0) { L.rising = null; z.body.rotation.z = 0; z.rise(); L.alert = 30; G.emit('zombie:rise', { id: L.def.id }); }
      return;
    }
    if (L.def.sleepUntil && !ctx.state.tasks.includes(L.def.sleepUntil)) return;   // 1.6.0: lies still until its moment (a hit still wakes it)
    const cam = ctx.camera; cam.getWorldDirection(look);
    const to = new THREE.Vector3(z.pos[0] - cam.position.x, 0, z.pos[2] - cam.position.z), away = to.length() > 0.01 && look.setY(0).normalize().angleTo(to.normalize()) > 1.75;
    L.awayT = away && d < 7 ? (L.awayT || 0) + dt : 0;
    if (d < 3 || L.awayT > 1.2 || (L.alert > 9 && d < 12)) riseNow(L);
  }
  // 1.4.0 #2: a brute's heavy steps (a thud and a small shake when close) and its charge (a roar, a stop, then a rush in a line)
  function bruteTick(L, d, dt, same) {
    const z = L.z;
    L.step -= dt;
    if (L.step <= 0 && !z.dead && L.alert > 0) { L.step = 0.85; G.sfx3d('fall', z.root.position); if (d < 9 && G.shake) G.shake(0.12 * (1 - d / 9), 0.15); }
    L.chargeCool -= dt;
    if (!L.charge && same && L.chargeCool <= 0 && d > 3.2 && d < 10 && L.alive) { L.charge = -0.8; G.sfx3d('z-scream', z.root.position); G.emit('brute:charge', { id: L.def.id }); }
    if (L.charge < 0) { L.charge += dt; z.update(0, null); if (L.charge >= 0) L.charge = 1.4; return true; }   // the stop before the rush
    if (L.charge > 0) {
      L.charge -= dt;
      const p = ctx.camera.position, yaw = Math.atan2(p.x - z.pos[0], p.z - z.pos[2]);
      z.yaw = yaw; z.pos[0] += Math.sin(yaw) * 3.4 * dt; z.pos[2] += Math.cos(yaw) * 3.4 * dt;
      if (d < 1.3) { L.charge = 0; G.hurt(Math.round(z.stats.damage * 0.8), { grab: 1.2, reason: 'bitten', by: L }); }
      if (L.charge <= 0) { L.charge = 0; L.chargeCool = 6 + L.r() * 3; }
    }
    return false;
  }

  // ---------------------------------------------------------------- every frame
  let syncT = 0;
  const tgt = { position: new THREE.Vector3(), camera: null };
  ext.registerSystem('yk-zombies', {
    update(dt) {
      if (!ctx || !ctx.state.started) return;
      if (fx) fx.update(dt);
      syncT -= dt; if (syncT <= 0) { syncT = 0.5; G.syncZombies(); }
      const cam = ctx.camera, p = cam.position, fl = ctx.floor || 0;
      const busy = (ctx.blocked && ctx.blocked()) || ctx.state.ended || G.dead;
      const proom = roomAtP(p.x, p.z, fl);
      // nearest first: the MAX nearest on this floor move and show; the rest wait unseen
      const list = [...live.values()].filter((L) => L.floor === fl).map((L) => ({ L, d: Math.hypot(L.z.pos[0] - p.x, L.z.pos[2] - p.z) })).sort((a, b) => a.d - b.d);
      for (const L of live.values()) if (L.floor !== fl) { L.z.root.visible = false; L.z.root.matrixWorldAutoUpdate = false; }
      let shown = 0, bodies = 0;
      for (const { L, d } of list) {
        // the bodies on the floor have their own count (they do not push the living out of sight)
        const lying = !L.alive || (L.z.lying && L.z.lying() && L.rising == null);
        const on = d < RADIUS && (lying ? bodies < (touch() ? 8 : 12) : shown < MAX());
        const was = L.z.root.matrixWorldAutoUpdate;
        L.z.root.visible = on; L.z.root.matrixWorldAutoUpdate = on;
        if (on && !was) L.z.root.updateMatrixWorld(true);   // coming into sight: its matrices are current before any pick (three skips an object whose matrixWorldAutoUpdate is off, even when forced)   // 1.6.0 (play test 2 #4 「表示されないものは利用しない」): an unseen body's bones are not updated
        if (L.sheet) sheetTick(L, dt); if (!on) continue; if (lying) bodies++; else shown++;
        const z = L.z;
        if (busy) { z.update(0, null); continue; }   // a talk or a mini game: everything holds still
        if (!L.alive) { z.update(dt, null); continue; }
        if (L.def.riser && (L.rising != null || (z.lying && z.lying()))) { riserTick(L, d, dt); z.update(dt, null); continue; }
        if (L.def.chained && !G.flags['cult:loose']) { z.update(dt, null); z.pos[0] = L.home[0]; z.pos[2] = L.home[1]; continue; }   // on its chain
        // what it walks to: the player in the same room (or seen through an open door close by), the place of a noise, or its own room
        const same = proom && L.room === proom.id;
        const near = !same && proom && d < 9 && doorsBetween(L.room, proom.id).some(doorOpen);
        L.alert = Math.max(0, L.alert - dt);
        let goal = null, chasing = false;
        if (same || near || (L.alert > 0 && d < 14)) { chasing = true; L.alert = Math.max(L.alert, same ? 6 : 3); }
        if (chasing && proom) {
          if (L.room === proom.id) goal = [p.x, p.z];
          else { const dd = nextDoor(L.room, proom.id); goal = dd ? pastDoor(dd, L.room) : null; }
        } else if (L.heard && L.alert > 0) {
          const hr = roomAtP(L.heard[0], L.heard[1], fl);
          if (hr && hr.id === L.room) goal = L.heard; else if (hr) { const dd = nextDoor(L.room, hr.id); goal = dd ? pastDoor(dd, L.room) : null; }
        } else {
          // idle: now and then a few steps in its own room
          L.wander -= dt;
          if (L.wander <= 0) { L.wander = 4 + L.r() * 6; const R = roomById.get(L.room); L.wp = R && L.r() < 0.6 ? [R.x + 0.8 + L.r() * (R.w - 1.6), R.z + 0.8 + L.r() * (R.d - 1.6)] : null; }
          goal = L.wp;
        }
        // 1.4.0 (play test #15 「部屋を開けっ放しを許している」): the player behind a shut door - it goes to the door and bangs on it
        // (an open door it walks through: shut the door of a room to be safe in it)
        if (!goal && !same && !near && proom && d < 7 && (L.alert > 0 || d < 4.5)) {
          const sd = doorsBetween(L.room, proom.id).find((dd) => !doorOpen(dd)), R = roomById.get(L.room);
          if (sd && R) {
            const onX = Math.abs(sd.x - R.x) < 0.05 || Math.abs(sd.x - (R.x + R.w)) < 0.05;
            goal = onX ? [sd.x + (R.x + R.w / 2 > sd.x ? 0.55 : -0.55), sd.z] : [sd.x, sd.z + (R.z + R.d / 2 > sd.z ? 0.55 : -0.55)];
            L.bangT = (L.bangT || 0) - dt;
            if (Math.hypot(goal[0] - z.pos[0], goal[1] - z.pos[2]) < 0.8 && L.bangT <= 0) {
              L.bangT = 1.2 + L.r() * 0.8; G.sfx3d('bang', new THREE.Vector3(sd.x, p.y, sd.z)); G.emit('door:bang', { id: sd.id, z: L.def.id });
              if (!G.flags['hint:bang']) { G.flags['hint:bang'] = true; ctx.ui.say('閉めた戸を、向こうから叩いている。開けたままなら、入ってきていた。', 5); }
            }
          }
        }
        const ox = z.pos[0], oz = z.pos[2];
        if (L.def.brute && bruteTick(L, d, dt, same)) { settle(L, ox, oz); z.root.position.set(z.pos[0], z.root.position.y, z.pos[2]); continue; }
        if (L.charge > 0) { z.update(dt, { camera: cam }); settle(L, ox, oz); z.root.position.set(z.pos[0], z.root.position.y, z.pos[2]); continue; }
        if (goal) { tgt.position.set(goal[0], p.y, goal[1]); tgt.camera = cam; z.update(dt, tgt); if (L.wp && !chasing && Math.hypot(goal[0] - z.pos[0], goal[1] - z.pos[2]) < 0.6) L.wp = null; }
        else { tgt.camera = cam; z.update(dt, { camera: cam }); }
        settle(L, ox, oz);
        z.root.position.set(z.pos[0], z.root.position.y, z.pos[2]);
        // groan now and then while it hunts
        if (chasing && L.alive) { L.groan -= dt; if (L.groan <= 0) { L.groan = 3 + L.r() * 5; G.sfx3d(`z-groan-${1 + Math.floor(L.r() * 6)}`, z.root.position); } }
        // the body stands in the way: push the player out (not through walls: the kit's controller keeps the walls)
        if (L.alive && !z.dead && d < 0.55 && d > 0.01) { const k = (0.55 - d) / d; p.x += (p.x - z.pos[0]) * k * 0.5; p.z += (p.z - z.pos[2]) * k * 0.5; }
      }
      // bodies apart from each other
      for (let i = 0; i < list.length && i < MAX(); i++) for (let j = i + 1; j < list.length && j < MAX(); j++) {
        const a = list[i].L.z, b = list[j].L.z; if (a.dead || b.dead) continue;
        const dx = a.pos[0] - b.pos[0], dz = a.pos[2] - b.pos[2], dd = Math.hypot(dx, dz);
        if (dd > 0.01 && dd < 0.6) { const k = (0.6 - dd) / dd * 0.5; a.pos[0] += dx * k; a.pos[2] += dz * k; b.pos[0] -= dx * k; b.pos[2] -= dz * k; }
      }
      G.zStats = { live: live.size, shown };
    },
  });

  ext.registerPersist('yk-zombies', {
    serialize: () => ({ killed: [...G.killed], at: G.killedAt }),
    restore: (s) => { G.killed = new Set((s && s.killed) || []); G.killedAt = (s && s.at) || {}; if (ctx && pats.size) G.resetZombies([...G.killed], G.killedAt); },
  });
}
