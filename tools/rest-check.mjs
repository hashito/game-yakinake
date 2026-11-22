// P47 / P48 (standard 1.28.0, 夜勤明けの街 play test 2026-11-22: 「空中にものが浮いています（ラジオや紙）」「モノの大きさがおかしい場合があります。
// 自分の体のサイズに合わせてサイズを考え直してください」). Page code for tools/check-playtest.mjs (and a game's own probes).
//
// restSource(): every placed thing rests on something. A "placed thing" is a top-level object of the world (a child of the world group or
//   the scene: a prop, a dot part, a pickup, a station's look) that is drawn, smaller than 3 m in two directions (not the room shell), and
//   whose bottom is above its floor by more than 3 cm. It rests when, from 5 points of its underside (the middle and four corners at 30 %),
//   one ray down meets another drawn thing within `gap` (4 cm); or it is a wall thing (thin: 15 cm or less front to back, or
//   userData.wall / hangs) with a wall or another thing within `gap` behind it; or it hangs from the ceiling (something within `gap` above).
//   A thick thing standing against a wall in the air (a radio at 1 m with no shelf under it) does not rest: that was the floating radio.
//   -> [{ name, at: [x, y, z], size: [x, y, z], above: m | null (the gap to what is under it; null = nothing within 2.5 m), against }]
//   userData.hangs / floats = true on an object (or a parent) leaves it out (a lamp on a wire, a bird, a helicopter in the air).
//   1.29.2 (鏡屋): a thing in the player's hands is left out too - userData.held, or within 0.7 m of the camera (the camera the player
//   carries hung in the scene at hip height was reported floating 1.1 m over the floor).
//
// sizeSource(rules): things of a known kind have a believable size for a body with eyes at 1.6 m. Each rule is
//   [regex on the object's name (or "prop:" + the plan furniture kind for prop:<id>), measure, min, max] with measure 'h' (height), 'top'
//   (the height of its top above its floor), 'surf' (its working surface: the median of nine rays down onto it, so a monitor on a desk or a
//   bed's headboard does not count), 'len' (the longest side across the floor) or 'max' (the longest side).
//   The default rules (SIZE_RULES) cover doors, desks, counters, tables, shelves, beds, lockers, cars, crates, phones, radios, papers,
//   medkits and guns; a game passes its own names with extraRules. Also the eye height (ctx.eyeY - floor) against 1.5-1.72 m and the door
//   height (the kit's door boxes) against 1.9-2.25 m.  -> [{ name, kind, measure, value, min, max, at }]
export const SHELL = '^(wall|floor|ceil|door|doorlook|stair|lamp|lamppool|world|hidelook|frame:|house-frame|kg-frame|kg-ceiling|dot-night-sky|dot-lamp-pool|dot-road-paint|dot-helipad|dot-goal|dot-near|dot-floor|dot-street-lamp|zombie|person|npc|gf-|plan-|room-mark|mark|guide)';

