// Nothing hangs where a door runs (札の家, 2026-11-21: 「スライドする戸のところに壁掛け時計があるので良くないです」).
// wallDoorSource() is page code (a string for page.evaluate) over a running kit game (window.g = ctx): for every door of the plan it takes
// the band of wall the door needs - the opening itself on both faces, and for a sliding door (slide / fusuma / glass) the run of its
// leaf along room a's face (0.94 x the leaf, js/world-from-plan.js pose()) - and lists every small thing fixed on that wall inside the band:
// a mesh near the wall plane (within 0.22 m), thin across it (< 0.25 m), small along it (< 1.2 m) and between 0.25 m and the door's top.
// Not counted: the door's own look (doorlook:*), the [E] boxes, the walls and the floor, anything marked userData.doorItem = true (a
// charm meant to be ON the door), invisible meshes. Returns [{ door, mesh, at: [x, y, z], why }].
//   const hits = await page.evaluate(wallDoorSource());   // check-playtest P28
export function wallDoorSource({ near = 0.22, thin = 0.25, small = 1.2 } = {}) {
  return `(() => {
    const W = g.world, plan = g.data.plan, THREE = g.THREE, K = W.K || {}, doorH = K.doorH || 2.05, out = [];
    if (!W || !plan || !THREE) return out;
    const rooms = new Map((plan.rooms || []).map((r) => [r.id, r]));
    const lookOf = (d) => d.look || plan.doorLook || 'swing';
    const skip = (o) => { for (let p = o; p; p = p.parent) { const n = p.name || ''; if (/^doorlook:|^door:|^barrier:/.test(n) || p.userData.doorItem) return true; } return false; };
    const meshes = []; W.group.updateMatrixWorld(true);
    W.group.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || !o.visible || skip(o) || o.userData.interact) return; let v = true; for (let p = o; p; p = p.parent) if (!p.visible) v = false; if (!v) return; const b = new THREE.Box3().setFromObject(o); if (!b.isEmpty()) meshes.push([o, b]); });
    for (const d of plan.doors || []) {
      if (d.x == null || d.z == null) continue;
      const a = rooms.get(d.a); if (!a) continue;
      const look = lookOf(d); if (d.open && !d.unlock) continue;   // an opening with no panel
      const w = d.width ?? K.doorW ?? 1, alongX = Math.abs(d.z - a.z) < 0.05 || Math.abs(d.z - (a.z + a.d)) < 0.05;
      const fixed = alongX ? d.z : d.x, c = alongX ? d.x : d.z, y0 = W.floorY(a.floor || 0);
      const pair = w >= 1.5, lw = pair ? w / 2 : w, run = look === 'swing' || look === 'none' ? 0 : 0.94 * lw + 0.04;
      const lo = c - w / 2 - (pair ? run : 0), hi = c + w / 2 + run;   // a single sliding leaf runs to +x (local), a pair both ways
      for (const [o, b] of meshes) {
        const sx = b.max.x - b.min.x, sz = b.max.z - b.min.z, sy = b.max.y - b.min.y;
        const across = alongX ? sz : sx, along = alongX ? sx : sz, mid = alongX ? (b.min.z + b.max.z) / 2 : (b.min.x + b.max.x) / 2;
        if (across > ${thin} || along > ${small} || sy > ${small} + 0.4) continue;
        if (Math.abs(mid - fixed) > ${near}) continue;
        const a0 = alongX ? b.min.x : b.min.z, a1 = alongX ? b.max.x : b.max.z;
        if (a1 < lo + 0.02 || a0 > hi - 0.02) continue;
        if (b.max.y < y0 + 0.25 || b.min.y > y0 + doorH - 0.05) continue;   // the lintel over the opening is wall, not a thing on it
        const inOpening = a1 > c - w / 2 + 0.02 && a0 < c + w / 2 - 0.02;
        out.push({ door: d.id, look, mesh: (o.name || o.parent && o.parent.name || o.geometry.type || 'mesh').slice(0, 40), at: [(b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2].map((v) => +v.toFixed(2)), why: inOpening ? 'in the opening' : 'on the run of the sliding leaf' });
      }
    }
    return out;
  })()`;
}
