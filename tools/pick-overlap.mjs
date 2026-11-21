// P43 (standard 1.22.0): pickups stand clear of other things (鏡屋 play test 2026-11-21 「壁掛け時計などがアイテムと重なっている場合がある」).
// For every pickup (interact kind item / doc / pick), the box of what is drawn for it against every other visible mesh in the world, except the
// room shell (walls, floors, ceilings, doors, stairs, the house frame), marks, and what it rests on (the first mesh straight under its middle,
// with everything of the same prop). A box cutting into the pickup's box by more than 1.5 cm on every axis is an overlap (an error).
// After the 鏡屋 ドット版 check (tools/dot/overlap-steps.mjs there), generalised.
//   pickOverlapSource({ shell: '^(wall:|floor:|...)' }) -> page code returning [[pickupId, otherName, [ix, iy, iz], centre]]
export const PICK_SHELL = '^(wall:|floor:|ceil:|door:|doorlook:|stair|hidelook:|hide:|look:|item:|doc:|dot-mark|dot-guide|plan-|kg-frame|kg-ceiling|frame:|house-frame|warm:)';

export function pickOverlapSource(o = {}) {
  const shell = o.shell || PICK_SHELL;
  return `(() => {
    const g = window.__game, T = g && (g.THREE || window.THREE); if (!g || !T) return { error: 'no game' };
    const SH = new RegExp(${JSON.stringify(shell)});
    const shell = (o) => { for (let q = o; q; q = q.parent) if (SH.test(q.name || '')) return true; return false; };
    const picks = g.world.interactables.filter((o) => o.userData.interact && /^(item|doc|pick)$/.test(o.userData.interact.kind));
    const pickSet = new Set(); for (const p of picks) p.traverse((q) => pickSet.add(q));
    const shown = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return true; };
    const others = []; g.world.group.traverse((o) => { if (!o.isMesh || pickSet.has(o) || !shown(o)) return; const m = [].concat(o.material)[0]; if (!m || m.visible === false || (m.transparent && m.opacity < 0.05)) return; if (shell(o)) return; others.push(o); });
    const box = (o) => { const b = new T.Box3(); o.traverse((q) => { if (!q.isMesh || !shown(q)) return; const qm = [].concat(q.material)[0]; if (!qm || qm.visible === false || (qm.transparent && qm.opacity < 0.05)) return;   /* 1.22.5: the pickup's own unseen hit box (札の家: 0.8 m tall) is not what is drawn */ if (/mark|guide/.test(q.name || '') || (q.parent && /mark|guide/.test(q.parent.name || ''))) return; b.expandByObject(q); }); return b; };
    const top = (o) => { let q = o; while (q.parent && q.parent !== g.world.group && q.parent !== g.scene) q = q.parent; return q; };
    const ray = new T.Raycaster(), out = [];
    for (const p of picks) {
      if (!shown(p)) continue;
      const pb = box(p); if (pb.isEmpty()) continue;
      const c = pb.getCenter(new T.Vector3()); ray.set(new T.Vector3(c.x, pb.min.y + 0.02, c.z), new T.Vector3(0, -1, 0)); ray.far = 0.6;
      const hit = ray.intersectObjects(others, false)[0], support = hit ? top(hit.object) : null;
      for (const o of others) {
        if (support && top(o) === support) continue;
        const ob = new T.Box3().setFromObject(o); if (ob.isEmpty() || ob.max.y <= pb.min.y + 0.03) continue;
        // a merged mesh that spans the building (pipes, a house shell merged into one geometry) has a box over half the map: its box says
        // nothing about this spot (1.22.3, 水無瀬病院 mn-pipes / mn-hospital); such a mesh is tested by rays from the pickup's corners instead
        { const os = ob.getSize(new T.Vector3()); if ([os.x, os.y, os.z].filter((v) => v > 3).length >= 2) { let cut = false; const c0 = pb.getCenter(new T.Vector3()), hs = pb.getSize(new T.Vector3()).multiplyScalar(0.5); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const dir = new T.Vector3(dx, 0, dz), len = dx ? hs.x : hs.z; if (len < 0.03) continue; ray.set(c0, dir); ray.far = len - 0.015; if (ray.intersectObject(o, false).length) { cut = true; break; } } ray.far = 0.6; if (cut) out.push([p.userData.interact.id, (o.name || '?') + (o.parent && o.parent.name ? ' < ' + o.parent.name : ''), [0, 0, 0].map(() => +(hs.x).toFixed(2)), [c0.x, c0.y, c0.z].map((v) => +v.toFixed(2))]); continue; } }
        const ix = Math.min(pb.max.x, ob.max.x) - Math.max(pb.min.x, ob.min.x), iy = Math.min(pb.max.y, ob.max.y) - Math.max(pb.min.y, ob.min.y), iz = Math.min(pb.max.z, ob.max.z) - Math.max(pb.min.z, ob.min.z);
        if (ix > 0.015 && iy > 0.015 && iz > 0.015) { const nm = []; for (let q = o; q && q !== g.world.group; q = q.parent) if (q.name) nm.push(q.name); out.push([p.userData.interact.id, nm.slice(0, 2).join(' < ') || o.geometry.type, [ix, iy, iz].map((v) => +v.toFixed(2)), ob.getCenter(new T.Vector3()).toArray().map((v) => +v.toFixed(2))]); }
      }
    }
    return out;
  })()`;
}
