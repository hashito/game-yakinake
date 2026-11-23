// 夜勤明けの街: the dot look of the whole world (this game has no other version). After js/ext/index.js (game.json "ext").
//   - the plan's furniture, the cars and the bus of the streets, the boxes the weapons come out of and the mood props are library
//     sprite stacks (assets/stacks, tools/dot/stacks.py; the vehicles and boxes are the kit's yakinake-* parts of helper YK);
//     the colliders and the picking boxes of the game do not change
//   - the walls, floors and ceilings are graded to one palette (kit js/dot-world.js dotifyScene), the photos are pixel art (photos.js)
//   - one palette for the whole night, its hues by block: cold hospital teal, sodium orange, police blue, office white, dawn rose
//   - the dark stays readable: a floor of light that never reaches black, a small light round the player, the next goal glows
import * as THREE from 'three';
import { buildStackGeometry, loadPixels, stripVolume, loadBakedQuads, quadsToGeometry } from '../kit/sprite-stack-mesh.js';
import { palette, dotifyScene } from '../kit/dot-world.js';
import { installPhotoHooks, preparePhotos, loadBakedPhotos } from './photos.js';
import { autoFurniture } from '../kit/room-types.js';

const AT = (p) => new URL(`../../${p}`, import.meta.url).href;
export const YK_PALETTE = [
  '#05070a', '#0b1014', '#121a1e', '#1b2629', '#26363a', '#35494c', '#4a6264', '#668080', '#8aa3a0', '#b4c8c2', '#dde8e2', '#f6faf6',   // hospital teal / tile
  '#1a1208', '#2e1f0e', '#4a3214', '#70491a', '#a0661e', '#d08a2a', '#f0aa48', '#ffd890',                                                // sodium street
  '#0c1226', '#18223e', '#2a3a62', '#46609a', '#7a96d0',                                                                                 // police blue
  '#2a2826', '#4a4642', '#76706a', '#a8a29a', '#e2ad8c', '#b8866a', '#8a5e48',                                                           // concrete, skin
  '#3a0a0a', '#6e1414', '#a8221e', '#e04a34',                                                                                            // blood, alarm red
  '#3a2a36', '#6a4a58', '#b07a80', '#f0b8a0',                                                                                            // dawn
  '#2a3a24', '#4e6a3a',                                                                                                                  // moss, olive
];
// furniture kind -> stack; furniture id -> stack where one piece wants its own part (the cars of the street)
const FURN = { bench: 'bench', locker: 'locker', desk: 'desk', steelDesk: 'steel-desk', counter: 'counter', shelf: 'shelf', bed: 'bed', drum: 'drum',
  crate: 'crate', pallet: 'pallet', bodyCabinets: 'body-cabinets', vendingMachine: 'vending', fridge: 'fridge', table: 'table', tank: 'generator', cabinet: 'server', car: 'car-stalled',
  filingCabinet: 'locker', cardboardBox: 'crate' };
const FURN_ID = { F_CAR1: 'car-doors-open', F_CAR2: 'car-stalled-red', F_AMBU: 'ambulance', F_CAR3: 'car-stalled', F_CAR4: 'car-burnt', F_CAR5: 'car-doors-open',
  F_CAR6: 'car-stalled-red', F_BUS: 'bus-side', F_SHOTEN_CAR: 'car-burnt', F_HIRO_CAR: 'police-car', F_P_CAR: 'police-car', F_P_CAR2: 'police-car', F_PL_CAR: 'car-stalled',
  F_MART_S1: 'shop-shelf', F_MART_S2: 'shop-shelf', F_YAMA_S1: 'shop-shelf', F_TOU_SOFA: 'sofa',
  // 1.4.0 (#10 the street is one way; #5 #14 the mart and the 公民館): barricades and wrecks that close the wide parts, a shelf
  // pulled down across the food court door, the stock of the mart and the shrine. 1.5.0 (play test 2026-11-23 「ボードみたいなもの…車やもので
  // 塞いでください」): no board barricade is left - heaps of furniture, a pile of tyres, the rope of the shrine's approach, wheelie bins
  F_URA_BAR1: 'junk-pile', F_URA_BAR2: 'sandbags', F_OD_BAR1: 'sandbags', F_OD_BAR2: 'tire-pile', F_OD_CAR7: 'car-burnt', F_SH_BAR1: 'junk-pile', F_SH_BAR2: 'sandbags',
  F_HI_BAR: 'sandbags', F_MART_BAR: 'junk-pile', F_MFOOD_SH: 'collapsed-shelf', F_MBACK_C: 'crate', F_MCOLD_S: 'shelf', F_YAMAURA_S: 'shop-shelf' };
// the stations' own things (the box the weapon comes out of, the safe, the radio): a part standing at the station
const STATION_PART = { S_CART: 'crash-cart', S_TOOL: 'toolbox', S_SAFE: 'safe', S_RADIO: 'radio', S_BREAKER: 'breaker', S_BOARD: 'switchboard', S_TAPE: 'tape-deck',
  S_RACK: { k: 'gun-rack-full', after: [['T_RACK', () => (window.__yk && window.__yk.flags.rack === 'all' ? 'gun-rack-empty' : 'gun-rack-half')]] }, S_RIFLE: 'rifle-case',
  S_NOTE: 'desk', S_MDESK: 'steel-desk', S_DRUGS: 'shelf', S_FCASE: 'toolbox', S_CAGE: 'locker', S_PACK: 'shop-shelf', S_AXE: 'locker', S_ROPE: 'rope-fence',
  S_GEN: 'generator', S_RECORD: 'desk', S_EVID: 'locker', S_SERVER: 'server' };
