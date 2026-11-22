// The people: dot figures on the kit's shared motion rig (assets/figures/<id>.json, tools/dot/figures.json, res 2), standing at their
// talk points, turning to the player, and the few who fight (権藤 and 仁科 when the mart is fought): they walk at the player, swing,
// duck behind the shelves and the counter when they are hit or have swung twice, come out again, and give up when they are hurt enough (降参). Nobody is ever shot by the people on the player's side (no friendly fire).
import * as THREE from 'three';
import { loadFrameSet, createFigure } from '../kit/sprite-stack-mesh.js';
import { turnToward } from '../kit/sprite-stack-anim.js';

const FIG = new URL('../../assets/figures/', import.meta.url).href;
// who, the frame set, where they stand (a station of the plan or a point), their height, and whether they are a woman (for the check)
export const PEOPLE = [
  { id: 'chisato', name: '宮下', station: 'S_CHISATO', h: 1.6, woman: true },
  { id: 'genzo', name: '戸川', station: 'S_GENZO', h: 1.62 },
  { id: 'gondo', name: '権藤', station: 'S_GONDO', h: 1.74, hp: 120 },
  { id: 'nishina', name: '仁科', station: 'S_NISHINA', h: 1.72, hp: 80 },
  { id: 'shirasaka', name: '白坂', station: 'S_SHIRA', h: 1.66 },
  { id: 'taeko', name: '妙子', station: 'S_TAEKO', h: 1.58, woman: true },
  { id: 'katagiri', name: '片桐', station: 'S_KATA', h: 1.66, woman: true, gun: 'pistol' },
  { id: 'mori', name: '森', at: ['P_KYU', 97.4, 2.6], h: 1.76, gun: 'pistol' },
  { id: 'noguchi', name: '野口', station: 'S_NOGUCHI', h: 1.66 },
  { id: 'hayase', name: '早瀬', at: ['O_CHU', 148, 3.6], h: 1.74 },
  // 1.4.1: the man in the cult's cellar, behind iron bars (he talks through them; the bars keep him out of every fight)
  { id: 'miyake', name: '三宅', station: 'S_MIYAKE', pos: [68.4, 35.9], h: 1.7, caged: true },
];

