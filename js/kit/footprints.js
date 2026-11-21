/* game-kit e962dd12: js/footprints.js — edit in game-kit and run tools/kit-sync.js */
// Footprints that grow as something walks (standard 1.8): the thing that came in from the rain, the player in snow, the child's wet
// prints that follow you. Fixed trails along a path are tex.footprintTrail(path, { id }) (js/texture-library.js); this is the live one.
//   const prints = createFootprints(tex, { id: 'fp_bare_wet', max: 40, fadeAfter: 30 });  scene.add(prints.group);
//   prints.walk(x, z, floorY);        // every frame from the walker's position: a print each stride, left / right in turn
//   prints.update(dt);  prints.clear();
// Catalog decals: fp_shoe_* fp_boot_mud fp_boot_snow fp_sneaker_* fp_heel_wet fp_bare_* fp_bare_large fp_child_wet fp_slipper_dust.
// Pure part: nextPrint(st, x, z) for the tests. The decals share the library's plane and materials (fading steps in 1/8s).
import * as THREE from 'three';

/** advance a walker by its new position; returns a print { x, z, up: [dx, 0, dz], right } when a stride is done, else null */
export function nextPrint(st, x, z, { stride = 0.42, stepWidth = 0.18 } = {}) {
  if (st.x == null) { Object.assign(st, { x, z, d: 0, right: false }); return null; }
  const dx = x - st.x, dz = z - st.z, L = Math.hypot(dx, dz);
  if (L > 3) { Object.assign(st, { x, z, d: 0 }); return null; }   // a teleport / respawn: no line of prints across the map
  if (L < 1e-6) return null;
  st.d += L; st.x = x; st.z = z;
  if (st.d < stride) return null;
  st.d -= stride; st.right = !st.right;
  const ux = dx / L, uz = dz / L, s = (st.right ? 1 : -1) * stepWidth / 2;   // right foot to the right of the heading
  return { x: x - uz * s, z: z + ux * s, up: [ux, 0, uz], right: st.right };
}

export function createFootprints(tex, { id = 'fp_shoe_wet', max = 40, fadeAfter = 0, stride, stepWidth, scale, opacity = 0.9 } = {}) {
  const group = new THREE.Group();
  group.name = `prints:${id}`;
  const st = {}, live = [];
  let t = 0;
  return {
    group,
    walk(x, z, y = 0) {
      const p = nextPrint(st, x, z, { stride, stepWidth });
      if (!p) return null;
      const m = tex.decal(id, { position: [p.x, y + 0.003 + 0.0005 * (live.length % 4), p.z], normal: [0, 1, 0], up: p.up, flip: !p.right, scale, opacity, layer: 2 });
      group.add(m); live.push({ m, at: t });
      while (live.length > max) { const o = live.shift(); group.remove(o.m); }
      return p;
    },
    update(dt) {
      t += dt;
      if (!fadeAfter) return;
      for (let i = live.length - 1; i >= 0; i--) {
        const o = live[i], k = 1 - (t - o.at - fadeAfter) / 4;
        if (k <= 0) { group.remove(o.m); live.splice(i, 1); }
        else if (k < 1) { const q = Math.max(1, Math.round(opacity * k * 8)) / 8; if (o.q !== q) { o.q = q; o.m.material = tex.decalMaterial(id, { opacity: q, layer: 2 }); } }
      }
    },
    clear() { for (const o of live) group.remove(o.m); live.length = 0; for (const k of Object.keys(st)) delete st[k]; },
    get count() { return live.length; },
  };
}