// stations whose thing is already there without a part: a person (their figure), a door or a lock (the door), the helipad (its Ｈ)
const STATION_BARE = ['S_CHISATO', 'S_GENZO', 'S_GONDO', 'S_NISHINA', 'S_TAEKO', 'S_MIYAKE', 'S_SHIRA', 'S_KATA', 'S_NOGUCHI', 'S_HAYASE', 'S_HELI', 'S_ODOOR', 'S_FORCE', 'S_ARMORY', 'S_MARTLOCK', 'S_SHUTTER'];
// how a station's thing stands: y (above the floor), back (toward the wall), seat (put down on the furniture under it, 1.2.0 #1: the radio,
// the tape deck and the rifle case floated at a fixed height), size (its longest side in metres, 1.2.0 #3)
const STATION_MOUNT = { S_TOOL: { y: 0, back: 0.2 }, S_RADIO: { back: 0.22, seat: true, size: 0.36 }, S_BREAKER: { y: 0, back: 0.02 }, S_TAPE: { back: 0.5, seat: true, size: 0.3 },
  S_RIFLE: { back: 0.05, seat: true, size: 1.2 }, S_SAFE: { back: 0.1 } };
// 1.2.0 (play test #3 「自分の体のサイズに合わせて」): the real sizes for a body with eyes at 1.6 m. surf = the height of the working surface
// (nat = where the part's own surface is, measured from its voxels: the desk's monitor stands above it), h = the whole height, len = a vehicle's length
const REAL = { desk: { surf: 0.74, nat: 0.75 }, 'steel-desk': { surf: 0.74, nat: 0.75 }, counter: { surf: 0.92, nat: 0.73 }, table: { surf: 0.72, nat: 0.75 },
  bed: { surf: 0.55, nat: 0.43 }, shelf: { h: 1.8 }, 'shop-shelf': { h: 1.55 }, locker: { h: 1.8 }, vending: { h: 1.8 }, fridge: { h: 1.75 }, server: { h: 1.9 },
  crate: { h: 0.6 }, bench: { h: 0.8 }, 'street-lamp': { h: 4.2 }, 'body-cabinets': { h: 1.9 },
  'car-stalled': { h: 1.45, len: 4.4 }, 'car-stalled-red': { h: 1.45, len: 4.4 }, 'car-burnt': { h: 1.35, len: 4.4 }, 'car-doors-open': { h: 1.45, len: 4.4 },
  'police-car': { h: 1.5, len: 4.6 }, 'junk-pile': { h: 1.5 }, 'tire-pile': { h: 0.95 }, 'rope-fence': { h: 0.9 }, bins: { h: 1.05 }, ambulance: { h: 2.3, len: 5.0 }, 'bus-side': { h: 2.5, len: 9.6 } };
// mood props: [room, k, x, z, face (rad), scale]
const PROPS = [
  ['H_ROKA', 'wheelchair', 7.5, 7.2, 0.6], ['H_ROKA', 'iv-fallen', 15.5, 5.6, 1.2], ['H_ROKA', 'gurney', 25.8, 6.8, 0], ['H_SHO', 'iv-fallen', 22, 4.2, 0.4],
  ['H_HAN', 'cone', 31.6, 2.2, 0], ['S_URA', 'cone', 40, 1.2, 0], ['S_URA', 'gurney', 44.2, 7.9, Math.PI / 2, 1, 'P_URA_GURNEY'], ['S_URA', 'street-lamp', 46.4, 0.6, Math.PI], ['S_URA', 'street-lamp', 34, 12.4, 0],
  ['S_ODORI', 'street-lamp', 50, 5.6, Math.PI], ['S_ODORI', 'street-lamp', 62, -3.6, 0], ['S_ODORI', 'street-lamp', 70, 5.6, Math.PI], ['S_ODORI', 'street-lamp', 56, -3.6, 0], ['S_SHOTEN', 'street-lamp', 65, 16.4, 0], ['O_PLAZA', 'street-lamp', 146, 23, 0], ['S_ODORI', 'cone', 68, 4.4, 0], ['S_ODORI', 'pole', 56, 5.6, 0],
  ['S_MART', 'bins', 62, 6.6, 0], ['S_SHOTEN', 'street-lamp', 54, 16.4, 0], ['S_SHOTEN', 'street-lamp', 76, 16.4, 0], ['S_SHOTEN', 'cone', 81.8, 17, 0],
  ['S_HIROBA', 'sandbags', 94, 10, Math.PI / 2], ['S_HIROBA', 'street-lamp', 84, 7, 0], ['S_HIROBA', 'cone', 87, 20, 0],
  ['P_LOBBY', 'sandbags', 96.2, 10, -Math.PI / 2], ['P_URA', 'street-lamp', 128.4, 11, -Math.PI / 2], ['O_PLAZA', 'street-lamp', 130, 23, 0], ['O_PLAZA', 'cone', 136, 16, 0],
  ['O_OFF', 'collapsed-shelf', 142.4, 8, 0],
];
// the loot lying in the world: the parts that exist for it
// 1.2.0 (#3 #4): every thing of the case has its part, at its real size (the longest side, m)
const LOOT_PART = { pistol: ['pistol', 0.2], shotgun: ['shotgun', 1.0], medkit: ['medkit', 0.34], aidkit: ['medkit', 0.24], p9: ['ammo-9mm', 0.12], shell: ['ammo-12g', 0.12],
  rifleAmmo: ['ammo-rifle', 0.11], water: ['water', 0.24], bandage: ['bandage', 0.11], nails: ['nails', 0.16], powder: ['powder', 0.13], disinfect: ['disinfect', 0.18],
  canned: ['canned', 0.1], casing: ['casing', 0.11] };

