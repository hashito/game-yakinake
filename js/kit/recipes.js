/* game-kit f33d12c8: js/recipes.js — edit in game-kit and run tools/kit-sync.js */
// The recipes of the standard, switched on from game.json "recipes" (standard 1.5; pure side + docs in js/recipes-data.js):
//   props       plan.furniture[] { kind, x, z, rot, args, opts } -> js/props.js / js/env-props.js objects in the world, with colliders
//   openables   props with userData.drawers (lockers, fridges, cabinets): [E] opens / closes, the state is saved (ext.openables)
//   textures    js/texture-library.js: plan.rooms[].floorTex / wallTex dress the floors and walls (or the room type's, js/room-types.js)
//   (1.7) a room with a `type` also gets furniture against its free walls (autoFurniture) unless "furnish": false
//   buildings   js/building.js: plan.buildings[] (houses with roofs that never come into the rooms, trees, forests kept off rooms and houses)
//   ambience    js/ambience.js: outdoor beds that go quiet and muffled behind doors (model from the plan), started with the first sound
// game-core imports this module only when game.json has "recipes" (loadGame), kit-sync copies what each switch needs (tools/kit-features.cjs).
import { PROP_KINDS, furnitureOf, ambienceModelFromPlan } from './recipes-data.js';
import { autoFurniture, roomLook } from './room-types.js';

/** what a furniture entry builds from (a baked box is used only while this is the same) */
export function propSig(f) {
  const t = JSON.stringify([f.kind, f.args || null, f.w ?? null, f.d ?? null, f.opts || null]);
  let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
/** tools/bake-prop-boxes.mjs: every prop's local box and colliders, measured from the real build (?bakeprops) */
export function measureProps(ctx, localBox) {
  const plan = ctx.data.plan, out = {};
  const all = [...furnitureOf(plan), ...autoFurniture(plan)];
  for (const f of all) {
    const obj = ctx.recipes && ctx.recipes.props.get(f.id); if (!obj || obj.userData.stub) continue;
    if ((obj.userData.drawers || []).length) continue;   // a prop that opens keeps its parts
    // the box Box3.setFromObject sees (every mesh, decorations included) and the colliders propColliders makes (localBox skips noCollide)
    obj.updateMatrixWorld(true);
    const inv = obj.matrixWorld.clone().invert(), b = localBox(obj).makeEmpty();
    obj.traverse((o) => { if (!o.isMesh) return; if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); b.union(o.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(o.matrixWorld))); });
    const cols = obj.userData.colliders && obj.userData.colliders.length ? obj.userData.colliders : [localBox(obj)];
    if (b.isEmpty()) continue;
    const r = (v) => Math.round(v * 1e6) / 1e6, bx = (x) => [x.min.x, x.min.y, x.min.z, x.max.x, x.max.y, x.max.z].map(r);
    out[f.id] = { s: propSig(f), box: bx(b), cols: cols.filter((c) => !c.isEmpty()).map(bx), kind: obj.userData.kind || undefined };
  }
  return out;
}

