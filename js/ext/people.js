// The people: dot figures on the kit's shared motion rig (assets/figures/<id>.json, tools/dot/figures.json, res 2), standing at their
// talk points, turning to the player, and the few who fight (権藤 and 仁科 when the mart is fought): they walk at the player, swing,
// and give up when they are hurt enough (降参). Nobody is ever shot by the people on the player's side (no friendly fire).
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
  ext.registerBoot('yk-people', async (c, report) => {
    let k = 0;
    await Promise.all(PEOPLE.map(async (p) => {
      try { sets.set(p.id, await loadFrameSet(THREE, `${FIG}${p.id}.json`)); } catch (e) { console.warn('[yakinake] figure', p.id, e); }
      report(++k / PEOPLE.length, `人を準備中… ${Math.round((k / PEOPLE.length) * 100)}%`);
    }));
    loaded = true; placeAll();
  });
  // the boot (behind the title) ends after game:ready: the people stand once both have happened
  let loaded = false, placed = false;
  const figMat = (self, name) => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true }); m.name = name;
    m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${self.toFixed(3)};`); };
    m.customProgramCacheKey = () => `yk-fig-${self}`;
    return m;
  };
  ext.on('game:ready', (c) => { ctx = c; placeAll(); });
  function placeAll() {
    if (!ctx || !loaded || placed) return; placed = true;
    const plan = ctx.data.plan, W = ctx.world, mat = figMat(0.22, 'yk-person');
    const warm = [];
    for (const P of PEOPLE) {
      const set = sets.get(P.id); if (!set) continue;
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
      warm.push(f.warm);
      figs.set(P.id, { P, f, room, floor: (R && R.floor) || 0, yaw, home: f.root.position.clone(), hp: P.hp || 100, max: P.hp || 100, mode: 'stand', cool: 0, hidden: false });
    }
    for (const w of warm) { if (!w) continue; w.visible = false; ctx.scene.add(w); }
    ctx.warmObjects = [...(ctx.warmObjects || []), ...warm.filter(Boolean)];
    G.people = figs;
  }
  G.person = (id) => figs.get(id) || null;
  G.showPerson = (id, on) => { const p = figs.get(id); if (p) { p.hidden = !on; p.f.root.visible = on; } };
  /** a person walks to (x, z) (no path: a straight line inside the room), then stands */
  G.walkPerson = (id, x, z) => { const p = figs.get(id); if (p) { p.goal = [x, z]; p.mode = 'walk'; } };
  /** the fight: mode 'fight' walks at the player and swings; at a third of the life they give up (mode 'down') */
  G.fight = (ids) => { for (const id of ids) { const p = figs.get(id); if (p) { p.mode = 'fight'; p.hp = p.max; } } };
  G.calm = (ids) => { for (const id of ids) { const p = figs.get(id); if (p && p.mode !== 'down') p.mode = 'stand'; } };

  const box = new THREE.Box3(), hitP = new THREE.Vector3();
  G.peopleTargets = () => {
    const out = [];
    for (const p of figs.values()) {
      if (p.mode !== 'fight' || p.hidden) continue;
      const o = p.f.root.position;
      out.push({ kind: 'person', id: p.P.id, alive: true, pos: o,
        raycast: (r) => { box.min.set(o.x - 0.28, o.y, o.z - 0.28); box.max.set(o.x + 0.28, o.y + p.P.h, o.z + 0.28); const q = r.intersectBox(box, hitP); return q ? { part: q.y > o.y + p.P.h - 0.28 ? 'head' : 'chest', dist: q.distanceTo(r.origin), point: q.clone() } : null; },
        hit: (r, dmg, o2 = {}) => { const part = typeof r === 'string' ? r : (out.find((t) => t.id === p.P.id).raycast(r) || {}).part || 'chest'; hurt(p, dmg * (part === 'head' ? 1.6 : 1), o2); return { part }; },
        aimPoints: () => [o.clone().setY(o.y + p.P.h * 0.72)] });
    }
    return out;
  };
  function hurt(p, dmg, o) {
    p.hp -= dmg; p.flinch = 0.35; G.sfx3d('hit-person', p.f.root.position);
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
        if (p.mode === 'stand') { if (d < 4.5) p.f.root.rotation.y = turnToward(p.f.root.rotation.y, toP, dt, 3); }
        else if (p.mode === 'walk' && p.goal) {
          const dx = p.goal[0] - o.x, dz = p.goal[1] - o.z, dd = Math.hypot(dx, dz);
          if (dd < 0.1) { p.mode = 'stand'; p.goal = null; }
          else { const s = Math.min(dd, 1.2 * dt); o.x += dx / dd * s; o.z += dz / dd * s; moved = s; motion = 'walk'; p.f.root.rotation.y = turnToward(p.f.root.rotation.y, Math.atan2(dx, dz), dt, 6); }
        } else if (p.mode === 'fight' && !busy) {
          p.f.root.rotation.y = turnToward(p.f.root.rotation.y, toP, dt, 5);
          p.cool -= dt; p.flinch = Math.max(0, (p.flinch || 0) - dt);
          if (d > 1.25 && !p.flinch) { const s = Math.min(d - 1.1, 1.5 * dt); o.x += Math.sin(toP) * s; o.z += Math.cos(toP) * s; moved = s; motion = 'walk'; }
          else if (p.cool <= 0 && !p.flinch) { p.cool = 1.6; motion = 'attack'; p.f.anim.play('attack'); setTimeout(() => { if (p.mode === 'fight' && Math.hypot(ctx.camera.position.x - o.x, ctx.camera.position.z - o.z) < 1.7) G.hurt(9, { reason: 'human' }); }, 380); }
          else motion = p.cool > 1.0 ? 'attack' : 'idle';
        } else if (p.mode === 'down') motion = 'fear';
        p.f.anim.play(motion);
        p.f.update(dt, { moved: moved / (p.f.scale || 1) });
      }
    },
  });
}