export function installPeople(ext, G) {
  const sets = new Map(), figs = new Map();
  let ctx = null;
  // 1.3.0 (play test #10 「重すぎて開かない」): the figures are loaded block by block (js/ext/blocks.js). One at a time, and the decoded
  // picture (11424 x 1974 px, 90 MB of pixels each) is let go as soon as the frames are built: ten of them held 1.5 GB behind the title.
  const figMat = (self, name) => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true }); m.name = name;
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
 totalEmissiveRadiance += diffuseColor.rgb * ${self.toFixed(3)};`); };
    m.customProgramCacheKey = () => `yk-fig-${self}`;
    return m;
  };
  ext.on('game:ready', (c) => { ctx = c; });
  let mat = null;
  const warmOf = new Map();
  function placeOne(P, set) {
    const plan = ctx.data.plan, W = ctx.world;
    mat = mat || figMat(0.22, 'yk-person');
    const st = P.station ? plan.stations.find((s) => s.id === P.station) : null;
    const [room, x, z] = st ? [st.room, st.x, st.z] : P.at;
    const R = plan.rooms.find((r) => r.id === room), y = W.floorY((R && R.floor) || 0);
    const f = createFigure(THREE, set, { height: P.h, material: mat, name: P.id });
    // stand a little behind the talk point, facing into the room
    const cx = R.x + R.w / 2, cz = R.z + R.d / 2;
    // a person with a place of their own (behind bars) stands there and faces the talk point
    const yaw = P.pos ? Math.atan2(x - P.pos[0], z - P.pos[1]) : Math.atan2(cx - x, cz - z);
    if (P.pos) f.root.position.set(P.pos[0], y, P.pos[1]); else f.root.position.set(x - Math.sin(yaw) * 0.15, y, z - Math.cos(yaw) * 0.15);
    f.root.rotation.y = yaw;
    f.root.name = `person:${P.id}`;
    ctx.scene.add(f.root);
    f.anim.play('idle');
    // the station's own stand-in look (a grey block where a person talks) is the person now
    const sid = P.station || (P.id === 'hayase' ? 'S_HAYASE' : null);
    if (sid) { const look = W.group.getObjectByName(`stlook:${sid}`); if (look) look.traverse((m) => { if (m.isMesh) m.visible = false; }); }
    if (f.warm) { f.warm.visible = false; ctx.scene.add(f.warm); warmOf.set(P.id, f.warm); }
    figs.set(P.id, { P, f, set, room, floor: (R && R.floor) || 0, yaw, home: f.root.position.clone(), hp: P.hp || 100, max: P.hp || 100, mode: 'stand', cool: 0, hidden: false });
    applySaved(figs.get(P.id));
  }
  // 1.4.0 #13: who is dead or has given up is kept with the save (and the log save a death goes back to)
  let saved = {};
  function applySaved(p) {
    const s = saved[p.P.id]; if (!s) return;
    p.hp = s.hp ?? p.hp; p.ok = !!s.ok; p.okDown = !!s.okDown;
    if (s.mode === 'dead') lieDown(p, true);
    else if (s.mode === 'down') { p.mode = 'down'; p.f.anim.play('fear'); }
    else if (s.mode === 'fight' || s.mode === 'shoot') { p.mode = s.mode; }
    if (s.at) p.f.root.position.set(s.at[0], p.f.root.position.y, s.at[1]);
  }
  ext.registerPersist('yk-people', {
    serialize: () => { const o = { ...saved }; for (const [id, p] of figs) o[id] = { mode: ['dead', 'down', 'fight', 'shoot'].includes(p.mode) ? p.mode : 'stand', hp: p.hp, ok: !!p.ok, okDown: !!p.okDown, ...(p.mode === 'dead' || p.mode === 'down' ? { at: [+p.f.root.position.x.toFixed(2), +p.f.root.position.z.toFixed(2)] } : {}) }; return o; },
    restore: (s) => {
      saved = s || {};
      for (const p of figs.values()) {
        // back to the save: stand up again unless the save says otherwise
        if (!saved[p.P.id] || saved[p.P.id].mode === 'stand') { if (p.mode === 'dead') { p.f.root.rotation.x = 0; p.f.root.rotation.z = 0; p.f.root.position.copy(p.home); } p.mode = 'stand'; p.hp = p.max; p.ok = false; p.okDown = false; p.cover = null; }
        applySaved(p);
      }
    },
  });
  function lieDown(p, quiet) {
    p.mode = 'dead'; p.cover = null; p.goal = null;
    const o = p.f.root.position; o.y = ctx.world.floorY(p.floor) + 0.16;
    p.f.root.rotation.x = -Math.PI / 2; p.f.anim.play('idle');
    if (!quiet && G.zfx && G.zfx.pool) G.zfx.pool([o.x, ctx.world.floorY(p.floor) + 0.01, o.z], 1.1, 9);
  }
  G.loadPeople = async (ids, report = () => {}) => {
    const want = PEOPLE.filter((P) => ids.includes(P.id) && !figs.has(P.id));
    let k = 0;
    for (const P of want) {
      try {
        const set = await loadFrameSet(THREE, `${FIG}${P.id}.json`);
        placeOne(P, set);
        set.px = null;   // the frames are built: the 90 MB picture goes
      } catch (e) { console.warn('[yakinake] figure', P.id, e); }
      report(++k / Math.max(1, want.length), `人を準備中… ${Math.round((k / Math.max(1, want.length)) * 100)}%`);
      await new Promise((r) => setTimeout(r, 0));
    }
    G.people = figs;
    return want.length;
  };
  G.unloadPeople = (keep) => {
    const K = new Set(keep || []);
    for (const [id, p] of [...figs]) {
      if (K.has(id)) continue;
      p.f.root.removeFromParent();
      const w = warmOf.get(id); if (w) { w.removeFromParent(); warmOf.delete(id); }
      if (p.set && p.set.geo) { for (const g of p.set.geo.values()) g.dispose(); p.set.geo.clear(); }
      figs.delete(id);
    }
  };
  G.peopleWarm = () => [...warmOf.values()];
  G.loadedPeople = () => [...figs.keys()];
  G.people = figs;
  G.person = (id) => figs.get(id) || null;
  /** a person is somewhere else now (the roof at the end): a room, a point, a yaw; standing */
  G.placePerson = (id, room, x, z, yaw) => {
    const p = figs.get(id); if (!p || !ctx) return;
    const R = ctx.data.plan.rooms.find((r) => r.id === room), fl = (R && R.floor) || 0;
    p.room = room; p.floor = fl; p.mode = 'stand'; p.faceAway = true; p.cover = null; p.goal = null; p.hidden = false;
    p.f.root.position.set(x, ctx.world.floorY(fl), z); p.f.root.rotation.y = yaw; p.f.root.visible = true;
  };
  /** a person on the player's side swings or shoots once (the motion only) */
  G.personAct = (id) => { const p = figs.get(id); if (p) { p.act = 0.6; } };
  G.showPerson = (id, on) => { const p = figs.get(id); if (p) { p.hidden = !on; p.f.root.visible = on; } };
  /** a person walks to (x, z) (no path: a straight line inside the room), then stands */
  G.walkPerson = (id, x, z) => { const p = figs.get(id); if (p) { p.goal = [x, z]; p.mode = 'walk'; } };
  /** the fight: mode 'fight' walks at the player and swings; at a third of the life they give up (mode 'down') */
  G.fight = (ids) => { for (const id of ids) { const p = figs.get(id); if (p) { p.mode = 'fight'; p.hp = p.max; p.cover = null; p.swings = 0; } } };
  G.calm = (ids) => { for (const id of ids) { const p = figs.get(id); if (p && p.mode !== 'down') p.mode = 'stand'; } };

  const box = new THREE.Box3(), hitP = new THREE.Vector3();
  // crouched behind cover a fighter is a smaller target (the head just over the shelf)
  const hh = (p) => (p.cover && p.cover.down ? p.P.h * 0.58 : p.P.h);
  // a cover point: the far side of a piece of furniture in the fighter's room, seen from the player, inside the room
  // is (x, z) inside a piece of furniture or a wall (the world's colliders: the plan's pieces and the kit's own filler shelves), with
  // a body's width round it, at the person's waist height
  function inFurniture(p, x, z) {
    const y = p.f.root.position.y + 0.6, cs = (ctx.world && ctx.world.colliders) || [];
    for (const c of cs) { if (c.off) continue; const b = c.box; if (y < b.min.y || y > b.max.y) continue; if (x > b.min.x - 0.25 && x < b.max.x + 0.25 && z > b.min.z - 0.25 && z < b.max.z + 0.25) return true; }
    return false;
  }
  // a step that never walks into a shelf (one already inside, from an old save, may walk out); slides along it when it can
  function stepFree(p, o, sx, sz) {
    const inNow = inFurniture(p, o.x, o.z);
    for (const [ax, az] of [[sx, sz], [sx, 0], [0, sz]]) {
      if (!ax && !az) continue;
      if (inNow || !inFurniture(p, o.x + ax, o.z + az)) { o.x += ax; o.z += az; return true; }
    }
    return false;
  }
  function coverPoint(p, cam) {
    const plan = ctx.data.plan, R = plan.rooms.find((r) => r.id === p.room); if (!R) return null;
    const o = p.f.root.position; let best = null, bd = 1e9;
    for (const F of plan.furniture || []) {
      if (F.room !== p.room) continue;
      const turned = Math.abs(Math.abs(((F.rot || 0) % 180)) - 90) < 1, hx = (turned ? F.d : F.w) / 2, hz = (turned ? F.w : F.d) / 2;
      let ux = F.x - cam.x, uz = F.z - cam.z; const L = Math.hypot(ux, uz) || 1; ux /= L; uz /= L;
      const ext = Math.abs(ux) * hx + Math.abs(uz) * hz + 0.55;
      const x = Math.min(R.x + R.w - 0.4, Math.max(R.x + 0.4, F.x + ux * ext)), z = Math.min(R.z + R.d - 0.4, Math.max(R.z + 0.4, F.z + uz * ext));
      if (Math.hypot(x - cam.x, z - cam.z) < 2.2) continue;
      if (inFurniture(p, x, z)) continue;   // a piece against the wall has no far side: never into the shelf itself
      const dd = Math.hypot(x - o.x, z - o.z); if (dd < bd && dd < 7) { bd = dd; best = [x, z]; }
    }
    return best;
  }
  const hostileMode = (p) => p.mode === 'fight' || p.mode === 'shoot';
  /** what stands between the player and hitting this person: null (hostile, or already confirmed), 'ask' (not hostile), 'ask-down' (given up) */
  const guardOf = (p) => (p.mode === 'down' ? (p.okDown ? null : 'ask-down') : hostileMode(p) || p.ok ? null : 'ask');
  G.personGuard = (id) => { const p = figs.get(id); return p ? guardOf(p) : null; };
  G.personOk = (id, down) => { const p = figs.get(id); if (!p) return; if (down) p.okDown = true; else p.ok = true; };
  G.peopleTargets = () => {
    const out = [];
    for (const p of figs.values()) {
      if (p.mode === 'dead' || p.hidden || !p.f.root.visible || p.P.caged) continue;
      const o = p.f.root.position, low = p.mode === 'down' || (p.cover && p.cover.down);
      const ray = (r) => { const h = low ? p.P.h * 0.58 : hh(p); box.min.set(o.x - 0.28, o.y, o.z - 0.28); box.max.set(o.x + 0.28, o.y + h, o.z + 0.28); const q = r.intersectBox(box, hitP); return q ? { part: q.y > o.y + h - 0.28 ? 'head' : 'chest', dist: q.distanceTo(r.origin), point: q.clone() } : null; };
      out.push({ kind: 'person', id: p.P.id, name: p.P.name, alive: true, pos: o, guard: guardOf(p),
        raycast: ray,
        // never hit without the player's say-so: a pellet that strays into someone who is not hostile does nothing
        hit: (r, dmg, o2 = {}) => { if (guardOf(p)) return null; const part = typeof r === 'string' ? r : (ray(r) || {}).part || 'chest'; hurt(p, dmg * (part === 'head' ? 1.6 : 1), o2); return { part }; },
        // the aim assist only helps against the hostile
        aimPoints: () => (hostileMode(p) ? [o.clone().setY(o.y + hh(p) * 0.72)] : []) });
    }
    return out;
  };
  function hurt(p, dmg, o) {
    const before = p.mode;
    p.hp -= dmg; p.flinch = 0.35; if (!p.cover && before !== 'down') p.wantCover = true; G.sfx3d('hit-person', p.f.root.position);
    // the blood of a person: a spurt and a splat on the floor (the blood setting decides; off shows none)
    if (G.zfx && G.gore !== 'off') { const q = p.f.root.position; try { G.zfx.spray && G.zfx.spray([q.x, q.y + p.P.h * 0.7, q.z], o.dir || [0, 0, 1], 0.6); G.zfx.decal([q.x + (Math.random() - 0.5) * 0.6, q.y + 0.01, q.z + (Math.random() - 0.5) * 0.6], 0.3); } catch (e) { /* no fx */ } }
    if (before === 'down') { if (p.hp <= 0) { lieDown(p); G.emit('person:killed', { id: p.P.id }); } return; }
    // the knock-back never pushes a person into a shelf or a wall (a shot could no longer reach them there)
    const d = new THREE.Vector3(o.dir ? o.dir[0] : 0, 0, o.dir ? o.dir[2] : 0), kb = 0.25 * (o.force || 0.5);
    if (d.lengthSq() > 1e-6) { d.normalize(); const q = p.f.root.position; losRay.set(new THREE.Vector3(q.x, q.y + 0.6, q.z), d); losRay.far = kb + 0.4; if (!(G.solidMeshes && losRay.intersectObjects(G.solidMeshes(), false).length)) q.addScaledVector(d, kb); }
    G.emit('person:hit', { id: p.P.id, before });
    if (p.hp <= 0) { lieDown(p); G.emit('person:killed', { id: p.P.id }); return; }
    if (p.hp <= p.max / 3) { p.mode = 'down'; p.cover = null; p.f.anim.play('fear'); G.emit('person:down', { id: p.P.id }); ctx.ui.toast(`${p.P.name}「やめて……もう、やめて」`); }
  }
  /** 1.4.0 #13: the ones with guns fight from cover: down behind a shelf, up to shoot, down again */
  G.shootAt = (ids) => { for (const id of ids) { const p = figs.get(id); if (p && p.mode !== 'dead' && p.mode !== 'down') { p.mode = 'shoot'; p.cover = null; p.cool = 1.2; p.shots = 0; p.wantCover = true; } } };
  /** the ones who cannot fight run from the player, then crouch and plead */
  G.flee = (id) => { const p = figs.get(id); if (p && p.mode !== 'dead' && p.mode !== 'down') { p.mode = 'flee'; p.fleeT = 0; } };
  const losRay = new THREE.Raycaster();
  const canSee = (o, cam) => { const from = new THREE.Vector3(o.x, o.y + 1.45, o.z), to = cam.clone().sub(from), L = to.length(); losRay.set(from, to.normalize()); losRay.far = L - 0.3; return !(G.solidMeshes && losRay.intersectObjects(G.solidMeshes(), false).length); };

  ext.registerSystem('yk-people', {
    update(dt) {
      if (!ctx || !ctx.state.started) return;
      const cam = ctx.camera.position, busy = ctx.blocked && ctx.blocked();
      for (const p of figs.values()) {
        if (p.hidden) continue;
        const o = p.f.root.position, onFloor = (ctx.floor || 0) === p.floor;
        const d = Math.hypot(cam.x - o.x, cam.z - o.z);
        if (!onFloor || d > 30) { p.f.root.visible = false; continue; }
        p.f.root.visible = true;
        const toP = Math.atan2(cam.x - o.x, cam.z - o.z);
        let moved = 0, motion = 'idle';
        if (p.mode === 'stand' && p.act > 0) { p.act -= dt; motion = 'attack'; }
        else if (p.mode === 'stand') { if (d < 4.5 && !p.faceAway) p.f.root.rotation.y = turnToward(p.f.root.rotation.y, toP, dt, 3); }
        else if (p.mode === 'walk' && p.goal) {
          const dx = p.goal[0] - o.x, dz = p.goal[1] - o.z, dd = Math.hypot(dx, dz);
          if (dd < 0.1) { p.mode = 'stand'; p.goal = null; }
          else { const s = Math.min(dd, 1.2 * dt); o.x += dx / dd * s; o.z += dz / dd * s; moved = s; motion = 'walk'; p.f.root.rotation.y = turnToward(p.f.root.rotation.y, Math.atan2(dx, dz), dt, 6); }
        } else if (p.mode === 'fight' && !busy) {
          p.cool -= dt; p.flinch = Math.max(0, (p.flinch || 0) - dt);
          // hit, or two swings done: run to the far side of the nearest shelf or counter, crouch there a while, then come out again
          if (p.wantCover && !p.cover && !p.flinch) { p.wantCover = false; const c = coverPoint(p, cam); if (c) p.cover = { at: c, t: 0, down: false }; }
          if (p.cover) {
            const C = p.cover, dx = C.at[0] - o.x, dz = C.at[1] - o.z, dd = Math.hypot(dx, dz);
            if (!C.down && dd > 0.15) {
              const s = Math.min(dd, 2.4 * dt); if (stepFree(p, o, dx / dd * s, dz / dd * s)) { moved = s; motion = 'walk'; }
              p.f.root.rotation.y = turnToward(p.f.root.rotation.y, Math.atan2(dx, dz), dt, 8);
              C.t += dt; if (C.t > 3.5) C.down = true;
            } else {
              if (!C.down) { C.down = true; C.t = 0; C.hold = 1.6 + Math.random() * 1.2; }
              C.t += dt; motion = 'crouch';   // down behind the shelf (not the hands-up 'fear' of giving up)
              p.f.root.rotation.y = turnToward(p.f.root.rotation.y, toP, dt, 4);
              // out again when the time is up, or at once when the player comes round the shelf
              if (C.t > C.hold || d < 1.6) { p.cover = null; p.swings = 0; p.cool = Math.min(p.cool, 0.3); }
            }
          } else {
            p.f.root.rotation.y = turnToward(p.f.root.rotation.y, toP, dt, 5);
            if (d > 1.25 && !p.flinch) { const s = Math.min(d - 1.1, 1.9 * dt); if (stepFree(p, o, Math.sin(toP) * s, Math.cos(toP) * s)) { moved = s; motion = 'walk'; } }
            else if (p.cool <= 0 && !p.flinch) {
              p.cool = 1.6; motion = 'attack'; p.f.anim.play('attack');
              if (++p.swings >= 2) setTimeout(() => { if (p.mode === 'fight') p.wantCover = true; }, 700);
              setTimeout(() => { if (p.mode === 'fight' && !p.cover && Math.hypot(ctx.camera.position.x - o.x, ctx.camera.position.z - o.z) < 1.7) G.hurt(9, { reason: 'human' }); }, 380);
            }
            else motion = p.cool > 1.0 ? 'attack' : 'idle';
          }
        } else if (p.mode === 'shoot' && !busy) {
          p.cool -= dt; p.flinch = Math.max(0, (p.flinch || 0) - dt);
          // a little state machine: go to cover, crouch there, come up to shoot two or three times, down again
          if (!p.cover) { const c = coverPoint(p, cam); p.cover = { at: c || [o.x, o.z], t: 0, ph: 'go' }; }
          const C = p.cover; C.t += dt;
          if (C.ph === 'go') {
            const dx = C.at[0] - o.x, dz = C.at[1] - o.z, dd = Math.hypot(dx, dz);
            if (dd > 0.15 && C.t < 3.5) { const s = Math.min(dd, 2.6 * dt); if (stepFree(p, o, dx / dd * s, dz / dd * s)) { moved = s; motion = 'walk'; } p.f.root.rotation.y = turnToward(p.f.root.rotation.y, Math.atan2(dx, dz), dt, 8); }
            else { C.ph = 'down'; C.t = 0; C.hold = 1.4 + Math.random(); }
          } else if (C.ph === 'down') {
            motion = 'crouch'; p.f.root.rotation.y = turnToward(p.f.root.rotation.y, toP, dt, 4);
            if (C.t > C.hold || p.flinch) { if (!p.flinch) { C.ph = 'up'; C.t = 0; p.shots = 0; p.cool = 0.6; } }
          } else {
            p.f.root.rotation.y = turnToward(p.f.root.rotation.y, toP, dt, 6); motion = p.cool > 1.1 ? 'attack' : 'idle';
            if (p.cool <= 0 && d < 18 && canSee(o, cam)) {
              p.cool = 1.5 + Math.random() * 0.7; p.shots++; G.sfx3d('pistol', o); G.noise && G.noise(o, 18);
              const hitK = d < 5 ? 0.7 : d < 10 ? 0.5 : 0.3;
              if (Math.random() < hitK) G.hurt(11, { reason: 'shot' });
            }
            // after the shots, or when hit, down again (a new cover if the player came round)
            if (p.shots >= (p.P.id === 'mori' ? 3 : 2) || C.t > 4.5 || p.flinch > 0.3) { if (d < 2.4) p.cover = null; else { C.ph = 'down'; C.t = 0; C.hold = 1.6 + Math.random() * 1.2; } }
          }
        } else if (p.mode === 'flee' && !busy) {
          // away from the player to the far side of the room, then down on the floor, pleading
          p.fleeT += dt;
          const R = ctx.data.plan.rooms.find((r) => r.id === p.room);
          if (R) {
            const tx = cam.x < R.x + R.w / 2 ? R.x + R.w - 0.6 : R.x + 0.6, tz = cam.z < R.z + R.d / 2 ? R.z + R.d - 0.6 : R.z + 0.6;
            const dx = tx - o.x, dz = tz - o.z, dd = Math.hypot(dx, dz);
            if (dd > 0.2 && p.fleeT < 4) { const s = Math.min(dd, 2.4 * dt); if (stepFree(p, o, dx / dd * s, dz / dd * s)) { moved = s; motion = 'walk'; } p.f.root.rotation.y = turnToward(p.f.root.rotation.y, Math.atan2(dx, dz), dt, 8); }
            else { p.mode = 'down'; p.f.anim.play('fear'); ctx.ui.toast(`${p.P.name}「撃たないで……お願い」`); G.emit('person:down', { id: p.P.id }); }
          } else p.mode = 'down';
        } else if (p.mode === 'dead') { p.f.update(0, { moved: 0 }); continue; }
        else if (p.mode === 'down') motion = 'fear';
        p.f.anim.play(motion);
        p.f.update(dt, { moved: moved / (p.f.scale || 1) });
      }
    },
  });
}