export async function installRecipes(ctx, cfg = {}) {
  const mods = {};   // the parts are imported only for the switches that are on
  if (cfg.props || cfg.openables) { mods.P = await import('./props.js'); mods.E = await import('./env-props.js'); mods.propColliders = (await import('./prop-batch.js')).propColliders; }
  if (cfg.openables) mods.Openables = (await import('./openables.js')).Openables;
  if (cfg.textures) mods.TextureLibrary = (await import('./texture-library.js')).TextureLibrary;
  if (cfg.ambience) mods.Ambience = (await import('./ambience.js')).Ambience;
  const { P, E, propColliders } = mods;
  const { world, bus, ext } = ctx;
  const plan = ctx.data.plan;
  const api = { props: new Map() };
  ctx.recipes = api;

  // ---- props ----
  if (cfg.props || cfg.openables) {
    const T = {};
    let op = null;
    // 1.34.0 (夜勤明けの街 1.3.2: a dot build hides most of these props behind its own sprite-stack parts, yet building them all was 4.5 s of
    // the title at CPU 4x): a prop the game stubs (ctx.recipeStub(f) -> true) and that tools/bake-prop-boxes.mjs measured (data/prop-boxes.json)
    // is only its boxes: an invisible box of its size (for Box3.setFromObject) with its colliders, no geometry, no textures
    const Q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
    let boxes = null;
    if (cfg.props && typeof ctx.recipeStub === 'function' && !Q.has('bakeprops')) {
      try { const r = await fetch(new URL(typeof cfg.props === 'object' && cfg.props.boxes ? cfg.props.boxes : 'data/prop-boxes.json', location.href).href); boxes = r.ok ? (await r.json()).items || null : null; } catch { boxes = null; }
    }
    const THREE_ = boxes ? await import('three') : null;
    let unit = null, hidden = null;
    const stubOf = (f) => {
      const b = boxes && boxes[f.id];
      if (!b || b.s !== propSig(f) || !ctx.recipeStub(f)) return null;
      const T3 = THREE_, g = new T3.Group();
      unit = unit || new T3.BoxGeometry(1, 1, 1); hidden = hidden || new T3.MeshBasicMaterial({ visible: false });
      const box = new T3.Box3(new T3.Vector3(b.box[0], b.box[1], b.box[2]), new T3.Vector3(b.box[3], b.box[4], b.box[5]));
      const m = new T3.Mesh(unit, hidden); box.getCenter(m.position); box.getSize(m.scale); m.userData.noCollide = true; m.name = 'prop-stub'; g.add(m);
      g.userData.colliders = (b.cols || []).map((c) => new T3.Box3(new T3.Vector3(c[0], c[1], c[2]), new T3.Vector3(c[3], c[4], c[5])));
      if (b.kind) g.userData.kind = b.kind;
      g.userData.stub = true;
      return g;
    };
    api.stubbed = 0;
    if (cfg.openables && mods.Openables) op = api.openables = ctx.openables = new mods.Openables({ onChange: (id, open) => { const o = api.props.get(id); const pos = o && o.position; ctx.audio && ctx.audio.at && ctx.sound && ctx.audio.at(pos).lockerDoor && ctx.audio.at(pos).lockerDoor(pos, open); bus.emit('openable:change', { id, open }); } });
    for (const f of [...furnitureOf(plan), ...(cfg.props ? autoFurniture(plan) : [])]) {
      const k = PROP_KINDS[f.kind];
      if (!k) { console.warn(`recipes.props: unknown kind "${f.kind}" (${f.id})`); continue; }
      const fn = (k.from === 'P' ? P : E)[f.kind];
      if (typeof fn !== 'function') continue;
      let obj = stubOf(f);
      if (obj) { api.stubbed++; obj.name = `prop:${f.id}`; obj.rotation.y = ((f.rot || 0) * Math.PI) / 180; world.place(obj, f.room, f.x, f.z); api.props.set(f.id, obj); world.colliders.push(...propColliders(obj)); continue; }
      try { obj = k.from === 'P' ? (k.t ? fn(T, ...(f.args || [])) : fn(...(f.args || []))) : fn({ w: f.w, d: f.d, ...(f.opts || {}) }); } catch (e) { console.warn(`recipes.props: ${f.id} (${f.kind}): ${e.message}`); continue; }
      obj.name = `prop:${f.id}`;
      obj.rotation.y = ((f.rot || 0) * Math.PI) / 180;
      world.place(obj, f.room, f.x, f.z);
      api.props.set(f.id, obj);
      if (cfg.props) world.colliders.push(...propColliders(obj));
      const parts = (obj.userData && obj.userData.drawers) || [];
      if (op && parts.length === 1) {
        try { op.add(f.id, obj); obj.userData.interact = { kind: 'openable', id: f.id }; world.interactables.push(obj); } catch { /* nothing opens */ }
      } else if (op && parts.length > 1) {
        // a tansu / a cabinet with two doors: each drawer or door is its own openable (<id>:<n>), the one you look at opens (2026-11-01)
        parts.forEach((p, i) => { try { const id = `${f.id}:${i}`; op.add(id, [p]); p.obj.userData.interact = { kind: 'openable', id }; world.interactables.push(p.obj); api.props.set(id, obj); } catch { /* nothing opens */ } });
      }
    }
    if (op) {
      ext.registerInteract('openable', { prompt: (o) => (op.isOpen(o.id) ? '[E] 閉める' : '[E] 開ける'), run: (o) => { const r = op.toggle(o.id); if (typeof r === 'string') ctx.ui.say(r); } });
      ext.registerPersist('openables', { serialize: () => op.state(), restore: (j) => op.restore(j || {}) });
      ctx.systems.push({ id: 'openables', def: { update: (dt) => op.update(dt) }, inst: null });
    }
  }

  // ---- textures ----
  if (cfg.textures && mods.TextureLibrary) {
    const base = typeof cfg.textures === 'string' ? cfg.textures : 'assets/textures/';
    try {
      const tex = api.textures = ctx.textures = await mods.TextureLibrary.load(base, { renderer: ctx.renderer });
      const has = (id) => { try { return !!tex.entry(id); } catch { return false; } };   // a texture the game did not copy is skipped (the others still apply)
      for (const r of plan.rooms || []) {
        const L = roomLook(r);
        if (L.floorTex && has(L.floorTex)) for (const m of world.group.children) { if (m.name === `floor:${r.id}`) m.material = tex.material(L.floorTex, { size: [r.w, r.d] }); else if (m.name === `floor:${r.id}:part`) { const g = m.geometry.parameters; m.material = tex.material(L.floorTex, { size: [g.width, g.depth] }); } }   // :part = the floor round a stairwell (1.10)
        if (L.wallTex && has(L.wallTex) && r.kind !== 'outdoor') world.group.traverse((o) => { if ((o.name && o.name.startsWith(`wall:${r.id}:`)) || (o.userData.lintel && o.userData.lintel.room === r.id)) o.material = tex.material(L.wallTex, { triplanar: true }); });   // the lintel above a door too (jashi 5.0: it stayed the plain palette colour)
      }
    } catch (e) { console.warn(`recipes.textures: ${e.message}`); }
  }

  // ---- buildings (2026-11-01): plan.buildings[] -> js/building.js houses / trees / forests with colliders ----
  //   { id, kind: 'house', room?, x, z, rot, w, d, wallH, roof: { type, pitch, overhang }, doors, windows, tex: { wall, roof, floor, ceiling } }
  //   { id, kind: 'forest', area: { minX, maxX, minZ, maxZ }, n, seed, kinds, keepOut?: [...] }   (indoor rooms and houses are kept out on their own)
  //   { id, kind: 'tree', x, z, h, treeKind }
  if (cfg.buildings) {
    const Bm = await import('./building.js'), { propColliders: pc } = await import('./prop-batch.js');
    const tex = api.textures || ctx.textures, T = (id) => { try { return id && tex ? tex.material(id, { triplanar: true }) : null; } catch { return null; } };
    const rect = (b) => { const r = ((b.rot || 0) % 180) ? [b.d, b.w] : [b.w, b.d]; return { minX: b.x - r[0] / 2, maxX: b.x + r[0] / 2, minZ: b.z - r[1] / 2, maxZ: b.z + r[1] / 2 }; };
    const list = plan.buildings || [], houses = list.filter((b) => (b.kind || 'house') === 'house');
    const indoor = (plan.rooms || []).filter((r) => r.kind !== 'outdoor').map((r) => ({ minX: r.x, maxX: r.x + r.w, minZ: r.z, maxZ: r.z + r.d }));
    api.buildings = new Map();
    for (const b of list) {
      const kind = b.kind || 'house', tx = b.tex || {};
      const mats = { wall: T(tx.wall), roof: T(tx.roof), floor: T(tx.floor), ceiling: T(tx.ceiling), bark: T(tx.bark), bough: T(tx.bough) };
      let obj;
      try {
        if (kind === 'forest') obj = Bm.forest({ ...b, keepOut: [...indoor, ...houses.map(rect), ...(b.keepOut || [])], mats });
        else if (kind === 'tree') { obj = Bm.tree({ ...b, kind: b.treeKind || 'cedar', keepOut: [...indoor, ...houses.map(rect)].map((r) => ({ minX: r.minX - b.x, maxX: r.maxX - b.x, minZ: r.minZ - b.z, maxZ: r.maxZ - b.z })), mats }); obj.position.set(b.x, 0, b.z); }
        else if (kind === 'gate') { obj = Bm.gate({ ...b, mats: { post: T(tx.post), leaf: T(tx.leaf), roof: mats.roof } }); obj.position.set(b.x, 0, b.z); obj.rotation.y = ((b.rot || 0) * Math.PI) / 180; }
        else { obj = Bm.house({ ...b, mats }); obj.position.set(b.x, 0, b.z); obj.rotation.y = ((b.rot || 0) * Math.PI) / 180; }
      } catch (e) { console.warn(`recipes.buildings: ${b.id} (${kind}): ${e.message}`); continue; }
      obj.name = `building:${b.id}`;
      const R = b.room && world.rooms && world.rooms.get && world.rooms.get(b.room); if (R) obj.position.y += R.y || 0;
      world.group.add(obj); api.buildings.set(b.id, obj);
      world.colliders.push(...pc(obj, { tag: kind }));
    }
  }

  // ---- ambience ----
  if (cfg.ambience && mods.Ambience) {
    const amb = api.ambience = ctx.ambience = new mods.Ambience(null, { volume: 1 });
    for (const b of cfg.ambience.beds || []) amb.addBed(b.name, { ...b });
    amb.setModel(ambienceModelFromPlan(plan, (id) => { const d = world.doors && world.doors.get(id); return d ? (d.isOpen ? 1 : 0) : 0; }));
    ctx.systems.push({ id: 'ambience', def: { update: (dt) => { if (!amb.ctx && ctx.audio && ctx.audio.ctx) amb.attach(ctx.audio.ctx, ctx.audio.master); amb.setMuted(ctx.settings.volume <= 0); amb.update(dt, { x: ctx.camera.position.x, y: ctx.camera.position.y, z: ctx.camera.position.z }); } }, inst: null });
  }
  return api;
}
