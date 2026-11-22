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
  { id: 'nishina', name: '仁科', at: ['S_MART', 64.4, 8.8], h: 1.72, hp: 80 },
  { id: 'shirasaka', name: '白坂', station: 'S_SHIRA', h: 1.66 },
  { id: 'taeko', name: '妙子', at: ['S_KOMIN', 67.4, 28.6], h: 1.58, woman: true },
  { id: 'katagiri', name: '片桐', station: 'S_KATA', h: 1.66, woman: true },
  { id: 'mori', name: '森', at: ['P_KYU', 97.4, 2.6], h: 1.76 },
  { id: 'noguchi', name: '野口', station: 'S_NOGUCHI', h: 1.66 },
  { id: 'hayase', name: '早瀬', at: ['O_CHU', 148, 3.6], h: 1.74 },
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
    const cx = R.x + R.w / 2, cz = R.z + R.d / 2, yaw = Math.atan2(cx - x, cz - z);
    f.root.position.set(x - Math.sin(yaw) * 0.15, y, z - Math.cos(yaw) * 0.15);
    f.root.rotation.y = yaw;
    f.root.name = `person:${P.id}`;
    ctx.scene.add(f.root);
    f.anim.play('idle');
    // the station's own stand-in look (a grey block where a person talks) is the person now
    const sid = P.station || (P.id === 'hayase' ? 'S_HAYASE' : null);
    if (sid) { const look = W.group.getObjectByName(`stlook:${sid}`); if (look) look.traverse((m) => { if (m.isMesh) m.visible = false; }); }
    if (f.warm) { f.warm.visible = false; ctx.scene.add(f.warm); warmOf.set(P.id, f.warm); }
    figs.set(P.id, { P, f, set, room, floor: (R && R.floor) || 0, yaw, home: f.root.position.clone(), hp: P.hp || 100, max: P.hp || 100, mode: 'stand', cool: 0, hidden: false });
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
      const dd = Math.hypot(x - o.x, z - o.z); if (dd < bd && dd < 7) { bd = dd; best = [x, z]; }
    }
    return best;
  }
  G.peopleTargets = () => {
    const out = [];
    for (const p of figs.values()) {
      if (p.mode !== 'fight' || p.hidden) continue;
      const o = p.f.root.position;
      out.push({ kind: 'person', id: p.P.id, alive: true, pos: o,
        raycast: (r) => { box.min.set(o.x - 0.28, o.y, o.z - 0.28); box.max.set(o.x + 0.28, o.y + hh(p), o.z + 0.28); const q = r.intersectBox(box, hitP); return q ? { part: q.y > o.y + hh(p) - 0.28 ? 'head' : 'chest', dist: q.distanceTo(r.origin), point: q.clone() } : null; },
        hit: (r, dmg, o2 = {}) => { const part = typeof r === 'string' ? r : (out.find((t) => t.id === p.P.id).raycast(r) || {}).part || 'chest'; hurt(p, dmg * (part === 'head' ? 1.6 : 1), o2); return { part }; },
        aimPoints: () => [o.clone().setY(o.y + hh(p) * 0.72)] });
    }
    return out;
  };
  function hurt(p, dmg, o) {
    p.hp -= dmg; p.flinch = 0.35; if (!p.cover) p.wantCover = true; G.sfx3d('hit-person', p.f.root.position);
    const d = new THREE.Vector3(o.dir ? o.dir[0] : 0, 0, o.dir ? o.dir[2] : 0); p.f.root.position.addScaledVector(d, 0.25 * (o.force || 0.5));
    if (p.hp <= p.max / 3) { p.mode = 'down'; p.f.anim.play('fear'); G.emit('person:down', { id: p.P.id }); }
  }

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
              const s = Math.min(dd, 2.4 * dt); o.x += dx / dd * s; o.z += dz / dd * s; moved = s; motion = 'walk';
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
            if (d > 1.25 && !p.flinch) { const s = Math.min(d - 1.1, 1.9 * dt); o.x += Math.sin(toP) * s; o.z += Math.cos(toP) * s; moved = s; motion = 'walk'; }
            else if (p.cool <= 0 && !p.flinch) {
              p.cool = 1.6; motion = 'attack'; p.f.anim.play('attack');
              if (++p.swings >= 2) setTimeout(() => { if (p.mode === 'fight') p.wantCover = true; }, 700);
              setTimeout(() => { if (p.mode === 'fight' && !p.cover && Math.hypot(ctx.camera.position.x - o.x, ctx.camera.position.z - o.z) < 1.7) G.hurt(9, { reason: 'human' }); }, 380);
            }
            else motion = p.cool > 1.0 ? 'attack' : 'idle';
          }
        } else if (p.mode === 'down') motion = 'fear';
        p.f.anim.play(motion);
        p.f.update(dt, { moved: moved / (p.f.scale || 1) });
      }
    },
  });
}
