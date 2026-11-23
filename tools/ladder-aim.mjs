// P66 (1.39.6, 夜勤明けの街 1.6.0: the shaft ladder EV12 and the cellar hatch ST_KCHIKA could be used only from the front): a ladder or a
// flight is what the pick gives from every side the player can stand on beside it. ladderAimSource() is page code: for every stairs end
// ([E] kind 'stairs', look ladder / flight), the camera stands 0.8 / 1.2 m away in 8 directions (a spot of the same room, not inside a
// collider other than the stairs' own), at eye height, and looks at it twice - straight ahead (pitch 0, walking up to it) and at the
// box's middle - and asks the game's own pick (ctx.pickNow()).
// -> [{ id, end, poses, got }] for the ends picked in less than half of the poses (check-playtest: a warning; under a quarter, an error).
export function ladderAimSource() {
  return `(() => {
    const g = window.__game; if (!g || !g.pickNow || !g.world || !g.camera) return { missing: true };
    const T = g.THREE, W = g.world, cam = g.camera, plan = g.data.plan || {}, rooms = plan.rooms || [], doors = plan.doors || [];
    const save = { p: cam.position.clone(), r: cam.rotation.clone(), o: cam.rotation.order }, out = [];
    try {
      cam.rotation.order = 'YXZ';
      for (const o of W.interactables.slice()) {
        const ia = o.userData && o.userData.interact; if (!ia || ia.kind !== 'stairs' || ia.look === 'lift') continue;
        const end = String(o.name).split(':')[2], d = doors.find((x) => x.id === ia.id), room = d && rooms.find((r) => r.id === d[end]); if (!room) continue;
        const b = new T.Box3().setFromObject(o); if (b.isEmpty()) continue;
        const c = b.getCenter(new T.Vector3()), fy = W.floorY ? W.floorY(room.floor || 0) : 0, ey = fy + 1.6;
        let poses = 0, got = 0;
        for (const r of [0.8, 1.2]) for (let k = 0; k < 8; k++) {
          const a = k * Math.PI / 4, x = c.x + Math.sin(a) * (r + Math.abs(Math.sin(a)) * (b.max.x - b.min.x) / 2 + Math.abs(Math.cos(a)) * (b.max.z - b.min.z) / 2 - 0.3), z = c.z + Math.cos(a) * (r + Math.abs(Math.sin(a)) * (b.max.x - b.min.x) / 2 + Math.abs(Math.cos(a)) * (b.max.z - b.min.z) / 2 - 0.3);
          if (W.roomAt(x, z, ey) !== room.id) continue;
          if (x > b.min.x - 0.2 && x < b.max.x + 0.2 && z > b.min.z - 0.2 && z < b.max.z + 0.2) continue;
          if ((W.colliders || []).some((q) => !q.off && q.box.max.y > fy + 0.3 && q.box.min.y < ey && x > q.box.min.x - 0.2 && x < q.box.max.x + 0.2 && z > q.box.min.z - 0.2 && z < q.box.max.z + 0.2)) continue;
          for (const mid of [false, true]) {
            cam.position.set(x, ey, z);
            const dx = c.x - x, dz = c.z - z; cam.rotation.set(mid ? Math.atan2(c.y - ey, Math.hypot(dx, dz)) : 0, Math.atan2(-dx, -dz), 0); cam.updateMatrixWorld(true);
            poses++; const t = g.pickNow(); if (t && t.kind === 'stairs' && t.id === ia.id) got++;
          }
        }
        if (poses >= 4 && got / poses < 0.5) out.push({ id: ia.id, end, poses, got });
      }
    } finally { cam.position.copy(save.p); cam.rotation.order = save.o; cam.rotation.copy(save.r); cam.updateMatrixWorld(true); }
    return out;
  })()`;
}