export function restSource(o = {}) {
  const shell = o.shell || SHELL, gap = o.gap ?? 0.04, thin = o.thin ?? 0.15;
  return `(() => {
    const g = window.__game, T = g && (g.THREE || window.THREE); if (!g || !T) return { error: 'no game' };
    const W = g.world, SH = new RegExp(${JSON.stringify(shell)}), GAP = ${gap}, THIN = ${thin};
    g.scene.updateMatrixWorld(true);
    const shown = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
    const drawn = (m) => { const mt = [].concat(m.material || [])[0]; return !!mt && mt.visible !== false && mt.colorWrite !== false && !(mt.transparent && mt.opacity < 0.05); };
    const flag = (o, k) => { for (let q = o; q; q = q.parent) if (q.userData && q.userData[k]) return true; return false; };
    // everything drawn (the targets of the rays), with its top-level object
    const all = [];
    const topOf = (o) => { let q = o; while (q.parent && q.parent !== W.group && q.parent !== g.scene) q = q.parent; return q; };
    g.scene.traverse((m) => { if ((m.isMesh || m.isInstancedMesh) && shown(m) && drawn(m) && !/^(zombie|person|npc)/.test(topOf(m).name || '')) all.push(m); });
    const floorYs = [...new Set(((g.data.plan && g.data.plan.rooms) || []).map((r) => (W.floorY ? W.floorY(r.floor || 0) : 0)))].sort((a, b) => a - b); if (!floorYs.length) floorYs.push(0);
    const floorUnder = (y) => { let f = floorYs[0]; for (const v of floorYs) if (v <= y + 0.05) f = v; return f; };
    const tops = new Map(); for (const m of all) { const t = topOf(m); if (!tops.has(t)) tops.set(t, []); tops.get(t).push(m); }
    const rc = new T.Raycaster(), out = [];
    const hitDist = (from, dir, far, own) => { rc.set(from, dir); rc.far = far; const hs = rc.intersectObjects(cands, false); for (const h of hs) if (!own.has(h.object)) return h.distance; return null; };
    let cands = all;
    for (const [t, ms] of tops) {
      const nm = t.name || ''; if (SH.test(nm) || flag(t, 'hangs') || flag(t, 'floats') || t.isLight || t.isCamera) continue;
      const b = new T.Box3(); for (const m of ms) b.expandByObject(m); if (b.isEmpty()) continue;
      const s = b.getSize(new T.Vector3()); if ([s.x, s.y, s.z].filter((v) => v > 3).length >= 2 || Math.max(s.x, s.y, s.z) < 0.02) continue;
      if (flag(t, 'held') || (g.camera && b.distanceToPoint(g.camera.getWorldPosition(new T.Vector3())) < 0.7)) continue;   // in the hands (1.29.4)
      const fy = floorUnder(b.min.y); if (b.min.y - fy < 0.03) continue;
      const own = new Set(ms), c = b.getCenter(new T.Vector3());
      // the candidates near this thing only (a box round it, 2.5 m down), so the rays stay cheap
      const zone = new T.Box3(new T.Vector3(b.min.x - 0.3, b.min.y - 2.5, b.min.z - 0.3), new T.Vector3(b.max.x + 0.3, b.max.y + 0.3, b.max.z + 0.3));
      cands = all.filter((m) => !own.has(m) && new T.Box3().setFromObject(m).intersectsBox(zone));
      let under = null;
      for (const [fx, fz] of [[0, 0], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        const d = hitDist(new T.Vector3(c.x + fx * s.x, b.min.y + 0.01, c.z + fz * s.z), new T.Vector3(0, -1, 0), 2.5, own);
        if (d != null) under = under == null ? d - 0.01 : Math.min(under, d - 0.01);
      }
      if (under != null && under <= GAP) continue;
      if (b.min.y - fy - 0.01 <= GAP && under == null) continue;
      // a wall thing: thin from front to back, or flagged
      const wallish = Math.min(s.x, s.z) <= THIN || flag(t, 'wall');
      let against = null;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const half = dx ? s.x / 2 : s.z / 2, d = hitDist(c.clone(), new T.Vector3(dx, 0, dz), half + GAP + 0.01, own); if (d != null && d <= half + GAP + 0.01) { against = (dx ? (dx > 0 ? '+x' : '-x') : (dz > 0 ? '+z' : '-z')); break; } }
      if (against && wallish) continue;
      const above = hitDist(new T.Vector3(c.x, b.max.y - 0.01, c.z), new T.Vector3(0, 1, 0), GAP + 0.02, own); if (above != null) continue;   // hangs from the ceiling
      out.push({ name: nm || (ms[0].name || ms[0].geometry.type), at: [c.x, b.min.y, c.z].map((v) => +v.toFixed(2)), size: [s.x, s.y, s.z].map((v) => +v.toFixed(2)), above: under == null ? null : +(under).toFixed(2), floorGap: +(b.min.y - fy).toFixed(2), against });
    }
    return out;
  })()`;
}

// [regex, measure, min, max]: real sizes for a body with eyes at 1.6 m (a 1.7 m adult). Names: plan furniture kinds, kit props, the dot parts.
export const SIZE_RULES = [
  ['desk|steel-?desk', 'surf', 0.66, 0.8],
  ['counter', 'surf', 0.82, 1.05],
  ['table', 'surf', 0.4, 0.8],
  ['shelf|shop-shelf|bookshelf', 'h', 1.1, 2.3],
  ['bed', 'len', 1.8, 2.25],
  ['bed', 'surf', 0.38, 0.75],
  ['locker|filing-?cabinet', 'h', 1.0, 2.1],
  ['car|car-[a-z-]+|police-car', 'len', 3.6, 5.4],
  ['car|car-[a-z-]+|police-car', 'h', 1.25, 1.95],
  ['ambulance', 'len', 4.5, 6.5],
  ['bus|bus-side', 'len', 8, 12.5],
  ['crate|cardboard-?box', 'max', 0.3, 1.3],
  ['vending|vending-?machine', 'h', 1.6, 2.0],
  ['fridge', 'h', 1.4, 2.0],
  ['bench|sofa', 'h', 0.38, 1.0],
  ['wheelchair', 'h', 0.8, 1.1],
  ['gurney', 'len', 1.7, 2.2],
  ['street-lamp', 'h', 3.5, 8],
  ['phone|telephone', 'max', 0.08, 0.3],
  ['radio', 'max', 0.15, 0.5],
  ['paper|doc|note|memo|letter', 'max', 0.12, 0.45],
  ['medkit|aidkit|first-?aid', 'max', 0.18, 0.5],
  ['pistol|handgun', 'max', 0.14, 0.32],
  ['shotgun|rifle', 'max', 0.85, 1.35],
  ['ammo|ammo-[a-z0-9]+', 'max', 0.05, 0.3],
  ['toolbox', 'max', 0.3, 0.7],
  ['crash-cart', 'h', 0.8, 1.2],
  ['safe', 'h', 0.3, 1.6],
].map(([k, m, a, b]) => ['(^|[:/])(' + k + ')(?![A-Za-z0-9_-])', m, a, b]);   // the whole kind after "prop:" / "dot-stack:" ...: "rifle" is not "ammo-rifle", "shelf" not "collapsed-shelf"

