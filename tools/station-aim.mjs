// P63 (1.39.0, 札の家 2.5.0 play test #2 「黒電話をクリックするのに取れない場合があります」): a station is what you get when you aim at it.
// The ringing phone's station box and the look-only 「黒電話」 sat on the same phone; aimed at the phone, the look often won and the call
// could not be taken. stationAimSource() is page code: for every station [E] box in the world, the camera stands 1.2 / 1.8 m away in
// 8 directions (same room, not inside furniture, eye height), looks at the box's middle (and at any other [E] thing on the same
// object, as the player aims at what they see) and asks the game's own pick (ctx.pickNow()).
// -> [{ id, poses, lost, by: { 'look:X': n } }] for the stations another thing takes in more than a quarter of the poses (check-playtest:
// a warning; over half, an error). Fix: one [E] per thing - hide the look while the station has work, or move / size the boxes apart.
export function stationAimSource() {
  return `(() => {
    const g = window.__game; if (!g || !g.pickNow || !g.world || !g.camera) return { missing: true };
    const T = g.THREE, W = g.world, cam = g.camera, rooms = (g.data.plan && g.data.plan.rooms) || [];
    const shown = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
    const save = { p: cam.position.clone(), r: cam.rotation.clone(), o: cam.rotation.order }, out = [];
    try {
      cam.rotation.order = 'YXZ';
      for (const o of W.interactables.slice()) {
        const ia = o.userData && o.userData.interact; if (!ia || ia.kind !== 'station' || !shown(o)) continue;
        const b = new T.Box3().setFromObject(o); if (b.isEmpty()) continue;
        const c = b.getCenter(new T.Vector3()), rid = W.roomAt ? W.roomAt(c.x, c.z, c.y) : null, room = rooms.find((r) => r.id === rid);
        if (!room) continue;
        const fy = W.floorY ? W.floorY(room.floor || 0) : 0, ey = typeof g.eyeY === 'function' ? g.eyeY(room.floor || 0) : fy + 1.6;
        // where the player aims: the box's middle, and the middle of any other [E] thing on the same object (within 0.6 m) - the
        // player aims at the phone they see, not at an invisible box beside it
        const aims = [c];
        for (const q of W.interactables) { if (q === o || !shown(q) || !(q.userData && q.userData.interact)) continue; const qb = new T.Box3().setFromObject(q); if (qb.isEmpty()) continue; const qc = qb.getCenter(new T.Vector3()); if (Math.hypot(qc.x - c.x, qc.z - c.z) < 0.6 && Math.abs(qc.y - c.y) < 0.6) aims.push(qc); }
        let poses = 0, lost = 0; const by = {};
        for (const d of [1.2, 1.8]) for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4, x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
          if (W.roomAt(x, z, ey) !== rid) continue;
          if ((W.colliders || []).some((q) => !q.off && q.box.max.y > fy + 0.3 && q.box.min.y < ey && x > q.box.min.x - 0.2 && x < q.box.max.x + 0.2 && z > q.box.min.z - 0.2 && z < q.box.max.z + 0.2)) continue;
          for (const p of aims) {
            cam.position.set(x, ey, z);
            const dx = p.x - x, dz = p.z - z; cam.rotation.set(Math.atan2(p.y - ey, Math.hypot(dx, dz)), Math.atan2(-dx, -dz), 0); cam.updateMatrixWorld(true);
            const t = g.pickNow(); if (!t) continue;   // a wall or nothing in reach: not this check's business (select-range)
            poses++;
            if ((t.kind === ia.kind && t.id === ia.id) || t.kind === 'station') continue;   // another station on top is a sequence by design (a mill on a hatch)
            lost++; const key = t.kind + ':' + t.id; by[key] = (by[key] || 0) + 1;
          }
        }
        if (poses >= 3 && lost / poses > 0.25) out.push({ id: ia.id, poses, lost, by });
      }
    } finally { cam.position.copy(save.p); cam.rotation.order = save.o; cam.rotation.copy(save.r); cam.updateMatrixWorld(true); }
    return out;
  })()`;
}