export default async function dotLayer(ext, { manifest, data }) {
  document.documentElement.dataset.dot = 'fps';
  installPhotoHooks();
  const D = window.__dot = { timings: {}, furniture: [], props: [], stations: [], loot: 0, surf: {}, seated: [] };
  const t0 = performance.now();
  const index = await fetch(AT('assets/stacks/index.json')).then((r) => r.json()).catch(() => ({}));
  // 1.3.1: the parts' faces are baked at build time (kit tools/bake-stacks.mjs -> assets/stacks/index.quads.bin): no 59 pictures to decode
  // and mesh on the phone before the title; the pictures are the fallback when the pack is missing or stale
  const baked = await loadBakedQuads(AT('assets/stacks/index.json'), 'index');
  const bakedAll = !!baked && Object.keys(index).every((k) => baked.has(k));
  D.timings.baked = bakedAll;
  const px = bakedAll ? {} : Object.fromEntries(await Promise.all(Object.keys(index).map(async (k) => [k, await loadPixels(AT(`assets/stacks/${k}.png`))])));
  D.timings.load = Math.round(performance.now() - t0);
  // 1.3.2: a prop this layer replaces with a part is built by the kit as its boxes only (kit 1.34.0 recipes: data/prop-boxes.json from
  // tools/bake-prop-boxes.mjs) - the full props were 4.5 s of the title at CPU 4x and were hidden here anyway
  ext.on('game:ready', (c) => { c.recipeStub = (f) => { const k = FURN_ID[f.id] || FURN[f.kind]; return !!(k && index[k]); }; });
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true }); mat.name = 'dot-stack';
  const geo = new Map();
  const cgeo = (k) => {
    if (!geo.has(k)) {
      const s = index[k], g = bakedAll ? quadsToGeometry(THREE, baked.get(k), { mpp: s.mpp }) : buildStackGeometry(THREE, stripVolume(px[k], s.w, s.d, s.n, 0), { mpp: s.mpp });
      g.computeBoundingBox(); const b = g.boundingBox, c = b.getCenter(new THREE.Vector3()); g.translate(-c.x, -b.min.y, -c.z); g.computeBoundingBox();
      geo.set(k, g);
    }
    return geo.get(k);
  };
  const part = (k, s = 1) => { const m = new THREE.Mesh(cgeo(k), mat); m.name = `dot-part:${k}`; m.scale.setScalar(s); m.castShadow = true; m.receiveShadow = true; return m; };
  // a part filling a box: its long side along the box's long side (of the two ways, the one nearer `face`), its height the real one (REAL).
  // 1.2.0 (#3): the cars came out 1.85 m long and 0.5 m high, the bus 4.6 m, the shelves 0.8 m (a rotated box swapped the axes twice)
  function fit(k, box, face = 0, o = {}) {
    const g = cgeo(k), gs = g.boundingBox.getSize(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const partLongX = gs.x >= gs.z, boxLongX = size.x >= size.z;
    let yaw = partLongX === boxLongX ? 0 : Math.PI / 2;
    if (Math.cos(face - yaw) < 0) yaw += Math.PI;
    const R = REAL[k] || {}, pl = Math.max(gs.x, gs.z), ps = Math.min(gs.x, gs.z), bl = Math.max(size.x, size.z), bs = Math.min(size.x, size.z);
    let sl = bl / pl, ss = bs / ps, sy;
    if (o.vehicle) { sl = ss = (R.len || bl) / pl; sy = R.h ? R.h / gs.y : sl; }
    else sy = R.surf ? R.surf / R.nat : R.h ? R.h / gs.y : Math.max(0.6, Math.min(1.6, Math.min(sl, ss)));
    const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true;
    m.scale.set(partLongX ? sl : ss, sy, partLongX ? ss : sl); m.rotation.y = yaw; m.position.set(c.x, box.min.y, c.z); m.name = `dot-stack:${k}`;
    return m;
  }
  // a part at its real size: REAL (height) or a longest side in metres
  const sized = (m, k, size) => { const gs = cgeo(k).boundingBox.getSize(new THREE.Vector3()), R = REAL[k];
    if (size) m.scale.setScalar(size / Math.max(gs.x, gs.y, gs.z)); else if (R && R.h) m.scale.y = R.h / gs.y; else if (R && R.surf) m.scale.y = R.surf / R.nat; return m; };

  // 1.3.0 (#10): the photos in dot are made with the first block (js/ext/blocks.js, the common pack), not behind the title
  ext.registerBoot('dot-title', async () => { D.bakedPhotos = await loadBakedPhotos(); await preparePhotos(['title.webp']); });   // 1.3.1: the baked pixel photos (no work), else the title art alone   // the title art alone behind the title
  let picturesP = null;
  // 1.3.1: one photo as a dot picture now (the loading card of a block shows its place before the rest of the photos are made)
  D.pixelPhoto = async (name) => { await preparePhotos([name]); return `assets/photos/${name}`; };
  D.preparePictures = (report = () => {}) => picturesP || (picturesP = (async () => {
    const t = performance.now();
    const names = [...new Set(JSON.stringify(data).match(/assets\/photos\/[\w.-]+\.webp/g) || [])].map((s) => s.slice(14));
    names.push(...['death.webp'].filter((n) => !names.includes(n)));
    D.photos = await preparePhotos(names, (k) => report(k, `ドット絵を準備中… ${Math.round(k * 100)}%`));
    D.timings.pictures = Math.round(performance.now() - t);
    return D.photos;
  })());

  // systems are registered before the game starts; the world's own update is filled in at game:ready
  let worldUpdate = null;
  ext.registerSystem('dot-world', { update(dt) { if (worldUpdate) worldUpdate(dt); } });
  const PAL = palette(YK_PALETTE);
  D.palette = PAL;
  ext.on('game:ready', (ctx) => {
    const t = performance.now(), W = ctx.world, scene = ctx.scene, plan = ctx.data.plan;
    const roomOf = (id) => plan.rooms.find((r) => r.id === id) || {};
    const fy = (room) => W.floorY(roomOf(room).floor || 0);
    // ---- the plan's furniture (the kit's recipes build it a moment after game:ready) ----
    const dress = (tries = 0) => {
      const ready = plan.furniture.some((f) => ctx.recipes && ctx.recipes.props && ctx.recipes.props.get(f.id));
      if (!ready && tries < 200) { setTimeout(() => dress(tries + 1), 50); return; }
      // the plan's own furniture and the room types' furnishing (auto_*: shelves, lockers, desks along the walls)
      for (const f of [...plan.furniture, ...autoFurniture(plan)]) {
        const obj = (ctx.recipes && ctx.recipes.props && ctx.recipes.props.get(f.id)) || W.group.getObjectByName(`prop:${f.id}`);
        const k = FURN_ID[f.id] || FURN[f.kind];
        if (!obj || !k || !index[k]) { D.furniture.push({ id: f.id, skipped: !obj ? 'no object' : 'no part' }); continue; }
        obj.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(obj); if (box.isEmpty()) continue;
        obj.traverse((x) => { if (x.isMesh) x.visible = false; });
        const vehicle = /car|bus|ambulance/.test(k);
        let face = ((f.rot || 0) * Math.PI) / 180, m;
        if (vehicle) {
          // a vehicle: its real length, turned the way the prop is turned, standing on the middle of the prop's box (the kit's car recipe is
          // one size for every vehicle, the bus too)
          const q = new THREE.Quaternion(); obj.getWorldQuaternion(q); const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
          face = Math.atan2(-ax.z, ax.x) + Math.PI / 2;   // the kit's car recipe runs along its local z
          const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
          m = fit(k, new THREE.Box3(new THREE.Vector3(cx - 1, box.min.y, cz - 0.5), new THREE.Vector3(cx + 1, box.max.y, cz + 0.5)), 0, { vehicle: true });
          const gs = cgeo(k).boundingBox.getSize(new THREE.Vector3()); m.rotation.y = face + (gs.x >= gs.z ? 0 : Math.PI / 2);
        } else m = fit(k, box, face);
        W.group.add(m);
        D.surf[f.id] = m;
        // what the body bumps into and what the pickups stand on follow the part: a desk's top at its working surface, a vehicle's footprint
        m.updateWorldMatrix(true, false);
        const vb = new THREE.Box3().setFromObject(m), cols = W.colliders.filter((cc) => cc.box && !cc.off && box.containsPoint(cc.box.getCenter(new THREE.Vector3())));
        for (const cc of cols) {
          if (vehicle) { cc.box.min.x = vb.min.x + 0.12; cc.box.max.x = vb.max.x - 0.12; cc.box.min.z = vb.min.z + 0.12; cc.box.max.z = vb.max.z - 0.12; cc.box.max.y = vb.max.y; }
          else if (REAL[k] && REAL[k].surf) cc.box.max.y = box.min.y + REAL[k].surf;
          else if (REAL[k] && REAL[k].h) cc.box.max.y = box.min.y + REAL[k].h;
        }
        D.furniture.push({ id: f.id, k });
      }
      if (ctx.pixelStyle) ctx.pixelStyle.sweep();
      D.timings.furniture = Math.round(performance.now() - t);
      D.dressed = true; setTimeout(() => settle(), 0);
    };
    dress();
    // ---- the stations' own things ----
    const swaps = [], seats = [];
    const lamps = [];
    for (const [sid, spec] of Object.entries(STATION_PART)) {
      const st = plan.stations.find((s) => s.id === sid); const S = typeof spec === 'string' ? { k: spec } : spec;
      if (!st || !index[S.k]) continue;
      const R = roomOf(st.room), mnt = STATION_MOUNT[sid] || {};
      // the part stands at the station, its back toward the nearest wall
      const dl = st.x - R.x, dr = R.x + R.w - st.x, dt = st.z - R.z, db = R.z + R.d - st.z, mn = Math.min(dl, dr, dt, db);
      const face = mn === dt ? 0 : mn === db ? Math.PI : mn === dl ? Math.PI / 2 : -Math.PI / 2;
      const m = sized(part(S.k), S.k, mnt.size); m.rotation.y = face;
      const back = mnt.back || 0; m.position.set(st.x - Math.sin(face) * back, fy(st.room) + (mnt.y || 0), st.z - Math.cos(face) * back);
      W.group.add(m); D.stations.push([sid, S.k]);
      if (mnt.seat) seats.push(m);
      const old = W.group.getObjectByName(`stlook:${sid}`); if (old) old.traverse((x) => { if (x.isMesh) x.visible = false; });
      if (S.after) swaps.push({ m, after: S.after });
    }
    // the kit's grey stand-in box at each station is the thing you press: it stays (the ray still finds it), but unseen where a part
    // or a figure or a door shows the thing instead
    for (const sid of [...D.stations.map((x) => x[0]), ...STATION_BARE]) {
      const o = W.interactables.find((x) => x.name === `station:${sid}`) || W.group.getObjectByName(`station:${sid}`);
      if (o && o.isMesh && o.material) { o.material = o.material.clone(); o.material.visible = false; }
    }
    // ---- the street at night: a sky over the open blocks, asphalt and paving, road markings, the pools of the sodium lamps ----
    const nearestTex = (cv) => { const tx = new THREE.CanvasTexture(cv); tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace; tx.userData.dot = true; return tx; };
    const rnd = (() => { let z = 7; return () => ((z = (z * 16807) % 2147483647) / 2147483647); })();
    // the sky: a dome round the player, stars above, the town's dark roofs and a few lit windows at the horizon, the glow of the fires
    const sky = (() => {
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256; const q = cv.getContext('2d');
      const gr = q.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#04060c'); gr.addColorStop(0.36, '#0a0e1c'); gr.addColorStop(0.47, '#1c1a2a'); gr.addColorStop(0.5, '#3a2420'); gr.addColorStop(0.53, '#0a0a0e'); gr.addColorStop(1, '#060608');
      q.fillStyle = gr; q.fillRect(0, 0, 1024, 256);
      // sparse dim stars high up, 2 x 2 texels each; the skyline has no lit windows (dark on dark they floated like specks) (a lone texel became a red-green-blue speck under the screen's colour fringe), none near the horizon glow
      for (let i = 0; i < 28; i++) { q.fillStyle = rnd() < 0.3 ? '#7c7a70' : '#3e4458'; q.fillRect(Math.floor(rnd() * 1022), Math.floor(rnd() * 60), 2, 2); }
      for (let i = 0; i < 5; i++) { const x = Math.floor(rnd() * 1024); q.fillStyle = 'rgba(240,120,40,0.35)'; q.fillRect(x - 24, 110, 48, 14); q.fillStyle = 'rgba(255,170,70,0.5)'; q.fillRect(x - 8, 116, 16, 8); }
      let x = 0;
      while (x < 1024) {
        const w = 8 + Math.floor(rnd() * 30), h = 4 + Math.floor(rnd() * 22);
        q.fillStyle = rnd() < 0.5 ? '#07080c' : '#0b0d14'; q.fillRect(x, 130 - h, w, h + 126);
        
        x += w;
      }
      const tx = nearestTex(cv); tx.wrapS = THREE.RepeatWrapping;
      const m = new THREE.Mesh(new THREE.SphereGeometry(52, 32, 16), new THREE.MeshBasicMaterial({ map: tx, side: THREE.BackSide, fog: false, depthWrite: false }));
      m.material.userData.dot = 'sky'; m.name = 'dot-night-sky'; m.renderOrder = -10; m.visible = false; m.frustumCulled = false; scene.add(m);
      return m;
    })();
    const SKY_FOG = new THREE.Color(0x1c1820);
    // the ground: asphalt for the roads and car parks, paving for the arcade (a dot tile each)
    const groundTile = (kind) => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 32; const q = cv.getContext('2d');
      if (kind === 'paving') {
        for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) { q.fillStyle = ((x + y) / 8) % 2 ? '#4a3a36' : '#3a3634'; q.fillRect(x, y, 8, 8); q.fillStyle = '#22201e'; q.fillRect(x, y, 8, 1); q.fillRect(x, y, 1, 8); }
      } else {
        q.fillStyle = '#26282c'; q.fillRect(0, 0, 32, 32);
        for (let i = 0; i < 90; i++) { q.fillStyle = rnd() < 0.5 ? '#30333a' : '#1c1e22'; q.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1); }
        q.fillStyle = '#18191c'; let cx = 4, cy = 20; for (let i = 0; i < 9; i++) { q.fillRect(cx, cy, 1, 1); cx += 1; cy += rnd() < 0.5 ? 1 : 0; }
      }
      const tx = nearestTex(cv); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; return tx;
    };
    const ASPHALT = groundTile('asphalt'), PAVING = groundTile('paving');
    const STREETS = ['S_URA', 'S_ODORI', 'S_SHOTEN', 'S_HIROBA', 'P_URA', 'O_PLAZA'];
    // (the kit's texture loader sets the floors again once its pictures arrive: the street floors are put back every two seconds)
    const streetFloors = () => { for (const id of STREETS) {
      const fl = scene.getObjectByName(`floor:${id}`), R = roomOf(id); if (!fl || !fl.material || fl.material.name === 'yk-street') continue;
      const pave = id === 'S_SHOTEN', tx = (pave ? PAVING : ASPHALT).clone(); tx.needsUpdate = true; tx.userData.dot = true; tx.repeat.set(R.w / (pave ? 2 : 3), R.d / (pave ? 2 : 3));
      fl.material = new THREE.MeshLambertMaterial({ map: tx }); fl.material.userData.dot = 'tile'; fl.material.name = 'yk-street';
    } };
    streetFloors(); setInterval(streetFloors, 2000);
    // road markings: a dashed centre line and a crossing on the wide street, bays in the car parks
    const paint = new THREE.MeshLambertMaterial({ color: 0xd8d4c4 }); paint.userData.dot = 'flat';
    const paintY = new THREE.MeshLambertMaterial({ color: 0xd8a830 }); paintY.userData.dot = 'flat';
    const stripe = (x, z, w, d, m = paint, room = 'S_ODORI') => { const st = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m); st.rotation.x = -Math.PI / 2; st.position.set(x, fy(room) + 0.015, z); st.name = 'dot-road-paint'; W.group.add(st); };
    for (let x = 52; x < 71; x += 3) stripe(x, 1, 1.6, 0.14, paintY);
    for (let z = -3; z < 6; z += 0.9) stripe(48.6, z, 1.8, 0.45);
    for (let x = 35; x < 46; x += 2.6) stripe(x, 4.2, 0.1, 2.4, paint, 'S_URA');
    for (let z = 2; z < 20; z += 2.6) stripe(125.8, z, 2.4, 0.1, paint, 'P_URA');
    // a lamp: the glowing head and the pool of orange light under it (the three nearest lamps light for real)
    const poolTex = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const q = cv.getContext('2d');
      const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x - 31.5, y - 31.5) / 32, a = Math.max(0, 1 - d) ** 1.4; if (a * 16 > B[(y & 3) * 4 + (x & 3)]) { q.fillStyle = a > 0.6 ? 'rgba(255,180,100,0.32)' : 'rgba(230,140,60,0.22)'; q.fillRect(x, y, 1, 1); } }
      return nearestTex(cv);
    })();
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffc070 }); headMat.userData.dot = 'flat';
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }); poolMat.userData.dot = 'flat';
    // 1.2.0 (#1 #3): the pole is 4.2 m (it was 2.25 m with its glowing head floating at 4 m); the head hangs under the end of the arm
    function lampDress(x, y, z, face = 0) {
      const top = y + REAL['street-lamp'].h, ax = Math.sin(face) * 0.16, az = Math.cos(face) * 0.16;
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.3), headMat); hd.position.set(x + ax, top - 0.28, z + az); hd.rotation.y = face; hd.name = 'dot-lamp-head'; W.group.add(hd);
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), poolMat); pl.rotation.x = -Math.PI / 2; pl.position.set(x, y + 0.03, z); pl.name = 'dot-lamp-pool'; pl.renderOrder = 2; W.group.add(pl);
    }
    // ---- the mood props ----
    for (const [room, k, x, z, face = 0, s = 1, id = null] of PROPS) {
      if (!index[k]) { D.props.push([k, 'missing']); continue; }
      const m = sized(part(k, s), k); m.rotation.y = face; m.position.set(x, fy(room), z); W.group.add(m); D.props.push([k, room]);
      if (id) D.surf[id] = m;
      if (k === 'street-lamp') { lamps.push(new THREE.Vector3(x, fy(room) + 4.0, z)); lampDress(x, fy(room), z, face); }
    }
    // the street lamps that still burn: three sodium lights follow the three lamps nearest the player (cheap on a phone)
    const lampLights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffa850, 0, 16, 1.2); l.name = 'dot-street-lamp'; scene.add(l); return l; });
    D.lamps = lamps.length;
    // ---- the helicopter: it comes down onto the pad when the last stand is over ----
    let heli = null;
    if (index.helicopter) { heli = part('helicopter'); heli.position.set(136, W.floorY(4) + 40, 6); heli.rotation.y = Math.PI / 2; heli.visible = false; W.group.add(heli); D.heli = heli; }
    // ---- the loot: a part where one exists ----
    const dressLoot = ({ mesh, def }) => {
      const lp = LOOT_PART[def.item], k = lp && lp[0]; if (!k || !index[k] || mesh.userData.dotDone) return;
      mesh.userData.dotDone = true; if (mesh.userData.model) mesh.userData.model.visible = false;
      const m = sized(part(k, 1), k, lp[1]); m.rotation.y = ((def.id.length * 37) % 360) * Math.PI / 180; mesh.add(m); D.loot++;
      if (D.dressed) seatLoot(mesh);
    };
    const G = window.__yk;
    if (G) { G.on('loot:placed', dressLoot); for (const o of W.interactables) if (String(o.name).startsWith('loot:')) dressLoot({ mesh: o, def: o.userData.def }); }
    // ---- 1.2.0 (#1 #4): everything put down on what is under it - the things of the case on their shelf / desk / counter / car (loot "on"),
    // the safe rooms' logs, the papers, the stations' radio / tape deck / rifle case. Nothing floats (kit tools/rest-check.mjs P45).
    const rc = new THREE.Raycaster(), DOWN = new THREE.Vector3(0, -1, 0);
    const shown = (o) => { for (let q = o; q; q = q.parent) if (q.visible === false) return false; return true; };
    const drawnBox = (o) => { const b = new THREE.Box3(); o.updateWorldMatrix(true, true); o.traverse((q) => { if (q.isMesh && q.material && q.material.visible !== false && shown(q)) b.expandByObject(q); }); return b; };
    const supports = () => { const out = Object.values(D.surf); for (const o of W.group.children) if (/^floor:/.test(o.name || '') || (o.name || '').startsWith('dot-part:')) out.push(o); return out; };
    // the first surface under (x, from, z), or the floor of the room
    function surfaceAt(x, z, from, floorY, own) {
      // five rays a few cm apart (a shelf board with gaps, a car's curved hood)
      // (the middle one when it meets something; a side ray can catch the edge of a shelf's side panel)
      let best = null; const sup = supports().filter((o) => o !== own);
      for (const [dx, dz] of [[0, 0], [0.07, 0], [-0.07, 0], [0, 0.07], [0, -0.07]]) {
        rc.set(new THREE.Vector3(x + dx, from, z + dz), DOWN); rc.far = from - floorY + 0.05;
        const h = rc.intersectObjects(sup, true).find((q) => !own || !own.getObjectById(q.object.id));
        if (h && dx === 0 && dz === 0) return h.point.y;
        if (h && (best == null || h.point.y < best)) best = h.point.y;
      }
      return best ?? floorY;
    }
    // put `obj` down at (x, z) (default: where it is), starting the ray at `from`
    function putDown(obj, floorY, o = {}) {
      const b = drawnBox(obj); if (b.isEmpty()) return null;
      const c = b.getCenter(new THREE.Vector3()), x = o.x ?? c.x, z = o.z ?? c.z;
      obj.position.x += x - c.x; obj.position.z += z - c.z;
      const y = surfaceAt(x, z, o.from ?? b.max.y + 0.4, floorY, obj);
      obj.position.y += y - b.min.y + 0.003;
      return y;
    }
    // a loot's place on its furniture: along the long side (at: 0..1), on the board under `lvl` (shelves: 'mid' 1.3 m, 'low' 0.75 m)
    function seatLoot(mesh) {
      const def = mesh.userData.def || {}, R = roomOf(def.room), f0 = W.floorY(R.floor || 0);
      const host = def.on && D.surf[def.on];
      if (!host) { putDown(mesh, f0, { from: f0 + 0.3 }); D.seated.push([def.id, def.on ? `missing ${def.on}` : 'floor', 0]); return; }
      const hb = new THREE.Box3().setFromObject(host), hs = hb.getSize(new THREE.Vector3()), along = def.at ?? 0.5, alongX = hs.x >= hs.z;
      const x = alongX ? hb.min.x + hs.x * (0.15 + along * 0.7) : (hb.min.x + hb.max.x) / 2 + (def.dx || 0), z = alongX ? (hb.min.z + hb.max.z) / 2 + (def.dz || 0) : hb.min.z + hs.z * (0.15 + along * 0.7);
      const from = def.lvl === 'low' ? f0 + 0.75 : def.lvl === 'mid' || /shelf/.test(host.name) ? f0 + 1.3 : hb.max.y + 0.3;
      const y = putDown(mesh, f0, { x, z, from });
      D.seated.push([def.id, def.on, y == null ? null : +(y - f0).toFixed(2)]);
    }
    function settle() {
      for (const o of W.interactables) {
        const n = String(o.name || '');
        if (n.startsWith('loot:')) seatLoot(o);
        else if (n.startsWith('log:')) { const R = roomOf(o.userData.def.room); putDown(o, W.floorY(R.floor || 0)); }
        else if (n.startsWith('doc:') && !(o.userData.def && (o.userData.def.wall || o.userData.pasted))) { const R = roomOf(o.userData.def.room); putDown(o, W.floorY(R.floor || 0)); }
      }
      for (const m of seats) { const R = plan.rooms.find((r) => { const p = m.position; return p.x >= r.x && p.x <= r.x + r.w && p.z >= r.z && p.z <= r.z + r.d && Math.abs(W.floorY(r.floor || 0) - p.y) < 2.5; }); putDown(m, R ? W.floorY(R.floor || 0) : m.position.y, { from: m.position.y + 1.2 }); }
    }
    D.settle = settle;

    // 1.4.1: the iron bars of the cellar cell (kit railing 'bars') take a flat iron colour (no painted texture), graded like the rest
    const iron = new THREE.MeshLambertMaterial({ color: 0x3a3a36 }); iron.name = 'yk-cell-bars';
    const ironBars = () => { scene.traverse((o) => { if (!/^prop:F_KCHIKA_BARS/.test(o.name)) return; o.traverse((m) => { if (m.isMesh && m.material && m.material !== iron && m.name !== 'prop-stub' && !(m.material.visible === false)) m.material = iron; }); }); };
    // ---- the palette over everything, and again while the world changes (doors, the dressing above) ----
    const dotify = () => { ironBars(); return dotifyScene(THREE, scene, { pal: PAL }); };
    D.dotified = dotify();
    setInterval(() => { try { dotify(); } catch (e) { /* the next pass */ } }, 2000);
    // ---- light: never pure black, a small light round the player, the next goal glows ----
    const amb = new THREE.AmbientLight(0x2a3440, 0.6); amb.name = 'dot-floor-light'; scene.add(amb);
    const near = new THREE.PointLight(0xd0d8e0, 3, 7, 1.4); near.name = 'dot-near-light'; scene.add(near);
    const cv = document.createElement('canvas'); cv.width = cv.height = 16; const g = cv.getContext('2d');
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.abs(x - 7.5) + Math.abs(y - 7.5); if (d < 7) { g.fillStyle = d < 3 ? '#fff4c8' : d < 5 ? '#f2c66a' : '#a8742a'; g.fillRect(x, y, 1, 1); } }
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.SRGBColorSpace;
    const beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true, fog: false })); beacon.scale.setScalar(0.22); beacon.name = 'dot-goal-beacon'; beacon.visible = false; scene.add(beacon);
    const goalLight = new THREE.PointLight(0xffd890, 0, 3.2, 1.5); goalLight.name = 'dot-goal-light'; scene.add(goalLight);
    let T = 0, goalT = 0, goal = null, blockT = 0, lightWant = null;
    let outside = false;
    const DAWN = new THREE.Color(0x6a4a52);
    // the helipad: a painted H in a circle on the roof (a pixel decal)
    {
      const cv2 = document.createElement('canvas'); cv2.width = cv2.height = 48; const q = cv2.getContext('2d');
      q.fillStyle = '#e8d8a0'; for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) { const d = Math.hypot(x - 23.5, y - 23.5); if (d > 19 && d < 22) q.fillRect(x, y, 1, 1); }
      q.fillRect(15, 13, 4, 22); q.fillRect(29, 13, 4, 22); q.fillRect(15, 22, 18, 4);
      const tx = new THREE.CanvasTexture(cv2); tx.magFilter = THREE.NearestFilter; tx.minFilter = THREE.NearestFilter; tx.colorSpace = THREE.SRGBColorSpace;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), new THREE.MeshLambertMaterial({ map: tx, transparent: true, depthWrite: false }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(137, W.floorY(4) + 0.02, 6.5); pad.name = 'dot-helipad'; W.group.add(pad);
    }
    const LIGHT = { hospital: { c: new THREE.Color(0x3a5058), i: 0.8 }, street: { c: new THREE.Color(0xd08a4a), i: 1.25 }, police: { c: new THREE.Color(0x3a4a78), i: 0.95 },
      tower: { c: new THREE.Color(0x4a5460), i: 0.9 }, roof: { c: new THREE.Color(0xb07a80), i: 1.4 } };
    const goalPos = () => {
      const tk = ctx.nextTask && ctx.nextTask(); if (!tk) return null;
      const m = tk.station ? W.interactables.find((o) => o.name === `station:${tk.station}` && o.visible !== false) : null;
      return m ? m.getWorldPosition(new THREE.Vector3()) : null;
    };
    worldUpdate = (dt) => {
        T += dt;
        if (sky.visible) sky.position.copy(ctx.camera.position);
        const c = ctx.camera.position; near.position.set(c.x, c.y - 0.2, c.z); near.intensity = ctx.lightOn === false ? 1 : 3;
        // the floor of light by block: outside, the sodium lamps and the fires light the street; the roof is the coming dawn
        blockT -= dt;
        if (blockT <= 0) {
          blockT = 0.5;
          const G = window.__yk, r = G && G.roomAtP ? G.roomAtP(c.x, c.z, ctx.floor || 0) : null, id = (r && r.id) || '';
          const want = /^O_ROOF/.test(id) ? LIGHT.roof : /^(S_URA|S_ODORI|S_SHOTEN|S_HIROBA|O_PLAZA|P_URA)$/.test(id) ? LIGHT.street : /^S_/.test(id) ? LIGHT.tower : /^P_/.test(id) ? LIGHT.police : /^O_/.test(id) ? LIGHT.tower : LIGHT.hospital;
          lightWant = want;
          // the roof is open to the sky: the dawn shows behind it (the stage look keeps the night elsewhere)
          if (want === LIGHT.roof) { sky.visible = false; scene.background = DAWN; if (scene.fog) scene.fog.color.copy(DAWN); }
          else if (want === LIGHT.street) { sky.visible = true; if (scene.background === DAWN) scene.background = null; if (scene.fog) scene.fog.color.copy(SKY_FOG); outside = true; }
          else if (scene.background === DAWN || outside) { sky.visible = false; outside = false; scene.background = null; ctx.stageLook && ctx.stageLook.apply(); }
        }
        if (lamps.length && blockT >= 0.49) {
          const near3 = lamps.map((v) => [v, v.distanceToSquared(c)]).sort((a, b) => a[1] - b[1]).slice(0, 3);
          lampLights.forEach((l, i) => { const n = near3[i]; if (n && n[1] < 30 * 30 && (ctx.floor || 0) === 0) { l.position.copy(n[0]); l.intensity = 22; } else l.intensity = 0; });
        }
        if (lightWant) { amb.color.lerp(lightWant.c, Math.min(1, dt * 2)); amb.intensity += (lightWant.i - amb.intensity) * Math.min(1, dt * 2); }
        goalT -= dt; if (goalT <= 0) { goalT = 0.5; goal = ctx.state.started ? goalPos() : null; }
        const gd = goal ? c.distanceTo(goal) : 99, on = gd < 14;
        beacon.visible = on && gd > 1.8; goalLight.intensity = on ? 4 + Math.sin(T * 3) * 1.2 : 0;
        if (on) { beacon.position.set(goal.x, goal.y + 0.55 + Math.sin(T * 2.5) * 0.05, goal.z); goalLight.position.set(goal.x, goal.y + 0.4, goal.z); }
        for (const s of swaps) for (const [task, k] of s.after) if (!s.done && ctx.state.tasks.includes(task)) { const kk = typeof k === 'function' ? k() : k; if (index[kk]) s.m.geometry = cgeo(kk); s.done = true; }
        // the helicopter: seen coming once the timer of the last stand runs low, landed when it is over
        if (heli) {
          const tm = ctx.timer && ctx.timer('T_HOLD'), done = ctx.state.tasks.includes('T_HOLD');
          if (done) { heli.visible = true; heli.position.y += (W.floorY(4) + 0.05 - heli.position.y) * Math.min(1, dt * 1.5); }
          else if (tm && tm.left < 25 && ctx.floor === 4) { heli.visible = true; heli.position.y = W.floorY(4) + 6 + tm.left * 1.4; }
        }
    };
    D.timings.dress = Math.round(performance.now() - t);
  });
}
