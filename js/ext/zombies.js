// The zombies: the kit's dot zombies (js/kit/dot-zombie.js, 50 patterns, parts that come off) placed room by room (js/ext/spawns.js),
// woken by sight and by noise, walking only through open doors, kept off the furniture, at most MAX on screen (phones fewer, LOD 9 m).
// Every one is a little different: height, stoop, the colour of the skin and the clothes, how far it has rotted.
// Their sounds (groans, screams, bursting) are the game's own files (assets/sfx/z-*.mp3, made through the local media queue).
import * as THREE from 'three';
import { loadZombiePattern, createZombie, createGoreFx } from '../kit/dot-zombie.js';
import { SPAWNS, PATTERNS } from './spawns.js';

const ZDIR = new URL('../../assets/zombies/', import.meta.url).href;

export function installZombies(ext, G) {
  const pats = new Map();
  const live = new Map();    // spawn id -> { def, z, room, floor, alert, wp, lastGroan, home }
  G.killed = new Set();
  let ctx = null, fx = null, rooms = [], roomById = new Map(), doorList = [];
  const touch = () => (ctx && ctx.isTouch) || matchMedia('(pointer: coarse)').matches;
  const MAX = () => (touch() ? 12 : 15);
  const RADIUS = 26;

  ext.registerBoot('yk-zombies', async (c, report) => {
    let k = 0;
    await Promise.all(PATTERNS.map(async (id) => {
      try { pats.set(id, await loadZombiePattern(THREE, `${ZDIR}${id}.json`)); } catch (e) { console.warn('[yakinake] zombie pattern', id, e); }
      report(++k / PATTERNS.length, `ゾンビを準備中… ${Math.round((k / PATTERNS.length) * 100)}%`);
    }));
  });

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
  function spawn(def) {
    const pat = pats.get(def.p); if (!pat) return null;
    const R = roomById.get(def.room); if (!R) return null;
    const floor = R.floor, y = ctx.world.floorY(floor);
    const z = createZombie(pat, { position: [def.x, y, def.z], yaw: def.yaw ?? Math.PI, gore: G.gore, state: def.state || 'idle', missing: def.missing || [], lodDistance: touch() ? 7 : 9, sight: def.sight || 13 });
    // the person it was: height, stoop, the colour of the clothes and the skin, how far it has rotted
    const r = rnd(hash(def.id));
    const tall = def.p === 'crawler' || def.p === 'giant' ? 1 : 0.9 + r() * 0.18;
    z.root.scale.setScalar(tall);
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
    const L = { def, z, room: def.room, floor, alert: 0, wp: null, groan: 2 + r() * 6, wander: r() * 4, home: [def.x, def.z], alive: true, r };
    z.on('attack', (e) => {
      const p = ctx.camera.position;
      if (Math.hypot(p.x - z.pos[0], p.z - z.pos[2]) > 1.55 || ctx.floor !== L.floor) return;
      G.hurt(e.damage, { grab: e.grab, reason: 'bitten', by: L });
    });
    z.on('spit', (e) => { const p = ctx.camera.position; if (Math.hypot(p.x - z.pos[0], p.z - z.pos[2]) < 9 && ctx.floor === L.floor) setTimeout(() => G.hurt(e.damage * 0.6, { reason: 'spit' }), 450); });
    z.on('explode', () => { const p = ctx.camera.position; G.sfx3d('z-burst', z.root.position); if (Math.hypot(p.x - z.pos[0], p.z - z.pos[2]) < 2.6) G.hurt(40, { reason: 'burst' }); });
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
    z.on('sever', (e) => { G.emit('zombie:sever', { id: def.id, parts: e.parts }); });
    z.on('died', () => { L.alive = false; G.killed.add(def.id); G.emit('zombie:died', { id: def.id, p: def.p }); });
    live.set(def.id, L);
    return L;
  }
  const despawn = (id) => { const L = live.get(id); if (!L) return; L.z.dispose(); live.delete(id); };

  // which spawns are in the world now: their condition (a stage reached, a task done, a flag) holds and they are not dead
  const wanted = (def) => {
    if (G.killed.has(def.id)) return false;
    const st = ctx.state;
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
  /** back to how the zombies were at the checkpoint: the dead stay dead, the rest stand where they started */
  G.resetZombies = (killed) => {
    G.killed = new Set(killed || []);
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
        raycast: (r) => z.raycast(r), hit: (r, dmg, o) => { const res = z.hit(r, dmg, { ...o, corpse: false }); L.alert = 30; if (o && o.sever && res && res.part && !res.severed && !z.dead && z.parts[res.part] && z.parts[res.part].hp > 0 && res.part !== 'chest') { z.hit(res.part, z.parts[res.part].hp + 1); } return res; },
        aimPoints: () => { const b = z.bones; const pts = []; for (const k of ['head', 'chest']) { if (b[k] && !z.missing.has(k)) { b[k].getWorldPosition(aim); pts.push(aim.clone().setY(aim.y + (k === 'head' ? 0.08 : 0.15))); } } if (!pts.length) pts.push(z.root.position.clone().setY(z.root.position.y + 0.3)); return pts; } });
    }
    return out;
  };

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
      for (const L of live.values()) if (L.floor !== fl) L.z.root.visible = false;
      let shown = 0;
      for (const { L, d } of list) {
        const on = d < RADIUS && shown < MAX();
        L.z.root.visible = on; if (!on) continue; shown++;
        const z = L.z;
        if (busy) { z.update(0, null); continue; }   // a talk or a mini game: everything holds still
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
        const ox = z.pos[0], oz = z.pos[2];
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
    serialize: () => ({ killed: [...G.killed] }),
    restore: (s) => { G.killed = new Set((s && s.killed) || []); if (ctx && pats.size) G.resetZombies([...G.killed]); },
  });
}