export function sizeSource(o = {}) {
  const rules = [...(o.extraRules || []), ...(o.rules || SIZE_RULES)];
  return `(() => {
    const g = window.__game, T = g && (g.THREE || window.THREE); if (!g || !T) return { error: 'no game' };
    const W = g.world, RULES = ${JSON.stringify(rules)}.map(([r, m, a, b]) => [new RegExp(r, 'i'), m, a, b]);
    g.scene.updateMatrixWorld(true);
    const shown = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
    const drawn = (m) => { const mt = [].concat(m.material || [])[0]; return !!mt && mt.visible !== false && mt.colorWrite !== false; };
    const kinds = new Map(((g.data.plan && g.data.plan.furniture) || []).map((f) => ['prop:' + f.id, f.kind]));
    const floorYs = [...new Set(((g.data.plan && g.data.plan.rooms) || []).map((r) => (W.floorY ? W.floorY(r.floor || 0) : 0)))].sort((a, b) => a - b); if (!floorYs.length) floorYs.push(0);
    const floorUnder = (y) => { let f = floorYs[0]; for (const v of floorYs) if (v <= y + 0.05) f = v; return f; };
    const out = [], seen = new Set();
    // surf: the working surface - the median height of nine rays down onto the thing itself (a monitor on a desk, a bed's headboard do not count)
    const rc = new T.Raycaster(), surf = (o, b) => { const s = b.getSize(new T.Vector3()), hs = [], ms = []; o.traverse((m) => { if (m.isMesh && shown(m) && drawn(m)) ms.push(m); });
      for (const fx of [0.2, 0.5, 0.8]) for (const fz of [0.2, 0.5, 0.8]) { rc.set(new T.Vector3(b.min.x + s.x * fx, b.max.y + 0.1, b.min.z + s.z * fz), new T.Vector3(0, -1, 0)); rc.far = s.y + 0.2; const h = rc.intersectObjects(ms, false)[0]; if (h) hs.push(h.point.y); }
      hs.sort((a, c) => a - c); return hs.length ? hs[Math.floor(hs.length / 2)] - floorUnder(b.min.y) : b.max.y - floorUnder(b.min.y); };
    const measure = (b, m, o) => { const s = b.getSize(new T.Vector3()); return m === 'h' ? s.y : m === 'top' ? b.max.y - floorUnder(b.min.y) : m === 'surf' ? surf(o, b) : m === 'len' ? Math.max(s.x, s.z) : Math.max(s.x, s.y, s.z); };
    const check = (o, label) => {
      if (seen.has(o) || !shown(o)) return; seen.add(o);
      const b = new T.Box3(); o.traverse((m) => { if ((m.isMesh || m.isInstancedMesh) && shown(m) && drawn(m)) b.expandByObject(m); }); if (b.isEmpty()) return;
      for (const [re, m, lo, hi] of RULES) { if (!re.test(label)) continue; const v = measure(b, m, o); if (v < lo - 0.005 || v > hi + 0.005) out.push({ name: o.name || label, kind: label, measure: m, value: +v.toFixed(2), min: lo, max: hi, at: b.getCenter(new T.Vector3()).toArray().map((x) => +x.toFixed(1)) }); }
    };
    // the dot parts and props name their kind (dot-stack:desk, dot-part:radio, prop:F_X -> the plan's kind, loot-model:pistol ...)
    W.group.traverse((o) => {
      const n = o.name || ''; if (!n || /^(wall|floor|ceil|door|stair|lamp)/.test(n)) return;
      const k = kinds.get(n); if (k) { check(o, 'prop:' + k); return; }
      if (/^(dot-stack|dot-part|loot-model|stlook|item|doc|prop|station)[:]/.test(n) && RULES.some(([re]) => re.test(n))) check(o, n);
    });
    // the body: eyes at 1.5-1.72 m; the doors 1.9-2.25 m
    if (g.eyeY) { const e = g.eyeY(0) - (W.floorY ? W.floorY(0) : 0); if (e < 1.5 || e > 1.72) out.push({ name: 'eye height', kind: 'body', measure: 'h', value: +e.toFixed(2), min: 1.5, max: 1.72, at: [] }); }
    const dh = new Set(); for (const [, d] of W.doors || new Map()) if (d.col && d.col.box) dh.add(+(d.col.box.max.y - d.col.box.min.y).toFixed(2));
    for (const h of dh) if (h < 1.9 || h > 2.25) out.push({ name: 'door', kind: 'door', measure: 'h', value: h, min: 1.9, max: 2.25, at: [] });
    return out;
  })()`;
}
