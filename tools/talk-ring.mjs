// A person is easy to speak to (札の家, 2026-11-21: 「婆さんに話しかけづらいです。領域を増やしてください」).
// talkRingSource() is page code (a string for page.evaluate) over a running kit game (window.g = ctx): for every plan station with
// "talk": true it stands the player on rings round the station (radii in m, n points each), keeps only the spots on the station's
// floor that are inside a room and outside every solid collider, faces the station (as a player walking up to it does) and asks the
// game's own pick (ctx.pickNow) what is selected. Returns [{ id, spots, hits, share, misses: [[x, z, r]] }]; the camera is put back.
//   const r = await page.evaluate(talkRingSource({ radii: [1.0, 1.8, 2.6] }));   // check-playtest P29: share >= 0.8 on the 1.0 / 1.8 rings
export const TALK_RING_MIN = 0.8;
export function talkRingSource({ radii = [1.0, 1.8, 2.6], n = 16 } = {}) {
  return `(() => {
    const W = g.world, plan = g.data.plan, cam = g.camera, fp = g.fp, out = [];
    const keep = { x: cam.position.x, y: cam.position.y, z: cam.position.z, yaw: fp.yaw, pitch: fp.pitch };
    const rooms = plan.rooms || [];
    const solid = (x, y, z) => (W.colliders || []).some((c) => c && c.box && !c.off && x > c.box.min.x - 0.15 && x < c.box.max.x + 0.15 && z > c.box.min.z - 0.15 && z < c.box.max.z + 0.15 && y > c.box.min.y && y - 1.2 < c.box.max.y);
    for (const s of plan.stations || []) {
      if (!s.talk) continue;
      const hit = W.interactables.find((o) => o.name === 'station:' + s.id);
      if (!hit) { out.push({ id: s.id, spots: 0, hits: 0, share: 0, error: 'no station mesh' }); continue; }
      const R = rooms.find((r) => r.id === s.room) || {}, F = R.floor || 0, eyeY = W.floorY(F) + (cam.position.y - W.floorY(g.floor));
      hit.updateMatrixWorld(true);
      const c = new g.THREE.Box3().setFromObject(hit).getCenter(new g.THREE.Vector3());
      let spots = 0, hits = 0; const misses = [], byR = {};
      for (const r of [${radii.join(', ')}]) {
        byR[r] = [0, 0];
        for (let i = 0; i < ${n}; i++) {
          const a = (i / ${n}) * Math.PI * 2, x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r;
          if (!rooms.some((q) => (q.floor || 0) === F && x > q.x + 0.2 && x < q.x + q.w - 0.2 && z > q.z + 0.2 && z < q.z + q.d - 0.2)) continue;
          if (solid(x, eyeY, z)) continue;
          cam.position.set(x, eyeY, z);
          fp.yaw = Math.atan2(-(c.x - x), -(c.z - z)); fp.pitch = Math.atan2(c.y - eyeY, Math.hypot(c.x - x, c.z - z)) * 0.5;
          cam.rotation.set(fp.pitch, fp.yaw, 0, 'YXZ'); cam.updateMatrixWorld(true);
          const t = g.pickNow();
          spots++; byR[r][0]++;
          if (t && t.kind === 'station' && t.id === s.id) { hits++; byR[r][1]++; } else misses.push([+x.toFixed(2), +z.toFixed(2), r, t ? t.kind + ':' + t.id : null]);
        }
      }
      out.push({ id: s.id, spots, hits, share: spots ? +(hits / spots).toFixed(2) : 0, byRadius: byR, misses: misses.slice(0, 12) });
    }
    cam.position.set(keep.x, keep.y, keep.z); fp.yaw = keep.yaw; fp.pitch = keep.pitch; cam.rotation.set(keep.pitch, keep.yaw, 0, 'YXZ'); cam.updateMatrixWorld(true);
    return out;
  })()`;
}
