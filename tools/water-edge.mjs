// Standing water never shows a cut face, a body never stands through a shut door, a hiding place stands inside its room
// (1.38.0, 水無瀬病院 4th play test 2026-11-23 #1 #6 #3). Page code for check-playtest (P60 / P61 / P62) and a game's play scripts.
//
// P60 waterEdgeSource(): every visible water surface (a flat mesh named water:* or with userData.water) is walked along its four edges
//   every 25 cm. At each point the edge must be closed: a wall, a sill, a door or anything solid within 12 cm outward at 2 cm under the
//   surface (the face is hidden in it), or the water goes on: another visible surface within 3 cm of the same height just beyond. Else the
//   side of the water stands open over a lower or dry floor (「添付のような水の断面が見える作りはやめてください」): give the doorway a sill
//   higher than the water, or bring the levels of joined rooms together (an open door joins them). -> [{ water, open, at, y }]
// P61 doorClipSource({ names }): every visible figure (userData.figure, or an object whose name matches `names`) against every shut door
//   (ctx.world.doors, not open): the figure's box must not reach across the door's plane inside its width (「モンスターが扉を少し貫通して
//   いるように見えます」). -> [{ figure, door, depth }]
// P62 hideRoomSource(): each hiding place's look (ctx.hideLooks) inside its room's wall faces (half a wall, 8 cm, in from the room's
//   lines; 2 cm slack) (「地下のロッカーが壁に埋まっています」). -> [{ id, room, over }]
export function waterEdgeSource(o = {}) {
  const step = o.step ?? 0.25, reach = o.reach ?? 0.12, dy = o.dy ?? 0.03;
  return `(() => {
    const g = window.__game; if (!g || !g.THREE || !g.scene) return { missing: true };
    const T = g.THREE, shown = (m) => { for (let x = m; x; x = x.parent) if (x.visible === false) return false; return true; };
    const waters = [], solids = [];
    g.scene.traverse((m) => {
      if (!m.isMesh || !shown(m)) return;
      const isW = /^water:/.test(m.name || '') || (m.userData && m.userData.water);
      if (isW) { m.updateMatrixWorld(true); const b = new T.Box3().setFromObject(m); if (b.max.y - b.min.y < 0.02 && b.max.x - b.min.x > 0.2) waters.push({ m, b, y: (b.min.y + b.max.y) / 2 }); return; }
      solids.push(m);
    });
    const ray = new T.Raycaster(), out = [];
    const joined = (W, x, z) => waters.some((V) => V !== W && Math.abs(V.y - W.y) < ${dy} && x >= V.b.min.x - 0.01 && x <= V.b.max.x + 0.01 && z >= V.b.min.z - 0.01 && z <= V.b.max.z + 0.01);
    for (const W of waters) {
      const { b, y } = W, open = [];
      const edges = [[b.min.x, b.min.z, b.max.x, b.min.z, 0, -1], [b.min.x, b.max.z, b.max.x, b.max.z, 0, 1], [b.min.x, b.min.z, b.min.x, b.max.z, -1, 0], [b.max.x, b.min.z, b.max.x, b.max.z, 1, 0]];
      for (const [x0, z0, x1, z1, nx, nz] of edges) {
        const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.floor(L / ${step}));
        for (let i = 0; i <= n; i++) {
          const t = (i + 0.5) / (n + 1), px = x0 + (x1 - x0) * t - nx * 0.3, pz = z0 + (z1 - z0) * t - nz * 0.3;   // from 30 cm inside: a plane often runs into the wall's thickness
          ray.set(new T.Vector3(px, y - 0.02, pz), new T.Vector3(nx, 0, nz)); ray.far = ${reach} + 0.3;
          const hit = ray.intersectObjects(solids, false).length > 0;
          if (hit || joined(W, px + nx * 0.42, pz + nz * 0.42)) continue;
          open.push([+(px + nx * 0.3).toFixed(2), +(pz + nz * 0.3).toFixed(2)]);
        }
      }
      if (open.length >= 2) out.push({ water: W.m.name || 'water', open: open.length, at: open.slice(0, 3), y: +y.toFixed(2) });
    }
    return out;
  })()`;
}

export function doorClipSource(o = {}) {
  const names = o.names || /^(monster|figure|chimera|ghost)/;
  return `(() => {
    const g = window.__game; if (!g || !g.THREE || !g.world) return { missing: true };
    const T = g.THREE, W = g.world, shown = (m) => { for (let x = m; x; x = x.parent) if (x.visible === false) return false; return true; };
    const figs = []; g.scene.traverse((m) => { if ((m.userData && m.userData.figure) || ${names}.test(m.name || '')) if (shown(m) && !figs.some((f) => { for (let x = m.parent; x; x = x.parent) if (x === f) return true; return false; })) figs.push(m); });
    const out = [];
    for (const f of figs) {
      const b = new T.Box3(); f.traverse((x) => { if (x.isMesh && shown(x)) b.union(new T.Box3().setFromObject(x)); }); if (b.isEmpty()) continue;
      for (const [id, d] of (W.doors || new Map())) {
        if (!d || d.isOpen || !d.def || d.def.kind === 'stairs' || d.def.open) continue;
        const R = W.rooms && W.rooms.get(d.def.a); if (!R) continue;
        const fy = R.y || 0, w = (d.def.width || 1.1) / 2;
        if (b.max.y < fy + 0.05 || b.min.y > fy + 2.2) continue;
        // the plane of the door: along x when it sits on a north / south wall of its room, else along z
        const r = R.room, alongX = Math.abs(d.def.z - r.z) < 0.2 || Math.abs(d.def.z - (r.z + r.d)) < 0.2;
        if (alongX) { if (b.max.x < d.def.x - w || b.min.x > d.def.x + w) continue; const depth = Math.min(b.max.z - d.def.z, d.def.z - b.min.z); if (depth > 0.04) out.push({ figure: f.name || 'figure', door: id, depth: +depth.toFixed(2) }); }
        else { if (b.max.z < d.def.z - w || b.min.z > d.def.z + w) continue; const depth = Math.min(b.max.x - d.def.x, d.def.x - b.min.x); if (depth > 0.04) out.push({ figure: f.name || 'figure', door: id, depth: +depth.toFixed(2) }); }
      }
    }
    return out;
  })()`;
}

export function hideRoomSource() {
  return `(() => {
    const g = window.__game; if (!g || !g.THREE || !g.world) return { missing: true };
    const T = g.THREE, L = g.hideLooks; if (!L) return [];
    const out = [];
    for (const [id, l] of (L instanceof Map ? L : new Map(Object.entries(L)))) {
      const grp = l.group || (l.L && l.L.group); const h = l.h || {}; const R = g.world.rooms && g.world.rooms.get(h.room); if (!grp || !R) continue;
      grp.updateMatrixWorld(true); const b = new T.Box3(); grp.traverse((x) => { if (x.isMesh && x.material && x.material.visible !== false && x.geometry) { x.geometry.computeBoundingBox(); b.union(x.geometry.boundingBox.clone().applyMatrix4(x.matrixWorld)); } });
      if (b.isEmpty()) continue;
      const r = R.room, f = 0.06;   // the wall face 8 cm in from the room line, 2 cm slack
      const over = Math.max(r.x + f - b.min.x, b.max.x - (r.x + r.w - f), r.z + f - b.min.z, b.max.z - (r.z + r.d - f));
      if (over > 0) out.push({ id, room: h.room, over: +over.toFixed(3) });
    }
    return out;
  })()`;
}
